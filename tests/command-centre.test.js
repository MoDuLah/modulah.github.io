/* eslint-env jest, node */

const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(repositoryRoot, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(repositoryRoot, "assets/css/command-centre.css"), "utf8");
const catalogue = fs.readFileSync(path.join(repositoryRoot, "assets/js/catalogue.js"), "utf8");
const moduleFaqs = fs.readFileSync(path.join(repositoryRoot, "assets/js/module-faqs.js"), "utf8");
const app = fs.readFileSync(path.join(repositoryRoot, "assets/js/command-centre.js"), "utf8");
const favicon = fs.readFileSync(path.join(repositoryRoot, "favicon.png"));
const updaterConfig = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "config/script-update-sources.json"), "utf8")
);
const workflow = fs.readFileSync(path.join(repositoryRoot, ".github/workflows/deploy.yml"), "utf8");

describe("command centre catalogue", () => {
  test("shows current distributed script versions", () => {
    expect(code).toContain("BUILD: v2.5.0-CYBER");
    expect(catalogue).toContain('"version": "v3.1.2"');
    expect(catalogue).toContain('"label": "Install v3.1.2"');
    expect(catalogue).toContain('"version": "v2.4.8"');
    expect(catalogue).toContain('"label": "Install v2.4.8"');
    expect(catalogue).toContain('"version": "v0.3.4"');
    expect(catalogue).toContain('"label": "Install v0.3.4"');
    expect(catalogue).toContain('"version": "v2.3.0"');
    expect(catalogue).toContain('"label": "Install Notifier v2.3.0"');
  });

  test("uses a script release timeline instead of repository commits", () => {
    expect(code).toContain("Script Update Timeline");
    expect(catalogue).toContain("export const scriptReleases = [");
    expect(app).toContain("renderScriptUpdateTimeline();");
    expect(app).toContain("automaticScriptReleases");
    expect(app).toContain("payload.timeline.map(sanitiseTimelineEvent)");
    expect(app).toContain("release.scriptId || release.title.toLocaleLowerCase()");
    expect(app).toContain("Latest release check:");
    expect(app).toContain("requestUrl.searchParams.set('fresh', Date.now().toString())");
    expect(app).toContain('setTimeout(() => controller.abort(), 8000)');
    expect(code).not.toContain('src="assets/js/repository-activity.js"');
    expect(code).not.toContain("Full Git Log");
    expect(workflow).not.toContain("generate-activity-timeline");
  });

  test("uses the Dev-style motion treatment on every module card", () => {
    expect(app).toContain("module-card-reveal flex-1");
    expect(app).toContain("module-card-reveal mt-4");
    expect(styles).toContain(".module-card:hover::before");
    expect(styles).toContain(".module-card:hover .module-card-reveal");
    expect(styles).toContain(".module-card.loading .module-card-progress");
    expect(styles).toContain("@keyframes module-load-progress");
    expect(styles).toContain("#module-grid[aria-busy=\"true\"]::after");
    expect(styles).toContain("backdrop-filter: blur(2.5px)");
    expect(styles).toMatch(/\.module-grid\s*\{[\s\S]*?padding-top:\s*0\.75rem;/);
    expect(styles).toMatch(/\.module-card\.active\s*\{[\s\S]*?z-index:\s*20;/);
    expect(styles).toMatch(/\.module-card\.loading-peer\s*\{[\s\S]*?opacity:\s*0\.3;/);
    expect(styles).toContain("::view-transition-group(module-detail)");
    expect(styles).toContain("@keyframes module-detail-crossfade-in");
    expect(styles).toContain(".script-details.module-detail-fallback");
    expect(styles).toContain(".module-card-transition-clone");
    expect(styles).toContain("@keyframes module-card-expand");
    expect(styles).toContain("html.module-transition-reverse::view-transition-old(module-detail)");
    expect(styles).toContain("html.module-transition-reverse::view-transition-new(module-detail)");
    expect(styles).toContain("@keyframes module-detail-contract");
    expect(app).toContain("progress.className = 'module-card-progress'");
    expect(app).toContain("selectedCard.classList.add('active', 'loading')");
    expect(app).toContain("card.classList.remove('fade-slide-up')");
    expect(app).toContain("document.startViewTransition");
    expect(app).toContain("selectedCard.style.viewTransitionName = 'module-detail'");
    expect(app).toContain("selectedCard.cloneNode(true)");
    expect(app).toContain("transitionCard.classList.add('expanding')");
    expect(app).toContain("--module-target-width");
    expect(app).toContain("details.dataset.transitionMode = 'native-expand'");
    expect(app).toContain("details.dataset.transitionMode = 'fallback-expand'");
    expect(app).toContain("const targetRect = details.getBoundingClientRect()");
    expect(app).toContain("await mountModuleDetail(grid, details, selectedCard, data)");
    expect(app).toContain("await unmountModuleDetail(grid, details, selectedCard)");
    expect(app).toContain("details.dataset.transitionMode = 'native-contract'");
    expect(app).toContain("details.dataset.transitionMode = 'fallback-contract'");
    expect(app).toContain("document.documentElement.classList.add('module-transition-reverse')");
    expect(app).toContain("releaseModuleSelection(grid)");
    expect(app).not.toContain("currentFilter = 'ALL';\n                activeModuleId = null;\n                updateRegistrySummary();\n                grid.replaceChildren();");
    expect(styles).toMatch(/\.module-card\.active\s*\{[\s\S]*?opacity:\s*1;/);
    expect(app).not.toContain("script.badge === 'dev' ? 'group-hover:opacity-100");
  });

  test("uses the supplied PNG favicon", () => {
    expect(code).toContain('href="favicon.png?v=');
    expect(code).toContain('type="image/png"');
    expect(favicon.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(favicon.readUInt32BE(16)).toBe(836);
    expect(favicon.readUInt32BE(20)).toBe(836);
    expect(fs.existsSync(path.join(repositoryRoot, "favicon.svg"))).toBe(false);
  });

  test("uses access tags and existing script logos on cards", () => {
    expect(catalogue).not.toContain('"badgeText": "LIVE"');
    expect(catalogue.match(/"badgeText": "FREE"/g)).toHaveLength(7);
    expect(catalogue.match(/"badgeText": "WEB TOOL"/g)).toHaveLength(3);
    expect(app).toContain("logo.className = 'module-card-logo'");
    expect(app).toContain("/^assets\\/images\\/");

    const logos = [...catalogue.matchAll(/"logo": "([^"]+)"/g)].map((match) => match[1]);
    expect(logos).toHaveLength(14);
    logos.forEach((relativePath) => {
      expect(fs.existsSync(path.join(repositoryRoot, relativePath))).toBe(true);
    });
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
      "bootleggingHelper",
      "jobCentrePlus",
      "pythagorasDashboard",
      "raceStats",
      "lap-recorder",
    ];

    ids.forEach((id) => {
      const key = `"${id}": [`;
      expect(moduleFaqs).toContain(key);
    });
    expect(code).toContain('id="detail-faq"');
    expect(app).toContain("renderModuleFaq(data);");
  });

  test("renders screenshot galleries with a keyboard-accessible viewer", () => {
    expect(code).toContain('id="detail-screenshots"');
    expect(code).toContain('id="screenshot-dialog"');
    expect(app).toContain("renderModuleScreenshots(data);");
    expect(app).toContain("event.key === 'ArrowLeft'");
    expect(app).toContain("event.key === 'ArrowRight'");
    expect(app).toContain("assets/data/module-screenshots.json");
    expect(app).toContain("loadScreenshotManifest()");
    const screenshotManifest = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, "assets/data/module-screenshots.json"), "utf8")
    );
    expect(screenshotManifest.modules.pythagoras).toHaveLength(19);

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

  test("keeps the HTML shell small and moves maintainable pieces into assets", () => {
    expect(Buffer.byteLength(code)).toBeLessThan(40000);
    expect(code).toContain('href="assets/css/command-centre.css?v=');
    expect(code).toContain('src="assets/js/shader-background.js"');
    expect(code).toContain('src="assets/js/command-centre.js?v=');
    expect(app).toContain("from './catalogue.js?v=");
    expect(catalogue).toContain('from "./module-faqs.js?v=');
  });

  test("does not expose a source-code button in the header", () => {
    expect(code).not.toContain("https://github.com/MoDuLah/modulah.github.io");
    expect(code).not.toContain("> Source\n");
  });

  test("removes generic Open Project buttons from module details", () => {
    expect(app).toContain("function getVisibleModuleActions(data)");
    expect(app).toContain("action.label.trim().toLowerCase() !== 'open project'");
    expect(app).toContain("getVisibleModuleActions(data).forEach");
    expect(app).toContain("const availableActions = getVisibleModuleActions(data).length");
  });

  test("moves standalone FAQ-page content into Module FAQ", () => {
    const faqFiles = [
      "pythagoras-project-cis/faq.html",
      "pit-guru/faq.html",
      "custom-race-filter/faq.html",
      "race-tracker/faq.html",
      "eggsterminator/faq.html",
      "race-theme-changer/faq.html",
      "restore-og-names/faq.html",
      "stock-x/faq.html",
      "smuggler/faq.html",
      "lap-recorder/faq.html",
    ];
    let importedQuestions = 0;
    faqFiles.forEach((relativePath) => {
      const faqPage = fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
      const questions = [...faqPage.matchAll(/<summary>([\s\S]*?)<\/summary>/g)]
        .map((match) => match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
      expect(questions.length).toBeGreaterThan(0);
      questions.forEach((question) => expect(moduleFaqs).toContain(JSON.stringify(question)));
      importedQuestions += questions.length;
    });
    expect(importedQuestions).toBe(92);
    expect(catalogue).not.toContain("faq.html");
    expect(catalogue).not.toContain('"label": "FAQ"');
    expect(catalogue).not.toContain('"label": "Archive FAQ"');
  });

  test("tracks all nine GreasyFork scripts plus VM-only sources", () => {
    const greasyForkIds = updaterConfig.scripts
      .filter((entry) => entry.source.type === "greasyfork")
      .map((entry) => entry.source.scriptId)
      .sort((left, right) => left - right);
    expect(greasyForkIds).toEqual([
      562954, 563153, 563548, 575111, 575131, 578342, 579366, 580933, 589397,
    ]);
    expect(updaterConfig.scripts.filter((entry) => entry.source.type === "userscript")).toHaveLength(2);
  });

  test("refreshes generated manifests during deploy and scheduled sync", () => {
    expect(workflow).toContain("scripts/build-site.py --output _site");
    expect(workflow).toContain("scripts/generate-screenshot-manifest.py --write");
    const syncWorkflow = fs.readFileSync(
      path.join(repositoryRoot, ".github/workflows/version-sync.yml"),
      "utf8"
    );
    expect(workflow).toContain('cron: "17 0,12 * * *"');
    expect(syncWorkflow).toContain("uses: ./.github/workflows/deploy.yml");
  });

  test("renders sanitised GreasyFork card metadata", () => {
    [
      "Author",
      "Daily installs",
      "Total installs",
      "GreasyFork version",
      "Created",
      "GreasyFork updated",
      "Size",
      "License",
      "Applies to",
    ].forEach((label) => expect(app).toContain(label));
    expect(app).toContain("sanitiseMarketplace");
    expect(app).toContain("https://spdx.org/licenses/");
  });
});
