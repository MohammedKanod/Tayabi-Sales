import { db } from './firebase-init.js';
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, onSnapshot, query, where, orderBy,
  runTransaction, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { storage } from './firebase-init.js';
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ===== CITIES =====
const CITIES_DOC = doc(db, 'config', 'cities');

export async function getCities() {
  try {
    const snap = await getDoc(CITIES_DOC);
    return snap.exists() ? (snap.data().list || []) : [];
  } catch (e) { console.error(e); return []; }
}
export async function addCity(city) {
  const cities = await getCities();
  if (!cities.includes(city)) {
    await setDoc(CITIES_DOC, { list: [...cities, city] }, { merge: true });
  }
}

// ===== IMAGE UPLOAD =====
export async function uploadImage(base64, path) {
  try {
    const storageRef = ref(storage, path);
    await uploadString(storageRef, base64, 'data_url');
    return await getDownloadURL(storageRef);
  } catch (e) {
    console.error('Image upload failed:', e);
    return null;
  }
}

// ===== ITEMS =====
export function subscribeItems(callback) {
  const q = query(collection(db, 'items'), orderBy('name'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
export async function addItem(data) {
  return await addDoc(collection(db, 'items'), { ...data, stock: Number(data.stock) || 0 });
}
export async function addItems(dataArray) {
  const results = [];
  for (const data of dataArray) {
    if (!data.name || !data.unit) continue;
    const r = await addDoc(collection(db, 'items'), { ...data, stock: Number(data.stock) || 0 });
    results.push(r.id);
  }
  return results;
}
export async function deleteItem(id) {
  await deleteDoc(doc(db, 'items', id));
}
export async function addStock(itemId, qty) {
  await runTransaction(db, async (t) => {
    const ref = doc(db, 'items', itemId);
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error('Item not found');
    const newStock = (snap.data().stock || 0) + Number(qty);
    t.update(ref, { stock: newStock });
    t.set(doc(collection(db, 'stock_logs')), {
      itemId, changeType: 'add', quantity: Number(qty), timestamp: serverTimestamp()
    });
  });
}
export async function removeStock(itemId, qty) {
  await runTransaction(db, async (t) => {
    const ref = doc(db, 'items', itemId);
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error('Item not found');
    const current = snap.data().stock || 0;
    if (Number(qty) > current) throw new Error('Not enough stock');
    t.update(ref, { stock: current - Number(qty) });
    t.set(doc(collection(db, 'stock_logs')), {
      itemId, changeType: 'remove', quantity: Number(qty), timestamp: serverTimestamp()
    });
  });
}

// ===== CUSTOMERS =====
export function subscribeCustomers(callback) {
  const q = query(collection(db, 'customers'), orderBy('name'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
export async function addCustomer(data) {
  return await addDoc(collection(db, 'customers'), data);
}
export async function deleteCustomer(id) {
  await deleteDoc(doc(db, 'customers', id));
}

// ===== ORDERS =====
export function subscribeOrders(callback) {
  const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
export async function placeOrder(orderId, customerId, customerName, items, deleteAfterDays) {
  const deleteAt = (deleteAfterDays && deleteAfterDays > 0)
    ? Date.now() + deleteAfterDays * 24 * 60 * 60 * 1000
    : null;

  await runTransaction(db, async (t) => {
    // Duplicate order protection: check if order ID already exists
    const orderRef = doc(db, 'orders', orderId);
    const existingOrder = await t.get(orderRef);
    if (existingOrder.exists()) throw new Error(`Order ID ${orderId} already exists. Please try again.`);

    // Read all item docs first (all reads must happen before writes in a transaction)
    const itemRefs = items.map(item => doc(db, 'items', item.itemId));
    const snapshots = await Promise.all(itemRefs.map(r => t.get(r)));

    // Validate stock
    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i];
      if (!snap.exists()) throw new Error(`Item "${items[i].name}" not found`);
      const stock = snap.data().stock || 0;
      if (items[i].qty > stock) throw new Error(`Insufficient stock for "${items[i].name}" (available: ${stock})`);
    }

    // Deduct stock (all writes happen here)
    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i];
      const newStock = (snap.data().stock || 0) - items[i].qty;
      t.update(itemRefs[i], { stock: newStock });
      t.set(doc(collection(db, 'stock_logs')), {
        itemId: items[i].itemId, changeType: 'sold',
        quantity: items[i].qty, timestamp: serverTimestamp()
      });
    }

    // Create order
    t.set(orderRef, {
      customerId, customerName,
      items,
      totalItems: items.reduce((s, i) => s + i.qty, 0),
      status: 'pending',
      timestamp: serverTimestamp(),
      deleteAfterDays: deleteAfterDays || null,
      deleteAt: deleteAt
    });
  });
}

export async function deleteOrder(id) {
  await deleteDoc(doc(db, 'orders', id));
}

export async function deleteExpiredOrders(orders) {
  const now = Date.now();
  const expired = orders.filter(o => o.deleteAt && o.deleteAt <= now);
  for (const o of expired) {
    try { await deleteDoc(doc(db, 'orders', o.id)); } catch (e) { console.error('Auto-delete failed:', e); }
  }
  return expired.length;
}
export async function markOrderCompleted(orderId) {
  await updateDoc(doc(db, 'orders', orderId), { status: 'completed' });
}
export async function getOrdersByCustomer(customerId) {
  const q = query(collection(db, 'orders'), where('customerId', '==', customerId), orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ===== STOCK LOGS =====
export async function getStockLogs(itemId) {
  const q = query(collection(db, 'stock_logs'), where('itemId', '==', itemId), orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
