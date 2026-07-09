// ==UserScript==
// @name         Stock-X
// @namespace    modul.torn.stockx
// @version      1.0.0
// @description  Secure stock vault using the Torn API. Mobile optimized. Smart ROI Advisor included.
// @author       MoDuL [4022159]
// @copyright    2026 MoDuL. All rights reserved.
// @license      All Rights Reserved
// @match        https://www.torn.com/page.php?sid=stocks*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      tornsy.com
// ==/UserScript==

/*
Copyright (c) 2026 MoDuL. All rights reserved.
Unauthorized copying, modification, redistribution, or commercial use is prohibited without written permission.
*/

// --- CONFIGURATION ---
/* global $, jQuery */
  var VERSION = "1.0.0";
  var TAG = "[Stock-X v" + VERSION + "]";
  try { console.log(TAG, "Loaded ✅"); } catch (e) {}

const DEFAULT_PRESETS = ["5k", "10k", "25k", "50k", "250k", "350k", "1m", "5m", "10m", "25m"];

const STOCK_DATA = {
    "ASS": { base: 1_000_000, type: "A" }, "BAG": { base: 3_000_000, type: "A" },
    "CNC": { base: 7_500_000, type: "A" }, "EWM": { base: 1_000_000, type: "A" },
    "ELT": { base: 5_000_000, type: "P" }, "EVL": { base: 100_000,  type: "A" },
    "FHG": { base: 2_000_000, type: "A" }, "GRN": { base: 500_000, type: "A" },
    "CBD": { base: 350_000,   type: "A" }, "HRG": { base: 10_000_000,type: "A" },
    "IIL": { base: 1_000_000, type: "P" }, "IOU": { base: 3_000_000, type: "A" },
    "IST": { base: 100_000,   type: "P" }, "LAG": { base: 750_000, type: "A" },
    "LOS": { base: 7_500_000, type: "P" }, "LSC": { base: 500_000, type: "A" },
    "MCS": { base: 350_000,   type: "A" }, "MSG": { base: 300_000, type: "P" },
    "MUN": { base: 5_000_000, type: "A" }, "PRN": { base: 1_000_000, type: "A" },
    "PTS": { base: 10_000_000,type: "A" }, "SYM": { base: 500_000, type: "A" },
    "SYS": { base: 3_000_000, type: "P" }, "TCP": { base: 1_000_000, type: "P" },
    "TMI": { base: 6_000_000, type: "A" }, "TGP": { base: 2_500_000, type: "P" },
    "TCT": { base: 100_000,   type: "A" }, "TSB": { base: 3_000_000, type: "A" },
    "TCC": { base: 7_500_000, type: "A" }, "THS": { base: 150_000,    type: "A" },
    "TCI": { base: 1_500_000, type: "P" }, "TCM": { base: 1_000_000, type: "P" },
    "WSU": { base: 1_000_000, type: "P" }, "WLT": { base: 9_000_000, type: "P" },
    "YAZ": { base: 1_000_000, type: "P" }
};

// --- ADVISOR CONSTANTS ---
const ADVISOR_ITEMS = {
    // Boosters & Drugs (Cost Calc)
    206: "Xanax", 367: "Feathery Hotel Coupon",

    // Energy Drinks (Cans)
    530: "Can of Munster", 532: "Can of Red Cow", 533: "Can of Taurine Elite",
    553: "Can of Santa Shooters", 554: "Can of Rockstar Rudolph", 555: "Can of X-MASS",
    985: "Can of Goose Juice", 986: "Can of Damp Valley", 987: "Can of Crocozade",

    // Stock Benefit Items
    364: "Box of Grenades", 365: "Box of Medical Supplies", 366: "Erotic DVD",
    368: "Lawyer's Business Card", 369: "Lottery Voucher",
    370: "Drug Pack", 817: "Six-Pack of Alcohol", 818: "Six-Pack of Energy Drink",

    // Caches (TCC)
    1057: "Gentleman's Cache", 1112: "Elegant Cache", 1113: "Naughty Cache",
    1114: "Elderly Cache", 1115: "Denim Cache", 1116: "Wannabe Cache", 1117: "Cutesy Cache"
};
const TCC_CACHE_IDS = [1057, 1112, 1113, 1114, 1115, 1116, 1117];

const ADVISOR_DATA = {
    "MUN": { type: "item", id: 818, freq: 7 }, "ASS": { type: "item", id: 817, freq: 7 },
    "HRG": { type: "manual", label: "Avg Property Value", freq: 31 },
    "LSC": { type: "item", id: 369, freq: 7 }, "LAG": { type: "item", id: 368, freq: 7 },
    "FHG": { type: "item", id: 367, freq: 7 }, "PRN": { type: "item", id: 366, freq: 7 },
    "SYM": { type: "item", id: 370, freq: 7 }, "TCC": { type: "average", ids: TCC_CACHE_IDS, freq: 31 },
    "THS": { type: "item", id: 365, freq: 7 }, "EWM": { type: "item", id: 364, freq: 7 },
    "BAG": { type: "passive" }, "CNC": { type: "cash", val: 80_000_000, freq: 31 },
    "TSB": { type: "cash", val: 50_000_000, freq: 31 }, "TMI": { type: "cash", val: 25_000_000, freq: 31 },
    "IOU": { type: "cash", val: 12_000_000, freq: 31 }, "GRN": { type: "cash", val: 4_000_000, freq: 31 },
    "TCT": { type: "cash", val: 1_000_000, freq: 31 }
};

let autoSyncTimer = null; // Stores the auto-refresh timer ID
let portfolioTransactions = {}; // Stores buy history
let lastNwCache = null; // Stores the last known networth data
let lastSync = 0;
let itemPrices = {};
try { itemPrices = JSON.parse(localStorage.getItem("MoDuL_advisor_prices")) || {}; } catch(e) { itemPrices = {}; }

let networthSettings = { sources: { inventory: false, points: true, stocks: true }, excludedStocks: [], excludeMode: "all" };
try {
    let savedNW = JSON.parse(localStorage.getItem("MoDuL_advisor_networth"));
    if(savedNW) { networthSettings = savedNW; if(!networthSettings.excludeMode) networthSettings.excludeMode = "all"; }
} catch(e) {}

const BANK_BASE_RATES = { "1w": 0.7917, "2w": 1.7833, "1m": 4.3, "2m": 9.8, "3m": 16.5 };
let bankSettings = { roi_1w: 0, roi_2w: 0, roi_1m: 0, roi_2m: 0, roi_3m: 0, active_period: "2w" };
try { let savedBank = JSON.parse(localStorage.getItem("MoDuL_advisor_bank")); if(savedBank) bankSettings = savedBank; } catch(e) {}

let stocks = {}, stockId = {}, stockRows = {}, localShareCache = {};

// NEW: Load saved transactions from storage on startup
try {
    portfolioTransactions = JSON.parse(localStorage.getItem("MoDuL_advisor_transactions")) || {};
} catch(e) {
    portfolioTransactions = {};
}

// --- UTILITIES ---
function createModal(title, contentHtml) {
    // 1. If a modal is already open, hide it (don't delete it!)
    if ($(".MoDuL-modal").length > 0) {
        $(".MoDuL-modal").last().hide();
    }

    // 2. Create the new overlay and modal
    // We add a class 'MoDuL-overlay-layer' so we can track them
    let modal = `
        <div class="MoDuL-modal-overlay MoDuL-overlay-layer">
            <div class="MoDuL-modal">
                <div class="MoDuL-modal-header">
                    <h3>${title}</h3>
                    <span class="MoDuL-modal-close">&times;</span>
                </div>
                <div class="MoDuL-modal-body">${contentHtml}</div>
            </div>
        </div>`;

    $(document.body).append(modal);

    // 3. Logic for the Close button
    $(".MoDuL-modal-close").last().on("click", function() {
        // Remove the current (top) layer
        $(this).closest(".MoDuL-modal-overlay").remove();

        // Show the previous layer if it exists
        if ($(".MoDuL-modal").length > 0) {
            $(".MoDuL-modal").last().show();
        }
    });
}


function parseTornNumber(val) {
    if (typeof val !== "string") return 0;
    val = val.trim().toLowerCase();
    if (!val) return 0;
    if (val.endsWith("k")) return parseFloat(val.replace("k", "")) * 1_000;
    if (val.endsWith("m")) return parseFloat(val.replace("m", "")) * 1_000_000;
    if (val.endsWith("b")) return parseFloat(val.replace("b", "")) * 1_000_000_000;
    return parseFloat(val.replace(/,/g, ""));
}

function formatMoney(amount) { return "$" + amount.toLocaleString('en-US'); }
function formatNumberToKMB(num) {
    if (num === 0) return '0';
    const absNum = Math.abs(num);
    if (absNum >= 1e9) return (num / 1e9).toFixed(3).replace(/\.?0+$/, "") + "b";
    if (absNum >= 1e6) return (num / 1e6).toFixed(2).replace(/\.?0+$/, "") + "m";
    if (absNum >= 1e3) return (num / 1e3).toFixed(1).replace(/\.?0+$/, "") + "k";
    return num.toLocaleString();
}
function getRFC() { var c = document.cookie.match(/rfc_v=([^;]+)/); return c ? c[1] : ""; }

function getBenefitTier(sym, shares) {
    let data = STOCK_DATA[sym];
    if (!data) return { tier: 0, next: 0, label: "Unknown" };
    if (data.type === "P") return (shares >= data.base) ? { tier: 1, next: data.base } : { tier: 0, next: data.base };
    let multiplier = 1;
    while (shares >= data.base * (multiplier * 2)) { multiplier *= 2; }
    return (shares < data.base) ? { tier: 0 } : { tier: multiplier, next: data.base * multiplier * 2 };
}

// 1. Force API Sync
function getApiKey() {
    try {
        if (typeof GM_getValue === "function") {
            return (GM_getValue("MoDuL_vault_apikey", "") || "").trim();
        }
    } catch (e) {}
    return (localStorage.getItem("MoDuL_vault_apikey") || "").trim();
}

function setApiKey(key) {
    const clean = (key || "").trim();

    try {
        if (typeof GM_setValue === "function") {
            GM_setValue("MoDuL_vault_apikey", clean);
        }
    } catch (e) {}

    // fallback copy for compatibility
    localStorage.setItem("MoDuL_vault_apikey", clean);
}

function requireApiKey() {
    const key = getApiKey();
    if (key) return key;

    $("#responseStock")
        .html('API key missing. Open <strong>🔑 API Key</strong> and paste a <strong>Limited Access</strong> key.')
        .css("color", "orange");

    $("#MoDuL-api-wrap").addClass("is-open");
    $("#MoDuL-api-input").trigger("focus");

    return "";
}
function setupApiPanel() {
    const $wrap = $(".MoDuL-api-wrap");
    const $toggle = $("#MoDuL-api-toggle");
    const $panel = $("#MoDuL-api-panel");
    const $input = $("#MoDuL-api-input");
    const $save = $("#MoDuL-api-save");
    const $clear = $("#MoDuL-api-clear");

    if (!$wrap.length || !$toggle.length || !$panel.length) return;

    $toggle.off("click").on("click", function(e) {
        e.stopPropagation();
        $wrap.toggleClass("is-open");
        if ($wrap.hasClass("is-open")) {
            $input.trigger("focus").trigger("select");
        }
    });

    $save.off("click").on("click", function(e) {
        e.stopPropagation();
        const key = ($input.val() || "").trim();
        setApiKey(key);

        $("#responseStock")
            .html("API key saved.")
            .css("color", "green");

        $wrap.removeClass("is-open");
    });

    $clear.off("click").on("click", function(e) {
        e.stopPropagation();
        setApiKey("");
        $input.val("");

        $("#responseStock")
            .html("API key cleared.")
            .css("color", "orange");

        $wrap.removeClass("is-open");
    });

    $input.off("keydown").on("keydown", function(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            $save.trigger("click");
        } else if (e.key === "Escape") {
            $wrap.removeClass("is-open");
        }
    });

    $(document).off("click.modulApiPanel").on("click.modulApiPanel", function() {
        $wrap.removeClass("is-open");
    });

    $panel.off("click").on("click", function(e) {
        e.stopPropagation();
    });
}
async function syncWallet(silent = false) {
    let key = requireApiKey(); if (!key) return;
    if (!key) return 0;
    if (Date.now() - lastSync < 2000) return 0;
    lastSync = Date.now();
    if (!silent) $("#responseStock").html("Syncing...").css("color", "orange");
    try {
        const response = await fetch(`https://api.torn.com/user/?selections=money&key=${key}&ts=${Date.now()}`);
        const data = await response.json();
        if (data.money_onhand !== undefined) {
            let money = data.money_onhand;
            if ($("#user-money").length > 0) $("#user-money").attr("data-money", money).text("$" + money.toLocaleString());
            if (!silent) $("#responseStock").html(`Synced: $${money.toLocaleString()}`).css("color", "green");
            return money;
        }
    } catch (e) { if (!silent) $("#responseStock").html("Sync Failed").css("color", "red"); }
    return 0;
}

// 2. Read Money from Screen
function getMoneyFast() {
    let dataMoney = $("#user-money").attr("data-money");
    if (dataMoney) return parseFloat(dataMoney);
    let textMoney = $("#user-money").text();
    return textMoney ? parseTornNumber(textMoney) : 0;
}

// --- INITIALIZATION ---
function insert() {
    let current = localStorage.MoDuL_vault_target;
    if ($("ul[class^='stock_']").length == 0) { setTimeout(insert, 500); return; }

    let symbols = [];
    $("ul[class^='stock_']").each(function() {
        let sym = $("img", $(this)).attr("src").split("logos/")[1].split(".svg")[0];
        symbols.push(sym);
        stockId[sym] = $(this).attr("id");
        stocks[sym] = $("div[class^='price_']", $(this));
        stockRows[sym] = $(this);
    });
    symbols.sort();

    let container = `
    <div class="MoDuL-container">
        <div id="MoDuL-pl-container" class="MoDuL-pl-container">
            <div id="MoDuL-pl-display" class="MoDuL-pl-display">
                Waiting for API Sync...
                <button id="MoDuL-force-sync" class="MoDuL-link-btn" type="button">Sync Now</button>
            </div>
        </div>

        <div class="MoDuL-header">
            <div class="MoDuL-header-spacer"></div>
            <div class="MoDuL-header-actions">
                <div class="MoDuL-api-wrap">
                    <button id="MoDuL-api-toggle" class="MoDuL-top-btn MoDuL-top-btn-api" type="button">🔑 API Key</button>

                    <div id="MoDuL-api-panel" class="MoDuL-api-panel">
                        <input
                            type="password"
                            id="MoDuL-api-input"
                            class="MoDuL-input MoDuL-api-input"
                            placeholder="Paste Torn API key"
                            value="${getApiKey() || ""}"
                        >
                        <button id="MoDuL-api-save" class="MoDuL-main-btn MoDuL-api-save" type="button">Save</button>
                        <button id="MoDuL-api-clear" class="MoDuL-main-btn MoDuL-api-clear" type="button">Clear</button>
                        <div class="MoDuL-api-note">A Limited Access key is required.</div>
                    </div>
                </div>

                <button id="MoDuL-advisor-btn" class="MoDuL-top-btn" type="button">★ Advisor</button>
                <button id="MoDuL-trade-btn" class="MoDuL-top-btn" type="button">📈 Trade Assistant</button>
            </div>
        </div>

        <div class="MoDuL-section-bar">
            <span>Target</span>
        </div>

        <div class="MoDuL-row MoDuL-target-row">
            <div id="MoDuL-stock-picker" class="MoDuL-stock-picker">
                <button id="MoDuL-stock-trigger" class="MoDuL-stock-trigger" type="button">Select Stock...</button>
                <div id="MoDuL-stock-menu" class="MoDuL-stock-menu"></div>
            </div>

            <input type="hidden" id="stockid" value="${current || ""}">

            <div id="MoDuL-owned-display" class="MoDuL-owned-display">
                <span class="MoDuL-owned-label">Owned</span>
                <span class="MoDuL-owned-value MoDuL-muted">-</span>
            </div>
        </div>

        <div class="MoDuL-row MoDuL-action-row">
            <div class="MoDuL-action-group MoDuL-action-group-vault">
                <button id="vaultall" class="MoDuL-main-btn">Vault Max</button>
                <input
                    type="text"
                    placeholder="Keep Amt"
                    id="keepval"
                    class="MoDuL-input MoDuL-input-100"
                    value="${localStorage.getItem("MoDuL_vault_keepVal") || ""}"
                >
                <button id="vaultexcept" class="MoDuL-main-btn">Vault (Keep)</button>
            </div>

            <div class="MoDuL-action-group MoDuL-action-group-withdraw">
                <input
                    type="text"
                    placeholder="Withdraw Amt"
                    id="sellval"
                    class="MoDuL-input MoDuL-input-120"
                    value="${localStorage.getItem("MoDuL_vault_sellVal") || ""}"
                >
                <button id="sellamt" class="MoDuL-main-btn">Withdraw</button>
            </div>

            <div class="MoDuL-action-group MoDuL-action-group-all">
                <button id="sellall-init" class="MoDuL-main-btn MoDuL-btn-muted">Withdraw All</button>
                <div id="sellall-confirm" class="MoDuL-confirm-row">
                    <button id="sellall-yes" class="MoDuL-main-btn MoDuL-pill-success">Yes</button>
                    <button id="sellall-no" class="MoDuL-main-btn MoDuL-pill-danger">No</button>
                </div>
            </div>
        </div>

        <div class="MoDuL-toolbar">
            <div class="MoDuL-flex MoDuL-gap-15">
                <label class="MoDuL-small-label">
                    <input type="checkbox" id="MoDuL-instant-toggle" ${localStorage.getItem("MoDuL_vault_instant") === "true" ? "checked" : ""}>
                    Instant
                </label>
                <label class="MoDuL-small-label">
                    <input type="checkbox" id="MoDuL-lock-toggle" ${localStorage.getItem("MoDuL_vault_lock") === "true" ? "checked" : ""}>
                    Lock Benefits
                </label>
                <label class="MoDuL-small-label" title="Replaces presets with your active RR Tracker bets + $1k">
                    <input type="checkbox" id="MoDuL-rrbets-toggle" ${localStorage.getItem("MoDuL_vault_rrbets") === "true" ? "checked" : ""}>
                    🎲 RR Bets
                </label>
            </div>
            <span id="MoDuL-edit-trigger" class="MoDuL-link MoDuL-font-11">Edit Buttons</span>
        </div>

        <div class="MoDuL-section-bar">
            <span>Quick Withdraw</span>
        </div>

        <div class="MoDuL-preset-section">
            <div id="MoDuL-preset-row" class="MoDuL-preset-row"></div>
        </div>

        <div class="MoDuL-row MoDuL-mt-10">
            <span id="responseStock"></span>
        </div>
    </div>
    `;

    $("#stockmarketroot").prepend(container);
    buildStockPicker(symbols, current || "");
    setupApiPanel();

    $("#MoDuL-advisor-btn").on("click", openAdvisorMain);
    $("#vaultall").on("click", vault);
    $("#vaultexcept").on("click", vaultExcept);
    $("#sellamt").on("click", () => withdraw());

    $("#MoDuL-instant-toggle").on("change", function() {
        localStorage.setItem("MoDuL_vault_instant", $(this).is(":checked"));
    });
    $("#MoDuL-lock-toggle").on("change", function() {
        localStorage.setItem("MoDuL_vault_lock", $(this).is(":checked"));
    });
    $("#MoDuL-rrbets-toggle").on("change", function() {
        localStorage.setItem("MoDuL_vault_rrbets", $(this).is(":checked"));
        renderPresets();
    });

    window.addEventListener("storage", (e) => {
        if (e.key === "rr_exported_bets" && localStorage.getItem("MoDuL_vault_rrbets") === "true") {
            renderPresets();
        }
    });

    $("#sellval").on("keyup", function() { handleInputUpdate(this, "MoDuL_vault_sellVal"); });
    $("#keepval").on("keyup", function() { handleInputUpdate(this, "MoDuL_vault_keepVal"); });
    $("#MoDuL-edit-trigger").on("click", renderEditMode);
    $("#MoDuL-trade-btn").on("click", openTradeAssistant);

    $("#sellall-init").on("click", function() {
        $(this).hide();
        $("#sellall-confirm").css("display", "flex");
    });

    $("#sellall-no").on("click", function() {
        $("#sellall-confirm").hide();
        $("#sellall-init").show();
    });

    $("#sellall-yes").on("click", function() {
        withdrawAll();
        $("#sellall-confirm").hide();
        $("#sellall-init").show();
    });

    $("#MoDuL-force-sync").on("click", function() {
        fetchUserPortfolio();
    });

    renderPresets();
    updateStock();

    if (Object.keys(portfolioTransactions).length > 0) {
        updatePortfolioPerformance();
    }

    if (autoSyncTimer) clearInterval(autoSyncTimer);
    autoSyncTimer = setInterval(function() {
        if ($("#MoDuL-pl-container").length > 0) {
            fetchUserPortfolio();
        } else {
            clearInterval(autoSyncTimer);
        }
    }, 30000);
}
// --- CORE FUNCTIONS ---
function getOwnedShares(id) {
    if (localShareCache[id] !== undefined) return localShareCache[id];
    let row = stockRows[id];
    if (!row) return 0;
    let mobileEl = row.find("p[class^='count']");
    if(mobileEl.length > 0) return parseFloat(mobileEl.text().replace(/,/g, '')) || 0;
    let cols = row.children("div");
    if(cols.length >= 5) return parseFloat($(cols[4]).text().replace(/,/g, '')) || 0;
    return 0;
}

