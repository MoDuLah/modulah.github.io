export const scripts = [
  {
    "id": "pythagoras",
    "tier": "supporter",
    "title": "Pythagoras Project - CIS",
    "desc":
      "A company intelligence workspace for Torn directors with exact action-log-backed training counts, staff history, analytics and shared reporting.",
    "version": "v3.1.2",
    "versionPrefix": "VER",
    "category": "Company intelligence",
    "projectType": "Supporter userscript",
    "releaseState": "Current supporter build",
    "updated": "6 September 2026",
    "badge": "supporter",
    "badgeText": "SUPPORTER",
    "logo": "assets/images/pythagoras-project-cis/pythagoras-project-logo.png",
    "iconPath":
      '<polygon points="12 2 22 20 2 20"></polygon><circle cx="12" cy="14" r="2"></circle>',
    "features": [
      "Training ledger and FIFO planning tools",
      "Staff, director and company timeline views",
      "Cloud workspace history, analytics, exports and themed reports",
    ],
    "actions": [
      {
        "label": "Open Project",
        "href": "pythagoras-project-cis/",
        "icon": "open_in_new",
        "primary": false,
      },
      {
        "label": "Install v3.1.2",
        "href": "https://greasyfork.org/en/scripts/580933-pythagoras-project-cis",
        "icon": "download",
        "primary": true,
      },
      {
        "label": "Dashboard",
        "href": "https://pp-api.sokin.xyz/dashboard",
        "icon": "dashboard",
        "primary": false,
      },
    ],
  },
  {
    "id": "pitGuru",
    "tier": "supporter",
    "title": "MoDuL's Pit Guru",
    "desc":
      "A supporter racing-analysis tool with live gaps, sectors, speed, predictions, replay links and persistent hosted race history.",
    "version": "v2.3.7",
    "versionPrefix": "VER",
    "category": "Racing analysis",
    "projectType": "Supporter userscript",
    "releaseState": "Current supporter build",
    "updated": "31 August 2026",
    "badge": "supporter",
    "badgeText": "SUPPORTER",
    "logo": "assets/images/pit-guru/pit-guru-logo.png",
    "iconPath":
      '<rect height="18" rx="2" width="18" x="3" y="3"></rect><path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke-dasharray="2 2"></path>',
    "features": [
      "Live race analysis focused on gaps, sectors and speed",
      "Configurable focused drawing for large 50–100 driver races",
      "Public race player and persistent PostgreSQL-backed history",
    ],
    "actions": [
      {
        "label": "Open Project",
        "href": "pit-guru/",
        "icon": "open_in_new",
        "primary": false,
      },
      {
        "label": "Install v2.3.7",
        "href": "https://greasyfork.org/en/scripts/578342-modul-s-pit-guru",
        "icon": "download",
        "primary": true,
      },
      {
        "label": "Race Player",
        "href": "https://pp-api.sokin.xyz/pit-guru/",
        "icon": "sports_motorsports",
        "primary": false,
      },
    ],
  },
  {
    "id": "customRaceFilter",
    "tier": "supporter",
    "title": "Custom Race Filter",
    "desc":
      "A supporter racing helper that keeps Torn custom-race lists focused around selected criteria, licensing and compact join controls.",
    "version": "v2.5.2",
    "versionPrefix": "VER",
    "category": "Race-list filtering",
    "projectType": "Supporter userscript",
    "releaseState": "Current supporter build",
    "updated": "14 July 2026",
    "badge": "supporter",
    "badgeText": "SUPPORTER",
    "logo": "assets/images/custom-race-filter/custom-race-filter-logo.png",
    "iconPath":
      '<path d="M4 6h16M4 12h16m-7 6h7" stroke-linecap="square"></path><circle cx="7" cy="18" r="2"></circle>',
    "features": [
      "Custom race-list filtering for faster browsing",
      "OG-name-aware car filtering and supporter extras",
      "Inline licence flow with safer Torn-owned user ID detection",
    ],
    "actions": [
      {
        "label": "Open Project",
        "href": "custom-race-filter/",
        "icon": "open_in_new",
        "primary": true,
      },
      {
        "label": "GreasyFork Page",
        "href": "https://greasyfork.org/en/scripts/562954-modul-s-custom-race-filter",
        "icon": "download",
        "primary": false,
      },
    ],
  },
  {
    "id": "tornfolio",
    "tier": "supporter",
    "title": "Tornfolio",
    "desc":
      "A Torn property, lease and ROI manager for owners and renters, evolving from the former Landlord Tenant Ledger.",
    "version": "PRIVATE PREVIEW",
    "versionPrefix": "STATUS",
    "category": "Property management",
    "projectType": "Supporter property tool",
    "releaseState": "Under development",
    "updated": "28 July 2026",
    "badge": "dev",
    "badgeText": "DEV",
    "logo": "assets/images/landlord-tenant-ledger/landlord-tenant-ledger-logo.png",
    "iconPath": '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>',
    "features": [
      "Readable lease records for owners, renters, dates, rent and days left",
      "Owned-home, current-home and partner-contract fetch flow",
      "Rent and sale suggestions for owned properties",
    ],
    "actions": [
      {
        "label": "Open Project",
        "href": "tornfolio/",
        "icon": "open_in_new",
        "primary": true,
      },
    ],
    "disabledActions": ["Public install not released"],
    "note":
      "Tornfolio is currently a private preview. The project page is public, but there is no public install link yet.",
  },
  {
    "id": "modulHubControl",
    "tier": "free",
    "title": "MoDuL Hub Control Room",
    "desc":
      "The shared theme source of truth for MoDuL Torn scripts, including palettes, typography, spacing, radius and the canonical mh-* contract.",
    "version": "v0.2.10",
    "versionPrefix": "VER",
    "category": "Shared theme system",
    "projectType": "Global theme userscript",
    "releaseState": "Live release",
    "updated": "28 July 2026",
    "badge": "free",
    "badgeText": "FREE",
    "logo": "assets/images/moduls-hub-logo.png",
    "iconPath": '<path d="M3 3h18v18H3z"></path>',
    "features": [
      "One theme editor for shared --mh-* variables",
      "Canonical identifiers and compatibility bridge for older scripts",
      "Draggable launcher with saved positioning and touch support",
    ],
    "actions": [
      {
        "label": "Open Project",
        "href": "global-theme/",
        "icon": "open_in_new",
        "primary": false,
      },
      {
        "label": "Install v0.2.10",
        "href": "global-theme/modul-hub-global-theme.user.js",
        "icon": "download",
        "primary": true,
      },
    ],
  },
  {
    "id": "cracked",
    "tier": "free",
    "title": "cRaCked",
    "desc":
      "A Torn cracking assistant with calibrated probability estimates, a fallback model for unknown words and self-measuring local telemetry.",
    "version": "v2.4.8",
    "versionPrefix": "VER",
    "category": "Cracking assistance",
    "projectType": "Free userscript",
    "releaseState": "Live release",
    "updated": "3 September 2026",
    "badge": "free",
    "badgeText": "FREE",
    "iconPath": '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>',
    "features": [
      "Calibrated position and character probability estimates",
      "Character-model fallback when a word is not in the dictionary",
      "Community word pool with optional uploads and local telemetry",
    ],
    "actions": [
      {
        "label": "Install v2.4.8",
        "href": "https://greasyfork.org/en/scripts/589397-cracked",
        "icon": "download",
        "primary": true,
      },
    ],
  },
  {
    "id": "raceTracker",
    "tier": "archive",
    "title": "Race Tracker",
    "desc":
      "The retired Google Sheets racing toolkit. Documentation, screenshots and the original workbook remain available as an archive.",
    "version": "ARCHIVED",
    "versionPrefix": "STATUS",
    "category": "Racing analytics",
    "projectType": "Google Sheets toolkit",
    "releaseState": "Archived; no longer maintained",
    "updated": "6 September 2026",
    "badge": "archive",
    "badgeText": "ARCHIVE",
    "logo": "assets/images/race-tracker/race-tracker-logo.png",
    "iconPath": '<path d="M4 19l16-14m0 0v8m0-8h-8"></path>',
    "features": [
      "Race history imports and organised results views",
      "Car, track and upgrade analytics",
      "Dashboard-style summaries for racing performance",
    ],
    "actions": [
      {
        "label": "Open Archive",
        "href": "race-tracker/",
        "icon": "inventory_2",
        "primary": true,
      },
      {
        "label": "Archived Workbook",
        "href":
          "https://docs.google.com/spreadsheets/d/1ANiFcBuMgpXYXGhycc4HaFHfUZsLjoKsLyRB5llFIz8/copy",
        "icon": "table_view",
        "primary": false,
      },
    ],
    "note":
      "Race Tracker is retired. Its workbook and project history are preserved; explore Race//Stats for the current racing web tool.",
  },
  {
    "id": "eggsTerminator",
    "tier": "free",
    "title": "EggsTerminator",
    "desc":
      "A state-aware Easter event helper combining page navigation, egg visibility tools and separate found/collected tracking.",
    "version": "v2.5.12",
    "versionPrefix": "VER",
    "category": "Seasonal event utility",
    "projectType": "Free userscript",
    "releaseState": "Live release",
    "updated": "28 April 2026",
    "badge": "free",
    "badgeText": "FREE",
    "logo": "assets/images/eggsterminator/eggsterminator-icon.png",
    "iconPath": '<circle cx="12" cy="12" r="8"></circle><path d="M12 4v16M4 12h16"></path>',
    "features": [
      "State-aware page traversal",
      "Found and collected counter tracking",
      "Navigator and finder tools in one interface",
    ],
    "actions": [
      {
        "label": "Open Project",
        "href": "eggsterminator/",
        "icon": "open_in_new",
        "primary": false,
      },
      {
        "label": "Install v2.5.12",
        "href": "https://greasyfork.org/en/scripts/575131-eggsterminator",
        "icon": "download",
        "primary": true,
      },
    ],
  },
  {
    "id": "raceThemeChanger",
    "tier": "free",
    "title": "Race Theme Changer",
    "desc":
      "A PDA-safe userscript that synchronises Torn racing visuals, banners and race details with the selected race-class theme.",
    "version": "v1.2.6",
    "versionPrefix": "VER",
    "category": "Racing interface theme",
    "projectType": "Free userscript",
    "releaseState": "Live release",
    "updated": "20 April 2026",
    "badge": "free",
    "badgeText": "FREE",
    "logo": "assets/images/race-theme-changer/race-theme-changer-logo.png",
    "iconPath": '<path d="M12 2v20m-7-7l7 7 7-7"></path>',
    "features": [
      "Theme-aware visuals for Classes A–E",
      "Permanent race details bar beneath the track",
      "Touch-friendly controls for TornPDA and mobile",
    ],
    "actions": [
      {
        "label": "Open Project",
        "href": "race-theme-changer/",
        "icon": "open_in_new",
        "primary": false,
      },
      {
        "label": "Install v1.2.6",
        "href": "https://greasyfork.org/en/scripts/563548-modul-s-racing-theme-changer",
        "icon": "download",
        "primary": true,
      },
    ],
  },
  {
    "id": "restoreOgNames",
    "tier": "free",
    "title": "Restore OG Names",
    "desc":
      "A lightweight Torn userscript that restores original car naming across racing, markets, bazaars, logs and docks views.",
    "version": "v1.3.2",
    "versionPrefix": "VER",
    "category": "Naming compatibility",
    "projectType": "Free userscript",
    "releaseState": "Live release",
    "updated": "6 June 2026",
    "badge": "free",
    "badgeText": "FREE",
    "logo": "assets/images/restore-og-names/restore-og-names-logo.png",
    "iconPath": '<path d="M3 10h18M3 14h18"></path>',
    "features": [
      "Restores original car names across supported Torn pages",
      "Compatible with Custom Race Filter and TornPDA",
      "Includes item-market, bazaar, log and docks coverage",
    ],
    "actions": [
      {
        "label": "Open Project",
        "href": "restore-og-names/",
        "icon": "open_in_new",
        "primary": false,
      },
      {
        "label": "Install v1.3.2",
        "href": "https://greasyfork.org/en/scripts/563153-modul-s-restore-og-car-names",
        "icon": "download",
        "primary": true,
      },
    ],
  },
  {
    "id": "stockx",
    "tier": "free",
    "title": "Stock-X",
    "desc":
      "A stock-focused Torn helper in active development, with vault, ROI and trade-assistant documentation already published.",
    "version": "v1.0.0",
    "versionPrefix": "VER",
    "category": "Stock workflow",
    "projectType": "Free userscript",
    "releaseState": "In development; documentation live",
    "updated": "No public release date published",
    "badge": "dev",
    "badgeText": "DEV",
    "logo": "assets/images/stock-x/stock-x-logo.png",
    "iconPath": '<path d="M3 3v18h18M18 9l-5 5-4-4-5 5"></path>',
    "features": [
      "Stock workflow and vault helpers",
      "ROI-focused guidance and benefit-lock protection",
      "Trade-assistant workflow for faster market checks",
    ],
    "actions": [
      {
        "label": "Open Project",
        "href": "stock-x/",
        "icon": "open_in_new",
        "primary": true,
      },
    ],
    "disabledActions": ["Public download pending review"],
    "note":
      "Stock-X documentation is live, but the current hub intentionally does not expose a public install route while the workflow remains in development.",
  },
  {
    "id": "smuggler",
    "tier": "free",
    "title": "Smuggler",
    "desc":
      "A Torn and TornPDA travel helper for repeat abroad runs, destination planning, item workflows and flight timing.",
    "version": "v3.0.6",
    "versionPrefix": "VER",
    "category": "Travel utility",
    "projectType": "Free userscript",
    "releaseState": "Live release",
    "updated": "1 July 2026",
    "badge": "free",
    "badgeText": "FREE",
    "logo": "assets/images/smuggler/smuggler-logo.png",
    "iconPath": '<path d="M22 12h-4l-3-9L9 3l-3 9H2"></path>',
    "features": [
      "Travel pill with countdown, ETA and progress",
      "Primary and fallback item workflow",
      "Desktop hotkey and TornPDA plane-button support",
    ],
    "actions": [
      {
        "label": "Open Project",
        "href": "smuggler/",
        "icon": "open_in_new",
        "primary": false,
      },
      {
        "label": "Install v3.0.6",
        "href": "https://greasyfork.org/en/scripts/575111-modul-s-smuggler",
        "icon": "download",
        "primary": true,
      },
    ],
  },
  {
    "id": "bootleggingHelper",
    "tier": "free",
    "title": "Torn Bootlegging — Copy DVDs Stock+Queue Helper",
    "desc":
      "A focused Torn bootlegging helper for copying DVD stock and queue totals and finding the genre with the lowest combined workload.",
    "version": "v0.3.4",
    "versionPrefix": "VER",
    "category": "Bootlegging utility",
    "projectType": "Free userscript",
    "releaseState": "Live release",
    "updated": "22 May 2026",
    "badge": "free",
    "badgeText": "FREE",
    "iconPath":
      '<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="12" cy="12" r="3"></circle><path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01"></path>',
    "features": [
      "Copies current DVD stock and queue figures",
      "Combines stock and queue totals for quick comparison",
      "Selects the genre with the lowest Stock+Queue value",
    ],
    "actions": [
      {
        "label": "Install v0.3.4",
        "href":
          "https://greasyfork.org/en/scripts/579366-torn-bootlegging-copy-dvds-stock-queue-helper",
        "icon": "download",
        "primary": true,
      },
    ],
  },
  {
    "id": "jobCentrePlus",
    "tier": "web tools",
    "title": "JobCentre+",
    "desc":
      "A privacy-first Torn employment marketplace with verified profiles, vacancies, applications, dashboards and the JC+ Live Notifier companion userscript.",
    "version": "v2.3.1",
    "versionPrefix": "NOTIFIER",
    "category": "Employment marketplace",
    "projectType": "Hosted application + userscript",
    "releaseState": "Live service and notifier",
    "updated": "7 September 2026",
    "badge": "web-tool",
    "badgeText": "WEB TOOL",
    "logo": "assets/images/job-centre-plus/og.png",
    "iconPath":
      '<path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>',
    "features": [
      "Torn-verified identity, employment and working stats",
      "Searchable vacancies, applications and private director dashboards",
      "Draggable live-notifier panel with direct job links and transport fallback",
    ],
    "actions": [
      {
        "label": "Open JobCentre+",
        "href": "https://pp-api.sokin.xyz/jobcentreplus/",
        "icon": "work",
        "primary": true,
      },
      {
        "label": "Install Notifier v2.3.1",
        "href": "https://greasyfork.org/en/scripts/594723-jc-live-notifier",
        "icon": "notifications_active",
        "primary": false,
      },
    ],
  },
  {
    "id": "pythagorasDashboard",
    "tier": "web tools",
    "title": "Pythagoras Project - Dashboard",
    "desc":
      "The hosted companion dashboard for authenticated Pythagoras CIS workspaces, company data, analytics and reports.",
    "version": "LIVE SERVICE",
    "versionPrefix": "STATUS",
    "category": "Company intelligence dashboard",
    "projectType": "Hosted web application",
    "releaseState": "Live companion service",
    "updated": "Current service",
    "badge": "web-tool",
    "badgeText": "WEB TOOL",
    "logo": "assets/images/pythagoras-project-cis/pythagoras-project-logo.png",
    "iconPath":
      '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line>',
    "features": [
      "Authenticated CIS workspace access",
      "Company analytics and shared reporting",
      "Companion service for the Pythagoras userscript",
    ],
    "actions": [
      {
        "label": "Open Dashboard",
        "href": "https://pp-api.sokin.xyz/dashboard",
        "icon": "dashboard",
        "primary": true,
      },
      {
        "label": "Open CIS Project",
        "href": "pythagoras-project-cis/",
        "icon": "open_in_new",
        "primary": false,
      },
    ],
  },
  {
    "id": "raceStats",
    "tier": "web tools",
    "title": "Race//Stats",
    "desc":
      "A Torn racing dashboard for your race history, garage, personal track records and performance analytics.",
    "version": "LIVE SERVICE",
    "versionPrefix": "STATUS",
    "category": "Racing performance analytics",
    "projectType": "Hosted web application",
    "releaseState": "Live web tool",
    "updated": "Current service",
    "badge": "web-tool",
    "badgeText": "WEB TOOL",
    "iconPath": '<path d="M3 3v18h18M7 16v-5M12 16V7M17 16v-8"></path>',
    "features": [
      "Official and custom race history",
      "Owned-car garage and personal track records",
      "Performance, lap and crash analysis with a direct Torn API connection",
    ],
    "actions": [
      {
        "label": "Open Race//Stats",
        "href": "https://pp-api.sokin.xyz/racestats/",
        "icon": "analytics",
        "primary": true,
      },
    ],
    "note": "Connect a Minimal Torn API key with racing access to load your own data.",
  },
  {
    "id": "lap-recorder",
    "tier": "archive",
    "title": "Lap Recorder",
    "desc":
      "The archived lap-capture project that helped shape the next generation of MoDuL racing tools.",
    "version": "ARCHIVED",
    "versionPrefix": "STATUS",
    "category": "Archived racing project",
    "projectType": "Past project",
    "releaseState": "Archived",
    "updated": "13 May 2026",
    "badge": "archive",
    "badgeText": "ARCHIVE",
    "logo": "assets/images/lap-recorder/lap-recorder-logo.png",
    "iconPath":
      '<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M8 3v18M16 3v18M3 8h18M3 16h18"></path>',
    "features": [
      "Project termination notice and archive page",
      "Screenshots and development history preserved",
      "Key lessons carried forward into MoDuL's Pit Guru",
    ],
    "actions": [
      {
        "label": "Open Archive",
        "href": "lap-recorder/",
        "icon": "inventory_2",
        "primary": true,
      },
    ],
    "note":
      "Lap Recorder is no longer maintained or promoted. Its archive remains online for screenshots, history and the development lessons carried into Pit Guru.",
  },
];

