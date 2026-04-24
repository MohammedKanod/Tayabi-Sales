import { auth } from './firebase-init.js';
import { findCustomerByEmail, createOrUpdateCustomerRequest } from './db.js';
import { showSpinner, hideSpinner } from './utils.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const signinStep = document.getElementById('signin-step');
const pendingStep = document.getElementById('pending-step');
const googleBtn = document.getElementById('google-signin-btn');
const pendingSignOutBtn = document.getElementById('pending-signout');
const pendingNameEl = document.getElementById('pending-name');
const pendingEmailEl = document.getElementById('pending-email');
const msgEl = document.getElementById('login-msg');

function showMsg(text, type = 'info') {
  msgEl.textContent = text;
  msgEl.className = `login-msg ${type}`;
  msgEl.style.display = 'block';
}
function clearMsg() { msgEl.style.display = 'none'; msgEl.textContent = ''; }

function showPendingState(user) {
  signinStep.classList.add('hidden');
  pendingStep.classList.remove('hidden');
  pendingNameEl.textContent = user.displayName || 'there';
  pendingEmailEl.textContent = user.email || '';
}

function showSigninState() {
  pendingStep.classList.add('hidden');
  signinStep.classList.remove('hidden');
}

// If a user is already signed in (because they previously signed in on
// this device and never signed out), figure out where to send them.
onAuthStateChanged(auth, async (user) => {
  if (!user || !user.email) { showSigninState(); return; }
  // Don't auto-redirect the admin; admin uses the email/password flow.
  if (user.email === 'admin@tayabi.local') { showSigninState(); return; }

  try {
    const customer = await findCustomerByEmail(user.email);
    if (customer) {
      window.location.replace('customer-dashboard.html');
    } else {
      showPendingState(user);
    }
  } catch (e) {
    console.error(e);
    showMsg(e.message || 'Could not check your access. Please try again.', 'error');
  }
});

googleBtn.addEventListener('click', async () => {
  clearMsg();
  try {
    showSpinner();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    if (!user.email) {
      showMsg('Your Google account did not return an email. Please try a different account.', 'error');
      await signOut(auth);
      return;
    }
    const customer = await findCustomerByEmail(user.email);
    if (customer) {
      window.location.replace('customer-dashboard.html');
    } else {
      // First-time login: create / refresh an access request for the admin.
      await createOrUpdateCustomerRequest({
        email: user.email,
        name: user.displayName || '',
        photoURL: user.photoURL || ''
      });
      showPendingState(user);
    }
  } catch (e) {
    console.error(e);
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
      // user just closed the popup; nothing to do.
      return;
    }
    showMsg(e.message || 'Sign-in failed. Please try again.', 'error');
  } finally {
    hideSpinner();
  }
});

pendingSignOutBtn.addEventListener('click', async () => {
  try { await signOut(auth); } catch {}
  showSigninState();
});