function buildStockPicker(symbols, selectedValue) {
    const $picker = $("#MoDuL-stock-picker");
    const $menu = $("#MoDuL-stock-menu");
    const $trigger = $("#MoDuL-stock-trigger");
    const $input = $("#stockid");

    if (!$picker.length || !$menu.length || !$trigger.length || !$input.length) return;

    let html = `<div class="MoDuL-stock-option ${!selectedValue ? "is-selected" : ""}" data-value="">Select Stock...</div>`;

    for (const sy of symbols) {
        html += `<div class="MoDuL-stock-option ${selectedValue === sy ? "is-selected" : ""}" data-value="${sy}">${sy}</div>`;
    }

    $menu.html(html);
    $input.val(selectedValue || "");
    $trigger.text(selectedValue || "Select Stock...");

    $trigger.off("click").on("click", function(e) {
        e.stopPropagation();
        $picker.toggleClass("is-open");
    });

    $menu.off("click", ".MoDuL-stock-option").on("click", ".MoDuL-stock-option", function(e) {
        e.stopPropagation();

        const value = $(this).attr("data-value") || "";
        $input.val(value);
        localStorage.MoDuL_vault_target = value;
        $trigger.text(value || "Select Stock...");

        $menu.find(".MoDuL-stock-option").removeClass("is-selected");
        $(this).addClass("is-selected");

        $picker.removeClass("is-open");
        updateStock();
    });

    $(document).off("click.modulStockPicker").on("click.modulStockPicker", function() {
        $picker.removeClass("is-open");
    });
}

function updateStock() {
    let symb = $("#stockid").val() || "";
    localStorage.MoDuL_vault_target = symb;

    if ($("#MoDuL-stock-trigger").length) {
        $("#MoDuL-stock-trigger").text(symb || "Select Stock...");
    }

    if ($("#MoDuL-stock-menu").length) {
        $("#MoDuL-stock-menu .MoDuL-stock-option").removeClass("is-selected");

        const $selected = $(`#MoDuL-stock-menu .MoDuL-stock-option[data-value="${symb}"]`);
        if ($selected.length) {
            $selected.addClass("is-selected");
        } else {
            $('#MoDuL-stock-menu .MoDuL-stock-option[data-value=""]').addClass("is-selected");
        }
    }

    const $ownedValue = $("#MoDuL-owned-display .MoDuL-owned-value");
    if (!$ownedValue.length) return;

    if (symb) {
        const owned = getOwnedShares(symb);
        $ownedValue
            .text(owned.toLocaleString())
            .removeClass("MoDuL-muted MoDuL-accent")
            .addClass(owned > 0 ? "MoDuL-accent" : "MoDuL-muted");
    } else {
        $ownedValue
            .text("-")
            .removeClass("MoDuL-accent")
            .addClass("MoDuL-muted");
    }
}

function updateLocalCache(sym, amt) {
    let current = getOwnedShares(sym);
    localShareCache[sym] = Math.max(0, current + amt);
    updateStock();
}



function openDiagnosticTool() {
    let simRows = [];
    let symbols = Object.keys(STOCK_DATA);
    let safeNw = lastNwCache || { liquid: 0, pureCash: 0, bankActive: false, bankPrincipal: 0 };

    let savedState = JSON.parse(localStorage.getItem("MoDuL_advisor_diag_state"));
    const checkOwnership = (id, liveStatus) => {
        if (savedState && savedState.checked) return savedState.checked.includes(id);
        return liveStatus;
    };

    const IGNORED = ["BAG", "EVL", "CBD", "MCS"];

    for (let sym of symbols) {
        if (IGNORED.includes(sym)) continue;
        let sData = STOCK_DATA[sym];
        if (sData.type === "P" && sym !== "PTS") continue;

        let price = getPrice(sym);
        if (price === 0) continue;

        let dailyYield = getDailyYield(sym);
        let increment = sData.base;
        let owned = getOwnedShares(sym);

        if (sym === "PTS") {
            let ptsPrice = itemPrices["points"] || 0;
            if (ptsPrice > 0) dailyYield = (ptsPrice * 100) / 7;
        }

        let currentRealTier = 0;
        if (owned >= increment) {
            if (sData.type === "P") currentRealTier = (owned >= increment) ? 1 : 0;
            else currentRealTier = Math.floor(Math.log2((owned / increment) + 1));
        }

        let maxTier = (sData.type === "P") ? 1 : 5;
        for (let i = 1; i <= maxTier; i++) {
            let id = `${sym}-${i}`;
            let tierShares = (sData.type === "P") ? increment : increment * Math.pow(2, i - 1);
            let tierCost = tierShares * price;
            let tierRoi = (tierCost > 0) ? ((dailyYield * 365) / tierCost) * 100 : 0;
            let isOwnedLive = (i <= currentRealTier);
            let isOwned = checkOwnership(id, isOwnedLive);

            simRows.push({
                id: id,
                name: sym,
                tier: i,
                roi: tierRoi,
                cost: tierCost,
                isOwned: isOwned,
                sym: sym
            });
        }
    }

    let bankPrincipal = safeNw.bankActive ? safeNw.bankPrincipal : 2_000_000_000;
    if (savedState && savedState.bankAmount) bankPrincipal = parseInt(savedState.bankAmount);

    let bankLocked = safeNw.bankActive;
    if (savedState && savedState.bankLocked !== undefined) bankLocked = savedState.bankLocked;

    ["3m"].forEach(term => {
        let rate = bankSettings["roi_" + term] || 0;
        if (rate > 0) {
            let id = `BANK-${term}`;
            let isOwnedLive = safeNw.bankActive;
            let isOwned = checkOwnership(id, isOwnedLive);

            simRows.push({
                id: id,
                name: `City Bank (${term})`,
                tier: 0,
                roi: rate,
                cost: bankPrincipal,
                isOwned: isOwned,
                sym: "BANK",
                isLocked: bankLocked,
                investedAmount: bankPrincipal
            });
        }
    });

    let calculatedInvested = 0;
    simRows.forEach(r => { if (r.isOwned) calculatedInvested += r.cost; });

    let startCash = savedState ? savedState.cash : (safeNw.pureCash + calculatedInvested);
    simRows.sort((a, b) => b.roi - a.roi);
    window.simRowsData = simRows;

    let tableRows = simRows.map(r => {
        let nameDisplay = r.sym === "BANK"
        ? r.name
        : `${r.name} <span class="MoDuL-tier-tag">(T${r.tier})</span>`;

        let extraInputs = r.sym === "BANK" ? `
            <div class="MoDuL-bank-extra-row">
                <input
                    type="text"
                    class="sim-bank-amt MoDuL-tbl-input MoDuL-bank-amt-input"
                    data-id="${r.id}"
                    value="${r.investedAmount.toLocaleString("en-US")}"
                >
                <label class="MoDuL-bank-lock-label">
                    <input type="checkbox" class="sim-bank-lock" data-id="${r.id}" ${r.isLocked ? "checked" : ""}>
                    Lock
                </label>
            </div>` : "";

        return `
            <tr id="row-${r.id}" class="sim-row">
                <td class="MoDuL-cell-center">
                    <input type="checkbox" class="sim-check" data-id="${r.id}" ${r.isOwned ? "checked" : ""}>
                </td>
                <td>${nameDisplay}${extraInputs}</td>
                <td class="MoDuL-cell-top-right">${r.roi.toFixed(2)}%</td>
                <td class="MoDuL-cell-top-right">${formatMoney(r.cost)}</td>
            </tr>
        `;
    }).join("");

    let html = `
    <div class="MoDuL-diagnostic-head MoDuL-sticky-top">
        <div class="MoDuL-flex MoDuL-between MoDuL-center MoDuL-mb-8">
            <div class="MoDuL-flex MoDuL-center MoDuL-gap-8">
                <button id="sim-back-btn" class="MoDuL-mini-btn MoDuL-diagnostic-back">Back</button>
                <span class="MoDuL-bold MoDuL-soft MoDuL-ml-5">Capital:</span>
                <input
                    id="sim-cash"
                    class="MoDuL-tbl-input MoDuL-diagnostic-cash"
                    value="${startCash.toLocaleString("en-US")}"
                >
            </div>

            <button id="sim-reset-btn" class="MoDuL-mini-btn MoDuL-pill-gold">Reset to Live</button>
        </div>

        <div class="MoDuL-diagnostic-summary">
            <div>Invested: <span id="sim-total-invested" class="MoDuL-bold MoDuL-gold">$0</span></div>
            <div>Cash Left: <span id="sim-cash-left" class="MoDuL-bold MoDuL-white">$0</span></div>
        </div>

        <div class="MoDuL-diagnostic-legend">
            <span><span class="MoDuL-dot MoDuL-green">●</span> Best ROI</span>
            <span><span class="MoDuL-dot MoDuL-accent">●</span> Affordable</span>
            <span><span class="MoDuL-dot MoDuL-gold">●</span> Next Goal</span>
            <span><span class="MoDuL-dot MoDuL-red">●</span> Sell This</span>
        </div>
    </div>

    <div class="MoDuL-diagnostic-table-wrap">
        <table class="MoDuL-table MoDuL-w-100">
            <thead>
                <tr>
                    <th class="MoDuL-th-own">Own</th>
                    <th>Stock/Bank</th>
                    <th class="MoDuL-text-right">ROI</th>
                    <th class="MoDuL-text-right">Cost</th>
                </tr>
            </thead>
            <tbody id="sim-tbody">${tableRows}</tbody>
        </table>
    </div>`;

    createModal("Diagnostic Tool", html);

    const updateHighlights = () => {
        let simTotalCap = parseTornNumber($("#sim-cash").val());
        let totalInvested = 0;
        let checkedIds = [];
        let bankState = { amount: 0, locked: false };

        $(".sim-check").each(function() {
            let id = $(this).data("id");
            let row = window.simRowsData.find(r => r.id === id);

            if (row) {
                row.isOwned = $(this).is(":checked");

                if (row.sym === "BANK") {
                    let amtInput = $(`.sim-bank-amt[data-id="${id}"]`).val();
                    let lockInput = $(`.sim-bank-lock[data-id="${id}"]`).is(":checked");
                    row.cost = parseTornNumber(amtInput);
                    row.isLocked = lockInput;
                    bankState = { amount: row.cost, locked: row.isLocked };
                }

                if (row.isOwned) {
                    checkedIds.push(id);
                    totalInvested += row.cost;
                }
            }
        });

        localStorage.setItem("MoDuL_advisor_diag_state", JSON.stringify({
            cash: simTotalCap,
            checked: checkedIds,
            bankAmount: bankState.amount,
            bankLocked: bankState.locked
        }));

        let cashLeft = simTotalCap - totalInvested;
        $("#sim-total-invested").text(formatMoney(totalInvested));

        let leftEl = $("#sim-cash-left");
        leftEl
            .removeClass("MoDuL-green MoDuL-red MoDuL-white")
            .addClass(cashLeft < 0 ? "MoDuL-red" : "MoDuL-green")
            .text(formatMoney(cashLeft));

        $(".sim-row").css("background", "transparent");

        let candidates = window.simRowsData.filter(r => !r.isOwned);
        let bankRow = window.simRowsData.find(r => r.sym === "BANK" && r.isOwned);

        if (bankRow && !bankRow.isLocked && bankRow.cost < 2_000_000_000) {
            candidates.push({
                id: "BANK_GAP",
                roi: bankRow.roi,
                cost: 2_000_000_000 - bankRow.cost,
                sym: "BANK"
            });
            candidates.sort((a, b) => b.roi - a.roi);
        }

        let sellableAssets = window.simRowsData.filter(r => r.isOwned && !(r.sym === "BANK" && r.isLocked));

        let scoredCandidates = candidates.map(cand => {
            let sellPower = 0;
            for (let asset of sellableAssets) {
                if (asset.roi < cand.roi) sellPower += asset.cost;
            }
            let buyingPower = cashLeft + sellPower;
            let gap = cand.cost - buyingPower;
            return { node: cand, gap: gap };
        });

        scoredCandidates.sort((a, b) => {
            if (a.gap <= 0 && b.gap <= 0) return b.node.roi - a.node.roi;
            return a.gap - b.gap;
        });

        let absoluteBest = candidates.length > 0 ? candidates[0] : null;
        const paint = (id, c) => $(`#row-${id === "BANK_GAP" ? bankRow.id : id}`).css("background", c);

        if (absoluteBest) paint(absoluteBest.id, "rgba(87, 227, 137, 0.18)");

        let bestTarget = scoredCandidates.length > 0 ? scoredCandidates[0] : null;
        if (bestTarget) {
            let color = bestTarget.gap <= 0 ? "rgba(52, 179, 255, 0.16)" : "rgba(255, 209, 102, 0.16)";
            paint(bestTarget.node.id, color);

            if (bestTarget.gap <= 0 || color === "rgba(255, 213, 79, 0.2)") {
                if (bestTarget.gap <= 0) {
                    let required = bestTarget.node.cost - cashLeft;
                    let currentSum = 0;
                    sellableAssets.sort((a, b) => a.roi - b.roi);

                    for (let asset of sellableAssets) {
                        if (asset.roi < bestTarget.node.roi) {
                            currentSum += asset.cost;
                            $(`#row-${asset.id}`).css("background", "rgba(255, 107, 107, 0.16)");
                            if (currentSum >= required) break;
                        }
                    }
                }
            }
        }
    };

    $("#sim-cash, .sim-bank-amt").on("keyup change", updateHighlights);
    $(".sim-bank-lock").on("change", updateHighlights);

    $("#sim-back-btn").on("click", function() {
        $(".MoDuL-modal-overlay").remove();
        openAdvisorMain();
    });

    $("#sim-reset-btn").on("click", function() {
        if (confirm("Discard changes?")) {
            localStorage.removeItem("MoDuL_advisor_diag_state");
            openDiagnosticTool();
        }
    });

    $(".sim-check").on("change", updateHighlights);
    updateHighlights();
}



function getPrice(id) { if (!stocks[id]) return 0; return parseFloat($(stocks[id]).text().replace(/,/g, '')); }
function handleInputUpdate(el, key) {
    let raw = $(el).val(), num = parseTornNumber(raw);
    if(!isNaN(num) && (raw.endsWith("k")||raw.endsWith("m")||raw.endsWith("b"))) { $(el).val(num); localStorage.setItem(key, num); }
    else localStorage.setItem(key, raw);
}

function openAdvisorMain() {
    let html = `
    <div class="MoDuL-dashboard">
        <div class="MoDuL-hero" id="adv-hero-box">
            <div class="MoDuL-hero-header MoDuL-hero-trigger" id="adv-hero-trigger">
                <div class="MoDuL-section-header-center">
                    <span>Daily Net Profit</span>
                    <span class="MoDuL-toggle">▼</span>
                </div>
            </div>

            <div id="adv-daily-income" class="MoDuL-hero-val">--</div>
            <div id="adv-daily-detail" class="MoDuL-hero-sub MoDuL-hero-detail">Calculating...</div>
            <div id="adv-income-breakdown" class="MoDuL-breakdown"></div>
        </div>

        <div class="MoDuL-grid-section">
            <div class="MoDuL-card" id="adv-card-target">
                <div class="MoDuL-card-head">
                    <span class="MoDuL-card-title">Target (Best ROI) <span class="MoDuL-caret">▼</span></span>
                    <span id="adv-next-roi" class="MoDuL-card-roi">--%</span>
                </div>
                <div class="MoDuL-card-body">
                    <div id="adv-next-name" class="MoDuL-stock-name">--</div>
                    <div id="adv-next-cost" class="MoDuL-stock-cost">Cost: --</div>
                    <div id="adv-next-gain" class="MoDuL-stock-gain">Gain: --</div>
                    <div id="adv-target-details" class="MoDuL-card-details"></div>
                </div>
            </div>

            <div class="MoDuL-card MoDuL-card-accent" id="adv-card-afford">
                <div class="MoDuL-card-head">
                    <span class="MoDuL-card-title MoDuL-accent">Best Affordable <span class="MoDuL-caret">▼</span></span>
                    <span id="adv-afford-roi" class="MoDuL-card-roi">--%</span>
                </div>
                <div class="MoDuL-card-body">
                    <div id="adv-afford-name" class="MoDuL-stock-name">--</div>
                    <div id="adv-afford-cost" class="MoDuL-stock-cost">Cost: --</div>
                    <div id="adv-afford-gain" class="MoDuL-stock-gain">Gain: --</div>
                    <div id="adv-afford-details" class="MoDuL-card-details"></div>
                </div>
            </div>
        </div>

        <div class="MoDuL-actions MoDuL-actions-stack MoDuL-actions-no-top">
            <div class="MoDuL-flex MoDuL-gap-5 MoDuL-mb-5">
                <button id="adv-btn-items" class="MoDuL-main-btn MoDuL-flex-1">Prices</button>
                <button id="adv-btn-costs" class="MoDuL-main-btn MoDuL-flex-1 MoDuL-pill-danger">Daily Costs</button>
            </div>

            <div class="MoDuL-flex MoDuL-gap-5">
                <button id="adv-btn-networth" class="MoDuL-main-btn MoDuL-flex-1">Settings</button>
                <button id="adv-diag-btn" class="MoDuL-main-btn MoDuL-flex-1 MoDuL-pill-gold">Diagnostic</button>
            </div>

            <div id="adv-cash-display" class="MoDuL-cash-display">
                Free Cash: ...
            </div>
        </div>
    </div>`;

    createModal("Financial Advisor", html);

    // DELEGATED LISTENERS
    $("body").off("click", "#adv-btn-items").on("click", "#adv-btn-items", function() { openItemSettings(); });
    $("body").off("click", "#adv-btn-networth").on("click", "#adv-btn-networth", function() { openNetworthSettings(); });
    $("body").off("click", "#adv-btn-costs").on("click", "#adv-btn-costs", function() { openCostSettings(); });
    $("body").off("click", "#adv-diag-btn").on("click", "#adv-diag-btn", function() { openDiagnosticTool(); });

    $("#adv-card-target .MoDuL-card-head").off().on("click", function() {
        $("#adv-target-details").slideToggle(150);
        $(this).find(".MoDuL-caret").toggleClass("rotated");
    });

    $("#adv-card-afford .MoDuL-card-head").off().on("click", function() {
        $("#adv-afford-details").slideToggle(150);
        $(this).find(".MoDuL-caret").toggleClass("rotated");
    });

    $("#adv-hero-trigger").off().on("click", function() {
        $("#adv-income-breakdown").slideToggle(200);
        $(this).find(".MoDuL-caret").toggleClass("rotated");
    });

    $("body").off("click", ".MoDuL-action-sell").on("click", ".MoDuL-action-sell", function(e) {
        e.stopPropagation();
        sellSmart($(this).data("sym"), parseInt($(this).data("shares")));
    });

    $("body").off("click", ".MoDuL-action-buy").on("click", ".MoDuL-action-buy", function(e) {
        e.stopPropagation();
        buySmart($(this).data("sym"), parseInt($(this).data("shares")));
    });

    runAdvisorLogic(true);
    setTimeout(() => runAdvisorLogic(false), 50);
}


