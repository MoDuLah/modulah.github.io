const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "hellenes.local.sqlite3");
const SESSION_COOKIE = "hellenes_session";
const CSRF_COOKIE = "hellenes_csrf";

// CSRF Token generation and validation
function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function validateCsrfToken(token) {
  if (!token || typeof token !== 'string') return false;
  return /^[a-f0-9]{64}$/.test(token);
}

// CSRF middleware
function csrfProtect(req, res, next) {
  if (req.method === 'GET') {
    // Generate new CSRF token for GET requests
    const token = generateCsrfToken();
    res.setHeader('Set-Cookie', [
      `${CSRF_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`
    ].join('; '));
    return next();
  }
  
  // For POST/PUT/DELETE, validate CSRF token
  const csrfToken = req.headers['x-csrf-token'];
  const csrfCookie = req.cookies?.[CSRF_COOKIE] || req.headers['cookie']?.split('; ').find(c => c.startsWith(CSRF_COOKIE + '='))?.split('=')[1];
  
  if (!csrfToken || !csrfCookie || !validateCsrfToken(csrfCookie)) {
    return res.status(403).json({ error: "Invalid or missing CSRF token." });
  }
  
  if (!crypto.timingSafeEqual(Buffer.from(csrfToken), Buffer.from(csrfCookie))) {
    return res.status(403).json({ error: "CSRF token mismatch." });
  }
  
  next();
}

// Parse cookies middleware
function parseCookiesMiddleware(req, res, next) {
  const cookieHeader = req.headers.cookie || "";
  req.cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
  next();
}

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);

// Middleware setup
app.use(parseCookiesMiddleware);
app.use(express.json());
app.use(express.static(__dirname));
app.use(csrfProtect); // Apply CSRF protection to all routes

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto
    .pbkdf2Sync(String(password), salt, 120000, 64, "sha512")
    .toString("hex");

  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const attempted = hashPassword(password, salt).hash;
  return crypto.timingSafeEqual(Buffer.from(attempted, "hex"), Buffer.from(expectedHash, "hex"));
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function sessionCookie(token) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=604800"
  ].join("; ");
}

