// ==UserScript==
// @name         MoDuL's: Custom Race Filter
// @namespace    modul.torn.racing
// @version      2.4.1
// @description  Custom Race filter. (OG Car Names & PDA Compatible)
// @author       MoDuL
// @copyright    2026 MoDuL. All rights reserved.
// @license      All Rights Reserved
// @match        https://www.torn.com/page.php?sid=racing*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow
// @connect      pp-api.sokin.xyz
// @connect      modulah.github.io
// @run-at       document-idle
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @downloadURL https://update.greasyfork.org/scripts/562954/MoDuL%27s%3A%20Custom%20Race%20Filter%20%28PDA%20compatible%29.user.js
// @updateURL https://update.greasyfork.org/scripts/562954/MoDuL%27s%3A%20Custom%20Race%20Filter%20%28PDA%20compatible%29.meta.js
// ==/UserScript==

/*
Copyright (c) 2026 MoDuL. All rights reserved.
Unauthorized copying, modification, redistribution, or commercial use is prohibited without written permission.
*/

(function () {
  "use strict";

var VERSION = "2.4.1";
  var TAG = "[MoDuL's: Custom Race Filter v" + VERSION + "]";
  try { console.log(TAG, "Loaded ✅"); } catch (e) {}

  const LICENSE_PRODUCT = "custom-race-filter";
  const LICENSE_API_BASE_URL = "https://pp-api.sokin.xyz";
  const UPDATE_NOTICE_URL = "https://modulah.github.io/custom-race-filter/update-notice.html";
  const DISCORD_INVITE_URL = "https://discord.gg/cR8ZTU6V58";
  const FORUM_POST_URL = "https://www.torn.com/forums.php#/p=threads&f=67&t=16533183";
  const LICENSE_STATUS_CACHE_TTL_MS = 5 * 60 * 1000;

  const STORE = {
    license: "modul_racefilter_license_v1",
    settings: "modul_racefilter_settings_v1",
    ui: "modul_racefilter_ui_v1", // collapse state persisted for everyone
    updateNoticeSeen: "modul_racefilter_update_notice_seen_v1",
    licenseStatusCache: "modul_racefilter_license_status_cache_v1"
  };

  const BATCH_SIZE = 22;
  const DEBOUNCE_MS = 220;

  const TRACKS = [
    "Any", "Commerce", "Convict", "Docks", "Hammerhead", "Industrial", "Meltdown", "Mudpit",
    "Parkland", "Sewage", "Speedway", "Stone Park", "Two Islands", "Underdog", "Uptown", "Vector", "Withdrawal"
  ];

  const CARCLASS_OPTIONS = [
    "Any",
    "A", "B", "C", "D", "E",
    "Stock A", "Stock B", "Stock C", "Stock D", "Stock E",
    "Stormatti Casteon",
    "Veloria LFA",
    "Mercia SLR",
    "Weston Marlin 177",
    "Lambrini Torobravo",
    "Volt GT",
    "Lolo 458",
    "Zaibatsu GT-R",
    "Echo R8",
    "Edomondo NSX",
    "Tsubasa Impressor",
    "Echo S4",
    "Volt MNG",
    "Dart Rampager",
    "Yotsuhada EVX",
    "Bavaria M5",
    "Cosmos EX",
    "Sturmfahrt 111",
    "Colina Tanprice",
    "Wington GGU",
    "Volt RS",
    "Oceania SS",
    "Edomondo IR",
    "Chevalier CZ06",
    "Edomondo S2",
    "Nano Cavalier",
    "Knight Firebrand",
    "Bavaria Z8",
    "Echo Quadrato",
    "Echo S3",
    "Tabata RM2",
    "Invader H3",
    "Bavaria X5",
    "Bedford Nova",
    "Verpestung Insecta",
    "Verpestung Sport",
    "Chevalier CVR",
    "Alpha Milano 156",
    "Coche Basurero",
    "Edomondo ACD",
    "Limoen Saxon",
    "Papani Colé",
    "Edomondo Localé",
    "Çagoutte 10-6",
    "Zaibatsu Macro",
    "Trident",
    "Stålhög 860",
    "Nano Pioneer",
    "Vita Bravo",
    "Bedford Racer"
  ];

  const CAR_FICTIONAL_TO_REAL = {
    "Yotsuhada EVX": "Mitsubishi Evo X",
    "Stålhög 860": "Volvo 850",
    "Stalhog 860": "Volvo 850",
    "Alpha Milano 156": "Alfa Romeo 156",
    "Bavaria X5": "BMW X5",
    "Coche Basurero": "Seat Leon Cupra",
    "Bedford Nova": "Vauxhall Astra GSI",
    "Verpestung Sport": "Volkswagen Golf GTI",
    "Echo S3": "Audi S3",
    "Volt RS": "Ford Focus RS",
    "Edomondo S2": "Honda S2000",
    "Nano Cavalier": "Mini Cooper S",
    "Colina Tanprice": "Ford Sierra Cosworth",
    "Cosmos EX": "Lotus Exige",
    "Bedford Racer": "Vauxhall Corsa",
    "Sturmfahrt 111": "Porsche 911 GT3",
    "Tsubasa Impressor": "Subaru Impreza STI",
    "Wington GGU": "TVR Sagaris",
    "Weston Marlin 177": "Aston Martin One-77",
    "Echo R8": "Audi R8",
    "Stormatti Casteon": "Bugatti Veyron",
    "Lolo 458": "Ferrari 458",
    "Lambrini Torobravo": "Lamborghini Gallardo",
    "Veloria LFA": "Lexus LFA",
    "Mercia SLR": "Mercedes SLR",
    "Zaibatsu GT-R": "Nissan GT-R",
    "Edomondo Localé": "Honda Civic",
    "Edomondo Locale": "Honda Civic",
    "Edomondo NSX": "Honda NSX",
    "Echo Quadrato": "Audi TT Quattro",
    "Bavaria M5": "BMW M5",
    "Bavaria Z8": "BMW Z8",
    "Chevalier CZ06": "Chevrolet Corvette Z06",
    "Dart Rampager": "Dodge Charger",
    "Knight Firebrand": "Pontiac Firebird",
    "Volt GT": "Ford GT",
    "Invader H3": "Hummer H3",
    "Echo S4": "Audi S4",
    "Edomondo IR": "Honda Integra Type R",
    "Edomondo ACD": "Honda Accord",
    "Tabata RM2": "Toyota MR2",
    "Verpestung Insecta": "Volkswagen Beetle",
    "Chevalier CVR": "Chevrolet Cavalier",
    "Volt MNG": "Ford Mustang",
    "Trident": "Reliant Robin",
    "Oceania SS": "Holden SS",
    "Limoen Saxon": "Citroen Saxo",
    "Nano Pioneer": "Classic Mini",
    "Vita Bravo": "Fiat Punto",
    "Zaibatsu Macro": "Nissan Micra",
    "Çagoutte 10-6": "Peugeot 106",
    "Cagoutte 10-6": "Peugeot 106",
    "Papani Colé": "Renault Clio",
    "Papani Cole": "Renault Clio"
  };

  const CAR_CLASS_FIXED_OPTIONS = ["Any", "A", "B", "C", "D", "E", "Stock A", "Stock B", "Stock C", "Stock D", "Stock E"];

  const POPULARITY_MIN_OPTS = [
    { v: "Any", label: "Any" },
    { v: "10", label: "≥ 10%" },
    { v: "30", label: "≥ 30%" },
    { v: "50", label: "≥ 50%" },
    { v: "70", label: "≥ 70%" }
  ];

  const START_MAX_OPTS = [
    { v: "Any", label: "Any" },
    { v: "0", label: "Now/Waiting" },
    { v: "5", label: "≤ 5m" },
    { v: "10", label: "≤ 10m" },
    { v: "15", label: "≤ 15m" },
    { v: "30", label: "≤ 30m" },
    { v: "60", label: "≤ 1h" },
    { v: "120", label: "≤ 2h" },
    { v: "240", label: "≤ 4h" },
    { v: "480", label: "≤ 8h" },
    { v: "720", label: "≤ 12h" }
  ];

  const JLT_LEAGUE_OPTS = [{ v: "Any", label: "Any" }]
    .concat(Array.from({ length: 7 }, (_, i) => ({ v: `L${i}`, label: `L${i}` })));

  const JLT_GROUP_OPTS = [{ v: "Any", label: "Any" }]
    .concat("ABCDEFGHIJKLMNOP".split("").map(letter => ({ v: letter, label: letter })));

  const DEFAULTS = {
    enabled: true,
    track: "Any",
    laps: "Any",
    lapsMode: "exact",
    useRealCarNames: false,
    advOpen: true,
    pw: "Any",
    urt: "Any",
    jltLeague: "Any",
    jltGroup: "Any",
    carClass: "Any",
    startMax: "Any",
    popMin: "Any",
    bet: "Any",
    showFull: true
  };

  const SUPPORTER_SETTING_KEYS = ["advOpen", "pw", "urt", "jltLeague", "jltGroup", "carClass", "startMax", "popMin", "bet", "showFull"];

  const UI_DEFAULTS = { collapsed: false };

  const hasLegacyGM = (typeof GM_getValue === "function" && typeof GM_setValue === "function");
  const hasModernGM = (typeof GM === "object" && !!GM);
  const hasModernGMGet = !!(hasModernGM && typeof GM.getValue === "function");
  const hasModernGMSet = !!(hasModernGM && typeof GM.setValue === "function");

  function lsGetRaw(key) {
    try { return window.localStorage ? window.localStorage.getItem(key) : null; }
    catch (_) { return null; }
  }

  function lsGet(key, def) {
    const raw = lsGetRaw(key);
    return raw == null ? def : raw;
  }

  function lsSet(key, val) {
    try {
      if (!window.localStorage) return false;
      window.localStorage.setItem(key, String(val));
      return true;
    } catch (_) {
      return false;
    }
  }

  function lsRemove(key) {
    try {
      if (!window.localStorage) return false;
      window.localStorage.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  }

  function gmGet(key, def) {
    try {
      if (hasLegacyGM) return GM_getValue(key, def);
    } catch (_) {}
    return lsGet(key, def);
  }

  async function gmGetAsync(key, def) {
    if (hasLegacyGM) return gmGet(key, def);

    if (hasModernGMGet) {
      try {
        const value = await GM.getValue(key, def);
        if (value !== undefined && value !== null) lsSet(key, value);
        return value === undefined ? def : value;
      } catch (_) {}
    }

    return lsGet(key, def);
  }

  function gmSet(key, val) {
    let wrote = false;

    try {
      if (hasLegacyGM) {
        GM_setValue(key, val);
        wrote = true;
      }
    } catch (_) {}

    wrote = lsSet(key, val) || wrote;

    if (hasModernGMSet) {
      try {
        Promise.resolve(GM.setValue(key, val)).catch(() => {});
        wrote = true;
      } catch (_) {}
    }

    return wrote;
  }

  async function gmSetAsync(key, val) {
    let wrote = false;

    try {
      if (hasLegacyGM) {
        GM_setValue(key, val);
        wrote = true;
      }
    } catch (_) {}

    wrote = lsSet(key, val) || wrote;

    if (hasModernGMSet) {
      try {
        await GM.setValue(key, val);
        wrote = true;
      } catch (_) {}
    }

    return wrote;
  }

  function gmRequest(details) {
    const gm = (typeof GM === "object" && GM) ? GM : null;
    const modernRequest = gm && (gm.xmlHttpRequest || gm.xmlhttpRequest);
    try {
      if (typeof modernRequest === "function") {
        return modernRequest.call(gm, details) || true;
      }
    } catch (error) {
      try { console.warn(TAG, "GM.xmlHttpRequest failed", error); } catch (_) {}
    }

    try {
      if (typeof GM_xmlhttpRequest === "function") {
        return GM_xmlhttpRequest(details) || true;
      }
    } catch (error) {
      try { console.warn(TAG, "GM_xmlhttpRequest failed", error); } catch (_) {}
    }

    return false;
  }

  function wireGmRequestResult(request, details) {
    if (!request || typeof request.then !== "function") return;
    request.then(
      response => details.onload(response || { status: 0, responseText: "" }),
      error => {
        if (typeof details.onerror === "function") details.onerror(error);
      }
    );
  }

  function getJson(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const details = {
        method: "GET",
        url,
        timeout: timeoutMs || 20000,
        headers: { "Accept": "application/json" },
        onload(response) {
          let data = null;
          try {
            data = JSON.parse(response.responseText || "{}");
          } catch (_) {
            reject(new Error("License API returned invalid JSON."));
            return;
          }
          if (response.status >= 500) {
            reject(new Error(data.reason || `License API returned HTTP ${response.status}.`));
            return;
          }
          if (response.status >= 400 && !data.reason) {
            reject(new Error(`License API returned HTTP ${response.status}.`));
            return;
          }
          resolve(data);
        },
        onerror() { reject(new Error("License API request failed.")); },
        ontimeout() { reject(new Error("License API request timed out.")); }
      };

      const request = gmRequest(details);
      if (request) {
        wireGmRequestResult(request, details);
        return;
      }

      if (typeof fetch === "function") {
        fetch(url, { method: "GET", headers: details.headers, credentials: "omit" })
          .then(response => response.text().then(text => ({ response, text })))
          .then(({ response, text }) => {
            let data = null;
            try {
              data = JSON.parse(text || "{}");
            } catch (_) {
              throw new Error("License API returned invalid JSON.");
            }
            if (response.status >= 500) throw new Error(data.reason || `License API returned HTTP ${response.status}.`);
            if (!response.ok && !data.reason) throw new Error(`License API returned HTTP ${response.status}.`);
            resolve(data);
          })
          .catch(reject);
        return;
      }

      reject(new Error("No supported request API is available."));
    });
  }

  function getText(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const details = {
        method: "GET",
        url,
        timeout: timeoutMs || 20000,
        headers: { "Accept": "text/html,text/plain,*/*" },
        onload(response) {
          if (response.status >= 500) {
            reject(new Error(`Update notice returned HTTP ${response.status}.`));
            return;
          }
          if (response.status >= 400) {
            reject(new Error(`Update notice returned HTTP ${response.status}.`));
            return;
          }
          resolve(String(response.responseText || ""));
        },
        onerror() { reject(new Error("Update notice request failed.")); },
        ontimeout() { reject(new Error("Update notice request timed out.")); }
      };

      const request = gmRequest(details);
      if (request) {
        wireGmRequestResult(request, details);
        return;
      }

      if (typeof fetch === "function") {
        fetch(url, { method: "GET", headers: details.headers, credentials: "omit" })
          .then(response => {
            if (response.status >= 500) throw new Error(`Update notice returned HTTP ${response.status}.`);
            if (!response.ok) throw new Error(`Update notice returned HTTP ${response.status}.`);
            return response.text();
          })
          .then(resolve)
          .catch(reject);
        return;
      }

      reject(new Error("No supported request API is available."));
    });
  }

  function addStyle(css) {
    if (typeof GM_addStyle === "function") GM_addStyle(css);
    else {
      const s = document.createElement("style");
      s.textContent = css;
      document.head.appendChild(s);
    }
  }

  function isoToSec(value) {
    const ms = Date.parse(String(value || ""));
    return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  }

  function nowSec() {
    return Math.floor(Date.now() / 1000);
  }

  function licenseStatusCacheKey(userId) {
    return `${STORE.licenseStatusCache}:${LICENSE_PRODUCT}:${String(userId || "").trim()}`;
  }

  function clearLicenseStatusCache(userId) {
    if (!userId) return;
    lsRemove(licenseStatusCacheKey(userId));
  }

  function readLicenseStatusCache(userId) {
    const uid = String(userId || "").trim();
    if (!uid) return null;

    let cached;
    try { cached = JSON.parse(lsGetRaw(licenseStatusCacheKey(uid)) || "null"); }
    catch (_) { cached = null; }

    const now = Date.now();
    const result = cached?.result;
    const payload = result?.payload || {};
    const exp = Number(payload.exp || 0);

    if (!cached || cached.product !== LICENSE_PRODUCT || String(cached.userId || "") !== uid) {
      clearLicenseStatusCache(uid);
      return null;
    }

    if (!result?.ok || Number(cached.expiresAtMs || 0) <= now) {
      clearLicenseStatusCache(uid);
      return null;
    }

    if (payload.product !== LICENSE_PRODUCT || String(payload.uid || "") !== uid) {
      clearLicenseStatusCache(uid);
      return null;
    }

    if (exp > 0 && nowSec() > exp) {
      clearLicenseStatusCache(uid);
      return null;
    }

    return Object.assign({}, result, {
      via: "license status cache",
      fromCache: true,
      statusChecked: true
    });
  }

  function writeLicenseStatusCache(userId, result) {
    const uid = String(userId || "").trim();
    if (!uid || !result?.ok) return;

    const exp = Number(result.payload?.exp || 0);
    const expMs = exp > 0 ? exp * 1000 : Date.now() + LICENSE_STATUS_CACHE_TTL_MS;
    const expiresAtMs = Math.min(Date.now() + LICENSE_STATUS_CACHE_TTL_MS, expMs);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return;

    const cache = {
      product: LICENSE_PRODUCT,
      userId: uid,
      cachedAtMs: Date.now(),
      expiresAtMs,
      result
    };

    lsSet(licenseStatusCacheKey(uid), JSON.stringify(cache));
  }

  // ===============================
  // userID detection from explicit Torn-owned fields only:
  // - header/account "Name" row profile link
  // - mon.js bootstrap script playerid attribute
  // ===============================
  function getMyUserId() {
    const asUid = (n) => {
      const uid = Number(n);
      return Number.isFinite(uid) && uid > 0 ? uid : null;
    };

    const nameRows = Array.from(document.querySelectorAll('p[class*="menu-info-row"]'));
    for (const row of nameRows) {
      const label = row.querySelector('[class*="menu-name"]');
      const labelText = String(label?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (labelText !== "name:") continue;

      const link = row.querySelector('a[class*="menu-value"][href*="/profiles.php?XID="]');
      const href = link?.getAttribute("href") || "";
      const m = href.match(/\/profiles\.php(?:\?[^#]*)?\bXID=(\d+)/i);
      const uid = asUid(m?.[1]);
      if (uid) return uid;
    }

    const monScript =
      document.querySelector('script[playerid][playername][server_name][src*="/js/debug/mon.js"]') ||
      document.querySelector('script[playerid][playername][src*="/js/debug/mon.js"]');
    const monUid = asUid(monScript?.getAttribute("playerid"));
    if (monUid) return monUid;

    return null;
  }

  function getMyPlayerName() {
    const nameRows = Array.from(document.querySelectorAll('p[class*="menu-info-row"]'));
    for (const row of nameRows) {
      const label = row.querySelector('[class*="menu-name"]');
      const labelText = String(label?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (labelText !== "name:") continue;

      const link = row.querySelector('a[class*="menu-value"][href*="/profiles.php?XID="]');
      const name = String(link?.textContent || "").replace(/\s+/g, " ").trim();
      if (name) return name;
    }

    const monScript =
      document.querySelector('script[playerid][playername][server_name][src*="/js/debug/mon.js"]') ||
      document.querySelector('script[playerid][playername][src*="/js/debug/mon.js"]');
    const monName = String(monScript?.getAttribute("playername") || "").replace(/\s+/g, " ").trim();
    return monName || "";
  }

  async function verifyLicenseStatusAsync(myUid) {
    const userId = String(myUid || "").trim();
    if (!userId) return { ok: false, reason: "No userID detected" };

    const cached = readLicenseStatusCache(userId);
    if (cached) return cached;

    let data;
    try {
      const url = `${LICENSE_API_BASE_URL}/license/status?product=${encodeURIComponent(LICENSE_PRODUCT)}&userId=${encodeURIComponent(userId)}`;
      data = await getJson(url, 20000);
    } catch (error) {
      return { ok: false, reason: `License API unavailable: ${error?.message || "request failed"}`, apiUnavailable: true };
    }

    const product = String(data?.product || "").trim();
    if (product && product !== LICENSE_PRODUCT) {
      clearLicenseStatusCache(userId);
      return { ok: false, reason: "License product does not match this script.", apiReached: true };
    }

    const active = !!(data?.ok && (data.active === true || String(data.status || "").toLowerCase() === "active"));
    if (!active) {
      clearLicenseStatusCache(userId);
      return { ok: false, reason: data?.reason || `License status is ${data?.status || "inactive"}.`, apiReached: true, statusChecked: true };
    }

    const tier = String(data.tier || "supporter").toLowerCase();
    const exp = isoToSec(data.expiresAt);
    const result = {
      ok: true,
      via: "license status",
      statusChecked: true,
      payload: {
        uid: Number(userId),
        exp,
        features: ["supporter"],
        product: LICENSE_PRODUCT,
        tier,
        status: String(data.status || "active"),
        expiresAt: data.expiresAt || ""
      },
      license: {
        product: LICENSE_PRODUCT,
        userId,
        tier,
        status: String(data.status || "active"),
        expiresAt: data.expiresAt || "",
        exp
      },
      features: ["supporter"],
      flags: { supporter: true, premiumFilters: true },
      checkedAt: data.checkedAt || ""
    };
    writeLicenseStatusCache(userId, result);
    return result;
  }

  const supporter = { unlocked: false, reason: "Locked", exp: 0 };
  let state = Object.assign({}, DEFAULTS);
  let ui = Object.assign({}, UI_DEFAULTS);
  let externalRealCarNamesDetected = false;
  let syncCarNameUi = null;
  let savedLicenseNeedsRetry = false;
  let savedLicenseRetryTimer = null;
  let savedLicenseRetryBusy = false;
  let postMountLicenseCheckTimer = null;
  let postMountLicenseCheckBusy = false;
  let postMountLicenseLastCheckAt = 0;
  let updateNoticeAutoTimer = null;
  let updateNoticeAutoOpened = false;
  const POST_MOUNT_LICENSE_CHECK_INTERVAL_MS = 30000;

  function isRetriableLicenseReason(reason) {
    const text = String(reason || "");
    return reason === "No userID detected" ||
      text.indexOf("License API unavailable") === 0 ||
      text.indexOf("License API request failed") === 0 ||
      text.indexOf("License API request timed out") === 0 ||
      text.indexOf("License API returned invalid JSON") === 0 ||
      text.indexOf("No supported request API") === 0;
  }

  function parseStoredJson(raw, defaults) {
    if (!raw) return Object.assign({}, defaults);
    try { return Object.assign({}, defaults, JSON.parse(raw) || {}); }
    catch (_) { return Object.assign({}, defaults); }
  }

  function loadUiState_() {
    return parseStoredJson(gmGet(STORE.ui, ""), UI_DEFAULTS);
  }

  async function loadUiStateAsync_() {
    return parseStoredJson(await gmGetAsync(STORE.ui, ""), UI_DEFAULTS);
  }
  function saveUiState_() {
    try { gmSet(STORE.ui, JSON.stringify(ui)); } catch (_) {}
  }

  function resetSupporterSettings(nextState) {
    const next = Object.assign({}, nextState);
    for (const key of SUPPORTER_SETTING_KEYS) next[key] = DEFAULTS[key];
    return next;
  }

  function loadSettings() {
    return parseStoredJson(gmGet(STORE.settings, ""), DEFAULTS);
  }

  async function loadSettingsAsync() {
    return parseStoredJson(await gmGetAsync(STORE.settings, ""), DEFAULTS);
  }

  function saveSettings() {
    try { gmSet(STORE.settings, JSON.stringify(state)); } catch (_) {}
  }

  function setState(patch) {
    state = Object.assign({}, state, patch);
    if (!supporter.unlocked) state = resetSupporterSettings(state);
    saveSettings();
    applyNow();
  }

  function fmtExp_(expSec) {
    const n = Number(expSec || 0);
    if (!n || n <= 0) return "";
    const d = new Date(n * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm} UTC`;
  }

  addStyle(`
    #modulRFOuter { margin: 8px 0; }
    #modulRFOuter .rfPad { padding: 10px; }

    #modulRFOuter .rfTitleRow{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding-right:8px;
    }
    #modulRFOuter .rfCollapseBtn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:30px;
      height:24px;
      border-radius:6px;
      border:1px solid rgba(255,255,255,.16);
      background: rgba(0,0,0,.15);
      color:#fff;
      cursor:pointer;
      user-select:none;
      font-size:14px;
      line-height:1;
      flex:0 0 auto;
    }
    #modulRFOuter .rfCollapseBtn:hover{ background: rgba(0,0,0,.25); }

    #modulRFOuter .rfBtns{
      display:grid; grid-template-columns: 1fr 1fr;
      gap:10px;
      padding: 0 10px 10px 10px;
    }
    @media (max-width:420px){ #modulRFOuter .rfBtns{ grid-template-columns: 1fr; } }

    #modulRFOuter .rfGrid{
      display:grid; grid-template-columns: 1fr 1fr;
      gap:10px;
      padding: 0 10px 10px 10px;
    }
    @media (max-width:420px){ #modulRFOuter .rfGrid{ grid-template-columns: 1fr; } }

    #modulRFOuter .rfCol{ display:flex; flex-direction:column; gap:12px; }
    #modulRFOuter .rfAdvWrap{ display:flex; flex-direction:column; gap:12px; }
    #modulRFOuter .rfPair{
      display:grid; grid-template-columns: 126px 1fr;
      gap:8px; align-items:center;
    }
    #modulRFOuter .rfLbl{ font-size:12px; color:rgba(255,255,255,.88); white-space:nowrap; }

    #modulRFOuter select, #modulRFOuter button{ width:100%; box-sizing:border-box; }

    #modulRFOuter select.rfSelect{
      appearance:none;
      -webkit-appearance:none;
      min-height:32px;
      font-size:12px;
      line-height:16px;
      border-radius:4px;
      border:1px solid rgba(255,255,255,.12);
      border-top-color:rgba(255,255,255,.20);
      border-bottom-color:rgba(0,0,0,.55);
      background-color:#1b1b1b;
      background-image:
        linear-gradient(to bottom, rgba(255,255,255,.08), rgba(0,0,0,.18)),
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 9 6'%3E%3Cpath fill='%23b7b7b7' d='M0 0h9L4.5 6z'/%3E%3C/svg%3E");
      background-repeat:repeat, no-repeat;
      background-position:0 0, right 10px center;
      color:#d9d9d9;
      padding:7px 28px 7px 9px;
      outline:none;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.06),
        0 1px 2px rgba(0,0,0,.35);
      cursor:pointer;
      text-shadow:0 1px 0 rgba(0,0,0,.65);
    }

    #modulRFOuter select.rfSelect:hover{
      border-color:rgba(255,255,255,.22);
      border-bottom-color:rgba(0,0,0,.65);
      background-color:#202020;
      color:#fff;
    }

    #modulRFOuter select.rfSelect:focus{
      border-color:rgba(196,20,20,.75);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.08),
        0 0 0 1px rgba(196,20,20,.28),
        0 1px 2px rgba(0,0,0,.35);
      color:#fff;
    }

    #modulRFOuter select.rfSelect:disabled{
      cursor:not-allowed;
      color:rgba(255,255,255,.55);
      background-color:#171717;
      opacity:.7;
    }

    #modulRFOuter select.rfSelect option{
      color:#e6e6e6;
      background:#1b1b1b;
    }

    #modulRFOuter button{
      font-size:13px;
      border-radius:8px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(25,25,25,.75);
      color:#fff;
      padding:8px 12px;
      cursor:pointer;
    }
    #modulRFOuter button:disabled{ opacity:.55; cursor:not-allowed; }

    #modulRFOuter .rfChkWrap{ display:flex; align-items:center; gap:10px; }
    #modulRFOuter .rfChk{ position:absolute; opacity:0; pointer-events:none; }
    #modulRFOuter .rfChkLabel{
      position:relative;
      padding-left:28px;
      cursor:pointer;
      user-select:none;
      font-size:13px;
      color:#fff;
    }
    #modulRFOuter .rfChkLabel:before{
      content:"";
      position:absolute; left:0; top:50%;
      transform:translateY(-50%);
      width:18px; height:18px;
      border-radius:3px;
      border:1px solid rgba(255,255,255,.25);
      background:rgba(0,0,0,.35);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
    }
    #modulRFOuter .rfChk:checked + .rfChkLabel:before{
      background:#c51414;
      border-color:#ff3b3b;
    }
    #modulRFOuter .rfChk:checked + .rfChkLabel:after{
      content:"";
      position:absolute; left:6px; top:50%;
      transform:translateY(-55%) rotate(45deg);
      width:6px; height:10px;
      border-right:2px solid #fff;
      border-bottom:2px solid #fff;
    }

    #modulRFOuter .rfLocked{ opacity:.55; filter:grayscale(.15); }
    #modulRFOuter .rfFooter{ padding:10px; border-top:1px solid rgba(255,255,255,.10); }

    #modulRFOuter .rfInfoBar{
      display:flex;
      align-items:stretch;
      justify-content:space-between;
      gap:0;
      margin:4px 10px;
      border-radius:5px;
      overflow:hidden;
      border:1px solid rgba(255,255,255,.10);
      box-shadow: 1px 1px 4px rgba(0,0,0,.25);
    }

    #modulRFOuter .rfInfoLeft{
      display:flex;
      align-items:center;
      gap:8px;
      padding:0 10px;
      min-width:0;
    }

    #modulRFOuter .rfInfoIcon{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:18px;
      height:18px;
      flex:0 0 auto;
      border-radius:50%;
      border:1px solid rgba(255,255,255,.12);
      background:#3a3a3a linear-gradient(to bottom, rgba(255,255,255,.08), rgba(0,0,0,.18));
      color:#d0d0d0;
      font-size:12px;
      font-weight:bold;
      line-height:18px;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 1px 2px rgba(0,0,0,.35);
      text-shadow:0 1px 0 rgba(0,0,0,.65);
    }

    #modulRFOuter .rfInfoText{
      font-size:13px;
      line-height:22px;
      color:rgba(255,255,255,.92);
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      min-width:0;
    }

    #modulRFOuter .rfInfoRight{
      flex:0 0 auto;
      display:flex;
      align-items:stretch;
      gap:6px;
      padding:0 0 0 6px;
    }

    #modulRFOuter .rfInfoRight .rfLicenseAction{
      width:auto;
      min-width:112px;
      white-space:nowrap;
    }

    #modulRFOuter .rfLicenseAction{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:100%;
      min-height:32px;
      box-sizing:border-box;
      padding:8px 12px;
      border-radius:4px;
      border:1px solid rgba(255,255,255,.12);
      border-top-color:rgba(255,255,255,.20);
      border-bottom-color:rgba(0,0,0,.55);
      background:#1b1b1b linear-gradient(to bottom, rgba(255,255,255,.08), rgba(0,0,0,.18));
      color:#e6e6e6;
      cursor:pointer;
      user-select:none;
      font-size:12px;
      line-height:16px;
      text-align:center;
      text-decoration:none;
      text-shadow:0 1px 0 rgba(0,0,0,.65);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 1px 2px rgba(0,0,0,.35);
    }

    #modulRFOuter .rfLicenseAction:hover{
      border-color:rgba(255,255,255,.22);
      border-bottom-color:rgba(0,0,0,.65);
      background-color:#202020;
      color:#fff;
    }

    #modulRFOuter .rfLicenseAction:focus{
      outline:none;
      border-color:rgba(196,20,20,.75);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 0 0 1px rgba(196,20,20,.28), 0 1px 2px rgba(0,0,0,.35);
      color:#fff;
    }

    #modulRFOuter .rfLicenseAction.rfDisabled{
      opacity:.55;
      cursor:not-allowed;
      color:rgba(255,255,255,.55);
      background-color:#171717;
    }

    #modulRFOuter .rfLicensePanel{
      display:flex;
      flex-direction:column;
      gap:8px;
      margin:0 10px 10px 10px;
      padding:10px;
      border-radius:5px;
      border:1px solid rgba(255,255,255,.10);
      background:rgba(0,0,0,.18);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.04), 1px 1px 4px rgba(0,0,0,.20);
    }

    #modulRFOuter .rfLicensePanel[hidden]{ display:none !important; }
    #modulRFOuter .rfLicenseTitle{ font-size:13px; color:#fff; font-weight:bold; }
    #modulRFOuter .rfLicenseHint{ font-size:12px; line-height:1.35; color:rgba(255,255,255,.72); }

    #modulRFOuter .rfDiscordSteps{
      margin:0 0 0 18px;
      padding:0;
      font-size:12px;
      line-height:1.45;
      color:rgba(255,255,255,.82);
    }

    #modulRFOuter .rfDiscordSteps li{ margin:0 0 6px; }

    #modulRFOuter .rfDiscordNote{
      font-size:12px;
      line-height:1.35;
      color:rgba(255,255,255,.72);
    }

    #modulRFOuter .rfDiscordActions{
      display:grid;
      grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));
      gap:8px;
    }

    #modulRFOuter .rfLicenseInput{
      width:100%;
      min-height:74px;
      box-sizing:border-box;
      resize:vertical;
      border-radius:4px;
      border:1px solid rgba(255,255,255,.12);
      border-top-color:rgba(255,255,255,.20);
      border-bottom-color:rgba(0,0,0,.55);
      background:#1b1b1b;
      color:#e6e6e6;
      padding:8px 9px;
      outline:none;
      font-size:12px;
      line-height:1.35;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 1px 2px rgba(0,0,0,.35);
    }

    #modulRFOuter .rfLicenseInput:focus{
      border-color:rgba(196,20,20,.75);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 0 0 1px rgba(196,20,20,.28), 0 1px 2px rgba(0,0,0,.35);
    }

    #modulRFOuter .rfLicenseActions{
      display:grid;
      grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));
      gap:8px;
    }

    #modulRFOuter .rfLicenseStatus{
      min-height:16px;
      font-size:12px;
      color:rgba(255,255,255,.72);
    }
    #modulRFOuter .rfLicenseStatus.rfOk{ color:#9fd58d; }
    #modulRFOuter .rfLicenseStatus.rfBad{ color:#ff9b9b; }

    #modulRFOuter .rfLicenseProgress{
      display:none;
      height:5px;
      overflow:hidden;
      border-radius:4px;
      border:1px solid rgba(255,255,255,.10);
      background:rgba(0,0,0,.35);
      box-shadow:inset 0 1px 2px rgba(0,0,0,.45);
    }

    #modulRFOuter .rfLicenseProgress.rfActive{ display:block; }

    #modulRFOuter .rfLicenseProgressBar{
      width:0;
      height:100%;
      border-radius:4px;
      background:#c51414 linear-gradient(to bottom, rgba(255,255,255,.24), rgba(0,0,0,.12));
      box-shadow:0 0 8px rgba(197,20,20,.45);
      transition:none;
    }

    @media (max-width:540px){
      #modulRFOuter .rfInfoBar{ flex-direction:column; }
      #modulRFOuter .rfInfoLeft{ min-height:32px; }
      #modulRFOuter .rfInfoRight{ width:100%; padding:6px; box-sizing:border-box; }
      #modulRFOuter .rfInfoRight .rfLicenseAction{ flex:1 1 0; min-width:0; }
    }

    #modulRFNoticeOverlay{
      position:fixed;
      z-index:2147483647;
      inset:0;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:16px;
      box-sizing:border-box;
      background:rgba(0,0,0,.62);
    }

    #modulRFNoticeOverlay .rfNoticeModal{
      width:min(540px, calc(100vw - 32px));
      max-height:min(72vh, 620px);
      overflow:hidden;
      border-radius:8px;
      border:1px solid rgba(255,255,255,.14);
      background:#202020;
      color:#e6e6e6;
      box-shadow:0 12px 30px rgba(0,0,0,.55);
      font-family:Arial,Helvetica,sans-serif;
    }

    #modulRFNoticeOverlay .rfNoticeTop{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:10px 12px;
      border-bottom:1px solid rgba(255,255,255,.12);
      background:#1b1b1b linear-gradient(to bottom, rgba(255,255,255,.08), rgba(0,0,0,.18));
    }

    #modulRFNoticeOverlay .rfNoticeTitle{
      font-size:14px;
      font-weight:bold;
      color:#fff;
    }

    #modulRFNoticeOverlay .rfNoticeClose{
      width:auto;
      min-width:72px;
      border-radius:4px;
      border:1px solid rgba(255,255,255,.14);
      background:#1b1b1b linear-gradient(to bottom, rgba(255,255,255,.08), rgba(0,0,0,.18));
      color:#e6e6e6;
      padding:6px 10px;
      cursor:pointer;
      font-size:12px;
    }

    #modulRFNoticeOverlay .rfNoticeBody{
      max-height:calc(min(72vh, 620px) - 44px);
      overflow:auto;
      padding:14px;
      font-size:13px;
      line-height:1.5;
      color:#e6e6e6;
      background:#252525;
    }

    #modulRFNoticeOverlay .rfNoticeBody a{
      color:#ffdddd;
      text-decoration:underline;
    }

    #modulRFNoticeOverlay .rfNoticeLoading,
    #modulRFNoticeOverlay .rfNoticeFallback{
      padding:12px;
      border-radius:6px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(0,0,0,.18);
    }
  `);

  function $(sel, root = document) { return root.querySelector(sel); }

  function fallbackUpdateNoticeHtml(error) {
    const reason = error ? `<p style="margin:8px 0 0;color:#ffb8b8;">Could not load the hosted notice: ${escapeHtml(error?.message || String(error))}</p>` : "";
    return `
      <div class="rfNoticeFallback">
        <h3 style="margin:0 0 8px;color:#fff;font-size:15px;">Licensing has moved to Discord</h3>
        <p style="margin:0 0 8px;">Supporter access is now handled by the Discord bot. No manual license key needs to be pasted into this script anymore.</p>
        <ol style="margin:0 0 8px 18px;padding:0;">
          <li>Join the Discord server.</li>
          <li>Type <strong>/verify</strong> and paste a public Torn API key in the popup.</li>
          <li>After verification, you receive the Verified role and your Discord nickname is updated to your Torn name and ID.</li>
          <li>Type <strong>/buylicense</strong>, choose Custom Race Filter, then follow the bot instructions.</li>
          <li>The bot checks the payment logs and gives your Torn account access automatically.</li>
        </ol>
        <p style="margin:0 0 8px;">Please make sure DMs from the server are enabled.</p>
        <p style="margin:0;">Discord: <a href="${DISCORD_INVITE_URL}" target="_blank" rel="noopener noreferrer">${DISCORD_INVITE_URL}</a></p>
        ${reason}
      </div>
    `;
  }

  function escapeHtml(value) {
    const span = document.createElement("span");
    span.textContent = String(value || "");
    return span.innerHTML;
  }

  function sanitizeNoticeHtml(html) {
    if (typeof DOMParser !== "function") return fallbackUpdateNoticeHtml();

    const noticeHtml = String(html || "")
      .replace(/\{TORN_NAME\}/g, escapeHtml(getMyPlayerName() || "racer"))
      .replace(/\{TORN_ID\}/g, escapeHtml(getMyUserId() || ""));

    const doc = new DOMParser().parseFromString(noticeHtml, "text/html");
    const removeTags = new Set([
      "script", "style", "iframe", "object", "embed", "link", "meta", "base",
      "form", "input", "button", "textarea", "select", "option",
      "svg", "math", "canvas", "video", "audio", "source", "picture", "img"
    ]);
    const allowedTags = new Set([
      "div", "span", "p", "br", "hr",
      "h1", "h2", "h3", "h4",
      "ol", "ul", "li",
      "strong", "b", "em", "i", "code", "pre",
      "a"
    ]);
    const allowedCss = new Set([
      "background", "background-color", "border", "border-top", "border-radius",
      "box-shadow", "color", "display", "font-family", "font-size", "font-weight",
      "line-height", "margin", "max-width", "padding", "padding-top",
      "text-align", "text-decoration"
    ]);

    function sanitizeStyle(styleText) {
      const out = [];
      String(styleText || "").split(";").forEach(part => {
        const idx = part.indexOf(":");
        if (idx <= 0) return;

        const prop = part.slice(0, idx).trim().toLowerCase();
        const value = part.slice(idx + 1).trim();
        const valueLow = value.toLowerCase();
        if (!allowedCss.has(prop)) return;
        if (
          /url\s*\(/i.test(value) ||
          valueLow.indexOf("javascript:") !== -1 ||
          valueLow.indexOf("expression") !== -1 ||
          valueLow.indexOf("@import") !== -1 ||
          valueLow.indexOf("behavior") !== -1 ||
          valueLow.indexOf("-moz-binding") !== -1 ||
          /[<>]/.test(value)
        ) return;

        out.push(`${prop}: ${value}`);
      });
      return out.join("; ");
    }

    function sanitizeHref(value) {
      try {
        const url = new URL(String(value || ""), window.location.href);
        return url.protocol === "https:" ? url.href : "";
      } catch (_) {
        return "";
      }
    }

    const notice = doc.querySelector("[data-rf-update-notice]");
    const root = notice || doc.body;
    const nodes = (notice ? [notice] : []).concat(Array.from(root?.querySelectorAll("*") || []));

    nodes.forEach(el => {
      const tag = String(el.tagName || "").toLowerCase();
      if (removeTags.has(tag)) {
        el.remove();
        return;
      }

      if (!allowedTags.has(tag)) {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        el.remove();
        return;
      }

      Array.from(el.attributes).forEach(attr => {
        const name = String(attr.name || "").toLowerCase();
        const value = String(attr.value || "");
        let keep = false;

        if (name === "class" || name === "data-rf-update-notice") keep = true;

        if (name === "style") {
          const safeStyle = sanitizeStyle(value);
          if (safeStyle) {
            el.setAttribute("style", safeStyle);
            keep = true;
          }
        }

        if (tag === "a" && name === "href") {
          const safeHref = sanitizeHref(value);
          if (safeHref) {
            el.setAttribute("href", safeHref);
            keep = true;
          }
        }

        if (!keep) el.removeAttribute(attr.name);
      });

      if (el.tagName === "A") {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    });

    const safeNotice = notice && notice.isConnected ? notice : doc.querySelector("[data-rf-update-notice]");
    const bodyHtml = safeNotice ? safeNotice.outerHTML : (doc.body?.innerHTML || "");
    return bodyHtml.trim() || fallbackUpdateNoticeHtml();
  }

  function closeUpdateNoticeModal() {
    const old = document.getElementById("modulRFNoticeOverlay");
    if (old) old.remove();
  }

  function openUpdateNoticeModal(autoOpen) {
    if (autoOpen) {
      updateNoticeAutoOpened = true;
      try { gmSet(STORE.updateNoticeSeen, VERSION); } catch (_) {}
    }

    closeUpdateNoticeModal();

    const overlay = document.createElement("div");
    overlay.id = "modulRFNoticeOverlay";

    const modal = document.createElement("div");
    modal.className = "rfNoticeModal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Update notice");

    const top = document.createElement("div");
    top.className = "rfNoticeTop";

    const title = document.createElement("div");
    title.className = "rfNoticeTitle";
    title.textContent = "Update notice";

    const btnClose = document.createElement("button");
    btnClose.type = "button";
    btnClose.className = "rfNoticeClose";
    btnClose.textContent = "Close";

    const body = document.createElement("div");
    body.className = "rfNoticeBody";
    body.innerHTML = '<div class="rfNoticeLoading">Loading update notice...</div>';

    top.append(title, btnClose);
    modal.append(top, body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    btnClose.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeUpdateNoticeModal();
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeUpdateNoticeModal();
    });

    getText(UPDATE_NOTICE_URL, 20000)
      .then(html => { body.innerHTML = sanitizeNoticeHtml(html); })
      .catch(error => { body.innerHTML = fallbackUpdateNoticeHtml(error); });
  }

  function scheduleUpdateNoticeOnce() {
    if (updateNoticeAutoOpened || updateNoticeAutoTimer) return;
    if (gmGet(STORE.updateNoticeSeen, "") === VERSION) return;

    updateNoticeAutoTimer = setTimeout(() => {
      updateNoticeAutoTimer = null;
      if (updateNoticeAutoOpened || gmGet(STORE.updateNoticeSeen, "") === VERSION) return;
      openUpdateNoticeModal(true);
    }, 700);
  }

  function getItems() {
    const list = $(".custom-events-wrap .events-list");
    if (!list) return [];
    return Array.from(list.children).filter(li => li && li.tagName === "LI");
  }

  function norm(s) { return String(s || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  const toInt = (t) => { const m = (t || "").match(/\d+/); return m ? (m[0] | 0) : null; };

  function makeNameLookup(values) {
    const lookup = Object.create(null);
    for (const value of values) lookup[norm(value)] = true;
    return lookup;
  }

  const FICTIONAL_CAR_NAME_LOOKUP = makeNameLookup(CARCLASS_OPTIONS.filter(v => CAR_CLASS_FIXED_OPTIONS.indexOf(v) === -1));
  const REAL_CAR_NAME_LOOKUP = makeNameLookup(Object.keys(CAR_FICTIONAL_TO_REAL).map(key => CAR_FICTIONAL_TO_REAL[key]));
  const REAL_TO_FICTIONAL_CAR_NAME = (function () {
    const lookup = Object.create(null);
    for (const fictional of CARCLASS_OPTIONS) {
      const real = CAR_FICTIONAL_TO_REAL[fictional];
      if (real) lookup[norm(real)] = fictional;
    }
    return lookup;
  })();

  function nameLookupMatches(text, lookup) {
    const n = norm(text);
    if (!n) return false;
    if (lookup[n]) return true;
    for (const key in lookup) {
      if (key && n.indexOf(key) !== -1) return true;
    }
    return false;
  }

  function carNamesAreEffectivelyReal() {
    return state.useRealCarNames || externalRealCarNamesDetected;
  }

  function getCarNameModeValue() {
    if (externalRealCarNamesDetected && !state.useRealCarNames) return "detected";
    return state.useRealCarNames ? "real" : "fictional";
  }

  function getCarNameModeOptions() {
    const options = [
      { v: "fictional", label: "Fictional" },
      { v: "real", label: "Real (OG)" }
    ];
    if (externalRealCarNamesDetected && !state.useRealCarNames) {
      options.push({ v: "detected", label: "Real (Detected)" });
    }
    return options;
  }

  function coerceCarClassForMode(value) {
    if (!value) return "Any";
    if (CAR_CLASS_FIXED_OPTIONS.indexOf(value) !== -1) return value;
    if (carNamesAreEffectivelyReal()) return CAR_FICTIONAL_TO_REAL[value] || value;
    return REAL_TO_FICTIONAL_CAR_NAME[norm(value)] || value;
  }

  function detectExternalRealCarNames(items) {
    const rows = items || getItems();
    let seen = 0;
    let realHits = 0;
    let fictionalHits = 0;

    for (const li of rows) {
      const carText = getCarNameFictional(li);
      if (!norm(carText)) continue;
      seen++;
      if (nameLookupMatches(carText, REAL_CAR_NAME_LOOKUP)) realHits++;
      if (nameLookupMatches(carText, FICTIONAL_CAR_NAME_LOOKUP)) fictionalHits++;
    }

    if (!seen) return null;
    return realHits > 0 && realHits >= fictionalHits;
  }

  function refreshExternalRealCarNames(items) {
    const detected = detectExternalRealCarNames(items);
    if (detected === null || detected === externalRealCarNamesDetected) return false;
    externalRealCarNamesDetected = detected;
    if (typeof syncCarNameUi === "function") syncCarNameUi();
    return true;
  }

  function getTrackName(li) {
    const trackLi = li.querySelector(".event-header li.track");
    if (!trackLi) return "";
    const lapsEl = trackLi.querySelector(".laps");
    const fullText = (trackLi.textContent || "").replace(/\s+/g, " ").trim();
    const lapsText = (lapsEl?.textContent || "").replace(/\s+/g, " ").trim();
    return lapsText ? fullText.replace(lapsText, "").trim() : fullText;
  }

  function getLaps(li) {
    const n = toInt(li.querySelector(".event-header li.track .laps")?.textContent);
    return n;
  }

  function getDrivers(li) {
    const txt = li.querySelector(".acc-body li.drivers")?.textContent || "";
    const m = txt.match(/(\d+)\s*\/\s*(\d+)/);
    if (!m) return { cur: null, max: null };
    const cur = m[1] | 0, max = m[2] | 0;
    return { cur, max };
  }

  function getFee(li) {
    const txt = li.querySelector(".acc-body li.fee")?.textContent || "";
    const m = txt.match(/\$[\d,]+/);
    if (!m) return null;
    const n = parseInt(m[0].replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  function isPasswordProtected(li) {
    return !!li.querySelector(".event-header li.password.protected");
  }

  function isChampionshipURT(li) {
    return li.classList.contains("gold") || li.classList.contains("gold_protected");
  }

  function getJltRaceMeta(li) {
    const txt = (li.textContent || "").toUpperCase();
    const m = txt.match(/\b(?:JLT|URT)-L([0-6])-([A-P])-\d+\b/);
    if (!m) return null;
    return { league: `L${m[1]}`, group: m[2] };
  }

  function getStartMinutes(li) {
    const txt = (li.textContent || "").toLowerCase();
    if (txt.includes("waiting") || txt.includes("asap")) return 0;
    const hm = txt.match(/(\d+)\s*h(?:\s*(\d+)\s*m)?/);
    const mOnly = txt.match(/\b(\d+)\s*m\b/);
    let mins = null;
    if (hm) {
      const h = parseInt(hm[1], 10) || 0;
      const m = hm[2] ? (parseInt(hm[2], 10) || 0) : 0;
      mins = h * 60 + m;
    } else if (mOnly) {
      mins = parseInt(mOnly[1], 10) || 0;
    }
    if (mins != null && Number.isFinite(mins)) return mins;
    return null;
  }

  function getCarNameFictional(li) {
    const el = li.querySelector(".event-header li.car span.t-hide");
    const txt = (el?.textContent || "").trim();
    if (txt) return txt;
    const t2 = (li.querySelector(".event-header li.car")?.textContent || "").trim();
    return t2 || "";
  }

  function getCarNameReal(li) {
    const fic = getCarNameFictional(li);
    return CAR_FICTIONAL_TO_REAL[fic] || fic || "";
  }

  function getCarNameForMode(li) {
    return carNamesAreEffectivelyReal() ? getCarNameReal(li) : getCarNameFictional(li);
  }

  function buildLapOptions() {
    const vals = ["Any"];
    for (let i = 1; i <= 10; i++) vals.push(String(i));
    for (let i = 15; i <= 50; i += 5) vals.push(String(i));
    for (let i = 75; i <= 100; i += 25) vals.push(String(i));
    return vals;
  }

  function buildCarOptionsForMode() {
    const carsFictional = CARCLASS_OPTIONS.filter(v => CAR_CLASS_FIXED_OPTIONS.indexOf(v) === -1);
    const carsReal = carsFictional.map(f => CAR_FICTIONAL_TO_REAL[f] || f);
    return carNamesAreEffectivelyReal() ? CAR_CLASS_FIXED_OPTIONS.concat(carsReal) : CAR_CLASS_FIXED_OPTIONS.concat(carsFictional);
  }

  function lapsOk(li) {
    if (state.laps === "Any") return true;
    const target = parseInt(state.laps, 10);
    if (!Number.isFinite(target)) return true;
    const n = getLaps(li);
    if (n == null) return true;
    return state.lapsMode === "min" ? n >= target : n === target;
  }

  function trackOk(li) {
    if (state.track === "Any") return true;
    return getTrackName(li) === state.track;
  }

  function pwOk(li) {
    if (!supporter.unlocked) return true;
    if (state.pw === "Any") return true;
    const prot = isPasswordProtected(li);
    if (state.pw === "Hide") return !prot;
    if (state.pw === "Show") return prot;
    return true;
  }

  function urtOk(li) {
    if (!supporter.unlocked) return true;
    if (state.urt === "Any") return true;
    const champ = isChampionshipURT(li);
    if (state.urt === "Only") {
      if (!champ) return false;

      const league = state.jltLeague || "Any";
      const group = state.jltGroup || "Any";
      if (league === "Any" && group === "Any") return true;

      const meta = getJltRaceMeta(li);
      if (!meta) return false;
      if (league !== "Any" && meta.league !== league) return false;
      if (group !== "Any" && meta.group !== group) return false;
      return true;
    }
    if (state.urt === "Hide") return !champ;
    return true;
  }

  function carClassOk(li) {
    if (!supporter.unlocked) return true;
    if (!state.carClass || state.carClass === "Any") return true;

    const v = state.carClass;
    const vLow = norm(v);
    const rowText = norm(li.textContent);

    if (["a", "b", "c", "d", "e"].includes(vLow)) {
      const re = new RegExp(`\\bclass\\s*${vLow}\\b|\\b${vLow}\\s*class\\b`, "i");
      return re.test(rowText);
    }

    if (vLow.startsWith("stock ")) {
      const cls = vLow.replace("stock ", "");
      const re = new RegExp(`\\bstock\\b.*\\bclass\\s*${cls}\\b|\\bstock\\s*${cls}\\b`, "i");
      return re.test(rowText);
    }

    const carInRow = norm(getCarNameForMode(li));
    if (!carInRow) return true;
    return carInRow === vLow || carInRow.indexOf(vLow) !== -1;
  }

  function startOk(li) {
    if (!supporter.unlocked) return true;
    if (!state.startMax || state.startMax === "Any") return true;
    const maxMins = parseInt(state.startMax, 10);
    if (!Number.isFinite(maxMins)) return true;
    const mins = getStartMinutes(li);
    if (mins == null) return true;
    return mins <= maxMins;
  }

  function popularityOk(li) {
    if (!supporter.unlocked) return true;
    if (!state.popMin || state.popMin === "Any") return true;
    const minPct = parseInt(state.popMin, 10);
    if (!Number.isFinite(minPct)) return true;
    const { cur, max } = getDrivers(li);
    if (cur == null || max == null || max <= 0) return true;
    const pct = (cur / max) * 100;
    return pct >= minPct;
  }

  function showFullOk(li) {
    if (!supporter.unlocked) return true;
    if (state.showFull) return true;
    const { cur, max } = getDrivers(li);
    if (cur == null || max == null) return true;
    return cur < max;
  }

  function betOk(li) {
    if (!supporter.unlocked) return true;
    if (state.bet === "Any") return true;
    const fee = getFee(li);
    if (fee == null) return true;
    if (state.bet === "Free") return fee === 0;
    if (state.bet === "Bet") return fee > 0;
    return true;
  }

  function keep(li) {
    if (!state.enabled) return true;
    if (!trackOk(li)) return false;
    if (!lapsOk(li)) return false;

    if (!pwOk(li)) return false;
    if (!urtOk(li)) return false;
    if (!carClassOk(li)) return false;
    if (!startOk(li)) return false;
    if (!betOk(li)) return false;
    if (!popularityOk(li)) return false;
    if (!showFullOk(li)) return false;

    return true;
  }

  let applyToken = 0;
  function applyBatched() {
    const items = getItems();
    refreshExternalRealCarNames(items);
    if (!items.length) return;

    const myToken = ++applyToken;
    let i = 0;

    function step() {
      if (myToken !== applyToken) return;

      const end = Math.min(i + BATCH_SIZE, items.length);
      for (; i < end; i++) {
        const li = items[i];
        const shouldShow = keep(li);
        const last = li.dataset.rfShow;
        const now = shouldShow ? "1" : "0";
        if (last !== now) {
          li.dataset.rfShow = now;
          li.style.display = shouldShow ? "" : "none";
        }
      }
      if (i < items.length) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  let tmr = null;
  let applyFrame = null;

  function applyNow() {
    if (tmr) {
      clearTimeout(tmr);
      tmr = null;
    }
    if (applyFrame && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(applyFrame);
      applyFrame = null;
    }
    applyFrame = requestAnimationFrame(() => {
      applyFrame = null;
      applyBatched();
    });
  }

  function scheduleApply() {
    if (tmr) clearTimeout(tmr);
    tmr = setTimeout(() => { tmr = null; applyNow(); }, DEBOUNCE_MS);
  }

  function remountUI() {
    const old = document.getElementById("modulRFOuter");
    if (old) old.remove();
    mountUI();
    applyNow();
  }

  async function restoreSavedLicenseState(opts) {
    const options = Object.assign({ allowRetry: false, clearFatal: false, remountOnUnlock: false }, opts || {});
    const savedLic = await gmGetAsync(STORE.license, "");
    const wasUnlocked = !!supporter.unlocked;
    const myUid = getMyUserId();
    const statusRes = myUid
      ? await verifyLicenseStatusAsync(myUid)
      : { ok: false, reason: "No userID detected" };

    if (statusRes.ok) {
      supporter.unlocked = true;
      supporter.reason = "Verified";
      supporter.exp = Number(statusRes.payload?.exp || 0);
      savedLicenseNeedsRetry = false;
      if (savedLic) await gmSetAsync(STORE.license, "");
      if (options.remountOnUnlock && !wasUnlocked) remountUI();
      return Object.assign({ hasSaved: false, hadCachedLicense: !!savedLic }, statusRes);
    }

    savedLicenseNeedsRetry = !!(options.allowRetry && isRetriableLicenseReason(statusRes.reason));
    supporter.unlocked = false;
    supporter.reason = statusRes.reason || "Locked";
    supporter.exp = 0;

    if (options.clearFatal && !savedLicenseNeedsRetry) {
      await gmSetAsync(STORE.license, "");
      state = resetSupporterSettings(state);
      saveSettings();
    }

    return {
      ok: false,
      reason: statusRes.reason || "No active license found",
      hasSaved: false,
      hadCachedLicense: !!savedLic,
      retriable: savedLicenseNeedsRetry,
      statusChecked: !!statusRes.statusChecked
    };
  }

  function scheduleSavedLicenseRetry() {
    if (!savedLicenseNeedsRetry || supporter.unlocked || savedLicenseRetryBusy) return;
    if (savedLicenseRetryTimer) clearTimeout(savedLicenseRetryTimer);
    savedLicenseRetryTimer = setTimeout(async () => {
      savedLicenseRetryTimer = null;
      if (!savedLicenseNeedsRetry || supporter.unlocked || savedLicenseRetryBusy) return;
      savedLicenseRetryBusy = true;
      try {
        await restoreSavedLicenseState({ allowRetry: true, clearFatal: false, remountOnUnlock: true });
      } catch (_) {
        // Keep the saved key and try again later when the page state changes again.
      } finally {
        savedLicenseRetryBusy = false;
      }
    }, 350);
  }

  function schedulePostMountLicenseCheck(delayMs, force) {
    if (supporter.unlocked || postMountLicenseCheckBusy) return;

    const now = Date.now();
    if (!force && postMountLicenseLastCheckAt && now - postMountLicenseLastCheckAt < POST_MOUNT_LICENSE_CHECK_INTERVAL_MS) {
      return;
    }

    if (postMountLicenseCheckTimer) clearTimeout(postMountLicenseCheckTimer);
    postMountLicenseCheckTimer = setTimeout(async () => {
      postMountLicenseCheckTimer = null;
      if (supporter.unlocked || postMountLicenseCheckBusy) return;

      const uid = getMyUserId();
      if (!uid) {
        savedLicenseNeedsRetry = true;
        scheduleSavedLicenseRetry();
        return;
      }

      postMountLicenseCheckBusy = true;
      postMountLicenseLastCheckAt = Date.now();
      try {
        const res = await verifyLicenseStatusAsync(uid);
        if (res.ok) {
          supporter.unlocked = true;
          supporter.reason = "Verified";
          supporter.exp = Number(res.payload?.exp || 0);
          savedLicenseNeedsRetry = false;
          saveSettings();
          remountUI();
          return;
        }

        supporter.reason = res.reason || supporter.reason || "Locked";
        if (isRetriableLicenseReason(res.reason)) {
          savedLicenseNeedsRetry = true;
          scheduleSavedLicenseRetry();
        }
      } catch (error) {
        savedLicenseNeedsRetry = true;
        scheduleSavedLicenseRetry();
        try { console.warn(TAG, "post-mount license status check failed", error); } catch (_) {}
      } finally {
        postMountLicenseCheckBusy = false;
      }
    }, delayMs == null ? 100 : delayMs);
  }

  let pageObserver = null;
  function startPageObserver() {
    if (pageObserver || !document.body) return;

    pageObserver = new MutationObserver(() => {
      mountUI();
      scheduleApply();
      scheduleSavedLicenseRetry();
      schedulePostMountLicenseCheck(250, false);
    });
    pageObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function makePair(labelText, controlEl) {
    const pair = document.createElement("div");
    pair.className = "rfPair";
    const lab = document.createElement("div");
    lab.className = "rfLbl";
    lab.textContent = labelText;
    pair.append(lab, controlEl);
    return pair;
  }

  function makeChkPair(labelText, chkEl, labelEl) {
    const pair = document.createElement("div");
    pair.className = "rfPair";
    const lab = document.createElement("div");
    lab.className = "rfLbl";
    lab.textContent = labelText;

    const wrap = document.createElement("div");
    wrap.className = "rfChkWrap";
    wrap.append(chkEl, labelEl);

    pair.append(lab, wrap);
    return pair;
  }

  function lockEl(el, locked) {
    el.disabled = !!locked;
    el.classList.toggle("rfLocked", !!locked);
    if (locked) el.title = "Supporter feature";
    else el.title = "";
  }

  function applyTornBtnClasses(btn) {
    btn.classList.add("btn", "btn-action-tab", "btn-dark-bg");
  }

  function makeLicenseAction(text) {
    const el = document.createElement("span");
    el.className = "rfLicenseAction";
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    el.textContent = text;
    return el;
  }

  function stopLicenseEvent(e) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
  }

  function onLicenseAction(el, handler) {
    el.addEventListener("click", (e) => {
      stopLicenseEvent(e);
      handler(e);
    });
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      stopLicenseEvent(e);
      handler(e);
    });
  }

  function fillSelect(select, options) {
    select.classList.add("rfSelect");
    while (select.firstChild) select.removeChild(select.firstChild);

    for (const item of options) {
      const option = document.createElement("option");
      if (typeof item === "string") {
        option.value = item;
        option.textContent = item;
      } else {
        option.value = String(item.v);
        option.textContent = String(item.label);
      }
      select.appendChild(option);
    }
  }

  function findInsertPoint() {
    const startRace = document.querySelector(".messages-race-wrap.start-race");
    const cont = startRace?.querySelector(".cont-black.bottom-round");
    if (startRace && cont && startRace.parentNode) {
      return { parent: startRace.parentNode, after: startRace };
    }

    const wrap = document.querySelector(".custom-events-wrap");
    if (wrap && wrap.parentNode) {
      return { parent: wrap.parentNode, before: wrap };
    }
    return null;
  }

  function mountUI() {
    if (document.getElementById("modulRFOuter")) return true;

    const listExists = document.querySelector(".custom-events-wrap .events-list");
    if (!listExists) return false;

    const ip = findInsertPoint();
    if (!ip) return false;

    const outer = document.createElement("div");
    outer.id = "modulRFOuter";
    outer.className = "messages-race-wrap start-race";

    const title = document.createElement("div");
    title.className = "title-black top-round t-mtop10 rfTitleRow";

    const titleText = document.createElement("span");
    titleText.textContent = "MoDuL’s Custom Race Filter";

    const btnCollapse = document.createElement("button");
    btnCollapse.type = "button";
    btnCollapse.className = "rfCollapseBtn";
    btnCollapse.title = "Collapse / Expand";
    btnCollapse.textContent = ui.collapsed ? "▸" : "▾";

    title.append(titleText, btnCollapse);

    const cont = document.createElement("div");
    cont.className = "cont-black bottom-round";

    cont.style.display = ui.collapsed ? "none" : "";

    btnCollapse.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      ui.collapsed = !ui.collapsed;
      saveUiState_();
      btnCollapse.textContent = ui.collapsed ? "▸" : "▾";
      cont.style.display = ui.collapsed ? "none" : "";
    });

    const sep = document.createElement("div");
    sep.className = "sep";

    const btnNotice = makeLicenseAction("Update notice");
    const btnVerify = makeLicenseAction("Discord Licensing");

    const topRow = document.createElement("div");
    topRow.className = "rfInfoBar border-round";

    const left = document.createElement("div");
    left.className = "rfInfoLeft";
    const icon = document.createElement("span");
    icon.className = "rfInfoIcon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "i";
    const text = document.createElement("div");
    text.className = "rfInfoText";

    const expTxt = supporter.unlocked ? fmtExp_(supporter.exp) : "";
    text.textContent = supporter.unlocked
      ? ("Supporter: Verified ✅" + (expTxt ? ` • 🕒 Expiry: ${expTxt}` : ""))
      : "Supporter: Locked 🔒";

    left.append(icon, text);

    const right = document.createElement("div");
    right.className = "rfInfoRight";
    right.append(btnNotice, btnVerify);

    topRow.append(left, right);

    const licensePanel = document.createElement("div");
    licensePanel.className = "rfLicensePanel";
    licensePanel.hidden = true;

    const licenseTitle = document.createElement("div");
    licenseTitle.className = "rfLicenseTitle";
    licenseTitle.textContent = "Discord licensing";

    const licenseHint = document.createElement("div");
    licenseHint.className = "rfLicenseHint";
    const playerName = getMyPlayerName() || "racer";
    const myUid = getMyUserId();
    licenseHint.textContent = `Hello ${playerName}, licensing for MoDuL scripts has moved to Discord. No manual license key is needed in this panel anymore.`;

    const licenseSteps = document.createElement("ol");
    licenseSteps.className = "rfDiscordSteps";
    [
      "Join the Discord server.",
      "Type /verify and paste a public Torn API key in the popup.",
      "After verification, you receive the Verified role and your Discord nickname is updated to your Torn name and ID.",
      "Type /buylicense, choose Custom Race Filter, then follow the bot instructions.",
      "The bot checks the payment logs and gives your Torn account access automatically. The script unlocks Supporter filters by checking your Torn ID."
    ].forEach(stepText => {
      const li = document.createElement("li");
      li.textContent = stepText;
      licenseSteps.appendChild(li);
    });

    const discordNote = document.createElement("div");
    discordNote.className = "rfDiscordNote";
    discordNote.textContent = (myUid ? `Detected Torn ID: ${myUid}. ` : "Detected Torn ID: none yet. ") +
      "Please make sure DMs from the server are enabled before buying a license.";

    const licenseActions = document.createElement("div");
    licenseActions.className = "rfDiscordActions";
    const btnDiscordOpen = makeLicenseAction("Open Discord");
    const btnLicenseClose = makeLicenseAction("Close");
    licenseActions.append(btnDiscordOpen, btnLicenseClose);

    function setLicensePanelOpen(open) {
      licensePanel.hidden = !open;
      btnVerify.textContent = open ? "Close Info" : "Discord Licensing";
      if (open && !supporter.unlocked) schedulePostMountLicenseCheck(0, true);
    }

    onLicenseAction(btnVerify, (e) => {
      e.preventDefault();
      e.stopPropagation();
      setLicensePanelOpen(licensePanel.hidden);
    });

    onLicenseAction(btnNotice, (e) => {
      e.preventDefault();
      e.stopPropagation();
      openUpdateNoticeModal(false);
    });

    onLicenseAction(btnDiscordOpen, (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(DISCORD_INVITE_URL, "_blank", "noopener,noreferrer");
    });

    onLicenseAction(btnLicenseClose, (e) => {
      e.preventDefault();
      e.stopPropagation();
      setLicensePanelOpen(false);
    });

    licensePanel.append(licenseTitle, licenseHint, licenseSteps, discordNote, licenseActions);

    const btnRow = document.createElement("div");
    btnRow.className = "rfBtns";

    const btnFilter = document.createElement("button");
    btnFilter.type = "button";
    btnFilter.textContent = state.enabled ? "Filter: ON" : "Filter: OFF";
    applyTornBtnClasses(btnFilter);
    btnFilter.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setState({ enabled: !state.enabled });
      btnFilter.textContent = state.enabled ? "Filter: ON" : "Filter: OFF";
      scheduleApply();
    });

    const btnAdv = document.createElement("button");
    btnAdv.type = "button";
    btnAdv.textContent = supporter.unlocked ? (state.advOpen ? "Advanced ▲" : "Advanced ▼") : "Advanced (Supporter)";
    applyTornBtnClasses(btnAdv);

    btnRow.append(btnFilter, btnAdv);

    const grid = document.createElement("div");
    grid.className = "rfGrid";

    const col1 = document.createElement("div");
    col1.className = "rfCol";
    const col2 = document.createElement("div");
    col2.className = "rfCol";

    const selTrack = document.createElement("select");
    fillSelect(selTrack, TRACKS);
    selTrack.value = state.track;
    selTrack.addEventListener("change", () => { setState({ track: selTrack.value }); scheduleApply(); });

    const selLaps = document.createElement("select");
    fillSelect(selLaps, buildLapOptions());
    selLaps.value = state.laps;
    selLaps.addEventListener("change", () => { setState({ laps: selLaps.value }); scheduleApply(); });

    const selMode = document.createElement("select");
    fillSelect(selMode, [{ v: "exact", label: "Exact" }, { v: "min", label: "Min" }]);
    selMode.value = state.lapsMode;
    selMode.addEventListener("change", () => { setState({ lapsMode: selMode.value }); scheduleApply(); });

    const selCarNames = document.createElement("select");
    function syncCarNameSelect() {
      fillSelect(selCarNames, getCarNameModeOptions());
      selCarNames.value = getCarNameModeValue();
      selCarNames.title = externalRealCarNamesDetected
        ? "Real car names detected from another script on this page."
        : "";
    }

    const selCar = document.createElement("select");
    function refillCarSelect() {
      const opts = buildCarOptionsForMode();
      const nextCarClass = coerceCarClassForMode(state.carClass);
      fillSelect(selCar, opts);
      if (nextCarClass !== state.carClass) setState({ carClass: nextCarClass });
      if (opts.indexOf(state.carClass) === -1) setState({ carClass: "Any" });
      selCar.value = state.carClass;
    }

    syncCarNameUi = () => {
      syncCarNameSelect();
      refillCarSelect();
    };
    refreshExternalRealCarNames();
    syncCarNameUi();

    selCarNames.addEventListener("change", () => {
      if (selCarNames.value !== "detected") {
        setState({ useRealCarNames: selCarNames.value === "real", carClass: "Any" });
      }
      refreshExternalRealCarNames();
      syncCarNameSelect();
      refillCarSelect();
      scheduleApply();
    });

    const btnLikeForum = document.createElement("button");
    btnLikeForum.type = "button";
    btnLikeForum.textContent = "👍 Support + Like";
    applyTornBtnClasses(btnLikeForum);
    btnLikeForum.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(FORUM_POST_URL, "_blank", "noopener,noreferrer");
    });

    col1.append(
      makePair("🗺️ Track", selTrack),
      makePair("🎯 Lap mode", selMode),
      makePair("🔁 Laps", selLaps),
      makePair("🏷️ Car names", selCarNames),
      btnLikeForum
    );

    const advWrap = document.createElement("div");
    advWrap.className = "rfAdvWrap";
    advWrap.style.display = (!supporter.unlocked || state.advOpen) ? "" : "none";

    btnAdv.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!supporter.unlocked) return;
      setState({ advOpen: !state.advOpen });
      btnAdv.textContent = state.advOpen ? "Advanced ▲" : "Advanced ▼";
      advWrap.style.display = state.advOpen ? "" : "none";
    });

    const selPw = document.createElement("select");
    fillSelect(selPw, ["Any", "Show", "Hide"]);
    selPw.value = state.pw;
    selPw.addEventListener("change", () => { setState({ pw: selPw.value }); scheduleApply(); });

    const selURT = document.createElement("select");
    fillSelect(selURT, ["Any", "Only", "Hide"]);
    selURT.value = state.urt;
    const selJltLeague = document.createElement("select");
    fillSelect(selJltLeague, JLT_LEAGUE_OPTS);
    selJltLeague.value = state.jltLeague;

    const selJltGroup = document.createElement("select");
    fillSelect(selJltGroup, JLT_GROUP_OPTS);
    selJltGroup.value = state.jltGroup;

    const pairJltLeague = makePair("🏁 League", selJltLeague);
    const pairJltGroup = makePair("🧩 Group", selJltGroup);

    function syncJltFiltersVisibility() {
      const show = supporter.unlocked && state.urt === "Only";
      pairJltLeague.style.display = show ? "" : "none";
      pairJltGroup.style.display = show ? "" : "none";
    }

    selURT.addEventListener("change", () => {
      setState({ urt: selURT.value });
      syncJltFiltersVisibility();
      scheduleApply();
    });
    selJltLeague.addEventListener("change", () => { setState({ jltLeague: selJltLeague.value }); scheduleApply(); });
    selJltGroup.addEventListener("change", () => { setState({ jltGroup: selJltGroup.value }); scheduleApply(); });

    selCar.addEventListener("change", () => { setState({ carClass: selCar.value }); scheduleApply(); });

    const selStart = document.createElement("select");
    fillSelect(selStart, START_MAX_OPTS);
    selStart.value = state.startMax;
    selStart.addEventListener("change", () => { setState({ startMax: selStart.value }); scheduleApply(); });

    const selPop = document.createElement("select");
    fillSelect(selPop, POPULARITY_MIN_OPTS);
    selPop.value = state.popMin;
    selPop.addEventListener("change", () => { setState({ popMin: selPop.value }); scheduleApply(); });

    const selBet = document.createElement("select");
    fillSelect(selBet, ["Any", "Free", "Bet"]);
    selBet.value = state.bet;
    selBet.addEventListener("change", () => { setState({ bet: selBet.value }); scheduleApply(); });

    const cbFull = document.createElement("input");
    cbFull.type = "checkbox";
    cbFull.id = "rfShowFull";
    cbFull.className = "rfChk";
    cbFull.checked = !!state.showFull;
    cbFull.addEventListener("change", () => { setState({ showFull: cbFull.checked }); scheduleApply(); });

    const cbLab = document.createElement("label");
    cbLab.className = "rfChkLabel";
    cbLab.setAttribute("for", "rfShowFull");
    cbLab.textContent = "Show full";

    const supporterControls = [btnAdv, selPw, selURT, selJltLeague, selJltGroup, selCar, selStart, selBet, selPop, cbFull];
    supporterControls.forEach(el => lockEl(el, !supporter.unlocked));

    advWrap.append(
      makePair("🔒 Password", selPw),
      makePair("⭐ URT / JLT", selURT),
      pairJltLeague,
      pairJltGroup,
      makePair("🚗 Car/Class", selCar),
      makePair("⏱️ Start", selStart),
      makePair("💰 Bet", selBet),
      makePair("📈 Popularity", selPop),
      makeChkPair("👥 Status", cbFull, cbLab)
    );

    syncJltFiltersVisibility();

    col2.append(advWrap);
    grid.append(col1, col2);

    const footer = document.createElement("div");
    footer.className = "rfFooter";

    if (!supporter.unlocked) {
      const btnBecome = document.createElement("button");
      btnBecome.type = "button";
      btnBecome.textContent = "Join Discord / Get access";
      applyTornBtnClasses(btnBecome);
      btnBecome.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(DISCORD_INVITE_URL, "_blank", "noopener,noreferrer");
      });
      footer.appendChild(btnBecome);
    }

    cont.append(sep, topRow, licensePanel, btnRow, grid, footer);
    outer.append(title, cont);

    if (ip.after && ip.parent) {
      ip.parent.insertBefore(outer, ip.after.nextSibling);
    } else if (ip.before && ip.parent) {
      ip.parent.insertBefore(outer, ip.before);
    } else {
      return false;
    }

    scheduleApply();
    scheduleUpdateNoticeOnce();
    return true;
  }

  async function boot() {
    state = await loadSettingsAsync();
    ui = await loadUiStateAsync_();

    const savedState = await restoreSavedLicenseState({ allowRetry: true, clearFatal: true });
    if (savedState.ok || savedState.hasSaved) {
      if (supporter.unlocked) {
        saveSettings();
      } else if (!savedState.retriable) {
        saveSettings();
      }
    } else if (!savedState.retriable) {
      state = resetSupporterSettings(state);
      saveSettings();
    }

    if (mountUI()) {
      startPageObserver();
      if (savedState.retriable) scheduleSavedLicenseRetry();
      schedulePostMountLicenseCheck(100, true);
      return;
    }

    startPageObserver();
    if (savedState.retriable) scheduleSavedLicenseRetry();
    schedulePostMountLicenseCheck(250, true);

    let tries = 0;
    const tick = setInterval(() => {
      tries++;
      if (mountUI()) schedulePostMountLicenseCheck(100, true);
      if (document.getElementById("modulRFOuter") || tries > 40) clearInterval(tick);
    }, 250);
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", boot)
    : boot();

})();
