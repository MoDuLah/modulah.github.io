// ==UserScript==
// @name         Tornfolio — Property, Lease & ROI Manager
// @namespace    https://github.com/local/torn-landlord-tenant-ledger
// @version      0.6.11
// @description  Manage your Torn property portfolio, rentals, market pricing, archive, and ROI.
// @author       MoDuL
// @copyright    2026 MoDuL. All rights reserved.
// @license      All Rights Reserved
// @downloadURL  https://modulah.github.io/tornfolio/tornfolio.user.js
// @updateURL    https://modulah.github.io/tornfolio/tornfolio.user.js
// @match        https://www.torn.com/properties.php*
// @connect      api.torn.com
// @connect      pp-api.sokin.xyz
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

(function () {
  "use strict";

  const APP_ID = "tlt-ledger";
  const STORE_KEY = "tornLandlordTenantLedger:v1";
  const API_BASE = "https://api.torn.com/v2";
  const HOSTED_API_BASE = "https://pp-api.sokin.xyz/tornfolio";
  const HOSTED_PRODUCT = "tornfolio";
  const HOSTED_SESSION_KEY = "RT_TORN_TF_HOSTED_SESSION";
  const LEGACY_HOSTED_SESSION_KEYS = ["RT_TORN_LTL_HOSTED_SESSION", "RT_TORN_MPG_HOSTED_SESSION"];
  const ICON_SPRITE_CACHE_KEY = "RT_TORN_TF_ICON_SPRITE_V1";
  const ICON_SPRITE_URL = `${HOSTED_API_BASE}/assets/icons/tornfolio-icons.svg`;
  const ICON_NAMES = ["logo", "dashboard", "home", "properties", "property", "rentals", "market", "archive", "insights", "alert", "activity", "money", "key", "tag", "heart", "settings", "sync", "external", "minimize", "close", "quick", "idea", "trophy", "exchange", "list", "calendar", "more", "add"];
  const BUILTIN_ICON_CONTENT = {
    logo: '<path d="M12 21c.2-5.8-.2-10.3-1.3-13.5"/><path d="M11 7.7C8.9 4.9 6.2 4.5 3.8 5.3c2.1.4 3.7 1.6 4.8 3.4"/><path d="M11 7.3c.2-3.2 2-5.2 4.6-6.1-.9 2.1-.9 4.1.1 5.9"/><path d="M11.6 7.5c2.7-2.2 5.5-2.1 7.8-.6-2.2-.1-4 .7-5.5 2.2"/><path d="M4 21c2.7-1.4 5.3-1.4 8 0 2.7-1.4 5.3-1.4 8 0"/>',
    dashboard: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9 21v-7h6v7"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9 21v-7h6v7"/>',
    properties: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/>',
    property: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/>',
    rentals: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3.5V2h6v1.5M8 8h8M8 12h8M8 16h5"/>',
    market: '<path d="M4 10v10h16V10M3 9l2-6h14l2 6"/><path d="M3 9c0 1.7 3 2 3 0 0 1.7 3 2 3 0 0 1.7 3 2 3 0 0 1.7 3 2 3 0 0 1.7 3 2 3 0 0 1.7 3 2 3 0"/><path d="M8 20v-6h8v6"/>',
    archive: '<path d="M4 8h16v12H4zM3 4h18v4H3z"/><path d="M9 12h6"/>',
    insights: '<path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M3 20h18"/>',
    alert: '<path d="M12 3 2.8 20h18.4z"/><path d="M12 9v5M12 17.5v.1"/>',
    activity: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    money: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.8-.8-1.9-1.2-3.3-1.2-1.8 0-3.2.9-3.2 2.3 0 3.5 6.5 1.5 6.5 5 0 1.3-1.3 2.3-3.4 2.3-1.5 0-2.8-.5-3.6-1.3M12 5.5v13"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M15 8l3 3M17 6l2 2"/>',
    tag: '<path d="M4 4h7l9 9-7 7-9-9z"/><circle cx="8" cy="8" r="1"/>',
    heart: '<path d="M20.5 8.8c0 5-8.5 10.2-8.5 10.2S3.5 13.8 3.5 8.8A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 8.5 1.1Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    sync: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8.5A7 7 0 0 1 18.8 7L20 9M4 15l1.2 2A7 7 0 0 0 18 15.5"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v7H4V6h7"/>',
    minimize: '<path d="M5 12h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    quick: '<path d="m13 2-8 12h7l-1 8 8-12h-7z"/>',
    idea: '<path d="M9 18h6M10 21h4"/><path d="M8.4 15.5A7 7 0 1 1 15.6 15.5c-.8.6-.9 1.4-.9 2.5H9.3c0-1.1-.1-1.9-.9-2.5Z"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM10 16h4M12 13v3M8 20h8"/><path d="M8 6H4v2a4 4 0 0 0 5 3.9M16 6h4v2a4 4 0 0 1-5 3.9"/>',
    exchange: '<path d="M4 7h14l-3-3M20 17H6l3 3"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    add: '<path d="M12 5v14M5 12h14"/>',
  };
  const COMMENT = "Tornfolio Property Lease ROI Manager";
  const ENDPOINTS = [
    { id: "torn-properties", path: "/torn/properties", label: "Home catalogue", detail: "Shows Torn's property types and upgrades.", action: "fetch-torn-properties", actionLabel: "Fetch catalogue" },
    { id: "user-properties", path: "/user/properties", label: "Homes I own", detail: "Find homes owned by your saved Torn key user.", action: "import-owned", actionLabel: "Fetch my owned homes" },
    { id: "spouse-properties", path: "/user/{spouse.id}/properties", label: "Spouse homes", detail: "Find homes owned by your spouse.", action: "fetch-spouse-properties", actionLabel: "Fetch spouse homes", spouseOnly: true },
    { id: "user-id-properties", path: "/user/{id}/properties", label: "Someone's owned homes", detail: "Find homes owned by the user ID or name you enter.", action: "fetch-user-properties", actionLabel: "Fetch that user" },
    { id: "user-property", path: "/user/property", label: "Home I live in", detail: "Find your current property.", action: "import-current", actionLabel: "Fetch my current home" },
    { id: "user-id-property", path: "/user/{id}/property", label: "Someone's current home", detail: "Find the current property for the user ID or name you enter.", action: "fetch-user-property", actionLabel: "Fetch that user" },
  ];
  const SIMPLE_TABS = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "properties", label: "Properties", icon: "properties" },
    { id: "rentals", label: "Rentals", icon: "rentals" },
    { id: "market", label: "Market", icon: "market" },
    { id: "archive", label: "Archive", icon: "archive" },
    { id: "insights", label: "Insights", icon: "insights" },
  ];
  const SIMPLE_TAB_IDS = SIMPLE_TABS.map((tab) => tab.id);
  const ADVANCED_DEFAULT_ENDPOINT = "user-properties";
  const PROPERTY_TYPES = [];
  const UPGRADE_COSTS = {
    hottub: 17000,
    sauna: 12000,
    smallpool: 35000,
    mediumpool: 100000,
    largepool: 500000,
    advancedshootingrange: 250000,
    openbar: 9000,
    smallvault: 20000000,
    mediumvault: 42000000,
    largevault: 98000000,
    extralargevault: 215000000,
    medicalfacility: 17000000,
    airstrip: 75000000,
    airstripwithplane: 75000000,
    privateyacht: 895000000,
  };
  const INTERIOR_UPGRADE_MULTIPLIERS = {
    sufficientinteriormodification: 0.25,
    superiorinteriormodification: 0.5,
    sufficient: 0.25,
    superior: 0.5,
  };
  const SUGGESTION_ROUNDING = 5;
  const DEFAULT_SETTINGS = {
    showRawJson: false,
    tableLimit: 25,
    defaultPropertyTypeId: "",
    targetAnnualRoi: 10,
    defaultSuggestionLeaseDays: 100,
    tornRateLimitPerMinute: 75,
    propertyHistoryPages: 25,
    showAdvancedTools: false,
    allowDirectTornFallback: true,
  };

  const emptyState = {
    schemaVersion: 2,
    apiKey: "",
    role: "landlord",
    statusFilter: "all",
    search: "",
    leases: [],
    lastSyncAt: null,
    lastSavedAt: null,
    lastSubscriptionCheckAt: null,
    panelOpen: true,
    panelPosition: null,
    panelSize: null,
    activeTab: "dashboard",
    advancedEndpointId: ADVANCED_DEFAULT_ENDPOINT,
    keyInfo: null,
    endpointInputs: {
      userId: "",
      lookupUser: "",
      propertyTypeId: "",
    },
    endpointResults: {},
    endpointData: {},
    serverSession: "",
    serverEntitlement: null,
    manualModalOpen: false,
    propertyTypes: PROPERTY_TYPES,
    tableSort: {},
    propertyCosts: {},
    settings: DEFAULT_SETTINGS,
    archivedRentals: [],
    activity: [],
    settingsOpen: false,
    detailView: null,
    syncState: "idle",
    syncMessage: "",
    syncProgress: null,
    ui: {
      propertyScope: "mine",
      propertySearch: "",
      propertyStatus: "all",
      propertyType: "all",
      rentalScope: "out",
      rentalSearch: "",
      rentalOwner: "all",
      rentalStatus: "active",
      rentalType: "all",
      marketScope: "mine",
      marketMode: "rent",
      marketType: "all",
      marketStatus: "all",
      archiveSearch: "",
      archiveOwner: "all",
      archiveType: "all",
      insightOwner: "all",
      insightType: "all",
    },
  };

  let state = loadState();
  let popupWindow = null;
  let tornRateQueue = Promise.resolve();
  let lastTornRequestAt = 0;
  let iconCacheLoaded = false;
  let iconCacheRecord = null;
  let iconFetchStarted = false;
  let syncProgressDismissTimer = null;

  function loadState() {
    const raw = safeGet(STORE_KEY);
    if (!raw) return { ...emptyState };
    try {
      const parsed = JSON.parse(raw);
      const next = {
        ...emptyState,
        ...parsed,
        endpointInputs: { ...emptyState.endpointInputs, ...(parsed.endpointInputs || {}) },
        propertyTypes: Array.isArray(parsed.propertyTypes) && parsed.propertyTypes.length ? parsed.propertyTypes.map(normalizeHostedPropertyType).filter(Boolean) : PROPERTY_TYPES,
        tableSort: { ...(parsed.tableSort || {}) },
        propertyCosts: { ...(parsed.propertyCosts || {}) },
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        archivedRentals: Array.isArray(parsed.archivedRentals) ? parsed.archivedRentals : [],
        activity: Array.isArray(parsed.activity) ? parsed.activity : [],
        syncProgress: normalizeSyncProgress(parsed.syncProgress),
        ui: { ...emptyState.ui, ...(parsed.ui || {}) },
      };
      next.leases = compactLeaseList(next.leases || []);
      if (next.syncState === "syncing") {
        next.syncState = "idle";
        next.syncMessage = "The previous sync was interrupted. You can start it again.";
        next.syncProgress = interruptedSyncProgress(next.syncProgress);
      }
      migrateContractLifecycle(next);
      normalizeSavedNavigation(next, parsed.activeTab);
      return next;
    } catch (_error) {
      return { ...emptyState };
    }
  }

  function syncProgressSteps() {
    return [
      { id: "access", label: "Secure account access", status: "pending", detail: "Waiting to check the saved Tornfolio session." },
      { id: "profile", label: "Profile and spouse details", status: "pending", detail: "Waiting for the hosted sync." },
      { id: "portfolio", label: "Owned, current and spouse properties", status: "pending", detail: "Waiting for the hosted sync." },
      { id: "rentals", label: "Current rental contracts", status: "pending", detail: "Waiting for the hosted sync." },
      { id: "history", label: "Property and rental history", status: "pending", detail: "Waiting for the hosted sync." },
      { id: "rentalMarket", label: "Rental comparisons", status: "pending", detail: "Waiting to scan rental listings." },
      { id: "saleMarket", label: "Sale comparisons", status: "pending", detail: "Waiting to scan sale listings." },
      { id: "save", label: "Save and rebuild Tornfolio", status: "pending", detail: "Waiting for fetched data." },
    ];
  }

  function normalizeSyncProgress(progress) {
    if (!progress || typeof progress !== "object") return null;
    const allowed = new Set(["pending", "active", "done", "warning", "error"]);
    const steps = Array.isArray(progress.steps) ? progress.steps.map((step) => ({
      id: clean(step && step.id, "step"),
      label: clean(step && step.label, "Sync step"),
      status: allowed.has(step && step.status) ? step.status : "pending",
      detail: clean(step && step.detail, ""),
    })) : syncProgressSteps();
    return {
      kind: clean(progress.kind, "all"),
      title: clean(progress.title, "Tornfolio sync"),
      message: clean(progress.message, ""),
      percent: clamp(Number(progress.percent) || 0, 0, 100),
      startedAt: clean(progress.startedAt, ""),
      finishedAt: clean(progress.finishedAt, ""),
      steps,
    };
  }

  function interruptedSyncProgress(progress) {
    const next = normalizeSyncProgress(progress) || {
      kind: "all",
      title: "Sync interrupted",
      message: "The page closed before the last sync finished.",
      percent: 0,
      startedAt: "",
      finishedAt: nowIso(),
      steps: syncProgressSteps(),
    };
    next.title = "Sync interrupted";
    next.message = "The page closed before the last sync finished. Start Sync Now to try again.";
    next.finishedAt = nowIso();
    next.steps = next.steps.map((step) => step.status === "active" ? { ...step, status: "error", detail: "Interrupted before this check finished." } : step);
    return next;
  }

  function beginSyncProgress(kind = "all") {
    if (syncProgressDismissTimer) {
      clearTimeout(syncProgressDismissTimer);
      syncProgressDismissTimer = null;
    }
    const rentalOnly = ["scan-owned-market", "scan-rental-market"].includes(kind);
    const saleOnly = kind === "scan-sale-market";
    const steps = syncProgressSteps();
    steps[0] = {
      ...steps[0],
      status: "active",
      detail: "Checking your saved Torn key and Tornfolio access.",
    };
    state.syncProgress = {
      kind,
      title: rentalOnly ? "Refreshing rental comparisons" : saleOnly ? "Refreshing sale comparisons" : "Syncing Tornfolio",
      message: rentalOnly || saleOnly
        ? `Preparing a fresh ${saleOnly ? "sale" : "rental"} comparison for available properties.`
        : "Preparing a secure portfolio sync.",
      percent: 6,
      startedAt: nowIso(),
      finishedAt: "",
      steps,
    };
  }

  function updateSyncProgress(stepId, status, detail, percent, message = "", paint = true) {
    const progress = normalizeSyncProgress(state.syncProgress);
    if (!progress) return;
    progress.steps = progress.steps.map((step) => step.id === stepId ? { ...step, status, detail: clean(detail, step.detail) } : step);
    if (Number.isFinite(Number(percent))) progress.percent = clamp(Number(percent), 0, 100);
    if (message) progress.message = message;
    state.syncProgress = progress;
    safeSet(STORE_KEY, JSON.stringify(state));
    if (paint) render();
  }

  function applyHostedSyncJobProgress(serverProgress, paint = true) {
    const progress = normalizeSyncProgress(state.syncProgress);
    const incoming = normalizeSyncProgress(serverProgress);
    if (!progress || !incoming) return;
    const incomingById = new Map(incoming.steps.map((step) => [step.id, step]));
    progress.steps = progress.steps.map((step) => {
      const next = incomingById.get(step.id);
      return next ? { ...step, status: next.status, detail: next.detail || step.detail } : step;
    });
    progress.percent = Math.max(progress.percent, incoming.percent);
    progress.title = incoming.title || progress.title;
    progress.message = incoming.message || progress.message;
    state.syncProgress = progress;
    safeSet(STORE_KEY, JSON.stringify(state));
    if (paint) render();
  }

  async function waitForHostedSyncJob(session, accepted) {
    const jobId = clean(accepted && accepted.jobId, "");
    if (!jobId) throw new Error("The hosted sync did not return a job reference.");
    applyHostedSyncJobProgress(accepted.progress);
    const deadline = Date.now() + (30 * 60 * 1000);
    let transientFailures = 0;
    while (Date.now() < deadline) {
      await sleep(1250);
      let body;
      try {
        body = await hostedRequest(`/api/tornfolio/sync/status?jobId=${encodeURIComponent(jobId)}`, {
          session,
          timeout: 20000,
        });
        transientFailures = 0;
      } catch (error) {
        if (error.status === 401 || error.status === 403 || error.status === 404) throw error;
        transientFailures += 1;
        if (transientFailures >= 5) throw error;
        const progress = normalizeSyncProgress(state.syncProgress);
        if (progress) {
          progress.message = `The progress check was interrupted; reconnecting (${transientFailures}/5)…`;
          state.syncProgress = progress;
          render();
        }
        continue;
      }
      applyHostedSyncJobProgress(body.progress);
      if (body.status === "done") {
        if (!body.result || typeof body.result !== "object") throw new Error("The hosted sync finished without a result.");
        return body.result;
      }
      if (body.status === "error") {
        const error = new Error(body.error || "The hosted sync failed.");
        error.status = Number(body.errorStatus) || 503;
        throw error;
      }
    }
    throw new Error("The hosted sync is still running after 30 minutes. Start Sync Now again to reconnect.");
  }

  function completeSyncProgressFromBody(body, paint = false) {
    const progress = normalizeSyncProgress(state.syncProgress);
    if (!progress || !body || typeof body !== "object") return;
    const metadata = body.metadata || body._metadata || {};
    const profile = body.profile || body.userProfile || body.user || {};
    const spouse = profile.spouse || {};
    const owned = firstArray(body, ["ownedProperties", "owned_properties", "userProperties", "propertiesOwned"]);
    const partner = firstArray(body, ["partnerProperties", "spouseProperties", "partner_properties", "spouse_properties"]);
    const current = body.currentProperty || body.current_property || body.home || null;
    const leases = firstArray(body, ["leases", "ledger", "contracts"]);
    const suggestions = firstArray(body, ["suggestions", "rentSuggestions", "rent_suggestions"]);
    const marketRows = cleanRoiSummaryRows(firstArray(body, ["roiSummary", "roi_summary", "marketSummary", "market_summary"]));
    const rentalComparableMatches = marketRows.reduce((sum, row) => sum + Number(row.rental_listings || row.listings || 0), 0);
    const saleComparableMatches = marketRows.reduce((sum, row) => sum + Number(row.sale_listings || 0), 0);
    const marketKinds = Array.isArray(metadata.marketKinds) ? metadata.marketKinds : ["rentals", "properties"];
    const eligibleCount = Number(metadata.marketEligibleCount ?? suggestions.length);
    const skippedCount = Number(metadata.marketSkippedCount || 0);
    const eligibleOwnedCount = Number(metadata.marketEligibleOwnedCount || 0);
    const eligiblePartnerCount = Number(metadata.marketEligiblePartnerCount || 0);
    const eligibilityBreakdown = ` (${eligibleOwnedCount.toLocaleString()} mine, ${eligiblePartnerCount.toLocaleString()} spouse)`;
    const historyEvents = Number(metadata.historyEventCount || firstArray(body, ["propertyHistoryEvents", "property_history_events", "propertyLogs", "property_logs"]).length || 0);
    const historyProperties = Number(metadata.historyPropertyCount || firstArray(body, ["propertyHistory", "property_history"]).length || 0);
    const archive = firstArray(body, ["tenancyArchive", "tenancy_archive", "leaseArchive", "lease_archive"]);
    const historyError = clean(metadata.historyError || metadata.history_error, "");
    const profileLabel = clean(profile.displayName || profile.name || profile.id || metadata.userId, "account owner");
    const details = {
      access: { status: "done", detail: "Tornfolio access accepted and the Torn key owner matched." },
      profile: { status: "done", detail: `Fetched ${profileLabel}${spouse.id || spouse.name ? ` and spouse ${clean(spouse.name || spouse.id, "details")}` : "; no spouse was returned"}.` },
      portfolio: { status: "done", detail: `${owned.length.toLocaleString()} owned · ${current ? "current home found" : "no current home returned"} · ${partner.length.toLocaleString()} spouse-owned.` },
      rentals: { status: "done", detail: `${leases.length.toLocaleString()} current property/contract ledger row${leases.length === 1 ? "" : "s"} rebuilt.` },
      history: historyError
        ? { status: "warning", detail: `History was limited: ${historyError}` }
        : { status: "done", detail: `${historyEvents.toLocaleString()} history event${historyEvents === 1 ? "" : "s"} across ${historyProperties.toLocaleString()} propert${historyProperties === 1 ? "y" : "ies"}; ${archive.length.toLocaleString()} archived rental${archive.length === 1 ? "" : "s"}.` },
      rentalMarket: { status: "done", detail: marketKinds.includes("rentals") ? `${eligibleCount.toLocaleString()} available household propert${eligibleCount === 1 ? "y" : "ies"}${eligibilityBreakdown} compared with ${rentalComparableMatches.toLocaleString()} selected rental listings; ${skippedCount.toLocaleString()} rented or listed skipped.` : "Rental comparison was not requested in this scan." },
      saleMarket: { status: "done", detail: marketKinds.includes("properties") ? `${eligibleCount.toLocaleString()} available household propert${eligibleCount === 1 ? "y" : "ies"}${eligibilityBreakdown} compared with ${saleComparableMatches.toLocaleString()} selected sale listings; ${skippedCount.toLocaleString()} rented or listed skipped.` : "Sale comparison was not requested in this scan." },
      save: { status: "done", detail: "Fetched data saved locally and every Tornfolio view rebuilt." },
    };
    progress.steps = progress.steps.map((step) => ({ ...step, ...(details[step.id] || {}) }));
    progress.percent = 100;
    progress.finishedAt = nowIso();
    progress.title = ["scan-owned-market", "scan-rental-market"].includes(progress.kind) ? "Rental comparison complete" : progress.kind === "scan-sale-market" ? "Sale comparison complete" : "Tornfolio sync complete";
    progress.message = body.message || "Everything returned by the sync has been checked and saved.";
    state.syncProgress = progress;
    scheduleCompletedSyncDismiss();
    if (paint) {
      safeSet(STORE_KEY, JSON.stringify(state));
      render();
    }
  }

  function scheduleCompletedSyncDismiss() {
    const progress = normalizeSyncProgress(state.syncProgress);
    if (!progress || !progress.finishedAt || progress.steps.some((step) => step.status === "error") || syncProgressDismissTimer) return;
    const finishedAt = progress.finishedAt;
    syncProgressDismissTimer = setTimeout(() => {
      syncProgressDismissTimer = null;
      const latest = normalizeSyncProgress(state.syncProgress);
      if (!latest || latest.finishedAt !== finishedAt || latest.steps.some((step) => step.status === "error")) return;
      state.syncProgress = null;
      if (state.syncState !== "syncing") {
        state.syncState = "idle";
        state.syncMessage = "";
      }
      saveState("Sync details closed");
      render();
    }, 5000);
  }

  function failSyncProgress(error, message = "Sync stopped before every check finished.") {
    const progress = normalizeSyncProgress(state.syncProgress);
    if (!progress) return;
    progress.steps = progress.steps.map((step) => step.status === "active"
      ? { ...step, status: "error", detail: clean(error && error.message, "This check failed.") }
      : step);
    progress.title = "Sync needs attention";
    progress.message = message;
    progress.finishedAt = nowIso();
    state.syncProgress = progress;
  }

  function normalizeSavedNavigation(next, savedTab) {
    if (["ledger", "user-panel"].includes(savedTab)) {
      next.activeTab = "rentals";
      return;
    }
    if (["history"].includes(savedTab)) {
      next.activeTab = "archive";
      return;
    }
    if (["settings", "advanced"].includes(savedTab)) {
      next.activeTab = "dashboard";
      next.settingsOpen = true;
      return;
    }
    if (SIMPLE_TAB_IDS.includes(savedTab)) return;
    if (ENDPOINTS.some((endpoint) => endpoint.id === savedTab)) {
      next.activeTab = "advanced";
      next.advancedEndpointId = savedTab;
      return;
    }
    next.activeTab = "dashboard";
  }

  function ensureRenderableActiveTab() {
    let nextTab = state.activeTab;

    if (ENDPOINTS.some((endpoint) => endpoint.id === nextTab)) {
      state.advancedEndpointId = nextTab;
      nextTab = "dashboard";
      state.settingsOpen = true;
    }
    if (!SIMPLE_TAB_IDS.includes(nextTab)) nextTab = "dashboard";

    state.activeTab = nextTab;
    return nextTab;
  }

  function saveState(message = "Saved") {
    state.lastSavedAt = nowIso();
    safeSet(STORE_KEY, JSON.stringify(state));
    updateSaveIndicators(message);
  }

  function updateSaveIndicators(message = "Saved") {
    const text = saveStatusText(message);
    const selectors = [`#${APP_ID} .tlt-save-status`];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => { node.textContent = text; });
      if (popupWindow && !popupWindow.closed) {
        popupWindow.document.querySelectorAll(selector).forEach((node) => { node.textContent = text; });
      }
    }
  }

  function saveStatusText(message = "Saved") {
    if (!state.lastSavedAt) return "Not saved yet.";
    return `${message} ${new Date(state.lastSavedAt).toLocaleTimeString()}.`;
  }

  function safeGet(key) {
    try {
      if (typeof GM_getValue === "function") return GM_getValue(key);
    } catch (_error) {
      // Fall back to localStorage below.
    }
    return localStorage.getItem(key);
  }

  function safeSet(key, value) {
    try {
      if (typeof GM_setValue === "function") {
        GM_setValue(key, value);
        return;
      }
    } catch (_error) {
      // Fall back to localStorage below.
    }
    localStorage.setItem(key, value);
  }

  function safeDelete(key) {
    try {
      if (typeof GM_deleteValue === "function") {
        GM_deleteValue(key);
        return;
      }
    } catch (_error) {
      // Fall back to localStorage below.
    }
    localStorage.removeItem(key);
  }

  function validatedIconSprite(value) {
    const source = String(value || "").trim();
    if (source.length < 500 || source.length > 100000 || !/^<svg\b/i.test(source)) return "";
    if (/<(?:script|style|foreignObject|iframe|object|embed|image|audio|video|link|meta)\b/i.test(source)) return "";
    if (/\son[a-z]+\s*=|\s(?:href|xlink:href)\s*=/i.test(source)) return "";
    if (!ICON_NAMES.every((name) => new RegExp(`\\bid=["']tf-icon-${name}["']`, "i").test(source))) return "";
    try {
      const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
      if (parsed.querySelector("parsererror") || parsed.documentElement.nodeName.toLowerCase() !== "svg") return "";
    } catch (_error) {
      return "";
    }
    return source;
  }

  function ensureIconCacheLoaded() {
    if (iconCacheLoaded) return iconCacheRecord;
    iconCacheLoaded = true;
    const raw = safeGet(ICON_SPRITE_CACHE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const svg = validatedIconSprite(parsed && parsed.svg);
      if (!svg) throw new Error("Invalid cached icon sprite.");
      iconCacheRecord = {
        svg,
        cachedAt: clean(parsed.cachedAt, ""),
        source: clean(parsed.source, ICON_SPRITE_URL),
      };
      return iconCacheRecord;
    } catch (_error) {
      safeDelete(ICON_SPRITE_CACHE_KEY);
      iconCacheRecord = null;
      return null;
    }
  }

  function iconSpriteDefsHtml() {
    const cached = ensureIconCacheLoaded();
    return cached ? `<span class="tf-icon-sprite" aria-hidden="true">${cached.svg}</span>` : "";
  }

  function fetchIconSpriteOnce() {
    if (iconFetchStarted || ensureIconCacheLoaded()) return Promise.resolve(false);
    iconFetchStarted = true;
    const requestUrl = `${ICON_SPRITE_URL}?once=${Date.now()}`;
    return new Promise((resolve, reject) => {
      const accept = (source) => {
        const svg = validatedIconSprite(source);
        if (!svg) {
          reject(new Error("The Tornfolio icon sprite was invalid."));
          return;
        }
        const record = { svg, cachedAt: nowIso(), source: ICON_SPRITE_URL };
        safeSet(ICON_SPRITE_CACHE_KEY, JSON.stringify(record));
        iconCacheRecord = record;
        iconCacheLoaded = true;
        resolve(true);
      };
      if (typeof GM_xmlhttpRequest === "function") {
        GM_xmlhttpRequest({
          method: "GET",
          url: requestUrl,
          headers: { Accept: "image/svg+xml" },
          timeout: 15000,
          onload: (response) => {
            if (response.status >= 200 && response.status < 300) accept(response.responseText);
            else reject(new Error(`Icon download returned ${response.status}.`));
          },
          onerror: () => reject(new Error("Could not download the Tornfolio icon sprite.")),
          ontimeout: () => reject(new Error("The Tornfolio icon download timed out.")),
        });
        return;
      }
      fetch(requestUrl, { headers: { Accept: "image/svg+xml" }, cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`Icon download returned ${response.status}.`);
          return response.text();
        })
        .then(accept, reject);
    });
  }

  function primeIconCache() {
    return fetchIconSpriteOnce().then((downloaded) => {
      if (downloaded) render();
      return downloaded;
    }).catch(() => false);
  }

  function clearIconCache() {
    safeDelete(ICON_SPRITE_CACHE_KEY);
    iconCacheRecord = null;
    iconCacheLoaded = true;
    iconFetchStarted = true;
    render();
    setStatus("Icon cache cleared. Reload Torn to download the SVG icon set once again.");
  }

  function iconCacheStatusText() {
    const cached = ensureIconCacheLoaded();
    if (!cached) return "Using the built-in fallback. The server sprite will download once on the next page load.";
    const when = cached.cachedAt ? new Date(cached.cachedAt).toLocaleString() : "an earlier session";
    return `SVG sprite cached locally since ${when}. It is not fetched again while this cache exists.`;
  }

  function money(value) {
    const number = Number(value || 0);
    if (!number) return "-";
    const options = Number.isInteger(number)
      ? { maximumFractionDigits: 0 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    return `$${number.toLocaleString(undefined, options)}`;
  }

  function days(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `${number.toLocaleString()}d` : "-";
  }

  function clean(value, fallback = "-") {
    if (value === null || value === undefined || value === "") return fallback;
    return String(value);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function dateFromRemainingDays(remainingDays) {
    const daysLeft = Number(remainingDays);
    if (!Number.isFinite(daysLeft)) return "";
    const date = new Date();
    date.setDate(date.getDate() + daysLeft);
    return date.toISOString().slice(0, 10);
  }

  function addDays(dateValue, daysValue) {
    if (!dateValue) return "";
    const daysNumber = Number(daysValue);
    if (!Number.isFinite(daysNumber)) return "";
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + Math.round(daysNumber));
    return date.toISOString().slice(0, 10);
  }

  function daysBetween(startDate, endDate) {
    if (!startDate || !endDate) return "";
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
    return Math.max(0, Math.round((end - start) / 86400000));
  }

  function remainingDaysFromEnd(endDate) {
    if (!endDate) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(end.getTime())) return "";
    return Math.max(0, Math.ceil((end - today) / 86400000));
  }

  function makeId(seed) {
    return `${seed || "lease"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function userName(user) {
    if (!user) return "";
    if (typeof user === "string") return user;
    if (user.name && user.id) return `${user.name} [${user.id}]`;
    return user.name || user.id || "";
  }

  function splitUserLabel(value) {
    const text = clean(value, "");
    const bracket = text.match(/^(.*?)\s*\[(\d+)\]\s*$/);
    if (bracket) return { name: bracket[1].trim(), id: bracket[2] };
    if (/^\d+$/.test(text)) return { name: "", id: text };
    return { name: text, id: "" };
  }

  function userLabelFromParts(name, id) {
    const cleanName = clean(name, "");
    const cleanId = clean(id, "");
    if (cleanName && cleanId) return `${cleanName} [${cleanId}]`;
    return cleanName || cleanId;
  }

  function userRecordId(value) {
    if (!value) return "";
    if (typeof value === "object") return clean(value.id || value.user_id || value.player_id, "");
    return splitUserLabel(value).id;
  }

  function householdIdentity(spouse = null) {
    const profile = profileInfo() || {};
    const partner = spouse || profileSpouse() || profile.spouse || {};
    const ids = new Set([
      keyInfoUserId(state.keyInfo),
      (state.endpointInputs || {}).userId,
      profile.id,
      profile.userId,
      partner.id,
      partner.userId,
    ].map(normalizeLookup).filter(Boolean));
    const names = new Set([
      profile.name,
      profile.displayName,
      partner.name,
      partner.displayName,
      "you",
      "spouse",
    ].map(normalizeLookup).filter(Boolean));
    return { ids, names };
  }

  function isHouseholdUser(value, household) {
    if (!value) return false;
    const id = userRecordId(value);
    if (id && household.ids.has(normalizeLookup(id))) return true;
    const label = splitUserLabel(userName(value));
    return Boolean(label.name && household.names.has(normalizeLookup(label.name)));
  }

  function explicitPropertyRenter(property) {
    if (!property || typeof property !== "object") return null;
    return property.rented_by || property.renter || property.tenant || property.renter_asked || null;
  }

  function propertyHasRentalTerms(property) {
    if (!property || typeof property !== "object") return false;
    return ["cost", "cost_per_day", "rental_period", "rental_period_remaining", "start_date", "end_date"]
      .some((key) => property[key] !== undefined && property[key] !== null && property[key] !== "");
  }

  function propertyHasRentalStatus(property) {
    const status = clean(property && property.status, "").toLowerCase().replace(/[ -]/g, "_");
    return ["rented", "leased", "lease_from", "leased_from", "on_lease", "rent_to", "rent_from", "rented_from_others"].includes(status);
  }

  function propertyRentalParty(property, spouse = null) {
    if (!property || typeof property !== "object") return null;
    const household = householdIdentity(spouse);
    const owner = property.owner;
    const renter = explicitPropertyRenter(property);
    const residents = Array.isArray(property.used_by) ? property.used_by : [];
    const evidence = Boolean(renter) || propertyHasRentalStatus(property) || propertyHasRentalTerms(property);
    if (!evidence) return null;

    if (isHouseholdUser(owner, household)) {
      const outside = [renter, ...residents].find((person) => person && !isHouseholdUser(person, household) && (userRecordId(person) || person === renter));
      return outside || null;
    }

    const householdOccupant = [renter, ...residents].find((person) => isHouseholdUser(person, household));
    if (householdOccupant && (propertyHasRentalStatus(property) || propertyHasRentalTerms(property) || householdOccupant === renter)) return householdOccupant;
    if (!userName(owner) && renter && (propertyHasRentalStatus(property) || propertyHasRentalTerms(property))) return renter;
    return null;
  }

  function isHouseholdOccupancyLease(lease, currentProperty, spouse = null) {
    if (!lease || !currentProperty || clean(lease.source, "").toLowerCase() === "manual") return false;
    const leaseId = clean(lease.propertyId || lease.property_id, "") || propertyIdFromLeaseId(lease.id);
    const currentId = clean(currentProperty.id || currentProperty.property_id || currentProperty.propertyId, "");
    const sameProperty = currentId && leaseId
      ? currentId === leaseId
      : normalizeLookup(lease.property) === normalizeLookup(propertyDisplayName(currentProperty));
    if (!sameProperty) return false;

    const household = householdIdentity(spouse);
    if (!isHouseholdUser(currentProperty.owner, household)) return false;
    const parties = [lease.landlord || lease.owner, lease.tenant || lease.renter]
      .filter((value) => value && !/^unknown\b/i.test(String(value)));
    return !parties.some((party) => !isHouseholdUser(party, household));
  }

  function propertyName(property) {
    if (!property) return "";
    if (typeof property === "string") return property;
    return property.name || property.type || property.title || "";
  }

  function numberOrBlank(value) {
    if (value === null || value === undefined || value === "") return "";
    const number = Number(value);
    return Number.isFinite(number) ? number : "";
  }

  function normalizeLease(property, source) {
    const propertyId = property.id || property.property_id || "";
    const propertyLabel = propertyName(property.property) || propertyName(property) || `Property ${propertyId}`;
    const remaining = property.rental_period_remaining;
    const period = property.rental_period;
    const totalCost = property.cost || "";
    const dailyCost = property.cost_per_day || (totalCost && period ? moneyRatio(totalCost / period) : "");
    const owner = userName(property.owner);
    const usedBy = Array.isArray(property.used_by) && property.used_by.length ? property.used_by[0] : null;
    const tenant = userName(property.rented_by || property.renter || property.renter_asked || usedBy);
    const endDate = dateFromRemainingDays(remaining);
    const startDate = endDate && period ? addDays(endDate, -Number(period)) : "";
    const notes = leaseNotesFromProperty(property);

    return {
      id: String(propertyId || makeId(source)),
      propertyId: String(propertyId || ""),
      property: propertyLabel,
      landlord: owner,
      tenant,
      amount: numberOrBlank(totalCost),
      dailyAmount: numberOrBlank(dailyCost),
      durationDays: numberOrBlank(period),
      remainingDays: numberOrBlank(remaining),
      startDate,
      endDate,
      status: normalizeLeaseStatus(property.status, source, tenant),
      roleHint: source,
      notes,
      updatedAt: nowIso(),
      source,
    };
  }

  function leaseNotesFromProperty(property) {
    const notes = [];
    const users = Array.isArray(property && property.used_by) ? property.used_by.map(userName).filter(Boolean) : [];
    if (users.length > 1) notes.push(`Shared by ${users.join(" + ")}`);
    if (property && property.lease_extension) notes.push("Lease extension offered");
    return notes.join("; ");
  }

  function normalizeLeaseStatus(status, source = "", tenant = "") {
    const value = clean(status, "").toLowerCase().replace(/-/g, "_");
    const role = clean(source, "").toLowerCase();
    if (value === "rented") return role === "tenant" ? "leased" : "rented";
    if (["leased", "lease_from", "leased_from", "on_lease"].includes(value)) return "leased";
    if (["for_rent", "listed", "market"].includes(value)) return "for_rent";
    if (["rent_to", "rentto"].includes(value)) return "rent_to";
    if (["rent_from", "rentfrom", "rented_from_others"].includes(value)) return "rent_from";
    if (["ended", "expired"].includes(value)) return "ended";
    if (value === "sold") return "sold";
    if (["none", "owned", "spouse_owned", "unknown", ""].includes(value)) return tenant ? (role === "tenant" ? "leased" : "rented") : "manual";
    return value;
  }

  function mergeLeases(incoming) {
    state.leases = compactLeaseList([...(state.leases || []), ...incoming]);
    state.lastSyncAt = nowIso();
    saveState();
    render();
  }

  function compactLeaseList(leases) {
    const byId = new Map();
    for (const lease of leases) {
      const key = leaseMergeKey(lease);
      byId.set(key, mergeLeaseRecords(byId.get(key), lease));
    }
    return Array.from(byId.values()).map((lease) => {
      const recalculated = recalculateLease(lease);
      const contractId = contractIdentity(recalculated);
      return { ...recalculated, contractId, id: contractId };
    }).sort(compareLeases);
  }

  function leaseMergeKey(lease) {
    return contractIdentity(lease);
  }

  function contractIdentity(lease = {}) {
    const propertyId = clean(lease.propertyId || lease.property_id, "") || propertyIdFromLeaseId(lease.id);
    const rawRole = clean(lease.roleHint || lease.source, "").toLowerCase();
    const direction = ["tenant", "on-lease", "rented-from-others", "rent-from"].includes(rawRole)
      ? "tenant"
      : ["spouse", "spouse-owned", "spouse_owned", "partner", "partner-owned", "partner_owned"].includes(rawRole)
        ? "spouse"
        : ["market", "listed"].includes(rawRole)
          ? "market"
          : "landlord";
    if (propertyId && isActiveLeaseSnapshot(lease)) {
      // Torn exposes a live property snapshot rather than a stable rental-contract ID.
      // Dates reconstructed from `rental_period_remaining` can move by a day between
      // syncs, but a property can only have one live contract in each direction.
      return `active:${propertyId}:${direction}`;
    }
    const explicit = clean(lease.contractId || lease.contract_id || lease.rentalId || lease.rental_id, "");
    if (explicit && !/^(?:active|derived):/.test(explicit)) return /^(?:contract|legacy|manual):/.test(explicit) ? explicit : `contract:${explicit}`;
    const landlord = normalizeLookup(lease.landlord);
    const tenant = normalizeLookup(lease.tenant);
    const start = clean(lease.startDate || lease.start_date, "");
    const end = clean(lease.endDate || lease.end_date, "");
    const duration = clean(lease.durationDays || lease.duration_days, "");
    const total = clean(lease.amount || lease.total, "");
    if (propertyId && (start || end || tenant || landlord)) {
      return `derived:${propertyId}:${direction}:${landlord}:${tenant}:${start}:${end}:${duration}:${total}`;
    }
    const legacyId = clean(lease.id, "");
    if (legacyId) return `legacy:${legacyId}`;
    return `manual:${normalizeLookup(lease.property)}:${direction}:${landlord}:${tenant}:${start}:${end}:${duration}:${total}`;
  }

  function isActiveLeaseSnapshot(lease = {}) {
    const status = normalizeLeaseStatus(lease.status, lease.roleHint || lease.source, lease.tenant);
    if (["ended", "expired", "sold", "for_rent"].includes(status)) return false;
    if (["rented", "leased", "rent_to", "rent_from"].includes(status)) return true;
    return Boolean(clean(lease.tenant, ""));
  }

  function propertyIdFromLeaseId(id) {
    const match = String(id || "").match(/(?:tenant|user-[^-]+)-(\d+)$/);
    return match ? match[1] : "";
  }

  function mergeLeaseRecords(previous = {}, incoming = {}) {
    const merged = { ...previous };
    const keys = new Set([...Object.keys(previous), ...Object.keys(incoming)]);
    for (const key of keys) {
      if (key === "notes") {
        merged.notes = mergeNotes(previous.notes, incoming.notes);
      } else if (key === "status") {
        merged.status = preferredStatus(previous.status, incoming.status);
      } else if (key === "id") {
        merged.id = canonicalLeaseId(previous, incoming);
      } else if (key === "updatedAt") {
        merged.updatedAt = incoming.updatedAt || previous.updatedAt || nowIso();
      } else {
        merged[key] = isBlankValue(incoming[key]) ? previous[key] : incoming[key];
      }
    }
    merged.contractId = contractIdentity(merged);
    if (!merged.id) merged.id = merged.contractId;
    return merged;
  }

  function canonicalLeaseId(previous = {}, incoming = {}) {
    return incoming.contractId || previous.contractId || incoming.id || previous.id || contractIdentity({ ...previous, ...incoming });
  }

  function migrateContractLifecycle(targetState) {
    const archived = Array.isArray(targetState.archivedRentals) ? [...targetState.archivedRentals] : [];
    const active = [];
    for (const lease of targetState.leases || []) {
      const normalized = { ...lease, contractId: contractIdentity(lease) };
      if (isExplicitlyArchivedContract(normalized)) archived.push(archiveRowFromLease(normalized));
      else active.push(normalized);
    }
    targetState.leases = compactLeaseListWithoutMigration(active);
    targetState.archivedRentals = dedupeArchiveRows(archived);
    targetState.schemaVersion = 2;
  }

  function compactLeaseListWithoutMigration(leases) {
    const byId = new Map();
    for (const lease of leases || []) {
      const key = contractIdentity(lease);
      byId.set(key, mergeLeaseRecords(byId.get(key), lease));
    }
    return Array.from(byId.values()).map((lease) => {
      const recalculated = recalculateLease(lease);
      const contractId = contractIdentity(recalculated);
      return { ...recalculated, contractId, id: contractId };
    }).sort(compareLeases);
  }

  function isExplicitlyArchivedContract(lease) {
    const status = normalizeLeaseStatus(lease && lease.status, lease && (lease.roleHint || lease.source), lease && lease.tenant);
    return ["ended", "expired", "sold"].includes(status);
  }

  function archiveRowFromLease(lease) {
    return {
      ...lease,
      contractId: contractIdentity(lease),
      property_id: lease.propertyId || "",
      property_type: lease.property || "Property",
      owner: lease.landlord || "",
      renter: lease.tenant || "",
      start_date: lease.startDate || "",
      end_date: lease.endDate || "",
      days: lease.durationDays || "",
      total: lease.amount || "",
      per_day: lease.dailyAmount || "",
      status: lease.status || "ended",
      source: lease.source || "saved",
    };
  }

  function dedupeArchiveRows(rows) {
    const byId = new Map();
    for (const row of rows || []) {
      if (!row || typeof row !== "object") continue;
      const key = clean(row.contractId || row.contract_id, "") || [
        row.property_id || row.propertyId || row.id,
        row.role || row.roleHint || row.source,
        row.owner || row.landlord,
        row.renter || row.tenant,
        row.start_date || row.startDate,
        row.end_date || row.endDate,
      ].map((value) => normalizeLookup(value)).join(":");
      byId.set(key, { ...(byId.get(key) || {}), ...row, contractId: key });
    }
    return Array.from(byId.values());
  }

  function preferredStatus(previous, incoming) {
    if (isBlankValue(incoming) || incoming === "manual") return previous || incoming || "";
    return normalizeLeaseStatus(incoming);
  }

  function mergeNotes(previous, incoming) {
    const values = [previous, incoming]
      .flatMap((value) => clean(value, "").split(";"))
      .map((value) => value.trim())
      .filter(Boolean);
    return Array.from(new Set(values)).join("; ");
  }

  function isBlankValue(value) {
    return value === null || value === undefined || value === "";
  }

  function compareLeases(a, b) {
    const remainingA = Number.isFinite(Number(a.remainingDays)) ? Number(a.remainingDays) : 999999;
    const remainingB = Number.isFinite(Number(b.remainingDays)) ? Number(b.remainingDays) : 999999;
    return remainingA - remainingB || clean(a.property).localeCompare(clean(b.property));
  }

  async function apiGet(path, params = {}) {
    const key = apiKeyValue();
    if (!key) {
      return Promise.reject(new Error("Add your Torn public key first."));
    }

    const url = new URL(`${API_BASE}${path}`);
    url.searchParams.set("comment", COMMENT);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    }

    await waitForTornRateSlot();
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url.toString(),
        headers: {
          Authorization: `ApiKey ${key}`,
          Accept: "application/json",
        },
        onload(response) {
          try {
            const body = JSON.parse(response.responseText || "{}");
            if (body.error) {
              reject(new Error(body.error.error || body.error.message || "Torn returned an error."));
              return;
            }
            if (response.status >= 400) {
              reject(new Error(`Torn returned error ${response.status}.`));
              return;
            }
            resolve(body);
          } catch (_error) {
            reject(new Error("Could not read Torn's answer."));
          }
        },
        onerror() {
          reject(new Error("Could not reach Torn."));
        },
      });
    });
  }

  function hostedSessionValue() {
    const stored = state.serverSession || safeGet(HOSTED_SESSION_KEY) || LEGACY_HOSTED_SESSION_KEYS.map((key) => safeGet(key)).find(Boolean);
    return clean(stored, "").trim();
  }

  function setHostedSession(token) {
    const value = clean(token, "").trim();
    state.serverSession = value;
    if (value) {
      safeSet(HOSTED_SESSION_KEY, value);
      LEGACY_HOSTED_SESSION_KEYS.forEach((key) => safeDelete(key));
    }
    else safeDelete(HOSTED_SESSION_KEY);
  }

  function clearHostedSession() {
    state.serverSession = "";
    safeDelete(HOSTED_SESSION_KEY);
    LEGACY_HOSTED_SESSION_KEYS.forEach((key) => safeDelete(key));
  }

  function hostedRequest(path, options = {}) {
    const method = options.method || "GET";
    const session = options.session || "";
    const payload = options.body === undefined ? null : options.body;
    const url = `${HOSTED_API_BASE.replace(/\/+$/, "")}${path}`;
    const headers = { Accept: "application/json" };
    if (payload !== null) headers["Content-Type"] = "application/json";
    if (session) {
      headers["X-Tornfolio-Session"] = session;
      headers["X-Landlord-Ledger-Session"] = session;
      headers["X-Pit-Guru-Session"] = session;
    }

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data: payload === null ? undefined : JSON.stringify(payload),
        timeout: options.timeout || 20000,
        onload(response) {
          let body = {};
          try {
            body = response.responseText ? JSON.parse(response.responseText) : {};
          } catch (_error) {
            body = { raw: response.responseText || "" };
          }
          if (response.status < 200 || response.status >= 300) {
            const error = new Error(body.error || body.message || `The ledger helper returned error ${response.status}.`);
            error.status = response.status;
            error.payload = body;
            reject(error);
            return;
          }
          resolve(body);
        },
        onerror() {
          const error = new Error("Could not reach the ledger helper.");
          error.network = true;
          reject(error);
        },
        ontimeout() {
          const error = new Error("The ledger helper timed out.");
          error.network = true;
          reject(error);
        },
      });
    });
  }

  async function verifyHostedAccess() {
    const key = apiKeyValue();
    if (!key) throw new Error("Add your Torn public key first.");
    const userId = await currentApiKeyUserId();
    let body;
    try {
      body = await hostedRequest("/api/account/verify", {
        method: "POST",
        body: { apiKey: key, userId, product: HOSTED_PRODUCT },
        timeout: 15000,
      });
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        applyHostedAccessBody(error.payload || {}, userId);
        if (state.serverEntitlement && !hasEntitlementSignal(state.serverEntitlement)) {
          state.serverEntitlement.status = error.status === 403 ? "denied" : "invalid";
          state.serverEntitlement.product = state.serverEntitlement.product || HOSTED_PRODUCT;
        }
        saveState("Subscription checked");
        render();
      }
      throw error;
    }
    const token = body.sessionToken || body.session || body.token;
    applyHostedAccessBody(body, userId);
    if (token) setHostedSession(token);
    else clearHostedSession();
    if (token && state.serverEntitlement && !hasEntitlementSignal(state.serverEntitlement)) {
      state.serverEntitlement.status = "active";
      state.serverEntitlement.product = state.serverEntitlement.product || HOSTED_PRODUCT;
    }
    saveState("Access saved");
    if (!token) {
      const info = subscriptionStatusInfo();
      if (!info.isSubscribed) throw new Error(info.message || "No active Tornfolio subscription was found.");
      throw new Error("Hosted account check did not return a session.");
    }
    return token;
  }

  async function currentApiKeyUserId() {
    const known = (state.endpointInputs && state.endpointInputs.userId) || keyInfoUserId(state.keyInfo);
    if (known) return String(known);
    const body = await checkApiKey();
    return String(keyInfoUserId(body));
  }

  function applyHostedAccessBody(body, userId = "") {
    if (!body || typeof body !== "object") body = {};
    applyHostedPropertyTypes(body);
    const profile = body.profile || body.userProfile || body.user || null;
    const mergedProfile = profile ? mergeProfileInfo(profileInfo(), profile) : null;
    const keyInfo = body.keyInfo || body.key || body.account || null;
    let entitlement = body.entitlement || body.subscription || body.license || body.access || {
      status: body.status,
      active: body.active,
      valid: body.valid,
      product: body.product,
      plan: body.plan,
      tier: body.tier,
      expires_at: body.expires_at || body.expiresAt,
    };
    if (!entitlement || typeof entitlement !== "object") {
      entitlement = {
        status: entitlement || body.status,
        active: body.active,
        valid: body.valid,
        product: body.product,
        plan: body.plan,
        tier: body.tier,
        expires_at: body.expires_at || body.expiresAt,
      };
    }
    if (keyInfo) state.keyInfo = mergeProfileInfo(state.keyInfo, keyInfo);
    const resolvedUserId = userId || keyInfoUserId(keyInfo) || (profile && profile.id) || "";
    if (resolvedUserId) {
      state.endpointInputs = {
        ...emptyState.endpointInputs,
        ...(state.endpointInputs || {}),
        userId: String(resolvedUserId),
        lookupUser: (state.endpointInputs && state.endpointInputs.lookupUser) || String(resolvedUserId),
      };
    }
    state.serverEntitlement = { ...(entitlement || {}), userId: resolvedUserId || (entitlement && entitlement.userId) || "" };
    state.lastSubscriptionCheckAt = nowIso();
  }

  async function syncHostedLedger(scope = "all") {
    const key = apiKeyValue();
    if (!key) throw new Error("Add your Torn public key first.");

    const payload = {
      apiKey: key,
      product: HOSTED_PRODUCT,
      scope,
      includePartner: true,
      settings: {
        targetAnnualRoi: targetAnnualRoi(),
        defaultSuggestionLeaseDays: defaultSuggestionLeaseDays(),
        tornRateLimitPerMinute: tornRateLimitPerMinute(),
        propertyHistoryPages: propertyHistoryPages(),
        propertyCosts: { ...(state.propertyCosts || {}) },
      },
    };
    const userId = (state.endpointInputs && state.endpointInputs.userId) || keyInfoUserId(state.keyInfo);
    if (userId) payload.userId = String(userId);

    const submit = async (session) => {
      const accepted = await hostedRequest("/api/tornfolio/sync", {
        method: "POST",
        session,
        body: { ...payload, background: true },
        timeout: 20000,
      });
      return accepted && accepted.async && accepted.jobId
        ? waitForHostedSyncJob(session, accepted)
        : accepted;
    };

    let session = hostedSessionValue();
    if (!session) {
      updateSyncProgress("access", "active", "Checking the subscription and creating a secure Tornfolio session.", 8, "Checking secure account access…", true);
      session = await verifyHostedAccess();
    }
    updateSyncProgress("access", "done", "A secure Tornfolio session is ready for this account.", 14, "Access is ready. The hosted service is now fetching Torn data…", false);
    updateSyncProgress("profile", "active", "Secure request sent. Waiting for the server's first progress update.", 16, "Starting the hosted portfolio checks…", true);
    let body;
    try {
      body = await submit(session);
    } catch (error) {
      const authFailure = error.status === 401 || error.status === 403;
      if (!authFailure) throw error;
      clearHostedSession();
      updateSyncProgress("access", "active", "The saved session expired; checking account access again.", 10, "Renewing secure account access…", true);
      session = await verifyHostedAccess();
      body = await submit(session);
    }

    applyHostedLedgerSync(body, scope);
    return body;
  }

  async function runHostedFirst(scope, fallback) {
    try {
      setStatus("Filling the ledger...");
      return await syncHostedLedger(scope);
    } catch (error) {
      if (!canUseDirectTornFallback(error)) throw error;
      updateSyncProgress("access", "warning", "Hosted sync was unavailable, so Tornfolio switched to the direct Torn fallback.", 16, "Hosted sync unavailable. Fetching the safe direct-Torn subset…", false);
      updateSyncProgress("profile", "active", "Checking the profile directly with Torn.", 24, "Fetching the safe direct-Torn subset…", true);
      setStatus(`The main fetch is not ready (${error.message || "unknown error"}). Fetching directly from Torn for now...`);
      return fallback ? fallback(error) : null;
    }
  }

  function canUseDirectTornFallback(error) {
    if (!appSettings().allowDirectTornFallback) return false;
    if (!error) return false;
    if (error.status === 404) return true;
    if (error.network) return true;
    return /landlord-ledger|tornfolio|not found|timed out|hosted ledger server/i.test(error.message || "");
  }

  function applyHostedLedgerSync(body, scope = "all") {
    if (!body || typeof body !== "object") throw new Error("The ledger helper returned an empty response.");

    applyHostedPropertyTypes(body);
    const profile = body.profile || body.userProfile || body.user || null;
    const mergedProfile = profile ? mergeProfileInfo(profileInfo(), profile) : null;
    const keyInfo = body.keyInfo || body.key || body.account || null;
    const entitlement = body.entitlement || body.subscription || body.license || null;
    const ownedProperties = firstArray(body, ["ownedProperties", "owned_properties", "userProperties", "propertiesOwned"]);
    const currentProperty = body.currentProperty || body.current_property || body.home || null;
    const partnerProperties = firstArray(body, ["partnerProperties", "spouseProperties", "partner_properties", "spouse_properties"]);
    const allProperties = uniqueProperties([
      ...ownedProperties,
      ...partnerProperties,
      ...firstArray(body, ["properties", "allProperties", "all_properties"]),
    ]);
    const serverLeases = firstArray(body, ["leases", "ledger", "contracts"]);
    const spouse = mergedProfile && mergedProfile.spouse ? mergedProfile.spouse : profile && profile.spouse ? profile.spouse : null;
    const leases = serverLeases.length
      ? serverLeases.map(normalizeHostedLease).filter(Boolean)
      : uniqueProperties([...allProperties, ...(currentProperty ? [currentProperty] : [])])
        .map((property) => leaseFromFetchedProperty(property, spouse))
        .filter(Boolean);
    const marketKinds = Array.isArray((body.metadata || body._metadata || {}).marketKinds)
      ? (body.metadata || body._metadata || {}).marketKinds
      : ["rentals", "properties"];
    const suggestions = mergePartialMarketRows(
      serverRentSuggestionRows(),
      firstArray(body, ["suggestions", "rentSuggestions", "rent_suggestions"]),
      marketKinds,
      "suggestion",
    );
    const roiSummary = cleanRoiSummaryRows(mergePartialMarketRows(
      serverRoiSummaryRows(),
      firstArray(body, ["roiSummary", "roi_summary", "marketSummary", "market_summary"]),
      marketKinds,
      "summary",
    ));
    const tenancyArchive = firstArray(body, ["tenancyArchive", "tenancy_archive", "leaseArchive", "lease_archive"]);
    const propertyHistory = firstArray(body, ["propertyHistory", "property_history"]);
    const propertyHistoryEvents = firstArray(body, ["propertyHistoryEvents", "property_history_events", "propertyLogs", "property_logs"]);
    const message = body.message || `Filled ${leases.length.toLocaleString()} ledger rows${suggestions.length ? ` and ${suggestions.length.toLocaleString()} suggestions` : ""}.`;

    if (keyInfo) state.keyInfo = mergeProfileInfo(state.keyInfo, keyInfo);
    if (entitlement) {
      state.serverEntitlement = entitlement;
      state.lastSubscriptionCheckAt = nowIso();
    }
    if (mergedProfile) storeEndpointDataWithoutRender("user-profile", { profile: mergedProfile }, "Fetched profile.");
    storeEndpointDataWithoutRender("user-properties", {
      properties: ownedProperties,
      _raw_total: ownedProperties.length,
      metadata: body.metadata || body._metadata || {},
      source: "server-sync",
    }, `Found ${ownedProperties.length.toLocaleString()} owned homes.`);
    storeEndpointDataWithoutRender("user-property", {
      property: currentProperty,
      metadata: body.metadata || body._metadata || {},
      source: "server-sync",
    }, currentProperty ? "Found current home." : "No current home returned.");
    const spouseBody = spouseOwnedPropertiesBody(
      { properties: partnerProperties, _raw_total: partnerProperties.length, source: "server-sync" },
      mergedProfile && mergedProfile.spouse ? mergedProfile.spouse : profile && profile.spouse ? profile.spouse : null,
    );
    storeEndpointDataWithoutRender("spouse-properties", spouseBody, spousePropertiesMessage(spouseBody));
    storeEndpointDataWithoutRender("lease-archive", {
      archive: tenancyArchive,
      metadata: body.metadata || body._metadata || {},
    }, tenancyArchive.length ? `Found ${tenancyArchive.length.toLocaleString()} past rent rows.` : historyEmptyMessage(body.metadata || body._metadata || {}));
    storeEndpointDataWithoutRender("property-history", {
      history: propertyHistory,
      events: propertyHistoryEvents,
      metadata: body.metadata || body._metadata || {},
    }, propertyHistory.length ? `Found history for ${propertyHistory.length.toLocaleString()} homes.` : historyEmptyMessage(body.metadata || body._metadata || {}));

    state.endpointResults = { ...(state.endpointResults || {}), "server-sync": message };
    state.endpointData = {
      ...(state.endpointData || {}),
      "server-sync": {
        body,
        fetchedAt: nowIso(),
        message,
      },
      "server-insights": {
        body: {
          suggestions,
          roiSummary,
          metadata: body.metadata || body._metadata || {},
        },
        fetchedAt: nowIso(),
        message: suggestions.length ? `Found ${suggestions.length.toLocaleString()} rent suggestions.` : "No rent suggestions yet.",
      },
    };
    state.leases = (state.leases || []).filter((lease) => !isHouseholdOccupancyLease(lease, currentProperty, spouse));
    if (leases.length) state.leases = compactLeaseList([...(state.leases || []), ...leases]);
    state.archivedRentals = dedupeArchiveRows([...(state.archivedRentals || []), ...tenancyArchive]);
    migrateContractLifecycle(state);
    state.lastSyncAt = nowIso();
    completeSyncProgressFromBody(body);
    saveState("Ledger saved");
    render();
    setStatus(message);
  }

  async function scanOwnedPropertyMarket(kind = "rentals") {
    if (state.syncState === "syncing") return null;
    const saleOnly = kind === "properties" || kind === "sale";
    const scope = saleOnly ? "scan-sale-market" : "scan-rental-market";
    const label = saleOnly ? "sale" : "rental";
    state.syncState = "syncing";
    state.syncMessage = `Scanning the ${label} market…`;
    beginSyncProgress(scope);
    saveState("Market scan started");
    render();
    setStatus(`Checking ${label} comparisons for available properties...`);
    try {
      const body = await syncHostedLedger(scope);
      const suggestions = firstArray(body, ["suggestions", "rentSuggestions", "rent_suggestions"]);
      const roiSummary = firstArray(body, ["roiSummary", "roi_summary", "marketSummary", "market_summary"]);
      const message = body.message || `${saleOnly ? "Sale" : "Rental"} comparison finished: ${suggestions.length.toLocaleString()} available properties and ${roiSummary.length.toLocaleString()} market summaries.`;
      state.syncState = "success";
      state.syncMessage = message;
      saveState("Market scan complete");
      render();
      setStatus(message);
      return body;
    } catch (error) {
      if (canUseDirectTornFallback(error)) {
        updateSyncProgress("access", "warning", "Hosted market access was unavailable, so only current Torn property details could be refreshed.", 18, "Hosted market scan unavailable. Refreshing current property details…", true);
        await importOwnedPropertiesDirect();
        completeDirectSyncProgress([]);
        state.syncState = "partial";
        state.syncMessage = "The hosted market scan was unavailable; Torn contract details were refreshed instead.";
        saveState("Market scan partial");
        render();
        setStatus(`${saleOnly ? "Sale" : "Rental"} comparisons are not live yet. Torn contract details were refreshed.`, true);
        return null;
      }
      state.syncState = "error";
      state.syncMessage = error.message || "Market scan failed.";
      failSyncProgress(error, "The market refresh stopped before every check finished.");
      saveState("Market scan failed");
      render();
      throw error;
    }
  }

  function normalizeHostedLease(row) {
    if (!row || typeof row !== "object") return normalizeLease({}, "server");
    if (row.owner || row.rented_by || row.rental_period || row.cost_per_day || row.used_by) return leaseFromFetchedProperty(row);
    const propertyId = clean(row.propertyId || row.property_id || row.id, "");
    return recalculateLease({
      id: clean(row.id || propertyId || makeId("server"), makeId("server")),
      propertyId,
      property: clean(row.property || row.home || row.propertyName || row.property_name, propertyId ? `Property ${propertyId}` : "Property"),
      landlord: clean(row.landlord || row.ownerName || row.owner_name || userName(row.owner), ""),
      tenant: clean(row.tenant || row.renter || row.renterName || row.renter_name || userName(row.rented_by), ""),
      amount: moneyNumber(row.amount || row.total || row.cost),
      dailyAmount: moneyNumber(row.dailyAmount || row.daily_amount || row.cost_per_day),
      durationDays: positiveNumber(row.durationDays || row.duration_days || row.rental_period),
      remainingDays: positiveNumber(row.remainingDays || row.remaining_days || row.rental_period_remaining),
      startDate: clean(row.startDate || row.start_date, ""),
      endDate: clean(row.endDate || row.end_date, ""),
      status: clean(row.status, "manual"),
      roleHint: clean(row.roleHint || row.role || row.source, "landlord"),
      notes: clean(row.notes || row.note, ""),
      updatedAt: nowIso(),
      source: "server",
    }, "server");
  }

  function firstArray(body, keys) {
    for (const key of keys) {
      if (Array.isArray(body && body[key])) return body[key];
      if (body && body[key] && typeof body[key] === "object") return Object.values(body[key]);
    }
    return [];
  }

  function mergePartialMarketRows(previousRows, incomingRows, marketKinds, rowType) {
    const kinds = new Set(Array.isArray(marketKinds) ? marketKinds : ["rentals", "properties"]);
    if (kinds.has("rentals") && kinds.has("properties")) return incomingRows;
    const rentalKeys = rowType === "summary"
      ? ["rental_listings", "listings", "rent_match", "avg_daily", "median_daily", "min_daily", "max_daily", "avg_landlord_roi_market", "best_landlord_roi_market", "avg_landlord_roi_investment", "avg_rent_per_happy", "avg_tenant_cost_per_happy"]
      : ["current_cost_per_day", "market_median_daily", "market_avg_daily", "market_min_daily", "market_max_daily", "rent_listings", "market_basis", "comparable_confidence", "comparable_listings", "rental_comparison", "target_rent_per_day", "suggested_rent_per_day", "rent_per_day_suggested", "suggested_duration_days", "suggested_total", "duration_basis", "suggested_roi", "recommended_action", "suggested_action", "suggestion_note"];
    const saleKeys = rowType === "summary"
      ? ["sale_listings", "sale_match", "avg_market_price", "median_market_price", "min_market_price", "max_market_price"]
      : ["sale_listings", "sale_price_suggested", "suggested_sale_price", "market_median_sale", "market_avg_sale", "market_min_sale", "market_max_sale", "sale_market_basis", "sale_comparable_confidence", "sale_comparable_listings", "sale_comparison", "sale_suggested_action"];
    const keyFor = (row) => clean(row && (row.id || row.property_id || row.propertyId || row.market_key || row._market_key || `${row.property_type_id || ""}:${row.happy || ""}`), "");
    const previous = new Map((previousRows || []).map((row) => [keyFor(row), row]));
    return (incomingRows || []).map((row) => {
      const old = previous.get(keyFor(row)) || {};
      const merged = { ...old, ...row };
      if (!kinds.has("rentals")) rentalKeys.forEach((key) => { if (Object.prototype.hasOwnProperty.call(old, key)) merged[key] = old[key]; });
      if (!kinds.has("properties")) saleKeys.forEach((key) => { if (Object.prototype.hasOwnProperty.call(old, key)) merged[key] = old[key]; });
      return merged;
    });
  }

  function applyHostedPropertyTypes(body) {
    const rows = firstArray(body, ["propertyTypes", "property_types", "propertyCatalogue", "property_catalogue"]);
    if (!rows.length) return false;
    const next = rows.map(normalizeHostedPropertyType).filter(Boolean);
    if (!next.length) return false;
    state.propertyTypes = next;
    return true;
  }

  function normalizeHostedPropertyType(row) {
    if (!row || typeof row !== "object") return null;
    const id = positiveNumber(row.id || row.property_type_id || row.propertyTypeId || row.type_id);
    if (!id) return null;
    return {
      id: Number(id),
      property_type_id: Number(id),
      name: clean(row.name || row.property || row.property_type || row.propertyType, `Property ${id}`),
      cost: moneyNumber(row.cost),
      happy: positiveNumber(row.happy),
      upkeep: moneyNumber(row.upkeep),
      modifications: listValue(row.modifications),
      staff: listValue(row.staff),
      imageUrl: clean(row.imageUrl || row.image_url || row.image || "", ""),
      aliases: listValue(row.aliases),
    };
  }

  function listValue(value) {
    if (Array.isArray(value)) return value.map(listLabel).filter(Boolean);
    if (value === null || value === undefined || value === "") return [];
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(listLabel).filter(Boolean);
      } catch (_error) {
        // Some older/manual values are plain comma-separated text.
      }
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return [];
  }

  function listLabel(value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "object") {
      if (value.type && value.amount !== undefined) return `${value.type} x${value.amount}`;
      return clean(value.name || value.type || value.id || "", "");
    }
    return clean(value, "");
  }

  function uniqueProperties(properties) {
    const seen = new Set();
    const rows = [];
    for (const property of properties) {
      if (!property || typeof property !== "object") continue;
      const key = property.id || property.property_id || `${userName(property.owner)}:${propertyName(property.property) || propertyName(property)}:${property.happy || ""}:${userName(property.rented_by)}`;
      if (seen.has(String(key))) continue;
      seen.add(String(key));
      rows.push(property);
    }
    return rows;
  }

  function apiKeyValue() {
    return normalizeApiKey(state.apiKey);
  }

  function normalizeApiKey(input) {
    let value = String(input || "").trim();
    if (/^https?:\/\//i.test(value)) {
      try {
        value = new URL(value).searchParams.get("key") || value;
      } catch (_error) {
        // Keep the pasted value and normalize the common prefix below.
      }
    }
    return value.replace(/^ApiKey\s+/i, "").trim();
  }

  function maskedApiKey() {
    const key = apiKeyValue();
    if (!key) return "";
    const tail = key.slice(-4);
    const maskedLength = Math.max(4, key.length - 4);
    return `${"*".repeat(Math.min(maskedLength, 16))}${tail}`;
  }

  function appSettings() {
    state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
    return state.settings;
  }

  function showAdvancedTools(settings = null) {
    return Boolean((settings || appSettings()).showAdvancedTools);
  }

  function tableLimit() {
    const limit = Number(appSettings().tableLimit);
    if (!Number.isFinite(limit)) return DEFAULT_SETTINGS.tableLimit;
    return clamp(limit, 10, 250);
  }

  function tableLimitFromInput(value) {
    const limit = Number(value);
    return Number.isFinite(limit) ? clamp(Math.round(limit), 10, 250) : DEFAULT_SETTINGS.tableLimit;
  }

  function tornRateLimitPerMinute() {
    return tornRateLimitFromInput(appSettings().tornRateLimitPerMinute);
  }

  function tornRateLimitFromInput(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return DEFAULT_SETTINGS.tornRateLimitPerMinute;
    return clamp(Math.round(number / 25) * 25, 25, 75);
  }

  function tornRateLimitOptionsHtml() {
    const selected = String(tornRateLimitPerMinute());
    return [75, 50, 25].map((value) => `
      <option value="${value}"${selected === String(value) ? " selected" : ""}>Up to ${value} Torn calls/min</option>
    `).join("");
  }

  function propertyHistoryPagesOptionsHtml() {
    const selected = String(propertyHistoryPages());
    const options = [
      [5, "Quick history"],
      [25, "Normal history"],
      [50, "Deep history"],
      [100, "Maximum history"],
    ];
    return options.map(([value, label]) => `<option value="${value}"${selected === String(value) ? " selected" : ""}>${label}</option>`).join("");
  }

  function waitForTornRateSlot() {
    const limit = tornRateLimitPerMinute();
    const delayMs = Math.ceil(60000 / limit);
    const wait = async () => {
      const elapsed = Date.now() - lastTornRequestAt;
      if (elapsed < delayMs) await sleep(delayMs - elapsed);
      lastTornRequestAt = Date.now();
    };
    tornRateQueue = tornRateQueue.then(wait, wait);
    return tornRateQueue;
  }

  async function checkApiKey() {
    setStatus("Checking Torn key...");
    const body = await apiGet("/key/info", { key: apiKeyValue() });
    const userId = keyInfoUserId(body);

    state.keyInfo = body;
    state.endpointData = {
      ...(state.endpointData || {}),
      "user-panel": {
        body,
        fetchedAt: nowIso(),
        message: userId ? `Checked key user ${userId}.` : "Fetched key info, but no user ID was found in the known response paths.",
      },
    };
    if (!userId) {
      saveState();
      render();
      throw new Error("The Torn key was checked, but the user ID could not be found.");
    }
    state.endpointInputs = {
      ...emptyState.endpointInputs,
      ...(state.endpointInputs || {}),
      userId: String(userId),
      lookupUser: (state.endpointInputs && state.endpointInputs.lookupUser) || String(userId),
    };
    saveState();
    render();
    setStatus(`Torn key checked. User ID ${userId} is ready.`);
    return body;
  }

  async function keyUserId() {
    const existing = state.endpointInputs && state.endpointInputs.userId;
    if (existing) return existing;
    const body = await checkApiKey();
    return String(keyInfoUserId(body));
  }

  async function lookupUserValue() {
    const existing = state.endpointInputs && state.endpointInputs.lookupUser && state.endpointInputs.lookupUser.trim();
    if (existing) return existing;
    const userId = await keyUserId();
    state.endpointInputs = { ...emptyState.endpointInputs, ...(state.endpointInputs || {}), lookupUser: String(userId) };
    saveState();
    return String(userId);
  }

  async function fetchTornProperties() {
    setStatus("Fetching home details...");
    let body;
    try {
      body = await hostedRequest("/api/property-types", { timeout: 15000 });
      applyHostedPropertyTypes(body);
      body = { ...body, properties: propertyTypes() };
    } catch (error) {
      if (!appSettings().allowDirectTornFallback) throw error;
      body = await apiGet("/torn/properties");
      applyHostedPropertyTypes({ propertyTypes: firstArray(body, ["properties"]) });
    }
    storeEndpointData("torn-properties", body, summarizeResult(body, "properties"));
    setStatus(state.endpointResults["torn-properties"]);
  }

  async function fetchUserProperties() {
    const { body } = await fetchUserPropertiesData();
    setStatus(state.endpointResults["user-id-properties"]);
    return body;
  }

  async function fetchUserPropertiesData() {
    const userLookup = await lookupUserValue();
    setStatus(`Fetching properties for user ${userLookup}...`);
    const body = await apiGet(`/user/${encodeURIComponent(userLookup)}/properties`);
    const filteredBody = ownedPropertiesBody(body, userLookup);
    const total = propertiesFromBody(body).length;
    const owned = propertiesFromBody(filteredBody).length;
    const message = `Fetched ${total.toLocaleString()} properties. Showing ${owned.toLocaleString()} owned by ${userLookup}.`;
    storeEndpointData("user-id-properties", filteredBody, message);
    return { userId: userLookup, body: filteredBody };
  }

  async function fetchSpouseProperties() {
    return runHostedFirst("partner", fetchSpousePropertiesDirect);
  }

  async function fetchSpousePropertiesDirect() {
    let spouse = profileSpouse();
    if (!spouse || !spouse.id) {
      await fetchUserProfile();
      spouse = profileSpouse();
    }
    if (!spouse || !spouse.id) throw new Error("Fetch user details first; no spouse ID is available.");
    setStatus(`Fetching properties for spouse ${spouse.name || spouse.id}...`);
    const all = [];
    const limit = 100;
    let offset = 0;

    for (let guard = 0; guard < 20; guard += 1) {
      const page = await apiGet(`/user/${encodeURIComponent(spouse.id)}/properties`, { offset, limit, key: apiKeyValue() });
      const properties = propertiesFromBody(page);
      all.push(...properties);
      if (properties.length < limit) break;
      offset += limit;
    }

    const body = spouseOwnedPropertiesBody({ properties: all }, spouse);
    const leases = all.map((property) => leaseFromFetchedProperty(property, spouse)).filter(Boolean);
    mergeLeases(leases);
    const owned = propertiesFromBody(body).length;
    const used = all.filter((property) => propertyUsedByLookup(property, spouse.id) || renterMatchesLookup(property, spouse.id)).length;
    const withContracts = all.filter(propertyHasContractDetails).length;
    const label = spouse.name ? `${spouse.name} [${spouse.id}]` : spouse.id;
    const message = `Fetched ${all.length.toLocaleString()} partner properties/contracts for ${label}: showing ${owned.toLocaleString()} spouse-owned homes, ${used.toLocaleString()} used or rented, ${withContracts.toLocaleString()} with contract details.`;
    state.endpointResults = { ...(state.endpointResults || {}), "spouse-properties": message };
    state.endpointData = {
      ...(state.endpointData || {}),
      "spouse-properties": {
        body,
        fetchedAt: nowIso(),
        message,
      },
    };
    saveState();
    render();
    setStatus(message);
    return body;
  }

  function leaseFromFetchedProperty(property, spouse = null) {
    const tenant = propertyRentalParty(property, spouse);
    if (!tenant) return null;
    const role = fetchedPropertyRole(property, spouse);
    const lease = normalizeLease({ ...property, rented_by: tenant }, role);
    if (role === "tenant" && lease.status === "rented") lease.status = "leased";
    return lease;
  }

  function fetchedPropertyRole(property, spouse = null) {
    const myId = keyInfoUserId(state.keyInfo) || ((state.endpointInputs || {}).userId);
    const spouseId = spouse && spouse.id;
    if (ownerMatchesLookup(property, myId)) return "landlord";
    if (ownerMatchesLookup(property, spouseId)) return "spouse";
    if (renterMatchesLookup(property, myId) || renterMatchesLookup(property, spouseId)) return "tenant";
    if (propertyUsedByLookup(property, myId) || propertyUsedByLookup(property, spouseId)) return "tenant";
    return "landlord";
  }

  async function fetchUserProperty() {
    const { body } = await fetchUserPropertyData({ merge: true });
    setStatus(state.endpointResults["user-id-property"]);
    return body;
  }

  async function fetchUserPropertyData({ merge = false } = {}) {
    const userLookup = await lookupUserValue();
    setStatus(`Fetching property for user ${userLookup}...`);
    const body = await apiGet(`/user/${encodeURIComponent(userLookup)}/property`);
    if (merge) {
      const lease = leaseFromFetchedProperty(body.property || body, profileSpouse());
      if (lease) mergeLeases([lease]);
    }
    storeEndpointData("user-id-property", body, `Fetched property for user ${userLookup}.`);
    return { userId: userLookup, body };
  }

  async function fetchUserProfile() {
    const userId = await keyUserId();
    setStatus(`Fetching profile for user ${userId}...`);
    const body = await apiGet("/user", { selections: "profile", id: userId, key: apiKeyValue() });
    storeEndpointData("user-profile", body, `Fetched profile for user ${userId}.`);
    setStatus(state.endpointResults["user-profile"]);
    return body;
  }

  async function refreshUserDetails() {
    state.syncState = "syncing";
    state.syncMessage = "Syncing your Tornfolio data…";
    beginSyncProgress("all");
    saveState("Sync started");
    render();
    try {
      const result = await runHostedFirst("all", refreshUserDetailsDirect);
      const metadata = result && (result.metadata || result._metadata) || {};
      const partialMessage = clean(metadata.historyError || metadata.history_error, "") || (result && result.partial && (result.errors || []).join(" · "));
      state.syncState = partialMessage ? "partial" : "success";
      state.syncMessage = partialMessage ? `Portfolio synced with a warning: ${partialMessage}` : "Portfolio synced.";
      state.lastSyncAt = state.lastSyncAt || nowIso();
      saveState("Sync complete");
      render();
      return result;
    } catch (error) {
      state.syncState = "error";
      state.syncMessage = error.message || "Sync failed.";
      failSyncProgress(error);
      saveState("Sync failed");
      render();
      throw error;
    }
  }

  async function refreshUserDetailsDirect() {
    setStatus("Refreshing user details...");
    const errors = [];
    try {
      await checkApiKey();
    } catch (error) {
      errors.push(error.message || "key info failed");
    }
    try {
      await fetchUserProfile();
    } catch (error) {
      errors.push(error.message || "profile fetch failed");
    }
    for (const task of [importOwnedPropertiesDirect, importCurrentPropertyDirect]) {
      try {
        await task();
      } catch (error) {
        errors.push(error.message || "detail fetch failed");
      }
    }
    if (profileSpouse()) {
      try {
        await fetchSpousePropertiesDirect();
      } catch (error) {
        errors.push(error.message || "partner fetch failed");
      }
    }
    completeDirectSyncProgress(errors);
    render();
    setStatus(errors.length ? `User details partially refreshed: ${errors.join(" | ")}` : "User details refreshed.");
    return {
      partial: true,
      errors: errors.length ? errors : ["Hosted history and market checks were unavailable."],
    };
  }

  function completeDirectSyncProgress(errors = []) {
    const progress = normalizeSyncProgress(state.syncProgress);
    if (!progress) return;
    const profile = profileInfo() || {};
    const owned = propertiesFromBody(endpointBody("user-properties"));
    const spouse = propertiesFromBody(spouseOwnedPropertiesBody(endpointBody("spouse-properties")));
    const current = currentPropertyFromBody(endpointBody("user-property"));
    const hasErrors = Boolean(errors.length);
    const details = {
      profile: { status: profile.id || profile.name ? "done" : "warning", detail: profile.id || profile.name ? `Fetched ${clean(profile.name || profile.id, "the account profile")} directly from Torn.` : "No profile details were returned." },
      portfolio: { status: "done", detail: `${owned.length.toLocaleString()} owned · ${current ? "current home found" : "no current home returned"} · ${spouse.length.toLocaleString()} spouse-owned.` },
      rentals: { status: "done", detail: `${(state.leases || []).length.toLocaleString()} saved property/contract ledger row${(state.leases || []).length === 1 ? "" : "s"} rebuilt.` },
      history: { status: "warning", detail: "The direct fallback does not rebuild the hosted property-log archive." },
      rentalMarket: { status: "warning", detail: "The direct fallback does not run server-side rental comparisons." },
      saleMarket: { status: "warning", detail: "The direct fallback does not run server-side sale comparisons." },
      save: { status: "done", detail: "The directly fetched subset was saved locally." },
    };
    progress.steps = progress.steps.map((step) => ({ ...step, ...(details[step.id] || {}) }));
    progress.percent = 100;
    progress.finishedAt = nowIso();
    progress.title = hasErrors ? "Partial sync finished" : "Direct fallback finished";
    progress.message = hasErrors
      ? `Some direct checks also failed: ${errors.join(" · ")}`
      : "Current Torn details were refreshed, but hosted history and market checks were unavailable.";
    state.syncProgress = progress;
    scheduleCompletedSyncDismiss();
  }

  async function fetchMarketProperties() {
    throw new Error("Market checks happen quietly. Use Fetch everything.");
  }

  async function fetchMarketRentals() {
    throw new Error("Rental checks happen quietly. Use Fetch everything.");
  }

  async function scanRentalRoi() {
    throw new Error("Suggestion checks happen quietly. Use Fetch everything.");
  }

  function decorateRentalRoiRow(row, type) {
    const period = rentalPeriod(row);
    const totalRent = rentalTotal(row, period);
    const dailyRent = rentalDaily(row, period, totalRent);
    const happy = positiveNumber(nestedValue(row, "happy") || nestedValue(row, "property.happy") || type.happy);
    const marketPrice = marketPriceValue(row, type);
    const baseCost = moneyNumber(type.cost);
    const upgradeCost = estimatedUpgradeCost(row, type);
    const investmentCost = baseCost || upgradeCost ? (baseCost || 0) + (upgradeCost || 0) : "";
    const tenantUpkeep = upkeepDaily(row, type);
    const annualRent = dailyRent ? dailyRent * 365 : "";
    const tenantDailyCost = dailyRent !== "" ? dailyRent + tenantUpkeep : "";

    return {
      ...row,
      _property_type_id: type.id,
      property_type: type.name,
      happy,
      cost: totalRent,
      cost_per_day: dailyRent,
      rental_period: period,
      market_price: marketPrice,
      base_cost: baseCost,
      estimated_upgrade_cost: upgradeCost,
      estimated_investment: investmentCost,
      tenant_upkeep_total: tenantUpkeep,
      annual_rent: annualRent,
      landlord_roi_market: roiPercent(annualRent, marketPrice),
      landlord_roi_base: roiPercent(annualRent, baseCost),
      landlord_roi_investment: roiPercent(annualRent, investmentCost),
      rent_per_happy: dailyRent && happy ? dailyRent / happy : "",
      tenant_daily_cost: tenantDailyCost,
      tenant_cost_per_happy: tenantDailyCost && happy ? tenantDailyCost / happy : "",
    };
  }

  function rentalRoiSummaryRow(type, rows, error = "") {
    const dailyValues = rows.map((row) => Number(row.cost_per_day)).filter(Number.isFinite);
    const marketValues = rows.map((row) => Number(row.market_price)).filter(Number.isFinite);
    const happyValues = rows.map((row) => Number(row.happy)).filter(Number.isFinite);
    const landlordMarketValues = rows.map((row) => Number(row.landlord_roi_market)).filter(Number.isFinite);
    const investmentValues = rows.map((row) => Number(row.landlord_roi_investment)).filter(Number.isFinite);
    const rentHappyValues = rows.map((row) => Number(row.rent_per_happy)).filter(Number.isFinite);
    const tenantCostHappyValues = rows.map((row) => Number(row.tenant_cost_per_happy)).filter(Number.isFinite);

    return {
      _property_type_id: type.id,
      property_type: type.name,
      listings: rows.length,
      avg_daily: averageNumber(dailyValues),
      median_daily: medianNumber(dailyValues),
      min_daily: minNumber(dailyValues),
      max_daily: maxNumber(dailyValues),
      avg_market_price: averageNumber(marketValues),
      avg_happy: averageNumber(happyValues),
      avg_landlord_roi_market: averageNumber(landlordMarketValues),
      best_landlord_roi_market: maxNumber(landlordMarketValues),
      avg_landlord_roi_investment: averageNumber(investmentValues),
      avg_rent_per_happy: averageNumber(rentHappyValues),
      avg_tenant_cost_per_happy: averageNumber(tenantCostHappyValues),
      error,
    };
  }

  async function apiGetPaged(path, collectionName, options = {}) {
    const { delayMs = 0, maxPages = 50, ...queryOptions } = options;
    const limit = queryOptions.limit || 100;
    let offset = queryOptions.offset || 0;
    const all = [];
    let lastBody = null;

    for (let guard = 0; guard < maxPages; guard += 1) {
      const body = await apiGet(path, { ...queryOptions, limit, offset });
      lastBody = body;
      const rows = normalizeRows(body && body[collectionName]);
      all.push(...rows);
      setStatus(`Fetched ${all.length.toLocaleString()} ${collectionName}...`);

      const total = metadataTotal(body);
      if (!rows.length || rows.length < limit || (Number.isFinite(total) && all.length >= total)) break;
      offset += limit;
      if (delayMs) await sleep(delayMs);
    }

    return {
      ...(lastBody || {}),
      [collectionName]: all,
      _metadata: {
        ...((lastBody && lastBody._metadata) || {}),
        fetched: all.length,
      },
    };
  }

  function metadataTotal(body) {
    const total = body && body._metadata && (body._metadata.total || body._metadata.count);
    const number = Number(total);
    return Number.isFinite(number) ? number : NaN;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }

  function rentalPeriod(row) {
    return positiveNumber(
      nestedValue(row, "rental_period") ||
      nestedValue(row, "period") ||
      nestedValue(row, "duration") ||
      nestedValue(row, "duration_days") ||
      nestedValue(row, "rent.period") ||
      nestedValue(row, "lease.period")
    );
  }

  function rentalTotal(row, period = "") {
    const direct = moneyNumber(
      nestedValue(row, "cost") ||
      nestedValue(row, "total_cost") ||
      nestedValue(row, "total_rent") ||
      nestedValue(row, "rent.cost") ||
      nestedValue(row, "lease.cost")
    );
    if (direct) return direct;
    const daily = moneyNumber(nestedValue(row, "cost_per_day") || nestedValue(row, "rent.cost_per_day") || nestedValue(row, "lease.cost_per_day"));
    return daily && period ? daily * period : "";
  }

  function rentalDaily(row, period = "", totalRent = "") {
    const direct = moneyNumber(
      nestedValue(row, "cost_per_day") ||
      nestedValue(row, "daily_cost") ||
      nestedValue(row, "daily_rent") ||
      nestedValue(row, "rent.cost_per_day") ||
      nestedValue(row, "lease.cost_per_day")
    );
    if (direct) return direct;
    return totalRent && period ? Math.round(totalRent / period) : "";
  }

  function marketPriceValue(row, type) {
    return moneyNumber(
      nestedValue(row, "market_price") ||
      nestedValue(row, "property.market_price") ||
      nestedValue(row, "price") ||
      nestedValue(row, "property.price") ||
      (type && type.cost)
    );
  }

  function upkeepDaily(row, type) {
    const propertyUpkeep = moneyNumber(nestedValue(row, "upkeep.property") || nestedValue(row, "property_upkeep") || (type && type.upkeep));
    const staffUpkeep = moneyNumber(nestedValue(row, "upkeep.staff") || nestedValue(row, "staff_upkeep"));
    return (propertyUpkeep || 0) + (staffUpkeep || 0);
  }

  function propertyTypeForRow(row) {
    const id = propertyTypeIdFromRow(row);
    return propertyTypes().find((type) => Number(type.id) === Number(id)) || null;
  }

  function estimatedUpgradeCost(row, type = null) {
    const propertyType = type || propertyTypeForRow(row) || {};
    const baseCost = moneyNumber(propertyType.cost);
    const names = modificationNames(row && row.modifications);
    let total = 0;

    for (const name of names) {
      const normalized = normalizeModificationName(name);
      if (INTERIOR_UPGRADE_MULTIPLIERS[normalized] !== undefined && baseCost) {
        total += Math.round(baseCost * INTERIOR_UPGRADE_MULTIPLIERS[normalized]);
      } else if (UPGRADE_COSTS[normalized] !== undefined) {
        total += UPGRADE_COSTS[normalized];
      }
    }

    return total || "";
  }

  function estimatedInvestmentCost(row, type = null) {
    const propertyType = type || propertyTypeForRow(row) || {};
    const baseCost = moneyNumber(propertyType.cost);
    const upgradeCost = estimatedUpgradeCost(row, propertyType);
    if (!baseCost && !upgradeCost) return moneyNumber(nestedValue(row, "market_price"));
    return (baseCost || 0) + (upgradeCost || 0);
  }

  function targetAnnualRoi() {
    const value = Number(appSettings().targetAnnualRoi);
    return Number.isFinite(value) && value > 0 ? clamp(value, 0.1, 500) : DEFAULT_SETTINGS.targetAnnualRoi;
  }

  function defaultSuggestionLeaseDays() {
    const value = Number(appSettings().defaultSuggestionLeaseDays);
    return Number.isFinite(value) && value > 0 ? Math.round(clamp(value, 1, 100)) : DEFAULT_SETTINGS.defaultSuggestionLeaseDays;
  }

  function propertyHistoryPages() {
    const value = Number(appSettings().propertyHistoryPages);
    return propertyHistoryPagesFromInput(Number.isFinite(value) && value > 0 ? value : DEFAULT_SETTINGS.propertyHistoryPages);
  }

  function propertyHistoryPagesFromInput(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(clamp(number, 1, 100)) : DEFAULT_SETTINGS.propertyHistoryPages;
  }

  function propertyCostKey(row) {
    return String((row && (row.id || row.property_id || row.propertyId)) || "");
  }

  function manualInvestmentForRow(row) {
    const key = propertyCostKey(row);
    if (!key || !state.propertyCosts) return "";
    return moneyNumber(state.propertyCosts[key]);
  }

  function roundRent(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "";
    const step = number < 10 ? 1 : (number < 100 ? SUGGESTION_ROUNDING : 10);
    return Math.max(1, Math.round(number / step) * step);
  }

  function roiPercent(annualValue, basisValue) {
    const annual = Number(annualValue);
    const basis = Number(basisValue);
    if (!Number.isFinite(annual) || !Number.isFinite(basis) || basis <= 0) return "";
    return roundNumber((annual / basis) * 100, 2);
  }

  function roundNumber(value, decimals = 2) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    const factor = 10 ** decimals;
    return Math.round(number * factor) / factor;
  }

  function averageNumber(values) {
    const numbers = values.map(Number).filter(Number.isFinite);
    if (!numbers.length) return "";
    return roundNumber(numbers.reduce((sum, value) => sum + value, 0) / numbers.length, 2);
  }

  function medianNumber(values) {
    const numbers = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!numbers.length) return "";
    const middle = Math.floor(numbers.length / 2);
    return roundNumber(numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2, 2);
  }

  function minNumber(values) {
    const numbers = values.map(Number).filter(Number.isFinite);
    return numbers.length ? roundNumber(Math.min(...numbers), 2) : "";
  }

  function maxNumber(values) {
    const numbers = values.map(Number).filter(Number.isFinite);
    return numbers.length ? roundNumber(Math.max(...numbers), 2) : "";
  }

  function percentage(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "N/A";
    return `${number.toFixed(Math.abs(number) >= 100 ? 1 : 2)}%`;
  }

  function marketPropertyTypeId() {
    const propertyTypeId = (state.endpointInputs && state.endpointInputs.propertyTypeId) || appSettings().defaultPropertyTypeId;
    if (!propertyTypeId) throw new Error("Pick a home type first.");
    return propertyTypeId;
  }

  function storeEndpointResult(id, message) {
    state.endpointResults = { ...(state.endpointResults || {}), [id]: message };
    saveState();
    render();
  }

  function storeEndpointDataWithoutRender(id, body, message) {
    state.endpointResults = { ...(state.endpointResults || {}), [id]: message };
    state.endpointData = {
      ...(state.endpointData || {}),
      [id]: {
        body,
        fetchedAt: nowIso(),
        message,
      },
    };
  }

  function storeEndpointData(id, body, message) {
    storeEndpointDataWithoutRender(id, body, message);
    saveState();
    render();
  }

  function summarizeResult(body, collectionName, id = "") {
    const count = responseRows(body, id || collectionName).length;
    if (count) return `Fetched ${count.toLocaleString()} ${collectionName}.`;
    return "Fetched response.";
  }

  async function importOwnedProperties() {
    return runHostedFirst("owned", importOwnedPropertiesDirect);
  }

  async function importOwnedPropertiesDirect() {
    setStatus("Importing owned properties...");
    const ownerId = await keyUserId();
    const all = [];
    let offset = 0;
    const limit = 100;

    for (let guard = 0; guard < 20; guard += 1) {
      const page = await apiGet("/user/properties", { filters: "ownedByUser", offset, limit, key: apiKeyValue() });
      const properties = Array.isArray(page.properties) ? page.properties : Object.values(page.properties || {});
      all.push(...properties);
      const total = page._metadata && page._metadata.total;
      if (properties.length < limit || (Number.isFinite(Number(total)) && all.length >= Number(total))) break;
      offset += limit;
    }

    const ownedByOwner = all.filter((property) => ownerMatchesLookup(property, ownerId));
    const owned = ownedByOwner.length ? ownedByOwner : all;
    const leases = owned.map((property) => leaseFromFetchedProperty(property, profileSpouse())).filter(Boolean);

    mergeLeases(leases);
    const rented = owned.filter((property) => property.status === "rented").length;
    const listed = owned.filter((property) => property.status === "for_rent").length;
    const idle = owned.filter((property) => !property.status || property.status === "none").length;
    const withContracts = owned.filter(propertyHasContractDetails).length;
    const message = `Fetched ${owned.length.toLocaleString()} owned properties. Imported ${leases.length.toLocaleString()} rows: ${rented.toLocaleString()} rented, ${listed.toLocaleString()} listed, ${idle.toLocaleString()} idle, ${withContracts.toLocaleString()} with contract details.`;
    state.endpointResults = { ...(state.endpointResults || {}), "user-properties": message };
    state.endpointData = {
      ...(state.endpointData || {}),
      "user-properties": {
        body: { properties: owned, _raw_total: all.length },
        fetchedAt: nowIso(),
        message,
      },
    };
    saveState();
    render();
    setStatus(message);
  }

  async function importCurrentProperty() {
    return runHostedFirst("current", importCurrentPropertyDirect);
  }

  async function importCurrentPropertyDirect() {
    setStatus("Importing current property...");
    try {
      await keyUserId();
    } catch (_error) {
      // The property call can still succeed, but status falls back to unknown without the key owner ID.
    }
    const body = await apiGet("/user/property");
    const lease = leaseFromFetchedProperty(body.property || body, profileSpouse());
    const leaseStatus = currentPropertyLeaseStatus(body.property || body);
    if (lease) mergeLeases([lease]);
    state.endpointResults = { ...(state.endpointResults || {}), "user-property": `Imported current property. Status: ${leaseStatus.label}.` };
    state.endpointData = {
      ...(state.endpointData || {}),
      "user-property": {
        body,
        fetchedAt: nowIso(),
        message: `Imported current property. Status: ${leaseStatus.label}.`,
      },
    };
    saveState();
    render();
    setStatus(`Imported current property. Status: ${leaseStatus.label}.`);
  }

  async function fetchPropertyLookup(propertyId) {
    const id = String(propertyId || "").trim();
    if (!id) throw new Error("Enter a property ID first.");
    try {
      return await apiGet("/property", { selections: "property", id });
    } catch (firstError) {
      try {
        return await apiGet(`/property/${encodeURIComponent(id)}`, { selections: "property" });
      } catch (_secondError) {
        throw firstError;
      }
    }
  }

  async function lookupManualPropertyOwner(form) {
    const field = form && form.elements && form.elements.propertyId;
    const propertyId = field && field.value && field.value.trim();
    if (!propertyId) return;
    setStatus(`Looking up property ${propertyId}...`);
    const body = await fetchPropertyLookup(propertyId);
    const property = currentPropertyFromBody(body);
    const owner = property && property.owner;
    const ownerLabel = owner ? (owner.name || userName(owner)) : "";
    if (ownerLabel && form.elements.landlord) form.elements.landlord.value = ownerLabel;

    const type = property && (property.property || property.type || property.name);
    const typeName = propertyName(type) || (typeof type === "string" ? type : "");
    if (typeName && form.elements.property) form.elements.property.value = typeName;

    if (ownerLabel) setStatus(`Property ${propertyId} owner found: ${ownerLabel}.`);
    else setStatus(`Property ${propertyId} was fetched, but no owner was returned.`, true);
  }

  function saveApiKeyFromInput(input) {
    const value = normalizeApiKey(input);
    if (!value) throw new Error("Paste a Torn public key first.");
    state.apiKey = value;
    state.keyInfo = null;
    clearHostedSession();
    state.serverEntitlement = null;
    state.lastSubscriptionCheckAt = null;
    state.endpointInputs = {
      ...emptyState.endpointInputs,
      ...(state.endpointInputs || {}),
      userId: "",
      lookupUser: "",
    };
    saveState();
    render();
    setStatus(`Saved Torn key ending ${value.slice(-4)}.`);
  }

  function clearApiKey() {
    state.apiKey = "";
    state.keyInfo = null;
    clearHostedSession();
    state.serverEntitlement = null;
    state.lastSubscriptionCheckAt = null;
    state.endpointInputs = { ...emptyState.endpointInputs, propertyTypeId: (state.endpointInputs || {}).propertyTypeId || "" };
    saveState();
    render();
    setStatus("Torn key cleared.");
  }

  function addManualLease(form) {
    const data = new FormData(form);
    const tenant = userLabelFromParts(data.get("tenantName"), data.get("tenantId"));
    const lease = recalculateLease({
      id: makeId("manual"),
      propertyId: clean(data.get("propertyId"), ""),
      property: clean(data.get("property"), "Property"),
      landlord: clean(data.get("landlord"), ""),
      tenant,
      amount: moneyNumber(data.get("amount")),
      dailyAmount: moneyNumber(data.get("dailyAmount")),
      durationDays: Number(data.get("durationDays")) || "",
      startDate: clean(data.get("startDate"), ""),
      endDate: clean(data.get("endDate"), ""),
      status: clean(data.get("status"), "manual"),
      roleHint: clean(data.get("roleHint"), "landlord"),
      notes: clean(data.get("notes"), ""),
      updatedAt: nowIso(),
      source: "manual",
    }, "manual");
    form.reset();
    mergeLeases([lease]);
    state.manualModalOpen = false;
    saveState();
    render();
    setStatus("Lease added.");
  }

  function updateLease(id, patch, changedProp = "") {
    let updatedLease = null;
    state.leases = state.leases.map((lease) => (
      lease.id === id ? (updatedLease = recalculateLease({ ...lease, ...patch, updatedAt: nowIso() }, changedProp)) : lease
    ));
    saveState();
    if (updatedLease) refreshLeaseRowValues(id, updatedLease);
  }

  function recalculateLease(lease, changedProp = "") {
    const next = {
      ...lease,
      amount: moneyNumber(lease.amount),
      dailyAmount: moneyNumber(lease.dailyAmount),
      durationDays: positiveNumber(lease.durationDays),
      remainingDays: positiveNumber(lease.remainingDays),
      status: normalizeLeaseStatus(lease.status, lease.roleHint || lease.source, lease.tenant),
    };

    if (changedProp === "dailyAmount" && next.dailyAmount && next.durationDays) {
      next.amount = moneyRatio(next.dailyAmount * next.durationDays);
    } else if (changedProp === "amount" && next.amount && next.durationDays) {
      next.dailyAmount = moneyRatio(next.amount / next.durationDays);
    } else if (changedProp === "durationDays") {
      if (next.amount && next.durationDays) next.dailyAmount = moneyRatio(next.amount / next.durationDays);
      else if (next.dailyAmount && next.durationDays) next.amount = moneyRatio(next.dailyAmount * next.durationDays);
    } else if (!next.dailyAmount && next.amount && next.durationDays) {
      next.dailyAmount = moneyRatio(next.amount / next.durationDays);
    } else if (!next.amount && next.dailyAmount && next.durationDays) {
      next.amount = moneyRatio(next.dailyAmount * next.durationDays);
    }

    if ((changedProp === "amount" || changedProp === "dailyAmount") && next.amount && next.dailyAmount && !next.durationDays) {
      next.durationDays = Math.round(next.amount / next.dailyAmount);
    }

    if ((changedProp === "startDate" || changedProp === "durationDays" || changedProp === "manual") && next.startDate && next.durationDays) {
      next.endDate = addDays(next.startDate, next.durationDays);
    } else if (changedProp === "endDate" && next.startDate && next.endDate) {
      next.durationDays = daysBetween(next.startDate, next.endDate);
      if (next.amount && next.durationDays) next.dailyAmount = moneyRatio(next.amount / next.durationDays);
      if (!next.amount && next.dailyAmount && next.durationDays) next.amount = moneyRatio(next.dailyAmount * next.durationDays);
    } else if (changedProp === "manual" && next.startDate && next.endDate && !next.durationDays) {
      next.durationDays = daysBetween(next.startDate, next.endDate);
      if (next.amount && next.durationDays) next.dailyAmount = moneyRatio(next.amount / next.durationDays);
      if (!next.amount && next.dailyAmount && next.durationDays) next.amount = moneyRatio(next.dailyAmount * next.durationDays);
    }

    if (changedProp === "remainingDays" && next.remainingDays !== "") {
      next.endDate = dateFromRemainingDays(next.remainingDays);
      if (next.endDate && next.durationDays) next.startDate = addDays(next.endDate, -next.durationDays);
    }

    if (next.endDate) next.remainingDays = remainingDaysFromEnd(next.endDate);
    return next;
  }

  function moneyNumber(value) {
    if (value === null || value === undefined || value === "") return "";
    const number = Number(String(value).replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(number) && number > 0 ? number : "";
  }

  function moneyRatio(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "";
    return Math.round(number * 100) / 100;
  }

  function positiveNumber(value) {
    if (value === null || value === undefined || value === "") return "";
    const number = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(number) && number >= 0 ? number : "";
  }

  function syncManualLeaseForm(form, changedProp) {
    if (!form) return;
    const lease = recalculateLease({
      amount: moneyNumber(form.elements.amount && form.elements.amount.value),
      dailyAmount: moneyNumber(form.elements.dailyAmount && form.elements.dailyAmount.value),
      durationDays: positiveNumber(form.elements.durationDays && form.elements.durationDays.value),
      startDate: form.elements.startDate ? form.elements.startDate.value : "",
      endDate: form.elements.endDate ? form.elements.endDate.value : "",
    }, changedProp || "manual");

    if (form.elements.amount) form.elements.amount.value = currencyInputValue(lease.amount);
    if (form.elements.dailyAmount) form.elements.dailyAmount.value = currencyInputValue(lease.dailyAmount);
    if (form.elements.durationDays && lease.durationDays !== "") form.elements.durationDays.value = lease.durationDays;
    if (form.elements.startDate && lease.startDate) form.elements.startDate.value = lease.startDate;
    if (form.elements.endDate && lease.endDate) form.elements.endDate.value = lease.endDate;
    const daysLeft = form.querySelector("[data-manual-days-left]");
    if (daysLeft) daysLeft.textContent = lease.remainingDays !== "" ? String(lease.remainingDays) : "Auto";
  }

  function refreshLeaseRowValues(id, lease) {
    const docs = [document];
    if (popupWindow && !popupWindow.closed) docs.push(popupWindow.document);
    for (const doc of docs) {
      const active = doc.activeElement;
      for (const row of Array.from(doc.querySelectorAll(`#${APP_ID} tr[data-id]`)).filter((item) => item.dataset.id === id)) {
        row.querySelectorAll("[data-prop]").forEach((field) => {
          const prop = field.dataset.prop;
          if (!prop || field === active) return;
          const value = lease[prop];
          if (prop === "amount" || prop === "dailyAmount") field.value = currencyInputValue(value);
          else field.value = value || "";
          autoSizeInput(field);
        });
        row.querySelectorAll("[data-lease-readonly]").forEach((node) => {
          const prop = node.dataset.leaseReadonly;
          const value = leaseReadonlyValue(lease, prop);
          node.textContent = value;
          node.title = value;
        });
      }
    }
  }

  function deleteLease(id) {
    state.leases = state.leases.filter((lease) => lease.id !== id);
    saveState();
    render();
    setStatus("Lease removed.");
  }

  function visibleLeases() {
    const query = clean(state.search, "").trim().toLowerCase();
    const statusFilter = clean(state.statusFilter || "all", "all").toLowerCase();
    return state.leases.filter((lease) => {
      const roleMatch = state.role === "all" || leaseRoleGroup(lease) === state.role;
      if (!roleMatch) return false;
      if (statusFilter !== "all" && normalizeLeaseStatus(lease.status, lease.roleHint || lease.source, lease.tenant) !== statusFilter) return false;
      if (!query) return true;
      return [lease.property, lease.propertyId, lease.landlord, lease.tenant, lease.status, lease.notes]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }

  function leaseRoleGroup(lease) {
    const role = clean(lease && lease.roleHint, "").toLowerCase();
    if (["spouse", "spouse-owned", "spouse_owned", "partner", "partner-owned", "partner_owned"].includes(role)) return "spouse";
    if (["tenant", "on-lease", "rented-from-others", "rent-from"].includes(role)) return "tenant";
    if (["market", "listed"].includes(role)) return "market";
    if (["contracts", "lease-offers", "lease_offers", "offers"].includes(role)) return "contracts";
    if (leaseOwnerIsSpouse(lease)) return "spouse";
    return "landlord";
  }

  function leaseOwnerIsSpouse(lease) {
    const spouse = profileSpouse();
    if (!spouse || !spouse.id || !lease || !lease.landlord) return false;
    const owner = splitUserLabel(lease.landlord);
    return owner.id && normalizeLookup(owner.id) === normalizeLookup(spouse.id);
  }

  function stats(leases) {
    const leased = leases.filter((lease) => lease.status === "rented" || lease.tenant).length;
    const income = leases.reduce((sum, lease) => sum + (Number(lease.amount) || 0), 0);
    const soon = leases.filter((lease) => Number(lease.remainingDays) >= 0 && Number(lease.remainingDays) <= 7).length;
    return { total: leases.length, leased, income, soon };
  }

  function exportJson() {
    download("tornfolio-backup.json", JSON.stringify({
      format: "tornfolio-backup",
      schemaVersion: 2,
      exportedAt: nowIso(),
      leases: state.leases,
      archivedRentals: state.archivedRentals || [],
      activity: state.activity || [],
      propertyCosts: state.propertyCosts || {},
      settings: appSettings(),
      endpointData: state.endpointData || {},
      keyInfo: state.keyInfo || null,
    }, null, 2), "application/json");
  }

  function exportCsv() {
    const headers = ["propertyId", "property", "landlord", "tenant", "durationDays", "amount", "dailyAmount", "startDate", "endDate", "remainingDays", "status", "notes"];
    const rows = state.leases.map((lease) => headers.map((header) => csvCell(lease[header])).join(","));
    download("torn-lease-ledger.csv", [headers.join(","), ...rows].join("\n"), "text/csv");
  }

  function exportRoiCsv() {
    const body = endpointBody("roi-scanner") || {};
    const summary = Array.isArray(body.summary) ? body.summary : [];
    const rentals = Array.isArray(body.rentals) ? body.rentals : [];
    if (!summary.length && !rentals.length) throw new Error("Run the ROI scan first.");

    const summaryHeaders = preferredTableKeys("roi-summary");
    const rentalHeaders = preferredTableKeys("roi-rentals").filter((key) => !key.startsWith("mod::") && !key.startsWith("staff::") && key !== "property_image");
    const parts = [
      "ROI summary",
      summaryHeaders.join(","),
      ...summary.map((row) => summaryHeaders.map((header) => csvCell(cellValue(row, header))).join(",")),
      "",
      "Rental listings",
      rentalHeaders.join(","),
      ...rentals.map((row) => rentalHeaders.map((header) => csvCell(cellValue(row, header))).join(",")),
    ];
    download("torn-rental-roi-scan.csv", parts.join("\n"), "text/csv");
  }

  function exportRentSuggestionsCsv() {
    const rows = serverRentSuggestionRows();
    if (!rows.length) throw new Error("Fetch everything first. Suggestions will appear here.");
    const headers = tableKeys(rows, "rent-suggestions").filter((key) => key !== "property_image" && !key.startsWith("mod::") && !key.startsWith("staff::"));
    const csvRows = rows.map((row) => headers.map((header) => csvCell(cellValue(row, header))).join(","));
    download("torn-rent-suggestions.csv", [headers.join(","), ...csvRows].join("\n"), "text/csv");
  }

  function csvCell(value) {
    const text = clean(value, "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const leases = Array.isArray(parsed) ? parsed : parsed.leases;
        if (!Array.isArray(leases)) throw new Error("No leases array found.");
        if (parsed && !Array.isArray(parsed)) {
          state.propertyCosts = { ...(state.propertyCosts || {}), ...(parsed.propertyCosts || {}) };
          state.settings = { ...appSettings(), ...(parsed.settings || {}) };
          state.archivedRentals = dedupeArchiveRows([...(state.archivedRentals || []), ...(parsed.archivedRentals || [])]);
          state.activity = Array.isArray(parsed.activity) ? parsed.activity : (state.activity || []);
          state.endpointData = { ...(state.endpointData || {}), ...(parsed.endpointData || {}) };
          state.keyInfo = parsed.keyInfo || state.keyInfo;
          saveState();
        }
        mergeLeases(leases.map((lease) => ({ ...lease, id: lease.id || makeId("import"), updatedAt: lease.updatedAt || nowIso() })));
        setStatus(`Imported ${leases.length} lease records.`);
      } catch (error) {
        setStatus(error.message || "Could not import JSON.", true);
      }
    };
    reader.readAsText(file);
  }

  function setStatus(message, isError = false) {
    const nodes = Array.from(document.querySelectorAll(`#${APP_ID} .tlt-status`));
    if (popupWindow && !popupWindow.closed) {
      nodes.push(...Array.from(popupWindow.document.querySelectorAll(`#${APP_ID} .tlt-status`)));
    }
    for (const node of nodes) {
      node.textContent = message;
      node.classList.toggle("is-error", Boolean(isError));
    }
  }

  function syncGlobalThemeToDocument(targetDocument = document) {
    if (!targetDocument || !targetDocument.documentElement) return;
    const sourceRoot = document.documentElement;
    const targetRoot = targetDocument.documentElement;
    const sourceStyle = getComputedStyle(sourceRoot);
    const targetStyle = targetRoot.style;
    const names = globalThemeVariableNames(sourceStyle);

    for (const name of names) {
      const value = sourceStyle.getPropertyValue(name);
      if (value && value.trim()) targetStyle.setProperty(name, value.trim());
      else targetStyle.removeProperty(name);
    }
    targetRoot.dataset.modulHubTheme = sourceRoot.dataset.modulHubTheme || "";
    targetRoot.dataset.modulHubEnabled = sourceRoot.dataset.modulHubEnabled || "";
  }

  function globalThemeVariableNames(sourceStyle) {
    const names = new Set();
    const api = window.MoDuLHubGlobalTheme || window.MoDuLHubTheme;
    if (api && typeof api.getContract === "function") {
      try {
        const contract = api.getContract() || {};
        Object.values(contract.cssVars || {}).forEach((name) => { if (name) names.add(name); });
        Object.values(contract.aliases || {}).flat().forEach((name) => { if (name) names.add(name); });
      } catch (_error) {
        // Fall through to computed custom properties below.
      }
    }
    for (let index = 0; index < sourceStyle.length; index += 1) {
      const name = sourceStyle[index];
      if (String(name).startsWith("--mh-")) names.add(name);
    }
    return names;
  }

  function syncPopupTheme() {
    if (!popupWindow || popupWindow.closed) return;
    syncGlobalThemeToDocument(popupWindow.document);
  }

  function tfUi() {
    state.ui = { ...emptyState.ui, ...(state.ui || {}) };
    return state.ui;
  }

  function tfModel() {
    const server = endpointBody("server-sync") || {};
    const profile = profileInfo() || server.profile || {};
    const spouse = profileSpouse() || profile.spouse || {};
    const myId = String(keyInfoUserId(state.keyInfo) || (state.endpointInputs || {}).userId || profile.id || "");
    const owned = firstArray(server, ["ownedProperties", "owned_properties", "userProperties", "propertiesOwned"]);
    const mine = owned.length ? owned : propertiesFromBody(endpointBody("user-properties"));
    const partner = firstArray(server, ["partnerProperties", "spouseProperties", "partner_properties", "spouse_properties"]);
    const spouseRows = partner.length ? partner : propertiesFromBody(spouseOwnedPropertiesBody(endpointBody("spouse-properties")));
    const current = currentPropertyFromBody(server) || currentPropertyFromBody(endpointBody("user-property")) || currentPropertyFromBody(endpointBody("user-id-property"));
    const propertyMap = new Map();

    const addProperty = (raw, ownershipHint = "") => {
      if (!raw || typeof raw !== "object") return;
      const property = tfNormalizeProperty(raw, ownershipHint, { myId, spouse });
      const key = property.key;
      const previous = propertyMap.get(key);
      propertyMap.set(key, previous ? tfMergeProperty(previous, property) : property);
    };
    mine.forEach((row) => addProperty(row, "mine"));
    spouseRows.forEach((row) => addProperty(row, "spouse"));
    if (current) addProperty(current, "current");

    const currentId = current && String(current.id || current.property_id || "");
    const currentName = current && propertyDisplayName(current);
    let currentHome = null;
    for (const property of propertyMap.values()) {
      property.isCurrentHome = Boolean(current && ((currentId && property.id === currentId) || (!currentId && currentName && normalizeLookup(property.name) === normalizeLookup(currentName))));
      if (property.isCurrentHome) currentHome = property;
    }

    const contracts = (state.leases || []).map((lease) => tfNormalizeContract(lease, propertyMap, { myId, spouse })).filter(Boolean);
    for (const contract of contracts) {
      const property = propertyMap.get(contract.propertyKey);
      if (!property && contract.propertyId) {
        addProperty({ id: contract.propertyId, property: { name: contract.property }, owner: splitUserLabel(contract.owner) }, contract.ownership);
      }
    }
    const activeRentals = contracts.filter((contract) => tfIsActiveContract(contract) && !tfIsHouseholdOccupancyContract(contract, propertyMap.get(contract.propertyKey), spouse));
    for (const contract of activeRentals) {
      const property = propertyMap.get(contract.propertyKey);
      if (property && (!property.activeContract || tfContractPriority(contract) > tfContractPriority(property.activeContract))) {
        property.activeContract = contract;
      }
    }

    for (const property of propertyMap.values()) {
      property.status = property.isCurrentHome
        ? "occupied"
        : property.activeContract && property.activeContract.direction === "out"
          ? "rented"
          : property.listed
            ? "listed"
            : "available";
      if (property.isCurrentHome) currentHome = property;
    }

    const properties = Array.from(propertyMap.values()).sort((a, b) => tfOwnershipOrder(a.ownership) - tfOwnershipOrder(b.ownership) || a.name.localeCompare(b.name));
    const archive = dedupeArchiveRows([...(state.archivedRentals || []), ...serverArchiveRows()]).map(tfNormalizeArchive).sort((a, b) => String(b.endDate || b.startDate).localeCompare(String(a.endDate || a.startDate)));
    const activities = tfActivityRows(properties, activeRentals, archive);
    const suggestions = serverRentSuggestionRows().map((row) => tfNormalizeSuggestion(row, properties));
    const marketSummary = serverRoiSummaryRows();
    return { profile, spouse, myId, properties, currentHome, activeRentals, archive, activities, suggestions, marketSummary };
  }

  function tfNormalizeProperty(raw, ownershipHint, context) {
    const id = String(raw.id || raw.property_id || raw.propertyId || "");
    const name = propertyDisplayName(raw) || (id ? `Property #${id}` : "Property");
    const owner = userName(raw.owner) || (ownershipHint === "mine" ? "You" : ownershipHint === "spouse" ? (context.spouse.name || "Spouse") : "Unknown owner");
    const ownerParts = splitUserLabel(owner);
    let ownership = ownershipHint;
    if (ownership === "current") ownership = "";
    if (!ownership && context.myId && ownerParts.id && normalizeLookup(ownerParts.id) === normalizeLookup(context.myId)) ownership = "mine";
    if (!ownership && context.spouse && context.spouse.id && ownerParts.id && normalizeLookup(ownerParts.id) === normalizeLookup(context.spouse.id)) ownership = "spouse";
    if (!ownership) ownership = "third-party";
    const type = propertyName(raw.property) || propertyName(raw) || name.replace(/\s+#?\d+$/, "");
    const happy = positiveNumber(raw.happy || nestedValue(raw, "property.happy"));
    const upgrades = modificationNames(raw.modifications || nestedValue(raw, "property.modifications"));
    const staff = staffEntries(raw.staff || nestedValue(raw, "property.staff"));
    const residents = Array.isArray(raw.used_by) ? raw.used_by.map(userName).filter(Boolean) : [];
    const image = propertyImageUrlFromRow(raw) || propertyImageUrl(propertyTypeIdFromRow(raw) || type);
    const marketValue = moneyNumber(raw.market_price || raw.marketValue || nestedValue(raw, "property.market_price"));
    const key = id ? `property:${id}` : `property:${normalizeLookup(name)}:${normalizeLookup(owner)}`;
    return {
      key,
      id,
      name,
      type,
      owner,
      ownerId: ownerParts.id,
      ownership,
      happy,
      upgrades,
      staff,
      residents,
      upkeep: moneyNumber(nestedValue(raw, "upkeep.property")) || moneyNumber(raw.upkeep),
      marketValue,
      investment: manualInvestmentForRow(raw) || estimatedInvestmentCost(raw, propertyTypeForRow(raw) || {}),
      image,
      listed: isForRent(raw),
      raw,
      activeContract: null,
      isCurrentHome: false,
      status: "available",
    };
  }

  function tfMergeProperty(previous, incoming) {
    return {
      ...previous,
      ...Object.fromEntries(Object.entries(incoming).filter(([, value]) => !isBlankValue(value) && (!Array.isArray(value) || value.length))),
      raw: { ...(previous.raw || {}), ...(incoming.raw || {}) },
      ownership: previous.ownership !== "third-party" ? previous.ownership : incoming.ownership,
      residents: incoming.residents.length ? incoming.residents : previous.residents,
      upgrades: incoming.upgrades.length ? incoming.upgrades : previous.upgrades,
      staff: incoming.staff.length ? incoming.staff : previous.staff,
      listed: Boolean(previous.listed || incoming.listed),
    };
  }

  function tfNormalizeContract(lease, propertyMap, context) {
    if (!lease || typeof lease !== "object") return null;
    const propertyId = String(lease.propertyId || lease.property_id || propertyIdFromLeaseId(lease.id) || "");
    let propertyKey = propertyId ? `property:${propertyId}` : "";
    if (!propertyKey) {
      const match = Array.from(propertyMap.values()).find((property) => normalizeLookup(property.name) === normalizeLookup(lease.property));
      propertyKey = match ? match.key : `property:${normalizeLookup(lease.property)}:${normalizeLookup(lease.landlord)}`;
    }
    const property = propertyMap.get(propertyKey);
    const role = leaseRoleGroup(lease);
    const status = normalizeLeaseStatus(lease.status, lease.roleHint || lease.source, lease.tenant);
    const direction = role === "tenant" || ["leased", "rent_from"].includes(status) ? "from" : "out";
    const ownership = property ? property.ownership : role === "spouse" ? "spouse" : direction === "from" ? "third-party" : "mine";
    const remaining = lease.remainingDays !== "" && lease.remainingDays !== undefined ? Number(lease.remainingDays) : remainingDaysFromEnd(lease.endDate);
    return {
      contractId: contractIdentity(lease),
      propertyKey,
      propertyId,
      property: property ? property.name : clean(lease.property, propertyId ? `Property #${propertyId}` : "Property"),
      type: property ? property.type : clean(lease.property, "Property"),
      image: property ? property.image : propertyImageUrl(propertyTypeId(lease.property)),
      ownership,
      owner: clean(lease.landlord, direction === "out" ? "You" : "Unknown owner"),
      tenant: clean(lease.tenant, "Unknown renter"),
      direction,
      status,
      daily: moneyNumber(lease.dailyAmount || lease.per_day),
      total: moneyNumber(lease.amount || lease.total),
      duration: positiveNumber(lease.durationDays || lease.days),
      startDate: lease.startDate || lease.start_date || "",
      endDate: lease.endDate || lease.end_date || "",
      remaining: Number.isFinite(remaining) ? remaining : "",
      notes: clean(lease.notes, ""),
      source: lease.source || "saved",
      raw: lease,
      context,
    };
  }

  function tfIsActiveContract(contract) {
    if (!contract || ["ended", "expired", "sold", "for_rent"].includes(contract.status)) return false;
    if (["rented", "leased", "rent_to", "rent_from"].includes(contract.status)) return true;
    if (contract.tenant && contract.tenant !== "Unknown renter") {
      return !(contract.endDate && contract.remaining === 0 && contract.status === "manual");
    }
    return false;
  }

  function tfIsHouseholdOccupancyContract(contract, property, spouse = null) {
    if (!contract || !property || !property.isCurrentHome || !["mine", "spouse"].includes(property.ownership)) return false;
    return isHouseholdOccupancyLease(contract.raw || contract, property.raw || property, spouse);
  }

  function tfContractPriority(contract) {
    return (contract.status === "rented" || contract.status === "leased" ? 1000000 : 0) + (Number(contract.remaining) || 0);
  }

  function tfNormalizeArchive(row) {
    const propertyId = String(row.property_id || row.propertyId || row.id || "");
    const role = clean(row.role || row.roleHint, "owner").toLowerCase();
    return {
      ...row,
      propertyId,
      property: clean(row.property_type || row.property || row.home, propertyId ? `Property #${propertyId}` : "Property"),
      ownership: role.includes("spouse") ? "spouse" : role.includes("tenant") || role.includes("renter") ? "third-party" : "mine",
      owner: clean(row.owner || row.landlord, ""),
      tenant: clean(row.renter || row.tenant, ""),
      daily: moneyNumber(row.per_day || row.dailyAmount || row.cost_per_day),
      total: moneyNumber(row.total || row.amount || row.cost),
      startDate: row.start_date || row.startDate || "",
      endDate: row.end_date || row.endDate || "",
      duration: positiveNumber(row.days || row.durationDays),
      status: clean(row.status, "expired"),
      image: row.property_image || propertyImageUrl(row.property_type || row.property),
    };
  }

  function tfNormalizeSuggestion(row, properties) {
    const propertyId = String(row.id || row.property_id || row.propertyId || "");
    const property = properties.find((item) => propertyId && item.id === propertyId) || properties.find((item) => normalizeLookup(item.name) === normalizeLookup(row.property));
    const basis = clean(row.market_basis, "Target ROI only");
    const derivedConfidence = /same happiness/i.test(basis) ? "Excellent" : /home type|property type/i.test(basis) ? "Fair" : /target roi/i.test(basis) ? "Weak" : "Good";
    return {
      ...row,
      propertyId,
      property: property || null,
      name: property ? property.name : clean(row.property, propertyId ? `Property #${propertyId}` : "Property"),
      ownership: property ? property.ownership : clean(row.ownership || row._ownership, "mine"),
      happy: positiveNumber(row.happy || (property && property.happy)),
      upgrades: property ? property.upgrades : modificationNames(row.modifications),
      currentDaily: moneyNumber(row.current_cost_per_day),
      medianDaily: moneyNumber(row.market_median_daily),
      averageDaily: moneyNumber(row.market_avg_daily),
      minDaily: moneyNumber(row.market_min_daily),
      maxDaily: moneyNumber(row.market_max_daily),
      targetDaily: moneyNumber(row.target_rent_per_day),
      suggestedDaily: moneyNumber(row.suggested_rent_per_day || row.rent_per_day_suggested),
      suggestedDays: positiveNumber(row.suggested_duration_days),
      suggestedTotal: moneyNumber(row.suggested_total),
      durationBasis: clean(row.duration_basis, "Saved default lease duration"),
      confidence: clean(row.comparable_confidence || row.confidence, derivedConfidence),
      basis,
      action: clean(row.suggested_action || row.recommended_action, "Review pricing"),
      note: clean(row.suggestion_note, ""),
      listings: Number(row.rent_listings || 0),
      comparables: Array.isArray(row.comparable_listings) ? row.comparable_listings : Array.isArray(row.comparables) ? row.comparables : [],
      saleMedian: moneyNumber(row.market_median_sale || row.sale_median || row.suggested_sale_price),
      saleAverage: moneyNumber(row.market_avg_sale || row.sale_average),
      saleMin: moneyNumber(row.market_min_sale || row.sale_min),
      saleMax: moneyNumber(row.market_max_sale || row.sale_max),
      suggestedSale: moneyNumber(row.suggested_sale_price || row.sale_price_suggested),
      saleBasis: clean(row.sale_market_basis, "No sale comparison yet"),
      saleConfidence: clean(row.sale_comparable_confidence, "Weak"),
      saleListings: Number(row.sale_listings || 0),
      saleComparables: Array.isArray(row.sale_comparable_listings) ? row.sale_comparable_listings : [],
      saleAction: clean(row.sale_suggested_action, "Review sale price"),
    };
  }

  function tfActivityRows(properties, activeRentals, archive) {
    const events = serverPropertyHistoryEventRows().map((row) => ({
      at: row.event_at || row.timestamp || row.created_at || "",
      type: clean(row.event || row.event_type, "Property updated"),
      property: clean(row.property_type || row.property, row.property_id ? `Property #${row.property_id}` : "Property"),
      detail: tfHistoryDetail(row),
    }));
    const archived = archive.map((row) => ({ at: row.endDate, type: "Contract archived", property: row.property, detail: row.tenant ? `Rental with ${row.tenant} finished.` : "Rental contract finished." }));
    if (!events.length && !archived.length) {
      return activeRentals.slice(0, 5).map((row) => ({ at: row.startDate, type: row.direction === "out" ? "Active rental" : "Renting from", property: row.property, detail: row.direction === "out" ? `Tenant: ${row.tenant}` : `Owner: ${row.owner}` }));
    }
    return [...events, ...archived].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20);
  }

  function tfHistoryDetail(row) {
    const parts = [];
    if (row.renter) parts.push(`Renter: ${row.renter}`);
    if (row.owner) parts.push(`Owner: ${row.owner}`);
    if (row.rent) parts.push(`Rent: ${money(row.rent)}`);
    if (row.happy) parts.push(`Happiness: ${Number(row.happy).toLocaleString()}`);
    return parts.join(" · ") || "Property history updated.";
  }

  function tfOwnershipOrder(value) {
    return value === "mine" ? 0 : value === "spouse" ? 1 : 2;
  }

  function tfOwnershipLabel(value, rentedFrom = false) {
    if (rentedFrom || value === "third-party") return "Renting From";
    if (value === "spouse") return "Spouse Property";
    return "My Property";
  }

  function tfOwnershipBadge(value, rentedFrom = false) {
    const kind = rentedFrom || value === "third-party" ? "third" : value;
    return `<span class="tf-badge tf-owner-${escapeAttr(kind)}">${escapeHtml(tfOwnershipLabel(value, rentedFrom))}</span>`;
  }

  function tfStatusBadge(status) {
    const labels = { occupied: "Current Home", rented: "Rented Out", listed: "Listed", available: "Available", active: "Active", expired: "Expired Rental" };
    return `<span class="tf-badge tf-status-${escapeAttr(status)}">${escapeHtml(labels[status] || leaseStatusLabel(status))}</span>`;
  }

  function tfMoney(value, suffix = "") {
    return value ? `${money(value)}${suffix}` : "Unavailable";
  }

  function tfNumber(value, fallback = "0") {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString() : fallback;
  }

  function tfDate(value) {
    if (!value) return "Unknown";
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? clean(value, "Unknown") : date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  function tfRelative(value) {
    if (!value) return "Date unavailable";
    const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
    if (Number.isNaN(date.getTime())) return clean(value, "Unknown");
    const daysAgo = Math.round((Date.now() - date.getTime()) / 86400000);
    if (daysAgo === 0) return "Today";
    if (daysAgo === 1) return "Yesterday";
    if (daysAgo > 1 && daysAgo < 30) return `${daysAgo} days ago`;
    if (daysAgo < 0 && daysAgo >= -30) return `in ${Math.abs(daysAgo)} days`;
    return tfDate(value);
  }

  function tfIcon(name) {
    const iconName = ICON_NAMES.includes(name) ? name : "property";
    const content = ensureIconCacheLoaded()
      ? `<use href="#tf-icon-${escapeAttr(iconName)}"></use>`
      : (BUILTIN_ICON_CONTENT[iconName] || BUILTIN_ICON_CONTENT.property);
    return `<svg class="tf-icon tf-icon-${escapeAttr(iconName)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${content}</svg>`;
  }

  function tfMetric(icon, value, label, tone = "") {
    return `<div class="tf-metric ${tone ? `is-${tone}` : ""}">${tfIcon(icon)}<div><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div></div>`;
  }

  function tfEmpty(title, text, action = "") {
    return `<div class="tf-empty">${tfIcon("property")}<strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span>${action}</div>`;
  }

  function tfPageTitle(icon, title, subtitle, controls = "") {
    return `<div class="tf-page-title"><div class="tf-page-heading">${tfIcon(icon)}<div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div></div>${controls}</div>`;
  }

  function tfPortfolioStats(model, scope) {
    const rows = model.properties.filter((property) => property.ownership === scope);
    const rented = rows.filter((property) => property.activeContract && property.activeContract.direction === "out");
    const available = rows.filter((property) => property.status === "available");
    const listed = rows.filter((property) => property.status === "listed");
    const daily = rented.reduce((sum, property) => sum + Number(property.activeContract && property.activeContract.daily || 0), 0);
    return { total: rows.length, rented: rented.length, available: available.length, listed: listed.length, daily };
  }

  function tfAttention(model) {
    const soon = model.activeRentals.filter((contract) => Number.isFinite(Number(contract.remaining)) && Number(contract.remaining) >= 0 && Number(contract.remaining) <= 7);
    const vacant = model.properties.filter((property) => property.status === "available" && property.ownership !== "third-party");
    const listed = model.properties.filter((property) => property.status === "listed");
    const missing = model.activeRentals.filter((contract) => !contract.endDate || (contract.direction === "out" && (!contract.tenant || contract.tenant === "Unknown renter")));
    return [
      soon.length ? { tone: "danger", title: "Rentals ending soon", detail: `${soon.length} contract${soon.length === 1 ? "" : "s"} end within 7 days`, count: soon.length, tab: "rentals" } : null,
      vacant.length ? { tone: "warning", title: "Vacant properties", detail: `${vacant.length} owned propert${vacant.length === 1 ? "y is" : "ies are"} available`, count: vacant.length, tab: "properties" } : null,
      listed.length ? { tone: "info", title: "Listed properties", detail: `${listed.length} propert${listed.length === 1 ? "y is" : "ies are"} listed for rent`, count: listed.length, tab: "properties" } : null,
      missing.length ? { tone: "danger", title: "Missing contract details", detail: `${missing.length} active contract${missing.length === 1 ? " needs" : "s need"} attention`, count: missing.length, tab: "rentals" } : null,
    ].filter(Boolean);
  }

  function tfSyncProgressHtml() {
    const progress = normalizeSyncProgress(state.syncProgress);
    if (!progress) return "";
    const symbols = { pending: "○", active: "…", done: "✓", warning: "!", error: "×" };
    const finished = Boolean(progress.finishedAt);
    const progressClass = finished ? "is-finished" : "is-running";
    return `<section class="tf-sync-progress-toast ${progressClass} ${state.syncState === "error" ? "is-error" : ""}" aria-live="polite" aria-label="Tornfolio sync progress"><header><span class="tf-sync-progress-icon">${tfIcon(finished && state.syncState !== "error" ? "activity" : "sync")}</span><div><strong>${escapeHtml(progress.title)}</strong><small>${escapeHtml(progress.message)}</small></div><button class="tf-sync-progress-close" type="button" data-action="dismiss-sync-progress" aria-label="Dismiss sync details">${tfIcon("close")}</button></header><div class="tf-sync-progress-meta"><div class="tf-sync-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${escapeAttr(Math.round(progress.percent))}"><i style="--tf-sync-progress:${escapeAttr(progress.percent)}%"></i></div><b>${Math.round(progress.percent)}%</b></div><ol>${progress.steps.map((step) => `<li class="is-${escapeAttr(step.status)}"><i>${symbols[step.status] || "○"}</i><span><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(step.detail)}</small></span></li>`).join("")}</ol>${finished ? `<footer><span>${progress.startedAt ? `Started ${escapeHtml(new Date(progress.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}` : "Sync finished"}</span><strong>${progress.finishedAt ? `Finished ${escapeHtml(new Date(progress.finishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}` : ""}</strong></footer>` : `<footer><span>Live progress is reported by the hosted sync.</span><strong>Please keep Torn open</strong></footer>`}</section>`;
  }

  function tfShellHtml(model, isPopup) {
    return `
      ${iconSpriteDefsHtml()}
      <button class="tlt-tab tf-launcher" type="button">${state.panelOpen ? "Hide Tornfolio" : "Open Tornfolio"}</button>
      <div class="tlt-panel tf-shell" role="region" aria-label="Tornfolio portfolio and rental management">
        <header class="tlt-header tf-header">
          <div class="tf-brand"><span class="tf-logo">${tfIcon("logo")}</span><div><strong>Torn<span>folio</span></strong><small>Portfolio &amp; Rental Management</small></div></div>
          <div class="tf-header-actions">
            <div class="tf-sync-meta"><i class="tf-sync-dot is-${escapeAttr(state.syncState || "idle")}"></i><span>Last synced<strong>${state.lastSyncAt ? escapeHtml(new Date(state.lastSyncAt).toLocaleString()) : "Not yet"}</strong></span></div>
            <button class="tf-sync-button" type="button" data-action="refresh-user-details"${state.syncState === "syncing" ? " disabled" : ""}>${tfIcon("sync")}<span>${state.syncState === "syncing" ? "Syncing…" : "Sync Now"}</span></button>
            <button class="tf-icon-button" type="button" data-action="open-settings" aria-label="Open settings">${tfIcon("settings")}</button>
            ${isPopup ? `<button class="tf-icon-button" type="button" data-action="close-popup" aria-label="Close popup">${tfIcon("close")}</button>` : `<button class="tf-icon-button" type="button" data-action="open-popup" aria-label="Open in popup">${tfIcon("external")}</button><button class="tf-icon-button" type="button" data-action="hide-panel" aria-label="Hide Tornfolio">${tfIcon("minimize")}</button>`}
          </div>
        </header>
        <nav class="tf-nav" role="tablist" aria-label="Tornfolio sections">${tabsHtml()}</nav>
        <main class="tlt-tab-content tf-content">${activeTabHtml(model)}</main>
        ${state.manualModalOpen ? manualLeaseModalHtml() : ""}
        ${state.settingsOpen ? tfSettingsModalHtml() : ""}
        ${state.detailView ? tfDetailModalHtml(model) : ""}
        <footer class="tf-footer"><div class="tf-footer-brand">${tfIcon("logo")}<strong>Tornfolio</strong><small>Portfolio &amp; Rental Management</small></div><div><span>Help &amp; Support</span><span>Privacy Policy</span><span>Terms of Service</span><span>v0.6.7</span></div></footer>
        ${tfSyncProgressHtml()}
        <div class="tlt-status tf-toast ${state.syncProgress ? "is-suppressed" : ""} ${state.syncState && state.syncState !== "idle" ? "is-visible" : ""} ${state.syncState === "error" ? "is-error" : ""}" aria-live="polite">${escapeHtml(state.syncMessage || "")}</div>
      </div>
    `;
  }

  function tfDashboardHtml(model) {
    const mine = tfPortfolioStats(model, "mine");
    const spouse = tfPortfolioStats(model, "spouse");
    const attention = tfAttention(model);
    return `
      <section class="tf-page tf-dashboard">
        ${model.currentHome ? tfCurrentHomeHero(model.currentHome) : tfEmpty("Current home unavailable", "Sync Tornfolio to identify the home you currently live in.", `<button class="tf-primary" type="button" data-action="refresh-user-details">Sync Now</button>`)}
        <div class="tf-two-column tf-portfolio-row">
          ${tfPortfolioPanel("My Portfolio", "mine", mine)}
          ${tfPortfolioPanel("Spouse Portfolio", "spouse", spouse)}
        </div>
        <div class="tf-main-sidebar">
          <section class="tf-card">
            <div class="tf-card-head"><h2>${tfIcon("rentals")} Active Rentals</h2><button type="button" data-tab="rentals">View All Rentals →</button></div>
            ${tfRentalTable(model.activeRentals.slice(0, 5))}
          </section>
          <section class="tf-card tf-attention">
            <div class="tf-card-head"><h2>${tfIcon("alert")} Needs Attention ${attention.length ? `<span class="tf-count">${attention.reduce((sum, item) => sum + item.count, 0)}</span>` : ""}</h2><button type="button" data-tab="properties">View All →</button></div>
            ${attention.length ? attention.map(tfAttentionRow).join("") : tfEmpty("Everything looks clear", "No urgent portfolio items were found.")}
          </section>
        </div>
        <section class="tf-card">
          <div class="tf-card-head"><h2>${tfIcon("activity")} Recent Activity</h2><button type="button" data-tab="archive">View Archive →</button></div>
          ${tfActivityList(model.activities.slice(0, 5))}
        </section>
      </section>
    `;
  }

  function tfCurrentHomeHero(property) {
    const residentText = property.residents.length ? property.residents.join(", ") : "Residents unavailable";
    return `<section class="tf-current-home ${property.image ? "has-image" : ""}"${property.image ? ` style="--tf-hero-image:url('${escapeAttr(property.image)}')"` : ""}>
      <div class="tf-current-overlay">
        <div class="tf-card-head"><h2>${tfIcon("home")} Current Home</h2><button type="button" data-action="open-property" data-property-key="${escapeAttr(property.key)}">View Property →</button></div>
        <h1>${escapeHtml(property.name)}${property.id && !property.name.includes(property.id) ? ` <small>#${escapeHtml(property.id)}</small>` : ""}</h1>
        <div class="tf-badges">${tfOwnershipBadge(property.ownership, property.ownership === "third-party")}${tfStatusBadge("occupied")}</div>
        <div class="tf-hero-meta"><div><span>Owner</span><strong>${escapeHtml(property.owner)}</strong></div><div><span>Residents</span><strong>${escapeHtml(residentText)}</strong></div><div><span>Status</span><strong class="is-success">Occupied</strong></div></div>
      </div>
    </section>`;
  }

  function tfPortfolioPanel(title, scope, summary) {
    return `<section class="tf-card tf-portfolio tf-${escapeAttr(scope)}"><div class="tf-card-head"><h2>${tfIcon(scope === "spouse" ? "heart" : "property")} ${escapeHtml(title)}</h2><button type="button" data-tab="properties" data-scope="${escapeAttr(scope)}">›</button></div><div class="tf-metrics">
      ${tfMetric("property", tfNumber(summary.total), "Total Properties")}
      ${tfMetric("key", tfNumber(summary.rented), "Rented Out", "info")}
      ${tfMetric("home", tfNumber(summary.available), "Available")}
      ${tfMetric("tag", tfNumber(summary.listed), "Listed", "warning")}
      ${tfMetric("money", tfMoney(summary.daily), "Active Rent Income / day", "success")}
    </div></section>`;
  }

  function tfRentalTable(rows) {
    if (!rows.length) return tfEmpty("No active rentals", "Current rental contracts will appear here after a sync.");
    return `<div class="tf-table-wrap"><table class="tf-table"><thead><tr><th>Property</th><th>Direction</th><th>Other party</th><th>Rent / Day</th><th>End Date</th><th>Remaining</th><th></th></tr></thead><tbody>${rows.map((row) => `<tr><td><div class="tf-table-property">${row.image ? `<img src="${escapeAttr(row.image)}" alt="">` : ""}<div><strong>${escapeHtml(row.property)}</strong><small>${row.propertyId ? `#${escapeHtml(row.propertyId)}` : escapeHtml(row.type)}</small></div></div></td><td>${row.direction === "out" ? "Renting Out" : "Renting From"}</td><td>${escapeHtml(row.direction === "out" ? row.tenant : row.owner)}</td><td>${escapeHtml(tfMoney(row.daily))}</td><td>${escapeHtml(tfDate(row.endDate))}</td><td class="${Number(row.remaining) <= 7 ? "is-urgent" : "is-success"}">${row.remaining === "" ? "Unknown" : `${tfNumber(row.remaining)} days`}</td><td><button class="tf-more" type="button" data-action="open-rental" data-contract-id="${escapeAttr(row.contractId)}" aria-label="View rental details">${tfIcon("more")}</button></td></tr>`).join("")}</tbody></table></div>`;
  }

  function tfAttentionRow(item) {
    return `<button class="tf-attention-row is-${escapeAttr(item.tone)}" type="button" data-tab="${escapeAttr(item.tab)}"><span class="tf-attention-symbol">${tfIcon(item.tone === "danger" ? "alert" : item.tone === "warning" ? "home" : "tag")}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span><b>${item.count}</b><i>›</i></button>`;
  }

  function tfActivityList(rows) {
    if (!rows.length) return tfEmpty("No activity yet", "Property activity appears after history has been synced.");
    return `<div class="tf-activity-list">${rows.map((row) => `<div class="tf-activity-row"><time>${escapeHtml(tfRelative(row.at))}</time><i></i><strong>${escapeHtml(row.type)}</strong><span>${escapeHtml(row.property)} · ${escapeHtml(row.detail)}</span></div>`).join("")}</div>`;
  }

  function tfPropertiesHtml(model) {
    const ui = tfUi();
    const scoped = model.properties.filter((property) => ui.propertyScope === "all" || property.ownership === ui.propertyScope);
    const filtered = scoped.filter((property) => {
      const query = normalizeLookup(ui.propertySearch);
      if (query && ![property.name, property.id, property.type, property.owner].join(" ").toLowerCase().includes(query)) return false;
      if (ui.propertyStatus !== "all" && property.status !== ui.propertyStatus) return false;
      if (ui.propertyType !== "all" && property.type !== ui.propertyType) return false;
      return true;
    });
    const summary = tfStatsForProperties(scoped);
    const types = Array.from(new Set(model.properties.map((property) => property.type).filter(Boolean))).sort();
    return `<section class="tf-page">
      ${tfPageTitle("property", "Properties", "Manage your owned homes and household portfolio.")}
      <div class="tf-filter-row"><div class="tf-segmented">
        ${tfSegmentButton("propertyScope", "mine", "home", "My Properties", ui.propertyScope)}
        ${tfSegmentButton("propertyScope", "spouse", "heart", "Spouse Properties", ui.propertyScope)}
        ${tfSegmentButton("propertyScope", "all", "list", "All Properties", ui.propertyScope)}
      </div><input type="search" data-ui-field="propertySearch" placeholder="Search properties…" value="${escapeAttr(ui.propertySearch)}"><select data-ui-field="propertyStatus"><option value="all">All Statuses</option>${["occupied", "rented", "available", "listed"].map((value) => `<option value="${value}"${ui.propertyStatus === value ? " selected" : ""}>${escapeHtml(humanHeader(value))}</option>`).join("")}</select><select data-ui-field="propertyType"><option value="all">All Types</option>${types.map((value) => `<option value="${escapeAttr(value)}"${ui.propertyType === value ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></div>
      <div class="tf-main-sidebar"><div><div class="tf-summary-strip">${tfMetric("property", tfNumber(summary.total), "Total Properties")}${tfMetric("key", tfNumber(summary.rented), "Rented Out", "info")}${tfMetric("home", tfNumber(summary.available), "Available")}${tfMetric("tag", tfNumber(summary.listed), "Listed", "warning")}${tfMetric("money", tfMoney(summary.daily), "Total Daily Rent Income", "success")}</div><div class="tf-property-list">${filtered.length ? filtered.map(tfPropertyCard).join("") : tfEmpty("No matching properties", "Change the filters or sync to load your property portfolio.")}</div></div>
        <aside class="tf-sidebar"><section class="tf-card"><div class="tf-card-head"><h2>${tfIcon("quick")} Quick Actions</h2></div><button class="tf-primary tf-wide" type="button" data-action="export-csv">Export CSV</button><button class="tf-wide" type="button" data-tab="archive">View Archive</button></section>${tfAttentionPanel(model)}<section class="tf-card"><div class="tf-card-head"><h2>${tfIcon("activity")} Recent Property Activity</h2></div>${tfActivityList(model.activities.slice(0, 5))}</section></aside>
      </div></section>`;
  }

  function tfStatsForProperties(rows) {
    const rented = rows.filter((row) => row.activeContract && row.activeContract.direction === "out");
    return { total: rows.length, rented: rented.length, available: rows.filter((row) => row.status === "available").length, listed: rows.filter((row) => row.status === "listed").length, daily: rented.reduce((sum, row) => sum + Number(row.activeContract && row.activeContract.daily || 0), 0) };
  }

  function tfSegmentButton(field, value, icon, label, selected) {
    return `<button type="button" data-ui-field="${escapeAttr(field)}" data-ui-value="${escapeAttr(value)}" class="${selected === value ? "is-active" : ""}">${tfIcon(icon)}<span>${escapeHtml(label)}</span></button>`;
  }

  function tfPropertyCard(property) {
    const contract = property.activeContract;
    const detail = property.isCurrentHome
      ? `<div><span>Owner</span><strong>${escapeHtml(property.owner)}</strong></div><div><span>Residents</span><strong>${escapeHtml(property.residents.join(", ") || "Unavailable")}</strong></div><div><span>Status</span><strong class="is-success">Occupied</strong></div>`
      : contract
        ? `<div><span>Tenant</span><strong>${escapeHtml(contract.tenant)}</strong></div><div><span>Rent / Day</span><strong>${escapeHtml(tfMoney(contract.daily))}</strong></div><div><span>End Date</span><strong>${escapeHtml(tfDate(contract.endDate))}</strong></div><div><span>Remaining</span><strong class="${Number(contract.remaining) <= 7 ? "is-urgent" : "is-success"}">${contract.remaining === "" ? "Unknown" : `${tfNumber(contract.remaining)} days`}</strong></div>`
        : property.listed
          ? `<div><span>Owner</span><strong>${escapeHtml(property.owner)}</strong></div><div><span>Status</span><strong class="is-warning">Available for rent</strong></div><div><span>Happiness</span><strong>${property.happy ? tfNumber(property.happy) : "Unavailable"}</strong></div>`
          : `<div><span>Owner</span><strong>${escapeHtml(property.owner)}</strong></div><div><span>Status</span><strong class="is-success">Available</strong></div><div><span>Type</span><strong>${escapeHtml(property.type)}</strong></div>`;
    return `<article class="tf-property-card">${property.image ? `<img src="${escapeAttr(property.image)}" alt="${escapeAttr(property.type)}">` : `<div class="tf-image-placeholder">${tfIcon("home")}</div>`}<div class="tf-property-body"><div class="tf-property-head"><div><h2>${escapeHtml(property.name)}${property.id && !property.name.includes(property.id) ? ` <small>#${escapeHtml(property.id)}</small>` : ""}</h2><div class="tf-badges">${tfOwnershipBadge(property.ownership)}${tfStatusBadge(property.status)}</div></div></div><div class="tf-property-meta">${detail}</div></div><div class="tf-card-actions"><button type="button" data-action="open-property" data-property-key="${escapeAttr(property.key)}">View Property →</button>${contract ? `<button type="button" data-action="open-rental" data-contract-id="${escapeAttr(contract.contractId)}">View Rental →</button>` : ""}</div></article>`;
  }

  function tfAttentionPanel(model) {
    const rows = tfAttention(model);
    return `<section class="tf-card tf-attention"><div class="tf-card-head"><h2>${tfIcon("alert")} Needs Attention ${rows.length ? `<span class="tf-count">${rows.reduce((sum, row) => sum + row.count, 0)}</span>` : ""}</h2></div>${rows.length ? rows.map(tfAttentionRow).join("") : tfEmpty("Nothing urgent", "Your current portfolio data has no urgent items.")}</section>`;
  }

  function tfRentalsHtml(model) {
    const ui = tfUi();
    const types = Array.from(new Set(model.activeRentals.map((row) => row.type).filter(Boolean))).sort();
    const rows = model.activeRentals.filter((row) => {
      if (ui.rentalScope !== "all" && row.direction !== ui.rentalScope) return false;
      const query = normalizeLookup(ui.rentalSearch);
      if (query && ![row.property, row.propertyId, row.owner, row.tenant].join(" ").toLowerCase().includes(query)) return false;
      if (ui.rentalOwner !== "all" && row.ownership !== ui.rentalOwner) return false;
      if (ui.rentalType !== "all" && row.type !== ui.rentalType) return false;
      return true;
    });
    const soon = rows.filter((row) => Number(row.remaining) >= 0 && Number(row.remaining) <= 7);
    const daily = rows.reduce((sum, row) => sum + Number(row.daily || 0), 0);
    const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    return `<section class="tf-page">${tfPageTitle("rentals", "Rentals", "Manage your active rental contracts.")}
      <div class="tf-filter-row"><div class="tf-segmented">${tfSegmentButton("rentalScope", "out", "key", "Renting Out", ui.rentalScope)}${tfSegmentButton("rentalScope", "from", "exchange", "Renting From", ui.rentalScope)}${tfSegmentButton("rentalScope", "all", "list", "All Rentals", ui.rentalScope)}</div><input type="search" data-ui-field="rentalSearch" placeholder="Search rentals…" value="${escapeAttr(ui.rentalSearch)}"><select data-ui-field="rentalOwner"><option value="all">All Owners</option><option value="mine"${ui.rentalOwner === "mine" ? " selected" : ""}>My Properties</option><option value="spouse"${ui.rentalOwner === "spouse" ? " selected" : ""}>Spouse Properties</option><option value="third-party"${ui.rentalOwner === "third-party" ? " selected" : ""}>Third Party</option></select><select data-ui-field="rentalType"><option value="all">All Types</option>${types.map((type) => `<option value="${escapeAttr(type)}"${ui.rentalType === type ? " selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></div>
      <div class="tf-main-sidebar"><div><div class="tf-summary-strip">${tfMetric("home", tfNumber(rows.length), "Active Rentals")}${tfMetric("alert", tfNumber(soon.length), "Ending Soon", soon.length ? "danger" : "")}${tfMetric("money", tfMoney(daily), "Total Daily Rent", "success")}${tfMetric("rentals", tfMoney(total), "Total Contract Value", "info")}</div><div class="tf-rental-list">${rows.length ? rows.map(tfRentalCard).join("") : tfEmpty("No matching active rentals", "Finished contracts live in Archive. Sync or change the current filters.")}</div></div><aside class="tf-sidebar"><section class="tf-card"><div class="tf-card-head"><h2>${tfIcon("quick")} Quick Actions</h2></div><button class="tf-primary tf-wide" type="button" data-action="open-manual-modal">${tfIcon("add")} Add Manual Rental</button><button class="tf-wide" type="button" data-action="export-csv">Export CSV</button><button class="tf-wide" type="button" data-tab="archive">View Archive</button></section>${tfAttentionPanel(model)}<section class="tf-card"><div class="tf-card-head"><h2>${tfIcon("calendar")} Upcoming End Dates</h2></div>${tfUpcomingRentals(model.activeRentals)}</section></aside></div>
    </section>`;
  }

  function tfRentalCard(contract) {
    return `<article class="tf-rental-card">${contract.image ? `<img src="${escapeAttr(contract.image)}" alt="">` : `<div class="tf-image-placeholder">${tfIcon("home")}</div>`}<div class="tf-rental-body"><div class="tf-property-head"><div><h2>${escapeHtml(contract.property)}${contract.propertyId && !contract.property.includes(contract.propertyId) ? ` <small>#${escapeHtml(contract.propertyId)}</small>` : ""}</h2><div class="tf-badges">${tfOwnershipBadge(contract.ownership, contract.direction === "from")}${tfStatusBadge("active")}</div></div></div><div class="tf-contract-grid"><div><span>${contract.direction === "out" ? "Tenant" : "Owner"}</span><strong>${escapeHtml(contract.direction === "out" ? contract.tenant : contract.owner)}</strong></div><div><span>Rent / Day</span><strong>${escapeHtml(tfMoney(contract.daily))}</strong></div><div><span>Total Contract</span><strong>${escapeHtml(tfMoney(contract.total))}</strong></div><div><span>Started</span><strong>${escapeHtml(tfDate(contract.startDate))}</strong></div><div><span>Ends</span><strong>${escapeHtml(tfDate(contract.endDate))}</strong></div><div><span>Remaining</span><strong class="${Number(contract.remaining) <= 7 ? "is-urgent" : "is-success"}">${contract.remaining === "" ? "Unknown" : `${tfNumber(contract.remaining)} days`}</strong></div></div></div><div class="tf-card-actions"><button type="button" data-action="open-property" data-property-key="${escapeAttr(contract.propertyKey)}">View Property →</button><button type="button" data-action="open-rental" data-contract-id="${escapeAttr(contract.contractId)}">View Rental →</button></div></article>`;
  }

  function tfUpcomingRentals(rows) {
    const sorted = [...rows].filter((row) => row.endDate).sort((a, b) => Number(a.remaining) - Number(b.remaining)).slice(0, 6);
    if (!sorted.length) return tfEmpty("No end dates", "Active contracts with known end dates appear here.");
    return `<div class="tf-upcoming">${sorted.map((row) => `<button type="button" data-action="open-rental" data-contract-id="${escapeAttr(row.contractId)}">${row.image ? `<img src="${escapeAttr(row.image)}" alt="">` : ""}<span><strong>${escapeHtml(row.property)}</strong><small>${escapeHtml(row.direction === "out" ? row.tenant : row.owner)}</small></span><b class="${Number(row.remaining) <= 7 ? "is-urgent" : "is-success"}">${row.remaining === "" ? "?" : `${tfNumber(row.remaining)} days`}</b></button>`).join("")}</div>`;
  }

  function tfMarketHtml(model) {
    const ui = tfUi();
    const mode = ui.marketMode === "sale" ? "sale" : "rent";
    const suggestions = model.suggestions.filter((row) => {
      if (ui.marketScope !== "all" && row.ownership !== ui.marketScope) return false;
      if (ui.marketType !== "all" && (!row.property || row.property.type !== ui.marketType)) return false;
      return !row.property || !["rented", "listed"].includes(row.property.status);
    });
    const types = Array.from(new Set(model.properties.map((row) => row.type).filter(Boolean))).sort();
    const listingCount = suggestions.reduce((sum, row) => sum + (mode === "sale" ? row.saleListings : row.listings), 0);
    const medians = suggestions.map((row) => mode === "sale" ? row.saleMedian : row.medianDaily).filter(Boolean);
    const averages = suggestions.map((row) => mode === "sale" ? row.saleAverage : row.averageDaily).filter(Boolean);
    const happiness = suggestions.map((row) => row.happy).filter(Boolean);
    const min = minNumber(suggestions.map((row) => mode === "sale" ? row.saleMin : row.minDaily).filter(Boolean));
    const max = maxNumber(suggestions.map((row) => mode === "sale" ? row.saleMax : row.maxDaily).filter(Boolean));
    const action = mode === "sale" ? "scan-sale-market" : "scan-rental-market";
    const modeLabel = mode === "sale" ? "Sale" : "Rental";
    return `<section class="tf-page">${tfPageTitle("market", "Market Comparisons", "Rental and sale comparisons are separate and only include properties that are not rented or listed.")}
      <div class="tf-filter-row"><div class="tf-segmented tf-market-mode">${tfSegmentButton("marketMode", "rent", "key", "Rental Comparison", mode)}${tfSegmentButton("marketMode", "sale", "money", "Sale Comparison", mode)}</div><div class="tf-segmented">${tfSegmentButton("marketScope", "mine", "home", "My Properties", ui.marketScope)}${tfSegmentButton("marketScope", "spouse", "heart", "Spouse Properties", ui.marketScope)}${tfSegmentButton("marketScope", "all", "list", "All Properties", ui.marketScope)}</div><select data-ui-field="marketType"><option value="all">All Types</option>${types.map((type) => `<option value="${escapeAttr(type)}"${ui.marketType === type ? " selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select><button class="tf-primary" type="button" data-action="${action}"${state.syncState === "syncing" ? " disabled" : ""}>${tfIcon("sync")} ${state.syncState === "syncing" ? "Scanning…" : `Refresh ${modeLabel}`}</button></div>
      <div class="tf-main-sidebar"><div><div class="tf-summary-strip tf-market-summary">${tfMetric("home", tfNumber(listingCount), `${modeLabel} Comparable Listings`)}${tfMetric("money", tfMoney(medianNumber(medians)), `Median ${mode === "sale" ? "Sale Price" : "Rent / Day"}`, "success")}${tfMetric("insights", tfMoney(averageNumber(averages)), `Average ${mode === "sale" ? "Sale Price" : "Rent / Day"}`, "info")}${tfMetric("tag", min && max ? `${money(min)} – ${money(max)}` : "Unavailable", "Typical Range", "warning")}${tfMetric("heart", happiness.length ? tfNumber(Math.round(averageNumber(happiness))) : "Unavailable", "Typical Happiness")}</div><div class="tf-market-list">${suggestions.length ? suggestions.map((row) => tfMarketAdvisorCard(row, mode)).join("") : tfEmpty(`No eligible ${modeLabel.toLowerCase()} comparisons`, "Rented and already-listed properties are skipped. Refresh after a property becomes available.", `<button class="tf-primary" type="button" data-action="${action}"${state.syncState === "syncing" ? " disabled" : ""}>${state.syncState === "syncing" ? "Scanning…" : `Refresh ${modeLabel}`}</button>`)}</div></div><aside class="tf-sidebar">${tfMarketSidebar(model, suggestions, mode)}</aside></div>
    </section>`;
  }

  function tfMarketAdvisorCard(row, mode = "rent") {
    const property = row.property;
    const difference = row.suggestedDaily && row.currentDaily ? row.suggestedDaily - row.currentDaily : 0;
    const percent = difference && row.currentDaily ? (difference / row.currentDaily) * 100 : 0;
    const upgradeText = row.upgrades.length ? `${row.upgrades.length} upgrade${row.upgrades.length === 1 ? "" : "s"}` : "No upgrade data";
    const isSale = mode === "sale";
    const action = isSale ? row.saleAction : row.action;
    const basis = isSale ? row.saleBasis : row.basis;
    const confidence = isSale ? row.saleConfidence : row.confidence;
    const priceGrid = isSale
      ? `<div class="tf-price-grid"><span>Known Property Value<strong>${escapeHtml(tfMoney(property && property.marketValue))}</strong></span><span>Market Median (similar)<strong>${escapeHtml(tfMoney(row.saleMedian))}</strong></span><span>Market Average (similar)<strong>${escapeHtml(tfMoney(row.saleAverage))}</strong></span><span>Market Range<strong>${row.saleMin && row.saleMax ? `${escapeHtml(money(row.saleMin))} – ${escapeHtml(money(row.saleMax))}` : "Unavailable"}</strong></span><span class="tf-suggested"><small>Suggested sale price</small><strong>${escapeHtml(tfMoney(row.suggestedSale))}</strong></span></div>`
      : `<div class="tf-price-grid"><span>Current Rent / Day<strong>${escapeHtml(tfMoney(row.currentDaily))}</strong></span><span>Market Median (similar)<strong>${escapeHtml(tfMoney(row.medianDaily))}</strong></span><span>Market Average (similar)<strong>${escapeHtml(tfMoney(row.averageDaily))}</strong></span><span>Market Range<strong>${row.minDaily && row.maxDaily ? `${escapeHtml(money(row.minDaily))} – ${escapeHtml(money(row.maxDaily))}` : "Unavailable"}</strong></span><span>Competitive Duration<strong>${row.suggestedDays ? `${tfNumber(row.suggestedDays)} days` : "Unavailable"}</strong></span><span>Contract Total<strong>${escapeHtml(tfMoney(row.suggestedTotal))}</strong></span><span>ROI Target (${escapeHtml(String(targetAnnualRoi()))}%)<strong>${escapeHtml(tfMoney(row.targetDaily))}</strong></span><span class="tf-suggested"><small>List it at</small><strong>${escapeHtml(tfMoney(row.suggestedDaily, " / day"))}${row.suggestedDays ? ` for ${tfNumber(row.suggestedDays)} days` : ""}</strong>${difference ? `<em class="${difference > 0 ? "is-success" : "is-urgent"}">${difference > 0 ? "+" : ""}${money(difference)} (${percent > 0 ? "+" : ""}${percent.toFixed(1)}%)</em>` : ""}</span></div>`;
    return `<article class="tf-market-card"><div class="tf-market-top"><div class="tf-market-property">${property && property.image ? `<img src="${escapeAttr(property.image)}" alt="">` : `<div class="tf-image-placeholder">${tfIcon("home")}</div>`}<div><span class="tf-market-eyebrow">${isSale ? "Sale" : "Rental"} comparison</span><h2>${escapeHtml(row.name)}</h2><div class="tf-badges">${tfOwnershipBadge(row.ownership)}${property ? tfStatusBadge(property.status) : ""}</div><small>${property ? escapeHtml(property.type) : "Property"}</small><div class="tf-property-quality"><span>${tfIcon("heart")} <strong>${row.happy ? tfNumber(row.happy) : "Unavailable"}</strong><small>Happiness</small></span><span>${tfIcon("tag")} <strong>${escapeHtml(upgradeText)}</strong><small>Installed</small></span></div><div class="tf-market-action">${tfIcon("idea")}<span><small>Suggested action</small><strong>${escapeHtml(action)}</strong></span></div></div></div>${priceGrid}<div class="tf-pricing-factors"><h3>Why this price?</h3><span><b>${tfIcon("heart")} Happiness</b><em>${row.happy ? "Included" : "Unavailable"}</em></span><span><b>${tfIcon("tag")} Upgrades</b><em>${row.upgrades.length ? `All ${row.upgrades.length} included` : "Unavailable"}</em></span><span><b>${tfIcon("market")} Market match</b><em>${escapeHtml(basis)}</em></span>${isSale ? "" : `<span><b>${tfIcon("calendar")} Lease length</b><em>${escapeHtml(row.durationBasis)}</em></span><span><b>${tfIcon("money")} ROI target</b><em>${escapeHtml(String(targetAnnualRoi()))}%</em></span>`}<span><b>${tfIcon("insights")} Confidence</b><em class="tf-confidence is-${escapeAttr(confidence.toLowerCase())}">${escapeHtml(confidence)}</em></span></div></div>${tfMarketUpgrades(row.upgrades)}${tfComparableListings(row, mode)}</article>`;
  }

  function tfMarketUpgrades(upgrades) {
    const rows = modificationNames(upgrades);
    if (!rows.length) return `<div class="tf-market-upgrades is-empty"><div><strong>${tfIcon("tag")} Installed upgrades</strong><small>Torn did not return upgrade names for this property, so upgrade matching is unavailable.</small></div></div>`;
    return `<div class="tf-market-upgrades"><div><strong>${tfIcon("tag")} Installed upgrades</strong><small>These ${rows.length} upgrade${rows.length === 1 ? " is" : "s are"} included in comparable matching.</small></div><div class="tf-chip-list">${rows.map((value) => `<span>${escapeHtml(value)}</span>`).join("")}</div></div>`;
  }

  function tfComparableListings(row, mode = "rent") {
    const isSale = mode === "sale";
    const rows = (isSale ? row.saleComparables : row.comparables).slice(0, 12);
    const listingCount = isSale ? row.saleListings : row.listings;
    const summary = listingCount ? `${listingCount.toLocaleString()} matching ${isSale ? "sale" : "rental"} listings informed this comparison.` : `No comparable ${isSale ? "sale" : "rental"} listings were returned.`;
    const note = !isSale && row.note ? `<small>${escapeHtml(row.note)}</small>` : "";
    if (!rows.length) return `<div class="tf-comparable-note"><strong>Comparable Listings</strong><span>${summary}</span>${note}</div>`;
    const valueHeaders = isSale ? "<th>Sale Price</th>" : "<th>Rent / Day</th><th>Days</th><th>Total</th>";
    return `<details class="tf-comparable-note"><summary><strong>Comparable Listings</strong><span>${summary}</span><b>View ${rows.length}</b></summary>${note}<div class="tf-comparable-scroll"><table><thead><tr><th>Property</th><th>Happiness</th><th>Upgrades</th>${valueHeaders}<th>Match</th></tr></thead><tbody>${rows.map((item) => {
      const upgrades = modificationNames(item.upgrades || item.modifications).join(", ") || "None listed";
      const score = Number(item.match_score);
      const values = isSale ? `<td>${escapeHtml(tfMoney(moneyNumber(item.sale_price || item.total)))}</td>` : `<td>${escapeHtml(tfMoney(moneyNumber(item.rent_per_day || item.daily)))}</td><td>${item.lease_days ? tfNumber(item.lease_days) : "Unknown"}</td><td>${escapeHtml(tfMoney(moneyNumber(item.total)))}</td>`;
      return `<tr><td>${escapeHtml(clean(item.property, row.name))}</td><td>${item.happy ? tfNumber(item.happy) : "Unavailable"}</td><td title="${escapeAttr(upgrades)}">${escapeHtml(upgrades)}</td>${values}<td><span class="tf-confidence is-${escapeAttr(clean(item.match_quality, isSale ? row.saleConfidence : row.confidence).toLowerCase())}">${Number.isFinite(score) ? `${score.toFixed(0)}%` : escapeHtml(clean(item.match_quality, isSale ? row.saleConfidence : row.confidence))}</span></td></tr>`;
    }).join("")}</tbody></table></div></details>`;
  }

  function tfMarketSidebar(model, suggestions, mode = "rent") {
    const isSale = mode === "sale";
    const byType = new Map();
    for (const row of model.marketSummary) {
      const name = clean(row.property_type || row.property, "Unknown");
      const count = Number(isSale ? row.sale_listings : row.rental_listings || row.listings || 0);
      byType.set(name, Math.max(byType.get(name) || 0, count));
    }
    const opportunities = suggestions.filter((row) => isSale ? row.suggestedSale : row.suggestedDaily && (!row.currentDaily || Math.abs(row.suggestedDaily - row.currentDaily) / row.suggestedDaily >= 0.08));
    const calculator = isSale ? `<section class="tf-card"><div class="tf-card-head"><h2>${tfIcon("money")} Sale Pricing</h2></div><small>Sale comparisons use matching property type, Happiness and installed upgrades. Rental ROI does not influence sale prices.</small></section>` : `<section class="tf-card"><div class="tf-card-head"><h2>${tfIcon("money")} ROI Calculator</h2></div><label>Target Annual ROI<input type="number" min="0.1" max="500" step="0.1" data-setting-field="targetAnnualRoi" value="${escapeAttr(targetAnnualRoi())}"></label><label>Lease Duration<input type="number" min="1" max="100" step="1" data-setting-field="defaultSuggestionLeaseDays" value="${escapeAttr(defaultSuggestionLeaseDays())}"></label><small>Property-specific investment values can be reviewed in Settings and property details.</small></section>`;
    return `<section class="tf-card"><div class="tf-card-head"><h2>${tfIcon("market")} ${isSale ? "Sale" : "Rental"} Market Summary</h2></div><div class="tf-kv-list"><span><b>Total Comparable Listings</b><strong>${tfNumber([...byType.values()].reduce((sum, value) => sum + value, 0))}</strong></span>${Array.from(byType.entries()).slice(0, 7).map(([type, count]) => `<span><b>${escapeHtml(type)}</b><strong>${tfNumber(count)}</strong></span>`).join("")}</div></section>${calculator}<section class="tf-card"><div class="tf-card-head"><h2>${tfIcon("idea")} ${isSale ? "Sale" : "Rental"} Opportunities</h2></div>${opportunities.length ? opportunities.slice(0, 5).map((row) => `<button class="tf-opportunity" type="button" data-action="open-property" data-property-key="${escapeAttr(row.property && row.property.key || "")}"><span><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(isSale ? row.saleAction : row.action)}</small></span><b>›</b></button>`).join("") : tfEmpty("No strong opportunities", "More market data may reveal pricing opportunities.")}</section>`;
  }

  function tfArchiveHtml(model) {
    const ui = tfUi();
    const rows = model.archive.filter((row) => {
      const query = normalizeLookup(ui.archiveSearch);
      if (query && ![row.property, row.propertyId, row.owner, row.tenant].join(" ").toLowerCase().includes(query)) return false;
      if (ui.archiveOwner !== "all" && row.ownership !== ui.archiveOwner) return false;
      if (ui.archiveType !== "all" && !normalizeLookup(row.status).includes(normalizeLookup(ui.archiveType))) return false;
      return true;
    });
    const metadata = serverHistoryMetadata();
    return `<section class="tf-page">${tfPageTitle("archive", "Archive", "View past rental contracts and saved property history.")}
      <div class="tf-filter-row"><input class="tf-search-wide" type="search" data-ui-field="archiveSearch" placeholder="Search by property, tenant, owner or ID…" value="${escapeAttr(ui.archiveSearch)}"><select data-ui-field="archiveOwner"><option value="all">All Owners</option><option value="mine"${ui.archiveOwner === "mine" ? " selected" : ""}>My Properties</option><option value="spouse"${ui.archiveOwner === "spouse" ? " selected" : ""}>Spouse Properties</option><option value="third-party"${ui.archiveOwner === "third-party" ? " selected" : ""}>Third Party</option></select><select data-ui-field="archiveType"><option value="all">All Record Types</option><option value="expired">Expired Rentals</option><option value="sold">Sold Properties</option></select></div>
      <div class="tf-main-sidebar"><div class="tf-archive-list">${rows.length ? rows.map(tfArchiveCard).join("") : tfEmpty("No archived records", historyEmptyMessage(metadata), `<button class="tf-primary" type="button" data-action="refresh-user-details">Sync History</button>`)}</div><aside class="tf-sidebar"><section class="tf-card"><div class="tf-card-head"><h2>${tfIcon("archive")} Archive Summary</h2></div><div class="tf-archive-summary">${tfMetric("archive", tfNumber(model.archive.length), "Total Archived Records")}${tfMetric("alert", tfNumber(model.archive.filter((row) => /expired|ended/i.test(row.status)).length), "Expired Rentals", "danger")}${tfMetric("home", tfNumber(model.archive.filter((row) => /sold/i.test(row.status)).length), "Sold Properties")}</div></section><section class="tf-card"><div class="tf-card-head"><h2>${tfIcon("activity")} Recent Archive Activity</h2></div>${tfActivityList(model.activities.filter((row) => /archiv|sold|expired/i.test(row.type)).slice(0, 6))}</section></aside></div>
    </section>`;
  }

  function tfArchiveCard(row) {
    const endedAgo = row.endDate ? tfRelative(row.endDate) : "End date unavailable";
    return `<article class="tf-archive-card">${row.image ? `<img src="${escapeAttr(row.image)}" alt="">` : `<div class="tf-image-placeholder">${tfIcon("archive")}</div>`}<div class="tf-archive-property"><h2>${escapeHtml(row.property)}${row.propertyId && !row.property.includes(row.propertyId) ? ` <small>#${escapeHtml(row.propertyId)}</small>` : ""}</h2><div class="tf-badges">${tfStatusBadge(/sold/i.test(row.status) ? "sold" : "expired")}${tfOwnershipBadge(row.ownership)}</div><small>${escapeHtml(row.property)}</small></div><div class="tf-archive-facts"><span><b>${row.tenant ? "Tenant" : "Owner"}</b><strong>${escapeHtml(row.tenant || row.owner || "Unavailable")}</strong></span><span><b>Rent / Day</b><strong>${escapeHtml(tfMoney(row.daily))}</strong></span><span><b>Total Contract</b><strong>${escapeHtml(tfMoney(row.total))}</strong></span><span><b>Started</b><strong>${escapeHtml(tfDate(row.startDate))}</strong></span></div><div class="tf-archive-ended"><span>Ended</span><strong>${escapeHtml(tfDate(row.endDate))}</strong><b>${escapeHtml(endedAgo)}</b><small>${escapeHtml(row.status)}</small></div><div class="tf-card-actions"><button type="button" data-action="open-property" data-property-key="${escapeAttr(row.propertyId ? `property:${row.propertyId}` : "")}">View Property</button><button class="tf-primary" type="button" data-action="open-archive" data-contract-id="${escapeAttr(row.contractId)}">View Details →</button></div></article>`;
  }

  function tfInsightsHtml(model) {
    const ui = tfUi();
    const properties = model.properties.filter((row) => (ui.insightOwner === "all" || row.ownership === ui.insightOwner) && (ui.insightType === "all" || row.type === ui.insightType));
    const active = model.activeRentals.filter((row) => properties.some((property) => property.key === row.propertyKey));
    const value = properties.reduce((sum, row) => sum + Number(row.marketValue || row.investment || 0), 0);
    const daily = active.filter((row) => row.direction === "out").reduce((sum, row) => sum + Number(row.daily || 0), 0);
    const types = Array.from(new Set(model.properties.map((row) => row.type).filter(Boolean))).sort();
    const breakdown = tfTypeBreakdown(properties);
    const owned = properties.filter((row) => row.ownership !== "third-party");
    const rentedCount = owned.filter((row) => row.status === "rented").length;
    const occupancy = owned.length ? Math.round((rentedCount / owned.length) * 100) : 0;
    return `<section class="tf-page">${tfPageTitle("insights", "Insights", "Analyse current portfolio performance, rental income and supported history.", `<div class="tf-title-filters"><select data-ui-field="insightOwner"><option value="all">All Owners</option><option value="mine"${ui.insightOwner === "mine" ? " selected" : ""}>My Properties</option><option value="spouse"${ui.insightOwner === "spouse" ? " selected" : ""}>Spouse Properties</option></select><select data-ui-field="insightType"><option value="all">All Types</option>${types.map((type) => `<option value="${escapeAttr(type)}"${ui.insightType === type ? " selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></div>`)}
      <div class="tf-kpi-row">${tfMetric("money", tfMoney(value), "Known Portfolio Value", "success")}${tfMetric("money", tfMoney(daily), "Daily Rental Income", "success")}${tfMetric("property", tfNumber(properties.length), "Total Properties")}${tfMetric("key", tfNumber(rentedCount), "Rented Properties", "info")}${tfMetric("home", tfNumber(owned.filter((row) => row.status === "available").length), "Available Properties")}${tfMetric("tag", tfNumber(owned.filter((row) => row.status === "listed").length), "Listed Properties", "warning")}</div>
      <div class="tf-insights-grid"><section class="tf-card tf-chart-empty"><div class="tf-card-head"><h2>${tfIcon("money")} Rental Income Trend</h2></div>${tfEmpty("More history is needed", "Tornfolio will not invent a monthly income trend. This chart appears when dated income snapshots are available.")}</section><section class="tf-card"><div class="tf-card-head"><h2>${tfIcon("property")} Property Type Breakdown</h2></div>${tfBreakdownBars(breakdown, properties.length)}</section><section class="tf-card tf-occupancy"><div class="tf-card-head"><h2>${tfIcon("key")} Occupancy Rate</h2></div><div class="tf-donut" style="--tf-percent:${occupancy}"><strong>${occupancy}%</strong><span>Rented</span></div><div class="tf-kv-list"><span><b>Rented</b><strong>${rentedCount}</strong></span><span><b>Available</b><strong>${owned.filter((row) => row.status === "available").length}</strong></span><span><b>Listed</b><strong>${owned.filter((row) => row.status === "listed").length}</strong></span></div></section><section class="tf-card tf-wide-card"><div class="tf-card-head"><h2>${tfIcon("trophy")} Top Performing Properties</h2></div>${tfTopProperties(active)}</section><section class="tf-card"><div class="tf-card-head"><h2>${tfIcon("insights")} Income Comparison</h2></div>${tfOwnerIncome(active)}</section><section class="tf-card"><div class="tf-card-head"><h2>${tfIcon("money")} Portfolio Value by Type</h2></div>${tfValueByType(properties)}</section><section class="tf-card"><div class="tf-card-head"><h2>${tfIcon("activity")} Contract Durations</h2></div>${tfDurationBars(active)}</section><section class="tf-card tf-wide-card"><div class="tf-card-head"><h2>${tfIcon("idea")} Key Insights</h2></div>${tfKeyInsights(model, occupancy, daily)}</section></div>
    </section>`;
  }

  function tfTypeBreakdown(properties) {
    const counts = new Map();
    properties.forEach((row) => counts.set(row.type, (counts.get(row.type) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }

  function tfBreakdownBars(rows, total) {
    if (!rows.length) return tfEmpty("No property data", "Sync Tornfolio to analyse your property types.");
    return `<div class="tf-bars">${rows.map(([label, value], index) => `<div><span>${escapeHtml(label)}</span><i style="--tf-bar:${total ? Math.round((value / total) * 100) : 0}%;--tf-index:${index}"></i><strong>${value} · ${total ? Math.round((value / total) * 100) : 0}%</strong></div>`).join("")}</div>`;
  }

  function tfTopProperties(active) {
    const rows = [...active].filter((row) => row.direction === "out").sort((a, b) => Number(b.daily) - Number(a.daily)).slice(0, 6);
    if (!rows.length) return tfEmpty("No rental income yet", "Active renting-out contracts appear here.");
    return `<div class="tf-ranking">${rows.map((row) => `<button type="button" data-action="open-rental" data-contract-id="${escapeAttr(row.contractId)}">${row.image ? `<img src="${escapeAttr(row.image)}" alt="">` : ""}<strong>${escapeHtml(row.property)}</strong><span>${escapeHtml(row.type)}</span><b>${escapeHtml(tfMoney(row.daily, " / day"))}</b><em>${row.remaining === "" ? "Unknown" : `${row.remaining} days`}</em></button>`).join("")}</div>`;
  }

  function tfOwnerIncome(active) {
    const mine = active.filter((row) => row.direction === "out" && row.ownership === "mine").reduce((sum, row) => sum + Number(row.daily || 0), 0);
    const spouse = active.filter((row) => row.direction === "out" && row.ownership === "spouse").reduce((sum, row) => sum + Number(row.daily || 0), 0);
    const max = Math.max(mine, spouse, 1);
    return `<div class="tf-comparison"><div><span>My Properties</span><i style="--tf-bar:${(mine / max) * 100}%"></i><strong>${tfMoney(mine)}</strong></div><div class="is-spouse"><span>Spouse Properties</span><i style="--tf-bar:${(spouse / max) * 100}%"></i><strong>${tfMoney(spouse)}</strong></div></div>`;
  }

  function tfValueByType(properties) {
    const values = new Map();
    properties.forEach((row) => values.set(row.type, (values.get(row.type) || 0) + Number(row.marketValue || row.investment || 0)));
    const rows = Array.from(values.entries()).filter(([, value]) => value).sort((a, b) => b[1] - a[1]);
    if (!rows.length) return tfEmpty("Values unavailable", "Known market or investment values will appear here.");
    const max = Math.max(...rows.map(([, value]) => value), 1);
    return `<div class="tf-comparison">${rows.map(([type, value]) => `<div><span>${escapeHtml(type)}</span><i style="--tf-bar:${(value / max) * 100}%"></i><strong>${escapeHtml(tfMoney(value))}</strong></div>`).join("")}</div>`;
  }

  function tfDurationBars(active) {
    const buckets = [["< 7", 0, 6], ["7 – 30", 7, 30], ["31 – 60", 31, 60], ["61 – 90", 61, 90], ["91 – 180", 91, 180], ["> 180", 181, Infinity]];
    const counts = buckets.map(([label, min, max]) => [label, active.filter((row) => Number(row.remaining) >= min && Number(row.remaining) <= max).length]);
    const peak = Math.max(...counts.map(([, count]) => count), 1);
    return `<div class="tf-duration-bars">${counts.map(([label, count], index) => `<div><i style="--tf-height:${Math.max(6, Math.round((count / peak) * 100))}%;--tf-index:${index}"></i><strong>${count}</strong><span>${escapeHtml(label)}</span></div>`).join("")}</div>`;
  }

  function tfKeyInsights(model, occupancy, daily) {
    const attention = tfAttention(model);
    const rows = [];
    rows.push({ title: `${occupancy}% current occupancy`, detail: `${model.activeRentals.filter((row) => row.direction === "out").length} owned rental contracts are active.` });
    if (daily) rows.push({ title: `${money(daily)} daily rental income`, detail: "Calculated from current renting-out contracts." });
    attention.slice(0, 3).forEach((row) => rows.push({ title: row.title, detail: row.detail }));
    return `<div class="tf-insight-list">${rows.map((row) => `<div>${tfIcon("idea")}<strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.detail)}</small></div>`).join("")}</div>`;
  }

  function tfSettingsModalHtml() {
    const settings = appSettings();
    const keyMask = maskedApiKey();
    return `<div class="tlt-modal-backdrop tf-modal-backdrop" data-action="close-settings"><div class="tlt-modal tf-modal tf-settings-modal" role="dialog" aria-modal="true" aria-label="Tornfolio settings" data-modal-stop><div class="tlt-modal-head"><div><strong>Settings</strong><span>Account, market, data and advanced controls.</span></div><button class="tf-icon-button" type="button" data-action="close-settings" aria-label="Close settings">${tfIcon("close")}</button></div><div class="tf-settings-body">
      <section><h2>Account / Torn API</h2><p>Your public Torn key is used to verify your account and fetch portfolio data.</p><label>Torn public key<input type="text" data-api-key-input placeholder="${keyMask ? "Paste a new key to replace the saved key" : "Paste key here"}" autocomplete="off" spellcheck="false"></label>${keyMask ? `<small>Saved key: ${escapeHtml(keyMask)}</small>` : `<small>No key saved.</small>`}${subscriptionStatusHtml()}<div class="tf-button-row"><button class="tf-primary" type="button" data-action="save-api-key">Save Key</button><button type="button" data-action="check-key">Test Key</button><button type="button" data-action="verify-hosted-access">Check Subscription</button><button class="tf-danger" type="button" data-action="clear-key">Clear Key</button></div></section>
      <section><h2>Market &amp; ROI</h2><label>Target annual ROI %<input type="number" min="0.1" max="500" step="0.1" data-setting-field="targetAnnualRoi" value="${escapeAttr(targetAnnualRoi())}"></label><label>Suggested lease duration (days)<input type="number" min="1" max="100" step="1" data-setting-field="defaultSuggestionLeaseDays" value="${escapeAttr(defaultSuggestionLeaseDays())}"></label></section>
      <section><h2>Data / Sync</h2><label>Torn call speed<select data-setting-field="tornRateLimitPerMinute">${tornRateLimitOptionsHtml()}</select></label><label>Property history depth<select data-setting-field="propertyHistoryPages">${propertyHistoryPagesOptionsHtml()}</select></label><label class="tf-check"><input type="checkbox" data-setting-field="allowDirectTornFallback"${settings.allowDirectTornFallback ? " checked" : ""}><span>Use direct Torn fallback if the hosted sync is unavailable</span></label></section>
      <section><h2>Display</h2><label>Rows in large data tables<input type="number" min="10" max="250" step="5" data-setting-field="tableLimit" value="${escapeAttr(tableLimit())}"></label><button type="button" data-action="reset-position">Reset window position and size</button><div class="tf-cache-control"><span><strong>Interface SVG icons</strong><small>${escapeHtml(iconCacheStatusText())}</small></span><button type="button" data-action="clear-icon-cache"${ensureIconCacheLoaded() ? "" : " disabled"}>Clear icon cache</button></div></section>
      <section><h2>Backup / Restore</h2><p>Backups preserve contracts, archive, history snapshots, settings and investment values. Keys and session tokens stay on this device.</p><div class="tf-button-row"><button type="button" data-action="export-json">Download Backup</button><label class="tf-file-button"><input type="file" data-action="import-json" accept="application/json" hidden><button type="button" data-action="pick-json">Restore Backup</button></label></div></section>
      <details><summary>Advanced</summary><section><label class="tf-check"><input type="checkbox" data-setting-field="showRawJson"${settings.showRawJson ? " checked" : ""}><span>Show raw Torn response text in legacy tools</span></label><div class="tf-button-row"><button type="button" data-action="import-owned-direct">Reload directly from Torn</button><button class="tf-danger" type="button" data-action="clear-data">Delete all Tornfolio data</button></div><small>Hosted endpoint: ${escapeHtml(HOSTED_API_BASE)}. Normal users do not need to change this.</small></section></details>
    </div></div></div>`;
  }

  function tfDetailModalHtml(model) {
    const detail = state.detailView || {};
    if (detail.kind === "property") {
      const property = model.properties.find((row) => row.key === detail.id);
      if (!property) return tfMissingDetailModal("Property unavailable", "That property is not present in the latest portfolio data.");
      const history = model.archive.filter((row) => row.propertyId && row.propertyId === property.id);
      const contracts = model.activeRentals.filter((row) => row.propertyKey === property.key);
      return `<div class="tlt-modal-backdrop tf-modal-backdrop" data-action="close-detail"><div class="tlt-modal tf-modal tf-detail-modal" role="dialog" aria-modal="true" aria-label="Property details" data-modal-stop><div class="tlt-modal-head"><div><strong>${escapeHtml(property.name)}</strong><span>${property.id ? `Property #${escapeHtml(property.id)} · ` : ""}${escapeHtml(property.type)}</span></div><button class="tf-icon-button" type="button" data-action="close-detail" aria-label="Close property details">${tfIcon("close")}</button></div><div class="tf-detail-body">${property.image ? `<img class="tf-detail-image" src="${escapeAttr(property.image)}" alt="${escapeAttr(property.type)}">` : ""}<div class="tf-badges">${tfOwnershipBadge(property.ownership)}${tfStatusBadge(property.status)}</div><div class="tf-detail-grid"><div><span>Owner</span><strong>${escapeHtml(property.owner)}</strong></div><div><span>Happiness</span><strong>${property.happy ? tfNumber(property.happy) : "Unavailable"}</strong></div><div><span>Known Upgrades</span><strong>${property.upgrades.length ? property.upgrades.length : "Unavailable"}</strong></div><div><span>Residents</span><strong>${escapeHtml(property.residents.join(", ") || "Unavailable")}</strong></div><div><span>Daily Upkeep</span><strong>${escapeHtml(tfMoney(property.upkeep))}</strong></div><div><span>Market Value</span><strong>${escapeHtml(tfMoney(property.marketValue))}</strong></div><div><span>Investment Basis</span><strong>${escapeHtml(tfMoney(property.investment))}</strong></div></div>${property.upgrades.length ? `<section><h2>Upgrades / Modifications</h2><div class="tf-chip-list">${property.upgrades.map((value) => `<span>${escapeHtml(value)}</span>`).join("")}</div></section>` : ""}<section><h2>Current Rental</h2>${contracts.length ? contracts.map(tfRentalCard).join("") : tfEmpty("No active rental", "This property has no active rental contract in the latest data.")}</section><section><h2>Rental History</h2>${history.length ? history.map(tfArchiveCard).join("") : tfEmpty("No rental history", "Archived contracts for this property will appear after history has been synced.")}</section></div></div></div>`;
    }
    if (detail.kind === "rental") {
      const contract = model.activeRentals.find((row) => row.contractId === detail.id);
      if (!contract) return tfMissingDetailModal("Rental unavailable", "That active contract is no longer present.");
      return tfContractDetailModal(contract, "Active Rental");
    }
    if (detail.kind === "archive") {
      const contract = model.archive.find((row) => row.contractId === detail.id);
      if (!contract) return tfMissingDetailModal("Archive record unavailable", "That archived record is no longer present.");
      return tfContractDetailModal({ ...contract, propertyKey: contract.propertyId ? `property:${contract.propertyId}` : "", remaining: "", daily: contract.daily, total: contract.total, direction: contract.ownership === "third-party" ? "from" : "out" }, "Archived Rental");
    }
    return "";
  }

  function tfContractDetailModal(contract, title) {
    return `<div class="tlt-modal-backdrop tf-modal-backdrop" data-action="close-detail"><div class="tlt-modal tf-modal tf-detail-modal" role="dialog" aria-modal="true" aria-label="Rental details" data-modal-stop><div class="tlt-modal-head"><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(contract.property)}</span></div><button class="tf-icon-button" type="button" data-action="close-detail" aria-label="Close rental details">${tfIcon("close")}</button></div><div class="tf-detail-body">${contract.image ? `<img class="tf-detail-image" src="${escapeAttr(contract.image)}" alt="">` : ""}<div class="tf-badges">${tfOwnershipBadge(contract.ownership, contract.direction === "from")}${tfStatusBadge(title.startsWith("Archived") ? "expired" : "active")}</div><div class="tf-detail-grid"><div><span>Property ID</span><strong>${escapeHtml(contract.propertyId || "Unavailable")}</strong></div><div><span>${contract.direction === "out" ? "Tenant" : "Owner"}</span><strong>${escapeHtml(contract.direction === "out" ? contract.tenant : contract.owner)}</strong></div><div><span>Rent / Day</span><strong>${escapeHtml(tfMoney(contract.daily))}</strong></div><div><span>Total Contract</span><strong>${escapeHtml(tfMoney(contract.total))}</strong></div><div><span>Start Date</span><strong>${escapeHtml(tfDate(contract.startDate))}</strong></div><div><span>End Date</span><strong>${escapeHtml(tfDate(contract.endDate))}</strong></div><div><span>Duration</span><strong>${contract.duration !== "" ? `${tfNumber(contract.duration)} days` : "Unavailable"}</strong></div><div><span>Remaining</span><strong>${contract.remaining !== "" ? `${tfNumber(contract.remaining)} days` : "Finished / unavailable"}</strong></div></div>${contract.notes ? `<section><h2>Notes</h2><p>${escapeHtml(contract.notes)}</p></section>` : ""}<div class="tf-button-row">${contract.propertyKey ? `<button type="button" data-action="open-property" data-property-key="${escapeAttr(contract.propertyKey)}">View Property</button>` : ""}</div></div></div></div>`;
  }

  function tfMissingDetailModal(title, text) {
    return `<div class="tlt-modal-backdrop tf-modal-backdrop" data-action="close-detail"><div class="tlt-modal tf-modal" role="dialog" aria-modal="true" data-modal-stop><div class="tlt-modal-head"><strong>${escapeHtml(title)}</strong><button class="tf-icon-button" type="button" data-action="close-detail" aria-label="Close details">${tfIcon("close")}</button></div>${tfEmpty(title, text)}</div></div>`;
  }

  function injectVisionStyles(targetDocument = document) {
    if (targetDocument.getElementById(`${APP_ID}-vision-styles`)) return;
    const style = targetDocument.createElement("style");
    style.id = `${APP_ID}-vision-styles`;
    style.textContent = `
      #${APP_ID} {
        --tf-bg: #03131c;
        --tf-bg-deep: #020d14;
        --tf-panel: rgba(7, 31, 43, .96);
        --tf-panel-2: rgba(8, 39, 52, .88);
        --tf-border: #17465a;
        --tf-border-bright: #20718a;
        --tf-text: #ecf8ff;
        --tf-muted: #9ab4c6;
        --tf-teal: #18e4ba;
        --tf-teal-dark: #087c6a;
        --tf-blue: #49a9ff;
        --tf-purple: #e95bdd;
        --tf-amber: #ffd05a;
        --tf-red: #ff757b;
        --tf-green: #45efad;
        --tf-radius: 11px;
        left: 16px;
        bottom: 72px;
        width: min(1400px, calc(100vw - 32px));
        height: min(900px, calc(100vh - 88px));
        min-width: 700px;
        min-height: 560px;
        color: var(--tf-text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        font-size: 13px;
      }
      #${APP_ID}.is-popup { width: 100%; height: 100%; min-width: 0; min-height: 0; }
      #${APP_ID}.is-open .tlt-tab { display: none; }
      #${APP_ID}.is-open .tf-shell { height: 100%; }
      #${APP_ID} .tf-shell {
        height: calc(100% - 38px);
        min-height: 0;
        border: 1px solid var(--tf-border);
        border-radius: 14px;
        background:
          radial-gradient(circle at 18% 0%, rgba(14, 95, 111, .2), transparent 34%),
          linear-gradient(145deg, var(--tf-bg), var(--tf-bg-deep));
        box-shadow: 0 28px 80px rgba(0, 0, 0, .68);
      }
      #${APP_ID}.is-popup .tf-shell { height: 100%; border-radius: 0; }
      #${APP_ID} .tf-launcher { background: #073546; border-color: var(--tf-teal); color: var(--tf-text); }
      #${APP_ID} .tf-header {
        display: flex; align-items: center; gap: 20px; flex: 0 0 auto;
        min-height: 76px; padding: 12px 18px; border: 0; background: transparent;
      }
      #${APP_ID} .tf-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
      #${APP_ID} .tf-logo { display: grid; place-items: center; width: 46px; height: 46px; border: 2px solid var(--tf-teal); border-radius: 50%; font-size: 24px; background: rgba(20, 228, 186, .08); box-shadow: 0 0 24px rgba(20, 228, 186, .16); }
      #${APP_ID} .tf-brand div { display: grid; }
      #${APP_ID} .tf-brand strong { font-size: 27px; line-height: 1; letter-spacing: -.7px; }
      #${APP_ID} .tf-brand strong span { color: var(--tf-teal); }
      #${APP_ID} .tf-brand small { margin-top: 4px; color: #bdd0df; font-size: 12px; }
      #${APP_ID} .tf-header-actions { display: flex; align-items: center; gap: 10px; margin-left: auto; }
      #${APP_ID} .tf-sync-meta { display: flex; align-items: center; gap: 9px; color: var(--tf-muted); }
      #${APP_ID} .tf-sync-meta span { display: grid; font-size: 11px; }
      #${APP_ID} .tf-sync-meta strong { margin-top: 2px; color: var(--tf-text); font-size: 12px; }
      #${APP_ID} .tf-sync-dot { width: 9px; height: 9px; border-radius: 50%; background: #637684; box-shadow: 0 0 9px currentColor; }
      #${APP_ID} .tf-sync-dot.is-success { color: var(--tf-green); background: var(--tf-green); }
      #${APP_ID} .tf-sync-dot.is-syncing { color: var(--tf-amber); background: var(--tf-amber); animation: tfPulse 1s infinite alternate; }
      #${APP_ID} .tf-sync-dot.is-partial { color: var(--tf-amber); background: var(--tf-amber); }
      #${APP_ID} .tf-sync-dot.is-error { color: var(--tf-red); background: var(--tf-red); }
      @keyframes tfPulse { to { opacity: .35; } }
      #${APP_ID} button, #${APP_ID} input, #${APP_ID} select, #${APP_ID} textarea { border: 1px solid var(--tf-border); background: #092535; color: var(--tf-text); border-radius: 8px; }
      #${APP_ID} button { transition: border-color .15s, background .15s, transform .15s; }
      #${APP_ID} button:has(> .tf-icon) { display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
      #${APP_ID} button:hover { border-color: var(--tf-teal); background: #0d3444; }
      #${APP_ID} .tf-sync-button, #${APP_ID} button.tf-primary { border-color: #10a888; background: linear-gradient(180deg, #0c886f, #076955); color: #f2fffc; }
      #${APP_ID} .tf-sync-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 150px; padding: 10px 18px; font-size: 14px; }
      #${APP_ID} button.tf-primary:hover { background: linear-gradient(180deg, #10a888, #087961); }
      #${APP_ID} button.tf-danger { border-color: #a5424b; background: #5f252d; }
      #${APP_ID} .tf-icon-button { display: grid; place-items: center; width: 42px; min-width: 42px; height: 42px; padding: 0; font-size: 19px; }
      #${APP_ID} .tf-nav {
        display: grid; grid-template-columns: repeat(6, minmax(105px, 1fr));
        flex: 0 0 auto; margin: 0 18px; border: 1px solid var(--tf-border); border-radius: var(--tf-radius);
        background: rgba(10, 37, 51, .88); overflow: hidden;
      }
      #${APP_ID} .tf-nav button { position: relative; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; border: 0; border-radius: 0; background: transparent; color: #b8cee0; font-size: 14px; }
      #${APP_ID} .tf-nav button .tf-icon { color: #afcaff; }
      #${APP_ID} .tf-nav-label { color: inherit; }
      #${APP_ID} .tf-nav button.is-active { background: linear-gradient(180deg, rgba(20, 228, 186, .13), rgba(20, 228, 186, .04)); color: var(--tf-teal); }
      #${APP_ID} .tf-nav button.is-active::after { content: ""; position: absolute; left: 18%; right: 18%; bottom: 0; height: 2px; background: var(--tf-teal); box-shadow: 0 0 12px var(--tf-teal); }
      #${APP_ID} .tf-nav button.is-active .tf-icon { color: var(--tf-teal); }
      #${APP_ID} .tf-content { flex: 1 1 auto; min-height: 0; max-height: none; overflow: auto; padding: 14px 18px 18px; border: 0; }
      #${APP_ID} .tf-page { display: grid; gap: 13px; min-width: 0; }
      #${APP_ID} .tf-card, #${APP_ID} .tf-current-home, #${APP_ID} .tf-summary-strip, #${APP_ID} .tf-property-card, #${APP_ID} .tf-rental-card, #${APP_ID} .tf-market-card, #${APP_ID} .tf-archive-card {
        border: 1px solid var(--tf-border); border-radius: var(--tf-radius); background: linear-gradient(145deg, rgba(8, 35, 47, .96), rgba(4, 24, 34, .98)); box-shadow: inset 0 1px rgba(255,255,255,.02);
      }
      #${APP_ID} .tf-card { min-width: 0; padding: 12px; }
      #${APP_ID} .tf-card-head { display: flex; align-items: center; gap: 10px; min-height: 32px; padding-bottom: 9px; border-bottom: 1px solid rgba(95, 151, 176, .22); }
      #${APP_ID} .tf-card-head h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15px; color: var(--tf-text); }
      #${APP_ID} .tf-card-head button { min-height: 30px; margin-left: auto; padding: 5px 10px; background: #0a2635; }
      #${APP_ID} .tf-icon-sprite { display: none !important; }
      #${APP_ID} .tf-icon { display: inline-block; flex: 0 0 auto; width: 18px; height: 18px; color: var(--tf-teal); fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; vertical-align: middle; overflow: visible; }
      #${APP_ID} .tf-logo .tf-icon { width: 28px; height: 28px; }
      #${APP_ID} .tf-sync-button .tf-icon, #${APP_ID} .tf-icon-button .tf-icon { color: currentColor; }
      #${APP_ID} .tf-current-home { position: relative; min-height: 185px; overflow: hidden; background-color: #062331; }
      #${APP_ID} .tf-current-home.has-image { background-image: linear-gradient(90deg, rgba(3, 20, 29, .99) 0%, rgba(3, 20, 29, .92) 34%, rgba(3, 20, 29, .22) 72%), var(--tf-hero-image); background-size: cover; background-position: center; }
      #${APP_ID} .tf-current-overlay { display: grid; align-content: space-between; gap: 9px; width: 100%; min-height: 185px; padding: 13px 16px; }
      #${APP_ID} .tf-current-home h1 { margin: 0; font-size: 24px; }
      #${APP_ID} .tf-current-home h1 small, #${APP_ID} h2 small { color: #c6d7e2; font-size: .78em; }
      #${APP_ID} .tf-badges { display: flex; flex-wrap: wrap; gap: 7px; }
      #${APP_ID} .tf-badge { display: inline-flex; align-items: center; width: max-content; min-height: 25px; margin: 0; padding: 4px 9px; border: 1px solid #159976; border-radius: 999px; background: rgba(15, 126, 99, .24); color: #63f4ca; font-size: 11px; font-weight: 700; text-transform: none; }
      #${APP_ID} .tf-owner-spouse { border-color: #bb45b9; background: rgba(187, 69, 185, .25); color: #ff9ff5; }
      #${APP_ID} .tf-owner-third { border-color: #3689c8; background: rgba(43, 119, 177, .25); color: #98d4ff; }
      #${APP_ID} .tf-status-occupied, #${APP_ID} .tf-status-rented, #${APP_ID} .tf-status-active { border-color: #258fd2; background: rgba(24, 111, 169, .25); color: #8dd2ff; }
      #${APP_ID} .tf-status-listed { border-color: #d8b52c; background: rgba(150, 119, 11, .25); color: #ffe371; }
      #${APP_ID} .tf-status-expired, #${APP_ID} .tf-status-sold { border-color: #c74f5c; background: rgba(157, 47, 59, .28); color: #ff9aa4; }
      #${APP_ID} .tf-hero-meta { display: flex; gap: 48px; margin-top: 6px; }
      #${APP_ID} .tf-hero-meta div, #${APP_ID} .tf-property-meta div, #${APP_ID} .tf-contract-grid div, #${APP_ID} .tf-detail-grid div { display: grid; gap: 4px; }
      #${APP_ID} .tf-hero-meta span, #${APP_ID} .tf-property-meta span, #${APP_ID} .tf-contract-grid span, #${APP_ID} .tf-detail-grid span { color: var(--tf-muted); font-size: 11px; }
      #${APP_ID} .tf-hero-meta strong, #${APP_ID} .tf-property-meta strong, #${APP_ID} .tf-contract-grid strong, #${APP_ID} .tf-detail-grid strong { font-size: 13px; }
      #${APP_ID} .is-success { color: var(--tf-green) !important; }
      #${APP_ID} .is-warning { color: var(--tf-amber) !important; }
      #${APP_ID} .is-urgent { color: var(--tf-red) !important; }
      #${APP_ID} .tf-two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; }
      #${APP_ID} .tf-main-sidebar { display: grid; grid-template-columns: minmax(0, 2.35fr) minmax(280px, .9fr); gap: 13px; align-items: start; }
      #${APP_ID} .tf-sidebar { display: grid; gap: 12px; min-width: 0; }
      #${APP_ID} .tf-portfolio.tf-mine { border-color: rgba(20, 228, 186, .42); background: linear-gradient(135deg, rgba(5, 55, 54, .86), rgba(4, 26, 34, .96)); }
      #${APP_ID} .tf-portfolio.tf-spouse { border-color: rgba(233, 91, 221, .4); background: linear-gradient(135deg, rgba(62, 25, 61, .85), rgba(20, 22, 37, .96)); }
      #${APP_ID} .tf-portfolio.tf-spouse .tf-card-head h2, #${APP_ID} .tf-portfolio.tf-spouse .tf-icon { color: #ff9ff5; }
      #${APP_ID} .tf-metrics, #${APP_ID} .tf-summary-strip, #${APP_ID} .tf-kpi-row { display: grid; grid-template-columns: repeat(5, minmax(110px, 1fr)); gap: 0; }
      #${APP_ID} .tf-metric { display: grid; grid-template-columns: 28px minmax(0, 1fr); align-items: center; gap: 6px; min-width: 0; min-height: 72px; padding: 8px 11px; border-right: 1px solid rgba(109, 158, 179, .2); }
      #${APP_ID} .tf-metric:last-child { border-right: 0; }
      #${APP_ID} .tf-metric div { display: grid; gap: 3px; }
      #${APP_ID} .tf-metric strong { color: var(--tf-teal); font-size: 16px; overflow-wrap: anywhere; }
      #${APP_ID} .tf-metric span { color: #c2d1dc; font-size: 11px; line-height: 1.25; }
      #${APP_ID} .tf-metric.is-info strong { color: var(--tf-blue); }
      #${APP_ID} .tf-metric.is-warning strong { color: var(--tf-amber); }
      #${APP_ID} .tf-metric.is-danger strong { color: var(--tf-red); }
      #${APP_ID} .tf-summary-strip { margin-bottom: 11px; }
      #${APP_ID} .tf-table-wrap { overflow: auto; }
      #${APP_ID} .tf-table { min-width: 720px; border-collapse: collapse; }
      #${APP_ID} .tf-table th { position: static; padding: 7px 8px; background: rgba(32, 72, 90, .35); color: #b7cbda; font-size: 11px; }
      #${APP_ID} .tf-table td { padding: 7px 8px; border-bottom: 1px solid rgba(71, 124, 146, .2); vertical-align: middle; }
      #${APP_ID} .tf-table-property { display: flex; align-items: center; gap: 8px; }
      #${APP_ID} .tf-table-property img { width: 56px; height: 34px; border-radius: 6px; object-fit: cover; }
      #${APP_ID} .tf-table-property div { display: grid; }
      #${APP_ID} .tf-table-property small { color: var(--tf-muted); }
      #${APP_ID} .tf-more { min-width: 32px; min-height: 28px; padding: 2px 7px; background: transparent; border-color: transparent; }
      #${APP_ID} .tf-count { display: inline-grid; place-items: center; min-width: 23px; height: 23px; border-radius: 7px; background: #b8474e; color: white; font-size: 12px; }
      #${APP_ID} .tf-attention-row { display: grid; grid-template-columns: 35px 1fr auto 14px; align-items: center; gap: 9px; width: 100%; min-height: 54px; padding: 7px 5px; border: 0; border-bottom: 1px solid rgba(74, 122, 143, .18); border-radius: 0; background: transparent; text-align: left; }
      #${APP_ID} .tf-attention-symbol { display: grid; place-items: center; width: 31px; height: 31px; border-radius: 50%; background: rgba(255, 208, 90, .18); color: var(--tf-amber); font-weight: 900; }
      #${APP_ID} .tf-attention-row.is-danger .tf-attention-symbol { background: rgba(255, 117, 123, .18); color: var(--tf-red); }
      #${APP_ID} .tf-attention-row span:nth-child(2) { display: grid; gap: 3px; }
      #${APP_ID} .tf-attention-row small { color: var(--tf-muted); font-size: 10px; }
      #${APP_ID} .tf-attention-row b { min-width: 23px; padding: 4px; border-radius: 7px; background: #a83f47; color: white; text-align: center; }
      #${APP_ID} .tf-activity-list { display: grid; min-width: 0; max-width: 100%; overflow: hidden; }
      #${APP_ID} .tf-activity-row { display: grid; grid-template-columns: 90px 14px minmax(120px, .55fr) minmax(180px, 1.4fr); align-items: center; gap: 9px; min-width: 0; max-width: 100%; min-height: 36px; border-bottom: 1px solid rgba(74, 122, 143, .18); }
      #${APP_ID} .tf-activity-row > * { min-width: 0; }
      #${APP_ID} .tf-activity-row strong, #${APP_ID} .tf-activity-row span { overflow-wrap: anywhere; }
      #${APP_ID} .tf-activity-row time, #${APP_ID} .tf-activity-row span { color: var(--tf-muted); font-size: 11px; }
      #${APP_ID} .tf-activity-row i { width: 8px; height: 8px; border-radius: 50%; background: var(--tf-teal); box-shadow: 0 0 9px rgba(20, 228, 186, .6); }
      #${APP_ID} .tf-sidebar .tf-activity-row { grid-template-columns: 66px 10px minmax(0, 1fr); align-items: start; padding: 7px 0; }
      #${APP_ID} .tf-sidebar .tf-activity-row span { grid-column: 3; }
      #${APP_ID} .tf-empty { display: grid; place-items: center; gap: 7px; min-height: 120px; padding: 20px; color: var(--tf-muted); text-align: center; }
      #${APP_ID} .tf-empty strong { color: var(--tf-text); font-size: 14px; }
      #${APP_ID} .tf-page-title { display: flex; align-items: center; gap: 14px; min-height: 60px; }
      #${APP_ID} .tf-page-heading { display: flex; align-items: center; gap: 13px; }
      #${APP_ID} .tf-page-heading > .tf-icon { width: 32px; height: 32px; stroke-width: 1.55; }
      #${APP_ID} .tf-page-title h1 { margin: 0; font-size: 25px; }
      #${APP_ID} .tf-page-title p { margin: 3px 0 0; color: var(--tf-muted); }
      #${APP_ID} .tf-title-filters { display: flex; gap: 9px; margin-left: auto; }
      #${APP_ID} .tf-filter-row { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; }
      #${APP_ID} .tf-filter-row > input { flex: 1 1 230px; }
      #${APP_ID} .tf-filter-row > select { flex: 0 1 170px; }
      #${APP_ID} .tf-segmented { display: flex; flex: 1 1 430px; max-width: 560px; border: 1px solid var(--tf-border); border-radius: 9px; overflow: hidden; }
      #${APP_ID} .tf-segmented button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex: 1 1 auto; min-height: 40px; border: 0; border-right: 1px solid var(--tf-border); border-radius: 0; background: rgba(9, 35, 49, .8); }
      #${APP_ID} .tf-segmented button:last-child { border-right: 0; }
      #${APP_ID} .tf-segmented button.is-active { background: linear-gradient(180deg, #0a816c, #075848); color: #dbfff7; box-shadow: inset 0 0 0 1px var(--tf-teal); }
      #${APP_ID} .tf-property-list, #${APP_ID} .tf-rental-list, #${APP_ID} .tf-market-list, #${APP_ID} .tf-archive-list { display: grid; gap: 9px; }
      #${APP_ID} .tf-property-card, #${APP_ID} .tf-rental-card { display: grid; grid-template-columns: 240px minmax(0, 1fr) 160px; min-height: 138px; overflow: hidden; }
      #${APP_ID} .tf-property-card > img, #${APP_ID} .tf-rental-card > img, #${APP_ID} .tf-image-placeholder { width: 100%; height: 100%; min-height: 138px; object-fit: cover; background: #0b2e3d; }
      #${APP_ID} .tf-image-placeholder { display: grid; place-items: center; color: var(--tf-teal); font-size: 34px; }
      #${APP_ID} .tf-image-placeholder .tf-icon { width: 38px; height: 38px; }
      #${APP_ID} .tf-property-body, #${APP_ID} .tf-rental-body { min-width: 0; padding: 12px 15px; }
      #${APP_ID} .tf-property-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
      #${APP_ID} .tf-property-head h2 { margin: 0 0 8px; font-size: 17px; }
      #${APP_ID} .tf-property-meta, #${APP_ID} .tf-contract-grid { display: flex; flex-wrap: wrap; align-items: end; gap: 14px 34px; margin-top: 14px; }
      #${APP_ID} .tf-card-actions { display: flex; flex-direction: column; justify-content: center; gap: 8px; padding: 10px; }
      #${APP_ID} .tf-card-actions button { display: inline-flex; align-items: center; justify-content: center; width: 100%; white-space: nowrap; }
      #${APP_ID} .tf-wide { width: 100%; margin-top: 7px; }
      #${APP_ID} .tf-upcoming { display: grid; }
      #${APP_ID} .tf-upcoming button { display: grid; grid-template-columns: 50px 1fr auto; align-items: center; gap: 8px; width: 100%; min-height: 50px; padding: 5px; border: 0; border-bottom: 1px solid rgba(74,122,143,.2); border-radius: 0; background: transparent; text-align: left; }
      #${APP_ID} .tf-upcoming img { width: 50px; height: 37px; border-radius: 6px; object-fit: cover; }
      #${APP_ID} .tf-upcoming span { display: grid; }
      #${APP_ID} .tf-upcoming small { color: var(--tf-muted); }
      #${APP_ID} .tf-market-summary { grid-template-columns: repeat(5, minmax(120px, 1fr)); }
      #${APP_ID} .tf-market-card { position: relative; padding: 14px; overflow: hidden; border-color: rgba(32,113,138,.72); box-shadow: inset 3px 0 var(--tf-teal), inset 0 1px rgba(255,255,255,.03), 0 12px 30px rgba(0,0,0,.16); }
      #${APP_ID} .tf-market-card::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 75px; pointer-events: none; background: linear-gradient(180deg, rgba(20,228,186,.055), transparent); }
      #${APP_ID} .tf-market-top { position: relative; display: grid; grid-template-columns: minmax(270px, 1fr) minmax(310px, 1.12fr) minmax(220px, .82fr); gap: 16px; }
      #${APP_ID} .tf-market-property { display: grid; grid-template-columns: 155px minmax(0, 1fr); gap: 14px; min-width: 0; }
      #${APP_ID} .tf-market-property > img, #${APP_ID} .tf-market-property > .tf-image-placeholder { width: 155px; height: 172px; min-height: 172px; border: 1px solid rgba(74,122,143,.35); border-radius: 10px; object-fit: cover; box-shadow: 0 10px 24px rgba(0,0,0,.28); }
      #${APP_ID} .tf-market-property h2 { margin: 4px 0 8px; font-size: 19px; }
      #${APP_ID} .tf-market-eyebrow { display: block; color: var(--tf-teal); font-size: 9px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      #${APP_ID} .tf-market-property > div > small { display: block; margin-top: 9px; color: var(--tf-muted); }
      #${APP_ID} .tf-property-quality { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 13px; }
      #${APP_ID} .tf-property-quality span { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 3px 5px; min-width: 100px; padding: 6px 8px; border: 1px solid rgba(255,121,187,.18); border-radius: 7px; background: rgba(255,121,187,.055); color: #ff79bb; }
      #${APP_ID} .tf-property-quality .tf-icon { width: 13px; height: 13px; color: #ff79bb; }
      #${APP_ID} .tf-property-quality small { grid-column: 1 / -1; }
      #${APP_ID} .tf-property-quality strong { color: var(--tf-text); }
      #${APP_ID} .tf-property-quality small { color: var(--tf-muted); font-size: 9px; }
      #${APP_ID} .tf-market-action { display: flex; align-items: center; gap: 7px; margin-top: 9px; color: var(--tf-amber); }
      #${APP_ID} .tf-market-action .tf-icon { width: 16px; height: 16px; color: var(--tf-amber); }
      #${APP_ID} .tf-market-action span { display: grid; }
      #${APP_ID} .tf-market-action small { margin: 0; color: var(--tf-muted); font-size: 9px; }
      #${APP_ID} .tf-market-action strong { color: var(--tf-text); font-size: 11px; }
      #${APP_ID} .tf-price-grid { display: grid; grid-template-columns: 1fr 1fr; align-content: start; gap: 7px; }
      #${APP_ID} .tf-price-grid > span { display: grid; align-content: center; gap: 3px; min-height: 48px; padding: 7px 9px; border: 1px solid rgba(74,122,143,.2); border-radius: 7px; background: rgba(4,24,34,.46); color: var(--tf-muted); font-size: 10px; }
      #${APP_ID} .tf-price-grid strong { color: var(--tf-text); font-size: 13px; overflow-wrap: anywhere; }
      #${APP_ID} .tf-price-grid .tf-suggested { grid-column: 1 / -1; grid-template-columns: 1fr auto; align-items: center; margin-top: 1px; padding: 9px 11px; border: 1px solid rgba(20,228,186,.46); border-radius: 9px; background: linear-gradient(135deg, rgba(20,228,186,.14), rgba(20,228,186,.035)); color: var(--tf-teal); box-shadow: inset 0 0 24px rgba(20,228,186,.045); }
      #${APP_ID} .tf-price-grid .tf-suggested small { grid-column: 1; color: #b9ddd5; font-size: 10px; }
      #${APP_ID} .tf-price-grid .tf-suggested strong { grid-column: 1; color: var(--tf-teal); font-size: clamp(18px, 1.8vw, 24px); line-height: 1.05; }
      #${APP_ID} .tf-price-grid .tf-suggested em { grid-column: 2; grid-row: 1 / span 2; font-size: 10px; font-style: normal; text-align: right; }
      #${APP_ID} .tf-pricing-factors { padding: 10px; border: 1px solid rgba(74,122,143,.32); border-radius: 9px; background: rgba(4,24,34,.42); }
      #${APP_ID} .tf-pricing-factors h3 { margin: 0 0 7px; font-size: 13px; }
      #${APP_ID} .tf-pricing-factors span { display: flex; justify-content: space-between; gap: 10px; min-height: 28px; padding: 4px 0; border-bottom: 1px solid rgba(74,122,143,.16); color: var(--tf-muted); font-size: 10px; }
      #${APP_ID} .tf-pricing-factors b { display: inline-flex; align-items: center; gap: 5px; color: #c9d9e4; }
      #${APP_ID} .tf-pricing-factors b .tf-icon { width: 12px; height: 12px; }
      #${APP_ID} .tf-pricing-factors em { max-width: 56%; color: var(--tf-green); font-style: normal; line-height: 1.25; text-align: right; overflow-wrap: anywhere; }
      #${APP_ID} .tf-market-upgrades { position: relative; display: grid; grid-template-columns: minmax(175px,.34fr) 1fr; align-items: center; gap: 12px; margin-top: 12px; padding: 10px 12px; border: 1px solid rgba(73,169,255,.23); border-radius: 9px; background: linear-gradient(90deg, rgba(73,169,255,.075), rgba(20,228,186,.025)); }
      #${APP_ID} .tf-market-upgrades > div:first-child { display: grid; gap: 3px; }
      #${APP_ID} .tf-market-upgrades strong { display: flex; align-items: center; gap: 6px; color: #dcecff; }
      #${APP_ID} .tf-market-upgrades small { color: var(--tf-muted); font-size: 10px; }
      #${APP_ID} .tf-market-upgrades .tf-chip-list span { border-color: rgba(73,169,255,.38); background: rgba(73,169,255,.08); color: #cde9ff; font-size: 10px; }
      #${APP_ID} .tf-market-upgrades.is-empty { grid-template-columns: 1fr; }
      #${APP_ID} .tf-comparable-note { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin-top: 8px; padding: 9px; border-top: 1px solid rgba(74,122,143,.25); }
      #${APP_ID} .tf-comparable-note span, #${APP_ID} .tf-comparable-note small { color: var(--tf-muted); }
      #${APP_ID} .tf-comparable-note small { grid-column: 2; }
      #${APP_ID} details.tf-comparable-note { display: block; }
      #${APP_ID} .tf-comparable-note summary { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; cursor: pointer; list-style: none; }
      #${APP_ID} .tf-comparable-note summary::-webkit-details-marker { display: none; }
      #${APP_ID} .tf-comparable-note summary > b { color: var(--tf-teal); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
      #${APP_ID} details.tf-comparable-note > small { display: block; margin: 6px 0 0; }
      #${APP_ID} .tf-comparable-scroll { margin-top: 9px; overflow-x: auto; border: 1px solid rgba(74,122,143,.2); border-radius: 7px; }
      #${APP_ID} .tf-comparable-scroll table { width: 100%; min-width: 740px; border-collapse: collapse; font-size: 10px; }
      #${APP_ID} .tf-comparable-scroll th, #${APP_ID} .tf-comparable-scroll td { padding: 7px 9px; border-bottom: 1px solid rgba(74,122,143,.16); text-align: left; white-space: nowrap; }
      #${APP_ID} .tf-comparable-scroll th { color: var(--tf-muted); background: rgba(8,33,45,.85); font-weight: 600; }
      #${APP_ID} .tf-comparable-scroll td { color: #cedbe3; }
      #${APP_ID} .tf-comparable-scroll td:nth-child(3) { max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
      #${APP_ID} .tf-comparable-scroll tbody tr:last-child td { border-bottom: 0; }
      #${APP_ID} .tf-kv-list { display: grid; }
      #${APP_ID} .tf-kv-list > span { display: flex; justify-content: space-between; gap: 10px; min-height: 29px; padding: 5px; border-bottom: 1px solid rgba(74,122,143,.17); }
      #${APP_ID} .tf-kv-list b { color: #bdced9; font-weight: 500; }
      #${APP_ID} .tf-opportunity { display: flex; justify-content: space-between; width: 100%; min-height: 48px; padding: 7px; border: 0; border-bottom: 1px solid rgba(74,122,143,.18); border-radius: 0; background: transparent; text-align: left; }
      #${APP_ID} .tf-opportunity span { display: grid; }
      #${APP_ID} .tf-opportunity small { color: var(--tf-muted); }
      #${APP_ID} .tf-archive-card { display: grid; grid-template-columns: 145px minmax(180px, .9fr) minmax(270px, 1.25fr) minmax(150px, .7fr) 135px; min-height: 112px; overflow: hidden; }
      #${APP_ID} .tf-archive-card > img, #${APP_ID} .tf-archive-card > .tf-image-placeholder { width: 145px; min-height: 112px; height: 100%; object-fit: cover; }
      #${APP_ID} .tf-archive-property, #${APP_ID} .tf-archive-facts, #${APP_ID} .tf-archive-ended { padding: 10px; }
      #${APP_ID} .tf-archive-property h2 { margin: 0 0 7px; font-size: 15px; }
      #${APP_ID} .tf-archive-property > small { display: block; margin-top: 8px; color: var(--tf-muted); }
      #${APP_ID} .tf-archive-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 12px; border-left: 1px solid rgba(74,122,143,.2); }
      #${APP_ID} .tf-archive-facts span, #${APP_ID} .tf-archive-ended { display: grid; gap: 2px; }
      #${APP_ID} .tf-archive-facts b, #${APP_ID} .tf-archive-ended span { color: var(--tf-muted); font-size: 10px; }
      #${APP_ID} .tf-archive-ended { align-content: center; border-left: 1px solid rgba(74,122,143,.2); }
      #${APP_ID} .tf-archive-ended b { margin-top: 5px; color: var(--tf-red); }
      #${APP_ID} .tf-archive-summary .tf-metric { border-right: 0; border-bottom: 1px solid rgba(74,122,143,.2); }
      #${APP_ID} .tf-kpi-row { grid-template-columns: repeat(6, minmax(110px, 1fr)); border: 1px solid var(--tf-border); border-radius: var(--tf-radius); background: rgba(7,31,43,.92); }
      #${APP_ID} .tf-insights-grid { display: grid; grid-template-columns: 1.2fr .9fr .8fr; gap: 12px; }
      #${APP_ID} .tf-wide-card { grid-column: span 2; }
      #${APP_ID} .tf-chart-empty { min-height: 230px; }
      #${APP_ID} .tf-bars, #${APP_ID} .tf-comparison { display: grid; gap: 10px; margin-top: 10px; }
      #${APP_ID} .tf-bars > div, #${APP_ID} .tf-comparison > div { display: grid; grid-template-columns: 120px 1fr auto; align-items: center; gap: 8px; }
      #${APP_ID} .tf-bars i, #${APP_ID} .tf-comparison i { position: relative; height: 10px; border-radius: 99px; background: #0a2634; overflow: hidden; }
      #${APP_ID} .tf-bars i::after, #${APP_ID} .tf-comparison i::after { content: ""; display: block; width: var(--tf-bar); height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--tf-teal), var(--tf-blue)); }
      #${APP_ID} .tf-comparison .is-spouse i::after { background: linear-gradient(90deg, var(--tf-purple), #9d70ff); }
      #${APP_ID} .tf-donut { display: grid; place-items: center; width: 130px; height: 130px; margin: 16px auto; border-radius: 50%; background: radial-gradient(circle at center, #071f2b 55%, transparent 57%), conic-gradient(var(--tf-teal) calc(var(--tf-percent) * 1%), #0b3547 0); }
      #${APP_ID} .tf-donut strong { font-size: 24px; }
      #${APP_ID} .tf-donut span { color: var(--tf-muted); }
      #${APP_ID} .tf-ranking { display: grid; }
      #${APP_ID} .tf-ranking button { display: grid; grid-template-columns: 45px 1fr 95px 120px 70px; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 4px; border: 0; border-bottom: 1px solid rgba(74,122,143,.18); border-radius: 0; background: transparent; text-align: left; }
      #${APP_ID} .tf-ranking img { width: 45px; height: 32px; border-radius: 5px; object-fit: cover; }
      #${APP_ID} .tf-ranking span { color: var(--tf-blue); }
      #${APP_ID} .tf-ranking em { color: var(--tf-green); font-style: normal; }
      #${APP_ID} .tf-duration-bars { display: flex; align-items: end; justify-content: space-around; gap: 6px; height: 170px; padding-top: 18px; }
      #${APP_ID} .tf-duration-bars div { display: grid; grid-template-rows: 1fr auto auto; justify-items: center; align-items: end; width: 100%; height: 100%; }
      #${APP_ID} .tf-duration-bars i { width: 58%; height: var(--tf-height); min-height: 6px; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, var(--tf-teal), #1586ac); }
      #${APP_ID} .tf-duration-bars span { color: var(--tf-muted); font-size: 10px; }
      #${APP_ID} .tf-insight-list { display: grid; }
      #${APP_ID} .tf-insight-list div { display: grid; grid-template-columns: 32px 1fr; gap: 2px 8px; padding: 8px; border-bottom: 1px solid rgba(74,122,143,.18); }
      #${APP_ID} .tf-insight-list div > .tf-icon { grid-row: span 2; width: 22px; height: 22px; }
      #${APP_ID} .tf-insight-list small { color: var(--tf-muted); }
      #${APP_ID} .tf-footer { display: flex; align-items: center; gap: 20px; flex: 0 0 auto; min-height: 42px; padding: 8px 18px; border-top: 1px solid var(--tf-border); color: var(--tf-muted); font-size: 10px; }
      #${APP_ID} .tf-footer-brand { display: flex; align-items: center; gap: 8px; }
      #${APP_ID} .tf-footer-brand .tf-icon { width: 15px; height: 15px; }
      #${APP_ID} .tf-footer-brand strong { color: var(--tf-text); font-size: 12px; }
      #${APP_ID} .tf-footer > div:last-child { display: flex; gap: 23px; margin-left: auto; }
      #${APP_ID} .tf-toast { position: absolute; left: 50%; bottom: 48px; z-index: 20; max-width: 70%; transform: translateX(-50%); padding: 7px 12px; border: 1px solid var(--tf-border); border-radius: 99px; background: rgba(4,20,29,.94); color: var(--tf-muted); opacity: 0; pointer-events: none; transition: opacity .2s; }
      #${APP_ID} .tf-toast.is-visible:not(:empty) { opacity: .92; }
      #${APP_ID} .tf-toast.is-suppressed { display: none; }
      #${APP_ID} .tf-sync-progress-toast { position: absolute; right: 18px; bottom: 54px; z-index: 90; display: grid; gap: 10px; width: min(450px, calc(100% - 36px)); max-height: min(610px, calc(100% - 130px)); padding: 13px; overflow: hidden; border: 1px solid rgba(32,113,138,.9); border-radius: 13px; background: linear-gradient(150deg, rgba(7,34,46,.985), rgba(3,17,25,.99)); box-shadow: 0 22px 55px rgba(0,0,0,.58), inset 0 1px rgba(255,255,255,.035); pointer-events: auto; }
      #${APP_ID} .tf-sync-progress-toast.is-running { border-color: rgba(255,208,90,.62); }
      #${APP_ID} .tf-sync-progress-toast.is-finished { border-color: rgba(69,239,173,.58); }
      #${APP_ID} .tf-sync-progress-toast.is-error { border-color: rgba(255,117,123,.72); }
      #${APP_ID} .tf-sync-progress-toast > header { display: grid; grid-template-columns: 38px minmax(0,1fr) 30px; align-items: center; gap: 9px; }
      #${APP_ID} .tf-sync-progress-icon { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid rgba(20,228,186,.32); border-radius: 10px; background: rgba(20,228,186,.085); }
      #${APP_ID} .is-running .tf-sync-progress-icon .tf-icon { animation: tfSpin 1.2s linear infinite; }
      @keyframes tfSpin { to { transform: rotate(360deg); } }
      #${APP_ID} .tf-sync-progress-toast > header > div { display: grid; gap: 3px; min-width: 0; }
      #${APP_ID} .tf-sync-progress-toast > header strong { color: var(--tf-text); font-size: 14px; }
      #${APP_ID} .tf-sync-progress-toast > header small { color: var(--tf-muted); font-size: 10px; line-height: 1.35; }
      #${APP_ID} .tf-sync-progress-close { width: 30px; min-width: 30px; height: 30px; padding: 0; border-color: transparent; background: transparent; }
      #${APP_ID} .tf-sync-progress-close .tf-icon { width: 14px; height: 14px; }
      #${APP_ID} .tf-sync-progress-meta { display: grid; grid-template-columns: 1fr 38px; align-items: center; gap: 9px; }
      #${APP_ID} .tf-sync-progress-meta > b { color: var(--tf-teal); font-size: 11px; text-align: right; }
      #${APP_ID} .tf-sync-progress-track { height: 7px; overflow: hidden; border-radius: 99px; background: #061a24; box-shadow: inset 0 0 0 1px rgba(74,122,143,.22); }
      #${APP_ID} .tf-sync-progress-track i { display: block; width: var(--tf-sync-progress); height: 100%; border-radius: inherit; background: linear-gradient(90deg, #168db5, var(--tf-teal)); box-shadow: 0 0 14px rgba(20,228,186,.5); transition: width .35s ease; }
      #${APP_ID} .tf-sync-progress-toast.is-running .tf-sync-progress-track i { background-size: 32px 100%; animation: tfProgressGlow 1.1s linear infinite; }
      @keyframes tfProgressGlow { 50% { filter: brightness(1.35); } }
      #${APP_ID} .tf-sync-progress-toast ol { display: grid; gap: 0; margin: 0; padding: 0; overflow: auto; list-style: none; }
      #${APP_ID} .tf-sync-progress-toast li { display: grid; grid-template-columns: 24px minmax(0,1fr); gap: 8px; padding: 7px 4px; border-top: 1px solid rgba(74,122,143,.15); }
      #${APP_ID} .tf-sync-progress-toast li > i { display: grid; place-items: center; width: 20px; height: 20px; border: 1px solid rgba(111,145,162,.38); border-radius: 50%; color: #7893a4; font-size: 11px; font-style: normal; }
      #${APP_ID} .tf-sync-progress-toast li > span { display: grid; gap: 2px; }
      #${APP_ID} .tf-sync-progress-toast li strong { color: #c9dae4; font-size: 11px; }
      #${APP_ID} .tf-sync-progress-toast li small { color: #809aaa; font-size: 9px; line-height: 1.35; }
      #${APP_ID} .tf-sync-progress-toast li.is-active > i { border-color: var(--tf-amber); background: rgba(255,208,90,.12); color: var(--tf-amber); animation: tfPulse .8s infinite alternate; }
      #${APP_ID} .tf-sync-progress-toast li.is-active strong { color: var(--tf-amber); }
      #${APP_ID} .tf-sync-progress-toast li.is-done > i { border-color: var(--tf-green); background: rgba(69,239,173,.12); color: var(--tf-green); }
      #${APP_ID} .tf-sync-progress-toast li.is-warning > i { border-color: var(--tf-amber); background: rgba(255,208,90,.12); color: var(--tf-amber); }
      #${APP_ID} .tf-sync-progress-toast li.is-error > i { border-color: var(--tf-red); background: rgba(255,117,123,.12); color: var(--tf-red); }
      #${APP_ID} .tf-sync-progress-toast > footer { display: flex; justify-content: space-between; gap: 12px; padding-top: 2px; color: var(--tf-muted); font-size: 9px; }
      #${APP_ID} .tf-sync-progress-toast > footer strong { color: #bfd1dc; font-size: 9px; }
      #${APP_ID} .tf-modal-backdrop { position: absolute; inset: 0; z-index: 100; background: rgba(0,8,13,.82); backdrop-filter: blur(4px); }
      #${APP_ID} .tf-modal { width: min(940px, 94%); max-height: 90%; border-color: var(--tf-border-bright); background: #061c27; }
      #${APP_ID} .tf-settings-body, #${APP_ID} .tf-detail-body { display: grid; gap: 12px; overflow: auto; padding: 15px; }
      #${APP_ID} .tf-settings-body { grid-template-columns: 1fr 1fr; }
      #${APP_ID} .tf-settings-body section, #${APP_ID} .tf-settings-body details, #${APP_ID} .tf-detail-body section { padding: 13px; border: 1px solid var(--tf-border); border-radius: 9px; background: rgba(8,35,47,.7); }
      #${APP_ID} .tf-settings-body h2, #${APP_ID} .tf-detail-body h2 { margin: 0 0 7px; font-size: 14px; }
      #${APP_ID} .tf-settings-body p, #${APP_ID} .tf-detail-body p { color: var(--tf-muted); }
      #${APP_ID} .tf-settings-body label { display: grid; gap: 5px; margin-top: 9px; color: #c8d7e0; }
      #${APP_ID} .tf-settings-body input, #${APP_ID} .tf-settings-body select, #${APP_ID} .tf-card input, #${APP_ID} .tf-card select { width: 100%; }
      #${APP_ID} .tf-check { display: flex !important; align-items: center; }
      #${APP_ID} .tf-cache-control { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(74,122,143,.25); }
      #${APP_ID} .tf-cache-control span { display: grid; gap: 3px; }
      #${APP_ID} .tf-cache-control small { color: var(--tf-muted); line-height: 1.35; }
      #${APP_ID} .tf-check input { width: auto; min-height: 0; }
      #${APP_ID} .tf-button-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      #${APP_ID} .tf-detail-image { width: 100%; max-height: 280px; border-radius: 9px; object-fit: cover; }
      #${APP_ID} .tf-detail-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; }
      #${APP_ID} .tf-detail-grid > div { min-height: 70px; padding: 10px; border: 1px solid var(--tf-border); border-radius: 8px; background: rgba(8,35,47,.72); }
      #${APP_ID} .tf-chip-list { display: flex; flex-wrap: wrap; gap: 7px; }
      #${APP_ID} .tf-chip-list span { padding: 5px 8px; border: 1px solid var(--tf-border-bright); border-radius: 99px; color: #bcd6e5; }
      @media (max-width: 1120px) {
        #${APP_ID} { min-width: 520px; }
        #${APP_ID} .tf-main-sidebar { grid-template-columns: 1fr; }
        #${APP_ID} .tf-sidebar { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
        #${APP_ID} .tf-market-top { grid-template-columns: 1fr 1fr; }
        #${APP_ID} .tf-pricing-factors { grid-column: 1 / -1; }
        #${APP_ID} .tf-property-card, #${APP_ID} .tf-rental-card { grid-template-columns: 190px minmax(0,1fr) 150px; }
        #${APP_ID} .tf-archive-card { grid-template-columns: 120px 1fr 1.3fr; }
        #${APP_ID} .tf-archive-card > img, #${APP_ID} .tf-archive-card > .tf-image-placeholder { width: 120px; }
        #${APP_ID} .tf-archive-ended, #${APP_ID} .tf-archive-card .tf-card-actions { grid-column: span 1; }
        #${APP_ID} .tf-insights-grid { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 760px) {
        #${APP_ID} { left: 8px; bottom: 68px; width: calc(100vw - 16px); height: calc(100vh - 84px); min-width: 0; min-height: 420px; }
        #${APP_ID} .tf-header { min-height: 64px; padding: 8px 10px; }
        #${APP_ID} .tf-logo { width: 38px; height: 38px; font-size: 19px; }
        #${APP_ID} .tf-brand strong { font-size: 20px; }
        #${APP_ID} .tf-brand small, #${APP_ID} .tf-sync-meta { display: none; }
        #${APP_ID} .tf-sync-button { min-width: 44px; width: 44px; overflow: hidden; white-space: nowrap; }
        #${APP_ID} .tf-nav { grid-template-columns: repeat(6, minmax(74px,1fr)); margin: 0 8px; overflow-x: auto; }
        #${APP_ID} .tf-nav button { min-width: 78px; min-height: 45px; padding: 5px; font-size: 10px; }
        #${APP_ID} .tf-nav button span { display: block; margin: 0; font-size: 15px; }
        #${APP_ID} .tf-content { padding: 10px 8px; }
        #${APP_ID} .tf-two-column, #${APP_ID} .tf-insights-grid, #${APP_ID} .tf-settings-body { grid-template-columns: 1fr; }
        #${APP_ID} .tf-wide-card { grid-column: auto; }
        #${APP_ID} .tf-metrics, #${APP_ID} .tf-summary-strip, #${APP_ID} .tf-kpi-row, #${APP_ID} .tf-market-summary { grid-template-columns: repeat(2, 1fr); }
        #${APP_ID} .tf-current-home.has-image { background-image: linear-gradient(rgba(3,20,29,.78), rgba(3,20,29,.96)), var(--tf-hero-image); }
        #${APP_ID} .tf-hero-meta { flex-wrap: wrap; gap: 15px 28px; }
        #${APP_ID} .tf-property-card, #${APP_ID} .tf-rental-card { grid-template-columns: 105px minmax(0, 1fr); }
        #${APP_ID} .tf-property-card > img, #${APP_ID} .tf-rental-card > img, #${APP_ID} .tf-property-card > .tf-image-placeholder, #${APP_ID} .tf-rental-card > .tf-image-placeholder { min-height: 120px; }
        #${APP_ID} .tf-property-card .tf-card-actions, #${APP_ID} .tf-rental-card .tf-card-actions { grid-column: 1 / -1; flex-direction: row; }
        #${APP_ID} .tf-property-meta, #${APP_ID} .tf-contract-grid { gap: 10px 20px; }
        #${APP_ID} .tf-market-top, #${APP_ID} .tf-market-property { grid-template-columns: 1fr; }
        #${APP_ID} .tf-market-property > img, #${APP_ID} .tf-market-property > .tf-image-placeholder { width: 100%; height: 180px; }
        #${APP_ID} .tf-market-upgrades { grid-template-columns: 1fr; }
        #${APP_ID} .tf-sync-progress-toast { right: 8px; bottom: 50px; width: calc(100% - 16px); max-height: calc(100% - 112px); }
        #${APP_ID} .tf-archive-card { grid-template-columns: 90px 1fr; }
        #${APP_ID} .tf-archive-card > img, #${APP_ID} .tf-archive-card > .tf-image-placeholder { width: 90px; }
        #${APP_ID} .tf-archive-facts, #${APP_ID} .tf-archive-ended, #${APP_ID} .tf-archive-card .tf-card-actions { grid-column: 1 / -1; }
        #${APP_ID} .tf-card-actions { flex-direction: row; }
        #${APP_ID} .tf-footer > div:last-child span:not(:last-child) { display: none; }
        #${APP_ID} .tf-detail-grid { grid-template-columns: 1fr 1fr; }
        #${APP_ID} .tf-activity-row { grid-template-columns: 70px 12px 1fr; }
        #${APP_ID} .tf-activity-row span { grid-column: 3; }
      }
    `;
    targetDocument.head.appendChild(style);
  }

  function injectStyles(targetDocument = document) {
    if (targetDocument.getElementById(`${APP_ID}-styles`)) return;
    const style = targetDocument.createElement("style");
    style.id = `${APP_ID}-styles`;
    style.textContent = `
      #${APP_ID} {
        --tlt-bg: var(--mh-bg-main, #071107);
        --tlt-bg-soft: var(--mh-bg-soft, #0b1508);
        --tlt-panel: var(--mh-bg-panel, #101807);
        --tlt-panel-2: var(--mh-bg-panel-2, var(--mh-panel-2, #16230d));
        --tlt-table-bg: var(--mh-table-bg, #0b140b);
        --tlt-table-head: var(--mh-table-head, #13200d);
        --tlt-control: var(--mh-control, #17250f);
        --tlt-control-hover: var(--mh-control-hover, #203414);
        --tlt-control-active: var(--mh-control-active, var(--mh-script-accent, var(--mh-accent, #9fd42f)));
        --tlt-control-active-text: var(--mh-control-active-text, var(--mh-bg-main, #071107));
        --tlt-control-active-border: var(--mh-control-active-border, var(--mh-accent-2, #44f582));
        --tlt-control-active-ring: var(--mh-control-active-ring, color-mix(in srgb, var(--mh-accent-2, #44f582) 30%, transparent));
        --tlt-border: var(--mh-border, #8fbf26);
        --tlt-border-soft: var(--mh-border-soft, rgba(159, 212, 47, 0.32));
        --tlt-border-strong: var(--mh-border-strong, #9fd42f);
        --tlt-text: var(--mh-text, #eaffd6);
        --tlt-text-soft: var(--mh-text-soft, #cfe8a8);
        --tlt-muted: var(--mh-text-muted, var(--mh-muted, #8fa36d));
        --tlt-accent: var(--mh-script-accent, var(--mh-accent, var(--mh-primary, #9fd42f)));
        --tlt-accent-2: var(--mh-accent-2, var(--mh-secondary, #44f582));
        --tlt-success: var(--mh-success, #44f582);
        --tlt-warning: var(--mh-warning, #e5bd54);
        --tlt-danger: var(--mh-danger, #ff5c5c);
        --tlt-info: var(--mh-info, #72d9ff);
        --tlt-overlay: var(--mh-overlay, rgba(0, 0, 0, 0.72));
        --tlt-shadow: var(--mh-shadow, var(--mh-panel-shadow, 0 18px 45px rgba(0, 0, 0, 0.55)));
        --tlt-radius-sm: var(--mh-radius-sm, 6px);
        --tlt-radius: var(--mh-radius-md, var(--mh-radius, 8px));
        --tlt-space-xs: var(--mh-space-xs, 4px);
        --tlt-space-sm: var(--mh-space-sm, 8px);
        --tlt-space-md: var(--mh-space-md, 12px);
        --tlt-space-lg: var(--mh-space-lg, 16px);
        --tlt-font: var(--mh-font-body, var(--mh-font, Arial, Helvetica, sans-serif));
        --tlt-font-mono: var(--mh-font-mono, Consolas, "Courier New", monospace);
        --tlt-font-size: var(--mh-font-size, 12px);
        --tlt-font-size-sm: var(--mh-font-size-sm, 11px);
        --tlt-font-size-lg: var(--mh-font-size-lg, 14px);
        --tlt-line-height: var(--mh-line-height, 1.35);
        position: fixed;
        left: 18px;
        bottom: 84px;
        z-index: 99999;
        width: min(760px, calc(100vw - 36px));
        height: min(560px, calc(100vh - 36px));
        min-width: 420px;
        min-height: 340px;
        max-width: calc(100vw - 16px);
        max-height: calc(100vh - 16px);
        overflow: hidden;
        resize: both;
        color: var(--tlt-text);
        font-family: var(--tlt-font);
        font-size: var(--tlt-font-size);
        line-height: var(--tlt-line-height);
        letter-spacing: var(--mh-letter-spacing, 0);
        color-scheme: dark;
        scrollbar-color: var(--tf-teal) var(--tf-bg-deep);
        scrollbar-width: thin;
      }
      html.tlt-popup-document,
      html.tlt-popup-document body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: var(--mh-bg-panel, #101820);
        color: var(--mh-text, #eaffd6);
      }
      #${APP_ID} * {
        box-sizing: border-box;
        color: inherit;
      }
      #${APP_ID} *,
      #${APP_ID} *::before,
      #${APP_ID} *::after {
        scrollbar-color: var(--tf-teal) var(--tf-bg-deep);
        scrollbar-width: thin;
      }
      #${APP_ID} ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      #${APP_ID} ::-webkit-scrollbar-track {
        background: var(--tf-bg-deep);
        border: 1px solid rgba(23, 70, 90, .46);
        border-radius: 999px;
      }
      #${APP_ID} ::-webkit-scrollbar-thumb {
        min-width: 28px;
        min-height: 28px;
        background: linear-gradient(180deg, var(--tf-blue), var(--tf-teal-dark));
        border: 2px solid var(--tf-bg-deep);
        border-radius: 999px;
        box-shadow: inset 0 0 0 1px rgba(24, 228, 186, .32);
      }
      #${APP_ID} ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, var(--tf-teal), #12aa91);
      }
      #${APP_ID} ::-webkit-scrollbar-thumb:active {
        background: var(--tf-teal);
      }
      #${APP_ID} ::-webkit-scrollbar-corner {
        background: var(--tf-bg-deep);
      }
      #${APP_ID} ::-webkit-scrollbar-button {
        display: none;
        width: 0;
        height: 0;
      }
      #${APP_ID}.is-popup {
        position: static;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        max-width: none;
        max-height: none;
        resize: none;
      }
      #${APP_ID}.is-collapsed {
        width: auto;
        height: auto;
        min-width: 0;
        min-height: 0;
        overflow: visible;
        resize: none;
      }
      #${APP_ID}.is-collapsed .tlt-panel { display: none; }
      #${APP_ID}.is-popup .tlt-tab { display: none; }
      #${APP_ID} .tlt-tab {
        border: 1px solid var(--tlt-border-soft);
        background: var(--tlt-control);
        color: var(--tlt-text);
        border-radius: 6px;
        padding: 9px 12px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 10px 28px color-mix(in srgb, var(--tlt-bg) 70%, transparent);
      }
      #${APP_ID} .tlt-panel {
        position: relative;
        clear: both;
        display: flex;
        flex-direction: column;
        height: calc(100% - 38px);
        min-height: 290px;
        overflow: hidden;
        border: 1px solid var(--tlt-border-soft);
        border-radius: 8px;
        background: var(--tlt-panel);
        box-shadow: 0 18px 56px color-mix(in srgb, var(--tlt-bg) 72%, transparent);
      }
      #${APP_ID}.is-popup .tlt-panel {
        height: 100%;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }
      #${APP_ID}.is-popup .tlt-header {
        cursor: default;
      }
      #${APP_ID} .tlt-header,
      #${APP_ID} .tlt-toolbar,
      #${APP_ID} .tlt-tabs,
      #${APP_ID} .tlt-tab-content,
      #${APP_ID} .tlt-form,
      #${APP_ID} .tlt-summary,
      #${APP_ID} .tlt-foot {
        padding: 12px;
        border-bottom: 1px solid var(--tlt-border-soft);
      }
      #${APP_ID} .tlt-header {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--tlt-bg-soft);
        cursor: move;
        user-select: none;
      }
      #${APP_ID} h2 {
        margin: 0;
        font-size: 16px;
        line-height: 1.2;
      }
      #${APP_ID} .tlt-muted { color: var(--tlt-muted); }
      #${APP_ID} .tlt-header .tlt-muted { margin-top: 3px; }
      #${APP_ID} .tlt-grow { flex: 1; }
      #${APP_ID} button,
      #${APP_ID} input,
      #${APP_ID} select,
      #${APP_ID} textarea {
        border: 1px solid var(--tlt-border);
        border-radius: 6px;
        background: var(--tlt-control);
        color: var(--tlt-text);
        min-height: 34px;
        padding: 7px 9px;
        font: inherit;
      }
      #${APP_ID} button {
        background: var(--tlt-control);
        cursor: pointer;
        font-weight: 700;
      }
      #${APP_ID} button:hover { background: var(--tlt-control-hover); }
      #${APP_ID} button.tlt-primary {
        border-color: var(--tlt-accent-2);
        background: var(--tlt-accent);
        color: var(--tlt-bg);
      }
      #${APP_ID} button.tlt-danger {
        border-color: var(--tlt-danger);
        background: var(--tlt-danger);
        color: var(--tlt-bg);
      }
      #${APP_ID} button.tlt-ghost { background: transparent; }
      #${APP_ID} .tlt-toolbar {
        display: grid;
        grid-template-columns: minmax(150px, 1fr) minmax(145px, 190px) minmax(130px, 180px) auto auto auto;
        gap: 8px;
        align-items: center;
      }
      #${APP_ID} .tlt-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        background: var(--tlt-bg-soft);
      }
      #${APP_ID} .tlt-tabs button {
        position: relative;
        min-height: 30px;
        padding: 6px 9px;
        border-color: var(--tlt-border-soft);
        background: color-mix(in srgb, var(--tlt-table-head) 82%, var(--tlt-bg) 18%);
        color: var(--tlt-text-soft);
        transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease;
      }
      #${APP_ID} .tlt-tabs button:hover {
        border-color: var(--tlt-border-strong);
        background: var(--tlt-control-hover);
        color: var(--tlt-text);
      }
      #${APP_ID} .tlt-tabs button.is-active,
      #${APP_ID} .tlt-tabs button[aria-selected="true"] {
        border-color: var(--tlt-control-active-border);
        background: var(--tlt-control-active);
        color: var(--tlt-control-active-text);
        box-shadow:
          inset 0 -3px 0 color-mix(in srgb, var(--tlt-control-active-text) 36%, transparent),
          0 0 0 2px var(--tlt-control-active-ring);
      }
      #${APP_ID} .tlt-tabs button.is-active:hover,
      #${APP_ID} .tlt-tabs button[aria-selected="true"]:hover {
        background: var(--tlt-control-active);
        color: var(--tlt-control-active-text);
      }
      #${APP_ID} .tlt-ledger-controls {
        display: flex;
        flex: 1 1 520px;
        align-items: center;
        justify-content: flex-end;
        gap: var(--tlt-space-sm);
        min-width: min(100%, 520px);
        margin-left: auto;
      }
      #${APP_ID} .tlt-ledger-controls input[type="search"] {
        flex: 1 1 180px;
        min-width: 140px;
      }
      #${APP_ID} .tlt-ledger-controls select {
        flex: 0 1 170px;
      }
      #${APP_ID} .tlt-ledger-controls button {
        flex: 0 0 auto;
      }
      #${APP_ID} .tlt-tab-content {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        max-height: none;
      }
      #${APP_ID} .tlt-panel-grid {
        display: grid;
        grid-template-columns: minmax(220px, 320px) minmax(0, 1fr);
        gap: 12px;
      }
      #${APP_ID} .tlt-endpoint {
        border: 1px solid var(--tlt-border-soft);
        border-radius: 7px;
        padding: 9px;
        background: var(--tlt-panel-2);
        min-width: 0;
      }
      #${APP_ID} .tlt-endpoint strong,
      #${APP_ID} .tlt-endpoint code,
      #${APP_ID} .tlt-endpoint span {
        display: block;
      }
      #${APP_ID} .tlt-endpoint strong {
        margin-bottom: 5px;
        color: var(--tlt-text);
      }
      #${APP_ID} .tlt-endpoint code {
        margin-bottom: 7px;
        color: var(--tlt-info);
        font-size: 11px;
        overflow-wrap: anywhere;
      }
      #${APP_ID} .tlt-endpoint .tlt-muted {
        min-height: 32px;
      }
      #${APP_ID} .tlt-badge {
        width: max-content;
        margin-top: 8px;
        border: 1px solid var(--tlt-border);
        border-radius: 999px;
        padding: 4px 8px;
        color: var(--tlt-text-soft);
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      #${APP_ID} .tlt-guide {
        border: 1px solid var(--tlt-border);
        border-radius: 7px;
        padding: 12px;
        margin-bottom: 12px;
        background: var(--tlt-panel-2);
      }
      #${APP_ID} .tlt-guide strong,
      #${APP_ID} .tlt-guide span {
        display: block;
      }
      #${APP_ID} .tlt-guide strong {
        color: var(--tlt-text);
        margin-bottom: 8px;
      }
      #${APP_ID} .tlt-steps {
        display: grid;
        grid-template-columns: repeat(3, minmax(150px, 1fr));
        gap: 8px;
      }
      #${APP_ID} .tlt-step {
        border: 1px solid var(--tlt-border-soft);
        border-radius: 7px;
        padding: 9px;
        background: var(--tlt-panel);
      }
      #${APP_ID} .tlt-step b {
        display: block;
        margin-bottom: 4px;
      }
      #${APP_ID} .tlt-step span {
        color: var(--tlt-muted);
        font-size: 11px;
        line-height: 1.35;
      }
      #${APP_ID} .tlt-step button {
        width: 100%;
        min-height: 30px;
        margin-top: 8px;
      }
      #${APP_ID} .tlt-endpoint button {
        width: 100%;
        margin-top: 8px;
      }
      #${APP_ID} .tlt-endpoint input,
      #${APP_ID} .tlt-endpoint select {
        width: 100%;
        min-height: 30px;
        margin-top: 8px;
      }
      #${APP_ID} .tlt-property-meta {
        margin-top: 8px;
        color: var(--tlt-text-soft);
        font-size: 11px;
        line-height: 1.45;
      }
      #${APP_ID} .tlt-property-preview {
        display: grid;
        grid-template-columns: 86px minmax(0, 1fr);
        gap: 8px;
        align-items: center;
        margin-top: 8px;
      }
      #${APP_ID} .tlt-property-image {
        width: 86px;
        height: 56px;
        border: 1px solid var(--tlt-border);
        border-radius: 6px;
        object-fit: cover;
        background: var(--tlt-control);
      }
      #${APP_ID} .tlt-property-picture-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
        gap: var(--tlt-space-sm);
        align-items: stretch;
      }
      #${APP_ID} .tlt-property-picture-card {
        display: grid;
        grid-template-rows: 74px auto;
        gap: var(--tlt-space-xs);
        min-width: 0;
        border: 1px solid var(--tlt-border-soft);
        border-radius: var(--tlt-radius-sm);
        padding: var(--tlt-space-xs);
        background: var(--tlt-panel-2);
      }
      #${APP_ID} .tlt-property-picture-card .tlt-property-image {
        width: 100%;
        height: 74px;
      }
      #${APP_ID} .tlt-property-picture-card div {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${APP_ID} .tlt-user-summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(130px, 1fr));
        gap: 8px;
      }
      #${APP_ID} .tlt-profile-card {
        border: 1px solid var(--tlt-border-soft);
        border-radius: 7px;
        padding: 12px;
        background: var(--tlt-panel-2);
        color: var(--tlt-text);
      }
      #${APP_ID} .tlt-profile-head {
        display: grid;
        grid-template-columns: 72px minmax(0, 1fr);
        gap: 12px;
        align-items: center;
      }
      #${APP_ID} .tlt-profile-image {
        width: 72px;
        height: 72px;
        border: 1px solid var(--tlt-border);
        border-radius: 7px;
        object-fit: cover;
        background: var(--tlt-control);
      }
      #${APP_ID} .tlt-info-property {
        display: grid;
        grid-template-columns: 64px minmax(0, 1fr);
        gap: 8px;
        align-items: center;
      }
      #${APP_ID} .tlt-info-property img {
        width: 64px;
        height: 42px;
        border: 1px solid var(--tlt-border);
        border-radius: 5px;
        object-fit: cover;
      }
      #${APP_ID} .tlt-profile-name {
        margin: 0;
        font-size: 18px;
        line-height: 1.2;
      }
      #${APP_ID} .tlt-profile-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(130px, 1fr));
        gap: 8px;
        margin-top: 12px;
      }
      #${APP_ID} .tlt-info-card {
        border: 1px solid var(--tlt-border-soft);
        border-radius: 7px;
        padding: 9px;
        background: var(--tlt-panel-2);
        color: var(--tlt-text);
      }
      #${APP_ID} .tlt-info-card span,
      #${APP_ID} .tlt-info-card b {
        display: block;
      }
      #${APP_ID} .tlt-info-card span {
        color: var(--tlt-muted);
        font-size: 11px;
      }
      #${APP_ID} .tlt-info-card b {
        margin-top: 4px;
        font-size: 14px;
        overflow-wrap: anywhere;
      }
      #${APP_ID} .tlt-settings-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(220px, 1fr));
        gap: 12px;
      }
      #${APP_ID} .tlt-settings-card {
        border: 1px solid var(--tlt-border-soft);
        border-radius: 7px;
        padding: 12px;
        background: var(--tlt-panel-2);
      }
      #${APP_ID} .tlt-settings-card label,
      #${APP_ID} .tlt-settings-card span,
      #${APP_ID} .tlt-settings-card strong {
        display: block;
      }
      #${APP_ID} .tlt-settings-card label {
        margin-top: 10px;
        color: var(--tlt-text-soft);
        font-size: 12px;
      }
      #${APP_ID} .tlt-settings-card input,
      #${APP_ID} .tlt-settings-card select {
        width: 100%;
        margin-top: 5px;
      }
      #${APP_ID} .tlt-settings-card button {
        margin-top: 10px;
      }
      #${APP_ID} .tlt-setting-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
        color: var(--tlt-text-soft);
      }
      #${APP_ID} .tlt-setting-row input {
        width: auto;
        min-height: 0;
        margin: 0;
      }
      #${APP_ID} .tlt-result {
        margin-top: 8px;
        color: var(--tlt-text-soft);
        font-size: 11px;
      }
      #${APP_ID} .tlt-subscription {
        margin-top: 10px;
        border: 1px solid var(--tlt-border);
        border-left: 4px solid var(--tlt-muted);
        border-radius: 7px;
        padding: 10px;
        background: var(--tlt-panel);
      }
      #${APP_ID} .tlt-subscription.is-active { border-left-color: var(--tlt-success); }
      #${APP_ID} .tlt-subscription.is-blocked { border-left-color: var(--tlt-danger); }
      #${APP_ID} .tlt-subscription.is-warning { border-left-color: var(--tlt-warning); }
      #${APP_ID} .tlt-subscription span,
      #${APP_ID} .tlt-subscription strong,
      #${APP_ID} .tlt-subscription small {
        display: block;
      }
      #${APP_ID} .tlt-subscription span,
      #${APP_ID} .tlt-subscription small {
        color: var(--tlt-muted);
        font-size: 11px;
      }
      #${APP_ID} .tlt-subscription strong {
        margin-top: 3px;
        color: var(--tlt-text);
        font-size: 15px;
      }
      #${APP_ID} .tlt-subscription p {
        margin: 8px 0 0;
        color: var(--tlt-text-soft);
        line-height: 1.35;
      }
      #${APP_ID} .tlt-data-table {
        width: 100%;
        min-width: 520px;
        margin-top: 10px;
        color: var(--tlt-text);
        background: var(--tlt-control);
      }
      #${APP_ID} .tlt-data-table th,
      #${APP_ID} .tlt-data-table td {
        color: var(--tlt-text);
        background: var(--tlt-control);
        line-height: 1.35;
      }
      #${APP_ID} .tlt-data-table th {
        background: var(--tlt-table-head);
        white-space: nowrap;
        text-transform: capitalize;
      }
      #${APP_ID} .tlt-data-table tbody tr:nth-child(even) td {
        background: var(--tlt-panel);
      }
      #${APP_ID} .tlt-data-table td.tlt-number {
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      #${APP_ID} .tlt-data-table td.tlt-object {
        min-width: 130px;
      }
      #${APP_ID} .tlt-data-table td.tlt-image-cell {
        width: 98px;
        min-width: 98px;
      }
      #${APP_ID} .tlt-table-thumb {
        display: block;
        width: 82px;
        height: 54px;
        border: 1px solid var(--tlt-border);
        border-radius: 5px;
        object-fit: cover;
        background: var(--tlt-bg);
      }
      #${APP_ID} .tlt-home-cell {
        display: flex;
        align-items: center;
        gap: var(--tlt-space-sm);
      }
      #${APP_ID} .tlt-thumb-hover {
        position: relative;
        display: inline-flex;
        flex: 0 0 auto;
      }
      #${APP_ID} .tlt-lease-table .tlt-table-thumb {
        width: 58px;
        height: 38px;
      }
      #${APP_ID} .tlt-thumb-preview {
        position: absolute;
        left: 0;
        top: calc(100% + var(--tlt-space-sm));
        z-index: 30;
        display: none;
        width: 350px;
        max-width: min(350px, calc(100vw - 40px));
        padding: var(--tlt-space-sm);
        border: 1px solid var(--tlt-border-soft);
        border-radius: var(--tlt-radius);
        background: var(--tlt-panel);
        box-shadow: var(--tlt-shadow);
      }
      #${APP_ID} .tlt-thumb-preview img {
        display: block;
        width: 100%;
        height: auto;
        border-radius: var(--tlt-radius-sm);
      }
      #${APP_ID} .tlt-thumb-hover:hover .tlt-thumb-preview,
      #${APP_ID} .tlt-thumb-hover:focus-within .tlt-thumb-preview {
        display: block;
      }
      #${APP_ID} .tlt-choice-list {
        display: grid;
        gap: 4px;
        min-width: 180px;
        max-width: 340px;
        max-height: 150px;
        overflow: auto;
        border: 1px solid var(--tlt-border);
        border-radius: 6px;
        background: var(--tlt-panel-2);
        color: var(--tlt-text);
        padding: 6px;
      }
      #${APP_ID} .tlt-choice-option {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        color: var(--tlt-text);
        font-size: 12px;
        line-height: 1.25;
      }
      #${APP_ID} .tlt-choice-option input {
        width: auto;
        min-height: 0;
        margin: 1px 0 0;
        accent-color: var(--tlt-accent);
      }
      #${APP_ID} .tlt-empty-value {
        display: inline-block;
        color: var(--tlt-muted);
        font-style: italic;
      }
      #${APP_ID} .tlt-check-cell,
      #${APP_ID} .tlt-miss-cell,
      #${APP_ID} .tlt-volume-cell {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        font-weight: 700;
      }
      #${APP_ID} .tlt-check-cell { color: var(--tlt-success); }
      #${APP_ID} .tlt-miss-cell { color: var(--tlt-muted); }
      #${APP_ID} .tlt-volume-cell { color: var(--tlt-text); }
      #${APP_ID} .tlt-data-json {
        margin-top: 10px;
        color: var(--tlt-text);
      }
      #${APP_ID} .tlt-data-json summary {
        color: var(--tlt-text);
        cursor: pointer;
      }
      #${APP_ID} .tlt-data-json pre {
        overflow: auto;
        max-height: 280px;
        margin: 8px 0 0;
        border: 1px solid var(--tlt-border-soft);
        border-radius: 7px;
        padding: 10px;
        background: var(--tlt-bg);
        color: var(--tlt-text);
        font-size: 11px;
        white-space: pre-wrap;
      }
      #${APP_ID} .tlt-section-title {
        padding: 12px 12px 0;
        color: var(--tlt-text);
        font-weight: 700;
      }
      #${APP_ID} .tlt-section-note {
        padding: 4px 12px 0;
        color: var(--tlt-muted);
        font-size: 11px;
      }
      #${APP_ID} .tlt-summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(120px, 1fr));
        gap: 8px;
      }
      #${APP_ID} .tlt-stat {
        border: 1px solid var(--tlt-border-soft);
        border-radius: 7px;
        padding: 9px;
        background: var(--tlt-panel-2);
      }
      #${APP_ID} .tlt-stat b {
        display: block;
        margin-top: 3px;
        font-size: 18px;
      }
      #${APP_ID} .tlt-table-wrap {
        overflow: auto;
        max-height: 310px;
      }
      #${APP_ID} .tlt-ledger-view {
        display: flex;
        flex-direction: column;
        gap: var(--tlt-space-md);
        height: 100%;
        min-height: 0;
      }
      #${APP_ID} .tlt-ledger-view .tlt-guide,
      #${APP_ID} .tlt-ledger-view .tlt-summary {
        flex: 0 0 auto;
      }
      #${APP_ID} .tlt-ledger-view .tlt-table-wrap {
        flex: 1 1 auto;
        min-height: 0;
        max-height: none;
      }
      #${APP_ID} table {
        width: 100%;
        border-collapse: collapse;
        min-width: 900px;
      }
      #${APP_ID} th,
      #${APP_ID} td {
        border-bottom: 1px solid var(--tlt-border-soft);
        padding: 9px 8px;
        text-align: left;
        vertical-align: top;
      }
      #${APP_ID} th {
        position: sticky;
        top: 0;
        background: var(--tlt-table-head);
        color: var(--tlt-text);
        z-index: 1;
      }
      #${APP_ID} th button.tlt-sort {
        width: 100%;
        min-height: 0;
        border: 0;
        border-radius: 0;
        padding: 0;
        background: transparent;
        color: var(--tlt-text);
        text-align: left;
        font-weight: 700;
        cursor: pointer;
      }
      #${APP_ID} th button.tlt-sort:hover {
        color: var(--tlt-bg);
        background: transparent;
      }
      #${APP_ID} td input,
      #${APP_ID} td select {
        width: 100%;
        min-width: 80px;
      }
      #${APP_ID} .tlt-lease-table {
        width: max-content;
        min-width: 100%;
      }
      #${APP_ID} .tlt-lease-table th,
      #${APP_ID} .tlt-lease-table td {
        white-space: nowrap;
      }
      #${APP_ID} .tlt-lease-table td input,
      #${APP_ID} .tlt-lease-table td select,
      #${APP_ID} .tlt-form input {
        width: auto;
        min-width: 8ch;
        max-width: 36ch;
        field-sizing: content;
      }
      #${APP_ID} .tlt-lease-table td input.tlt-lease-text {
        min-width: 12ch;
      }
      #${APP_ID} .tlt-money-input {
        min-width: 10ch;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      #${APP_ID} .tlt-readonly-value {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        min-width: 8ch;
        max-width: 36ch;
        border: 1px solid var(--tlt-border-soft);
        border-radius: 6px;
        padding: 7px 9px;
        background: var(--tlt-panel);
        color: var(--tlt-text);
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #${APP_ID} .tlt-readonly-value.is-number {
        justify-content: flex-end;
        font-variant-numeric: tabular-nums;
      }
      #${APP_ID} .tlt-date-input {
        min-width: 11ch;
      }
      #${APP_ID} .tlt-actions {
        display: flex;
        gap: 6px;
      }
      #${APP_ID} .tlt-form {
        display: grid;
        grid-template-columns: repeat(6, minmax(100px, 1fr));
        gap: 8px;
      }
      #${APP_ID} .tlt-advanced-picker {
        display: grid;
        grid-template-columns: minmax(200px, 320px) minmax(0, 1fr);
        gap: 8px;
        align-items: center;
        margin-bottom: 12px;
      }
      #${APP_ID} .tlt-advanced-picker select {
        width: 100%;
      }
      #${APP_ID} .tlt-form-field {
        display: grid;
        gap: 4px;
        min-width: 0;
        color: var(--tlt-text-soft);
        font-size: 11px;
        font-weight: 700;
      }
      #${APP_ID} .tlt-form-field span {
        color: var(--tlt-muted);
      }
      #${APP_ID} .tlt-form-field input,
      #${APP_ID} .tlt-form-field select,
      #${APP_ID} .tlt-form-field textarea {
        width: 100%;
      }
      #${APP_ID} .tlt-form-field.is-wide { grid-column: span 2; }
      #${APP_ID} .tlt-form textarea { resize: vertical; }
      #${APP_ID} .tlt-form button { grid-column: span 1; }
      #${APP_ID} .tlt-modal-backdrop {
        position: absolute;
        inset: 0;
        z-index: 10;
        display: grid;
        place-items: center;
        padding: var(--tlt-space-lg);
        background: color-mix(in srgb, var(--tlt-overlay) 82%, transparent);
      }
      #${APP_ID} .tlt-modal {
        width: min(760px, 100%);
        max-height: min(620px, 100%);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid var(--tlt-border-soft);
        border-radius: var(--tlt-radius);
        background: var(--tlt-panel);
        box-shadow: var(--tlt-shadow);
      }
      #${APP_ID} .tlt-modal-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--tlt-space-md);
        padding: var(--tlt-space-md);
        border-bottom: 1px solid var(--tlt-border-soft);
        background: var(--tlt-bg-soft);
      }
      #${APP_ID} .tlt-modal-head strong,
      #${APP_ID} .tlt-modal-head span {
        display: block;
      }
      #${APP_ID} .tlt-modal .tlt-form {
        overflow: auto;
        padding: var(--tlt-space-md);
        border-bottom: 0;
      }
      #${APP_ID} .tlt-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 0;
      }
      #${APP_ID} .tlt-status.is-error { color: var(--tlt-danger); }
      @media (max-width: 860px) {
        #${APP_ID} {
          left: 8px;
          bottom: 74px;
          width: calc(100vw - 16px);
          height: min(560px, calc(100vh - 92px));
          min-width: 0;
          min-height: 320px;
        }
        #${APP_ID} .tlt-toolbar,
        #${APP_ID} .tlt-panel-grid,
        #${APP_ID} .tlt-settings-grid,
        #${APP_ID} .tlt-user-summary,
        #${APP_ID} .tlt-profile-grid,
        #${APP_ID} .tlt-summary,
        #${APP_ID} .tlt-steps,
        #${APP_ID} .tlt-advanced-picker,
        #${APP_ID} .tlt-form {
          grid-template-columns: 1fr 1fr;
        }
        #${APP_ID} .tlt-ledger-controls {
          flex-basis: 100%;
          justify-content: flex-start;
          margin-left: 0;
        }
        #${APP_ID} .tlt-ledger-controls input[type="search"],
        #${APP_ID} .tlt-ledger-controls select,
        #${APP_ID} .tlt-ledger-controls button {
          flex: 1 1 150px;
        }
        #${APP_ID} .tlt-panel-grid {
          grid-template-columns: 1fr;
        }
        #${APP_ID} .tlt-form textarea,
        #${APP_ID} .tlt-form button {
          grid-column: span 2;
        }
        #${APP_ID} .tlt-foot {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `;
    targetDocument.head.appendChild(style);
  }

  function render() {
    scheduleCompletedSyncDismiss();
    renderInto(document, false);
    renderPopup();
  }

  function renderPopup() {
    if (!popupWindow || popupWindow.closed) return;
    renderInto(popupWindow.document, true);
  }

  function renderInto(targetDocument, isPopup) {
    if (isPopup) syncGlobalThemeToDocument(targetDocument);
    injectStyles(targetDocument);
    injectVisionStyles(targetDocument);
    targetDocument.documentElement.classList.toggle("tlt-popup-document", Boolean(isPopup));
    ensureRenderableActiveTab();
    let root = targetDocument.getElementById(APP_ID);
    if (!root) {
      root = targetDocument.createElement("section");
      root.id = APP_ID;
      targetDocument.body.appendChild(root);
    }

    const model = tfModel();
    root.className = ["mh-root", isPopup ? "is-popup" : (state.panelOpen ? "is-open" : "is-collapsed")].filter(Boolean).join(" ");
    root.dataset.mhComponent = "root";
    root.innerHTML = tfShellHtml(model, isPopup);

    if (!isPopup) applyPanelPosition(root);
    bind(root, isPopup);
  }

  function allTabs() {
    return SIMPLE_TABS;
  }

  function tabsHtml() {
    const activeTab = ensureRenderableActiveTab();
    return allTabs().map((tab) => {
      const isActive = activeTab === tab.id;
      return `
      <button type="button" role="tab" class="${isActive ? "is-active" : ""}" aria-selected="${isActive ? "true" : "false"}" tabindex="${isActive ? "0" : "-1"}" data-tab="${escapeAttr(tab.id)}">${tfIcon(tab.icon)}<span class="tf-nav-label">${escapeHtml(tab.label)}</span></button>
    `;
    }).join("");
  }

  function activeTabHtml(model) {
    ensureRenderableActiveTab();
    if (state.activeTab === "dashboard") return tfDashboardHtml(model);
    if (state.activeTab === "properties") return tfPropertiesHtml(model);
    if (state.activeTab === "rentals") return tfRentalsHtml(model);
    if (state.activeTab === "market") return tfMarketHtml(model);
    if (state.activeTab === "archive") return tfArchiveHtml(model);
    if (state.activeTab === "insights") return tfInsightsHtml(model);
    return tfDashboardHtml(model);
  }

  function userPanelHtml() {
    const access = keyInfoAccess(state.keyInfo);
    const userId = keyInfoUserId(state.keyInfo);
    const keyMask = maskedApiKey();
    return `
      <div class="tlt-panel-grid">
        <div class="tlt-endpoint">
          <strong>Bring in my Torn homes</strong>
          <span class="tlt-muted">Save your key first. Then fetch once and let the tool fill the list.</span>
          ${keyMask ? `<div class="tlt-badge">Key saved ${escapeHtml(keyMask)}</div>` : `<div class="tlt-badge">No key saved</div>`}
          ${serverAccessHtml() ? `<div class="tlt-result">${serverAccessHtml()}</div>` : ""}
          <button type="button" data-tab="settings">Go to Settings</button>
          <button class="tlt-primary" type="button" data-action="refresh-user-details">Fetch everything</button>
          <button type="button" data-action="import-owned">Fetch homes I rent out</button>
          <button type="button" data-action="import-current">Fetch the home I use</button>
          <button type="button" data-action="fetch-spouse-properties">Fetch partner homes</button>
          ${userId ? `<div class="tlt-result">User ID ${escapeHtml(userId)}. Access: ${escapeHtml((access && access.type) || "unknown")}.</div>` : ""}
        </div>
        <div>
          ${userDetailsHtml()}
        </div>
      </div>
    `;
  }

  function settingsHtml() {
    const settings = appSettings();
    const keyMask = maskedApiKey();
    return `
      <div class="tlt-settings-grid">
        <div class="tlt-settings-card">
          <strong>1. Save your Torn key</strong>
          <span class="tlt-muted">Paste your public Torn key. It checks access and fetches your homes.</span>
          <label>
            Torn public key
            <input type="text" data-api-key-input placeholder="${keyMask ? "Paste a new key only if you want to replace it" : "Paste key here"}" autocomplete="off" autocapitalize="off" spellcheck="false">
          </label>
          ${keyMask ? `<div class="tlt-result">Saved key: ${escapeHtml(keyMask)}</div>` : `<div class="tlt-result">No key saved yet.</div>`}
          ${subscriptionStatusHtml()}
          <div class="tlt-actions">
            <button class="tlt-primary" type="button" data-action="save-api-key">Save key</button>
            <button type="button" data-action="check-key">Test key</button>
            <button type="button" data-action="verify-hosted-access">Check subscription</button>
            <button class="tlt-danger" type="button" data-action="clear-key">Clear key</button>
          </div>
        </div>
        <div class="tlt-settings-card">
          <strong>2. Choose easy defaults</strong>
          <label>
            Rows to show in big tables
            <input type="number" min="10" max="250" step="5" data-setting-field="tableLimit" value="${escapeAttr(tableLimit())}">
          </label>
          <label>
            Torn call speed
            <select data-setting-field="tornRateLimitPerMinute">
              ${tornRateLimitOptionsHtml()}
            </select>
          </label>
          <label>
            Property history
            <select data-setting-field="propertyHistoryPages">
              ${propertyHistoryPagesOptionsHtml()}
            </select>
          </label>
          <label class="tlt-setting-row">
            <input type="checkbox" data-setting-field="showRawJson"${settings.showRawJson ? " checked" : ""}>
            <span>Show extra Torn text below tables</span>
          </label>
          <label class="tlt-setting-row">
            <input type="checkbox" data-setting-field="showAdvancedTools"${settings.showAdvancedTools ? " checked" : ""}>
            <span>Show Advanced tab</span>
          </label>
        </div>
        <div class="tlt-settings-card">
          <strong>3. Rent suggestion targets</strong>
          <span class="tlt-muted">Used when the tool suggests a rent price.</span>
          <label>
            Target yearly ROI %
            <input type="number" min="0.1" max="500" step="0.1" data-setting-field="targetAnnualRoi" value="${escapeAttr(targetAnnualRoi())}">
          </label>
          <label>
            Lease days for suggested total
            <input type="number" min="1" max="100" step="1" data-setting-field="defaultSuggestionLeaseDays" value="${escapeAttr(defaultSuggestionLeaseDays())}">
          </label>
        </div>
        <div class="tlt-settings-card">
          <strong>Window</strong>
          <span class="tlt-muted">Drag the top bar to move this box. Drag the lower-right corner to resize it.</span>
          <button type="button" data-action="reset-position">Put window back</button>
        </div>
      </div>
    `;
  }

  function endpointPanelHtml(endpoint) {
    return `
      <div class="tlt-panel-grid">
        <div class="tlt-endpoint">
          <strong>${escapeHtml(endpoint.label)}</strong>
          <code>GET ${escapeHtml(displayEndpointPath(endpoint))}</code>
          <span class="tlt-muted">${escapeHtml(endpoint.detail)}</span>
          ${endpoint.path.includes("{id}") && !endpoint.spouseOnly ? userLookupInputHtml() : ""}
          ${endpoint.needsPropertyType ? propertyTypeSelectHtml() : ""}
          <button class="tlt-primary" type="button" data-action="${escapeAttr(endpoint.action)}">${escapeHtml(endpoint.actionLabel)}</button>
          ${endpointResultHtml(endpoint.id)}
        </div>
        <div>
          ${dataViewHtml(endpoint.id)}
        </div>
      </div>
    `;
  }

  function insightsHtml() {
    const suggestions = serverRentSuggestionRows();
    const roiSummary = serverRoiSummaryRows();
    const metadata = serverInsightsMetadata();
    const updated = metadata.scanned_at || metadata.updatedAt || metadata.updated_at || metadata.fetchedAt || "";
    return `
      <div class="tlt-panel-grid">
        <div class="tlt-endpoint">
          <strong>Rent suggestions</strong>
          <span class="tlt-muted">Fetch your homes. The tool checks matching listings and shows the useful answer.</span>
          <button class="tlt-primary" type="button" data-action="refresh-user-details">Fetch everything</button>
          <button type="button" data-action="scan-owned-property-market">Scan ROI/Listings</button>
          <button type="button" data-action="export-rent-suggestions-csv">Export suggestions CSV</button>
          ${endpointResultHtml("server-sync")}
          ${updated ? `<div class="tlt-result">Market data checked ${escapeHtml(new Date(updated).toLocaleString())}.</div>` : ""}
        </div>
        <div>
          ${suggestions.length ? dataTableHtml({ suggestions }, "rent-suggestions") : `<div class="tlt-muted">No suggestions yet. Press Fetch everything.</div>`}
        </div>
      </div>
      ${roiSummary.length ? `<div class="tlt-section-title">Market summary</div>${dataTableHtml({ roiSummary }, "roi-summary")}` : ""}
    `;
  }

  function serverRentSuggestionRows() {
    const bodies = [endpointBody("server-insights"), endpointBody("server-sync")].filter(Boolean);
    for (const body of bodies) {
      const rows = firstArray(body, ["suggestions", "rentSuggestions", "rent_suggestions"]);
      if (rows.length) return rows;
    }
    return [];
  }

  function serverRoiSummaryRows() {
    const bodies = [endpointBody("server-insights"), endpointBody("server-sync")].filter(Boolean);
    for (const body of bodies) {
      const rows = firstArray(body, ["roiSummary", "roi_summary", "marketSummary", "market_summary"]);
      const cleaned = cleanRoiSummaryRows(rows);
      if (cleaned.length) return cleaned;
    }
    return [];
  }

  function cleanRoiSummaryRows(rows) {
    if (!Array.isArray(rows)) return [];
    const byKey = new Map();
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const normalized = normalizeRoiSummaryRow(row);
      const key = roiSummaryKey(normalized);
      const existing = byKey.get(key);
      byKey.set(key, existing ? mergeRoiSummaryRows(existing, normalized) : normalized);
    }
    return Array.from(byKey.values()).filter((row) => roiSummaryHasUsefulData(row) || clean(row.error, ""));
  }

  function normalizeRoiSummaryRow(row) {
    const normalized = { ...row };
    const kind = clean(row.kind, "").toLowerCase();
    normalized.avg_market_price = firstValue(row.avg_market_price, row.avg_price);
    normalized.median_market_price = firstValue(row.median_market_price, row.median_price);
    normalized.min_market_price = firstValue(row.min_market_price, row.min_price);
    normalized.max_market_price = firstValue(row.max_market_price, row.max_price);
    normalized.avg_happy = firstValue(row.avg_happy, row.happy);
    normalized.error = cleanRoiSummaryError(row.error);
    if (kind === "rentals") {
      normalized.rental_listings = firstValue(row.rental_listings, row.listings);
    } else if (kind === "properties") {
      normalized.sale_listings = firstValue(row.sale_listings, row.listings);
      if (!normalized.rental_listings) normalized.listings = "";
    }
    if (!normalized.listings) normalized.listings = firstValue(normalized.rental_listings, normalized.sale_listings, row.listings);
    return normalized;
  }

  function roiSummaryKey(row) {
    const typeId = propertyTypeId(row && (row._property_type_id || row.property_type_id || row.type_id || row.property_type || row.property));
    const typeName = normalizeLookup(row && (row.property_type || row.property || row.name || ""));
    const happy = clean(row && (row.happy || row.avg_happy), "");
    return `${typeId || typeName || "unknown"}:${happy}`;
  }

  function mergeRoiSummaryRows(previous, incoming) {
    const merged = { ...previous };
    const keys = new Set([...Object.keys(previous || {}), ...Object.keys(incoming || {})]);
    for (const key of keys) {
      if (key === "error") continue;
      const current = merged[key];
      const next = incoming[key];
      if (["listings", "rental_listings", "sale_listings"].includes(key)) {
        const max = Math.max(Number(current) || 0, Number(next) || 0);
        merged[key] = max || firstValue(current, next);
      } else if (isBlankValue(current) && !isBlankValue(next)) {
        merged[key] = next;
      }
    }
    const error = [cleanRoiSummaryError(previous && previous.error), cleanRoiSummaryError(incoming && incoming.error)]
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join("; ");
    merged.error = error;
    return merged;
  }

  function firstValue(...values) {
    return values.find((value) => !isBlankValue(value)) ?? "";
  }

  function cleanRoiSummaryError(value) {
    const text = clean(value, "");
    if (/list'\s*object\s*has\s*no\s*attribute\s*'get/i.test(text)) return "";
    return text;
  }

  function roiSummaryHasUsefulData(row) {
    const keys = [
      "listings",
      "rental_listings",
      "sale_listings",
      "avg_daily",
      "median_daily",
      "min_daily",
      "max_daily",
      "avg_market_price",
      "median_market_price",
      "min_market_price",
      "max_market_price",
      "avg_landlord_roi_market",
      "best_landlord_roi_market",
      "avg_landlord_roi_investment",
      "avg_rent_per_happy",
      "avg_tenant_cost_per_happy",
    ];
    return keys.some((key) => {
      const value = row && row[key];
      if (isBlankValue(value)) return false;
      const number = Number(value);
      return Number.isFinite(number) ? number > 0 : true;
    });
  }

  function serverInsightsMetadata() {
    const body = endpointBody("server-insights") || endpointBody("server-sync") || {};
    return body.metadata || body._metadata || {};
  }

  function serverArchiveRows() {
    const bodies = [endpointBody("lease-archive"), endpointBody("server-sync")].filter(Boolean);
    for (const body of bodies) {
      const rows = firstArray(body, ["archive", "tenancyArchive", "tenancy_archive", "leaseArchive", "lease_archive"]);
      if (rows.length) return rows;
    }
    return [];
  }

  function serverPropertyHistoryRows() {
    const bodies = [endpointBody("property-history"), endpointBody("server-sync")].filter(Boolean);
    for (const body of bodies) {
      const rows = firstArray(body, ["history", "propertyHistory", "property_history"]);
      if (rows.length) return rows;
    }
    return [];
  }

  function serverPropertyHistoryEventRows() {
    const bodies = [endpointBody("property-history"), endpointBody("server-sync")].filter(Boolean);
    for (const body of bodies) {
      const rows = firstArray(body, ["events", "propertyHistoryEvents", "property_history_events", "propertyLogs", "property_logs"]);
      if (rows.length) return rows;
    }
    return [];
  }

  function serverHistoryMetadata() {
    const body = endpointBody("property-history") || endpointBody("lease-archive") || endpointBody("server-sync") || {};
    return body.metadata || body._metadata || {};
  }

  function historyEmptyMessage(metadata = {}) {
    return clean(metadata.historyError || metadata.history_error, "") || "No property history found yet.";
  }

  function historyStatusHtml(metadata = {}) {
    const error = clean(metadata.historyError || metadata.history_error, "");
    if (error) return `<div class="tlt-result">${escapeHtml(error)}</div>`;
    const count = Number(metadata.historyEventCount || metadata.history_event_count || 0);
    const fetched = Number(metadata.historyFetchedCount || metadata.history_fetched_count || 0);
    if (count) return `<div class="tlt-result">Property history has ${count.toLocaleString()} saved events${fetched ? `, ${fetched.toLocaleString()} refreshed now` : ""}.</div>`;
    return "";
  }

  function advancedHtml() {
    const endpoint = selectedAdvancedEndpoint();
    return `
      <div class="tlt-guide">
        <strong>Advanced tools</strong>
        <span class="tlt-muted">Most people can ignore this page. It is here when you want to inspect one Torn property answer.</span>
      </div>
      <div class="tlt-advanced-picker">
        <select data-advanced-endpoint>
          ${advancedEndpoints().map((item) => `<option value="${escapeAttr(item.id)}"${item.id === endpoint.id ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
        </select>
        <span class="tlt-muted">Choose one tool at a time so the page stays readable.</span>
      </div>
      ${endpointPanelHtml(endpoint)}
      <div class="tlt-section-title">Known property pictures</div>
      ${propertyImageLegendHtml()}
    `;
  }

  function advancedEndpoints() {
    return ENDPOINTS.filter((endpoint) => !endpoint.spouseOnly || profileSpouse());
  }

  function selectedAdvancedEndpoint() {
    const endpoints = advancedEndpoints();
    const selected = endpoints.find((endpoint) => endpoint.id === state.advancedEndpointId);
    return selected || endpoints.find((endpoint) => endpoint.id === ADVANCED_DEFAULT_ENDPOINT) || endpoints[0] || ENDPOINTS[0];
  }

  function inventoryRows() {
    const buckets = [
      ["Your properties", endpointBody("user-properties")],
      ["Lookup properties", endpointBody("user-id-properties")],
      ["Spouse properties", spouseOwnedPropertiesBody(endpointBody("spouse-properties"))],
    ];
    const rows = [];
    const seen = new Set();

    for (const [sourceLabel, body] of buckets) {
      for (const property of propertiesFromBody(body)) {
        const key = `${property.id || property.property_id || ""}:${formatObject(property.owner || {})}:${propertyName(property.property) || propertyName(property)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ _source: sourceLabel, ...property });
      }
    }

    for (const [sourceLabel, body] of [["Current property", endpointBody("user-property")], ["Lookup current property", endpointBody("user-id-property")]]) {
      const property = currentPropertyFromBody(body);
      if (!property) continue;
      const key = `${property.id || property.property_id || ""}:${formatObject(property.owner || {})}:${propertyName(property.property) || propertyName(property)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ _source: sourceLabel, ...property, lease_status: currentPropertyLeaseStatus(property).label });
    }

    return rows;
  }

  function roiScannerHtml() {
    return `
      <div class="tlt-endpoint">
        <strong>Market check</strong>
        <span class="tlt-muted">Market checks happen quietly and return suggestions.</span>
        <div class="tlt-actions">
          <button class="tlt-primary" type="button" data-action="scan-owned-property-market">Scan ROI/Listings</button>
        </div>
      </div>
    `;
  }

  function bestRoiRow(rows) {
    return rows
      .filter((row) => Number.isFinite(Number(row.landlord_roi_market)))
      .sort((a, b) => Number(b.landlord_roi_market) - Number(a.landlord_roi_market))[0] || null;
  }

  function rentSuggestionsHtml() {
    const rows = serverRentSuggestionRows();
    return `
      <div class="tlt-endpoint">
        <strong>Rent suggestions</strong>
        <span class="tlt-muted">Suggestions are calculated quietly.</span>
        <div class="tlt-actions">
          <button class="tlt-primary" type="button" data-action="scan-owned-property-market">Scan ROI/Listings</button>
          <button type="button" data-action="export-rent-suggestions-csv">Export suggestions CSV</button>
        </div>
      </div>
      ${rows.length ? dataTableHtml({ suggestions: rows }, "rent-suggestions") : `<div class="tlt-muted">No suggestions yet. Press Fetch everything.</div>`}
    `;
  }

  function rentSuggestionRows() {
    const owned = myOwnedPropertyRows();
    const summaries = rentalSummaryByTypeId();
    return owned.map((row) => rentSuggestionRow(row, summaries)).sort((a, b) => {
      const statusA = clean(a.status, "");
      const statusB = clean(b.status, "");
      return statusA.localeCompare(statusB) || clean(a.property).localeCompare(clean(b.property));
    });
  }

  function myOwnedPropertyRows() {
    const ownedBody = endpointBody("user-properties");
    const direct = propertiesFromBody(ownedBody);
    if (direct.length) return direct;

    const myId = keyInfoUserId(state.keyInfo) || ((state.endpointInputs || {}).userId);
    const myName = profileInfo() && profileInfo().name;
    return inventoryRows().filter((row) => {
      if (!row || !row.owner) return false;
      return (myId && ownerMatchesLookup(row, myId)) || (myName && ownerMatchesLookup(row, myName));
    });
  }

  function spousePropertyRows() {
    return propertiesFromBody(spouseOwnedPropertiesBody(endpointBody("spouse-properties")));
  }

  function rentalSummaryByTypeId() {
    const body = endpointBody("roi-scanner") || {};
    const summary = Array.isArray(body.summary) ? body.summary : [];
    return new Map(summary.map((row) => [String(row._property_type_id || propertyTypeId(row.property_type)), row]));
  }

  function rentSuggestionRow(row, summaries) {
    const type = propertyTypeForRow(row) || {};
    const propertyId = propertyCostKey(row);
    const period = rentalPeriod(row);
    const totalRent = rentalTotal(row, period);
    const currentDaily = rentalDaily(row, period, totalRent);
    const marketPrice = marketPriceValue(row, type);
    const baseCost = moneyNumber(type.cost);
    const upgradeCost = estimatedUpgradeCost(row, type);
    const estimatedInvestment = estimatedInvestmentCost(row, type);
    const manualInvestment = manualInvestmentForRow(row);
    const investmentBasis = manualInvestment || estimatedInvestment || marketPrice;
    const targetRoi = targetAnnualRoi();
    const targetDaily = investmentBasis ? roundRent((investmentBasis * (targetRoi / 100)) / 365) : "";
    const summary = summaries.get(String(type.id || propertyTypeIdFromRow(row))) || {};
    const marketMedian = moneyNumber(summary.median_daily);
    const marketAverage = moneyNumber(summary.avg_daily);
    const marketMin = moneyNumber(summary.min_daily);
    const marketMax = moneyNumber(summary.max_daily);
    const suggestedDaily = suggestedDailyRent(targetDaily, summary);
    const leaseDays = defaultSuggestionLeaseDays();
    const annualRent = suggestedDaily ? suggestedDaily * 365 : "";
    const note = rentSuggestionNote(row, currentDaily, targetDaily, suggestedDaily, summary);

    return {
      ...row,
      id: row.id || row.property_id || row.propertyId || "",
      property: propertyName(row.property) || propertyName(row) || clean(row.id || row.property_id, "Property"),
      property_type: type.name || propertyName(row.property) || propertyName(row),
      market_price: marketPrice,
      base_cost: baseCost,
      estimated_upgrade_cost: upgradeCost,
      estimated_investment: estimatedInvestment,
      my_investment: manualInvestment,
      investment_basis: investmentBasis,
      target_roi: targetRoi,
      current_cost_per_day: currentDaily,
      market_median_daily: marketMedian,
      market_avg_daily: marketAverage,
      market_min_daily: marketMin,
      market_max_daily: marketMax,
      target_rent_per_day: targetDaily,
      suggested_rent_per_day: suggestedDaily,
      suggested_total: suggestedDaily ? suggestedDaily * leaseDays : "",
      suggested_roi: roiPercent(annualRent, investmentBasis),
      suggestion_note: note,
      _property_type_id: type.id || propertyTypeIdFromRow(row),
      _property_cost_key: propertyId,
    };
  }

  function suggestedDailyRent(targetDaily, summary) {
    const target = moneyNumber(targetDaily);
    const median = moneyNumber(summary && summary.median_daily);
    const average = moneyNumber(summary && summary.avg_daily);
    const min = moneyNumber(summary && summary.min_daily);
    const max = moneyNumber(summary && summary.max_daily);
    const marketAnchor = median || average;

    if (!target) return roundRent(marketAnchor || "");
    if (!marketAnchor) return target;
    if (min && target < min) return roundRent(min);
    if (max && target > max) return roundRent(max);
    return roundRent(target);
  }

  function rentSuggestionNote(row, currentDaily, targetDaily, suggestedDaily, summary) {
    const status = clean(row && row.status, "none").toLowerCase();
    const notes = [];
    const current = moneyNumber(currentDaily);
    const target = moneyNumber(targetDaily);
    const suggested = moneyNumber(suggestedDaily);
    const max = moneyNumber(summary && summary.max_daily);
    const min = moneyNumber(summary && summary.min_daily);

    if (!summary || !summary.listings) notes.push("No market scan yet");
    if (target && max && target > max) notes.push("target ROI is above the current market range");
    if (target && min && target < min) notes.push("market supports more than target ROI");
    if (status === "rented" && current && suggested) {
      if (current < suggested) notes.push(`current rent is ${money(suggested - current)}/day under suggestion`);
      else if (current > suggested) notes.push(`current rent is ${money(current - suggested)}/day over suggestion`);
      else notes.push("current rent matches suggestion");
    } else if (status === "none") {
      notes.push("not rented in the latest fetched data");
    }
    return notes.join("; ") || "fair market/investment match";
  }

  function rentSuggestionColumns() {
    return ["property_image", "id", "property", "status", "happy", "market_price", "base_cost", "estimated_upgrade_cost", "estimated_investment", "my_investment", "investment_basis", "target_roi", "current_cost_per_day", "market_median_daily", "market_avg_daily", "target_rent_per_day", "suggested_rent_per_day", "suggested_total", "suggested_roi", "suggestion_note"];
  }

  function rentSuggestionTableHtml(rows) {
    const keys = rentSuggestionColumns();
    return `
      <div class="tlt-table-wrap">
        <table class="tlt-data-table mh-table" data-mh-component="table">
          <thead><tr>${keys.map((key) => `<th>${escapeHtml(humanHeader(key))}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.map((row) => `<tr>${keys.map((key) => `<td class="${cellClass(cellValue(row, key), key)}">${rentSuggestionCellHtml(row, key)}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function rentSuggestionCellHtml(row, key) {
    if (key === "my_investment") {
      const value = manualInvestmentForRow(row);
      return `<input class="tlt-money-input" data-property-cost="${escapeAttr(row._property_cost_key || propertyCostKey(row))}" type="text" inputmode="numeric" placeholder="${escapeAttr(currencyInputValue(row.estimated_investment || row.market_price))}" value="${escapeAttr(currencyInputValue(value))}">`;
    }
    return cellHtml(cellValue(row, key), key, row);
  }

  function manualPropertyOptionsHtml() {
    const sourceRole = state.role === "spouse" ? "spouse" : "landlord";
    const owned = state.role === "spouse" ? spousePropertyRows() : myOwnedPropertyRows();
    if ((state.role === "landlord" || state.role === "spouse" || state.role === "all") && owned.length) {
      return [
        `<option value="">${state.role === "spouse" ? "Choose one spouse property" : "Choose one of my properties"}</option>`,
        ...owned.map((property) => {
          const lease = normalizeLease(property, sourceRole);
          const status = clean(lease.status, "none");
          const tenant = lease.tenant ? ` - ${lease.tenant}` : "";
          const label = `${lease.property}${lease.propertyId ? ` #${lease.propertyId}` : ""} (${status}${tenant})`;
          return `<option value="${escapeAttr(lease.property)}"
            data-owned-property="true"
            data-role-hint="${escapeAttr(sourceRole)}"
            data-property-id="${escapeAttr(lease.propertyId)}"
            data-landlord="${escapeAttr(lease.landlord)}"
            data-tenant="${escapeAttr(lease.tenant)}"
            data-duration-days="${escapeAttr(lease.durationDays)}"
            data-amount="${escapeAttr(lease.amount)}"
            data-daily-amount="${escapeAttr(lease.dailyAmount)}"
            data-start-date="${escapeAttr(lease.startDate)}"
            data-end-date="${escapeAttr(lease.endDate)}"
            data-remaining-days="${escapeAttr(lease.remainingDays)}"
            data-status="${escapeAttr(status)}">${escapeHtml(label)}</option>`;
        }),
      ].join("");
    }
    if (state.role === "landlord" || state.role === "spouse" || state.role === "all") {
      return `<option value="">Fetch homes first</option>`;
    }
    return [
      `<option value="">Select property type</option>`,
      ...propertyTypes().map((type) => `<option value="${escapeAttr(type.name)}">${escapeHtml(type.name)}</option>`),
    ].join("");
  }

  function fillManualFormFromOwnedProperty(form) {
    const propertyField = form && form.elements && form.elements.property;
    if (!propertyField) return;
    const option = propertyField.selectedOptions && propertyField.selectedOptions[0];
    if (!option || option.dataset.ownedProperty !== "true") return;

    const setValue = (name, value) => {
      if (form.elements[name]) form.elements[name].value = value || "";
    };

    setValue("propertyId", option.dataset.propertyId);
    setValue("landlord", option.dataset.landlord);
    const tenant = splitUserLabel(option.dataset.tenant);
    setValue("tenantName", tenant.name);
    setValue("tenantId", tenant.id);
    setValue("durationDays", option.dataset.durationDays);
    setValue("amount", currencyInputValue(option.dataset.amount));
    setValue("dailyAmount", currencyInputValue(option.dataset.dailyAmount));
    setValue("startDate", option.dataset.startDate);
    setValue("endDate", option.dataset.endDate);
    const daysLeft = form.querySelector("[data-manual-days-left]");
    if (daysLeft) daysLeft.textContent = option.dataset.remainingDays || "Auto";
    if (form.elements.status) form.elements.status.value = option.dataset.status || "none";
    if (form.elements.roleHint) form.elements.roleHint.value = option.dataset.roleHint || "landlord";
  }

  async function lookupManualTenant(form, sourceName) {
    if (!form || !apiKeyValue()) return;
    const nameField = form.elements.tenantName;
    const idField = form.elements.tenantId;
    const lookup = clean(sourceName === "tenantId" ? idField && idField.value : nameField && nameField.value, "");
    if (!lookup) return;
    setStatus(`Looking up renter ${lookup}...`);
    const body = await fetchUserProfileByLookup(lookup);
    const profile = body.profile || body.user || body;
    if (profile && profile.name && nameField && !nameField.value.trim()) nameField.value = profile.name;
    if (profile && profile.id && idField && !idField.value.trim()) idField.value = profile.id;
    if (profile && (profile.name || profile.id)) {
      setStatus(`Renter found: ${userLabelFromParts(profile.name, profile.id)}.`);
    } else {
      setStatus("Renter lookup returned no matching username or ID.", true);
    }
  }

  async function fetchUserProfileByLookup(lookup) {
    const value = clean(lookup, "");
    if (!value) throw new Error("Enter a renter username or user ID first.");
    try {
      return await apiGet(`/user/${encodeURIComponent(value)}`, { selections: "profile", key: apiKeyValue() });
    } catch (_error) {
      return apiGet("/user", { selections: "profile", id: value, key: apiKeyValue() });
    }
  }

  function manualTenantOptionsHtml() {
    const profile = profileInfo();
    const spouse = profileSpouse();
    const options = [];
    if (profile && profile.name) options.push(profile.name);
    else options.push("Me");
    if (spouse && spouse.name && !options.includes(spouse.name)) options.push(spouse.name);
    return options.map((name) => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join("");
  }

  function gettingStartedHtml(summary) {
    const hasKey = Boolean(apiKeyValue());
    const hasLeases = Boolean(summary.total || state.leases.length);
    if (hasKey && hasLeases) return "";
    return `
      <div class="tlt-guide">
        <strong>Start here</strong>
        <div class="tlt-steps">
          <div class="tlt-step">
            <b>1. Save key</b>
            <span>${hasKey ? "Done. Your key is saved." : "Needed for the fetch buttons."}</span>
            <button type="button" data-tab="settings">${hasKey ? "Settings" : "Save key"}</button>
          </div>
          <div class="tlt-step">
            <b>2. Fetch homes</b>
            <span>Let the tool fill in owned and current homes.</span>
            <button type="button" data-tab="user-panel">Fetch</button>
          </div>
          <div class="tlt-step">
            <b>3. Check list</b>
            <span>Add missing details by hand below.</span>
            <button type="button" data-tab="ledger">Leases</button>
          </div>
        </div>
      </div>
    `;
  }

  function statusOptionsHtml(current) {
    const selected = normalizeLeaseStatus(current);
    return leaseStatusOptions().map(([value, label]) => `<option value="${value}"${selected === value ? " selected" : ""}>${label}</option>`).join("");
  }

  function statusFilterOptionsHtml() {
    const selected = clean(state.statusFilter || "all", "all");
    const options = [["all", "All statuses"], ...leaseStatusOptions()];
    const seen = new Set(options.map(([value]) => value));
    for (const lease of state.leases || []) {
      const value = clean(lease && lease.status, "");
      if (value && !seen.has(value)) {
        const normalized = normalizeLeaseStatus(value, lease.roleHint || lease.source, lease.tenant);
        if (!seen.has(normalized)) {
          seen.add(normalized);
          options.push([normalized, leaseStatusLabel(normalized)]);
        }
      }
    }
    return options.map(([value, label]) => `<option value="${escapeAttr(value)}"${selected === value ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
  }

  function leaseStatusOptions() {
    return [
      ["manual", "Manual"],
      ["rented", "Leased to"],
      ["leased", "Leased from"],
      ["rent_to", "Rent to"],
      ["rent_from", "Rent from"],
      ["for_rent", "Listed"],
      ["ended", "Expired"],
      ["sold", "Sold"],
    ];
  }

  function leaseStatusLabel(value) {
    const found = leaseStatusOptions().find(([key]) => key === value);
    return found ? found[1] : humanHeader(value);
  }

  function ledgerControlsHtml() {
    return `
      <div class="tlt-ledger-controls" role="group" aria-label="Lease filters and actions">
        <input type="search" data-field="search" placeholder="Find a lease" value="${escapeAttr(state.search)}">
        <select data-field="role" aria-label="Which homes to show">
          <option value="landlord"${state.role === "landlord" ? " selected" : ""}>Homes I rent out</option>
          <option value="spouse"${state.role === "spouse" ? " selected" : ""}>Spouse properties</option>
          <option value="tenant"${state.role === "tenant" ? " selected" : ""}>Homes I use</option>
          <option value="market"${state.role === "market" ? " selected" : ""}>Market</option>
          <option value="contracts"${state.role === "contracts" ? " selected" : ""}>Lease offers / contracts</option>
          <option value="all"${state.role === "all" ? " selected" : ""}>Everything</option>
        </select>
        <select data-field="statusFilter" aria-label="Lease status">
          ${statusFilterOptionsHtml()}
        </select>
        <button class="tlt-primary" type="button" data-action="scan-owned-property-market">Scan ROI/Listings</button>
        <button type="button" data-action="import-owned-direct">Reload Torn details</button>
        <button type="button" data-action="export-csv">Export CSV</button>
        <button class="tlt-primary" type="button" data-action="open-manual-modal">+ Add</button>
      </div>
    `;
  }

  function ledgerHtml(leases, summary) {
    const sortedLeases = sortRows(leases, "ledger");
    return `
      <div class="tlt-ledger-view">
        ${gettingStartedHtml(summary)}
        <div class="tlt-summary">
          <div class="tlt-stat"><span class="tlt-muted">Rows shown</span><b>${summary.total}</b></div>
          <div class="tlt-stat"><span class="tlt-muted">Rented now</span><b>${summary.leased}</b></div>
          <div class="tlt-stat"><span class="tlt-muted">Rent total</span><b>${money(summary.income)}</b></div>
          <div class="tlt-stat"><span class="tlt-muted">Ends soon</span><b>${summary.soon}</b></div>
        </div>
        <div class="tlt-table-wrap">
          <table class="tlt-lease-table mh-table" data-mh-component="table">
            <thead>
              <tr>
                <th>${sortHeaderHtml("ledger", "property", "Home")}</th>
                <th>${sortHeaderHtml("ledger", "landlord", "Owner")}</th>
                <th>${sortHeaderHtml("ledger", "status", "Status")}</th>
                <th>${sortHeaderHtml("ledger", "tenant", "Renter")}</th>
                <th>${sortHeaderHtml("ledger", "durationDays", "Days")}</th>
                <th>${sortHeaderHtml("ledger", "amount", "Total")}</th>
                <th>${sortHeaderHtml("ledger", "dailyAmount", "Per day")}</th>
                <th>${sortHeaderHtml("ledger", "startDate", "Starts")}</th>
                <th>${sortHeaderHtml("ledger", "endDate", "Ends")}</th>
                <th>${sortHeaderHtml("ledger", "remainingDays", "Left")}</th>
                <th>${sortHeaderHtml("ledger", "notes", "Notes")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${sortedLeases.length ? sortedLeases.map(rowHtml).join("") : emptyRowsHtml()}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function archiveHtml() {
    const rows = serverArchiveRows();
    const metadata = serverHistoryMetadata();
    return `
      <div class="tlt-panel-grid">
        <div class="tlt-endpoint">
          <strong>Archive</strong>
          <span class="tlt-muted">Past rents go here when Torn history is available.</span>
          <button class="tlt-primary" type="button" data-action="refresh-user-details">Fetch everything</button>
          ${endpointResultHtml("lease-archive")}
          ${historyStatusHtml(metadata)}
        </div>
        <div>
          ${rows.length ? dataTableHtml({ archive: rows }, "lease-archive") : `<div class="tlt-muted">No archive rows yet. Fetch with a key that can read property history.</div>`}
        </div>
      </div>
    `;
  }

  function historyHtml() {
    const rows = serverPropertyHistoryRows();
    const events = serverPropertyHistoryEventRows();
    const metadata = serverHistoryMetadata();
    return `
      <div class="tlt-panel-grid">
        <div class="tlt-endpoint">
          <strong>Property history</strong>
          <span class="tlt-muted">Bought, upgraded, rented, sold, and moved homes are grouped here.</span>
          <button class="tlt-primary" type="button" data-action="refresh-user-details">Fetch everything</button>
          ${endpointResultHtml("property-history")}
          ${historyStatusHtml(metadata)}
        </div>
        <div>
          ${rows.length ? dataTableHtml({ history: rows }, "property-history") : `<div class="tlt-muted">No property history yet. Fetch with a key that can read property history.</div>`}
        </div>
      </div>
      ${events.length ? `<div class="tlt-section-title">Timeline</div>${dataTableHtml({ events }, "property-history-events")}` : ""}
    `;
  }

  function manualLeaseModalHtml() {
    return `
      <div class="tlt-modal-backdrop" data-action="close-manual-modal">
        <div class="tlt-modal" role="dialog" aria-modal="true" aria-label="Add lease by hand" data-modal-stop>
          <div class="tlt-modal-head">
            <div>
              <strong>Add one by hand</strong>
              <span class="tlt-muted">Fill what you know. The dates and rent fields help each other.</span>
            </div>
            <button class="tlt-ghost" type="button" data-action="close-manual-modal">Close</button>
          </div>
          ${manualLeaseFormHtml()}
        </div>
      </div>
    `;
  }

  function manualLeaseFormHtml() {
    return `
      <form class="tlt-form" data-form="manual">
        <label class="tlt-form-field"><span>Home type</span><select name="property">${manualPropertyOptionsHtml()}</select></label>
        <label class="tlt-form-field"><span>Torn property ID</span><input name="propertyId" data-manual-property-id placeholder="Optional"></label>
        <label class="tlt-form-field"><span>Owner</span><input name="landlord" placeholder="Auto-filled if found"></label>
        <label class="tlt-form-field"><span>Renter username</span><input name="tenantName" list="tlt-tenant-options" placeholder="If known"><datalist id="tlt-tenant-options">${manualTenantOptionsHtml()}</datalist></label>
        <label class="tlt-form-field"><span>Renter User ID</span><input name="tenantId" inputmode="numeric" placeholder="If known"></label>
        <label class="tlt-form-field"><span>Days</span><input name="durationDays" type="number" min="0" step="1" placeholder="0"></label>
        <label class="tlt-form-field"><span>Total rent</span><input class="tlt-money-input" name="amount" type="text" inputmode="numeric" placeholder="$0"></label>
        <label class="tlt-form-field"><span>Rent each day</span><input class="tlt-money-input" name="dailyAmount" type="text" inputmode="numeric" placeholder="$0"></label>
        <label class="tlt-form-field"><span>Starts</span><input class="tlt-date-input" name="startDate" type="date"></label>
        <label class="tlt-form-field"><span>Ends</span><input class="tlt-date-input" name="endDate" type="date"></label>
        <label class="tlt-form-field"><span>Days left</span><span class="tlt-readonly-value is-number" data-manual-days-left>Auto</span></label>
        <label class="tlt-form-field"><span>Status</span><select name="status">
          ${statusOptionsHtml("manual")}
        </select></label>
        <label class="tlt-form-field"><span>Show under</span><select name="roleHint">
          <option value="landlord"${state.role === "landlord" ? " selected" : ""}>Leased Out</option>
          <option value="spouse"${state.role === "spouse" ? " selected" : ""}>Spouse Properties</option>
          <option value="tenant"${state.role === "tenant" || state.role === "all" ? " selected" : ""}>On Lease</option>
          <option value="market">Market</option>
          <option value="rented-from-others">Rented From Others</option>
          <option value="contracts">Lease Offers / Contracts</option>
        </select></label>
        <label class="tlt-form-field is-wide"><span>Notes</span><textarea name="notes" rows="1" placeholder="Notes"></textarea></label>
        <button class="tlt-primary" type="submit">Add lease</button>
      </form>
    `;
  }

  function dataViewHtml(id) {
    const stored = state.endpointData && state.endpointData[id];
    if (!stored || !stored.body) {
      return `<div class="tlt-muted">Nothing fetched yet.</div>`;
    }
    const body = endpointDisplayBody(id, stored.body);
    const message = endpointDisplayMessage(id, stored.message, body);

    return `
      <div class="tlt-result">${escapeHtml(message)}${stored.fetchedAt ? ` Fetched ${escapeHtml(new Date(stored.fetchedAt).toLocaleString())}.` : ""}</div>
      ${dataTableHtml(body, id)}
      ${appSettings().showRawJson ? `<details class="tlt-data-json">
        <summary>Extra details</summary>
        <pre>${escapeHtml(JSON.stringify(body, null, 2))}</pre>
      </details>` : ""}
    `;
  }

  function endpointDisplayBody(id, body) {
    if (id === "spouse-properties") return spouseOwnedPropertiesBody(body);
    return body;
  }

  function endpointDisplayMessage(id, fallbackMessage, body) {
    if (id === "spouse-properties") return spousePropertiesMessage(body);
    return fallbackMessage || "Fetched response.";
  }

  function userDetailsHtml() {
    const keyInfo = state.keyInfo || {};
    const user = keyInfo.user || {};
    const profile = profileInfo();
    const access = keyInfoAccess(keyInfo) || (profile && profile.access) || {};
    const propertyStats = userPropertyStats();
    const spouse = profile && profile.spouse;
    const factionId = user.faction_id || user.factionId || (profile && (profile.faction_id || profile.factionId));
    const companyId = user.company_id || user.companyId || (profile && (profile.company_id || profile.companyId));
    const accessLabel = access.type || access.level || (apiKeyValue() ? "Public" : "N/A");
    return `
      <div class="tlt-profile-card">
        <div class="tlt-profile-head">
          ${profile && profile.image ? `<img class="tlt-profile-image" src="${escapeAttr(profile.image)}" alt="${escapeAttr(profile.name || "User profile")}">` : `<div class="tlt-profile-image"></div>`}
          <div>
            <h3 class="tlt-profile-name">${escapeHtml(profileName(profile, keyInfo))}</h3>
            <div class="tlt-muted">Access: ${escapeHtml(accessLabel)} · Faction ID: ${escapeHtml(factionId || "N/A")} · Company ID: ${escapeHtml(companyId || "N/A")}</div>
          </div>
        </div>
        <div class="tlt-profile-grid">
          ${infoCardHtml("Level", profileValue(profile, "level"))}
          ${infoCardHtml("Rank", profileValue(profile, "rank"))}
          ${infoCardHtml("Title", profileValue(profile, "title"))}
          ${infoCardHtml("Age", daysToDuration(profile && profile.age))}
          ${propertyInfoCardHtml((profile && profile.property) || propertyStats.currentProperty)}
          ${infoCardHtml("Marital status", spouse ? `${spouse.status || "Unknown"}${spouse.days_married !== undefined ? ` for ${daysToDuration(spouse.days_married)}` : ""}` : "N/A")}
          ${spouse && (spouse.name || spouse.id) ? infoCardHtml("Married to", `${spouse.name || "Spouse"} [${spouse.id || "N/A"}]`) : ""}
          ${infoCardHtml("Properties owned", propertyStats.owned)}
          ${infoCardHtml("Leased to others", propertyStats.leasedToOthers)}
          ${infoCardHtml("For rent", propertyStats.forRent)}
        </div>
      </div>
      <div class="tlt-result">Use Fetch to refresh this card and add leases to the list.</div>
    `;
  }

  function profileName(profile, keyInfo) {
    if (profile && (profile.name || profile.id)) return `${profile.name || "User"} [${profile.id || "N/A"}]`;
    const userId = keyInfoUserId(keyInfo);
    return userId ? `User [${userId}]` : "No profile fetched";
  }

  function profileValue(profile, key) {
    return profile && profile[key] !== undefined && profile[key] !== null && profile[key] !== "" ? profile[key] : "N/A";
  }

  function daysToDuration(value) {
    const totalDays = Number(value);
    if (!Number.isFinite(totalDays)) return "N/A";
    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);
    const days = Math.floor((totalDays % 365) % 30);
    const parts = [];
    if (years) parts.push(`${years} year${years === 1 ? "" : "s"}`);
    if (months) parts.push(`${months} month${months === 1 ? "" : "s"}`);
    if (days || !parts.length) parts.push(`${days} day${days === 1 ? "" : "s"}`);
    return parts.join(", ");
  }

  function infoCardHtml(label, value) {
    return `<div class="tlt-info-card"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
  }

  function propertyInfoCardHtml(property) {
    if (!property) return infoCardHtml("Property", "N/A");
    const typeName = propertyDisplayName(property);
    const propertyId = clean(property.id || property.property_id, "");
    const value = propertyId ? `${typeName} [${propertyId}]` : typeName;
    const image = propertyImageUrl(propertyTypeIdFromPropertyValue(property) || typeName);
    if (!image) return infoCardHtml("Property", value);
    return `
      <div class="tlt-info-card tlt-info-property">
        <img src="${escapeAttr(image)}" alt="${escapeAttr(value)}">
        <div><span>Property</span><b>${escapeHtml(value)}</b></div>
      </div>
    `;
  }

  function endpointBody(id) {
    return state.endpointData && state.endpointData[id] && state.endpointData[id].body;
  }

  function profileInfo() {
    const body = endpointBody("user-profile");
    if (!body || typeof body !== "object") return null;
    return body.profile || body.user || body;
  }

  function mergeProfileInfo(previous, incoming) {
    if (!previous || typeof previous !== "object") return incoming || null;
    if (!incoming || typeof incoming !== "object") return previous;
    const merged = { ...previous };
    for (const key of new Set([...Object.keys(previous), ...Object.keys(incoming)])) {
      const current = previous[key];
      const next = incoming[key];
      if (current && next && typeof current === "object" && typeof next === "object" && !Array.isArray(current) && !Array.isArray(next)) {
        merged[key] = mergeProfileInfo(current, next);
      } else {
        merged[key] = isBlankValue(next) ? current : next;
      }
    }
    return merged;
  }

  function profileSpouse() {
    const profile = profileInfo();
    return profile && profile.spouse && profile.spouse.id ? profile.spouse : null;
  }

  function userPropertyStats() {
    const ownedSource = ownedPropertyStatsSource();
    const ownedProperties = ownedSource ? ownedSource.properties : [];
    const currentProperty = (
      currentPropertyFromBody(endpointBody("server-sync")) ||
      currentPropertyFromBody(endpointBody("user-property")) ||
      currentPropertyFromBody(endpointBody("user-id-property"))
    );
    return {
      owned: ownedSource ? ownedProperties.length : "N/A",
      leasedToOthers: ownedSource ? ownedProperties.filter(isLeasedToOther).length : "N/A",
      forRent: ownedSource ? ownedProperties.filter(isForRent).length : "N/A",
      currentProperty,
    };
  }

  function ownedPropertyStatsSource() {
    const serverBody = endpointBody("server-sync");
    if (hasAnyOwnKey(serverBody, ["ownedProperties", "owned_properties", "userProperties", "propertiesOwned"])) {
      return {
        body: serverBody,
        properties: firstArray(serverBody, ["ownedProperties", "owned_properties", "userProperties", "propertiesOwned"]),
      };
    }
    const ownedBody = endpointBody("user-properties");
    if (ownedBody) return { body: ownedBody, properties: propertiesFromBody(ownedBody) };
    const lookupBody = endpointBody("user-id-properties");
    if (lookupBody && userPropertiesBodyMatchesCurrentUser(lookupBody)) {
      return { body: lookupBody, properties: propertiesFromBody(lookupBody) };
    }
    return null;
  }

  function hasAnyOwnKey(body, keys) {
    return Boolean(body && typeof body === "object" && keys.some((key) => Object.prototype.hasOwnProperty.call(body, key)));
  }

  function userPropertiesBodyMatchesCurrentUser(body) {
    const myId = keyInfoUserId(state.keyInfo) || ((state.endpointInputs || {}).userId);
    const myName = profileInfo() && profileInfo().name;
    const savedLookup = clean((body || {})._owner_filter_id || (body || {})._owner_filter_name, "");
    return Boolean(savedLookup && ((myId && normalizeLookup(myId) === normalizeLookup(savedLookup)) || (myName && normalizeLookup(myName) === normalizeLookup(savedLookup))));
  }

  function propertiesFromBody(body) {
    if (!body || typeof body !== "object") return [];
    if (Array.isArray(body.properties)) return body.properties;
    if (body.properties && typeof body.properties === "object") return Object.values(body.properties);
    return [];
  }

  function ownedPropertiesBody(body, lookup) {
    const properties = propertiesFromBody(body);
    const owned = properties.filter((property) => ownerMatchesLookup(property, lookup));
    return {
      ...(body || {}),
      properties: owned,
      _raw_total: properties.length,
      _owner_filter_id: String(lookup || ""),
    };
  }

  function spouseOwnedPropertiesBody(body, spouseOverride = null) {
    const properties = propertiesFromBody(body);
    const rawTotal = Number.isFinite(Number((body || {})._raw_total)) ? Number((body || {})._raw_total) : properties.length;
    const spouse = spouseOverride && spouseOverride.id ? spouseOverride : profileSpouse();
    if (!spouse || !spouse.id) {
      return {
        ...(body || {}),
        properties,
        _raw_total: rawTotal,
      };
    }
    const owned = properties.filter((property) => ownerMatchesLookup(property, spouse.id));
    return {
      ...(body || {}),
      properties: owned,
      _raw_total: rawTotal,
      _owner_filter_id: String(spouse.id),
      _owner_filter_name: spouse.name || "",
    };
  }

  function spousePropertiesMessage(body) {
    const spouse = profileSpouse();
    const shown = propertiesFromBody(body).length;
    const total = Number((body || {})._raw_total);
    const savedName = clean((body || {})._owner_filter_name, "");
    const savedId = clean((body || {})._owner_filter_id, "");
    const label = spouse && spouse.name && spouse.id ? `${spouse.name} [${spouse.id}]` : spouse && spouse.id ? spouse.id : savedName && savedId ? `${savedName} [${savedId}]` : savedId || "your spouse";
    if (Number.isFinite(total) && total > shown) {
      return `Showing ${shown.toLocaleString()} homes owned by ${label}. ${Number(total - shown).toLocaleString()} shared or other-owner homes are hidden here.`;
    }
    return `Showing ${shown.toLocaleString()} homes owned by ${label}.`;
  }

  function ownerMatchesLookup(property, lookup) {
    const owner = property && property.owner;
    return userMatchesLookup(owner, lookup);
  }

  function renterMatchesLookup(property, lookup) {
    return userMatchesLookup(property && (property.rented_by || property.renter || property.renter_asked || property.tenant), lookup);
  }

  function propertyUsedByLookup(property, lookup) {
    const users = Array.isArray(property && property.used_by) ? property.used_by : [];
    return users.some((user) => userMatchesLookup(user, lookup));
  }

  function userMatchesLookup(user, lookup) {
    if (!user || !lookup) return false;
    const normalized = normalizeLookup(lookup);
    return normalizeLookup(user.id) === normalized || normalizeLookup(user.name) === normalized || normalizeLookup(user) === normalized;
  }

  function normalizeLookup(value) {
    return String(value || "").trim().toLowerCase();
  }

  function currentPropertyFromBody(body) {
    if (!body || typeof body !== "object") return null;
    return body.currentProperty || body.current_property || body.property || (body.id || body.property_id ? body : null);
  }

  function currentPropertyLeaseStatus(property) {
    const ownerId = property && property.owner && property.owner.id;
    const ownerName = property && property.owner && property.owner.name;
    const myId = keyInfoUserId(state.keyInfo) || ((state.endpointInputs || {}).userId);
    const spouse = profileSpouse();
    const spouseId = spouse && spouse.id;
    if (!ownerId) return { value: "unknown", label: "Unknown owner" };
    if (!myId) return { value: "unknown", label: "Unknown key owner" };
    if (normalizeLookup(ownerId) === normalizeLookup(myId)) return { value: "owned", label: "Owned by you" };
    if (spouseId && normalizeLookup(ownerId) === normalizeLookup(spouseId)) return { value: "spouse-owned", label: "Spouse property" };
    const ownerLabel = ownerName ? `${ownerName} [${ownerId}]` : `user ${ownerId}`;
    return { value: "leased", label: `Leased from ${ownerLabel}` };
  }

  function propertyHasContractDetails(property) {
    if (!property || typeof property !== "object") return false;
    return Boolean(explicitPropertyRenter(property) || propertyHasRentalStatus(property) || propertyHasRentalTerms(property));
  }

  function isLeasedToOther(property) {
    const status = clean(property && property.status, "").toLowerCase();
    return status === "rented" || Boolean(property && (property.rented_by || property.renter || property.tenant));
  }

  function isForRent(property) {
    const status = clean(property && property.status, "").toLowerCase();
    return status === "for_rent" || status === "for rent" || status === "listed";
  }

  function propertyDisplayName(property) {
    return propertyName(property.property) || propertyName(property) || clean(property.id || property.property_id, "Property");
  }

  function marriedStatus(profile) {
    if (!profile) return "Unknown";
    const married = profile.married || profile.marriage || profile.spouse;
    if (!married || married === "No" || married === "None" || married === false) return "Not married";
    if (typeof married === "string") return married;
    const spouse = married.spouse || married.partner || married;
    const name = spouse.name || married.name || married.spouse_name;
    const id = spouse.id || married.id || married.spouse_id;
    if (name && id) return `${name} [${id}]`;
    if (name || id) return clean(name || id);
    return "Married";
  }

  function dataTableHtml(body, id = "") {
    const rows = sortRows(responseRows(body, id), id);
    if (!rows.length) return `<div class="tlt-muted">The response did not include table-like records.</div>`;
    const keys = tableKeys(rows, id);
    const limit = tableLimit();
    return `
      <div class="tlt-table-wrap">
        <table class="tlt-data-table mh-table" data-mh-component="table">
          <thead>
            <tr>${keys.map((key) => `<th>${sortHeaderHtml(id, key)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows.slice(0, limit).map((row) => `<tr>${keys.map((key) => `<td class="${cellClass(cellValue(row, key), key)}">${cellHtml(cellValue(row, key), key, row)}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
      ${rows.length > limit ? `<div class="tlt-muted">Showing ${limit.toLocaleString()} of ${rows.length.toLocaleString()} records.</div>` : ""}
    `;
  }

  function responseRows(body, id = "") {
    if (!body || typeof body !== "object") return [];
    if (["user-property", "user-id-property"].includes(id)) {
      const property = body.property || body.current_property || body;
      return property && typeof property === "object" ? [property] : [];
    }
    const preferred = id === "market-rentals" ? ["rentals", "properties", "property"] : ["properties", "rentals", "property"];
    for (const key of preferred) {
      if (Array.isArray(body[key])) return decorateRowsForEndpoint(normalizeRows(body[key]), id);
      if (body[key] && typeof body[key] === "object") {
        return decorateRowsForEndpoint(normalizeRows(body[key]), id);
      }
    }
    const firstArray = Object.values(body).find((value) => Array.isArray(value));
    if (firstArray) return decorateRowsForEndpoint(normalizeRows(firstArray), id);
    return decorateRowsForEndpoint([body], id);
  }

  function normalizeRows(value) {
    let rows;
    if (Array.isArray(value)) {
      rows = value;
    } else if (value && typeof value === "object") {
      rows = Object.entries(value).map(([key, row]) => {
        if (row && typeof row === "object" && !Array.isArray(row)) {
          return row.id !== undefined || row.property_id !== undefined ? row : { id: key, ...row };
        }
        return row;
      });
    } else {
      rows = [];
    }
    const flattened = rows.flatMap((row) => (Array.isArray(row) ? row : [row]));
    return flattened.filter((row) => row && typeof row === "object" && !Array.isArray(row));
  }

  function decorateRowsForEndpoint(rows, id) {
    if (!["market-rentals", "market-properties"].includes(id)) return rows;
    const propertyTypeId = (state.endpointInputs || {}).propertyTypeId || appSettings().defaultPropertyTypeId;
    if (!propertyTypeId) return rows;
    return rows.map((row) => ({ ...row, _property_type_id: propertyTypeId }));
  }

  function tableKeys(rows, id = "") {
    const preferred = preferredTableKeys(id);
    if (preferred.length) {
      return expandComparisonColumns(preferred, rows);
    }

    const keys = [];
    for (const row of rows.slice(0, 10)) {
      if (!row || typeof row !== "object") continue;
      for (const key of Object.keys(row)) {
        if (!keys.includes(key) && keys.length < 10) keys.push(key);
      }
    }
    return keys.length ? expandComparisonColumns(keys, rows) : ["value"];
  }

  function expandComparisonColumns(keys, rows) {
    const expanded = [];
    for (const key of keys) {
      if (key === "modifications") {
        expanded.push(...modificationColumns(rows));
      } else if (key === "staff") {
        expanded.push(...staffColumns(rows));
      } else {
        expanded.push(key);
      }
    }
    return expanded;
  }

  function modificationColumns(rows) {
    const seen = [];
    for (const row of rows) {
      for (const modification of modificationNames(row && row.modifications)) {
        if (!seen.includes(modification)) seen.push(modification);
      }
    }
    return seen.length ? seen.map((name) => `mod::${name}`) : ["modifications"];
  }

  function staffColumns(rows) {
    const seen = [];
    for (const row of rows) {
      for (const staff of staffEntries(row && row.staff)) {
        if (!seen.includes(staff.type)) seen.push(staff.type);
      }
    }
    return seen.length ? seen.map((name) => `staff::${name}`) : ["staff"];
  }

  function preferredTableKeys(id) {
    const columns = {
      "torn-properties": ["property_image", "id", "name", "cost", "happy", "upkeep", "modifications", "staff"],
      "lease-archive": ["property_image", "property_type", "property_id", "role", "renter", "owner", "start_date", "end_date", "days", "total", "per_day", "happy", "status", "source"],
      "property-history": ["property_image", "property_type", "property_id", "current_status", "first_seen", "last_seen", "buy_cost", "upgrade_cost", "known_investment", "rent_seen", "sale_seen", "listed_count", "tenancies_seen", "last_happy", "events", "upgrades"],
      "property-history-events": ["event_at", "property_image", "property_type", "property_id", "event", "happy", "rent", "days", "cost", "renter", "owner", "other_user", "upgrades"],
      "roi-summary": ["property_image", "property_type", "rental_listings", "sale_listings", "avg_daily", "median_daily", "min_daily", "max_daily", "avg_market_price", "avg_happy", "avg_landlord_roi_market", "best_landlord_roi_market", "avg_landlord_roi_investment", "avg_rent_per_happy", "avg_tenant_cost_per_happy", "error"],
      "roi-rentals": ["property_image", "property_type", "owner", "happy", "cost", "cost_per_day", "rental_period", "market_price", "base_cost", "estimated_upgrade_cost", "estimated_investment", "tenant_upkeep_total", "annual_rent", "landlord_roi_market", "landlord_roi_base", "landlord_roi_investment", "rent_per_happy", "tenant_daily_cost", "tenant_cost_per_happy", "property", "staff", "modifications"],
      "user-properties": ["property_image", "id", "owner", "property", "happy", "upkeep.property", "upkeep.staff", "market_price", "used_by", "rented_by", "staff", "modifications"],
      "spouse-properties": ["property_image", "id", "owner", "property", "happy", "upkeep.property", "upkeep.staff", "market_price", "used_by", "rented_by", "staff", "modifications"],
      "user-id-properties": ["property_image", "id", "owner", "property", "happy", "upkeep.property", "upkeep.staff", "market_price", "used_by", "rented_by", "staff", "modifications"],
      "user-property": ["property_image", "lease_status", "id", "owner", "property", "happy", "upkeep.property", "upkeep.staff", "market_price", "used_by", "rented_by", "staff", "modifications"],
      "user-id-property": ["property_image", "lease_status", "id", "owner", "property", "happy", "upkeep.property", "upkeep.staff", "market_price", "used_by", "rented_by", "staff", "modifications"],
      "market-properties": ["property_image", "id", "owner", "property", "happy", "market_price", "cost", "upkeep.property", "upkeep.staff", "staff", "modifications"],
      "market-rentals": ["property_image", "owner", "happy", "cost", "cost_per_day", "rental_period", "property", "market_price", "upkeep.property", "upkeep.staff", "staff", "modifications"],
      "rent-suggestions": ["property_image", "id", "property", "status", "happy", "suggested_action", "current_cost_per_day", "suggested_rent_per_day", "suggested_duration_days", "suggested_total", "suggested_roi", "suggested_sale_price", "market_median_daily", "market_avg_daily", "rent_listings", "sale_listings", "market_basis", "suggestion_note"],
    };
    return columns[id] || [];
  }

  function sortHeaderHtml(tableId, key, label = "") {
    const current = state.tableSort && state.tableSort[tableId];
    const active = current && current.key === key;
    const indicator = active ? (current.direction === "asc" ? " ▲" : " ▼") : "";
    return `<button class="tlt-sort" type="button" data-table-sort="${escapeAttr(tableId)}" data-sort-key="${escapeAttr(key)}">${escapeHtml(label || humanHeader(key))}${indicator}</button>`;
  }

  function humanHeader(key) {
    if (String(key).startsWith("mod::")) return String(key).slice(5);
    if (String(key).startsWith("staff::")) return String(key).slice(7);
    const special = {
      id: "ID",
      property_id: "Property ID",
      property_type: "Home type",
      current_status: "Current status",
      first_seen: "First seen",
      last_seen: "Last seen",
      buy_cost: "Bought for",
      upgrade_cost: "Upgrades",
      known_investment: "Known investment",
      rent_seen: "Rent seen",
      sale_seen: "Sold for",
      listed_count: "Times listed",
      tenancies_seen: "Tenancies",
      last_happy: "Last happy",
      event_at: "When",
      event: "What happened",
      role: "Role",
      start_date: "Starts",
      end_date: "Ends",
      total: "Total",
      per_day: "Per day",
      other_user: "Other user",
      listings: "Listings",
      rental_listings: "Rent listings",
      sale_listings: "Sale listings",
      avg_daily: "Avg daily",
      median_daily: "Median daily",
      min_daily: "Min daily",
      max_daily: "Max daily",
      avg_market_price: "Avg market price",
      avg_happy: "Avg happy",
      avg_landlord_roi_market: "Avg landlord ROI",
      best_landlord_roi_market: "Best landlord ROI",
      avg_landlord_roi_investment: "Avg investment ROI",
      avg_rent_per_happy: "Avg rent / happy",
      avg_tenant_cost_per_happy: "Avg tenant cost / happy",
      base_cost: "Base cost",
      estimated_upgrade_cost: "Est. upgrades",
      estimated_investment: "Est. investment",
      my_investment: "My paid/invested",
      investment_basis: "ROI basis",
      tenant_upkeep_total: "Tenant upkeep/day",
      annual_rent: "Annual rent",
      tenant_daily_cost: "Tenant daily cost",
      landlord_roi_market: "Landlord ROI",
      landlord_roi_base: "Base ROI",
      landlord_roi_investment: "Investment ROI",
      rent_per_happy: "Rent / happy",
      tenant_cost_per_happy: "Tenant cost / happy",
      target_roi: "Target ROI",
      current_cost_per_day: "Current rent/day",
      market_median_daily: "Market median/day",
      market_avg_daily: "Market avg/day",
      market_min_daily: "Market min/day",
      market_max_daily: "Market max/day",
      rent_listings: "Rent listings",
      market_basis: "Market basis",
      target_rent_per_day: "Target rent/day",
      suggested_rent_per_day: "Suggested rent/day",
      rent_per_day_suggested: "Suggested rent/day",
      suggested_total: "Suggested total",
      suggested_roi: "Suggested ROI",
      recommended_action: "Advice",
      suggested_action: "Action",
      sale_price_suggested: "Suggested sale price",
      suggested_sale_price: "Suggested sale price",
      suggested_duration_days: "Suggested days",
      listing_note: "Listing note",
      suggestion_note: "Suggestion",
      error: "Error",
      cost_per_day: "Cost per day",
      rental_period: "Rental period",
      market_price: "Market price",
      property_image: "Image",
      lease_status: "Status",
      "upkeep.property": "Property upkeep",
      "upkeep.staff": "Staff upkeep",
      used_by: "Users",
      rented_by: "Lease holder",
      amount: "Total rent",
      dailyAmount: "Rent / day",
      durationDays: "Tenancy duration",
      startDate: "Contract starts",
      remainingDays: "Left",
      endDate: "Ends",
    };
    if (special[key]) return special[key];
    return String(key)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function sortRows(rows, tableId) {
    const sort = state.tableSort && state.tableSort[tableId];
    if (!sort || !sort.key) return rows;
    const direction = sort.direction === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => compareSortValues(sortValue(cellValue(a, sort.key)), sortValue(cellValue(b, sort.key))) * direction);
  }

  function sortValue(value) {
    const array = arrayValue(value);
    if (array) return array.map(formatCell).join(" ");
    if (value && typeof value === "object") return formatObject(value);
    return value;
  }

  function compareSortValues(a, b) {
    const numberA = Number(a);
    const numberB = Number(b);
    const numeric = a !== "" && b !== "" && Number.isFinite(numberA) && Number.isFinite(numberB);
    if (numeric) return numberA - numberB;
    return clean(a, "").localeCompare(clean(b, ""), undefined, { numeric: true, sensitivity: "base" });
  }

  function formatCell(value) {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "object") return formatObject(value);
    return String(value);
  }

  function cellClass(value, key = "") {
    if (key === "property_image") return "tlt-image-cell";
    if (isModificationColumn(key)) return "tlt-mod-cell";
    if (isStaffColumn(key)) return "tlt-number";
    if (isNumericValue(value) && !isIdColumn(key)) return "tlt-number";
    if (value && typeof value === "object" && !Array.isArray(value)) return "tlt-object";
    return "";
  }

  function cellHtml(value, key = "", row = null) {
    if (key === "property_image") return propertyImageCellHtml(row);
    if (isModificationColumn(key)) return modificationCellHtml(row, key);
    if (isStaffColumn(key)) return staffCellHtml(row, key);
    const array = arrayValue(value);
    if (array) return choiceListHtml(array, key);
    if (value === null || value === undefined || value === "") return `<span class="tlt-empty-value">N/A</span>`;
    if (isPercentColumn(key)) return escapeHtml(percentage(value));
    if (isMoneyColumn(key)) return escapeHtml(money(value));
    if (isIdColumn(key)) return escapeHtml(String(value));
    if (typeof value === "number") return escapeHtml(value.toLocaleString());
    if (typeof value === "object") return escapeHtml(formatObject(value));
    return escapeHtml(String(value));
  }

  function cellValue(row, key) {
    if (key === "property_image") return propertyImageUrlFromRow(row);
    if (key === "lease_status") return currentPropertyLeaseStatus(row).label;
    if (isModificationColumn(key)) return hasModification(row, key.slice(5)) ? 1 : 0;
    if (isStaffColumn(key)) return staffAmount(row, key.slice(7));
    return nestedValue(row, key);
  }

  function nestedValue(row, key) {
    if (!row || !key) return undefined;
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
    return String(key).split(".").reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), row);
  }

  function isModificationColumn(key) {
    return String(key).startsWith("mod::");
  }

  function isStaffColumn(key) {
    return String(key).startsWith("staff::");
  }

  function modificationCellHtml(row, key) {
    return hasModification(row, key.slice(5)) ? `<span class="tlt-check-cell">✓</span>` : `<span class="tlt-miss-cell">-</span>`;
  }

  function hasModification(row, name) {
    return modificationNames(row && row.modifications).some((modification) => sameModification(modification, name));
  }

  function staffCellHtml(row, key) {
    const amount = staffAmount(row, key.slice(7));
    return amount ? `<span class="tlt-volume-cell">${escapeHtml(amount)}</span>` : `<span class="tlt-miss-cell">-</span>`;
  }

  function staffAmount(row, type) {
    const entry = staffEntries(row && row.staff).find((staff) => sameModification(staff.type, type));
    return entry ? Number(entry.amount) || 1 : 0;
  }

  function staffEntries(value) {
    const array = arrayValue(value);
    if (!array && value && typeof value === "object") {
      return Object.entries(value).map(([type, entryValue]) => {
        if (entryValue && typeof entryValue === "object") return { type: entryValue.type || entryValue.name || type, amount: entryValue.amount || entryValue.count || 1 };
        return { type, amount: entryValue === true ? 1 : entryValue };
      }).filter((item) => item.type && Number(item.amount) !== 0 && item.amount !== false && item.amount !== null);
    }
    if (!array) return [];
    return array.map((item) => {
      if (item && typeof item === "object") return { type: item.type || item.name || "Staff", amount: item.amount || 1 };
      return { type: String(item), amount: 1 };
    }).filter((item) => item.type);
  }

  function modificationNames(value) {
    const array = arrayValue(value);
    if (array) return array.map(formatCell).filter((name) => name && name !== "-");
    if (value && typeof value === "object") {
      return Object.entries(value).flatMap(([name, entryValue]) => {
        if (entryValue === false || entryValue === null || entryValue === undefined || entryValue === 0 || entryValue === "") return [];
        if (entryValue === true || typeof entryValue === "number") return [name];
        if (typeof entryValue === "string") return [entryValue || name];
        if (entryValue && typeof entryValue === "object") return [entryValue.name || entryValue.type || name];
        return [name];
      }).filter((name) => name && name !== "-");
    }
    return [];
  }

  function sameModification(a, b) {
    return normalizeModificationName(a) === normalizeModificationName(b);
  }

  function normalizeModificationName(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function arrayValue(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim().startsWith("[")) return null;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function choiceListHtml(values, key) {
    if (!values.length) return `<span class="tlt-empty-value">None</span>`;
    return `
      <div class="tlt-choice-list" role="group" aria-label="${escapeAttr(key)}">
        ${values.map((value) => `<label class="tlt-choice-option"><input type="checkbox" checked disabled><span>${escapeHtml(formatCell(value))}</span></label>`).join("")}
      </div>
    `;
  }

  function isNumericValue(value) {
    return typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));
  }

  function isPercentColumn(key) {
    const normalized = String(key).toLowerCase();
    return normalized.includes("roi") || normalized.includes("yield") || normalized.includes("percent");
  }

  function isMoneyColumn(key) {
    const normalized = String(key).toLowerCase();
    const moneyKeys = ["avg_daily", "median_daily", "min_daily", "max_daily", "avg_market_price", "base_cost", "estimated_upgrade_cost", "estimated_investment", "my_investment", "investment_basis", "tenant_upkeep_total", "annual_rent", "tenant_daily_cost", "rent_per_happy", "avg_rent_per_happy", "tenant_cost_per_happy", "avg_tenant_cost_per_happy", "current_cost_per_day", "market_median_daily", "market_avg_daily", "market_min_daily", "market_max_daily", "target_rent_per_day", "suggested_rent_per_day", "suggested_total", "buy_cost", "upgrade_cost", "known_investment", "rent_seen", "sale_seen", "rent", "total", "per_day"];
    return !isIdColumn(key) && (moneyKeys.includes(normalized) || ["cost", "upkeep", "rent", "amount"].includes(normalized) || normalized.includes("price") || normalized.includes("cost") || normalized.includes("upkeep"));
  }

  function isIdColumn(key) {
    const normalized = String(key).toLowerCase();
    return normalized === "id" || normalized.endsWith("_id") || normalized.endsWith("id");
  }

  function formatObject(value) {
    if (!value || typeof value !== "object") return clean(value);
    if (value.name && value.id) return `${value.name} [${value.id}]`;
    if (value.type && value.amount !== undefined) return `${value.type} x${value.amount}`;
    if (value.property !== undefined && value.staff !== undefined) return `Property ${money(value.property)}, staff ${money(value.staff)}`;
    if (value.name) return String(value.name);
    if (value.type) return String(value.type);
    if (value.id) return String(value.id);

    const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== null && entryValue !== undefined && entryValue !== "");
    if (!entries.length) return "N/A";
    return entries
      .slice(0, 4)
      .map(([entryKey, entryValue]) => `${entryKey}: ${Array.isArray(entryValue) ? `${entryValue.length} items` : formatCell(entryValue)}`)
      .join(", ");
  }

  function propertyTypes() {
    return Array.isArray(state.propertyTypes) && state.propertyTypes.length ? state.propertyTypes : PROPERTY_TYPES;
  }

  function selectedPropertyType() {
    const selectedId = Number((state.endpointInputs || {}).propertyTypeId || appSettings().defaultPropertyTypeId);
    return propertyTypes().find((type) => Number(type.id) === selectedId) || null;
  }

  function propertyTypeSelectHtml() {
    const selectedId = String((state.endpointInputs || {}).propertyTypeId || appSettings().defaultPropertyTypeId || "");
    return `
      <select data-endpoint-field="propertyTypeId">
        <option value="">Select property type</option>
        ${propertyTypes().map((type) => `<option value="${escapeAttr(type.id)}"${String(type.id) === selectedId ? " selected" : ""}>${escapeHtml(type.id)} - ${escapeHtml(type.name)}</option>`).join("")}
      </select>
      ${propertyTypeMetaHtml()}
    `;
  }

  function userLookupInputHtml() {
    return `
      <input data-endpoint-field="lookupUser" placeholder="User ID or username" value="${escapeAttr((state.endpointInputs || {}).lookupUser || "")}">
      <div class="tlt-property-meta">Used only for /user/{id} tabs. Leave blank to use the checked key user.</div>
    `;
  }

  function propertyTypeMetaHtml() {
    const type = selectedPropertyType();
    if (!type) return `<div class="tlt-property-meta">Pick a home type to fetch price listings.</div>`;
    const image = propertyImageUrl(type.id);
    return `
      <div class="tlt-property-meta">
        ${image ? `<div class="tlt-property-preview"><img class="tlt-property-image" src="${escapeAttr(image)}" alt="${escapeAttr(type.name)}"><div>` : ""}
        Cost ${money(type.cost)}. Happy ${Number(type.happy).toLocaleString()}. Upkeep ${money(type.upkeep)}.<br>
        Mods: ${escapeHtml(type.modifications.length ? type.modifications.join(", ") : "none")}.<br>
        Staff: ${escapeHtml(type.staff.length ? type.staff.join(", ") : "none")}.
        ${image ? `</div></div>` : ""}
      </div>
    `;
  }

  function propertyImageUrl(idOrName) {
    const id = propertyTypeId(idOrName);
    const normalized = normalizeModificationName(idOrName);
    const type = propertyTypes().find((item) => (
      (id && Number(item.id) === Number(id)) ||
      normalizeModificationName(item.name) === normalized ||
      listValue(item.aliases).some((alias) => normalizeModificationName(alias) === normalized)
    ));
    return type ? clean(type.imageUrl || type.image_url || type.image || "", "") : "";
  }

  function propertyTypeId(value) {
    if (value && typeof value === "object") {
      return propertyTypeId(value.id || value.property_id || value.type_id || value.name || value.type);
    }
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
    const normalized = normalizeLookup(value);
    const type = propertyTypes().find((item) => normalizeLookup(item.name) === normalized);
    return type ? Number(type.id) : 0;
  }

  function propertyTypeIdFromRow(row) {
    if (!row || typeof row !== "object") return 0;
    return (
      propertyTypeId(row.property) ||
      propertyTypeId(row._property_type_id) ||
      propertyTypeId(row.property_type) ||
      propertyTypeId(row.propertyType) ||
      propertyTypeId(row.property_id) ||
      propertyTypeId(row.type_id) ||
      propertyTypeId(row.name) ||
      propertyTypeId(row.id) ||
      propertyTypeId((state.endpointInputs || {}).propertyTypeId || appSettings().defaultPropertyTypeId)
    );
  }

  function propertyTypeIdFromPropertyValue(value) {
    if (!value) return 0;
    if (typeof value !== "object") return propertyTypeId(value);
    return (
      propertyTypeId(value.property) ||
      propertyTypeId(value._property_type_id) ||
      propertyTypeId(value.property_type) ||
      propertyTypeId(value.propertyType) ||
      propertyTypeId(value.type_id) ||
      propertyTypeId(value.name) ||
      0
    );
  }

  function propertyImageUrlFromRow(row) {
    return propertyImageUrl(propertyTypeIdFromRow(row));
  }

  function propertyImageCellHtml(row) {
    const image = propertyImageUrlFromRow(row);
    if (!image) return `<span class="tlt-empty-value">N/A</span>`;
    const label = propertyDisplayName(row);
    return `<img class="tlt-table-thumb" src="${escapeAttr(image)}" alt="${escapeAttr(label)}">`;
  }

  function propertyImageLegendHtml() {
    return `
      <div class="tlt-property-meta tlt-property-picture-grid">
        ${propertyTypes().filter((type) => propertyImageUrl(type.id)).map((type) => `
          <div class="tlt-property-picture-card" title="${escapeAttr(`${type.name} [${type.id}]`)}">
            <img class="tlt-property-image" src="${escapeAttr(propertyImageUrl(type.id))}" alt="${escapeAttr(type.name)}">
            <div>${escapeHtml(type.name)} [${escapeHtml(type.id)}]</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function currencyInputValue(value) {
    const number = moneyNumber(value);
    return number ? money(number) : "";
  }

  function inputWidthStyle(value, min = 8, max = 36) {
    const length = String(value || "").length || min;
    return `width:${clamp(length + 2, min, max)}ch`;
  }

  function readonlyValue(value, fallback = "N/A") {
    return clean(value, "") || fallback;
  }

  function leaseReadonlyValue(lease, prop) {
    if (prop === "status") return leaseStatusLabel(normalizeLeaseStatus(lease.status, lease.roleHint || lease.source, lease.tenant));
    if (prop === "amount" || prop === "dailyAmount") return money(lease[prop]);
    if (prop === "startDate" || prop === "endDate") return formatDateValue(lease[prop]);
    if (prop === "remainingDays") return readonlyValue(lease.remainingDays, "Auto");
    return readonlyValue(lease[prop]);
  }

  function formatDateValue(value) {
    const raw = clean(value, "");
    if (!raw) return "N/A";
    const date = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleDateString();
  }

  function leaseReadonlyCell(lease, prop, extraClass = "") {
    const value = leaseReadonlyValue(lease, prop);
    return `<span class="tlt-readonly-value ${extraClass}" data-lease-readonly="${escapeAttr(prop)}" title="${escapeAttr(value)}">${escapeHtml(value)}</span>`;
  }

  function rowHtml(lease) {
    const image = propertyImageUrlFromRow(lease);
    return `
      <tr data-id="${escapeAttr(lease.id)}">
        <td>
          <div class="tlt-home-cell">
            ${image ? `<span class="tlt-thumb-hover"><img class="tlt-table-thumb" src="${escapeAttr(image)}" alt="${escapeAttr(lease.property)}"><span class="tlt-thumb-preview"><img src="${escapeAttr(image)}" alt="${escapeAttr(lease.property)}"></span></span>` : ""}
            <div>
              <input class="tlt-lease-input tlt-lease-text" data-prop="property" style="${inputWidthStyle(lease.property, 12)}" value="${escapeAttr(lease.property)}">
              <div class="tlt-muted">${escapeHtml(lease.propertyId ? `ID ${lease.propertyId}` : lease.source || "")}</div>
            </div>
          </div>
        </td>
        <td>${leaseReadonlyCell(lease, "landlord")}</td>
        <td>${leaseReadonlyCell(lease, "status")}</td>
        <td>${leaseReadonlyCell(lease, "tenant")}</td>
        <td>${leaseReadonlyCell(lease, "durationDays", "is-number")}</td>
        <td>${leaseReadonlyCell(lease, "amount", "is-number")}</td>
        <td>${leaseReadonlyCell(lease, "dailyAmount", "is-number")}</td>
        <td>${leaseReadonlyCell(lease, "startDate")}</td>
        <td>${leaseReadonlyCell(lease, "endDate")}</td>
        <td>${leaseReadonlyCell(lease, "remainingDays", "is-number")}</td>
        <td><input class="tlt-lease-input tlt-lease-text" data-prop="notes" style="${inputWidthStyle(lease.notes, 10, 42)}" value="${escapeAttr(lease.notes)}"></td>
        <td><button class="tlt-danger" type="button" data-action="delete" data-id="${escapeAttr(lease.id)}">Remove</button></td>
      </tr>
    `;
  }

  function emptyRowsHtml() {
    return `<tr><td colspan="12" class="tlt-muted">No leases yet. Use Fetch to fetch homes, or add one by hand below.</td></tr>`;
  }

  function displayEndpointPath(endpoint) {
    const inputs = state.endpointInputs || {};
    const spouse = profileSpouse();
    return endpoint.path
      .replace("{spouse.id}", spouse && spouse.id ? spouse.id : "spouse.id")
      .replace("{id}", inputs.lookupUser || inputs.userId || "user ID or name")
      .replace("{propertyTypeId}", inputs.propertyTypeId || "propertyTypeId");
  }

  function endpointResultHtml(id) {
    const result = state.endpointResults && state.endpointResults[id];
    return result ? `<div class="tlt-result">${escapeHtml(result)}</div>` : "";
  }

  function keyInfoHtml() {
    const userId = keyInfoUserId(state.keyInfo);
    return userId ? `Key checked for user ${escapeHtml(userId)}. ` : "";
  }

  function serverAccessHtml() {
    const info = subscriptionStatusInfo();
    if (["missing-key", "missing-user", "unchecked"].includes(info.state)) return "";
    const bits = [info.label, info.plan].filter(Boolean).join(" / ");
    return `Subscription: ${escapeHtml(bits || info.label)}. `;
  }

  function subscriptionStatusHtml() {
    const info = subscriptionStatusInfo();
    const details = [
      info.userId ? `Torn user ID ${info.userId}` : "",
      info.plan ? `Plan: ${info.plan}` : "",
      info.expiresAt ? `Expires: ${new Date(info.expiresAt).toLocaleString()}` : "",
    ].filter(Boolean).join(" | ");
    return `
      <div class="tlt-subscription ${escapeAttr(info.className)}">
        <span>Subscription check</span>
        <strong>${escapeHtml(info.label)}</strong>
        <p>${escapeHtml(info.message)}</p>
        ${details ? `<small>${escapeHtml(details)}</small>` : ""}
        ${info.checkedAt ? `<small>Checked ${escapeHtml(new Date(info.checkedAt).toLocaleString())}</small>` : ""}
      </div>
    `;
  }

  function subscriptionStatusInfo() {
    const userId = (state.endpointInputs && state.endpointInputs.userId) || keyInfoUserId(state.keyInfo);
    if (!apiKeyValue()) {
      return {
        state: "missing-key",
        label: "No key saved",
        message: "Save a Torn public key first.",
        className: "is-warning",
        isSubscribed: false,
      };
    }
    if (!userId) {
      return {
        state: "missing-user",
        label: "Key not checked yet",
        message: "Test the key or press Check subscription so the script knows which Torn user owns the key.",
        className: "is-warning",
        isSubscribed: false,
      };
    }

    const entitlement = state.serverEntitlement;
    if (!entitlement || typeof entitlement !== "object" || !hasEntitlementSignal(entitlement)) {
      return {
        state: "unchecked",
        label: "Subscription not checked",
        message: `Ready to check Tornfolio access for Torn user ${userId}.`,
        className: "is-warning",
        isSubscribed: false,
        userId,
      };
    }

    const active = isEntitlementActive(entitlement);
    const inactive = isEntitlementInactive(entitlement);
    const status = entitlementStatusText(entitlement);
    const plan = entitlement.plan || entitlement.product || entitlement.name || entitlement.tier || "";
    const expiresAt = entitlement.expires_at || entitlement.expiresAt || entitlement.expiry || "";
    const checkedAt = state.lastSubscriptionCheckAt;

    if (active) {
      return {
        state: "active",
        label: "Subscriber",
        message: "Financial data and rent/sale suggestions are available.",
        className: "is-active",
        isSubscribed: true,
        userId,
        plan,
        expiresAt,
        checkedAt,
      };
    }

    if (inactive) {
      return {
        state: "inactive",
        label: "Not subscribed",
        message: "The bot needs to grant Tornfolio access for this Torn user before financial suggestions will work.",
        className: "is-blocked",
        isSubscribed: false,
        userId,
        plan,
        expiresAt,
        checkedAt,
      };
    }

    return {
      state: "unknown",
      label: "Subscription unclear",
      message: status ? `Access reply: ${status}.` : "The access check did not say active or inactive clearly.",
      className: "is-warning",
      isSubscribed: false,
      userId,
      plan,
      expiresAt,
      checkedAt,
    };
  }

  function hasEntitlementSignal(entitlement) {
    return ["status", "state", "active", "valid", "allowed", "hasAccess", "has_access", "subscribed", "licensed", "plan", "product", "tier", "expires_at", "expiresAt"].some((key) => (
      entitlement[key] !== undefined && entitlement[key] !== null && entitlement[key] !== ""
    ));
  }

  function entitlementStatusText(entitlement) {
    return clean(entitlement && (entitlement.status || entitlement.state || entitlement.result || entitlement.access), "");
  }

  function isEntitlementActive(entitlement) {
    if (!entitlement || typeof entitlement !== "object") return false;
    const boolKeys = ["active", "valid", "allowed", "hasAccess", "has_access", "subscribed", "licensed"];
    if (boolKeys.some((key) => entitlement[key] === true)) return true;
    if (boolKeys.some((key) => entitlement[key] === false)) return false;
    return /^(active|valid|subscribed|subscriber|paid|licensed|allowed|ok|trialing)$/i.test(entitlementStatusText(entitlement));
  }

  function isEntitlementInactive(entitlement) {
    if (!entitlement || typeof entitlement !== "object") return false;
    const boolKeys = ["active", "valid", "allowed", "hasAccess", "has_access", "subscribed", "licensed"];
    if (boolKeys.some((key) => entitlement[key] === false)) return true;
    return /^(inactive|expired|denied|missing|none|not_found|not-found|unlicensed|unsubscribed|blocked|invalid|forbidden)$/i.test(entitlementStatusText(entitlement));
  }

  function keyInfoUserId(body) {
    if (!body || typeof body !== "object") return "";
    return (
      body.userId ||
      body.user_id ||
      body.player_id ||
      body.id ||
      (body.account && (body.account.userId || body.account.user_id || body.account.id)) ||
      (body.user && body.user.id) ||
      (body.key && body.key.user && body.key.user.id) ||
      (body.info && body.info.user && body.info.user.id) ||
      (body.data && body.data.user && body.data.user.id) ||
      (body.api_key && body.api_key.user && body.api_key.user.id) ||
      (body.response && body.response.user && body.response.user.id) ||
      ""
    );
  }

  function keyInfoAccess(body) {
    if (!body || typeof body !== "object") return null;
    return body.access || (body.key && body.key.access) || (body.info && body.info.access) || (body.data && body.data.access) || (body.api_key && body.api_key.access) || null;
  }

  function autoSizeInput(field) {
    if (!field || !field.matches("input.tlt-lease-input")) return;
    if (field.type === "date") return;
    const min = field.classList.contains("tlt-money-input") ? 9 : 7;
    field.style.width = `${clamp(String(field.value || field.placeholder || "").length + 2, min, 42)}ch`;
  }

  function bind(root, isPopup = false) {
    if (!isPopup) {
      bindDrag(root, root.querySelector(".tlt-header"));
      bindDrag(root, root.querySelector(".tlt-tab"));
      bindResize(root);
    }

    const tabButton = root.querySelector(".tlt-tab");
    if (tabButton) {
      tabButton.addEventListener("click", (event) => {
        if (event.currentTarget.dataset.dragged === "true") {
          event.currentTarget.dataset.dragged = "";
          return;
        }
        state.panelOpen = !state.panelOpen;
        saveState();
        render();
      });
    }

    root.querySelectorAll("[data-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.activeTab = tab.dataset.tab;
        if (tab.dataset.scope) {
          state.ui = { ...tfUi(), propertyScope: tab.dataset.scope };
        }
        saveState();
        render();
      });
    });

    root.querySelectorAll("[data-ui-field]").forEach((field) => {
      const updateUi = () => {
        const key = field.dataset.uiField;
        const value = field.dataset.uiValue !== undefined ? field.dataset.uiValue : field.value;
        state.ui = { ...tfUi(), [key]: value };
        saveState();
        render();
      };
      if (field.dataset.uiValue !== undefined) field.addEventListener("click", updateUi);
      else {
        field.addEventListener("change", updateUi);
        if (field.type === "search") {
          field.addEventListener("input", () => {
            state.ui = { ...tfUi(), [field.dataset.uiField]: field.value };
            saveState();
          });
          field.addEventListener("search", updateUi);
        }
      }
    });

    root.querySelectorAll("[data-advanced-endpoint]").forEach((field) => {
      field.addEventListener("change", () => {
        state.advancedEndpointId = field.value;
        saveState();
        render();
      });
    });

    root.querySelectorAll("[data-table-sort]").forEach((button) => {
      button.addEventListener("click", () => {
        const tableId = button.dataset.tableSort;
        const key = button.dataset.sortKey;
        const current = state.tableSort && state.tableSort[tableId];
        const direction = current && current.key === key && current.direction === "asc" ? "desc" : "asc";
        state.tableSort = { ...(state.tableSort || {}), [tableId]: { key, direction } };
        saveState();
        render();
      });
    });

    root.querySelectorAll("[data-field]").forEach((field) => {
      field.addEventListener("input", () => {
        state[field.dataset.field] = field.value;
        if (field.dataset.field === "apiKey") {
          state.keyInfo = null;
          state.endpointInputs = { ...emptyState.endpointInputs, ...(state.endpointInputs || {}), userId: "", lookupUser: "" };
        }
        saveState();
        if (field.dataset.field !== "apiKey") render();
      });
      field.addEventListener("change", () => {
        state[field.dataset.field] = field.value;
        saveState();
        render();
      });
    });

    root.querySelectorAll("[data-endpoint-field]").forEach((field) => {
      field.addEventListener("input", () => {
        state.endpointInputs = {
          ...emptyState.endpointInputs,
          ...(state.endpointInputs || {}),
          [field.dataset.endpointField]: field.value.trim(),
        };
        saveState();
      });
      field.addEventListener("change", () => render());
    });

    root.querySelectorAll("[data-setting-field]").forEach((field) => {
      const updateSetting = () => {
        const key = field.dataset.settingField;
        const settings = appSettings();
        let value = field.type === "checkbox" ? field.checked : field.value;
        if (key === "tableLimit") value = tableLimitFromInput(value);
        if (key === "tornRateLimitPerMinute") value = tornRateLimitFromInput(value);
        if (key === "propertyHistoryPages") value = propertyHistoryPagesFromInput(value);
        if (key === "targetAnnualRoi") value = clamp(Number(value) || DEFAULT_SETTINGS.targetAnnualRoi, 0.1, 500);
        if (key === "defaultSuggestionLeaseDays") value = Math.round(clamp(Number(value) || DEFAULT_SETTINGS.defaultSuggestionLeaseDays, 1, 100));
        state.settings = { ...settings, [key]: value };
        if (key === "defaultPropertyTypeId" && value) {
          state.endpointInputs = { ...emptyState.endpointInputs, ...(state.endpointInputs || {}), propertyTypeId: String(value) };
        }
        saveState();
        if (field.type !== "text" && field.type !== "number") render();
      };
      field.addEventListener("input", updateSetting);
      field.addEventListener("change", () => {
        updateSetting();
        render();
      });
    });

    root.querySelectorAll("[data-property-cost]").forEach((field) => {
      const updateCost = () => {
        const key = field.dataset.propertyCost;
        if (!key) return;
        const value = moneyNumber(field.value);
        state.propertyCosts = { ...(state.propertyCosts || {}) };
        if (value) state.propertyCosts[key] = value;
        else delete state.propertyCosts[key];
        saveState();
      };
      field.addEventListener("input", updateCost);
      field.addEventListener("change", () => {
        updateCost();
        render();
      });
    });

    const manualForm = root.querySelector("[data-form='manual']");
    if (manualForm) {
      manualForm.querySelectorAll("input[name='amount'], input[name='dailyAmount'], input[name='durationDays'], input[name='startDate'], input[name='endDate']").forEach((field) => {
        field.addEventListener("change", () => syncManualLeaseForm(manualForm, field.name));
      });
      if (manualForm.elements.property) {
        manualForm.elements.property.addEventListener("change", () => fillManualFormFromOwnedProperty(manualForm));
      }
      ["tenantName", "tenantId"].forEach((name) => {
        if (!manualForm.elements[name]) return;
        manualForm.elements[name].addEventListener("blur", async () => {
          try {
            await lookupManualTenant(manualForm, name);
          } catch (error) {
            setStatus(error.message || "Could not look up renter.", true);
          }
        });
      });
      const propertyIdField = manualForm.querySelector("[data-manual-property-id]");
      if (propertyIdField) {
        propertyIdField.addEventListener("blur", async () => {
          try {
            await lookupManualPropertyOwner(manualForm);
          } catch (error) {
            setStatus(error.message || "Could not look up property owner.", true);
          }
        });
      }
      manualForm.addEventListener("submit", (event) => {
        event.preventDefault();
        syncManualLeaseForm(event.currentTarget, "manual");
        addManualLease(event.currentTarget);
      });
    }

    root.querySelectorAll("[data-modal-stop]").forEach((node) => {
      node.addEventListener("click", (event) => event.stopPropagation());
    });
    root.querySelectorAll(".tlt-modal-backdrop").forEach((node) => {
      node.addEventListener("click", () => {
        const action = node.dataset.action;
        if (action === "close-settings") state.settingsOpen = false;
        else if (action === "close-detail") state.detailView = null;
        else state.manualModalOpen = false;
        saveState();
        render();
      });
    });

    root.querySelectorAll("tbody [data-prop]").forEach((field) => {
      autoSizeInput(field);
      field.addEventListener("input", () => autoSizeInput(field));
      field.addEventListener("change", () => {
        const row = field.closest("tr");
        const prop = field.dataset.prop;
        const moneyField = ["amount", "dailyAmount"].includes(prop);
        const numeric = ["durationDays"].includes(prop);
        const value = moneyField ? moneyNumber(field.value) : (numeric ? positiveNumber(field.value) : field.value);
        updateLease(row.dataset.id, { [prop]: value }, prop);
      });
    });

    root.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        const action = button.dataset.action;
        try {
          if (action === "check-key") await checkApiKey();
          if (action === "refresh-user-details") await refreshUserDetails();
          if (action === "fetch-torn-properties") await fetchTornProperties();
          if (action === "import-owned") await importOwnedProperties();
          if (action === "import-owned-direct") await importOwnedPropertiesDirect();
          if (action === "scan-owned-property-market" || action === "scan-rental-market") await scanOwnedPropertyMarket("rentals");
          if (action === "scan-sale-market") await scanOwnedPropertyMarket("properties");
          if (action === "fetch-spouse-properties") await fetchSpouseProperties();
          if (action === "fetch-user-properties") await fetchUserProperties();
          if (action === "import-current") await importCurrentProperty();
          if (action === "fetch-user-property") await fetchUserProperty();
          if (action === "export-rent-suggestions-csv") exportRentSuggestionsCsv();
          if (action === "delete" && confirmAction(root, "Remove this lease from the list?")) deleteLease(button.dataset.id);
          if (action === "export-json") exportJson();
          if (action === "export-csv") exportCsv();
          if (action === "pick-json") root.querySelector("[data-action='import-json']").click();
          if (action === "open-popup") openPopup();
          if (action === "close-popup") closePopup();
          if (action === "hide-panel") {
            state.panelOpen = false;
            saveState();
            render();
          }
          if (action === "open-manual-modal") {
            state.manualModalOpen = true;
            saveState();
            render();
          }
          if (action === "close-manual-modal") {
            state.manualModalOpen = false;
            saveState();
            render();
          }
          if (action === "open-settings") {
            state.settingsOpen = true;
            saveState();
            render();
          }
          if (action === "close-settings") {
            state.settingsOpen = false;
            saveState();
            render();
          }
          if (action === "open-property") {
            state.detailView = { kind: "property", id: button.dataset.propertyKey || "" };
            saveState();
            render();
          }
          if (action === "open-rental") {
            state.detailView = { kind: "rental", id: button.dataset.contractId || "" };
            saveState();
            render();
          }
          if (action === "open-archive") {
            state.detailView = { kind: "archive", id: button.dataset.contractId || "" };
            saveState();
            render();
          }
          if (action === "close-detail") {
            state.detailView = null;
            saveState();
            render();
          }
          if (action === "dismiss-sync-progress") {
            if (syncProgressDismissTimer) {
              clearTimeout(syncProgressDismissTimer);
              syncProgressDismissTimer = null;
            }
            state.syncProgress = null;
            if (state.syncState !== "syncing") {
              state.syncState = "idle";
              state.syncMessage = "";
            }
            saveState("Sync details dismissed");
            render();
          }
          if (action === "save-api-key") saveApiKeyFromInput((root.querySelector("[data-api-key-input]") || {}).value);
          if (action === "verify-hosted-access") {
            await verifyHostedAccess();
            render();
            setStatus("Subscription checked.");
          }
          if (action === "clear-key") clearApiKey();
          if (action === "clear-icon-cache") clearIconCache();
          if (action === "reset-position") {
            state.panelPosition = null;
            state.panelSize = null;
            saveState();
            render();
            setStatus("Panel position and size reset.");
          }
          if (action === "clear-data") {
            if (confirmAction(root, "Delete all saved leases, settings, and the saved Torn key?")) {
              state.leases = [];
              state.lastSyncAt = null;
              safeDelete(STORE_KEY);
              state = { ...emptyState, apiKey: "", settings: { ...DEFAULT_SETTINGS } };
              saveState();
              render();
              setStatus("All saved data deleted.");
            }
          }
          event.preventDefault();
        } catch (error) {
          setStatus(error.message || "Action failed.", true);
        }
      });
    });

    const importInput = root.querySelector("[data-action='import-json']");
    if (importInput) {
      importInput.addEventListener("change", (event) => {
        const file = event.currentTarget.files && event.currentTarget.files[0];
        if (file) importJson(file);
        event.currentTarget.value = "";
      });
    }
  }

  function openPopup() {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.focus();
      state.panelOpen = false;
      saveState();
      render();
      return;
    }

    const width = Math.round(clamp((state.panelSize && state.panelSize.width) || 920, 520, Math.max(520, window.screen.availWidth - 80)));
    const height = Math.round(clamp((state.panelSize && state.panelSize.height) || 680, 420, Math.max(420, window.screen.availHeight - 80)));
    popupWindow = window.open("", `${APP_ID}-popup`, `popup=yes,width=${width},height=${height},resizable=yes,scrollbars=yes`);
    if (!popupWindow) {
      setStatus("Popup blocked by the browser. Allow popups for Torn, then try again.", true);
      return;
    }

    popupWindow.document.open();
    popupWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Tornfolio</title></head><body></body></html>`);
    popupWindow.document.close();
    syncPopupTheme();
    popupWindow.addEventListener("beforeunload", () => {
      popupWindow = null;
      render();
    });
    state.panelOpen = false;
    saveState();
    popupWindow.focus();
    render();
    setStatus("Opened popup window.");
  }

  function closePopup() {
    if (popupWindow && !popupWindow.closed) popupWindow.close();
    popupWindow = null;
    render();
  }

  function confirmAction(root, message) {
    const view = root && root.ownerDocument && root.ownerDocument.defaultView;
    const confirmFn = view && typeof view.confirm === "function" ? view.confirm.bind(view) : window.confirm.bind(window);
    return confirmFn(message);
  }

  function applyPanelPosition(root) {
    if (!state.panelOpen) {
      root.style.width = "";
      root.style.height = "";
    } else if (state.panelSize) {
      const width = clamp(Number(state.panelSize.width) || 760, 360, Math.max(360, window.innerWidth - 16));
      const height = clamp(Number(state.panelSize.height) || 560, 320, Math.max(320, window.innerHeight - 16));
      root.style.width = `${width}px`;
      root.style.height = `${height}px`;
    } else {
      root.style.width = "";
      root.style.height = "";
    }

    if (!state.panelPosition) {
      root.style.left = "";
      root.style.top = "";
      root.style.right = "";
      root.style.bottom = "";
      return;
    }

    const left = clamp(Number(state.panelPosition.left) || 8, 8, Math.max(8, window.innerWidth - root.offsetWidth - 8));
    const top = clamp(Number(state.panelPosition.top) || 8, 8, Math.max(8, window.innerHeight - root.offsetHeight - 8));
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
  }

  function bindResize(root) {
    if (!window.ResizeObserver) return;
    if (root._tltResizeObserver) root._tltResizeObserver.disconnect();

    root._tltResizeObserver = new ResizeObserver(() => {
      if (!state.panelOpen) return;
      const rect = root.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width < 320 || height < 260) return;
      const previous = state.panelSize || {};
      if (Math.abs((previous.width || 0) - width) < 2 && Math.abs((previous.height || 0) - height) < 2) return;
      state.panelSize = { width, height };
      saveState();
    });

    root._tltResizeObserver.observe(root);
  }

  function bindDrag(root, handle) {
    if (!handle) return;
    handle.addEventListener("pointerdown", (event) => {
      const interactive = event.target.closest("button, input, select, textarea, label");
      if (event.button !== 0 || (interactive && interactive !== handle)) return;
      const rect = root.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const offsetX = startX - rect.left;
      const offsetY = startY - rect.top;
      let moved = false;

      handle.setPointerCapture(event.pointerId);

      const move = (moveEvent) => {
        const left = clamp(moveEvent.clientX - offsetX, 8, Math.max(8, window.innerWidth - root.offsetWidth - 8));
        const top = clamp(moveEvent.clientY - offsetY, 8, Math.max(8, window.innerHeight - root.offsetHeight - 8));
        root.style.left = `${left}px`;
        root.style.top = `${top}px`;
        root.style.right = "auto";
        root.style.bottom = "auto";
        state.panelPosition = { left, top };
        moved = moved || Math.abs(moveEvent.clientX - startX) > 3 || Math.abs(moveEvent.clientY - startY) > 3;
      };

      const up = () => {
        handle.releasePointerCapture(event.pointerId);
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        if (moved) {
          handle.dataset.dragged = "true";
          saveState();
        }
      };

      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
      event.preventDefault();
    });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function escapeHtml(value) {
    return clean(value, "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  window.addEventListener("modulhub:theme-ready", syncPopupTheme);
  window.addEventListener("modulhub:theme-updated", syncPopupTheme);

  function startTornfolio() {
    render();
    void primeIconCache();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startTornfolio);
  } else {
    startTornfolio();
  }
})();
