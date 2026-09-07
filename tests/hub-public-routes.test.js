/* eslint-env jest, node */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "deploy/hub-public-routes.mjs"), "utf8");
const routes = new Map();
vm.runInNewContext(
  source.replace("export function", "function") + "\nregisterHubPublicRoutes(app);",
  {
    app: {
      get(paths, handler) {
        for (const route of Array.isArray(paths) ? paths : [paths]) routes.set(route, handler);
      },
    },
  }
);

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
    expect(routes.size).toBe(5);
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