export const scriptReleases = [
  {
    scriptId: "pitGuru",
    title: "MoDuL's Pit Guru",
    version: "v2.3.6",
    date: "2026-08-30",
    type: "RELEASE",
    summary:
      "Added cache-first Driver Intel lookups, paced API requests and clearer licence progress.",
    href: "https://modulah.github.io/pit-guru/",
  },
  {
    scriptId: "jobCentrePlus",
    title: "JobCentre+ Live Notifier",
    version: "v2.1.3",
    date: "2026-08-17",
    type: "HOTFIX",
    summary:
      "Restored reliable server transport, direct #job links, stable panel scrolling and quieter diagnostics.",
    href: "https://pp-api.sokin.xyz/jobcentreplus/",
  },
  {
    scriptId: "cracked",
    title: "cRaCked",
    version: "v2.1.4",
    date: "2026-08-13",
    type: "RELEASE",
    summary:
      "Added calibrated probability estimates, an unknown-word fallback model and self-measuring telemetry.",
    href: "https://greasyfork.org/en/scripts/589397-cracked",
  },
  {
    scriptId: "pitGuru",
    title: "MoDuL's Pit Guru",
    version: "v2.3.4",
    date: "2026-07-30",
    type: "RELEASE",
    summary:
      "Repaired prediction and history car images and linked Records race IDs directly to replay.",
    href: "pit-guru/",
  },
  {
    scriptId: "modulHubControl",
    title: "MoDuL Hub Control Room",
    version: "v0.2.10",
    date: "2026-07-28",
    type: "RELEASE",
    summary:
      "Added a draggable saved launcher and dedicated selected-control colours to the shared theme contract.",
    href: "global-theme/",
  },
  {
    scriptId: "pythagoras",
    title: "Pythagoras Project - CIS",
    version: "v3.0.4b",
    date: "2026-07-26",
    type: "RELEASE",
    summary:
      "Reconciled Company News with exact training-action records for correct grouped and raw totals.",
    href: "pythagoras-project-cis/",
  },
  {
    scriptId: "customRaceFilter",
    title: "Custom Race Filter",
    version: "v2.5.2",
    date: "2026-07-14",
    type: "RELEASE",
    summary:
      "Made compact join controls own their navigation so refreshed Torn handlers cannot swallow clicks.",
    href: "custom-race-filter/",
  },
  {
    scriptId: "smuggler",
    title: "Smuggler",
    version: "v3.0.6",
    date: "2026-07-08",
    type: "RELEASE",
    summary:
      "Kept active flight sessions stable across page changes and preserved route progress without repeated fetches.",
    href: "smuggler/",
  },
  {
    scriptId: "restoreOgNames",
    title: "Restore OG Names",
    version: "v1.3.2",
    date: "2026-06-06",
    type: "RELEASE",
    summary:
      "Published the current cross-page naming build for racing, markets, bazaars, logs and docks.",
    href: "restore-og-names/",
  },
  {
    scriptId: "eggsTerminator",
    title: "EggsTerminator",
    version: "v2.5.12",
    date: "2026-04-28",
    type: "RELEASE",
    summary:
      "Stabilised state-aware navigation, manual log sync and separate found and collected counters.",
    href: "eggsterminator/",
  },
  {
    scriptId: "raceThemeChanger",
    title: "Race Theme Changer",
    version: "v1.2.6",
    date: "2026-04-20",
    type: "RELEASE",
    summary:
      "Added lock and sizing controls while retaining the permanent PDA-safe racing information bar.",
    href: "race-theme-changer/",
  },
];

