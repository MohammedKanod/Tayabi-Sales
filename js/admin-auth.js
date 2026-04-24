// Reusable admin authentication gate using Firebase Email/Password.
// First successful sign-in creates the admin account; subsequent visits
// reuse it. The same password the user typed is used as the Firebase
// password — no separate setup required.

import { auth } from './firebase-init.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const ADMIN_EMAIL = 'admin@tayabi.local';
const GATE_HTML = `
  <div class="auth-gate-card">
    <div class="auth-gate-icon">🔒</div>
    <h2 class="auth-gate-title">Admin Access</h2>
    <p class="auth-gate-sub">Enter the admin password to continue</p>
    <input type="password" id="ag-pw" placeholder="Password" autocomplete="current-password" class="auth-gate-input"/>
    <div id="ag-err" class="auth-gate-err"></div>
    <button id="ag-btn" class="auth-gate-btn">Enter Admin Panel</button>
    <a href="../index.html" class="auth-gate-back">&larr; Back to Home</a>
  </div>
`;

export function mountAdminGate({ onReady } = {}) {
  // Build overlay
  const overlay = document.createElement('div');
  overlay.className = 'auth-gate-overlay';
  overlay.innerHTML = GATE_HTML;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('#ag-pw');
  const errEl = overlay.querySelector('#ag-err');
  const btn = overlay.querySelector('#ag-btn');

  function showError(msg) {
    errEl.textContent = msg;
    errEl.classList.add('show');
  }
  function clearError() { errEl.classList.remove('show'); errEl.textContent = ''; }

  async function attempt() {
    const pw = (input.value || '').trim();
    if (!pw) { showError('Please enter the password.'); return; }
    btn.disabled = true; btn.textContent = 'Signing in…';
    clearError();
    try {
      await setPersistence(auth, browserLocalPersistence);
      try {
        await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pw);
      } catch (e) {
        if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
          // First-time setup: create the admin account with this password
          try {
            await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, pw);
          } catch (e2) {
            if (e2.code === 'auth/email-already-in-use') {
              showError('Incorrect password. Please try again.');
            } else if (e2.code === 'auth/weak-password') {
              showError('Password must be at least 6 characters.');
            } else {
              showError(e2.message || 'Sign-in failed.');
            }
            input.value = ''; input.focus();
            btn.disabled = false; btn.textContent = 'Enter Admin Panel';
            return;
          }
        } else if (e.code === 'auth/wrong-password') {
          showError('Incorrect password. Please try again.');
          input.value = ''; input.focus();
          btn.disabled = false; btn.textContent = 'Enter Admin Panel';
          return;
        } else {
          showError(e.message || 'Sign-in failed.');
          btn.disabled = false; btn.textContent = 'Enter Admin Panel';
          return;
        }
      }
    } catch (e) {
      showError(e.message || 'Sign-in failed.');
      btn.disabled = false; btn.textContent = 'Enter Admin Panel';
    }
  }

  btn.addEventListener('click', attempt);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
  setTimeout(() => input.focus(), 100);

  // Listen for auth state — once admin is signed in, drop the gate.
  onAuthStateChanged(auth, user => {
    if (user && user.email === ADMIN_EMAIL) {
      overlay.classList.add('auth-gate-leaving');
      setTimeout(() => overlay.remove(), 220);
      if (typeof onReady === 'function') onReady(user);
    }
  });
}
