/* eslint-env jest, node */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "deploy/hub-public-routes.mjs"), "utf8");
const routes = new Map();
let httpsRedirectMiddleware;
vm.runInNewContext(
  source.replaceAll("export function", "function") + "\nregisterHubPublicRoutes(app);",
  {
    app: {
      use(handler) {
        httpsRedirectMiddleware = handler;
      },
      get(paths, handler) {
        for (const route of Array.isArray(paths) ? paths : [paths]) routes.set(route, handler);
      },
    },
  }
);

function runHttpsRedirect({ protocol, originalUrl = "/" }) {
  const response = { set: jest.fn(), redirect: jest.fn() };
  const next = jest.fn();
  const request = {
    originalUrl,
    get(name) {
      return name.toLowerCase() === "x-forwarded-proto" ? protocol : undefined;
    },
  };
  httpsRedirectMiddleware(request, response, next);
  return { response, next };
}

describe("public HTTPS redirect", () => {
  test("preserves the path and query on forwarded HTTP requests", () => {
    const { response, next } = runHttpsRedirect({
      protocol: "http",
      originalUrl: "/pit-guru/health?fresh=1",
    });

    expect(response.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(response.redirect).toHaveBeenCalledWith(
      308,
      "https://pp-api.sokin.xyz/pit-guru/health?fresh=1"
    );
    expect(next).not.toHaveBeenCalled();
  });

  test.each(["https", undefined, ""])("allows protocol %p to continue", (protocol) => {
    const { response, next } = runHttpsRedirect({ protocol });
    expect(response.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("does not trust an absolute request target", () => {
    const { response } = runHttpsRedirect({
      protocol: "http",
      originalUrl: "https://example.invalid/",
    });
    expect(response.redirect).toHaveBeenCalledWith(308, "https://pp-api.sokin.xyz/");
  });
});

describe("public userscript migration routes", () => {
  test.each([
    ["/pit-guru/pit-guru.user.js", 578342],
    ["/pit-guru/MoDuLs-Pit-Guru.user.js", 578342],
    ["/jobcentreplus/jobcentre-plus-notifier.user.js", 594723],
    ["/jobcentreplus/api/notifications/install/jobcentre-plus-notifier.user.js", 594723],
  ])("redirects %s to its official GreasyFork bundle", (route, scriptId) => {
    const response = { set: jest.fn(), redirect: jest.fn() };
    routes.get(route)({}, response);
    expect(response.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      expect.stringMatching(
        new RegExp(`^https://update\\.greasyfork\\.org/scripts/${scriptId}/.+\\.user\\.js$`)
      )
    );
  });

  test("does not take over application or API paths", () => {
    expect(routes.size).toBe(6);
    expect(routes.has("/jobcentreplus/")).toBe(false);
    expect(routes.has("/pit-guru/")).toBe(false);
  });

  test("keeps JC+ release metadata aligned and the public bundle generic", () => {
    const bundle = fs.readFileSync(
      path.join(root, "jobcentre-plus/jobcentre-plus-notifier.user.js"),
      "utf8"
    );
    expect(bundle).toMatch(/@version\s+2\.3\.1/);
    expect(bundle).toContain('const SCRIPT_VERSION = "2.3.1";');
    expect(bundle).toMatch(
      /@downloadURL\s+https:\/\/update\.greasyfork\.org\/scripts\/594723\/.*\.user\.js/
    );
    expect(bundle).toMatch(
      /@updateURL\s+https:\/\/update\.greasyfork\.org\/scripts\/594723\/.*\.meta\.js/
    );
    expect(bundle).toContain('const EMBEDDED_NOTIFIER_TOKEN = "__JOBCENTRE_NOTIFIER_TOKEN__";');
  });
});

describe("privacy-safe Hub activity", () => {
  test("accepts only Hub origins and stores request metadata without an account identifier", async () => {
    const activityRoutes = new Map();
    const query = jest.fn().mockResolvedValue(undefined);
    const requestMeta = jest.fn(() => ({
      ipAddress: "192.0.2.1",
      userAgent: "Example Browser",
    }));
    vm.runInNewContext(
      source.replaceAll("export function", "function") +
        "\nregisterHubActivityRoute(activityApp, { query, requestMeta });",
      {
        console,
        query,
        requestMeta,
        activityApp: {
          options(pathname, handler) {
            activityRoutes.set(`OPTIONS ${pathname}`, handler);
          },
          post(pathname, handler) {
            activityRoutes.set(`POST ${pathname}`, handler);
          },
        },
      }
    );
    const response = {
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };
    const request = {
      method: "POST",
      get(name) {
        return name === "origin" ? "https://modulah.github.io" : undefined;
      },
    };

    await activityRoutes.get("POST /api/hub-activity")(request, response);

    expect(requestMeta).toHaveBeenCalledWith(request);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("insert into api_request_log"), [
      "POST",
      "/api/hub-activity",
      204,
      expect.any(Number),
      null,
      null,
      "192.0.2.1",
      "Example Browser",
    ]);
    expect(response.set).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "https://modulah.github.io"
    );
    expect(response.status).toHaveBeenCalledWith(204);
  });
});