export { moduleFaqs } from "./module-faqs.js?v=20260907.1";

function screenshotSeries(slug, count) {
  return Array.from({ length: count }, (_, index) => ({
    src: `assets/images/${slug}/screenshot-${index + 1}.png`,
    alt: `${slug.replaceAll("-", " ")} screenshot ${index + 1}`,
  }));
}

export const moduleScreenshots = {
  pythagoras: screenshotSeries("pythagoras-project-cis", 19),
  pitGuru: screenshotSeries("pit-guru", 12),
  customRaceFilter: screenshotSeries("custom-race-filter", 4),
  tornfolio: [
    {
      src: "assets/images/landlord-tenant-ledger/landlord-tenant-ledger-logo.png",
      alt: "Tornfolio project preview",
    },
  ],
  modulHubControl: [],
  cracked: [],
  raceTracker: screenshotSeries("race-tracker", 11),
  eggsTerminator: screenshotSeries("eggsterminator", 5),
  raceThemeChanger: screenshotSeries("race-theme-changer", 10),
  restoreOgNames: screenshotSeries("restore-og-names", 4),
  stockx: [],
  smuggler: screenshotSeries("smuggler", 7),
  bootleggingHelper: [],
  jobCentrePlus: [
    { src: "assets/images/job-centre-plus/og.png", alt: "JobCentre+ marketplace preview" },
    { src: "assets/images/job-centre-plus/og_promo16_9.png", alt: "JobCentre+ widescreen preview" },
  ],
  pythagorasDashboard: screenshotSeries("pythagoras-project-cis", 19),
  "lap-recorder": screenshotSeries("lap-recorder", 2),
};
