// ==UserScript==
// @name         JC+ Live Notifier
// @namespace    https://jobcentreplus.torn
// @version      2.3.0
// @description  JC+ companion panel and real-time notifications for Torn directors and applicants.
// @author       JC+ Team
// @icon         data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2064%2064%22%3E%3Crect%20width=%2264%22%20height=%2264%22%20rx=%2214%22%20fill=%22%2311170d%22/%3E%3Cg%20transform=%22translate(-5%20-1)%22%3E%3Cpath%20d=%22M15%2014h10v25c0%208-5%2013-13%2013H9V43h3c2%200%203-1%203-4V14Z%22%20fill=%22%23d9ff52%22/%3E%3Cpath%20d=%22M45%2013c5%200%209%201%2012%204l-5%208c-2-2-4-3-7-3-6%200-10%204-10%2011s4%2011%2010%2011c3%200%206-1%208-3l5%208c-4%203-8%205-14%205-12%200-20-8-20-21s8-20%2021-20Z%22%20fill=%22%23f3f7ee%22/%3E%3Cpath%20d=%22M51%2029h5v-5h5v5h4v5h-4v5h-5v-5h-5v-5Z%22%20fill=%22%23d9ff52%22/%3E%3C/g%3E%3C/svg%3E
// @homepageURL  https://pp-api.sokin.xyz/jobcentreplus/
// @supportURL   https://pp-api.sokin.xyz/jobcentreplus/
// @downloadURL  https://pp-api.sokin.xyz/jobcentreplus/jobcentre-plus-notifier.user.js
// @updateURL    https://pp-api.sokin.xyz/jobcentreplus/jobcentre-plus-notifier.user.js
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @match        https://*.torn.com/*
// @run-at       document-idle
// @noframes
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM.notification
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @connect      pp-api.sokin.xyz
// @connect      localhost
// ==/UserScript==

