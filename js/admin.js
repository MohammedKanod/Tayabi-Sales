import { subscribeItems, addItem, addItems, deleteItem, addStock, removeStock,
         subscribeCustomers, addCustomer, deleteCustomer,
         subscribeOrders, markOrderCompleted, deleteOrder, deleteExpiredOrders,
         getOrdersByCustomer, getStockLogs,
         getCities, addCity, uploadImage,
         subscribePendingRequests, approveRequestLinkExisting, approveRequestCreateNew, rejectCustomerRequest,
         subscribeCustomerOrders, updateOrderStatus } from './db.js';
import { showToast, showSpinner, hideSpinner, confirmDialog, formatDate,
         getStockStatus, emptyState, fileToBase64, debounce } from './utils.js';

// ===== STATE =====
let allItems = [];
let allCustomers = [];
let allOrders = [];
let cities = [];

// ===== TABS =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
  });
});

// ===== MODAL HELPERS =====
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
});

// ===== LOW STOCK ALERTS =====
let lowStockDismissed = false;
let lowStockMinimized = false;
function renderLowStock() {
  const banner = document.getElementById('low-stock-banner');
  if (lowStockDismissed) { banner.innerHTML = ''; return; }
  const lowItems = allItems.filter(i => i.stock <= 10);
  if (!lowItems.length) { banner.innerHTML = ''; return; }
  banner.innerHTML = `
    <div class="alert-banner alert-warning" style="flex-direction:column;gap:6px;">
      <div style="display:flex;align-items:center;width:100%;gap:10px;">
        <span class="alert-icon">⚠️</span>
        <div style="flex:1;font-weight:700;font-size:0.95rem;">
          Low Stock Alert — ${lowItems.length} item${lowItems.length > 1 ? 's' : ''}
        </div>
        <button class="btn btn-secondary btn-sm" id="minimize-low-stock" title="Minimise" style="padding:4px 10px;font-size:0.8rem;">
          ${lowStockMinimized ? '▼ Show' : '▲ Hide'}
        </button>
        <button class="alert-close" id="dismiss-low-stock" title="Dismiss">✕</button>
      </div>
      ${lowStockMinimized ? '' : `<div style="padding-left:32px;display:flex;flex-wrap:wrap;gap:8px;">
        ${lowItems.map(i => `<span style="font-size:0.88rem;background:rgba(0,0,0,0.06);padding:3px 10px;border-radius:20px;">
          <b>${i.name}</b> — ${i.stock} ${i.unit}
        </span>`).join('')}
      </div>`}
    </div>`;
  document.getElementById('dismiss-low-stock').onclick = () => { lowStockDismissed = true; renderLowStock(); };
  document.getElementById('minimize-low-stock').onclick = () => { lowStockMinimized = !lowStockMinimized; renderLowStock(); };
}

// ===== ITEMS =====
subscribeItems(items => {
  allItems = items;
  renderItems();
  renderLowStock();
  populateItemSelects();
});

