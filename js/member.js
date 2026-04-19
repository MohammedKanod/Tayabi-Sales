import { subscribeItems, subscribeCustomers, placeOrder, getCities } from './db.js';
import { showToast, showSpinner, hideSpinner, generateOrderId,
         getStockStatus, emptyState, debounce } from './utils.js';

// ===== STATE =====
let allItems = [];
let allCustomers = [];
let selectedCustomer = null;
let cart = []; // [{itemId, name, unit, qty, stock, imageUrl}]
let pendingItem = null;

// ===== SUBSCRIPTIONS =====
subscribeItems(items => { allItems = items; });
subscribeCustomers(customers => {
  allCustomers = customers;
  renderMemberCustomers();
});

// ===== CITIES =====
getCities().then(cities => {
  const sel = document.getElementById('member-city-filter');
  sel.innerHTML = '<option value="">All Cities</option>' +
    cities.map(c => `<option value="${c}">${c}</option>`).join('');
});

// ===== CUSTOMER SELECT =====
function renderMemberCustomers() {
  const q = (document.getElementById('member-customer-search').value || '').toLowerCase();
  const city = document.getElementById('member-city-filter').value;
  let list = allCustomers.filter(c =>
    (c.name.toLowerCase().includes(q) || (c.phone||'').includes(q)) &&
    (!city || c.city === city)
  );
  const container = document.getElementById('member-customers-list');
  if (!list.length) { container.innerHTML = emptyState('No customers found'); return; }
  container.innerHTML = list.map(c => `
    <div class="member-customer-card" data-id="${c.id}" onclick="selectCustomer('${c.id}')">
      <div class="cust-avatar">👤</div>
      <div class="cust-info">
        <div class="cust-name">${c.name}</div>
        <div class="cust-meta">${c.phone||''} ${c.city ? `· ${c.city}` : ''}</div>
      </div>
    </div>`).join('');
}

document.getElementById('member-customer-search').addEventListener('input', debounce(renderMemberCustomers, 250));
document.getElementById('member-city-filter').addEventListener('change', renderMemberCustomers);

window.selectCustomer = (id) => {
  selectedCustomer = allCustomers.find(c => c.id === id);
  if (!selectedCustomer) return;
  cart = [];
  document.getElementById('step-customer').classList.add('hidden');
  document.getElementById('step-order').classList.remove('hidden');
  document.getElementById('order-customer-name').textContent = selectedCustomer.name;
  document.getElementById('order-customer-info').textContent =
    `${selectedCustomer.phone||''} ${selectedCustomer.city ? `· ${selectedCustomer.city}` : ''}`;
  renderCart();
};

document.getElementById('btn-change-customer').onclick = () => {
  selectedCustomer = null;
  cart = [];
  document.getElementById('step-order').classList.add('hidden');
  document.getElementById('step-customer').classList.remove('hidden');
  document.getElementById('member-item-search').value = '';
  document.getElementById('member-items-dropdown').classList.add('hidden');
};

// ===== ITEM SEARCH =====
const itemSearch = document.getElementById('member-item-search');
const itemsDropdown = document.getElementById('member-items-dropdown');

itemSearch.addEventListener('input', debounce(() => {
  const q = itemSearch.value.toLowerCase().trim();
  if (!q) { itemsDropdown.classList.add('hidden'); return; }
  const results = allItems.filter(i => i.name.toLowerCase().includes(q));
  if (!results.length) {
    itemsDropdown.innerHTML = `<div style="padding:12px;color:var(--gray-400);">No items found</div>`;
    itemsDropdown.classList.remove('hidden');
    return;
  }
  itemsDropdown.innerHTML = results.map(item => {
    const st = getStockStatus(item.stock);
    const img = item.imageUrl
      ? `<img class="item-img" src="${item.imageUrl}" loading="lazy"/>`
      : `<div class="item-ph">📦</div>`;
    return `<div class="item-search-result" onclick="pickItem('${item.id}')">
      ${img}
      <div class="item-info">
        <div class="item-name">${item.name}</div>
        <div class="item-meta">${item.unit}${item.sizes ? ` · Sizes: ${item.sizes}` : ''}</div>
      </div>
      <div class="item-stock-badge">
        <span class="stock-indicator">
          <span class="stock-dot ${st.dotCls}"></span>
          <span style="font-size:0.82rem;">${item.stock} ${item.unit}</span>
        </span>
      </div>
    </div>`;
  }).join('');
  itemsDropdown.classList.remove('hidden');
}, 250));

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (!itemSearch.contains(e.target) && !itemsDropdown.contains(e.target)) {
    itemsDropdown.classList.add('hidden');
  }
});

// ===== PICK ITEM → QTY MODAL =====
window.pickItem = (itemId) => {
  const item = allItems.find(i => i.id === itemId);
  if (!item) return;
  if (item.stock === 0) { showToast(`"${item.name}" is out of stock`, 'error'); return; }

  pendingItem = item;
  document.getElementById('qty-modal-title').textContent = `Qty: ${item.name}`;
  const st = getStockStatus(item.stock);
  document.getElementById('qty-modal-stock').innerHTML =
    `Available: <b>${item.stock} ${item.unit}</b> &nbsp; <span class="stock-dot ${st.dotCls}" style="display:inline-block;"></span> <span style="font-size:0.85rem;">${st.label}</span>`;
  document.getElementById('qty-input').value = '';

  itemsDropdown.classList.add('hidden');
  document.getElementById('modal-qty').classList.remove('hidden');
  setTimeout(() => document.getElementById('qty-input').focus(), 100);
};