(function () {
  "use strict";

  const SCRIPT_VERSION = "2.3.0";
  const NOTIFICATION_FEED_VERSION = "2";
  const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#11170d"/><g transform="translate(-5 -1)"><path d="M15 14h10v25c0 8-5 13-13 13H9V43h3c2 0 3-1 3-4V14Z" fill="#d9ff52"/><path d="M45 13c5 0 9 1 12 4l-5 8c-2-2-4-3-7-3-6 0-10 4-10 11s4 11 10 11c3 0 6-1 8-3l5 8c-4 3-8 5-14 5-12 0-20-8-20-21s8-20 21-20Z" fill="#f3f7ee"/><path d="M51 29h5v-5h5v5h4v5h-4v5h-5v-5h-5v-5Z" fill="#d9ff52"/></g></svg>';
  const ICON_DATA_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(ICON_SVG)}`;
  const EMBEDDED_NOTIFIER_TOKEN = "__JOBCENTRE_NOTIFIER_TOKEN__";
  const DEFAULT_JOBCENTRE_ORIGIN = "https://pp-api.sokin.xyz";
  const JOBCENTRE_ORIGIN = String(
    GM_getValue("jobcentre_origin", DEFAULT_JOBCENTRE_ORIGIN),
  ).replace(/\/+$/, "");
  const BASE_URL = `${JOBCENTRE_ORIGIN}/jobcentreplus/api/notifications/`;
  const CONNECT_URL = `${JOBCENTRE_ORIGIN}/jobcentreplus/api/notifications/connect/`;
  const JOBS_URL = `${JOBCENTRE_ORIGIN}/jobcentreplus/api/notifications/jobs/`;
  const PANEL_DATA_URL = `${JOBCENTRE_ORIGIN}/jobcentreplus/api/notifications/panel/`;
  const PANEL_ACTIONS_URL = `${JOBCENTRE_ORIGIN}/jobcentreplus/api/notifications/panel/actions/`;
  const MESSAGES_URL = `${JOBCENTRE_ORIGIN}/jobcentreplus/api/notifications/panel/messages/`;
  const STATS_URL = `${JOBCENTRE_ORIGIN}/jobcentreplus/api/notifications/panel/stats/`;
  const TALENT_URL = `${JOBCENTRE_ORIGIN}/jobcentreplus/api/notifications/talent/`;
  const MOBILE_MEDIA_QUERY = "(max-width: 760px), ((pointer: coarse) and (max-width: 1024px))";
  const POLL_INTERVAL = 30000;
  const CONNECTION_FAILURE_THRESHOLD = 2;
  const CONNECTION_STALE_MS = POLL_INTERVAL * 3;
  const SEEN_STORAGE_KEY = "jobcentre_notif_seen";
  const INITIALIZED_STORAGE_KEY = "jobcentre_notif_initialized";
  const NOTIFICATION_FEED_VERSION_STORAGE_KEY =
    "jobcentre_notif_feed_version";
  const INBOX_STORAGE_KEY = "jobcentre_panel_inbox";
  const READ_STORAGE_KEY = "jobcentre_panel_read";
  const PANEL_STATE_STORAGE_KEY = "jobcentre_panel_state";
  const PANEL_SETTINGS_STORAGE_KEY = "jobcentre_panel_settings";
  const LAUNCHER_POSITION_STORAGE_KEY = "jobcentre_panel_launcher_position";
  const JOBS_CACHE_STORAGE_KEY = "jobcentre_panel_jobs_cache";
  const PANEL_DATA_CACHE_STORAGE_KEY = "jobcentre_panel_application_cache";
  const NOTIFIER_TOKEN_STORAGE_KEY = "jobcentre_notifier_access_token";
  const WORKSTATS_STORAGE_KEY = "jobcentre_panel_workstats";
  const TALENT_CACHE_STORAGE_KEY = "jobcentre_panel_talent_cache";
  const PAGE_FEEDBACK_ID = "jobcentre-plus-notifier-feedback";
  const PANEL_HOST_ID = "jobcentre-plus-panel-host";
  const MAX_SEEN_ITEMS = 250;
  const MAX_INBOX_ITEMS = 100;
  const JOBS_CACHE_TTL_MS = 5 * 60 * 1000;
  const PANEL_DATA_CACHE_TTL_MS = 2 * 60 * 1000;
  const TALENT_CACHE_TTL_MS = 5 * 60 * 1000;
  const MESSAGE_MAX_LENGTH = 1000;
  const STATS_STALE_MS = 6 * 60 * 60 * 1000;
  const STATS_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

  function usableNotifierToken(value) {
    const token = typeof value === "string" ? value.trim() : "";
    return token.startsWith("jcn1.") ? token : "";
  }

  function notifierTokenExpiry(value) {
    const token = usableNotifierToken(value);
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload || typeof atob !== "function") return 0;

    try {
      const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
      const payload = JSON.parse(atob(padded));
      return Number.isSafeInteger(payload?.exp) ? Number(payload.exp) : 0;
    } catch {
      return 0;
    }
  }

  function preferredNotifierToken(storedValue, embeddedValue) {
    const storedToken = usableNotifierToken(storedValue);
    const embeddedToken = usableNotifierToken(embeddedValue);
    if (!storedToken) return embeddedToken;
    if (!embeddedToken) return storedToken;

    const storedExpiry = notifierTokenExpiry(storedToken);
    const embeddedExpiry = notifierTokenExpiry(embeddedToken);
    if (storedExpiry && embeddedExpiry && embeddedExpiry > storedExpiry) {
      return embeddedToken;
    }
    return storedToken;
  }

  const storedNotifierToken = usableNotifierToken(
    GM_getValue(NOTIFIER_TOKEN_STORAGE_KEY, ""),
  );
  let notifierToken = preferredNotifierToken(
    storedNotifierToken,
    EMBEDDED_NOTIFIER_TOKEN,
  );
  if (notifierToken && notifierToken !== storedNotifierToken) {
    GM_setValue(NOTIFIER_TOKEN_STORAGE_KEY, notifierToken);
  }

  function notifierHeaders(headers = {}) {
    return {
      ...headers,
      ...(notifierToken
        ? { Authorization: `Bearer ${notifierToken}` }
        : {}),
    };
  }

  function clearNotifierToken() {
    notifierToken = "";
    GM_setValue(NOTIFIER_TOKEN_STORAGE_KEY, "");
  }

  function jobCentreRequest(options) {
    const modernRequest =
      typeof GM !== "undefined" && typeof GM?.xmlHttpRequest === "function"
        ? GM.xmlHttpRequest.bind(GM)
        : null;
    const legacyRequest =
      typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : null;
    const requests = [legacyRequest, modernRequest].filter(
      (request, index, list) => request && list.indexOf(request) === index,
    );
    if (!requests.length) {
      window.setTimeout(() => {
        options.onerror?.({ error: "Userscript request API unavailable" });
      }, 0);
      return null;
    }

    const canRetryWithFetch =
      Boolean(notifierToken) && String(options.method || "GET").toUpperCase() === "GET";
    let fetchRetryStarted = false;

    function runRequest({ useFetch = false, requestIndex = 0 } = {}) {
      const request = requests[requestIndex] || requests[0];
      let settled = false;
      const finish = (response) => {
        if (settled) return;
        settled = true;
        options.onload?.(response);
      };
      const retryWithFetch = (reason) => {
        if (useFetch || !canRetryWithFetch || fetchRetryStarted) return false;
        fetchRetryStarted = true;
        console.info(
          `[JobCentre+] XHR transport ${reason}; retrying with the fetch transport.`,
        );
        runRequest({
          useFetch: true,
          requestIndex: requests.length > 1 ? 1 : 0,
        });
        return true;
      };
      const fail = (error) => {
        if (settled) return;
        settled = true;
        if (retryWithFetch("failed")) return;
        options.onerror?.(error);
      };
      const timeOut = (response) => {
        if (settled) return;
        settled = true;
        if (retryWithFetch("timed out")) return;
        options.ontimeout?.(response);
      };
      const requestOptions = {
        ...options,
        fetch: useFetch,
        withCredentials: !useFetch,
        ...(useFetch ? { anonymous: true } : {}),
        onload: finish,
        onerror: fail,
        ontimeout: timeOut,
      };

      try {
        const result = request(requestOptions);
        result?.then?.(finish, fail);
        return result;
      } catch (error) {
        fail(error);
        return null;
      }
    }

    return runRequest();
  }

  function notifierAuthenticationRequired() {
    return pollState.lastStatus === 401;
  }

  function noteNotifierResponse(response) {
    if (Number(response?.status) !== 401) return;
    clearNotifierToken();
    pollState.lastAttemptAt = new Date();
    pollState.lastStatus = 401;
    pollState.lastError =
      "Secure notifier access is required. Reconnect JobCentre+.";
  }

  function authAwareMetric(value) {
    return notifierAuthenticationRequired() ? "—" : formatNumber(value);
  }

  const DEFAULT_PANEL_STATE = {
    open: false,
    activeView: "home",
  };

  const DEFAULT_PANEL_SETTINGS = {
    desktopNotifications: true,
    pageBanners: true,
    startOpen: false,
  };

  const DEFAULT_LAUNCHER_POSITION = {
    side: "right",
    yRatio: null,
  };

  const pollState = {
    loading: false,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureMessage: "",
    consecutiveFailures: 0,
    lastStatus: null,
    lastError: "",
    playerName: null,
    player: null,
  };

  const jobsState = {
    jobs: [],
    candidateCount: 0,
    loading: false,
    error: "",
    loadedAt: null,
    query: "",
    filter: "all",
  };

  const panelDataState = {
    outgoing: [],
    incoming: [],
    campaigns: [],
    conversations: [],
    messagingSummary: {
      unreadMessages: 0,
      totalMessages: 0,
      conversationsWithUnread: 0,
    },
    directorSummary: {
      totalCampaigns: 0,
      activeCampaigns: 0,
      pendingCampaigns: 0,
      closedCampaigns: 0,
      expiredCampaigns: 0,
      totalApplicants: 0,
      newApplicants: 0,
      viewedApplicants: 0,
      acceptedApplicants: 0,
      rejectedApplicants: 0,
      conversionRate: 0,
    },
    loading: false,
    error: "",
    loadedAt: null,
    query: "",
    directorQuery: "",
    directorFilter: "active",
    applicationTab: "outgoing",
  };

  const talentState = {
    candidates: [],
    loading: false,
    error: "",
    loadedAt: null,
    query: "",
    companyType: "all",
    trainingPlan: "all",
  };

  const actionState = {
    busyKey: "",
    error: "",
    applyJob: null,
    applyNote: "",
    confirmationKey: "",
    confirmationExpiresAt: 0,
  };

  const statsState = {
    loading: false,
    error: "",
    lastAutoAttemptAt: null,
    autoUnavailable: false,
    lastRequestedAt: null,
    nextRefreshAt: null,
  };

  const messageState = {
    selectedConversationType: "application",
    selectedConversationId: null,
    conversation: null,
    messages: [],
    loading: false,
    requestKey: null,
    error: "",
    busyKey: "",
    draft: "",
    scrollToBottom: false,
  };

  let pageFeedbackTimer = null;
  let panelHost = null;
  let panelRoot = null;
  let lastRenderedView = null;
  let mobileMediaQuery = null;
  let viewportSyncHandle = null;
  let headerSwipe = null;
  let launcherDrag = null;
  let launcherSuppressClickUntil = 0;
  let launcherPosition = loadStoredObject(
    LAUNCHER_POSITION_STORAGE_KEY,
    DEFAULT_LAUNCHER_POSITION,
  );
  let panelState = loadStoredObject(
    PANEL_STATE_STORAGE_KEY,
    DEFAULT_PANEL_STATE,
  );
  let panelSettings = loadStoredObject(
    PANEL_SETTINGS_STORAGE_KEY,
    DEFAULT_PANEL_SETTINGS,
  );
  let inbox = loadStoredArray(INBOX_STORAGE_KEY)
    .map(normalizeNotification)
    .filter((item) => item && item.type !== "SELF_TEST")
    .slice(0, MAX_INBOX_ITEMS);
  let panelReadIds = loadStoredStringSet(READ_STORAGE_KEY);
  let lastProcessedIds = loadStoredStringSet(SEEN_STORAGE_KEY);
  let initialized = Boolean(GM_getValue(INITIALIZED_STORAGE_KEY, false));
  let notificationFeedVersion = String(
    GM_getValue(NOTIFICATION_FEED_VERSION_STORAGE_KEY, ""),
  );
  hydrateJobsCache();
  hydratePanelDataCache();
  hydrateWorkstatsCache();
  hydrateTalentCache();

  panelState = {
    ...DEFAULT_PANEL_STATE,
    ...panelState,
    open: panelSettings.startOpen ? true : Boolean(panelState.open),
    activeView: validView(panelState.activeView) ? panelState.activeView : "home",
  };
  panelSettings = {
    ...DEFAULT_PANEL_SETTINGS,
    ...panelSettings,
  };
  launcherPosition = {
    ...DEFAULT_LAUNCHER_POSITION,
    ...launcherPosition,
    side: launcherPosition.side === "left" ? "left" : "right",
    yRatio:
      launcherPosition.yRatio !== null &&
      launcherPosition.yRatio !== "" &&
      Number.isFinite(Number(launcherPosition.yRatio))
      ? Math.min(1, Math.max(0, Number(launcherPosition.yRatio)))
      : null,
  };

  function loadStoredArray(key) {
    try {
      const parsed = JSON.parse(GM_getValue(key, "[]"));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn(`[JobCentre+] Resetting invalid ${key} storage:`, error);
      return [];
    }
  }

  function loadStoredObject(key, fallback) {
    try {
      const parsed = JSON.parse(GM_getValue(key, JSON.stringify(fallback)));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : { ...fallback };
    } catch (error) {
      console.warn(`[JobCentre+] Resetting invalid ${key} storage:`, error);
      return { ...fallback };
    }
  }

  function loadStoredStringSet(key) {
    return new Set(loadStoredArray(key).map(String));
  }


  function hydrateJobsCache() {
    const cached = loadStoredObject(JOBS_CACHE_STORAGE_KEY, {
      jobs: [],
      candidateCount: 0,
      loadedAt: null,
    });
    jobsState.jobs = Array.isArray(cached.jobs) ? cached.jobs : [];
    jobsState.candidateCount = Number(cached.candidateCount) || 0;
    jobsState.loadedAt = cached.loadedAt ? new Date(cached.loadedAt) : null;
  }

  function saveJobsCache() {
    GM_setValue(
      JOBS_CACHE_STORAGE_KEY,
      JSON.stringify({
        jobs: jobsState.jobs,
        candidateCount: jobsState.candidateCount,
        loadedAt: jobsState.loadedAt ? jobsState.loadedAt.toISOString() : null,
      }),
    );
  }

  function hydratePanelDataCache() {
    const cached = loadStoredObject(PANEL_DATA_CACHE_STORAGE_KEY, {
      outgoing: [],
      incoming: [],
      campaigns: [],
      conversations: [],
      messagingSummary: {},
      directorSummary: {},
      loadedAt: null,
    });
    for (const key of ["outgoing", "incoming", "campaigns", "conversations"]) {
      panelDataState[key] = Array.isArray(cached[key]) ? cached[key] : [];
    }
    panelDataState.messagingSummary = {
      ...panelDataState.messagingSummary,
      ...(cached.messagingSummary && typeof cached.messagingSummary === "object"
        ? cached.messagingSummary
        : {}),
    };
    panelDataState.directorSummary = {
      ...panelDataState.directorSummary,
      ...(cached.directorSummary && typeof cached.directorSummary === "object"
        ? cached.directorSummary
        : {}),
    };
    panelDataState.loadedAt = cached.loadedAt ? new Date(cached.loadedAt) : null;
  }

  function savePanelDataCache() {
    GM_setValue(
      PANEL_DATA_CACHE_STORAGE_KEY,
      JSON.stringify({
        outgoing: panelDataState.outgoing,
        incoming: panelDataState.incoming,
        campaigns: panelDataState.campaigns,
        conversations: panelDataState.conversations,
        messagingSummary: panelDataState.messagingSummary,
        directorSummary: panelDataState.directorSummary,
        loadedAt: panelDataState.loadedAt
          ? panelDataState.loadedAt.toISOString()
          : null,
      }),
    );
  }

  function hydrateWorkstatsCache() {
    const cached = loadStoredObject(WORKSTATS_STORAGE_KEY, {
      player: null,
      cachedAt: null,
    });
    const player = normalizePlayer(cached.player);
    if (!player) return;
    pollState.player = player;
    pollState.playerName = player.name || null;
  }

  function saveWorkstatsCache() {
    if (!pollState.player) return;
    GM_setValue(
      WORKSTATS_STORAGE_KEY,
      JSON.stringify({
        player: pollState.player,
        cachedAt: new Date().toISOString(),
      }),
    );
  }

  function hydrateTalentCache() {
    const cached = loadStoredObject(TALENT_CACHE_STORAGE_KEY, {
      candidates: [],
      loadedAt: null,
    });
    talentState.candidates = Array.isArray(cached.candidates)
      ? cached.candidates
      : [];
    talentState.loadedAt = cached.loadedAt
      ? new Date(cached.loadedAt)
      : null;
  }

  function saveTalentCache() {
    GM_setValue(
      TALENT_CACHE_STORAGE_KEY,
      JSON.stringify({
        candidates: talentState.candidates,
        loadedAt: talentState.loadedAt
          ? talentState.loadedAt.toISOString()
          : null,
      }),
    );
  }

  function normalizePlayer(raw) {
    if (!raw || typeof raw !== "object") return null;
    const workstats = raw.workstats && typeof raw.workstats === "object"
      ? raw.workstats
      : raw;
    const hasWorkstats = [
      "manualLabor",
      "intelligence",
      "endurance",
      "total",
      "totalWorkstats",
    ].some((key) => Object.prototype.hasOwnProperty.call(workstats, key));
    if (!hasWorkstats) return null;
    return {
      tornId: Number(raw.tornId ?? raw.id) || null,
      name: String(raw.name || ""),
      manualLabor: Number(workstats.manualLabor ?? raw.manualLabor) || 0,
      intelligence: Number(workstats.intelligence ?? raw.intelligence) || 0,
      endurance: Number(workstats.endurance ?? raw.endurance) || 0,
      totalWorkstats:
        Number(workstats.total ?? raw.totalWorkstats) ||
        (Number(workstats.manualLabor ?? raw.manualLabor) || 0) +
          (Number(workstats.intelligence ?? raw.intelligence) || 0) +
          (Number(workstats.endurance ?? raw.endurance) || 0),
      currentPosition: raw.currentPosition ? String(raw.currentPosition) : null,
      currentCompanyId: Number(raw.currentCompanyId) || null,
      currentCompanyName: raw.currentCompanyName
        ? String(raw.currentCompanyName)
        : null,
      currentCompanyRating: Number(raw.currentCompanyRating) || 0,
      isAdmin: Boolean(raw.isAdmin),
      isModerator: Boolean(raw.isModerator),
      isOwner: Boolean(raw.isOwner),
      isRecruiter: Boolean(raw.isRecruiter),
      accessLevel: raw.accessLevel ? String(raw.accessLevel) : "user",
      accountStatus: raw.accountStatus ? String(raw.accountStatus) : "active",
      lastStatsRefreshAt: raw.lastStatsRefreshAt
        ? String(raw.lastStatsRefreshAt)
        : pollState.player?.lastStatsRefreshAt ?? null,
    };
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(Number(value) || 0);
  }

  function formatMoney(value, fallback = "Not stated") {
    const numeric = Number(value) || 0;
    return numeric > 0 ? `$${formatNumber(numeric)}` : fallback;
  }

  function trainingSummary(job) {
    if (job.trainingPlanType === "rotational") return "Rotational training";
    if (job.trainingPlanType === "paid") {
      return `${formatMoney(job.paidTrainingAmount, "$0")} for ${formatNumber(
        job.paidTrainingTrains,
      )} trains`;
    }
    return `${formatNumber(job.minimumTrainsPerWeek)} trains/week`;
  }

  function jobRequirements(job) {
    return [
      { key: "manualLabor", label: "MAN", required: Number(job.minimumMan) || 0 },
      { key: "intelligence", label: "INT", required: Number(job.minimumInt) || 0 },
      { key: "endurance", label: "END", required: Number(job.minimumEnd) || 0 },
      { key: "totalWorkstats", label: "TOTAL", required: Number(job.minimumTotal) || 0 },
    ].filter((item) => item.required > 0);
  }

  function jobMatch(job) {
    const player = pollState.player;
    const requirements = jobRequirements(job);
    if (!player || requirements.length === 0) {
      return { known: Boolean(player), qualified: requirements.length === 0, met: [], missing: [] };
    }
    const met = [];
    const missing = [];
    for (const requirement of requirements) {
      const actual = Number(player[requirement.key]) || 0;
      const detail = { ...requirement, actual };
      if (actual >= requirement.required) met.push(detail);
      else missing.push(detail);
    }
    return { known: true, qualified: missing.length === 0, met, missing };
  }

  function expiresLabel(value) {
    if (!value) return "No expiry shown";
    const expiry = new Date(value).getTime();
    if (!Number.isFinite(expiry)) return "Expiry unavailable";
    const remaining = expiry - Date.now();
    if (remaining <= 0) return "Expired";
    const hours = Math.ceil(remaining / 3600000);
    if (hours < 24) return `${hours}h left`;
    const days = Math.ceil(hours / 24);
    return `${days}d left`;
  }

  function statsTimestamp(player = pollState.player) {
    const timestamp = new Date(player?.lastStatsRefreshAt || "").getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function statsAreStale(player = pollState.player) {
    const timestamp = statsTimestamp(player);
    return !timestamp || Date.now() - timestamp >= STATS_STALE_MS;
  }

  function statsFreshnessLabel(player = pollState.player) {
    const timestamp = statsTimestamp(player);
    if (!timestamp) return "Not refreshed yet";
    return `Updated ${formatRelativeTime(new Date(timestamp).toISOString()).toLowerCase()}`;
  }

  function updatePlayerFromStats(raw) {
    const next = normalizePlayer(raw);
    if (!next) return false;
    pollState.player = next;
    pollState.playerName = next.name || pollState.playerName;
    saveWorkstatsCache();
    return true;
  }

  function statsCooldownRemaining() {
    const explicit = new Date(statsState.nextRefreshAt || "").getTime();
    const fallback = statsTimestamp()
      ? statsTimestamp() + STATS_REFRESH_COOLDOWN_MS
      : 0;
    const refreshAt = Number.isFinite(explicit) ? explicit : fallback;
    return Math.max(0, refreshAt - Date.now());
  }

  function statsRefreshButtonLabel() {
    if (statsState.loading) return "Refreshing…";
    const remaining = statsCooldownRemaining();
    if (!remaining) return "Refresh stats";
    const minutes = Math.max(1, Math.ceil(remaining / 60000));
    return `Refresh in ${minutes}m`;
  }

  function refreshWorkstats({ manual = true } = {}) {
    if (statsState.loading) return;
    statsState.loading = true;
    statsState.error = "";
    statsState.lastRequestedAt = new Date();
    renderPanel();

    jobCentreRequest({
      method: "POST",
      url: STATS_URL,
      withCredentials: true,
      timeout: 20000,
      headers: notifierHeaders({
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-JobCentre-Panel": "userscript-v1",
      }),
      data: JSON.stringify({ action: "refresh" }),
      onload(response) {
        noteNotifierResponse(response);
        statsState.loading = false;
        if (response.status !== 200) {
          statsState.autoUnavailable = response.status === 404;
          statsState.error =
            response.status === 404
              ? "Work-stat refresh will activate after the JC+ server update is deployed."
              : errorMessage(response);
          renderPanel();
          if (manual) {
            displayNotification({
              title: "JC+: Work stats could not refresh",
              text: statsState.error,
              tone: "error",
            });
          }
          return;
        }

        try {
          const data = JSON.parse(response.responseText);
          if (!updatePlayerFromStats(data.user)) {
            throw new Error("The server did not return valid work stats.");
          }
          statsState.error = "";
          statsState.autoUnavailable = false;
          statsState.nextRefreshAt = data.nextRefreshAt || null;
          const cooldownRemaining = statsCooldownRemaining();
          if (cooldownRemaining > 0) {
            window.setTimeout(renderPanel, cooldownRemaining + 1000);
          }
          renderPanel();
          if (manual) {
            displayNotification({
              title: data.cached ? "JC+: Work stats are current" : "JC+: Work stats refreshed",
              text: `${formatNumber(pollState.player.manualLabor)} MAN · ${formatNumber(pollState.player.intelligence)} INT · ${formatNumber(pollState.player.endurance)} END`,
              tone: "success",
            });
          }
        } catch (error) {
          statsState.error =
            error instanceof Error ? error.message : "The refreshed stats could not be read.";
          renderPanel();
        }
      },
      onerror() {
        statsState.loading = false;
        statsState.error = "Could not reach the JC+ server to refresh work stats.";
        renderPanel();
        if (manual) {
          displayNotification({
            title: "JC+: Work stats could not refresh",
            text: statsState.error,
            tone: "error",
          });
        }
      },
      ontimeout() {
        statsState.loading = false;
        statsState.error = "The work-stat refresh timed out.";
        renderPanel();
      },
    });
  }

  function maybeAutoRefreshStats() {
    const lastAutoAttempt = statsState.lastAutoAttemptAt instanceof Date
      ? statsState.lastAutoAttemptAt.getTime()
      : 0;
    if (
      statsState.autoUnavailable ||
      statsState.loading ||
      !pollState.playerName ||
      !statsAreStale() ||
      Date.now() - lastAutoAttempt < STATS_REFRESH_COOLDOWN_MS
    ) {
      return;
    }
    statsState.lastAutoAttemptAt = new Date();
    refreshWorkstats({ manual: false });
  }

  function fetchTalent({ force = false, manual = false } = {}) {
    const cacheFresh =
      talentState.loadedAt instanceof Date &&
      Date.now() - talentState.loadedAt.getTime() < TALENT_CACHE_TTL_MS;
    if (
      talentState.loading ||
      (!force && cacheFresh && talentState.candidates.length)
    ) {
      renderPanel();
      return;
    }

    talentState.loading = true;
    talentState.error = "";
    renderPanel();
    jobCentreRequest({
      method: "GET",
      url: `${TALENT_URL}?_=${Date.now()}`,
      withCredentials: true,
      timeout: 15000,
      headers: notifierHeaders({ Accept: "application/json" }),
      onload(response) {
        noteNotifierResponse(response);
        talentState.loading = false;
        if (response.status !== 200) {
          talentState.error = errorMessage(response);
          renderPanel();
          if (manual) {
            displayNotification({
              title: "JobCentre+: Applicant pool refresh failed",
              text: talentState.error,
              tone: "error",
            });
          }
          return;
        }
        try {
          const data = JSON.parse(response.responseText);
          if (!Array.isArray(data.candidates)) {
            throw new Error("The server returned an invalid applicant pool.");
          }
          talentState.candidates = data.candidates;
          talentState.loadedAt = new Date();
          talentState.error = "";
          saveTalentCache();
          renderPanel();
        } catch (error) {
          talentState.error =
            error instanceof Error
              ? error.message
              : "The applicant pool could not be read.";
          renderPanel();
        }
      },
      onerror() {
        talentState.loading = false;
        talentState.error = "Could not reach the JobCentre+ applicant pool.";
        renderPanel();
      },
      ontimeout() {
        talentState.loading = false;
        talentState.error = "The applicant pool request timed out.";
        renderPanel();
      },
    });
  }

  function fetchJobs({ force = false, manual = false } = {}) {
    const cacheFresh =
      jobsState.loadedAt instanceof Date &&
      Date.now() - jobsState.loadedAt.getTime() < JOBS_CACHE_TTL_MS;
    if (jobsState.loading || (!force && cacheFresh && jobsState.jobs.length)) {
      renderPanel();
      return;
    }

    jobsState.loading = true;
    jobsState.error = "";
    renderPanel();

    jobCentreRequest({
      method: "GET",
      url: `${JOBS_URL}?_=${Date.now()}`,
      withCredentials: true,
      timeout: 15000,
      headers: notifierHeaders({ Accept: "application/json" }),
      onload(response) {
        noteNotifierResponse(response);
        jobsState.loading = false;
        if (response.status !== 200) {
          jobsState.error = errorMessage(response);
          renderPanel();
          if (manual) {
            displayNotification({
              title: "JobCentre+: Jobs refresh failed",
              text: jobsState.error,
              tone: "error",
            });
          }
          return;
        }
        try {
          const data = JSON.parse(response.responseText);
          if (!Array.isArray(data.jobs)) {
            throw new Error("The server returned an invalid jobs list.");
          }
          jobsState.jobs = data.jobs;
          jobsState.candidateCount = Number(data.candidateCount) || 0;
          jobsState.loadedAt = new Date();
          jobsState.error = "";
          saveJobsCache();
          renderPanel();
          if (manual) {
            displayNotification({
              title: "JobCentre+: Jobs refreshed",
              text: `${jobsState.jobs.length} live listing${jobsState.jobs.length === 1 ? "" : "s"} loaded.`,
              tone: "success",
            });
          }
        } catch (error) {
          jobsState.error =
            error instanceof Error ? error.message : "Invalid jobs response.";
          renderPanel();
        }
      },
      onerror() {
        jobsState.loading = false;
        jobsState.error = "Could not reach the JobCentre+ jobs service.";
        renderPanel();
      },
      ontimeout() {
        jobsState.loading = false;
        jobsState.error = "The JobCentre+ jobs request timed out.";
        renderPanel();
      },
    });
  }

  function panelDataCount() {
    return (
      panelDataState.outgoing.length +
      panelDataState.incoming.length +
      panelDataState.campaigns.length
    );
  }

  function fetchPanelData({ force = false, manual = false } = {}) {
    const cacheFresh =
      panelDataState.loadedAt instanceof Date &&
      Date.now() - panelDataState.loadedAt.getTime() < PANEL_DATA_CACHE_TTL_MS;
    if (
      panelDataState.loading ||
      (!force && cacheFresh && panelDataCount() > 0)
    ) {
      renderPanel();
      return;
    }

    panelDataState.loading = true;
    panelDataState.error = "";
    renderPanel();

    jobCentreRequest({
      method: "GET",
      url: `${PANEL_DATA_URL}?_=${Date.now()}`,
      withCredentials: true,
      timeout: 15000,
      headers: notifierHeaders({ Accept: "application/json" }),
      onload(response) {
        noteNotifierResponse(response);
        panelDataState.loading = false;
        if (response.status !== 200) {
          if (response.status === 404) {
            panelDataState.outgoing = [];
            panelDataState.incoming = [];
            panelDataState.campaigns = [];
            panelDataState.conversations = [];
            panelDataState.messagingSummary = {
              unreadMessages: 0,
              totalConversations: 0,
              totalMessages: 0,
            };
            panelDataState.directorSummary = {
              totalCampaigns: 0,
              activeCampaigns: 0,
              pendingCampaigns: 0,
              closedCampaigns: 0,
              expiredCampaigns: 0,
              totalApplicants: 0,
              newApplicants: 0,
              viewedApplicants: 0,
              acceptedApplicants: 0,
              rejectedApplicants: 0,
              conversionRate: 0,
            };
            panelDataState.loadedAt = new Date();
            panelDataState.error = "";
            savePanelDataCache();
            renderPanel();
            if (manual) {
              displayNotification({
                title: "JC+: Nothing to show yet",
                text: "No applications or conversations are available for this account.",
                tone: "success",
              });
            }
            return;
          }
          panelDataState.error = errorMessage(response);
          renderPanel();
          if (manual) {
            displayNotification({
              title: "JC+: Applications refresh failed",
              text:
                response.status === 401
                  ? "Open Settings and choose Reconnect JobCentre+."
                  : panelDataState.error,
              tone: "error",
            });
          }
          return;
        }

        try {
          const data = JSON.parse(response.responseText);
          for (const key of ["outgoing", "incoming", "campaigns", "conversations"]) {
            if (!Array.isArray(data[key])) {
              throw new Error(`The server returned an invalid ${key} list.`);
            }
            panelDataState[key] = data[key];
          }
          panelDataState.messagingSummary = {
            ...panelDataState.messagingSummary,
            ...(data.messagingSummary && typeof data.messagingSummary === "object"
              ? data.messagingSummary
              : {}),
          };
          panelDataState.directorSummary = {
            ...panelDataState.directorSummary,
            ...(data.directorSummary && typeof data.directorSummary === "object"
              ? data.directorSummary
              : {}),
          };
          panelDataState.loadedAt = new Date();
          panelDataState.error = "";
          savePanelDataCache();
          renderPanel();
          if (manual) {
            displayNotification({
              title: "JobCentre+: Applications refreshed",
              text: `${panelDataState.outgoing.length} sent, ${panelDataState.incoming.length} received and ${panelDataState.campaigns.length} campaign records loaded.`,
              tone: "success",
            });
          }
        } catch (error) {
          panelDataState.error =
            error instanceof Error
              ? error.message
              : "Invalid applications response.";
          renderPanel();
        }
      },
      onerror() {
        panelDataState.loading = false;
        panelDataState.error =
          "Could not reach the JobCentre+ applications service.";
        renderPanel();
      },
      ontimeout() {
        panelDataState.loading = false;
        panelDataState.error = "The applications request timed out.";
        renderPanel();
      },
    });
  }


  function messageUnreadCount() {
    return Number(panelDataState.messagingSummary?.unreadMessages) || 0;
  }

  function normalizedConversationType(value) {
    return String(value || "application") === "talent" ? "talent" : "application";
  }

  function conversationIdFor(item) {
    const type = normalizedConversationType(item?.conversationType);
    const id = Number(
      type === "talent"
        ? item?.conversationId ?? item?.talentConversationId
        : item?.applicationId ?? item?.conversationId,
    );
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function conversationPayload(type, id) {
    const conversationType = normalizedConversationType(type);
    return {
      conversationType,
      conversationId: id,
      ...(conversationType === "application" ? { applicationId: id } : {}),
    };
  }

  function selectedConversationSummary() {
    const id = Number(messageState.selectedConversationId);
    const type = normalizedConversationType(messageState.selectedConversationType);
    return panelDataState.conversations.find(
      (item) =>
        normalizedConversationType(item.conversationType) === type &&
        conversationIdFor(item) === id,
    ) || null;
  }

  function closeConversation() {
    messageState.selectedConversationType = "application";
    messageState.selectedConversationId = null;
    messageState.conversation = null;
    messageState.messages = [];
    messageState.loading = false;
    messageState.requestKey = null;
    messageState.error = "";
    messageState.busyKey = "";
    messageState.draft = "";
    renderPanel();
  }

  function scrollMessageThreadToBottom() {
    messageState.scrollToBottom = true;
  }

  function messageRequest(payload, { busyKey = "message", onSuccess } = {}) {
    if (messageState.busyKey) return;
    messageState.busyKey = String(busyKey);
    messageState.error = "";
    renderPanel();

    jobCentreRequest({
      method: "POST",
      url: MESSAGES_URL,
      withCredentials: true,
      timeout: 15000,
      headers: notifierHeaders({
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-JobCentre-Panel": "userscript-v1",
      }),
      data: JSON.stringify(payload),
      onload(response) {
        noteNotifierResponse(response);
        messageState.busyKey = "";
        let data = {};
        try {
          data = JSON.parse(response.responseText || "{}");
        } catch {
          data = {};
        }
        if (response.status < 200 || response.status >= 300) {
          messageState.error =
            typeof data.error === "string" ? data.error : `HTTP ${response.status}`;
          renderPanel();
          displayNotification({
            title: "JobCentre+: Message failed",
            text: messageState.error,
            tone: "error",
          });
          return;
        }
        if (typeof onSuccess === "function") onSuccess(data);
      },
      onerror() {
        messageState.busyKey = "";
        messageState.error = "Could not reach the JobCentre+ messaging service.";
        renderPanel();
      },
      ontimeout() {
        messageState.busyKey = "";
        messageState.error = "The messaging request timed out.";
        renderPanel();
      },
    });
  }

  function markConversationRead(type, conversationId) {
    const conversationType = normalizedConversationType(type);
    const id = Number(conversationId);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    messageRequest(
      { action: "mark-read", ...conversationPayload(conversationType, id) },
      {
        busyKey: `read:${conversationType}:${id}`,
        onSuccess() {
          const now = new Date().toISOString();
          messageState.messages = messageState.messages.map((message) =>
            message.isMine || message.readAt
              ? message
              : { ...message, readAt: now },
          );
          const summary = selectedConversationSummary();
          const previousUnread = Number(summary?.unreadCount || 0);
          if (summary) summary.unreadCount = 0;
          panelDataState.messagingSummary.unreadMessages = Math.max(
            0,
            messageUnreadCount() - previousUnread,
          );
          fetchPanelData({ force: true });
          renderPanel();
        },
      },
    );
  }

  function fetchConversation(type, conversationId, { force = false, markRead = true } = {}) {
    const conversationType = normalizedConversationType(type);
    const id = Number(conversationId);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    if (
      (messageState.loading && !force) ||
      (!force &&
        normalizedConversationType(messageState.conversation?.conversationType) ===
          conversationType &&
        conversationIdFor(messageState.conversation) === id)
    ) {
      renderPanel();
      return;
    }

    messageState.selectedConversationType = conversationType;
    messageState.selectedConversationId = id;
    messageState.loading = true;
    const requestKey = {};
    messageState.requestKey = requestKey;
    messageState.error = "";
    renderPanel();

    jobCentreRequest({
      method: "GET",
      url: `${MESSAGES_URL}?conversationType=${encodeURIComponent(conversationType)}&conversationId=${encodeURIComponent(String(id))}&_=${Date.now()}`,
      withCredentials: true,
      timeout: 15000,
      headers: notifierHeaders({ Accept: "application/json" }),
      onload(response) {
        if (messageState.requestKey !== requestKey) return;
        noteNotifierResponse(response);
        messageState.loading = false;
        messageState.requestKey = null;
        if (response.status !== 200) {
          messageState.error = errorMessage(response);
          renderPanel();
          return;
        }
        try {
          const data = JSON.parse(response.responseText);
          if (!data.conversation || !Array.isArray(data.messages)) {
            throw new Error("The server returned an invalid conversation.");
          }
          if (
            normalizedConversationType(data.conversation.conversationType) !==
              conversationType ||
            conversationIdFor(data.conversation) !== id ||
            normalizedConversationType(messageState.selectedConversationType) !==
              conversationType ||
            Number(messageState.selectedConversationId) !== id
          ) {
            return;
          }
          messageState.conversation = data.conversation;
          messageState.messages = data.messages;
          messageState.error = "";
          scrollMessageThreadToBottom();
          renderPanel();
          if (
            markRead &&
            Number(data.unreadCount ?? data.conversation.unreadCount) > 0
          ) {
            markConversationRead(conversationType, id);
          }
        } catch (error) {
          messageState.error =
            error instanceof Error ? error.message : "Invalid conversation response.";
          renderPanel();
        }
      },
      onerror() {
        if (messageState.requestKey !== requestKey) return;
        messageState.loading = false;
        messageState.requestKey = null;
        messageState.error = "Could not reach the JobCentre+ messaging service.";
        renderPanel();
      },
      ontimeout() {
        if (messageState.requestKey !== requestKey) return;
        messageState.loading = false;
        messageState.requestKey = null;
        messageState.error = "The conversation request timed out.";
        renderPanel();
      },
    });
  }

  function openConversation(type, conversationId) {
    const conversationType = normalizedConversationType(type);
    const id = Number(conversationId);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    messageState.selectedConversationType = conversationType;
    messageState.selectedConversationId = id;
    messageState.conversation = null;
    messageState.messages = [];
    messageState.error = "";
    messageState.draft = "";
    panelState.activeView = "messages";
    panelState.open = true;
    savePanelState();
    fetchConversation(conversationType, id, { force: true });
  }

  function startTalentConversation(candidateTornId) {
    const id = Number(candidateTornId);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    messageRequest(
      { action: "start-talent", candidateTornId: id },
      {
        busyKey: `talent:${id}`,
        onSuccess(data) {
          const conversationId = Number(data.conversationId);
          if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
            messageState.error = "The server did not return a valid conversation.";
            renderPanel();
            return;
          }
          fetchPanelData({ force: true });
          openConversation("talent", conversationId);
        },
      },
    );
  }

  function sendConversationMessage() {
    const conversationType = normalizedConversationType(
      messageState.selectedConversationType,
    );
    const conversationId = Number(messageState.selectedConversationId);
    const body = String(messageState.draft || "").trim();
    if (!conversationId) return;
    if (!body) {
      messageState.error = "Write a message before sending.";
      renderPanel();
      return;
    }
    if (body.length > MESSAGE_MAX_LENGTH) {
      messageState.error = `Messages are limited to ${MESSAGE_MAX_LENGTH} characters.`;
      renderPanel();
      return;
    }
    messageRequest(
      { action: "send", ...conversationPayload(conversationType, conversationId), body },
      {
        busyKey: `send:${conversationType}:${conversationId}`,
        onSuccess() {
          messageState.draft = "";
          messageState.error = "";
          displayNotification({
            title: "JobCentre+: Message sent",
            text: "Your reply has been added to the conversation.",
            tone: "success",
          });
          fetchConversation(conversationType, conversationId, {
            force: true,
            markRead: false,
          });
          fetchPanelData({ force: true });
          fetchNotifications();
        },
      },
    );
  }

  function reportConversationMessage(messageId) {
    const conversationType = normalizedConversationType(
      messageState.selectedConversationType,
    );
    const conversationId = Number(messageState.selectedConversationId);
    const id = Number(messageId);
    if (!conversationId || !id || typeof window.prompt !== "function") return;
    const reason = window.prompt(
      "Why are you reporting this message? Please give a brief reason.",
      "",
    );
    if (reason === null) return;
    messageRequest(
      {
        action: "report",
        ...conversationPayload(conversationType, conversationId),
        messageId: id,
        reason,
      },
      {
        busyKey: `report:${id}`,
        onSuccess() {
          displayNotification({
            title: "JobCentre+: Message reported",
            text: "The message has been queued for moderator review.",
            tone: "warning",
          });
          fetchConversation(conversationType, conversationId, {
            force: true,
            markRead: false,
          });
        },
      },
    );
  }


  function outgoingApplicationForJob(jobId) {
    return panelDataState.outgoing.find(
      (item) => Number(item?.job?.id) === Number(jobId),
    ) || null;
  }

  function actionIsBusy(key) {
    return actionState.busyKey === String(key || "");
  }

  function actionLabel(status) {
    return {
      viewed: "marked viewed",
      accepted: "accepted",
      rejected: "rejected",
    }[String(status || "")] || "updated";
  }

  function closeApplyModal() {
    actionState.applyJob = null;
    actionState.applyNote = "";
    actionState.error = "";
    renderPanel();
  }

  function openApplyModal(jobId) {
    const job = jobsState.jobs.find((item) => Number(item.id) === Number(jobId));
    if (!job) return;
    const existing = outgoingApplicationForJob(job.id);
    if (existing) {
      panelDataState.applicationTab = "outgoing";
      setActiveView("applications");
      return;
    }
    actionState.applyJob = job;
    actionState.applyNote = "";
    actionState.error = "";
    renderPanel();
  }

  function confirmPanelAction(key, message) {
    const now = Date.now();
    if (
      actionState.confirmationKey === key &&
      actionState.confirmationExpiresAt > now
    ) {
      actionState.confirmationKey = "";
      actionState.confirmationExpiresAt = 0;
      return true;
    }
    actionState.confirmationKey = key;
    actionState.confirmationExpiresAt = now + 8000;
    showPageFeedback({
      title: "JobCentre+: Confirm action",
      text: `${message}\nTap the same action again within 8 seconds to confirm.`,
      tone: "warning",
      compact: true,
      duration: 8000,
    });
    return false;
  }

  function performPanelAction(payload, options = {}) {
    if (actionState.busyKey) return;
    const busyKey = String(options.busyKey || payload.action || "action");
    actionState.busyKey = busyKey;
    actionState.error = "";
    renderPanel();

    jobCentreRequest({
      method: "POST",
      url: PANEL_ACTIONS_URL,
      withCredentials: true,
      timeout: 15000,
      headers: notifierHeaders({
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-JobCentre-Panel": "userscript-v1",
      }),
      data: JSON.stringify(payload),
      onload(response) {
        noteNotifierResponse(response);
        actionState.busyKey = "";
        let data = {};
        try {
          data = JSON.parse(response.responseText || "{}");
        } catch {
          data = {};
        }
        if (response.status < 200 || response.status >= 300) {
          actionState.error =
            typeof data.error === "string" ? data.error : `HTTP ${response.status}`;
          renderPanel();
          displayNotification({
            title: "JobCentre+: Action failed",
            text: actionState.error,
            tone: "error",
          });
          return;
        }

        const message =
          typeof data.message === "string"
            ? data.message
            : String(options.successMessage || "Action completed.");
        actionState.applyJob = null;
        actionState.applyNote = "";
        actionState.error = "";
        if (payload.action === "apply") {
          panelDataState.applicationTab = "outgoing";
          panelState.activeView = "applications";
          savePanelState();
        } else if (payload.action === "set-status") {
          panelDataState.applicationTab = "incoming";
        } else if (payload.action === "campaign-status") {
          panelState.activeView = "director";
          savePanelState();
        }
        fetchPanelData({ force: true });
        fetchNotifications();
        renderPanel();
        displayNotification({
          title: "JobCentre+: Updated",
          text: message,
          tone: payload.status === "rejected" ? "rejected" : "success",
        });
      },
      onerror() {
        actionState.busyKey = "";
        actionState.error = "Could not reach the JobCentre+ action service.";
        renderPanel();
      },
      ontimeout() {
        actionState.busyKey = "";
        actionState.error = "The JobCentre+ action request timed out.";
        renderPanel();
      },
    });
  }

  function submitApplication() {
    const job = actionState.applyJob;
    if (!job) return;
    if (String(pollState.player?.accountStatus || "active") !== "active") {
      actionState.error = "Set your JobCentre+ availability to Active before applying.";
      renderPanel();
      showPageFeedback({
        title: "JobCentre+: Availability inactive",
        text: "Open your JobCentre+ profile and set availability to Active to enable applications.",
        tone: "warning",
        compact: true,
      });
      return;
    }
    const note = String(actionState.applyNote || "").trim();
    if (note.length > 500) {
      actionState.error = "Application notes are limited to 500 characters.";
      renderPanel();
      return;
    }
    performPanelAction(
      { action: "apply", jobId: job.id, note },
      { busyKey: `apply:${job.id}`, successMessage: "Application sent." },
    );
  }

  function saveSeenIds() {
    const list = Array.from(lastProcessedIds).slice(-MAX_SEEN_ITEMS);
    lastProcessedIds = new Set(list);
    GM_setValue(SEEN_STORAGE_KEY, JSON.stringify(list));
  }

  function saveInbox() {
    GM_setValue(INBOX_STORAGE_KEY, JSON.stringify(inbox.slice(0, MAX_INBOX_ITEMS)));
  }

  function saveReadIds(priorityIds = []) {
    const merged = new Set(panelReadIds);
    const promote = (ids) => {
      for (const value of ids) {
        const id = String(value);
        merged.delete(id);
        merged.add(id);
      }
    };

    // Userscript storage is shared by every open Torn tab. Pull in the latest
    // stored value before writing so an older tab cannot undo a newer read action.
    promote(loadStoredStringSet(READ_STORAGE_KEY));
    promote(priorityIds);
    const list = Array.from(merged).slice(-MAX_SEEN_ITEMS);
    panelReadIds = new Set(list);
    GM_setValue(READ_STORAGE_KEY, JSON.stringify(list));
  }

  function savePanelState() {
    GM_setValue(PANEL_STATE_STORAGE_KEY, JSON.stringify(panelState));
  }

  function savePanelSettings() {
    GM_setValue(PANEL_SETTINGS_STORAGE_KEY, JSON.stringify(panelSettings));
  }

  function normalizeNotification(item) {
    if (!item || item.id === undefined || item.id === null) return null;
    return {
      id: String(item.id),
      type: String(item.type || "UPDATE").toUpperCase(),
      title: String(item.title || "New update"),
      message: String(item.message || "You have a new update on JobCentre+."),
      createdAt:
        typeof item.createdAt === "string" || typeof item.createdAt === "number"
          ? item.createdAt
          : null,
      targetPath:
        typeof item.targetPath === "string" ? item.targetPath : null,
      companyTornId:
        item.companyTornId === undefined || item.companyTornId === null
          ? null
          : String(item.companyTornId),
      applicationId:
        Number.isSafeInteger(Number(item.applicationId)) && Number(item.applicationId) > 0
          ? Number(item.applicationId)
          : null,
      jobId:
        Number.isSafeInteger(Number(item.jobId)) && Number(item.jobId) > 0
          ? Number(item.jobId)
          : null,
      applicantTornId:
        Number.isSafeInteger(Number(item.applicantTornId)) &&
        Number(item.applicantTornId) > 0
          ? Number(item.applicantTornId)
          : null,
      talentConversationId:
        Number.isSafeInteger(Number(item.talentConversationId)) &&
        Number(item.talentConversationId) > 0
          ? Number(item.talentConversationId)
          : null,
    };
  }

  function notificationTimestamp(item) {
    if (!item.createdAt) return 0;
    const value = new Date(item.createdAt).getTime();
    return Number.isFinite(value) ? value : 0;
  }

  function mergeInbox(items, { markRead = false } = {}) {
    const merged = new Map(inbox.map((item) => [item.id, item]));
    const newlyReadIds = [];
    for (const rawItem of Array.isArray(items) ? items : []) {
      const item = normalizeNotification(rawItem);
      if (!item || item.type === "SELF_TEST") continue;
      merged.set(item.id, { ...(merged.get(item.id) || {}), ...item });
      if (markRead) {
        panelReadIds.add(item.id);
        newlyReadIds.push(item.id);
      }
    }
    inbox = Array.from(merged.values())
      .sort((a, b) => notificationTimestamp(b) - notificationTimestamp(a))
      .slice(0, MAX_INBOX_ITEMS);
    saveInbox();
    if (newlyReadIds.length) saveReadIds(newlyReadIds);
    renderPanel();
  }

  function unreadCount() {
    return inbox.reduce(
      (count, item) => count + (panelReadIds.has(item.id) ? 0 : 1),
      0,
    );
  }

  function markNotificationRead(id) {
    const notificationId = String(id);
    panelReadIds.add(notificationId);
    saveReadIds([notificationId]);
    renderPanel();
  }

  function markAllNotificationsRead() {
    const notificationIds = inbox.map((item) => item.id);
    for (const id of notificationIds) panelReadIds.add(id);
    saveReadIds(notificationIds);
    renderPanel();
  }

  function validView(view) {
    return [
      "home",
      "updates",
      "jobs",
      "applications",
      "messages",
      "director",
      "talent",
      "settings",
    ].includes(view);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function notificationTone(item) {
    const type = String(item?.type || "").toUpperCase();
    if (type.includes("REJECT")) return "rejected";
    if (type.includes("MESSAGE")) return "message";
    if (type.includes("ACCEPT") || type.includes("PLACEMENT")) return "success";
    if (type.includes("WITHDRAW") || type.includes("EXPIR")) return "warning";
    if (type === "SELF_TEST") return "success";
    return "info";
  }

  function notificationCategory(item) {
    const type = String(item?.type || "").toUpperCase();
    if (type.includes("MESSAGE")) return "messages";
    if (type.includes("APPLICATION") || type.includes("PLACEMENT")) {
      return "applications";
    }
    if (type.includes("JOB") || type.includes("LISTING")) return "jobs";
    return "updates";
  }

  function formatRelativeTime(value) {
    if (!value) return "Recently";
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return "Recently";
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  function formatClock(value) {
    return value instanceof Date ? value.toLocaleTimeString() : "Never";
  }

  function connectionLabel() {
    if (pollState.loading && !pollState.lastSuccessAt) return "Connecting";
    if (pollState.lastSuccessAt && !pollState.lastError) return "Connected";
    if (notifierAuthenticationRequired()) return "Reconnect required";
    if (pollState.lastAttemptAt && pollState.lastError) return "Connection problem";
    return "Connecting";
  }

  function connectionTone() {
    if (pollState.loading && !pollState.lastSuccessAt) return "pending";
    if (pollState.lastSuccessAt && !pollState.lastError) return "online";
    if (pollState.lastAttemptAt && pollState.lastError) return "error";
    return "pending";
  }



  function mobilePanelMode() {
    if (mobileMediaQuery) return Boolean(mobileMediaQuery.matches);
    if (typeof window.matchMedia === "function") {
      return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
    }
    return Number(window.innerWidth) <= 760;
  }

  function syncViewportMetrics() {
    if (!panelHost) return;
    const viewport = window.visualViewport;
    const height = Math.max(
      320,
      Math.round(Number(viewport?.height) || Number(window.innerHeight) || 720),
    );
    const width = Math.max(280, Math.round(Number(viewport?.width) || Number(window.innerWidth) || 390));
    const top = Math.max(0, Math.round(Number(viewport?.offsetTop) || 0));
    const left = Math.max(0, Math.round(Number(viewport?.offsetLeft) || 0));
    panelHost.style.setProperty("--jc-visible-height", `${height}px`);
    panelHost.style.setProperty("--jc-visible-width", `${width}px`);
    panelHost.style.setProperty("--jc-visible-top", `${top}px`);
    panelHost.style.setProperty("--jc-visible-left", `${left}px`);
    panelHost.toggleAttribute("data-jc-mobile", mobilePanelMode());
    applyLauncherPosition();
  }

  function scheduleViewportSync() {
    if (viewportSyncHandle !== null) return;
    const callback = () => {
      viewportSyncHandle = null;
      syncViewportMetrics();
    };
    if (typeof window.requestAnimationFrame === "function") {
      viewportSyncHandle = window.requestAnimationFrame(callback);
    } else {
      viewportSyncHandle = window.setTimeout(callback, 16);
    }
  }

  function focusMobileControl(control) {
    if (!mobilePanelMode() || !control || typeof control.scrollIntoView !== "function") {
      return;
    }
    window.setTimeout(() => {
      control.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }, 180);
  }

  function saveLauncherPosition() {
    GM_setValue(
      LAUNCHER_POSITION_STORAGE_KEY,
      JSON.stringify(launcherPosition),
    );
  }

  function launcherViewport() {
    const visual = window.visualViewport;
    return {
      width: Math.max(280, Number(visual?.width) || Number(window.innerWidth) || 390),
      height: Math.max(320, Number(visual?.height) || Number(window.innerHeight) || 720),
    };
  }

  function launcherDimensions() {
    return mobilePanelMode()
      ? { width: 56, height: 56, edge: 10, bottom: 78 }
      : { width: 52, height: 92, edge: 0, bottom: 12 };
  }

  function resolvedLauncherPosition() {
    const viewport = launcherViewport();
    const dimensions = launcherDimensions();
    const maxY = Math.max(8, viewport.height - dimensions.height - 8);
    const defaultY = mobilePanelMode()
      ? Math.max(8, viewport.height - dimensions.height - dimensions.bottom)
      : Math.max(8, Math.round((viewport.height - dimensions.height) * 0.44));
    const y = launcherPosition.yRatio === null
      ? defaultY
      : Math.round(8 + launcherPosition.yRatio * Math.max(0, maxY - 8));
    const side = launcherPosition.side === "left" ? "left" : "right";
    const x = side === "left"
      ? dimensions.edge
      : Math.max(dimensions.edge, viewport.width - dimensions.width - dimensions.edge);
    return {
      x,
      y: Math.min(maxY, Math.max(8, y)),
      side,
      viewport,
      dimensions,
    };
  }

  function applyLauncherPosition(position = null) {
    const launcher = panelRoot?.getElementById?.("jc-launcher");
    if (!launcher) return;
    const resolved = position || resolvedLauncherPosition();
    launcher.style.left = `${Math.round(resolved.x)}px`;
    launcher.style.top = `${Math.round(resolved.y)}px`;
    launcher.style.right = "auto";
    launcher.style.bottom = "auto";
    launcher.dataset.side = resolved.side ||
      (resolved.x + resolved.dimensions.width / 2 < resolved.viewport.width / 2
        ? "left"
        : "right");
  }

  function clampLauncherDragPosition(x, y) {
    const viewport = launcherViewport();
    const dimensions = launcherDimensions();
    return {
      x: Math.min(
        Math.max(0, viewport.width - dimensions.width),
        Math.max(0, x),
      ),
      y: Math.min(
        Math.max(8, viewport.height - dimensions.height - 8),
        Math.max(8, y),
      ),
      viewport,
      dimensions,
    };
  }

  function finishLauncherDrag(event, cancelled = false) {
    const drag = launcherDrag;
    if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.pointerId)) {
      return;
    }
    launcherDrag = null;
    const launcher = panelRoot?.getElementById?.("jc-launcher");
    launcher?.classList.remove("dragging");
    try {
      launcher?.releasePointerCapture?.(drag.pointerId);
    } catch {
      // Pointer capture may already have ended when the gesture is cancelled.
    }

    if (!drag.moved || cancelled) {
      applyLauncherPosition();
      return;
    }

    const current = clampLauncherDragPosition(drag.lastX, drag.lastY);
    const side = current.x + current.dimensions.width / 2 < current.viewport.width / 2
      ? "left"
      : "right";
    const maxY = Math.max(8, current.viewport.height - current.dimensions.height - 8);
    launcherPosition = {
      side,
      yRatio: maxY <= 8 ? 0 : (current.y - 8) / (maxY - 8),
    };
    saveLauncherPosition();
    applyLauncherPosition();
    launcherSuppressClickUntil = Date.now() + 450;
  }

  function registerOptionalMenuCommand(label, handler) {
    try {
      if (typeof GM_registerMenuCommand === "function") {
        GM_registerMenuCommand(label, handler);
        return true;
      }
      if (
        typeof GM !== "undefined" &&
        GM &&
        typeof GM.registerMenuCommand === "function"
      ) {
        Promise.resolve(GM.registerMenuCommand(label, handler)).catch((error) => {
          console.warn(`[JC+] Could not register menu command "${label}":`, error);
        });
        return true;
      }
    } catch (error) {
      console.warn(`[JC+] Could not register menu command "${label}":`, error);
    }
    return false;
  }

  function setPanelOpen(open) {
    const nextOpen = Boolean(open);
    panelState.open = nextOpen;
    savePanelState();
    scheduleViewportSync();

    const panel = panelRoot?.getElementById?.("jc-panel");
    const launcher = panelRoot?.getElementById?.("jc-launcher");
    const backdrop = panelRoot?.querySelector?.("[data-panel-backdrop]");
    if (panel && launcher && backdrop) {
      panel.classList.toggle("open", nextOpen);
      launcher.classList.toggle("panel-open", nextOpen);
      backdrop.classList.toggle("open", nextOpen);
      panel.setAttribute("aria-hidden", nextOpen ? "false" : "true");
      launcher.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      backdrop.setAttribute("aria-hidden", nextOpen ? "false" : "true");
    } else {
      renderPanel();
    }

    if (nextOpen) maybeAutoRefreshStats();
  }

  function setActiveView(view) {
    if (!validView(view)) return;
    panelState.activeView = view;
    panelState.open = true;
    savePanelState();
    if (view === "jobs") {
      fetchJobs();
      fetchPanelData();
    }
    if (["applications", "messages", "director"].includes(view)) {
      fetchPanelData();
    }
    if (view === "talent") fetchTalent();
    if (view === "messages" && messageState.selectedConversationId) {
      fetchConversation(
        messageState.selectedConversationType,
        messageState.selectedConversationId,
      );
    }
    renderPanel();
  }

  function openJobCentre(path = "/jobcentreplus/") {
    const safePath =
      typeof path === "string" && path.startsWith("/jobcentreplus/")
        ? path
        : "/jobcentreplus/";
    const destination = new URL(safePath, JOBCENTRE_ORIGIN).href;
    const opened = window.open(destination, "jobcentreplus");
    if (opened) opened.focus?.();
    else window.location.assign(destination);
  }

  function reconnectNotifier() {
    if (typeof window.prompt !== "function") {
      openJobCentre("/jobcentreplus/");
      showPageFeedback({
        title: "JC+: Reconnect unavailable",
        text: "Open JobCentre+ and sign in again, then return to Torn.",
        tone: "error",
      });
      return;
    }

    const apiKey = String(
      window.prompt(
        "Reconnect JobCentre+\n\nPaste your Torn API key. It is sent securely to JobCentre+ and stored encrypted, just like website sign-in.",
        "",
      ) || "",
    ).trim();
    if (!apiKey) return;

    clearNotifierToken();
    pollState.loading = true;
    pollState.lastAttemptAt = new Date();
    pollState.lastError = "";
    renderPanel();

    jobCentreRequest({
      method: "POST",
      url: CONNECT_URL,
      timeout: 20000,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-JobCentre-Panel": "userscript-v1",
      },
      data: JSON.stringify({ apiKey }),
      onload(response) {
        pollState.loading = false;
        pollState.lastStatus = response.status;
        if (response.status !== 200) {
          pollState.lastError = errorMessage(response);
          renderPanel();
          showPageFeedback({
            title: "JC+: Reconnect failed",
            text: pollState.lastError,
            tone: "error",
          });
          return;
        }

        try {
          const data = JSON.parse(response.responseText);
          const token = usableNotifierToken(data.token);
          if (!token) throw new Error("The server did not return a notifier credential.");
          notifierToken = token;
          GM_setValue(NOTIFIER_TOKEN_STORAGE_KEY, token);
          pollState.playerName = data.user?.name || pollState.playerName;
          pollState.lastError = "";
          pollState.consecutiveFailures = 0;
          showPageFeedback({
            title: "JC+: Reconnected",
            text: `Secure notifier access was renewed${pollState.playerName ? ` for ${pollState.playerName}` : ""}.`,
            tone: "success",
            compact: true,
          });
          renderPanel();
          fetchNotifications({ selfTest: true });
        } catch (error) {
          pollState.lastError =
            error instanceof Error ? error.message : "The reconnect response was invalid.";
          renderPanel();
          showPageFeedback({
            title: "JC+: Reconnect failed",
            text: pollState.lastError,
            tone: "error",
          });
        }
      },
      onerror(error) {
        pollState.loading = false;
        pollState.lastStatus = null;
        pollState.lastError = "Could not reach JobCentre+ to reconnect.";
        renderPanel();
        console.warn("[JobCentre+] Reconnect request failed:", error);
        showPageFeedback({
          title: "JC+: Reconnect failed",
          text: pollState.lastError,
          tone: "error",
        });
      },
      ontimeout() {
        pollState.loading = false;
        pollState.lastStatus = null;
        pollState.lastError = "The JobCentre+ reconnect request timed out.";
        renderPanel();
        showPageFeedback({
          title: "JC+: Reconnect timed out",
          text: "Please try again.",
          tone: "error",
        });
      },
    });
  }

  function openNotification(item) {
    if (!item) return;
    markNotificationRead(item.id);

    if ((item.type === "NEW_JOB" || item.type === "NEW_AD") && item.jobId) {
      focusJobInPanel(item.jobId);
      return;
    }

    if (item.type === "NEW_APPLICATION" && item.applicationId) {
      focusApplicationInPanel(item.applicationId);
      return;
    }

    if (
      item.type === "NEW_MESSAGE" &&
      (item.talentConversationId || item.applicationId)
    ) {
      const conversationType = item.talentConversationId
        ? "talent"
        : "application";
      const conversationId = Number(
        item.talentConversationId || item.applicationId,
      );
      fetchPanelData({ force: true });
      openConversation(conversationType, conversationId);
      return;
    }

    if (item.type === "APPLICATION_ACCEPTED" && item.companyTornId) {
      window.location.href =
        `https://www.torn.com/joblist.php#/p=corpinfo&ID=${encodeURIComponent(
          String(item.companyTornId),
        )}`;
      return;
    }

    if (
      typeof item.targetPath === "string" &&
      item.targetPath.startsWith("/jobcentreplus/")
    ) {
      openJobCentre(item.targetPath);
      return;
    }

    openJobCentre("/jobcentreplus/dashboard/");
  }

  function showPageFeedback({
    title,
    text,
    onclick,
    tone = "info",
    compact = false,
    duration = 12000,
  }) {
    try {
      const root = document.body || document.documentElement;
      if (!root) return false;

      let notice = document.getElementById(PAGE_FEEDBACK_ID);
      if (!notice) {
        notice = document.createElement("div");
        notice.id = PAGE_FEEDBACK_ID;
        notice.setAttribute("role", "status");
        notice.setAttribute("aria-live", "polite");
        root.appendChild(notice);
      }

      const themes = {
        error: {
          background: "#2a1513",
          border: "#ff7a4f",
          color: "#f3f5ec",
        },
        info: {
          background: "#101710",
          border: "#d8ff51",
          color: "#f3f5ec",
        },
        message: {
          background: "#172019",
          border: "#87efb1",
          color: "#f3f5ec",
        },
        rejected: {
          background: "#2a1513",
          border: "#ff7a4f",
          color: "#f3f5ec",
        },
        success: {
          background: "#101710",
          border: "#87efb1",
          color: "#f3f5ec",
        },
        warning: {
          background: "#292311",
          border: "#e3bd57",
          color: "#f3f5ec",
        },
      };
      const theme = themes[tone] || themes.info;
      Object.assign(notice.style, {
        background: theme.background,
        border: `1px solid ${theme.border}`,
        borderRadius: "10px",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
        color: theme.color,
        cursor: "pointer",
        display: "block",
        fontFamily: "Manrope, Arial, sans-serif",
        fontSize: compact ? "12px" : "14px",
        fontWeight: "600",
        lineHeight: "1.45",
        maxWidth: compact ? "300px" : "380px",
        padding: compact ? "9px 12px" : "14px 16px",
        position: "fixed",
        right: "18px",
        top: "18px",
        whiteSpace: "pre-line",
        zIndex: "2147483647",
      });
      notice.textContent = `${title}\n${text}\n\nClick to ${
        typeof onclick === "function" ? "open" : "dismiss"
      }.`;
      notice.onclick = function () {
        notice.style.display = "none";
        if (typeof onclick === "function") onclick();
      };

      if (pageFeedbackTimer !== null) {
        window.clearTimeout(pageFeedbackTimer);
      }
      pageFeedbackTimer = window.setTimeout(() => {
        notice.style.display = "none";
        pageFeedbackTimer = null;
      }, duration);
      return true;
    } catch (error) {
      console.warn("[JobCentre+] Torn page feedback failed:", error);
      return false;
    }
  }

  function displayNotification({ title, text, onclick, tone = "info" }) {
    const pageDisplayed = panelSettings.pageBanners
      ? showPageFeedback({ title, text, onclick, tone })
      : false;

    if (!panelSettings.desktopNotifications || (mobilePanelMode() && pageDisplayed)) {
      return pageDisplayed || true;
    }

    let notificationApi = null;
    if (typeof GM_notification === "function") {
      notificationApi = GM_notification;
    } else if (
      typeof GM !== "undefined" &&
      typeof GM.notification === "function"
    ) {
      notificationApi = GM.notification.bind(GM);
    }

    if (!notificationApi) {
      console.warn("[JobCentre+] Browser notification API is unavailable.");
      return pageDisplayed;
    }

    try {
      const request = notificationApi({
        title,
        text,
        image: ICON_DATA_URL,
        timeout: 12000,
        onclick,
      });
      if (request && typeof request.catch === "function") {
        void request.catch((error) => {
          console.warn("[JobCentre+] Browser notification was rejected:", error);
        });
      }
      return true;
    } catch (error) {
      console.error("[JobCentre+] Browser notification failed:", error);
      return pageDisplayed;
    }
  }

  function processNotification(rawItem, force = false) {
    const item = normalizeNotification(rawItem);
    if (!item) return false;
    mergeInbox([item]);

    if (!force && lastProcessedIds.has(item.id)) return false;

    lastProcessedIds.add(item.id);
    saveSeenIds();

    const displayed = displayNotification({
      title: `JobCentre+: ${item.title}`,
      text: item.message,
      onclick: function () {
        openNotification(item);
      },
      tone: notificationTone(item),
    });

    if (!displayed) {
      lastProcessedIds.delete(item.id);
      saveSeenIds();
    }
    if (
      item.type === "NEW_MESSAGE" &&
      (item.talentConversationId || item.applicationId) &&
      normalizedConversationType(messageState.selectedConversationType) ===
        (item.talentConversationId ? "talent" : "application") &&
      Number(messageState.selectedConversationId) ===
        Number(item.talentConversationId || item.applicationId)
    ) {
      fetchConversation(
        item.talentConversationId ? "talent" : "application",
        item.talentConversationId || item.applicationId,
        { force: true },
      );
    }
    renderPanel();
    return displayed;
  }

  function errorMessage(response) {
    try {
      const payload = JSON.parse(response.responseText);
      return typeof payload.error === "string"
        ? payload.error
        : `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }

  function notificationPollUrl(selfTest = false) {
    return `${BASE_URL}?client=userscript&${selfTest ? "test=1&" : ""}_=${Date.now()}`;
  }

  function primeNewNotificationTypes(items) {
    if (notificationFeedVersion === NOTIFICATION_FEED_VERSION) return;

    const baseline = (Array.isArray(items) ? items : []).filter((item) => {
      const type = String(item?.type || "").toUpperCase();
      return type === "NEW_JOB" || type === "NEW_CANDIDATE";
    });
    mergeInbox(baseline, { markRead: true });
    for (const item of baseline) {
      if (item?.id !== undefined && item?.id !== null) {
        lastProcessedIds.add(String(item.id));
      }
    }
    saveSeenIds();
    notificationFeedVersion = NOTIFICATION_FEED_VERSION;
    GM_setValue(
      NOTIFICATION_FEED_VERSION_STORAGE_KEY,
      NOTIFICATION_FEED_VERSION,
    );
  }

  function recordPollSuccess() {
    pollState.lastSuccessAt = new Date();
    pollState.lastError = "";
    pollState.consecutiveFailures = 0;
  }

  function recordPollFailure(
    message,
    status,
    { selfTest = false, manual = false } = {},
  ) {
    const now = new Date();
    pollState.loading = false;
    pollState.lastStatus = status;
    pollState.lastFailureAt = now;
    pollState.lastFailureMessage = message;
    pollState.consecutiveFailures += 1;

    const successAge = pollState.lastSuccessAt
      ? now.getTime() - pollState.lastSuccessAt.getTime()
      : Number.POSITIVE_INFINITY;
    const transientBackgroundFailure =
      !selfTest &&
      !manual &&
      status !== 401 &&
      successAge < CONNECTION_STALE_MS &&
      pollState.consecutiveFailures < CONNECTION_FAILURE_THRESHOLD;
    pollState.lastError = transientBackgroundFailure ? "" : message;
    return transientBackgroundFailure;
  }

  function fetchNotifications({ selfTest = false, manual = false } = {}) {
    if (pollState.loading) return;
    pollState.loading = true;
    pollState.lastAttemptAt = new Date();
    if (!pollState.lastSuccessAt || selfTest || manual) renderPanel();

    jobCentreRequest({
      method: "GET",
      url: notificationPollUrl(selfTest),
      withCredentials: true,
      timeout: 15000,
      headers: notifierHeaders({
        Accept: "application/json",
      }),
      onload: function (response) {
        pollState.loading = false;
        pollState.lastStatus = response.status;
        if (response.status !== 200) {
          const message = errorMessage(response);
          const transient = recordPollFailure(message, response.status, {
            selfTest,
            manual,
          });
          renderPanel();
          console.warn(
            `[JobCentre+] Notification check failed (${response.status})${transient ? "; keeping the recent successful connection active" : ""}:`,
            message,
          );
          if (selfTest || manual) {
            displayNotification({
              title: selfTest
                ? "JobCentre+: Server test failed"
                : "JobCentre+: Poll failed",
              text:
                response.status === 401
                  ? "Secure notifier access has expired. Open Settings and choose Reconnect JobCentre+."
                  : message,
              onclick: function () {
                openJobCentre();
              },
              tone: "error",
            });
          }
          return;
        }

        try {
          const data = JSON.parse(response.responseText);
          if (!Array.isArray(data.notifications)) {
            throw new Error("The server returned an invalid notification list.");
          }

          recordPollSuccess();
          pollState.playerName = data.user?.name || pollState.playerName || null;
          const normalizedPlayer = normalizePlayer(data.user);
          if (normalizedPlayer) pollState.player = normalizedPlayer;
          window.setTimeout(maybeAutoRefreshStats, 0);

          if (selfTest) {
            const testNotification = data.notifications.find(
              (item) => item.type === "SELF_TEST",
            );
            if (!testNotification) {
              throw new Error("The server did not return a test notification.");
            }
            if (panelSettings.pageBanners) {
              showPageFeedback({
                title: "JC+: Connected",
                text: testNotification.message,
                tone: "success",
                compact: true,
                duration: 4500,
              });
            }
            console.info("[JobCentre+] Server connection test passed.");
            renderPanel();
            return;
          }

          primeNewNotificationTypes(data.notifications);

          if (!initialized) {
            mergeInbox(data.notifications, { markRead: true });
            data.notifications.forEach((item) => {
              if (item?.id !== undefined && item?.id !== null) {
                lastProcessedIds.add(String(item.id));
              }
            });
            saveSeenIds();
            initialized = true;
            GM_setValue(INITIALIZED_STORAGE_KEY, true);
            console.info(
              `[JobCentre+] Notifier armed; remembered ${data.notifications.length} existing update(s).`,
            );
            if (manual) {
              displayNotification({
                title: "JobCentre+: Poll successful",
                text: `Connected${
                  pollState.playerName ? ` for ${pollState.playerName}` : ""
                }. Existing updates were recorded; future changes will notify you.`,
                tone: "success",
              });
            }
            renderPanel();
            return;
          }

          mergeInbox(data.notifications);
          const delivered = data.notifications.reduce(
            (count, item) => count + (processNotification(item) ? 1 : 0),
            0,
          );
          if (manual && delivered === 0) {
            displayNotification({
              title: "JobCentre+: Poll successful",
              text: `Connected${
                pollState.playerName ? ` for ${pollState.playerName}` : ""
              }. No new updates were waiting.`,
              tone: "success",
            });
          }
          renderPanel();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Invalid server response.";
          recordPollFailure(message, response.status, { selfTest, manual });
          renderPanel();
          console.error("[JobCentre+] Failed to parse notification response:", error);
          if (selfTest || manual) {
            displayNotification({
              title: selfTest
                ? "JobCentre+: Server test failed"
                : "JobCentre+: Poll failed",
              text: message,
              tone: "error",
            });
          }
        }
      },
      onerror: function (error) {
        const message = "Could not reach the JobCentre+ server.";
        const transient = recordPollFailure(message, null, { selfTest, manual });
        renderPanel();
        console.warn(
          `[JobCentre+] Error reaching JobCentre+ server${transient ? "; keeping the recent successful connection active" : ""}:`,
          error,
        );
        if (selfTest || manual) {
          displayNotification({
            title: selfTest
              ? "JobCentre+: Server test failed"
              : "JobCentre+: Poll failed",
            text: message,
            tone: "error",
          });
        }
      },
      ontimeout: function () {
        const message = "The JobCentre+ server timed out.";
        const transient = recordPollFailure(message, null, { selfTest, manual });
        renderPanel();
        console.warn(
          `[JobCentre+] Notification check timed out${transient ? "; keeping the recent successful connection active" : ""}.`,
        );
        if (selfTest || manual) {
          displayNotification({
            title: selfTest
              ? "JobCentre+: Server test failed"
              : "JobCentre+: Poll failed",
            text: message,
            tone: "error",
          });
        }
      },
    });
  }

  function navButton(view, icon, label, badge = 0) {
    const active = panelState.activeView === view ? " active" : "";
    const badgeHtml = badge
      ? `<span class="nav-badge">${badge > 99 ? "99+" : badge}</span>`
      : "";
    return `<button class="nav-button${active}" type="button" data-view="${view}" aria-label="${escapeHtml(
      label,
    )}"><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-label">${escapeHtml(
      label,
    )}</span>${badgeHtml}</button>`;
  }

  function notificationCard(item, compact = false) {
    const tone = notificationTone(item);
    const unread = panelReadIds.has(item.id) ? "" : " unread";
    return `<button class="notification-card ${tone}${unread}${
      compact ? " compact" : ""
    }" type="button" data-notification-id="${escapeHtml(item.id)}">
      <span class="notification-accent" aria-hidden="true"></span>
      <span class="notification-copy">
        <span class="notification-heading">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(formatRelativeTime(item.createdAt))}</span>
        </span>
        <span class="notification-message">${escapeHtml(item.message)}</span>
      </span>
      <span class="notification-arrow" aria-hidden="true">›</span>
    </button>`;
  }

  function emptyState(title, text) {
    return `<div class="empty-state"><span class="empty-icon">JC+</span><strong>${escapeHtml(
      title,
    )}</strong><p>${escapeHtml(text)}</p></div>`;
  }

  function renderHomeView() {
    const authRequired = notifierAuthenticationRequired();
    const unread = unreadCount();
    const applicationUpdates = inbox.filter(
      (item) => notificationCategory(item) === "applications",
    ).length;
    const messageUpdates = messageUnreadCount();
    const jobUpdates = jobsState.jobs.length;
    const matchingJobs = pollState.player
      ? jobsState.jobs.filter((job) => jobMatch(job).qualified).length
      : jobUpdates;
    const recent = inbox.slice(0, 4);

    return `<section class="view-section">
      <div class="view-heading">
        <div><span class="eyebrow">OVERVIEW</span><h2>Welcome${
          pollState.playerName ? `, ${escapeHtml(pollState.playerName)}` : ""
        }</h2></div>
        <button class="icon-action" type="button" data-action="poll" aria-label="Refresh notifications">↻</button>
      </div>
      <div class="connection-banner ${connectionTone()}">
        <span class="status-dot"></span>
        <div><strong>${connectionLabel()}</strong><span>${
          pollState.lastError
            ? escapeHtml(pollState.lastError)
            : pollState.loading && !pollState.lastSuccessAt
              ? "Automatic sync in progress…"
            : `Last synced ${escapeHtml(formatClock(pollState.lastSuccessAt))}`
        }</span></div>
      </div>
      <div class="stat-grid">
        <button class="stat-card acid" type="button" data-view="updates"><span>Unread</span><strong>${authAwareMetric(unread)}</strong><small>${authRequired ? "Unavailable" : "Updates waiting"}</small></button>
        <button class="stat-card" type="button" data-view="applications"><span>Applications</span><strong>${authAwareMetric(applicationUpdates)}</strong><small>${authRequired ? "Unavailable" : "Recent activity"}</small></button>
        <button class="stat-card" type="button" data-view="messages"><span>Messages</span><strong>${authAwareMetric(messageUpdates)}</strong><small>${authRequired ? "Unavailable" : messageUpdates ? "Unread replies" : "All caught up"}</small></button>
        <button class="stat-card" type="button" data-view="jobs"><span>Jobs</span><strong>${authAwareMetric(matchingJobs)}</strong><small>${authRequired ? "Unavailable" : pollState.player ? "Matching live listings" : "Live listings"}</small></button>
      </div>
      ${directorToolsVisible() ? `<button class="director-home-card" type="button" data-view="director"><span><small>DIRECTOR CENTRE</small><strong>${formatNumber(panelDataState.directorSummary.newApplicants)} awaiting review</strong><em>${formatNumber(panelDataState.directorSummary.activeCampaigns)} active campaign${Number(panelDataState.directorSummary.activeCampaigns) === 1 ? "" : "s"}</em></span><b>Open dashboard ›</b></button>` : ""}
      <div class="section-heading"><div><span class="eyebrow">ACTIVITY</span><h3>Recent updates</h3></div><button class="text-action" type="button" data-view="updates">View all</button></div>
      <div class="notification-list compact-list">${
        recent.length
          ? recent.map((item) => notificationCard(item, true)).join("")
          : authRequired
            ? emptyState(
                "Updates unavailable",
                "Reconnect JobCentre+ to restore notifier data.",
              )
          : emptyState(
              "Nothing new yet",
              "JobCentre+ updates will appear here while you play Torn.",
            )
      }</div>
      <button class="primary-button" type="button" data-action="open-main">Open JobCentre+</button>
    </section>`;
  }

  function renderUpdatesView() {
    return `<section class="view-section">
      <div class="view-heading">
        <div><span class="eyebrow">INBOX</span><h2>Notifications</h2></div>
        <button class="text-action" type="button" data-action="mark-all">Mark all read</button>
      </div>
      <p class="view-description">Application changes, director messages and listing updates are kept here on this device.</p>
      <div class="notification-list">${
        inbox.length
          ? inbox.map((item) => notificationCard(item)).join("")
          : emptyState(
              "Your inbox is clear",
              "New JobCentre+ activity will appear here automatically.",
            )
      }</div>
    </section>`;
  }

  function requirementChip(requirement, state) {
    const tone = state === "unknown" ? "unknown" : state ? "met" : "missing";
    return `<span class="requirement-chip ${tone}">${escapeHtml(
      requirement.label,
    )} ${formatNumber(requirement.required)}</span>`;
  }

  function renderJobCard(job) {
    const match = jobMatch(job);
    const application = outgoingApplicationForJob(job.id);
    const requirements = jobRequirements(job);
    const matchClass = match.known
      ? match.qualified
        ? "qualified"
        : "short"
      : "unknown";
    const matchLabel = match.known
      ? match.qualified
        ? "You qualify"
        : `${match.missing.length} requirement${match.missing.length === 1 ? "" : "s"} short`
      : pollState.playerName
        ? "Work stats unavailable"
        : "Connect to compare";
    const requirementHtml = requirements.length
      ? requirements
          .map((requirement) =>
            requirementChip(
              requirement,
              !match.known
                ? "unknown"
                : (Number(pollState.player?.[requirement.key]) || 0) >= requirement.required,
            ),
          )
          .join("")
      : '<span class="requirement-chip met">No minimum stats</span>';
    const description = String(job.description || "").trim();
    const pay = Number(job.payAmount) > 0
      ? formatMoney(job.payAmount)
      : String(job.pay || "Pay not stated");
    const applyBusy = actionIsBusy(`apply:${job.id}`);
    const primaryButton = application
      ? `<button class="job-primary applied-button" type="button" data-action="show-my-application">${escapeHtml(statusLabel(application.status))} ✓</button>`
      : `<button class="job-primary" type="button" data-action="open-apply" data-job-id="${escapeHtml(job.id)}" ${applyBusy ? "disabled" : ""}>${applyBusy ? "Sending…" : "Apply now"}</button>`;
    return `<article class="job-card ${job.sponsored ? "sponsored" : ""}" data-job-card-id="${escapeHtml(job.id)}">
      <div class="job-card-top">
        <div class="company-badge">${escapeHtml(String(job.companyName || "JC+").slice(0, 2).toUpperCase())}</div>
        <div class="job-title-wrap">
          <div class="job-company-line"><span>${escapeHtml(job.companyName || "Unknown company")}</span><span>${formatNumber(job.stars)}★</span></div>
          <h3>${escapeHtml(job.title || "Open position")}</h3>
          <p>${escapeHtml(job.companyType || "Company")}</p>
        </div>
        ${job.sponsored ? '<span class="sponsored-tag">FEATURED</span>' : ""}
      </div>
      <div class="job-match ${matchClass}"><span class="match-dot"></span><strong>${escapeHtml(matchLabel)}</strong><span>${escapeHtml(expiresLabel(job.expiresAt))}</span></div>
      <div class="job-facts">
        <div><span>Pay</span><strong>${escapeHtml(pay)}</strong></div>
        <div><span>Schedule</span><strong>${escapeHtml(job.schedule || job.activityLevel || "Not stated")}</strong></div>
        <div><span>Training</span><strong>${escapeHtml(trainingSummary(job))}</strong></div>
      </div>
      <div class="requirements-row">${requirementHtml}</div>
      ${description ? `<p class="job-description">${escapeHtml(description)}</p>` : ""}
      <div class="job-actions">
        <button class="ghost-button" type="button" data-open-path="/jobcentreplus/#job=${encodeURIComponent(String(job.id))}">View details</button>
        ${primaryButton}
      </div>
    </article>`;
  }

  function filteredJobs() {
    const query = jobsState.query.trim().toLowerCase();
    return jobsState.jobs.filter((job) => {
      if (jobsState.filter === "matches" && !jobMatch(job).qualified) return false;
      if (jobsState.filter === "sponsored" && !job.sponsored) return false;
      if (!query) return true;
      return [job.companyName, job.companyType, job.title, job.description]
        .some((value) => String(value || "").toLowerCase().includes(query));
    });
  }

  function renderJobsView() {
    const jobs = filteredJobs();
    const unavailable = Boolean(jobsState.error && !jobsState.jobs.length);
    const qualified = pollState.player
      ? jobsState.jobs.filter((job) => jobMatch(job).qualified).length
      : null;
    return `<section class="view-section jobs-view">
      <div class="view-heading">
        <div><span class="eyebrow">DISCOVER</span><h2>Live jobs</h2></div>
        <button class="icon-action ${jobsState.loading ? "spinning" : ""}" type="button" data-action="refresh-jobs" aria-label="Refresh jobs">↻</button>
      </div>
      <p class="view-description">Browse current JobCentre+ vacancies without leaving Torn.</p>
      <div class="jobs-summary">
        <div><strong>${unavailable ? "—" : jobsState.jobs.length}</strong><span>Live listings</span></div>
        <div><strong>${unavailable || qualified === null ? "—" : qualified}</strong><span>Matching your stats</span></div>
        <div><strong>${unavailable ? "—" : jobsState.candidateCount}</strong><span>Open candidates</span></div>
      </div>
      <div class="jobs-tools">
        <label class="job-search"><span>⌕</span><input type="search" data-job-search placeholder="Search role or company" value="${escapeHtml(jobsState.query)}"></label>
        <select data-job-filter aria-label="Filter jobs">
          <option value="all" ${jobsState.filter === "all" ? "selected" : ""}>All jobs</option>
          <option value="matches" ${jobsState.filter === "matches" ? "selected" : ""}>My matches</option>
          <option value="sponsored" ${jobsState.filter === "sponsored" ? "selected" : ""}>Featured</option>
        </select>
      </div>
      ${jobsState.error ? `<div class="jobs-error"><strong>Jobs could not refresh</strong><span>${escapeHtml(jobsState.error)}</span></div>` : ""}
      <div class="job-list">${
        jobsState.loading && !jobsState.jobs.length
          ? '<div class="job-loading"><span></span><span></span><span></span></div>'
          : jobs.length
            ? jobs.map(renderJobCard).join("")
            : unavailable
              ? ""
            : emptyState(
                jobsState.jobs.length ? "No jobs match this filter" : "No live jobs found",
                jobsState.jobs.length
                  ? "Try a different search or switch back to all jobs."
                  : "New vacancies will appear here when directors publish them.",
              )
      }</div>
      <button class="secondary-button" type="button" data-open-path="/jobcentreplus/#jobs">Open full marketplace</button>
    </section>`;
  }

  function statusLabel(status) {
    const value = String(status || "applied").toLowerCase();
    return {
      applied: "Applied",
      viewed: "Viewed",
      accepted: "Accepted",
      rejected: "Rejected",
      withdrawn: "Withdrawn",
      expired: "Expired",
      active: "Active",
      pending: "Pending payment",
      closed: "Closed",
    }[value] || value.replace(/_/g, " ");
  }

  function statusClass(status) {
    const value = String(status || "").toLowerCase();
    if (value === "accepted" || value === "active") return "positive";
    if (value === "rejected" || value === "expired") return "negative";
    if (value === "viewed") return "viewed";
    if (value === "pending") return "warning";
    return "neutral";
  }

  function applicationDate(value) {
    if (!value) return "Date unavailable";
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp)
      ? new Date(timestamp).toLocaleDateString()
      : "Date unavailable";
  }

  function applicationMatchesQuery(item) {
    const query = panelDataState.query.trim().toLowerCase();
    if (!query) return true;
    return [
      item?.job?.title,
      item?.job?.companyName,
      item?.job?.companyType,
      item?.applicant?.name,
      item?.note,
      item?.participantName,
      item?.latestMessage,
      item?.job?.id,
    ].some((value) => String(value || "").toLowerCase().includes(query));
  }

  function applicationIsArchived(item) {
    return new Set(["accepted", "rejected", "withdrawn", "expired"]).has(
      String(item?.status || "").toLowerCase(),
    );
  }

  function scrollPanelRecord(selector) {
    window.setTimeout(() => {
      const record = panelRoot?.querySelector?.(selector);
      record?.scrollIntoView?.({
        block: "center",
        inline: "nearest",
        behavior: "smooth",
      });
      record?.classList?.add("notification-focus");
    }, 120);
  }

  function focusJobInPanel(jobId) {
    const id = Number(jobId);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    jobsState.query = "";
    jobsState.filter = "all";
    setActiveView("jobs");
    fetchJobs({ force: true });
    renderPanel();
    scrollPanelRecord(`[data-job-card-id="${id}"]`);
    window.setTimeout(
      () => scrollPanelRecord(`[data-job-card-id="${id}"]`),
      750,
    );
  }

  function focusApplicationInPanel(applicationId) {
    const id = Number(applicationId);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    panelDataState.query = "";
    panelDataState.applicationTab = "incoming";
    setActiveView("applications");
    fetchPanelData({ force: true });
    renderPanel();
    scrollPanelRecord(`[data-application-card-id="${id}"]`);
    window.setTimeout(
      () => scrollPanelRecord(`[data-application-card-id="${id}"]`),
      750,
    );
  }

  function renderOutgoingApplication(item) {
    const canWithdraw = new Set(["applied", "viewed"]).has(String(item.status));
    const busyKey = `withdraw:${item.id}`;
    return `<article class="application-card" data-application-card-id="${escapeHtml(item.id)}">
      <div class="application-card-head">
        <div><span class="application-company">Advert #${escapeHtml(item.job?.id || "—")} · ${escapeHtml(item.job?.companyName || "Company")}</span><h3>${escapeHtml(item.job?.title || "Application")}</h3><p>${escapeHtml(item.job?.companyType || "")}</p></div>
        <span class="status-pill ${statusClass(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
      </div>
      <div class="application-meta"><span>Applied ${escapeHtml(applicationDate(item.createdAt))}</span><span>${escapeHtml(expiresLabel(item.job?.expiresAt))}</span></div>
      ${item.note ? `<div class="application-note"><span>Your note</span><p>${escapeHtml(item.note)}</p></div>` : ""}
      <div class="application-actions application-actions-three">
        <button class="ghost-button" type="button" data-open-path="/jobcentreplus/#job=${encodeURIComponent(String(item.job?.id || ""))}">View listing</button>
        <button class="ghost-button" type="button" data-action="open-conversation" data-conversation-type="application" data-conversation-id="${escapeHtml(item.id)}">Message director</button>
        ${canWithdraw
          ? `<button class="danger-button" type="button" data-action="withdraw-application" data-application-id="${escapeHtml(item.id)}" ${actionIsBusy(busyKey) ? "disabled" : ""}>${actionIsBusy(busyKey) ? "Withdrawing…" : "Withdraw"}</button>`
          : '<button class="job-primary" type="button" data-open-path="/jobcentreplus/dashboard/">Manage</button>'}
      </div>
    </article>`;
  }

  function renderIncomingApplication(item) {
    const applicant = item.applicant || {};
    const status = String(item.status || "applied");
    const decisionDisabled = new Set(["accepted", "rejected", "withdrawn", "expired"]).has(status);
    const viewedButton = status === "applied"
      ? `<button class="ghost-button" type="button" data-action="set-application-status" data-application-id="${escapeHtml(item.id)}" data-status="viewed" ${actionIsBusy(`status:${item.id}`) ? "disabled" : ""}>Mark viewed</button>`
      : `<button class="ghost-button" type="button" data-profile-id="${escapeHtml(applicant.tornId || "")}">View player</button>`;
    return `<article class="application-card applicant-card" data-application-card-id="${escapeHtml(item.id)}">
      <div class="application-card-head">
        <div><span class="application-company">Advert #${escapeHtml(item.job?.id || "—")} · ${escapeHtml(item.job?.title || "Applicant")}</span><h3>${escapeHtml(applicant.name || "Applicant")}</h3><p>${escapeHtml(item.job?.companyName || "")}</p></div>
        <span class="status-pill ${statusClass(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
      </div>
      <div class="applicant-stats">
        <span><small>MAN</small><strong>${formatNumber(applicant.manualLabor)}</strong></span>
        <span><small>INT</small><strong>${formatNumber(applicant.intelligence)}</strong></span>
        <span><small>END</small><strong>${formatNumber(applicant.endurance)}</strong></span>
        <span><small>TOTAL</small><strong>${formatNumber(applicant.totalWorkstats)}</strong></span>
      </div>
      ${item.note ? `<div class="application-note"><span>Application note</span><p>${escapeHtml(item.note)}</p></div>` : ""}
      <div class="application-actions application-actions-four">
        ${viewedButton}
        <button class="ghost-button" type="button" data-action="open-conversation" data-conversation-type="application" data-conversation-id="${escapeHtml(item.id)}">Message</button>
        <button class="accept-button" type="button" data-action="set-application-status" data-application-id="${escapeHtml(item.id)}" data-status="accepted" ${decisionDisabled || actionIsBusy(`status:${item.id}`) ? "disabled" : ""}>Accept</button>
        <button class="danger-button" type="button" data-action="set-application-status" data-application-id="${escapeHtml(item.id)}" data-status="rejected" ${decisionDisabled || actionIsBusy(`status:${item.id}`) ? "disabled" : ""}>Reject</button>
      </div>
    </article>`;
  }

  function directorToolsVisible() {
    return (
      panelDataState.campaigns.length > 0 ||
      panelDataState.incoming.length > 0 ||
      canBrowseTalent()
    );
  }

  function canBrowseTalent() {
    const player = pollState.player || {};
    return (
      String(player.currentPosition || "").toLowerCase() === "director" ||
      Boolean(player.isOwner || player.isAdmin || player.isModerator) ||
      new Set(["owner", "administrator", "moderator"]).has(
        String(player.accessLevel || "").toLowerCase(),
      )
    );
  }

  function campaignPipeline(item) {
    const raw = item?.applicationStatusCounts || {};
    return {
      applied: Number(raw.applied) || 0,
      viewed: Number(raw.viewed) || 0,
      accepted: Number(raw.accepted) || 0,
      rejected: Number(raw.rejected) || 0,
      expired: Number(raw.expired) || 0,
    };
  }

  function campaignNeedsAttention(item) {
    const pipeline = campaignPipeline(item);
    return Boolean(item?.paymentOrder) || item?.status === "pending" || pipeline.applied > 0;
  }

  function directorCampaignMatches(item) {
    const query = String(panelDataState.directorQuery || "").trim().toLowerCase();
    const filter = String(panelDataState.directorFilter || "all");
    const matchesText =
      !query ||
      [item?.title, item?.companyName, item?.companyType, item?.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    if (!matchesText) return false;
    if (filter === "active") return item?.status === "active";
    if (filter === "attention") return campaignNeedsAttention(item);
    if (filter === "closed") return new Set(["closed", "expired"]).has(item?.status);
    return true;
  }

  function pipelineBar(label, value, total, tone = "") {
    const percent = total > 0 ? Math.max(4, Math.round((value / total) * 100)) : 0;
    return `<div class="pipeline-row ${tone}"><span>${escapeHtml(label)}</span><div><i style="width:${percent}%"></i></div><strong>${formatNumber(value)}</strong></div>`;
  }

  function renderCampaign(item) {
    const pipeline = campaignPipeline(item);
    const busy = actionIsBusy(`campaign:${item.id}`);
    const statusAction = item.status === "active"
      ? `<button class="danger-button" type="button" data-action="set-campaign-status" data-job-id="${escapeHtml(item.id)}" data-status="close" ${busy ? "disabled" : ""}>${busy ? "Closing…" : "Close advert"}</button>`
      : item.status === "closed"
        ? `<button class="accept-button" type="button" data-action="set-campaign-status" data-job-id="${escapeHtml(item.id)}" data-status="reopen" ${busy ? "disabled" : ""}>${busy ? "Reopening…" : "Reopen advert"}</button>`
        : item.paymentOrder
          ? '<button class="job-primary" type="button" data-open-path="/jobcentreplus/dashboard/">Complete payment</button>'
          : '<button class="job-primary" type="button" data-open-path="/jobcentreplus/dashboard/">Renew on site</button>';
    return `<article class="application-card campaign-card">
      <div class="application-card-head">
        <div><span class="application-company">${escapeHtml(item.companyName || "Company")}</span><h3>${escapeHtml(item.title || "Campaign")}</h3><p>${escapeHtml(item.companyType || "")}</p></div>
        <span class="status-pill ${statusClass(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
      </div>
      <div class="campaign-stats">
        <span><strong>${formatNumber(item.applicationCount)}</strong><small>Applications</small></span>
        <span><strong>${escapeHtml(String(item.listingType || "standard"))}</strong><small>Listing</small></span>
        <span><strong>${escapeHtml(expiresLabel(item.expiresAt))}</strong><small>Expiry</small></span>
      </div>
      <div class="campaign-pipeline-mini">
        <span><small>New</small><strong>${formatNumber(pipeline.applied)}</strong></span>
        <span><small>Viewed</small><strong>${formatNumber(pipeline.viewed)}</strong></span>
        <span><small>Accepted</small><strong>${formatNumber(pipeline.accepted)}</strong></span>
        <span><small>Rejected</small><strong>${formatNumber(pipeline.rejected)}</strong></span>
      </div>
      ${item.paymentOrder ? `<div class="payment-warning"><strong>Payment pending</strong><span>${formatMoney(item.paymentOrder.amountDue)}</span></div>` : ""}
      <div class="application-actions campaign-actions">
        <button class="ghost-button" type="button" data-action="view-campaign" data-job-id="${escapeHtml(item.id)}">View advert</button>
        ${statusAction}
        <button class="ghost-button" type="button" data-open-path="/jobcentreplus/?modal=applications&campaign=${encodeURIComponent(String(item.id || ""))}">Extend / edit</button>
      </div>
    </article>`;
  }

  function applicationTabButton(key, label, count) {
    return `<button type="button" class="application-tab ${panelDataState.applicationTab === key ? "active" : ""}" data-application-tab="${key}"><span>${escapeHtml(label)}</span><strong>${panelDataState.error && panelDataCount() === 0 ? "—" : formatNumber(count)}</strong></button>`;
  }

  function renderApplicationsView() {
    const activeOutgoing = panelDataState.outgoing.filter(
      (item) => !applicationIsArchived(item),
    );
    const activeIncoming = panelDataState.incoming.filter(
      (item) => !applicationIsArchived(item),
    );
    const archive = [
      ...panelDataState.outgoing
        .filter(applicationIsArchived)
        .map((item) => ({ ...item, archiveKind: "outgoing" })),
      ...panelDataState.incoming
        .filter(applicationIsArchived)
        .map((item) => ({ ...item, archiveKind: "incoming" })),
    ];
    const groups = {
      outgoing: activeOutgoing,
      incoming: activeIncoming,
      archive,
      campaigns: panelDataState.campaigns,
    };
    const selected = (groups[panelDataState.applicationTab] || []).filter(applicationMatchesQuery);
    const renderer = panelDataState.applicationTab === "incoming"
      ? renderIncomingApplication
      : panelDataState.applicationTab === "archive"
        ? (item) => item.archiveKind === "incoming"
          ? renderIncomingApplication(item)
          : renderOutgoingApplication(item)
      : panelDataState.applicationTab === "campaigns"
        ? renderCampaign
        : renderOutgoingApplication;
    return `<section class="view-section applications-view">
      <div class="view-heading">
        <div><span class="eyebrow">PROGRESS</span><h2>Applications</h2></div>
        <button class="icon-action ${panelDataState.loading ? "spinning" : ""}" type="button" data-action="refresh-panel-data" aria-label="Refresh applications">↻</button>
      </div>
      <p class="view-description">Track applications, review candidates and monitor your active campaigns inside Torn.</p>
      <div class="application-tabs">
        ${applicationTabButton("outgoing", "Mine", activeOutgoing.length)}
        ${applicationTabButton("incoming", "Applicants", activeIncoming.length)}
        ${applicationTabButton("archive", "Archive", archive.length)}
        ${applicationTabButton("campaigns", "Campaigns", panelDataState.campaigns.length)}
      </div>
      <label class="job-search application-search"><span>⌕</span><input type="search" data-panel-search placeholder="Search applications" value="${escapeHtml(panelDataState.query)}"></label>
      ${panelDataState.error ? `<div class="jobs-error"><strong>Applications could not refresh</strong><span>${escapeHtml(panelDataState.error)}</span></div>` : ""}
      ${actionState.error ? `<div class="jobs-error"><strong>Action could not complete</strong><span>${escapeHtml(actionState.error)}</span></div>` : ""}
      <div class="application-list">${
        panelDataState.loading && panelDataCount() === 0
          ? '<div class="job-loading"><span></span><span></span><span></span></div>'
          : selected.length
            ? selected.map(renderer).join("")
            : panelDataState.error
              ? ""
            : emptyState(
                panelDataState.query
                  ? "No matching records"
                  : panelDataState.applicationTab === "incoming"
                    ? "No applicants yet"
                    : panelDataState.applicationTab === "archive"
                      ? "Archive is empty"
                    : panelDataState.applicationTab === "campaigns"
                      ? "No campaigns yet"
                      : "No applications yet",
                panelDataState.query
                  ? "Try a different search."
                  : panelDataState.applicationTab === "incoming"
                    ? "New applicants will appear here when someone applies."
                    : panelDataState.applicationTab === "archive"
                      ? "Accepted, rejected, withdrawn and expired applications move here automatically."
                    : panelDataState.applicationTab === "campaigns"
                      ? "Your published job adverts will appear here."
                      : "Applications you send will appear here.",
              )
      }</div>
      <button class="secondary-button" type="button" data-open-path="/jobcentreplus/dashboard/">Open full applications dashboard</button>
    </section>`;
  }

  function directorFilterButton(key, label, count) {
    return `<button type="button" class="director-filter ${panelDataState.directorFilter === key ? "active" : ""}" data-director-filter="${key}"><span>${escapeHtml(label)}</span><strong>${formatNumber(count)}</strong></button>`;
  }

  function renderDirectorView() {
    const summary = panelDataState.directorSummary || {};
    const campaigns = panelDataState.campaigns
      .filter(directorCampaignMatches)
      .sort((left, right) => {
        const leftDate = new Date(left.createdAt || 0).getTime();
        const rightDate = new Date(right.createdAt || 0).getTime();
        return rightDate - leftDate || Number(right.id) - Number(left.id);
      });
    const totalApplicants = Number(summary.totalApplicants) || 0;
    const conversion = Number(summary.conversionRate) || 0;
    const hasDirectorData = directorToolsVisible();

    return `<section class="view-section director-view">
      <div class="view-heading">
        <div><span class="eyebrow">COMPANY CONTROL</span><h2>Director dashboard</h2></div>
        <button class="icon-action ${panelDataState.loading ? "spinning" : ""}" type="button" data-action="refresh-panel-data" aria-label="Refresh director dashboard">↻</button>
      </div>
      <p class="view-description">Monitor campaign performance and move applicants through the hiring pipeline without leaving Torn.</p>
      ${panelDataState.error ? `<div class="jobs-error"><strong>Director data could not refresh</strong><span>${escapeHtml(panelDataState.error)}</span></div>` : ""}
      ${actionState.error ? `<div class="jobs-error"><strong>Campaign action could not complete</strong><span>${escapeHtml(actionState.error)}</span></div>` : ""}
      ${hasDirectorData ? `
        <div class="director-hero">
          <div><span class="eyebrow">${escapeHtml(pollState.player?.currentCompanyName || "YOUR COMPANY")}</span><h3>${formatNumber(summary.activeCampaigns)} active campaign${Number(summary.activeCampaigns) === 1 ? "" : "s"}</h3><p>${formatNumber(summary.newApplicants)} applicant${Number(summary.newApplicants) === 1 ? "" : "s"} waiting for review.</p></div>
          <button class="primary-mini" type="button" data-open-path="/jobcentreplus/?modal=post">Post listing ↗</button>
        </div>
        <div class="director-stat-grid">
          <button type="button" data-director-filter="active"><span>Active adverts</span><strong>${formatNumber(summary.activeCampaigns)}</strong><small>${formatNumber(summary.pendingCampaigns)} pending</small></button>
          <button type="button" data-view="applications" data-application-tab="incoming"><span>Awaiting review</span><strong>${formatNumber(summary.newApplicants)}</strong><small>${formatNumber(summary.viewedApplicants)} viewed</small></button>
          <button type="button" data-view="applications" data-application-tab="incoming"><span>Accepted</span><strong>${formatNumber(summary.acceptedApplicants)}</strong><small>${formatNumber(summary.rejectedApplicants)} rejected</small></button>
          <div><span>Conversion</span><strong>${formatNumber(conversion)}%</strong><small>${formatNumber(totalApplicants)} total applicants</small></div>
        </div>
        <div class="director-pipeline">
          <div class="section-heading"><div><span class="eyebrow">PIPELINE</span><h3>Applicant progress</h3></div></div>
          ${pipelineBar("New", Number(summary.newApplicants) || 0, totalApplicants, "new")}
          ${pipelineBar("Viewed", Number(summary.viewedApplicants) || 0, totalApplicants, "viewed")}
          ${pipelineBar("Accepted", Number(summary.acceptedApplicants) || 0, totalApplicants, "accepted")}
          ${pipelineBar("Rejected", Number(summary.rejectedApplicants) || 0, totalApplicants, "rejected")}
        </div>
        <div class="section-heading director-campaign-heading"><div><span class="eyebrow">CAMPAIGNS</span><h3>Your listings</h3></div><button class="text-action" type="button" data-open-path="/jobcentreplus/dashboard/">Full dashboard</button></div>
        <div class="director-filters">
          ${directorFilterButton("active", "Active", summary.activeCampaigns)}
          ${directorFilterButton("all", "All", summary.totalCampaigns)}
          ${directorFilterButton("attention", "Attention", Number(summary.pendingCampaigns) + Number(summary.newApplicants))}
          ${directorFilterButton("closed", "Closed", Number(summary.closedCampaigns) + Number(summary.expiredCampaigns))}
        </div>
        <label class="job-search application-search"><span>⌕</span><input type="search" data-director-search placeholder="Search campaigns" value="${escapeHtml(panelDataState.directorQuery)}"></label>
        <div class="application-list">${
          panelDataState.loading && panelDataState.campaigns.length === 0
            ? '<div class="job-loading"><span></span><span></span><span></span></div>'
            : campaigns.length
              ? campaigns.map(renderCampaign).join("")
              : emptyState("No campaigns in this view", panelDataState.directorQuery ? "Try a different search." : "Publish or renew an advert from the full JobCentre+ site.")
        }</div>
      ` : emptyState("Director tools are ready", "Publish your first company advert on JobCentre+ and its campaign dashboard will appear here.")}
      <div class="director-footer-actions"><button class="secondary-button" type="button" data-open-path="/jobcentreplus/dashboard/">Open director dashboard</button></div>
    </section>`;
  }

  function talentTrainingLabel(candidate) {
    if (candidate.trainingPlanType === "paid") {
      return `Buying ${formatNumber(candidate.paidTrainingTrains)} trains · TCD $${formatNumber(candidate.paidTrainingAmount)} each`;
    }
    if (candidate.trainingPlanType === "rotational") {
      return "Rotational training";
    }
    return `${formatNumber(candidate.minimumTrainsPerWeek)} trains/week minimum`;
  }

  function talentCompanyTypes() {
    return Array.from(
      new Set(
        talentState.candidates.flatMap((candidate) =>
          Array.isArray(candidate.companyTypes) ? candidate.companyTypes : [],
        ),
      ),
    ).sort((left, right) => String(left).localeCompare(String(right)));
  }

  function talentOpenToAll(candidate) {
    return Boolean(
      candidate?.openToAllCompanies ||
      (Array.isArray(candidate?.companyTypes) && candidate.companyTypes.length >= 39),
    );
  }

  function talentCandidateMatches(candidate) {
    const query = String(talentState.query || "").trim().toLowerCase();
    const companyTypes = Array.isArray(candidate.companyTypes)
      ? candidate.companyTypes
      : [];
    const openToAll = talentOpenToAll(candidate);
    const matchesQuery =
      !query ||
      [
        candidate.name,
        candidate.bio,
        candidate.currentCompanyName,
        openToAll ? "Open to all company types" : "",
        ...companyTypes,
      ].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesCompany =
      talentState.companyType === "all" ||
      openToAll ||
      companyTypes.includes(talentState.companyType);
    const matchesTraining =
      talentState.trainingPlan === "all" ||
      candidate.trainingPlanType === talentState.trainingPlan;
    return matchesQuery && matchesCompany && matchesTraining;
  }

  function renderTalentCandidate(candidate) {
    const companyTypes = Array.isArray(candidate.companyTypes)
      ? candidate.companyTypes
      : [];
    const openToAll = talentOpenToAll(candidate);
    const avatar = candidate.avatarUrl
      ? `<img alt="" referrerpolicy="no-referrer" src="${escapeHtml(candidate.avatarUrl)}">`
      : escapeHtml(String(candidate.name || "JC").slice(0, 2).toUpperCase());
    const notifierAvailable = Boolean(candidate.notifierAvailable);
    const notifierOnline = Boolean(candidate.notifierOnline);
    const messageBusy = messageState.busyKey === `talent:${candidate.tornId}`;
    const presenceLabel = notifierOnline
      ? "Online"
      : notifierAvailable
        ? "Notifier ready"
        : "Notifier needed";
    const meritLevel = Number(candidate.employeeEffectivenessMerits);
    const meritDisplay =
      candidate.employeeEffectivenessMerits !== null &&
      candidate.employeeEffectivenessMerits !== undefined &&
      Number.isSafeInteger(meritLevel) &&
      meritLevel >= 0
        ? `+${formatNumber(meritLevel)}`
        : "—";
    return `<article class="talent-card">
      <div class="talent-card-head">
        <div class="talent-avatar ${candidate.avatarUrl ? "has-avatar" : ""}">${avatar}</div>
        <div><strong>${escapeHtml(candidate.name || "Candidate")}</strong><span>${escapeHtml(candidate.currentCompanyName ? `${candidate.currentPosition || "Employee"} at ${candidate.currentCompanyName}` : "Available for a company role")}</span></div>
        <span class="talent-presence ${notifierOnline ? "online" : notifierAvailable ? "ready" : "unavailable"}"><i></i>${presenceLabel}</span>
      </div>
      <div class="applicant-stats talent-stats">
        <span><small>MAN</small><strong>${formatNumber(candidate.manualLabor)}</strong></span>
        <span><small>INT</small><strong>${formatNumber(candidate.intelligence)}</strong></span>
        <span><small>END</small><strong>${formatNumber(candidate.endurance)}</strong></span>
        <span title="Employee Effectiveness merit upgrades"><small>EE</small><strong>${meritDisplay}</strong></span>
      </div>
      <div class="talent-tags">${openToAll ? '<span class="talent-tag-all">Open to all company types</span>' : companyTypes.map((type) => `<span>${escapeHtml(type)}</span>`).join("")}</div>
      <div class="talent-details">
        <span><small>Daily pay</small><strong>TCD $${formatNumber(candidate.payExpectationAmount)}</strong></span>
        <span><small>Training</small><strong>${escapeHtml(talentTrainingLabel(candidate))}</strong></span>
        <span><small>Activity</small><strong>${escapeHtml(candidate.activityLevel || "Not stated")}</strong></span>
        <span><small>Notice</small><strong>${candidate.noticeRequired ? `${formatNumber(candidate.noticePeriodDays)} days` : "None"}</strong></span>
      </div>
      ${candidate.bio ? `<p class="talent-bio">${escapeHtml(candidate.bio)}</p>` : ""}
      <div class="talent-actions">
        <button class="job-primary" type="button" data-action="message-talent" data-candidate-id="${escapeHtml(candidate.tornId)}" ${messageBusy || !notifierAvailable ? "disabled" : ""} title="${notifierAvailable ? "Start or open a private notifier conversation" : "This candidate must connect the JobCentre+ notifier before messages can be delivered"}">${messageBusy ? "Opening…" : "Message"}</button>
        <button class="secondary-button" type="button" data-profile-id="${escapeHtml(candidate.tornId)}">View Torn profile</button>
      </div>
    </article>`;
  }

  function renderTalentView() {
    const candidates = talentState.candidates.filter(talentCandidateMatches);
    const companyTypes = talentCompanyTypes();
    return `<section class="view-section talent-view">
      <div class="view-heading">
        <div><span class="eyebrow">DIRECTOR SEARCH</span><h2>Applicant pool</h2></div>
        <button class="icon-action ${talentState.loading ? "spinning" : ""}" type="button" data-action="refresh-talent" aria-label="Refresh applicant pool">↻</button>
      </div>
      <p class="view-description">Search active candidates by verified work stats, company interests and training preferences.</p>
      <label class="job-search application-search"><span>⌕</span><input type="search" data-talent-search placeholder="Search candidates" value="${escapeHtml(talentState.query)}"></label>
      <div class="talent-filters">
        <select data-talent-company aria-label="Company interest">
          <option value="all">All company types</option>
          ${companyTypes.map((type) => `<option value="${escapeHtml(type)}" ${talentState.companyType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}
        </select>
        <select data-talent-training aria-label="Training preference">
          <option value="all" ${talentState.trainingPlan === "all" ? "selected" : ""}>Any training</option>
          <option value="open" ${talentState.trainingPlan === "open" ? "selected" : ""}>Open training</option>
          <option value="rotational" ${talentState.trainingPlan === "rotational" ? "selected" : ""}>Rotational</option>
          <option value="paid" ${talentState.trainingPlan === "paid" ? "selected" : ""}>Buying trains</option>
        </select>
      </div>
      ${talentState.error ? `<div class="jobs-error"><strong>Applicant pool could not refresh</strong><span>${escapeHtml(talentState.error)}</span></div>` : ""}
      <div class="talent-summary"><strong>${talentState.error && !talentState.candidates.length ? "—" : formatNumber(candidates.length)}</strong><span>of ${formatNumber(talentState.candidates.length)} active candidates</span></div>
      <div class="application-list talent-list">${
        talentState.loading && !talentState.candidates.length
          ? '<div class="job-loading"><span></span><span></span><span></span></div>'
          : candidates.length
            ? candidates.map(renderTalentCandidate).join("")
            : talentState.error
              ? ""
              : emptyState("No candidates match", "Try another company type, training plan or search term.")
      }</div>
      <button class="secondary-button" type="button" data-open-path="/jobcentreplus/#companies">Open full applicant pool</button>
    </section>`;
  }

  function renderConversation(item) {
    const conversationType = normalizedConversationType(item.conversationType);
    const conversationId = conversationIdFor(item);
    const unread = Number(item.unreadCount) || 0;
    const latest = String(item.latestMessage || "No messages yet").trim();
    const latestFromMe =
      Number(item.latestSenderTornId) > 0 &&
      Number(item.latestSenderTornId) === Number(pollState.player?.tornId);
    const subject = conversationType === "talent"
      ? `${item.participantLabel || "Talent pool"}${item.participantOnline ? " · Online" : ""}`
      : item.job?.title || "Application";
    return `<button type="button" class="conversation-card ${unread ? "unread" : ""}" data-action="open-conversation" data-conversation-type="${conversationType}" data-conversation-id="${escapeHtml(conversationId)}">
      <div class="conversation-avatar">${escapeHtml(String(item.participantName || "JC+").slice(0, 2).toUpperCase())}</div>
      <div class="conversation-body">
        <div class="conversation-head"><div><strong>${escapeHtml(item.participantName || "JobCentre+")}</strong><span>${escapeHtml(subject)}</span></div><span>${escapeHtml(formatRelativeTime(item.latestMessageAt || item.createdAt))}</span></div>
        <p class="conversation-preview">${latestFromMe ? '<small>You:</small> ' : ""}${escapeHtml(latest)}</p>
        <div class="conversation-foot"><span class="status-pill ${statusClass(item.status)}">${escapeHtml(statusLabel(item.status))}</span>${unread ? `<strong class="conversation-unread">${formatNumber(unread)}</strong>` : `<span>${formatNumber(item.messageCount || 0)} message${Number(item.messageCount) === 1 ? "" : "s"}</span>`}</div>
      </div>
    </button>`;
  }

  function messageBodyHtml(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function renderMessageBubble(message) {
    if (message.hidden) {
      return `<div class="message-bubble system hidden-message"><p>This message was hidden by moderation.</p><span>${escapeHtml(formatRelativeTime(message.createdAt))}</span></div>`;
    }
    const mine = Boolean(message.isMine);
    return `<div class="message-bubble ${mine ? "mine" : "theirs"}">
      <div class="message-bubble-head"><strong>${mine ? "You" : escapeHtml(message.senderName || "Participant")}</strong><span>${escapeHtml(formatRelativeTime(message.createdAt))}</span></div>
      <p>${messageBodyHtml(message.body || "")}</p>
      <div class="message-bubble-foot">
        ${mine ? `<span>${message.readAt ? "Read" : "Sent"}</span>` : message.canReport ? `<button type="button" data-action="report-message" data-message-id="${escapeHtml(message.id)}">Report</button>` : `<span>${message.moderationStatus === "reported" ? "Reported" : ""}</span>`}
      </div>
    </div>`;
  }

  function renderMessageThread() {
    const conversation = messageState.conversation;
    const summary = selectedConversationSummary();
    const participant = conversation?.participant || {
      name: summary?.participantName || "Conversation",
      label: summary?.participantLabel || "Participant",
      tornId: summary?.participantTornId || null,
    };
    const job = conversation?.job || summary?.job || {};
    const status = conversation?.status || summary?.status || "applied";
    const conversationType = normalizedConversationType(
      conversation?.conversationType || messageState.selectedConversationType,
    );
    const conversationId = Number(messageState.selectedConversationId);
    const isTalentConversation = conversationType === "talent";
    const conversationClosed =
      !isTalentConversation &&
      (conversation?.canReply === false || applicationIsArchived({ status }));
    const sending =
      messageState.busyKey === `send:${conversationType}:${conversationId}`;
    const remaining = Math.max(0, MESSAGE_MAX_LENGTH - String(messageState.draft || "").length);

    return `<section class="view-section messages-view message-thread-view">
      <div class="message-thread-header">
        <button class="thread-back" type="button" data-action="close-conversation" aria-label="Back to conversations">‹</button>
        <div class="conversation-avatar">${escapeHtml(String(participant.name || "JC+").slice(0, 2).toUpperCase())}</div>
        <div><span class="eyebrow">${escapeHtml(participant.label || "CONVERSATION")}${participant.online ? " · ONLINE" : ""}</span><h2>${escapeHtml(participant.name || "Conversation")}</h2><p>${escapeHtml(isTalentConversation ? "Talent pool conversation" : job.title || "Application")}</p></div>
        <span class="status-pill ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>
      </div>
      ${messageState.error ? `<div class="jobs-error"><strong>Messaging could not complete</strong><span>${escapeHtml(messageState.error)}</span></div>` : ""}
      <div class="message-thread" data-message-thread>
        ${messageState.loading && !conversation ? '<div class="job-loading"><span></span><span></span><span></span></div>' : ""}
        ${conversation?.note ? `<div class="message-bubble system application-note-message"><strong>Original application note</strong><p>${messageBodyHtml(conversation.note)}</p><span>${escapeHtml(formatRelativeTime(conversation.createdAt))}</span></div>` : ""}
        ${messageState.messages.length ? messageState.messages.map(renderMessageBubble).join("") : conversation ? `<div class="thread-empty"><strong>Start the conversation</strong><span>${isTalentConversation ? "Send a private message about a potential company role." : "Send a private message about this application."}</span></div>` : ""}
      </div>
      ${conversationClosed
        ? `<div class="conversation-archived-note"><strong>Conversation archived</strong><span>This application is ${escapeHtml(statusLabel(status).toLowerCase())}. Its message history is read-only.</span></div>`
        : `<div class="message-composer">
            <label><span>Reply</span><textarea data-message-draft maxlength="${MESSAGE_MAX_LENGTH}" placeholder="Write a private message…" ${sending ? "disabled" : ""}>${escapeHtml(messageState.draft)}</textarea><small>${formatNumber(remaining)} characters remaining</small></label>
            <button class="job-primary" type="button" data-action="send-message" ${sending || !String(messageState.draft || "").trim() ? "disabled" : ""}>${sending ? "Sending…" : "Send"}</button>
          </div>`}
      <div class="message-privacy-note"><span>🔒</span><p>${isTalentConversation ? "Only this candidate and the verified director can read or reply to this notifier conversation." : "Only the applicant and this advert’s authorised director can read or reply to this conversation."}</p></div>
    </section>`;
  }

  function renderMessagesView() {
    if (messageState.selectedConversationId) return renderMessageThread();
    const conversations = panelDataState.conversations.filter(applicationMatchesQuery);
    const unread = messageUnreadCount();
    return `<section class="view-section messages-view">
      <div class="view-heading">
        <div><span class="eyebrow">PRIVATE CONVERSATIONS</span><h2>Messages</h2></div>
        <button class="icon-action ${panelDataState.loading ? "spinning" : ""}" type="button" data-action="refresh-panel-data" aria-label="Refresh messages">↻</button>
      </div>
      <p class="view-description">Talk privately about genuine applications and director talent-pool enquiries.</p>
      <div class="message-summary"><span><strong>${panelDataState.error ? "—" : formatNumber(unread)}</strong><small>Unread</small></span><span><strong>${panelDataState.error ? "—" : formatNumber(panelDataState.conversations.length)}</strong><small>Conversations</small></span><span><strong>${panelDataState.error ? "—" : formatNumber(panelDataState.messagingSummary?.totalMessages || 0)}</strong><small>Messages</small></span></div>
      <label class="job-search application-search"><span>⌕</span><input type="search" data-panel-search placeholder="Search conversations" value="${escapeHtml(panelDataState.query)}"></label>
      ${panelDataState.error ? `<div class="jobs-error"><strong>Conversations could not refresh</strong><span>${escapeHtml(panelDataState.error)}</span></div>` : ""}
      <div class="conversation-list">${
        panelDataState.loading && panelDataCount() === 0
          ? '<div class="job-loading"><span></span><span></span></div>'
          : conversations.length
            ? conversations.map(renderConversation).join("")
            : panelDataState.error
              ? ""
            : emptyState(
                "No conversations yet",
                "Apply for a role, receive an applicant or contact an available candidate.",
              )
      }</div>
      <div class="message-scope-note"><strong>Verified JobCentre+ messaging</strong><span>Application threads stay tied to their advert. Talent-pool threads can only be started by a verified director with a notifier-connected candidate.</span></div>
    </section>`;
  }

  function settingRow(key, title, description) {
    return `<label class="setting-row"><span><strong>${escapeHtml(
      title,
    )}</strong><small>${escapeHtml(description)}</small></span><input type="checkbox" data-setting="${key}" ${
      panelSettings[key] ? "checked" : ""
    }><span class="toggle" aria-hidden="true"></span></label>`;
  }

  function renderSettingsView() {
    const player = pollState.player;
    const statsAvailable = Boolean(player);
    const stale = statsAreStale(player);
    const authRequired = notifierAuthenticationRequired();
    const statValue = (key) => statsAvailable ? formatNumber(player[key]) : "—";
    return `<section class="view-section">
      <div class="view-heading"><div><span class="eyebrow">PREFERENCES</span><h2>Settings</h2></div></div>
      <div class="settings-card">
        ${settingRow(
          "desktopNotifications",
          "Browser notifications",
          "Show operating-system alerts when JobCentre+ changes.",
        )}
        ${settingRow(
          "pageBanners",
          "Torn page banners",
          "Show colour-coded notices at the top-right of Torn.",
        )}
        ${settingRow(
          "startOpen",
          "Open panel automatically",
          "Start with the JobCentre+ panel expanded after page loads.",
        )}
      </div>
      <div class="workstats-card">
        <div class="workstats-head">
          <div><span class="eyebrow">WORK STATS</span><strong>${statsAvailable ? "Ready for job matching" : "Work stats unavailable"}</strong><small>${escapeHtml(statsFreshnessLabel(player))}${stale ? " · refresh recommended" : ""}</small></div>
          <button class="stats-refresh-button ${statsState.loading ? "spinning" : ""}" type="button" data-action="refresh-stats" ${statsState.loading || statsCooldownRemaining() > 0 ? "disabled" : ""}>${statsRefreshButtonLabel()}</button>
        </div>
        <div class="workstats-grid">
          <span><small>MAN</small><strong>${statValue("manualLabor")}</strong></span>
          <span><small>INT</small><strong>${statValue("intelligence")}</strong></span>
          <span><small>END</small><strong>${statValue("endurance")}</strong></span>
          <span><small>TOTAL</small><strong>${statValue("totalWorkstats")}</strong></span>
        </div>
        <p>Stats are saved in userscript storage for instant job matching and refresh automatically when older than 6 hours. Manual refreshes are limited to once every 5 minutes.</p>
        ${statsState.error ? `<div class="inline-warning">${escapeHtml(statsState.error)}</div>` : ""}
      </div>
      ${authRequired ? `<div class="connection-recovery"><strong>Secure connection required</strong><span>The notifier credential is missing or expired. Reconnect directly with your Torn API key; the userscript will not open a remote installer.</span><button class="primary-button" type="button" data-action="reconnect">Reconnect JobCentre+</button></div>` : ""}
      <details class="connection-diagnostics">
        <summary>Connection diagnostics</summary>
        <div class="status-card">
          <div><span>Connected account</span><strong>${escapeHtml(
            pollState.playerName || (authRequired ? "Authentication required" : pollState.loading ? "Connecting automatically…" : "Automatic sync pending"),
          )}</strong></div>
          <div><span>Last HTTP status</span><strong>${escapeHtml(
            pollState.loading ? "Checking…" : pollState.lastStatus ?? "Not checked",
          )}</strong></div>
          <div><span>Last successful sync</span><strong>${escapeHtml(
            formatClock(pollState.lastSuccessAt),
          )}</strong></div>
          ${pollState.lastFailureAt ? `<div><span>Last connection issue</span><strong title="${escapeHtml(pollState.lastFailureMessage)}">${escapeHtml(formatClock(pollState.lastFailureAt))}${pollState.consecutiveFailures ? ` · ${pollState.consecutiveFailures} in a row` : " · recovered"}</strong></div>` : ""}
          <div><span>Panel version</span><strong>${SCRIPT_VERSION}</strong></div>
        </div>
        <button class="secondary-button" type="button" data-action="server-test">Test connection again</button>
      </details>
    </section>`;
  }

  function renderActiveView() {
    switch (panelState.activeView) {
      case "updates":
        return renderUpdatesView();
      case "jobs":
        return renderJobsView();
      case "applications":
        return renderApplicationsView();
      case "messages":
        return renderMessagesView();
      case "director":
        return renderDirectorView();
      case "talent":
        return renderTalentView();
      case "settings":
        return renderSettingsView();
      default:
        return renderHomeView();
    }
  }


  function renderApplyModal() {
    const job = actionState.applyJob;
    if (!job) return "";
    const busy = actionIsBusy(`apply:${job.id}`);
    const accountInactive =
      String(pollState.player?.accountStatus || "active") !== "active";
    const remaining = Math.max(0, 500 - String(actionState.applyNote || "").length);
    return `<div class="modal-backdrop" role="presentation">
      <section class="apply-modal" role="dialog" aria-modal="true" aria-labelledby="jc-apply-title">
        <div class="apply-modal-head"><div><span class="eyebrow">QUICK APPLY</span><h2 id="jc-apply-title">${escapeHtml(job.title || "Apply")}</h2><p>${escapeHtml(job.companyName || "JobCentre+ company")}</p></div><button type="button" data-action="cancel-apply" aria-label="Close">×</button></div>
        <label class="apply-note-label"><span>Application note <small>optional</small></span><textarea data-apply-note maxlength="500" placeholder="Tell the director why you are a good fit…">${escapeHtml(actionState.applyNote)}</textarea><small>${remaining} characters remaining</small></label>
        ${accountInactive ? `<div class="apply-availability-note" role="status"><strong>Availability is Inactive</strong><span>Set your JobCentre+ account to Active before applying.</span><button class="ghost-button" type="button" data-open-path="/jobcentreplus/?modal=profile">Update availability ↗</button></div>` : ""}
        ${actionState.error ? `<div class="jobs-error"><strong>Could not apply</strong><span>${escapeHtml(actionState.error)}</span></div>` : ""}
        <div class="apply-modal-actions"><button class="ghost-button" type="button" data-action="cancel-apply" ${busy ? "disabled" : ""}>Cancel</button><button class="job-primary" type="button" data-action="submit-apply" title="${accountInactive ? "Set availability to Active to apply" : "Send application"}" ${busy || accountInactive ? "disabled" : ""}>${busy ? "Sending…" : accountInactive ? "Activate to apply" : "Send application"}</button></div>
      </section>
    </div>`;
  }

  function panelMarkup() {
    const unread = unreadCount();
    const activeIncoming = panelDataState.incoming.filter(
      (item) => !applicationIsArchived(item),
    ).length;
    return `<button id="jc-launcher" class="launcher ${
      panelState.open ? "panel-open" : ""
    }" type="button" data-action="toggle-panel" aria-label="Open JC+ panel. Drag to move." aria-expanded="${panelState.open ? "true" : "false"}" title="Drag to move · click to open">
      <span class="launcher-logo">${ICON_SVG}</span>
      <span class="launcher-text">Jobs</span>
      <span class="launcher-badge ${unread ? "visible" : ""}">${
        unread > 99 ? "99+" : unread
      }</span>
    </button>
    <button class="panel-backdrop ${panelState.open ? "open" : ""}" type="button" data-panel-backdrop data-action="close-panel" aria-label="Close JC+ panel" aria-hidden="${panelState.open ? "false" : "true"}" tabindex="-1"></button>
    <aside id="jc-panel" class="panel ${panelState.open ? "open" : ""}" role="dialog" aria-modal="true" aria-hidden="${panelState.open ? "false" : "true"}" aria-label="JobCentre+ companion panel">
      <header class="panel-header">
        <div class="brand"><span class="brand-mark">${ICON_SVG}</span><div><strong>JobCentre+</strong><span><i class="header-dot ${connectionTone()}"></i>${escapeHtml(
          connectionLabel(),
        )}</span></div></div>
        <div class="header-actions"><button type="button" data-action="poll" aria-label="Refresh">↻</button><button type="button" data-action="close-panel" aria-label="Close">×</button></div>
      </header>
      <div class="panel-body">
        <nav class="panel-nav" aria-label="JobCentre+ sections">
          ${navButton("home", "⌂", "Home")}
          ${navButton("updates", "●", "Updates", unread)}
          ${navButton("jobs", "⌕", "Jobs")}
          ${navButton("applications", "✓", "Applications", activeIncoming)}
          ${navButton("messages", "✉", "Messages", messageUnreadCount())}
          ${directorToolsVisible() ? navButton("director", "▦", "Director", panelDataState.directorSummary.newApplicants) : ""}
          ${canBrowseTalent() ? navButton("talent", "◎", "Talent", talentState.candidates.length) : ""}
          ${navButton("settings", "⚙", "Settings")}
        </nav>
        <main class="panel-content">${renderActiveView()}</main>
      </div>
      <footer class="panel-footer"><span>JC+ v${SCRIPT_VERSION}</span><button type="button" data-action="open-main">Full website ↗</button></footer>
    </aside>${renderApplyModal()}`;
  }

  function panelStyles() {
    return `
      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; }
      button, input { font: inherit; }
      button { -webkit-tap-highlight-color: transparent; touch-action:manipulation; }
      input, textarea, select { font-size:16px; }
      .launcher, .panel, .panel-backdrop, .modal-backdrop { pointer-events:auto; font-family: Inter, Arial, Helvetica, sans-serif; }
      .panel-backdrop {
        position:fixed; inset:0; z-index:2147483599; border:0; margin:0; padding:0;
        background:rgba(1,4,1,.42); opacity:0; pointer-events:none; cursor:default;
        backdrop-filter:blur(0); -webkit-backdrop-filter:blur(0);
        transition:opacity .28s ease, backdrop-filter .34s ease, -webkit-backdrop-filter .34s ease;
      }
      .panel-backdrop.open { opacity:1; pointer-events:auto; backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }
      .launcher {
        position: fixed; right: 0; top: 44%; z-index: 2147483600;
        width: 52px; min-height: 92px; border: 1px solid rgba(217,255,82,.5);
        border-right: 0; border-radius: 14px 0 0 14px; padding: 10px 6px;
        background: linear-gradient(180deg,#18230f,#0b1108); color: #fff;
        box-shadow: 0 14px 36px rgba(0,0,0,.45); cursor: grab;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
        transition: transform .22s ease, opacity 1.22s ease, border-color 2.22s ease;
        touch-action:none; user-select:none; -webkit-user-select:none;
      }
      .launcher[data-side="left"] { border-left:0; border-right:1px solid rgba(217,255,82,.5); border-radius:0 14px 14px 0; }
      .launcher.dragging { cursor:grabbing; transition:none !important; transform:none !important; }
      @media (hover:hover) and (pointer:fine) { .launcher:hover { border-color:#d9ff52; transform:translateX(-3px); } }
      .launcher:active { transform:scale(.96); }
      .launcher.panel-open { opacity: 0; pointer-events: none; transform: translateX(20px); }
      .launcher-logo { display:grid; place-items:center; width:36px; height:36px; border-radius:10px; overflow:hidden; }
      .launcher-logo svg,.brand-mark svg { display:block; width:100%; height:100%; }
      .launcher-text { color:#cdd8c6; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.09em; writing-mode:vertical-rl; transform:rotate(180deg); }
      .launcher-badge { display:none; min-width:20px; height:20px; border-radius:10px; padding:0 5px; background:#ff5656; color:#fff; font-size:10px; font-weight:900; align-items:center; justify-content:center; }
      .launcher-badge.visible { display:flex; }
      .panel {
        --ink:#101710; --surface:#172019; --surface-2:#1d2920; --line:rgba(216,255,81,.14);
        --acid:#d8ff51; --mint:#87efb1; --orange:#ff7a4f; --muted:#90a087; --text:#f3f5ec;
        position: fixed; z-index: 2147483601; right: 16px; top: 64px; bottom: 16px;
        width: min(500px, calc(100vw - 24px)); min-height: 460px; overflow: hidden;
        border: 1px solid rgba(217,255,82,.28); border-radius: 18px;
        background: linear-gradient(165deg,#111a0d 0%,#090e07 62%,#070a06 100%);
        color: var(--text); box-shadow: 0 24px 80px rgba(0,0,0,.62);
        display:grid; grid-template-rows:auto 1fr auto;
        transform:translate3d(calc(100% + 52px),0,0) scale(.985); opacity:0; pointer-events:none; filter:blur(2px);
        transform-origin:right center; will-change:transform,opacity,filter;
        transition:transform .38s cubic-bezier(.16,1,.3,1), opacity .24s ease, filter .3s ease;
      }
      .panel.open { transform:translate3d(0,0,0) scale(1); opacity:1; pointer-events:auto; filter:none; }
      .panel-header { min-height:72px; padding:13px 14px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--line); background:rgba(8,13,6,.88); backdrop-filter:blur(16px); }
      .brand { display:flex; align-items:center; gap:11px; }
      .brand-mark { display:grid; place-items:center; width:42px; height:42px; border-radius:12px; overflow:hidden; box-shadow:0 7px 20px rgba(216,255,81,.18); }
      .brand div { display:flex; flex-direction:column; gap:3px; }
      .brand strong { font-size:17px; letter-spacing:-.02em; }
      .brand span { color:var(--muted); font-size:11px; display:flex; align-items:center; gap:6px; }
      .header-dot { width:7px; height:7px; border-radius:50%; background:#c7a346; display:inline-block; }
      .header-dot.online { background:#7ddc6b; box-shadow:0 0 0 3px rgba(125,220,107,.12); }
      .header-dot.error { background:#ff6565; box-shadow:0 0 0 3px rgba(255,101,101,.12); }
      .header-actions { display:flex; gap:7px; }
      .header-actions button, .icon-action { width:34px; height:34px; border:1px solid var(--line); border-radius:10px; background:#172111; color:#e9f1e3; cursor:pointer; font-size:18px; }
      @media (hover:hover) and (pointer:fine) { .header-actions button:hover, .icon-action:hover { border-color:rgba(217,255,82,.45); color:var(--acid); } }
      .panel-body { min-height:0; display:grid; grid-template-columns:86px minmax(0,1fr); }
      .panel-nav { padding:11px 8px; border-right:1px solid var(--line); background:rgba(9,14,7,.7); display:flex; flex-direction:column; gap:6px; overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; scrollbar-width:thin; scrollbar-color:#718347 #0a1008; }
      .nav-button { position:relative; min-height:62px; border:1px solid transparent; border-radius:11px; padding:8px 4px; background:transparent; color:#8fa087; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; }
      @media (hover:hover) and (pointer:fine) { .nav-button:hover { background:#141e10; color:#dbe8d4; } }
      .nav-button:active { transform:scale(.96); }
      .nav-button.active { background:linear-gradient(145deg,rgba(217,255,82,.16),rgba(217,255,82,.06)); border-color:rgba(217,255,82,.2); color:var(--acid); }
      .nav-icon { font-size:18px; line-height:1; font-weight:900; }
      .nav-label { font-size:11px; line-height:1.15; font-weight:800; text-align:center; }
      .nav-badge { position:absolute; top:4px; right:5px; min-width:18px; height:18px; border-radius:9px; padding:0 4px; display:grid; place-items:center; background:#ff5d5d; color:#fff; font-size:9px; font-weight:900; }
      .panel-content { min-width:0; overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; scrollbar-width:thin; scrollbar-color:#718347 #0a1008; }
      .panel-nav::-webkit-scrollbar,.panel-content::-webkit-scrollbar,.message-thread::-webkit-scrollbar,.apply-modal::-webkit-scrollbar { width:8px; height:8px; }
      .panel-nav::-webkit-scrollbar-track,.panel-content::-webkit-scrollbar-track,.message-thread::-webkit-scrollbar-track,.apply-modal::-webkit-scrollbar-track { background:#0a1008; }
      .panel-nav::-webkit-scrollbar-thumb,.panel-content::-webkit-scrollbar-thumb,.message-thread::-webkit-scrollbar-thumb,.apply-modal::-webkit-scrollbar-thumb { border:2px solid #0a1008; border-radius:999px; background:#718347; }
      .panel-nav::-webkit-scrollbar-thumb:hover,.panel-content::-webkit-scrollbar-thumb:hover,.message-thread::-webkit-scrollbar-thumb:hover,.apply-modal::-webkit-scrollbar-thumb:hover { background:#a7c43d; }
      .view-section { padding:18px 16px 22px; }
      .view-heading, .section-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
      .view-heading { margin-bottom:14px; }
      .section-heading { align-items:center; margin:20px 0 10px; }
      .eyebrow { display:block; color:#8fa486; font-size:9px; font-weight:900; letter-spacing:.15em; margin-bottom:4px; }
      h2,h3,p { margin:0; }
      h2 { font-size:22px; line-height:1.1; letter-spacing:-.04em; }
      h3 { font-size:15px; letter-spacing:-.02em; }
      .view-description { color:#90a087; font-size:12px; line-height:1.5; margin:-4px 0 14px; }
      .text-action { border:0; padding:3px; background:transparent; color:var(--acid); font-size:10px; font-weight:800; cursor:pointer; }
      .connection-banner { min-height:62px; border:1px solid var(--line); border-radius:13px; padding:12px; display:flex; align-items:center; gap:10px; background:rgba(23,34,17,.72); }
      .connection-banner .status-dot { width:10px; height:10px; flex:0 0 auto; border-radius:50%; background:#c7a346; box-shadow:0 0 0 5px rgba(199,163,70,.12); }
      .connection-banner.online .status-dot { background:#7ddc6b; box-shadow:0 0 0 5px rgba(125,220,107,.12); }
      .connection-banner.error .status-dot { background:#ff6565; box-shadow:0 0 0 5px rgba(255,101,101,.12); }
      .connection-banner div { display:flex; flex-direction:column; gap:3px; min-width:0; }
      .connection-banner strong { font-size:12px; }
      .connection-banner span:last-child { color:#8fa086; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
      .stat-card { min-height:91px; border:1px solid var(--line); border-radius:13px; padding:11px; text-align:left; background:linear-gradient(145deg,#172210,#10170c); color:#fff; cursor:pointer; display:flex; flex-direction:column; }
      .stat-card:hover { border-color:rgba(217,255,82,.36); transform:translateY(-1px); }
      .stat-card.acid { background:linear-gradient(145deg,#d9ff52,#b8e833); color:#0b1108; border-color:transparent; }
      .stat-card span { font-size:9px; text-transform:uppercase; letter-spacing:.08em; font-weight:900; opacity:.74; }
      .stat-card strong { font-size:27px; line-height:1; margin:8px 0 5px; }
      .stat-card small { font-size:9px; opacity:.62; }
      .notification-list { display:flex; flex-direction:column; gap:8px; }
      .notification-card { content-visibility:auto; contain-intrinsic-size:92px; width:100%; position:relative; overflow:hidden; border:1px solid var(--line); border-radius:12px; padding:11px 30px 11px 13px; background:#121a0e; color:#eef5e9; cursor:pointer; text-align:left; display:flex; align-items:stretch; gap:10px; }
      .notification-card:hover { border-color:rgba(217,255,82,.34); background:#162010; }
      .notification-card.unread { border-color:rgba(217,255,82,.29); box-shadow:inset 0 0 0 1px rgba(217,255,82,.05); }
      .notification-accent { width:4px; margin:-11px 0 -11px -13px; background:#d9ff52; }
      .notification-card.rejected .notification-accent { background:#ff6a62; }
      .notification-card.message .notification-accent { background:#d7e5ad; }
      .notification-card.success .notification-accent { background:#78dc73; }
      .notification-card.warning .notification-accent { background:#e4b954; }
      .notification-copy { min-width:0; flex:1; display:flex; flex-direction:column; gap:5px; }
      .notification-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .notification-heading strong { font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .notification-heading > span { flex:0 0 auto; color:#73816d; font-size:8px; }
      .notification-message { color:#a7b4a0; font-size:10px; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      .notification-arrow { position:absolute; right:11px; top:50%; transform:translateY(-50%); color:#657260; font-size:20px; }
      .notification-card.compact { padding-top:9px; padding-bottom:9px; }
      .notification-card.compact .notification-accent { margin-top:-9px; margin-bottom:-9px; }
      .primary-button,.secondary-button { width:100%; min-height:42px; border-radius:11px; padding:10px 13px; font-size:11px; font-weight:900; cursor:pointer; margin-top:14px; }
      .primary-button { border:0; background:var(--acid); color:#0b1108; }
      .primary-button:hover { filter:brightness(1.05); }
      .secondary-button { border:1px solid rgba(217,255,82,.24); background:#172111; color:#eaf3e5; }
      .feature-card { border:1px solid var(--line); border-radius:15px; padding:14px; background:linear-gradient(145deg,#182311,#10170c); display:flex; gap:12px; align-items:flex-start; }
      .feature-mark { flex:0 0 auto; width:42px; height:42px; border-radius:12px; display:grid; place-items:center; background:rgba(217,255,82,.12); color:var(--acid); font-weight:950; }
      .feature-card div { display:flex; flex-direction:column; gap:5px; }
      .feature-card strong { font-size:12px; }
      .feature-card p { color:#93a28d; font-size:10px; line-height:1.5; }
      .empty-state { min-height:150px; border:1px dashed rgba(217,255,82,.18); border-radius:13px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:20px; color:#879680; }
      .empty-icon { width:40px; height:40px; border-radius:12px; display:grid; place-items:center; background:#172111; color:var(--acid); font-weight:950; margin-bottom:10px; }
      .empty-state strong { color:#dce7d6; font-size:12px; }
      .empty-state p { max-width:230px; font-size:10px; line-height:1.5; margin-top:5px; }
      .jobs-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; margin-bottom:12px; }
      .jobs-summary div { min-width:0; min-height:62px; border:1px solid var(--line); border-radius:12px; background:#11190d; padding:10px 8px; display:flex; flex-direction:column; justify-content:center; gap:3px; }
      .jobs-summary strong { color:var(--acid); font-size:16px; line-height:1; }
      .jobs-summary span { color:#7f8e78; font-size:8px; line-height:1.25; }
      .jobs-tools { display:grid; grid-template-columns:minmax(0,1fr) 104px; gap:7px; margin-bottom:11px; }
      .job-search { height:38px; border:1px solid var(--line); border-radius:10px; background:#10170d; display:flex; align-items:center; gap:7px; padding:0 10px; }
      .job-search span { color:#71806b; font-size:15px; }
      .job-search input { min-width:0; width:100%; border:0; outline:0; background:transparent; color:#edf4e8; font-size:10px; }
      .job-search input::placeholder { color:#667260; }
      .jobs-tools select { height:38px; border:1px solid var(--line); border-radius:10px; background:#10170d; color:#dfe9da; padding:0 8px; font-size:9px; outline:0; }
      .jobs-error { margin-bottom:10px; border:1px solid rgba(255,101,101,.25); border-radius:11px; padding:10px; background:rgba(143,45,45,.14); display:flex; flex-direction:column; gap:3px; }
      .jobs-error strong { color:#ffb4b4; font-size:10px; }
      .jobs-error span { color:#b98f8f; font-size:9px; line-height:1.4; }
      .job-list { display:flex; flex-direction:column; gap:10px; }
      .job-card { content-visibility:auto; contain-intrinsic-size:250px; position:relative; border:1px solid var(--line); border-radius:15px; padding:12px; background:linear-gradient(145deg,#151f10,#0e150b); overflow:hidden; }
      .notification-focus { border-color:var(--acid) !important; box-shadow:0 0 0 3px rgba(217,255,82,.13),0 12px 30px rgba(0,0,0,.3); }
      .job-card.sponsored { border-color:rgba(217,255,82,.38); box-shadow:inset 0 1px 0 rgba(217,255,82,.06); }
      .job-card.sponsored::before { content:''; position:absolute; inset:0 0 auto; height:2px; background:linear-gradient(90deg,var(--acid),transparent); }
      .job-card-top { display:flex; align-items:flex-start; gap:10px; position:relative; }
      .company-badge { flex:0 0 auto; width:38px; height:38px; border-radius:11px; display:grid; place-items:center; background:#26351d; color:var(--acid); font-size:11px; font-weight:950; }
      .job-title-wrap { min-width:0; flex:1; }
      .job-company-line { display:flex; align-items:center; gap:6px; color:#9dac96; font-size:8px; font-weight:700; }
      .job-company-line span:first-child { max-width:170px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .job-company-line span:last-child { color:#d4dd9d; }
      .job-title-wrap h3 { margin:3px 0 2px; color:#f2f7ef; font-size:13px; line-height:1.2; }
      .job-title-wrap p { margin:0; color:#71806a; font-size:8px; }
      .sponsored-tag { flex:0 0 auto; border:1px solid rgba(217,255,82,.25); border-radius:7px; padding:4px 5px; background:rgba(217,255,82,.08); color:var(--acid); font-size:7px; font-weight:900; letter-spacing:.05em; }
      .job-match { min-height:30px; margin:10px 0 8px; border-radius:9px; padding:0 9px; display:flex; align-items:center; gap:6px; background:#10170d; color:#8f9e88; font-size:8px; }
      .job-match strong { flex:1; color:#d7e2d1; font-size:9px; }
      .job-match > span:last-child { color:#75806f; }
      .match-dot { width:7px; height:7px; border-radius:50%; background:#7d8877; }
      .job-match.qualified { background:rgba(74,222,128,.08); }
      .job-match.qualified .match-dot { background:#71d471; box-shadow:0 0 0 3px rgba(113,212,113,.1); }
      .job-match.qualified strong { color:#a9e8a7; }
      .job-match.short { background:rgba(245,179,65,.07); }
      .job-match.short .match-dot { background:#e6b554; }
      .job-match.short strong { color:#e4c98e; }
      .job-facts { display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:5px; }
      .job-facts div { min-width:0; border:1px solid rgba(217,255,82,.08); border-radius:8px; padding:7px; background:rgba(7,11,6,.38); display:flex; flex-direction:column; gap:3px; }
      .job-facts span { color:#687562; font-size:7px; text-transform:uppercase; letter-spacing:.05em; }
      .job-facts strong { color:#dce6d7; font-size:8px; line-height:1.25; overflow-wrap:anywhere; }
      .requirements-row { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
      .requirement-chip { border:1px solid rgba(217,255,82,.12); border-radius:7px; padding:4px 6px; background:#11180e; color:#8e9b88; font-size:7px; font-weight:800; }
      .requirement-chip.met { border-color:rgba(113,212,113,.18); color:#9bd09a; }
      .requirement-chip.unknown { border-color:rgba(150,164,143,.18); color:#8e9b88; }
      .requirement-chip.missing { border-color:rgba(255,126,111,.24); background:rgba(120,42,34,.12); color:#e59a91; }
      .job-description { margin:9px 0 0; color:#8d9c87; font-size:9px; line-height:1.45; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
      .job-actions { display:grid; grid-template-columns:1fr 1.2fr; gap:7px; margin-top:10px; }
      .job-actions button { min-height:34px; border-radius:9px; padding:8px; cursor:pointer; font-size:9px; font-weight:900; }
      .ghost-button { border:1px solid rgba(217,255,82,.15); background:#151e11; color:#c8d5c2; }
      .job-primary { border:0; background:var(--acid); color:#0b1108; }
      .job-loading { display:flex; flex-direction:column; gap:8px; }
      .job-loading span { height:124px; border:1px solid var(--line); border-radius:14px; background:linear-gradient(90deg,#11190d,#172111,#11190d); background-size:220% 100%; animation:jobShimmer 1.2s linear infinite; }
      .spinning { animation:jobSpin .8s linear infinite; }
      @keyframes jobSpin { to { transform:rotate(360deg); } }
      @keyframes jobShimmer { to { background-position:-220% 0; } }
      .application-tabs { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-bottom:10px; }
      .application-tab { min-height:42px; border:1px solid var(--line); border-radius:10px; background:#11190d; color:#8c9987; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; }
      .application-tab span { font-size:8px; font-weight:800; }
      .application-tab strong { color:#dbe6d6; font-size:11px; }
      .application-tab.active { border-color:rgba(217,255,82,.36); background:rgba(217,255,82,.09); color:var(--acid); }
      .application-search { margin-bottom:10px; }
      .application-list,.conversation-list { display:flex; flex-direction:column; gap:8px; }
      .application-card,.conversation-card { content-visibility:auto; contain-intrinsic-size:190px; border:1px solid var(--line); border-radius:14px; background:linear-gradient(145deg,#141d10,#0d130a); padding:12px; }
      .application-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
      .application-card-head > div { min-width:0; }
      .application-company { color:#87947f; font-size:8px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
      .application-card h3 { margin:3px 0 2px; color:#edf5e8; font-size:12px; line-height:1.25; }
      .application-card h3 + p { color:#7d8a77; font-size:8px; }
      .status-pill { flex:0 0 auto; border:1px solid rgba(217,255,82,.14); border-radius:999px; padding:4px 7px; background:#11180e; color:#9aa794; font-size:7px; font-weight:900; text-transform:uppercase; }
      .status-pill.positive,.conversation-response.positive { border-color:rgba(113,212,113,.28); color:#9fe19c; background:rgba(59,126,56,.12); }
      .status-pill.negative,.conversation-response.negative { border-color:rgba(255,106,98,.28); color:#f0a19b; background:rgba(142,55,49,.12); }
      .status-pill.viewed,.conversation-response.viewed { border-color:rgba(120,171,232,.28); color:#a8c9ef; background:rgba(48,86,132,.12); }
      .status-pill.warning,.conversation-response.warning { border-color:rgba(228,185,84,.28); color:#e4c780; background:rgba(120,91,27,.12); }
      .application-meta { display:flex; justify-content:space-between; gap:8px; margin-top:9px; color:#71806b; font-size:8px; }
      .application-note { margin-top:9px; border:1px solid rgba(217,255,82,.08); border-radius:9px; padding:8px; background:rgba(6,10,5,.38); }
      .application-note span { color:#687562; font-size:7px; text-transform:uppercase; }
      .application-note p { margin-top:4px; color:#a9b5a3; font-size:9px; line-height:1.45; white-space:pre-wrap; }
      .application-actions { display:grid; grid-template-columns:1fr 1.15fr; gap:7px; margin-top:10px; }
      .application-actions button { min-height:34px; border-radius:9px; padding:8px; cursor:pointer; font-size:9px; font-weight:900; }
      .applicant-stats,.campaign-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; margin-top:10px; }
      .applicant-stats span,.campaign-stats span { min-width:0; border:1px solid rgba(217,255,82,.08); border-radius:8px; padding:6px 4px; background:rgba(6,10,5,.35); display:flex; flex-direction:column; gap:2px; text-align:center; }
      .applicant-stats small,.campaign-stats small { color:#66715f; font-size:6px; text-transform:uppercase; }
      .applicant-stats strong,.campaign-stats strong { color:#d9e4d4; font-size:8px; overflow:hidden; text-overflow:ellipsis; }
      .campaign-stats { grid-template-columns:repeat(3,1fr); }
      .payment-warning { margin-top:9px; border:1px solid rgba(228,185,84,.2); border-radius:9px; padding:8px; background:rgba(120,91,27,.1); display:flex; justify-content:space-between; color:#dfc77f; font-size:8px; }
      .conversation-card { width:100%; display:flex; gap:10px; text-align:left; color:inherit; cursor:pointer; }
      .conversation-card.unread { border-color:rgba(217,255,82,.32); background:linear-gradient(145deg,rgba(217,255,82,.1),#0d130a); }
      .conversation-avatar { width:36px; height:36px; flex:0 0 auto; border-radius:10px; display:grid; place-items:center; background:rgba(217,255,82,.1); color:var(--acid); font-size:10px; font-weight:950; }
      .conversation-body { min-width:0; flex:1; }
      .conversation-head { display:flex; justify-content:space-between; gap:8px; }
      .conversation-head > div { min-width:0; display:flex; flex-direction:column; gap:2px; }
      .conversation-head strong { color:#e7f0e2; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .conversation-head div span { color:#768370; font-size:8px; }
      .conversation-head > span { color:#66715f; font-size:7px; flex:0 0 auto; }
      .conversation-preview { margin:8px 0; color:#a5b19f; font-size:9px; line-height:1.45; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
      .conversation-preview small { color:#d9ff52; font-size:8px; font-weight:850; }
      .conversation-foot { display:flex; align-items:center; justify-content:space-between; gap:8px; color:#687461; font-size:7px; }
      .conversation-unread { min-width:20px; height:20px; padding:0 6px; border-radius:999px; display:grid; place-items:center; background:var(--acid); color:#091006; font-size:8px; }
      .message-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; margin-bottom:10px; }
      .message-summary span { min-height:58px; border:1px solid var(--line); border-radius:10px; background:#11190d; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; }
      .message-summary strong { color:#eef6ea; font-size:15px; }
      .message-summary small { color:#6f7b69; font-size:7px; text-transform:uppercase; }
      .message-thread-view { min-height:100%; display:grid; grid-template-rows:auto auto minmax(180px,1fr) auto auto; gap:9px; padding-bottom:12px; }
      .message-thread-header { display:grid; grid-template-columns:34px 38px minmax(0,1fr) auto; align-items:center; gap:8px; }
      .thread-back { width:34px; height:34px; border:1px solid var(--line); border-radius:9px; background:#11190d; color:#dbe7d5; cursor:pointer; font-size:24px; line-height:1; }
      .message-thread-header h2 { margin:1px 0; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .message-thread-header p { color:#73806d; font-size:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .message-thread { min-height:180px; overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; border:1px solid var(--line); border-radius:13px; padding:10px; background:radial-gradient(circle at top right,rgba(217,255,82,.05),transparent 38%),#0b1008; display:flex; flex-direction:column; gap:8px; }
      .message-bubble { max-width:86%; border:1px solid var(--line); border-radius:13px; padding:8px 9px; background:#131b10; align-self:flex-start; }
      .message-bubble.mine { align-self:flex-end; border-color:rgba(217,255,82,.24); background:rgba(76,98,38,.28); border-bottom-right-radius:4px; }
      .message-bubble.theirs { border-bottom-left-radius:4px; }
      .message-bubble.system { align-self:center; max-width:94%; background:rgba(117,140,90,.1); color:#9eaa98; text-align:center; }
      .message-bubble-head { display:flex; justify-content:space-between; gap:10px; margin-bottom:5px; }
      .message-bubble-head strong { color:#dfe9da; font-size:8px; }
      .message-bubble-head span,.message-bubble > span { color:#66715f; font-size:6px; }
      .message-bubble p { margin:0; color:#c8d2c3; font-size:9px; line-height:1.48; overflow-wrap:anywhere; }
      .message-bubble-foot { min-height:14px; margin-top:5px; display:flex; justify-content:flex-end; }
      .message-bubble-foot span,.message-bubble-foot button { border:0; background:transparent; color:#75806f; padding:0; font-size:6px; }
      .message-bubble-foot button { color:#d8a07a; cursor:pointer; text-decoration:underline; }
      .application-note-message strong { display:block; margin-bottom:4px; color:var(--acid); font-size:7px; text-transform:uppercase; }
      .hidden-message { border-style:dashed; }
      .thread-empty { margin:auto; display:flex; flex-direction:column; align-items:center; gap:4px; color:#74806d; text-align:center; }
      .thread-empty strong { color:#b9c5b3; font-size:10px; }
      .thread-empty span { font-size:8px; }
      .message-composer { display:grid; grid-template-columns:minmax(0,1fr) 72px; gap:8px; align-items:end; }
      .message-composer label { display:flex; flex-direction:column; gap:4px; }
      .message-composer label > span { color:#aab7a4; font-size:8px; font-weight:850; }
      .message-composer textarea { width:100%; min-height:70px; max-height:150px; resize:vertical; border:1px solid rgba(217,255,82,.16); border-radius:10px; outline:0; background:#0c1209; color:#e5eee0; padding:9px; box-sizing:border-box; font:10px/1.45 Arial,sans-serif; }
      .message-composer textarea:focus { border-color:rgba(217,255,82,.48); box-shadow:0 0 0 3px rgba(217,255,82,.06); }
      .message-composer small { align-self:flex-end; color:#66715f; font-size:6px; }
      .message-composer > button { min-height:44px; }
      .message-privacy-note { display:flex; align-items:flex-start; gap:7px; color:#687461; font-size:7px; line-height:1.4; }
      .message-privacy-note p { margin:0; }
      .conversation-archived-note { border:1px solid rgba(217,255,82,.16); border-radius:10px; padding:10px; background:#11190d; display:flex; flex-direction:column; gap:3px; }
      .conversation-archived-note strong { color:#dce7d7; font-size:9px; }
      .conversation-archived-note span { color:#788572; font-size:8px; line-height:1.4; }
      .message-scope-note { margin-top:10px; border:1px dashed rgba(217,255,82,.15); border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:4px; }
      .message-scope-note strong { color:#cbd7c5; font-size:9px; }
      .message-scope-note span { color:#768370; font-size:8px; line-height:1.4; }
      .job-actions button:disabled,.application-actions button:disabled,.apply-modal-actions button:disabled { opacity:.48; cursor:not-allowed; }
      .applied-button { background:#26331f; color:#b8d0ae; border:1px solid rgba(217,255,82,.18); }
      .danger-button { border:1px solid rgba(255,105,97,.3); background:rgba(128,43,38,.18); color:#f0a39d; }
      .accept-button { border:1px solid rgba(113,212,113,.3); background:rgba(53,119,50,.18); color:#a8e2a5; }
      .application-actions-three { grid-template-columns:1fr 1fr 1fr; }
      .application-actions-four { grid-template-columns:repeat(2,1fr); }
      .modal-backdrop { position:fixed; inset:0; z-index:2147483647; display:grid; place-items:center; padding:18px; background:rgba(2,4,2,.74); backdrop-filter:blur(5px); }
      .apply-modal { width:min(390px,calc(100vw - 24px)); border:1px solid rgba(217,255,82,.22); border-radius:16px; background:linear-gradient(155deg,#182411,#0b1008); box-shadow:0 24px 70px rgba(0,0,0,.72); padding:14px; }
      .apply-modal-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
      .apply-modal-head h2 { margin:3px 0; color:#edf5e8; font-size:16px; }
      .apply-modal-head p { color:#84917d; font-size:9px; }
      .apply-modal-head > button { width:30px; height:30px; border:1px solid var(--line); border-radius:9px; background:#11190d; color:#b9c6b3; cursor:pointer; font-size:18px; }
      .apply-note-label { display:flex; flex-direction:column; gap:6px; margin-top:14px; }
      .apply-note-label > span { color:#c9d5c3; font-size:9px; font-weight:850; }
      .apply-note-label > span small { color:#6f7d69; font-weight:600; }
      .apply-note-label textarea { width:100%; min-height:116px; resize:vertical; border:1px solid rgba(217,255,82,.14); border-radius:10px; outline:0; background:#0c1209; color:#e3ecde; padding:10px; font:10px/1.45 Arial,sans-serif; box-sizing:border-box; }
      .apply-note-label textarea:focus { border-color:rgba(217,255,82,.45); box-shadow:0 0 0 3px rgba(217,255,82,.06); }
      .apply-note-label > small { align-self:flex-end; color:#65715f; font-size:8px; }
      .apply-availability-note { margin-top:10px; border:1px solid rgba(228,185,84,.3); border-radius:10px; padding:10px; background:rgba(120,91,27,.12); display:grid; gap:5px; }
      .apply-availability-note strong { color:#f0d68d; font-size:10px; }
      .apply-availability-note span { color:#a99972; font-size:8px; }
      .apply-availability-note button { justify-self:start; margin-top:2px; }
      .apply-modal-actions { display:grid; grid-template-columns:1fr 1.4fr; gap:8px; margin-top:12px; }
      .apply-modal-actions button { min-height:38px; border-radius:10px; padding:9px; cursor:pointer; font-size:9px; font-weight:900; }
      .apply-modal-actions .job-primary { background:var(--acid); color:#081006; border-color:var(--acid); opacity:1; }
      .apply-modal-actions .job-primary:disabled { background:#36422e; color:#a9b5a3; border-color:#4b5943; opacity:1; }
      .director-home-card { width:100%; margin:10px 0 0; border:1px solid rgba(217,255,82,.18); border-radius:13px; padding:11px 12px; background:linear-gradient(135deg,rgba(217,255,82,.12),rgba(26,42,16,.34)); color:#e9f3e4; display:flex; align-items:center; justify-content:space-between; gap:10px; text-align:left; cursor:pointer; }
      .director-home-card span { display:flex; flex-direction:column; gap:2px; }
      .director-home-card small { color:var(--acid); font-size:7px; font-weight:900; letter-spacing:.08em; }
      .director-home-card strong { font-size:11px; }
      .director-home-card em { color:#7f8d78; font-size:8px; font-style:normal; }
      .director-home-card b { color:var(--acid); font-size:9px; white-space:nowrap; }
      .director-hero { border:1px solid rgba(217,255,82,.2); border-radius:14px; padding:13px; background:linear-gradient(140deg,rgba(217,255,82,.11),rgba(12,20,8,.3)); display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .director-hero h3 { margin:4px 0 2px; color:#edf5e8; font-size:15px; }
      .director-hero p { color:#87957f; font-size:9px; }
      .primary-mini { flex:0 0 auto; min-height:34px; border:0; border-radius:9px; padding:8px 10px; background:var(--acid); color:#0a1007; font-size:8px; font-weight:950; cursor:pointer; }
      .director-stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:10px; }
      .director-stat-grid > * { min-height:72px; border:1px solid var(--line); border-radius:11px; padding:9px; background:#11190d; color:#e5eee0; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:3px; text-align:left; }
      .director-stat-grid button { cursor:pointer; }
      .director-stat-grid span { color:#778670; font-size:7px; text-transform:uppercase; }
      .director-stat-grid strong { color:#eef6ea; font-size:18px; }
      .director-stat-grid small { color:#65715f; font-size:7px; }
      .director-pipeline { margin-top:12px; border:1px solid var(--line); border-radius:13px; padding:10px; background:#10170d; }
      .director-pipeline .section-heading { margin:0 0 8px; }
      .pipeline-row { display:grid; grid-template-columns:58px minmax(0,1fr) 28px; gap:7px; align-items:center; min-height:25px; }
      .pipeline-row > span,.pipeline-row > strong { color:#8b9984; font-size:8px; }
      .pipeline-row > strong { color:#d6e0d1; text-align:right; }
      .pipeline-row > div { height:6px; border-radius:4px; overflow:hidden; background:#263020; }
      .pipeline-row i { display:block; height:100%; border-radius:4px; background:#a9bd55; }
      .pipeline-row.viewed i { background:#759fd1; }
      .pipeline-row.accepted i { background:#74c66e; }
      .pipeline-row.rejected i { background:#d47670; }
      .director-campaign-heading { margin-top:14px; }
      .director-filters { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; margin-bottom:8px; }
      .director-filter { min-width:0; border:1px solid var(--line); border-radius:9px; padding:7px 3px; background:#11190d; color:#7b8974; display:flex; flex-direction:column; gap:2px; align-items:center; cursor:pointer; }
      .director-filter span { font-size:6px; text-transform:uppercase; }
      .director-filter strong { font-size:9px; }
      .director-filter.active { border-color:rgba(217,255,82,.4); background:rgba(217,255,82,.1); color:var(--acid); }
      .talent-filters { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin:8px 0 10px; }
      .talent-filters select { min-width:0; height:38px; border:1px solid var(--line); border-radius:10px; background:#101710; color:#dfe9da; padding:0 8px; font-size:9px; outline:0; }
      .talent-summary { min-height:42px; margin-bottom:9px; border:1px solid var(--line); border-radius:10px; padding:8px 10px; display:flex; align-items:baseline; gap:6px; background:#11190d; }
      .talent-summary strong { color:var(--acid); font-size:18px; }
      .talent-summary span { color:#7f8e78; font-size:8px; }
      .talent-card { content-visibility:auto; contain-intrinsic-size:290px; border:1px solid var(--line); border-radius:14px; padding:12px; background:linear-gradient(145deg,#151f10,#0e150b); display:grid; gap:9px; }
      .talent-card-head { display:grid; grid-template-columns:38px minmax(0,1fr) auto; gap:9px; align-items:center; }
      .talent-avatar { width:38px; height:38px; border-radius:10px; display:grid; place-items:center; overflow:hidden; background:rgba(216,255,81,.11); color:var(--acid); font-size:9px; font-weight:950; }
      .talent-avatar img { width:100%; height:100%; display:block; object-fit:cover; }
      .talent-card-head > div:nth-child(2) { min-width:0; display:flex; flex-direction:column; gap:2px; }
      .talent-card-head strong { color:#f3f5ec; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .talent-card-head span { color:#788570; font-size:7px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .talent-presence { border-radius:999px; padding:4px 6px; border:1px solid rgba(145,160,137,.22); background:rgba(145,160,137,.08); color:#9aa693 !important; font-size:6px !important; font-weight:950; text-transform:uppercase; display:inline-flex; align-items:center; gap:4px; }
      .talent-presence i { width:5px; height:5px; border-radius:50%; background:#6e7869; box-shadow:0 0 0 2px rgba(110,120,105,.12); }
      .talent-presence.online { border-color:rgba(111,223,105,.3); background:rgba(111,223,105,.1); color:#b9f4b5 !important; }
      .talent-presence.online i { background:#6fdf69; box-shadow:0 0 7px rgba(111,223,105,.75); }
      .talent-presence.ready { border-color:rgba(217,255,82,.22); color:#d9ff52 !important; }
      .talent-presence.ready i { background:#d9ff52; }
      .talent-tags { display:flex; flex-wrap:wrap; gap:4px; }
      .talent-tags span { border:1px solid rgba(216,255,81,.13); border-radius:999px; padding:4px 6px; background:rgba(216,255,81,.07); color:#becab8; font-size:7px; }
      .talent-tags .talent-tag-all { border-color:rgba(135,239,177,.28); background:rgba(135,239,177,.12); color:var(--mint); }
      .talent-details { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
      .talent-details > span { min-width:0; border:1px solid rgba(216,255,81,.07); border-radius:8px; padding:7px; background:rgba(6,10,5,.3); display:flex; flex-direction:column; gap:3px; }
      .talent-details small { color:#677261; font-size:6px; text-transform:uppercase; }
      .talent-details strong { color:#d7e1d2; font-size:8px; line-height:1.35; overflow-wrap:anywhere; }
      .talent-bio { color:#96a48f; font-size:8px; line-height:1.5; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
      .talent-actions { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
      .talent-actions .job-primary,.talent-actions .secondary-button { width:100%; min-height:36px; margin:0; }
      .talent-actions button:disabled { opacity:.5; cursor:not-allowed; }
      .campaign-pipeline-mini { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; margin-top:7px; }
      .campaign-pipeline-mini span { border:1px solid rgba(217,255,82,.07); border-radius:7px; padding:5px 3px; background:rgba(5,9,4,.35); display:flex; flex-direction:column; align-items:center; gap:2px; }
      .campaign-pipeline-mini small { color:#64705e; font-size:6px; text-transform:uppercase; }
      .campaign-pipeline-mini strong { color:#d5dfd0; font-size:8px; }
      .campaign-actions { grid-template-columns:1fr 1fr 1fr; }
      .director-footer-actions { display:grid; grid-template-columns:1.15fr 1fr; gap:8px; margin-top:12px; }
      .director-footer-actions .primary-button,.director-footer-actions .secondary-button { margin:0; }
      .settings-card,.status-card,.workstats-card { border:1px solid var(--line); border-radius:14px; background:#11190d; overflow:hidden; }
      .workstats-card { margin-top:12px; padding:14px; display:grid; gap:12px; }
      .workstats-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .workstats-head > div { display:flex; flex-direction:column; gap:3px; min-width:0; }
      .workstats-head strong { font-size:13px; }
      .workstats-head small,.workstats-card > p { color:var(--muted); font-size:10px; line-height:1.45; margin:0; }
      .stats-refresh-button { min-height:38px; flex:0 0 auto; border:1px solid rgba(217,255,82,.3); border-radius:10px; padding:0 12px; background:#1a2711; color:var(--acid); font-size:11px; font-weight:900; cursor:pointer; }
      .stats-refresh-button:disabled { opacity:.62; cursor:wait; }
      .workstats-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; }
      .workstats-grid > span { min-width:0; border:1px solid rgba(217,255,82,.11); border-radius:10px; padding:9px 7px; background:#0b1208; display:flex; flex-direction:column; gap:4px; }
      .workstats-grid small { color:#7f9178; font-size:8px; font-weight:900; letter-spacing:.08em; }
      .workstats-grid strong { color:#eef6e9; font-size:11px; overflow-wrap:anywhere; }
      .inline-warning { border:1px solid rgba(255,174,98,.32); border-radius:9px; padding:8px 9px; background:rgba(91,43,17,.22); color:#ffc69a; font-size:10px; line-height:1.4; }
      .setting-row { min-height:70px; padding:12px; display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid var(--line); cursor:pointer; position:relative; }
      .setting-row:last-child { border-bottom:0; }
      .setting-row > span:first-child { display:flex; flex-direction:column; gap:4px; }
      .setting-row strong { font-size:11px; }
      .setting-row small { color:#82907b; font-size:9px; line-height:1.35; max-width:210px; }
      .eyebrow,.stat-card span,.stat-card small,.notification-heading > span,.jobs-summary span,.application-tab span,.application-company,.application-card h3 + p,.application-meta,.message-summary small,.message-thread-header p,.workstats-grid small { font-size:10px; }
      .job-company-line,.job-title-wrap p,.job-match,.job-facts strong,.application-note span,.applicant-stats small,.campaign-stats small,.applicant-stats strong,.campaign-stats strong,.payment-warning,.conversation-head div span,.conversation-head > span,.conversation-preview small,.conversation-foot,.conversation-unread,.message-bubble-head strong,.message-bubble-head span,.message-bubble > span,.message-bubble-foot span,.message-bubble-foot button,.application-note-message strong,.thread-empty span,.message-composer label > span,.message-composer small,.message-privacy-note,.message-scope-note span,.apply-note-label > small,.director-home-card small,.director-home-card em,.director-stat-grid span,.director-stat-grid small,.pipeline-row > span,.pipeline-row > strong,.director-filter span,.talent-summary span,.talent-card-head span,.talent-tags span,.talent-details small,.talent-details strong,.talent-bio,.campaign-pipeline-mini small,.campaign-pipeline-mini strong { font-size:9px; }
      .sponsored-tag,.status-pill,.talent-presence { font-size:9px !important; }
      .job-search input,.jobs-tools select,.jobs-error span,.job-match strong,.job-description,.job-actions button,.application-note p,.application-actions button,.conversation-preview,.apply-modal-head p,.apply-note-label > span,.apply-modal-actions button,.director-home-card b,.director-hero p,.primary-mini,.director-filter strong,.talent-filters select,.talent-avatar,.setting-row small { font-size:11px; }
      .message-bubble p,.message-composer textarea,.apply-note-label textarea { font-size:12px; }
      .setting-row input { position:absolute; opacity:0; pointer-events:none; }
      .toggle { width:38px; height:22px; border-radius:11px; background:#33402e; position:relative; flex:0 0 auto; transition:.2s ease; }
      .toggle::after { content:''; position:absolute; width:16px; height:16px; top:3px; left:3px; border-radius:50%; background:#9cab95; transition:.2s ease; }
      .setting-row input:checked + .toggle { background:var(--acid); }
      .setting-row input:checked + .toggle::after { transform:translateX(16px); background:#0b1108; }
      .status-card { margin-top:10px; padding:3px 12px; }
      .status-card div { min-height:50px; display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid var(--line); }
      .status-card div:last-child { border-bottom:0; }
      .status-card span { color:#809079; font-size:9px; }
      .status-card strong { max-width:165px; color:#e5eee0; font-size:10px; text-align:right; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .connection-recovery { margin-top:12px; border:1px solid rgba(255,105,105,.32); border-radius:14px; padding:12px; background:rgba(92,23,23,.24); display:grid; gap:7px; }
      .connection-recovery strong { color:#ffb6b6; font-size:12px; }
      .connection-recovery span { color:#c99f9f; font-size:9px; line-height:1.45; }
      .connection-recovery .primary-button { margin-top:3px; }
      .connection-diagnostics { margin-top:12px; }
      .connection-diagnostics > summary { min-height:44px; border:1px solid var(--line); border-radius:12px; padding:0 12px; background:#11190d; color:#b9c7b2; font-size:10px; font-weight:900; cursor:pointer; display:flex; align-items:center; justify-content:space-between; list-style:none; }
      .connection-diagnostics > summary::-webkit-details-marker { display:none; }
      .connection-diagnostics > summary::after { content:'＋'; color:var(--acid); }
      .connection-diagnostics[open] > summary::after { content:'−'; }
      .panel-footer { min-height:40px; padding:0 14px; border-top:1px solid var(--line); background:#090e07; display:flex; align-items:center; justify-content:space-between; color:#64715f; font-size:9px; }
      .panel-footer button { border:0; background:transparent; color:#a9ba9f; font-size:9px; font-weight:800; cursor:pointer; }
      @media (pointer:coarse) {
        .header-actions button,.icon-action { width:44px; height:44px; }
        .text-action,.conversation-open,.panel-footer button { min-height:44px; display:inline-flex; align-items:center; }
        .job-actions button,.application-actions button,.apply-modal-actions button,.primary-mini { min-height:44px; }
        .setting-row { min-height:76px; }
      }
      @media (max-width:760px), (pointer:coarse) and (max-width:1024px) {
        input,textarea,select { font-size:16px !important; }
        .launcher {
          right:max(10px,env(safe-area-inset-right)); top:auto;
          bottom:max(78px,calc(env(safe-area-inset-bottom) + 66px));
          width:56px; min-height:56px; border:1px solid rgba(217,255,82,.55);
          border-radius:50%; padding:6px; box-shadow:0 12px 32px rgba(0,0,0,.58);
        }
        .launcher[data-side="left"],.launcher[data-side="right"] { border:1px solid rgba(217,255,82,.55); border-radius:50%; }
        .launcher-logo { width:42px; height:42px; border-radius:50%; }
        .launcher-text { display:none; }
        .launcher-badge { position:absolute; top:-4px; right:-3px; box-shadow:0 0 0 3px #0b1108; }
        .launcher.panel-open { transform:translateY(18px); }
        .panel {
          left:var(--jc-visible-left,0px); right:auto; top:var(--jc-visible-top,0px); bottom:auto;
          width:var(--jc-visible-width,100vw); max-width:none; height:var(--jc-visible-height,100dvh); min-height:320px;
          border-left:0; border-right:0; border-bottom:0; border-radius:0;
          grid-template-rows:auto minmax(0,1fr); box-shadow:none;
          transform:translateY(22px) scale(.985); transform-origin:bottom center;
        }
        .panel.open { transform:translateY(0) scale(1); }
        .panel-header {
          min-height:calc(64px + env(safe-area-inset-top));
          padding:calc(9px + env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 9px max(12px,env(safe-area-inset-left));
          touch-action:pan-y;
        }
        .brand-mark { width:40px; height:40px; }
        .brand strong { font-size:16px; }
        .panel-body { min-height:0; grid-template-columns:minmax(0,1fr); grid-template-rows:minmax(0,1fr) auto; }
        .panel-content { grid-column:1; grid-row:1; touch-action:pan-y; }
        .panel-nav {
          grid-column:1; grid-row:2; order:2; flex-direction:row; gap:4px;
          min-height:calc(66px + env(safe-area-inset-bottom));
          padding:6px max(7px,env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom)) max(7px,env(safe-area-inset-left));
          border-right:0; border-top:1px solid var(--line); overflow-x:auto; overflow-y:hidden;
          scrollbar-width:none; touch-action:pan-x; scroll-snap-type:x proximity;
          background:rgba(8,13,6,.96); backdrop-filter:blur(18px);
        }
        .panel-nav::-webkit-scrollbar { display:none; }
        .nav-button { flex:1 0 54px; min-width:54px; min-height:52px; padding:5px 3px; scroll-snap-align:center; }
        .nav-icon { font-size:17px; }
        .nav-label { font-size:10px; }
        .nav-badge { top:2px; right:3px; }
        .panel-footer { display:none; }
        .view-section { padding:14px max(12px,env(safe-area-inset-right)) 24px max(12px,env(safe-area-inset-left)); }
        .view-heading { margin-bottom:10px; }
        h2 { font-size:20px; }
        .view-description { font-size:11px; }
        .application-tabs,.director-filters { overflow-x:auto; grid-template-columns:none; display:flex; scrollbar-width:none; scroll-snap-type:x proximity; padding-bottom:2px; }
        .application-tabs::-webkit-scrollbar,.director-filters::-webkit-scrollbar { display:none; }
        .application-tab { flex:1 0 105px; scroll-snap-align:start; }
        .director-filter { flex:1 0 78px; scroll-snap-align:start; }
        .modal-backdrop {
          place-items:end center; padding:0 max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));
        }
        .apply-modal {
          width:100%; max-height:calc(var(--jc-visible-height,100dvh) - 16px - env(safe-area-inset-top));
          overflow-y:auto; border-radius:18px 18px 12px 12px; padding:16px;
        }
        .apply-note-label textarea { min-height:96px; max-height:30vh; font-size:16px; }
        .apply-modal-actions { position:sticky; bottom:0; z-index:2; padding-top:10px; padding-bottom:max(2px,env(safe-area-inset-bottom)); background:linear-gradient(transparent,#0b1008 18%); }
        .job-card,.application-card,.conversation-card { border-radius:12px; }
        .campaign-actions { grid-template-columns:1fr; }
        .director-stat-grid { grid-template-columns:1fr 1fr; }
        .message-thread-view { height:100%; min-height:0; grid-template-rows:auto auto minmax(120px,1fr) auto auto; padding-bottom:calc(10px + env(safe-area-inset-bottom)); }
        .message-thread { min-height:120px; }
        .message-composer { position:sticky; bottom:0; padding-top:7px; background:linear-gradient(transparent,#0b1008 18%); }
        .message-composer textarea { min-height:64px; font-size:16px; }
      }
      @media (max-width:390px) {
        .job-actions,.application-actions,.application-actions-three,.application-actions-four,.campaign-actions,.apply-modal-actions,.director-footer-actions { grid-template-columns:1fr; }
        .stat-grid,.director-stat-grid,.workstats-grid,.talent-details { grid-template-columns:1fr 1fr; }
        .workstats-head { align-items:flex-start; flex-direction:column; }
        .stats-refresh-button { width:100%; }
        .director-hero { align-items:flex-start; flex-direction:column; }
        .primary-mini { width:100%; }
        .brand span { font-size:10px; }
      }
      @media (max-width:760px) and (orientation:landscape) and (max-height:520px) {
        .panel-header { min-height:calc(54px + env(safe-area-inset-top)); padding-top:calc(5px + env(safe-area-inset-top)); padding-bottom:5px; }
        .brand-mark { width:36px; height:36px; border-radius:10px; }
        .brand span { display:none; }
        .panel-nav { min-height:calc(52px + env(safe-area-inset-bottom)); padding-top:3px; padding-bottom:calc(3px + env(safe-area-inset-bottom)); }
        .nav-button { min-height:42px; flex-basis:48px; }
        .nav-label { display:none; }
        .nav-icon { font-size:19px; }
        .view-section { padding-top:10px; padding-bottom:16px; }
        .modal-backdrop { place-items:center; }
        .apply-modal { max-width:520px; border-radius:16px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .panel,.panel-backdrop,.launcher,.stat-card,.toggle,.toggle::after { transition:none !important; }
      }
    `;
  }

  function bindPanelEvents() {
    if (!panelRoot || panelRoot.__jobCentreBound) return;
    panelRoot.__jobCentreBound = true;

    panelRoot.addEventListener("click", (event) => {
      const target = event.target?.closest?.("button");
      if (!target) return;
      if (target.id === "jc-launcher" && Date.now() < launcherSuppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const view = target.dataset?.view;
      if (view) {
        setActiveView(view);
        return;
      }

      const notificationId = target.dataset?.notificationId;
      if (notificationId) {
        const item = inbox.find((entry) => entry.id === notificationId);
        openNotification(item);
        return;
      }

      const openPath = target.dataset?.openPath;
      if (openPath) {
        openJobCentre(openPath);
        return;
      }

      const profileId = target.dataset?.profileId;
      if (profileId) {
        window.open(
          `https://www.torn.com/profiles.php?XID=${encodeURIComponent(profileId)}`,
          "_blank",
        );
        return;
      }

      const applicationTab = target.dataset?.applicationTab;
      if (["outgoing", "incoming", "archive", "campaigns"].includes(applicationTab)) {
        panelDataState.applicationTab = applicationTab;
        if (target.dataset?.view === "applications") panelState.activeView = "applications";
        renderPanel();
        return;
      }

      const directorFilter = target.dataset?.directorFilter;
      if (["all", "active", "attention", "closed"].includes(directorFilter)) {
        panelDataState.directorFilter = directorFilter;
        panelState.activeView = "director";
        panelState.open = true;
        savePanelState();
        renderPanel();
        return;
      }

      const action = target.dataset?.action;
      if (action === "open-conversation") {
        openConversation(
          target.dataset?.conversationType,
          target.dataset?.conversationId,
        );
        return;
      }
      if (action === "message-talent") {
        startTalentConversation(target.dataset?.candidateId);
        return;
      }
      if (action === "close-conversation") {
        closeConversation();
        return;
      }
      if (action === "send-message") {
        sendConversationMessage();
        return;
      }
      if (action === "report-message") {
        reportConversationMessage(target.dataset?.messageId);
        return;
      }
      if (action === "open-apply") {
        openApplyModal(target.dataset?.jobId);
        return;
      }
      if (action === "view-campaign") {
        focusJobInPanel(target.dataset?.jobId);
        return;
      }
      if (action === "cancel-apply") {
        closeApplyModal();
        return;
      }
      if (action === "submit-apply") {
        submitApplication();
        return;
      }
      if (action === "show-my-application") {
        panelDataState.applicationTab = "outgoing";
        setActiveView("applications");
        return;
      }
      if (action === "withdraw-application") {
        const id = Number(target.dataset?.applicationId);
        if (
          id > 0 &&
          confirmPanelAction(
            `withdraw:${id}`,
            "Withdraw this application? It will move to both parties’ archive.",
          )
        ) {
          performPanelAction(
            { action: "withdraw", applicationId: id },
            { busyKey: `withdraw:${id}`, successMessage: "Application withdrawn." },
          );
        }
        return;
      }
      if (action === "set-campaign-status") {
        const id = Number(target.dataset?.jobId);
        const status = String(target.dataset?.status || "");
        const messages = {
          close: "Close this advert? It will disappear from live job searches until reopened.",
          reopen: "Reopen this advert for the remainder of its paid listing period?",
        };
        if (
          id > 0 &&
          messages[status] &&
          confirmPanelAction(`campaign:${id}:${status}`, messages[status])
        ) {
          performPanelAction(
            { action: "campaign-status", jobId: id, campaignStatus: status },
            {
              busyKey: `campaign:${id}`,
              successMessage: status === "close" ? "Campaign closed." : "Campaign reopened.",
            },
          );
        }
        return;
      }
      if (action === "set-application-status") {
        const id = Number(target.dataset?.applicationId);
        const status = String(target.dataset?.status || "");
        const messages = {
          viewed: "Mark this application as viewed?",
          accepted: "Accept this applicant? They will be notified immediately.",
          rejected: "Reject this applicant? They will be notified immediately.",
        };
        if (
          id > 0 &&
          messages[status] &&
          (status === "viewed" ||
            confirmPanelAction(`application:${id}:${status}`, messages[status]))
        ) {
          performPanelAction(
            { action: "set-status", applicationId: id, status },
            {
              busyKey: `status:${id}`,
              successMessage: `Application ${actionLabel(status)}.`,
            },
          );
        }
        return;
      }

      switch (target.dataset?.action) {
        case "toggle-panel":
          setPanelOpen(!panelState.open);
          break;
        case "close-panel":
          setPanelOpen(false);
          break;
        case "poll":
          fetchNotifications({ manual: true });
          break;
        case "refresh-jobs":
          fetchJobs({ force: true, manual: true });
          break;
        case "refresh-panel-data":
          fetchPanelData({ force: true, manual: true });
          break;
        case "refresh-stats":
          refreshWorkstats({ manual: true });
          break;
        case "refresh-talent":
          fetchTalent({ force: true, manual: true });
          break;
        case "server-test":
          fetchNotifications({ selfTest: true });
          break;
        case "reconnect":
          reconnectNotifier();
          break;
        case "mark-all":
          markAllNotificationsRead();
          break;
        case "open-main":
          openJobCentre();
          break;
      }
    });

    panelRoot.addEventListener("input", (event) => {
      const input = event.target;
      if (!input?.dataset) return;
      let selector = null;
      if ("jobSearch" in input.dataset) {
        jobsState.query = String(input.value || "");
        selector = "[data-job-search]";
      } else if ("panelSearch" in input.dataset) {
        panelDataState.query = String(input.value || "");
        selector = "[data-panel-search]";
      } else if ("directorSearch" in input.dataset) {
        panelDataState.directorQuery = String(input.value || "");
        selector = "[data-director-search]";
      } else if ("talentSearch" in input.dataset) {
        talentState.query = String(input.value || "");
        selector = "[data-talent-search]";
      } else if ("applyNote" in input.dataset) {
        actionState.applyNote = String(input.value || "").slice(0, 500);
        selector = "[data-apply-note]";
      } else if ("messageDraft" in input.dataset) {
        messageState.draft = String(input.value || "").slice(0, MESSAGE_MAX_LENGTH);
        selector = "[data-message-draft]";
      } else {
        return;
      }
      renderPanel();
      const nextInput = panelRoot.querySelector?.(selector);
      if (nextInput && typeof nextInput.focus === "function") {
        nextInput.focus();
        if (typeof nextInput.setSelectionRange === "function") {
          const length = nextInput.value.length;
          nextInput.setSelectionRange(length, length);
        }
      }
    });

    panelRoot.addEventListener("change", (event) => {
      const input = event.target;
      if (input?.dataset && "jobFilter" in input.dataset) {
        jobsState.filter = String(input.value || "all");
        renderPanel();
        return;
      }
      if (input?.dataset && "talentCompany" in input.dataset) {
        talentState.companyType = String(input.value || "all");
        renderPanel();
        return;
      }
      if (input?.dataset && "talentTraining" in input.dataset) {
        talentState.trainingPlan = String(input.value || "all");
        renderPanel();
        return;
      }
      const setting = input?.dataset?.setting;
      if (!setting || !(setting in DEFAULT_PANEL_SETTINGS)) return;
      panelSettings[setting] = Boolean(input.checked);
      savePanelSettings();
      if (setting === "startOpen" && panelSettings.startOpen) {
        panelState.open = true;
        savePanelState();
      }
      renderPanel();
    });


    panelRoot.addEventListener("pointerdown", (event) => {
      const launcher = event.target?.closest?.("#jc-launcher");
      if (!launcher || panelState.open) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const rect = launcher.getBoundingClientRect();
      launcherDrag = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        lastX: rect.left,
        lastY: rect.top,
        moved: false,
      };
      launcher.classList.add("dragging");
      try {
        launcher.setPointerCapture?.(event.pointerId);
      } catch {
        // Continue with pointer events when this browser cannot capture them.
      }
    });

    panelRoot.addEventListener(
      "pointermove",
      (event) => {
        const drag = launcherDrag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        const distance = Math.hypot(
          event.clientX - drag.startClientX,
          event.clientY - drag.startClientY,
        );
        if (!drag.moved && distance < 7) return;
        drag.moved = true;
        const next = clampLauncherDragPosition(
          event.clientX - drag.offsetX,
          event.clientY - drag.offsetY,
        );
        drag.lastX = next.x;
        drag.lastY = next.y;
        applyLauncherPosition({
          ...next,
          side: next.x + next.dimensions.width / 2 < next.viewport.width / 2
            ? "left"
            : "right",
        });
        event.preventDefault();
      },
      { passive: false },
    );

    panelRoot.addEventListener("pointerup", (event) => {
      finishLauncherDrag(event);
    });

    panelRoot.addEventListener("pointercancel", (event) => {
      finishLauncherDrag(event, true);
    });

    panelRoot.addEventListener("lostpointercapture", (event) => {
      finishLauncherDrag(event);
    });


    panelRoot.addEventListener("focusin", (event) => {
      const control = event.target;
      if (control?.matches?.("input, textarea, select")) focusMobileControl(control);
    });

    panelRoot.addEventListener(
      "touchstart",
      (event) => {
        const header = event.target?.closest?.(".panel-header");
        const touch = event.touches?.[0];
        if (!header || !touch || !panelState.open || !mobilePanelMode()) return;
        headerSwipe = {
          x: touch.clientX,
          y: touch.clientY,
          startedAt: Date.now(),
        };
      },
      { passive: true },
    );

    panelRoot.addEventListener(
      "touchend",
      (event) => {
        const start = headerSwipe;
        headerSwipe = null;
        const touch = event.changedTouches?.[0];
        if (!start || !touch) return;
        const horizontal = touch.clientX - start.x;
        const vertical = Math.abs(touch.clientY - start.y);
        const elapsed = Date.now() - start.startedAt;
        if (horizontal > 78 && vertical < 56 && elapsed < 650) {
          setPanelOpen(false);
        }
      },
      { passive: true },
    );
  }

  function initPanel() {
    try {
      const root = document.body || document.documentElement;
      if (!root || typeof document.createElement !== "function") return false;
      if (panelRoot && panelHost) {
        if (!panelHost.isConnected || panelHost.parentElement !== root) {
          root.appendChild(panelHost);
        }
        preparePanelHost(panelHost);
        syncViewportMetrics();
        return true;
      }

      const existing = document.getElementById(PANEL_HOST_ID);
      const host = existing || document.createElement("div");
      if (!host.shadowRoot && typeof host.attachShadow !== "function") return false;
      host.id = PANEL_HOST_ID;
      if (!existing || host.parentElement !== root) root.appendChild(host);
      preparePanelHost(host);

      panelHost = host;
      panelRoot = host.shadowRoot || host.attachShadow({ mode: "open" });
      panelRoot.innerHTML = `<style>${panelStyles()}</style><div id="jc-app"></div>`;
      mobileMediaQuery =
        typeof window.matchMedia === "function"
          ? window.matchMedia(MOBILE_MEDIA_QUERY)
          : null;
      syncViewportMetrics();
      bindPanelEvents();
      renderPanel();

      if (typeof window.addEventListener === "function") {
        window.addEventListener("resize", scheduleViewportSync, { passive: true });
        window.addEventListener("orientationchange", scheduleViewportSync, { passive: true });
        window.visualViewport?.addEventListener?.("resize", scheduleViewportSync, {
          passive: true,
        });
        window.visualViewport?.addEventListener?.("scroll", scheduleViewportSync, {
          passive: true,
        });
        mobileMediaQuery?.addEventListener?.("change", scheduleViewportSync);
        window.addEventListener("keydown", (event) => {
          if (event.key !== "Escape") return;
          if (actionState.applyJob) closeApplyModal();
          else if (messageState.selectedConversationId && panelState.activeView === "messages") closeConversation();
          else if (panelState.open) setPanelOpen(false);
        });
      }
      return true;
    } catch (error) {
      console.warn("[JobCentre+] Could not initialise the companion panel:", error);
      panelHost = null;
      panelRoot = null;
      return false;
    }
  }

  function preparePanelHost(host) {
    if (!host?.style) return;
    host.style.setProperty("display", "block", "important");
    host.style.setProperty("visibility", "visible", "important");
    host.style.setProperty("position", "fixed", "important");
    host.style.setProperty("inset", "0 auto auto 0", "important");
    host.style.setProperty("width", "0", "important");
    host.style.setProperty("height", "0", "important");
    host.style.setProperty("overflow", "visible", "important");
    host.style.setProperty("pointer-events", "none", "important");
    host.style.setProperty("z-index", "2147483647", "important");
  }

  function ensurePanelMounted() {
    const preferredRoot = document.body || document.documentElement;
    if (
      panelHost?.isConnected &&
      panelRoot &&
      (!document.body || panelHost.parentElement === preferredRoot)
    ) {
      preparePanelHost(panelHost);
      return true;
    }
    return initPanel();
  }

  function renderPanel() {
    if (!panelRoot && !initPanel()) return;
    const app = panelRoot.getElementById("jc-app");
    if (!app) return;

    const content = panelRoot.querySelector?.(".panel-content");
    const navigation = panelRoot.querySelector?.(".panel-nav");
    const diagnostics = panelRoot.querySelector?.(".connection-diagnostics");
    const preserveContentScroll = lastRenderedView === panelState.activeView;
    const renderState = {
      contentTop: preserveContentScroll ? Number(content?.scrollTop) || 0 : 0,
      contentLeft: preserveContentScroll ? Number(content?.scrollLeft) || 0 : 0,
      navigationTop: Number(navigation?.scrollTop) || 0,
      navigationLeft: Number(navigation?.scrollLeft) || 0,
      diagnosticsOpen: Boolean(diagnostics?.open),
    };

    app.innerHTML = panelMarkup();
    lastRenderedView = panelState.activeView;
    applyLauncherPosition();

    const nextContent = panelRoot.querySelector?.(".panel-content");
    const nextNavigation = panelRoot.querySelector?.(".panel-nav");
    if (preserveContentScroll && nextContent) {
      nextContent.scrollTop = renderState.contentTop;
      nextContent.scrollLeft = renderState.contentLeft;
    }
    if (nextNavigation) {
      nextNavigation.scrollTop = renderState.navigationTop;
      nextNavigation.scrollLeft = renderState.navigationLeft;
    }
    if (renderState.diagnosticsOpen) {
      const nextDiagnostics = panelRoot.querySelector?.(
        ".connection-diagnostics",
      );
      if (nextDiagnostics) nextDiagnostics.open = true;
    }

    if (messageState.scrollToBottom) {
      messageState.scrollToBottom = false;
      const thread = panelRoot.querySelector?.("[data-message-thread]");
      if (thread) {
        const scroll = () => {
          thread.scrollTop = thread.scrollHeight;
        };
        if (typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(scroll);
        } else {
          scroll();
        }
      }
    }
  }

  registerOptionalMenuCommand("JC+: Toggle panel", function () {
    if (!panelRoot) initPanel();
    setPanelOpen(!panelState.open);
  });

  registerOptionalMenuCommand("JC+: Send local test notification", function () {
    displayNotification({
      title: "JC+: Local test ran",
      text: "The userscript command is working. This Torn banner remains visible even if browser notifications are blocked.",
      onclick: function () {
        openJobCentre();
      },
      tone: "success",
    });
  });

  registerOptionalMenuCommand("JC+: Run server round-trip test", function () {
    fetchNotifications({ selfTest: true });
  });

  registerOptionalMenuCommand("JC+: Poll now", function () {
    fetchNotifications({ manual: true });
  });

  registerOptionalMenuCommand("JC+: Show notifier status", function () {
    const lastAttempt = pollState.lastAttemptAt
      ? pollState.lastAttemptAt.toLocaleTimeString()
      : "never";
    const lastSuccess = pollState.lastSuccessAt
      ? pollState.lastSuccessAt.toLocaleTimeString()
      : "never";
    const status = pollState.lastStatus ?? "network error";
    const player = pollState.playerName ? ` for ${pollState.playerName}` : "";
    displayNotification({
      title: `JC+: Notifier status${player}`,
      text: pollState.lastError
        ? `Last attempt ${lastAttempt}; ${status}; ${pollState.lastError}`
        : `Connected. Last success ${lastSuccess}; HTTP ${status}.`,
      tone: pollState.lastError ? "error" : "success",
    });
  });

  ensurePanelMounted();
  document.addEventListener?.("DOMContentLoaded", ensurePanelMounted, { once: true });
  document.addEventListener?.("visibilitychange", () => {
    if (!document.hidden) ensurePanelMounted();
  });
  window.addEventListener?.("pageshow", ensurePanelMounted);
  if (panelState.activeView === "jobs" || panelState.open) fetchJobs();
  if (
    panelState.activeView === "applications" ||
    panelState.activeView === "messages"
  ) {
    fetchPanelData();
  }
  if (panelState.activeView === "talent") fetchTalent();
  fetchNotifications();
  if (panelState.open) window.setTimeout(maybeAutoRefreshStats, 800);
  setInterval(fetchNotifications, POLL_INTERVAL);
  setInterval(ensurePanelMounted, 2000);

  console.log(`[JobCentre+] Companion panel v${SCRIPT_VERSION} active.`);
})();
