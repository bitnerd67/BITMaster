# CLAUDE.md — BITMaster

## Project Overview

Family condo reservation website. A static single-page app (HTML/CSS/JS) that lets family members view a calendar, reserve dates, and manage bookings. Data is persisted in the browser via localStorage.

## Repository Info

- **Repo:** bitnerd67/BITMaster
- **Platform:** Linux

## Tech Stack

- Vanilla HTML5, CSS3, JavaScript (ES5+ compatible)
- No build tools, frameworks, or package manager required
- Data persistence: browser localStorage

## Project Structure

```
index.html   — Main page (calendar, reservation form, reservation list)
styles.css   — All styling, responsive design
app.js       — Application logic (calendar rendering, form handling, storage)
CLAUDE.md    — This file
```

## Build & Run

No build step. Open `index.html` in any modern browser, or serve with any static file server:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Development Guidelines

- Keep code simple and focused; avoid over-engineering.
- Write clear commit messages that explain *why*, not just *what*.
- Validate inputs at system boundaries; trust internal code paths.
- Prefer editing existing files over creating new ones.
- No external dependencies — keep the site self-contained.

## Code Style

- Vanilla JS wrapped in an IIFE to avoid globals.
- Use `var`/`function` for broad browser compatibility.
- CSS uses custom properties (variables) defined in `:root`.