// --- ADVISOR LOGIC ---
function getDailyYield(sym) {
    let b = ADVISOR_DATA[sym]; if (!b) return 0;
    let val = 0;
    if (b.type === "cash") val = b.val;
    else if (b.type === "item") val = itemPrices[b.id] || 0;
    else if (b.type === "manual") val = itemPrices["HRG_AVG"] || 0;
    else if (b.type === "average") { let t=0,c=0; for (let cid of b.ids) { let p=itemPrices[cid]||0; if(p>0){t+=p;c++;} } val=c>0?t/c:0; }
    return (val > 0 && b.freq) ? val / b.freq : 0;
}

async function getLiquidNetworth(fastMode = false) {
    // If fast mode is requested and we have data, return it immediately (skips slow API)
    if (fastMode && lastNwCache) return lastNwCache;

    let key = requireApiKey();
    if (!key) return { liquid: 0, pureCash: 0, dailyBank: 0, bankActive: false, bankPrincipal: 0 };

    try {
        const res = await fetch(`https://api.torn.com/v2/user/money?key=${key}`);
        const data = await res.json();

        if (!data.money) return lastNwCache || { liquid: 0, pureCash: 0, dailyBank: 0, bankActive: false, bankPrincipal: 0 };

        let m = data.money, dailyBank=0, bankActive=false, bankPrincipal=0;
        if (m.city_bank && m.city_bank.amount>0) {
            bankPrincipal=m.city_bank.amount;
            if (m.city_bank.profit>0 && m.city_bank.duration>0) dailyBank=m.city_bank.profit/m.city_bank.duration;
            bankActive=true;
        }

        let pureCash = m.wallet || 0;
        if (networthSettings.sources.points && m.points>0) pureCash += (m.points * (itemPrices["points"]||45000));

        // Save to cache
        lastNwCache = { liquid: 0, pureCash: pureCash, dailyBank: dailyBank, bankActive: bankActive, bankPrincipal: bankPrincipal };

        // Calculate Liquid Total (This logic is usually done in Advisor, but we store the base here)
        // Note: The specific stock calculation happens in runAdvisorLogic, so 'liquid' here is just a placeholder or base

        return lastNwCache;
    } catch (e) {
        console.error("NW Error", e);
        return lastNwCache || { liquid: 0, pureCash: 0, dailyBank: 0, bankActive: false, bankPrincipal: 0 };
    }
}

async function runAdvisorLogic(skipApiSync = false) {
    if (!skipApiSync) $("#adv-debug-log").text("Syncing Portfolio...");
    $("#adv-daily-income").text("...");

    try {
        if (!skipApiSync) await fetchUserPortfolio();

        let nwData = await getLiquidNetworth(skipApiSync);
        let liquidCash = nwData.liquid;
        let pureCash = nwData.pureCash;
        let dailyBank = nwData.dailyBank;
        let bankPrincipal = nwData.bankPrincipal;

        let xanPrice = itemPrices[206] || 835000;
        let fhcPrice = itemPrices[367] || 13500000;
        let pointPrice = itemPrices["points"] || 45000;

        let costs;
        try { costs = JSON.parse(localStorage.getItem("MoDuL_advisor_costs")); } catch (e) {}
        if (!costs) costs = {};

        let costXan = (costs.xanax || 0) * xanPrice;
        let costFhc = (costs.fhc || 0) * fhcPrice;

        let costCans = 0;
        const CAN_IDS = [530, 532, 533, 553, 554, 555, 985, 986, 987];
        CAN_IDS.forEach(id => {
            let qty = costs[`can_${id}`] || 0;
            if (qty > 0) {
                let p = itemPrices[id] || 0;
                costCans += (qty * p);
            }
        });

        if (costs.cans > 0 && costCans === 0) {
            let defaultCanPrice = itemPrices[530] || 1200000;
            costCans = costs.cans * defaultCanPrice;
        }

        let totalConsumables = costXan + costFhc + costCans;

        let refillCount = 0;
        if (costs.refill_energy) refillCount++;
        if (costs.refill_nerve) refillCount++;
        if (costs.refill_token) refillCount++;
        let totalRefills = refillCount * 30 * pointPrice;

        let dailyDuke = (costs.duke_weekly || 0) / 7;
        let totalFees = dailyDuke + (costs.rehab_daily || 0);
        let totalDailyBurn = totalConsumables + totalRefills + totalFees;

        let currentDailyIncome = 0;
        let liquidAssets = [];
        let ownedBlocks = [];
        let candidates = [];
        let symbols = Object.keys(STOCK_DATA);
        const IGNORED = ["BAG", "EVL", "CBD", "MCS"];

        for (let sym of symbols) {
            if (IGNORED.includes(sym)) continue;

            let isExcluded = networthSettings.excludedStocks && networthSettings.excludedStocks.includes(sym);
            let stockData = STOCK_DATA[sym];
            let sharePrice = getPrice(sym);
            if (sharePrice === 0) continue;

            let owned = getOwnedShares(sym);
            let increment = stockData.base;
            let dailyYield = getDailyYield(sym);

            if (sym === "PTS") {
                let ptsPrice = itemPrices["points"] || 0;
                if (ptsPrice > 0) dailyYield = (ptsPrice * 100) / 7;
            }

            let currentLevel = 0;
            if (stockData.type === "P") currentLevel = (owned >= increment) ? 1 : 0;
            else if (owned >= increment) currentLevel = Math.floor(Math.log2((owned / increment) + 1));

            let allowSellingBlock = !isExcluded;
            let allowSellingLoose = !isExcluded || (networthSettings.excludeMode === "active");

            if (currentLevel > 0 && dailyYield > 0) {
                if (stockData.type === "P") {
                    let blockCost = increment * sharePrice;
                    let blockRoi = (blockCost > 0) ? ((dailyYield * 365) / blockCost) * 100 : 0;
                    currentDailyIncome += dailyYield;
                    ownedBlocks.push({ name: sym, tier: 1, totalIncome: dailyYield, invested: blockCost, currentRoi: blockRoi });

                    let loose = Math.max(0, owned - increment);
                    if (loose > 0 && allowSellingLoose) {
                        liquidAssets.push({ name: sym, sym: sym, val: loose * sharePrice, price: sharePrice, currentRoi: 0 });
                    }
                    if (allowSellingBlock) {
                        liquidAssets.push({ name: sym + " (Block)", sym: sym, val: increment * sharePrice, price: sharePrice, currentRoi: blockRoi, isBlock: true });
                    }
                } else {
                    let totalLockedShares = 0;
                    for (let i = 1; i <= currentLevel; i++) {
                        let tierShares = increment * Math.pow(2, i - 1);
                        totalLockedShares += tierShares;
                        let tierCost = tierShares * sharePrice;
                        let tierRoi = (tierCost > 0) ? ((dailyYield * 365) / tierCost) * 100 : 0;
                        currentDailyIncome += dailyYield;
                        ownedBlocks.push({ name: sym, tier: i, totalIncome: dailyYield, invested: tierCost, currentRoi: tierRoi });
                        if (allowSellingBlock) {
                            liquidAssets.push({ name: `${sym} (Tier ${i})`, sym: sym, val: tierCost, price: sharePrice, currentRoi: tierRoi, isBlock: true });
                        }
                    }
                    let looseShares = Math.max(0, owned - totalLockedShares);
                    if (looseShares > 0 && allowSellingLoose) {
                        liquidAssets.push({ name: sym, sym: sym, val: looseShares * sharePrice, price: sharePrice, currentRoi: 0 });
                    }
                }
            } else if (owned > 0 && allowSellingLoose) {
                liquidAssets.push({ name: sym, sym: sym, val: owned * sharePrice, price: sharePrice, currentRoi: 0 });
            }

            let isPassive = (stockData.type === "P");
            let shouldCheck = !isPassive || (isPassive && currentLevel === 0);

            if (shouldCheck) {
                let candName = sym;
                let targetTotalShares = 0;
                let roiBaseShares = 0;

                if (isPassive) {
                    targetTotalShares = increment;
                    roiBaseShares = increment;
                } else {
                    let nextLevel = currentLevel + 1;
                    targetTotalShares = increment * (Math.pow(2, nextLevel) - 1);
                    candName = sym + ` (Tier ${nextLevel})`;
                    roiBaseShares = increment * Math.pow(2, nextLevel - 1);
                }

                let sharesNeeded = Math.max(0, targetTotalShares - owned);
                if (sharesNeeded > 0 || isPassive) {
                    let costToUpgrade = sharesNeeded * sharePrice;
                    let marginalCost = roiBaseShares * sharePrice;
                    let marginalRoi = (marginalCost > 0) ? ((dailyYield * 365) / marginalCost) * 100 : 0;

                    if (marginalRoi > 0) {
                        candidates.push({
                            name: candName,
                            sym: sym,
                            roi: marginalRoi,
                            cost: costToUpgrade,
                            sharesNeeded: sharesNeeded,
                            dailyYield: dailyYield,
                            totalVal: targetTotalShares * sharePrice
                        });
                    }
                }
            }
        }

        if (!nwData.bankActive) {
            ["1w", "2w", "1m", "2m", "3m"].forEach(term => {
                let rate = bankSettings["roi_" + term];
                if (rate > 0) {
                    candidates.push({
                        name: `City Bank (${term})`,
                        sym: "BANK",
                        roi: rate,
                        cost: 2_000_000_000,
                        isBank: true,
                        totalVal: 2_000_000_000
                    });
                }
            });
        }

        candidates.sort((a, b) => b.roi - a.roi);

        let totalDailyIncome = currentDailyIncome + dailyBank;
        let netDailyProfit = totalDailyIncome - totalDailyBurn;
        let netColorClass = netDailyProfit >= 0 ? "MoDuL-green" : "MoDuL-red";

        $("#adv-daily-income").text(formatMoney(Math.floor(totalDailyIncome)));
        $("#adv-daily-detail").html(`
            <span class="MoDuL-soft">
                Daily Burn: <span class="MoDuL-red">-${formatMoney(Math.floor(totalDailyBurn))}</span>
            </span><br>
            <span class="${netColorClass} MoDuL-bold">
                Net: ${formatMoney(Math.floor(netDailyProfit))}
            </span>
        `);
        $("#adv-cash-display").text(`Free Cash: ${formatMoney(pureCash)}`);

        let breakdownHtml = "";
        breakdownHtml += `<div class="MoDuL-break-section-title">Income Sources</div>`;

        if (dailyBank > 0) {
            breakdownHtml += `
                <div class="MoDuL-break-row">
                    <div class="MoDuL-break-line">
                        <span>City Bank</span>
                        <span class="MoDuL-break-val">${formatMoney(Math.floor(dailyBank))}</span>
                    </div>
                </div>
            `;
        }

        ownedBlocks.sort((a, b) => b.totalIncome - a.totalIncome);
        for (let block of ownedBlocks) {
            let tierLabel = (block.tier > 0) ? `(Tier ${block.tier})` : "(Passive)";
            breakdownHtml += `
                <div class="MoDuL-break-row">
                    <div class="MoDuL-break-line">
                        <span>${block.name} <span class="MoDuL-tier-tag">${tierLabel}</span></span>
                        <span class="MoDuL-break-val">${formatMoney(Math.floor(block.totalIncome))}</span>
                    </div>
                </div>
            `;
        }

        if (totalDailyBurn > 0) {
            breakdownHtml += `<div class="MoDuL-break-section-title MoDuL-break-section-split">Daily Costs</div>`;

            if (totalConsumables > 0) {
                breakdownHtml += `
                    <div class="MoDuL-break-row">
                        <div class="MoDuL-break-line">
                            <span>Consumables</span>
                            <span class="MoDuL-red">-${formatMoney(Math.floor(totalConsumables))}</span>
                        </div>
                    </div>
                `;
            }

            if (totalRefills > 0) {
                breakdownHtml += `
                    <div class="MoDuL-break-row">
                        <div class="MoDuL-break-line">
                            <span>Point Refills (${refillCount})</span>
                            <span class="MoDuL-red">-${formatMoney(Math.floor(totalRefills))}</span>
                        </div>
                    </div>
                `;
            }

            if (totalFees > 0) {
                breakdownHtml += `
                    <div class="MoDuL-break-row">
                        <div class="MoDuL-break-line">
                            <span>Fees</span>
                            <span class="MoDuL-red">-${formatMoney(Math.floor(totalFees))}</span>
                        </div>
                    </div>
                `;
            }
        }

        breakdownHtml += `
            <div class="MoDuL-break-total">
                <span>Net Daily Profit</span>
                <span class="${netColorClass}">${formatMoney(Math.floor(netDailyProfit))}</span>
            </div>
        `;

        $("#adv-income-breakdown").html(breakdownHtml);

        function calculateLiquidity(target) {
            let owned = 0;
            let alreadyOwnedValue = 0;

            if (!target.isBank) {
                owned = getOwnedShares(target.sym);
                let price = getPrice(target.sym);
                alreadyOwnedValue = owned * price;
            }

            let goal = target.totalVal;
            if (target.isBank) {
                let totalPower = pureCash + liquidAssets.reduce((acc, a) => acc + a.val, 0);
                goal = Math.min(totalPower, 2_000_000_000);
                goal = Math.max(goal, 0);
            }

            let startingAssets = pureCash + alreadyOwnedValue;
            let gap = goal - startingAssets;
            let available = pureCash;
            let sources = [];
            let totalLiquid = pureCash;

            liquidAssets.sort((a, b) => a.currentRoi - b.currentRoi);

            for (let asset of liquidAssets) {
                if (!target.isBank && asset.sym === target.sym) continue;
                totalLiquid += asset.val;
                if (gap > 0 && asset.currentRoi < target.roi) {
                    gap -= asset.val;
                    available += asset.val;
                    sources.push(asset);
                }
            }

            let totalResources = pureCash + alreadyOwnedValue + sources.reduce((acc, s) => acc + s.val, 0);
            let finalMissing = Math.max(0, target.isBank ? 0 : (target.totalVal - totalResources));

            return { available, missing: finalMissing, sources, totalLiquid };
        }

        function buildLiquidityHtml(target, plan) {
            let html = "";

            if (target.isBank) {
                html += `<div class="MoDuL-detail-row"><span>Investment Cap:</span> <span>$2,000,000,000</span></div>`;
            } else {
                html += `<div class="MoDuL-detail-row"><span>Target Price:</span> <span>${formatMoney(target.totalVal)}</span></div>`;
            }

            let ownedVal = 0;
            if (!target.isBank) {
                let owned = getOwnedShares(target.sym);
                let price = getPrice(target.sym);
                ownedVal = owned * price;

                if (owned > 0) {
                    html += `<div class="MoDuL-detail-row MoDuL-detail-sub"><span>- Already Owned</span> <span>${formatMoney(ownedVal)}</span></div>`;
                }
            }

            if (pureCash > 0) {
                html += `<div class="MoDuL-detail-row MoDuL-detail-sub"><span>- Free Cash</span> <span>${formatMoney(pureCash)}</span></div>`;
            }

            if (plan.sources.length > 0) {
                let currentTotal = pureCash + ownedVal;
                let displayGap = target.isBank ? (2_000_000_000 - currentTotal) : (target.totalVal - currentTotal);

                for (let src of plan.sources) {
                    let sellVal = (displayGap > 0) ? Math.min(src.val, displayGap) : 0;
                    if (sellVal <= 0) continue;

                    displayGap -= sellVal;
                    let sellShares = Math.ceil(sellVal / src.price);

                    html += `
                        <div class="MoDuL-detail-row MoDuL-detail-sub MoDuL-detail-action-row">
                            <span class="MoDuL-detail-action-text">
                                <span>- Sell ${src.name}</span>
                                <span class="MoDuL-detail-action-sub">(Avail: ${formatMoney(src.val)})</span>
                            </span>
                            <button class="MoDuL-mini-btn MoDuL-action-sell" data-sym="${src.sym}" data-shares="${sellShares}">
                                Sell ~${formatMoney(sellVal)}
                            </button>
                        </div>
                    `;
                }
            }

            if (plan.missing > 0 && !target.isBank) {
                html += `<div class="MoDuL-detail-row MoDuL-detail-miss"><span>Still Missing:</span> <span>${formatMoney(plan.missing)}</span></div>`;
            } else {
                let amountToInvest = target.isBank ? Math.min(plan.available, 2_000_000_000) : plan.available;
                html += `<div class="MoDuL-detail-row MoDuL-detail-total"><span>Ready to Invest:</span> <span class="MoDuL-white">${formatMoney(amountToInvest)}</span></div>`;
            }

            if (pureCash > 0 || plan.sources.length > 0) {
                if (target.isBank) {
                    html += `<a href="https://www.torn.com/bank.php" target="_blank" class="MoDuL-invest-btn MoDuL-invest-link">Open Bank</a>`;
                } else if (pureCash > 0) {
                    html += `<button class="MoDuL-invest-btn MoDuL-action-buy" data-sym="${target.sym}" data-shares="${target.sharesNeeded}">Invest Now</button>`;
                }
            }

            return html;
        }

        let totalLiquidPower = pureCash + liquidAssets.reduce((acc, asset) => acc + asset.val, 0);
        let nextBest = candidates[0];

        if (nextBest) {
            $("#adv-next-roi").text(nextBest.roi.toFixed(2) + "%");
            $("#adv-next-name").text(nextBest.name);

            let targetLiq = calculateLiquidity(nextBest);
            $("#adv-target-details").html(buildLiquidityHtml(nextBest, targetLiq));

            if (targetLiq.missing <= 0) {
                if (nextBest.isBank) {
                    $("#adv-next-cost").text("Invest Max Cap");
                    $("#adv-next-gain").text("Active Banking");
                } else {
                    if (targetLiq.sources.length === 0) {
                        $("#adv-next-cost").text(formatMoney(nextBest.cost));
                        $("#adv-next-gain").text("Buy with Cash");
                    } else {
                        $("#adv-next-cost").text("Sell " + targetLiq.sources.length + " lower ROI");
                        $("#adv-next-gain").text("to buy this");
                    }
                }
            } else {
                $("#adv-next-cost").html(`<span class="MoDuL-shortage">Missing ${formatMoney(targetLiq.missing)}</span>`);
                $("#adv-next-gain").text(`Cost: ${formatMoney(nextBest.cost)}`);
            }
        } else {
            $("#adv-next-name").text("Maxed Out!");
            $("#adv-target-details").html("");
        }

        let floorROI = 0;
        if (ownedBlocks.length > 0) floorROI = Math.min(...ownedBlocks.map(b => b.currentRoi));

        let bestOption = null;
        let bestOptionLiq = null;

        let betterCandidates = candidates.filter(c => {
            if (c.roi <= floorROI) return false;
            if (c.isBank) return true;
            let selfLiquidity = liquidAssets.filter(a => a.sym === c.sym).reduce((acc, a) => acc + a.val, 0);
            return c.cost <= (totalLiquidPower - selfLiquidity);
        });

        if (betterCandidates.length > 0) {
            bestOption = betterCandidates[0];
            bestOptionLiq = calculateLiquidity(bestOption);
        } else {
            let cheapCandidates = candidates.filter(c => {
                if (c.isBank) return true;
                let selfLiquidity = liquidAssets.filter(a => a.sym === c.sym).reduce((acc, a) => acc + a.val, 0);
                return c.cost <= (totalLiquidPower - selfLiquidity);
            });

            cheapCandidates.sort((a, b) => b.roi - a.roi);

            if (cheapCandidates.length > 0) {
                bestOption = cheapCandidates[0];
                bestOptionLiq = calculateLiquidity(bestOption);
            }
        }

        if (bestOption) {
            let colorClass = "MoDuL-accent";
            if (nextBest && bestOption.roi < nextBest.roi) colorClass = "MoDuL-gold";

            $("#adv-afford-roi")
                .removeClass("MoDuL-accent MoDuL-gold MoDuL-green MoDuL-red")
                .addClass(colorClass)
                .text(bestOption.roi.toFixed(2) + "%");

            $("#adv-afford-name").text(bestOption.name);

            if (bestOption.isBank) {
                let investAmount = Math.min(totalLiquidPower, 2_000_000_000);
                $("#adv-afford-cost").text("Park Liquid Cash");
                $("#adv-afford-gain").text("Inv: " + formatMoney(investAmount));
            } else {
                let rawGap = bestOption.cost - pureCash;

                if (bestOptionLiq.missing > 0) {
                    $("#adv-afford-cost").html(`<span class="MoDuL-shortage">Missing: ${formatMoney(bestOptionLiq.missing)}</span>`);
                } else if (rawGap > 0) {
                    $("#adv-afford-cost").text("Sell " + bestOptionLiq.sources.length + " items");
                } else {
                    $("#adv-afford-cost").html(`<span class="MoDuL-green">Ready to Buy</span>`);
                }

                $("#adv-afford-gain").text("Cost: " + formatMoney(bestOption.totalVal));
            }

            $("#adv-afford-details").html(buildLiquidityHtml(bestOption, bestOptionLiq));
        } else {
            $("#adv-afford-name").text("Portfolio Optimized");
            $("#adv-afford-roi").text("-");
            $("#adv-afford-cost").text("-");
            $("#adv-afford-gain").text("-");
        }

    } catch (e) {
        console.error("Advisor Crash:", e);
    }
}