function renderItems() {
  const q = document.getElementById('item-search').value.toLowerCase();
  const filtered = allItems.filter(i => i.name.toLowerCase().includes(q));
  const container = document.getElementById('items-list');
  if (!filtered.length) { container.innerHTML = emptyState('No items found'); return; }

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Photo</th><th>Name</th><th>Sizes</th><th>Unit</th>
          <th>Stock</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${filtered.map(item => {
            const st = getStockStatus(item.stock);
            const img = item.imageUrl
              ? `<img class="item-row-img" src="${item.imageUrl}" alt="${item.name}" loading="lazy"/>`
              : `<div class="item-row-img-ph">📦</div>`;
            const sizes = item.sizes ? `<small style="color:var(--gray-500);">${item.sizes}</small>` : '-';
            return `<tr>
              <td>${img}</td>
              <td><b>${item.name}</b></td>
              <td>${sizes}</td>
              <td>${item.unit}</td>
              <td><b>${item.stock}</b></td>
              <td><span class="badge badge-${st.cls === 'green' ? 'green' : st.cls === 'yellow' ? 'yellow' : 'red'}">${st.label}</span></td>
              <td>
                <button class="btn btn-danger btn-sm" onclick="deleteItemHandler('${item.id}','${item.name}')">Delete</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

document.getElementById('item-search').addEventListener('input', debounce(renderItems, 250));

window.deleteItemHandler = async (id, name) => {
  if (!confirmDialog(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    showSpinner();
    await deleteItem(id);
    showToast(`"${name}" deleted`, 'success');
  } catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
};

// ===== ADD SINGLE ITEM =====
document.getElementById('btn-add-item').onclick = () => {
  document.getElementById('ai-name').value = '';
  document.getElementById('ai-stock').value = '';
  document.getElementById('ai-sizes').value = '';
  document.getElementById('ai-unit-other').classList.add('hidden');
  document.querySelectorAll('input[name="ai-unit"]').forEach(r => r.checked = false);
  document.getElementById('ai-photo-preview').innerHTML = '';
  openModal('modal-add-item');
};

document.querySelectorAll('input[name="ai-unit"]').forEach(r => {
  r.addEventListener('change', () => {
    document.getElementById('ai-unit-other').classList.toggle('hidden', r.value !== 'other');
  });
});

let singlePhotoBase64 = null;
document.getElementById('ai-photo').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  singlePhotoBase64 = await fileToBase64(file);
  document.getElementById('ai-photo-preview').innerHTML = `<img src="${singlePhotoBase64}" style="max-height:80px;border-radius:8px;"/>`;
};

document.getElementById('btn-save-item').onclick = async () => {
  const name = document.getElementById('ai-name').value.trim();
  const unitRadio = document.querySelector('input[name="ai-unit"]:checked');
  let unit = unitRadio ? unitRadio.value : '';
  if (unit === 'other') unit = document.getElementById('ai-unit-other').value.trim();
  const stock = document.getElementById('ai-stock').value;
  const sizes = document.getElementById('ai-sizes').value.trim();

  if (!name) { showToast('Item name is required', 'error'); return; }
  if (!unit) { showToast('Unit is required', 'error'); return; }
  if (stock === '') { showToast('Initial stock is required', 'error'); return; }

  try {
    showSpinner();
    let imageUrl = null;
    if (singlePhotoBase64) {
      imageUrl = await uploadImage(singlePhotoBase64, `items/${Date.now()}_${name}`);
    }
    await addItem({ name, unit, stock: Number(stock), sizes: sizes || null, imageUrl });
    singlePhotoBase64 = null;
    closeModal('modal-add-item');
    showToast(`"${name}" added!`, 'success');
  } catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
};

// ===== BULK ADD =====
let bulkPhotoMap = {};
function createBulkCard(index) {
  return `
    <div class="bulk-item-card" id="bulk-card-${index}">
      <div class="card-header">
        <span class="card-title">Item ${index + 1}</span>
      </div>
      <div class="bulk-item-fields">
        <div class="form-group">
          <label>Item Name *</label>
          <input type="text" class="bi-name" placeholder="Item name"/>
        </div>
        <div class="form-group">
          <label>Initial Stock *</label>
          <input type="number" class="bi-stock" min="0" placeholder="0"/>
        </div>
        <div class="form-group">
          <label>Sizes (optional)</label>
          <input type="text" class="bi-sizes" placeholder="e.g. 6mm, 8mm"/>
        </div>
      </div>
      <div class="form-group" style="margin-top:10px;">
        <label>Unit *</label>
        <div class="radio-group">
          <label class="radio-option"><input type="radio" name="bi-unit-${index}" value="kg"/><span>kg</span></label>
          <label class="radio-option"><input type="radio" name="bi-unit-${index}" value="pcs"/><span>pcs</span></label>
          <label class="radio-option"><input type="radio" name="bi-unit-${index}" value="meter"/><span>meter</span></label>
          <label class="radio-option"><input type="radio" name="bi-unit-${index}" value="other"/><span>Other</span></label>
        </div>
        <input type="text" class="bi-unit-other hidden" placeholder="Specify unit..."/>
      </div>
      <div class="form-group" style="margin-top:10px;">
        <label>Photo (optional)</label>
        <div class="photo-upload-box" style="padding:10px;">
          <div class="upload-icon" style="font-size:1.4rem;">📷</div>
          <div class="upload-label" style="font-size:0.8rem;">Click to select</div>
          <input type="file" class="bi-photo" accept="image/*"/>
        </div>
        <div class="bi-photo-preview" style="margin-top:6px;"></div>
      </div>
    </div>
    <hr class="divider"/>`;
}

let bulkCount = 3;
function initBulkContainer() {
  const container = document.getElementById('bulk-items-container');
  container.innerHTML = '';
  bulkPhotoMap = {};
  for (let i = 0; i < bulkCount; i++) container.innerHTML += createBulkCard(i);
  // Add 1 extra blank card ready
  container.innerHTML += createBulkCard(bulkCount);
  attachBulkPhotoListeners();
  attachBulkUnitListeners();
}

function attachBulkPhotoListeners() {
  document.querySelectorAll('.bi-photo').forEach((input, i) => {
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const b64 = await fileToBase64(file);
      bulkPhotoMap[i] = b64;
      const card = input.closest('.bulk-item-card');
      const preview = card.querySelector('.bi-photo-preview');
      preview.innerHTML = `<img src="${b64}" style="max-height:70px;border-radius:6px;"/>`;
    };
  });
}

function attachBulkUnitListeners() {
  document.querySelectorAll('.bulk-item-card').forEach((card, i) => {
    card.querySelectorAll('input[type="radio"]').forEach(r => {
      r.onchange = () => {
        card.querySelector('.bi-unit-other').classList.toggle('hidden', r.value !== 'other');
      };
    });
  });
}

document.getElementById('btn-bulk-items').onclick = () => {
  bulkCount = 3;
  initBulkContainer();
  openModal('modal-bulk-items');
};

document.getElementById('btn-save-bulk').onclick = async () => {
  const cards = document.querySelectorAll('.bulk-item-card');
  const items = [];
  let valid = true;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const name = card.querySelector('.bi-name').value.trim();
    const stock = card.querySelector('.bi-stock').value;
    const sizes = card.querySelector('.bi-sizes').value.trim();
    const unitRadio = card.querySelector('input[type="radio"]:checked');
    let unit = unitRadio ? unitRadio.value : '';
    if (unit === 'other') unit = card.querySelector('.bi-unit-other').value.trim();

    if (!name && !unitRadio && !stock) continue; // skip blank cards
    if (!name) { showToast(`Item ${i+1}: Name is required`, 'error'); valid = false; break; }
    if (!unit) { showToast(`Item ${i+1}: Unit is required`, 'error'); valid = false; break; }
    if (stock === '') { showToast(`Item ${i+1}: Stock is required`, 'error'); valid = false; break; }

    items.push({ name, unit, stock: Number(stock), sizes: sizes || null, photoIndex: i });
  }

  if (!valid || !items.length) { if (valid) showToast('No items to save', 'warning'); return; }

  try {
    showSpinner();
    for (const item of items) {
      let imageUrl = null;
      if (bulkPhotoMap[item.photoIndex]) {
        imageUrl = await uploadImage(bulkPhotoMap[item.photoIndex], `items/${Date.now()}_${item.name}`);
      }
      await addItem({ name: item.name, unit: item.unit, stock: item.stock, sizes: item.sizes, imageUrl });
    }
    bulkPhotoMap = {};
    closeModal('modal-bulk-items');
    showToast(`${items.length} item(s) added!`, 'success');
  } catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
};

// ===== STOCK MANAGEMENT =====
function populateItemSelects() {
  ['stock-add-item', 'stock-remove-item', 'stock-log-item'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="">Select item...</option>' +
      allItems.map(i => `<option value="${i.id}" ${i.id === val ? 'selected' : ''}>${i.name} (${i.stock} ${i.unit})</option>`).join('');
  });
}

document.getElementById('btn-add-stock').onclick = async () => {
  const itemId = document.getElementById('stock-add-item').value;
  const qty = Number(document.getElementById('stock-add-qty').value);
  if (!itemId) { showToast('Select an item', 'error'); return; }
  if (!qty || qty <= 0) { showToast('Enter a valid quantity', 'error'); return; }
  try {
    showSpinner();
    await addStock(itemId, qty);
    document.getElementById('stock-add-qty').value = '';
    showToast(`Stock added successfully`, 'success');
  } catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
};

document.getElementById('btn-remove-stock').onclick = async () => {
  const itemId = document.getElementById('stock-remove-item').value;
  const qty = Number(document.getElementById('stock-remove-qty').value);
  if (!itemId) { showToast('Select an item', 'error'); return; }
  if (!qty || qty <= 0) { showToast('Enter a valid quantity', 'error'); return; }
  try {
    showSpinner();
    await removeStock(itemId, qty);
    document.getElementById('stock-remove-qty').value = '';
    showToast(`Stock removed successfully`, 'success');
  } catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
};

document.getElementById('stock-log-item').onchange = async () => {
  const itemId = document.getElementById('stock-log-item').value;
  if (!itemId) { document.getElementById('stock-log-list').innerHTML = ''; return; }
  try {
    showSpinner();
    const logs = await getStockLogs(itemId);
    const container = document.getElementById('stock-log-list');
    if (!logs.length) { container.innerHTML = emptyState('No logs found'); return; }
    container.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Type</th><th>Quantity</th><th>Date</th></tr></thead>
      <tbody>${logs.map(l => `<tr>
        <td><span class="badge ${l.changeType === 'add' ? 'badge-green' : l.changeType === 'sold' ? 'badge-blue' : 'badge-red'}">${l.changeType}</span></td>
        <td><b>${l.quantity}</b></td>
        <td>${formatDate(l.timestamp)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
};

// ===== CUSTOMERS =====
async function loadCities() {
  cities = await getCities();
  renderCityDropdowns();
}
loadCities();

function renderCityDropdowns() {
  const acCity = document.getElementById('ac-city');
  const filterCity = document.getElementById('customer-city-filter');
  const opts = cities.map(c => `<option value="${c}">${c}</option>`).join('');
  acCity.innerHTML = '<option value="">Select city...</option>' + opts;
  filterCity.innerHTML = '<option value="">All Cities</option>' + opts;
}

document.getElementById('btn-add-city-inline').onclick = () => {
  document.getElementById('ac-new-city').classList.toggle('hidden');
};

subscribeCustomers(customers => {
  allCustomers = customers;
  renderCustomers();
});

function renderCustomers() {
  const q = document.getElementById('customer-search').value.toLowerCase();
  const city = document.getElementById('customer-city-filter').value;
  const sort = document.getElementById('customer-sort').value;

  let list = allCustomers.filter(c =>
    (c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)) &&
    (!city || c.city === city)
  );
  list.sort((a, b) => sort === 'city'
    ? (a.city || '').localeCompare(b.city || '')
    : a.name.localeCompare(b.name));

  const container = document.getElementById('customers-list');
  if (!list.length) { container.innerHTML = emptyState('No customers found'); return; }
  container.innerHTML = list.map(c => `
    <div class="customer-card">
      <div style="width:44px;height:44px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">👤</div>
      <div class="customer-card-info">
        <div style="font-weight:700;font-size:1rem;">${c.name}</div>
        <div style="font-size:0.85rem;color:var(--gray-500);">${c.phone || ''} ${c.city ? `· ${c.city}` : ''}</div>
        ${c.address ? `<div style="font-size:0.8rem;color:var(--gray-400);">${c.address}</div>` : ''}
      </div>
      <div class="customer-card-actions">
        <button class="btn btn-secondary btn-sm" onclick="viewCustomerOrders('${c.id}','${escapeHtml(c.name)}')">History</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCustomerHandler('${c.id}','${escapeHtml(c.name)}')">Delete</button>
      </div>
    </div>`).join('');
}

function escapeHtml(s) { return s.replace(/'/g, "\\'"); }

document.getElementById('customer-search').addEventListener('input', debounce(renderCustomers, 250));
document.getElementById('customer-city-filter').addEventListener('change', renderCustomers);
document.getElementById('customer-sort').addEventListener('change', renderCustomers);

document.getElementById('btn-add-customer').onclick = () => {
  ['ac-name','ac-phone','ac-address'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ac-new-city').classList.add('hidden');
  document.getElementById('ac-new-city').value = '';
  openModal('modal-add-customer');
};

document.getElementById('btn-save-customer').onclick = async () => {
  const name = document.getElementById('ac-name').value.trim();
  const phone = document.getElementById('ac-phone').value.trim();
  const address = document.getElementById('ac-address').value.trim();
  let city = document.getElementById('ac-city').value;
  const newCity = document.getElementById('ac-new-city').value.trim();

  if (!name) { showToast('Name is required', 'error'); return; }
  if (!phone) { showToast('Phone is required', 'error'); return; }

  if (newCity) {
    await addCity(newCity);
    city = newCity;
    cities = await getCities();
    renderCityDropdowns();
  }

  try {
    showSpinner();
    await addCustomer({ name, phone, address, city });
    closeModal('modal-add-customer');
    showToast(`Customer "${name}" added!`, 'success');
  } catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
};

window.deleteCustomerHandler = async (id, name) => {
  if (!confirmDialog(`Delete customer "${name}"?`)) return;
  try { showSpinner(); await deleteCustomer(id); showToast('Customer deleted', 'success'); }
  catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
};

window.viewCustomerOrders = async (customerId, name) => {
  document.getElementById('customer-orders-title').textContent = `Orders: ${name}`;
  const list = document.getElementById('customer-orders-list');
  list.innerHTML = '<div class="spinner" style="margin:20px auto;"></div>';
  openModal('modal-customer-orders');
  try {
    const orders = await getOrdersByCustomer(customerId);
    if (!orders.length) { list.innerHTML = emptyState('No orders found'); return; }
    list.innerHTML = orders.map(o => renderOrderCard(o, false)).join('');
  } catch (e) { list.innerHTML = `<p style="color:var(--danger);">${e.message}</p>`; }
};

// ===== ORDERS =====
subscribeOrders(orders => {
  allOrders = orders;
  deleteExpiredOrders(orders);
  renderOrders();
});

function renderOrders() {
  const q = document.getElementById('order-search').value.toLowerCase();
  const status = document.getElementById('order-status-filter').value;
  const dateVal = document.getElementById('order-date-filter').value;

  let list = allOrders.filter(o => {
    const matchQ = o.customerName.toLowerCase().includes(q) || o.id.includes(q);
    const matchStatus = !status || o.status === status;
    let matchDate = true;
    if (dateVal && o.timestamp) {
      const d = o.timestamp.toDate();
      matchDate = d.toISOString().slice(0,10) === dateVal;
    }
    return matchQ && matchStatus && matchDate;
  });

  const container = document.getElementById('orders-list');
  if (!list.length) { container.innerHTML = emptyState('No orders found'); return; }
  container.innerHTML = list.map(o => renderOrderCard(o, true)).join('');
}

function renderOrderCard(order, showActions) {
  const isPending = order.status === 'pending';
  let autoDeleteInfo = '';
  if (order.deleteAt) {
    const diff = order.deleteAt - Date.now();
    if (diff > 0) {
      const daysLeft = Math.ceil(diff / (24 * 60 * 60 * 1000));
      autoDeleteInfo = `<span style="font-size:0.78rem;color:var(--gray-400);margin-left:8px;">🗑 Auto-deletes in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}</span>`;
    } else {
      autoDeleteInfo = `<span style="font-size:0.78rem;color:var(--danger);margin-left:8px;">🗑 Pending deletion</span>`;
    }
  }
  return `
    <div class="order-card">
      <div class="order-card-header">
        <div>
          <div style="font-weight:700;font-size:1rem;">${order.customerName}</div>
          <div style="font-size:0.8rem;color:var(--gray-400);">ID: ${order.id} · ${formatDate(order.timestamp)}</div>
          <div style="margin-top:6px;">
            <span class="badge ${isPending ? 'badge-yellow' : 'badge-green'}">${order.status}</span>
            <span style="margin-left:8px;font-size:0.85rem;color:var(--gray-500);">${order.totalItems} items total</span>
            ${autoDeleteInfo}
          </div>
        </div>
        ${showActions ? `<div class="order-card-actions">
          <button class="btn btn-secondary btn-sm" onclick="viewOrderDetail(${JSON.stringify(order).replace(/"/g, '&quot;')})">View</button>
          ${isPending ? `<button class="btn btn-success btn-sm" onclick="completeOrderHandler('${order.id}')">Mark Complete</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="exportOrderPDF(${JSON.stringify(order).replace(/"/g, '&quot;')})">PDF</button>
          <button class="btn btn-secondary btn-sm" onclick="shareWhatsApp(${JSON.stringify(order).replace(/"/g, '&quot;')})">WhatsApp</button>
          <button class="btn btn-danger btn-sm" onclick="deleteOrderHandler('${order.id}')">Delete</button>
        </div>` : ''}
      </div>
    </div>`;
}

document.getElementById('order-search').addEventListener('input', debounce(renderOrders, 250));
document.getElementById('order-status-filter').addEventListener('change', renderOrders);
document.getElementById('order-date-filter').addEventListener('change', renderOrders);

window.viewOrderDetail = (order) => {
  const content = document.getElementById('order-detail-content');
  const actions = document.getElementById('order-detail-actions');
  content.innerHTML = `
    <div style="margin-bottom:12px;">
      <b>Customer:</b> ${order.customerName}<br/>
      <b>Order ID:</b> ${order.id}<br/>
      <b>Date:</b> ${formatDate(order.timestamp)}<br/>
      <b>Status:</b> <span class="badge ${order.status === 'pending' ? 'badge-yellow' : 'badge-green'}">${order.status}</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit</th></tr></thead>
        <tbody>${order.items.map((it, i) => `<tr>
          <td>${i+1}</td><td>${it.name}</td><td><b>${it.qty}</b></td><td>${it.unit}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  actions.innerHTML = `
    <button class="btn btn-secondary" data-close="modal-order-detail">Close</button>
    ${order.status === 'pending' ? `<button class="btn btn-success" onclick="completeOrderHandler('${order.id}');closeModal('modal-order-detail')">Mark Complete</button>` : ''}
    <button class="btn btn-secondary" onclick="exportOrderPDF(${JSON.stringify(order).replace(/"/g, '&quot;')})">Export PDF</button>
    <button class="btn btn-secondary" onclick="shareWhatsApp(${JSON.stringify(order).replace(/"/g, '&quot;')})">WhatsApp</button>`;

  // Re-attach close listener
  actions.querySelectorAll('[data-close]').forEach(btn => {
    btn.onclick = () => closeModal(btn.dataset.close);
  });
  openModal('modal-order-detail');
};

