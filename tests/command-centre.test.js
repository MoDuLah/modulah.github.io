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
const siteBuilder = fs.readFileSync(path.join(repositoryRoot, "scripts/build-site.py"), "utf8");
const customRaceFilter = fs.readFileSync(
  path.join(repositoryRoot, "custom-race-filter/custom-race-filter.user.js"),
  "utf8"
);
const pythagorasScript = fs.readFileSync(
  path.join(repositoryRoot, "pythagoras-project-cis/pythagoras-project-cis.user.js"),
  "utf8"
);

describe("command centre catalogue", () => {
  test("archived cards stay last in every sort mode without mutating the catalogue", () => {
    const sorter = app.match(/function sortModules\(modules\) \{[\s\S]*?\n\}/)[0];
    const timestamp = app.match(/function getUpdatedTimestamp\(script\) \{[\s\S]*?\n\}/)[0];
    const modules = [
      {title:'Archive A', tier:'archive', updated:'2030-01-01'},
      {title:'Active Z', tier:'supporter', updated:'2026-09-09'},
      {title:'Archive Z', tier:'archive', updated:'2020-01-01'},
      {title:'Active A', tier:'free', updated:'2026-09-08'},
    ];
    const original = JSON.stringify(modules);
    for (const mode of ['az','za','newest','oldest']) {
      const sorted = new Function('currentSort', 'scripts', `${timestamp}\n${sorter}\nreturn sortModules(scripts);`)(mode, modules);
      expect(sorted.map(row => row.tier === 'archive')).toEqual([false,false,true,true]);
      expect(sorted[0].title).toBe(['za','newest'].includes(mode) ? 'Active Z' : 'Active A');
      expect(sorted[2].title).toBe(['za','oldest'].includes(mode) ? 'Archive Z' : 'Archive A');
    }
    expect(JSON.stringify(modules)).toBe(original);
  });
  test("same-day releases sort newest numeric version first regardless of insertion order", () => {
    const source = app.match(/function compareScriptReleases\(left, right\) \{[\s\S]*?\n\}/)[0];
    const compare = new Function(`${source}; return compareScriptReleases;`)();
    const releases = ['v3.1.3', 'v3.1.4', 'v3.1.5', 'v3.1.10'].map(version => ({scriptId:'pythagoras', date:'2026-09-09', version}));
    releases.push({scriptId:'pythagoras', date:'2026-09-08', version:'v9.0.0'});
    expect(releases.sort(compare).map(row => row.version)).toEqual(['v3.1.10','v3.1.5','v3.1.4','v3.1.3','v9.0.0']);
    expect(app).toContain('.sort(compareScriptReleases)');
  });
  test("shows current distributed script versions", () => {
    expect(code).toContain("BUILD: v2.5.0-CYBER");
    expect(catalogue).toContain('"version": "v3.1.2"');
    expect(catalogue).toContain('"label": "Install v3.1.2"');
    expect(catalogue).toContain('"version": "v2.4.8"');
    expect(catalogue).toContain('"label": "Install v2.4.8"');
    expect(catalogue).toContain('"version": "v0.3.4"');
    expect(catalogue).toContain('"label": "Install v0.3.4"');
    expect(catalogue).toContain('"version": "v2.3.1"');
    expect(catalogue).toContain('"label": "Install Notifier v2.3.1"');
  });

  test("uses a script release timeline instead of repository commits", () => {
    expect(code).toContain("Script Update Timeline");
    expect(code).toContain('class="glass-panel rounded-lg flex h-[34rem] min-h-0 flex-col"');
    expect(code).toContain('id="script-timeline-scroll"');
    expect(code).toContain("overflow-y-auto custom-scrollbar");
    expect(catalogue).toContain("export const scriptReleases = [");
    expect(app).toContain("renderScriptUpdateTimeline();");
    expect(app).toContain("automaticScriptReleases");
    expect(app).toContain("payload.timeline.map(sanitiseTimelineEvent)");
    expect(app).toContain("release.scriptId || release.title.toLocaleLowerCase()");
    expect(app).toContain("Latest release check:");
    expect(app).toContain("requestUrl.searchParams.set('fresh', Date.now().toString())");
    expect(app).toContain("setTimeout(() => controller.abort(), 8000)");
    expect(app).toContain("{0,199}\\.user\\.js$");
    expect(app).not.toContain("{0,199}$/.test(value)");
    expect(app).toContain("legacyPageHrefs.has(value.href)");
    expect(app).toContain("value === 'https://modulah.github.io/'");
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
    expect(styles).toContain('#module-grid[aria-busy="true"]::after');
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
    expect(app).not.toContain(
      "currentFilter = 'ALL';\n                activeModuleId = null;\n                updateRegistrySummary();\n                grid.replaceChildren();"
    );
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
    expect(catalogue.match(/"badgeText": "FREE"/g)).toHaveLength(11);
    expect(catalogue.match(/"badgeText": "WEB TOOL"/g)).toHaveLength(4);
    expect(app).toContain("logo.className = 'module-card-logo'");
    expect(app).toContain("/^assets\\/images\\/");

    const logos = [...catalogue.matchAll(/"logo": "([^"]+)"/g)].map((match) => match[1]);
    expect(logos).toHaveLength(15);
    logos.forEach((relativePath) => {
      expect(fs.existsSync(path.join(repositoryRoot, relativePath))).toBe(true);
    });
  });

  test("every catalogue module has inline FAQ data", () => {
    const ids = [
      "pythagoras",
      "pitGuru",
      "pitGuruWeb",
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
      "tanothSuffixRecorder",
      "tanothDungeonRecorder",
      "tanothMailboxCleaner",
      "tanothAtlas",
      "tanothCompanion",
      "lap-recorder",
    ];

    ids.forEach((id) => {
      const key = `"${id}": [`;
      expect(moduleFaqs).toContain(key);
    });
    expect(code).toContain('id="detail-faq"');
    expect(app).toContain("renderModuleFaq(data);");
  });

  test("separates the free Pit Guru userscript from its supporter web tool", () => {
    const scriptStart = catalogue.indexOf('"id": "pitGuru"');
    const webStart = catalogue.indexOf('"id": "pitGuruWeb"');
    const nextModule = catalogue.indexOf('"id": "customRaceFilter"', webStart);
    const scriptEntry = catalogue.slice(scriptStart, webStart);
    const webEntry = catalogue.slice(webStart, nextModule);

    expect(scriptEntry).toContain('"tier": "free"');
    expect(scriptEntry).toContain('"projectType": "Free userscript"');
    expect(scriptEntry).toContain('"installActionPrefix": "Install Free"');
    expect(scriptEntry).toContain('"label": "Install Free v2.4.0"');
    expect(scriptEntry).not.toContain("pp-api.sokin.xyz/pit-guru/");
    expect(webEntry).toContain('"tier": "supporter"');
    expect(webEntry).toContain('"filters": ["web tools"]');
    expect(webEntry).toContain('"projectType": "Supporter web tool"');
    expect(webEntry).toContain('"label": "Open Pit Guru Web Tool"');
    expect(webEntry).toContain("https://pp-api.sokin.xyz/pit-guru/");
    expect(app).toContain("function moduleMatchesFilter(script, filter)");
    expect(app).toContain("moduleMatchesFilter(script, currentFilter)");
    expect(app).toContain("update.actionLabel.replace(/^Install\\b/, script.installActionPrefix)");
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

  test("does not expose links to removed standalone project pages", () => {
    expect(app).toContain("function getVisibleModuleActions(data)");
    expect(app).toContain("action.label.trim().toLowerCase() !== 'open project'");
    expect(app).toContain("getVisibleModuleActions(data).forEach");
    expect(app).toContain("const availableActions = getVisibleModuleActions(data).length");
    expect(catalogue).not.toContain('"label": "Open Project"');
    expect(catalogue).not.toContain('"label": "Open Archive"');
    expect(catalogue).not.toContain('"label": "Open CIS Project"');
  });

  test("keeps the Command Centre as the only public HTML page", () => {
    const removedLegacyPages = [
      "index.old",
      "custom-race-filter/index.html",
      "custom-race-filter/faq.html",
      "custom-race-filter/update-notice.html",
      "eggsterminator/index.html",
      "eggsterminator/faq.html",
      "global-theme/index.html",
      "lap-recorder/index.html",
      "lap-recorder/faq.html",
      "pit-guru/index.html",
      "pit-guru/faq.html",
      "pythagoras-project-cis/index.html",
      "pythagoras-project-cis/faq.html",
      "race-theme-changer/index.html",
      "race-theme-changer/faq.html",
      "race-tracker/index.html",
      "race-tracker/faq.html",
      "restore-og-names/index.html",
      "restore-og-names/faq.html",
      "smuggler/index.html",
      "smuggler/faq.html",
      "stock-x/index.html",
      "stock-x/faq.html",
      "tornfolio/index.html",
    ];
    removedLegacyPages.forEach((relativePath) =>
      expect(fs.existsSync(path.join(repositoryRoot, relativePath))).toBe(false)
    );

    expect(siteBuilder).toContain('PUBLIC_FILES = {"index.html", "favicon.png"}');
    expect(siteBuilder).not.toMatch(/EXTENSIONS\s*=\s*\{[^\n]*"\.html"/);
    expect(code).toContain('<link rel="canonical" href="https://modulah.github.io/">');
    expect(code).toContain('<meta property="og:url" content="https://modulah.github.io/">');
    expect(customRaceFilter).not.toContain("update-notice.html");
    expect(customRaceFilter).toContain("sanitizeNoticeHtml(fallbackUpdateNoticeHtml())");
    expect(pythagorasScript).toContain("faqUrl: 'https://modulah.github.io/'");
    expect(pythagorasScript).not.toContain("pythagoras-project-cis/faq.html");
    expect(catalogue).not.toContain("faq.html");
    expect(moduleFaqs).toContain('"What is Pythagoras CIS?"');
    expect(moduleFaqs).toContain('"What was Lap Recorder?"');
  });

  test("lists the complete public Tanoth portfolio without publishing Companion", () => {
    [
      "https://greasyfork.org/en/scripts/577764-tanoth-suffix-range-recorder",
      "https://greasyfork.org/en/scripts/595857-tanoth-dungeon-recorder",
      "https://greasyfork.org/en/scripts/596052-tanoth-mailbox-cleaner",
      "https://pp-api.sokin.xyz/tanoth/companion/dungeon/analysis",
      "https://pp-api.sokin.xyz/tanoth/suffix/atlas",
    ].forEach((href) => expect(catalogue).toContain(href));

    const companionStart = catalogue.indexOf('"id": "tanothCompanion"');
    const companionEnd = catalogue.indexOf('"id": "lap-recorder"', companionStart);
    const companionEntry = catalogue.slice(companionStart, companionEnd);
    expect(companionEntry).toContain('"releaseState": "Under development"');
    expect(companionEntry).toContain('"disabledActions": ["Public download not released"]');
    expect(companionEntry).not.toContain("greasyfork.org");
  });

  test("tracks all thirteen GreasyFork scripts plus the shared theme source", () => {
    const greasyForkIds = updaterConfig.scripts
      .filter((entry) => entry.source.type === "greasyfork")
      .map((entry) => entry.source.scriptId)
      .sort((left, right) => left - right);
    expect(greasyForkIds).toEqual([
      562954, 563153, 563548, 575111, 575131, 577764, 578342, 579366, 580933, 589397, 594723,
      595857, 596052,
    ]);
    expect(
      updaterConfig.scripts.filter((entry) => entry.source.type === "userscript")
    ).toHaveLength(1);
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