async function fetchUserPortfolio() {
    let key = requireApiKey(); if (!key) return;
    $("#adv-debug-log").text("Syncing Portfolio...");
    try {
        const res = await fetch(`https://api.torn.com/user/?selections=stocks&key=${key}&ts=${Date.now()}`);
        const data = await res.json();

        if (data.stocks) {
            let idToSym = {};
            for (let [sym, domId] of Object.entries(stockId)) {
                let cleanId = domId.replace("stock_", "");
                idToSym[cleanId] = sym;
            }

            // 1. Process & Store Data
            portfolioTransactions = {};
            for (let [sID, sData] of Object.entries(data.stocks)) {
                let sym = idToSym[sID];
                if (sym) {
                    localShareCache[sym] = sData.total_shares || 0;
                    if (sData.transactions) {
                        portfolioTransactions[sym] = Object.values(sData.transactions);
                    }
                }
            }

            // 2. SAVE to LocalStorage (Persistence Fix)
            localStorage.setItem("MoDuL_advisor_transactions", JSON.stringify(portfolioTransactions));

            // 3. Refresh UI
            for (let sym of Object.keys(stockRows)) {
                let onScreen = getOwnedShares(sym);
                if (onScreen > 0 || localShareCache[sym] !== onScreen) {
                    localShareCache[sym] = onScreen;
                }
            }

            $("#adv-debug-log").text("Portfolio Synced.");
            updatePortfolioPerformance(); // Update P/L immediately
        }
    } catch (e) { console.error("Portfolio Sync Error", e); }
}


function updatePortfolioPerformance() {
    let totalCost = 0;
    let totalValue = 0;

    for (let [sym, transList] of Object.entries(portfolioTransactions)) {
        let currentPrice = getPrice(sym);
        if (!currentPrice || currentPrice === 0) continue;

        let stockCost = 0;
        let stockShares = 0;

        transList.forEach(t => {
            let s = parseFloat(t.shares);
            let p = parseFloat(t.bought_price);
            stockCost += (s * p);
            stockShares += s;
        });

        totalCost += stockCost;
        totalValue += (stockShares * currentPrice);
    }

    let profit = totalValue - totalCost;
    let profitPercent = (totalCost > 0) ? ((profit / totalCost) * 100) : 0;
    let colorClass = profit >= 0 ? "MoDuL-green" : "MoDuL-red";
    let sign = profit >= 0 ? "+" : "";

    let html = `
        <div class="MoDuL-pl-grid">
            <div class="MoDuL-pl-block MoDuL-pl-block-left">
                <div class="MoDuL-pl-label">Total Invested</div>
                <div class="MoDuL-pl-value">${formatMoney(Math.floor(totalCost))}</div>
            </div>
            <div class="MoDuL-pl-block MoDuL-pl-block-right">
                <div class="MoDuL-pl-label">Unrealized P/L</div>
                <div class="MoDuL-pl-profit ${colorClass}">
                    ${sign}${formatMoney(Math.floor(profit))}
                    <span class="MoDuL-pl-percent">(${sign}${profitPercent.toFixed(2)}%)</span>
                </div>
            </div>
        </div>
    `;

    $("#MoDuL-pl-display").html(html);
}


// --- SMART TRADING (SHARE BASED) ---
async function sellSmart(sym, shares) {
    let price = getPrice(sym);
    if (price <= 0) { alert("Price error."); return; }

    let confirmMsg = "";
    // Check for benefit lock
    if ($("#MoDuL-lock-toggle").is(":checked")) {
        let owned = getOwnedShares(sym);
        let future = getBenefitTier(sym, owned - shares);
        let current = getBenefitTier(sym, owned);
        if (future.tier < current.tier) {
            confirmMsg = `WARNING: Selling this will drop your Benefit Tier!\n\n`;
        }
    }

    let totalCash = formatMoney(shares * price);
    confirmMsg += `Sell ${shares.toLocaleString()} shares of ${sym} for approx ${totalCash}?`;

    if(confirm(confirmMsg)) {
        await postTrade(sym, shares, "sellShares", `Sold`);
        setTimeout(() => runAdvisorLogic(true), 1000);
    }
}

async function buySmart(sym, targetShares) {
    let money = await syncWallet(true);
    let price = getPrice(sym);
    if (price <= 0) { alert("Price error."); return; }

    // Calculate max we can actually afford
    let maxAffordable = Math.floor(money / price);
    let sharesToBuy = Math.min(maxAffordable, targetShares);

    if (sharesToBuy <= 0) { alert("Not enough cash!"); return; }

    let totalCost = formatMoney(sharesToBuy * price);
    if(confirm(`Invest ${totalCost} to buy ${sharesToBuy.toLocaleString()} shares of ${sym}?`)) {
        await postTrade(sym, sharesToBuy, "buyShares", `Invested`);
        setTimeout(() => runAdvisorLogic(true), 1000);
    }
}

// --- STANDARD VAULT FUNCTIONS ---
async function vault() {
    let symb = localStorage.MoDuL_vault_target;
    if (!symb) { alert("Select a stock first!"); return; }

    let money = await syncWallet(false);
    if (!money) return;

    let price = getPrice(symb);
    let amt = Math.floor(money / price);
    postTrade(symb, amt, "buyShares", `Vaulted ${formatMoney(amt * price)}`);
}

async function vaultExcept() {
    let symb = localStorage.MoDuL_vault_target;
    if (!symb) { alert("Select a stock first!"); return; }

    let money = await syncWallet(false);
    if (!money) return;

    let keepAmt = parseTornNumber($("#keepval").val()) || 0;
    let available = money - keepAmt;

    if (available <= 0) {
        $("#responseStock").html("Not enough money!").css("color", "red");
        return;
    }

    let price = getPrice(symb);
    let amt = Math.floor(available / price);
    postTrade(symb, amt, "buyShares", `Vaulted ${formatMoney(amt * price)} (Kept ${$("#keepval").val()})`);
}

function withdraw() {
    let symb = localStorage.MoDuL_vault_target; if(!symb) { alert("Select a stock first!"); return; }
    let val = parseTornNumber($("#sellval").val()); let price = getPrice(symb); let shares = Math.ceil((val / 0.999) / price);
    if ($("#MoDuL-lock-toggle").is(":checked")) {
        let owned = getOwnedShares(symb);
        if(owned===0 && !confirm("Script reads 0 shares. Continue?")) return;
        let future = getBenefitTier(symb, owned - shares); let current = getBenefitTier(symb, owned);
        if (future.tier < current.tier) { $("#responseStock").html(`Blocked: Need shares for benefit`).css("color", "red"); return; }
    }
    postTrade(symb, shares, "sellShares", `Withdrawn approx ${formatMoney(val)}`);
}

function withdrawAll() {
    let symb = localStorage.MoDuL_vault_target; if(!symb) { alert("Select a stock first!"); return; }
    let owned = getOwnedShares(symb); if (owned <= 0) { $("#responseStock").html("You have no shares.").css("color", "red"); return; }
    let sellAmt = owned;
    if ($("#MoDuL-lock-toggle").is(":checked")) {
        let data = STOCK_DATA[symb];
        if (data) {
            let keep = (data.type==="P") ? (owned>=data.base?data.base:0) : (Math.floor(owned/data.base)*data.base);
            sellAmt = owned - keep;
            if (sellAmt <= 0) { $("#responseStock").html(`Locked for benefit.`).css("color", "orange"); return; }
        }
    }
    postTrade(symb, sellAmt, "sellShares", `Sold All Available`);
}

function postTrade(symb, amt, step, msg) {
    $.post(`https://www.torn.com/page.php?sid=StockMarket&step=${step}&rfcv=${getRFC()}`, { stockId: stockId[symb], amount: amt })
        .done(function(r) {
        try { if(typeof r==="string") r=JSON.parse(r);
             if(r.success) {
                 $("#responseStock").html(`${msg} (${amt} shares)`).css("color", "green");

                 // 1. Update Shares Cache
                 updateLocalCache(symb, step==="buyShares"?amt:-amt);

                 // 2. Update Money Cache Manually (Fixes "Not Updating" bug)
                 if (lastNwCache) {
                     let price = getPrice(symb);
                     let transactionValue = amt * price;
                     if (step === "sellShares") {
                         lastNwCache.pureCash += transactionValue;
                     } else {
                         lastNwCache.pureCash -= transactionValue;
                     }
                 }

                 // 3. Update Advisor immediately using cached data
                 runAdvisorLogic(true);
             }
             else $("#responseStock").html(r.text||"Failed").css("color","red");
            } catch(e){ $("#responseStock").html("Request Sent").css("color","blue"); }
    });
    $("#responseStock").html("Processing...").css("color", "orange");
}

function renderPresets() {
    let isRR = localStorage.getItem("MoDuL_vault_rrbets") === "true";
    let presets = [];

    if (isRR) {
        try {
            let rrBets = JSON.parse(localStorage.getItem("rr_exported_bets"));
            if (rrBets && Array.isArray(rrBets)) {
                // Pull ALL active bets (ignoring empty $0 slots) and add $1,000 to each
                presets = rrBets.map(b => (b || 0) + 1000);
            }
        } catch(e) {}

        // Safety fallback just in case RR Tracker hasn't saved yet
        if (presets.length === 0) presets = [101000, 201000, 401000, 801000, 1601000, 3201000];
    } else {
        presets = JSON.parse(localStorage.getItem("MoDuL_vault_presets")) || DEFAULT_PRESETS;
    }

    let html = "";
    presets.forEach(p => {
        // Format it to K/M/B so the buttons stay small and clean
        let display = typeof p === 'number' ? formatNumberToKMB(p) : p;
        html += `<button class="torn-btn MoDuL-preset-btn" data-amt="${p}">${display}</button>`;
    });
    $("#MoDuL-preset-row").html(html);

    $(".MoDuL-preset-btn").on("click", function(e) {
        e.preventDefault();
        let v = parseTornNumber($(this).attr("data-amt").toString());
        $("#sellval").val(v).attr("value",v);
        localStorage.setItem("MoDuL_vault_sellVal", v);
        if($("#MoDuL-instant-toggle").is(":checked")) withdraw();
    });

    // Hide the 'Edit Buttons' link if RR mode is overriding the buttons
    if (isRR) {
        $("#MoDuL-edit-trigger").hide();
    } else {
        $("#MoDuL-edit-trigger").show();
    }
}

function renderEditMode() {
    let presets = JSON.parse(localStorage.getItem("MoDuL_vault_presets")) || DEFAULT_PRESETS;

    $("#MoDuL-preset-row").html(`
        <div class="MoDuL-edit-ui">
            <input
                type="text"
                id="MoDuL-preset-input"
                class="MoDuL-input MoDuL-w-100"
                value="${presets.join(", ")}"
            >
            <div class="MoDuL-edit-actions">
                <button id="savep" class="MoDuL-action-btn MoDuL-save">Save</button>
                <button id="canp" class="MoDuL-action-btn MoDuL-cancel">Cancel</button>
            </div>
        </div>
    `);

    $("#MoDuL-edit-trigger").hide();

    $("#savep").click(() => {
        localStorage.setItem(
            "MoDuL_vault_presets",
            JSON.stringify(
                $("#MoDuL-preset-input")
                .val()
                .split(",")
                .map(s => s.trim())
                .filter(s => s)
            )
        );
        renderPresets();
        $("#MoDuL-edit-trigger").show();
    });

    $("#canp").click(() => {
        renderPresets();
        $("#MoDuL-edit-trigger").show();
    });
}

function openCostSettings() {
    let costs;
    try { costs = JSON.parse(localStorage.getItem("MoDuL_advisor_costs")); } catch(e) {}
    if (!costs) costs = {};

    if (costs.refill_energy === undefined) costs.refill_energy = false;
    if (costs.refill_nerve === undefined) costs.refill_nerve = false;
    if (costs.refill_token === undefined) costs.refill_token = false;
    if (!costs.duke_weekly) costs.duke_weekly = 0;
    if (!costs.rehab_daily) costs.rehab_daily = 0;
    if (!costs.xanax) costs.xanax = 0;
    if (!costs.fhc) costs.fhc = 0;

    const CAN_IDS = [530, 532, 533, 553, 554, 555, 985, 986, 987];

    let canRows = "";
    CAN_IDS.forEach(id => {
        let name = ADVISOR_ITEMS[id] || `Can #${id}`;
        let val = costs[`can_${id}`] || 0;
        canRows += `
            <tr>
                <td class="MoDuL-font-11">${name}</td>
                <td><input class="MoDuL-tbl-input cost-input cost-can-input" data-id="${id}" type="number" value="${val}" placeholder="0"></td>
            </tr>
        `;
    });

    let cardConsumables = `
    <div class="MoDuL-card">
        <div class="MoDuL-card-head"><span class="MoDuL-card-title">Daily Consumables (Qty)</span></div>
        <div class="MoDuL-pad-10">
            <table class="MoDuL-table">
                <tr>
                    <td class="MoDuL-bold MoDuL-gold">Xanax</td>
                    <td><input id="cost-xanax" type="number" class="MoDuL-tbl-input cost-input" value="${costs.xanax}" placeholder="0"></td>
                </tr>
                <tr>
                    <td class="MoDuL-bold MoDuL-gold">FHC</td>
                    <td><input id="cost-fhc" type="number" class="MoDuL-tbl-input cost-input" value="${costs.fhc}" placeholder="0"></td>
                </tr>
            </table>

            <div class="MoDuL-divider-soft MoDuL-cost-divider"></div>

            <div class="MoDuL-cost-can-wrap">
                <table class="MoDuL-table">
                    ${canRows}
                </table>
            </div>
        </div>
    </div>`;

    let cardRefills = `
    <div class="MoDuL-card">
        <div class="MoDuL-card-head"><span class="MoDuL-card-title">Point Refills (30 Pts)</span></div>
        <div class="MoDuL-check-list MoDuL-check-list-vertical MoDuL-pad-12 MoDuL-refill-panel">
            <label class="MoDuL-check-label"><input type="checkbox" id="cost-refill-e" class="cost-input" ${costs.refill_energy ? "checked" : ""}> Energy Refill</label>
            <label class="MoDuL-check-label"><input type="checkbox" id="cost-refill-n" class="cost-input" ${costs.refill_nerve ? "checked" : ""}> Nerve Refill</label>
            <label class="MoDuL-check-label"><input type="checkbox" id="cost-refill-t" class="cost-input" ${costs.refill_token ? "checked" : ""}> Token Refill</label>
        </div>
    </div>`;

    let cardFees = `
    <div class="MoDuL-card MoDuL-grid-span-2">
        <div class="MoDuL-card-head"><span class="MoDuL-card-title">Recurring Fees</span></div>
        <div class="MoDuL-pad-10">
            <table class="MoDuL-table">
                <tr>
                    <td>Duke Loan (Weekly)</td>
                    <td><input id="cost-duke" type="text" class="MoDuL-tbl-input cost-input" value="${formatMoney(costs.duke_weekly)}" placeholder="$0"></td>
                </tr>
                <tr>
                    <td>Rehab Bill (Daily)</td>
                    <td><input id="cost-rehab" type="text" class="MoDuL-tbl-input cost-input" value="${formatMoney(costs.rehab_daily)}" placeholder="$0"></td>
                </tr>
            </table>
        </div>
    </div>`;

    let html = `
    <div class="MoDuL-settings-grid MoDuL-settings-grid-tight">
        ${cardConsumables}
        ${cardRefills}
        ${cardFees}
    </div>

    <div class="MoDuL-flex MoDuL-gap-10">
        <button id="MoDuL-back-costs" class="MoDuL-btn-main MoDuL-btn-back">Back</button>
        <button id="MoDuL-close-costs" class="MoDuL-btn-main MoDuL-pill-accent">Done</button>
    </div>`;

    createModal("Daily Cost Settings", html);

    const saveAndRefresh = () => {
        let rawDuke = $("#cost-duke").val().replace(/[$,]/g, "");
        let rawRehab = $("#cost-rehab").val().replace(/[$,]/g, "");

        let newCosts = {
            xanax: parseFloat($("#cost-xanax").val()) || 0,
            fhc: parseFloat($("#cost-fhc").val()) || 0,
            refill_energy: $("#cost-refill-e").is(":checked"),
            refill_nerve: $("#cost-refill-n").is(":checked"),
            refill_token: $("#cost-refill-t").is(":checked"),
            duke_weekly: parseTornNumber(rawDuke),
            rehab_daily: parseTornNumber(rawRehab)
        };

        $(".cost-can-input").each(function() {
            let id = $(this).data("id");
            newCosts[`can_${id}`] = parseFloat($(this).val()) || 0;
        });

        localStorage.setItem("MoDuL_advisor_costs", JSON.stringify(newCosts));
        runAdvisorLogic(true);
    };

    $(".cost-input").on("change keyup click", saveAndRefresh);

    $("#MoDuL-close-costs, #MoDuL-back-costs").on("click", function() {
        $(".MoDuL-modal-overlay").remove();
        openAdvisorMain();
    });
}

