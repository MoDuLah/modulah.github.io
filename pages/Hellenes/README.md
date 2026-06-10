# Hellenes Local Scaffold v0.4

This version adds a bilingual UI system.

## Languages

The game now supports:

- English
- Greek

The language toggle appears at the top-right of the page.

The selected language is saved in:

```js
localStorage.hellenesLanguage
```

## Pages

- `index.html` — spectacular landing page / game introduction
- `auth.html` — login and registration on the same page
- `character.html` — session-backed character dashboard

## Flow

```text
index.html
  ↓
auth.html?mode=register or auth.html?mode=login
  ↓
server creates/validates account
  ↓
server sets an HttpOnly session cookie
  ↓
character.html loads the logged-in character from /api/me/character
```

## Local testing

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

Hard refresh after replacing files:

```text
Ctrl + F5
```

## Translation structure

Translations live in `app.js`:

```js
const I18N = {
  en: {},
  el: {}
};
```

Origin-specific text lives in:

```js
const ORIGINS = {};
```

Attributes are rendered from:

```js
const ATTRIBUTES = [];
```

## SQLite database

Created automatically at:

```text
data/hellenes.local.sqlite3
```

Tables:

- `users`
- `players`
- `sessions`

`Origin / Καταγωγή` is selected during registration and stored in:

```sql
players.origin
```

Allowed values:

- `athens`
- `sparta`
- `corinth`
- `macedon`
- `thebes`

## Note

Do not open the HTML directly with `file://` for authentication testing. Use:

```text
http://localhost:3000
```


## v0.4.1 Landing page update

The landing page now scrolls vertically again. This fixes cropped origin cards on normal browser windows.

Origin cards on the landing page are now interactive:

- Click an origin card.
- The selected origin updates.
- A detailed origin description panel appears below.
- The panel includes mood, description, bonuses, and register/login actions.

Auth and character pages still keep the game-HUD style without page scrollbars.


## v0.4.2 Origin-themed scrollbars

The generic browser scrollbar has been replaced with themed scrollbars.

The scrollbar now follows the currently selected origin through the existing CSS variables:

- Athens: blue/gold
- Sparta: red/gold
- Corinth: purple/gold
- Macedon: dark bronze/gold
- Thebes: green/gold

Supported styling:

- Chromium / Edge / Brave / Chrome via `::-webkit-scrollbar`
- Firefox via `scrollbar-color`
