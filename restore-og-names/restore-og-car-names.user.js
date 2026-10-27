// ==UserScript==
// @name         MoDuL's: Restore OG Car Names
// @namespace    torn.restore.og.cars
// @version      1.3.3
// @description  Restores original car names from Torn fictional ones across Torn (Racing, Item Market, Items, Bazaar, Logs, Mechanic Shop) including all descriptions/text. MoDuL's Race Filter & TornPDA Compatible.
// @author       MoDuL
// @copyright    2026 MoDuL. All rights reserved.
// @license      All Rights Reserved
//
// @match        https://www.torn.com/page.php*
// @match        https://torn.com/page.php*
// @match        https://www.torn.com/loader.php*
// @match        https://torn.com/loader.php*
// @match        https://www.torn.com/item.php*
// @match        https://torn.com/item.php*
// @match        https://www.torn.com/bazaar.php*
// @match        https://torn.com/bazaar.php*
// @match        https://www.torn.com/companies.php*
// @match        https://torn.com/companies.php*
// @match        https://www.torn.com/shops.php?step=docks*
// @match        https://torn.com/shops.php?step=docks*
// @run-at       document-idle
// @grant        GM_info
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      update.greasyfork.org
// @downloadURL https://update.greasyfork.org/scripts/563153/MoDuL%27s%3A%20Restore%20OG%20Car%20Names.user.js
// @updateURL https://update.greasyfork.org/scripts/563153/MoDuL%27s%3A%20Restore%20OG%20Car%20Names.meta.js
// ==/UserScript==

/*
Copyright (c) 2026 MoDuL. All rights reserved.
Unauthorized copying, modification, redistribution, or commercial use is prohibited without written permission.
*/