function openItemSettings() {
    const CONSUMABLE_IDS = [206, 367, 530, 532, 533, 553, 554, 555, 985, 986, 987];

    let generalRows = `
        <tr>
            <td class="MoDuL-bold MoDuL-green">Points</td>
            <td><input id="item-input-points" class="MoDuL-tbl-input" value="${(itemPrices["points"] || 0).toLocaleString("en-US")}"></td>
        </tr>
        <tr>
            <td class="MoDuL-bold MoDuL-accent">HRG Avg</td>
            <td><input id="item-input-HRG_AVG" class="MoDuL-tbl-input" value="${(itemPrices["HRG_AVG"] || 0).toLocaleString("en-US")}"></td>
        </tr>
    `;

    let consumableRows = "";
    let stockRows = "";

    let sortedIds = Object.keys(ADVISOR_ITEMS).sort((a, b) => ADVISOR_ITEMS[a].localeCompare(ADVISOR_ITEMS[b]));

    for (let id of sortedIds) {
        let name = ADVISOR_ITEMS[id];
        let price = (itemPrices[id] || 0).toLocaleString("en-US");
        let rowHtml = `<tr><td>${name}</td><td><input class="MoDuL-tbl-input item-price-input" data-id="${id}" value="${price}"></td></tr>`;

        if (CONSUMABLE_IDS.includes(parseInt(id))) consumableRows += rowHtml;
        else stockRows += rowHtml;
    }

    let html = `
    <button id="adv-fetch-api" class="MoDuL-btn-main MoDuL-btn-fetch-market">Fetch Current Market Prices (API)</button>

    <div class="MoDuL-item-settings-scroll">
        <div class="MoDuL-section-header">General Values</div>
        <table class="MoDuL-table MoDuL-mb-10">${generalRows}</table>

        <div class="MoDuL-section-header">Consumables (Daily Cost)</div>
        <table class="MoDuL-table MoDuL-mb-10">${consumableRows}</table>

        <div class="MoDuL-section-header">Stock Dividends (Income)</div>
        <table class="MoDuL-table">${stockRows}</table>
    </div>

    <div id="adv-fetch-status" class="MoDuL-fetch-status"></div>
    <button id="adv-back-items" class="MoDuL-btn-main MoDuL-btn-back MoDuL-w-100">Back</button>`;

    createModal("Item Values", html);

    const autoSaveItems = () => {
        itemPrices["points"] = parseTornNumber($("#item-input-points").val());
        itemPrices["HRG_AVG"] = parseTornNumber($("#item-input-HRG_AVG").val());

        $(".item-price-input").each(function() {
            itemPrices[$(this).data("id")] = parseTornNumber($(this).val());
        });

        localStorage.setItem("MoDuL_advisor_prices", JSON.stringify(itemPrices));
    };

    $(".MoDuL-modal-body").on("keyup change", "input", autoSaveItems);

    $("#adv-back-items").click(() => {
        $(".MoDuL-modal-overlay").remove();
        openAdvisorMain();
    });

    $("#adv-fetch-api").click(fetchMarketPrices);
}

async function fetchMarketPrices() {
    let key = requireApiKey(); if (!key) return;
    $("#adv-fetch-status").text("Fetching...");
    try {
        let r = await fetch(`https://api.torn.com/market/?selections=pointsmarket&key=${key}`); let d = await r.json();
        if(d.pointsmarket) {
            let v = Object.values(d.pointsmarket).sort((a,b)=>a.cost-b.cost)[0].cost;
            // FIX: Force US locale (commas)
            $("#item-input-points").val(v.toLocaleString('en-US')).trigger("change");
        }
        for(let id of Object.keys(ADVISOR_ITEMS)) {
            let r2=await fetch(`https://api.torn.com/v2/torn/${id}/items?sort=ASC&key=${key}`); let d2=await r2.json();
            let p=0; if(d2.value) p=d2.value.market_price; else if(d2.items && d2.items[0]) p=d2.items[0].value.market_price;

            // FIX: Force US locale (commas)
            if(p>0) $(`.item-price-input[data-id="${id}"]`).val(p.toLocaleString('en-US')).trigger("change");

            await new Promise(r=>setTimeout(r,100));
        }
        $("#adv-fetch-status").text("Done!");
    } catch(e) { $("#adv-fetch-status").text("Error"); }
}



async function fetchBankRates() {
    let key = requireApiKey(); if (!key) { alert("API Key missing"); return; }

    $("#adv-fetch-bank").text("Fetching...");

    try {
        const resRates = await fetch(`https://api.torn.com/v2/torn?selections=bank&key=${key}`);
        const dataRates = await resRates.json();
        const resPerks = await fetch(`https://api.torn.com/user/?selections=perks&key=${key}`);
        const dataPerks = await resPerks.json();

        if (dataRates.error) throw new Error(dataRates.error.error);

        const parseInterest = (list) => {
            if (!list || !Array.isArray(list)) return 0;
            let bonus = 0;
            list.forEach(str => {
                if (str.toLowerCase().includes("bank interest")) {
                    let match = str.match(/(\d+(?:\.\d+)?)%/);
                    if (match) bonus += parseFloat(match[1]);
                }
            });
            return bonus;
        };

        let totalBonus = 0;
        totalBonus += parseInterest(dataPerks.merit_perks);
        totalBonus += parseInterest(dataPerks.faction_perks);
        totalBonus += parseInterest(dataPerks.job_perks);
        totalBonus += parseInterest(dataPerks.property_perks);
        totalBonus += parseInterest(dataPerks.stock_perks);
        totalBonus += parseInterest(dataPerks.education_perks);
        totalBonus += parseInterest(dataPerks.book_perks);

        let multi = 1 + (totalBonus / 100);
        let bankData = dataRates.bank;

        if(bankData) {
            ["1w", "2w", "1m", "2m", "3m"].forEach(term => {
                if(bankData[term]) {
                    let baseApr = parseFloat(bankData[term]);
                    let finalApr = baseApr * multi;
                    // FIX: Trigger change so auto-save works
                    $(`#bank-${term}`).val(finalApr.toFixed(2)).trigger("change");
                }
            });
            $("#adv-fetch-bank").text("Updated!");
        } else {
            $("#adv-fetch-bank").text("No Data");
        }

    } catch(e) {
        console.error("Bank Fetch Error:", e);
        $("#adv-fetch-bank").text("Error");
    }
    setTimeout(() => $("#adv-fetch-bank").text("Fetch Rates (API)"), 2000);
}


async function openTradeAssistant() {
    let html = `
        <div id="assistant-container">
            <div class="MoDuL-tabs MoDuL-tabs-bar">
                <button class="tab-btn active" data-filter="all">⚖️ All</button>
                <button class="tab-btn MoDuL-green" data-filter="buy">📈 Buy</button>
                <button class="tab-btn MoDuL-red" data-filter="sell">📉 Sell</button>
                <button id="btn-analyze-now" class="MoDuL-mini-btn MoDuL-pill-accent MoDuL-btn-analyze">Analyze Now</button>
            </div>

            <div id="progress-wrapper" class="MoDuL-progress-wrap">
                <div id="progress-fill" class="MoDuL-progress-fill"></div>
            </div>

            <div id="assistant-feed" class="MoDuL-feed-list"></div>
        </div>
    `;

    $(".MoDuL-modal-overlay").remove();
    createModal("Trade Assistant", html);

    const $progressWrap = $("#progress-wrapper");
    const $progressFill = $("#progress-fill");
    const $feed = $("#assistant-feed");

    const symbols = Object.keys(STOCK_DATA);
    const results = [];
    const now = Date.now();
    const analysisStartedAt = Date.now();

    $progressWrap.show();
    $progressFill.css("width", "0%");
    $feed.html("");

    const bindTabsAndAnalyze = () => {
        $(".tab-btn").off("click").on("click", function () {
            $(".tab-btn").removeClass("active");
            $(this).addClass("active");

            const filter = $(this).data("filter");

            if (filter === "all") {
                $(".stock-card").show();
            } else {
                $(".stock-card").hide();
                $(`.stock-card[data-type='${filter}']`).show();
            }
        });

        $("#btn-analyze-now").off("click").on("click", function () {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith("MoDuL_cache_")) localStorage.removeItem(key);
            });
            openTradeAssistant();
        });
    };

    bindTabsAndAnalyze();

    const finalizeAnalysis = () => {
        const finish = () => {
            results.sort((a, b) => b.analysis.score - a.analysis.score);
            renderTradeList(results);

            $progressFill.css("width", "100%");

            setTimeout(() => {
                $progressWrap.fadeOut(180);
            }, 250);

            bindTabsAndAnalyze();
        };

        const elapsed = Date.now() - analysisStartedAt;
        const minVisible = 500;

        if (elapsed < minVisible) {
            setTimeout(finish, minVisible - elapsed);
        } else {
            finish();
        }
    };

    for (let i = 0; i < symbols.length; i++) {
        let sym = symbols[i];
        let stockKey = `MoDuL_cache_${sym}`;
        let history;

        try {
            let cachedItem = localStorage.getItem(stockKey);
            let parsed = cachedItem ? JSON.parse(cachedItem) : null;

            if (parsed && (now - parsed.timestamp) < 3600000 && Array.isArray(parsed.data)) {
                history = parsed.data;
            } else {
                const rawData = await fetchStockHistory(sym, "h1");
                history = rawData.map(h => [0, 0, 0, 0, h[4], h[5]]);

                localStorage.setItem(stockKey, JSON.stringify({
                    data: history,
                    timestamp: now
                }));
            }

            const prices = history.map(h => parseFloat(h[4]));
            const volumes = history.map(h => parseInt(h[5]) || 0);
            const currentVol = volumes[volumes.length - 1] || 0;
            const volWindow = volumes.slice(-24);
            const avgVol = volWindow.length
                ? volWindow.reduce((a, b) => a + b, 0) / volWindow.length
                : 0;

            const analysis = getTradeScore(prices);

            results.push({
                sym,
                history,
                analysis: {
                    ...analysis,
                    volSpike: avgVol > 0 ? currentVol > (avgVol * 2) : false,
                    currentVol
                }
            });
        } catch (e) {
            console.warn(`Trade Assistant skipped ${sym}:`, e);
        }

        const percent = Math.round(((i + 1) / symbols.length) * 100);
        $progressFill.css("width", percent + "%");
    }

    finalizeAnalysis();
}

function renderTradeList(dataList) {
    $("#assistant-feed").empty();

    let feedHtml = "";

    dataList.forEach(item => {
        const analysis = item.analysis;
        const history = item.history;
        const currentPrice = parseFloat(history[history.length - 1][4]);
        const price24hAgo = parseFloat(history[history.length - 24][4]);

        const type = analysis.score > 0 ? "buy" : (analysis.score < 0 ? "sell" : "hold");
        const colorClass = type === "buy" ? "MoDuL-green" : (type === "sell" ? "MoDuL-red" : "MoDuL-muted");
        const trendIcon = analysis.prediction > 0 ? "▲" : "▼";

        const histPrices = history.slice(0, -6).map(h => parseFloat(h[4]));
        const oldEma20 = calculateEMA(histPrices.slice(-20), 20);
        const oldEma90 = calculateEMA(histPrices.slice(-90), 90);
        const isGoldenCross = (analysis.ema20 > analysis.ema90 && oldEma20 <= oldEma90);

        const volIcon = analysis.volSpike
        ? `<span class="MoDuL-vol-icon" title="Volume Spike Detected">📊</span>`
            : "";

        feedHtml += `
            <div class="stock-card stock-card-${type}" data-sym="${item.sym}" data-type="${type}">
                <div class="MoDuL-stock-card-left">
                    <div class="MoDuL-stock-card-top">
                        <span class="MoDuL-stock-symbol">${item.sym}</span>
                        ${isGoldenCross ? '<span class="MoDuL-golden-cross" title="Recent Bullish Cross">✨</span>' : ''}
                        ${volIcon}
                    </div>

                    <span class="MoDuL-stock-signal ${colorClass}">
                        ${trendIcon} ${analysis.label}
                    </span>
                </div>

                <div class="MoDuL-stock-card-right">
                    <div class="MoDuL-stock-target">
                        Target: +${analysis.prediction}%
                    </div>
                    <div class="MoDuL-stock-24h ${currentPrice >= price24hAgo ? "MoDuL-green" : "MoDuL-red"}">
                        24h: ${((currentPrice - price24hAgo) / price24hAgo * 100).toFixed(2)}%
                    </div>
                </div>
            </div>
        `;
    });

    const container = $("#assistant-feed");
    if (feedHtml === "") {
        container.html('<div class="MoDuL-empty-state">No signals matching this category.</div>');
    } else {
        container.html(feedHtml);
    }

    $(".stock-card").off("click").on("click", function() {
        const sym = $(this).data("sym");
        const stockData = dataList.find(d => d.sym === sym);
        if (stockData) {
            openBigCard(sym, stockData.history);
        }
    });
}

function fetchStockHistory(symbol, interval = 'h1') {
    // Ensure symbol is Uppercase (Tornsy prefers this)
    const sym = symbol.toUpperCase();
    console.log(`Fetching data for ${sym}...`);

    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            // We use a clean URL without extra spaces or weird characters
            url: `https://tornsy.com/api/${sym}?interval=${interval}&limit=720`,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const data = JSON.parse(response.responseText);
                        // Check if the server actually gave us data
                        if (data && data.data) {
                            resolve(data.data);
                        } else {
                            reject("Empty Data");
                        }
                    } catch (e) {
                        reject("JSON Parse Error");
                    }
                } else {
                    console.error(`Error ${response.status}: ${response.responseText}`);
                    reject(`Error ${response.status}`);
                }
            },
            onerror: (err) => reject("Network Error")
        });
    });
}


function openBigCard(sym, history) {
    const prices = history.map(h => parseFloat(h[4]));
    const analysis = getTradeScore(prices);
    const currentPrice = prices[prices.length - 1];
    const owned = getOwnedShares(sym);

    let detailHtml = `
        <div id="big-card-content" class="MoDuL-flex-col MoDuL-gap-12">
            <div class="timeframe-bar MoDuL-timeframe-bar">
                <button class="tf-btn" data-hours="24">24H</button>
                <button class="tf-btn" data-hours="168">1W</button>
                <button class="tf-btn active" data-hours="720">1M</button>
            </div>

            <div class="MoDuL-chart-shell">
                <div class="MoDuL-chart-legend">
                    <span class="MoDuL-chart-legend-price">● Price</span>
                    <span class="MoDuL-chart-legend-ema20">— EMA 20</span>
                    <span class="MoDuL-chart-legend-ema90">— EMA 90</span>
                    <span class="MoDuL-chart-legend-vol">■ Volume</span>
                </div>
                <canvas id="big-chart-canvas" width="400" height="180" class="MoDuL-big-chart"></canvas>
            </div>

            <div class="MoDuL-bigcard-grid">
                <div class="MoDuL-card MoDuL-stat-card">
                    <div class="MoDuL-stat-label">MOMENTUM (RSI)</div>
                    <div class="MoDuL-stat-value ${analysis.rsi > 70 ? "MoDuL-red" : (analysis.rsi < 30 ? "MoDuL-green" : "MoDuL-white")}">
                        ${analysis.rsi.toFixed(2)}
                    </div>
                </div>

                <div class="MoDuL-card MoDuL-stat-card">
                    <div class="MoDuL-stat-label">24H CHANGE</div>
                    <div class="MoDuL-stat-value ${prices[prices.length - 1] > prices[prices.length - 24] ? "MoDuL-green" : "MoDuL-red"}">
                        ${((prices[prices.length - 1] - prices[prices.length - 24]) / prices[prices.length - 24] * 100).toFixed(2)}%
                    </div>
                </div>

                <div class="MoDuL-card MoDuL-stat-card">
                    <div class="MoDuL-stat-label">PREDICTED MOVE</div>
                    <div class="MoDuL-stat-value MoDuL-green MoDuL-bold">
                        +${analysis.prediction}%
                    </div>
                </div>

                <div class="MoDuL-card MoDuL-stat-card">
                    <div class="MoDuL-stat-label">30D HIGH</div>
                    <div class="MoDuL-stat-value">
                        ${formatMoney(Math.max(...prices))}
                    </div>
                </div>
            </div>

            <div class="MoDuL-trade-panel">
                <div class="MoDuL-trade-head">
                    <span class="MoDuL-soft">Owned: <strong id="owned-display" class="MoDuL-white">${owned.toLocaleString()}</strong></span>
                    <span class="MoDuL-soft">Price: <strong class="MoDuL-white">${formatMoney(currentPrice)}</strong></span>
                </div>

                <div class="MoDuL-trade-actions">
                    <input
                        type="text"
                        id="trade-amount"
                        class="MoDuL-input MoDuL-trade-amount"
                        placeholder="$ Amount (e.g. 10m)"
                    >
                    <button id="btn-buy-now" class="MoDuL-main-btn MoDuL-pill-success MoDuL-btn-trade">BUY</button>
                    <button id="btn-sell-now" class="MoDuL-main-btn MoDuL-pill-danger MoDuL-btn-trade">SELL</button>
                </div>

                <div id="trade-status" class="MoDuL-trade-status"></div>
            </div>
        </div>
    `;

    createModal(`${sym} Command Center`, detailHtml);

    setTimeout(() => {
        drawAnalyticChart("big-chart-canvas", history);
    }, 150);

    $(".tf-btn").on("click", function() {
        $(".tf-btn").removeClass("active");
        $(this).addClass("active");

        const hours = parseInt($(this).data("hours"));
        drawAnalyticChart("big-chart-canvas", history, hours);
    });

    $("#btn-buy-now").on("click", () => tradeFromAssistant(sym, "buy"));
    $("#btn-sell-now").on("click", () => tradeFromAssistant(sym, "sell"));
}


function drawAnalyticChart(canvasId, fullHistory, viewHours = 720) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // A. DATA PREP
    const allPrices = fullHistory.map(h => parseFloat(h[4]));
    const viewPrices = allPrices.slice(-viewHours);
    const viewVolumes = fullHistory.map(h => parseInt(h[5]) || 0).slice(-viewHours);

    const width = canvas.width;
    const height = canvas.height;

    // B. CALCULATE GLOBAL EMAs (at the specific point in time)
    const ema20Points = [];
    const ema90Points = [];

    // We loop through the entire month to get the accurate EMA values
    for (let i = 0; i < allPrices.length; i++) {
        if (i >= 20) ema20Points.push(calculateEMA(allPrices.slice(0, i + 1), 20));
        if (i >= 90) ema90Points.push(calculateEMA(allPrices.slice(0, i + 1), 90));
    }

    // C. GET THE VIEWABLE SLICE OF EMAs
    const viewEma20 = ema20Points.slice(-viewHours);
    const viewEma90 = ema90Points.slice(-viewHours);

    // D. ABSOLUTE SCALE (The "Master List")
    // We find the High/Low of the Price, EMA20, and EMA90 ONLY for the viewable window
    const allVisible = [...viewPrices, ...viewEma20, ...viewEma90];
    const absMin = Math.min(...allVisible);
    const absMax = Math.max(...allVisible);

    const padding = (absMax - absMin) * 0.12; // 12% padding for clear view
    const minScale = absMin - padding;
    const maxScale = absMax + padding;
    const range = maxScale - minScale;

    const getY = (val) => (height * 0.8) - ((val - minScale) / (range || 1)) * (height * 0.8);

    ctx.clearRect(0, 0, width, height);

    // E. DRAW VOLUME (Bottom 20%)
    const maxVol = Math.max(...viewVolumes);
    ctx.fillStyle = "rgba(0, 229, 255, 0.2)";
    viewVolumes.forEach((v, i) => {
        const x = (i / (viewHours - 1)) * width;
        const barH = (v / (maxVol || 1)) * (height * 0.15);
        ctx.fillRect(x, height - barH, (width/viewHours)*0.8, barH);
    });

    // F. DRAW GLOBAL EMA 90 (Orange)
    ctx.strokeStyle = "rgba(255, 140, 0, 0.8)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    viewEma90.forEach((val, i) => {
        const x = (i / (viewHours - 1)) * width;
        if (i === 0) ctx.moveTo(x, getY(val)); else ctx.lineTo(x, getY(val));
    });
    ctx.stroke();

    // G. DRAW GLOBAL EMA 20 (Yellow)
    ctx.strokeStyle = "rgba(255, 235, 59, 0.8)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    viewEma20.forEach((val, i) => {
        const x = (i / (viewHours - 1)) * width;
        if (i === 0) ctx.moveTo(x, getY(val)); else ctx.lineTo(x, getY(val));
    });
    ctx.stroke();

    // H. DRAW PRICE (Green)
    ctx.strokeStyle = "#8bc34a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    viewPrices.forEach((p, i) => {
        const x = (i / (viewHours - 1)) * width;
        if (i === 0) ctx.moveTo(x, getY(p)); else ctx.lineTo(x, getY(p));
    });
    ctx.stroke();
}