window.closeModal = closeModal;

window.completeOrderHandler = async (orderId) => {
  if (!confirmDialog('Mark this order as completed?')) return;
  try { showSpinner(); await markOrderCompleted(orderId); showToast('Order marked as completed', 'success'); }
  catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
};

window.deleteOrderHandler = async (orderId) => {
  if (!confirmDialog('Delete this order? This cannot be undone.')) return;
  try { showSpinner(); await deleteOrder(orderId); showToast('Order deleted', 'success'); }
  catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
};

window.exportOrderPDF = (order) => {
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Order ${order.id}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background:#f0f0f0;}</style>
    </head><body>
    <h2>Tayabi Hardware</h2>
    <p><b>Order ID:</b> ${order.id}</p>
    <p><b>Customer:</b> ${order.customerName}</p>
    <p><b>Status:</b> ${order.status}</p>
    <p><b>Date:</b> ${formatDate(order.timestamp)}</p>
    <table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit</th></tr></thead>
    <tbody>${order.items.map((it, i) => `<tr><td>${i+1}</td><td>${it.name}</td><td>${it.qty}</td><td>${it.unit}</td></tr>`).join('')}</tbody>
    </table>
    <p><b>Total Items:</b> ${order.totalItems}</p>
    <script>window.print();<\/script>
    </body></html>`);
  win.document.close();
};

window.shareWhatsApp = (order) => {
  const lines = order.items.map((it, i) => `${i+1}. ${it.name} - ${it.qty} ${it.unit}`).join('\n');
  const msg = `*Tayabi Hardware*\nOrder ID: ${order.id}\nCustomer: ${order.customerName}\n\nItems:\n${lines}\n\nTotal: ${order.totalItems} items\nStatus: ${order.status}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
};

