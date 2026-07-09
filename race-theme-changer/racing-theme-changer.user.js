// ==UserScript==
// @name         MoDuL's: Racing Theme Changer
// @namespace    modul.torn.racing
// @version      1.2.6
// @description  Racing Theme Changer (PDA compatible)
// @author       MoDuL, BrainSlug (Thanks for the idea buddy)
// @match        https://www.torn.com/page.php?sid=racing*
// @copyright    2026 MoDuL and BrainSlug. All rights reserved.
// @license      All Rights Reserved
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-idle
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// ==/UserScript==

/*
Copyright (c) 2026 MoDuL and BrainSlug. All rights reserved.
Unauthorized copying, modification, redistribution, or commercial use is prohibited without written permission from the copyright holders.
*/

(function () {
  "use strict";

  if (window.__RACING_THEME_LOADED__) return;
  window.__RACING_THEME_LOADED__ = true;

  var VERSION = "1.2.6";
  var TAG = "[MoDuL Racing Theme Changer v" + VERSION + "]";
  try { console.log(TAG, "Loaded ✅"); } catch (e) {}

  var KEY = "RT_THEME_CLASS";
  var CLASSES = ["A", "B", "C", "D", "E"];
  var storedSelected = gmGet(KEY, "A");
  var selected = normalizeClass(storedSelected) || "A";
  if (selected !== storedSelected) gmSet(KEY, selected);

  var ROOT_ID = "Racing_theme_root";
  var BTN_ID = "Racing_theme_btn";
  var PANEL_ID = "Racing_theme_panel";
  var SELECT_ID = "Racing_theme_select";
  var STYLE_ID = "Racing_theme_style";
  var CONTROLS_ID = "Racing_theme_controls";

  var IMG_SELECTOR_MAIN = ".img-track";
  var IMG_SELECTOR_ANY = "img[class*='img-track']";

  var BTN_SIZE = 28;

  var LOCK_PENCIL_TO_INITIAL_POSITION_KEY = "RT_LOCK_PENCIL_TO_INITIAL_POSITION";
  var LOCK_PENCIL_TO_INITIAL_POSITION = gmGetBool_(LOCK_PENCIL_TO_INITIAL_POSITION_KEY, true);
  var STOP_WHEN_BANNER_OFFSCREEN = true;
  var X_OFFSET = 6;
  var Y_OFFSET = -36;
  var EDGE_PAD = 6;
  var IO_MARGIN = "250px 0px 250px 0px";

  var INFO_BAR_TEXT_LIGHTEN_KEY = "RT_INFO_BAR_TEXT_LIGHTEN";
  var INFO_BAR_BORDER_LIGHTEN_KEY = "RT_INFO_BAR_BORDER_LIGHTEN";
  var INFO_BAR_BORDER_ALPHA_KEY = "RT_INFO_BAR_BORDER_ALPHA";
  var INFO_BAR_GLOW_ALPHA_KEY = "RT_INFO_BAR_GLOW_ALPHA";

  var INFO_BAR_TEXT_LIGHTEN = gmGetNumber_(INFO_BAR_TEXT_LIGHTEN_KEY, 0.45, 0, 1);
  var INFO_BAR_BORDER_LIGHTEN = gmGetNumber_(INFO_BAR_BORDER_LIGHTEN_KEY, 0.30, 0, 1);
  var INFO_BAR_BORDER_ALPHA = gmGetNumber_(INFO_BAR_BORDER_ALPHA_KEY, 0.72, 0, 1);
  var INFO_BAR_GLOW_ALPHA = gmGetNumber_(INFO_BAR_GLOW_ALPHA_KEY, 0.22, 0, 1);

  var bannerInView = true;
  var hasVisibilityObserver = false;
  var raf = 0;
  var moTimer = 0;
  var lastImgSrc = "";
  var lastAppliedClass = "";
  var cssInjected = false;
  var documentCloseBound = false;
  var pencilPositionLocked = false;

  function normalizeClass(value) {
    value = String(value || "").trim().toUpperCase();
    return CLASSES.indexOf(value) === -1 ? "" : value;
  }

  function clampNumber_(value, min, max, fallback) {
    value = Number(value);
    if (!isFinite(value)) value = fallback;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function gmGetNumber_(key, fallback, min, max) {
    return clampNumber_(gmGet(key, fallback), min, max, fallback);
  }

  function gmGetBool_(key, fallback) {
    var value = gmGet(key, fallback ? "1" : "0");
    if (value === true || value === "true" || value === "1" || value === 1) return true;
    if (value === false || value === "false" || value === "0" || value === 0) return false;
    return !!fallback;
  }

  function gmGet(k, def) {
    try { if (typeof GM_getValue === "function") return GM_getValue(k, def); } catch (e) {}
    try {
      var v = localStorage.getItem(k);
      return v == null ? def : v;
    } catch (e2) {}
    return def;
  }

  function gmSet(k, v) {
    try { if (typeof GM_setValue === "function") GM_setValue(k, v); } catch (e) {}
    try { localStorage.setItem(k, v); } catch (e2) {}
  }

  function injectCssOnce() {
    if (cssInjected || document.getElementById(STYLE_ID)) return;

    var css = [
      "#" + ROOT_ID + "{position:" + (LOCK_PENCIL_TO_INITIAL_POSITION ? "absolute" : "fixed") + ";z-index:2147483647;pointer-events:none;left:0;top:0;--rtc-accent:#f5f5f5;--rtc-panel-text:#f5f5f5;--rtc-panel-muted:rgba(255,255,255,0.78);--rtc-panel-bg1:rgba(38,38,38,0.96);--rtc-panel-bg2:rgba(10,10,10,0.94);--rtc-panel-border:rgba(255,255,255,0.20);--rtc-panel-glow:rgba(255,255,255,0.14);--rtc-slider-rest:rgba(255,255,255,0.30);--rtc-slider-thumb:#ffffff;}",
      "#" + BTN_ID + "{pointer-events:auto;width:" + BTN_SIZE + "px;height:" + BTN_SIZE + "px;border-radius:999px;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-tap-highlight-color:transparent;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.20);color:#fff;box-shadow:0 6px 18px rgba(0,0,0,0.35);}",
      "#" + BTN_ID + " svg{width:18px;height:18px;display:block;}",
      "#" + PANEL_ID + "{pointer-events:auto;position:absolute;top:calc(100% + 10px);right:0;min-width:230px;padding:10px;border-radius:12px;color:var(--rtc-panel-text);background:linear-gradient(180deg,var(--rtc-panel-bg1),var(--rtc-panel-bg2));border:1px solid var(--rtc-panel-border);box-shadow:0 12px 28px rgba(0,0,0,0.55),0 0 18px var(--rtc-panel-glow);display:none;}",
      "#" + ROOT_ID + ".open #" + PANEL_ID + "{display:block;}",
      "#" + PANEL_ID + " .ttl{font-weight:700;opacity:.95;margin:2px 0 8px 0;font-size:13px;color:var(--rtc-panel-text);}",
      "#" + SELECT_ID + "{width:100%;border-radius:10px;padding:10px 12px;font-size:16px;background:rgba(255,255,255,0.90);color:#111;border:1px solid var(--rtc-panel-border);outline-color:var(--rtc-accent);}",
      "#" + CONTROLS_ID + "{margin-top:10px;padding-top:10px;border-top:1px solid var(--rtc-panel-border);display:flex;flex-direction:column;gap:8px;color:var(--rtc-panel-text);font-size:12px;}",
      "#" + CONTROLS_ID + " label{display:grid;grid-template-columns:1fr 42px;gap:6px;align-items:center;}",
      "#" + CONTROLS_ID + " .theme-toggle{display:flex;grid-template-columns:none;justify-content:space-between;gap:10px;padding-bottom:2px;}",
      "#" + CONTROLS_ID + " .theme-toggle input{width:16px;height:16px;margin:0;accent-color:var(--rtc-accent);}",
      "#" + CONTROLS_ID + " .theme-slider-name{opacity:.9;}",
      "#" + CONTROLS_ID + " .theme-slider-value{text-align:right;font-variant-numeric:tabular-nums;opacity:.86;}",
      "#" + CONTROLS_ID + " input[type=range]{grid-column:1 / 3;width:100%;height:18px;margin:0;background:transparent;accent-color:var(--rtc-accent);cursor:pointer;-webkit-appearance:none;appearance:none;}",
      "#" + CONTROLS_ID + " input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:999px;border:1px solid rgba(255,255,255,0.24);background:linear-gradient(90deg,var(--rtc-accent) var(--rtc-fill,0%),var(--rtc-slider-rest) var(--rtc-fill,0%));}",
      "#" + CONTROLS_ID + " input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;margin-top:-6px;border-radius:999px;background:var(--rtc-slider-thumb);border:2px solid rgba(0,0,0,0.65);box-shadow:0 1px 4px rgba(0,0,0,0.75),0 0 0 1px rgba(255,255,255,0.38);}",
      "#" + CONTROLS_ID + " input[type=range]::-moz-range-track{height:6px;border-radius:999px;border:1px solid rgba(255,255,255,0.24);background:var(--rtc-slider-rest);}",
      "#" + CONTROLS_ID + " input[type=range]::-moz-range-progress{height:6px;border-radius:999px;background:var(--rtc-accent);}",
      "#" + CONTROLS_ID + " input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:999px;background:var(--rtc-slider-thumb);border:2px solid rgba(0,0,0,0.65);box-shadow:0 1px 4px rgba(0,0,0,0.75),0 0 0 1px rgba(255,255,255,0.38);}",
      "#racingdetails{overflow:hidden !important;height:auto !important;max-height:none !important;}",
    ].join("\n");

    try {
      if (typeof GM_addStyle === "function") {
        var added = GM_addStyle(css);
        if (added && added.nodeType === 1) added.id = STYLE_ID;
        cssInjected = true;
        return;
      }
    } catch (e) {}

    try {
      var s = document.createElement("style");
      s.id = STYLE_ID;
      s.textContent = css;
      (document.head || document.documentElement).appendChild(s);
      cssInjected = true;
    } catch (e2) {}
  }

  function pencilSvg() {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path fill="currentColor" d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25z"/>' +
        '<path fill="rgba(255,255,255,0.85)" d="M20.71 6.04a1.003 1.003 0 0 0 0-1.42L19.37 3.29a1.003 1.003 0 0 0-1.42 0l-1.13 1.13 3.75 3.75 1.14-1.13z"/>' +
      "</svg>"
    );
  }

  function getInfoBarSettings_() {
    return [
      {
        key: INFO_BAR_TEXT_LIGHTEN_KEY,
        label: "Text brightness",
        get: function () { return INFO_BAR_TEXT_LIGHTEN; },
        set: function (value) { INFO_BAR_TEXT_LIGHTEN = value; }
      },
      {
        key: INFO_BAR_BORDER_LIGHTEN_KEY,
        label: "Border brightness",
        get: function () { return INFO_BAR_BORDER_LIGHTEN; },
        set: function (value) { INFO_BAR_BORDER_LIGHTEN = value; }
      },
      {
        key: INFO_BAR_BORDER_ALPHA_KEY,
        label: "Border strength",
        get: function () { return INFO_BAR_BORDER_ALPHA; },
        set: function (value) { INFO_BAR_BORDER_ALPHA = value; }
      },
      {
        key: INFO_BAR_GLOW_ALPHA_KEY,
        label: "Glow strength",
        get: function () { return INFO_BAR_GLOW_ALPHA; },
        set: function (value) { INFO_BAR_GLOW_ALPHA = value; }
      }
    ];
  }

  function formatSliderValue_(value) {
    return Math.round(clampNumber_(value, 0, 1, 0) * 100) + "%";
  }

  function updateRangeFill_(input) {
    if (!input || !input.style) return;
    input.style.setProperty("--rtc-fill", formatSliderValue_(input.value));
  }

  function saveInfoBarSetting_(setting, value) {
    value = clampNumber_(value, 0, 1, setting.get());
    value = Math.round(value * 100) / 100;
    setting.set(value);
    gmSet(setting.key, value);
    refreshAutoColor_();
  }

  function setPencilLock_(enabled) {
    LOCK_PENCIL_TO_INITIAL_POSITION = !!enabled;
    gmSet(LOCK_PENCIL_TO_INITIAL_POSITION_KEY, LOCK_PENCIL_TO_INITIAL_POSITION ? "1" : "0");
    pencilPositionLocked = false;

    var root = document.getElementById(ROOT_ID);
    if (root) root.style.position = LOCK_PENCIL_TO_INITIAL_POSITION ? "absolute" : "fixed";

    schedule();
  }

  function buildPencilLockControl_(box) {
    var label = document.createElement("label");
    var name = document.createElement("span");
    var input = document.createElement("input");

    label.className = "theme-toggle";
    name.textContent = "Lock pencil position";
    input.type = "checkbox";
    input.checked = LOCK_PENCIL_TO_INITIAL_POSITION;

    input.addEventListener("change", function () {
      setPencilLock_(input.checked);
    });

    label.appendChild(name);
    label.appendChild(input);
    box.appendChild(label);
  }

  function buildInfoBarControls(root) {
    var box = root.querySelector("#" + CONTROLS_ID);
    if (!box) return;

    box.textContent = "";
    buildPencilLockControl_(box);

    var settings = getInfoBarSettings_();
    for (var i = 0; i < settings.length; i++) {
      (function (setting) {
        var label = document.createElement("label");
        var name = document.createElement("span");
        var value = document.createElement("span");
        var input = document.createElement("input");

        name.className = "theme-slider-name";
        value.className = "theme-slider-value";
        name.textContent = setting.label;

        input.type = "range";
        input.min = "0";
        input.max = "1";
        input.step = "0.01";
        input.value = String(setting.get());
        value.textContent = formatSliderValue_(setting.get());
        updateRangeFill_(input);

        input.addEventListener("input", function () {
          saveInfoBarSetting_(setting, input.value);
          value.textContent = formatSliderValue_(setting.get());
          updateRangeFill_(input);
        });

        input.addEventListener("change", function () {
          saveInfoBarSetting_(setting, input.value);
          value.textContent = formatSliderValue_(setting.get());
          updateRangeFill_(input);
        });

        label.appendChild(name);
        label.appendChild(value);
        label.appendChild(input);
        box.appendChild(label);
      })(settings[i]);
    }
  }

  function ensureOverlay() {
    var root = document.getElementById(ROOT_ID);
    if (root && document.contains(root)) return root;

    injectCssOnce();

    root = document.createElement("div");
    root.id = ROOT_ID;

    root.innerHTML =
      '<div id="' + BTN_ID + '" title="Change theme">' + pencilSvg() + "</div>" +
      '<div id="' + PANEL_ID + '">' +
        '<div class="ttl">Theme / Track class</div>' +
        '<select id="' + SELECT_ID + '"></select>' +
        '<div id="' + CONTROLS_ID + '"></div>' +
      "</div>";

    document.body.appendChild(root);

    var sel = root.querySelector("#" + SELECT_ID);
    for (var i = 0; i < CLASSES.length; i++) {
      var opt = document.createElement("option");
      opt.value = CLASSES[i];
      opt.textContent = "Class " + CLASSES[i];
      sel.appendChild(opt);
    }
    sel.value = selected;

    buildInfoBarControls(root);

    var btn = root.querySelector("#" + BTN_ID);

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      root.classList.toggle("open");
    });

    sel.addEventListener("change", function (e) {
      var v = e && e.target ? e.target.value : "";
      setSelectedClass(v, "picker");
      root.classList.remove("open");
    });

    if (!documentCloseBound) {
      document.addEventListener("pointerdown", function (e) {
        var r = document.getElementById(ROOT_ID);
        if (!r) return;
        if (!r.contains(e.target)) r.classList.remove("open");
      }, true);
      documentCloseBound = true;
    }

    return root;
  }

  function applyBannerClass(banner, raceClass) {
    for (var i = 0; i < CLASSES.length; i++) banner.classList.remove("class-" + CLASSES[i]);
    banner.classList.add("class-" + raceClass);
  }

  function findClassRibbon() {
    var banner = document.querySelector(".racing-main-wrap");
    if (!banner) return null;

    var nodes = banner.querySelectorAll("div,span,a,strong,b");
    for (var i = 0; i < nodes.length && i < 250; i++) {
      var t = (nodes[i].textContent || "").trim();
      if (/^class\b/i.test(t)) return nodes[i].parentElement || nodes[i];
    }
    return null;
  }

  function parseRgb(rgb) {
    var m = String(rgb || "").match(/rgba?\(\s*(\d+)[^\d]+(\d+)[^\d]+(\d+)/i);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3] };
  }

  function clamp01_(value) {
    value = Number(value);
    if (!isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  function mixRgb_(rgb, target, amount) {
    amount = clamp01_(amount);
    return {
      r: Math.round(rgb.r + (target.r - rgb.r) * amount),
      g: Math.round(rgb.g + (target.g - rgb.g) * amount),
      b: Math.round(rgb.b + (target.b - rgb.b) * amount)
    };
  }

  function rgbCss_(rgb) {
    return "rgb(" + rgb.r + "," + rgb.g + "," + rgb.b + ")";
  }

  function rgbaCss_(rgb, alpha) {
    return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + clamp01_(alpha) + ")";
  }

  function applyMenuTheme_(rgb) {
    var root = document.getElementById(ROOT_ID);
    if (!root || !rgb) return;

    var white = { r: 255, g: 255, b: 255 };
    var black = { r: 0, g: 0, b: 0 };
    var accent = mixRgb_(rgb, white, 0.38);
    var text = mixRgb_(rgb, white, 0.82);
    var bg1 = mixRgb_(rgb, black, 0.68);
    var bg2 = mixRgb_(rgb, black, 0.86);
    var border = mixRgb_(rgb, white, 0.34);

    root.style.setProperty("--rtc-accent", rgbCss_(accent));
    root.style.setProperty("--rtc-panel-text", rgbCss_(text));
    root.style.setProperty("--rtc-panel-muted", rgbaCss_(text, 0.78));
    root.style.setProperty("--rtc-panel-bg1", rgbaCss_(bg1, 0.97));
    root.style.setProperty("--rtc-panel-bg2", rgbaCss_(bg2, 0.96));
    root.style.setProperty("--rtc-panel-border", rgbaCss_(border, 0.64));
    root.style.setProperty("--rtc-panel-glow", rgbaCss_(accent, 0.30));
    root.style.setProperty("--rtc-slider-rest", "rgba(255,255,255,0.30)");
    root.style.setProperty("--rtc-slider-thumb", rgbCss_(mixRgb_(accent, white, 0.45)));
  }

  function applyThemeToRaceDetails(rgb) {
    var ul = document.getElementById("racingdetails");
    if (!ul || !rgb) return;

    ensureRaceDetailsUnder_();

    var textRgb = mixRgb_(rgb, { r: 255, g: 255, b: 255 }, INFO_BAR_TEXT_LIGHTEN);
    var borderRgb = mixRgb_(rgb, { r: 255, g: 255, b: 255 }, INFO_BAR_BORDER_LIGHTEN);
    var textColor = rgbCss_(textRgb);

    ul.style.setProperty("color", textColor, "important");
    ul.style.background = "linear-gradient(rgba(40,40,40,0.90),rgba(10,10,10,0.84))";
    ul.style.setProperty("border", "2px solid " + rgbaCss_(borderRgb, INFO_BAR_BORDER_ALPHA), "important");
    ul.style.borderRadius = "10px";
    ul.style.boxShadow = "0 4px 14px rgba(0,0,0,0.55),0 0 0 1px rgba(0,0,0,0.6),0 0 12px " + rgbaCss_(borderRgb, INFO_BAR_GLOW_ALPHA);
    ul.style.textShadow = "0 1px 2px rgba(0,0,0,0.75)";
    ul.style.backdropFilter = "blur(3px)";
    ul.style.webkitBackdropFilter = "blur(3px)";

    var kids = ul.querySelectorAll("*");
    for (var i = 0; i < kids.length; i++) {
      kids[i].style.setProperty("color", textColor, "important");
    }
  }

  function applyAutoColor(ribbon) {
    var btn = document.getElementById(BTN_ID);
    if (!btn) return;

    var rgb = null;
    try {
      var target = ribbon;
      var kids = ribbon.querySelectorAll("*");
      for (var i = 0; i < kids.length && i < 50; i++) {
        var t = (kids[i].textContent || "").trim();
        if (/^class\b/i.test(t)) { target = kids[i]; break; }
      }
      rgb = parseRgb(window.getComputedStyle(target).color);
    } catch (e) {}

    if (!rgb) return;

    applyMenuTheme_(rgb);

    btn.style.color = "rgb(" + rgb.r + "," + rgb.g + "," + rgb.b + ")";
    btn.style.background = "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.20)";
    btn.style.borderColor = "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.22)";
    btn.style.boxShadow =
      "0 0 0 1px rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.18), " +
      "0 6px 18px rgba(0,0,0,0.38), " +
      "0 0 14px rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.18)";

    applyThemeToRaceDetails(rgb);
  }

  function viewportW() {
    return (window.visualViewport && window.visualViewport.width) ? window.visualViewport.width : window.innerWidth;
  }

  function viewportH() {
    return (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : window.innerHeight;
  }

  function pageX_() {
    return window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
  }

  function pageY_() {
    return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function setHidden(hidden) {
    var btn = document.getElementById(BTN_ID);
    if (!btn) return;
    btn.style.opacity = hidden ? "0" : "1";
    btn.style.pointerEvents = hidden ? "none" : "auto";
    var root = document.getElementById(ROOT_ID);
    if (hidden && root) root.classList.remove("open");
  }

  function placePencil(root, left, top) {
    var vw = viewportW();
    var vh = viewportH();

    if (left < EDGE_PAD) left = EDGE_PAD;
    if (top < EDGE_PAD) top = EDGE_PAD;
    if (left + BTN_SIZE > vw - EDGE_PAD) left = vw - BTN_SIZE - EDGE_PAD;
    if (top + BTN_SIZE > vh - EDGE_PAD) top = vh - BTN_SIZE - EDGE_PAD;

    if (LOCK_PENCIL_TO_INITIAL_POSITION) {
      left += pageX_();
      top += pageY_();
      pencilPositionLocked = true;
    }

    root.style.left = left + "px";
    root.style.top = top + "px";
  }

  function refreshAutoColor_() {
    var ribbon = findClassRibbon();
    if (ribbon) applyAutoColor(ribbon);
  }

  function positionPencil() {
    if (!bannerInView && hasVisibilityObserver && !pencilPositionLocked) return;

    var banner = document.querySelector(".racing-main-wrap");
    if (!banner) { setHidden(true); return; }

    var root = ensureOverlay();

    if (pencilPositionLocked) {
      setHidden(false);
      refreshAutoColor_();
      return;
    }

    var br = banner.getBoundingClientRect();
    if (STOP_WHEN_BANNER_OFFSCREEN) {
      var vh = viewportH();
      var inViewNow = (br.bottom >= -40) && (br.top <= vh + 40);
      if (!inViewNow) { setHidden(true); bannerInView = false; return; }
      bannerInView = true;
    }

    setHidden(false);

    var ribbon = findClassRibbon();
    if (!ribbon) {
      placePencil(root, Math.round(br.right - BTN_SIZE - 10), Math.round(br.top + 10));
      return;
    }

    applyAutoColor(ribbon);

    var rr = ribbon.getBoundingClientRect();
    placePencil(root, Math.round(rr.right - BTN_SIZE - X_OFFSET), Math.round(rr.bottom + Y_OFFSET));
  }

  function getTrackImg() {
    return document.querySelector(IMG_SELECTOR_MAIN);
  }

  function normalizeSrc_(src) {
    src = String(src || "").trim();
    if (!src) return "";
    if (src.indexOf("//casino/") === 0) src = src.slice(1);
    return src;
  }

  function rewriteTrackSrc_(src, classLetter) {
    src = normalizeSrc_(src);
    if (!src) return null;

    var url;
    try {
      url = new URL(src, location.origin);
    } catch (e) {
      return null;
    }

    var path = url.pathname || "";
    var m = path.match(/^\/casino\/race\/images\/([A-Z])(\d+)(?:_s)?\.jpg$/i);
    if (!m) return null;

    var id = m[2];
    var isSmall = /_s\.jpg$/i.test(path);
    url.pathname = "/casino/race/images/" + classLetter + id + (isSmall ? "_s" : "") + ".jpg";

    if (!url.search) url.search = "?v=" + Date.now();
    return url.toString();
  }

  function setTrackImageClass(classLetter) {
    var img = getTrackImg();
    if (!img) return;

    var src = img.getAttribute("src") || img.src || "";
    var newSrc = rewriteTrackSrc_(src, classLetter);
    if (!newSrc) return;
    if (newSrc === src) return;

    img.setAttribute("src", newSrc);
  }

  function setAllTrackThumbsClass_(classLetter) {
    var imgs = document.querySelectorAll(IMG_SELECTOR_ANY);
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      var s = im.getAttribute("src") || im.src || "";
      var ns = rewriteTrackSrc_(s, classLetter);
      if (ns && ns !== s) im.setAttribute("src", ns);
    }
  }

  function ensureRaceDetailsUnder_() {
    var ul = document.getElementById("racingdetails");
    if (!ul) return;

    var tracks = document.querySelector(".track-wrap .tracks");
    if (!tracks) return;

    if (ul.previousElementSibling !== tracks) {
      tracks.insertAdjacentElement("afterend", ul);
    }
    ul.style.position = "static";
  }

  function syncPickerValue() {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;
    var sel = root.querySelector("#" + SELECT_ID);
    if (!sel) return;
    if (sel.value !== selected) sel.value = selected;
  }

  function applyAll(raceClass) {
    if (lastAppliedClass !== raceClass) lastAppliedClass = raceClass;

    var banner = document.querySelector(".racing-main-wrap");
    if (banner) applyBannerClass(banner, raceClass);

    ensureRaceDetailsUnder_();

    setTrackImageClass(raceClass);
    setAllTrackThumbsClass_(raceClass);

    syncPickerValue();
  }

  function setSelectedClass(newClass, sourceTag) {
    if (!newClass) return;
    newClass = normalizeClass(newClass);
    if (!newClass) return;

    if (selected !== newClass) {
      selected = newClass;
      gmSet(KEY, selected);
    }

    applyAll(selected);

    try { console.log(TAG, "Class =", selected, sourceTag ? "(" + sourceTag + ")" : ""); } catch (e) {}
    schedule();
  }

  function schedule() {
    if (!bannerInView && hasVisibilityObserver) return;
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      positionPencil();
      applyAll(selected);
    });
  }

  function scheduleUntilPencilLocks_() {
    if (!pencilPositionLocked) schedule();
  }

  function handleScroll_() {
    if (LOCK_PENCIL_TO_INITIAL_POSITION) {
      scheduleUntilPencilLocks_();
    } else {
      schedule();
    }
  }

  function setupVisibilityObserver(banner) {
    if (!banner || typeof IntersectionObserver !== "function") return;

    var io = new IntersectionObserver(function (entries) {
      var ent = entries && entries[0];
      bannerInView = !!(ent && ent.isIntersecting);
      setHidden(!bannerInView);
      if (bannerInView) schedule();
    }, { root: null, rootMargin: IO_MARGIN, threshold: 0.01 });

    io.observe(banner);
    hasVisibilityObserver = true;
  }

  function setupLightMutationObserver() {
    if (typeof MutationObserver !== "function") return;

    var roots = [];
    var mainRoot = document.getElementById("racingMainContainer");
    var additionalRoot = document.getElementById("racingAdditionalContainer");

    if (mainRoot) roots.push(mainRoot);
    if (additionalRoot && additionalRoot !== mainRoot) roots.push(additionalRoot);
    if (!roots.length && document.body) roots.push(document.body);
    if (!roots.length) return;

    var obs = new MutationObserver(function () {
      if (moTimer) return;
      moTimer = window.setTimeout(function () {
        moTimer = 0;

        ensureRaceDetailsUnder_();

        var img = getTrackImg();
        if (img) {
          var s = img.getAttribute("src") || img.src || "";
          if (s && s !== lastImgSrc) {
            lastImgSrc = s;
            setTrackImageClass(selected);
          }
        }

        setAllTrackThumbsClass_(selected);
        schedule();
      }, 250);
    });

    for (var i = 0; i < roots.length; i++) {
      obs.observe(roots[i], { childList: true, subtree: true });
    }
  }

  function boot() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;

      var banner = document.querySelector(".racing-main-wrap");
      if (!banner) {
        if (tries > 80) clearInterval(t);
        return;
      }

      clearInterval(t);

      ensureOverlay();
      applyAll(selected);

      setupVisibilityObserver(banner);
      setupLightMutationObserver();

      window.addEventListener("resize", schedule, { passive: true });
      window.addEventListener("scroll", handleScroll_, { passive: true });

      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", schedule, { passive: true });
        window.visualViewport.addEventListener("scroll", handleScroll_, { passive: true });
      }

      setTimeout(schedule, 300);
      setTimeout(schedule, 900);
    }, 250);
  }

  boot();
})();