async function tradeFromAssistant(sym, type) {
    const amountInput = $("#trade-amount").val();
    const amount = parseTornNumber(amountInput);

    if (!amount || amount <= 0) {
        $("#trade-status").text("❌ Enter a valid amount").css("color", "#ef5350");
        return;
    }

    const price = getPrice(sym);
    const shares = type === "buy" ? Math.floor(amount / price) : Math.ceil(amount / price);
    const step = type === "buy" ? "buyShares" : "sellShares";

    $("#trade-status").text(`⏳ ${type === 'buy' ? 'Buying' : 'Selling'}...`).css("color", "#ffeb3b");

    try {
        // Calling your original postTrade function
        await postTrade(sym, shares, step, `${type === 'buy' ? 'Bought' : 'Sold'} ${shares.toLocaleString()} shares of ${sym}`);

        // SUCCESS UPDATE
        $("#trade-status").html(`✅ Successfully ${type === 'buy' ? 'bought' : 'sold'} ${shares.toLocaleString()} shares!`).css("color", "#8bc34a");
        $("#trade-amount").val(""); // Clear input

        // Refresh the 'Owned' display in the Big Card
        const newOwned = getOwnedShares(sym);
        $(".MoDuL-modal strong:first").text(newOwned.toLocaleString());

    } catch (e) {
        $("#trade-status").text("❌ Error processing trade").css("color", "#ef5350");
    }
}

// 1. RSI (Relative Strength Index)
// Tells us if people are over-buying (Red zone) or over-selling (Green zone)
function calculateRSI(prices, period = 14) {
    let gains = 0, losses = 0;
    // We look at the differences between closing prices
    for (let i = prices.length - period; i < prices.length; i++) {
        let diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    let rs = (gains / period) / (losses / period);
    return 100 - (100 / (1 + rs));
}

function calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    let ema = prices[0]; // Start with the first price
    for (let i = 1; i < prices.length; i++) {
        ema = (prices[i] * k) + (ema * (1 - k));
    }
    return ema;
}

// 2. Bollinger Bands
// Tells us if the price is "too high" or "too low" compared to its recent average
function calculateBollinger(prices, period = 20) {
    const slice = prices.slice(-period);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(slice.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b) / period);
    const upper = avg + (stdDev * 2);
    const lower = avg - (stdDev * 2);
    const currentPrice = prices[prices.length - 1];

    return {
        upper, lower,
        // Position: 0 means at the bottom band (Buy), 1 means at the top (Sell)
        position: (currentPrice - lower) / (upper - lower)
    };
}

function getTradeScore(prices) {
    let score = 0;
    let signals = [];
    const currentPrice = prices[prices.length - 1];

    // 1. ANALYTIC TOOLS
    const rsi = calculateRSI(prices);
    const bb = calculateBollinger(prices);
    const ema20 = calculateEMA(prices.slice(-20), 20);
    const ema90 = calculateEMA(prices.slice(-90), 90);
    const monthlySMA = prices.reduce((a, b) => a + b, 0) / prices.length;

    // 2. MOMENTUM SCORING (RSI)
    if (rsi < 30) { score += 40; signals.push("Oversold (RSI)"); }
    else if (rsi > 70) { score -= 40; signals.push("Overbought (RSI)"); }

    // 3. RANGE SCORING (Bollinger Bands)
    if (bb.position < 0.1) { score += 40; signals.push("Bottom of Range"); }
    else if (bb.position > 0.9) { score -= 40; signals.push("Top of Range"); }

    // 4. TREND SCORING (EMA Crossovers)
    if (ema20 > ema90) {
        score += 25;
        signals.push("Bullish Trend (20/90)");
    } else {
        score -= 25;
        signals.push("Bearish Trend (20/90)");
    }

    // 5. VALUE SCORING (Monthly Average)
    if (currentPrice < monthlySMA) {
        score += 15;
        signals.push("Below Monthly Avg");
    } else {
        score -= 10;
        signals.push("Above Monthly Avg");
    }

    // 6. DETERMINE LABEL
    let label = "Hold";
    if (score >= 80) label = "Strong Buy";
    else if (score >= 40) label = "Buy";
    else if (score <= -80) label = "Strong Sell";
    else if (score <= -40) label = "Sell";

    // 7. PREDICT PROFIT % (Targeting the Upper Bollinger Band)
    const targetPrice = bb.upper;
    const prediction = ((targetPrice - currentPrice) / currentPrice) * 100;

    return {
        score,
        label,
        signals,
        rsi,
        bb,
        ema20,
        ema90,
        sma: monthlySMA,
        prediction: prediction.toFixed(1)
    };
}

// --- UPDATED SETTINGS MENU (Merged Blocks) ---
function openNetworthSettings() {
    let s = networthSettings.sources;

    let generalHtml = `
    <div class="MoDuL-card">
        <div class="MoDuL-card-head"><span class="MoDuL-card-title">General Settings</span></div>
        <div class="MoDuL-pad-10 MoDuL-flex-col MoDuL-gap-10">
            <div>
                <div class="MoDuL-settings-mini-title">Networth Sources</div>
                <div class="MoDuL-flex MoDuL-gap-10">
                    <label class="MoDuL-inline-check"><input type="checkbox" id="nw-src-inv" ${s.inventory ? "checked" : ""}> Inv</label>
                    <label class="MoDuL-inline-check"><input type="checkbox" id="nw-src-pts" ${s.points ? "checked" : ""}> Points</label>
                    <label class="MoDuL-inline-check"><input type="checkbox" id="nw-src-stocks" ${s.stocks ? "checked" : ""}> Stocks</label>
                </div>
            </div>

            <div class="MoDuL-divider-soft"></div>

            <div>
                <div class="MoDuL-settings-mini-title">Stock Value Logic</div>
                <select id="nw-exclude-mode" class="MoDuL-select-wrapper">
                    <option value="all" ${networthSettings.excludeMode === "all" ? "selected" : ""}>Count Entire Value</option>
                    <option value="active" ${networthSettings.excludeMode === "active" ? "selected" : ""}>Exclude Active Blocks</option>
                </select>
                <div class="MoDuL-settings-help">"Exclude Active Blocks" removes value of completed tiers.</div>
            </div>
        </div>
    </div>`;

    let bankInputs = ["1w", "2w", "1m", "2m", "3m"].map(t => `
        <div class="MoDuL-bank-rate-row">
            <span class="MoDuL-bank-rate-label">${t}</span>
            <input id="bank-${t}" class="MoDuL-tbl-input MoDuL-bank-rate-input" value="${bankSettings["roi_" + t] || 0}">
        </div>
    `).join("");

    let bankHtml = `
    <div class="MoDuL-card">
        <div class="MoDuL-card-head"><span class="MoDuL-card-title">Bank ROI % (APR)</span></div>
        <div class="MoDuL-pad-12">
            <div class="MoDuL-flex-col MoDuL-gap-6">${bankInputs}</div>
            <button id="adv-fetch-bank" class="MoDuL-mini-btn MoDuL-pill-accent MoDuL-bank-fetch-btn">Fetch Rates (API)</button>
        </div>
    </div>`;

    let excludedHtml = `
    <div class="MoDuL-card MoDuL-grid-span-2">
        <div class="MoDuL-card-head"><span class="MoDuL-card-title">Manually Excluded Stocks</span></div>
        <div class="MoDuL-check-list MoDuL-check-list-3col MoDuL-check-list-short">
            ${Object.keys(STOCK_DATA).sort().map(sym => `
                <label class="MoDuL-stock-exclude-label">
                    <input type="checkbox" class="nw-exclude-stock" value="${sym}" ${networthSettings.excludedStocks.includes(sym) ? "checked" : ""}>
                    ${sym}
                </label>
            `).join("")}
        </div>
    </div>`;

    let html = `
    <div class="MoDuL-settings-grid MoDuL-settings-grid-tight">
        ${generalHtml}
        ${bankHtml}
        ${excludedHtml}
    </div>
    <button id="adv-back-nw" class="MoDuL-btn-main MoDuL-btn-back MoDuL-w-100 MoDuL-pad-btn">Back</button>`;

    createModal("Networth Settings", html);

    const autoSave = () => {
        networthSettings.sources.inventory = $("#nw-src-inv").is(":checked");
        networthSettings.sources.points = $("#nw-src-pts").is(":checked");
        networthSettings.sources.stocks = $("#nw-src-stocks").is(":checked");
        networthSettings.excludeMode = $("#nw-exclude-mode").val();

        let ex = [];
        $(".nw-exclude-stock:checked").each(function() { ex.push($(this).val()); });
        networthSettings.excludedStocks = ex;

        ["1w", "2w", "1m", "2m", "3m"].forEach(t => {
            bankSettings["roi_" + t] = parseFloat($(`#bank-${t}`).val()) || 0;
        });

        localStorage.setItem("MoDuL_advisor_networth", JSON.stringify(networthSettings));
        localStorage.setItem("MoDuL_advisor_bank", JSON.stringify(bankSettings));
    };

    $(".MoDuL-modal-body").on("change keyup", "input, select", autoSave);

    $("#adv-back-nw").click(() => {
        $(".MoDuL-modal-overlay").remove();
        openAdvisorMain();
    });

    $("#adv-fetch-bank").click(fetchBankRates);
}
insert();

