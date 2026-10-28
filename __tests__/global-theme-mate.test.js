/* eslint-env jest, node */

const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.join(__dirname, "..");
const source = fs.readFileSync(
  path.join(repositoryRoot, "global-theme/modul-hub-global-theme.user.js"),
  "utf8"
);

describe("M.A.T.E. Control Room contract", () => {
  test("publishes the v1.1.0 event contract and registers M.A.T.E.", () => {
    expect(source).toContain("const THEME_CONTRACT_VERSION = '1.1.0'");
    expect(source).toContain("ready: 'modulhub:theme-ready'");
    expect(source).toContain("updated: 'modulhub:theme-updated'");
    expect(source).toContain("id: 'mate'");
    expect(source).toContain("'#mate-alpha-host'");
    expect(source).toContain("'[data-mate-root]'");
    expect(source).toContain("defaultAccent: '#d7ff3f'");
  });

  test("the bridge forwards per-script controls to matched hosts", () => {
    expect(source).toContain("--mh-script-accent: ${accent}");
    expect(source).toContain("accentOverride");
    expect(source).toContain("settings.enabled");
    expect(source).toContain("settings.font");
    expect(source).toContain("settings.compatibility");
  });
});
