// Register before API CORS and application proxies: this feed is public.
export function registerHubPublicRoutes(app) {
  app.get("/assets/data/script-updates.json", (_req, res) => {
    res.set("Access-Control-Allow-Origin", "https://modulah.github.io");
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.sendFile("/var/www/moduls-hub/live-data/script-updates.json");
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