//CSS
const style = `
:root{
  --modul-bg:#333333;
  --modul-bg2:#44444;
  --modul-panel:#303030;
  --modul-border:#2d3946;
  --modul-border-soft:#344250;
  --modul-text:#d7e1eb;
  --modul-text-soft:#a8b6c5;
  --modul-text-dim:#8392a2;
  --modul-accent:#6c8fb3;
  --modul-accent2:#9cb7d1;
  --modul-accent3:#55779a;
  --modul-green:#7bc67b;
  --modul-red:#df6b6b;
  --modul-gold:#d5b26a;
  --modul-shadow:0 1px 0 rgba(255,255,255,.03), 0 6px 18px rgba(0,0,0,.28);
  --modul-glow:none;
}
/* =========================
   DAILY COST SETTINGS FIX
   ========================= */

/* Make all text inside the modal readable */
.MoDuL-modal-body .MoDuL-card,
.MoDuL-modal-body .MoDuL-card td,
.MoDuL-modal-body .MoDuL-card th,
.MoDuL-modal-body .MoDuL-card label,
.MoDuL-modal-body .MoDuL-card span,
.MoDuL-modal-body .MoDuL-card div {
    color: var(--modul-text);
}
.MoDuL-check-list-vertical {
    background: linear-gradient(180deg, #0c1422 0%, #09111c 100%);
    border: 1px solid rgba(52,179,255,.10);
    border-radius: 8px;
}

.MoDuL-check-list-vertical .MoDuL-check-label {
    font-size: 12px;
    color: var(--modul-text);
}

/* Section titles stay tinted */
.MoDuL-modal-body .MoDuL-card-title {
    color: var(--modul-text-soft);
}

/* First column labels in tables */
.MoDuL-modal-body .MoDuL-card .MoDuL-table td:first-child {
    color: var(--modul-text-soft);
}

/* Xanax / FHC gold labels */
.MoDuL-modal-body .MoDuL-card .MoDuL-gold {
    color: var(--modul-gold) !important;
}

/* Inputs remain bright */
.MoDuL-modal-body .MoDuL-card input.MoDuL-tbl-input {
    color: #fff;
}

/* Checkbox labels in refill section */
.MoDuL-check-list-vertical .MoDuL-check-label,
.MoDuL-check-list .MoDuL-check-label {
    color: var(--modul-text) !important;
}

/* Consumable scroll rows */
.MoDuL-cost-can-wrap .MoDuL-table td {
    color: var(--modul-text);
}
.MoDuL-cost-can-wrap .MoDuL-table td:first-child {
    color: var(--modul-text-soft);
}

/* Fee labels */
#cost-duke,
#cost-rehab {
    color: #fff;
}

/* Button row stays readable */
#MoDuL-back-costs,
#MoDuL-close-costs {
    color: #fff;
}
/* =========================
   DIAGNOSTIC TOOL READABILITY FIX
   ========================= */

.MoDuL-diagnostic-table-wrap .MoDuL-table,
.MoDuL-diagnostic-table-wrap .MoDuL-table th,
.MoDuL-diagnostic-table-wrap .MoDuL-table td,
.MoDuL-diagnostic-table-wrap .sim-row,
.MoDuL-diagnostic-table-wrap .sim-row td {
    color: var(--modul-text);
}

.MoDuL-diagnostic-table-wrap .MoDuL-table th {
    color: var(--modul-text-soft);
    font-weight: 700;
}

.MoDuL-diagnostic-table-wrap .MoDuL-table td {
    color: var(--modul-text);
}

.MoDuL-diagnostic-table-wrap .MoDuL-table td:first-child {
    color: var(--modul-text);
}

.MoDuL-diagnostic-table-wrap .MoDuL-table input,
.MoDuL-diagnostic-table-wrap .MoDuL-table label,
.MoDuL-diagnostic-table-wrap .MoDuL-table span {
    color: inherit;
}

/* Tier tag was too dim */
.MoDuL-tier-tag {
    color: var(--modul-text-dim);
    opacity: .9;
}

/* Better table contrast */
.MoDuL-diagnostic-table-wrap .MoDuL-table tbody tr {
    background: transparent;
    transition: background .15s ease;
}

.MoDuL-diagnostic-table-wrap .MoDuL-table tbody tr:hover {
    background: rgba(52, 179, 255, 0.08) !important;
}

/* Make highlighted rows readable */
.MoDuL-diagnostic-table-wrap .sim-row[style*="rgba(102, 187, 106"],
.MoDuL-diagnostic-table-wrap .sim-row[style*="rgba(66, 165, 245"],
.MoDuL-diagnostic-table-wrap .sim-row[style*="rgba(255, 213, 79"],
.MoDuL-diagnostic-table-wrap .sim-row[style*="rgba(239, 83, 80"] {
    color: #ffffff !important;
}

.MoDuL-diagnostic-table-wrap .sim-row[style*="rgba(102, 187, 106"] td,
.MoDuL-diagnostic-table-wrap .sim-row[style*="rgba(66, 165, 245"] td,
.MoDuL-diagnostic-table-wrap .sim-row[style*="rgba(255, 213, 79"] td,
.MoDuL-diagnostic-table-wrap .sim-row[style*="rgba(239, 83, 80"] td {
    color: #ffffff !important;
}

/* Inputs inside highlighted rows */
.MoDuL-diagnostic-table-wrap .sim-row input[type="text"] {
    color: #fff;
}

/* Checkbox lock line */
.MoDuL-bank-lock-label {
    color: var(--modul-text-soft);
}

/* Summary strip */
.MoDuL-diagnostic-summary {
    color: var(--modul-text);
}

.MoDuL-diagnostic-legend {
    color: var(--modul-text-soft);
}

.MoDuL-flex-1 { flex:1; }

.MoDuL-actions-stack {
    display:block;
}
.MoDuL-actions-no-top {
    border-top:none;
    padding-top:10px;
}
.MoDuL-gap-6 { gap:6px; }

.MoDuL-grid-span-2 {
    grid-column: span 2;
}

.MoDuL-pad-btn {
    padding:10px;
}

.MoDuL-check-list-vertical {
    height:auto;
    display:flex;
    flex-direction:column;
    gap:8px;
}

.MoDuL-check-list-3col {
    display:grid;
    grid-template-columns: repeat(3, 1fr);
    gap:5px;
}

.MoDuL-check-list-short {
    height:120px;
}

.MoDuL-settings-grid-tight {
    grid-template-columns: 1fr 1fr;
    gap:15px;
    margin-bottom:15px;
}

.MoDuL-btn-back {
    background:#444;
}

.MoDuL-btn-fetch-market {
    width:100%;
    margin-bottom:10px;
    background:#2a4040;
    border-color:#609b9b;
}

.MoDuL-fetch-status {
    text-align:center;
    font-size:10px;
    margin:8px 0;
    color:var(--modul-text-dim);
}

.MoDuL-item-settings-scroll {
    height:400px;
    overflow-y:auto;
    border-top:1px solid #333;
    border-bottom:1px solid #333;
    padding-right:5px;
}

.MoDuL-section-header {
    background:#222;
    padding:5px 8px;
    font-weight:bold;
    color:#ccc;
    border-bottom:1px solid #444;
    margin-top:0;
}

.MoDuL-cost-divider {
    margin:8px 0;
}

.MoDuL-cost-can-wrap {
    max-height:120px;
    overflow-y:auto;
}

.MoDuL-inline-check {
    font-size:11px;
    cursor:pointer;
}

.MoDuL-settings-mini-title {
    font-size:10px;
    color:#888;
    margin-bottom:5px;
    text-transform:uppercase;
    font-weight:bold;
}

.MoDuL-settings-help {
    font-size:10px;
    color:#666;
    line-height:1.2;
}

.MoDuL-bank-rate-row {
    display:flex;
    justify-content:space-between;
    align-items:center;
}

.MoDuL-bank-rate-label {
    font-size:11px;
    color:#aaa;
    font-weight:bold;
    width:25px;
}

.MoDuL-bank-rate-input {
    width:60px;
}

.MoDuL-bank-fetch-btn {
    width:100%;
    margin:12px 0 0 0;
    padding:6px;
}

.MoDuL-stock-exclude-label {
    display:flex;
    align-items:center;
    gap:6px;
}

.MoDuL-diagnostic-head {
    background:#222;
    padding:10px;
    border-bottom:1px solid #444;
}

.MoDuL-diagnostic-summary {
    display:flex;
    justify-content:space-between;
    background:#111;
    padding:6px;
    border-radius:4px;
    margin-bottom:8px;
    font-size:11px;
}

.MoDuL-diagnostic-legend {
    font-size:10px;
    color:#888;
    display:flex;
    flex-wrap:wrap;
    gap:8px;
}

.MoDuL-diagnostic-table-wrap {
    height:55vh;
    overflow-y:auto;
}

.MoDuL-diagnostic-cash {
    width:100px;
    font-weight:bold;
    color:#fff;
}

.MoDuL-diagnostic-back {
    margin-left:0;
    border-color:#666;
    color:#ccc;
}

.MoDuL-tier-tag {
    color:#666;
    font-size:9px;
}

.MoDuL-bank-extra-row {
    display:flex;
    align-items:center;
    gap:5px;
    margin-top:2px;
}

.MoDuL-bank-amt-input {
    width:90px;
    font-size:10px;
    padding:2px;
}

.MoDuL-bank-lock-label {
    display:flex;
    align-items:center;
    font-size:9px;
    color:#888;
    cursor:pointer;
}

.MoDuL-cell-center {
    text-align:center;
    vertical-align:middle;
}

.MoDuL-cell-top-right {
    text-align:right;
    vertical-align:top;
    padding-top:8px;
}

.MoDuL-th-own {
    width:30px;
}

.MoDuL-dot.MoDuL-green { color:#66bb6a; }
.MoDuL-dot.MoDuL-accent { color:#42a5f5; }
.MoDuL-dot.MoDuL-gold { color:#eebb44; }
.MoDuL-dot.MoDuL-red { color:#ef5350; }
.MoDuL-card-accent {
    border-color: rgba(98,212,255,.32);
}

.MoDuL-cash-display {
    text-align:center;
    margin-top:10px;
    font-size:13px;
    color:#fff;
    font-weight:bold;
}

.MoDuL-hero-trigger {
    cursor:pointer;
    padding-bottom:5px;
    border-bottom:1px solid rgba(52,179,255,.12);
    margin-bottom:10px;
}
.MoDuL-hero-detail {
    line-height:1.4;
    font-size:12px;
}

.MoDuL-tabs-bar {
    display:flex;
    gap:5px;
    margin-bottom:15px;
    border-bottom:1px solid rgba(52,179,255,.12);
    padding-bottom:10px;
    align-items:center;
}

.MoDuL-btn-analyze {
    margin-left:auto;
    height:28px;
}

#progress-wrapper.MoDuL-progress-wrap{
    display:block !important;
    width:100% !important;
    height:10px !important;
    margin:12px 0 16px !important;
    border-radius:999px !important;
    overflow:hidden !important;
    background:linear-gradient(180deg, #0b1320 0%, #08101a 100%) !important;
    border:1px solid rgba(52,179,255,.22) !important;
    box-shadow:
        inset 0 1px 0 rgba(255,255,255,.03),
        0 0 0 1px rgba(0,0,0,.18) !important;
}

#progress-fill.MoDuL-progress-fill{
    display:block !important;
    width:0% !important;
    height:100% !important;
    border-radius:999px !important;
    background:linear-gradient(90deg, #1f7cff 0%, #34b3ff 55%, #62d4ff 100%) !important;
    box-shadow:0 0 14px rgba(52,179,255,.35) !important;
    transition:width .16s ease !important;
}

.MoDuL-feed-list {
    max-height:400px;
    overflow-y:auto;
    display:flex;
    flex-direction:column;
    gap:5px;
}

.MoDuL-stock-card-left {
    display:flex;
    flex-direction:column;
    gap:2px;
}
.MoDuL-stock-card-right {
    text-align:right;
    display:flex;
    flex-direction:column;
    gap:2px;
}
.MoDuL-stock-card-top {
    display:flex;
    align-items:center;
    gap:4px;
}
.MoDuL-stock-symbol {
    font-weight:bold;
    color:#fff;
    font-size:14px;
}
.MoDuL-stock-signal {
    font-size:11px;
    font-weight:bold;
    text-transform:uppercase;
    letter-spacing:0.5px;
}
.MoDuL-stock-target {
    font-size:13px;
    color:#fff;
    font-weight:bold;
}
.MoDuL-stock-24h {
    font-size:10px;
    font-weight:500;
}
.MoDuL-vol-icon {
    color:#00e5ff;
    font-size:12px;
    margin-left:3px;
}
.MoDuL-golden-cross {
    color:#ffeb3b;
    font-size:12px;
}

.stock-card-buy { border-left-color: var(--modul-green); }
.stock-card-sell { border-left-color: var(--modul-red); }
.stock-card-hold { border-left-color: #35506f; }

.MoDuL-empty-state {
    text-align:center;
    padding:30px;
    color:var(--modul-text-dim);
    font-style:italic;
}

.MoDuL-timeframe-bar {
    display:flex;
    justify-content:center;
    gap:8px;
    margin-bottom:5px;
}

.MoDuL-chart-shell {
    background:#000;
    padding:10px;
    border-radius:8px;
    border:1px solid #333;
    position:relative;
}
.MoDuL-chart-legend {
    display:flex;
    justify-content:center;
    gap:12px;
    font-size:9px;
    margin-bottom:8px;
    border-bottom:1px solid #222;
    padding-bottom:5px;
}
.MoDuL-chart-legend-price { color:#8bc34a; }
.MoDuL-chart-legend-ema20 { color:#ffeb3b; }
.MoDuL-chart-legend-ema90 { color:#ff8c00; }
.MoDuL-chart-legend-vol { color:rgba(0,229,255,0.6); }

.MoDuL-big-chart {
    width:100%;
    height:180px;
}

.MoDuL-bigcard-grid {
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:10px;
}

.MoDuL-stat-card {
    padding:10px;
    background:#1e1e1e;
    border-radius:6px;
}
.MoDuL-stat-label {
    font-size:9px;
    color:var(--modul-text-dim);
}
.MoDuL-stat-value {
    font-size:16px;
    color:#fff;
}

.MoDuL-trade-panel {
    background:#222;
    padding:15px;
    border-radius:8px;
    border:1px solid #444;
}
.MoDuL-trade-head {
    display:flex;
    justify-content:space-between;
    margin-bottom:12px;
    font-size:12px;
}
.MoDuL-trade-actions {
    display:flex;
    gap:10px;
}
.MoDuL-trade-amount {
    flex:1;
    height:34px;
    background:#111;
    color:#fff;
    border:1px solid #444;
    padding:0 10px;
    border-radius:4px;
}
.MoDuL-btn-trade {
    min-width:60px;
}
.MoDuL-trade-status {
    font-size:11px;
    margin-top:10px;
    text-align:center;
    min-height:14px;
}
.MoDuL-flex { display:flex; }
.MoDuL-flex-col { display:flex; flex-direction:column; }
.MoDuL-center { align-items:center; }
.MoDuL-between { justify-content:space-between; }
.MoDuL-justify-center { justify-content:center; }
.MoDuL-wrap { flex-wrap:wrap; }

.MoDuL-gap-4 { gap:4px; }
.MoDuL-gap-5 { gap:5px; }
.MoDuL-gap-8 { gap:8px; }
.MoDuL-gap-10 { gap:10px; }
.MoDuL-gap-12 { gap:12px; }
.MoDuL-gap-15 { gap:15px; }

.MoDuL-mb-5 { margin-bottom:5px; }
.MoDuL-mb-8 { margin-bottom:8px; }
.MoDuL-mb-10 { margin-bottom:10px; }
.MoDuL-mb-12 { margin-bottom:12px; }
.MoDuL-mt-8 { margin-top:8px; }
.MoDuL-mt-10 { margin-top:10px; }

.MoDuL-ml-auto { margin-left:auto; }
.MoDuL-ml-5 { margin-left:5px; }

.MoDuL-w-100 { width:100%; }
.MoDuL-w-90 { width:90px; }
.MoDuL-w-100px { width:100px; }
.MoDuL-w-60 { width:60px; }

.MoDuL-text-center { text-align:center; }
.MoDuL-text-right { text-align:right; }
.MoDuL-text-left { text-align:left; }

.MoDuL-font-9 { font-size:9px; }
.MoDuL-font-10 { font-size:10px; }
.MoDuL-font-11 { font-size:11px; }
.MoDuL-font-12 { font-size:12px; }
.MoDuL-font-13 { font-size:13px; }
.MoDuL-font-14 { font-size:14px; }
.MoDuL-font-16 { font-size:16px; }

.MoDuL-bold { font-weight:bold; }
.MoDuL-semi { font-weight:600; }

.MoDuL-muted { color:var(--modul-text-dim); }
.MoDuL-soft { color:var(--modul-text-soft); }
.MoDuL-white { color:#fff; }
.MoDuL-green { color:var(--modul-green); }
.MoDuL-red { color:var(--modul-red); }
.MoDuL-gold { color:var(--modul-gold); }
.MoDuL-accent { color:var(--modul-accent2); }

.MoDuL-panel {
    background: linear-gradient(180deg, rgba(18,28,44,.96) 0%, rgba(11,18,31,.96) 100%);
    border: 1px solid var(--modul-border-soft);
    border-radius: 10px;
}

.MoDuL-subpanel {
    background: linear-gradient(180deg, #10182a 0%, #0c1421 100%);
    border: 1px solid rgba(52,179,255,.10);
    border-radius: 8px;
}

.MoDuL-pad-6 { padding:6px; }
.MoDuL-pad-8 { padding:8px; }
.MoDuL-pad-10 { padding:10px; }
.MoDuL-pad-12 { padding:12px; }
.MoDuL-pad-15 { padding:15px; }

.MoDuL-scroll-y { overflow-y:auto; }

.MoDuL-border-bottom {
    border-bottom:1px solid rgba(52,179,255,.12);
}
.MoDuL-border-top {
    border-top:1px solid rgba(52,179,255,.12);
}
.MoDuL-divider-soft {
    border-top:1px dashed rgba(52,179,255,.18);
}

.MoDuL-pill-success {
    color: var(--modul-green) !important;
    border-color: var(--modul-green) !important;
}
.MoDuL-pill-danger {
    color: var(--modul-red) !important;
    border-color: var(--modul-red) !important;
}
.MoDuL-pill-gold {
    color: var(--modul-gold) !important;
    border-color: var(--modul-gold) !important;
}
.MoDuL-pill-accent {
    color: var(--modul-accent2) !important;
    border-color: var(--modul-accent) !important;
}

.MoDuL-pl-container{
    padding:8px 12px;
    margin-bottom:12px;
}
.MoDuL-pl-display{
    font-size:11px;
    text-align:center;
    color:var(--modul-text-dim);
}
.MoDuL-link-btn{
    background:none;
    border:none;
    color:var(--modul-accent2);
    cursor:pointer;
    text-decoration:underline;
    font:inherit;
    padding:0;
}
.MoDuL-link-btn:hover{
    color:#fff;
}
.MoDuL-input-grow{ flex-grow:1; }
.MoDuL-input-center{ text-align:center; }
.MoDuL-input-spaced{ letter-spacing:2px; }
.MoDuL-input-100{ width:100px; }

.MoDuL-trade-btn{
    margin-left:5px;
    border-color:var(--modul-green);
}
.MoDuL-owned-display{
    margin-left:10px;
    font-size:11px;
    color:var(--modul-text-dim);
}
.MoDuL-confirm-row{
    display:none;
    gap:5px;
}
.MoDuL-btn-muted{
    color:#aaa !important;
    border-color:#444 !important;
}
.tf-btn {
    background: linear-gradient(180deg, #101a2b 0%, #0d1522 100%);
    border: 1px solid var(--modul-border);
    color: var(--modul-text-soft);
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
}
.tf-btn.active {
    background: linear-gradient(180deg, rgba(52,179,255,.20) 0%, rgba(31,124,255,.16) 100%);
    color: #fff;
    border-color: var(--modul-accent);
    box-shadow: var(--modul-glow);
}
.tf-btn:hover {
    background: linear-gradient(180deg, #14213a 0%, #10192c 100%);
    color: #fff;
    border-color: var(--modul-accent2);
}

.tab-btn {
    flex: 1;
    background: linear-gradient(180deg, #111b2c 0%, #0d1624 100%);
    border: 1px solid var(--modul-border-soft);
    color: var(--modul-text-soft);
    padding: 6px;
    border-radius: 6px;
    font-size: 11px;
    cursor: pointer;
    font-weight: bold;
    transition: .2s ease;
}
.tab-btn.active {
    background: linear-gradient(180deg, rgba(52,179,255,.18) 0%, rgba(31,124,255,.14) 100%);
    border-color: var(--modul-accent);
    color: #fff;
    box-shadow: var(--modul-glow);
}
.tab-btn:hover{
    border-color: var(--modul-accent2);
    color:#fff;
}

#assistant-feed::-webkit-scrollbar {
    width: 5px;
}

#assistant-feed::-webkit-scrollbar-track {
    background: #08101c;
    border-radius: 10px;
}

#assistant-feed::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #1d4d77 0%, #2d8fd0 100%);
    border-radius: 10px;
}

/* The Stock Card */
.stock-card {
    background: linear-gradient(180deg, rgba(44,44,44,.96) 0%, rgba(22,22,22,.96) 100%);
    border: 1px solid var(--modul-border-soft);
    border-left: 4px solid #35506f;
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 3px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: transform 0.12s ease, background 0.2s ease, border-color .2s ease, box-shadow .2s ease;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.02);
}

.stock-card:hover {
    background: linear-gradient(180deg, rgba(33,33,33,.98) 0%, rgba(13,22,36,.98) 100%);

    border-color: var(--modul-accent);
    box-shadow: var(--modul-glow);
}

/* Mobile specific */
@media screen and (max-width: 480px) {
    .stock-card {
        flex-direction: column;
        align-items: flex-start;
        gap: 5px;
    }
}

.MoDuL-card-head {
    cursor: pointer;
    user-select: none;
}
.MoDuL-card-head:hover .MoDuL-card-title {
    color: #fff;
}

.MoDuL-card-details {
    display: none;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed rgba(52,179,255,.18);
    font-size: 11px;
    color: var(--modul-text);
}
.MoDuL-refill-panel {
    align-content: start;
    min-height: 70px;
}
/* Replace floating centered titles */
.MoDuL-section-header-center {
    background: linear-gradient(90deg, rgba(52,179,255,.08), transparent);
    padding: 6px 10px;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    font-size: 11px;
    font-weight: 700;
    letter-spacing: .6px;
    text-transform: uppercase;

    color: var(--modul-text-soft);

    margin-bottom: 8px;
    padding-bottom: 6px;

    border-bottom: 1px solid rgba(52,179,255,.12);
}

/* Remove old centered style */
.MoDuL-section-header-center span {
    margin: 0;
}

/* Optional: clickable indicator */
.MoDuL-section-header-center .MoDuL-toggle {
    color: #4cc3ff;
    font-size: 11px;
}
.MoDuL-detail-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
}
.MoDuL-detail-sub {
    color: var(--modul-text-soft);
    padding-left: 8px;
}
.MoDuL-detail-total {
    border-top: 1px solid rgba(52,179,255,.18);
    margin-top: 4px;
    padding-top: 4px;
    font-weight: bold;
    color: var(--modul-green);
}

.MoDuL-detail-miss {
    border-top: 1px solid rgba(255,107,107,.20);
    margin-top: 4px;
    padding-top: 4px;
    font-weight: bold;
    color: var(--modul-red);
}

.MoDuL-hero {
    cursor: pointer;
    transition: all 0.2s ease;
    background:
      radial-gradient(circle at top right, rgba(52,179,255,.12), transparent 35%),
      linear-gradient(135deg, #111b2c 0%, #0b1220 60%, #09101b 100%);
    border: 1px solid var(--modul-border);
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    position: relative;
    box-shadow: var(--modul-shadow);
}
.MoDuL-hero:hover {
    border-color: var(--modul-accent);
    box-shadow: 0 0 0 1px rgba(52,179,255,.16), 0 14px 32px rgba(0,0,0,.5), 0 0 20px rgba(52,179,255,.18);
}

.MoDuL-breakdown {
    display: none;
    margin-top: 15px;
    border-top: 1px solid rgba(52,179,255,.16);
    padding-top: 10px;
    text-align: left;
}
.MoDuL-break-row {
    display: flex;
    flex-direction: column;
    font-size: 11px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255,255,255,.04);
    color: var(--modul-text);
}
.MoDuL-break-row:last-child {
    border-bottom: none;
}
.MoDuL-break-val {
    color: var(--modul-green);
    font-weight: bold;
}
.MoDuL-caret {
    float: right;
    transition: transform 0.3s;
    font-size: 10px;
    color: var(--modul-text-dim);
}
.MoDuL-expanded .MoDuL-caret {
    transform: rotate(180deg);
}

.MoDuL-header{
    display:flex;
    justify-content:space-between;
    align-items:center;
    width:100%;
    gap:10px;
    margin-bottom:12px;
    padding-bottom:12px;
    border-bottom:none !important;
}

.MoDuL-header-spacer{
    flex:1;
}

.MoDuL-header-actions{
    display:flex;
    align-items:center;
    gap:10px;
    margin-left:auto;
}

.MoDuL-toolbar{
    display:flex;
    justify-content:space-between;
    align-items:center;
    width:100%;
    margin-top:2px !important;
    font-size:11px;
    color:#c9c9c9 !important;
}

.MoDuL-small-label{
    display:flex;
    align-items:center;
    gap:4px;
    cursor:pointer;
    user-select:none;
    color:#cfcfcf !important;
}

.MoDuL-small-label:hover{
    color:#fff !important;
}

.MoDuL-container{
    background:
        linear-gradient(180deg, rgba(39,39,39,.96) 0%, rgba(29,29,29,.96) 100%),
        repeating-linear-gradient(
            90deg,
            rgba(255,255,255,.015) 0 3px,
            rgba(0,0,0,0) 3px 8px
        ) !important;
    border:1px solid #4c4c4c !important;
    border-radius:12px !important;
    box-shadow:
        inset 0 1px 0 rgba(255,255,255,.04),
        0 8px 22px rgba(0,0,0,.28) !important;
    padding:12px;
    margin-bottom:15px;
    color:var(--modul-text);
    font-family:Arial, sans-serif;
    font-size:12px;
}

.MoDuL-row{
    margin-bottom:10px;
    display:flex;
    align-items:center;
    gap:10px;
    flex-wrap:wrap;
}

.MoDuL-target-row{
    display:flex;
    align-items:center;
    gap:16px !important;
    flex-wrap:wrap;
    margin-bottom:14px !important;
}

.MoDuL-action-row{
    display:flex;
    align-items:center !important;
    gap:14px !important;
    flex-wrap:wrap;
    margin-bottom:12px !important;
}

.MoDuL-action-group{
    display:flex;
    align-items:center;
    gap:10px !important;
    flex-wrap:nowrap;
}

.MoDuL-action-group-vault,
.MoDuL-action-group-withdraw{
    flex:0 1 auto;
}

.MoDuL-action-group-all{
    display:flex;
    align-items:center;
    gap:8px;
    margin-left:auto !important;
}

.MoDuL-confirm-row{
    display:none;
    gap:5px;
}

.MoDuL-link{
    cursor:pointer;
    color:var(--modul-accent2);
    text-decoration:underline;
    margin-left:auto;
}

.MoDuL-link:hover{
    color:#fff;
}

.MoDuL-top-btn,
.MoDuL-advisor-btn{
    height:34px !important;
    min-height:34px !important;
    padding:0 14px !important;
    display:inline-flex !important;
    align-items:center !important;
    justify-content:center !important;
    border-radius:8px !important;
    border:1px solid #5f7f9e !important;
    background:linear-gradient(180deg, #40566d 0%, #33475d 100%) !important;
    color:#f2f6fb !important;
    font-size:12px !important;
    font-weight:700 !important;
    line-height:1 !important;
    cursor:pointer !important;
    text-decoration:none;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08) !important;
}

.MoDuL-top-btn:hover,
.MoDuL-advisor-btn:hover{
    background:linear-gradient(180deg, #4b647e 0%, #395067 100%) !important;
    border-color:#86a5c3 !important;
    box-shadow:none !important;
}

.MoDuL-trade-btn{
    margin-left:5px;
}

.MoDuL-api-wrap{
    position:relative;
    display:flex;
    align-items:center;
}

.MoDuL-api-btn{
    min-width:76px !important;
    justify-content:center;
    position:relative;
    z-index:2;
}

.MoDuL-api-panel{
    position:absolute;
    top:50%;
    right:calc(100% + 10px);
    transform:translateY(-50%);
    display:none;
    align-items:center;
    gap:8px;
    padding:10px 12px;
    min-width:390px;
    background:linear-gradient(180deg, #2d343b 0%, #333333 100%) !important;
    border:1px solid #596673 !important;
    border-radius:10px !important;
    box-shadow:0 14px 28px rgba(0,0,0,.45) !important;
    z-index:999999;
    flex-wrap:wrap;
}

.MoDuL-api-wrap.is-open .MoDuL-api-panel{
    display:flex;
}

.MoDuL-api-input{
    flex:1 1 180px;
    min-width:180px;
    height:34px;
}

.MoDuL-api-save{
    flex:0 0 auto;
    border-color:var(--modul-green) !important;
    color:var(--modul-green) !important;
}

.MoDuL-api-save:hover{
    background:rgba(87,227,137,.18) !important;
    color:#fff !important;
}

.MoDuL-api-clear{
    flex:0 0 auto;
    border-color:var(--modul-red) !important;
    color:var(--modul-red) !important;
}

.MoDuL-api-clear:hover{
    background:rgba(255,107,107,.18) !important;
    color:#fff !important;
}

.MoDuL-api-note{
    width:100%;
    font-size:11px;
    color:#d6d6d6 !important;
    opacity:.95;
    padding-top:2px;
    text-align:left;
}

.MoDuL-section-bar{
    display:flex;
    align-items:center;
    margin:14px 0 10px;
    border-top:1px solid #505050;
    padding-top:10px;
}

.MoDuL-section-bar span{
    display:inline-block;
    color:#d6d6d6;
    font-size:11px;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:.7px;
    text-shadow:0 1px 0 rgba(0,0,0,.45);
}

.MoDuL-stock-picker{
    position:relative;
    width:200px !important;
    min-width:200px !important;
}

.MoDuL-stock-trigger{
    width:100%;
    height:36px !important;
    padding:0 34px 0 12px;
    text-align:left;
    border-radius:8px !important;
    border:1px solid #4e5c69 !important;
    background:linear-gradient(180deg, #323c46 0%, #272f37 100%) !important;
    color:#f1f3f5 !important;
    font-size:13px !important;
    font-weight:700 !important;
    cursor:pointer;
    position:relative;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.05) !important;
}

.MoDuL-stock-trigger:hover{
    border-color:#6e7f8f !important;
    background:linear-gradient(180deg, #394651 0%, #2d363f 100%) !important;
}

.MoDuL-stock-trigger::after{
    content:"";
    position:absolute;
    right:12px;
    top:50%;
    width:0;
    height:0;
    margin-top:-2px;
    border-left:5px solid transparent;
    border-right:5px solid transparent;
    border-top:6px solid #d8dde2 !important;
    pointer-events:none;
}

.MoDuL-stock-menu{
    position:absolute;
    top:calc(100% + 4px);
    left:0;
    width:100%;
    max-height:280px;
    overflow-y:auto;
    background:linear-gradient(180deg, #2c2c2c 0%, #212121 100%) !important;
    border:1px solid #555 !important;
    border-radius:8px !important;
    box-shadow:0 12px 26px rgba(0,0,0,.45) !important;
    z-index:999999;
    display:none;
    padding:4px 0;
}

.MoDuL-stock-picker.is-open .MoDuL-stock-menu{
    display:block;
}

.MoDuL-stock-option{
    padding:9px 12px;
    font-size:12px;
    font-weight:700;
    color:#ececec !important;
    cursor:pointer;
    transition:background .12s ease, color .12s ease;
}

.MoDuL-stock-option:hover{
    background:rgba(255,255,255,.08) !important;
    color:#fff !important;
}

.MoDuL-stock-option.is-selected{
    background:#626e7a !important;
    color:#fff !important;
}

.MoDuL-stock-menu::-webkit-scrollbar{
    width:8px;
}

.MoDuL-stock-menu::-webkit-scrollbar-track{
    background:#0d151d;
    border-radius:8px;
}

.MoDuL-stock-menu::-webkit-scrollbar-thumb{
    background:#5c6977;
    border-radius:8px;
}

.MoDuL-owned-display{
    display:flex;
    align-items:center;
    gap:10px !important;
    white-space:nowrap;
    min-height:36px;
    padding:0 14px;
    margin-left:0 !important;
    border-radius:8px;
    border:1px solid #4a4a4a;
    background:linear-gradient(180deg, #2e2e2e 0%, #262626 100%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.03);
    color:var(--modul-text-soft);
}

.MoDuL-owned-label{
    color:#bdbdbd !important;
    font-size:11px !important;
    font-weight:700 !important;
    text-transform:uppercase;
    letter-spacing:.7px !important;
}

.MoDuL-owned-value{
    font-size:18px !important;
    font-weight:800 !important;
    line-height:1;
    letter-spacing:0;
}

.MoDuL-input,
.MoDuL-tbl-input,
.MoDuL-trade-amount{
    background:linear-gradient(180deg, #262b30 0%, #1f2428 100%) !important;
    border:1px solid #4c5660 !important;
    color:#f2f2f2 !important;
    border-radius:8px !important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.03) !important;
}

.MoDuL-input{
    width:130px;
    height:36px;
    padding:4px 8px;
    box-sizing:border-box;
}

.MoDuL-input-100{
    width:120px;
}

.MoDuL-input-120{
    width:160px;
}

.MoDuL-input:focus,
.MoDuL-tbl-input:focus,
.MoDuL-trade-amount:focus{
    border-color:#7d8c99 !important;
    outline:none;
    box-shadow:0 0 0 2px rgba(180,180,180,.12) !important;
}

.MoDuL-main-btn{
    flex:0 0 auto !important;
    height:36px !important;
    padding:0 16px !important;
    border-radius:8px !important;
    background:linear-gradient(180deg, #343c45 0%, #333333 100%) !important;
    border:1px solid #55616d !important;
    color:#eef2f5 !important;
    font-size:12px !important;
    font-weight:700 !important;
    text-align:center;
    cursor:pointer;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.04) !important;
}

.MoDuL-main-btn:hover{
    background:linear-gradient(180deg, #3b4650 0%, #303841 100%) !important;
    border-color:#7a8996 !important;
    box-shadow:none !important;
}

#vaultall{
    border-color:#5c8f5e !important;
    color:#8bdb8e !important;
    background:linear-gradient(180deg, #2e3b31 0%, #273129 100%) !important;
}

#vaultall:hover{
    background:linear-gradient(180deg, #36463a 0%, #2c382f 100%) !important;
    color:#fff !important;
}

#vaultexcept{
    border-color:#70808f !important;
    color:#d7e1ea !important;
    background:linear-gradient(180deg, #39424a 0%, #30373e 100%) !important;
}

#sellamt,
#sellall-init{
    border-color:#9a5656 !important;
    color:#ff8e8e !important;
    background:linear-gradient(180deg, #3f2a2a 0%, #342222 100%) !important;
}

#sellamt:hover,
#sellall-init:hover{
    background:linear-gradient(180deg, #4b3030 0%, #3d2828 100%) !important;
    color:#fff !important;
}

.MoDuL-btn-muted{
    color:#aaa !important;
    border-color:#444 !important;
}

.MoDuL-preset-section{
    display:flex;
    flex-direction:column;
    gap:6px;
    margin-top:0 !important;
}

.MoDuL-preset-row{
    display:flex;
    flex-wrap:wrap;
    gap:8px !important;
    width:100%;
    margin-top:5px;
}

.MoDuL-preset-btn{
    min-width:56px !important;
    height:34px !important;
    padding:3px 10px !important;
    border-radius:8px !important;
    background:linear-gradient(180deg, #343c45 0%, #2b3239 100%) !important;
    border:1px solid #55616d !important;
    color:#eef2f5 !important;
    font-size:12px !important;
    font-weight:700 !important;
    line-height:18px !important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.04) !important;
}

.MoDuL-preset-btn:hover{
    background:linear-gradient(180deg, #404a54 0%, #333b43 100%) !important;
    border-color:#7b8997 !important;
    color:#fff !important;
}

.MoDuL-pl-container{
    padding:8px 12px;
    margin-bottom:12px;
}

#MoDuL-pl-container{
    padding:10px 14px;
    background:
        linear-gradient(180deg, #2c2c2c 0%, #333333 100%),
        repeating-linear-gradient(
            90deg,
            rgba(255,255,255,.015) 0 3px,
            rgba(0,0,0,0) 3px 8px
        ) !important;
    border:1px solid #4d4d4d !important;
    border-radius:8px !important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.02);
}

.MoDuL-pl-display{
    font-size:11px;
    text-align:center;
    color:var(--modul-text-dim);
}

#MoDuL-pl-display{
    color:#efefef !important;
}

.MoDuL-pl-grid{
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:18px;
}

.MoDuL-pl-block{
    display:flex;
    flex-direction:column;
}

.MoDuL-pl-block-left{
    text-align:left;
}

.MoDuL-pl-block-right{
    text-align:right;
}

.MoDuL-pl-label{
    font-size:11px;
    color:#c8c8c8 !important;
    line-height:1.15;
    margin-bottom:2px;
    text-transform:none;
    letter-spacing:0;
}

.MoDuL-pl-value{
    font-size:18px;
    font-weight:700;
    line-height:1.1;
    color:#fff;
    letter-spacing:0;
    text-shadow:none !important;
}

.MoDuL-pl-profit{
    font-size:20px;
    font-weight:800;
    line-height:1.05;
    letter-spacing:0;
    text-shadow:none !important;
}

.MoDuL-pl-percent{
    font-size:12px;
    font-weight:700;
}

.MoDuL-link-btn{
    background:none;
    border:none;
    color:var(--modul-accent2);
    cursor:pointer;
    text-decoration:underline;
    font:inherit;
    padding:0;
}

.MoDuL-link-btn:hover{
    color:#fff;
}

#responseStock{
    font-weight:700;
    text-shadow:none !important;
}

@media screen and (max-width: 700px){
    .MoDuL-pl-value{
        font-size:22px;
    }

    .MoDuL-pl-profit{
        font-size:26px;
    }

    .MoDuL-pl-percent{
        font-size:15px;
    }

    .MoDuL-owned-display{
        font-size:13px;
    }

    .MoDuL-owned-value{
        font-size:22px;
    }
}

@media screen and (max-width: 900px){
    .MoDuL-action-group-all{
        margin-left:0 !important;
    }

    .MoDuL-header-actions{
        flex-wrap:wrap;
        justify-content:flex-end;
    }

    .MoDuL-api-panel{
        right:0 !important;
        top:calc(100% + 8px) !important;
        transform:none !important;
        min-width:320px !important;
    }
}
`;
const styleSheet = document.createElement("style");
styleSheet.textContent = style;
(document.head || document.documentElement).appendChild(styleSheet);

