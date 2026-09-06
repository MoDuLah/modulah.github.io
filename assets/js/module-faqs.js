export const moduleFaqs = {
  "pythagoras": [
    {
      "question": "What is Pythagoras CIS?",
      "answer":
        "Pythagoras CIS is a Tampermonkey userscript designed for Torn company management. It provides a cloud-backed workspace for managing the training ledger, FIFO train planner, staff and director history, daily report analytics, licensing, backups, and themed reports.",
    },
    {
      "question": "How do I install it?",
      "answer":
        "Install a userscript manager such as Tampermonkey, or use Torn PDA’s userscript support. Then install the latest release from GreasyFork. After installation, open Torn and use the Pythagoras CIS panel to configure your API key, company ID, theme, and support options.",
    },
    {
      "question": "What API key access does it need?",
      "answer":
        "A Minimal API key is sufficient for basic functionality. A Full Access API key is required for advanced features. The script only uses your Torn API key when you manually trigger a sync. It does not perform background polling or automated request chains. The only local profile fields are API key, user ID, username, and company ID. Company records, analytics, staff history, planner data, settings, stock history, and licence status live in the Pythagoras backend.",
    },
    {
      "question": "Where is my data stored?",
      "answer":
        "Company data is stored in a PostgreSQL-backed cloud workspace keyed by company ID. Every company-owned row includes its company ID, and server-side access checks decide which Torn user can open that workspace. Free users can continue syncing and saving data, but Free visibility is limited to the last 7 days. Older saved data remains in the workspace and becomes visible if the account upgrades. The script does not store business data, licence state, analytics, planner rows, staff history, stock history, or persistent UI state in browser storage.",
    },
    {
      "question": "Is there a standalone web dashboard?",
      "answer":
        "Yes. Open the CIS web dashboard to view company information, reports, Staff history, and entitlement-aware Employee Efficiency graphs outside Torn. Dashboard sign-in uses a Torn API key with company access. The server verifies it for each request and never writes it to the CIS database. The browser retains the key only in session storage until logout or the browser session ends.",
    },
    {
      "question": "How does the Training Ledger calculate costs?",
      "answer":
        "The ledger starts with your base price per train and applies the configured discount rules: • Manual discount; • Merit discount (default: 1% per merit, up to 10%, fully configurable); • Loyalty tiers such as 10:5%, 25:7%, 50:10% (fully customisable); • Optional global promotional discounts (e.g. 25% or 50%); All totals update dynamically as you edit entries, including paid, unpaid, completed, pending, used trains, and remaining trains.",
    },
    {
      "question": "How does the Train Planner work?",
      "answer":
        "The planner follows a FIFO (First In, First Out) approach for paid training entries. Paid users are prioritised up to the configured daily cap, after which remaining capacity is allocated to sponsored rotation users. Daily training capacity is based on company stars (1–10), with an additional train available when the Trainer role is enabled in settings.",
    },
    {
      "question": "What does the Timeline track?",
      "answer":
        "The timeline processes company news entries and classifies them into categories such as Hire, Application, Left, Fired, Director, Rating, Daily Reports, Training, Withdraw, Deposit, Wage, Funds, and Other. These events are also used to build structured views of current and past staff and directors, where sufficient data is available.",
    },
    {
      "question": "How are weekly analytics calculated?",
      "answer":
        "Daily report entries containing customer and income data are parsed into weekly summaries. The system tracks week number, date range, customers, income, profit per customer, and comparisons against both the previous week and long-term averages.",
    },
    {
      "question": "What is the wage system?",
      "answer":
        "The wage helper estimates staff wages based on MAN, INT, END, merit bonuses, addiction penalties, and inactivity penalties. This is a configurable planning tool and does not reflect official Torn payroll values.",
    },
    {
      "question": "What do Supporter, Company Boost, and Ultimate unlock?",
      "answer":
        "The free version includes core operation and cloud saving with 7-day visibility. Supporter, Company Boost, and Ultimate increase visible history and unlock server-enforced feature flags. Licences are time-limited only: 1 month, 3 months, 6 months, or 12 months. Lifetime licences are not available. Licensing is handled through my Discord server. First make sure you are verified there, then go to #bot-commands, talk to The Stig, and run /buylicense. That Discord flow is the route for starting or buying the licence tier you need.",
    },
    {
      "question": "What benefits does each tier include?",
      "answer":
        "Each tier is designed for different levels of company management, from basic tools to full operational insight and reporting. Supporter: • View the last 90 days of saved company history; • Basic reports, exports, imports, and graph tools; • Enhanced newsletter and reporting tools; • Supporter badge for forum signatures; Company Boost: • View the last 365 days of saved company history; • Archive access, advanced planner, stock, wage, role, report, and graph tools; • Company-linked licensing; Ultimate: • View all available saved company history; • Includes all Supporter and Company Boost features; • Best suited for full company management and long-term analytics; • Includes premium support",
    },
    {
      "question": "Why is my key rejected?",
      "answer":
        "Common causes include mismatched Torn user ID, incorrect company ID for boost licences, expired keys, an inactive server-side plan, or corrupted copy-paste input. Use Settings → Import licence key and ensure the full key is entered correctly.",
    },
    {
      "question": "What can I export?",
      "answer":
        "Supporter tier and above can export and import datasets according to the active entitlement. Free users can still save data, but only the last 7 days are visible until they upgrade. The system can also generate themed HTML reports, newsletter-ready outputs, and forum-ready snippets.",
    },
    {
      "question": "Does popup mode persist?",
      "answer":
        "Yes. Popup mode is remembered across Torn page navigation. If your browser blocks popups, a fallback badge will appear allowing you to reopen the panel with a single click.",
    },
    {
      "question": "Can I change the colours and theme?",
      "answer":
        "Yes. Settings include theme presets and colour controls for roles and contracts. You can select presets such as MoDuL Dark or Blue & Gold, or use the theme builder to create a custom configuration.",
    },
    {
      "question": "The panel is not showing. What should I check?",
      "answer":
        "• Ensure the userscript is enabled in Tampermonkey or Torn PDA; • Reload Torn after installation or updates; • Check if the UI is minimised into the badge; • Verify popup permissions if popup mode is enabled",
    },
    {
      "question": "The API sync failed. What should I check?",
      "answer":
        "• Ensure your API key is active and has the correct permissions; • Verify the API key is entered correctly in settings; • Confirm the company ID is correct; • Retry if the Torn API is temporarily unavailable or rate limited; • Use one sync action at a time (one action = one request)",
    },
    {
      "question": "How do I report a bug?",
      "answer":
        "Use Settings → Report bug within the userscript. This copies a diagnostic block including version, page URL, user ID, company ID, ledger count, timeline count, and timestamp. Include this information when reporting issues to help speed up troubleshooting.",
    },
    {
      "question": "How do I contact support?",
      "answer":
        "Use the Message me link in Settings. If it is missing, install the latest version of the script or contact the maintainer for the current support link.",
    },
  ],
  "pitGuru": [
    {
      "question": "What is MoDuL's Pit Guru?",
      "answer":
        "MoDuL's Pit Guru is a supporter racing-analysis project for Torn that is being built around live timing, driver gaps, sectors, pace, estimated telemetry, and stronger post-race insight. The aim is to understand the race while it is happening instead of treating lap capture as the whole product.",
    },
    {
      "question": "How is it related to Lap Recorder?",
      "answer":
        "It grows directly out of the lessons Lap Recorder left behind. That means replay handling, records logic, exports, race context, and UI ideas are not being ignored, but the new project is built around a broader race-analysis goal rather than simply becoming Lap Recorder again under a new name.",
    },
    {
      "question": "What kind of analysis is it aiming to show?",
      "answer":
        "The current direction includes views such as gaps, sectors, speed and G estimates, pace-focused interpretation, and post-race analysis. Those views are meant to stay useful during the race as well as after it, with settings for theme, update rate, smoothing, and preview controls.",
    },
    {
      "question": "Will it reveal final results before the race ends?",
      "answer":
        "Not by default. The intended behaviour is to keep final-result-style information gated until the race visually finishes unless the user explicitly enables a preview setting for it.",
    },
    {
      "question": "What data does it use, and is it Torn-safe?",
      "answer":
        "The race-analysis path uses racingData already delivered to the currently viewed Torn racing page. Completed race, replay, track, driver, garage, fuel, and prediction data can be persisted by the hosted Pit Guru API. The hosted service does not decide or generate Torn race outcomes.",
    },
    {
      "question": "Can I use the public race player?",
      "answer":
        "Yes. The public race player is available at pp-api.sokin.xyz/pit-guru/. It can load saved races from the PostgreSQL-backed service. Verify your account with a public Torn API key to save settings and use the one-race demo. The API key is never saved in the Pit Guru database.",
    },
    {
      "question": "Will this be a supporter script?",
      "answer":
        "Yes, it is being positioned on the hub as a supporter racing project. Licensing is handled through the Pit Guru Discord. Verify first, then run /buylicense in any server channel. Plans are 7 days for 7,000,000 Torn dollars or 31 days for 20,000,000 Torn dollars.",
    },
    {
      "question": "Can I install it right now?",
      "answer":
        "Yes. Install Pit Guru v2.3.4. On first run, Settings opens with the public Torn API-key field focused and a short guided tour. Its update and download routes point to the same hosted build. v2.3.4 fixes car images in Predictions and Past Races by using Pit Guru's hosted car asset first, Torn's canonical item image as a fallback, and clean failure handling if neither loads. v2.3.3 opens Race IDs in Records directly in the configured Pit Guru Player instead of navigating back to Torn. v2.3.2 fixes current custom-race lap metadata and race length. Predictions now make RS the strongest prior, use same-track lap pace regardless of race distance, normalize finishes for field size, and learn bounded corrections from frozen pre-race forecasts. The launcher-pill and detached Records-window corrections from v2.3.1 remain included. For a reproducible cold-cache performance run, v2.2.4 exposes pgPerformanceCleanSlate(). It clears Pit Guru performance data while preserving credentials, licence/session state, settings, and layout. v2.2.3 fixes the remaining 100-driver loading and freezing path by capturing racingData once, blocking empty pre-race builds, decoding timing once, deferring heavy route geometry, and scheduling live updates by render bucket. v2.1.7 keeps HTML report export disabled until the live race has finished or the page is a replay, then exports richer completed-race overview and full-data driver tables. v2.1.6 warm-restores cached heavy-race data after refreshing the same race, then checks fresh Torn racingData before marking the cache verified. v2.1.5 completes the performance rewrite release pass with bounded persistent caches, capped heavy-race IndexedDB cleanup, page lifecycle cleanup, and refreshed hosted install artifacts. v2.1.4 advances the phased performance rewrite with normalized race indexes, cached replay frame rows, bounded telemetry prefix stats, cached sector snapshots, and shared frame-state render paths. v2.1.3 started the phased performance rewrite with profiling, bounded race-data caches, render coalescing, incremental live overtake counting, and worker-backed heavy-race lead/sector aggregates. v2.1.1 cleans up public Settings, keeps hosted retry/cache/session-key hardening, and fixes Performance preset/theme behavior. v2.1.0 added hosted retry recovery for transient hosted failures, short TTL read caching, and legacy hosted-session key cleanup. v2.0.9 fixed a Predictions renderer crash after racingData capture while preserving the Big Race cache hardening from v2.0.8. Large custom races now let you choose how many positions around the focused driver are drawn on screen, while keeping the full race data for analysis and exports. Driver Intel sync and hosted race uploads now show notifications, and prediction scoring no longer lets a tiny amount of same-track history dominate the forecast. A verified inactive account can analyse one race as a demo before supporter access is required.",
    },
    {
      "question": "Where should I follow progress or share feedback?",
      "answer":
        "The Pit Guru Discord server is the best place for progress, support, licensing, and release routing. If you have feedback from Lap Recorder or ideas for what Pit Guru should solve better, that context is especially useful while the project is still taking shape.",
    },
  ],
  "customRaceFilter": [
    {
      "question": "What is Custom Race Filter?",
      "answer":
        "Custom Race Filter is a Torn racing userscript focused on reducing the amount of race-list scanning you have to do. It is built for racers who want the most relevant race options to stand out without manually checking every lobby.",
    },
    {
      "question": "How do I install it?",
      "answer":
        "Install it through a userscript manager such as Tampermonkey using the GreasyFork release linked on the script page. After installing or updating, reload Torn and open the race list where you want the filters to apply.",
    },
    {
      "question": "What does it filter?",
      "answer":
        "The script is designed around keeping race-list criteria easier to work with. Its job is to make useful race options easier to spot and reduce the noise from lobbies you do not care about for that session.",
    },
    {
      "question": "Is this a supporter script?",
      "answer":
        "Yes. The script page lists Custom Race Filter as a supporter script. Licensing is handled through my Discord server. You need to be verified there first, then head to #bot-commands, talk to The Stig, and run /buylicense. If you are checking access expectations, treat that Discord flow as the current source of truth for getting licensed.",
    },
    {
      "question": "Who is this best for?",
      "answer":
        "It is best for racers who browse a lot of lobbies and want a quicker way to focus on the races worth joining. The script is meant to support race selection, not replace the rest of your racing workflow.",
    },
    {
      "question": "What should I look for in the screenshots?",
      "answer":
        "The screenshots show how the race list is cleaned up and how useful options stand out once filtering is active. Use them as a quick visual reference for how the page looks before and after the helper is applied.",
    },
    {
      "question": "The filter is not showing. What should I check?",
      "answer":
        "• Make sure the userscript is enabled.; • Reload the Torn race list after installing or updating.; • Check whether another racing script is changing the same race-list area.; • Confirm you are on the race list view the script is meant to enhance.",
    },
    {
      "question": "How do I report a filter issue?",
      "answer":
        "Include the race list you were viewing, what you expected to be filtered, and what still appeared or disappeared unexpectedly. A screenshot of the affected race list is usually enough to reproduce the problem quickly.",
    },
  ],
  "tornfolio": [
    {
      "question": "Can I install Tornfolio now?",
      "answer":
        "Not publicly yet. The project page documents the private preview while the property and lease workflow is refined.",
    },
    {
      "question": "What will Tornfolio manage?",
      "answer":
        "Owned homes, current and partner properties, leases, rent, days remaining and practical rent or sale suggestions.",
    },
  ],
  "modulHubControl": [
    {
      "question": "What does Control Room change?",
      "answer":
        "It provides shared colours, fonts, spacing, radius and component variables for compatible MoDuL userscripts.",
    },
    {
      "question": "Will it overwrite each script permanently?",
      "answer":
        "No. It supplies a shared live theme contract; supported scripts read those saved settings when they render.",
    },
  ],
  "cracked": [
    {
      "question": "Does cRaCked automatically submit guesses?",
      "answer":
        "No. It recommends an estimated position and character; you stay responsible for every cracking action.",
    },
    {
      "question": "What is uploaded to the community pool?",
      "answer":
        "Completed cracking words can be shared when uploads are enabled. Torn passwords, API keys, cookies and messages are not intentionally uploaded.",
    },
    {
      "question": "Can community uploads be disabled?",
      "answer":
        "Yes. Disable uploads in cRaCked Settings; local observations and downloaded dictionary data remain separate controls.",
    },
  ],
  "raceStats": [
    {
      "question": "How do I open Race//Stats?",
      "answer":
        "Open the web tool and connect a Minimal Torn API key with racing access. No userscript installation is required.",
    },
    {
      "question": "What can I review?",
      "answer":
        "Official and custom race history, your owned-car garage, personal track records, performance trends and lap or crash results.",
    },
    {
      "question": "How does it connect to Torn?",
      "answer":
        "Your browser calls Torn's API directly. The connection screen explains the required key access.",
    },
  ],
  "raceTracker": [
    {
      "question": "Is Race Tracker still maintained?",
      "answer":
        "No. Race Tracker was retired on 6 September 2026. The workbook, screenshots and documentation remain available as an archive. Race//Stats is the current racing web tool.",
    },
    {
      "question": "What is Race Tracker?",
      "answer":
        "Race Tracker is a Google Sheets toolkit for Torn racers who want results, car history, upgrade notes, and performance review in one organised workbook. It is built for racers who prefer a structured spreadsheet workflow rather than scattered notes or one-off snapshots.",
    },
    {
      "question": "How do I get started?",
      "answer":
        "Use the spreadsheet copy link on the script page or hub card to make your own editable copy of the workbook. Once you have your own copy, you can start recording racing data, garage changes, and track comparisons in the same place.",
    },
    {
      "question": "What kind of race results does it help with?",
      "answer":
        "Race Tracker is designed around organised result views, so its strength is keeping race history easy to review later. That gives you a more useful archive for comparing sessions, positions, and patterns over time.",
    },
    {
      "question": "How does garage tracking fit in?",
      "answer":
        "The toolkit connects racing results to cars, tracks, and upgrade decisions. That makes it easier to see whether garage changes are actually helping and which setups are working best.",
    },
    {
      "question": "What analytics does it focus on?",
      "answer":
        "It focuses on car, track, and upgrade analytics, along with dashboard-style summary views. The goal is not just to collect data, but to help you spot useful performance trends and make the next decision faster.",
    },
    {
      "question": "Can I share the sheet with others?",
      "answer":
        "Yes. Since Race Tracker is a spreadsheet toolkit, sharing depends on your own Google Sheets permissions and how much of your data you want other people to see. Keep a personal copy if you want a private version for your own racing records.",
    },
    {
      "question": "What do the screenshots show?",
      "answer":
        "The screenshots show the workbook views for race results, cars, tracks, upgrades, and summary dashboards. They are the quickest way to understand the structure of the toolkit before making your own copy.",
    },
    {
      "question": "How do I report a workbook issue or ask for help?",
      "answer":
        "Include the sheet tab you were using, what you entered, and which result, calculation, or view looked wrong. If the issue is visual, a screenshot of the affected tab helps a lot.",
    },
  ],
  "eggsTerminator": [
    {
      "question": "What is EggsTerminator?",
      "answer":
        "EggsTerminator is a Torn Easter event userscript that combines page movement with egg visibility and progress tracking tools. It is meant to make the event run feel less scattered by keeping navigation and finder context together.",
    },
    {
      "question": "How do I install it?",
      "answer":
        "Install it through a userscript manager such as Tampermonkey, or through Torn PDA if the release build supports it. Reload Torn after installation, then use the script during the Easter event pages and routes it supports.",
    },
    {
      "question": "What does state-aware navigation mean?",
      "answer":
        "State-aware navigation means the script is built around the current event state instead of blindly moving through pages. The goal is to help you traverse pages while keeping the egg hunt workflow in view.",
    },
    {
      "question": "Why are found and collected counters separate?",
      "answer":
        "Found and collected can describe different parts of the event workflow. Separating those counts makes it easier to tell whether you have spotted an egg, collected it, or still need to act on it.",
    },
    {
      "question": "Can I use it outside the Easter event?",
      "answer":
        "The script description is specifically for Torn's Easter event, so its main value is during that event window. Outside the event, navigation may still load, but the finder and counter workflow may not have anything useful to track.",
    },
    {
      "question": "Where is progress data stored?",
      "answer":
        "As a userscript, any saved counters or preferences should be treated as local userscript-manager or browser data unless the release notes say otherwise. Clear browser storage carefully if you want to keep event progress between sessions.",
    },
    {
      "question": "The navigator is not moving as expected. What should I check?",
      "answer":
        "• Make sure the Easter event is active.; • Reload Torn after installing or updating the script.; • Confirm the userscript is enabled in Tampermonkey or Torn PDA.; • Check whether the page you are on is part of the supported navigation path.",
    },
    {
      "question": "How do I report an issue?",
      "answer":
        "Include the page you were on, what the counter showed, what navigation step you expected, and whether an egg was visible or already collected. That makes event-state issues much easier to trace.",
    },
  ],
  "raceThemeChanger": [
    {
      "question": "What is Race Theme Changer?",
      "answer":
        "Race Theme Changer is a lightweight userscript that enhances Torn's racing page by visually syncing the track, banner, and race details with the selected race class theme. It is designed to stay clean, stable, PDA-safe, and performance-friendly.",
    },
    {
      "question": "How do I install it?",
      "answer":
        "Install it through a userscript manager such as Tampermonkey, or through Torn PDA's userscript support. After installation, reload Torn and open a racing page to use the theme selector.",
    },
    {
      "question": "Which race classes are themed?",
      "answer":
        "The script page describes support for Classes A-E. When you choose a class, the racing banner, Theme button, and race details bar follow that selected class theme.",
    },
    {
      "question": "Where does the race details bar appear?",
      "answer":
        "The race details bar is permanently placed directly under the track canvas. It is built for Name, Position, Lap, Last Lap, and Completion details without overlays, side layouts, or wrapping problems.",
    },
    {
      "question": "Why is the Theme popup minimal?",
      "answer":
        "The popup intentionally keeps one simple selector: Class. That keeps the control clean, distraction-free, and easier to use while racing.",
    },
    {
      "question": "Is it PDA and mobile friendly?",
      "answer":
        "Yes. The script description is explicitly PDA and mobile friendly. It avoids hover dependencies, uses touch-safe controls, and keeps the layout readable on smaller viewports.",
    },
    {
      "question": "The theme is not applying. What should I check?",
      "answer":
        "• Confirm the userscript is enabled.; • Reload the Torn racing page after installing or updating.; • Choose a class from the Theme popup.; • Check whether Torn PDA or your userscript manager blocked the script.",
    },
    {
      "question": "How do I report a layout issue?",
      "answer":
        "Include your device or browser, whether you are using Torn PDA, the selected race class, and what part of the track, banner, or details bar looked wrong. A screenshot is especially helpful for spacing, clipping, or mobile layout issues.",
    },
  ],
  "restoreOgNames": [
    {
      "question": "What is Restore OG Names?",
      "answer":
        "Restore OG Names is a lightweight Torn userscript aimed at restoring familiar original-style naming across relevant views. It is built for players who prefer the older wording because it is clearer, quicker to recognise, or simply feels more familiar.",
    },
    {
      "question": "How do I install it?",
      "answer":
        "Install it through a userscript manager such as Tampermonkey, or through Torn PDA if the release build supports it. Reload Torn after installing or updating so the script can apply naming changes to supported pages.",
    },
    {
      "question": "What names does it restore?",
      "answer":
        "The script page describes classic-style naming restoration rather than a heavy interface redesign. That means the main job is to replace supported newer labels with the familiar wording expected by long-time players.",
    },
    {
      "question": "Does it change every Torn page?",
      "answer":
        "No. The description frames it as a focused utility for relevant Torn views. If a page is not part of the supported naming set, the script should leave it alone.",
    },
    {
      "question": "Is it a heavy script?",
      "answer":
        "No. Restore OG Names is described as a lightweight page enhancement. It is intended to adjust wording, not add large panels, dashboards, or unrelated tools.",
    },
    {
      "question": "Does it need to store my data?",
      "answer":
        "The script description focuses on page text and naming, so it should not need personal records to do its main job. If a release adds settings, treat them as local userscript-manager or browser data unless the release notes say otherwise.",
    },
    {
      "question": "The old names are not appearing. What should I check?",
      "answer":
        "• Make sure the userscript is enabled.; • Reload the Torn page after installing or updating.; • Confirm the page you are viewing is one of the relevant supported views.; • Check whether another userscript is changing the same labels afterwards.",
    },
    {
      "question": "How do I report a missing name?",
      "answer":
        "Include the Torn page, the newer label you are seeing, and the classic wording you expected. That gives enough context to add or adjust the replacement cleanly.",
    },
  ],
  "stockx": [
    {
      "question": "What is Stock-X?",
      "answer":
        "Stock-X is a Torn userscript focused on stock workflow support, vault visibility, ROI context, and quicker market review. It is built for players who want stock information to be easier to scan while making investment decisions.",
    },
    {
      "question": "How do I install it?",
      "answer":
        "Install it through a userscript manager such as Tampermonkey, or through Torn PDA if the release build supports it. Reload Torn after installing or updating, then open the stock-related views where Stock-X is expected to run.",
    },
    {
      "question": "What stock workflow does it help with?",
      "answer":
        "Stock-X is described around faster market checks and cleaner stock workflow support. Its purpose is to reduce repeated manual scanning and keep the important stock context easier to read.",
    },
    {
      "question": "What does vault visibility mean?",
      "answer":
        "Vault visibility means the script is built to keep stored value and stock activity easier to understand together. That helps when reviewing what you have, what is moving, and what deserves attention.",
    },
    {
      "question": "How does it support ROI review?",
      "answer":
        "The script description frames Stock-X as ROI-focused, so the emphasis is on investment context instead of only raw stock listings. Use it as a visibility helper while making your own stock decisions.",
    },
    {
      "question": "Does it store stock data?",
      "answer":
        "As a userscript, any saved preferences or cached helper data should be treated as local userscript-manager or browser data unless the release notes say otherwise. Back up settings before clearing browser storage if you rely on them.",
    },
    {
      "question": "Stock-X is not showing. What should I check?",
      "answer":
        "• Make sure the userscript is enabled.; • Reload the Torn stock page after installing or updating.; • Confirm you are on a stock-related view supported by the script.; • Check whether another userscript or browser extension is changing the same area.",
    },
    {
      "question": "How do I report a stock display issue?",
      "answer":
        "Include the Torn page, the stock or vault context you were viewing, what Stock-X displayed, and what you expected to see. For layout or missing-value issues, a screenshot speeds up troubleshooting.",
    },
  ],
  "smuggler": [
    {
      "question": "What is Smuggler?",
      "answer":
        "Smuggler is a Torn userscript for destination checks, flight timing, and lightweight travel-run planning. It is built to make flying decisions easier to follow before, during, and after a trip.",
    },
    {
      "question": "How do I install it?",
      "answer":
        "The main Smuggler page on MoDuL's Hub now links through to the live GreasyFork release. Install it through a userscript manager such as Tampermonkey, then reload Torn and open the travel-related pages where the assistant is expected to appear.",
    },
    {
      "question": "How does it help with destinations?",
      "answer":
        "The script description focuses on destination context, so its job is to make travel choices easier to review in the moment. That can help keep the reason for a destination clear instead of forcing you to rely on memory while moving between pages.",
    },
    {
      "question": "What timing does it support?",
      "answer":
        "Smuggler is described around flight and return timing support. Use it to keep the next step in your route easier to follow while you are away from Torn City.",
    },
    {
      "question": "What is travel-run planning?",
      "answer":
        "Travel-run planning means keeping the purpose of the flight visible: where you are going, why you are going there, and what you need to remember next. The script is meant to support that workflow without becoming a heavy dashboard.",
    },
    {
      "question": "Does it store travel data?",
      "answer":
        "As a userscript, any saved settings or travel helper data should be treated as local userscript-manager or browser data unless the release notes say otherwise. Back up any important settings before clearing browser storage or changing devices.",
    },
    {
      "question": "Smuggler is not showing. What should I check?",
      "answer":
        "• Make sure the userscript is enabled.; • Reload the Torn travel page after installing or updating.; • Confirm you are on a travel-related view supported by the script.; • Check whether Torn PDA or your userscript manager has blocked the script.",
    },
    {
      "question": "How do I report a travel issue?",
      "answer":
        "Include the destination, your travel state, what timing or planning detail looked wrong, and what you expected Smuggler to show. That context is usually enough to reproduce travel-state issues.",
    },
  ],
  "bootleggingHelper": [
    {
      "question": "What does the helper copy?",
      "answer":
        "It collects the DVD stock and queue figures visible in the bootlegging workflow so the combined totals are easy to compare.",
    },
    {
      "question": "Does it choose a genre automatically?",
      "answer":
        "It can select the genre with the lowest Stock+Queue total; you remain in control of the Torn action that follows.",
    },
  ],
  "jobCentrePlus": [
    {
      "question": "How do I install the live notifier?",
      "answer":
        "Sign in to JobCentre+, then use Install Notifier so the downloaded userscript receives your scoped notifier credential.",
    },
    {
      "question": "Why does the notifier need a server connection?",
      "answer":
        "It reads your private applications, messages, vacancies and alerts through scoped authenticated endpoints; it does not expose those records publicly.",
    },
    {
      "question": "What changed in v2.1.3?",
      "answer":
        "The notifier now uses XHR first with a CORS-backed fetch fallback, keeps panel scroll position and opens jobs with direct #job links.",
    },
  ],
  "pythagorasDashboard": [
    {
      "question": "What is Pythagoras CIS?",
      "answer":
        "Pythagoras CIS is a Tampermonkey userscript designed for Torn company management. It provides a cloud-backed workspace for managing the training ledger, FIFO train planner, staff and director history, daily report analytics, licensing, backups, and themed reports.",
    },
    {
      "question": "How do I install it?",
      "answer":
        "Install a userscript manager such as Tampermonkey, or use Torn PDA’s userscript support. Then install the latest release from GreasyFork. After installation, open Torn and use the Pythagoras CIS panel to configure your API key, company ID, theme, and support options.",
    },
    {
      "question": "What API key access does it need?",
      "answer":
        "A Minimal API key is sufficient for basic functionality. A Full Access API key is required for advanced features. The script only uses your Torn API key when you manually trigger a sync. It does not perform background polling or automated request chains. The only local profile fields are API key, user ID, username, and company ID. Company records, analytics, staff history, planner data, settings, stock history, and licence status live in the Pythagoras backend.",
    },
    {
      "question": "Where is my data stored?",
      "answer":
        "Company data is stored in a PostgreSQL-backed cloud workspace keyed by company ID. Every company-owned row includes its company ID, and server-side access checks decide which Torn user can open that workspace. Free users can continue syncing and saving data, but Free visibility is limited to the last 7 days. Older saved data remains in the workspace and becomes visible if the account upgrades. The script does not store business data, licence state, analytics, planner rows, staff history, stock history, or persistent UI state in browser storage.",
    },
    {
      "question": "Is there a standalone web dashboard?",
      "answer":
        "Yes. Open the CIS web dashboard to view company information, reports, Staff history, and entitlement-aware Employee Efficiency graphs outside Torn. Dashboard sign-in uses a Torn API key with company access. The server verifies it for each request and never writes it to the CIS database. The browser retains the key only in session storage until logout or the browser session ends.",
    },
    {
      "question": "How does the Training Ledger calculate costs?",
      "answer":
        "The ledger starts with your base price per train and applies the configured discount rules: • Manual discount; • Merit discount (default: 1% per merit, up to 10%, fully configurable); • Loyalty tiers such as 10:5%, 25:7%, 50:10% (fully customisable); • Optional global promotional discounts (e.g. 25% or 50%); All totals update dynamically as you edit entries, including paid, unpaid, completed, pending, used trains, and remaining trains.",
    },
    {
      "question": "How does the Train Planner work?",
      "answer":
        "The planner follows a FIFO (First In, First Out) approach for paid training entries. Paid users are prioritised up to the configured daily cap, after which remaining capacity is allocated to sponsored rotation users. Daily training capacity is based on company stars (1–10), with an additional train available when the Trainer role is enabled in settings.",
    },
    {
      "question": "What does the Timeline track?",
      "answer":
        "The timeline processes company news entries and classifies them into categories such as Hire, Application, Left, Fired, Director, Rating, Daily Reports, Training, Withdraw, Deposit, Wage, Funds, and Other. These events are also used to build structured views of current and past staff and directors, where sufficient data is available.",
    },
    {
      "question": "How are weekly analytics calculated?",
      "answer":
        "Daily report entries containing customer and income data are parsed into weekly summaries. The system tracks week number, date range, customers, income, profit per customer, and comparisons against both the previous week and long-term averages.",
    },
    {
      "question": "What is the wage system?",
      "answer":
        "The wage helper estimates staff wages based on MAN, INT, END, merit bonuses, addiction penalties, and inactivity penalties. This is a configurable planning tool and does not reflect official Torn payroll values.",
    },
    {
      "question": "What do Supporter, Company Boost, and Ultimate unlock?",
      "answer":
        "The free version includes core operation and cloud saving with 7-day visibility. Supporter, Company Boost, and Ultimate increase visible history and unlock server-enforced feature flags. Licences are time-limited only: 1 month, 3 months, 6 months, or 12 months. Lifetime licences are not available. Licensing is handled through my Discord server. First make sure you are verified there, then go to #bot-commands, talk to The Stig, and run /buylicense. That Discord flow is the route for starting or buying the licence tier you need.",
    },
    {
      "question": "What benefits does each tier include?",
      "answer":
        "Each tier is designed for different levels of company management, from basic tools to full operational insight and reporting. Supporter: • View the last 90 days of saved company history; • Basic reports, exports, imports, and graph tools; • Enhanced newsletter and reporting tools; • Supporter badge for forum signatures; Company Boost: • View the last 365 days of saved company history; • Archive access, advanced planner, stock, wage, role, report, and graph tools; • Company-linked licensing; Ultimate: • View all available saved company history; • Includes all Supporter and Company Boost features; • Best suited for full company management and long-term analytics; • Includes premium support",
    },
    {
      "question": "Why is my key rejected?",
      "answer":
        "Common causes include mismatched Torn user ID, incorrect company ID for boost licences, expired keys, an inactive server-side plan, or corrupted copy-paste input. Use Settings → Import licence key and ensure the full key is entered correctly.",
    },
    {
      "question": "What can I export?",
      "answer":
        "Supporter tier and above can export and import datasets according to the active entitlement. Free users can still save data, but only the last 7 days are visible until they upgrade. The system can also generate themed HTML reports, newsletter-ready outputs, and forum-ready snippets.",
    },
    {
      "question": "Does popup mode persist?",
      "answer":
        "Yes. Popup mode is remembered across Torn page navigation. If your browser blocks popups, a fallback badge will appear allowing you to reopen the panel with a single click.",
    },
    {
      "question": "Can I change the colours and theme?",
      "answer":
        "Yes. Settings include theme presets and colour controls for roles and contracts. You can select presets such as MoDuL Dark or Blue & Gold, or use the theme builder to create a custom configuration.",
    },
    {
      "question": "The panel is not showing. What should I check?",
      "answer":
        "• Ensure the userscript is enabled in Tampermonkey or Torn PDA; • Reload Torn after installation or updates; • Check if the UI is minimised into the badge; • Verify popup permissions if popup mode is enabled",
    },
    {
      "question": "The API sync failed. What should I check?",
      "answer":
        "• Ensure your API key is active and has the correct permissions; • Verify the API key is entered correctly in settings; • Confirm the company ID is correct; • Retry if the Torn API is temporarily unavailable or rate limited; • Use one sync action at a time (one action = one request)",
    },
    {
      "question": "How do I report a bug?",
      "answer":
        "Use Settings → Report bug within the userscript. This copies a diagnostic block including version, page URL, user ID, company ID, ledger count, timeline count, and timestamp. Include this information when reporting issues to help speed up troubleshooting.",
    },
    {
      "question": "How do I contact support?",
      "answer":
        "Use the Message me link in Settings. If it is missing, install the latest version of the script or contact the maintainer for the current support link.",
    },
  ],
  "lap-recorder": [
    {
      "question": "What was Lap Recorder?",
      "answer":
        "Lap Recorder was a Torn racing helper focused on lap capture, replay review, exports, and local track records. It started small, but it grew into a much bigger experiment around how a proper racing tool should track, structure, and interpret race data.",
    },
    {
      "question": "Why was the project terminated?",
      "answer":
        "Because it reached the point where the lessons mattered more than continuing to patch the same foundation. Lap Recorder taught a lot about replay handling, records, race context, imports, and structure. It also exposed the limits of the older approach and made the path toward a better long-term tool much clearer.",
    },
    {
      "question": "Can I still download or install it from the hub?",
      "answer":
        "No active download links are being promoted on the hub anymore. The Lap Recorder pages remain online as an archive and memory piece, not as a live install route.",
    },
    {
      "question": "What did Lap Recorder leave behind?",
      "answer":
        "Quite a lot, honestly. • lap capture workflows; • replay-aware timing lessons; • track and car record structure; • HTML export ideas; • a clearer vision for what the next racing project should focus on",
    },
    {
      "question": "Why keep the screenshots and history online?",
      "answer":
        "Because even retired tools still matter. The archive keeps the screenshots, project history, and termination notice available so Lap Recorder stays part of the story rather than simply vanishing.",
    },
    {
      "question": "Is something new replacing it?",
      "answer":
        "MoDuL's Pit Guru is already being forged in the garage. It is not meant to be a one-for-one replacement. The goal is a faster, stronger, cleaner, smarter tool that understands the race more deeply than Lap Recorder ever comfortably could.",
    },
    {
      "question": "Can I still talk about Lap Recorder or share feedback from using it?",
      "answer":
        "Absolutely. The project may be archived, but the feedback and lessons still matter. If you have old screenshots, broken-race examples, or thoughts about what the next project should do better, that context is still valuable.",
    },
  ],
};
