const publicOrigin = "https://pp-api.sokin.xyz";
const hubOrigins = new Set([publicOrigin, "https://modulah.github.io"]);

function firstForwardedProtocol(req) {
  return String(req.get("x-forwarded-proto") || "")
    .split(",", 1)[0]
    .trim()
    .toLowerCase();
}

// Register before API CORS and application proxies: the redirect and feed are public.
export function registerHubPublicRoutes(app) {
  app.use((req, res, next) => {
    if (firstForwardedProtocol(req) !== "http") {
      next();
      return;
    }

    const requestTarget = req.originalUrl.startsWith("/") ? req.originalUrl : "/";
    res.set("Cache-Control", "no-store");
    res.redirect(308, `${publicOrigin}${requestTarget}`);
  });

  app.get("/assets/data/script-updates.json", (_req, res) => {
    res.set("Access-Control-Allow-Origin", "https://modulah.github.io");
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.sendFile("/var/www/moduls-hub/live-data/script-updates.json");
  });

  app.get("/assets/data/usage-stats.json", (req, res) => {
    const origin = String(req.get("origin") || "");
    if (hubOrigins.has(origin)) res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Cache-Control", "public, max-age=300");
    res.set("X-Content-Type-Options", "nosniff");
    res.sendFile("/var/www/moduls-hub/live-data/usage-stats.json");
  });

  app.get(["/pit-guru/pit-guru.user.js", "/pit-guru/MoDuLs-Pit-Guru.user.js"], (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.redirect(
      302,
      "https://update.greasyfork.org/scripts/578342/MoDuL%27s%20Pit%20Guru.user.js"
    );
  });

  app.get(
    [
      "/jobcentreplus/jobcentre-plus-notifier.user.js",
      "/jobcentreplus/api/notifications/install/jobcentre-plus-notifier.user.js",
    ],
    (_req, res) => {
      res.set("Cache-Control", "no-store");
      res.redirect(
        302,
        "https://update.greasyfork.org/scripts/594723/JC%2B%20Live%20Notifier.user.js"
      );
    }
  );
}

function setActivityCors(req, res) {
  const origin = String(req.get("origin") || "");
  if (!hubOrigins.has(origin)) return false;
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Vary", "Origin");
  return true;
}

// This route is registered after express.json() but before the API-wide CORS
// middleware. It records the same short request metadata as existing API logs;
// it never accepts a Torn ID, API key, cookie or browser-generated identifier.
export function registerHubActivityRoute(app, { query, requestMeta }) {
  app.options("/api/hub-activity", (req, res) => {
    if (!setActivityCors(req, res)) {
      res.status(403).end();
      return;
    }
    res.set("Access-Control-Max-Age", "86400");
    res.status(204).end();
  });

  app.post("/api/hub-activity", async (req, res) => {
    if (!setActivityCors(req, res)) {
      res.status(403).end();
      return;
    }

    const started = Date.now();
    const meta = requestMeta(req);
    try {
      await query(
        `insert into api_request_log (
          method, path, status, duration_ms, user_id, company_id, ip_address, user_agent
        ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          req.method,
          "/api/hub-activity",
          204,
          Date.now() - started,
          null,
          null,
          meta.ipAddress,
          meta.userAgent,
        ]
      );
    } catch (error) {
      console.warn("[hub] activity log failed", error.message);
    }
    res.set("Cache-Control", "no-store");
    res.status(204).end();
  });
}