const modalFixStyle = document.createElement("style");
modalFixStyle.textContent = `
/* ===== CLEAN MODAL FIX ===== */

.MoDuL-modal-overlay{
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 20px !important;
    margin: 0 !important;
    background: rgba(3,6,12,.84) !important;
    backdrop-filter: blur(6px) !important;
    z-index: 999999 !important;
    box-sizing: border-box !important;
}

.MoDuL-modal{
    position: relative !important;
    display: flex !important;
    flex-direction: column !important;
    width: 860px !important;
    max-width: min(96vw, 860px) !important;
    max-height: 88vh !important;
    margin: 0 !important;
    overflow: hidden !important;
    border-radius: 14px !important;
    border: 1px solid #1f3a5c !important;
    background:
        radial-gradient(circle at top right, rgba(52,179,255,.08), transparent 35%),
        linear-gradient(180deg, #111a2b 0%, #0c1320 100%) !important;
    box-shadow:
        0 0 0 1px rgba(52,179,255,.08),
        0 24px 60px rgba(0,0,0,.75),
        0 0 24px rgba(31,124,255,.12) !important;
}

.MoDuL-modal,
.MoDuL-modal *{
    box-sizing: border-box !important;
}

.MoDuL-modal-header{
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    padding: 15px 20px !important;
    border-bottom: 1px solid rgba(52,179,255,.14) !important;
    background: linear-gradient(180deg, rgba(19,31,51,.98) 0%, rgba(14,24,40,.98) 100%) !important;
    flex: 0 0 auto !important;
}

.MoDuL-modal-header h3{
    margin: 0 !important;
    font-size: 16px !important;
    font-weight: 700 !important;
    color: #fff !important;
    letter-spacing: .5px !important;
}

.MoDuL-modal-close{
    cursor: pointer !important;
    font-size: 24px !important;
    line-height: 1 !important;
    color: #6f90b0 !important;
}

.MoDuL-modal-close:hover{
    color: #fff !important;
}

.MoDuL-modal-body{
    padding: 20px !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    max-height: calc(88vh - 62px) !important;
    color: #d7ecff !important;
    background: transparent !important;
}

/* advisor layout */
.MoDuL-modal .MoDuL-dashboard{
    display: flex !important;
    flex-direction: column !important;
    gap: 20px !important;
}

.MoDuL-modal .MoDuL-grid-section{
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 18px !important;
}

/* hero */
.MoDuL-modal .MoDuL-hero{
    cursor: pointer !important;
    padding: 20px !important;
    border-radius: 10px !important;
    border: 1px solid #1f3a5c !important;
    background:
        radial-gradient(circle at top right, rgba(52,179,255,.12), transparent 35%),
        linear-gradient(135deg, #111b2c 0%, #0b1220 60%, #09101b 100%) !important;
    box-shadow: 0 0 0 1px rgba(52,179,255,.10), 0 10px 30px rgba(0,0,0,.45), 0 0 24px rgba(31,124,255,.08) !important;
    text-align: center !important;
}

.MoDuL-modal .MoDuL-hero-val{
    font-size: 28px !important;
    font-weight: 700 !important;
    color: #62d4ff !important;
    text-shadow: 0 0 14px rgba(52,179,255,.12) !important;
}

.MoDuL-modal .MoDuL-hero-sub{
    font-size: 12px !important;
    color: #6f90b0 !important;
}

/* cards */
.MoDuL-modal .MoDuL-card{
    display: flex !important;
    flex-direction: column !important;
    padding: 15px !important;
    border-radius: 10px !important;
    border: 1px solid #17304d !important;
    background: linear-gradient(180deg, rgba(18,28,44,.96) 0%, rgba(11,18,31,.96) 100%) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.02) !important;
    min-width: 0 !important;
    overflow: hidden !important;
}

.MoDuL-modal .MoDuL-card-head{
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    margin-bottom: 10px !important;
    padding-bottom: 8px !important;
    border-bottom: 1px solid rgba(52,179,255,.10) !important;
}

.MoDuL-modal .MoDuL-card-title{
    font-size: 11px !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    color: #8fb4d8 !important;
}

.MoDuL-modal .MoDuL-card-roi{
    font-size: 18px !important;
    font-weight: 700 !important;
    color: #62d4ff !important;
}

.MoDuL-modal .MoDuL-card-body{
    display: flex !important;
    flex-direction: column !important;
    gap: 4px !important;
    flex-grow: 1 !important;
    min-width: 0 !important;
}

.MoDuL-modal .MoDuL-stock-name{
    font-size: 14px !important;
    font-weight: 700 !important;
    color: #fff !important;
}

.MoDuL-modal .MoDuL-stock-cost{
    font-size: 12px !important;
    color: #8fb4d8 !important;
}

.MoDuL-modal .MoDuL-stock-gain{
    font-size: 12px !important;
    color: #57e389 !important;
    margin-top: auto !important;
    padding-top: 10px !important;
}

/* bottom actions in advisor */
.MoDuL-modal .MoDuL-actions{
    display: flex !important;
    gap: 10px !important;
    border-top: 1px solid rgba(52,179,255,.10) !important;
    padding-top: 20px !important;
    margin-top: 10px !important;
    flex-wrap: nowrap !important;
}

.MoDuL-modal .MoDuL-actions-stack{
    display: block !important;
    border-top: none !important;
    padding-top: 10px !important;
    margin-top: 0 !important;
}

.MoDuL-modal .MoDuL-flex{
    display: flex !important;
}

.MoDuL-modal .MoDuL-flex-1{
    flex: 1 1 0 !important;
}

/* large modal buttons */
.MoDuL-modal .MoDuL-btn-main{
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-height: 40px !important;
    height: 40px !important;
    padding: 0 16px !important;
    border-radius: 8px !important;
    border: 1px solid #17304d !important;
    background: linear-gradient(180deg, #15233a 0%, #10192b 100%) !important;
    color: #fff !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    text-align: center !important;
    width: auto !important;
}

.MoDuL-modal .MoDuL-btn-main:hover{
    border-color: #34b3ff !important;
    background: linear-gradient(180deg, #1b2d48 0%, #132033 100%) !important;
    box-shadow: 0 0 12px rgba(52,179,255,.22) !important;
}

/* tables and settings */
.MoDuL-modal .MoDuL-table{
    width: 100% !important;
    border-collapse: separate !important;
    border-spacing: 0 !important;
    table-layout: auto !important;
}

.MoDuL-modal .MoDuL-table th{
    text-align: left !important;
    padding: 8px !important;
    color: #8fb4d8 !important;
    border-bottom: 1px solid rgba(52,179,255,.12) !important;
}
/* ===== Advisor bottom button rows fix ===== */
.MoDuL-modal .MoDuL-actions-stack .MoDuL-flex{
    display: flex !important;
    gap: 10px !important;
    width: 100% !important;
    flex-wrap: nowrap !important;
}

.MoDuL-modal .MoDuL-actions-stack .MoDuL-main-btn{
    flex: 1 1 0 !important;
    width: 0 !important;
    min-width: 0 !important;
    max-width: none !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    height: 40px !important;
    min-height: 40px !important;
    padding: 0 14px !important;
    text-align: center !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
}

/* cash display sits nicely under the rows */
.MoDuL-modal .MoDuL-actions-stack #adv-cash-display{
    margin-top: 14px !important;
    text-align: center !important;
}

/* mobile stack */
@media screen and (max-width: 700px){
    .MoDuL-modal .MoDuL-actions-stack .MoDuL-flex{
        flex-wrap: wrap !important;
    }

    .MoDuL-modal .MoDuL-actions-stack .MoDuL-main-btn{
        width: 100% !important;
        flex: 1 1 100% !important;
    }
}
.MoDuL-modal .MoDuL-table td{
    padding: 8px !important;
    border-bottom: 1px solid rgba(255,255,255,.04) !important;
    vertical-align: middle !important;
    color: #d7ecff !important;
}

/* inputs inside modals */
.MoDuL-modal .MoDuL-input,
.MoDuL-modal .MoDuL-tbl-input,
.MoDuL-modal .MoDuL-trade-amount,
.MoDuL-modal .MoDuL-select{
    width: 100% !important;
    min-width: 0 !important;
    height: 34px !important;
    padding: 4px 10px !important;
    border-radius: 8px !important;
    background: linear-gradient(180deg, #10182a 0%, #0c1421 100%) !important;
    border: 1px solid #17304d !important;
    color: #fff !important;
    font-size: 12px !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.03) !important;
}

.MoDuL-modal .MoDuL-input:focus,
.MoDuL-modal .MoDuL-tbl-input:focus,
.MoDuL-modal .MoDuL-trade-amount:focus,
.MoDuL-modal .MoDuL-select:focus{
    outline: none !important;
    border-color: #34b3ff !important;
    box-shadow: 0 0 0 2px rgba(52,179,255,.14) !important;
}

.MoDuL-modal .MoDuL-item-settings-scroll{
    height: 400px !important;
    overflow-y: auto !important;
    padding-right: 6px !important;
    border-top: 1px solid #17304d !important;
    border-bottom: 1px solid #17304d !important;
}

.MoDuL-modal .MoDuL-cost-can-wrap{
    max-height: 120px !important;
    overflow-y: auto !important;
}

.MoDuL-modal .MoDuL-check-list{
    max-height: 200px !important;
    overflow-y: auto !important;
}

/* diagnostic */
.MoDuL-modal .MoDuL-diagnostic-head{
    background: #222 !important;
    padding: 10px !important;
    border-bottom: 1px solid #444 !important;
    position: sticky !important;
    top: 0 !important;
    z-index: 2 !important;
}

.MoDuL-modal .MoDuL-diagnostic-table-wrap{
    height: 55vh !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
}

.MoDuL-modal .MoDuL-bank-extra-row{
    display: flex !important;
    align-items: center !important;
    gap: 5px !important;
    flex-wrap: wrap !important;
}

.MoDuL-modal .MoDuL-bank-amt-input{
    width: 110px !important;
}

/* back buttons full width in settings windows */
.MoDuL-modal #MoDuL-back-costs,
.MoDuL-modal #MoDuL-close-costs,
.MoDuL-modal #adv-back-items,
.MoDuL-modal #adv-back-nw{
    width: 100% !important;
}

/* mobile */
@media screen and (max-width: 800px){
    .MoDuL-modal{
        width: 95vw !important;
        max-width: 95vw !important;
    }

    .MoDuL-modal .MoDuL-grid-section{
        grid-template-columns: 1fr !important;
    }

    .MoDuL-modal .MoDuL-actions{
        flex-wrap: wrap !important;
    }

    .MoDuL-modal .MoDuL-diagnostic-table-wrap{
        height: 46vh !important;
    }
}
.MoDuL-action-sell{
    border-color: rgba(255,90,90,.35);
    color: #ff9a9a;
    background: linear-gradient(180deg, #2a1414 0%, #1a0c0c 100%);
}

.MoDuL-action-sell:hover{
    border-color: #ff5a5a;
    color: #fff;
    box-shadow: 0 0 10px rgba(255,90,90,.35);
}
`;
(document.head || document.documentElement).appendChild(modalFixStyle);