// ===== BULK PHOTO UPLOAD =====
document.getElementById('bulk-photo-input').onchange = async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  const grid = document.getElementById('bulk-photo-items');
  const actions = document.getElementById('bulk-photo-actions');
  grid.innerHTML = '<p style="color:var(--gray-500);margin-bottom:12px;">Fill in names and stock for each photo:</p><div class="photo-bulk-grid" id="photo-bulk-grid"></div>';
  actions.classList.remove('hidden');

  const gridEl = document.getElementById('photo-bulk-grid');
  for (let i = 0; i < files.length; i++) {
    const b64 = await fileToBase64(files[i]);
    gridEl.innerHTML += `
      <div class="photo-bulk-card" data-photo="${encodeURIComponent(b64)}" id="pbc-${i}">
        <img src="${b64}" alt="Item ${i+1}"/>
        <div class="form-group" style="margin-bottom:8px;">
          <label>Item Name *</label>
          <input type="text" class="pbc-name" placeholder="e.g. Cement Bag"/>
        </div>
        <div class="form-group" style="margin-bottom:8px;">
          <label>Unit *</label>
          <div class="radio-group">
            <label class="radio-option"><input type="radio" name="pbc-unit-${i}" value="kg"/><span>kg</span></label>
            <label class="radio-option"><input type="radio" name="pbc-unit-${i}" value="pcs"/><span>pcs</span></label>
            <label class="radio-option"><input type="radio" name="pbc-unit-${i}" value="meter"/><span>meter</span></label>
            <label class="radio-option"><input type="radio" name="pbc-unit-${i}" value="other"/><span>Other</span></label>
          </div>
          <input type="text" class="pbc-unit-other hidden" placeholder="Specify unit..." style="margin-top:6px;"/>
        </div>
        <div class="form-group" style="margin-bottom:8px;">
          <label>Sizes (optional)</label>
          <input type="text" class="pbc-sizes" placeholder="e.g. 6mm, 8mm"/>
        </div>
        <div class="form-group">
          <label>Initial Stock *</label>
          <input type="number" class="pbc-stock" min="0" placeholder="0"/>
        </div>
      </div>`;
  }

  // Attach radio unit listeners
  gridEl.querySelectorAll('.photo-bulk-card').forEach(card => {
    card.querySelectorAll('input[type="radio"]').forEach(r => {
      r.onchange = () => card.querySelector('.pbc-unit-other').classList.toggle('hidden', r.value !== 'other');
    });
  });
};