document.getElementById('btn-confirm-qty').onclick = () => {
  const qty = Number(document.getElementById('qty-input').value);
  if (!pendingItem) return;
  if (!qty || qty <= 0) { showToast('Enter a valid quantity', 'error'); return; }
  if (qty > pendingItem.stock) {
    showToast(`Only ${pendingItem.stock} ${pendingItem.unit} available. Exceeded!`, 'warning');
    return;
  }

  const existing = cart.find(c => c.itemId === pendingItem.id);
  const totalQty = (existing ? existing.qty : 0) + qty;
  if (totalQty > pendingItem.stock) {
    showToast(`Total would exceed available stock (${pendingItem.stock} ${pendingItem.unit})`, 'warning');
    return;
  }

  if (existing) {
    existing.qty = totalQty;
  } else {
    cart.push({
      itemId: pendingItem.id,
      name: pendingItem.name,
      unit: pendingItem.unit,
      qty,
      stock: pendingItem.stock,
      imageUrl: pendingItem.imageUrl || null
    });
  }

  document.getElementById('modal-qty').classList.add('hidden');
  itemSearch.value = '';
  pendingItem = null;
  renderCart();
  showToast(`Added to order`, 'success');
};

// Enter key on qty input
document.getElementById('qty-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-confirm-qty').click();
});

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.close).classList.add('hidden');
    pendingItem = null;
  });
});

// ===== CART =====
function renderCart() {
  const cartEl = document.getElementById('cart-items');
  const count = document.getElementById('cart-count');
  const placeBtn = document.getElementById('btn-place-order');

  count.textContent = `${cart.length} item${cart.length !== 1 ? 's' : ''}`;
  placeBtn.disabled = cart.length === 0;

  if (!cart.length) {
    cartEl.innerHTML = `<div class="empty-state" style="padding:24px 0;"><div class="empty-icon">🛒</div><p>No items added yet</p></div>`;
    return;
  }

  cartEl.innerHTML = cart.map((item, i) => {
    const img = item.imageUrl
      ? `<img src="${item.imageUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:7px;border:1px solid var(--gray-200);flex-shrink:0;" loading="lazy"/>`
      : `<div style="width:40px;height:40px;border-radius:7px;background:var(--gray-100);display:flex;align-items:center;justify-content:center;font-size:1.1rem;border:1px solid var(--gray-200);flex-shrink:0;">📦</div>`;
    return `<div class="cart-item-row">
      ${img}
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">Max: ${item.stock} ${item.unit}</div>
      </div>
      <div class="cart-qty-wrap">
        <input type="number" class="qty-input" min="0" max="${item.stock}" value="${item.qty}"
          onchange="updateCartQty(${i}, this.value)"/>
        <span style="font-size:0.85rem;color:var(--gray-500);">${item.unit}</span>
        <button class="btn btn-danger btn-sm btn-icon-only" onclick="removeCartItem(${i})" title="Remove">✕</button>
      </div>
    </div>`;
  }).join('');
}

window.updateCartQty = (index, val) => {
  const qty = Number(val);
  const item = cart[index];
  if (!item) return;
  if (qty <= 0) { removeCartItem(index); return; }
  if (qty > item.stock) {
    showToast(`Max available: ${item.stock} ${item.unit}`, 'warning');
    cart[index].qty = item.stock;
  } else {
    cart[index].qty = qty;
  }
  renderCart();
};

window.removeCartItem = (index) => {
  cart.splice(index, 1);
  renderCart();
};

// ===== PLACE ORDER =====
document.getElementById('btn-place-order').onclick = async () => {
  if (!selectedCustomer || !cart.length) return;

  // Re-validate against current stock
  for (const cartItem of cart) {
    const live = allItems.find(i => i.id === cartItem.itemId);
    if (!live) { showToast(`Item "${cartItem.name}" no longer exists`, 'error'); return; }
    if (cartItem.qty > live.stock) {
      showToast(`"${cartItem.name}" stock reduced. Only ${live.stock} available.`, 'warning');
      cartItem.qty = live.stock;
      renderCart();
      return;
    }
  }

  const orderId = generateOrderId();
  const deleteAfterDays = Number(document.getElementById('order-delete-interval').value) || 0;
  const items = cart.map(c => ({
    itemId: c.itemId,
    name: c.name,
    unit: c.unit,
    qty: c.qty
  }));

  try {
    showSpinner();
    await placeOrder(orderId, selectedCustomer.id, selectedCustomer.name, items, deleteAfterDays);
    cart = [];
    renderCart();
    showToast(`Order ${orderId} placed successfully!`, 'success');
    // Go back to customer step
    setTimeout(() => {
      document.getElementById('step-order').classList.add('hidden');
      document.getElementById('step-customer').classList.remove('hidden');
      selectedCustomer = null;
    }, 2000);
  } catch (e) { showToast(e.message, 'error'); } finally { hideSpinner(); }
};
