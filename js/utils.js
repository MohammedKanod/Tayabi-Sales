// ===== TOAST =====
export function showToast(msg, type = 'default') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3500);
}

// ===== SPINNER =====
export function showSpinner() {
  let el = document.getElementById('global-spinner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-spinner';
    el.className = 'spinner-overlay';
    el.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(el);
  }
  el.classList.remove('hidden');
}
export function hideSpinner() {
  const el = document.getElementById('global-spinner');
  if (el) el.classList.add('hidden');
}

// ===== CONFIRM DIALOG =====
export function confirmDialog(msg) {
  return window.confirm(msg);
}

// ===== ORDER ID =====
export function generateOrderId() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${hh}${mm}${ss}${dd}${mo}${yy}`;
}

// ===== FORMAT DATE =====
export function formatDate(ts) {
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ===== STOCK STATUS =====
export function getStockStatus(stock) {
  if (stock === 0) return { label: 'Out of Stock', cls: 'red', dotCls: 'red' };
  if (stock <= 10) return { label: 'Low Stock', cls: 'yellow', dotCls: 'yellow' };
  return { label: 'In Stock', cls: 'green', dotCls: 'green' };
}

// ===== EMPTY STATE =====
export function emptyState(msg = 'No items found') {
  return `<div class="empty-state"><div class="empty-icon">📦</div><p>${msg}</p></div>`;
}

// ===== IMAGE FILE TO BASE64 =====
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===== DEBOUNCE =====
export function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
