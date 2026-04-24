import { auth } from './firebase-init.js';
import { findCustomerByEmail, subscribeProducts, placeCustomerOrder } from './db.js';
import { showToast, showSpinner, hideSpinner, debounce, emptyState } from './utils.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ===== Auth gate (Google) =====
let customer = null;

onAuthStateChanged(auth, async (user) => {
  if (!user || !user.email || user.email === 'admin@tayabi.local') {
    window.location.replace('customer-login.html');
    return;
  }
  try {
    const found = await findCustomerByEmail(user.email);
    if (!found) {
      // Not yet approved — bounce back to login (which will show pending screen).
      window.location.replace('customer-login.html');
      return;
    }
    customer = { ...found, email: user.email };
    document.getElementById('dash-customer').textContent = customer.name || user.displayName || user.email;
    document.getElementById('dash-hello').textContent = `Hi, ${customer.name || user.displayName || 'there'}`;
  } catch (e) {
    console.error(e);
    showToast(e.message || 'Could not load your account. Please sign in again.', 'error');
    setTimeout(() => window.location.replace('customer-login.html'), 1200);
  }
});

// ===== Logout =====
document.getElementById('logout-btn').addEventListener('click', async () => {
  try { await signOut(auth); } catch {}
  window.location.replace('customer-login.html');
});

// ===== Helpers =====
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ===== Cart state =====
const CART_KEY = 'customer_cart';
function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}
function setCart(c) { localStorage.setItem(CART_KEY, JSON.stringify(c)); refreshCartUI(); }
function cartCount() { return getCart().reduce((s, i) => s + (i.qty || 0), 0); }

function addToCart(p) {
  const cart = getCart();
  const ex = cart.find(i => i.id === p.id);
  if (ex) ex.qty = (ex.qty || 1) + 1;
  else cart.push({ id: p.id, name: p.name, image: p.image || null, qty: 1 });
  setCart(cart);
  showToast(`Added "${p.name}" to cart`, 'success');
}
function updateQty(id, delta) {
  const cart = getCart();
  const it = cart.find(i => i.id === id);
  if (!it) return;
  it.qty = (it.qty || 1) + delta;
  if (it.qty <= 0) {
    setCart(cart.filter(i => i.id !== id));
  } else {
    setCart(cart);
  }
}
function removeItem(id) {
  setCart(getCart().filter(i => i.id !== id));
}

// ===== Cart drawer =====
const overlay = document.getElementById('cart-overlay');
const drawer = document.getElementById('cart-drawer');
const cartBody = document.getElementById('cart-body');
const cartFooter = document.getElementById('cart-footer');
const cartCountEl = document.getElementById('cart-count');
const remarkEl = document.getElementById('cart-remark');

function openCart() { overlay.classList.add('open'); drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); refreshCartUI(); }
function closeCart() { overlay.classList.remove('open'); drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }

document.getElementById('open-cart').addEventListener('click', openCart);
document.getElementById('close-cart').addEventListener('click', closeCart);
overlay.addEventListener('click', closeCart);

function refreshCartUI() {
  const cart = getCart();
  cartCountEl.textContent = cartCount();

  if (!cart.length) {
    cartBody.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><p>Your cart is empty</p></div>`;
    cartFooter.style.display = 'none';
    return;
  }
  cartFooter.style.display = '';
  cartBody.innerHTML = cart.map(i => `
    <div class="cart-row" data-id="${i.id}">
      <div class="cart-thumb">
        ${i.image ? `<img src="${i.image}" alt=""/>` : `<div class="ph">📦</div>`}
      </div>
      <div class="cart-info">
        <div class="cart-name">${escapeHtml(i.name || '')}</div>
        <div class="qty-ctrl">
          <button class="qty-btn" data-act="dec" data-id="${i.id}" aria-label="Decrease">−</button>
          <span class="qty-val">${i.qty}</span>
          <button class="qty-btn" data-act="inc" data-id="${i.id}" aria-label="Increase">+</button>
        </div>
      </div>
      <button class="cart-remove" data-act="rm" data-id="${i.id}" aria-label="Remove">🗑</button>
    </div>
  `).join('');
}

cartBody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.act === 'inc') updateQty(id, +1);
  else if (btn.dataset.act === 'dec') updateQty(id, -1);
  else if (btn.dataset.act === 'rm') removeItem(id);
});

// ===== Place order =====
document.getElementById('place-order-btn').addEventListener('click', async () => {
  const cart = getCart();
  if (!cart.length) { showToast('Your cart is empty', 'warning'); return; }
  if (!customer) { showToast('Please wait — loading your account…', 'warning'); return; }

  try {
    showSpinner();
    await placeCustomerOrder({
      customerEmail: customer.email,
      customerName: customer.name || '',
      customerPhone: customer.phone || '',
      items: cart.map(i => ({ productId: i.id, name: i.name, quantity: i.qty })),
      remark: (remarkEl.value || '').trim()
    });
    localStorage.removeItem(CART_KEY);
    remarkEl.value = '';
    cartFooter.style.display = 'none';
    cartBody.innerHTML = `
      <div class="cart-success">
        <div class="icon">✅</div>
        <h3>Order placed successfully</h3>
        <p>The owner will confirm shortly.</p>
      </div>`;
    cartCountEl.textContent = '0';
    showToast('Order placed successfully', 'success');
  } catch (e) {
    console.error(e);
    showToast(e.message || 'Failed to place order. Please try again.', 'error');
  } finally {
    hideSpinner();
  }
});

// ===== Products + search =====
const grid = document.getElementById('product-grid');
const searchEl = document.getElementById('product-search');
let allProducts = [];
let searchTerm = '';

function render() {
  const term = searchTerm.trim().toLowerCase();
  const list = term
    ? allProducts.filter(p => (p.name || '').toLowerCase().includes(term))
    : allProducts;

  if (!list.length) {
    grid.innerHTML = emptyState(term ? 'No products match your search' : 'No products available yet');
    return;
  }
  grid.innerHTML = list.map(p => `
    <div class="product-card" data-id="${p.id}">
      <div class="product-img-wrap">
        ${p.image ? `<img src="${p.image}" alt="${escapeHtml(p.name || '')}" loading="lazy"/>` : `<div class="ph">📦</div>`}
      </div>
      <div class="product-body">
        <div class="product-name">${escapeHtml(p.name || 'Unnamed product')}</div>
        <button class="btn btn-primary product-add" data-add="${p.id}">+ Add to cart</button>
      </div>
    </div>
  `).join('');
}

grid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  const p = allProducts.find(x => x.id === btn.dataset.add);
  if (p) addToCart(p);
});

searchEl.addEventListener('input', debounce((e) => {
  searchTerm = e.target.value || '';
  render();
}, 150));

grid.innerHTML = emptyState('Loading products…');
subscribeProducts((items) => { allProducts = items; render(); });

refreshCartUI();
