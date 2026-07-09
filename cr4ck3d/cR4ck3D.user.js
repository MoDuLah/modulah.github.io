// ==UserScript==
// @name         torn-crack
// @namespace    torn-crack
// @version      1.1.9
// @description  Simple Cracking Helper (Cracking page only) - VM public pool + visual rig planner
// @author       SirAua [3785905]
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @match        https://www.torn.com/page.php?sid=crimes*
// @grant        GM_xmlhttpRequest
// @connect      gitlab.com
// @connect      pp-api.sokin.xyz
// @run-at       document-idle
// @license      mit
// ==/UserScript==

(function () {
    'use strict';

    function isCrackingPage() {
        return location.pathname === '/page.php'
            && new URLSearchParams(location.search).get('sid') === 'crimes'
            && location.hash === '#/cracking';
    }

    if (window.CRACK_SCRIPT_BOOTSTRAPPED) return;
    window.CRACK_SCRIPT_BOOTSTRAPPED = true;

    /* --------------------------
       Config
       -------------------------- */
    const debug = false;
    const UPDATE_INTERVAL = 800;
    const MIN_LENGTH = 4;
    const MAX_LENGTH = 10;

    const WORDLIST_URL =
        'https://gitlab.com/kalilinux/packages/seclists/-/raw/kali/master/Passwords/Common-Credentials/Pwdb_top-1000000.txt?ref_type=heads';

    const DOWNLOAD_MIN_DELTA = 20;

    const COMMUNITY_POOL_ORIGIN = 'https://pp-api.sokin.xyz/torn-crack-pool';
    const COMMUNITY_SYNC_ENABLED = !COMMUNITY_POOL_ORIGIN.includes('pp-api.sokin.xyz');
    const CF_WORKER_ORIGIN = COMMUNITY_SYNC_ENABLED ? COMMUNITY_POOL_ORIGIN.replace(/\/+$/, '') : '';

    const CF_ADD_WORD_URL = COMMUNITY_SYNC_ENABLED ? `${CF_WORKER_ORIGIN}/submit` : '';
    const CF_STORAGE_BASE = COMMUNITY_SYNC_ENABLED ? `${CF_WORKER_ORIGIN}/words` : '';
    const METADATA_URL = COMMUNITY_SYNC_ENABLED ? `${CF_STORAGE_BASE}/metadata.json` : '';

    /* --------------------------
        Rate-limiting / batching
        -------------------------- */
    const SYNC_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
    const OUTBOX_FLUSH_INTERVAL_MS = 5 * 1000;
    const OUTBOX_POST_INTERVAL_MS = 2000;
    const OUTBOX_BATCH_SIZE = 5;

    const DB_NAME = 'crack';
    const STORE_NAME = 'dictionary';
    const STATUS_PREF_KEY = 'crack_show_badge';
    const EXCL_STORAGE_PREFIX = 'crack_excl_';

    // theme + UI preferences
    const THEME_PREF_KEY = 'crack_theme'; // 'dark' | 'light'

    const PREF_SUG_FONT_PX = 'crack_sug_font_px';
    const PREF_SUG_TEXT_COLOR = 'crack_sug_text_color';
    const PREF_SUG_BG_COLOR = 'crack_sug_bg_color';

    const PREF_UI_TEXT_COLOR = 'crack_ui_text_color';
    const PREF_UI_BG_COLOR = 'crack_ui_bg_color';
    const PREF_UI_BORDER_COLOR = 'crack_ui_border_color';

    const PREF_UI_BOX_BG_COLOR = 'crack_ui_box_color';
    const PREF_SHOW_SUG_ON_COMPLETE = 'crack_show_sug_on_complete';
    const PREF_SHOW_ADVANCED_OPT_COLOR = 'crack_show_advanced_opt_color';
    const PREF_MAX_SUGGESTIONS = 'crack_max_suggestions_size';
    const DEFAULT_MAX_SUGGESTIONS = 8;
    const MIN_MAX_SUGGESTIONS = 1;
    const MAX_MAX_SUGGESTIONS = 20;

    // Wiki-based rig planner preferences. Component values from Torn Wiki Cracking page.
    const PREF_RIG_SKILL_LEVEL = 'crack_rig_skill_level';
    const PREF_RIG_INV_PREFIX = 'crack_rig_inv_';
    const RIG_GRID_SIZE = 5;
    const RIG_COMPONENTS = {
        PSU: {
            label: 'PSU', short: 'PSU', type: 'power', powerSupply: 750, powerUse: 0, mips: 0, cells: 2,
            image: 'https://www.torn.com/images/items/1306/medium@2x.png',
            tip: 'Supplies 750W of power. Occupies two chassis cells.'
        },
        CPU: {
            label: 'CPU', short: 'CPU', type: 'cpu', powerUse: 70, mips: 30000, cells: 1, heat: 'high',
            image: 'https://www.torn.com/images/items/1301/medium@2x.png',
            tip: '70W · 30,000 MIPS · high heat.'
        },
        ECPU: {
            label: 'eCPU', short: 'eCPU', type: 'cpu', powerUse: 30, mips: 25000, cells: 1, heat: 'low',
            image: 'https://www.torn.com/images/items/1300/medium@2x.png',
            tip: '30W · 25,000 MIPS · low heat.'
        },
        HPCPU: {
            label: 'HPCPU', short: 'HPC', type: 'cpu', powerUse: 150, mips: 50000, cells: 1, heat: 'very high',
            image: 'https://www.torn.com/images/items/1302/medium@2x.png',
            tip: '150W · 50,000 MIPS · very high heat.'
        },
        FAN: {
            label: 'Computer Fan', short: 'Fan', type: 'cooling', powerUse: 5, mips: 0, cells: 1,
            image: 'https://www.torn.com/images/items/1303/medium@2x.png',
            tip: 'Consumes 5W and provides broad cooling.'
        },
        WB: {
            label: 'Water Block', short: 'WB', type: 'cooling', powerUse: 0, mips: 0, cells: 1,
            image: 'https://www.torn.com/images/items/1304/medium@2x.png',
            tip: 'Moderate cooling in a confined area; useful beside hot chips.'
        },
        HS: {
            label: 'Heat Sink', short: 'HS', type: 'cooling', powerUse: 0, mips: 0, cells: 1,
            image: 'https://www.torn.com/images/items/1305/medium@2x.png',
            tip: 'Draws heat from directly adjacent components.'
        },
    };
    const RIG_COMPONENT_ORDER = ['HPCPU', 'ECPU', 'CPU', 'FAN', 'WB', 'HS', 'PSU'];

    const THEME_PRESETS = {
        dark: {
            uiBg: '#000',
            uiText: '#0f0',
            uiBorder: '#0f0',
            overlayBg: 'rgba(0,0,0,0.5)',
            boxBg: '#111',
            sugBg: '#000',
            sugText: '#0f0',
        },
        light: {
            uiBg: '#fff',
            uiText: '#03396c',
            uiBorder: '#39ace7',
            overlayBg: 'rgba(0,0,0,0.5)',
            boxBg: '#fff',
            sugBg: '#fff',
            sugText: '#03396c',
        },
    };

    /* --------------------------
       State
       -------------------------- */
    let dict = [];
    let dictLoaded = false;
    let dictLoading = false;
    let remoteWords = new Set();
    let statusEl = null;
    const prevRowStates = new Map();
    const panelUpdateTimers = new Map();
    const LAST_INPUT = { key: null, time: 0 };

    let outboxFlushTimer = null;
    let lastOutboxPost = 0;

    let scanInterval = null;
    let menuInterval = null;
    let runtimeStarted = false;
    let autoSyncTimer = null;
    let autoSyncInFlight = false;

    /* --------------------------
       Utils
       -------------------------- */
    function crackLog(...args) { if (debug) console.log('[Crack]', ...args); }

    function isPdaUserAgentCheck() {
        return window.navigator.userAgent.includes("com.manuito.tornpda");
    }

    function getBoolPref(key, def = true) {
        const v = localStorage.getItem(key);
        return v === null ? def : v === '1';
    }

    function setBoolPref(key, val) {
        localStorage.setItem(key, val ? '1' : '0');
    }

    function getStrPref(key, def = '') {
        const v = localStorage.getItem(key);
        return v === null ? def : String(v);
    }

    function setStrPref(key, val) {
        localStorage.setItem(key, String(val));
    }

    function getIntPref(key, def = 0) {
        const v = localStorage.getItem(key);
        const n = v === null ? NaN : parseInt(v, 10);
        return Number.isFinite(n) ? n : def;
    }

    function setIntPref(key, val) {
        const n = Number(val);
        localStorage.setItem(key, String(Number.isFinite(n) ? Math.trunc(n) : 0));
    }

    function clampInt(n, min, max, def) {
        n = Number(n);
        if (!Number.isFinite(n)) n = def;
        return Math.max(min, Math.min(max, Math.trunc(n)));
    }

    function getClampedIntPref(key, def, min, max) {
        return clampInt(getIntPref(key, def), min, max, def);
    }

    function splitMiddle(str) {
        const mid = Math.ceil(str.length / 2);
        return str.slice(0, mid) + "\n" + str.slice(mid);
    }

    function normalizeThemeName(v) {
        return v === 'light' ? 'light' : 'dark';
    }

    function getThemePreset() {
        const name = normalizeThemeName(getStrPref(THEME_PREF_KEY, 'dark'));
        return { name, ...THEME_PRESETS[name] };
    }

    function getTheme() {
        const preset = getThemePreset();
        return {
            name: preset.name,
            uiBg: getStrPref(PREF_UI_BG_COLOR, preset.uiBg),
            uiText: getStrPref(PREF_UI_TEXT_COLOR, preset.uiText),
            uiBorder: getStrPref(PREF_UI_BORDER_COLOR, preset.uiBorder),
            overlayBg: preset.overlayBg,
            boxBg: getStrPref(PREF_UI_BOX_BG_COLOR, preset.boxBg),
            sugBg: getStrPref(PREF_SUG_BG_COLOR, preset.sugBg),
            sugText: getStrPref(PREF_SUG_TEXT_COLOR, preset.sugText),
            sugFontPx: getIntPref(PREF_SUG_FONT_PX, 10),
        };
    }

    function applyPreset(themeName) {
        const name = normalizeThemeName(themeName);
        const p = THEME_PRESETS[name];
        setStrPref(THEME_PREF_KEY, name);
        setStrPref(PREF_UI_BG_COLOR, p.uiBg);
        setStrPref(PREF_UI_TEXT_COLOR, p.uiText);
        setStrPref(PREF_UI_BORDER_COLOR, p.uiBorder);
        setStrPref(PREF_SUG_BG_COLOR, p.sugBg);
        setStrPref(PREF_SUG_TEXT_COLOR, p.sugText);
        setStrPref(PREF_UI_BOX_BG_COLOR, p.boxBg);
        if (localStorage.getItem(PREF_SUG_FONT_PX) === null) setIntPref(PREF_SUG_FONT_PX, 10);
    }

    function applyStatusBadgeTheme(el) {
        const t = getTheme();
        if (!el) return;
        el.style.background = t.uiBg;
        el.style.color = t.uiText;
        el.style.border = `1px solid ${t.uiBorder}`;
    }

    function applyMenuButtonTheme(btn) {
        const t = getTheme();
        if (!btn) return;
        btn.style.background = t.uiBg;
        btn.style.color = t.uiText;
        btn.style.border = `1px solid ${t.uiBorder}`;
        btn.style.borderRadius = '4px';
    }

    function appplyMenuInputTheme(inpt) {
        const t = getTheme();
        if (!inpt) return;
        inpt.style.background = t.uiBg;
        inpt.style.color = t.uiText;
        inpt.style.border = `1px solid ${t.uiBorder}`;
        inpt.style.borderRadius = '4px';
    }

    function styleSugSpan(sp) {
        const t = getTheme();
        sp.style.padding = '2px 4px';
        sp.style.margin = '0 2px';
        sp.style.display = 'inline-block';
        sp.style.borderRadius = '3px';
        sp.style.fontSize = `${t.sugFontPx}px`;
        sp.style.color = t.sugText;
    }

    function applyPanelTheme(panel) {
        const t = getTheme();
        if (!panel) return;
        panel.style.background = t.sugBg;
        panel.style.color = t.sugText;
        panel.style.fontSize = `${t.sugFontPx}px`;
        panel.style.textAlign = 'center';
        panel.style.position = 'absolute';
        panel.style.zIndex = '9999';

        const listDiv = panel.querySelector(':scope > div');
        if (!listDiv) return;
        for (const child of Array.from(listDiv.children)) {
            if (child.dataset && child.dataset.kind === 'sug') {
                styleSugSpan(child);
            }
        }
    }

    function applyThemeEverywhere() {
        applyStatusBadgeTheme(statusEl);
        const btn = document.getElementById('__crack_menu_btn');
        if (btn) applyMenuButtonTheme(btn);
        for (const panel of document.querySelectorAll('.__crackhelp_panel')) {
            applyPanelTheme(panel);
        }
    }

    function addHr(parent, theme0, count = 1, margin = "12px 0") {
        for (let i = 0; i < count; i++) {
            const hr = document.createElement("hr");
            hr.style.cssText = `border:none; border-top:1px solid ${theme0.uiBorder}; margin:${margin};`;
            parent.appendChild(hr);
        }
    }

    function unlockedRigCountForSkill(skill) {
        const s = clampInt(skill, 0, 100, 0);
        if (s >= 75) return 3;
        if (s >= 50) return 2;
        if (s >= 25) return 1;
        return 0;
    }

    function getRigInventoryFromPrefs() {
        const inv = {};
        for (const key of RIG_COMPONENT_ORDER) {
            inv[key] = getClampedIntPref(PREF_RIG_INV_PREFIX + key, 0, 0, 999);
        }
        return inv;
    }

    function saveRigInventoryToPrefs(inv) {
        for (const key of RIG_COMPONENT_ORDER) {
            setIntPref(PREF_RIG_INV_PREFIX + key, inv[key] || 0);
        }
    }

    function makeEmptyRigGrid() {
        return Array.from({ length: RIG_GRID_SIZE }, () => Array.from({ length: RIG_GRID_SIZE }, () => null));
    }

    function gridCellFree(grid, r, c) {
        return !!grid && r >= 0 && r < RIG_GRID_SIZE && c >= 0 && c < RIG_GRID_SIZE && !grid[r][c];
    }

    function placePSU(grid) {
        const pairs = [
            [[0, 0], [0, 1]], [[0, 3], [0, 4]], [[4, 0], [4, 1]], [[4, 3], [4, 4]],
            [[0, 0], [1, 0]], [[0, 4], [1, 4]], [[3, 0], [4, 0]], [[3, 4], [4, 4]],
        ];
        for (const [[r1, c1], [r2, c2]] of pairs) {
            if (gridCellFree(grid, r1, c1) && gridCellFree(grid, r2, c2)) {
                grid[r1][c1] = 'PSU';
                grid[r2][c2] = 'PSU';
                return true;
            }
        }
        return false;
    }

    function chooseCoolingForCpu(cpuKey, inv) {
        const priority = cpuKey === 'HPCPU' ? ['WB', 'FAN', 'HS'] : ['FAN', 'WB', 'HS'];
        for (const key of priority) {
            if ((inv[key] || 0) > 0) return key;
        }
        return null;
    }

    function placeCpuPair(grid, cpuKey, coolingKey) {
        const pairs = [
            [[1, 1], [1, 2]], [[1, 3], [2, 3]], [[2, 1], [3, 1]], [[3, 3], [3, 2]],
            [[2, 4], [1, 4]], [[3, 0], [4, 0]], [[4, 2], [4, 3]], [[2, 0], [1, 0]],
            [[0, 2], [1, 2]], [[2, 2], [2, 1]], [[3, 4], [4, 4]], [[4, 1], [4, 2]],
        ];
        for (const [[cr, cc], [hr, hc]] of pairs) {
            if (gridCellFree(grid, cr, cc) && gridCellFree(grid, hr, hc)) {
                grid[cr][cc] = cpuKey;
                grid[hr][hc] = coolingKey;
                return true;
            }
        }
        return false;
    }

    function countFreeCells(grids) {
        let n = 0;
        for (const grid of grids) {
            for (const row of grid) {
                for (const cell of row) if (!cell) n++;
            }
        }
        return n;
    }

    function buildRigPlan(skill, rawInv) {
        const rigCount = unlockedRigCountForSkill(skill);
        const inv = Object.assign({}, rawInv || {});
        for (const key of RIG_COMPONENT_ORDER) inv[key] = clampInt(inv[key] || 0, 0, 999, 0);

        const grids = Array.from({ length: rigCount }, () => makeEmptyRigGrid());
        const used = Object.fromEntries(RIG_COMPONENT_ORDER.map(k => [k, 0]));
        const notes = [];

        if (rigCount <= 0) {
            notes.push('No chassis unlocked yet. Wiki unlocks the first 5×5 chassis at Cracking skill 25.');
            return { rigCount, grids, used, totalMips: 0, totalPowerUse: 0, totalPowerSupply: 0, online: false, notes };
        }

        // Put in at least one PSU if available. Power is global across all chassis, but heat stays local.
        if (inv.PSU > 0 && placePSU(grids[0])) {
            inv.PSU--;
            used.PSU++;
        }

        const cpuPriority = ['HPCPU', 'ECPU', 'CPU'];
        let totalMips = 0;
        let totalPowerUse = 0;
        let totalPowerSupply = used.PSU * RIG_COMPONENTS.PSU.powerSupply;

        function canPower(extraKey, coolingKey) {
            const extraPower = (RIG_COMPONENTS[extraKey]?.powerUse || 0) + (RIG_COMPONENTS[coolingKey]?.powerUse || 0);
            if (totalPowerUse + extraPower <= totalPowerSupply) return true;
            if (inv.PSU <= 0) return false;
            for (const grid of grids) {
                if (placePSU(grid)) {
                    inv.PSU--;
                    used.PSU++;
                    totalPowerSupply += RIG_COMPONENTS.PSU.powerSupply;
                    return totalPowerUse + extraPower <= totalPowerSupply;
                }
            }
            return false;
        }

        let placedSomething = true;
        while (placedSomething && countFreeCells(grids) >= 2) {
            placedSomething = false;
            for (const cpuKey of cpuPriority) {
                if ((inv[cpuKey] || 0) <= 0) continue;
                const coolingKey = chooseCoolingForCpu(cpuKey, inv);
                if (!coolingKey) continue;
                if (!canPower(cpuKey, coolingKey)) continue;

                let placed = false;
                // Spread heat by filling the least-used chassis first.
                const rigOrder = grids.map((grid, idx) => ({ idx, usedCells: 25 - grid.flat().filter(x => !x).length }))
                    .sort((a, b) => a.usedCells - b.usedCells)
                    .map(x => x.idx);
                for (const idx of rigOrder) {
                    if (placeCpuPair(grids[idx], cpuKey, coolingKey)) {
                        placed = true;
                        break;
                    }
                }
                if (!placed) continue;

                inv[cpuKey]--;
                inv[coolingKey]--;
                used[cpuKey]++;
                used[coolingKey]++;
                totalMips += RIG_COMPONENTS[cpuKey].mips;
                totalPowerUse += RIG_COMPONENTS[cpuKey].powerUse + RIG_COMPONENTS[coolingKey].powerUse;
                placedSomething = true;
                break;
            }
        }

        const online = used.PSU > 0 && totalMips >= 100000 && totalPowerUse <= totalPowerSupply;
        if (!online) {
            if (used.PSU <= 0) notes.push('Needs at least one PSU before the rig can come online.');
            if (totalMips < 100000) notes.push('Needs at least 100,000 MIPS before the rig comes online.');
            if (totalPowerUse > totalPowerSupply) notes.push('Needs more PSU power.');
        }
        if (used.HPCPU > 0) notes.push('HPCPUs are MIPS-heavy but very hot; watch heat and consider water blocks/fans around them.');
        if (used.PSU > 0 && rigCount > 1) notes.push('Power/MIPS are global, but heat is local to each chassis, so the planner spreads CPUs across rigs.');
        if (used.PSU < (rawInv?.PSU || 0) && countFreeCells(grids) < 2) notes.push('Some parts are unused because the shown chassis space is full.');

        return { rigCount, grids, used, totalMips, totalPowerUse, totalPowerSupply, online, notes };
    }

    function makeRigIcon(key, size = 28) {
        const meta = RIG_COMPONENTS[key];
        const img = document.createElement('img');
        img.src = meta?.image || '';
        img.alt = meta?.label || key || 'Rig component';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.style.cssText = `width:${size}px; height:${size}px; object-fit:contain; display:block; pointer-events:none;`;
        img.onerror = () => {
            const fallback = document.createElement('span');
            fallback.textContent = meta?.short || key || '?';
            fallback.style.cssText = 'font-size:9px; font-family:monospace; line-height:1;';
            img.replaceWith(fallback);
        };
        return img;
    }

    function makeRigComponentTitle(key) {
        const meta = RIG_COMPONENTS[key];
        if (!meta) return key || 'Empty';
        const stats = [];
        if (meta.mips) stats.push(`${meta.mips.toLocaleString()} MIPS`);
        if (meta.powerUse) stats.push(`${meta.powerUse}W use`);
        if (meta.powerSupply) stats.push(`${meta.powerSupply}W supply`);
        if (meta.heat) stats.push(`${meta.heat} heat`);
        if (meta.cells > 1) stats.push(`${meta.cells} cells`);
        return `${meta.label}${stats.length ? ' — ' + stats.join(' · ') : ''}${meta.tip ? '\n' + meta.tip : ''}`;
    }

    function makeRigPlanVisual(plan, theme0) {
        const wrap = document.createElement('div');
        wrap.style.cssText = `margin-top:8px; font-size:12px; color:${theme0.uiText};`;

        const summary = document.createElement('div');
        summary.style.cssText = `border:1px solid ${theme0.uiBorder}; border-radius:6px; padding:8px; background:${theme0.uiBg}; margin-bottom:8px; line-height:1.45;`;
        summary.textContent = plan.rigCount <= 0
            ? 'Rig planner: 0 chassis unlocked.'
            : `Rig planner: ${plan.rigCount} chassis · ${plan.totalMips.toLocaleString()} MIPS · ${plan.totalPowerUse}/${plan.totalPowerSupply}W · ${plan.online ? 'ONLINE-capable' : 'not online yet'}`;
        wrap.appendChild(summary);

        if (plan.rigCount > 0) {
            const gridWrap = document.createElement('div');
            gridWrap.style.cssText = 'display:flex; flex-wrap:wrap; gap:10px; justify-content:center;';

            plan.grids.forEach((grid, idx) => {
                const card = document.createElement('div');
                card.style.cssText = `border:1px solid ${theme0.uiBorder}; border-radius:8px; padding:8px; background:${theme0.boxBg};`;

                const title = document.createElement('div');
                title.textContent = `Chassis ${idx + 1}`;
                title.style.cssText = 'text-align:center; margin-bottom:6px; font-weight:bold;';
                card.appendChild(title);

                const gridEl = document.createElement('div');
                gridEl.style.cssText = 'display:grid; grid-template-columns:repeat(5,42px); grid-template-rows:repeat(5,42px); gap:4px;';
                for (let r = 0; r < RIG_GRID_SIZE; r++) {
                    for (let c = 0; c < RIG_GRID_SIZE; c++) {
                        const key = grid[r][c];
                        const cell = document.createElement('div');
                        cell.title = key ? makeRigComponentTitle(key) : 'Empty';
                        cell.style.cssText = `height:42px; width:42px; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; border:1px solid ${theme0.uiBorder}; border-radius:5px; font-size:7px; font-family:monospace; background:${key ? theme0.uiBg : 'transparent'}; color:${theme0.uiText}; opacity:${key ? '1' : '0.28'}; overflow:hidden;`;
                        if (key) {
                            cell.appendChild(makeRigIcon(key, 27));
                            const lab = document.createElement('span');
                            lab.textContent = RIG_COMPONENTS[key].short;
                            lab.style.cssText = 'line-height:1; max-width:40px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
                            cell.appendChild(lab);
                        }
                        gridEl.appendChild(cell);
                    }
                }
                card.appendChild(gridEl);
                gridWrap.appendChild(card);
            });
            wrap.appendChild(gridWrap);
        }

        const usedLine = document.createElement('div');
        usedLine.style.cssText = 'margin-top:8px; text-align:center; opacity:0.95; line-height:1.4;';
        usedLine.textContent = `Used: PSU ${plan.used.PSU}, HPCPU ${plan.used.HPCPU}, eCPU ${plan.used.ECPU}, CPU ${plan.used.CPU}, Fan ${plan.used.FAN}, Water Block ${plan.used.WB}, Heat Sink ${plan.used.HS}`;
        wrap.appendChild(usedLine);

        const legend = document.createElement('div');
        legend.style.cssText = 'margin-top:8px; display:flex; flex-wrap:wrap; gap:6px; justify-content:center;';
        for (const key of ['HPCPU', 'CPU', 'ECPU', 'FAN', 'WB', 'HS', 'PSU']) {
            const meta = RIG_COMPONENTS[key];
            const item = document.createElement('div');
            item.title = makeRigComponentTitle(key);
            item.style.cssText = `display:flex; align-items:center; gap:4px; border:1px solid ${theme0.uiBorder}; border-radius:6px; padding:3px 5px; background:${theme0.uiBg};`;
            item.appendChild(makeRigIcon(key, 18));
            const txt = document.createElement('span');
            txt.textContent = `${meta.short} x${plan.used[key] || 0}`;
            txt.style.cssText = 'font-size:10px; white-space:nowrap;';
            item.appendChild(txt);
            legend.appendChild(item);
        }
        wrap.appendChild(legend);

        if (plan.notes.length) {
            const notes = document.createElement('div');
            notes.style.cssText = 'margin-top:8px; opacity:0.9; line-height:1.4;';
            notes.textContent = 'Notes: ' + plan.notes.join(' ');
            wrap.appendChild(notes);
        }

        const fineprint = document.createElement('div');
        fineprint.style.cssText = 'margin-top:8px; opacity:0.85; text-align:center; line-height:1.4;';
        fineprint.textContent = 'PSU appears in two cells because it occupies two slots. This is a safe visual suggestion, not a guaranteed optimal heat formula.';
        wrap.appendChild(fineprint);

        return wrap;
    }

    function ensureStatusBadge() {
        if (statusEl) return statusEl;
        statusEl = document.createElement('div');
        statusEl.id = '__crack_status';
        statusEl.style.cssText = `
            position: fixed; right: 10px; bottom: 40px; z-index: 10000;
            padding:6px 8px; font-size:11px; font-family:monospace; opacity:0.9;
            border-radius:6px;
        `;
        statusEl.textContent = 'Dictionary: Idle';
        document.body.appendChild(statusEl);

        applyStatusBadgeTheme(statusEl);

        const show = getBoolPref(STATUS_PREF_KEY, true);
        statusEl.style.display = show ? 'block' : 'none';
        return statusEl;
    }

    const __statusSinks = new Set();
    function registerStatusSink(el) { if (el) __statusSinks.add(el); }
    function unregisterStatusSink(el) { if (el) __statusSinks.delete(el); }

    function setStatus(msg) {
        const text = `Dictionary: ${msg}`;
        const badge = ensureStatusBadge();
        if (badge.textContent !== text) badge.textContent = text;
        __statusSinks.forEach(el => { if (el && el.textContent !== text) el.textContent = text; });
        crackLog('STATUS →', msg);
    }

    function gmRequest(opts) {
        return new Promise((resolve, reject) => {
            try {
                const safeOpts = Object.assign({}, opts);
                if (!('responseType' in safeOpts) || !safeOpts.responseType) safeOpts.responseType = 'text';
                safeOpts.headers = Object.assign({ Accept: 'application/json, text/plain, */*; q=0.1' }, safeOpts.headers || {});
                GM_xmlhttpRequest({ ...safeOpts, onload: resolve, onerror: reject, ontimeout: reject });
            } catch (err) {
                reject(err);
            }
        });
    }

    function getHeader(headers, name) {
        const re = new RegExp('^' + name + ':\\s*(.*)$', 'mi');
        const m = headers && headers.match ? headers.match(re) : null;
        return m ? m[1].trim() : null;
    }

    function isGzipPath(pathOrUrl) {
        try {
            const s = String(pathOrUrl || '');
            const clean = s.split('?')[0];
            return /\.gz$/i.test(clean);
        } catch (_) {
            return false;
        }
    }

    async function gunzipArrayBufferToText(arrayBuffer) {
        if (!arrayBuffer) return '';
        if (typeof DecompressionStream !== 'function') {
            throw new Error('Your browser does not support DecompressionStream(gzip). Upload an uncompressed snapshot/diff (plain .txt / .ndjson) or use a modern browser.');
        }
        const ds = new DecompressionStream('gzip');
        const stream = new Blob([arrayBuffer]).stream().pipeThrough(ds);
        return await new Response(stream).text();
    }

    async function responseToText(res, pathOrUrl) {
        if (isGzipPath(pathOrUrl)) {
            return await gunzipArrayBufferToText(res.response);
        }
        return res.responseText || '';
    }

    function metadataURL(force = false) {
        if (!COMMUNITY_SYNC_ENABLED || !METADATA_URL) return '';
        const ts = force ? Date.now() : Math.floor(Date.now() / 60000);
        return `${METADATA_URL}?cb=${ts}`;
    }

    function formatShortDuration(ms) {
        if (ms <= 0) return 'now';
        const s = Math.floor(ms / 1000);
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (d > 0) return `${d}d ${h}h ${m}m`;
        if (h > 0) return `${h}h ${m}m ${sec}s`;
        if (m > 0) return `${m}m ${sec}s`;
        return `${sec}s`;
    }

    function cleanupView() {
        const btn = document.getElementById('__crack_menu_btn');
        if (btn && btn.parentNode) btn.parentNode.removeChild(btn);

        const panels = document.querySelectorAll('.__crackhelp_panel');
        if (panels) panels.forEach(p => p.remove());

        for (const timer of panelUpdateTimers.values()) clearTimeout(timer);
        panelUpdateTimers.clear();
        prevRowStates.clear();

        if (statusEl && statusEl.parentNode) {
            statusEl.parentNode.removeChild(statusEl);
            statusEl = null;
        }
    }

    /* --------------------------
       IndexedDB
       -------------------------- */
    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function idbSet(key, value) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(value, key);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async function idbGet(key) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function idbClear() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async function clearLocalDictCache() {
        await idbClear();
        crackLog('Cleared cached dictionary from IndexedDB');
        setStatus('Cleared cache — reload');
    }

    /* --------------------------
       Key capture
       -------------------------- */
    function captureKey(k) {
        if (!k) return;
        const m = String(k).match(/^[A-Za-z0-9._]$/);
        if (!m) return;
        LAST_INPUT.key = k.toUpperCase();
        LAST_INPUT.time = performance.now();
    }

    window.addEventListener('keydown', (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        captureKey(e.key);
    }, true);

    /* --------------------------
       Dictionary load
       -------------------------- */
    async function commitBucketsToIDB(buckets) {
        for (const lenStr of Object.keys(buckets)) {
            const L = Number(lenStr);
            const newArr = Array.from(buckets[lenStr]);
            let existing = await idbGet(`len_${L}`);
            if (!existing) existing = [];
            const merged = Array.from(new Set([...existing, ...newArr]));
            await idbSet(`len_${L}`, merged);
            dict[L] = merged;
        }
    }

    async function fetchAndIndex(url, onProgress) {
        setStatus('Downloading base wordlist …');
        let res;
        try {
            res = await gmRequest({ method: 'GET', url, timeout: 90000, responseType: 'text' });
        } catch (e) {
            throw e;
        }

        if (res.status < 200 || res.status >= 300 || !res.responseText) {
            const err = new Error(`Bad response from base wordlist: ${res.status}`);
            err.status = res.status;
            throw err;
        }

        setStatus('Indexing…');

        const lines = (res.responseText || '').split(/\r?\n/);
        const buckets = {};
        let processed = 0;

        for (const raw of lines) {
            processed++;
            const word = (raw || '').trim().toUpperCase();
            if (!word) continue;
            if (!/^[A-Z0-9_.]+$/.test(word)) continue;
            const L = word.length;
            if (L < MIN_LENGTH || L > MAX_LENGTH) continue;
            if (!buckets[L]) buckets[L] = new Set();
            buckets[L].add(word);

            if (processed % 5000 === 0 && typeof onProgress === 'function') {
                onProgress({ phase: '1M-index', processed, pct: null });
                await new Promise(r => setTimeout(r, 0));
            }
        }

        await commitBucketsToIDB(buckets);

        const perLengthCounts = {};
        for (let L = MIN_LENGTH; L <= MAX_LENGTH; L++) {
            perLengthCounts[L] = (await idbGet(`len_${L}`))?.length || 0;
        }

        setStatus('1M cached');
        return { totalProcessed: processed, perLengthCounts };
    }

    function needReloadAfterBaseLoad() {
        try {
            if (sessionStorage.getItem('__crack_base_reload_done') === '1') return false;
            sessionStorage.setItem('__crack_base_reload_done', '1');
            return true;
        } catch {
            return true;
        }
    }

    async function loadDict() {
        if (dictLoaded || dictLoading) return;
        dictLoading = true;
        setStatus('Loading from cache…');

        let hasData = false;
        dict = [];
        for (let len = MIN_LENGTH; len <= MAX_LENGTH; len++) {
            const chunk = await idbGet(`len_${len}`);
            if (chunk && chunk.length) {
                dict[len] = chunk;
                hasData = true;
            }
        }

        if (!hasData) {
            crackLog('No cache found. Downloading dictionary…');
            const MAX_TRIES = 4;
            const DELAYS = [0, 3000, 10000, 30000];
            let ok = false, lastErr = null;

            for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
                try {
                    await fetchAndIndex(WORDLIST_URL, ({ phase, processed }) => {
                        if (phase === '1M-index') setStatus(`Indexing 1M… processed ${processed}`);
                    });
                    ok = true;
                    break;
                } catch (e) {
                    lastErr = e;
                    const wait = DELAYS[Math.min(attempt, DELAYS.length - 1)];
                    crackLog(`Base download failed (try ${attempt + 1}/${MAX_TRIES})`, e);
                    setStatus(`Download failed (try ${attempt + 1}/${MAX_TRIES}) — retrying in ${Math.ceil(wait / 1000)}s…`);
                    if (wait) await new Promise(r => setTimeout(r, wait));
                }
            }

            if (!ok) {
                crackLog('Giving up on base download for now.', lastErr);
                dictLoading = false;
                dictLoaded = false;
                setTimeout(() => { loadDict().catch(() => {}); }, 60000);
                setStatus('Failed to fetch base wordlist (will retry)...');
                return;
            }

            if (needReloadAfterBaseLoad()) {
                setStatus('Dictionary cached — reloading…');
                setTimeout(() => location.reload(), 120);
                return;
            }
        } else {
            crackLog('Dictionary loaded from IndexedDB');
        }

        dictLoaded = true;
        dictLoading = false;
        setStatus(COMMUNITY_SYNC_ENABLED ? 'Ready' : 'Ready (local mode)');
    }

    async function fetchRemoteMeta(force = false) {
        if (!COMMUNITY_SYNC_ENABLED) {
            await idbSet('cf_pending_delta', 0);
            return { count: 0, etag: '', snapshot_path: null, diff_path: null, generated_at: null, disabled: true };
        }
        try {
            const lastSync = Number(await idbGet('cf_last_sync_ts')) || 0;
            const now = Date.now();

            if (!force && (now - lastSync) < SYNC_MIN_INTERVAL_MS) {
                crackLog('Skipping fetchRemoteMeta (recent sync)');
                const cachedMeta = await idbGet('cf_metadata') || {};
                return {
                    count: cachedMeta.count || Number(await idbGet('cf_remote_count')) || 0,
                    etag: '',
                    snapshot_path: cachedMeta.snapshot_path || null,
                    diff_path: cachedMeta.diff_path || null,
                    generated_at: cachedMeta.generated_at || null
                };
            }

            const metaUrl = metadataURL(force);
            crackLog('Fetching metadata.json ->', metaUrl);
            const metaRes = await gmRequest({ method: 'GET', url: metaUrl, timeout: 10000, responseType: 'text' });

            if (metaRes.status !== 200) {
                crackLog('metadata.json not available; using cached meta only', metaRes.status);
                const cachedMeta = await idbGet('cf_metadata') || {};
                return {
                    count: cachedMeta.count || Number(await idbGet('cf_remote_count')) || 0,
                    etag: '',
                    snapshot_path: cachedMeta.snapshot_path || null,
                    diff_path: cachedMeta.diff_path || null,
                    generated_at: cachedMeta.generated_at || null
                };
            }

            const meta = JSON.parse(metaRes.responseText || '{}');
            const toSave = {
                count: meta.count || 0,
                etag: '',
                snapshot_path: meta.snapshot_path || meta.latest_path || null,
                diff_path: meta.diff_path || null,
                generated_at: meta.generated_at || null
            };

            await idbSet('cf_metadata', toSave);
            await idbSet('cf_remote_count', toSave.count);
            await idbSet('cf_last_sync_ts', Date.now());

            return {
                count: toSave.count,
                etag: '',
                snapshot_path: toSave.snapshot_path,
                diff_path: toSave.diff_path,
                generated_at: toSave.generated_at
            };
        } catch (e) {
            crackLog('fetchRemoteMeta failed:', e);
            return {
                count: Number(await idbGet('cf_remote_count')) || 0,
                etag: '',
                snapshot_path: null,
                diff_path: null,
                generated_at: null
            };
        }
    }

    async function downloadCommunityWordlist(meta, ifNoneMatchEtag) {
        if (!COMMUNITY_SYNC_ENABLED) return 0;
        try {
            if (!meta || !meta.snapshot_path) {
                crackLog('No snapshot_path in metadata.');
                return 0;
            }

            const snapshotUrl = `${CF_STORAGE_BASE}/${meta.snapshot_path}`;
            crackLog('Fetching snapshot ->', snapshotUrl);

            const headers = {};
            if (ifNoneMatchEtag) headers['If-None-Match'] = ifNoneMatchEtag;

            const isGz = isGzipPath(meta.snapshot_path);
            const res = await gmRequest({
                method: 'GET',
                url: snapshotUrl,
                headers,
                timeout: 45000,
                responseType: isGz ? 'arraybuffer' : 'text'
            });

            const remoteEtag = getHeader(res.responseHeaders, 'ETag') || '';
            if (remoteEtag) await idbSet('cf_remote_etag', remoteEtag);

            if (res.status === 304) {
                crackLog('Snapshot unchanged (304)');
                await idbSet('cf_last_downloaded_count', meta.count || 0);
                await idbSet('cf_last_sync_ts', Date.now());
                return 0;
            }

            if (res.status !== 200) {
                crackLog('Snapshot fetch failed, status:', res.status);
                return 0;
            }

            const text = await responseToText(res, meta.snapshot_path);
            setStatus('Indexing snapshot…');
            const lines = text.split(/\r?\n/);
            const buckets = {};
            let processed = 0;

            for (const raw of lines) {
                processed++;
                const word = (raw || '').trim().toUpperCase();
                if (!word) continue;
                if (!/^[A-Z0-9_.]+$/.test(word)) continue;
                const L = word.length;
                if (L < MIN_LENGTH || L > MAX_LENGTH) continue;
                if (!buckets[L]) buckets[L] = new Set();
                buckets[L].add(word);
                if (processed % 5000 === 0) await new Promise(r => setTimeout(r, 0));
            }

            await commitBucketsToIDB(buckets);
            setStatus('Snapshot indexed');

            await idbSet('cf_remote_count', meta.count || 0);
            await idbSet('cf_last_downloaded_count', meta.count || 0);
            await idbSet('cf_last_sync_ts', Date.now());

            await idbSet('cf_metadata', {
                snapshot_path: meta.snapshot_path,
                diff_path: meta.diff_path || null,
                count: meta.count || 0,
                generated_at: meta.generated_at || null,
                etag: remoteEtag || ''
            });

            return 1;
        } catch (e) {
            crackLog('downloadCommunityWordlist failed:', e);
            return 0;
        }
    }

    async function checkRemoteAndMaybeDownload(force = false) {
        if (!COMMUNITY_SYNC_ENABLED) {
            await idbSet('cf_pending_delta', 0);
            setStatus('Ready (local mode)');
            return 0;
        }
        const meta = await fetchRemoteMeta(force);

        const lastDownloaded = (await idbGet('cf_last_downloaded_count')) || 0;
        const remoteCount = meta.count || Number(await idbGet('cf_remote_count')) || 0;
        const delta = Math.max(0, remoteCount - lastDownloaded);

        if (!force && delta < DOWNLOAD_MIN_DELTA) {
            crackLog(`Skip download: delta=${delta} < ${DOWNLOAD_MIN_DELTA}`);
            await idbSet('cf_pending_delta', delta);
            return 0;
        }

        setStatus(force ? 'Manual sync…' : `Syncing (+${delta})…`);
        const etag = (await idbGet('cf_remote_etag')) || '';
        const added = await downloadCommunityWordlist(meta, etag);
        await idbSet('cf_pending_delta', 0);
        return added;
    }

    async function msUntilEligibleSync() {
        if (!COMMUNITY_SYNC_ENABLED) return Number.POSITIVE_INFINITY;
        const last = Number(await idbGet('cf_last_sync_ts')) || 0;
        const remain = last + SYNC_MIN_INTERVAL_MS - Date.now();
        return Math.max(0, remain);
    }

    function startAutoSyncHeartbeat() {
        if (!COMMUNITY_SYNC_ENABLED) return;
        if (autoSyncTimer) return;
        autoSyncTimer = setInterval(async () => {
            if (autoSyncInFlight) return;
            if (!runtimeStarted) return;
            if (!isCrackingPage()) return;

            try {
                const remain = await msUntilEligibleSync();
                if (remain > 0) return;

                autoSyncInFlight = true;
                setStatus('Auto-syncing community words…');

                const added = await checkRemoteAndMaybeDownload(false);

                const remoteCount = await idbGet('cf_remote_count');
                const delta = await idbGet('cf_pending_delta');
                if (added && added > 0) {
                    setStatus(`Ready (+${added}, remote: ${remoteCount})`);
                } else {
                    setStatus(`Ready (remote ${remoteCount}${delta ? `, +${delta} pending` : ''})`);
                }
            } catch (e) {
                crackLog('Auto-sync failed', e);
                setStatus('Ready');
            } finally {
                autoSyncInFlight = false;
            }
        }, 1000);
    }

    /* --------------------------
       Outbox
       -------------------------- */
    async function enqueueOutbox(word) {
        if (!COMMUNITY_SYNC_ENABLED) return;
        if (!word) return;
        const w = word.toUpperCase();
        let out = await idbGet('cf_outbox') || [];
        if (!out.includes(w)) {
            out.push(w);
            await idbSet('cf_outbox', out);
            crackLog('Enqueued word to outbox:', w);
            ensureOutboxFlushScheduled();
        }
    }

    function ensureOutboxFlushScheduled() {
        if (outboxFlushTimer) return;
        outboxFlushTimer = setTimeout(flushOutbox, OUTBOX_FLUSH_INTERVAL_MS);
    }

    async function flushOutbox() {
        outboxFlushTimer = null;
        if (!COMMUNITY_SYNC_ENABLED) {
            await idbSet('cf_outbox', []);
            return;
        }
        let out = await idbGet('cf_outbox') || [];
        if (!out || out.length === 0) return;

        while (out.length > 0) {
            const batch = out.splice(0, OUTBOX_BATCH_SIZE);
            const now = Date.now();
            const sinceLast = now - lastOutboxPost;
            if (sinceLast < OUTBOX_POST_INTERVAL_MS) {
                await new Promise(r => setTimeout(r, OUTBOX_POST_INTERVAL_MS - sinceLast));
            }

            try {
                await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: CF_ADD_WORD_URL,
                        headers: { 'Content-Type': 'application/json' },
                        data: JSON.stringify({ words: batch }),
                        onload: (res) => (res.status >= 200 && res.status < 300) ? resolve(res) : reject(res),
                        onerror: reject,
                        ontimeout: reject,
                        timeout: 15000
                    });
                });

                crackLog('Flushed outbox batch:', batch.length);
                for (const w of batch) {
                    remoteWords.add(w);
                    await addWordToLocalCache(w);
                }
            } catch (e) {
                crackLog('Batch POST failed, falling back to single POSTs', e);
                for (const w of batch) {
                    try {
                        await new Promise((resolve, reject) => {
                            GM_xmlhttpRequest({
                                method: 'POST',
                                url: CF_ADD_WORD_URL,
                                headers: { 'Content-Type': 'application/json' },
                                data: JSON.stringify({ word: w }),
                                onload: (r) => (r.status >= 200 && r.status < 300) ? resolve(r) : reject(r),
                                onerror: reject,
                                ontimeout: reject,
                                timeout: 10000
                            });
                        });

                        crackLog('Flushed outbox (single):', w);
                        remoteWords.add(w);
                        await addWordToLocalCache(w);
                        await new Promise(r => setTimeout(r, OUTBOX_POST_INTERVAL_MS));
                    } catch (ee) {
                        crackLog('Single POST failed for', w, ee);
                        out.unshift(w);
                        break;
                    }
                }
            }

            lastOutboxPost = Date.now();
            await idbSet('cf_outbox', out);
        }
    }

    /* --------------------------
       Exclusions + suggestions
       -------------------------- */
    function loadExclusions(rowKey, len) {
        const raw = sessionStorage.getItem(EXCL_STORAGE_PREFIX + rowKey + '_' + len);
        let arr = [];
        if (raw) {
            try { arr = JSON.parse(raw); } catch {}
        }

        const out = new Array(len);
        for (let i = 0; i < len; i++) {
            const s = Array.isArray(arr[i]) ? arr[i] : (typeof arr[i] === 'string' ? arr[i].split('') : []);
            out[i] = new Set(s.map(c => String(c || '').toUpperCase()).filter(Boolean));
        }
        return out;
    }

    function saveExclusions(rowKey, len, sets) {
        const arr = new Array(len);
        for (let i = 0; i < len; i++) arr[i] = Array.from(sets[i] || new Set());
        sessionStorage.setItem(EXCL_STORAGE_PREFIX + rowKey + '_' + len, JSON.stringify(arr));
    }

    function schedulePanelUpdate(panel) {
        if (!panel) return;
        const key = panel.dataset.rowkey;
        if (panelUpdateTimers.has(key)) clearTimeout(panelUpdateTimers.get(key));
        panelUpdateTimers.set(key, setTimeout(() => {
            panel.updateSuggestions();
            panelUpdateTimers.delete(key);
        }, 50));
    }

    function addExclusion(rowKey, pos, letter, len) {
        letter = String(letter || '').toUpperCase();
        if (!letter) return;
        const sets = loadExclusions(rowKey, len);
        if (!sets[pos]) sets[pos] = new Set();
        const before = sets[pos].size;
        sets[pos].add(letter);
        if (sets[pos].size !== before) {
            saveExclusions(rowKey, len, sets);
            const panel = document.querySelector(`.__crackhelp_panel[data-rowkey="${rowKey}"]`);
            schedulePanelUpdate(panel);
        }
    }

    async function suggest(pattern, rowKey) {
        const len = pattern.length;
        if (len < MIN_LENGTH || len > MAX_LENGTH) return [];
        if (!dict[len]) {
            const chunk = await idbGet(`len_${len}`);
            if (!chunk) return [];
            dict[len] = chunk;
        }

        const maxSug = getClampedIntPref(PREF_MAX_SUGGESTIONS, DEFAULT_MAX_SUGGESTIONS, MIN_MAX_SUGGESTIONS, MAX_MAX_SUGGESTIONS);
        const maxCandidates = maxSug * 50;
        const workerUrl = URL.createObjectURL(new Blob([`
            function escapeRegexLiteral(s) {
                return String(s).replace(/[|\\\\{}()[\\]^$+*?.]/g, '\\\\$&');
            }

            self.onmessage = function(e) {
                const { dictChunk, pattern, max } = e.data;
                const regexPattern = String(pattern || '')
                    .split('*')
                    .map(escapeRegexLiteral)
                    .join('.');
                const regex = new RegExp('^' + regexPattern + '$');
                const out = [];
                for (const word of dictChunk) {
                    if (regex.test(word)) out.push(word);
                    if (out.length >= max) break;
                }
                self.postMessage(out);
            };
        `], { type: 'application/javascript' }));

        const worker = new Worker(workerUrl);

        const candidates = await new Promise((resolve) => {
            let done = false;
            const finish = (value) => {
                if (done) return;
                done = true;
                try { worker.terminate(); } catch (_) {}
                try { URL.revokeObjectURL(workerUrl); } catch (_) {}
                resolve(value);
            };

            worker.onmessage = (e) => finish([...new Set(e.data || [])]);
            worker.onerror = () => finish([]);
            worker.postMessage({ dictChunk: dict[len], pattern: pattern.toUpperCase(), max: maxCandidates });
        });

        const exSets = loadExclusions(rowKey, len);
        const filtered = candidates.filter(w => {
            for (let i = 0; i < len; i++) {
                const s = exSets[i];
                if (s && s.has(w[i])) return false;
            }
            return true;
        });

        return filtered.slice(0, maxSug);
    }

    function prependPanelToRow(row, pat, rowKey) {
        let panel = row.querySelector('.__crackhelp_panel');

        if (!panel) {
            panel = document.createElement('div');
            panel.className = '__crackhelp_panel';
            panel.dataset.rowkey = rowKey;
            panel.dataset.pattern = pat;
            panel._seq = 0;
            panel.style.cssText = 'text-align:center; position:absolute; z-index:9999;';
            panel.style.border = `1px solid ${getTheme().uiBorder}`;
            panel.style.borderRadius = '4px';

            const listDiv = document.createElement('div');
            listDiv.style.cssText = 'margin-top:2px;';
            panel.appendChild(listDiv);

            panel.updateSuggestions = async function () {
                const curPat = panel.dataset.pattern || '';
                const curRowKey = panel.dataset.rowkey;

                const showOnComplete = getBoolPref(PREF_SHOW_SUG_ON_COMPLETE, true);
                if (!showOnComplete && curPat && !curPat.includes('*')) {
                    if (listDiv.childNodes.length) listDiv.innerHTML = '';
                    return;
                }

                applyPanelTheme(panel);

                if (!dictLoaded && dictLoading) {
                    if (!listDiv.firstChild || listDiv.firstChild.textContent !== '(loading dictionary…)') {
                        listDiv.innerHTML = '<span style="padding:2px;color:#ff0;">(loading dictionary…)</span>';
                    }
                    return;
                }

                const seq = ++panel._seq;
                const sugs = await suggest(curPat, curRowKey);
                if (seq !== panel._seq) return;

                let i = 0;
                for (; i < sugs.length; i++) {
                    let sp = listDiv.children[i];
                    if (!sp) {
                        sp = document.createElement('span');
                        sp.dataset.kind = 'sug';
                        listDiv.appendChild(sp);
                    }
                    if (sp.textContent !== sugs[i]) sp.textContent = sugs[i];
                    styleSugSpan(sp);
                }

                while (listDiv.children.length > sugs.length) listDiv.removeChild(listDiv.lastChild);

                if (sugs.length === 0) {
                    if (!listDiv.firstChild) {
                        const sp = document.createElement('span');
                        sp.dataset.kind = 'msg';
                        sp.textContent = dictLoaded ? '(no matches)' : '(loading dictionary…)';
                        sp.style.padding = '2px 4px';
                        sp.style.color = dictLoaded ? '#a00' : '#ff0';
                        sp.style.background = 'transparent';
                        sp.style.fontSize = `${getTheme().sugFontPx}px`;
                        listDiv.appendChild(sp);
                    } else {
                        const sp = listDiv.firstChild;
                        const txt = dictLoaded ? '(no matches)' : '(loading dictionary…)';
                        if (sp.textContent !== txt) sp.textContent = txt;
                        sp.style.color = dictLoaded ? '#a00' : '#ff0';
                        sp.style.background = 'transparent';
                        sp.style.fontSize = `${getTheme().sugFontPx}px`;
                    }
                }
            };

            row.prepend(panel);
            applyPanelTheme(panel);
        } else {
            panel.dataset.pattern = pat;
            applyPanelTheme(panel);
        }

        schedulePanelUpdate(panel);
        return panel;
    }

    async function isWordInLocalDict(word) {
        const len = word.length;
        if (!dict[len]) {
            const chunk = await idbGet(`len_${len}`);
            if (!chunk) return false;
            dict[len] = chunk;
        }
        return dict[len].includes(word);
    }

    async function addWordToLocalCache(word) {
        const len = word.length;
        if (len < MIN_LENGTH || len > MAX_LENGTH) return;
        let chunk = await idbGet(`len_${len}`);
        if (!chunk) chunk = [];
        if (!chunk.includes(word)) {
            chunk.push(word);
            await idbSet(`len_${len}`, chunk);
            if (!dict[len]) dict[len] = [];
            if (!dict[len].includes(word)) dict[len].push(word);
            crackLog('Added to local cache:', word);
        }
    }

    function getRowKey(crimeOption) {
        if (!crimeOption.dataset.crackKey) {
            crimeOption.dataset.crackKey = String(Date.now()) + '-' + Math.floor(Math.random() * 100000);
        }
        return crimeOption.dataset.crackKey;
    }

    function resetRowTracking(crimeOption) {
        const oldKey = crimeOption.dataset.crackKey;
        if (oldKey) {
            prevRowStates.delete(oldKey);
            const panel = crimeOption.querySelector('.__crackhelp_panel');
            if (panel && panel.parentNode) {
                const key = panel.dataset.rowkey;
                if (panelUpdateTimers.has(key)) {
                    clearTimeout(panelUpdateTimers.get(key));
                    panelUpdateTimers.delete(key);
                }
                panel.parentNode.removeChild(panel);
            }
        }
        crimeOption.dataset.crackKey = String(Date.now()) + '-' + Math.floor(Math.random() * 100000);
        return crimeOption.dataset.crackKey;
    }

    function isProbablyCorrectSlot(slot) {
        const color = (getComputedStyle(slot).borderColor || '').replace(/\s+/g, '');
        return color === 'rgb(130,201,30)' || color === '#82c91e';
    }

    function attachSlotSensors(crimeOption, rowKey) {
        if (crimeOption.dataset.crackDelegated === '1') return;
        crimeOption.dataset.crackDelegated = '1';

        const slotSelector = '[class^="charSlot"]:not([class*="charSlotDummy"])';
        const badLineSelector = '[class*="incorrectGuessLine"]';

        const onVisualCue = (ev) => {
            const t = ev.target;
            const slot = t.closest && t.closest(slotSelector);
            if (!slot || !crimeOption.contains(slot)) return;

            const slots = crimeOption.querySelectorAll(slotSelector);
            const i = Array.prototype.indexOf.call(slots, slot);
            if (i < 0) return;
            const currentRowKey = getRowKey(crimeOption);
            if (isProbablyCorrectSlot(slot)) return;

            const now = performance.now();
            const shown = (slot.textContent || '').trim();
            if (shown && /^[A-Za-z0-9._]$/.test(shown)) return;

            const prev = prevRowStates.get(currentRowKey) || null;
            const hasRowLastInput = !!(prev && prev.lastInput && (now - prev.lastInput.time) <= 1800 && prev.lastInput.i === i);
            const isIncorrectLineEvent = t.matches && t.matches(badLineSelector);
            const freshGlobal = (now - (LAST_INPUT.time || 0)) <= 1800;

            let letter = null;
            if (hasRowLastInput) letter = prev.lastInput.letter;
            else if (isIncorrectLineEvent && freshGlobal && LAST_INPUT.key) letter = LAST_INPUT.key.toUpperCase();
            else return;

            if (!/^[A-Za-z0-9._]$/.test(letter)) return;

            const len = slots.length;
            addExclusion(currentRowKey, i, letter, len);

            const panel = document.querySelector(`.__crackhelp_panel[data-rowkey="${currentRowKey}"]`);
            if (panel && panel.updateSuggestions) schedulePanelUpdate(panel);
        };

        crimeOption.addEventListener('animationstart', onVisualCue, true);
        crimeOption.addEventListener('transitionend', onVisualCue, true);
    }

    function scanCrimePage() {
        if (!runtimeStarted) return;
        if (!isCrackingPage()) {
            cleanupView();
            return;
        }

        const currentCrime = document.querySelector('[class^="currentCrime"]');
        if (!currentCrime) return;

        const container = currentCrime.querySelector('[class^="virtualList"]');
        if (!container) return;

        const crimeOptions = container.querySelectorAll('[class^="crimeOptionWrapper"]');

        for (const crimeOption of crimeOptions) {
            let patText = '';
            let rowKey = getRowKey(crimeOption);
            attachSlotSensors(crimeOption, rowKey);

            const charSlots = crimeOption.querySelectorAll('[class^="charSlot"]:not([class*="charSlotDummy"])');
            const curChars = [];
            for (const charSlot of charSlots) {
                let ch = (charSlot.textContent || '').trim().toUpperCase();
                curChars.push(ch ? ch : '*');
            }
            patText = curChars.join('');

            const now = performance.now();
            const len = curChars.length;
            let prev = prevRowStates.get(rowKey) || { chars: Array(len).fill('*') };

            // Torn's virtual list can recycle the same DOM row for a new crack. If the length
            // changes, or a completed row turns back into a fresh all-hidden row, give it a fresh
            // row key so old exclusions do not poison the next puzzle.
            const lengthChanged = prev.chars && prev.chars.length !== len;
            const prevWasComplete = prev.chars && prev.chars.length === len && prev.chars.every(ch => ch !== '*');
            const nowIsFreshHidden = curChars.length === len && curChars.every(ch => ch === '*');
            if (lengthChanged || (prevWasComplete && nowIsFreshHidden)) {
                rowKey = resetRowTracking(crimeOption);
                prev = { chars: Array(len).fill('*') };
            }

            for (let i = 0; i < len; i++) {
                const was = prev.chars[i];
                const is = curChars[i];
                if (was === '*' && is !== '*') prev.lastInput = { i, letter: is, time: now };
                if (was !== '*' && is === '*') {
                    if (prev.lastInput && prev.lastInput.i === i && prev.lastInput.letter === was && (now - prev.lastInput.time) <= 1800) {
                        addExclusion(rowKey, i, was, len);
                    }
                }
            }

            prevRowStates.set(rowKey, { chars: curChars, lastInput: prev.lastInput, time: now });

            if (!/[*]/.test(patText)) {
                const newWord = patText.toUpperCase();
                if (!/^[A-Z0-9_.]+$/.test(newWord)) {
                    crackLog('Revealed word contains invalid chars. skippin:', newWord);
                } else {
                    (async () => {
                        const localHas = await isWordInLocalDict(newWord);
                        const supHas = remoteWords.has(newWord);
                        if (!localHas && !supHas) {
                            await addWordToLocalCache(newWord);
                            await enqueueOutbox(newWord);
                        } else if (supHas && !localHas) {
                            await addWordToLocalCache(newWord);
                        }
                    })();
                }
            }

            const showOnComplete = getBoolPref(PREF_SHOW_SUG_ON_COMPLETE, true);
            const isComplete = patText && !patText.includes('*');
            if (isComplete && !showOnComplete) {
                const existing = crimeOption.querySelector('.__crackhelp_panel');
                if (existing) {
                    const key = existing.dataset.rowkey;
                    if (panelUpdateTimers.has(key)) {
                        clearTimeout(panelUpdateTimers.get(key));
                        panelUpdateTimers.delete(key);
                    }
                    existing.remove();
                }
            } else {
                if (!/^[*]+$/.test(patText)) prependPanelToRow(crimeOption, patText, rowKey);
            }
        }
    }

    /* --------------------------
       Settings UI
       -------------------------- */
    async function showMenuOverlay() {
        const theme0 = getTheme();

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0;
            width: 100%; height: 100%;
            background: ${theme0.overlayBg};
            color: ${theme0.uiText};
            font-size: 14px;
            padding: 12px;
            box-sizing: border-box;
            overflow: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2147483647;
            overflow: hidden;
            overscroll-behavior: contain;
            touch-action: none;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: ${theme0.boxBg};
            padding: 18px;
            border: 1px solid ${theme0.uiBorder};
            border-radius: 10px;
            text-align: left;
            width: min(520px, 92vw);
            max-width: 520px;
            box-sizing: border-box;
            max-height: calc(100vh - 24px);
            overflow: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-y;
        `;

        const isMobile = isPdaUserAgentCheck();
        if (isMobile) {
            overlay.style.fontSize = '13px';
            overlay.style.padding = '10px';
            overlay.style.alignItems = 'flex-start';

            box.style.padding = '12px';
            box.style.width = '100%';
            box.style.maxWidth = '100%';
            box.style.marginTop = '10px';
            box.style.marginBottom = '10px';
        }

        const title = document.createElement('div');
        title.textContent = 'Settings (BETA)';
        title.style.cssText = `margin-bottom:12px; font-size:20px; color:${theme0.uiText}; text-align:center;`;
        if (isMobile) title.style.fontSize = '18px';
        box.appendChild(title);

        addHr(box, theme0, 2);

        const statusLine = document.createElement('div');
        statusLine.style.cssText = `color:${theme0.uiText}; font-size:12px; margin-bottom:8px; text-align:center;`;
        if (isMobile) statusLine.style.fontSize = '11px';
        statusLine.textContent = ensureStatusBadge().textContent;
        registerStatusSink(statusLine);
        box.appendChild(statusLine);

        const nextSyncDiv = document.createElement('div');
        nextSyncDiv.style.cssText = `color:${theme0.uiText}; font-size:12px; margin-bottom:8px; text-align:center;`;
        if (isMobile) nextSyncDiv.style.fontSize = '11px';
        nextSyncDiv.textContent = 'Calculating next sync time…';
        box.appendChild(nextSyncDiv);

        const wordCountDiv = document.createElement('div');
        wordCountDiv.style.cssText = `color:${theme0.uiText}; font-size:12px; margin-bottom:10px; text-align:center;`;
        if (isMobile) wordCountDiv.style.fontSize = '11px';
        wordCountDiv.style.whiteSpace = "pre-line";
        wordCountDiv.textContent = 'Loading dictionary stats...';
        box.appendChild(wordCountDiv);

        addHr(box, theme0, 1);

        function addRow(labelText, controlEl, parent = box) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px; margin:6px 0; flex-wrap:wrap;';
            const lab = document.createElement('div');
            lab.textContent = labelText;
            lab.style.cssText = 'font-size:12px; opacity:0.95; min-width:0; flex: 1 1 auto;';

            if (isMobile) {
                row.style.flexDirection = 'column';
                row.style.alignItems = 'stretch';
                row.style.gap = '6px';
                row.style.justifyContent = 'flex-start';
                lab.style.textAlign = 'left';
                lab.style.fontSize = '11px';
            }

            row.appendChild(lab);

            if (controlEl) {
                const tag = (controlEl.tagName || '').toLowerCase();
                const type = (controlEl.type || '').toLowerCase();
                const isCheckLike = tag === 'input' && (type === 'checkbox' || type === 'radio');

                if (isMobile && !isCheckLike) {
                    controlEl.style.width = '100%';
                    controlEl.style.maxWidth = '100%';
                    controlEl.style.boxSizing = 'border-box';
                }

                row.appendChild(controlEl);
            }

            parent.appendChild(row);
            return { row, lab, controlEl };
        }

        const themeSel = document.createElement('select');
        themeSel.style.cssText = 'padding:4px 6px; font-size:12px;';
        appplyMenuInputTheme(themeSel);
        themeSel.innerHTML = `<option value="dark">Black (default)</option><option value="light">White</option>`;
        themeSel.value = normalizeThemeName(getStrPref(THEME_PREF_KEY, 'dark'));
        addRow('Theme preset', themeSel);

        const maxSug = document.createElement('input');
        maxSug.type = 'number';
        maxSug.min = '1';
        maxSug.max = String(MAX_MAX_SUGGESTIONS);
        maxSug.step = '1';
        maxSug.value = String(getClampedIntPref(PREF_MAX_SUGGESTIONS, DEFAULT_MAX_SUGGESTIONS, MIN_MAX_SUGGESTIONS, MAX_MAX_SUGGESTIONS));
        maxSug.style.cssText = 'width:90px; padding:4px 6px; font-size:12px;';
        appplyMenuInputTheme(maxSug);
        addRow('Max. Suggestions', maxSug);

        const advColorWrap = document.createElement('div');
        advColorWrap.style.cssText = 'display:flex; flex-direction:column; gap:8px; margin-top:6px;';
        box.appendChild(advColorWrap);

        function setAdvancedColorsVisible(on) {
            advColorWrap.style.display = on ? '' : 'none';
        }

        const boxBg = document.createElement('input');
        boxBg.type = 'text';
        boxBg.value = getStrPref(PREF_UI_BOX_BG_COLOR, getThemePreset().boxBg);
        boxBg.placeholder = '#000';
        boxBg.style.cssText = 'width:140px; padding:4px 6px; font-size:12px;';
        appplyMenuInputTheme(boxBg);
        addRow('Settings Main color', boxBg, advColorWrap);

        const fontSize = document.createElement('input');
        fontSize.type = 'number';
        fontSize.min = '5';
        fontSize.max = '20';
        fontSize.step = '1';
        fontSize.value = String(getIntPref(PREF_SUG_FONT_PX, 10));
        fontSize.style.cssText = 'width:90px; padding:4px 6px; font-size:12px;';
        appplyMenuInputTheme(fontSize);
        addRow('Suggestion font size (px)', fontSize, advColorWrap);

        const sugText = document.createElement('input');
        sugText.type = 'text';
        sugText.value = getStrPref(PREF_SUG_TEXT_COLOR, getThemePreset().sugText);
        sugText.placeholder = '#0f0';
        sugText.style.cssText = 'width:140px; padding:4px 6px; font-size:12px;';
        appplyMenuInputTheme(sugText);
        addRow('Suggestion text color', sugText, advColorWrap);

        const sugBg = document.createElement('input');
        sugBg.type = 'text';
        sugBg.value = getStrPref(PREF_SUG_BG_COLOR, getThemePreset().sugBg);
        sugBg.placeholder = '#000 or transparent';
        sugBg.style.cssText = 'width:140px; padding:4px 6px; font-size:12px;';
        appplyMenuInputTheme(sugBg);
        addRow('Suggestion panel background', sugBg, advColorWrap);

        const uiText = document.createElement('input');
        uiText.type = 'text';
        uiText.value = getStrPref(PREF_UI_TEXT_COLOR, getThemePreset().uiText);
        uiText.placeholder = '#0f0';
        uiText.style.cssText = 'width:140px; padding:4px 6px; font-size:12px;';
        appplyMenuInputTheme(uiText);
        addRow('Overall UI text color', uiText, advColorWrap);

        const uiBg = document.createElement('input');
        uiBg.type = 'text';
        uiBg.value = getStrPref(PREF_UI_BG_COLOR, getThemePreset().uiBg);
        uiBg.placeholder = '#000';
        uiBg.style.cssText = 'width:140px; padding:4px 6px; font-size:12px;';
        appplyMenuInputTheme(uiBg);
        addRow('Overall UI background', uiBg, advColorWrap);

        const uiBorder = document.createElement('input');
        uiBorder.type = 'text';
        uiBorder.value = getStrPref(PREF_UI_BORDER_COLOR, getThemePreset().uiBorder);
        uiBorder.placeholder = '#0f0';
        uiBorder.style.cssText = 'width:140px; padding:4px 6px; font-size:12px;';
        appplyMenuInputTheme(uiBorder);
        addRow('Overall UI border color', uiBorder, advColorWrap);

        const showAdvancedOptRow = document.createElement('label');
        showAdvancedOptRow.style.cssText = 'cursor:pointer; display:flex; align-items:center; gap:8px; font-size:12px; margin:10px 0 6px;';
        const showAdvancedOptChk = document.createElement('input');
        showAdvancedOptChk.type = 'checkbox';
        showAdvancedOptChk.checked = getBoolPref(PREF_SHOW_ADVANCED_OPT_COLOR, true);
        const showAdvancedOptText = document.createElement('span');
        showAdvancedOptText.textContent = 'Show advanced color options';
        showAdvancedOptRow.appendChild(showAdvancedOptChk);
        showAdvancedOptRow.appendChild(showAdvancedOptText);
        if (isMobile) {
            showAdvancedOptRow.style.width = '100%';
            showAdvancedOptRow.style.fontSize = '11px';
        }
        box.appendChild(showAdvancedOptRow);

        setAdvancedColorsVisible(showAdvancedOptChk.checked);
        showAdvancedOptChk.addEventListener('change', () => {
            setBoolPref(PREF_SHOW_ADVANCED_OPT_COLOR, showAdvancedOptChk.checked);
            setAdvancedColorsVisible(showAdvancedOptChk.checked);
        });

        const showCompleteRow = document.createElement('label');
        showCompleteRow.style.cssText = 'cursor:pointer; display:flex; align-items:center; gap:8px; font-size:12px;';
        const showCompleteChk = document.createElement('input');
        showCompleteChk.type = 'checkbox';
        showCompleteChk.checked = getBoolPref(PREF_SHOW_SUG_ON_COMPLETE, true);
        const showCompleteText = document.createElement('span');
        showCompleteText.textContent = 'Show suggestions when crack is complete';
        showCompleteRow.appendChild(showCompleteChk);
        showCompleteRow.appendChild(showCompleteText);
        box.appendChild(showCompleteRow);

        const badgeRow = document.createElement('label');
        badgeRow.style.cssText = 'cursor:pointer; display:flex; align-items:center; gap:8px; font-size:12px; margin-top:8px;';
        const badgeChk = document.createElement('input');
        badgeChk.type = 'checkbox';
        badgeChk.checked = getBoolPref(STATUS_PREF_KEY, true);
        const badgeText = document.createElement('span');
        badgeText.textContent = 'Show status badge';
        badgeRow.appendChild(badgeChk);
        badgeRow.appendChild(badgeText);
        box.appendChild(badgeRow);

        addHr(box, theme0, 1);

        const rigSection = document.createElement('div');
        rigSection.style.cssText = `border:1px solid ${theme0.uiBorder}; border-radius:8px; padding:10px; margin:10px 0; background:${theme0.boxBg};`;
        box.appendChild(rigSection);

        const rigTitle = document.createElement('div');
        rigTitle.textContent = 'Rig planner (wiki-based)';
        rigTitle.style.cssText = 'font-size:15px; text-align:center; margin-bottom:8px; font-weight:bold;';
        rigSection.appendChild(rigTitle);

        const rigNote = document.createElement('div');
        rigNote.textContent = 'Skill 25 unlocks 1 chassis, 50 unlocks 2, 75 unlocks 3. Each visual chassis is 5×5; PSUs occupy two cells.';
        rigNote.style.cssText = 'font-size:11px; text-align:center; opacity:0.9; margin-bottom:8px; line-height:1.35;';
        rigSection.appendChild(rigNote);

        const rigControls = document.createElement('div');
        rigControls.style.cssText = 'display:grid; grid-template-columns:repeat(4, minmax(80px, 1fr)); gap:6px;';
        if (isMobile) rigControls.style.gridTemplateColumns = 'repeat(2, minmax(80px, 1fr))';
        rigSection.appendChild(rigControls);

        function addRigNumberInput(label, key, value, min = 0, max = 999) {
            const wrap = document.createElement('label');
            wrap.style.cssText = 'display:flex; flex-direction:column; gap:3px; font-size:11px;';
            const span = document.createElement('span');
            span.style.cssText = 'display:flex; align-items:center; gap:4px; min-height:20px;';
            if (RIG_COMPONENTS[key]) span.appendChild(makeRigIcon(key, 18));
            const labelText = document.createElement('span');
            labelText.textContent = label;
            span.appendChild(labelText);
            const input = document.createElement('input');
            input.type = 'number';
            input.min = String(min);
            input.max = String(max);
            input.step = '1';
            input.value = String(value);
            input.dataset.rigKey = key;
            input.style.cssText = 'padding:4px 6px; font-size:12px; width:100%; box-sizing:border-box;';
            appplyMenuInputTheme(input);
            wrap.appendChild(span);
            wrap.appendChild(input);
            rigControls.appendChild(wrap);
            return input;
        }

        const rigInv = getRigInventoryFromPrefs();
        const skillInput = addRigNumberInput('Skill level', 'skill', getClampedIntPref(PREF_RIG_SKILL_LEVEL, 25, 0, 100), 0, 100);
        const rigInputs = {
            HPCPU: addRigNumberInput('HPCPU', 'HPCPU', rigInv.HPCPU),
            ECPU: addRigNumberInput('eCPU', 'ECPU', rigInv.ECPU),
            CPU: addRigNumberInput('CPU', 'CPU', rigInv.CPU),
            PSU: addRigNumberInput('PSU', 'PSU', rigInv.PSU),
            FAN: addRigNumberInput('Computer Fan', 'FAN', rigInv.FAN),
            WB: addRigNumberInput('Water Block', 'WB', rigInv.WB),
            HS: addRigNumberInput('Heat Sink', 'HS', rigInv.HS),
        };

        const rigActions = document.createElement('div');
        rigActions.style.cssText = 'display:flex; gap:6px; justify-content:center; flex-wrap:wrap; margin-top:8px;';
        rigSection.appendChild(rigActions);

        const btnRigExample = document.createElement('button');
        btnRigExample.textContent = 'Load example parts';
        btnRigExample.style.cssText = 'padding:5px 8px; cursor:pointer; border-radius:6px; font-size:11px;';
        applyMenuButtonTheme(btnRigExample);
        rigActions.appendChild(btnRigExample);

        const btnRigClear = document.createElement('button');
        btnRigClear.textContent = 'Clear parts';
        btnRigClear.style.cssText = 'padding:5px 8px; cursor:pointer; border-radius:6px; font-size:11px;';
        applyMenuButtonTheme(btnRigClear);
        rigActions.appendChild(btnRigClear);

        const rigOutput = document.createElement('div');
        rigSection.appendChild(rigOutput);

        function readRigInputs() {
            const inv = {};
            for (const key of RIG_COMPONENT_ORDER) {
                if (key === 'PSU') inv[key] = clampInt(rigInputs.PSU.value, 0, 999, 0);
                else if (key === 'ECPU') inv[key] = clampInt(rigInputs.ECPU.value, 0, 999, 0);
                else inv[key] = clampInt(rigInputs[key]?.value, 0, 999, 0);
            }
            return inv;
        }

        function renderRigPlanner() {
            const skill = clampInt(skillInput.value, 0, 100, 25);
            const inv = readRigInputs();
            setIntPref(PREF_RIG_SKILL_LEVEL, skill);
            saveRigInventoryToPrefs(inv);
            rigOutput.innerHTML = '';
            rigOutput.appendChild(makeRigPlanVisual(buildRigPlan(skill, inv), getTheme()));
        }

        skillInput.addEventListener('input', renderRigPlanner);
        for (const input of Object.values(rigInputs)) input.addEventListener('input', renderRigPlanner);

        btnRigExample.onclick = () => {
            skillInput.value = '75';
            rigInputs.HPCPU.value = '8';
            rigInputs.ECPU.value = '24';
            rigInputs.CPU.value = '10';
            rigInputs.PSU.value = '5';
            rigInputs.FAN.value = '18';
            rigInputs.WB.value = '18';
            rigInputs.HS.value = '4';
            renderRigPlanner();
        };
        btnRigClear.onclick = () => {
            for (const input of Object.values(rigInputs)) input.value = '0';
            renderRigPlanner();
        };
        renderRigPlanner();

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex; gap:8px; justify-content:center; margin-top:12px; flex-wrap:wrap;';
        if (isMobile) {
            btnRow.style.flexDirection = 'column';
            btnRow.style.alignItems = 'stretch';
            btnRow.style.justifyContent = 'flex-start';
        }

        const btnReset = document.createElement('button');
        btnReset.textContent = 'Reset to theme preset';
        btnReset.style.cssText = 'padding:6px 10px; cursor:pointer; border-radius:6px; font-size:12px;';
        if (isMobile) btnReset.style.width = '100%';
        applyMenuButtonTheme(btnReset);

        const btnSync = document.createElement('button');
        btnSync.textContent = COMMUNITY_SYNC_ENABLED ? 'Sync Community Words Now' : 'Community Sync Unavailable';
        btnSync.style.cssText = 'padding:6px 10px; cursor:pointer; border-radius:6px; font-size:12px;';
        if (isMobile) btnSync.style.width = '100%';
        applyMenuButtonTheme(btnSync);

        const btnCache = document.createElement('button');
        btnCache.textContent = 'Clear Wordlist Cache';
        btnCache.style.cssText = 'padding:6px 10px; background:#a00; color:#fff; cursor:pointer; border-radius:6px; font-size:12px; border:none;';
        if (isMobile) btnCache.style.width = '100%';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Close';
        cancelBtn.style.cssText = 'padding:6px 10px; cursor:pointer; border-radius:6px; font-size:12px;';
        if (isMobile) cancelBtn.style.width = '100%';
        applyMenuButtonTheme(cancelBtn);

        btnRow.appendChild(btnReset);
        if (COMMUNITY_SYNC_ENABLED) btnRow.appendChild(btnSync);
        btnRow.appendChild(btnCache);
        btnRow.appendChild(cancelBtn);
        box.appendChild(btnRow);

        addHr(box, theme0, 1);

        const pwrdByMsg = document.createElement('div');
        pwrdByMsg.style.cssText = `color:${theme0.uiText}; font-size:12px; text-align:center; opacity:0.95;`;
        pwrdByMsg.textContent = COMMUNITY_SYNC_ENABLED
            ? 'VM public pool + IndexedDB + Visual rig planner - Made with Love ❤ by SirAua [3785905] (and friends)'
            : 'Local IndexedDB mode - set COMMUNITY_POOL_ORIGIN to enable your VM public pool';
        box.appendChild(pwrdByMsg);

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const applyOverlayTheme = () => {
            const t = getTheme();
            overlay.style.background = t.overlayBg;
            overlay.style.color = t.uiText;
            box.style.background = t.boxBg;
            box.style.borderColor = t.uiBorder;
            title.style.color = t.uiText;
            statusLine.style.color = t.uiText;
            nextSyncDiv.style.color = t.uiText;
            wordCountDiv.style.color = t.uiText;
            rigSection.style.background = t.boxBg;
            rigSection.style.borderColor = t.uiBorder;
            rigTitle.style.color = t.uiText;
            rigNote.style.color = t.uiText;
            pwrdByMsg.style.color = t.uiText;
            applyMenuButtonTheme(btnRigExample);
            applyMenuButtonTheme(btnRigClear);
            applyMenuButtonTheme(btnReset);
            if (COMMUNITY_SYNC_ENABLED) applyMenuButtonTheme(btnSync);
            applyMenuButtonTheme(cancelBtn);
            renderRigPlanner();
        };

        const onAnyPrefChange = () => {
            applyThemeEverywhere();
            applyOverlayTheme();
        };

        themeSel.onchange = () => {
            applyPreset(themeSel.value);
            const preset = getThemePreset();
            uiText.value = getStrPref(PREF_UI_TEXT_COLOR, preset.uiText);
            uiBg.value = getStrPref(PREF_UI_BG_COLOR, preset.uiBg);
            uiBorder.value = getStrPref(PREF_UI_BORDER_COLOR, preset.uiBorder);
            sugText.value = getStrPref(PREF_SUG_TEXT_COLOR, preset.sugText);
            sugBg.value = getStrPref(PREF_SUG_BG_COLOR, preset.sugBg);
            boxBg.value = getStrPref(PREF_UI_BOX_BG_COLOR, preset.boxBg);
            onAnyPrefChange();
            location.reload();
        };

        const saveMaxSuggestions = () => {
            const n = clampInt(maxSug.value, MIN_MAX_SUGGESTIONS, MAX_MAX_SUGGESTIONS, DEFAULT_MAX_SUGGESTIONS);
            maxSug.value = String(n);
            setIntPref(PREF_MAX_SUGGESTIONS, n);
            onAnyPrefChange();
        };
        maxSug.onchange = saveMaxSuggestions;
        maxSug.oninput = saveMaxSuggestions;

        boxBg.onchange = () => { setStrPref(PREF_UI_BOX_BG_COLOR, boxBg.value); onAnyPrefChange(); };

        fontSize.onchange = () => { setIntPref(PREF_SUG_FONT_PX, fontSize.value); onAnyPrefChange(); };
        fontSize.oninput = () => { setIntPref(PREF_SUG_FONT_PX, fontSize.value); onAnyPrefChange(); };

        sugText.onchange = () => { setStrPref(PREF_SUG_TEXT_COLOR, sugText.value.trim()); onAnyPrefChange(); };
        sugBg.onchange = () => { setStrPref(PREF_SUG_BG_COLOR, sugBg.value.trim()); onAnyPrefChange(); };

        uiText.onchange = () => { setStrPref(PREF_UI_TEXT_COLOR, uiText.value.trim()); onAnyPrefChange(); };
        uiBg.onchange = () => { setStrPref(PREF_UI_BG_COLOR, uiBg.value.trim()); onAnyPrefChange(); };
        uiBorder.onchange = () => { setStrPref(PREF_UI_BORDER_COLOR, uiBorder.value.trim()); onAnyPrefChange(); };

        showCompleteChk.onchange = () => { setBoolPref(PREF_SHOW_SUG_ON_COMPLETE, showCompleteChk.checked); };
        setAdvancedColorsVisible(showAdvancedOptChk.checked);

        badgeChk.onchange = () => {
            const show = badgeChk.checked;
            setBoolPref(STATUS_PREF_KEY, show);
            ensureStatusBadge().style.display = show ? 'block' : 'none';
        };

        btnReset.onclick = () => {
            applyPreset(themeSel.value);
            const preset = getThemePreset();
            uiText.value = getStrPref(PREF_UI_TEXT_COLOR, preset.uiText);
            uiBg.value = getStrPref(PREF_UI_BG_COLOR, preset.uiBg);
            uiBorder.value = getStrPref(PREF_UI_BORDER_COLOR, preset.uiBorder);
            sugText.value = getStrPref(PREF_SUG_TEXT_COLOR, preset.sugText);
            sugBg.value = getStrPref(PREF_SUG_BG_COLOR, preset.sugBg);
            onAnyPrefChange();
        };

        btnSync.onclick = async () => {
            if (!COMMUNITY_SYNC_ENABLED) {
                setStatus('Community sync unavailable');
                return;
            }
            btnSync.disabled = true;
            const oldText = btnSync.textContent;
            try {
                btnSync.textContent = 'Syncing…';
                await checkRemoteAndMaybeDownload(true);
                await updateNextSync();
                await refreshRemoteStats();
                setStatus('Ready');
            } catch (e) {
                crackLog('Manual sync failed', e);
                setStatus('Sync failed');
            } finally {
                btnSync.disabled = false;
                btnSync.textContent = oldText;
            }
        };

        btnCache.onclick = async () => {
            await clearLocalDictCache();
            location.reload();
        };

        let ticker = null;
        let statsTimer = null;

        cancelBtn.onclick = () => {
            unregisterStatusSink(statusLine);
            if (ticker) clearInterval(ticker);
            if (statsTimer) clearInterval(statsTimer);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };

        let stats = [];
        (async () => {
            for (let len = MIN_LENGTH; len <= MAX_LENGTH; len++) {
                const chunk = await idbGet(`len_${len}`);
                stats.push(`${len}: ${chunk ? chunk.length : 0}`);
            }
            if (COMMUNITY_SYNC_ENABLED) {
                const remoteCount = await idbGet('cf_remote_count');
                const delta = await idbGet('cf_pending_delta');
                wordCountDiv.textContent =
                    splitMiddle(`Stored per length → ${stats.join(' | ')}  |  Remote cracked: ${remoteCount ?? 'n/a'}${delta ? ` ( +${delta} pending )` : ''}`);
            } else {
                wordCountDiv.textContent = splitMiddle(`Stored per length → ${stats.join(' | ')}  |  Community sync: disabled`);
            }
        })();

        const updateNextSync = async () => {
            if (!COMMUNITY_SYNC_ENABLED) {
                nextSyncDiv.textContent = 'Community sync: unavailable (worker returned 404)';
                return;
            }
            const lastSyncTs = Number(await idbGet('cf_last_sync_ts')) || 0;
            const nextAllowed = lastSyncTs + SYNC_MIN_INTERVAL_MS;
            const remaining = nextAllowed - Date.now();
            const eligible = remaining <= 0;
            const delta = Number(await idbGet('cf_pending_delta')) || 0;
            nextSyncDiv.textContent = eligible
                ? `Next sync: now${delta ? ` ( +${delta} pending )` : ''}`
                : `Next sync in ${formatShortDuration(remaining)}${delta ? ` ( +${delta} pending )` : ''}`;
        };

        const refreshRemoteStats = async () => {
            if (COMMUNITY_SYNC_ENABLED) {
                const remoteCount = await idbGet('cf_remote_count');
                const delta = await idbGet('cf_pending_delta');
                wordCountDiv.textContent =
                    splitMiddle(`Stored per length → ${stats.join(' | ')}  |  Remote cracked: ${remoteCount ?? 'n/a'}${delta ? ` ( +${delta} pending )` : ''}`);
            } else {
                wordCountDiv.textContent = splitMiddle(`Stored per length → ${stats.join(' | ')}  |  Community sync: disabled`);
            }
        };

        await updateNextSync();
        ticker = setInterval(updateNextSync, 1000);
        statsTimer = setInterval(refreshRemoteStats, 15000);

        applyOverlayTheme();
    }

    function injectMenuButton() {
        if (!runtimeStarted) return;
        if (!isCrackingPage()) {
            cleanupView();
            return;
        }
        if (document.getElementById('__crack_menu_btn')) return;

        const appHeader = document.querySelector('[class^="appHeaderDelimiter"]');
        if (!appHeader) return;

        const btn = document.createElement('button');
        btn.id = '__crack_menu_btn';
        btn.textContent = 'Bruteforce characters to show suggestions! (Click for settings)';
        btn.style.cssText = 'font-size:10px; text-align:left; z-index:9999; cursor:pointer; padding:4px 6px;';
        applyMenuButtonTheme(btn);
        btn.onclick = showMenuOverlay;
        appHeader.appendChild(btn);
        ensureStatusBadge();
    }

    /* --------------------------
       Runtime control
       -------------------------- */
    function startRuntime() {
        if (runtimeStarted) return;
        runtimeStarted = true;

        ensureStatusBadge();

        try {
            if (sessionStorage.getItem('__crack_base_reload_done') === '1') {
                sessionStorage.removeItem('__crack_base_reload_done');
            }
        } catch {}

        if (localStorage.getItem(THEME_PREF_KEY) === null) applyPreset('dark');
        applyThemeEverywhere();
        setStatus('Initializing…');

        loadDict();
        scanCrimePage();

        if (!scanInterval) scanInterval = setInterval(scanCrimePage, UPDATE_INTERVAL);
        if (!menuInterval) menuInterval = setInterval(injectMenuButton, UPDATE_INTERVAL);

        startAutoSyncHeartbeat();
    }

    function stopRuntime() {
        runtimeStarted = false;
        cleanupView();
    }

    function onRouteChange() {
        if (isCrackingPage()) {
            startRuntime();
        } else {
            stopRuntime();
        }
    }

    /* --------------------------
       Init
       -------------------------- */
    onRouteChange();

    window.addEventListener('hashchange', onRouteChange);
    window.addEventListener('popstate', onRouteChange);

    const pushState = history.pushState;
    const replaceState = history.replaceState;

    history.pushState = function (...args) {
        const ret = pushState.apply(this, args);
        setTimeout(onRouteChange, 0);
        return ret;
    };

    history.replaceState = function (...args) {
        const ret = replaceState.apply(this, args);
        setTimeout(onRouteChange, 0);
        return ret;
    };
})();