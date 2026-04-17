# Tayabi Hardware – Wholesale Order Management

## Folder Structure
```
tayabi-hardware/
├── index.html           ← Home page (choose Admin or Member)
├── pages/
│   ├── admin.html       ← Admin panel
│   ├── member.html      ← Place orders (member panel)
│   └── about.html       ← About page
├── css/
│   ├── main.css         ← Global styles
│   ├── home.css         ← Home page styles
│   ├── admin.css        ← Admin panel styles
│   └── member.css       ← Member panel styles
└── js/
    ├── firebase-init.js ← Firebase config (already filled in)
    ├── db.js            ← All Firestore operations
    ├── utils.js         ← Helpers (toast, spinner, etc.)
    ├── admin.js         ← Admin panel logic
    └── member.js        ← Member/order logic
```

## How to Deploy on GitHub Pages

1. Create a new GitHub repo (e.g. `tayabi-hardware`)
2. Upload all these files maintaining the folder structure
3. Go to **Settings → Pages**
4. Set source to **main branch, root folder**
5. Your site will be live at `https://<yourusername>.github.io/tayabi-hardware/`

## Firebase Setup

Firebase config is already set in `js/firebase-init.js`.

### Required Firestore Rules (Firebase Console → Firestore → Rules)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // Change for production!
    }
  }
}
```

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
