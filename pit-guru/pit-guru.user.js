// ==UserScript==
// @name         MoDuL's Pit Guru
// @namespace    modul.torn.racing
// @version      2.1.2
// @description  Live Torn race timing, gaps, sectors, speed and estimated telemetry analysis
// @author       MoDuL
// @copyright    2026 MoDuL. All rights reserved.
// @license      All Rights Reserved
// @updateURL    https://modulah.github.io/pit-guru/pit-guru.user.js
// @downloadURL  https://modulah.github.io/pit-guru/pit-guru.user.js
// @match        https://www.torn.com/page.php?sid=racing*
// @match        https://www.torn.com/loader.php?sid=racing*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      api.torn.com
// @connect      pp-api.sokin.xyz
// @connect      127.0.0.1
// @connect      localhost

// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @run-at       document-start
// ==/UserScript==

/*
Copyright (c) 2026 MoDuL. All rights reserved.
Unauthorized copying, modification, redistribution, or commercial use is prohibited without written permission.
*/

(function () {
    "use strict";

    const PG_PUBLIC_BASE_DEFAULT = "https://pp-api.sokin.xyz/pit-guru";
    const PG_LOCAL_API_BASE_DEFAULT = "https://127.0.0.1:8787";
    const PG_LOCAL_PLAYER_BASE_DEFAULT = "https://127.0.0.1:8790";
    const PG_TUNNEL_BASE_DEFAULT = "https://127.0.0.1:8092";
    const PG_ENDPOINT_MODE_KEY = "RT_TORN_MPG_ENDPOINT_MODE";
    const PG_CUSTOM_API_BASE_KEY = "RT_TORN_MPG_CUSTOM_API_BASE";
    const PG_CUSTOM_PLAYER_BASE_KEY = "RT_TORN_MPG_CUSTOM_PLAYER_BASE";
    const PG_API_CACHE_KEY = "RT_TORN_MPG_API_RESPONSE_CACHE_V1";
    const PG_API_CACHE_MAX_ENTRIES = 80;
    const PG_API_RETRY_MAX = 3;
    const PG_HOSTED_SESSION_KEY = 'RT_TORN_MPG_HOSTED_SESSION';
    const PG_LEGACY_HOSTED_SESSION_KEYS = ['RT_TORN_LTL_HOSTED_SESSION'];
    const PG_ENDPOINT_PRESETS = Object.freeze({
        public: { label: "Public VM", apiBase: PG_PUBLIC_BASE_DEFAULT, playerBase: PG_PUBLIC_BASE_DEFAULT },
        local: { label: "Local desktop", apiBase: PG_LOCAL_API_BASE_DEFAULT, playerBase: PG_LOCAL_PLAYER_BASE_DEFAULT },
        tunnel: { label: "SSH tunnel", apiBase: PG_TUNNEL_BASE_DEFAULT, playerBase: PG_TUNNEL_BASE_DEFAULT },
        custom: { label: "Custom URL", apiBase: PG_PUBLIC_BASE_DEFAULT, playerBase: PG_PUBLIC_BASE_DEFAULT }
    });
    let pgHostedSessionPromise = null;

    function pgNormalizeBaseUrl_(value, fallback = PG_PUBLIC_BASE_DEFAULT) {
        const raw = String(value || "").trim().replace(/\/+$/, "");
        if (!raw) return fallback;
        try {
            const url = new URL(raw);
            if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
            url.hash = "";
            url.search = "";
            return url.toString().replace(/\/+$/, "");
        } catch {
            return fallback;
        }
    }

    function pgEndpointMode_() {
        const mode = String(GM_getValue(PG_ENDPOINT_MODE_KEY, "public") || "public").trim().toLowerCase();
        return PG_ENDPOINT_PRESETS[mode] ? mode : "public";
    }

    function pgSetEndpointMode_(mode) {
        const next = PG_ENDPOINT_PRESETS[String(mode || "").trim().toLowerCase()] ? String(mode || "").trim().toLowerCase() : "public";
        GM_setValue(PG_ENDPOINT_MODE_KEY, next);
        pgClearHostedSession_();
        pgClearApiResponseCache_();
        return next;
    }

    function pgCustomApiBase_() {
        return pgNormalizeBaseUrl_(GM_getValue(PG_CUSTOM_API_BASE_KEY, PG_PUBLIC_BASE_DEFAULT), PG_PUBLIC_BASE_DEFAULT);
    }

    function pgCustomPlayerBase_() {
        return pgNormalizeBaseUrl_(GM_getValue(PG_CUSTOM_PLAYER_BASE_KEY, PG_PUBLIC_BASE_DEFAULT), PG_PUBLIC_BASE_DEFAULT);
    }

    function pgSetCustomApiBase_(value) {
        GM_setValue(PG_CUSTOM_API_BASE_KEY, pgNormalizeBaseUrl_(value, PG_PUBLIC_BASE_DEFAULT));
        pgClearHostedSession_();
        pgClearApiResponseCache_();
    }

    function pgSetCustomPlayerBase_(value) {
        GM_setValue(PG_CUSTOM_PLAYER_BASE_KEY, pgNormalizeBaseUrl_(value, PG_PUBLIC_BASE_DEFAULT));
        pgClearHostedSession_();
        pgClearApiResponseCache_();
    }

    function pgApiBase_() {
        const mode = pgEndpointMode_();
        return mode === "custom" ? pgCustomApiBase_() : PG_ENDPOINT_PRESETS[mode].apiBase;
    }

    function pgPlayerBase_() {
        const mode = pgEndpointMode_();
        return mode === "custom" ? pgCustomPlayerBase_() : PG_ENDPOINT_PRESETS[mode].playerBase;
    }

    function pgJoinUrl_(base, path = "") {
        const p = String(path || "");
        if (!p) return base;
        return `${base}${p.startsWith("/") ? "" : "/"}${p}`;
    }

    function pgApiUrl_(path = "") {
        return pgJoinUrl_(pgApiBase_(), path);
    }

    function pgPlayerUrl_(path = "") {
        return pgJoinUrl_(pgPlayerBase_(), path);
    }

    function pgHostedSession_() {
        const current = String(GM_getValue(PG_HOSTED_SESSION_KEY, "") || "").trim();
        if (current) return current;
        for (const legacyKey of PG_LEGACY_HOSTED_SESSION_KEYS) {
            const legacy = String(GM_getValue(legacyKey, "") || "").trim();
            if (legacy) {
                GM_setValue(PG_HOSTED_SESSION_KEY, legacy);
                GM_setValue(legacyKey, "");
                return legacy;
            }
        }
        return "";
    }

    function pgClearHostedSession_() {
        GM_setValue(PG_HOSTED_SESSION_KEY, "");
        for (const legacyKey of PG_LEGACY_HOSTED_SESSION_KEYS) GM_setValue(legacyKey, "");
    }

    function pgDelay_(ms) {
        return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
    }

    function pgShouldRetryApiError_(error) {
        const status = Number(error?.status || error?.statusCode || 0);
        if (!status) return true;
        if ([400, 401, 403, 404, 409, 422].includes(status)) return false;
        return status >= 500 || status === 408 || status === 429;
    }

    async function pgWithRetry_(operation, options = {}) {
        const maxRetries = Math.max(1, Number(options.maxRetries) || PG_API_RETRY_MAX);
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation(attempt);
            } catch (error) {
                lastError = error;
                if (attempt >= maxRetries || !pgShouldRetryApiError_(error)) throw error;
                const retryAfter = Number(error?.retryAfterMs || 0);
                const delay = retryAfter > 0 ? retryAfter : Math.min(6000, 500 * Math.pow(2, attempt - 1));
                await pgDelay_(delay);
            }
        }
        throw lastError || new Error("Pit Guru API request failed");
    }

    function pgStableJson_(value) {
        if (value == null || typeof value !== "object") return JSON.stringify(value);
        if (Array.isArray(value)) return `[${value.map(pgStableJson_).join(",")}]`;
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${pgStableJson_(value[key])}`).join(",")}}`;
    }

    function pgCacheStorage_() {
        try {
            if (typeof localStorage !== "undefined" && localStorage) return localStorage;
        } catch { }
        try {
            if (typeof unsafeWindow !== "undefined" && unsafeWindow?.localStorage) return unsafeWindow.localStorage;
        } catch { }
        return null;
    }

    function pgLoadApiResponseCache_() {
        try {
            const storage = pgCacheStorage_();
            const raw = storage ? storage.getItem(PG_API_CACHE_KEY) : GM_getValue(PG_API_CACHE_KEY, "");
            const parsed = JSON.parse(String(raw || "{}"));
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }

    function pgSaveApiResponseCache_(cache) {
        try {
            const entries = Object.entries(cache || {})
                .filter(([, entry]) => entry && Number.isFinite(Number(entry.at)))
                .sort((a, b) => Number(b[1].at) - Number(a[1].at))
                .slice(0, PG_API_CACHE_MAX_ENTRIES);
            const serialized = JSON.stringify(Object.fromEntries(entries));
            const storage = pgCacheStorage_();
            if (storage) storage.setItem(PG_API_CACHE_KEY, serialized);
            else GM_setValue(PG_API_CACHE_KEY, serialized);
        } catch { }
    }

    function pgClearApiResponseCache_() {
        try {
            const storage = pgCacheStorage_();
            if (storage) storage.removeItem(PG_API_CACHE_KEY);
        } catch { }
        GM_setValue(PG_API_CACHE_KEY, "{}");
    }

    function pgApiResponseCacheKey_(method, url, payload) {
        return `${method}|${url}|${pgStableJson_(payload || null)}`;
    }

    function pgReadApiResponseCache_(key, ttlMs) {
        const ttl = Number(ttlMs) || 0;
        if (!key || ttl <= 0) return null;
        const cache = pgLoadApiResponseCache_();
        const entry = cache[key];
        if (!entry || Date.now() - Number(entry.at || 0) > ttl) {
            if (entry) {
                delete cache[key];
                pgSaveApiResponseCache_(cache);
            }
            return null;
        }
        return entry.value;
    }

    function pgWriteApiResponseCache_(key, value) {
        if (!key) return;
        const cache = pgLoadApiResponseCache_();
        cache[key] = { at: Date.now(), value };
        pgSaveApiResponseCache_(cache);
    }

    function pgRequestJson_(method, url, payload = null, options = {}) {
        return new Promise((resolve, reject) => {
            const headers = Object.assign(
                payload ? { "Content-Type": "application/json" } : {},
                options.headers || {}
            );
            const parse = (status, statusText, responseText, responseHeaders = "") => {
                let body = null;
                try { body = JSON.parse(String(responseText || "{}")); }
                catch { body = {}; }
                if (status < 200 || status >= 300) {
                    const error = new Error(body?.error || statusText || `HTTP ${status}`);
                    error.status = status;
                    error.statusText = statusText;
                    error.payload = body;
                    const retryAfter = String(responseHeaders || "").match(/retry-after:\s*(\d+)/i);
                    if (retryAfter) error.retryAfterMs = Number(retryAfter[1]) * 1000;
                    reject(error);
                    return;
                }
                resolve({ status, statusText, body });
            };
            if (typeof GM_xmlhttpRequest === "function") {
                GM_xmlhttpRequest({
                    method,
                    url,
                    headers,
                    data: payload ? JSON.stringify(payload) : undefined,
                    timeout: Number(options.timeout) || 10000,
                    onload: response => parse(response.status, response.statusText, response.responseText, response.responseHeaders),
                    onerror: () => reject(new Error(options.errorMessage || `Pit Guru API unavailable at ${url}.`)),
                    ontimeout: () => reject(new Error(options.timeoutMessage || "Pit Guru API request timed out"))
                });
                return;
            }
            fetch(url, {
                method,
                headers,
                body: payload ? JSON.stringify(payload) : undefined,
                cache: "no-store"
            }).then(async response => {
                parse(response.status, response.statusText, await response.text(), "");
            }).catch(reject);
        });
    }

    async function pgRequestJsonWithRetry_(method, url, payload = null, options = {}) {
        return await pgWithRetry_(() => pgRequestJson_(method, url, payload, options), options);
    }

    function pgVerifyHostedSession_() {
        if (pgHostedSessionPromise) return pgHostedSessionPromise;
        const key = String(GM_getValue("RT_TORN_RA_API_KEY", "") || "").trim();
        if (!key) return Promise.reject(new Error("Add a public Torn API key in Pit Guru Settings to verify the hosted player."));
        pgHostedSessionPromise = pgRequestJsonWithRetry_("POST", pgPlayerUrl_("/api/account/verify"), { apiKey: key }, {
            timeout: 15000,
            maxRetries: PG_API_RETRY_MAX,
            errorMessage: "Pit Guru hosted account verification failed.",
            timeoutMessage: "Pit Guru hosted account verification timed out."
        }).then(result => {
            const data = result.body || {};
            if (!data.sessionToken) throw new Error(data.error || "Pit Guru hosted account verification did not return a session.");
            GM_setValue(PG_HOSTED_SESSION_KEY, data.sessionToken);
            return data.sessionToken;
        }).finally(() => { pgHostedSessionPromise = null; });
        return pgHostedSessionPromise;
    }

    function pgErrorMessage_(error, fallback = "Request failed") {
        if (!error) return fallback;
        if (typeof error === "string") return error;
        if (error.message) return String(error.message);
        const status = error.status || error.statusCode || "";
        const statusText = error.statusText || error.error || error.type || "";
        if (status || statusText) return [status ? `HTTP ${status}` : "", statusText].filter(Boolean).join(" ");
        try {
            const json = JSON.stringify(error);
            if (json && json !== "{}") return json;
        } catch { }
        return fallback;
    }

    async function pgLocalApiRequest(path, payload = null, options = {}) {
        const method = payload ? "POST" : "GET";
        const url = pgApiUrl_(path);
        const session = pgHostedSession_();
        const headers = session ? { "X-Pit-Guru-Session": session } : {};
        const cacheKey = Number(options.cacheTtlMs || 0) > 0 ? pgApiResponseCacheKey_(method, url, payload) : "";
        if (!options.forceRefresh) {
            const cached = pgReadApiResponseCache_(cacheKey, options.cacheTtlMs);
            if (cached) return cached;
        }
        const result = await pgRequestJsonWithRetry_(method, url, payload, {
            timeout: Number(options.timeout) || 10000,
            maxRetries: Number(options.maxRetries) || PG_API_RETRY_MAX,
            headers,
            errorMessage: `Pit Guru hosted API unavailable at ${pgApiBase_()}.`,
            timeoutMessage: "Pit Guru hosted API request timed out"
        });
        const body = result.body || {};
        if (cacheKey) pgWriteApiResponseCache_(cacheKey, body);
        return body;
    }

    unsafeWindow.pgLocalHealthTest = async function () {
        try {
            const result = await pgLocalApiRequest('/health', null, { forceRefresh: true });
            console.log('[Pit Guru Local API health]', result);
            alert(`Pit Guru hosted API works:\n${JSON.stringify(result, null, 2).slice(0, 1800)}`);
            return result;
        } catch (error) {
            console.error('[Pit Guru Local API health failed]', error);
            alert(`Pit Guru hosted API failed: ${pgErrorMessage_(error, "Hosted API unavailable")}`);
            throw error;
        }
    };

    async function pgLocalSubmitRace(payload) {
        if (!payload || !payload.raceId || !payload.track || !Array.isArray(payload.participants)) {
            throw new Error('Invalid Pit Guru race payload');
        }

        return await pgLocalApiRequest('/api/pit-guru/v1/races/submit', payload);
    }

    async function pgLocalFetchRaceIntel(track, drivers, options = {}) {
        if (!track) {
            throw new Error('Missing track for Pit Guru local intel lookup');
        }

        if (!Array.isArray(drivers)) {
            throw new Error('Drivers must be an array for Pit Guru local intel lookup');
        }

        return await pgLocalApiRequest('/api/pit-guru/v1/intel/race', {
            track,
            drivers,
            raceType: options.raceType || "official",
            laps: options.laps || null
        }, { cacheTtlMs: 120000 });
    }

    async function pgLocalFetchTrackHistory(track, options = {}) {
        if (!track) {
            throw new Error('Missing track for Pit Guru local history lookup');
        }

        return await pgLocalApiRequest('/api/pit-guru/v1/history/track', {
            track,
            raceType: options.raceType || "official",
            laps: options.laps || null
        }, { cacheTtlMs: 120000 });
    }

    async function pgLocalFetchTracks() {
        return await pgLocalApiRequest('/api/pit-guru/v1/tracks', null, { cacheTtlMs: 600000 });
    }

    async function pgLocalUpsertTrackRoute(route) {
        if (!route || typeof route !== "object") {
            throw new Error('Missing Pit Guru track route payload');
        }
        return await pgLocalApiRequest('/api/pit-guru/v1/tracks/route/upsert', route);
    }

    async function pgLocalFetchRecords(mode, track, limit = 100, options = {}) {
        if (!track) {
            throw new Error('Missing track for Pit Guru local records lookup');
        }
        return await pgLocalApiRequest('/api/pit-guru/v1/records', {
            mode,
            track,
            limit,
            raceType: options.raceType || "official",
            scope: options.scope || "global",
            driverId: options.driverId || "",
            driverName: options.driverName || ""
        }, { cacheTtlMs: 30000 });
    }

    async function pgLocalUpsertDrivers(drivers) {
        if (!Array.isArray(drivers)) {
            throw new Error('Drivers must be an array for Pit Guru local driver upsert');
        }
        return await pgLocalApiRequest('/api/pit-guru/v1/drivers/upsert', {
            drivers
        });
    }

    async function pgLocalFetchCars() {
        return await pgLocalApiRequest('/api/pit-guru/v1/cars', null, { cacheTtlMs: 600000 });
    }

    async function pgLocalFetchUpgrades() {
        return await pgLocalApiRequest('/api/pit-guru/v1/upgrades', null, { cacheTtlMs: 600000 });
    }

    async function pgLocalFetchFuelSummary(payload = {}) {
        return await pgLocalApiRequest('/api/pit-guru/v1/fuel-summary', payload || {}, { cacheTtlMs: 60000 });
    }

    async function pgLocalDeleteRecord(payload = {}) {
        return await pgLocalApiRequest('/api/pit-guru/v1/records/delete', payload || {});
    }

    async function pgLocalUpsertCars(cars) {
        if (!Array.isArray(cars)) {
            throw new Error('Cars must be an array for Pit Guru stock car upsert');
        }
        return await pgLocalApiRequest('/api/pit-guru/v1/cars/upsert', {
            cars
        });
    }

    async function pgLocalFetchEnlistedCars(ownerId = "") {
        return await pgLocalApiRequest('/api/pit-guru/v1/enlisted-cars', {
            ownerId
        }, { cacheTtlMs: 60000 });
    }

    async function pgLocalUpsertEnlistedCars(cars, ownerId = "") {
        if (!Array.isArray(cars)) {
            throw new Error('Cars must be an array for Pit Guru garage upsert');
        }
        return await pgLocalApiRequest('/api/pit-guru/v1/enlisted-cars/upsert', {
            ownerId,
            cars
        });
    }

    async function pgLocalFetchEnlistedCarEvents(filter = {}) {
        return await pgLocalApiRequest('/api/pit-guru/v1/enlisted-car-events', filter || {}, { cacheTtlMs: 60000 });
    }

    async function pgLocalUpsertEnlistedCarEvents(events, ownerId = "") {
        if (!Array.isArray(events)) {
            throw new Error('Events must be an array for Pit Guru garage event upsert');
        }
        return await pgLocalApiRequest('/api/pit-guru/v1/enlisted-car-events/upsert', {
            ownerId,
            events
        });
    }

    unsafeWindow.pgLocalDebugAnalysisDrivers = function () {
        const rows = (analysis?.drivers || []).map(d => {
            const out = {
                name: d.name,
                driverId: d.driverId,
                car: toOgCarName_(d.car || ""),
                keys: Object.keys(d).sort()
            };

            for (const key of Object.keys(d).sort()) {
                const value = d[key];

                if (
                    typeof value === "number" ||
                    typeof value === "string" ||
                    typeof value === "boolean" ||
                    value === null
                ) {
                    out[key] = value;
                }
            }

            return out;
        });

        console.log("[Pit Guru analysis drivers debug]", rows);
        console.table(rows.map(r => ({
            name: r.name,
            driverId: r.driverId,
            car: r.car,
            bestLapSeconds: r.bestLapSeconds,
            finalTime: r.finalTime,
            crashed: r.crashed,
            racingSkill: r.racingSkill,
            keysCount: r.keys.length
        })));

        return rows;
    };

    unsafeWindow.pgLocalSubmitRace = pgLocalSubmitRace;
    unsafeWindow.pgLocalFetchRaceIntel = pgLocalFetchRaceIntel;
    unsafeWindow.pgLocalFetchTrackHistory = pgLocalFetchTrackHistory;
    unsafeWindow.pgLocalFetchTracks = pgLocalFetchTracks;
    unsafeWindow.pgLocalUpsertTrackRoute = pgLocalUpsertTrackRoute;
    unsafeWindow.pgLocalFetchRecords = pgLocalFetchRecords;
    unsafeWindow.pgLocalUpsertDrivers = pgLocalUpsertDrivers;
    unsafeWindow.pgLocalFetchCars = pgLocalFetchCars;
    unsafeWindow.pgLocalFetchUpgrades = pgLocalFetchUpgrades;
    unsafeWindow.pgLocalUpsertCars = pgLocalUpsertCars;
    unsafeWindow.pgLocalFetchEnlistedCars = pgLocalFetchEnlistedCars;
    unsafeWindow.pgLocalUpsertEnlistedCars = pgLocalUpsertEnlistedCars;
    unsafeWindow.pgLocalFetchEnlistedCarEvents = pgLocalFetchEnlistedCarEvents;
    unsafeWindow.pgLocalUpsertEnlistedCarEvents = pgLocalUpsertEnlistedCarEvents;
    unsafeWindow.pgPlayerCacheRaceId = pgPlayerFetchRaceDataById_;
    unsafeWindow.pgPlayerCacheCurrentRace = openLocalPlayerForCurrentRace_;
    unsafeWindow.pgPitGuruEndpointMode = pgEndpointMode_;
    unsafeWindow.pgPitGuruApiBase = pgApiBase_;
    unsafeWindow.pgPitGuruPlayerBase = pgPlayerBase_;
    unsafeWindow.pgPitGuruClearApiCache = pgClearApiResponseCache_;
    unsafeWindow.pgPitGuruHealthTest = unsafeWindow.pgLocalHealthTest;

    const MPG_VERSION = "2.1.2";
    var TAG = "[MoDuL's Pit Guru v" + MPG_VERSION + "]";

    const PitGuruRaceEngine = (() => {
        function n_(value, fallback = NaN) {
            const n = Number(value);
            return Number.isFinite(n) ? n : fallback;
        }

        function clampEngine_(value, min, max) {
            const n = n_(value, min);
            return Math.max(min, Math.min(max, n));
        }

        function engineCumulative_(items) {
            const out = [];
            let total = 0;
            for (const item of items || []) {
                total += n_(item, 0);
                out.push(total);
            }
            return out;
        }

        function engineFirstIndexAtOrAfter_(arr, value) {
            let lo = 0;
            let hi = (arr || []).length - 1;
            let ans = (arr || []).length;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (value <= arr[mid]) {
                    ans = mid;
                    hi = mid - 1;
                } else {
                    lo = mid + 1;
                }
            }
            return ans;
        }

        function decodeBase64Engine_(value) {
            const text = String(value || "");
            if (!text) return "";
            if (typeof atob === "function") return atob(text);
            if (typeof Buffer !== "undefined") return Buffer.from(text, "base64").toString("utf8");
            throw new Error("No base64 decoder available");
        }

        function decodeDriverIntervals(carsData) {
            const out = {};
            for (const [name, encoded] of Object.entries(carsData || {})) {
                try {
                    out[name] = decodeBase64Engine_(encoded)
                        .split(",")
                        .map(v => n_(v))
                        .filter(v => Number.isFinite(v) && v > 0);
                } catch {
                    out[name] = [];
                }
            }
            return out;
        }

        function sectorSplitIndexes(trackPieces) {
            const pieces = Math.max(1, Number(trackPieces) || 1);
            const s1 = Math.max(1, Math.round(pieces / 3));
            const s2 = Math.max(s1 + 1, Math.round(pieces * 2 / 3));
            return [s1, Math.min(pieces - 1, s2), pieces];
        }

        function calculateLapTimes(driver, trackPieces) {
            const pieces = Math.max(1, Number(trackPieces) || 1);
            const out = [];
            for (let start = 0, lap = 1; start + pieces <= driver.intervalsSeconds.length; start += pieces, lap++) {
                const seconds = driver.intervalsSeconds.slice(start, start + pieces).reduce((sum, v) => sum + v, 0);
                out.push({ lap, seconds, ms: Math.round(seconds * 1000), valid: true });
            }
            return out;
        }

        function calculateSectors(driver, trackPieces, splits = sectorSplitIndexes(trackPieces)) {
            const pieces = Math.max(1, Number(trackPieces) || 1);
            const out = [];
            for (let lapStart = 0, lap = 1; lapStart + pieces <= driver.intervalsSeconds.length; lapStart += pieces, lap++) {
                let start = lapStart;
                for (let sector = 0; sector < splits.length; sector++) {
                    const end = lapStart + splits[sector];
                    const seconds = driver.intervalsSeconds.slice(start, end).reduce((sum, v) => sum + v, 0);
                    out.push({ lap, sector: sector + 1, seconds, ms: Math.round(seconds * 1000) });
                    start = end;
                }
            }
            return out;
        }

        function parseRaceData(dataParsed, options = {}) {
            const raceData = dataParsed?.raceData || dataParsed || {};
            const trackData = raceData.trackData || {};
            const trackIntervals = (trackData.intervals || [])
                .map(v => n_(v))
                .filter(v => Number.isFinite(v) && v > 0);
            const trackPieces = trackIntervals.length;
            const laps = Math.max(1, Math.round(n_(trackData.laps ?? raceData.laps ?? dataParsed?.laps ?? options.laps, 1)));
            const expectedSegments = trackPieces * laps;
            const trackLength = trackIntervals.reduce((sum, v) => sum + v, 0);
            const carInfo = raceData.carInfo || {};
            const decoded = decodeDriverIntervals(raceData.cars || {});
            const drivers = Object.entries(decoded).map(([playername, intervals], index) => {
                const info = carInfo[playername] || {};
                const finalSeconds = intervals.reduce((sum, v) => sum + v, 0);
                const key = String(info.userID || info.userId || info.id || playername || index);
                const driver = {
                    key,
                    userID: String(info.userID || info.userId || info.id || ""),
                    name: String(info.playername || info.playerName || info.name || playername || `Driver ${index + 1}`).trim(),
                    car: toOgCarName_(info.car || info.carTitle || info.car_title || ""),
                    carImg: String(info.carImg || info.carImage || info.car_image || "").trim(),
                    colorIndex: n_(info.color, index + 1),
                    startPosition: index + 1,
                    intervalsSeconds: intervals,
                    cumulativeSeconds: engineCumulative_(intervals),
                    cumulativeDistanceRaw: engineCumulative_(intervals.map((_, i) => trackIntervals[trackPieces ? i % trackPieces : 0] || 0)),
                    finalSeconds,
                    expectedSegments,
                    completedSegments: intervals.length,
                    completedLaps: trackPieces ? Math.floor(intervals.length / trackPieces) : 0,
                    crashed: intervals.length < expectedSegments
                };
                driver.lapTimes = calculateLapTimes(driver, trackPieces);
                driver.sectorTimes = calculateSectors(driver, trackPieces);
                driver.bestLapSeconds = driver.lapTimes.length ? Math.min(...driver.lapTimes.map(x => x.seconds)) : null;
                return driver;
            });
            return {
                raceId: String(dataParsed?.raceID || dataParsed?.raceId || raceData.raceID || raceData.raceId || ""),
                trackData,
                trackIntervals,
                trackPieces,
                trackLength,
                laps,
                expectedSegments,
                timeData: dataParsed?.timeData || raceData.timeData || {},
                carInfo,
                drivers
            };
        }

        function getDriverLocationAt(model, driver, ms) {
            const trackPieces = Math.max(1, model.trackPieces || 1);
            const trackIntervals = model.trackIntervals || [];
            const trackLength = model.trackLength || trackIntervals.reduce((sum, v) => sum + v, 0);
            const timeMs = Math.max(0, n_(ms, 0));
            const elapsedSeconds = timeMs / 1000;
            const intervals = driver.intervalsSeconds || [];
            const expectedLastIndex = Math.max(0, model.expectedSegments - 1);
            const cumulativeSeconds = driver.cumulativeSeconds || [];
            const cumulativeDistanceRaw = driver.cumulativeDistanceRaw || [];
            const finalSeconds = driver.finalSeconds || 0;
            let location = 0;
            let segmentIndex = 0;
            let segmentElapsedSeconds = 0;
            let finished = false;
            if (finalSeconds > 0 && elapsedSeconds >= finalSeconds) {
                segmentIndex = Math.max(0, intervals.length - 1);
                location = cumulativeDistanceRaw[cumulativeDistanceRaw.length - 1] || 0;
                finished = true;
            } else {
                const i = engineFirstIndexAtOrAfter_(cumulativeSeconds, elapsedSeconds);
                segmentIndex = Math.min(Math.max(0, i), Math.max(0, intervals.length - 1));
                const prevTime = i ? cumulativeSeconds[i - 1] || 0 : 0;
                const prevDist = i ? cumulativeDistanceRaw[i - 1] || 0 : 0;
                const segTime = Math.max(0.001, intervals[i] || 0.001);
                const segDist = trackIntervals[trackPieces ? i % trackPieces : 0] || 0;
                const pct = clampEngine_((elapsedSeconds - prevTime) / segTime, 0, 1);
                segmentElapsedSeconds = Math.max(0, elapsedSeconds - prevTime);
                location = prevDist + segDist * pct;
            }
            const crashed = finished && segmentIndex !== expectedLastIndex;
            const totalRaceDistance = trackLength * Math.max(1, model.laps || 1);
            const locationPlus = finished && !crashed && finalSeconds > 0 ? 1000 / finalSeconds : 0;
            const lap = trackLength > 0 ? clampEngine_(Math.ceil(Number((location / trackLength).toPrecision(5))), 1, model.laps || 1) : 1;
            return {
                elapsedSeconds,
                location,
                segmentIndex,
                segmentElapsedSeconds,
                lap,
                completionPct: totalRaceDistance > 0 ? clampEngine_(location / totalRaceDistance * 100, 0, 100) : 0,
                finished,
                crashed: crashed || (driver.crashed && finished),
                orderingIndex: location + locationPlus
            };
        }

        function getOrderAt(model, ms) {
            return (model?.drivers || []).map(driver => ({
                driver,
                state: getDriverLocationAt(model, driver, ms)
            })).sort((a, b) => {
                if (a.state.finished && !a.state.crashed && b.state.finished && !b.state.crashed) {
                    const aMs = Math.ceil((a.driver.finalSeconds || 0) * 1000);
                    const bMs = Math.ceil((b.driver.finalSeconds || 0) * 1000);
                    return aMs !== bMs ? aMs - bMs : String(a.driver.userID).localeCompare(String(b.driver.userID), undefined, { numeric: true });
                }
                return b.state.orderingIndex - a.state.orderingIndex;
            });
        }

        function buildSnapshots(model, stepMs = 1000) {
            const maxMs = Math.max(...(model?.drivers || []).map(d => (d.finalSeconds || 0) * 1000), 0);
            const step = Math.max(50, Number(stepMs) || 1000);
            const snapshots = [];
            for (let ms = 0; ms <= maxMs; ms += step) {
                snapshots.push({
                    ms,
                    order: getOrderAt(model, ms).map((item, index) => ({
                        position: index + 1,
                        driverKey: item.driver.key,
                        name: item.driver.name,
                        location: item.state.location,
                        completionPct: item.state.completionPct,
                        lap: item.state.lap,
                        crashed: item.state.crashed,
                        finished: item.state.finished
                    }))
                });
            }
            if (!snapshots.length || snapshots[snapshots.length - 1].ms !== maxMs) {
                snapshots.push({
                    ms: maxMs,
                    order: getOrderAt(model, maxMs).map((item, index) => ({
                        position: index + 1,
                        driverKey: item.driver.key,
                        name: item.driver.name,
                        location: item.state.location,
                        completionPct: item.state.completionPct,
                        lap: item.state.lap,
                        crashed: item.state.crashed,
                        finished: item.state.finished
                    }))
                });
            }
            return snapshots;
        }

        function detectOvertakes(snapshots) {
            const events = [];
            let prev = null;
            for (const snapshot of snapshots || []) {
                const current = new Map(snapshot.order.map(row => [row.driverKey, row.position]));
                if (prev) {
                    for (const row of snapshot.order) {
                        const oldPos = prev.get(row.driverKey);
                        if (Number.isFinite(oldPos) && row.position < oldPos) {
                            events.push({ ms: snapshot.ms, driverKey: row.driverKey, name: row.name, from: oldPos, to: row.position, gained: oldPos - row.position });
                        }
                    }
                }
                prev = current;
            }
            return events;
        }

        function detectCrashes(model) {
            return (model?.drivers || [])
                .filter(driver => driver.completedSegments < model.expectedSegments)
                .map(driver => ({
                    driverKey: driver.key,
                    name: driver.name,
                    completedSegments: driver.completedSegments,
                    expectedSegments: model.expectedSegments,
                    crashSegment: driver.completedSegments,
                    completedLaps: driver.completedLaps,
                    hasLapRecordCandidate: driver.completedLaps > 0
                }));
        }

        function gapToLeaderAt(model, ms) {
            const order = getOrderAt(model, ms);
            if (!order.length) return [];
            const leader = order[0];
            return order.map((item, index) => ({
                position: index + 1,
                driverKey: item.driver.key,
                name: item.driver.name,
                gapLocation: Math.max(0, leader.state.location - item.state.location),
                completionPct: item.state.completionPct,
                lap: item.state.lap,
                crashed: item.state.crashed,
                finished: item.state.finished
            }));
        }

        return {
            parseRaceData,
            decodeDriverIntervals,
            calculateLapTimes,
            calculateSectors,
            sectorSplitIndexes,
            getDriverLocationAt,
            getOrderAt,
            buildSnapshots,
            detectOvertakes,
            detectCrashes,
            gapToLeaderAt,
            firstIndexAtOrAfter: engineFirstIndexAtOrAfter_
        };
    })();

    /* ============================
     * STORAGE
     * ============================ */
    const STORE_UI_KEY = "RT_TORN_LAP_UI_POS";    // {btn:{left,top}, win:{left,top,width,height}}
    const STORE_META_KEY = "RT_TORN_RACE_META_V3";  // {track,car,detectedAtIso,detectedAtLocal,metaKey,countdown}
    const STORE_THEME_KEY = "RT_TORN_LAP_THEME";     // theme key
    const STORE_ALLOW_PREVIEW_KEY = "RT_TORN_RA_ALLOW_PREVIEW";
    const STORE_SPEED_UNIT_KEY = "RT_TORN_RA_SPEED_UNIT";
    const STORE_UPDATE_RATE_KEY = "RT_TORN_RA_UPDATE_RATE";
    const STORE_SMOOTHING_KEY = "RT_TORN_RA_SMOOTHING";
    const STORE_MODE_KEY = "RT_TORN_RA_MODE";
    const STORE_DEBUG_KEY = "RT_TORN_RA_DEBUG";
    const STORE_ENABLE_PREDICTIONS_KEY = "RT_TORN_RA_ENABLE_PREDICTIONS";
    const STORE_USE_HISTORY_PREDICTIONS_KEY = "RT_TORN_RA_USE_HISTORY_PREDICTIONS";
    const STORE_USE_API_PREDICTIONS_KEY = "RT_TORN_RA_USE_API_PREDICTIONS";
    const STORE_API_KEY_KEY = "RT_TORN_RA_API_KEY";
    const STORE_API_KEY_INFO_KEY = "RT_TORN_RA_API_KEY_INFO";
    const STORE_DRIVER_INTEL_CACHE_KEY = "RT_TORN_RA_DRIVER_INTEL_CACHE_V1";
    const STORE_RECORDS_KEY = "RT_TORN_TRACK_RECORDS_V1";
    const STORE_WIN_OPEN_KEY = "RT_TORN_LAP_WIN_OPEN";
    const STORE_LAST_RACE_ID_KEY = "RT_TORN_LAST_RACE_ID";
    const STORE_CLEAR_ON_RACE_CHANGE_KEY = "RT_TORN_CLEAR_ON_RACE_CHANGE";
    const STORE_RECORDS_DETACHED_KEY = "RT_TORN_RECORDS_DETACHED";
    const STORE_RECORDS_OPEN_KEY = "RT_TORN_RECORDS_OPEN";
    const STORE_RECORDS_RACE_TYPE_KEY = "RT_TORN_RECORDS_RACE_TYPE";
    const STORE_RECORDS_SCOPE_KEY = "RT_TORN_RECORDS_SCOPE";
    const STORE_DRIVER_HISTORY_KEY = "RT_TORN_DRIVER_HISTORY_V1";
    const STORE_FUEL_ENABLED_KEY = "RT_TORN_RA_FUEL_ENABLED";
    const STORE_FUEL_STYLE_KEY = "RT_TORN_RA_FUEL_STYLE";
    const STORE_HEADER_BUTTON_ORDER_KEY = "RT_TORN_RA_HEADER_BUTTON_ORDER";
    const STORE_GARAGE_SHOW_DELISTED_KEY = "RT_TORN_RA_GARAGE_SHOW_DELISTED";
    const STORE_COMMENTARY_ENABLED_KEY = "RT_TORN_RA_COMMENTARY_ENABLED";
    const STORE_PIT_CREW_ENABLED_KEY = "RT_TORN_RA_PIT_CREW_ENABLED";
    const STORE_EXPERIMENTAL_GYRO_TRACE_KEY = "RT_TORN_RA_GYRO_TRACE";
    const STORE_PERFORMANCE_PRESET_KEY = "RT_TORN_RA_PERF_PRESET";
    const STORE_VISIBLE_RACE_SCAN_MS_KEY = "RT_TORN_RA_VISIBLE_RACE_SCAN_MS";
    const STORE_PARTICIPANT_SCAN_MS_KEY = "RT_TORN_RA_PARTICIPANT_SCAN_MS";
    const STORE_DRIVER_ID_LOOKUP_MS_KEY = "RT_TORN_RA_DRIVER_ID_LOOKUP_MS";
    const STORE_DRIVER_INTEL_SETTLE_MS_KEY = "RT_TORN_RA_DRIVER_INTEL_SETTLE_MS";
    const STORE_PARTICIPANT_SCAN_REPEAT_KEY = "RT_TORN_RA_PARTICIPANT_SCAN_REPEAT";
    const STORE_FOCUSED_ROW_WINDOW_EACH_SIDE_KEY = "RT_TORN_RA_FOCUS_WINDOW_EACH_SIDE";
    const STORE_DIRECT_FETCH_LEASE_KEY = "RT_TORN_RA_DIRECT_FETCH_LEASE_V1";
    const STORE_ONBOARDING_COMPLETE_KEY = "RT_TORN_RA_ONBOARDING_COMPLETE_V1";
    const STORE_HOSTED_TRACK_INTERVALS_KEY = "RT_TORN_MPG_HOSTED_TRACK_INTERVALS_V1";
    const BIG_RACE_DB_NAME = "MoDuLsPitGuruBigRaceCache";
    const BIG_RACE_DB_VERSION = 1;
    const BIG_RACE_RAW_STORE = "rawRaceJson";
    const BIG_RACE_SUMMARY_STORE = "processedSummaries";
    const STORE_RECORDS_MAX = 2500;
    const WIN_DEFAULT_WIDTH = 720;
    const WIN_DEFAULT_HEIGHT = 740;
    const WIN_MIN_WIDTH = 550;
    const WIN_MIN_HEIGHT = 500;
    const WIN_VIEWPORT_MARGIN = 12;
    const SCRIPT_FORUM_POST_URL = "https://www.torn.com/forums.php#/p=threads&f=21&t=16574141";
    const VISUAL_PROGRESS_SELECTORS = Object.freeze({
        lap: [
            "#racingdetails .pd-val.pd-lap",
            "#racingupdatesnew .pd-val.pd-lap",
            "#racingupdates .pd-val.pd-lap",
            ".pd-val.pd-lap"
        ],
        completion: [
            "#racingdetails .pd-val.pd-completion",
            "#racingupdatesnew .pd-val.pd-completion",
            "#racingupdates .pd-val.pd-completion",
            ".pd-val.pd-completion"
        ],
        info: ["#infoSpot"],
        timer: ["#race-timer", ".race-timer"],
        replayBar: ["#replay-bar-container"],
        replayProgress: ["#progress-active"],
        playPause: ["#play-pause-btn"],
        speed: ["#speed-value"]
    });
    const PIT_GURU_OWN_UI_SELECTOR = "#rtLapWin,#rtLapBtn,#rtRecordsPopup,#mpgSettingsModal,#mpgGarageModal,#mpgDriverHoverCard,#mpgTutorial";
    const LONGITUDINAL_G_LIMIT = 2.4;
    const LATERAL_G_LIMIT = 2.8;
    const PERFORMANCE_PRESETS = Object.freeze({
        balanced: { label: "Balanced", visibleRaceScanMs: 1500, participantScanMs: 2500, driverIdLookupMs: 5000, driverIntelSettleMs: 2500, participantScanRepeat: "continuous", focusWindowEachSide: 5 },
        fast: { label: "Fast", visibleRaceScanMs: 750, participantScanMs: 1250, driverIdLookupMs: 2500, driverIntelSettleMs: 1500, participantScanRepeat: "continuous", focusWindowEachSide: 7 },
        eco: { label: "Eco", visibleRaceScanMs: 3000, participantScanMs: 5000, driverIdLookupMs: 10000, driverIntelSettleMs: 4000, participantScanRepeat: "twice", focusWindowEachSide: 3 },
        once: { label: "Once", visibleRaceScanMs: 5000, participantScanMs: 8000, driverIdLookupMs: 15000, driverIntelSettleMs: 5000, participantScanRepeat: "once", focusWindowEachSide: 3 }
    });
    const TRACK_META = Object.freeze({
        "underdog":    { name: "Underdog",    lapMiles: 1.73, officialLaps: 9,  lapKm: 2.78 },
        "parkland":    { name: "Parkland",    lapMiles: 3.43, officialLaps: 5,  lapKm: 5.52 },
        "mudpit":      { name: "Mudpit",      lapMiles: 1.06, officialLaps: 15, lapKm: 1.71 },
        "speedway":    { name: "Speedway",    lapMiles: 0.90, officialLaps: 18, lapKm: 1.45 },
        "stone park":  { name: "Stone Park",  lapMiles: 2.08, officialLaps: 8,  lapKm: 3.35 },
        "commerce":    { name: "Commerce",    lapMiles: 1.09, officialLaps: 15, lapKm: 1.75 },
        "meltdown":    { name: "Meltdown",    lapMiles: 1.20, officialLaps: 13, lapKm: 1.93 },
        "uptown":      { name: "Uptown",      lapMiles: 2.25, officialLaps: 7,  lapKm: 3.62 },
        "withdrawal":  { name: "Withdrawal",  lapMiles: 3.40, officialLaps: 5,  lapKm: 5.47 },
        "hammerhead":  { name: "Hammerhead",  lapMiles: 1.16, officialLaps: 14, lapKm: 1.87 },
        "docks":       { name: "Docks",       lapMiles: 3.81, officialLaps: 5,  lapKm: 6.13 },
        "industrial":  { name: "Industrial",  lapMiles: 1.35, officialLaps: 12, lapKm: 2.17 },
        "vector":      { name: "Vector",      lapMiles: 1.16, officialLaps: 14, lapKm: 1.87 },
        "two islands": { name: "Two Islands", lapMiles: 2.71, officialLaps: 6,  lapKm: 4.36 },
        "sewage":      { name: "Sewage",      lapMiles: 1.50, officialLaps: 11, lapKm: 2.41 },
        "convict":     { name: "Convict",     lapMiles: 1.64, officialLaps: 10, lapKm: 2.64 }
    });
    const OFFICIAL_TRACK_LAPS = Object.freeze({
        "underdog": 9,
        "parkland": 5,
        "mudpit": 15,
        "speedway": 18,
        "stone park": 8,
        "commerce": 15,
        "meltdown": 13,
        "uptown": 7,
        "withdrawal": 5,
        "hammerhead": 14,
        "docks": 5,
        "industrial": 12,
        "vector": 14,
        "two islands": 6,
        "sewage": 11,
        "convict": 10
    });

    /* ============================
   * THEMES
   * ============================ */
    const THEMES = [
        { key: "classic", name: "Classic" },
        { key: "dark", name: "Dark" },
        { key: "ice", name: "Ice" },
        { key: "neon", name: "Neon" },
        { key: "modul_hub", name: "MoDuL Hub" },
        { key: "class_a", name: "Class A" },
        { key: "class_b", name: "Class B" },
        { key: "class_c", name: "Class C" },
        { key: "class_d", name: "Class D" },
        { key: "class_e", name: "Class E" },
    ];

    const OG_CAR_REPLACEMENTS = Object.freeze({
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
    });

    const FUEL_BASE_L100KM = Object.freeze({
        "Honda NSX": 11.8, "Sierra Cosworth": 9.7, "Mercedes SLR": 14.5, "Ford GT": 14.7,
        "Lexus LFA": 16.7, "Nissan GT-R": 12.4, "Audi R8": 13.1, "Bugatti Veyron": 24.1,
        "Ferrari 458": 13.3, "Lamborghini Gallardo": 17.0, "Porsche 911 GT3": 12.8, "Aston Martin One-77": 16.4,
        "Chevrolet Corvette Z06": 14.7, "Dodge Charger": 13.5, "BMW M5": 14.4, "BMW Z8": 14.5,
        "Ford Mustang": 13.0, "Ford Focus RS": 7.7, "Honda S2000": 9.9, "Honda Civic": 8.3,
        "Audi S3": 9.3, "Audi S4": 10.7, "Audi TT Quattro": 9.2, "Subaru Impreza STI": 10.9,
        "Mitsubishi Evo X": 10.7, "Volkswagen Golf GTI": 7.9, "Seat Leon Cupra": 7.2, "Mini Cooper S": 6.4,
        "Renault Clio": 7.1, "Citroen Saxo": 7.3, "Toyota MR2": 7.9, "Lotus Exige": 10.6,
        "TVR Sagaris": 13.0, "Hummer H3": 14.7, "Holden SS": 13.0, "Reliant Robin": 4.7,
        "Classic Mini": 6.8, "Fiat Punto": 8.3, "Vauxhall Astra GSI": 7.4, "Vauxhall Corsa": 7.5,
        "Volvo 850": 9.7, "Alfa Romeo 156": 12.1, "BMW X5": 14.9, "Pontiac Firebird": 14.2,
        "Chevrolet Cavalier": 8.4, "Honda Integra R": 8.8, "Honda Accord": 9.6, "Volkswagen Beetle": 8.1,
        "Nissan Micra": 5.8, "Peugeot 106": 7.8
    });

    /* ============================
   * STATE
   * ============================ */
    let clearOnRaceChange = false;
    let theme = "classic";
    let settingsOpen = false;
    let onboardingRequired = false;
    let tutorialActive = false;
    let tutorialStep = 0;
    let tutorialHighlightedEl = null;
    let focusApiKeyPending = false;
    let garageOpen = false;
    let garageLoading = false;
    let garageStatus = "";
    let garageCatalog = [];
    let garageUpgrades = [];
    let garageCars = [];
    let garageEvents = [];
    let garageSelectedCarId = "";
    let garageCompareOpen = false;
    let garageCompareCarId = "";
    let garageLogOpen = false;
    let garageShowDelisted = false;
    let garageLastFetchAt = 0;
    let garageCatalogLastFetchAt = 0;
    let garageSortKey = "parts";
    let garageSortDir = "desc";
    let allowPreFinishPreview = false;
    let speedUnit = "kmh";
    let updateRateMs = 250;
    let telemetrySmoothing = 3;
    let analysisMode = "gaps";
    let debugEnabled = false;
    let enablePredictions = true;
    let useHistoryPredictions = true;
    let useApiPredictions = true;
    let apiKey = "";
    let apiKeyVisible = false;
    let apiKeyInfo = {};
    let apiKeyCheckActive = false;
    let apiKeyStatus = "";
    let driverIntelCache = {};
    let driverHistory = {};
    let driverIntelFetchActive = false;
    let driverIntelStatus = "";
    let driverIntelNotificationKey = "";
    let driverIntelAutoRaceKey = "";
    let driverIntelPoolStableKey = "";
    let driverIntelPoolStableAt = 0;
    let latestRaceDataPayload = null;
    let analysis = null;
    let directCurrentRaceId = "";
    let raceDataDirectFetchAt = 0;
    let raceDataDirectFetchActive = false;
    let raceDataDirectFetchLastKey = "";
    const raceDataPayloadCacheByRaceId = new Map();
    const raceDataInFlightByRaceId = new Map();
    const raceDataAcceptedStateByRaceId = new Map();
    const raceDataFetchStatsByRaceId = new Map();
    const optionalImageUrlCache = new Map();
    const bigRaceRawStoredKeys = new Set();
    const bigRaceSummaryStoredKeys = new Set();
    const bigRaceSummaryInFlightKeys = new Set();
    const bigRaceProcessedSummaryCache = new Map();
    let bigRaceDbPromise = null;
    let bigRaceCacheStatus = { rawStored: 0, summaryStored: 0, workerUsed: false, lastError: "" };
    let lastHeavyRaceStats = { heavyRace: false, estimatedPoints: 0, drivers: 0, laps: 0, intervals: 0 };
    let heavyRaceOverrideRaceKey = "";
    let heavyRaceShowAllDrivers = false;
    let heavyRaceFullCardsEnabled = false;
    let pgPlayerCacheActive = false;
    let pgPlayerCacheLastKey = "";
    let pgPlayerCacheLastAt = 0;
    let pgPlayerCacheStatus = "";
    let pgPlayerCacheInFlightKeys = new Set();
    let pgPlayerCachedRaceKeys = new Set();
    let pgPlayerCacheNotificationKeys = new Set();
    let pgPlayerAvailabilityArmed = true;
    let pgPlayerReadyHighlightUntil = 0;
    let pgPlayerReadyHighlightTimer = 0;
    let pgLocalTrackRouteSavedKeys = new Set();
    let preRaceParticipants = [];
    let directRacingDataParticipants = [];
    let directRacingDataParticipantsKey = "";
    let raceDataVisibleMatchCache = { key: "", at: 0, valid: false };
    let preRaceParticipantsKey = "";
    let pgLocalTracksCache = { rows: [], recordTracks: { lap: [], race: [] }, fetchedAt: 0, loading: false, error: "" };
    let pgLocalRecordsCache = { key: "", rows: [], fetchedAt: 0, loading: false, error: "" };
    let preRaceParticipantsScanAt = 0;
    let preRaceParticipantsScanRaceKey = "";
    let preRaceParticipantsScanCount = 0;
    let visibleRaceDriverSlotsCache = { at: 0, value: { current: NaN, total: NaN } };
    let visibleRaceInfoCache = { at: 0, href: "", raceId: "", text: "" };
    const driverIdLookupCache = new Map();
    let analysisHooked = false;
    let pageRaceDataBridgeInstalled = false;
    let clearedRaceDataKey = "";
    let raceDataReceivedPerfMs = 0;
    let raceDataCurrentTimeAtReceive = NaN;
    let finalAnalysisNotifiedForRaceId = "";
    let recordsUpdatedForAnalysisRaceId = "";
    let lastSettingsRenderKey = "";
    let lastModeBarRenderKey = "";
    let lastAnalysisBodyKey = "";
    let fuelEnabled = false;
    let fuelDisplayStyle = "l100km";
    let liveCommentaryEnabled = true;
    let pitCrewEnabled = true;
    let experimentalGyroTrace = true;
    let performancePreset = "balanced";
    let visibleRaceScanMs = PERFORMANCE_PRESETS.balanced.visibleRaceScanMs;
    let participantScanMs = PERFORMANCE_PRESETS.balanced.participantScanMs;
    let driverIdLookupMs = PERFORMANCE_PRESETS.balanced.driverIdLookupMs;
    let driverIntelSettleMs = PERFORMANCE_PRESETS.balanced.driverIntelSettleMs;
    let participantScanRepeat = PERFORMANCE_PRESETS.balanced.participantScanRepeat;
    let focusedRowWindowEachSide = 5;
    let lastCommentaryAtMs = 0;
    let lastCommentaryText = "";
    let lastCommentaryKey = "";
    let lastTeamRadioAtMs = 0;
    let lastTeamRadioText = "";
    let lastTeamRadioKey = "";
    let raceOvertakesCache = { key: "", value: 0 };
    let raceOvertakesFloorCache = { key: "", value: 0 };
    let fuelSessionCache = { key: "", liters: 0, levelPct: 100 };
    let fuelLifetimeCache = { key: "", fetchedAt: 0, data: null, loading: false, error: "" };
    let liveOrderCache = { key: "", value: [] };
    let analysisFocusMode = "auto";
    let analysisFocusDriverId = "";
    let analysisFocusDriverName = "";
    let liveLoopLastAt = 0;
    let maintenanceLoopLastAt = 0;
    let pendingRaceChangeId = "";
    let pendingRaceChangeAt = 0;
    let joinRaceObserver = null;
    let joinRaceClearTimer = 0;
    let nativeResizeEl = null;
    let nativeResizeStoreKey = "";
    let nativeResizeAt = 0;
    let headerCompactRaf = 0;
    const resizePersistTimers = new Map();
    const gyroTraceByDriver = new Map();
    let slideEventsCache = new WeakMap();
    const LARGE_FIELD_THRESHOLD = 30;
    const HUGE_FIELD_THRESHOLD = 45;
    const DEFAULT_FOCUSED_ROW_WINDOW_EACH_SIDE = 10;
    const DEFAULT_HEAVY_ROW_WINDOW_EACH_SIDE = 10;
    const HEAVY_RACE_LAP_THRESHOLD = 100;
    const HEAVY_RACE_DRIVER_THRESHOLD = 50;
    const HEAVY_RACE_POINT_THRESHOLD = 150000;
    const LARGE_LOBBY_CANDIDATE_LIMIT = 220;
    const HUGE_LOBBY_CANDIDATE_LIMIT = 160;

    // Track records UI
    let recordsOpen = true;
    let recordsDetached = false;
    let recordsMode = "lap"; // "lap" or "race"
    let recordsRaceType = "official"; // "official" or "custom"
    let recordsMineOnly = false;
    let recordsTrack = "";


    let spectateName = "";
    let spectateCar = "";
    let spectateCarImg = "";
    let playerName = "";
    let spectateDriverId_ = "";
    let playerId = "";

    let uiDirty = true;
    let dataDirty = true;
    let layoutDirty = true;
    let statusDirty = true;
    let selectionDirty = true;
    let statusOnlyRenderPending = false;

    /** @type {{id:string,track:string,mode:"lap"|"race",car:string,carImg?:string,carClass?:string,driverName?:string,driverId?:string,timeText:string,ms:number,atIso:string,trackKey?:string,trackLabel?:string,sourceTrack?:string}[]} */
    let records = [];

    /** @type {{track:string,car:string,detectedAtIso:string,detectedAtLocal:string,metaKey:string,countdown?:string} | null} */
    let raceMeta = null;

    /* ============================
   * STORAGE HELPERS
   * ============================ */
    function loadWinOpen_() {
        const v = GM_getValue(STORE_WIN_OPEN_KEY, 0);
        return v === 1 || v === "1" || v === true || v === "true";
    }

    function saveWinOpen_(isOpen) {
        GM_setValue(STORE_WIN_OPEN_KEY, isOpen ? 1 : 0);
    }

    function resetScanCaches_() {
        preRaceParticipantsScanAt = 0;
        preRaceParticipantsScanRaceKey = "";
        preRaceParticipantsScanCount = 0;
        visibleRaceInfoCache = { at: 0, href: "", raceId: "", text: "" };
        driverIdLookupCache.clear();
        driverIntelPoolStableKey = "";
        driverIntelPoolStableAt = 0;
        raceDataDirectFetchAt = 0;
        raceDataDirectFetchLastKey = "";
        directRacingDataParticipants = [];
        directRacingDataParticipantsKey = "";
        raceDataVisibleMatchCache = { key: "", at: 0, valid: false };
    }

    function loadLastRaceId_() {
        return String(GM_getValue(STORE_LAST_RACE_ID_KEY, "") || "").trim();
    }

    function loadClearOnRaceChange_() {
        const v = GM_getValue(STORE_CLEAR_ON_RACE_CHANGE_KEY, 1);
        return v === 1 || v === "1" || v === true || v === "true";
    }

    function saveClearOnRaceChange_(enabled) {
        GM_setValue(STORE_CLEAR_ON_RACE_CHANGE_KEY, enabled ? 1 : 0);
    }

    function loadRecordsDetached_() {
        return loadBoolSetting_(STORE_RECORDS_DETACHED_KEY, false);
    }

    function saveRecordsDetached_() {
        saveBoolSetting_(STORE_RECORDS_DETACHED_KEY, recordsDetached);
    }

    function loadRecordsOpen_() {
        return loadBoolSetting_(STORE_RECORDS_OPEN_KEY, true);
    }

    function saveRecordsOpen_() {
        saveBoolSetting_(STORE_RECORDS_OPEN_KEY, recordsOpen);
    }

    function loadRecordsRaceType_() {
        const value = String(GM_getValue(STORE_RECORDS_RACE_TYPE_KEY, "official") || "official").toLowerCase();
        return value === "custom" ? "custom" : "official";
    }

    function saveRecordsRaceType_() {
        GM_setValue(STORE_RECORDS_RACE_TYPE_KEY, recordsRaceType === "custom" ? "custom" : "official");
    }

    function loadRecordsMineOnly_() {
        return String(GM_getValue(STORE_RECORDS_SCOPE_KEY, "global") || "global").toLowerCase() === "mine";
    }

    function saveRecordsMineOnly_() {
        GM_setValue(STORE_RECORDS_SCOPE_KEY, recordsMineOnly ? "mine" : "global");
    }

    function saveLastRaceId_(raceId) {
        GM_setValue(STORE_LAST_RACE_ID_KEY, String(raceId || "").trim());
    }

    function loadJson_(key, fallback) {
        try {
            const raw = GM_getValue(key, "");
            if (!raw) return fallback;
            const obj = JSON.parse(raw);
            return obj ?? fallback;
        } catch {
            return fallback;
        }
    }
    function saveJson_(key, obj) { GM_setValue(key, JSON.stringify(obj)); }

    function bigRaceIndexedDbAvailable_() {
        return typeof indexedDB !== "undefined";
    }

    function openBigRaceDb_() {
        if (!bigRaceIndexedDbAvailable_()) return Promise.resolve(null);
        if (bigRaceDbPromise) return bigRaceDbPromise;
        bigRaceDbPromise = new Promise((resolve, reject) => {
            try {
                const req = indexedDB.open(BIG_RACE_DB_NAME, BIG_RACE_DB_VERSION);
                req.onupgradeneeded = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains(BIG_RACE_RAW_STORE)) {
                        db.createObjectStore(BIG_RACE_RAW_STORE, { keyPath: "key" });
                    }
                    if (!db.objectStoreNames.contains(BIG_RACE_SUMMARY_STORE)) {
                        db.createObjectStore(BIG_RACE_SUMMARY_STORE, { keyPath: "key" });
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
            } catch (error) {
                reject(error);
            }
        }).catch(error => {
            bigRaceCacheStatus.lastError = String(error?.message || error || "IndexedDB unavailable");
            if (debugEnabled) console.warn(TAG, "Big Race IndexedDB unavailable", error);
            return null;
        });
        return bigRaceDbPromise;
    }

    async function bigRaceIdbPut_(storeName, record) {
        if (!record?.key) return false;
        const db = await openBigRaceDb_();
        if (!db) return false;
        return await new Promise(resolve => {
            try {
                const tx = db.transaction(storeName, "readwrite");
                tx.objectStore(storeName).put(record);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => {
                    bigRaceCacheStatus.lastError = String(tx.error?.message || tx.error || "IndexedDB write failed");
                    resolve(false);
                };
            } catch (error) {
                bigRaceCacheStatus.lastError = String(error?.message || error || "IndexedDB write failed");
                resolve(false);
            }
        });
    }

    async function bigRaceIdbGet_(storeName, key) {
        if (!key) return null;
        const db = await openBigRaceDb_();
        if (!db) return null;
        return await new Promise(resolve => {
            try {
                const tx = db.transaction(storeName, "readonly");
                const req = tx.objectStore(storeName).get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    }

    function markDirty_(flags = {}) {
        uiDirty = true;
        if (!flags || !Object.keys(flags).length) {
            dataDirty = true;
            layoutDirty = true;
            statusDirty = true;
            selectionDirty = true;
            return;
        }
        if (flags.data) dataDirty = true;
        if (flags.layout) layoutDirty = true;
        if (flags.status) statusDirty = true;
        if (flags.selection) selectionDirty = true;
    }

    function loadRecords_() {
        const data = loadJson_(STORE_RECORDS_KEY, []);
        return Array.isArray(data) ? data : [];
    }
    function saveRecords_() {
        if (records.length > STORE_RECORDS_MAX) records = records.slice(records.length - STORE_RECORDS_MAX);
        saveJson_(STORE_RECORDS_KEY, records);
    }

    function loadUiState_() { return loadJson_(STORE_UI_KEY, { btn: null, win: null }); }
    function saveUiState_(state) { saveJson_(STORE_UI_KEY, state); }

    function loadRaceMeta_() {
        const m = loadJson_(STORE_META_KEY, null);
        if (!m || typeof m !== "object") return null;
        if (!m.track || !m.car || !m.detectedAtIso || !m.metaKey) return null;
        m.car = toOgCarName_(m.car || "");
        return m;
    }
    function saveRaceMeta_(m) { saveJson_(STORE_META_KEY, m); }

    function loadTheme_() {
        const t = GM_getValue(STORE_THEME_KEY, "classic");
        return THEMES.some(x => x.key === t) ? t : "classic";
    }

    function saveTheme_() { GM_setValue(STORE_THEME_KEY, theme); }

    function loadBoolSetting_(key, fallback) {
        const v = GM_getValue(key, fallback ? 1 : 0);
        if (v === 1 || v === "1" || v === true || v === "true") return true;
        if (v === 0 || v === "0" || v === false || v === "false") return false;
        return !!fallback;
    }

    function saveBoolSetting_(key, enabled) {
        GM_setValue(key, enabled ? 1 : 0);
    }

    function loadAllowPreview_() { return loadBoolSetting_(STORE_ALLOW_PREVIEW_KEY, false); }
    function saveAllowPreview_() { saveBoolSetting_(STORE_ALLOW_PREVIEW_KEY, allowPreFinishPreview); }
    function loadSpeedUnit_() {
        const v = String(GM_getValue(STORE_SPEED_UNIT_KEY, "kmh") || "kmh").toLowerCase();
        return v === "mph" ? "mph" : "kmh";
    }
    function saveSpeedUnit_() { GM_setValue(STORE_SPEED_UNIT_KEY, speedUnit === "mph" ? "mph" : "kmh"); }
    function loadUpdateRate_() {
        const v = Number(GM_getValue(STORE_UPDATE_RATE_KEY, 250));
        return [100, 250, 500, 1000].includes(v) ? v : 250;
    }
    function saveUpdateRate_() { GM_setValue(STORE_UPDATE_RATE_KEY, updateRateMs); }
    function loadIntSetting_(key, fallback, min, max) {
        const n = Number(GM_getValue(key, fallback));
        if (!Number.isFinite(n)) return fallback;
        return Math.round(clamp_(n, min, max));
    }
    function saveIntSetting_(key, value) { GM_setValue(key, Math.round(Number(value) || 0)); }
    function loadPerformancePreset_() {
        const v = String(GM_getValue(STORE_PERFORMANCE_PRESET_KEY, "balanced") || "balanced");
        return v === "custom" || PERFORMANCE_PRESETS[v] ? v : "balanced";
    }
    function savePerformancePreset_() { GM_setValue(STORE_PERFORMANCE_PRESET_KEY, performancePreset); }
    function loadParticipantScanRepeat_() {
        const v = String(GM_getValue(STORE_PARTICIPANT_SCAN_REPEAT_KEY, PERFORMANCE_PRESETS.balanced.participantScanRepeat) || "continuous");
        return ["continuous", "twice", "once"].includes(v) ? v : "continuous";
    }
    function saveParticipantScanRepeat_() { GM_setValue(STORE_PARTICIPANT_SCAN_REPEAT_KEY, participantScanRepeat); }
    function loadPerformanceTuning_() {
        performancePreset = loadPerformancePreset_();
        const preset = PERFORMANCE_PRESETS[performancePreset] || PERFORMANCE_PRESETS.balanced;
        visibleRaceScanMs = loadIntSetting_(STORE_VISIBLE_RACE_SCAN_MS_KEY, preset.visibleRaceScanMs, 250, 30000);
        participantScanMs = loadIntSetting_(STORE_PARTICIPANT_SCAN_MS_KEY, preset.participantScanMs, 500, 60000);
        driverIdLookupMs = loadIntSetting_(STORE_DRIVER_ID_LOOKUP_MS_KEY, preset.driverIdLookupMs, 1000, 120000);
        driverIntelSettleMs = loadIntSetting_(STORE_DRIVER_INTEL_SETTLE_MS_KEY, preset.driverIntelSettleMs, 500, 30000);
        participantScanRepeat = loadParticipantScanRepeat_();
        focusedRowWindowEachSide = loadIntSetting_(STORE_FOCUSED_ROW_WINDOW_EACH_SIDE_KEY, DEFAULT_FOCUSED_ROW_WINDOW_EACH_SIDE, 1, 25);
        if (performancePreset !== "custom") applyPerformancePreset_(performancePreset, false);
    }
    function savePerformanceTuning_() {
        savePerformancePreset_();
        saveIntSetting_(STORE_VISIBLE_RACE_SCAN_MS_KEY, visibleRaceScanMs);
        saveIntSetting_(STORE_PARTICIPANT_SCAN_MS_KEY, participantScanMs);
        saveIntSetting_(STORE_DRIVER_ID_LOOKUP_MS_KEY, driverIdLookupMs);
        saveIntSetting_(STORE_DRIVER_INTEL_SETTLE_MS_KEY, driverIntelSettleMs);
        saveParticipantScanRepeat_();
        saveIntSetting_(STORE_FOCUSED_ROW_WINDOW_EACH_SIDE_KEY, focusedRowWindowEachSide);
    }
    function applyPerformancePreset_(presetKey, persist = true) {
        const preset = PERFORMANCE_PRESETS[presetKey];
        if (!preset) return false;
        performancePreset = presetKey;
        visibleRaceScanMs = preset.visibleRaceScanMs;
        participantScanMs = preset.participantScanMs;
        driverIdLookupMs = preset.driverIdLookupMs;
        driverIntelSettleMs = preset.driverIntelSettleMs;
        participantScanRepeat = preset.participantScanRepeat;
        focusedRowWindowEachSide = preset.focusWindowEachSide;
        if (persist) savePerformanceTuning_();
        resetScanCaches_();
        return true;
    }
    function loadSmoothing_() {
        const v = Number(GM_getValue(STORE_SMOOTHING_KEY, 3));
        return [1, 2, 3, 5].includes(v) ? v : 3;
    }
    function saveSmoothing_() { GM_setValue(STORE_SMOOTHING_KEY, telemetrySmoothing); }
    function loadAnalysisMode_() {
        const v = String(GM_getValue(STORE_MODE_KEY, "gaps") || "gaps");
        if (v === "accel") return "gyro";
        return ["laprec", "gaps", "sectors", "speed", "pace", "gyro", "summary", "driver", "predictions"].includes(v) ? v : "gaps";
    }
    function saveAnalysisMode_() { GM_setValue(STORE_MODE_KEY, analysisMode); }
    function loadDebug_() { return loadBoolSetting_(STORE_DEBUG_KEY, false); }
    function saveDebug_() { saveBoolSetting_(STORE_DEBUG_KEY, debugEnabled); }
    function loadApiKey_() { return String(GM_getValue(STORE_API_KEY_KEY, "") || "").trim(); }
    function saveApiKey_() { GM_setValue(STORE_API_KEY_KEY, String(apiKey || "").trim()); }
    function loadApiKeyInfo_() {
        const data = loadJson_(STORE_API_KEY_INFO_KEY, {});
        return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    }
    function saveApiKeyInfo_() { saveJson_(STORE_API_KEY_INFO_KEY, apiKeyInfo || {}); }
    function loadDriverIntelCache_() {
        const data = loadJson_(STORE_DRIVER_INTEL_CACHE_KEY, {});
        return normalizeDriverIntelCache_(data && typeof data === "object" && !Array.isArray(data) ? data : {});
    }
    function saveDriverIntelCache_() {
        driverIntelCache = normalizeDriverIntelCache_(driverIntelCache || {});
        saveJson_(STORE_DRIVER_INTEL_CACHE_KEY, driverIntelCache || {});
    }
    function loadDriverHistory_() {
        const data = loadJson_(STORE_DRIVER_HISTORY_KEY, {});
        return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    }
    function saveDriverHistory_() { saveJson_(STORE_DRIVER_HISTORY_KEY, driverHistory || {}); }
    function loadFuelStyle_() {
        const v = String(GM_getValue(STORE_FUEL_STYLE_KEY, "l100km") || "l100km");
        return ["l100km", "mpg_us", "mpg_uk"].includes(v) ? v : "l100km";
    }
    function saveFuelStyle_() { GM_setValue(STORE_FUEL_STYLE_KEY, fuelDisplayStyle); }

    const OG_CAR_KEYS = Object.keys(OG_CAR_REPLACEMENTS).sort((a, b) => b.length - a.length);
    const OG_CAR_REGEX = new RegExp(OG_CAR_KEYS.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
    function toOgCarName_(name) {
        const s = String(name || "").trim();
        if (!s) return "";
        OG_CAR_REGEX.lastIndex = 0;
        if (!OG_CAR_REGEX.test(s)) return s;
        OG_CAR_REGEX.lastIndex = 0;
        return s.replace(OG_CAR_REGEX, m => OG_CAR_REPLACEMENTS[m] || m);
    }

    /* ============================
   * TIME / FORMAT HELPERS
   * ============================ */
    const nowIso_ = () => new Date().toISOString();

    function makeRaceMetaKey_(track, car, raceId, detectedAtIso) {
        const rid = String(raceId || "").trim();
        const seen = String(detectedAtIso || "").trim();
        const racePart = rid ? `race:${rid}` : `seen:${seen || nowIso_()}`;
        return `${racePart}__${track || "UnknownTrack"}__${car || "Replay"}`;
    }

    function normalizeDriverName_(name) {
        return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
    }

    function currentDriverName_() {
        return String(spectateName || playerName || raceMeta?.driver || "").trim();
    }

    function currentDriverId_() {
        return String(spectateDriverId_ || playerId || raceMeta?.driverId || "").trim();
    }

    function tabIsFocused_() {
        try {
            if (document.visibilityState !== "visible") return false;
            if (typeof document.hasFocus === "function" && !document.hasFocus()) return false;
            return true;
        } catch {
            return false;
        }
    }

    function canScanTornPage_() {
        return tabIsFocused_();
    }

    function ensurePlayer_() {
        const user = latestRaceDataPayload?.user || analysis?.payload?.user || {};
        const nextId = String(user.userID || user.userId || user.id || "").trim();
        const nextName = String(user.playername || user.playerName || user.name || "").trim();
        let changed = false;
        if (nextId && nextId !== playerId) {
            playerId = nextId;
            changed = true;
        }
        if (nextName && nextName !== playerName) {
            playerName = nextName;
            changed = true;
        }
        if (changed) {
            uiDirty = true;
            scheduleRender_();
        }
        return true;
    }
    function resetForRaceChange_(newRaceId) {
        disconnectJoinRaceObserver_();
        prepareNewRaceUi_();
        const nextRaceId = String(newRaceId || "").trim();
        const priorMeta = raceMeta ? { ...raceMeta, replayInfo: { ...(raceMeta.replayInfo || {}) } } : null;
        let visibleTrack = "";
        try {
            visibleTrack = canScanTornPage_() ? visibleRaceTrackName_() : "";
        } catch {}
        latestRaceDataPayload = null;
        raceDataReceivedPerfMs = 0;
        raceDataCurrentTimeAtReceive = NaN;
        analysis = null;
        analysisFocusMode = "auto";
        analysisFocusDriverId = "";
        analysisFocusDriverName = "";
        lastHeavyRaceStats = { heavyRace: false, estimatedPoints: 0, drivers: 0, laps: 0, intervals: 0 };
        heavyRaceOverrideRaceKey = "";
        heavyRaceShowAllDrivers = false;
        heavyRaceFullCardsEnabled = false;
        directCurrentRaceId = "";
        preRaceParticipants = [];
        directRacingDataParticipants = [];
        directRacingDataParticipantsKey = "";
        raceDataVisibleMatchCache = { key: "", at: 0, valid: false };
        preRaceParticipantsKey = "";
        resetScanCaches_();
        driverIntelAutoRaceKey = "";
        clearedRaceDataKey = "";
        finalAnalysisNotifiedForRaceId = "";
        recordsUpdatedForAnalysisRaceId = "";
        pgPlayerCachedRaceKeys = new Set();
        raceOvertakesCache = { key: "", value: 0 };
        raceOvertakesFloorCache = { key: "", value: 0 };
        fuelSessionCache = { key: "", liters: 0, levelPct: 100 };
        markDirty_({ data: true, layout: true, status: true, selection: true });

        clearRaceMeta_();
        if (nextRaceId && priorMeta) {
            const detectedAtIso = nowIso_();
            raceMeta = {
                ...priorMeta,
                raceId: nextRaceId,
                track: visibleTrack || priorMeta.track || "",
                totalTime: "",
                endAtIso: "",
                countdown: "",
                detectedAtIso,
                detectedAtLocal: formatLocalDateTime_(new Date()),
                metaKey: makeRaceMetaKey_(visibleTrack || priorMeta.track || "UnknownTrack", "JSON", nextRaceId, detectedAtIso)
            };
            saveRaceMeta_(raceMeta);
        }
        saveLastRaceId_(nextRaceId);
        pendingRaceChangeId = "";
        pendingRaceChangeAt = 0;

        uiDirty = true;
        scheduleRender_();
    }
    function bestRaceAtIso_() {
        const payload = latestRaceDataPayload || analysis?.payload || null;
        const log = extractRaceLogData_(payload);
        const started = toIsoFromAt_(log.timeStarted || log.TimeStarted || "");
        if (started) return started;
        const td = payload?.timeData || {};
        const tdStarted = unixToIso_(td.timeStarted);
        if (tdStarted) return tdStarted;
        if (raceMeta) {
            const cand =
                  raceMeta.startAtIso ||
                  raceMeta.raceAtIso ||
                  raceMeta.detectedAtIso ||
                  raceMeta.createdAtIso ||
                  "";
            if (cand) return String(cand);
        }

        return nowIso_();
    }

    function pad2_(n) { return String(n).padStart(2, "0"); }

    function formatLocalStamp_(d) {
        const yy = String(d.getFullYear()).slice(-2);
        const mm = pad2_(d.getMonth() + 1);
        const dd = pad2_(d.getDate());
        const HH = pad2_(d.getHours());
        const MM = pad2_(d.getMinutes());
        return `${yy}-${mm}-${dd}.${HH}${MM}`;
    }

    function formatLocalDateTime_(d) {
        const dd = pad2_(d.getDate());
        const mm = pad2_(d.getMonth() + 1);
        const yyyy = d.getFullYear();
        const HH = pad2_(d.getHours());
        const MM = pad2_(d.getMinutes());
        const SS = pad2_(d.getSeconds());
        return `${dd}/${mm}/${yyyy}, ${HH}:${MM}:${SS}`;
    }

    function normalizeTrackLabel_(track) {
        return String(track || "").replace(/\s+/g, " ").trim();
    }

    function stripTrackLapSuffix_(track) {
        const raw = normalizeTrackLabel_(track);
        if (!raw) return "";
        return raw.replace(/\s*-\s*\d+\s+laps?\b\s*$/i, "").trim();
    }

    function makeTrackLookupKey_(track) {
        return normalizeTrackLabel_(track).toLowerCase();
    }

    function parseTrackLabel_(track) {
        const raw = normalizeTrackLabel_(track);
        if (!raw) return { raw: "", baseTrack: "", lapCount: null };
        const m = raw.match(/^(.*?)\s*-\s*(\d+)\s+laps?\b\s*$/i);
        if (!m) return { raw, baseTrack: raw, lapCount: null };
        return {
            raw,
            baseTrack: normalizeTrackLabel_(m[1]),
            lapCount: parseInt(m[2], 10)
        };
    }

    function getOfficialLapCount_(track) {
        const localLaps = pgLocalOfficialLaps_(track);
        if (localLaps) return localLaps;
        const key = makeTrackLookupKey_(track);
        if (key && TRACK_META[key]) return TRACK_META[key].officialLaps;
        return key && Object.prototype.hasOwnProperty.call(OFFICIAL_TRACK_LAPS, key)
            ? OFFICIAL_TRACK_LAPS[key]
            : null;
    }

    function getTrackMeta_(track) {
        const key = makeTrackLookupKey_(stripTrackLapSuffix_(track));
        return key ? (TRACK_META[key] || null) : null;
    }

    function getLapKm_(track) {
        const localKm = pgLocalTrackLapKm_(track);
        if (localKm) return localKm;
        const meta = getTrackMeta_(track);
        return meta ? meta.lapKm : null;
    }

    function formatRaceTrackLabel_(baseTrack, lapCount) {
        const base = normalizeTrackLabel_(baseTrack);
        if (!base) return "";
        if (!(Number.isFinite(lapCount) && lapCount > 0)) return base;
        return `${base} - ${lapCount} Laps`;
    }

    function getRecordTrackScope_(mode, track) {
        const parsed = parseTrackLabel_(track);
        const baseTrack = parsed.baseTrack || stripTrackLapSuffix_(parsed.raw) || parsed.raw;
        if (!baseTrack) return "";
        if (mode === "lap") return baseTrack;

        const officialLaps = getOfficialLapCount_(baseTrack);
        if (parsed.lapCount == null) return baseTrack;
        if (officialLaps != null && parsed.lapCount === officialLaps) return baseTrack;
        return formatRaceTrackLabel_(baseTrack, parsed.lapCount);
    }

    function getRecordTrackScopeFromRow_(row, fallbackMode) {
        if (!row) return "";
        const mode = String(row.mode || fallbackMode || "lap").trim() || "lap";
        const scoped = normalizeTrackLabel_(row.trackKey || "");
        if (scoped) return scoped;
        return getRecordTrackScope_(mode, row.track || row.sourceTrack || "");
    }

    function getRecordRaceTypeFromRow_(row) {
        const value = String(row?.raceType || row?.race_type || row?.type || "").trim().toLowerCase();
        return value === "custom" ? "custom" : "official";
    }

    function recordIsMine_(row) {
        if (!row) return false;
        const id = currentDriverId_();
        const name = normalizeDriverName_(currentDriverName_());
        const rowId = String(row.driverId || row.driver_id || "").trim();
        const rowName = normalizeDriverName_(row.driverName || row.driver_name || "");
        return (!!id && rowId === id) || (!!name && rowName === name);
    }

    function currentRecordsFetchOptions_() {
        return {
            raceType: recordsRaceType === "custom" ? "custom" : "official",
            scope: recordsMineOnly ? "mine" : "global",
            driverId: currentDriverId_(),
            driverName: currentDriverName_()
        };
    }

    function parseCountdownToSeconds_(s) {
        const txt = String(s || "").toLowerCase();
        if (/^\d+(?:\.\d+)?$/.test(txt.trim())) return Math.max(0, Math.floor(Number(txt)));
        const h = (txt.match(/(\d+)\s*hour/) || [])[1];
        const m = (txt.match(/(\d+)\s*minute/) || [])[1];
        const sec = (txt.match(/(\d+)\s*second/) || [])[1];
        const hours = h ? parseInt(h, 10) : 0;
        const mins = m ? parseInt(m, 10) : 0;
        const secs = sec ? parseInt(sec, 10) : 0;
        const total = hours * 3600 + mins * 60 + secs;
        return Number.isFinite(total) ? total : 0;
    }

    function formatShortCountdown_(totalSeconds) {
        totalSeconds = Math.max(0, Math.floor(totalSeconds));
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
        if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
        return `${s}s`;
    }

    function refreshSpectate_() {
        ensurePlayer_();
        const me = (analysis?.drivers || []).find(isUserDriver_) || null;
        let changed = false;
        if (me) {
            if (me.name && me.name !== spectateName) { spectateName = me.name; changed = true; }
            const ogCar = toOgCarName_(me.car || "");
            if (ogCar && ogCar !== spectateCar) { spectateCar = ogCar; changed = true; }
            if (me.carImg && me.carImg !== spectateCarImg) { spectateCarImg = me.carImg; changed = true; }
            if (me.driverId && me.driverId !== spectateDriverId_) { spectateDriverId_ = me.driverId; changed = true; }
        }
        if (raceMeta) {
            if (spectateName) raceMeta.driver = spectateName;
            if (spectateDriverId_) raceMeta.driverId = spectateDriverId_;
            if (spectateCar) raceMeta.car = toOgCarName_(spectateCar);
            if (spectateCarImg) raceMeta.carImg = spectateCarImg;
            saveRaceMeta_(raceMeta);
        }

        if (changed) { uiDirty = true; scheduleRender_(); }
    }
    function raceIsFinished_() {
        const visual = visualRaceProgressState_();
        if (visual.hasProgress) return visual.finished;
        return getRaceContext_() === "replay";
    }

    /* ============================
     * RACE ANALYSIS MODEL
     * ============================ */
    function safeNum_(v, fallback = 0) {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
    }

    function clamp_(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function calibrateLongitudinalG_(value) {
        return Number.isFinite(value) ? value : NaN;
    }

    function calibrateLateralG_(value) {
        return Number.isFinite(value) ? value : NaN;
    }

    function formatTimeSeconds_(sec) {
        if (!Number.isFinite(sec) || sec < 0) return "--";
        const ms = Math.floor((sec * 1000) + 0.5);
        return msToTimeText_(ms, "lap");
    }

    function formatLeadTime_(sec) {
        if (!Number.isFinite(sec) || sec <= 0.0005) return "00:00:00";
        return formatTimeSeconds_(sec);
    }

    function formatGapSeconds_(sec) {
        if (!Number.isFinite(sec)) return "--";
        if (Math.abs(sec) < 0.0005) return "Leader";
        return `+${sec.toFixed(3)}`;
    }

    function formatSpeed_(mps, unit = speedUnit) {
        if (!Number.isFinite(mps) || mps <= 0) return "--";
        const v = unit === "mph" ? mps * 2.2369362921 : mps * 3.6;
        return `${v.toFixed(1)} ${unit === "mph" ? "mph" : "km/h"}`;
    }

    function formatDistanceKm_(km, opts = {}) {
        const n = Number(km);
        if (!Number.isFinite(n) || n <= 0) return "--";
        const perLap = !!opts.perLap;
        if (speedUnit === "mph") {
            const miles = n * 0.621371192237334;
            return `${miles.toFixed(2)} mi${perLap ? "/lap" : ""}`;
        }
        return `${n.toFixed(2)} km${perLap ? "/lap" : ""}`;
    }

    function formatG_(g) {
        if (!Number.isFinite(g)) return "--";
        return `${g >= 0 ? "+" : ""}${g.toFixed(2)}g`;
    }

    function formatDriverRs_(skill) {
        const n = Number(skill);
        return Number.isFinite(n) ? `RS: ${n.toFixed(2)}` : "RS: --";
    }

    function extractProfileImage_(profile) {
        const candidates = [
            profile?.image,
            profile?.profile_image,
            profile?.profileImage,
            profile?.avatar,
            profile?.avatar_url,
            profile?.avatarUrl,
            profile?.images?.profile,
            profile?.images?.large,
            profile?.images?.small,
            profile?.profile?.image
        ];
        return String(candidates.find(v => String(v || "").trim()) || "").trim();
    }

    function statNumber_(...values) {
        for (const v of values) {
            const raw = (v && typeof v === "object")
                ? (v.value ?? v.total ?? v.amount ?? v.count ?? v.current ?? v.stat)
                : v;
            const n = Number(raw);
            if (Number.isFinite(n)) return n;
        }
        return NaN;
    }

    function apiStatKey_(value) {
        return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    function statFrom_(source, keys) {
        const wanted = new Set(keys.map(apiStatKey_));
        const seen = new Set();
        const visit = obj => {
            if (!obj || typeof obj !== "object") return NaN;
            if (seen.has(obj)) return NaN;
            seen.add(obj);
            if (Array.isArray(obj)) {
                for (const item of obj) {
                    const n = visit(item);
                    if (Number.isFinite(n)) return n;
                }
                return NaN;
            }
            const label = apiStatKey_(obj.key ?? obj.name ?? obj.stat ?? obj.title);
            if (wanted.has(label)) {
                const n = statNumber_(obj);
                if (Number.isFinite(n)) return n;
            }
            for (const [key, value] of Object.entries(obj)) {
                if (wanted.has(apiStatKey_(key))) {
                    const n = statNumber_(value);
                    if (Number.isFinite(n)) return n;
                }
            }
            for (const value of Object.values(obj)) {
                const n = visit(value);
                if (Number.isFinite(n)) return n;
            }
            return NaN;
        };
        return visit(source);
    }

    function normalizeDriverIntel_(driverId, data) {
        const root = data?.data || data || {};
        const profile = root?.profile || root || {};
        const psRoot = root?.personalstats || profile?.personalstats || {};
        const racingRoot = psRoot?.racing || profile?.racing || root?.racing || {};
        const racingRaces = racingRoot?.races || psRoot?.races || profile?.races || root?.races || {};
        const ps = Object.assign({}, psRoot, racingRoot, psRoot?.racing_stats || {});
        const racingSkill = statNumber_(profile.racinglevel, profile.racing_skill, profile.racingSkill, racingRoot.skill, ps.racingskill, ps.racing_skill, statFrom_(root, ["racingskill", "racing_skill", "racingSkill", "racinglevel"]));
        const racesEntered = statNumber_(racingRaces.entered, ps.racesentered, ps.races_entered, ps.racingraces, profile.racesEntered, statFrom_(root, ["racesentered", "races_entered", "racingraces"]));
        const racesWon = statNumber_(racingRaces.won, racingRaces.wins, ps.raceswon, ps.races_won, ps.racingwins, profile.racesWon, statFrom_(root, ["raceswon", "races_won", "racingwins", "won", "wins"]));
        const racingPointsEarned = statNumber_(profile.pointsearned, profile.racingpoints, racingRoot.points, ps.racingpointsearned, ps.racing_points_earned, statFrom_(root, ["racingpointsearned", "racing_points_earned", "racingpoints", "pointsearned"]));
        const winRate = Number.isFinite(racesWon) && Number.isFinite(racesEntered) && racesEntered > 0
            ? racesWon / racesEntered
            : safeNum_(profile.winsLossRatio, NaN) / 100;
        return {
            driverId: String(profile.id || profile.player_id || profile.playerId || profile.user_id || profile.userID || profile.userid || root.player_id || root.playerId || root.user_id || root.userID || driverId || ""),
            name: String(profile.name || profile.playername || ""),
            level: safeNum_(profile.level, NaN),
            rank: String(profile.rank || ""),
            title: String(profile.title || ""),
            avatar: extractProfileImage_(profile),
            avatarCheckedAt: Date.now(),
            status: profile.status || null,
            racingSkill,
            racingPointsEarned,
            racesEntered,
            racesWon,
            winRate: Number.isFinite(winRate) ? clamp_(winRate, 0, 1) : NaN,
            fetchedAt: Date.now()
        };
    }

    function driverIntelCanonicalId_(key, intel) {
        const fromIntel = String(intel?.driverId || intel?.id || intel?.userID || intel?.userId || "").trim();
        if (fromIntel) return fromIntel;
        const rawKey = String(key || "").trim();
        if (!rawKey || rawKey.startsWith("name:")) return "";
        return rawKey;
    }

    function mergeDriverIntelEntries_(current, next, canonicalId = "") {
        const base = (current && !current.__mpgAlias && typeof current === "object") ? current : {};
        const incoming = (next && typeof next === "object") ? next : {};
        const merged = { ...base, ...incoming };
        if (canonicalId) merged.driverId = canonicalId;
        return merged;
    }

    function driverIntelAlias_(target) {
        return { __mpgAlias: String(target || "").trim() };
    }

    function resolveDriverIntelAlias_(entry, seen = new Set()) {
        if (!entry || typeof entry !== "object") return null;
        if (!entry.__mpgAlias) return entry;
        const target = String(entry.__mpgAlias || "").trim();
        if (!target || seen.has(target)) return null;
        seen.add(target);
        return resolveDriverIntelAlias_(driverIntelCache?.[target], seen);
    }

    function normalizeDriverIntelCache_(cache) {
        const source = cache && typeof cache === "object" && !Array.isArray(cache) ? cache : {};
        const normalized = {};
        for (const [key, value] of Object.entries(source)) {
            if (!value || typeof value !== "object") continue;
            if (value.__mpgAlias) continue;
            const canonical = driverIntelCanonicalId_(key, value);
            if (!canonical) {
                normalized[key] = mergeDriverIntelEntries_(normalized[key], value, "");
                continue;
            }
            normalized[canonical] = mergeDriverIntelEntries_(normalized[canonical], value, canonical);
        }
        for (const [key, value] of Object.entries(source)) {
            if (!value || typeof value !== "object") continue;
            const canonical = driverIntelCanonicalId_(key, value);
            if (canonical && key !== canonical) normalized[key] = driverIntelAlias_(canonical);
            const nameKey = driverIntelNameKey_(value.name);
            if (canonical && nameKey) normalized[nameKey] = driverIntelAlias_(canonical);
            if (value.__mpgAlias && normalized[value.__mpgAlias] && key !== value.__mpgAlias) normalized[key] = driverIntelAlias_(value.__mpgAlias);
        }
        return normalized;
    }

    function getCachedDriverIntel_(driverId, maxAgeHours = 24 * 7) {
        const id = String(driverId || "").trim();
        if (!id) return null;
        const cached = resolveDriverIntelAlias_(driverIntelCache?.[id]);
        if (!cached || !cached.fetchedAt) return null;
        if ((Date.now() - Number(cached.fetchedAt)) > maxAgeHours * 3600 * 1000) return null;
        return cached;
    }

    function driverIntelNameKey_(name) {
        const n = normalizeDriverName_(name || "");
        return n ? `name:${n}` : "";
    }

    function cacheDriverIntel_(key, intel) {
        if (!intel) return;
        const idKey = String(key || "").trim();
        const canonical = driverIntelCanonicalId_(idKey, intel);
        if (canonical) {
            const merged = mergeDriverIntelEntries_(resolveDriverIntelAlias_(driverIntelCache[canonical]), intel, canonical);
            driverIntelCache[canonical] = merged;
            if (idKey && idKey !== canonical) driverIntelCache[idKey] = driverIntelAlias_(canonical);
            if (intel.driverId && String(intel.driverId) !== canonical) driverIntelCache[String(intel.driverId)] = driverIntelAlias_(canonical);
            const nameKey = driverIntelNameKey_(merged.name || intel.name);
            if (nameKey) driverIntelCache[nameKey] = driverIntelAlias_(canonical);
            return;
        }
        if (idKey) driverIntelCache[idKey] = mergeDriverIntelEntries_(driverIntelCache[idKey], intel, "");
        const nameKey = driverIntelNameKey_(intel.name);
        if (nameKey && nameKey !== idKey) driverIntelCache[nameKey] = idKey ? driverIntelAlias_(idKey) : intel;
    }

    function getCachedDriverIntelByName_(name, maxAgeHours = 24 * 7) {
        const key = driverIntelNameKey_(name);
        if (key) {
            const direct = getCachedDriverIntel_(key, maxAgeHours);
            if (direct) return direct;
        }
        const nn = normalizeDriverName_(name || "");
        if (!nn) return null;
        for (const entry of Object.values(driverIntelCache || {})) {
            const intel = resolveDriverIntelAlias_(entry);
            if (!intel?.fetchedAt || (Date.now() - Number(intel.fetchedAt)) > maxAgeHours * 3600 * 1000) continue;
            if (normalizeDriverName_(intel.name || "") === nn) return intel;
        }
        return null;
    }

    function getDriverIntelForDriver_(d, maxAgeHours = 24 * 7) {
        if (!d) return null;
        return getCachedDriverIntel_(d.driverId, maxAgeHours)
            || (isUserDriver_(d) ? getCachedDriverIntel_("self", maxAgeHours) : null)
            || getCachedDriverIntelByName_(d.name, maxAgeHours);
    }

    function driverIntelNeedsProfileRefresh_(driverId, name) {
        const cached = getCachedDriverIntel_(driverId, 24 * 7) || getCachedDriverIntelByName_(name, 24 * 7);
        if (!cached) return true;
        const fetchedAt = Number(cached.fetchedAt || 0);
        return !fetchedAt || (Date.now() - fetchedAt) > 7 * 24 * 3600 * 1000;
    }

    function driverIntelIsFresh_(intel) {
        const fetchedAt = Number(intel?.fetchedAt || 0);
        return !!intel && !!fetchedAt && (Date.now() - fetchedAt) <= 7 * 24 * 3600 * 1000;
    }

    function applyDriverIntelToModel_() {
        if (!analysis?.drivers?.length) return;
        let changed = false;
        for (const d of analysis.drivers) {
            const intel = getDriverIntelForDriver_(d);
            if (!intel) continue;
            if (d.driverIntel !== intel) {
                d.driverIntel = intel;
                changed = true;
            }
            if (!String(d.driverId || "").trim() && String(intel.driverId || "").trim() && intel.driverId !== "self") {
                d.driverId = String(intel.driverId);
                changed = true;
            }
            if (!Number.isFinite(d.racingSkill) && Number.isFinite(intel.racingSkill)) {
                d.racingSkill = intel.racingSkill;
                changed = true;
            }
        }
        if (changed) {
            const body = document.getElementById("mpgAnalysisBody");
            if (body) body.dataset.renderKey = "";
        }
    }

    function isoFromMs_(ms) {
        const n = Number(ms);
        return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : "";
    }

    function pgDriverProfilePayloadFromIntel_(intel, fallback = {}) {
        if (!intel) return null;
        const driverId = String(intel.driverId || fallback.driverId || "").trim();
        if (!driverId || driverId === "self") return null;
        return {
            driverId,
            driverName: intel.name || fallback.name || "",
            avatarUrl: intel.avatar || intel.image || "",
            level: Number.isFinite(intel.level) ? intel.level : null,
            rank: intel.rank || "",
            title: intel.title || "",
            racingSkill: Number.isFinite(intel.racingSkill) ? intel.racingSkill : null,
            racingPointsEarned: Number.isFinite(intel.racingPointsEarned) ? intel.racingPointsEarned : null,
            racesEntered: Number.isFinite(intel.racesEntered) ? intel.racesEntered : null,
            racesWon: Number.isFinite(intel.racesWon) ? intel.racesWon : null,
            winRate: Number.isFinite(intel.winRate) ? intel.winRate : null,
            fetchedAtIso: isoFromMs_(intel.fetchedAt)
        };
    }

    async function pgLocalUpsertDriverIntel_(items, silent = true) {
        const drivers = (Array.isArray(items) ? items : [items])
            .map(item => item?.avatarUrl != null || item?.driverName != null || item?.fetchedAtIso != null ? item : pgDriverProfilePayloadFromIntel_(item))
            .filter(d => d && String(d.driverId || "").trim());
        if (!drivers.length) return null;
        try {
            return await pgLocalUpsertDrivers(drivers);
        } catch (e) {
            if (!silent) throw e;
            if (debugEnabled) console.warn(TAG, "local driver profile upsert failed", e);
            return null;
        }
    }

    function pgLocalSyncDriverIntelCache_() {
        const seen = new Set();
        const profiles = [];
        for (const intel of Object.values(driverIntelCache || {})) {
            const profile = pgDriverProfilePayloadFromIntel_(intel);
            const id = String(profile?.driverId || "").trim();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            profiles.push(profile);
        }
        if (profiles.length) pgLocalUpsertDriverIntel_(profiles).catch(() => {});
    }

    function msFromIsoLike_(value) {
        const t = Date.parse(String(value || ""));
        return Number.isFinite(t) ? t : 0;
    }

    function pgLocalDriverIntelFromProfile_(entry, fallback = {}) {
        const profile = entry?.profile || entry || {};
        const driverId = String(
            profile.driver_id || profile.driverId || profile.id || entry?.driverId || fallback.driverId || ""
        ).trim();
        if (!driverId) return null;
        const fetchedAt = msFromIsoLike_(
            profile.last_profile_fetch_at || profile.updated_at || profile.created_at || entry?.updatedAt || entry?.fetchedAtIso
        ) || Date.now();
        return {
            driverId,
            name: String(profile.display_name || profile.last_seen_name || entry?.name || fallback.name || ""),
            level: safeNum_(profile.level, NaN),
            rank: String(profile.rank || ""),
            title: String(profile.title || ""),
            avatar: String(profile.avatar_url || profile.avatarUrl || profile.avatar || ""),
            avatarCheckedAt: fetchedAt,
            status: null,
            racingSkill: statNumber_(profile.racing_skill, profile.racingSkill),
            racingPointsEarned: statNumber_(profile.racing_points_earned, profile.racingPointsEarned),
            racesEntered: statNumber_(profile.races_entered, profile.racesEntered),
            racesWon: statNumber_(profile.races_won, profile.racesWon),
            winRate: statNumber_(profile.win_rate, profile.winRate),
            fetchedAt
        };
    }

    function extractRaceIdFromPayloadOrUrl_(payload) {
        if (payload?.__mpgIgnoreRaceId) return String(urlRaceId_() || "").trim();
        return String(payload?.raceID || payload?.raceId || payload?.id || getRaceId_() || "").trim();
    }

    function directRaceIdFromPayload_(payload) {
        const p = getRacePayload_(payload) || payload || {};
        if (p?.__mpgIgnoreRaceId) return "";
        return String(p?.raceID || p?.raceId || p?.id || "").trim();
    }

    function raceDataPayloadKey_(payload) {
        const p = getRacePayload_(payload) || payload || {};
        const raceId = p?.__mpgIgnoreRaceId ? "" : String(p?.raceID || p?.raceId || p?.id || "").trim();
        if (raceId) return `race:${raceId}`;
        const cars = p?.cars || p?.raceData?.cars || {};
        const drivers = Object.keys(cars || {}).sort().join(",");
        return `shape:${extractTrackNameFromPayloadOrMeta_(p)}:${extractLapsFromPayloadOrUi_(p)}:${drivers}`;
    }

    function stableSignatureValue_(value) {
        if (Array.isArray(value)) return value.map(stableSignatureValue_);
        if (value && typeof value === "object") {
            return Object.keys(value).sort().reduce((out, key) => {
                out[key] = stableSignatureValue_(value[key]);
                return out;
            }, {});
        }
        return value;
    }

    function raceDataStaticSignature_(payload) {
        const p = getRacePayload_(payload) || payload || {};
        const cars = p?.cars || p?.raceData?.cars || {};
        const trackData = p?.trackData || p?.raceData?.trackData || {};
        const laps = extractLapsFromPayloadOrUi_(p);
        return hash32_(JSON.stringify({
            laps,
            trackData: stableSignatureValue_(trackData),
            cars: stableSignatureValue_(cars)
        }));
    }

    function bigRaceCacheIdentity_(payload) {
        const p = getRacePayload_(payload) || payload || {};
        const signature = raceDataStaticSignature_(p);
        const raceId = directRaceIdFromPayload_(p) || extractRaceIdFromPayloadOrUrl_(p) || raceDataPayloadKey_(p);
        const heavy = heavyRaceStatsFromPayload_(p);
        return {
            key: `${raceId || "race"}:${signature}`,
            raceId: String(raceId || "").trim(),
            signature,
            heavy
        };
    }

    function persistBigRaceRawPayload_(raw) {
        const p = getRacePayload_(raw) || raw || {};
        if (!p?.cars) return false;
        const identity = bigRaceCacheIdentity_(p);
        if (!identity.heavy.heavyRace || !identity.key || bigRaceRawStoredKeys.has(identity.key)) return false;
        bigRaceRawStoredKeys.add(identity.key);
        (async () => {
            const existing = await bigRaceIdbGet_(BIG_RACE_RAW_STORE, identity.key);
            if (existing?.payload) return true;
            return await bigRaceIdbPut_(BIG_RACE_RAW_STORE, {
                key: identity.key,
                raceId: identity.raceId,
                signature: identity.signature,
                storedAt: Date.now(),
                estimatedPoints: identity.heavy.estimatedPoints || 0,
                payload: raw || p
            });
        })().then(ok => {
            if (ok) {
                bigRaceCacheStatus.rawStored += 1;
                if (bigRaceObservationShouldPause_()) disconnectJoinRaceObserver_();
            } else {
                bigRaceRawStoredKeys.delete(identity.key);
            }
            markDirty_({ status: true });
            scheduleRender_();
        }).catch(error => {
            bigRaceRawStoredKeys.delete(identity.key);
            bigRaceCacheStatus.lastError = String(error?.message || error || "raw cache failed");
        });
        return true;
    }

    function finiteSummaryNumber_(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function processedSummaryInputFromAnalysis_(model) {
        if (!model?.drivers?.length) return null;
        const identity = model.bigRaceCacheKey
            ? { key: model.bigRaceCacheKey, raceId: model.raceId || "", signature: model.bigRaceStaticSignature || "", heavy: model.heavyRaceStats || {} }
            : bigRaceCacheIdentity_(model.payload);
        return {
            version: 1,
            key: identity.key,
            raceId: String(model.raceId || identity.raceId || "").trim(),
            signature: identity.signature || model.bigRaceStaticSignature || "",
            estimatedPoints: Number(model.heavyRaceStats?.estimatedPoints || identity.heavy?.estimatedPoints || 0),
            meta: {
                trackName: model.trackName || "",
                trackKey: model.trackKey || "",
                laps: Number(model.laps || 0),
                segmentsPerLap: Number(model.segmentsPerLap || 0),
                drivers: model.drivers.length
            },
            drivers: model.drivers.map((d, index) => ({
                driverId: String(d.driverId || d.engineKey || normalizeDriverName_(d.name || "") || `driver-${index + 1}`),
                name: String(d.name || ""),
                car: toOgCarName_(d.car || ""),
                racingSkill: finiteSummaryNumber_(d.racingSkill),
                startPosition: finiteSummaryNumber_(d.startPosition || index + 1),
                finalTime: finiteSummaryNumber_(d.finalTime),
                crashed: !!d.crashed,
                completedFullLaps: finiteSummaryNumber_(d.completedFullLaps),
                bestLapSeconds: finiteSummaryNumber_(d.bestLapSeconds),
                averageLapSeconds: finiteSummaryNumber_(d.averageLapSeconds),
                idealLapSeconds: finiteSummaryNumber_(d.idealLapSeconds),
                consistencyScore: finiteSummaryNumber_(d.consistencyScore),
                topSpeedMps: finiteSummaryNumber_(d.topSpeedMps),
                sectorsWon: finiteSummaryNumber_(d.sectorsWon),
                lapsLed: finiteSummaryNumber_(d.lapsLed),
                segmentsLed: finiteSummaryNumber_(d.segmentsLed),
                timeInLeadSeconds: finiteSummaryNumber_(d.timeInLeadSeconds),
                leadChanges: finiteSummaryNumber_(d.leadChanges),
                lapTotals: (d.validLapTimes || []).map(lap => ({
                    lap: Number(lap.lap || 0),
                    seconds: finiteSummaryNumber_(lap.seconds)
                })).filter(lap => lap.lap > 0 && lap.seconds != null),
                sectorTimes: (d.sectorTimes || []).map(sec => ({
                    sector: Number(sec.sector || 0),
                    lap: Number(sec.lap || 0),
                    seconds: finiteSummaryNumber_(sec.seconds)
                })).filter(sec => sec.sector > 0 && sec.seconds != null)
            }))
        };
    }

    function buildProcessedSummarySync_(input) {
        const finite = value => {
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
        };
        const average = values => {
            const nums = values.map(Number).filter(Number.isFinite);
            return nums.length ? nums.reduce((sum, n) => sum + n, 0) / nums.length : null;
        };
        const sectorSummaries = times => [1, 2, 3].map(sector => {
            const values = (times || []).filter(x => Number(x.sector) === sector).map(x => Number(x.seconds)).filter(Number.isFinite);
            return {
                sector,
                count: values.length,
                bestSeconds: values.length ? Math.min(...values) : null,
                averageSeconds: values.length ? average(values) : null
            };
        });
        const drivers = (input?.drivers || []).map((d, index) => ({ ...d, inputIndex: index }));
        const finalOrder = drivers.slice().sort((a, b) => {
            if (!!a.crashed !== !!b.crashed) return a.crashed ? 1 : -1;
            const af = Number.isFinite(Number(a.finalTime)) ? Number(a.finalTime) : Infinity;
            const bf = Number.isFinite(Number(b.finalTime)) ? Number(b.finalTime) : Infinity;
            if (af !== bf) return af - bf;
            const as = Number.isFinite(Number(a.startPosition)) ? Number(a.startPosition) : a.inputIndex + 1;
            const bs = Number.isFinite(Number(b.startPosition)) ? Number(b.startPosition) : b.inputIndex + 1;
            return as - bs;
        });
        const positionById = new Map();
        finalOrder.forEach((d, index) => positionById.set(String(d.driverId || d.inputIndex), index + 1));
        const leader = finalOrder.find(d => !d.crashed && Number.isFinite(Number(d.finalTime))) || null;
        const leaderTime = Number(leader?.finalTime);
        const aheadById = new Map();
        for (let i = 0; i < finalOrder.length; i++) {
            const current = finalOrder[i];
            const ahead = i > 0 ? finalOrder[i - 1] : null;
            aheadById.set(String(current.driverId || current.inputIndex), ahead);
        }
        return {
            version: 1,
            key: input?.key || "",
            raceId: input?.raceId || "",
            signature: input?.signature || "",
            estimatedPoints: Number(input?.estimatedPoints || 0),
            generatedAt: Date.now(),
            meta: input?.meta || {},
            drivers: drivers.map(d => {
                const id = String(d.driverId || d.inputIndex);
                const finalPosition = positionById.get(id) || null;
                const startPosition = finite(d.startPosition);
                const finalTime = finite(d.finalTime);
                const ahead = aheadById.get(id);
                const aheadTime = finite(ahead?.finalTime);
                return {
                    driverId: d.driverId,
                    name: d.name,
                    car: d.car,
                    racingSkill: finite(d.racingSkill),
                    startPosition,
                    finalPosition,
                    positionChange: startPosition && finalPosition ? startPosition - finalPosition : null,
                    finalTime,
                    crashed: !!d.crashed,
                    completedFullLaps: finite(d.completedFullLaps),
                    bestLapSeconds: finite(d.bestLapSeconds),
                    averageLapSeconds: finite(d.averageLapSeconds),
                    idealLapSeconds: finite(d.idealLapSeconds),
                    consistencyScore: finite(d.consistencyScore),
                    topSpeedMps: finite(d.topSpeedMps),
                    lapTotals: d.lapTotals || [],
                    sectorSummaries: sectorSummaries(d.sectorTimes || []),
                    gapSummary: {
                        toLeaderSeconds: (!d.crashed && Number.isFinite(finalTime) && Number.isFinite(leaderTime)) ? finalTime - leaderTime : null,
                        aheadSeconds: (!d.crashed && ahead && !ahead.crashed && Number.isFinite(finalTime) && Number.isFinite(aheadTime)) ? finalTime - aheadTime : null
                    },
                    sectorsWon: finite(d.sectorsWon),
                    lapsLed: finite(d.lapsLed),
                    segmentsLed: finite(d.segmentsLed),
                    timeInLeadSeconds: finite(d.timeInLeadSeconds),
                    leadChanges: finite(d.leadChanges)
                };
            })
        };
    }

    function buildProcessedSummaryWorkerSource_() {
        return `"use strict";\nconst finite=value=>{const n=Number(value);return Number.isFinite(n)?n:null;};\nconst average=values=>{const nums=values.map(Number).filter(Number.isFinite);return nums.length?nums.reduce((sum,n)=>sum+n,0)/nums.length:null;};\nconst sectorSummaries=times=>[1,2,3].map(sector=>{const values=(times||[]).filter(x=>Number(x.sector)===sector).map(x=>Number(x.seconds)).filter(Number.isFinite);return{sector,count:values.length,bestSeconds:values.length?Math.min(...values):null,averageSeconds:values.length?average(values):null};});\nfunction build(input){const drivers=(input&&input.drivers||[]).map((d,index)=>Object.assign({},d,{inputIndex:index}));const finalOrder=drivers.slice().sort((a,b)=>{if(!!a.crashed!==!!b.crashed)return a.crashed?1:-1;const af=Number.isFinite(Number(a.finalTime))?Number(a.finalTime):Infinity;const bf=Number.isFinite(Number(b.finalTime))?Number(b.finalTime):Infinity;if(af!==bf)return af-bf;const as=Number.isFinite(Number(a.startPosition))?Number(a.startPosition):a.inputIndex+1;const bs=Number.isFinite(Number(b.startPosition))?Number(b.startPosition):b.inputIndex+1;return as-bs;});const positionById=new Map();finalOrder.forEach((d,index)=>positionById.set(String(d.driverId||d.inputIndex),index+1));const leader=finalOrder.find(d=>!d.crashed&&Number.isFinite(Number(d.finalTime)))||null;const leaderTime=Number(leader&&leader.finalTime);const aheadById=new Map();for(let i=0;i<finalOrder.length;i++){aheadById.set(String(finalOrder[i].driverId||finalOrder[i].inputIndex),i>0?finalOrder[i-1]:null);}return{version:1,key:input&&input.key||"",raceId:input&&input.raceId||"",signature:input&&input.signature||"",estimatedPoints:Number(input&&input.estimatedPoints||0),generatedAt:Date.now(),meta:input&&input.meta||{},drivers:drivers.map(d=>{const id=String(d.driverId||d.inputIndex);const finalPosition=positionById.get(id)||null;const startPosition=finite(d.startPosition);const finalTime=finite(d.finalTime);const ahead=aheadById.get(id);const aheadTime=finite(ahead&&ahead.finalTime);return{driverId:d.driverId,name:d.name,car:d.car,racingSkill:finite(d.racingSkill),startPosition,finalPosition,positionChange:startPosition&&finalPosition?startPosition-finalPosition:null,finalTime,crashed:!!d.crashed,completedFullLaps:finite(d.completedFullLaps),bestLapSeconds:finite(d.bestLapSeconds),averageLapSeconds:finite(d.averageLapSeconds),idealLapSeconds:finite(d.idealLapSeconds),consistencyScore:finite(d.consistencyScore),topSpeedMps:finite(d.topSpeedMps),lapTotals:d.lapTotals||[],sectorSummaries:sectorSummaries(d.sectorTimes||[]),gapSummary:{toLeaderSeconds:!d.crashed&&Number.isFinite(finalTime)&&Number.isFinite(leaderTime)?finalTime-leaderTime:null,aheadSeconds:!d.crashed&&ahead&&!ahead.crashed&&Number.isFinite(finalTime)&&Number.isFinite(aheadTime)?finalTime-aheadTime:null},sectorsWon:finite(d.sectorsWon),lapsLed:finite(d.lapsLed),segmentsLed:finite(d.segmentsLed),timeInLeadSeconds:finite(d.timeInLeadSeconds),leadChanges:finite(d.leadChanges)};})};}\nself.onmessage=event=>{try{self.postMessage({ok:true,summary:build(event.data)});}catch(error){self.postMessage({ok:false,error:String(error&&error.message||error||"worker failed")});}};`;
    }

    function buildProcessedSummaryWithWorker_(input) {
        if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
            return Promise.resolve(buildProcessedSummarySync_(input));
        }
        return new Promise(resolve => {
            let worker = null;
            let url = "";
            let done = false;
            const finish = summary => {
                if (done) return;
                done = true;
                try { if (worker) worker.terminate(); } catch {}
                try { if (url) URL.revokeObjectURL(url); } catch {}
                resolve(summary || buildProcessedSummarySync_(input));
            };
            try {
                url = URL.createObjectURL(new Blob([buildProcessedSummaryWorkerSource_()], { type: "text/javascript" }));
                worker = new Worker(url);
                const timer = setTimeout(() => finish(null), 4000);
                worker.onmessage = event => {
                    clearTimeout(timer);
                    if (event.data?.ok && event.data.summary) {
                        bigRaceCacheStatus.workerUsed = true;
                        finish(event.data.summary);
                    } else {
                        bigRaceCacheStatus.lastError = String(event.data?.error || "summary worker failed");
                        finish(null);
                    }
                };
                worker.onerror = error => {
                    clearTimeout(timer);
                    bigRaceCacheStatus.lastError = String(error?.message || error || "summary worker failed");
                    finish(null);
                };
                worker.postMessage(input);
            } catch (error) {
                bigRaceCacheStatus.lastError = String(error?.message || error || "summary worker unavailable");
                finish(null);
            }
        });
    }

    function persistBigRaceProcessedSummary_(model) {
        if (!model?.heavyRace || !model?.drivers?.length) return false;
        const identity = model.bigRaceCacheKey
            ? { key: model.bigRaceCacheKey, raceId: model.raceId || "", signature: model.bigRaceStaticSignature || "", heavy: model.heavyRaceStats || {} }
            : bigRaceCacheIdentity_(model.payload);
        if (!identity.key) return false;
        const cached = bigRaceProcessedSummaryCache.get(identity.key);
        if (cached) {
            model.processedSummary = cached;
            return true;
        }
        if (bigRaceSummaryStoredKeys.has(identity.key) || bigRaceSummaryInFlightKeys.has(identity.key)) return true;
        bigRaceSummaryInFlightKeys.add(identity.key);
        (async () => {
            const stored = await bigRaceIdbGet_(BIG_RACE_SUMMARY_STORE, identity.key);
            if (stored?.summary) {
                bigRaceProcessedSummaryCache.set(identity.key, stored.summary);
                model.processedSummary = stored.summary;
                bigRaceSummaryStoredKeys.add(identity.key);
                return;
            }
            const input = processedSummaryInputFromAnalysis_(model);
            if (!input) return;
            const summary = await buildProcessedSummaryWithWorker_(input);
            bigRaceProcessedSummaryCache.set(identity.key, summary);
            model.processedSummary = summary;
            const ok = await bigRaceIdbPut_(BIG_RACE_SUMMARY_STORE, {
                key: identity.key,
                raceId: identity.raceId || model.raceId || "",
                signature: identity.signature || model.bigRaceStaticSignature || "",
                storedAt: Date.now(),
                estimatedPoints: identity.heavy?.estimatedPoints || model.heavyRaceStats?.estimatedPoints || 0,
                summary
            });
            if (ok) {
                bigRaceSummaryStoredKeys.add(identity.key);
                bigRaceCacheStatus.summaryStored += 1;
            }
        })().catch(error => {
            bigRaceCacheStatus.lastError = String(error?.message || error || "summary cache failed");
        }).finally(() => {
            bigRaceSummaryInFlightKeys.delete(identity.key);
            markDirty_({ status: true });
            scheduleRender_();
        });
        return true;
    }

    function raceDataFetchRaceKey_(raceId = "", payload = null) {
        const payloadRid = payload ? directRaceIdFromPayload_(payload) : "";
        return String(raceId || payloadRid || directCurrentRaceId || urlRaceId_() || visibleRaceId_() || raceMeta?.raceId || "current").trim();
    }

    function raceDataFetchStats_(raceId = "") {
        const key = raceDataFetchRaceKey_(raceId);
        let stats = raceDataFetchStatsByRaceId.get(key);
        if (!stats) {
            stats = { fetches: 0, duplicatePayloadsSkipped: 0, fullRenders: 0, lightweightRenders: 0, renderedRows: 0, totalRows: 0 };
            raceDataFetchStatsByRaceId.set(key, stats);
        }
        return stats;
    }

    function raceDataStatusFinished_(payload) {
        const p = getRacePayload_(payload) || payload || {};
        const td = p?.timeData || {};
        const status = Number(td.status ?? td.stauts ?? td.state);
        if (Number.isFinite(status) && status === 1) return true;
        const info = String(p?.info || p?.raceData?.info || "").trim();
        if (/\brace\s+(?:finished|complete|completed)\b/i.test(info) || /\bfinished\b/i.test(info)) return true;
        const log = extractRaceLogData_(p);
        return !!(log.timeEnded || log.TimeEnded);
    }

    function raceDataUsableForAnalysis_(payload) {
        return !!((getRacePayload_(payload) || payload || {})?.cars) && pgPlayerPayloadHasDecodableIntervals_(payload);
    }

    function updateRaceDataLightweightFields_(target, source) {
        if (!target || !source) return false;
        let changed = false;
        for (const key of ["timeData", "info", "user", "logData"]) {
            if (source[key] == null) continue;
            const next = source[key];
            const prev = target[key];
            if (JSON.stringify(prev || null) !== JSON.stringify(next || null)) {
                target[key] = next;
                changed = true;
            }
        }
        return changed;
    }

    function raceDataAcceptedState_(raceId, create = true) {
        const key = raceDataFetchRaceKey_(raceId);
        let state = raceDataAcceptedStateByRaceId.get(key);
        if (!state && create) {
            state = { raceId: key, signature: "", accepted: false, complete: false, payload: null, duplicatePayloadsSkipped: 0 };
            raceDataAcceptedStateByRaceId.set(key, state);
        }
        return state;
    }

    function maybeSkipDuplicateRaceDataPayload_(payload, raceId) {
        const key = raceDataFetchRaceKey_(raceId, payload);
        const signature = raceDataStaticSignature_(payload);
        const state = raceDataAcceptedState_(key);
        if (state.accepted && state.signature && state.signature === signature) {
            state.duplicatePayloadsSkipped += 1;
            const stats = raceDataFetchStats_(key);
            stats.duplicatePayloadsSkipped += 1;
            updateRaceDataLightweightFields_(state.payload || latestRaceDataPayload, payload);
            if (state.payload) latestRaceDataPayload = state.payload;
            raceDataReceivedPerfMs = performance.now();
            raceDataCurrentTimeAtReceive = Number((state.payload || payload)?.timeData?.currentTime);
            statusDirty = true;
            statusOnlyRenderPending = true;
            if (debugEnabled) console.debug(TAG, "raceData duplicate static payload skipped", key, signature);
            return true;
        }
        state.signature = signature;
        state.accepted = true;
        state.complete = raceDataUsableForAnalysis_(payload) || raceDataStatusFinished_(payload);
        state.payload = payload;
        if (key) raceDataPayloadCacheByRaceId.set(key, payload);
        return false;
    }

    function directRaceDataFetchComplete_(raceId) {
        const state = raceDataAcceptedState_(raceId, false);
        return !!(state?.accepted && state.complete);
    }

    function bigRaceObservationShouldPause_() {
        const payload = latestRaceDataPayload || analysis?.payload || null;
        if (!payload || !heavyRaceMode_()) return false;
        const fetchKey = raceDataFetchRaceKey_("", payload);
        const payloadKey = raceDataPayloadKey_(payload);
        const cacheKey = bigRaceCacheIdentity_(payload).key;
        return raceDataStatusFinished_(payload)
            || directRaceDataFetchComplete_(fetchKey)
            || pgPlayerCachedRaceKeys.has(payloadKey)
            || bigRaceRawStoredKeys.has(cacheKey);
    }

    function pgPlayerDecodedIntervalsPreview_(value) {
        const encoded = String(value || "").trim();
        if (!encoded || encoded.length < 8 || /[^A-Za-z0-9+/=]/.test(encoded)) return [];
        try {
            const decoded = atob(encoded);
            if (!decoded || decoded.indexOf(",") < 0) return [];
            return decoded.split(",").map(Number).filter(v => Number.isFinite(v) && v > 0);
        } catch {
            return [];
        }
    }

    function pgPlayerPayloadHasDecodableIntervals_(payload) {
        const p = getRacePayload_(payload) || payload || {};
        const cars = p?.cars || p?.raceData?.cars || {};
        if (!cars || typeof cars !== "object") return false;
        for (const encoded of Object.values(cars)) {
            if (pgPlayerDecodedIntervalsPreview_(encoded).length > 1) return true;
        }
        return false;
    }

    function pgPlayerBytesToBase64_(bytes) {
        let binary = "";
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        return btoa(binary);
    }

    function pgPlayerPackIntervals_(values, width) {
        const bytes = new Uint8Array(values.length * width);
        const view = new DataView(bytes.buffer);
        for (let index = 0; index < values.length; index++) {
            const millis = Math.max(1, Math.round(Number(values[index]) * 1000));
            if (width === 2) view.setUint16(index * width, millis, true);
            else view.setUint32(index * width, millis, true);
        }
        return pgPlayerBytesToBase64_(bytes);
    }

    function pgPlayerTrackTransportKey_(payload) {
        const p = getRacePayload_(payload) || payload || {};
        const intervals = Array.isArray(p?.trackData?.intervals) ? p.trackData.intervals : [];
        const sum = intervals.reduce((total, value) => total + (Number(value) || 0), 0);
        const track = String(extractTrackNameFromPayloadOrMeta_(p) || p?.title || "unknown").trim().toLowerCase();
        const pictureId = String(p?.imageID || p?.imageId || "");
        return `${track}|${pictureId}|${intervals.length}|${sum.toFixed(6)}`;
    }

    function pgPlayerHostedTrackKnown_(key) {
        const known = loadJson_(STORE_HOSTED_TRACK_INTERVALS_KEY, {});
        return !!known?.[key];
    }

    function pgPlayerRememberHostedTrack_(key) {
        if (!key) return;
        const known = loadJson_(STORE_HOSTED_TRACK_INTERVALS_KEY, {});
        known[key] = Date.now();
        const entries = Object.entries(known).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 40);
        saveJson_(STORE_HOSTED_TRACK_INTERVALS_KEY, Object.fromEntries(entries));
    }

    function pgPlayerCompactTransport_(payload, includeTrackIntervals = false) {
        const p = getRacePayload_(payload) || payload || {};
        const decodedCars = {};
        let maxMillis = 0;
        for (const [name, encoded] of Object.entries(p?.cars || {})) {
            const values = pgPlayerDecodedIntervalsPreview_(encoded);
            if (!values.length) continue;
            decodedCars[name] = values;
            for (const value of values) maxMillis = Math.max(maxMillis, Math.round(value * 1000));
        }
        const width = maxMillis <= 65535 ? 2 : 4;
        const cars = {};
        for (const [name, values] of Object.entries(decodedCars)) {
            cars[name] = pgPlayerPackIntervals_(values, width);
        }
        const carInfo = {};
        for (const [name, raw] of Object.entries(p?.carInfo || {})) {
            const info = raw && typeof raw === "object" ? raw : {};
            const compact = {};
            for (const key of ["userID", "userId", "id", "playername", "playerName", "name", "itemID", "itemId", "imteID", "color", "carColor"]) {
                if (info[key] != null) compact[key] = info[key];
            }
            carInfo[name] = compact;
        }
        const trackData = {
            laps: p?.trackData?.laps ?? p?.laps
        };
        if (p?.trackData?.name != null) trackData.name = p.trackData.name;
        if (includeTrackIntervals) trackData.intervals = Array.isArray(p?.trackData?.intervals) ? p.trackData.intervals : [];
        const logData = extractRaceLogData_(p);
        const compact = {
            _pitGuruTransport: "compact-replay-v2",
            raceID: directRaceIdFromPayload_(p),
            trackID: p?.trackID,
            laps: p?.laps ?? p?.trackData?.laps,
            carsEncoding: width === 2 ? "u16ms-b64-le-v1" : "u32ms-b64-le-v1",
            trackData,
            cars,
            carInfo,
            logData: {}
        };
        for (const key of ["ID", "raceID", "raceId", "trackTitle"]) {
            if (logData?.[key] != null) compact.logData[key] = logData[key];
        }
        for (const key of ["imageID", "imageId", "title", "trackName", "track"]) {
            if (p?.[key] != null) compact[key] = p[key];
        }
        return compact;
    }

    function playerRaceDataAvailable_() {
        const payload = latestRaceDataPayload || analysis?.payload || null;
        return !!payload && pgPlayerPayloadHasDecodableIntervals_(payload);
    }

    function prepareNewRaceUi_() {
        analysisMode = "predictions";
        saveAnalysisMode_();
        pgPlayerAvailabilityArmed = true;
        pgPlayerReadyHighlightUntil = 0;
        clearTimeout(pgPlayerReadyHighlightTimer);
        pgPlayerReadyHighlightTimer = 0;
    }

    function maybeSwitchReplayAnalysisMode_(payload, source = "") {
        if (!payload || analysisMode !== "predictions") return;
        const td = payload?.timeData || payload?.raceData?.timeData || {};
        const status = Number(td.status ?? td.stauts);
        const info = String(payload?.info || payload?.raceData?.info || source || "").toLowerCase();
        const replayOrFinished = isReplayPage_()
            || /replay|log|racingdata|finished/.test(info)
            || status === 3;
        if (!replayOrFinished) return;
        analysisMode = "gaps";
        saveAnalysisMode_();
    }

    function markPlayerRaceDataAvailable_() {
        if (!pgPlayerAvailabilityArmed || !playerRaceDataAvailable_()) return;
        pgPlayerAvailabilityArmed = false;
        pgPlayerReadyHighlightUntil = Date.now() + 10000;
        clearTimeout(pgPlayerReadyHighlightTimer);
        pgPlayerReadyHighlightTimer = setTimeout(() => {
            pgPlayerReadyHighlightTimer = 0;
            pgPlayerReadyHighlightUntil = 0;
            uiDirty = true;
            scheduleRender_();
        }, 10050);
    }

    function pgPlayerGetJson_(url, session = "", timeout = 15000) {
        return pgWithRetry_(() => new Promise((resolve, reject) => {
            const headers = session ? { "X-Pit-Guru-Session": session } : {};
            const parse = (status, statusText, responseText) => {
                let body = null;
                try { body = JSON.parse(String(responseText || "{}")); }
                catch { body = {}; }
                if (status >= 500 || status === 408 || status === 429) {
                    const error = new Error(body?.error || statusText || `HTTP ${status}`);
                    error.status = status;
                    error.statusText = statusText;
                    error.payload = body;
                    reject(error);
                    return;
                }
                resolve({ status, statusText, body });
            };
            if (typeof GM_xmlhttpRequest === "function") {
                GM_xmlhttpRequest({
                    method: "GET",
                    url,
                    headers,
                    timeout,
                    onload: res => parse(res.status, res.statusText, res.responseText),
                    onerror: () => reject(new Error("hosted player request failed")),
                    ontimeout: () => reject(new Error("hosted player request timed out"))
                });
                return;
            }
            fetch(url, { headers })
                .then(async r => parse(r.status, r.statusText, await r.text()))
                .catch(reject);
        }), { maxRetries: PG_API_RETRY_MAX });
    }

    async function pgPlayerHostedRaceExists_(raceId, session = "") {
        const rid = String(raceId || "").trim();
        if (!rid) return null;
        try {
            const url = pgPlayerUrl_(`/api/race/exists?raceID=${encodeURIComponent(rid)}`);
            const result = await pgPlayerGetJson_(url, session, 12000);
            if (result.status === 200 && result.body?.exists) return result.body;
            if (result.status === 404) return { ok: true, exists: false, race: { raceId: rid } };
        } catch (error) {
            if (debugEnabled) console.debug(TAG, "hosted player race existence check failed", error);
        }
        return null;
    }

    async function pgPlayerCacheRaceData_(payload, source = "torn-racingData", opts = {}) {
        const p = getRacePayload_(payload) || payload || {};
        if (!p || !p.cars) return Promise.resolve(null);
        const autoNotify = !/^manual/i.test(String(source || ""));
        if (!pgPlayerPayloadHasDecodableIntervals_(p)) {
            const message = "Hosted player cache skipped: racingData does not include replay intervals yet.";
            if (opts.force) {
                pgPlayerCacheStatus = message;
                return Promise.reject(new Error(message));
            }
            if (debugEnabled) console.debug(TAG, message, source);
            return Promise.resolve({ ok: false, pending: true, error: message });
        }
        const key = raceDataPayloadKey_(p);
        const now = Date.now();
        if (!opts.force && pgPlayerCachedRaceKeys.has(key)) return Promise.resolve(null);
        if (!opts.force && key === pgPlayerCacheLastKey && now - pgPlayerCacheLastAt < 10000) return Promise.resolve(null);
        if (!opts.force && pgPlayerCacheInFlightKeys.has(key)) return Promise.resolve(null);
        pgPlayerCacheLastKey = key;
        pgPlayerCacheLastAt = now;
        pgPlayerCacheActive = true;
        pgPlayerCacheInFlightKeys.add(key);
        pgPlayerCacheStatus = "Caching race in hosted player...";
        const trackTransportKey = pgPlayerTrackTransportKey_(p);
        let includeTrackIntervals = !pgPlayerHostedTrackKnown_(trackTransportKey);
        const submit = (session, requestPayload) => pgWithRetry_(() => new Promise((resolve, reject) => {
            const data = JSON.stringify(requestPayload);
            const url = pgPlayerUrl_("/api/analyze");
            const handleResponse = (status, statusText, responseText) => {
                try {
                    const parsed = JSON.parse(String(responseText || "{}"));
                    if (parsed?.pending) {
                        resolve(parsed);
                        return;
                    }
                    if (status < 200 || status >= 300 || parsed?.ok === false) {
                        const error = new Error(parsed?.error || statusText || `HTTP ${status}`);
                        error.status = status;
                        error.payload = parsed;
                        error.missingTrackIntervals = !!parsed?.missingTrackIntervals;
                        reject(error);
                        return;
                    }
                    resolve(parsed);
                } catch (error) {
                    reject(error);
                }
            };
            if (typeof GM_xmlhttpRequest === "function") {
                GM_xmlhttpRequest({
                    method: "POST",
                    url,
                    headers: { "Content-Type": "application/json", "X-Pit-Guru-Session": session },
                    data,
                    timeout: 30000,
                    onload: res => handleResponse(res.status, res.statusText, res.responseText),
                    onerror: () => reject(new Error("hosted player request failed")),
                    ontimeout: () => reject(new Error("hosted player request timed out"))
                });
                return;
            }
            fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Pit-Guru-Session": session },
                body: data
            }).then(async r => {
                handleResponse(r.status, r.statusText, await r.text());
            }).catch(reject);
        }), { maxRetries: PG_API_RETRY_MAX });
        try {
            let session = pgHostedSession_() || await pgVerifyHostedSession_();
            let result;
            const raceIdBeforeUpload = directRaceIdFromPayload_(p);
            if (raceIdBeforeUpload) {
                const existing = await pgPlayerHostedRaceExists_(raceIdBeforeUpload, session);
                if (existing?.exists) {
                    pgPlayerCacheStatus = `Race ID ${raceIdBeforeUpload} is already cached on the hosted player.`;
                    pgPlayerCachedRaceKeys.add(key);
                    if (autoNotify) notifyRaceUpload_(`upload-skip-existing:${raceIdBeforeUpload}`, pgPlayerCacheStatus);
                    return { ok: true, cached: true, skipped: true, race: existing.race || { raceId: raceIdBeforeUpload } };
                }
            }
            try {
                result = await submit(session, pgPlayerCompactTransport_(p, includeTrackIntervals));
            } catch (error) {
                if (error?.missingTrackIntervals && !includeTrackIntervals) {
                    includeTrackIntervals = true;
                    result = await submit(session, pgPlayerCompactTransport_(p, true));
                } else {
                    const authFailure = error?.status === 401
                        || (error?.status === 403 && /verify your torn account|no verified pit guru session/i.test(String(error?.message || "")));
                    if (!authFailure) throw error;
                    pgClearHostedSession_();
                    session = await pgVerifyHostedSession_();
                    result = await submit(session, pgPlayerCompactTransport_(p, includeTrackIntervals));
                }
            }
            if (result?.pending) {
                pgPlayerCacheStatus = result.error || "Hosted player cache pending: replay intervals are not available yet.";
                if (autoNotify) notifyRaceUpload_(`upload-pending:${key}`, pgPlayerCacheStatus);
                return result;
            }
            const raceId = String(result?.race?.raceId || directRaceIdFromPayload_(p) || "").trim();
            pgPlayerCacheStatus = raceId ? `Cached Race ID ${raceId} in hosted player.` : "Cached race in hosted player.";
            pgPlayerCachedRaceKeys.add(key);
            if (result?.transport?.trackIntervalsStored) pgPlayerRememberHostedTrack_(trackTransportKey);
            if (autoNotify) notifyRaceUpload_(`upload-ok:${key}`, raceId ? `Race upload complete: Race ID ${raceId} is cached on the hosted player.` : "Race upload complete: cached on the hosted player.");
            if (debugEnabled) console.log(TAG, "hosted player cached racingData", source, result?.race);
            return result;
        } catch (error) {
            pgPlayerCacheStatus = `Hosted player cache failed: ${error?.message || error || "request failed"}`;
            if (autoNotify) notifyRaceUpload_(`upload-fail:${key}:${pgPlayerCacheStatus}`, pgPlayerCacheStatus);
            if (debugEnabled) console.warn(TAG, pgPlayerCacheStatus);
            return null;
        } finally {
            pgPlayerCacheInFlightKeys.delete(key);
            pgPlayerCacheActive = pgPlayerCacheInFlightKeys.size > 0;
        }
    }

    async function pgPlayerFetchRaceDataById_(raceId) {
        const rid = String(raceId || "").trim();
        if (!rid) throw new Error("Missing Race ID");
        const url = racingDataUrl_(rid);
        const resp = await fetch(url, {
            credentials: "include",
            cache: "no-store",
            headers: {
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "X-Requested-With": "XMLHttpRequest"
            }
        });
        if (!resp.ok) throw new Error(`Torn racingData request failed: HTTP ${resp.status}`);
        const text = await resp.text();
        if (!text || /^Wrong RFC/i.test(text.trim())) throw new Error(text || "Torn rejected the racingData request");
        let json = null;
        try { json = JSON.parse(text); }
        catch { throw new Error("Torn racingData response was not JSON"); }
        const payload = getRacePayload_(json);
        if (!payload || !payload.cars) throw new Error(`Race ID ${rid} did not return usable racingData`);
        return await pgPlayerCacheRaceData_(payload, "manual-raceID", { force: true });
    }

    async function openLocalPlayerForCurrentRace_() {
        if (!playerRaceDataAvailable_()) {
            toast_("Player unlocks when Torn delivers replay-ready racingData for this race.");
            return;
        }
        const payload = latestRaceDataPayload || analysis?.payload || null;
        const rid = String(directRaceIdFromPayload_(payload) || directCurrentRaceId || urlRaceId_() || visibleRaceId_() || raceMeta?.raceId || "").trim();
        const target = rid ? pgPlayerUrl_(`/?raceID=${encodeURIComponent(rid)}`) : pgPlayerBase_();
        const popup = window.open("about:blank", "_blank");
        try {
            if (popup?.document) {
                popup.document.title = "Pit Guru Player";
                popup.document.body.innerHTML = "<p style='font:14px system-ui;padding:18px'>Caching Torn racingData for Pit Guru Player...</p>";
            }
        } catch {}
        try {
            if (payload && (!rid || directRaceIdFromPayload_(payload) === rid)) {
                await pgPlayerCacheRaceData_(payload, "manual-current", { force: true });
            } else if (rid) {
                await pgPlayerFetchRaceDataById_(rid);
            }
            toast_(rid ? `Hosted player cached Race ID ${rid}.` : "Hosted player cached the current race.");
            if (popup) popup.location.href = target;
            else window.open(target, "_blank", "noopener,noreferrer");
        } catch (e) {
            toast_(`Hosted player cache failed: ${e.message || e}`);
            if (popup) popup.location.href = target;
            if (debugEnabled) console.warn(TAG, "hosted player manual cache failed", e);
        }
    }

    function isEmptyRaceIdRacingDataUrl_(url) {
        try {
            const u = new URL(String(url || ""), location.origin);
            if ((u.searchParams.get("sid") || "").toLowerCase() !== "racingdata") return false;
            if (!u.searchParams.has("raceID") && !u.searchParams.has("raceId") && !u.searchParams.has("raceid")) return false;
            const rid = u.searchParams.get("raceID") ?? u.searchParams.get("raceId") ?? u.searchParams.get("raceid") ?? "";
            return String(rid || "").trim() === "";
        } catch {
            return /[?&]sid=racingData\b/i.test(String(url || "")) && /[?&]raceID=(?:&|$)/i.test(String(url || ""));
        }
    }

    function raceDataParticipantRows_(payload) {
        const p = getRacePayload_(payload) || payload || {};
        const info = p.carInfo || p.raceData?.carInfo || {};
        const rows = [];
        const pushRow = (nameKey, value, index) => {
            const v = value && typeof value === "object" ? value : {};
            const name = String(v.playername || v.playerName || v.name || nameKey || "").trim();
            const driverId = String(v.userID || v.userId || v.userid || v.user_id || v.driverId || v.id || "").trim();
            if (!name && !driverId) return;
            rows.push({
                name: name || `Driver ${index + 1}`,
                driverId,
                racingSkill: safeNum_(v.racingSkill ?? v.racing_skill ?? v.skill, NaN),
                itemID: v.itemID || v.itemId || v.item_id || v.imteID || v.carItemID || v.carItemId || "",
                car: toOgCarName_(v.car || v.carTitle || v.car_title || ""),
                carImg: String(v.carImg || v.carImage || v.car_image || ""),
                preRaceOnly: true,
                source: "racingData"
            });
        };
        if (Array.isArray(info)) {
            info.forEach((v, i) => pushRow("", v, i));
        } else if (info && typeof info === "object") {
            Object.entries(info).forEach(([k, v], i) => pushRow(k, v, i));
        }
        if (!rows.length) {
            for (const d of decodeRaceCars_(p)) {
                rows.push({
                    name: d.name,
                    driverId: d.driverId,
                    racingSkill: d.racingSkill,
                    itemID: d.itemID || "",
                    car: d.car,
                    carImg: d.carImg,
                    preRaceOnly: true,
                    source: "racingData"
                });
            }
        }
        const byName = new Map();
        for (const row of rows) {
            const key = normalizeDriverName_(row.name) || `id:${row.driverId}`;
            if (!key) continue;
            const prev = byName.get(key) || {};
            byName.set(key, Object.assign({}, row, {
                driverId: row.driverId || prev.driverId || "",
                itemID: row.itemID || prev.itemID || "",
                car: row.car || prev.car || "",
                carImg: row.carImg || prev.carImg || "",
                racingSkill: Number.isFinite(row.racingSkill) ? row.racingSkill : prev.racingSkill
            }));
        }
        return Array.from(byName.values()).filter(d => d.name || d.driverId);
    }

    function raceDataCarRows_(payload) {
        const p = getRacePayload_(payload) || payload || {};
        const raw = p.carData || p.raceData?.carData || [];
        const rows = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);
        return rows
            .filter(x => x && typeof x === "object")
            .map(x => Object.assign({}, x, {
                itemID: x.itemID || x.itemId || x.item_id || "",
                carImage: x.carImage || x.carImg || x.car_image || (x.itemID || x.itemId || x.item_id ? `/images/items/${x.itemID || x.itemId || x.item_id}/large.png` : "")
            }));
    }

    function cacheDirectRacingDataParticipants_(payload) {
        const rows = raceDataParticipantRows_(payload);
        if (!rows.length) return false;
        const key = rows.map(d => `${normalizeDriverName_(d.name)}:${d.driverId}:${d.car}`).sort().join("|");
        if (key !== directRacingDataParticipantsKey) {
            directRacingDataParticipants = rows;
            directRacingDataParticipantsKey = key;
            preRaceParticipantsKey = "";
        }
        return true;
    }

    function findDirectRacingDataParticipant_(name) {
        const nn = normalizeDriverName_(name);
        if (!nn) return null;
        return directRacingDataParticipants.find(d => normalizeDriverName_(d.name) === nn) || null;
    }

    function mergeDirectRacingDataIntoParticipant_(d) {
        const direct = findDirectRacingDataParticipant_(d?.name || "");
        if (!direct) return d;
        if (!String(d.driverId || "").trim() && direct.driverId) d.driverId = direct.driverId;
        if (!Number.isFinite(d.racingSkill) && Number.isFinite(Number(direct.racingSkill))) d.racingSkill = Number(direct.racingSkill);
        if (!d.car && direct.car) d.car = direct.car;
        if (!d.carImg && direct.carImg) d.carImg = direct.carImg;
        return d;
    }

    function currentRacingDataMatchesVisibleGrid_(payload) {
        if (!canScanTornPage_()) return false;
        const directRows = raceDataParticipantRows_(payload);
        if (!directRows.length) return false;
        const payloadTrack = makeTrackLookupKey_(extractTrackNameFromPayloadOrMeta_(payload));
        const visibleTrack = makeTrackLookupKey_(visibleRaceTrackName_() || raceMeta?.track || "");
        if (payloadTrack && visibleTrack && payloadTrack !== "unknowntrack" && visibleTrack !== "unknowntrack" && payloadTrack !== visibleTrack) return false;
        const visibleRows = scrapeVisibleParticipants_();
        if (!visibleRows.length) return false;
        const slots = visibleRaceDriverSlots_();
        if (Number.isFinite(slots.total) && slots.total > visibleRows.length) return false;
        if (!Number.isFinite(slots.total) && visibleRows.length < 2 && directRows.length > visibleRows.length) return false;
        const directNames = new Set(directRows.map(d => normalizeDriverName_(d.name)).filter(Boolean));
        const visibleNames = visibleRows.map(d => normalizeDriverName_(d.name)).filter(Boolean);
        const overlap = visibleNames.filter(n => directNames.has(n)).length;
        const needed = Math.max(2, Math.ceil(Math.min(visibleNames.length, directNames.size) * 0.8));
        return overlap >= needed;
    }

    function currentRacingDataMatchesVisibleGridCached_(payload) {
        const key = raceDataPayloadKey_(payload);
        const now = Date.now();
        if (raceDataVisibleMatchCache.key === key && now - raceDataVisibleMatchCache.at < Math.max(1000, participantScanMs)) {
            return raceDataVisibleMatchCache.valid;
        }
        const valid = currentRacingDataMatchesVisibleGrid_(payload);
        raceDataVisibleMatchCache = { key, at: now, valid };
        return valid;
    }

    function shouldUseAmbientRaceDataPayload_(payload) {
        if (isReplayPage_()) return true;
        const explicitRid = urlRaceId_();
        const payloadRid = directRaceIdFromPayload_(payload);
        if (explicitRid && payloadRid && explicitRid !== payloadRid) return false;
        return currentRacingDataMatchesVisibleGridCached_(payload);
    }

    function cookieValue_(name) {
        try {
            const needle = `${encodeURIComponent(name)}=`;
            const found = String(document.cookie || "").split(/;\s*/).find(x => x.startsWith(needle) || x.startsWith(`${name}=`));
            if (!found) return "";
            return decodeURIComponent(found.slice(found.indexOf("=") + 1));
        } catch {
            return "";
        }
    }

    function currentRfcv_() {
        try {
            const direct = new URL(location.href).searchParams.get("rfcv");
            if (direct) return direct;
        } catch {}
        const cookie = cookieValue_("rfc_v");
        if (cookie && !/^(?:null|undefined|false|0)$/i.test(cookie)) return cookie;
        try {
            const fn = (typeof unsafeWindow !== "undefined" && unsafeWindow?.getRFC) || window.getRFC;
            const rfc = typeof fn === "function" ? String(fn() || "").trim() : "";
            if (rfc && !/^(?:null|undefined|false|0)$/i.test(rfc)) return rfc;
        } catch {}
        try {
            const entries = performance.getEntriesByType?.("resource") || [];
            for (let i = entries.length - 1; i >= 0; i--) {
                const u = new URL(entries[i].name || "", location.origin);
                const rfc = u.searchParams.get("rfcv");
                if (rfc) return rfc;
            }
        } catch {}
        return "";
    }

    function racingDataUrl_(raceId = "") {
        const u = new URL("/page.php", location.origin);
        const rfcv = currentRfcv_();
        if (rfcv) u.searchParams.set("rfcv", rfcv);
        u.searchParams.set("sid", "racingData");
        u.searchParams.set("raceID", String(raceId || "").trim());
        return u.toString();
    }

    async function fetchDirectRaceData_(raceId = "", source = "direct-racingData") {
        const requestKey = raceDataFetchRaceKey_(raceId);
        if (directRaceDataFetchComplete_(requestKey)) {
            const cached = raceDataPayloadCacheByRaceId.get(requestKey);
            return cached ? maybeAcceptRaceDataPayload_(cached, `${source}-cache`, racingDataUrl_(raceId)) : true;
        }
        if (raceDataInFlightByRaceId.has(requestKey)) return raceDataInFlightByRaceId.get(requestKey);
        const url = racingDataUrl_(raceId);
        const run = (async () => {
            raceDataFetchStats_(requestKey).fetches += 1;
            const resp = await fetch(url, {
                credentials: "include",
                cache: "no-store",
                headers: {
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                    "X-Requested-With": "XMLHttpRequest"
                }
            });
            if (!resp.ok) return false;
            const text = await resp.text();
            if (!text || /^Wrong RFC/i.test(text.trim())) {
                if (debugEnabled) console.warn(TAG, "direct racingData rejected", text || resp.statusText);
                return false;
            }
            let json = null;
            try { json = JSON.parse(text); }
            catch (e) {
                if (debugEnabled) console.warn(TAG, "direct racingData was not JSON", e);
                return false;
            }
            return maybeAcceptRaceDataPayload_(json, source, url);
        })().finally(() => {
            raceDataInFlightByRaceId.delete(requestKey);
        });
        raceDataInFlightByRaceId.set(requestKey, run);
        return run;
    }

    function directFetchLeaseOk_(key, ttlMs) {
        try {
            const now = Date.now();
            const raw = GM_getValue(STORE_DIRECT_FETCH_LEASE_KEY, "");
            const lease = typeof raw === "string" ? JSON.parse(raw || "{}") : (raw || {});
            const sameKey = String(lease?.key || "") === String(key || "");
            const at = Number(lease?.at || 0);
            if (sameKey && Number.isFinite(at) && now - at < Math.max(1000, ttlMs || 1000)) return false;
            GM_setValue(STORE_DIRECT_FETCH_LEASE_KEY, JSON.stringify({ key: String(key || ""), at: now }));
        } catch { }
        return true;
    }

    async function maybeFetchRacingDataForCurrentRace_(force = false) {
        if (raceDataDirectFetchActive) return false;
        const replay = isReplayPage_();
        if (!replay && !canScanTornPage_()) return false;
        const explicitRaceId = replay ? (urlRaceId_() || visibleRaceId_() || raceMeta?.raceId || "") : "";
        if (replay && !explicitRaceId) return false;

        const currentPayload = latestRaceDataPayload || analysis?.payload || null;
        const hasRaceData = !!(currentPayload && analysis?.drivers?.length);
        const resolvedRaceKey = raceDataFetchRaceKey_(explicitRaceId, currentPayload);
        if (directRaceDataFetchComplete_(resolvedRaceKey)) return false;
        const nativeRecentlyDelivered = raceDataReceivedPerfMs && (performance.now() - raceDataReceivedPerfMs < 8000);
        if (!force && !replay && nativeRecentlyDelivered) return false;
        const intervalMs = replay ? (hasRaceData ? 10000 : 3000) : (hasRaceData ? 30000 : 15000);
        const key = `${replay ? `race:${explicitRaceId}` : resolvedRaceKey || "current"}|${currentRfcv_() || "no-rfc"}`;
        const now = Date.now();
        if (!force && raceDataDirectFetchLastKey === key && now - raceDataDirectFetchAt < intervalMs) return false;
        if (!directFetchLeaseOk_(key, Math.max(2500, intervalMs - 500))) return false;

        raceDataDirectFetchLastKey = key;
        raceDataDirectFetchAt = now;
        raceDataDirectFetchActive = true;
        try {
            const accepted = await fetchDirectRaceData_(explicitRaceId, replay ? "direct-raceID-racingData" : "direct-current-racingData");
            if (accepted) return true;
            const fallbackRaceId = !replay ? (urlRaceId_() || visibleRaceId_() || raceMeta?.raceId || "") : "";
            if (fallbackRaceId) return await fetchDirectRaceData_(fallbackRaceId, "direct-raceID-racingData");
            return false;
        } catch (e) {
            if (debugEnabled) console.warn(TAG, "direct racingData fetch failed", e);
            return false;
        } finally {
            raceDataDirectFetchActive = false;
        }
    }

    function extractTrackNameFromPayloadOrMeta_(payload) {
        const log = extractRaceLogData_(payload);
        const candidates = [
            payload?.trackName, payload?.track, payload?.title, payload?.race?.track, payload?.raceData?.track,
            payload?.raceData?.trackName, payload?.trackData?.name, payload?.trackData?.title,
            payload?.raceData?.title, log.trackTitle, log.track,
            raceMeta?.track
        ];
        for (const c of candidates) {
            const s = stripTrackLapSuffix_(String(c || "").trim());
            if (s) return s;
        }
        return "UnknownTrack";
    }

    function extractLapsFromPayloadOrUi_(payload) {
        const log = extractRaceLogData_(payload);
        const candidates = [payload?.laps, payload?.race?.laps, payload?.raceData?.laps, payload?.trackData?.laps, log.laps];
        for (const c of candidates) {
            const n = Number(c);
            if (Number.isFinite(n) && n > 0) return Math.floor(n);
        }
        return getOfficialLapCount_(extractTrackNameFromPayloadOrMeta_(payload)) || 1;
    }

    function findLatestRaceDataPayload_() {
        if (latestRaceDataPayload) {
            const pageRid = getRaceId_();
            const payloadRid = directRaceIdFromPayload_(latestRaceDataPayload);
            if (pageRid && payloadRid && pageRid !== payloadRid) return null;
            if (clearedRaceDataKey && raceDataPayloadKey_(latestRaceDataPayload) === clearedRaceDataKey) return null;
            return latestRaceDataPayload;
        }
        const roots = [window.raceData, window.__raceData, window.RaceData, window.racingData].filter(Boolean);
        for (const root of roots) {
            const payload = getRacePayload_(root);
            if (payload) {
                if (!shouldUseAmbientRaceDataPayload_(payload)) continue;
                if (clearedRaceDataKey && raceDataPayloadKey_(payload) === clearedRaceDataKey) continue;
                return payload;
            }
        }
        return null;
    }

    function getRacePayload_(obj, depth = 0, seen = new Set()) {
        if (!obj || typeof obj !== "object" || depth > 5 || seen.has(obj)) return null;
        seen.add(obj);
        if (obj.trackData && obj.cars && typeof obj.cars === "object") return obj;
        if (obj.raceData && obj.raceData.trackData && obj.raceData.cars) {
            return Object.assign({}, obj.raceData, {
                laps: obj.raceData.laps ?? obj.laps,
                raceID: obj.raceData.raceID ?? obj.raceID ?? obj.raceId,
                timeData: obj.raceData.timeData ?? obj.timeData,
                user: obj.raceData.user ?? obj.user,
                carData: obj.raceData.carData ?? obj.carData,
                logData: obj.raceData.logData ?? obj.logData,
                trackID: obj.raceData.trackID ?? obj.trackID,
                info: obj.raceData.info ?? obj.info
            });
        }
        for (const k of Object.keys(obj).slice(0, 80)) {
            const found = getRacePayload_(obj[k], depth + 1, seen);
            if (found) return found;
        }
        return null;
    }

    function extractRaceLogData_(payload) {
        const raw = payload?.logData || payload?.raceData?.logData || {};
        if (!raw) return {};
        if (typeof raw === "string") {
            try { return JSON.parse(raw); }
            catch { return {}; }
        }
        return raw && typeof raw === "object" ? raw : {};
    }

    function fieldSize_() {
        return analysis?.drivers?.length || preRaceParticipants.length || directRacingDataParticipants.length || 0;
    }

    function heavyRaceStatsFromPayload_(payload) {
        const p = getRacePayload_(payload) || payload || {};
        const cars = p?.cars || p?.raceData?.cars || {};
        const drivers = Object.keys(cars || {}).length || Number(raceMetaFromPayload_(p, false).currentDrivers) || fieldSize_() || 0;
        const laps = extractLapsFromPayloadOrUi_(p);
        const rawIntervals = p?.trackData?.intervals || p?.raceData?.trackData?.intervals || [];
        const intervals = Array.isArray(rawIntervals) ? rawIntervals.length : (analysis?.segmentsPerLap || 0);
        const estimatedPoints = Math.max(0, drivers) * Math.max(0, laps) * Math.max(0, intervals);
        return {
            drivers,
            laps,
            intervals,
            estimatedPoints,
            heavyRace: laps >= HEAVY_RACE_LAP_THRESHOLD || drivers >= HEAVY_RACE_DRIVER_THRESHOLD || estimatedPoints >= HEAVY_RACE_POINT_THRESHOLD
        };
    }

    function heavyRaceStats_() {
        if (analysis?.heavyRaceStats) return analysis.heavyRaceStats;
        return lastHeavyRaceStats || { heavyRace: false, estimatedPoints: 0, drivers: fieldSize_(), laps: 0, intervals: 0 };
    }

    function heavyRaceMode_() {
        return !!heavyRaceStats_().heavyRace;
    }

    function heavyRaceOverrideKey_() {
        return String(analysis?.raceId || directRaceIdFromPayload_(latestRaceDataPayload) || directCurrentRaceId || raceMeta?.raceId || raceDataPayloadKey_(latestRaceDataPayload || analysis?.payload || {}) || "current");
    }

    function ensureHeavyRaceOverrideState_() {
        const key = heavyRaceOverrideKey_();
        if (key === heavyRaceOverrideRaceKey) return;
        heavyRaceOverrideRaceKey = key;
        heavyRaceShowAllDrivers = false;
        heavyRaceFullCardsEnabled = false;
    }

    function heavyRaceLightweightMode_() {
        ensureHeavyRaceOverrideState_();
        return heavyRaceMode_() && !heavyRaceFullCardsEnabled;
    }

    function heavyRaceWindowedRows_() {
        ensureHeavyRaceOverrideState_();
        return heavyRaceMode_() && !heavyRaceShowAllDrivers && !heavyRaceFullCardsEnabled;
    }

    function analysisImagesEnabled_() {
        return !heavyRaceLightweightMode_();
    }

    function cachedOptionalImageUrl_(kind, key, url) {
        const id = `${kind || "image"}:${String(key || url || "").trim()}`;
        if (!id || id === `${kind || "image"}:`) return String(url || "").trim();
        if (!optionalImageUrlCache.has(id)) optionalImageUrlCache.set(id, String(url || "").trim());
        return optionalImageUrlCache.get(id) || "";
    }

    function isAnimatedProfileImageUrl_(url) {
        return /\.(?:gif|apng)(?:[?#]|$)/i.test(String(url || ""));
    }

    function profileImageForRender_(url) {
        const raw = String(url || "").trim();
        if (!raw || heavyRaceLightweightMode_() || isAnimatedProfileImageUrl_(raw)) return "";
        return cachedOptionalImageUrl_("profile", raw, raw);
    }

    function optionalImageTag_(url, className = "carIcon", alt = "") {
        const raw = String(url || "").trim();
        if (!raw || !analysisImagesEnabled_()) return "";
        const cached = cachedOptionalImageUrl_("item", raw, raw);
        return `<img class="${escAttr_(className)}" src="${escAttr_(cached)}" alt="${escAttr_(alt)}" loading="lazy" decoding="async">`;
    }

    function largeFieldMode_() {
        return fieldSize_() >= LARGE_FIELD_THRESHOLD;
    }

    function hugeFieldMode_() {
        return fieldSize_() >= HUGE_FIELD_THRESHOLD;
    }

    function lobbySize_() {
        const slots = visibleRaceDriverSlots_();
        return maxFinite_([fieldSize_(), slots.current, slots.total]) || fieldSize_();
    }

    function largeLobbyMode_() {
        return largeFieldMode_() || lobbySize_() >= LARGE_FIELD_THRESHOLD;
    }

    function hugeLobbyMode_() {
        return hugeFieldMode_() || lobbySize_() >= HUGE_FIELD_THRESHOLD;
    }

    function effectiveParticipantScanMs_() {
        if (hugeLobbyMode_()) return Math.max(12000, participantScanMs || 0);
        if (largeLobbyMode_()) return Math.max(7000, participantScanMs || 0);
        return participantScanMs || 2500;
    }

    function visibleParticipantCandidateLimit_() {
        return hugeLobbyMode_() ? HUGE_LOBBY_CANDIDATE_LIMIT : (largeLobbyMode_() ? LARGE_LOBBY_CANDIDATE_LIMIT : 600);
    }

    function liveRenderFps_() {
        if (hugeFieldMode_()) return 0.5;
        if (largeFieldMode_()) return 1;
        return 4;
    }

    function liveLoopDelayMs_() {
        if (hugeFieldMode_()) return 2000;
        if (largeFieldMode_()) return 1000;
        return Math.max(100, updateRateMs || 250);
    }

    function liveRaceHasWorkingAnalysis_() {
        return getRaceContext_() !== "replay"
            && !!analysis?.drivers?.length
            && (raceDataStarted_() || visualRaceHasStarted_());
    }

    function maintenanceLoopDelayMs_() {
        if (!liveRaceHasWorkingAnalysis_()) return 1000;
        if (hugeFieldMode_()) return Math.max(5000, visibleRaceScanMs || 0);
        if (largeFieldMode_()) return Math.max(3000, visibleRaceScanMs || 0);
        return Math.max(1000, visibleRaceScanMs || 0);
    }

    function firstIndexAtOrAfter_(arr, value) {
        let lo = 0, hi = (arr?.length || 0) - 1, ans = arr?.length || 0;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (value <= arr[mid]) {
                ans = mid;
                hi = mid - 1;
            } else {
                lo = mid + 1;
            }
        }
        return ans;
    }

    function unixToIso_(value) {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return "";
        return new Date(n * 1000).toISOString();
    }

    function payloadTimeData_() {
        return (latestRaceDataPayload || analysis?.payload || {})?.timeData || {};
    }

    function currentRaceClockSeconds_() {
        const td = payloadTimeData_();
        const base = Number.isFinite(raceDataCurrentTimeAtReceive)
            ? raceDataCurrentTimeAtReceive
            : Number(td.currentTime);
        if (!Number.isFinite(base)) return NaN;
        if (!raceDataReceivedPerfMs) return base;
        return base + Math.max(0, performance.now() - raceDataReceivedPerfMs) / 1000;
    }

    function raceDataCountdownSeconds_() {
        const td = payloadTimeData_();
        const explicit = Number(td.timeLeftToStart);
        if (Number.isFinite(explicit) && explicit > 0) {
            const elapsedSincePayload = raceDataReceivedPerfMs ? Math.max(0, performance.now() - raceDataReceivedPerfMs) / 1000 : 0;
            return Math.max(0, explicit - elapsedSincePayload);
        }
        const start = Number(td.timeStarted);
        const now = currentRaceClockSeconds_();
        if (Number.isFinite(start) && Number.isFinite(now)) return Math.max(0, start - now);
        return 0;
    }

    function raceDataStarted_() {
        const td = payloadTimeData_();
        const start = Number(td.timeStarted);
        const now = currentRaceClockSeconds_();
        if (Number.isFinite(start) && Number.isFinite(now) && now >= start) return true;
        const left = Number(td.timeLeftToStart);
        return Number.isFinite(left) && raceDataCountdownSeconds_() <= 0;
    }

    function raceDataLiveElapsedSeconds_() {
        if (!analysis || getRaceContext_() === "replay") return NaN;
        const td = payloadTimeData_();
        const start = Number(td.timeStarted);
        const now = currentRaceClockSeconds_();
        if (Number.isFinite(start) && Number.isFinite(now)) return Math.max(0, now - start);

        const explicitLeft = Number(td.timeLeftToStart);
        if (Number.isFinite(explicitLeft) && raceDataReceivedPerfMs) {
            const elapsedSincePayload = Math.max(0, performance.now() - raceDataReceivedPerfMs) / 1000;
            return Math.max(0, elapsedSincePayload - explicitLeft);
        }
        return NaN;
    }

    function raceDataLiveProgressState_(maxFinal) {
        const elapsedRaw = raceDataLiveElapsedSeconds_();
        if (!Number.isFinite(elapsedRaw)) return null;
        const elapsed = maxFinal > 0 ? clamp_(elapsedRaw, 0, maxFinal) : Math.max(0, elapsedRaw);
        const total = analysis?.laps || getOfficialLapCount_(raceMeta?.track || "");
        let cur = NaN;
        if (total && analysis?.drivers?.length) {
            const driver = replayMomentDriver_() || analysis.drivers[0];
            const state = currentDistanceAtTime_(driver, elapsed);
            cur = elapsed <= 0.05 ? 0 : (state.finished && !driver?.crashed ? total : clamp_((state.lapIndex || 0) + 1, 1, total));
        }
        const pct = maxFinal > 0 ? clamp_(elapsed / maxFinal * 100, 0, 100) : NaN;
        const started = raceDataStarted_() || elapsed > 0.05;
        return {
            elapsed,
            pct,
            lap: { cur, total: total || NaN, raw: "raceData-clock" },
            hasProgress: true,
            started,
            finished: maxFinal > 0 && elapsed >= maxFinal - 0.05,
            source: "raceData-clock"
        };
    }

    function visualProgressElement_(key) {
        if (!canScanTornPage_()) return null;
        const selectors = VISUAL_PROGRESS_SELECTORS[key] || [];
        for (const sel of selectors) {
            try {
                const el = document.querySelector(sel);
                if (el) return el;
            } catch {}
        }
        return null;
    }

    function visualProgressText_(key) {
        const el = visualProgressElement_(key);
        return String(el?.textContent || "").trim();
    }

    function visualProgressPanelText_() {
        if (!canScanTornPage_()) return "";
        const selectors = [
            "#racingdetails",
            "#racingupdatesnew",
            "#racingupdates",
            "[class*='race-details']",
            "[class*='racing-details']"
        ];
        for (const sel of selectors) {
            try {
                const txt = String(document.querySelector(sel)?.textContent || "").replace(/\s+/g, " ").trim();
                if (txt && (/\bLap:\s*\d+\s*\/\s*\d+/i.test(txt) || /\bCompletion:\s*\d+(?:\.\d+)?\s*%/i.test(txt))) return txt;
            } catch {}
        }
        return "";
    }

    function parseVisualLap_() {
        const direct = visualProgressText_("lap");
        const raw = direct || visualProgressPanelText_();
        const m = raw.match(/(\d+)\s*\/\s*(\d+)/);
        if (!m) return { cur: NaN, total: NaN, raw: "" };
        return { cur: Number(m[1]), total: Number(m[2]), raw };
    }

    function parseVisualCompletion_() {
        const direct = visualProgressText_("completion");
        const panel = direct ? "" : visualProgressPanelText_();
        const raw = direct || ((panel.match(/\bCompletion:\s*([^|]+?)(?:\s+\w+:|$)/i) || [])[1] || "").trim();
        if (!raw) return { pct: NaN, timeSeconds: NaN, raw: "" };
        const pct = raw.match(/(\d+(?:\.\d+)?)\s*%/);
        if (pct) return { pct: clamp_(Number(pct[1]), 0, 100), timeSeconds: NaN, raw };
        const ms = timeTextToMs_(raw);
        return { pct: NaN, timeSeconds: Number.isFinite(ms) ? ms / 1000 : NaN, raw };
    }

    function visualTimerSeconds_() {
        const raw = visualProgressText_("timer");
        if (!raw) return NaN;
        const ms = timeTextToMs_(raw);
        return Number.isFinite(ms) ? ms / 1000 : NaN;
    }

    function visualReplayProgressRatio_() {
        const progress = visualProgressElement_("replayProgress");
        const bar = visualProgressElement_("replayBar");
        if (!progress) return NaN;
        const attrs = [
            progress.getAttribute("aria-valuenow"),
            progress.getAttribute("data-value"),
            progress.style?.width,
            progress.getAttribute("style")
        ].filter(Boolean);
        for (const raw of attrs) {
            const m = String(raw).match(/(\d+(?:\.\d+)?)\s*%?/);
            if (!m) continue;
            const value = Number(m[1]);
            if (Number.isFinite(value)) return clamp_(value > 1 ? value / 100 : value, 0, 1);
        }
        try {
            const w = progress.getBoundingClientRect().width;
            const bw = bar?.getBoundingClientRect().width || progress.parentElement?.getBoundingClientRect().width || 0;
            if (bw > 0 && w >= 0) return clamp_(w / bw, 0, 1);
        } catch {}
        return NaN;
    }

    function visualRaceProgressState_() {
        const maxFinal = maxAnalysisFinalTime_();
        const ctx = getRaceContext_();
        if (ctx !== "replay") {
            const liveState = raceDataLiveProgressState_(maxFinal);
            if (liveState) return liveState;
        }
        const lap = parseVisualLap_();
        const comp = parseVisualCompletion_();
        const timer = visualTimerSeconds_();
        const replayRatio = ctx === "replay" ? visualReplayProgressRatio_() : NaN;
        const info = visualProgressText_("info").toLowerCase();
        let elapsed = NaN;
        let pct = Number.isFinite(comp.pct) ? comp.pct : NaN;
        let hasProgress = false;

        if (ctx === "replay") {
            // Torn's replay progress bar can report the loaded replay extent before
            // playback has visually reached that point. The visible timer is the
            // safer authority for pause/review moments.
            if (Number.isFinite(timer)) {
                elapsed = maxFinal > 0 ? clamp_(timer, 0, maxFinal) : Math.max(0, timer);
                hasProgress = true;
            } else if (Number.isFinite(replayRatio) && maxFinal > 0) {
                pct = replayRatio * 100;
                elapsed = replayRatio * maxFinal;
                hasProgress = true;
            }
        } else {
            if (Number.isFinite(comp.pct) && maxFinal > 0) {
                elapsed = comp.pct / 100 * maxFinal;
                hasProgress = true;
            }
            if (Number.isFinite(comp.timeSeconds)) {
                elapsed = maxFinal > 0 ? maxFinal : comp.timeSeconds;
                pct = 100;
                hasProgress = true;
            }
            if (!hasProgress && Number.isFinite(lap.cur) && Number.isFinite(lap.total) && lap.total > 0 && maxFinal > 0) {
                const lapPct = clamp_(lap.cur / lap.total, 0, 1);
                elapsed = lapPct * maxFinal;
                pct = lapPct * 100;
                hasProgress = true;
            }
        }

        if (!Number.isFinite(elapsed)) elapsed = 0;
        const started = hasProgress && (elapsed > 0.05 || pct > 0.01 || (Number.isFinite(lap.cur) && lap.cur > 0));
        const finishedByProgress = maxFinal > 0 && elapsed >= maxFinal - 0.05;
        const finishedByPct = Number.isFinite(pct) && pct >= 99.9;
        const finishedByLap = Number.isFinite(lap.cur) && Number.isFinite(lap.total) && lap.total > 0 && lap.cur >= lap.total && /finish|complete/i.test(info);
        return {
            elapsed: maxFinal > 0 ? clamp_(elapsed, 0, maxFinal) : Math.max(0, elapsed),
            pct,
            lap,
            hasProgress,
            started,
            finished: hasProgress && (finishedByProgress || finishedByPct || finishedByLap),
            source: ctx === "replay" ? (Number.isFinite(timer) ? "timer" : (Number.isFinite(replayRatio) ? "replay-progress" : "")) : (Number.isFinite(comp.pct) ? "completion" : (Number.isFinite(lap.cur) ? "lap" : ""))
        };
    }

    function raceMetaFromPayload_(payload, allowFallback = true) {
        const p = allowFallback ? (payload || latestRaceDataPayload || analysis?.payload || {}) : (payload || {});
        const log = extractRaceLogData_(p);
        const td = p.timeData || {};
        const startedIso = toIsoFromAt_(log.timeStarted || log.TimeStarted || "") || unixToIso_(td.timeStarted);
        const endedIso = toIsoFromAt_(log.timeEnded || log.TimeEnded || "") || unixToIso_(td.timeEnded);
        return {
            raceId: extractRaceIdFromPayloadOrUrl_(p),
            track: extractTrackNameFromPayloadOrMeta_(p),
            laps: extractLapsFromPayloadOrUi_(p),
            startedIso,
            endedIso,
            createdIso: toIsoFromAt_(log.TimeCreated || log.timeCreated || "") || "",
            name: log.title || p.name || "",
            type: log.type || p.type || "",
            carsAllowed: log.carsAllowed || p.cars_allowed || p.carsAllowed || "",
            upgradesAllowed: log.carsTypeAllowed || p.upgrades_allowed || p.upgradesAllowed || "",
            betAmount: log.betAmount ?? p.bet_amount ?? p.betAmount ?? "",
            currentDrivers: log.currentDrivers || Object.keys(p.cars || {}).length || "",
            userId: String(p.user?.userID || p.user?.userId || p.user?.id || log.userID || "").trim(),
            userName: String(p.user?.playername || p.user?.playerName || p.user?.name || "").trim()
        };
    }

    function maybeAcceptRaceDataPayload_(raw, source, url = "") {
        try {
            const payload = getRacePayload_(raw);
            if (!payload || !payload.cars) return false;
            const sourceText = String(source || "");
            const sourceUrl = String(url || "");
            const isCurrentEndpoint = !isReplayPage_() && (sourceText.includes("direct-current-racingData") || isEmptyRaceIdRacingDataUrl_(sourceUrl));
            let payloadRid = directRaceIdFromPayload_(payload);
            if (isCurrentEndpoint) {
                if (!currentRacingDataMatchesVisibleGridCached_(payload)) {
                    payload.__mpgIgnoreRaceId = true;
                    maybeAutoFetchDriverIntel_();
                    uiDirty = true;
                    scheduleRender_();
                    return true;
                }
                delete payload.__mpgIgnoreRaceId;
                payload.__mpgVerifiedCurrentRace = true;
                payloadRid = directRaceIdFromPayload_(payload);
                if (payloadRid) directCurrentRaceId = payloadRid;
                cacheDirectRacingDataParticipants_(payload);
            }
            const pageRid = getRaceId_();
            if (pageRid && payloadRid && pageRid !== payloadRid && !isCurrentEndpoint) return false;
            const payloadKey = raceDataPayloadKey_(payload);
            if (clearedRaceDataKey && payloadKey === clearedRaceDataKey) return false;
            lastHeavyRaceStats = heavyRaceStatsFromPayload_(payload);
            if (maybeSkipDuplicateRaceDataPayload_(payload, payloadRid || pageRid || directCurrentRaceId)) {
                if (analysis) syncRaceMetaFromAnalysis_();
                markDirty_({ status: true });
                scheduleRender_();
                return true;
            }
            latestRaceDataPayload = payload;
            persistBigRaceRawPayload_(payload);
            raceDataReceivedPerfMs = performance.now();
            raceDataCurrentTimeAtReceive = Number(payload?.timeData?.currentTime);
            clearedRaceDataKey = "";
            buildAnalysisFromRaceData_(payload);
            maybeSwitchReplayAnalysisMode_(payload, source);
            markPlayerRaceDataAvailable_();
            if (debugEnabled) console.log(TAG, "raceData captured", source || "", analysis);
            pgPlayerCacheRaceData_(payload, source || "captured-racingData")
                .then(() => { if (bigRaceObservationShouldPause_()) disconnectJoinRaceObserver_(); })
                .catch(() => {});
            const notifyKey = analysis?.raceId || raceDataPayloadKey_(analysis?.payload || payload);
            if (shouldPopulateFinalAnalysisNow_() && notifyKey && finalAnalysisNotifiedForRaceId !== notifyKey) {
                finalAnalysisNotifiedForRaceId = notifyKey;
                if (getRaceContext_() === "replay") toast_("Pit Guru imported replay data: final leaderboard and analysis ready.");
                else if (allowPreFinishPreview && !raceIsFinished_()) toast_("Preview mode enabled: final data shown from delivered race JSON.");
                else toast_("Pit Guru final analysis ready.");
                updateRecordsFromAnalysis_();
            }
            maybeAutoFetchDriverIntel_();
            markDirty_({ data: true, layout: true, status: true });
            scheduleRender_();
            return true;
        } catch (e) {
            if (debugEnabled) console.warn(TAG, "raceData parse failed", source, e);
            return false;
        }
    }

    function installPageRaceDataBridge_() {
        if (pageRaceDataBridgeInstalled) return;
        pageRaceDataBridgeInstalled = true;
        const eventName = "mpg-pit-guru-racedata";
        document.addEventListener(eventName, ev => {
            try {
                const detail = JSON.parse(String(ev.detail || "{}"));
                if (detail?.data) maybeAcceptRaceDataPayload_(detail.data, detail.source || "page", detail.url || "");
            } catch {}
        });
        try {
            const script = document.createElement("script");
            const nonceEl = document.querySelector("script[nonce],[nonce]");
            const nonce = String(nonceEl?.nonce || nonceEl?.getAttribute?.("nonce") || "").trim();
            if (!nonce) {
                if (debugEnabled) console.warn(TAG, "page raceData bridge skipped: Torn page nonce not found");
                return;
            }
            script.nonce = nonce;
            script.setAttribute("nonce", nonce);
            script.textContent = `(() => {
                if (window.__mpgPitGuruRaceDataBridge) return;
                window.__mpgPitGuruRaceDataBridge = true;
                const EVENT = "${eventName}";
                const looksUseful = data => {
                    try {
                        const p = data && (data.raceData || data);
                        return !!(p && p.trackData && p.cars);
                    } catch { return false; }
                };
                const emit = (data, source, url) => {
                    try {
                        if (!looksUseful(data)) return;
                        document.dispatchEvent(new CustomEvent(EVENT, {
                            detail: JSON.stringify({ source, url: String(url || ""), data })
                        }));
                    } catch {}
                };
                try {
                    const nativeFetch = window.fetch;
                    if (typeof nativeFetch === "function") {
                        window.fetch = function(...args) {
                            const p = nativeFetch.apply(this, args);
                            p.then(resp => {
                                try {
                                    const url = String((resp && resp.url) || (args[0] && args[0].url) || args[0] || "");
                                    if (!/race|racing/i.test(url)) return;
                                    resp.clone().json().then(json => emit(json, "page-fetch", url)).catch(() => {});
                                } catch {}
                            }).catch(() => {});
                            return p;
                        };
                    }
                } catch {}
                try {
                    const NativeXHR = window.XMLHttpRequest;
                    if (typeof NativeXHR === "function") {
                        const open = NativeXHR.prototype.open;
                        const send = NativeXHR.prototype.send;
                        NativeXHR.prototype.open = function(method, url) {
                            this.__mpgPitGuruUrl = String(url || "");
                            return open.apply(this, arguments);
                        };
                        NativeXHR.prototype.send = function() {
                            this.addEventListener("load", function() {
                                try {
                                    const url = String(this.__mpgPitGuruUrl || this.responseURL || "");
                                    if (!/race|racing/i.test(url)) return;
                                    if (this.response && typeof this.response === "object") {
                                        emit(this.response, "page-xhr-object", url);
                                        return;
                                    }
                                    const txt = String(this.responseText || "");
                                    if (!txt || !/(trackData|raceData|cars)/.test(txt)) return;
                                    emit(JSON.parse(txt), "page-xhr-text", url);
                                } catch {}
                            });
                            return send.apply(this, arguments);
                        };
                    }
                } catch {}
            })();`;
            (document.documentElement || document.head || document.body)?.appendChild(script);
            script.remove();
        } catch {}
    }

    function hookRaceDataObservers_() {
        if (analysisHooked) return;
        analysisHooked = true;
        installPageRaceDataBridge_();
        const hookWindow = (typeof unsafeWindow !== "undefined" && unsafeWindow) ? unsafeWindow : window;
        try {
            const nativeFetch = hookWindow.fetch;
            if (typeof nativeFetch === "function") {
                hookWindow.fetch = function (...args) {
                    const p = nativeFetch.apply(this, args);
                    p.then(resp => {
                        try {
                            const url = String(resp?.url || args[0]?.url || args[0] || "");
                            if (!/race|racing/i.test(url)) return;
                            resp.clone().json().then(json => maybeAcceptRaceDataPayload_(json, "fetch", url)).catch(() => {});
                        } catch {}
                    }).catch(() => {});
                    return p;
                };
            }
        } catch {}
        try {
            const NativeXHR = hookWindow.XMLHttpRequest;
            if (typeof NativeXHR === "function") {
                const open = NativeXHR.prototype.open;
                const send = NativeXHR.prototype.send;
                NativeXHR.prototype.open = function (method, url) {
                    this.__mpgUrl = String(url || "");
                    return open.apply(this, arguments);
                };
                NativeXHR.prototype.send = function () {
                    this.addEventListener("load", () => {
                        try {
                            if (!/race|racing/i.test(this.__mpgUrl || "")) return;
                            const ct = String(this.getResponseHeader?.("content-type") || "");
                            if (ct && !/json|javascript|text/i.test(ct)) return;
                            if (this.response && typeof this.response === "object") {
                                maybeAcceptRaceDataPayload_(this.response, "xhr-object", this.__mpgUrl || this.responseURL || "");
                                return;
                            }
                            const txt = String(this.responseText || "");
                            if (!txt || !/(trackData|raceData|cars)/.test(txt)) return;
                            maybeAcceptRaceDataPayload_(JSON.parse(txt), "xhr", this.__mpgUrl || this.responseURL || "");
                        } catch {}
                    });
                    return send.apply(this, arguments);
                };
            }
        } catch {}
    }

    function decodeRaceCars_(payload) {
        const cars = payload?.cars || payload?.raceData?.cars || {};
        const findRacer = (name, index) => {
            const sources = [payload?.racers, payload?.drivers, payload?.carInfo, payload?.raceData?.racers, payload?.raceData?.drivers, payload?.raceData?.carInfo];
            const nn = normalizeDriverName_(name);
            for (const src of sources) {
                if (!src) continue;
                if (Array.isArray(src)) {
                    const exact = src.find(x => normalizeDriverName_(x?.name || x?.playername || x?.playerName || x?.username || "") === nn);
                    if (exact) return exact;
                    if (src[index]) return src[index];
                } else if (typeof src === "object") {
                    if (src[name]) return src[name];
                    const entry = Object.entries(src).find(([k, v]) => normalizeDriverName_(k) === nn || normalizeDriverName_(v?.name || v?.playername || v?.playerName || v?.username || "") === nn);
                    if (entry) {
                        const [key, value] = entry;
                        const keyId = /^\d+$/.test(String(key || "")) ? String(key) : "";
                        if (value && typeof value === "object") return Object.assign({ id: keyId || value.id }, value);
                        return { id: keyId, name: String(value || key || "") };
                    }
                }
            }
            return {};
        };
        return Object.entries(cars).map(([name, encoded], index) => {
            let segmentTimes = [];
            try {
                const decoded = typeof encoded === "string" ? atob(encoded) : "";
                segmentTimes = decoded.split(",").map(Number).filter(v => Number.isFinite(v) && v > 0);
            } catch {}
            const racer = findRacer(name, index);
            const isCurrentUser = normalizeDriverName_(payload?.user?.playername) === normalizeDriverName_(name);
            return {
                name: String(racer.playername || racer.playerName || racer.name || name || `Driver ${index + 1}`),
                racingSkill: safeNum_(racer.racingSkill ?? racer.racing_skill ?? racer.skill ?? (isCurrentUser ? payload?.user?.racinglevel : NaN), NaN),
                itemID: racer.itemID || racer.itemId || racer.item_id || racer.imteID || racer.carItemID || racer.carItemId || "",
                car: toOgCarName_(racer.car || racer.carTitle || racer.car_title || ""),
                carImg: String(racer.carImg || racer.carImage || racer.car_image || ""),
                driverId: String(racer.driverId || racer.userID || racer.userId || racer.userid || racer.user_id || racer.playerId || racer.player_id || racer.profileId || racer.profile_id || racer.tornId || racer.torn_id || racer.xid || racer.id || ""),
                startPosition: index + 1,
                segmentTimes
            };
        }).filter(d => d.segmentTimes.length);
    }

    function extractSegmentDistances_(payload, segmentsPerLap, lapMeters) {
        const intervals = payload?.trackData?.intervals || payload?.raceData?.trackData?.intervals || [];
        if (Array.isArray(intervals) && intervals.length) {
            const nums = intervals.map(v => {
                if (typeof v === "number") return v;
                if (v && typeof v === "object") return Number(v.distance ?? v.length ?? v.interval ?? v.meters ?? v.value);
                return NaN;
            }).filter(v => Number.isFinite(v) && v > 0);
            if (nums.length) {
                const sum = nums.reduce((a, b) => a + b, 0);
                if (sum > lapMeters * 2) return nums.slice(0, segmentsPerLap);
                return nums.map(v => (v / sum) * lapMeters).slice(0, segmentsPerLap);
            }
        }
        return Array.from({ length: segmentsPerLap }, () => lapMeters / Math.max(1, segmentsPerLap));
    }

    function extractRouteSvg_(payload) {
        const candidates = [
            payload?.imagePath,
            payload?.imagePath2,
            payload?.raceData?.imagePath,
            payload?.raceData?.imagePath2,
            payload?.trackData?.imagePath,
            payload?.trackData?.svgPath,
            payload?.trackData?.routePath
        ];
        for (const c of candidates) {
            const s = String(c || "").trim();
            if (s && /<svg|<path|<polygon|<polyline|\bpoints\s*=|[MLCQZ][\d\s.,-]/i.test(s)) return s;
        }
        return "";
    }

    function extractRouteViewBox_(svgText) {
        const text = String(svgText || "");
        const viewBox = text.match(/\bviewBox\s*=\s*(["'])([\s\S]*?)\1/i)?.[2]?.replace(/\s+/g, " ").trim();
        if (viewBox) return viewBox;
        const width = Number(text.match(/\bwidth\s*=\s*(["'])([\d.]+)\1/i)?.[2]);
        const height = Number(text.match(/\bheight\s*=\s*(["'])([\d.]+)\1/i)?.[2]);
        if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) return `0 0 ${width} ${height}`;
        return "";
    }

    function pointsToPathD_(pointsText, closePath = false) {
        const nums = String(pointsText || "").match(/-?\d*\.?\d+(?:e[-+]?\d+)?/ig)?.map(Number).filter(Number.isFinite) || [];
        if (nums.length < 4) return "";
        const points = [];
        for (let i = 0; i + 1 < nums.length; i += 2) points.push([nums[i], nums[i + 1]]);
        if (points.length < 2) return "";
        const body = points.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
        return closePath ? `${body} Z` : body;
    }

    function extractRoutePathD_(svgText) {
        const text = String(svgText || "");
        if (!text) return "";
        if (!/<path\b/i.test(text) && /^[MLCQZ][\d\s.,A-Za-z-]+$/i.test(text.trim())) return text.trim();
        const paths = [...text.matchAll(/<path\b[^>]*>/ig)]
            .map(m => {
                const tag = m[0] || "";
                const d = tag.match(/\bd\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
                const fill = tag.match(/\bfill\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
                const stroke = tag.match(/\bstroke\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
                return { d: d.replace(/\s+/g, " ").trim(), fill, stroke };
            })
            .filter(p => p.d);
        if (paths.length) {
            paths.sort((a, b) => {
                const aRoute = /none/i.test(a.fill) || a.stroke;
                const bRoute = /none/i.test(b.fill) || b.stroke;
                if (aRoute !== bRoute) return aRoute ? -1 : 1;
                return b.d.length - a.d.length;
            });
            return paths[0].d;
        }

        const shapes = [...text.matchAll(/<(polygon|polyline)\b[^>]*>/ig)]
            .map(m => {
                const tagName = String(m[1] || "").toLowerCase();
                const tag = m[0] || "";
                const points = tag.match(/\bpoints\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
                const fill = tag.match(/\bfill\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
                const stroke = tag.match(/\bstroke\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
                return {
                    d: pointsToPathD_(points, tagName === "polygon"),
                    fill,
                    stroke
                };
            })
            .filter(p => p.d);
        if (!shapes.length) return "";
        shapes.sort((a, b) => {
            const aRoute = /none/i.test(a.fill) || a.stroke;
            const bRoute = /none/i.test(b.fill) || b.stroke;
            if (aRoute !== bRoute) return aRoute ? -1 : 1;
            return b.d.length - a.d.length;
        });
        return shapes[0].d;
    }

    function localTrackRouteText_(trackName) {
        const row = pgLocalTrackMeta_(trackName);
        if (!row) return null;
        const routeSvg = String(row.routeSvg || row.RouteSvg || "").trim();
        if (routeSvg) return { text: routeSvg, source: "sqlite.tracks.RouteSvg" };
        const routePath = String(row.routePath || row.RoutePath || "").trim();
        if (routePath) return { text: routePath, source: "sqlite.tracks.RoutePath" };
        return null;
    }

    function extractPictureIdFromPayload_(payload) {
        return payload?.imageID || payload?.imageId || payload?.raceData?.imageID || payload?.raceData?.imageId || payload?.logData?.imageID || payload?.logData?.imageId || "";
    }

    function maybePersistTrackRouteFromPayload_(payload, trackName, routeModel) {
        const routeSvg = extractRouteSvg_(payload);
        const routePath = routeModel?.pathD || extractRoutePathD_(routeSvg);
        if (!routeSvg || !routePath || !trackName) return;
        const key = `${pgLocalNorm_(trackName)}|${garageHash_(routePath)}|${garageHash_(routeSvg)}`;
        if (pgLocalTrackRouteSavedKeys.has(key)) return;
        pgLocalTrackRouteSavedKeys.add(key);
        pgLocalUpsertTrackRoute({
            trackName,
            pictureId: extractPictureIdFromPayload_(payload),
            routeSvg,
            routePath,
            routeViewBox: extractRouteViewBox_(routeSvg),
            routeLength: routeModel?.totalSvgLength || null,
            routeSource: "torn-racingData"
        }).then(() => {
            pgLocalEnsureTracks_(true).catch(() => {});
        }).catch(error => {
            pgLocalTrackRouteSavedKeys.delete(key);
            if (debugEnabled) console.warn(TAG, "track route save failed", error);
        });
    }

    function buildRouteModelFromPayload_(payload, lapMeters, trackName = "") {
        if (!Number.isFinite(lapMeters) || lapMeters <= 0 || typeof document === "undefined") return null;
        const payloadRoute = extractRouteSvg_(payload);
        const localRoute = payloadRoute ? null : localTrackRouteText_(trackName);
        const routeText = payloadRoute || localRoute?.text || "";
        const pathD = extractRoutePathD_(routeText);
        if (!pathD) return null;
        let host = null;
        try {
            const ns = "http://www.w3.org/2000/svg";
            host = document.createElementNS(ns, "svg");
            host.setAttribute("width", "520");
            host.setAttribute("height", "245");
            host.setAttribute("viewBox", "0 0 520 245");
            host.style.cssText = "position:absolute;left:-99999px;top:-99999px;width:520px;height:245px;visibility:hidden;overflow:hidden;pointer-events:none;";
            const path = document.createElementNS(ns, "path");
            path.setAttribute("d", pathD);
            host.appendChild(path);
            (document.body || document.documentElement).appendChild(host);
            if (typeof path.getTotalLength !== "function" || typeof path.getPointAtLength !== "function") return null;
            const totalSvgLength = path.getTotalLength();
            if (!Number.isFinite(totalSvgLength) || totalSvgLength <= 0) return null;
            const sampleCount = Math.round(clamp_(totalSvgLength / 2, 180, 720));
            const samples = [];
            for (let i = 0; i <= sampleCount; i++) {
                const len = (totalSvgLength * i) / sampleCount;
                const p = path.getPointAtLength(len);
                samples.push({ len, x: p.x, y: p.y });
            }
            return { pathD, totalSvgLength, lapMeters, samples, source: payloadRoute ? "race-json" : (localRoute?.source || "unknown") };
        } catch (e) {
            if (debugEnabled) console.warn(TAG, "route SVG parse failed", e);
            return null;
        } finally {
            try { host?.remove?.(); } catch {}
        }
    }

    function positiveModulo_(value, modulo) {
        if (!Number.isFinite(value) || !Number.isFinite(modulo) || modulo <= 0) return 0;
        return ((value % modulo) + modulo) % modulo;
    }

    function routePointAtMeters_(route, distanceMeters) {
        if (!route?.samples?.length || !Number.isFinite(route.lapMeters) || route.lapMeters <= 0) return null;
        const lapDistance = positiveModulo_(distanceMeters, route.lapMeters);
        const sampleMax = route.samples.length - 1;
        const pos = (lapDistance / route.lapMeters) * sampleMax;
        const i = Math.floor(clamp_(pos, 0, sampleMax));
        const a = route.samples[i];
        const b = route.samples[Math.min(sampleMax, i + 1)] || a;
        const pct = clamp_(pos - i, 0, 1);
        return {
            x: a.x + (b.x - a.x) * pct,
            y: a.y + (b.y - a.y) * pct
        };
    }

    function angleDelta_(a, b) {
        let d = a - b;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return d;
    }

    function routeCurvatureAtMeters_(route, distanceMeters) {
        if (!route?.samples?.length || !Number.isFinite(route.lapMeters) || route.lapMeters <= 0) return NaN;
        const windowMeters = clamp_(route.lapMeters / 45, 35, 100);
        const p0 = routePointAtMeters_(route, distanceMeters - windowMeters);
        const p1 = routePointAtMeters_(route, distanceMeters);
        const p2 = routePointAtMeters_(route, distanceMeters + windowMeters);
        if (!p0 || !p1 || !p2) return NaN;
        const h0 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        const h1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const turn = angleDelta_(h1, h0);
        return turn / Math.max(1, windowMeters * 2);
    }

    function cumulative_(arr) {
        const out = [];
        let sum = 0;
        for (const v of arr) {
            sum += safeNum_(v, 0);
            out.push(sum);
        }
        return out;
    }

    function getCompletedFullLaps_(driver, segmentsPerLap) {
        const actualSegments = Array.isArray(driver?.segmentTimes) ? driver.segmentTimes.length : 0;
        return Math.floor(actualSegments / Math.max(1, segmentsPerLap));
    }

    function isLapComplete_(driver, lapIndex, segmentsPerLap) {
        const endExclusive = lapIndex * segmentsPerLap + segmentsPerLap;
        return Array.isArray(driver?.segmentTimes) && driver.segmentTimes.length >= endExclusive;
    }

    function getValidLapTimes_(driver, segmentsPerLap) {
        const completedLaps = getCompletedFullLaps_(driver, segmentsPerLap);
        const lapTimes = [];
        for (let lapIndex = 0; lapIndex < completedLaps; lapIndex++) {
            if (!isLapComplete_(driver, lapIndex, segmentsPerLap)) continue;
            const segments = driver.segmentTimes.slice(lapIndex * segmentsPerLap, lapIndex * segmentsPerLap + segmentsPerLap);
            if (segments.length !== segmentsPerLap || segments.some(v => !Number.isFinite(v) || v <= 0)) continue;
            lapTimes.push({ lap: lapIndex + 1, seconds: segments.reduce((sum, v) => sum + v, 0), valid: true });
        }
        return lapTimes;
    }

    function makeSectorSplitIndexes_(segmentsPerLap) {
        const s1 = Math.max(1, Math.round(segmentsPerLap / 3));
        const s2 = Math.max(s1 + 1, Math.round(segmentsPerLap * 2 / 3));
        return [s1, Math.min(segmentsPerLap - 1, s2), segmentsPerLap];
    }

    function buildAnalysisFromRaceData_(payload) {
        const decoded = decodeRaceCars_(payload);
        if (!decoded.length) return null;
        const trackName = extractTrackNameFromPayloadOrMeta_(payload);
        const trackKey = makeTrackLookupKey_(trackName);
        const trackMeta = TRACK_META[trackKey] || null;
        const laps = extractLapsFromPayloadOrUi_(payload);
        const heavyStats = heavyRaceStatsFromPayload_(payload);
        const bigRaceIdentity = bigRaceCacheIdentity_(payload);
        lastHeavyRaceStats = heavyStats;
        if (heavyStats.heavyRace) persistBigRaceRawPayload_(payload);
        let engineModel = null;
        try {
            engineModel = PitGuruRaceEngine.parseRaceData(payload, { laps });
        } catch (e) {
            if (debugEnabled) console.warn(TAG, "race engine parse failed", e);
        }
        const engineByName = new Map();
        const engineById = new Map();
        for (const ed of engineModel?.drivers || []) {
            engineByName.set(normalizeDriverName_(ed.name), ed);
            if (ed.userID) engineById.set(String(ed.userID), ed);
            if (ed.key) engineById.set(String(ed.key), ed);
        }
        const maxSegments = Math.max(...decoded.map(d => d.segmentTimes.length));
        const segmentsPerLap = Math.max(1, Math.round(maxSegments / Math.max(1, laps)));
        const lapMeters = trackMeta ? trackMeta.lapKm * 1000 : 0;
        const baseSegmentDistances = lapMeters > 0 ? extractSegmentDistances_(payload, segmentsPerLap, lapMeters) : [];
        const routeModel = lapMeters > 0 ? buildRouteModelFromPayload_(payload, lapMeters, trackName) : null;
        maybePersistTrackRouteFromPayload_(payload, trackName, routeModel);
        const sectorSplitIndexes = makeSectorSplitIndexes_(segmentsPerLap);
        const expectedSegments = segmentsPerLap * laps;
        const drivers = decoded.map(d => {
            const engineDriver = engineById.get(String(d.driverId || "")) || engineByName.get(normalizeDriverName_(d.name)) || null;
            const repeatedDistances = d.segmentTimes.map((_, i) => baseSegmentDistances.length ? baseSegmentDistances[i % segmentsPerLap] : 0);
            const cumulativeTimes = cumulative_(d.segmentTimes);
            const cumulativeDistances = cumulative_(repeatedDistances);
            const validLapTimes = getValidLapTimes_(d, segmentsPerLap);
            const lapTimes = validLapTimes.map(x => x.seconds);
            const finalTime = cumulativeTimes[cumulativeTimes.length - 1] || 0;
            const speeds = d.segmentTimes.map((t, i) => repeatedDistances[i] > 0 ? repeatedDistances[i] / t : NaN);
            const sectorTimes = [];
            for (let lap = 0; lap < getCompletedFullLaps_(d, segmentsPerLap); lap++) {
                let start = lap * segmentsPerLap;
                for (let s = 0; s < 3; s++) {
                    const end = lap * segmentsPerLap + sectorSplitIndexes[s];
                    if (d.segmentTimes.length >= end) {
                        const endTime = cumulativeTimes[end - 1] || 0;
                        const startTime = start > 0 ? (cumulativeTimes[start - 1] || 0) : 0;
                        sectorTimes.push({ sector: s + 1, lap: lap + 1, seconds: endTime - startTime });
                    }
                    start = end;
                }
            }
            const crashed = d.segmentTimes.length < expectedSegments;
            const bestLap = lapTimes.length ? Math.min(...lapTimes) : null;
            const avgLap = lapTimes.length ? lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length : null;
            const idealLap = [1, 2, 3].map(sec => Math.min(...sectorTimes.filter(x => x.sector === sec).map(x => x.seconds))).filter(Number.isFinite).reduce((a, b) => a + b, 0);
            return {
                ...d,
                driverId: d.driverId || engineDriver?.userID || "",
                engineKey: engineDriver?.key || "",
                engineDriver,
                segmentDistancesMeters: repeatedDistances,
                cumulativeTimes,
                cumulativeDistances,
                lapTimes,
                validLapTimes,
                sectorTimes,
                finalTime,
                crashed,
                completedFullLaps: getCompletedFullLaps_(d, segmentsPerLap),
                bestLapSeconds: bestLap,
                averageLapSeconds: avgLap,
                idealLapSeconds: idealLap || null,
                consistencyScore: lapTimes.length > 1 ? Math.max(0, 100 - (stdDev_(lapTimes) / avgLap * 100)) : null,
                topSpeedMps: maxFinite_(speeds),
                slowestSpeedMps: minFinite_(speeds),
                highestG: NaN,
                lowestG: NaN,
                highestLateralG: NaN,
                sectorsWon: 0,
                lapsLed: 0,
                segmentsLed: 0,
                timeInLeadSeconds: 0,
                longestLeadStintSeconds: 0,
                leadChanges: 0
            };
        });
        analysis = {
            raceId: extractRaceIdFromPayloadOrUrl_(payload),
            trackName,
            trackKey,
            trackMeta,
            laps,
            heavyRace: heavyStats.heavyRace,
            heavyRaceStats: heavyStats,
            bigRaceCacheKey: bigRaceIdentity.key,
            bigRaceStaticSignature: bigRaceIdentity.signature,
            processedSummary: bigRaceProcessedSummaryCache.get(bigRaceIdentity.key) || null,
            segmentsPerLap,
            lapMeters,
            engineModel,
            segmentDistancesMeters: baseSegmentDistances,
            routeModel,
            sectorSplitIndexes,
            payload,
            drivers,
            leadStatsReady: false,
            sectorWinsReady: false
        };
        liveOrderCache = { key: "", value: [] };
        applyDriverIntelToModel_();
        syncRaceMetaFromAnalysis_();
        persistBigRaceProcessedSummary_(analysis);
        return analysis;
    }

    function stdDev_(arr) {
        if (!arr.length) return 0;
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / arr.length);
    }

    function maxFinite_(arr) {
        let found = false;
        let max = -Infinity;
        for (const value of arr || []) {
            if (!Number.isFinite(value)) continue;
            if (value > max) max = value;
            found = true;
        }
        return found ? max : NaN;
    }

    function minFinite_(arr) {
        let found = false;
        let min = Infinity;
        for (const value of arr || []) {
            if (!Number.isFinite(value)) continue;
            if (value < min) min = value;
            found = true;
        }
        return found ? min : NaN;
    }

    function syncRaceMetaFromAnalysis_() {
        if (!analysis) return;
        ensureRaceMeta_();
        if (!raceMeta) return;
        const meta = raceMetaFromPayload_(analysis.payload);
        ensurePlayer_();
        const me = analysis.drivers.find(isUserDriver_) || analysis.drivers.find(d => normalizeDriverName_(d.name) === normalizeDriverName_(meta.userName)) || null;
        raceMeta.track = analysis.trackName || raceMeta.track;
        raceMeta.raceId = analysis.payload?.__mpgIgnoreRaceId ? (analysis.raceId || "") : (analysis.raceId || raceMeta.raceId || "");
        raceMeta.laps = analysis.laps || meta.laps || raceMeta.laps || "";
        raceMeta.startAtIso = meta.startedIso || raceMeta.startAtIso || "";
        raceMeta.endAtIso = meta.endedIso || raceMeta.endAtIso || "";
        raceMeta.createdAtIso = meta.createdIso || raceMeta.createdAtIso || "";
        raceMeta.replayInfo = {
            name: meta.name || raceMeta.replayInfo?.name || "",
            type: meta.type || raceMeta.replayInfo?.type || "",
            cars_allowed: meta.carsAllowed || raceMeta.replayInfo?.cars_allowed || "",
            upgrades_allowed: meta.upgradesAllowed || raceMeta.replayInfo?.upgrades_allowed || "",
            bet_amount: meta.betAmount ?? raceMeta.replayInfo?.bet_amount ?? "",
            time_started: meta.startedIso ? reportDateText_(meta.startedIso) : (raceMeta.replayInfo?.time_started || ""),
            time_ended: meta.endedIso ? reportDateText_(meta.endedIso) : (raceMeta.replayInfo?.time_ended || ""),
            laps: meta.laps || raceMeta.replayInfo?.laps || ""
        };
        if (meta.userId && !playerId) playerId = meta.userId;
        if (meta.userName && !playerName) playerName = meta.userName;
        if (me) {
            raceMeta.driver = me.name || raceMeta.driver || meta.userName || "";
            raceMeta.driverId = me.driverId || raceMeta.driverId || meta.userId || "";
            raceMeta.car = toOgCarName_(me.car) || raceMeta.car || "";
            raceMeta.carImg = me.carImg || raceMeta.carImg || "";
        }
        raceMeta.theme = theme;
        saveRaceMeta_(raceMeta);
    }

    function engineDriverForAnalysisDriver_(driver) {
        if (!analysis?.engineModel || !driver) return null;
        if (driver.engineDriver) return driver.engineDriver;
        const id = String(driver.engineKey || driver.driverId || "");
        if (id) {
            const byId = analysis.engineModel.drivers.find(ed => String(ed.key || "") === id || String(ed.userID || "") === id);
            if (byId) return byId;
        }
        const name = normalizeDriverName_(driver.name);
        return analysis.engineModel.drivers.find(ed => normalizeDriverName_(ed.name) === name) || null;
    }

    function analysisDriverForEngineDriver_(engineDriver) {
        if (!analysis?.drivers?.length || !engineDriver) return null;
        const id = String(engineDriver.userID || engineDriver.key || "");
        if (id) {
            const byId = analysis.drivers.find(d => String(d.engineKey || "") === id || String(d.driverId || "") === id);
            if (byId) return byId;
        }
        const name = normalizeDriverName_(engineDriver.name);
        return analysis.drivers.find(d => d.engineDriver === engineDriver || normalizeDriverName_(d.name) === name) || null;
    }

    function engineStateToAnalysisState_(engineState, driver) {
        const model = analysis?.engineModel || null;
        const rawLapLength = Number(model?.trackLength) || 0;
        const metersPerRaw = analysis?.lapMeters && rawLapLength > 0 ? analysis.lapMeters / rawLapLength : 1;
        const finalTime = driver?.finalTime || driver?.engineDriver?.finalSeconds || 0;
        const finished = !!engineState?.finished || (finalTime > 0 && Number(engineState?.elapsedSeconds) >= finalTime);
        return {
            distance: Math.max(0, Number(engineState?.location) || 0) * metersPerRaw,
            segmentIndex: Math.max(0, Number(engineState?.segmentIndex) || 0),
            finished,
            crashed: !!engineState?.crashed || (!!driver?.crashed && finished),
            lapIndex: Math.max(0, Math.floor((Number(engineState?.segmentIndex) || 0) / Math.max(1, analysis?.segmentsPerLap || 1))),
            segmentElapsed: Math.max(0, Number(engineState?.segmentElapsedSeconds) || 0),
            completionPct: Math.max(0, Number(engineState?.completionPct) || 0)
        };
    }

    function currentDistanceAtTime_(driver, elapsedSeconds) {
        const engineDriver = engineDriverForAnalysisDriver_(driver);
        if (analysis?.engineModel && engineDriver) {
            const finalTime = driver?.finalTime || engineDriver.finalSeconds || 0;
            const requested = Number.isFinite(Number(elapsedSeconds)) ? Math.max(0, Number(elapsedSeconds) || 0) : Math.max(0, finalTime + 0.001);
            const engineSeconds = finalTime > 0 && requested >= finalTime ? finalTime + 0.001 : requested;
            const engineState = PitGuruRaceEngine.getDriverLocationAt(analysis.engineModel, engineDriver, engineSeconds * 1000);
            return engineStateToAnalysisState_(engineState, driver);
        }
        if (!driver?.segmentTimes?.length) return { distance: 0, segmentIndex: 0, finished: false, lapIndex: 0, segmentElapsed: 0 };
        const t = Math.max(0, elapsedSeconds || 0);
        const times = driver.cumulativeTimes || [];
        const dists = driver.cumulativeDistances || [];
        const finalTime = times[times.length - 1] || 0;
        if (finalTime > 0 && t >= finalTime) {
            return {
                distance: dists[dists.length - 1] || 0,
                segmentIndex: Math.max(0, times.length - 1),
                finished: true,
                lapIndex: Math.floor(Math.max(0, times.length - 1) / Math.max(1, analysis?.segmentsPerLap || 1)),
                segmentElapsed: 0
            };
        }
        const i = firstIndexAtOrAfter_(times, t);
        if (i < times.length) {
            const prevTime = i ? times[i - 1] : 0;
            const prevDist = i ? dists[i - 1] : 0;
            const segTime = Math.max(0.001, driver.segmentTimes[i]);
            const pct = clamp_((t - prevTime) / segTime, 0, 1);
            return {
                distance: prevDist + pct * (driver.segmentDistancesMeters?.[i] || 0),
                segmentIndex: i,
                finished: false,
                lapIndex: Math.floor(i / Math.max(1, analysis?.segmentsPerLap || 1)),
                segmentElapsed: Math.max(0, t - prevTime)
            };
        }
        return {
            distance: dists[dists.length - 1] || 0,
            segmentIndex: times.length - 1,
            finished: true,
            lapIndex: Math.floor((times.length - 1) / Math.max(1, analysis?.segmentsPerLap || 1)),
            segmentElapsed: 0
        };
    }

    function maxAnalysisFinalTime_() {
        if (!analysis?.drivers?.length) return 0;
        return Math.max(...analysis.drivers.map(d => d.finalTime || 0).filter(Number.isFinite), 0);
    }

    function replayMomentDriver_() {
        if (!analysis?.drivers?.length) return null;
        const targetName = spectateName || playerName || raceMeta?.driver || "";
        const normalized = normalizeDriverName_(targetName);
        return analysis.drivers.find(d => normalizeDriverName_(d.name) === normalized) || analysis.drivers[0] || null;
    }

    function replayElapsedFromUi_() {
        const visual = visualRaceProgressState_();
        return visual.hasProgress ? visual.elapsed : 0;
    }

    function shouldRenderReplayMoment_() {
        if (allowPreFinishPreview) return false;
        const visual = visualRaceProgressState_();
        return visual.hasProgress && visual.started && !visual.finished;
    }

    function getRaceContext_() {
        return isReplayPage_() ? "replay" : "live";
    }

    function analysisCanShowFullRace_() {
        if (allowPreFinishPreview) return true;
        const visual = visualRaceProgressState_();
        if (visual.hasProgress) return visual.finished;
        if (getRaceContext_() === "replay" && analysis?.payload) return true;
        return false;
    }

    function shouldPopulateFinalAnalysisNow_() {
        if (allowPreFinishPreview) return true;
        const visual = visualRaceProgressState_();
        if (visual.hasProgress) return visual.finished;
        if (getRaceContext_() === "replay" && analysis?.payload) return true;
        return false;
    }

    function visualRaceHasStarted_() {
        if (!analysis) return false;
        const visual = visualRaceProgressState_();
        if (visual.hasProgress) return visual.started || visual.finished;
        return false;
    }

    function telemetryCanSample_(elapsed = 0) {
        if (!analysis) return false;
        if (analysisCanShowFullRace_()) return true;
        const visual = visualRaceProgressState_();
        if (visual.hasProgress) return visual.started || visual.finished;
        return Number.isFinite(elapsed) && elapsed > 0.05 && visualRaceHasStarted_();
    }

    function getRawVisualElapsed_() {
        if (!analysis) return 0;
        const visual = visualRaceProgressState_();
        if (visual.hasProgress) return visual.elapsed;
        if (!visualRaceHasStarted_()) {
            return 0;
        }
        return 0;
    }

    function liveVisualHasEnded_() {
        if (!analysis || getRaceContext_() === "replay") return false;
        const visual = visualRaceProgressState_();
        if (visual.hasProgress) return visual.finished;
        return false;
    }

    function getVisualElapsed_() {
        if (!analysis) return 0;
        if (shouldRenderReplayMoment_()) return getRawVisualElapsed_();
        if (analysisCanShowFullRace_()) return maxAnalysisFinalTime_();
        return getRawVisualElapsed_();
    }

    function currentLapDisplay_() {
        const total = analysis?.laps || getOfficialLapCount_(raceMeta?.track || "");
        if (!analysis || !total) return total ? `0/${total}` : "—";
        const driver = replayMomentDriver_() || analysis.drivers[0];
        const elapsed = getVisualElapsed_();
        const state = currentDistanceAtTime_(driver, elapsed);
        const cur = elapsed <= 0.05
            ? 0
            : (state.finished && !driver?.crashed ? total : clamp_((state.lapIndex || 0) + 1, 1, total));
        return `${cur}/${total}`;
    }

    function getLiveOrder_(elapsedSeconds, forceFull = null) {
        if (!analysis) return [];
        const full = forceFull == null ? (analysisCanShowFullRace_() && !shouldRenderReplayMoment_()) : !!forceFull;
        const fps = largeFieldMode_() ? (hugeFieldMode_() ? 1 : 2) : 8;
        const bucket = full ? "full" : Math.floor((Number(elapsedSeconds) || 0) * fps);
        const key = `${analysis.raceId || analysis.trackName || ""}|${analysis.drivers.length}|${full ? 1 : 0}|${bucket}`;
        if (liveOrderCache.key === key && Array.isArray(liveOrderCache.value)) return liveOrderCache.value;
        if (analysis.engineModel?.drivers?.length) {
            const maxMs = Math.max(...analysis.engineModel.drivers.map(d => (d.finalSeconds || 0) * 1000), 0);
            const ms = full ? maxMs + 1 : Math.max(0, (Number(elapsedSeconds) || 0) * 1000);
            const engineOrdered = PitGuruRaceEngine.getOrderAt(analysis.engineModel, ms)
                .map(item => {
                    const driver = analysisDriverForEngineDriver_(item.driver);
                    return driver ? { driver, state: engineStateToAnalysisState_(item.state, driver) } : null;
                })
                .filter(Boolean);
            if (engineOrdered.length) {
                liveOrderCache = { key, value: engineOrdered };
                return engineOrdered;
            }
        }
        const ordered = analysis.drivers.map(d => {
            const state = full ? currentDistanceAtTime_(d, d.finalTime) : currentDistanceAtTime_(d, elapsedSeconds);
            return { driver: d, state };
        }).sort((a, b) => {
            if (full) {
                if (a.driver.crashed !== b.driver.crashed) return a.driver.crashed ? 1 : -1;
                return (a.driver.finalTime || Infinity) - (b.driver.finalTime || Infinity);
            }
            return (b.state.distance || 0) - (a.state.distance || 0);
        });
        liveOrderCache = { key, value: ordered };
        return ordered;
    }

    function raceOvertakesCount_(elapsedSeconds = getVisualElapsed_(), canFull = analysisCanShowFullRace_()) {
        if (!analysis?.drivers?.length) return 0;
        const limit = canFull ? maxAnalysisFinalTime_() : Math.max(0, Number(elapsedSeconds) || 0);
        const large = largeFieldMode_();
        const bucket = canFull ? "full" : (large ? Math.floor(limit / 10) : Math.floor(limit * 2));
        const key = `${analysis.raceId || analysis.trackName || ""}|${analysis.drivers.length}|${bucket}`;
        if (raceOvertakesCache.key === key) return raceOvertakesCache.value;
        const driverKey = d => String(d.driverId || normalizeDriverName_(d.name || ""));
        let count = 0;
        let prev = new Map(getLiveOrder_(0, false).map((x, i) => [driverKey(x.driver), i + 1]));
        const samples = large
            ? Math.max(1, Math.min(30, Math.ceil(limit / 10)))
            : Math.max(1, Math.min(120, Math.ceil(limit / 2)));
        const step = samples > 0 ? limit / samples : limit;
        for (let s = 1; s <= samples; s++) {
            const t = s === samples ? limit : s * step;
            const nextOrder = getLiveOrder_(t, false);
            const next = new Map();
            nextOrder.forEach((x, i) => {
                const k = driverKey(x.driver);
                const pos = i + 1;
                const old = prev.get(k);
                if (Number.isFinite(old) && pos < old) count += old - pos;
                next.set(k, pos);
            });
            prev = next;
        }
        const floorKey = `${analysis.raceId || analysis.trackName || ""}|${analysis.drivers.length}`;
        const floor = raceOvertakesFloorCache.key === floorKey ? raceOvertakesFloorCache.value : 0;
        const stableCount = Math.max(floor, count);
        raceOvertakesFloorCache = { key: floorKey, value: stableCount };
        raceOvertakesCache = { key, value: stableCount };
        return stableCount;
    }

    function driverReachTimeForDistance_(driver, meters) {
        const dists = driver.cumulativeDistances || [];
        const times = driver.cumulativeTimes || [];
        const i = firstIndexAtOrAfter_(dists, meters);
        if (i < dists.length) {
            const prevDist = i ? dists[i - 1] : 0;
            const prevTime = i ? times[i - 1] : 0;
            const segDist = Math.max(0.001, (driver.segmentDistancesMeters?.[i] || 0));
            const pct = clamp_((meters - prevDist) / segDist, 0, 1);
            return prevTime + pct * (driver.segmentTimes[i] || 0);
        }
        return Infinity;
    }

    function formatRaceGapSeconds_(sec) {
        if (!Number.isFinite(sec)) return "--";
        if (Math.abs(sec) < 0.0005) return "0.000";
        return `+${Math.max(0, sec).toFixed(3)}`;
    }

    function formatGapChangeSeconds_(sec) {
        if (!Number.isFinite(sec)) return "--";
        if (Math.abs(sec) < 0.0005) return "0.000";
        return `${sec > 0 ? "+" : ""}${sec.toFixed(3)}`;
    }

    function gapAtLapCheckpoint_(driver, lapNumber) {
        if (!analysis?.drivers?.length || !analysis?.lapMeters) return NaN;
        const lap = Math.floor(Number(lapNumber) || 0);
        if (lap <= 0) return NaN;
        const meters = Math.min(lap, analysis.laps || lap) * analysis.lapMeters;
        const times = analysis.drivers
            .map(d => driverReachTimeForDistance_(d, meters))
            .filter(Number.isFinite);
        if (!times.length) return NaN;
        const leaderTime = Math.min(...times);
        const driverTime = driverReachTimeForDistance_(driver, meters);
        return Number.isFinite(driverTime) ? Math.max(0, driverTime - leaderTime) : NaN;
    }

    function previousLapGapInfo_(driver, state, currentGap) {
        const prevGap = previousLapGapSeconds_(driver, state);
        return {
            text: Number.isFinite(prevGap) ? formatRaceGapSeconds_(prevGap) : "--",
            delta: Number.isFinite(prevGap) && Number.isFinite(currentGap) ? formatGapChangeSeconds_(currentGap - prevGap) : "--"
        };
    }

    function previousLapGapSeconds_(driver, state) {
        if (!analysis?.lapMeters || !driver) return NaN;
        const completedLap = state?.finished && !driver.crashed
            ? Math.max(0, (analysis.laps || 0) - 1)
            : Math.max(0, state?.lapIndex || 0);
        return completedLap > 0 ? gapAtLapCheckpoint_(driver, completedLap) : NaN;
    }

    function computeLeadStats_(model) {
        if (!model?.drivers?.length) return;
        for (const d of model.drivers) {
            d.timeInLeadSeconds = 0;
            d.lapsLed = 0;
            d.segmentsLed = 0;
            d.longestLeadStintSeconds = 0;
            d.leadChanges = 0;
        }
        const maxTime = Math.max(...model.drivers.map(d => d.finalTime || 0));
        const step = model.drivers.length >= HUGE_FIELD_THRESHOLD ? 5 : (model.drivers.length >= LARGE_FIELD_THRESHOLD ? 2 : 0.5);
        let lastLeader = null;
        let stint = 0;
        for (let t = 0; t <= maxTime; t += step) {
            let leader = null;
            let leaderDistance = -Infinity;
            for (const d of model.drivers) {
                const distance = currentDistanceAtTime_(d, t).distance || 0;
                if (distance > leaderDistance) {
                    leaderDistance = distance;
                    leader = d;
                }
            }
            if (!leader) continue;
            leader.timeInLeadSeconds += step;
            if (leader !== lastLeader) {
                if (lastLeader) lastLeader.longestLeadStintSeconds = Math.max(lastLeader.longestLeadStintSeconds || 0, stint);
                leader.leadChanges += 1;
                lastLeader = leader;
                stint = 0;
            }
            stint += step;
        }
        if (lastLeader) lastLeader.longestLeadStintSeconds = Math.max(lastLeader.longestLeadStintSeconds || 0, stint);

        for (let lap = 1; lap <= model.laps; lap++) {
            const lapEndMeters = lap * (model.lapMeters || 0);
            let lapLeader = null;
            let lapLeaderTime = Infinity;
            for (const d of model.drivers) {
                const time = driverReachTimeForDistance_(d, lapEndMeters);
                if (Number.isFinite(time) && time < lapLeaderTime) {
                    lapLeaderTime = time;
                    lapLeader = d;
                }
            }
            if (lapLeader) lapLeader.lapsLed = (lapLeader.lapsLed || 0) + 1;
        }

        for (let seg = 1; seg <= model.segmentsPerLap * model.laps; seg++) {
            let segmentLeader = null;
            let segmentLeaderTime = Infinity;
            for (const d of model.drivers) {
                const time = d.cumulativeTimes?.[seg - 1];
                if (Number.isFinite(time) && time < segmentLeaderTime) {
                    segmentLeaderTime = time;
                    segmentLeader = d;
                }
            }
            if (segmentLeader) segmentLeader.segmentsLed = (segmentLeader.segmentsLed || 0) + 1;
        }
        model.leadStatsReady = true;
    }

    function computeSectorWins_(model) {
        if (!model?.drivers?.length) return;
        for (const d of model.drivers) d.sectorsWon = 0;
        const best = new Map();
        for (const d of model.drivers) {
            for (const s of d.sectorTimes || []) {
                const key = `${s.lap}:${s.sector}`;
                const prev = best.get(key);
                if (!prev || s.seconds < prev.s.seconds) best.set(key, { d, s });
            }
        }
        for (const { d } of best.values()) d.sectorsWon = (d.sectorsWon || 0) + 1;
        model.sectorWinsReady = true;
    }

    function ensureAnalysisAggregates_(options = {}) {
        if (!analysis?.drivers?.length) return;
        if (options.sectors && !analysis.sectorWinsReady) computeSectorWins_(analysis);
        if (options.leads && !analysis.leadStatsReady) computeLeadStats_(analysis);
    }

    function updateRecordsFromAnalysis_() {
        try {
            if (!analysis || !shouldPopulateFinalAnalysisNow_()) return;
            ensureAnalysisAggregates_({ sectors: true, leads: true });
            const raceId = String(analysis.raceId || raceMeta?.raceId || getRaceId_() || "").trim();
            const raceRecordKey = raceId || `${analysis.trackName}:${analysis.drivers.map(d => d.finalTime).join(",")}`;
            if (recordsUpdatedForAnalysisRaceId === raceRecordKey) return;
            const sourceTrack = analysis.trackName || "UnknownTrack";
            const lapTrack = getRecordTrackScope_("lap", sourceTrack) || "UnknownTrack";
            const raceTrack = getRecordTrackScope_("race", formatRaceTrackLabel_(sourceTrack, analysis.laps)) || "UnknownTrack";
            const atIso = raceMeta?.detectedAtIso || nowIso_();
            const meta = raceMetaFromPayload_(analysis.payload || {}, false);
            const raceType = String(meta.type || raceMeta?.replayInfo?.type || "Official").toLowerCase() === "custom" ? "custom" : "official";
            const analysisDriverNames = new Set(analysis.drivers.map(d => normalizeDriverName_(d.name)).filter(Boolean));
            records = records.filter(r => {
                if (!r || (r.mode !== "lap" && r.mode !== "race")) return true;
                const rowDriver = normalizeDriverName_(r.driverName || "");
                if (!analysisDriverNames.has(rowDriver)) return true;
                const rowTrack = getRecordTrackScopeFromRow_(r, r.mode);
                const targetTrack = r.mode === "lap" ? lapTrack : raceTrack;
                if (rowTrack !== targetTrack) return true;
                const sameRace = raceId && String(r.raceId || "").trim() === raceId;
                const sameStart = atIso && String(r.atIso || "").trim() === atIso;
                return !(sameRace || sameStart);
            });
            for (const d of analysis.drivers) {
                if (d.bestLapSeconds && d.car) {
                    const id = makeRecId_("lap", lapTrack, d.car, `${atIso}_${d.name}`);
                    records = records.filter(r => r.id !== id);
                    records.push({ id, track: lapTrack, trackKey: lapTrack, trackLabel: lapTrack, sourceTrack, mode: "lap", raceType, car: toOgCarName_(d.car), carImg: d.carImg, driverName: d.name, driverId: d.driverId, racingSkill: d.racingSkill, raceId, timeText: formatTimeSeconds_(d.bestLapSeconds), ms: Math.round(d.bestLapSeconds * 1000), atIso });
                }
                if (!d.crashed && d.finalTime && d.car) {
                    const id = makeRecId_("race", raceTrack, d.car, `${atIso}_${d.name}`);
                    records = records.filter(r => r.id !== id);
                    records.push({ id, track: raceTrack, trackKey: raceTrack, trackLabel: raceTrack, sourceTrack, mode: "race", raceType, car: toOgCarName_(d.car), carImg: d.carImg, driverName: d.name, driverId: d.driverId, racingSkill: d.racingSkill, raceId, timeText: formatTimeSeconds_(d.finalTime), ms: Math.round(d.finalTime * 1000), atIso });
                }
            }
            saveRecords_();
            updateDriverHistoryFromAnalysis_();
            pgLocalSyncCurrentRace_(true).catch(e => {
                if (debugEnabled) console.warn(TAG, "local DB auto-sync skipped", e);
            });
            recordsUpdatedForAnalysisRaceId = raceRecordKey;
        } catch (e) {
            if (debugEnabled) console.warn(TAG, "analysis records update failed", e);
        }
    }

    function driverHistoryKey_(driverId, name, trackName) {
        const driverKey = String(driverId || "").trim() || `name:${normalizeDriverName_(name || "")}`;
        const trackKey = getRecordTrackScope_("race", trackName || "") || "UnknownTrack";
        return `${trackKey}|${driverKey}`;
    }

    function getDriverTrackHistory_(driverId, name, trackName) {
        const local = pgLocalGetTrackHistoryForDriver_(driverId, name, trackName);
        if (local) return local;
        const key = driverHistoryKey_(driverId, name, trackName);
        return driverHistory?.[key] || null;
    }

    function getDriverAnyHistory_(driverId, name, trackName = "") {
        const exact = getDriverTrackHistory_(driverId, name, trackName);
        if (exact) return exact;
        const id = String(driverId || "").trim();
        const nn = normalizeDriverName_(name || "");
        const rows = Object.values(driverHistory || {}).filter(h => {
            if (!h) return false;
            if (id && String(h.driverId || "").trim() === id) return true;
            return nn && normalizeDriverName_(h.driverName || "") === nn;
        });
        rows.sort((a, b) => String(b.lastRaceAtIso || "").localeCompare(String(a.lastRaceAtIso || "")));
        return rows[0] || null;
    }

    function getLastKnownDriverCar_(driverId, name, trackName = "") {
        const history = getDriverAnyHistory_(driverId, name, trackName);
        if (history?.lastCar) return { car: toOgCarName_(history.lastCar), carImg: history.lastCarImg || "", source: "history" };
        const id = String(driverId || "").trim();
        const nn = normalizeDriverName_(name || "");
        const trackScope = getRecordTrackScope_("race", trackName || "");
        const matches = (records || []).filter(r => {
            if (!r || !r.car) return false;
            const sameDriver = (id && String(r.driverId || "").trim() === id) || (nn && normalizeDriverName_(r.driverName || "") === nn);
            if (!sameDriver) return false;
            if (trackScope && getRecordTrackScopeFromRow_(r, r.mode || "race") !== trackScope) return false;
            return true;
        }).sort((a, b) => String(b.atIso || "").localeCompare(String(a.atIso || "")));
        const row = matches[0] || (records || []).filter(r => {
            if (!r || !r.car) return false;
            return (id && String(r.driverId || "").trim() === id) || (nn && normalizeDriverName_(r.driverName || "") === nn);
        }).sort((a, b) => String(b.atIso || "").localeCompare(String(a.atIso || "")))[0];
        return row ? { car: toOgCarName_(row.car), carImg: row.carImg || "", source: "records" } : null;
    }

    function enrichDriverFromLocalHistory_(d, trackName = "") {
        if (!d) return d;
        const known = getLastKnownDriverCar_(d.driverId, d.name, trackName);
        if (known?.car && !toOgCarName_(d.car || "")) {
            d.car = known.car;
            d.carImg = d.carImg || known.carImg || "";
            d.carSource = known.source;
        }
        return d;
    }

    function visibleRaceTrackName_() {
        const txt = visualProgressPanelText_();
        const m = txt.match(/\bTrack:\s*([^|]+?)(?:\s+\w+:|$)/i) || txt.match(/^\s*([A-Za-z ]+)\s*-\s*\d+\s+laps?\b/i);
        return m ? normalizeTrackLabel_(m[1]) : "";
    }

    function visibleRaceDriverName_() {
        const txt = visualProgressPanelText_();
        const m = txt.match(/\bName:\s*([^|]+?)(?:\s+\w+:|$)/i);
        return m ? String(m[1] || "").trim() : "";
    }

    function extractDriverIdFromElement_(el) {
        if (!el) return "";
        const idFromText = raw => {
            const s = String(raw || "");
            if (!s) return "";
            const m = s.match(/[?&]XID=(\d{2,})/i)
                || s.match(/\bXID[=:/"'\s]+(\d{2,})\b/i)
                || s.match(/\b(?:userID|userId|userid|user_id|playerId|player_id|profileId|profile_id|driverId|driver_id|racerId|racer_id|id)[=:/"'\s]+(\d{2,})\b/i)
                || s.match(/\/profiles\.php[^"'<>]*?(\d{2,})/i);
            return m ? m[1] : "";
        };
        const attrNames = ["data-user-id", "data-userid", "data-xid", "data-id", "data-driver-id"];
        let cur = el;
        for (let depth = 0; cur && depth < 8; depth++, cur = cur.parentElement) {
            const href = String(cur.getAttribute?.("href") || cur.href || "");
            const hrefId = idFromText(href);
            if (hrefId) return hrefId;
            for (const attr of attrNames) {
                const v = String(cur.getAttribute?.(attr) || "").trim();
                if (/^\d{2,}$/.test(v)) return v;
            }
            for (const attr of Array.from(cur.attributes || [])) {
                const v = String(attr?.value || "");
                const attrId = idFromText(v);
                if (attrId) return attrId;
            }
        }
        const linkSelectors = [
            'a[href*="profiles.php"]', 'a[href*="XID="]', 'a[href*="user2.php"]',
            '[data-href*="profiles.php"]', '[data-url*="profiles.php"]', '[onclick*="profiles.php"]',
            '[data-href*="XID="]', '[data-url*="XID="]', '[onclick*="XID="]'
        ].join(",");
        for (const link of Array.from(el.querySelectorAll?.(linkSelectors) || [])) {
            if (isInsidePitGuruUi_(link)) continue;
            for (const attr of Array.from(link.attributes || [])) {
                const id = idFromText(attr.value);
                if (id) return id;
            }
        }
        return "";
    }

    function isInsidePitGuruUi_(el) {
        try { return !!el?.closest?.(PIT_GURU_OWN_UI_SELECTOR); }
        catch { return false; }
    }

    function isRejectedVisibleDriverName_(name) {
        const n = String(name || "").trim();
        if (!n) return true;
        if (/^(view profile|profile|settings|records|html|import|json|clear view|release thread|predictions|driver|drivers|racer|racers|participant|participants)$/i.test(n)) return true;
        if (/^(lap recording|gaps|sectors|speed\/g|lap pace|gyro|summary|driver stats)$/i.test(n)) return true;
        return false;
    }

    function lookupVisibleDriverIdByName_(name, scopeEl = null) {
        const nn = normalizeDriverName_(name || "");
        if (!nn) return "";
        const raceKey = getRaceId_() || raceMeta?.raceId || "";
        const cacheKey = `${raceKey}|${nn}`;
        const cached = driverIdLookupCache.get(cacheKey);
        if (cached && Date.now() - cached.at < driverIdLookupMs) return cached.id || "";
        if (!canScanTornPage_()) return "";
        const idFrom = el => extractDriverIdFromElement_(el);
        const scopes = [];
        if (scopeEl) {
            let cur = scopeEl;
            for (let depth = 0; cur && depth < 6; depth++, cur = cur.parentElement) scopes.push(cur);
        }
        for (const sel of ["#racingdetails", "#racingupdatesnew", "#racingupdates", "#leaderBoard", "#leaderboard", "[class*='leaderboard']", "[class*='participants']", "[class*='racers']"]) {
            try { document.querySelectorAll(sel).forEach(el => { if (!isInsidePitGuruUi_(el)) scopes.push(el); }); } catch {}
        }
        for (const root of scopes) {
            if (!root || isInsidePitGuruUi_(root)) continue;
            const rootText = normalizeDriverName_(root.textContent || "");
            if (!rootText.includes(nn)) continue;
            const rows = Array.from(root.querySelectorAll?.("li, tr, [class*='row'], [class*='driver'], [class*='racer'], [class*='participant'], [class*='entrant'], a") || []);
            rows.unshift(root);
            for (const row of rows) {
                if (isInsidePitGuruUi_(row)) continue;
                const txt = normalizeDriverName_(row.textContent || row.getAttribute?.("title") || row.getAttribute?.("aria-label") || "");
                if (txt && !txt.includes(nn)) continue;
                const id = idFrom(row);
                if (id) {
                    driverIdLookupCache.set(cacheKey, { id, at: Date.now() });
                    return id;
                }
            }
        }
        driverIdLookupCache.set(cacheKey, { id: "", at: Date.now() });
        return "";
    }

    function extractCarFromElement_(el) {
        if (!el) return "";
        const imgs = Array.from(el.querySelectorAll?.("img") || []);
        for (const img of imgs) {
            const raw = String(img.getAttribute("title") || img.getAttribute("alt") || "").trim();
            if (!raw || /avatar|profile|user|flag|award/i.test(raw)) continue;
            const car = toOgCarName_(raw);
            if (car && car !== raw || FUEL_BASE_L100KM[car]) return car;
            if (/\b(honda|ferrari|ford|audi|bmw|mercedes|nissan|toyota|porsche|lamborghini|volkswagen|volvo|lexus|bugatti)\b/i.test(car)) return car;
        }
        const text = String(el.textContent || "");
        for (const tornName of OG_CAR_KEYS) {
            if (text.includes(tornName)) return toOgCarName_(tornName);
        }
        for (const realName of Object.values(OG_CAR_REPLACEMENTS)) {
            if (text.includes(realName)) return realName;
        }
        return "";
    }

    function extractCarImageFromElement_(el) {
        if (!el) return "";
        const car = extractCarFromElement_(el);
        if (!car) return "";
        for (const img of Array.from(el.querySelectorAll?.("img") || [])) {
            const raw = String(img.getAttribute("title") || img.getAttribute("alt") || "").trim();
            if (car && toOgCarName_(raw) !== car && raw !== car) continue;
            const src = String(img.getAttribute("src") || "").trim();
            if (src) return src;
        }
        return "";
    }

    function cleanVisibleDriverName_(raw, car) {
        let text = String(raw || "").replace(/\s+/g, " ").trim();
        if (!text) return "";
        text = text
            .replace(/\b(Name|Position|Lap|Last Lap|Completion|RS|Racing Skill):\s*[^|]+/gi, " ")
            .replace(/\b(View Profile|Open Profile|Profile|Send Message|Message|Attack|Add Friend|Friends|Faction|Company)\b/gi, " ")
            .replace(/\d+(?:\.\d+)?\s*%/g, " ")
            .replace(/\b\d+\s*\/\s*\d+\b/g, " ")
            .replace(/\bP\d+\b/gi, " ")
            .replace(/\bRS[:\s]*\d+(?:\.\d+)?\b/gi, " ");
        if (car) text = text.replace(new RegExp(car.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
        for (const tornName of OG_CAR_KEYS) text = text.replace(new RegExp(tornName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), " ");
        for (const realName of Object.values(OG_CAR_REPLACEMENTS)) text = text.replace(new RegExp(realName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), " ");
        text = text.replace(/[|•]+/g, " ").replace(/\s+/g, " ").trim();
        const parts = text.split(/\s{2,}| - /).map(x => x.trim()).filter(Boolean);
        const pick = parts.find(x => /^[A-Za-z0-9_\-[\]{}.'`~ ]{2,32}$/.test(x) && !/\b(lap|completion|position|last|race|started|finished)\b/i.test(x) && !isRejectedVisibleDriverName_(x)) || text;
        return /^[A-Za-z0-9_\-[\]{}.'`~ ]{2,32}$/.test(pick) && !isRejectedVisibleDriverName_(pick) ? pick.trim() : "";
    }

    function profileLinkVisibleName_(link, car) {
        if (!link) return "";
        const values = [
            link.textContent,
            link.getAttribute?.("title"),
            link.getAttribute?.("aria-label"),
            link.getAttribute?.("data-name"),
            link.getAttribute?.("data-player-name")
        ];
        for (let raw of values) {
            raw = String(raw || "").replace(/^(view|open)\s+profile\b[:\s-]*(for|of)?\s*/i, "");
            const name = cleanVisibleDriverName_(raw, car);
            if (name) return name;
        }
        return "";
    }

    function extractDriverNameFromElement_(el, car) {
        const link = el?.querySelector?.('a[href*="profiles.php"], a[href*="XID="]');
        const linkedName = profileLinkVisibleName_(link, car);
        if (linkedName) return linkedName;
        for (const sel of [".name", "[class*='name']", "[class*='driver']", "[class*='user']"]) {
            const found = el?.querySelector?.(sel);
            if (found && /button/i.test(String(found.tagName || ""))) continue;
            const name = cleanVisibleDriverName_(found?.textContent || "", car);
            if (name) return name;
        }
        return cleanVisibleDriverName_(el?.textContent || "", car);
    }

    function participantCandidateSignal_(el) {
        if (!el || isInsidePitGuruUi_(el)) return false;
        const cls = String(el.className || "");
        const text = String(el.textContent || "").replace(/\s+/g, " ").trim();
        if (text.length > 360) return false;
        if (el.querySelector?.('a[href*="profiles.php"], a[href*="XID="]')) return true;
        if (extractCarFromElement_(el)) return true;
        return /\b(driver|racer|participant|entrant|user)\b/i.test(cls) && text.length >= 2;
    }

    function visibleParticipantCandidates_() {
        if (!canScanTornPage_()) return [];
        const large = largeLobbyMode_();
        const limit = visibleParticipantCandidateLimit_();
        const roots = new Set();
        for (const sel of [
            "#leaderBoard", "#leaderboard", "[id*='leaderBoard']", "[id*='leaderboard']",
            "[class*='participants']", "[class*='participant']", "[class*='entrants']", "[class*='entrant']",
            "[class*='racers']", "[class*='racer']", ".drivers-list", "[class*='drivers-list']", "[class*='leaderboard']",
            "#racingupdatesnew", "#racingupdates", "#racingdetails"
        ]) {
            try { document.querySelectorAll(sel).forEach(el => { if (!isInsidePitGuruUi_(el)) roots.add(el); }); } catch {}
        }
        const out = new Set();
        const add = el => {
            if (!el || out.size >= limit || isInsidePitGuruUi_(el)) return;
            if (participantCandidateSignal_(el)) out.add(el);
        };
        roots.forEach(root => {
            if (out.size >= limit) return;
            add(root);
            Array.from(root.children || []).forEach(el => {
                if (out.size < limit) add(el);
            });
            if (large) {
                root.querySelectorAll?.('a[href*="profiles.php"], a[href*="XID="]').forEach(a => {
                    if (out.size >= limit || isInsidePitGuruUi_(a)) return;
                    add(a.closest("li, tr, [class*='row'], [class*='driver'], [class*='racer'], [class*='participant'], [class*='entrant']") || a.parentElement || a);
                });
                root.querySelectorAll?.("tr, li").forEach(el => {
                    if (out.size < limit) add(el);
                });
                return;
            }
            root.querySelectorAll?.("li, tr, [class*='row'], [class*='driver'], [class*='racer'], [class*='participant'], [class*='entrant']").forEach(el => {
                if (out.size < limit) add(el);
            });
            root.querySelectorAll?.('a[href*="profiles.php"], a[href*="XID="]').forEach(a => {
                if (out.size >= limit || isInsidePitGuruUi_(a)) return;
                const row = a.closest("li, tr, [class*='row'], [class*='driver'], [class*='racer'], [class*='participant'], [class*='entrant']") || a.parentElement;
                add(row);
            });
        });
        return Array.from(out);
    }

    function scrapeVisibleParticipants_() {
        if (!canScanTornPage_()) return (preRaceParticipants || []).slice();
        const byKey = new Map();
        const large = largeLobbyMode_();
        const limit = visibleParticipantCandidateLimit_();
        const trackName = raceMeta?.track || visibleRaceTrackName_();
        const selfName = normalizeDriverName_(playerName || raceMeta?.driver || visibleRaceDriverName_());
        let seen = 0;
        for (const el of visibleParticipantCandidates_()) {
            if (++seen > limit) break;
            if (isInsidePitGuruUi_(el)) continue;
            const text = String(el?.textContent || "").replace(/\s+/g, " ").trim();
            if (!text || text.length < 2 || text.length > 220) continue;
            const car = extractCarFromElement_(el);
            const name = extractDriverNameFromElement_(el, car);
            const id = extractDriverIdFromElement_(el) || (large ? "" : lookupVisibleDriverIdByName_(name, el));
            if ((!name && !id) || (name && (/^\d+(?:\.\d+)?%?$/.test(name) || isRejectedVisibleDriverName_(name)))) continue;
            if (!id && !car && !/selected|driver|user|racer/i.test(String(el.className || ""))) continue;
            const key = id ? `id:${id}` : `name:${normalizeDriverName_(name)}`;
            if (!key || key === "name:") continue;
            const prev = byKey.get(key) || {};
            byKey.set(key, {
                name: prev.name || name || "",
                driverId: id || prev.driverId || (selfName && normalizeDriverName_(name) === selfName ? "self" : ""),
                racingSkill: Number.isFinite(prev.racingSkill) ? prev.racingSkill : NaN,
                car: car || prev.car || "",
                carImg: extractCarImageFromElement_(el) || prev.carImg || "",
                preRaceOnly: true
            });
        }
        return Array.from(byKey.values())
            .map(d => enrichDriverFromLocalHistory_(d, trackName))
            .filter(d => (d.name || d.driverId) && (d.driverId || normalizeDriverName_(d.name)))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    function refreshPreRaceParticipants_(force = false) {
        if (!canScanTornPage_()) return preRaceParticipants;
        if (!force && liveRaceHasWorkingAnalysis_()) return preRaceParticipants;
        const raceKey = getRaceId_() || raceMeta?.raceId || location.href;
        const large = largeLobbyMode_();
        const huge = hugeLobbyMode_();
        const scanDelay = effectiveParticipantScanMs_();
        if (!force && preRaceParticipantsScanRaceKey === raceKey && Date.now() - preRaceParticipantsScanAt < scanDelay) {
            return preRaceParticipants;
        }
        if (!force && preRaceParticipantsScanRaceKey === raceKey && preRaceParticipants.length) {
            if (huge && preRaceParticipantsScanCount >= 1) return preRaceParticipants;
            if (large && preRaceParticipantsScanCount >= 2) return preRaceParticipants;
            if (participantScanRepeat === "once" && preRaceParticipantsScanCount >= 1) return preRaceParticipants;
            if (participantScanRepeat === "twice" && preRaceParticipantsScanCount >= 2) return preRaceParticipants;
        }
        if (preRaceParticipantsScanRaceKey !== raceKey) preRaceParticipantsScanCount = 0;
        preRaceParticipantsScanRaceKey = raceKey;
        preRaceParticipantsScanAt = Date.now();
        const rows = scrapeVisibleParticipants_();
        if (rows.length) {
            preRaceParticipantsScanCount++;
            const trackName = raceMeta?.track || visibleRaceTrackName_();
            for (const d of rows) {
                mergeDirectRacingDataIntoParticipant_(d);
                const intel = getDriverIntelForDriver_(d);
                if (intel) {
                    d.driverIntel = intel;
                    if (!d.driverId && intel.driverId) d.driverId = String(intel.driverId);
                    if ((!d.name || isRejectedVisibleDriverName_(d.name)) && intel.name) d.name = String(intel.name);
                    if (!Number.isFinite(d.racingSkill) && Number.isFinite(Number(intel.racingSkill))) d.racingSkill = Number(intel.racingSkill);
                }
                enrichDriverFromLocalHistory_(d, trackName);
            }
            const key = rows.map(d => `${d.driverId || ""}:${d.name}:${d.car}:${Number.isFinite(d.racingSkill) ? d.racingSkill : ""}`).join("|");
            if (key !== preRaceParticipantsKey) {
                preRaceParticipants = rows;
                preRaceParticipantsKey = key;
            }
        }
        return preRaceParticipants;
    }

    function predictionDriverSet_() {
        const source = analysis?.drivers?.length ? "raceData" : "visible";
        const rawDrivers = source === "raceData" ? analysis.drivers : refreshPreRaceParticipants_();
        const drivers = Array.isArray(rawDrivers) ? rawDrivers : [];
        const trackName = analysis?.trackName || raceMeta?.track || visibleRaceTrackName_() || "";
        for (const d of drivers) {
            const intel = getDriverIntelForDriver_(d);
            if (intel) {
                d.driverIntel = intel;
                if (!d.driverId && intel.driverId) d.driverId = String(intel.driverId);
                if ((!d.name || isRejectedVisibleDriverName_(d.name)) && intel.name) d.name = String(intel.name);
                if (!Number.isFinite(d.racingSkill) && Number.isFinite(Number(intel.racingSkill))) d.racingSkill = Number(intel.racingSkill);
            }
            enrichDriverFromLocalHistory_(d, trackName);
        }
        return {
            drivers,
            source,
            trackName
        };
    }

    let pgLocalRaceIntelCache = null;
    let pgLocalTrackHistoryCache = { track: "", rows: [], fetchedAt: 0, loading: false, error: "" };
    let pgLocalTrackHistoryCacheByTrack = {};

    function pgLocalNorm_(value) {
        return String(value || "").trim().toLowerCase();
    }

    function currentRaceHistoryScope_(trackName = "") {
        const meta = raceMetaFromPayload_(analysis?.payload || latestRaceDataPayload || null, false) || {};
        const parsed = parseTrackLabel_(trackName || analysis?.trackName || raceMeta?.track || visibleRaceTrackName_() || "");
        const baseTrack = parsed.baseTrack || stripTrackLapSuffix_(parsed.raw) || parsed.raw || trackName || "";
        const typeText = String(meta.type || raceMeta?.replayInfo?.type || "").trim().toLowerCase();
        const raceType = typeText === "custom" ? "custom" : "official";
        let laps = Number(
            analysis?.laps ||
            raceMeta?.laps ||
            raceMeta?.replayInfo?.laps ||
            meta.laps ||
            parsed.lapCount ||
            0
        );
        if (!(Number.isFinite(laps) && laps > 0) && raceType === "official") laps = Number(getOfficialLapCount_(baseTrack));
        return {
            raceType,
            laps: Number.isFinite(laps) && laps > 0 ? Math.round(laps) : null
        };
    }

    function pgLocalTrackHistoryCacheKey_(trackName, scope = currentRaceHistoryScope_(trackName)) {
        const parsed = parseTrackLabel_(trackName || "");
        const baseTrack = parsed.baseTrack || stripTrackLapSuffix_(parsed.raw) || parsed.raw || trackName || "";
        return `${pgLocalNorm_(baseTrack)}|${scope.raceType || "official"}|${scope.laps || ""}`;
    }

    function pgLocalTrackHistoryMatches_(trackName) {
        const key = pgLocalTrackHistoryCacheKey_(trackName || analysis?.trackName || raceMeta?.track || "");
        const cache = pgLocalTrackHistoryCacheFor_(trackName);
        return !!key && cache?.key === key;
    }

    function pgLocalTrackHistoryCacheFor_(trackName) {
        const key = pgLocalTrackHistoryCacheKey_(trackName || analysis?.trackName || raceMeta?.track || "");
        if (!key) return pgLocalTrackHistoryCache;
        return pgLocalTrackHistoryCacheByTrack[key] || null;
    }

    function pgLocalSetTrackHistoryCache_(trackName, cache) {
        const scope = { raceType: cache?.raceType || currentRaceHistoryScope_(trackName).raceType, laps: cache?.laps ?? currentRaceHistoryScope_(trackName).laps };
        const key = cache?.key || pgLocalTrackHistoryCacheKey_(trackName || cache?.track || "", scope);
        cache.key = key;
        if (key) pgLocalTrackHistoryCacheByTrack[key] = cache;
        pgLocalTrackHistoryCache = cache;
        return cache;
    }

    function pgLocalTrackHistoryRenderKey_(trackName = "") {
        const track = String(trackName || analysis?.trackName || raceMeta?.track || visibleRaceTrackName_() || "").trim();
        const scope = currentRaceHistoryScope_(track);
        const cache = pgLocalTrackHistoryCacheFor_(track);
        return [
            pgLocalTrackHistoryCacheKey_(track, scope),
            cache?.key || "",
            cache?.loading ? 1 : 0,
            cache?.fetchedAt || 0,
            Array.isArray(cache?.rows) ? cache.rows.length : 0,
            cache?.error || ""
        ].join(":");
    }

    function pgLocalHistoryToDriverHistory_(row) {
        if (!row) return null;
        return {
            driverId: String(row.driverId || row.driver_id || "").trim(),
            driverName: row.driverName || row.driver_name || row.name || "",
            track: row.track || "",
            races: Number(row.races || 0),
            wins: Number(row.wins || 0),
            podiums: Number(row.podiums || 0),
            crashes: Number(row.crashes || 0),
            avgFinish: Number.isFinite(Number(row.avgFinish ?? row.avg_finish)) ? Number(row.avgFinish ?? row.avg_finish) : null,
            bestLapMs: Number(row.bestLapMs ?? row.best_lap_ms) || 0,
            bestRaceMs: Number(row.bestRaceMs ?? row.best_race_ms) || 0,
            lastCar: row.lastCar || row.last_car || "",
            lastCarImg: row.lastCarImg || row.last_car_img || "",
            lastRacingSkill: Number.isFinite(Number(row.lastRacingSkill ?? row.last_racing_skill)) ? Number(row.lastRacingSkill ?? row.last_racing_skill) : NaN,
            lastRaceAtIso: row.lastRaceAtIso || row.last_race_at_iso || row.last_seen_at || "",
            riskScore: Number.isFinite(Number(row.riskScore ?? row.risk_score)) ? Number(row.riskScore ?? row.risk_score) : NaN,
            source: row.source || "sqlite"
        };
    }

    function pgLocalGetTrackHistoryForDriver_(driverId, name, trackName) {
        if (!pgLocalTrackHistoryMatches_(trackName)) return null;
        const cache = pgLocalTrackHistoryCacheFor_(trackName);
        const id = String(driverId || "").trim();
        const nn = pgLocalNorm_(name || "");
        const row = (cache?.rows || []).find(x => {
            const h = pgLocalHistoryToDriverHistory_(x);
            if (!h) return false;
            if (id && String(h.driverId || "").trim() === id) return true;
            return nn && pgLocalNorm_(h.driverName || "") === nn;
        });
        return pgLocalHistoryToDriverHistory_(row);
    }

    async function pgLocalEnsureTrackHistory_(trackName, force = false) {
        const track = String(trackName || analysis?.trackName || raceMeta?.track || visibleRaceTrackName_() || "").trim();
        if (!track) return null;
        const scope = currentRaceHistoryScope_(track);
        const key = pgLocalTrackHistoryCacheKey_(track, scope);
        const existing = pgLocalTrackHistoryCacheFor_(track);
        if (existing?.loading) return existing;
        if (!force && existing?.rows && existing.key === key && Date.now() - (existing.fetchedAt || 0) < 120000) {
            return existing;
        }
        pgLocalSetTrackHistoryCache_(track, Object.assign({}, existing || {}, { key, track, raceType: scope.raceType, laps: scope.laps, loading: true, error: "" }));
        try {
            const result = await pgLocalFetchTrackHistory(track, scope);
            if (!result?.ok) throw new Error(result?.error || "Local history request failed");
            const cache = pgLocalSetTrackHistoryCache_(track, {
                key,
                track: result.track || track,
                raceType: result.raceType || scope.raceType,
                laps: result.laps ?? scope.laps,
                rows: Array.isArray(result.drivers) ? result.drivers : [],
                fetchedAt: Date.now(),
                loading: false,
                error: ""
            });
            uiDirty = true;
            scheduleRender_();
            return cache;
        } catch (e) {
            const cache = pgLocalSetTrackHistoryCache_(track, {
                key,
                track,
                raceType: scope.raceType,
                laps: scope.laps,
                rows: existing?.rows || [],
                fetchedAt: Date.now(),
                loading: false,
                error: pgErrorMessage_(e, "Local history unavailable")
            });
            uiDirty = true;
            scheduleRender_();
            return cache;
        }
    }

    function pgLocalTrackRows_() {
        return Array.isArray(pgLocalTracksCache.rows) ? pgLocalTracksCache.rows : [];
    }

    function pgLocalTrackMeta_(trackName) {
        const wanted = pgLocalNorm_(trackName || "");
        if (!wanted) return null;
        return pgLocalTrackRows_().find(row => pgLocalNorm_(row?.name || row?.Name || "") === wanted) || null;
    }

    function pgLocalTrackLapKm_(trackName) {
        const row = pgLocalTrackMeta_(trackName);
        const km = Number(row?.lapKm ?? row?.LapKm);
        return Number.isFinite(km) && km > 0 ? km : 0;
    }

    function pgLocalOfficialLaps_(trackName) {
        const row = pgLocalTrackMeta_(trackName);
        const laps = Number(row?.officialLaps ?? row?.OfficialLaps);
        return Number.isFinite(laps) && laps > 0 ? laps : 0;
    }

    async function pgLocalEnsureTracks_(force = false) {
        if (pgLocalTracksCache.loading) return pgLocalTracksCache;
        if (!force && pgLocalTracksCache.rows.length && Date.now() - (pgLocalTracksCache.fetchedAt || 0) < 10 * 60 * 1000) {
            return pgLocalTracksCache;
        }
        if (!force && pgLocalTracksCache.fetchedAt && Date.now() - (pgLocalTracksCache.fetchedAt || 0) < 30000) {
            return pgLocalTracksCache;
        }
        pgLocalTracksCache = Object.assign({}, pgLocalTracksCache, { loading: true, error: "" });
        try {
            const result = await pgLocalFetchTracks();
            if (!result?.ok) throw new Error(result?.error || "Local tracks request failed");
            pgLocalTracksCache = {
                rows: Array.isArray(result.tracks) ? result.tracks : [],
                recordTracks: {
                    lap: Array.isArray(result.recordTracks?.lap) ? result.recordTracks.lap.map(String).filter(Boolean) : [],
                    race: Array.isArray(result.recordTracks?.race) ? result.recordTracks.race.map(String).filter(Boolean) : []
                },
                fetchedAt: Date.now(),
                loading: false,
                error: ""
            };
            if (analysis && !analysis.routeModel && latestRaceDataPayload && localTrackRouteText_(analysis.trackName || raceMeta?.track || "")) {
                buildAnalysisFromRaceData_(latestRaceDataPayload);
            }
            uiDirty = true;
            scheduleRender_();
            return pgLocalTracksCache;
        } catch (e) {
            pgLocalTracksCache = {
                rows: [],
                recordTracks: { lap: [], race: [] },
                fetchedAt: Date.now(),
                loading: false,
                error: pgErrorMessage_(e, "Local tracks unavailable")
            };
            return pgLocalTracksCache;
        }
    }

    function pgLocalRecordsKey_(mode, track, options = currentRecordsFetchOptions_()) {
        const recMode = String(mode || "lap").trim().toLowerCase() === "race" ? "race" : "lap";
        const type = recMode === "lap" ? "all" : (String(options.raceType || "official").toLowerCase() === "custom" ? "custom" : "official");
        const scope = String(options.scope || "global").toLowerCase() === "mine" ? "mine" : "global";
        const mineKey = scope === "mine" ? String(options.driverId || options.driverName || "").trim().toLowerCase() : "";
        return `${recMode}|${pgLocalNorm_(track || "")}|${type}|${scope}|${mineKey}`;
    }

    function pgLocalRecordsMatch_(mode, track) {
        return pgLocalRecordsCache.key === pgLocalRecordsKey_(mode, track);
    }

    async function pgLocalEnsureRecords_(mode, track, force = false) {
        const recMode = String(mode || "lap").trim() || "lap";
        const recTrack = String(track || "").trim();
        if (!recTrack) return null;
        const options = currentRecordsFetchOptions_();
        const key = pgLocalRecordsKey_(recMode, recTrack, options);
        if (pgLocalRecordsCache.loading && pgLocalRecordsCache.key === key) return pgLocalRecordsCache;
        if (!force && pgLocalRecordsCache.key === key && Date.now() - (pgLocalRecordsCache.fetchedAt || 0) < 30000) {
            return pgLocalRecordsCache;
        }
        pgLocalRecordsCache = { key, rows: pgLocalRecordsCache.key === key ? pgLocalRecordsCache.rows : [], fetchedAt: pgLocalRecordsCache.fetchedAt || 0, loading: true, error: "" };
        try {
            const result = await pgLocalFetchRecords(recMode, recTrack, 100, options);
            if (!result?.ok) throw new Error(result?.error || "Local records request failed");
            pgLocalRecordsCache = {
                key,
                rows: Array.isArray(result.records) ? result.records : [],
                fetchedAt: Date.now(),
                loading: false,
                error: ""
            };
            uiDirty = true;
            scheduleRender_();
            return pgLocalRecordsCache;
        } catch (e) {
            pgLocalRecordsCache = {
                key,
                rows: [],
                fetchedAt: Date.now(),
                loading: false,
                error: pgErrorMessage_(e, "Local records unavailable")
            };
            uiDirty = true;
            scheduleRender_();
            return pgLocalRecordsCache;
        }
    }

    function pgLocalGetCachedIntelForDriver_(d, trackName = "") {
        if (!pgLocalRaceIntelCache?.drivers) return null;

        const wantedTrack = pgLocalNorm_(trackName || analysis?.trackName || raceMeta?.track || "");
        const cachedTrack = pgLocalNorm_(pgLocalRaceIntelCache.track || "");

        if (wantedTrack && cachedTrack && wantedTrack !== cachedTrack) {
            return null;
        }
        const scope = currentRaceHistoryScope_(trackName);
        if ((pgLocalRaceIntelCache.raceType || "official") !== scope.raceType) return null;
        if (scope.laps && Number(pgLocalRaceIntelCache.laps || 0) !== scope.laps) return null;

        const driverId = String(d?.driverId || "").trim();

        if (driverId && pgLocalRaceIntelCache.drivers[driverId]) {
            return pgLocalRaceIntelCache.drivers[driverId];
        }

        const wantedName = pgLocalNorm_(d?.name || d?.driverName || "");

        return Object.values(pgLocalRaceIntelCache.drivers).find(x =>
            pgLocalNorm_(x?.name || x?.profile?.display_name || "") === wantedName
        ) || null;
    }

    async function pgLocalFetchCurrentRaceIntel_() {
        const set = predictionDriverSet_();
        const drivers = set.drivers || [];
        const track = set.trackName || analysis?.trackName || raceMeta?.track || "";

        if (!track) {
            throw new Error("Cannot fetch local race intel: missing track");
        }

        if (!drivers.length) {
            throw new Error("Cannot fetch local race intel: no drivers detected");
        }

        const payloadDrivers = drivers.map(d => ({
            driverId: String(d.driverId || "").trim(),
            name: d.name || d.driverName || "",
            car: toOgCarName_(d.car || "")
        })).filter(d => d.driverId || d.name);

        const scope = currentRaceHistoryScope_(track);
        const intel = await pgLocalFetchRaceIntel(track, payloadDrivers, scope);

        pgLocalRaceIntelCache = {
            ...intel,
            raceType: intel.raceType || scope.raceType,
            laps: intel.laps ?? scope.laps,
            fetchedAt: Date.now()
        };

        let syncedProfiles = 0;
        for (const entry of Object.values(pgLocalRaceIntelCache.drivers || {})) {
            const localIntel = pgLocalDriverIntelFromProfile_(entry);
            if (!localIntel) continue;
            cacheDriverIntel_(localIntel.driverId, localIntel);
            if (localIntel.name) cacheDriverIntel_(driverIntelNameKey_(localIntel.name), localIntel);
            syncedProfiles++;
        }
        if (syncedProfiles) {
            saveDriverIntelCache_();
            applyDriverIntelToModel_();
        }

        console.log("[Pit Guru Local DB intel cache]", pgLocalRaceIntelCache);

        return pgLocalRaceIntelCache;
    }

    unsafeWindow.pgLocalFetchCurrentRaceIntel = pgLocalFetchCurrentRaceIntel_;
    unsafeWindow.pgLocalGetCachedIntelForDriver = pgLocalGetCachedIntelForDriver_;

    function confidenceShrinkScore_(rawScore, sampleCount, neutral = 0.5, confidenceBase = 6) {
        const raw = Number(rawScore);
        if (!Number.isFinite(raw)) return neutral;
        const count = Math.max(0, Number(sampleCount) || 0);
        const confidence = clamp_(count / (count + confidenceBase), 0, 1);
        return neutral + ((clamp_(raw, 0, 1) - neutral) * confidence);
    }

    function predictionWinScore_(intel) {
        const starts = Number(intel?.racesEntered);
        const wins = Number(intel?.racesWon);
        const rate = Number.isFinite(Number(intel?.winRate))
            ? Number(intel.winRate)
            : (Number.isFinite(starts) && starts > 0 && Number.isFinite(wins) ? wins / starts : NaN);
        if (!Number.isFinite(rate)) return 0.45;
        return clamp_(rate / 0.35, 0, 1);
    }

    function predictionExperienceScore_(intel) {
        const starts = Number(intel?.racesEntered);
        if (!Number.isFinite(starts) || starts <= 0) return 0.45;
        return clamp_(Math.log10(starts + 1) / 4, 0, 1);
    }

    function predictionScoreForDriver_(d, drivers = analysis?.drivers || [], trackName = analysis?.trackName || raceMeta?.track || "") {
        const intel = useApiPredictions ? (d.driverIntel || getDriverIntelForDriver_(d)) : null;
        const rs = Number.isFinite(d.racingSkill) ? d.racingSkill : Number(intel?.racingSkill);
        const skill = Number.isFinite(rs) ? Math.sqrt(clamp_(rs / 100, 0, 1)) : 0.45;
        const win = predictionWinScore_(intel);
        const experience = predictionExperienceScore_(intel);

        const grid = Math.max(1, drivers.length || 1);

        const history = useHistoryPredictions ? getDriverTrackHistory_(d.driverId, d.name, trackName) : null;
        const rawHistoryScore = history?.races
            ? clamp_(1 - ((history.avgFinish || grid) - 1) / Math.max(1, grid - 1), 0, 1)
            : 0.5;
        const historyScore = confidenceShrinkScore_(rawHistoryScore, history?.races || 0, 0.5, 6);

        const riskPenalty = history?.riskScore
            ? clamp_((history.riskScore / 100) * clamp_((history.races || 0) / 10, 0, 1), 0, 0.12)
            : 0;

        let carTrackScore = 0.5;
        let localServerScore = 0.5;

        const localIntel = pgLocalGetCachedIntelForDriver_(d, trackName);

        if (localIntel) {
            const localTrack = localIntel.track || null;
            const localTrackCar = localIntel.trackCar || null;
            const localPrediction = localIntel.prediction || null;

            const localConfidence = clamp_(
                Math.max(
                    Number(localTrack?.confidence) || 0,
                    Number(localTrackCar?.confidence) || 0,
                    Number(localPrediction?.confidence) || 0
                ),
                0,
                1
            );

            const localTrackScoreRaw = localTrack?.races
                ? clamp_(1 - ((Number(localTrack.avg_finish) || grid) - 1) / Math.max(1, grid - 1), 0, 1)
                : 0.5;
            const localTrackScore = confidenceShrinkScore_(localTrackScoreRaw, Number(localTrack?.races) || 0, 0.5, 6);

            const localTrackCarScoreRaw = Number.isFinite(Number(localTrackCar?.result_score))
                ? clamp_(Number(localTrackCar.result_score) / 100, 0, 1)
                : 0.5;
            const localTrackCarScore = confidenceShrinkScore_(localTrackCarScoreRaw, Number(localTrackCar?.races) || 0, 0.5, 4);

            localServerScore = Number.isFinite(Number(localPrediction?.score))
                ? clamp_(Number(localPrediction.score) / 100, 0, 1)
                : 0.5;

            const localScore =
                (localTrackScore * 0.35) +
                (localTrackCarScore * 0.45) +
                (localServerScore * 0.20);

            const localWeight = clamp_(localConfidence * 0.30, 0, 0.30);

            carTrackScore = (carTrackScore * (1 - localWeight)) + (localScore * localWeight);
        }

        let score =
            (skill * 0.42) +
            (win * 0.18) +
            (experience * 0.12) +
            (historyScore * 0.18) +
            (carTrackScore * 0.10) -
            riskPenalty;

        if (!intel && !Number.isFinite(rs)) score -= 0.04;

        return score;
    }

        unsafeWindow.pgLocalDebugRankPredictions = function () {
        const set = predictionDriverSet_();
        const ranked = rankedPredictionDrivers_(set.drivers, set.trackName);

        const output = ranked.map(x => {
            const localIntel = pgLocalGetCachedIntelForDriver_(x.d, set.trackName);

            return {
                predictedPos: x.predictedPos,
                name: x.d.name,
                driverId: x.d.driverId,
                car: toOgCarName_(x.d.car || ""),
                score: Number(x.score.toFixed(4)),
                localDb: !!localIntel,
                localConfidence: localIntel?.prediction?.confidence ?? localIntel?.trackCar?.confidence ?? localIntel?.track?.confidence ?? null,
                localRisk: localIntel?.prediction?.risk || null,
                localTrackRaces: localIntel?.track?.races ?? null,
                localTrackCarRaces: localIntel?.trackCar?.races ?? null
            };
        });

        console.table(output);
        return output;
    };

    function rankedPredictionDrivers_(drivers = null, trackName = "") {
        const set = drivers ? { drivers, trackName } : predictionDriverSet_();
        const list = set.drivers || [];
        if (!list.length) return [];
        return list
            .map(d => ({ d, score: predictionScoreForDriver_(d, list, trackName || set.trackName || "") }))
            .sort((a, b) => b.score - a.score)
            .map((x, i) => Object.assign(x, { predictedPos: i + 1 }));
    }

    function updateDriverHistoryFromAnalysis_() {
        if (!analysis?.drivers?.length) return;
        const raceId = analysis.raceId || raceMeta?.raceId || `${analysis.trackName}:${analysis.drivers.map(d => d.finalTime).join(",")}`;
        const historyRaceKey = String(raceId || `${analysis.trackName}:${analysis.drivers.map(d => d.finalTime).join(",")}`).trim();
        const predicted = new Map(rankedPredictionDrivers_().map(x => [normalizeDriverName_(x.d.name), x.predictedPos]));
        const finalOrder = getLiveOrder_(Infinity, true);
        const trackName = analysis.trackName || raceMeta?.track || "";
        const atIso = new Date().toISOString();
        for (const x of finalOrder) {
            const d = x.driver;
            const key = driverHistoryKey_(d.driverId, d.name, trackName);
            const prev = driverHistory[key] || {
                driverId: String(d.driverId || ""),
                driverName: d.name,
                track: getRecordTrackScope_("race", trackName),
                races: 0,
                wins: 0,
                podiums: 0,
                crashes: 0,
                totalFinish: 0,
                bestLapMs: 0,
                bestRaceMs: 0,
                predictionSamples: 0,
                predictionAbsErrorTotal: 0,
                riskScore: 0,
                notes: []
            };
            const actual = finalOrder.indexOf(x) + 1;
            const pred = predicted.get(normalizeDriverName_(d.name)) || actual;
            const err = Math.abs(actual - pred);
            prev.driverId = String(d.driverId || prev.driverId || "");
            prev.driverName = d.name || prev.driverName;
            prev.lastRaceId = raceId;
            prev.lastRaceAtIso = atIso;
            prev.lastRacingSkill = d.racingSkill;
            prev.lastCar = toOgCarName_(d.car || prev.lastCar || "");
            prev.lastCarImg = d.carImg || prev.lastCarImg || "";
            const raceKeys = Array.isArray(prev.raceKeys) ? prev.raceKeys.map(String) : [prev.lastRaceId].filter(Boolean).map(String);
            const alreadyCounted = historyRaceKey && raceKeys.includes(historyRaceKey);
            if (!alreadyCounted) {
                prev.cars = prev.cars || {};
                if (prev.lastCar) prev.cars[prev.lastCar] = (prev.cars[prev.lastCar] || 0) + 1;
                prev.races = (prev.races || 0) + 1;
                prev.wins = (prev.wins || 0) + (actual === 1 ? 1 : 0);
                prev.podiums = (prev.podiums || 0) + (actual <= 3 ? 1 : 0);
                prev.crashes = (prev.crashes || 0) + (d.crashed ? 1 : 0);
                prev.totalFinish = (prev.totalFinish || 0) + actual;
                prev.avgFinish = prev.totalFinish / prev.races;
                prev.bestLapMs = !prev.bestLapMs || (d.bestLapSeconds && d.bestLapSeconds * 1000 < prev.bestLapMs) ? Math.round((d.bestLapSeconds || 0) * 1000) : prev.bestLapMs;
                prev.bestRaceMs = !prev.bestRaceMs || (d.finalTime && d.finalTime * 1000 < prev.bestRaceMs) ? Math.round((d.finalTime || 0) * 1000) : prev.bestRaceMs;
                prev.predictionSamples = (prev.predictionSamples || 0) + 1;
                prev.predictionAbsErrorTotal = (prev.predictionAbsErrorTotal || 0) + err;
                prev.avgPredictionError = prev.predictionAbsErrorTotal / prev.predictionSamples;
                prev.riskScore = clamp_((prev.avgPredictionError || 0) * 18 + ((prev.crashes || 0) / Math.max(1, prev.races)) * 30, 0, 100);
                const note = `${fmtWhen_(atIso)}: predicted P${pred}, finished P${actual}${d.crashed ? " (DNF)" : ""}.`;
                prev.notes = [note].concat(prev.notes || []).slice(0, 8);
                if (historyRaceKey) prev.raceKeys = [historyRaceKey].concat(raceKeys).filter(Boolean).slice(0, 50);
            } else {
                prev.raceKeys = raceKeys;
            }
            driverHistory[key] = prev;
        }
        saveDriverHistory_();
    }

    function pgNumOrNull_(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function pgIntOrNull_(value) {
        const n = Number(value);
        return Number.isFinite(n) ? Math.round(n) : null;
    }

    function pgSecondsToMs_(value) {
        const n = Number(value);
        return Number.isFinite(n) ? Math.round(n * 1000) : null;
    }

    function pgMpsToKmh_(value) {
        const n = Number(value);
        return Number.isFinite(n) ? Math.round(n * 3.6 * 10) / 10 : null;
    }

    function pgAverageLapMsFromDriver_(d) {
        const direct = pgSecondsToMs_(d.averageSeconds);
        if (direct) return direct;

        const lapSource = Array.isArray(d.validLapTimes) && d.validLapTimes.length
            ? d.validLapTimes
            : Array.isArray(d.lapTimes)
                ? d.lapTimes
                : [];

        const lapSeconds = lapSource
            .map(x => Number(x))
            .filter(x => Number.isFinite(x) && x > 0);

        if (lapSeconds.length) {
            const avg = lapSeconds.reduce((a, b) => a + b, 0) / lapSeconds.length;
            return Math.round(avg * 1000);
        }

        const finalTime = Number(d.finalTime);
        const completedLaps = Number(d.completedFullLaps || analysis?.laps || raceMeta?.laps || raceMeta?.replayInfo?.laps);

        if (Number.isFinite(finalTime) && finalTime > 0 && Number.isFinite(completedLaps) && completedLaps > 0) {
            return Math.round((finalTime / completedLaps) * 1000);
        }

        return null;
    }

    function pgBuildLapsFromDriver_(d) {
        const lapSource = Array.isArray(d.lapTimes) && d.lapTimes.length
            ? d.lapTimes
            : Array.isArray(d.validLapTimes)
                ? d.validLapTimes
                : [];

        const lapMsList = lapSource
            .map(x => pgSecondsToMs_(x))
            .map((ms, index) => ({
                lapNumber: index + 1,
                lapTimeMs: ms,
                isValid: Number.isFinite(Number(ms)) && Number(ms) > 0,
                isDriverBest: false,
                isRaceBest: false
            }))
            .filter(x => x.lapTimeMs);

        if (!lapMsList.length) return [];

        const bestDriverLapMs = Math.min(...lapMsList.map(x => x.lapTimeMs));

        for (const lap of lapMsList) {
            lap.isDriverBest = lap.lapTimeMs === bestDriverLapMs;
        }

        return lapMsList;
    }

    function pgBuildLocalRacePayloadFromAnalysis_() {
        if (!analysis?.drivers?.length) {
            throw new Error('No Pit Guru analysis drivers available');
        }
        ensureAnalysisAggregates_({ sectors: true, leads: true });
        if (!hugeFieldMode_()) ensureFullTelemetryStats_();
        const meta = raceMetaFromPayload_(analysis.payload);
        const replayInfo = raceMeta?.replayInfo || {};

        const raceId = String(
            analysis.raceId ||
            raceMeta?.raceId ||
            `${analysis.trackName}:${analysis.drivers.map(d => d.finalTime).join(",")}`
        ).trim();

        const trackName = String(analysis.trackName || raceMeta?.track || "").trim();

        if (!raceId) {
            throw new Error('Cannot build local DB payload: missing raceId');
        }

        if (!trackName) {
            throw new Error('Cannot build local DB payload: missing track');
        }

        const predicted = new Map(
            rankedPredictionDrivers_().map(x => [
                normalizeDriverName_(x.d.name),
                x.predictedPos
            ])
        );

        const finalOrder = getLiveOrder_(Infinity, true);

        if (!finalOrder?.length) {
            throw new Error('Cannot build local DB payload: no final order available');
        }

        const participants = finalOrder.map((x, index) => {
            const d = x.driver;
            const actual = index + 1;
            const pred = predicted.get(normalizeDriverName_(d.name)) || actual;
            const intel = d.driverIntel || getDriverIntelForDriver_(d, 24 * 7);
            const sqliteProfile = pgDriverProfilePayloadFromIntel_(intel, d) || {};

            const bestLapMs = d.bestLapSeconds
                ? Math.round(Number(d.bestLapSeconds) * 1000)
                : null;

            const raceTimeMs = (!d.crashed && d.finalTime)
                ? Math.round(Number(d.finalTime) * 1000)
                : null;
            let fuel = null;
            try {
                const fuelEstimate = fuelSnapshot_(d, Math.max(0, Number(d.finalTime) || maxAnalysisFinalTime_()), { persist: false });
                if (Number.isFinite(fuelEstimate?.liters) && Number.isFinite(fuelEstimate?.km) && fuelEstimate.km > 0) {
                    fuel = {
                        distanceKm: Number(fuelEstimate.km.toFixed(6)),
                        fuelLiters: Number(fuelEstimate.liters.toFixed(6)),
                        avgL100: Number.isFinite(fuelEstimate.avgL100) ? Number(fuelEstimate.avgL100.toFixed(6)) : null,
                        manufacturerL100: Number.isFinite(fuelEstimate.base) ? Number(fuelEstimate.base.toFixed(3)) : null,
                        tankLiters: Number.isFinite(fuelEstimate.tankLiters) ? Number(fuelEstimate.tankLiters.toFixed(3)) : 50
                    };
                }
            } catch { }

            return {
                driverId: String(d.driverId || sqliteProfile.driverId || "").trim(),
                driverName: d.name || sqliteProfile.driverName || "",
                avatarUrl: sqliteProfile.avatarUrl || "",
                level: sqliteProfile.level ?? null,
                rank: sqliteProfile.rank || "",
                title: sqliteProfile.title || "",
                car: toOgCarName_(d.car || ""),
                itemID: d.itemID || "",
                carImg: d.carImg || "",
                finishPosition: actual,
                bestLapMs,
                raceTimeMs,
                crashed: !!d.crashed,
                racingSkill: sqliteProfile.racingSkill ?? d.racingSkill ?? null,
                racingPointsEarned: sqliteProfile.racingPointsEarned ?? null,
                racesEntered: sqliteProfile.racesEntered ?? null,
                racesWon: sqliteProfile.racesWon ?? null,
                winRate: sqliteProfile.winRate ?? null,
                fetchedAtIso: sqliteProfile.fetchedAtIso || "",
                fuel,
                laps: pgBuildLapsFromDriver_(d),
                metrics: {
                    avgLapMs: pgAverageLapMsFromDriver_(d),
                    idealLapMs: pgSecondsToMs_(d.idealLapSeconds),
                    topSpeedKmh: pgMpsToKmh_(d.topSpeedMps),
                    slowestSpeedKmh: pgMpsToKmh_(d.slowestSpeedMps),
                    highestGEst: pgNumOrNull_(d.highestG),
                    lowestGEst: pgNumOrNull_(d.lowestG),
                    consistencyScore: pgNumOrNull_(d.consistencyScore),
                    sectorsWon: pgIntOrNull_(d.sectorsWon),
                    lapsLed: pgIntOrNull_(d.lapsLed),
                    timeInLeadMs: pgSecondsToMs_(d.timeInLeadSeconds),
                    leadChanges: pgIntOrNull_(d.leadChanges)
                },
                prediction: {
                    predictedPosition: pred,
                    modelVersion: "pit-guru-local-v1"
                }
            };
        }).filter(p => p.driverId || p.driverName);

const allValidLaps = participants
    .flatMap(p => p.laps || [])
    .filter(l => l.isValid && Number.isFinite(Number(l.lapTimeMs)) && Number(l.lapTimeMs) > 0);

const raceBestLapMs = allValidLaps.length
    ? Math.min(...allValidLaps.map(l => Number(l.lapTimeMs)))
    : null;

if (raceBestLapMs) {
    for (const participant of participants) {
        for (const lap of participant.laps || []) {
            lap.isRaceBest = Number(lap.lapTimeMs) === raceBestLapMs;
        }
    }
}

return {
    schemaVersion: 1,
    raceId,
    track: trackName,
    laps: Number(analysis.laps || raceMeta?.laps || raceMeta?.replayInfo?.laps || 0) || null,
    raceType: meta.type || replayInfo.type || "",
    carsAllowed: meta.carsAllowed || replayInfo.cars_allowed || "",
    upgradesAllowed: meta.upgradesAllowed || replayInfo.upgrades_allowed || "",
    startedAt: meta.startedIso || raceMeta?.startAtIso || toIsoFromAt_(replayInfo.time_started) || "",
    source: raceMeta?.replayInfo ? "replay" : "race-page",
    endedAt: meta.endedIso || raceMeta?.endAtIso || toIsoFromAt_(replayInfo.time_ended) || new Date().toISOString(),
    submittedBy: String(raceMeta?.driverId || ""),
    carData: raceDataCarRows_(analysis.payload),
    participants
};
    }

    unsafeWindow.pgBuildLocalRacePayloadFromAnalysis = pgBuildLocalRacePayloadFromAnalysis_;

    async function pgLocalSyncCurrentRace_(silent = false) {
        const payload = pgBuildLocalRacePayloadFromAnalysis_();

        if (!payload.participants?.length) {
            throw new Error('No participants found for local DB sync');
        }

        const hasUsefulResultData = payload.participants.some(p =>
            p.bestLapMs ||
            p.raceTimeMs ||
            p.crashed
        );

        if (!hasUsefulResultData) {
            throw new Error('Race result data is not ready yet');
        }

        const result = await pgLocalSubmitRace(payload);

        console.log('[Pit Guru Local DB sync]', {
            payload,
            result
        });

        if (result?.ok) {
            pgLocalTrackHistoryCacheByTrack = {};
            if (pgLocalTrackHistoryMatches_(payload.track)) pgLocalTrackHistoryCache.fetchedAt = 0;
            pgLocalEnsureTrackHistory_(payload.track, true).catch(() => {});
        }

        if (!silent) {
            alert(
                `Pit Guru Local DB sync complete.\n\n` +
                `Race ID: ${result.raceId}\n` +
                `Inserted: ${result.inserted}\n` +
                `Duplicates: ${result.duplicates}\n` +
                `Stats updated: ${result.updatedStats}`
            );
        }

        return result;
    }

    unsafeWindow.pgLocalSyncCurrentRace = pgLocalSyncCurrentRace_;

    function removeLegacyLocalFloatingButtons_() {
        document.getElementById("pgLocalSyncBtn")?.remove();
        document.getElementById("pgLocalIntelBtn")?.remove();
    }

    const pgLegacyFloatingButtonCleanupTimer = setInterval(() => {
        if (document.body) {
            removeLegacyLocalFloatingButtons_();
            clearInterval(pgLegacyFloatingButtonCleanupTimer);
        }
    }, 500);

    function getDriverIntelPool_(sourceDrivers = null) {
        const byId = new Map();
        const large = largeLobbyMode_();
        const add = d => {
            const id = String(d?.driverId || "").trim() || (large ? "" : lookupVisibleDriverIdByName_(d?.name || "")) || (isUserDriver_(d) ? "self" : "");
            const nameKey = driverIntelNameKey_(d?.name || "");
            if (!id && getCachedDriverIntelByName_(d?.name || "")) return;
            if (!id) return;
            if (id !== "self" && d && !String(d.driverId || "").trim()) d.driverId = id;
            if (byId.has(id)) return;
            if (nameKey && Array.from(byId.values()).some(x => driverIntelNameKey_(x.name) === nameKey)) return;
            byId.set(id, {
                driverId: id,
                name: String(d.name || ""),
                racingSkill: d.racingSkill,
                car: toOgCarName_(d.car || ""),
                carImg: d.carImg || ""
            });
        };
        const source = Array.isArray(sourceDrivers)
            ? sourceDrivers
            : analysis?.drivers?.length
                ? analysis.drivers
                : (!liveRaceHasWorkingAnalysis_() ? (preRaceParticipants.length ? preRaceParticipants : refreshPreRaceParticipants_()) : []);
        source.forEach(add);
        return Array.from(byId.values());
    }

    function gmRequestJson_(url) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== "function") {
                fetch(url).then(r => r.json()).then(resolve).catch(reject);
                return;
            }
            GM_xmlhttpRequest({
                method: "GET",
                url,
                timeout: 20000,
                onload: res => {
                    try { resolve(JSON.parse(String(res.responseText || "{}"))); }
                    catch (e) { reject(e); }
                },
                onerror: reject,
                ontimeout: () => reject(new Error("Driver Intel request timed out"))
            });
        });
    }

    function maskApiKey_(value) {
        const key = String(value || "");
        if (key.length <= 8) return key ? "*".repeat(key.length) : "";
        return `${key.slice(0, 4)}${"*".repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`;
    }

    function apiKeyAccessLabel_(info = apiKeyInfo) {
        const type = String(info?.accessType || "").trim();
        const level = Number(info?.accessLevel);
        if (type) return Number.isFinite(level) && level > 0 ? `${type} (level ${level})` : type;
        return Number.isFinite(level) && level > 0 ? `Level ${level}` : "Unknown access";
    }

    function apiKeyInfoHtml_() {
        if (!apiKey) return `<span class="mpg-key-status bad">Key access: Missing <b class="mpg-status-mark">x</b></span><span class="muted">Driver Intel needs a Torn API key. Race analysis still works without it.</span>`;
        if (apiKeyCheckActive) return `<span class="mpg-key-status">Key access: Checking...</span><span class="muted">Validating with Torn v2 key/info.</span>`;
        if (!apiKeyInfo?.lastChecked) return `<span class="mpg-key-status muted">Key access: Not checked yet</span><span class="muted">Pit Guru checks it on refresh and when you press Check key.</span>`;
        const failed = apiKeyInfo.accessType === "Check failed" || apiKeyInfo.error;
        const full = !!apiKeyInfo.fullAccess;
        const cls = failed ? "bad" : (full ? "good" : "warn");
        const mark = failed ? "x" : (full ? "✓" : "!");
        const label = failed ? "Check failed" : apiKeyAccessLabel_(apiKeyInfo);
        const checked = fmtWhen_(apiKeyInfo.lastChecked);
        const details = [
            apiKeyInfo.userId ? `User ID ${apiKeyInfo.userId}` : "",
            apiKeyInfo.companyId ? `Company ID ${apiKeyInfo.companyId}` : "",
            apiKeyInfo.companyAccess ? "Company access" : "",
            apiKeyInfo.factionAccess ? "Faction access" : "",
            apiKeyInfo.logCustomPermissions ? "Log permissions" : ""
        ].filter(Boolean).join(" · ");
        return `<span class="mpg-key-status ${cls}">Key access: ${esc_(label)} <b class="mpg-status-mark">${mark}</b></span><span class="muted">Checked ${esc_(checked)}${details ? ` · ${esc_(details)}` : ""}</span>`;
    }

    async function checkApiKeyInfo_(opts = {}) {
        if (apiKeyCheckActive) return false;
        const manual = !!opts.manual;
        const key = String(apiKey || "").trim();
        if (!key) {
            apiKeyInfo = {};
            saveApiKeyInfo_();
            apiKeyStatus = "Add an API key first.";
            if (manual) toast_("Add an API key first.");
            uiDirty = true; scheduleRender_();
            return false;
        }
        apiKeyCheckActive = true;
        apiKeyStatus = "Checking key access...";
        uiDirty = true; scheduleRender_();
        try {
            const json = await gmRequestJson_(`https://api.torn.com/v2/key/info?key=${encodeURIComponent(key)}`);
            if (json?.error) throw new Error(json.error.error || json.error.code || "Torn API error");
            const info = json?.info || json || {};
            const access = info.access || {};
            const user = info.user || {};
            const accessLevel = Number(access.level || 0);
            const accessType = String(access.type || "").trim();
            const fullAccess = accessLevel >= 4 || /full\s*access/i.test(accessType);
            apiKeyInfo = {
                lastChecked: new Date().toISOString(),
                accessLevel: Number.isFinite(accessLevel) ? accessLevel : 0,
                accessType,
                fullAccess,
                companyAccess: Boolean(access.company),
                factionAccess: Boolean(access.faction),
                logCustomPermissions: Boolean(access.log && access.log.custom_permissions),
                userId: String(user.id || "").trim(),
                companyId: String(user.company_id || user.companyId || "").trim()
            };
            saveApiKeyInfo_();
            apiKeyStatus = fullAccess ? "Full Access key detected." : `Key access is ${accessType || `level ${apiKeyInfo.accessLevel}` || "limited"}.`;
            if (manual) toast_(apiKeyStatus);
            return true;
        } catch (e) {
            apiKeyInfo = Object.assign({}, apiKeyInfo || {}, {
                lastChecked: new Date().toISOString(),
                fullAccess: false,
                accessType: "Check failed",
                error: pgErrorMessage_(e, "Key check failed")
            });
            saveApiKeyInfo_();
            apiKeyStatus = apiKeyInfo.error;
            if (manual) toast_(apiKeyStatus);
            return false;
        } finally {
            apiKeyCheckActive = false;
            uiDirty = true; scheduleRender_();
        }
    }

    function delay_(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function fetchDriverIntelJson_(driverId) {
        const id = String(driverId || "").trim();
        const isSelf = id === "self";
        const stat = "racingskill,racingpointsearned,racesentered,raceswon";
        const urls = [
            isSelf
                ? `https://api.torn.com/user/?selections=profile,personalstats&stat=${encodeURIComponent(stat)}&comment=MRG&key=${encodeURIComponent(apiKey)}`
                : `https://api.torn.com/user/${encodeURIComponent(id)}?selections=profile,personalstats&stat=${encodeURIComponent(stat)}&comment=MRG&key=${encodeURIComponent(apiKey)}`,
            isSelf
                ? `https://api.torn.com/user/?selections=profile,personalstats&comment=MRG&key=${encodeURIComponent(apiKey)}`
                : `https://api.torn.com/user/${encodeURIComponent(id)}?selections=profile,personalstats&comment=MRG&key=${encodeURIComponent(apiKey)}`
        ];
        let last = null;
        for (const url of urls) {
            const json = await gmRequestJson_(url);
            last = json;
            if (!json?.error) return json;
        }
        return last;
    }

    async function fetchDriverIntelPool_(force = false) {
        if (driverIntelFetchActive) return;
        if (!apiKey) {
            driverIntelStatus = "Add an API key in Settings first.";
            uiDirty = true; scheduleRender_();
            return;
        }
        const pool = getDriverIntelPool_();
        const todo = pool.filter(d => force || driverIntelNeedsProfileRefresh_(d.driverId, d.name));
        if (!todo.length) {
            driverIntelStatus = `Driver Intel ready from cache (${pool.length} driver${pool.length === 1 ? "" : "s"}).`;
            applyDriverIntelToModel_();
            notifyDriverSync_(`driver-sync-cache:${preRaceParticipantsKey || raceMeta?.raceId || pool.length}`, driverIntelStatus);
            uiDirty = true; scheduleRender_();
            return;
        }
        driverIntelFetchActive = true;
        let ok = 0, failed = 0;
        const sqliteProfiles = [];
        try {
            for (let i = 0; i < todo.length; i++) {
                const d = todo[i];
                driverIntelStatus = `Fetching Driver Intel ${i + 1}/${todo.length}: ${d.name || d.driverId}`;
                const renderIntelProgress = !largeFieldMode_() || i === 0 || i === todo.length - 1 || i % 5 === 0;
                if (renderIntelProgress) { uiDirty = true; scheduleRender_(); }
                try {
                    const json = await fetchDriverIntelJson_(d.driverId);
                    if (json?.error) {
                        failed++;
                        driverIntelStatus = `Driver Intel error: ${json.error.error || json.error.code || "API error"}`;
                        if (String(json.error.code || "") === "2") break;
                    } else {
                        const intel = normalizeDriverIntel_(d.driverId, json);
                        cacheDriverIntel_(d.driverId, intel);
                        const sqliteProfile = pgDriverProfilePayloadFromIntel_(intel, d);
                        if (sqliteProfile) sqliteProfiles.push(sqliteProfile);
                        ok++;
                    }
                } catch {
                    failed++;
                }
                saveDriverIntelCache_();
                applyDriverIntelToModel_();
                if (renderIntelProgress) { uiDirty = true; scheduleRender_(); }
                if (i < todo.length - 1) await delay_(750);
            }
        } finally {
            driverIntelFetchActive = false;
            if (sqliteProfiles.length) {
                pgLocalUpsertDriverIntel_(sqliteProfiles).catch(() => {});
            }
            driverIntelStatus = `Driver Intel complete: ${ok} fetched, ${failed} failed, ${pool.length - todo.length} cached.`;
            notifyDriverSync_(`driver-sync:${preRaceParticipantsKey || raceMeta?.raceId || ""}:${ok}:${failed}:${pool.length - todo.length}`, driverIntelStatus);
            applyDriverIntelToModel_();
            uiDirty = true; scheduleRender_();
        }
    }

    function visibleRaceDriverSlots_() {
        if (!canScanTornPage_()) return { current: NaN, total: NaN };
        const now = Date.now();
        if (visibleRaceDriverSlotsCache?.value && now - visibleRaceDriverSlotsCache.at < 1500) {
            return visibleRaceDriverSlotsCache.value;
        }
        const texts = [];
        const panel = visualProgressPanelText_();
        if (panel) texts.push(panel);
        for (const sel of ["#racingdetails", "#racingupdatesnew", "#racingupdates"]) {
            try {
                const el = document.querySelector(sel);
                if (el && !isInsidePitGuruUi_(el)) texts.push(String(el.textContent || ""));
            } catch {}
        }
        const text = texts.join(" ").replace(/\s+/g, " ");
        const patterns = [
            /\b(?:drivers?|racers?|participants?|entrants?)\D{0,24}(\d{1,3})\s*\/\s*(\d{1,3})\b/i,
            /\b(\d{1,3})\s*\/\s*(\d{1,3})\D{0,24}(?:drivers?|racers?|participants?|entrants?)\b/i
        ];
        for (const re of patterns) {
            const m = text.match(re);
            if (!m) continue;
            const current = Number(m[1]);
            const total = Number(m[2]);
            if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
                visibleRaceDriverSlotsCache = { at: now, value: { current, total } };
                return visibleRaceDriverSlotsCache.value;
            }
        }
        visibleRaceDriverSlotsCache = { at: now, value: { current: NaN, total: NaN } };
        return visibleRaceDriverSlotsCache.value;
    }

    function maybeAutoFetchDriverIntel_() {
        if (!apiKey || driverIntelFetchActive) return;
        if (!isReplayPage_() && !canScanTornPage_()) return;
        if (liveRaceHasWorkingAnalysis_() && largeFieldMode_()) return;
        const replayOrJsonReady = isReplayPage_() || !!analysis?.drivers?.length || !!latestRaceDataPayload;
        const visibleCount = lobbySize_();
        if (!replayOrJsonReady && visibleCount >= HUGE_FIELD_THRESHOLD) {
            const msg = `Huge grid detected (${Math.round(visibleCount)} drivers). Automatic Driver Intel is paused; use row Fetch or Settings refresh if needed.`;
            if (driverIntelStatus !== msg) {
                driverIntelStatus = msg;
                uiDirty = true; scheduleRender_();
            }
            return;
        }
        if (visualRaceHasStarted_() && !replayOrJsonReady) return;
        const pool = getDriverIntelPool_();
        if (!pool.length) return;
        const ids = pool.map(d => d.driverId).filter(Boolean).sort();
        const poolKey = ids.join(",");
        if (poolKey !== driverIntelPoolStableKey) {
            driverIntelPoolStableKey = poolKey;
            driverIntelPoolStableAt = Date.now();
            driverIntelStatus = `Driver grid detected: ${pool.length} profile${pool.length === 1 ? "" : "s"} found; waiting for the list to settle.`;
            uiDirty = true; scheduleRender_();
            return;
        }
        const slots = visibleRaceDriverSlots_();
        const countdown = raceDataCountdownSeconds_();
        const waitingForKnownSlots = Number.isFinite(slots.total) && pool.length < slots.total && Number.isFinite(countdown) && countdown > 5 && !replayOrJsonReady;
        const joinWaitMs = Math.max(driverIntelSettleMs * 4, participantScanMs * 2);
        if (waitingForKnownSlots && Date.now() - driverIntelPoolStableAt < joinWaitMs) {
            driverIntelStatus = `Driver grid detected: ${pool.length}/${slots.total}; waiting for participants to finish joining.`;
            uiDirty = true; scheduleRender_();
            return;
        }
        if (Date.now() - driverIntelPoolStableAt < driverIntelSettleMs && !replayOrJsonReady) return;
        const raceKey = `${analysis?.raceId || raceMeta?.raceId || raceMeta?.metaKey || "race"}|${poolKey}`;
        if (driverIntelAutoRaceKey === raceKey) return;
        if (!pool.some(d => driverIntelNeedsProfileRefresh_(d.driverId, d.name))) return;
        driverIntelAutoRaceKey = raceKey;
        fetchDriverIntelPool_(false);
    }


    // ============================
    // TRACK RECORDS (per track, unique cars)
    // ============================
    function makeRecId_(mode, track, car, atIso) {
        return `${mode}|${track}|${car}|${atIso}`;
    }

    function msToTimeText_(ms, mode) {
        // lap/chrono/last: m:ss.mmm
        // race: h:mm:ss.mmm (or m:ss.mmm when < 1h)
        ms = Math.max(0, Math.floor(ms || 0));
        if (!ms) return '';
        if (mode === "race") {
            const totalSec = Math.floor(ms / 1000);
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            const mm = ms % 1000;
            if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(mm).padStart(3, "0")}`;
            return `${m}:${String(s).padStart(2, "0")}.${String(mm).padStart(3, "0")}`;
        }
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        const mm = ms % 1000;
        return `${m}:${String(s).padStart(2, "0")}.${String(mm).padStart(3, "0")}`;
    }

    function timeTextToMs_(t) {
        const s = String(t || "").trim().toLowerCase();
        if (!s) return null;

        // h:mm:ss(.ms)
        let m1 = s.match(/^(\d{1,3}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
        if (m1) {
            return ((parseInt(m1[1], 10) * 3600) + (parseInt(m1[2], 10) * 60) + parseInt(m1[3], 10)) * 1000 +
                (m1[4] ? parseInt(m1[4].padEnd(3, "0"), 10) : 0);
        }

        // mm:ss(.ms)
        m1 = s.match(/^(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?$/);
        if (m1) {
            return (parseInt(m1[1], 10) * 60 + parseInt(m1[2], 10)) * 1000 +
                (m1[3] ? parseInt(m1[3].padEnd(3, "0"), 10) : 0);
        }

        // ss.ms (e.g. 50.825)
        m1 = s.match(/^(\d{1,3})\.(\d{1,3})$/);
        if (m1) return parseInt(m1[1], 10) * 1000 + parseInt(m1[2].padEnd(3, "0"), 10);

        // "14 minutes, 27 seconds" / "1 hour, 2 minutes, 3 seconds" / "14m 27s"
        const h = (s.match(/(\d+)\s*(?:h|hour|hours)\b/) || [])[1];
        const min = (s.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/) || [])[1];
        const sec = (s.match(/(\d+)\s*(?:s|sec|secs|second|seconds)\b/) || [])[1];

        if (h || min || sec) {
            const hh = h ? parseInt(h, 10) : 0;
            const mm = min ? parseInt(min, 10) : 0;
            const ss = sec ? parseInt(sec, 10) : 0;
            if ([hh, mm, ss].some(n => !Number.isFinite(n))) return null;
            return ((hh * 3600) + (mm * 60) + ss) * 1000;
        }

        return null;
    }

    function esc_(s) {
        return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    }

    function escAttr_(s) { return esc_(s); }

    function fmtWhen_(iso) {
        if (!iso) return "—";
        const s = String(iso);
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.replace("T", " ").replace("Z", "").slice(0, 16);
        return s.slice(0, 32);
    }

    // Alias used by some render/export paths
    function escapeHtml_(s) { return esc_(s); }


    function toIsoFromAt_(atStr) {
        // Convert "YYYY-MM-DD HH:MM:SS.mmm" -> "YYYY-MM-DDTHH:MM:SS.mmmZ"
        const s = String(atStr || "").trim();
        if (!s) return "";
        if (s.includes("T")) return s;
        const m = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?$/);
        if (!m) return "";
        const ms = m[3] ? "." + m[3].padEnd(3, "0") : "";
        return `${m[1]}T${m[2]}${ms}Z`;
    }

    function sanitizeFilePart_(s) {
        return String(s || "")
            .trim()
            .replace(/[\/\\:*?"<>|]/g, "")
            .replace(/\s+/g, " ")
            .replace(/\s/g, "_")
            .replace(/_+/g, "_")
            .slice(0, 60) || "Unknown";
    }

    function buildBaseFilename_() {
        const m = raceMeta || { track: "UnknownTrack", car: "Replay", detectedAtIso: nowIso_(), startAtIso: "" };

        // Prefer true race start time:
        // 1) replay info "Time started" (race log)
        // 2) our recorded startAtIso (live/replay playback baseline)
        // 3) detectedAtIso
        let whenIso = "";
        const tStarted = (m.replayInfo && (m.replayInfo.time_started || m.replayInfo.timeStarted)) ? String(m.replayInfo.time_started || m.replayInfo.timeStarted) : "";
        if (tStarted) {
            // "YYYY-MM-DD HH:MM:SS" -> ISO-ish
            const mm = tStarted.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
            whenIso = mm ? `${mm[1]}T${mm[2]}Z` : "";
        }
        if (!whenIso && m.startAtIso) whenIso = String(m.startAtIso);
        if (!whenIso) whenIso = String(m.detectedAtIso || nowIso_());

        const d = new Date(whenIso);
        const stamp = formatLocalStamp_(d);
        const track = sanitizeFilePart_(m.track);
        const car = sanitizeFilePart_(toOgCarName_(m.car));

        // Position tag (P1, P6, etc.) from decoded race results only.
        let pTag = "";
        try {
            const ordered = analysis?.drivers?.length ? getLiveOrder_(Infinity, true) : [];
            const idx = ordered.findIndex(x => isUserDriver_(x.driver));
            if (idx >= 0) pTag = `_P${idx + 1}`;
        } catch { }

        return `${stamp}.${track}.${car}${pTag}`;
    }

    function clearRaceMeta_() {
        raceMeta = null;
        spectateName = "";
        spectateCar = "";
        spectateCarImg = "";
        spectateDriverId_ = "";
        GM_setValue(STORE_META_KEY, "");
    }

    function getAllTrackNames_(mode = recordsMode) {
        const out = new Set();
        try {
            pgLocalTrackRows_().forEach(row => {
                const name = String(row?.name || row?.Name || "").trim();
                if (name) out.add(name);
            });
            const localRecordTracks = pgLocalTracksCache?.recordTracks?.[mode] || [];
            if (Array.isArray(localRecordTracks)) {
                localRecordTracks.forEach(t => {
                    const name = String(t || "").trim();
                    if (name) out.add(name);
                });
            }
        } catch { }
        try {
            for (const r of (records || [])) {
                if (!r || String(r.mode || "") !== String(mode || "")) continue;
                const scoped = getRecordTrackScopeFromRow_(r, mode);
                if (scoped) out.add(scoped);
            }
        } catch { }
        const currentTrackLabel = mode === "race" ? formatRaceTrackLabel_((raceMeta?.track || "").trim(), Number(analysis?.laps || raceMeta?.laps || 0)) : (raceMeta?.track || "").trim();
        const cur = getRecordTrackScope_(mode, currentTrackLabel);
        if (cur) out.add(cur);

        // Fallback: common track names (if the current page view doesn't expose a track selector).
        if (out.size < 3) {
            ["Underdog", "Parkland", "Mudpit", "Speedway", "Stone Park", "Commerce", "Meltdown", "Uptown", "Withdrawal", "Hammerhead", "Docks", "Industrial", "Vector", "Two Islands", "Sewage", "Convict"]
                .forEach(t => out.add(t));
        }

        return Array.from(out).sort((a, b) => a.localeCompare(b));
    }



    function urlRaceId_() {
        try {
            const u = new URL(location.href);
            const p = u.searchParams;
            const direct = (p.get("raceID") || p.get("raceId") || p.get("raceid") || "").trim();
            if (direct) return direct;
            const hashParams = new URLSearchParams(String(u.hash || "").replace(/^#\/?/, "").replace(/^[^?]*\?/, ""));
            return (hashParams.get("raceID") || hashParams.get("raceId") || hashParams.get("raceid") || "").trim();
        } catch (e) {
            return "";
        }
    }

    function getRaceId_() {
        const payload = latestRaceDataPayload || analysis?.payload || null;
        if (payload?.__mpgIgnoreRaceId) return urlRaceId_();
        return urlRaceId_() || directCurrentRaceId || visibleRaceId_();
    }

    function tornRacePanelText_() {
        return visibleRacePageInfo_().text || "";
    }

    function visibleRacePageInfo_(force = false) {
        const now = Date.now();
        const href = String(location.href || "");
        if (!canScanTornPage_()) {
            if (visibleRaceInfoCache.href === href) return visibleRaceInfoCache;
            return { at: now, href, raceId: urlRaceId_(), text: "" };
        }
        if (!force && visibleRaceInfoCache.href === href && now - visibleRaceInfoCache.at < visibleRaceScanMs) {
            return visibleRaceInfoCache;
        }
        const selectors = [
            "#racingdetails", "#racingupdatesnew", "#racingupdates", "#raceDetails", "#race-details"
        ];
        const parts = [];
        const roots = [];
        for (const sel of selectors) {
            try {
                document.querySelectorAll(sel).forEach(el => {
                    if (isInsidePitGuruUi_(el)) return;
                    roots.push(el);
                    const txt = String(el.textContent || "").replace(/\s+/g, " ").trim();
                    if (txt) parts.push(txt);
                });
            } catch {}
        }
        const text = parts.join(" ");
        let raceId = urlRaceId_();
        if (!raceId) {
            const m = text.match(/\bRace\s*ID\s*:?\s*(\d{4,})\b/i) || text.match(/\braceID[=:\s]+(\d{4,})\b/i);
            if (m) raceId = m[1];
        }
        if (!raceId) {
            for (const root of roots) {
                try {
                    const links = Array.from(root.querySelectorAll('a[href*="raceID="],a[href*="raceId="],a[href*="raceid="]'))
                        .filter(a => !isInsidePitGuruUi_(a));
                    for (const a of links) {
                        const u = new URL(String(a.getAttribute("href") || ""), location.origin);
                        const rid = (u.searchParams.get("raceID") || u.searchParams.get("raceId") || u.searchParams.get("raceid") || "").trim();
                        if (rid) { raceId = rid; break; }
                    }
                    if (raceId) break;
                } catch {}
            }
        }
        visibleRaceInfoCache = { at: now, href, raceId, text };
        return visibleRaceInfoCache;
    }

    function visibleRaceId_() {
        return visibleRacePageInfo_().raceId || "";
    }

    function isReplayPage_() {
        try {
            const u = new URL(location.href);
            const tab = (u.searchParams.get("tab") || "").toLowerCase();
            const sid = (u.searchParams.get("sid") || "").toLowerCase();
            return tab === "log" || tab === "replay" || (sid === "racingdata" && !!urlRaceId_());
        } catch (e) {
            return false;
        }
    }

    function hasJoinRacingEventAction_() {
        if (!canScanTornPage_()) return false;
        try {
            return !!document.querySelector(
                'a[href*="sid=racing"][href*="section=changeRacingCar"][href*="step=getInRace"]'
            );
        } catch {
            return false;
        }
    }

    function isGenericRacingLanding_() {
        try {
            const u = new URL(location.href);
            if ((u.searchParams.get("sid") || "").toLowerCase() !== "racing") return false;
            if (urlRaceId_() || isReplayPage_()) return false;
            if (hasJoinRacingEventAction_()) return true;
            const text = String(visibleRacePageInfo_().text || "").toLowerCase();
            return !/\brace\s+(?:started|finished|replaying|starts?\s+in)\b/.test(text);
        } catch {
            return false;
        }
    }

    function priorRaceFinishedForClear_() {
        if (!analysis) return false;
        if (liveVisualHasEnded_()) return true;
        if (String(raceMeta?.endAtIso || "").trim()) return true;
        return !!(
            finalAnalysisNotifiedForRaceId &&
            String(finalAnalysisNotifiedForRaceId) === String(analysis?.raceId || raceMeta?.raceId || "")
        );
    }

    function ensureRaceMeta_() {
        let payload = latestRaceDataPayload || analysis?.payload || null;
        const ignorePayloadRaceId = !!payload?.__mpgIgnoreRaceId;
        const pageRaceId = ignorePayloadRaceId ? urlRaceId_() : getRaceId_();
        const payloadRaceId = ignorePayloadRaceId ? "" : String(payload?.raceID || payload?.raceId || payload?.id || "").trim();
        if (pageRaceId && payloadRaceId && payloadRaceId !== pageRaceId) payload = null;
        const meta = raceMetaFromPayload_(payload, false);
        const rid = pageRaceId || meta.raceId || "";
        const visibleTrack = visibleRaceTrackName_();
        const track = meta.track || visibleTrack || (!rid || rid === raceMeta?.raceId ? raceMeta?.track : "") || "UnknownTrack";
        const d = new Date();
        if (!raceMeta) {
            const detectedAtIso = d.toISOString();
            raceMeta = {
                track,
                car: spectateCar || "",
                carImg: spectateCarImg || "",
                driver: meta.userName || currentDriverName_(),
                driverId: meta.userId || currentDriverId_(),
                raceId: rid,
                replayInfo: {},
                theme: theme,
                totalTime: "",
                detectedAtIso,
                detectedAtLocal: formatLocalDateTime_(d),
                metaKey: makeRaceMetaKey_(track, "JSON", rid, detectedAtIso),
                countdown: "",
                startAtIso: meta.startedIso || "",
                endAtIso: meta.endedIso || ""
            };
            saveRaceMeta_(raceMeta);
        }

        let changed = false;
        if (track && track !== raceMeta.track) { raceMeta.track = track; changed = true; }
        const nextDriver = currentDriverName_();
        const nextDriverId = currentDriverId_();
        if ((meta.userName || nextDriver) && raceMeta.driver !== (nextDriver || meta.userName)) { raceMeta.driver = nextDriver || meta.userName; changed = true; }
        if ((meta.userId || nextDriverId) && raceMeta.driverId !== (nextDriverId || meta.userId)) { raceMeta.driverId = nextDriverId || meta.userId; changed = true; }

        const oldRaceId = raceMeta.raceId || "";
        const raceIdChanged = oldRaceId !== rid;
        if (raceIdChanged) {
            raceMeta.raceId = rid;
            raceMeta.startAtIso = meta.startedIso || "";
            raceMeta.endAtIso = meta.endedIso || "";
            raceMeta.totalTime = "";
            raceMeta.replayInfo = {};
            changed = true;
        }

        const th = theme;
        if ((raceMeta.theme || "dark") !== th) { raceMeta.theme = th; changed = true; }

        const countdown = raceDataCountdownSeconds_();
        const cd = countdown > 0 ? String(Math.floor(countdown)) : "";
        if ((raceMeta.countdown || "") !== cd) { raceMeta.countdown = cd; changed = true; }
        if (meta.startedIso && raceMeta.startAtIso !== meta.startedIso) { raceMeta.startAtIso = meta.startedIso; changed = true; }
        if (meta.endedIso && raceMeta.endAtIso !== meta.endedIso) { raceMeta.endAtIso = meta.endedIso; changed = true; }
        if (meta.laps && raceMeta.laps !== meta.laps) { raceMeta.laps = meta.laps; changed = true; }
        const nextReplayInfo = {
            name: meta.name || raceMeta.replayInfo?.name || "",
            type: meta.type || raceMeta.replayInfo?.type || "",
            cars_allowed: meta.carsAllowed || raceMeta.replayInfo?.cars_allowed || "",
            upgrades_allowed: meta.upgradesAllowed || raceMeta.replayInfo?.upgrades_allowed || "",
            bet_amount: meta.betAmount ?? raceMeta.replayInfo?.bet_amount ?? "",
            time_started: meta.startedIso ? reportDateText_(meta.startedIso) : (raceMeta.replayInfo?.time_started || ""),
            time_ended: meta.endedIso ? reportDateText_(meta.endedIso) : (raceMeta.replayInfo?.time_ended || ""),
            laps: meta.laps || raceMeta.replayInfo?.laps || ""
        };
        if (JSON.stringify(raceMeta.replayInfo || {}) !== JSON.stringify(nextReplayInfo)) {
            raceMeta.replayInfo = nextReplayInfo;
            changed = true;
        }

        const newKey = makeRaceMetaKey_(raceMeta.track || "UnknownTrack", "JSON", raceMeta.raceId || "", raceMeta.detectedAtIso || "");
        if (raceMeta.metaKey !== newKey) {
            const wasLegacyKey = !/^(race|seen):/.test(String(raceMeta.metaKey || ""));
            if (raceIdChanged || !wasLegacyKey) {
                const d = new Date();
                raceMeta.detectedAtIso = d.toISOString();
                raceMeta.detectedAtLocal = formatLocalDateTime_(d);
            }
            raceMeta.metaKey = makeRaceMetaKey_(raceMeta.track || "UnknownTrack", "JSON", raceMeta.raceId || "", raceMeta.detectedAtIso);
            changed = true;
        }

        if (changed) {
            saveRaceMeta_(raceMeta);
        }
    }

    function maybeResetOnRaceIdChange_() {
        if (!isReplayPage_() && !canScanTornPage_()) return;
        const currentRaceId = getRaceId_();
        if (!currentRaceId) {
            pendingRaceChangeId = "";
            pendingRaceChangeAt = 0;
            if (
                clearOnRaceChange &&
                analysis &&
                priorRaceFinishedForClear_() &&
                (hasJoinRacingEventAction_() || isGenericRacingLanding_())
            ) {
                resetForRaceChange_("");
                return;
            }
            if (analysis?.payload && !isReplayPage_()) {
                const visibleRows = scrapeVisibleParticipants_();
                if (visibleRows.length >= 2 && !currentRacingDataMatchesVisibleGridCached_(analysis.payload)) {
                    resetForRaceChange_("");
                }
            }
            return;
        }

        const activeRaceId = String(analysis?.raceId || raceMeta?.raceId || "").trim();
        const storedRaceId = loadLastRaceId_();
        if (!storedRaceId) {
            prepareNewRaceUi_();
            saveLastRaceId_(currentRaceId);
            uiDirty = true;
            scheduleRender_();
            return;
        }

        if ((activeRaceId && activeRaceId !== currentRaceId) || storedRaceId !== currentRaceId) {
            if (pendingRaceChangeId !== currentRaceId) {
                pendingRaceChangeId = currentRaceId;
                pendingRaceChangeAt = Date.now();
                return;
            }
            if (Date.now() - pendingRaceChangeAt < 600) return;
            resetForRaceChange_(currentRaceId);
            return;
        }
        pendingRaceChangeId = "";
        pendingRaceChangeAt = 0;
    }

    function disconnectJoinRaceObserver_() {
        clearTimeout(joinRaceClearTimer);
        joinRaceClearTimer = 0;
        if (!joinRaceObserver) return;
        joinRaceObserver.disconnect();
        joinRaceObserver = null;
    }

    function installJoinRaceObserver_() {
        if (
            joinRaceObserver ||
            typeof MutationObserver === "undefined" ||
            isReplayPage_() ||
            !clearOnRaceChange ||
            !analysis ||
            !priorRaceFinishedForClear_() ||
            bigRaceObservationShouldPause_()
        ) return;
        const root = document.body || document.documentElement;
        if (!root) return;
        joinRaceObserver = new MutationObserver(() => {
            if (!clearOnRaceChange || !analysis || !priorRaceFinishedForClear_() || bigRaceObservationShouldPause_()) {
                disconnectJoinRaceObserver_();
                return;
            }
            clearTimeout(joinRaceClearTimer);
            joinRaceClearTimer = setTimeout(() => {
                if (clearOnRaceChange && analysis && priorRaceFinishedForClear_() && !bigRaceObservationShouldPause_() && hasJoinRacingEventAction_()) {
                    resetForRaceChange_("");
                }
            }, 120);
        });
        joinRaceObserver.observe(root, { childList: true, subtree: true });
    }

    /* ============================
   * THEME APPLICATION
   * ============================ */
    function applyTheme_() {
        const win = document.getElementById("rtLapWin");
        const btn = document.getElementById("rtLapBtn");
        const recordsPopup = document.getElementById("rtRecordsPopup");
        const settingsModal = document.getElementById("mpgSettingsModal");
        const garageModal = document.getElementById("mpgGarageModal");
        const driverHover = document.getElementById("mpgDriverHoverCard");
        const tutorial = document.getElementById("mpgTutorial");
        const targets = [win, btn, recordsPopup, settingsModal, garageModal, driverHover, tutorial].filter(Boolean);
        if (!targets.length) return;
        for (const el of targets) {
            el.dataset.theme = theme;
            for (const t of THEMES) {
                el.classList.remove(`mpg-theme-${t.key}`, `mpg-theme-${t.key}`);
            }
            el.classList.add(`mpg-theme-${theme}`, `mpg-theme-${theme}`);
        }
        if (tutorial && win) {
            const computed = getComputedStyle(win);
            [
                "--bg", "--panel", "--border", "--text", "--muted", "--header", "--hover", "--pill", "--pillHover",
                "--tableBg", "--thBg", "--gapNeg", "--gapPos", "--gapZero", "--accent", "--green", "--red"
            ].forEach(name => tutorial.style.setProperty(name, computed.getPropertyValue(name)));
        }

        const label = document.getElementById("rtThemeLabel");
        if (label) {
            const t = THEMES.find(x => x.key === theme);
            label.textContent = t ? t.name : "Theme";
        }
        if (win) updateHeaderCompact_(win);
    }

    /* ============================
   * UI STYLES
   * ============================ */
    GM_addStyle(`
/* ============================
 * UI STYLES (Pit Guru)
 * ============================ */

#rtLapWin, #rtLapBtn, #rtRecordsPopup, #mpgSettingsModal, #mpgGarageModal, #mpgDriverHoverCard, #mpgTutorial{
  /* defaults (dark) */
  --bg:#161616;
  --panel:#121212;
  --border:#333;
  --text:#ffffff;
  --muted:#bbbbbb;
  --header:#1a1a1a;
  --hover:rgba(255,255,255,.04);
  --pill:#1c1c1c;
  --pillHover:#232323;
  --tableBg:#0f0f0f;
  --thBg:#1a1a1a;

  --scrollTrack:#1c1c1c;
  --scrollThumb:#9a9a9a;
  --scrollThumbBorder:#2b2b2b;

  --carIconBg: rgba(255,255,255,.08);

  /* semantic */
  --time: var(--text);
  --gapNeg: #00FF00;
  --gapPos: #FFC83D;
  --gapZero: var(--muted);
  --accent: var(--gapPos);
  --green: var(--gapNeg);
  --red: #ff6b6b;

  --bestRowBg: rgba(180, 120, 255, 0.22);
  --bestRowBorder: rgba(180, 120, 255, 0.55);
  --bestText: #f2e9ff;
}

/* ========== Base icon styles ========== */
img.carIcon{
  width:38px;
  height:19px;
  object-fit:contain;
  border-radius:8px;
  background: var(--carIconBg);
  border:1px solid rgba(255,255,255,.12);
  display:inline-block;
  vertical-align:middle;
}
#rtCarImg.carIcon{
  width:46px;
  height:23px;
  border-radius:10px;
  border:1px solid rgba(255,255,255,.14);
}

/* ========== Force all UI text to follow vars (prevents black leaks) ========== */
#rtLapWin, #rtLapBtn, #rtRecordsPopup, #mpgSettingsModal, #mpgGarageModal, #mpgDriverHoverCard, #mpgTutorial,
#rtHdr, #rtBody, #rtMeta,
#rtTrack, #rtCar, #rtDriver, #rtRaceTime{
  color: var(--text) !important;
}
.muted{ color: var(--muted) !important; }

/* Race ID link visibility */
#rtRaceId{ color: var(--gapPos) !important; text-decoration: underline; font-weight: 900; }
#rtRaceId:hover{ opacity:.9; }

/* ========== Floating Button ========== */
#rtLapBtn{
  position:fixed;right:16px;bottom:16px;z-index:2147483500;
  background:var(--panel);
  border:1px solid var(--border);
  color:var(--text);
  border-radius:14px;
  padding:10px 12px;
  font:12px system-ui;
  cursor:pointer;
  display:flex;
  gap:10px;
  align-items:center;
  box-shadow:0 12px 30px rgba(0,0,0,.35);
  user-select:none;
}
#rtLapBtn .recDot{width:10px;height:10px;border-radius:50%;background:#ff3b3b}
#rtLapBtn .recDot.off{background:#777}
#rtLapBtn .badge{
  padding:4px 8px;
  border-radius:999px;
  background:rgba(255,255,255,.10);
  border:1px solid rgba(0,0,0,.25);
  font-weight:700;
}

/* ========== Window ========== */
#rtLapWin{
  position:fixed;
  right:16px;
  bottom:16px;
  width:${WIN_DEFAULT_WIDTH}px;
  height:${WIN_DEFAULT_HEIGHT}px;
  min-width:${WIN_MIN_WIDTH}px;
  min-height:${WIN_MIN_HEIGHT}px;
  background:var(--bg);
  border:1px solid var(--border);
  border-radius:16px;
  box-shadow:0 18px 46px rgba(0,0,0,.45);
  display:none;
  z-index:2147483600;
  overflow:hidden;
  resize:none;
  max-width:calc(100vw - ${WIN_VIEWPORT_MARGIN * 2}px);
  max-height:calc(100vh - ${WIN_VIEWPORT_MARGIN * 2}px);
  box-sizing:border-box;
  contain:layout paint style;
}

#rtLapWin .mpgResizeGrip,
#rtRecordsPopup .mpgResizeGrip{
  position:absolute;
  right:0;
  bottom:0;
  width:22px;
  height:22px;
  z-index:8;
  cursor:nwse-resize;
  touch-action:none;
  user-select:none;
  opacity:.72;
  background:
    linear-gradient(135deg,transparent 0 48%,rgba(255,255,255,.24) 48% 54%,transparent 54% 66%,rgba(255,255,255,.34) 66% 72%,transparent 72%);
}
#rtLapWin.mpg-resizing,
#rtRecordsPopup.mpg-resizing{
  user-select:none;
}

#rtLapWin, #rtRecordsPopup, #mpgSettingsModal, #mpgGarageModal{
  scrollbar-color:var(--scrollThumb) var(--scrollTrack);
  scrollbar-width:thin;
}
#rtLapWin *::-webkit-scrollbar,
#rtRecordsPopup *::-webkit-scrollbar,
#mpgSettingsModal *::-webkit-scrollbar, #mpgGarageModal *::-webkit-scrollbar{
  width:12px;
  height:12px;
}
#rtLapWin *::-webkit-scrollbar-track,
#rtRecordsPopup *::-webkit-scrollbar-track,
#mpgSettingsModal *::-webkit-scrollbar-track, #mpgGarageModal *::-webkit-scrollbar-track{
  background:var(--scrollTrack);
  border-radius:10px;
}
#rtLapWin *::-webkit-scrollbar-thumb,
#rtRecordsPopup *::-webkit-scrollbar-thumb,
#mpgSettingsModal *::-webkit-scrollbar-thumb, #mpgGarageModal *::-webkit-scrollbar-thumb{
  background:var(--scrollThumb);
  border-radius:10px;
  border:3px solid var(--scrollThumbBorder);
}
#rtLapWin *::-webkit-scrollbar-corner,
#rtRecordsPopup *::-webkit-scrollbar-corner,
#mpgSettingsModal *::-webkit-scrollbar-corner, #mpgGarageModal *::-webkit-scrollbar-corner{
  background:var(--scrollTrack);
}

/* Cursor sanity */
#rtLapWin{ cursor:default; }
#rtLapWin button, #rtLapWin a, #rtLapWin input, #rtLapWin textarea, #rtLapWin select{ cursor:default; }

.totalCell{font-weight:800;opacity:.95}

/* Header / drag handle */
#rtHdr{
  height:52px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:0 12px;
  border-bottom:1px solid var(--border);
  cursor:move;
  user-select:none;
  background:var(--header);
  color:var(--text);
  position:relative;
  z-index:200;
  box-sizing:border-box;
  overflow:hidden;
}
#rtHdr .left{
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  gap:2px;
  flex:1 1 auto;
  min-width:115px;
  overflow:hidden;
}
#rtHdr .title{font-weight:900;letter-spacing:.2px}
#rtHdr .count{opacity:.9;font-weight:800}
#rtVer{
  max-width:100%;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
#rtHdr .right{
  display:flex;
  gap:8px;
  align-items:center;
  justify-content:flex-end;
  flex:0 1 auto;
  min-width:0;
  flex-wrap:nowrap;
  overflow:hidden;
}

/* Pills */
.pill{
  border:1px solid rgba(20,20,20,.55);
  background:var(--pill);
  border-radius:999px;
  padding:7px 10px;
  color:var(--text) !important;
  cursor:pointer;
  font-size:12px;
  display:flex;
  align-items:center;
  gap:8px;
  flex:0 0 auto;
  white-space:nowrap;
  box-sizing:border-box;
}
.pill:hover{background:var(--pillHover)}
.pill.on{box-shadow: inset 0 0 0 2px var(--gapPos);}
.pill:disabled{opacity:.46;cursor:not-allowed;filter:saturate(.35)}
#rtLocalPlayer.mpg-player-ready-highlight{
  border-color:#f2e605;
  outline:2px solid #f2e605;
  outline-offset:2px;
  box-shadow:0 0 0 1px rgba(242,230,5,.55),0 0 14px rgba(242,230,5,.72);
  animation:mpg-player-ready-pulse 1s ease-in-out infinite alternate;
}
@keyframes mpg-player-ready-pulse{
  from{box-shadow:0 0 0 1px rgba(242,230,5,.42),0 0 8px rgba(242,230,5,.38)}
  to{box-shadow:0 0 0 2px rgba(242,230,5,.72),0 0 18px rgba(242,230,5,.88)}
}
#rtHdr .right .pill[draggable="true"]{cursor:grab}
#rtHdr .right .pill.mpg-dragging{opacity:.45}
.mpg-intel-fetch{display:inline-flex;margin:auto;padding:4px 9px;font-size:11px;line-height:1.1}
.mpg-intel-fetch[disabled]{opacity:.55;pointer-events:none}

#rtLapWin.rtCompact #rtHdr .right{gap:6px}
#rtLapWin.rtCompact .pill{
  width:36px;
  min-width:36px;
  height:32px;
  justify-content:center;
  padding:7px 0;
  gap:0;
}
#rtLapWin.rtCompact .pill span:nth-child(2){display:none !important}
#rtLapWin.rtCompact #rtRecText{display:none !important}
#rtLapWin.rtCompact #rtThemeLabel{display:none !important}
#rtRecDotInline{width:10px;height:10px;border-radius:50%;background:#ff3b3b;display:inline-block}
#rtRecDotInline.off{background:#777}

.mpg-settings{
  border:1px solid rgba(0,0,0,.25);
  border-radius:12px;
  background:var(--panel);
  padding:10px;
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:10px;
  font:12px system-ui;
}
.mpg-settings label{display:flex;align-items:center;gap:8px;min-width:0}
.mpg-settings select,.mpg-settings input[type="text"],.mpg-settings input[type="password"],.mpg-settings input[type="number"]{
  background:var(--pill);
  color:var(--text);
  border:1px solid var(--border);
  border-radius:8px;
  padding:6px 8px;
  max-width:100%;
}
.mpg-setting-actions{grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.mpg-setting-actions .pill[disabled]{opacity:.55;pointer-events:none}
.mpg-settings .mpg-about{grid-column:1/-1;line-height:1.35;border-top:1px solid var(--border);padding-top:8px}
.mpg-settings-modal{
  position:fixed;
  inset:0;
  z-index:2147483640;
  display:none;
  align-items:center;
  justify-content:center;
  background:rgba(0,0,0,.55);
  padding:18px;
  box-sizing:border-box;
}
.mpg-settings-window{
  width:min(920px,calc(100vw - 36px));
  max-height:min(760px,calc(100vh - 36px));
  display:flex;
  flex-direction:column;
  min-height:0;
  border:1px solid var(--border);
  border-radius:12px;
  background:var(--bg);
  color:var(--text);
  box-shadow:0 22px 70px rgba(0,0,0,.5);
  overflow:hidden;
}
.mpg-settings-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:12px 14px;
  background:var(--header);
  border-bottom:1px solid var(--border);
}
.mpg-settings-title{font-weight:900;font-size:15px}
.mpg-settings-subtitle{font-size:12px;color:var(--muted);margin-top:2px}
.mpg-settings-close{width:34px;height:34px;border-radius:50%;justify-content:center;padding:0}
.mpg-settings-header-actions{display:flex;align-items:center;gap:8px}
.mpg-settings-body{overflow:auto;padding:12px}
.mpg-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.mpg-settings-section{
  border:1px solid var(--border);
  border-radius:10px;
  background:var(--panel);
  padding:11px;
  display:grid;
  gap:10px;
  align-content:start;
  min-width:0;
}
.mpg-settings-section.wide{grid-column:1/-1}
.mpg-section-head{border-bottom:1px solid var(--border);padding-bottom:8px;display:grid;gap:2px}
.mpg-section-head h3{margin:0;color:var(--text);font-size:13px;line-height:1.25}
.mpg-section-head p,.mpg-section-note{margin:0;color:var(--muted);font-size:12px;line-height:1.35}
.mpg-setting-row{display:grid;grid-template-columns:minmax(130px,180px) minmax(0,1fr);gap:10px;align-items:center}
.mpg-setting-row label,.mpg-setting-label{font-weight:800;color:var(--text)}
.mpg-setting-row select,.mpg-setting-row input[type="text"],.mpg-setting-row input[type="password"],.mpg-setting-row input[type="number"]{
  width:100%;
  min-width:0;
  background:var(--pill);
  color:var(--text);
  border:1px solid var(--border);
  border-radius:8px;
  padding:7px 9px;
  box-sizing:border-box;
}
.mpg-checkline{display:flex;align-items:center;gap:8px;color:var(--text);font-weight:700}
.mpg-api-key-control{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mpg-api-key-control input{flex:1 1 260px}
.mpg-key-details{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.mpg-key-status{display:inline-flex;align-items:center;gap:6px;font-weight:900}
.mpg-key-status.good{color:#53d68a}
.mpg-key-status.warn{color:var(--gapPos)}
.mpg-key-status.bad{color:#ff7777}
.mpg-status-mark{display:inline-grid;place-items:center;width:19px;height:19px;border-radius:50%;border:1px solid currentColor;font-size:11px;line-height:1}
.mpg-settings-modal .pill[disabled]{opacity:.55;pointer-events:none}
#mpgTutorial{
  position:fixed;
  inset:0;
  z-index:2147483646;
  display:none;
  pointer-events:none;
  color:var(--text);
  font:12px system-ui;
}
.mpg-tutorial-card{
  position:fixed;
  width:min(360px,calc(100vw - 24px));
  border:1px solid var(--gapPos);
  border-radius:10px;
  background:var(--panel);
  color:var(--text);
  padding:13px;
  box-shadow:0 18px 55px rgba(0,0,0,.62),0 0 0 1px rgba(255,255,255,.05);
  pointer-events:auto;
}
.mpg-tutorial-kicker{color:var(--gapPos);font-size:11px;font-weight:900;text-transform:uppercase}
.mpg-tutorial-title{margin-top:4px;font-size:16px;font-weight:950}
.mpg-tutorial-copy{margin-top:7px;color:var(--muted);font-size:12px;line-height:1.45}
.mpg-tutorial-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px}
.mpg-tutorial-nav{display:flex;align-items:center;gap:7px}
.mpg-tutorial-progress{color:var(--muted);font-size:11px;font-weight:800}
.mpg-tutorial-target{outline:3px solid var(--gapPos) !important;outline-offset:3px;box-shadow:0 0 20px color-mix(in srgb,var(--gapPos) 55%,transparent) !important}
.mpg-garage-modal{
  position:fixed;
  inset:0;
  z-index:2147483641;
  display:none;
  align-items:center;
  justify-content:center;
  background:rgba(0,0,0,.55);
  padding:18px;
  box-sizing:border-box;
}
.mpg-garage-window{
  width:min(1040px,calc(100vw - 36px));
  height:min(820px,calc(100vh - 36px));
  max-height:min(820px,calc(100vh - 36px));
  display:flex;
  flex-direction:column;
  min-height:0;
  border:1px solid var(--border);
  border-radius:12px;
  background:var(--bg);
  color:var(--text);
  box-shadow:0 22px 70px rgba(0,0,0,.5);
  overflow:hidden;
}
.mpg-garage-window.compare{width:min(1460px,calc(100vw - 36px))}
.mpg-garage-body{overflow:hidden;padding:12px;display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px;min-height:0;flex:1 1 auto}
.mpg-garage-toolbar{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.mpg-garage-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.mpg-garage-grid{display:grid;grid-template-columns:minmax(300px,425px) minmax(0,1fr);grid-template-rows:minmax(0,1fr);gap:12px;min-height:0;height:100%}
.mpg-garage-body.compare .mpg-garage-grid{grid-template-columns:minmax(280px,360px) minmax(720px,1fr)}
.mpg-garage-list,.mpg-garage-detail,.mpg-garage-history{
  border:1px solid var(--border);
  border-radius:10px;
  background:var(--panel);
  min-width:0;
  min-height:0;
  overflow:hidden;
  display:flex;
  flex-direction:column;
}
.mpg-garage-list-head,.mpg-garage-panel-head{
  padding:10px 12px;
  border-bottom:1px solid var(--border);
  background:var(--thBg);
  display:flex;
  justify-content:space-between;
  gap:8px;
  align-items:center;
  font-weight:900;
}
.mpg-garage-cars{max-height:none;overflow:auto;position:relative;background:var(--tableBg);color:var(--text);flex:1 1 auto;min-height:0}
.mpg-garage-table{
  width:max-content;
  min-width:100%;
  border-collapse:separate;
  border-spacing:0;
  position:relative;
  isolation:isolate;
  color:var(--text) !important;
  font:12px system-ui;
}
.mpg-garage-table th,.mpg-garage-table td{
  position:relative;
  z-index:0;
  padding:7px 8px;
  border-bottom:1px solid rgba(255,255,255,.08);
  background:var(--tableBg);
  color:var(--text) !important;
  white-space:nowrap;
  text-align:center;
}
.mpg-garage-table th{
  position:sticky;
  top:0;
  z-index:2;
  background:var(--thBg);
  font-weight:900;
  cursor:pointer;
  user-select:none;
}
.mpg-garage-table th:first-child,.mpg-garage-table td:first-child{
  position:sticky;
  left:0;
  min-width:168px;
  max-width:210px;
  text-align:left;
  overflow:hidden;
  background-clip:padding-box;
  transform:translateZ(0);
  box-shadow:1px 0 0 var(--border);
}
.mpg-garage-table th:first-child{z-index:40;background:var(--thBg)}
.mpg-garage-table td:first-child{z-index:30;background:var(--tableBg) !important}
.mpg-garage-table th:nth-child(2),.mpg-garage-table td:nth-child(2){padding-left:18px}
.mpg-garage-table tr:hover td{background:var(--hover)}
.mpg-garage-table tr:hover td:first-child{background:color-mix(in srgb,var(--tableBg) 88%,var(--gapPos) 12%) !important}
.mpg-garage-table tr.active td{background:var(--bestRowBg)}
.mpg-garage-table tr.active td:first-child{background:color-mix(in srgb,var(--tableBg) 82%,var(--gapPos) 18%) !important}
.mpg-garage-table tr.active td:first-child{box-shadow:inset 3px 0 0 var(--gapPos),1px 0 0 var(--border)}
.mpg-garage-table .mpg-sort-active{color:var(--gapPos) !important}
.mpg-garage-sort-indicator{display:inline-block;min-width:10px;margin-left:4px;color:var(--gapPos);font-weight:950}
.mpg-garage-car-cell{display:grid;grid-template-columns:48px minmax(0,1fr);gap:7px;align-items:center;min-width:0;overflow:hidden}
.mpg-garage-car-cell img{width:44px;height:26px;object-fit:contain;justify-self:center}
.mpg-garage-car-name{display:block;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mpg-garage-car-sub{display:block;font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mpg-garage-class{display:inline-grid;place-items:center;min-width:24px;height:24px;border-radius:50%;border:1px solid var(--gapPos);color:var(--gapPos);font-weight:900}
.mpg-garage-selected{display:grid;grid-template-columns:180px minmax(0,1fr);gap:14px;padding:12px}
.mpg-garage-detail-scroll{overflow:auto;min-height:0;flex:1 1 auto}
.mpg-garage-hero{display:grid;gap:10px;align-content:start;text-align:center}
.mpg-garage-hero img{width:160px;height:90px;object-fit:contain;margin:auto;filter:drop-shadow(0 10px 18px rgba(0,0,0,.35))}
.mpg-garage-title{font-size:18px;font-weight:950;line-height:1.15}
.mpg-garage-meta{font-size:12px;color:var(--muted);line-height:1.35}
.mpg-garage-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:8px}
.mpg-garage-kpi{border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--tableBg);text-align:center;min-width:0}
.mpg-garage-kpi span{display:block;color:var(--muted);font-size:11px}
.mpg-garage-kpi b{display:block;margin-top:3px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mpg-garage-bars{display:grid;gap:8px;margin-top:10px}
.mpg-garage-bar{display:grid;grid-template-columns:92px minmax(0,1fr) 44px;gap:8px;align-items:center}
.mpg-garage-bar span{font-size:12px;font-weight:800}
.mpg-garage-track{position:relative;height:14px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden;border:1px solid var(--border);box-shadow:inset 0 1px 4px rgba(0,0,0,.45)}
.mpg-garage-fill{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,var(--gapPos),var(--gapNeg)) !important;box-shadow:0 0 10px color-mix(in srgb,var(--gapNeg) 55%,transparent)}
.mpg-garage-bar b{text-align:right;font-size:12px}
.mpg-garage-compare{display:grid;gap:12px;padding:12px;min-width:720px}
.mpg-garage-compare-head{display:grid;grid-template-columns:minmax(0,1fr) 110px minmax(0,1fr);gap:10px;align-items:center}
.mpg-garage-compare-car{display:grid;gap:10px;align-items:center;min-width:0}
.mpg-garage-compare-car.a{grid-template-columns:minmax(0,1fr) 92px;text-align:right}
.mpg-garage-compare-car.b{grid-template-columns:92px minmax(0,1fr);text-align:left}
.mpg-garage-compare-car img{width:88px;height:52px;object-fit:contain;filter:drop-shadow(0 7px 11px rgba(0,0,0,.32))}
.mpg-garage-compare-car.a img{order:2}
.mpg-garage-compare-car select{width:100%;min-width:0}
.mpg-garage-compare-vs{display:grid;justify-items:center;gap:6px;text-align:center;color:var(--gapPos);font-weight:950;font-size:15px}
.mpg-garage-compare-stats,.mpg-garage-compare-facts{display:grid;gap:4px}
.mpg-garage-compare-stat{display:grid;grid-template-columns:minmax(80px,1fr) 38px 150px 38px minmax(80px,1fr);gap:7px;align-items:center;min-height:25px}
.mpg-garage-compare-track{height:14px;background:rgba(255,255,255,.09);border:1px solid var(--border);overflow:hidden}
.mpg-garage-compare-track.left{display:flex;justify-content:flex-end}
.mpg-garage-compare-fill{display:block;height:100%;background:var(--compare-color,var(--gapPos))}
.mpg-garage-compare-stat.topSpeed{--compare-color:#279be8}
.mpg-garage-compare-stat.acceleration{--compare-color:#55ba63}
.mpg-garage-compare-stat.braking{--compare-color:#ef4d59}
.mpg-garage-compare-stat.handling{--compare-color:#a33eb9}
.mpg-garage-compare-stat.dirt{--compare-color:#936b58}
.mpg-garage-compare-stat.tarmac{--compare-color:#12a79e}
.mpg-garage-compare-stat.safety{--compare-color:#f1bd22}
.mpg-garage-compare-stat-label{text-align:center;font-size:11px;font-weight:900;color:var(--text)}
.mpg-garage-compare-delta{display:block;color:var(--muted);font-weight:800;white-space:nowrap}
.mpg-garage-compare-delta.a{color:#69b9ff}.mpg-garage-compare-delta.b{color:var(--gapPos)}
.mpg-garage-compare-value{font-size:12px;font-weight:900}
.mpg-garage-compare-value.a{text-align:right}.mpg-garage-compare-value.b{text-align:left}
.mpg-garage-compare-fact{display:grid;grid-template-columns:minmax(0,1fr) 160px minmax(0,1fr);gap:8px;align-items:center;min-height:27px;border-top:1px solid rgba(255,255,255,.06)}
.mpg-garage-compare-fact:first-child{border-top:0}
.mpg-garage-compare-fact-value{font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mpg-garage-compare-fact-value.left{text-align:right}.mpg-garage-compare-fact-value.right{text-align:left}
.mpg-garage-compare-close{justify-self:center}
.mpg-garage-history{margin:12px;display:block}
.mpg-garage-history table{width:100%;border-collapse:separate;border-spacing:0;color:var(--text) !important;background:var(--tableBg)}
.mpg-garage-history th,.mpg-garage-history td{padding:7px 8px;text-align:center;border-bottom:1px solid rgba(255,255,255,.08);color:var(--text) !important;background:var(--tableBg)}
.mpg-garage-history th{background:var(--thBg);font-weight:900;color:var(--text) !important}
.mpg-garage-stat-deltas{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}
.mpg-garage-delta{display:inline-flex;align-items:center;border:1px solid var(--border);border-radius:999px;padding:2px 6px;font-size:11px;font-weight:900}
.mpg-garage-delta.pos{color:var(--gapNeg)}
.mpg-garage-delta.neg{color:var(--red)}
.mpg-garage-log-toggle{justify-self:start;margin-top:10px}
.mpg-garage-history th[data-sortable='1']{cursor:pointer;user-select:none}
.mpg-garage-history th.sort-asc::after{content:" ▲";color:var(--gapPos);font-weight:900}
.mpg-garage-history th.sort-desc::after{content:" ▼";color:var(--gapPos);font-weight:900}
.mpg-garage-empty{padding:16px;color:var(--muted);text-align:center}
.mpg-modebar{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(96px,1fr));
  gap:6px;
  width:100%;
}
.mpg-modebar .pill{
  min-height:34px;
  justify-content:center;
  border-radius:8px;
  padding:7px 8px;
  font-weight:800;
  font-size:12px;
  text-align:center;
  background:color-mix(in srgb,var(--pill) 86%,transparent);
  border-color:var(--border);
  overflow:hidden;
  text-overflow:ellipsis;
}
.mpg-modebar .pill.on{
  color:var(--gapPos) !important;
  background:rgba(255,200,61,.10);
  border-color:var(--gapPos);
  box-shadow:inset 0 0 0 1px var(--gapPos);
}
.mpg-modebar .pill:hover{
  background:rgba(255,255,255,.08);
}
#rtLapWin.rtCompact .mpg-modebar .pill{
  width:auto;
  min-width:0;
  height:auto;
  padding:7px 8px;
  gap:6px;
}
#rtLapWin.rtCompact .mpg-modebar{grid-template-columns:repeat(auto-fit,minmax(42px,1fr))}
#rtLapWin.rtCompact .mpg-modebar .mpg-mode-label{display:none}
.mpg-status{font:12px system-ui;font-weight:800}
.mpg-analysis{min-width:100%;box-sizing:border-box;color:var(--text) !important}
.mpg-analysis table{
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  color:var(--text) !important;
  font:12px system-ui;
}
.mpg-analysis th,.mpg-analysis td{
  padding:9px 10px;
  border-bottom:1px solid rgba(0,0,0,.25);
  text-align:center;
  white-space:nowrap;
  vertical-align:middle;
  color:var(--text) !important;
}
.mpg-analysis th{
  background:var(--thBg);
  color:var(--text) !important;
  position:sticky;
  top:0;
  z-index:4;
  font-weight:900;
  cursor:pointer;
  user-select:none;
}
.mpg-analysis th.sort-asc::after{content:" ▲";color:var(--accent);font-weight:900}
.mpg-analysis th.sort-desc::after{content:" ▼";color:var(--accent);font-weight:900}
.mpg-analysis tbody td:not(.gap-neg):not(.gap-pos):not(.gap-zero):not(.mpg-purple):not(.mpg-pace-fl):not(.mpg-pace-pb):not(.mpg-pace-slow):not(.mpg-current-live):not(.mpg-current-over):not(.mpg-current-slow){
  color:var(--text) !important;
}
.mpg-analysis tr:hover td{background:var(--hover)}
.mpg-analysis tr[data-focus-driver-id],.mpg-analysis tr[data-focus-driver-name]{cursor:pointer}
.mpg-analysis tr[data-focus-driver-id]:hover td,.mpg-analysis tr[data-focus-driver-name]:hover td{box-shadow:inset 0 0 0 1px rgba(217,239,82,.18)}
.mpg-analysis .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:var(--text) !important}
.mpg-table-block{margin:8px 0 12px;min-width:0}
.mpg-table-label{font-weight:900;color:var(--text);font-size:13px;margin:8px 10px 6px;display:flex;align-items:center;gap:6px}
.mpg-table-label-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mpg-table-help{position:relative;margin-left:auto;flex:0 0 auto;width:22px;height:22px;padding:0;border:1px solid var(--border);border-radius:50%;background:var(--pill);color:var(--accent);font:900 12px/20px system-ui;text-align:center;cursor:help}
.mpg-table-help:hover,.mpg-table-help:focus-visible{background:var(--pillHover);outline:1px solid var(--accent);outline-offset:1px}
.mpg-table-help:hover::after,.mpg-table-help:focus-visible::after{content:attr(data-help);position:absolute;right:0;top:calc(100% + 7px);z-index:20;width:min(340px,calc(100vw - 48px));padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);box-shadow:0 10px 28px rgba(0,0,0,.5);font:12px/1.35 system-ui;font-weight:500;text-align:left;white-space:normal}
.mpg-table-scroll{overflow:auto;border:1px solid var(--border);border-radius:10px;background:rgba(0,0,0,.12)}
.mpg-table-block.mpg-table-compact{width:max-content;max-width:100%}
.mpg-table-compact .mpg-table-scroll{width:max-content;max-width:100%}
.mpg-table-compact table{width:auto;min-width:0}
.mpg-table-has-summary .mpg-table-scroll{border-radius:10px 10px 0 0}
.mpg-table-summary{padding:8px 10px;border:1px solid var(--border);border-top:0;border-radius:0 0 10px 10px;background:var(--panel);color:var(--text);font-size:12px;font-weight:800}
.mpg-focus-note{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--border);border-radius:10px;background:var(--panel);padding:8px 10px;color:var(--text)}
.mpg-focus-note .pill.mini{min-height:24px;padding:3px 8px;font-size:11px;white-space:nowrap}
.mpg-timecell{padding-left:5px !important;padding-right:5px !important}
.mpg-car-combo{display:grid;grid-template-columns:56px minmax(70px,1fr);align-items:center;gap:2px;min-width:130px}
.mpg-car-combo .mpg-car-img{display:grid;place-items:center;min-width:54px}
.mpg-car-combo .carIcon{margin:0;height:24px;max-width:52px}
.mpg-car-combo .mpg-car-name{text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mpg-driver-rs{display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap}
.mpg-pos-icon{font-size:16px;line-height:1}
.mpg-purple,.mpg-analysis td.mpg-purple,.mpg-analysis .mono.mpg-purple{color:#d049b3 !important;font-weight:900;text-shadow:0 0 8px rgba(208,73,179,.35)}
.mpg-pace-fl,.mpg-analysis .mpg-pace-fl,.mpg-analysis .mono.mpg-pace-fl{color:#d049b3 !important;font-weight:900;text-shadow:0 0 8px rgba(208,73,179,.35)}
.mpg-pace-pb,.mpg-analysis .mpg-pace-pb,.mpg-analysis .mono.mpg-pace-pb{color:#e6fe62 !important;font-weight:900}
.mpg-pace-slow,.mpg-analysis .mpg-pace-slow,.mpg-analysis .mono.mpg-pace-slow{color:var(--time) !important;font-weight:900}
.mpg-current-live,.mpg-analysis .mpg-current-live,.mpg-analysis .mono.mpg-current-live{color:var(--time) !important;font-weight:900}
.mpg-current-over,.mpg-analysis .mpg-current-over,.mpg-analysis .mono.mpg-current-over{color:#f2e605 !important;font-weight:900}
.mpg-current-slow,.mpg-analysis .mpg-current-slow,.mpg-analysis .mono.mpg-current-slow{color:#ff5a5f !important;font-weight:900}
.mpg-race-stage{display:grid;gap:8px;margin:8px 0 10px}
.mpg-stage-status{font-weight:900;color:var(--text);padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:var(--panel)}
.mpg-stage-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mpg-stage-grid.single{grid-template-columns:1fr}
.mpg-stage-box{border:1px solid var(--border);border-radius:10px;background:var(--panel);min-width:0;padding:8px 10px}
.mpg-stage-title{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:900;margin-bottom:4px}
.mpg-stage-text{font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mpg-separator{height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.75;margin:8px 0 10px}
.mpg-driver-cell{display:inline-flex;align-items:center;justify-content:center;gap:4px;font-weight:900;color:var(--text);border-radius:999px;padding:2px 8px;cursor:help}
.mpg-driver-cell:hover{background:rgba(255,255,255,.08)}
.mpg-user-driver{color:var(--gapPos);box-shadow:inset 0 0 0 1px var(--gapPos);background:rgba(255,200,61,.10)}
.mpg-mode-glyph{font-size:14px;line-height:1}
.mpg-mode-label{overflow:hidden;text-overflow:ellipsis}
.mpg-card{padding:10px}
.mpg-empty-title{font-weight:900;font-size:15px;padding:2px 10px}
.mpg-note{font-size:12px;line-height:1.35;margin:8px 10px;color:var(--muted)}
.mpg-selected-row td{background:rgba(255,200,61,.08)}
.mpg-badge{display:inline-flex;align-items:center;border:1px solid var(--border);border-radius:999px;padding:2px 8px;background:var(--pill);font-weight:800}
.mpg-gyro{display:grid;grid-template-columns:240px minmax(0,1fr);gap:12px;padding:12px}
.mpg-gyro-pad{width:220px;height:220px;border-radius:50%;border:1px solid var(--border);position:relative;background:radial-gradient(circle,rgba(255,255,255,.08),rgba(255,255,255,.02));overflow:hidden}
.mpg-gyro-pad:before,.mpg-gyro-pad:after{content:"";position:absolute;background:rgba(255,255,255,.18)}
.mpg-gyro-pad:before{left:50%;top:8px;bottom:8px;width:1px}
.mpg-gyro-pad:after{top:50%;left:8px;right:8px;height:1px}
.mpg-gyro-ring{position:absolute;left:50%;top:50%;border:1px solid rgba(255,255,255,.16);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}
.mpg-gyro-ring.r05{width:56px;height:56px}.mpg-gyro-ring.r10{width:112px;height:112px}.mpg-gyro-ring.r15{width:168px;height:168px}
.mpg-gyro-ring-label{position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--muted);background:rgba(0,0,0,.18);padding:1px 3px;border-radius:999px}
.mpg-gyro-label{position:absolute;left:0;right:0;top:10px;text-align:center;font-size:11px;font-weight:900;color:var(--text);letter-spacing:.2px}
.mpg-gyro-axis-label{position:absolute;font-size:10px;color:var(--muted);font-weight:800;pointer-events:none}
.mpg-gyro-axis-label.left{left:9px;top:50%;transform:translateY(-50%)}.mpg-gyro-axis-label.right{right:9px;top:50%;transform:translateY(-50%)}.mpg-gyro-axis-label.top{top:29px;left:50%;transform:translateX(-50%)}.mpg-gyro-axis-label.bottom{bottom:9px;left:50%;transform:translateX(-50%)}
.mpg-gyro-trace{position:absolute;width:8px;height:8px;border-radius:50%;transform:translate(-50%,-50%);opacity:.35;filter:blur(.1px)}
.mpg-gyro-dot{position:absolute;width:16px;height:16px;border-radius:50%;background:var(--gyroColor,var(--gapPos));box-shadow:0 0 18px var(--gyroColor,var(--gapPos));transform:translate(-50%,-50%);z-index:3}
.mpg-gyro-dynamic{display:contents}
.mpg-gyro-panel{min-width:0}
.mpg-gyro-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px;font-weight:900;color:var(--text)}
.mpg-gyro-title-tools{display:flex;align-items:center;gap:6px}
.mpg-gyro-readout{display:grid;grid-template-columns:repeat(2,minmax(110px,1fr));gap:8px;margin:8px 0}
.mpg-gyro-readout div{border:1px solid var(--border);border-radius:8px;background:var(--pill);padding:8px 10px;color:var(--text)}
.mpg-gyro-readout span{display:block;font-size:11px;color:var(--muted);margin-bottom:2px}
.mpg-gyro-drivers{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;margin-top:8px}
.mpg-gyro-driver{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0;min-height:42px;padding:7px 9px;border:1px solid var(--border);border-radius:8px;background:var(--pill);color:var(--text);text-align:left;cursor:pointer}
.mpg-gyro-driver:hover{background:var(--pillHover)}
.mpg-gyro-driver.active{border-color:var(--gapPos);box-shadow:inset 0 0 0 1px var(--gapPos)}
.mpg-gyro-name{width:100%;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mpg-gyro-meta{width:100%;font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mpg-footer{font:11px system-ui;margin-top:-3px}
.mpg-fuel-panel{margin:8px 12px 12px;border:1px solid var(--border);border-radius:10px;background:var(--panel);padding:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.mpg-fuel-stat{background:var(--pill);border:1px solid var(--border);border-radius:8px;padding:8px 10px;text-align:center}
.mpg-fuel-stat span{display:block;color:var(--muted);font-size:11px}.mpg-fuel-stat b{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
.mpg-commentary{margin-top:6px;border:1px solid var(--border);background:var(--panel);border-radius:10px;padding:8px 10px;color:var(--text);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mpgCommentaryTicker{display:none !important}
#mpgDriverHoverCard{position:fixed;display:none;z-index:2147483646;width:320px;max-width:calc(100vw - 24px);border:1px solid var(--border);border-radius:12px;background:var(--bg);color:var(--text);box-shadow:0 18px 44px rgba(0,0,0,.55);padding:10px;pointer-events:none;font:12px system-ui}
#mpgDriverHoverCard .mpg-driver-card-head{display:grid;grid-template-columns:58px minmax(0,1fr);gap:10px;align-items:center;margin-bottom:8px}
#mpgDriverHoverCard img{width:58px;height:58px;border-radius:10px;object-fit:cover;border:1px solid var(--border);background:var(--pill)}
#mpgDriverHoverCard h3{margin:0;font-size:14px;line-height:1.2;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#mpgDriverHoverCard .mpg-card-id{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:var(--muted);font-size:11px}
#mpgDriverHoverCard .mpg-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
#mpgDriverHoverCard .mpg-card-stat{border:1px solid var(--border);border-radius:8px;background:var(--pill);padding:7px 8px;text-align:center}
#mpgDriverHoverCard .mpg-card-stat span{display:block;color:var(--muted);font-size:10px}
#mpgDriverHoverCard .mpg-card-stat b{display:block;margin-top:2px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
@media (max-width:650px){
  .mpg-settings{grid-template-columns:1fr}
  .mpg-settings-grid{grid-template-columns:1fr}
  .mpg-setting-row{grid-template-columns:1fr}
  .mpg-garage-grid{grid-template-columns:1fr}
  .mpg-garage-selected{grid-template-columns:1fr}
  .mpg-garage-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .mpg-garage-compare{min-width:680px}
  .mpg-gyro{grid-template-columns:1fr}
}

/* Body layout */
#rtBody{
  position:relative;
  z-index:1;
  padding:12px 12px 22px 12px;
  height:calc(100% - 52px);
  display:flex;
  flex-direction:column;
  gap:10px;
  box-sizing:border-box;
}

/* Meta */
#rtMeta{
  color:var(--muted) !important;
  font:12px system-ui;
  overflow:auto;
}
#rtMetaTable{
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  table-layout:fixed;
  overflow:hidden;
  border:1px solid var(--border);
  border-radius:10px;
  background:var(--tableBg);
}
#rtMetaTable th,#rtMetaTable td{
  padding:7px 8px;
  text-align:center;
  border-right:1px solid var(--border);
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
#rtMetaTable th:last-child,#rtMetaTable td:last-child{border-right:0}
#rtMetaTable th{
  color:var(--text);
  background:var(--header);
  font-weight:900;
  font-size:11px;
}
#rtMetaTable td{
  color:var(--text);
  background:rgba(0,0,0,.08);
}
#rtMeta img{vertical-align:middle;}
#rtMeta .muted{line-height:1;}
#rtMeta .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
#rtMetaTable .rtMetaCar{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:0;max-width:100%}
#rtMetaTable .rtMetaCar .carName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#rtCarWrap{display:inline-flex;align-items:center;gap:8px;}
@media (max-width: 920px){
  #rtMetaTable .rtMetaCar .carName{display:none}
}

/* ========== Main laps table wrapper ========== */
#mpgAnalysisWrap{
  flex:1;
  overflow:auto;
  border:1px solid rgba(0,0,0,.25);
  border-radius:12px;
  background:var(--tableBg);
  padding-bottom:14px;
  box-sizing:border-box;
}

/* Scrollbar (main) */
#mpgAnalysisWrap::-webkit-scrollbar{ width:12px; height:12px; }
#mpgAnalysisWrap::-webkit-scrollbar-track{ background:var(--scrollTrack); border-radius:10px; }
#mpgAnalysisWrap::-webkit-scrollbar-thumb{
  background:var(--scrollThumb);
  border-radius:10px;
  border:3px solid var(--scrollThumbBorder);
}

/* Delta colors */
.gap-neg { color: var(--gapNeg) !important; font-weight: 900; }
.gap-pos { color: var(--gapPos) !important; font-weight: 900; }
.gap-zero{ color: var(--gapZero) !important; }

/* ========== RECORDS PANEL (bottom) ========== */
#rtRecords{
  margin-top:10px;
  color: var(--text);
  border:1px solid var(--border);
  border-radius:14px;
  background:var(--panel);
  overflow:hidden;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
}
#rtRecords .recordsBar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:10px 10px;
  background: var(--header);
  border-bottom:1px solid var(--border);
  font-size:12px;
}
#rtRecords .recordsLeft{
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
}
#rtRecords .select{
  background: var(--pill);
  color: var(--text);
  border:1px solid var(--border);
  border-radius:10px;
  padding:6px 10px;
  font-size:12px;
  outline:none;
}
.recScopeToggle{
  display:inline-flex;
  align-items:center;
  gap:6px;
  background:var(--pill);
  color:var(--text);
  border:1px solid var(--border);
  border-radius:10px;
  padding:6px 10px;
  font-size:12px;
  cursor:pointer;
  user-select:none;
}
.recScopeToggle input{accent-color:var(--accent);margin:0}
.recScopeToggle:has(input:checked){border-color:var(--accent);box-shadow:0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent)}

/* Scroll container: shows scrollbar only when needed (e.g., >3 rows) */
#rtRecScroll{
  max-height:168px;      /* header + ~3 rows */
  overflow-y:scroll;
  overflow-x:auto;
  scrollbar-gutter: stable;
}

/* Scrollbar (records) – same as main */
#rtRecScroll::-webkit-scrollbar{ width:12px; height:12px; }
#rtRecScroll::-webkit-scrollbar-track{ background:var(--scrollTrack); border-radius:10px; }
#rtRecScroll::-webkit-scrollbar-thumb{
  background:var(--scrollThumb);
  border-radius:10px;
  border:3px solid var(--scrollThumbBorder);
}

/* Records table */
#rtRecTable{
  width:100%;
  border-collapse:collapse;
  table-layout:fixed;
  font-size:12px;
}
#rtRecTable thead th{
  position:sticky;
  top:0;
  z-index:5;
  text-align:center;
  padding:9px 10px;
  background: var(--thBg);
  border-bottom:1px solid var(--border);
  color: var(--muted);
  font-weight:800;
}
#rtRecTable tbody td{
  padding:9px 10px;
  border-bottom:1px solid rgba(255,255,255,.06);
  vertical-align:middle;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  color: var(--text);
  text-align:center;
}
#rtRecTable tbody tr:hover{ background: var(--hover); }

/* Column widths (balanced + prevents blending/cutoff) */
#rtRecTable .colNum{ width:4%;  text-align:center; }
#rtRecTable .colImg{ width:9%;  text-align:center; }
#rtRecTable .colCar{ width:20%; }
#rtRecTable .colTime{ width:12%; }
#rtRecTable .colDriver{ width:13%; }
#rtRecTable .colSkill{ width:7%; text-align:center; }
#rtRecTable .colRace{ width:13%; text-align:center; }
.recRace{
  font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
  color: var(--muted);
}
.recRaceLink{
  color: var(--gapPos);
  text-decoration:none;
  font-weight:700;
}
.recRaceLink:hover{
  text-decoration:underline;
  opacity:.9;
}
#rtRecTable .colWhen{ width:16%; }
#rtRecTable .colAct{ width:7%;  text-align:center; }

/* Cells */
.recNum{ text-align:center; color:var(--muted); }
.recImg{ text-align:center; padding:6px 6px; }
.recImg .carIcon{
  width:34px !important;
  height:20px !important;
  border-radius:8px;
  display:block;
  margin:0 auto;
  object-fit:contain;
  background:rgba(255,255,255,0.06);
  border:1px solid rgba(255,255,255,0.10);
}
.recCar{ font-weight:700; min-width:0; }
.recCar span{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; }
.recWhen{ white-space:nowrap; color: var(--muted); font-size:12px; opacity:.9; }
.recAct{ text-align:center; }

/* Delete (records) */
.recDelBtn{
  border:1px solid var(--border);
  background: var(--pill);
  color: var(--text);
  border-radius:10px;
  padding:4px 8px;
  cursor:pointer;
}
.recDelBtn:hover{ background: var(--pillHover); }

/* Detached records window */
#rtRecordsPopup{
  position:fixed;
  right:28px;
  bottom:28px;
  width:760px;
  height:460px;
  min-width:550px;
  min-height:360px;
  max-width:calc(100vw - ${WIN_VIEWPORT_MARGIN * 2}px);
  max-height:calc(100vh - ${WIN_VIEWPORT_MARGIN * 2}px);
  z-index:2147483630;
  display:none;
  resize:none;
  overflow:hidden;
  color:var(--text);
  background:var(--bg);
  border:1px solid var(--border);
  border-radius:16px;
  box-shadow:0 18px 46px rgba(0,0,0,.45);
}
#rtRecordsPopup .recordsPopupHdr{
  min-height:44px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:8px 10px;
  background:var(--header);
  border-bottom:1px solid var(--border);
  box-sizing:border-box;
  cursor:move;
}
#rtRecordsPopup .recordsPopupTitle{font-weight:900}
#rtRecordsPopup .recordsPopupBody{height:calc(100% - 44px);display:flex;flex-direction:column;min-height:0}
#rtRecordsPopup .recordsWrap{display:flex;flex-direction:column;min-height:0;height:100%;border:0;border-radius:0;margin:0}
#rtRecordsPopup .recordsBar,#rtRecords .recordsBar{
  flex-shrink:0;
}
#rtRecordsPopup .recordsTable{flex:1;min-height:0;overflow-y:auto;overflow-x:auto;scrollbar-gutter:stable}
#rtRecordsPopup .recordsTable::-webkit-scrollbar{ width:12px; height:12px; }
#rtRecordsPopup .recordsTable::-webkit-scrollbar-track{ background:var(--scrollTrack); border-radius:10px; }
#rtRecordsPopup .recordsTable::-webkit-scrollbar-thumb{background:var(--scrollThumb);border-radius:10px;border:3px solid var(--scrollThumbBorder);}
#rtRecordsPopup .recordsBar,#rtRecordsPopup .recordsLeft{
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
}
#rtRecordsPopup .recordsBar{justify-content:space-between;padding:10px;background:var(--header);border-bottom:1px solid var(--border);font-size:12px}
#rtRecordsPopup .select{background:var(--pill);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:6px 10px;font-size:12px;outline:none}
#rtRecPopTable{
  width:100%;
  border-collapse:collapse;
  table-layout:fixed;
  font-size:12px;
}
#rtRecPopTable thead th{position:sticky;top:0;z-index:5;text-align:left;padding:9px 10px;background:var(--thBg);border-bottom:1px solid var(--border);color:var(--muted);font-weight:800}
#rtRecPopTable thead th{text-align:center}
#rtRecPopTable tbody td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:middle;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);text-align:center}
#rtRecPopTable tbody tr:hover{background:var(--hover)}
#rtRecPopTable .colNum{ width:4%; text-align:center; }
#rtRecPopTable .colImg{ width:9%; text-align:center; }
#rtRecPopTable .colCar{ width:20%; }
#rtRecPopTable .colTime{ width:12%; }
#rtRecPopTable .colDriver{ width:13%; }
#rtRecPopTable .colSkill{ width:7%; text-align:center; }
#rtRecPopTable .colRace{ width:13%; text-align:center; }
#rtRecPopTable .colWhen{ width:16%; }
#rtRecPopTable .colAct{ width:7%; text-align:center; }

/* ========== Toast ========== */
.rtToast{
  position:fixed;
  left:50%;
  bottom:18px;
  transform:translateX(-50%) translateY(10px);
  opacity:0;
  z-index:999999;
  background:rgba(0,0,0,.75);
  color:#fff;
  padding:10px 12px;
  border-radius:12px;
  border:1px solid rgba(255,255,255,.15);
  backdrop-filter:blur(6px);
  font-size:13px;
  max-width:min(720px,92vw);
  text-align:center;
  transition:opacity .22s ease,transform .22s ease;
}
.rtToast.show{opacity:1;transform:translateX(-50%) translateY(0);}

/* ============================
 * THEMES
 * ============================ */

/* Classic */
#rtLapWin[data-theme="classic"], #rtLapBtn[data-theme="classic"], #rtRecordsPopup[data-theme="classic"], #mpgSettingsModal[data-theme="classic"], #mpgGarageModal[data-theme="classic"], #mpgDriverHoverCard[data-theme="classic"], #rtRecTable[data-theme="classic"]{
  --bg:#2a2a2a; --panel:#2f2f2f; --border:#4a4a4a;
  --text:#f5f5f5; --muted:#d0d0d0; --header:#343434;
  --hover:rgba(255,255,255,.05); --pill:#3a3a3a; --pillHover:#444;
  --tableBg:#262626; --thBg:#313131; --scrollTrack:#2b2b2b; --scrollThumb:#bdbdbd;
  --scrollThumbBorder:#2b2b2b;
  --time:#ffffff;
  --gapNeg:#00FF00; --gapPos:#FFC83D; --gapZero:var(--muted);
  --bestRowBg: rgba(180, 120, 255, 0.22);
  --bestRowBorder: rgba(180, 120, 255, 0.55);
  --bestText:#f2e9ff;
}

/* Dark */
#rtLapWin[data-theme="dark"], #rtLapBtn[data-theme="dark"], #rtRecordsPopup[data-theme="dark"], #mpgSettingsModal[data-theme="dark"], #mpgGarageModal[data-theme="dark"], #mpgDriverHoverCard[data-theme="dark"], #rtRecTable[data-theme="dark"]{
  --bg:#141414; --panel:#101010; --border:#2f2f2f; --header:#171717;
  --tableBg:#0d0d0d; --thBg:#171717; --pill:#1a1a1a; --pillHover:#222;
  --scrollTrack:#141414; --scrollThumb:#8a8a8a; --scrollThumbBorder:#141414;
  --time:#ffffff;
  --gapNeg:#00FF00; --gapPos:#FFC83D; --gapZero:var(--muted);
  --bestRowBg: rgba(180, 120, 255, 0.22);
  --bestRowBorder: rgba(180, 120, 255, 0.55);
  --bestText:#f2e9ff;
}

/* Ice */
#rtLapWin[data-theme="ice"], #rtLapBtn[data-theme="ice"], #rtRecordsPopup[data-theme="ice"], #mpgSettingsModal[data-theme="ice"], #mpgGarageModal[data-theme="ice"], #mpgDriverHoverCard[data-theme="ice"], #rtRecTable[data-theme="ice"]{
  --bg:#e6eef7;
  --panel:#f1f6fb;
  --border:#b7c7d8;
  --header:#d9e6f3;
  --tableBg:#eef4fb;
  --thBg:#d9e6f3;
  --pill:#d4e2f1;
  --pillHover:#c7d9eb;
  --text:#1b1f24;
  --muted:#33414f;
  --hover:#e7f0fa;
  --scrollTrack:#d9e6f3;
  --scrollThumb:#8aa3bb;
  --scrollThumbBorder:#d9e6f3;
  --time:#0b0f14;
  --gapNeg:#00AA00; --gapPos:#b18630; --gapZero:var(--muted);
  --bestRowBg: rgba(180, 120, 255, 0.22);
  --bestRowBorder: rgba(180, 120, 255, 0.55);
  --bestText:#0b0f14;
}
#rtLapWin[data-theme="ice"] td:nth-child(4){
  -webkit-text-stroke: 0.15px rgba(0,0,0,0.60);
}

/* Neon */
#rtLapWin[data-theme="neon"], #rtLapBtn[data-theme="neon"], #rtRecordsPopup[data-theme="neon"], #mpgSettingsModal[data-theme="neon"], #mpgGarageModal[data-theme="neon"], #mpgDriverHoverCard[data-theme="neon"], #rtRecTable[data-theme="neon"]{
  --bg:#0b0c10; --panel:#11131a; --border:#2d2f3a; --header:#151824;
  --tableBg:#0b0c10; --thBg:#151824; --pill:#1c2030; --pillHover:#232944;
  --text:#eaf0ff; --hover:rgba(255,255,255,.06);
  --muted:#aab3d8;
  --scrollTrack:#11131a; --scrollThumb:#7f8cff; --scrollThumbBorder:#11131a;
  --time:#eaf0ff;
  --gapNeg:#00FF00; --gapPos:#FFC83D; --gapZero:var(--muted);
  --bestRowBg: rgba(180, 120, 255, 0.22);
  --bestRowBorder: rgba(180, 120, 255, 0.55);
  --bestText:#f2e9ff;
}

/* MoDuL Hub */
#rtLapWin[data-theme="modul_hub"], #rtLapBtn[data-theme="modul_hub"], #rtRecordsPopup[data-theme="modul_hub"], #mpgSettingsModal[data-theme="modul_hub"], #mpgGarageModal[data-theme="modul_hub"], #mpgDriverHoverCard[data-theme="modul_hub"], #rtRecTable[data-theme="modul_hub"]{
  --bg:#07120c; --panel:#0d1b12; --border:#254018; --header:#111f0f;
  --tableBg:#07100a; --thBg:#132313; --pill:#182817; --pillHover:#21361c;
  --text:#f4ffe9; --muted:#c6d7a2; --hover:rgba(213,255,90,.08);
  --scrollTrack:#0d1b12; --scrollThumb:#d5ff4f; --scrollThumbBorder:#0d1b12;
  --time:#f8ffe8;
  --gapNeg:#5cff75; --gapPos:#e9ff55; --gapZero:var(--muted);
  --bestRowBg: rgba(213, 255, 79, 0.15);
  --bestRowBorder: rgba(213, 255, 79, 0.65);
  --bestText:#f8ffe8;
}

/* Torn Blue */
#rtLapWin[data-theme="class_a"], #rtLapBtn[data-theme="class_a"], #rtRecordsPopup[data-theme="class_a"], #mpgSettingsModal[data-theme="class_a"], #mpgGarageModal[data-theme="class_a"], #mpgDriverHoverCard[data-theme="class_a"], #rtRecTable[data-theme="class_a"]{
  --bg:#0d1218; --panel:#121a24; --border:#203042; --header:#162030;
  --tableBg:#0b1016; --thBg:#162030; --pill:#17263a; --pillHover:#1d324c;
  --text:#eaf3ff; --muted:#b8cbe2; --hover:rgba(255,255,255,.06);
  --scrollTrack:#121a24; --scrollThumb:#3aa0ff; --scrollThumbBorder:#121a24;
  --time:#eaf3ff;
  --gapNeg:#00FF00; --gapPos:#FFC83D; --gapZero:var(--muted);
  --bestRowBg: rgba(58, 160, 255, 0.18);
  --bestRowBorder: rgba(58, 160, 255, 0.55);
  --bestText:#eaf3ff;
}

/* Torn Red */
#rtLapWin[data-theme="class_b"], #rtLapBtn[data-theme="class_b"], #rtRecordsPopup[data-theme="class_b"], #mpgSettingsModal[data-theme="class_b"], #mpgGarageModal[data-theme="class_b"], #mpgDriverHoverCard[data-theme="class_b"], #rtRecTable[data-theme="class_b"]{
  --bg:#150b0c; --panel:#1d1012; --border:#3a1a1e; --header:#241215;
  --tableBg:#12090a; --thBg:#241215; --pill:#2b1417; --pillHover:#35191d;
  --text:#fff0f1; --muted:#e4b9bd; --hover:rgba(255,255,255,.06);
  --scrollTrack:#1d1012; --scrollThumb:#ff4b57; --scrollThumbBorder:#1d1012;
  --time:#fff0f1;
  --gapNeg:#00FF00; --gapPos:#FFC83D; --gapZero:var(--muted);
  --bestRowBg: rgba(255, 75, 87, 0.16);
  --bestRowBorder: rgba(255, 75, 87, 0.55);
  --bestText:#fff0f1;
}

/* Torn Green */
#rtLapWin[data-theme="class_c"], #rtLapBtn[data-theme="class_c"], #rtRecordsPopup[data-theme="class_c"], #mpgSettingsModal[data-theme="class_c"], #mpgGarageModal[data-theme="class_c"], #mpgDriverHoverCard[data-theme="class_c"], #rtRecTable[data-theme="class_c"]{
  --bg:#0c120e; --panel:#101a14; --border:#203826; --header:#132018;
  --tableBg:#0a0f0c; --thBg:#132018; --pill:#163022; --pillHover:#1c3a29;
  --text:#effff5; --muted:#bfe2cc; --hover:rgba(255,255,255,.06);
  --scrollTrack:#101a14; --scrollThumb:#33ff7d; --scrollThumbBorder:#101a14;
  --time:#effff5;
  --gapNeg:#00FF00; --gapPos:#FFC83D; --gapZero:var(--muted);
  --bestRowBg: rgba(51, 255, 125, 0.14);
  --bestRowBorder: rgba(51, 255, 125, 0.55);
  --bestText:#effff5;
}

/* Torn Purple */
#rtLapWin[data-theme="class_d"], #rtLapBtn[data-theme="class_d"], #rtRecordsPopup[data-theme="class_d"], #mpgSettingsModal[data-theme="class_d"], #mpgGarageModal[data-theme="class_d"], #mpgDriverHoverCard[data-theme="class_d"], #rtRecTable[data-theme="class_d"]{
  --bg:#120b16; --panel:#181020; --border:#2f1f3b; --header:#1e1427;
  --tableBg:#0f0913; --thBg:#1e1427; --pill:#251730; --pillHover:#2d1d3a;
  --text:#f7efff; --muted:#d7c2ea; --hover:rgba(255,255,255,.06);
  --scrollTrack:#181020; --scrollThumb:#c056ff; --scrollThumbBorder:#181020;
  --time:#f7efff;
  --gapNeg:#00FF00; --gapPos:#FFC83D; --gapZero:var(--muted);
  --bestRowBg: rgba(192, 86, 255, 0.16);
  --bestRowBorder: rgba(192, 86, 255, 0.55);
  --bestText:#f7efff;
}

/* Torn Gold */
#rtLapWin[data-theme="class_e"], #rtLapBtn[data-theme="class_e"], #rtRecordsPopup[data-theme="class_e"], #mpgSettingsModal[data-theme="class_e"], #mpgGarageModal[data-theme="class_e"], #mpgDriverHoverCard[data-theme="class_e"], #rtRecTable[data-theme="class_e"]{
  --bg:#17110a; --panel:#23180b; --border:#5a3c12; --header:#2b1e0d;
  --tableBg:#130e08; --thBg:#261b10; --pill:#2d2013; --pillHover:#372818;
  --text:#fff6e6; --muted:#e8d2ac; --hover:rgba(255,255,255,.06);
  --scrollTrack:#1f160d; --scrollThumb:#FFD700; --scrollThumbBorder:#1f160d;
  --time:#fff6e6;
  --gapNeg:#00FF00; --gapPos:#ffd24a; --gapZero:var(--muted);
  --bestRowBg: rgba(255, 210, 74, 0.18);
  --bestRowBorder: rgba(255, 210, 74, 0.70);
  --bestText:#fff6e6;
}
`);


    /* ============================
   * EXPORTS
   * ============================ */
    function reportDateText_(value) {
        const raw = String(value || "").trim();
        if (!raw) return "—";
        if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
        const iso = toIsoFromAt_(raw) || raw;
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return raw;
        return `${d.getFullYear()}-${pad2_(d.getMonth() + 1)}-${pad2_(d.getDate())} ${pad2_(d.getHours())}:${pad2_(d.getMinutes())}:${pad2_(d.getSeconds())}`;
    }

    function reportEndTimeText_(startText) {
        const info = raceMeta?.replayInfo || {};
        if (info.time_ended) return reportDateText_(info.time_ended);
        const start = String(startText || "").trim();
        const maxFinal = maxAnalysisFinalTime_();
        if (!start || !Number.isFinite(maxFinal) || maxFinal <= 0) return "—";
        const d = new Date(start.replace(" ", "T"));
        if (Number.isNaN(d.getTime())) return "—";
        return reportDateText_(new Date(d.getTime() + maxFinal * 1000).toISOString());
    }

    function reportTableHtml_(headers, rows, opts = {}) {
        const empty = opts.empty || "No rows.";
        const cls = opts.className ? ` class="${escAttr_(opts.className)}"` : "";
        const head = headers.map(h => `<th scope="col" data-sortable="1">${esc_(h)}</th>`).join("");
        const body = rows.length
            ? rows.map(row => `<tr>${row.map(cell => {
                const obj = cell && typeof cell === "object" && !Array.isArray(cell) ? cell : { text: cell };
                const text = obj.text == null ? "" : String(obj.text);
                const html = obj.html != null ? String(obj.html) : esc_(text);
                const sort = obj.sort != null ? obj.sort : text;
                const c = obj.className ? ` class="${escAttr_(obj.className)}"` : "";
                return `<td${c} data-sort="${escAttr_(sort)}">${html}</td>`;
            }).join("")}</tr>`).join("")
            : `<tr><td colspan="${headers.length}" class="muted">${esc_(empty)}</td></tr>`;
        return `<div class="table-scroll"><table${cls}><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    function reportSectionHtml_(id, title, subtitle, content) {
        return `<section id="${escAttr_(id)}" class="report-section"><div class="section-head"><h2>${esc_(title)}</h2>${subtitle ? `<p>${esc_(subtitle)}</p>` : ""}</div>${content}</section>`;
    }

    function reportDriverCell_(d) {
        return { text: d?.name || "--", html: esc_(d?.name || "--") };
    }

    function reportTornImageUrl_(url) {
        const raw = String(url || "").trim();
        if (!raw) return "";
        if (/^(?:https?:|data:|blob:)/i.test(raw)) return raw;
        if (/^\/\//.test(raw)) return `https:${raw}`;
        if (/^www\.torn\.com\//i.test(raw)) return `https://${raw}`;
        if (/^torn\.com\//i.test(raw)) return `https://www.${raw}`;
        if (/^\//.test(raw)) return `https://www.torn.com${raw}`;
        return `https://www.torn.com/${raw.replace(/^\.?\//, "")}`;
    }

    function reportCarCell_(d, fallbackCar = "") {
        const car = toOgCarName_(d?.car || fallbackCar || "");
        const img = reportTornImageUrl_(d?.carImg || "");
        const html = `${img ? `<img class="carIcon" src="${escAttr_(img)}" alt="" loading="lazy" decoding="async"> ` : ""}${esc_(car || "--")}`;
        return { text: car || "--", html };
    }

    function reportThemeCssVars_(themeKey) {
        const map = {
            classic: "--bg:#2a2a2a;--panel:#2f2f2f;--panel2:#343434;--text:#f5f5f5;--muted:#d0d0d0;--line:#4a4a4a;--accent:#ffc83d;--green:#00ff00;--red:#ff6b6b;--blue:#74b7ff;--pill:#3a3a3a;",
            dark: "--bg:#141414;--panel:#101010;--panel2:#171717;--text:#f5f5f5;--muted:#d0d0d0;--line:#2f2f2f;--accent:#ffc83d;--green:#00ff00;--red:#ff6b6b;--blue:#74b7ff;--pill:#1a1a1a;",
            ice: "--bg:#e6eef7;--panel:#f1f6fb;--panel2:#d9e6f3;--text:#1b1f24;--muted:#33414f;--line:#b7c7d8;--accent:#b18630;--green:#00aa00;--red:#c84848;--blue:#1c68a6;--pill:#d4e2f1;",
            neon: "--bg:#0b0c10;--panel:#11131a;--panel2:#151824;--text:#eaf0ff;--muted:#aab3d8;--line:#2d2f3a;--accent:#ffc83d;--green:#00ff00;--red:#ff4b57;--blue:#7f8cff;--pill:#1c2030;",
            modul_hub: "--bg:#07120c;--panel:#0d1b12;--panel2:#111f0f;--text:#f4ffe9;--muted:#c6d7a2;--line:#254018;--accent:#e9ff55;--green:#5cff75;--red:#ff6b6b;--blue:#9be1ff;--pill:#182817;",
            class_a: "--bg:#0d1218;--panel:#121a24;--panel2:#162030;--text:#eaf3ff;--muted:#b8cbe2;--line:#203042;--accent:#ffc83d;--green:#00ff00;--red:#ff6b6b;--blue:#3aa0ff;--pill:#17263a;",
            class_b: "--bg:#150b0c;--panel:#1d1012;--panel2:#241215;--text:#fff0f1;--muted:#e4b9bd;--line:#3a1a1e;--accent:#ffc83d;--green:#00ff00;--red:#ff4b57;--blue:#ff9aa1;--pill:#2b1417;",
            class_c: "--bg:#0c120e;--panel:#101a14;--panel2:#132018;--text:#effff5;--muted:#bfe2cc;--line:#203826;--accent:#ffc83d;--green:#33ff7d;--red:#ff6b6b;--blue:#8bd6ff;--pill:#163022;",
            class_d: "--bg:#120b16;--panel:#181020;--panel2:#1e1427;--text:#f7efff;--muted:#d7c2ea;--line:#2f1f3b;--accent:#ffc83d;--green:#00ff00;--red:#ff6b6b;--blue:#c056ff;--pill:#251730;",
            class_e: "--bg:#17110a;--panel:#23180b;--panel2:#2b1e0d;--text:#fff6e6;--muted:#e8d2ac;--line:#5a3c12;--accent:#ffd24a;--green:#00ff00;--red:#ff6b6b;--blue:#ffd700;--pill:#2d2013;"
        };
        return map[themeKey] || map.classic;
    }

    function reportPieChartHtml_(title, entries) {
        const filtered = entries.filter(x => x && Number(x.value) > 0);
        const total = filtered.reduce((sum, x) => sum + Number(x.value || 0), 0);
        if (!total) return "";
        const colors = ["#ffc83d", "#58dc74", "#74b7ff", "#ff6b6b", "#c056ff", "#ff9f43", "#5eead4", "#f472b6"];
        let start = 0;
        const stops = filtered.map((x, i) => {
            const deg = Number(x.value) / total * 360;
            const out = `${colors[i % colors.length]} ${start.toFixed(2)}deg ${(start + deg).toFixed(2)}deg`;
            start += deg;
            return out;
        }).join(",");
        const legend = filtered.map((x, i) => `<div class="legend-row"><span style="background:${colors[i % colors.length]}"></span><b>${esc_(x.label)}</b><em>${esc_(String(x.value))}</em></div>`).join("");
        return `<div class="chart-card"><h3>${esc_(title)}</h3><div class="pie-wrap"><div class="pie" style="background:conic-gradient(${stops})"></div><div class="legend">${legend}</div></div></div>`;
    }

    function reportBarChartHtml_(title, rows, valueFormatter = v => String(v)) {
        const filtered = rows.filter(x => x && Number.isFinite(Number(x.value)) && Number(x.value) > 0).slice(0, 8);
        if (!filtered.length) return "";
        const max = Math.max(...filtered.map(x => Number(x.value)), 1);
        const body = filtered.map(x => {
            const width = clamp_(Number(x.value) / max * 100, 2, 100).toFixed(1);
            return `<div class="bar-row"><div class="bar-label">${esc_(x.label)}</div><div class="bar-track"><span style="width:${width}%"></span></div><div class="bar-value mono">${esc_(valueFormatter(Number(x.value), x))}</div></div>`;
        }).join("");
        return `<div class="chart-card wide"><h3>${esc_(title)}</h3>${body}</div>`;
    }

    function reportDriverChartKey_(d, index = 0) {
        return String(d?.driverId || d?.engineKey || normalizeDriverName_(d?.name) || `driver-${index}`);
    }

    function reportChartColor_(index) {
        const colors = ["#ffc83d", "#58dc74", "#74b7ff", "#ff6b6b", "#c056ff", "#ff9f43", "#5eead4", "#f472b6", "#a3e635", "#fb7185", "#38bdf8", "#e879f9"];
        return colors[Math.abs(index) % colors.length];
    }

    function reportJsonForScript_(data) {
        return JSON.stringify(data || {}).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }

    function reportPositionChartData_() {
        if (!analysis?.drivers?.length) return { duration: 0, maxPosition: 0, series: [] };
        const ordered = getLiveOrder_(Infinity, true).map(x => x.driver);
        const maxFinal = Math.max(0, maxAnalysisFinalTime_());
        const targetSamples = Math.round(clamp_(maxFinal / 2, 40, hugeFieldMode_() ? 120 : 220));
        const samples = Math.max(1, targetSamples);
        const step = maxFinal > 0 ? maxFinal / samples : 1;
        const series = ordered.map((d, i) => ({
            key: reportDriverChartKey_(d, i),
            name: d.name || `Driver ${i + 1}`,
            color: reportChartColor_(i),
            points: []
        }));
        const seriesByKey = new Map(series.map(x => [x.key, x]));
        for (let s = 0; s <= samples; s++) {
            const t = s === samples ? maxFinal + 0.001 : s * step;
            const order = getLiveOrder_(t, false);
            order.forEach((x, i) => {
                const key = reportDriverChartKey_(x.driver, i);
                const item = seriesByKey.get(key);
                if (item) item.points.push([Number(Math.min(t, maxFinal).toFixed(2)), i + 1]);
            });
        }
        return {
            duration: Number(maxFinal.toFixed(3)),
            maxPosition: ordered.length,
            series
        };
    }

    function reportTelemetryChartData_() {
        if (!analysis?.drivers?.length) return { speedUnit, drivers: [] };
        const segmentsPerLap = Math.max(1, analysis.segmentsPerLap || 1);
        const lapCount = Math.max(analysis.laps || 0, ...analysis.drivers.map(d => d.validLapTimes?.length || 0));
        const ordered = getLiveOrder_(Infinity, true).map(x => x.driver);
        const drivers = ordered.map((d, di) => {
            const laps = [];
            for (let lap = 1; lap <= lapCount; lap++) {
                const start = (lap - 1) * segmentsPerLap;
                const end = Math.min(start + segmentsPerLap, d.segmentTimes?.length || 0);
                const samples = [];
                for (let i = start; i < end; i++) {
                    const segTime = d.segmentTimes?.[i] || 0;
                    const dist = d.segmentDistancesMeters?.[i] || 0;
                    const speed = segTime > 0 ? dist / segTime : NaN;
                    const prevSpeed = i > 0 && d.segmentTimes?.[i - 1] > 0 ? (d.segmentDistancesMeters?.[i - 1] || 0) / d.segmentTimes[i - 1] : speed;
                    const dt = i > 0 ? (segTime + (d.segmentTimes?.[i - 1] || segTime)) / 2 : segTime;
                    const longG = calibrateLongitudinalG_(Number.isFinite(speed) && Number.isFinite(prevSpeed) && dt > 0 ? ((speed - prevSpeed) / dt) / 9.80665 : 0);
                    const throttle = clamp_(Math.max(0, longG) / 1.15 * 100, 0, 100);
                    const brake = clamp_(Math.max(0, -longG) / 1.35 * 100, 0, 100);
                    const speedDisplay = Number.isFinite(speed) ? (speedUnit === "mph" ? speed * 2.2369362921 : speed * 3.6) : NaN;
                    samples.push({
                        x: Number((((i - start) + 0.5) / segmentsPerLap * 100).toFixed(2)),
                        throttle: Number(throttle.toFixed(1)),
                        brake: Number(brake.toFixed(1)),
                        speed: Number.isFinite(speedDisplay) ? Number(speedDisplay.toFixed(1)) : null,
                        g: Number.isFinite(longG) ? Number(longG.toFixed(3)) : null
                    });
                }
                laps.push({
                    lap,
                    time: Number.isFinite(d.lapTimes?.[lap - 1]) ? formatTimeSeconds_(d.lapTimes[lap - 1]) : "--",
                    samples
                });
            }
            return {
                key: reportDriverChartKey_(d, di),
                name: d.name || `Driver ${di + 1}`,
                rs: formatDriverRs_(d.racingSkill),
                car: toOgCarName_(d.car || "") || "--",
                color: reportChartColor_(di),
                laps
            };
        });
        return { speedUnit, drivers };
    }

    function reportChartData_() {
        return {
            position: reportPositionChartData_(),
            telemetry: reportTelemetryChartData_()
        };
    }

    function reportChartsHtml_() {
        if (!analysis?.drivers?.length) return "";
        const drivers = analysis.drivers || [];
        const carCounts = new Map();
        for (const d of drivers) {
            const car = toOgCarName_(d.car || "") || "Unknown";
            carCounts.set(car, (carCounts.get(car) || 0) + 1);
        }
        const carUsage = reportPieChartHtml_("Car Usage", Array.from(carCounts, ([label, value]) => ({ label, value })));
        const charts = [
            carUsage,
            `<div class="chart-card wide"><h3>Position History</h3><div id="pgPositionChart" class="line-chart"></div><div id="pgPositionLegend" class="chart-legend"></div></div>`,
            `<div class="chart-card wide"><h3>Lap Telemetry</h3><div class="telemetry-controls"><label>Driver <select id="pgTelemetryDriver"></select></label><label>Lap <input id="pgTelemetryLap" type="number" min="1" step="1" value="1"></label></div><div id="pgTelemetryChart" class="line-chart telemetry-chart"></div><div class="mpg-note">Throttle and braking are estimated from segment speed changes, not raw pedal input.</div></div>`
        ].filter(Boolean).join("");
        return charts ? `<section class="chart-grid" aria-label="Race charts">${charts}</section>` : "";
    }

    function buildLapRecordingReportHtml_() {
        const data = lapRecordingData_(Infinity, true);
        return reportTableHtml_(data.headers, data.rows.map(row => {
            const d = (analysis?.drivers || []).find(x => normalizeDriverName_(x.name) === normalizeDriverName_(row[1]));
            return row.map((cell, idx) => idx === 2 ? reportCarCell_(d, cell) : ({ text: cell, className: idx >= 3 ? "mono" : "" }));
        }), { empty: "No decoded lap data." });
    }

    function buildGapsReportHtml_() {
        if (!analysis?.drivers?.length) return reportTableHtml_(["Pos", "Car", "Driver (RS)", "Gap (Prev lap gap)", "Gap Ahead (Prev lap gap)", "Finish Time"], []);
        const ordered = getLiveOrder_(Infinity, true);
        const leaderTime = ordered[0]?.driver?.finalTime || 0;
        const rows = ordered.map((x, i) => {
            const ahead = ordered[i - 1];
            const d = x.driver;
            const currentGap = i === 0 ? 0 : (d.crashed ? NaN : (d.finalTime || 0) - leaderTime);
            const aheadGap = !ahead ? 0 : (d.crashed || ahead.driver.crashed ? NaN : (d.finalTime || 0) - (ahead.driver.finalTime || 0));
            const prev = previousLapGapInfo_(d, x.state, currentGap);
            const aheadPrevRaw = ahead ? previousLapGapSeconds_(d, x.state) - previousLapGapSeconds_(ahead.driver, ahead.state) : NaN;
            return [
                i + 1,
                reportCarCell_(d),
                { text: d.name, html: `${esc_(d.name || "--")} (${driverRsCell_(d)})` },
                i === 0 ? "" : (d.crashed ? "DNF" : `${formatRaceGapSeconds_(currentGap)} (${prev.text})`),
                i <= 1 ? "" : (d.crashed || (ahead?.driver?.crashed) ? "DNF" : `${formatRaceGapSeconds_(aheadGap)}${Number.isFinite(aheadPrevRaw) ? ` (${formatRaceGapSeconds_(aheadPrevRaw)})` : ""}`),
                d.crashed ? "DNF" : formatTimeSeconds_(d.finalTime)
            ];
        });
        return reportTableHtml_(["Pos", "Car", "Driver (RS)", "Gap (Prev lap gap)", "Gap Ahead (Prev lap gap)", "Finish Time"], rows);
    }

    function buildSectorsReportHtml_() {
        if (!analysis?.drivers?.length) return "";
        const bestRows = [];
        for (const sector of [1, 2, 3]) {
            const all = analysis.drivers.flatMap(d => (d.sectorTimes || []).filter(s => s.sector === sector).map(s => ({ d, s }))).sort((a, b) => a.s.seconds - b.s.seconds);
            if (all[0]) bestRows.push([`S${sector}`, formatTimeSeconds_(all[0].s.seconds), all[0].d.name, all[0].s.lap, "Best"]);
        }
        const perDriver = analysis.drivers.map(d => {
            const cells = [1, 2, 3].map(sec => {
                const vals = (d.sectorTimes || []).filter(s => s.sector === sec).map(s => s.seconds);
                return vals.length ? formatTimeSeconds_(Math.min(...vals)) : "--";
            });
            return [d.name, cells[0], cells[1], cells[2]];
        });
        return `<h3>Best Sectors</h3>${reportTableHtml_(["Sector", "Best Time", "Driver", "Lap", "Note"], bestRows)}<h3>Per-driver Best Sectors</h3>${reportTableHtml_(["Driver", "S1", "S2", "S3"], perDriver)}`;
    }

    function buildSpeedReportHtml_() {
        if (!analysis?.drivers?.length) return "";
        const rows = getLiveOrder_(Infinity, true).map((x, i) => {
            const d = x.driver;
            const stats = driverTelemetryStats_(d, Infinity, true);
            const avgSpeed = d.finalTime > 0 ? ((analysis.lapMeters || 0) * (analysis.laps || 0)) / d.finalTime : NaN;
            return [i + 1, reportCarCell_(d), reportDriverCell_(d), driverRsCell_(d), formatSpeed_(stats.topSpeedMps), formatSpeed_(avgSpeed)];
        });
        return reportTableHtml_(["Pos", "Car", "Driver", "RS", "Top Speed", "Avg Speed"], rows);
    }

    function buildLapPaceReportHtml_() {
        if (!analysis?.drivers?.length) return "";
        const rows = getLiveOrder_(Infinity, true).map((x, i) => {
            const d = x.driver;
            return [i + 1, d.name, driverRsCell_(d), reportCarCell_(d), formatTimeSeconds_(d.bestLapSeconds), formatTimeSeconds_(d.averageLapSeconds), formatTimeSeconds_(d.idealLapSeconds), d.crashed ? "DNF" : "Finished"];
        });
        return reportTableHtml_(["Pos", "Driver", "RS", "Car", "Best Lap", "Average Lap", "Ideal Lap", "Status"], rows);
    }

    function buildGyroReportHtml_() {
        if (!analysis?.drivers?.length) return "";
        const rows = getLiveOrder_(Infinity, true).map((x, i) => {
            const d = x.driver;
            const stats = driverTelemetryStats_(d, Infinity, true);
            return [i + 1, d.name, driverRsCell_(d), reportCarCell_(d), formatSpeed_(stats.topSpeedMps), formatG_(stats.highestG), formatG_(stats.highestLateralG)];
        });
        return reportTableHtml_(["Pos", "Driver", "RS", "Car", "Top Speed", "Highest Combined G", "Highest Lateral G"], rows);
    }

    function buildFuelReportHtml_() {
        if (!analysis?.drivers?.length) return "";
        const rows = getLiveOrder_(Infinity, true).map((x, i) => {
            const d = x.driver;
            const fuel = fuelSnapshot_(d, Math.max(0, d.finalTime || 0));
            return [i + 1, d.name, driverRsCell_(d), reportCarCell_(d), formatFuelEconomy_(fuel.avgL100), formatFuelVolume_(fuel.liters), formatFuelEconomy_(fuel.base)];
        });
        return reportTableHtml_(["Pos", "Driver", "RS", "Car", "Average Fuel", "Fuel Burned", "Manufacturer Value"], rows);
    }

    function buildSummaryReportHtml_() {
        if (!analysis?.drivers?.length) return "";
        const rows = getLiveOrder_(Infinity, true).map((x, i) => {
            const d = x.driver;
            const stats = driverTelemetryStats_(d, Infinity, true);
            return [i + 1, d.name, driverRsCell_(d), reportCarCell_(d), d.crashed ? "DNF / Crashed" : "Finished", formatTimeSeconds_(d.finalTime), formatTimeSeconds_(d.bestLapSeconds), formatTimeSeconds_(d.idealLapSeconds), formatSpeed_(stats.topSpeedMps), formatG_(stats.highestG)];
        });
        const leadRows = analysis.drivers.slice().sort((a, b) => (b.timeInLeadSeconds || 0) - (a.timeInLeadSeconds || 0)).map(d => [d.name, formatLeadTime_(d.timeInLeadSeconds), d.lapsLed || 0, d.segmentsLed || 0, formatLeadTime_(d.longestLeadStintSeconds), Math.max(0, (d.leadChanges || 0) - 1)]);
        return `${reportTableHtml_(["Pos", "Driver", "RS", "Car", "Status", "Total", "Best Lap", "Ideal Lap", "Top Speed", "Highest Est. G"], rows)}<h3>Lead History</h3>${reportTableHtml_(["Driver", "Time in Lead", "Laps Led", "Segments Led", "Longest Stint", "Lead Changes"], leadRows)}`;
    }

    function buildDriverStatsReportHtml_() {
        if (!analysis?.drivers?.length) return "";
        const rows = getLiveOrder_(Infinity, true).map((x, i) => {
            const d = x.driver;
            const stats = driverTelemetryStats_(d, Infinity, true);
            return [i + 1, d.name, d.driverId || "--", formatDriverRs_(d.racingSkill), reportCarCell_(d), formatTimeSeconds_(d.bestLapSeconds), formatTimeSeconds_(d.averageLapSeconds), formatTimeSeconds_(d.idealLapSeconds), d.consistencyScore != null ? d.consistencyScore.toFixed(1) : "--", d.sectorsWon || 0, d.lapsLed || 0, formatTimeSeconds_(d.timeInLeadSeconds), formatSpeed_(stats.topSpeedMps), formatG_(stats.highestG)];
        });
        const historyRows = analysis.drivers.map(d => {
            const h = getDriverTrackHistory_(d.driverId, d.name, analysis.trackName || raceMeta?.track || "");
            return [d.name, h?.races || 0, h?.avgFinish ? `P${h.avgFinish.toFixed(1)}` : "--", h?.wins || 0, h?.podiums || 0, h?.crashes || 0, h?.bestLapMs ? msToTimeText_(h.bestLapMs, "lap") : "--", Number.isFinite(h?.riskScore) ? h.riskScore.toFixed(0) : "--"];
        });
        return `${reportTableHtml_(["Pos", "Driver", "Driver ID", "Racing Skill", "Car", "Best Lap", "Average Lap", "Ideal Lap", "Consistency", "Sectors Won", "Laps Led", "Time in Lead", "Top Speed", "Highest Est. G"], rows)}<h3>Driver History</h3>${reportTableHtml_(["Driver", "Races Here", "Avg Finish", "Wins", "Podiums", "Crashes", "Best Lap Here", "Risk"], historyRows)}`;
    }

    function buildPredictionsReportHtml_() {
        if (!analysis?.drivers?.length || !enablePredictions) return `<p class="muted">Predictions are disabled or unavailable.</p>`;
        const scored = rankedPredictionDrivers_().map(x => {
            const intel = useApiPredictions ? (x.d.driverIntel || getDriverIntelForDriver_(x.d)) : null;
            const skill = Number.isFinite(x.d.racingSkill) ? x.d.racingSkill : intel?.racingSkill;
            const history = useHistoryPredictions ? getDriverTrackHistory_(x.d.driverId, x.d.name, analysis.trackName || raceMeta?.track || "") : null;
            return Object.assign({}, x, { intel, skill, history, displayScore: Math.max(0.01, x.score) });
        });
        const total = scored.reduce((s, x) => s + x.displayScore, 0) || 1;
        const rows = scored.map((x, i) => {
            const win = x.displayScore / total * 100;
            const podium = clamp_(win * 2.5, 0, 95);
            const risk = Number(x.history?.riskScore);
            const conf = risk > 55 ? "Variable" : (x.intel && x.history?.races ? "High" : (x.intel || x.history?.races || Number.isFinite(x.skill) ? "Medium" : "Low"));
            const notes = [];
            if (x.intel) notes.push(`Intel: ${Number.isFinite(x.intel.racesEntered) ? x.intel.racesEntered : "--"} starts`);
            if (x.history?.races) notes.push(`${x.history.races} prior here, avg ${x.history.avgFinish ? `P${x.history.avgFinish.toFixed(1)}` : "--"}, risk ${Number.isFinite(risk) ? risk.toFixed(0) : "--"}`);
            return [i + 1, x.d.name, driverRsCell_(x.d), reportCarCell_(x.d), `${win.toFixed(1)}%`, `${podium.toFixed(1)}%`, (i + 1).toFixed(1), conf, notes.join(" · ") || "Needs Driver Intel"];
        });
        return reportTableHtml_(["Predicted Pos", "Driver", "RS", "Car", "Win Chance", "Podium Chance", "Expected Position", "Confidence", "Notes"], rows);
    }

    function buildHtmlReport_() {
        try {
            if (!analysis) {
                const payload = findLatestRaceDataPayload_();
                if (payload) buildAnalysisFromRaceData_(payload);
            }
            applyDriverIntelToModel_();
            ensureAnalysisAggregates_({ sectors: true, leads: true });
        } catch { }

        const info = raceMeta?.replayInfo || {};
        const rid = String(analysis?.raceId || raceMeta?.raceId || getRaceId_() || "").trim();
        const raceLink = rid ? `https://www.torn.com/page.php?sid=racing&raceID=${encodeURIComponent(rid)}` : "";
        const track = analysis?.trackName || raceMeta?.track || "—";
        const lapsCount = analysis?.laps || getOfficialLapCount_(track) || "—";
        const participants = analysis?.drivers?.length || raceMetaFromPayload_().currentDrivers || "—";
        const started = reportDateText_(info.time_started || raceMeta?.startAtIso || bestRaceAtIso_());
        const ended = reportEndTimeText_(started);
        const name = info.name || "—";
        const type = info.type || "—";
        const carsAllowed = info.cars_allowed || "—";
        const upgradesAllowed = info.upgrades_allowed || "—";
        const betAmount = info.bet_amount || "—";
        const generated = reportDateText_(new Date().toISOString());

        const sections = [
            ["leaderboard", "🏁 Leaderboard", "Final gaps, previous checkpoint gaps, and finish times.", buildGapsReportHtml_()],
            ["lap-recording", "🧾 Lap Recording", "Lap-by-lap matrix for the whole grid.", buildLapRecordingReportHtml_()],
            ["sectors", "📍 Sectors", "Best sectors and per-driver sector pace.", buildSectorsReportHtml_()],
            ["speed", "🚀 Speed", "Speed summary.", buildSpeedReportHtml_()],
            ["lap-pace", "⏱️ Lap Pace", "Best, average, and ideal lap pace.", buildLapPaceReportHtml_()],
            ...(fuelEnabled ? [["fuel", "⛽ Fuel", "Fuel estimate summary.", buildFuelReportHtml_()]] : []),
            ["gyro", "🌀 Gyro", "G-force telemetry summary.", buildGyroReportHtml_()],
            ["summary", "📋 Summary", "Race result and lead history.", buildSummaryReportHtml_()],
            ["driver-stats", "🪪 Driver Stats", "Driver performance, consistency, and saved local history.", buildDriverStatsReportHtml_()],
            ["predictions", "🔮 Predictions", "Pre-race model notes and confidence, preserved for comparison.", buildPredictionsReportHtml_()]
        ];
        const nav = sections.map(([id, title]) => `<a href="#${escAttr_(id)}">${esc_(title)}</a>`).join("");
        const sectionHtml = sections.map(([id, title, sub, html]) => reportSectionHtml_(id, title, sub, html)).join("");
        const title = `Pit Guru v${MPG_VERSION}`;
        const metaPairs = [
            ["Race ID", rid ? `<a href="${escAttr_(raceLink)}" target="_blank" rel="noopener noreferrer">${esc_(rid)}</a>` : "—"],
            ["Name", esc_(name)],
            ["Type", esc_(type)],
            ["Time started", esc_(started)],
            ["Time ended", esc_(ended)],
            ["Track", esc_(track)],
            ["Laps", esc_(lapsCount)],
            ["Participants", esc_(participants)],
            ["Cars allowed", esc_(carsAllowed)],
            ["Upgrades allowed", esc_(upgradesAllowed)],
            ["Bet amount", esc_(betAmount)]
        ];
        const metaHtml = `<div class="meta-table-wrap"><table class="meta-table"><thead><tr>${metaPairs.map(([k]) => `<th>${esc_(k)}</th>`).join("")}</tr></thead><tbody><tr>${metaPairs.map(([, v]) => `<td>${v}</td>`).join("")}</tr></tbody></table></div>`;
        const chartsHtml = reportChartsHtml_();
        const chartDataJson = reportJsonForScript_(reportChartData_());
        const reportVars = reportThemeCssVars_(theme);
        return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="MoDuL's Pit Guru v${escAttr_(MPG_VERSION)}">
<meta name="race-id" content="${escAttr_(rid)}">
<meta name="rt-race-id" content="${escAttr_(rid)}">
<meta name="race-name" content="${escAttr_(name)}">
<meta name="race-type" content="${escAttr_(type)}">
<meta name="time-started" content="${escAttr_(started)}">
<meta name="time-ended" content="${escAttr_(ended)}">
<meta name="track" content="${escAttr_(track)}">
<meta name="rt-track" content="${escAttr_(track)}">
<meta name="rt-race-at" content="${escAttr_(started)}">
<title>${esc_(title)} · ${esc_(track)} ${rid ? `· ${esc_(rid)}` : ""}</title>
<style>
:root{${reportVars}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 system-ui,-apple-system,Segoe UI,Arial,sans-serif}
.shell{max-width:1400px;margin:0 auto;padding:24px}.hero{border:1px solid var(--line);background:linear-gradient(180deg,var(--panel2),var(--panel));border-radius:14px;padding:20px;box-shadow:0 18px 50px rgba(0,0,0,.35)}
h1{margin:0;font-size:28px;letter-spacing:.2px}.sub{color:var(--muted);margin-top:4px}.nav{position:sticky;top:0;z-index:20;margin:14px 0;padding:10px;border:1px solid var(--line);border-radius:12px;background:rgba(15,17,21,.92);backdrop-filter:blur(10px);display:flex;flex-wrap:wrap;gap:8px}
.nav a{color:var(--text);text-decoration:none;border:1px solid var(--line);background:var(--pill);padding:8px 10px;border-radius:9px;font-weight:800}.nav a:hover{border-color:var(--accent);color:var(--accent)}
.meta-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px;margin-top:16px}.meta-table{width:100%;border-collapse:separate;border-spacing:0}.meta-table th,.meta-table td{padding:10px 12px;text-align:center;border-right:1px solid var(--line);white-space:nowrap}.meta-table th{background:var(--panel2);color:var(--muted);font-size:12px}.meta-table td{background:rgba(255,255,255,.035);font-weight:800}.meta-table th:last-child,.meta-table td:last-child{border-right:0}
a{color:var(--blue)}.report-section{margin-top:18px;border:1px solid var(--line);background:var(--panel);border-radius:14px;overflow:hidden}.section-head{padding:16px 18px;border-bottom:1px solid var(--line);background:var(--panel2)}.section-head h2{margin:0;font-size:20px}.section-head p{margin:4px 0 0;color:var(--muted)}
h3{margin:16px 18px 0;font-size:15px}.table-scroll{overflow:auto;max-height:72vh}table{width:100%;border-collapse:separate;border-spacing:0}th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:center;white-space:nowrap}th{position:sticky;top:0;z-index:3;background:var(--panel2);color:var(--text);cursor:pointer;user-select:none}th.sort-asc::after{content:" ▲";color:var(--accent)}th.sort-desc::after{content:" ▼";color:var(--accent)}tbody tr:hover td{background:rgba(255,255,255,.045)}.muted{color:var(--muted)}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.gap-neg{color:var(--green);font-weight:900}.gap-pos{color:var(--accent);font-weight:900}.gap-zero{color:var(--muted)}.mpg-driver-cell{font-weight:900}.carIcon{height:22px;min-width:46px;object-fit:contain;vertical-align:middle;border-radius:8px;background:rgba(255,255,255,.08);border:1px solid var(--line);margin-right:6px}.mpg-note{margin:12px 18px;color:var(--muted)}
.chart-grid{display:grid;grid-template-columns:minmax(280px,420px) minmax(0,1fr);gap:14px;margin-top:16px}.chart-card{border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.035);padding:14px;min-width:0}.chart-card.wide{grid-column:1/-1}.chart-card h3{margin:0 0 12px;font-size:14px}.pie-wrap{display:grid;grid-template-columns:120px minmax(0,1fr);gap:14px;align-items:center}.pie{width:118px;height:118px;border-radius:50%;border:1px solid var(--line);box-shadow:inset 0 0 0 18px rgba(0,0,0,.08)}.legend{display:grid;gap:6px}.legend-row{display:grid;grid-template-columns:14px minmax(0,1fr) auto;gap:8px;align-items:center}.legend-row span{width:12px;height:12px;border-radius:3px}.legend-row b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.legend-row em{font-style:normal;color:var(--muted)}.line-chart{min-height:300px;border:1px solid var(--line);border-radius:10px;background:rgba(0,0,0,.18);overflow:hidden}.line-chart svg{display:block;width:100%;height:320px}.chart-axis{stroke:var(--line);stroke-width:1}.chart-gridline{stroke:var(--line);stroke-width:1;opacity:.55}.chart-label{fill:var(--muted);font-size:11px}.chart-legend{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;max-height:92px;overflow:auto}.legend-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:4px 8px;background:rgba(255,255,255,.04);font-size:12px;font-weight:800}.legend-chip span{width:10px;height:10px;border-radius:999px}.telemetry-controls{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px}.telemetry-controls label{display:flex;align-items:center;gap:8px;color:var(--muted);font-weight:800}.telemetry-controls select,.telemetry-controls input{background:var(--pill);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:7px 9px}.telemetry-chart svg{height:300px}
@media(max-width:900px){.chart-grid{grid-template-columns:1fr}.pie-wrap{grid-template-columns:1fr}}
@media print{.nav{position:static}.table-scroll{max-height:none;overflow:visible}.shell{max-width:none;padding:0}.report-section,.hero{break-inside:avoid}}
</style>
</head>
<body>
<main class="shell">
  <header class="hero">
    <h1>${esc_(title)}</h1>
    <div class="sub">Generated ${esc_(generated)}${raceLink ? ` · <a href="${escAttr_(raceLink)}" target="_blank" rel="noopener noreferrer">Open Torn replay</a>` : ""}</div>
    <nav class="nav" aria-label="Report sections">${nav}</nav>
    ${metaHtml}
    ${chartsHtml}
  </header>
  ${sectionHtml}
</main>
<script>
(function(){
  var reportData = ${chartDataJson};
  var svgNs = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs){
    var el=document.createElementNS(svgNs,tag);
    attrs=attrs||{};
    Object.keys(attrs).forEach(function(k){el.setAttribute(k,attrs[k]);});
    return el;
  }
  function empty(el){while(el&&el.firstChild) el.removeChild(el.firstChild);}
  function fmtTime(sec){
    sec=Number(sec)||0;
    var m=Math.floor(sec/60),s=Math.floor(sec%60);
    return m+":"+(s<10?"0":"")+s;
  }
  function chartBox(container,height){
    var width=Math.max(620,container.clientWidth||900);
    return {w:width,h:height||320,l:44,t:18,r:18,b:34};
  }
  function path(points){
    return points.map(function(p,i){return (i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1);}).join(" ");
  }
  function renderPositionChart(){
    var container=document.getElementById("pgPositionChart");
    var legend=document.getElementById("pgPositionLegend");
    if(!container) return;
    empty(container); if(legend) empty(legend);
    var data=(reportData&&reportData.position)||{};
    if(!data.series||!data.series.length){container.textContent="No position history available.";return;}
    var box=chartBox(container,320), plotW=box.w-box.l-box.r, plotH=box.h-box.t-box.b;
    var maxPos=Math.max(1,Number(data.maxPosition)||data.series.length), duration=Math.max(1,Number(data.duration)||1);
    var svg=svgEl("svg",{viewBox:"0 0 "+box.w+" "+box.h,role:"img","aria-label":"Position history"});
    for(var p=1;p<=maxPos;p+=Math.max(1,Math.ceil(maxPos/10))){
      var y=box.t+((p-1)/Math.max(1,maxPos-1))*plotH;
      svg.appendChild(svgEl("line",{x1:box.l,y1:y,x2:box.w-box.r,y2:y,class:"chart-gridline"}));
      var label=svgEl("text",{x:8,y:y+4,class:"chart-label"}); label.textContent="P"+p; svg.appendChild(label);
    }
    for(var tick=0;tick<=4;tick++){
      var x=box.l+(tick/4)*plotW;
      svg.appendChild(svgEl("line",{x1:x,y1:box.t,x2:x,y2:box.h-box.b,class:"chart-gridline"}));
      var tx=svgEl("text",{x:x-14,y:box.h-10,class:"chart-label"}); tx.textContent=fmtTime(duration*tick/4); svg.appendChild(tx);
    }
    data.series.forEach(function(s){
      var pts=(s.points||[]).map(function(pnt){
        var x=box.l+(Number(pnt[0]||0)/duration)*plotW;
        var y=box.t+((Number(pnt[1]||maxPos)-1)/Math.max(1,maxPos-1))*plotH;
        return [x,y];
      });
      if(pts.length>1) svg.appendChild(svgEl("path",{d:path(pts),fill:"none",stroke:s.color||"var(--accent)","stroke-width":"2","stroke-linejoin":"round","stroke-linecap":"round",opacity:".86"}));
      if(legend){
        var chip=document.createElement("span");
        chip.className="legend-chip";
        var dot=document.createElement("span");
        dot.style.background=s.color||"var(--accent)";
        chip.appendChild(dot);
        chip.appendChild(document.createTextNode(String(s.name||"--")));
        legend.appendChild(chip);
      }
    });
    svg.appendChild(svgEl("line",{x1:box.l,y1:box.t,x2:box.l,y2:box.h-box.b,class:"chart-axis"}));
    svg.appendChild(svgEl("line",{x1:box.l,y1:box.h-box.b,x2:box.w-box.r,y2:box.h-box.b,class:"chart-axis"}));
    container.appendChild(svg);
  }
  function renderTelemetryChart(){
    var driverSel=document.getElementById("pgTelemetryDriver");
    var lapInput=document.getElementById("pgTelemetryLap");
    var container=document.getElementById("pgTelemetryChart");
    if(!driverSel||!lapInput||!container) return;
    var telemetry=(reportData&&reportData.telemetry)||{drivers:[]};
    if(!driverSel.options.length){
      (telemetry.drivers||[]).forEach(function(d,i){
        var opt=document.createElement("option");
        opt.value=String(i);
        opt.textContent=(d.name||"--")+" ("+(d.rs||"--")+")";
        driverSel.appendChild(opt);
      });
    }
    var driver=telemetry.drivers&&telemetry.drivers[Number(driverSel.value)||0];
    if(!driver){empty(container);container.textContent="No telemetry data available.";return;}
    var maxLap=Math.max(1,(driver.laps||[]).length);
    lapInput.max=String(maxLap);
    var lapNo=Math.max(1,Math.min(maxLap,Number(lapInput.value)||1));
    lapInput.value=String(lapNo);
    var lap=(driver.laps||[])[lapNo-1]||{samples:[]};
    empty(container);
    var box=chartBox(container,300), plotW=box.w-box.l-box.r, center=box.t+(box.h-box.t-box.b)/2;
    var topH=center-box.t, botH=box.h-box.b-center;
    var svg=svgEl("svg",{viewBox:"0 0 "+box.w+" "+box.h,role:"img","aria-label":"Lap telemetry"});
    svg.appendChild(svgEl("line",{x1:box.l,y1:center,x2:box.w-box.r,y2:center,class:"chart-axis"}));
    [25,50,75,100].forEach(function(v){
      var y1=center-(v/100)*topH, y2=center+(v/100)*botH;
      svg.appendChild(svgEl("line",{x1:box.l,y1:y1,x2:box.w-box.r,y2:y1,class:"chart-gridline"}));
      svg.appendChild(svgEl("line",{x1:box.l,y1:y2,x2:box.w-box.r,y2:y2,class:"chart-gridline"}));
    });
    var samples=lap.samples||[];
    var throttlePts=samples.map(function(s){return [box.l+(Number(s.x)||0)/100*plotW,center-(Number(s.throttle)||0)/100*topH];});
    var brakePts=samples.map(function(s){return [box.l+(Number(s.x)||0)/100*plotW,center+(Number(s.brake)||0)/100*botH];});
    var speedMax=Math.max.apply(null,samples.map(function(s){return Number(s.speed)||0}).concat([1]));
    var speedPts=samples.map(function(s){return [box.l+(Number(s.x)||0)/100*plotW,box.h-box.b-(Number(s.speed)||0)/speedMax*(box.h-box.t-box.b)];});
    if(throttlePts.length>1) svg.appendChild(svgEl("path",{d:path(throttlePts),fill:"none",stroke:"var(--green)","stroke-width":"2.5","stroke-linejoin":"round","stroke-linecap":"round"}));
    if(brakePts.length>1) svg.appendChild(svgEl("path",{d:path(brakePts),fill:"none",stroke:"var(--red)","stroke-width":"2.5","stroke-linejoin":"round","stroke-linecap":"round"}));
    if(speedPts.length>1) svg.appendChild(svgEl("path",{d:path(speedPts),fill:"none",stroke:"var(--blue)","stroke-width":"1.5","stroke-dasharray":"4 4",opacity:".85"}));
    var title=svgEl("text",{x:box.l,y:14,class:"chart-label"}); title.textContent=(driver.name||"--")+" · Lap "+lapNo+" · "+(lap.time||"--"); svg.appendChild(title);
    var th=svgEl("text",{x:box.w-box.r-245,y:14,class:"chart-label"}); th.textContent="green throttle · red brake · blue speed"; svg.appendChild(th);
    svg.appendChild(svgEl("line",{x1:box.l,y1:box.t,x2:box.l,y2:box.h-box.b,class:"chart-axis"}));
    svg.appendChild(svgEl("line",{x1:box.l,y1:box.h-box.b,x2:box.w-box.r,y2:box.h-box.b,class:"chart-axis"}));
    container.appendChild(svg);
  }
  var telemetryDriver=document.getElementById("pgTelemetryDriver");
  var telemetryLap=document.getElementById("pgTelemetryLap");
  if(telemetryDriver) telemetryDriver.addEventListener("change",renderTelemetryChart);
  if(telemetryLap) telemetryLap.addEventListener("input",renderTelemetryChart);
  renderPositionChart();
  renderTelemetryChart();
  var resizeTimer=0;
  window.addEventListener("resize",function(){
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(function(){renderPositionChart();renderTelemetryChart();},120);
  });
  function parse(v){
    v=(v||"").trim();
    if(!v||v==="—"||v==="--"||v==="--.--.---") return Number.POSITIVE_INFINITY;
    var pct=v.match(/^([+-]?\\d+(?:\\.\\d+)?)%$/); if(pct) return Number(pct[1]);
    var gap=v.match(/^\\+?([+-]?\\d+(?:\\.\\d+)?)(?:g|\\s|$)/i); if(gap && !/:/.test(v)) return Number(gap[1]);
    var time=v.match(/^(?:(\\d+):)?(\\d+):(\\d{2})(?:\\.(\\d{1,3}))?/);
    if(time){var h=Number(time[1]||0),m=Number(time[2]||0),s=Number(time[3]||0),ms=Number((time[4]||"0").padEnd(3,"0"));return ((h*3600+m*60+s)*1000+ms);}
    var num=v.replace(/,/g,"").match(/[+-]?\\d+(?:\\.\\d+)?/); return num?Number(num[0]):v.toLowerCase();
  }
  document.querySelectorAll("table").forEach(function(table){
    table.querySelectorAll("th").forEach(function(th,idx){
      th.addEventListener("click",function(){
        var tbody=table.tBodies[0]; if(!tbody) return;
        var desc=th.classList.contains("sort-asc");
        table.querySelectorAll("th").forEach(function(x){x.classList.remove("sort-asc","sort-desc")});
        th.classList.add(desc?"sort-desc":"sort-asc");
        Array.from(tbody.rows).sort(function(a,b){
          var av=parse((a.cells[idx]&& (a.cells[idx].dataset.sort||a.cells[idx].innerText))||"");
          var bv=parse((b.cells[idx]&& (b.cells[idx].dataset.sort||b.cells[idx].innerText))||"");
          if(typeof av==="number"&&typeof bv==="number") return desc?bv-av:av-bv;
          return desc?String(bv).localeCompare(String(av)):String(av).localeCompare(String(bv));
        }).forEach(function(r){tbody.appendChild(r)});
      });
    });
  });
})();
</script>
</body>
</html>`;
    }

    function exportHtml_() {
        try {
            ensureRaceMeta_();
            // ensure we export with the currently selected theme
            if (raceMeta) { raceMeta.theme = theme; saveRaceMeta_(raceMeta); }
            const html = buildHtmlReport_();
            const base = buildBaseFilename_();

            // Download first (keeps the browser "user gesture" even on stricter download policies)
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${base}.html`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);

            // Copy to clipboard (best effort)
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(html).catch(() => { });
                } else {
                    const ta = document.createElement("textarea");
                    ta.value = html;
                    ta.style.position = "fixed";
                    ta.style.left = "-9999px";
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand("copy");
                    document.body.removeChild(ta);
                }
            } catch { }

            // Export complete.
        } catch (e) {
            if (debugEnabled) console.warn(TAG, "exportHtml_ failed", e);
            toast_("HTML export failed — check console.");
        }
    }

    /* ============================
   * HTML IMPORT (Records)
   * ============================ */
    function toast_(msg) {
        try {
            const t = document.createElement('div');
            t.className = 'rtToast';
            t.textContent = String(msg || '');
            document.body.appendChild(t);
            setTimeout(() => t.classList.add('show'), 10);
            setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 2600);
        } catch { }
    }

    function notifyDriverSync_(key, msg) {
        const k = String(key || msg || "").trim();
        if (!k || driverIntelNotificationKey === k) return;
        driverIntelNotificationKey = k;
        toast_(msg);
    }

    function notifyRaceUpload_(key, msg) {
        const k = String(key || msg || "").trim();
        if (!k || pgPlayerCacheNotificationKeys.has(k)) return;
        pgPlayerCacheNotificationKeys.add(k);
        if (pgPlayerCacheNotificationKeys.size > 80) {
            pgPlayerCacheNotificationKeys = new Set(Array.from(pgPlayerCacheNotificationKeys).slice(-40));
        }
        toast_(msg);
    }

    function readFileText_(file) {
        return new Promise((resolve, reject) => {
            try {
                const fr = new FileReader();
                fr.onload = () => resolve(String(fr.result || ''));
                fr.onerror = () => reject(fr.error || new Error('read failed'));
                fr.readAsText(file);
            } catch (e) { reject(e); }
        });
    }

    function handleForumLikeAction_() {
        toast_("Opening the Pit Guru release thread.");
        setTimeout(() => {
            location.href = SCRIPT_FORUM_POST_URL;
        }, 80);
    }

    function hash32_(s) {
        // FNV-1a 32-bit
        s = String(s || '');
        let h = 0x811c9dc5;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(16).padStart(8, '0');
    }

    function makeBestRecId_(mode, track, car) {
        return `best:${mode}:${hash32_(track)}:${hash32_(car)}`;
    }

    function updateBestRecord_(mode, track, car, ms, timeText, extra) {
        if (!mode || !track || !car) return false;
        if (!(typeof ms === 'number' && isFinite(ms) && ms > 0)) return false;

        const sourceTrack = (extra && extra.sourceTrack) ? normalizeTrackLabel_(extra.sourceTrack) : normalizeTrackLabel_(track);
        const scopedTrack = getRecordTrackScope_(mode, sourceTrack || track);
        if (!scopedTrack) return false;

        const id = makeBestRecId_(mode, scopedTrack, car);
        const prev = records.find(r => r && r.id === id);
        if (prev && (prev.ms || 0) <= ms) return false; // existing is better or equal

        // remove any older entries for this tuple (including legacy ids)
        records = records.filter(r => !(r && r.mode === mode && getRecordTrackScopeFromRow_(r, mode) === scopedTrack && r.car === car));

        const atIso = (extra && extra.atIso) ? extra.atIso : bestRaceAtIso_();
        records.push({
            id,
            track: scopedTrack,
            trackKey: scopedTrack,
            trackLabel: scopedTrack,
            sourceTrack,
            mode,
                car: toOgCarName_(car),
            carImg: (extra && extra.carImg) ? extra.carImg : '',
            carClass: (extra && extra.carClass) ? extra.carClass : '',
            driverName: (extra && extra.driverName) ? extra.driverName : '',
            driverId: (extra && extra.driverId) ? extra.driverId : '',
            raceId: (extra && extra.raceId) ? extra.raceId : (raceMeta?.raceId || ""),
            timeText: timeText || msToTimeText_(ms, mode),
            ms,
            atIso
        });

        return true;
    }

    function importHtmlReportText_(htmlText, filename) {
        try {
            const doc = new DOMParser().parseFromString(String(htmlText || ''), 'text/html');
            if (!doc || !doc.querySelector) return null;
            const title = (doc.querySelector('title')?.textContent || '').trim();
            const titleLower = title.toLowerCase();
            if (!titleLower.includes('torn lap times') && !titleLower.includes('pit guru')) return null;

            const metaCarImg = doc.querySelector('meta[name="rt-car-img"]')?.getAttribute('content') || '';
            const metaRaceAt = doc.querySelector('meta[name="rt-race-at"]')?.getAttribute('content') || '';
            let raceId = (doc.querySelector('meta[name="rt-race-id"]')?.getAttribute('content') || '').trim();

            // Track + Car
            let track = '';
            let car = '';
            const tcEl = Array.from(doc.querySelectorAll('div')).find(d => {
                const t = (d.textContent || '').replace(/\s+/g, ' ').trim();
                return /Track:/i.test(t) && /Car:/i.test(t);
            });
            if (tcEl) {
                const t = (tcEl.textContent || '').replace(/\s+/g, ' ').trim();
                const m = t.match(/Track:\s*(.*?)\s*Car:\s*(.*?)(?:\s+Race:|\s+Driver:|\s+Generated:|$)/i);
                if (m) { track = (m[1] || '').trim(); car = (m[2] || '').trim(); }
            }

            // Fallback from filename: "Commerce_-_15_laps.Honda_NSX_P3.html"
            if ((!track || !car) && filename) {
                const fn = String(filename);
                const m = fn.match(/\.([^.]*)\.([^.]*)\./);
                if (m && !track) track = (m[1] || '').replace(/_/g, ' ').trim();
                if (m && !car) car = (m[2] || '').replace(/_/g, ' ').trim();
            }

            track = track || 'UnknownTrack';
            car = toOgCarName_(car) || 'UnknownCar';

            // Race datetime -> ISO (best effort)
            let atIso = '';
            if (metaRaceAt) atIso = metaRaceAt;
            const raceEl = Array.from(doc.querySelectorAll('div')).find(d => /Race:/i.test((d.textContent || '')));
            if (!atIso && raceEl) {
                const t = (raceEl.textContent || '').replace(/\s+/g, ' ').trim();
                const m = t.match(/Race:\s*(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})/);
                if (m) {
                    const dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), yyyy = parseInt(m[3], 10);
                    const HH = parseInt(m[4], 10), MI = parseInt(m[5], 10), SS = parseInt(m[6], 10);
                    const d = new Date(yyyy, mm - 1, dd, HH, MI, SS);
                    if (!isNaN(d.getTime())) atIso = d.toISOString();
                }
            }
            if (!atIso) atIso = nowIso_();

            if (!raceId) {
                const raceLink = doc.querySelector('a[href*="raceID="], a[href*="raceId="], a[href*="raceid="]');
                if (raceLink) {
                    try {
                        const u = new URL(raceLink.getAttribute('href') || '', location.href);
                        raceId = (u.searchParams.get('raceID') || u.searchParams.get('raceId') || u.searchParams.get('raceid') || '').trim();
                    } catch { }
                }
            }
            if (!raceId) {
                const raceIdEl = Array.from(doc.querySelectorAll('div')).find(d => /Race ID:/i.test((d.textContent || '')));
                const m = raceIdEl ? String(raceIdEl.textContent || '').match(/Race ID:\s*(\d+)/i) : null;
                if (m) raceId = m[1];
            }

            // Driver name from row title="Driver — Car"
            let driverName = '';
            const trAny = doc.querySelector('tbody tr[title]');
            if (trAny) {
                const t = String(trAny.getAttribute('title') || '').trim();
                const parts = t.split('—').map(x => x.trim()).filter(Boolean);
                if (parts.length) driverName = parts[0];
            }

            // Collect all chrono lap times
            const chronoMs = [];
            const rows = Array.from(doc.querySelectorAll('tbody tr'));
            for (const tr of rows) {
                const tds = tr.querySelectorAll('td');
                if (!tds || tds.length < 3) continue;
                const chronoTxt = String(tds[2].textContent || '').replace(/\s+/g, '').trim();
                const ms = timeTextToMs_(chronoTxt);
                if (ms && ms > 0) chronoMs.push(ms);
            }
            if (!chronoMs.length) return null;

            // Best lap = fastest row (class fastest) else minimum chrono
            let bestMs = 0;
            const trFast = doc.querySelector('tbody tr.fastest');
            if (trFast) {
                const tds = trFast.querySelectorAll('td');
                const chronoTxt = tds && tds[2] ? String(tds[2].textContent || '').replace(/\s+/g, '').trim() : '';
                const ms = timeTextToMs_(chronoTxt);
                if (ms && ms > 0) bestMs = ms;
            }
            if (!bestMs) bestMs = Math.min(...chronoMs);

            const raceMs = chronoMs.reduce((a, b) => a + b, 0);

            const extra = { atIso, carImg: metaCarImg || '', carClass: '', driverName, driverId: '', raceId, sourceTrack: track };

            const changedLap = updateBestRecord_('lap', track, car, bestMs, msToTimeText_(bestMs, 'lap'), extra);
            const changedRace = updateBestRecord_('race', track, car, raceMs, msToTimeText_(raceMs, 'race'), extra);
            return (changedLap || changedRace) ? true : false;
        } catch (e) {
            if (debugEnabled) console.warn(TAG, "importHtmlReportText_ failed", e);
            return null;
        }
    }


    /* ============================
   * UI
   * ============================ */
    function updateHeaderCompact_(win) {
        try {
            if (!win) return;
            const hdr = win.querySelector("#rtHdr");
            const left = hdr?.querySelector(".left");
            const right = hdr?.querySelector(".right");
            if (!hdr || !left || !right) return;

            win.classList.remove("rtCompact");

            const headerWidth = hdr.clientWidth || 0;
            const buttons = Array.from(right.querySelectorAll(".pill"));
            const buttonWidth = buttons.reduce((sum, btn) => sum + (btn.scrollWidth || btn.getBoundingClientRect().width || 0), 0);
            const buttonGaps = Math.max(0, buttons.length - 1) * 8;
            const titleMinWidth = 170;
            const headerPaddingAndGap = 34;
            const needsCompact = headerWidth > 0 && (titleMinWidth + buttonWidth + buttonGaps + headerPaddingAndGap > headerWidth);

            win.classList.toggle("rtCompact", needsCompact);
        } catch { }
    }

    function requestHeaderCompact_(win) {
        try {
            const target = win || document.getElementById("rtLapWin");
            if (!target || headerCompactRaf) return;
            headerCompactRaf = requestAnimationFrame(() => {
                headerCompactRaf = 0;
                updateHeaderCompact_(target.isConnected ? target : document.getElementById("rtLapWin"));
            });
        } catch {
            headerCompactRaf = 0;
            updateHeaderCompact_(win || document.getElementById("rtLapWin"));
        }
    }

    function loadHeaderButtonOrder_() {
        const raw = loadJson_(STORE_HEADER_BUTTON_ORDER_KEY, []);
        return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
    }

    function saveHeaderButtonOrder_(ids) {
        saveJson_(STORE_HEADER_BUTTON_ORDER_KEY, Array.isArray(ids) ? ids.filter(Boolean) : []);
    }

    function applyHeaderButtonOrder_() {
        const right = document.querySelector("#rtHdr .right");
        if (!right) return;
        const order = loadHeaderButtonOrder_();
        if (!order.length) return;
        const byId = new Map(Array.from(right.children).filter(el => el.id).map(el => [el.id, el]));
        for (const id of order) {
            const el = byId.get(id);
            if (el && el.parentElement === right) right.appendChild(el);
        }
    }

    function setupHeaderButtonDrag_() {
        const right = document.querySelector("#rtHdr .right");
        if (!right || right.dataset.dragHooked === "1") return;
        right.dataset.dragHooked = "1";
        let dragged = null;
        right.querySelectorAll(".pill[id]").forEach(btn => {
            if (btn.id !== "rtClose") btn.draggable = true;
        });
        right.addEventListener("dragstart", e => {
            const btn = e.target?.closest?.(".pill[id]");
            if (!btn || btn.id === "rtClose") return;
            dragged = btn;
            btn.classList.add("mpg-dragging");
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", btn.id);
        });
        right.addEventListener("dragover", e => {
            if (!dragged) return;
            e.preventDefault();
            const over = e.target?.closest?.(".pill[id]");
            if (!over || over === dragged || over.id === "rtClose") return;
            const rect = over.getBoundingClientRect();
            right.insertBefore(dragged, e.clientX > rect.left + rect.width / 2 ? over.nextSibling : over);
        });
        right.addEventListener("dragend", () => {
            if (dragged) dragged.classList.remove("mpg-dragging");
            dragged = null;
            saveHeaderButtonOrder_(Array.from(right.querySelectorAll(".pill[id]")).map(btn => btn.id));
            updateHeaderCompact_(document.getElementById("rtLapWin"));
        });
    }

    function clamp_(value, min, max) {
        if (!Number.isFinite(value)) return min;
        if (max < min) return min;
        return Math.min(Math.max(value, min), max);
    }

    function getViewportSize_() {
        const docEl = document.documentElement || {};
        const width = Math.max(320, window.innerWidth || docEl.clientWidth || 0);
        const height = Math.max(240, window.innerHeight || docEl.clientHeight || 0);
        return { width, height };
    }

    function getDefaultWindowRect_() {
        const { width: viewportWidth, height: viewportHeight } = getViewportSize_();
        const width = Math.min(WIN_DEFAULT_WIDTH, Math.max(260, viewportWidth - (WIN_VIEWPORT_MARGIN * 2)));
        const height = Math.min(WIN_DEFAULT_HEIGHT, Math.max(220, viewportHeight - (WIN_VIEWPORT_MARGIN * 2)));
        return {
            left: Math.max(WIN_VIEWPORT_MARGIN, viewportWidth - WIN_VIEWPORT_MARGIN - width),
            top: Math.max(WIN_VIEWPORT_MARGIN, viewportHeight - WIN_VIEWPORT_MARGIN - height),
            width,
            height
        };
    }

    function getDefaultRecordsRect_() {
        const { width: viewportWidth, height: viewportHeight } = getViewportSize_();
        const width = Math.min(760, Math.max(260, viewportWidth - (WIN_VIEWPORT_MARGIN * 2)));
        const height = Math.min(460, Math.max(220, viewportHeight - (WIN_VIEWPORT_MARGIN * 2)));
        return {
            left: Math.max(WIN_VIEWPORT_MARGIN, viewportWidth - WIN_VIEWPORT_MARGIN - width),
            top: Math.max(WIN_VIEWPORT_MARGIN, viewportHeight - WIN_VIEWPORT_MARGIN - height),
            width,
            height
        };
    }

    function getDefaultRectForStore_(storeKey) {
        return storeKey === "records" ? getDefaultRecordsRect_() : getDefaultWindowRect_();
    }

    function getWindowMinSize_(el) {
        const cs = getComputedStyle(el);
        return {
            width: Math.max(parseFloat(cs.minWidth) || 0, WIN_MIN_WIDTH),
            height: Math.max(parseFloat(cs.minHeight) || 0, WIN_MIN_HEIGHT)
        };
    }

    function getWindowRect_(el) {
        const rect = el.getBoundingClientRect();
        const fallback = getDefaultWindowRect_();
        const styleLeft = parseFloat(el.style.left);
        const styleTop = parseFloat(el.style.top);
        const styleWidth = parseFloat(el.style.width);
        const styleHeight = parseFloat(el.style.height);
        return {
            left: Number.isFinite(rect.left) && rect.width > 0 ? rect.left : (Number.isFinite(styleLeft) ? styleLeft : fallback.left),
            top: Number.isFinite(rect.top) && rect.height > 0 ? rect.top : (Number.isFinite(styleTop) ? styleTop : fallback.top),
            width: Number.isFinite(rect.width) && rect.width > 0 ? rect.width : (Number.isFinite(styleWidth) ? styleWidth : fallback.width),
            height: Number.isFinite(rect.height) && rect.height > 0 ? rect.height : (Number.isFinite(styleHeight) ? styleHeight : fallback.height)
        };
    }

    function clampWindowRect_(rect, minWidth, minHeight) {
        const { width: viewportWidth, height: viewportHeight } = getViewportSize_();
        const maxWidth = Math.max(260, viewportWidth - (WIN_VIEWPORT_MARGIN * 2));
        const maxHeight = Math.max(220, viewportHeight - (WIN_VIEWPORT_MARGIN * 2));
        const safeMinWidth = Math.min(Math.max(220, minWidth || WIN_MIN_WIDTH), maxWidth);
        const safeMinHeight = Math.min(Math.max(220, minHeight || WIN_MIN_HEIGHT), maxHeight);
        const width = clamp_(Math.round(rect.width || WIN_DEFAULT_WIDTH), safeMinWidth, maxWidth);
        const height = clamp_(Math.round(rect.height || WIN_DEFAULT_HEIGHT), safeMinHeight, maxHeight);
        const maxLeft = Math.max(WIN_VIEWPORT_MARGIN, viewportWidth - WIN_VIEWPORT_MARGIN - width);
        const maxTop = Math.max(WIN_VIEWPORT_MARGIN, viewportHeight - WIN_VIEWPORT_MARGIN - height);
        const preferredLeft = Number.isFinite(rect.left) ? rect.left : maxLeft;
        const preferredTop = Number.isFinite(rect.top) ? rect.top : maxTop;
        return {
            left: clamp_(Math.round(preferredLeft), WIN_VIEWPORT_MARGIN, maxLeft),
            top: clamp_(Math.round(preferredTop), WIN_VIEWPORT_MARGIN, maxTop),
            width,
            height
        };
    }

    function saveElementRect_(storeKey, rect) {
        if (!storeKey || !rect) return;
        const st = loadUiState_();
        st[storeKey] = {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
        saveUiState_(st);
    }

    function applyWindowRect_(el, rect) {
        if (!el || !rect) return;
        el.style.right = "auto";
        el.style.bottom = "auto";
        el.style.left = `${Math.round(rect.left)}px`;
        el.style.top = `${Math.round(rect.top)}px`;
        el.style.width = `${Math.round(rect.width)}px`;
        el.style.height = `${Math.round(rect.height)}px`;
    }

    function storedRectLooksPageSized_(rect) {
        if (!rect) return false;
        const { width: viewportWidth, height: viewportHeight } = getViewportSize_();
        const w = Number(rect.width || 0);
        const h = Number(rect.height || 0);
        return (w > 0 && viewportWidth > 720 && w >= viewportWidth - (WIN_VIEWPORT_MARGIN * 3)) ||
            (h > 0 && viewportHeight > 620 && h >= viewportHeight - (WIN_VIEWPORT_MARGIN * 3));
    }

    function getSafeStoredRect_(storeKey) {
        const st = loadUiState_();
        const saved = st && storeKey ? st[storeKey] : null;
        if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top) && !storedRectLooksPageSized_(saved)) return saved;
        return getDefaultRectForStore_(storeKey);
    }

    function restoreSafeRect_(el, storeKey) {
        if (!el) return null;
        const minSize = getWindowMinSize_(el);
        const safe = clampWindowRect_(getSafeStoredRect_(storeKey), minSize.width, minSize.height);
        applyWindowRect_(el, safe);
        return safe;
    }

    function keepWindowInBounds_(el, storeKey, opts = {}) {
        if (!el) return null;
        const persist = opts.persist !== false;
        const minSize = getWindowMinSize_(el);
        const before = getWindowRect_(el);
        if (!persist && storeKey && storedRectLooksPageSized_(before)) {
            return restoreSafeRect_(el, storeKey);
        }
        const clamped = clampWindowRect_(before, minSize.width, minSize.height);
        const changed =
            Math.abs((before.left || 0) - clamped.left) > 0.5 ||
            Math.abs((before.top || 0) - clamped.top) > 0.5 ||
            Math.abs((before.width || 0) - clamped.width) > 0.5 ||
            Math.abs((before.height || 0) - clamped.height) > 0.5;

        if (changed) applyWindowRect_(el, clamped);
        if (storeKey && persist) saveElementRect_(storeKey, clamped);
        return clamped;
    }

    function restorePositions_() {
        const st = loadUiState_();
        const btn = document.getElementById("rtLapBtn");
        const win = document.getElementById("rtLapWin");
        const recPop = document.getElementById("rtRecordsPopup");

        if (btn && st.btn && Number.isFinite(st.btn.left) && Number.isFinite(st.btn.top)) {
            btn.style.right = "auto"; btn.style.bottom = "auto";
            btn.style.left = `${st.btn.left}px`;
            btn.style.top = `${st.btn.top}px`;
        }
        if (win) {
            if (st.win && storedRectLooksPageSized_(st.win)) {
                restoreSafeRect_(win, "win");
            } else if (st.win && Number.isFinite(st.win.left) && Number.isFinite(st.win.top)) {
                win.style.right = "auto"; win.style.bottom = "auto";
                win.style.left = `${st.win.left}px`;
                win.style.top = `${st.win.top}px`;
                if (Number.isFinite(st.win.width) && Number.isFinite(st.win.height)) {
                    win.style.width = `${st.win.width}px`;
                    win.style.height = `${st.win.height}px`;
                }
            } else {
                applyWindowRect_(win, getDefaultWindowRect_());
            }
            keepWindowInBounds_(win, "win", { persist: false });
        }
        if (recPop) {
            if (st.records && storedRectLooksPageSized_(st.records)) {
                restoreSafeRect_(recPop, "records");
            } else if (st.records && Number.isFinite(st.records.left) && Number.isFinite(st.records.top)) {
                recPop.style.right = "auto"; recPop.style.bottom = "auto";
                recPop.style.left = `${st.records.left}px`;
                recPop.style.top = `${st.records.top}px`;
                if (Number.isFinite(st.records.width) && Number.isFinite(st.records.height)) {
                    recPop.style.width = `${st.records.width}px`;
                    recPop.style.height = `${st.records.height}px`;
                }
            }
            keepWindowInBounds_(recPop, "records", { persist: false });
        }
    }

    function openWin_() {
        const win = document.getElementById("rtLapWin");
        const btn = document.getElementById("rtLapBtn");
        if (!win || !btn) return;
        win.style.display = "block";
        btn.style.display = "none";
        keepWindowInBounds_(win, "win", { persist: false });
        saveWinOpen_(true);
    }

    function closeWin_() {
        document.getElementById("rtLapWin").style.display = "none";
        document.getElementById("rtLapBtn").style.display = "flex";
        saveWinOpen_(false);
    }

    function tutorialSteps_() {
        return [
            {
                selector: "#mpgApiKey",
                title: "Connect Driver Intel",
                copy: "Add your public Torn API key here. It stays in your userscript storage and unlocks Racing Skill, driver profiles, garage refreshes, and hosted-player verification.",
                prepare() {
                    openWin_();
                    garageOpen = false;
                    settingsOpen = true;
                    focusApiKeyPending = true;
                }
            },
            {
                selector: "#mpgModeBar",
                title: "Live analysis containers",
                copy: "Switch between the live leaderboard, lap recording, sectors, speed, pace, gyro, summaries, driver stats, and predictions. Each view follows the same live race or replay moment.",
                prepare() {
                    openWin_();
                    settingsOpen = false;
                    garageOpen = false;
                }
            },
            {
                selector: "#mpgModeBar button[data-mode=\"predictions\"]",
                title: "Know the grid before lights out",
                copy: "Predictions combine Driver Intel and matching track history before the race starts, so you can assess the field while the grid is still forming.",
                prepare() {
                    openWin_();
                    settingsOpen = false;
                    garageOpen = false;
                }
            },
            {
                selector: "#rtLocalPlayer",
                title: "Open the visual race player",
                copy: "The Player reconstructs Torn racingData into an external replay with the track map, timing tower, commentary, telemetry comparisons, and G-Live Accelerator.",
                prepare() {
                    openWin_();
                    settingsOpen = false;
                    garageOpen = false;
                }
            },
            {
                selector: "#mpgGarageBtn",
                title: "Manage and compare your garage",
                copy: "My Garage tracks each enlisted-car instance, upgrades, mileage, stats, fuel data, and side-by-side car comparisons.",
                prepare() {
                    openWin_();
                    settingsOpen = false;
                    garageOpen = false;
                }
            },
            {
                selector: "#rtToggleRecords",
                title: "Keep results and export reports",
                copy: "Records retain your best laps and race times, while HTML export creates a portable race report. Auto-clear prepares the same window for the next event.",
                prepare() {
                    openWin_();
                    settingsOpen = false;
                    garageOpen = false;
                }
            }
        ];
    }

    function clearTutorialHighlight_() {
        if (tutorialHighlightedEl) tutorialHighlightedEl.classList.remove("mpg-tutorial-target");
        tutorialHighlightedEl = null;
    }

    function ensureTutorial_() {
        let tutorial = document.getElementById("mpgTutorial");
        if (tutorial) return tutorial;
        tutorial = document.createElement("div");
        tutorial.id = "mpgTutorial";
        tutorial.innerHTML = `
          <div class="mpg-tutorial-card" role="dialog" aria-modal="false" aria-labelledby="mpgTutorialTitle">
            <div class="mpg-tutorial-kicker">Pit Guru quick tour</div>
            <div id="mpgTutorialTitle" class="mpg-tutorial-title"></div>
            <div id="mpgTutorialCopy" class="mpg-tutorial-copy"></div>
            <div class="mpg-tutorial-actions">
              <button id="mpgTutorialSkip" class="pill" type="button">Skip</button>
              <div class="mpg-tutorial-nav">
                <span id="mpgTutorialProgress" class="mpg-tutorial-progress"></span>
                <button id="mpgTutorialPrev" class="pill" type="button">Back</button>
                <button id="mpgTutorialNext" class="pill on" type="button">Next</button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(tutorial);
        tutorial.querySelector("#mpgTutorialSkip").onclick = () => finishTutorial_();
        tutorial.querySelector("#mpgTutorialPrev").onclick = () => showTutorialStep_(tutorialStep - 1);
        tutorial.querySelector("#mpgTutorialNext").onclick = () => {
            const steps = tutorialSteps_();
            if (tutorialStep >= steps.length - 1) finishTutorial_();
            else showTutorialStep_(tutorialStep + 1);
        };
        window.addEventListener("resize", () => {
            if (tutorialActive) positionTutorial_();
        });
        window.addEventListener("scroll", () => {
            if (tutorialActive) positionTutorial_();
        }, true);
        applyTheme_();
        return tutorial;
    }

    function positionTutorial_(scrollTarget = false) {
        if (!tutorialActive) return;
        const tutorial = ensureTutorial_();
        const card = tutorial.querySelector(".mpg-tutorial-card");
        const step = tutorialSteps_()[tutorialStep];
        if (!card || !step) return;
        clearTutorialHighlight_();
        const target = document.querySelector(step.selector) || document.getElementById("rtLapWin");
        if (!target) return;
        tutorialHighlightedEl = target;
        target.classList.add("mpg-tutorial-target");
        if (scrollTarget) {
            try { target.scrollIntoView({ block: "center", inline: "center" }); } catch { }
        }
        const rect = target.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const margin = 12;
        const below = rect.bottom + margin;
        const top = below + cardRect.height <= window.innerHeight - margin
            ? below
            : Math.max(margin, rect.top - cardRect.height - margin);
        const left = Math.max(margin, Math.min(window.innerWidth - cardRect.width - margin, rect.left + (rect.width - cardRect.width) / 2));
        card.style.top = `${Math.round(top)}px`;
        card.style.left = `${Math.round(left)}px`;
    }

    function focusFirstRunApiKey_() {
        if (!focusApiKeyPending || !settingsOpen) return;
        const input = document.getElementById("mpgApiKey");
        if (!input) return;
        focusApiKeyPending = false;
        requestAnimationFrame(() => {
            try {
                input.focus({ preventScroll: true });
                if (!input.readOnly && !input.value) input.select();
            } catch { }
        });
    }

    function showTutorialStep_(stepIndex) {
        const steps = tutorialSteps_();
        tutorialStep = Math.max(0, Math.min(steps.length - 1, Number(stepIndex) || 0));
        tutorialActive = true;
        const step = steps[tutorialStep];
        step.prepare();
        const tutorial = ensureTutorial_();
        tutorial.style.display = "block";
        tutorial.querySelector("#mpgTutorialTitle").textContent = step.title;
        tutorial.querySelector("#mpgTutorialCopy").textContent = step.copy;
        tutorial.querySelector("#mpgTutorialProgress").textContent = `${tutorialStep + 1} / ${steps.length}`;
        tutorial.querySelector("#mpgTutorialPrev").disabled = tutorialStep === 0;
        tutorial.querySelector("#mpgTutorialNext").textContent = tutorialStep === steps.length - 1 ? "Done" : "Next";
        uiDirty = true;
        scheduleRender_();
        requestAnimationFrame(() => requestAnimationFrame(() => {
            positionTutorial_(true);
            focusFirstRunApiKey_();
        }));
    }

    function startTutorial_() {
        showTutorialStep_(0);
    }

    function finishTutorial_() {
        tutorialActive = false;
        onboardingRequired = false;
        saveBoolSetting_(STORE_ONBOARDING_COMPLETE_KEY, true);
        clearTutorialHighlight_();
        const tutorial = document.getElementById("mpgTutorial");
        if (tutorial) tutorial.style.display = "none";
    }


    function clearView_(opts = {}) {
        const currentPayload = latestRaceDataPayload || analysis?.payload || null;
        if (!opts.keepAnalysis && currentPayload) clearedRaceDataKey = raceDataPayloadKey_(currentPayload);
        latestRaceDataPayload = null;
        analysis = null;
        analysisFocusMode = "auto";
        analysisFocusDriverId = "";
        analysisFocusDriverName = "";
        lastHeavyRaceStats = { heavyRace: false, estimatedPoints: 0, drivers: 0, laps: 0, intervals: 0 };
        heavyRaceOverrideRaceKey = "";
        heavyRaceShowAllDrivers = false;
        heavyRaceFullCardsEnabled = false;
        liveOrderCache = { key: "", value: [] };
        raceDataReceivedPerfMs = 0;
        raceDataCurrentTimeAtReceive = NaN;
        preRaceParticipants = [];
        preRaceParticipantsKey = "";
        resetScanCaches_();
        finalAnalysisNotifiedForRaceId = "";
        recordsUpdatedForAnalysisRaceId = "";
        driverIntelAutoRaceKey = "";
        lastCommentaryAtMs = 0;
        lastCommentaryText = "";
        lastCommentaryKey = "";
        lastTeamRadioAtMs = 0;
        lastTeamRadioText = "";
        lastTeamRadioKey = "";
        raceOvertakesCache = { key: "", value: 0 };
        raceOvertakesFloorCache = { key: "", value: 0 };
        fuelSessionCache = { key: "", liters: 0, levelPct: 100 };
        gyroTraceByDriver.clear();
        slideEventsCache = new WeakMap();
        if (!opts.keepMeta) clearRaceMeta_();
        const body = document.getElementById("mpgAnalysisBody");
        if (body) {
            body.dataset.renderKey = "";
            body.innerHTML = "";
        }
        const status = document.getElementById("mpgStatusBadge");
        if (status) status.textContent = "";
        uiDirty = true;
        scheduleRender_();
    }

    function ensureSettingsModal_() {
        document.querySelectorAll("#rtBody > #mpgSettingsPanel").forEach(el => el.remove());
        let modal = document.getElementById("mpgSettingsModal");
        if (modal) return modal;
        modal = document.createElement("div");
        modal.id = "mpgSettingsModal";
        modal.className = "mpg-settings-modal";
        modal.innerHTML = `
          <div class="mpg-settings-window" role="dialog" aria-modal="true" aria-labelledby="mpgSettingsTitle">
            <div class="mpg-settings-header">
              <div>
                <div id="mpgSettingsTitle" class="mpg-settings-title">Settings</div>
                <div class="mpg-settings-subtitle">API, analysis, display, records, and advanced controls.</div>
              </div>
              <div class="mpg-settings-header-actions">
                <button id="mpgSettingsTour" class="pill" type="button" title="Start the Pit Guru quick tour"><span>Quick tour</span></button>
                <button id="mpgSettingsClose" class="pill mpg-settings-close" type="button" title="Close Settings"><span>x</span></button>
              </div>
            </div>
            <div class="mpg-settings-body">
              <div id="mpgSettingsPanel" class="mpg-settings-grid"></div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener("mousedown", e => {
            if (e.target !== modal) return;
            settingsOpen = false;
            uiDirty = true;
            scheduleRender_();
        });
        modal.querySelector("#mpgSettingsClose").onclick = () => {
            settingsOpen = false;
            uiDirty = true;
            scheduleRender_();
        };
        modal.querySelector("#mpgSettingsTour").onclick = startTutorial_;
        document.addEventListener("keydown", e => {
            if (e.key !== "Escape" || !settingsOpen) return;
            settingsOpen = false;
            uiDirty = true;
            scheduleRender_();
        });
        return modal;
    }

    function renderSettingsPanel_() {
        const modal = ensureSettingsModal_();
        const panel = document.getElementById("mpgSettingsPanel");
        if (!modal || !panel) return;
        modal.style.display = settingsOpen ? "flex" : "none";
        if (!settingsOpen) return;
        const key = [
            theme, allowPreFinishPreview ? 1 : 0, speedUnit, updateRateMs, telemetrySmoothing,
            debugEnabled ? 1 : 0, enablePredictions ? 1 : 0, useHistoryPredictions ? 1 : 0, useApiPredictions ? 1 : 0,
            apiKey ? maskApiKey_(apiKey) : "nokey", apiKeyVisible ? 1 : 0, apiKeyCheckActive ? 1 : 0,
            JSON.stringify(apiKeyInfo || {}), apiKeyStatus, driverIntelFetchActive ? 1 : 0, driverIntelStatus,
            recordsOpen ? 1 : 0, recordsDetached ? 1 : 0, clearOnRaceChange ? 1 : 0,
            fuelEnabled ? 1 : 0, fuelDisplayStyle, liveCommentaryEnabled ? 1 : 0, pitCrewEnabled ? 1 : 0, experimentalGyroTrace ? 1 : 0,
            performancePreset, visibleRaceScanMs, participantScanMs, driverIdLookupMs, driverIntelSettleMs, participantScanRepeat, focusedRowWindowEachSide,
            heavyRaceDebugLine_()
        ].join("|");
        if (panel.dataset.renderKey === key && panel.children.length) return;
        const active = document.activeElement;
        if (panel.contains(active) && /^(INPUT|SELECT|TEXTAREA)$/i.test(active?.tagName || "")) return;
        panel.dataset.renderKey = key;
        const keyInput = apiKeyVisible || !apiKey
            ? `<input id="mpgApiKey" type="${apiKeyVisible ? "text" : "password"}" autocomplete="off" value="${escAttr_(apiKey)}" placeholder="Torn API key">`
            : `<input id="mpgApiKey" type="text" readonly value="${escAttr_(maskApiKey_(apiKey))}" title="Click View to reveal or edit">`;
        panel.innerHTML = `
          <section class="mpg-settings-section wide">
            <div class="mpg-section-head"><h3>API & Driver Intel</h3><p>Key is saved locally and checked with Torn on refresh. Driver Intel fetches automatically before races and when race JSON appears.</p></div>
            <div class="mpg-setting-row">
              <div class="mpg-setting-label">API key</div>
              <div class="mpg-api-key-control">
                ${keyInput}
                <button id="mpgToggleApiKey" class="pill" type="button">${apiKeyVisible ? "Hide" : "View"}</button>
                <button id="mpgCheckKey" class="pill" type="button"${apiKeyCheckActive ? " disabled" : ""}>Check key</button>
              </div>
            </div>
            <div class="mpg-setting-row">
              <div class="mpg-setting-label">Key access</div>
              <div class="mpg-key-details">${apiKeyInfoHtml_()}</div>
            </div>
            <div class="mpg-setting-actions">
              <button id="mpgRefreshMissingIntel" class="pill" type="button"${driverIntelFetchActive || !apiKey ? " disabled" : ""}>Refresh Driver Profiles</button>
              <button id="mpgClearIntel" class="pill" type="button">Clear Intel Cache</button>
              <span class="muted">${esc_(driverIntelStatus || apiKeyStatus || "One API call per uncached driver. Manual driver-list fetching was removed because this now runs automatically.")}</span>
            </div>
          </section>

          <section class="mpg-settings-section">
            <div class="mpg-section-head"><h3>Analysis Display</h3><p>Controls how live and replay telemetry is rendered.</p></div>
            <div class="mpg-setting-row"><label for="mpgThemeSelect">Theme</label><select id="mpgThemeSelect">${THEMES.map(t => `<option value="${escAttr_(t.key)}"${theme === t.key ? " selected" : ""}>${esc_(t.name)}</option>`).join("")}</select></div>
            <div class="mpg-setting-row"><label for="mpgSpeedUnit">Speed unit</label><select id="mpgSpeedUnit"><option value="kmh"${speedUnit === "kmh" ? " selected" : ""}>km/h</option><option value="mph"${speedUnit === "mph" ? " selected" : ""}>mph</option></select></div>
            <div class="mpg-setting-row"><label for="mpgUpdateRate">Update rate</label><select id="mpgUpdateRate">${[100,250,500,1000].map(v => `<option value="${v}"${updateRateMs === v ? " selected" : ""}>${v}ms</option>`).join("")}</select></div>
            <div class="mpg-setting-row"><label for="mpgSmoothing">Telemetry smoothing</label><select id="mpgSmoothing">${[1,2,3,5].map(v => `<option value="${v}"${telemetrySmoothing === v ? " selected" : ""}>${v} segment${v > 1 ? "s" : ""}</option>`).join("")}</select></div>
            <label class="mpg-checkline"><input id="mpgAllowPreview" type="checkbox"${allowPreFinishPreview ? " checked" : ""}> Allow pre-finish result preview</label>
          </section>

          <section class="mpg-settings-section">
            <div class="mpg-section-head"><h3>Predictions</h3><p>Forecasts are pre-race only and separate from delivered race results.</p></div>
            <label class="mpg-checkline"><input id="mpgEnablePredictions" type="checkbox"${enablePredictions ? " checked" : ""}> Enable pre-race predictions</label>
            <label class="mpg-checkline"><input id="mpgUseHistoryPredictions" type="checkbox"${useHistoryPredictions ? " checked" : ""}> Use local history in predictions</label>
            <label class="mpg-checkline"><input id="mpgUseApiPredictions" type="checkbox"${useApiPredictions ? " checked" : ""}> Use API Driver Intel in predictions</label>
          </section>

          <section class="mpg-settings-section wide">
            <div class="mpg-section-head"><h3>Performance & Scan Timers</h3><p>Controls how often Pit Guru re-checks Torn's visible race page while keeping predictions responsive.</p></div>
            <div class="mpg-setting-row"><label for="mpgPerfPreset">Preset</label><select id="mpgPerfPreset"><option value="balanced"${performancePreset === "balanced" ? " selected" : ""}>Balanced</option><option value="fast"${performancePreset === "fast" ? " selected" : ""}>Fast</option><option value="eco"${performancePreset === "eco" ? " selected" : ""}>Eco</option><option value="once"${performancePreset === "once" ? " selected" : ""}>Once</option><option value="custom"${performancePreset === "custom" ? " selected" : ""}>Custom</option></select></div>
            <div class="mpg-setting-row"><label for="mpgVisibleRaceScanMs">Visible race/meta scan</label><input id="mpgVisibleRaceScanMs" type="number" min="250" max="30000" step="250" value="${visibleRaceScanMs}"></div>
            <p class="mpg-section-note">Scans Torn race panels for Race ID, visible track/race text, countdown/lap/completion text, and race links only while this tab is visible and focused. Current: every ${(visibleRaceScanMs / 1000).toFixed(2)}s.</p>
            <div class="mpg-setting-row"><label for="mpgParticipantScanMs">Participant grid scan</label><input id="mpgParticipantScanMs" type="number" min="500" max="60000" step="250" value="${participantScanMs}"></div>
            <p class="mpg-section-note">Scans Torn participant/leaderboard rows for driver names, profile links/IDs, car names, and car images only while this tab is visible and focused. Current: every ${(participantScanMs / 1000).toFixed(2)}s while allowed by repeat mode.</p>
            <div class="mpg-setting-row"><label for="mpgParticipantScanRepeat">Grid repetition</label><select id="mpgParticipantScanRepeat"><option value="continuous"${participantScanRepeat === "continuous" ? " selected" : ""}>Continuous</option><option value="twice"${participantScanRepeat === "twice" ? " selected" : ""}>Twice per race</option><option value="once"${participantScanRepeat === "once" ? " selected" : ""}>Once per race</option></select></div>
            <div class="mpg-setting-row"><label for="mpgFocusWindowEachSide">Drivers drawn around focus</label><select id="mpgFocusWindowEachSide">${[3,5,7,10,15,25].map(v => `<option value="${v}"${focusedRowWindowEachSide === v ? " selected" : ""}>${v} ahead / ${v} behind (${(v * 2) + 1} rows)</option>`).join("")}</select></div>
            <p class="mpg-section-note">Large-field tables still keep the full race in memory, but only draw this focused row window in the DOM. Smaller values are better for 50-100 driver races.</p>
            <div class="mpg-setting-row"><label for="mpgDriverIdLookupMs">Profile-ID lookup cache</label><input id="mpgDriverIdLookupMs" type="number" min="1000" max="120000" step="500" value="${driverIdLookupMs}"></div>
            <p class="mpg-section-note">When a visible row lacks an ID, Pit Guru searches nearby profile/data attributes by driver name only while focused, then reuses positive or negative results for ${(driverIdLookupMs / 1000).toFixed(2)}s.</p>
            <div class="mpg-setting-row"><label for="mpgDriverIntelSettleMs">Driver Intel settle delay</label><input id="mpgDriverIntelSettleMs" type="number" min="500" max="30000" step="250" value="${driverIntelSettleMs}"></div>
            <p class="mpg-section-note">After the detected profile-ID pool changes, Pit Guru waits ${(driverIntelSettleMs / 1000).toFixed(2)}s before API calls so official/custom grids can finish joining.</p>
          </section>

          <section class="mpg-settings-section">
            <div class="mpg-section-head"><h3>Records & Cleanup</h3><p>Records stay saved separately from live container data.</p></div>
            <label class="mpg-checkline"><input id="mpgShowBottomRecords" type="checkbox"${recordsOpen && !recordsDetached ? " checked" : ""}> Show Records under Pit Guru</label>
            <label class="mpg-checkline"><input id="mpgAutoClearRace" type="checkbox"${clearOnRaceChange ? " checked" : ""}> Auto-clear view on race ID change</label>
            <p class="mpg-section-note">Use the Records button for quick hide/show and Pop out to move Records into its own window.</p>
          </section>

          <section class="mpg-settings-section">
            <div class="mpg-section-head"><h3>Advanced</h3><p>Diagnostics and script behavior.</p></div>
            <label class="mpg-checkline"><input id="mpgDebug" type="checkbox"${debugEnabled ? " checked" : ""}> Debug logging</label>
            <p class="mpg-section-note mono">${esc_(heavyRaceDebugLine_())}</p>
            <p class="mpg-section-note">Pit Guru analyses data delivered to the current Torn racing page. It does not use external servers. Speed and G values are estimated from segment timing and official track distance.</p>
          </section>

          <section class="mpg-settings-section">
            <div class="mpg-section-head"><h3>Experimental</h3><p>Features that are useful but still approximate.</p></div>
            <label class="mpg-checkline"><input id="mpgExperimentalGyroTrace" type="checkbox"${experimentalGyroTrace ? " checked" : ""}> 5-second G-force trace</label>
            <label class="mpg-checkline"><input id="mpgFuelEnabled" type="checkbox"${fuelEnabled ? " checked" : ""}> Fuel Consumption: ${fuelEnabled ? "Enabled" : "Disabled"}</label>
            <div class="mpg-setting-row"><label for="mpgFuelStyle">Fuel display</label><select id="mpgFuelStyle"><option value="l100km"${fuelDisplayStyle === "l100km" ? " selected" : ""}>L/100km</option><option value="mpg_uk"${fuelDisplayStyle === "mpg_uk" ? " selected" : ""}>mpg UK</option><option value="mpg_us"${fuelDisplayStyle === "mpg_us" ? " selected" : ""}>mpg US</option></select></div>
            <p class="mpg-section-note">Fuel uses approximate real-model baselines with a racing load multiplier, so treat it as flavour telemetry.</p>
          </section>

          <section class="mpg-settings-section">
            <div class="mpg-section-head"><h3>Fun</h3><p>Race-day flavour for the overlay.</p></div>
            <label class="mpg-checkline"><input id="mpgLiveCommentary" type="checkbox"${liveCommentaryEnabled ? " checked" : ""}> TV commentary</label>
            <label class="mpg-checkline"><input id="mpgPitCrew" type="checkbox"${pitCrewEnabled ? " checked" : ""}> Pit crew strategy messages</label>
            <p class="mpg-section-note">Commentary has a minimum 5-second cooldown and uses current replay/live positions.</p>
          </section>
        `;
        panel.querySelector("#mpgThemeSelect").onchange = e => { theme = String(e.target.value || "classic"); saveTheme_(); applyTheme_(); uiDirty = true; scheduleRender_(); };
        panel.querySelector("#mpgAllowPreview").onchange = e => { allowPreFinishPreview = !!e.target.checked; saveAllowPreview_(); uiDirty = true; scheduleRender_(); };
        panel.querySelector("#mpgSpeedUnit").onchange = e => { speedUnit = String(e.target.value || "kmh") === "mph" ? "mph" : "kmh"; saveSpeedUnit_(); uiDirty = true; scheduleRender_(); };
        panel.querySelector("#mpgUpdateRate").onchange = e => { updateRateMs = Number(e.target.value) || 250; saveUpdateRate_(); };
        panel.querySelector("#mpgSmoothing").onchange = e => { telemetrySmoothing = Number(e.target.value) || 3; saveSmoothing_(); uiDirty = true; scheduleRender_(); };
        panel.querySelector("#mpgDebug").onchange = e => { debugEnabled = !!e.target.checked; saveDebug_(); uiDirty = true; scheduleRender_(); };
        panel.querySelector("#mpgEnablePredictions").onchange = e => { enablePredictions = !!e.target.checked; saveBoolSetting_(STORE_ENABLE_PREDICTIONS_KEY, enablePredictions); uiDirty = true; scheduleRender_(); };
        panel.querySelector("#mpgUseHistoryPredictions").onchange = e => { useHistoryPredictions = !!e.target.checked; saveBoolSetting_(STORE_USE_HISTORY_PREDICTIONS_KEY, useHistoryPredictions); uiDirty = true; scheduleRender_(); };
        panel.querySelector("#mpgUseApiPredictions").onchange = e => { useApiPredictions = !!e.target.checked; saveBoolSetting_(STORE_USE_API_PREDICTIONS_KEY, useApiPredictions); uiDirty = true; scheduleRender_(); };
        const markPerfCustom = () => {
            performancePreset = "custom";
            savePerformancePreset_();
            resetScanCaches_();
            uiDirty = true;
            scheduleRender_();
        };
        panel.querySelector("#mpgPerfPreset").onchange = e => {
            const next = String(e.target.value || "balanced");
            if (next === "custom") {
                performancePreset = "custom";
                savePerformanceTuning_();
            } else {
                applyPerformancePreset_(next, true);
            }
            uiDirty = true; scheduleRender_();
        };
        panel.querySelector("#mpgVisibleRaceScanMs").onchange = e => { visibleRaceScanMs = Math.round(clamp_(Number(e.target.value) || visibleRaceScanMs, 250, 30000)); saveIntSetting_(STORE_VISIBLE_RACE_SCAN_MS_KEY, visibleRaceScanMs); markPerfCustom(); };
        panel.querySelector("#mpgParticipantScanMs").onchange = e => { participantScanMs = Math.round(clamp_(Number(e.target.value) || participantScanMs, 500, 60000)); saveIntSetting_(STORE_PARTICIPANT_SCAN_MS_KEY, participantScanMs); markPerfCustom(); };
        panel.querySelector("#mpgFocusWindowEachSide").onchange = e => { focusedRowWindowEachSide = Math.round(clamp_(Number(e.target.value) || DEFAULT_FOCUSED_ROW_WINDOW_EACH_SIDE, 1, 25)); saveIntSetting_(STORE_FOCUSED_ROW_WINDOW_EACH_SIDE_KEY, focusedRowWindowEachSide); markPerfCustom(); };
        panel.querySelector("#mpgDriverIdLookupMs").onchange = e => { driverIdLookupMs = Math.round(clamp_(Number(e.target.value) || driverIdLookupMs, 1000, 120000)); saveIntSetting_(STORE_DRIVER_ID_LOOKUP_MS_KEY, driverIdLookupMs); markPerfCustom(); };
        panel.querySelector("#mpgDriverIntelSettleMs").onchange = e => { driverIntelSettleMs = Math.round(clamp_(Number(e.target.value) || driverIntelSettleMs, 500, 30000)); saveIntSetting_(STORE_DRIVER_INTEL_SETTLE_MS_KEY, driverIntelSettleMs); markPerfCustom(); };
        panel.querySelector("#mpgParticipantScanRepeat").onchange = e => {
            participantScanRepeat = String(e.target.value || "continuous");
            if (!["continuous", "twice", "once"].includes(participantScanRepeat)) participantScanRepeat = "continuous";
            saveParticipantScanRepeat_();
            markPerfCustom();
        };
        panel.querySelector("#mpgToggleApiKey").onclick = () => { apiKeyVisible = !apiKeyVisible; uiDirty = true; scheduleRender_(); };
        panel.querySelector("#mpgCheckKey").onclick = () => {
            const input = panel.querySelector("#mpgApiKey");
            apiKey = String(input && !input.readOnly ? input.value : apiKey || "").trim();
            saveApiKey_();
            checkApiKeyInfo_({ manual: true });
        };
        panel.querySelector("#mpgApiKey").onchange = e => {
            if (!apiKeyVisible && apiKey) return;
            const next = String(e.target.value || "").trim();
            if (next === apiKey) return;
            apiKey = next;
            apiKeyInfo = {};
            saveApiKey_();
            saveApiKeyInfo_();
            apiKeyStatus = apiKey ? "API key saved locally. Checking key access..." : "API key cleared.";
            if (apiKey) checkApiKeyInfo_({ manual: false });
            uiDirty = true; scheduleRender_();
        };
        panel.querySelector("#mpgRefreshMissingIntel").onclick = () => {
            if (!apiKey) {
                driverIntelStatus = "Add an API key first.";
                uiDirty = true; scheduleRender_();
                return;
            }
            driverIntelAutoRaceKey = "";
            driverIntelStatus = "Refreshing current driver profiles...";
            uiDirty = true; scheduleRender_();
            fetchDriverIntelPool_(false);
        };
        panel.querySelector("#mpgClearIntel").onclick = () => { driverIntelCache = {}; saveDriverIntelCache_(); driverIntelStatus = "Driver Intel cache cleared."; if (analysis?.drivers) analysis.drivers.forEach(d => { d.driverIntel = null; }); uiDirty = true; scheduleRender_(); };
        panel.querySelector("#mpgShowBottomRecords").onchange = e => {
            recordsOpen = !!e.target.checked;
            recordsDetached = false;
            saveRecordsOpen_();
            saveRecordsDetached_();
            uiDirty = true; scheduleRender_();
        };
        panel.querySelector("#mpgAutoClearRace").onchange = e => {
            clearOnRaceChange = !!e.target.checked;
            saveClearOnRaceChange_(clearOnRaceChange);
            uiDirty = true; scheduleRender_();
        };
        panel.querySelector("#mpgExperimentalGyroTrace").onchange = e => { experimentalGyroTrace = !!e.target.checked; saveBoolSetting_(STORE_EXPERIMENTAL_GYRO_TRACE_KEY, experimentalGyroTrace); uiDirty = true; scheduleRender_(); };
        panel.querySelector("#mpgFuelEnabled").onchange = e => { fuelEnabled = !!e.target.checked; saveBoolSetting_(STORE_FUEL_ENABLED_KEY, fuelEnabled); uiDirty = true; scheduleRender_(); };
        panel.querySelector("#mpgFuelStyle").onchange = e => { fuelDisplayStyle = String(e.target.value || "l100km"); saveFuelStyle_(); uiDirty = true; scheduleRender_(); };
        panel.querySelector("#mpgLiveCommentary").onchange = e => {
            liveCommentaryEnabled = !!e.target.checked;
            if (!liveCommentaryEnabled) {
                lastCommentaryText = "";
                lastCommentaryKey = "";
                lastCommentaryAtMs = 0;
            }
            saveBoolSetting_(STORE_COMMENTARY_ENABLED_KEY, liveCommentaryEnabled);
            uiDirty = true;
            scheduleRender_();
        };
        panel.querySelector("#mpgPitCrew").onchange = e => {
            pitCrewEnabled = !!e.target.checked;
            if (!pitCrewEnabled) {
                lastTeamRadioText = "";
                lastTeamRadioKey = "";
                lastTeamRadioAtMs = 0;
            }
            saveBoolSetting_(STORE_PIT_CREW_ENABLED_KEY, pitCrewEnabled);
            uiDirty = true;
            scheduleRender_();
        };
        focusFirstRunApiKey_();
        if (tutorialActive) requestAnimationFrame(positionTutorial_);
    }

    function garageTornCarImage_(itemId) {
        const id = String(itemId || "").trim();
        return id ? cachedOptionalImageUrl_("item", id, `https://www.torn.com/images/items/${encodeURIComponent(id)}/large.png`) : "";
    }

    function garageHostedCarImage_(itemId) {
        const id = String(itemId || "").trim();
        return id ? cachedOptionalImageUrl_("hosted-item", `${pgPlayerBase_()}:${id}`, pgPlayerUrl_(`/assets/cars/${encodeURIComponent(id)}.png`)) : "";
    }

    function garageCatalogByItem_() {
        const map = new Map();
        for (const c of garageCatalog || []) {
            const id = String(c.item_id || c.itemID || c.itemId || "").trim();
            if (id) map.set(id, c);
        }
        return map;
    }

    function carImageFromCatalog_(carName) {
        const wanted = toOgCarName_(carName || "").toLowerCase();
        if (!wanted) return "";
        const row = (garageCatalog || []).find(c => toOgCarName_(c.name || c.display_name || c.torn_name || "").toLowerCase() === wanted);
        return String(row?.hosted_image_url || row?.hostedImageUrl || (row?.item_id ? garageHostedCarImage_(row.item_id) : "") || row?.image_url || row?.imageUrl || (row?.item_id ? garageTornCarImage_(row.item_id) : "") || "").trim();
    }

    async function pgLocalEnsureCarCatalog_(force = false) {
        if (!force && garageCatalog.length && Date.now() - garageCatalogLastFetchAt < 10 * 60 * 1000) return garageCatalog;
        try {
            const result = await pgLocalFetchCars();
            if (Array.isArray(result?.cars)) {
                garageCatalog = result.cars;
                garageCatalogLastFetchAt = Date.now();
                uiDirty = true; scheduleRender_();
            }
        } catch { }
        return garageCatalog;
    }

    function parseJsonArray_(value) {
        if (Array.isArray(value)) return value;
        if (!value) return [];
        try {
            const parsed = JSON.parse(String(value));
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function normalizeGarageCar_(raw = {}, ownerId = "") {
        const itemId = String(raw.car_item_id || raw.item_id || raw.itemID || raw.itemId || raw.carItemID || raw.carItemId || "").trim();
        const catalog = garageCatalogByItem_().get(itemId) || {};
        const tornName = String(raw.car_item_name || raw.torn_name || raw.tornName || raw.carTitle || raw.car_title || catalog.torn_name || "").trim();
        const name = toOgCarName_(raw.car || raw.ogName || raw.og_name || raw.display_name || raw.displayName || catalog.name || tornName || (!raw.car_item_name ? raw.name : "") || "");
        const nickname = String(raw.nickname || raw.car_name || raw.carName || (raw.car_item_name ? raw.name : "") || "").trim();
        const enlistedCarId = String(raw.enlisted_car_id || raw.enlistedCarId || raw.id || raw.ID || raw.carID || raw.carId || "").trim();
        const imageUrl = String(raw.hosted_image_url || raw.hostedImageUrl || catalog.hosted_image_url || catalog.hostedImageUrl || garageHostedCarImage_(itemId) || raw.image_url || raw.imageUrl || raw.carImg || raw.carImage || catalog.image_url || garageTornCarImage_(itemId) || "").trim();
        const manufacturerFuelL100 = safeNum_(raw.fuel_l100km ?? raw.fuelL100Km ?? catalog.fuel_l100km ?? FUEL_BASE_L100KM[name] ?? FUEL_BASE_L100KM[toOgCarName_(tornName)], NaN);
        const parts = parseJsonArray_(raw.upgrades_json || raw.parts || raw.upgrades);
        const val = key => safeNum_(raw[key], NaN);
        const stock = key => safeNum_(catalog[key] ?? catalog[key.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`)], NaN);
        const topSpeedValue = safeNum_(raw.top_speed ?? raw.topSpeed ?? raw.topspeed, NaN);
        const accelerationValue = val("acceleration");
        const brakingValue = val("braking");
        const handlingValue = val("handling");
        const tarmacValue = val("tarmac");
        const dirtValue = val("dirt");
        const safetyValue = val("safety");
        const stockTopSpeed = stock("topSpeed");
        const stockAcceleration = stock("acceleration");
        const stockBraking = stock("braking");
        const stockHandling = stock("handling");
        const stockTarmac = stock("tarmac");
        const stockDirt = stock("dirt");
        const stockSafety = stock("safety");
        return {
            enlistedCarId,
            ownerId: String(raw.owner_id || raw.ownerId || raw.userID || raw.userId || ownerId || "").trim(),
            itemID: itemId,
            tornName,
            car: name,
            name,
            nickname,
            carClass: String(raw.class || raw.car_class || raw.carClass || catalog.car_class || "").trim(),
            racingClass: raw.racing_class ?? raw.racingClass ?? catalog.racing_class ?? null,
            imageUrl,
            mileage: safeNum_(raw.computed_mileage_km ?? raw.mileage_km ?? raw.mileageKm ?? raw.mileage ?? raw.miles ?? raw.distance, NaN),
            computedMileageKm: safeNum_(raw.computed_mileage_km ?? raw.computedMileageKm, NaN),
            manufacturerFuelL100,
            worth: safeNum_(raw.worth, NaN),
            pointsSpent: safeNum_(raw.points_spent ?? raw.pointsSpent, NaN),
            racesEntered: safeNum_(raw.races_entered ?? raw.racesEntered, NaN),
            racesWon: safeNum_(raw.races_won ?? raw.racesWon, NaN),
            isRemoved: raw.is_removed === true || raw.isRemoved === true || Number(raw.is_removed || raw.isRemoved || 0) === 1,
            parts,
            upgrades: parts,
            topSpeed: topSpeedValue,
            acceleration: accelerationValue,
            braking: brakingValue,
            handling: handlingValue,
            tarmac: tarmacValue,
            dirt: dirtValue,
            safety: safetyValue,
            topSpeedBase: stockTopSpeed,
            accelerationBase: stockAcceleration,
            brakingBase: stockBraking,
            handlingBase: stockHandling,
            tarmacBase: stockTarmac,
            dirtBase: stockDirt,
            safetyBase: stockSafety,
            topSpeedBonus: Number.isFinite(topSpeedValue) && Number.isFinite(stockTopSpeed) ? topSpeedValue - stockTopSpeed : NaN,
            accelerationBonus: Number.isFinite(accelerationValue) && Number.isFinite(stockAcceleration) ? accelerationValue - stockAcceleration : NaN,
            brakingBonus: Number.isFinite(brakingValue) && Number.isFinite(stockBraking) ? brakingValue - stockBraking : NaN,
            handlingBonus: Number.isFinite(handlingValue) && Number.isFinite(stockHandling) ? handlingValue - stockHandling : NaN,
            tarmacBonus: Number.isFinite(tarmacValue) && Number.isFinite(stockTarmac) ? tarmacValue - stockTarmac : NaN,
            dirtBonus: Number.isFinite(dirtValue) && Number.isFinite(stockDirt) ? dirtValue - stockDirt : NaN,
            safetyBonus: Number.isFinite(safetyValue) && Number.isFinite(stockSafety) ? safetyValue - stockSafety : NaN,
            source: String(raw.source || "").trim()
        };
    }

    function mergeGarageCars_(localCars, apiCars) {
        const byId = new Map();
        for (const car of [...(localCars || []), ...(apiCars || [])]) {
            const normalized = normalizeGarageCar_(car, car.ownerId || apiKeyInfo?.userId || "");
            const key = normalized.enlistedCarId || `item:${normalized.itemID}:${normalized.nickname || normalized.car}`;
            if (!key) continue;
            const prev = byId.get(key) || {};
            const merged = Object.assign({}, prev, normalized, {
                parts: normalized.parts.length ? normalized.parts : (prev.parts || []),
                upgrades: normalized.parts.length ? normalized.parts : (prev.upgrades || []),
                imageUrl: normalized.imageUrl || prev.imageUrl || "",
                car: normalized.car || prev.car || "",
                name: normalized.name || prev.name || "",
                carClass: normalized.carClass || prev.carClass || ""
            });
            for (const field of ["mileage", "computedMileageKm", "worth", "pointsSpent", "racesEntered", "racesWon"]) {
                if (!Number.isFinite(normalized[field]) && Number.isFinite(prev[field])) merged[field] = prev[field];
            }
            byId.set(key, merged);
        }
        return Array.from(byId.values()).sort((a, b) => {
            const ar = a.isRemoved ? 1 : 0;
            const br = b.isRemoved ? 1 : 0;
            if (ar !== br) return ar - br;
            return String(a.car || "").localeCompare(String(b.car || "")) || String(a.nickname || "").localeCompare(String(b.nickname || ""));
        });
    }

    function garageHash_(value) {
        const text = String(value || "");
        let hash = 0;
        for (let i = 0; i < text.length; i += 1) {
            hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
        }
        return Math.abs(hash).toString(36);
    }

    function garagePartKey_(part) {
        if (part && typeof part === "object") {
            const value = part.id ?? part.ID ?? part.upgrade_id ?? part.upgradeId ?? part.item_id ?? part.itemId ?? part.part_id ?? part.partId ?? part.name ?? part.title;
            return String(value || "").trim();
        }
        return String(part || "").trim();
    }

    function garagePartName_(part) {
        if (part && typeof part === "object") {
            return String(part.name || part.title || part.upgrade_name || part.upgradeName || part.label || "").trim();
        }
        return "";
    }

    function garagePartsByKey_(parts) {
        const map = new Map();
        for (const part of parseJsonArray_(parts)) {
            const key = garagePartKey_(part);
            if (!key) continue;
            map.set(key, {
                key,
                name: garagePartName_(part),
                raw: part
            });
        }
        return map;
    }

    function garagePartKeys_(parts) {
        return Array.from(garagePartsByKey_(parts).keys()).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    }

    function garageSnapshotForDiff_(car) {
        const normalized = normalizeGarageCar_(car, car.ownerId || apiKeyInfo?.userId || "");
        const stats = {
            topSpeed: Number.isFinite(safeNum_(normalized.topSpeed, NaN)) ? safeNum_(normalized.topSpeed, NaN) : null,
            acceleration: Number.isFinite(safeNum_(normalized.acceleration, NaN)) ? safeNum_(normalized.acceleration, NaN) : null,
            braking: Number.isFinite(safeNum_(normalized.braking, NaN)) ? safeNum_(normalized.braking, NaN) : null,
            handling: Number.isFinite(safeNum_(normalized.handling, NaN)) ? safeNum_(normalized.handling, NaN) : null,
            safety: Number.isFinite(safeNum_(normalized.safety, NaN)) ? safeNum_(normalized.safety, NaN) : null,
            dirt: Number.isFinite(safeNum_(normalized.dirt, NaN)) ? safeNum_(normalized.dirt, NaN) : null,
            tarmac: Number.isFinite(safeNum_(normalized.tarmac, NaN)) ? safeNum_(normalized.tarmac, NaN) : null
        };
        return Object.assign({}, normalized, {
            partMap: garagePartsByKey_(normalized.parts),
            partKeys: garagePartKeys_(normalized.parts),
            stats
        });
    }

    function deriveGarageSnapshotEvents_(previousCars, currentCars, ownerId = "") {
        const previousById = new Map();
        for (const raw of previousCars || []) {
            const car = garageSnapshotForDiff_(raw);
            if (car.enlistedCarId) previousById.set(String(car.enlistedCarId), car);
        }
        if (!previousById.size) return [];

        const nowMs = Date.now();
        const nowTs = Math.floor(nowMs / 1000);
        const nowIso = new Date(nowMs).toISOString();
        const events = [];

        for (const raw of currentCars || []) {
            const current = garageSnapshotForDiff_(raw);
            const carId = String(current.enlistedCarId || "");
            if (!carId) continue;
            const previous = previousById.get(carId);
            if (!previous) continue;

            const beforeKeys = previous.partKeys || [];
            const afterKeys = current.partKeys || [];
            const before = new Set(beforeKeys);
            const after = new Set(afterKeys);
            const signature = `${carId}|${beforeKeys.join(",")}>${afterKeys.join(",")}|${JSON.stringify(previous.stats || {})}>${JSON.stringify(current.stats || {})}`;

            const emit = (action, key, part, index) => {
                const isAdd = action === "ADD";
                events.push({
                    eventId: `SNAP|${carId}|${action}|${key}|${nowTs}|${garageHash_(signature + "|" + action + "|" + key + "|" + index)}`,
                    enlistedCarId: carId,
                    ownerId: current.ownerId || ownerId || "",
                    itemID: current.itemID || previous.itemID || "",
                    logTypeId: isAdd ? 8705 : 8706,
                    eventType: isAdd ? "Snapshot Install Upgrade" : "Snapshot Remove Upgrade",
                    upgradeId: key,
                    upgradeName: part?.name || `Upgrade ${key}`,
                    delta: isAdd ? 1 : -1,
                    timestamp: nowTs,
                    eventAt: nowIso,
                    raw: {
                        source: "enlisted-cars-snapshot-diff",
                        before: {
                            enlistedCarId: previous.enlistedCarId,
                            itemID: previous.itemID,
                            car: previous.car,
                            nickname: previous.nickname,
                            parts: beforeKeys,
                            stats: previous.stats
                        },
                        after: {
                            enlistedCarId: current.enlistedCarId,
                            itemID: current.itemID,
                            car: current.car,
                            nickname: current.nickname,
                            parts: afterKeys,
                            stats: current.stats
                        }
                    }
                });
            };

            afterKeys.forEach((key, index) => {
                if (!before.has(key)) emit("ADD", key, current.partMap.get(key), index);
            });
            beforeKeys.forEach((key, index) => {
                if (!after.has(key)) emit("REMOVE", key, previous.partMap.get(key), index);
            });
        }

        return events;
    }

    async function fetchGarageEnlistedCars_() {
        if (!apiKey) throw new Error("Add an API key in Settings first.");
        const json = await gmRequestJson_(`https://api.torn.com/v2/user/enlistedcars?comment=MRG&key=${encodeURIComponent(apiKey)}`);
        if (json?.error) throw new Error(json.error.error || json.error.code || "Torn API error");
        return Array.isArray(json.enlistedcars) ? json.enlistedcars : [];
    }

    async function fetchGarageStockCars_() {
        if (!apiKey) throw new Error("Add an API key in Settings first.");
        const json = await gmRequestJson_(`https://api.torn.com/v2/racing/cars?comment=MRG&key=${encodeURIComponent(apiKey)}`);
        if (json?.error) throw new Error(json.error.error || json.error.code || "Torn racing cars API error");
        return Array.isArray(json.cars) ? json.cars : [];
    }

    function garageCatalogMissingStockStats_() {
        const rows = Array.isArray(garageCatalog) ? garageCatalog : [];
        if (rows.length < 45) return true;
        return rows.some(c => !Number.isFinite(Number(c.top_speed ?? c.topSpeed ?? c.topspeed)));
    }

    async function refreshGarageStockCatalog_(force = false) {
        if (!apiKey) return false;
        const now = Date.now();
        if (!force && !garageCatalogMissingStockStats_() && now - garageCatalogLastFetchAt < 12 * 60 * 60 * 1000) return false;
        const stockCars = await fetchGarageStockCars_();
        if (!stockCars.length) return false;
        await pgLocalUpsertCars(stockCars).catch(() => {});
        garageCatalog = stockCars.map(c => Object.assign({}, c, {
            item_id: c.car_item_id,
            torn_name: c.car_item_name,
            name: toOgCarName_(c.car_item_name || ""),
            car_class: c.class,
            image_url: garageTornCarImage_(c.car_item_id),
            stock_source: "torn-racing-cars"
        }));
        garageCatalogLastFetchAt = now;
        return true;
    }

    function garageEventTypeForLog_(logTypeId, fallback = "") {
        const id = Number(logTypeId);
        if (id === 8700) return "Enlist car";
        if (id === 8701) return "Delist car";
        if (id === 8705) return "Install Upgrade";
        if (id === 8706) return "Remove Upgrade";
        if (id === 8735) return "Crash Lost Upgrade";
        return fallback || String(logTypeId || "");
    }

    function resolveGarageEventCarId_(itemId, upgradeId) {
        const id = String(itemId || "").trim();
        if (!id) return "";
        const matches = garageCars.filter(c => String(c.itemID || "") === id && !c.isRemoved);
        if (matches.length === 1) return matches[0].enlistedCarId || "";
        const uid = String(upgradeId || "").trim();
        if (uid) {
            const partHits = matches.filter(c => (c.parts || []).map(String).includes(uid));
            if (partHits.length === 1) return partHits[0].enlistedCarId || "";
        }
        return "";
    }

    function normalizeGarageLogEntry_(entry = {}) {
        const logTypeId = Number(entry.details?.id ?? entry.logTypeId ?? entry.log_type_id ?? 0);
        const data = Object.assign({}, entry.params || {}, entry.data || {});
        const carItemId = String(data.car ?? data.car_item_id ?? data.item_id ?? "").trim();
        const ts = Number(entry.timestamp || entry.event_ts || 0);
        const base = {
            ownerId: apiKeyInfo?.userId || "",
            itemID: carItemId,
            logTypeId,
            eventType: garageEventTypeForLog_(logTypeId, entry.details?.title || ""),
            timestamp: Number.isFinite(ts) && ts > 0 ? ts : null,
            eventAt: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString() : "",
            raw: entry
        };
        const out = [];
        if (logTypeId === 8735) {
            let lost = [];
            if (Array.isArray(data.upgrades_lost)) lost = data.upgrades_lost;
            else if (Array.isArray(data.upgrades)) lost = data.upgrades;
            else if (data.upgrade != null) lost = [data.upgrade];
            if (!lost.length) lost = [""];
            lost.forEach(uid => {
                const upgradeId = String(uid || "").trim();
                out.push(Object.assign({}, base, {
                    eventId: `${entry.id || ts}|CR|${upgradeId}`,
                    enlistedCarId: resolveGarageEventCarId_(carItemId, upgradeId),
                    upgradeId,
                    delta: -1
                }));
            });
            return out;
        }
        const upgradeId = String(data.upgrade ?? "").trim();
        out.push(Object.assign({}, base, {
            eventId: String(entry.id || `${ts}|${logTypeId}|${carItemId}|${upgradeId}`),
            enlistedCarId: resolveGarageEventCarId_(carItemId, upgradeId),
            upgradeId,
            pointsCost: safeNum_(String(data.racing_points ?? "").replace(/[^\d.-]/g, ""), 0),
            moneyCost: safeNum_(data.cost, 0),
            delta: logTypeId === 8705 ? 1 : (logTypeId === 8706 ? -1 : 0)
        }));
        return out;
    }

    function garageLogRowsFromResponse_(json) {
        const rows = Array.isArray(json?.log) ? json.log : (json?.log && typeof json.log === "object" ? Object.values(json.log) : []);
        return rows.filter(row => row && typeof row === "object");
    }

    async function fetchGarageLogPage_(logId, toTs = null) {
        const params = [
            `log=${encodeURIComponent(logId)}`,
            "limit=100",
            "sort=DESC",
            "comment=MRG",
            `key=${encodeURIComponent(apiKey)}`
        ];
        if (Number.isFinite(Number(toTs)) && Number(toTs) > 0) params.splice(2, 0, `to=${encodeURIComponent(Math.floor(Number(toTs)))}`);
        const json = await gmRequestJson_(`https://api.torn.com/v2/user/log?${params.join("&")}`);
        if (json?.error) throw new Error(json.error.error || json.error.code || "Torn API log error");
        return garageLogRowsFromResponse_(json);
    }

    async function fetchGarageLogEvents_() {
        if (!apiKey) return [];
        const logIds = [8700, 8701, 8705, 8706, 8735];
        const maxPagesPerLog = 8;
        const seen = new Set();
        const rows = [];

        for (let i = 0; i < logIds.length; i += 1) {
            const logId = logIds[i];
            let toTs = null;
            for (let page = 0; page < maxPagesPerLog; page += 1) {
                garageStatus = `Fetching racing upgrade logs: ${logId} page ${page + 1}/${maxPagesPerLog}...`;
                uiDirty = true; scheduleRender_();
                const pageRows = await fetchGarageLogPage_(logId, toTs);
                if (!pageRows.length) break;

                let minTs = Infinity;
                let newRows = 0;
                for (const row of pageRows) {
                    const ts = Number(row.timestamp || row.event_ts || 0);
                    if (Number.isFinite(ts) && ts > 0) minTs = Math.min(minTs, ts);
                    const key = String(row.id || `${logId}|${ts}|${JSON.stringify(row.data || row.params || {})}`);
                    if (!key || seen.has(key)) continue;
                    seen.add(key);
                    rows.push(row);
                    newRows += 1;
                }

                if (pageRows.length < 100 || newRows === 0 || !Number.isFinite(minTs)) break;
                toTs = minTs - 1;
                await delay_(650);
            }
            if (i < logIds.length - 1) await delay_(650);
        }

        rows.sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
        return rows.flatMap(normalizeGarageLogEntry_).filter(e => e.eventId);
    }

    async function refreshGarage_(force = false) {
        if (garageLoading) return;
        const now = Date.now();
        if (!force && garageCars.length && now - garageLastFetchAt < 120000) {
            renderGarageModal_();
            return;
        }
        garageLoading = true;
        garageStatus = "Loading local garage data...";
        uiDirty = true; scheduleRender_();
        const ownerId = String(apiKeyInfo?.userId || raceMeta?.driverId || "").trim();
        try {
            const [catalogResult, localCarsResult, localEventsResult, upgradesResult] = await Promise.allSettled([
                pgLocalFetchCars(),
                pgLocalFetchEnlistedCars(ownerId),
                pgLocalFetchEnlistedCarEvents(ownerId ? { ownerId } : {}),
                pgLocalFetchUpgrades()
            ]);
            if (catalogResult.status === "fulfilled" && Array.isArray(catalogResult.value?.cars)) garageCatalog = catalogResult.value.cars;
            const localCars = localCarsResult.status === "fulfilled" && Array.isArray(localCarsResult.value?.cars) ? localCarsResult.value.cars : [];
            garageEvents = localEventsResult.status === "fulfilled" && Array.isArray(localEventsResult.value?.events) ? localEventsResult.value.events : [];
            if (upgradesResult.status === "fulfilled" && Array.isArray(upgradesResult.value?.upgrades)) garageUpgrades = upgradesResult.value.upgrades;
            let apiCars = [];
            if (apiKey) {
                if (force || garageCatalogMissingStockStats_()) {
                    garageStatus = "Fetching stock car catalog from Torn...";
                    uiDirty = true; scheduleRender_();
                    await refreshGarageStockCatalog_(force).catch(error => {
                        if (debugEnabled) console.warn(TAG, "stock car catalog fetch failed", error);
                    });
                }
                garageStatus = "Fetching enlisted cars from Torn...";
                uiDirty = true; scheduleRender_();
                apiCars = (await fetchGarageEnlistedCars_()).map(c => normalizeGarageCar_(c, ownerId));
                const snapshotEvents = deriveGarageSnapshotEvents_(localCars, apiCars, ownerId);
                if (snapshotEvents.length) {
                    await pgLocalUpsertEnlistedCarEvents(snapshotEvents, ownerId).catch(error => {
                        if (debugEnabled) console.warn(TAG, "garage snapshot event upsert failed", error);
                    });
                    garageEvents = snapshotEvents.concat(garageEvents || []);
                }
                garageCars = mergeGarageCars_(localCars, apiCars);
                if (apiCars.length) await pgLocalUpsertEnlistedCars(apiCars, ownerId).catch(() => {});
                const canTryGarageLogs = apiKeyInfo?.fullAccess || apiKeyInfo?.logCustomPermissions || !apiKeyInfo?.lastChecked;
                if (canTryGarageLogs) {
                    garageStatus = "Fetching racing upgrade logs...";
                    uiDirty = true; scheduleRender_();
                    try {
                        const apiEvents = await fetchGarageLogEvents_();
                        if (apiEvents.length) {
                            await pgLocalUpsertEnlistedCarEvents(apiEvents, ownerId).catch(() => {});
                            garageEvents = apiEvents.concat(garageEvents || []);
                        }
                    } catch (logError) {
                        garageStatus = `Garage loaded. Log history unavailable: ${pgErrorMessage_(logError, "check key permissions")}`;
                    }
                } else {
                    garageStatus = "Garage loaded. Log history needs a Full Access key or custom log permission.";
                }
            } else {
                garageCars = mergeGarageCars_(localCars, []);
                garageStatus = "Garage loaded from SQLite. Add an API key to refresh enlisted cars.";
            }
            if (!garageSelectedCarId && garageCars.length) garageSelectedCarId = sortedGarageCars_()[0]?.enlistedCarId || "";
            garageLastFetchAt = Date.now();
            if (!garageStatus || /Fetching|Loading/i.test(garageStatus)) {
                garageStatus = `Garage loaded: ${garageCars.length} car${garageCars.length === 1 ? "" : "s"}.`;
            }
        } catch (e) {
            garageStatus = pgErrorMessage_(e, "Garage refresh failed");
        } finally {
            garageLoading = false;
            uiDirty = true;
            scheduleRender_();
        }
    }

    function selectedGarageCar_() {
        const sorted = sortedGarageCars_();
        return sorted.find(c => String(c.enlistedCarId || "") === String(garageSelectedCarId || "")) || sorted[0] || garageCars[0] || null;
    }

    function visibleGarageCars_() {
        return garageShowDelisted ? [...(garageCars || [])] : (garageCars || []).filter(c => !c.isRemoved);
    }

    function garageCarTitle_(car) {
        if (!car) return "--";
        return car.nickname ? `${car.car || "--"} "${car.nickname}"` : (car.car || "--");
    }

    function comparisonGarageCar_(selected = selectedGarageCar_()) {
        const selectedId = String(selected?.enlistedCarId || "");
        const candidates = sortedGarageCars_().filter(c => String(c.enlistedCarId || "") !== selectedId);
        const match = candidates.find(c => String(c.enlistedCarId || "") === String(garageCompareCarId || ""));
        const car = match || candidates[0] || null;
        garageCompareCarId = String(car?.enlistedCarId || "");
        return car;
    }

    function garageMoney_(value) {
        const n = Number(value);
        return Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : "--";
    }

    function garageNumber_(value) {
        const n = Number(value);
        return Number.isFinite(n) ? Math.round(n).toLocaleString() : "--";
    }

    function garageDistance_(km) {
        const n = Number(km);
        if (!Number.isFinite(n) || n < 0) return "--";
        const value = speedUnit === "mph" ? n * 0.621371192237334 : n;
        const suffix = speedUnit === "mph" ? "mi" : "km";
        return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${suffix}`;
    }

    function garageMileageKm_(car) {
        for (const value of [car?.computedMileageKm, car?.mileage]) {
            if (value === null || value === undefined || value === "") continue;
            const mileage = Number(value);
            if (Number.isFinite(mileage) && mileage >= 0) return mileage;
        }
        return NaN;
    }

    function garageStatParts_(car, key) {
        const value = safeNum_(car?.[key], NaN);
        const base = safeNum_(car?.[`${key}Base`] ?? car?.[`base_${key}`], value);
        const bonus = safeNum_(car?.[`${key}Bonus`] ?? car?.[`bonus_${key}`], Number.isFinite(value) && Number.isFinite(base) ? value - base : 0);
        return { value, base, bonus };
    }

    function renderGarageStatBar_(car, key, label) {
        const stat = garageStatParts_(car, key);
        const scaleMax = ["tarmac", "dirt", "safety"].includes(key) ? 100 : 150;
        const pct = Number.isFinite(stat.value) ? Math.max(0, Math.min(100, (stat.value / scaleMax) * 100)) : 0;
        const value = Number.isFinite(stat.value) ? stat.value.toFixed(0) : "--";
        const title = `${label}: ${value} (base ${Number.isFinite(stat.base) ? stat.base.toFixed(0) : "--"} + bonus ${Number.isFinite(stat.bonus) ? stat.bonus.toFixed(0) : "--"})`;
        return `<div class="mpg-garage-bar" title="${escAttr_(title)}"><span>${esc_(label)}</span><div class="mpg-garage-track"><div class="mpg-garage-fill" style="width:${pct.toFixed(1)}%;${pct > 0 ? "min-width:2px;" : ""}"></div></div><b class="mono">${esc_(value)}</b></div>`;
    }

    function garageCompareIndex_(car, surface = "overall") {
        if (!car) return NaN;
        const normal = (key, max) => {
            const value = safeNum_(car[key], NaN);
            return Number.isFinite(value) ? Math.max(0, Math.min(1.5, value / max)) : NaN;
        };
        const values = {
            topSpeed: normal("topSpeed", 150),
            acceleration: normal("acceleration", 150),
            braking: normal("braking", 150),
            handling: normal("handling", 150),
            dirt: normal("dirt", 100),
            tarmac: normal("tarmac", 100),
            safety: normal("safety", 100)
        };
        const weights = surface === "tarmac"
            ? { topSpeed: 1.1, acceleration: 1.1, braking: 1, handling: 1.2, tarmac: 2 }
            : surface === "dirt"
                ? { acceleration: 1.1, braking: 1, handling: 1.2, dirt: 2, safety: .4 }
                : { topSpeed: 1, acceleration: 1, braking: 1, handling: 1, dirt: .7, tarmac: .7, safety: .35 };
        let total = 0;
        let weight = 0;
        for (const [key, amount] of Object.entries(weights)) {
            if (!Number.isFinite(values[key])) continue;
            total += values[key] * amount;
            weight += amount;
        }
        return weight ? (total / weight) * 100 : NaN;
    }

    function garageCompareDeltaHtml_(aValue, bValue, options = {}) {
        const a = Number(aValue);
        const b = Number(bValue);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return `<span class="mpg-garage-compare-delta">--</span>`;
        const difference = b - a;
        const lowerBetter = !!options.lowerBetter;
        const decimals = Number.isFinite(options.decimals) ? options.decimals : 0;
        const winner = Math.abs(difference) < Math.pow(10, -decimals) / 2
            ? ""
            : ((lowerBetter ? b < a : b > a) ? "b" : "a");
        const arrow = winner === "b" ? "→" : winner === "a" ? "←" : "=";
        const formatted = Math.abs(difference).toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
        return `<span class="mpg-garage-compare-delta ${winner}">${arrow} ${esc_(options.prefix || "")}${esc_(formatted)}${esc_(options.suffix || "")}</span>`;
    }

    function garageCompareStatRow_(a, b, key, label) {
        const aStat = garageStatParts_(a, key);
        const bStat = garageStatParts_(b, key);
        const scaleMax = ["tarmac", "dirt", "safety"].includes(key) ? 100 : 150;
        const pct = value => Number.isFinite(value) ? Math.max(0, Math.min(100, (value / scaleMax) * 100)) : 0;
        const value = n => Number.isFinite(n) ? n.toFixed(0) : "--";
        const delta = garageCompareDeltaHtml_(aStat.value, bStat.value);
        return `<div class="mpg-garage-compare-stat ${escAttr_(key)}">
          <div class="mpg-garage-compare-track left"><span class="mpg-garage-compare-fill" style="width:${pct(aStat.value).toFixed(1)}%"></span></div>
          <span class="mpg-garage-compare-value a mono">${esc_(value(aStat.value))}</span>
          <div class="mpg-garage-compare-stat-label">${esc_(label)}${delta}</div>
          <span class="mpg-garage-compare-value b mono">${esc_(value(bStat.value))}</span>
          <div class="mpg-garage-compare-track"><span class="mpg-garage-compare-fill" style="width:${pct(bStat.value).toFixed(1)}%"></span></div>
        </div>`;
    }

    function garageCompareFactRow_(label, aText, bText, deltaHtml = "") {
        return `<div class="mpg-garage-compare-fact">
          <span class="mpg-garage-compare-fact-value left">${esc_(aText)}</span>
          <span class="mpg-garage-compare-stat-label">${esc_(label)}${deltaHtml}</span>
          <span class="mpg-garage-compare-fact-value right">${esc_(bText)}</span>
        </div>`;
    }

    function renderGarageCompareHtml_(selected) {
        const compared = comparisonGarageCar_(selected);
        if (!compared) return `<div class="mpg-garage-empty">A second visible car is required for comparison.</div>`;
        const options = sortedGarageCars_()
            .filter(car => String(car.enlistedCarId || "") !== String(selected.enlistedCarId || ""))
            .map(car => `<option value="${escAttr_(car.enlistedCarId || "")}"${String(car.enlistedCarId || "") === String(compared.enlistedCarId || "") ? " selected" : ""}>${esc_(garageCarTitle_(car))} · ${esc_(car.enlistedCarId || "--")}</option>`)
            .join("");
        const aStarts = safeNum_(selected.racesEntered, NaN);
        const bStarts = safeNum_(compared.racesEntered, NaN);
        const aWins = safeNum_(selected.racesWon, NaN);
        const bWins = safeNum_(compared.racesWon, NaN);
        const aRatio = Number.isFinite(aStarts) && aStarts > 0 && Number.isFinite(aWins) ? (aWins / aStarts) * 100 : NaN;
        const bRatio = Number.isFinite(bStarts) && bStarts > 0 && Number.isFinite(bWins) ? (bWins / bStarts) * 100 : NaN;
        const aMileage = garageMileageKm_(selected);
        const bMileage = garageMileageKm_(compared);
        const aFuel = safeNum_(selected.manufacturerFuelL100, NaN);
        const bFuel = safeNum_(compared.manufacturerFuelL100, NaN);
        const percent = n => Number.isFinite(n) ? `${n.toFixed(2)}%` : "--";
        return `<div class="mpg-garage-compare">
          <div class="mpg-garage-compare-head">
            <div class="mpg-garage-compare-car a">
              <div><b>${esc_(garageCarTitle_(selected))}</b><div class="mpg-garage-meta">A · ID ${esc_(selected.enlistedCarId || "--")}</div></div>
              ${selected.imageUrl ? `<img src="${escAttr_(selected.imageUrl)}" alt="" loading="lazy" decoding="async">` : ""}
            </div>
            <div class="mpg-garage-compare-vs">A vs B<button id="mpgGarageCloseCompare" class="pill mpg-garage-compare-close" type="button" title="Close comparison"><span>×</span></button></div>
            <div class="mpg-garage-compare-car b">
              ${compared.imageUrl ? `<img src="${escAttr_(compared.imageUrl)}" alt="" loading="lazy" decoding="async">` : ""}
              <div><select id="mpgGarageCompareCar">${options}</select><div class="mpg-garage-meta">B · ID ${esc_(compared.enlistedCarId || "--")}</div></div>
            </div>
          </div>
          <div class="mpg-garage-compare-stats">
            ${garageCompareStatRow_(selected, compared, "topSpeed", "Top-speed")}
            ${garageCompareStatRow_(selected, compared, "acceleration", "Acceleration")}
            ${garageCompareStatRow_(selected, compared, "braking", "Braking")}
            ${garageCompareStatRow_(selected, compared, "handling", "Handling")}
            ${garageCompareStatRow_(selected, compared, "dirt", "Dirt")}
            ${garageCompareStatRow_(selected, compared, "tarmac", "Tarmac")}
            ${garageCompareStatRow_(selected, compared, "safety", "Safety")}
          </div>
          <div class="mpg-garage-compare-facts">
            ${garageCompareFactRow_("Class", selected.carClass || "--", compared.carClass || "--")}
            ${garageCompareFactRow_("Pit Guru Index", percent(garageCompareIndex_(selected)), percent(garageCompareIndex_(compared)), garageCompareDeltaHtml_(garageCompareIndex_(selected), garageCompareIndex_(compared), { decimals: 2, suffix: "%" }))}
            ${garageCompareFactRow_("Tarmac Index", percent(garageCompareIndex_(selected, "tarmac")), percent(garageCompareIndex_(compared, "tarmac")), garageCompareDeltaHtml_(garageCompareIndex_(selected, "tarmac"), garageCompareIndex_(compared, "tarmac"), { decimals: 2, suffix: "%" }))}
            ${garageCompareFactRow_("Dirt Index", percent(garageCompareIndex_(selected, "dirt")), percent(garageCompareIndex_(compared, "dirt")), garageCompareDeltaHtml_(garageCompareIndex_(selected, "dirt"), garageCompareIndex_(compared, "dirt"), { decimals: 2, suffix: "%" }))}
            ${garageCompareFactRow_("Races won", garageNumber_(aWins), garageNumber_(bWins), garageCompareDeltaHtml_(aWins, bWins))}
            ${garageCompareFactRow_("Races entered", garageNumber_(aStarts), garageNumber_(bStarts), garageCompareDeltaHtml_(aStarts, bStarts))}
            ${garageCompareFactRow_("Win ratio", percent(aRatio), percent(bRatio), garageCompareDeltaHtml_(aRatio, bRatio, { decimals: 2, suffix: "%" }))}
            ${garageCompareFactRow_("Mileage", garageDistance_(aMileage), garageDistance_(bMileage), garageCompareDeltaHtml_(speedUnit === "mph" ? aMileage * 0.621371192237334 : aMileage, speedUnit === "mph" ? bMileage * 0.621371192237334 : bMileage, { decimals: 2, suffix: speedUnit === "mph" ? " mi" : " km" }))}
            ${garageCompareFactRow_("Worth", garageMoney_(selected.worth), garageMoney_(compared.worth), garageCompareDeltaHtml_(selected.worth, compared.worth, { prefix: "$" }))}
            ${garageCompareFactRow_("Upgrades", garageNumber_(selected.parts?.length || 0), garageNumber_(compared.parts?.length || 0), garageCompareDeltaHtml_(selected.parts?.length || 0, compared.parts?.length || 0))}
            ${garageCompareFactRow_("Points spent", garageNumber_(selected.pointsSpent), garageNumber_(compared.pointsSpent), garageCompareDeltaHtml_(selected.pointsSpent, compared.pointsSpent))}
            ${garageCompareFactRow_("Manufacturer fuel", Number.isFinite(aFuel) ? formatFuelEconomy_(aFuel) : "--", Number.isFinite(bFuel) ? formatFuelEconomy_(bFuel) : "--", garageCompareDeltaHtml_(aFuel, bFuel, { decimals: 2, lowerBetter: true }))}
          </div>
        </div>`;
    }

    function garageEventsForCar_(car) {
        if (!car) return [];
        const id = String(car.enlistedCarId || "");
        const item = String(car.itemID || "");
        const itemMatches = item ? (garageCars || []).filter(c => String(c.itemID || "") === item && !c.isRemoved) : [];
        const allowItemFallback = !id || itemMatches.length <= 1;
        const seen = new Set();
        return (garageEvents || []).map(e => ({
            eventId: String(e.event_id || e.eventId || ""),
            enlistedCarId: String(e.enlisted_car_id || e.enlistedCarId || ""),
            itemID: String(e.item_id || e.itemID || e.itemId || ""),
            eventType: String(e.event_type || e.eventType || ""),
            logTypeId: e.log_type_id ?? e.logTypeId,
            upgradeId: String(e.upgrade_id || e.upgradeId || ""),
            upgradeName: String(e.upgrade_name || e.upgradeName || ""),
            upgradeType: String(e.upgrade_type || e.upgradeType || ""),
            delta: e.delta,
            pointsCost: e.points_cost ?? e.pointsCost ?? e.upgrade_points_cost,
            moneyCost: e.money_cost ?? e.moneyCost ?? e.upgrade_money_cost,
            upgradeStats: {
                spd: e.upgrade_spd,
                acc: e.upgrade_acc,
                brk: e.upgrade_brk,
                hnd: e.upgrade_hnd,
                drt: e.upgrade_drt,
                trm: e.upgrade_trm,
                sft: e.upgrade_sft
            },
            timestamp: e.event_ts ?? e.timestamp,
            eventAt: e.event_at || e.eventAt || ""
        })).filter(e => {
            const ok = (id && e.enlistedCarId === id) || (allowItemFallback && item && !e.enlistedCarId && e.itemID === item);
            if (!ok || seen.has(e.eventId)) return false;
            seen.add(e.eventId);
            return true;
        }).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)).slice(0, 80);
    }

    function garageSortValue_(car, key) {
        if (!car) return "";
        if (key === "car") return `${car.car || ""} ${car.nickname || ""}`.trim().toLowerCase();
        if (key === "id") return safeNum_(car.enlistedCarId, NaN);
        if (key === "class") return String(car.carClass || "").toLowerCase();
        if (key === "parts") return Array.isArray(car.parts) ? car.parts.length : 0;
        if (key === "points") return safeNum_(car.pointsSpent, -Infinity);
        if (key === "starts") return safeNum_(car.racesEntered, -Infinity);
        if (key === "wins") return safeNum_(car.racesWon, -Infinity);
        if (key === "worth") return safeNum_(car.worth, -Infinity);
        if (key === "status") return car.isRemoved ? 1 : 0;
        return String(car[key] || "").toLowerCase();
    }

    function sortedGarageCars_() {
        const dir = garageSortDir === "desc" ? -1 : 1;
        return visibleGarageCars_().sort((a, b) => {
            const av = garageSortValue_(a, garageSortKey);
            const bv = garageSortValue_(b, garageSortKey);
            const aNum = typeof av === "number" && Number.isFinite(av);
            const bNum = typeof bv === "number" && Number.isFinite(bv);
            let cmp = 0;
            if (aNum || bNum) cmp = (aNum ? av : -Infinity) - (bNum ? bv : -Infinity);
            else cmp = String(av || "").localeCompare(String(bv || ""));
            if (!cmp && garageSortKey !== "car") cmp = String(garageSortValue_(a, "car") || "").localeCompare(String(garageSortValue_(b, "car") || ""));
            return cmp * dir;
        });
    }

    function garageSortHead_(key, label) {
        const active = garageSortKey === key;
        const mark = active ? (garageSortDir === "asc" ? "▲" : "▼") : "";
        return `<th scope="col" data-garage-sort="${escAttr_(key)}" class="${active ? "mpg-sort-active" : ""}">${esc_(label)}<span class="mpg-garage-sort-indicator">${esc_(mark)}</span></th>`;
    }

    function openGarageAction_(action) {
        const selected = selectedGarageCar_();
        const actionLabel = String(action || "").replace(/^\w/, c => c.toUpperCase());
        if (action === "upgrade") {
            const enlistedId = String(selected?.enlistedCarId || "").trim();
            if (!enlistedId) {
                toast_("Upgrade: select an enlisted car first.");
                return;
            }
            const url = `https://www.torn.com/page.php?sid=racing&tab=parts&section=addParts&step=selectParts&id=${encodeURIComponent(enlistedId)}`;
            window.open(url, "_blank", "noopener,noreferrer");
            toast_(`Upgrade: opened parts selection for car ${enlistedId}.`);
            return;
        }
        window.open("https://www.torn.com/page.php?sid=racing", "_blank", "noopener,noreferrer");
        toast_(`${actionLabel}: opened Torn Racing. Pit Guru keeps this modal read-only until we have a confirmed safe action endpoint.`);
        if (selected && action !== "buy") {
            try { navigator.clipboard?.writeText(String(selected.enlistedCarId || selected.itemID || "")); } catch {}
        }
    }

    function ensureGarageModal_() {
        let modal = document.getElementById("mpgGarageModal");
        if (modal) return modal;
        modal = document.createElement("div");
        modal.id = "mpgGarageModal";
        modal.className = "mpg-garage-modal";
        modal.innerHTML = `
          <div class="mpg-garage-window" role="dialog" aria-modal="true" aria-labelledby="mpgGarageTitle">
            <div class="mpg-settings-header">
              <div>
                <div id="mpgGarageTitle" class="mpg-settings-title">My Garage</div>
                <div class="mpg-settings-subtitle">Cars, upgrades, stats, and racing log history.</div>
              </div>
              <button id="mpgGarageClose" class="pill mpg-settings-close" type="button" title="Close Garage"><span>x</span></button>
            </div>
            <div id="mpgGarageBody" class="mpg-garage-body"></div>
          </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener("mousedown", e => {
            if (e.target !== modal) return;
            garageOpen = false;
            uiDirty = true; scheduleRender_();
        });
        modal.querySelector("#mpgGarageClose").onclick = () => {
            garageOpen = false;
            uiDirty = true; scheduleRender_();
        };
        document.addEventListener("keydown", e => {
            if (e.key !== "Escape" || !garageOpen) return;
            garageOpen = false;
            uiDirty = true; scheduleRender_();
        });
        return modal;
    }

    function garageUpgradeById_(upgradeId) {
        const id = String(upgradeId || "").trim();
        if (!id) return null;
        return (garageUpgrades || []).find(u => String(u.upgrade_id ?? u.upgradeId ?? u.id ?? "") === id) || null;
    }

    function garageMoneyPlain_(value) {
        const n = Number(value);
        return Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : "--";
    }

    function garageDeltaHtml_(label, value) {
        const n = Number(value);
        if (!Number.isFinite(n) || n === 0) return "";
        const cls = n > 0 ? "pos" : "neg";
        return `<span class="mpg-garage-delta ${cls}">${esc_(label)} ${n > 0 ? "+" : ""}${esc_(n)}</span>`;
    }

    function garageUpgradeStatsHtml_(upgrade) {
        if (!upgrade) return "--";
        const parts = [
            garageDeltaHtml_("SPD", upgrade.spd),
            garageDeltaHtml_("ACC", upgrade.acc),
            garageDeltaHtml_("BRK", upgrade.brk),
            garageDeltaHtml_("HND", upgrade.hnd),
            garageDeltaHtml_("DRT", upgrade.drt),
            garageDeltaHtml_("TRM", upgrade.trm),
            garageDeltaHtml_("SFT", upgrade.sft)
        ].filter(Boolean);
        return parts.length ? `<span class="mpg-garage-stat-deltas">${parts.join("")}</span>` : "--";
    }

    function garageEventAction_(event) {
        const type = String(event?.eventType || garageEventTypeForLog_(event?.logTypeId) || "");
        const delta = Number(event?.delta);
        if (/enlist/i.test(type)) return "Enlisted";
        if (/delist/i.test(type)) return "Delisted";
        if (Number.isFinite(delta) && delta > 0) return "Installed";
        if (Number.isFinite(delta) && delta < 0) return "Removed";
        return type || "--";
    }

    function renderGarageEventsHtml_(selected) {
        const events = garageEventsForCar_(selected);
        return events.length ? events.map(e => `<tr>
            <td>${esc_(e.eventAt ? fmtWhen_(e.eventAt) : (e.timestamp ? fmtWhen_(new Date(Number(e.timestamp) * 1000).toISOString()) : "--"))}</td>
            ${(() => {
                const upgrade = garageUpgradeById_(e.upgradeId);
                const name = upgrade?.name || e.upgradeName || (e.upgradeId ? `Upgrade ${e.upgradeId}` : "--");
                const stats = upgrade || e.upgradeStats;
                return `<td>${esc_(upgrade?.type || e.upgradeType || "--")}</td>
            <td>${esc_(name)}</td>
            <td class="mono">${esc_(upgrade?.cost_racing_points ?? e.pointsCost ?? "--")}</td>
            <td class="mono">${esc_(garageMoneyPlain_(upgrade?.cost_money ?? e.moneyCost))}</td>
            <td>${garageUpgradeStatsHtml_(stats)}</td>
            <td>${esc_(garageEventAction_(e))}</td>`;
            })()}
          </tr>`).join("") : `<tr><td colspan="7" class="muted">No matching upgrade/enlist log entries loaded for this car yet.</td></tr>`;
    }

    function renderGarageDetailHtml_(selected) {
        if (selected && garageCompareOpen) return renderGarageCompareHtml_(selected);
        return selected ? `
          <div class="mpg-garage-selected">
            <div class="mpg-garage-hero">
              ${selected.imageUrl ? `<img src="${escAttr_(selected.imageUrl)}" alt="" loading="lazy" decoding="async">` : `<div class="mpg-garage-empty">No image</div>`}
              <div class="mpg-garage-title">${esc_(selected.nickname ? `${selected.car} "${selected.nickname}"` : selected.car || "--")}</div>
              <div class="mpg-garage-meta">Instance ID ${esc_(selected.enlistedCarId || "--")} · Item ${esc_(selected.itemID || "--")} · Class ${esc_(selected.carClass || "--")} · ${selected.isRemoved ? "Delisted" : "Enlisted"}</div>
            </div>
            <div>
              <div class="mpg-garage-kpis">
                <div class="mpg-garage-kpi"><span>Worth</span><b>${esc_(garageMoney_(selected.worth))}</b></div>
                <div class="mpg-garage-kpi"><span>Points</span><b>${esc_(garageNumber_(selected.pointsSpent))}</b></div>
                <div class="mpg-garage-kpi"><span>Starts</span><b>${esc_(garageNumber_(selected.racesEntered))}</b></div>
                <div class="mpg-garage-kpi"><span>Wins</span><b>${esc_(garageNumber_(selected.racesWon))}</b></div>
                <div class="mpg-garage-kpi"><span>Mileage</span><b>${esc_(garageDistance_(garageMileageKm_(selected)))}</b></div>
                <div class="mpg-garage-kpi"><span>Fuel</span><b>${Number.isFinite(selected.manufacturerFuelL100) ? esc_(formatFuelEconomy_(selected.manufacturerFuelL100)) : "--"}</b></div>
              </div>
              <div class="mpg-garage-bars">
                ${renderGarageStatBar_(selected, "topSpeed", "Top-speed")}
                ${renderGarageStatBar_(selected, "acceleration", "Acceleration")}
                ${renderGarageStatBar_(selected, "braking", "Braking")}
                ${renderGarageStatBar_(selected, "handling", "Handling")}
                ${renderGarageStatBar_(selected, "tarmac", "Tarmac")}
                ${renderGarageStatBar_(selected, "dirt", "Dirt")}
                ${renderGarageStatBar_(selected, "safety", "Safety")}
              </div>
              <button id="mpgGarageToggleLog" class="pill mpg-garage-log-toggle" type="button"><span>▤</span><span>${garageLogOpen ? "Hide Upgrade Log" : "Show Upgrade Log"}</span></button>
            </div>
          </div>
          ${garageLogOpen ? `<section class="mpg-garage-history">
              <div class="mpg-garage-panel-head"><span>Upgrade Log</span><span class="muted">${garageEventsForCar_(selected).length}</span></div>
              <table>
                <thead><tr><th data-sortable="1">When</th><th data-sortable="1">Type</th><th data-sortable="1">Upgrade</th><th data-sortable="1">Points</th><th data-sortable="1">Money</th><th data-sortable="1">Stats</th><th data-sortable="1">Action</th></tr></thead>
                <tbody id="mpgGarageHistoryBody">${renderGarageEventsHtml_(selected)}</tbody>
              </table>
            </section>` : ""}` : `<div class="mpg-garage-empty">Select a car to inspect stats.</div>`;
    }

    function wireGarageDetailActions_(body = document.getElementById("mpgGarageBody")) {
        const btn = body?.querySelector?.("#mpgGarageToggleLog");
        if (btn) {
            btn.onclick = () => {
                garageLogOpen = !garageLogOpen;
                updateGarageSelectionInModal_();
            };
        }
        const compareSelect = body?.querySelector?.("#mpgGarageCompareCar");
        if (compareSelect) {
            compareSelect.onchange = () => {
                garageCompareCarId = String(compareSelect.value || "");
                updateGarageSelectionInModal_();
            };
        }
        const closeCompare = body?.querySelector?.("#mpgGarageCloseCompare");
        if (closeCompare) {
            closeCompare.onclick = () => {
                garageCompareOpen = false;
                updateGarageSelectionInModal_();
            };
        }
        setupAnalysisTableSort_(body);
    }

    function updateGarageSelectionInModal_() {
        const body = document.getElementById("mpgGarageBody");
        if (!body) return;
        body.classList.toggle("compare", garageCompareOpen);
        body.closest(".mpg-garage-window")?.classList.toggle("compare", garageCompareOpen);
        const selected = selectedGarageCar_();
        const selectedId = String(selected?.enlistedCarId || "");
        body.querySelectorAll(".mpg-garage-row").forEach(row => {
            row.classList.toggle("active", String(row.getAttribute("data-car-id") || "") === selectedId);
        });
        const selectedLabel = body.querySelector("#mpgGarageSelectedTorn");
        if (selectedLabel) selectedLabel.textContent = garageCompareOpen ? "A vs B" : (selected?.carClass ? `Class ${selected.carClass}` : "");
        const detailTitle = body.querySelector("#mpgGarageDetailTitle");
        if (detailTitle) detailTitle.textContent = garageCompareOpen ? "Car Comparison" : "Selected Car";
        const detailSlot = body.querySelector("#mpgGarageDetailSlot");
        if (detailSlot) detailSlot.innerHTML = renderGarageDetailHtml_(selected);
        wireGarageDetailActions_(body);
        const compareButton = body.querySelector("#mpgGarageCompare");
        if (compareButton) {
            compareButton.classList.toggle("on", garageCompareOpen);
            const label = compareButton.querySelector("span:last-child");
            if (label) label.textContent = garageCompareOpen ? "Close Compare" : "Compare";
            compareButton.disabled = visibleGarageCars_().length < 2;
        }
        ["mpgGarageEnlist", "mpgGarageUpgrade", "mpgGarageDelist"].forEach(id => {
            const btn = body.querySelector(`#${id}`);
            if (btn) btn.disabled = !selected;
        });
    }

    function renderGarageModal_() {
        const modal = ensureGarageModal_();
        const body = document.getElementById("mpgGarageBody");
        if (!modal || !body) return;
        modal.style.display = garageOpen ? "flex" : "none";
        if (!garageOpen) return;
        body.classList.toggle("compare", garageCompareOpen);
        modal.querySelector(".mpg-garage-window")?.classList.toggle("compare", garageCompareOpen);
        const selected = selectedGarageCar_();
        if (selected && !garageSelectedCarId) garageSelectedCarId = selected.enlistedCarId || "";
        const visibleCars = visibleGarageCars_();
        const key = JSON.stringify({
            theme, loading: garageLoading, status: garageStatus, garageSortKey, garageSortDir, garageLogOpen, garageShowDelisted,
            cars: garageCars.map(c => [
                c.enlistedCarId, c.itemID, c.name, c.nickname, c.carClass, c.pointsSpent, c.parts?.length, c.isRemoved,
                c.racesEntered, c.racesWon, c.worth, c.computedMileageKm, c.mileage, c.manufacturerFuelL100,
                c.topSpeed, c.acceleration, c.braking, c.handling, c.dirt, c.tarmac, c.safety
            ]).slice(0, 120),
            events: garageEvents.length,
            upgrades: garageUpgrades.length
        });
        if (body.dataset.renderKey === key && body.children.length) return;
        body.dataset.renderKey = key;
        const carsHtml = visibleCars.length ? `<table class="mpg-garage-table">
          <thead><tr>
            ${garageSortHead_("car", "Car")}
            ${garageSortHead_("id", "ID")}
            ${garageSortHead_("class", "Class")}
            ${garageSortHead_("parts", "Parts")}
            ${garageSortHead_("points", "Points")}
            ${garageSortHead_("starts", "Starts")}
            ${garageSortHead_("wins", "Wins")}
            ${garageSortHead_("worth", "Worth")}
            ${garageSortHead_("status", "Status")}
          </tr></thead>
          <tbody>${sortedGarageCars_().map(car => {
            const active = selected && String(car.enlistedCarId || "") === String(selected.enlistedCarId || "");
            const title = car.nickname ? `${car.car} "${car.nickname}"` : car.car;
            return `<tr class="mpg-garage-row${active ? " active" : ""}" data-car-id="${escAttr_(car.enlistedCarId || "")}">
              <td data-sort="${escAttr_(title || "")}">
                <div class="mpg-garage-car-cell">
                  ${car.imageUrl ? `<img src="${escAttr_(car.imageUrl)}" alt="" loading="lazy" decoding="async">` : `<span class="carIcon"></span>`}
                  <span><span class="mpg-garage-car-name">${esc_(title || "--")}</span><span class="mpg-garage-car-sub">${esc_(car.carClass ? `Class ${car.carClass}` : "")}</span></span>
                </div>
              </td>
              <td class="mono" data-sort="${escAttr_(safeNum_(car.enlistedCarId, 0))}">${esc_(car.enlistedCarId || "--")}</td>
              <td data-sort="${escAttr_(car.carClass || "")}"><span class="mpg-garage-class">${esc_(car.carClass || "--")}</span></td>
              <td class="mono" data-sort="${escAttr_(car.parts?.length || 0)}">${esc_(garageNumber_(car.parts?.length || 0))}</td>
              <td class="mono" data-sort="${escAttr_(safeNum_(car.pointsSpent, -1))}">${esc_(garageNumber_(car.pointsSpent))}</td>
              <td class="mono" data-sort="${escAttr_(safeNum_(car.racesEntered, -1))}">${esc_(garageNumber_(car.racesEntered))}</td>
              <td class="mono" data-sort="${escAttr_(safeNum_(car.racesWon, -1))}">${esc_(garageNumber_(car.racesWon))}</td>
              <td class="mono" data-sort="${escAttr_(safeNum_(car.worth, -1))}">${esc_(garageMoney_(car.worth))}</td>
              <td data-sort="${car.isRemoved ? 1 : 0}">${car.isRemoved ? "Delisted" : "Enlisted"}</td>
            </tr>`;
        }).join("")}</tbody></table>` : `<div class="mpg-garage-empty">${garageCars.length ? "No visible cars. Use Show Delisted to include removed cars." : "No garage cars loaded yet."}</div>`;

        body.innerHTML = `
          <div class="mpg-garage-toolbar">
            <div class="mpg-garage-actions">
              <button id="mpgGarageRefresh" class="pill" type="button"${garageLoading ? " disabled" : ""}><span>↻</span><span>${garageLoading ? "Refreshing" : "Refresh"}</span></button>
              <button id="mpgGarageBuy" class="pill" type="button"><span>🛒</span><span>Buy</span></button>
              <button id="mpgGarageEnlist" class="pill" type="button"${selected ? "" : " disabled"}><span>🏁</span><span>Enlist</span></button>
              <button id="mpgGarageUpgrade" class="pill" type="button"${selected ? "" : " disabled"}><span>🛠️</span><span>Upgrade</span></button>
              <button id="mpgGarageDelist" class="pill" type="button"${selected ? "" : " disabled"}><span>⛔</span><span>Delist</span></button>
              <button id="mpgGarageCompare" class="pill${garageCompareOpen ? " on" : ""}" type="button"${visibleCars.length > 1 ? "" : " disabled"}><span>⇄</span><span>${garageCompareOpen ? "Close Compare" : "Compare"}</span></button>
              <button id="mpgGarageShowDelisted" class="pill${garageShowDelisted ? " on" : ""}" type="button"><span>${garageShowDelisted ? "👁️" : "🚫"}</span><span>${garageShowDelisted ? "Hide Delisted" : "Show Delisted"}</span></button>
            </div>
            <div class="muted">${esc_(garageStatus || "Garage data is loaded from Torn API and cached in SQLite.")}</div>
          </div>
          <div class="mpg-garage-grid">
            <section class="mpg-garage-list">
              <div class="mpg-garage-list-head"><span>Cars</span><span class="muted">${visibleCars.length}${garageShowDelisted ? ` / ${garageCars.length}` : ""}</span></div>
              <div class="mpg-garage-cars">${carsHtml}</div>
            </section>
            <section class="mpg-garage-detail">
              <div class="mpg-garage-panel-head"><span id="mpgGarageDetailTitle">${garageCompareOpen ? "Car Comparison" : "Selected Car"}</span><span id="mpgGarageSelectedTorn" class="muted">${garageCompareOpen ? "A vs B" : (selected?.carClass ? esc_(`Class ${selected.carClass}`) : "")}</span></div>
              <div id="mpgGarageDetailSlot" class="mpg-garage-detail-scroll">${renderGarageDetailHtml_(selected)}</div>
            </section>
          </div>
        `;
        setupAnalysisTableSort_(body);
        wireGarageDetailActions_(body);
        body.querySelector("#mpgGarageRefresh").onclick = () => refreshGarage_(true);
        body.querySelector("#mpgGarageBuy").onclick = () => openGarageAction_("buy");
        body.querySelector("#mpgGarageEnlist").onclick = () => openGarageAction_("enlist");
        body.querySelector("#mpgGarageUpgrade").onclick = () => openGarageAction_("upgrade");
        body.querySelector("#mpgGarageDelist").onclick = () => openGarageAction_("delist");
        body.querySelector("#mpgGarageCompare").onclick = () => {
            garageCompareOpen = !garageCompareOpen;
            if (garageCompareOpen) comparisonGarageCar_(selectedGarageCar_());
            updateGarageSelectionInModal_();
        };
        body.querySelector("#mpgGarageShowDelisted").onclick = () => {
            garageShowDelisted = !garageShowDelisted;
            saveBoolSetting_(STORE_GARAGE_SHOW_DELISTED_KEY, garageShowDelisted);
            body.dataset.renderKey = "";
            renderGarageModal_();
        };
        body.querySelectorAll("th[data-garage-sort]").forEach(th => {
            th.onclick = () => {
                const next = String(th.getAttribute("data-garage-sort") || "car");
                if (garageSortKey === next) garageSortDir = garageSortDir === "asc" ? "desc" : "asc";
                else {
                    garageSortKey = next;
                    garageSortDir = ["points", "starts", "wins", "worth", "parts"].includes(next) ? "desc" : "asc";
                }
                body.dataset.renderKey = "";
                renderGarageModal_();
            };
        });
        body.querySelectorAll(".mpg-garage-row").forEach(row => {
            row.onclick = () => {
                garageSelectedCarId = String(row.getAttribute("data-car-id") || "");
                updateGarageSelectionInModal_();
            };
        });
    }

    function renderModeBar_() {
        const bar = document.getElementById("mpgModeBar");
        if (!bar) return;
        const modes = [
            ["gaps", "🏁", "Leaderboard"], ["laprec", "🧾", "Lap Recording"], ["sectors", "📍", "Sectors"], ["speed", "🚀", "Speed"],
            ["pace", "⏱️", "Lap Pace"], ...(fuelEnabled ? [["fuel", "⛽", "Fuel"]] : []), ["gyro", "🌀", "Gyro"], ["summary", "📋", "Summary"], ["driver", "🪪", "Driver Stats"], ["predictions", "🔮", "Predictions"]
        ];
        if (analysisMode === "accel" || (analysisMode === "fuel" && !fuelEnabled)) {
            analysisMode = "gyro";
            saveAnalysisMode_();
        }
        const key = `${analysisMode}|${modes.map(x => x[0]).join(",")}`;
        if (bar.dataset.renderKey === key && bar.children.length) return;
        bar.dataset.renderKey = key;
        bar.innerHTML = modes.map(([key, glyph, label]) => `<button class="pill ${analysisMode === key ? "on" : ""}" data-mode="${key}" title="${escAttr_(label)}"><span class="mpg-mode-glyph">${glyph}</span><span class="mpg-mode-label">${esc_(label)}</span></button>`).join("");
        bar.querySelectorAll("button[data-mode]").forEach(btn => {
            btn.onclick = () => {
                analysisMode = btn.getAttribute("data-mode") || "gaps";
                saveAnalysisMode_();
                uiDirty = true;
                scheduleRender_();
            };
        });
    }

    async function deleteRecordFromButton_(btn) {
        const id = btn?.getAttribute?.("data-id") || "";
        if (!id) return;
        const source = btn.getAttribute("data-source") || "";
        if (source === "sqlite") {
            const payload = {
                mode: btn.getAttribute("data-mode") || recordsMode,
                raceId: btn.getAttribute("data-race-id") || "",
                driverId: btn.getAttribute("data-driver-id") || "",
                car: btn.getAttribute("data-car") || ""
            };
            btn.disabled = true;
            const result = await pgLocalDeleteRecord(payload);
            if (!result?.ok) throw new Error(result?.error || "SQLite record delete failed");
            pgLocalRecordsCache.fetchedAt = 0;
        } else {
            records = records.filter(r => r.id !== id);
            saveRecords_();
        }
        uiDirty = true;
        scheduleRender_();
    }

    function commentaryGapToLeader_(entry, leader, elapsed, canFull, index) {
        if (!entry || !leader || index === 0) return 0;
        if (canFull) return entry.driver?.crashed ? NaN : Math.max(0, (entry.driver.finalTime || 0) - (leader.driver.finalTime || 0));
        return Math.max(0, driverReachTimeForDistance_(entry.driver, leader.state.distance || 0) - elapsed);
    }

    function orderTickerText_(ordered, elapsed, canFull) {
        const leader = ordered[0];
        return ordered.slice(0, 8).map((x, i) => {
            const gap = commentaryGapToLeader_(x, leader, elapsed, canFull, i);
            return `${i + 1}. ${x.driver.name}${i ? ` (${formatRaceGapSeconds_(gap)})` : ""}`;
        }).join(" | ");
    }

    function updateCommentary_(elapsed, canFull) {
        const el = document.getElementById("mpgCommentaryTicker");
        if (!el) return;
        if (!analysis || !liveCommentaryEnabled) {
            el.style.display = "none";
            el.textContent = "";
            lastCommentaryText = "";
            return;
        }
        const ordered = getLiveOrder_(elapsed, canFull);
        if (!ordered.length) {
            el.style.display = "none";
            return;
        }
        el.style.display = "block";
        const now = Date.now();
        if (lastCommentaryText && now - lastCommentaryAtMs < 5000) {
            el.textContent = lastCommentaryText;
            return;
        }
        const leader = ordered[0];
        const second = ordered[1];
        const leaderGapSecond = second ? commentaryGapToLeader_(second, leader, elapsed, canFull, 1) : NaN;
        const lapText = currentLapDisplay_();
        const choices = [];
        choices.push({ key: "ticker", text: `Running order: ${orderTickerText_(ordered, elapsed, canFull)}` });
        choices.push({ key: "leader", text: `${leader.driver.name} controls the race on lap ${lapText}.` });
        choices.push({ key: "pace", text: `Timing screens are alive: ${leader.driver.name} is setting the reference pace, everyone else is chasing tenths.` });
        choices.push({ key: "sector", text: `Sector rhythm matters here; one messy split can turn a small gap into a very long afternoon.` });
        choices.push({ key: "traffic", text: `The field is stretching out, but the next checkpoint can still shuffle the order.` });
        choices.push({ key: "pressure", text: `Pressure is building through the pack; the timing tower is starting to look interesting.` });
        choices.push({ key: "smooth", text: `Smooth inputs, clean exits, and no drama. That is the recipe the stopwatch likes.` });
        choices.push({ key: "hunt", text: `The chase is on, and every finish-line checkpoint tells us who is gaining.` });
        choices.push({ key: "data", text: `Pit Guru has the ruler out: gaps, lap deltas, and just enough judgement to be dangerous.` });
        choices.push({ key: "late", text: `There is still time for a late swing if someone finds speed in the final sectors.` });
        choices.push({ key: "finish", text: canFull ? `Race complete. ${leader.driver.name} is the benchmark, and the history book has fresh ink.` : `Still live. Final order stays hidden until the race gives us the flag.` });
        if (Number.isFinite(leaderGapSecond) && leaderGapSecond < 1) choices.push({ key: "closelead", text: `${second.driver.name} is right with ${leader.driver.name}; less than a second covers the lead fight.` });
        if (Number.isFinite(leaderGapSecond) && leaderGapSecond > 5) choices.push({ key: "leadgap", text: `${leader.driver.name} has opened breathing room at the front.` });
        if (!choices.length) {
            el.style.display = "none";
            return;
        }
        const pool = choices.filter(x => x.key !== lastCommentaryKey);
        const pickPool = pool.length ? pool : choices;
        const pick = pickPool[Math.floor((elapsed + ordered.length * 7) % pickPool.length)] || choices[0];
        lastCommentaryKey = pick?.key || "";
        lastCommentaryText = pick?.text || "";
        lastCommentaryAtMs = now;
        el.textContent = lastCommentaryText;
    }

    function updateTeamRadio_(ordered, elapsed, canFull) {
        if (!analysis || !pitCrewEnabled || !ordered?.length) {
            lastTeamRadioText = pitCrewEnabled ? "Radio check pending." : "";
            return lastTeamRadioText;
        }
        const now = Date.now();
        if (lastTeamRadioText && now - lastTeamRadioAtMs < 5000) return lastTeamRadioText;
        const userIndex = ordered.findIndex(x => isUserDriver_(x.driver));
        const user = userIndex >= 0 ? ordered[userIndex] : ordered[0];
        const ahead = userIndex > 0 ? ordered[userIndex - 1] : null;
        const behind = userIndex >= 0 && userIndex < ordered.length - 1 ? ordered[userIndex + 1] : null;
        const leader = ordered[0];
        const userGap = userIndex > 0 ? commentaryGapToLeader_(user, leader, elapsed, canFull, userIndex) : 0;
        const aheadGap = ahead ? Math.max(0, driverReachTimeForDistance_(user.driver, ahead.state.distance || 0) - elapsed) : 0;
        const behindGap = behind ? Math.max(0, driverReachTimeForDistance_(behind.driver, user.state.distance || 0) - elapsed) : NaN;
        const crash = canFull ? ordered.find(x => x.driver?.crashed) : null;
        const choices = [
            { key: "steady", text: `${user.driver.name}: keep it clean, the clock is the target.` },
            { key: "weather", text: "Track report: conditions stable, grip looks predictable through the next split." },
            { key: "focus", text: "Brake markers, exit speed, no wasted inputs." }
        ];
        if (userIndex === 0) choices.push({ key: "lead", text: `${user.driver.name}: leading the road. Manage the gap and keep sectors tidy.` });
        if (Number.isFinite(userGap) && userGap > 0) choices.push({ key: "leadergap", text: `${user.driver.name}: gap to leader ${formatRaceGapSeconds_(userGap)}.` });
        if (ahead && Number.isFinite(aheadGap)) choices.push({ key: "ahead", text: `${user.driver.name}: car ahead ${ahead.driver.name}, gap ${formatRaceGapSeconds_(aheadGap)}.` });
        if (behind && Number.isFinite(behindGap)) choices.push({ key: "behind", text: `${user.driver.name}: ${behind.driver.name} behind at ${formatRaceGapSeconds_(behindGap)}.` });
        if (crash) choices.push({ key: "crash", text: `Incident report: ${crash.driver.name} is marked DNF/crashed.` });
        const pool = choices.filter(x => x.key !== lastTeamRadioKey);
        const pickPool = pool.length ? pool : choices;
        const pick = pickPool[Math.floor((elapsed + ordered.length * 3) % pickPool.length)] || choices[0];
        lastTeamRadioKey = pick.key;
        lastTeamRadioText = pick.text;
        lastTeamRadioAtMs = now;
        return lastTeamRadioText;
    }

    function liveTimerText_(elapsed, canFull) {
        if (!analysis) return "";
        if (canFull || raceIsFinished_()) {
            const best = Math.min(...analysis.drivers.filter(d => !d.crashed).map(d => d.finalTime).filter(Number.isFinite));
            return Number.isFinite(best) ? formatTimeSeconds_(best) : "";
        }
        if (visualRaceHasStarted_()) return formatTimeSeconds_(elapsed);
        return "";
    }

    function analysisStatusLine_(elapsed, canFull) {
        const countdownSeconds = parseCountdownToSeconds_(raceMeta?.countdown || "");
        const countdownText = Number.isFinite(countdownSeconds) && countdownSeconds > 0
            ? `Race starts in: ${formatShortCountdown_(countdownSeconds)}`
            : "";
        if (!analysis) return countdownText || "Waiting for racingData";
        if (canFull || raceIsFinished_()) {
            const finalText = liveTimerText_(elapsed, true);
            return `FINISHED - Final analysis ready${finalText ? ` (${finalText})` : ""}`;
        }
        if (!visualRaceHasStarted_()) return countdownText || "READY - Waiting for race start";
        return `LIVE - Timer: ${formatTimeSeconds_(elapsed)}`;
    }

    function updateAnalysisStageStatus_(body, elapsed, canFull) {
        const status = body?.querySelector?.(".mpg-stage-status");
        if (status) status.textContent = analysisStatusLine_(elapsed, canFull);
        const ordered = analysis ? getLiveOrder_(elapsed, canFull) : [];
        const tv = body?.querySelector?.('[data-stage-text="tv"]');
        if (tv) tv.textContent = lastCommentaryText || (analysis ? "Timing screens are live." : "Commentary will begin when race data is available.");
        const radio = body?.querySelector?.('[data-stage-text="radio"]');
        if (radio) radio.textContent = updateTeamRadio_(ordered, elapsed, canFull) || "Radio check pending.";
    }

    function analysisStageHtml_(elapsed, canFull) {
        const ordered = analysis ? getLiveOrder_(elapsed, canFull) : [];
        const boxes = [];
        if (liveCommentaryEnabled) {
            const tv = lastCommentaryText || (analysis ? "Timing screens are live." : "Commentary will begin when race data is available.");
            boxes.push(`<div class="mpg-stage-box"><div class="mpg-stage-title">TV</div><div class="mpg-stage-text" data-stage-text="tv">${esc_(tv)}</div></div>`);
        }
        if (pitCrewEnabled) {
            const radio = updateTeamRadio_(ordered, elapsed, canFull);
            boxes.push(`<div class="mpg-stage-box"><div class="mpg-stage-title">Team Radio</div><div class="mpg-stage-text" data-stage-text="radio">${esc_(radio || "Radio check pending.")}</div></div>`);
        }
        const stageGrid = boxes.length ? `<div class="mpg-stage-grid ${boxes.length === 1 ? "single" : ""}">${boxes.join("")}</div>` : "";
        return `<div class="mpg-race-stage">
          <div class="mpg-stage-status">${esc_(analysisStatusLine_(elapsed, canFull))}</div>
          ${stageGrid}
          <div class="mpg-separator"></div>
        </div>`;
    }

    function sectorStructureKey_(elapsed, canFull) {
        if (canFull) return "full";
        const order = getLiveOrder_(elapsed, false).map(x => x.driver.driverId || normalizeDriverName_(x.driver.name || "")).join(",");
        const completed = (analysis?.drivers || []).map(d => {
            const count = (d.sectorTimes || []).filter(s => {
                const endIndex = (s.lap - 1) * analysis.segmentsPerLap + analysis.sectorSplitIndexes[s.sector - 1] - 1;
                return (d.cumulativeTimes?.[endIndex] || Infinity) <= elapsed;
            }).length;
            return `${d.driverId || normalizeDriverName_(d.name || "")}:${count}`;
        }).join(",");
        return `${order}|${completed}`;
    }

    function analysisRenderBucket_(elapsed, canFull) {
        if (canFull) return "full";
        if (analysisMode === "gyro") return gyroStructureKey_(elapsed, canFull);
        if (analysisMode === "sectors") return sectorStructureKey_(elapsed, canFull);
        if (analysisMode === "predictions") return "static";
        if (analysisMode === "laprec" && largeFieldMode_()) {
            const refDriver = replayMomentDriver_() || analysis?.drivers?.[0] || null;
            const state = refDriver ? currentDistanceAtTime_(refDriver, elapsed) : null;
            const lap = clamp_((state?.lapIndex || 0) + 1, 1, Math.max(1, analysis?.laps || 1));
            const tickSeconds = hugeFieldMode_() ? 10 : 5;
            return `laprec:${lap}:t${Math.floor((Number(elapsed) || 0) / tickSeconds)}`;
        }
        return Math.floor(elapsed * liveRenderFps_());
    }

    function renderAnalysis_() {
        renderSettingsPanel_();
        renderGarageModal_();
        renderModeBar_();
        renderDriverRowsCurrent = 0;
        renderDriverRowsTotalCurrent = fieldSize_();
        const body = document.getElementById("mpgAnalysisBody");
        const status = document.getElementById("mpgStatusBadge");
        if (!body) return false;
        const payload = findLatestRaceDataPayload_();
        if (payload && !analysis) buildAnalysisFromRaceData_(payload);
        if (!analysis) {
            body.style.display = "block";
            if (status) status.style.display = "";
            updateCommentary_(0, false);
            if (analysisMode === "predictions") {
                const set = predictionDriverSet_();
                if (status) status.textContent = set.drivers.length ? "PREDICTIONS · Pre-race grid" : "PREDICTIONS · Waiting for driver list";
                const predKey = `pre-race-predictions|${theme}|${liveCommentaryEnabled ? 1 : 0}|${pitCrewEnabled ? 1 : 0}|${useApiPredictions ? 1 : 0}|${useHistoryPredictions ? 1 : 0}|${driverIntelStatus}|${preRaceParticipantsKey}|${pgLocalTrackHistoryRenderKey_(set.trackName)}|focus:${analysisFocusMode}:${analysisFocusDriverId}:${analysisFocusDriverName}|heavy:${heavyRaceMode_() ? 1 : 0}:${heavyRaceShowAllDrivers ? 1 : 0}:${heavyRaceFullCardsEnabled ? 1 : 0}`;
                if (body.dataset.renderKey !== predKey) {
                    body.dataset.renderKey = predKey;
                    body.innerHTML = analysisStageHtml_(0, false) + renderPredictionsMode_(set);
                    bindAnalysisBodyActions_(body);
                    recordRenderInstrumentation_(true);
                    statusOnlyRenderPending = false;
                }
                updateAnalysisStageStatus_(body, 0, false);
                return true;
            }
            if (status) status.textContent = "WAITING · racingData JSON not captured";
            const waitingKey = `waiting-json|${analysisMode}|${theme}|${liveCommentaryEnabled ? 1 : 0}|${pitCrewEnabled ? 1 : 0}`;
            if (body.dataset.renderKey !== waitingKey) {
                body.dataset.renderKey = waitingKey;
                body.innerHTML = analysisStageHtml_(0, false) + `<div class="mpg-card"><div class="mpg-empty-title">Waiting for racingData</div><p class="mpg-note">Pit Guru now reads Torn's delivered racingData JSON only. Page leaderboard and lap UI scraping are disabled.</p><p class="mpg-note">Open the race before it starts, or load a replay/log that provides racingData, and this panel will fill automatically.</p></div>`;
                recordRenderInstrumentation_(true);
                statusOnlyRenderPending = false;
            }
            updateAnalysisStageStatus_(body, 0, false);
            return true;
        }
        const elapsed = getVisualElapsed_();
        const ctx = getRaceContext_();
        const replayMoment = shouldRenderReplayMoment_();
        const replayAtEnd = replayMoment && maxAnalysisFinalTime_() > 0 && elapsed >= maxAnalysisFinalTime_() - 0.05;
        const canFull = analysisCanShowFullRace_() && (!replayMoment || replayAtEnd);
        const telemetryActive = canFull || telemetryCanSample_(elapsed);
        if (canFull && analysisMode === "sectors") ensureAnalysisAggregates_({ sectors: true });
        if (canFull && (analysisMode === "summary" || analysisMode === "driver")) {
            ensureAnalysisAggregates_({ sectors: true, leads: true });
        }
        if (status) {
            const hideDuplicateFinishedStatus = ctx !== "replay" && canFull;
            status.style.display = hideDuplicateFinishedStatus ? "none" : "";
            status.textContent = hideDuplicateFinishedStatus
                ? ""
                : ctx === "replay"
                    ? `REPLAY · JSON analysis @ ${formatTimeSeconds_(elapsed)}`
                    : allowPreFinishPreview
                        ? "LIVE · Preview enabled"
                        : !visualRaceHasStarted_()
                            ? "READY · Race data captured, waiting for visible start"
                            : "LIVE · Final results hidden until finish";
        }
        updateCommentary_(elapsed, canFull);
        if (statusOnlyRenderPending && body.dataset.renderKey && !dataDirty && !layoutDirty && !selectionDirty) {
            statusOnlyRenderPending = false;
            updateAnalysisStageStatus_(body, elapsed, canFull);
            if (analysisMode === "gyro") updateGyroLive_(body, elapsed);
            recordRenderInstrumentation_(false);
            return true;
        }
        const renderBucket = analysisRenderBucket_(elapsed, canFull);
        const renderKey = [
            analysis.raceId || analysis.trackName || "race",
            analysisMode,
            renderBucket,
            speedUnit,
            telemetrySmoothing,
            allowPreFinishPreview ? 1 : 0,
            fuelEnabled ? 1 : 0,
            fuelDisplayStyle,
            experimentalGyroTrace ? 1 : 0,
            liveCommentaryEnabled ? 1 : 0,
            pitCrewEnabled ? 1 : 0,
            telemetryActive ? 1 : 0,
            useApiPredictions ? 1 : 0,
            useHistoryPredictions ? 1 : 0,
            analysisMode === "predictions" ? driverIntelStatus : "",
            (analysisMode === "predictions" || analysisMode === "driver") ? pgLocalTrackHistoryRenderKey_(analysis?.trackName || raceMeta?.track || "") : "",
            analysis?.routeModel ? "route" : "noroute",
            body.dataset.gyroDriver || "",
            `focus:${analysisFocusMode}:${analysisFocusDriverId}:${analysisFocusDriverName}`,
            `heavy:${heavyRaceMode_() ? 1 : 0}:${heavyRaceShowAllDrivers ? 1 : 0}:${heavyRaceFullCardsEnabled ? 1 : 0}`
        ].join("|");
        if (body.dataset.renderKey === renderKey) {
            updateAnalysisStageStatus_(body, elapsed, canFull);
            if (analysisMode === "gyro") updateGyroLive_(body, elapsed);
            recordRenderInstrumentation_(false);
            return true;
        }
        const html = ({
            laprec: renderLapRecordingMode_,
            gaps: renderGapsMode_,
            accel: renderAccelMode_,
            sectors: renderSectorsMode_,
            speed: renderSpeedMode_,
            pace: renderPaceMode_,
            fuel: renderFuelMode_,
            gyro: renderGyroMode_,
            summary: renderSummaryMode_,
            driver: renderDriverStatsMode_,
            predictions: renderPredictionsMode_
        }[analysisMode] || renderGapsMode_)(elapsed, canFull);
        body.dataset.renderKey = renderKey;
        body.innerHTML = analysisStageHtml_(elapsed, canFull) + html;
        bindAnalysisBodyActions_(body);
        if (analysisMode === "gyro") updateGyroLive_(body, elapsed);
        recordRenderInstrumentation_(true);
        statusOnlyRenderPending = false;
        return true;
    }

    function bindAnalysisBodyActions_(body) {
        if (!body) return;
        setupAnalysisTableSort_(body);
        setupAnalysisFocusActions_(body);
        body.querySelectorAll(".mpg-gyro-driver").forEach(btn => {
            btn.onclick = e => {
                const name = e.currentTarget?.dataset?.driver || "";
                if (!name || body.dataset.gyroDriver === name) return;
                body.dataset.gyroDriver = name;
                uiDirty = true;
                scheduleRender_();
            };
        });
        body.querySelectorAll(".mpg-intel-fetch").forEach(btn => {
            btn.onclick = () => handleManualDriverIntelFetch_(btn);
        });
    }

    function setupAnalysisFocusActions_(body) {
        if (!body || body.dataset.focusHooked === "1") return;
        body.dataset.focusHooked = "1";
        body.addEventListener("change", e => {
            const select = e.target?.closest?.("[data-analysis-focus-select]");
            if (!select || !body.contains(select)) return;
            const [id, name] = String(select.value || "").split("\t");
            setManualAnalysisFocus_(id || "", name || "");
        });
        body.addEventListener("click", e => {
            const heavyAction = e.target?.closest?.("[data-analysis-heavy-action]");
            if (heavyAction && body.contains(heavyAction)) {
                const action = heavyAction.getAttribute("data-analysis-heavy-action") || "";
                ensureHeavyRaceOverrideState_();
                if (action === "show-all") {
                    heavyRaceShowAllDrivers = true;
                } else if (action === "full-cards") {
                    heavyRaceShowAllDrivers = true;
                    heavyRaceFullCardsEnabled = true;
                } else if (action === "protect") {
                    heavyRaceShowAllDrivers = false;
                    heavyRaceFullCardsEnabled = false;
                }
                markDirty_({ layout: true, selection: true, status: true });
                scheduleRender_();
                return;
            }
            const action = e.target?.closest?.("[data-analysis-focus-action]");
            if (action && body.contains(action)) {
                clearManualAnalysisFocus_();
                return;
            }
            if (e.target?.closest?.("button,a,input,select,textarea,label")) return;
            const row = e.target?.closest?.("tr[data-focus-driver-id],tr[data-focus-driver-name]");
            if (!row || !body.contains(row)) return;
            const id = row.getAttribute("data-focus-driver-id") || "";
            const name = row.getAttribute("data-focus-driver-name") || "";
            if (!id && !name) return;
            setManualAnalysisFocus_(id, name);
        });
    }

    function tableSortValue_(text) {
        const raw = String(text || "").trim();
        if (!raw || /^[-—]+$/.test(raw) || /^DNF$/i.test(raw)) return { type: "empty", value: Infinity };
        const timeMatch = raw.match(/^([+-])?(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)$/) || raw.match(/^([+-])?(\d+):(\d{2}(?:\.\d+)?)$/);
        if (timeMatch) {
            const sign = timeMatch[1] === "-" ? -1 : 1;
            const parts = raw.replace(/^[+-]/, "").split(":").map(Number);
            let seconds = 0;
            for (const part of parts) seconds = seconds * 60 + part;
            return { type: "number", value: sign * seconds };
        }
        const compact = raw.replace(/,/g, "");
        const numeric = compact.match(/[+-]?\d+(?:\.\d+)?/);
        if (numeric) return { type: "number", value: Number(numeric[0]) };
        return { type: "text", value: raw.toLowerCase() };
    }

    function setupAnalysisTableSort_(body) {
        if (!body || body.dataset.sortHooked === "1") return;
        body.dataset.sortHooked = "1";
        body.addEventListener("click", e => {
            const th = e.target?.closest?.("th[data-sortable='1']");
            if (!th || !body.contains(th)) return;
            const table = th.closest("table");
            const tbody = table?.tBodies?.[0];
            if (!table || !tbody || tbody.rows.length < 2) return;
            const idx = Array.prototype.indexOf.call(th.parentNode.children, th);
            const desc = th.classList.contains("sort-asc");
            table.querySelectorAll("th").forEach(x => x.classList.remove("sort-asc", "sort-desc"));
            th.classList.add(desc ? "sort-desc" : "sort-asc");
            const rows = Array.from(tbody.rows).filter(row => row.cells.length > 1);
            rows.sort((a, b) => {
                const av = tableSortValue_(a.cells[idx]?.dataset?.sort || a.cells[idx]?.innerText || "");
                const bv = tableSortValue_(b.cells[idx]?.dataset?.sort || b.cells[idx]?.innerText || "");
                let cmp = 0;
                if (av.type === "text" || bv.type === "text") cmp = String(av.value).localeCompare(String(bv.value));
                else cmp = av.value - bv.value;
                return desc ? -cmp : cmp;
            });
            rows.forEach(row => tbody.appendChild(row));
        });
    }

    function driverNameCell_(d) {
        const name = d?.name || d?.driverIntel?.name || (d?.driverId ? `#${d.driverId}` : "--");
        const userDriver = isUserDriver_(d);
        const id = String(d?.driverId || "").trim() || (userDriver ? "self" : "");
        const classes = ["mpg-driver-cell"];
        if (userDriver) classes.push("mpg-user-driver");
        return `<span class="${classes.join(" ")}" data-driver-id="${escAttr_(id)}" data-driver-name="${escAttr_(name)}">${esc_(name)}</span>`;
    }

    function driverRsCell_(d) {
        return esc_(formatDriverRs_(d?.racingSkill).replace(/^RS:\s*/i, ""));
    }

    function carCell_(d) {
        const car = toOgCarName_(d?.car || "");
        const suffix = d?.carSource ? ` <span class="muted">(last seen)</span>` : "";
        const img = car && d?.carImg ? optionalImageTag_(d.carImg, "carIcon") : "";
        return `${img ? `${img} ` : ""}${esc_(car || "--")}${car ? suffix : ""}`;
    }

    function carComboCell_(dOrCar, img = "", source = "") {
        const car = toOgCarName_(typeof dOrCar === "string" ? dOrCar : (dOrCar?.car || ""));
        const carImg = String(img || (typeof dOrCar === "string" ? "" : dOrCar?.carImg) || "").trim();
        const suffix = source || (typeof dOrCar === "string" ? "" : dOrCar?.carSource) ? ` <span class="muted">(last seen)</span>` : "";
        const imgHtml = carImg ? optionalImageTag_(carImg, "carIcon") : "";
        const imgWrap = imgHtml ? `<span class="mpg-car-img">${imgHtml}</span>` : "";
        return `<span class="mpg-car-combo">${imgWrap}<span class="mpg-car-name">${esc_(car || "--")}${suffix}</span></span>`;
    }

    function driverRsText_(d) {
        return formatDriverRs_(d?.racingSkill).replace(/^RS:\s*/i, "");
    }

    function driverWithRsCell_(d) {
        return `<span class="mpg-driver-rs">${driverNameCell_(d)} <span class="muted">(${esc_(driverRsText_(d))})</span></span>`;
    }

    function raceEndPositionIcon_(position, canFull) {
        if (!canFull) return String(position);
        if (position === 1) return `<span class="mpg-pos-icon" title="Winner">🏆</span>`;
        if (position === 2) return `<span class="mpg-pos-icon" title="Second">🥈</span>`;
        if (position === 3) return `<span class="mpg-pos-icon" title="Third">🥉</span>`;
        return `<span class="mpg-pos-icon" title="Finished behind podium">🐌</span>`;
    }

    function isUserDriver_(d) {
        const id = String(d?.driverId || "").trim();
        const myId = String(playerId || raceMeta?.driverId || "").trim();
        if (id && myId && id === myId) return true;
        const myName = normalizeDriverName_(playerName || raceMeta?.driver || "");
        return !!myName && normalizeDriverName_(d?.name || "") === myName;
    }

    function driverFromOrderedItem_(item) {
        return item?.driver || item?.d || item || null;
    }

    function driverIdentityMatches_(d, id, name) {
        if (!d) return false;
        const wantedId = String(id || "").trim();
        const wantedName = normalizeDriverName_(name || "");
        const driverId = String(d.driverId || "").trim();
        const driverName = normalizeDriverName_(d.name || d.driverIntel?.name || "");
        return !!((wantedId && driverId && wantedId === driverId) || (wantedName && driverName && wantedName === driverName));
    }

    function findDriverIndexByIdentity_(list, id, name) {
        const wantedId = String(id || "").trim();
        const wantedName = normalizeDriverName_(name || "");
        if (!wantedId && !wantedName) return -1;
        return list.findIndex(item => driverIdentityMatches_(driverFromOrderedItem_(item), wantedId, wantedName));
    }

    function actualUserDriverIndex_(list) {
        return findDriverIndexByIdentity_(list, playerId, playerName);
    }

    function spectatedDriverIndex_(list) {
        return findDriverIndexByIdentity_(list, spectateDriverId_, spectateName);
    }

    function raceMetaDriverIndex_(list) {
        return findDriverIndexByIdentity_(list, raceMeta?.driverId, raceMeta?.driver);
    }

    function focusedDriverResolution_(list) {
        const total = Array.isArray(list) ? list.length : 0;
        if (!total) return { index: -1, source: "none", driver: null };
        if (analysisFocusMode === "manual") {
            const manualIndex = findDriverIndexByIdentity_(list, analysisFocusDriverId, analysisFocusDriverName);
            if (manualIndex >= 0) return { index: manualIndex, source: "manual", driver: driverFromOrderedItem_(list[manualIndex]) };
        }
        const userIndex = actualUserDriverIndex_(list);
        if (userIndex >= 0) return { index: userIndex, source: "user", driver: driverFromOrderedItem_(list[userIndex]) };
        const spectatedIndex = spectatedDriverIndex_(list);
        if (spectatedIndex >= 0) return { index: spectatedIndex, source: "spectated", driver: driverFromOrderedItem_(list[spectatedIndex]) };
        const metaIndex = raceMetaDriverIndex_(list);
        if (metaIndex >= 0) return { index: metaIndex, source: "meta", driver: driverFromOrderedItem_(list[metaIndex]) };
        return { index: 0, source: "leader", driver: driverFromOrderedItem_(list[0]) };
    }

    function focusRowDataAttrs_(d) {
        const id = String(d?.driverId || "").trim();
        const name = String(d?.name || d?.driverIntel?.name || "").trim();
        return ` data-focus-driver-id="${escAttr_(id)}" data-focus-driver-name="${escAttr_(name)}"`;
    }

    function noteRenderedDriverRows_(rendered, total) {
        if (!Number.isFinite(rendered) || !Number.isFinite(total)) return;
        renderDriverRowsCurrent = Math.max(renderDriverRowsCurrent, rendered);
        renderDriverRowsTotalCurrent = Math.max(renderDriverRowsTotalCurrent, total);
    }

    function setManualAnalysisFocus_(id, name) {
        analysisFocusMode = "manual";
        analysisFocusDriverId = String(id || "").trim();
        analysisFocusDriverName = String(name || "").trim();
        uiDirty = true;
        scheduleRender_();
    }

    function clearManualAnalysisFocus_() {
        analysisFocusMode = "auto";
        analysisFocusDriverId = "";
        analysisFocusDriverName = "";
        uiDirty = true;
        scheduleRender_();
    }

    function focusedOrderWindow_(ordered, options = {}) {
        const list = Array.isArray(ordered) ? ordered : [];
        const total = list.length;
        const defaultEachSide = heavyRaceMode_() ? DEFAULT_HEAVY_ROW_WINDOW_EACH_SIDE : DEFAULT_FOCUSED_ROW_WINDOW_EACH_SIDE;
        const eachSide = Math.max(1, Number(options.eachSide) || focusedRowWindowEachSide || defaultEachSide);
        const maxRows = Math.max(3, eachSide * 2 + 1);
        const force = options.force === true;
        const focus = focusedDriverResolution_(list);
        const focusOptions = list.map((row, index) => {
            const d = driverFromOrderedItem_(row) || {};
            return { index, pos: index + 1, id: String(d.driverId || "").trim(), name: String(d.name || d.driverIntel?.name || "").trim() };
        });
        if (!total || total <= maxRows || heavyRaceShowAllDrivers || heavyRaceFullCardsEnabled || (!force && !largeFieldMode_() && !heavyRaceWindowedRows_())) {
            const result = {
                windowed: false,
                total,
                start: 0,
                end: total,
                focusIndex: focus.index,
                focusSource: focus.source,
                focusDriver: focus.driver,
                focusOptions,
                items: list.map((row, index) => ({ row, index, pos: index + 1 }))
            };
            noteRenderedDriverRows_(result.items.length, total);
            return result;
        }

        let focusIndex = focus.index;
        if (focusIndex < 0) focusIndex = 0;

        let start = Math.max(0, focusIndex - eachSide);
        let end = Math.min(total, focusIndex + eachSide + 1);
        if (end - start < maxRows) {
            if (start === 0) end = Math.min(total, maxRows);
            else if (end === total) start = Math.max(0, total - maxRows);
        }

        const result = {
            windowed: true,
            total,
            start,
            end,
            focusIndex,
            focusSource: focus.source,
            focusDriver: driverFromOrderedItem_(list[focusIndex]),
            focusOptions,
            items: list.slice(start, end).map((row, offset) => ({ row, index: start + offset, pos: start + offset + 1 }))
        };
        noteRenderedDriverRows_(result.items.length, total);
        return result;
    }

    function focusedWindowNote_(win, label = "table") {
        if (!win?.windowed && !heavyRaceMode_()) return "";
        const d = win.focusDriver || {};
        const focusName = d.name ? `following ${esc_(d.name)} at P${win.focusIndex + 1}/${win.total}` : "no focused driver found, showing leader window";
        const source = win.focusSource === "manual" ? "manual pin" : win.focusSource === "user" ? "your driver" : win.focusSource === "spectated" ? "spectated driver" : win.focusSource === "meta" ? "race driver" : "leader";
        const action = analysisFocusMode === "manual"
            ? `<button type="button" class="pill mini" data-analysis-focus-action="clear">Clear Focus</button>`
            : `<button type="button" class="pill mini" data-analysis-focus-action="auto">Auto Follow</button>`;
        const selector = win.focusOptions?.length
            ? `<label class="mpg-focus-select-label">Focus <select class="mpg-focus-select" data-analysis-focus-select>${win.focusOptions.map(opt => {
                const selected = opt.index === win.focusIndex ? " selected" : "";
                const labelText = `P${opt.pos} ${opt.name || opt.id || "Driver"}`;
                return `<option value="${escAttr_(`${opt.id}\t${opt.name}`)}"${selected}>${esc_(labelText)}</option>`;
            }).join("")}</select></label>`
            : "";
        const heavyStats = heavyRaceStats_();
        const heavyControls = heavyRaceMode_()
            ? `<span class="mpg-heavy-controls">${!heavyRaceShowAllDrivers && !heavyRaceFullCardsEnabled ? `<button type="button" class="pill mini" data-analysis-heavy-action="show-all">Show all drivers</button>` : ""}${!heavyRaceFullCardsEnabled ? `<button type="button" class="pill mini" data-analysis-heavy-action="full-cards">Enable full cards</button>` : ""}${heavyRaceShowAllDrivers || heavyRaceFullCardsEnabled ? `<button type="button" class="pill mini" data-analysis-heavy-action="protect">Protected view</button>` : ""}</span>`
            : "";
        const prefix = heavyRaceMode_()
            ? `Heavy mode: ${heavyRaceLightweightMode_() ? "ON" : "OVERRIDDEN"} (${Math.round(heavyStats.estimatedPoints || 0).toLocaleString()} estimated points).`
            : "Large field view:";
        const rangeText = win.windowed ? `rendering positions ${win.start + 1}-${win.end}` : `rendering all ${win.total} drivers`;
        return `<div class="mpg-note mpg-focus-note"><span>${prefix} ${focusName}, ${rangeText}. Source: ${esc_(source)}. ${win.windowed ? "Sorting is disabled for this windowed table." : ""}</span>${selector}${action}${heavyControls}</div>`;
    }

    function lookupDriver_(driverId, driverName) {
        const id = String(driverId || "").trim();
        const nn = normalizeDriverName_(driverName || "");
        return (analysis?.drivers || []).find(d => (id && String(d.driverId || "") === id) || (nn && normalizeDriverName_(d.name) === nn)) || null;
    }

    function pctText_(num) {
        return Number.isFinite(num) ? `${(num * 100).toFixed(2)}%` : "--";
    }

    async function fetchDriverIntelOne_(driverId, driverName = "", force = false) {
        const id = String(driverId || "").trim();
        if (!apiKey || !id || driverIntelFetchActive) return null;
        const cached = getCachedDriverIntel_(id) || getCachedDriverIntelByName_(driverName);
        if (!force && cached && String(cached.avatar || "").trim()) return cached;
        if (!force && cached && !driverIntelNeedsProfileRefresh_(id, driverName)) return cached;
        if (!force) {
            try {
                const model = lookupDriver_(id, driverName) || findPredictionDriver_(id, driverName) || {};
                let localEntry = pgLocalGetCachedIntelForDriver_({ driverId: id, name: driverName, car: model.car || "" }, analysis?.trackName || raceMeta?.track || "");
                if (!localEntry) {
                    const track = analysis?.trackName || raceMeta?.track || visibleRaceTrackName_() || "";
                    if (track) {
                        const scope = currentRaceHistoryScope_(track);
                        const local = await pgLocalFetchRaceIntel(track, [{
                            driverId: id,
                            name: driverName || model.name || "",
                            car: toOgCarName_(model.car || "")
                        }], scope);
                        localEntry = local?.drivers?.[id] || null;
                    }
                }
                const localIntel = pgLocalDriverIntelFromProfile_(localEntry, { driverId: id, name: driverName });
                if (localIntel && driverIntelIsFresh_(localIntel)) {
                    cacheDriverIntel_(localIntel.driverId, localIntel);
                    if (localIntel.name) cacheDriverIntel_(driverIntelNameKey_(localIntel.name), localIntel);
                    saveDriverIntelCache_();
                    applyDriverIntelToModel_();
                    return localIntel;
                }
            } catch {}
        }
        try {
            const json = await fetchDriverIntelJson_(id);
            if (json?.error) return null;
            const intel = normalizeDriverIntel_(id, json);
            cacheDriverIntel_(id, intel);
            if (driverName && !intel.name) {
                intel.name = driverName;
                cacheDriverIntel_(driverIntelNameKey_(driverName), intel);
            }
            saveDriverIntelCache_();
            applyDriverIntelToModel_();
            pgLocalUpsertDriverIntel_(intel).catch(() => {});
            return intel;
        } catch {
            return null;
        }
    }

    function findPredictionDriver_(driverId, driverName) {
        const id = String(driverId || "").trim();
        const nn = normalizeDriverName_(driverName || "");
        const pools = [analysis?.drivers || [], preRaceParticipants || []];
        for (const pool of pools) {
            const found = pool.find(d => (id && String(d.driverId || "") === id) || (nn && normalizeDriverName_(d.name || "") === nn));
            if (found) return found;
        }
        return null;
    }

    function predictionIntelActionCell_(d, intel = null) {
        if (!apiKey) return `<span class="muted">No key</span>`;
        const id = String(d?.driverId || "").trim();
        const ready = intel && Number.isFinite(Number(intel.racingSkill));
        const label = ready ? "Refresh" : (id ? "Fetch" : "Find / Fetch");
        const title = ready
            ? "Refresh Driver Intel for this driver now"
            : id
            ? "Fetch Driver Intel for this driver now"
            : "Try to find this driver's Torn ID from the visible race row, or enter it manually";
        return `<button type="button" class="pill mpg-intel-fetch" data-driver-id="${escAttr_(id)}" data-driver-name="${escAttr_(d?.name || "")}" data-force="${ready ? "1" : "0"}" title="${escAttr_(title)}">${esc_(label)}</button>`;
    }

    async function handleManualDriverIntelFetch_(btn) {
        if (!btn) return;
        if (driverIntelFetchActive) {
            driverIntelStatus = "Driver Intel is already fetching. Try again when the current queue finishes.";
            uiDirty = true;
            scheduleRender_();
            return;
        }
        const name = String(btn.dataset.driverName || "").trim();
        let id = String(btn.dataset.driverId || "").trim();
        driverIntelStatus = `Driver Intel manual fetch: ${name || id || "driver"}...`;
        btn.disabled = true;
        btn.textContent = "Fetching...";
        uiDirty = true;
        scheduleRender_();
        try {
            if (!apiKey) {
                driverIntelStatus = "Add an API key in Settings first.";
                toast_(driverIntelStatus);
                return;
            }
            if (!id) id = lookupVisibleDriverIdByName_(name) || "";
            if (!id && name) {
                const entered = window.prompt(`Pit Guru could not read ${name}'s Torn ID from the race page. Enter their Torn ID to fetch Driver Intel:`, "");
                if (entered && /^\d{2,}$/.test(String(entered).trim())) id = String(entered).trim();
            }
            if (!id) {
                driverIntelStatus = `Driver Intel manual fetch failed: no Torn ID found for ${name || "that row"}.`;
                toast_(driverIntelStatus);
                return;
            }
            const model = findPredictionDriver_(id, name) || findPredictionDriver_("", name);
            if (model) model.driverId = id;
            const intel = await fetchDriverIntelOne_(id, name, btn.dataset.force === "1");
            if (!intel) {
                driverIntelStatus = `Driver Intel manual fetch failed for ${name || id}.`;
                toast_(driverIntelStatus);
                return;
            }
            if (model) {
                model.driverIntel = intel;
                model.driverId = String(intel.driverId || id);
                if ((!model.name || isRejectedVisibleDriverName_(model.name)) && intel.name) model.name = intel.name;
                if (Number.isFinite(Number(intel.racingSkill))) model.racingSkill = Number(intel.racingSkill);
            }
            cacheDriverIntel_(driverIntelNameKey_(name || intel.name), intel);
            saveDriverIntelCache_();
            applyDriverIntelToModel_();
            pgLocalUpsertDriverIntel_(intel).catch(() => {});
            driverIntelStatus = `Driver Intel fetched for ${intel.name || name || id}.`;
            toast_(driverIntelStatus);
        } finally {
            uiDirty = true;
            scheduleRender_();
        }
    }

    function driverHoverCardHtml_(driverId, driverName) {
        const model = lookupDriver_(driverId, driverName) || {};
        const intel = getCachedDriverIntel_(driverId, 24 * 7) || getCachedDriverIntelByName_(driverName, 24 * 7) || getDriverIntelForDriver_(model, 24 * 7) || {};
        const name = intel.name || model.name || driverName || "--";
        const id = intel.driverId || (driverId === "self" ? "" : driverId) || model.driverId || "--";
        const avatar = profileImageForRender_(intel.avatar || "");
        const rs = Number.isFinite(Number(intel.racingSkill)) ? Number(intel.racingSkill) : Number(model.racingSkill);
        const starts = Number(intel.racesEntered);
        const wins = Number(intel.racesWon);
        const history = getDriverTrackHistory_(model.driverId || driverId, model.name || driverName, analysis?.trackName || raceMeta?.track || "");
        const winPct = Number.isFinite(wins) && Number.isFinite(starts) && starts > 0 ? wins / starts : NaN;
        const fallbackImg = `<div style="width:58px;height:58px;border-radius:10px;border:1px solid var(--border);background:var(--pill);display:grid;place-items:center;font-weight:900">${esc_(String(name).slice(0, 1).toUpperCase())}</div>`;
        return `
          <div class="mpg-driver-card-head">
            ${avatar ? `<img src="${escAttr_(avatar)}" alt="" loading="lazy" decoding="async">` : fallbackImg}
            <div>
              <h3>${esc_(name)} <span class="mpg-card-id">[${esc_(id)}]</span></h3>
              <div class="mpg-card-id">${esc_([intel.title, intel.rank, Number.isFinite(intel.level) ? `Lvl ${intel.level}` : ""].filter(Boolean).join(" · ") || "Race Details")}</div>
            </div>
          </div>
          <div class="mpg-card-grid">
            <div class="mpg-card-stat"><span>RS</span><b>${Number.isFinite(rs) ? rs.toFixed(2) : "--"}</b></div>
            <div class="mpg-card-stat"><span>Points</span><b>${Number.isFinite(intel.racingPointsEarned) ? Math.round(intel.racingPointsEarned).toLocaleString() : "--"}</b></div>
            <div class="mpg-card-stat"><span>Starts</span><b>${Number.isFinite(starts) ? starts.toLocaleString() : "--"}</b></div>
            <div class="mpg-card-stat"><span>Wins</span><b>${Number.isFinite(wins) ? `${wins.toLocaleString()} (${pctText_(winPct)})` : "--"}</b></div>
            <div class="mpg-card-stat"><span>This Track</span><b>${history ? `${history.races || 0} race${history.races === 1 ? "" : "s"}` : "--"}</b></div>
            <div class="mpg-card-stat"><span>Track Podiums</span><b>${history ? `${history.podiums || 0}` : "--"}</b></div>
          </div>`;
    }

    function ensureDriverHoverCard_() {
        let card = document.getElementById("mpgDriverHoverCard");
        if (card) return card;
        card = document.createElement("div");
        card.id = "mpgDriverHoverCard";
        document.body.appendChild(card);
        applyTheme_();
        return card;
    }

    function placeDriverHoverCard_(card, ev) {
        const margin = 12;
        const rect = card.getBoundingClientRect();
        let left = (ev.clientX || 0) + 16;
        let top = (ev.clientY || 0) + 16;
        if (left + rect.width > window.innerWidth - margin) left = Math.max(margin, (ev.clientX || 0) - rect.width - 16);
        if (top + rect.height > window.innerHeight - margin) top = Math.max(margin, (ev.clientY || 0) - rect.height - 16);
        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
    }

    function setupDriverHover_() {
        if (document.__mpgDriverHoverHooked) return;
        document.__mpgDriverHoverHooked = true;
        let activeEl = null;
        const hide = () => {
            activeEl = null;
            const card = document.getElementById("mpgDriverHoverCard");
            if (card) card.style.display = "none";
        };
        const validHoverSource = target => {
            if (heavyRaceLightweightMode_()) return null;
            if (analysisMode !== "gaps") return null;
            const el = target?.closest?.(".mpg-driver-cell");
            if (!el || !el.closest("#mpgAnalysisBody")) return null;
            return el;
        };
        document.addEventListener("mouseover", e => {
            const el = validHoverSource(e.target);
            if (!el) { if (activeEl) hide(); return; }
            activeEl = el;
            const card = ensureDriverHoverCard_();
            const id = el.dataset.driverId || "";
            const name = el.dataset.driverName || "";
            card.innerHTML = driverHoverCardHtml_(id, name);
            card.style.display = "block";
            placeDriverHoverCard_(card, e);
            if (id && driverIntelNeedsProfileRefresh_(id, name)) {
                fetchDriverIntelOne_(id, name).then(() => {
                    if (activeEl === el && card.style.display !== "none") card.innerHTML = driverHoverCardHtml_(id, name);
                });
            }
        }, true);
        document.addEventListener("mousemove", e => {
            if (!activeEl) return;
            if (!validHoverSource(e.target)) { hide(); return; }
            placeDriverHoverCard_(ensureDriverHoverCard_(), e);
        }, true);
        document.addEventListener("mouseout", e => {
            const el = validHoverSource(e.target);
            if (!el) return;
            const to = e.relatedTarget;
            if (to && (el.contains(to) || validHoverSource(to))) return;
            hide();
        }, true);
        document.addEventListener("mouseleave", hide, true);
    }

    function renderTable_(headers, rows, empty = "No analysis rows yet.", label = "", options = {}) {
        const displayHeader = h => String(h || "") === "Car image + Car name" ? "Car" : h;
        const sortable = options?.sortable !== false && !options?.windowed;
        const head = headers.map(h => `<th scope="col"${sortable ? ` data-sortable="1"` : ""}>${esc_(displayHeader(h))}</th>`).join("");
        const body = rows.length ? rows.join("") : `<tr><td colspan="${headers.length}" class="muted">${esc_(empty)}</td></tr>`;
        const helpText = String(options?.helpText || "").trim();
        const help = helpText
            ? `<button type="button" class="mpg-table-help" aria-label="${escAttr_(helpText)}" data-help="${escAttr_(helpText)}">?</button>`
            : "";
        const title = label ? `<div class="mpg-table-label"><span class="mpg-table-label-text">${esc_(label)}</span>${help}</div>` : "";
        const summaryText = String(options?.summaryText || "").trim();
        const classes = `mpg-table-block${options?.compact ? " mpg-table-compact" : ""}${summaryText ? " mpg-table-has-summary" : ""}${options?.windowed ? " mpg-table-windowed" : ""}`;
        const summary = summaryText ? `<div class="mpg-table-summary">${esc_(summaryText)}</div>` : "";
        return `<div class="${classes}">${title}<div class="mpg-table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${summary}</div>`;
    }

    function renderGapsMode_(elapsed, canFull) {
        const ordered = getLiveOrder_(elapsed, canFull);
        const win = focusedOrderWindow_(ordered);
        const leaderDist = ordered[0]?.state?.distance || 0;
        const leaderTime = ordered[0]?.driver?.finalTime || 0;
        const totalMeters = (analysis?.lapMeters || 0) * (analysis?.laps || 0);
        const finishReachTime = d => {
            if (!d) return NaN;
            const live = currentDistanceAtTime_(d, elapsed);
            if (live.finished && !d.crashed) return d.finalTime;
            return totalMeters > 0 ? driverReachTimeForDistance_(d, totalMeters) : NaN;
        };
        const rows = win.items.map(({ row: x, index: i, pos }) => {
            const ahead = ordered[i - 1];
            if (canFull) {
                const finishText = x.driver.crashed ? "DNF" : formatTimeSeconds_(x.driver.finalTime);
                const currentGap = i === 0 ? 0 : (x.driver.crashed ? NaN : (x.driver.finalTime || 0) - leaderTime);
                const aheadGapSec = !ahead ? 0 : (x.driver.crashed || ahead.driver.crashed ? NaN : (x.driver.finalTime || 0) - (ahead.driver.finalTime || 0));
                const prev = previousLapGapInfo_(x.driver, x.state, currentGap);
                const leaderGap = i === 0 ? "" : (x.driver.crashed ? "DNF" : `${formatRaceGapSeconds_(currentGap)} (${prev.text})`);
                const aheadPrevRaw = ahead ? previousLapGapSeconds_(x.driver, x.state) - previousLapGapSeconds_(ahead.driver, ahead.state) : NaN;
                const aheadGap = i <= 1 ? "" : (x.driver.crashed || ahead?.driver?.crashed ? "DNF" : `${formatRaceGapSeconds_(aheadGapSec)}${Number.isFinite(aheadPrevRaw) ? ` (${formatRaceGapSeconds_(aheadPrevRaw)})` : ""}`);
                return `<tr${focusRowDataAttrs_(x.driver)}><td data-sort="${pos}">${raceEndPositionIcon_(pos, true)}</td><td>${carComboCell_(x.driver)}</td><td>${driverWithRsCell_(x.driver)}</td><td class="mono">${leaderGap}</td><td class="mono">${aheadGap}</td><td class="mono mpg-timecell">${finishText}</td></tr>`;
            }
            const live = currentDistanceAtTime_(x.driver, elapsed);
            const leaderLive = ordered[0]?.state || null;
            const leaderFinished = !!leaderLive?.finished && !ordered[0]?.driver?.crashed;
            const aheadFinished = !!ahead?.state?.finished && !ahead?.driver?.crashed;
            const driverFinishTime = live.finished && !x.driver.crashed ? x.driver.finalTime : finishReachTime(x.driver);
            const leaderGap = i === 0
                ? 0
                : (leaderFinished
                    ? Math.max(0, driverFinishTime - (ordered[0].driver.finalTime || 0))
                    : Math.max(0, driverReachTimeForDistance_(x.driver, leaderDist) - elapsed));
            const aheadGap = !ahead
                ? 0
                : (aheadFinished
                    ? Math.max(0, driverFinishTime - (ahead.driver.finalTime || 0))
                    : Math.max(0, driverReachTimeForDistance_(x.driver, ahead.state.distance) - elapsed));
            const prev = previousLapGapInfo_(x.driver, live, leaderGap);
            const aheadPrevRaw = ahead ? previousLapGapSeconds_(x.driver, live) - previousLapGapSeconds_(ahead.driver, ahead.state) : NaN;
            const leaderGapText = i === 0 ? "" : `${formatRaceGapSeconds_(leaderGap)} (${prev.text})`;
            const aheadGapText = i <= 1 ? "" : `${formatRaceGapSeconds_(aheadGap)}${Number.isFinite(aheadPrevRaw) ? ` (${formatRaceGapSeconds_(aheadPrevRaw)})` : ""}`;
            const finishText = live.finished ? (x.driver.crashed ? "DNF" : formatTimeSeconds_(x.driver.finalTime)) : "--";
            return `<tr${focusRowDataAttrs_(x.driver)}><td data-sort="${pos}">${pos}</td><td>${carComboCell_(x.driver)}</td><td>${driverWithRsCell_(x.driver)}</td><td class="mono">${leaderGapText}</td><td class="mono">${aheadGapText}</td><td class="mono mpg-timecell">${finishText}</td></tr>`;
        });
        return `${focusedWindowNote_(win, "Leaderboard")}${renderTable_(["Pos", "Car image + Car name", "Driver (RS)", "Gap (Prev lap gap)", "Gap Ahead (Prev lap gap)", "Finish Time"], rows, "Waiting for leaderboard data...", "Leaderboard", { windowed: win.windowed })}`;
    }

    function missingLapText_() {
        return "--.--.---";
    }

    function driverLapTimeMap_(driver) {
        const laps = driver?.validLapTimes || [];
        const key = `${laps.length}|${driver?.bestLapSeconds || ""}|${driver?.finalTime || ""}`;
        if (driver && driver._mpgLapTimeMapKey === key && driver._mpgLapTimeMap instanceof Map) {
            return driver._mpgLapTimeMap;
        }
        const map = new Map();
        for (const item of laps) {
            const lap = Number(item?.lap);
            const seconds = Number(item?.seconds);
            if (Number.isFinite(lap) && Number.isFinite(seconds)) map.set(lap, seconds);
        }
        if (driver) {
            driver._mpgLapTimeMapKey = key;
            driver._mpgLapTimeMap = map;
        }
        return map;
    }

    function driverLapTimeByNumber_(driver, lapNumber) {
        const seconds = driverLapTimeMap_(driver).get(Number(lapNumber));
        return Number.isFinite(seconds) ? seconds : NaN;
    }

    function fastestRaceLapSeconds_() {
        if (!analysis?.drivers?.length) return NaN;
        if (Object.prototype.hasOwnProperty.call(analysis, "_mpgFastestRaceLapSeconds")) {
            return analysis._mpgFastestRaceLapSeconds;
        }
        let best = Infinity;
        for (const d of analysis.drivers) {
            for (const item of d.validLapTimes || []) {
                const seconds = Number(item?.seconds);
                if (Number.isFinite(seconds) && seconds < best) best = seconds;
            }
        }
        analysis._mpgFastestRaceLapSeconds = best < Infinity ? best : NaN;
        return analysis._mpgFastestRaceLapSeconds;
    }

    function lapRecordingVisibleLapNumbers_(lapCount, elapsed, canFull) {
        lapCount = Math.max(0, Number(lapCount) || 0);
        if (!lapCount) return [];
        const driverCount = analysis?.drivers?.length || 0;
        const totalLapCells = driverCount * lapCount;
        const maxCells = hugeFieldMode_() ? 900 : (largeFieldMode_() ? 1800 : 3000);
        if (totalLapCells <= maxCells) return Array.from({ length: lapCount }, (_, i) => i + 1);

        const windowSize = Math.max(3, Math.min(lapCount, Math.floor(maxCells / Math.max(1, driverCount))));
        const refDriver = replayMomentDriver_() || analysis?.drivers?.[0] || null;
        let centerLap = canFull ? lapCount : 1;
        if (!canFull && refDriver) {
            const state = currentDistanceAtTime_(refDriver, elapsed);
            centerLap = clamp_((state?.lapIndex || 0) + 1, 1, lapCount);
        }
        const startLap = Math.floor(clamp_(centerLap - Math.floor(windowSize / 2), 1, Math.max(1, lapCount - windowSize + 1)));
        return Array.from({ length: windowSize }, (_, i) => startLap + i);
    }

    function visibleDriverLapTime_(driver, lapNumber, elapsed, canFull) {
        const seconds = driverLapTimeByNumber_(driver, lapNumber);
        if (!Number.isFinite(seconds)) return NaN;
        if (canFull) return seconds;
        const endIndex = lapNumber * (analysis?.segmentsPerLap || 1) - 1;
        return (driver.cumulativeTimes?.[endIndex] || Infinity) <= elapsed ? seconds : NaN;
    }

    function lapRecordingData_(elapsed = getVisualElapsed_(), canFull = analysisCanShowFullRace_()) {
        if (!analysis?.drivers?.length) return { headers: [], rows: [] };
        const lapCount = Math.max(analysis.laps || 0, ...analysis.drivers.map(d => d.validLapTimes?.length || 0));
        const headers = ["Pos.", "Name", "Car", "Total Time", "Fastest Lap"].concat(Array.from({ length: lapCount }, (_, i) => `Lap ${i + 1}`));
        const rows = getLiveOrder_(canFull ? Infinity : elapsed, canFull).map((x, i) => {
            const d = x.driver;
            const lapSeconds = Array.from({ length: lapCount }, (_, idx) => visibleDriverLapTime_(d, idx + 1, elapsed, canFull));
            const completed = lapSeconds.filter(Number.isFinite);
            const total = completed.length
                ? formatTimeSeconds_(completed.reduce((a, b) => a + b, 0))
                : (canFull && !d.crashed && Number.isFinite(d.finalTime) ? formatTimeSeconds_(d.finalTime) : missingLapText_());
            let fastest = missingLapText_();
            if (completed.length) {
                let best = Infinity;
                let bestLap = 0;
                lapSeconds.forEach((v, idx) => {
                    if (Number.isFinite(v) && v < best) {
                        best = v;
                        bestLap = idx + 1;
                    }
                });
                fastest = `${formatTimeSeconds_(best)} (L${bestLap})`;
            }
            return [
                i + 1,
                d.name || "--",
                toOgCarName_(d.car) || "--",
                d.crashed && canFull ? `DNF / ${total}` : total,
                fastest
            ].concat(lapSeconds.map(v => Number.isFinite(v) ? formatTimeSeconds_(v) : missingLapText_()));
        });
        return { headers, rows };
    }

    function renderLapRecordingMode_(elapsed, canFull) {
        if (!analysis?.drivers?.length) return renderTable_(["Pos", "Car image + Car name", "Driver", "RS", "Current"], [], "Waiting for decoded lap data...", "Lap Recording");
        const lapCount = Math.max(analysis.laps || 0, ...analysis.drivers.map(d => d.validLapTimes?.length || 0));
        const visibleLapNumbers = lapRecordingVisibleLapNumbers_(lapCount, elapsed, canFull);
        const isWindowedLaps = visibleLapNumbers.length < lapCount;
        const ordered = getLiveOrder_(canFull ? Infinity : elapsed, canFull);
        const rowWin = focusedOrderWindow_(ordered);
        const fastestRaceLap = fastestRaceLapSeconds_();
        const lapCellClass = (d, v) => {
            if (!Number.isFinite(v)) return "mono mpg-timecell";
            if (Number.isFinite(fastestRaceLap) && Math.abs(v - fastestRaceLap) < 0.0005) return "mono mpg-timecell mpg-pace-fl";
            if (Number.isFinite(d.bestLapSeconds) && Math.abs(v - d.bestLapSeconds) < 0.0005) return "mono mpg-timecell mpg-pace-pb";
            return "mono mpg-timecell mpg-pace-slow";
        };
        const headers = ["Pos", "Car image + Car name", "Driver", "RS", "Current"].concat(visibleLapNumbers.map(n => `Lap ${n}`));
        const rows = rowWin.items.map(({ row: x, pos }) => {
            const d = x.driver;
            const live = currentDistanceAtTime_(d, canFull ? d.finalTime : elapsed);
            const lapStartIndex = Math.floor(live.segmentIndex / Math.max(1, analysis.segmentsPerLap)) * Math.max(1, analysis.segmentsPerLap) - 1;
            const lapStartTime = live.segmentIndex > 0 ? (d.cumulativeTimes?.[lapStartIndex] || 0) : 0;
            const currentLapSeconds = live.finished || canFull ? NaN : Math.max(0, elapsed - lapStartTime);
            let currentCls = "mono mpg-timecell";
            if (Number.isFinite(currentLapSeconds)) {
                if (Number.isFinite(d.bestLapSeconds) && currentLapSeconds > d.bestLapSeconds * 1.07) currentCls += " mpg-current-slow";
                else if (Number.isFinite(d.bestLapSeconds) && currentLapSeconds > d.bestLapSeconds) currentCls += " mpg-current-over";
                else currentCls += " mpg-current-live";
            }
            const currentLapText = live.finished || canFull
                ? (d.crashed ? "DNF" : "Finished")
                : (visualRaceHasStarted_() ? formatTimeSeconds_(currentLapSeconds) : missingLapText_());
            const lapCells = visibleLapNumbers.map(lapNumber => {
                const v = visibleDriverLapTime_(d, lapNumber, elapsed, canFull);
                return `<td class="${lapCellClass(d, v)}">${Number.isFinite(v) ? formatTimeSeconds_(v) : missingLapText_()}</td>`;
            }).join("");
            return `<tr${focusRowDataAttrs_(d)}><td data-sort="${pos}">${pos}</td><td>${carComboCell_(d)}</td><td>${driverNameCell_(d)}</td><td class="mono">${driverRsCell_(d)}</td><td class="${currentCls}">${currentLapText}</td>${lapCells}</tr>`;
        });
        const lapNote = isWindowedLaps
            ? `<div class="mpg-note">Large race protection: showing ${visibleLapNumbers.length}/${lapCount} lap columns (${visibleLapNumbers[0]}-${visibleLapNumbers[visibleLapNumbers.length - 1]}). Full lap data is still kept internally/exportable.</div>`
            : "";
        return `${focusedWindowNote_(rowWin, "Lap Recording")}${lapNote}${renderTable_(headers, rows, "Waiting for decoded lap data...", "Lap Recording", { windowed: rowWin.windowed })}`;
    }

    function currentSpeedAndG_(d, elapsed) {
        const state = currentDistanceAtTime_(d, elapsed);
        if (!telemetryCanSample_(elapsed)) {
            return {
                speed: NaN,
                g: NaN,
                lateralG: NaN,
                combinedG: NaN,
                routeAvailable: !!analysis?.routeModel,
                state
            };
        }
        const i = clamp_(state.segmentIndex || 0, 0, d.segmentTimes.length - 1);
        const start = Math.max(0, i - Math.floor(telemetrySmoothing / 2));
        const end = Math.min(d.segmentTimes.length - 1, i + Math.floor(telemetrySmoothing / 2));
        let dist = 0, time = 0;
        for (let j = start; j <= end; j++) { dist += d.segmentDistancesMeters?.[j] || 0; time += d.segmentTimes?.[j] || 0; }
        const speed = time > 0 ? dist / time : NaN;
        const prevSpeed = i > 0 && d.segmentTimes[i - 1] > 0 ? (d.segmentDistancesMeters[i - 1] || 0) / d.segmentTimes[i - 1] : speed;
        const dt = i > 0 ? (d.segmentTimes[i] + d.segmentTimes[i - 1]) / 2 : d.segmentTimes[i];
        const g = calibrateLongitudinalG_(dt > 0 ? ((speed - prevSpeed) / dt) / 9.80665 : 0);
        const curv = analysis?.routeModel ? routeCurvatureAtMeters_(analysis.routeModel, state.distance) : NaN;
        const lateralG = calibrateLateralG_(Number.isFinite(speed) && Number.isFinite(curv) ? (speed * speed * curv) / 9.80665 : NaN);
        const combinedG = Math.sqrt(Math.pow(Number.isFinite(g) ? g : 0, 2) + Math.pow(Number.isFinite(lateralG) ? lateralG : 0, 2));
        return { speed, g, lateralG, combinedG, routeAvailable: !!analysis?.routeModel, state };
    }

    function gyroColor_(longG) {
        if (!Number.isFinite(longG)) return "var(--gapPos)";
        const t = clamp_(longG / 1.2, -1, 1);
        if (t >= 0) {
            const g = Math.round(190 + 60 * t);
            return `rgb(${Math.round(255 - 160 * t)},${g},${Math.round(80 - 45 * t)})`;
        }
        const b = -t;
        return `rgb(${Math.round(255)},${Math.round(190 - 125 * b)},${Math.round(70 - 40 * b)})`;
    }

    function gyroPointHtml_(d, elapsed, includeTrace = true) {
        const { speed, g, lateralG, combinedG, routeAvailable } = currentSpeedAndG_(d, elapsed);
        const active = telemetryCanSample_(elapsed);
        const shownLat = Number.isFinite(lateralG) ? -lateralG : 0;
        const shownLong = Number.isFinite(g) ? g : 0;
        const x = clamp_(50 + shownLat * 28, 8, 92);
        const y = clamp_(50 + shownLong * 28, 8, 92);
        const color = gyroColor_(g);
        const key = d.driverId || d.name || "driver";
        const now = Date.now();
        let trail = gyroTraceByDriver.get(key) || [];
        if (includeTrace && experimentalGyroTrace && active) {
            trail = trail.filter(p => now - p.at <= 5000);
            const last = trail[trail.length - 1];
            if (!last || Math.abs(last.x - x) > 0.6 || Math.abs(last.y - y) > 0.6) {
                trail.push({ x, y, color, at: now });
            }
            gyroTraceByDriver.set(key, trail);
        } else {
            trail = [];
            gyroTraceByDriver.set(key, trail);
        }
        const traceHtml = trail.map(p => {
            const age = clamp_((now - p.at) / 5000, 0, 1);
            const opacity = (0.42 * (1 - age)).toFixed(2);
            const size = Math.max(4, 9 - age * 4).toFixed(1);
            return `<span class="mpg-gyro-trace" style="left:${p.x}%;top:${p.y}%;background:${escAttr_(p.color)};opacity:${opacity};width:${size}px;height:${size}px"></span>`;
        }).join("");
        return {
            speed, g, lateralG, combinedG, routeAvailable,
            x, y, color,
            html: `${traceHtml}<span class="mpg-gyro-dot" style="left:${x}%;top:${y}%;--gyroColor:${escAttr_(color)}"></span>`
        };
    }

    function baseFuelL100Km_(d) {
        const car = toOgCarName_(d?.car || "");
        return FUEL_BASE_L100KM[car] || 10.5;
    }

    function fuelCacheKey_(d) {
        return `${analysis?.raceId || raceMeta?.raceId || raceDataPayloadKey_(analysis?.payload || latestRaceDataPayload || {})}|${d?.driverId || normalizeDriverName_(d?.name || "")}|${toOgCarName_(d?.car || "")}`;
    }

    function fuelInstantL100Km_(d, segmentIndex, base) {
        const i = clamp_(Math.round(Number(segmentIndex) || 0), 0, Math.max(0, (d?.segmentTimes?.length || 1) - 1));
        const dist = Number(d?.segmentDistancesMeters?.[i]) || 0;
        const time = Number(d?.segmentTimes?.[i]) || 0;
        const speed = time > 0 ? dist / time : NaN;
        const prev = i > 0 && d.segmentTimes[i - 1] > 0 ? (Number(d.segmentDistancesMeters[i - 1]) || 0) / d.segmentTimes[i - 1] : speed;
        const dt = i > 0 ? (d.segmentTimes[i] + d.segmentTimes[i - 1]) / 2 : d.segmentTimes[i];
        const g = Number.isFinite(speed) && Number.isFinite(prev) && dt > 0 ? ((speed - prev) / dt) / 9.80665 : 0;
        const speedKmh = Number.isFinite(speed) ? speed * 3.6 : 0;
        const throttleLoad = Math.max(0, g) * 1.25;
        const brakeLift = Math.max(0, -g) * 0.55;
        const speedLoad = clamp_(speedKmh / 260, 0, 1.8) * 1.15;
        return Math.max(base * 0.45, base * (1.35 + speedLoad + throttleLoad - brakeLift));
    }

    function fuelSnapshot_(d, elapsed, options = {}) {
        const base = baseFuelL100Km_(d);
        const state = currentDistanceAtTime_(d, elapsed);
        const activeIndex = clamp_(state.segmentIndex || 0, 0, Math.max(0, (d.segmentTimes?.length || 1) - 1));
        let liters = 0;
        let meters = 0;
        for (let i = 0; i <= activeIndex; i++) {
            const segMeters = Number(d.segmentDistancesMeters?.[i]) || 0;
            const segSeconds = Math.max(0.001, Number(d.segmentTimes?.[i]) || 0);
            let portion = i < activeIndex || state.finished ? 1 : clamp_((state.segmentElapsed || 0) / segSeconds, 0, 1);
            if (!telemetryCanSample_(elapsed)) portion = 0;
            const km = (segMeters * portion) / 1000;
            meters += segMeters * portion;
            liters += fuelInstantL100Km_(d, i, base) * km / 100;
        }
        const currentL100 = telemetryCanSample_(elapsed) ? fuelInstantL100Km_(d, activeIndex, base) : NaN;
        const km = Math.max(0, meters / 1000);
        const avgL100 = km > 0 ? liters / km * 100 : NaN;
        const tankLiters = 50;
        const calculatedLevelPct = clamp_((tankLiters - liters) / tankLiters * 100, 0, 100);
        if (options?.persist === false) {
            return { base, currentL100, avgL100, liters, km, tankLiters, levelPct: calculatedLevelPct };
        }
        const key = fuelCacheKey_(d);
        if (fuelSessionCache.key !== key) fuelSessionCache = { key, liters: 0, levelPct: 100 };
        fuelSessionCache.liters = Math.max(fuelSessionCache.liters || 0, liters);
        fuelSessionCache.levelPct = Math.min(Number.isFinite(fuelSessionCache.levelPct) ? fuelSessionCache.levelPct : 100, calculatedLevelPct);
        return { base, currentL100, avgL100, liters: fuelSessionCache.liters, km, tankLiters, levelPct: fuelSessionCache.levelPct };
    }

    function fuelLifetimeKey_(d) {
        return `${d?.driverId || currentDriverId_() || ""}|${toOgCarName_(d?.car || "")}`;
    }

    function ensureFuelLifetimeSummary_(d) {
        const key = fuelLifetimeKey_(d);
        if (!key || fuelLifetimeCache.loading) return;
        if (fuelLifetimeCache.key === key && Date.now() - (fuelLifetimeCache.fetchedAt || 0) < 60000) return;
        fuelLifetimeCache = { key, fetchedAt: Date.now(), data: fuelLifetimeCache.key === key ? fuelLifetimeCache.data : null, loading: true, error: "" };
        pgLocalFetchFuelSummary({
            driverId: d?.driverId || currentDriverId_() || "",
            car: toOgCarName_(d?.car || ""),
            baseL100: baseFuelL100Km_(d),
            currentRaceId: analysis?.raceId || raceMeta?.raceId || ""
        }).then(result => {
            fuelLifetimeCache = {
                key,
                fetchedAt: Date.now(),
                data: result?.ok ? result : null,
                loading: false,
                error: result?.ok ? "" : (result?.error || "Fuel summary unavailable")
            };
            uiDirty = true; scheduleRender_();
        }).catch(error => {
            fuelLifetimeCache = { key, fetchedAt: Date.now(), data: null, loading: false, error: pgErrorMessage_(error, "Fuel summary unavailable") };
        });
    }

    function fuelLifetimeSnapshot_(d, sessionFuel) {
        ensureFuelLifetimeSummary_(d);
        const data = fuelLifetimeCache.key === fuelLifetimeKey_(d) ? fuelLifetimeCache.data : null;
        const previousLiters = Number(data?.totalLiters || 0);
        const previousKm = Number(data?.totalKm || 0);
        const liters = previousLiters + (Number(sessionFuel?.liters) || 0);
        const km = previousKm + (Number(sessionFuel?.km) || 0);
        return {
            liters,
            km,
            avgL100: km > 0 ? liters / km * 100 : NaN,
            races: Number(data?.races || 0),
            manufacturerL100: Number(data?.manufacturerL100 || sessionFuel?.base || baseFuelL100Km_(d))
        };
    }

    function formatFuelEconomy_(l100) {
        if (!Number.isFinite(l100) || l100 <= 0) return "--";
        if (fuelDisplayStyle === "mpg_us") return `${(235.214583 / l100).toFixed(1)} mpg US`;
        if (fuelDisplayStyle === "mpg_uk") return `${(282.480936 / l100).toFixed(1)} mpg UK`;
        return `${l100.toFixed(1)} L/100km`;
    }

    function formatFuelVolume_(liters) {
        if (!Number.isFinite(liters) || liters < 0) return "--";
        if (fuelDisplayStyle === "mpg_us") return `${(liters / 3.785411784).toFixed(2)} gal US`;
        return `${liters.toFixed(2)} L`;
    }

    function fuelVolumeUnitLabel_() {
        return fuelDisplayStyle === "mpg_us" ? "gal US" : "L";
    }

    function renderFuelPanel_(d, elapsed) {
        if (!fuelEnabled || !d) return "";
        if (!telemetryCanSample_(elapsed)) {
            return `<div class="mpg-note">Fuel estimate starts once visible race or replay progress begins.</div>`;
        }
        const fuel = fuelSnapshot_(d, elapsed);
        return `<div class="mpg-fuel-panel">
          <div class="mpg-fuel-stat"><span>Fuel now</span><b>${esc_(formatFuelEconomy_(fuel.currentL100))}</b></div>
          <div class="mpg-fuel-stat"><span>Average</span><b>${esc_(formatFuelEconomy_(fuel.avgL100))}</b></div>
          <div class="mpg-fuel-stat"><span>Fuel level</span><b>${fuel.levelPct.toFixed(1)}%</b></div>
          <div class="mpg-fuel-stat"><span>Baseline</span><b>${esc_(formatFuelEconomy_(fuel.base))}</b></div>
        </div>`;
    }

    function renderFuelMode_(elapsed) {
        if (!fuelEnabled) return `<div class="mpg-note">Fuel Consumption is disabled in Settings.</div>`;
        const d = analysis?.drivers?.find(isUserDriver_) || analysis?.drivers?.[0];
        if (!d) return `<div class="mpg-note">Fuel estimate is waiting for race participants.</div>`;
        const fuel = telemetryCanSample_(elapsed) ? fuelSnapshot_(d, elapsed) : { currentL100: NaN, avgL100: NaN, liters: 0, tankLiters: 50, levelPct: 100, base: baseFuelL100Km_(d) };
        const lifetime = fuelLifetimeSnapshot_(d, fuel);
        return `<div class="mpg-table-label">Session fuel data (${esc_(fuelDisplayStyle === "mpg_us" ? "mpg US" : fuelDisplayStyle === "mpg_uk" ? "mpg UK" : "L/100km")}) - ${driverWithRsCell_(d)}</div>
          <div class="mpg-fuel-panel">
            <div class="mpg-fuel-stat"><span>Current Fuel consumption</span><b>${esc_(formatFuelEconomy_(fuel.currentL100))}</b></div>
            <div class="mpg-fuel-stat"><span>Average Fuel consumption</span><b>${esc_(formatFuelEconomy_(fuel.avgL100))}</b></div>
            <div class="mpg-fuel-stat"><span>Current fuel level</span><b>${fuel.levelPct.toFixed(1)}%</b></div>
          </div>
          <div class="mpg-table-label">Life-time fuel data (${esc_(fuelVolumeUnitLabel_())})</div>
          <div class="mpg-fuel-panel">
            <div class="mpg-fuel-stat"><span>Fuel Consumption</span><b>${esc_(formatFuelVolume_(lifetime.liters))}</b></div>
            <div class="mpg-fuel-stat"><span>Average Fuel Consumption</span><b>${esc_(formatFuelEconomy_(lifetime.avgL100))}</b></div>
            <div class="mpg-fuel-stat"><span>Manufacturer's values</span><b>${esc_(formatFuelEconomy_(Number.isFinite(lifetime.manufacturerL100) ? lifetime.manufacturerL100 : fuel.base))}</b></div>
          </div>`;
    }

    function renderAccelTable_(elapsed) {
        const active = telemetryCanSample_(elapsed);
        const ordered = getLiveOrder_(elapsed);
        const win = focusedOrderWindow_(ordered);
        const rows = win.items.map(({ row: x, pos }) => {
            const { g } = currentSpeedAndG_(x.driver, elapsed);
            const state = !active || !Number.isFinite(g) ? "--" : g > 0.03 ? "Accel" : g < -0.03 ? "Brake" : "Coast";
            const key = String(x.driver.driverId || normalizeDriverName_(x.driver.name || ""));
            return `<tr data-mpg-accel-driver="${escAttr_(key)}"${focusRowDataAttrs_(x.driver)}><td data-accel-field="pos">${pos}</td><td>${carComboCell_(x.driver)}</td><td>${driverWithRsCell_(x.driver)}</td><td class="mono" data-accel-field="g">${formatG_(g)}</td><td data-accel-field="state">${state}</td></tr>`;
        });
        return `${focusedWindowNote_(win, "Accel/Brake")}${renderTable_(["Pos", "Car image + Car name", "Driver (RS)", "Current Accel/Brake", "State"], rows, "Waiting for acceleration data...", "Accel/Brake", { windowed: win.windowed })}`;
    }

    function driverTelemetryStats_(d, elapsed, canFull) {
        if (!canFull && !telemetryCanSample_(elapsed)) {
            return { topSpeedMps: NaN, slowestSpeedMps: NaN, highestG: NaN, lowestG: NaN, highestLateralG: NaN };
        }
        if (canFull && d?.fullTelemetryStats) return d.fullTelemetryStats;
        const limitIndex = canFull ? d.segmentTimes.length - 1 : currentDistanceAtTime_(d, elapsed).segmentIndex;
        const speeds = [];
        const gs = [];
        const lateralGs = [];
        const combinedGs = [];
        for (let i = 0; i <= limitIndex && i < d.segmentTimes.length; i++) {
            const sp = d.segmentTimes[i] > 0 ? (d.segmentDistancesMeters?.[i] || 0) / d.segmentTimes[i] : NaN;
            if (Number.isFinite(sp)) speeds.push(sp);
            let longG = NaN;
            if (i > 0) {
                const prev = d.segmentTimes[i - 1] > 0 ? (d.segmentDistancesMeters?.[i - 1] || 0) / d.segmentTimes[i - 1] : NaN;
                const dt = (d.segmentTimes[i] + d.segmentTimes[i - 1]) / 2;
                longG = calibrateLongitudinalG_(Number.isFinite(prev) && dt > 0 ? ((sp - prev) / dt) / 9.80665 : NaN);
                if (Number.isFinite(longG)) gs.push(longG);
            }
            if (analysis?.routeModel && Number.isFinite(sp)) {
                const curv = routeCurvatureAtMeters_(analysis.routeModel, d.cumulativeDistances?.[i] || 0);
                const latG = calibrateLateralG_(Number.isFinite(curv) ? (sp * sp * curv) / 9.80665 : NaN);
                if (Number.isFinite(latG)) lateralGs.push(Math.abs(latG));
                if (Number.isFinite(longG) || Number.isFinite(latG)) {
                    combinedGs.push(Math.sqrt(Math.pow(Number.isFinite(longG) ? longG : 0, 2) + Math.pow(Number.isFinite(latG) ? latG : 0, 2)));
                }
            }
        }
        const stats = {
            topSpeedMps: maxFinite_(speeds),
            slowestSpeedMps: minFinite_(speeds),
            highestG: maxFinite_(combinedGs.length ? combinedGs : gs),
            lowestG: minFinite_(gs),
            highestLateralG: maxFinite_(lateralGs)
        };
        if (canFull && d) {
            d.fullTelemetryStats = stats;
            d.topSpeedMps = stats.topSpeedMps;
            d.slowestSpeedMps = stats.slowestSpeedMps;
            d.highestG = stats.highestG;
            d.lowestG = stats.lowestG;
            d.highestLateralG = stats.highestLateralG;
        }
        return stats;
    }

    function ensureFullTelemetryStats_() {
        if (!analysis?.drivers?.length) return;
        for (const d of analysis.drivers) driverTelemetryStats_(d, Infinity, true);
    }

    function renderAccelMode_(elapsed) {
        return renderGyroMode_(elapsed);
    }

    function sectorNumberForSegment_(segmentIndex) {
        const segInLap = (segmentIndex % Math.max(1, analysis?.segmentsPerLap || 1)) + 1;
        const splits = analysis?.sectorSplitIndexes || [1, 2, 3];
        if (segInLap <= splits[0]) return 1;
        if (segInLap <= splits[1]) return 2;
        return 3;
    }

    function driverSlideEvents_(d, elapsed) {
        if (!d?.segmentTimes?.length || !analysis?.routeModel) return [];
        const full = analysisCanShowFullRace_() && !shouldRenderReplayMoment_();
        const limitIndex = full ? d.segmentTimes.length - 1 : currentDistanceAtTime_(d, elapsed).segmentIndex;
        const cached = slideEventsCache.get(d);
        if (cached && cached.full === full && cached.limitIndex === limitIndex && cached.routeModel === analysis.routeModel && cached.smoothing === telemetrySmoothing) return cached.events;
        const events = [];
        for (let i = 1; i <= limitIndex && i < d.segmentTimes.length; i++) {
            const prevSpeed = d.segmentTimes[i - 1] > 0 ? (d.segmentDistancesMeters?.[i - 1] || 0) / d.segmentTimes[i - 1] : NaN;
            const speed = d.segmentTimes[i] > 0 ? (d.segmentDistancesMeters?.[i] || 0) / d.segmentTimes[i] : NaN;
            if (!Number.isFinite(prevSpeed) || !Number.isFinite(speed)) continue;
            const dropKmh = (prevSpeed - speed) * 3.6;
            const curv = routeCurvatureAtMeters_(analysis.routeModel, d.cumulativeDistances?.[i] || 0);
            const lateral = Math.abs(calibrateLateralG_(Number.isFinite(curv) ? (speed * speed * curv) / 9.80665 : NaN));
            const lap = Math.floor(i / Math.max(1, analysis.segmentsPerLap || 1)) + 1;
            const sector = sectorNumberForSegment_(i);
            const sectorTime = (d.sectorTimes || []).find(s => s.lap === lap && s.sector === sector)?.seconds;
            const bestSector = minFinite_((d.sectorTimes || []).filter(s => s.sector === sector).map(s => s.seconds));
            const lost = Number.isFinite(sectorTime) && Number.isFinite(bestSector) ? sectorTime - bestSector : NaN;
            if (dropKmh >= 12 && lateral >= 1.05 && (!Number.isFinite(lost) || lost >= 0.45)) {
                events.push({ lap, sector, dropKmh, lateral, lost });
            }
        }
        const result = events.slice(-5);
        slideEventsCache.set(d, { full, limitIndex, routeModel: analysis.routeModel, smoothing: telemetrySmoothing, events: result });
        return result;
    }

    function renderSlideEventsTable_(d, elapsed) {
        const events = driverSlideEvents_(d, elapsed);
        const rows = events.map(e => `<tr><td>Lap ${e.lap}</td><td>S${e.sector}</td><td>Possible slide / grip loss</td><td class="mono">${e.dropKmh.toFixed(1)} km/h</td><td class="mono">${formatG_(e.lateral)}</td><td class="mono">${Number.isFinite(e.lost) ? formatGapChangeSeconds_(e.lost) : "--"}</td></tr>`);
        return renderTable_(["Lap", "Sector", "Event", "Speed drop", "Cornering load", "Sector loss"], rows, "No slide candidates detected for the visible data.", "Grip Events");
    }

    function renderSpeedMode_(elapsed, canFull) {
        if (!analysis.lapMeters) return `<div class="mpg-note">Track distance unknown — speed unavailable.</div>`;
        const ordered = getLiveOrder_(elapsed);
        const win = focusedOrderWindow_(ordered);
        const rows = win.items.map(({ row: x, pos }) => {
            const d = x.driver;
            const { speed } = currentSpeedAndG_(d, elapsed);
            const stats = driverTelemetryStats_(d, elapsed, canFull);
            const avgState = currentDistanceAtTime_(d, canFull ? d.finalTime : elapsed);
            const avgTime = canFull ? d.finalTime : Math.max(0.001, elapsed);
            const avgSpeed = avgTime > 0 ? (avgState.distance || 0) / avgTime : NaN;
            return `<tr${focusRowDataAttrs_(d)}><td>${pos}</td><td>${carComboCell_(d)}</td><td>${driverWithRsCell_(d)}</td><td class="mono">${formatSpeed_(speed)}</td><td class="mono">${formatSpeed_(stats.topSpeedMps)}</td><td class="mono">${formatSpeed_(avgSpeed)}</td></tr>`;
        });
        return `${focusedWindowNote_(win, "Speed")}${renderTable_(["Pos", "Car image + Car name", "Driver (RS)", "Current Speed", "Top Speed", "Avg Speed"], rows, "Waiting for speed data...", "Speed", { windowed: win.windowed })}`;
    }

    function renderSectorsMode_(elapsed, canFull) {
        const sectorVisible = (d, s) => {
            if (canFull) return true;
            const endIndex = (s.lap - 1) * analysis.segmentsPerLap + analysis.sectorSplitIndexes[s.sector - 1] - 1;
            return (d.cumulativeTimes?.[endIndex] || Infinity) <= elapsed;
        };
        const best = [];
        const bestBySector = {};
        for (const sector of [1, 2, 3]) {
            const all = analysis.drivers.flatMap(d => (d.sectorTimes || []).filter(s => s.sector === sector && sectorVisible(d, s)).map(s => ({ d, s }))).sort((a, b) => a.s.seconds - b.s.seconds);
            if (all[0]) {
                bestBySector[sector] = all[0].s.seconds;
                best.push(`<tr${focusRowDataAttrs_(all[0].d)}><td>S${sector}</td><td>${carComboCell_(all[0].d)}</td><td>${driverWithRsCell_(all[0].d)}</td><td class="mono mpg-purple">${formatTimeSeconds_(all[0].s.seconds)}</td><td>${all[0].s.lap}</td></tr>`);
            }
        }
        const ordered = getLiveOrder_(canFull ? Infinity : elapsed, canFull);
        const win = focusedOrderWindow_(ordered);
        const perDriverModels = win.items.map(({ row: x }) => {
            const d = x.driver;
            const raw = [1, 2, 3].map(sec => {
                const vals = (d.sectorTimes || []).filter(s => s.sector === sec && sectorVisible(d, s)).map(s => s.seconds);
                return vals.length ? Math.min(...vals) : NaN;
            });
            const theoretical = raw.every(Number.isFinite) ? raw.reduce((a, b) => a + b, 0) : NaN;
            const diff = Number.isFinite(theoretical) && Number.isFinite(d.bestLapSeconds) ? theoretical - d.bestLapSeconds : NaN;
            return { d, raw, theoretical, diff };
        });
        const bestTheoretical = minFinite_(perDriverModels.map(row => row.theoretical));
        const maxDiff = maxFinite_(perDriverModels.map(row => row.diff).filter(v => Number.isFinite(v) && v > 0));
        const diffStyle = diff => {
            if (!Number.isFinite(diff)) return "";
            const ratio = Number.isFinite(maxDiff) && maxDiff > 0 ? clamp_(Math.max(0, diff) / maxDiff, 0, 1) : 0;
            const hue = 58 - ratio * 54;
            return `color:hsl(${hue.toFixed(1)} 96% 58%) !important;text-shadow:0 0 7px hsla(${hue.toFixed(1)} 96% 48% / .30)`;
        };
        const ideal = [1, 2, 3].map(sec => bestBySector[sec]).filter(Number.isFinite);
        const idealLap = ideal.length === 3 ? ideal.reduce((a, b) => a + b, 0) : NaN;
        const fastestRaceLap = minFinite_(analysis.drivers.map(d => d.bestLapSeconds));
        const delta = Number.isFinite(idealLap) && Number.isFinite(fastestRaceLap) ? idealLap - fastestRaceLap : NaN;
        const driverHeaders = ["Metric"].concat(perDriverModels.map(({ d }) => {
            const rs = formatDriverRs_(d.racingSkill).replace(/^RS:\s*/i, "");
            return `${d.name || "--"} (${rs})`;
        }));
        const metricRow = (label, cells) => `<tr><td><b>${esc_(label)}</b></td>${cells.join("")}</tr>`;
        const perDriver = [
            metricRow("Car", perDriverModels.map(({ d }) => `<td>${carComboCell_(d)}</td>`)),
            ...[0, 1, 2].map(idx => metricRow(`S${idx + 1}`, perDriverModels.map(({ raw }) => {
                const v = raw[idx];
                const cls = Number.isFinite(v) && Math.abs(v - bestBySector[idx + 1]) < 0.0005 ? "mono mpg-purple" : "mono";
                return `<td class="${cls}">${Number.isFinite(v) ? formatTimeSeconds_(v) : "--"}</td>`;
            }))),
            metricRow("Theoretical Lap", perDriverModels.map(({ theoretical }) => {
                const cls = Number.isFinite(theoretical) && Math.abs(theoretical - bestTheoretical) < 0.0005 ? "mono mpg-purple" : "mono";
                return `<td class="${cls}">${Number.isFinite(theoretical) ? formatTimeSeconds_(theoretical) : "--"}</td>`;
            })),
            metricRow("Difference to PB", perDriverModels.map(({ diff }) => `<td class="mono" style="${escAttr_(diffStyle(diff))}">${Number.isFinite(diff) ? formatGapChangeSeconds_(diff) : "--"}</td>`))
        ];
        const idealSummary = `Ideal Lap: ${Number.isFinite(idealLap) ? formatTimeSeconds_(idealLap) : "--"}${Number.isFinite(delta) ? ` (${formatGapChangeSeconds_(delta)} vs fastest race lap)` : ""}`;
        return `${renderTable_(["Sector", "Car image + Car name", "Driver (RS)", "Best Time", "Lap"], best, "Waiting for sector data...", "Best Sectors", { compact: true, summaryText: idealSummary })}
          ${focusedWindowNote_(win, "Per-driver sectors")}${renderTable_(driverHeaders, perDriver, "Waiting for per-driver sectors...", "Per-driver Best Sectors", { sortable: false, windowed: win.windowed })}`;
    }

    function renderPaceMode_(elapsed, canFull) {
        const fastestRaceLap = minFinite_(analysis.drivers.map(d => d.bestLapSeconds));
        const ordered = getLiveOrder_(elapsed);
        const win = focusedOrderWindow_(ordered);
        const rows = win.items.map(({ row: x, pos }) => {
            const d = x.driver;
            const effectiveElapsed = canFull ? d.finalTime : elapsed;
            const live = currentDistanceAtTime_(d, effectiveElapsed);
            const lapStartIndex = Math.floor(live.segmentIndex / Math.max(1, analysis.segmentsPerLap)) * Math.max(1, analysis.segmentsPerLap) - 1;
            const lapStartTime = live.segmentIndex > 0 ? (d.cumulativeTimes?.[lapStartIndex] || 0) : 0;
            const visibleLapTimes = canFull ? d.lapTimes : (d.validLapTimes || []).filter(l => {
                const endIndex = l.lap * analysis.segmentsPerLap - 1;
                return (d.cumulativeTimes?.[endIndex] || Infinity) <= elapsed;
            }).map(l => l.seconds);
            const avgSec = visibleLapTimes.length ? visibleLapTimes.reduce((a, b) => a + b, 0) / visibleLapTimes.length : null;
            const avg = avgSec ? formatTimeSeconds_(avgSec) : "--";
            const pb = visibleLapTimes.length ? Math.min(...visibleLapTimes) : NaN;
            const currentLapSeconds = live.finished || (canFull && !d.crashed) ? NaN : Math.max(0, effectiveElapsed - lapStartTime);
            let cls = "mono";
            if (Number.isFinite(currentLapSeconds)) {
                if (Number.isFinite(fastestRaceLap) && currentLapSeconds < fastestRaceLap) cls += " mpg-pace-fl";
                else if (Number.isFinite(pb) && currentLapSeconds < pb) cls += " mpg-pace-pb";
                else cls += " mpg-pace-slow";
            }
            const currentLap = live.finished || (canFull && !d.crashed) ? "Finished" : (visualRaceHasStarted_() ? formatTimeSeconds_(currentLapSeconds) : "--");
            return `<tr${focusRowDataAttrs_(d)}><td>${pos}</td><td>${carComboCell_(d)}</td><td>${driverWithRsCell_(d)}</td><td class="${cls}">${currentLap}</td><td class="mono">${Number.isFinite(pb) ? formatTimeSeconds_(pb) : "--"}</td><td class="mono">${avg}</td></tr>`;
        });
        return `${focusedWindowNote_(win, "Lap Pace")}${renderTable_(["Pos", "Car image + Car name", "Driver (RS)", "Current Lap Time", "PB", "Average Lap Time"], rows, "Waiting for lap pace data...", "Lap Pace", { windowed: win.windowed })}`;
    }

    function selectedGyroDriver_() {
        const selected = document.getElementById("mpgAnalysisBody")?.dataset?.gyroDriver || analysis?.drivers?.[0]?.name || "";
        return analysis?.drivers?.find(x => x.name === selected) || analysis?.drivers?.[0] || null;
    }

    function gyroStructureKey_(elapsed, canFull) {
        const d = selectedGyroDriver_();
        if (!d) return "waiting";
        const order = getLiveOrder_(elapsed, canFull).map(x => x.driver.driverId || normalizeDriverName_(x.driver.name || "")).join(",");
        const events = driverSlideEvents_(d, elapsed).map(e => `${e.lap}:${e.sector}:${e.dropKmh.toFixed(2)}:${Number.isFinite(e.lost) ? e.lost.toFixed(3) : ""}`).join(",");
        return `${d.driverId || normalizeDriverName_(d.name || "")}|${order}|${events}|${analysis?.routeModel ? 1 : 0}|${debugEnabled ? 1 : 0}`;
    }

    function updateGyroLive_(body, elapsed) {
        const d = selectedGyroDriver_();
        if (!body || !d) return;
        const gyro = gyroPointHtml_(d, elapsed, true);
        const dynamic = body.querySelector(".mpg-gyro-dynamic");
        if (dynamic) dynamic.innerHTML = gyro.html;
        const values = {
            speed: formatSpeed_(gyro.speed),
            longitudinal: formatG_(gyro.g),
            lateral: gyro.routeAvailable ? formatG_(-gyro.lateralG) : "--",
            combined: gyro.routeAvailable ? formatG_(gyro.combinedG) : "--"
        };
        body.querySelectorAll("[data-gyro-field]").forEach(el => {
            const key = el.getAttribute("data-gyro-field") || "";
            if (Object.prototype.hasOwnProperty.call(values, key)) el.textContent = values[key];
        });
        const active = telemetryCanSample_(elapsed);
        const ordered = getLiveOrder_(elapsed);
        const positions = new Map(ordered.map((x, i) => [String(x.driver.driverId || normalizeDriverName_(x.driver.name || "")), i + 1]));
        body.querySelectorAll("[data-mpg-accel-driver]").forEach(row => {
            const key = row.getAttribute("data-mpg-accel-driver") || "";
            const driver = analysis?.drivers?.find(x => String(x.driverId || normalizeDriverName_(x.name || "")) === key);
            if (!driver) return;
            const { g } = currentSpeedAndG_(driver, elapsed);
            const state = !active || !Number.isFinite(g) ? "--" : g > 0.03 ? "Accel" : g < -0.03 ? "Brake" : "Coast";
            const pos = row.querySelector('[data-accel-field="pos"]');
            const gCell = row.querySelector('[data-accel-field="g"]');
            const stateCell = row.querySelector('[data-accel-field="state"]');
            if (pos) pos.textContent = String(positions.get(key) || "--");
            if (gCell) gCell.textContent = formatG_(g);
            if (stateCell) stateCell.textContent = state;
        });
    }

    function renderGyroMode_(elapsed) {
        const d = selectedGyroDriver_();
        if (!d) return `<div class="mpg-note">Gyro data is waiting for race participants.</div>`;
        const gyro = gyroPointHtml_(d, elapsed, true);
        const { speed, g, lateralG, combinedG, routeAvailable } = gyro;
        const routeHelp = routeAvailable
            ? "Lateral G is estimated from SVG route curvature and segment speed. Longitudinal G and speed are estimated from segment timing. Dot direction is cockpit G-force: right turns pull left, acceleration pulls down."
            : `Longitudinal G and speed are estimated from segment timing. Lateral G requires a usable SVG route path.${debugEnabled ? " Route path is currently unavailable." : ""}`;
        const buttons = analysis.drivers.map(driver => {
            const active = driver.name === d.name;
            const rs = formatDriverRs_(driver.racingSkill).replace(/^RS:\s*/i, "RS ");
            const car = toOgCarName_(driver.car) || "--";
            return `<button type="button" class="mpg-gyro-driver${active ? " active" : ""}" data-driver="${escAttr_(driver.name)}"><span class="mpg-gyro-name">${esc_(driver.name)}</span><span class="mpg-gyro-meta">${esc_(rs)} / ${esc_(car)}</span></button>`;
        }).join("");
        const pad = `<div class="mpg-gyro-pad">
          <span class="mpg-gyro-label">G-force Live</span>
          <span class="mpg-gyro-ring r05"><span class="mpg-gyro-ring-label">0.5g</span></span>
          <span class="mpg-gyro-ring r10"><span class="mpg-gyro-ring-label">1.0g</span></span>
          <span class="mpg-gyro-ring r15"><span class="mpg-gyro-ring-label">1.5g</span></span>
          <span class="mpg-gyro-axis-label left">L</span><span class="mpg-gyro-axis-label right">R</span>
          <span class="mpg-gyro-axis-label top">Brake</span><span class="mpg-gyro-axis-label bottom">Accel</span>
          <span class="mpg-gyro-dynamic">${gyro.html}</span>
        </div>`;
        const help = `<button type="button" class="mpg-table-help" aria-label="${escAttr_(routeHelp)}" data-help="${escAttr_(routeHelp)}">?</button>`;
        return `<div class="mpg-gyro">${pad}<div class="mpg-gyro-panel"><div class="mpg-gyro-title"><span>${driverNameCell_(d)}</span><span class="mpg-gyro-title-tools">${help}<span class="mpg-badge">${esc_(formatDriverRs_(d.racingSkill))}</span></span></div><div class="mpg-gyro-readout"><div><span>Speed</span><b class="mono" data-gyro-field="speed">${formatSpeed_(speed)}</b></div><div><span>Longitudinal</span><b class="mono" data-gyro-field="longitudinal">${formatG_(g)}</b></div><div><span>Lateral</span><b class="mono" data-gyro-field="lateral">${routeAvailable ? formatG_(-lateralG) : "--"}</b></div><div><span>Combined</span><b class="mono" data-gyro-field="combined">${routeAvailable ? formatG_(combinedG) : "--"}</b></div></div><div class="mpg-gyro-drivers">${buttons}</div></div></div>${renderSlideEventsTable_(d, elapsed)}${renderAccelTable_(elapsed)}`;
    }

    function renderSummaryMode_(elapsed = getVisualElapsed_(), canFull = null) {
        const full = canFull == null ? (analysisCanShowFullRace_() && !shouldRenderReplayMoment_()) : !!canFull;
        if (!full && shouldRenderReplayMoment_()) {
            const ordered = getLiveOrder_(elapsed, false);
            const win = focusedOrderWindow_(ordered);
            const leaderDist = ordered[0]?.state?.distance || 0;
            const totalMeters = (analysis.lapMeters || 0) * (analysis.laps || 0);
            const rows = win.items.map(({ row: x, pos }) => {
                const d = x.driver;
                const state = x.state || currentDistanceAtTime_(d, elapsed);
                const lap = elapsed <= 0.05 ? 0 : (state.finished && !d.crashed ? analysis.laps : clamp_((state.lapIndex || 0) + 1, 1, analysis.laps || 1));
                const pct = totalMeters > 0 ? `${(clamp_(state.distance / totalMeters, 0, 1) * 100).toFixed(1)}%` : "--";
                const leaderGap = pos === 1 ? "0.000" : formatGapSeconds_(Math.max(0, driverReachTimeForDistance_(d, leaderDist) - elapsed));
                const { speed } = currentSpeedAndG_(d, elapsed);
                const status = state.finished ? (d.crashed ? "DNF" : "Finished") : `Lap ${lap}/${analysis.laps || "?"}`;
                return `<tr${focusRowDataAttrs_(d)}><td>${pos}</td><td>${carComboCell_(d)}</td><td>${driverWithRsCell_(d)}</td><td>${esc_(status)}</td><td>${esc_(pct)}</td><td class="mono">${leaderGap}</td><td class="mono">${formatSpeed_(speed)}</td></tr>`;
            });
            const label = getRaceContext_() === "replay" ? "Replay" : "Live race";
            return `<div class="mpg-note">${label} snapshot at ${esc_(formatTimeSeconds_(elapsed))}. Final totals appear when the visual race reaches the end.</div>${focusedWindowNote_(win, "Race Snapshot")}${renderTable_(["Pos","Car image + Car name","Driver (RS)","Status","Completion","Gap Leader","Current Speed"], rows, "Waiting for summary data...", "Race Snapshot", { windowed: win.windowed })}`;
        }
        if (!full) return `<div class="mpg-note">Post-race summary unlocks when the race finishes. Enable preview in Settings to inspect full delivered race data early.</div>`;
        const ordered = getLiveOrder_(Infinity, true);
        const win = focusedOrderWindow_(ordered);
        const rows = win.items.map(({ row: x, pos }) => {
            const d = x.driver;
            const stats = driverTelemetryStats_(d, Infinity, true);
            return `<tr${focusRowDataAttrs_(d)}><td>${pos}</td><td>${carComboCell_(d)}</td><td>${driverWithRsCell_(d)}</td><td>${d.crashed ? "DNF / Crashed" : "Finished"}</td><td class="mono">${formatTimeSeconds_(d.finalTime)}</td><td class="mono">${formatTimeSeconds_(d.bestLapSeconds)}</td><td class="mono">${formatTimeSeconds_(d.idealLapSeconds)}</td><td class="mono">${formatSpeed_(stats.topSpeedMps)}</td><td class="mono">${formatG_(stats.highestG)}</td></tr>`;
        });
        const leadWin = focusedOrderWindow_(analysis.drivers.slice().sort((a,b)=>(b.timeInLeadSeconds||0)-(a.timeInLeadSeconds||0)));
        const leadRows = leadWin.items.map(({ row: d }) => `<tr${focusRowDataAttrs_(d)}><td>${driverWithRsCell_(d)}</td><td class="mono">${formatLeadTime_(d.timeInLeadSeconds)}</td><td>${d.lapsLed || 0}</td><td>${d.segmentsLed || 0}</td><td class="mono">${formatLeadTime_(d.longestLeadStintSeconds)}</td><td>${Math.max(0, (d.leadChanges || 0) - 1)}</td></tr>`);
        return `${allowPreFinishPreview && !raceIsFinished_() ? `<div class="mpg-note">Preview mode — uses full race data already delivered to page.</div>` : ""}${focusedWindowNote_(win, "Summary")}${renderTable_(["Pos","Car image + Car name","Driver (RS)","Status","Total","Best Lap","Ideal Lap","Top Speed","Highest Est. G"], rows, "Waiting for summary data...", "Summary", { windowed: win.windowed })}${leadWin.windowed ? focusedWindowNote_(leadWin, "Lead History") : ""}${renderTable_(["Driver (RS)","Time in Lead","Laps Led","Segments Led","Longest Stint","Lead Changes"], leadRows, "No lead history yet.", "Lead History", { windowed: leadWin.windowed })}`;
    }

    function renderDriverStatsMode_(elapsed = getVisualElapsed_(), canFull = null) {
        canFull = canFull == null ? (analysisCanShowFullRace_() && !shouldRenderReplayMoment_()) : !!canFull;
        pgLocalEnsureTrackHistory_(analysis?.trackName || raceMeta?.track || "").catch(() => {});
        const ordered = getLiveOrder_(canFull ? Infinity : elapsed, canFull);
        const win = focusedOrderWindow_(ordered);
        const visibleDrivers = win.items.map(({ row }) => row.driver);
        const rows = win.items.map(({ row: x, pos }) => {
            const d = x.driver;
            const stats = driverTelemetryStats_(d, elapsed, canFull);
            return `<tr${focusRowDataAttrs_(d)}><td>${pos}</td><td>${carComboCell_(d)}</td><td>${driverWithRsCell_(d)}</td><td>${esc_(d.driverId || "--")}</td><td class="mono">${canFull ? formatTimeSeconds_(d.bestLapSeconds) : "--"}</td><td class="mono">${canFull ? formatTimeSeconds_(d.averageLapSeconds) : "--"}</td><td class="mono">${canFull ? formatTimeSeconds_(d.idealLapSeconds) : "--"}</td><td>${canFull && d.consistencyScore != null ? d.consistencyScore.toFixed(1) : "--"}</td><td>${canFull ? (d.sectorsWon || 0) : "--"}</td><td>${canFull ? (d.lapsLed || 0) : "--"}</td><td class="mono">${canFull ? formatLeadTime_(d.timeInLeadSeconds) : "--"}</td><td class="mono">${formatSpeed_(stats.topSpeedMps)}</td><td class="mono">${formatG_(stats.highestG)}</td></tr>`;
        });
        const note = canFull
            ? `<div class="mpg-note">Consistency is a 0–100 stability score based on completed lap variation: 100 − (lap-time standard deviation ÷ average lap × 100). Higher means more even lap times; lower means the driver's laps varied more.</div>`
            : shouldRenderReplayMoment_()
                ? `<div class="mpg-note">${getRaceContext_() === "replay" ? "Replay" : "Live race"} snapshot at ${esc_(formatTimeSeconds_(elapsed))}. Final lap-based stats appear when the visual race reaches the end.</div>`
                : `<div class="mpg-note">Live mode: final driver statistics stay hidden until finish. Consistency is calculated after completed laps are available.</div>`;
        const historyRows = visibleDrivers.map(d => {
            const h = getDriverTrackHistory_(d.driverId, d.name, analysis.trackName || raceMeta?.track || "");
            return `<tr${focusRowDataAttrs_(d)}><td>${carComboCell_(d)}</td><td>${driverWithRsCell_(d)}</td><td>${h?.races || 0}</td><td>${h?.avgFinish ? `P${h.avgFinish.toFixed(1)}` : "--"}</td><td>${h?.wins || 0}</td><td>${h?.podiums || 0}</td><td>${h?.crashes || 0}</td><td class="mono">${h?.bestLapMs ? msToTimeText_(h.bestLapMs, "lap") : "--"}</td><td>${Number.isFinite(h?.riskScore) ? h.riskScore.toFixed(0) : "--"}</td></tr>`;
        });
        return `${note}${focusedWindowNote_(win, "Driver Stats")}${renderTable_(["Pos","Car image + Car name","Driver (RS)","Driver ID","Best Lap","Average Lap","Ideal Lap","Consistency","Sectors Won","Laps Led","Time in Lead","Top Speed","Highest Est. G"], rows, "Waiting for driver stats...", "Driver Stats", { windowed: win.windowed })}<div class="mpg-note">Driver History on ${esc_(analysis.trackName || raceMeta?.track || "this track")} — saved locally after completed races and used by Predictions when enabled.</div>${renderTable_(["Car image + Car name","Driver (RS)","Races Here","Avg Finish","Wins","Podiums","Crashes","Best Lap Here","Risk"], historyRows, "No local track history yet.", "Driver History", { windowed: win.windowed })}`;
    }

    function trackWideDriverHistoryRows_(trackName, currentDrivers = []) {
        const track = trackName || raceMeta?.track || visibleRaceTrackName_() || "this track";
        const trackScope = getRecordTrackScope_("race", track);
        const current = new Set((currentDrivers || []).flatMap(d => {
            const keys = [];
            if (d?.driverId) keys.push(`id:${String(d.driverId).trim()}`);
            const nn = normalizeDriverName_(d?.name || "");
            if (nn) keys.push(`name:${nn}`);
            return keys;
        }));
        return Object.values(driverHistory || {})
            .filter(h => h && h.track && getRecordTrackScope_("race", h.track) === trackScope)
            .sort((a, b) => {
                const ad = String(a.lastRaceAtIso || "");
                const bd = String(b.lastRaceAtIso || "");
                if (ad !== bd) return bd.localeCompare(ad);
                return (b.races || 0) - (a.races || 0);
            })
            .map(h => {
                const keys = [];
                if (h.driverId) keys.push(`id:${String(h.driverId).trim()}`);
                const nn = normalizeDriverName_(h.driverName || "");
                if (nn) keys.push(`name:${nn}`);
                const onGrid = keys.some(k => current.has(k));
                return { h, onGrid };
            });
    }

    function renderPredictionPastRacesTable_(drivers, trackName) {
        const track = trackName || raceMeta?.track || visibleRaceTrackName_() || "this track";
        const scope = currentRaceHistoryScope_(track);
        pgLocalEnsureTrackHistory_(track).catch(() => {});
        const historyCache = pgLocalTrackHistoryCacheFor_(track);
        const current = new Set((drivers || []).flatMap(d => {
            const keys = [];
            if (d?.driverId) keys.push(`id:${String(d.driverId).trim()}`);
            const nn = normalizeDriverName_(d?.name || "");
            if (nn) keys.push(`name:${nn}`);
            return keys;
        }));
        const hasSqliteHistory = pgLocalTrackHistoryMatches_(track) && Array.isArray(historyCache?.rows) && historyCache.rows.length;
        const history = hasSqliteHistory
            ? historyCache.rows.map(row => {
                const h = pgLocalHistoryToDriverHistory_(row);
                const keys = [];
                if (h?.driverId) keys.push(`id:${String(h.driverId).trim()}`);
                const nn = normalizeDriverName_(h?.driverName || "");
                if (nn) keys.push(`name:${nn}`);
                return { h, onGrid: keys.some(k => current.has(k)) };
            })
            : [];
        const rows = history.map(({ h, onGrid }) => {
            const driver = { name: h.driverName || h.name || "--", driverId: h.driverId || "", racingSkill: h.lastRacingSkill };
            const car = h.lastCar || "";
            const lastSeen = h.lastRaceAtIso ? fmtWhen_(h.lastRaceAtIso) : "--";
            return `<tr><td>${carComboCell_(car, h.lastCarImg || "", "sqlite")}</td><td>${driverWithRsCell_(driver)}</td><td>${onGrid ? "Yes" : "No"}</td><td>${h.races || 0}</td><td>${h.avgFinish ? `P${h.avgFinish.toFixed(1)}` : "--"}</td><td>${h.wins || 0}</td><td>${h.podiums || 0}</td><td>${h.crashes || 0}</td><td class="mono">${h.bestLapMs ? msToTimeText_(h.bestLapMs, "lap") : "--"}</td><td class="mono">${h.bestRaceMs ? msToTimeText_(h.bestRaceMs, "race") : "--"}</td><td>${Number.isFinite(h.riskScore) ? h.riskScore.toFixed(0) : "--"}</td><td>${esc_(lastSeen)}</td></tr>`;
        });
        const historyError = historyCache?.error ? pgErrorMessage_(historyCache.error, "Race history unavailable") : "";
        const status = historyCache?.loading && pgLocalNorm_(historyCache.track) === pgLocalNorm_(track)
            ? " Loading race history..."
            : historyError && pgLocalNorm_(historyCache.track) === pgLocalNorm_(track)
                ? ` History unavailable: ${historyError}`
                : "";
        const emptyText = historyCache?.loading && pgLocalNorm_(historyCache.track) === pgLocalNorm_(track)
            ? "Loading Pit Guru race history..."
            : historyError && pgLocalNorm_(historyCache.track) === pgLocalNorm_(track)
                ? `Pit Guru race history unavailable: ${historyError}`
                : "No Pit Guru history for this track yet.";
        const scopeText = `${scope.raceType === "custom" ? "Custom" : "Official"}${scope.laps ? `, ${scope.laps} laps` : ""}`;
        const label = `Past Races on ${track} (${scopeText})`;
        const helpText = "This is matching history from completed races; current-grid drivers are marked in the Grid column.";
        const statusNote = status ? `<div class="mpg-note">${esc_(status.trim())}</div>` : "";
        return `${statusNote}${renderTable_(["Car image + Car name","Driver (RS)","Grid","Races Here","Avg Finish","Wins","Podiums","Crashes","Best Lap","Best Race","Risk","Last Seen"], rows, emptyText, label, { helpText })}`;
    }

    function renderPredictionsMode_(providedSet = null) {
        if (!enablePredictions) return `<div class="mpg-note">Pre-race predictions are disabled in Settings.</div>`;
        const rawSet = providedSet && typeof providedSet === "object" && Array.isArray(providedSet.drivers)
            ? providedSet
            : predictionDriverSet_();
        const set = {
            drivers: Array.isArray(rawSet?.drivers) ? rawSet.drivers : [],
            source: rawSet?.source || (analysis?.drivers?.length ? "raceData" : "visible"),
            trackName: rawSet?.trackName || analysis?.trackName || raceMeta?.track || visibleRaceTrackName_() || ""
        };
        if (!set.drivers.length) {
            return `<div class="mpg-note">Waiting for the race driver list. Predictions appear as soon as Pit Guru can see participants, before the race starts.</div>`;
        }
        const scored = rankedPredictionDrivers_(set.drivers, set.trackName).map(x => {
            const intel = useApiPredictions ? (x.d.driverIntel || getDriverIntelForDriver_(x.d)) : null;
            if (intel && !x.d.driverIntel) x.d.driverIntel = intel;
            const skill = Number.isFinite(x.d.racingSkill) ? x.d.racingSkill : intel?.racingSkill;
            const history = useHistoryPredictions ? getDriverTrackHistory_(x.d.driverId, x.d.name, set.trackName || "") : null;
            return Object.assign({}, x, { intel, skill, history, displayScore: Math.max(0.01, x.score) });
        });
        const total = scored.reduce((s, x) => s + x.displayScore, 0) || 1;
        const predWin = focusedOrderWindow_(scored, { force: largeFieldMode_() });
        const rows = predWin.items.map(({ row: x, index: i }) => {
            const win = x.displayScore / total * 100;
            const podium = clamp_(win * 2.5, 0, 95);
            const risk = Number(x.history?.riskScore);
            const conf = risk > 55 ? "Variable" : (x.intel && x.history?.races ? "High" : (x.intel || x.history?.races || Number.isFinite(x.skill) ? "Medium" : "Low"));
            const starts = Number.isFinite(x.intel?.racesEntered) ? x.intel.racesEntered : "--";
            const wins = Number.isFinite(x.intel?.racesWon) ? x.intel.racesWon : "--";
            const priors = x.history?.races || 0;
            const avgPos = x.history?.avgFinish ? `P${x.history.avgFinish.toFixed(1)}` : "--";
            return `<tr${focusRowDataAttrs_(x.d)}><td>${i + 1}</td><td>${carComboCell_(x.d)}</td><td>${driverWithRsCell_(x.d)}</td><td>${win.toFixed(1)}%</td><td>${podium.toFixed(1)}%</td><td>${(i + 1).toFixed(1)}</td><td>${conf}</td><td>${predictionIntelActionCell_(x.d, x.intel)}</td><td>${starts}</td><td>${wins}</td><td>${priors}</td><td>${avgPos}</td><td>${Number.isFinite(risk) ? risk.toFixed(0) : "--"}</td></tr>`;
        });
        const missingRs = scored.filter(x => !Number.isFinite(x.skill)).length;
        const pool = getDriverIntelPool_(set.drivers);
        const uncached = pool.filter(d => driverIntelNeedsProfileRefresh_(d.driverId, d.name)).length;
        const missingProfileIds = set.drivers.filter(d => !String(d.driverId || "").trim() && !getCachedDriverIntelByName_(d.name || "")).length;
        const rsNote = missingRs
            ? ` ${missingRs} driver${missingRs === 1 ? "" : "s"} missing RS; neutral RS is used for them.`
            : " RS was detected for every driver.";
        const hugeGrid = set.drivers.length >= HUGE_FIELD_THRESHOLD && !analysis?.drivers?.length;
        const apiNote = apiKey
            ? hugeGrid
                ? ` Driver Intel: huge grid mode is active (${set.drivers.length} drivers); automatic profile fetching is paused to keep Torn responsive. Use row Fetch for individual drivers.`
                : ` Driver Intel: ${uncached} uncached profile${uncached === 1 ? "" : "s"}${missingProfileIds ? `, ${missingProfileIds} visible row${missingProfileIds === 1 ? "" : "s"} without a profile ID` : ""}; Pit Guru auto-fetches one call per uncached driver after the grid settles.`
            : " Add an API key in Settings to auto-fetch Driver Intel before the race.";
        const historyNote = useHistoryPredictions ? " Same-track driver history is included when available." : " Same-track history is currently disabled in Settings.";
        const sourceNote = set.source === "visible"
            ? "Pre-race grid snapshot — no race result data is needed for this forecast."
            : "Forecast only — based on visible/API driver stats and local history, not the generated race result.";
        const historyTable = hugeGrid
            ? `<div class="mpg-note">Past Races on Track is skipped for huge pre-race grids to keep Torn responsive. Saved history still contributes to prediction scores when available.</div>`
            : renderPredictionPastRacesTable_(scored.map(x => x.d), set.trackName || "");
        const predictionHelpText = `${sourceNote}${apiNote}${rsNote}${historyNote}`.trim();
        return `${focusedWindowNote_(predWin, "Predictions")}${renderTable_(["Predicted Pos","Car image + Car name","Driver (RS)","Win Chance","Podium Chance","Expected Position","Confidence","Intel","Starts","Wins","Priors","Avg Pos","Risk"], rows, "Waiting for prediction data...", "Predictions", { helpText: predictionHelpText, windowed: predWin.windowed })}${historyTable}`;
    }

    function ensureUi_() {
        if (!document.getElementById("rtLapBtn")) {
            const b = document.createElement("div");
            b.id = "rtLapBtn";
            b.innerHTML = `
        <span id="rtBtnDot" class="recDot"></span>
        <b>Pit Guru</b>
        <span id="rtBtnCount" class="badge">(0)</span>
      `;
            b.addEventListener("click", (e) => {
                if (b.dataset.dragging === "1") { e.preventDefault(); e.stopPropagation(); return; }
                openWin_();
            });
            document.body.appendChild(b);

            makeDraggable_(b, b, { storeKey: "btn", clickGuardAttr: "dragging", noDragSelector: null });
        }

        if (!document.getElementById("rtLapWin")) {
            const w = document.createElement("div");
            w.id = "rtLapWin";
            w.innerHTML = `
        <div id="rtHdr">
          <div class="left">
            <div style="display:flex;align-items:center;gap:10px">
              <span class="title">Pit Guru</span><span id="rtCount" class="count">(0)</span>
            </div>
            <div id="rtVer" class="muted" style="font-size:11px;opacity:.85">v${MPG_VERSION} <span style="opacity:.8">· Powered by <a href="/profiles.php?XID=4022159" style="color:inherit;text-decoration:underline;text-underline-offset:2px;">MoDuL</a></span></div>
          </div>
          <div class="right">
            <button id="rtToggle" class="pill" title="Pit Guru uses Torn racingData JSON only">
              <span id="rtRecDotInline"></span>
              <span id="rtRecText">JSON</span>
            </button>
            <button id="rtLocalPlayer" class="pill" title="Cache this race and open the hosted player">
              <span>📡</span><span>Player</span>
            </button>
            <button id="mpgSettingsBtn" class="pill" title="Settings">
              <span>⚙️</span><span>Settings</span>
            </button>
            <button id="mpgGarageBtn" class="pill" title="My Garage">
              <span>🏎️</span><span>My Garage</span>
            </button>
            <button id="rtExportHtml" class="pill" title="Export HTML">
              <span>🧾</span><span>HTML</span>
            </button>
            <button id="rtImportHtml" class="pill" title="Import Pit Guru or legacy HTML exports into Records">
              <span>📄</span><span>Import</span>
            </button>
            <button id="rtToggleRecords" class="pill" title="Show/hide per-track records">
              <span>🏆</span><span>Records</span>
            </button>
            <button id="rtClear" class="pill" title="Clear displayed race data; Records stay saved">
              <span>🧹</span><span>Clear View</span>
            </button>
            <button id="rtAutoClear" class="pill" title="Toggle auto-clear when race/replay ID changes">
              <span>🧼</span><span id="rtAutoClearText">Auto-clear ID</span>
            </button>
            <button id="rtLikeScript" class="pill" title="Open the release thread">
              <span aria-hidden="true">👍</span><span>Release thread</span>
            </button>
            <button id="rtClose" class="pill" title="Close">
              <span>✕</span>
            </button>
          </div>
        </div>

        <div id="rtBody">
          <div id="rtMeta">
            <table id="rtMetaTable">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Track</th>
                  <th>Lap</th>
                  <th>Lap Length</th>
                  <th>Race Length</th>
                  <th>Car</th>
                  <th>Driver</th>
                  <th>Race start time</th>
                  <th>Race overtakes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span id="rtRaceIdWrap"><a id="rtRaceId" href="#" target="_blank" rel="noopener noreferrer">—</a></span></td>
                  <td id="rtTrack">—</td>
                  <td id="mpgLaps">—</td>
                  <td id="mpgDistance">—</td>
                  <td id="mpgRaceLength">—</td>
                  <td>
                    <span class="rtMetaCar">
                      <img id="rtCarImg" class="carIcon" style="display:none" alt="" loading="lazy" decoding="async" />
                      <span id="rtCar" class="carName">—</span>
                    </span>
                  </td>
                  <td id="rtDriver">—</td>
                  <td id="rtRaceTime" class="mono">—</td>
                  <td id="rtRaceOvertakes" class="mono">0</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div id="mpgModeBar" class="mpg-modebar"></div>
          <div id="mpgStatusBadge" class="mpg-status muted"></div>
          <div id="mpgCommentaryTicker" class="mpg-commentary" style="display:none"></div>
          <div id="rtCalcNote" class="muted" style="font-size:11px;opacity:.85;display:none">Calc uses replay speed: <b id="rtSpeedLabel">1×</b>.</div>
          <div id="rtEvents" class="mono muted" style="font-size:11px;opacity:.9;max-height:78px;overflow:auto;display:none;margin-top:6px"></div>

          <div id="mpgAnalysisWrap">
            <div id="mpgAnalysisBody" class="mpg-analysis"></div>
          </div>
          <div class="mpg-footer muted">Estimated telemetry from segment timing + official track distance.</div>

          <div id="rtRecords" class="recordsWrap" style="display:none">
            <div class="recordsBar">
              <div class="recordsLeft">
                <span class="muted">Track:</span>
                <select id="rtRecTrack" class="select"></select>
                <span class="muted" style="margin-left:8px">Mode:</span>
                <select id="rtRecMode" class="select">
                  <option value="lap">Best Lap</option>
                  <option value="race">Race Time</option>
                </select>
                <span class="muted" style="margin-left:8px">Type:</span>
                <select id="rtRecRaceType" class="select">
                  <option value="official">Official</option>
                  <option value="custom">Custom</option>
                </select>
                <label class="recScopeToggle" title="Switch between global records and only your own records"><input id="rtRecMineOnly" type="checkbox"><span>Mine only</span></label>
              </div>
              <div class="recordsRight muted"><button id="rtDetachRecords" class="pill" type="button" title="Move Records to its own window">Pop out</button> All unique cars</div>
            </div>
            <div class="recordsTable" id="rtRecScroll">
              <table id="rtRecTable">
                <thead>
                  <tr>
                    <th class="colNum">#</th>
                    <th class="colImg">Img</th>
                    <th class="colCar">Car</th>
                    <th class="colTime">Time</th>
                    <th class="colDriver">Driver</th>
                    <th class="colSkill">RS</th>
                    <th class="colRace">Race</th>
                    <th class="colWhen">When</th>
                    <th class="colAct">Delete</th>
                  </tr>
                </thead>
                <tbody id="rtRecTbody"></tbody>
              </table>
            </div>
          </div>

          <input id="rtImportInput" type="file" accept="text/html,.html" multiple style="display:none" />
        </div>
        <div class="mpgResizeGrip" title="Resize Pit Guru" aria-hidden="true"></div>
      `;
            document.body.appendChild(w);
            applyHeaderButtonOrder_();
            setupHeaderButtonDrag_();

            const updateHeaderCompact = () => requestHeaderCompact_(w);

            // Switch the header buttons to icon-only when the title and buttons no longer fit.
            try {
                const ro = new ResizeObserver(updateHeaderCompact);
                ro.observe(w);
            } catch (e) {
                // ResizeObserver not supported (very old browsers) — ignore
            }
            updateHeaderCompact_(w);
            window.addEventListener("resize", () => keepWindowInBounds_(w, "win", { persist: false }));

            document.getElementById("rtClose").onclick = closeWin_;
            document.getElementById("rtClear").onclick = () => {
                clearView_();
                uiDirty = true;
                scheduleRender_();
            };


            document.getElementById("rtToggle").onclick = () => {
                toast_("Pit Guru is JSON-only now; page scraping and legacy lap recording are disabled.");
                uiDirty = true;
                scheduleRender_();
            };

            document.getElementById("rtLocalPlayer").onclick = openLocalPlayerForCurrentRace_;

            document.getElementById("rtAutoClear").onclick = () => {
                clearOnRaceChange = !clearOnRaceChange;
                saveClearOnRaceChange_(clearOnRaceChange);
                uiDirty = true;
                scheduleRender_();
            };

            document.getElementById("mpgSettingsBtn").onclick = () => {
                settingsOpen = !settingsOpen;
                if (settingsOpen && onboardingRequired) focusApiKeyPending = true;
                uiDirty = true;
                scheduleRender_();
            };
            document.getElementById("mpgGarageBtn").onclick = () => {
                garageOpen = !garageOpen;
                uiDirty = true;
                scheduleRender_();
                if (garageOpen) refreshGarage_(false);
            };
            document.getElementById("rtLikeScript").onclick = handleForumLikeAction_;

            document.getElementById("rtExportHtml").onclick = exportHtml_;

            // Import HTML exports into Records
            const impBtn = document.getElementById("rtImportHtml");
            const impInput = document.getElementById("rtImportInput");
            if (impBtn && impInput) {
                impBtn.onclick = () => {
                    try { impInput.value = ""; } catch { }
                    impInput.click();
                };
                impInput.addEventListener("change", async () => {
                    const files = Array.from(impInput.files || []);
                    if (!files.length) return;
                    let ok = 0, skipped = 0, failed = 0;
                    for (const f of files) {
                        try {
                            const txt = await readFileText_(f);
                            const res = importHtmlReportText_(txt, f.name);
                            if (res === true) ok++;
                            else if (res === false) skipped++;
                            else failed++;
                        } catch {
                            failed++;
                        }
                    }
                    saveRecords_();
                    uiDirty = true;
                    scheduleRender_();
                    toast_(`Import complete: ${ok} added/updated, ${skipped} skipped, ${failed} failed.`);
                });
            }

            document.getElementById("rtToggleRecords").onclick = () => {
                recordsOpen = !recordsOpen;
                saveRecordsOpen_();
                uiDirty = true;
                scheduleRender_();
            };

            document.getElementById("rtDetachRecords").onclick = () => {
                recordsDetached = true;
                recordsOpen = true;
                saveRecordsOpen_();
                saveRecordsDetached_();
                uiDirty = true;
                scheduleRender_();
            };

            document.getElementById("rtRecMode").onchange = (e) => {
                recordsMode = String(e.target.value || "lap");
                uiDirty = true;
                scheduleRender_();
            };
            document.getElementById("rtRecRaceType").onchange = (e) => {
                recordsRaceType = String(e.target.value || "official").toLowerCase() === "custom" ? "custom" : "official";
                saveRecordsRaceType_();
                pgLocalRecordsCache.fetchedAt = 0;
                uiDirty = true;
                scheduleRender_();
            };
            document.getElementById("rtRecMineOnly").onchange = (e) => {
                recordsMineOnly = !!e.target.checked;
                saveRecordsMineOnly_();
                pgLocalRecordsCache.fetchedAt = 0;
                uiDirty = true;
                scheduleRender_();
            };
            document.getElementById("rtRecTrack").onchange = (e) => {
                recordsTrack = String(e.target.value || "");
                uiDirty = true;
                scheduleRender_();
            };

            document.getElementById("rtRecTbody").addEventListener("click", (e) => {
                const btn = e.target.closest(".recDelBtn");
                if (!btn) return;
                deleteRecordFromButton_(btn).catch(err => toast_(pgErrorMessage_(err, "Record delete failed")));
            });

            makeDraggable_(w, w, { storeKey: "win", clickGuardAttr: null, noDragSelector: "button, a, input, textarea, select, td, th, .mpgResizeGrip" });
            makeResizeGrip_(w, w.querySelector(".mpgResizeGrip"), "win");

            observeResize_(w, "win");
        }

        if (!document.getElementById("rtRecordsPopup")) {
            const p = document.createElement("div");
            p.id = "rtRecordsPopup";
            p.innerHTML = `
        <div class="recordsPopupHdr">
          <div class="recordsPopupTitle">Records</div>
          <div style="display:flex;align-items:center;gap:8px">
            <button id="rtDockRecords" class="pill" type="button" title="Move Records back under Pit Guru">Dock</button>
            <button id="rtCloseRecordsPopup" class="pill" type="button" title="Close Records">✕</button>
          </div>
        </div>
        <div class="recordsPopupBody">
          <div id="rtRecordsPopWrap" class="recordsWrap">
            <div class="recordsBar">
              <div class="recordsLeft">
                <span class="muted">Track:</span>
                <select id="rtRecPopTrack" class="select"></select>
                <span class="muted" style="margin-left:8px">Mode:</span>
                <select id="rtRecPopMode" class="select">
                  <option value="lap">Best Lap</option>
                  <option value="race">Race Time</option>
                </select>
                <span class="muted" style="margin-left:8px">Type:</span>
                <select id="rtRecPopRaceType" class="select">
                  <option value="official">Official</option>
                  <option value="custom">Custom</option>
                </select>
                <label class="recScopeToggle" title="Switch between global records and only your own records"><input id="rtRecPopMineOnly" type="checkbox"><span>Mine only</span></label>
              </div>
              <div class="recordsRight muted">All unique cars</div>
            </div>
            <div class="recordsTable" id="rtRecPopScroll">
              <table id="rtRecPopTable">
                <thead>
                  <tr>
                    <th class="colNum">#</th>
                    <th class="colImg">Img</th>
                    <th class="colCar">Car</th>
                    <th class="colTime">Time</th>
                    <th class="colDriver">Driver</th>
                    <th class="colSkill">RS</th>
                    <th class="colRace">Race</th>
                    <th class="colWhen">When</th>
                    <th class="colAct">Delete</th>
                  </tr>
                </thead>
                <tbody id="rtRecPopTbody"></tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="mpgResizeGrip" title="Resize Records" aria-hidden="true"></div>
      `;
            document.body.appendChild(p);
            document.getElementById("rtDockRecords").onclick = () => {
                recordsDetached = false;
                recordsOpen = true;
                saveRecordsOpen_();
                saveRecordsDetached_();
                uiDirty = true;
                scheduleRender_();
            };
            document.getElementById("rtCloseRecordsPopup").onclick = () => {
                recordsOpen = false;
                saveRecordsOpen_();
                uiDirty = true;
                scheduleRender_();
            };
            document.getElementById("rtRecPopMode").onchange = (e) => {
                recordsMode = String(e.target.value || "lap");
                uiDirty = true;
                scheduleRender_();
            };
            document.getElementById("rtRecPopRaceType").onchange = (e) => {
                recordsRaceType = String(e.target.value || "official").toLowerCase() === "custom" ? "custom" : "official";
                saveRecordsRaceType_();
                pgLocalRecordsCache.fetchedAt = 0;
                uiDirty = true;
                scheduleRender_();
            };
            document.getElementById("rtRecPopMineOnly").onchange = (e) => {
                recordsMineOnly = !!e.target.checked;
                saveRecordsMineOnly_();
                pgLocalRecordsCache.fetchedAt = 0;
                uiDirty = true;
                scheduleRender_();
            };
            document.getElementById("rtRecPopTrack").onchange = (e) => {
                recordsTrack = String(e.target.value || "");
                uiDirty = true;
                scheduleRender_();
            };
            document.getElementById("rtRecPopTbody").addEventListener("click", (e) => {
                const btn = e.target.closest(".recDelBtn");
                if (!btn) return;
                deleteRecordFromButton_(btn).catch(err => toast_(pgErrorMessage_(err, "Record delete failed")));
            });
            makeDraggable_(p, p.querySelector(".recordsPopupHdr"), { storeKey: "records", clickGuardAttr: null, noDragSelector: "button, a, input, textarea, select, .recDelBtn, td, th, .mpgResizeGrip" });
            makeResizeGrip_(p, p.querySelector(".mpgResizeGrip"), "records");
            observeResize_(p, "records");
        }

        restorePositions_();
        applyTheme_();

        const wasOpen = loadWinOpen_();
        const win = document.getElementById("rtLapWin");
        const btn = document.getElementById("rtLapBtn");

        if (win && btn) {
            win.style.display = wasOpen ? "block" : "none";
            btn.style.display = wasOpen ? "none" : "flex";
            keepWindowInBounds_(win, "win", { persist: false });
        }
        const recPop = document.getElementById("rtRecordsPopup");
        if (recPop) {
            recPop.style.display = recordsDetached && recordsOpen ? "block" : "none";
            if (recordsDetached && recordsOpen) keepWindowInBounds_(recPop, "records", { persist: false });
        }

        uiDirty = true;
        scheduleRender_();
    }

    /* ============================
   * RENDER
   * ============================ */
    let lastRenderKey = "";
    let renderScheduled = false;
    let renderDriverRowsCurrent = 0;
    let renderDriverRowsTotalCurrent = 0;

    function recordRenderInstrumentation_(rebuiltDom) {
        const stats = raceDataFetchStats_(analysis?.raceId || directRaceIdFromPayload_(latestRaceDataPayload) || directCurrentRaceId || raceMeta?.raceId || "");
        if (rebuiltDom) {
            if (heavyRaceLightweightMode_()) stats.lightweightRenders += 1;
            else stats.fullRenders += 1;
        }
        stats.renderedRows = renderDriverRowsCurrent || 0;
        stats.totalRows = renderDriverRowsTotalCurrent || fieldSize_() || 0;
    }

    function heavyRaceDebugLine_() {
        const stats = raceDataFetchStats_(analysis?.raceId || directRaceIdFromPayload_(latestRaceDataPayload) || directCurrentRaceId || raceMeta?.raceId || "");
        const heavy = heavyRaceStats_();
        const rendered = Number(stats.renderedRows || 0);
        const total = Number(stats.totalRows || heavy.drivers || fieldSize_() || 0);
        const payload = latestRaceDataPayload || analysis?.payload || null;
        const cacheKey = payload ? bigRaceCacheIdentity_(payload).key : "";
        const rawState = cacheKey && bigRaceRawStoredKeys.has(cacheKey) ? "stored" : "pending";
        const summaryState = cacheKey && (bigRaceSummaryStoredKeys.has(cacheKey) || bigRaceProcessedSummaryCache.has(cacheKey)) ? "stored" : (cacheKey && bigRaceSummaryInFlightKeys.has(cacheKey) ? "building" : "pending");
        const worker = bigRaceCacheStatus.workerUsed ? ", worker: used" : "";
        const error = bigRaceCacheStatus.lastError ? `, cache note: ${bigRaceCacheStatus.lastError}` : "";
        return `Heavy mode: ${heavyRaceLightweightMode_() ? "ON" : "OFF"}, estimated points: ${Math.round(heavy.estimatedPoints || 0).toLocaleString()}, racingData fetches: ${stats.fetches || 0}, duplicate payloads skipped: ${stats.duplicatePayloadsSkipped || 0}, rendered rows: ${rendered}/${total}. Big Race cache: raw ${rawState}, summary ${summaryState}${worker}${error}.`;
    }

    function scheduleRender_(dirty = null) {
        if (dirty) markDirty_(dirty);
        if (renderScheduled) return;
        renderScheduled = true;
        requestAnimationFrame(() => {
            renderScheduled = false;
            render_();
        });
    }
    function render_() {
        ensureRaceMeta_();
        applyTheme_();
        const btnDot = document.getElementById("rtBtnDot");
        const btnCount = document.getElementById("rtBtnCount");
        const count = document.getElementById("rtCount");
        const recDot = document.getElementById("rtRecDotInline");
        const recText = document.getElementById("rtRecText");
        const autoClearBtn = document.getElementById("rtAutoClear");
        const recordsBtn = document.getElementById("rtToggleRecords");
        const autoClearText = document.getElementById("rtAutoClearText");
        const playerBtn = document.getElementById("rtLocalPlayer");

        const trackEl = document.getElementById("rtTrack");
        const lapsEl = document.getElementById("mpgLaps");
        const distanceEl = document.getElementById("mpgDistance");
        const raceLengthEl = document.getElementById("mpgRaceLength");
        const carEl = document.getElementById("rtCar");
        const carImgEl = document.getElementById("rtCarImg");

        const recWrap = document.getElementById("rtRecords");
        const recTbody = document.getElementById("rtRecTbody");
        const recTrackSel = document.getElementById("rtRecTrack");
        const recModeSel = document.getElementById("rtRecMode");
        const recRaceTypeSel = document.getElementById("rtRecRaceType");
        const recMineOnlyInput = document.getElementById("rtRecMineOnly");
        const recPopup = document.getElementById("rtRecordsPopup");
        const recPopTbody = document.getElementById("rtRecPopTbody");
        const recPopTrackSel = document.getElementById("rtRecPopTrack");
        const recPopModeSel = document.getElementById("rtRecPopMode");
        const recPopRaceTypeSel = document.getElementById("rtRecPopRaceType");
        const recPopMineOnlyInput = document.getElementById("rtRecPopMineOnly");

        const driverEl = document.getElementById("rtDriver");
        const raceTimeEl = document.getElementById("rtRaceTime");
        const raceTotalEl = document.getElementById("rtRaceTotal");
        const raceOvertakesEl = document.getElementById("rtRaceOvertakes");
        const raceIdEl = document.getElementById("rtRaceId");
        const raceIdWrap = document.getElementById("rtRaceIdWrap");

        const participantCount = analysis?.drivers?.length || preRaceParticipants.length || raceMetaFromPayload_(latestRaceDataPayload || analysis?.payload || null).currentDrivers || 0;
        const hasJson = !!(latestRaceDataPayload || analysis);
        if (btnDot) btnDot.className = hasJson ? "recDot" : "recDot off";
        if (btnCount) btnCount.textContent = `(${participantCount || 0})`;
        if (count) count.textContent = `(${participantCount || 0})`;
        if (autoClearBtn) autoClearBtn.classList.toggle("on", !!clearOnRaceChange);
        if (recordsBtn) recordsBtn.classList.toggle("on", !!recordsOpen);
        if (autoClearText) autoClearText.textContent = clearOnRaceChange ? "Auto-clear ID: ON" : "Auto-clear ID: OFF";
        if (recDot) recDot.className = hasJson ? "" : "off";
        if (recText) recText.textContent = "JSON";
        markPlayerRaceDataAvailable_();
        if (playerBtn) {
            const playerReady = playerRaceDataAvailable_();
            playerBtn.disabled = !playerReady;
            playerBtn.classList.toggle("mpg-player-ready-highlight", playerReady && Date.now() < pgPlayerReadyHighlightUntil);
            playerBtn.title = playerReady
                ? "Open this race in the hosted Player"
                : "Player unlocks when replay-ready racingData is available";
        }
        updateHeaderCompact_(document.getElementById("rtLapWin"));
        const headerTrackName = raceMeta?.track || analysis?.trackName || "";
        if (trackEl) trackEl.textContent = headerTrackName || "—";
        if (lapsEl) lapsEl.textContent = currentLapDisplay_();
        if (distanceEl) {
            const km = getLapKm_(headerTrackName) || analysis?.trackMeta?.lapKm;
            distanceEl.textContent = formatDistanceKm_(km, { perLap: true });
        }
        if (raceLengthEl) {
            const km = getLapKm_(headerTrackName) || analysis?.trackMeta?.lapKm;
            const laps = analysis?.laps || getOfficialLapCount_(headerTrackName) || Number(raceMeta?.laps) || 0;
            raceLengthEl.textContent = km && laps ? formatDistanceKm_(km * laps) : "—";
        }

        const analysisDisplayDriver = analysis?.drivers?.find(isUserDriver_) || analysis?.drivers?.[0] || null;
        const metaCarName = toOgCarName_(analysisDisplayDriver?.car || spectateCar || raceMeta?.car || "") || "—";
        if (carEl) {
            carEl.textContent = metaCarName;
            carEl.title = metaCarName;
        }
        if (carImgEl) {
            const u = analysisImagesEnabled_() ? (analysisDisplayDriver?.carImg || raceMeta?.carImg || spectateCarImg || "").trim() : "";
            carImgEl.title = metaCarName;
            if (u) {
                if (carImgEl.getAttribute("src") !== u) carImgEl.src = u;
                carImgEl.style.display = "inline-block";
            }
            else { carImgEl.removeAttribute("src"); carImgEl.style.display = "none"; }
        }
        if (driverEl) {
            driverEl.textContent = analysisDisplayDriver?.name || spectateName || playerName || raceMeta?.driver || "—";
        }

        if (raceIdEl) {
            const rid = (getRaceId_() || raceMeta?.raceId || "").trim();
            if (rid) {
                const href = `https://www.torn.com/page.php?sid=racing&raceID=${encodeURIComponent(rid)}`;
                raceIdEl.textContent = rid;
                raceIdEl.href = href;
                if (raceIdWrap) raceIdWrap.style.display = "";
            } else {
                raceIdEl.textContent = "—";
                raceIdEl.removeAttribute("href");
                if (raceIdWrap) raceIdWrap.style.display = "";
            }
        }

        if (raceTimeEl) raceTimeEl.textContent = raceMeta?.startAtIso ? reportDateText_(raceMeta.startAtIso) : (raceMeta?.detectedAtLocal || "—");
        if (raceOvertakesEl) raceOvertakesEl.textContent = String(raceOvertakesCount_(getVisualElapsed_(), analysisCanShowFullRace_()));

        // Records panel/window (per track)
        if (recWrap) recWrap.style.display = recordsOpen && !recordsDetached ? "" : "none";
        if (recPopup) {
            recPopup.style.display = recordsOpen && recordsDetached ? "block" : "none";
            if (recordsOpen && recordsDetached) keepWindowInBounds_(recPopup, "records", { persist: false });
        }
        const activeRecTbody = recordsDetached ? recPopTbody : recTbody;
        const activeRecTrackSel = recordsDetached ? recPopTrackSel : recTrackSel;
        const activeRecModeSel = recordsDetached ? recPopModeSel : recModeSel;
        const activeRecRaceTypeSel = recordsDetached ? recPopRaceTypeSel : recRaceTypeSel;
        const activeRecMineOnlyInput = recordsDetached ? recPopMineOnlyInput : recMineOnlyInput;
        if (recordsOpen && activeRecTbody && activeRecTrackSel && activeRecModeSel) {
            pgLocalEnsureTracks_().catch(() => { });
            const mode = recordsMode;
            const currentTrackLabel = mode === "race" ? formatRaceTrackLabel_((raceMeta?.track || "").trim(), Number(analysis?.laps || raceMeta?.laps || 0)) : (raceMeta?.track || "").trim();
            const trackNow = getRecordTrackScope_(mode, currentTrackLabel);
            const tracks = getAllTrackNames_(mode);
            if (!recordsTrack && trackNow) recordsTrack = trackNow;

            const optKey = tracks.join("||");
            if (activeRecTrackSel.dataset.key !== optKey) {
                activeRecTrackSel.innerHTML = tracks.map(t => `<option value="${escAttr_(t)}">${esc_(t)}</option>`).join("") || `<option value="">—</option>`;
                activeRecTrackSel.dataset.key = optKey;
            }

            const normalizedSelectedTrack = getRecordTrackScope_(mode, recordsTrack);
            if (normalizedSelectedTrack && tracks.includes(normalizedSelectedTrack)) {
                recordsTrack = normalizedSelectedTrack;
                activeRecTrackSel.value = recordsTrack;
            } else if (tracks.length) {
                recordsTrack = tracks[0];
                activeRecTrackSel.value = recordsTrack;
            }

            activeRecModeSel.value = recordsMode;
            if (activeRecRaceTypeSel) {
                activeRecRaceTypeSel.value = recordsRaceType;
                activeRecRaceTypeSel.disabled = mode === "lap";
                activeRecRaceTypeSel.title = mode === "lap" ? "Best Lap records are shared by Official and Custom races." : "Race Time records are separated by Official and Custom races.";
            }
            if (activeRecMineOnlyInput) activeRecMineOnlyInput.checked = !!recordsMineOnly;
            const track = recordsTrack || trackNow || "";
            if (track) pgLocalEnsureRecords_(mode, track).catch(() => { });

            const localReady = track && pgLocalRecordsMatch_(mode, track) && !pgLocalRecordsCache.loading && !pgLocalRecordsCache.error;
            let top = [];
            if (localReady) {
                top = (pgLocalRecordsCache.rows || [])
                    .slice()
                    .sort((a, b) => (a.ms || 0) - (b.ms || 0));
            } else {
                const rows = records
                .filter(r => r && r.mode === mode && getRecordTrackScopeFromRow_(r, mode) === track)
                .filter(r => mode === "lap" || getRecordRaceTypeFromRow_(r) === recordsRaceType)
                .filter(r => !recordsMineOnly || recordIsMine_(r))
                .slice()
                .sort((a, b) => (a.ms || 0) - (b.ms || 0));

                const bestByCar = new Map();
                for (const r of rows) {
                    const k = toOgCarName_(r.car || "").trim();
                    if (!k) continue;
                    const prev = bestByCar.get(k);
                    if (!prev || (r.ms || 0) < (prev.ms || 0)) bestByCar.set(k, r);
                }

                top = Array.from(bestByCar.values())
                    .sort((a, b) => (a.ms || 0) - (b.ms || 0));
            }
            if (!top.length) {
                const msg = pgLocalRecordsCache.loading && pgLocalRecordsMatch_(mode, track)
                    ? "Loading SQLite records..."
                    : "No records for this track yet.";
                activeRecTbody.innerHTML = `<tr><td colspan="9" class="muted">${esc_(msg)}</td></tr>`;
            } else {
                activeRecTbody.innerHTML = top.map((r, i) => {
                    const imgUrl = r.carImg || carImageFromCatalog_(r.car);
                    const imgCell = imgUrl ? `<img class="carIcon" src="${escAttr_(imgUrl)}" alt="" loading="lazy" decoding="async">` : `<div class="carIcon" aria-hidden="true"></div>`;
                    const drv = (r.driverName || r.driverId || "—");
                    const rsNum = Number(r.racingSkill);
                    const rs = Number.isFinite(rsNum) && rsNum > 0 && rsNum < 1 ? "--" : formatDriverRs_(r.racingSkill).replace(/^RS:\s*/i, "");
                    const recRid = String(r.raceId || "").trim();
                    const raceCell = recRid ? `<a class="recRaceLink" href="https://www.torn.com/page.php?sid=racing&raceID=${encodeURIComponent(recRid)}" target="_blank" title="View Replay">${esc_(recRid)}</a>` : "";
                    const actionCell = `<button class="recDelBtn" data-id="${escAttr_(r.id)}" data-source="${escAttr_(r.source || "")}" data-mode="${escAttr_(mode)}" data-race-id="${escAttr_(r.raceId || "")}" data-driver-id="${escAttr_(r.driverId || "")}" data-car="${escAttr_(r.car || "")}" title="${r.source === "sqlite" ? "Delete from SQLite" : "Delete"}">🗑️</button>`;
                    return `<tr>
            <td class="recNum">${i + 1}</td>
            <td class="recImg">${imgCell}</td>
            <td class="recCar"><span>${esc_(toOgCarName_(r.car) || "—")}</span></td>
            <td class="recTime">${esc_(r.timeText || "—")}</td>
            <td class="recDrv">${driverNameCell_({ name: drv, driverId: r.driverId, racingSkill: r.racingSkill })}</td>
            <td class="recSkill mono">${esc_(rs)}</td>
            <td class="recRace mono">${raceCell}</td>
            <td class="recWhen">${esc_(fmtWhen_(r.atIso || r.at || ""))}</td>
            <td class="recAct">${actionCell}</td>
          </tr>`;
                }).join("");
            }
        }

        if (renderAnalysis_()) {
            if (analysis && raceTotalEl) {
                raceTotalEl.textContent = liveTimerText_(getVisualElapsed_(), analysisCanShowFullRace_()) || "—";
            } else if (raceTotalEl) {
                raceTotalEl.textContent = "—";
            }
            lastRenderKey = `${analysis?.raceId || "waiting"}|${analysisMode}|${theme}|${allowPreFinishPreview ? 1 : 0}|${speedUnit}|${participantCount}`;
            uiDirty = false;
            dataDirty = false;
            layoutDirty = false;
            statusDirty = false;
            selectionDirty = false;
            return;
        }
        uiDirty = false;
        dataDirty = false;
        layoutDirty = false;
        statusDirty = false;
        selectionDirty = false;
    }

    /* ============================
   * DRAGGING
   * ============================ */

    function queueResizePersist_(el, storeKey) {
        if (!el || !storeKey) return;
        const existing = resizePersistTimers.get(storeKey);
        if (existing) clearTimeout(existing);
        resizePersistTimers.set(storeKey, setTimeout(() => {
            resizePersistTimers.delete(storeKey);
            if (!el.isConnected) return;
            const rect = getWindowRect_(el);
            if (storedRectLooksPageSized_(rect)) return;
            saveElementRect_(storeKey, el.getBoundingClientRect());
        }, 220));
    }

    function canEdgeResize_(el, storeKey) {
        if (!el || !["win", "records"].includes(storeKey)) return false;
        const resize = String(getComputedStyle(el).resize || "").toLowerCase();
        return resize && resize !== "none";
    }

    function getResizeEdges_(event, rect, el, storeKey) {
        if (!event || !rect || !canEdgeResize_(el, storeKey)) return { right: false, bottom: false };
        const hotZone = 18;
        return {
            right: event.clientX >= rect.right - hotZone && event.clientX <= rect.right + 4,
            bottom: event.clientY >= rect.bottom - hotZone && event.clientY <= rect.bottom + 4
        };
    }

    function observeResize_(el, storeKey) {
        if (!el || !storeKey || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(() => {
            const isManualNativeResize = nativeResizeEl === el && nativeResizeStoreKey === storeKey && Date.now() - nativeResizeAt < 20000;
            const rect = getWindowRect_(el);
            if (isManualNativeResize) {
                if (storeKey === "win") requestHeaderCompact_(el);
                queueResizePersist_(el, storeKey);
                return;
            }
            if (!isManualNativeResize && storedRectLooksPageSized_(rect)) {
                restoreSafeRect_(el, storeKey);
                return;
            }
            keepWindowInBounds_(el, storeKey, { persist: false });
            if (el.dataset.mpgResizeObserverReady === "1") {
                queueResizePersist_(el, storeKey);
            } else {
                el.dataset.mpgResizeObserverReady = "1";
            }
        });
        ro.observe(el);
    }

    function makeResizeGrip_(targetEl, gripEl, storeKey) {
        if (!targetEl || !gripEl || !storeKey || gripEl.dataset.mpgResizeGripReady === "1") return;
        gripEl.dataset.mpgResizeGripReady = "1";
        let active = false;
        let startX = 0, startY = 0, startL = 0, startT = 0, startW = 0, startH = 0;
        let lastX = 0, lastY = 0;
        let resizeRaf = 0;

        const moveEvent = typeof PointerEvent !== "undefined" ? "pointermove" : "mousemove";
        const upEvent = typeof PointerEvent !== "undefined" ? "pointerup" : "mouseup";
        const cancelEvent = typeof PointerEvent !== "undefined" ? "pointercancel" : "mouseleave";

        const applyPendingResize = () => {
            resizeRaf = 0;
            if (!active) return;
            const dx = lastX - startX;
            const dy = lastY - startY;
            nativeResizeAt = Date.now();
            const minSize = getWindowMinSize_(targetEl);
            const clamped = clampWindowRect_({
                left: startL,
                top: startT,
                width: startW + dx,
                height: startH + dy
            }, minSize.width, minSize.height);
            applyWindowRect_(targetEl, clamped);
            if (storeKey === "win") requestHeaderCompact_(targetEl);
        };

        const onMove = (e) => {
            if (!active) return;
            if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
            lastX = e.clientX;
            lastY = e.clientY;
            if (!resizeRaf) resizeRaf = requestAnimationFrame(applyPendingResize);
            e.preventDefault();
            e.stopPropagation();
        };

        const finish = (e) => {
            if (!active) return;
            if (resizeRaf) {
                cancelAnimationFrame(resizeRaf);
                applyPendingResize();
            }
            active = false;
            targetEl.classList.remove("mpg-resizing");
            keepWindowInBounds_(targetEl, storeKey, { persist: true });
            nativeResizeEl = null;
            nativeResizeStoreKey = "";
            nativeResizeAt = 0;
            window.removeEventListener(moveEvent, onMove, true);
            window.removeEventListener(upEvent, finish, true);
            window.removeEventListener(cancelEvent, finish, true);
            try {
                if (gripEl.releasePointerCapture && e?.pointerId != null) gripEl.releasePointerCapture(e.pointerId);
            } catch { }
            e?.preventDefault?.();
            e?.stopPropagation?.();
        };

        const start = (e) => {
            if (e.button != null && e.button !== 0) return;
            const rect = targetEl.getBoundingClientRect();
            active = true;
            startX = lastX = e.clientX;
            startY = lastY = e.clientY;
            startL = rect.left;
            startT = rect.top;
            startW = rect.width;
            startH = rect.height;
            nativeResizeEl = targetEl;
            nativeResizeStoreKey = storeKey;
            nativeResizeAt = Date.now();
            targetEl.classList.add("mpg-resizing");
            targetEl.style.right = "auto";
            targetEl.style.bottom = "auto";
            targetEl.style.left = `${startL}px`;
            targetEl.style.top = `${startT}px`;
            window.addEventListener(moveEvent, onMove, true);
            window.addEventListener(upEvent, finish, true);
            window.addEventListener(cancelEvent, finish, true);
            try {
                if (gripEl.setPointerCapture && e.pointerId != null) gripEl.setPointerCapture(e.pointerId);
            } catch { }
            e.preventDefault();
            e.stopPropagation();
        };

        gripEl.addEventListener(typeof PointerEvent !== "undefined" ? "pointerdown" : "mousedown", start, true);
    }

    function makeDraggable_(targetEl, handleEl, opts) {
        const { storeKey, clickGuardAttr, noDragSelector } = opts || {};
        let down = false, startX = 0, startY = 0, startL = 0, startT = 0, startW = 0, startH = 0;
        let resizing = false, resizeRight = false, resizeBottom = false;
        let moved = false;

        handleEl.addEventListener("mousedown", (e) => {
            const rect = targetEl.getBoundingClientRect();
            const resizeEdges = getResizeEdges_(e, rect, targetEl, storeKey);
            if (resizeEdges.right || resizeEdges.bottom) {
                resizing = true;
                resizeRight = resizeEdges.right;
                resizeBottom = resizeEdges.bottom;
                moved = false;
                startX = e.clientX; startY = e.clientY;
                startL = rect.left; startT = rect.top;
                startW = rect.width; startH = rect.height;
                nativeResizeEl = targetEl;
                nativeResizeStoreKey = storeKey || "";
                nativeResizeAt = Date.now();
                targetEl.style.right = "auto";
                targetEl.style.bottom = "auto";
                targetEl.style.left = `${startL}px`;
                targetEl.style.top = `${startT}px`;
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (noDragSelector && e.target.closest(noDragSelector)) return;
            down = true; moved = false;
            startX = e.clientX; startY = e.clientY;
            startL = rect.left; startT = rect.top;
            startW = rect.width;
            startH = rect.height;

            targetEl.style.right = "auto";
            targetEl.style.bottom = "auto";
            targetEl.style.left = `${startL}px`;
            targetEl.style.top = `${startT}px`;

            e.preventDefault();
        });

        window.addEventListener("mousemove", (e) => {
            if (resizing) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
                nativeResizeAt = Date.now();
                const minSize = getWindowMinSize_(targetEl);
                const clamped = clampWindowRect_({
                    left: startL,
                    top: startT,
                    width: startW + (resizeRight ? dx : 0),
                    height: startH + (resizeBottom ? dy : 0)
                }, minSize.width, minSize.height);
                applyWindowRect_(targetEl, clamped);
                if (clickGuardAttr) targetEl.dataset[clickGuardAttr] = "1";
                return;
            }

            if (!down) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;

            if (storeKey === "win") {
                const minSize = getWindowMinSize_(targetEl);
                const clamped = clampWindowRect_({
                    left: startL + dx,
                    top: startT + dy,
                    width: startW,
                    height: startH
                }, minSize.width, minSize.height);
                targetEl.style.left = `${clamped.left}px`;
                targetEl.style.top = `${clamped.top}px`;
            } else {
                targetEl.style.left = `${startL + dx}px`;
                targetEl.style.top = `${startT + dy}px`;
            }

            if (clickGuardAttr) targetEl.dataset[clickGuardAttr] = "1";
        });

        window.addEventListener("mouseup", () => {
            if (resizing) {
                resizing = false;
                resizeRight = false;
                resizeBottom = false;
                keepWindowInBounds_(targetEl, storeKey, { persist: true });
                nativeResizeEl = null;
                nativeResizeStoreKey = "";
                nativeResizeAt = 0;
                if (clickGuardAttr) {
                    setTimeout(() => { targetEl.dataset[clickGuardAttr] = moved ? "1" : "0"; }, 0);
                    if (moved) setTimeout(() => { targetEl.dataset[clickGuardAttr] = "0"; }, 60);
                }
                return;
            }
            if (!down) return;
            down = false;

            if (storeKey) {
                if (storeKey === "win") keepWindowInBounds_(targetEl, storeKey);
                else saveElementRect_(storeKey, targetEl.getBoundingClientRect());
            }

            if (clickGuardAttr) {
                setTimeout(() => { targetEl.dataset[clickGuardAttr] = moved ? "1" : "0"; }, 0);
                if (moved) setTimeout(() => { targetEl.dataset[clickGuardAttr] = "0"; }, 60);
            }
        });
    }

    /* ============================
   * INIT
   * ============================ */
    async function init_() {
        records = loadRecords_();
        raceMeta = loadRaceMeta_();
        theme = loadTheme_();
        allowPreFinishPreview = loadAllowPreview_();
        speedUnit = loadSpeedUnit_();
        updateRateMs = loadUpdateRate_();
        telemetrySmoothing = loadSmoothing_();
        analysisMode = loadAnalysisMode_();
        debugEnabled = loadDebug_();
        enablePredictions = loadBoolSetting_(STORE_ENABLE_PREDICTIONS_KEY, true);
        useHistoryPredictions = loadBoolSetting_(STORE_USE_HISTORY_PREDICTIONS_KEY, true);
        useApiPredictions = loadBoolSetting_(STORE_USE_API_PREDICTIONS_KEY, true);
        apiKey = loadApiKey_();
        apiKeyInfo = loadApiKeyInfo_();
        driverIntelCache = loadDriverIntelCache_();
        setTimeout(() => pgLocalSyncDriverIntelCache_(), 1500);
        driverHistory = loadDriverHistory_();
        clearOnRaceChange = loadClearOnRaceChange_();
        recordsOpen = loadRecordsOpen_();
        recordsDetached = loadRecordsDetached_();
        recordsRaceType = loadRecordsRaceType_();
        recordsMineOnly = loadRecordsMineOnly_();
        fuelEnabled = loadBoolSetting_(STORE_FUEL_ENABLED_KEY, false);
        fuelDisplayStyle = loadFuelStyle_();
        garageShowDelisted = loadBoolSetting_(STORE_GARAGE_SHOW_DELISTED_KEY, false);
        liveCommentaryEnabled = loadBoolSetting_(STORE_COMMENTARY_ENABLED_KEY, true);
        pitCrewEnabled = loadBoolSetting_(STORE_PIT_CREW_ENABLED_KEY, true);
        experimentalGyroTrace = loadBoolSetting_(STORE_EXPERIMENTAL_GYRO_TRACE_KEY, true);
        onboardingRequired = !loadBoolSetting_(STORE_ONBOARDING_COMPLETE_KEY, false);
        loadPerformanceTuning_();
        hookRaceDataObservers_();
        pgLocalEnsureTracks_().catch(() => { });
        pgLocalEnsureCarCatalog_().catch(() => { });

        maybeResetOnRaceIdChange_();
        raceMeta = loadRaceMeta_();

        ensureUi_();
        if (onboardingRequired) {
            openWin_();
            settingsOpen = true;
            focusApiKeyPending = true;
            uiDirty = true;
            scheduleRender_();
            setTimeout(startTutorial_, 450);
        }
        installJoinRaceObserver_();
        setupDriverHover_();
        ensurePlayer_();
        refreshSpectate_();
        if (apiKey) setTimeout(() => checkApiKeyInfo_({ manual: false }), 1000);
        setTimeout(() => { maybeFetchRacingDataForCurrentRace_(true); }, 750);
        const resumeFocusedWork = () => {
            if (!canScanTornPage_()) return;
            maybeFetchRacingDataForCurrentRace_(true);
            maybeAutoFetchDriverIntel_();
            uiDirty = true;
            scheduleRender_();
        };
        document.addEventListener("visibilitychange", resumeFocusedWork);
        window.addEventListener("focus", resumeFocusedWork);

        setInterval(() => {
            if (!canScanTornPage_()) return;
            const now = Date.now();
            const delay = liveLoopDelayMs_();
            if (now - liveLoopLastAt < delay) return;
            liveLoopLastAt = now;
            if (findLatestRaceDataPayload_() && !analysis) buildAnalysisFromRaceData_(findLatestRaceDataPayload_());
            if (analysis) {
                if (shouldPopulateFinalAnalysisNow_() && !recordsUpdatedForAnalysisRaceId) updateRecordsFromAnalysis_();
                if (!liveRaceHasWorkingAnalysis_() || !largeFieldMode_()) maybeAutoFetchDriverIntel_();
                renderAnalysis_();
            }
        }, 250);

        setInterval(() => {
            if (!canScanTornPage_()) return;
            const now = Date.now();
            const delay = maintenanceLoopDelayMs_();
            if (now - maintenanceLoopLastAt < delay) return;
            maintenanceLoopLastAt = now;
            const liveWorking = liveRaceHasWorkingAnalysis_();
            maybeResetOnRaceIdChange_();
            ensurePlayer_();
            refreshSpectate_();
            maybeFetchRacingDataForCurrentRace_();
            if (!liveWorking || !largeFieldMode_()) maybeAutoFetchDriverIntel_();
            ensureRaceMeta_();
            if (clearOnRaceChange && analysis && priorRaceFinishedForClear_() && !bigRaceObservationShouldPause_()) installJoinRaceObserver_();
            else disconnectJoinRaceObserver_();
            if (!liveWorking) {
                uiDirty = true;
                scheduleRender_();
            }
        }, 1000);
    }

    hookRaceDataObservers_();

    function startWhenDomReady_(cb) {
        if (document.body) cb();
        else document.addEventListener("DOMContentLoaded", cb, { once: true });
    }

    startWhenDomReady_(init_);

})();
