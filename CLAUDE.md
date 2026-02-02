# CLAUDE.md — BITMaster

## Project Overview

Family condo reservation website. A static front-end app (HTML/CSS/JS) backed by Firebase Firestore for shared data. Family members can view a calendar, reserve dates, and manage bookings. An admin page lets the condo manager approve or deny reservation requests, with email and SMS notifications throughout the workflow.

## Repository Info

- **Repo:** bitnerd67/BITMaster
- **Platform:** Linux

## Tech Stack

- Vanilla HTML5, CSS3, JavaScript (ES5+ compatible)
- Firebase Firestore (shared database, real-time sync)
- EmailJS (client-side email notifications)
- Textbelt (client-side SMS notifications)
- No build tools, frameworks, or package manager required

## Project Structure

```
index.html         — Main page (calendar, reservation form, reservation list)
admin.html         — Admin page (approve/deny/revoke reservations)
styles.css         — All styling, responsive design
app.js             — Main app logic (calendar, form, Firestore reads/writes)
admin.js           — Admin page logic (login, approve/deny, notifications)
firebase-config.js — Shared Firebase initialization (edit with your config)
CLAUDE.md          — This file
```

## Build & Run

No build step. Serve with any static file server:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

### Required setup before first use:

1. **Firebase** — Create a project at console.firebase.google.com, enable Firestore, and paste your config into `firebase-config.js`
2. **EmailJS** — Create a free account, connect Gmail, create templates, and set IDs in `app.js` / `index.html`
3. **Textbelt** — Set `ADMIN_PHONE` in `app.js`; optionally buy a production key
4. **Admin password** — Change `ADMIN_PASSWORD` in `admin.js`

## Development Guidelines

- Keep code simple and focused; avoid over-engineering.
- Write clear commit messages that explain *why*, not just *what*.
- Validate inputs at system boundaries; trust internal code paths.
- Prefer editing existing files over creating new ones.
- CDN dependencies only (Firebase, EmailJS) — no npm/build tools.

## Code Style

- Vanilla JS wrapped in an IIFE to avoid globals.
- Use `var`/`function` for broad browser compatibility.
- CSS uses custom properties (variables) defined in `:root`.