function clearSessionCookie() {
  return [
    `${SESSION_COOKIE}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0"
  ].join("; ");
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await run(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [userId, tokenHash, expiresAt]
  );

  return token;
}

async function getCurrentUser(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const tokenHash = sha256(token);

  const session = await get(
    `SELECT sessions.*, users.email
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?`,
    [tokenHash]
  );

  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await run("DELETE FROM sessions WHERE id = ?", [session.id]);
    return null;
  }

  return {
    id: session.user_id,
    email: session.email,
    sessionId: session.id,
    tokenHash
  };
}

async function requireUser(req, res) {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Login required." });
    return null;
  }
  return user;
}

async function migrateUsersEmailColumn() {
  const table = await get("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'");
  if (!table || !table.sql) return;

  const columns = await all("PRAGMA table_info(users)");
  const hasEmail = columns.some(column => column.name === "email");
  const hasUsername = columns.some(column => column.name === "username");

  if (!hasEmail) {
    await run("ALTER TABLE users ADD COLUMN email TEXT");
  }

  if (hasUsername) {
    await run("UPDATE users SET email = LOWER(username || '@local.test') WHERE email IS NULL OR email = ''");
  }

  await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)");
}

async function initialiseDatabase() {
  await run("PRAGMA foreign_keys = ON");

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await migrateUsersEmailColumn();

  await run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      character_name TEXT NOT NULL,
      genos TEXT NOT NULL DEFAULT 'Hellenic',
      origin TEXT NOT NULL CHECK(origin IN ('athens', 'sparta', 'corinth', 'macedon', 'thebes')),
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      kleos INTEGER NOT NULL DEFAULT 0,
      alignment TEXT NOT NULL DEFAULT 'Honorable',
      birthday TEXT NOT NULL DEFAULT '12 Thargelion',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run("DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP");
}

app.use(express.json());
app.use(express.static(__dirname));

app.post("/api/register", async (req, res) => {
  try {
    const email = String(req.body.email || req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const characterName = String(req.body.characterName || "Alexios").trim() || "Alexios";
    const genos = String(req.body.genos || "Hellenic").trim() || "Hellenic";
    const origin = String(req.body.origin || "athens").trim().toLowerCase();

    const allowedOrigins = new Set(["athens", "sparta", "corinth", "macedon", "thebes"]);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    if (password.length < 6 || password.length > 72) {
      return res.status(400).json({ error: "Password must be 6-72 characters." });
    }

    if (!allowedOrigins.has(origin)) {
      return res.status(400).json({ error: "Invalid origin selected." });
    }

    const passwordData = hashPassword(password);

    await run("BEGIN");
    try {
      const userResult = await run(
        "INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)",
        [email, passwordData.hash, passwordData.salt]
      );

      const playerResult = await run(
        `INSERT INTO players (user_id, character_name, genos, origin, level, xp, kleos)
         VALUES (?, ?, ?, ?, 12, 5450, 3250)`,
        [userResult.lastID, characterName, genos, origin]
      );

      await run("COMMIT");

      const token = await createSession(userResult.lastID);
      res.setHeader("Set-Cookie", sessionCookie(token));

      const player = await get(
        `SELECT players.*, users.email
         FROM players
         JOIN users ON users.id = players.user_id
         WHERE players.id = ?`,
        [playerResult.lastID]
      );

      return res.status(201).json({ player });
    } catch (error) {
      await run("ROLLBACK");

      if (String(error.message).includes("UNIQUE")) {
        return res.status(409).json({ error: "That email already has a character." });
      }

      throw error;
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error while creating character." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = await get("SELECT * FROM users WHERE email = ?", [email]);

    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const player = await get(
      `SELECT players.*, users.email
       FROM players
       JOIN users ON users.id = players.user_id
       WHERE players.user_id = ?`,
      [user.id]
    );

    const token = await createSession(user.id);
    res.setHeader("Set-Cookie", sessionCookie(token));

    return res.json({ user: { id: user.id, email: user.email }, player });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error while logging in." });
  }
});

app.post("/api/logout", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE];

  if (token) {
    await run("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
  }

  res.setHeader("Set-Cookie", clearSessionCookie());
  return res.json({ ok: true });
});

app.get("/api/me", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  return res.json({ user: { id: user.id, email: user.email } });
});

app.get("/api/me/character", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const player = await get(
    `SELECT players.*, users.email
     FROM players
     JOIN users ON users.id = players.user_id
     WHERE players.user_id = ?`,
    [user.id]
  );

  if (!player) {
    return res.status(404).json({ error: "Character not found." });
  }

  return res.json({ player });
});

// Kept for old local links, but the real game flow uses /api/me/character.
app.get("/api/character/:id", async (req, res) => {
  try {
    const player = await get(
      `SELECT players.*, users.email
       FROM players
       JOIN users ON users.id = players.user_id
       WHERE players.id = ?`,
      [req.params.id]
    );

    if (!player) {
      return res.status(404).json({ error: "Character not found." });
    }

    return res.json({ player });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error while loading character." });
  }
});

initialiseDatabase()
  .then(() => {
    app.listen(PORT, () => {
      // Server startup logs - gated behind DEBUG flag
      const DEBUG = process.env.DEBUG === 'true';
      if (DEBUG) {
        console.log(`Hellenes local server: http://localhost:${PORT}`);
        console.log(`Landing page: http://localhost:${PORT}/index.html`);
        console.log(`Login/Register: http://localhost:${PORT}/auth.html`);
        console.log(`SQLite database: ${DB_PATH}`);
      }
    });
  })
  .catch(error => {
    console.error("Failed to initialise database:", error);
    process.exit(1);
  });