document.getElementById('btn-save-photo-items').onclick = async () => {
  const cards = document.querySelectorAll('.photo-bulk-card');
  let valid = true;
  const items = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const name = card.querySelector('.pbc-name').value.trim();
    const stock = card.querySelector('.pbc-stock').value;
    const sizes = card.querySelector('.pbc-sizes').value.trim();
    const unitRadio = card.querySelector('input[type="radio"]:checked');
    let unit = unitRadio ? unitRadio.value : '';
    if (unit === 'other') unit = card.querySelector('.pbc-unit-other').value.trim();
    const photo = decodeURIComponent(card.dataset.photo);

    if (!name) { showToast(`Item ${i+1}: Name required`, 'error'); valid = false; break; }
    if (!unit) { showToast(`Item ${i+1}: Unit required`, 'error'); valid = false; break; }
    if (stock === '') { showToast(`Item ${i+1}: Stock required`, 'error'); valid = false; break; }
    items.push({ name, unit, stock: Number(stock), sizes: sizes || null, photo });
  }
  if (!valid) return;

  try {
    showSpinner();
    for (const item of items) {
      let imageUrl = null;
      if (item.photo) imageUrl = await uploadImage(item.photo, `items/${Date.now()}_${item.name}`);
      await addItem({ name: item.name, unit: item.unit, stock: item.stock, sizes: item.sizes, imageUrl });
    }
    document.getElementById('bulk-photo-items').innerHTML = '';
    document.getElementById('bulk-photo-actions').classList.add('hidden');
    document.getElementById('bulk-photo-input').value = '';
    showToast(`${items.length} item(s) saved!`, 'success');
  } catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
};

