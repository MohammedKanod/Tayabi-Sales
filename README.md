# Tayabi Hardware – Wholesale Order Management

## Folder Structure
```
tayabi-hardware/
├── index.html              ← Home page (choose Admin or Customer)
├── firestore.rules         ← Production-ready Firestore Security Rules
├── pages/
│   ├── admin.html          ← Admin panel  (Firebase Auth gate)
│   ├── customer-login.html ← Customer phone-OTP login
│   ├── customer-dashboard.html
│   └── about.html
├── css/
│   ├── main.css            ← Global styles  (refreshed UI tokens)
│   ├── home.css            ← Home page styles
│   ├── login.css           ← Login screen styles
│   ├── dashboard.css       ← Customer dashboard styles
│   ├── admin.css           ← Admin panel styles
│   └── auth-gate.css       ← Admin sign-in overlay styles
└── js/
    ├── firebase-init.js    ← Firebase config + anonymous auth bootstrap
    ├── admin-auth.js       ← Reusable admin email/password auth gate
    ├── db.js               ← All Firestore operations
    ├── utils.js            ← Helpers (toast, spinner, etc.)
    ├── admin.js            ← Admin panel logic
    ├── customer-login.js   ← Customer Google sign-in
    └── customer-dashboard.js
```

## Customer Login (Google)

Customers sign in with their **Google (Gmail) account** — no SMS / OTP, no
billing required.

- The first time a customer signs in, an access request is created in the
  `customer_requests` collection. The admin sees the new request (with the
  user's name, email, and Google profile photo) in the **Requests** tab and
  can either:
  - **Link** the Google account to an existing customer record, or
  - **Create** a new customer record with the Google email auto-attached.
- Once approved, the customer is taken straight to the dashboard on every
  future login on any device — auth state persists across browser restarts
  until they explicitly sign out.

### Required Firebase setup
1. Firebase Console → `tayabi-sales` → **Authentication → Sign-in method**.
2. Enable **Google** (no billing required).
3. Enable **Email/Password** (used by the admin panel).
4. Make sure your hosting domain (e.g. `*.github.io`, `localhost`, your
   Replit dev URL) is in **Authorized domains** on the same screen.

## Admin Login

The Admin panel (`admin.html`) is protected by **Firebase
Email/Password** authentication.

- **Default email** (used internally): `admin@tayabi.local`
- **Default password**: `Tayabi@5253`

The first time someone enters the password, the gate auto-creates the admin
account in Firebase Auth using that password. Every subsequent visit signs
in with the same credentials. To rotate the password, change it from the
Firebase Console → Authentication → Users.

> Make sure **Email/Password** and **Anonymous** sign-in providers are
> enabled in Firebase Console → Authentication → Sign-in method.

## How to Deploy on GitHub Pages

1. Create a new GitHub repo (e.g. `tayabi-hardware`)
2. Upload all these files maintaining the folder structure
3. Go to **Settings → Pages**
4. Set source to **main branch, root folder**
5. Your site will be live at `https://<yourusername>.github.io/tayabi-hardware/`

## Firebase Setup

Firebase config is already set in `js/firebase-init.js`.

### Required Firestore Rules (Firebase Console → Firestore → Rules)

The full ruleset lives in **`firestore.rules`** at the project root.
Paste its contents into the Firebase Console rules editor and publish.

Summary:
- `products`, `items`, `config`         → read: any signed-in user, write: admin
- `orders`                              → create: any signed-in user, read/update/delete: admin
- `customers`, `stock_logs`             → admin only
- `customer_requests`                   → create: any signed-in user, read/delete: admin
- everything else                       → denied

Admin is identified by the Firebase Auth email `admin@tayabi.local`.

### Required Firestore Indexes
Go to Firebase Console → Firestore → Indexes and add:

1. Collection: `orders` | Fields: `timestamp DESC`
2. Collection: `orders` | Fields: `customerId ASC, timestamp DESC`
3. Collection: `stock_logs` | Fields: `itemId ASC, timestamp DESC`
4. Collection: `items` | Fields: `name ASC`
5. Collection: `customers` | Fields: `name ASC`

Firebase will also prompt you with direct links to create indexes when you first run a query that needs one — just click the link in the browser console.

### Storage Rules (Firebase Console → Storage → Rules)
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;  // Change for production!
    }
  }
}
```

## Features

### Admin Panel
- Add items (single or bulk with photos)
- Bulk photo upload → name items later
- Add/remove stock with transaction safety
- Stock history logs
- Low stock alerts (dismissible)
- Manage customers with city dropdown (add new cities)
- Sort/filter customers by city or name
- View all orders (filter by status, date, customer)
- Mark orders as completed
- Export order PDF
- Share order via WhatsApp

### Member Panel
- Search and select customer (filter by city)
- Search items with live stock indicators (green/yellow/red)
- Add items to cart with quantity popup
- Prevent ordering more than available stock
- Edit/update cart quantities
- Place order using Firestore transaction (race-condition safe)
- Real-time stock updates

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `Missing or insufficient permissions` | Update Firestore rules to allow read/write |
| `The query requires an index` | Click the link in browser console to create index |
| `CORS error on images` | Enable Storage in Firebase console |
| Site shows blank on GitHub Pages | Make sure `index.html` is in root folder |
