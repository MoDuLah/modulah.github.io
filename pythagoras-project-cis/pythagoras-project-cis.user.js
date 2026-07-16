// ==UserScript==
// @name         Pythagoras Project - CIS
// @namespace    https://torn.com/
// @version      2.9.6
// @description  Company Intelligence System for Torn company training, staff, analytics, and local reporting.
// @author       MoDuL [4022159]
// @match        https://www.torn.com/companies.php*
// @copyright    2026 MoDuL. All rights reserved.
// @license      All Rights Reserved
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM.addStyle
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        GM.xmlHttpRequest
// @grant        GM.setClipboard
// @grant        unsafeWindow
// @updateURL    https://modulah.github.io/pythagoras-project-cis/pythagoras-project-cis.user.js
// @downloadURL  https://modulah.github.io/pythagoras-project-cis/pythagoras-project-cis.user.js
// @connect      api.torn.com
// @connect      pp-api.sokin.xyz
// @run-at       document-end
// ==/UserScript==

/*
Copyright (c) 2026 MoDuL. All rights reserved.
Unauthorized copying, modification, redistribution, or commercial use is prohibited without written permission.
*/

(function () {
  'use strict';

  const APP = {
    id: 'pythagoras-cis',
    name: 'Pythagoras Project - CIS',
    storageKey: 'pp_cis_state_v2',
    companiesKey: 'pp_cis_company_snapshots_v1',
    profileKey: 'PP_CIS_LOCAL_PROFILE_V1',
    staffEditsKey: 'pp_cis_staff_card_edits_v2',
    ledgerPendingKey: 'pp_cis_ledger_pending_v2',
    syncCacheKey: 'pp_cis_sync_cache_v1',
    notificationDismissalsKey: 'pp_cis_notification_dismissals_v1',
    version: '2.9.6',
    popupName: 'pythagoras-cis-popup'
  };

  /*
    Privacy and Torn-rule summary:
    - Local browser storage is limited to apiKey, userId, username, and companyId.
    - Company data, staff data, analytics, planner data, stock history,
      notifications, and persistent UI preferences belong in the Pythagoras backend.
    - The Torn API key is sent only to verify the current user/company and to process
      explicit sync actions. The script does not run background scraping or automatic
      multi-request chains.
    - Older company data can be archived/compressed server-side.
  */

  // PP_CIS_BUILD_CONFIG_START
  const BUILD_CONFIG = {
    enabled: true,
    buildName: '',
    faqUrl: 'https://modulah.github.io/pythagoras-project-cis/faq.html',
    bugReportUrl: 'https://discord.com/channels/1492449197729775817/1493218818078806046',
    contactUrl: 'https://www.torn.com/messages.php#/p=compose&XID=4022159',
    apiBaseUrl: 'https://pp-api.sokin.xyz',
    defaultTheme: '',
    lockSupportLinks: true
  };
  // PP_CIS_BUILD_CONFIG_END

  const DEFAULTS = {
    version: APP.version,
    entitlement: { tier: 'free', mode: 'free', visibleHistoryDays: 7, flags: {} },
    ledger: [],
    trainingLog: [],
    planner: { startDate: '', daysToPlan: 14, mode: 'auto', generatedAt: '', days: [], manualSlots: {}, trainingQueue: null, completedDates: {}, sponsoredRotation: { order: [], lastTrainedIdentity: '', updatedAt: '' } },
    staff: { current: [], past: [], directorsCurrent: [], directorsPast: [], timeline: [], localEdits: {}, localEditVersion: 0 },
    analytics: { weeks: [] },
    company: {
      profile: {
        lastSynced: '',
        id: '',
        name: '',
        typeId: '',
        typeName: '',
        directorId: '',
        rating: 0,
        ageDays: 0,
        foundedAt: '',
        foundedTimestamp: 0,
        currentEmployees: 0,
        maxEmployees: 0,
        dailyIncome: 0,
        dailyCustomers: 0,
        weeklyIncome: 0,
        weeklyCustomers: 0,
        employees: []
      },
      detailed: {
        lastSynced: '',
        id: '',
        funds: 0,
        bank: 0,
        popularity: 0,
        efficiency: 0,
        environment: 0,
        trainsAvailable: 0,
        advertisingBudget: 0,
        companySize: '',
        staffroomSize: '',
        storageSize: '',
        storageSpace: 0,
        value: 0
      },
      stock: { lastSynced: '', items: [] },
      stockSettings: {},
      stockHistory: [],
      adBudgetHistory: [],
      newsSync: { firstBackfillDone: false, earliestTimestamp: 0, oldestTimestamp: 0, latestTimestamp: 0, lastSynced: '', fetchedPages: 0, reportGapAttempts: {} },
      syncWatermarks: {}
    },
    dismissedNotifications: {},
    settings: {
      apiKey: '',
      rememberApiKey: true,
      keyInfo: {
        lastChecked: '',
        accessLevel: 0,
        accessType: '',
        fullAccess: false,
        companyAccess: false,
        factionAccess: false,
        logCustomPermissions: false,
        userId: '',
        companyId: ''
      },
      userId: '',
      userName: '',
      companyId: '',
      companyTypeId: '',
      companyTypeName: '',
      trainingPrice: 600000,
      maxPaidTrainsPerDay: 8,
      companyStars: 1,
      trainerAutoDetect: true,
      trainerAssigned: false,
      plannerPriority: {
        addictionEnabled: true,
        inactivityEnabled: true,
        addictionWeight: 1,
        inactivityWeight: 1
      },
      discountsEnabled: true,
      meritDiscountRate: 1,
      maxMeritDiscount: 10,
      loyaltyMaxDiscount: 10,
      loyaltyTiers: [{ min: 10, percent: 5 }, { min: 25, percent: 7 }, { min: 50, percent: 10 }],
      loyaltyTiersText: '10:5,25:7,50:10',
      globalPromoDiscount: 0,
      maxTotalDiscount: 90,
      logTrigger: '!train',
      theme: BUILD_CONFIG.enabled && BUILD_CONFIG.defaultTheme ? BUILD_CONFIG.defaultTheme : 'modul',
      supportUrl: BUILD_CONFIG.enabled ? BUILD_CONFIG.faqUrl : '',
      bugReportUrl: BUILD_CONFIG.enabled ? BUILD_CONFIG.bugReportUrl : '',
      contactUrl: BUILD_CONFIG.enabled ? BUILD_CONFIG.contactUrl : '',
      apiBaseUrl: BUILD_CONFIG.enabled ? BUILD_CONFIG.apiBaseUrl : '',
      dateFormat: 'locale-medium',
      customDateFormat: 'DD MMM YYYY',
      colors: {
        paid: '#46c58f',
        sponsored: '#d8a545',
        unpaid: '#d95d5d',
        done: '#8ab4f8',
        roleDefault: '#9aa0a6',
        roleDirector: '#f4d35e',
        roleTrainer: '#46c58f'
      },
      roleColors: {},
      roleLabels: {},
      roleRankMap: {},
      roleRankEvidence: {},
      customRoles: [],
      hiddenRoles: [],
      customTheme: {
        name: 'Custom',
        vars: {
          bg: '#111313',
          panel: '#171a1a',
          panel2: '#1f2422',
          line: '#343936',
          text: '#eff2ef',
          muted: '#a8b0aa',
          accent: '#46c58f',
          warn: '#d8a545',
          bad: '#d95d5d',
        graphIncome: '#46c58f',
        graphCustomers: '#00c6ff',
        graphWages: '#f06d87',
        graphAdBudget: '#8ab4f8',
        graphProfit: '#f4d35e',
        graphServices: '#d8a545'
        }
      },
      savedThemes: [],
      wage: {
        baseWage: 0,
        manWeight: 1,
        intWeight: 1,
        endWeight: 1,
        statCashRate: 1,
        meritBonusPercent: 1,
        addictionPenaltyPercent: 0,
        inactivityPenaltyPercent: 0,
        inactiveDaysThreshold: 3
      },
      notifications: {
        stock: { enabled: true },
        addiction: { enabled: true, threshold: 4 },
        inactivity: { enabled: true, thresholdDays: 3 },
        sync: { enabled: true, warnHours: 24, dangerHours: 72 }
      },
      wageRoleRequirements: {}
    },
    ui: { tab: 'timeline', staffTab: 'current', directorTab: 'current', settingsSection: 'core', timelineFilter: 'all', timelineGrouped: true, analyticsYear: 'all', analyticsExpanded: {}, dailyBalanceMode: 'week', dailyBalanceStart: '', dailyBalanceIncludeWages: true, graphIndex: 0, graphScale: 'weekly', graphSeries: { income: true, customers: true, wages: true, adBudget: true, profit: true }, trainingLogStart: '', trainingLogYear: 'all', profileSort: 'name', profileSortDir: 'asc', tableSorts: {}, showApiKey: false, privacyMode: false, tourActive: false, tourStep: 0, minimized: false, mode: 'embedded', editMode: false, editPersonKey: '', editDirectorKey: '', personSaveExit: false, plannerQueueHidden: false, collapsedPanels: {}, detailOpenState: {}, panelSizes: {}, reportSections: { summary: true, ledger: true, trainingLog: true, planner: true, analytics: true, balance: true, stock: true, staff: true, pastStaff: false, directors: false, timeline: true, profile: true, details: true, settings: true }, left: '', top: '', restoreWidth: '', restoreHeight: '' }
  };

  const CSS = `
    #pythagoras-cis{--bg:#111313;--panel:#171a1a;--panel2:#1f2422;--line:#343936;--text:#eff2ef;--muted:#a8b0aa;--accent:#46c58f;--warn:#d8a545;--bad:#d95d5d;position:fixed;z-index:999999;top:18px;right:18px;width:min(1120px,calc(100vw - 28px));max-height:calc(100vh - 28px);min-width:340px;min-height:220px;resize:both;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:8px;box-shadow:0 18px 54px rgba(0,0,0,.42);font:13px/1.45 Arial,Helvetica,sans-serif;overflow:hidden;letter-spacing:0;scrollbar-color:var(--accent) var(--panel);scrollbar-width:thin}
    #pythagoras-cis.pp-theme-carbon{--bg:#0b0d0d;--panel:#151717;--panel2:#202323;--line:#3b4040;--text:#f4f6f4;--muted:#b7beb8;--accent:#d8d1bd;--warn:#e0b85e;--bad:#e26b6b}
    #pythagoras-cis.pp-theme-neon{--bg:#07100d;--panel:#0e1915;--panel2:#14241d;--line:#285545;--text:#f2fff8;--muted:#a8c9b8;--accent:#55e69f;--warn:#f2d264;--bad:#ff6c7a}
    #pythagoras-cis.pp-theme-ruby{--bg:#120d0f;--panel:#1a1215;--panel2:#27191e;--line:#56343e;--text:#fff5f6;--muted:#d4b7bd;--accent:#f06d87;--warn:#e8c35f;--bad:#ff5b66}
    #pythagoras-cis.pp-theme-blue-gold{--bg:#081019;--panel:#101925;--panel2:#172538;--line:#d8a545;--text:#f0cf66;--muted:#d7c07a;--accent:#f4d35e;--warn:#f0d06f;--bad:#ef6d70}
    #pythagoras-cis.pp-theme-contrast{--bg:#000;--panel:#080808;--panel2:#141414;--line:#f5f5f5;--text:#fff;--muted:#d9d9d9;--accent:#00ff8c;--warn:#ffe600;--bad:#ff4d4d}
    #pythagoras-cis.pp-theme-carbon .pp-titlebar,#pythagoras-cis.pp-theme-carbon .pp-tabs,#pythagoras-cis.pp-theme-carbon .pp-input,#pythagoras-cis.pp-theme-carbon .pp-select,#pythagoras-cis.pp-theme-carbon .pp-textarea,#pythagoras-cis.pp-theme-carbon .pp-inline,#pythagoras-cis.pp-theme-carbon .pp-empty,#pythagoras-cis.pp-theme-carbon .pp-pill,#pythagoras-cis.pp-theme-carbon .pp-day,#pythagoras-cis.pp-theme-carbon .pp-stat,#pythagoras-cis.pp-theme-carbon .pp-event{background:#101212}
    #pythagoras-cis.pp-theme-neon .pp-titlebar,#pythagoras-cis.pp-theme-neon .pp-tabs,#pythagoras-cis.pp-theme-neon .pp-input,#pythagoras-cis.pp-theme-neon .pp-select,#pythagoras-cis.pp-theme-neon .pp-textarea,#pythagoras-cis.pp-theme-neon .pp-inline,#pythagoras-cis.pp-theme-neon .pp-empty,#pythagoras-cis.pp-theme-neon .pp-pill,#pythagoras-cis.pp-theme-neon .pp-day,#pythagoras-cis.pp-theme-neon .pp-stat,#pythagoras-cis.pp-theme-neon .pp-event{background:#0a1511}
    #pythagoras-cis.pp-theme-ruby .pp-titlebar,#pythagoras-cis.pp-theme-ruby .pp-tabs,#pythagoras-cis.pp-theme-ruby .pp-input,#pythagoras-cis.pp-theme-ruby .pp-select,#pythagoras-cis.pp-theme-ruby .pp-textarea,#pythagoras-cis.pp-theme-ruby .pp-inline,#pythagoras-cis.pp-theme-ruby .pp-empty,#pythagoras-cis.pp-theme-ruby .pp-pill,#pythagoras-cis.pp-theme-ruby .pp-day,#pythagoras-cis.pp-theme-ruby .pp-stat,#pythagoras-cis.pp-theme-ruby .pp-event{background:#160f12}
    #pythagoras-cis.pp-theme-blue-gold .pp-titlebar,#pythagoras-cis.pp-theme-blue-gold .pp-tabs,#pythagoras-cis.pp-theme-blue-gold .pp-input,#pythagoras-cis.pp-theme-blue-gold .pp-select,#pythagoras-cis.pp-theme-blue-gold .pp-textarea,#pythagoras-cis.pp-theme-blue-gold .pp-inline,#pythagoras-cis.pp-theme-blue-gold .pp-empty,#pythagoras-cis.pp-theme-blue-gold .pp-pill,#pythagoras-cis.pp-theme-blue-gold .pp-day,#pythagoras-cis.pp-theme-blue-gold .pp-stat,#pythagoras-cis.pp-theme-blue-gold .pp-event{background:#0b1522}
    #pythagoras-cis.pp-theme-contrast .pp-titlebar,#pythagoras-cis.pp-theme-contrast .pp-tabs,#pythagoras-cis.pp-theme-contrast .pp-input,#pythagoras-cis.pp-theme-contrast .pp-select,#pythagoras-cis.pp-theme-contrast .pp-textarea,#pythagoras-cis.pp-theme-contrast .pp-inline,#pythagoras-cis.pp-theme-contrast .pp-empty,#pythagoras-cis.pp-theme-contrast .pp-pill,#pythagoras-cis.pp-theme-contrast .pp-day,#pythagoras-cis.pp-theme-contrast .pp-stat,#pythagoras-cis.pp-theme-contrast .pp-event{background:#000}
    #pythagoras-cis.pp-theme-custom .pp-titlebar,#pythagoras-cis.pp-theme-custom .pp-head{background:var(--panel2)}#pythagoras-cis.pp-theme-custom .pp-tabs,#pythagoras-cis.pp-theme-custom .pp-tab,#pythagoras-cis.pp-theme-custom .pp-subtab,#pythagoras-cis.pp-theme-custom .pp-btn,#pythagoras-cis.pp-theme-custom .pp-input,#pythagoras-cis.pp-theme-custom .pp-select,#pythagoras-cis.pp-theme-custom .pp-textarea,#pythagoras-cis.pp-theme-custom .pp-inline,#pythagoras-cis.pp-theme-custom .pp-empty,#pythagoras-cis.pp-theme-custom .pp-pill,#pythagoras-cis.pp-theme-custom .pp-day,#pythagoras-cis.pp-theme-custom .pp-stat,#pythagoras-cis.pp-theme-custom .pp-event,#pythagoras-cis.pp-theme-custom .pp-operation-note,#pythagoras-cis.pp-theme-custom .pp-training-queue{background:var(--panel)}
    #pythagoras-cis::-webkit-scrollbar,#pythagoras-cis *::-webkit-scrollbar{width:10px;height:10px}#pythagoras-cis::-webkit-scrollbar-track,#pythagoras-cis *::-webkit-scrollbar-track{background:var(--panel)}#pythagoras-cis::-webkit-scrollbar-thumb,#pythagoras-cis *::-webkit-scrollbar-thumb{background:var(--accent);border:2px solid var(--panel);border-radius:8px}
    #pythagoras-cis.pp-theme-blue-gold .pp-input,#pythagoras-cis.pp-theme-blue-gold .pp-select,#pythagoras-cis.pp-theme-blue-gold .pp-textarea,#pythagoras-cis.pp-theme-blue-gold .pp-inline,#pythagoras-cis.pp-theme-blue-gold .pp-btn{border-color:var(--accent);color:var(--accent)}
    #pythagoras-cis.pp-cis-popup-root{position:static;width:100%;max-height:none;min-height:100vh;border:0;border-radius:0;box-shadow:none;resize:none}
    #pythagoras-cis *{box-sizing:border-box;letter-spacing:0}
    #pythagoras-cis,#pythagoras-cis *{font-family:Arial,Helvetica,sans-serif}
    #pythagoras-cis h1,#pythagoras-cis h2,#pythagoras-cis h3,#pythagoras-cis h4,#pythagoras-cis h5,#pythagoras-cis h6,#pythagoras-cis p,#pythagoras-cis ul,#pythagoras-cis ol{margin:0;padding:0}
    #pythagoras-cis button,#pythagoras-cis input,#pythagoras-cis select,#pythagoras-cis textarea{font:inherit}
    #pythagoras-cis input[type="checkbox"]{appearance:none;-webkit-appearance:none;position:relative;display:inline-block;vertical-align:middle;flex:0 0 auto;width:48px;height:22px;margin:0 6px 0 0;border:1px solid var(--line);border-radius:999px;background:var(--panel2);cursor:pointer;transition:background .16s ease,border-color .16s ease,opacity .16s ease}
    #pythagoras-cis input[type="checkbox"]:before{content:'';position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:var(--muted);box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .16s ease,background .16s ease}
    #pythagoras-cis input[type="checkbox"]:after{content:'Off';position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:9px;font-weight:700;line-height:1;color:var(--muted);text-transform:uppercase;pointer-events:none}
    #pythagoras-cis input[type="checkbox"]:checked{background:var(--accent);border-color:var(--accent)}
    #pythagoras-cis input[type="checkbox"]:checked:before{transform:translateX(26px);background:var(--bg)}
    #pythagoras-cis input[type="checkbox"]:checked:after{content:'On';left:7px;right:auto;color:var(--bg)}
    #pythagoras-cis input[type="checkbox"]:disabled{opacity:.58;cursor:not-allowed}
    #pythagoras-cis input[type="checkbox"]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    #pythagoras-cis a{color:var(--accent);text-decoration:none}#pythagoras-cis a:hover{text-decoration:underline}
    .pp-shell{position:relative;display:grid;grid-template-rows:auto auto auto minmax(0,1fr);max-height:calc(100vh - 30px);min-height:360px;background:var(--bg)}
    .pp-cis-popup-root .pp-shell{max-height:none;min-height:100vh}
    .pp-titlebar{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line);background:#141717;cursor:move;user-select:none;min-width:0}
    .pp-brand{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;min-width:0}.pp-logo-mark{flex:0 0 34px;width:34px;height:34px;border:1px solid var(--line);border-radius:6px;background:#0b0f14;box-shadow:0 0 0 1px rgba(255,221,0,.08)}.pp-brand strong{font-size:16px;line-height:1.2;color:#fff;white-space:nowrap}.pp-brand span{color:var(--muted);white-space:nowrap}.pp-version-pill{display:inline-flex;align-items:center;min-height:24px;padding:2px 8px;border:1px solid var(--line);border-radius:999px;background:#111313;color:var(--accent);font-size:12px;font-weight:700}.pp-title-sync{display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-width:0}.pp-title-sync .pp-btn{min-height:26px;padding:3px 7px;margin:0;font-size:12px}
    .pp-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;min-width:0}.pp-tabs,.pp-subtabs{display:flex;gap:4px}.pp-tabs{padding:8px;background:#111313;border-bottom:1px solid var(--line);overflow:hidden;flex-wrap:wrap}.pp-subtabs{margin-bottom:12px;overflow-x:auto}
    .pp-tab,.pp-subtab,.pp-btn{min-height:32px;border:1px solid var(--line);border-radius:6px;background:#191d1c;color:var(--text);padding:6px 10px;cursor:pointer;transition:background .14s ease,border-color .14s ease,transform .14s ease;white-space:nowrap}
    .pp-tab{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:max-content}.pp-tab-icon{display:inline-flex;align-items:center;justify-content:center;min-width:1.2em;line-height:1}.pp-tab-label{display:inline-block}.pp-tabs-glyph-only .pp-tabs{flex-wrap:wrap;overflow:hidden}.pp-tabs-glyph-only .pp-tab{width:34px;min-width:34px;padding-left:6px;padding-right:6px}.pp-tabs-glyph-only .pp-tab-label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
    .pp-tab:hover,.pp-subtab:hover,.pp-btn:hover{background:#202624;border-color:#4b534f}.pp-tab:active,.pp-subtab:active,.pp-btn:active{transform:translateY(1px)}
    .pp-tab.is-active,.pp-subtab.is-active,.pp-btn.is-primary{border-color:rgba(70,197,143,.72);background:#173329;color:#effff8}.pp-btn.is-warn{border-color:rgba(216,165,69,.85);background:#2a220f;color:#ffe6a3}.pp-btn.is-danger{border-color:rgba(217,93,93,.75);background:#311d1d}.pp-btn.is-quiet{color:var(--muted);background:transparent}.pp-btn.is-dirty{border-color:var(--warn);box-shadow:0 0 0 1px rgba(216,165,69,.18)}.pp-btn:disabled{opacity:.48;cursor:not-allowed;transform:none}
    #pythagoras-cis.pp-privacy .pp-privacy-input{filter:blur(5px);caret-color:transparent}#pythagoras-cis.pp-privacy .pp-privacy-value{color:transparent!important;text-shadow:0 0 0 var(--muted)!important;user-select:none}#pythagoras-cis.pp-privacy .pp-privacy-note{color:var(--warn)!important}#pythagoras-cis.pp-privacy .pp-privacy-button{border-color:var(--warn);color:var(--warn);box-shadow:0 0 0 1px rgba(216,165,69,.18)}
    .pp-api-key-missing .pp-input,.pp-tour-target{outline:2px solid var(--warn)!important;outline-offset:2px;box-shadow:0 0 0 4px rgba(216,165,69,.18),0 0 24px rgba(216,165,69,.32)!important}.pp-key-status{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.pp-status-mark{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;border:1px solid currentColor;margin-left:4px;font-size:12px}.pp-sync-center{display:grid;grid-template-columns:minmax(0,1fr) minmax(230px,330px);gap:10px;align-items:start}.pp-sync-groups{display:grid;gap:8px;min-width:0}.pp-sync-group{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.pp-sync-group-title{flex:0 0 100%;color:var(--muted);font-size:12px;font-weight:700}.pp-sync-center .pp-btn{margin-bottom:4px}.pp-sync-progress{background:linear-gradient(90deg,rgba(70,197,143,.34) var(--sync-progress,0%),#191d1c var(--sync-progress,0%));border-color:rgba(70,197,143,.55)}.pp-sync-progress.is-warn{background:linear-gradient(90deg,rgba(216,165,69,.36) var(--sync-progress,0%),#2a220f var(--sync-progress,0%))}.pp-sync-progress.is-danger{background:linear-gradient(90deg,rgba(217,93,93,.34) var(--sync-progress,0%),#311d1d var(--sync-progress,0%))}.pp-sync-console{min-height:132px;max-height:180px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:#101312;padding:8px;font-size:12px;color:var(--muted)}.pp-sync-console strong{display:block;color:#fff;margin-bottom:4px}.pp-sync-console p{margin:0 0 4px;overflow-wrap:anywhere}.pp-sync-console time{color:var(--accent);font-size:11px;margin-right:5px}.pp-tour-card{position:fixed;left:var(--tour-left,18px);top:var(--tour-top,76px);right:auto;bottom:auto;z-index:28;width:min(460px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;border:1px solid var(--warn);border-radius:8px;background:#171309;color:var(--text);padding:11px 12px;box-shadow:0 14px 36px rgba(0,0,0,.42)}.pp-tour-card strong{display:block;color:#fff;margin-bottom:3px}.pp-tour-card p{margin:0;color:var(--muted)}.pp-tour-card ul{margin:8px 0 0 18px;padding:0;color:var(--muted)}.pp-tour-card li{margin:4px 0}.pp-tour-card .pp-row-actions{margin-top:8px}.pp-tour-step{color:var(--warn);font-weight:700}
    .pp-body{overflow:auto;padding:14px;background:var(--bg)}#pythagoras-cis.pp-cis-launcher-only{display:none!important}#pythagoras-cis.pp-cis-minimized{width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;max-width:40px!important;max-height:40px!important;resize:none!important;border:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}#pythagoras-cis.pp-cis-minimized.pp-minimized-docked{position:fixed!important}#pythagoras-cis.pp-cis-minimized.pp-footer-button-mounted{display:none!important}#ppcis-footer-wrap{transition:transform linear;display:inline-block!important;visibility:visible!important;opacity:1!important}#ppcis-footer-btn[data-ppcis-alerts]{position:relative;overflow:hidden}#ppcis-footer-btn[data-ppcis-alerts]::after{content:"";position:absolute;inset:2px;border-radius:inherit;pointer-events:none;opacity:0;box-shadow:inset 0 0 0 1px rgba(217,93,93,.72),inset 0 0 10px rgba(217,93,93,.9),inset 0 0 18px rgba(217,93,93,.48);animation:pp-footer-alert-glow 5s ease-in-out infinite}@keyframes pp-footer-alert-glow{0%,82%,100%{opacity:0}88%,94%{opacity:1}}#ppcis-footer-btn .pp-footer-button-icon{display:block!important;width:24px!important;height:24px!important;max-width:24px!important;max-height:24px!important;pointer-events:none!important}#ppcis-footer-btn .pp-footer-button-icon *{pointer-events:none!important}.pp-cis-minimized .pp-shell{display:block;width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;max-height:none;background:transparent}.pp-cis-minimized .pp-tabs,.pp-cis-minimized .pp-body,.pp-cis-minimized .pp-alerts{display:none}.pp-cis-minimized .pp-titlebar{display:grid;place-items:center;width:40px;height:40px;max-width:40px;gap:0;padding:0;border:1px solid var(--accent);cursor:pointer;background:var(--accent);border-radius:8px;box-shadow:0 2px 0 rgba(255,255,255,.1) inset,0 1px 5px rgba(0,0,0,.36);transition:filter .14s ease,transform .14s ease}.pp-cis-minimized .pp-titlebar:hover{filter:brightness(1.08)}.pp-cis-minimized .pp-titlebar:active{transform:translateY(1px)}.pp-cis-minimized .pp-brand{display:grid;place-items:center;width:100%;height:100%;min-width:0}.pp-cis-minimized .pp-logo-mark{flex-basis:auto;width:30px;height:30px;border:0;border-radius:0;background:transparent;box-shadow:none;filter:drop-shadow(0 0 3px rgba(0,0,0,.5))}.pp-cis-minimized .pp-brand strong,.pp-cis-minimized .pp-brand span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.pp-cis-minimized .pp-brand:before{display:none}.pp-cis-minimized .pp-actions{display:none}.pp-popup-badge{width:auto;max-width:300px}.pp-popup-badge .pp-shell{display:block;min-height:0;background:transparent}.pp-popup-badge .pp-titlebar{display:flex;cursor:pointer;border:0;padding:8px 10px}.pp-popup-badge .pp-actions{display:flex}.pp-popup-badge .pp-tabs,.pp-popup-badge .pp-body,.pp-popup-badge .pp-alerts{display:none}
    .pp-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px;align-items:start;min-width:0}.pp-panel{position:relative;grid-column:span 12;align-self:start;border:1px solid var(--line);border-radius:8px;background:var(--panel);overflow:hidden;min-width:0;max-width:100%}.pp-edit-mode .pp-panel{resize:both;overflow:auto;min-width:260px;min-height:120px;box-shadow:inset -1px -1px 0 rgba(70,197,143,.4)}.pp-edit-mode .pp-panel:after{content:'';position:absolute;right:5px;bottom:5px;width:13px;height:13px;border-right:2px solid var(--accent);border-bottom:2px solid var(--accent);opacity:.85;pointer-events:none}.pp-panel.is-collapsed .pp-content{display:none}.pp-panel.is-half{grid-column:span 6}.pp-panel.is-third{grid-column:span 4}.pp-collapse-toggle,.pp-hint-toggle{position:absolute;top:8px;z-index:3;display:grid;place-items:center;width:26px;min-width:26px;height:26px;min-height:26px;padding:0;margin:0;border-color:var(--accent);color:var(--accent);line-height:1}.pp-collapse-toggle{right:8px}.pp-hint-toggle{right:40px}
    .pp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 82px 14px 14px;border-bottom:1px solid var(--line);background:var(--panel2);min-width:0}.pp-head.is-stack{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}.pp-head.is-stack .pp-row-actions{justify-content:flex-start}.pp-head>*,.pp-field>*,.pp-kv span{min-width:0}.pp-head>div:first-child{flex:1 1 auto}.pp-head>.pp-row-actions{flex:0 1 auto;justify-content:flex-end;align-items:flex-start}.pp-head h2,.pp-head h3{margin:0;font-size:14px;line-height:1.25;color:#fff}.pp-head p,.pp-note{margin:4px 0 0;color:var(--muted);font-size:12px}.pp-content{padding:12px;min-width:0}
    .pp-form{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;align-items:end;min-width:0}.pp-field{display:grid;gap:5px;min-width:0;overflow:hidden}.pp-field.span-2{grid-column:span 2}.pp-field.span-3{grid-column:span 3}.pp-field.span-4{grid-column:span 4}.pp-field.span-6{grid-column:span 6}.pp-field label,.pp-field>span{color:var(--muted);font-size:12px}
    .pp-form-title{grid-column:span 6;color:#fff;font-weight:700;border-top:1px solid var(--line);padding-top:10px;margin-top:4px}.pp-form-title:first-child{border-top:0;padding-top:0;margin-top:0}
    .pp-loyalty-list{display:flex;flex-wrap:wrap;gap:8px}.pp-loyalty-list .pp-row-actions{border:1px solid var(--line);border-radius:8px;background:#121615;padding:8px}.pp-loyalty-list .pp-select{width:auto}
    .pp-input,.pp-select,.pp-textarea{width:calc(100% - 8px);max-width:calc(100% - 8px);min-height:34px;border:1px solid var(--line);border-radius:6px;background:#0f1111;color:var(--text);padding:7px 9px;margin-left:4px;margin-right:4px;outline:none}.pp-input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(1);opacity:.78}.pp-textarea{min-height:78px;resize:vertical}.pp-select-fit{width:var(--select-width,auto);max-width:calc(100% - 8px)}.pp-input:focus,.pp-select:focus,.pp-textarea:focus{border-color:rgba(70,197,143,.82);box-shadow:0 0 0 2px rgba(70,197,143,.12)}.pp-input:disabled,.pp-select:disabled,.pp-textarea:disabled{opacity:.74;color:var(--muted);background:var(--panel2);cursor:not-allowed}
    .pp-color-pair{display:grid;grid-template-columns:minmax(0,1fr) 42px;gap:6px}.pp-color-picker{width:42px;min-height:34px;border:1px solid var(--line);border-radius:6px;background:#0f1111;padding:3px;cursor:pointer}
    .pp-wrap{overflow-x:auto}.pp-table{width:100%;border-collapse:collapse;min-width:760px}.pp-table th,.pp-table td{padding:8px;border-bottom:1px solid var(--line);vertical-align:middle;text-align:left;white-space:nowrap}.pp-table th{color:var(--muted);font-size:12px;font-weight:700;background:#151817}.pp-table td{color:var(--text)}#pythagoras-cis .pp-table td{color:var(--text)}#pythagoras-cis .pp-table th{color:var(--muted)}.pp-table tbody tr:nth-child(odd) td{background:rgba(255,255,255,.045)}.pp-table tr:last-child td{border-bottom:0}
    .pp-table tr.pp-stock-warning td{background:rgba(216,165,69,.08)}.pp-table tr.pp-detail-row td{background:rgba(255,255,255,.035);white-space:normal}.pp-analytics-detail{display:grid;gap:8px;padding:8px}.pp-analytics-detail .pp-wrap{display:inline-block;max-width:100%}.pp-analytics-detail-table{width:max-content;border-collapse:collapse;min-width:0}.pp-analytics-detail-table th,.pp-analytics-detail-table td{padding:6px 9px;border-bottom:1px solid var(--line);text-align:center;white-space:nowrap}.pp-analytics-detail-table th{color:var(--muted);font-size:12px}.pp-expand-btn{min-width:30px;padding:4px 8px}
    .pp-table.is-compact{min-width:0}.pp-people-table th,.pp-people-table td,.pp-effectiveness-table th,.pp-effectiveness-table td{text-align:center}.pp-people-table .pp-pill{justify-content:center}.pp-report-actions{margin-top:10px}
.pp-inline{width:auto;max-width:calc(100% - 8px);min-height:30px;border:1px solid var(--line);border-radius:6px;background:#0f1111;color:var(--text);padding:5px 7px;margin-left:4px;margin-right:4px}.pp-fit{width:auto;max-width:180px}.pp-tiny{width:5ch;max-width:5ch;text-align:right}.pp-capacity{width:9ch;max-width:9ch;text-align:right}.pp-stock-qty{width:8ch;max-width:8ch;text-align:right}.pp-name{width:150px}.pp-row-actions{display:flex;gap:6px;flex-wrap:wrap;min-width:0}.pp-row-actions>*{min-width:0}.pp-row-actions .pp-btn{margin-left:0;margin-right:0}.pp-btn{margin-left:4px;margin-right:4px}
    .pp-ledger-add-form{grid-template-columns:repeat(auto-fit,minmax(84px,max-content));justify-content:start;align-items:end}.pp-ledger-add-form .pp-field{overflow:visible}.pp-ledger-add-form .pp-input,.pp-ledger-add-form .pp-select{width:var(--ledger-field-width,auto);min-width:var(--ledger-field-min,8ch);max-width:min(var(--ledger-field-max,24ch),calc(100vw - 48px))}.pp-ledger-staff-field{--ledger-field-width:26ch;--ledger-field-max:30ch}.pp-ledger-date-field{--ledger-field-width:13ch;--ledger-field-max:14ch}.pp-ledger-money-field{--ledger-field-width:15ch;--ledger-field-max:16ch}.pp-ledger-price-field{--ledger-field-width:12ch;--ledger-field-max:13ch}.pp-ledger-small-field{--ledger-field-width:7ch;--ledger-field-max:8ch}.pp-ledger-contract-field{--ledger-field-width:20ch;--ledger-field-max:22ch}.pp-ledger-check-field{min-width:15ch}.pp-checkline{display:flex;gap:10px;align-items:center;min-height:34px;white-space:nowrap}.pp-ledger-preview-field{grid-column:span 2;min-width:min(40ch,100%)}.pp-ledger-preview-field .pp-btn{width:min(32ch,100%)}.pp-ledger-row.is-done td{opacity:.58}.pp-ledger-id{font-weight:700;color:var(--accent)}.pp-order-trains{display:grid;grid-template-columns:repeat(2,max-content);gap:6px 8px;align-items:end}.pp-order-trains label,.pp-order-discounts label{display:grid;gap:3px;color:var(--muted);font-size:12px}.pp-order-discounts{display:grid;gap:4px}.pp-readonly-value{color:var(--text);white-space:nowrap}.pp-readonly-sub{display:block;color:var(--muted);font-size:12px;margin-top:3px}
    .pp-settings-nav,.pp-action-grid,.pp-report-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.pp-settings-nav{grid-column:span 12}.pp-member-card{grid-column:span 12}.pp-hidden{display:none!important}.pp-range-row{display:grid;grid-template-columns:auto minmax(140px,1fr) auto;gap:8px;align-items:center}.pp-analytics-scroll{max-height:min(64vh,620px);overflow:auto}.pp-analytics-scroll .pp-table th,.pp-analytics-scroll .pp-table td{text-align:center;padding-left:14px;padding-right:14px}.pp-past-scroll{max-height:430px;overflow:auto}.pp-stars{letter-spacing:1px;color:#5f6662}.pp-stars span{color:#FFDD00}.pp-table-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:12px 0 6px;color:#fff;font-weight:700}.pp-sort{border:0;background:transparent;color:var(--muted);font:inherit;font-weight:700;padding:0;cursor:pointer}.pp-sort.is-active{color:var(--accent)}.pp-card-count{align-self:center;color:var(--muted);font-size:12px}.pp-report-options label{display:flex;align-items:center;gap:6px;color:var(--muted)}.pp-training-pills{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}.pp-training-day{display:grid;gap:7px;align-items:start;border:1px solid var(--line);border-radius:8px;background:#121615;padding:8px}.pp-training-day strong{color:#fff}.pp-pill-list{display:flex;flex-wrap:wrap;gap:6px}.pp-percent-bar{position:relative;min-height:24px;border:1px solid var(--line);border-radius:7px;background-image:linear-gradient(90deg,rgba(255,255,255,.14) 1px,transparent 1px);background-size:10% 100%;background-color:#101312;overflow:hidden}.pp-percent-bar span{position:absolute;inset:0 auto 0 0;width:var(--percent);background:linear-gradient(90deg,var(--bad),var(--accent))}.pp-percent-bar b{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:12px;text-shadow:0 1px 2px #000}.pp-stock-summary{margin-bottom:12px}.pp-stock-summary .pp-stat strong{font-size:16px}.pp-stock-na{color:var(--muted);opacity:.6}.pp-stock-restock{display:grid;gap:2px}.pp-stock-restock b{color:#fff;font-size:12px;font-weight:700}.pp-stock-restock small{color:var(--muted);font-size:11px}.pp-modal-backdrop{position:absolute;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.58)}.pp-modal-card{width:min(720px,calc(100% - 24px));max-height:calc(100% - 24px);overflow:auto;box-shadow:0 18px 54px rgba(0,0,0,.5)}.pp-card-form{display:grid;gap:12px}.pp-card-section{border:1px solid var(--line);border-radius:8px;background:#121615;overflow:hidden}.pp-card-section summary{list-style:none}.pp-card-section summary::-webkit-details-marker{display:none}.pp-card-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;cursor:pointer}.pp-card-section[open] .pp-card-section-head{border-bottom:1px solid rgba(255,255,255,.08)}.pp-card-section-head h4{margin:0;color:#fff;font-size:13px;line-height:1.2}.pp-card-section-body{padding:12px}.pp-card-section-body .pp-form{gap:10px}.pp-history-stack{display:grid;gap:8px}.pp-history-item{border:1px solid var(--line);border-radius:8px;background:#101312}.pp-history-item summary{list-style:none;cursor:pointer;padding:10px 12px;color:#fff;font-weight:700}.pp-history-item summary::-webkit-details-marker{display:none}.pp-history-item[open] summary{border-bottom:1px solid rgba(255,255,255,.08)}.pp-history-body{padding:10px 12px}.pp-card-header-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .pp-pill{display:inline-flex;align-items:center;gap:6px;min-height:24px;padding:3px 8px;border-radius:999px;border:1px solid var(--line);background:#111313;color:var(--muted);white-space:nowrap}.pp-pill:before{content:'';width:7px;height:7px;border-radius:50%;background:var(--pill-color,var(--muted))}.pp-date-pill:before{display:none}
    .pp-changelog{display:grid;gap:8px}.pp-changelog details{border:1px solid var(--line);border-radius:8px;background:#121615;padding:8px}.pp-changelog summary{cursor:pointer;color:#fff;font-weight:700}.pp-changelog ul{margin:8px 0 0 18px;padding:0;color:var(--muted)}.pp-changelog li{margin:4px 0}.pp-role-history{display:grid;gap:8px;border:1px solid var(--line);border-radius:8px;background:#121615;padding:10px}.pp-role-history>div+div{border-top:1px solid rgba(255,255,255,.08);padding-top:8px}.pp-card-userid{font:inherit;color:var(--accent);text-decoration:none}.pp-card-userid:hover{text-decoration:underline}
    .pp-alerts{position:relative;z-index:6;display:grid;gap:6px;padding:8px 12px;border-bottom:1px solid var(--line);background:rgba(217,93,93,.08);box-shadow:0 8px 18px rgba(0,0,0,.18)}.pp-alerts.is-empty{padding:0;border:0;box-shadow:none;background:transparent;min-height:0}.pp-alert{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;color:var(--text);font-size:12px;text-align:left}.pp-alert strong{color:#fff}.pp-alert-main{display:block;width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:0;cursor:default}.pp-alert-main[data-action]{cursor:pointer}.pp-alert-main[data-action]:hover strong{text-decoration:underline}.pp-alert-dismiss{display:grid;place-items:center;width:24px;min-width:24px;height:24px;min-height:24px;border:1px solid var(--line);border-radius:6px;background:rgba(0,0,0,.16);color:var(--muted);padding:0;margin:0;cursor:pointer;line-height:1}.pp-alert-dismiss:hover{border-color:var(--accent);color:var(--accent);background:rgba(255,255,255,.04)}.pp-alert-icon,.pp-stock-mini-alert:before{display:inline-grid;place-items:center;width:18px;height:18px;clip-path:polygon(50% 0,100% 92%,0 92%);background:#d95d5d;color:#fff;font-weight:800;font-size:12px;line-height:1}.pp-alert.is-warn .pp-alert-icon{background:var(--warn);color:#111}.pp-alert.is-info .pp-alert-icon{background:var(--accent);color:#07100d}.pp-stock-mini-alert{display:none;align-items:center;gap:5px;color:#fff;font-size:12px;line-height:1.2}.pp-stock-mini-alert:before{content:'!';flex:0 0 18px}.pp-cis-minimized .pp-brand,.pp-popup-badge .pp-brand{flex-wrap:wrap}.pp-cis-minimized .pp-brand .pp-stock-mini-alert,.pp-popup-badge .pp-brand .pp-stock-mini-alert{display:flex;flex-basis:100%;margin-top:2px;padding-top:6px;border-top:1px solid var(--line)}
    .pp-cis-minimized .pp-brand .pp-stock-mini-alert{position:absolute;left:0;top:44px;display:flex;width:max-content;max-width:220px;height:auto;clip:auto;overflow:visible;white-space:nowrap;padding:5px 7px;margin:0;border:1px solid var(--bad);border-radius:8px;background:#1b1111;color:#fff;box-shadow:0 8px 18px rgba(0,0,0,.35)}
    .pp-training-day{align-content:start}.pp-pill-list{align-content:flex-start;align-items:flex-start;align-self:start;justify-content:flex-start}.pp-operational{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;margin:0 0 12px}.pp-operation-note{border:1px solid var(--line);border-radius:8px;background:#121615;padding:9px;color:var(--muted)}.pp-operation-note strong{display:block;color:#fff;font-size:16px}.pp-training-queue{display:grid;gap:7px;margin-bottom:12px;border:1px solid var(--line);border-radius:8px;background:#121615;padding:10px;color:var(--muted)}.pp-training-queue strong{color:#fff}.pp-training-queue-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.pp-training-queue-body{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}.pp-training-queue-list{overflow-wrap:anywhere}.pp-queue-toggle{display:grid;place-items:center;width:28px;min-width:28px;height:26px;min-height:26px;padding:0;margin:0}.pp-eye-icon{display:block;width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .pp-disabled-overlay{position:absolute;inset:0;z-index:30;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.42);backdrop-filter:blur(5px)}.pp-disabled-overlay .pp-empty{max-width:520px;border-color:rgba(217,93,93,.75);background:#1b1111;color:#fff}.pp-disabled-context .pp-body,.pp-disabled-context .pp-tabs,.pp-disabled-context .pp-alerts{filter:blur(2px);pointer-events:none;user-select:none}
    .pp-theme-section{grid-column:1/-1;display:grid;gap:10px;min-width:0;border:1px solid var(--line);border-radius:8px;background:#121615;padding:10px}.pp-theme-section-head{display:grid;gap:3px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.07)}.pp-theme-section h4{margin:0;color:#fff;font-size:13px;line-height:1.25}.pp-theme-section p{margin:0;color:var(--muted);font-size:12px}.pp-theme-section-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;align-items:end}.pp-theme-section-grid .pp-field,.pp-theme-section-grid .pp-field.span-2{grid-column:auto}.pp-theme-editor{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:10px}.pp-theme-swatch{display:grid;gap:5px}.pp-theme-dirty{border-color:var(--warn)!important}.pp-role-table .pp-inline{max-width:220px}.pp-compact-field .pp-input,.pp-compact-field .pp-select{width:auto;min-width:12ch;max-width:min(260px,calc(100% - 8px))}.pp-api-key{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.pp-api-key .pp-input{flex:0 1 260px;max-width:min(260px,calc(100% - 84px))}.pp-align-top{align-self:start}.pp-identity-settings{align-items:start}.pp-identity-settings>.pp-field{align-self:start}.pp-identity-settings>.pp-field:not(.span-6){border-right:1px solid var(--line);padding-right:10px}.pp-date-format-control{display:grid;gap:6px;align-items:start}.pp-date-format-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.pp-date-format-row .pp-note{margin:0}
    .pp-graph-panel{display:grid;gap:10px}.pp-graph-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap}.pp-graph-stage{display:grid;grid-template-columns:repeat(var(--graph-cols,12),minmax(28px,1fr));gap:8px;align-items:end;min-height:190px;padding:12px;border:1px solid var(--line);border-radius:8px;background:#121615}.pp-bar{display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:6px;align-items:end;min-width:0}.pp-bar b{display:block;color:var(--text);font-size:11px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pp-bar span{display:block;height:max(4px,var(--bar));border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,var(--bar-color,var(--accent)),rgba(255,255,255,.12));box-shadow:0 0 0 1px rgba(255,255,255,.08) inset}.pp-bar small{display:block;color:var(--muted);font-size:10px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pp-series-controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.pp-series-toggle{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:3px 7px;border:1px solid var(--line);border-radius:6px;background:#111313;color:var(--muted);white-space:nowrap}.pp-series-toggle i{width:10px;height:10px;border-radius:50%;background:var(--series-color)}.pp-line-chart{border:1px solid var(--line);border-radius:8px;background:#121615;padding:10px;overflow-x:auto}.pp-line-svg{display:block;width:100%;min-width:760px;height:auto}.pp-line-grid{stroke:rgba(255,255,255,.08);stroke-width:1}.pp-line-axis{stroke:rgba(255,255,255,.24);stroke-width:1.2}.pp-line-axis-label{fill:var(--muted);font-size:15px;font-weight:700}.pp-line-y{fill:var(--muted);font-size:15px}.pp-line-y.left{text-anchor:end}.pp-line-y.right{text-anchor:start}.pp-line-zero{stroke:rgba(255,221,0,.32);stroke-width:1;stroke-dasharray:5 5}.pp-line-path{fill:none;stroke:var(--series-color);stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.pp-line-path.is-count{stroke-dasharray:8 7;opacity:.72}.pp-line-point{fill:#121615;stroke:var(--series-color);stroke-width:3}.pp-line-point.is-count{stroke-width:2.4;opacity:.86}.pp-line-label{fill:var(--text);font-size:16px;text-anchor:middle;paint-order:stroke;stroke:#121615;stroke-width:4;stroke-linejoin:round}.pp-line-label.is-count{font-size:14px;opacity:.82}.pp-line-x{fill:var(--muted);font-size:15px;text-anchor:middle}.pp-balance-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.pp-balance-table th,.pp-balance-table td{text-align:center;white-space:nowrap}.pp-balance-table td:nth-child(2){text-align:left}
    .pp-statline{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.pp-stat{min-height:58px;border:1px solid var(--line);border-radius:8px;background:#121615;padding:10px}.pp-stat small{display:block;color:var(--muted);margin-bottom:3px}.pp-stat strong{display:block;font-size:18px;color:#fff;overflow-wrap:anywhere}
.pp-calendar{display:grid;grid-template-columns:repeat(7,minmax(140px,1fr));gap:8px;overflow-x:auto}.pp-day{display:grid;align-content:start;gap:8px;min-width:0;min-height:132px;border:1px solid var(--line);border-radius:8px;background:#121615;padding:9px}.pp-day-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px}.pp-day-head h4{margin:0;font:700 12px/1.25 Arial,Helvetica,sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pp-day-reset{display:grid;place-items:center;width:26px;min-width:26px;height:24px;min-height:24px;padding:0;margin:0;color:var(--accent);border-color:var(--accent)}.pp-day-table{width:100%;border-collapse:collapse;table-layout:fixed}.pp-day-table td{padding:4px 3px;border-top:1px solid rgba(255,255,255,.06);vertical-align:middle;color:var(--muted)}.pp-day-table td:first-child{width:36px;text-align:right;padding-right:6px}.pp-day-table td:last-child{width:34px;text-align:right}.pp-day-row.is-active td{color:#fff;background:rgba(70,197,143,.13);box-shadow:0 1px 0 rgba(70,197,143,.42) inset,0 -1px 0 rgba(70,197,143,.42) inset}.pp-day-row.is-active td:first-child{border-radius:6px 0 0 6px}.pp-day-row.is-active td:last-child{border-radius:0 6px 6px 0}.pp-day-name{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pp-day-table .pp-name{width:100%;max-width:100%;margin:0}.pp-contract-badge{display:inline-grid;place-items:center;width:24px;height:22px;border:1px solid var(--badge-color,var(--line));border-radius:6px;background:rgba(255,255,255,.04);color:var(--badge-color,var(--text));font-weight:800;font-size:11px;line-height:1}.pp-train-controls{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;align-items:center;margin-top:2px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08)}.pp-train-controls .pp-btn{min-width:34px;padding-left:9px;padding-right:9px}.pp-torn-train-glow{box-shadow:0 0 0 2px #FFDD00,0 0 20px rgba(255,221,0,.72)!important;border-radius:7px!important;position:relative!important;z-index:5!important;outline:1px solid rgba(255,221,0,.8)!important}
    #pythagoras-cis .pp-head h2,#pythagoras-cis .pp-head h3{font:700 14px/1.25 Arial,Helvetica,sans-serif!important;margin:0!important;color:#fff!important}#pythagoras-cis .pp-day-head h4{font:700 12px/1.25 Arial,Helvetica,sans-serif!important;margin:0!important;color:#fff!important;letter-spacing:0!important;text-transform:none!important}#pythagoras-cis .pp-tab,#pythagoras-cis .pp-subtab,#pythagoras-cis .pp-btn{font:13px/1.45 Arial,Helvetica,sans-serif!important;text-transform:none!important;letter-spacing:0!important}
    .pp-timeline{display:grid;gap:8px;max-height:min(64vh,620px);overflow:auto;padding-right:4px}.pp-timeline-panel .pp-content,.pp-analytics-panel .pp-content{min-height:min(64vh,620px)}.pp-event{display:grid;gap:4px;padding:9px 10px;border-left:3px solid var(--event-color,var(--muted));background:#121615;border-radius:0 6px 6px 0}.pp-event time{color:var(--muted);font-size:12px}.pp-event strong{color:#fff}
    .pp-kv{display:grid;grid-template-columns:minmax(110px,.8fr) minmax(0,1.2fr);gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)}.pp-kv>span:first-child{color:var(--muted)}
    .pp-toast{position:absolute;right:12px;bottom:12px;max-width:min(420px,calc(100vw - 36px));border:1px solid rgba(70,197,143,.55);border-radius:8px;background:#102019;color:#effff8;padding:10px 12px;box-shadow:0 12px 28px rgba(0,0,0,.35);z-index:20}.pp-toast-confirm{display:grid;gap:8px;border-color:rgba(216,165,69,.75);background:#20180d}.pp-toast-confirm strong{color:#fff}.pp-toast-actions{display:flex;gap:6px;flex-wrap:wrap}.pp-empty{color:var(--muted);padding:12px;border:1px dashed var(--line);border-radius:8px;background:#111313}
    .good{color:var(--accent)}.bad{color:var(--bad)}.warn{color:var(--warn)}
    .pp-effectiveness-tip{display:inline-flex;align-items:center;justify-content:center;min-width:2ch;color:inherit;cursor:help;text-decoration:underline dotted transparent;text-underline-offset:2px}.pp-effectiveness-tip.is-left{justify-content:flex-start;text-align:left;min-width:0}.pp-effectiveness-tip:hover,.pp-effectiveness-tip:focus-visible{text-decoration-color:var(--accent);outline:none}
    .pp-hover-tooltip{position:fixed;left:0;top:0;z-index:1000001;min-width:220px;max-width:min(320px,calc(100vw - 16px));padding:10px 11px;border:1px solid var(--tip-accent,#46c58f);border-radius:8px;background:var(--tip-panel,#171a1a);color:var(--tip-text,#eff2ef);box-shadow:0 14px 30px rgba(0,0,0,.38),0 0 0 1px rgba(255,255,255,.04) inset;pointer-events:none}
    .pp-hover-tooltip-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:7px;margin-bottom:7px;border-bottom:1px solid rgba(255,255,255,.08)}
    .pp-hover-tooltip-head strong{color:#fff;font-size:12px;line-height:1.2}
    .pp-hover-tooltip-total{color:var(--tip-accent,#46c58f);font-weight:700}
    .pp-hover-tooltip-list{display:grid;gap:6px}
    .pp-hover-tooltip-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}
    .pp-hover-tooltip-key{color:var(--tip-muted,#a8b0aa)}
    .pp-hover-tooltip-value{font-weight:700;color:var(--tip-text,#eff2ef)}
    .pp-hover-tooltip-value.is-good{color:var(--tip-accent,#46c58f)}
    .pp-hover-tooltip-value.is-warn{color:var(--tip-warn,#d8a545)}
    .pp-hover-tooltip-value.is-bad{color:var(--tip-bad,#d95d5d)}
    .pp-hover-tooltip-empty{color:var(--tip-muted,#a8b0aa)}
    @media (max-width:860px){#pythagoras-cis{top:8px;right:8px;left:8px!important;width:auto;max-height:calc(100vh - 16px);resize:none}.pp-titlebar{grid-template-columns:1fr;cursor:default}.pp-actions{justify-content:flex-start}.pp-panel.is-half,.pp-panel.is-third{grid-column:span 12}.pp-form{grid-template-columns:repeat(2,minmax(0,1fr))}.pp-field.span-2,.pp-field.span-3,.pp-field.span-4,.pp-field.span-6,.pp-settings-nav,.pp-action-grid,.pp-report-options{grid-column:span 2}.pp-statline,.pp-settings-nav,.pp-action-grid,.pp-report-options,.pp-operational,.pp-theme-editor{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media (max-width:860px){.pp-sync-center{grid-template-columns:1fr}.pp-sync-console{max-height:150px}}
    @media (max-width:560px){#pythagoras-cis{top:0;right:0;left:0!important;width:100vw;max-height:100vh;border-radius:0}.pp-body{padding:8px}.pp-head{padding:14px 76px 12px 10px}.pp-grid,.pp-ledger-add-form,.pp-statline,.pp-operational,.pp-settings-nav,.pp-action-grid,.pp-report-options,.pp-theme-editor{grid-template-columns:1fr}.pp-field,.pp-field.span-2,.pp-field.span-3,.pp-field.span-4,.pp-field.span-6,.pp-ledger-preview-field{grid-column:span 1}.pp-ledger-add-form .pp-input,.pp-ledger-add-form .pp-select{width:calc(100vw - 44px);max-width:calc(100vw - 44px)}.pp-calendar{grid-template-columns:1fr;overflow-x:visible}.pp-table{min-width:680px}.pp-modal-card{width:calc(100vw - 16px);max-height:calc(100vh - 16px)}}
  `;

  const Utils = {
    clone(value) { return JSON.parse(JSON.stringify(value)); },
    nowIso() { return new Date().toISOString(); },
    id(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; },
    bytesToBase64Url(bytes) {
      const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
      let binary = '';
      for (let index = 0; index < source.length; index += 0x8000) {
        binary += String.fromCharCode.apply(null, source.subarray(index, index + 0x8000));
      }
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    },
    base64UrlToBytes(value) {
      const raw = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
      const padded = raw + '='.repeat((4 - raw.length % 4) % 4);
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return bytes;
    },
    esc(value) {
      return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },
    safeNewsHtml(value) {
      const template = document.createElement('template');
      template.innerHTML = String(value == null ? '' : value);
      const allowed = new Set(['A', 'BR', 'B', 'STRONG', 'I', 'EM']);

      const clean = (node) => {
        Array.from(node.childNodes).forEach((child) => {
          if (child.nodeType === Node.COMMENT_NODE) {
            child.remove();
            return;
          }
          if (child.nodeType !== Node.ELEMENT_NODE) return;

          clean(child);
          if (!allowed.has(child.tagName)) {
            child.replaceWith(...Array.from(child.childNodes));
            return;
          }

          if (child.tagName === 'A') {
            const href = child.getAttribute('href') || '';
            Array.from(child.attributes).forEach((attribute) => child.removeAttribute(attribute.name));
            if (/^(https?:\/\/)?(www\.)?torn\.com\//i.test(href) || /^\/.+/.test(href)) {
              child.setAttribute('href', href);
              child.setAttribute('target', '_blank');
              child.setAttribute('rel', 'noopener noreferrer');
            }
            return;
          }

          Array.from(child.attributes).forEach((attribute) => child.removeAttribute(attribute.name));
        });
      };

      clean(template.content);
      return template.innerHTML;
    },
    int(value, fallback) {
      const number = Number(String(value == null ? '' : value).replace(/[^\d.-]/g, ''));
      return Number.isFinite(number) ? Math.trunc(number) : fallback;
    },
    num(value, fallback) {
      const number = Number(String(value == null ? '' : value).replace(/[^\d.-]/g, ''));
      return Number.isFinite(number) ? number : fallback;
    },
    percent(value, fallback) { return Math.max(0, Math.min(100, Utils.num(value, fallback))); },
    money(value) { return `$${Math.round(Number(value || 0)).toLocaleString('en-US')}`; },
    compactNumber(value) {
      const number = Number(value || 0);
      const sign = number < 0 ? '-' : '';
      const abs = Math.abs(number);
      if (abs >= 1000000000) return `${sign}${(abs / 1000000000).toFixed(abs >= 10000000000 ? 0 : 1).replace(/\.0$/, '')}B`;
      if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(abs >= 10000000 ? 0 : 1).replace(/\.0$/, '')}M`;
      if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
      return `${sign}${Math.round(abs).toLocaleString('en-US')}`;
    },
    compactMoney(value) {
      const number = Number(value || 0);
      return `${number < 0 ? '-' : ''}$${Utils.compactNumber(Math.abs(number))}`;
    },
    formatNumber(value) {
      const number = Utils.num(value, 0);
      return Math.round(number).toLocaleString('en-US');
    },
    startCase(value) {
      return String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    },
    maskKey(value) {
      const key = String(value || '');
      if (key.length <= 8) return key ? '*'.repeat(key.length) : '';
      return `${key.slice(0, 4)}${'*'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`;
    },
    formatPlainNumber(value) {
      const number = Utils.num(value, 0);
      return number ? Math.round(number).toLocaleString('en-US') : '';
    },
    fileTimestamp(value) {
      const date = value ? new Date(value) : new Date();
      const pad = (number) => String(number).padStart(2, '0');
      return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    },
    dateFormatOptions() {
      return [
        ['locale-medium', 'System locale (Apr 11, 2026)'],
        ['dmy-slash', 'DD/MM/YYYY'],
        ['mdy-slash', 'MM/DD/YYYY'],
        ['ymd-dash', 'YYYY-MM-DD'],
        ['dmy-dot', 'DD.MM.YYYY'],
        ['long', '11 April 2026'],
        ['custom', 'Custom']
      ];
    },
    formatDateWithSettings(value, settings, includeTime) {
      if (!value) return 'Not set';
      const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
      if (Number.isNaN(date.getTime())) return 'Not set';
      const mode = settings && settings.dateFormat ? settings.dateFormat : 'locale-medium';
      const pad = (number) => String(number).padStart(2, '0');
      const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthsLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const values = {
        YYYY: date.getFullYear(),
        YY: String(date.getFullYear()).slice(-2),
        MMMM: monthsLong[date.getMonth()],
        MMM: monthsShort[date.getMonth()],
        MM: pad(date.getMonth() + 1),
        DD: pad(date.getDate()),
        D: date.getDate(),
        HH: pad(date.getHours()),
        mm: pad(date.getMinutes())
      };
      const custom = (settings && settings.customDateFormat ? settings.customDateFormat : 'DD MMM YYYY').replace(/[^A-Za-z0-9 /.,:()[\]-]/g, '').slice(0, 40) || 'DD MMM YYYY';
      let text;
      if (mode === 'dmy-slash') text = `${values.DD}/${values.MM}/${values.YYYY}`;
      else if (mode === 'mdy-slash') text = `${values.MM}/${values.DD}/${values.YYYY}`;
      else if (mode === 'ymd-dash') text = `${values.YYYY}-${values.MM}-${values.DD}`;
      else if (mode === 'dmy-dot') text = `${values.DD}.${values.MM}.${values.YYYY}`;
      else if (mode === 'long') text = `${values.D} ${values.MMMM} ${values.YYYY}`;
      else if (mode === 'custom') text = custom.replace(/YYYY|MMMM|MMM|YY|MM|DD|D|HH|mm/g, (token) => values[token]);
      else text = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
      return includeTime && !/HH|mm/.test(mode === 'custom' ? custom : '') ? `${text}, ${values.HH}:${values.mm}` : text;
    },
    pick(source, keys, fallback) {
      if (!source) return fallback;
      for (const key of keys) {
        if (source[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
      }
      return fallback;
    },
    dateShort(value) {
      if (!value) return 'Not set';
      return Utils.formatDateWithSettings(value, UI && UI.state ? UI.state.settings : DEFAULTS.settings, false);
    },
    dateNoYear(value) {
      if (!value) return 'Not set';
      const raw = String(value);
      const date = typeof value === 'number' || /^\d+$/.test(raw)
        ? new Date(Utils.int(value, 0) * 1000)
        : (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(value));
      return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    },
    dateMonthDay(value) {
      if (!value) return 'Not set';
      const raw = String(value);
      const date = typeof value === 'number' || /^\d+$/.test(raw)
        ? new Date(Utils.int(value, 0) * 1000)
        : (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(value));
      if (Number.isNaN(date.getTime())) return 'Not set';
      const pad = (number) => String(number).padStart(2, '0');
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    },
    dateTime(value) {
      if (!value) return 'Not set';
      return Utils.formatDateWithSettings(value, UI && UI.state ? UI.state.settings : DEFAULTS.settings, true);
    },
    dateObject(value) {
      if (!value) return null;
      const raw = String(value);
      const date = typeof value === 'number' || /^\d+$/.test(raw)
        ? new Date(Utils.int(value, 0) * 1000)
        : (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(value));
      return Number.isNaN(date.getTime()) ? null : date;
    },
    weekdayShort(value) {
      const date = Utils.dateObject(value);
      return date ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()] : '';
    },
    weekdayName(value) {
      const date = Utils.dateObject(value);
      return date ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()] : '';
    },
    yearMonthAge(startValue, endValue) {
      const start = Utils.dateObject(startValue);
      const end = Utils.dateObject(endValue || new Date());
      if (!start || !end || start > end) return '';
      let years = end.getFullYear() - start.getFullYear();
      let months = end.getMonth() - start.getMonth();
      if (end.getDate() < start.getDate()) months -= 1;
      if (months < 0) { years -= 1; months += 12; }
      years = Math.max(0, years);
      months = Math.max(0, months);
      const parts = [];
      if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`);
      if (months) parts.push(`${months} month${months === 1 ? '' : 's'}`);
      return parts.length ? parts.join(' ') : 'Under 1 month';
    },
    dateFromParts(year, month, day) {
      if (year > 99 && year < 1000) return '';
      const fullYear = year < 100 ? 2000 + year : year;
      const date = new Date(fullYear, month - 1, day, 12);
      if (date.getFullYear() !== fullYear || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
      return date.toISOString().slice(0, 10);
    },
    dateInputFromText(value, settings) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
      if (/^\d+$/.test(raw)) return Utils.dateInput(raw);
      const mode = settings && settings.dateFormat ? settings.dateFormat : 'locale-medium';
      const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      const dot = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
      const dash = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (dash) return Utils.dateFromParts(Utils.int(dash[1], 0), Utils.int(dash[2], 0), Utils.int(dash[3], 0));
      if (slash && mode === 'dmy-slash') return Utils.dateFromParts(Utils.int(slash[3], 0), Utils.int(slash[2], 0), Utils.int(slash[1], 0));
      if (slash && mode === 'mdy-slash') return Utils.dateFromParts(Utils.int(slash[3], 0), Utils.int(slash[1], 0), Utils.int(slash[2], 0));
      if (dot) return Utils.dateFromParts(Utils.int(dot[3], 0), Utils.int(dot[2], 0), Utils.int(dot[1], 0));
      if (slash) return Utils.dateFromParts(Utils.int(slash[3], 0), Utils.int(slash[2], 0), Utils.int(slash[1], 0)) || Utils.dateFromParts(Utils.int(slash[3], 0), Utils.int(slash[1], 0), Utils.int(slash[2], 0));
      return Utils.dateInput(raw);
    },
    dateInput(value) {
      if (!value) return '';
      const raw = String(value);
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
      const date = /^\d+$/.test(raw) ? new Date(Utils.int(raw, 0) * 1000) : new Date(raw);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
    },
    dayKey(value) {
      const date = typeof value === 'number' || /^\d+$/.test(String(value || '')) ? new Date(Utils.int(value, 0) * 1000) : new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
    },
    tctWorkingDayKey(value) {
      const date = value ? new Date(value) : new Date();
      if (Number.isNaN(date.getTime())) return Utils.todayInput();
      const working = new Date(date.getTime());
      const reportResetMinutes = (18 * 60) + 10;
      const currentMinutes = (working.getUTCHours() * 60) + working.getUTCMinutes();
      if (currentMinutes < reportResetMinutes) working.setUTCDate(working.getUTCDate() - 1);
      const year = working.getUTCFullYear();
      const month = String(working.getUTCMonth() + 1).padStart(2, '0');
      const day = String(working.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
    dateTimestamp(value) {
      if (!value) return 0;
      const raw = String(value);
      const date = typeof value === 'number' || /^\d+$/.test(raw) ? new Date(Utils.int(value, 0) * 1000) : new Date(raw);
      return Number.isNaN(date.getTime()) ? 0 : Math.floor(date.getTime() / 1000);
    },
    daysBetween(start, end) {
      if (!start || !end) return 0;
      const startDate = typeof start === 'number' || /^\d+$/.test(String(start)) ? new Date(Utils.int(start, 0) * 1000) : new Date(start);
      const endDate = typeof end === 'number' || /^\d+$/.test(String(end)) ? new Date(Utils.int(end, 0) * 1000) : new Date(end);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
      return Math.max(0, Math.floor((endDate - startDate) / 86400000) + 1);
    },
    todayInput() { return new Date().toISOString().slice(0, 10); },
    addDays(dateText, offset) {
      const date = dateText ? new Date(`${dateText}T12:00:00`) : new Date();
      date.setDate(date.getDate() + offset);
      return date.toISOString().slice(0, 10);
    },
    clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
    isoWeekInfo(date) {
      const working = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const day = working.getUTCDay() || 7;
      working.setUTCDate(working.getUTCDate() + 4 - day);
      const start = new Date(Date.UTC(working.getUTCFullYear(), 0, 1));
      return {
        week: Math.ceil((((working - start) / 86400000) + 1) / 7),
        year: working.getUTCFullYear()
      };
    },
    isoWeek(date) {
      return Utils.isoWeekInfo(date).week;
    },
    isoWeekYear(date) {
      return Utils.isoWeekInfo(date).year;
    },
    weekRange(date) {
      const start = new Date(date);
      const day = start.getDay() || 7;
      start.setDate(start.getDate() - day + 1);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const settings = UI && UI.state ? UI.state.settings : DEFAULTS.settings;
      return `${Utils.formatDateWithSettings(start, settings, false)} -> ${Utils.formatDateWithSettings(end, settings, false)}`;
    },
    timeAgo(timestamp) {
      const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Utils.int(timestamp, 0));
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const parts = [];
      if (days) parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);
      if (hours) parts.push(`${hours}hrs`);
      if (minutes || !parts.length) parts.push(`${minutes} minutes`);
      return parts.join(', ');
    },
    copy(text) {
      const value = String(text || '');
      try {
        if (typeof GM_setClipboard === 'function') {
          GM_setClipboard(value, 'text');
          return Promise.resolve();
        }
      } catch (error) {}
      try {
        if (typeof GM !== 'undefined' && GM && typeof GM.setClipboard === 'function') {
          return Promise.resolve(GM.setClipboard(value, 'text'));
        }
      } catch (error) {}
      const fallback = () => {
        const box = document.createElement('textarea');
        box.value = value; box.style.position = 'fixed'; box.style.left = '-9999px';
        document.body.appendChild(box); box.select(); document.execCommand('copy'); box.remove();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(value).catch(() => {
          fallback();
        });
      }
      fallback();
      return Promise.resolve();
    },
    download(filename, body, type) {
      const blob = new Blob([body], { type: type || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    },
    sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, Math.max(0, Utils.int(ms, 0))));
    }
  };

  const Store = {
    localSaveSeq: 0,
    load() {
      const profile = Store.loadProfile();
      const state = Store.applyProfile(Store.applyAdminConfig(Store.migrate(Utils.clone(DEFAULTS))), profile);
      return Store.applyNotificationDismissals(Store.applyLedgerPending(Store.applyStaffEditCache(state, Store.loadStaffLocalEdits()), Store.loadLedgerPending()), Store.loadNotificationDismissals());
    },
    async loadAsync() {
      const profile = await Store.loadProfileAsync();
      let state = Store.applyProfile(Store.applyAdminConfig(Store.migrate(Utils.clone(DEFAULTS))), profile);
      const staffEditCache = await Store.loadStaffLocalEditsAsync();
      const ledgerPending = await Store.loadLedgerPendingAsync();
      const legacyRaw = await Store.rawGetAsync(APP.storageKey);
      if (legacyRaw) {
        const legacy = Store.loadFromRaw(legacyRaw);
        state = Store.applyProfile(legacy, profile || Store.profileFromState(legacy));
        const migrated = await Store.migrateLegacyLocalState(state).catch((error) => {
          console.warn('[Pythagoras Project - CIS] Legacy cloud migration failed.', error);
          return false;
        });
        if (migrated) {
          Store.rawDelete(APP.storageKey);
          Store.rawDelete(APP.companiesKey);
        }
      }
      state.settings.userId = state.settings.userId || PageData.userId();
      state.settings.userName = state.settings.userName || PageData.userName();
      state.settings.companyId = state.settings.companyId || state.company.profile.id || PageData.companyId();
      state = Store.applyLedgerPending(Store.applyStaffEditCache(state, staffEditCache), ledgerPending);
      const cloudState = await Store.loadCloudWorkspace(state);
      return Store.applyNotificationDismissals(Store.applyLedgerPending(Store.applySyncCache(cloudState), ledgerPending), await Store.loadNotificationDismissalsAsync());
    },
    loadProfile() {
      const raw = Store.rawGet(APP.profileKey);
      if (!raw) return null;
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] Could not read local profile.', error);
        return null;
      }
    },
    async loadProfileAsync() {
      const raw = await Store.rawGetAsync(APP.profileKey);
      if (!raw) return null;
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] Could not read local profile.', error);
        return null;
      }
    },
    parseStaffLocalEdits(raw) {
      if (!raw) return { localEdits: {}, localEditVersion: 0 };
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const edits = parsed && parsed.localEdits && typeof parsed.localEdits === 'object' && !Array.isArray(parsed.localEdits) ? parsed.localEdits : {};
        return {
          localEdits: edits,
          localEditVersion: Utils.int(parsed && parsed.localEditVersion, 0)
        };
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] Could not read pending staff-card edits.', error);
        return { localEdits: {}, localEditVersion: 0 };
      }
    },
    loadStaffLocalEdits() {
      return Store.parseStaffLocalEdits(Store.rawGet(APP.staffEditsKey));
    },
    async loadStaffLocalEditsAsync() {
      return Store.parseStaffLocalEdits(await Store.rawGetAsync(APP.staffEditsKey));
    },
    applyStaffEditCache(state, cache) {
      const data = cache && typeof cache === 'object' ? cache : {};
      state.staff = state.staff || Utils.clone(DEFAULTS.staff);
      state.staff.localEdits = data.localEdits && typeof data.localEdits === 'object' && !Array.isArray(data.localEdits) ? data.localEdits : {};
      state.staff.localEditVersion = Utils.int(data.localEditVersion, 0);
      return state;
    },
    saveStaffLocalEdits(state) {
      const edits = state && state.staff && state.staff.localEdits && typeof state.staff.localEdits === 'object' && !Array.isArray(state.staff.localEdits) ? state.staff.localEdits : {};
      const payload = {
        localEdits: edits,
        localEditVersion: Utils.int(state && state.staff && state.staff.localEditVersion, 0),
        updatedAt: Utils.nowIso()
      };
      if (!Object.keys(edits).length) {
        Store.rawDelete(APP.staffEditsKey);
        return;
      }
      Store.rawSet(APP.staffEditsKey, JSON.stringify(payload));
    },
    clearStaffLocalEdits() {
      Store.rawDelete(APP.staffEditsKey);
    },
    ledgerOrderKey(entry) {
      return String(entry && (entry.orderId || entry.id) || '').trim();
    },
    mergeLedgerRows(base, extra) {
      const byKey = new Map();
      const noKey = [];
      const add = (entry) => {
        if (!entry || typeof entry !== 'object') return;
        const row = Object.assign({}, entry);
        const key = Store.ledgerOrderKey(row);
        if (!key) {
          noKey.push(row);
          return;
        }
        byKey.set(key, Object.assign({}, byKey.get(key) || {}, row));
      };
      (base || []).forEach(add);
      (extra || []).forEach(add);
      return Array.from(byKey.values()).concat(noKey).sort((a, b) => {
        const first = Utils.dateTimestamp(a.entryDate || a.createdAt || a.updatedAt);
        const second = Utils.dateTimestamp(b.entryDate || b.createdAt || b.updatedAt);
        return first - second || String(a.orderId || a.id || '').localeCompare(String(b.orderId || b.id || ''));
      });
    },
    normaliseAdBudgetHistory(rows) {
      const byDate = new Map();
      (Array.isArray(rows) ? rows : []).forEach((raw) => {
        if (!raw || typeof raw !== 'object') return;
        const budget = Utils.num(raw.advertisingBudget ?? raw.advertisement_budget ?? raw.adBudget ?? raw.budget ?? raw.value, null);
        if (budget === null || budget < 0) return;
        const rawMeta = raw.raw && typeof raw.raw === 'object' && !Array.isArray(raw.raw) ? raw.raw : {};
        const known = budget > 0
          || raw.advertisingBudgetKnown === true
          || raw.known === true
          || raw.explicit === true
          || raw.explicitZero === true
          || rawMeta.advertisingBudgetKnown === true
          || rawMeta.known === true
          || rawMeta.explicit === true
          || rawMeta.explicitZero === true;
        if (budget === 0 && !known) return;
        const observedAt = String(raw.observedAt || raw.observed_at || raw.syncedAt || raw.synced_at || raw.at || raw.created_at || '').trim() || Utils.nowIso();
        const date = Utils.dateInput(raw.date || raw.observedDate || raw.observed_date || observedAt);
        if (!date) return;
        const row = {
          date,
          observedAt,
          advertisingBudget: Math.round(budget),
          advertisingBudgetKnown: known,
          source: String(raw.source || 'business-sync').trim() || 'business-sync'
        };
        const existing = byDate.get(date);
        if (!existing || Utils.dateTimestamp(row.observedAt) >= Utils.dateTimestamp(existing.observedAt)) byDate.set(date, row);
      });
      return Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    },
    mergeAdBudgetHistory(base, extra) {
      return Store.normaliseAdBudgetHistory([].concat(Array.isArray(base) ? base : [], Array.isArray(extra) ? extra : []));
    },
    stockSettingKey(value) {
      return String(value || '').trim();
    },
    normaliseStockSettings(settings) {
      const source = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
      const next = {};
      Object.entries(source).forEach(([rawKey, raw]) => {
        const key = Store.stockSettingKey(rawKey);
        if (!key || !raw || typeof raw !== 'object' || Array.isArray(raw)) return;
        next[key] = {
          needsStock: !!raw.needsStock,
          warningMode: raw.warningMode === 'amount' ? 'amount' : 'percent',
          warningPercent: Utils.percent(raw.warningPercent, 10),
          warningAmount: Math.max(0, Utils.num(raw.warningAmount, 0)),
          restockQty: raw.restockQty === '' || raw.restockQty === null || raw.restockQty === undefined ? '' : Math.max(0, Utils.num(raw.restockQty, 0)),
          updatedAt: String(raw.updatedAt || '')
        };
      });
      return next;
    },
    stockSettingsFromItems(items, existing) {
      const next = Store.normaliseStockSettings(existing || {});
      (Array.isArray(items) ? items : []).forEach((item) => {
        const key = Store.stockSettingKey(item && item.key);
        if (!key) return;
        next[key] = {
          needsStock: !!(item && item.needsStock),
          warningMode: item && item.warningMode === 'amount' ? 'amount' : 'percent',
          warningPercent: Utils.percent(item && item.warningPercent, 10),
          warningAmount: Math.max(0, Utils.num(item && item.warningAmount, 0)),
          restockQty: item && item.restockQty !== '' && item.restockQty !== null && item.restockQty !== undefined ? Math.max(0, Utils.num(item.restockQty, 0)) : '',
          updatedAt: Utils.nowIso()
        };
      });
      return next;
    },
    applyStockSettings(state) {
      if (!state || !state.company || !state.company.stock) return state;
      const settings = Store.normaliseStockSettings(state.company.stockSettings || {});
      state.company.stockSettings = settings;
      state.company.stock.items = (state.company.stock.items || []).map((item) => {
        const saved = settings[Store.stockSettingKey(item && item.key)];
        if (!saved) return item;
        const restockable = Company.isRestockableStock(item);
        return Object.assign({}, item, {
          needsStock: restockable ? !!saved.needsStock : false,
          warningMode: saved.warningMode === 'amount' ? 'amount' : 'percent',
          warningPercent: Utils.percent(saved.warningPercent, 10),
          warningAmount: Math.max(0, Utils.num(saved.warningAmount, 0)),
          restockQty: restockable ? saved.restockQty : ''
        });
      });
      return state;
    },
    parseLedgerPending(raw) {
      if (!raw) return { orders: [], updatedAt: '' };
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return {
          orders: Array.isArray(parsed && parsed.orders) ? parsed.orders : [],
          updatedAt: String(parsed && parsed.updatedAt || '')
        };
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] Could not read pending ledger orders.', error);
        return { orders: [], updatedAt: '' };
      }
    },
    loadLedgerPending() {
      return Store.parseLedgerPending(Store.rawGet(APP.ledgerPendingKey));
    },
    async loadLedgerPendingAsync() {
      return Store.parseLedgerPending(await Store.rawGetAsync(APP.ledgerPendingKey));
    },
    saveLedgerPendingOrders(orders) {
      const rows = Array.isArray(orders) ? orders : [];
      if (!rows.length) {
        Store.rawDelete(APP.ledgerPendingKey);
        return;
      }
      Store.rawSet(APP.ledgerPendingKey, JSON.stringify({ orders: rows, updatedAt: Utils.nowIso() }));
    },
    clearLedgerPending() {
      Store.rawDelete(APP.ledgerPendingKey);
    },
    parseNotificationDismissals(raw) {
      if (!raw) return {};
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const source = parsed && parsed.dismissedNotifications && typeof parsed.dismissedNotifications === 'object' && !Array.isArray(parsed.dismissedNotifications)
          ? parsed.dismissedNotifications
          : parsed;
        const currentDay = Utils.tctWorkingDayKey();
        const next = {};
        Object.entries(source && typeof source === 'object' && !Array.isArray(source) ? source : {}).forEach(([key, value]) => {
          if (String(value || '') === currentDay) next[String(key)] = currentDay;
        });
        return next;
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] Could not read notification dismissals.', error);
        return {};
      }
    },
    loadNotificationDismissals() {
      return Store.parseNotificationDismissals(Store.rawGet(APP.notificationDismissalsKey));
    },
    async loadNotificationDismissalsAsync() {
      return Store.parseNotificationDismissals(await Store.rawGetAsync(APP.notificationDismissalsKey));
    },
    saveNotificationDismissals(state) {
      const dismissed = Store.parseNotificationDismissals(state && state.dismissedNotifications || {});
      if (!Object.keys(dismissed).length) {
        Store.rawDelete(APP.notificationDismissalsKey);
        return;
      }
      Store.rawSet(APP.notificationDismissalsKey, JSON.stringify({ dismissedNotifications: dismissed, updatedAt: Utils.nowIso() }));
    },
    applyNotificationDismissals(state, dismissals) {
      if (!state) return state;
      state.dismissedNotifications = Object.assign({}, Store.parseNotificationDismissals(state.dismissedNotifications || {}), Store.parseNotificationDismissals(dismissals || {}));
      return state;
    },
    applyLedgerPending(state, pending) {
      const rows = pending && Array.isArray(pending.orders) ? pending.orders : [];
      if (!rows.length) return state;
      state.ledger = Store.mergeLedgerRows(state.ledger || [], rows);
      return state;
    },
    profileFromState(state) {
      const settings = state && state.settings || {};
      const profile = state && state.company && state.company.profile || {};
      const rememberApiKey = settings.rememberApiKey !== false;
      return {
        apiKey: String(rememberApiKey ? settings.apiKey || '' : '').trim(),
        rememberApiKey,
        userId: String(settings.userId || PageData.userId() || '').trim(),
        username: String(settings.userName || settings.username || '').trim(),
        companyId: String(settings.companyId || profile.id || PageData.companyId() || '').trim(),
        localSettings: Store.localSettingsFromState(state)
      };
    },
    localSettingsFromState(state) {
      const settings = state && state.settings || {};
      const copy = Utils.clone(settings);
      delete copy.apiKey;
      delete copy.keyInfo;
      delete copy.userId;
      delete copy.userName;
      delete copy.username;
      delete copy.companyId;
      return copy;
    },
    applyLocalSettings(state, localSettings) {
      const values = localSettings && typeof localSettings === 'object' && !Array.isArray(localSettings) ? localSettings : {};
      if (!state.settings) state.settings = {};
      state.settings = Store.merge(state.settings, values);
      state.settings.dateFormat = String(state.settings.dateFormat || DEFAULTS.settings.dateFormat || 'locale-medium').trim();
      state.settings.customDateFormat = String(state.settings.customDateFormat || DEFAULTS.settings.customDateFormat || 'DD MMM YYYY').replace(/[^A-Za-z0-9 /.,:()[\]-]/g, '').slice(0, 40) || 'DD MMM YYYY';
      return state;
    },
    applyProfile(state, profile) {
      const next = state || Store.applyAdminConfig(Store.migrate(Utils.clone(DEFAULTS)));
      const data = profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : {};
      next.settings = next.settings || {};
      const hasRememberFlag = Object.prototype.hasOwnProperty.call(data, 'rememberApiKey');
      next.settings.rememberApiKey = hasRememberFlag ? data.rememberApiKey !== false : next.settings.rememberApiKey !== false;
      next.settings.apiKey = next.settings.rememberApiKey ? String(data.apiKey || next.settings.apiKey || '').trim() : '';
      next.settings.userId = String(data.userId || next.settings.userId || PageData.userId() || '').trim();
      next.settings.userName = String(data.username || data.userName || next.settings.userName || '').trim();
      next.settings.companyId = String(data.companyId || next.settings.companyId || next.company && next.company.profile && next.company.profile.id || PageData.companyId() || '').trim();
      if (next.company && next.company.profile && next.settings.companyId) next.company.profile.id = next.settings.companyId;
      Store.applyLocalSettings(next, data.localSettings);
      return next;
    },
    saveProfile(state) {
      const profile = Store.profileFromState(state);
      try {
        if (typeof GM_setValue === 'function') GM_setValue(APP.profileKey, JSON.stringify(profile));
      } catch (error) {}
      try { localStorage.setItem(APP.profileKey, JSON.stringify(profile)); } catch (error) {}
      Store.rawSetAsync(APP.profileKey, JSON.stringify(profile)).catch((error) => console.warn('[Pythagoras Project - CIS] Local profile save failed.', error));
      return profile;
    },
    loadFromRaw(raw) {
      if (!raw) return Store.applyAdminConfig(Store.migrate(Utils.clone(DEFAULTS)));
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Store.applyAdminConfig(Store.migrate(Store.merge(Utils.clone(DEFAULTS), parsed || {})));
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] Could not load stored data.', error);
        return Store.applyAdminConfig(Store.migrate(Utils.clone(DEFAULTS)));
      }
    },
    sanitizedState(state) {
      const copy = Utils.clone(state);
      Store.applyAdminConfig(copy);
      copy.settings.apiKey = '';
      delete copy['lic' + 'ense'];
      return copy;
    },
    localBootstrapState(state) {
      const source = state || {};
      const settings = source.settings || {};
      const copy = Store.sanitizedState(source);
      copy.settings = Object.assign({}, copy.settings || {}, {
        apiKey: settings.rememberApiKey !== false ? settings.apiKey || '' : '',
        rememberApiKey: settings.rememberApiKey !== false,
        userId: settings.userId || '',
        userName: settings.userName || '',
        companyId: settings.companyId || '',
        apiBaseUrl: settings.apiBaseUrl || DEFAULTS.settings.apiBaseUrl || ''
      });
      copy.localOnly = {
        updatedAt: Utils.nowIso()
      };
      return copy;
    },
    async localStorageState(state) {
      return Store.localBootstrapState(state);
    },
    cloudState(state) {
      const copy = Store.sanitizedState(state);
      copy.settings.apiKey = '';
      return copy;
    },
    syncCacheTtlMs() {
      return 24 * 60 * 60 * 1000;
    },
    syncCacheIdentity(state) {
      return {
        userId: String(state && state.settings && state.settings.userId || PageData.userId() || '').trim(),
        companyId: String(state && state.settings && state.settings.companyId || state && state.company && state.company.profile && state.company.profile.id || PageData.companyId() || '').trim()
      };
    },
    syncCacheMatches(state, cache) {
      const identity = Store.syncCacheIdentity(state);
      return !!(cache && cache.userId === identity.userId && cache.companyId === identity.companyId);
    },
    parseSyncCache(raw) {
      if (!raw) return null;
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] Could not read sync cache.', error);
        return null;
      }
    },
    loadSyncCache() {
      return Store.parseSyncCache(Store.rawGet(APP.syncCacheKey));
    },
    saveSyncCache(cache) {
      if (!cache || !cache.slices || !Object.keys(cache.slices).length) {
        Store.rawDelete(APP.syncCacheKey);
        return;
      }
      Store.rawSet(APP.syncCacheKey, JSON.stringify(cache));
    },
    validSyncCacheSlices(state) {
      const cache = Store.loadSyncCache();
      if (!Store.syncCacheMatches(state, cache)) return {};
      const now = Date.now();
      const slices = cache.slices && typeof cache.slices === 'object' && !Array.isArray(cache.slices) ? cache.slices : {};
      const valid = {};
      Object.entries(slices).forEach(([key, slice]) => {
        if (!slice || Utils.dateTimestamp(slice.expiresAt) * 1000 <= now) return;
        valid[key] = slice.data || {};
      });
      if (Object.keys(valid).length !== Object.keys(slices).length) {
        cache.slices = Object.keys(valid).reduce((next, key) => {
          next[key] = slices[key];
          return next;
        }, {});
        Store.saveSyncCache(cache);
      }
      return valid;
    },
    applySyncCache(state) {
      if (!state) return state;
      const slices = Store.validSyncCacheSlices(state);
      const cloneSlice = (key) => slices[key] ? Utils.clone(slices[key]) : null;
      const business = cloneSlice('business');
      if (business) {
        if (business.companyProfile) state.company.profile = Store.merge(state.company.profile || {}, business.companyProfile);
        if (business.companyDetailed) state.company.detailed = Store.merge(state.company.detailed || {}, business.companyDetailed);
        if (Array.isArray(business.adBudgetHistory)) state.company.adBudgetHistory = Store.mergeAdBudgetHistory(state.company.adBudgetHistory || [], business.adBudgetHistory);
        if (business.settings) state.settings = Store.merge(state.settings || {}, business.settings);
      }
      const employees = cloneSlice('employees');
      if (employees) {
        if (Array.isArray(employees.staffCurrent)) state.staff.current = employees.staffCurrent;
        if (Array.isArray(employees.profileEmployees)) state.company.profile.employees = employees.profileEmployees;
        if (employees.companyProfile) state.company.profile = Store.merge(state.company.profile || {}, employees.companyProfile);
      }
      const stock = cloneSlice('stock');
      if (stock) {
        if (stock.stockSettings) state.company.stockSettings = Store.normaliseStockSettings(stock.stockSettings);
        if (stock.companyStock) state.company.stock = stock.companyStock;
        if (Array.isArray(stock.stockHistory)) state.company.stockHistory = stock.stockHistory;
        Store.applyStockSettings(state);
      }
      const news = cloneSlice('news');
      if (news) {
        if (Array.isArray(news.timeline)) state.staff.timeline = news.timeline;
        if (news.newsSync) state.company.newsSync = Store.merge(state.company.newsSync || {}, news.newsSync);
        if (news.analytics) state.analytics = Store.merge(state.analytics || {}, news.analytics);
      }
      const trainingLog = cloneSlice('trainingLog');
      if (trainingLog) {
        if (Array.isArray(trainingLog.trainingLog)) state.trainingLog = trainingLog.trainingLog;
        if (Array.isArray(trainingLog.ledger)) state.ledger = Store.mergeLedgerRows(state.ledger || [], trainingLog.ledger);
      }
      Company.dedupeStaff(state);
      Company.removeDirectorsFromStaff(state);
      return state;
    },
    syncCacheSlice(state, kind) {
      if (!state) return {};
      if (kind === 'business') {
        return {
          companyProfile: Utils.clone(state.company.profile || {}),
          companyDetailed: Utils.clone(state.company.detailed || {}),
          adBudgetHistory: Utils.clone(state.company.adBudgetHistory || []),
          settings: {
            companyId: state.settings.companyId || '',
            companyTypeId: state.settings.companyTypeId || '',
            companyTypeName: state.settings.companyTypeName || '',
            companyStars: state.settings.companyStars || 0,
            trainerAssigned: !!state.settings.trainerAssigned
          }
        };
      }
      if (kind === 'employees') {
        return {
          staffCurrent: Utils.clone(state.staff.current || []),
          profileEmployees: Utils.clone(state.company.profile.employees || []),
          companyProfile: {
            currentEmployees: state.company.profile.currentEmployees || 0,
            employeeWagesSyncedAt: state.company.profile.employeeWagesSyncedAt || ''
          }
        };
      }
      if (kind === 'stock') return { companyStock: Utils.clone(state.company.stock || {}), stockSettings: Utils.clone(state.company.stockSettings || {}), stockHistory: Utils.clone(state.company.stockHistory || []) };
      if (kind === 'news') return { timeline: Utils.clone(state.staff.timeline || []), newsSync: Utils.clone(state.company.newsSync || {}), analytics: Utils.clone(state.analytics || {}) };
      if (kind === 'trainingLog') return { trainingLog: Utils.clone(state.trainingLog || []), ledger: Utils.clone(state.ledger || []) };
      return {};
    },
    updateSyncCache(state, kinds) {
      const list = Array.isArray(kinds) ? kinds : [kinds];
      const identity = Store.syncCacheIdentity(state);
      if (!identity.userId || !identity.companyId) return;
      const existing = Store.loadSyncCache();
      const cache = Store.syncCacheMatches(state, existing) ? existing : { userId: identity.userId, companyId: identity.companyId, slices: {} };
      const now = Utils.nowIso();
      const expiresAt = new Date(Date.now() + Store.syncCacheTtlMs()).toISOString();
      cache.updatedAt = now;
      cache.slices = cache.slices && typeof cache.slices === 'object' && !Array.isArray(cache.slices) ? cache.slices : {};
      list.forEach((kind) => {
        cache.slices[kind] = { syncedAt: now, expiresAt, data: Store.syncCacheSlice(state, kind) };
      });
      Store.saveSyncCache(cache);
    },
    save(state) {
      Ledger.prepare(state);
      Store.saveProfile(state);
      try {
        const ui = typeof window !== 'undefined' ? window.__PPCIS_UI : null;
        if (ui && ui.state === state && typeof ui.scheduleWorkspaceMirrorSave === 'function') ui.scheduleWorkspaceMirrorSave('state-save', 1800);
      } catch (error) {}
    },
    workspaceBaseUrl(state) {
      const raw = String(DEFAULTS.settings.apiBaseUrl || state && state.settings && state.settings.apiBaseUrl || '').trim();
      if (!raw) return '';
      try {
        const url = new URL(raw);
        if (!/^https?:$/.test(url.protocol)) return '';
        url.pathname = url.pathname.replace(/\/+$/, '');
        return url.toString().replace(/\/+$/, '');
      } catch (error) {
        return '';
      }
    },
    workspacePayload(state, extra) {
      const userId = String(state.settings.userId || PageData.userId() || '').trim();
      const companyId = String(state.settings.companyId || state.company.profile.id || PageData.companyId() || '').trim();
      const payload = Object.assign({
        userId,
        companyId,
        username: String(state.settings.userName || PageData.userName() || '').trim(),
        scriptVersion: APP.version
      }, extra || {});
      payload.apiKey = String(state.settings.apiKey || '').trim();
      return payload;
    },
    canUseCloudWorkspace(state) {
      const hasApiKey = String(state.settings.apiKey || '').trim();
      return !!(Store.workspaceBaseUrl(state) && hasApiKey && String(state.settings.userId || PageData.userId() || '').trim() && String(state.settings.companyId || state.company.profile.id || PageData.companyId() || '').trim());
    },
    async loadCloudWorkspace(localState, options) {
      const state = localState || Store.applyAdminConfig(Store.migrate(Utils.clone(DEFAULTS)));
      if (!Store.canUseCloudWorkspace(state)) return state;
      try {
        const base = Store.workspaceBaseUrl(state);
        const data = await ApiClient.postJson(`${base}/api/cis/bootstrap`, Store.workspacePayload(state, { company: state.company.profile || {} }), 30000);
        if (!data || !data.ok || !data.data) return state;
        return Store.applyCloudBootstrap(state, data);
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] Cloud workspace load failed.', error);
        return state;
      }
    },
    async cisApi(state, path, payload, timeout) {
      if (!Store.canUseCloudWorkspace(state)) throw new Error('This action requires the Pythagoras API workspace. Save a Torn API key, User ID, and Company ID first.');
      const base = Store.workspaceBaseUrl(state);
      return ApiClient.postJson(`${base}${path}`, Store.workspacePayload(state, payload || {}), timeout || 30000);
    },
    async cisCompanyApi(state, suffix, payload, timeout) {
      const companyId = String(state.settings.companyId || state.company.profile.id || PageData.companyId() || '').trim();
      if (!companyId) throw new Error('Company ID is required before uploading parsed sync data.');
      const path = `/api/cis/company/${encodeURIComponent(companyId)}${suffix}`;
      return Store.cisApi(state, path, Object.assign({ companyId }, payload || {}), timeout || 30000);
    },
    async saveCloudWorkspace(state, options) {
      if (!Store.canUseCloudWorkspace(state)) return null;
      const base = Store.workspaceBaseUrl(state);
      const companyId = String(options && options.companyId || state.settings.companyId || state.company.profile.id || PageData.companyId() || '').trim();
      const detailed = state.company && state.company.detailed || {};
      const profile = state.company && state.company.profile || {};
      const companyName = String(options && options.companyName || profile.name || profile.companyName || detailed.name || detailed.companyName || '').trim();
      const payload = Store.workspacePayload(state, {
        companyId,
        companyName,
        legacyState: Store.cloudState(state),
        company: state.company.profile || {}
      });
      const result = await ApiClient.postJson(`${base}/api/cis/migration/import-legacy`, payload, 30000);
      if (!result || !result.ok) throw new Error(result && result.reason || 'Cloud workspace save failed.');
      return result.summary || null;
    },
    async saveWorkspaceMirror(state, options) {
      if (!Store.canUseCloudWorkspace(state)) return null;
      const detailed = state.company && state.company.detailed || {};
      const profile = state.company && state.company.profile || {};
      const companyName = String(profile.name || profile.companyName || detailed.name || detailed.companyName || '').trim();
      const result = await Store.cisCompanyApi(state, '/sync/workspace', {
        state: Store.cloudState(state),
        companyName,
        company: {
          id: profile.id || detailed.id || state.settings.companyId || PageData.companyId() || '',
          name: companyName,
          companyName,
          companyTypeId: profile.typeId || detailed.typeId || state.settings.companyTypeId || '',
          companyTypeName: profile.typeName || detailed.typeName || state.settings.companyTypeName || '',
          directorId: profile.directorId || detailed.directorId || state.settings.userId || ''
        },
        scriptVersion: APP.version,
        snapshot: options && options.snapshot === true,
        snapshotReason: options && options.reason || 'autosave'
      }, options && options.timeout || 30000);
      if (!result || !result.ok) throw new Error(result && result.reason || 'Workspace mirror save failed.');
      return result.saved || null;
    },
    async deleteCloudWorkspace(state, options) {
      if (!Store.canUseCloudWorkspace(state)) return 0;
      return 0;
    },
    async migrateLegacyLocalState(state) {
      if (!Store.canUseCloudWorkspace(state)) return false;
      const base = Store.workspaceBaseUrl(state);
      const result = await ApiClient.postJson(`${base}/api/cis/migration/import-legacy`, Store.workspacePayload(state, {
        legacyState: Store.cloudState(state),
        company: state.company && state.company.profile || {}
      }), 45000);
      return !!(result && result.ok && result.migrated);
    },
    isDailyReportLike(event) {
      if (!event) return false;
      const type = String(event.type || event.eventType || event.category || '').toLowerCase();
      const text = String(event.plainText || event.text || event.message || '').replace(/\s+/g, ' ').trim();
      if (type === 'daily_report') return true;
      if (Utils.int(event.customers, 0) || Utils.int(event.income, 0)) return true;
      return /\b(?:daily|invalid date|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+report\b/i.test(text)
        && /\b(customers?|gross income|income|revenue|profit)\b/i.test(text);
    },
    dailyReportText(event) {
      const text = String(event && (event.plainText || event.text || event.message) || '');
      const customersMatch = text.match(/([\d,]+)\s+customers?/i) || text.match(/(?:customers|customer count)[^\d]*([\d,]+)/i);
      const incomeMatch = text.match(/(?:gross income|income|revenue|made)[^\d$]*\$?([\d,]+)/i);
      const reportDate = Utils.dateInput(event && (event.reportDate || event.report_date || event.date)) || Utils.dayKey(event && event.timestamp);
      const weekday = Utils.weekdayName(reportDate || event && event.timestamp) || 'Daily';
      const customers = Utils.int(event && event.customers, 0) || (customersMatch ? Utils.int(customersMatch[1], 0) : 0);
      const income = Utils.int(event && event.income, 0) || (incomeMatch ? Utils.int(incomeMatch[1], 0) : 0);
      return `${weekday} report: We had a total of ${Utils.formatNumber(customers)} customers and made a gross income of ${Utils.money(income)}.`;
    },
    dbEventToTimeline(row) {
      const meta = row && row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {};
      const reportDate = Utils.dateInput(row.report_date || row.reportDate || meta.report_date || meta.reportDate || meta.date) || Utils.dayKey(row.timestamp);
      const event = {
        id: row.event_id || meta.id || '',
        eventId: row.event_id || '',
        sourceEventId: row.event_id || meta.sourceEventId || meta.tornEventId || meta.apiEventId || meta.newsId || meta.id || '',
        timestamp: Utils.int(row.timestamp, 0),
        date: row.timestamp ? Utils.dateShort(row.timestamp) : '',
        reportDate,
        type: row.event_type || meta.type || 'other',
        category: row.event_type || meta.category || 'other',
        userId: row.user_id ? String(row.user_id) : String(meta.userId || meta.playerId || ''),
        playerId: row.user_id ? String(row.user_id) : String(meta.playerId || meta.userId || ''),
        playerName: meta.playerName || meta.name || '',
        position: row.position || meta.position || meta.role || '',
        amount: row.amount || meta.amount || 0,
        customers: row.customers || meta.customers || 0,
        income: row.income || meta.income || 0,
        trainCount: Utils.int(meta.trainCount || meta.count, 0),
        plainText: meta.plainText || meta.text || meta.message || ''
      };
      if (Store.isDailyReportLike(event)) {
        event.type = 'daily_report';
        event.category = 'daily_report';
        event.playerName = '';
        event.plainText = Store.dailyReportText(event);
      }
      if (!event.plainText) event.plainText = Store.eventText(event);
      if (!event.text) event.text = event.plainText;
      return event;
    },
    eventText(event) {
      if (!event) return '';
      if (Store.isDailyReportLike(event)) return Store.dailyReportText(event);
      if (event.type === 'training' || event.eventType === 'training') return Store.trainingEventText(event);
      if (event.plainText || event.text || event.message) return event.plainText || event.text || event.message;
      const name = event.playerName || event.name || (event.userId ? `User ${event.userId}` : '');
      if (event.type === 'daily_report') return `Daily report: ${Utils.formatNumber(event.customers || 0)} customers, ${Utils.money(event.income || 0)} income.`;
      if (event.type === 'funds' && event.amount) return `Funds movement: ${Utils.money(event.amount)}.`;
      return [name, event.value, event.position, event.amount ? Utils.money(event.amount) : ''].filter(Boolean).join(' - ') || String(event.type || event.eventType || 'Company event');
    },
    trainingEventCount(event, options) {
      const text = String(event && (event.plainText || event.text || event.message) || '');
      const match = text.match(/\b(\d[\d,]*)\s+trains?\b/i);
      const rawCount = Utils.int(event && (event.trainCount || event.count || event.trains), 0);
      const displayCount = options && options.raw ? 0 : Utils.int(event && event.displayCount, 0);
      return Math.max(1, displayCount, rawCount, match ? Utils.int(match[1], 0) : 0);
    },
    trainingEventText(event) {
      const name = event.playerName || event.name || (event.userId ? `User ${event.userId}` : 'A staff member');
      const position = event.position || event.role || '';
      const count = Store.trainingEventCount(event);
      return `${position ? `${position} ` : ''}${name} received ${Utils.formatNumber(count)} train${count === 1 ? '' : 's'} by the director.`;
    },
    reportToTimeline(row) {
      const date = Utils.dateInput(row.report_date || row.reportDate || row.date) || Utils.dayKey(row.timestamp);
      const stamp = Utils.int(row.timestamp, 0) || Utils.dateTimestamp(`${date}T19:04:00`) || Utils.dateTimestamp(date);
      return {
        id: `daily:${date}`,
        eventId: `daily:${date}`,
        timestamp: stamp,
        date,
        reportDate: date,
        type: 'daily_report',
        category: 'daily_report',
        customers: Utils.int(row.customers, 0),
        income: Utils.int(row.income, 0),
        plainText: Store.dailyReportText({
          reportDate: date,
          timestamp: stamp,
          customers: Utils.int(row.customers, 0),
          income: Utils.int(row.income, 0)
        })
      };
    },
    dbOrderToLedger(row) {
      return {
        id: row.order_id || '',
        orderId: row.order_id || '',
        playerId: row.player_id ? String(row.player_id) : '',
        userId: row.player_id ? String(row.player_id) : '',
        playerName: row.player_name || '',
        name: row.player_name || '',
        payment: Utils.int(row.payment, 0),
        pricePerTrain: Utils.int(row.price_per_train, 0),
        totalTrains: Utils.int(row.total_trains, 0),
        usedTrains: Utils.int(row.used_trains, 0),
        contractType: row.contract_type || 'paid',
        manualDiscount: Utils.int(row.manual_discount, 0),
        applyDiscount: row.apply_discount !== false,
        paid: !!row.paid,
        done: !!row.done,
        entryDate: row.entry_date || '',
        createdAt: row.created_at || '',
        updatedAt: row.updated_at || ''
      };
    },
    dbMemberToPerson(row, snapshot) {
      const raw = snapshot && snapshot.raw && typeof snapshot.raw === 'object' && !Array.isArray(snapshot.raw) ? snapshot.raw : {};
      return Store.merge(raw, {
        userId: row.user_id ? String(row.user_id) : String(raw.userId || raw.id || ''),
        id: row.user_id ? String(row.user_id) : String(raw.id || raw.userId || ''),
        name: row.username || raw.name || '',
        role: row.current_role || raw.role || '',
        currentRole: row.current_role || raw.currentRole || '',
        contract: row.contract_type || raw.contract || '',
        contractType: row.contract_type || raw.contractType || '',
        status: row.status || raw.status || '',
        hiredAt: row.hired_at || raw.hiredAt || '',
        leftAt: row.left_at || raw.leftAt || '',
        exitType: row.exit_type || raw.exitType || '',
        man: snapshot && snapshot.manual || raw.man || raw.manual || 0,
        int: snapshot && snapshot.intelligence || raw.int || raw.intelligence || 0,
        end: snapshot && snapshot.endurance || raw.end || raw.endurance || 0,
        merits: snapshot && snapshot.merits || raw.merits || 0,
        addiction: snapshot && snapshot.addiction || raw.addiction || 0,
        inactivity: snapshot && snapshot.inactivity || raw.inactivity || 0,
        wage: snapshot && snapshot.wage || raw.wage || 0,
        employeeEfficiency: snapshot && snapshot.efficiency || raw.employeeEfficiency || raw.efficiency || 0,
        days: snapshot && snapshot.days_in_company || raw.days || 0,
        lastActionTimestamp: snapshot && snapshot.last_action_timestamp || raw.lastActionTimestamp || 0,
        racingRank: snapshot && snapshot.racing_rank || raw.racingRank || '',
        racingSkill: snapshot && snapshot.racing_skill || raw.racingSkill || '',
        strikeHistory: snapshot && (snapshot.strike_history || snapshot.strikeHistory) || raw.strikeHistory || []
      });
    },
    dbPersonHasLeftAfterHire(person) {
      const hire = Utils.dateTimestamp(Company.employmentStart(person) || person && (person.hireDate || person.joinedAt));
      const left = Utils.dateTimestamp(person && (person.leftAt || person.endedAt || person.leftDate || person.leftTimestamp));
      return !!(left && (!hire || left >= hire));
    },
    staffEditKeys(person) {
      const keys = [];
      const id = String(person && (person.id || person.userId || person.user_id || person.playerId) || '').trim();
      const name = String(person && (person.name || person.playerName || person.username) || '').trim();
      if (id) keys.push(`id:${id}`, id.toLowerCase());
      if (name) keys.push(`name:${Company.nameKey(name)}`, name.toLowerCase());
      keys.push(Company.personKey(person));
      return Array.from(new Set(keys.filter(Boolean)));
    },
    applyStaffLocalEdits(state) {
      const edits = state && state.staff && state.staff.localEdits && typeof state.staff.localEdits === 'object' && !Array.isArray(state.staff.localEdits)
        ? state.staff.localEdits
        : {};
      if (!Object.keys(edits).length) return state;
      const apply = (person) => {
        const match = Store.staffEditKeys(person).map((key) => edits[key]).filter(Boolean).sort((a, b) => Utils.dateTimestamp(b.updatedAt) - Utils.dateTimestamp(a.updatedAt))[0];
        return match && match.fields ? Object.assign({}, person, match.fields, { localEditedAt: match.updatedAt || person.localEditedAt || '' }) : person;
      };
      state.staff.current = (state.staff.current || []).map(apply);
      state.staff.past = (state.staff.past || []).map(apply);
      if (state.company && state.company.profile) state.company.profile.employees = (state.company.profile.employees || []).map(apply);
      return state;
    },
    applyCloudBootstrap(state, response) {
      const localProfile = Store.profileFromState(state || {});
      let next = Store.applyProfile(Store.applyAdminConfig(Store.migrate(Store.merge(Utils.clone(DEFAULTS), state || {}))), localProfile);
      const localStaffEdits = next.staff && next.staff.localEdits && typeof next.staff.localEdits === 'object' && !Array.isArray(next.staff.localEdits) ? Utils.clone(next.staff.localEdits) : {};
      const localStaffEditVersion = Utils.int(next.staff && next.staff.localEditVersion, 0);
      const data = response.data || {};
      const company = data.company || {};
      const settings = data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings) ? data.settings : {};
      const watermarks = data.watermarks && typeof data.watermarks === 'object' && !Array.isArray(data.watermarks) ? data.watermarks : {};
      const plain = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      const mergeCloudObjects = (target, sources) => {
        sources.forEach((source) => {
          if (source && Object.keys(source).length) Store.merge(target, Utils.clone(source));
        });
        return target;
      };
      next.entitlement = Store.merge(next.entitlement || {}, response.entitlement || response.license || {});
      next.settings = Store.merge(next.settings || {}, settings);
      next = Store.applyProfile(next, localProfile);
      next.company.syncWatermarks = watermarks;
      const foundedAt = company.founded_at || company.foundedAt || '';
      const foundedTimestamp = Utils.dateTimestamp(foundedAt);
      next.company.profile = mergeCloudObjects(next.company.profile || {}, [
        plain(settings.companyProfile),
        plain(data.companyProfile),
        plain(company.profile),
        {
          id: company.company_id ? String(company.company_id) : next.company.profile.id,
          name: company.company_name || next.company.profile.name,
          typeId: company.company_type_id || next.company.profile.typeId,
          typeName: company.company_type_name || next.company.profile.typeName,
          directorId: company.director_id || next.company.profile.directorId,
          rating: company.rating ?? next.company.profile.rating,
          created: foundedAt || next.company.profile.created,
          foundedAt: foundedAt ? (Utils.dateInput(foundedAt) || String(foundedAt)) : next.company.profile.foundedAt,
          foundedTimestamp: foundedTimestamp || next.company.profile.foundedTimestamp,
          lastSynced: UI.newestSync([watermarks.business && watermarks.business.latestSyncedAt, watermarks.staff && watermarks.staff.latestSnapshotAt, next.company.profile.lastSynced])
        }
      ]);
      next.company.detailed = mergeCloudObjects(next.company.detailed || {}, [
        plain(settings.companyDetailed),
        plain(data.companyDetailed),
        plain(company.detailed)
      ]);
      next.company.detailed = Store.merge(next.company.detailed || {}, {
        id: company.company_id ? String(company.company_id) : next.company.profile.id,
        lastSynced: UI.newestSync([watermarks.business && watermarks.business.latestSyncedAt, next.company.detailed.lastSynced])
      });
      next.company.adBudgetHistory = Store.mergeAdBudgetHistory(next.company.adBudgetHistory || [], []
        .concat(Array.isArray(settings.adBudgetHistory) ? settings.adBudgetHistory : [])
        .concat(Array.isArray(data.adBudgetHistory) ? data.adBudgetHistory : []));

      const snapshotMap = new Map((data.memberSnapshots || []).map((row) => [String(row.user_id), row]));
      const people = (data.members || []).map((row) => Store.dbMemberToPerson(row, snapshotMap.get(String(row.user_id))));
      next.staff.current = people.filter((row) => String(row.status || '').toLowerCase() !== 'past' && !Store.dbPersonHasLeftAfterHire(row));
      next.staff.past = people.filter((row) => String(row.status || '').toLowerCase() === 'past' || Store.dbPersonHasLeftAfterHire(row));
      next.staff.localEdits = localStaffEdits;
      next.staff.localEditVersion = localStaffEditVersion;
      const timeline = (data.events || []).map((row) => Store.dbEventToTimeline(row));
      const reports = (data.dailyReports || []).map((row) => Store.reportToTimeline(row));
      next.staff.timeline = Timeline.mergeTimeline(timeline, reports);
      next.trainingLog = timeline.filter((event) => event.type === 'training');
      next.analytics.weeks = Timeline.analyticsFromEvents(next.staff.timeline, next);
      next.ledger = Store.mergeLedgerRows((data.trainingOrders || []).map((row) => Store.dbOrderToLedger(row)), Store.loadLedgerPending().orders);
      if (watermarks.events) {
        next.company.newsSync.latestTimestamp = Math.max(Utils.int(next.company.newsSync.latestTimestamp, 0), Utils.int(watermarks.events.latestTimestamp, 0));
        next.company.newsSync.oldestTimestamp = next.company.newsSync.oldestTimestamp
          ? Math.min(Utils.int(next.company.newsSync.oldestTimestamp, 0), Utils.int(watermarks.events.oldestTimestamp, 0) || Utils.int(next.company.newsSync.oldestTimestamp, 0))
          : Utils.int(watermarks.events.oldestTimestamp, 0);
        next.company.newsSync.lastSynced = UI.newestSync([next.company.newsSync.lastSynced, watermarks.events.latestAt]);
      }

      const stockItems = data.stock && Array.isArray(data.stock.items) ? data.stock.items : [];
      next.company.stockSettings = Store.normaliseStockSettings(next.company.stockSettings || {});
      if (stockItems.length) {
        const stock = {};
        stockItems.forEach((item) => {
          const key = String(item.item_key || '').trim();
          if (!key) return;
          stock[key] = {
            cost: item.cost || 0,
            rrp: item.rrp || 0,
            price: item.price || 0,
            in_stock: item.in_stock || 0,
            on_order: item.on_order || 0,
            sold_amount: item.sold_amount || 0,
            sold_worth: item.sold_worth || 0
          };
        });
        next.company.stock = Company.stock({ company_stock: stock }, next.company.stock.items, next);
        next.company.stock.lastSynced = UI.newestSync([data.stock && data.stock.snapshot && data.stock.snapshot.synced_at, watermarks.stock && watermarks.stock.latestSyncedAt, next.company.stock.lastSynced]);
      }
      Store.applyStockSettings(next);

      next.staff.current = (next.staff.current || []).map((person) => Timeline.hydrateEmploymentDates(next, person));
      next.staff.past = (next.staff.past || []).map((person) => Timeline.hydrateEmploymentDates(next, person));
      Store.applyStaffLocalEdits(next);
      Company.dedupeStaff(next);
      Company.removeDirectorsFromStaff(next);
      if (Store.companyKey(next)) Store.saveCompanySnapshot(next);
      return next;
    },
    companyKey(state) {
      const id = String(state && state.settings && state.settings.companyId || state && state.company && state.company.profile && state.company.profile.id || '').trim();
      if (id) return `id:${id}`;
      const name = String(state && state.company && state.company.profile && state.company.profile.name || '').trim();
      return name ? `name:${Company.nameKey(name)}` : '';
    },
    companyLabel(state) {
      const profile = state && state.company ? state.company.profile || {} : {};
      const name = profile.name || state && state.settings && state.settings.companyTypeName || 'Unsynced company';
      const id = state && state.settings && state.settings.companyId || profile.id || '';
      return `${name}${id ? ` #${id}` : ''}`;
    },
    loadCompanySnapshots() {
      if (Store.companySnapshotsCache) return Store.companySnapshotsCache;
      const raw = Store.rawGet(APP.companiesKey);
      if (!raw) {
        Store.companySnapshotsCache = {};
        return Store.companySnapshotsCache;
      }
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        Store.companySnapshotsCache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] Could not read company workspace list.', error);
        Store.companySnapshotsCache = {};
      }
      return Store.companySnapshotsCache;
    },
    saveCompanySnapshots(snapshots) {
      Store.companySnapshotsCache = snapshots || {};
      Store.rawSet(APP.companiesKey, JSON.stringify(Store.companySnapshotsCache));
    },
    companySnapshotMeta(state, extra) {
      const key = Store.companyKey(state);
      if (!key) return null;
      return Object.assign({
        key,
        label: Store.companyLabel(state),
        companyId: String(state.settings.companyId || state.company.profile.id || ''),
        companyName: String(state.company.profile.name || ''),
        updatedAt: Utils.nowIso(),
        cloudOnly: true
      }, extra || {});
    },
    saveCompanySnapshot(state) {
      const snapshot = Store.companySnapshotMeta(state);
      if (!snapshot) return null;
      const snapshots = Store.loadCompanySnapshots();
      snapshots[snapshot.key] = snapshot;
      Store.saveCompanySnapshots(snapshots);
      return snapshots[snapshot.key];
    },
    deleteCompanySnapshot(key) {
      const snapshots = Store.loadCompanySnapshots();
      delete snapshots[key];
      Store.saveCompanySnapshots(snapshots);
    },
    clearAll() {
      Store.rawDelete(APP.profileKey);
      Store.rawDelete(APP.storageKey);
      Store.rawDelete(APP.companiesKey);
      Store.rawDelete(APP.staffEditsKey);
      Store.rawDelete(APP.ledgerPendingKey);
      Store.rawDelete(APP.syncCacheKey);
      Store.rawDelete(APP.notificationDismissalsKey);
    },
    applyAdminConfig(state) {
      if (!BUILD_CONFIG.enabled) return state;

      const settings = state.settings || {};
      const setValue = (key, value) => {
        if (!value) return;
        if (BUILD_CONFIG.lockSupportLinks || !settings[key]) settings[key] = value;
      };

      setValue('supportUrl', BUILD_CONFIG.faqUrl);
      setValue('bugReportUrl', BUILD_CONFIG.bugReportUrl);
      setValue('contactUrl', BUILD_CONFIG.contactUrl);

      if (BUILD_CONFIG.defaultTheme && (!settings.theme || settings.theme === 'modul')) settings.theme = BUILD_CONFIG.defaultTheme;
      state.settings = settings;
      state.admin = {
        enabled: true,
        buildName: BUILD_CONFIG.buildName || 'Build'
      };
      return state;
    },
    migrate(state) {
      const settings = state.settings || {};
      state.version = APP.version;
      state.ui = Object.assign({}, DEFAULTS.ui, state.ui || {});
      state.ui.collapsedPanels = state.ui.collapsedPanels || {};
      state.ui.detailOpenState = state.ui.detailOpenState || {};
      state.ui.panelSizes = state.ui.panelSizes || {};
      state.ui.tableSorts = state.ui.tableSorts || {};
      state.ui.analyticsExpanded = state.ui.analyticsExpanded || {};
      state.ui.reportSections = Object.assign({}, DEFAULTS.ui.reportSections, state.ui.reportSections || {});
      state.ui.graphSeries = Object.assign({}, DEFAULTS.ui.graphSeries, state.ui.graphSeries || {});
      if (state.ui.tab === 'detailed') state.ui.tab = 'profile';
      if (state.ui.tab === 'lic' + 'ense') state.ui.tab = 'settings';
      delete state['lic' + 'ense'];
      delete state.access;
      state.company = Store.merge(Utils.clone(DEFAULTS.company), state.company || {});
      state.company.stockSettings = Store.normaliseStockSettings(state.company.stockSettings || {});
      if (!Object.keys(state.company.stockSettings).length && state.company.stock && state.company.stock.items && state.company.stock.items.length) {
        state.company.stockSettings = Store.stockSettingsFromItems(state.company.stock.items, state.company.stockSettings);
      }
      Store.applyStockSettings(state);
      state.company.adBudgetHistory = Store.normaliseAdBudgetHistory(state.company.adBudgetHistory || []);
      state.company.newsSync = Store.merge(Utils.clone(DEFAULTS.company.newsSync), state.company.newsSync || {});
      state.company.newsSync.reportGapAttempts = state.company.newsSync.reportGapAttempts && typeof state.company.newsSync.reportGapAttempts === 'object' && !Array.isArray(state.company.newsSync.reportGapAttempts)
        ? state.company.newsSync.reportGapAttempts
        : {};
      const currentDismissalDay = Utils.tctWorkingDayKey();
      const savedDismissals = state.dismissedNotifications;
      state.dismissedNotifications = {};
      if (savedDismissals && typeof savedDismissals === 'object' && !Array.isArray(savedDismissals)) {
        Object.keys(savedDismissals).forEach((key) => {
          if (savedDismissals[key] === currentDismissalDay) state.dismissedNotifications[String(key)] = currentDismissalDay;
        });
      }
      state.staff = Store.merge(Utils.clone(DEFAULTS.staff), state.staff || {});
      state.staff.localEdits = state.staff.localEdits && typeof state.staff.localEdits === 'object' && !Array.isArray(state.staff.localEdits) ? state.staff.localEdits : {};
      state.staff.localEditVersion = Utils.int(state.staff.localEditVersion, 0);
      state.planner = Object.assign({}, DEFAULTS.planner, state.planner || {});
      if (!['auto', 'manual', 'hybrid'].includes(state.planner.mode)) state.planner.mode = 'auto';
      state.planner.trainingQueue = state.planner.trainingQueue || null;
      state.planner.completedDates = state.planner.completedDates && typeof state.planner.completedDates === 'object' && !Array.isArray(state.planner.completedDates) ? state.planner.completedDates : {};
      state.planner.sponsoredRotation = Store.merge(Utils.clone(DEFAULTS.planner.sponsoredRotation), state.planner.sponsoredRotation || {});
      state.trainingLog = Array.isArray(state.trainingLog) ? state.trainingLog : [];
      settings.roleColors = settings.roleColors || {};
      settings.roleLabels = settings.roleLabels || {};
      settings.roleRankMap = settings.roleRankMap || {};
      settings.roleRankEvidence = settings.roleRankEvidence || {};
      settings.customRoles = Array.isArray(settings.customRoles) ? settings.customRoles : [];
      settings.hiddenRoles = Array.isArray(settings.hiddenRoles) ? settings.hiddenRoles : [];
      if (settings.trainerAutoDetect === undefined) settings.trainerAutoDetect = true;
      if (settings.discountsEnabled === undefined) settings.discountsEnabled = true;
      settings.logTrigger = String(settings.logTrigger || DEFAULTS.settings.logTrigger || '!train').trim() || '!train';
      settings.apiBaseUrl = String(DEFAULTS.settings.apiBaseUrl || settings.apiBaseUrl || '').trim();
      settings.keyInfo = Store.merge(Utils.clone(DEFAULTS.settings.keyInfo), settings.keyInfo || {});
      settings.customTheme = Store.merge(Utils.clone(DEFAULTS.settings.customTheme), settings.customTheme || {});
      settings.savedThemes = Array.isArray(settings.savedThemes) ? settings.savedThemes.map((theme) => ({
        id: String(theme && theme.id || '').toLowerCase().replace(/[^a-z0-9-]/g, ''),
        name: String(theme && theme.name || '').replace(/\s+/g, ' ').trim().slice(0, 32),
        vars: UI.themeVars(theme && theme.vars)
      })).filter((theme) => theme.id && theme.name) : [];
      settings.plannerPriority = Store.merge(Utils.clone(DEFAULTS.settings.plannerPriority), settings.plannerPriority || {});
      settings.notifications = Store.merge(Utils.clone(DEFAULTS.settings.notifications), settings.notifications || {});
      settings.wageRoleRequirements = settings.wageRoleRequirements || {};
      settings.dateFormat = settings.dateFormat || DEFAULTS.settings.dateFormat;
      settings.customDateFormat = settings.customDateFormat || DEFAULTS.settings.customDateFormat;
      if (!settings.companyTypeId && settings.companyTypeName) {
        const typeMatch = Object.entries(Company.typeNames).find(([, name]) => String(name).toLowerCase() === String(settings.companyTypeName).toLowerCase());
        if (typeMatch) settings.companyTypeId = typeMatch[0];
      }
      if (!Array.isArray(settings.loyaltyTiers) || !settings.loyaltyTiers.length) {
        settings.loyaltyTiers = String(settings.loyaltyTiersText || '')
          .split(',')
          .map((chunk) => {
            const parts = chunk.split(':');
            return { min: Math.max(0, Utils.int(parts[0], 0)), percent: Utils.percent(parts[1], 0) };
          })
          .filter((tier) => tier.min > 0 && tier.percent > 0);
      }
      if (!settings.loyaltyTiers.length) settings.loyaltyTiers = Utils.clone(DEFAULTS.settings.loyaltyTiers);
      state.settings = settings;
      return state;
    },
    merge(base, saved) {
      Object.keys(saved).forEach((key) => {
        if (Array.isArray(base[key])) { base[key] = Array.isArray(saved[key]) ? saved[key] : base[key]; return; }
        if (base[key] && typeof base[key] === 'object' && saved[key] && typeof saved[key] === 'object') {
          base[key] = Store.merge(base[key], saved[key]);
          return;
        }
        base[key] = saved[key];
      });
      return base;
    },
    gmApi() {
      try { if (typeof GM !== 'undefined' && GM) return GM; } catch (error) {}
      try { if (window.__PP_CIS_GM_BRIDGE__) return window.__PP_CIS_GM_BRIDGE__; } catch (error) {}
      return null;
    },
    rawGet(key) {
      const gm = Store.gmApi();
      const getValue = gm && (gm.getValue || gm.get);
      try {
        if (typeof getValue === 'function') {
          const value = getValue.call(gm, key);
          if (!value || typeof value.then !== 'function') return value;
        }
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] GM getValue failed.', error);
      }
      try {
        if (typeof GM_getValue === 'function') {
          const value = GM_getValue(key);
          if (!value || typeof value.then !== 'function') return value;
        }
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] GM_getValue failed.', error);
      }
      try { return localStorage.getItem(key); } catch (error) { return null; }
    },
    async rawGetAsync(key) {
      const gm = Store.gmApi();
      const getValue = gm && (gm.getValueAsync || gm.getValue || gm.get);
      try {
        if (typeof getValue === 'function') {
          const value = await getValue.call(gm, key);
          if (value !== undefined && value !== null && value !== '') return value;
        }
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] GM.getValue failed.', error);
      }

      try {
        if (typeof GM_getValue === 'function') {
          const value = await GM_getValue(key);
          if (value !== undefined && value !== null && value !== '') return value;
        }
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] GM_getValue failed.', error);
      }

      try { return localStorage.getItem(key); } catch (error) { return null; }
    },
    rawSet(key, value) {
      const gm = Store.gmApi();
      const setValue = gm && (gm.setValue || gm.set);
      try {
        if (typeof setValue === 'function') {
          Promise.resolve(setValue.call(gm, key, value)).catch((error) => console.warn('[Pythagoras Project - CIS] GM.setValue failed.', error));
          return;
        }
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] GM.setValue failed.', error);
      }
      try {
        if (typeof GM_setValue === 'function') {
          GM_setValue(key, value);
          return;
        }
      } catch (error) { console.warn('[Pythagoras Project - CIS] GM_setValue failed.', error); }
      try { localStorage.setItem(key, value); } catch (error) { console.warn('[Pythagoras Project - CIS] localStorage set failed.', error); }
    },
    async rawSetAsync(key, value) {
      const gm = Store.gmApi();
      const setValue = gm && (gm.setValue || gm.set);
      try {
        if (typeof setValue === 'function') {
          await setValue.call(gm, key, value);
          return;
        }
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] GM.setValue failed.', error);
      }
      try {
        if (typeof GM_setValue === 'function') {
          await GM_setValue(key, value);
          return;
        }
      } catch (error) { console.warn('[Pythagoras Project - CIS] GM_setValue failed.', error); }
      try { localStorage.setItem(key, value); } catch (error) { console.warn('[Pythagoras Project - CIS] localStorage set failed.', error); }
    },
    rawDelete(key) {
      const gm = Store.gmApi();
      const deleteValue = gm && (gm.deleteValue || gm.delete);
      try {
        if (typeof deleteValue === 'function') {
          Promise.resolve(deleteValue.call(gm, key)).catch((error) => console.warn('[Pythagoras Project - CIS] GM.deleteValue failed.', error));
          return;
        }
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] GM.deleteValue failed.', error);
      }
      try {
        if (typeof GM_deleteValue === 'function') {
          GM_deleteValue(key);
          return;
        }
      } catch (error) { console.warn('[Pythagoras Project - CIS] GM_deleteValue failed.', error); }
      try { localStorage.removeItem(key); } catch (error) { console.warn('[Pythagoras Project - CIS] localStorage delete failed.', error); }
    }
  };

  function cleanDetectedUserName(value, userId) {
    const name = String(value || '').replace(/\s+/g, ' ').trim();
    const id = String(userId || '').trim();
    if (!name) return '';
    const key = name.toLowerCase();
    if (['user', 'profile', 'view profile', 'my profile', 'view my profile'].includes(key)) return '';
    if (id && (key === id || key === `user ${id}`)) return '';
    return name;
  }

  function cookieValue(name) {
    const wanted = `${encodeURIComponent(name)}=`;
    const raw = String(document.cookie || '').split(';');
    for (const part of raw) {
      const item = part.trim();
      if (!item.startsWith(wanted)) continue;
      const value = item.slice(wanted.length).replace(/\+/g, ' ');
      try { return decodeURIComponent(value); } catch (error) { return value; }
    }
    return '';
  }

  function profileLinkUserName(link, userId) {
    if (!link) return '';
    const href = String(link.getAttribute('href') || link.href || '');
    const match = href.match(/[?&]XID=(\d+)/i);
    if (userId && match && match[1] !== String(userId)) return '';
    const aria = String(link.getAttribute('aria-label') || '');
    const labelMatch = aria.match(/^Name:\s*(.+)$/i);
    const labelName = labelMatch ? cleanDetectedUserName(labelMatch[1], userId) : '';
    if (labelName) return labelName;
    return cleanDetectedUserName(link.textContent || '', userId);
  }

  const PageData = {
    win() {
      try { return typeof unsafeWindow !== 'undefined' ? unsafeWindow : window; } catch (error) { return window; }
    },
    userId() {
      const page = PageData.win();
      const candidates = [page.userID, page.userid, page.User && page.User.id, page.User && page.User.userID, page.Torn && page.Torn.user && page.Torn.user.id];
      for (const value of candidates) {
        const id = Utils.int(value, 0);
        if (id > 0) return String(id);
      }
      const link = document.querySelector('a[href*="profiles.php?XID="]');
      const match = link && link.href.match(/[?&]XID=(\d+)/i);
      return match ? match[1] : '';
    },
    companyId() {
      const page = PageData.win();
      const candidates = [page.companyID, page.companyId, page.User && page.User.company_id, page.Torn && page.Torn.company && page.Torn.company.id];
      for (const value of candidates) {
        const id = Utils.int(value, 0);
        if (id > 0) return String(id);
      }
      const link = document.querySelector('a[href*="companies.php"][href*="ID="]');
      const match = link && link.href.match(/[?&]ID=(\d+)/i);
      return match ? match[1] : '';
    },
    userName() {
      const page = PageData.win();
      const userId = PageData.userId();
      const candidates = [page.userName, page.username, page.User && (page.User.name || page.User.username), page.Torn && page.Torn.user && (page.Torn.user.name || page.Torn.user.username)];
      for (const value of candidates) {
        const name = cleanDetectedUserName(value, userId);
        if (name) return name;
      }
      const namedLink = document.querySelector('a[href*="profiles.php?XID="][aria-label^="Name:"]');
      const namedLinkName = profileLinkUserName(namedLink, userId);
      if (namedLinkName) return namedLinkName;
      const links = Array.from(document.querySelectorAll('a[href*="profiles.php?XID="]'));
      for (const link of links) {
        const name = profileLinkUserName(link, userId);
        if (name) return name;
      }
      return cleanDetectedUserName(cookieValue('sso_wiki_user'), userId);
    }
  };

  const ApiClient = {
    tornQueue: Promise.resolve(),
    tornMinIntervalMs: 2200,
    tornLastRequestKey: 'pp_cis_torn_api_last_request_at',
    async waitForTornSlot() {
      let last = 0;
      try { last = Utils.int(localStorage.getItem(ApiClient.tornLastRequestKey), 0); } catch (error) {}
      const wait = Math.max(0, ApiClient.tornMinIntervalMs - (Date.now() - last));
      if (wait) await Utils.sleep(wait);
      try { localStorage.setItem(ApiClient.tornLastRequestKey, String(Date.now())); } catch (error) {}
    },
    enqueueTornRequest(task) {
      const run = ApiClient.tornQueue.then(async () => {
        await ApiClient.waitForTornSlot();
        return task();
      });
      ApiClient.tornQueue = run.catch(() => {});
      return run;
    },
    request(path, selections, key, params) {
      const trimmedKey = String(key || '').trim();
      if (!trimmedKey) return Promise.reject(new Error('Add an API key in Settings first.'));
      const url = new URL(`https://api.torn.com/${path}`);
      url.searchParams.set('selections', selections);
      url.searchParams.set('key', trimmedKey);
      url.searchParams.set('comment', 'PP_CIS');
      Object.entries(params || {}).forEach(([name, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, value);
      });
      return ApiClient.enqueueTornRequest(() => new Promise((resolve, reject) => {
        if (ApiClient.gmRequest({
            method: 'GET',
            url: url.toString(),
            timeout: 20000,
            onload(response) { ApiClient.parseResponse(response.responseText, resolve, reject); },
            onerror() { reject(new Error('Torn API request failed.')); },
            ontimeout() { reject(new Error('Torn API request timed out.')); }
          })) {
          return;
        }
        fetch(url.toString()).then((response) => response.text()).then((text) => ApiClient.parseResponse(text, resolve, reject)).catch(reject);
      }));
    },
    parseResponse(text, resolve, reject) {
      try {
        const data = JSON.parse(text);
        if (data && data.error) { reject(new Error(`${data.error.error || 'Torn API error'} (${data.error.code || 'unknown'})`)); return; }
        resolve(data);
      } catch (error) {
        reject(new Error('Torn API returned invalid JSON.'));
      }
    },
    requestV2(path, key, params) {
      const trimmedKey = String(key || '').trim();
      if (!trimmedKey) return Promise.reject(new Error('Add an API key in Settings first.'));
      const url = new URL(`https://api.torn.com/v2/${path}`);
      url.searchParams.set('key', trimmedKey);
      url.searchParams.set('comment', 'PP_CIS');
      Object.entries(params || {}).forEach(([name, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, value);
      });
      return ApiClient.enqueueTornRequest(() => new Promise((resolve, reject) => {
        if (ApiClient.gmRequest({
            method: 'GET',
            url: url.toString(),
            timeout: 20000,
            onload(response) { ApiClient.parseResponse(response.responseText, resolve, reject); },
            onerror() { reject(new Error('Torn API request failed.')); },
            ontimeout() { reject(new Error('Torn API request timed out.')); }
          })) {
          return;
        }
        fetch(url.toString()).then((response) => response.text()).then((text) => ApiClient.parseResponse(text, resolve, reject)).catch(reject);
      }));
    },
    requestV2Url(rawUrl, key) {
      const trimmedKey = String(key || '').trim();
      if (!trimmedKey) return Promise.reject(new Error('Add an API key in Settings first.'));
      let url;
      try {
        url = new URL(String(rawUrl || ''), 'https://api.torn.com');
      } catch (error) {
        return Promise.reject(new Error('Saved Torn API cursor is not valid.'));
      }
      if (url.hostname !== 'api.torn.com' || !url.pathname.startsWith('/v2/')) return Promise.reject(new Error('Saved Torn API cursor is not valid.'));
      url.searchParams.set('key', trimmedKey);
      if (!url.searchParams.get('comment')) url.searchParams.set('comment', 'PP_CIS');
      return ApiClient.enqueueTornRequest(() => new Promise((resolve, reject) => {
        if (ApiClient.gmRequest({
            method: 'GET',
            url: url.toString(),
            timeout: 20000,
            onload(response) { ApiClient.parseResponse(response.responseText, resolve, reject); },
            onerror() { reject(new Error('Torn API request failed.')); },
            ontimeout() { reject(new Error('Torn API request timed out.')); }
          })) {
          return;
        }
        fetch(url.toString()).then((response) => response.text()).then((text) => ApiClient.parseResponse(text, resolve, reject)).catch(reject);
      }));
    },
    gmRequest(details) {
      const gm = Store.gmApi();
      const modernRequest = gm && (gm.xmlHttpRequest || gm.xmlhttpRequest);
      try {
        if (typeof modernRequest === 'function') {
          modernRequest.call(gm, details);
          return true;
        }
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] GM.xmlHttpRequest failed.', error);
      }
      try {
        if (typeof GM_xmlhttpRequest === 'function') {
          GM_xmlhttpRequest(details);
          return true;
        }
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] GM_xmlhttpRequest failed.', error);
      }
      return false;
    },
    nextLink(data) {
      return data && data._metadata && data._metadata.links && data._metadata.links.next ? String(data._metadata.links.next) : '';
    },
    safeNextLink(data) {
      const link = ApiClient.nextLink(data);
      if (!link) return '';
      try {
        const url = new URL(link, 'https://api.torn.com');
        if (url.hostname !== 'api.torn.com' || !url.pathname.startsWith('/v2/')) return '';
        url.searchParams.delete('key');
        url.searchParams.delete('comment');
        return url.toString();
      } catch (error) {
        return '';
      }
    },
    userLog(targetUserId, key, params) {
      const target = String(targetUserId || '').trim();
      if (!target) return Promise.reject(new Error('This staff card needs a Torn user ID before staff log sync can run.'));
      if (params && params.nextUrl) return ApiClient.requestV2Url(params.nextUrl, key);
      return ApiClient.requestV2('user/log', key, Object.assign({ target, limit: 100 }, params || {}));
    },
    keyInfo(key) {
      return ApiClient.requestV2('key/info', key, {});
    },
    user(userId, selection, key, params) {
      const id = String(userId || '').trim();
      if (!id) return Promise.reject(new Error('This staff card needs a Torn user ID before user sync can run.'));
      return ApiClient.request(`user/${encodeURIComponent(id)}`, selection, key, params);
    },
    company(companyId, selection, key, params) {
      const id = String(companyId || '').trim();
      return ApiClient.request(id ? `company/${encodeURIComponent(id)}` : 'company/', selection, key, params);
    },
    companyV2(selection, key, params) {
      const path = String(selection || '').replace(/^\/+/, '');
      return ApiClient.requestV2(path ? `company/${path}` : 'company', key, params);
    },
    companyProfile(key, params) {
      return ApiClient.companyV2('profile', key, params);
    },
    companyEmployees(key, params) {
      return ApiClient.companyV2('employees', key, params);
    },
    companyStock(key, params) {
      return ApiClient.companyV2('stock', key, params);
    },
    companyNews(key, params) {
      return ApiClient.companyV2('news', key, params);
    },
    postJson(rawUrl, payload, timeout) {
      let url;
      try {
        url = new URL(String(rawUrl || ''));
      } catch (error) {
        return Promise.reject(new Error('Pythagoras API URL is not valid.'));
      }
      if (!/^https?:$/.test(url.protocol)) return Promise.reject(new Error('Pythagoras API URL must use http or https.'));
      const body = JSON.stringify(payload || {});
      return new Promise((resolve, reject) => {
        if (ApiClient.gmRequest({
            method: 'POST',
            url: url.toString(),
            timeout: timeout || 20000,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            data: body,
            onload(response) {
              try {
                const data = JSON.parse(response.responseText || '{}');
                if (response.status >= 400 && !data.reason) reject(new Error(`Pythagoras API returned HTTP ${response.status}.`));
                else resolve(data);
              } catch (error) {
                reject(new Error('Pythagoras API returned invalid JSON.'));
              }
            },
            onerror() { reject(new Error('Pythagoras API request failed.')); },
            ontimeout() { reject(new Error('Pythagoras API request timed out.')); }
          })) {
          return;
        }
        fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body
        }).then((response) => response.json()).then(resolve).catch(() => reject(new Error('Pythagoras API request failed.')));
      });
    }
  };

  const Company = {
    typeNames: {
      1: 'Hair Salon',
      2: 'Law Firm',
      3: 'Flower Shop',
      4: 'Car Dealership',
      5: 'Clothing Store',
      6: 'Gun Shop',
      7: 'Game Shop',
      8: 'Candle Shop',
      9: 'Toy Shop',
      10: 'Adult Novelties',
      11: 'Cyber Cafe',
      12: 'Grocery Store',
      13: 'Theater',
      14: 'Sweet Shop',
      15: 'Cruise Line',
      16: 'Television Network',
      18: 'Zoo',
      19: 'Firework Stand',
      20: 'Property Broker',
      21: 'Furniture Store',
      22: 'Gas Station',
      23: 'Music Store',
      24: 'Nightclub',
      25: 'Pub',
      26: 'Gents Strip Club',
      27: 'Restaurant',
      28: 'Oil Rig',
      29: 'Fitness Center',
      30: 'Mechanic Shop',
      31: 'Amusement Park',
      32: 'Lingerie Store',
      33: 'Meat Warehouse',
      34: 'Farm',
      35: 'Software Corporation',
      36: 'Ladies Strip Club',
      37: 'Private Security Firm',
      38: 'Mining Corporation',
      39: 'Detective Agency',
      40: 'Logistics Management'
    },
    defaultRoles: ['Director', 'Trainer', 'Cleaner', 'Employee', 'Ex-Employee'],
    root(data) {
      return data && (data.company_detailed || data.company_profile || data.company_stock || data.company || data.profile || data);
    },
    isStructuredResponse(data) {
      return !!(data && typeof data === 'object' && ['company_profile', 'company_detailed', 'company_stock', 'company_employees', 'profile', 'stock', 'employees', 'news'].some((key) => Object.prototype.hasOwnProperty.call(data, key)));
    },
    selection(data, name) {
      if (!data || typeof data !== 'object') return {};
      const map = {
        profile: ['company_profile', 'profile', 'company'],
        detailed: ['company_detailed', 'detailed', 'profile', 'company_profile'],
        stock: ['company_stock', 'stock', 'stocks'],
        employees: ['company_employees', 'employees']
      };
      const keys = map[name] || [];
      for (const key of keys) {
        if (data[key] !== undefined && data[key] !== null) return data[key];
      }
      return Company.isStructuredResponse(data) ? {} : (Company.root(data) || {});
    },
    typeName(typeId, rawType) {
      if (typeof rawType === 'string' && rawType.trim()) return rawType.trim();
      if (rawType && typeof rawType === 'object') return rawType.name || rawType.title || Company.typeNames[typeId] || '';
      return Company.typeNames[typeId] || (typeId ? `Company type ${typeId}` : '');
    },
    nested(source, path) {
      return path.split('.').reduce((value, key) => (value && value[key] !== undefined ? value[key] : undefined), source);
    },
    first(source, paths, fallback) {
      for (const path of paths) {
        const value = path.includes('.') ? Company.nested(source, path) : source && source[path];
        if (value !== undefined && value !== null && value !== '') return value;
      }
      return fallback;
    },
    hasPath(source, path) {
      if (!source || typeof source !== 'object') return false;
      const parts = String(path || '').split('.').filter(Boolean);
      let cursor = source;
      for (const key of parts) {
        if (!cursor || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, key)) return false;
        cursor = cursor[key];
      }
      return true;
    },
    hasAny(source, paths) {
      return (paths || []).some((path) => Company.hasPath(source, path));
    },
    nameKey(name) {
      return String(name || '').replace(/<[^>]+>/g, '').replace(/\s*\[\d+\]\s*$/, '').trim().toLowerCase();
    },
    isFakeStaffName(name) {
      const raw = String(name || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const key = Company.nameKey(raw);
      if (!key) return true;
      if (/\bfrom\s+(?:the\s+)?company\b/i.test(raw)) return true;
      if (/\bhas$/i.test(raw)) return true;
      if (/^the\s+company\b/i.test(raw) || /^company\b/i.test(raw)) return true;
      if (/:/.test(raw) && !/\[\d+\]/.test(raw)) return true;
      return /^(?:left|quit|resigned|fired|dismissed|removed|terminated|kicked|end of tenure|inactivity|addiction|paid contract policy breach|re-?apply)$/i.test(raw);
    },
    isValidStaffPerson(person) {
      const id = String(person && (person.id || person.userId || person.user_id || person.playerId) || '').trim();
      if (id) return true;
      return !Company.isFakeStaffName(person && (person.name || person.playerName));
    },
    personKey(person) {
      const id = String(person && (person.id || person.userId || person.user_id || person.playerId) || '').trim();
      if (id) return `id:${id}`;
      return `name:${Company.nameKey(person && (person.name || person.playerName))}`;
    },
    aliasList(person, nextName) {
      const aliases = Array.isArray(person && person.aliases) ? person.aliases.slice() : [];
      [person && person.name, person && person.playerName, nextName].forEach((name) => {
        const clean = String(name || '').trim();
        if (clean && !aliases.some((alias) => Company.nameKey(alias) === Company.nameKey(clean))) aliases.push(clean);
      });
      return aliases;
    },
    employmentStart(person) {
      return person && (person.hiredAt || person.joinedDate || person.startedAt || '');
    },
    hasStaleLeftDate(person) {
      const start = Utils.dateTimestamp(Company.employmentStart(person));
      const left = Utils.dateTimestamp(person && (person.leftAt || person.endedAt || person.leftDate || person.leftTimestamp));
      return !!(start && left && left < start);
    },
    clearStaleLeftDate(person) {
      const next = Object.assign({}, person || {});
      if (!Company.hasStaleLeftDate(next)) return next;
      if (next.leftAt && !next.previousLeftAt) next.previousLeftAt = next.leftAt;
      if (next.endedAt && !next.previousEndedAt) next.previousEndedAt = next.endedAt;
      next.leftAt = '';
      next.endedAt = '';
      next.leftDate = '';
      next.leftTimestamp = '';
      if (['left', 'fired', 'terminated'].includes(String(next.exitType || '').toLowerCase())) next.exitType = '';
      if (String(next.status || '').toLowerCase() === 'past') next.status = 'current';
      if (String(next.role || '').toLowerCase() === 'ex-employee') next.role = 'Employee';
      return next;
    },
    normalisedRoleHistory(person, fallbackRole, fallbackStart) {
      const role = String(fallbackRole || person && person.role || 'Employee').trim() || 'Employee';
      const start = Utils.dateInput(fallbackStart || Company.employmentStart(person) || Utils.todayInput()) || Utils.todayInput();
      const rows = Array.isArray(person && person.roleHistory) ? Utils.clone(person.roleHistory) : [];
      if (!rows.length) rows.push({ type: 'hire', role, at: start });
      rows[0].type = rows[0].type || 'hire';
      rows[0].role = rows[0].role || role;
      rows[0].at = Utils.dateInput(rows[0].at || start) || start;
      return rows.map((row) => ({
        type: row.type || 'role',
        role: String(row.role || role).trim() || role,
        fromRole: String(row.fromRole || '').trim(),
        at: Utils.dateInput(row.at) || start
      })).sort((a, b) => Utils.dateTimestamp(a.at) - Utils.dateTimestamp(b.at));
    },
    roleHistoryWithChange(person, nextRole, changedAt, fallbackStart) {
      const role = String(nextRole || person && person.role || 'Employee').trim() || 'Employee';
      const at = Utils.dateInput(changedAt || Utils.todayInput()) || Utils.todayInput();
      const history = Company.normalisedRoleHistory(person || {}, person && person.role || role, fallbackStart || Company.employmentStart(person) || at);
      const atTime = Utils.dateTimestamp(at);
      let previous = null;
      history.forEach((row) => { if (Utils.dateTimestamp(row.at) <= atTime) previous = row; });
      if (previous && previous.at === at) {
        if (Company.nameKey(previous.role) !== Company.nameKey(role)) {
          previous.fromRole = previous.fromRole || '';
          previous.role = role;
          previous.type = previous.type || 'role';
        }
        return history;
      }
      if (previous && Company.nameKey(previous.role) === Company.nameKey(role)) return history;
      history.push({ type: 'role', fromRole: previous ? previous.role : '', role, at });
      return history.sort((a, b) => Utils.dateTimestamp(a.at) - Utils.dateTimestamp(b.at));
    },
    rankRoleLabel(rank, state) {
      const key = String(rank || '').trim();
      const map = state && state.settings && state.settings.roleRankMap ? state.settings.roleRankMap : {};
      if (!key || !map[key]) return key ? `Rank ${key}` : 'Unknown rank';
      const stored = String(map[key] || '').trim();
      const labels = state && state.settings && state.settings.roleLabels ? state.settings.roleLabels : {};
      const roleKey = stored.toLowerCase().replace(/[^a-z0-9]+/g, '-') || stored;
      return labels[stored] || labels[roleKey] || stored;
    },
    rankHistoryWithChange(person, previousRank, nextRank, changedAt) {
      const at = Utils.dateInput(changedAt || Utils.todayInput()) || Utils.todayInput();
      const rows = Array.isArray(person && person.rankHistory) ? Utils.clone(person.rankHistory) : [];
      const next = String(nextRank === undefined || nextRank === null ? '' : nextRank).trim();
      if (!next) return rows;
      const previous = String(previousRank === undefined || previousRank === null ? '' : previousRank).trim();
      const existing = rows.find((row) => String(row.at) === at && String(row.newRank) === next && String(row.previousRank || '') === previous);
      if (existing) return rows.sort((a, b) => Utils.dateTimestamp(a.at) - Utils.dateTimestamp(b.at));
      rows.push({ at, previousRank: previous, newRank: next });
      return rows.sort((a, b) => Utils.dateTimestamp(a.at) - Utils.dateTimestamp(b.at));
    },
    wageHistoryWithChange(person, previousWage, nextWage, changedAt) {
      const at = Utils.dateInput(changedAt || Utils.todayInput()) || Utils.todayInput();
      const rows = Array.isArray(person && person.wageHistory) ? Utils.clone(person.wageHistory) : [];
      const previous = Utils.num(previousWage, 0);
      const next = Utils.num(nextWage, 0);
      const existing = rows.find((row) => String(row.at) === at && Utils.num(row.previousWage, 0) === previous && Utils.num(row.newWage, 0) === next);
      if (existing) return rows.sort((a, b) => Utils.dateTimestamp(a.at) - Utils.dateTimestamp(b.at));
      rows.push({ at, previousWage: previous, newWage: next });
      return rows.sort((a, b) => Utils.dateTimestamp(a.at) - Utils.dateTimestamp(b.at));
    },
    identityMaps(state) {
      const byId = new Map();
      const byName = new Map();
      const people = []
        .concat(state.staff.current || [])
        .concat(state.staff.past || [])
        .concat(state.staff.directorsCurrent || [])
        .concat(state.staff.directorsPast || [])
        .concat(state.company && state.company.profile && state.company.profile.employees ? state.company.profile.employees : []);
      people.forEach((person) => {
        const id = String(person.id || person.userId || person.user_id || person.playerId || '').trim();
        const identity = id ? `id:${id}` : Company.personKey(person);
        if (id) byId.set(id, identity);
        [person.name, person.playerName].concat(person.aliases || []).forEach((name) => {
          const key = Company.nameKey(name);
          if (key) byName.set(key, identity);
        });
      });
      return { byId, byName };
    },
    resolveIdentity(subject, state, maps) {
      const identityMaps = maps || Company.identityMaps(state);
      const id = String(subject && (subject.id || subject.userId || subject.user_id || subject.playerId) || '').trim();
      const name = String(subject && (subject.name || subject.playerName) || subject || '').trim();
      const nameKey = Company.nameKey(name);
      if (id && identityMaps.byId.has(id)) return identityMaps.byId.get(id);
      if (id && nameKey && identityMaps.byName.has(nameKey)) return identityMaps.byName.get(nameKey);
      if (id) return `id:${id}`;
      if (/^\d+$/.test(name) && identityMaps.byId.has(name)) return identityMaps.byId.get(name);
      return identityMaps.byName.get(nameKey) || `name:${nameKey}`;
    },
    removeDirectorsFromStaff(state) {
      const directorIds = new Set((state.staff.directorsCurrent || []).map((person) => String(person.id || '').trim()).filter(Boolean));
      const directorNames = new Set((state.staff.directorsCurrent || []).map((person) => Company.nameKey(person.name)).filter(Boolean));
      if (state.company && state.company.profile && state.company.profile.directorId) directorIds.add(String(state.company.profile.directorId));
      if (state.settings && state.settings.userId) directorIds.add(String(state.settings.userId));
      const moved = [];
      state.staff.current = (state.staff.current || []).filter((person) => {
        const id = String(person.id || '').trim();
        const aliases = [person.name, person.playerName].concat(person.aliases || []);
        const hasDirectorAlias = aliases.some((name) => {
          const key = Company.nameKey(name);
          return directorNames.has(key) || (/^\d+$/.test(key) && directorIds.has(key));
        });
        const isDirector = (id && directorIds.has(id)) || hasDirectorAlias || String(person.role || '').toLowerCase().includes('director');
        if (isDirector) moved.push(Object.assign({}, person, { role: 'Director' }));
        return !isDirector;
      });
      if (moved.length) state.staff.directorsCurrent = Company.mergeStaff(state.staff.directorsCurrent || [], moved.map((person) => Object.assign({}, person, { role: 'Director', source: person.source || 'Director filter' })));
    },
    mergePeople(target, source) {
      const aliases = Company.aliasList(target, source && (source.name || source.playerName)).concat(Company.aliasList(source, target && (target.name || target.playerName)));
      const uniqueAliases = [];
      aliases.forEach((alias) => {
        if (alias && !uniqueAliases.some((existing) => Company.nameKey(existing) === Company.nameKey(alias))) uniqueAliases.push(alias);
      });
      return Company.clearStaleLeftDate(Object.assign({}, source || {}, target || {}, {
        id: (target && target.id) || (source && source.id) || '',
        name: (target && target.name) || (source && source.name) || '',
        role: (target && target.role) || (source && source.role) || 'Employee',
        contractType: (target && target.contractType) || (source && source.contractType) || '',
        hiredAt: (target && target.hiredAt) || (source && source.hiredAt) || '',
        joinedDate: (target && target.joinedDate) || (source && source.joinedDate) || '',
        leftAt: (target && target.leftAt) || (source && source.leftAt) || '',
        aliases: uniqueAliases
      }));
    },
    dedupePeople(list) {
      const byId = new Map();
      const noId = [];
      (list || []).filter((person) => Company.isValidStaffPerson(person)).forEach((person) => {
        const id = String(person.id || '').trim();
        if (!id) { noId.push(person); return; }
        byId.set(id, byId.has(id) ? Company.mergePeople(Object.assign({}, byId.get(id), person), byId.get(id)) : person);
      });
      const aliasToId = new Map();
      byId.forEach((person, id) => {
        [person.name, person.playerName].concat(person.aliases || []).forEach((name) => {
          const key = Company.nameKey(name);
          if (key) aliasToId.set(key, id);
        });
      });
      const byName = new Map();
      noId.forEach((person) => {
        const key = Company.nameKey(person.name || person.playerName);
        const id = aliasToId.get(key);
        if (id) {
          byId.set(id, Company.mergePeople(byId.get(id), person));
          return;
        }
        byName.set(key, byName.has(key) ? Company.mergePeople(byName.get(key), person) : person);
      });
      return Array.from(byId.values()).concat(Array.from(byName.values())).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    },
    identityKeys(person) {
      const ids = new Set();
      const names = new Set();
      const id = String(person && (person.id || person.userId || person.user_id || person.playerId) || '').trim();
      if (id) ids.add(id);
      [person && person.name, person && person.playerName].concat(person && person.aliases || []).forEach((name) => {
        const key = Company.nameKey(name);
        if (!key) return;
        names.add(key);
        if (/^\d+$/.test(key)) ids.add(key);
      });
      return { ids, names };
    },
    mergeCurrentWithPast(current, past) {
      const next = Company.mergePeople(current, past);
      if (past && past.leftAt && !next.previousLeftAt) next.previousLeftAt = past.leftAt;
      const pastLeft = past && !Company.hasStaleLeftDate(past) ? (past.leftAt || past.endedAt || past.leftDate || past.leftTimestamp || '') : '';
      if (Company.shouldBePastStaff(past) && pastLeft) {
        next.leftAt = pastLeft;
        next.endedAt = next.endedAt || pastLeft;
        next.exitType = past.exitType || 'left';
        next.status = 'past';
        if (!next.role || Company.nameKey(next.role) === 'employee') next.role = 'Ex-Employee';
        return next;
      }
      next.leftAt = current && current.leftAt && !Company.hasStaleLeftDate(current) ? current.leftAt : '';
      if (!next.leftAt && (next.exitType === 'left' || next.exitType === 'fired')) next.exitType = '';
      if (!next.role || next.role === 'Ex-Employee') next.role = current && current.role || 'Employee';
      return next;
    },
    removeCurrentFromPast(currentRows, pastRows) {
      const current = (currentRows || []).slice();
      const byId = new Map();
      const byName = new Map();
      const register = (person, index) => {
        const keys = Company.identityKeys(person);
        keys.ids.forEach((id) => byId.set(id, index));
        keys.names.forEach((name) => byName.set(name, index));
      };
      current.forEach(register);
      const past = [];
      (pastRows || []).forEach((person) => {
        const keys = Company.identityKeys(person);
        let matchIndex = -1;
        keys.ids.forEach((id) => { if (matchIndex < 0 && byId.has(id)) matchIndex = byId.get(id); });
        keys.names.forEach((name) => { if (matchIndex < 0 && byName.has(name)) matchIndex = byName.get(name); });
        if (matchIndex >= 0) {
          current[matchIndex] = Company.mergeCurrentWithPast(current[matchIndex], person);
          register(current[matchIndex], matchIndex);
          return;
        }
        past.push(person);
      });
      return { current, past };
    },
    shouldBePastStaff(person) {
      if (Company.hasStaleLeftDate(person)) return false;
      const roleKey = Company.nameKey(person && person.role).replace(/[^a-z0-9]+/g, '-');
      const statusKey = Company.nameKey(person && person.status).replace(/[^a-z0-9]+/g, '-');
      const exitKey = Company.nameKey(person && person.exitType).replace(/[^a-z0-9]+/g, '-');
      const leftAt = person && (person.leftAt || person.leftDate || person.leftTimestamp || person.endedAt);
      const hasValidLeft = !!(Utils.dateTimestamp(leftAt) && !Company.hasStaleLeftDate(person));
      return roleKey === 'ex-employee' || statusKey === 'past' || ['left', 'fired', 'terminated'].includes(exitKey) || hasValidLeft;
    },
    splitPastCurrent(state) {
      const current = [];
      const past = [];
      const classify = (person) => {
        const clean = Company.clearStaleLeftDate(person);
        if (Company.shouldBePastStaff(clean)) {
          past.push(Object.assign({}, clean, {
            role: clean.role && Company.nameKey(clean.role) !== 'employee' ? clean.role : 'Ex-Employee',
            status: 'past',
            exitType: clean.exitType || 'left',
            leftAt: clean.leftAt || clean.endedAt || Utils.nowIso()
          }));
        } else {
          current.push(Object.assign({}, clean, {
            status: String(clean.status || '').toLowerCase() === 'past' ? 'current' : clean.status,
            leftAt: '',
            endedAt: '',
            exitType: ['left', 'fired', 'terminated'].includes(String(clean.exitType || '').toLowerCase()) ? '' : clean.exitType
          }));
        }
      };
      (state.staff.current || []).forEach(classify);
      (state.staff.past || []).forEach(classify);
      state.staff.current = Company.dedupePeople(current);
      state.staff.past = Company.dedupePeople(past);
    },
    dedupeDirectors(state) {
      state.staff.directorsCurrent = Company.dedupePeople(state.staff.directorsCurrent || []).map((person) => Object.assign({}, person, { role: 'Director', leftAt: '' }));
      state.staff.directorsPast = Company.dedupePeople(state.staff.directorsPast || []).map((person) => Object.assign({}, person, { role: 'Director' }));
      const reconciled = Company.removeCurrentFromPast(state.staff.directorsCurrent, state.staff.directorsPast);
      state.staff.directorsCurrent = Company.dedupePeople(reconciled.current).map((person) => Object.assign({}, person, { role: 'Director', leftAt: '' }));
      state.staff.directorsPast = Company.dedupePeople(reconciled.past).map((person) => Object.assign({}, person, { role: 'Director' }));
    },
    latestEmploymentEvent(state, person) {
      const rows = (state && state.staff && state.staff.timeline || [])
        .filter((event) => event && ['hire', 'left', 'fired'].includes(String(event.type || '').toLowerCase()) && Utils.int(event.timestamp, 0) && Timeline.eventMatchesPerson(event, person))
        .sort((a, b) => Utils.int(a.timestamp, 0) - Utils.int(b.timestamp, 0));
      return rows.length ? rows[rows.length - 1] : null;
    },
    timelineSaysPast(state, person) {
      const event = Company.latestEmploymentEvent(state, person);
      return event && ['left', 'fired'].includes(String(event.type || '').toLowerCase()) ? event : null;
    },
    applyTimelineDepartures(state) {
      if (!state || !state.staff || !Array.isArray(state.staff.timeline) || !state.staff.timeline.length) return;
      const moved = [];
      state.staff.current = (state.staff.current || []).filter((person) => {
        const event = Company.timelineSaysPast(state, person);
        if (!event) return true;
        const leftAt = Utils.int(event.timestamp, 0) || person.leftAt || person.endedAt || Utils.nowIso();
        moved.push(Object.assign({}, person, {
          role: person.role && Company.nameKey(person.role) !== 'employee' ? person.role : 'Ex-Employee',
          status: 'past',
          exitType: event.type,
          leftAt,
          endedAt: person.endedAt || leftAt,
          source: person.source || 'company news departure'
        }));
        return false;
      });
      if (state.company && state.company.profile) {
        state.company.profile.employees = (state.company.profile.employees || []).filter((person) => !Company.timelineSaysPast(state, person));
      }
      if (moved.length) state.staff.past = Company.dedupePeople((state.staff.past || []).concat(moved));
    },
    dedupeStaff(state) {
      state.staff.current = Company.dedupePeople(state.staff.current || []);
      state.staff.past = Company.dedupePeople(state.staff.past || []);
      Company.splitPastCurrent(state);
      const reconciled = Company.removeCurrentFromPast(state.staff.current, state.staff.past);
      state.staff.current = Company.dedupePeople(reconciled.current);
      state.staff.past = Company.dedupePeople(reconciled.past);
      Company.splitPastCurrent(state);
      Company.dedupeDirectors(state);
      state.company.profile.employees = Company.dedupePeople(state.company.profile.employees || []);
      Company.applyTimelineDepartures(state);
    },
    effectiveness(employee) {
      const raw = employee && employee.effectiveness && typeof employee.effectiveness === 'object' ? employee.effectiveness : {};
      const details = {};
      Object.entries(raw).forEach(([key, value]) => {
        if (key === 'total') return;
        const number = Utils.num(value, null);
        if (Number.isFinite(number)) details[key] = number;
      });
      const total = Utils.num(raw.total || employee.effectiveness_total || employee.efficiency || employee.employee_efficiency, 0);
      return { total, details };
    },
    employeeRows(rawEmployees) {
      if (!rawEmployees) return [];
      const rows = Array.isArray(rawEmployees)
        ? rawEmployees.map((employee, index) => [String(employee.id || employee.user_id || index), employee])
        : Object.entries(rawEmployees);
      return rows.filter(([, employee]) => employee && typeof employee === 'object').map(([id, employee]) => {
        const action = employee.last_action || employee.lastAction || {};
        const actionTimestamp = Utils.int(action.timestamp || employee.last_action_timestamp || employee.last_action, 0);
        const effectiveness = Company.effectiveness(employee);
        const stats = employee.stats && typeof employee.stats === 'object' ? employee.stats : {};
        const position = employee.position && typeof employee.position === 'object' ? employee.position : null;
        return {
          id: String(employee.id || employee.user_id || id),
          name: employee.name || employee.player_name || employee.username || `Player ${id}`,
          role: position ? position.name : (employee.position || employee.role || employee.job || employee.title || 'Employee'),
          positionId: position ? String(position.id || '') : String(employee.position_id || employee.positionId || ''),
          man: Utils.num(employee.man || employee.manual_labor || employee.manual || employee.MAN || stats.manual_labor, 0),
          int: Utils.num(employee.int || employee.intelligence || employee.INT || stats.intelligence, 0),
          end: Utils.num(employee.end || employee.endurance || employee.END || stats.endurance, 0),
          merits: Utils.int(employee.merits || (employee.effectiveness && employee.effectiveness.merits), 0),
          addiction: Math.abs(Utils.num(employee.addiction || employee.addiction_penalty || effectiveness.details.addiction, 0)),
          inactiveDays: Utils.int(employee.inactive_days || employee.days_inactive || employee.inactiveDays, 0),
          wage: Utils.num(employee.wage, 0),
          wageFromApi: Object.prototype.hasOwnProperty.call(employee, 'wage'),
          effectiveness,
          daysInCompany: Utils.int(employee.days_in_company || employee.daysInCompany || employee.days || 0, 0),
          hiredAt: employee.joined_at ? Utils.dateInput(employee.joined_at) : (employee.hiredAt || employee.joinedDate || ''),
          lastActionTimestamp: actionTimestamp,
          lastAction: actionTimestamp ? Utils.timeAgo(actionTimestamp) : (action.relative || action.status || ''),
          status: employee.status && employee.status.description ? employee.status.description : ''
        };
      }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    },
    mergeStaff(existing, employees) {
      const byId = new Map();
      const byName = new Map();
      (existing || []).forEach((person) => {
        const id = String(person.id || '').trim();
        if (id) byId.set(id, person);
        [person.name, person.playerName].concat(person.aliases || []).forEach((name) => {
          const key = Company.nameKey(name);
          if (key) byName.set(key, person);
        });
      });
      const merged = new Map((existing || []).map((person) => [Company.personKey(person), person]));
      (employees || []).forEach((employee) => {
        const id = String(employee.id || '').trim();
        const previous = (id && byId.get(id)) || byName.get(Company.nameKey(employee.name)) || {};
        const aliases = Company.aliasList(previous, employee.name);
        const next = Company.clearStaleLeftDate(Object.assign({}, previous, employee, {
          id: employee.id || previous.id || '',
          name: employee.name || previous.name || '',
          role: employee.role || previous.role || 'Employee',
          contractType: employee.contractType || previous.contractType || '',
          daysInCompany: employee.daysInCompany !== undefined ? employee.daysInCompany : previous.daysInCompany,
          lastAction: employee.lastAction || previous.lastAction,
          lastActionTimestamp: employee.lastActionTimestamp || previous.lastActionTimestamp,
          aliases,
          source: employee.source || previous.source || 'Torn API profile'
        }));
        merged.delete(Company.personKey(previous));
        merged.set(Company.personKey(next), next);
      });
      return Array.from(merged.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    },
    hasTrainerRole(rows) {
      return (rows || []).some((person) => String(person && person.role || '').toLowerCase().includes('trainer'));
    },
    isDirectorEmployee(person, directorId) {
      const targetId = String(directorId || '').trim();
      const id = String(person && (person.id || person.userId || person.user_id || person.playerId) || '').trim();
      if (targetId && id && id === targetId) return true;
      return String(person && person.role || '').toLowerCase().includes('director');
    },
    staffEmployees(rows, directorId) {
      return (rows || []).filter((person) => !Company.isDirectorEmployee(person, directorId));
    },
    profileHeadcount(profile) {
      const row = profile || {};
      const employees = row.employees || [];
      if (employees.length) return employees.length;
      return Utils.int(row.currentEmployees, 0);
    },
    profileStaffCount(profile) {
      const row = profile || {};
      const directorId = String(row.directorId || '').trim();
      const employees = row.employees || [];
      if (employees.length) return Company.staffEmployees(employees, directorId).length;
      const rawCount = Utils.int(row.currentEmployees, 0);
      return directorId && rawCount ? Math.max(0, rawCount - 1) : rawCount;
    },
    syncTrainingSetup(state) {
      const profile = state.company && state.company.profile ? state.company.profile : {};
      const rows = []
        .concat(state.staff && state.staff.current ? state.staff.current : [])
        .concat(profile.employees || []);
      const rating = Utils.int(profile.rating, 0);
      if (rating) state.settings.companyStars = Utils.clamp(rating, 1, 10);
      if (state.settings.trainerAutoDetect !== false) state.settings.trainerAssigned = Company.hasTrainerRole(rows);
      const trainerBonus = state.settings.trainerAssigned ? 1 : 0;
      const maxCap = Math.min(8 + trainerBonus, Utils.clamp(Utils.int(state.settings.companyStars, 1), 1, 10) + trainerBonus);
      state.settings.maxPaidTrainsPerDay = Utils.clamp(Utils.int(state.settings.maxPaidTrainsPerDay, maxCap), 0, maxCap);
    },
    companyStartTimestamp(value) {
      if (value === undefined || value === null || value === '') return 0;
      const raw = String(value).trim();
      if (!raw) return 0;
      if (/^\d+$/.test(raw)) {
        const timestamp = Utils.int(raw, 0);
        return timestamp >= 946684800 ? timestamp : 0;
      }
      return Utils.dateTimestamp(raw);
    },
    profile(data, state) {
      const source = Company.selection(data, 'profile') || {};
      const sourceEmployees = source.employees || source.company_employees;
      const profileEmployees = sourceEmployees && (Array.isArray(sourceEmployees) || Object.values(sourceEmployees).some((employee) => employee && typeof employee === 'object' && (employee.id || employee.user_id || employee.name || employee.position)))
        ? sourceEmployees
        : null;
      const employees = Company.employeeRows(profileEmployees || Company.selection(data, 'employees'));
      const typeRaw = Company.first(source, ['company_type', 'companyType', 'type'], '');
      const typeId = Utils.int(Company.first(source, ['company_type_id', 'companyTypeId', 'type_id'], (typeRaw && typeof typeRaw === 'object' ? Company.first(typeRaw, ['id', 'type_id'], 0) : typeRaw)), 0);
      const directorRaw = Company.first(source, ['director_id', 'directorId', 'director.id', 'director.user_id', 'director'], '');
      const ageDays = Utils.int(Company.first(source, ['age', 'company_age', 'companyAge', 'days_old'], 0), 0);
      const foundedRaw = Company.first(source, ['founded', 'created', 'created_at', 'start_date'], 0);
      const foundedTimestamp = Company.companyStartTimestamp(foundedRaw);
      const earliestTimestamp = foundedTimestamp || (ageDays ? Math.floor(Date.now() / 1000) - ageDays * 86400 : 0);
      const rating = Utils.int(Company.first(source, ['rating', 'stars', 'rank'], state.settings.companyStars), state.settings.companyStars);
      const directorId = String(directorRaw && typeof directorRaw === 'object' ? Company.first(directorRaw, ['id', 'user_id'], '') : directorRaw || state.settings.userId || '');
      const rawCurrentEmployees = Utils.int(Company.first(source, ['employees_hired', 'employeesHired', 'current_employees', 'employees_current', 'employees.hired'], employees.length), employees.length);
      const currentEmployees = employees.length ? employees.length : rawCurrentEmployees;
      const maxEmployees = Utils.int(Company.first(source, ['employees_capacity', 'employeesCapacity', 'max_employees', 'maxEmployees', 'staff_capacity', 'employees.capacity'], 0), 0);
      const profile = {
        lastSynced: Utils.nowIso(),
        id: String(Company.first(source, ['company_id', 'companyId', 'id', 'ID'], state.settings.companyId || '') || ''),
        name: String(Company.first(source, ['name', 'company_name', 'companyName'], state.company.profile.name || '') || ''),
        typeId: typeId ? String(typeId) : String(state.settings.companyTypeId || ''),
        typeName: Company.typeName(typeId, typeRaw) || state.settings.companyTypeName || '',
        directorId,
        rating,
        ageDays,
        foundedAt: earliestTimestamp ? Utils.dateShort(earliestTimestamp) : '',
        foundedTimestamp: earliestTimestamp,
        currentEmployees,
        maxEmployees,
        dailyIncome: Utils.num(Company.first(source, ['daily_income', 'dailyIncome', 'income_daily', 'income.today'], 0), 0),
        dailyCustomers: Utils.int(Company.first(source, ['daily_customers', 'dailyCustomers', 'customers_daily', 'customers.today'], 0), 0),
        weeklyIncome: Utils.num(Company.first(source, ['weekly_income', 'weeklyIncome', 'income_weekly', 'income.week'], 0), 0),
        weeklyCustomers: Utils.int(Company.first(source, ['weekly_customers', 'weeklyCustomers', 'customers_weekly', 'customers.week'], 0), 0),
        employees
      };
      return { profile, earliestTimestamp };
    },
    detailed(data, state) {
      const source = Company.selection(data, 'detailed') || {};
      const upgrades = source.upgrades || {};
      const previous = state && state.company && state.company.detailed ? state.company.detailed : {};
      const adBudgetKeys = ['advertising_budget', 'advertisingBudget', 'advertisement_budget', 'advertising'];
      const advertisingBudgetKnown = Company.hasAny(source, adBudgetKeys) || previous.advertisingBudgetKnown === true || Utils.num(previous.advertisingBudget, 0) > 0;
      return {
        lastSynced: Utils.nowIso(),
        id: String(Company.first(source, ['company_id', 'companyId', 'id', 'ID'], state.settings.companyId || '') || ''),
        funds: Utils.num(Company.first(source, ['funds', 'company_funds'], previous.funds), 0),
        bank: Utils.num(Company.first(source, ['bank', 'company_bank'], previous.bank), 0),
        popularity: Utils.percent(Company.first(source, ['popularity'], previous.popularity), 0),
        efficiency: Utils.percent(Company.first(source, ['efficiency'], previous.efficiency), 0),
        environment: Utils.percent(Company.first(source, ['environment'], previous.environment), 0),
        trainsAvailable: Utils.clamp(Utils.int(Company.first(source, ['trains_available', 'training_available', 'trainsAvailable', 'trains'], previous.trainsAvailable), 0), 0, 20),
        advertisingBudget: Utils.num(Company.first(source, adBudgetKeys, previous.advertisingBudget), 0),
        advertisingBudgetKnown,
        companySize: String(Company.first(upgrades, ['company_size', 'companySize', 'size'], previous.companySize) || ''),
        staffroomSize: String(Company.first(upgrades, ['staffroom_size', 'staffroomSize', 'staffroom', 'staff_room'], previous.staffroomSize) || ''),
        storageSize: String(Company.first(upgrades, ['storage_size', 'storageSize', 'storage'], previous.storageSize) || ''),
        storageSpace: Utils.num(Company.first(source, ['storage_space', 'storageSpace', 'storage_capacity', 'storageCapacity', 'upgrades.storage_space', 'upgrades.storage_capacity'], previous.storageSpace), 0),
        value: Utils.num(Company.first(source, ['value', 'company_value', 'companyValue'], previous.value), 0)
      };
    },
    stock(data, existingItems, state) {
      const existing = new Map((existingItems || []).map((item) => [String(item.key), item]));
      const savedSettings = Store.normaliseStockSettings(state && state.company && state.company.stockSettings || {});
      const source = Company.selection(data, 'stock') || {};
      const stockKeys = ['cost', 'rrp', 'price', 'in_stock', 'inStock', 'on_order', 'onOrder', 'sold_amount', 'soldAmount', 'sold_worth', 'soldWorth'];
      const pickStock = (value) => {
        if (!value || typeof value !== 'object') return null;
        if (value.company_stock && typeof value.company_stock === 'object') return value.company_stock;
        if (value.stock && typeof value.stock === 'object') return value.stock;
        if (value.stocks && typeof value.stocks === 'object') return value.stocks;
        const looksLikeStock = Object.values(value).some((entry) => entry && typeof entry === 'object' && stockKeys.some((key) => Object.prototype.hasOwnProperty.call(entry, key)));
        return looksLikeStock ? value : null;
      };
      const rawStock = pickStock(source) || pickStock(data) || {};
      const defaultCapacity = Utils.num(state && state.company && state.company.detailed && state.company.detailed.storageSpace, 0);
      const rows = Array.isArray(rawStock)
        ? rawStock.map((item, index) => [String(item.id || item.name || index), item])
        : Object.entries(rawStock || {}).filter(([, item]) => item && typeof item === 'object' && stockKeys.some((key) => Object.prototype.hasOwnProperty.call(item, key)));
      const items = rows.map(([key, item]) => {
        item = item && typeof item === 'object' ? item : { name: key, in_stock: item };
        const previous = existing.get(String(key)) || {};
        const saved = savedSettings[String(key)] || {};
        const rawName = String(item.name || item.item || item.service || previous.name || key);
        const name = rawName.replace(/\bstock\b/ig, '').replace(/\s+/g, ' ').trim() || rawName;
        const cost = Utils.num(item.cost, 0);
        return {
          key: String(key),
          name: String(name),
          label: previous.label || String(name),
          cost,
          rrp: Utils.num(item.rrp, 0),
          price: Utils.num(item.price, 0),
          inStock: Utils.num(item.in_stock || item.inStock, 0),
          onOrder: Utils.num(item.on_order || item.onOrder, 0),
          soldAmount: Utils.num(item.sold_amount || item.soldAmount, 0),
          soldWorth: Utils.num(item.sold_worth || item.soldWorth, 0),
          capacity: Utils.num(previous.capacity || item.capacity || item.max_stock || item.maxStock || defaultCapacity, 0),
          needsStock: cost > 0 ? Boolean(Object.prototype.hasOwnProperty.call(saved, 'needsStock') ? saved.needsStock : previous.needsStock) : false,
          warningPercent: Object.prototype.hasOwnProperty.call(saved, 'warningPercent') ? saved.warningPercent : previous.warningPercent || 10,
          warningAmount: Object.prototype.hasOwnProperty.call(saved, 'warningAmount') ? saved.warningAmount : previous.warningAmount || 0,
          warningMode: saved.warningMode || previous.warningMode || 'percent',
          restockQty: Object.prototype.hasOwnProperty.call(saved, 'restockQty') ? saved.restockQty : (previous.restockQty !== undefined ? previous.restockQty : '')
        };
      }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      return { lastSynced: Utils.nowIso(), items };
    },
    isRestockableStock(item) {
      return Utils.num(item && item.cost, 0) > 0;
    },
    stockDemand(item) {
      const soldAmount = Utils.num(item && item.soldAmount, 0);
      if (soldAmount > 0) return soldAmount;
      const soldWorth = Utils.num(item && item.soldWorth, 0);
      if (soldWorth > 0) return soldWorth;
      return 1;
    },
    stockPlan(state) {
      const items = state && state.company && state.company.stock ? (state.company.stock.items || []) : [];
      const capacity = Utils.num(state && state.company && state.company.detailed && state.company.detailed.storageSpace, 0);
      const restockable = items.filter((item) => Company.isRestockableStock(item));
      const currentStorage = restockable.reduce((sum, item) => sum + Utils.num(item.inStock, 0), 0);
      const pendingStorage = restockable.reduce((sum, item) => sum + Utils.num(item.onOrder, 0), 0);
      const totalDemand = restockable.reduce((sum, item) => sum + Company.stockDemand(item), 0) || restockable.length || 1;
      const targetByKey = new Map();
      let allocated = 0;
      const fractions = [];
      restockable.forEach((item) => {
        const exact = capacity > 0 ? (capacity * Company.stockDemand(item) / totalDemand) : 0;
        const base = Math.floor(exact);
        targetByKey.set(item.key, base);
        allocated += base;
        fractions.push({ key: item.key, fraction: exact - base, demand: Company.stockDemand(item) });
      });
      let remainder = Math.max(0, capacity - allocated);
      fractions.sort((a, b) => b.fraction - a.fraction || b.demand - a.demand || String(a.key).localeCompare(String(b.key)));
      for (let index = 0; index < fractions.length && remainder > 0; index += 1, remainder -= 1) {
        const row = fractions[index];
        targetByKey.set(row.key, Utils.num(targetByKey.get(row.key), 0) + 1);
      }
      const byKey = new Map();
      let orderQuantity = 0;
      let orderCost = 0;
      restockable.forEach((item) => {
        const targetStock = Utils.num(targetByKey.get(item.key), 0);
        const effectiveHeld = Utils.num(item.inStock, 0) + Utils.num(item.onOrder, 0);
        const suggestedQty = Math.max(0, targetStock - effectiveHeld);
        const manualSet = item.restockQty !== '' && item.restockQty !== null && item.restockQty !== undefined;
        const restockQty = manualSet ? Math.max(0, Utils.num(item.restockQty, 0)) : suggestedQty;
        const warningThreshold = item.warningMode === 'amount'
          ? Math.max(0, Utils.num(item.warningAmount, 0))
          : Math.ceil(targetStock * (Utils.percent(item.warningPercent, 10) / 100));
        byKey.set(item.key, {
          targetStock,
          suggestedQty,
          restockQty,
          warningThreshold,
          manualSet
        });
        orderQuantity += restockQty;
        orderCost += restockQty * Utils.num(item.cost, 0);
      });
      return {
        capacity,
        currentStorage,
        pendingStorage,
        projectedStorage: currentStorage + pendingStorage + orderQuantity,
        orderQuantity,
        orderCost,
        restockableCount: restockable.length,
        byKey
      };
    },
    stockWarnings(state) {
      const plan = Company.stockPlan(state);
      return (state.company.stock.items || []).filter((item) => {
        if (!Company.isRestockableStock(item) || !item.needsStock) return false;
        if (item.warningMode === 'amount') return Utils.num(item.inStock, 0) <= Math.max(0, Utils.num(item.warningAmount, 0));
        const row = plan.byKey.get(item.key);
        return row && row.warningThreshold > 0 ? Utils.num(item.inStock, 0) <= row.warningThreshold : false;
      });
    }
  };

  const Ledger = {
    companyPrefix(state) {
      const name = String(state && state.company && state.company.profile && state.company.profile.name || state && state.settings && state.settings.companyTypeName || 'PP').trim();
      const words = name.replace(/[^A-Za-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
      const initials = words.length > 1 ? words.map((word) => word[0]).join('') : (words[0] || 'PP').slice(0, 3);
      return (initials || 'PP').slice(0, 4).toUpperCase();
    },
    nextOrderId(state) {
      const prefix = `${Ledger.companyPrefix(state)}-TR`;
      const max = (state && state.ledger || []).reduce((highest, entry) => {
        const match = String(entry.orderId || '').match(/-TR-(\d+)$/i);
        return match ? Math.max(highest, Utils.int(match[1], 0)) : highest;
      }, 0);
      return `${prefix}-${max + 1}`;
    },
    ensureOrderIds(state) {
      if (!state || !Array.isArray(state.ledger)) return;
      const usedRowIds = new Set();
      const usedOrderIds = new Set();
      let highest = 0;
      state.ledger.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        if (!entry.id || usedRowIds.has(entry.id)) entry.id = Utils.id('train');
        usedRowIds.add(entry.id);
        const orderId = String(entry.orderId || '').trim();
        const match = orderId.match(/-TR-(\d+)$/i);
        if (orderId && !usedOrderIds.has(orderId)) {
          entry.orderId = orderId;
          usedOrderIds.add(orderId);
          if (match) highest = Math.max(highest, Utils.int(match[1], 0));
        } else {
          entry.orderId = '';
        }
      });
      const prefix = `${Ledger.companyPrefix(state)}-TR`;
      state.ledger.forEach((entry) => {
        if (!entry || entry.orderId) return;
        let next = '';
        do {
          highest += 1;
          next = `${prefix}-${highest}`;
        } while (usedOrderIds.has(next));
        entry.orderId = next;
        usedOrderIds.add(next);
      });
    },
    bindPlayerIds(state) {
      if (!state || !Array.isArray(state.ledger)) return;
      const people = Company.dedupePeople([]
        .concat(state.staff && state.staff.current || [])
        .concat(state.staff && state.staff.past || [])
        .concat(state.company && state.company.profile && state.company.profile.employees || []));
      const byId = new Map();
      const byName = new Map();
      people.forEach((person) => {
        if (!person) return;
        const id = String(person.id || person.userId || person.playerId || '').trim();
        if (id && !byId.has(id)) byId.set(id, person);
        [person.name, person.playerName].concat(person.aliases || []).forEach((name) => {
          const key = Company.nameKey(name);
          if (key && !byName.has(key)) byName.set(key, person);
        });
      });
      state.ledger.forEach((entry) => {
        if (!entry) return;
        const id = String(entry.playerId || '').trim();
        const nameKey = Company.nameKey(entry.playerName);
        const match = (id && byId.get(id)) || byName.get(nameKey) || (/^\d+$/.test(nameKey) ? byId.get(nameKey) : null);
        if (!match) return;
        if (match.id) entry.playerId = String(match.id);
        if (match.name) entry.playerName = match.name;
      });
    },
    prepare(state) {
      Ledger.ensureOrderIds(state);
      Ledger.bindPlayerIds(state);
    },
    fromForm(form, settings, state) {
      const entryDate = Utils.dateInput(form.entryDate ? form.entryDate.value : '') || Utils.todayInput();
      const createdAt = new Date(`${entryDate}T12:00:00`).toISOString();
      const payment = Utils.num(form.payment ? form.payment.value : 0, 0);
      const entry = {
        id: Utils.id('train'),
        orderId: state ? Ledger.nextOrderId(state) : '',
        playerName: form.playerName.value.trim(),
        playerId: form.playerId ? String(form.playerId.value || '').trim() : '',
        entryDate,
        contractType: payment > 0 ? 'paid' : (form.contractType ? form.contractType.value : 'paid'),
        payment,
        pricePerTrain: Utils.num(form.pricePerTrain.value, settings.trainingPrice),
        totalTrains: Math.max(0, Utils.int(form.totalTrains.value, 0)),
        usedTrains: Math.max(0, Utils.int(form.usedTrains ? form.usedTrains.value : 0, 0)),
        merits: Utils.clamp(Utils.int(form.merits.value, 0), 0, 10),
        manualDiscount: Utils.percent(form.manualDiscount.value, 0),
        applyDiscount: !form.applyDiscount || form.applyDiscount.checked,
        paid: form.paid && form.paid.checked,
        done: form.done && form.done.checked,
        createdAt,
        updatedAt: Utils.nowIso()
      };
      const totals = Ledger.totals(entry, settings);
      entry.done = entry.done || totals.remaining <= 0;
      return entry;
    },
    estimateTotalFromPayment(entry, settings) {
      const payment = Math.max(0, Utils.num(entry && entry.payment, 0));
      if (!payment) return 0;
      const seed = Object.assign({}, entry, { done: false });
      let estimate = Math.max(1, Utils.int(seed.totalTrains, 1));
      for (let round = 0; round < 6; round += 1) {
        seed.totalTrains = estimate;
        const totals = Ledger.totals(seed, settings);
        const effectivePrice = Math.max(1, Math.ceil(totals.finalCost / Math.max(1, totals.totalTrains)));
        const next = Math.max(0, Math.floor(payment / effectivePrice));
        if (!next) return 0;
        if (next === estimate) return next;
        estimate = next;
      }
      return estimate;
    },
    parseLoyalty(settings) {
      const source = Array.isArray(settings.loyaltyTiers) && settings.loyaltyTiers.length
        ? settings.loyaltyTiers
        : String(settings.loyaltyTiersText || '').split(',').map((chunk) => {
            const parts = chunk.split(':');
            return { min: parts[0], percent: parts[1] };
          });
      return source
        .map((tier) => ({ min: Math.max(0, Utils.int(tier.min, 0)), percent: Utils.percent(tier.percent, 0) }))
        .filter((tier) => tier.min > 0 && tier.percent > 0)
        .sort((a, b) => a.min - b.min);
    },
    loyaltyDiscount(entry, settings) {
      let discount = 0;
      Ledger.parseLoyalty(settings).forEach((tier) => {
        if (Utils.int(entry.totalTrains, 0) >= tier.min) discount = tier.percent;
      });
      return Math.min(discount, Utils.percent(settings.loyaltyMaxDiscount, 10));
    },
    totals(entry, settings) {
      const totalTrains = Math.max(0, Utils.int(entry.totalTrains, 0));
      const usedTrains = Utils.clamp(Utils.int(entry.usedTrains, 0), 0, totalTrains);
      const rawRemaining = totalTrains - usedTrains;
      const remaining = entry.done ? 0 : rawRemaining;
      const price = Math.max(0, Utils.num(entry.pricePerTrain, settings.trainingPrice));
      const baseCost = totalTrains * price;
      const applyDiscount = settings.discountsEnabled !== false && entry.applyDiscount !== false;
      const meritDiscount = applyDiscount ? Math.min(Utils.int(entry.merits, 0) * Utils.percent(settings.meritDiscountRate, 1), Utils.percent(settings.maxMeritDiscount, 10)) : 0;
      const manualDiscount = Utils.percent(entry.manualDiscount, 0);
      const totalDiscount = applyDiscount
        ? (manualDiscount > 0
          ? manualDiscount
          : Math.min(
            meritDiscount + Ledger.loyaltyDiscount(entry, settings) + Utils.percent(settings.globalPromoDiscount, 0),
            Utils.percent(settings.maxTotalDiscount, 90)
          ))
        : 0;
      const finalCost = Math.max(0, Math.round(baseCost * (1 - totalDiscount / 100)));
      const payment = Math.max(0, Utils.num(entry.payment, 0));
      const paid = entry.paid === undefined || entry.paid === null ? payment >= finalCost : Boolean(entry.paid);
      return {
        totalTrains,
        usedTrains,
        remaining,
        price,
        baseCost,
        meritDiscount,
        totalDiscount,
        finalCost,
        payment,
        balance: payment - finalCost,
        paid,
        done: Boolean(entry.done) || rawRemaining <= 0
      };
    },
    summary(entries, settings) {
      return entries.reduce((sum, entry) => {
        const totals = Ledger.totals(entry, settings);
        sum.entries += 1;
        sum.trains += totals.totalTrains;
        sum.used += totals.usedTrains;
        sum.remaining += totals.remaining;
        sum.due += Math.max(0, -totals.balance);
        sum.paidValue += totals.payment;
        sum.finalCost += totals.finalCost;
        if (entry.contractType === 'sponsored') sum.sponsored += totals.remaining;
        if (entry.contractType === 'paid' && totals.paid) sum.paidQueue += totals.remaining;
        if (entry.contractType === 'paid' && !totals.paid) sum.unpaidQueue += totals.remaining;
        return sum;
      }, { entries: 0, trains: 0, used: 0, remaining: 0, due: 0, paidValue: 0, finalCost: 0, paidQueue: 0, unpaidQueue: 0, sponsored: 0 });
    },
    syncTrainingLog(state) {
      Ledger.prepare(state);
      const userLogRows = (state.trainingLog || []).filter((row) => row.source === 'user_log' || row.source === 'mixed');
      const allLogs = Timeline.mergeTrainingRows(Timeline.trainingLogsFromEvents(state.staff.timeline, state).concat(userLogRows), state);
      const logs = Array.isArray(allLogs) ? allLogs : [];
      state.trainingLog = allLogs;
      Company.dedupeStaff(state);
      Company.removeDirectorsFromStaff(state);
      const identityMaps = Company.identityMaps(state);
      const countByIdentity = logs.reduce((map, row) => {
        const identity = Company.resolveIdentity(row, state, identityMaps);
        map.set(identity, (map.get(identity) || 0) + Utils.int(row.count, 0));
        return map;
      }, new Map());
      state.ledger.slice().sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))).forEach((entry) => {
        const identity = Company.resolveIdentity({ id: entry.playerId, name: entry.playerName }, state, identityMaps);
        const logged = countByIdentity.get(identity) || 0;
        if (!logged) return;
        const totalTrains = Math.max(0, Utils.int(entry.totalTrains, 0));
        const existingUsed = Utils.clamp(Utils.int(entry.usedTrains, 0), 0, totalTrains);
        let remaining = logged;
        const covered = Math.min(existingUsed, remaining);
        remaining -= covered;
        const allocated = Math.min(totalTrains - existingUsed, remaining);
        entry.usedTrains = existingUsed + allocated;
        if (!entry.playerId && identity.startsWith('id:')) entry.playerId = identity.slice(3);
        countByIdentity.set(identity, Math.max(0, remaining - allocated));
        entry.newsSyncedTrainCount = logged;
        entry.updatedAt = Utils.nowIso();
      });
      return logs;
    }
  };

  const Planner = {
    dailySupply(settings) {
      return Utils.clamp(Utils.int(settings.companyStars, 1), 1, 10) + (settings.trainerAssigned ? 1 : 0);
    },
    paidCapLimit(settings) {
      return Math.min(8 + (settings.trainerAssigned ? 1 : 0), Planner.dailySupply(settings));
    },
    trainingHoldDays() {
      return 3;
    },
    currentRosterContext(state) {
      const current = state && state.staff ? state.staff.current || [] : [];
      const profileEmployees = state && state.company && state.company.profile ? state.company.profile.employees || [] : [];
      const directorId = state && state.company && state.company.profile
        ? state.company.profile.directorId || state.settings.userId || ''
        : (state && state.settings ? state.settings.userId || '' : '');
      const roster = Company.staffEmployees(Company.mergeStaff(current, profileEmployees), directorId);
      const identityMaps = Company.identityMaps(state);
      const byIdentity = new Map();
      roster.forEach((person) => {
        byIdentity.set(Company.resolveIdentity(person, state, identityMaps), person);
      });
      return { roster, identityMaps, byIdentity };
    },
    resolveRosterPerson(subject, state, context) {
      const rosterContext = context || Planner.currentRosterContext(state);
      const identity = Company.resolveIdentity(subject || {}, state, rosterContext.identityMaps);
      if (rosterContext.byIdentity.has(identity)) return rosterContext.byIdentity.get(identity);
      const wantedId = String(subject && (subject.id || subject.playerId || subject.userId || subject.user_id) || '').trim();
      const wantedName = Company.nameKey(subject && (subject.name || subject.playerName) || subject || '');
      return rosterContext.roster.find((person) => {
        const personId = String(person && person.id || '').trim();
        if (wantedId && personId && personId === wantedId) return true;
        if (!wantedName) return false;
        if (Company.nameKey(person.name) === wantedName || Company.nameKey(person.playerName) === wantedName) return true;
        return (person.aliases || []).some((alias) => Company.nameKey(alias) === wantedName);
      }) || null;
    },
    dateOffsetFromToday(referenceDate) {
      const reference = Utils.dateInput(referenceDate) || Utils.todayInput();
      const todayTs = Utils.dateTimestamp(Utils.todayInput());
      const referenceTs = Utils.dateTimestamp(reference);
      if (!todayTs || !referenceTs) return 0;
      return Math.max(0, Math.floor((referenceTs - todayTs) / 86400));
    },
    trainingEligibility(person, state, referenceDate) {
      const holdDays = Planner.trainingHoldDays();
      const reference = Utils.dateInput(referenceDate) || Utils.todayInput();
      if (!person) return { eligible: true, holdDays, hireDate: '', eligibleOn: '', tenureDays: null, remainingDays: 0, reason: '' };
      const hireDate = Utils.dateInput(Company.employmentStart(person));
      if (hireDate) {
        const tenureDays = Math.max(0, Utils.daysBetween(hireDate, reference) - 1);
        const eligibleOn = Utils.addDays(hireDate, holdDays);
        const eligible = reference >= eligibleOn;
        const remainingDays = eligible ? 0 : Math.max(1, Math.ceil((Utils.dateTimestamp(eligibleOn) - Utils.dateTimestamp(reference)) / 86400));
        return {
          eligible,
          holdDays,
          hireDate,
          eligibleOn,
          tenureDays,
          remainingDays,
          reason: eligible ? '' : `New-hire hold: available on ${Utils.dateShort(eligibleOn)}`
        };
      }
      const hasApiDays = person && person.daysInCompany !== undefined && person.daysInCompany !== null && person.daysInCompany !== '';
      if (hasApiDays) {
        const tenureDays = Math.max(0, Utils.int(person.daysInCompany, 0) + Planner.dateOffsetFromToday(reference));
        const eligible = tenureDays >= holdDays;
        const remainingDays = eligible ? 0 : Math.max(1, holdDays - tenureDays);
        return {
          eligible,
          holdDays,
          hireDate: '',
          eligibleOn: eligible ? reference : Utils.addDays(reference, remainingDays),
          tenureDays,
          remainingDays,
          reason: eligible ? '' : `New-hire hold: ${remainingDays} day${remainingDays === 1 ? '' : 's'} left`
        };
      }
      return { eligible: true, holdDays, hireDate: '', eligibleOn: '', tenureDays: null, remainingDays: 0, reason: '' };
    },
    slotEligibility(slot, state, referenceDate, context) {
      const person = Planner.resolveRosterPerson({ id: slot && slot.playerId, name: slot && slot.playerName }, state, context);
      return Object.assign({ person }, Planner.trainingEligibility(person, state, referenceDate));
    },
    nextPaid(queue, state, referenceDate, context) {
      if (!Array.isArray(queue) || !queue.length) return null;
      for (let index = 0; index < queue.length; index += 1) {
        const slot = queue[index];
        if (!Planner.slotEligibility(slot, state, referenceDate, context).eligible) continue;
        return queue.splice(index, 1)[0];
      }
      return null;
    },
    holdCount(state, referenceDate) {
      return Planner.currentRosterContext(state).roster.reduce((sum, person) => {
        return sum + (Planner.trainingEligibility(person, state, referenceDate).eligible ? 0 : 1);
      }, 0);
    },
    sponsoredPeople(state) {
      return Planner.currentRosterContext(state).roster.filter((person) => {
        const contract = String(person && person.contractType || '').toLowerCase();
        return person && contract !== 'paid' && contract !== 'terminated';
      });
    },
    rotationOrder(state, roster) {
      const previous = state && state.planner && state.planner.sponsoredRotation && Array.isArray(state.planner.sponsoredRotation.order)
        ? state.planner.sponsoredRotation.order.map((value) => String(value || '')).filter(Boolean)
        : [];
      const previousIndex = new Map(previous.map((identity, index) => [identity, index]));
      const ordered = (roster || []).slice().sort((a, b) => Planner.compareSponsored(a, b)
        || (previousIndex.has(String(a && a.identity || '')) ? previousIndex.get(String(a.identity)) : Number.MAX_SAFE_INTEGER)
          - (previousIndex.has(String(b && b.identity || '')) ? previousIndex.get(String(b.identity)) : Number.MAX_SAFE_INTEGER));
      if (state && state.planner) {
        state.planner.sponsoredRotation = state.planner.sponsoredRotation || Utils.clone(DEFAULTS.planner.sponsoredRotation);
        state.planner.sponsoredRotation.order = ordered.map((row) => row.identity);
      }
      return ordered;
    },
    roleKey(role) {
      return String(role || 'Employee').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'employee';
    },
    templateRoleKey(role) {
      const key = Planner.roleKey(role);
      if (key.includes('manager')) return 'manager';
      if (key.includes('reception')) return 'receptionist';
      if (key.includes('technician')) return 'technician';
      return key;
    },
    companyRoleTargets(state) {
      const profile = state && state.company && state.company.profile || {};
      const typeId = String(profile.typeId || state && state.settings && state.settings.companyTypeId || '').trim();
      const typeName = String(profile.typeName || state && state.settings && state.settings.companyTypeName || '').toLowerCase();
      if (typeId === '30' || typeName.includes('mechanic shop')) {
        return {
          source: 'Mechanic Shop profit structure',
          roles: {
            manager: { label: 'Manager', target: 1 },
            receptionist: { label: 'Receptionist', target: 2 },
            technician: { label: 'Technician', target: 7 }
          }
        };
      }
      return null;
    },
    roleFitScore(person, roleKey) {
      const man = Utils.num(person && person.man, 0);
      const int = Utils.num(person && person.int, 0);
      const end = Utils.num(person && person.end, 0);
      if (roleKey === 'manager') return (man + int + end) + int * 0.4 + end * 0.2;
      if (roleKey === 'receptionist') return int * 2 + end + man * 0.4;
      if (roleKey === 'technician') return man + end * 1.2 + int * 0.3;
      return man + int + end;
    },
    roleTemplateStatus(person, state) {
      const template = Planner.companyRoleTargets(state);
      if (!template) return null;
      const identityMaps = Company.identityMaps(state);
      const personIdentity = Company.resolveIdentity(person || {}, state, identityMaps);
      const counts = Object.keys(template.roles).reduce((next, key) => {
        next[key] = 0;
        return next;
      }, {});
      Planner.currentRosterContext(state).roster.forEach((row) => {
        const identity = Company.resolveIdentity(row || {}, state, identityMaps);
        if (identity && personIdentity && identity === personIdentity) return;
        const key = Planner.templateRoleKey(row && row.role);
        if (counts[key] !== undefined) counts[key] += 1;
      });
      const currentKey = Planner.templateRoleKey(person && person.role);
      const targetKeys = Object.keys(template.roles);
      const shortages = targetKeys.filter((key) => counts[key] < template.roles[key].target);
      let key = '';
      if (template.roles[currentKey] && counts[currentKey] < template.roles[currentKey].target) key = currentKey;
      if (!key && shortages.length) {
        shortages.sort((a, b) => Planner.roleFitScore(person, b) - Planner.roleFitScore(person, a) || template.roles[b].target - template.roles[a].target);
        key = shortages[0];
      }
      if (!key && template.roles[currentKey]) key = currentKey;
      if (!key) {
        targetKeys.sort((a, b) => Planner.roleFitScore(person, b) - Planner.roleFitScore(person, a) || template.roles[b].target - template.roles[a].target);
        key = targetKeys[0];
      }
      const target = template.roles[key];
      return {
        key,
        label: target.label,
        source: template.source,
        count: counts[key],
        target: target.target,
        shortage: Math.max(0, target.target - counts[key]),
        fit: Planner.roleFitScore(person, key)
      };
    },
    trainingNeed(person, state) {
      const templateStatus = Planner.roleTemplateStatus(person, state);
      const roleKey = templateStatus ? templateStatus.key : Planner.roleKey(person && person.role);
      const req = state && state.settings && state.settings.wageRoleRequirements && state.settings.wageRoleRequirements[roleKey]
        ? state.settings.wageRoleRequirements[roleKey]
        : {};
      const man = Utils.num(person && person.man, 0);
      const int = Utils.num(person && person.int, 0);
      const end = Utils.num(person && person.end, 0);
      const reqMan = Utils.num(req.man, 0);
      const reqInt = Utils.num(req.int, 0);
      const reqEnd = Utils.num(req.end, 0);
      const requiredTotal = reqMan + reqInt + reqEnd;
      const gap = Math.max(0, reqMan - man) + Math.max(0, reqInt - int) + Math.max(0, reqEnd - end);
      const total = man + int + end;
      if (templateStatus) {
        const shortageBoost = templateStatus.shortage > 0 ? 500000 : 0;
        return {
          score: 2000000 + shortageBoost - total,
          gap,
          total,
          requiredTotal,
          summary: `${templateStatus.label}: ${total.toLocaleString()} total stats${templateStatus.shortage ? `; ${templateStatus.shortage} target slot${templateStatus.shortage === 1 ? '' : 's'} open` : ''}`
        };
      }
      if (requiredTotal > 0) {
        return {
          score: gap > 0 ? 1000000 + gap : Math.max(0, requiredTotal - total),
          gap,
          total,
          requiredTotal,
          summary: gap > 0 ? `needs ${gap.toLocaleString()} role stats` : `meets role requirements; ${total.toLocaleString()} stats`
        };
      }
      return {
        score: Math.max(0, 1000000 - total),
        gap: 0,
        total,
        requiredTotal: 0,
        summary: `${total.toLocaleString()} total stats`
      };
    },
    rotateSponsoredIdentity(state, identity) {
      const key = String(identity || '').trim();
      if (!key || !state || !state.planner) return;
      state.planner.sponsoredRotation = state.planner.sponsoredRotation || Utils.clone(DEFAULTS.planner.sponsoredRotation);
      const order = Array.isArray(state.planner.sponsoredRotation.order) ? state.planner.sponsoredRotation.order.slice() : [];
      const index = order.indexOf(key);
      if (index >= 0) {
        order.splice(index, 1);
        order.push(key);
      } else {
        order.push(key);
      }
      state.planner.sponsoredRotation.order = order;
      state.planner.sponsoredRotation.lastTrainedIdentity = key;
      state.planner.sponsoredRotation.updatedAt = Utils.nowIso();
    },
    queue(entries, type, settings) {
      const slots = [];
      entries
        .filter((entry) => {
          const totals = Ledger.totals(entry, settings);
          return entry.contractType === type && !totals.done && (type !== 'paid' || totals.paid);
        })
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
        .forEach((entry) => {
          const remaining = Ledger.totals(entry, settings).remaining;
          for (let index = 0; index < remaining; index += 1) {
            slots.push({ entryId: entry.id, playerId: entry.playerId || '', playerName: entry.playerName || 'Unnamed player', type });
          }
        });
      return slots;
    },
    sponsoredRoster(state, options) {
      const opts = options || {};
      const riskAware = !!opts.riskAware;
      const priorityMode = Planner.companyRoleTargets(state) ? 'lowest_stats' : 'need';
      const identityMaps = Company.identityMaps(state);
      const loggedByIdentity = new Map();
      (Array.isArray(state.trainingLog) ? state.trainingLog : []).forEach((row) => {
        const identity = Company.resolveIdentity(row, state, identityMaps);
        loggedByIdentity.set(identity, (loggedByIdentity.get(identity) || 0) + Utils.int(row.count, 0));
      });
      const ledgerUsedByIdentity = new Map();
      (state.ledger || []).forEach((entry) => {
        const identity = Company.resolveIdentity({ id: entry.playerId, name: entry.playerName }, state, identityMaps);
        ledgerUsedByIdentity.set(identity, (ledgerUsedByIdentity.get(identity) || 0) + Ledger.totals(entry, state.settings).usedTrains);
      });
      const roster = Planner.sponsoredPeople(state)
        .map((person) => {
          const identity = Company.resolveIdentity(person, state, identityMaps);
          const str = Math.max(Utils.int(loggedByIdentity.get(identity), 0), Utils.int(ledgerUsedByIdentity.get(identity), 0));
          const risk = riskAware ? Planner.trainingRisk(person, state, opts.referenceDate) : { penalty: 0, level: 0, summary: '' };
          const need = Planner.trainingNeed(person, state);
          return {
            identity,
            playerId: person.id || '',
            playerName: person.name || person.id || 'Sponsored staff',
            role: person.role || 'Employee',
            personRef: person,
            str,
            virtualStr: str,
            needScore: need.score,
            statGap: need.gap,
            statTotal: need.total,
            statNeedSummary: need.summary,
            priorityMode,
            riskPenalty: risk.penalty,
            riskLevel: risk.level,
            riskSummary: risk.summary
          };
        })
        .sort(Planner.compareSponsored);
      const ordered = Planner.rotationOrder(state, roster);
      ordered.cursor = 0;
      return ordered;
    },
    compareSponsored(a, b) {
      if ((a && a.priorityMode) === 'lowest_stats' || (b && b.priorityMode) === 'lowest_stats') {
        const projectedTotal = (row) => {
          const total = Utils.num(row && row.statTotal, 0);
          const knownTotal = total > 0 ? total : 1000000000;
          return knownTotal + (Utils.num(row && row.virtualStr, 0) * 10000000) + (Utils.num(row && row.riskPenalty, 0) * 10000000);
        };
        const totalDelta = projectedTotal(a) - projectedTotal(b);
        if (totalDelta) return totalDelta;
      }
      const projectedNeed = (row) => Utils.num(row && row.needScore, 0) - (Utils.num(row && row.virtualStr, 0) * 100000);
      const needDelta = projectedNeed(b) - projectedNeed(a);
      if (needDelta) return needDelta;
      const scoreA = Utils.num(a && a.virtualStr, 0) + Utils.num(a && a.riskPenalty, 0);
      const scoreB = Utils.num(b && b.virtualStr, 0) + Utils.num(b && b.riskPenalty, 0);
      return scoreA - scoreB
        || Utils.num(a && a.virtualStr, 0) - Utils.num(b && b.virtualStr, 0)
        || String(a && a.playerName || '').localeCompare(String(b && b.playerName || ''));
    },
    inactivityReviewStart(referenceValue) {
      const base = Utils.dateObject(referenceValue || new Date()) || new Date();
      const start = new Date(base.getTime());
      const day = start.getDay() || 7;
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - day + 1);
      if (day === 1) start.setDate(start.getDate() - 7);
      return start;
    },
    inactivityReviewDays(referenceValue) {
      const base = Utils.dateObject(referenceValue || new Date()) || new Date();
      const start = Planner.inactivityReviewStart(base);
      const span = Math.floor((base.getTime() - start.getTime()) / 86400000) + 1;
      return Math.max(1, span);
    },
    trainingRisk(person, state, referenceValue) {
      const settings = (state && state.settings && state.settings.notifications) || DEFAULTS.settings.notifications;
      const plannerPriority = (state && state.settings && state.settings.plannerPriority) || DEFAULTS.settings.plannerPriority;
      const addictionThreshold = Math.max(1, Utils.num(settings.addiction && settings.addiction.threshold, 4));
      const inactivityThreshold = Math.max(1, Utils.int(settings.inactivity && settings.inactivity.thresholdDays, 3));
      const addictionEnabled = plannerPriority.addictionEnabled !== false;
      const inactivityEnabled = plannerPriority.inactivityEnabled !== false;
      const addictionWeight = Math.max(0, Utils.num(plannerPriority.addictionWeight, 1));
      const inactivityWeight = Math.max(0, Utils.num(plannerPriority.inactivityWeight, 1));
      const addiction = typeof UI !== 'undefined' && UI.personAddiction ? UI.personAddiction(person) : Math.abs(Utils.num(person && person.addiction, 0));
      const inactivityDays = typeof UI !== 'undefined' && UI.personInactiveDays ? UI.personInactiveDays(person) : Utils.int(person && person.inactiveDays, 0);
      const reviewDays = Planner.inactivityReviewDays(referenceValue || Utils.todayInput());
      const recentInactiveDays = Math.min(inactivityDays, reviewDays);
      let penalty = 0;
      let level = 0;
      const reasons = [];
      if (addictionEnabled && addiction > addictionThreshold) {
        penalty += addictionWeight;
        level = Math.max(level, 2);
        reasons.push(`addiction ${addiction}`);
      } else if (addictionEnabled && addiction >= addictionThreshold) {
        penalty += 0.5 * addictionWeight;
        level = Math.max(level, 1);
        reasons.push(`addiction ${addiction}`);
      }
      if (inactivityEnabled && recentInactiveDays > inactivityThreshold) {
        penalty += inactivityWeight;
        level = Math.max(level, 2);
        reasons.push(`inactive ${recentInactiveDays}d`);
      } else if (inactivityEnabled && recentInactiveDays >= inactivityThreshold) {
        penalty += 0.5 * inactivityWeight;
        level = Math.max(level, 1);
        reasons.push(`inactive ${recentInactiveDays}d`);
      }
      return {
        penalty,
        level,
        recentInactiveDays,
        reviewDays,
        summary: reasons.join(', ')
      };
    },
    sponsoredRiskSummary(state, referenceValue) {
      return Planner.sponsoredRoster(state, { riskAware: true, referenceDate: referenceValue }).reduce((sum, row) => {
        if (Utils.num(row.riskPenalty, 0) <= 0) return sum;
        sum.total += 1;
        if (Utils.int(row.riskLevel, 0) >= 2) sum.danger += 1;
        else sum.warn += 1;
        return sum;
      }, { total: 0, warn: 0, danger: 0, reviewDays: Planner.inactivityReviewDays(referenceValue || Utils.todayInput()) });
    },
    nextSponsored(roster, picked, state, referenceDate) {
      const total = Array.isArray(roster) ? roster.length : 0;
      if (!total) return null;
      roster.sort(Planner.compareSponsored);
      const start = 0;
      let row = null;
      let rowIndex = -1;
      for (let offset = 0; offset < total; offset += 1) {
        const index = (start + offset) % total;
        const candidate = roster[index];
        if (!candidate || picked.has(candidate.identity)) continue;
        if (!Planner.trainingEligibility(candidate.personRef || candidate, state, referenceDate).eligible) continue;
        row = candidate;
        rowIndex = index;
        break;
      }
      if (!row) return null;
      roster.cursor = (rowIndex + 1) % total;
      row.virtualStr += 1;
      return {
        identity: row.identity,
        playerId: row.playerId,
        playerName: row.playerName,
        type: 'sponsored',
        source: 'rotation',
        strBefore: row.virtualStr - 1,
        role: row.role,
        statGap: row.statGap,
        statTotal: row.statTotal,
        statNeedSummary: row.statNeedSummary,
        riskPenalty: row.riskPenalty,
        riskLevel: row.riskLevel,
        riskSummary: row.riskSummary
      };
    },
    allowedMode(state) {
      const requested = ['auto', 'manual', 'hybrid'].includes(state.planner.mode) ? state.planner.mode : 'auto';
      return requested;
    },
    build(state) {
      const startDate = state.planner.startDate || Utils.todayInput();
      const daysToPlan = Utils.clamp(Utils.int(state.planner.daysToPlan, 14), 1, 60);
      const mode = Planner.allowedMode(state);
      if (state.planner.mode !== mode) state.planner.mode = mode;
      const supply = Planner.dailySupply(state.settings);
      const paidCapLimit = Planner.paidCapLimit(state.settings);
      const paidLimit = Utils.clamp(Utils.int(state.settings.maxPaidTrainsPerDay, paidCapLimit), 0, paidCapLimit);
      const rosterContext = Planner.currentRosterContext(state);
      const plannerLedger = Array.isArray(state.ledger) ? state.ledger : [];
      const paidQueue = mode === 'manual' ? [] : Planner.queue(plannerLedger, 'paid', state.settings);
      const sponsoredQueue = mode === 'manual' ? [] : Planner.sponsoredRoster(state, { riskAware: mode === 'auto', referenceDate: startDate });
      const days = [];
      for (let dayIndex = 0; dayIndex < daysToPlan; dayIndex += 1) {
        const dayDate = Utils.addDays(startDate, dayIndex);
        const slots = [];
        const suggestions = [];
        const picked = new Set();
        while (slots.length < Math.min(paidLimit, supply) && paidQueue.length) {
          const next = Planner.nextPaid(paidQueue, state, dayDate, rosterContext);
          if (!next) break;
          slots.push(next);
          picked.add(Company.resolveIdentity({ id: next.playerId, name: next.playerName }, state));
        }
        while (slots.length < supply && sponsoredQueue.length) {
          const sponsored = Planner.nextSponsored(sponsoredQueue, picked, state, dayDate);
          if (!sponsored) break;
          if (mode === 'auto') slots.push(sponsored);
          else suggestions.push(sponsored);
          picked.add(sponsored.identity || Company.resolveIdentity({ id: sponsored.playerId, name: sponsored.playerName }, state));
          if (mode !== 'auto' && slots.length + suggestions.length >= supply) break;
        }
        days.push({ date: dayDate, supply, mode, slots, suggestions });
      }
      state.planner.generatedAt = Utils.nowIso();
      state.planner.days = days;
    }
  };

  const Timeline = {
    normaliseNews(data) {
      const source = data && (data.news || data.companynews || data.events || data.log || data);
      if (!source) return [];
      const rows = Array.isArray(source)
        ? source.map((item) => {
          const id = item && item.id ? String(item.id) : '';
          return { id, sourceEventId: id, item };
        })
        : Object.entries(source).map(([key, item]) => {
          const id = item && item.id ? String(item.id) : String(key || '');
          return { id, sourceEventId: id, item };
        });
      return rows
        .map(({ id, sourceEventId, item }) => {
          const text = item.news || item.text || item.message || item.event || '';
          const timestamp = Utils.int(item.timestamp || item.time || item.date, 0);
          const action = item.action || item.category || item.type || item.title || '';
          return text ? Timeline.parseEvent({ id: String(id || ''), sourceEventId: String(sourceEventId || ''), text: String(text), timestamp, action: String(action) }) : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.timestamp - a.timestamp);
    },
    parseEvent(item) {
      const text = item.text.replace(/\s+/g, ' ').trim();
      const plainText = Timeline.plainText(text);
      const anchors = Timeline.anchors(text);
      const linkedPlayer = anchors[0] ? anchors[0].text : '';
      const event = {
        id: item.id || item.sourceEventId || Utils.id('event'),
        sourceEventId: item.sourceEventId || item.id || '',
        timestamp: item.timestamp || 0,
        type: Timeline.typeFromAction(item.action, plainText),
        action: item.action || '',
        playerName: '',
        userId: '',
        value: '',
        text,
        plainText,
        createdAt: Utils.nowIso()
      };
      const patterns = [
        { type: 'hire', regex: /accepted (?:an? )?application (?:from|by) ([^.,]+)/i, preferMatch: true },
        { type: 'hire', regex: /accepted ([^.,]+?)'s application/i, preferMatch: true },
        { type: 'hire', regex: /(.+?)\s+(?:has been hired|joined the company|was hired)/i, roleSubject: true, preferMatch: true },
        { type: 'application', regex: /application (?:from|by) ([^.,]+)/i },
        { type: 'application', regex: /([^.,]+) applied (?:to|for)/i },
        { type: 'left', regex: /(.+?)\s+(?:has\s+)?(?:left|quit|resigned from)\s+(?:the\s+)?company/i, roleSubject: true, preferMatch: true },
        { type: 'fired', regex: /(.+?)\s+(?:was|has been)\s+(?:fired|dismissed|removed|terminated|kicked)(?:\s+from\s+(?:the\s+)?company)?/i, roleSubject: true, preferMatch: true },
        { type: 'fired', regex: /(?:fired|dismissed|removed|terminated|kicked)\s+(?!from\s+(?:the\s+)?company\b)(.+?)(?:\s+from\s+(?:the\s+)?company|[.,:]|$)/i, roleSubject: true, preferMatch: true },
        { type: 'director', regex: /([^.,]+?) (?:is now|became|has become|was made|has been made) (?:the )?(?:new )?director/i },
        { type: 'director', regex: /director (?:changed|transferred).*?to ([^.,]+)/i },
        { type: 'director', regex: /([^.,]+?) started (?:the )?.+? company/i, preferMatch: true },
        { type: 'training', regex: /([^.,]+?) has been trained/i },
        { type: 'withdraw', regex: /([^.,]+) has withdrawn/i },
        { type: 'deposit', regex: /([^.,]+) has deposited/i },
        { type: 'rating', regex: /rating.*?(\d{1,2})(?:\s*stars?|\s*\/\s*10)?/i },
        { type: 'daily_report', regex: /((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday) report)/i },
        { type: 'weekly_report', regex: /(weekly report)/i }
      ];
      for (const pattern of patterns) {
        const match = plainText.match(pattern.regex);
        if (!match) continue;
        event.type = pattern.type;
        if (pattern.roleSubject) {
          const subject = Timeline.personSubject(match[1]);
          if (!subject.name) continue;
          event.value = subject.name;
          event.playerName = subject.name;
          if (subject.position) event.position = subject.position;
        } else {
          event.value = (pattern.preferMatch ? match[1] : (linkedPlayer || match[1])).trim();
          if (!['rating', 'daily_report', 'weekly_report'].includes(pattern.type)) event.playerName = event.value;
        }
        const anchor = Timeline.anchorFor(anchors, event.playerName || event.value);
        if (anchor && anchor.id) event.userId = anchor.id;
        break;
      }
      const roleChange = Timeline.roleChangeMatch(plainText, anchors);
      if (roleChange && !['director', 'training'].includes(event.type)) {
        event.type = 'role_change';
        event.playerName = roleChange.playerName || event.playerName;
        event.userId = roleChange.userId || event.userId;
        event.role = roleChange.role;
        event.value = roleChange.role;
      }
      if (event.type === 'training') {
        const match = plainText.match(/([^.,]+?) has been trained/i);
        if (match) {
          const subject = Timeline.personSubject(match[1]);
          event.playerName = subject.name;
          event.position = subject.position;
          event.value = event.playerName;
        }
        const anchor = Timeline.anchorFor(anchors, event.playerName) || anchors[0];
        if (anchor) {
          event.userId = anchor.id || event.userId;
          if (/^\d+$/.test(event.playerName) && anchor.text && !/^\d+$/.test(anchor.text)) event.playerName = anchor.text;
        }
        const countMatch = plainText.match(/(?:received|given|used)\s+(\d+)\s+trains?/i) || plainText.match(/\b(\d+)\s+trains?\b/i);
        event.trainCount = countMatch ? Math.max(1, Utils.int(countMatch[1], 1)) : 1;
      }
      if (Timeline.isDailyReportText(plainText)) {
        event.type = 'daily_report';
        event.playerName = '';
      }
      if (/weekly report/i.test(plainText) && /(income|customers|profit)/i.test(plainText)) {
        event.type = 'weekly_report';
        event.playerName = '';
      }
      if (/\b(company funds?|funds)\b/i.test(plainText) && /\b(withdrawn|withdraw|deposited|deposit|made a deposit)\b/i.test(plainText)) {
        event.type = 'funds';
        event.playerName = '';
        event.value = plainText.match(/\$[\d,]+/) ? plainText.match(/\$[\d,]+/)[0] : event.value;
      }
      return event;
    },
    plainText(html) {
      const template = document.createElement('template');
      template.innerHTML = String(html || '');
      return (template.content.textContent || '').replace(/\s+/g, ' ').trim();
    },
    firstAnchorText(html) {
      const anchor = Timeline.anchors(html)[0];
      return anchor ? anchor.text : '';
    },
    anchors(html) {
      const template = document.createElement('template');
      template.innerHTML = String(html || '');
      return Array.from(template.content.querySelectorAll('a')).map((link) => {
        const text = (link.textContent || '').replace(/\s+/g, ' ').trim();
        const href = link.getAttribute('href') || '';
        const match = href.match(/[?&]XID=(\d+)/i) || href.match(/profiles\.php\/?(\d+)/i) || href.match(/\/profiles\/(\d+)/i);
        return { text, href, id: match ? match[1] : (/^\d+$/.test(text) ? text : '') };
      }).filter((anchor) => anchor.text || anchor.id);
    },
    anchorFor(anchors, name) {
      const key = Company.nameKey(name);
      if (!key) return null;
      return (anchors || []).find((anchor) => Company.nameKey(anchor.text) === key || String(anchor.id || '') === String(name || '')) || null;
    },
    personSubject(value) {
      const clean = String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+(?:has\s+)?(?:left|quit|resigned from)\s+(?:the\s+)?company.*$/i, '')
        .replace(/\s+(?:was|has been)\s+(?:fired|dismissed|removed|terminated|kicked)(?:\s+from\s+(?:the\s+)?company.*)?$/i, '')
        .replace(/\s+from\s+(?:the\s+)?company.*$/i, '')
        .replace(/[.,;:]+$/g, '')
        .trim();
      if (Company.isFakeStaffName(clean)) return { name: '', position: '' };
      const parts = clean.split(' ').filter(Boolean);
      const name = parts.length > 1 ? parts[parts.length - 1] : clean;
      const position = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
      if (Company.isFakeStaffName(name)) return { name: '', position: '' };
      return { name, position };
    },
    cleanRoleText(value) {
      return String(value || '')
        .replace(/\s+(?:by|from)\s+.+$/i, '')
        .replace(/\s+(?:in|at)\s+the\s+company$/i, '')
        .replace(/\s+/g, ' ')
        .replace(/[.,;:]+$/g, '')
        .trim();
    },
    roleChangeMatch(text, anchors) {
      const clean = String(text || '').replace(/\s+/g, ' ').trim();
      const patterns = [
        { regex: /(?:changed|set|updated)\s+(?:the\s+)?(?:position|role|job)\s+(?:of|for)\s+(.+?)\s+(?:to|as)\s+(.+?)(?:\.|$)/i, player: 1, role: 2 },
        { regex: /changed\s+(.+?)'?s\s+(?:position|role|job)\s+(?:from\s+.+?\s+)?(?:to|as)\s+(.+?)(?:\.|$)/i, player: 1, role: 2 },
        { regex: /(.+?)'?s\s+(?:position|role|job)\s+(?:has been|was)?\s*(?:changed|set|updated)\s+(?:to|as)\s+(.+?)(?:\.|$)/i, player: 1, role: 2 },
        { regex: /(?:promoted|demoted|assigned|moved)\s+(.+?)\s+(?:to|as)\s+(.+?)(?:\.|$)/i, player: 1, role: 2 },
        { regex: /(.+?)\s+(?:has been|was)\s+(?:promoted|demoted|assigned|moved)\s+(?:to|as)\s+(.+?)(?:\.|$)/i, player: 1, role: 2 }
      ];
      for (const pattern of patterns) {
        const match = clean.match(pattern.regex);
        if (!match) continue;
        const playerName = Timeline.cleanRoleText(match[pattern.player]);
        const role = Timeline.cleanRoleText(match[pattern.role]);
        if (!playerName || !role || /\b(director|company)\b/i.test(playerName)) continue;
        const anchor = Timeline.anchorFor(anchors || [], playerName);
        return { playerName, role, userId: anchor && anchor.id ? anchor.id : '' };
      }
      return null;
    },
    logText(item) {
      if (!item || typeof item !== 'object') return String(item || '');
      const parts = [];
      ['text', 'log', 'message', 'description', 'title', 'event'].forEach((key) => {
        if (typeof item[key] === 'string' || typeof item[key] === 'number') parts.push(String(item[key]));
      });
      ['data', 'details', 'params', 'changes'].forEach((key) => {
        if (item[key] && typeof item[key] === 'object') {
          Object.entries(item[key]).forEach(([name, value]) => {
            if (typeof value === 'string' || typeof value === 'number') parts.push(`${name}: ${value}`);
          });
        }
      });
      return parts.join(' ');
    },
    structuredRoleFromLog(item) {
      const sources = [item && item.data, item && item.details, item && item.params, item && item.changes].filter((value) => value && typeof value === 'object');
      for (const source of sources) {
        const role = source.new_position || source.newPosition || source.position || source.new_role || source.newRole || source.role || source.job || source.new;
        const previous = source.old_position || source.oldPosition || source.old_role || source.oldRole || source.old || '';
        const roleText = Timeline.cleanRoleText(role);
        if (roleText && !/^\d+$/.test(roleText)) return { role: roleText, fromRole: Timeline.cleanRoleText(previous) };
      }
      return null;
    },
    roleOnlyChangeMatch(text) {
      const clean = String(text || '').replace(/\s+/g, ' ').trim();
      const match = clean.match(/\b(?:position|role|job)\b.*?\b(?:changed|updated|set|assigned|moved|promoted|demoted)\b.*?\b(?:to|as)\s+(.+?)(?:\.|$)/i)
        || clean.match(/\b(?:changed|updated|set|assigned|moved|promoted|demoted)\b.*?\b(?:position|role|job)\b.*?\b(?:to|as)\s+(.+?)(?:\.|$)/i);
      return match ? Timeline.cleanRoleText(match[1]) : '';
    },
    roleChangesFromUserLog(data, person) {
      const source = data && (data.logs || data.log || data.user_logs || data.userlogs || data);
      if (!source) return [];
      const rows = Array.isArray(source) ? source.map((item, index) => [String(item.id || item.log_id || index), item]) : Object.entries(source);
      return rows.map(([id, item]) => {
        const text = Timeline.logText(item);
        const plainText = Timeline.plainText(text);
        const parsed = Timeline.roleChangeMatch(plainText, []);
        const hasRoleContext = /\b(position|role|job|promoted|demoted|assigned|moved)\b|new_position|old_position|new_role|old_role/i.test(plainText);
        const structured = hasRoleContext ? Timeline.structuredRoleFromLog(item) : null;
        const role = parsed && parsed.role || structured && structured.role || Timeline.roleOnlyChangeMatch(plainText) || '';
        if (!role) return null;
        return {
          id: String(item.id || item.log_id || id),
          timestamp: Utils.int(item.timestamp || item.time || item.date, 0),
          type: 'role_change',
          action: 'Interaction log',
          playerName: person.name || parsed && parsed.playerName || '',
          userId: String(person.id || ''),
          role,
          value: role,
          fromRole: structured && structured.fromRole || '',
          text,
          plainText,
          createdAt: Utils.nowIso()
        };
      }).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);
    },
    userLogRows(data) {
      const source = data && (data.logs || data.log || data.user_logs || data.userlogs || data);
      if (!source) return [];
      return Array.isArray(source) ? source.map((item, index) => [String(item.id || item.log_id || index), item]) : Object.entries(source);
    },
    workingStats(value) {
      const parts = String(value || '').split(',').map((part) => Utils.num(part, 0));
      return { man: parts[0] || 0, int: parts[1] || 0, end: parts[2] || 0 };
    },
    staffActionsFromUserLog(data, person, state) {
      const targetId = String(person && person.id || '').trim();
      const companyId = String(state && state.settings && state.settings.companyId || '').trim();
      return Timeline.userLogRows(data).map(([id, item]) => {
        const details = item && item.details || {};
        const rowData = item && item.data || {};
        const logId = Utils.int(details.id || item.log || item.log_id, 0);
        const timestamp = Utils.int(item && (item.timestamp || item.time || item.date), 0);
        const actionUser = String(rowData.receiver || rowData.employee || '').trim();
        const actionCompany = String(rowData.company || '').trim();
        if (targetId && actionUser && actionUser !== targetId) return null;
        if (companyId && actionCompany && actionCompany !== companyId) return null;
        if (logId === 6263) return {
          type: 'training',
          id: String(item.id || id),
          timestamp,
          userId: actionUser || targetId,
          companyId: actionCompany,
          playerName: person.name || actionUser || targetId,
          position: person.role || '',
          count: 1,
          statsReceived: Timeline.workingStats(rowData.working_stats_received),
          title: details.title || 'Company train send'
        };
        if (logId === 6242) return {
          type: 'hire',
          id: String(item.id || id),
          timestamp,
          userId: actionUser || targetId,
          companyId: actionCompany,
          title: details.title || 'Company application accept send'
        };
        if (logId === 6265) return {
          type: 'wage_change',
          id: String(item.id || id),
          timestamp,
          userId: actionUser || targetId,
          companyId: actionCompany,
          previousWage: Utils.num(rowData.previous_wage, 0),
          newWage: Utils.num(rowData.new_wage, 0),
          title: details.title || 'Company wage change send'
        };
        if (logId === 6267) return {
          type: 'rank_change',
          id: String(item.id || id),
          timestamp,
          userId: actionUser || targetId,
          companyId: actionCompany,
          previousRank: String(rowData.previous_rank === undefined || rowData.previous_rank === null ? '' : rowData.previous_rank),
          newRank: String(rowData.new_rank === undefined || rowData.new_rank === null ? '' : rowData.new_rank),
          title: details.title || 'Company rank change send'
        };
        return null;
      }).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);
    },
    trainingRowsFromStaffActions(actions, person) {
      const byKey = new Map();
      (actions || []).filter((action) => action.type === 'training').forEach((action) => {
        const date = Utils.dayKey(action.timestamp);
        if (!date) return;
        const identity = action.userId ? `id:${action.userId}` : Company.personKey(person);
        const key = `${date}:${identity}`;
        const row = byKey.get(key) || {
          id: `user-log:${key}`,
          date,
          timestamp: action.timestamp || 0,
          userId: action.userId || person.id || '',
          playerName: person.name || action.playerName || action.userId || '',
          aliases: Company.aliasList(person, action.playerName),
          position: action.position || person.role || 'Employee',
          count: 0,
          eventIds: [],
          statsReceived: { man: 0, int: 0, end: 0 },
          source: 'user_log'
        };
        row.timestamp = Math.max(row.timestamp || 0, action.timestamp || 0);
        row.count += Math.max(1, Utils.int(action.count, 1));
        row.eventIds.push(action.id);
        row.statsReceived.man += Utils.num(action.statsReceived && action.statsReceived.man, 0);
        row.statsReceived.int += Utils.num(action.statsReceived && action.statsReceived.int, 0);
        row.statsReceived.end += Utils.num(action.statsReceived && action.statsReceived.end, 0);
        byKey.set(key, row);
      });
      return Array.from(byKey.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.playerName).localeCompare(String(b.playerName)));
    },
    trainingNewsForPerson(person, state) {
      const id = String(person && person.id || '').trim();
      const identityMaps = Company.identityMaps(state);
      const targetIdentity = Company.resolveIdentity(person || {}, state, identityMaps);
      const names = new Set([person && person.name, person && person.playerName].concat(person && person.aliases || []).map((name) => Company.nameKey(name)).filter(Boolean));
      return (state.staff.timeline || []).filter((event) => {
        if (!event || event.type !== 'training' || !event.position) return false;
        if (id && String(event.userId || '') === id) return true;
        const identity = Company.resolveIdentity({ id: event.userId, name: event.playerName }, state, identityMaps);
        if (identity && identity === targetIdentity) return true;
        return names.has(Company.nameKey(event.playerName));
      }).sort((a, b) => Utils.int(a.timestamp, 0) - Utils.int(b.timestamp, 0));
    },
    roleRankAtTraining(actions, timestamp) {
      const time = Utils.int(timestamp, 0);
      if (!time) return '';
      const ranks = (actions || []).filter((action) => action.type === 'rank_change');
      const before = ranks.filter((action) => action.newRank && Utils.int(action.timestamp, 0) <= time).sort((a, b) => Utils.int(b.timestamp, 0) - Utils.int(a.timestamp, 0))[0];
      if (before) return before.newRank;
      const after = ranks.filter((action) => action.previousRank && Utils.int(action.timestamp, 0) > time && Utils.int(action.timestamp, 0) - time <= 900).sort((a, b) => Utils.int(a.timestamp, 0) - Utils.int(b.timestamp, 0))[0];
      return after ? after.previousRank : '';
    },
    closestTrainingNews(newsRows, timestamp) {
      const time = Utils.int(timestamp, 0);
      if (!time) return null;
      const closest = (newsRows || []).map((event) => ({ event, gap: Math.abs(Utils.int(event.timestamp, 0) - time) }))
        .filter((row) => row.gap <= 300)
        .sort((a, b) => a.gap - b.gap)[0];
      return closest ? closest.event : null;
    },
    roleMapKey(role) {
      return String(role || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || '';
    },
    rememberInferredRole(state, role) {
      const clean = Timeline.cleanRoleText(role);
      if (!clean) return;
      const known = []
        .concat(Company.defaultRoles || [])
        .concat(state.settings.customRoles || [])
        .concat(state.staff.current || [])
        .concat(state.staff.past || [])
        .map((row) => typeof row === 'string' ? row : row && row.role)
        .filter(Boolean);
      if (!known.some((item) => Timeline.roleMapKey(item) === Timeline.roleMapKey(clean))) {
        state.settings.customRoles = state.settings.customRoles || [];
        state.settings.customRoles.push(clean);
      }
    },
    roleRankEvidenceText(item) {
      const parts = [];
      if (item.source) parts.push(item.source);
      if (item.personName || item.personId) parts.push([item.personName, item.personId ? `[${item.personId}]` : ''].filter(Boolean).join(' '));
      if (item.at) parts.push(Utils.dateShort(item.at));
      return parts.filter(Boolean).join(' - ');
    },
    recordRoleRankEvidence(state, rank, role, source, meta) {
      const key = String(rank || '').replace(/[^\d]/g, '');
      const cleanRole = Timeline.cleanRoleText(role);
      if (!key || !cleanRole) return { added: false, conflict: false };
      state.settings.roleRankMap = state.settings.roleRankMap || {};
      state.settings.roleRankEvidence = state.settings.roleRankEvidence || {};
      const roleKey = Timeline.roleMapKey(cleanRole);
      const existing = String(state.settings.roleRankMap[key] || '');
      if (existing && Timeline.roleMapKey(existing) !== roleKey) {
        const current = state.settings.roleRankEvidence[key] || {};
        state.settings.roleRankEvidence[key] = Object.assign({}, current, {
          conflict: true,
          conflictRole: cleanRole,
          conflictSource: source || 'Role inference',
          conflictAt: meta && meta.at || meta && meta.timestamp || Utils.nowIso()
        });
        return { added: false, conflict: true };
      }
      if (!existing) state.settings.roleRankMap[key] = cleanRole;
      Timeline.rememberInferredRole(state, cleanRole);
      const next = Object.assign({}, state.settings.roleRankEvidence[key] || {}, {
        rank: key,
        role: cleanRole,
        roleKey,
        source: source || 'Role inference',
        personId: meta && meta.personId || '',
        personName: meta && meta.personName || '',
        at: meta && (meta.at || meta.timestamp) || Utils.nowIso(),
        newsId: meta && meta.newsId || '',
        logId: meta && meta.logId || '',
        gapSeconds: Utils.int(meta && meta.gapSeconds, 0),
        updatedAt: Utils.nowIso(),
        conflict: false
      });
      next.note = Timeline.roleRankEvidenceText(next);
      state.settings.roleRankEvidence[key] = next;
      return { added: !existing, conflict: false };
    },
    inferLatestRoleRank(actions, person, state) {
      const ranks = (actions || []).filter((action) => action.type === 'rank_change' && action.newRank)
        .sort((a, b) => Utils.int(b.timestamp, 0) - Utils.int(a.timestamp, 0));
      const latest = ranks[0];
      const role = Timeline.cleanRoleText(person && person.role);
      if (!latest || !role || ['Employee', 'Ex-Employee', 'Director'].some((item) => Timeline.roleMapKey(item) === Timeline.roleMapKey(role))) return { inferred: 0, conflicts: 0 };
      const outcome = Timeline.recordRoleRankEvidence(state, latest.newRank, role, 'Latest synced staff position', {
        personId: person.id || latest.userId || '',
        personName: person.name || latest.userId || '',
        at: latest.timestamp,
        logId: latest.id
      });
      return { inferred: outcome.added ? 1 : 0, conflicts: outcome.conflict ? 1 : 0 };
    },
    inferRoleRankMap(actions, person, state) {
      const newsRows = Timeline.trainingNewsForPerson(person, state);
      const result = { inferred: 0, conflicts: 0 };
      state.settings.roleRankMap = state.settings.roleRankMap || {};
      state.settings.roleRankEvidence = state.settings.roleRankEvidence || {};
      (actions || []).filter((action) => action.type === 'training').forEach((action) => {
        const news = Timeline.closestTrainingNews(newsRows, action.timestamp);
        const rank = Timeline.roleRankAtTraining(actions, action.timestamp);
        const role = news && Timeline.cleanRoleText(news.position);
        if (!rank || !role) return;
        const outcome = Timeline.recordRoleRankEvidence(state, rank, role, 'Training news cross-reference', {
          personId: person.id || action.userId || '',
          personName: person.name || action.playerName || '',
          at: action.timestamp,
          logId: action.id,
          newsId: news.id,
          gapSeconds: Math.abs(Utils.int(news.timestamp, 0) - Utils.int(action.timestamp, 0))
        });
        if (outcome.conflict) result.conflicts += 1;
        if (outcome.added) result.inferred += 1;
      });
      const latest = Timeline.inferLatestRoleRank(actions, person, state);
      result.inferred += latest.inferred;
      result.conflicts += latest.conflicts;
      return result;
    },
    isDailyReportText(text) {
      const value = String(text || '').replace(/\s+/g, ' ').trim();
      return /\b(?:daily|invalid date|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+report\b/i.test(value)
        && /\b(customers?|gross income|income|revenue|profit)\b/i.test(value);
    },
    typeFromAction(action, text) {
      const seed = `${action || ''} ${text || ''}`.toLowerCase();
      if (/\bweekly[_\s-]*report\b/.test(seed)) return 'weekly_report';
      if (/\bdaily[_\s-]*report\b/.test(seed) || Timeline.isDailyReportText(seed)) return 'daily_report';
      const checks = [
        ['funds', /\b(company funds?|funds)\b.*\b(withdraw|withdrawn|deposit|deposited)\b|\b(withdraw|withdrawn|deposit|deposited)\b.*\b(company funds?|funds)\b/],
        ['training', /\b(train|trained|training)\b/],
        ['role_change', /\b(position|role|job|promoted|demoted|assigned|moved)\b.*\b(to|as)\b/],
        ['withdraw', /\b(withdraw|withdrew|withdrawn)\b/],
        ['deposit', /\b(deposit|deposited)\b/],
        ['hire', /\b(hire|hired|accepted .+ application|accepted application)\b/],
        ['application', /\b(application|applied)\b/],
        ['fired', /\b(fire|fired|dismissed)\b/],
        ['left', /\b(left|quit|resigned)\b/],
        ['director', /\bdirector\b|\bstarted\b.*\bcompany\b/],
        ['rating', /\brating\b/],
        ['daily_report', /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday) report\b/],
        ['weekly_report', /\bweekly report\b/],
        ['wage', /\b(wage|salary|paid)\b/],
        ['funds', /\b(company funds?|funds|money|cash)\b/]
      ];
      const match = checks.find(([, regex]) => regex.test(seed));
      return match ? match[0] : 'other';
    },
    mergeTimeline(existing, incoming) {
      return Timeline.dedupeEvents((existing || []).concat(incoming || []));
    },
    displayType(event) {
      return Store.isDailyReportLike(event) ? 'daily_report' : String(event && event.type || 'other');
    },
    timelineText(event) {
      return String(event && (event.plainText || event.text || event.message) || '').replace(/\s+/g, ' ').trim();
    },
    isGenericTrainingName(name) {
      const key = Company.nameKey(name);
      return !key || key === 'a staff member' || key === 'staff member';
    },
    isGenericTrainingEvent(event) {
      if (Timeline.displayType(event) !== 'training') return false;
      const id = String(event && (event.userId || event.playerId) || '').trim();
      return !id && Timeline.isGenericTrainingName(event && (event.playerName || event.name));
    },
    isAggregateTrainingEvent(event) {
      if (Timeline.displayType(event) !== 'training') return false;
      return Store.trainingEventCount(event, { raw: true }) > 1 || /\breceived\s+\d[\d,]*\s+trains?\b/i.test(Timeline.timelineText(event));
    },
    trainingMinute(event) {
      const timestamp = Utils.int(event && event.timestamp, 0);
      return timestamp ? Math.floor(timestamp / 60) : 0;
    },
    trainingFallbackKey(event) {
      if (Timeline.displayType(event) !== 'training') return '';
      const day = Utils.dayKey(event && event.timestamp);
      const minute = Timeline.trainingMinute(event);
      const position = Company.nameKey(event && (event.position || event.role));
      const count = Store.trainingEventCount(event, { raw: true });
      if (!day || !minute || !count) return '';
      return [day, minute, position, count].join('|');
    },
    trainingSpecificKey(event) {
      if (Timeline.displayType(event) !== 'training') return '';
      if (Timeline.isGenericTrainingEvent(event)) return '';
      const day = Utils.dayKey(event && event.timestamp);
      const identity = Company.nameKey(event && (event.playerName || event.name)) || String(event && (event.userId || event.playerId) || '').trim();
      const position = Company.nameKey(event && (event.position || event.role));
      if (!day || !identity) return '';
      return [day, identity, position].join('|');
    },
    trainingDedupeKey(event) {
      if (Timeline.displayType(event) !== 'training') return '';
      const minute = Timeline.trainingMinute(event);
      const count = Store.trainingEventCount(event, { raw: true });
      const specific = Timeline.trainingSpecificKey(event);
      if (specific && minute && count) return `training:${specific}:${minute}:${count}`;
      const fallback = Timeline.trainingFallbackKey(event);
      return fallback ? `training-generic:${fallback}` : '';
    },
    isLocalEventId(id) {
      return /^event_[a-z0-9]+_[a-z0-9]+$/i.test(String(id || '')) || /^daily:/i.test(String(id || ''));
    },
    sourceEventId(event) {
      const direct = String(event && (event.sourceEventId || event.tornEventId || event.apiEventId || event.newsId || event.news_id) || '').trim();
      if (direct && !Timeline.isLocalEventId(direct)) return direct;
      const id = String(event && (event.id || event.eventId) || '').trim();
      return id && !Timeline.isLocalEventId(id) ? id : '';
    },
    reportDedupeKey(event) {
      const reportDate = Utils.dateInput(event && (event.reportDate || event.report_date || event.date)) || Utils.dayKey(event && event.timestamp);
      const values = Timeline.reportValues(event || {});
      return reportDate ? `daily:${reportDate}:${values.customers}:${values.income}` : '';
    },
    eventDedupeKey(event) {
      const displayType = Timeline.displayType(event);
      const id = String(event && (event.id || event.eventId) || '').trim();
      const sourceEventId = Timeline.sourceEventId(event);
      if (sourceEventId) return `source:${sourceEventId}`;
      if (displayType === 'daily_report') return Timeline.reportDedupeKey(event) || (id ? `id:${id}` : '');
      if (displayType === 'training') {
        const trainingKey = Timeline.trainingDedupeKey(event);
        if (trainingKey) return trainingKey;
      }
      if (id) return `id:${id}`;
      return [displayType, Utils.int(event && event.timestamp, 0), Timeline.timelineText(event)].join('|');
    },
    eventQuality(event) {
      const name = event && (event.playerName || event.name);
      return (String(event && (event.userId || event.playerId) || '').trim() ? 8 : 0)
        + (!Timeline.isGenericTrainingName(name) ? 4 : 0)
        + (name ? 2 : 0)
        + (event && (event.position || event.role) ? 1 : 0)
        + (Timeline.timelineText(event) ? 1 : 0);
    },
    betterEvent(first, second) {
      if (!first) return second;
      if (!second) return first;
      return Timeline.eventQuality(second) >= Timeline.eventQuality(first) ? second : first;
    },
    dedupeEvents(events) {
      const rows = Array.isArray(events) ? events.filter(Boolean) : [];
      const namedAggregateByFallback = new Map();
      rows.forEach((event) => {
        if (!Timeline.isAggregateTrainingEvent(event) || Timeline.isGenericTrainingEvent(event)) return;
        const fallback = Timeline.trainingFallbackKey(event);
        if (fallback) namedAggregateByFallback.set(fallback, Timeline.betterEvent(namedAggregateByFallback.get(fallback), event));
      });
      const byKey = new Map();
      rows.forEach((event) => {
        if (Timeline.isAggregateTrainingEvent(event) && Timeline.isGenericTrainingEvent(event)) {
          const fallback = Timeline.trainingFallbackKey(event);
          if (fallback && namedAggregateByFallback.has(fallback)) return;
        }
        const key = Timeline.eventDedupeKey(event);
        if (!key) return;
        byKey.set(key, Timeline.betterEvent(byKey.get(key), event));
      });
      return Array.from(byKey.values()).sort((a, b) => Utils.int(b.timestamp, 0) - Utils.int(a.timestamp, 0));
    },
    trainingCollapseKey(event) {
      return Timeline.trainingSpecificKey(event);
    },
    collapseTimelineRows(events) {
      const rows = [];
      const grouped = new Map();
      const fallbackGrouped = new Map();
      Timeline.dedupeEvents(events || []).forEach((event) => {
        const displayType = Timeline.displayType(event);
        const timestamp = Utils.int(event && event.timestamp, 0);
        const eventTrainCount = displayType === 'training' ? Store.trainingEventCount(event, { raw: true }) : 1;
        const base = Object.assign({}, event, {
          displayType,
          displayCount: eventTrainCount,
          displayRawCount: displayType === 'training' && eventTrainCount <= 1 ? 1 : 0,
          displayExplicitCount: displayType === 'training' && eventTrainCount > 1 ? eventTrainCount : 0,
          displayFirstTimestamp: timestamp,
          displayLastTimestamp: timestamp
        });
        if (displayType !== 'training') {
          rows.push(base);
          return;
        }
        const key = Timeline.trainingCollapseKey(event);
        const fallbackKey = Timeline.trainingFallbackKey(event);
        const fallbackMatch = !key && fallbackKey ? fallbackGrouped.get(fallbackKey) : null;
        if (fallbackMatch) {
          const existing = fallbackMatch;
          existing.displayRawCount += eventTrainCount <= 1 ? 1 : 0;
          existing.displayExplicitCount = Math.max(existing.displayExplicitCount || 0, eventTrainCount > 1 ? eventTrainCount : 0);
          existing.displayCount = Math.max(1, existing.displayRawCount, existing.displayExplicitCount);
          if (Timeline.eventQuality(event) > Timeline.eventQuality(existing)) {
            existing.playerName = event.playerName || existing.playerName;
            existing.name = event.name || existing.name;
            existing.position = event.position || existing.position;
            existing.role = event.role || existing.role;
            existing.userId = event.userId || existing.userId;
            existing.playerId = event.playerId || existing.playerId;
          }
          existing.displayFirstTimestamp = Math.min(existing.displayFirstTimestamp || timestamp, timestamp || existing.displayFirstTimestamp || 0);
          existing.displayLastTimestamp = Math.max(existing.displayLastTimestamp || timestamp, timestamp || existing.displayLastTimestamp || 0);
          existing.timestamp = Math.max(Utils.int(existing.timestamp, 0), timestamp);
          return;
        }
        if (!key) {
          rows.push(base);
          if (fallbackKey) fallbackGrouped.set(fallbackKey, base);
          return;
        }
        const existing = grouped.get(key);
        if (!existing) {
          grouped.set(key, base);
          rows.push(base);
          return;
        }
        existing.displayRawCount += eventTrainCount <= 1 ? 1 : 0;
        existing.displayExplicitCount = Math.max(existing.displayExplicitCount || 0, eventTrainCount > 1 ? eventTrainCount : 0);
        existing.displayCount = Math.max(1, existing.displayRawCount, existing.displayExplicitCount);
        if (eventTrainCount > Store.trainingEventCount(existing, { raw: true }) || Timeline.eventQuality(event) > Timeline.eventQuality(existing)) {
          existing.playerName = event.playerName || existing.playerName;
          existing.name = event.name || existing.name;
          existing.position = event.position || existing.position;
          existing.role = event.role || existing.role;
          existing.userId = event.userId || existing.userId;
          existing.playerId = event.playerId || existing.playerId;
        }
        existing.displayFirstTimestamp = Math.min(existing.displayFirstTimestamp || timestamp, timestamp || existing.displayFirstTimestamp || 0);
        existing.displayLastTimestamp = Math.max(existing.displayLastTimestamp || timestamp, timestamp || existing.displayLastTimestamp || 0);
        existing.timestamp = Math.max(Utils.int(existing.timestamp, 0), timestamp);
      });
      return rows;
    },
    reclassify(events) {
      return Timeline.dedupeEvents(events.map((event) => Object.assign({}, event, Timeline.parseEvent({
        id: event.id,
        sourceEventId: event.sourceEventId || event.tornEventId || event.apiEventId || event.newsId || event.news_id || '',
        text: event.text || event.plainText || '',
        timestamp: event.timestamp || 0,
        action: event.action || event.type || ''
      }))));
    },
    trainingLogsFromEvents(events, state) {
      const byKey = new Map();
      const staff = (state.staff.current || []).concat(state.staff.past || []);
      const staffById = new Map(staff.map((person) => [String(person.id || ''), person]).filter(([id]) => id));
      const staffByName = new Map();
      staff.forEach((person) => [person.name, person.playerName].concat(person.aliases || []).forEach((name) => {
        const key = Company.nameKey(name);
        if (key) staffByName.set(key, person);
      }));
      (events || []).filter((event) => event.type === 'training' && event.playerName).forEach((event) => {
        const date = Utils.dayKey(event.timestamp);
        if (!date) return;
        const name = String(event.playerName || '').trim();
        const userId = String(event.userId || '').trim();
        const person = (userId && staffById.get(userId)) || staffByName.get(Company.nameKey(name)) || {};
        if (userId && person && person.id) person.aliases = Company.aliasList(person, name);
        const identity = userId || person.id ? `id:${userId || person.id}` : Company.personKey({ name });
        const position = event.position || person.role || 'Employee';
        const key = `${date}:${identity}`;
        const row = byKey.get(key) || {
          id: key,
          date,
          timestamp: event.timestamp || 0,
          userId: userId || person.id || '',
          playerName: person.name || name,
          aliases: Company.aliasList(person, name),
          position,
          contractType: '',
          count: 0,
          eventIds: []
        };
        if (userId && !row.userId) row.userId = userId;
        if (person.name) row.playerName = person.name;
        row.timestamp = Math.max(row.timestamp || 0, event.timestamp || 0);
        row.position = row.position || position;
        row.count += Math.max(1, Utils.int(event.trainCount, 1));
        row.eventIds.push(event.id);
        byKey.set(key, row);
      });
      return Array.from(byKey.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.playerName).localeCompare(String(b.playerName)));
    },
    mergeTrainingRows(rows, state) {
      const byKey = new Map();
      const identityMaps = Company.identityMaps(state);
      (rows || []).forEach((row) => {
        if (!row || !row.date) return;
        const identity = Company.resolveIdentity(row, state, identityMaps);
        const key = `${row.date}:${identity}`;
        const previous = byKey.get(key);
        if (!previous) {
          byKey.set(key, Object.assign({}, row, { id: row.id || key, eventIds: Array.isArray(row.eventIds) ? row.eventIds.slice() : [] }));
          return;
        }
        const next = Object.assign({}, previous, {
          timestamp: Math.max(Utils.int(previous.timestamp, 0), Utils.int(row.timestamp, 0)),
          userId: previous.userId || row.userId || '',
          playerName: previous.playerName || row.playerName || '',
          position: previous.position || row.position || 'Employee',
          contractType: previous.contractType || row.contractType || '',
          count: Math.max(Utils.int(previous.count, 0), Utils.int(row.count, 0)),
          source: previous.source && row.source && previous.source !== row.source ? 'mixed' : (previous.source || row.source || ''),
          eventIds: (previous.eventIds || []).concat(row.eventIds || []).filter(Boolean)
        });
        if (row.statsReceived || previous.statsReceived) {
          next.statsReceived = {
            man: Math.max(Utils.num(previous.statsReceived && previous.statsReceived.man, 0), Utils.num(row.statsReceived && row.statsReceived.man, 0)),
            int: Math.max(Utils.num(previous.statsReceived && previous.statsReceived.int, 0), Utils.num(row.statsReceived && row.statsReceived.int, 0)),
            end: Math.max(Utils.num(previous.statsReceived && previous.statsReceived.end, 0), Utils.num(row.statsReceived && row.statsReceived.end, 0))
          };
        }
        byKey.set(key, next);
      });
      return Array.from(byKey.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.playerName).localeCompare(String(b.playerName)));
    },
    eventMatchesPerson(event, person) {
      if (!event || !person) return false;
      const id = String(person.id || person.userId || person.user_id || person.playerId || '').trim();
      const eventId = String(event.userId || event.playerId || '').trim();
      if (id && eventId && id === eventId) return true;
      const names = new Set([person.name, person.playerName].concat(person.aliases || []).map((name) => Company.nameKey(name)).filter(Boolean));
      const eventName = Company.nameKey(event.playerName || event.name || event.value);
      if (eventName && names.has(eventName)) return true;
      const text = Company.nameKey(event.plainText || event.text || '');
      return Array.from(names).some((name) => name && text.includes(name));
    },
    personEventTimestamp(state, person, types, mode) {
      const allowed = new Set((types || []).map((type) => String(type || '').toLowerCase()));
      const rows = (state && state.staff && state.staff.timeline || [])
        .filter((event) => event && allowed.has(String(event.type || '').toLowerCase()) && Utils.int(event.timestamp, 0) && Timeline.eventMatchesPerson(event, person))
        .sort((a, b) => Utils.int(a.timestamp, 0) - Utils.int(b.timestamp, 0));
      if (!rows.length) return 0;
      return Utils.int((mode === 'last' ? rows[rows.length - 1] : rows[0]).timestamp, 0);
    },
    hydrateEmploymentDates(state, person) {
      const next = Object.assign({}, person || {});
      const hire = Utils.dateTimestamp(next.hiredAt || next.joinedDate || next.startedAt) || Timeline.personEventTimestamp(state, next, ['hire'], 'first');
      const left = Utils.dateTimestamp(next.leftAt || next.endedAt) || Timeline.personEventTimestamp(state, next, ['left', 'fired'], 'last');
      if (hire) {
        next.hiredAt = next.hiredAt || hire;
        next.joinedDate = next.joinedDate || hire;
      }
      if (left && (Company.shouldBePastStaff(next) || ['left', 'fired'].includes(String(next.exitType || '').toLowerCase()) || String(next.role || '').toLowerCase() === 'ex-employee')) {
        next.leftAt = next.leftAt || left;
        next.endedAt = next.endedAt || left;
      }
      return next;
    },
    rebuildPeople(state) {
      const key = (person) => Company.personKey(person);
      const current = new Map(state.staff.current.map((person) => [key(person), person]));
      const past = new Map(state.staff.past.map((person) => [key(person), person]));
      const existingDirectors = new Map(state.staff.directorsCurrent.map((person) => [key(person), person]));
      const directors = new Map();
      const directorsPast = new Map(state.staff.directorsPast.map((person) => [key(person), person]));
      let sawDirectorEvent = false;
      state.staff.timeline.slice().sort((a, b) => a.timestamp - b.timestamp).forEach((event) => {
        const name = String(event.playerName || '').trim();
        if (!name && !event.userId) return;
        if (name && Company.isFakeStaffName(name)) return;
        const id = key({ id: event.userId, name });
        if (!id) return;
        if (event.type === 'hire') {
          const previous = past.get(id) || current.get(id) || {};
          current.set(id, Company.clearStaleLeftDate(Object.assign({}, previous, { id: event.userId || previous.id || '', name: name || previous.name, aliases: Company.aliasList(previous, name), role: previous.role || 'Employee', contractType: previous.contractType || '', hiredAt: event.timestamp || previous.hiredAt || '', source: 'company news' })));
          past.delete(id);
        }
        if (event.type === 'left' || event.type === 'fired') {
          const person = current.get(id) || { id: event.userId || '', name, role: 'Ex-Employee', contractType: 'paid' };
          if (!person.role || person.role === 'Employee') person.role = 'Ex-Employee';
          person.aliases = Company.aliasList(person, name);
          person.leftAt = event.timestamp || ''; person.exitType = event.type; past.set(id, person); current.delete(id);
        }
        if (event.type === 'role_change' && event.role) {
          const previous = current.get(id) || past.get(id) || { id: event.userId || '', name, role: 'Employee' };
          const updated = Company.clearStaleLeftDate(Object.assign({}, previous, {
            id: event.userId || previous.id || '',
            name: name || previous.name || '',
            aliases: Company.aliasList(previous, name),
            role: event.role,
            roleHistory: Company.roleHistoryWithChange(previous, event.role, event.timestamp || Utils.todayInput()),
            source: 'company news role'
          }));
          if (past.has(id) && !current.has(id)) past.set(id, updated);
          else current.set(id, updated);
        }
        if (event.type === 'director') {
          sawDirectorEvent = true;
          directors.forEach((person, personId) => {
            if (personId === id) return;
            directorsPast.set(personId, Object.assign({}, person, {
              role: 'Director',
              leftAt: person.leftAt || event.timestamp || '',
              endedAt: person.endedAt || event.timestamp || '',
              source: person.source || 'company news'
            }));
            directors.delete(personId);
          });
          const previous = directors.get(id) || directorsPast.get(id) || {};
          directors.set(id, Object.assign({}, previous, {
            id: event.userId || previous.id || '',
            name: name || previous.name || '',
            aliases: Company.aliasList(previous, name),
            role: 'Director',
            startedAt: previous.startedAt || event.timestamp || '',
            source: 'company news',
            leftAt: ''
          }));
          directorsPast.delete(id);
        }
      });
      if (!sawDirectorEvent) {
        existingDirectors.forEach((person, personId) => directors.set(personId, person));
      } else {
        const profileDirectorId = String(state.company.profile.directorId || state.settings.userId || '').trim();
        existingDirectors.forEach((person, personId) => {
          const personIdValue = String(person.id || '').trim();
          if (profileDirectorId && personIdValue === profileDirectorId) {
            directors.set(personId, Object.assign({}, directors.get(personId) || {}, person, { role: 'Director', leftAt: '' }));
            directorsPast.delete(personId);
          }
        });
      }
      const byName = (a, b) => String(a.name).localeCompare(String(b.name));
      state.staff.current = Array.from(current.values()).map((person) => Timeline.hydrateEmploymentDates(state, person)).sort(byName);
      state.staff.past = Array.from(past.values()).map((person) => Timeline.hydrateEmploymentDates(state, person)).sort(byName);
      state.staff.directorsCurrent = Array.from(directors.values()).sort(byName);
      state.staff.directorsPast = Array.from(directorsPast.values()).sort(byName);
      Company.dedupeStaff(state);
      Company.removeDirectorsFromStaff(state);
    },
    employeesFromApi(data) {
      const raw = data && (Company.selection(data, 'employees') || data.employees || data.company_employees || data);
      if (!raw) return [];
      return Object.entries(raw).map(([id, employee]) => {
        const stats = employee.stats && typeof employee.stats === 'object' ? employee.stats : {};
        const position = employee.position && typeof employee.position === 'object' ? employee.position : null;
        const effectiveness = Company.effectiveness(employee);
        return {
          id: String(employee.id || employee.user_id || id),
          name: employee.name || employee.player_name || employee.username || `Player ${id}`,
          role: position ? position.name : (employee.position || employee.role || employee.job || employee.title || 'Employee'),
          positionId: position ? String(position.id || '') : String(employee.position_id || employee.positionId || ''),
          contractType: employee.contractType || employee.contract_type || '',
          man: Utils.num(employee.man || employee.manual_labor || employee.manual || employee.MAN || stats.manual_labor, 0),
          int: Utils.num(employee.int || employee.intelligence || employee.INT || stats.intelligence, 0),
          end: Utils.num(employee.end || employee.endurance || employee.END || stats.endurance, 0),
          merits: Utils.int(employee.merits || employee.effectiveness_merits || (employee.effectiveness && employee.effectiveness.merits), 0),
          addiction: Math.abs(Utils.num(employee.addiction || employee.addiction_penalty || (employee.effectiveness && employee.effectiveness.addiction), 0)),
          inactiveDays: Utils.int(employee.inactive_days || employee.days_inactive, 0),
          wage: Utils.num(employee.wage, 0),
          wageFromApi: Object.prototype.hasOwnProperty.call(employee, 'wage'),
          efficiency: effectiveness.total,
          effectiveness,
          daysInCompany: Utils.int(employee.days_in_company || employee.daysInCompany || employee.days || 0, 0),
          hiredAt: employee.joined_at ? Utils.dateInput(employee.joined_at) : (employee.hiredAt || employee.joinedDate || ''),
          lastAction: employee.last_action && employee.last_action.timestamp ? Utils.timeAgo(employee.last_action.timestamp) : (employee.last_action && employee.last_action.relative ? employee.last_action.relative : ''),
          lastActionTimestamp: employee.last_action && employee.last_action.timestamp ? Utils.int(employee.last_action.timestamp, 0) : 0,
          status: employee.status && employee.status.description ? employee.status.description : '',
          source: 'Torn API V2 employees'
        };
      }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    },
    reportValues(event) {
      const text = event.plainText || Timeline.plainText(event.text);
      const customersMatch = text.match(/([\d,]+)\s+customers?/i) || text.match(/(?:customers|customer count)[^\d]*([\d,]+)/i);
      const incomeMatch = text.match(/(?:gross income|income|revenue|made)[^\d$]*\$?([\d,]+)/i);
      return {
        customers: customersMatch ? Utils.int(customersMatch[1], 0) : 0,
        income: incomeMatch ? Utils.int(incomeMatch[1], 0) : 0,
        raw: text
      };
    },
    reportGapCursor(state) {
      const events = (state && state.staff && state.staff.timeline || []).slice();
      const dailyEvents = events.filter((event) => {
        if (!event || event.type !== 'daily_report' || !event.timestamp) return false;
        const values = Timeline.reportValues(event);
        return !!(values.customers || values.income);
      });
      if (!dailyEvents.length) return null;

      const reportDates = new Set(dailyEvents.map((event) => Utils.dayKey(event.timestamp)).filter(Boolean));
      const latestEventTs = events.reduce((latest, event) => Math.max(latest, Utils.int(event && event.timestamp, 0)), 0);
      const latestDailyTs = dailyEvents.reduce((latest, event) => Math.max(latest, Utils.int(event.timestamp, 0)), 0);
      const oldestDailyTs = dailyEvents.reduce((oldest, event) => {
        const timestamp = Utils.int(event.timestamp, 0);
        return timestamp ? Math.min(oldest || timestamp, timestamp) : oldest;
      }, 0);
      const earliest = Utils.int(state && state.company && state.company.newsSync && state.company.newsSync.earliestTimestamp, 0);
      const oldestStored = Utils.int(state && state.company && state.company.newsSync && state.company.newsSync.oldestTimestamp, 0);
      const reachedStart = !!(earliest && oldestStored && oldestStored <= earliest);
      const start = Utils.dayKey(reachedStart && earliest ? earliest : oldestDailyTs);
      const yesterday = Utils.addDays(Utils.todayInput(), -1);
      const end = [Utils.dayKey(latestEventTs || latestDailyTs), yesterday].filter(Boolean).sort().shift();
      if (!start || !end || start > end) return null;

      const attempts = state.company.newsSync.reportGapAttempts || {};
      let cursorDate = end;
      while (cursorDate >= start) {
        const attemptedAt = Utils.dateTimestamp(attempts[cursorDate]);
        const recentlyTried = attemptedAt && (Math.floor(Date.now() / 1000) - attemptedAt) < 21600;
        if (!reportDates.has(cursorDate) && !recentlyTried) {
          const to = Utils.dateTimestamp(`${cursorDate}T23:59:59`);
          if (to) return { date: cursorDate, to };
        }
        cursorDate = Utils.addDays(cursorDate, -1);
      }
      return null;
    },
    accessEvents(events, state) {
      return Array.isArray(events) ? events : [];
    },
    analyticsFromEvents(events, state) {
      events = Timeline.dedupeEvents(Timeline.accessEvents(events || [], state));
      const daily = new Map();
      const dailyReports = new Map();
      events.filter((event) => Store.isDailyReportLike(event)).forEach((event) => {
        const values = Timeline.reportValues(event);
        if (!values.customers && !values.income) return;
        const timestamp = event.timestamp || Math.floor(Date.now() / 1000);
        const reportDate = Utils.dateInput(event.reportDate || event.report_date || event.date) || Utils.dayKey(timestamp);
        if (!reportDate) return;
        const existing = dailyReports.get(reportDate);
        if (!existing || timestamp >= existing.timestamp) dailyReports.set(reportDate, { event, values, timestamp });
      });
      dailyReports.forEach(({ event, values, timestamp }) => {
        const date = new Date(timestamp * 1000);
        const weekInfo = Utils.isoWeekInfo(date);
        const week = weekInfo.week;
        const year = weekInfo.year;
        const key = `${year}-${week}`;
        const row = daily.get(key) || { id: key, week, year, dateRange: Utils.weekRange(date), timestamp, customers: 0, income: 0, raw: [], days: [] };
        const dayIndex = date.getDay() || 7;
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const dayKey = Utils.dayKey(timestamp);
        const existingDay = row.days.find((day) => day.date === dayKey) || {
          date: dayKey,
          weekday: dayNames[dayIndex - 1],
          dayIndex,
          timestamp,
          customers: 0,
          income: 0,
          raw: []
        };
        row.timestamp = Math.max(row.timestamp, timestamp);
        row.customers += values.customers;
        row.income += values.income;
        row.raw.push(values.raw);
        existingDay.timestamp = Math.max(existingDay.timestamp, timestamp);
        existingDay.customers += values.customers;
        existingDay.income += values.income;
        existingDay.profitPerCustomer = existingDay.customers > 0 ? Math.round(existingDay.income / existingDay.customers) : 0;
        existingDay.raw.push(values.raw);
        if (!row.days.some((day) => day.date === dayKey)) row.days.push(existingDay);
        daily.set(key, row);
      });
      const weekly = Array.from(daily.values()).map((week) => Object.assign({}, week, {
        profitPerCustomer: week.customers > 0 ? Math.round(week.income / week.customers) : 0,
        days: (week.days || []).sort((a, b) => a.dayIndex - b.dayIndex || String(a.date).localeCompare(String(b.date))).map((day) => Object.assign({}, day, { raw: (day.raw || []).join('\n') })),
        raw: week.raw.join('\n')
      }));
      events.filter((event) => event.type === 'weekly_report').forEach((event) => {
        const values = Timeline.reportValues(event);
        if (!values.customers && !values.income) return;
        const timestamp = event.timestamp || Math.floor(Date.now() / 1000);
        const date = new Date(timestamp * 1000);
        const weekInfo = Utils.isoWeekInfo(date);
        const key = `${weekInfo.year}-${weekInfo.week}`;
        if (daily.has(key)) return;
        weekly.push({
          id: event.id,
          week: weekInfo.week,
          year: weekInfo.year,
          dateRange: Utils.weekRange(date),
          timestamp,
          customers: values.customers,
          income: values.income,
          profitPerCustomer: values.customers > 0 ? Math.round(values.income / values.customers) : 0,
          days: [],
          raw: values.raw
        });
      });
      const byKey = new Map();
      weekly.forEach((week) => byKey.set(`${week.year}-${week.week}`, week));
      return Array.from(byKey.values()).filter((week) => week.customers || week.income).sort((a, b) => b.timestamp - a.timestamp);
    },
    completedWeeks(weeks) {
      const now = new Date();
      const currentInfo = Utils.isoWeekInfo(now);
      const currentWeek = currentInfo.week;
      const currentYear = currentInfo.year;
      return (weeks || []).filter((week) => Number(week.week) !== currentWeek || Number(week.year) !== currentYear);
    },
    compareWeeks(weeks) {
      const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      const avgCustomers = average(weeks.map((week) => week.customers));
      const avgIncome = average(weeks.map((week) => week.income));
      return weeks.map((week, index) => {
        const last = weeks[index + 1] || null;
        return Object.assign({}, week, {
          vsLastCustomers: last ? week.customers - last.customers : 0,
          vsLastIncome: last ? week.income - last.income : 0,
          vsAverageCustomers: Math.round(week.customers - avgCustomers),
          vsAverageIncome: Math.round(week.income - avgIncome)
        });
      });
    }
  };

  const Wages = {
    estimate(employee, settings) {
      const wage = settings.wage;
      const stats = Utils.num(employee.man, 0) * Utils.num(wage.manWeight, 1) + Utils.num(employee.int, 0) * Utils.num(wage.intWeight, 1) + Utils.num(employee.end, 0) * Utils.num(wage.endWeight, 1);
      let value = Utils.num(wage.baseWage, 0) + stats * Utils.num(wage.statCashRate, 1);
      value *= 1 + (Utils.int(employee.merits, 0) * Utils.percent(wage.meritBonusPercent, 0) / 100);
      if (Utils.num(employee.addiction, 0) > 0) value *= 1 - (Utils.percent(wage.addictionPenaltyPercent, 0) / 100);
      if (Utils.int(employee.inactiveDays, 0) >= Utils.int(wage.inactiveDaysThreshold, 3)) value *= 1 - (Utils.percent(wage.inactivityPenaltyPercent, 0) / 100);
      return Math.max(0, Math.round(value));
    },
    matchingRows(person, state) {
      const currentState = state || UI.state || DEFAULTS;
      const id = String(person && person.id || '').trim();
      const nameKey = Company.nameKey(person && (person.name || person.playerName));
      const pool = []
        .concat(person || [])
        .concat(currentState.staff && currentState.staff.current || [])
        .concat(currentState.company && currentState.company.profile ? (currentState.company.profile.employees || []) : []);
      const seen = new Set();
      return pool.filter((row) => {
        if (!row || (!row.id && !row.name && !row.playerName)) return false;
        const rowId = String(row.id || '').trim();
        const rowName = Company.nameKey(row.name || row.playerName);
        const aliasMatch = (row.aliases || []).some((alias) => Company.nameKey(alias) === nameKey);
        const match = row === person || (id && rowId === id) || (nameKey && (rowName === nameKey || aliasMatch));
        if (!match) return false;
        const key = `${rowId || rowName}:${row.source || ''}:${row.role || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    resolvedEmployee(person, state) {
      const rows = Wages.matchingRows(person, state);
      const merged = rows.reduce((memo, row) => Object.assign(memo, row || {}), {});
      const actualRow = rows.slice().reverse().find((row) => row && (row.wageFromApi || Object.prototype.hasOwnProperty.call(row, 'wage')));
      const meritValues = rows.map((row) => {
        const raw = row && row.effectiveness && typeof row.effectiveness === 'object' ? row.effectiveness : {};
        return Utils.int(row && row.merits !== undefined ? row.merits : raw.merits, 0);
      });
      const addictionValues = rows.map((row) => {
        const raw = row && row.effectiveness && typeof row.effectiveness === 'object' ? row.effectiveness : {};
        const details = raw.details && typeof raw.details === 'object' ? raw.details : raw;
        return Math.abs(Utils.num(row && row.addiction !== undefined ? row.addiction : (row && row.addiction_penalty !== undefined ? row.addiction_penalty : details.addiction), 0));
      });
      const inactivityValues = rows.map((row) => Utils.int(row && (row.inactiveDays !== undefined ? row.inactiveDays : (row.inactive_days !== undefined ? row.inactive_days : row.days_inactive)), 0)).filter((value) => value > 0);
      merged.man = Utils.num(merged.man || merged.manual_labor || merged.manual || merged.MAN, 0);
      merged.int = Utils.num(merged.int || merged.intelligence || merged.INT, 0);
      merged.end = Utils.num(merged.end || merged.endurance || merged.END, 0);
      merged.merits = meritValues.length ? Math.max.apply(null, meritValues) : 0;
      merged.addiction = addictionValues.length ? Math.max.apply(null, addictionValues) : 0;
      merged.inactiveDays = inactivityValues.length ? Math.max.apply(null, inactivityValues) : ((typeof UI !== 'undefined' && UI.personInactiveDays) ? UI.personInactiveDays(merged) : 0);
      merged.wageFromApi = !!actualRow;
      if (actualRow) merged.wage = Utils.num(actualRow.wage, 0);
      return merged;
    },
    breakdownForEmployee(employee, settings) {
      const wage = settings.wage;
      const man = Utils.num(employee && employee.man, 0);
      const int = Utils.num(employee && employee.int, 0);
      const end = Utils.num(employee && employee.end, 0);
      const weightedStats = man * Utils.num(wage.manWeight, 1) + int * Utils.num(wage.intWeight, 1) + end * Utils.num(wage.endWeight, 1);
      const base = Utils.num(wage.baseWage, 0) + weightedStats * Utils.num(wage.statCashRate, 1);
      const meritBonus = Utils.int(employee && employee.merits, 0) * Utils.percent(wage.meritBonusPercent, 0);
      const addictionPenalty = Utils.num(employee && employee.addiction, 0) > 0 ? Utils.percent(wage.addictionPenaltyPercent, 0) : 0;
      const inactivityPenalty = Utils.int(employee && employee.inactiveDays, 0) >= Utils.int(wage.inactiveDaysThreshold, 3) ? Utils.percent(wage.inactivityPenaltyPercent, 0) : 0;
      return {
        employee,
        weightedStats,
        base,
        meritBonus,
        addictionPenalty,
        inactivityPenalty,
        suggested: Wages.estimate(employee, settings)
      };
    },
    breakdown(person, state) {
      const currentState = state || UI.state || DEFAULTS;
      const employee = Wages.resolvedEmployee(person, currentState);
      const breakdown = Wages.breakdownForEmployee(employee, currentState.settings || DEFAULTS.settings);
      breakdown.actualKnown = !!employee.wageFromApi;
      breakdown.actual = breakdown.actualKnown ? Utils.num(employee.wage, 0) : 0;
      breakdown.delta = breakdown.actualKnown ? breakdown.suggested - breakdown.actual : null;
      return breakdown;
    },
    tooltip(breakdown) {
      if (!breakdown) return 'No wage breakdown available.';
      const parts = [
        `Base ${Utils.money(breakdown.base)}`,
        `Weighted stats ${Math.round(Utils.num(breakdown.weightedStats, 0)).toLocaleString('en-US')}`
      ];
      if (breakdown.meritBonus) parts.push(`Merit bonus +${breakdown.meritBonus}%`);
      if (breakdown.addictionPenalty) parts.push(`Addiction penalty -${breakdown.addictionPenalty}%`);
      if (breakdown.inactivityPenalty) parts.push(`Inactivity penalty -${breakdown.inactivityPenalty}%`);
      if (breakdown.actualKnown) {
        const sign = breakdown.delta === 0 ? '' : (breakdown.delta > 0 ? '+' : '-');
        const gap = breakdown.delta === 0 ? 'matches live wage' : `${sign}${Utils.money(Math.abs(breakdown.delta))} vs live`;
        parts.push(`Live ${Utils.money(breakdown.actual)} (${gap})`);
      }
      return parts.join('; ');
    }
  };

  const Reports = {
    fullState(state) {
      return JSON.stringify(state, null, 2);
    },
    selectedState(state, sections) {
      const choices = Object.assign({}, DEFAULTS.ui.reportSections, sections || {});
      const data = Store.sanitizedState(Utils.clone(state));
      const keepTimeline = choices.timeline || choices.trainingLog || choices.analytics || choices.balance || choices.staff || choices.pastStaff || choices.directors;
      if (!choices.ledger) data.ledger = [];
      if (!choices.trainingLog) data.trainingLog = [];
      if (!choices.planner) data.planner = Utils.clone(DEFAULTS.planner);
      if (!choices.analytics && !choices.balance) data.analytics = Utils.clone(DEFAULTS.analytics);
      if (!choices.stock) {
        data.company.stock = Utils.clone(DEFAULTS.company.stock);
        data.company.stockSettings = {};
        data.company.stockHistory = [];
      }
      if (!choices.profile) data.company.profile = Utils.clone(DEFAULTS.company.profile);
      if (!choices.details) data.company.detailed = Utils.clone(DEFAULTS.company.detailed);
      if (!choices.staff) data.staff.current = [];
      if (!choices.pastStaff) data.staff.past = [];
      if (!choices.directors) {
        data.staff.directorsCurrent = [];
        data.staff.directorsPast = [];
      }
      if (!keepTimeline) {
        data.staff.timeline = [];
        data.company.newsSync = Utils.clone(DEFAULTS.company.newsSync);
      }
      if (!choices.settings) {
        data.settings = Utils.clone(DEFAULTS.settings);
        data.ui = Object.assign(Utils.clone(DEFAULTS.ui), { reportSections: choices });
      }
      data.ui.reportSections = choices;
      return data;
    },
    selectedStateJson(state, sections) {
      return JSON.stringify(Reports.selectedState(state, sections), null, 2);
    },
    html(state) {
      const sections = state.ui && state.ui.reportSections ? state.ui.reportSections : DEFAULTS.ui.reportSections;
      const body = Reports.newsletter(state, sections, { full: true });
      return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pythagoras Project - CIS Report</title>
  <style>
    body{margin:0;background:#111313;color:#eff2ef;font:14px Arial,Helvetica,sans-serif;line-height:1.5}
    main{max-width:980px;margin:0 auto;padding:24px}
    h1,h2{color:#fff}
    section{border-top:1px solid #343936;padding:18px 0}
    table{width:100%;border-collapse:collapse}
    th,td{padding:8px;border-bottom:1px solid #343936;text-align:left}
    th{color:#a8b0aa}
    .good{color:#46c58f}.bad{color:#d95d5d}
  </style>
</head>
<body>
  <main>
    <h1>Pythagoras Project - CIS company report</h1>
    <p>Generated ${Utils.esc(Utils.dateTime(new Date()))}.</p>
    ${body}
  </main>
</body>
</html>`;
    },
    ledgerTable(state) {
      if (!state.ledger.length) return '<p>No training entries yet.</p>';
      Ledger.prepare(state);
      return `<table><thead><tr><th>#</th><th>Order</th><th>Date</th><th>Player</th><th>ID</th><th>Type</th><th>Used</th><th>Remaining</th><th>Cost</th><th>Status</th></tr></thead><tbody>${state.ledger.map((entry, index) => {
        const totals = Ledger.totals(entry, state.settings);
        return `<tr><td>${index + 1}</td><td>${Utils.esc(entry.orderId || '')}</td><td>${Utils.esc(Utils.dateShort(entry.entryDate || entry.createdAt))}</td><td>${Utils.esc(entry.playerName)}</td><td>${Utils.esc(entry.playerId || '')}</td><td>${Utils.esc(entry.contractType)}</td><td>${totals.usedTrains}</td><td>${totals.remaining}</td><td>${Utils.money(totals.finalCost)}</td><td>${totals.paid ? 'Paid' : 'Unpaid'} / ${totals.done ? 'Done' : 'Undone'}</td></tr>`;
      }).join('')}</tbody></table>`;
    },
    trainingReceipt(state, entry) {
      const totals = Ledger.totals(entry, state.settings);
      const profile = state.company && state.company.profile || {};
      const companyName = profile.name || state.settings.companyName || state.settings.companyTypeName || 'Company';
      const companyId = profile.id || state.settings.companyId || '';
      const orderId = entry.orderId || entry.id || 'Training order';
      const staff = `${entry.playerName || 'Unknown'}${entry.playerId ? ` [${entry.playerId}]` : ''}`;
      const effectivePrice = totals.totalTrains ? Math.round(totals.finalCost / totals.totalTrains) : totals.price;
      const contract = entry.contractType === 'sponsored' ? 'Sponsored rotation' : entry.contractType === 'paid' ? 'Paid trains' : (entry.contractType || 'Training order');
      const rows = [
        ['Order ID', orderId],
        ['Company', `${companyName}${companyId ? ` #${companyId}` : ''}`],
        ['Staff', staff],
        ['Receipt date', Utils.dateTime(new Date())],
        ['Entry date', Utils.dateShort(entry.entryDate || entry.createdAt)],
        ['Contract', contract],
        ['Payment received', Utils.money(totals.payment)],
        ['Base price / train', Utils.money(totals.price)],
        ['Discount applied', entry.applyDiscount === false ? 'No' : `Yes (${totals.totalDiscount}%)`],
        ['Effective price / train', Utils.money(effectivePrice)],
        ['Training credit purchased', `${totals.totalTrains.toLocaleString()} train${totals.totalTrains === 1 ? '' : 's'}`],
        ['Given so far', `${totals.usedTrains.toLocaleString()} train${totals.usedTrains === 1 ? '' : 's'}`],
        ['Remaining', `${totals.remaining.toLocaleString()} train${totals.remaining === 1 ? '' : 's'}`],
        ['Status', `${totals.paid ? 'Paid' : 'Unpaid'} / ${totals.done ? 'Done' : 'Undone'}`]
      ];
      return `<div style="max-width:620px;border:1px solid #C89B3C;border-radius:8px;background:#0b0f14;color:#e6e6e6;font-family:Arial,Helvetica,sans-serif;padding:16px;line-height:1.45;">
  <div style="border-bottom:1px solid #343936;padding-bottom:10px;margin-bottom:12px;">
    <div style="color:#00c6ff;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Pythagoras Project - CIS</div>
    <h2 style="margin:4px 0 0;color:#fff;font-size:22px;">Training Receipt</h2>
    <div style="color:#C89B3C;font-size:13px;margin-top:3px;">${Utils.esc(orderId)}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;color:#e6e6e6;font-size:14px;">
    <tbody>${rows.map(([label, value]) => `<tr><td style="padding:7px 8px;border-bottom:1px solid #252b29;color:#a8b0aa;width:42%;">${Utils.esc(label)}</td><td style="padding:7px 8px;border-bottom:1px solid #252b29;color:#fff;font-weight:700;">${Utils.esc(value)}</td></tr>`).join('')}</tbody>
  </table>
  <p style="margin:12px 0 0;color:#a8b0aa;font-size:12px;">Generated locally by Pythagoras Project - CIS. Keep this receipt for training order records.</p>
</div>`;
    },
    plannerList(state) {
      if (!state.planner.days.length) return '<p>No planner calendar generated yet.</p>';
      return `<ul>${state.planner.days.slice(0, 14).map((day) => {
        const names = day.slots.map((slot) => `${Utils.esc(slot.playerName)} (${slot.type})`).join(', ') || 'Available Slot';
        return `<li><strong>${Utils.esc(day.date)}</strong>: ${names}</li>`;
      }).join('')}</ul>`;
    },
    analyticsTable(weeks) {
      if (!weeks.length) return '<p>No daily report data parsed yet.</p>';
      return `<table><thead><tr><th>#</th><th>Week</th><th>Date range</th><th>Customers</th><th>Income</th><th>Profit/customer</th><th>&Delta; LW Customers</th><th>&Delta; LW Profits</th><th>&Delta; AT Customers</th><th>&Delta; AT Profits</th></tr></thead><tbody>${weeks.map((week, index) => (
        `<tr><td>${index + 1}</td><td>Week ${week.week}</td><td>${Utils.esc(week.timestamp ? Utils.weekRange(new Date(week.timestamp * 1000)) : week.dateRange)}</td><td>${Number(week.customers || 0).toLocaleString()}</td><td>${Utils.money(week.income)}</td><td>${Utils.money(week.profitPerCustomer)}</td><td>${Reports.delta(week.vsLastCustomers, true)}</td><td>${Reports.deltaMoney(week.vsLastIncome)}</td><td>${Reports.delta(week.vsAverageCustomers, true)}</td><td>${Reports.deltaMoney(week.vsAverageIncome)}</td></tr>`
      )).join('')}</tbody></table>`;
    },
    delta(value, grouped) {
      const number = Number(value || 0);
      const sign = number > 0 ? '+' : number < 0 ? '-' : '';
      return `${sign}${grouped ? Math.abs(number).toLocaleString() : Math.abs(number)}`;
    },
    deltaMoney(value) {
      const sign = value > 0 ? '+' : value < 0 ? '-' : '';
      return `${sign}${Utils.money(Math.abs(value))}`;
    },
    trainingLogList(state) {
      const rows = (Array.isArray(state.trainingLog) ? state.trainingLog : []).slice(0, 40);
      if (!rows.length) return '<p>No synced training log rows yet.</p>';
      return `<ul>${rows.map((row) => `<li>${Utils.esc(Utils.dateShort(row.date))}: ${Utils.esc(row.playerName)} x${Utils.esc(row.count)} ${Utils.esc(row.position || '')}</li>`).join('')}</ul>`;
    },
    timelineList(state) {
      const rows = Timeline.collapseTimelineRows(Array.isArray(state.staff.timeline) ? state.staff.timeline : []).slice(0, 60);
      if (!rows.length) return '<p>No timeline rows selected.</p>';
      return `<ul>${rows.map((event) => {
        return `<li>${Utils.esc(Utils.dateTime(event.timestamp))}: ${Utils.esc(event.displayType || event.type || 'Event')} - ${Utils.esc(Store.eventText(event) || event.plainText || event.text || '')}</li>`;
      }).join('')}</ul>`;
    },
    stockList(state) {
      const warnings = Company.stockWarnings(state);
      if (!warnings.length) return '<p>No stock warnings.</p>';
      return `<ul>${warnings.map((item) => `<li>${Utils.esc(item.name)}: ${Number(item.inStock || 0).toLocaleString()} in stock</li>`).join('')}</ul>`;
    },
    staffSummary(state, rows, title) {
      rows = rows || [];
      if (!rows.length) return `<p>No ${Utils.esc(title).toLowerCase()} rows.</p>`;
      return `<table><thead><tr><th>#</th><th>Name</th><th>Role</th><th>Contract</th><th>Days</th></tr></thead><tbody>${rows.map((person, index) => `<tr><td>${index + 1}</td><td>${Utils.esc(person.name)}</td><td>${Utils.esc(person.role || '')}</td><td>${Utils.esc(person.contractType || '')}</td><td>${Utils.esc(person.daysInCompany || '')}</td></tr>`).join('')}</tbody></table>`;
    },
    profileBlock(state) {
      const profile = state.company.profile || {};
      return `<p>${Utils.esc(profile.name || 'Company')} ${profile.id ? `#${Utils.esc(profile.id)}` : ''}. Type: ${Utils.esc(profile.typeName || 'Not detected')}. Rating: ${Utils.esc(profile.rating || state.settings.companyStars || 0)}/10. Staff: ${Utils.esc(Company.profileHeadcount(profile))} / ${Utils.esc(profile.maxEmployees || 'unknown')}.</p>`;
    },
    detailsBlock(state) {
      const detailed = state.company.detailed || {};
      const stockUsed = (state.company.stock.items || []).reduce((sum, item) => sum + Utils.num(item.inStock, 0), 0);
      const slots = Utils.num(detailed.storageSpace, 0);
      const storage = slots || stockUsed ? `${Utils.esc(detailed.storageSize || 'Storage')}: ${stockUsed.toLocaleString()} / ${slots.toLocaleString()} slots.` : '';
      return `<p>Funds: ${Utils.money(detailed.funds)}. Popularity: ${Utils.esc(detailed.popularity || 0)}%. Efficiency: ${Utils.esc(detailed.efficiency || 0)}%. Environment: ${Utils.esc(detailed.environment || 0)}%. ${storage} Value: ${Utils.money(detailed.value)}.</p>`;
    },
    dailyBalanceTable(state) {
      const staff = Company.staffEmployees(state.staff.current || [], state.company.profile.directorId || state.settings.userId || '');
      const includeWages = !state.ui || state.ui.dailyBalanceIncludeWages !== false;
      const wages = includeWages ? staff.reduce((sum, person) => {
        const wage = Utils.num(person.wage, 0);
        return sum + (person.wageFromApi || wage > 0 ? wage : 0);
      }, 0) : 0;
      const adBudget = Utils.num(state.company.detailed.advertisingBudget, 0);
      const rows = [];
      (Array.isArray(state.analytics.weeks) ? state.analytics.weeks : []).forEach((week) => {
        (week.days || []).forEach((day) => {
          if (!day.date || !(day.customers || day.income)) return;
          rows.push({
            date: day.date,
            income: Utils.num(day.income, 0),
            customers: Utils.num(day.customers, 0),
            wages,
            adBudget,
            profit: Utils.num(day.income, 0) - wages - adBudget,
            rating: Utils.int(state.company.profile.rating || state.settings.companyStars, 0)
          });
        });
      });
      if (!rows.length) return '<p>No balance rows yet.</p>';
      rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return `<table><thead><tr><th>#</th><th>Date</th><th>Income</th><th>Customers</th><th>Wages</th><th>Ad Budget</th><th>Profit</th><th>Company Rating</th></tr></thead><tbody>${rows.slice(0, 14).map((row, index) => `<tr><td>${index + 1}</td><td>${Utils.esc(Utils.dateShort(row.date))}</td><td>${Utils.money(row.income)}</td><td>${Number(row.customers || 0).toLocaleString()}</td><td>${Utils.money(row.wages)}</td><td>${Utils.money(row.adBudget)}</td><td>${Utils.money(row.profit)}</td><td>${Utils.esc(row.rating)} / 10</td></tr>`).join('')}</tbody></table>`;
    },
    newsletter(state, sections, options) {
      const choices = Object.assign({}, DEFAULTS.ui.reportSections, sections || {});
      const summary = Ledger.summary(state.ledger, state.settings);
      const full = options && options.full;
      const weeks = Timeline.compareWeeks(Timeline.completedWeeks(Array.isArray(state.analytics.weeks) ? state.analytics.weeks : [])).slice(0, full ? 26 : 8);
      const parts = ['<h2>Company training update</h2>'];
      if (choices.summary) parts.push(`<section><h3>Summary</h3><p>${summary.entries} ledger entries. Paid queue: ${summary.paidQueue}. Sponsored queue: ${summary.sponsored}. Outstanding balance: ${Utils.money(summary.due)}.</p></section>`);
      if (choices.ledger) parts.push(`<section><h3>Training ledger</h3><p>Remaining paid queue: ${summary.paidQueue}. Sponsored rotation queue: ${summary.sponsored}. Unpaid trains: ${summary.unpaidQueue}. Outstanding balance: ${Utils.money(summary.due)}.</p>${Reports.ledgerTable(state)}</section>`);
      if (choices.trainingLog) parts.push(`<section><h3>Training log</h3>${Reports.trainingLogList(state)}</section>`);
      if (choices.planner) parts.push(`<section><h3>Train Schedule</h3>${Reports.plannerList(state)}</section>`);
      if (choices.analytics) parts.push(`<section><h3>Weekly analytics</h3>${Reports.analyticsTable(weeks)}</section>`);
      if (choices.balance) parts.push(`<section><h3>Operating Balance</h3>${Reports.dailyBalanceTable(state)}</section>`);
      if (choices.stock) parts.push(`<section><h3>Stock watch</h3>${Reports.stockList(state)}</section>`);
      if (choices.staff) parts.push(`<section><h3>Staff</h3><p>Current staff: ${(state.staff.current || []).length}. Past staff: ${(state.staff.past || []).length}.</p></section>`);
      if (choices.pastStaff) parts.push(`<section><h3>Past staff</h3>${Reports.staffSummary(state, state.staff.past || [], 'Past staff')}</section>`);
      if (choices.directors) parts.push(`<section><h3>Directors</h3>${Reports.staffSummary(state, state.staff.directorsCurrent || [], 'Directors')}</section>`);
      if (choices.timeline) parts.push(`<section><h3>Company timeline</h3>${Reports.timelineList(state)}</section>`);
      if (choices.profile) parts.push(`<section><h3>Business profile</h3>${Reports.profileBlock(state)}</section>`);
      if (choices.details) parts.push(`<section><h3>Business details</h3>${Reports.detailsBlock(state)}</section>`);
      if (choices.settings) parts.push(`<section><h3>Settings</h3><p>Date format: ${Utils.esc(state.settings.dateFormat || 'locale-medium')}. Theme: ${Utils.esc(state.settings.theme || 'modul')}. Training price: ${Utils.money(state.settings.trainingPrice)}.</p></section>`);
      return parts.join('\n');
    },
    bugReport(state) {
      return [
        'Pythagoras Project - CIS bug report',
        `Version: ${APP.version}`,
        `URL: ${location.href}`,
        `UserId: ${state.settings.userId || PageData.userId() || 'not detected'}`,
        `CompanyId: ${state.settings.companyId || PageData.companyId() || 'not detected'}`,
        `Ledger entries: ${state.ledger.length}`,
        `Timeline events: ${state.staff.timeline.length}`,
        `Generated: ${Utils.nowIso()}`
      ].join('\n');
    }
  };

  const UI = {
    state: null,
    root: null,
    popup: null,
    toastTimer: null,
    trainHighlightTimer: null,
    contextTimer: null,
    popupCloseTimer: null,
    autoSaveTimer: null,
    footerButtonObserver: null,
    footerButtonPending: false,
    footerButtonRetryTimer: null,
    footerButtonRetryStarted: 0,
    footerButtonRetryIndex: 0,
    footerButtonWatchTimer: null,
    footerButtonWatchForce: false,
    tooltipEl: null,
    activeTooltipAnchor: null,
    dragging: null,
    suppressClickUntil: 0,
    syncJobs: {},
    syncLog: [],
    staffCardCloudTimer: null,
    settingsCloudTimer: null,
    ledgerCloudTimer: null,
    workspaceMirrorTimer: null,
    workspaceMirrorInFlight: false,
    workspaceMirrorReason: 'autosave',

    async init() {
      UI.state = await Store.loadAsync();
      if (UI.isStandalonePopup()) {
        try { window.name = APP.popupName; } catch (error) {}
        UI.state.ui.mode = 'popup';
      }
      UI.state.settings.userId = UI.state.settings.userId || PageData.userId();
      UI.state.settings.userName = UI.state.settings.userName || PageData.userName();
      UI.state.settings.companyId = UI.state.settings.companyId || PageData.companyId();
      Company.dedupeStaff(UI.state);
      Company.removeDirectorsFromStaff(UI.state);
      Ledger.prepare(UI.state);
      Company.syncTrainingSetup(UI.state);
      Store.save(UI.state);
      if (Object.keys(UI.state.staff.localEdits || {}).length && Store.canUseCloudWorkspace(UI.state)) UI.scheduleStaffCardCloudSave(1500);
      if ((Store.loadLedgerPending().orders || []).length && Store.canUseCloudWorkspace(UI.state)) UI.scheduleLedgerCloudSave(1600);
      if (Store.canUseCloudWorkspace(UI.state)) UI.scheduleWorkspaceMirrorSave('startup', 2200);
      UI.installCss(document);
      UI.root = document.createElement('div');
      UI.root.id = APP.id;
      document.body.appendChild(UI.root);
      UI.render(UI.root, document);
      if (UI.state.staff.timeline.length) {
        setTimeout(() => {
          UI.state.staff.timeline = Timeline.reclassify(UI.state.staff.timeline);
          Timeline.rebuildPeople(UI.state);
          UI.state.analytics.weeks = Timeline.analyticsFromEvents(UI.state.staff.timeline, UI.state);
          Ledger.syncTrainingLog(UI.state);
          Store.save(UI.state);
          UI.render(UI.root, document);
        }, 100);
      }
      UI.scheduleTrainingHighlight();
      window.addEventListener('hashchange', UI.scheduleTrainingHighlight);
      window.addEventListener('resize', UI.ensureBounds);
      if (UI.isStandalonePopup()) UI.watchPopupContext();
    },

    installCss(doc) {
      if (doc.getElementById(`${APP.id}-style`)) return;
      if (doc === document) {
        const gm = Store.gmApi();
        try {
          if (gm && typeof gm.addStyle === 'function') {
            gm.addStyle(CSS);
            return;
          }
        } catch (error) {
          console.warn('[Pythagoras Project - CIS] GM.addStyle failed.', error);
        }
        try {
          if (typeof GM_addStyle === 'function') {
            GM_addStyle(CSS);
            return;
          }
        } catch (error) {
          console.warn('[Pythagoras Project - CIS] GM_addStyle failed.', error);
        }
      }
      const style = doc.createElement('style');
      style.id = `${APP.id}-style`;
      style.textContent = CSS;
      doc.head.appendChild(style);
    },

    render(root, doc) {
      UI.hideTooltip();
      UI.renderMemo = {};
      Ledger.prepare(UI.state);
      const isPopup = doc !== document || (doc === document && UI.isStandalonePopup());
      const launcherOnly = !isPopup && !UI.isCompanyPage();
      if (launcherOnly) {
        root.className = `${UI.themeClass()} pp-cis-launcher-only`;
        UI.applyThemeVars(root);
        root.innerHTML = '';
        UI.syncFooterButton(root, true);
        if (UI.rootBoundsObserver) {
          UI.rootBoundsObserver.disconnect();
          UI.rootBoundsObserver = null;
        }
        return;
      }
      if (UI.apiKeyMissing() && UI.state.ui.tab !== 'settings') UI.state.ui.tab = 'settings';
      const isPopupBadge = !isPopup && UI.state.ui.mode === 'popup';
      const disabledContext = isPopup && !UI.companyContextOk();
      root.className = `${UI.themeClass()} ${UI.state.ui.editMode ? 'pp-edit-mode ' : ''}${UI.state.ui.privacyMode ? 'pp-privacy ' : ''}${UI.state.ui.minimized ? 'pp-cis-minimized ' : ''}${isPopup ? 'pp-cis-popup-root ' : ''}${isPopupBadge ? 'pp-popup-badge ' : ''}${disabledContext ? 'pp-disabled-context' : ''}`;
      UI.applyThemeVars(root);
      if (!isPopup) {
        root.style.left = UI.state.ui.left || '';
        root.style.top = UI.state.ui.top || '';
        root.style.right = UI.state.ui.left ? 'auto' : '18px';
      }
      root.innerHTML = UI.layout(isPopup);
      UI.decoratePanels(root);
      UI.applyPrivacy(root);
      UI.applyTour(root);
      UI.syncResponsiveTabs(root);
      UI.syncFooterButton(root);
      UI.observeResponsiveTabs(root);
      UI.bind(root, doc);
      UI.observePanelSizes(root);
      if (!isPopup && !isPopupBadge) {
        UI.observeRootBounds();
        setTimeout(UI.ensureBounds, 0);
      } else if (UI.rootBoundsObserver) {
        UI.rootBoundsObserver.disconnect();
        UI.rootBoundsObserver = null;
      }
    },

    decoratePanels(root) {
      Array.from(root.querySelectorAll('.pp-panel')).forEach((panel, index) => {
        const head = panel.querySelector('.pp-head');
        if (!head) return;
        const title = head.querySelector('h2,h3');
        const panelId = panel.dataset.panelId || String(title ? title.textContent : `panel-${index}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `panel-${index}`;
        panel.dataset.panelId = panelId;
        const savedSize = UI.state.ui.panelSizes && UI.state.ui.panelSizes[panelId];
        if (savedSize) {
          panel.style.width = savedSize.width || '';
          panel.style.height = savedSize.height || '';
        }
        if (UI.state.ui.collapsedPanels && UI.state.ui.collapsedPanels[panelId]) panel.classList.add('is-collapsed');
        if (!panel.querySelector('[data-action="collapse-panel"]')) {
          const button = root.ownerDocument.createElement('button');
          const collapsed = panel.classList.contains('is-collapsed');
          button.className = 'pp-btn is-quiet pp-collapse-toggle';
          button.type = 'button';
          button.dataset.action = 'collapse-panel';
          button.dataset.panelId = panelId;
          button.textContent = collapsed ? '\u25B8' : '\u25BE';
          button.title = collapsed ? 'Expand panel' : 'Collapse panel';
          button.setAttribute('aria-label', button.title);
          panel.appendChild(button);
        }
        if (!panel.querySelector('[data-action="show-panel-hint"]')) {
          const button = root.ownerDocument.createElement('button');
          button.className = 'pp-btn is-quiet pp-hint-toggle';
          button.type = 'button';
          button.dataset.action = 'show-panel-hint';
          button.dataset.panelId = panelId;
          button.textContent = '?';
          button.title = 'Panel help';
          button.setAttribute('aria-label', button.title);
          panel.appendChild(button);
        }
      });
    },

    panelHintText(panelId) {
      const hints = {
        'identity': 'Identity stores the API key locally when Remember locally is enabled, checks key access, and holds the sync center. Run sync buttons manually so every Torn API request is a deliberate action.',
        'training-setup': 'Training setup controls price, paid cap, auto-detected training supply, and auto-schedule penalties.',
        'discount-rules': 'Discount rules calculate training-order totals from merits, loyalty, promo, and optional manual overrides.',
        'training-orders': 'Training orders track paid and sponsored demand. Orders keep their staff ID binding even when rows are sorted.',
        'training-log': 'Training log reads synced training history and shows one Monday-Sunday week at a time.',
        'train-schedule': 'Train Schedule prepares the daily queue. Open/highlight first, then use the train action to advance the frozen queue.',
        'company-timeline': 'Company Timeline stores company news locally and filters it without redrawing weekly analytics.',
        'weekly-analytics': 'Weekly analytics sums daily reports Monday to Sunday and expands rows into daily detail.',
        'staff': 'Staff uses synced employee data plus local contract/card edits. PTR/STR counters are based on the contract at the time each train was logged.',
        'directors': 'Directors are built from employee sync and company timeline director-change events.',
        'business-profile': 'Business Profile combines profile, detailed, stock, and employee sync data where available.',
        'data-and-reports': 'Data and reports uses the selected switches for HTML/newsletter output and JSON backup/import sections.',
        'theme-editor': 'Theme editor stores visual presets, custom colors, graph colors, and contract colors.'
      };
      const key = String(panelId || '').toLowerCase();
      return hints[key] || hints[key.replace(/-\d+$/, '')] || 'This panel stores one part of the company workflow. Collapse it or resize it in panel edit mode when you need more room.';
    },

    showPanelHint(panelId) {
      UI.toast(UI.panelHintText(panelId));
    },

    applyPrivacy(root) {
      if (!root || !UI.state.ui.privacyMode) return;
      UI.maskSensitiveTables(root);
      UI.maskSensitiveKeyValues(root);
      UI.maskPrivacyInputs(root);
      UI.maskPrivacyAttributes(root);
      UI.maskPrivacyText(root);
    },

    privacyMaskText(value) {
      let text = String(value == null ? '' : value);
      text = text.replace(/[+-]?\$[\d,]+(?:\.\d+)?/g, '$***');
      text = text.replace(/\b\d{1,3}(?:\.\d+)?%/g, '***%');
      text = text.replace(/\[\s*\d{5,}\s*\]/g, '[hidden]');
      text = text.replace(/\b(?:XID|ID|User ID|Company ID)\s*[:#]?\s*\d{5,}\b/gi, (match) => match.replace(/\d{5,}/, '***'));
      text = text.replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, '***');
      text = text.replace(/\b\d{6,}\b/g, '***');
      return text;
    },

    privacyLabelSensitive(label) {
      const text = String(label || '').toLowerCase();
      if (!text) return false;
      return /\b(user|company|player|receiver|employee)\s*id\b/.test(text)
        || /\b(ids?|xid|api key|key access|funds?|bank|income|customers?|wages?|ad budget|profit|payment|price|cost|rrp|value|stock|sold|quantity|qty|capacity|warn|effectiveness|manual|man|int|end|stat|intelligence|endurance|merits?|discount|trains?|str|ptr|pt|days|last action|activity|addiction|inactive|inactivity|rating|employees|popularity|efficiency|environment|storage|balance)\b/.test(text);
    },

    privacyTableHeaderSensitive(label) {
      const text = String(label || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!text || text === '#' || text === 'actions' || text === 'action' || text === 'staffname' || text === 'staff name' || text === 'name' || text === 'employee' || text === 'role' || text === 'contract' || text === 'status' || text === 'date' || text === 'from' || text === 'to') return false;
      return UI.privacyLabelSensitive(text);
    },

    maskSensitiveTables(root) {
      Array.from(root.querySelectorAll('table')).forEach((table) => {
        const headers = Array.from(table.querySelectorAll('thead th')).map((head) => head.textContent.trim());
        if (!headers.length) return;
        Array.from(table.querySelectorAll('tbody tr')).forEach((row) => {
          Array.from(row.children).forEach((cell, index) => {
            if (!UI.privacyTableHeaderSensitive(headers[index] || '')) return;
            if (cell.querySelector('button,input,select,textarea')) return;
            cell.textContent = '***';
            cell.classList.add('pp-privacy-value');
          });
        });
      });
    },

    maskSensitiveKeyValues(root) {
      Array.from(root.querySelectorAll('.pp-kv')).forEach((row) => {
        const label = row.children && row.children[0] ? row.children[0].textContent : '';
        const value = row.children && row.children[1] ? row.children[1] : null;
        if (!value || !UI.privacyLabelSensitive(label)) return;
        if (value.querySelector('button,input,select,textarea')) {
          Array.from(value.querySelectorAll('input,select,textarea')).forEach((control) => control.classList.add('pp-privacy-input'));
          return;
        }
        value.textContent = '***';
        value.classList.add('pp-privacy-value');
      });
      Array.from(root.querySelectorAll('.pp-stat strong')).forEach((value) => {
        value.textContent = '***';
        value.classList.add('pp-privacy-value');
      });
    },

    maskPrivacyInputs(root) {
      Array.from(root.querySelectorAll('input,textarea,select')).forEach((control) => {
        const tag = String(control.tagName || '').toLowerCase();
        const label = [
          control.name,
          control.placeholder,
          control.title,
          control.getAttribute('aria-label'),
          control.dataset ? control.dataset.uiField : '',
          control.dataset ? control.dataset.plannerField : '',
          control.dataset ? control.dataset.themeEditor : ''
        ].filter(Boolean).join(' ');
        const value = tag === 'select' ? '' : String(control.value || '');
        if (UI.privacyLabelSensitive(label) || (value && UI.privacyMaskText(value) !== value)) control.classList.add('pp-privacy-input');
      });
    },

    maskPrivacyAttributes(root) {
      Array.from(root.querySelectorAll('[title],[aria-label]')).forEach((element) => {
        const title = element.getAttribute('title');
        const aria = element.getAttribute('aria-label');
        if (title) element.setAttribute('title', UI.privacyMaskText(title));
        if (aria) element.setAttribute('aria-label', UI.privacyMaskText(aria));
      });
    },

    maskPrivacyText(root) {
      const skipTags = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SVG']);
      const walk = (node) => {
        if (!node) return;
        if (node.nodeType === 3) {
          const masked = UI.privacyMaskText(node.nodeValue);
          if (masked !== node.nodeValue) node.nodeValue = masked;
          return;
        }
        if (node.nodeType !== 1 || skipTags.has(node.tagName)) return;
        Array.from(node.childNodes).forEach(walk);
      };
      walk(root);
    },

    observePanelSizes(root) {
      if (UI.panelResizeObserver) {
        UI.panelResizeObserver.disconnect();
        UI.panelResizeObserver = null;
      }
      if (!UI.state.ui.editMode || typeof ResizeObserver !== 'function') return;
      UI.panelResizeObserver = new ResizeObserver((entries) => {
        clearTimeout(UI.panelResizeTimer);
        UI.panelResizeTimer = setTimeout(() => {
          UI.state.ui.panelSizes = UI.state.ui.panelSizes || {};
          entries.forEach((entry) => {
            const panel = entry.target;
            const panelId = panel.dataset.panelId;
            const rect = panel.getBoundingClientRect();
            if (!panelId || rect.width <= 0 || rect.height <= 0) return;
            UI.state.ui.panelSizes[panelId] = {
              width: `${Math.round(rect.width)}px`,
              height: `${Math.round(rect.height)}px`
            };
          });
          Store.save(UI.state);
          UI.scheduleWorkspaceMirrorSave('panel-resize', 1500);
          if (root === UI.root) UI.ensureBounds();
        }, 250);
      });
      Array.from(root.querySelectorAll('.pp-panel')).forEach((panel) => UI.panelResizeObserver.observe(panel));
    },

    observeRootBounds() {
      if (UI.rootBoundsObserver) {
        UI.rootBoundsObserver.disconnect();
        UI.rootBoundsObserver = null;
      }
      if (typeof ResizeObserver !== 'function' || !UI.root) return;
      UI.rootBoundsObserver = new ResizeObserver(() => {
        clearTimeout(UI.rootBoundsTimer);
        UI.rootBoundsTimer = setTimeout(UI.ensureBounds, 100);
      });
      UI.rootBoundsObserver.observe(UI.root);
    },

    syncResponsiveTabs(root) {
      const targetRoot = root || UI.currentRoot();
      if (!targetRoot) return;
      const tabs = targetRoot.querySelector('.pp-tabs');
      if (!tabs) {
        targetRoot.classList.remove('pp-tabs-glyph-only');
        return;
      }
      const rect = targetRoot.getBoundingClientRect();
      const width = rect.width || tabs.clientWidth || 0;
      const needsCompact = width > 0 && width < 900;
      targetRoot.classList.toggle('pp-tabs-glyph-only', needsCompact);
    },

    observeResponsiveTabs(root) {
      if (UI.tabsResizeObserver) {
        UI.tabsResizeObserver.disconnect();
        UI.tabsResizeObserver = null;
      }
      if (typeof ResizeObserver !== 'function' || !root) return;
      UI.tabsResizeObserver = new ResizeObserver(() => {
        clearTimeout(UI.tabsResizeTimer);
        UI.tabsResizeTimer = setTimeout(() => UI.syncResponsiveTabs(root), 80);
      });
      UI.tabsResizeObserver.observe(root);
      const tabs = root.querySelector('.pp-tabs');
      if (tabs) UI.tabsResizeObserver.observe(tabs);
    },

    ensureBounds() {
      if (!UI.root || UI.state.ui.mode === 'popup') return;
      if (!UI.isCompanyPage()) return;
      if (window.matchMedia && window.matchMedia('(max-width: 860px)').matches) return;
      if (UI.state.ui.minimized && UI.syncFooterButton(UI.root)) return;
      const rect = UI.root.getBoundingClientRect();
      const width = Math.min(rect.width || 340, window.innerWidth);
      const height = Math.min(rect.height || 220, window.innerHeight);
      const maxLeft = Math.max(0, window.innerWidth - width);
      const maxTop = Math.max(0, window.innerHeight - height);
      const rawLeft = Number.parseInt(UI.root.style.left || '', 10);
      const rawTop = Number.parseInt(UI.root.style.top || '', 10);
      const left = Utils.clamp(Number.isFinite(rawLeft) ? rawLeft : Math.round(rect.left), 0, maxLeft);
      const top = Utils.clamp(Number.isFinite(rawTop) ? rawTop : Math.round(rect.top), 0, maxTop);
      const nextLeft = `${left}px`;
      const nextTop = `${top}px`;
      const changed = UI.root.style.left !== nextLeft || UI.root.style.top !== nextTop || UI.root.style.right !== 'auto';
      UI.root.style.left = nextLeft;
      UI.root.style.top = nextTop;
      UI.root.style.right = 'auto';
      UI.state.ui.left = nextLeft;
      UI.state.ui.top = nextTop;
      if (changed) Store.save(UI.state);
    },

    footerButtonTitle() {
      let alertText = '';
      try {
        const rows = UI.notificationRows();
        if (rows.length) {
          alertText = `\n\nAlerts:\n${rows.map((row) => `${row.title || 'Notice'}: ${row.text || ''}`.trim()).join('\n')}`;
        }
      } catch (error) {}
      return `${APP.name}${alertText}`;
    },

    companyPageUrl() {
      return 'https://www.torn.com/companies.php';
    },

    isCompanyPage(win) {
      try {
        const href = (win && win.location && win.location.href) || location.href;
        return /^https:\/\/www\.torn\.com\/companies\.php(?:[?#]|$)/i.test(href);
      } catch (error) {
        return false;
      }
    },

    goToCompanyPage() {
      try {
        location.assign(UI.companyPageUrl());
      } catch (error) {
        location.href = UI.companyPageUrl();
      }
    },

    footerButtonIconSvg(iconClasses) {
      const classes = `${String(iconClasses || '').trim()} pp-footer-button-icon`.trim();
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="170 120 510 470" width="24" height="24" class="${Utils.esc(classes)}" role="img" aria-label="Pythagoras Project triangle logo mark" focusable="false">
        <g>
          <polygon points="425,145 205,565 645,565" fill="none" stroke="#bdbdbd" stroke-width="28" stroke-linejoin="miter"/>
          <polygon points="425,205 258,535 592,535" fill="none" stroke="#bdbdbd" stroke-opacity="0.38" stroke-width="8"/>
          <path d="M305 515 L505 385 L585 535" fill="none" stroke="#bdbdbd" stroke-width="26" stroke-linecap="butt" stroke-linejoin="miter"/>
        </g>
      </svg>`;
    },

    footerButtonRef() {
      const inFooter = (node) => {
        if (!node || !node.parentNode || UI.root && UI.root.contains(node)) return false;
        const footer = document.getElementById('chatRoot');
        if (footer && !footer.contains(node)) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const byId = (id) => document.getElementById(id);
      const byPrefix = (prefix) => Array.from((document.getElementById('chatRoot') || document).querySelectorAll(`button[id^="${prefix}"]`)).find(inFooter);
      const directIds = [
        byId('notes_panel_button'),
        byId('people_panel_button'),
        byId('notes_settings_button'),
        byId('channel_panel_button:public_trade'),
        byId('channel_panel_button:public_global'),
        byPrefix('channel_panel_button:company-'),
        byPrefix('channel_panel_button:faction-'),
        byPrefix('channel_panel_button:')
      ];
      for (const ref of directIds) {
        if (inFooter(ref)) return ref;
      }
      const selectors = [
        'button[id="notes_panel_button"]',
        'button[id="people_panel_button"]',
        'button[id="notes_settings_button"]',
        'button[id="channel_panel_button:public_trade"]',
        'button[id="channel_panel_button:public_global"]',
        'button[id^="channel_panel_button:company-"]',
        'button[id^="channel_panel_button:faction-"]',
        'button[id^="channel_panel_button:"]',
        'button[id$="_panel_button"]'
      ];
      const footer = document.getElementById('chatRoot') || document;
      for (const selector of selectors) {
        const visible = Array.from(footer.querySelectorAll(selector)).find(inFooter);
        if (visible) return visible;
      }
      return null;
    },

    footerButtonContainer() {
      const footer = document.getElementById('chatRoot');
      if (!footer) return null;
      const knownButton = footer.querySelector([
        '#notes_panel_button',
        '#people_panel_button',
        '#notes_settings_button',
        'button[id^="channel_panel_button:"]',
        'button[id$="_panel_button"]'
      ].join(','));
      if (knownButton) {
        const parent = knownButton.parentElement;
        if (parent && parent !== footer) {
          const parentClass = String(parent.className || '');
          if (!parentClass.includes('root___tV4zg')) return parent;
          if (parent.parentElement && parent.parentElement !== footer) return parent.parentElement;
        }
      }
      const containers = Array.from(footer.querySelectorAll('div')).filter((node) => {
        if (!node || UI.root && UI.root.contains(node)) return false;
        const buttons = node.querySelectorAll('button[id^="channel_panel_button:"],#notes_panel_button,#people_panel_button,#notes_settings_button,button[id$="_panel_button"]');
        if (!buttons.length) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return containers.sort((a, b) => b.querySelectorAll('button').length - a.querySelectorAll('button').length)[0] || null;
    },

    footerButtonAnchor(ref) {
      if (!ref || !ref.parentNode) return null;
      const wrap = ref.parentElement;
      if (!wrap || wrap === document.body) return ref;
      if (wrap.id === 'ppcis-footer-wrap') return null;
      const onlyChild = wrap.children && wrap.children.length === 1 && wrap.firstElementChild === ref;
      const wrapperClass = String(wrap.className || '');
      if (onlyChild && wrapperClass.includes('root___tV4zg')) return wrap;
      return ref;
    },

    footerButtonWrapperSource(ref, anchor) {
      if (!ref) return null;
      const wrap = ref.parentElement;
      return wrap && wrap === anchor ? wrap : null;
    },

    footerButtonStyle(btn, root) {
      let alerts = [];
      try { alerts = UI.notificationRows(); } catch (error) {}
      btn.title = UI.footerButtonTitle();
      if (alerts.length) btn.dataset.ppcisAlerts = String(alerts.length);
      else delete btn.dataset.ppcisAlerts;
    },

    footerButtonClick(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (!UI.isCompanyPage()) {
        UI.goToCompanyPage();
        return;
      }
      UI.toggleMinimized();
    },

    bindFooterButtonClick(node) {
      if (!node || node.__ppcisClickBound) return;
      node.__ppcisClickBound = true;
      node.addEventListener('click', UI.footerButtonClick, true);
    },

    mountFooterButton(root, force) {
      if (!root || !UI.state || !UI.state.ui || (!force && UI.state.ui.mode === 'popup')) {
        if (root) root.classList.remove('pp-footer-button-mounted');
        return false;
      }
      const ref = UI.footerButtonRef();
      const existing = document.getElementById('ppcis-footer-btn');
      const anchor = UI.footerButtonAnchor(ref);
      const sourceWrap = UI.footerButtonWrapperSource(ref, anchor);
      const fallbackParent = !anchor ? UI.footerButtonContainer() : null;
      if (existing) {
        const wrap = document.getElementById('ppcis-footer-wrap');
        if (!wrap) {
          existing.remove();
        } else {
          if (ref && anchor && anchor.parentNode) {
            if (wrap.parentNode !== anchor.parentNode || wrap.nextSibling !== anchor) anchor.parentNode.insertBefore(wrap, anchor);
            wrap.className = sourceWrap?.className || wrap.className || 'root___tV4zg';
            const styleText = sourceWrap?.getAttribute && sourceWrap.getAttribute('style');
            if (styleText) wrap.setAttribute('style', styleText);
            if (!wrap.style.transition) wrap.style.transition = 'transform linear';
            existing.className = ref.className || existing.className;
          } else if (fallbackParent) {
            if (wrap.parentNode !== fallbackParent) fallbackParent.appendChild(wrap);
            wrap.className = wrap.className || 'root___tV4zg';
            if (!wrap.style.transition) wrap.style.transition = 'transform linear';
          }
          UI.bindFooterButtonClick(wrap);
          UI.bindFooterButtonClick(existing);
          const svgClassName = ref?.querySelector('svg')?.className;
          const iconClasses = typeof svgClassName === 'string' ? svgClassName : svgClassName?.baseVal || '';
          existing.innerHTML = UI.footerButtonIconSvg(iconClasses);
          UI.footerButtonStyle(existing, root);
          root.classList.add('pp-footer-button-mounted');
          return true;
        }
      }
      if ((!ref || !anchor || !anchor.parentNode) && !fallbackParent) {
        root.classList.remove('pp-footer-button-mounted');
        return false;
      }
      const parent = anchor && anchor.parentNode ? anchor.parentNode : fallbackParent;
      if (!parent) {
        root.classList.remove('pp-footer-button-mounted');
        return false;
      }
      const wrap = document.createElement('div');
      wrap.id = 'ppcis-footer-wrap';
      wrap.className = sourceWrap?.className || 'root___tV4zg';
      const styleText = sourceWrap?.getAttribute && sourceWrap.getAttribute('style');
      if (styleText) wrap.setAttribute('style', styleText);
      if (!wrap.style.transition) wrap.style.transition = 'transform linear';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'ppcis-footer-btn';
      btn.className = ref?.className || 'root___oMZdA root___wVuUd root___cbBSX';
      const svgClassName = ref?.querySelector('svg')?.className;
      const iconClasses = typeof svgClassName === 'string' ? svgClassName : svgClassName?.baseVal || '';
      btn.innerHTML = UI.footerButtonIconSvg(iconClasses);
      UI.bindFooterButtonClick(btn);
      UI.bindFooterButtonClick(wrap);
      UI.footerButtonStyle(btn, root);
      wrap.appendChild(btn);
      if (anchor && anchor.parentNode === parent) parent.insertBefore(wrap, anchor);
      else parent.appendChild(wrap);
      root.classList.add('pp-footer-button-mounted');
      return true;
    },

    observeFooterButton(root, force) {
      if (UI.footerButtonObserver || !document.body) return;
      UI.footerButtonObserver = new MutationObserver(() => {
        if (UI.footerButtonPending) return;
        UI.footerButtonPending = true;
        requestAnimationFrame(() => {
          UI.footerButtonPending = false;
          if (!force && UI.state?.ui?.mode === 'popup') {
            UI.removeFooterButton();
            return;
          }
          if (!UI.mountFooterButton(root || UI.root, force)) UI.scheduleFooterButtonRetry(root || UI.root, force);
        });
      });
      UI.footerButtonObserver.observe(document.body, { childList: true, subtree: true });
    },

    scheduleFooterButtonRetry(root, force) {
      if (UI.footerButtonRetryTimer || !document.body) return;
      if (!UI.footerButtonRetryStarted) {
        UI.footerButtonRetryStarted = Date.now();
        UI.footerButtonRetryIndex = 0;
      }
      const delays = [0, 40, 100, 200, 400, 800, 1200, 2000, 3200, 5000];
      const delay = delays[Math.min(UI.footerButtonRetryIndex, delays.length - 1)];
      UI.footerButtonRetryIndex += 1;
      UI.footerButtonRetryTimer = window.setTimeout(() => {
        UI.footerButtonRetryTimer = null;
        if (!root || !UI.state || !UI.state.ui) return;
        if (!force && UI.state.ui.mode === 'popup') return;
        const mounted = UI.mountFooterButton(root || UI.root, force);
        UI.observeFooterButton(root || UI.root, force);
        if (mounted || Date.now() - UI.footerButtonRetryStarted > 15000) {
          UI.footerButtonRetryStarted = 0;
          UI.footerButtonRetryIndex = 0;
          return;
        }
        UI.scheduleFooterButtonRetry(root || UI.root, force);
      }, delay);
    },

    startFooterButtonWatch(root, force) {
      if (!document.body) return;
      if (UI.footerButtonWatchTimer && UI.footerButtonWatchForce === !!force) return;
      if (UI.footerButtonWatchTimer) {
        window.clearInterval(UI.footerButtonWatchTimer);
        UI.footerButtonWatchTimer = null;
      }
      UI.footerButtonWatchForce = !!force;
      UI.footerButtonWatchTimer = window.setInterval(() => {
        if (!root || !UI.state || !UI.state.ui) return;
        if (!force && UI.state.ui.mode === 'popup') {
          UI.removeFooterButton();
          return;
        }
        const wrap = document.getElementById('ppcis-footer-wrap');
        const btn = document.getElementById('ppcis-footer-btn');
        if (!wrap || !btn || !document.body.contains(wrap)) {
          if (!UI.mountFooterButton(root || UI.root, force)) UI.scheduleFooterButtonRetry(root || UI.root, force);
          return;
        }
        UI.footerButtonStyle(btn, root || UI.root);
      }, 2000);
    },

    removeFooterButton() {
      const wrap = document.getElementById('ppcis-footer-wrap');
      const node = document.getElementById('ppcis-footer-btn');
      if (wrap) wrap.remove();
      else if (node) node.remove();
      if (UI.footerButtonObserver) {
        UI.footerButtonObserver.disconnect();
        UI.footerButtonObserver = null;
      }
      UI.footerButtonPending = false;
      if (UI.footerButtonRetryTimer) {
        window.clearTimeout(UI.footerButtonRetryTimer);
        UI.footerButtonRetryTimer = null;
      }
      UI.footerButtonRetryStarted = 0;
      UI.footerButtonRetryIndex = 0;
      if (UI.footerButtonWatchTimer) {
        window.clearInterval(UI.footerButtonWatchTimer);
        UI.footerButtonWatchTimer = null;
      }
      UI.footerButtonWatchForce = false;
      if (UI.root) UI.root.classList.remove('pp-footer-button-mounted');
    },

    syncFooterButton(root, force) {
      if (!root || !UI.state || !UI.state.ui || (!force && UI.state.ui.mode === 'popup')) {
        UI.removeFooterButton();
        if (root) root.classList.remove('pp-footer-button-mounted');
        return false;
      }
      if (UI.mountFooterButton(root, force)) {
        UI.observeFooterButton(root, force);
        UI.startFooterButtonWatch(root, force);
        return !!UI.state.ui.minimized;
      }
      UI.observeFooterButton(root, force);
      UI.startFooterButtonWatch(root, force);
      UI.scheduleFooterButtonRetry(root, force);
      return false;
    },

    toggleMinimized() {
      const root = UI.currentRoot();
      if (!root) return;
      if (UI.state.ui.minimized) {
        UI.state.ui.minimized = false;
        root.style.width = UI.state.ui.restoreWidth || '';
        root.style.height = UI.state.ui.restoreHeight || '';
        UI.saveRender();
        return;
      }
      const rect = root.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && !(window.matchMedia && window.matchMedia('(max-width: 860px)').matches)) {
        UI.state.ui.restoreWidth = `${Math.round(rect.width)}px`;
        UI.state.ui.restoreHeight = `${Math.round(rect.height)}px`;
      }
      root.style.width = '';
      root.style.height = '';
      UI.state.ui.minimized = true;
      UI.saveRender();
    },

    topBarSyncButtons() {
      const disabled = UI.apiKeyMissing() ? ' disabled' : '';
      return `<div class="pp-title-sync" aria-label="Sync controls">
        <button class="pp-btn is-primary ${UI.syncProgressClass('smart-sync')}" style="${UI.syncProgressStyle('smart-sync')}" type="button" data-action="smart-sync" data-sync-action="smart-sync" title="Run Smart sync"${disabled}>Smart</button>
        <button class="${UI.syncButtonClass('business', true)} ${UI.syncProgressClass('business')}" style="${UI.syncProgressStyle('business')}" type="button" data-action="sync-business" data-sync-action="business" title="Sync business profile"${disabled}>Business</button>
        <button class="${UI.syncButtonClass('news', false)} ${UI.syncProgressClass('news')}" style="${UI.syncProgressStyle('news')}" type="button" data-action="sync-news" data-sync-action="news" title="Sync latest company news"${disabled}>News</button>
        <button class="${UI.syncButtonClass('employees', false)} ${UI.syncProgressClass('employees')}" style="${UI.syncProgressStyle('employees')}" type="button" data-action="sync-employees" data-sync-action="employees" title="Sync employees"${disabled}>Employees</button>
        <button class="${UI.syncButtonClass('stock', false)} ${UI.syncProgressClass('stock')}" style="${UI.syncProgressStyle('stock')}" type="button" data-action="sync-stock" data-sync-action="stock" title="Sync services sold and stock"${disabled}>Stock</button>
        <button class="pp-btn ${UI.syncProgressClass('training-log')}" style="${UI.syncProgressStyle('training-log')}" type="button" data-action="sync-training-log" data-sync-action="training-log" title="Sync training log"${disabled}>Training</button>
      </div>`;
    },

    layout(isPopup) {
      const state = UI.state;
      if (!isPopup && state.ui.mode === 'popup') return UI.popupBadge();
      const disabledOverlay = isPopup && !UI.companyContextOk() ? UI.disabledOverlay() : '';
      const tabs = [['timeline', '&#128338;', 'Timeline'], ['ledger', '&#128211;', 'Training Ledger'], ['staff', '&#129489;&#8205;&#128295;', 'Staff'], ['directors', '&#128081;', 'Directors'], ['profile', '&#127970;', 'Business Profile'], ['balance', '&#128202;', 'Balance'], ['stock', '&#128230;', 'Stock'], ['wage', '&#128184;', 'Wage'], ['data', '&#128450;&#65039;', 'Data'], ['about', '&#8505;&#65039;', 'About'], ['settings', '&#9881;&#65039;', 'Settings'], ['theme', '&#127912;', 'Theme']];
      const title = BUILD_CONFIG.enabled && BUILD_CONFIG.buildName ? `${APP.name} - ${Utils.esc(BUILD_CONFIG.buildName)}` : APP.name;
      return `
        <div class="pp-shell">
          <div class="pp-titlebar" data-drag-handle="1"${state.ui.minimized ? ' data-action="toggle-min"' : ''}>
            <div class="pp-brand">
              ${UI.logoMark('main')}
              <strong>${title}</strong>
              <span class="pp-version-pill">v${Utils.esc(APP.version)}</span>
              ${UI.topBarSyncButtons()}
              ${UI.stockMiniAlert()}
            </div>
            <div class="pp-actions">
              <button class="pp-btn ${state.ui.privacyMode ? 'is-warn pp-privacy-button' : ''}" type="button" data-action="toggle-privacy" title="${state.ui.privacyMode ? 'Turn privacy mode off' : 'Privacy mode for screenshots'}">PRV</button>
              <button class="pp-btn is-quiet" type="button" data-action="toggle-min" title="${state.ui.minimized ? 'Restore' : 'Minimize'}">${state.ui.minimized ? '&#9635;' : '&#8722;'}</button>
              <button class="pp-btn" type="button" data-action="toggle-edit-mode" title="${state.ui.editMode ? 'Lock Panels' : 'Edit Panels'}">${state.ui.editMode ? '&#128274;' : '&#9998;&#65039;'}</button>
              <button class="pp-btn" type="button" data-action="reset-ui" title="Reset UI">&#9851;&#65039;</button>
              <button class="pp-btn" type="button" data-action="${isPopup ? 'embed-mode' : 'popup-mode'}" title="Embedded/Popup">${isPopup ? '&#128204;' : '&#128470;&#65039;'}</button>
            </div>
          </div>
          <div class="pp-tabs">
            ${tabs.map(([id, icon, label]) => `<button type="button" class="pp-tab ${state.ui.tab === id ? 'is-active' : ''}" data-tab="${id}" title="${Utils.esc(label)}" aria-label="${Utils.esc(label)}"><span class="pp-tab-icon" aria-hidden="true">${icon}</span><span class="pp-tab-label">${Utils.esc(label)}</span></button>`).join('')}
          </div>
          ${UI.notifications()}
          <div class="pp-body">${UI.page()}</div>
          ${disabledOverlay}
          ${UI.tourOverlay()}
        </div>`;
    },

    themeClass() {
      const theme = String((UI.state.settings && UI.state.settings.theme) || 'modul').toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (theme === 'custom' || UI.savedThemeById(theme)) return 'pp-theme-custom';
      return `pp-theme-${theme || 'modul'}`;
    },

    isStandalonePopup() {
      try {
        return window.name === APP.popupName || new URLSearchParams(location.search || '').get('ppcis_popup') === '1';
      } catch (error) {
        return false;
      }
    },

    popupUrl() {
      return 'about:blank';
    },

    themeVars(source) {
      const defaults = DEFAULTS.settings.customTheme.vars;
      const vars = source || (UI.state.settings.customTheme && UI.state.settings.customTheme.vars) || {};
      return Object.keys(defaults).reduce((next, key) => {
        const value = String(vars[key] || defaults[key]).trim();
        next[key] = /^#[0-9a-f]{6}$/i.test(value) ? value : defaults[key];
        return next;
      }, {});
    },

    currentThemeVars(theme) {
      const key = String(theme || UI.state.settings.theme || 'modul').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'modul';
      const saved = UI.savedThemeById(key);
      if (saved) return UI.themeVars(saved.vars);
      if (key === 'custom') return UI.themeVars(UI.state.settings.customTheme && UI.state.settings.customTheme.vars);
      return UI.themePresetVars(key);
    },

    applyThemeVars(root, varsOverride) {
      if (!root) return;
      Object.keys(DEFAULTS.settings.customTheme.vars).forEach((key) => root.style.removeProperty(`--${key}`));
      const selected = UI.savedThemeById(UI.state.settings.theme);
      if (String(UI.state.settings.theme || '') !== 'custom' && !selected && !varsOverride) return;
      const vars = UI.themeVars(varsOverride || (selected && selected.vars));
      Object.entries(vars).forEach(([key, value]) => root.style.setProperty(`--${key}`, value));
    },

    previewTheme(theme) {
      const root = UI.currentRoot();
      Array.from(root.classList).forEach((name) => {
        if (name.startsWith('pp-theme-')) root.classList.remove(name);
      });
      const safeTheme = String(theme || 'modul').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'modul';
      const saved = UI.savedThemeById(safeTheme);
      root.classList.add(`pp-theme-${safeTheme === 'custom' || saved ? 'custom' : safeTheme}`);
      Object.keys(DEFAULTS.settings.customTheme.vars).forEach((key) => root.style.removeProperty(`--${key}`));
      if (saved) UI.applyThemeVars(root, saved.vars);
      else if (safeTheme === 'custom') UI.applyThemeVars(root);
    },

    companyContextOk() {
      try {
        const popupOpener = UI.isStandalonePopup() && window.opener && !window.opener.closed ? window.opener : null;
        const href = UI.popup && UI.popup.opener && !UI.popup.opener.closed ? UI.popup.opener.location.href : (popupOpener ? popupOpener.location.href : location.href);
        return /https:\/\/www\.torn\.com\/companies\.php/i.test(href);
      } catch (error) {
        return false;
      }
    },

    disabledOverlay() {
      return `<div class="pp-disabled-overlay">
        <div class="pp-empty"><strong>Company page required</strong><br>Pythagoras Project - CIS is paused because the opener is not on Torn's company page. Return to <code>companies.php</code> and the popup will unlock itself.</div>
      </div>`;
    },

    notificationSettings() {
      return Store.merge(Utils.clone(DEFAULTS.settings.notifications), UI.state.settings.notifications || {});
    },

    apiKeyMissing() {
      return !String(UI.state.settings && UI.state.settings.apiKey || '').trim();
    },

    apiKeyMissingRow() {
      return {
        type: 'api-key',
        severity: 'danger',
        title: 'API key required',
        text: 'Add your Torn API key in Settings before using sync features.',
        action: 'focus-api-key',
        sticky: true,
        notificationKey: 'api-key|missing'
      };
    },

    stockWarningRows() {
      const settings = UI.notificationSettings();
      if (!settings.stock.enabled) return [];
      return Company.stockWarnings(UI.state).map((item) => {
        const basis = item.warningMode === 'amount' ? `${Number(item.warningAmount || 0).toLocaleString()} qty` : `${item.warningPercent || 10}%`;
        const service = item.label || item.name || 'Service';
        return { type: 'stock', severity: 'danger', service, title: `Low stock: ${service}`, text: `${service}: ${Number(item.inStock || 0).toLocaleString()} in stock, warning at ${basis}`, action: 'open-stock-page' };
      });
    },

    personAddiction(person) {
      const details = person && person.effectiveness && person.effectiveness.details ? person.effectiveness.details : {};
      return Math.abs(Utils.num(person && person.addiction !== undefined ? person.addiction : details.addiction, 0));
    },

    personInactiveDays(person) {
      const explicit = Utils.int(person && (person.inactiveDays || person.inactive_days), 0);
      if (explicit) return explicit;
      const lastAction = Utils.int(person && person.lastActionTimestamp, 0);
      return lastAction ? Math.floor((Date.now() / 1000 - lastAction) / 86400) : 0;
    },
    personInactiveHours(person) {
      const lastAction = Utils.int(person && person.lastActionTimestamp, 0);
      if (lastAction) return Math.max(0, Math.floor((Date.now() / 1000 - lastAction) / 3600));
      const explicitDays = Utils.int(person && (person.inactiveDays || person.inactive_days), 0);
      return explicitDays ? explicitDays * 24 : 0;
    },
    strikeHistoryWith(strikes, strike) {
      const rows = Array.isArray(strikes) ? Utils.clone(strikes) : [];
      const date = Utils.dayKey(strike.at) || Utils.todayInput();
      const existing = rows.find((row) => row.type === strike.type && (row.date || Utils.dayKey(row.at)) === date);
      if (existing) {
        if (Utils.num(strike.value, 0) > Utils.num(existing.value, 0)) {
          existing.value = strike.value;
          existing.threshold = strike.threshold;
          existing.at = strike.at;
          existing.note = strike.note;
          existing.source = strike.source;
        }
        return rows;
      }
      rows.push(Object.assign({ id: Utils.id('strike'), date }, strike));
      return rows.sort((a, b) => Utils.dateTimestamp(b.at || b.date) - Utils.dateTimestamp(a.at || a.date)).slice(0, 200);
    },
    riskStrikesForPerson(person, source) {
      const settings = UI.notificationSettings();
      const rows = [];
      const now = Utils.nowIso();
      const addictionThreshold = Math.max(1, Utils.num(settings.addiction && settings.addiction.threshold, 4));
      const addiction = UI.personAddiction(person);
      if (settings.addiction && settings.addiction.enabled !== false && addiction > addictionThreshold) {
        rows.push({
          type: 'addiction',
          at: now,
          value: addiction,
          threshold: addictionThreshold,
          source,
          note: `Addiction impact ${addiction} exceeded threshold ${addictionThreshold}.`
        });
      }
      const inactivityHours = UI.personInactiveHours(person);
      if (settings.inactivity && settings.inactivity.enabled !== false && inactivityHours > 24) {
        rows.push({
          type: 'inactivity',
          at: now,
          value: inactivityHours,
          threshold: 24,
          source,
          note: `${inactivityHours} hours since last action exceeded 24 hours.`
        });
      }
      return rows;
    },
    recordStaffRiskStrikes(source) {
      const staff = Company.staffEmployees(UI.state.staff.current || [], UI.state.company.profile.directorId || UI.state.settings.userId || '');
      let added = 0;
      let changed = false;
      staff.forEach((person) => {
        const strikes = UI.riskStrikesForPerson(person, source || 'sync');
        if (!strikes.length) return;
        const before = Array.isArray(person.strikeHistory) ? person.strikeHistory.length : 0;
        let history = Array.isArray(person.strikeHistory) ? person.strikeHistory : [];
        const beforeJson = JSON.stringify(history);
        strikes.forEach((strike) => { history = UI.strikeHistoryWith(history, strike); });
        const after = history.length;
        if (after > before) added += after - before;
        if (JSON.stringify(history) === beforeJson) return;
        changed = true;
        const key = UI.personRowKey(person);
        UI.updatePersonByKey(key, { strikeHistory: history });
        UI.updateProfileEmployeeByKey(key, { strikeHistory: history });
        UI.recordStaffCardEdit(Object.assign({}, person, { strikeHistory: history }), { strikeHistory: history });
      });
      if (changed) {
        Store.save(UI.state);
        Store.updateSyncCache(UI.state, ['employees', 'business']);
        UI.scheduleStaffCardCloudSave(1200);
        UI.scheduleWorkspaceMirrorSave('risk-strikes', 3200);
      }
      return added;
    },

    staffRiskRows() {
      const settings = UI.notificationSettings();
      const rows = [];
      const staff = Company.staffEmployees(UI.state.staff.current || [], UI.state.company.profile.directorId || UI.state.settings.userId || '');
      if (settings.addiction.enabled) {
        const threshold = Math.max(1, Utils.num(settings.addiction.threshold, 4));
        staff.forEach((person) => {
          const value = UI.personAddiction(person);
          if (value >= threshold) rows.push({ type: 'addiction', severity: 'warn', title: `Addiction watch: ${person.name || person.id}`, text: `${person.name || person.id}: addiction impact ${value}, threshold ${threshold}.` });
        });
      }
      if (settings.inactivity.enabled) {
        const threshold = Math.max(1, Utils.int(settings.inactivity.thresholdDays, 3));
        staff.forEach((person) => {
          const days = UI.personInactiveDays(person);
          if (days >= threshold) rows.push({ type: 'inactivity', severity: 'warn', title: `Inactivity watch: ${person.name || person.id}`, text: `${person.name || person.id}: ${days} day${days === 1 ? '' : 's'} since last action, threshold ${threshold}.` });
        });
      }
      return rows;
    },

    newestSync(values) {
      const times = (values || []).map((value) => value ? new Date(value).getTime() : 0).filter((value) => Number.isFinite(value) && value > 0);
      return times.length ? new Date(Math.max.apply(null, times)).toISOString() : '';
    },

    historyVisibleDays() {
      const entitlement = UI.state.entitlement || {};
      if (entitlement.visibleHistoryDays === null) return null;
      return Math.max(1, Utils.int(entitlement.visibleHistoryDays, 7));
    },

    historyCutoffUnix() {
      const days = UI.historyVisibleDays();
      return days === null ? 0 : Math.floor((Date.now() - days * 86400000) / 1000);
    },

    canUseHistoricalBackfill() {
      const entitlement = UI.state.entitlement || {};
      const days = UI.historyVisibleDays();
      return days === null || days > 7 || Boolean(entitlement.flags && entitlement.flags.canAccessArchives);
    },

    historyWindowMessage() {
      const days = UI.historyVisibleDays();
      return days === null ? 'Full history is available for this entitlement.' : `This entitlement can sync and view the last ${days} day${days === 1 ? '' : 's'} of history.`;
    },

    filterEventsByHistoryWindow(events) {
      const cutoff = UI.historyCutoffUnix();
      if (!cutoff) return events || [];
      return (events || []).filter((event) => Utils.int(event && event.timestamp, 0) >= cutoff);
    },

    syncSources() {
      const marks = UI.state.company.syncWatermarks || {};
      return {
        business: { label: 'Business Profile', last: UI.newestSync([UI.state.company.profile.lastSynced, UI.state.company.detailed.lastSynced, UI.state.company.stock.lastSynced, marks.business && marks.business.latestSyncedAt]) },
        news: { label: 'Company timeline', last: UI.newestSync([UI.state.company.newsSync.lastSynced, marks.events && marks.events.latestAt]) },
        employees: { label: 'Employees', last: UI.newestSync([UI.state.company.profile.lastSynced, marks.staff && marks.staff.latestSnapshotAt, marks.staff && marks.staff.latestMemberUpdatedAt]) },
        stock: { label: 'Stock', last: UI.newestSync([UI.state.company.stock.lastSynced, marks.stock && marks.stock.latestSyncedAt]) },
        detailed: { label: 'Company detailed', last: UI.newestSync([UI.state.company.detailed.lastSynced, marks.business && marks.business.latestSyncedAt]) }
      };
    },

    syncStatus(sourceKey) {
      const settings = UI.notificationSettings();
      if (!settings.sync.enabled) return 'fresh';
      const source = UI.syncSources()[sourceKey] || {};
      const warnHours = Math.max(1, Utils.num(settings.sync.warnHours, 24));
      const dangerHours = Math.max(warnHours, Utils.num(settings.sync.dangerHours, 72));
      if (!source.last) return 'warn';
      const ageHours = (Date.now() - new Date(source.last).getTime()) / 3600000;
      if (!Number.isFinite(ageHours)) return 'warn';
      if (ageHours >= dangerHours) return 'danger';
      if (ageHours >= warnHours) return 'warn';
      return 'fresh';
    },

    syncButtonClass(sourceKey, primary) {
      const status = UI.syncStatus(sourceKey);
      if (status === 'danger') return 'pp-btn is-danger';
      if (status === 'warn') return 'pp-btn is-warn';
      return `pp-btn${primary ? ' is-primary' : ''}`;
    },

    staleSyncRows() {
      const settings = UI.notificationSettings();
      if (!settings.sync.enabled) return [];
      const sources = UI.syncSources();
      const warnHours = Math.max(1, Utils.num(settings.sync.warnHours, 24));
      const dangerHours = Math.max(warnHours, Utils.num(settings.sync.dangerHours, 72));
      return Object.entries(sources)
        .filter(([key]) => ['business', 'news', 'stock'].includes(key))
        .map(([key, source]) => {
          const status = UI.syncStatus(key);
          if (status === 'fresh') return null;
          const ageText = source.last ? Utils.timeAgo(Math.floor(new Date(source.last).getTime() / 1000)) : 'never synced';
          const threshold = status === 'danger' ? `${dangerHours}h` : `${warnHours}h`;
          return { type: 'sync', severity: status, title: `${source.label} sync is ${status === 'danger' ? 'stale' : 'getting old'}`, text: `${source.label}: ${ageText}. Warning threshold ${threshold}.` };
        })
        .filter(Boolean);
    },

    notificationKey(row) {
      return [
        row && row.type,
        row && row.service,
        row && row.title,
        row && row.text
      ].filter(Boolean).join('|').toLowerCase();
    },

    notificationDismissals() {
      const rows = UI.state.dismissedNotifications;
      return rows && typeof rows === 'object' && !Array.isArray(rows) ? rows : {};
    },

    isNotificationDismissed(key) {
      return UI.notificationDismissals()[String(key || '')] === Utils.tctWorkingDayKey();
    },

    notificationRows() {
      if (UI.apiKeyMissing()) return [UI.apiKeyMissingRow()];
      UI.recordStaffRiskStrikes('Notification');
      return UI.stockWarningRows().concat(UI.staffRiskRows(), UI.staleSyncRows()).map((row) => {
        const key = UI.notificationKey(row);
        return Object.assign({}, row, { notificationKey: key });
      }).filter((row) => !UI.isNotificationDismissed(row.notificationKey));
    },

    stockMiniAlert() {
      const rows = UI.notificationRows();
      if (!rows.length) return '';
      const apiKey = rows.find((row) => row.type === 'api-key');
      if (apiKey) return `<span class="pp-stock-mini-alert" title="${Utils.esc(apiKey.text)}">${Utils.esc(apiKey.title)}</span>`;
      const stock = rows.filter((row) => row.type === 'stock');
      const names = stock.map((row) => row.service).filter(Boolean);
      const label = names.length === 1 ? `Low stock: ${names[0]}` : names.length > 1 ? `Low stock: ${names[0]} +${names.length - 1}` : `Alerts: ${rows.length}`;
      return `<span class="pp-stock-mini-alert" title="${Utils.esc(rows.map((row) => row.text).join('\n'))}">${Utils.esc(label)}</span>`;
    },

    dismissNotification(key) {
      const safeKey = String(key || '');
      if (!safeKey) return;
      UI.state.dismissedNotifications = UI.notificationDismissals();
      UI.state.dismissedNotifications[safeKey] = Utils.tctWorkingDayKey();
      Store.saveNotificationDismissals(UI.state);
      Store.save(UI.state);
      UI.render(UI.currentRoot(), UI.currentRoot().ownerDocument);
      UI.toast('Notification hidden until the next 18:10 TCT business reset.');
    },

    notifications() {
      const rows = UI.notificationRows();
      if (!rows.length) return '<div class="pp-alerts is-empty"></div>';
      return `<div class="pp-alerts">${rows.map((row) => {
        const action = row.action ? ` data-action="${Utils.esc(row.action)}"` : '';
        const dismiss = row.sticky ? '' : `<button class="pp-alert-dismiss" type="button" data-action="dismiss-notification" data-notification-key="${Utils.esc(row.notificationKey)}" title="Hide until the next 18:10 TCT business reset">x</button>`;
        return `<div class="pp-alert is-${Utils.esc(row.severity || 'danger')}"><span class="pp-alert-icon">!</span><button class="pp-alert-main" type="button"${action}><strong>${Utils.esc(row.title)}</strong> ${Utils.esc(row.text)}</button>${dismiss}</div>`;
      }).join('')}</div>`;
    },

    tourSteps() {
      return [
        {
          tab: 'settings',
          selector: '.pp-titlebar',
          title: 'Pythagoras Project - CIS',
          text: 'This is a local Torn company control room: it keeps company data, staff history, training orders, stock, wages, analytics, reports, and settings in one Tampermonkey panel.',
          notes: [
            'It only uses Torn API calls you trigger or data already on the loaded company page.',
            'Global sync buttons live in Settings so every data pull is deliberate.',
            'Everything is stored locally in your browser unless you export it.'
          ]
        },
        {
          tab: 'settings',
          selector: '.pp-actions',
          title: 'Window controls',
          text: 'The top controls manage the shell: privacy mode, minimize, edit panel layout, reset UI, and popup or embedded mode.',
          notes: [
            'PRV masks sensitive values for screenshots without deleting data.',
            'Edit Panels lets you resize panels; Reset UI restores saved panel sizes and layout.',
            'Popup mode is script-only and should reconnect through Torn page changes.'
          ]
        },
        {
          tab: 'settings',
          selector: '[data-tour="api-key"]',
          title: 'API key and local storage',
          text: 'Paste your Torn key here. Remembered API keys are stored locally, masked after entry, and shown again with the View button when needed.',
          notes: [
            'A missing key suppresses other alerts and keeps you on Settings.',
            'User ID and Company ID are auto-filled from key info and sync results.',
            'The script labels this as Minimal/Full because different actions need different Torn selections.'
          ]
        },
        {
          tab: 'settings',
          selector: '[data-tour="check-key"]',
          title: 'Check key',
          text: 'Check key calls Torn key info once and validates access before the rest of the workflow.',
          notes: [
            'It confirms Full Access level when available.',
            'It fills User ID and Company ID from the key response.',
            'The checked timestamp is shown beside Key access so you know when it was last verified.'
          ]
        },
        {
          tab: 'settings',
          selector: '[data-tour="sync-center"]',
          title: 'Sync center order',
          text: 'Use the sync center as your normal maintenance checklist. Each button is one explicit user action.',
          notes: [
            'Recommended first setup: Check key, Sync business, Sync employees, Sync latest news, Fetch older news, Sync training log, Sync past staff, Sync services sold.',
            'Freshness warnings turn sync buttons yellow or red based on your notification settings.',
            'Staff-card log sync stays inside each card because it targets one employee at a time.'
          ]
        },
        {
          tab: 'settings',
          selector: '[data-tour="sync-business"]',
          title: 'Sync business',
          text: 'Sync business pulls profile, detailed, stock, and employees in one company request.',
          notes: [
            'It updates rating, type, director, employee count, storage, funds, company health bars, stock rows, and staff effectiveness data.',
            'Company type controls business-specific UI such as racing details for Mechanic Shop and Car Dealership.',
            'Training setup auto-detects company rating and Trainer bonus from this synced context.'
          ]
        },
        {
          tab: 'settings',
          selector: '[data-tour="sync-employees"]',
          title: 'Sync employees',
          text: 'Sync employees refreshes the live staff roster from Torn employee data.',
          notes: [
            'It updates stats, wages, roles, effectiveness, last action, merits, addiction and inactivity values.',
            'Local contract type is preserved, so paid/sponsored choices do not reset to paid.',
            'These synced values feed staff cards, wage suggestions, planner risk priority, and Balance wages.'
          ]
        },
        {
          tab: 'settings',
          selector: '[data-tour="sync-news"]',
          title: 'Sync latest news',
          text: 'Sync latest news fetches recent company news and reclassifies it into timeline events.',
          notes: [
            'It detects hires, applications, leaves, fires, director changes, rating changes, funds, daily reports, and training news.',
            'Daily reports feed Weekly Analytics and Balance.',
            'Training news can later be converted into local training log rows.'
          ]
        },
        {
          tab: 'settings',
          selector: '[data-tour="sync-older-news"]',
          title: 'Fetch older news',
          text: 'Fetch older news continues walking backward from the oldest stored event until company history is covered or Torn stops returning older rows.',
          notes: [
            'Use it during initial setup to fill historical analytics, staff history, and director history.',
            'After the first backfill, regular latest-news syncs are enough for maintenance.',
            'The status text on Timeline shows newest sync, oldest event, and company start estimate.'
          ]
        },
        {
          tab: 'settings',
          selector: '[data-tour="sync-training-log"]',
          title: 'Sync training log',
          text: 'Sync training log converts stored training news into structured local train records.',
          notes: [
            'Rows are linked by Torn user ID where possible, not just by name.',
            'Training counts feed STR and PTR columns based on each staff member contract type.',
            'The Training log view groups recent days into pill-style daily entries.'
          ]
        },
        {
          tab: 'settings',
          selector: '[data-tour="sync-past-staff"]',
          title: 'Sync past staff',
          text: 'Sync past staff rebuilds old employee rows from stored timeline data and training records.',
          notes: [
            'It is useful after a full news backfill.',
            'Past staff cards are intentionally simpler than current staff cards.',
            'Tenure uses hire and left dates, with company founding date as a fallback when a hire date is missing.'
          ]
        },
        {
          tab: 'settings',
          selector: '[data-tour="sync-stock"]',
          title: 'Sync services sold',
          text: 'Sync services sold refreshes stock/service sales from Torn stock data.',
          notes: [
            'It updates cost, RRP, price, in stock, on order, sold quantity, and sold worth.',
            'Services with cost 0 are treated as non-restockable services.',
            'Restockable products drive low-stock alerts, storage planning, and service graphs.'
          ]
        },
        {
          tab: 'settings',
          selector: '[data-tour="training-setup"]',
          title: 'Training setup',
          text: 'Training setup controls the price model and planner capacity.',
          notes: [
            'Company rating and Trainer bonus are auto-detected when Auto-Detect is enabled.',
            'Paid cap per day limits how many paid training orders can be scheduled before sponsored rotation fills the rest.',
            'Auto mode priority can penalize addiction and inactivity so risky sponsored staff are trained later.'
          ]
        },
        {
          tab: 'settings',
          selector: '[data-tour="discount-rules"]',
          title: 'Discount rules and log trigger',
          text: 'Discount rules calculate training-order pricing from merits, loyalty tiers, promo discount, and caps.',
          notes: [
            'Manual discount overrides the normal cap and ignores other discounts when entered.',
            'The Apply discounts switch on an order lets you add historical orders without the current discount logic.',
            'The log trigger is the text scanned by Import from log when importing paid orders from Torn logs.'
          ]
        },
        {
          tab: 'settings',
          selector: '[data-tour="notification-rules"]',
          title: 'Notification rules',
          text: 'Notification rules decide what appears above containers and on the minimized pill.',
          notes: [
            'Low stock warnings use each restockable service threshold.',
            'Addiction and inactivity warnings use synced effectiveness data.',
            'Sync freshness warnings use your warning and danger hour settings.'
          ]
        },
        {
          tab: 'settings',
          selector: '[data-tour="role-management"]',
          title: 'Role management',
          text: 'Role management keeps company-specific roles tidy.',
          notes: [
            'Detected roles can be renamed, colored, and mapped to Torn role IDs.',
            'Rank IDs can be inferred by cross-referencing staff logs with company news training roles.',
            'Script-only labels such as Employee and Ex-Employee are kept out of wage-role calculations.'
          ]
        },
        {
          tab: 'profile',
          selector: '[data-tour="business-profile"]',
          title: 'Business Profile',
          text: 'Business Profile is the live company snapshot.',
          notes: [
            'It shows rating stars, trainings per day, director, company age and founded date, staff count, income flow, storage, funds, and health bars.',
            'Current employee effectiveness includes suggested roles and themed hover breakdowns.',
            'The average effectiveness line gives a quick read on company health.'
          ]
        },
        {
          tab: 'timeline',
          selector: '[data-tour="company-timeline"]',
          title: 'Company timeline',
          text: 'Timeline is the chronological history built from company news.',
          notes: [
            'Use the filter to focus on reports, funds, training, hires, directors, rating, and other event types.',
            'Accepted applications are treated as hires.',
            'Funds deposits and withdrawals are categorized together for cleaner history.'
          ]
        },
        {
          tab: 'timeline',
          selector: '[data-tour="weekly-analytics"]',
          title: 'Weekly analytics',
          text: 'Weekly analytics sums daily reports into Monday-to-Sunday weeks.',
          notes: [
            'Rows include the current week with placeholder days until reports arrive.',
            'Expandable rows show individual weekdays, sorted newest-first.',
            'Customer and income deltas compare weekdays and weeks so trend changes are visible.'
          ]
        },
        {
          tab: 'ledger',
          selector: '[data-tour="ledger-summary"]',
          title: 'Training ledger summary',
          text: 'The top ledger summary recalculates local training totals as orders change.',
          notes: [
            'Paid orders are FIFO by order ID and date.',
            'Used/given counts feed remaining trains and schedule demand.',
            'Done and Paid switches update the order state without editing the read-only order details.'
          ]
        },
        {
          tab: 'ledger',
          selector: '[data-tour="training-orders"]',
          title: 'Training Orders',
          text: 'Training Orders is where paid train purchases and historical paid trains are entered.',
          notes: [
            'Choosing a staff member links the order to Torn user ID and fills merits from synced staff/profile data.',
            'Typing payment estimates total trains; typing total trains estimates the payment required after discounts.',
            'Receipt copies Torn-mail-ready HTML and can open the staff member compose page for easy paste.'
          ]
        },
        {
          tab: 'ledger',
          selector: '[data-tour="training-log"]',
          title: 'Training log',
          text: 'Training log shows actual trains detected from company news.',
          notes: [
            'Only the recent seven-day window is shown at once, with week navigation.',
            'Pills use role-dot color from the Staff role settings.',
            'These records feed STR/PTR counters by the staff member current contract type.'
          ]
        },
        {
          tab: 'ledger',
          selector: '[data-tour="train-schedule"]',
          title: 'Train Schedule',
          text: 'Train Schedule turns orders and sponsored rotation into a daily queue.',
          notes: [
            'Auto mode schedules paid trains first, then sponsored/free capacity goes to eligible staff with the highest role-stat need.',
            'Manual mode gives selectable sponsored slots; Hybrid applies paid queue first and lets you choose the rest.',
            'New hires stay off the schedule for their first 3 days, even when they already have paid training waiting.',
            'The handoff buttons open Torn employee training context and highlight or train the current queued member where allowed.'
          ]
        },
        {
          tab: 'staff',
          staffTab: 'current',
          selector: '[data-tour="staff-container"]',
          title: 'Current staff',
          text: 'Current staff combines synced Torn data with local contract and planning data.',
          notes: [
            'STR is sponsored trains received, PTR is paid trains received, and PT is paid trains owed from orders.',
            'Suggested role uses synced stats and role requirements.',
            'Edit opens a staff card with contract, working stats, employment info, goals, and history.'
          ]
        },
        {
          tab: 'staff',
          staffTab: 'past',
          selector: '[data-tour="staff-container"]',
          title: 'Past staff',
          text: 'Past staff keeps exit history and historical training context separate from the current roster.',
          notes: [
            'The table is height-limited with its own scrollbar.',
            'Past cards focus on quick corrections, dates, tenure, exit type, aliases, and history.',
            'Terminated is available as a past contract type.'
          ]
        },
        {
          tab: 'directors',
          directorTab: 'current',
          selector: '[data-tour="directors-container"]',
          title: 'Current directors',
          text: 'Directors are kept out of the staff roster and tracked in their own current/past timeline.',
          notes: [
            'The current director comes from profile/news data.',
            'Director cards show profile link, source, tenure, aliases, and matching timeline evidence.',
            'Directors are not included in wage-role calculations or staff count.'
          ]
        },
        {
          tab: 'directors',
          directorTab: 'past',
          selector: '[data-tour="directors-container"]',
          title: 'Past directors',
          text: 'Past directors are built from director-change and company-founder news events.',
          notes: [
            'This helps preserve original starter/director history after ownership changes.',
            'Tenure dates use detected start and end events.',
            'Sync older news improves this history when old events have not been fetched yet.'
          ]
        },
        {
          tab: 'stock',
          selector: '[data-tour="stock-management"]',
          title: 'Stock management',
          text: 'Stock management separates restockable products from non-stock services.',
          notes: [
            'Warehouse capacity comes from Business Profile and is not edited per stock row.',
            'Need Restock and warning controls only appear when product cost is greater than 0.',
            'Suggest restock balances restock quantities by sales demand and Apply in Torn fills Torn stock quantities for review.'
          ]
        },
        {
          tab: 'balance',
          selector: '[data-tour="daily-balance-graphs"]',
          title: 'Balance graphs',
          text: 'Balance graphs visualize income, customers, wages, ad budget, profit, and services sold.',
          notes: [
            'Use the graph controls to move between slides or switch daily/weekly scale.',
            'Line graphs have labelled points and separate money/customer axes.',
            'Graph colors are editable in the Theme tab.'
          ]
        },
        {
          tab: 'balance',
          selector: '[data-tour="daily-balance-table"]',
          title: 'Balance table',
          text: 'The balance table calculates daily operating performance from synced reports and dated company history.',
          notes: [
            'Income and customers come from daily reports.',
            'Wages can be included or treated as zero with the Use wages switch.',
            'Wages use current synced values and saved wage history only; ad budget and rating use dated history where available.'
          ]
        },
        {
          tab: 'wage',
          selector: '[data-tour="wage-system"]',
          title: 'Wage system',
          text: 'The Wage tab defines local wage suggestions.',
          notes: [
            'Weights turn MAN, INT, END, merits, addiction, and inactivity into a suggested wage.',
            'Role wage calculator stores minimum role requirements and preview totals.',
            'Suggested wages appear on current staff rows and staff cards.'
          ]
        },
        {
          tab: 'theme',
          selector: '[data-tour="theme-editor"]',
          title: 'Theme editor',
          text: 'Theme editor controls the visual language of the whole script.',
          notes: [
            'Start from a preset, edit shell colors, graph colors, and contract colors.',
            'Saving a custom theme adds it to the preset dropdown so it is not lost.',
            'The transparency setting and scrollbars follow the current theme.'
          ]
        },
        {
          tab: 'data',
          selector: '[data-tour="company-workspaces"]',
          title: 'Company workspaces',
          text: 'Company workspaces let one director manage multiple companies without overwriting local history.',
          notes: [
            'Upload current company before switching away.',
            'Each workspace keeps its own ledger, staff history, analytics, and settings.',
            'Switching restores that company snapshot into the active script state.'
          ]
        },
        {
          tab: 'data',
          selector: '[data-tour="script-user-profile"]',
          title: 'Script user profile',
          text: 'Script user profile summarizes your own local employment/director history across saved company workspaces.',
          notes: [
            'It uses the configured User ID and username to match you across staff and director records.',
            'Rows show company, type, status, role, dates, and days.',
            'It becomes more useful as you save workspaces for multiple companies.'
          ]
        },
        {
          tab: 'data',
          selector: '[data-tour="data-reports"]',
          title: 'Data and reports',
          text: 'Data and reports is the backup, newsletter, and support area.',
          notes: [
            'Report checkboxes choose what goes into exported HTML or copied newsletter HTML.',
            'Full export/import includes ledger, staff history, analytics, and settings.',
            'Bug report data is sanitized support context you can copy when reporting issues.'
          ]
        },
        {
          tab: 'data',
          selector: '[data-tour="danger-zone"]',
          title: 'Danger zone',
          text: 'Danger zone clears local data from this browser.',
          notes: [
            'Export a full backup before using it.',
            'Clear all removes the active workspace and saved company workspaces.',
            'This is irreversible without an import file.'
          ]
        },
        {
          tab: 'about',
          selector: '[data-tour="about-panel"]',
          title: 'About',
          text: 'About holds project identity, credits, thank-you notes, supporter notes, and in-game contribution tracking as the project grows.',
          notes: [
            'The visible version comes from the userscript metadata and APP.version.',
            'Use this page when confirming which build someone is running.',
            'Credits and supporter sections can be extended without touching core data.'
          ]
        },
        {
          tab: 'about',
          selector: '[data-tour="changelog-panel"]',
          title: 'Changelog',
          text: 'The changelog is a collapsed tree of past versions and major/minor changes.',
          notes: [
            'Entries are collapsed by default so the About page stays readable.',
            'Version numbers follow the capped subversion rule.',
            'Use it as a quick audit trail when debugging user reports.'
          ]
        }
      ];
    },

    currentTourStep() {
      const steps = UI.tourSteps();
      const index = Utils.clamp(Utils.int(UI.state.ui.tourStep, 0), 0, Math.max(0, steps.length - 1));
      UI.state.ui.tourStep = index;
      return { steps, index, step: steps[index] };
    },

    tourOverlay() {
      if (!UI.state.ui.tourActive) return '';
      const tour = UI.currentTourStep();
      if (!tour.step) return '';
      const notes = Array.isArray(tour.step.notes) && tour.step.notes.length
        ? `<ul>${tour.step.notes.map((note) => `<li>${Utils.esc(note)}</li>`).join('')}</ul>`
        : '';
      return `<div class="pp-tour-card">
        <span class="pp-tour-step">Step ${tour.index + 1} / ${tour.steps.length}</span>
        <strong>${Utils.esc(tour.step.title)}</strong>
        <p>${Utils.esc(tour.step.text)}</p>
        ${notes}
        <div class="pp-row-actions">
          <button class="pp-btn" type="button" data-action="tour-prev" ${tour.index <= 0 ? 'disabled' : ''}>&laquo;</button>
          <button class="pp-btn is-primary" type="button" data-action="tour-next">${tour.index >= tour.steps.length - 1 ? 'Finish' : 'Next'}</button>
          <button class="pp-btn is-quiet" type="button" data-action="tour-end">End tutorial</button>
        </div>
      </div>`;
    },

    applyTour(root) {
      if (!root || !UI.state.ui.tourActive) return;
      const tour = UI.currentTourStep();
      const target = tour.step && root.querySelector(tour.step.selector);
      if (!target) return;
      target.classList.add('pp-tour-target');
      setTimeout(() => {
        try {
          target.scrollIntoView({ block: 'center', inline: 'nearest' });
          UI.positionTourCard(root, target);
          const focusable = target.matches('input,select,textarea,button') ? target : target.querySelector('input,select,textarea,button');
          if (focusable && typeof focusable.focus === 'function') focusable.focus({ preventScroll: true });
          setTimeout(() => UI.positionTourCard(root, target), 80);
        } catch (error) {}
      }, 80);
    },

    positionTourCard(root, target) {
      const card = root && root.querySelector('.pp-tour-card');
      const doc = root && root.ownerDocument || document;
      const view = doc.defaultView || window;
      if (!card || !target || !view) return;
      const rect = target.getBoundingClientRect();
      const vw = Math.max(320, view.innerWidth || 0);
      const vh = Math.max(320, view.innerHeight || 0);
      const margin = 12;
      const cardWidth = Math.min(460, Math.max(260, vw - margin * 2));
      const cardHeight = Math.min(card.offsetHeight || 170, vh - margin * 2);
      let left = rect.right + margin;
      if (left + cardWidth > vw - margin) left = rect.left - cardWidth - margin;
      if (left < margin) left = Math.min(Math.max(rect.left, margin), Math.max(margin, vw - cardWidth - margin));
      let top = rect.top;
      if (top + cardHeight > vh - margin) top = Math.max(margin, vh - cardHeight - margin);
      if (top < margin) top = margin;
      root.style.setProperty('--tour-left', `${Math.round(left)}px`);
      root.style.setProperty('--tour-top', `${Math.round(top)}px`);
    },

    startTour() {
      UI.state.ui.tourActive = true;
      UI.state.ui.tourStep = 0;
      UI.applyTourStepState(UI.currentTourStep().step);
      UI.saveRender('Tutorial started.');
    },

    shiftTour(offset) {
      const steps = UI.tourSteps();
      const next = Utils.int(UI.state.ui.tourStep, 0) + offset;
      if (next >= steps.length) {
        UI.state.ui.tourActive = false;
        UI.saveRender('Tutorial complete.');
        return;
      }
      UI.state.ui.tourStep = Utils.clamp(next, 0, Math.max(0, steps.length - 1));
      UI.applyTourStepState(steps[UI.state.ui.tourStep]);
      UI.saveRender();
    },

    applyTourStepState(step) {
      if (!step) return;
      if (step.tab) UI.state.ui.tab = step.tab;
      if (step.staffTab) UI.state.ui.staffTab = step.staffTab;
      if (step.directorTab) UI.state.ui.directorTab = step.directorTab;
      if (step.settingsSection) UI.state.ui.settingsSection = step.settingsSection;
    },

    endTour() {
      UI.state.ui.tourActive = false;
      UI.saveRender('Tutorial closed.');
    },

    focusApiKey() {
      UI.state.ui.tab = 'settings';
      UI.saveRender('Add your Torn API key to begin syncing.');
      setTimeout(() => {
        const root = UI.currentRoot();
        const target = root && root.querySelector('[name="apiKey"],[name="apiKeyMasked"]');
        if (!target) return;
        target.classList.add('pp-tour-target');
        try {
          target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
          if (!target.readOnly && typeof target.focus === 'function') target.focus({ preventScroll: true });
        } catch (error) {}
      }, 100);
    },

    popupBadge() {
      return `
        <div class="pp-shell">
          <div class="pp-titlebar" data-action="popup-mode">
            <div class="pp-brand">
              ${UI.logoMark('badge')}
              <strong>${APP.name}</strong>
              <span>Popup mode</span>
              ${UI.stockMiniAlert()}
            </div>
            <div class="pp-actions">
              <button class="pp-btn is-primary" type="button" data-action="popup-mode">Open popup</button>
              <button class="pp-btn is-quiet" type="button" data-action="embed-mode">Embed</button>
            </div>
          </div>
        </div>`;
    },

    logoMark(idSuffix) {
      const id = String(idSuffix || 'main').replace(/[^a-z0-9-]/gi, '') || 'main';
      const triGold = `pp-tri-gold-${id}`;
      const hudGreen = `pp-hud-green-${id}`;
      const softGlow = `pp-soft-glow-${id}`;
      const glow = `pp-glow-${id}`;
      const goldGlow = `pp-gold-glow-${id}`;
      return `<svg class="pp-logo-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 850" width="850" height="850" role="img" aria-label="Pythagoras Project logo" focusable="false">
        <defs>
          <linearGradient id="${triGold}" x1="170" y1="560" x2="690" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#b7ff00"/><stop offset="0.28" stop-color="#ffd84a"/><stop offset="0.55" stop-color="#ffffff"/><stop offset="0.78" stop-color="#ffb300"/><stop offset="1" stop-color="#8dff00"/>
          </linearGradient>
          <linearGradient id="${hudGreen}" x1="110" y1="120" x2="760" y2="760" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#d7ff00"/><stop offset="0.55" stop-color="#62ff00"/><stop offset="1" stop-color="#ffd000"/>
          </linearGradient>
          <radialGradient id="${softGlow}" cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color="#dfff00" stop-opacity="0.42"/><stop offset="0.45" stop-color="#70ff00" stop-opacity="0.14"/><stop offset="1" stop-color="#00160a" stop-opacity="0"/>
          </radialGradient>
          <filter id="${glow}" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.55 0 0 0 0 1 0 0 0 0 0 0 0 0 0.9 0" result="greenGlow"/>
            <feMerge><feMergeNode in="greenGlow"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="${goldGlow}" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="blur"/>
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 1 0 0 0 0 0.75 0 0 0 0 0 0 0 0 0.85 0" result="goldGlow"/>
            <feMerge><feMergeNode in="goldGlow"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle cx="425" cy="425" r="355" fill="url(#${softGlow})"/>
        <g fill="none" stroke="url(#${hudGreen})" stroke-linecap="round" filter="url(#${glow})" opacity="0.9">
          <circle cx="425" cy="425" r="300" stroke-width="2.2" stroke-dasharray="4 9"/>
          <circle cx="425" cy="425" r="265" stroke-width="1.5" stroke-dasharray="22 18 3 13"/>
          <circle cx="425" cy="425" r="220" stroke-width="1.2" stroke-dasharray="2 10"/>
          <circle cx="425" cy="425" r="176" stroke-width="1.2" stroke-dasharray="1 12"/>
          <path d="M132 425H270" stroke-width="3"/><path d="M580 425H718" stroke-width="3"/><path d="M425 80V205" stroke-width="2.2"/><path d="M425 650V770" stroke-width="2.2"/>
          <path d="M150 355h65l15-15h72" stroke-width="2"/><path d="M548 340h70l20 18h70" stroke-width="2"/><path d="M185 560h75" stroke-width="2"/><path d="M590 560h75" stroke-width="2"/>
          <path d="M250 165 A335 335 0 0 1 650 145" stroke-width="3" stroke-dasharray="120 35 12 28"/>
          <path d="M172 250 A335 335 0 0 0 155 575" stroke-width="2" stroke-dasharray="80 38 8 20"/>
          <path d="M690 230 A315 315 0 0 1 710 580" stroke-width="2" stroke-dasharray="70 35 8 24"/>
          <path d="M245 700 A330 330 0 0 0 610 700" stroke-width="2" stroke-dasharray="110 28 8 30"/>
        </g>
        <g stroke="#aaff00" fill="#aaff00" opacity="0.82" filter="url(#${glow})">
          <circle cx="205" cy="220" r="4"/><circle cx="645" cy="220" r="4"/><circle cx="205" cy="635" r="4"/><circle cx="645" cy="635" r="4"/>
          <circle cx="760" cy="425" r="6" fill="none" stroke-width="2"/><circle cx="90" cy="425" r="6" fill="none" stroke-width="2"/>
          <path d="M90 425H170" fill="none" stroke-width="2"/><path d="M680 425H760" fill="none" stroke-width="2"/>
        </g>
        <g filter="url(#${goldGlow})">
          <polygon points="425,145 205,565 645,565" fill="#04110a" fill-opacity="0.72" stroke="url(#${triGold})" stroke-width="15" stroke-linejoin="miter"/>
          <polygon points="425,205 258,535 592,535" fill="none" stroke="#79ff00" stroke-opacity="0.42" stroke-width="3"/>
          <path d="M305 515 L505 385 L585 535" fill="none" stroke="url(#${triGold})" stroke-width="13" stroke-linecap="butt" stroke-linejoin="miter"/>
          <path d="M305 515 H585" fill="none" stroke="#f9d200" stroke-opacity="0.75" stroke-width="3"/>
          <path d="M425 145V80" stroke="#f7ff00" stroke-width="2" stroke-linecap="round"/>
          <circle cx="425" cy="145" r="6" fill="#fff36a"/><circle cx="425" cy="565" r="5" fill="#fff36a"/><circle cx="645" cy="565" r="5" fill="#fff36a"/><circle cx="205" cy="565" r="5" fill="#fff36a"/>
        </g>
      </svg>`;
    },

    page() {
      if (UI.state.ui.tab === 'ledger') return UI.ledgerPage();
      if (UI.state.ui.tab === 'staff') return UI.peoplePage('staff');
      if (UI.state.ui.tab === 'directors') return UI.peoplePage('directors');
      if (UI.state.ui.tab === 'profile' || UI.state.ui.tab === 'detailed') return `<div class="pp-grid">${UI.companyProfilePanel()}</div>`;
      if (UI.state.ui.tab === 'balance') return UI.dailyBalancePage();
      if (UI.state.ui.tab === 'stock') return `<div class="pp-grid">${UI.stockPanel()}</div>`;
      if (UI.state.ui.tab === 'wage') return UI.wagePage();
      if (UI.state.ui.tab === 'data') return UI.dataReportsPage();
      if (UI.state.ui.tab === 'about') return `<div class="pp-grid">${UI.aboutPanel()}</div>`;
      if (UI.state.ui.tab === 'settings') return UI.settingsPage();
      if (UI.state.ui.tab === 'theme') return UI.themePage();
      return UI.timelinePage();
    },

    weeklyLimitNotice(storedCount, visibleCount, label) {
      return '';
    },

    timelinePage() {
      const state = UI.state;
      const weeks = UI.filteredAnalytics(Timeline.compareWeeks(UI.visibleAnalyticsWeeks()));
      const events = Timeline.accessEvents(state.staff.timeline || [], state);
      return `
        <div class="pp-grid">
          <section class="pp-panel is-half pp-timeline-panel" data-tour="company-timeline">
            <div class="pp-head is-stack">
              <div><h2>Company timeline</h2><p>Sync company news with one manual API request.</p></div>
              <div class="pp-row-actions pp-timeline-actions">
                ${UI.timelineFilterSelect()}
                <button class="pp-btn" type="button" data-action="toggle-timeline-grouped" title="Toggle grouped or raw timeline rows">${UI.state.ui.timelineGrouped === false ? 'Raw' : 'Grouped'}</button>
              </div>
            </div>
            <div class="pp-content" data-timeline-content>${UI.newsSyncStatus()}${UI.timelineList(UI.filteredTimeline(events))}</div>
          </section>
          <section class="pp-panel is-half pp-analytics-panel" data-tour="weekly-analytics">
            <div class="pp-head is-stack"><div><h2>Weekly analytics</h2><p>Current week included; missing weekdays stay as placeholders until reports arrive.</p></div><div class="pp-row-actions">${UI.analyticsYearSelect(Timeline.compareWeeks(UI.visibleAnalyticsWeeks()))}</div></div>
            <div class="pp-content">${UI.analyticsTable(weeks)}</div>
          </section>
        </div>`;
    },

    visibleAnalyticsWeeks() {
      return Array.isArray(UI.state.analytics.weeks) ? UI.state.analytics.weeks : [];
    },

    visibleLedgerRows() {
      return Array.isArray(UI.state.ledger) ? UI.state.ledger : [];
    },

    filteredTimeline(events) {
      const filter = UI.state.ui.timelineFilter || 'all';
      return filter === 'all' ? events : events.filter((event) => (Store.isDailyReportLike(event) ? 'daily_report' : event.type) === filter);
    },

    refreshTimelineContent(root) {
      const container = (root || UI.currentRoot()).querySelector('[data-timeline-content]');
      if (!container) {
        UI.saveRender();
        return;
      }
      const scroll = UI.scrollSnapshot(root || UI.currentRoot());
      const events = Timeline.accessEvents(UI.state.staff.timeline || [], UI.state);
      container.innerHTML = `${UI.newsSyncStatus()}${UI.timelineList(UI.filteredTimeline(events))}`;
      UI.restoreScroll(root || UI.currentRoot(), scroll);
    },

    timelineFilterSelect() {
      const options = [
        ['all', 'All'],
        ['daily_report', 'Daily reports'],
        ['training', 'Training'],
        ['hire', 'Hires'],
        ['application', 'Applications'],
        ['left', 'Left'],
        ['fired', 'Fired'],
        ['director', 'Directors'],
        ['rating', 'Ratings'],
        ['funds', 'Funds'],
        ['other', 'Other']
      ];
      const current = UI.state.ui.timelineFilter || 'all';
      const width = Math.max.apply(null, options.map(([, label]) => label.length)) + 4;
      return `<select class="pp-select pp-select-fit" style="--select-width:${width}ch" data-ui-field="timelineFilter">${options.map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
    },

    analyticsYearSelect(weeks) {
      const years = Array.from(new Set((weeks || []).map((week) => week.year).filter(Boolean))).sort((a, b) => b - a);
      const current = UI.state.ui.analyticsYear || 'all';
      const labels = ['All'].concat(years.map((year) => String(year)));
      const width = Math.max.apply(null, labels.map((label) => label.length)) + 4;
      return `<select class="pp-select pp-select-fit" style="--select-width:${width}ch" data-ui-field="analyticsYear"><option value="all" ${current === 'all' ? 'selected' : ''}>All</option>${years.map((year) => `<option value="${year}" ${String(current) === String(year) ? 'selected' : ''}>${year}</option>`).join('')}</select>`;
    },

    filteredAnalytics(weeks) {
      const year = UI.state.ui.analyticsYear || 'all';
      return year === 'all' ? weeks : weeks.filter((week) => String(week.year) === String(year));
    },

    tableSortHeader(table, key, label) {
      const state = UI.state.ui.tableSorts && UI.state.ui.tableSorts[table] ? UI.state.ui.tableSorts[table] : {};
      const active = state.key === key;
      const marker = active ? (state.dir === 'desc' ? ' v' : ' ^') : '';
      return `<button class="pp-sort ${active ? 'is-active' : ''}" type="button" data-table-sort="${Utils.esc(table)}" data-sort-key="${Utils.esc(key)}">${label}${marker}</button>`;
    },

    sortedRows(table, rows, readers, fallbackKey, fallbackDir) {
      const sort = UI.state.ui.tableSorts && UI.state.ui.tableSorts[table] ? UI.state.ui.tableSorts[table] : {};
      const key = sort.key || fallbackKey;
      const direction = (sort.dir || fallbackDir || 'asc') === 'desc' ? -1 : 1;
      const read = readers[key] || readers[fallbackKey] || ((row) => String(row || '').toLowerCase());
      return (rows || []).slice().sort((a, b) => {
        const first = read(a);
        const second = read(b);
        if (typeof first === 'number' && typeof second === 'number') return (first - second) * direction;
        return String(first == null ? '' : first).localeCompare(String(second == null ? '' : second)) * direction;
      });
    },

    timelineList(events) {
      if (!events.length) return '<div class="pp-empty">No company news synced yet. Use the button above when you want to pull news from Torn.</div>';
      const colors = { hire: '#46c58f', application: '#d8a545', left: '#d95d5d', fired: '#d95d5d', director: '#f4d35e', rating: '#8ab4f8', daily_report: '#c0a2ff', weekly_report: '#c0a2ff', training: '#46c58f', role_change: '#00c6ff', withdraw: '#d8a545', deposit: '#8ab4f8', wage: '#f4d35e', funds: '#d8a545', other: '#9aa0a6' };
      const grouped = UI.state.ui.timelineGrouped !== false;
      const rows = grouped ? Timeline.collapseTimelineRows(events) : events.slice();
      const eventCount = events.length;
      const rowCount = rows.length;
      const note = grouped
        ? (rowCount === eventCount
          ? `Showing ${Utils.formatNumber(eventCount)} matching timeline event${eventCount === 1 ? '' : 's'} in grouped view.`
          : `Showing ${Utils.formatNumber(rowCount)} grouped timeline row${rowCount === 1 ? '' : 's'} from ${Utils.formatNumber(eventCount)} matching event${eventCount === 1 ? '' : 's'}. Switch to Raw to see every event row.`)
        : `Showing all ${Utils.formatNumber(eventCount)} matching timeline event${eventCount === 1 ? '' : 's'} in raw view.`;
      return `<div class="pp-note" style="margin-bottom:8px">${note}</div><div class="pp-timeline">${rows.map((event) => {
        const displayType = event.displayType || Timeline.displayType(event);
        const displayEvent = displayType === event.type ? event : Object.assign({}, event, { type: displayType, category: displayType, playerName: '' });
        return `
        <article class="pp-event" style="--event-color:${colors[displayType] || colors.other}">
          <time>${Utils.esc(Utils.dateTime(event.timestamp))}</time>
          <strong>${Utils.esc(UI.eventLabel(displayEvent))}${displayEvent.playerName && displayEvent.type !== 'training' ? ` - ${Utils.esc(displayEvent.playerName)}` : ''}</strong>
          <span>${Utils.safeNewsHtml(Store.eventText(event) || event.text || event.plainText)}</span>
        </article>`;
      }).join('')}</div>`;
    },

    newsSyncStatus() {
      const sync = UI.state.company.newsSync;
      const startEstimate = sync.earliestTimestamp || sync.oldestTimestamp || 0;
      return `<div class="pp-empty" style="margin-bottom:10px">
        Last news sync: ${Utils.esc(Utils.dateTime(sync.lastSynced))}. Oldest stored event: ${Utils.esc(sync.oldestTimestamp ? Utils.dateShort(sync.oldestTimestamp) : 'Not set')}. Company start estimate: ${Utils.esc(startEstimate ? Utils.dateShort(startEstimate) : 'Sync profile first')}.
      </div>`;
    },

    eventLabel(event) {
      const labels = {
        hire: 'Hire',
        application: 'Application',
        left: 'Left',
        fired: 'Fired',
        director: 'Director',
        rating: 'Rating',
        daily_report: 'Daily report',
        weekly_report: 'Weekly report',
        training: 'Training',
        role_change: 'Role change',
        withdraw: 'Withdraw',
        deposit: 'Deposit',
        wage: 'Wage',
        funds: 'Funds',
        other: 'Other'
      };
      return labels[event.type] || String(event.type || 'Other').replace(/_/g, ' ');
    },

    analyticsTable(weeks) {
      if (!weeks.length) return '<div class="pp-empty">No daily report data parsed yet. Sync company news after Torn posts company report rows.</div>';
      const rows = UI.sortedRows('analytics', weeks, {
        week: (week) => Utils.int(week.week, 0),
        dateRange: (week) => Utils.int(week.timestamp, 0),
        customers: (week) => Utils.num(week.customers, 0),
        income: (week) => Utils.num(week.income, 0),
        profitPerCustomer: (week) => Utils.num(week.profitPerCustomer, 0),
        vsLastCustomers: (week) => Utils.num(week.vsLastCustomers, 0),
        vsLastIncome: (week) => Utils.num(week.vsLastIncome, 0),
        vsAverageCustomers: (week) => Utils.num(week.vsAverageCustomers, 0),
        vsAverageIncome: (week) => Utils.num(week.vsAverageIncome, 0)
      }, 'dateRange', 'desc');
      return `<div class="pp-wrap pp-analytics-scroll">
        <table class="pp-table">
          <thead>
            <tr>
              <th></th>
                <th>#</th>
                <th>${UI.tableSortHeader('analytics', 'week', 'Week')}</th>
                <th>${UI.tableSortHeader('analytics', 'dateRange', 'Date range')}</th>
                <th>${UI.tableSortHeader('analytics', 'customers', 'Customers')}</th>
                <th>${UI.tableSortHeader('analytics', 'income', 'Income')}</th>
                <th>${UI.tableSortHeader('analytics', 'profitPerCustomer', 'Profit/customer')}</th>
                <th>${UI.tableSortHeader('analytics', 'vsLastCustomers', '&Delta; LW Customers')}</th>
                <th>${UI.tableSortHeader('analytics', 'vsLastIncome', '&Delta; LW Profits')}</th>
                <th>${UI.tableSortHeader('analytics', 'vsAverageCustomers', '&Delta; AT Customers')}</th>
                <th>${UI.tableSortHeader('analytics', 'vsAverageIncome', '&Delta; AT Profits')}</th>
             </tr>
           </thead>
        <tbody>${rows.map((week, index) => UI.analyticsWeekRows(week, index)).join('')}</tbody>
      </table></div>`;
    },

    analyticsWeekRows(week, index) {
      const key = UI.analyticsWeekKey(week);
      const expanded = !!(UI.state.ui.analyticsExpanded && UI.state.ui.analyticsExpanded[key]);
      const icon = expanded ? '-' : '+';
      const title = expanded ? 'Collapse weekdays' : 'Expand weekdays';
      return `
        <tr>
          <td><button class="pp-btn pp-expand-btn" type="button" data-action="toggle-analytics-week" data-week-key="${Utils.esc(key)}" title="${title}">${icon}</button></td>
          <td>${index + 1}</td><td>Week ${week.week}</td>
          <td>${Utils.esc(week.timestamp ? Utils.weekRange(new Date(week.timestamp * 1000)) : week.dateRange)}</td>
          <td>${Number(week.customers || 0).toLocaleString()}</td><td>${Utils.money(week.income)}</td>
          <td>${Utils.money(week.profitPerCustomer)}</td>
          <td>${UI.delta(week.vsLastCustomers, true)}</td>
          <td>${UI.deltaMoney(week.vsLastIncome)}</td>
          <td>${UI.delta(week.vsAverageCustomers, true)}</td>
          <td>${UI.deltaMoney(week.vsAverageIncome)}</td>
        </tr>
        ${expanded ? `<tr class="pp-detail-row"><td colspan="11">${UI.analyticsWeekDetail(week)}</td></tr>` : ''}`;
    },

    analyticsWeekKey(week) {
      return `${week.year || 'year'}-${week.week || 'week'}`;
    },

    analyticsDaysFromRaw(week) {
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      return String(week.raw || '').split('\n').map((line) => {
        const match = line.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+report\b/i);
        if (!match) return null;
        const dayIndex = dayNames.findIndex((name) => name.toLowerCase() === match[1].toLowerCase()) + 1;
        const values = Timeline.reportValues({ plainText: line, text: line });
        return {
          weekday: dayNames[dayIndex - 1],
          dayIndex,
          customers: values.customers,
          income: values.income,
          profitPerCustomer: values.customers > 0 ? Math.round(values.income / values.customers) : 0,
          raw: line
        };
      }).filter(Boolean);
    },

    analyticsWeekBaseDayRows(week) {
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const sourceDays = Array.isArray(week.days) && week.days.length ? week.days : UI.analyticsDaysFromRaw(week);
      const byIndex = new Map(sourceDays.map((day) => [Utils.int(day.dayIndex, 0), day]));
      let start = '';
      if (week.timestamp) {
        const anchor = new Date(week.timestamp * 1000);
        const day = anchor.getDay() || 7;
        anchor.setDate(anchor.getDate() - day + 1);
        start = anchor.toISOString().slice(0, 10);
      }
      return dayNames.map((weekday, index) => {
        const dayIndex = index + 1;
        const row = byIndex.get(dayIndex) || {};
        const date = row.date || (start ? Utils.addDays(start, index) : '');
        const customers = Utils.num(row.customers, 0);
        const income = Utils.num(row.income, 0);
        return {
          weekday,
          dayIndex,
          date,
          customers,
          income,
          profitPerCustomer: customers > 0 ? Math.round(income / customers) : 0,
          raw: row.raw || ''
        };
      });
    },

    analyticsDayLookup() {
      const map = new Map();
      UI.visibleAnalyticsWeeks().forEach((week) => {
        UI.analyticsWeekBaseDayRows(week).forEach((day) => {
          if (day.date && (day.customers || day.income)) map.set(day.date, day);
        });
      });
      return map;
    },

    analyticsWeekDayRows(week) {
      const lookup = UI.analyticsDayLookup();
      return UI.analyticsWeekBaseDayRows(week).map((row) => {
        const previous = row.date ? lookup.get(Utils.addDays(row.date, -1)) || {} : {};
        return Object.assign({}, row, {
          deltaCustomers: (row.customers || row.income) && (previous.customers || previous.income) ? row.customers - Utils.num(previous.customers, 0) : 0,
          deltaIncome: (row.customers || row.income) && (previous.customers || previous.income) ? row.income - Utils.num(previous.income, 0) : 0
        });
      });
    },

    analyticsWeekDetail(week) {
      const tableId = `analytics-days-${UI.analyticsWeekKey(week)}`;
      const rows = UI.sortedRows(tableId, UI.analyticsWeekDayRows(week), {
        date: (row) => Utils.dateTimestamp(row.date),
        weekday: (row) => Utils.int(row.dayIndex, 0),
        customers: (row) => Utils.num(row.customers, 0),
        income: (row) => Utils.num(row.income, 0),
        deltaCustomers: (row) => Utils.num(row.deltaCustomers, 0),
        deltaIncome: (row) => Utils.num(row.deltaIncome, 0),
        profitPerCustomer: (row) => Utils.num(row.profitPerCustomer, 0)
      }, 'date', 'desc');
      const hasDetails = rows.some((row) => row.customers || row.income);
      return `<div class="pp-analytics-detail">
        ${hasDetails ? '' : '<div class="pp-note">This week was imported before daily detail storage existed. Sync company news again to populate weekday detail.</div>'}
        <div class="pp-wrap">
          <table class="pp-analytics-detail-table">
            <thead>
              <tr>
                <th>${UI.tableSortHeader(tableId, 'date', 'Date')}</th>
                <th>${UI.tableSortHeader(tableId, 'weekday', 'Weekday')}</th>
                <th>${UI.tableSortHeader(tableId, 'customers', 'Customers')}</th>
                <th>${UI.tableSortHeader(tableId, 'income', 'Income')}</th>
                <th>${UI.tableSortHeader(tableId, 'deltaCustomers', '&Delta; Customers')}</th>
                <th>${UI.tableSortHeader(tableId, 'deltaIncome', '&Delta; Income')}</th>
                <th>${UI.tableSortHeader(tableId, 'profitPerCustomer', 'Profit/customer')}</th>
              </tr>
            </thead>
          <tbody>${rows.map((row) => {
            const hasData = row.customers || row.income;
            return `<tr title="${Utils.esc(row.raw || (hasData ? '' : 'No report stored for this day yet.'))}">
            <td>${Utils.esc(row.date ? Utils.dateMonthDay(row.date) : 'Not set')}</td>
            <td>${Utils.esc(row.weekday)}</td>
            <td>${hasData ? Number(row.customers || 0).toLocaleString() : '-'}</td>
            <td>${hasData ? Utils.money(row.income) : '-'}</td>
            <td>${hasData ? UI.delta(row.deltaCustomers, true) : '-'}</td>
            <td>${hasData ? UI.deltaMoney(row.deltaIncome) : '-'}</td>
            <td>${row.customers ? Utils.money(row.profitPerCustomer) : '-'}</td>
          </tr>`;
          }).join('')}
          </tbody>
        </table></div>
      </div>`;
    },

    weekStartInput(dateText) {
      const date = Utils.dateObject(dateText);
      if (!date) return '';
      const day = date.getDay() || 7;
      date.setDate(date.getDate() - day + 1);
      return date.toISOString().slice(0, 10);
    },

    stockSnapshotForDate(dateText) {
      const histories = (UI.state.company.stockHistory || [])
        .filter((snapshot) => Utils.dayKey(snapshot.at) === dateText)
        .sort((a, b) => Utils.dateTimestamp(b.at) - Utils.dateTimestamp(a.at));
      const latest = histories[0];
      if (!latest) return null;
      const costByKey = new Map((UI.state.company.stock.items || []).map((item) => [String(item.key), Utils.num(item.cost, 0)]));
      return (latest.items || []).reduce((summary, item) => {
        const cost = costByKey.get(String(item.key)) || 0;
        summary.stockWorth += Utils.num(item.soldWorth, 0);
        summary.restockCost += Utils.num(item.onOrder, 0) * cost;
        return summary;
      }, { stockWorth: 0, restockCost: 0 });
    },

    dailyWageTotal() {
      if (UI.state.ui.dailyBalanceIncludeWages === false) return 0;
      const staff = Company.staffEmployees(UI.state.staff.current || [], UI.state.company.profile.directorId || UI.state.settings.userId || '');
      return staff.reduce((sum, person) => {
        const wage = Utils.num(person.wage, 0);
        return sum + (person.wageFromApi || wage > 0 ? wage : 0);
      }, 0);
    },
    reportDailyRows() {
      if (UI.renderMemo && UI.renderMemo.reportDailyRows) return UI.renderMemo.reportDailyRows;
      const byDate = new Map();
      UI.visibleAnalyticsWeeks().forEach((week) => {
        UI.analyticsWeekBaseDayRows(week).forEach((day) => {
          if (!day.date || day.date > Utils.todayInput()) return;
          const existing = byDate.get(day.date) || {
            date: day.date,
            weekday: day.weekday,
            timestamp: Utils.dateTimestamp(day.date),
            income: 0,
            customers: 0,
            hasReport: false
          };
          existing.income += Utils.num(day.income, 0);
          existing.customers += Utils.num(day.customers, 0);
          existing.hasReport = existing.hasReport || !!(day.customers || day.income);
          byDate.set(day.date, existing);
        });
      });
      const rows = Array.from(byDate.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      if (UI.renderMemo) UI.renderMemo.reportDailyRows = rows;
      return rows;
    },
    balanceStaffPool() {
      const profile = UI.state.company.profile || {};
      const directorId = profile.directorId || UI.state.settings.userId || '';
      return Company.staffEmployees(Company.dedupePeople([]
        .concat(UI.state.staff.current || [])
        .concat(UI.state.staff.past || [])
        .concat(profile.employees || [])), directorId).map((person) => {
          const wageHistory = Array.isArray(person && person.wageHistory)
            ? person.wageHistory.slice().sort((a, b) => Utils.dateTimestamp(a.at) - Utils.dateTimestamp(b.at))
            : [];
          const wage = Utils.num(person && person.wage, 0);
          const wageKnown = !!(person && person.wageFromApi) || wage > 0 || !!wageHistory.length;
          return Object.assign({}, person, {
            _balanceStartTs: Utils.dateTimestamp(UI.personHireValue(person) || Company.employmentStart(person)),
            _balanceLeftTs: Utils.dateTimestamp(UI.personLeftValue(person) || person && (person.leftDate || person.leftTimestamp)),
            _balanceWage: wageKnown ? wage : 0,
            _balanceWageKnown: wageKnown,
            _balanceWageHistory: wageHistory
          });
        });
    },
    balancePersonActiveOn(person, date) {
      const dayStart = Utils.dateTimestamp(`${date}T00:00:00`);
      const dayEnd = Utils.dateTimestamp(`${date}T23:59:59`);
      const started = Utils.int(person && person._balanceStartTs, 0);
      const left = Utils.int(person && person._balanceLeftTs, 0);
      if (started && started > dayEnd) return false;
      if (left && left < dayStart) return false;
      if (!started && left && left < dayEnd) return false;
      return true;
    },
    balancePersonWageOn(person, date) {
      const at = Utils.dateTimestamp(`${date}T23:59:59`);
      const history = Array.isArray(person && person._balanceWageHistory) ? person._balanceWageHistory : [];
      if (!person || (!person._balanceWageKnown && !history.length)) return 0;
      let wage = Utils.num(person && person._balanceWage, 0);
      if (history.length) wage = Utils.num(history[0].previousWage, wage);
      history.forEach((row) => {
        if (Utils.dateTimestamp(row.at) <= at) wage = Utils.num(row.newWage, wage);
      });
      return wage;
    },
    dailyWageTotalOn(date, context) {
      if (UI.state.ui.dailyBalanceIncludeWages === false) return 0;
      const staff = context && context.staff ? context.staff : UI.balanceStaffPool();
      return staff
        .filter((person) => UI.balancePersonActiveOn(person, date))
        .reduce((sum, person) => sum + UI.balancePersonWageOn(person, date), 0);
    },
    balanceRatingOn(date, context) {
      const at = Utils.dateTimestamp(`${date}T23:59:59`);
      const events = context && context.ratingEvents ? context.ratingEvents : (UI.state.staff.timeline || [])
        .filter((event) => event && event.type === 'rating' && Utils.int(event.value, 0))
        .sort((a, b) => Utils.int(b.timestamp, 0) - Utils.int(a.timestamp, 0));
      const event = events.find((row) => Utils.int(row.timestamp, 0) <= at);
      if (event) return Utils.clamp(Utils.int(event.value, 0), 0, 10);
      const profile = UI.state.company.profile || {};
      const syncedAt = Utils.dateTimestamp(profile.lastSynced);
      const currentRating = Utils.int(profile.rating || UI.state.settings.companyStars, 0);
      return syncedAt && syncedAt <= at ? Utils.clamp(currentRating, 0, 10) : 0;
    },
    recordAdBudgetHistory(source, observedAt) {
      const detailed = UI.state.company.detailed || {};
      const budget = Utils.num(detailed.advertisingBudget, null);
      if (budget === null || budget < 0) return 0;
      const known = detailed.advertisingBudgetKnown === true || budget > 0;
      if (budget === 0 && !known) return 0;
      const at = String(observedAt || detailed.lastSynced || Utils.nowIso()).trim() || Utils.nowIso();
      const date = Utils.dateInput(at) || Utils.todayInput();
      UI.state.company.adBudgetHistory = Store.mergeAdBudgetHistory(UI.state.company.adBudgetHistory || [], [{
        date,
        observedAt: at,
        advertisingBudget: budget,
        advertisingBudgetKnown: true,
        source: source || 'business-sync'
      }]);
      return 1;
    },
    adBudgetHistoryForApi() {
      return Store.normaliseAdBudgetHistory(UI.state.company.adBudgetHistory || []);
    },
    balanceAdBudgetOn(date) {
      const target = Utils.dateInput(date);
      if (!target) return null;
      const rows = Store.normaliseAdBudgetHistory(UI.state.company.adBudgetHistory || [])
        .filter((row) => row.date <= target)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || Utils.dateTimestamp(b.observedAt) - Utils.dateTimestamp(a.observedAt));
      return rows.length ? Utils.num(rows[0].advertisingBudget, 0) : null;
    },

    dailyBalanceRows() {
      if (UI.renderMemo && UI.renderMemo.dailyBalanceRows) return UI.renderMemo.dailyBalanceRows;
      const context = {
        staff: UI.balanceStaffPool(),
        ratingEvents: (UI.state.staff.timeline || [])
          .filter((event) => event && event.type === 'rating' && Utils.int(event.value, 0))
          .sort((a, b) => Utils.int(b.timestamp, 0) - Utils.int(a.timestamp, 0))
      };
      const rows = UI.reportDailyRows().map((row) => {
        const wages = UI.dailyWageTotalOn(row.date, context);
        const adBudget = UI.balanceAdBudgetOn(row.date);
        const rating = UI.balanceRatingOn(row.date, context);
        return Object.assign({}, row, {
          wages,
          adBudget: adBudget === null ? 0 : adBudget,
          adBudgetKnown: adBudget !== null,
          rating,
          ratingKnown: !!rating,
          profit: row.hasReport ? row.income - wages - (adBudget || 0) : 0
        });
      }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      if (UI.renderMemo) UI.renderMemo.dailyBalanceRows = rows;
      return rows;
    },

    dailyBalanceWindow() {
      const rows = UI.dailyBalanceRows();
      const latest = rows.length ? rows[0].date : Utils.todayInput();
      const latestStart = UI.weekStartInput(latest) || Utils.todayInput();
      const start = UI.state.ui.dailyBalanceStart || latestStart;
      const normalizedStart = UI.weekStartInput(start) || latestStart;
      const end = Utils.addDays(normalizedStart, 6);
      const mode = UI.state.ui.dailyBalanceMode || 'week';
      const visible = mode === 'all' ? rows : rows.filter((row) => row.date >= normalizedStart && row.date <= end);
      return { rows, visible, start: normalizedStart, end, latestStart, mode };
    },

    dailyBalanceControls(windowRows) {
      const nextStart = Utils.addDays(windowRows.start, 7);
      const nextDisabled = windowRows.mode === 'all' || nextStart > windowRows.latestStart;
      const label = windowRows.mode === 'all'
        ? 'All synced days'
        : `${Utils.dateNoYear(windowRows.start)} - ${Utils.dateNoYear(windowRows.end)}`;
      const includeWages = UI.state.ui.dailyBalanceIncludeWages !== false;
      return `<div class="pp-balance-controls">
        <button class="pp-btn" type="button" data-action="balance-prev" ${windowRows.mode === 'all' ? 'disabled' : ''} title="Previous week">&laquo;</button>
        <span class="pp-pill pp-date-pill">${Utils.esc(label)}</span>
        <button class="pp-btn" type="button" data-action="balance-next" ${nextDisabled ? 'disabled' : ''} title="Next week">&raquo;</button>
        <select class="pp-select pp-select-fit" style="--select-width:10ch" data-ui-field="dailyBalanceMode">
          <option value="week" ${windowRows.mode !== 'all' ? 'selected' : ''}>Week</option>
          <option value="all" ${windowRows.mode === 'all' ? 'selected' : ''}>All time</option>
        </select>
        <label class="pp-note pp-checkline" title="When off, Balance treats wages as $0 without deleting synced employee wages."><input type="checkbox" data-ui-check="dailyBalanceIncludeWages" ${includeWages ? 'checked' : ''}> Use wages</label>
        <button class="pp-btn" type="button" data-action="rebuild-balance" title="Rebuild Balance from stored company news reports">Rebuild balance</button>
      </div>`;
    },

    dailyBalanceTable() {
      const windowRows = UI.dailyBalanceWindow();
      if (!windowRows.rows.length) return `${UI.dailyBalanceControls(windowRows)}<div class="pp-empty" style="margin-top:10px">No daily reports parsed yet. Use Settings -> Sync center to pull company news, or Rebuild balance if reports are already stored locally.</div>`;
      const rows = UI.sortedRows('dailyBalance', windowRows.visible, {
        date: (row) => Utils.dateTimestamp(row.date),
        income: (row) => Utils.num(row.income, 0),
        customers: (row) => Utils.num(row.customers, 0),
        wages: (row) => Utils.num(row.wages, 0),
        adBudget: (row) => Utils.num(row.adBudget, 0),
        profit: (row) => Utils.num(row.profit, 0),
        rating: (row) => Utils.int(row.rating, 0)
      }, 'date', 'desc');
      return `${UI.dailyBalanceControls(windowRows)}
        <div class="pp-wrap" style="margin-top:10px"><table class="pp-table pp-balance-table">
          <thead><tr>
            <th>#</th>
            <th>${UI.tableSortHeader('dailyBalance', 'date', 'Date')}</th>
            <th>${UI.tableSortHeader('dailyBalance', 'income', 'Income')}</th>
            <th>${UI.tableSortHeader('dailyBalance', 'customers', 'Customers')}</th>
            <th>${UI.tableSortHeader('dailyBalance', 'wages', 'Wages')}</th>
            <th>${UI.tableSortHeader('dailyBalance', 'adBudget', 'Ad Budget')}</th>
            <th>${UI.tableSortHeader('dailyBalance', 'profit', 'Profit')}</th>
            <th>${UI.tableSortHeader('dailyBalance', 'rating', 'Company Rating')}</th>
          </tr></thead>
          <tbody>${rows.map((row, index) => {
            const hasReport = row.hasReport;
            return `<tr>
              <td>${index + 1}</td>
              <td>${Utils.esc(Utils.dateShort(row.date))}</td>
              <td>${hasReport ? Utils.money(row.income) : '-'}</td>
              <td>${hasReport ? Number(row.customers || 0).toLocaleString() : '-'}</td>
              <td>${hasReport ? Utils.money(row.wages) : '-'}</td>
              <td>${hasReport && row.adBudgetKnown ? Utils.money(row.adBudget) : '-'}</td>
              <td>${hasReport ? UI.deltaMoney(row.profit) : '-'}</td>
              <td>${row.ratingKnown ? `${Utils.esc(row.rating)} / 10` : '-'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
        <p class="pp-note">Income and customers come from daily company report rows. ${UI.state.ui.dailyBalanceIncludeWages === false ? 'Wages are disabled for Balance, so profit treats wages as $0.' : 'Wages use current synced employee wages and saved wage history only; estimates are not included.'} Advertising budget uses dated Business Profile sync history; dates before the first observed budget stay blank. Rating uses dated news history where available.</p>`;
    },

    dailyGraphRows() {
      return UI.dailyBalanceRows()
        .filter((row) => row.hasReport)
        .sort((a, b) => Utils.dateTimestamp(a.date) - Utils.dateTimestamp(b.date))
        .slice(-14);
    },

    graphScale() {
      return UI.state.ui.graphScale === 'daily' ? 'daily' : 'weekly';
    },

    performanceGraphRows(scale) {
      if (scale === 'daily') return UI.dailyGraphRows();
      const grouped = new Map();
      UI.dailyBalanceRows().filter((row) => row.hasReport).forEach((row) => {
        const date = new Date(`${row.date}T12:00:00`);
        const weekInfo = Utils.isoWeekInfo(date);
        const key = `${weekInfo.year}-${weekInfo.week}`;
        const existing = grouped.get(key) || { week: weekInfo.week, year: weekInfo.year, timestamp: Utils.dateTimestamp(row.date), income: 0, customers: 0, wages: 0, adBudget: 0, profit: 0 };
        existing.timestamp = Math.max(existing.timestamp, Utils.dateTimestamp(row.date));
        existing.income += Utils.num(row.income, 0);
        existing.customers += Utils.num(row.customers, 0);
        existing.wages += Utils.num(row.wages, 0);
        existing.adBudget += Utils.num(row.adBudget, 0);
        existing.profit += Utils.num(row.profit, 0);
        grouped.set(key, existing);
      });
      return Array.from(grouped.values()).sort((a, b) => a.timestamp - b.timestamp).slice(-12);
    },

    graphMetricDefs() {
      const vars = UI.currentThemeVars();
      return [
        { key: 'income', label: 'Income', axis: 'money', color: vars.graphIncome, value: (row) => Utils.num(row.income, 0), format: Utils.money, compact: Utils.compactMoney },
        { key: 'customers', label: 'Customers', axis: 'count', color: vars.graphCustomers, value: (row) => Utils.num(row.customers, 0), format: Utils.formatNumber, compact: Utils.compactNumber },
        { key: 'wages', label: 'Wages', axis: 'money', color: vars.graphWages, value: (row) => Utils.num(row.wages, 0), format: Utils.money, compact: Utils.compactMoney },
        { key: 'adBudget', label: 'Ad Budget', axis: 'money', color: vars.graphAdBudget, value: (row) => Utils.num(row.adBudget, 0), format: Utils.money, compact: Utils.compactMoney },
        { key: 'profit', label: 'Profit', axis: 'money', color: vars.graphProfit, value: (row) => Utils.num(row.profit, 0), format: Utils.money, compact: Utils.compactMoney }
      ];
    },

    graphSeriesState() {
      UI.state.ui.graphSeries = Object.assign({}, DEFAULTS.ui.graphSeries, UI.state.ui.graphSeries || {});
      return UI.state.ui.graphSeries;
    },

    activeGraphMetrics() {
      const selected = UI.graphSeriesState();
      return UI.graphMetricDefs().filter((metric) => selected[metric.key] !== false);
    },

    serviceSoldGraphRows() {
      const labelByKey = new Map((UI.state.company.stock.items || []).map((item) => [String(item.key), item.label || item.name || item.key]));
      const currentRows = (UI.state.company.stock.items || []).map((item) => ({
        key: String(item.key || item.name || ''),
        name: item.label || item.name || item.key || 'Service',
        sold: Utils.num(item.soldAmount, 0),
        worth: Utils.num(item.soldWorth, 0)
      }));
      const latestSnapshot = (UI.state.company.stockHistory || [])
        .slice()
        .sort((a, b) => Utils.dateTimestamp(b.at) - Utils.dateTimestamp(a.at))[0];
      const snapshotRows = latestSnapshot ? (latestSnapshot.items || []).map((item) => ({
        key: String(item.key || ''),
        name: labelByKey.get(String(item.key || '')) || item.key || 'Service',
        sold: Utils.num(item.soldAmount, 0),
        worth: Utils.num(item.soldWorth, 0)
      })) : [];
      const rows = currentRows.some((row) => row.sold || row.worth) ? currentRows : snapshotRows;
      return rows
        .filter((row) => row.sold || row.worth)
        .sort((a, b) => Utils.num(b.sold, 0) - Utils.num(a.sold, 0) || String(a.name).localeCompare(String(b.name)))
        .slice(0, 12);
    },

    graphLabel(text) {
      text = String(text || '').trim();
      return text.length > 12 ? `${text.slice(0, 10)}...` : text;
    },

    graphNiceStep(rawStep, minimumStep) {
      const min = Math.max(1, Utils.num(minimumStep, 1));
      const raw = Math.max(min, Math.abs(Utils.num(rawStep, min)));
      const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
      const normalized = raw / magnitude;
      const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
      return Math.max(min, factor * magnitude);
    },

    graphTickValues(bounds, minimumStep, maxTicks) {
      if (!bounds) return [];
      const limit = Math.max(2, Utils.int(maxTicks, 6));
      const span = Math.max(Math.abs(bounds.max - bounds.min), Math.max(1, Utils.num(minimumStep, 1)));
      let step = UI.graphNiceStep(span / Math.max(1, limit - 1), minimumStep);
      let ticks = [];
      for (let guard = 0; guard < 8; guard += 1) {
        const start = Math.floor(bounds.min / step) * step;
        const end = Math.ceil(bounds.max / step) * step;
        ticks = [];
        for (let value = start; value <= end + step / 2; value += step) ticks.push(Math.round(value));
        if (ticks.length <= limit || guard === 7) break;
        step = UI.graphNiceStep(step * 1.8, minimumStep);
      }
      if (ticks.length < 2) ticks = [0, Math.max(step, 1)];
      bounds.min = ticks[0];
      bounds.max = ticks[ticks.length - 1];
      return ticks;
    },

    graphSlides() {
      const scale = UI.graphScale();
      const isDaily = scale === 'daily';
      const scaleLabel = isDaily ? 'Daily' : 'Weekly';
      const rowLabel = isDaily ? (row) => Utils.dateMonthDay(row.date) : (row) => `W${row.week}`;
      const serviceRows = UI.serviceSoldGraphRows();
      const vars = UI.currentThemeVars();
      return [
        { type: 'line', title: `${scaleLabel} operating performance`, note: `${scaleLabel} income, wages, ad budget, and profit share an adaptive money axis. Customers use the right-side count axis.`, rows: UI.performanceGraphRows(scale), series: UI.activeGraphMetrics(), label: rowLabel, empty: 'Sync company news to build performance graphs.' },
        { type: 'bar', title: 'Services sold', note: 'Latest Torn stock snapshot totals by service type. Torn does not label the sold_amount period.', rows: serviceRows, value: (row) => Utils.num(row.sold, 0), label: (row) => UI.graphLabel(row.name), titleText: (row) => `${row.name}: ${Number(row.sold || 0).toLocaleString()} sold${row.worth ? ` / ${Utils.money(row.worth)} sold worth` : ''}`, format: Utils.formatNumber, color: vars.graphServices, empty: 'Use Sync services sold to pull the latest Torn stock snapshot. Torn does not label the sold_amount period.' }
      ];
    },

    graphSeriesControls() {
      const selected = UI.graphSeriesState();
      return `<div class="pp-series-controls">${UI.graphMetricDefs().map((metric) => `
        <label class="pp-series-toggle" style="--series-color:${Utils.esc(metric.color)}">
          <input type="checkbox" data-graph-series="${Utils.esc(metric.key)}" ${selected[metric.key] !== false ? 'checked' : ''}>
          <i></i>${Utils.esc(metric.label)}
        </label>`).join('')}</div>`;
    },

    lineGraph(slide) {
      const rows = slide.rows || [];
      const seriesList = slide.series || [];
      if (!rows.length || !seriesList.length) return `<div class="pp-empty">${Utils.esc(slide.empty || 'Sync company news to build graphs.')}</div>`;
      const width = 1000;
      const height = 340;
      const moneySeries = seriesList.filter((series) => series.axis !== 'count');
      const countSeries = seriesList.filter((series) => series.axis === 'count');
      const left = 86;
      const right = countSeries.length ? 78 : 34;
      const top = 34;
      const bottom = 62;
      const plotWidth = width - left - right;
      const plotHeight = height - top - bottom;
      const boundsFor = (seriesGroup) => {
        const values = seriesGroup.flatMap((series) => rows.map((row) => series.value(row))).filter((value) => Number.isFinite(value));
        let min = Math.min(0, values.length ? Math.min.apply(null, values) : 0);
        let max = Math.max(0, values.length ? Math.max.apply(null, values) : 0);
        if (min === max) max = min + 1;
        return { min, max };
      };
      const moneyBounds = moneySeries.length ? boundsFor(moneySeries) : null;
      const countBounds = countSeries.length ? boundsFor(countSeries) : null;
      const moneyTicks = UI.graphTickValues(moneyBounds, 1, 6);
      const countTicks = UI.graphTickValues(countBounds, 1, 6);
      const axisFor = (series) => series.axis === 'count' ? countBounds : moneyBounds;
      const xFor = (index) => rows.length === 1 ? left + plotWidth / 2 : left + (index * plotWidth / (rows.length - 1));
      const pointFor = (value, min, max, index) => {
        const range = max === min ? 1 : max - min;
        return { x: xFor(index), y: top + ((max - value) / range * plotHeight) };
      };
      const yForValue = (value, bounds) => {
        const range = bounds.max === bounds.min ? 1 : bounds.max - bounds.min;
        return top + ((bounds.max - value) / range * plotHeight);
      };
      const tickRows = [0, 1, 2, 3, 4];
      const tickValue = (bounds, row) => bounds.max - (row * (bounds.max - bounds.min) / 4);
      const gridYs = moneyTicks.length ? moneyTicks.map((value) => yForValue(value, moneyBounds)) : tickRows.map((row) => top + (row * plotHeight / 4));
      const grid = gridYs.map((y) => {
        return `<line class="pp-line-grid" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line>`;
      }).join('');
      const leftAxis = moneyBounds ? `<line class="pp-line-axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}"></line>
        <text class="pp-line-axis-label" x="${left}" y="18" text-anchor="middle">Money</text>
        ${moneyTicks.map((value) => {
          const y = yForValue(value, moneyBounds);
          return `<text class="pp-line-y left" x="${left - 10}" y="${(y + 5).toFixed(1)}">${Utils.esc(Utils.compactMoney(value))}</text>`;
        }).join('')}` : '';
      const rightAxisX = width - right;
      const rightAxis = countBounds ? `<line class="pp-line-axis" x1="${rightAxisX}" y1="${top}" x2="${rightAxisX}" y2="${top + plotHeight}"></line>
        <text class="pp-line-axis-label" x="${rightAxisX}" y="18" text-anchor="middle">Customers</text>
        ${countTicks.map((value) => {
          const y = yForValue(value, countBounds);
          return `<line class="pp-line-axis" x1="${rightAxisX}" y1="${y.toFixed(1)}" x2="${rightAxisX + 5}" y2="${y.toFixed(1)}"></line><text class="pp-line-y right" x="${rightAxisX + 10}" y="${(y + 5).toFixed(1)}">${Utils.esc(Utils.compactNumber(value))}</text>`;
        }).join('')}` : '';
      const zeroLine = moneyBounds && moneyBounds.min < 0 && moneyBounds.max > 0
        ? (() => {
          const y = pointFor(0, moneyBounds.min, moneyBounds.max, 0).y;
          return `<line class="pp-line-zero" x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}"></line>`;
        })()
        : '';
      const seriesMarkup = seriesList.map((series, seriesIndex) => {
        const values = rows.map((row) => series.value(row));
        const axis = axisFor(series);
        if (!axis) return '';
        const points = values.map((value, index) => pointFor(value, axis.min, axis.max, index));
        const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
        const color = Utils.esc(series.color);
        const isCount = series.axis === 'count';
        const seriesClass = isCount ? ' is-count' : '';
        return `<g style="--series-color:${color}">
          <path class="pp-line-path${seriesClass}" d="${path}"></path>
          ${points.map((point, index) => {
            const value = values[index];
            const skipCountLabel = isCount && points.length > 4 && index !== 0 && index !== points.length - 1 && index % 2;
            const labelY = isCount
              ? Math.min(height - bottom + 22, point.y + 18 + (seriesIndex % 2) * 8)
              : Math.max(15, point.y - 9 - (seriesIndex % 2) * 10);
            const title = `${series.label} ${slide.label(rows[index])}: ${series.format(value)}`;
            return `<circle class="pp-line-point${seriesClass}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${isCount ? 3 : 4}"><title>${Utils.esc(title)}</title></circle>
              ${skipCountLabel ? '' : `<text class="pp-line-label${seriesClass}" style="--series-color:${color};fill:var(--series-color)" x="${point.x.toFixed(1)}" y="${labelY.toFixed(1)}">${Utils.esc(series.compact(value))}</text>`}`;
          }).join('')}
        </g>`;
      }).join('');
      const labels = rows.map((row, index) => `<text class="pp-line-x" x="${xFor(index).toFixed(1)}" y="${height - 22}">${Utils.esc(slide.label(row))}</text>`).join('');
      return `<div class="pp-line-chart">
        <svg class="pp-line-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${Utils.esc(slide.title)}">
          ${grid}${zeroLine}${leftAxis}${rightAxis}${seriesMarkup}${labels}
        </svg>
      </div>
      <p class="pp-note">Money lines share the left Y axis with adaptive tick spacing. Customers use the right Y axis and are dashed because they often track income closely.</p>`;
    },

    barGraph(slide) {
      const rows = slide.rows || [];
      if (!rows.length) return `<div class="pp-empty">${Utils.esc(slide.empty || 'Sync company news to build graphs.')}</div>`;
      const max = rows.reduce((highest, row) => Math.max(highest, Math.abs(slide.value(row))), 0) || 1;
      return `<div class="pp-graph-stage" style="--graph-cols:${Math.min(14, Math.max(1, rows.length))}">${rows.map((row) => {
        const value = slide.value(row);
        const height = Math.max(4, Math.round(Math.abs(value) / max * 150));
        const color = value < 0 ? 'var(--bad)' : slide.color;
        const title = slide.titleText ? slide.titleText(row, value) : `${slide.label(row)}: ${slide.format(value)}`;
        return `<div class="pp-bar" title="${Utils.esc(title)}" style="--bar:${height}px;--bar-color:${color}"><b>${Utils.esc(slide.format(value))}</b><span></span><small>${Utils.esc(slide.label(row))}</small></div>`;
      }).join('')}</div>`;
    },

    graphSlideshow() {
      const slides = UI.graphSlides();
      const index = Utils.clamp(Utils.int(UI.state.ui.graphIndex, 0), 0, slides.length - 1);
      UI.state.ui.graphIndex = index;
      const scale = UI.graphScale();
      const slide = slides[index];
      return `<div class="pp-graph-panel">
        <div class="pp-graph-head">
          <div><h3>${Utils.esc(slide.title)}</h3><p>${Utils.esc(slide.note)}</p></div>
          <div class="pp-row-actions">
            ${slide.type === 'line' ? `<select class="pp-select pp-select-fit" style="--select-width:11ch" data-ui-field="graphScale" title="Choose daily or weekly graph stats">
              <option value="daily" ${scale === 'daily' ? 'selected' : ''}>Daily</option>
              <option value="weekly" ${scale === 'weekly' ? 'selected' : ''}>Weekly</option>
            </select>` : ''}
            <button class="pp-btn" type="button" data-action="graph-prev">&laquo;</button><span class="pp-pill">${index + 1} / ${slides.length}</span><button class="pp-btn" type="button" data-action="graph-next">&raquo;</button>
          </div>
        </div>
        ${slide.type === 'line' ? UI.graphSeriesControls() : ''}
        ${slide.type === 'line' ? UI.lineGraph(slide) : UI.barGraph(slide)}
      </div>`;
    },

    dailyBalancePage() {
      return `<div class="pp-grid">
        <section class="pp-panel" data-tour="daily-balance-graphs">
          <div class="pp-head">
            <div><h2>Operating Balance</h2><p>Income, wages, ad spend, and profit from synced reports and dated company history.</p></div>
          </div>
          <div class="pp-content">${UI.graphSlideshow()}</div>
        </section>
        <section class="pp-panel" data-tour="daily-balance-table">
          <div class="pp-head">
            <div><h3>Balance ledger</h3><p>Last synced week by default, with all-time history available.</p></div>
          </div>
          <div class="pp-content">${UI.dailyBalanceTable()}</div>
        </section>
      </div>`;
    },

    ledgerPage() {
      const state = UI.state;
      const visibleLedger = UI.visibleLedgerRows();
      const summary = Ledger.summary(visibleLedger, state.settings);
      const today = Utils.todayInput();
      return `
        <div class="pp-grid">
          <section class="pp-panel" data-tour="ledger-summary">
            <div class="pp-head">
              <div>
                <h2>Training ledger</h2>
                <p>Paid queue and sponsored rotation are recalculated locally as you edit.</p>
              </div>
            </div>
            <div class="pp-content">
              <div class="pp-statline" data-ledger-summary>
                ${UI.summaryStats(summary)}
              </div>
             </div>
          </section>
          <section class="pp-panel" data-tour="training-orders">
            <div class="pp-head">
              <div>
                <h3>Training Orders</h3>
                <p>Add manual orders or import payment-log orders from one explicit Torn API request.</p>
              </div>
              <div class="pp-row-actions">
                <span class="pp-pill" style="--pill-color:${state.settings.colors.paid}">Default ${Utils.money(state.settings.trainingPrice)} / train</span>
                <button class="pp-btn" type="button" data-action="import-training-orders-log" title="Import from log">[+]</button>
              </div>
            </div>
            <div class="pp-content">
              <div class="pp-table-title"><span>Add training order</span><span class="pp-note">${state.settings.discountsEnabled !== false ? 'Discounts combine manual, merit, loyalty, and global promo values.' : 'Discount rules are currently off in Settings.'}</span></div>
              <form data-ledger-form class="pp-form pp-ledger-add-form">
                ${UI.field('Staff Name', UI.staffSelect('playerName'), 'pp-ledger-staff-field')}
                <input type="hidden" name="playerId" value="">
                <input type="hidden" name="contractType" value="paid">
                ${UI.field('Entry date', `<input class="pp-input" type="date" name="entryDate" value="${Utils.esc(today)}">`, 'pp-ledger-date-field')}
                ${UI.field('Payment received', '<input class="pp-input" name="payment" inputmode="numeric" data-money-input placeholder="$10,000,000" value="">', 'pp-ledger-money-field')}
                ${UI.field('Price / train', `<input class="pp-input" name="pricePerTrain" inputmode="numeric" data-money-input placeholder="$600,000" value="${state.settings.trainingPrice.toLocaleString('en-US')}">`, 'pp-ledger-price-field')}
                ${UI.field('Total trains', '<input class="pp-input" name="totalTrains" inputmode="numeric" placeholder="Auto" value="0">', 'pp-ledger-small-field')}
                <input class="pp-input" name="usedTrains" inputmode="numeric" value="0" type="hidden">
                ${UI.field('Merits', '<input class="pp-input" name="merits" inputmode="numeric" min="0" max="10" value="0" enabled="false">', 'pp-ledger-small-field')}
                ${UI.field('Manual discount %', '<input class="pp-input" name="manualDiscount" inputmode="decimal" value="0">', 'pp-ledger-small-field')}
                ${UI.field('Apply discounts', '<span class="pp-checkline"><input type="checkbox" name="applyDiscount" checked></span>', 'pp-ledger-check-field')}
                ${UI.field('Paid', '<span class="pp-checkline"><input type="checkbox" name="paid"></span>', 'pp-ledger-check-field')}
                ${UI.field('Done', '<span class="pp-checkline"><input type="checkbox" name="done"></span>', 'pp-ledger-check-field')}
                <div class="pp-field pp-ledger-preview-field"><span class="pp-note" data-cost-preview>Final cost: $0</span><button class="pp-btn is-primary" type="submit">Add entry</button></div>
              </form>
              <div class="pp-table-title"><span>Orders</span><span class="pp-note">Inline status edits update totals immediately.</span></div>
              ${UI.weeklyLimitNotice(state.ledger.length, visibleLedger.length, 'Training orders')}
              ${UI.ledgerTable()}
            </div>
          </section>
          <section class="pp-panel" data-tour="training-log">
            <div class="pp-head">
              <div>
                <h3>Training log</h3>
                <p>Local sync from already fetched company news, grouped by date.</p>
              </div>
              <div class="pp-row-actions">${UI.trainingLogNav()}</div>
            </div>
          <div class="pp-content">${UI.trainingLogStatus()}${UI.trainingLogPills()}</div></section>
          <section class="pp-panel" data-tour="train-schedule">
            <div class="pp-head">
              <div>
                <h3>Train Schedule</h3>
                <p title="FIFO, First In First Out">FIFO paid trains first. Remaining daily capacity fills sponsored rotation users.</p>
              </div>
                <button class="pp-btn is-primary" type="button" data-action="build-planner">Build calendar</button>
            </div>
            <div class="pp-content">
              ${UI.trainingQueueSummary()}
              <div class="pp-form" style="margin-bottom:12px">
                ${UI.field('Start date', `<input class="pp-input" type="date" data-planner-field="startDate" value="${Utils.esc(state.planner.startDate || today)}">`, 'span-2')}
                ${UI.field('Planner mode', UI.plannerModeSelect())}
                ${UI.field('Days', `<input class="pp-input" inputmode="numeric" data-planner-field="daysToPlan" value="${Utils.esc(state.planner.daysToPlan)}">`)}
                ${UI.field('Daily train supply', `<input class="pp-input" value="${Planner.dailySupply(state.settings)}" disabled>`)}
                ${UI.field('Paid cap / day', `<input class="pp-input" value="${Utils.esc(state.settings.maxPaidTrainsPerDay)}" disabled>`)}
              </div>
              ${UI.operationalContext()}
              ${UI.plannerCalendar()}
            </div>
          </section>
        </div>`;
    },

    ledgerTable() {
      const state = UI.state;
      const ledgerRows = UI.visibleLedgerRows();
      if (!state.ledger.length) return '<div class="pp-empty">No ledger entries yet.</div>';
      if (!ledgerRows.length) return '<div class="pp-empty">No training orders yet.</div>';
      Ledger.prepare(state);
      const rows = UI.sortedRows('ledger', ledgerRows, {
        orderId: (entry) => Utils.int(String(entry.orderId || '').replace(/^.*-TR-/i, ''), 0),
        date: (entry) => Utils.dateTimestamp(entry.entryDate || entry.createdAt),
        playerName: (entry) => String(entry.playerName || '').toLowerCase(),
        payment: (entry) => Utils.num(entry.payment, 0),
        price: (entry) => Ledger.totals(entry, state.settings).price,
        totalTrains: (entry) => Ledger.totals(entry, state.settings).totalTrains,
        manualDiscount: (entry) => Utils.num(entry.manualDiscount, 0),
        merits: (entry) => Utils.int(entry.merits, 0),
        applyDiscount: (entry) => entry.applyDiscount === false ? 0 : 1,
        status: (entry) => `${Ledger.totals(entry, state.settings).paid ? 'paid' : 'unpaid'} ${Ledger.totals(entry, state.settings).done ? 'done' : 'undone'}`
      }, 'playerName', 'asc');
      return `<div class="pp-wrap"><table class="pp-table">
        <thead>
          <tr>
            <th>#</th><th>${UI.tableSortHeader('ledger', 'orderId', 'Order')}</th><th>${UI.tableSortHeader('ledger', 'date', 'Date')}</th>
            <th>${UI.tableSortHeader('ledger', 'playerName', 'Player')}</th>
            <th>${UI.tableSortHeader('ledger', 'payment', 'Payment')}</th>
            <th>${UI.tableSortHeader('ledger', 'price', 'Price')}</th>
            <th>${UI.tableSortHeader('ledger', 'totalTrains', 'Trains')}</th>
            <th>${UI.tableSortHeader('ledger', 'manualDiscount', 'Manual %')}</th>
            <th>${UI.tableSortHeader('ledger', 'merits', 'Merits')}</th>
            <th>${UI.tableSortHeader('ledger', 'applyDiscount', 'Apply discount')}</th>
            <th>${UI.tableSortHeader('ledger', 'status', 'Status')}</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows.map((entry, index) => UI.ledgerRow(entry, index)).join('')}</tbody>
      </table></div>`;
    },

    ledgerRow(entry, index) {
      const state = UI.state;
      const totals = Ledger.totals(entry, state.settings);
      const orderId = entry.orderId || 'Unassigned';
      const done = totals.done || entry.done;
      return `
        <tr class="pp-ledger-row ${done ? 'is-done' : ''}" data-ledger-row="${entry.id}">
          <td>${index + 1}</td>
          <td><span class="pp-ledger-id">${Utils.esc(orderId)}</span></td>
          <td><span class="pp-readonly-value">${Utils.esc(Utils.dateShort(entry.entryDate || entry.createdAt))}</span></td>
          <td><span class="pp-readonly-value">${Utils.esc(entry.playerName || 'Unknown')}</span><span class="pp-readonly-sub" data-ledger-player-id>${entry.playerId ? `ID: ${Utils.esc(entry.playerId)}` : 'No ID linked'}</span></td>
          <td><span class="pp-readonly-value">${Utils.money(totals.payment)}</span><span class="pp-readonly-sub">Balance: <span data-row-balance>${Utils.money(totals.balance)}</span></span></td>
          <td><span class="pp-readonly-value">${Utils.money(totals.price)}</span><span class="pp-readonly-sub">Per train</span></td>
          <td><span class="pp-order-trains"><label>Total<span>${Utils.esc(totals.totalTrains)}</span></label><label>Given<span>${Utils.esc(totals.usedTrains)}</span></label></span><span class="pp-readonly-sub"><span data-row-remaining>${totals.remaining}</span> remaining</span></td>
          <td><span class="pp-readonly-value">${Utils.esc(entry.manualDiscount || 0)}%</span></td>
          <td><span class="pp-readonly-value">${Utils.esc(entry.merits || 0)}</span></td>
          <td><label class="pp-note"><input type="checkbox" disabled ${entry.applyDiscount !== false ? 'checked' : ''}> ${entry.applyDiscount !== false ? 'Enabled' : 'Off'}</label><span class="pp-readonly-sub"><span data-row-discount>${totals.totalDiscount}</span>% total</span></td>
          <td><label><input type="checkbox" data-ledger-field="paid" ${totals.paid ? 'checked' : ''}> Paid</label><br><label><input type="checkbox" data-ledger-field="done" ${totals.done ? 'checked' : ''}> Done</label></td>
          <td><div class="pp-row-actions"><button class="pp-btn" type="button" data-action="copy-ledger-receipt" data-id="${entry.id}" title="Copy HTML receipt">Receipt</button><button class="pp-btn is-danger" type="button" data-action="delete-ledger" data-id="${entry.id}">Delete</button></div></td>
        </tr>`;
    },

    plannerModeSelect() {
      const mode = Planner.allowedMode(UI.state);
      const options = [
        ['auto', 'Auto'],
        ['manual', 'Manual'],
        ['hybrid', 'Hybrid']
      ];
      return `<select class="pp-select" data-planner-field="mode">${options.map(([value, label]) => `<option value="${value}" ${mode === value ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
    },

    plannerStaffValue(person) {
      return String((person && (person.id || person.playerId || person.name || person.playerName)) || '');
    },

    plannerSelectableStaff(referenceDate) {
      const staff = Planner.currentRosterContext(UI.state).roster
        .filter((person) => person && (person.id || person.name))
        .filter((person) => Planner.trainingEligibility(person, UI.state, referenceDate).eligible);
      const sponsored = staff.filter((person) => person.contractType === 'sponsored');
      return sponsored.length ? sponsored : staff;
    },

    resolvePlannerStaff(value, referenceDate) {
      const wanted = String(value || '').trim();
      if (!wanted) return null;
      return UI.plannerSelectableStaff(referenceDate).find((person) => String(person.id || '') === wanted || String(person.name || '') === wanted) || null;
    },

    plannerSuggestedSlot(day, index) {
      return day && Array.isArray(day.suggestions) ? day.suggestions[index] || null : null;
    },

    plannerContractBadge(type) {
      const paid = String(type || '').toLowerCase() === 'paid';
      const label = paid ? 'P' : 'S';
      const title = paid ? 'Paid train' : 'Sponsored train';
      const color = paid ? UI.state.settings.colors.paid : UI.state.settings.colors.sponsored;
      return `<span class="pp-contract-badge" style="--badge-color:${Utils.esc(color)}" title="${title}">${label}</span>`;
    },

    plannerFixedSlotRows(day, activeIndex) {
      return (day.slots || []).map((slot, index) => {
        const titleParts = [];
        if (slot.playerId) titleParts.push(`User ID ${slot.playerId}`);
        if (slot.statNeedSummary) titleParts.push(slot.statNeedSummary);
        if (slot.riskSummary) titleParts.push(`Risk: ${slot.riskSummary}`);
        return `<tr class="pp-day-row ${activeIndex === index ? 'is-active' : ''}">
        <td>${index + 1}.&nbsp;</td>
        <td><span class="pp-day-name" title="${Utils.esc(titleParts.join(' | '))}">${Utils.esc(slot.playerName || 'Unknown staff')}</span></td>
        <td>${UI.plannerContractBadge(slot.type)}</td>
      </tr>`;
      }).join('');
    },

    plannerCalendar() {
      const days = UI.state.planner.days;
      if (!days.length) return '<div class="pp-empty">No calendar generated yet.</div>';
      const queueView = UI.plannerQueueView();
      return `<div class="pp-calendar">${days.map((day) => {
        const dayQueue = UI.plannerDayQueue(day);
        const picked = new Set(day.slots.map((slot) => UI.plannerStaffValue(slot)).filter(Boolean));
        const activeIndex = queueView && queueView.date === day.date ? queueView.activeIndex : -1;
        const title = `${day.date} ${Utils.weekdayShort(day.date)} (${dayQueue.length}/${day.supply})`;
        return `
        <div class="pp-day">
          <div class="pp-day-head">
            <h4>${Utils.esc(title)}</h4>
            <button class="pp-btn pp-day-reset" type="button" data-action="reset-planner-day" data-day="${Utils.esc(day.date)}" title="Reset this day's queue">&#8634;</button>
          </div>
          <table class="pp-day-table"><tbody>
            ${UI.plannerFixedSlotRows(day, activeIndex)}
            ${UI.manualPlannerSlots(day, picked, activeIndex)}
          </tbody></table>
          ${UI.plannerDayTrainControls(day, queueView)}
        </div>`;
      }).join('')}</div>`;
    },

    plannerDayQueue(day) {
      if (!day) return [];
      const slots = (day.slots || []).map((slot) => Object.assign({}, slot));
      const mode = Planner.allowedMode(UI.state);
      if (mode === 'auto') return slots;
      const open = Math.max(0, Utils.int(day.supply, 0) - slots.length);
      const manualSlots = UI.state.planner.manualSlots || {};
      for (let index = 0; index < open; index += 1) {
        const key = `${day.date}:${index}`;
        const suggested = mode === 'hybrid' ? UI.plannerSuggestedSlot(day, index) : null;
        const hasManual = Object.prototype.hasOwnProperty.call(manualSlots, key);
        const selected = hasManual ? manualSlots[key] : (suggested ? UI.plannerStaffValue(suggested) : '');
        if (!selected) continue;
        const person = UI.resolvePlannerStaff(selected, day.date)
          || (suggested && Planner.trainingEligibility(suggested.personRef || suggested, UI.state, day.date).eligible ? suggested : null);
        if (!person) continue;
        slots.push({
          identity: person.identity || Company.resolveIdentity(person, UI.state),
          playerId: person.id || person.playerId || '',
          playerName: person.name || person.playerName || selected,
          role: person.role || 'Employee',
          type: 'sponsored',
          source: hasManual ? 'manual' : 'rotation'
        });
      }
      return slots;
    },

    plannerTrainingQueue() {
      const days = (UI.state.planner.days || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
      if (!days.length) return null;
      const today = Utils.todayInput();
      const completed = UI.state.planner.completedDates || {};
      const available = days.filter((day) => day && day.date && !completed[day.date]);
      const current = available.find((day) => day.date >= today && UI.plannerDayQueue(day).length) || available.find((day) => UI.plannerDayQueue(day).length);
      if (!current) return null;
      return { date: current.date, slots: UI.plannerDayQueue(current) };
    },

    plannerQueueView() {
      const queue = UI.plannerTrainingQueue();
      if (!queue || !queue.slots.length) return null;
      const active = UI.state.planner.trainingQueue;
      const sameDay = active && active.date === queue.date;
      const activeIndex = sameDay ? Utils.clamp(Utils.int(active.activeIndex, 0), 0, queue.slots.length) : 0;
      return { date: queue.date, slots: queue.slots, activeIndex };
    },

    plannerDayTrainControls(day, queueView) {
      if (!queueView || queueView.date !== day.date || !queueView.slots.length) return '';
      if (queueView.activeIndex >= queueView.slots.length) {
        return `<div class="pp-train-controls">
          <span class="pp-note">Queue complete for ${Utils.esc(Utils.dateShort(day.date))}</span>
          <span></span>
          <button class="pp-btn" type="button" data-action="open-training-queue-page" title="Open Torn employee training page">&raquo;</button>
        </div>`;
      }
      const slot = queueView.slots[queueView.activeIndex] || queueView.slots[0];
      return `<div class="pp-train-controls">
        <span class="pp-note" title="${Utils.esc(slot.playerId ? `User ID ${slot.playerId}` : 'No user ID detected yet')}">Next: ${Utils.esc(queueView.activeIndex + 1)} / ${Utils.esc(queueView.slots.length)} ${Utils.esc(slot.playerName || 'Unknown staff')}</span>
        <button class="pp-btn is-primary" type="button" data-action="click-training-action" title="Click the currently loaded Torn Train action and advance the queue" aria-label="Train queued member">+</button>
        <button class="pp-btn" type="button" data-action="open-training-queue-page" title="Open Torn employee training page and highlight the queued member">&raquo;</button>
      </div>`;
    },

    trainingQueueSummary() {
      const hidden = !!UI.state.ui.plannerQueueHidden;
      const label = hidden ? 'Show training note' : 'Hide training note';
      const toggle = `<button class="pp-btn pp-queue-toggle" type="button" data-action="toggle-planner-queue" title="${label}" aria-label="${label}">${UI.eyeIcon(hidden)}</button>`;
      if (hidden) return `<div class="pp-training-queue"><div class="pp-training-queue-head"><span class="pp-note">Training note hidden.</span>${toggle}</div></div>`;
      return `<div class="pp-training-queue"><div class="pp-training-queue-head"><span>Use &raquo; to open and highlight Torn's employee list, then + to click the loaded Torn action and advance the queue. New hires stay off the schedule for their first ${Planner.trainingHoldDays()} days.</span>${toggle}</div></div>`;
    },

    eyeIcon(hidden) {
      const slash = hidden ? '' : '<line x1="18" y1="4" x2="4" y2="18"></line>';
      return `<svg class="pp-eye-icon" viewBox="0 0 22 22" aria-hidden="true"><path d="M2.5 11s3.1-5 8.5-5 8.5 5 8.5 5-3.1 5-8.5 5-8.5-5-8.5-5z"></path><circle cx="11" cy="11" r="2.4"></circle>${slash}</svg>`;
    },

    operationalContext() {
      const state = UI.state;
      const paidQueue = Planner.queue(UI.visibleLedgerRows(), 'paid', state.settings).length;
      const sponsored = Planner.sponsoredRoster(state);
      const risk = Planner.sponsoredRiskSummary(state);
      const supply = Planner.dailySupply(state.settings);
      const paidCapLimit = Planner.paidCapLimit(state.settings);
      const paidLimit = Utils.clamp(Utils.int(state.settings.maxPaidTrainsPerDay, paidCapLimit), 0, paidCapLimit);
      const paidDaily = Math.max(1, Math.min(supply, paidLimit || supply));
      const paidDays = Math.ceil(paidQueue / paidDaily);
      const holdCount = Planner.holdCount(state, state.planner.startDate || Utils.todayInput());
      const counts = new Map();
      (state.staff.current || []).forEach((person) => {
        const label = UI.roleLabel(person.role || 'Employee');
        counts.set(label, (counts.get(label) || 0) + 1);
      });
      const coverage = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([role, count]) => `${role}: ${count}`).join('\n') || 'No staff synced yet.';
      const riskTitle = risk.total
        ? `Auto mode lowers sponsored priority for ${risk.total} staff this review window (${risk.reviewDays} day${risk.reviewDays === 1 ? '' : 's'}). ${risk.danger} danger, ${risk.warn} warning.`
        : `Auto mode is not currently lowering sponsored priority for addiction or inactivity in the ${risk.reviewDays}-day review window.`;
      return `<div class="pp-operational">
        <div class="pp-operation-note"><strong>${paidQueue.toLocaleString()}</strong>Paid trains waiting</div>
        <div class="pp-operation-note"><strong>${sponsored.length.toLocaleString()}</strong>Free/sponsored candidates</div>
        <div class="pp-operation-note"><strong>${supply.toLocaleString()}</strong>Daily supply / ${paidDaily.toLocaleString()} paid slots</div>
        <div class="pp-operation-note" title="${Utils.esc(coverage)}"><strong>${paidDays.toLocaleString()}</strong>Paid queue day${paidDays === 1 ? '' : 's'}</div>
        <div class="pp-operation-note" title="Staff in their first ${Planner.trainingHoldDays()} days are held off the schedule, even when they already have paid orders."><strong>${holdCount.toLocaleString()}</strong>New-hire hold</div>
        <div class="pp-operation-note" title="${Utils.esc(riskTitle)}"><strong>${risk.total.toLocaleString()}</strong>Risk-adjusted sponsored</div>
      </div>`;
    },

    manualPlannerSlots(day, picked, activeIndex) {
      const open = Math.max(0, Utils.int(day.supply, 0) - day.slots.length);
      if (!open) return '';
      const mode = Planner.allowedMode(UI.state);
      const staff = UI.plannerSelectableStaff(day.date);
      if (mode === 'auto' || !staff.length) {
        return Array.from({ length: open }, (_, index) => {
          const rowIndex = day.slots.length + index;
          return `<tr class="pp-day-row ${activeIndex === rowIndex ? 'is-active' : ''}">
            <td>${rowIndex + 1}.&nbsp;</td>
            <td><span class="pp-day-name">Available Slot</span></td>
            <td></td>
          </tr>`;
        }).join('');
      }
      const manualSlots = UI.state.planner.manualSlots || {};
      const rows = [];
      for (let index = 0; index < open; index += 1) {
        const key = `${day.date}:${index}`;
        const suggested = mode === 'hybrid' ? UI.plannerSuggestedSlot(day, index) : null;
        const hasManual = Object.prototype.hasOwnProperty.call(manualSlots, key);
        const selected = hasManual ? manualSlots[key] : (suggested ? UI.plannerStaffValue(suggested) : '');
        const selectedPerson = UI.resolvePlannerStaff(selected, day.date)
          || (suggested && Planner.trainingEligibility(suggested.personRef || suggested, UI.state, day.date).eligible ? suggested : null);
        const selectedValue = selectedPerson ? UI.plannerStaffValue(selectedPerson) : selected;
        const rowIndex = day.slots.length + index;
        rows.push(`<tr class="pp-day-row ${activeIndex === rowIndex ? 'is-active' : ''}">
          <td>${rowIndex + 1}.&nbsp;</td>
          <td><select class="pp-inline pp-name" data-planner-manual="${Utils.esc(key)}"><option value="">Available Slot</option>${staff.map((person) => {
          const value = UI.plannerStaffValue(person);
          const disabled = picked.has(value) && selectedValue !== value ? 'disabled' : '';
          return `<option value="${Utils.esc(value)}" ${selectedValue === value ? 'selected' : ''} ${disabled}>${Utils.esc(person.name)}</option>`;
        }).join('')}</select></td>
          <td>${UI.plannerContractBadge('sponsored')}</td>
        </tr>`);
        if (selectedPerson && selectedValue) picked.add(selectedValue);
      }
      return rows.join('');
    },

    roleAbbr(role) {
      const clean = String(role || 'Employee').replace(/[^A-Za-z0-9 &/-]/g, '').trim();
      if (!clean) return 'EMP';
      const words = clean.split(/[\s/&-]+/).filter(Boolean);
      if (words.length > 1) return words.map((word) => word[0]).join('').slice(0, 4).toUpperCase();
      return clean.slice(0, 4).toUpperCase();
    },

    trainingLogRoleContext() {
      const identityMaps = Company.identityMaps(UI.state);
      const byIdentity = new Map();
      (UI.state.staff.current || []).concat(UI.state.staff.past || []).forEach((person) => {
        const identity = Company.resolveIdentity(person, UI.state, identityMaps);
        if (identity && !byIdentity.has(identity)) byIdentity.set(identity, person);
      });
      return { identityMaps, byIdentity };
    },

    trainingLogRole(row, context) {
      const meta = context || UI.trainingLogRoleContext();
      const identity = Company.resolveIdentity(row, UI.state, meta.identityMaps);
      const person = meta.byIdentity.get(identity) || {};
      const role = person.role || row.position || 'Employee';
      return { role: UI.roleLabel(role), color: UI.roleColor(role) };
    },

    trainingLogDateRange(rows) {
      const dates = (rows || []).map((row) => row.date).filter(Boolean).sort();
      if (!dates.length) return 'No rows';
      return `${Utils.dateShort(dates[0])} - ${Utils.dateShort(dates[dates.length - 1])}`;
    },

    trainingLogStatus() {
      const stored = UI.state.trainingLog || [];
      const visible = UI.visibleTrainingLogRows();
      return `<div class="pp-empty" style="margin-bottom:10px">
        Training rows: ${visible.length.toLocaleString()} visible / ${stored.length.toLocaleString()} stored.
        Visible range: ${Utils.esc(UI.trainingLogDateRange(visible))}. Stored range: ${Utils.esc(UI.trainingLogDateRange(stored))}.
      </div>`;
    },

    trainingLogPills() {
      const logs = UI.visibleTrainingLogRows();
      if (!logs.length) return '<div class="pp-empty">No training news parsed yet. Sync company news first, then hit Sync training log.</div>';
      const range = UI.trainingLogWindow();
      const roleContext = UI.trainingLogRoleContext();
      const byDate = range.rows.reduce((map, row) => {
        map.set(row.date, (map.get(row.date) || []).concat(row));
        return map;
      }, new Map());
      const dates = Array.from({ length: 7 }, (_, index) => Utils.addDays(range.end, -index));
      return `<div class="pp-training-pills">${dates.map((date) => {
        const rows = byDate.get(date) || [];
        return `
        <div class="pp-training-day">
          <strong>${Utils.esc(Utils.dateShort(date))} <span class="pp-note">${Utils.esc(Utils.weekdayShort(date))}</span></strong>
          <div class="pp-pill-list">${rows.length ? rows.sort((a, b) => String(a.playerName).localeCompare(String(b.playerName))).map((row) => { const role = UI.trainingLogRole(row, roleContext); return `<span class="pp-pill" style="--pill-color:${Utils.esc(role.color)}" title="${Utils.esc(role.role)}">${Utils.esc(row.playerName)} x${Utils.esc(row.count)}</span>`; }).join('') : '<span class="pp-note">No trains logged</span>'}</div>
        </div>`;
      }).join('')}</div>`;
    },

    trainingLogYears(logs) {
      return Array.from(new Set((logs || []).map((row) => String(row.date || '').slice(0, 4)).filter((year) => /^\d{4}$/.test(year)))).sort((a, b) => b.localeCompare(a));
    },

    trainingLogWindow() {
      const logs = UI.visibleTrainingLogRows();
      const year = UI.state.ui.trainingLogYear || 'all';
      const scoped = year === 'all' ? logs : logs.filter((row) => String(row.date || '').slice(0, 4) === String(year));
      const dates = Array.from(new Set(scoped.map((row) => row.date).filter(Boolean))).sort();
      const oldest = dates[0] || Utils.todayInput();
      const latest = dates[dates.length - 1] || Utils.todayInput();
      const currentWeekStart = UI.weekStartInput(Utils.todayInput()) || Utils.todayInput();
      const start = UI.weekStartInput(UI.state.ui.trainingLogStart || currentWeekStart) || currentWeekStart;
      const end = Utils.addDays(start, 6);
      const rows = scoped.filter((row) => row.date >= start && row.date <= end).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.playerName).localeCompare(String(b.playerName)));
      return { rows, start, end, oldest, latest, years: UI.trainingLogYears(logs), scoped, currentWeekStart };
    },

    trainingLogNav() {
      const logs = UI.visibleTrainingLogRows();
      if (!logs.length) return '';
      const range = UI.trainingLogWindow();
      const year = UI.state.ui.trainingLogYear || 'all';
      const labels = ['All years'].concat(range.years.map((item) => String(item)));
      const width = Math.max.apply(null, labels.map((label) => label.length)) + 4;
      const nextStart = Utils.addDays(range.start, 7);
      const nextEnd = Utils.addDays(range.end, 7);
      const nextDisabled = nextStart > range.currentWeekStart;
      return `<button class="pp-btn" type="button" data-action="training-log-oldest" title="Jump to oldest stored training week">Oldest</button><button class="pp-btn" type="button" data-action="training-log-prev" title="Previous week">&laquo;</button><span class="pp-pill pp-date-pill" title="${Utils.esc(Utils.dateShort(range.start))} - ${Utils.esc(Utils.dateShort(range.end))}">${Utils.esc(Utils.dateNoYear(range.start))} - ${Utils.esc(Utils.dateNoYear(range.end))}</span><button class="pp-btn" type="button" data-action="training-log-next" title="Next week" ${nextDisabled ? 'disabled' : ''}>&raquo;</button><button class="pp-btn" type="button" data-action="training-log-latest" title="Jump to latest stored training week">Latest</button><select class="pp-select pp-select-fit" style="--select-width:${width}ch" data-ui-field="trainingLogYear"><option value="all" ${year === 'all' ? 'selected' : ''}>All years</option>${range.years.map((item) => `<option value="${Utils.esc(item)}" ${String(year) === String(item) ? 'selected' : ''}>${Utils.esc(item)}</option>`).join('')}</select>`;
    },

    shiftTrainingLogWeek(days) {
      const range = UI.trainingLogWindow();
      if (days > 0) {
        const nextStart = Utils.addDays(range.start, days);
        if (nextStart > range.currentWeekStart) {
          UI.toast('Training log cannot advance into the future.');
          return;
        }
      }
      UI.state.ui.trainingLogStart = UI.weekStartInput(Utils.addDays(range.start, days)) || Utils.addDays(range.start, days);
      UI.saveRender();
    },

    jumpTrainingLog(where) {
      const range = UI.trainingLogWindow();
      if (!range.scoped.length) {
        UI.toast('No training rows are visible for the selected year.');
        return;
      }
      UI.state.ui.trainingLogStart = where === 'oldest' ? (UI.weekStartInput(range.oldest) || range.oldest) : range.currentWeekStart;
      UI.saveRender();
    },

    visibleTrainingLogRows() {
      return Array.isArray(UI.state.trainingLog) ? UI.state.trainingLog : [];
    },

    shiftDailyBalanceWeek(days) {
      const range = UI.dailyBalanceWindow();
      if (range.mode === 'all') return;
      const nextStart = Utils.addDays(range.start, days);
      if (days > 0 && nextStart > range.latestStart) {
        UI.toast('Balance cannot advance beyond the latest synced report week.');
        return;
      }
      UI.state.ui.dailyBalanceStart = nextStart;
      UI.saveRender();
    },

    rebuildDailyBalance() {
      UI.captureSettingsInputs(UI.currentRoot());
      const events = Timeline.accessEvents(UI.state.staff.timeline || [], UI.state);
      const dailyReports = events.filter((event) => event.type === 'daily_report').length;
      UI.state.analytics.weeks = Timeline.analyticsFromEvents(UI.state.staff.timeline || [], UI.state);
      UI.state.ui.dailyBalanceStart = '';
      const rows = UI.dailyBalanceRows().filter((row) => row.hasReport).length;
      UI.saveRender(dailyReports
        ? `Balance rebuilt from ${dailyReports} stored daily report${dailyReports === 1 ? '' : 's'} (${rows} row${rows === 1 ? '' : 's'}).`
        : 'No stored daily reports found. Use Sync reports to pull company news first.');
    },

    shiftGraph(step) {
      const slides = UI.graphSlides();
      const count = slides.length || 1;
      UI.state.ui.graphIndex = (Utils.int(UI.state.ui.graphIndex, 0) + step + count) % count;
      UI.saveRender();
    },

    peoplePage(kind) {
      const state = UI.state;
      const isDirector = kind === 'directors';
      const activeSubtab = isDirector ? state.ui.directorTab : state.ui.staffTab;
      const current = isDirector ? state.staff.directorsCurrent : state.staff.current;
      const past = isDirector ? state.staff.directorsPast : state.staff.past;
      const rows = activeSubtab === 'past' ? past : current;
      const card = isDirector
        ? (UI.state.ui.editDirectorKey ? UI.directorCard(UI.findDirectorByKey(UI.state.ui.editDirectorKey)) : '')
        : (UI.state.ui.editPersonKey ? UI.personCard(UI.findPersonByKey(UI.state.ui.editPersonKey)) : '');
      return `
        <div class="pp-grid">
          <section class="pp-panel" data-tour="${isDirector ? 'directors-container' : 'staff-container'}">
            <div class="pp-head">
              <div>
                <h2>${isDirector ? 'Directors' : 'Staff'}</h2>
                <p>${isDirector ? 'Current and past director timeline.' : 'Current and past staff, with role and contract colours.'}</p>
              </div>
              ${isDirector ? '' : ''}
            </div>
            <div class="pp-content">
              <div class="pp-subtabs">
                <button type="button" class="pp-subtab ${activeSubtab === 'current' ? 'is-active' : ''}" data-subtab="${isDirector ? 'director' : 'staff'}:current">Current</button>
                <button type="button" class="pp-subtab ${activeSubtab === 'past' ? 'is-active' : ''}" data-subtab="${isDirector ? 'director' : 'staff'}:past">Past</button>
              </div>
              ${UI.peopleTable(rows, isDirector, activeSubtab)}
            </div>
          </section>
        </div>${card}`;
    },

    peopleTable(rows, isDirector, activeSubtab) {
      if (!rows.length) return '<div class="pp-empty">No one here yet. Sync employees or company news and this will fill in.</div>';
      const tableId = `${isDirector ? 'directors' : 'staff'}-${activeSubtab || 'current'}`;
      const isPastStaff = !isDirector && activeSubtab === 'past';
      const counterContext = isDirector ? null : UI.staffCounterContext();
      const countersFor = (person) => UI.staffTrainCounters(person, counterContext);
      const sorted = UI.sortedRows(tableId, rows, {
        name: (person) => String(person.name || '').toLowerCase(),
        role: (person) => String(person.role || '').toLowerCase(),
        suggested: isDirector ? () => '' : (person) => String((UI.suggestedRole(person) || {}).label || '').toLowerCase(),
        suggestedWage: isDirector || isPastStaff ? () => 0 : (person) => Wages.breakdown(person, UI.state).suggested,
        contract: (person) => String(person.contractType || '').toLowerCase(),
        str: isDirector ? () => 0 : (person) => countersFor(person).str,
        ptr: isDirector ? () => 0 : (person) => countersFor(person).ptr,
        pt: isDirector ? () => 0 : (person) => countersFor(person).pt,
        dates: (person) => Utils.dateTimestamp(person.hiredAt || person.startedAt || person.endedAt || person.leftAt || 0),
        days: (person) => isDirector ? UI.directorTenureDays(person) : UI.personTenureDays(person),
        source: (person) => String(person.source || '').toLowerCase(),
        lastAction: (person) => Utils.int(person.lastActionTimestamp, 0)
      }, 'name', 'asc');
      return `<div class="pp-wrap ${activeSubtab === 'past' && !isDirector ? 'pp-past-scroll' : ''}"><table class="pp-table pp-people-table">
        <thead><tr><th>#</th><th>${UI.tableSortHeader(tableId, 'name', 'Name')}</th><th>${UI.tableSortHeader(tableId, 'role', 'Role')}</th>${isDirector ? `<th>${UI.tableSortHeader(tableId, 'dates', 'Dates')}</th><th>${UI.tableSortHeader(tableId, 'days', 'Days')}</th><th>${UI.tableSortHeader(tableId, 'source', 'Source')}</th><th>Edit</th>` : `${isPastStaff ? '' : `<th>${UI.tableSortHeader(tableId, 'suggested', 'Suggested')}</th><th>${UI.tableSortHeader(tableId, 'contract', 'Contract')}</th><th>${UI.tableSortHeader(tableId, 'suggestedWage', 'Suggested wage')}</th>`}<th title="Sponsored Trains Received">${UI.tableSortHeader(tableId, 'str', 'STR')}</th><th title="Paid Trains Received">${UI.tableSortHeader(tableId, 'ptr', 'PTR')}</th><th title="Paid Trains">${UI.tableSortHeader(tableId, 'pt', 'PT')}</th><th>${UI.tableSortHeader(tableId, 'dates', 'Dates')}</th><th>${UI.tableSortHeader(tableId, 'days', 'Days')}</th>${isPastStaff ? '' : `<th>${UI.tableSortHeader(tableId, 'lastAction', 'Last action')}</th>`}<th>Edit</th>`}</tr></thead>
        <tbody>${sorted.map((person, index) => {
          const roleName = isDirector ? (person.role || 'Director') : (person.role || 'Employee');
          const roleColor = UI.roleColor(roleName);
          const contractColor = UI.contractColor(person.contractType);
          const counters = isDirector ? null : countersFor(person);
          const wageBreakdown = isDirector || isPastStaff ? null : Wages.breakdown(person, UI.state);
          const personKey = UI.personRowKey(person);
          return `<tr>
            <td>${index + 1}</td>
            <td>${Utils.esc(person.name)}</td>
            <td><span class="pp-pill" style="--pill-color:${roleColor}">${Utils.esc(UI.roleLabel(roleName))}</span></td>
            ${isDirector ? `
            <td>${UI.directorDates(person)}</td>
            <td>${Utils.esc(UI.directorTenureDays(person) || '')}</td>
            <td>${Utils.esc(person.source || '')}</td>
            <td><button class="pp-btn" type="button" data-action="edit-director" data-director-key="${Utils.esc(personKey)}">Edit</button></td>` : `${isPastStaff ? '' : `<td>${UI.suggestedRolePill(person)}</td><td><span class="pp-pill" style="--pill-color:${contractColor}">${Utils.esc(UI.contractLabel(person.contractType))}</span></td><td>${UI.personSuggestedWageView(wageBreakdown)}</td>`}
            <td title="Sponsored Trains Received">${counters.str}</td>
            <td title="Paid Trains Received">${counters.ptr}</td>
            <td title="Paid Trains">${counters.pt}</td>
            <td>${UI.personDates(person)}</td>
            <td>${Utils.esc(UI.personTenureDays(person) || '')}</td>
            ${isPastStaff ? '' : `<td>${Utils.esc(person.lastAction || '')}</td>`}
            <td><button class="pp-btn" type="button" data-action="edit-person" data-person-key="${Utils.esc(personKey)}">Edit</button></td>`}
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
    },

    contractLabel(contractType) {
      return contractType || 'Select Contract';
    },
    contractColor(contractType) {
      const colors = UI.state.settings.colors;
      if (contractType === 'sponsored') return colors.sponsored;
      if (contractType === 'paid') return colors.paid;
      if (contractType === 'terminated') return colors.unpaid;
      return colors.roleDefault;
    },
    personRowKey(person) {
      return String(person && (person.id || person.name) || '').toLowerCase();
    },
    findPersonByKey(key) {
      const needle = String(key || '').toLowerCase();
      return UI.state.staff.current.concat(UI.state.staff.past).find((person) => UI.personRowKey(person) === needle) || null;
    },
    findDirectorByKey(key) {
      const needle = String(key || '').toLowerCase();
      return (UI.state.staff.directorsCurrent || []).concat(UI.state.staff.directorsPast || []).find((person) => UI.personRowKey(person) === needle) || null;
    },
    updateProfileEmployeeByKey(key, updates) {
      const needle = String(key || '').toLowerCase();
      const list = UI.state.company && UI.state.company.profile ? (UI.state.company.profile.employees || []) : [];
      const index = list.findIndex((person) => UI.personRowKey(person) === needle);
      if (index >= 0) list[index] = Object.assign({}, list[index], updates, { updatedAt: Utils.nowIso() });
    },
    updatePersonByKey(key, updates) {
      ['current', 'past'].forEach((listName) => {
        const list = UI.state.staff[listName] || [];
        const index = list.findIndex((person) => UI.personRowKey(person) === String(key || '').toLowerCase());
        if (index >= 0) list[index] = Object.assign({}, list[index], updates, { updatedAt: Utils.nowIso() });
      });
    },
    markPersonExEmployee(key) {
      const needle = String(key || '').toLowerCase();
      if (!needle) return;
      const index = (UI.state.staff.current || []).findIndex((person) => UI.personRowKey(person) === needle);
      if (index < 0) {
        UI.toast('That staff member is not in Current staff.');
        return;
      }
      const person = UI.state.staff.current[index];
      const leftAt = Math.floor(Date.now() / 1000);
      const moved = Object.assign({}, person, {
        role: 'Ex-Employee',
        status: 'past',
        leftAt,
        endedAt: person.endedAt || leftAt,
        exitType: person.exitType || 'left',
        roleHistory: UI.nextRoleHistory(person, 'Ex-Employee', person.hiredAt || person.joinedDate || UI.companyStartTimestamp()),
        source: person.source || 'manual edit',
        updatedAt: Utils.nowIso()
      });
      UI.state.staff.current.splice(index, 1);
      UI.state.company.profile.employees = (UI.state.company.profile.employees || []).filter((row) => UI.personRowKey(row) !== needle);
      UI.state.staff.past = Company.dedupePeople((UI.state.staff.past || []).filter((row) => UI.personRowKey(row) !== needle).concat([moved]));
      Company.dedupeStaff(UI.state);
      UI.recordStaffCardEdit(person, moved);
      UI.scheduleStaffCardCloudSave(50);
      UI.state.ui.staffTab = 'past';
      UI.state.ui.editPersonKey = UI.personRowKey(moved);
      Store.save(UI.state);
      UI.saveRender(`${moved.name || 'Staff member'} moved to Past staff as Ex-Employee.`);
    },
    isPastPerson(person) {
      if (!person) return false;
      const key = UI.personRowKey(person);
      return (UI.state.staff.past || []).some((row) => UI.personRowKey(row) === key);
    },
    isPastDirector(person) {
      if (!person) return false;
      const key = UI.personRowKey(person);
      return (UI.state.staff.directorsPast || []).some((row) => UI.personRowKey(row) === key);
    },
    directorMatchesPerson(event, person) {
      const id = String(person && person.id || '').trim();
      if (id && String(event && event.userId || '').trim() === id) return true;
      const names = new Set([person && person.name, person && person.playerName].concat(person && person.aliases || []).map((name) => Company.nameKey(name)).filter(Boolean));
      const eventName = Company.nameKey(event && event.playerName);
      if (eventName && names.has(eventName)) return true;
      return false;
    },
    directorPeriods(person) {
      if (!person) return [];
      const periods = [];
      let active = null;
      (UI.state.staff.timeline || [])
        .filter((event) => event && event.type === 'director')
        .slice()
        .sort((a, b) => Utils.int(a.timestamp, 0) - Utils.int(b.timestamp, 0))
        .forEach((event) => {
          const timestamp = Utils.int(event.timestamp, 0);
          if (!timestamp) return;
          const matches = UI.directorMatchesPerson(event, person);
          if (active && !matches) {
            active.end = timestamp;
            active.endEvent = event;
            periods.push(active);
            active = null;
          }
          if (matches) {
            if (active) {
              active.evidence.push(event);
              return;
            }
            active = { start: timestamp, end: '', startEvent: event, endEvent: null, evidence: [event] };
          }
        });
      if (active) periods.push(active);
      return periods;
    },
    directorStart(person) {
      const periods = UI.directorPeriods(person);
      const open = periods.filter((period) => !period.end).pop();
      const latest = periods[periods.length - 1];
      return (open || latest || {}).start || (person && (person.startedAt || person.hiredAt || person.joinedDate || ''));
    },
    directorEnd(person) {
      if (!person || !UI.isPastDirector(person)) return '';
      const periods = UI.directorPeriods(person);
      const latest = periods[periods.length - 1];
      return (latest && latest.end) || person.endedAt || person.leftAt || '';
    },
    directorDates(person) {
      const start = UI.directorStart(person);
      const end = UI.directorEnd(person);
      const parts = [];
      if (start) parts.push(`Started ${Utils.esc(Utils.dateShort(start))}`);
      if (end) parts.push(`Ended ${Utils.esc(Utils.dateShort(end))}`);
      return parts.length ? parts.join('<br>') : 'Not detected';
    },
    directorTenureDays(person) {
      const start = UI.directorStart(person);
      if (!start) return 0;
      const end = UI.directorEnd(person) || Math.floor(Date.now() / 1000);
      return Utils.daysBetween(start, end);
    },
    directorHistoryView(person) {
      const periods = UI.directorPeriods(person);
      const start = UI.directorStart(person);
      const end = UI.directorEnd(person);
      if (!periods.length && !start && !end) return '<div class="pp-empty">Director history will appear after company news sync finds a director change.</div>';
      const rows = [];
      (periods.length ? periods : [{ start, end }]).forEach((period) => {
        if (!period.start) return;
        const tenureEnd = period.end || Math.floor(Date.now() / 1000);
        rows.push(`<div><strong>Became director</strong><br><span class="pp-note">${Utils.esc(Utils.dateShort(period.start))} - Director for ${Utils.esc(UI.roleTenureLabel(period.start, tenureEnd))}${period.end ? `, to ${Utils.esc(Utils.dateShort(period.end))}` : ', to now'}</span></div>`);
        if (period.end) rows.push(`<div><strong>Director role ended</strong><br><span class="pp-note">${Utils.esc(Utils.dateShort(period.end))}${period.endEvent ? ` - ${Utils.esc(period.endEvent.playerName || 'New director assigned')}` : ''}</span></div>`);
      });
      return `<div class="pp-role-history">${rows.join('')}</div>`;
    },
    directorTimelineView(person) {
      const id = String(person && person.id || '').trim();
      const names = new Set([person && person.name, person && person.playerName].concat(person && person.aliases || []).map((name) => Company.nameKey(name)).filter(Boolean));
      const rows = (UI.state.staff.timeline || []).filter((event) => {
        if (!event || event.type !== 'director') return false;
        if (id && String(event.userId || '') === id) return true;
        const text = Company.nameKey(event.plainText || event.text || '');
        return names.has(Company.nameKey(event.playerName)) || Array.from(names).some((name) => name && text.includes(name));
      }).sort((a, b) => Utils.int(b.timestamp, 0) - Utils.int(a.timestamp, 0)).slice(0, 8);
      if (!rows.length) return '<div class="pp-empty">No matching director timeline event found yet.</div>';
      return `<div class="pp-role-history">${rows.map((event) => `<div><strong>${Utils.esc(UI.eventLabel(event))}</strong><br><span class="pp-note">${Utils.esc(Utils.dateShort(event.timestamp))} - ${Utils.esc(event.plainText || event.text || '')}</span></div>`).join('')}</div>`;
    },
    companyStartTimestamp() {
      return Utils.int(UI.state.company.newsSync.earliestTimestamp, 0);
    },
    personHireValue(person) {
      const stored = person && (person.hiredAt || person.joinedDate || person.startedAt || '');
      if (stored) return stored;
      const timelineHire = Timeline.personEventTimestamp(UI.state, person, ['hire'], 'first');
      if (timelineHire) return timelineHire;
      const apiDays = Utils.int(person && person.daysInCompany, 0);
      if (apiDays > 0 && !UI.isPastPerson(person)) {
        const inferredDate = Utils.addDays(Utils.todayInput(), -(apiDays - 1));
        return Utils.dateTimestamp(`${inferredDate}T12:00:00`);
      }
      return '';
    },
    personLeftValue(person) {
      const stored = person && (person.leftAt || person.endedAt || '');
      if (stored && !Company.hasStaleLeftDate(Object.assign({}, person, { leftAt: stored }))) return stored;
      return Timeline.personEventTimestamp(UI.state, person, ['left', 'fired'], 'last') || '';
    },
    personDates(person) {
      const hired = UI.personHireValue(person) || UI.companyStartTimestamp();
      const left = !UI.isPastPerson(person) ? '' : UI.personLeftValue(person);
      const parts = [];
      if (hired) parts.push(`Hired ${Utils.esc(Utils.dateShort(hired))}`);
      if (left) parts.push(`Left ${Utils.esc(Utils.dateShort(left))}`);
      if (!parts.length && person.startedAt) parts.push(`Started ${Utils.esc(Utils.dateShort(person.startedAt))}`);
      return parts.join('<br>');
    },
    personTenureDays(person) {
      const hired = UI.personHireValue(person) || UI.companyStartTimestamp();
      const isPast = UI.isPastPerson(person);
      const apiDays = Utils.int(person.daysInCompany, 0);
      const staleLeft = Company.hasStaleLeftDate(person);
      if (!isPast && apiDays && (!person.leftAt || staleLeft)) return apiDays;
      const left = !isPast ? Math.floor(Date.now() / 1000) : (UI.personLeftValue(person) || Math.floor(Date.now() / 1000));
      const days = Utils.daysBetween(hired, left);
      return days || apiDays;
    },
    personDateInput(name, value) {
      const canonical = Utils.dateInput(value);
      const text = canonical ? Utils.dateShort(canonical) : '';
      const placeholder = Utils.dateShort(new Date());
      return `<input class="pp-input" name="${Utils.esc(name)}" data-person-date value="${Utils.esc(text)}" placeholder="${Utils.esc(placeholder)}" title="Uses your Settings date format.">`;
    },
    readPersonDate(data, name, label, allowEmpty) {
      const raw = String(data.get(name) || '').trim();
      if (!raw && allowEmpty) return '';
      const value = Utils.dateInputFromText(raw, UI.state.settings);
      if (value || (!raw && allowEmpty)) return value;
      UI.toast(`${label} does not match your date format.`);
      return null;
    },
    roleTenureLabel(start, end) {
      const endValue = end || Math.floor(Date.now() / 1000);
      const days = Utils.daysBetween(start, endValue);
      const human = Utils.yearMonthAge(start, endValue);
      const dayText = `${days.toLocaleString()} day${days === 1 ? '' : 's'}`;
      return human && human !== 'Under 1 month' ? `${human} (${dayText})` : dayText;
    },
    normalisedRoleHistory(person, overrideRole, overrideStart) {
      const role = String(overrideRole || person.role || 'Employee').trim() || 'Employee';
      const start = Utils.dateInput(overrideStart || UI.personHireValue(person) || UI.companyStartTimestamp()) || Utils.todayInput();
      return Company.normalisedRoleHistory(person, role, start);
    },
    nextRoleHistory(person, nextRole, startDate) {
      const role = String(nextRole || 'Employee').trim() || 'Employee';
      const history = Company.roleHistoryWithChange(person, role, Utils.todayInput(), startDate);
      if (history.length) history[0].at = Utils.dateInput(startDate || history[0].at) || history[0].at;
      return history;
    },
    roleHistoryView(person) {
      const history = UI.normalisedRoleHistory(person);
      if (!history.length) return '<div class="pp-empty">Role history will appear after the card is saved.</div>';
      const isPast = UI.isPastPerson(person);
      const finalEnd = isPast ? (person.leftAt || Math.floor(Date.now() / 1000)) : Math.floor(Date.now() / 1000);
      const finalEndText = isPast && person.leftAt ? Utils.dateShort(person.leftAt) : 'now';
      const rows = history.map((entry, index) => {
        const next = history[index + 1];
        const end = next ? next.at : finalEnd;
        const endText = next ? Utils.dateShort(next.at) : finalEndText;
        const tenure = UI.roleTenureLabel(entry.at, end);
        const action = index === 0 ? `Hired, ${entry.role}` : `Role changed to ${entry.role}`;
        return `<div><strong>${Utils.esc(action)}</strong><br><span class="pp-note">${Utils.esc(Utils.dateShort(entry.at))} - ${Utils.esc(entry.role)} for ${Utils.esc(tenure)}${endText ? `, to ${Utils.esc(endText)}` : ''}</span></div>`;
      });
      return `<div class="pp-role-history">${rows.join('')}</div>`;
    },
    rankHistoryView(person) {
      const history = Array.isArray(person.rankHistory) ? person.rankHistory.slice().sort((a, b) => Utils.dateTimestamp(a.at) - Utils.dateTimestamp(b.at)) : [];
      if (!history.length) return '<div class="pp-empty">Rank history will appear after a staff log sync.</div>';
      const rows = history.map((entry) => {
        const previous = entry.previousRank ? `${Company.rankRoleLabel(entry.previousRank, UI.state)} [${entry.previousRank}]` : 'Not set';
        const next = `${Company.rankRoleLabel(entry.newRank, UI.state)} [${entry.newRank}]`;
        const evidence = entry.newRank && UI.state.settings.roleRankEvidence && UI.state.settings.roleRankEvidence[entry.newRank] ? UI.state.settings.roleRankEvidence[entry.newRank].source : '';
        return `<div><strong>${Utils.esc(previous)} &rarr; ${Utils.esc(next)}</strong><br><span class="pp-note">${Utils.esc(Utils.dateShort(entry.at))}${evidence ? ` - ${Utils.esc(evidence)}` : ''}</span></div>`;
      });
      return `<div class="pp-role-history">${rows.join('')}</div>`;
    },
    wageHistoryView(person) {
      const history = Array.isArray(person.wageHistory) ? person.wageHistory.slice().sort((a, b) => Utils.dateTimestamp(a.at) - Utils.dateTimestamp(b.at)) : [];
      if (!history.length) return '<div class="pp-empty">Wage history will appear after a staff log sync.</div>';
      const rows = history.map((entry) => `<div><strong>${Utils.money(entry.previousWage)} &rarr; ${Utils.money(entry.newWage)}</strong><br><span class="pp-note">${Utils.esc(Utils.dateShort(entry.at))}</span></div>`);
      return `<div class="pp-role-history">${rows.join('')}</div>`;
    },
    strikeHistoryView(person) {
      const history = Array.isArray(person && person.strikeHistory)
        ? person.strikeHistory.slice().sort((a, b) => Utils.dateTimestamp(b.at || b.date) - Utils.dateTimestamp(a.at || a.date))
        : [];
      if (!history.length) return '<div class="pp-empty">No addiction or inactivity strikes recorded yet.</div>';
      const labels = { addiction: 'Drug addiction strike', inactivity: 'Long inactivity strike' };
      const rows = history.map((entry) => {
        const value = entry.type === 'inactivity'
          ? `${Utils.formatNumber(entry.value || 0)}h`
          : Utils.formatNumber(entry.value || 0);
        const threshold = entry.type === 'inactivity'
          ? `${Utils.formatNumber(entry.threshold || 24)}h`
          : Utils.formatNumber(entry.threshold || 0);
        return `<div><strong>${Utils.esc(labels[entry.type] || 'Staff strike')}</strong><br><span class="pp-note">${Utils.esc(Utils.dateTime(entry.at || entry.date))} - value ${Utils.esc(value)}, threshold ${Utils.esc(threshold)}${entry.source ? ` - ${Utils.esc(entry.source)}` : ''}</span>${entry.note ? `<br><span class="pp-note">${Utils.esc(entry.note)}</span>` : ''}</div>`;
      });
      return `<div class="pp-role-history">${rows.join('')}</div>`;
    },
    strikeCounters(person) {
      return (Array.isArray(person && person.strikeHistory) ? person.strikeHistory : []).reduce((sum, entry) => {
        if (entry && entry.type === 'addiction') sum.addiction += 1;
        if (entry && entry.type === 'inactivity') sum.inactivity += 1;
        return sum;
      }, { addiction: 0, inactivity: 0 });
    },
    strikeCounterBadges(person) {
      const counters = UI.strikeCounters(person);
      return `<div class="pp-row-actions" title="Recorded threshold breaches, not current status."><span class="pp-pill pp-date-pill">Ad: ${Utils.esc(counters.addiction)}</span><span class="pp-pill pp-date-pill">In: ${Utils.esc(counters.inactivity)}</span></div>`;
    },
    personSaveLabel(isDirty) {
      return `\uD83D\uDCBE${isDirty ? ' *' : ''}`;
    },
    companySupportsRacingDetails() {
      const typeId = String(
        (UI.state && UI.state.company && UI.state.company.profile && UI.state.company.profile.typeId)
        || (UI.state && UI.state.settings && UI.state.settings.companyTypeId)
        || ''
      ).trim();
      return typeId === '4' || typeId === '30';
    },
    personCardControls(person, nav) {
      const racing = person && person.id && UI.companySupportsRacingDetails() ? `<button class="pp-btn" type="button" data-action="fetch-person-racing-skill" data-person-key="${Utils.esc(UI.personRowKey(person))}" title="One Torn API user/personalstats request for this staff member.">&#128073; &#127937;</button>` : '';
      const roleLog = person && person.id ? `<button class="pp-btn" type="button" data-action="sync-person-role-log" data-person-key="${Utils.esc(UI.personRowKey(person))}" title="One Torn API v2 user/log request for this staff member. Full/custom key required.">&#128260;&#128104;&#8205;&#128188;</button>` : '';
      const olderLog = person && person.id && person.roleLogNextUrl ? `<button class="pp-btn" type="button" data-action="sync-person-role-log-older" data-person-key="${Utils.esc(UI.personRowKey(person))}" title="Fetch the next older Torn API v2 user/log page for this staff member.">Older log</button>` : '';
      const fire = person && person.id && !UI.isPastPerson(person) ? `<button class="pp-btn is-danger" type="button" data-action="request-fire-person" data-person-key="${Utils.esc(UI.personRowKey(person))}" title="Confirm, then click Torn's loaded FIRE action for this employee.">Fire</button>` : '';
      const markEx = person && !UI.isPastPerson(person) ? `<button class="pp-btn is-danger" type="button" data-action="mark-person-ex" data-person-key="${Utils.esc(UI.personRowKey(person))}" title="Move this row to Past staff as Ex-Employee.">Mark Ex-Employee</button>` : '';
      return `<div class="pp-row-actions">${nav || ''}${racing}${roleLog}${olderLog}${fire}${markEx}<button class="pp-btn" type="button" data-action="close-person-card" data-person-key="${Utils.esc(UI.personRowKey(person))}" title="Close card">Close</button></div>`;
    },
    personIdTitleLink(person) {
      const id = String(person && person.id || '').trim();
      if (!id) return '';
      const url = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(id)}`;
      return ` <a class="pp-card-userid" href="${Utils.esc(url)}" target="_blank" rel="noopener noreferrer">[${Utils.esc(id)}]</a>`;
    },
    staffCounterContext() {
      const identityMaps = Company.identityMaps(UI.state);
      const ledgerByIdentity = new Map();
      const loggedByIdentity = new Map();
      const paidQueues = new Map();
      UI.state.ledger.forEach((entry) => {
        const identity = Company.resolveIdentity({ id: entry.playerId, name: entry.playerName }, UI.state, identityMaps);
        const totals = Ledger.totals(entry, UI.state.settings);
        const sum = ledgerByIdentity.get(identity) || { paidReceived: 0, sponsoredReceived: 0, pt: 0 };
        if (entry.contractType === 'sponsored') sum.sponsoredReceived += totals.usedTrains;
        else sum.paidReceived += totals.usedTrains;
        if (entry.contractType === 'paid') sum.pt += totals.totalTrains;
        ledgerByIdentity.set(identity, sum);
        if (entry.contractType === 'paid' && totals.usedTrains > 0) {
          const queue = paidQueues.get(identity) || [];
          queue.push({
            date: Utils.dateInput(entry.entryDate || entry.createdAt) || '',
            remaining: totals.usedTrains
          });
          paidQueues.set(identity, queue);
        }
      });
      paidQueues.forEach((queue) => queue.sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))));
      UI.visibleTrainingLogRows().slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || Utils.int(a.timestamp, 0) - Utils.int(b.timestamp, 0)).forEach((row) => {
        const identity = Company.resolveIdentity(row, UI.state, identityMaps);
        const sum = loggedByIdentity.get(identity) || { paidReceived: 0, sponsoredReceived: 0, unknownReceived: 0 };
        let count = Utils.int(row.count, 0);
        const rowDate = Utils.dateInput(row.date || row.timestamp || '');
        const queue = paidQueues.get(identity) || [];
        for (const item of queue) {
          if (count <= 0) break;
          if (item.remaining <= 0) continue;
          if (item.date && rowDate && rowDate < item.date) continue;
          const paid = Math.min(count, item.remaining);
          sum.paidReceived += paid;
          item.remaining -= paid;
          count -= paid;
        }
        if (count > 0) {
          if (row.contractType === 'paid') sum.paidReceived += count;
          else if (row.contractType === 'sponsored') sum.sponsoredReceived += count;
          else sum.unknownReceived += count;
        }
        loggedByIdentity.set(identity, sum);
      });
      return { identityMaps, ledgerByIdentity, loggedByIdentity };
    },
    staffTrainCounters(person, context) {
      const counterContext = context || UI.staffCounterContext();
      const identity = Company.resolveIdentity(person, UI.state, counterContext.identityMaps);
      const stored = counterContext.ledgerByIdentity.get(identity) || {};
      const logged = counterContext.loggedByIdentity.get(identity) || {};
      const sum = {
        str: Math.max(Utils.int(stored.sponsoredReceived, 0), Utils.int(logged.sponsoredReceived, 0)),
        ptr: Math.max(Utils.int(stored.paidReceived, 0), Utils.int(logged.paidReceived, 0)),
        pt: Utils.int(stored.pt, 0)
      };
      const unknown = Utils.int(logged.unknownReceived, 0);
      if (unknown) {
        if (person.contractType === 'sponsored') sum.str = Math.max(sum.str, unknown);
        else sum.ptr = Math.max(sum.ptr, unknown);
      }
      return sum;
    },
    personMerits(person) {
      const candidates = [person];
      const id = String(person && person.id || '').trim();
      const nameKey = Company.nameKey(person && (person.name || person.playerName));
      (UI.state.company.profile.employees || []).forEach((row) => {
        const rowId = String(row && row.id || '').trim();
        const rowName = Company.nameKey(row && (row.name || row.playerName));
        const aliasMatch = (row.aliases || []).some((alias) => Company.nameKey(alias) === nameKey);
        if ((id && rowId === id) || (nameKey && (rowName === nameKey || aliasMatch))) candidates.push(row);
      });
      const values = [];
      candidates.forEach((row) => {
        if (!row) return;
        if (row.merits !== undefined && row.merits !== null && row.merits !== '') values.push(Utils.int(row.merits, 0));
        const details = row.effectiveness && row.effectiveness.details ? row.effectiveness.details : {};
        if (details.merits !== undefined && details.merits !== null && details.merits !== '') values.push(Utils.int(details.merits, 0));
        if (row.effectiveness && row.effectiveness.merits !== undefined) values.push(Utils.int(row.effectiveness.merits, 0));
      });
      return Utils.clamp(values.length ? Math.max.apply(null, values) : 0, 0, 10);
    },
    personWageMarkup(breakdown) {
      if (!breakdown) return '<span class="pp-note">Need synced stats</span>';
      const liveText = breakdown.actualKnown
        ? (breakdown.delta === 0
          ? `Live ${Utils.money(breakdown.actual)} - Match`
          : `Live ${Utils.money(breakdown.actual)} - ${breakdown.delta > 0 ? '+' : '-'}${Utils.money(Math.abs(breakdown.delta))}`)
        : 'Live wage not synced';
      return `<span class="pp-readonly-value" title="${Utils.esc(Wages.tooltip(breakdown))}">${Utils.money(breakdown.suggested)}</span><span class="pp-readonly-sub">${Utils.esc(liveText)}</span>`;
    },
    personWageView(person) {
      return UI.personWageMarkup(Wages.breakdown(person, UI.state));
    },
    personSuggestedWageView(breakdown) {
      if (!breakdown) return '<span class="pp-note">Need synced stats</span>';
      return UI.personReadonlyValue(Utils.esc(Utils.money(breakdown.suggested)), Wages.tooltip(breakdown));
    },
    personWageStaticView(person) {
      const breakdown = Wages.breakdown(person, UI.state);
      return UI.personSuggestedWageView(breakdown);
    },
    personReadonlyValue(value, title) {
      const attrs = title ? ` title="${Utils.esc(title)}"` : '';
      return `<span class="pp-readonly-value"${attrs}>${value}</span>`;
    },
    personStatValue(value) {
      return UI.personReadonlyValue(Utils.esc(Utils.formatNumber(value || 0)));
    },
    personEfficiencyView(person, align) {
      const effectiveness = person && person.effectiveness ? person.effectiveness : null;
      const total = Utils.num(effectiveness && effectiveness.total, Utils.num(person && person.efficiency, 0));
      if (!total) return '<span class="pp-note">Not detected</span>';
      const tooltip = effectiveness ? UI.effectivenessTooltip(effectiveness) : '';
      const attrs = tooltip ? ` tabindex="0" data-tooltip-html="${Utils.esc(tooltip)}"` : '';
      const classes = `pp-effectiveness-tip${align === 'left' ? ' is-left' : ''}`;
      return `<span class="${classes}"${attrs}>${Utils.esc(total)}</span>`;
    },
    personRoleView(role) {
      const label = UI.roleLabel(role || 'Employee');
      const colour = UI.roleColor(label);
      return `<span class="pp-pill" style="--pill-color:${Utils.esc(colour)}">${Utils.esc(label)}</span>`;
    },
    personHireDateView(person) {
      const value = UI.personHireValue(person);
      return value ? UI.personReadonlyValue(Utils.esc(Utils.dateShort(value))) : '<span class="pp-note">Not detected</span>';
    },
    personRacingSkillView(person) {
      const value = String(person && person.racingSkill || '').trim();
      return value ? UI.personReadonlyValue(Utils.esc(value)) : '<span class="pp-note">Not fetched yet</span>';
    },
    detailIsOpen(detailKey, defaultOpen) {
      const states = UI.state && UI.state.ui ? (UI.state.ui.detailOpenState || {}) : {};
      if (!detailKey) return !!defaultOpen;
      if (Object.prototype.hasOwnProperty.call(states, detailKey)) return !!states[detailKey];
      return !!defaultOpen;
    },
    setDetailOpen(detailKey, isOpen) {
      if (!detailKey) return;
      UI.state.ui.detailOpenState = UI.state.ui.detailOpenState || {};
      UI.state.ui.detailOpenState[detailKey] = !!isOpen;
      Store.save(UI.state);
    },
    cardSection(detailKey, title, body, actions, defaultOpen) {
      const open = UI.detailIsOpen(detailKey, defaultOpen);
      return `<details class="pp-card-section" data-ui-detail-key="${Utils.esc(detailKey || '')}"${open ? ' open' : ''}><summary class="pp-card-section-head"><h4>${Utils.esc(title)}</h4>${actions ? `<div class="pp-card-header-actions">${actions}</div>` : ''}</summary><div class="pp-card-section-body">${body}</div></details>`;
    },
    cardHistoryBlock(detailKey, title, body, defaultOpen) {
      const open = UI.detailIsOpen(detailKey, defaultOpen);
      return `<details class="pp-history-item" data-ui-detail-key="${Utils.esc(detailKey || '')}"${open ? ' open' : ''}><summary>${Utils.esc(title)}</summary><div class="pp-history-body">${body}</div></details>`;
    },
    refreshPersonCardWagePreview(form) {
      if (!form) return;
      const target = form.querySelector('[data-person-wage]');
      if (!target) return;
      const personKey = form.dataset.personKey || '';
      const person = UI.findPersonByKey(personKey) || {};
      const employee = Wages.resolvedEmployee(person, UI.state);
      const data = new FormData(form);
      if (data.has('man')) employee.man = Utils.num(data.get('man'), employee.man);
      if (data.has('int')) employee.int = Utils.num(data.get('int'), employee.int);
      if (data.has('end')) employee.end = Utils.num(data.get('end'), employee.end);
      if (data.has('merits')) employee.merits = Utils.clamp(Utils.int(data.get('merits'), employee.merits), 0, 10);
      target.innerHTML = UI.personWageMarkup(Object.assign(
        Wages.breakdownForEmployee(employee, UI.state.settings),
        {
          actualKnown: !!employee.wageFromApi,
          actual: employee.wageFromApi ? Utils.num(employee.wage, 0) : 0,
          delta: employee.wageFromApi ? (Wages.estimate(employee, UI.state.settings) - Utils.num(employee.wage, 0)) : null
        }
      ));
    },
    currentStaffNav(person) {
      const rows = (UI.state.staff.current || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      const index = rows.findIndex((row) => UI.personRowKey(row) === UI.personRowKey(person));
      if (index < 0 || rows.length < 2) return '';
      const previous = rows[(index - 1 + rows.length) % rows.length];
      const next = rows[(index + 1) % rows.length];
      return `<button class="pp-btn" type="button" data-action="nav-person" data-person-key="${Utils.esc(UI.personRowKey(previous))}" title="Previous staff member">&laquo;</button><span class="pp-card-count">${index + 1} / ${rows.length}</span><button class="pp-btn" type="button" data-action="nav-person" data-person-key="${Utils.esc(UI.personRowKey(next))}" title="Next staff member">&raquo;</button>`;
    },
    personCard(person) {
      if (!person) return '<div class="pp-empty" style="margin-top:12px">Choose a staff member to edit.</div>';
      const isPast = UI.isPastPerson(person);
      return `<div class="pp-modal-backdrop" data-modal-backdrop>
        <section class="pp-panel pp-member-card pp-modal-card" data-modal-card>
          ${isPast ? UI.pastPersonCard(person) : UI.currentPersonCard(person)}
        </section>
      </div>`;
    },
    directorCard(person) {
      if (!person) return '<div class="pp-empty" style="margin-top:12px">Choose a director to inspect.</div>';
      const status = UI.isPastDirector(person) ? 'Past director' : 'Current director';
      const userIdLabel = UI.personIdTitleLink(person);
      const aliases = (person.aliases || []).filter((alias) => alias && alias !== person.name).join(', ');
      return `<div class="pp-modal-backdrop" data-modal-backdrop>
        <section class="pp-panel pp-member-card pp-modal-card" data-modal-card>
          <div class="pp-head">
            <div>
              <h3>${Utils.esc(person.name || 'Director')}${userIdLabel} director card</h3>
              <p>Director tenure and source details from company profile/news.</p>
            </div>
            <div class="pp-row-actions">
              <button class="pp-btn" type="button" data-action="close-director-card">Close</button>
            </div>
          </div>
          <div class="pp-content">
            ${UI.kv('Status', Utils.esc(status))}
            ${UI.kv('Dates', UI.directorDates(person))}
            ${UI.kv('Tenure', UI.directorTenureDays(person) ? `${Utils.esc(UI.directorTenureDays(person).toLocaleString())} day${UI.directorTenureDays(person) === 1 ? '' : 's'}` : 'Not detected')}
            ${UI.kv('Source', Utils.esc(person.source || 'Not detected'))}
            ${UI.kv('Known aliases', Utils.esc(aliases || 'None'))}
            <div class="pp-form" style="margin-top:10px">${UI.field('Director history', UI.directorHistoryView(person), 'span-3')}${UI.field('Timeline evidence', UI.directorTimelineView(person), 'span-3')}</div>
          </div>
        </section>
      </div>`;
    },
    currentPersonCard(person) {
      const interested = person.interestedIn || 'training';
      const userIdLabel = UI.personIdTitleLink(person);
      const showRacingDetails = UI.companySupportsRacingDetails();
      const workingStats = `<div class="pp-form">
            ${UI.field('Manual labor', UI.personStatValue(person.man), 'span-2')}
            ${UI.field('Intelligence', UI.personStatValue(person.int), 'span-2')}
            ${UI.field('Endurance', UI.personStatValue(person.end), 'span-2')}
            ${UI.field('Employee Efficiency', UI.personEfficiencyView(person, 'left'), 'span-2')}
            ${UI.field('Current position', UI.personRoleView(person.role || 'Employee'), 'span-2')}
            ${UI.field('Suggested role', UI.suggestedRolePill(person), 'span-2')}
            ${UI.field('Merits', UI.personReadonlyValue(Utils.esc(UI.personMerits(person)), 'Used by ledger discount autofill.'), 'span-2')}
          </div>`;
      const employmentInfo = `<div class="pp-form">
            ${UI.field('Hire date', UI.personHireDateView(person), 'span-2')}
            ${UI.field('Suggested wage', UI.personWageStaticView(person), 'span-2')}
            ${UI.field('Get', `<select class="pp-select" name="interestedIn" data-interest-select><option value="racing_perks" ${interested === 'racing_perks' ? 'selected' : ''}>Racing perks</option><option value="training" ${interested === 'training' ? 'selected' : ''}>Get training</option><option value="paid" ${interested === 'paid' ? 'selected' : ''}>Get Paid</option><option value="other" ${interested === 'other' ? 'selected' : ''}>Other</option></select>`, 'span-2')}
          </div>`;
      const racingDetails = `<div class="pp-form">
            ${UI.field('Racing Rank', `<select class="pp-select" name="racingRank">${['', 'A', 'B', 'C', 'D', 'E'].map((rank) => `<option value="${rank}" ${person.racingRank === rank ? 'selected' : ''}>${rank || 'Not set'}</option>`).join('')}</select>`, 'span-2')}
            ${UI.field('Racing Skill', UI.personRacingSkillView(person), 'span-2')}
          </div>`;
      const goals = `<div class="pp-form">
            ${UI.field('Where do you see yourself in a year?', `<textarea class="pp-textarea" name="oneYearGoal">${Utils.esc(person.oneYearGoal || '')}</textarea>`, 'span-6')}
            <label class="pp-field span-6"><span>Purchasing training?</span><span class="pp-range-row"><span>1</span><input type="range" name="trainingInterest" min="1" max="5" step="1" value="${Utils.esc(person.trainingInterest || 3)}"><span>5</span></span></label>
          </div>`;
      const history = `<div class="pp-history-stack">
            ${UI.cardHistoryBlock('current-card:history:role-history', 'Role history', UI.roleHistoryView(person))}
            ${UI.cardHistoryBlock('current-card:history:company-position-history', 'Company position history', UI.rankHistoryView(person))}
            ${UI.cardHistoryBlock('current-card:history:wage-history', 'Wage history', UI.wageHistoryView(person))}
            ${UI.cardHistoryBlock('current-card:history:risk-strikes', 'Risk strikes', UI.strikeHistoryView(person))}
          </div>`;
      return `
        <div class="pp-head">
          <div>
            <h3>${Utils.esc(person.name)}${userIdLabel} card</h3>
            <p>Work notes and preferences for this member.</p>
          </div>
          ${UI.personCardControls(person, UI.currentStaffNav(person))}
        </div>
        <div class="pp-content">
          <form data-person-card data-person-card-type="current" data-person-key="${Utils.esc(UI.personRowKey(person))}" data-dirty="0" class="pp-card-form">
            <div class="pp-form">
              ${UI.field('Contract type', `<select class="pp-select" name="contractType"><option value="" ${!person.contractType ? 'selected' : ''}>Select Contract</option><option value="paid" ${person.contractType === 'paid' ? 'selected' : ''}>Paid Trains</option><option value="sponsored" ${person.contractType === 'sponsored' ? 'selected' : ''}>Sponsored Trains</option></select>`, 'span-2')}
              ${UI.field('Strikes', UI.strikeCounterBadges(person), 'span-2')}
            </div>
            ${UI.cardSection('current-card:working-stats', 'Working stats', workingStats)}
            ${UI.cardSection('current-card:employment-information', 'Employment information', employmentInfo)}
            ${showRacingDetails ? UI.cardSection('current-card:racing-details', 'Racing details', racingDetails) : ''}
            ${UI.cardSection('current-card:goals', 'Goals', goals)}
            ${UI.cardSection('current-card:history', 'History', history)}
          </form>
        </div>`;
    },
    pastPersonCard(person) {
      const userIdLabel = UI.personIdTitleLink(person);
      const aliases = (person.aliases || []).filter((alias) => alias && alias !== person.name).join(', ');
      return `
        <div class="pp-head">
          <div>
            <h3>${Utils.esc(person.name)}${userIdLabel} past employee card</h3>
            <p>Quick edits for exit details, plus employment and training history.</p>
          </div>${UI.personCardControls(person, '')}</div>
        <div class="pp-content">
          <form data-person-card data-person-card-type="past" data-person-key="${Utils.esc(UI.personRowKey(person))}" data-dirty="0" class="pp-form">
            <div class="pp-form-title">Quick edits</div>
            ${UI.field('Contract type', `<select class="pp-select" name="contractType"><option value="paid" ${person.contractType === 'paid' ? 'selected' : ''}>Paid Trains</option><option value="sponsored" ${person.contractType === 'sponsored' ? 'selected' : ''}>Sponsored Trains</option><option value="terminated" ${person.contractType === 'terminated' ? 'selected' : ''}>Terminated</option></select>`, 'span-2')}
            ${UI.field('Current position', `<input class="pp-input" name="role" list="pp-role-list-past" value="${Utils.esc(person.role || 'Ex-Employee')}"><datalist id="pp-role-list-past">${UI.rolesList().map(([, label]) => `<option value="${Utils.esc(label)}"></option>`).join('')}</datalist>`, 'span-2')}
            ${UI.field('Hired date', UI.personDateInput('hiredDate', UI.personHireValue(person) || UI.companyStartTimestamp()), 'span-2')}
            ${UI.field('Left date', UI.personDateInput('leftDate', UI.personLeftValue(person)), 'span-2')}
            ${UI.field('Tenure days', `<input class="pp-input" value="${Utils.esc(UI.personTenureDays(person) || '')}" disabled>`)}
            ${UI.field('Merits', `<input class="pp-input" name="merits" inputmode="numeric" min="0" max="10" value="${Utils.esc(UI.personMerits(person))}" title="Used by ledger discount autofill.">`)}
            ${UI.field('Exit type', `<input class="pp-input" name="exitType" value="${Utils.esc(person.exitType || '')}">`)}
            ${UI.field('Source', `<input class="pp-input" value="${Utils.esc(person.source || 'Not detected')}" disabled>`, 'span-2')}
            ${UI.field('Known aliases', `<input class="pp-input" value="${Utils.esc(aliases || 'None')}" disabled>`, 'span-3')}
            <div class="pp-form-title">Training snapshot</div>
            ${UI.field('Training totals', `<div class="pp-statline">${(() => { const counters = UI.staffTrainCounters(person); return UI.stat('STR', counters.str) + UI.stat('PTR', counters.ptr) + UI.stat('PT', counters.pt); })()}</div>`, 'span-6')}
            <div class="pp-form-title">History</div>
            ${UI.field('Role history', UI.roleHistoryView(person), 'span-6')}
            ${UI.field('Company rank history', UI.rankHistoryView(person), 'span-3')}
            ${UI.field('Wage history', UI.wageHistoryView(person), 'span-3')}
            ${UI.field('Risk strikes', UI.strikeHistoryView(person), 'span-6')}
          </form>
        </div>`;
    },

    staffSelect(name) {
      const staff = UI.state.staff.current || [];
      const attr = name ? ` name="${Utils.esc(name)}"` : '';
      if (!staff.length) return `<select class="pp-select" data-staff-picker${attr}><option value="">No staff synced yet</option></select>`;
      return `<select class="pp-select" data-staff-picker${attr} required><option value="">Choose staff member</option>${staff.map((person) => {
        const color = UI.contractColor(person.contractType);
        const merits = UI.personMerits(person);
        return `<option value="${Utils.esc(person.name)}" data-id="${Utils.esc(person.id || '')}" data-contract="${Utils.esc(person.contractType || '')}" data-merits="${Utils.esc(merits)}" style="color:${Utils.esc(color)}">${Utils.esc(person.name)} (${Utils.esc(UI.contractLabel(person.contractType))})</option>`;
      }).join('')}</select>`;
    },

    staffLookupRows() {
      return Company.dedupePeople((UI.state.staff.current || []).concat(UI.state.staff.past || []).concat(UI.state.company && UI.state.company.profile ? (UI.state.company.profile.employees || []) : []))
        .filter((person) => person && (person.name || person.id))
        .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
    },

    staffNameDatalist(id) {
      const rows = UI.staffLookupRows();
      if (!rows.length) return '';
      return `<datalist id="${Utils.esc(id)}">${rows.map((person) => {
        const meta = [person.id ? `[${person.id}]` : '', person.role || ''].filter(Boolean).join(' ');
        return `<option value="${Utils.esc(person.name || person.id)}">${Utils.esc(meta)}</option>`;
      }).join('')}</datalist>`;
    },

    resolveStaffReference(value) {
      const clean = String(value || '').trim();
      if (!clean) return null;
      const key = Company.nameKey(clean);
      const identityMaps = Company.identityMaps(UI.state);
      const identity = Company.resolveIdentity({ name: clean }, UI.state, identityMaps);
      return UI.staffLookupRows().find((person) => {
        if (String(person.id || '').trim() === clean) return true;
        if (Company.nameKey(person.name) === key || Company.nameKey(person.playerName) === key) return true;
        if ((person.aliases || []).some((alias) => Company.nameKey(alias) === key)) return true;
        return Company.resolveIdentity(person, UI.state, identityMaps) === identity;
      }) || null;
    },

    linkLedgerEntryToStaff(entry, input) {
      if (!entry) return null;
      const match = UI.resolveStaffReference(entry.playerName);
      if (!match || !match.id) return null;
      entry.playerId = String(match.id);
      if (match.name) entry.playerName = match.name;
      if (input && match.name) {
        input.value = match.name;
        input.title = `Linked Torn ID: ${match.id}`;
      }
      return match;
    },

    applyLedgerStaffSelection(form, value, option) {
      if (!form) return null;
      const playerName = form.querySelector('[name="playerName"]');
      const playerId = form.querySelector('[name="playerId"]');
      const meritsInput = form.querySelector('[name="merits"]');
      const contract = form.querySelector('[name="contractType"]');
      const staffName = String(value || (playerName && playerName.value) || '').trim();
      if (!staffName && !(option && option.dataset.id)) return null;
      const match = UI.resolveStaffReference(option && option.dataset.id ? option.dataset.id : '') || UI.resolveStaffReference(staffName);
      if (!match) return null;
      const merits = UI.personMerits(match);
      if (playerName && match.name) playerName.value = match.name;
      if (playerId) playerId.value = match.id || (option && option.dataset.id) || '';
      if (meritsInput) {
        meritsInput.value = String(merits);
        meritsInput.title = 'Merits pulled from synced staff/profile effectiveness.';
      }
      if (contract && (match.contractType || (option && option.dataset.contract))) contract.value = match.contractType || option.dataset.contract;
      return match;
    },

    settingsPage() {
      const state = UI.state;
      const apiMissing = UI.apiKeyMissing();
      const adminNote = BUILD_CONFIG.enabled && BUILD_CONFIG.buildName
        ? `<p class="pp-note">Build constants are active${BUILD_CONFIG.lockSupportLinks ? ' and support links are locked to the build defaults' : ''}.</p>`
        : '';
      return `
        <div class="pp-grid">
          <section class="pp-panel" data-tour="identity-settings">
            <div class="pp-head">
              <div>
                <h2>Identity</h2>
                <p>Local identity, API key handling, date format, and display theme.</p>
              </div>
            </div>
            <div class="pp-content">
              <form data-settings-form class="pp-form pp-identity-settings">
                ${UI.field('Torn API key (Minimal/Full)', UI.apiKeyControl(), `span-3 pp-compact-field${apiMissing ? ' pp-api-key-missing' : ''}`)}
              ${UI.field('Key access', UI.keyInfoStatus(), 'span-3')}
              ${UI.field('Sync center', UI.syncControlPanel(), 'span-6')}
                ${UI.field('User ID', `<input class="pp-input" name="userId" inputmode="numeric" value="${Utils.esc(state.settings.userId)}" disabled title="Auto-filled from Torn key info.">`)}
                ${UI.field('Username', `<input class="pp-input" name="userName" value="${Utils.esc(state.settings.userName)}">`)}
                ${UI.field('Company ID', `<input class="pp-input" name="companyId" inputmode="numeric" value="${Utils.esc(state.settings.companyId)}" disabled title="Auto-filled from Torn key info or Business Profile sync.">`)}
                ${UI.field('Company type', UI.companyTypeSelect(), 'span-2 pp-compact-field')}
                ${UI.field('Theme', UI.themeSelect(state.settings.theme), 'span-2 pp-compact-field pp-align-top')}
                ${UI.dateFormatField()}
              </form>
              ${adminNote}
            </div>
          </section>
          ${UI.trainingSetupSettingsPanel()}
          ${UI.discountRulesSettingsPanel()}
          ${UI.notificationSettingsPanel()}
          ${UI.roleManagementPanel()}
        </div>`;
    },

    themePage() {
      return `<div class="pp-grid">${UI.themeEditorPanel()}</div>`;
    },

    trainingSetupSettingsPanel() {
      const state = UI.state;
      return `<section class="pp-panel" data-tour="training-setup">
        <div class="pp-head">
          <div>
            <h3>Training setup</h3>
            <p>Detected train supply and paid queue limits.</p>
          </div>
        </div>
        <div class="pp-content">
          <form data-settings-form class="pp-form">
            ${UI.field('Price / train', `<input class="pp-input" name="trainingPrice" inputmode="numeric" value="${Utils.esc(state.settings.trainingPrice)}">`)}
            ${UI.field('Company rating', `<input class="pp-input" name="companyStars" inputmode="numeric" min="1" max="10" value="${Utils.esc(state.settings.companyStars)}" disabled>`)}
            ${UI.field('Trainings / day', `<input class="pp-input" value="${Utils.esc(Planner.dailySupply(state.settings))}" disabled>`)}
            ${UI.field('Paid cap / day', UI.paidCapSelect(state.settings), 'pp-compact-field')}
            <label class="pp-field"><span class="pp-note">Trainer role</span><span><input type="checkbox" name="trainerAutoDetect" ${state.settings.trainerAutoDetect !== false ? 'checked' : ''}> Auto-Detect</span></label>
            <div class="pp-field span-6"><span class="pp-note">Detected setup: company rating comes from profile sync and Trainer comes from staff sync when Auto-Detect is enabled. Current trainer bonus: ${state.settings.trainerAssigned ? 'yes' : 'no'}.</span></div>
            <div class="pp-form-title">Auto mode priority</div>
            <label class="pp-field"><span class="pp-note">Addiction penalty</span><span><input type="checkbox" name="plannerAddictionEnabled" ${state.settings.plannerPriority && state.settings.plannerPriority.addictionEnabled !== false ? 'checked' : ''}> Enabled</span></label>
            ${UI.field('Addiction weight', `<input class="pp-input" name="plannerAddictionWeight" inputmode="decimal" value="${Utils.esc(state.settings.plannerPriority && state.settings.plannerPriority.addictionWeight || 1)}">`, 'pp-compact-field')}
            <label class="pp-field"><span class="pp-note">Inactivity penalty</span><span><input type="checkbox" name="plannerInactivityEnabled" ${state.settings.plannerPriority && state.settings.plannerPriority.inactivityEnabled !== false ? 'checked' : ''}> Enabled</span></label>
            ${UI.field('Inactivity weight', `<input class="pp-input" name="plannerInactivityWeight" inputmode="decimal" value="${Utils.esc(state.settings.plannerPriority && state.settings.plannerPriority.inactivityWeight || 1)}">`, 'pp-compact-field')}
            <div class="pp-field span-6"><span class="pp-note">Auto mode fills paid orders first, then ranks sponsored/free capacity by role-stat gaps or lowest total working stats. Addiction and inactivity can still lower priority.</span></div>
          </form>
        </div>
      </section>`;
    },

    discountRulesSettingsPanel() {
      const state = UI.state;
      return `<section class="pp-panel" data-tour="discount-rules">
        <div class="pp-head">
          <div>
            <h3>Discount rules</h3>
            <p>Training-order discount logic and the message trigger used for log imports.</p>
          </div>
        </div>
        <div class="pp-content">
          <form data-settings-form class="pp-form">
            <label class="pp-field span-2"><span class="pp-note">Discount rules</span><span><input type="checkbox" name="discountsEnabled" ${state.settings.discountsEnabled !== false ? 'checked' : ''}> Enabled</span></label>
            ${UI.field('Merit discount % / merit', `<input class="pp-input" name="meritDiscountRate" inputmode="decimal" value="${Utils.esc(state.settings.meritDiscountRate)}">`)}
            ${UI.field('Max merit discount %', `<input class="pp-input" name="maxMeritDiscount" inputmode="decimal" value="${Utils.esc(state.settings.maxMeritDiscount)}">`)}
            ${UI.field('Loyalty max %', `<div class="pp-row-actions"><input class="pp-input pp-fit" name="loyaltyMaxDiscount" inputmode="decimal" value="${Utils.esc(state.settings.loyaltyMaxDiscount)}"><button class="pp-btn" type="button" data-action="add-loyalty-tier">Add loyalty tier</button></div>`, 'span-2')}
            ${UI.field('Promo discount %', `<select class="pp-select" name="globalPromoDiscount"><option value="0" ${state.settings.globalPromoDiscount == 0 ? 'selected' : ''}>0%</option><option value="25" ${state.settings.globalPromoDiscount == 25 ? 'selected' : ''}>25%</option><option value="50" ${state.settings.globalPromoDiscount == 50 ? 'selected' : ''}>50%</option></select>`)}
            ${UI.field('Total discount cap %', `<input class="pp-input" name="maxTotalDiscount" inputmode="decimal" value="${Utils.esc(state.settings.maxTotalDiscount)}">`)}
            ${UI.loyaltyTierBuilder(state.settings.loyaltyTiers)}
            <div class="pp-form-title">Log trigger</div>
            ${UI.field('Trigger text', `<input class="pp-input" name="logTrigger" value="${Utils.esc(state.settings.logTrigger || '!train')}" placeholder="!train">`, 'span-2 pp-compact-field')}
            <div class="pp-field span-4"><span class="pp-note">Import from log scans the latest 100 matching Torn log rows and imports only rows containing this trigger.</span></div>
          </form>
        </div>
      </section>`;
    },

    wagePage() {
      const state = UI.state;
      return `<div class="pp-grid"><section class="pp-panel" data-tour="wage-system">
        <div class="pp-head">
          <div>
            <h2>Wage system</h2>
            <p>Role requirements, stat totals, and local wage previews.</p>
          </div>
        </div>
        <div class="pp-content"><form data-wage-form class="pp-form">
          ${UI.field('Base wage', `<input class="pp-input" name="baseWage" inputmode="numeric" value="${Utils.esc(state.settings.wage.baseWage)}">`, 'span-2')}
          ${UI.field('MAN weight', `<input class="pp-input" name="manWeight" inputmode="decimal" value="${Utils.esc(state.settings.wage.manWeight)}">`)}
          ${UI.field('INT weight', `<input class="pp-input" name="intWeight" inputmode="decimal" value="${Utils.esc(state.settings.wage.intWeight)}">`)}
          ${UI.field('END weight', `<input class="pp-input" name="endWeight" inputmode="decimal" value="${Utils.esc(state.settings.wage.endWeight)}">`)}
          ${UI.field('Cash / stat', `<input class="pp-input" name="statCashRate" inputmode="decimal" value="${Utils.esc(state.settings.wage.statCashRate)}">`)}
          ${UI.field('Merit bonus %', `<input class="pp-input" name="meritBonusPercent" inputmode="decimal" value="${Utils.esc(state.settings.wage.meritBonusPercent)}">`)}
          ${UI.field('Addiction penalty %', `<input class="pp-input" name="addictionPenaltyPercent" inputmode="decimal" value="${Utils.esc(state.settings.wage.addictionPenaltyPercent)}">`)}
          ${UI.field('Inactivity penalty %', `<input class="pp-input" name="inactivityPenaltyPercent" inputmode="decimal" value="${Utils.esc(state.settings.wage.inactivityPenaltyPercent)}">`)}
          ${UI.field('Inactive days', `<input class="pp-input" name="inactiveDaysThreshold" inputmode="numeric" value="${Utils.esc(state.settings.wage.inactiveDaysThreshold)}">`)}
          ${UI.wageRoleCalculator()}
        </form></div>
      </section></div>`;
    },

    dataReportsPage() {
      const state = UI.state;
      return `<div class="pp-grid">
        ${UI.companyWorkspacesPanel()}
        ${UI.scriptUserProfilePanel()}
        <section class="pp-panel" data-tour="data-reports">
          <div class="pp-head">
            <div>
              <h2>Data and reports</h2>
              <p>Choose report sections, then export a themed HTML file or copy newsletter-ready HTML.</p>
            </div>
          </div>
          <div class="pp-content">
            <div class="pp-form">
              <div class="pp-field span-6">
                <label>Report sections</label>
                ${UI.reportSectionOptions()}
              </div>
              <div class="pp-field span-6">
                <label>Actions</label>
                <div class="pp-action-grid pp-report-actions">
                  <button class="pp-btn" type="button" data-action="export-full">Export selected JSON backup</button>
                  <button class="pp-btn" type="button" data-action="import-full">Import selected JSON backup</button>
                  <input type="file" accept="application/json" data-import-file hidden>
                  <button class="pp-btn" type="button" data-action="export-report">Export selected HTML report</button>
                  <button class="pp-btn" type="button" data-action="copy-newsletter">Copy selected newsletter HTML</button>
                  <button class="pp-btn" type="button" data-action="copy-bug">Copy bug report data</button>
                  <button class="pp-btn" type="button" data-action="open-faq">FAQ</button>
                  <button class="pp-btn" type="button" data-action="open-bug-report">Report bug</button>
                  <button class="pp-btn" type="button" data-action="open-contact">Message me</button>
                </div>
              </div>
            </div>
          </div>
        </section>
        ${UI.clearDataPanel()}
      </div>`;
    },
    companyWorkspacesPanel() {
      const snapshots = Store.loadCompanySnapshots();
      const activeKey = Store.companyKey(UI.state);
      const activeSnapshot = Store.canUseCloudWorkspace(UI.state) ? Store.companySnapshotMeta(UI.state, { active: true }) : null;
      const rowMap = Object.assign({}, snapshots);
      if (activeSnapshot && !rowMap[activeSnapshot.key]) rowMap[activeSnapshot.key] = activeSnapshot;
      const rows = Object.values(rowMap).sort((a, b) => {
        if (a.key === activeKey) return -1;
        if (b.key === activeKey) return 1;
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      });
      return `<section class="pp-panel" data-tour="company-workspaces">
        <div class="pp-head">
          <div>
            <h2>Company workspaces</h2>
            <p>Keep separate cloud ledgers, history, and settings for each company.</p>
          </div>
          <button class="pp-btn is-primary" type="button" data-action="upload-company-workspace">Upload current company</button>
        </div>
        <div class="pp-content">
          ${Store.canUseCloudWorkspace(UI.state) ? `<p class="pp-note">Active workspace: ${Utils.esc(Store.companyLabel(UI.state))}</p>` : '<div class="pp-empty">Cloud workspaces require a saved Torn API key, User ID, and synced Company ID.</div>'}
          <p class="pp-note">For Free cloud storage, your Torn API key is sent to the Pythagoras API over HTTPS only to verify your Torn user ID and current company ID. The backend does not store the key.</p>
          ${rows.length ? `<div class="pp-wrap" style="margin-top:10px"><table class="pp-table is-compact"><thead><tr><th>#</th><th>Company</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${rows.map((row, index) => `<tr>
            <td>${index + 1}</td>
            <td>${Utils.esc(row.label || row.companyName || row.companyId || row.key)}${row.key === activeKey ? ' <span class="pp-note">(active)</span>' : ''}</td>
            <td>${Utils.esc(Utils.dateTime(row.updatedAt))}</td>
            <td><div class="pp-row-actions"><button class="pp-btn" type="button" data-action="switch-company-workspace" data-company-key="${Utils.esc(row.key)}" ${row.key === activeKey ? 'disabled' : ''}>Switch</button><button class="pp-btn is-danger" type="button" data-action="delete-company-workspace" data-company-key="${Utils.esc(row.key)}" ${row.key === activeKey ? 'disabled' : ''}>Delete</button></div></td>
          </tr>`).join('')}</tbody></table></div>` : '<div class="pp-empty" style="margin-top:10px">No saved company workspaces yet.</div>'}
        </div>
      </section>`;
    },
    scriptUserRows() {
      const sources = [{ key: 'active', state: UI.state }];
      const userId = String(UI.state.settings.userId || PageData.userId() || '').trim();
      const userName = Company.nameKey(UI.state.settings.userName || PageData.userName());
      const seen = new Set();
      const rows = [];
      const isUser = (person) => {
        const id = String(person && person.id || '').trim();
        if (userId && id && id === userId) return true;
        const names = [person && person.name, person && person.playerName].concat(person && person.aliases || []).map(Company.nameKey);
        return !!(userName && names.includes(userName));
      };
      const directorEventIsUser = (event) => {
        if (!event || event.type !== 'director') return false;
        if (userId && String(event.userId || '') === userId) return true;
        const eventName = Company.nameKey(event.playerName || '');
        if (userName && eventName === userName) return true;
        return false;
      };
      const directorPeriodsForUser = (state) => {
        const directorEvents = (state.staff.timeline || [])
          .filter((event) => event && event.type === 'director')
          .sort((a, b) => Utils.int(a.timestamp, 0) - Utils.int(b.timestamp, 0));
        return directorEvents.reduce((periods, event, index) => {
          if (!directorEventIsUser(event)) return periods;
          const nextDirector = directorEvents.slice(index + 1).find((next) => !directorEventIsUser(next));
          periods.push({ start: event.timestamp || '', end: nextDirector ? nextDirector.timestamp : '' });
          return periods;
        }, []);
      };
      const tenure = (start, end) => start ? Utils.daysBetween(start, end || Math.floor(Date.now() / 1000)) : 0;
      const profileDateKey = (value) => value ? Utils.dayKey(value) : '';
      const addProfileRow = (row) => {
        const key = [
          Company.nameKey(row.company),
          Company.nameKey(row.status),
          Company.nameKey(row.role),
          profileDateKey(row.start),
          profileDateKey(row.end)
        ].join(':');
        if (seen.has(key)) return;
        seen.add(key);
        rows.push(row);
      };
      sources.forEach((source) => {
        const state = source.state;
        const company = Store.companyLabel(state);
        const typeName = state.company.profile.typeName || state.settings.companyTypeName || '';
        directorPeriodsForUser(state).forEach((period) => {
          const status = period.end ? 'Past director' : 'Current director';
          addProfileRow({
            company,
            typeName,
            status,
            role: 'Director',
            start: period.start,
            end: period.end,
            days: tenure(period.start, period.end)
          });
        });
        [
          ['Current staff', state.staff.current || []],
          ['Past staff', state.staff.past || []],
          ['Current director', state.staff.directorsCurrent || []],
          ['Past director', state.staff.directorsPast || []]
        ].forEach(([status, list]) => {
          list.filter(isUser).forEach((person) => {
            const isDirectorRow = status.toLowerCase().includes('director');
            const start = isDirectorRow
              ? (UI.directorStart(person) || person.startedAt || person.hiredAt || person.joinedDate || '')
              : (person.hiredAt || person.joinedDate || person.startedAt || state.company.newsSync.earliestTimestamp || '');
            const end = isDirectorRow
              ? (status.includes('Past') ? (UI.directorEnd(person) || person.leftAt || person.endedAt || '') : '')
              : (status.includes('Past') ? (person.leftAt || person.endedAt || '') : '');
            addProfileRow({
              company,
              typeName,
              status,
              role: person.role || (status.includes('director') ? 'Director' : 'Employee'),
              start,
              end,
              days: tenure(start, end)
            });
          });
        });
      });
      return rows.sort((a, b) => Utils.dateTimestamp(b.start) - Utils.dateTimestamp(a.start));
    },
    scriptUserProfilePanel() {
      const rows = UI.scriptUserRows();
      return `<section class="pp-panel" data-tour="script-user-profile">
        <div class="pp-head">
          <div>
            <h2>Script user profile</h2>
            <p>Local employment and director history for ${Utils.esc(UI.state.settings.userName || PageData.userName() || UI.state.settings.userId || 'this user')}.</p>
          </div>
        </div>
        <div class="pp-content">
          ${rows.length ? `<div class="pp-wrap"><table class="pp-table is-compact"><thead><tr><th>#</th><th>Company</th><th>Type</th><th>Status</th><th>Role</th><th>From</th><th>To</th><th>Days</th></tr></thead><tbody>${rows.map((row, index) => `<tr>
            <td>${index + 1}</td>
            <td>${Utils.esc(row.company)}</td>
            <td>${Utils.esc(row.typeName || 'Not detected')}</td>
            <td>${Utils.esc(row.status)}</td>
            <td>${Utils.esc(row.role)}</td>
            <td>${Utils.esc(row.start ? Utils.dateShort(row.start) : 'Not detected')}</td>
            <td>${Utils.esc(row.end ? Utils.dateShort(row.end) : 'Now')}</td>
            <td>${Utils.esc(row.days || '')}</td>
          </tr>`).join('')}</tbody></table></div>` : '<div class="pp-empty">No local employment history found for the configured user yet.</div>'}
        </div>
      </section>`;
    },
    clearDataPanel() {
      return `<section class="pp-panel" data-tour="danger-zone">
        <div class="pp-head">
          <div>
            <h2>Danger zone</h2>
            <p>Clear local Pythagoras data from this browser. This cannot be undone without a backup.</p>
          </div>
          <button class="pp-btn is-danger" type="button" data-action="request-clear-data">Clear all local data</button>
        </div>
        <div class="pp-content"><div class="pp-empty">Export a full backup before using this. It removes the active workspace and all saved company workspaces.</div></div>
      </section>`;
    },
    field(label, control, span) {
      return `<label class="pp-field ${span || ''}"><span>${Utils.esc(label)}</span>${control}</label>`;
    },
    colorField(label, name, value, span) {
      const safeValue = Utils.esc(value);
      const pickerValue = /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#9aa0a6';
      return UI.field(label, `<div class="pp-color-pair"><input class="pp-input" name="${name}" value="${safeValue}" data-color-text="${name}"><input class="pp-color-picker" type="color" value="${pickerValue}" data-color-picker="${name}"></div>`, span);
    },
    roleColorFields() {
      return UI.rolesList().map(([key, label]) => {
        const value = UI.state.settings.roleColors[key] || UI.roleColor(label);
        const pickerValue = /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#9aa0a6';
        return `<label class="pp-field span-2"><span>${Utils.esc(label)} colour</span><div class="pp-color-pair"><input class="pp-input" name="roleColor:${Utils.esc(key)}" value="${Utils.esc(value)}" data-color-text="roleColor:${Utils.esc(key)}"><input class="pp-color-picker" type="color" value="${Utils.esc(pickerValue)}" data-color-picker="roleColor:${Utils.esc(key)}"></div></label>`;
      }).join('');
    },
    notificationSettingsPanel() {
      const settings = UI.notificationSettings();
      return `<section class="pp-panel" data-tour="notification-rules">
        <div class="pp-head">
          <div>
            <h3>Notification rules</h3>
            <p>Choose which operational warnings appear above the containers and on the minimized pill.</p>
          </div>
        </div>
        <div class="pp-content">
          <form data-notifications-form class="pp-form">
            <div class="pp-form-title">Warnings</div>
            <label class="pp-field span-2"><span>Low stock</span><span><input type="checkbox" name="notifyStock" ${settings.stock.enabled ? 'checked' : ''}> Enabled</span></label>
            <label class="pp-field span-2"><span>Addiction watch</span><span><input type="checkbox" name="notifyAddiction" ${settings.addiction.enabled ? 'checked' : ''}> Enabled</span></label>
            ${UI.field('Addiction threshold', `<input class="pp-input" name="notifyAddictionThreshold" inputmode="decimal" value="${Utils.esc(settings.addiction.threshold)}">`, 'span-2')}
            <label class="pp-field span-2"><span>Inactivity watch</span><span><input type="checkbox" name="notifyInactivity" ${settings.inactivity.enabled ? 'checked' : ''}> Enabled</span></label>
            ${UI.field('Inactive days threshold', `<input class="pp-input" name="notifyInactiveDays" inputmode="numeric" value="${Utils.esc(settings.inactivity.thresholdDays)}">`, 'span-2')}
            <label class="pp-field span-2"><span>Sync freshness</span><span><input type="checkbox" name="notifySync" ${settings.sync.enabled ? 'checked' : ''}> Enabled</span></label>
            ${UI.field('Sync warning hours', `<input class="pp-input" name="notifySyncWarnHours" inputmode="numeric" value="${Utils.esc(settings.sync.warnHours)}">`, 'span-2')}
            ${UI.field('Sync danger hours', `<input class="pp-input" name="notifySyncDangerHours" inputmode="numeric" value="${Utils.esc(settings.sync.dangerHours)}">`, 'span-2')}
            <div class="pp-field span-6"><span class="pp-note">Low stock still uses each service row's own warning threshold. Sync freshness changes the colour of sync buttons as well as the alert strip.</span></div>
          </form>
        </div>
      </section>`;
    },
    roleManagementPanel() {
      const defaults = new Set((Company.defaultRoles || []).map((role) => UI.roleKey(role)));
      const custom = new Set((UI.state.settings.customRoles || []).map((role) => UI.roleKey(role)));
      const rows = UI.rolesList().map(([key, label]) => {
        const source = custom.has(key) ? 'Custom' : (defaults.has(key) ? 'System' : 'Detected');
        const value = UI.state.settings.roleColors[key] || UI.roleColor(label);
        const pickerValue = /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#9aa0a6';
        const rankIds = UI.roleRankIds(key, label);
        const evidence = UI.roleRankEvidence(key, label);
        const removable = source !== 'Detected';
        return `<tr data-role-row="${Utils.esc(key)}">
          <td>${Utils.esc(label)}</td>
          <td><input class="pp-inline" name="roleLabel:${Utils.esc(key)}" value="${Utils.esc(label)}"></td>
          <td><input class="pp-inline pp-fit" name="roleRankIds:${Utils.esc(key)}" value="${Utils.esc(rankIds)}" placeholder="256"></td>
          <td>${evidence}</td>
          <td><div class="pp-color-pair"><input class="pp-input" name="roleColor:${Utils.esc(key)}" value="${Utils.esc(value)}" data-color-text="roleColor:${Utils.esc(key)}"><input class="pp-color-picker" type="color" value="${Utils.esc(pickerValue)}" data-color-picker="roleColor:${Utils.esc(key)}"></div></td>
          <td>${source}</td>
          <td><button class="pp-btn ${removable ? 'is-danger' : ''}" type="button" data-action="delete-role" data-role-key="${Utils.esc(key)}" ${removable ? '' : 'disabled'}>${source === 'System' ? 'Hide' : 'Remove'}</button></td>
        </tr>`;
      }).join('');
      return `<section class="pp-panel" data-tour="role-management">
        <div class="pp-head">
          <div>
            <h3>Role management</h3>
            <p>Add local roles, map Torn role IDs, rename display labels, and set role colours.</p>
          </div>
        </div>
        <div class="pp-content">
          <form data-roles-form class="pp-form">
            ${UI.field('New role','<div class="pp-row-actions"><input class="pp-input pp-fit" data-new-role-name placeholder="New Role"><button class="pp-btn" type="button" data-action="add-role">Add role</button></div>', 'span-6')}
            <div class="pp-field span-6"><span>Roles</span>
            <div class="pp-wrap">
              <table class="pp-table is-compact pp-role-table">
                <thead>
                  <tr>
                    <th>Current</th>
                    <th>Display label</th>
                    <th>Role ID(s)</th>
                    <th>Evidence</th>
                    <th>Colour</th>
                    <th>Source</th>
                    <th>Action</th>
                  </tr></thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>
            <span class="pp-note">Role IDs come from company rank change logs. Use commas if one label maps to more than one ID.</span>
          </div>
          </form>
        </div>
      </section>`;
    },
    builtInThemeOptions() {
      return [['modul', 'MoDuL dark'], ['carbon', 'Carbon'], ['neon', 'Neon'], ['ruby', 'Ruby'], ['blue-gold', 'Blue and gold'], ['contrast', 'High contrast']];
    },
    savedThemes() {
      UI.state.settings.savedThemes = Array.isArray(UI.state.settings.savedThemes) ? UI.state.settings.savedThemes : [];
      UI.state.settings.savedThemes = UI.state.settings.savedThemes.map((theme) => ({
        id: String(theme && theme.id || '').toLowerCase().replace(/[^a-z0-9-]/g, ''),
        name: String(theme && theme.name || '').replace(/\s+/g, ' ').trim().slice(0, 32),
        vars: UI.themeVars(theme && theme.vars),
        updatedAt: theme && theme.updatedAt || ''
      })).filter((theme) => theme.id && theme.name);
      return UI.state.settings.savedThemes;
    },
    savedThemeById(id) {
      const key = String(id || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!key) return null;
      return UI.savedThemes().find((theme) => theme.id === key) || null;
    },
    themeIdFromName(name) {
      const base = String(name || 'Custom theme').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28) || 'custom-theme';
      return `theme-${base}`;
    },
    upsertSavedTheme(name, vars) {
      const cleanName = String(name || 'Custom theme').replace(/\s+/g, ' ').trim().slice(0, 32) || 'Custom theme';
      const saved = UI.savedThemes();
      const current = UI.savedThemeById(UI.state.settings.theme);
      const byName = saved.find((theme) => theme.name.toLowerCase() === cleanName.toLowerCase());
      let id = current ? current.id : (byName ? byName.id : UI.themeIdFromName(cleanName));
      if (!current && !byName) {
        const base = id;
        let suffix = 2;
        while (saved.some((theme) => theme.id === id)) {
          id = `${base}-${suffix}`;
          suffix += 1;
        }
      }
      const entry = { id, name: cleanName, vars: UI.themeVars(vars), updatedAt: Utils.nowIso() };
      const index = saved.findIndex((theme) => theme.id === id);
      if (index >= 0) saved[index] = entry;
      else saved.push(entry);
      UI.state.settings.savedThemes = saved.sort((a, b) => a.name.localeCompare(b.name));
      UI.state.settings.theme = entry.id;
      UI.state.settings.customTheme = { name: entry.name, vars: Utils.clone(entry.vars) };
      return entry;
    },
    themeOptions(includeCustom) {
      const saved = UI.savedThemes().map((theme) => [theme.id, theme.name]);
      const custom = includeCustom === false ? [] : [['custom', UI.state.settings.customTheme && UI.state.settings.customTheme.name ? UI.state.settings.customTheme.name : 'Custom']];
      return UI.builtInThemeOptions().concat(saved, custom);
    },
    themePresetVars(theme) {
      const saved = UI.savedThemeById(theme);
      if (saved) return Utils.clone(saved.vars);
      const presets = {
        modul: DEFAULTS.settings.customTheme.vars,
        carbon: {
            bg: '#0b0d0d',
            panel: '#151717',
            panel2: '#202323',
            line: '#3b4040',
            text: '#f4f6f4',
            muted: '#b7beb8',
            accent: '#d8d1bd',
            warn: '#e0b85e',
            bad: '#e26b6b',
            graphIncome: '#d8d1bd',
            graphCustomers: '#00c6ff',
            graphWages: '#f06d87',
            graphAdBudget: '#8ab4f8',
            graphProfit: '#e0b85e',
            graphServices: '#e0b85e'
        },
        neon: {
            bg: '#07100d',
            panel: '#0e1915',
            panel2: '#14241d',
            line: '#285545',
            text: '#f2fff8',
            muted: '#a8c9b8',
            accent: '#55e69f',
            warn: '#f2d264',
            bad: '#ff6c7a',
            graphIncome: '#55e69f',
            graphCustomers: '#00c6ff',
            graphWages: '#f06d87',
            graphAdBudget: '#8ab4f8',
            graphProfit: '#f2d264',
            graphServices: '#f2d264'
        },
        ruby: {
            bg: '#120d0f',
            panel: '#1a1215',
            panel2: '#27191e',
            line: '#56343e',
            text: '#fff5f6',
            muted: '#d4b7bd',
            accent: '#f06d87',
            warn: '#e8c35f',
            bad: '#ff5b66',
            graphIncome: '#f06d87',
            graphCustomers: '#00c6ff',
            graphWages: '#d8a545',
            graphAdBudget: '#8ab4f8',
            graphProfit: '#e8c35f',
            graphServices: '#e8c35f'
        },
        'blue-gold': {
            bg: '#081019',
            panel: '#101925',
            panel2: '#172538',
            line: '#d8a545',
            text: '#f0cf66',
            muted: '#d7c07a',
            accent: '#f4d35e',
            warn: '#f0d06f',
            bad: '#ef6d70',
            graphIncome: '#f4d35e',
            graphCustomers: '#00c6ff',
            graphWages: '#f06d87',
            graphAdBudget: '#8ab4f8',
            graphProfit: '#FFDD00',
            graphServices: '#f0d06f'
        },
        contrast: {
            bg: '#000000',
            panel: '#080808',
            panel2: '#141414',
            line: '#f5f5f5',
            text: '#ffffff',
            muted: '#d9d9d9',
            accent: '#00ff8c',
            warn: '#ffe600',
            bad: '#ff4d4d',
            graphIncome: '#00ff8c',
            graphCustomers: '#00c6ff',
            graphWages: '#ff4d4d',
            graphAdBudget: '#8ab4f8',
            graphProfit: '#ffe600',
            graphServices: '#ffe600'
        }
      };
      return Utils.clone(presets[theme] || presets.modul);
    },
    themeEditorPanel() {
      const settings = UI.state.settings;
      const saved = UI.savedThemeById(settings.theme);
      const vars = UI.currentThemeVars(settings.theme);
      const labels = { bg: 'Background', panel: 'Panel', panel2: 'Panel header', line: 'Borders', text: 'Text', muted: 'Muted text', accent: 'Accent', warn: 'Warning', bad: 'Danger' };
      const graphLabels = { graphIncome: 'Income', graphCustomers: 'Customers', graphWages: 'Wages', graphAdBudget: 'Ad Budget', graphProfit: 'Profit', graphServices: 'Services Sold' };
      const swatches = (items) => Object.entries(items).map(([key, label]) => `<label class="pp-theme-swatch"><span>${Utils.esc(label)}</span>
            <div class="pp-color-pair"><input class="pp-input" name="themeVar:${Utils.esc(key)}" data-theme-editor data-color-text="themeVar:${Utils.esc(key)}" value="${Utils.esc(vars[key])}"><input class="pp-color-picker" type="color" data-theme-editor data-color-picker="themeVar:${Utils.esc(key)}" value="${Utils.esc(vars[key])}"></div></label>`).join('');
      const presetOptions = UI.themeOptions(false)
        .map(([value, label]) => `<option value="${value}" ${settings.theme === value ? 'selected' : ''}>${label}</option>`).join('');
      const themeName = saved ? saved.name : (settings.customTheme.name || 'Custom');
      return `<section class="pp-panel" data-tour="theme-editor">
        <div class="pp-head">
          <div>
            <h3>Theme editor</h3>
            <p>Pick a preset, then tweak colours. Editing switches the theme to Custom.</p>
          </div>
        </div>
        <div class="pp-content">
          <form data-theme-form class="pp-form">
            ${UI.field('Use preset', `<div class="pp-row-actions"><select class="pp-select pp-select-fit" data-theme-preset-select>${presetOptions}</select><button class="pp-btn" type="button" data-action="apply-theme-preset">Use preset</button></div>`, 'span-3 pp-compact-field')}
            ${UI.field('Save custom theme as', `<input class="pp-input" name="customThemeName" data-theme-editor value="${Utils.esc(themeName)}" placeholder="My company theme">`, 'span-3 pp-compact-field')}
            <div class="pp-theme-section">
              <div class="pp-theme-section-head">
                <h4>Custom colours</h4>
                <p>Core shell, panel, text, border, and alert colours.</p>
              </div>
              <div class="pp-theme-editor">${swatches(labels)}</div>
            </div>
            <div class="pp-theme-section">
              <div class="pp-theme-section-head">
                <h4>Graph colours</h4>
                <p>Series colours used by Balance and service graphs.</p>
              </div>
              <div class="pp-theme-editor">${swatches(graphLabels)}</div>
            </div>
            <div class="pp-theme-section">
              <div class="pp-theme-section-head">
                <h4>Contract colours</h4>
                <p>Badges and staff contract indicators.</p>
              </div>
              <div class="pp-theme-section-grid">
                ${UI.colorField('Paid', 'paid', settings.colors.paid, 'span-2')}
                ${UI.colorField('Sponsored', 'sponsored', settings.colors.sponsored, 'span-2')}
                ${UI.colorField('Unpaid', 'unpaid', settings.colors.unpaid, 'span-2')}
                ${UI.colorField('Done', 'done', settings.colors.done, 'span-2')}
              </div>
            </div>
          </form>
        </div>
      </section>`;
    },
    wageRoleCalculator() {
      const rows = UI.rolesList().filter(([key, label]) => !UI.isScriptOnlyRole(key, label)).map(([key, label]) => {
        const req = UI.state.settings.wageRoleRequirements[key] || {};
        const man = Utils.num(req.man, 0);
        const int = Utils.num(req.int, 0);
        const end = Utils.num(req.end, 0);
        const preview = Wages.estimate({ man, int, end, merits: 0, addiction: 0, inactiveDays: 0 }, UI.state.settings);
        return { key, label, man, int, end, preview, total: man + int + end };
      });
      const sorted = UI.sortedRows('wageRoles', rows, {
        role: (row) => String(row.label || '').toLowerCase(),
        man: (row) => row.man,
        int: (row) => row.int,
        end: (row) => row.end,
        total: (row) => row.total,
        preview: (row) => row.preview
      }, 'role', 'asc');
      return `<div class="pp-field span-6"><span>Role wage calculator</span><div class="pp-wrap"><table class="pp-table"><thead><tr><th>#</th><th>${UI.tableSortHeader('wageRoles', 'role', 'Role')}</th><th>${UI.tableSortHeader('wageRoles', 'man', 'Min MAN')}</th><th>${UI.tableSortHeader('wageRoles', 'int', 'Min INT')}</th><th>${UI.tableSortHeader('wageRoles', 'end', 'Min END')}</th><th>${UI.tableSortHeader('wageRoles', 'total', 'Total stat sum')}</th><th>${UI.tableSortHeader('wageRoles', 'preview', 'Preview')}</th></tr></thead><tbody>${sorted.map((row, index) => {
        const key = row.key;
        return `<tr data-wage-role="${Utils.esc(key)}"><td>${index + 1}</td><td>${Utils.esc(row.label)}</td><td><input class="pp-inline" name="wageRole:${Utils.esc(key)}:man" inputmode="numeric" value="${Utils.esc(row.man)}"></td><td><input class="pp-inline" name="wageRole:${Utils.esc(key)}:int" inputmode="numeric" value="${Utils.esc(row.int)}"></td><td><input class="pp-inline" name="wageRole:${Utils.esc(key)}:end" inputmode="numeric" value="${Utils.esc(row.end)}"></td><td>${Utils.esc(row.total)}</td><td>${Utils.money(row.preview)}</td></tr>`;
      }).join('')}</tbody></table></div><span class="pp-note">Edits save automatically. Wage previews refresh as values change.</span></div>`;
    },
    apiKeyControl() {
      const state = UI.state;
      const key = String(state.settings.apiKey || '');
      const shown = state.ui.showApiKey || !key;
      const input = shown
        ? `<input class="pp-input" type="${state.ui.showApiKey ? 'text' : 'password'}" name="apiKey" autocomplete="off" value="${Utils.esc(key)}" data-tour="api-key">`
        : `<input class="pp-input" type="text" name="apiKeyMasked" readonly value="${Utils.esc(Utils.maskKey(key))}" data-tour="api-key"><input type="hidden" name="apiKey" value="${Utils.esc(key)}">`;
      return `<div class="pp-row-actions pp-api-key">${input}<button class="pp-btn" type="button" data-action="toggle-api-key">${state.ui.showApiKey ? 'Hide' : 'View'}</button><label class="pp-note pp-checkline"><input type="checkbox" name="rememberApiKey" ${state.settings.rememberApiKey ? 'checked' : ''}> Remember locally</label><button class="pp-btn" type="button" data-action="check-key-info" data-tour="check-key" title="Check key access and autofill user/company IDs">Check key</button></div>`;
    },
    keyInfoStatus() {
      const info = UI.state.settings.keyInfo || {};
      if (UI.apiKeyMissing()) return '<span class="bad" data-tour="key-access">Key access: Missing <b class="pp-status-mark">&#10005;</b></span>';
      if (!info.lastChecked) return '<span class="pp-note" data-tour="key-access">Key access: Not checked yet.</span>';
      const full = info.fullAccess || Utils.int(info.accessLevel, 0) >= 4 || /full/i.test(String(info.accessType || ''));
      const cls = full ? 'good' : 'bad';
      const mark = full ? '&#10003;' : '&#10005;';
      const label = full ? 'Full Access' : (info.accessType || 'Limited access');
      return `<span class="pp-key-status" data-tour="key-access"><span class="${cls}">Key access: ${Utils.esc(label)} <b class="pp-status-mark">${mark}</b></span><span class="pp-note">Checked ${Utils.esc(Utils.dateTime(info.lastChecked))}</span></span>`;
    },
    syncJob(id) {
      return UI.syncJobs[id] || null;
    },
    syncProgressClass(id) {
      const job = UI.syncJob(id);
      if (!job) return '';
      if (job.status === 'error') return 'pp-sync-progress is-danger';
      if (job.status === 'done') return 'pp-sync-progress';
      return 'pp-sync-progress is-warn';
    },
    syncProgressStyle(id) {
      const job = UI.syncJob(id);
      if (!job) return '';
      return `--sync-progress:${Utils.clamp(Utils.int(job.progress, 0), 0, 100)}%`;
    },
    syncConsoleHtml() {
      const rows = UI.syncLog.slice(-8);
      if (!rows.length) return '<strong>Sync console</strong><p>No sync activity yet.</p>';
      return `<strong>Sync console</strong>${rows.map((row) => `<p><time>${Utils.esc(row.time)}</time>${Utils.esc(row.message)}</p>`).join('')}`;
    },
    syncLogMessage(message) {
      const date = new Date();
      const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      UI.syncLog.push({ time, message: String(message || '') });
      UI.syncLog = UI.syncLog.slice(-24);
    },
    updateSyncUi() {
      const root = UI.currentRoot && UI.currentRoot();
      if (!root) return;
      const consoleNode = root.querySelector('[data-sync-console]');
      if (consoleNode) consoleNode.innerHTML = UI.syncConsoleHtml();
      root.querySelectorAll('[data-sync-action]').forEach((button) => {
        const id = button.dataset.syncAction;
        const job = UI.syncJob(id);
        button.classList.remove('pp-sync-progress', 'is-warn', 'is-danger');
        button.style.removeProperty('--sync-progress');
        if (!job) return;
        UI.syncProgressClass(id).split(/\s+/).filter(Boolean).forEach((cls) => button.classList.add(cls));
        button.style.setProperty('--sync-progress', `${Utils.clamp(Utils.int(job.progress, 0), 0, 100)}%`);
      });
    },
    beginSync(id, label) {
      UI.syncJobs[id] = { label, progress: 2, status: 'running' };
      UI.syncLogMessage(`${label}: starting.`);
      UI.updateSyncUi();
    },
    syncStep(id, message, progress) {
      const job = UI.syncJobs[id] || { label: id, progress: 0, status: 'running' };
      job.progress = Utils.clamp(Utils.int(progress, job.progress || 0), 0, 100);
      job.status = 'running';
      UI.syncJobs[id] = job;
      if (message) UI.syncLogMessage(`${job.label}: ${message}`);
      UI.updateSyncUi();
    },
    reportRowsForApi(rows) {
      const byDate = new Map();
      (rows || []).forEach((row) => {
        const reportDate = Utils.dateInput(row.reportDate || row.date) || Utils.dayKey(row.timestamp);
        const customers = Utils.int(row.customers, 0);
        const income = Utils.int(row.income || row.grossIncome, 0);
        if (!reportDate || (!customers && !income)) return;
        byDate.set(reportDate, {
          reportDate,
          timestamp: Utils.int(row.timestamp, 0) || Utils.dateTimestamp(reportDate),
          customers,
          income
        });
      });
      return Array.from(byDate.values()).sort((a, b) => String(b.reportDate).localeCompare(String(a.reportDate)));
    },
    reportsFromEventsForApi(events) {
      const rows = [];
      (events || []).forEach((event) => {
        if (!event || event.type !== 'daily_report') return;
        const values = Timeline.reportValues(event);
        if (!values.customers && !values.income) return;
        rows.push({
          reportDate: Utils.dayKey(event.timestamp),
          timestamp: event.timestamp,
          customers: values.customers,
          income: values.income
        });
      });
      return UI.reportRowsForApi(rows);
    },
    reportsForApi() {
      const rows = [];
      (UI.state.analytics.weeks || []).forEach((week) => {
        (week.days || []).forEach((day) => {
          rows.push({
            reportDate: day.date,
            timestamp: day.timestamp,
            customers: day.customers,
            income: day.income
          });
        });
      });
      return UI.reportRowsForApi(rows);
    },
    stockItemsForApi(items) {
      const stock = {};
      (items || UI.state.company.stock.items || []).forEach((item) => {
        const key = String(item.key || item.name || item.service || item.label || '').trim();
        if (!key) return;
        stock[key] = {
          cost: Utils.num(item.cost, 0),
          rrp: Utils.num(item.rrp, 0),
          price: Utils.num(item.price, 0),
          inStock: Utils.num(item.inStock || item.in_stock, 0),
          onOrder: Utils.num(item.onOrder || item.on_order, 0),
          soldAmount: Utils.num(item.soldAmount || item.sold_amount, 0),
          soldWorth: Utils.num(item.soldWorth || item.sold_worth, 0)
        };
      });
      return stock;
    },
    staffMembersForApi() {
      const rows = [];
      const seen = new Set();
      const add = (person, status) => {
        const userId = String(person && (person.id || person.userId || person.playerId) || '').trim();
        if (!/^\d+$/.test(userId) || seen.has(userId)) return;
        seen.add(userId);
        const hiredAt = Utils.dateTimestamp(UI.personHireValue(person) || person.hireDate || person.joinedAt);
        const leftAt = Utils.dateTimestamp(UI.personLeftValue(person) || person && (person.leftDate || person.leftTimestamp));
        rows.push({
          userId,
          username: person.name || person.playerName || userId,
          currentRole: person.role || person.position || person.currentRole || '',
          contractType: person.contractType || person.contract || '',
          status,
          hiredAt: hiredAt || null,
          leftAt: leftAt || null,
          exitType: person.exitType || (status === 'past' ? 'left' : '')
        });
      };
      (UI.state.staff.current || []).forEach((person) => add(person, 'current'));
      (UI.state.company.profile.employees || []).forEach((person) => add(person, 'current'));
      (UI.state.staff.past || []).forEach((person) => add(person, 'past'));
      (UI.state.staff.directorsCurrent || []).forEach((person) => add(Object.assign({}, person, { role: 'Director' }), 'director'));
      (UI.state.staff.directorsPast || []).forEach((person) => add(Object.assign({}, person, { role: 'Director' }), 'past_director'));
      return rows;
    },
    staffSnapshotsForApi() {
      const rows = [];
      const seen = new Set();
      Company.dedupePeople((UI.state.staff.current || []).concat(UI.state.company.profile.employees || [])).forEach((person) => {
        const userId = String(person && (person.id || person.userId || person.playerId) || '').trim();
        if (!/^\d+$/.test(userId) || seen.has(userId)) return;
        seen.add(userId);
        const effectiveness = person.effectiveness || {};
        rows.push({
          userId,
          username: person.name || person.playerName || userId,
          currentRole: person.role || person.position || person.currentRole || '',
          contractType: person.contractType || person.contract || '',
          manual: Utils.num(person.man || person.manual || person.manualLabor, 0),
          intelligence: Utils.num(person.int || person.intelligence, 0),
          endurance: Utils.num(person.end || person.endurance, 0),
          merits: UI.personMerits(person),
          addiction: Utils.num(person.addiction || effectiveness.addiction, 0),
          inactivity: Utils.num(person.inactivity || person.inactiveDays || effectiveness.inactivity, 0),
          wage: Utils.num(person.wage, 0),
          efficiency: Utils.num(person.efficiency || person.employeeEfficiency || effectiveness.total, 0),
          racingRank: person.racingRank || '',
          racingSkill: person.racingSkill || '',
          lastActionTimestamp: Utils.int(person.lastActionTimestamp || (person.lastAction && person.lastAction.timestamp), 0),
          daysInCompany: Utils.int(person.daysInCompany || person.days_in_company || person.days, 0),
          strikeHistory: Utils.clone(Array.isArray(person.strikeHistory) ? person.strikeHistory : []),
          raw: { strikeHistory: Utils.clone(Array.isArray(person.strikeHistory) ? person.strikeHistory : []) }
        });
      });
      return rows;
    },
    staffPayloadForApi() {
      return {
        members: UI.staffMembersForApi(),
        snapshots: UI.staffSnapshotsForApi()
      };
    },
    staffCardEditFields(updates) {
      const allowed = [
        'contractType', 'role', 'hiredAt', 'joinedDate', 'leftAt', 'endedAt', 'exitType',
        'merits', 'statPriority', 'racingRank', 'racingSkill', 'interestedIn',
        'interestedOther', 'trainingInterest', 'oneYearGoal', 'roleHistory', 'strikeHistory', 'status'
      ];
      const fields = {};
      allowed.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(updates || {}, key)) fields[key] = updates[key];
      });
      return fields;
    },
    recordStaffCardEdit(person, updates) {
      const fields = UI.staffCardEditFields(updates);
      if (!Object.keys(fields).length) return;
      UI.state.staff.localEdits = UI.state.staff.localEdits && typeof UI.state.staff.localEdits === 'object' && !Array.isArray(UI.state.staff.localEdits) ? UI.state.staff.localEdits : {};
      const merged = Object.assign({}, person || {}, updates || {});
      const keys = Store.staffEditKeys(merged);
      const updatedAt = Utils.nowIso();
      keys.forEach((key) => {
        const previous = UI.state.staff.localEdits[key] || {};
        UI.state.staff.localEdits[key] = {
          updatedAt,
          fields: Object.assign({}, previous.fields || {}, fields)
        };
      });
      UI.state.staff.localEditVersion = Utils.int(UI.state.staff.localEditVersion, 0) + 1;
      Store.saveStaffLocalEdits(UI.state);
    },
    clearStaffCardEdits() {
      UI.state.staff.localEdits = {};
      UI.state.staff.localEditVersion = Utils.int(UI.state.staff.localEditVersion, 0);
      Store.clearStaffLocalEdits();
      Store.save(UI.state);
    },
    scheduleStaffCardCloudSave(delay) {
      if (!Store.canUseCloudWorkspace(UI.state)) return;
      clearTimeout(UI.staffCardCloudTimer);
      const version = Utils.int(UI.state.staff.localEditVersion, 0);
      UI.staffCardCloudTimer = setTimeout(() => UI.uploadStaffCardCloudSave(version), delay == null ? 700 : delay);
    },
    async uploadStaffCardCloudSave(version) {
      if (!Store.canUseCloudWorkspace(UI.state)) return;
      try {
        const payload = UI.staffPayloadForApi();
        if (!(payload.members || []).length && !(payload.snapshots || []).length) return;
        const result = await Store.cisCompanyApi(UI.state, '/sync/staff', payload, 30000);
        if (!result || !result.ok) throw new Error(result && result.reason || 'Staff card cloud sync failed.');
        if (Utils.int(UI.state.staff.localEditVersion, 0) === Utils.int(version, 0)) UI.clearStaffCardEdits();
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] Staff card cloud sync failed.', error);
        UI.toast(`Staff card saved locally; cloud sync failed: ${error && error.message ? error.message : error}`);
      }
    },
    scheduleSettingsCloudSave(delay) {
      if (!Store.canUseCloudWorkspace(UI.state)) return;
      clearTimeout(UI.settingsCloudTimer);
      UI.settingsCloudTimer = setTimeout(() => UI.uploadSettingsCloudSave(), delay == null ? 900 : delay);
    },
    async uploadSettingsCloudSave() {
      if (!Store.canUseCloudWorkspace(UI.state)) return;
      try {
        const result = await Store.cisCompanyApi(UI.state, '/sync/business', UI.businessPayloadForApi(), 30000);
        if (!result || !result.ok) throw new Error(result && result.reason || 'Settings cloud sync failed.');
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] Settings cloud sync failed.', error);
        UI.toast(`Settings saved locally; cloud sync failed: ${error && error.message ? error.message : error}`);
      }
    },
    recordLedgerPending() {
      Ledger.prepare(UI.state);
      Store.saveLedgerPendingOrders(UI.state.ledger || []);
    },
    clearLedgerPending() {
      Store.clearLedgerPending();
    },
    scheduleLedgerCloudSave(delay) {
      if (!Store.canUseCloudWorkspace(UI.state)) return;
      clearTimeout(UI.ledgerCloudTimer);
      UI.ledgerCloudTimer = setTimeout(() => UI.uploadLedgerCloudSave(), delay == null ? 900 : delay);
    },
    async uploadLedgerCloudSave() {
      if (!Store.canUseCloudWorkspace(UI.state)) return;
      try {
        Ledger.prepare(UI.state);
        const orders = UI.state.ledger || [];
        const result = await Store.cisCompanyApi(UI.state, '/training-orders', { orders, replace: true }, 45000);
        if (!result || !result.ok) throw new Error(result && result.reason || 'Training orders cloud sync failed.');
        UI.clearLedgerPending();
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] Training orders cloud sync failed.', error);
        UI.toast(`Training orders saved locally; cloud sync failed: ${error && error.message ? error.message : error}`);
      }
    },
    scheduleWorkspaceMirrorSave(reason, delay) {
      if (!Store.canUseCloudWorkspace(UI.state)) return;
      UI.workspaceMirrorReason = reason || UI.workspaceMirrorReason || 'autosave';
      clearTimeout(UI.workspaceMirrorTimer);
      UI.workspaceMirrorTimer = setTimeout(() => UI.uploadWorkspaceMirrorSave(), delay == null ? 1800 : delay);
    },
    async uploadWorkspaceMirrorSave() {
      if (!Store.canUseCloudWorkspace(UI.state)) return;
      if (UI.workspaceMirrorInFlight) {
        UI.scheduleWorkspaceMirrorSave(UI.workspaceMirrorReason || 'autosave', 1500);
        return;
      }
      UI.workspaceMirrorInFlight = true;
      try {
        await Store.saveWorkspaceMirror(UI.state, { reason: UI.workspaceMirrorReason || 'autosave', timeout: 30000 });
      } catch (error) {
        console.warn('[Pythagoras Project - CIS] Workspace mirror sync failed.', error);
      } finally {
        UI.workspaceMirrorInFlight = false;
      }
    },
    businessPayloadForApi() {
      const profile = UI.state.company.profile || {};
      const detailed = UI.state.company.detailed || {};
      const sanitized = Store.cloudState(UI.state);
      return {
        company: {
          id: profile.id || detailed.id || UI.state.settings.companyId || '',
          name: profile.name || profile.companyName || '',
          companyName: profile.name || profile.companyName || '',
          companyTypeId: profile.typeId || UI.state.settings.companyTypeId || '',
          companyTypeName: profile.typeName || UI.state.settings.companyTypeName || '',
          directorId: profile.directorId || UI.state.settings.userId || '',
          rating: profile.rating || UI.state.settings.companyStars || 0,
          foundedAt: profile.created || profile.foundedAt || UI.state.company.newsSync.earliestTimestamp || 0
        },
        profile,
        detailed,
        adBudgetHistory: UI.adBudgetHistoryForApi(),
        settings: sanitized.settings || {}
      };
    },
    defaultSyncPayload(id) {
      if (id === 'business') return { business: true, staff: true, stock: true };
      if (id === 'employees' || id === 'past-staff') return { staff: true };
      if (id === 'stock') return { stock: true };
      return {};
    },
    async uploadSyncState(id, payloads) {
      const job = UI.syncJobs[id] || { label: id, progress: 0, status: 'running' };
      UI.syncJobs[id] = job;
      if (!Store.canUseCloudWorkspace(UI.state)) {
        UI.syncStep(id, 'Pythagoras API workspace is not configured; saved locally only.', 98);
        return null;
      }
      const parts = payloads || UI.defaultSyncPayload(id);
      const requests = [];
      if (parts.business) requests.push({ label: 'business profile', path: '/sync/business', payload: UI.businessPayloadForApi(), timeout: 30000 });
      if (parts.staff) {
        const staffPayload = parts.staff === true ? UI.staffPayloadForApi() : parts.staff;
        if ((staffPayload.members || []).length || (staffPayload.snapshots || []).length) requests.push({ label: 'staff', path: '/sync/staff', payload: staffPayload, timeout: 30000 });
      }
      if (parts.stock) {
        const stock = parts.stock === true ? UI.stockItemsForApi() : UI.stockItemsForApi(parts.stock);
        if (Object.keys(stock).length) requests.push({ label: 'stock', path: '/sync/stock', payload: { stock, syncedAt: Utils.nowIso() }, timeout: 30000 });
      }
      if (parts.events) {
        const events = Array.isArray(parts.events) ? parts.events : [];
        for (let start = 0; start < events.length; start += 500) {
          const chunk = events.slice(start, start + 500);
          requests.push({ label: `events ${start + 1}-${start + chunk.length}`, path: '/sync/events', payload: { events: chunk }, timeout: 30000 });
        }
      }
      if (parts.reports) {
        const reports = UI.reportRowsForApi(parts.reports);
        for (let start = 0; start < reports.length; start += 500) {
          const chunk = reports.slice(start, start + 500);
          requests.push({ label: `daily reports ${start + 1}-${start + chunk.length}`, path: '/sync/reports', payload: { reports: chunk }, timeout: 30000 });
        }
      }
      if (parts.orders) {
        const orders = parts.orders === true ? (UI.state.ledger || []) : parts.orders;
        for (let start = 0; start < (orders || []).length; start += 250) {
          const chunk = orders.slice(start, start + 250);
          requests.push({ label: `training orders ${start + 1}-${start + chunk.length}`, path: '/training-orders', payload: { orders: chunk }, timeout: 30000 });
        }
      }
      if (!requests.length) {
        UI.syncStep(id, 'No parsed rows needed a Pythagoras API upload.', 98);
        return {};
      }
      const summary = {};
      for (let index = 0; index < requests.length; index += 1) {
        const request = requests[index];
        const progress = Math.min(97, Math.max(job.progress || 0, 84) + Math.round((index / requests.length) * 12));
        UI.syncStep(id, `uploading ${request.label} to Pythagoras API.`, progress);
        const result = await Store.cisCompanyApi(UI.state, request.path, request.payload, request.timeout);
        if (!result || !result.ok) throw new Error(result && result.reason || `${request.label} upload failed.`);
        summary[request.label] = result.saved || result.summary || true;
      }
      UI.syncStep(id, 'Pythagoras API accepted the parsed data.', 98);
      return summary;
    },
    finishSync(id, message) {
      const job = UI.syncJobs[id] || { label: id, progress: 100, status: 'done' };
      job.progress = 100;
      job.status = 'done';
      UI.syncJobs[id] = job;
      UI.syncLogMessage(`${job.label}: ${message || 'complete.'}`);
      UI.updateSyncUi();
      setTimeout(() => {
        if (UI.syncJobs[id] && UI.syncJobs[id].status === 'done') {
          delete UI.syncJobs[id];
          UI.updateSyncUi();
        }
      }, 2500);
    },
    failSync(id, error) {
      const job = UI.syncJobs[id] || { label: id, progress: 100, status: 'error' };
      job.progress = 100;
      job.status = 'error';
      UI.syncJobs[id] = job;
      UI.syncLogMessage(`${job.label}: failed - ${error && error.message ? error.message : error}`);
      UI.updateSyncUi();
    },
    syncControlPanel() {
      const disabled = UI.apiKeyMissing() ? ' disabled' : '';
      const backfillDisabled = disabled || (!UI.canUseHistoricalBackfill() ? ' disabled' : '');
      const backfillTitle = UI.canUseHistoricalBackfill() ? 'Fetch older company news within your entitlement window' : UI.historyWindowMessage();
      return `<div class="pp-sync-center" data-tour="sync-center">
        <div class="pp-sync-groups">
        <div class="pp-sync-group">
          <span class="pp-sync-group-title">Daily sync</span>
          <button class="pp-btn is-primary ${UI.syncProgressClass('smart-sync')}" style="${UI.syncProgressStyle('smart-sync')}" type="button" data-action="smart-sync" data-sync-action="smart-sync"${disabled}>Smart sync</button>
          <button class="${UI.syncButtonClass('business', true)} ${UI.syncProgressClass('business')}" style="${UI.syncProgressStyle('business')}" type="button" data-action="sync-business" data-sync-action="business" data-tour="sync-business"${disabled}>Sync business</button>
          <button class="${UI.syncButtonClass('news', false)} ${UI.syncProgressClass('news')}" style="${UI.syncProgressStyle('news')}" type="button" data-action="sync-news" data-sync-action="news" data-tour="sync-news"${disabled}>Sync latest news</button>
          <button class="${UI.syncButtonClass('employees', false)} ${UI.syncProgressClass('employees')}" style="${UI.syncProgressStyle('employees')}" type="button" data-action="sync-employees" data-sync-action="employees" data-tour="sync-employees"${disabled}>Sync employees</button>
          <button class="${UI.syncButtonClass('stock', false)} ${UI.syncProgressClass('stock')}" style="${UI.syncProgressStyle('stock')}" type="button" data-action="sync-stock" data-sync-action="stock" data-tour="sync-stock"${disabled}>Sync services sold</button>
          <button class="pp-btn ${UI.syncProgressClass('training-log')}" style="${UI.syncProgressStyle('training-log')}" type="button" data-action="sync-training-log" data-sync-action="training-log" data-tour="sync-training-log"${disabled}>Sync training log</button>
        </div>
        <div class="pp-sync-group">
          <span class="pp-sync-group-title">History tools</span>
          <button class="pp-btn ${UI.syncProgressClass('news-backfill')}" style="${UI.syncProgressStyle('news-backfill')}" type="button" data-action="sync-news-backfill" data-sync-action="news-backfill" data-tour="sync-older-news" title="${Utils.esc(backfillTitle)}"${backfillDisabled}>Fetch older news</button>
          <button class="pp-btn ${UI.syncProgressClass('past-staff')}" style="${UI.syncProgressStyle('past-staff')}" type="button" data-action="sync-past-staff" data-sync-action="past-staff" data-tour="sync-past-staff"${disabled}>Sync past staff</button>
        </div>
        <div class="pp-sync-group">
          <span class="pp-sync-group-title">Help</span>
          <button class="pp-btn is-quiet" type="button" data-action="start-tour">Tutorial</button>
          ${UI.apiKeyMissing() ? '<span class="pp-note bad">Add an API key first.</span>' : ''}
        </div>
        </div>
        <div class="pp-sync-console" data-sync-console>${UI.syncConsoleHtml()}</div>
      </div>`;
    },
    companyTypeSelect() {
      const current = String(UI.state.settings.companyTypeId || '');
      const options = Object.entries(Company.typeNames).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
      return `<select class="pp-select" name="companyTypeId"><option value="">Not set</option>${options.map(([id, name]) => `<option value="${Utils.esc(id)}" ${current === String(id) ? 'selected' : ''}>${Utils.esc(name)} (${Utils.esc(id)})</option>`).join('')}</select>`;
    },
    loyaltyTierBuilder(tiers) {
      const rows = (Array.isArray(tiers) && tiers.length ? tiers : DEFAULTS.settings.loyaltyTiers).map((tier, index) => UI.loyaltyTierRow(tier, index)).join('');
      return `<div class="pp-field span-6">
        <span>Loyalty tiers</span>
        <div class="pp-loyalty-list" data-loyalty-list>${rows}</div>
      </div>`;
    },
    loyaltyTierRow(tier, index) {
      const minOptions = [5, 10, 25, 50, 75, 100, 150, 200];
      const percentOptions = [1, 3, 5, 7, 10, 15, 20, 25, 50];
      const option = (value, current, suffix) => `<option value="${value}" ${Utils.int(current, 0) === value ? 'selected' : ''}>${value}${suffix}</option>`;
      return `<div class="pp-row-actions" data-loyalty-row="${index}">
        <select class="pp-select" data-loyalty-min>${minOptions.map((value) => option(value, tier.min, ' trains')).join('')}</select>
        <select class="pp-select" data-loyalty-percent>${percentOptions.map((value) => option(value, tier.percent, '%')).join('')}</select>
        <button class="pp-btn is-danger" type="button" data-action="delete-loyalty-tier" data-index="${index}">Remove</button>
      </div>`;
    },
    kv(label, value) {
      return `<div class="pp-kv"><span>${Utils.esc(label)}</span><span>${value}</span></div>`;
    },
    starRating(rating) {
      const filled = Utils.clamp(Utils.int(rating, 0), 0, 10);
      return `<span class="pp-stars" title="${filled}/10">${Array.from({ length: 10 }, (_, index) => (index < filled ? '<span>&#9733;</span>' : '&#9733;')).join('')}</span>`;
    },
    trainingSupplyNote() {
      const rating = Utils.clamp(Utils.int(UI.state.settings.companyStars, 1), 1, 10);
      const supply = Planner.dailySupply(UI.state.settings);
      const trainer = UI.state.settings.trainerAssigned;
      return `${Utils.esc(supply)} <span class="pp-note">per day (${Utils.esc(rating)} from rating${trainer ? ' + Trainer detected' : '; no Trainer detected'})</span>`;
    },
    paidCapSelect(settings) {
      const maxCap = Planner.paidCapLimit(settings);
      const current = Utils.clamp(Utils.int(settings.maxPaidTrainsPerDay, maxCap), 0, maxCap);
      const options = Array.from({ length: maxCap + 1 }, (_, index) => maxCap - index);
      return `<select class="pp-select pp-select-fit" name="maxPaidTrainsPerDay">${options.map((value) => `<option value="${value}" ${current === value ? 'selected' : ''}>${value}</option>`).join('')}</select>`;
    },
    percentBar(value) {
      const percent = Utils.clamp(Utils.percent(value, 0), 0, 100);
      return `<div class="pp-percent-bar" style="--percent:${percent}%"><span></span><b>${Utils.esc(percent)}%</b></div>`;
    },
    effectivenessThreshold(key) {
      const settings = UI.notificationSettings();
      if (key === 'addiction') return Math.max(1, Utils.num(settings.addiction.threshold, 4));
      if (key === 'inactivity') return Math.max(1, Utils.int(settings.inactivity.thresholdDays, 3));
      return null;
    },
    effectivenessValueTone(key, value) {
      const number = Utils.num(value, 0);
      if (number > 0) return 'good';
      if (number >= 0) return '';
      const threshold = UI.effectivenessThreshold(key);
      if (threshold == null) return 'bad';
      const abs = Math.abs(number);
      if (abs > threshold) return 'bad';
      if (abs >= Math.max(1, threshold - 1)) return 'warn';
      return '';
    },
    effectivenessLabel(key) {
      return Utils.startCase(String(key || '').replace(/_/g, ' '));
    },
    effectivenessValue(value) {
      const number = Utils.num(value, 0);
      return `${number > 0 ? '+' : ''}${Math.round(number)}`;
    },
    effectivenessTooltip(effectiveness) {
      if (!effectiveness || !effectiveness.details || !Object.keys(effectiveness.details).length) return '<div class="pp-hover-tooltip-empty">No effectiveness analysis synced yet.</div>';
      const total = Utils.num(effectiveness.total, 0);
      const rows = Object.entries(effectiveness.details).map(([key, value]) => {
        const tone = UI.effectivenessValueTone(key, value);
        return `<div class="pp-hover-tooltip-row"><span class="pp-hover-tooltip-key">${Utils.esc(UI.effectivenessLabel(key))}</span><span class="pp-hover-tooltip-value${tone ? ` is-${tone}` : ''}">${Utils.esc(UI.effectivenessValue(value))}</span></div>`;
      }).join('');
      return `<div class="pp-hover-tooltip-head"><strong>Effectiveness</strong><span class="pp-hover-tooltip-total">${Utils.esc(UI.effectivenessValue(total))}</span></div><div class="pp-hover-tooltip-list">${rows}</div>`;
    },
    statVector(person) {
      return {
        man: Utils.num(person && person.man, 0),
        int: Utils.num(person && person.int, 0),
        end: Utils.num(person && person.end, 0)
      };
    },
    statTotal(vector) {
      return Utils.num(vector && vector.man, 0) + Utils.num(vector && vector.int, 0) + Utils.num(vector && vector.end, 0);
    },
    companyTemplateRoleSuggestion(person) {
      const status = Planner.roleTemplateStatus(person, UI.state);
      if (!status) return null;
      const current = UI.roleKey(person && person.role) === UI.roleKey(status.label);
      return {
        key: UI.roleKey(status.label),
        label: status.label,
        source: status.source,
        score: (status.shortage ? 2000 : 1000) + status.fit / 100000,
        met: current && !status.shortage
      };
    },
    roleRequirementSuggestion(person) {
      const stats = UI.statVector(person);
      const roles = UI.rolesList().filter(([key, label]) => !UI.isScriptOnlyRole(key, label));
      const candidates = roles.map(([key, label]) => {
        const req = UI.state.settings.wageRoleRequirements && UI.state.settings.wageRoleRequirements[key] ? UI.state.settings.wageRoleRequirements[key] : {};
        const man = Utils.num(req.man, 0);
        const int = Utils.num(req.int, 0);
        const end = Utils.num(req.end, 0);
        const total = man + int + end;
        if (!total) return null;
        const ratios = [
          man ? Math.min(stats.man / man, 1) : 1,
          int ? Math.min(stats.int / int, 1) : 1,
          end ? Math.min(stats.end / end, 1) : 1
        ];
        const coverage = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
        const met = (!man || stats.man >= man) && (!int || stats.int >= int) && (!end || stats.end >= end);
        return { key, label, source: 'role requirements', score: (met ? 1000 : 0) + coverage * 100 + total / 100000, met };
      }).filter(Boolean);
      if (!candidates.length) return null;
      candidates.sort((a, b) => b.score - a.score || String(a.label).localeCompare(String(b.label)));
      return candidates[0];
    },
    rolePoolSuggestion(person) {
      const stats = UI.statVector(person);
      const total = UI.statTotal(stats);
      if (!total) return null;
      const pools = new Map();
      const rows = (UI.state.staff.current || []).concat(UI.state.company.profile.employees || []);
      rows.forEach((row) => {
        const role = row && row.role;
        const key = UI.roleKey(role);
        if (!role || UI.isScriptOnlyRole(key, role) || UI.isProfileDirector(row, UI.state.company.profile)) return;
        const vector = UI.statVector(row);
        const rowTotal = UI.statTotal(vector);
        if (!rowTotal) return;
        const pool = pools.get(key) || { key, label: UI.roleLabel(role), man: 0, int: 0, end: 0, total: 0, count: 0 };
        pool.man += vector.man;
        pool.int += vector.int;
        pool.end += vector.end;
        pool.total += rowTotal;
        pool.count += 1;
        pools.set(key, pool);
      });
      const candidates = Array.from(pools.values()).map((pool) => {
        const poolVector = { man: pool.man / pool.count, int: pool.int / pool.count, end: pool.end / pool.count };
        const poolTotal = UI.statTotal(poolVector);
        if (!poolTotal) return null;
        const personMix = [stats.man / total, stats.int / total, stats.end / total];
        const poolMix = [poolVector.man / poolTotal, poolVector.int / poolTotal, poolVector.end / poolTotal];
        const diff = personMix.reduce((sum, value, index) => sum + Math.abs(value - poolMix[index]), 0);
        const shapeScore = Math.max(0, 1 - diff / 2) * 75;
        const totalScore = Math.min(total / poolTotal, poolTotal / total, 1) * 25;
        return { key: pool.key, label: pool.label, source: `${pool.count} staff role pool`, score: shapeScore + totalScore };
      }).filter(Boolean);
      if (!candidates.length) return null;
      candidates.sort((a, b) => b.score - a.score || String(a.label).localeCompare(String(b.label)));
      return candidates[0];
    },
    suggestedRole(person) {
      return UI.companyTemplateRoleSuggestion(person) || UI.roleRequirementSuggestion(person) || UI.rolePoolSuggestion(person);
    },
    suggestedRolePill(person) {
      const suggestion = UI.suggestedRole(person);
      if (!suggestion) return '<span class="pp-note">Need stats</span>';
      const colour = UI.roleColor(suggestion.label);
      const current = UI.roleKey(person && person.role) === UI.roleKey(suggestion.label);
      const title = `${suggestion.source}; score ${Math.round(suggestion.score)}${current ? '; matches current role' : ''}`;
      return `<span class="pp-pill" style="--pill-color:${Utils.esc(colour)}" title="${Utils.esc(title)}">${Utils.esc(UI.roleLabel(suggestion.label))}</span>`;
    },
    profileSortHeader(key, label) {
      const active = UI.state.ui.profileSort === key;
      const marker = active ? (UI.state.ui.profileSortDir === 'desc' ? ' v' : ' ^') : '';
      return `<button class="pp-sort ${active ? 'is-active' : ''}" type="button" data-profile-sort="${key}">${Utils.esc(label)}${marker}</button>`;
    },
    sortedProfileEmployees(employees) {
      const sortKey = UI.state.ui.profileSort || 'name';
      const direction = UI.state.ui.profileSortDir === 'desc' ? -1 : 1;
      const read = (person) => {
        if (sortKey === 'daysInCompany') return Utils.int(person.daysInCompany, 0);
        if (sortKey === 'lastAction') return Utils.int(person.lastActionTimestamp, 0);
        if (sortKey === 'effectiveness') return Utils.num(person.effectiveness && person.effectiveness.total, 0);
        return String(person[sortKey] || '').toLowerCase();
      };
      return (employees || []).slice().sort((a, b) => {
        const first = read(a);
        const second = read(b);
        if (typeof first === 'number' && typeof second === 'number') return (first - second) * direction;
        return String(first).localeCompare(String(second)) * direction;
      });
    },
    profileDirector(profile) {
      const directorId = String(profile.directorId || UI.state.settings.userId || '').trim();
      const employees = profile.employees || [];
      const fromProfile = employees.find((person) => {
        const id = String(person.id || '').trim();
        const role = String(person.role || '').toLowerCase();
        return (directorId && id === directorId) || role.includes('director');
      });
      const fromTimeline = (UI.state.staff.directorsCurrent || []).find((person) => {
        const id = String(person.id || '').trim();
        return (directorId && id === directorId) || String(person.role || '').toLowerCase().includes('director');
      });
      return fromProfile || fromTimeline ? Object.assign({}, fromTimeline || {}, fromProfile || {}) : null;
    },
    isProfileDirector(person, profile) {
      return Company.isDirectorEmployee(person, profile.directorId || UI.state.settings.userId || '');
    },
    directorProfileLine(profile) {
      const director = UI.profileDirector(profile);
      if (!director) return 'Not detected';
      const id = director.id ? ` [ ${Utils.esc(director.id)} ]` : '';
      const days = Utils.int(director.daysInCompany, 0) || UI.personTenureDays(Object.assign({}, director, { hiredAt: director.hiredAt || director.startedAt }));
      return `${Utils.esc(director.name || 'Director')}${id}${days ? ` - ${Utils.esc(days)} day${days === 1 ? '' : 's'}` : ''}`;
    },
    stockStorageLabel(detailed) {
      const stockUsed = (UI.state.company.stock.items || []).reduce((sum, item) => sum + Utils.num(item.inStock, 0), 0);
      const capacity = Utils.num(detailed.storageSpace, 0);
      const stockText = capacity || stockUsed ? ` (${stockUsed.toLocaleString()} / ${capacity.toLocaleString()} slots)` : '';
      return `${Utils.esc(detailed.storageSize || 'Not detected')}${stockText}`;
    },
    companyAgeLine(profile) {
      let days = Utils.int(profile.ageDays, 0);
      const foundedTimestamp = Company.companyStartTimestamp(profile.foundedTimestamp);
      const start = foundedTimestamp || (UI.state.company.newsSync && UI.state.company.newsSync.earliestTimestamp) || (days ? Math.floor(Date.now() / 1000) - days * 86400 : 0);
      const startDate = Utils.dateObject(start);
      if (!days && startDate) days = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / 86400000));
      const human = start ? Utils.yearMonthAge(start, new Date()) : '';
      const dayText = `${days.toLocaleString()} day${days === 1 ? '' : 's'}`;
      return human ? `${Utils.esc(human)} - ${Utils.esc(dayText)}` : Utils.esc(dayText);
    },
    companyFoundedLine(profile) {
      const profileStart = Company.companyStartTimestamp(profile.foundedTimestamp) || Company.companyStartTimestamp(profile.foundedAt);
      const estimateStart = UI.state.company.newsSync && UI.state.company.newsSync.earliestTimestamp ? Company.companyStartTimestamp(UI.state.company.newsSync.earliestTimestamp) : 0;
      const start = profileStart || estimateStart;
      return start ? Utils.esc(Utils.dateInput(start)) : 'Not detected';
    },
    companyProfileReportMetrics() {
      const rows = UI.reportDailyRows().filter((row) => row && row.hasReport && (row.customers || row.income));
      const latest = rows[0] || {};
      const weekStart = latest.date ? UI.weekStartInput(latest.date) : '';
      const weekEnd = weekStart ? Utils.addDays(weekStart, 6) : '';
      const weekly = weekStart
        ? rows.filter((row) => row.date >= weekStart && row.date <= weekEnd).reduce((sum, row) => {
          sum.income += Utils.num(row.income, 0);
          sum.customers += Utils.num(row.customers, 0);
          return sum;
        }, { income: 0, customers: 0 })
        : { income: 0, customers: 0 };
      return {
        dailyIncome: Utils.num(latest.income, 0),
        dailyCustomers: Utils.num(latest.customers, 0),
        weeklyIncome: Utils.num(weekly.income, 0),
        weeklyCustomers: Utils.num(weekly.customers, 0)
      };
    },
    companyProfilePanel() {
      const profile = UI.state.company.profile;
      const detailed = UI.state.company.detailed;
      const reportMetrics = UI.companyProfileReportMetrics();
      const dailyIncome = Utils.num(profile.dailyIncome, 0) || reportMetrics.dailyIncome;
      const dailyCustomers = Utils.num(profile.dailyCustomers, 0) || reportMetrics.dailyCustomers;
      const weeklyIncome = Utils.num(profile.weeklyIncome, 0) || reportMetrics.weeklyIncome;
      const weeklyCustomers = Utils.num(profile.weeklyCustomers, 0) || reportMetrics.weeklyCustomers;
      const rating = Utils.clamp(Utils.int(profile.rating, 0), 0, 10);
      const employees = UI.sortedProfileEmployees((profile.employees || []).filter((person) => !UI.isProfileDirector(person, profile)));
      const effectivenessTotals = employees.map((person) => Utils.num(person.effectiveness && person.effectiveness.total, 0)).filter((value) => value > 0);
      const averageEffectiveness = effectivenessTotals.length ? effectivenessTotals.reduce((sum, value) => sum + value, 0) / effectivenessTotals.length : 0;
      const averageEffectivenessLine = averageEffectiveness
        ? `${Utils.esc(averageEffectiveness.toLocaleString(undefined, { maximumFractionDigits: 1 }))} <span class="pp-note">avg across ${Utils.esc(effectivenessTotals.length)} employee${effectivenessTotals.length === 1 ? '' : 's'}</span>`
        : 'Not detected';
      const staffCount = Company.profileHeadcount(profile);
      const syncTimes = [profile.lastSynced, detailed.lastSynced, UI.state.company.stock.lastSynced]
        .map((value) => value ? new Date(value).getTime() : 0)
        .filter((value) => Number.isFinite(value) && value > 0);
      const lastBusinessSync = syncTimes.length ? new Date(Math.max.apply(null, syncTimes)).toISOString() : '';
      return `<section class="pp-panel" data-tour="business-profile">
        <div class="pp-head">
          <div><h3>Business Profile</h3><p>One sync updates company profile, details, stock, and employees.</p></div>
        </div>
        <div class="pp-content">
          ${UI.kv('Last sync', Utils.esc(Utils.dateTime(lastBusinessSync)))}
          ${UI.kv('Rating', `${UI.starRating(rating)} <span class="pp-note">${Utils.esc(rating)} / 10</span>`)}
          ${UI.kv('Director', UI.directorProfileLine(profile))}
          ${UI.kv('Company', `${Utils.esc(profile.name || 'Not detected')} ${profile.id ? `#${Utils.esc(profile.id)}` : ''}`)}
          ${UI.kv('Type', `${Utils.esc(profile.typeName || 'Not detected')} ${profile.typeId ? `(${Utils.esc(profile.typeId)})` : ''}`)}
          ${UI.kv('Trainings', UI.trainingSupplyNote())}
          ${UI.kv('Company age', UI.companyAgeLine(profile))}
          ${UI.kv('Founded', UI.companyFoundedLine(profile))}
          ${UI.kv('Staff', `${Utils.esc(staffCount)} / ${Utils.esc(profile.maxEmployees || 'unknown')}`)}
          ${UI.kv('Average effectiveness', averageEffectivenessLine)}
          ${UI.kv('Daily', `${Utils.money(dailyIncome)} / ${Utils.esc(dailyCustomers || 0)} customers`)}
          ${UI.kv('Weekly', `${Utils.money(weeklyIncome)} / ${Utils.esc(weeklyCustomers || 0)} customers`)}
          <div class="pp-form-title">Company details</div>
          ${UI.kv('Funds', Utils.money(detailed.funds))}
          ${UI.kv('Popularity', UI.percentBar(detailed.popularity))}
          ${UI.kv('Efficiency', UI.percentBar(detailed.efficiency))}
          ${UI.kv('Environment', UI.percentBar(detailed.environment))}
          ${UI.kv('Training availability', `${Utils.esc(detailed.trainsAvailable)} / 20`)}
          ${UI.kv('Advertising budget', Utils.money(detailed.advertisingBudget))}
          ${UI.kv('Company size', Utils.esc(detailed.companySize || 'Not detected'))}
          ${UI.kv('Staffroom', Utils.esc(detailed.staffroomSize || 'Not detected'))}
          ${UI.kv('Storage', UI.stockStorageLabel(detailed))}
          ${UI.kv('Company value', Utils.money(detailed.value))}
          ${employees.length ? `<div class="pp-table-title"><span>Current employee effectiveness</span><span class="pp-note">${employees.length} row${employees.length === 1 ? '' : 's'}</span></div><div class="pp-wrap" style="margin-top:10px"><table class="pp-table pp-effectiveness-table"><thead><tr><th>#</th><th>${UI.profileSortHeader('name', 'Employee')}</th><th>${UI.profileSortHeader('role', 'Role')}</th><th>Suggested</th><th>${UI.profileSortHeader('daysInCompany', 'Days')}</th><th>${UI.profileSortHeader('effectiveness', 'Effectiveness')}</th><th>${UI.profileSortHeader('lastAction', 'Last action')}</th></tr></thead><tbody>${employees.map((person, index) => `<tr><td>${index + 1}</td><td>${Utils.esc(person.name)}</td><td>${Utils.esc(person.role)}</td><td>${UI.suggestedRolePill(person)}</td><td>${Utils.esc(person.daysInCompany)}</td><td>${person.effectiveness && person.effectiveness.total ? `<span class="pp-effectiveness-tip" tabindex="0" data-tooltip-html="${Utils.esc(UI.effectivenessTooltip(person.effectiveness))}">${Utils.esc(person.effectiveness.total)}</span>` : 'Not detected'}</td><td>${Utils.esc(person.lastAction || 'Not detected')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="pp-empty" style="margin-top:10px">No non-director profile employees synced yet.</div>'}
        </div>
      </section>`;
    },
    companyDetailedPanel() {
      const detailed = UI.state.company.detailed;
      return `<section class="pp-panel" data-tour="company-detailed">
        <div class="pp-head">
          <div><h3>Company detailed</h3><p>Funds, upgrades, storage, and company value.</p></div>
        </div>
        <div class="pp-content">
          ${UI.kv('Last sync', Utils.esc(Utils.dateTime(detailed.lastSynced)))}
          ${UI.kv('Funds', Utils.money(detailed.funds))}
          ${UI.kv('Popularity', UI.percentBar(detailed.popularity))}
          ${UI.kv('Efficiency', UI.percentBar(detailed.efficiency))}
          ${UI.kv('Environment', UI.percentBar(detailed.environment))}
          ${UI.kv('Training availability', `${Utils.esc(detailed.trainsAvailable)} / 20`)}
          ${UI.kv('Advertising budget', Utils.money(detailed.advertisingBudget))}
          ${UI.kv('Company size', Utils.esc(detailed.companySize || 'Not detected'))}
          ${UI.kv('Staffroom', Utils.esc(detailed.staffroomSize || 'Not detected'))}
          ${UI.kv('Storage', UI.stockStorageLabel(detailed))}
          ${UI.kv('Company value', Utils.money(detailed.value))}
        </div>
      </section>`;
    },
    stockPanel() {
      const stock = UI.state.company.stock;
      const plan = Company.stockPlan(UI.state);
      const warnings = new Set(Company.stockWarnings(UI.state).map((item) => item.key));
      if (!stock.items.length) {
        return `<section class="pp-panel" data-tour="stock-management"><div class="pp-head"><div><h3>Stock management</h3><p>Use Settings -> Sync center to create service rows and low-stock warnings.</p></div></div><div class="pp-content"><div class="pp-empty">No stock/service rows detected yet.</div></div></section>`;
      }
      const items = UI.sortedRows('stock', stock.items, {
        name: (item) => String(item.name || '').toLowerCase(),
        cost: (item) => Utils.num(item.cost, 0),
        rrp: (item) => Utils.num(item.rrp, 0),
        price: (item) => Utils.num(item.price, 0),
        inStock: (item) => Utils.num(item.inStock, 0),
        onOrder: (item) => Utils.num(item.onOrder, 0),
        soldAmount: (item) => Utils.num(item.soldAmount, 0),
        soldWorth: (item) => Utils.num(item.soldWorth, 0),
        needsStock: (item) => item.needsStock ? 1 : 0,
        warning: (item) => Utils.num(item.warningMode === 'amount' ? item.warningAmount : item.warningPercent, 0),
        restockQty: (item) => {
          const row = plan.byKey.get(item.key);
          return row ? Utils.num(row.restockQty, 0) : 0;
        }
      }, 'name', 'asc');
      return `<section class="pp-panel" data-tour="stock-management">
        <div class="pp-head"><div><h3>Stock management</h3><p>Use the warehouse cap from Business Profile, then balance restock quantities by sales demand.</p></div><div class="pp-row-actions"><button class="pp-btn" type="button" data-action="suggest-stock-order">Suggest restock</button><button class="pp-btn" type="button" data-action="apply-stock-order">Apply in Torn</button></div></div>
        <div class="pp-content">
          <div class="pp-statline pp-stock-summary">
            ${UI.stat('Storage now', `${plan.currentStorage.toLocaleString()} / ${plan.capacity.toLocaleString() || '0'}`)}
            ${UI.stat('Pending orders', plan.pendingStorage.toLocaleString())}
            ${UI.stat('Suggested order', plan.orderQuantity.toLocaleString())}
            ${UI.stat('Projected storage', `${plan.projectedStorage.toLocaleString()} / ${plan.capacity.toLocaleString() || '0'}`)}
            ${UI.stat('Order cost', Utils.money(plan.orderCost))}
          </div>
          <p class="pp-note">Services sold is the latest Torn stock snapshot. Torn does not specify whether sold quantity is daily, weekly, monthly, or lifetime.</p>
          <form data-stock-form>
            <div class="pp-wrap"><table class="pp-table">
              <thead><tr><th>#</th><th>${UI.tableSortHeader('stock', 'name', 'Service')}</th><th>${UI.tableSortHeader('stock', 'cost', 'Cost')}</th><th>${UI.tableSortHeader('stock', 'rrp', 'RRP')}</th><th>${UI.tableSortHeader('stock', 'price', 'Price')}</th><th>${UI.tableSortHeader('stock', 'inStock', 'In stock')}</th><th>${UI.tableSortHeader('stock', 'onOrder', 'On order')}</th><th>${UI.tableSortHeader('stock', 'soldAmount', 'Sold qty')}</th><th>${UI.tableSortHeader('stock', 'soldWorth', 'Sold worth')}</th><th>${UI.tableSortHeader('stock', 'needsStock', 'Need Restock?')}</th><th>${UI.tableSortHeader('stock', 'warning', 'Warn')}</th><th>${UI.tableSortHeader('stock', 'restockQty', 'Restock qty')}</th></tr></thead>
              <tbody>${items.map((item, index) => `<tr data-stock-row="${Utils.esc(item.key)}" class="${warnings.has(item.key) ? 'pp-stock-warning' : ''}">
                <td>${index + 1}</td>
                <td>${Utils.esc(item.name)}</td>
                <td>${Utils.money(item.cost)}</td>
                <td>${Utils.money(item.rrp)}</td>
                <td>${Utils.money(item.price)}</td>
                <td>${Utils.esc(item.inStock.toLocaleString())}</td>
                <td>${Utils.esc(item.onOrder.toLocaleString())}</td>
                <td>${Utils.esc(item.soldAmount)}</td>
                <td>${Utils.money(item.soldWorth)}</td>
                <td>
                  ${Company.isRestockableStock(item) ? `<label><input type="checkbox" data-stock-field="needsStock" ${item.needsStock ? 'checked' : ''}> Need Restock?</label>` : '<span class="pp-stock-na">&mdash;</span>'}
                </td>
                <td>
                  ${Company.isRestockableStock(item) ? `<select class="pp-inline pp-fit" data-stock-field="warningMode"><option value="percent" ${item.warningMode !== 'amount' ? 'selected' : ''}>%</option><option value="amount" ${item.warningMode === 'amount' ? 'selected' : ''}>Qty</option></select>
                  <input class="pp-inline pp-tiny" data-stock-field="warningValue" data-numeric-input data-max-digits="3" inputmode="numeric" maxlength="3" value="${Utils.esc(item.warningMode === 'amount' ? item.warningAmount : item.warningPercent || 10)}">` : '<span class="pp-stock-na">&mdash;</span>'}
                </td>
                <td>
                  ${Company.isRestockableStock(item) ? `<div class="pp-stock-restock"><input class="pp-inline pp-stock-qty" data-stock-field="restockQty" data-numeric-input inputmode="numeric" value="${Utils.esc((plan.byKey.get(item.key) || {}).restockQty || 0)}"></div>` : '<span class="pp-stock-na">&mdash;</span>'}
                </td>
              </tr>`).join('')}</tbody>
            </table></div>
          </form>
          ${warnings.size ? `<p class="pp-note warn">${warnings.size} stock row${warnings.size === 1 ? '' : 's'} at or under warning threshold.</p>` : '<p class="pp-note">Low-stock warnings only appear on restockable items that are marked Need Restock. Percent warnings use each product&apos;s balanced share of warehouse space.</p>'}
          <p class="pp-note">Apply in Torn fills the stock tab with the current restock quantities so you can review and place the order there.</p>
        </div>
      </section>`;
    },
    stockOrderRows() {
      UI.readStockSettings(UI.currentRoot());
      const plan = Company.stockPlan(UI.state);
      return (UI.state.company.stock.items || [])
        .filter((item) => Company.isRestockableStock(item))
        .map((item) => {
          const row = plan.byKey.get(item.key);
          const quantity = row ? Math.max(0, Utils.num(row.restockQty, 0)) : 0;
          return Object.assign({}, item, { quantity });
        })
        .filter((item) => item.quantity > 0);
    },
    themeSelect(currentTheme) {
      const themes = UI.themeOptions(true);
      return `<select class="pp-select" name="theme">${themes.map(([value, label]) => `<option value="${value}" ${currentTheme === value ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
    },
    dateFormatField() {
      const settings = UI.state.settings;
      const showCustom = settings.dateFormat === 'custom';
      return UI.field('Date format', `<div class="pp-date-format-control">
        <div class="pp-date-format-row">${UI.dateFormatSelect(settings.dateFormat)}
          <span class="pp-note" data-date-preview>${Utils.esc(Utils.formatDateWithSettings(new Date(), settings, true))}</span>
        </div>
        <div data-custom-date-wrap class="${showCustom ? '' : 'pp-hidden'}" style="margin-top:6px">
          <span class="pp-note">Custom time format</span>
          <input class="pp-input" name="customDateFormat" data-date-format-input value="${Utils.esc(settings.customDateFormat)}">
        </div>
        </div>`, 'span-3 pp-compact-field');
    },
    aboutPanel() {
      return `<section class="pp-panel" data-tour="about-panel">
        <div class="pp-head"><div><h3>About</h3><p>Project notes and credits.</p></div></div>
        <div class="pp-content">
          <div class="pp-empty">
            <strong>Pythagoras Project - CIS ${Utils.esc(APP.version)}</strong><br>
            Credits: Built for Torn company directors who want a local, compliant company intelligence tool.<br>
            Supporter notes: Track in-game supporter shout-outs and Torn-dollar/item contributions here as the project grows.
          </div>
        </div>
      </section>
      <section class="pp-panel" data-tour="changelog-panel">
        <div class="pp-head"><div><h3>Changelog</h3><p>Past versions and major changes.</p></div></div>
        <div class="pp-content">
          <div class="pp-changelog">
            <details open>
              <summary>v2.9.3 - Training news grouping fix</summary>
              <ul><li>Major changes: Grouped timeline training rows now collapse named employees only by their own identity, not by same-minute role/count fallback buckets.</li><li>Major changes: Torn company-news event IDs are now the source of truth for training dedupe; employee/minute/count matching is only used for legacy or generated rows with no source event ID.</li><li>Minor changes: Same-timestamp one-train events for different employees now stay as separate grouped rows instead of being summed under the first matching role.</li></ul>
            </details>
            <details>
              <summary>v2.9.2 - Balance sync stability</summary>
              <ul><li>Major changes: Advertising budget history now records Torn V2 profile values as explicit dated rows and ignores older unmarked zero rows in Balance.</li><li>Major changes: Balance wages now use current synced employee wages and saved wage history only; wage estimates are no longer included in Balance profit.</li><li>Major changes: Notification hides now persist locally until the next 18:10 TCT business reset, even after page refresh.</li><li>Minor changes: Weekly performance graphs now use adaptive Y-axis tick spacing, Services Sold explains that Torn does not specify the sold_amount period, and the title bar shows the script version with compact Sync buttons.</li></ul>
            </details>
            <details>
              <summary>v2.9.1 - Stock settings persistence</summary>
              <ul><li>Major changes: Stock card restock toggles, warning thresholds, warning modes, and restock quantities now save to a dedicated stock settings map.</li><li>Major changes: Stock settings now update the 24-hour sync cache immediately on input/change, so fast Torn page switches and refreshes keep the latest values.</li><li>Minor changes: Stock sync, stock import/export, and legacy migration now preserve the stock settings map instead of falling back to default row values.</li></ul>
            </details>
            <details>
              <summary>v2.8.11 - Risk strike persistence</summary>
              <ul><li>Major changes: Visible risk notifications now record same-day risk-strike history, so warnings cannot appear without also updating the member record.</li><li>Major changes: Staff sync snapshots now include <code>strikeHistory</code> and raw strike-history data for the Pythagoras API snapshot path.</li><li>Minor changes: Risk-strike updates are also saved as staff-card edits and queued for staff/workspace cloud sync.</li></ul>
            </details>
            <details>
              <summary>v2.8.10 - Staff load guardrail and Mechanic Shop training rotation</summary>
              <ul><li>Major changes: Cloud/database member loading now treats a valid left date on or after hire date as past staff before the current staff list is built.</li><li>Major changes: Mechanic Shop auto training now ranks free/sponsored slots by lowest known total working stats first, with a large projected-training penalty so Lucas-style repeats cannot dominate the ninth slot.</li><li>Minor changes: Confirmed the active Balance ledger markup no longer contains the unreliable Employees column.</li></ul>
            </details>
            <details>
              <summary>v2.8.9 - Staff departure guard and Balance cleanup</summary>
              <ul><li>Major changes: Company news left/fired events now override stale current-staff snapshots so departed employees cannot reappear from cached, cloud, profile, or employee-sync data unless a newer hire event exists.</li><li>Major changes: Employee sync now runs full staff dedupe after merging API rows, not only director filtering.</li><li>Minor changes: Balance ledger and generated balance reports no longer show the unreliable Employees column.</li></ul>
            </details>
            <details>
              <summary>v2.8.8 - Business Profile and Balance render fix</summary>
              <ul><li>Major changes: Business Profile daily/weekly fallback now reads lightweight report rows instead of building the full Balance ledger during profile render.</li><li>Major changes: Balance ledger now caches staff hire/left and wage-history data once per render instead of recalculating it for every report date.</li><li>Minor changes: Balance wage lookup uses saved previous/new wage history when available and avoids repeated expensive staff date inference during table and graph rendering.</li></ul>
            </details>
            <details>
              <summary>v2.8.7 - Loading, rate limits, and Balance fixes</summary>
              <ul><li>Major changes: Torn API calls now run through a shared throttle queue at roughly 27 calls per minute to avoid account-wide rate-limit bursts.</li><li>Major changes: Startup now renders the panel before rebuilding stored timeline analytics so loading does not appear frozen on large histories.</li><li>Major changes: Business Profile daily and weekly income/customer rows now fall back to synced daily report data when direct profile fields are empty.</li><li>Minor changes: Userscript loading is scoped to <code>companies.php</code> and now runs at <code>document-end</code> for faster Torn page loading.</li><li>Minor changes: Balance ledger no longer stamps current ad budget, rating, wages, or staff count onto every historical row; unknown ad budget/rating values stay blank.</li></ul>
            </details>
            <details>
              <summary>v2.8.6 - Training priority and Balance graphs</summary>
              <ul><li>Major changes: Sponsored/free training slots now prioritize eligible staff with the largest role-stat gaps, falling back to the lowest total working stats when no role requirement is configured.</li><li>Major changes: Mechanic Shops now use a 1 Manager, 2 Receptionists, 7 Technicians role template for suggested roles and free/sponsored training priority.</li><li>Minor changes: Successful Sync center pulls are cached locally for 24 hours so refreshed pages can restore recent business, news, employee, services sold, and training log data.</li><li>Minor changes: Projected sponsored picks now reduce that member&apos;s immediate priority so the same ninth slot is less likely to repeat across planned days.</li><li>Minor changes: Daily Balance was renamed to Operating Balance/Balance and the performance graph now includes Wages as a selectable money line.</li></ul>
            </details>
            <details>
              <summary>v2.8.5 - Torn Company API V2 sync</summary>
              <ul><li>Major changes: Sync center Business, Company details, Employees, Stock, and Company news now use Torn API V2 Company endpoints.</li><li>Major changes: V2 company profile data now feeds both Business profile and Company details, including extended fields such as funds, trains, upgrades, storage capacity, and company value when the key allows it.</li><li>Minor changes: Employee sync now understands V2 position, working stats, effectiveness, wage, joined date, status, and last action shapes.</li><li>Minor changes: Company age display now rejects invalid tiny founded timestamps and falls back to the company age day count.</li><li>Minor changes: Business Profile now shows founded date from the known company start estimate and staff as full company headcount.</li></ul>
            </details>
            <details>
              <summary>v2.8.4 - Database bootstrap repair</summary>
              <ul><li>Major changes: Business profile loading now merges saved database company profile and company detail records into the active workspace during CIS bootstrap.</li><li>Major changes: Company funds, popularity, efficiency, environment, storage, value, staff capacity, daily figures, and weekly figures now load from the backend instead of rendering empty defaults after page load.</li><li>Minor changes: Company identity, rating, director, founded date, and sync timestamps are still refreshed from the current backend company row.</li></ul>
            </details>
            <details>
              <summary>v2.8.0 - Cloud workspace sync hardening</summary>
              <ul><li>Major changes: Added server-backed sync paths for staff-card edits, settings, training orders, and full company workspace mirrors.</li><li>Major changes: Company workspaces are keyed by the active user and company so separate companies can keep separate saved data.</li><li>Minor changes: Cloud sync failures now keep local edits available and show a clear toast instead of silently discarding the change.</li></ul>
            </details>
            <details>
              <summary>v2.7.0 - Company workspace workflow</summary>
              <ul><li>Major changes: Added the Data workspace controls for loading, saving, exporting, importing, and clearing active company data.</li><li>Major changes: Added saved company workspace handling so directors can reconnect to the correct cloud-backed company state after refresh.</li><li>Minor changes: Added clearer privacy copy around local profile storage and backend verification.</li></ul>
            </details>
            <details>
              <summary>v2.6.5 - Script-side cleanup</summary>
              <ul><li>Major changes: Removed obsolete client-side account UI, badge snippets, and old saved-key storage from the userscript.</li><li>Major changes: Removed local feature gates so the userscript only keeps UI, sync helpers, display formatting, and local calculations.</li><li>Minor changes: Removed local unlock prompts and stale disabled-control messaging.</li></ul>
            </details>
            <details>
              <summary>v2.6.4 - Compliance cleanup</summary>
              <ul><li>Minor changes: Userscript connect permissions now list only Torn API and the Pythagoras API.</li><li>Minor changes: Source code was cleaned so review-risky helper patterns are no longer used.</li></ul>
            </details>
            <details>
              <summary>v2.6.3 - Backend processing</summary>
              <ul><li>Major changes: Reports, exports, history queries, weekly analytics, and planner generation now use Pythagoras API endpoints when server-side processing is required.</li><li>Minor changes: Local UI buttons remain available while protected data/results are decided by the backend.</li></ul>
            </details>
            <details>
              <summary>v2.6.0 - Cloud workspace architecture</summary>
              <ul><li>Major changes: Company workspaces can be loaded from and saved to the CIS API.</li><li>Minor changes: Local browser storage keeps only the local profile values needed to reconnect.</li></ul>
            </details>
          </div>        </div>
      </section>
      <section class="pp-panel is-third">
        <div class="pp-head"><div><h3>Testimonies</h3><p>Feedback worth keeping close.</p></div></div>
        <div class="pp-content"><div class="pp-empty">No testimonies added yet.</div></div>
      </section>
      <section class="pp-panel is-third">
        <div class="pp-head"><div><h3>Thank you notes</h3><p>Small credits for people who helped shape the tool.</p></div></div>
        <div class="pp-content"><div class="pp-empty">Thanks to testers and supporters who helped shape the training ledger, planner, and company analytics workflow.</div></div>
      </section>
      <section class="pp-panel is-third">
        <div class="pp-head"><div><h3>Supporters list</h3><p>Names can be public or anonymous.</p></div></div>
        <div class="pp-content"><div class="pp-empty">Supporters can be listed as their name or Anonymous. For 30-day plans, show the number of supported months beside the name.</div></div>
      </section>`;
    },
    dateFormatSelect(currentFormat) {
      return `<select class="pp-select" name="dateFormat" data-date-format-select>${Utils.dateFormatOptions().map(([value, label]) => `<option value="${value}" ${currentFormat === value ? 'selected' : ''}>${Utils.esc(label)}</option>`).join('')}</select>`;
    },

    reportSectionOptions() {
      const sections = Object.assign({}, DEFAULTS.ui.reportSections, UI.state.ui.reportSections || {});
      const options = [
        ['summary', 'Summary'],
        ['profile', 'Business profile'],
        ['details', 'Business details'],
        ['ledger', 'Training ledger'],
        ['trainingLog', 'Training log'],
        ['planner', 'Train Schedule'],
        ['analytics', 'Weekly analytics'],
        ['balance', 'Balance'],
        ['stock', 'Stock watch'],
        ['staff', 'Current staff counts'],
        ['pastStaff', 'Past staff table'],
        ['directors', 'Directors'],
        ['timeline', 'Company timeline'],
        ['settings', 'Settings and theme']
      ];
      return `<div class="pp-report-options">${options.map(([key, label]) => `<label><input type="checkbox" data-report-section="${key}" ${sections[key] ? 'checked' : ''}> ${Utils.esc(label)}</label>`).join('')}</div>`;
    },
    stat(label, value) {
      return `<div class="pp-stat"><small>${Utils.esc(label)}</small><strong>${Utils.esc(value)}</strong></div>`;
    },
    summaryStats(summary) {
      return [
        UI.stat('Entries', summary.entries),
        UI.stat('Paid queue', summary.paidQueue),
        UI.stat('Sponsored queue', summary.sponsored),
        UI.stat('Unpaid trains', summary.unpaidQueue),
        UI.stat('Outstanding', Utils.money(summary.due)),
        UI.stat('Final cost', Utils.money(summary.finalCost))
      ].join('');
    },
    delta(value, grouped) {
      const number = Number(value || 0);
      const cls = number > 0 ? 'good' : number < 0 ? 'bad' : '';
      const sign = number > 0 ? '+' : number < 0 ? '-' : '';
      return `<span class="${cls}">${sign}${grouped ? Math.abs(number).toLocaleString() : Math.abs(number)}</span>`;
    },
    deltaMoney(value) {
      const number = Number(value || 0);
      const cls = number > 0 ? 'good' : number < 0 ? 'bad' : '';
      const sign = number > 0 ? '+' : number < 0 ? '-' : '';
      return `<span class="${cls}">${sign}${Utils.money(Math.abs(number))}</span>`;
    },
    roleColor(role) {
      const colors = UI.state.settings.colors;
      const name = String(role || '').toLowerCase();
      const roleKey = UI.roleKey(role);
      if (UI.state.settings.roleColors && UI.state.settings.roleColors[roleKey]) return UI.state.settings.roleColors[roleKey];
      if (name.includes('director')) return colors.roleDirector;
      if (name.includes('trainer')) return colors.roleTrainer;
      return colors.roleDefault;
    },
    roleKey(role) {
      return String(role || 'Employee').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'employee';
    },
    roleLabel(role) {
      const key = UI.roleKey(role);
      return (UI.state.settings.roleLabels && UI.state.settings.roleLabels[key]) || UI.canonicalRole(role);
    },
    canonicalRole(role) {
      const clean = String(role || 'Employee').replace(/\s+/g, ' ').trim() || 'Employee';
      const key = UI.roleKey(clean);
      const defaultRole = (Company.defaultRoles || []).find((item) => UI.roleKey(item) === key);
      return defaultRole || clean;
    },
    rolesList() {
      const roles = new Map();
      UI.state.staff.current.concat(UI.state.staff.past).forEach((person) => {
        roles.set(UI.roleKey(person.role), UI.roleLabel(person.role));
      });
      (UI.state.settings.customRoles || []).forEach((role) => {
        roles.set(UI.roleKey(role), UI.roleLabel(role));
      });
      const hidden = new Set((UI.state.settings.hiddenRoles || []).map((role) => UI.roleKey(role)));
      (Company.defaultRoles || ['Director', 'Trainer', 'Cleaner', 'Employee', 'Ex-Employee']).forEach((role) => {
        const key = UI.roleKey(role);
        if (!hidden.has(key)) roles.set(key, UI.roleLabel(role));
      });
      return Array.from(roles.entries()).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
    },
    roleRankIds(key, label) {
      const roleKey = UI.roleKey(key || label);
      const labelKey = UI.roleKey(label);
      const map = UI.state.settings.roleRankMap || {};
      return Object.entries(map)
        .filter(([, role]) => String(role || '') === roleKey || UI.roleKey(role) === roleKey || UI.roleKey(role) === labelKey)
        .map(([rank]) => rank)
        .sort((a, b) => Utils.int(a, 0) - Utils.int(b, 0))
        .join(', ');
    },
    roleRankEvidence(key, label) {
      const roleKey = UI.roleKey(key || label);
      const labelKey = UI.roleKey(label);
      const map = UI.state.settings.roleRankMap || {};
      const evidence = UI.state.settings.roleRankEvidence || {};
      const rows = Object.entries(evidence).filter(([rank, item]) => {
        const mapped = String(map[rank] || '');
        if (!mapped) return false;
        return UI.roleKey(mapped) === roleKey || UI.roleKey(mapped) === labelKey || UI.roleKey(item && item.role) === roleKey || UI.roleKey(item && item.role) === labelKey;
      }).sort((a, b) => Utils.int(a[0], 0) - Utils.int(b[0], 0));
      if (!rows.length) return '<span class="pp-note">No evidence yet</span>';
      const lines = rows.map(([rank, item]) => {
        const source = item && item.source ? item.source : 'Role table';
        const person = item && (item.personName || item.personId) ? ` - ${[item.personName, item.personId ? `[${item.personId}]` : ''].filter(Boolean).join(' ')}` : '';
        const date = item && item.at ? ` - ${Utils.dateShort(item.at)}` : '';
        const conflict = item && item.conflict ? ' (conflict)' : '';
        return `Rank ${rank}: ${source}${person}${date}${conflict}`;
      });
      const labelText = rows.length === 1 ? lines[0] : `${rows.length} evidence rows`;
      return `<span class="pp-note" title="${Utils.esc(lines.join('\n'))}">${Utils.esc(labelText)}</span>`;
    },

    isScriptOnlyRole(key, label) {
      const roleKey = UI.roleKey(key || label);
      return roleKey === 'director' || roleKey === 'employee' || roleKey === 'ex-employee';
    },

    bind(root, doc) {
      if (!root.dataset.ppBound) {
        root.addEventListener('click', UI.onClick);
        root.addEventListener('submit', UI.onSubmit);
        root.addEventListener('input', UI.onInput);
        root.addEventListener('change', UI.onChange);
        root.addEventListener('toggle', UI.onToggle, true);
        root.addEventListener('mouseover', UI.onTooltipHover);
        root.addEventListener('mouseout', UI.onTooltipLeave);
        root.addEventListener('mousemove', UI.onTooltipMove);
        root.addEventListener('focusin', UI.onTooltipFocusIn);
        root.addEventListener('focusout', UI.onTooltipFocusOut);
        root.dataset.ppBound = '1';
      }
      const titlebar = root.querySelector('[data-drag-handle]');
      if (titlebar && doc === document) titlebar.addEventListener('pointerdown', UI.startDrag);
    },

    autosaveTarget(control) {
      if (!control || !control.closest) return '';
      if (control.matches('[data-import-file]')) return '';
      if (control.closest('[data-ledger-form],[data-planner-field],[data-planner-manual],[data-ui-field],[data-ui-check],[data-report-section],[data-graph-series]')) return '';
      if (control.closest('[data-person-card]')) return 'person';
      if (control.closest('[data-stock-form]')) return 'stock';
      if (control.closest('[data-settings-form],[data-wage-form],[data-roles-form],[data-notifications-form],[data-theme-form]')) return 'settings';
      return '';
    },

    scheduleAutoSave(control, options) {
      const target = UI.autosaveTarget(control);
      if (!target) return;
      const delay = options && Object.prototype.hasOwnProperty.call(options, 'delay') ? options.delay : 450;
      clearTimeout(UI.autoSaveTimer);
      UI.autoSaveTimer = setTimeout(() => UI.runAutoSave(target), delay);
    },

    runAutoSave(target) {
      const root = UI.currentRoot();
      if (!root) return;
      if (target === 'person') {
        const form = root.querySelector('[data-person-card]');
        if (!form) return;
        UI.savePersonCard(form.dataset.personKey || UI.state.ui.editPersonKey, { silent: true, close: false });
        return;
      }
      if (target === 'stock') {
        UI.readStockSettings(root);
        Store.updateSyncCache(UI.state, 'stock');
        Store.save(UI.state);
        return;
      }
      if (target === 'settings') {
        UI.saveSettings({ silent: true });
      }
    },

    tooltipTarget(node) {
      return node && node.closest ? node.closest('[data-tooltip-html]') : null;
    },

    ensureTooltip(doc) {
      if (UI.tooltipEl && UI.tooltipEl.isConnected && UI.tooltipEl.ownerDocument === doc) return UI.tooltipEl;
      const tip = doc.createElement('div');
      tip.className = 'pp-hover-tooltip';
      tip.hidden = true;
      doc.body.appendChild(tip);
      UI.tooltipEl = tip;
      return tip;
    },

    positionTooltip(anchor) {
      const tip = UI.tooltipEl;
      if (!tip || !anchor || tip.hidden) return;
      const doc = anchor.ownerDocument;
      const win = doc.defaultView || window;
      const rect = anchor.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();
      const gap = 10;
      let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
      left = Math.max(8, Math.min(left, win.innerWidth - tipRect.width - 8));
      let top = rect.bottom + gap;
      if (top + tipRect.height > win.innerHeight - 8) top = rect.top - tipRect.height - gap;
      top = Math.max(8, top);
      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(top)}px`;
    },

    showTooltip(anchor) {
      if (!anchor || !anchor.dataset.tooltipHtml) return;
      const root = UI.currentRoot();
      const tip = UI.ensureTooltip(anchor.ownerDocument);
      const styles = (anchor.ownerDocument.defaultView || window).getComputedStyle(root);
      tip.style.setProperty('--tip-accent', (styles.getPropertyValue('--accent') || '#46c58f').trim());
      tip.style.setProperty('--tip-warn', (styles.getPropertyValue('--warn') || '#d8a545').trim());
      tip.style.setProperty('--tip-bad', (styles.getPropertyValue('--bad') || '#d95d5d').trim());
      tip.style.setProperty('--tip-panel', (styles.getPropertyValue('--panel') || '#171a1a').trim());
      tip.style.setProperty('--tip-text', (styles.getPropertyValue('--text') || '#eff2ef').trim());
      tip.style.setProperty('--tip-muted', (styles.getPropertyValue('--muted') || '#a8b0aa').trim());
      tip.innerHTML = anchor.dataset.tooltipHtml;
      tip.hidden = false;
      UI.activeTooltipAnchor = anchor;
      UI.positionTooltip(anchor);
    },

    hideTooltip() {
      if (UI.tooltipEl) UI.tooltipEl.hidden = true;
      UI.activeTooltipAnchor = null;
    },

    onTooltipHover(event) {
      const anchor = UI.tooltipTarget(event.target);
      if (!anchor) return;
      if (UI.activeTooltipAnchor !== anchor) UI.showTooltip(anchor);
      else UI.positionTooltip(anchor);
    },

    onTooltipLeave(event) {
      const anchor = UI.tooltipTarget(event.target);
      if (!anchor || UI.activeTooltipAnchor !== anchor) return;
      const related = event.relatedTarget;
      if (related && anchor.contains(related)) return;
      UI.hideTooltip();
    },

    onTooltipMove(event) {
      const anchor = UI.tooltipTarget(event.target);
      if (anchor && UI.activeTooltipAnchor === anchor) UI.positionTooltip(anchor);
    },

    onTooltipFocusIn(event) {
      const anchor = UI.tooltipTarget(event.target);
      if (anchor) UI.showTooltip(anchor);
    },

    onTooltipFocusOut(event) {
      const anchor = UI.tooltipTarget(event.target);
      if (!anchor || UI.activeTooltipAnchor !== anchor) return;
      UI.hideTooltip();
    },

    onClick(event) {
      if (Date.now() < UI.suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.target.matches('[data-modal-backdrop]')) {
        if (UI.state.ui.editDirectorKey) UI.closeDirectorCard();
        else UI.closePersonCard();
        return;
      }

      const tab = event.target.closest('[data-tab]');
      if (tab) { UI.state.ui.tab = tab.dataset.tab; UI.saveRender(); return; }

      const subtab = event.target.closest('[data-subtab]');
      if (subtab) {
        const parts = subtab.dataset.subtab.split(':');
        if (parts[0] === 'staff') UI.state.ui.staffTab = parts[1];
        if (parts[0] === 'director') UI.state.ui.directorTab = parts[1];
        UI.saveRender();
        return;
      }

      const profileSort = event.target.closest('[data-profile-sort]');
      if (profileSort) {
        const key = profileSort.dataset.profileSort;
        if (UI.state.ui.profileSort === key) UI.state.ui.profileSortDir = UI.state.ui.profileSortDir === 'desc' ? 'asc' : 'desc';
        else { UI.state.ui.profileSort = key; UI.state.ui.profileSortDir = ['daysInCompany', 'lastAction', 'effectiveness'].includes(key) ? 'desc' : 'asc'; }
        UI.saveRender();
        return;
      }

      const tableSort = event.target.closest('[data-table-sort]');
      if (tableSort) {
        const table = tableSort.dataset.tableSort;
        const key = tableSort.dataset.sortKey;
        UI.state.ui.tableSorts = UI.state.ui.tableSorts || {};
        const current = UI.state.ui.tableSorts[table] || {};
        UI.state.ui.tableSorts[table] = {
          key,
          dir: current.key === key && current.dir !== 'desc' ? 'desc' : 'asc'
        };
        UI.saveRender();
        return;
      }

      const button = event.target.closest('[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      const id = button.dataset.id;
      if (action === 'toggle-min') UI.toggleMinimized();
      if (action === 'toggle-edit-mode') { UI.state.ui.editMode = !UI.state.ui.editMode; UI.saveRender(UI.state.ui.editMode ? 'Panel edit mode enabled.' : 'Panel edit mode disabled.'); }
      if (action === 'toggle-privacy') { UI.state.ui.privacyMode = !UI.state.ui.privacyMode; UI.saveRender(UI.state.ui.privacyMode ? 'Privacy mode enabled for screenshots.' : 'Privacy mode disabled.'); }
      if (action === 'reset-ui') UI.resetUi();
      if (action === 'focus-api-key') UI.focusApiKey();
      if (action === 'start-tour') UI.startTour();
      if (action === 'tour-next') UI.shiftTour(1);
      if (action === 'tour-prev') UI.shiftTour(-1);
      if (action === 'tour-end') UI.endTour();
      if (action === 'dismiss-notification') UI.dismissNotification(button.dataset.notificationKey || '');
      if (action === 'collapse-panel') UI.togglePanel(button.dataset.panelId);
      if (action === 'show-panel-hint') UI.showPanelHint(button.dataset.panelId);
      if (action === 'toggle-timeline-grouped') { UI.state.ui.timelineGrouped = UI.state.ui.timelineGrouped === false; UI.saveRender(UI.state.ui.timelineGrouped ? 'Timeline grouped view enabled.' : 'Timeline raw event view enabled.'); }
      if (action === 'toggle-analytics-week') UI.toggleAnalyticsWeek(button.dataset.weekKey || '');
      if (action === 'balance-prev') UI.shiftDailyBalanceWeek(-7);
      if (action === 'balance-next') UI.shiftDailyBalanceWeek(7);
      if (action === 'rebuild-balance') UI.rebuildDailyBalance();
      if (action === 'graph-prev') UI.shiftGraph(-1);
      if (action === 'graph-next') UI.shiftGraph(1);
      if (action === 'popup-mode') UI.openPopup();
      if (action === 'embed-mode') UI.closePopup();
      if (action === 'delete-ledger') UI.deleteLedger(id);
      if (action === 'copy-ledger-receipt') UI.copyLedgerReceipt(id);
      if (action === 'edit-person') { UI.state.ui.editPersonKey = button.dataset.personKey || ''; UI.saveRender(); }
      if (action === 'edit-director') { UI.state.ui.editDirectorKey = button.dataset.directorKey || ''; UI.saveRender(); }
      if (action === 'close-director-card') UI.closeDirectorCard();
      if (action === 'request-fire-person') UI.requestFirePerson(button.dataset.personKey || '');
      if (action === 'confirm-fire-person') UI.confirmFirePerson(button.dataset.personKey || '');
      if (action === 'mark-person-ex') UI.markPersonExEmployee(button.dataset.personKey || '');
      if (action === 'nav-person') UI.navigatePersonCard(button.dataset.personKey || '');
      if (action === 'close-person-card') UI.closePersonCard();
      if (action === 'fetch-person-racing-skill') UI.fetchPersonRacingSkill(button.dataset.personKey || '');
      if (action === 'sync-person-role-log') UI.syncPersonRoleLog(button.dataset.personKey || '');
      if (action === 'sync-person-role-log-older') UI.syncPersonRoleLog(button.dataset.personKey || '', { older: true });
      if (action === 'use-train') UI.useTrain(id);
      if (action === 'build-planner') UI.buildPlanner();
      if (action === 'reset-planner-day') UI.resetPlannerDay(button.dataset.day || '');
      if (action === 'toggle-planner-queue') UI.togglePlannerQueue();
      if (action === 'start-training-queue') UI.startTrainingQueue();
      if (action === 'open-training-queue-page') UI.openTrainingQueuePage();
      if (action === 'open-stock-page') UI.openStockPage();
      if (action === 'click-training-action') UI.clickTrainingAction();
      if (action === 'smart-sync') UI.smartSync();
      if (action === 'sync-training-log') UI.syncTrainingLog();
      if (action === 'import-training-orders-log') UI.importTrainingOrdersFromLog();
      if (action === 'training-log-oldest') UI.jumpTrainingLog('oldest');
      if (action === 'training-log-prev') UI.shiftTrainingLogWeek(-7);
      if (action === 'training-log-next') UI.shiftTrainingLogWeek(7);
      if (action === 'training-log-latest') UI.jumpTrainingLog('latest');
      if (action === 'sync-past-staff') UI.syncPastStaff();
      if (action === 'sync-news') UI.syncNews();
      if (action === 'sync-news-backfill') UI.syncNews({ backfill: true });
      if (action === 'sync-employees') UI.syncEmployees();
      if (action === 'sync-business') UI.syncBusiness();
      if (action === 'sync-profile') UI.syncProfile();
      if (action === 'sync-detailed') UI.syncDetailed();
      if (action === 'sync-stock') UI.syncStock();
      if (action === 'suggest-stock-order') UI.suggestStockOrder();
      if (action === 'apply-stock-order') UI.applyStockOrderToTorn();
      if (action === 'toggle-api-key') UI.toggleApiKey();
      if (action === 'check-key-info') UI.checkKeyInfo({ manual: true });
      if (action === 'add-loyalty-tier') UI.addLoyaltyTier();
      if (action === 'delete-loyalty-tier') UI.deleteLoyaltyTier(Utils.int(button.dataset.index, -1));
      if (action === 'add-role') UI.addRole();
      if (action === 'delete-role') UI.deleteRole(button.dataset.roleKey || '');
      if (action === 'apply-theme-preset') UI.applyThemePreset();
      if (action === 'export-full') UI.exportFull();
      if (action === 'import-full') UI.pickImport();
      if (action === 'upload-company-workspace') UI.uploadCompanyWorkspace();
      if (action === 'switch-company-workspace') UI.switchCompanyWorkspace(button.dataset.companyKey || '');
      if (action === 'delete-company-workspace') UI.deleteCompanyWorkspace(button.dataset.companyKey || '');
      if (action === 'request-clear-data') UI.requestClearData();
      if (action === 'confirm-clear-local-data') UI.clearLocalData();
      if (action === 'confirm-clear-cloud-data') UI.clearCloudData();
      if (action === 'cancel-clear-data') UI.clearToast();
      if (action === 'export-report') UI.exportReport();
      if (action === 'copy-newsletter') UI.copyNewsletter();
      if (action === 'copy-bug') UI.copyBug();
      if (action === 'open-faq') UI.openSupport('faq');
      if (action === 'open-bug-report') UI.openSupport('bug');
      if (action === 'open-contact') UI.openSupport('contact');
    },

    onSubmit(event) {
      const form = event.target.closest('[data-ledger-form]');
      if (!form) return;
      event.preventDefault();
      UI.applyLedgerStaffSelection(form);
      const entry = Ledger.fromForm(form, UI.state.settings, UI.state);
      if (!entry.playerName) { UI.toast('Add a player name first.'); return; }
      UI.linkLedgerEntryToStaff(entry);
      UI.state.ledger.push(entry);
      Ledger.prepare(UI.state);
      Planner.build(UI.state);
      UI.recordLedgerPending();
      UI.scheduleLedgerCloudSave(100);
      UI.saveRender(`Ledger entry ${entry.orderId || ''} added.`);
    },

    onInput(event) {
      const colorPicker = event.target.closest('[data-color-picker]');
      if (colorPicker) {
        const text = UI.currentRoot().querySelector(`[data-color-text="${colorPicker.dataset.colorPicker}"]`);
        if (text) text.value = colorPicker.value;
      }

      const colorText = event.target.closest('[data-color-text]');
      if (colorText && /^#[0-9a-f]{6}$/i.test(colorText.value.trim())) {
        const picker = UI.currentRoot().querySelector(`[data-color-picker="${colorText.dataset.colorText}"]`);
        if (picker) picker.value = colorText.value.trim();
      }

      const form = event.target.closest('[data-ledger-form]');
      const personForm = event.target.closest('[data-person-card]');
      if (personForm) {
        UI.markPersonCardDirty(personForm, true);
        UI.refreshPersonCardWagePreview(personForm);
      }
      if (event.target.closest('[data-money-input]')) {
        const formatted = Utils.formatPlainNumber(event.target.value);
        if (formatted) event.target.value = formatted;
      }
      const numeric = event.target.closest('[data-numeric-input]');
      if (numeric) {
        let value = String(numeric.value || '').replace(/[^\d]/g, '');
        const maxDigits = Utils.int(numeric.dataset.maxDigits, 0);
        if (maxDigits > 0) value = value.slice(0, maxDigits);
        numeric.value = value;
      }
      const stockField = event.target.closest('[data-stock-field]');
      if (stockField) {
        UI.readStockSettings(UI.currentRoot());
        Store.updateSyncCache(UI.state, 'stock');
        UI.scheduleAutoSave(stockField);
      }
      if (event.target.closest('[data-theme-editor]')) UI.markThemeDirty(event.target.closest('[data-theme-form]'));
      if (event.target.closest('[data-date-format-input]')) UI.updateDatePreview(event.target.closest('[data-settings-form]'));
      if (form && event.target.matches('[name="playerName"]')) UI.applyLedgerStaffSelection(form);
      if (form) UI.updateFormPreview(form, event.target.name !== 'totalTrains', event.target.name);
      if (event.target.name === 'racingSkill') event.target.value = String(event.target.value || '').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
      const field = event.target.closest('[data-ledger-field]');
      if (field) UI.updateLedgerField(field);
      const plannerField = event.target.closest('[data-planner-field]');
      if (plannerField) {
        UI.state.planner[plannerField.dataset.plannerField] = plannerField.value;
        Store.save(UI.state);
      }
      if (!stockField) UI.scheduleAutoSave(event.target);
    },

    onChange(event) {
      if (event.target.matches('[data-import-file]')) UI.importFull(event.target.files[0]);
      const personForm = event.target.closest('[data-person-card]');
      if (personForm) {
        UI.markPersonCardDirty(personForm, true);
        UI.refreshPersonCardWagePreview(personForm);
      }
      const stockField = event.target.closest('[data-stock-field]');
      if (stockField) {
        UI.readStockSettings(UI.currentRoot());
        Store.updateSyncCache(UI.state, 'stock');
        UI.scheduleAutoSave(event.target, { delay: 100 });
      }
      if (event.target.closest('[data-report-section]')) UI.readReportSections(UI.currentRoot());
      const staffPicker = event.target.closest('[data-staff-picker]');
      if (staffPicker) {
        const form = staffPicker.closest('[data-ledger-form]');
        const option = staffPicker.options[staffPicker.selectedIndex];
        if (form && option && staffPicker.value) {
          UI.applyLedgerStaffSelection(form, staffPicker.value, option);
          UI.updateFormPreview(form, true);
        }
      }
      const ledgerForm = event.target.closest('[data-ledger-form]');
      if (ledgerForm) UI.updateFormPreview(ledgerForm, event.target.name !== 'totalTrains', event.target.name);
      const themeSelect = event.target.closest('select[name="theme"]');
      if (themeSelect) UI.previewTheme(themeSelect.value);
      const themePreset = event.target.closest('[data-theme-preset-select]');
      if (themePreset) UI.previewTheme(themePreset.value);
      const interestSelect = event.target.closest('[data-interest-select]');
      if (interestSelect) {
        const other = interestSelect.closest('[data-person-card]').querySelector('[data-interest-other]');
        if (other) other.classList.toggle('pp-hidden', interestSelect.value !== 'other');
      }
      if (event.target.closest('[data-date-format-select]')) UI.updateDatePreview(event.target.closest('[data-settings-form]'));
      const graphSeries = event.target.closest('[data-graph-series]');
      if (graphSeries) {
        UI.state.ui.graphSeries = Object.assign({}, DEFAULTS.ui.graphSeries, UI.state.ui.graphSeries || {});
        UI.state.ui.graphSeries[graphSeries.dataset.graphSeries] = graphSeries.checked;
        if (!Object.values(UI.state.ui.graphSeries).some(Boolean)) {
          UI.state.ui.graphSeries[graphSeries.dataset.graphSeries] = true;
          UI.saveRender('Keep at least one graph line enabled.');
        } else {
          UI.saveRender();
        }
        return;
      }
      const uiField = event.target.closest('[data-ui-field]');
      if (uiField) {
        UI.state.ui[uiField.dataset.uiField] = uiField.value;
        if (uiField.dataset.uiField === 'timelineFilter') {
          Store.save(UI.state);
          UI.refreshTimelineContent(UI.currentRoot());
          return;
        }
        if (uiField.dataset.uiField === 'trainingLogYear') UI.state.ui.trainingLogStart = '';
        if (uiField.dataset.uiField === 'graphScale') UI.state.ui.graphIndex = 0;
        UI.saveRender();
        return;
      }
      const uiCheck = event.target.closest('[data-ui-check]');
      if (uiCheck) {
        UI.state.ui[uiCheck.dataset.uiCheck] = uiCheck.checked;
        UI.saveRender(uiCheck.dataset.uiCheck === 'dailyBalanceIncludeWages'
          ? (uiCheck.checked ? 'Balance wages enabled.' : 'Balance wages set to $0.')
          : undefined);
        return;
      }
      const plannerField = event.target.closest('[data-planner-field]');
      if (plannerField) {
        UI.state.planner[plannerField.dataset.plannerField] = plannerField.value;
        Planner.build(UI.state);
        UI.saveRender('Planner calendar rebuilt.');
        return;
      }
      const plannerManual = event.target.closest('[data-planner-manual]');
      if (plannerManual) {
        UI.state.planner.manualSlots = UI.state.planner.manualSlots || {};
        UI.state.planner.manualSlots[plannerManual.dataset.plannerManual] = plannerManual.value;
        Store.save(UI.state);
        UI.saveRender();
        return;
      }
      const field = event.target.closest('[data-ledger-field]');
      if (field) UI.updateLedgerField(field);
      if (!stockField) UI.scheduleAutoSave(event.target, { delay: 100 });
    },

    onToggle(event) {
      const detail = event.target;
      if (!detail || !detail.matches || !detail.matches('[data-ui-detail-key]')) return;
      UI.setDetailOpen(detail.dataset.uiDetailKey || '', !!detail.open);
    },

    startDrag(event) {
      if (event.button !== 0) return;
      if (event.target.closest('button,input,select,textarea,a')) return;
      const rect = UI.root.getBoundingClientRect();
      UI.dragging = {
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top,
        startX: event.clientX,
        startY: event.clientY,
        moved: false
      };
      document.addEventListener('pointermove', UI.drag);
      document.addEventListener('pointerup', UI.endDrag, { once: true });
    },

    drag(event) {
      if (!UI.dragging) return;
      const distance = Math.abs(event.clientX - UI.dragging.startX) + Math.abs(event.clientY - UI.dragging.startY);
      if (distance > 5) UI.dragging.moved = true;
      const rect = UI.root.getBoundingClientRect();
      const left = Utils.clamp(event.clientX - UI.dragging.dx, 0, Math.max(0, window.innerWidth - rect.width));
      const top = Utils.clamp(event.clientY - UI.dragging.dy, 0, Math.max(0, window.innerHeight - rect.height));
      UI.root.style.left = `${left}px`;
      UI.root.style.top = `${top}px`;
      UI.root.style.right = 'auto';
    },

    endDrag() {
      if (!UI.dragging) return;
      if (UI.dragging.moved) UI.suppressClickUntil = Date.now() + 350;
      UI.dragging = null;
      UI.ensureBounds();
      UI.state.ui.left = UI.root.style.left;
      UI.state.ui.top = UI.root.style.top;
      Store.save(UI.state);
      document.removeEventListener('pointermove', UI.drag);
    },

    estimateTotalTrains(form) {
      const payment = Utils.num(form.payment.value, 0);
      if (!payment) return 0;
      const seed = Ledger.fromForm(form, UI.state.settings);
      seed.done = false;
      let estimate = Math.max(1, Utils.int(form.totalTrains.value, 1));
      for (let round = 0; round < 6; round += 1) {
        seed.totalTrains = estimate;
        const totals = Ledger.totals(seed, UI.state.settings);
        const effectivePrice = Math.max(1, Math.ceil(totals.finalCost / Math.max(1, totals.totalTrains)));
        const next = Math.max(0, Math.floor(payment / effectivePrice));
        if (!next) return 0;
        if (next === estimate) return next;
        estimate = next;
      }
      return estimate;
    },

    updateFormPreview(form, recalculateTotal, sourceName) {
      const preview = form.querySelector('[data-cost-preview]');
      if (!preview) return;
      if ((recalculateTotal || Utils.int(form.totalTrains.value, 0) === 0) && Utils.num(form.payment.value, 0) > 0) {
        form.totalTrains.value = String(UI.estimateTotalTrains(form));
      }
      if (sourceName === 'totalTrains' && Utils.int(form.totalTrains.value, 0) > 0) {
        const seed = Ledger.fromForm(form, UI.state.settings);
        seed.payment = 0;
        form.payment.value = Ledger.totals(seed, UI.state.settings).finalCost.toLocaleString('en-US');
      }
      const entry = Ledger.fromForm(form, UI.state.settings);
      const totals = Ledger.totals(entry, UI.state.settings);
      const effective = totals.totalTrains ? Math.round(totals.finalCost / totals.totalTrains) : totals.price;
      preview.textContent = `Final cost: ${Utils.money(totals.finalCost)} (${totals.totalDiscount}% discount), effective ${Utils.money(effective)} / train, ${totals.remaining} remaining`;
    },

    updateLedgerField(field) {
      const row = field.closest('[data-ledger-row]');
      if (!row) return;
      const entry = UI.state.ledger.find((item) => item.id === row.dataset.ledgerRow);
      if (!entry) return;
      const name = field.dataset.ledgerField;
      if (field.type === 'checkbox') entry[name] = field.checked;
      else if (name === 'entryDate') {
        const entryDate = Utils.dateInput(field.value) || Utils.todayInput();
        entry.entryDate = entryDate;
        entry.createdAt = new Date(`${entryDate}T12:00:00`).toISOString();
      }
      else if (['payment', 'pricePerTrain', 'manualDiscount'].includes(name)) {
        entry[name] = Utils.num(field.value, 0);
        if (name === 'payment' && entry.payment > 0 && entry.contractType !== 'paid') {
          entry.contractType = 'paid';
          const contract = row.querySelector('[data-ledger-field="contractType"]');
          if (contract) contract.value = 'paid';
        }
      }
      else if (['totalTrains', 'usedTrains', 'merits'].includes(name)) entry[name] = Math.max(0, Utils.int(field.value, 0));
      else if (name === 'playerName') {
        entry.playerName = String(field.value || '').trim();
        const match = UI.linkLedgerEntryToStaff(entry, field);
        if (!match) {
          entry.playerId = '';
          field.title = 'No Torn ID linked';
        }
        const idNote = row.querySelector('[data-ledger-player-id]');
        if (idNote) idNote.textContent = entry.playerId ? `ID: ${entry.playerId}` : 'No ID linked';
      }
      else entry[name] = field.value;
      if (name === 'contractType' && entry.contractType === 'paid') {
        const nameField = row.querySelector('[data-ledger-field="playerName"]');
        const match = UI.linkLedgerEntryToStaff(entry, nameField);
        const idNote = row.querySelector('[data-ledger-player-id]');
        if (idNote) idNote.textContent = match && entry.playerId ? `ID: ${entry.playerId}` : 'No ID linked';
      }
      if (name === 'payment' && entry.contractType === 'paid') {
        const nameField = row.querySelector('[data-ledger-field="playerName"]');
        const match = UI.linkLedgerEntryToStaff(entry, nameField);
        const idNote = row.querySelector('[data-ledger-player-id]');
        if (idNote) idNote.textContent = match && entry.playerId ? `ID: ${entry.playerId}` : (entry.playerId ? `ID: ${entry.playerId}` : 'No ID linked');
      }
      entry.updatedAt = Utils.nowIso();

      const totals = Ledger.totals(entry, UI.state.settings);
      const remaining = row.querySelector('[data-row-remaining]');
      const discount = row.querySelector('[data-row-discount]');
      const balance = row.querySelector('[data-row-balance]');
      if (remaining) remaining.textContent = String(totals.remaining);
      if (discount) discount.textContent = String(totals.totalDiscount);
      if (balance) balance.textContent = Utils.money(totals.balance);
      Planner.build(UI.state);
      UI.updateLedgerSummary();
      UI.recordLedgerPending();
      UI.scheduleLedgerCloudSave(300);
      if (name === 'done' || name === 'paid') {
        UI.saveRender('Order status updated.');
        return;
      }
      Store.save(UI.state);
    },

    updateLedgerSummary() {
      const summaryNode = UI.currentRoot().querySelector('[data-ledger-summary]');
      if (!summaryNode) return;
      summaryNode.innerHTML = UI.summaryStats(Ledger.summary(UI.state.ledger, UI.state.settings));
    },

    markPersonCardDirty(form, isDirty) {
      if (!form) return;
      form.dataset.dirty = isDirty ? '1' : '0';
      const card = form.closest('[data-modal-card]');
      const button = card && card.querySelector('[data-person-save]');
      if (!button) return;
      button.textContent = UI.personSaveLabel(isDirty);
      button.classList.toggle('is-dirty', !!isDirty);
    },

    isPersonCardDirty(form) {
      return !!(form && form.dataset.dirty === '1');
    },

    closePersonCard() {
      const form = UI.currentRoot().querySelector('[data-person-card]');
      if (UI.isPersonCardDirty(form)) {
        const saved = UI.savePersonCard((form && form.dataset.personKey) || UI.state.ui.editPersonKey, { silent: true, close: false });
        if (!saved) return;
      }
      UI.state.ui.editPersonKey = '';
      UI.saveRender();
    },

    closeDirectorCard() {
      UI.state.ui.editDirectorKey = '';
      UI.saveRender();
    },

    navigatePersonCard(nextKey) {
      if (!nextKey) return;
      const form = UI.currentRoot().querySelector('[data-person-card]');
      if (UI.isPersonCardDirty(form)) {
        UI.savePersonCard(form.dataset.personKey || UI.state.ui.editPersonKey, { nextKey, message: 'Saved changes.' });
        return;
      }
      UI.state.ui.editPersonKey = nextKey;
      UI.saveRender();
    },

    savePersonCard(personKey, options) {
      const form = UI.currentRoot().querySelector('[data-person-card]');
      if (!form || !personKey) return;
      const opts = options || {};
      const data = new FormData(form);
      const previous = UI.findPersonByKey(personKey) || {};
      const finish = () => {
        UI.state.ui.editPersonKey = opts.nextKey || (opts.close ? '' : personKey);
        if (opts.silent) {
          UI.markPersonCardDirty(form, false);
          Store.save(UI.state);
          return true;
        }
        UI.saveRender(opts.message || (opts.nextKey ? 'Saved changes.' : (opts.close ? 'Saved and closed.' : 'Saved.')));
        return true;
      };
      if (form.dataset.personCardType === 'past') {
        const hiredDate = UI.readPersonDate(data, 'hiredDate', 'Hired date', true);
        const leftDate = UI.readPersonDate(data, 'leftDate', 'Left date', true);
        if (hiredDate === null || leftDate === null) return false;
        const role = String(data.get('role') || 'Ex-Employee').trim();
        const pastUpdates = {
          contractType: String(data.get('contractType') || 'terminated'),
          role,
          hiredAt: hiredDate,
          joinedDate: hiredDate,
          leftAt: leftDate,
          merits: Utils.clamp(Utils.int(data.get('merits'), UI.personMerits(previous)), 0, 10),
          exitType: String(data.get('exitType') || ''),
          roleHistory: UI.nextRoleHistory(previous, role, hiredDate)
        };
        UI.updatePersonByKey(personKey, pastUpdates);
        UI.recordStaffCardEdit(previous, pastUpdates);
        UI.scheduleStaffCardCloudSave(opts.silent ? 700 : 50);
        return finish();
      }
      const racingSkill = data.has('racingSkill') ? String(data.get('racingSkill') || '').trim() : String(previous.racingSkill || '').trim();
      if (data.has('racingSkill') && racingSkill && !/^\d+(\.\d+)?$/.test(racingSkill)) {
        UI.toast('Racing Skill must be a decimal number like 19.78.');
        return false;
      }
      const hireDate = data.has('joinedDate')
        ? UI.readPersonDate(data, 'joinedDate', 'Hire date', true)
        : (Utils.dateInput(UI.personHireValue(previous)) || '');
      if (data.has('joinedDate') && hireDate === null) return false;
      const role = data.has('role') ? String(data.get('role') || 'Employee').trim() : String(previous.role || 'Employee').trim();
      const currentUpdates = {
        contractType: String(data.get('contractType') || ''),
        man: data.has('man') ? Utils.num(data.get('man'), Utils.num(previous.man, 0)) : Utils.num(previous.man, 0),
        int: data.has('int') ? Utils.num(data.get('int'), Utils.num(previous.int, 0)) : Utils.num(previous.int, 0),
        end: data.has('end') ? Utils.num(data.get('end'), Utils.num(previous.end, 0)) : Utils.num(previous.end, 0),
        merits: data.has('merits') ? Utils.clamp(Utils.int(data.get('merits'), UI.personMerits(previous)), 0, 10) : UI.personMerits(previous),
        efficiency: data.has('efficiency') ? Utils.percent(data.get('efficiency'), Utils.num(previous.efficiency, 0)) : Utils.num(previous.efficiency, 0),
        role,
        hiredAt: hireDate,
        joinedDate: hireDate,
        roleHistory: data.has('role') ? UI.nextRoleHistory(previous, role, hireDate) : (previous.roleHistory || []),
        statPriority: data.has('statPriority') ? String(data.get('statPriority') || '') : String(previous.statPriority || ''),
        racingRank: data.has('racingRank') ? String(data.get('racingRank') || '') : String(previous.racingRank || ''),
        racingSkill,
        interestedIn: String(data.get('interestedIn') || 'training'),
        interestedOther: data.has('interestedOther') ? String(data.get('interestedOther') || '') : String(previous.interestedOther || ''),
        trainingInterest: Utils.clamp(Utils.int(data.get('trainingInterest'), 3), 1, 5),
        oneYearGoal: String(data.get('oneYearGoal') || '')
      };
      UI.updatePersonByKey(personKey, currentUpdates);
      UI.updateProfileEmployeeByKey(personKey, currentUpdates);
      UI.recordStaffCardEdit(previous, currentUpdates);
      UI.scheduleStaffCardCloudSave(opts.silent ? 700 : 50);
      return finish();
    },

    fetchPersonRacingSkill(personKey) {
      const form = UI.currentRoot().querySelector('[data-person-card]');
      if (UI.isPersonCardDirty(form)) {
        const saved = UI.savePersonCard((form && form.dataset.personKey) || personKey, { close: false, message: 'Saved changes.' });
        if (!saved) return;
      }
      const person = UI.findPersonByKey(personKey);
      if (!person) { UI.toast('Could not find that staff member.'); return; }
      const userId = String(person.id || '').trim();
      if (!userId) { UI.toast('This staff member needs a Torn user ID before racing-skill sync can run.'); return; }
      UI.captureSettingsInputs(UI.currentRoot());
      ApiClient.user(userId, 'personalstats', UI.state.settings.apiKey, { stat: 'racingskill' })
        .then((data) => {
          const raw = Company.first(data, [
            'racingskill',
            'racing_skill',
            'personalstats.racingskill',
            'personalstats.racing_skill',
            'personal_stats.racingskill',
            'personal_stats.racing_skill'
          ], '');
          const value = String(raw || '').trim();
          if (!value || !/^\d+(\.\d+)?$/.test(value)) {
            UI.toast('Torn did not return a racing skill value for this member.');
            return;
          }
          const updates = { racingSkill: value };
          UI.updatePersonByKey(personKey, updates);
          UI.updateProfileEmployeeByKey(personKey, updates);
          UI.recordStaffCardEdit(person, updates);
          UI.scheduleStaffCardCloudSave(50);
          UI.saveRender(`Fetched racing skill for ${person.name || userId}: ${value}.`);
        })
        .catch((error) => UI.toast(error.message));
    },

    syncPersonRoleLog(personKey, options) {
      const opts = options || {};
      const form = UI.currentRoot().querySelector('[data-person-card]');
      if (UI.isPersonCardDirty(form)) {
        UI.toast('Save the staff card before syncing the staff log, so I do not overwrite unsaved edits.');
        return;
      }
      const person = UI.findPersonByKey(personKey);
      if (!person) { UI.toast('Could not find that staff member.'); return; }
      const userId = String(person.id || '').trim();
      if (!userId) { UI.toast('This staff member needs a Torn user ID before staff log sync can run.'); return; }
      if (opts.older && !person.roleLogNextUrl) {
        UI.toast('No older staff-log page is saved for this member yet. Run Sync staff log first.');
        return;
      }
      UI.captureSettingsInputs(UI.currentRoot());
      const requestParams = opts.older ? { nextUrl: person.roleLogNextUrl } : { log: '6242,6263,6265,6267', limit: 100 };
      ApiClient.userLog(userId, UI.state.settings.apiKey, requestParams)
        .then((data) => {
          const nextUrl = ApiClient.safeNextLink(data);
          const rawActions = Timeline.staffActionsFromUserLog(data, person, UI.state);
          const actions = rawActions;
          if (!actions.length) {
            UI.updatePersonByKey(personKey, { roleLogSyncedAt: Utils.nowIso(), roleLogNextUrl: nextUrl });
            UI.saveRender(nextUrl ? 'No matching company staff actions found on this page. Older page cursor saved.' : 'No company staff actions found in the latest interaction logs for this member.');
            return;
          }
          const updated = Object.assign({}, person);
          const trainingRows = Timeline.trainingRowsFromStaffActions(actions, person);
          actions.forEach((action) => {
            if (action.type === 'hire' && action.timestamp) {
              updated.hiredAt = action.timestamp;
              updated.joinedDate = action.timestamp;
            }
            if (action.type === 'rank_change') {
              updated.rankHistory = Company.rankHistoryWithChange(updated, action.previousRank, action.newRank, action.timestamp || Utils.todayInput());
            }
            if (action.type === 'wage_change') {
              updated.wageHistory = Company.wageHistoryWithChange(updated, action.previousWage, action.newWage, action.timestamp || Utils.todayInput());
              updated.wage = action.newWage;
            }
          });
          if (trainingRows.length) UI.state.trainingLog = Timeline.mergeTrainingRows((UI.state.trainingLog || []).concat(trainingRows), UI.state);
          const inferredRanks = Timeline.inferRoleRankMap(actions, person, UI.state);
          const updates = {
            roleLogSyncedAt: Utils.nowIso(),
            roleLogLastEvent: actions[actions.length - 1].timestamp || '',
            roleLogOldestEvent: actions[0].timestamp || '',
            roleLogNextUrl: nextUrl
          };
          if (updated.hiredAt) updates.hiredAt = updated.hiredAt;
          if (updated.joinedDate) updates.joinedDate = updated.joinedDate;
          if (updated.rankHistory) updates.rankHistory = updated.rankHistory;
          if (updated.wageHistory) updates.wageHistory = updated.wageHistory;
          if (updated.wage !== undefined) updates.wage = updated.wage;
          UI.updatePersonByKey(personKey, updates);
          Planner.build(UI.state);
          const counts = actions.reduce((sum, action) => {
            sum[action.type] = (sum[action.type] || 0) + 1;
            return sum;
          }, {});
          const inferredText = inferredRanks.inferred ? `, ${inferredRanks.inferred} role ID${inferredRanks.inferred === 1 ? '' : 's'} inferred` : '';
          const conflictText = inferredRanks.conflicts ? ` (${inferredRanks.conflicts} role ID conflict${inferredRanks.conflicts === 1 ? '' : 's'} skipped)` : '';
          const cursorText = nextUrl ? ' Older log page available.' : ' No older log page returned.';
          UI.saveRender(`Synced ${opts.older ? 'older ' : ''}staff log for ${person.name || userId}: ${counts.training || 0} train${counts.training === 1 ? '' : 's'}, ${counts.rank_change || 0} rank change${counts.rank_change === 1 ? '' : 's'}, ${counts.wage_change || 0} wage change${counts.wage_change === 1 ? '' : 's'}${inferredText}${conflictText}.${cursorText}`);
        })
        .catch((error) => UI.toast(`${error.message} Staff log sync needs a Full access key or a custom key with user -> log.`));
    },

    currentRoot() {
      if (UI.popup && !UI.popup.closed) {
        try {
          const popupRoot = UI.popup.document.getElementById(APP.id);
          if (popupRoot) return popupRoot;
        } catch (error) {
          UI.popup = null;
        }
      }
      return UI.root;
    },

    deleteLedger(id) {
      UI.state.ledger = UI.state.ledger.filter((entry) => entry.id !== id);
      Planner.build(UI.state);
      UI.recordLedgerPending();
      UI.scheduleLedgerCloudSave(100);
      UI.saveRender('Ledger entry deleted.');
    },

    useTrain(id) {
      const clicked = UI.state.ledger.find((item) => item.id === id);
      if (!clicked) return;
      const identityMaps = Company.identityMaps(UI.state);
      const clickedIdentity = Company.resolveIdentity({ id: clicked.playerId, name: clicked.playerName }, UI.state, identityMaps);
      const entry = (UI.state.ledger || [])
        .filter((item) => Company.resolveIdentity({ id: item.playerId, name: item.playerName }, UI.state, identityMaps) === clickedIdentity && !Ledger.totals(item, UI.state.settings).done)
        .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.orderId || '').localeCompare(String(b.orderId || '')))[0] || clicked;
      const totals = Ledger.totals(entry, UI.state.settings);
      entry.usedTrains = Math.min(totals.totalTrains, totals.usedTrains + 1);
      entry.done = entry.usedTrains >= totals.totalTrains;
      entry.updatedAt = Utils.nowIso();
      Planner.build(UI.state);
      UI.recordLedgerPending();
      UI.scheduleLedgerCloudSave(100);
      UI.saveRender(`Train usage updated for ${entry.orderId || entry.playerName || 'order'}.`);
    },

    buildPlanner() {
      const requested = UI.state.planner.mode;
      Planner.build(UI.state);
      UI.saveRender(requested !== UI.state.planner.mode
        ? 'Auto and Hybrid require Company Boost or Ultimate. Manual schedule rebuilt.'
        : 'Planner calendar rebuilt.');
    },

    resetPlannerDay(day) {
      const date = Utils.dateInput(day);
      if (!date) return;
      UI.state.planner.manualSlots = UI.state.planner.manualSlots || {};
      Object.keys(UI.state.planner.manualSlots).forEach((key) => {
        if (key.startsWith(`${date}:`)) delete UI.state.planner.manualSlots[key];
      });
      if (UI.state.planner.completedDates) delete UI.state.planner.completedDates[date];
      if (UI.state.planner.trainingQueue && UI.state.planner.trainingQueue.date === date) {
        UI.state.planner.trainingQueue = null;
        UI.clearTrainingHighlight();
      }
      Store.save(UI.state);
      UI.saveRender(`Reset queue for ${date}.`);
    },

    togglePlannerQueue() {
      UI.state.ui.plannerQueueHidden = !UI.state.ui.plannerQueueHidden;
      UI.saveRender();
    },

    trainingPageUrl() {
      return 'https://www.torn.com/companies.php?step=your&type=1#/train=&option=employees';
    },

    prepareTrainingQueue() {
      const queue = UI.plannerTrainingQueue();
      if (!queue || !queue.slots.length) return null;
      const oldQueue = UI.state.planner.trainingQueue || {};
      if (oldQueue.date === queue.date && Array.isArray(oldQueue.slots) && oldQueue.slots.length && !oldQueue.completedAt) {
        oldQueue.activeIndex = Utils.clamp(Utils.int(oldQueue.activeIndex, 0), 0, oldQueue.slots.length);
        UI.state.planner.trainingQueue = oldQueue;
        return oldQueue;
      }
      const sameDay = oldQueue.date === queue.date && Array.isArray(oldQueue.slots);
      const activeIndex = sameDay ? Utils.clamp(Utils.int(oldQueue.activeIndex, 0), 0, queue.slots.length) : 0;
      UI.state.planner.trainingQueue = {
        date: queue.date,
        at: Utils.nowIso(),
        activeIndex,
        slots: queue.slots.map((slot) => ({
          identity: slot.identity || Company.resolveIdentity({ id: slot.playerId, name: slot.playerName }, UI.state),
          playerId: slot.playerId || '',
          playerName: slot.playerName || '',
          role: slot.role || '',
          type: slot.type || ''
        }))
      };
      return UI.state.planner.trainingQueue;
    },

    trainingQueueTarget(queue) {
      const activeQueue = queue || UI.state.planner.trainingQueue;
      if (!activeQueue || !Array.isArray(activeQueue.slots) || !activeQueue.slots.length) return null;
      const index = Utils.clamp(Utils.int(activeQueue.activeIndex, 0), 0, activeQueue.slots.length);
      if (index >= activeQueue.slots.length) return null;
      return Object.assign({}, activeQueue.slots[index], { queueIndex: index, queueLength: activeQueue.slots.length });
    },

    resolveTrainingSlot(slot) {
      if (!slot) return null;
      if (slot.playerId) return slot;
      const identityMaps = Company.identityMaps(UI.state);
      const identity = Company.resolveIdentity({ id: slot.playerId, name: slot.playerName }, UI.state, identityMaps);
      const rows = []
        .concat(UI.state.staff.current || [])
        .concat(UI.state.company && UI.state.company.profile ? (UI.state.company.profile.employees || []) : []);
      const match = rows.find((person) => Company.resolveIdentity(person, UI.state, identityMaps) === identity || Company.nameKey(person.name) === Company.nameKey(slot.playerName));
      return match ? Object.assign({}, slot, { playerId: match.id || slot.playerId || '', playerName: match.name || slot.playerName || '' }) : slot;
    },

    navigateTornTraining(url) {
      setTimeout(() => {
        try {
          const targetWin = UI.tornPageWindow();
          if (UI.openTornCompanyRoute(targetWin, url)) {
            return;
          }
        } catch (error) {}
        window.location.href = url;
      }, 250);
    },

    tornPageWindow() {
      try {
        if (UI.isStandalonePopup() && window.opener && !window.opener.closed) return window.opener;
      } catch (error) {}
      try {
        if (UI.popup && !UI.popup.closed && UI.popup.opener && !UI.popup.opener.closed) return UI.popup.opener;
      } catch (error) {}
      return window;
    },

    openTornCompanyRoute(win, url) {
      if (!win || win.closed) return false;
      const target = new URL(url, win.location.href);
      const option = (target.hash.match(/option=([^&]+)/i) || [])[1] || '';
      const sameCompanyPage = /\/companies\.php/i.test(win.location.pathname || win.location.href);
      const onCompanyManage = sameCompanyPage && /step=your/i.test(win.location.search || '') && /type=1/i.test(win.location.search || '');
      if (onCompanyManage && option) {
        try { win.history.replaceState(win.history.state, '', target.href); } catch (error) {
          try { win.location.hash = target.hash; } catch (hashError) {}
        }
        UI.dispatchTornRouteEvents(win);
        const clicked = UI.activateTornCompanyTab(win, option);
        if (!clicked) {
          setTimeout(() => { UI.activateTornCompanyTab(win, option); if (option === 'employees') UI.scheduleTrainingHighlight(); }, 150);
          setTimeout(() => { UI.activateTornCompanyTab(win, option); if (option === 'employees') UI.scheduleTrainingHighlight(); }, 500);
        }
        try { win.focus(); } catch (error) {}
        if (option === 'employees') UI.scheduleTrainingHighlight();
        return true;
      }
      win.location.href = target.href;
      try { win.focus(); } catch (error) {}
      if (option === 'employees') {
        setTimeout(() => {
          UI.activateTornCompanyTab(win, option);
          UI.scheduleTrainingHighlight();
        }, 900);
      }
      return true;
    },

    dispatchTornRouteEvents(win) {
      try { win.dispatchEvent(new win.HashChangeEvent('hashchange')); } catch (error) {
        try { win.dispatchEvent(new win.Event('hashchange')); } catch (eventError) {}
      }
      try { win.dispatchEvent(new win.PopStateEvent('popstate')); } catch (error) {
        try { win.dispatchEvent(new win.Event('popstate')); } catch (eventError) {}
      }
    },

    activateTornCompanyTab(win, option) {
      try {
        const doc = win.document;
        const tab = String(option || '').replace(/[^a-z0-9_-]/gi, '');
        if (!tab) return false;
        const selectors = [
          `li[aria-controls="${tab}"] a`,
          `[role="tab"][aria-controls="${tab}"] a`,
          `a.ui-tabs-anchor[href="#${tab}"]`,
          `a[href="#${tab}"]`
        ];
        const anchor = selectors.map((selector) => doc.querySelector(selector)).find(Boolean);
        if (!anchor) return false;
        UI.clickTornNode(win, anchor);
        return true;
      } catch (error) {
        return false;
      }
    },

    clickTornNode(win, node) {
      if (!win || !node) return false;
      const eventOpts = { bubbles: true, cancelable: true, view: win };
      try { node.dispatchEvent(new win.MouseEvent('mousedown', eventOpts)); } catch (error) {}
      try { node.dispatchEvent(new win.MouseEvent('mouseup', eventOpts)); } catch (error) {}
      try { node.dispatchEvent(new win.MouseEvent('click', eventOpts)); return true; } catch (error) {}
      try { node.click(); return true; } catch (error) {}
      return false;
    },

    startTrainingQueue() {
      UI.openTrainingQueuePage();
    },

    openTrainingQueuePage() {
      const queue = UI.plannerTrainingQueue();
      if (!queue || !queue.slots.length) {
        UI.toast('Build a planner queue before starting training.');
        return;
      }
      if (!UI.companyContextOk()) {
        UI.toast('Return to the Torn company page before starting training.');
        return;
      }
      const prepared = UI.prepareTrainingQueue();
      Store.save(UI.state);
      UI.toast(`Prepared ${prepared.slots.length} train${prepared.slots.length === 1 ? '' : 's'} for ${Utils.dateShort(prepared.date)}.`);
      UI.navigateTornTraining(UI.trainingPageUrl());
    },

    openStockPage() {
      if (!UI.companyContextOk()) {
        UI.toast('Return to the Torn company page before opening stock.');
        return;
      }
      UI.navigateTornTraining('https://www.torn.com/companies.php?step=your&type=1#/option=stock');
    },
    stockRowText(node) {
      return Company.nameKey(node && node.textContent || '');
    },
    findTornStockRow(doc, name) {
      const needle = Company.nameKey(name);
      if (!needle) return null;
      const rows = Array.from(doc.querySelectorAll('tr, li, .stock-item, .order-item'));
      const withInputs = rows.filter((row) => row && row.querySelector && row.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'));
      return withInputs.find((row) => UI.stockRowText(row).includes(needle)) || null;
    },
    tornStockInput(row) {
      if (!row || !row.querySelectorAll) return null;
      return Array.from(row.querySelectorAll('input'))
        .filter((input) => input && input.type !== 'hidden' && input.type !== 'checkbox' && input.type !== 'radio' && !input.disabled)
        .reverse()
        .find((input) => input.offsetParent !== null || (input.getClientRects && input.getClientRects().length)) || null;
    },
    setTornInputValue(win, input, value) {
      if (!win || !input) return false;
      const nextValue = String(Math.max(0, Utils.num(value, 0)));
      const proto = win.HTMLInputElement && win.HTMLInputElement.prototype ? win.HTMLInputElement.prototype : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && descriptor.set) descriptor.set.call(input, nextValue);
      else input.value = nextValue;
      ['input', 'change', 'keyup', 'blur'].forEach((type) => {
        try { input.dispatchEvent(new win.Event(type, { bubbles: true })); } catch (error) {}
      });
      return true;
    },
    fillStockOrderWindow(win, orderRows) {
      try { UI.activateTornCompanyTab(win, 'stock'); } catch (error) {}
      const doc = win && win.document;
      if (!doc) return { applied: 0, missing: orderRows.map((row) => row.name) };
      let applied = 0;
      const missing = [];
      orderRows.forEach((row) => {
        const targetRow = UI.findTornStockRow(doc, row.name);
        const input = UI.tornStockInput(targetRow);
        if (!input || !UI.setTornInputValue(win, input, row.quantity)) {
          missing.push(row.name);
          return;
        }
        applied += 1;
      });
      return { applied, missing };
    },
    suggestStockOrder() {
      UI.readStockSettings(UI.currentRoot());
      const plan = Company.stockPlan(UI.state);
      if (!plan.capacity) {
        UI.toast('Sync Business Profile first so restock suggestions know the warehouse capacity.');
        return;
      }
      let updated = 0;
      UI.state.company.stock.items.forEach((item) => {
        if (!Company.isRestockableStock(item)) {
          item.restockQty = '';
          return;
        }
        const row = plan.byKey.get(item.key);
        item.restockQty = row ? row.suggestedQty : 0;
        updated += 1;
      });
      UI.state.company.stockSettings = Store.stockSettingsFromItems(UI.state.company.stock.items, UI.state.company.stockSettings);
      Store.updateSyncCache(UI.state, 'stock');
      UI.saveRender(updated ? 'Restock quantities suggested from sales demand and storage capacity.' : 'No restockable stock rows found.');
    },
    applyStockOrderToTorn() {
      const orderRows = UI.stockOrderRows();
      if (!orderRows.length) {
        UI.toast('There are no restock quantities to apply right now.');
        return;
      }
      if (!UI.companyContextOk()) {
        UI.toast('Return to the Torn company page before applying a stock order.');
        return;
      }
      const win = UI.tornPageWindow();
      const targetUrl = 'https://www.torn.com/companies.php?step=your&type=1#/option=stock';
      UI.openTornCompanyRoute(win, targetUrl);
      const tryFill = (attempt) => {
        const result = UI.fillStockOrderWindow(win, orderRows);
        if (result.applied || attempt >= 6) {
          const missingText = result.missing.length ? ` Missing: ${result.missing.slice(0, 3).join(', ')}${result.missing.length > 3 ? ` +${result.missing.length - 3} more` : ''}.` : '';
          UI.toast(result.applied ? `Applied ${result.applied} stock row${result.applied === 1 ? '' : 's'} to Torn's stock tab.${missingText}` : `Could not find Torn's stock order inputs yet.${missingText}`);
          return;
        }
        setTimeout(() => tryFill(attempt + 1), attempt < 2 ? 250 : 500);
      };
      setTimeout(() => tryFill(0), 250);
    },

    advanceTrainingQueue(prepared, target) {
      prepared.activeIndex = target.queueIndex + 1;
      const queueComplete = prepared.activeIndex >= prepared.slots.length;
      if (target && target.type === 'sponsored') {
        Planner.rotateSponsoredIdentity(UI.state, target.identity || Company.resolveIdentity({ id: target.playerId, name: target.playerName }, UI.state));
      }
      if (queueComplete) {
        prepared.completedAt = Utils.nowIso();
        UI.state.planner.completedDates = UI.state.planner.completedDates || {};
        UI.state.planner.completedDates[prepared.date] = prepared.completedAt;
        Ledger.syncTrainingLog(UI.state);
        UI.clearTrainingHighlight();
      }
      UI.state.planner.trainingQueue = prepared;
      return queueComplete;
    },

    clickTrainingAction() {
      const prepared = UI.prepareTrainingQueue();
      if (!prepared || !prepared.slots.length) {
        UI.toast('Build a planner queue before training.');
        return;
      }
      if (!UI.companyContextOk()) {
        UI.toast('Return to the Torn company page before training.');
        return;
      }
      const target = UI.resolveTrainingSlot(UI.trainingQueueTarget(prepared));
      if (!target || !target.playerId) {
        UI.toast(`No Torn user ID detected for ${target && target.playerName ? target.playerName : 'the active queue member'}. Sync employees first.`);
        return;
      }
      prepared.slots[target.queueIndex] = Object.assign({}, prepared.slots[target.queueIndex], {
        playerId: target.playerId,
        playerName: target.playerName || prepared.slots[target.queueIndex].playerName
      });
      UI.state.planner.trainingQueue = prepared;
      Store.save(UI.state);
      const context = UI.trainingActionContext(target);
      if (!context || !context.link) {
        UI.openTrainingQueuePage();
        UI.saveRender(`Opened the Employees tab for ${target.playerName || target.playerId}. Press + again once Torn shows the train control.`);
        return;
      }
      const queueComplete = UI.advanceTrainingQueue(prepared, target);
      Store.save(UI.state);
      const message = queueComplete
        ? `Clicked Torn Train for ${target.playerName || target.playerId}. Queue complete; local training log refreshed. Use Settings sync center for Business, Latest News, and Employees when ready.`
        : `Clicked Torn Train for ${target.playerName || target.playerId}.`;
      const href = context.link.href || (context.row && context.row.querySelector('a.train-action[href*="trainemp2"]') ? context.row.querySelector('a.train-action[href*="trainemp2"]').href : '');
      try { if (context.win && context.win.focus) context.win.focus(); } catch (error) {}
      if (!UI.clickTornNode(context.win, context.link)) {
        try { context.win.location.href = href; } catch (fallbackError) {}
      }
      UI.saveRender(message);
    },

    requestFirePerson(key) {
      const person = UI.findPersonByKey(key);
      if (!person || !person.id) {
        UI.toast('No linked Torn user ID found for this staff member.');
        return;
      }
      const root = UI.currentRoot();
      UI.clearToast();
      const toast = root.ownerDocument.createElement('div');
      toast.className = 'pp-toast pp-toast-confirm';
      toast.innerHTML = `
        <strong>Fire ${Utils.esc(person.name || person.id)}?</strong>
        <span>This will click Torn's loaded FIRE action for user ${Utils.esc(person.id)}. Open the Employees tab first if Torn has not loaded the row yet.</span>
        <span class="pp-toast-actions">
          <button class="pp-btn is-danger" type="button" data-action="confirm-fire-person" data-person-key="${Utils.esc(UI.personRowKey(person))}">Fire in Torn</button>
          <button class="pp-btn" type="button" data-action="cancel-clear-data">Cancel</button>
        </span>`;
      root.appendChild(toast);
    },

    confirmFirePerson(key) {
      const person = UI.findPersonByKey(key);
      if (!person || !person.id) {
        UI.toast('No linked Torn user ID found for this staff member.');
        return;
      }
      if (!UI.companyContextOk()) {
        UI.toast('Return to the Torn company page before firing.');
        return;
      }
      const context = UI.fireActionContext(person);
      if (!context || !context.link) {
        UI.navigateTornTraining(UI.trainingPageUrl());
        UI.toast(`Opened the Employees tab for ${person.name || person.id}. Press Fire again once Torn shows the fire control.`);
        return;
      }
      const href = context.link.href || (context.row && context.row.querySelector('a.fire-action[href*="kickemp"]') ? context.row.querySelector('a.fire-action[href*="kickemp"]').href : '');
      try { if (context.win && context.win.focus) context.win.focus(); } catch (error) {}
      if (!UI.clickTornNode(context.win, context.link)) {
        try { context.win.location.href = href; } catch (fallbackError) {}
      }
      UI.toast(`Clicked Torn FIRE for ${person.name || person.id}.`);
    },

    trainingWindowCandidates() {
      const wins = [];
      const add = (win) => {
        try {
          if (!win || win.closed || !win.document || wins.includes(win)) return;
          wins.push(win);
        } catch (error) {}
      };
      add(window);
      try { if (UI.isStandalonePopup()) add(window.opener); } catch (error) {}
      try {
        if (UI.popup && !UI.popup.closed) {
          add(UI.popup);
          add(UI.popup.opener);
        }
      } catch (error) {}
      return wins;
    },

    isTrainingEmployeesWindow(win) {
      try {
        const loc = win.location;
        const companyPage = /\/companies\.php/i.test(loc.href || '') && /step=your/i.test(loc.search || '') && /type=1/i.test(loc.search || '');
        return companyPage && (/option=employees/i.test(loc.hash || '') || UI.tornCompanyTabActive(win, 'employees'));
      } catch (error) {
        return false;
      }
    },

    tornCompanyTabActive(win, option) {
      try {
        const doc = win.document;
        const tab = String(option || '').replace(/[^a-z0-9_-]/gi, '');
        const panel = doc.getElementById(tab);
        if (panel && panel.getClientRects().length && win.getComputedStyle(panel).display !== 'none') return true;
        const anchor = doc.querySelector(`a[href="#${tab}"], a.ui-tabs-anchor[href="#${tab}"], li[aria-controls="${tab}"] a`);
        const item = anchor ? anchor.closest('li,[role="tab"]') : doc.querySelector(`li[aria-controls="${tab}"], [role="tab"][aria-controls="${tab}"]`);
        if (!item) return false;
        return item.getAttribute('aria-selected') === 'true' || /\b(ui-tabs-active|ui-state-active)\b/.test(String(item.className || ''));
      } catch (error) {
        return false;
      }
    },

    trainingActionLink(target, doc) {
      if (!target || !doc) return null;
      const id = String(target.playerId || '').trim();
      const name = String(target.playerName || '').trim().toLowerCase();
      const outsideApp = (node) => node && !(node.closest && node.closest(`#${APP.id}`));
      const isDisabled = (node) => {
        if (!node) return true;
        const className = String(node.className || '');
        return node.disabled || node.getAttribute('aria-disabled') === 'true' || /\bdisabled\b/.test(className);
      };
      const usableAction = (row) => {
        if (!row || !outsideApp(row)) return null;
        const selectors = [
          '.train .train-action.btn-wrap button.torn-btn',
          '.train button.torn-btn',
          '.train .train-action.btn-wrap',
          '.train a.train-action[href*="trainemp2"]',
          'a.train-action[href*="trainemp2"]',
          'a[href*="step=trainemp2"]'
        ];
        for (const selector of selectors) {
          const actions = Array.from(row.querySelectorAll(selector)).filter(outsideApp);
          const enabled = actions.find((node) => !isDisabled(node) && !isDisabled(node.closest('.train-action')));
          if (enabled) return enabled;
        }
        return null;
      };
      let row = id ? doc.querySelector(`ul.employee-list li[data-user="${id}"], li[data-user="${id}"]`) : null;
      if (!row && name) {
        const rows = Array.from(doc.querySelectorAll('ul.employee-list li[data-user], tr, li, div[class]')).filter((node) => outsideApp(node) && node.getClientRects().length);
        row = rows.find((node) => String(node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase().includes(name));
      }
      const rowAction = usableAction(row);
      if (rowAction) return { element: rowAction, row };
      if (id) {
        const byHref = Array.from(doc.querySelectorAll(`a.train-action[href*="ID=${id}"], a[href*="step=trainemp2"][href*="ID=${id}"]`))
          .find((node) => outsideApp(node) && !isDisabled(node));
        if (byHref) return { element: byHref, row: byHref.closest('li[data-user],tr,li,div[class]') };
      }
      return null;
    },

    trainingActionContext(target) {
      const resolved = UI.resolveTrainingSlot(target);
      for (const win of UI.trainingWindowCandidates()) {
        if (!UI.isTrainingEmployeesWindow(win)) continue;
        const action = UI.trainingActionLink(resolved, win.document);
        if (action && action.element) return { win, doc: win.document, link: action.element, row: action.row };
      }
      return null;
    },

    fireActionLink(target, doc) {
      if (!target || !doc) return null;
      const id = String(target.id || target.playerId || '').trim();
      const name = String(target.name || target.playerName || '').trim().toLowerCase();
      const outsideApp = (node) => node && !(node.closest && node.closest(`#${APP.id}`));
      const usableAction = (row) => {
        if (!row || !outsideApp(row)) return null;
        const selectors = [
          '.fire .fire-action.btn-wrap button.torn-btn',
          '.fire button.torn-btn',
          '.fire .fire-action.btn-wrap',
          '.fire a.fire-action[href*="kickemp"]',
          'a.fire-action[href*="kickemp"]',
          'a[href*="step=kickemp"]'
        ];
        for (const selector of selectors) {
          const actions = Array.from(row.querySelectorAll(selector)).filter(outsideApp);
          const enabled = actions.find((node) => !(node.disabled || /\bdisabled\b/.test(String(node.className || ''))));
          if (enabled) return enabled;
        }
        return null;
      };
      let row = id ? doc.querySelector(`ul.employee-list li[data-user="${id}"], li[data-user="${id}"]`) : null;
      if (!row && name) {
        const rows = Array.from(doc.querySelectorAll('ul.employee-list li[data-user], tr, li, div[class]')).filter((node) => outsideApp(node) && node.getClientRects().length);
        row = rows.find((node) => String(node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase().includes(name));
      }
      const rowAction = usableAction(row);
      if (rowAction) return { element: rowAction, row };
      if (id) {
        const byHref = Array.from(doc.querySelectorAll(`a.fire-action[href*="ID=${id}"], a[href*="step=kickemp"][href*="ID=${id}"]`)).find(outsideApp);
        if (byHref) return { element: byHref, row: byHref.closest('li[data-user],tr,li,div[class]') };
      }
      return null;
    },

    fireActionContext(person) {
      for (const win of UI.trainingWindowCandidates()) {
        if (!UI.isTrainingEmployeesWindow(win)) continue;
        const action = UI.fireActionLink(person, win.document);
        if (action && action.element) return { win, doc: win.document, link: action.element, row: action.row };
      }
      return null;
    },

    isTrainingEmployeesPage() {
      return UI.isTrainingEmployeesWindow(window);
    },

    scheduleTrainingHighlight() {
      clearInterval(UI.trainHighlightTimer);
      UI.trainHighlightTimer = null;
      if (!UI.trainingWindowCandidates().some((win) => UI.isTrainingEmployeesWindow(win)) || !UI.trainingQueueTarget()) {
        UI.clearTrainingHighlight();
        return;
      }
      let attempts = 0;
      UI.trainHighlightTimer = setInterval(() => {
        attempts += 1;
        if (UI.highlightTrainingTarget() || attempts >= 24) {
          clearInterval(UI.trainHighlightTimer);
          UI.trainHighlightTimer = null;
        }
      }, 350);
    },

    clearTrainingHighlight() {
      const docs = UI.trainingWindowCandidates().map((win) => {
        try { return win.document; } catch (error) { return null; }
      });
      docs.filter(Boolean).forEach((doc) => {
        try {
          Array.from(doc.querySelectorAll('.pp-torn-train-glow')).forEach((node) => node.classList.remove('pp-torn-train-glow'));
        } catch (error) {}
      });
    },

    trainingHighlightContainer(node) {
      let current = node;
      while (current && current !== document.body) {
        if (current.closest && current.closest(`#${APP.id}`)) return null;
        const tag = String(current.tagName || '').toLowerCase();
        const className = String(current.className || '').toLowerCase();
        if (['tr', 'li'].includes(tag) || /employee|member|user|row|item/.test(className)) return current;
        current = current.parentElement;
      }
      return node && !(node.closest && node.closest(`#${APP.id}`)) ? node : null;
    },

    highlightTrainingTarget() {
      const target = UI.resolveTrainingSlot(UI.trainingQueueTarget());
      if (!target) return false;
      const id = String(target.playerId || '').trim();
      const name = String(target.playerName || '').trim().toLowerCase();
      UI.clearTrainingHighlight();
      const context = UI.trainingActionContext(target);
      let doc = context ? context.doc : document;
      let match = context ? context.link : null;
      const outsideApp = (node) => node && !(node.closest && node.closest(`#${APP.id}`));
      if (!match) {
        const trainingWin = UI.trainingWindowCandidates().find((win) => UI.isTrainingEmployeesWindow(win));
        if (trainingWin) {
          doc = trainingWin.document;
          if (id) {
            match = Array.from(doc.querySelectorAll('a[href]')).find((link) => {
              const linkId = (String(link.href || '').match(/[?&]ID=(\d+)/i) || [])[1] || '';
              return outsideApp(link) && linkId === id;
            });
          }
          if (!match && (id || name)) {
            const candidates = Array.from(doc.querySelectorAll('tr,li,a,button,span,div[class]')).filter((node) => outsideApp(node) && node.getClientRects().length);
            match = candidates.find((node) => {
              const text = String(node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
              if (!text) return false;
              return (id && text.includes(id)) || (name && text.includes(name));
            });
          }
        }
      }
      const glow = UI.trainingHighlightContainer(match);
      if (!glow) return false;
      glow.classList.add('pp-torn-train-glow');
      try { glow.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (error) {}
      return true;
    },

    applyNewsIncoming(incoming) {
      UI.state.staff.timeline = Timeline.reclassify(Timeline.mergeTimeline(UI.state.staff.timeline, incoming));
      Timeline.rebuildPeople(UI.state);
      UI.state.analytics.weeks = Timeline.analyticsFromEvents(UI.state.staff.timeline, UI.state);
      Ledger.syncTrainingLog(UI.state);
      Planner.build(UI.state);
      if (incoming.length) {
        const timestamps = incoming.map((event) => Utils.int(event.timestamp, 0)).filter(Boolean);
        if (timestamps.length) {
          const oldest = Math.min.apply(null, timestamps);
          const latest = Math.max.apply(null, timestamps);
          UI.state.company.newsSync.oldestTimestamp = UI.state.company.newsSync.oldestTimestamp ? Math.min(UI.state.company.newsSync.oldestTimestamp, oldest) : oldest;
          UI.state.company.newsSync.latestTimestamp = UI.state.company.newsSync.latestTimestamp ? Math.max(UI.state.company.newsSync.latestTimestamp, latest) : latest;
          UI.state.company.syncWatermarks = UI.state.company.syncWatermarks || {};
          UI.state.company.syncWatermarks.events = Object.assign({}, UI.state.company.syncWatermarks.events || {}, {
            latestTimestamp: Math.max(Utils.int(UI.state.company.syncWatermarks.events && UI.state.company.syncWatermarks.events.latestTimestamp, 0), latest),
            oldestTimestamp: UI.state.company.syncWatermarks.events && UI.state.company.syncWatermarks.events.oldestTimestamp
              ? Math.min(Utils.int(UI.state.company.syncWatermarks.events.oldestTimestamp, 0), oldest)
              : oldest,
            latestAt: new Date(latest * 1000).toISOString()
          });
        }
      }
      UI.state.company.newsSync.lastSynced = Utils.nowIso();
    },

    latestNewsDelta(incoming) {
      const marks = UI.state.company.syncWatermarks || {};
      const latestStored = Utils.int(marks.events && marks.events.latestTimestamp, 0) || Utils.int(UI.state.company.newsSync.latestTimestamp, 0);
      const existingIds = new Set((UI.state.staff.timeline || []).map((event) => Timeline.sourceEventId(event)).filter(Boolean));
      return (incoming || []).filter((event) => {
        const timestamp = Utils.int(event.timestamp, 0);
        const eventId = Timeline.sourceEventId(event);
        if (!timestamp) return false;
        if (timestamp > latestStored) return true;
        return timestamp === latestStored && eventId && !existingIds.has(eventId);
      });
    },

    async smartSync() {
      const syncId = 'smart-sync';
      UI.saveSettings({ silent: true });
      UI.readStockSettings(UI.currentRoot());
      if (UI.apiKeyMissing()) {
        UI.toast('Add an API key first.');
        return;
      }
      UI.beginSync(syncId, 'Smart sync');
      try {
        UI.syncStep(syncId, 'Loading cached workspace from Pythagoras API.', 8);
        UI.state.settings.userId = UI.state.settings.userId || PageData.userId();
        UI.state.settings.userName = UI.state.settings.userName || PageData.userName();
        UI.state.settings.companyId = UI.state.settings.companyId || UI.state.company.profile.id || PageData.companyId();
        UI.state = await Store.loadCloudWorkspace(UI.state);
        Company.dedupeStaff(UI.state);
        Company.removeDirectorsFromStaff(UI.state);
        Ledger.prepare(UI.state);

        UI.syncStep(syncId, 'Checking latest company news from Torn.', 22);
        const newsData = await ApiClient.companyNews(UI.state.settings.apiKey, {});
        const incoming = Timeline.normaliseNews(newsData);
        const delta = UI.latestNewsDelta(incoming);
        if (delta.length) {
          UI.syncStep(syncId, `Found ${delta.length} new company news entr${delta.length === 1 ? 'y' : 'ies'}.`, 44);
          UI.applyNewsIncoming(delta);
          Store.save(UI.state);
          Store.updateSyncCache(UI.state, ['news', 'trainingLog']);
          await UI.uploadSyncState(syncId, {
            events: delta,
            reports: UI.reportsFromEventsForApi(delta),
            staff: true
          });
        } else {
          UI.syncStep(syncId, 'No newer company news found.', 44);
          UI.state.company.newsSync.lastSynced = Utils.nowIso();
          Store.save(UI.state);
          Store.updateSyncCache(UI.state, 'news');
        }

        const businessStale = UI.syncStatus('business') !== 'fresh';
        const stockStale = UI.syncStatus('stock') !== 'fresh';
        const employeesStale = UI.syncStatus('employees') !== 'fresh';
        if (businessStale) {
          UI.syncStep(syncId, 'Business data is stale; running business sync.', 58);
          await UI.syncBusiness();
        } else {
          if (employeesStale) {
            UI.syncStep(syncId, 'Employee data is stale; running employee sync.', 66);
            await UI.syncEmployees();
          }
          if (stockStale) {
            UI.syncStep(syncId, 'Stock data is stale; running stock sync.', 78);
            await UI.syncStock();
          }
        }

        UI.state = await Store.loadCloudWorkspace(UI.state);
        Store.save(UI.state);
        Store.updateSyncCache(UI.state, ['business', 'employees', 'stock', 'news', 'trainingLog']);
        const message = delta.length
          ? `Smart sync complete. ${delta.length} new company news entr${delta.length === 1 ? 'y' : 'ies'} synced.`
          : 'Smart sync complete. No newer company news was found.';
        UI.saveRender(message);
        UI.finishSync(syncId, message);
      } catch (error) {
        UI.failSync(syncId, error);
        UI.toast(error.message);
      }
    },

    async syncTrainingLog() {
      const syncId = 'training-log';
      UI.beginSync(syncId, 'Sync training log');
      try {
        UI.captureSettingsInputs(UI.currentRoot());
        UI.syncStep(syncId, 'Requesting latest company news from Torn.', 15);
        const data = await ApiClient.companyNews(UI.state.settings.apiKey, {});
        UI.syncStep(syncId, 'Parsing company news for training rows.', 35);
        const incoming = Timeline.normaliseNews(data);
        UI.state.staff.timeline = Timeline.reclassify(Timeline.mergeTimeline(UI.state.staff.timeline, incoming));
        Timeline.rebuildPeople(UI.state);
        UI.state.analytics.weeks = Timeline.analyticsFromEvents(UI.state.staff.timeline, UI.state);
        if (incoming.length) {
          const timestamps = incoming.map((event) => Utils.int(event.timestamp, 0)).filter(Boolean);
          if (timestamps.length) {
            const oldest = Math.min.apply(null, timestamps);
            const latest = Math.max.apply(null, timestamps);
            UI.state.company.newsSync.oldestTimestamp = UI.state.company.newsSync.oldestTimestamp ? Math.min(UI.state.company.newsSync.oldestTimestamp, oldest) : oldest;
            UI.state.company.newsSync.latestTimestamp = UI.state.company.newsSync.latestTimestamp ? Math.max(UI.state.company.newsSync.latestTimestamp, latest) : latest;
          }
        }
        UI.state.company.newsSync.lastSynced = Utils.nowIso();
        UI.state.company.newsSync.fetchedPages += 1;
        const logs = Ledger.syncTrainingLog(UI.state);
        UI.syncStep(syncId, 'Rebuilding train schedule.', 60);
        Planner.build(UI.state);
        const stored = (UI.state.trainingLog || []).length;
        Store.save(UI.state);
        Store.updateSyncCache(UI.state, ['news', 'trainingLog']);
        await UI.uploadSyncState(syncId, {
          events: incoming,
          reports: UI.reportsFromEventsForApi(incoming)
        });
        const message = `Synced ${logs.length} visible training log row${logs.length === 1 ? '' : 's'} from ${incoming.length} latest company news entr${incoming.length === 1 ? 'y' : 'ies'} (${stored} stored).`;
        UI.saveRender(message);
        UI.finishSync(syncId, message);
      } catch (error) {
        UI.failSync(syncId, error);
        UI.toast(error.message);
      }
    },

    checkKeyInfo(options) {
      const opts = options || {};
      UI.captureSettingsInputs(UI.currentRoot());
      const key = String(UI.state.settings.apiKey || '').trim();
      if (!key) {
        if (opts.manual) UI.toast('Add an API key first.');
        return Promise.resolve(false);
      }
      return ApiClient.keyInfo(key)
        .then(async (data) => {
          const info = data && data.info || {};
          const access = info.access || {};
          const user = info.user || {};
          const accessLevel = Utils.int(access.level, 0);
          const accessType = String(access.type || '').trim();
          const fullAccess = accessLevel >= 4 || /full\s*access/i.test(accessType);
          const userId = String(user.id || '').trim();
          const companyId = String(user.company_id || user.companyId || '').trim();
          UI.state.settings.keyInfo = {
            lastChecked: Utils.nowIso(),
            accessLevel,
            accessType,
            fullAccess,
            companyAccess: Boolean(access.company),
            factionAccess: Boolean(access.faction),
            logCustomPermissions: Boolean(access.log && access.log.custom_permissions),
            userId,
            companyId
          };
          if (userId) UI.state.settings.userId = userId;
          if (companyId) UI.state.settings.companyId = companyId;
          Store.save(UI.state);
          if (Store.canUseCloudWorkspace(UI.state)) {
            UI.state = await Store.loadCloudWorkspace(UI.state);
            Store.save(UI.state);
          }
          UI.render(UI.currentRoot(), UI.currentRoot().ownerDocument);
          const accessText = fullAccess ? 'Full Access key detected.' : `Key access is ${accessType || `level ${accessLevel}` || 'limited'}.`;
          UI.toast(`${accessText}${userId ? ` User ID ${userId} filled.` : ''}${companyId ? ` Company ID ${companyId} filled.` : ''}`);
          return true;
        })
        .catch((error) => {
          UI.state.settings.keyInfo = Object.assign({}, UI.state.settings.keyInfo || {}, {
            lastChecked: Utils.nowIso(),
            fullAccess: false,
            accessType: 'Check failed'
          });
          Store.save(UI.state);
          UI.render(UI.currentRoot(), UI.currentRoot().ownerDocument);
          if (opts.manual) UI.toast(error.message);
          return false;
        });
    },

    logImportTrigger() {
      return String(UI.state.settings.logTrigger || DEFAULTS.settings.logTrigger || '!train').trim() || '!train';
    },

    logImportText(item) {
      const strings = [];
      const walk = (value) => {
        if (value === null || value === undefined) return;
        if (typeof value === 'string') {
          if (value.trim()) strings.push(value.trim());
          return;
        }
        if (Array.isArray(value)) {
          value.forEach(walk);
          return;
        }
        if (typeof value === 'object') Object.values(value).forEach(walk);
      };
      walk(item && item.data);
      walk(item && item.params);
      walk(item && item.details);
      strings.push(Timeline.logText(item));
      return Timeline.plainText(strings.join(' '));
    },

    logImportKey(item, fallbackId) {
      const id = String(item && (item.id || item.log_id) || fallbackId || '').trim();
      if (id) return `log4810:${id}`;
      const data = item && item.data || {};
      const timestamp = Utils.int(item && (item.timestamp || item.time || item.date), 0);
      const person = data.sender || data.from || data.user || data.player || data.receiver || '';
      const amount = UI.logImportAmount(item, '');
      return `log4810:${timestamp}:${person}:${amount}`;
    },

    logImportAmount(item, text) {
      const preferred = /^(amount|money|cash|payment|paid|value|total|cost)$/i;
      const blocked = /(?:^|_)(id|timestamp|time|company|message|receiver|sender|user|player|log)(?:_|$)/i;
      let found = 0;
      const scan = (value) => {
        if (found || !value || typeof value !== 'object') return;
        Object.entries(value).forEach(([key, raw]) => {
          if (found) return;
          if (raw && typeof raw === 'object') {
            scan(raw);
            return;
          }
          if (!preferred.test(key) || blocked.test(key)) return;
          const number = Utils.num(raw, 0);
          if (number > 0) found = number;
        });
      };
      scan(item && item.data);
      scan(item && item.params);
      if (found) return found;
      const plain = String(text || '');
      const money = plain.match(/\$\s*([\d,]+)/i) || plain.match(/\b(?:amount|money|cash|paid|payment|sent|received)\D{0,24}([\d,]{4,})/i);
      return money ? Utils.num(money[1], 0) : 0;
    },

    logImportTrainCount(text, trigger) {
      const clean = String(text || '').replace(/\s+/g, ' ');
      const escaped = String(trigger || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const after = clean.match(new RegExp(`${escaped}\\s*(?:x\\s*)?(\\d{1,4})\\b`, 'i'));
      if (after) return Math.max(0, Utils.int(after[1], 0));
      const labelled = clean.match(/\b(?:trains?|qty|quantity|count)\s*[:=]?\s*(\d{1,4})\b/i);
      return labelled ? Math.max(0, Utils.int(labelled[1], 0)) : 0;
    },

    logImportPerson(item, text) {
      const data = item && item.data || {};
      const currentUser = String(UI.state.settings.userId || '').trim();
      const idCandidates = [
        data.sender, data.sender_id, data.from, data.from_id, data.source, data.source_id,
        data.user, data.user_id, data.player, data.player_id, data.initiator, data.initiator_id,
        data.buyer, data.buyer_id, data.giver, data.giver_id, data.receiver
      ].map((value) => String(value || '').trim()).filter((value) => /^\d+$/.test(value) && value !== currentUser);
      const html = Timeline.logText(item);
      const anchor = Timeline.anchors(html).find((row) => row.id && row.id !== currentUser);
      const nameCandidates = [
        data.sender_name, data.from_name, data.user_name, data.player_name, data.name,
        data.initiator_name, data.buyer_name, data.giver_name,
        anchor && anchor.text
      ].map((value) => String(value || '').trim()).filter(Boolean);
      const id = idCandidates[0] || (anchor && anchor.id) || '';
      const byId = id ? UI.resolveStaffReference(id) : null;
      const byName = nameCandidates.map((name) => UI.resolveStaffReference(name)).find(Boolean);
      const byText = UI.staffLookupRows().find((person) => {
        const name = String(person.name || '').trim();
        return name.length > 2 && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
      });
      const match = byId || byName || byText || null;
      return {
        id: match && match.id ? String(match.id) : id,
        name: match && match.name ? match.name : (nameCandidates[0] || id || 'Imported log order'),
        person: match
      };
    },

    buildTrainingOrderFromLog(item, rowId, options) {
      const trigger = UI.logImportTrigger();
      const text = UI.logImportText(item);
      if (!text.toLowerCase().includes(trigger.toLowerCase())) return { skipped: 'trigger' };
      const sourceLogKey = UI.logImportKey(item, rowId);
      const exists = UI.state.ledger.some((entry) => entry.sourceLogKey === sourceLogKey || entry.sourceLogId === sourceLogKey);
      if (exists) return { skipped: 'duplicate' };
      const timestamp = Utils.int(item && (item.timestamp || item.time || item.date), 0);
      const who = UI.logImportPerson(item, text);
      const payment = UI.logImportAmount(item, text);
      const explicitTrains = UI.logImportTrainCount(text, trigger);
      const entry = {
        id: Utils.id('train'),
        orderId: '',
        playerName: who.name,
        playerId: who.id,
        entryDate: Utils.dateInput(timestamp || Utils.nowIso()) || Utils.todayInput(),
        contractType: 'paid',
        payment,
        pricePerTrain: Math.max(0, Utils.num(options.pricePerTrain, UI.state.settings.trainingPrice)),
        totalTrains: explicitTrains,
        usedTrains: 0,
        merits: Utils.clamp(Utils.int(who.person ? UI.personMerits(who.person) : 0, 0), 0, 10),
        manualDiscount: Utils.percent(options.manualDiscount, 0),
        applyDiscount: options.applyDiscount !== false,
        paid: true,
        done: false,
        source: 'log_import',
        sourceLogId: sourceLogKey,
        sourceLogKey,
        sourceLogTimestamp: timestamp,
        sourceLogText: text.slice(0, 500),
        createdAt: timestamp ? new Date(timestamp * 1000).toISOString() : Utils.nowIso(),
        updatedAt: Utils.nowIso()
      };
      if (!entry.totalTrains && entry.payment) entry.totalTrains = Ledger.estimateTotalFromPayment(entry, UI.state.settings);
      if (entry.totalTrains && !entry.payment) entry.payment = Ledger.totals(entry, UI.state.settings).finalCost;
      if (!entry.totalTrains && !entry.payment) return { skipped: 'empty' };
      UI.linkLedgerEntryToStaff(entry);
      return { entry };
    },

    async importTrainingOrdersFromLog() {
      const syncId = 'training-log';
      const root = UI.currentRoot();
      const form = root.querySelector('[data-ledger-form]');
      const options = {
        applyDiscount: form && form.applyDiscount ? form.applyDiscount.checked : true,
        manualDiscount: form && form.manualDiscount ? Utils.percent(form.manualDiscount.value, 0) : 0,
        pricePerTrain: form && form.pricePerTrain ? Utils.num(form.pricePerTrain.value, UI.state.settings.trainingPrice) : UI.state.settings.trainingPrice
      };
      const trigger = UI.logImportTrigger();
      if (!trigger) { UI.toast('Set a log trigger in Settings first.'); return; }
      UI.beginSync(syncId, 'Import training orders from Torn log');
      try {
        UI.syncStep(syncId, 'Requesting Torn payment log.', 15);
        const data = await ApiClient.requestV2('user/log', UI.state.settings.apiKey, { log: 4810, limit: 100 });
        UI.syncStep(syncId, 'Parsing payment log rows.', 45);
        const stats = { trigger: 0, duplicate: 0, empty: 0 };
        const imported = [];
        Timeline.userLogRows(data).forEach(([rowId, item]) => {
          const result = UI.buildTrainingOrderFromLog(item, rowId, options);
          if (result.entry) imported.push(result.entry);
          else if (result.skipped) stats[result.skipped] = (stats[result.skipped] || 0) + 1;
        });
        if (!imported.length) {
          const duplicateText = stats.duplicate ? ` ${stats.duplicate} matching row${stats.duplicate === 1 ? ' was' : 's were'} already imported.` : '';
          const message = `No new "${trigger}" training orders found.${duplicateText}`;
          UI.finishSync(syncId, message);
          UI.toast(message);
          return;
        }
        UI.state.ledger.push(...imported);
        Ledger.prepare(UI.state);
        Planner.build(UI.state);
        UI.recordLedgerPending();
        Store.save(UI.state);
        await UI.uploadLedgerCloudSave();
        const message = `Imported ${imported.length} training order${imported.length === 1 ? '' : 's'} from log.${stats.duplicate ? ` ${stats.duplicate} duplicate${stats.duplicate === 1 ? '' : 's'} skipped.` : ''}`;
        UI.saveRender(message);
        UI.finishSync(syncId, message);
      } catch (error) {
        UI.failSync(syncId, error);
        UI.toast(error.message);
      }
    },

    async syncPastStaff() {
      const syncId = 'past-staff';
      UI.beginSync(syncId, 'Sync past staff');
      try {
        UI.syncStep(syncId, 'Reclassifying stored company timeline.', 25);
        UI.state.staff.timeline = Timeline.reclassify(UI.state.staff.timeline);
        Timeline.rebuildPeople(UI.state);
        UI.syncStep(syncId, 'Linking training log rows.', 55);
        const logs = Ledger.syncTrainingLog(UI.state);
        Planner.build(UI.state);
        const stored = (UI.state.trainingLog || []).length;
        Store.save(UI.state);
        await UI.uploadSyncState(syncId, { staff: true });
        const message = `Past staff rebuilt. ${logs.length} visible training log row${logs.length === 1 ? '' : 's'} linked (${stored} stored).`;
        UI.saveRender(message);
        UI.finishSync(syncId, message);
      } catch (error) {
        UI.failSync(syncId, error);
        UI.toast(error.message);
      }
    },

    async syncNews(options) {
      UI.captureSettingsInputs(UI.currentRoot());
      const opts = options || {};
      const syncId = opts.backfill ? 'news-backfill' : 'news';
      const maxBackfillPages = 250;
      const backfillDelayMs = 600;
      const mergeNewsPage = (incoming) => {
        UI.state.staff.timeline = Timeline.reclassify(Timeline.mergeTimeline(UI.state.staff.timeline, incoming));
        Timeline.rebuildPeople(UI.state);
        UI.state.analytics.weeks = Timeline.analyticsFromEvents(UI.state.staff.timeline, UI.state);
        Ledger.syncTrainingLog(UI.state);
        Planner.build(UI.state);
        if (incoming.length) {
          const timestamps = incoming.map((event) => Utils.int(event.timestamp, 0)).filter(Boolean);
          if (timestamps.length) {
            const oldest = Math.min.apply(null, timestamps);
            const latest = Math.max.apply(null, timestamps);
            UI.state.company.newsSync.oldestTimestamp = UI.state.company.newsSync.oldestTimestamp ? Math.min(UI.state.company.newsSync.oldestTimestamp, oldest) : oldest;
            UI.state.company.newsSync.latestTimestamp = UI.state.company.newsSync.latestTimestamp ? Math.max(UI.state.company.newsSync.latestTimestamp, latest) : latest;
          }
        }
      };
      UI.beginSync(syncId, opts.backfill ? 'Fetch older company news' : 'Sync latest company news');
      try {
        if (opts.backfill && !UI.canUseHistoricalBackfill()) {
          const message = `Fetch older news is not available. ${UI.historyWindowMessage()}`;
          UI.finishSync(syncId, message);
          UI.toast(message);
          return;
        }
        if (!opts.backfill) {
          UI.syncStep(syncId, 'Requesting latest company news from Torn.', 15);
          const data = await ApiClient.companyNews(UI.state.settings.apiKey, {});
          UI.syncStep(syncId, 'Parsing company news.', 45);
          const incoming = Timeline.normaliseNews(data);
          mergeNewsPage(incoming);
          UI.state.company.newsSync.lastSynced = Utils.nowIso();
          UI.state.company.newsSync.fetchedPages += 1;
          UI.state.company.newsSync.firstBackfillDone = true;
          Store.save(UI.state);
          Store.updateSyncCache(UI.state, ['news', 'trainingLog']);
          await UI.uploadSyncState(syncId, {
            events: incoming,
            reports: UI.reportsFromEventsForApi(incoming),
            staff: true
          });
          const message = `Synced ${incoming.length} company news entries.`;
          UI.saveRender(message);
          UI.finishSync(syncId, message);
          return;
        }

        let pages = 0;
        let totalIncoming = 0;
        const uploadedEvents = [];
        let gapTarget = null;
        let reachedStart = false;
        let stoppedByEmptyPage = false;
        let stoppedByCap = false;
        let stoppedByEntitlement = false;
        let filteredByEntitlement = 0;

        while (pages < maxBackfillPages) {
          UI.syncStep(syncId, `Requesting older company news page ${pages + 1}.`, Math.min(78, 8 + pages * 2));
          const oldest = Utils.int(UI.state.company.newsSync.oldestTimestamp, 0);
          const earliest = Utils.int(UI.state.company.newsSync.earliestTimestamp, 0);
          let params = {};
          if (oldest && earliest && oldest <= earliest) {
            reachedStart = true;
            gapTarget = Timeline.reportGapCursor(UI.state);
            if (gapTarget && gapTarget.to) params = { to: gapTarget.to };
            else break;
          } else if (oldest) {
            params.to = Math.max(1, oldest - 1);
          }

          const data = await ApiClient.companyNews(UI.state.settings.apiKey, params);
          const rawIncoming = Timeline.normaliseNews(data);
          const incoming = UI.filterEventsByHistoryWindow(rawIncoming);
          filteredByEntitlement += rawIncoming.length - incoming.length;
          UI.syncStep(syncId, `Parsing page ${pages + 1}: ${incoming.length} kept from ${rawIncoming.length} entries.`, Math.min(82, 12 + pages * 2));
          mergeNewsPage(incoming);
          uploadedEvents.push(...incoming);
          pages += 1;
          totalIncoming += incoming.length;

          if (rawIncoming.length && !incoming.length) {
            stoppedByEntitlement = true;
            break;
          }
          if (gapTarget && gapTarget.date) {
            UI.state.company.newsSync.reportGapAttempts = UI.state.company.newsSync.reportGapAttempts || {};
            UI.state.company.newsSync.reportGapAttempts[gapTarget.date] = Utils.nowIso();
            gapTarget = null;
            if (pages < maxBackfillPages) await Utils.sleep(backfillDelayMs);
            continue;
          }
          if (!rawIncoming.length) {
            stoppedByEmptyPage = true;
            break;
          }

          const timestamps = incoming.map((event) => Utils.int(event.timestamp, 0)).filter(Boolean);
          const pageOldest = timestamps.length ? Math.min.apply(null, timestamps) : 0;
          const earliestLimit = Utils.int(UI.state.company.newsSync.earliestTimestamp, 0);
          if (!pageOldest) {
            stoppedByEmptyPage = true;
            break;
          }
          if (earliestLimit && pageOldest <= earliestLimit) {
            reachedStart = !!earliestLimit;
            if (pages < maxBackfillPages) await Utils.sleep(backfillDelayMs);
            continue;
          }
          if (pages < maxBackfillPages) await Utils.sleep(backfillDelayMs);
        }

        stoppedByCap = pages >= maxBackfillPages;
        UI.state.company.newsSync.lastSynced = Utils.nowIso();
        UI.state.company.newsSync.fetchedPages += pages;
        const suffix = gapTarget
          ? ` while checking missing daily report ${Utils.dateShort(gapTarget.date)}`
          : stoppedByEntitlement
            ? ` and stopped at the entitlement history limit`
          : reachedStart
            ? ' and reached the company start date'
            : stoppedByEmptyPage
              ? ' and Torn returned no older rows'
              : stoppedByCap
                ? ` and stopped at the ${maxBackfillPages}-page safety cap`
                : '';
        Store.save(UI.state);
        Store.updateSyncCache(UI.state, ['news', 'trainingLog']);
        await UI.uploadSyncState(syncId, {
          events: uploadedEvents,
          reports: UI.reportsFromEventsForApi(uploadedEvents),
          staff: uploadedEvents.length ? true : false
        });
        const filteredText = filteredByEntitlement ? ` ${filteredByEntitlement} older entr${filteredByEntitlement === 1 ? 'y was' : 'ies were'} outside the entitlement window.` : '';
        const message = `Fetched ${pages} older news page${pages === 1 ? '' : 's'} (${totalIncoming} kept entr${totalIncoming === 1 ? 'y' : 'ies'})${suffix}.${filteredText}`;
        UI.saveRender(message);
        UI.finishSync(syncId, message);
      } catch (error) {
        UI.failSync(syncId, error);
        UI.toast(error.message);
      }
    },

    applyBusinessData(data) {
      const previousProfileEmployees = UI.state.company.profile.employees || [];
      const result = Company.profile(data, UI.state);
      const employees = Company.dedupePeople((result.profile.employees || []).concat(Timeline.employeesFromApi(data)));
      const profile = Object.assign({}, UI.state.company.profile, result.profile);
      const currentContracts = new Map();
      (UI.state.staff.current || []).forEach((person) => {
        const key = UI.personRowKey(person);
        if (key) currentContracts.set(key, person.contractType || '');
      });
      profile.employees = Company.mergeStaff(previousProfileEmployees, employees).map((person) => {
        const key = UI.personRowKey(person);
        if (!key || !currentContracts.has(key)) return person;
        return Object.assign({}, person, { contractType: currentContracts.get(key) });
      });
      if (employees.some((person) => person.wageFromApi)) profile.employeeWagesSyncedAt = Utils.nowIso();
      UI.state.company.profile = profile;
      UI.state.company.detailed = Company.detailed(data, UI.state);
      UI.recordAdBudgetHistory('business-sync', UI.state.company.detailed.lastSynced || profile.lastSynced);
      UI.state.company.stock = Company.stock(data, UI.state.company.stock.items, UI.state);
      UI.state.company.stockSettings = Store.stockSettingsFromItems(UI.state.company.stock.items, UI.state.company.stockSettings);
      if (UI.state.company.stock.items.length) {
        UI.state.company.stockHistory.push({
          at: Utils.nowIso(),
          items: UI.state.company.stock.items.map((item) => ({
            key: item.key,
            inStock: item.inStock,
            onOrder: item.onOrder,
            soldAmount: item.soldAmount,
            soldWorth: item.soldWorth
          }))
        });
        UI.state.company.stockHistory = UI.state.company.stockHistory.slice(-52);
      }
      if (profile.id) UI.state.settings.companyId = profile.id;
      if (profile.typeId) UI.state.settings.companyTypeId = profile.typeId;
      if (profile.typeName) UI.state.settings.companyTypeName = profile.typeName;
      if (profile.directorId && !UI.state.settings.userId) UI.state.settings.userId = profile.directorId;
      if (profile.rating) UI.state.settings.companyStars = Utils.clamp(profile.rating, 1, 10);
      if (result.earliestTimestamp) UI.state.company.newsSync.earliestTimestamp = result.earliestTimestamp;
      if (profile.employees.length) UI.state.staff.current = Company.mergeStaff(UI.state.staff.current, profile.employees);
      if (UI.state.settings.userId) {
        const account = profile.employees.find((employee) => String(employee.id) === String(UI.state.settings.userId));
        if (account) UI.state.settings.userName = account.name || UI.state.settings.userName;
      }
      if (profile.directorId) {
        const director = profile.employees.find((employee) => String(employee.id) === String(profile.directorId));
        if (director) {
          UI.state.settings.userName = UI.state.settings.userName || director.name;
          UI.state.staff.directorsCurrent = Company.mergeStaff(UI.state.staff.directorsCurrent || [], [Object.assign({}, director, { role: 'Director', source: 'Torn API business sync' })]);
        }
      }
      Company.dedupeStaff(UI.state);
      Company.removeDirectorsFromStaff(UI.state);
      const riskStrikes = UI.recordStaffRiskStrikes('Business sync');
      UI.state.company.profile.currentEmployees = Company.profileHeadcount(UI.state.company.profile);
      Company.syncTrainingSetup(UI.state);
      Ledger.syncTrainingLog(UI.state);
      Planner.build(UI.state);
      return { riskStrikes };
    },

    async syncBusiness() {
      const syncId = 'business';
      UI.captureSettingsInputs(UI.currentRoot());
      UI.readStockSettings(UI.currentRoot());
      UI.beginSync(syncId, 'Sync business');
      try {
        UI.syncStep(syncId, 'Requesting company profile, stock, and employees from Torn API V2.', 12);
        const [profileData, stockData, employeeData] = await Promise.all([
          ApiClient.companyProfile(UI.state.settings.apiKey),
          ApiClient.companyStock(UI.state.settings.apiKey),
          ApiClient.companyEmployees(UI.state.settings.apiKey)
        ]);
        const data = {
          profile: profileData && (profileData.profile || profileData.company_profile || profileData),
          stock: stockData && (stockData.stock || stockData.company_stock || stockData),
          employees: employeeData && (employeeData.employees || employeeData.company_employees || employeeData)
        };
        UI.syncStep(syncId, 'Parsing business profile data.', 45);
        const result = UI.applyBusinessData(data) || {};
        const warnings = Company.stockWarnings(UI.state);
        Store.save(UI.state);
        Store.updateSyncCache(UI.state, ['business', 'employees', 'stock']);
        await UI.uploadSyncState(syncId, { business: true, staff: true, stock: true });
        const strikeText = result.riskStrikes ? ` ${result.riskStrikes} staff risk strike${result.riskStrikes === 1 ? '' : 's'} recorded.` : '';
        const message = warnings.length ? `Business synced. ${warnings.length} stock row${warnings.length === 1 ? '' : 's'} need attention.${strikeText}` : `Business Profile synced.${strikeText}`;
        UI.saveRender(message);
        UI.finishSync(syncId, message);
      } catch (error) {
        UI.failSync(syncId, error);
        UI.toast(error.message);
      }
    },

    syncProfile() {
      UI.syncBusiness();
    },

    async syncDetailed() {
      const syncId = 'business';
      UI.captureSettingsInputs(UI.currentRoot());
      if (!UI.state.settings.companyId) {
        UI.toast('Sync profile first or add Company ID in Settings.');
        return;
      }
      UI.beginSync(syncId, 'Sync company detailed');
      try {
        UI.syncStep(syncId, 'Requesting extended company profile from Torn API V2.', 18);
        const data = await ApiClient.companyProfile(UI.state.settings.apiKey);
        UI.syncStep(syncId, 'Parsing company detail fields.', 55);
        UI.state.company.detailed = Company.detailed(data, UI.state);
        UI.recordAdBudgetHistory('company-detail-sync', UI.state.company.detailed.lastSynced);
        if (UI.state.company.detailed.id && !UI.state.settings.companyId) UI.state.settings.companyId = UI.state.company.detailed.id;
        Planner.build(UI.state);
        Store.save(UI.state);
        Store.updateSyncCache(UI.state, 'business');
        await UI.uploadSyncState(syncId, { business: true });
        const message = 'Company detailed data synced.';
        UI.saveRender(message);
        UI.finishSync(syncId, message);
      } catch (error) {
        UI.failSync(syncId, error);
        UI.toast(error.message);
      }
    },

    async syncStock() {
      const syncId = 'stock';
      UI.captureSettingsInputs(UI.currentRoot());
      UI.readStockSettings(UI.currentRoot());
      UI.beginSync(syncId, 'Sync stock snapshot and services sold');
      try {
        UI.syncStep(syncId, 'Requesting stock data from Torn API V2.', 18);
        const data = await ApiClient.companyStock(UI.state.settings.apiKey);
        UI.syncStep(syncId, 'Parsing stock rows.', 52);
        const nextStock = Company.stock(data, UI.state.company.stock.items, UI.state);
        if (!nextStock.items.length) throw new Error('No stock rows were returned by Torn. Sync Business Profile first, then try again.');
        UI.state.company.stock = nextStock;
        UI.state.company.stockSettings = Store.stockSettingsFromItems(UI.state.company.stock.items, UI.state.company.stockSettings);
        UI.state.company.stockHistory.push({
          at: Utils.nowIso(),
          items: UI.state.company.stock.items.map((item) => ({
            key: item.key,
            inStock: item.inStock,
            onOrder: item.onOrder,
            soldAmount: item.soldAmount,
            soldWorth: item.soldWorth
          }))
        });
        UI.state.company.stockHistory = UI.state.company.stockHistory.slice(-52);
        const warnings = Company.stockWarnings(UI.state);
        Store.save(UI.state);
        Store.updateSyncCache(UI.state, 'stock');
        await UI.uploadSyncState(syncId, { stock: true });
        const message = warnings.length ? `Services sold synced. ${warnings.length} stock row${warnings.length === 1 ? '' : 's'} need attention.` : 'Services sold synced.';
        UI.saveRender(message);
        UI.finishSync(syncId, message);
      } catch (error) {
        UI.failSync(syncId, error);
        UI.toast(error.message);
      }
    },

    async syncEmployees() {
      const syncId = 'employees';
      UI.captureSettingsInputs(UI.currentRoot());
      UI.beginSync(syncId, 'Sync employees');
      try {
        UI.syncStep(syncId, 'Requesting employees from Torn API V2.', 18);
        const data = await ApiClient.companyEmployees(UI.state.settings.apiKey);
        UI.syncStep(syncId, 'Parsing employee rows.', 50);
        const employees = Timeline.employeesFromApi(data);
        UI.state.staff.current = Company.mergeStaff(UI.state.staff.current, employees);
        UI.state.company.profile.employees = Company.mergeStaff(UI.state.company.profile.employees, employees);
        UI.state.company.profile.lastSynced = Utils.nowIso();
        if (employees.some((person) => person.wageFromApi)) UI.state.company.profile.employeeWagesSyncedAt = Utils.nowIso();
        Company.dedupeStaff(UI.state);
        Company.removeDirectorsFromStaff(UI.state);
        UI.state.company.profile.currentEmployees = Company.profileHeadcount(UI.state.company.profile);
        const riskStrikes = UI.recordStaffRiskStrikes('Employee sync');
        Company.syncTrainingSetup(UI.state);
        Ledger.syncTrainingLog(UI.state);
        Store.save(UI.state);
        Store.updateSyncCache(UI.state, ['employees', 'business', 'trainingLog']);
        await UI.uploadSyncState(syncId, { business: true, staff: true });
        const message = `Synced ${UI.state.staff.current.length} employees.${riskStrikes ? ` ${riskStrikes} staff risk strike${riskStrikes === 1 ? '' : 's'} recorded.` : ''}`;
        UI.saveRender(message);
        UI.finishSync(syncId, message);
      } catch (error) {
        UI.failSync(syncId, error);
        UI.toast(error.message);
      }
    },

    readLoyaltyTiers(root) {
      const rows = Array.from((root || UI.currentRoot()).querySelectorAll('[data-loyalty-row]'));
      const tiers = rows.map((row) => ({
        min: Math.max(0, Utils.int(row.querySelector('[data-loyalty-min]') && row.querySelector('[data-loyalty-min]').value, 0)),
        percent: Utils.percent(row.querySelector('[data-loyalty-percent]') && row.querySelector('[data-loyalty-percent]').value, 0)
      })).filter((tier) => tier.min > 0 && tier.percent > 0);
      return tiers.length ? tiers.sort((a, b) => a.min - b.min) : Utils.clone(DEFAULTS.settings.loyaltyTiers);
    },

    readStockSettings(root) {
      const rows = Array.from((root || UI.currentRoot()).querySelectorAll('[data-stock-row]'));
      if (!rows.length) return;
      UI.state.company.stockSettings = Store.normaliseStockSettings(UI.state.company.stockSettings || {});
      const byKey = new Map(UI.state.company.stock.items.map((item) => [item.key, item]));
      rows.forEach((row) => {
        const item = byKey.get(row.dataset.stockRow);
        if (!item) return;
        const key = Store.stockSettingKey(item.key);
        const needsStock = row.querySelector('[data-stock-field="needsStock"]');
        const warningMode = row.querySelector('[data-stock-field="warningMode"]');
        const warningValue = row.querySelector('[data-stock-field="warningValue"]');
        const restockQty = row.querySelector('[data-stock-field="restockQty"]');
        if (!Company.isRestockableStock(item)) {
          item.needsStock = false;
          item.restockQty = '';
          if (key) delete UI.state.company.stockSettings[key];
          return;
        }
        if (needsStock) item.needsStock = needsStock.checked;
        if (warningMode) item.warningMode = warningMode.value === 'amount' ? 'amount' : 'percent';
        if (warningValue && item.warningMode === 'amount') item.warningAmount = Math.max(0, Utils.num(warningValue.value, 0));
        if (warningValue && item.warningMode !== 'amount') item.warningPercent = Utils.percent(warningValue.value, 10);
        item.restockQty = restockQty && String(restockQty.value || '').trim() !== '' ? Math.max(0, Utils.num(restockQty.value, 0)) : '';
        if (key) {
          UI.state.company.stockSettings[key] = {
            needsStock: !!item.needsStock,
            warningMode: item.warningMode === 'amount' ? 'amount' : 'percent',
            warningPercent: Utils.percent(item.warningPercent, 10),
            warningAmount: Math.max(0, Utils.num(item.warningAmount, 0)),
            restockQty: item.restockQty === '' || item.restockQty === null || item.restockQty === undefined ? '' : Math.max(0, Utils.num(item.restockQty, 0)),
            updatedAt: Utils.nowIso()
          };
        }
      });
    },

    saveStockSettings() {
      UI.readStockSettings(UI.currentRoot());
      Store.updateSyncCache(UI.state, 'stock');
      UI.saveRender('Stock settings saved.');
    },

    addLoyaltyTier() {
      UI.state.settings.loyaltyTiers = UI.readLoyaltyTiers(UI.currentRoot());
      UI.state.settings.loyaltyTiers.push({ min: 100, percent: 10 });
      UI.scheduleSettingsCloudSave(100);
      UI.saveRender();
    },

    deleteLoyaltyTier(index) {
      UI.state.settings.loyaltyTiers = UI.readLoyaltyTiers(UI.currentRoot()).filter((_, rowIndex) => rowIndex !== index);
      if (!UI.state.settings.loyaltyTiers.length) UI.state.settings.loyaltyTiers = Utils.clone(DEFAULTS.settings.loyaltyTiers);
      UI.scheduleSettingsCloudSave(100);
      UI.saveRender();
    },

    addRole() {
      const root = UI.currentRoot();
      UI.readRoleManagement(root);
      const input = root.querySelector('[data-new-role-name]');
      const role = input ? String(input.value || '').replace(/\s+/g, ' ').trim() : '';
      if (!role) { UI.toast('Add a role name first.'); return; }
      const key = UI.roleKey(role);
      UI.state.settings.hiddenRoles = (UI.state.settings.hiddenRoles || []).filter((item) => UI.roleKey(item) !== key);
      if (!(UI.state.settings.customRoles || []).some((item) => UI.roleKey(item) === key)) UI.state.settings.customRoles.push(role);
      UI.state.settings.roleLabels[key] = role;
      UI.scheduleSettingsCloudSave(100);
      UI.saveRender('Role added.');
    },

    deleteRole(key) {
      const roleKey = String(key || '').trim();
      if (!roleKey) return;
      UI.readRoleManagement(UI.currentRoot());
      UI.state.settings.customRoles = (UI.state.settings.customRoles || []).filter((role) => UI.roleKey(role) !== roleKey);
      const isDefault = (Company.defaultRoles || []).some((role) => UI.roleKey(role) === roleKey);
      if (isDefault && !(UI.state.settings.hiddenRoles || []).includes(roleKey)) UI.state.settings.hiddenRoles.push(roleKey);
      delete UI.state.settings.roleLabels[roleKey];
      delete UI.state.settings.roleColors[roleKey];
      Object.keys(UI.state.settings.roleRankMap || {}).forEach((rank) => {
        const mapped = String(UI.state.settings.roleRankMap[rank] || '');
        if (mapped === roleKey || UI.roleKey(mapped) === roleKey) {
          delete UI.state.settings.roleRankMap[rank];
          if (UI.state.settings.roleRankEvidence) delete UI.state.settings.roleRankEvidence[rank];
        }
      });
      UI.scheduleSettingsCloudSave(100);
      UI.saveRender(isDefault ? 'System role hidden.' : 'Role removed.');
    },

    readRoleManagement(root) {
      const rows = Array.from((root || UI.currentRoot()).querySelectorAll('[data-role-row]'));
      if (!rows.length) return;
      UI.state.settings.roleLabels = UI.state.settings.roleLabels || {};
      UI.state.settings.roleColors = UI.state.settings.roleColors || {};
      UI.state.settings.roleRankMap = UI.state.settings.roleRankMap || {};
      UI.state.settings.roleRankEvidence = UI.state.settings.roleRankEvidence || {};
      rows.forEach((row) => {
        const key = row.dataset.roleRow;
        const label = row.querySelector('[name^="roleLabel:"]');
        const rankIds = row.querySelector('[name^="roleRankIds:"]');
        const color = row.querySelector('[name^="roleColor:"]');
        const nextLabel = label ? String(label.value || '').replace(/\s+/g, ' ').trim() : '';
        Object.keys(UI.state.settings.roleRankMap).forEach((rank) => {
          const mapped = String(UI.state.settings.roleRankMap[rank] || '');
          if (mapped === key || UI.roleKey(mapped) === key) {
            delete UI.state.settings.roleRankMap[rank];
          }
        });
        if (nextLabel) UI.state.settings.roleLabels[key] = nextLabel;
        String(rankIds ? rankIds.value : '').split(/[,\s]+/).map((rank) => rank.replace(/[^\d]/g, '')).filter(Boolean).forEach((rank) => {
          const previous = UI.state.settings.roleRankEvidence[rank] || {};
          UI.state.settings.roleRankMap[rank] = key;
          UI.state.settings.roleRankEvidence[rank] = Object.assign({}, previous, {
            rank,
            role: previous.role || nextLabel || key,
            roleKey: key,
            source: previous.source || 'Manual role table',
            at: previous.at || Utils.nowIso(),
            updatedAt: Utils.nowIso(),
            conflict: false,
            note: previous.note || `Manual role table - ${nextLabel || key}`
          });
        });
        if (color && /^#[0-9a-f]{6}$/i.test(String(color.value || '').trim())) UI.state.settings.roleColors[key] = String(color.value).trim();
      });
    },

    readNotificationSettings(root) {
      const form = (root || UI.currentRoot()).querySelector('[data-notifications-form]');
      if (!form) return;
      const data = new FormData(form);
      const current = UI.notificationSettings();
      const warnHours = Math.max(1, Utils.num(data.get('notifySyncWarnHours'), current.sync.warnHours));
      const dangerHours = Math.max(warnHours, Utils.num(data.get('notifySyncDangerHours'), current.sync.dangerHours));
      UI.state.settings.notifications = {
        stock: { enabled: form.notifyStock ? form.notifyStock.checked : current.stock.enabled },
        addiction: {
          enabled: form.notifyAddiction ? form.notifyAddiction.checked : current.addiction.enabled,
          threshold: Math.max(1, Utils.num(data.get('notifyAddictionThreshold'), current.addiction.threshold))
        },
        inactivity: {
          enabled: form.notifyInactivity ? form.notifyInactivity.checked : current.inactivity.enabled,
          thresholdDays: Math.max(1, Utils.int(data.get('notifyInactiveDays'), current.inactivity.thresholdDays))
        },
        sync: {
          enabled: form.notifySync ? form.notifySync.checked : current.sync.enabled,
          warnHours,
          dangerHours
        }
      };
    },

    readThemeForm(root) {
      const form = (root || UI.currentRoot()).querySelector('[data-theme-form]');
      if (!form) return;
      const data = new FormData(form);
      UI.state.settings.customTheme = UI.state.settings.customTheme || Utils.clone(DEFAULTS.settings.customTheme);
      const name = String(data.get('customThemeName') || 'Custom').replace(/\s+/g, ' ').trim().slice(0, 32) || 'Custom';
      const vars = UI.themeVars(Object.keys(DEFAULTS.settings.customTheme.vars).reduce((next, key) => {
        next[key] = data.get(`themeVar:${key}`);
        return next;
      }, {}));
      UI.state.settings.customTheme.name = name;
      UI.state.settings.customTheme.vars = vars;
      if (form.classList.contains('pp-theme-dirty') || UI.state.settings.theme === 'custom') {
        UI.upsertSavedTheme(name, vars);
      }
      UI.state.settings.colors = UI.state.settings.colors || Utils.clone(DEFAULTS.settings.colors);
      Object.keys(UI.state.settings.colors).forEach((key) => {
        if (data.has(key)) UI.state.settings.colors[key] = String(data.get(key) || UI.state.settings.colors[key]).trim();
      });
    },

    markThemeDirty(form) {
      if (!form) return;
      const root = UI.currentRoot();
      const themeSelect = root.querySelector('select[name="theme"]');
      if (themeSelect) themeSelect.value = 'custom';
      UI.state.settings.theme = 'custom';
      UI.previewTheme('custom');
      form.classList.add('pp-theme-dirty');
      const vars = Object.keys(DEFAULTS.settings.customTheme.vars).reduce((next, key) => {
        const input = form.querySelector(`[name="themeVar:${key}"]`);
        next[key] = input ? input.value : DEFAULTS.settings.customTheme.vars[key];
        return next;
      }, {});
      UI.applyThemeVars(root, vars);
    },

    applyThemePreset() {
      const root = UI.currentRoot();
      const form = root.querySelector('[data-theme-form]');
      const select = form && form.querySelector('[data-theme-preset-select]');
      if (!form || !select) return;
      const saved = UI.savedThemeById(select.value);
      const vars = UI.themePresetVars(select.value);
      Object.entries(vars).forEach(([key, value]) => {
        const input = form.querySelector(`[name="themeVar:${key}"]`);
        const picker = form.querySelector(`[data-color-picker="themeVar:${key}"]`);
        if (input) input.value = value;
        if (picker) picker.value = value;
      });
      const nameInput = form.querySelector('[name="customThemeName"]');
      if (saved && nameInput) nameInput.value = saved.name;
      const themeSelect = root.querySelector('select[name="theme"]');
      if (themeSelect) themeSelect.value = select.value;
      UI.state.settings.theme = select.value;
      UI.previewTheme(select.value);
      form.classList.remove('pp-theme-dirty');
      UI.saveSettings({ silent: true });
      UI.toast('Theme preset applied.');
    },

    togglePanel(panelId) {
      if (!panelId) return;
      UI.state.ui.collapsedPanels = UI.state.ui.collapsedPanels || {};
      UI.state.ui.collapsedPanels[panelId] = !UI.state.ui.collapsedPanels[panelId];
      UI.saveRender();
    },

    toggleAnalyticsWeek(weekKey) {
      if (!weekKey) return;
      UI.state.ui.analyticsExpanded = UI.state.ui.analyticsExpanded || {};
      UI.state.ui.analyticsExpanded[weekKey] = !UI.state.ui.analyticsExpanded[weekKey];
      UI.saveRender();
    },

    resetUi() {
      const current = UI.state.ui;
      UI.state.ui = Object.assign({}, current, {
        editMode: false,
        minimized: false,
        editPersonKey: '',
        editDirectorKey: '',
        collapsedPanels: {},
        detailOpenState: {},
        panelSizes: {},
        tableSorts: {},
        analyticsExpanded: {},
        left: '',
        top: '',
        restoreWidth: '',
        restoreHeight: ''
      });
      [UI.root, UI.currentRoot()].forEach((root) => {
        if (!root) return;
        root.style.left = '';
        root.style.top = '';
        root.style.right = root === UI.root ? '18px' : '';
        root.style.width = '';
        root.style.height = '';
      });
      UI.saveRender('UI layout reset.');
    },

    toggleApiKey() {
      UI.captureSettingsInputs(UI.currentRoot());
      UI.state.ui.showApiKey = !UI.state.ui.showApiKey;
      UI.saveRender();
    },

    updateDatePreview(settingsForm) {
      if (!settingsForm) return;
      const data = new FormData(settingsForm);
      const preview = settingsForm.querySelector('[data-date-preview]');
      const settings = Object.assign({}, UI.state.settings, {
        dateFormat: String(data.get('dateFormat') || 'locale-medium'),
        customDateFormat: String(data.get('customDateFormat') || '').replace(/[^A-Za-z0-9 /.,:()[\]-]/g, '').slice(0, 40) || 'DD MMM YYYY'
      });
      const custom = settingsForm.querySelector('[name="customDateFormat"]');
      if (custom && custom.value !== settings.customDateFormat) custom.value = settings.customDateFormat;
      const customWrap = settingsForm.querySelector('[data-custom-date-wrap]');
      if (customWrap) customWrap.classList.toggle('pp-hidden', settings.dateFormat !== 'custom');
      if (preview) preview.textContent = Utils.formatDateWithSettings(new Date(), settings, true);
    },

    settingsForms(root) {
      return Array.from((root || UI.currentRoot()).querySelectorAll('[data-settings-form]'));
    },

    settingsFormContext(root) {
      const forms = UI.settingsForms(root);
      const values = new Map();
      forms.forEach((form) => {
        Array.from(new FormData(form).entries()).forEach(([key, value]) => values.set(key, value));
      });
      return {
        forms,
        data: {
          get(name) { return values.get(name); },
          has(name) { return values.has(name); }
        },
        field(name) {
          for (const form of forms) {
            if (form.elements && form.elements[name]) return form.elements[name];
          }
          return null;
        },
        checked(name, fallback) {
          const field = this.field(name);
          return field ? field.checked : fallback;
        }
      };
    },

    captureSettingsInputs(root) {
      const context = UI.settingsFormContext(root || UI.currentRoot());
      if (!context.forms.length) return;
      const data = context.data;
      if (data.has('apiKey')) UI.state.settings.apiKey = String(data.get('apiKey') || '').trim();
      if (data.has('userId')) UI.state.settings.userId = String(data.get('userId') || '').trim();
      if (data.has('userName')) UI.state.settings.userName = String(data.get('userName') || '').trim();
      if (data.has('companyId')) UI.state.settings.companyId = String(data.get('companyId') || '').trim();
      if (data.has('companyTypeId')) UI.state.settings.companyTypeId = String(data.get('companyTypeId') || UI.state.settings.companyTypeId || '').trim();
      UI.state.settings.companyTypeName = Company.typeNames[UI.state.settings.companyTypeId] || UI.state.settings.companyTypeName || '';
      if (data.has('dateFormat')) UI.state.settings.dateFormat = String(data.get('dateFormat') || UI.state.settings.dateFormat || 'locale-medium').trim();
      if (data.has('customDateFormat')) UI.state.settings.customDateFormat = String(data.get('customDateFormat') || UI.state.settings.customDateFormat || 'DD MMM YYYY').replace(/[^A-Za-z0-9 /.,:()[\]-]/g, '').slice(0, 40) || 'DD MMM YYYY';
      UI.state.settings.rememberApiKey = context.checked('rememberApiKey', UI.state.settings.rememberApiKey);
    },

    saveSettings(options) {
      const opts = options || {};
      const root = UI.currentRoot();
      const previousApiKey = String(UI.state.settings.apiKey || '').trim();
      const previousKeyInfo = Object.assign({}, UI.state.settings.keyInfo || {});
      const settingsContext = UI.settingsFormContext(root);
      const rolesForm = root.querySelector('[data-roles-form]');
      const notificationsForm = root.querySelector('[data-notifications-form]');
      const wageForm = root.querySelector('[data-wage-form]');
      if (settingsContext.forms.length) {
        const data = settingsContext.data;
        if (data.has('apiKey')) UI.state.settings.apiKey = String(data.get('apiKey') || '').trim();
        if (data.has('userId')) UI.state.settings.userId = String(data.get('userId') || '').trim();
        if (data.has('userName')) UI.state.settings.userName = String(data.get('userName') || '').trim();
        if (data.has('companyId')) UI.state.settings.companyId = String(data.get('companyId') || '').trim();
        if (data.has('companyTypeId')) UI.state.settings.companyTypeId = String(data.get('companyTypeId') || UI.state.settings.companyTypeId || '').trim();
        UI.state.settings.companyTypeName = Company.typeNames[UI.state.settings.companyTypeId] || UI.state.settings.companyTypeName || '';
        if (data.has('dateFormat')) UI.state.settings.dateFormat = String(data.get('dateFormat') || UI.state.settings.dateFormat || 'locale-medium').trim();
        if (data.has('customDateFormat')) UI.state.settings.customDateFormat = String(data.get('customDateFormat') || UI.state.settings.customDateFormat || 'DD MMM YYYY').replace(/[^A-Za-z0-9 /.,:()[\]-]/g, '').slice(0, 40) || 'DD MMM YYYY';
        UI.state.settings.rememberApiKey = settingsContext.checked('rememberApiKey', UI.state.settings.rememberApiKey);
        if (data.has('theme')) UI.state.settings.theme = String(data.get('theme') || UI.state.settings.theme || 'modul').trim();
        if (data.has('trainingPrice')) UI.state.settings.trainingPrice = Math.max(0, Utils.num(data.get('trainingPrice'), UI.state.settings.trainingPrice || 600000));
        if (data.has('companyStars')) UI.state.settings.companyStars = Utils.clamp(Utils.int(data.get('companyStars'), 1), 1, 10);
        if (data.has('maxPaidTrainsPerDay')) {
          const paidCapLimit = Planner.paidCapLimit(UI.state.settings);
          UI.state.settings.maxPaidTrainsPerDay = Utils.clamp(Utils.int(data.get('maxPaidTrainsPerDay'), paidCapLimit), 0, paidCapLimit);
        }
        UI.state.settings.trainerAutoDetect = settingsContext.checked('trainerAutoDetect', UI.state.settings.trainerAutoDetect !== false);
        UI.state.settings.plannerPriority = UI.state.settings.plannerPriority || Utils.clone(DEFAULTS.settings.plannerPriority);
        UI.state.settings.plannerPriority.addictionEnabled = settingsContext.checked('plannerAddictionEnabled', UI.state.settings.plannerPriority.addictionEnabled !== false);
        UI.state.settings.plannerPriority.inactivityEnabled = settingsContext.checked('plannerInactivityEnabled', UI.state.settings.plannerPriority.inactivityEnabled !== false);
        if (data.has('plannerAddictionWeight')) UI.state.settings.plannerPriority.addictionWeight = Math.max(0, Utils.num(data.get('plannerAddictionWeight'), UI.state.settings.plannerPriority.addictionWeight || 1));
        if (data.has('plannerInactivityWeight')) UI.state.settings.plannerPriority.inactivityWeight = Math.max(0, Utils.num(data.get('plannerInactivityWeight'), UI.state.settings.plannerPriority.inactivityWeight || 1));
        const trainerAssigned = settingsContext.field('trainerAssigned');
        if (trainerAssigned) UI.state.settings.trainerAssigned = trainerAssigned.checked;
        Company.syncTrainingSetup(UI.state);
        UI.state.settings.discountsEnabled = settingsContext.checked('discountsEnabled', UI.state.settings.discountsEnabled !== false);
        if (data.has('meritDiscountRate')) UI.state.settings.meritDiscountRate = Utils.percent(data.get('meritDiscountRate'), UI.state.settings.meritDiscountRate || 1);
        if (data.has('maxMeritDiscount')) UI.state.settings.maxMeritDiscount = Utils.percent(data.get('maxMeritDiscount'), UI.state.settings.maxMeritDiscount || 10);
        if (data.has('loyaltyMaxDiscount')) UI.state.settings.loyaltyMaxDiscount = Utils.percent(data.get('loyaltyMaxDiscount'), UI.state.settings.loyaltyMaxDiscount || 10);
        if ((root || UI.currentRoot()).querySelector('[data-loyalty-row]')) {
          UI.state.settings.loyaltyTiers = UI.readLoyaltyTiers(root);
          UI.state.settings.loyaltyTiersText = UI.state.settings.loyaltyTiers.map((tier) => `${tier.min}:${tier.percent}`).join(',');
        }
        if (data.has('globalPromoDiscount')) UI.state.settings.globalPromoDiscount = Utils.percent(data.get('globalPromoDiscount'), UI.state.settings.globalPromoDiscount || 0);
        if (data.has('maxTotalDiscount')) UI.state.settings.maxTotalDiscount = Utils.percent(data.get('maxTotalDiscount'), UI.state.settings.maxTotalDiscount || 90);
        if (data.has('logTrigger')) UI.state.settings.logTrigger = String(data.get('logTrigger') || UI.state.settings.logTrigger || '!train').trim() || '!train';
        if (data.has('supportUrl')) UI.state.settings.supportUrl = String(data.get('supportUrl') || '').trim();
        if (data.has('bugReportUrl')) UI.state.settings.bugReportUrl = String(data.get('bugReportUrl') || '').trim();
        if (data.has('contactUrl')) UI.state.settings.contactUrl = String(data.get('contactUrl') || '').trim();
      }
      if (notificationsForm) UI.readNotificationSettings(root);
      if (rolesForm) UI.readRoleManagement(root);
      UI.readThemeForm(root);
      if (wageForm) {
        const data = new FormData(wageForm);
        Object.keys(UI.state.settings.wage).forEach((key) => { UI.state.settings.wage[key] = Utils.num(data.get(key), UI.state.settings.wage[key]); });
        UI.state.settings.wageRoleRequirements = UI.state.settings.wageRoleRequirements || {};
        Array.from(data.entries()).forEach(([key, value]) => {
          if (!key.startsWith('wageRole:')) return;
          const parts = key.split(':');
          const roleKey = parts[1];
          const stat = parts[2];
          UI.state.settings.wageRoleRequirements[roleKey] = UI.state.settings.wageRoleRequirements[roleKey] || {};
          UI.state.settings.wageRoleRequirements[roleKey][stat] = Math.max(0, Utils.num(value, 0));
        });
      }
      UI.readStockSettings(root);
      Store.applyAdminConfig(UI.state);
      Planner.build(UI.state);
      UI.scheduleSettingsCloudSave(opts.silent ? 900 : 100);
      if (opts.silent) {
        Store.save(UI.state);
        return;
      }
      const shouldCheckKey = settingsContext.forms.length
        && UI.state.settings.apiKey
        && (previousApiKey !== String(UI.state.settings.apiKey || '').trim() || !previousKeyInfo.lastChecked);
      UI.saveRender(shouldCheckKey ? 'Settings saved. Checking key access...' : 'Settings saved.');
      if (shouldCheckKey) UI.checkKeyInfo();
    },

    readReportSections(root) {
      const boxes = Array.from((root || UI.currentRoot()).querySelectorAll('[data-report-section]'));
      if (!boxes.length) return Object.assign({}, DEFAULTS.ui.reportSections, UI.state.ui.reportSections || {});
      UI.state.ui.reportSections = Object.assign({}, DEFAULTS.ui.reportSections);
      boxes.forEach((box) => { UI.state.ui.reportSections[box.dataset.reportSection] = box.checked; });
      Store.save(UI.state);
      return UI.state.ui.reportSections;
    },

    mergeImportedSections(current, imported, sections) {
      const choices = Object.assign({}, DEFAULTS.ui.reportSections, sections || {});
      const next = Store.migrate(Store.merge(Utils.clone(DEFAULTS), current || {}));
      const incoming = Store.migrate(Store.merge(Utils.clone(DEFAULTS), imported || {}));
      const keepTimeline = choices.timeline || choices.trainingLog || choices.analytics || choices.balance || choices.staff || choices.pastStaff || choices.directors;
      if (choices.ledger) next.ledger = incoming.ledger || [];
      if (choices.trainingLog) next.trainingLog = incoming.trainingLog || [];
      if (choices.planner) next.planner = incoming.planner || Utils.clone(DEFAULTS.planner);
      if (choices.analytics || choices.balance) next.analytics = incoming.analytics || Utils.clone(DEFAULTS.analytics);
      if (choices.stock) {
        next.company.stock = incoming.company.stock || Utils.clone(DEFAULTS.company.stock);
        next.company.stockSettings = Store.normaliseStockSettings(incoming.company.stockSettings || {});
        next.company.stockHistory = incoming.company.stockHistory || [];
        Store.applyStockSettings(next);
      }
      if (choices.profile) next.company.profile = incoming.company.profile || Utils.clone(DEFAULTS.company.profile);
      if (choices.details) next.company.detailed = incoming.company.detailed || Utils.clone(DEFAULTS.company.detailed);
      if (choices.staff) next.staff.current = incoming.staff.current || [];
      if (choices.pastStaff) next.staff.past = incoming.staff.past || [];
      if (choices.directors) {
        next.staff.directorsCurrent = incoming.staff.directorsCurrent || [];
        next.staff.directorsPast = incoming.staff.directorsPast || [];
      }
      if (keepTimeline) {
        next.staff.timeline = incoming.staff.timeline || [];
        next.company.newsSync = incoming.company.newsSync || Utils.clone(DEFAULTS.company.newsSync);
      }
      if (choices.settings) {
        next.settings = incoming.settings || Utils.clone(DEFAULTS.settings);
        next.ui = Object.assign(next.ui || {}, incoming.ui || {});
      }
      next.ui.reportSections = choices;
      return Store.applyAdminConfig(Store.migrate(next));
    },

    async exportFull() {
      const sections = UI.readReportSections(UI.currentRoot());
      try {
        const result = await Store.cisApi(UI.state, '/api/cis/report/export', { sections }, 45000);
        Utils.download(result.filename || `${Utils.fileTimestamp()}-pythagoras-cis-export.json`, JSON.stringify(result.export || {}, null, 2), 'application/json;charset=utf-8');
        UI.toast('Server-side export created.');
      } catch (error) {
        UI.toast(error.message || 'Server-side export failed.');
      }
    },

    async uploadCompanyWorkspace() {
      if (!Store.canUseCloudWorkspace(UI.state)) {
        UI.toast('Cloud workspaces require a saved Torn API key, User ID, and synced Company ID.');
        return;
      }
      try {
        await Store.saveCloudWorkspace(UI.state, { snapshot: true, snapshotReason: 'manual' });
      } catch (error) {
        UI.toast(error.message || 'Cloud workspace could not be saved.');
        return;
      }
      const saved = Store.saveCompanySnapshot(UI.state);
      if (!saved) {
        UI.toast('Sync Business Profile or set a Company ID before saving this company workspace.');
        return;
      }
      Store.save(UI.state);
      UI.saveRender(`Cloud workspace saved: ${saved.label}.`);
    },

    async switchCompanyWorkspace(key) {
      const snapshots = Store.loadCompanySnapshots();
      const snapshot = snapshots[key];
      if (!snapshot) {
        UI.toast('That company workspace could not be found.');
        return;
      }
      if (!Store.canUseCloudWorkspace(UI.state)) {
        UI.toast('Cloud workspaces require a saved Torn API key.');
        return;
      }
      try {
        await Store.saveCloudWorkspace(UI.state, { snapshot: true, snapshotReason: 'switch' });
        Store.saveCompanySnapshot(UI.state);
        const next = Utils.clone(UI.state);
        next.settings.companyId = String(snapshot.companyId || '').trim();
        next.company.profile.id = String(snapshot.companyId || '').trim();
        UI.state = await Store.loadCloudWorkspace(next, { companyId: String(snapshot.companyId || '').trim() });
      } catch (error) {
        UI.toast(error.message || 'Cloud workspace could not be loaded.');
        return;
      }
      UI.state.ui.tab = 'data';
      Store.save(UI.state);
      UI.render(UI.currentRoot(), UI.currentRoot().ownerDocument);
      UI.toast(`Switched to ${snapshot.label || 'saved company workspace'}.`);
    },

    async deleteCompanyWorkspace(key) {
      if (!key) return;
      const activeKey = Store.companyKey(UI.state);
      if (key === activeKey) {
        UI.toast('You are using that company workspace right now. Switch before deleting it.');
        return;
      }
      const snapshots = Store.loadCompanySnapshots();
      const snapshot = snapshots[key];
      if (snapshot && Store.canUseCloudWorkspace(UI.state)) {
        try {
          await Store.deleteCloudWorkspace(UI.state, { companyId: String(snapshot.companyId || '').trim() });
        } catch (error) {
          UI.toast(error.message || 'Cloud workspace could not be deleted.');
          return;
        }
      }
      Store.deleteCompanySnapshot(key);
      UI.saveRender('Cloud workspace deleted.');
    },

    requestClearData() {
      const root = UI.currentRoot();
      UI.clearToast();
      const toast = root.ownerDocument.createElement('div');
      toast.className = 'pp-toast pp-toast-confirm';
      toast.innerHTML = `
        <strong>Clear Pythagoras data?</strong>
        <span>Choose whether to clear only this browser or delete the active cloud workspace for this user and company.</span>
        <span class="pp-toast-actions">
          <button class="pp-btn is-danger" type="button" data-action="confirm-clear-local-data">Clear local</button>
          <button class="pp-btn is-danger" type="button" data-action="confirm-clear-cloud-data">Delete cloud</button>
          <button class="pp-btn" type="button" data-action="cancel-clear-data">Cancel</button>
        </span>`;
      root.appendChild(toast);
    },

    resetLocalState(message) {
      Store.clearAll();
      UI.state = Store.applyAdminConfig(Store.migrate(Utils.clone(DEFAULTS)));
      UI.state.settings.userId = PageData.userId();
      UI.state.settings.userName = PageData.userName();
      UI.state.settings.companyId = PageData.companyId();
      UI.state.ui.tab = 'data';
      Store.save(UI.state);
      UI.render(UI.currentRoot(), UI.currentRoot().ownerDocument);
      UI.toast(message || 'Local Pythagoras data was cleared.');
    },

    clearLocalData() {
      UI.resetLocalState('Local Pythagoras data was cleared. Cloud workspace was left untouched.');
    },

    async clearCloudData() {
      try {
        const cloudDeleted = await Store.deleteCloudWorkspace(UI.state);
        UI.resetLocalState(cloudDeleted ? 'Cloud workspace was deleted and local data was cleared.' : 'No cloud workspace was found. Local data was cleared.');
      } catch (error) {
        UI.toast(error.message || 'Cloud workspace could not be deleted.');
      }
    },

    pickImport() {
      const input = UI.currentRoot().querySelector('[data-import-file]');
      if (input) input.click();
    },

    importFull(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const sections = UI.readReportSections(UI.currentRoot());
          UI.state = UI.mergeImportedSections(UI.state, JSON.parse(reader.result), sections);
          Ledger.prepare(UI.state);
          if (sections.ledger) {
            UI.recordLedgerPending();
            UI.scheduleLedgerCloudSave(100);
          }
          Store.save(UI.state);
          UI.render(UI.currentRoot(), UI.currentRoot().ownerDocument);
          UI.toast(sections.ledger ? 'Selected data import complete. Training orders queued for cloud sync.' : 'Selected data import complete.');
        } catch (error) {
          UI.toast('Import file was not valid JSON.');
        }
      };
      reader.readAsText(file);
    },

    async exportReport() {
      const sections = UI.readReportSections(UI.currentRoot());
      try {
        const result = await Store.cisApi(UI.state, '/api/cis/report/generate', { sections, format: 'html' }, 45000);
        Utils.download(result.filename || `${Utils.fileTimestamp()}-pythagoras-cis-report.html`, result.html || '', 'text/html;charset=utf-8');
        UI.toast('Server-generated HTML report exported.');
      } catch (error) {
        UI.toast(error.message || 'Server report generation failed.');
      }
    },

    async copyNewsletter() {
      const sections = UI.readReportSections(UI.currentRoot());
      try {
        const result = await Store.cisApi(UI.state, '/api/cis/report/generate', { sections, format: 'newsletter' }, 45000);
        Utils.copy(result.html || '').then(() => UI.toast('Server-generated newsletter HTML copied.'));
      } catch (error) {
        UI.toast(error.message || 'Server newsletter generation failed.');
      }
    },

    copyLedgerReceipt(id) {
      const entry = (UI.state.ledger || []).find((item) => item.id === id);
      if (!entry) {
        UI.toast('Training order not found.');
        return;
      }
      Ledger.prepare(UI.state);
      Store.save(UI.state);
      const staffId = String(entry.playerId || '').replace(/[^\d]/g, '');
      if (staffId) {
        window.open(`https://www.torn.com/messages.php#/p=compose&XID=${encodeURIComponent(staffId)}`, `pp-receipt-${staffId}`, 'width=900,height=760,noopener,noreferrer');
      }
      Utils.copy(Reports.trainingReceipt(UI.state, entry)).then(() => {
        UI.toast(staffId
          ? `Receipt HTML copied for ${entry.orderId || entry.playerName || 'training order'}. Message composer opened.`
          : `Receipt HTML copied for ${entry.orderId || entry.playerName || 'training order'}, but no staff ID is linked.`);
      });
    },

    copyBug() {
      Utils.copy(Reports.bugReport(UI.state)).then(() => UI.toast('Bug report data copied.'));
    },

    openSupport(kind) {
      const urls = {
        faq: UI.state.settings.supportUrl,
        bug: UI.state.settings.bugReportUrl,
        contact: UI.state.settings.contactUrl
      };
      if (kind === 'bug') Utils.copy(Reports.bugReport(UI.state)).then(() => UI.toast('Bug report data copied.'));
      if (!urls[kind]) {
        UI.toast(kind === 'faq' ? 'FAQ link is not configured for this build.' : 'Support link is not configured for this build.');
        return;
      }
      window.open(urls[kind], '_blank', 'noopener,noreferrer');
    },

    preparePopupWindow() {
      if (!UI.popup || UI.popup.closed) return null;
      try {
        const doc = UI.popup.document;
        doc.open();
        doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Pythagoras Project - CIS</title></head><body></body></html>');
        doc.close();
        UI.popup.name = APP.popupName;
        const root = doc.createElement('div');
        root.id = APP.id;
        doc.body.style.margin = '0';
        doc.body.style.background = UI.themeVars().bg;
        doc.body.appendChild(root);
        UI.installCss(doc);
        UI.render(root, doc);
        return root;
      } catch (error) {
        UI.toast('Popup opened, but the browser would not let me control its document. Close it and click Popup again.');
        return null;
      }
    },

    openPopup(options) {
      const opts = options || {};
      UI.state.ui.mode = 'popup';
      Store.save(UI.state);
      const url = UI.popupUrl();
      UI.popup = UI.popup && !UI.popup.closed ? UI.popup : window.open(url, APP.popupName, 'width=1120,height=760,resizable=yes,scrollbars=yes');
      if (!UI.popup) {
        UI.render(UI.root, document);
        UI.toast(opts.restore ? 'Popup mode is remembered. Click the badge to reopen it.' : 'Popup was blocked by the browser.');
        return;
      }
      UI.popup.focus();
      if (UI.preparePopupWindow()) {
        UI.watchPopupContext();
        UI.watchPopupClose();
        UI.root.style.display = 'none';
      } else {
        UI.state.ui.mode = 'embedded';
        Store.save(UI.state);
        UI.render(UI.root, document);
      }
    },

    closePopup() {
      UI.stopPopupContextWatcher();
      UI.stopPopupCloseWatcher();
      if (UI.isStandalonePopup()) {
        UI.state.ui.mode = 'embedded';
        Store.save(UI.state);
        try { window.close(); } catch (error) {}
        UI.saveRender('Returned to embedded mode.');
        return;
      }
      if (UI.popup && !UI.popup.closed) UI.popup.close();
      UI.popup = null;
      UI.state.ui.mode = 'embedded';
      UI.root.style.display = '';
      UI.saveRender('Returned to embedded mode.');
    },

    restorePopupBadge(message) {
      UI.stopPopupContextWatcher();
      UI.stopPopupCloseWatcher();
      UI.popup = null;
      if (UI.root) UI.root.style.display = '';
      UI.state.ui.mode = 'popup';
      Store.save(UI.state);
      UI.render(UI.root, document);
      if (message) UI.toast(message);
    },

    watchPopupClose() {
      if (UI.isStandalonePopup()) return;
      UI.stopPopupCloseWatcher();
      UI.popupCloseTimer = window.setInterval(() => {
        try {
          if (UI.state.ui.mode !== 'popup') {
            UI.stopPopupCloseWatcher();
            return;
          }
          if (UI.popup && !UI.popup.closed) return;
          UI.restorePopupBadge('Popup closed. Badge restored.');
        } catch (error) {
          UI.restorePopupBadge('Popup closed. Badge restored.');
        }
      }, 900);
    },

    watchPopupContext() {
      if (UI.isStandalonePopup()) {
        UI.stopPopupContextWatcher();
        UI.__ppLastCompanyContext = UI.companyContextOk();
        UI.contextTimer = window.setInterval(() => {
          try {
            const ok = UI.companyContextOk();
            if (UI.__ppLastCompanyContext === ok) return;
            UI.__ppLastCompanyContext = ok;
            UI.render(UI.root, document);
          } catch (error) {}
        }, 1500);
        return;
      }
      if (!UI.popup || UI.popup.closed) return;
      UI.stopPopupContextWatcher();
      try {
        UI.popup.__ppLastCompanyContext = UI.companyContextOk();
        UI.popup.__ppContextTimer = UI.popup.setInterval(() => {
          try {
            const ok = UI.companyContextOk();
            if (UI.popup.__ppLastCompanyContext === ok) return;
            UI.popup.__ppLastCompanyContext = ok;
            const popupRoot = UI.popup.document.getElementById(APP.id);
            if (popupRoot) UI.render(popupRoot, UI.popup.document);
          } catch (error) {}
        }, 1500);
      } catch (error) {}
    },

    stopPopupContextWatcher() {
      try {
        if (UI.contextTimer) {
          window.clearInterval(UI.contextTimer);
          UI.contextTimer = null;
        }
        if (UI.popup && UI.popup.__ppContextTimer) {
          UI.popup.clearInterval(UI.popup.__ppContextTimer);
          UI.popup.__ppContextTimer = null;
        }
      } catch (error) {}
    },

    stopPopupCloseWatcher() {
      try {
        if (UI.popupCloseTimer) {
          window.clearInterval(UI.popupCloseTimer);
          UI.popupCloseTimer = null;
        }
      } catch (error) {}
    },

    scrollSnapshot(root) {
      if (!root) return [];
      const selectors = ['.pp-body', '.pp-wrap', '.pp-timeline', '.pp-analytics-scroll', '.pp-past-scroll', '.pp-modal-card', '.pp-tabs', '.pp-subtabs', '.pp-calendar'];
      return selectors.flatMap((selector) => Array.from(root.querySelectorAll(selector)).map((node, index) => ({
        selector,
        index,
        top: node.scrollTop || 0,
        left: node.scrollLeft || 0
      }))).filter((item) => item.top || item.left);
    },

    restoreScroll(root, snapshot) {
      if (!root || !snapshot || !snapshot.length) return;
      const apply = () => {
        snapshot.forEach((item) => {
          const node = root.querySelectorAll(item.selector)[item.index];
          if (!node) return;
          node.scrollTop = item.top;
          node.scrollLeft = item.left;
        });
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(apply);
      else setTimeout(apply, 0);
    },

    saveRender(message) {
      Ledger.prepare(UI.state);
      Store.save(UI.state);
      UI.scheduleWorkspaceMirrorSave('state-change', 1800);
      const root = UI.currentRoot();
      const scroll = UI.scrollSnapshot(root);
      UI.render(root, root.ownerDocument);
      UI.restoreScroll(root, scroll);
      if (message) UI.toast(message);
    },

    clearToast() {
      const root = UI.currentRoot();
      if (!root) return;
      const old = root.querySelector('.pp-toast');
      if (old) old.remove();
      clearTimeout(UI.toastTimer);
    },

    toast(message) {
      const root = UI.currentRoot();
      UI.clearToast();
      const toast = root.ownerDocument.createElement('div');
      toast.className = 'pp-toast';
      toast.textContent = message;
      root.appendChild(toast);
      clearTimeout(UI.toastTimer);
      UI.toastTimer = setTimeout(() => toast.remove(), 3200);
    }
  };

  window.__PPCIS_UI = UI;

  async function boot() {
    if (document.getElementById(APP.id)) return;
    try {
      await UI.init();
    } catch (error) {
      console.error('[Pythagoras Project - CIS] Startup failed.', error);
      try {
        const rescue = document.createElement('div');
        rescue.id = APP.id;
        rescue.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:999999;padding:10px 12px;border:1px solid #d95d5d;border-radius:8px;background:#171a1a;color:#eff2ef;font:13px Arial,Helvetica,sans-serif;';
        rescue.textContent = 'Pythagoras Project - CIS failed to start. Check the browser console for details.';
        document.body.appendChild(rescue);
      } catch (rescueError) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