(function () {
  "use strict";

  const SHOW_CONSOLE_NOTICE = true;
  if (SHOW_CONSOLE_NOTICE) {
    console.info("[Restore OG Car Names] Script injected.");
  }

  const VERSION_FALLBACK = "1.3.3";
  const UPDATE_META_URL = "https://update.greasyfork.org/scripts/563153/MoDuL%27s%3A%20Restore%20OG%20Car%20Names.meta.js";
  const UPDATE_DOWNLOAD_URL = "https://update.greasyfork.org/scripts/563153/MoDuL%27s%3A%20Restore%20OG%20Car%20Names.user.js";
  const UPDATE_CACHE_KEY = "restoreOgCarNames.updateCheck.v1";
  const UPDATE_DISMISS_KEY = "restoreOgCarNames.dismissedUpdate";
  const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

  function getCurrentVersion() {
    try {
      return String(GM_info?.script?.version || VERSION_FALLBACK);
    } catch (_) {
      return VERSION_FALLBACK;
    }
  }

  function isValidVersion(version) {
    return /^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(String(version || ""));
  }

  function compareVersions(left, right) {
    const toNumbers = (version) => String(version)
      .split("-")[0]
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
    const a = toNumbers(left);
    const b = toNumbers(right);
    const length = Math.max(a.length, b.length);

    for (let i = 0; i < length; i++) {
      const difference = (a[i] || 0) - (b[i] || 0);
      if (difference !== 0) return difference;
    }
    return 0;
  }

  function parseVersionFromMetadata(metadata) {
    const match = String(metadata || "").match(/^\s*\/\/\s*@version\s+([^\s]+)\s*$/mi);
    const version = match ? match[1].trim() : "";
    return isValidVersion(version) ? version : "";
  }

  function requestMetadataWithUserscriptApi() {
    const request = typeof GM_xmlhttpRequest === "function"
      ? GM_xmlhttpRequest
      : (typeof GM !== "undefined" && typeof GM.xmlHttpRequest === "function"
        ? GM.xmlHttpRequest.bind(GM)
        : null);

    if (!request) return Promise.reject(new Error("Userscript request API unavailable"));

    return new Promise((resolve, reject) => {
      try {
        request({
          method: "GET",
          url: UPDATE_META_URL,
          headers: { "Cache-Control": "no-cache" },
          timeout: 10000,
          onload(response) {
            if (response.status >= 200 && response.status < 300) {
              resolve(response.responseText || "");
            } else {
              reject(new Error(`Update check returned HTTP ${response.status}`));
            }
          },
          onerror: () => reject(new Error("Update check request failed")),
          ontimeout: () => reject(new Error("Update check request timed out"))
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async function fetchUpdateMetadata() {
    try {
      return await requestMetadataWithUserscriptApi();
    } catch (_) {
      const response = await fetch(UPDATE_META_URL, {
        cache: "no-store",
        credentials: "omit"
      });
      if (!response.ok) throw new Error(`Update check returned HTTP ${response.status}`);
      return response.text();
    }
  }

  function readCachedLatestVersion(currentVersion) {
    try {
      const cached = JSON.parse(localStorage.getItem(UPDATE_CACHE_KEY) || "null");
      if (!cached || cached.currentVersion !== currentVersion) return "";
      if (!isValidVersion(cached.latestVersion)) return "";
      if (!Number.isFinite(cached.checkedAt)) return "";
      if (Date.now() - cached.checkedAt >= UPDATE_CHECK_INTERVAL_MS) return "";
      return cached.latestVersion;
    } catch (_) {
      return "";
    }
  }

  function cacheLatestVersion(currentVersion, latestVersion) {
    try {
      localStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify({
        currentVersion,
        latestVersion,
        checkedAt: Date.now()
      }));
    } catch (_) {
      // Storage can be unavailable in hardened browser contexts.
    }
  }

  function wasUpdateDismissed(latestVersion) {
    try {
      return sessionStorage.getItem(UPDATE_DISMISS_KEY) === latestVersion;
    } catch (_) {
      return false;
    }
  }

  function dismissUpdate(latestVersion) {
    try {
      sessionStorage.setItem(UPDATE_DISMISS_KEY, latestVersion);
    } catch (_) {
      // The toast will still close even if session storage is unavailable.
    }
  }

  function showUpdateToast(currentVersion, latestVersion) {
    if (!document.body || document.getElementById("restore-og-car-names-update-toast")) return;
    if (wasUpdateDismissed(latestVersion)) return;

    const host = document.createElement("div");
    host.id = "restore-og-car-names-update-toast";
    host.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;";

    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      .toast {
        box-sizing: border-box;
        width: min(360px, calc(100vw - 32px));
        padding: 15px 16px;
        border: 1px solid #5f7f35;
        border-radius: 8px;
        background: #202520;
        color: #f2f2f2;
        font: 14px/1.4 Arial, sans-serif;
        box-shadow: 0 8px 24px rgba(0, 0, 0, .42);
        animation: slide-in .22s ease-out;
      }
      .header { display: flex; align-items: flex-start; gap: 12px; }
      .copy { flex: 1; min-width: 0; }
      .title { margin: 0 0 5px; color: #d3eb9a; font-size: 15px; font-weight: 700; }
      .versions { margin: 0; color: #d1d1d1; }
      .versions strong { color: #fff; }
      .close {
        flex: 0 0 auto;
        width: 26px;
        height: 26px;
        margin: -6px -7px 0 0;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 21px;
        line-height: 24px;
      }
      .close:hover, .close:focus-visible { background: #343a34; color: #fff; outline: none; }
      .actions { display: flex; justify-content: flex-end; margin-top: 13px; }
      .update {
        display: inline-block;
        padding: 7px 15px;
        border: 1px solid #779d42;
        border-radius: 5px;
        background: #5d7f31;
        color: #fff;
        font-weight: 700;
        text-decoration: none;
      }
      .update:hover, .update:focus-visible { background: #70963b; outline: 2px solid #b8d887; outline-offset: 2px; }
      @keyframes slide-in { from { opacity: 0; transform: translateY(-8px); } }
      @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
    `;

    const toast = document.createElement("section");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    const header = document.createElement("div");
    header.className = "header";

    const copy = document.createElement("div");
    copy.className = "copy";

    const title = document.createElement("p");
    title.className = "title";
    title.textContent = "Restore OG Car Names update available";

    const versions = document.createElement("p");
    versions.className = "versions";
    versions.append("Current: ");
    const current = document.createElement("strong");
    current.textContent = currentVersion;
    versions.append(current, "  ·  New: ");
    const latest = document.createElement("strong");
    latest.textContent = latestVersion;
    versions.append(latest);

    const close = document.createElement("button");
    close.className = "close";
    close.type = "button";
    close.setAttribute("aria-label", "Skip this update for now");
    close.title = "Skip for now";
    close.textContent = "×";
    close.addEventListener("click", () => {
      dismissUpdate(latestVersion);
      host.remove();
    });

    const actions = document.createElement("div");
    actions.className = "actions";
    const update = document.createElement("a");
    update.className = "update";
    update.href = UPDATE_DOWNLOAD_URL;
    update.target = "_blank";
    update.rel = "noopener noreferrer";
    update.textContent = "Update";

    copy.append(title, versions);
    header.append(copy, close);
    actions.append(update);
    toast.append(header, actions);
    shadow.append(style, toast);
    document.body.append(host);
  }

  async function checkForUpdates() {
    const currentVersion = getCurrentVersion();
    let latestVersion = readCachedLatestVersion(currentVersion);

    if (!latestVersion) {
      try {
        const metadata = await fetchUpdateMetadata();
        latestVersion = parseVersionFromMetadata(metadata);
        if (!latestVersion) return;
        cacheLatestVersion(currentVersion, latestVersion);
      } catch (error) {
        console.debug("[Restore OG Car Names] Update check skipped:", error);
        return;
      }
    }

    if (compareVersions(latestVersion, currentVersion) > 0) {
      showUpdateToast(currentVersion, latestVersion);
    }
  }

  function getSidLower() {
    try {
      const url = new URL(location.href);
      const sid = (url.searchParams.get("sid") || "").trim();
      return sid.toLowerCase();
    } catch (_) {
      const m = location.href.match(/[?&]sid=([^&#]+)/i);
      return (m ? decodeURIComponent(m[1]) : "").trim().toLowerCase();
    }
  }

function isTargetArea() {
  const path = location.pathname.toLowerCase();
  const sid = getSidLower();

  // Direct pages
  if (path.endsWith("/item.php") || path.endsWith("item.php")) return true;
  if (path.endsWith("/bazaar.php") || path.endsWith("bazaar.php")) return true;
  if (path.endsWith("/companies.php") || path.endsWith("companies.php")) return true;

  // Docks shop page
  if (path.endsWith("/shops.php") || path.endsWith("shops.php")) {
    let step = "";
    try {
      step = (new URL(location.href)).searchParams.get("step") || "";
    } catch (_) {
      const m = location.href.match(/[?&]step=([^&#]+)/i);
      step = m ? decodeURIComponent(m[1]) : "";
    }
    if (step.toLowerCase() === "docks") return true;
  }

  // Routed pages via page.php/loader.php
  return sid === "racing" || sid === "itemmarket" || sid === "log";
}

function isInsideRaceFilterUI(nodeOrEl) {
  const el = nodeOrEl?.nodeType === 1 ? nodeOrEl : nodeOrEl?.parentElement;
  return !!(el && el.closest && el.closest("#modulRF"));
}

  // -------------------- Mapping: Fictional -> Original --------------------
  const REPLACEMENTS = {
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
    "Colina Tanprice": "Sierra Cosworth",
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
    "Edomondo IR": "Honda Integra R",
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

  // -------------------- Replacer engine --------------------
  const KEYS = Object.keys(REPLACEMENTS);
  const ESC = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const KEY_REGEX = new RegExp(
    KEYS.sort((a, b) => b.length - a.length).map(ESC).join("|"),
    "g"
  );

  function replaceInString(str) {
    if (!str) return str;
    KEY_REGEX.lastIndex = 0;
    if (!KEY_REGEX.test(str)) return str;
    KEY_REGEX.lastIndex = 0;
    return str.replace(KEY_REGEX, (m) => REPLACEMENTS[m] || m);
  }

  function shouldSkipTextNode(node) {
  const el = node && node.parentElement;
  if (!el) return false;

  // DO NOT rewrite MoDuL Race Filter UI
  if (isInsideRaceFilterUI(node)) return true;

  const tag = el.tagName;
  return (
    tag === "SCRIPT" ||
    tag === "STYLE" ||
    tag === "TEXTAREA" ||
    tag === "INPUT" ||
    tag === "CODE" ||
    tag === "PRE" ||
    tag === "NOSCRIPT"
  );
}


  // ==========================================================
  // Compatibility fix for Race Filter:
  // Keep the *fictional* name hidden in the Racing custom list.
  // ==========================================================
  function patchRacingCarNames(root) {
    // Only needed on racing pages
    if (getSidLower() !== "racing") return;

    const scope = root && root.querySelectorAll ? root : document;
    const nodes = scope.querySelectorAll(".custom-events-wrap .event-header li.car span.t-hide");

    for (const el of nodes) {
      // Avoid re-processing
      if (el.dataset.ogCarPatched === "1") continue;

      const raw = (el.textContent || "").trim();
      if (!raw) { el.dataset.ogCarPatched = "1"; continue; }

      // If it's not a fictional key, mark and skip
      if (!Object.prototype.hasOwnProperty.call(REPLACEMENTS, raw)) {
        el.dataset.ogCarPatched = "1";
        continue;
      }

      // Store fictional once (useful for future scripts)
      if (!el.dataset.ogCarName) el.dataset.ogCarName = raw;

      // Replace visible text with OG
      const og = REPLACEMENTS[raw] || raw;
      if (og !== raw) el.textContent = og;

      // Inject hidden fictional text so li.textContent still contains it
      // (display:none still appears in textContent)
      const next = el.nextElementSibling;
      const hasHidden = next && next.classList && next.classList.contains("ogcar-hidden");

      if (!hasHidden) {
        const hidden = document.createElement("span");
        hidden.className = "ogcar-hidden";
        hidden.style.display = "none";
        hidden.textContent = " " + raw; // space helps separation
        el.insertAdjacentElement("afterend", hidden);
      }

      el.dataset.ogCarPatched = "1";
    }
  }

  function replaceTextNodes(root) {
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT;
        if (shouldSkipTextNode(node)) return NodeFilter.FILTER_REJECT;
        KEY_REGEX.lastIndex = 0;
        return KEY_REGEX.test(node.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const n of nodes) {
      const before = n.nodeValue;
      const after = replaceInString(before);
      if (after !== before) n.nodeValue = after;
    }
  }

  function replaceAttributes(root) {
    if (!root) return;

    root.querySelectorAll("[title],[aria-label],img[alt]").forEach((el) => {
      if (isInsideRaceFilterUI(el)) return;
      if (el.hasAttribute("title")) {
        const v = el.getAttribute("title") || "";
        const n = replaceInString(v);
        if (n !== v) el.setAttribute("title", n);
      }
      if (el.hasAttribute("aria-label")) {
        const v = el.getAttribute("aria-label") || "";
        const n = replaceInString(v);
        if (n !== v) el.setAttribute("aria-label", n);
      }
      if (el.tagName === "IMG" && el.hasAttribute("alt")) {
        const v = el.getAttribute("alt") || "";
        const n = replaceInString(v);
        if (n !== v) el.setAttribute("alt", n);
      }
    });
  }

  function apply() {
    if (!isTargetArea()) return;

    // 1) Do the racing-list compatibility patch first (cheap + targeted)
    patchRacingCarNames(document);

    // 2) Then do the global replacements (text + attributes)
    replaceAttributes(document.body);
    replaceTextNodes(document.body);
  }

  // -------------------- Run Strategy --------------------
  checkForUpdates();
  apply();

  // Burst passes for SPA/React rendering
  let burst = 0;
  const burstTimer = setInterval(() => {
    burst++;
    apply();
    if (burst >= 14) clearInterval(burstTimer);
  }, 250);

  // Navigation changes (hash routing)
  window.addEventListener("hashchange", apply, { passive: true });
  window.addEventListener("popstate", apply, { passive: true });

  // Light debounced observer
  let queued = false;
  const DEBOUNCE_MS = 900;

  function scheduleApply() {
    if (!isTargetArea()) return;
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      apply();
    }, DEBOUNCE_MS);
  }

  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "childList" && m.addedNodes && m.addedNodes.length) {
        scheduleApply();
        return;
      }
      if (m.type === "characterData") {
        scheduleApply();
        return;
      }
    }
  });

  obs.observe(document.body, { subtree: true, childList: true, characterData: true });

  // -- EOF
})();
