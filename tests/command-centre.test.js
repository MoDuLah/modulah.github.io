/* eslint-env jest, node */

const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(repositoryRoot, "code.html"), "utf8");
const workflow = fs.readFileSync(path.join(repositoryRoot, ".github/workflows/deploy.yml"), "utf8");

describe("command centre catalogue", () => {
  test("shows current distributed script versions", () => {
    expect(code).toContain("BUILD: v2.5.0-CYBER");
    expect(code).toContain('"version": "v2.1.4"');
    expect(code).toContain('"label": "Install v2.1.4"');
    expect(code).toContain('"version": "v1.3.2"');
    expect(code).toContain('"label": "Install v1.3.2"');
    expect(code).toContain('"version": "v2.1.3"');
    expect(code).toContain('"label": "Install Notifier v2.1.3"');
  });

  test("uses a script release timeline instead of repository commits", () => {
    expect(code).toContain("Script Update Timeline");
    expect(code).toContain("const scriptReleases = [");
    expect(code).toContain("renderScriptUpdateTimeline();");
    expect(code).not.toContain('src="assets/js/repository-activity.js"');
    expect(code).not.toContain("Full Git Log");
    expect(workflow).not.toContain("generate-activity-timeline");
  });

  test("every catalogue module has inline FAQ data", () => {
    const ids = [
      "pythagoras",
      "pitGuru",
      "customRaceFilter",
      "tornfolio",
      "modulHubControl",
      "cracked",
      "raceTracker",
      "eggsTerminator",
      "raceThemeChanger",
      "restoreOgNames",
      "stockx",
      "smuggler",
      "jobCentrePlus",
      "pythagorasDashboard",
      "lap-recorder",
    ];

    ids.forEach((id) => {
      const key = id.includes("-") ? `'${id}': [` : `${id}: [`;
      expect(code).toContain(key);
    });
    expect(code).toContain('id="detail-faq"');
    expect(code).toContain("renderModuleFaq(data);");
  });

  test("renders screenshot galleries with a keyboard-accessible viewer", () => {
    expect(code).toContain('id="detail-screenshots"');
    expect(code).toContain('id="screenshot-dialog"');
    expect(code).toContain("renderModuleScreenshots(data);");
    expect(code).toContain("event.key === 'ArrowLeft'");
    expect(code).toContain("event.key === 'ArrowRight'");

    const representativeImages = [
      "assets/images/pythagoras-project-cis/screenshot-7.png",
      "assets/images/pit-guru/screenshot-12.png",
      "assets/images/race-tracker/screenshot-11.png",
      "assets/images/job-centre-plus/og.png",
    ];
    representativeImages.forEach((relativePath) => {
      expect(fs.existsSync(path.join(repositoryRoot, relativePath))).toBe(true);
    });
  });
});
