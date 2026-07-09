// ==UserScript==
// @name         MoDuL's Landlord Tenant Ledger
// @namespace    https://github.com/local/torn-landlord-tenant-ledger
// @version      0.5.2
// @description  Easy lease ledger for Torn landlords and tenants.
// @author       MoDuL
// @copyright    2026 MoDuL. All rights reserved.
// @license      All Rights Reserved
// @match        https://www.torn.com/*
// @match        https://torn.com/*
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
  const HOSTED_API_BASE = "https://pp-api.sokin.xyz/pit-guru";
  const HOSTED_SESSION_KEY = "RT_TORN_LTL_HOSTED_SESSION";
  const LEGACY_HOSTED_SESSION_KEY = "RT_TORN_MPG_HOSTED_SESSION";
  const COMMENT = "Torn Landlord Tenant Ledger";
  const API_REQUEST_DELAY_MS = 700;
  const ENDPOINTS = [
    { id: "torn-properties", path: "/torn/properties", label: "Home catalogue", detail: "Shows Torn's property types and upgrades.", action: "fetch-torn-properties", actionLabel: "Fetch catalogue" },
    { id: "user-properties", path: "/user/properties", label: "Homes I own", detail: "Find homes owned by your saved Torn key user.", action: "import-owned", actionLabel: "Fetch my owned homes" },
    { id: "spouse-properties", path: "/user/{spouse.id}/properties", label: "Spouse homes", detail: "Find homes owned by your spouse.", action: "fetch-spouse-properties", actionLabel: "Fetch spouse homes", spouseOnly: true },
    { id: "user-id-properties", path: "/user/{id}/properties", label: "Someone's owned homes", detail: "Find homes owned by the user ID or name you enter.", action: "fetch-user-properties", actionLabel: "Fetch that user" },
    { id: "user-property", path: "/user/property", label: "Home I live in", detail: "Find your current property.", action: "import-current", actionLabel: "Fetch my current home" },
    { id: "user-id-property", path: "/user/{id}/property", label: "Someone's current home", detail: "Find the current property for the user ID or name you enter.", action: "fetch-user-property", actionLabel: "Fetch that user" },
  ];
  const SIMPLE_TABS = [
    { id: "ledger", label: "Leases" },
    { id: "settings", label: "Setup" },
    { id: "user-panel", label: "Fetch" },
    { id: "insights", label: "Suggestions" },
    { id: "advanced", label: "Advanced" },
  ];
  const SIMPLE_TAB_IDS = SIMPLE_TABS.map((tab) => tab.id);
  const ADVANCED_DEFAULT_ENDPOINT = "user-properties";
  const PROPERTY_TYPES = [
    { id: 1, name: "Trailer", cost: 5000, happy: 110, upkeep: 10, modifications: ["Sufficient Interior Modification", "Superior Interior Modification"], staff: [] },
    { id: 2, name: "Apartment", cost: 25000, happy: 125, upkeep: 25, modifications: ["Sufficient Interior Modification", "Superior Interior Modification"], staff: [] },
    { id: 3, name: "Semi-Detached House", cost: 75000, happy: 150, upkeep: 70, modifications: ["Hot Tub", "Sauna", "Sufficient Interior Modification", "Superior Interior Modification"], staff: [] },
    { id: 4, name: "Detached House", cost: 300000, happy: 200, upkeep: 150, modifications: ["Hot Tub", "Sauna", "Small Pool", "Medium Pool", "Large Pool", "Sufficient Interior Modification", "Superior Interior Modification"], staff: [] },
    { id: 5, name: "Beach House", cost: 500000, happy: 300, upkeep: 200, modifications: ["Hot Tub", "Sauna", "Small Pool", "Medium Pool", "Large Pool", "Sufficient Interior Modification", "Superior Interior Modification"], staff: [] },
    { id: 6, name: "Chalet", cost: 750000, happy: 350, upkeep: 300, modifications: ["Hot Tub", "Sauna", "Small Pool", "Medium Pool", "Large Pool", "Sufficient Interior Modification", "Superior Interior Modification"], staff: [] },
    { id: 7, name: "Villa", cost: 1250000, happy: 400, upkeep: 350, modifications: ["Hot Tub", "Sauna", "Small Pool", "Medium Pool", "Large Pool", "Sufficient Interior Modification", "Superior Interior Modification"], staff: [] },
    { id: 8, name: "Penthouse", cost: 2000000, happy: 450, upkeep: 450, modifications: ["Hot Tub", "Sauna", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler"] },
    { id: 9, name: "Mansion", cost: 3000000, happy: 500, upkeep: 500, modifications: ["Hot Tub", "Sauna", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard"] },
    { id: 10, name: "Ranch", cost: 15000000, happy: 600, upkeep: 1000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard"] },
    { id: 11, name: "Palace", cost: 65000000, happy: 1000, upkeep: 3000, modifications: ["Hot Tub", "Sauna", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard"] },
    { id: 12, name: "Castle", cost: 200000000, happy: 1500, upkeep: 10000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Medical Facility", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard", "Doctor"] },
    { id: 13, name: "Private Island", cost: 500000000, happy: 2000, upkeep: 100000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Medical Facility", "Airstrip", "Private Yacht", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard", "Doctor", "Pilot"] },
    { id: 14, name: "Eagle Island", cost: 500000000, happy: 3500, upkeep: 250000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Medical Facility", "Airstrip", "Private Yacht", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard", "Doctor", "Pilot"] },
    { id: 15, name: "Silo X17", cost: 500000000, happy: 3000, upkeep: 250000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Medical Facility", "Airstrip", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard", "Doctor", "Pilot"] },
    { id: 16, name: "Drakkar Sea Fort", cost: 500000000, happy: 4000, upkeep: 250000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Medical Facility", "Private Yacht", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard", "Doctor"] },
    { id: 17, name: "Queen Eleanor", cost: 500000000, happy: 4500, upkeep: 250000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Medical Facility", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard", "Doctor"] },
    { id: 18, name: "Cerium Temple", cost: 500000000, happy: 4000, upkeep: 250000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Medical Facility", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard", "Doctor"] },
    { id: 19, name: "Trekant Tower", cost: 500000000, happy: 4000, upkeep: 250000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Medical Facility", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard", "Doctor"] },
    { id: 20, name: "Iron Fist Hill", cost: 500000000, happy: 3750, upkeep: 250000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Medical Facility", "Airstrip", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard", "Doctor", "Pilot"] },
    { id: 21, name: "USS Bloodbath", cost: 500000000, happy: 3500, upkeep: 250000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Medical Facility", "Open Bar", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard", "Doctor"] },
    { id: 22, name: "Royal Penthouse", cost: 500000000, happy: 4000, upkeep: 250000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Medical Facility", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard", "Doctor"] },
    { id: 23, name: "Presidential Bunker", cost: 500000000, happy: 3500, upkeep: 250000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Medical Facility", "Airstrip", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard", "Doctor", "Pilot"] },
    { id: 24, name: "Maidengrave", cost: 500000000, happy: 3500, upkeep: 250000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Medical Facility", "Airstrip", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard", "Doctor", "Pilot"] },
    { id: 25, name: "St. Pauls Abbey", cost: 500000000, happy: 4000, upkeep: 250000, modifications: ["Hot Tub", "Advanced Shooting Range", "Sauna", "Medical Facility", "Open Bar", "Small Pool", "Medium Pool", "Large Pool", "Small Vault", "Medium Vault", "Large Vault", "Extra Large Vault", "Sufficient Interior Modification", "Superior Interior Modification"], staff: ["Maid", "Butler", "Guard", "Doctor"] },
  ];
  const PROPERTY_IMAGE_BY_ID = {
    1: "https://www.torn.com/images/v2/properties/350x230/350x230_default_trailer.png",
    2: "https://www.torn.com/images/v2/properties/350x230/350x230_default_apartment.png",
    3: "https://www.torn.com/images/v2/properties/350x230/350x230_default_semi_detached.png",
    4: "https://www.torn.com/images/v2/properties/350x230/350x230_default_detached.png",
    5: "https://www.torn.com/images/v2/properties/350x230/350x230_default_beach_house.png",
    6: "https://www.torn.com/images/v2/properties/350x230/350x230_default_chalet.png",
    7: "https://www.torn.com/images/v2/properties/350x230/350x230_default_villa.png",
    8: "https://www.torn.com/images/v2/properties/350x230/350x230_default_penthouse.png",
    9: "https://www.torn.com/images/v2/properties/350x230/350x230_default_mansion.png",
    10: "https://www.torn.com/images/v2/properties/350x230/350x230_default_ranch.png",
    11: "https://www.torn.com/images/v2/properties/350x230/350x230_default_palace.png",
    12: "https://www.torn.com/images/v2/properties/estateagent/castle2.png",
    13: "https://www.torn.com/images/v2/properties/estateagent/island.png",
    14: "https://www.torn.com/images/properties/86tseagleisland.png",
    15: "https://www.torn.com/images/properties/75fgsilox17.png",
    16: "https://www.torn.com/images/properties/3gfhdrakkar.png",
    17: "https://www.torn.com/images/properties/11ghqueeneleanor.png",
    18: "https://www.torn.com/images/properties/684scerium.png",
    19: "https://www.torn.com/images/properties/56jhtrekkant.png",
    20: "https://www.torn.com/images/properties/46hjironfisthill.png",
    21: "https://www.torn.com/images/properties/6hj7bloodbath.png",
    22: "https://www.torn.com/images/properties/10nkroyalpenthouse.png",
    23: "https://www.torn.com/images/properties/76ernuclearbunker.png",
    24: "https://www.torn.com/images/properties/68ermaidengrave.png",
    25: "https://www.torn.com/images/properties/76sdstpaulsabbey.png",
  };
  const PROPERTY_IMAGE_BY_NAME = {
    eagleisland: PROPERTY_IMAGE_BY_ID[14],
    silox17: PROPERTY_IMAGE_BY_ID[15],
    drakkarseafort: PROPERTY_IMAGE_BY_ID[16],
    queeneleanor: PROPERTY_IMAGE_BY_ID[17],
    ceriumtemple: PROPERTY_IMAGE_BY_ID[18],
    trekanttower: PROPERTY_IMAGE_BY_ID[19],
    royalpenthouse: PROPERTY_IMAGE_BY_ID[22],
    ironfisthill: PROPERTY_IMAGE_BY_ID[20],
    presidentialbunker: PROPERTY_IMAGE_BY_ID[23],
    nuclearbunker: PROPERTY_IMAGE_BY_ID[23],
    maidengrave: PROPERTY_IMAGE_BY_ID[24],
    ussbloodbath: PROPERTY_IMAGE_BY_ID[21],
    bloodbath: PROPERTY_IMAGE_BY_ID[21],
    stpaulsabbey: PROPERTY_IMAGE_BY_ID[25],
    saintpaulsabbey: PROPERTY_IMAGE_BY_ID[25],
  };
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
    showAdvancedTools: false,
    allowDirectTornFallback: true,
  };

  const emptyState = {
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
    activeTab: "ledger",
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
    propertyTypes: PROPERTY_TYPES,
    tableSort: {},
    propertyCosts: {},
    settings: DEFAULT_SETTINGS,
  };

  let state = loadState();
  let popupWindow = null;

  function loadState() {
    const raw = safeGet(STORE_KEY);
    if (!raw) return { ...emptyState };
    try {
      const parsed = JSON.parse(raw);
      const next = {
        ...emptyState,
        ...parsed,
        endpointInputs: { ...emptyState.endpointInputs, ...(parsed.endpointInputs || {}) },
        propertyTypes: PROPERTY_TYPES,
        tableSort: { ...(parsed.tableSort || {}) },
        propertyCosts: { ...(parsed.propertyCosts || {}) },
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      };
      next.leases = compactLeaseList(next.leases || []);
      normalizeSavedNavigation(next, parsed.activeTab);
      return next;
    } catch (_error) {
      return { ...emptyState };
    }
  }

  function normalizeSavedNavigation(next, savedTab) {
    if (savedTab === "market") {
      next.activeTab = "insights";
      return;
    }
    if (savedTab === "advanced" && !showAdvancedTools(next.settings)) {
      next.activeTab = "ledger";
      return;
    }
    if (savedTab === "settings" || SIMPLE_TAB_IDS.includes(savedTab)) return;
    if (ENDPOINTS.some((endpoint) => endpoint.id === savedTab)) {
      next.activeTab = "advanced";
      next.advancedEndpointId = savedTab;
      return;
    }
    next.activeTab = "ledger";
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

  function money(value) {
    const number = Number(value || 0);
    return number ? `$${number.toLocaleString()}` : "-";
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
    const dailyCost = property.cost_per_day || (totalCost && period ? Math.round(totalCost / period) : "");
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
    return Array.from(byId.values()).sort(compareLeases);
  }

  function leaseMergeKey(lease) {
    const propertyId = clean(lease && lease.propertyId, "") || propertyIdFromLeaseId(lease && lease.id);
    if (propertyId) return `property:${propertyId}`;
    return `id:${clean(lease && lease.id, makeId("lease"))}`;
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
    if (merged.propertyId) merged.id = String(merged.propertyId);
    return merged;
  }

  function canonicalLeaseId(previous = {}, incoming = {}) {
    const propertyId = incoming.propertyId || previous.propertyId || propertyIdFromLeaseId(incoming.id) || propertyIdFromLeaseId(previous.id);
    return propertyId ? String(propertyId) : (incoming.id || previous.id || makeId("lease"));
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

  function apiGet(path, params = {}) {
    const key = apiKeyValue();
    if (!key) {
    return Promise.reject(new Error("Add your Torn public key first."));
    }

    const url = new URL(`${API_BASE}${path}`);
    url.searchParams.set("comment", COMMENT);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    }

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
    return clean(state.serverSession || safeGet(HOSTED_SESSION_KEY) || safeGet(LEGACY_HOSTED_SESSION_KEY), "").trim();
  }

  function setHostedSession(token) {
    const value = clean(token, "").trim();
    state.serverSession = value;
    if (value) safeSet(HOSTED_SESSION_KEY, value);
    else safeDelete(HOSTED_SESSION_KEY);
  }

  function clearHostedSession() {
    state.serverSession = "";
    safeDelete(HOSTED_SESSION_KEY);
  }

  function hostedRequest(path, options = {}) {
    const method = options.method || "GET";
    const session = options.session || "";
    const payload = options.body === undefined ? null : options.body;
    const url = `${HOSTED_API_BASE.replace(/\/+$/, "")}${path}`;
    const headers = { Accept: "application/json" };
    if (payload !== null) headers["Content-Type"] = "application/json";
    if (session) headers["X-Pit-Guru-Session"] = session;

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
        body: { apiKey: key, userId, product: "landlord-ledger" },
        timeout: 15000,
      });
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        applyHostedAccessBody(error.payload || {}, userId);
        if (state.serverEntitlement && !hasEntitlementSignal(state.serverEntitlement)) {
          state.serverEntitlement.status = error.status === 403 ? "denied" : "invalid";
          state.serverEntitlement.product = state.serverEntitlement.product || "landlord-ledger";
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
      state.serverEntitlement.product = state.serverEntitlement.product || "landlord-ledger";
    }
    saveState("Access saved");
    if (!token) {
      const info = subscriptionStatusInfo();
      if (!info.isSubscribed) throw new Error(info.message || "No active Landlord Ledger subscription was found.");
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
    const profile = body.profile || body.userProfile || body.user || null;
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
    if (keyInfo) state.keyInfo = keyInfo;
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
      product: "landlord-ledger",
      scope,
      includePartner: true,
      settings: {
        targetAnnualRoi: targetAnnualRoi(),
        defaultSuggestionLeaseDays: defaultSuggestionLeaseDays(),
      },
    };
    const userId = (state.endpointInputs && state.endpointInputs.userId) || keyInfoUserId(state.keyInfo);
    if (userId) payload.userId = String(userId);

    const submit = (session) => hostedRequest("/api/landlord-ledger/sync", {
      method: "POST",
      session,
      body: payload,
      timeout: 45000,
    });

    let session = hostedSessionValue() || await verifyHostedAccess();
    let body;
    try {
      body = await submit(session);
    } catch (error) {
      const authFailure = error.status === 401 || error.status === 403;
      if (!authFailure) throw error;
      clearHostedSession();
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
      setStatus(`The main fetch is not ready (${error.message || "unknown error"}). Fetching directly from Torn for now...`);
      return fallback ? fallback(error) : null;
    }
  }

  function canUseDirectTornFallback(error) {
    if (!appSettings().allowDirectTornFallback) return false;
    if (!error) return false;
    if (error.status === 404) return true;
    if (error.network) return true;
    return /landlord-ledger|not found|timed out|hosted ledger server/i.test(error.message || "");
  }

  function applyHostedLedgerSync(body, scope = "all") {
    if (!body || typeof body !== "object") throw new Error("The ledger helper returned an empty response.");

    const profile = body.profile || body.userProfile || body.user || null;
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
    const leases = serverLeases.length
      ? serverLeases.map(normalizeHostedLease)
      : uniqueProperties([...allProperties, ...(currentProperty ? [currentProperty] : [])]).map((property) => leaseFromFetchedProperty(property, profile && profile.spouse ? profile.spouse : null));
    const suggestions = firstArray(body, ["suggestions", "rentSuggestions", "rent_suggestions"]);
    const roiSummary = firstArray(body, ["roiSummary", "roi_summary", "marketSummary", "market_summary"]);
    const message = body.message || `Filled ${leases.length.toLocaleString()} ledger rows${suggestions.length ? ` and ${suggestions.length.toLocaleString()} suggestions` : ""}.`;

    if (keyInfo) state.keyInfo = keyInfo;
    if (entitlement) {
      state.serverEntitlement = entitlement;
      state.lastSubscriptionCheckAt = nowIso();
    }
    if (profile) storeEndpointDataWithoutRender("user-profile", { profile }, "Fetched profile.");
    if (ownedProperties.length) storeEndpointDataWithoutRender("user-properties", { properties: ownedProperties }, `Found ${ownedProperties.length.toLocaleString()} owned homes.`);
    if (currentProperty) storeEndpointDataWithoutRender("user-property", { property: currentProperty }, "Found current home.");
    if (partnerProperties.length) storeEndpointDataWithoutRender("spouse-properties", { properties: partnerProperties }, `Found ${partnerProperties.length.toLocaleString()} partner homes/contracts.`);

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
    if (leases.length) state.leases = compactLeaseList([...(state.leases || []), ...leases]);
    state.lastSyncAt = nowIso();
    saveState("Ledger saved");
    render();
    setStatus(message);
  }

  async function scanOwnedPropertyMarket() {
    setStatus("Checking rent and sale suggestions...");
    try {
      const body = await syncHostedLedger("scan-owned-market");
      const suggestions = firstArray(body, ["suggestions", "rentSuggestions", "rent_suggestions"]);
      const roiSummary = firstArray(body, ["roiSummary", "roi_summary", "marketSummary", "market_summary"]);
      const message = body.message || `Suggestion check finished: ${suggestions.length.toLocaleString()} suggestions and ${roiSummary.length.toLocaleString()} market summaries.`;
      setStatus(message);
      return body;
    } catch (error) {
      if (!canUseDirectTornFallback(error)) throw error;
      await importOwnedPropertiesDirect();
      setStatus("Rent and sale suggestions are not live yet. Torn contract details were refreshed.", true);
      return null;
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
    setStatus("Fetching Torn property details...");
    const body = await apiGet("/torn/properties");
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

    const body = { properties: all };
    const leases = all.map((property) => leaseFromFetchedProperty(property, spouse));
    mergeLeases(leases);
    const owned = all.filter((property) => ownerMatchesLookup(property, spouse.id)).length;
    const used = all.filter((property) => propertyUsedByLookup(property, spouse.id) || renterMatchesLookup(property, spouse.id)).length;
    const withContracts = all.filter(propertyHasContractDetails).length;
    const label = spouse.name ? `${spouse.name} [${spouse.id}]` : spouse.id;
    const message = `Fetched ${all.length.toLocaleString()} partner properties/contracts for ${label}: ${owned.toLocaleString()} owned, ${used.toLocaleString()} used or rented, ${withContracts.toLocaleString()} with contract details.`;
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
    const role = fetchedPropertyRole(property, spouse);
    const lease = normalizeLease(property, role);
    if (role === "tenant" && lease.status === "rented") lease.status = "leased";
    return lease;
  }

  function fetchedPropertyRole(property, spouse = null) {
    const myId = keyInfoUserId(state.keyInfo) || ((state.endpointInputs || {}).userId);
    const spouseId = spouse && spouse.id;
    if (ownerMatchesLookup(property, myId) || ownerMatchesLookup(property, spouseId)) return "landlord";
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
      const lease = normalizeLease(body.property || body, "tenant");
      mergeLeases([lease]);
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
    return runHostedFirst("all", refreshUserDetailsDirect);
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
    render();
    setStatus(errors.length ? `User details partially refreshed: ${errors.join(" | ")}` : "User details refreshed.");
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
    const leases = owned.map((property) => normalizeLease(property, "landlord"));

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
    const lease = normalizeLease(body.property || body, "tenant");
    const leaseStatus = currentPropertyLeaseStatus(body.property || body);
    lease.status = leaseStatus.value || lease.status;
    mergeLeases([lease]);
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
      next.amount = Math.round(next.dailyAmount * next.durationDays);
    } else if (changedProp === "amount" && next.amount && next.durationDays) {
      next.dailyAmount = Math.round(next.amount / next.durationDays);
    } else if (changedProp === "durationDays") {
      if (next.amount && next.durationDays) next.dailyAmount = Math.round(next.amount / next.durationDays);
      else if (next.dailyAmount && next.durationDays) next.amount = Math.round(next.dailyAmount * next.durationDays);
    } else if (!next.dailyAmount && next.amount && next.durationDays) {
      next.dailyAmount = Math.round(next.amount / next.durationDays);
    } else if (!next.amount && next.dailyAmount && next.durationDays) {
      next.amount = Math.round(next.dailyAmount * next.durationDays);
    }

    if ((changedProp === "amount" || changedProp === "dailyAmount") && next.amount && next.dailyAmount && !next.durationDays) {
      next.durationDays = Math.round(next.amount / next.dailyAmount);
    }

    if ((changedProp === "startDate" || changedProp === "durationDays" || changedProp === "manual") && next.startDate && next.durationDays) {
      next.endDate = addDays(next.startDate, next.durationDays);
    } else if (changedProp === "endDate" && next.startDate && next.endDate) {
      next.durationDays = daysBetween(next.startDate, next.endDate);
      if (next.amount && next.durationDays) next.dailyAmount = Math.round(next.amount / next.durationDays);
      if (!next.amount && next.dailyAmount && next.durationDays) next.amount = Math.round(next.dailyAmount * next.durationDays);
    } else if (changedProp === "manual" && next.startDate && next.endDate && !next.durationDays) {
      next.durationDays = daysBetween(next.startDate, next.endDate);
      if (next.amount && next.durationDays) next.dailyAmount = Math.round(next.amount / next.durationDays);
      if (!next.amount && next.dailyAmount && next.durationDays) next.amount = Math.round(next.dailyAmount * next.durationDays);
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
          node.textContent = readonlyValue(lease[prop], prop === "remainingDays" ? "Auto" : "N/A");
          node.title = clean(lease[prop], "");
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
      const roleMatch = state.role === "all" || leaseRoleGroup(lease) === state.role || lease.source === "manual";
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
    if (["tenant", "on-lease", "rented-from-others", "rent-from"].includes(role)) return "tenant";
    return "landlord";
  }

  function stats(leases) {
    const leased = leases.filter((lease) => lease.status === "rented" || lease.tenant).length;
    const income = leases.reduce((sum, lease) => sum + (Number(lease.amount) || 0), 0);
    const soon = leases.filter((lease) => Number(lease.remainingDays) >= 0 && Number(lease.remainingDays) <= 7).length;
    return { total: leases.length, leased, income, soon };
  }

  function exportJson() {
    download("torn-lease-ledger.json", JSON.stringify({
      exportedAt: nowIso(),
      leases: state.leases,
      propertyCosts: state.propertyCosts || {},
      settings: appSettings(),
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

  function injectStyles(targetDocument = document) {
    if (targetDocument.getElementById(`${APP_ID}-styles`)) return;
    const style = targetDocument.createElement("style");
    style.id = `${APP_ID}-styles`;
    style.textContent = `
      #${APP_ID} {
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
        color: #e9edf1;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
      }
      html.tlt-popup-document,
      html.tlt-popup-document body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #101820;
      }
      #${APP_ID} * {
        box-sizing: border-box;
        color: inherit;
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
        border: 1px solid #45515e;
        background: #18212b;
        color: #f3f6f9;
        border-radius: 6px;
        padding: 9px 12px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
      }
      #${APP_ID} .tlt-panel {
        clear: both;
        display: flex;
        flex-direction: column;
        height: calc(100% - 38px);
        min-height: 290px;
        overflow: hidden;
        border: 1px solid #44515d;
        border-radius: 8px;
        background: #101820;
        box-shadow: 0 18px 56px rgba(0, 0, 0, 0.45);
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
        border-bottom: 1px solid #2c3945;
      }
      #${APP_ID} .tlt-header {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #16222d;
        cursor: move;
        user-select: none;
      }
      #${APP_ID} h2 {
        margin: 0;
        font-size: 16px;
        line-height: 1.2;
      }
      #${APP_ID} .tlt-muted { color: #a9b5c0; }
      #${APP_ID} .tlt-header .tlt-muted { margin-top: 3px; }
      #${APP_ID} .tlt-grow { flex: 1; }
      #${APP_ID} button,
      #${APP_ID} input,
      #${APP_ID} select,
      #${APP_ID} textarea {
        border: 1px solid #40505f;
        border-radius: 6px;
        background: #0d141b;
        color: #f3f6f9;
        min-height: 34px;
        padding: 7px 9px;
        font: inherit;
      }
      #${APP_ID} button {
        background: #263545;
        cursor: pointer;
        font-weight: 700;
      }
      #${APP_ID} button:hover { background: #314456; }
      #${APP_ID} button.tlt-primary { background: #2f6f77; }
      #${APP_ID} button.tlt-danger { background: #70313a; }
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
        background: #0e171f;
      }
      #${APP_ID} .tlt-tabs button {
        min-height: 30px;
        padding: 6px 9px;
        background: #17222d;
        color: #c9d4de;
      }
      #${APP_ID} .tlt-tabs button.is-active {
        border-color: #72aeb8;
        background: #2f6f77;
        color: #ffffff;
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
        border: 1px solid #2c3945;
        border-radius: 7px;
        padding: 9px;
        background: #131d27;
        min-width: 0;
      }
      #${APP_ID} .tlt-endpoint strong,
      #${APP_ID} .tlt-endpoint code,
      #${APP_ID} .tlt-endpoint span {
        display: block;
      }
      #${APP_ID} .tlt-endpoint strong {
        margin-bottom: 5px;
        color: #f3f6f9;
      }
      #${APP_ID} .tlt-endpoint code {
        margin-bottom: 7px;
        color: #9fd3dc;
        font-size: 11px;
        overflow-wrap: anywhere;
      }
      #${APP_ID} .tlt-endpoint .tlt-muted {
        min-height: 32px;
      }
      #${APP_ID} .tlt-badge {
        width: max-content;
        margin-top: 8px;
        border: 1px solid #40505f;
        border-radius: 999px;
        padding: 4px 8px;
        color: #c9d4de;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      #${APP_ID} .tlt-guide {
        border: 1px solid #375464;
        border-radius: 7px;
        padding: 12px;
        margin-bottom: 12px;
        background: #12202a;
      }
      #${APP_ID} .tlt-guide strong,
      #${APP_ID} .tlt-guide span {
        display: block;
      }
      #${APP_ID} .tlt-guide strong {
        color: #f3f6f9;
        margin-bottom: 8px;
      }
      #${APP_ID} .tlt-steps {
        display: grid;
        grid-template-columns: repeat(3, minmax(150px, 1fr));
        gap: 8px;
      }
      #${APP_ID} .tlt-step {
        border: 1px solid #2c3945;
        border-radius: 7px;
        padding: 9px;
        background: #0f1820;
      }
      #${APP_ID} .tlt-step b {
        display: block;
        margin-bottom: 4px;
      }
      #${APP_ID} .tlt-step span {
        color: #a9b5c0;
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
        color: #c9d4de;
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
        border: 1px solid #40505f;
        border-radius: 6px;
        object-fit: cover;
        background: #0d141b;
      }
      #${APP_ID} .tlt-user-summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(130px, 1fr));
        gap: 8px;
      }
      #${APP_ID} .tlt-profile-card {
        border: 1px solid #2c3945;
        border-radius: 7px;
        padding: 12px;
        background: #131d27;
        color: #e9edf1;
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
        border: 1px solid #40505f;
        border-radius: 7px;
        object-fit: cover;
        background: #0d141b;
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
        border: 1px solid #40505f;
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
        border: 1px solid #2c3945;
        border-radius: 7px;
        padding: 9px;
        background: #131d27;
        color: #e9edf1;
      }
      #${APP_ID} .tlt-info-card span,
      #${APP_ID} .tlt-info-card b {
        display: block;
      }
      #${APP_ID} .tlt-info-card span {
        color: #a9b5c0;
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
        border: 1px solid #2c3945;
        border-radius: 7px;
        padding: 12px;
        background: #131d27;
      }
      #${APP_ID} .tlt-settings-card label,
      #${APP_ID} .tlt-settings-card span,
      #${APP_ID} .tlt-settings-card strong {
        display: block;
      }
      #${APP_ID} .tlt-settings-card label {
        margin-top: 10px;
        color: #c9d4de;
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
        color: #c9d4de;
      }
      #${APP_ID} .tlt-setting-row input {
        width: auto;
        min-height: 0;
        margin: 0;
      }
      #${APP_ID} .tlt-result {
        margin-top: 8px;
        color: #c9d4de;
        font-size: 11px;
      }
      #${APP_ID} .tlt-subscription {
        margin-top: 10px;
        border: 1px solid #40505f;
        border-left: 4px solid #8a99a6;
        border-radius: 7px;
        padding: 10px;
        background: #0f1820;
      }
      #${APP_ID} .tlt-subscription.is-active { border-left-color: #69c58b; }
      #${APP_ID} .tlt-subscription.is-blocked { border-left-color: #d17878; }
      #${APP_ID} .tlt-subscription.is-warning { border-left-color: #d8b25d; }
      #${APP_ID} .tlt-subscription span,
      #${APP_ID} .tlt-subscription strong,
      #${APP_ID} .tlt-subscription small {
        display: block;
      }
      #${APP_ID} .tlt-subscription span,
      #${APP_ID} .tlt-subscription small {
        color: #a9b5c0;
        font-size: 11px;
      }
      #${APP_ID} .tlt-subscription strong {
        margin-top: 3px;
        color: #f3f6f9;
        font-size: 15px;
      }
      #${APP_ID} .tlt-subscription p {
        margin: 8px 0 0;
        color: #c9d4de;
        line-height: 1.35;
      }
      #${APP_ID} .tlt-data-table {
        width: 100%;
        min-width: 520px;
        margin-top: 10px;
        color: #e9edf1;
        background: #0d141b;
      }
      #${APP_ID} .tlt-data-table th,
      #${APP_ID} .tlt-data-table td {
        color: #e9edf1;
        background: #0d141b;
        line-height: 1.35;
      }
      #${APP_ID} .tlt-data-table th {
        background: #17222d;
        white-space: nowrap;
        text-transform: capitalize;
      }
      #${APP_ID} .tlt-data-table tbody tr:nth-child(even) td {
        background: #101820;
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
        border: 1px solid #40505f;
        border-radius: 5px;
        object-fit: cover;
        background: #0a1016;
      }
      #${APP_ID} .tlt-choice-list {
        display: grid;
        gap: 4px;
        min-width: 180px;
        max-width: 340px;
        max-height: 150px;
        overflow: auto;
        border: 1px solid #40505f;
        border-radius: 6px;
        background: #111c25;
        color: #e9edf1;
        padding: 6px;
      }
      #${APP_ID} .tlt-choice-option {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        color: #e9edf1;
        font-size: 12px;
        line-height: 1.25;
      }
      #${APP_ID} .tlt-choice-option input {
        width: auto;
        min-height: 0;
        margin: 1px 0 0;
        accent-color: #72aeb8;
      }
      #${APP_ID} .tlt-empty-value {
        display: inline-block;
        color: #a9b5c0;
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
      #${APP_ID} .tlt-check-cell { color: #85d7a4; }
      #${APP_ID} .tlt-miss-cell { color: #6f7c87; }
      #${APP_ID} .tlt-volume-cell { color: #dbe4ec; }
      #${APP_ID} .tlt-data-json {
        margin-top: 10px;
        color: #e9edf1;
      }
      #${APP_ID} .tlt-data-json summary {
        color: #dbe4ec;
        cursor: pointer;
      }
      #${APP_ID} .tlt-data-json pre {
        overflow: auto;
        max-height: 280px;
        margin: 8px 0 0;
        border: 1px solid #2c3945;
        border-radius: 7px;
        padding: 10px;
        background: #0a1016;
        color: #dbe4ec;
        font-size: 11px;
        white-space: pre-wrap;
      }
      #${APP_ID} .tlt-section-title {
        padding: 12px 12px 0;
        color: #f3f6f9;
        font-weight: 700;
      }
      #${APP_ID} .tlt-section-note {
        padding: 4px 12px 0;
        color: #a9b5c0;
        font-size: 11px;
      }
      #${APP_ID} .tlt-summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(120px, 1fr));
        gap: 8px;
      }
      #${APP_ID} .tlt-stat {
        border: 1px solid #2c3945;
        border-radius: 7px;
        padding: 9px;
        background: #131d27;
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
      #${APP_ID} table {
        width: 100%;
        border-collapse: collapse;
        min-width: 900px;
      }
      #${APP_ID} th,
      #${APP_ID} td {
        border-bottom: 1px solid #26323d;
        padding: 9px 8px;
        text-align: left;
        vertical-align: top;
      }
      #${APP_ID} th {
        position: sticky;
        top: 0;
        background: #17222d;
        color: #dbe4ec;
        z-index: 1;
      }
      #${APP_ID} th button.tlt-sort {
        width: 100%;
        min-height: 0;
        border: 0;
        border-radius: 0;
        padding: 0;
        background: transparent;
        color: #dbe4ec;
        text-align: left;
        font-weight: 700;
        cursor: pointer;
      }
      #${APP_ID} th button.tlt-sort:hover {
        color: #ffffff;
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
        border: 1px solid #2c3945;
        border-radius: 6px;
        padding: 7px 9px;
        background: #101820;
        color: #dbe4ec;
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
        color: #c9d4de;
        font-size: 11px;
        font-weight: 700;
      }
      #${APP_ID} .tlt-form-field span {
        color: #a9b5c0;
      }
      #${APP_ID} .tlt-form-field input,
      #${APP_ID} .tlt-form-field select,
      #${APP_ID} .tlt-form-field textarea {
        width: 100%;
      }
      #${APP_ID} .tlt-form-field.is-wide { grid-column: span 2; }
      #${APP_ID} .tlt-form textarea { resize: vertical; }
      #${APP_ID} .tlt-form button { grid-column: span 1; }
      #${APP_ID} .tlt-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 0;
      }
      #${APP_ID} .tlt-status.is-error { color: #ffb4bd; }
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
    renderInto(document, false);
    renderPopup();
  }

  function renderPopup() {
    if (!popupWindow || popupWindow.closed) return;
    renderInto(popupWindow.document, true);
  }

  function renderInto(targetDocument, isPopup) {
    injectStyles(targetDocument);
    targetDocument.documentElement.classList.toggle("tlt-popup-document", Boolean(isPopup));
    let root = targetDocument.getElementById(APP_ID);
    if (!root) {
      root = targetDocument.createElement("section");
      root.id = APP_ID;
      targetDocument.body.appendChild(root);
    }

    const leases = visibleLeases();
    const summary = stats(leases);
    root.className = isPopup ? "is-popup" : (state.panelOpen ? "" : "is-collapsed");
    root.innerHTML = `
      <button class="tlt-tab" type="button">${state.panelOpen ? "Hide" : "Leases"}</button>
      <div class="tlt-panel" role="region" aria-label="Torn lease ledger">
        <div class="tlt-header">
          <div class="tlt-grow">
            <h2>Lease Ledger</h2>
            <div class="tlt-muted">${isPopup ? "Popup window" : "Track rent, dates, owners, and renters."}</div>
          </div>
          ${isPopup ? `<button class="tlt-ghost" type="button" data-action="close-popup">Close popup</button>` : `<button class="tlt-ghost" type="button" data-action="open-popup">Pop out</button>`}
        </div>
        <div class="tlt-tabs" role="tablist" aria-label="Ledger sections">
          ${tabsHtml()}
        </div>
        <div class="tlt-tab-content">
          ${activeTabHtml(leases, summary)}
        </div>
        <div class="tlt-foot">
          <div>
            <div class="tlt-status">Ready${state.lastSyncAt ? `, last sync ${new Date(state.lastSyncAt).toLocaleString()}` : ""}.</div>
            <div class="tlt-save-status">${escapeHtml(saveStatusText())}</div>
            <div class="tlt-muted">${keyInfoHtml()}${serverAccessHtml()} Fetch homes first, then check the ledger.</div>
          </div>
          <div class="tlt-actions">
            <button type="button" data-action="export-json">Backup</button>
            <label><input type="file" data-action="import-json" accept="application/json" hidden><button type="button" data-action="pick-json">Restore</button></label>
            <button class="tlt-danger" type="button" data-action="clear-data">Delete data</button>
          </div>
        </div>
      </div>
    `;

    if (!isPopup) applyPanelPosition(root);
    bind(root, isPopup);
  }

  function allTabs() {
    return SIMPLE_TABS.filter((tab) => tab.id !== "advanced" || showAdvancedTools());
  }

  function tabsHtml() {
    return allTabs().map((tab) => `
      <button type="button" role="tab" class="${state.activeTab === tab.id ? "is-active" : ""}" data-tab="${escapeAttr(tab.id)}">${escapeHtml(tab.label)}</button>
    `).join("");
  }

  function activeTabHtml(leases, summary) {
    if (ENDPOINTS.some((endpoint) => endpoint.id === state.activeTab)) {
      state.advancedEndpointId = state.activeTab;
      state.activeTab = "advanced";
      saveState();
    }
    if (!SIMPLE_TAB_IDS.includes(state.activeTab)) {
      state.activeTab = "ledger";
      saveState();
    }
    if (state.activeTab === "advanced" && !showAdvancedTools()) {
      state.activeTab = "ledger";
      saveState();
    }
    if (state.activeTab === "ledger") return ledgerHtml(leases, summary);
    if (state.activeTab === "settings") return settingsHtml();
    if (state.activeTab === "user-panel") return userPanelHtml();
    if (state.activeTab === "insights") return insightsHtml();
    if (state.activeTab === "advanced") return advancedHtml();
    return ledgerHtml(leases, summary);
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
          <button type="button" data-tab="settings">Go to setup</button>
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
      if (rows.length) return rows;
    }
    return [];
  }

  function serverInsightsMetadata() {
    const body = endpointBody("server-insights") || endpointBody("server-sync") || {};
    return body.metadata || body._metadata || {};
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
      ["Spouse properties", endpointBody("spouse-properties")],
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
        <table class="tlt-data-table">
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
    const owned = myOwnedPropertyRows();
    if ((state.role === "landlord" || state.role === "all") && owned.length) {
      return [
        `<option value="">Choose one of my properties</option>`,
        ...owned.map((property) => {
          const lease = normalizeLease(property, "landlord");
          const status = clean(lease.status, "none");
          const tenant = lease.tenant ? ` - ${lease.tenant}` : "";
          const label = `${lease.property}${lease.propertyId ? ` #${lease.propertyId}` : ""} (${status}${tenant})`;
          return `<option value="${escapeAttr(lease.property)}"
            data-owned-property="true"
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
    if (state.role === "landlord" || state.role === "all") {
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
    if (form.elements.roleHint) form.elements.roleHint.value = "landlord";
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
            <button type="button" data-tab="settings">${hasKey ? "Setup" : "Save key"}</button>
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

  function ledgerHtml(leases, summary) {
    const sortedLeases = sortRows(leases, "ledger");
    return `
      ${gettingStartedHtml(summary)}
      <div class="tlt-toolbar">
        <input type="search" data-field="search" placeholder="Find a lease" value="${escapeAttr(state.search)}">
        <select data-field="role">
          <option value="landlord"${state.role === "landlord" ? " selected" : ""}>Homes I rent out</option>
          <option value="tenant"${state.role === "tenant" ? " selected" : ""}>Homes I use</option>
          <option value="all"${state.role === "all" ? " selected" : ""}>Everything</option>
        </select>
        <select data-field="statusFilter">
          ${statusFilterOptionsHtml()}
        </select>
        <button class="tlt-primary" type="button" data-action="scan-owned-property-market">Scan ROI/Listings</button>
        <button type="button" data-action="import-owned-direct">Reload Torn details</button>
        <button type="button" data-action="export-csv">Export CSV</button>
      </div>
      <div class="tlt-summary">
        <div class="tlt-stat"><span class="tlt-muted">Rows shown</span><b>${summary.total}</b></div>
        <div class="tlt-stat"><span class="tlt-muted">Rented now</span><b>${summary.leased}</b></div>
        <div class="tlt-stat"><span class="tlt-muted">Rent total</span><b>${money(summary.income)}</b></div>
        <div class="tlt-stat"><span class="tlt-muted">Ends soon</span><b>${summary.soon}</b></div>
      </div>
      <div class="tlt-table-wrap">
        <table class="tlt-lease-table">
          <thead>
            <tr>
              <th>${sortHeaderHtml("ledger", "property", "Home")}</th>
              <th>${sortHeaderHtml("ledger", "landlord", "Owner")}</th>
              <th>${sortHeaderHtml("ledger", "tenant", "Renter")}</th>
              <th>${sortHeaderHtml("ledger", "durationDays", "Days")}</th>
              <th>${sortHeaderHtml("ledger", "amount", "Total")}</th>
              <th>${sortHeaderHtml("ledger", "dailyAmount", "Per day")}</th>
              <th>${sortHeaderHtml("ledger", "startDate", "Starts")}</th>
              <th>${sortHeaderHtml("ledger", "endDate", "Ends")}</th>
              <th>${sortHeaderHtml("ledger", "remainingDays", "Left")}</th>
              <th>${sortHeaderHtml("ledger", "status", "Status")}</th>
              <th>${sortHeaderHtml("ledger", "notes", "Notes")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${sortedLeases.length ? sortedLeases.map(rowHtml).join("") : emptyRowsHtml()}
          </tbody>
        </table>
      </div>
      <div class="tlt-section-title">Add one by hand</div>
      <div class="tlt-section-note">Fill what you know. Total rent, rent per day, dates, and days left will help each other when possible.</div>
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

    return `
      <div class="tlt-result">${escapeHtml(stored.message || "Fetched response.")}${stored.fetchedAt ? ` Fetched ${escapeHtml(new Date(stored.fetchedAt).toLocaleString())}.` : ""}</div>
      ${dataTableHtml(stored.body, id)}
      ${appSettings().showRawJson ? `<details class="tlt-data-json">
        <summary>Extra details</summary>
        <pre>${escapeHtml(JSON.stringify(stored.body, null, 2))}</pre>
      </details>` : ""}
    `;
  }

  function userDetailsHtml() {
    const keyInfo = state.keyInfo || {};
    const user = keyInfo.user || {};
    const access = keyInfoAccess(keyInfo) || {};
    const profile = profileInfo();
    const propertyStats = userPropertyStats();
    const spouse = profile && profile.spouse;
    return `
      <div class="tlt-profile-card">
        <div class="tlt-profile-head">
          ${profile && profile.image ? `<img class="tlt-profile-image" src="${escapeAttr(profile.image)}" alt="${escapeAttr(profile.name || "User profile")}">` : `<div class="tlt-profile-image"></div>`}
          <div>
            <h3 class="tlt-profile-name">${escapeHtml(profileName(profile, keyInfo))}</h3>
            <div class="tlt-muted">Access: ${escapeHtml(access.type || "N/A")} · Faction ID: ${escapeHtml(user.faction_id || "N/A")} · Company ID: ${escapeHtml(user.company_id || "N/A")}</div>
          </div>
        </div>
        <div class="tlt-profile-grid">
          ${infoCardHtml("Level", profileValue(profile, "level"))}
          ${infoCardHtml("Rank", profileValue(profile, "rank"))}
          ${infoCardHtml("Title", profileValue(profile, "title"))}
          ${infoCardHtml("Age", daysToDuration(profile && profile.age))}
          ${propertyInfoCardHtml(profile && profile.property)}
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
    const value = property ? `${property.name || "Property"} [${property.id || "N/A"}]` : "N/A";
    const image = propertyImageUrl(property && property.id);
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

  function profileSpouse() {
    const profile = profileInfo();
    return profile && profile.spouse && profile.spouse.id ? profile.spouse : null;
  }

  function userPropertyStats() {
    const ownedBody = endpointBody("user-id-properties") || endpointBody("user-properties");
    const ownedProperties = propertiesFromBody(ownedBody);
    const currentProperty = currentPropertyFromBody(endpointBody("user-id-property")) || currentPropertyFromBody(endpointBody("user-property"));
    return {
      owned: ownedBody ? ownedProperties.length : "N/A",
      leasedToOthers: ownedBody ? ownedProperties.filter(isLeasedToOther).length : "N/A",
      forRent: ownedBody ? ownedProperties.filter(isForRent).length : "N/A",
      currentProperty,
    };
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
    };
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
    return body.property || body.current_property || (body.id || body.property_id ? body : null);
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
    return Boolean(
      property.rented_by ||
      property.renter ||
      property.renter_asked ||
      property.cost !== undefined ||
      property.cost_per_day !== undefined ||
      property.rental_period !== undefined ||
      property.rental_period_remaining !== undefined ||
      (Array.isArray(property.used_by) && property.used_by.length)
    );
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
        <table class="tlt-data-table">
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
      "roi-summary": ["property_image", "property_type", "listings", "avg_daily", "median_daily", "min_daily", "max_daily", "avg_market_price", "avg_happy", "avg_landlord_roi_market", "best_landlord_roi_market", "avg_landlord_roi_investment", "avg_rent_per_happy", "avg_tenant_cost_per_happy", "error"],
      "roi-rentals": ["property_image", "property_type", "owner", "happy", "cost", "cost_per_day", "rental_period", "market_price", "base_cost", "estimated_upgrade_cost", "estimated_investment", "tenant_upkeep_total", "annual_rent", "landlord_roi_market", "landlord_roi_base", "landlord_roi_investment", "rent_per_happy", "tenant_daily_cost", "tenant_cost_per_happy", "property", "staff", "modifications"],
      "user-properties": ["property_image", "id", "owner", "property", "happy", "upkeep.property", "upkeep.staff", "market_price", "used_by", "rented_by", "staff", "modifications"],
      "spouse-properties": ["property_image", "id", "owner", "property", "happy", "upkeep.property", "upkeep.staff", "market_price", "used_by", "rented_by", "staff", "modifications"],
      "user-id-properties": ["property_image", "id", "owner", "property", "happy", "upkeep.property", "upkeep.staff", "market_price", "used_by", "rented_by", "staff", "modifications"],
      "user-property": ["property_image", "lease_status", "id", "owner", "property", "happy", "upkeep.property", "upkeep.staff", "market_price", "used_by", "rented_by", "staff", "modifications"],
      "user-id-property": ["property_image", "lease_status", "id", "owner", "property", "happy", "upkeep.property", "upkeep.staff", "market_price", "used_by", "rented_by", "staff", "modifications"],
      "market-properties": ["property_image", "id", "owner", "property", "happy", "market_price", "cost", "upkeep.property", "upkeep.staff", "staff", "modifications"],
      "market-rentals": ["property_image", "owner", "happy", "cost", "cost_per_day", "rental_period", "property", "market_price", "upkeep.property", "upkeep.staff", "staff", "modifications"],
      "rent-suggestions": ["property_image", "id", "property", "status", "happy", "recommended_action", "suggested_action", "sale_price_suggested", "suggested_sale_price", "rent_per_day_suggested", "suggested_rent_per_day", "suggested_duration_days", "suggested_total", "suggested_roi", "market_median_daily", "market_avg_daily", "listing_note", "suggestion_note"],
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
      property_type: "Home type",
      listings: "Listings",
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
    const moneyKeys = ["avg_daily", "median_daily", "min_daily", "max_daily", "avg_market_price", "base_cost", "estimated_upgrade_cost", "estimated_investment", "my_investment", "investment_basis", "tenant_upkeep_total", "annual_rent", "tenant_daily_cost", "rent_per_happy", "avg_rent_per_happy", "tenant_cost_per_happy", "avg_tenant_cost_per_happy", "current_cost_per_day", "market_median_daily", "market_avg_daily", "market_min_daily", "market_max_daily", "target_rent_per_day", "suggested_rent_per_day", "suggested_total"];
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
    if (id && PROPERTY_IMAGE_BY_ID[id]) return PROPERTY_IMAGE_BY_ID[id];
    const byName = PROPERTY_IMAGE_BY_NAME[normalizeModificationName(idOrName)];
    return byName || "";
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
      <div class="tlt-property-meta">
        ${propertyTypes().filter((type) => propertyImageUrl(type.id)).map((type) => `
          <div class="tlt-property-preview">
            <img class="tlt-property-image" src="${escapeAttr(propertyImageUrl(type.id))}" alt="${escapeAttr(type.name)}">
            <div>${escapeHtml(type.name)} [${escapeHtml(type.id)}]</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function currencyInputValue(value) {
    const number = moneyNumber(value);
    return number ? `$${number.toLocaleString()}` : "";
  }

  function inputWidthStyle(value, min = 8, max = 36) {
    const length = String(value || "").length || min;
    return `width:${clamp(length + 2, min, max)}ch`;
  }

  function readonlyValue(value, fallback = "N/A") {
    return clean(value, "") || fallback;
  }

  function rowHtml(lease) {
    return `
      <tr data-id="${escapeAttr(lease.id)}">
        <td>
          <input class="tlt-lease-input tlt-lease-text" data-prop="property" style="${inputWidthStyle(lease.property, 12)}" value="${escapeAttr(lease.property)}">
          <div class="tlt-muted">${escapeHtml(lease.propertyId ? `ID ${lease.propertyId}` : lease.source || "")}</div>
        </td>
        <td><span class="tlt-readonly-value" data-lease-readonly="landlord" title="${escapeAttr(lease.landlord)}">${escapeHtml(readonlyValue(lease.landlord))}</span></td>
        <td><input class="tlt-lease-input tlt-lease-text" data-prop="tenant" style="${inputWidthStyle(lease.tenant, 10)}" value="${escapeAttr(lease.tenant)}"></td>
        <td><input class="tlt-lease-input" data-prop="durationDays" type="number" min="0" step="1" style="${inputWidthStyle(lease.durationDays, 8)}" value="${escapeAttr(lease.durationDays)}"></td>
        <td><input class="tlt-lease-input tlt-money-input" data-prop="amount" type="text" inputmode="numeric" style="${inputWidthStyle(currencyInputValue(lease.amount), 10)}" value="${escapeAttr(currencyInputValue(lease.amount))}"></td>
        <td><input class="tlt-lease-input tlt-money-input" data-prop="dailyAmount" type="text" inputmode="numeric" style="${inputWidthStyle(currencyInputValue(lease.dailyAmount), 9)}" value="${escapeAttr(currencyInputValue(lease.dailyAmount))}"></td>
        <td><input class="tlt-lease-input tlt-date-input" data-prop="startDate" type="date" value="${escapeAttr(lease.startDate || "")}"></td>
        <td><input class="tlt-lease-input tlt-date-input" data-prop="endDate" type="date" value="${escapeAttr(lease.endDate)}"></td>
        <td><span class="tlt-readonly-value is-number" data-lease-readonly="remainingDays">${escapeHtml(readonlyValue(lease.remainingDays, "Auto"))}</span></td>
        <td>
          <select data-prop="status">
            ${statusOptionsHtml(lease.status)}
          </select>
        </td>
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
        message: `Ready to check Landlord Ledger access for Torn user ${userId}.`,
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
        message: "The bot needs to grant Landlord Ledger access for this Torn user before financial suggestions will work.",
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
        saveState();
        render();
      });
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
          if (action === "scan-owned-property-market") await scanOwnedPropertyMarket();
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
          if (action === "open-settings") {
            state.activeTab = "settings";
            saveState();
            render();
          }
          if (action === "save-api-key") saveApiKeyFromInput((root.querySelector("[data-api-key-input]") || {}).value);
          if (action === "verify-hosted-access") {
            await verifyHostedAccess();
            render();
            setStatus("Subscription checked.");
          }
          if (action === "clear-key") clearApiKey();
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
    popupWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Torn Lease Ledger</title></head><body></body></html>`);
    popupWindow.document.close();
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
