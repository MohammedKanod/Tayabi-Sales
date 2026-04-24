# Tayabi Hardware – Wholesale Order Management

## Overview
Static HTML/CSS/JS frontend for a wholesale order management system. Uses Firebase (Firestore + Storage) directly from the browser via ES modules from the Firebase CDN. There is no build step and no backend code in this repo — Firebase config is embedded in `js/firebase-init.js`.

## Project Structure
- `index.html` — Home page (choose Admin or Customer)
- `pages/` — `admin.html`, `customer-login.html`, `customer-dashboard.html`, `about.html`
- `css/` — `main.css`, `home.css`, `login.css`, `dashboard.css`, `admin.css`, `auth-gate.css`
- `js/` — `firebase-init.js`, `db.js`, `utils.js`, `admin.js`, `admin-auth.js`, `customer-login.js`, `customer-dashboard.js`
- `firestore.rules` — Production Firestore Security Rules
- `favicon.svg`
- `server.js` — Tiny Node static file server used to host the site in Replit (port 5000, host `0.0.0.0`).

## Replit Setup
- Runtime module: `nodejs-20` (no npm packages required).
- Workflow: `Start application` runs `node server.js` and serves the project root on port 5000.
- The static server sets no-cache headers in dev so changes appear on hard-refresh.
- Replit's preview proxies the iframe; the static server has no host-header check, so all hosts are allowed by default.

## Deployment
- Deployed as an `autoscale` static-friendly Node service running `node server.js`.
- All routing is filesystem-based (no SPA rewrites needed).

## Notes
- Firebase project config is checked into `js/firebase-init.js` (matches the original GitHub Pages setup).
- Firestore rules / indexes need to be configured in the Firebase console as documented in `README.md`.