// ===== CUSTOMER REQUESTS =====
let allRequests = [];
subscribePendingRequests(reqs => {
  allRequests = reqs;
  renderRequests();
  const badge = document.getElementById('requests-badge');
  if (reqs.length) {
    badge.textContent = reqs.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
});

function renderRequests() {
  const container = document.getElementById('requests-list');
  if (!allRequests.length) { container.innerHTML = emptyState('No pending requests'); return; }
  container.innerHTML = `
    <div class="requests-grid">
      ${allRequests.map(r => `
        <div class="request-card">
          <div class="request-avatar">
            ${r.photoURL
              ? `<img src="${r.photoURL}" alt="" referrerpolicy="no-referrer"/>`
              : `<div class="ph">👤</div>`}
          </div>
          <div class="request-info">
            <div class="request-name">${escapeHtmlSafe(r.name || 'Unnamed user')}</div>
            <div class="request-email">${escapeHtmlSafe(r.email || '-')}</div>
            <div class="request-meta">Requested ${formatDate(r.createdAt)}</div>
          </div>
          <div class="request-actions">
            <button class="btn btn-success btn-sm" onclick="approveRequestHandler('${r.id}')">Approve</button>
            <button class="btn btn-danger btn-sm" onclick="rejectRequestHandler('${r.id}')">Reject</button>
          </div>
        </div>`).join('')}
    </div>`;
}

let activeRequest = null;
let approveMode = 'link'; // 'link' or 'create'

window.approveRequestHandler = (id) => {
  const req = allRequests.find(r => r.id === id);
  if (!req) return;
  activeRequest = req;
  approveMode = 'link';

  // Header
  document.getElementById('approve-email').textContent = req.email || '';
  const avatar = document.getElementById('approve-avatar');
  avatar.innerHTML = req.photoURL
    ? `<img src="${req.photoURL}" alt="" referrerpolicy="no-referrer"/>`
    : '<div class="ph">👤</div>';
  document.getElementById('approve-google-name').textContent = req.name || '';

  // Mode toggle defaults to "Link existing"
  document.querySelector('input[name="approve-mode"][value="link"]').checked = true;
  toggleApproveMode('link');

  // Populate existing-customer dropdown
  const sel = document.getElementById('approve-existing-customer');
  sel.innerHTML = '<option value="">Select a customer…</option>' +
    [...allCustomers]
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .map(c => {
        const tag = c.email ? ' (already linked)' : '';
        return `<option value="${c.id}" ${c.email ? 'disabled' : ''}>${escapeHtmlSafe(c.name)} – ${c.phone || ''}${tag}</option>`;
      }).join('');

  // Reset "create new" fields, prefill name
  document.getElementById('approve-new-name').value = req.name || '';
  document.getElementById('approve-new-phone').value = '';
  document.getElementById('approve-new-address').value = '';
  // City dropdown
  const citySel = document.getElementById('approve-new-city');
  citySel.innerHTML = '<option value="">Select city…</option>' +
    cities.map(c => `<option value="${c}">${c}</option>`).join('');

  openModal('modal-approve-request');
};

function toggleApproveMode(mode) {
  approveMode = mode;
  document.getElementById('approve-link-section').classList.toggle('hidden', mode !== 'link');
  document.getElementById('approve-create-section').classList.toggle('hidden', mode !== 'create');
}

document.querySelectorAll('input[name="approve-mode"]').forEach(r => {
  r.addEventListener('change', () => toggleApproveMode(r.value));
});

document.getElementById('btn-confirm-approve').addEventListener('click', async () => {
  if (!activeRequest) return;
  try {
    showSpinner();
    if (approveMode === 'link') {
      const customerId = document.getElementById('approve-existing-customer').value;
      if (!customerId) { hideSpinner(); showToast('Pick a customer to link', 'error'); return; }
      await approveRequestLinkExisting(activeRequest.id, customerId, activeRequest.email);
    } else {
      const name = document.getElementById('approve-new-name').value.trim();
      const phone = document.getElementById('approve-new-phone').value.trim();
      const address = document.getElementById('approve-new-address').value.trim();
      const city = document.getElementById('approve-new-city').value;
      if (!name) { hideSpinner(); showToast('Customer name is required', 'error'); return; }
      if (!phone) { hideSpinner(); showToast('Phone number is required', 'error'); return; }
      await approveRequestCreateNew(activeRequest.id, {
        name, phone, address, city, email: activeRequest.email
      });
    }
    closeModal('modal-approve-request');
    showToast('Customer approved', 'success');
    activeRequest = null;
  } catch (e) {
    console.error(e);
    showToast(e.message || 'Failed to approve. Please try again.', 'error');
  } finally { hideSpinner(); }
});

window.rejectRequestHandler = async (id) => {
  const req = allRequests.find(r => r.id === id);
  if (!req) return;
  if (!confirmDialog(`Reject request from ${req.email || 'this user'}? This will delete the request.`)) return;
  try {
    showSpinner();
    await rejectCustomerRequest(id);
    showToast('Request rejected', 'success');
  } catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
};

// ===== CUSTOMER ORDERS =====
let allCustomerOrders = [];
subscribeCustomerOrders(orders => {
  allCustomerOrders = orders;
  renderCustomerOrders();
});

function renderCustomerOrders() {
  const q = (document.getElementById('cust-order-search').value || '').toLowerCase();
  const status = document.getElementById('cust-order-status-filter').value;
  const list = allCustomerOrders.filter(o => {
    const haystack = `${o.customerEmail || ''} ${o.customerName || ''} ${o.customerPhone || ''}`.toLowerCase();
    return (!q || haystack.includes(q)) && (!status || o.status === status);
  });

  const container = document.getElementById('cust-orders-list');
  if (!list.length) { container.innerHTML = emptyState('No customer orders found'); return; }

  container.innerHTML = list.map(o => {
    const itemsHtml = (o.items || []).map(i =>
      `<div style="font-size:0.88rem;">• ${escapeHtmlSafe(i.name)} <b>× ${i.quantity}</b></div>`
    ).join('');
    const badgeCls = o.status === 'completed' ? 'badge-green'
                   : o.status === 'cancelled' ? 'badge-red' : 'badge-yellow';
    const heading = o.customerName || o.customerEmail || o.customerPhone || 'Unknown';
    const subline = [o.customerEmail, o.customerPhone].filter(Boolean).join(' · ');
    return `
      <div class="order-card">
        <div class="order-card-header" style="align-items:flex-start;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:1rem;">👤 ${escapeHtmlSafe(heading)}</div>
            ${subline ? `<div style="font-size:0.85rem;color:var(--gray-500);">${escapeHtmlSafe(subline)}</div>` : ''}
            <div style="font-size:0.8rem;color:var(--gray-400);">ID: ${o.id} · ${formatDate(o.createdAt)}</div>
            <div style="margin-top:6px;">
              <span class="badge ${badgeCls}">${o.status || 'pending'}</span>
            </div>
            <div style="margin-top:10px;">${itemsHtml || '<i style="color:var(--gray-400);">No items</i>'}</div>
            ${o.remark ? `<div style="margin-top:8px;font-size:0.88rem;background:var(--gray-50);padding:8px 10px;border-radius:8px;"><b>Remark:</b> ${escapeHtmlSafe(o.remark)}</div>` : ''}
          </div>
          <div class="order-card-actions" style="align-items:flex-end;">
            <select onchange="updateCustomerOrderStatus('${o.id}', this.value)" style="min-width:140px;">
              <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>Completed</option>
              <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
        </div>
      </div>`;
  }).join('');
}

function escapeHtmlSafe(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

document.getElementById('cust-order-search').addEventListener('input', debounce(renderCustomerOrders, 250));
document.getElementById('cust-order-status-filter').addEventListener('change', renderCustomerOrders);

window.updateCustomerOrderStatus = async (id, status) => {
  try {
    showSpinner();
    await updateOrderStatus(id, status);
    showToast(`Order marked ${status}`, 'success');
  } catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
};
