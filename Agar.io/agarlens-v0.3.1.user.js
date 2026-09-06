// ==UserScript==
// @name         AgarLens — Analytics, Records & Mini-map
// @namespace    https://github.com/MoDuLah
// @version      0.3.1
// @description  Read-only Agar.io analytics HUD with native stats, records, history, connection diagnostics and a trail mini-map.
// @author       MoDuL
// @match        *://agar.io/*
// @match        *://www.agar.io/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '0.3.1';
  const UI_KEY = 'agarlens:v0.3:ui';
  const HISTORY_KEY = 'agarlens:v0.3:history';
  const MAX_HISTORY = 100;
  const TRAIL_MS = 20_000;
  const TRAIL_SAMPLE_MS = 220;
  const DEFAULT_MAP_HALF = 7071;
  const WRAPPED = Symbol('agarlensWrapped');

  const DISCONNECT_REASONS = {
    1: 'Incompatible client',
    2: 'Packet not authorized',
    3: 'Logged in elsewhere',
    4: 'Server going offline',
    5: 'User banned',
    6: 'Ping error',
    7: 'Unknown game type',
    8: 'Too many operations',
    9: 'Unreachable realm',
    10: 'User deleted',
    11: 'Not authorized by realm',
    12: 'Bad request',
    13: 'Reset by peer',
    14: 'Invalid token',
    15: 'Expired token',
    16: 'State transfer error'
  };

  const state = {
    // Match lifecycle
    matchSerial: 0,
    playing: false,
    finalized: false,
    startedAt: 0,
    elapsedMs: 0,
    mode: null,

    // Native match stats
    foodEaten: 0,
    peakMass: 0,
    timeAlive: 0,
    virusesEaten: 0,
    cellsEaten: 0,
    topPosition: 0,
    leaderboardTime: 0,
    baselineMass: null,
    baselineMassTime: null,
    peakReachedAt: 0,
    milestones: {},

    // Performance
    fps: 0,
    frames: 0,
    fpsWindow: performance.now(),
    avgFrameRate: null,
    avgMessageInterval: null,
    varianceMessageInterval: null,

    // Position / movement
    coordLocked: false,
    x: null,
    y: null,
    speed: null,
    speedEma: null,
    maxSpeed: 0,
    distanceTravelled: 0,
    furthestFromCentre: 0,
    lastPosSample: null,
    heading: '—',
    spawnCoord: null,
    peakCoord: null,
    deathCoord: null,
    trail: [],
    lastTrailSample: 0,
    mapHalf: DEFAULT_MAP_HALF,

    // Connection
    server: null,
    region: null,
    socketConnected: false,
    socketConnectedAt: 0,
    reconnects: 0,
    socketOpensThisMatch: 0,
    lastDisconnectCode: null,
    lastDisconnectReason: null,
    connectionLog: [],

    // UI/hooks
    panel: null,
    mapPanel: null,
    mapCanvas: null,
    activeTab: 'live',
    lastUiTick: 0,
    translateObserverInstalled: false,
    mcHooked: false,
    webSocketHookInstalled: false
  };

  // ---------- Utilities ----------

  function fmtDuration(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  }

  function fmtNumber(v, digits = 0) {
    if (!Number.isFinite(Number(v))) return '—';
    return Number(v).toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function fmtCompact(v) {
    if (!Number.isFinite(Number(v))) return '—';
    const n = Number(v);
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`;
    if (abs >= 10_000) return `${(n / 1000).toFixed(1)}k`;
    if (abs >= 1000) return `${(n / 1000).toFixed(2)}k`;
    return Math.round(n).toLocaleString();
  }

  function fmtSigned(v) {
    if (!Number.isFinite(Number(v))) return '—';
    const n = Math.round(Number(v));
    return `${n > 0 ? '+' : ''}${n.toLocaleString()}`;
  }

  function cleanMode(value) {
    if (typeof value !== 'string') return null;
    return value.replace(/^:/, '').toUpperCase();
  }

  function getElapsed() {
    if (state.timeAlive > 0) return state.timeAlive;
    if (state.playing && state.startedAt) return performance.now() - state.startedAt;
    return state.elapsedMs;
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function loadUi() {
    return safeParse(localStorage.getItem(UI_KEY) || '{}', {});
  }

  function saveUi() {
    const ui = loadUi();

    if (state.panel) {
      const r = state.panel.getBoundingClientRect();
      ui.hud = {
        left: r.left,
        top: r.top,
        collapsed: state.panel.classList.contains('agarlens-collapsed')
      };
    }

    if (state.mapPanel) {
      const r = state.mapPanel.getBoundingClientRect();
      ui.map = {
        left: r.left,
        top: r.top,
        collapsed: state.mapPanel.classList.contains('agarlens-map-collapsed')
      };
    }

    ui.activeTab = state.activeTab;
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  }

  function loadHistory() {
    const parsed = safeParse(localStorage.getItem(HISTORY_KEY) || '[]', []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  }

  function averageGroupSpeed() {
    const seconds = getElapsed() / 1000;
    if (seconds <= 0) return null;
    return state.distanceTravelled / seconds;
  }

  function peakPace() {
    if (
      state.baselineMass == null ||
      state.baselineMassTime == null ||
      !state.peakReachedAt ||
      state.peakReachedAt <= state.baselineMassTime
    ) return null;

    const gain = state.peakMass - state.baselineMass;
    const seconds = (state.peakReachedAt - state.baselineMassTime) / 1000;
    if (seconds <= 0 || gain < 0) return null;
    return gain / seconds;
  }

  function perMinute(value) {
    const elapsed = getElapsed();
    if (elapsed < 1000) return null;
    return Number(value || 0) / (elapsed / 60_000);
  }

  function leaderboardShare() {
    if (!state.timeAlive || !state.leaderboardTime) return 0;
    return Math.max(0, Math.min(100, (state.leaderboardTime / state.timeAlive) * 100));
  }

  function headingFromDelta(dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 0.1) return '—';
    // Positive Y is displayed as north/up on the minimap.
    const deg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    if (deg >= 337.5 || deg < 22.5) return 'E';
    if (deg < 67.5) return 'NE';
    if (deg < 112.5) return 'N';
    if (deg < 157.5) return 'NW';
    if (deg < 202.5) return 'W';
    if (deg < 247.5) return 'SW';
    if (deg < 292.5) return 'S';
    return 'SE';
  }

  function setText(selector, value) {
    const el = state.panel?.querySelector(selector);
    if (el) el.textContent = value;
  }

  function setMapText(selector, value) {
    const el = state.mapPanel?.querySelector(selector);
    if (el) el.textContent = value;
  }

  // ---------- Match state ----------

  function resetMatchState() {
    state.finalized = false;
    state.foodEaten = 0;
    state.peakMass = 0;
    state.timeAlive = 0;
    state.virusesEaten = 0;
    state.cellsEaten = 0;
    state.topPosition = 0;
    state.leaderboardTime = 0;
    state.baselineMass = null;
    state.baselineMassTime = null;
    state.peakReachedAt = 0;
    state.milestones = {};

    state.avgFrameRate = null;
    state.avgMessageInterval = null;
    state.varianceMessageInterval = null;

    state.coordLocked = false;
    state.x = null;
    state.y = null;
    state.speed = null;
    state.speedEma = null;
    state.maxSpeed = 0;
    state.distanceTravelled = 0;
    state.furthestFromCentre = 0;
    state.lastPosSample = null;
    state.heading = '—';
    state.spawnCoord = null;
    state.peakCoord = null;
    state.deathCoord = null;
    state.trail = [];
    state.lastTrailSample = 0;
    state.mapHalf = DEFAULT_MAP_HALF;

    state.reconnects = 0;
    state.socketOpensThisMatch = 0;
    state.lastDisconnectCode = null;
    state.lastDisconnectReason = null;
    state.connectionLog = [];
  }

  function markMilestone(key, timeMs) {
    if (state.milestones[key] == null && Number(timeMs) >= 0) {
      state.milestones[key] = Number(timeMs);
    }
  }

  function capturePosition() {
    if (!state.coordLocked || !Number.isFinite(state.x) || !Number.isFinite(state.y)) return null;
    return { x: Math.round(state.x), y: Math.round(state.y) };
  }

  function startMatch(reason = 'spawn') {
    state.matchSerial += 1;
    resetMatchState();
    state.playing = true;
    state.startedAt = performance.now();
    state.elapsedMs = 0;
    installTranslateObserver();

    if (state.socketConnected) {
      state.socketOpensThisMatch = 1;
      state.socketConnectedAt = state.socketConnectedAt || performance.now();
    }

    console.info(`[AgarLens ${VERSION}] Match #${state.matchSerial} started (${reason}).`);
    renderAll();
  }

  function buildMatchRecord() {
    const pace = peakPace();
    const avgSpeed = averageGroupSpeed();

    return {
      id: `${Date.now()}-${state.matchSerial}`,
      endedAt: new Date().toISOString(),
      mode: state.mode || null,
      survivalMs: Number(state.timeAlive || state.elapsedMs || 0),
      peakMass: Number(state.peakMass || 0),
      peakReachedAt: Number(state.peakReachedAt || 0),
      peakPace: Number.isFinite(pace) ? pace : null,
      foodEaten: Number(state.foodEaten || 0),
      cellsEaten: Number(state.cellsEaten || 0),
      virusesEaten: Number(state.virusesEaten || 0),
      bestPosition: Number(state.topPosition || 0) || null,
      leaderboardTime: Number(state.leaderboardTime || 0),
      leaderboardShare: leaderboardShare(),
      distanceTravelled: Number(state.distanceTravelled || 0),
      averageGroupSpeed: Number.isFinite(avgSpeed) ? avgSpeed : null,
      maxGroupSpeed: Number(state.maxSpeed || 0),
      furthestFromCentre: Number(state.furthestFromCentre || 0),
      spawnCoord: state.spawnCoord,
      peakCoord: state.peakCoord,
      deathCoord: state.deathCoord || capturePosition(),
      avgFps: state.avgFrameRate,
      serverUpdateMs: state.avgMessageInterval,
      updateVarianceMs: state.varianceMessageInterval,
      region: state.region,
      server: state.server,
      reconnects: state.reconnects,
      lastDisconnectCode: state.lastDisconnectCode,
      lastDisconnectReason: state.lastDisconnectReason,
      milestones: { ...state.milestones },
      version: VERSION
    };
  }

  function saveCurrentMatch() {
    if (state.finalized) return;
    state.finalized = true;

    const record = buildMatchRecord();
    const history = loadHistory();
    history.unshift(record);
    saveHistory(history);

    showNewRecordToast(record, history.slice(1));
    renderRecords();
    renderHistory();
  }

  function endMatch() {
    if (!state.playing && state.finalized) return;
    state.deathCoord = state.deathCoord || capturePosition();
    state.playing = false;
    state.elapsedMs = state.timeAlive || (state.startedAt ? performance.now() - state.startedAt : state.elapsedMs);
    saveCurrentMatch();
    renderAll();
  }

  // ---------- Native Agar hooks ----------

  function onNativeStats(foodEaten, highestMass, timeAlive, virusesEaten, cellsEaten, topPosition) {
    const t = Number(timeAlive) || 0;
    const mass = Number(highestMass) || 0;
    const previousCells = state.cellsEaten;

    state.foodEaten = Number(foodEaten) || 0;
    state.timeAlive = t;
    state.virusesEaten = Number(virusesEaten) || 0;
    state.cellsEaten = Number(cellsEaten) || 0;

    if (state.baselineMass == null && mass > 0) {
      state.baselineMass = mass;
      state.baselineMassTime = t;
    }

    if (mass > state.peakMass) {
      state.peakMass = mass;
      state.peakReachedAt = t;
      state.peakCoord = capturePosition();
    }

    for (const threshold of [100, 250, 500, 1000, 5000, 10000]) {
      if (mass >= threshold) markMilestone(`mass_${threshold}`, t);
    }

    if (state.cellsEaten > 0 && previousCells === 0) markMilestone('first_cell', t);
    if (state.virusesEaten > 0) markMilestone('first_virus', t);

    const rank = Number(topPosition) || 0;
    if (rank > 0 && (state.topPosition <= 0 || rank < state.topPosition)) {
      state.topPosition = rank;
    }

    if (rank > 0 && rank <= 10) markMilestone('top_10', t);
    if (rank > 0 && rank <= 5) markMilestone('top_5', t);
    if (rank === 1) markMilestone('top_1', t);

    renderAll();
  }

  function hookMC() {
    const MC = window.MC;
    if (!MC || typeof MC !== 'object') return false;

    function wrap(name, before) {
      const current = MC[name];
      if (typeof current !== 'function' || current[WRAPPED]) return;

      const wrapped = function (...args) {
        try { before?.(...args); }
        catch (err) { console.warn(`[AgarLens ${VERSION}] ${name} observer error`, err); }
        return current.apply(this, args);
      };

      Object.defineProperty(wrapped, WRAPPED, { value: true });
      MC[name] = wrapped;
    }

    wrap('onPlayerSpawn', () => {
      startMatch('native-spawn');
    });

    wrap('onPlayerStatsUpdate', (...args) => {
      onNativeStats(...args);
    });

    wrap('onPlayerDeath', (
      foodEaten,
      highestMass,
      timeAlive,
      leaderboardTime,
      cellsEaten,
      topPosition,
      avgFrameRate,
      avgMessageInterval,
      varianceMessageInterval
    ) => {
      state.foodEaten = Number(foodEaten) || state.foodEaten;
      state.timeAlive = Number(timeAlive) || state.timeAlive;
      state.leaderboardTime = Number(leaderboardTime) || 0;
      state.cellsEaten = Number(cellsEaten) || state.cellsEaten;

      const peak = Number(highestMass) || 0;
      if (peak > state.peakMass) {
        state.peakMass = peak;
        state.peakReachedAt = state.timeAlive;
        state.peakCoord = capturePosition();
      }

      const rank = Number(topPosition) || 0;
      if (rank > 0 && (state.topPosition <= 0 || rank < state.topPosition)) state.topPosition = rank;

      state.avgFrameRate = Number.isFinite(Number(avgFrameRate)) ? Number(avgFrameRate) : null;
      state.avgMessageInterval = Number.isFinite(Number(avgMessageInterval)) ? Number(avgMessageInterval) : null;
      state.varianceMessageInterval = Number.isFinite(Number(varianceMessageInterval)) ? Number(varianceMessageInterval) : null;

      endMatch();
    });

    wrap('onDisconnectByReason', (reasonCode) => {
      const code = Number(reasonCode);
      state.lastDisconnectCode = Number.isFinite(code) ? code : null;
      state.lastDisconnectReason = DISCONNECT_REASONS[code] || `Unknown reason (${reasonCode})`;
      logConnection('disconnect-reason', state.lastDisconnectReason, code);
      renderAll();
    });

    state.mcHooked = true;
    return true;
  }

  // ---------- WebSocket diagnostics ----------

  function isLikelyArenaSocket(url) {
    try {
      const u = new URL(String(url), location.href);
      return /agar\.io$/i.test(u.hostname) || /\.agar\.io$/i.test(u.hostname);
    } catch {
      return false;
    }
  }

  function serverLabelFromUrl(url) {
    try {
      const u = new URL(String(url), location.href);
      return u.hostname || String(url);
    } catch {
      return String(url || '—');
    }
  }

  function logConnection(type, message, code = null) {
    state.connectionLog.unshift({
      at: new Date().toISOString(),
      type,
      message,
      code,
      server: state.server
    });
    state.connectionLog = state.connectionLog.slice(0, 20);
  }

  function observeSocket(ws, url) {
    if (!isLikelyArenaSocket(url)) return;

    const server = serverLabelFromUrl(url);

    ws.addEventListener('open', () => {
      const changedServer = state.server && state.server !== server;
      state.server = server;
      state.socketConnected = true;
      state.socketConnectedAt = performance.now();

      if (state.playing) {
        state.socketOpensThisMatch += 1;
        if (state.socketOpensThisMatch > 1) state.reconnects += 1;
      }

      logConnection('open', changedServer ? `Connected to ${server} (server changed)` : `Connected to ${server}`);
      renderAll();
    }, { passive: true });

    ws.addEventListener('close', (event) => {
      state.socketConnected = false;
      const detail = `Socket closed${event.code ? ` (${event.code})` : ''}${event.reason ? `: ${event.reason}` : ''}`;
      logConnection('close', detail, event.code || null);
      renderAll();
    }, { passive: true });

    ws.addEventListener('error', () => {
      logConnection('error', 'WebSocket error');
      renderAll();
    }, { passive: true });
  }

  function installWebSocketObserver() {
    if (state.webSocketHookInstalled) return true;
    const NativeWebSocket = window.WebSocket;
    if (typeof NativeWebSocket !== 'function' || NativeWebSocket[WRAPPED]) return false;

    try {
      const ProxyWebSocket = new Proxy(NativeWebSocket, {
        construct(target, args, newTarget) {
          const ws = Reflect.construct(target, args, newTarget);
          try { observeSocket(ws, args[0]); } catch (err) {
            console.warn(`[AgarLens ${VERSION}] WebSocket observer error`, err);
          }
          return ws;
        }
      });

      Object.defineProperty(ProxyWebSocket, WRAPPED, { value: true });
      window.WebSocket = ProxyWebSocket;
      state.webSocketHookInstalled = true;
      return true;
    } catch (err) {
      console.warn(`[AgarLens ${VERSION}] Could not install WebSocket observer`, err);
      return false;
    }
  }

  // ---------- Camera / movement observer ----------

  function updatePosition(rawX, rawY, now) {
    if (!state.playing || !Number.isFinite(rawX) || !Number.isFinite(rawY)) return;
    if (Math.abs(rawX) > 50_000 || Math.abs(rawY) > 50_000) return;

    /*
     * Agar's camera transform is in absolute world coordinates, approximately
     * 0..14142 on each axis for normal FFA. AgarLens presents coordinates
     * relative to the centre, so 7071,7071 becomes 0,0.
     *
     * With positive Y shown upward on the mini-map:
     *   raw 8445,4408 -> +1374,-2663, i.e. bottom-right.
     */
    const x = rawX - DEFAULT_MAP_HALF;
    const y = rawY - DEFAULT_MAP_HALF;

    state.rawX = rawX;
    state.rawY = rawY;
    state.coordLocked = true;
    state.x = x;
    state.y = y;

    if (!state.spawnCoord) state.spawnCoord = { x: Math.round(x), y: Math.round(y) };

    const centreDistance = Math.hypot(x, y);
    state.furthestFromCentre = Math.max(state.furthestFromCentre, centreDistance);

    // Normal FFA uses the fixed 7071 half-size. Only expand for an actual larger map/mode.
    const outsideNormalMap = Math.abs(x) > DEFAULT_MAP_HALF * 1.03 || Math.abs(y) > DEFAULT_MAP_HALF * 1.03;
    state.mapHalf = outsideNormalMap
      ? Math.max(DEFAULT_MAP_HALF, Math.abs(x) * 1.02, Math.abs(y) * 1.02)
      : DEFAULT_MAP_HALF;

    const previous = state.lastPosSample;
    if (previous) {
      const dt = (now - previous.t) / 1000;
      if (dt >= 0.04 && dt <= 1.0) {
        const dx = x - previous.x;
        const dy = y - previous.y;
        const dist = Math.hypot(dx, dy);
        const rawSpeed = dist / dt;

        // Reject camera resets/spawn jumps, preserve normal camera/group movement.
        if (Number.isFinite(rawSpeed) && rawSpeed < 5000) {
          state.distanceTravelled += dist;
          state.speedEma = state.speedEma == null ? rawSpeed : (state.speedEma * 0.72 + rawSpeed * 0.28);
          state.speed = state.speedEma;
          state.maxSpeed = Math.max(state.maxSpeed, state.speedEma || 0);
          state.heading = headingFromDelta(dx, dy);
        }
      }
    }

    state.lastPosSample = { x, y, t: now };

    if (now - state.lastTrailSample >= TRAIL_SAMPLE_MS) {
      state.lastTrailSample = now;
      state.trail.push({ x, y, t: now });
      const cutoff = now - TRAIL_MS;
      while (state.trail.length && state.trail[0].t < cutoff) state.trail.shift();
    }
  }

  function installTranslateObserver() {
    if (state.translateObserverInstalled) return true;
    const canvas = document.getElementById('canvas');
    if (!canvas) return false;

    const ctx = canvas.getContext?.('2d');
    if (!ctx || typeof ctx.translate !== 'function' || typeof ctx.getTransform !== 'function') return false;

    const originalTranslate = ctx.translate;
    if (originalTranslate[WRAPPED]) {
      state.translateObserverInstalled = true;
      return true;
    }

    const wrappedTranslate = function (tx, ty) {
      if (state.playing) {
        try {
          const m = ctx.getTransform();
          const scaleX = Math.hypot(m.a, m.b);
          const scaleY = Math.hypot(m.c, m.d);
          const uniformScale = (
            scaleX > 0.02 && scaleX < 20 &&
            Math.abs(scaleX - scaleY) <= Math.max(0.002, scaleX * 0.03)
          );

          const centers = [
            [canvas.width / 2, canvas.height / 2],
            [canvas.clientWidth / 2, canvas.clientHeight / 2]
          ];

          const centered = centers.some(([cx, cy]) => {
            const tolerance = Math.max(6, Math.min(canvas.width, canvas.height) * 0.015);
            return Math.abs(m.e - cx) <= tolerance && Math.abs(m.f - cy) <= tolerance;
          });

          if (
            uniformScale && centered &&
            Number.isFinite(Number(tx)) && Number.isFinite(Number(ty)) &&
            Math.abs(Number(tx)) <= 50_000 && Math.abs(Number(ty)) <= 50_000
          ) {
            updatePosition(-Number(tx), -Number(ty), performance.now());
          }
        } catch {
          // Read-only observer: fail open and never block the game's draw call.
        }
      }

      return Reflect.apply(originalTranslate, this, arguments);
    };

    Object.defineProperty(wrappedTranslate, WRAPPED, { value: true });

    try {
      ctx.translate = wrappedTranslate;
      state.translateObserverInstalled = true;
      return true;
    } catch (err) {
      console.warn(`[AgarLens ${VERSION}] Could not install coordinate observer`, err);
      return false;
    }
  }

  // ---------- Main HUD ----------

  function buildHud() {
    if (state.panel || !document.documentElement) return;

    const style = document.createElement('style');
    style.id = 'agarlens-styles';
    style.textContent = `
      #agarlens-panel, #agarlens-map-panel {
        position: fixed;
        z-index: 2147483646;
        color: #f5f7fb;
        background: rgba(10,13,18,.92);
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(0,0,0,.35);
        font: 12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        user-select: none;
        backdrop-filter: blur(6px);
      }
      #agarlens-panel * , #agarlens-map-panel * { box-sizing: border-box; }

      #agarlens-panel { top: 14px; left: 14px; width: 292px; }
      .agarlens-head {
        display:flex; align-items:center; gap:8px;
        padding:8px 9px; cursor:move;
        border-bottom:1px solid rgba(255,255,255,.10);
      }
      .agarlens-title { font-weight:750; white-space:nowrap; }
      #agarlens-compact {
        display:none; flex:1; min-width:0; font-size:11px;
        color:rgba(245,247,251,.78); font-variant-numeric:tabular-nums;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .agarlens-badge {
        margin-left:auto; font-size:10px; padding:2px 6px; border-radius:999px;
        background:rgba(255,255,255,.10); white-space:nowrap;
      }
      #agarlens-panel.agarlens-live .agarlens-badge { background:rgba(72,199,116,.22); }
      .agarlens-icon-btn {
        border:0; background:transparent; color:inherit; cursor:pointer;
        padding:0 2px; font-size:15px;
      }
      #agarlens-body { padding:0 9px 9px; }
      #agarlens-tabs { display:flex; gap:4px; padding:8px 0 7px; }
      .agarlens-tab {
        flex:1; border:1px solid rgba(255,255,255,.10); border-radius:7px;
        background:rgba(255,255,255,.04); color:rgba(245,247,251,.70);
        padding:5px 4px; cursor:pointer; font:inherit; font-size:10px;
      }
      .agarlens-tab.agarlens-active { background:rgba(255,255,255,.12); color:#fff; }
      .agarlens-pane { display:none; }
      .agarlens-pane.agarlens-active { display:block; }
      .agarlens-section + .agarlens-section {
        margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,.09);
      }
      .agarlens-section-title {
        margin-bottom:5px; color:rgba(245,247,251,.42);
        font-size:9px; font-weight:700; letter-spacing:.9px;
      }
      .agarlens-grid { display:grid; grid-template-columns:1fr auto; gap:5px 12px; }
      .agarlens-label { color:rgba(245,247,251,.64); }
      .agarlens-value { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .agarlens-note {
        margin-top:8px; padding-top:7px; border-top:1px solid rgba(255,255,255,.08);
        color:rgba(245,247,251,.42); font-size:10px;
      }
      .agarlens-actions { display:flex; gap:6px; margin-top:8px; }
      .agarlens-action {
        flex:1; border:1px solid rgba(255,255,255,.12); border-radius:7px;
        background:rgba(255,255,255,.06); color:#f5f7fb; cursor:pointer;
        padding:6px; font:inherit; font-size:10px;
      }
      .agarlens-record-row, .agarlens-history-row {
        padding:6px 0; border-bottom:1px solid rgba(255,255,255,.07);
      }
      .agarlens-record-row:last-child, .agarlens-history-row:last-child { border-bottom:0; }
      .agarlens-record-top { display:flex; justify-content:space-between; gap:10px; }
      .agarlens-record-name { color:rgba(245,247,251,.66); }
      .agarlens-record-value { font-variant-numeric:tabular-nums; font-weight:700; }
      .agarlens-sub { margin-top:2px; color:rgba(245,247,251,.42); font-size:10px; }
      #agarlens-toast {
        display:none; margin:8px 0 0; padding:7px 8px; border-radius:7px;
        background:rgba(255,255,255,.10); font-size:11px;
      }
      #agarlens-toast.agarlens-show { display:block; }

      #agarlens-panel.agarlens-collapsed {
        width:auto; min-width:300px; max-width:min(540px, calc(100vw - 20px));
      }
      #agarlens-panel.agarlens-collapsed .agarlens-head { border-bottom:0; padding:7px 9px; }
      #agarlens-panel.agarlens-collapsed #agarlens-body { display:none; }
      #agarlens-panel.agarlens-collapsed #agarlens-compact { display:block; }

      #agarlens-map-panel { top:14px; right:14px; width:172px; }
      #agarlens-map-panel .agarlens-head { padding:6px 7px; }
      #agarlens-map-body { padding:7px; }
      #agarlens-map-canvas {
        display:block; width:156px; height:156px; border-radius:7px;
        background:rgba(255,255,255,.025);
      }
      #agarlens-map-footer {
        display:flex; justify-content:space-between; gap:6px; margin-top:5px;
        color:rgba(245,247,251,.58); font-size:10px; font-variant-numeric:tabular-nums;
      }
      #agarlens-map-panel.agarlens-map-collapsed { width:auto; min-width:188px; }
      #agarlens-map-panel.agarlens-map-collapsed .agarlens-head { border-bottom:0; }
      #agarlens-map-panel.agarlens-map-collapsed #agarlens-map-body { display:none; }
    `;
    document.documentElement.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'agarlens-panel';
    panel.innerHTML = `
      <div class="agarlens-head" id="agarlens-head">
        <div class="agarlens-title">🔬 AgarLens</div>
        <div id="agarlens-compact">— · 0:00 · — FPS</div>
        <div class="agarlens-badge" id="agarlens-badge">IDLE</div>
        <button class="agarlens-icon-btn" id="agarlens-collapse" type="button" title="Collapse">−</button>
      </div>
      <div id="agarlens-body">
        <div id="agarlens-tabs">
          <button class="agarlens-tab agarlens-active" data-tab="live" type="button">LIVE</button>
          <button class="agarlens-tab" data-tab="records" type="button">RECORDS</button>
          <button class="agarlens-tab" data-tab="history" type="button">HISTORY</button>
        </div>

        <div class="agarlens-pane agarlens-active" data-pane="live">
          <div class="agarlens-section">
            <div class="agarlens-section-title">SESSION</div>
            <div class="agarlens-grid">
              <div class="agarlens-label">Match</div><div class="agarlens-value" data-v="time">0:00</div>
              <div class="agarlens-label">Mode</div><div class="agarlens-value" data-v="mode">—</div>
              <div class="agarlens-label">Best position</div><div class="agarlens-value" data-v="rank">—</div>
              <div class="agarlens-label">Leaderboard</div><div class="agarlens-value" data-v="leaderboard">—</div>
              <div class="agarlens-label">Leaderboard share</div><div class="agarlens-value" data-v="leader-share">—</div>
            </div>
          </div>

          <div class="agarlens-section">
            <div class="agarlens-section-title">GROWTH</div>
            <div class="agarlens-grid">
              <div class="agarlens-label">Peak mass</div><div class="agarlens-value" data-v="peak">—</div>
              <div class="agarlens-label">Peak reached</div><div class="agarlens-value" data-v="peak-time">—</div>
              <div class="agarlens-label">Peak pace</div><div class="agarlens-value" data-v="pace">—</div>
              <div class="agarlens-label">Peak pace / min</div><div class="agarlens-value" data-v="pace-min">—</div>
            </div>
          </div>

          <div class="agarlens-section">
            <div class="agarlens-section-title">MOVEMENT</div>
            <div class="agarlens-grid">
              <div class="agarlens-label">Coordinates</div><div class="agarlens-value" data-v="coords">Detecting…</div>
              <div class="agarlens-label">Group speed</div><div class="agarlens-value" data-v="speed">—</div>
              <div class="agarlens-label">Average speed</div><div class="agarlens-value" data-v="avg-speed">—</div>
              <div class="agarlens-label">Max speed</div><div class="agarlens-value" data-v="max-speed">—</div>
              <div class="agarlens-label">Heading</div><div class="agarlens-value" data-v="heading">—</div>
              <div class="agarlens-label">From centre</div><div class="agarlens-value" data-v="centre">—</div>
              <div class="agarlens-label">Distance travelled</div><div class="agarlens-value" data-v="distance">—</div>
            </div>
          </div>

          <div class="agarlens-section">
            <div class="agarlens-section-title">ACTIVITY</div>
            <div class="agarlens-grid">
              <div class="agarlens-label">Food eaten</div><div class="agarlens-value" data-v="food">—</div>
              <div class="agarlens-label">Food / min</div><div class="agarlens-value" data-v="food-rate">—</div>
              <div class="agarlens-label">Cells eaten</div><div class="agarlens-value" data-v="cells">—</div>
              <div class="agarlens-label">Cells / min</div><div class="agarlens-value" data-v="cell-rate">—</div>
              <div class="agarlens-label">Viruses eaten</div><div class="agarlens-value" data-v="viruses">—</div>
            </div>
          </div>

          <div class="agarlens-section">
            <div class="agarlens-section-title">CONNECTION</div>
            <div class="agarlens-grid">
              <div class="agarlens-label">Server</div><div class="agarlens-value" data-v="server">—</div>
              <div class="agarlens-label">Connected</div><div class="agarlens-value" data-v="conn-uptime">—</div>
              <div class="agarlens-label">Reconnects</div><div class="agarlens-value" data-v="reconnects">0</div>
              <div class="agarlens-label">Last disconnect</div><div class="agarlens-value" data-v="disconnect">—</div>
            </div>
          </div>

          <div class="agarlens-section">
            <div class="agarlens-section-title">PERFORMANCE</div>
            <div class="agarlens-grid">
              <div class="agarlens-label">FPS</div><div class="agarlens-value" data-v="fps">—</div>
              <div class="agarlens-label">Avg FPS</div><div class="agarlens-value" data-v="avg-fps">—</div>
              <div class="agarlens-label">Server updates</div><div class="agarlens-value" data-v="updates">—</div>
              <div class="agarlens-label">Update variance</div><div class="agarlens-value" data-v="variance">—</div>
            </div>
          </div>

          <div class="agarlens-section">
            <div class="agarlens-section-title">MILESTONES</div>
            <div class="agarlens-grid" id="agarlens-milestones"></div>
          </div>

          <div id="agarlens-toast"></div>
        </div>

        <div class="agarlens-pane" data-pane="records">
          <div id="agarlens-records"></div>
        </div>

        <div class="agarlens-pane" data-pane="history">
          <div id="agarlens-history"></div>
          <div class="agarlens-actions">
            <button class="agarlens-action" id="agarlens-export" type="button">Export JSON</button>
            <button class="agarlens-action" id="agarlens-clear" type="button">Clear history</button>
          </div>
        </div>

        <div class="agarlens-note">v${VERSION} · read-only analytics · movement/minimap use centred camera tracking</div>
      </div>
    `;
    document.documentElement.appendChild(panel);
    state.panel = panel;

    buildMiniMap();
    restoreUi();
    bindHudEvents();
    renderRecords();
    renderHistory();
    renderAll();
  }

  function buildMiniMap() {
    if (state.mapPanel) return;

    const map = document.createElement('div');
    map.id = 'agarlens-map-panel';
    map.innerHTML = `
      <div class="agarlens-head" id="agarlens-map-head">
        <div class="agarlens-title">🗺 Mini-map</div>
        <div class="agarlens-badge" id="agarlens-map-status">IDLE</div>
        <button class="agarlens-icon-btn" id="agarlens-map-collapse" type="button" title="Collapse">−</button>
      </div>
      <div id="agarlens-map-body">
        <canvas id="agarlens-map-canvas" width="312" height="312"></canvas>
        <div id="agarlens-map-footer">
          <span data-map-v="coords">0, 0</span>
          <span data-map-v="speed">— u/s</span>
        </div>
      </div>
    `;

    document.documentElement.appendChild(map);
    state.mapPanel = map;
    state.mapCanvas = map.querySelector('#agarlens-map-canvas');
  }

  function restoreUi() {
    const ui = loadUi();

    if (ui.hud && state.panel) {
      if (Number.isFinite(ui.hud.left)) state.panel.style.left = `${Math.max(0, ui.hud.left)}px`;
      if (Number.isFinite(ui.hud.top)) state.panel.style.top = `${Math.max(0, ui.hud.top)}px`;
      if (ui.hud.collapsed) {
        state.panel.classList.add('agarlens-collapsed');
        state.panel.querySelector('#agarlens-collapse').textContent = '+';
      }
    }

    if (ui.map && state.mapPanel) {
      state.mapPanel.style.right = 'auto';
      if (Number.isFinite(ui.map.left)) state.mapPanel.style.left = `${Math.max(0, ui.map.left)}px`;
      if (Number.isFinite(ui.map.top)) state.mapPanel.style.top = `${Math.max(0, ui.map.top)}px`;
      if (ui.map.collapsed) {
        state.mapPanel.classList.add('agarlens-map-collapsed');
        state.mapPanel.querySelector('#agarlens-map-collapse').textContent = '+';
      }
    }

    if (['live', 'records', 'history'].includes(ui.activeTab)) state.activeTab = ui.activeTab;
    switchTab(state.activeTab, false);
  }

  function makeDraggable(panel, handle) {
    let dragging = false;
    let ox = 0;
    let oy = 0;

    handle.addEventListener('pointerdown', event => {
      if (event.target.closest('button')) return;
      dragging = true;
      const r = panel.getBoundingClientRect();
      ox = event.clientX - r.left;
      oy = event.clientY - r.top;
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener('pointermove', event => {
      if (!dragging) return;
      const maxX = Math.max(0, innerWidth - panel.offsetWidth);
      const maxY = Math.max(0, innerHeight - panel.offsetHeight);
      panel.style.right = 'auto';
      panel.style.left = `${Math.max(0, Math.min(maxX, event.clientX - ox))}px`;
      panel.style.top = `${Math.max(0, Math.min(maxY, event.clientY - oy))}px`;
    });

    handle.addEventListener('pointerup', event => {
      if (!dragging) return;
      dragging = false;
      try { handle.releasePointerCapture(event.pointerId); } catch {}
      saveUi();
    });
  }

  function bindHudEvents() {
    state.panel.querySelector('#agarlens-collapse').addEventListener('click', event => {
      event.stopPropagation();
      const collapsed = state.panel.classList.toggle('agarlens-collapsed');
      event.currentTarget.textContent = collapsed ? '+' : '−';
      saveUi();
    });

    state.mapPanel.querySelector('#agarlens-map-collapse').addEventListener('click', event => {
      event.stopPropagation();
      const collapsed = state.mapPanel.classList.toggle('agarlens-map-collapsed');
      event.currentTarget.textContent = collapsed ? '+' : '−';
      saveUi();
    });

    state.panel.querySelectorAll('.agarlens-tab').forEach(button => {
      button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    state.panel.querySelector('#agarlens-export').addEventListener('click', exportHistory);
    state.panel.querySelector('#agarlens-clear').addEventListener('click', () => {
      if (!confirm('Clear all AgarLens match history and personal records?')) return;
      localStorage.removeItem(HISTORY_KEY);
      renderRecords();
      renderHistory();
    });

    makeDraggable(state.panel, state.panel.querySelector('#agarlens-head'));
    makeDraggable(state.mapPanel, state.mapPanel.querySelector('#agarlens-map-head'));
  }

  function switchTab(tab, persist = true) {
    state.activeTab = ['live', 'records', 'history'].includes(tab) ? tab : 'live';
    if (!state.panel) return;

    state.panel.querySelectorAll('.agarlens-tab').forEach(button => {
      button.classList.toggle('agarlens-active', button.dataset.tab === state.activeTab);
    });
    state.panel.querySelectorAll('.agarlens-pane').forEach(pane => {
      pane.classList.toggle('agarlens-active', pane.dataset.pane === state.activeTab);
    });

    if (persist) saveUi();
  }

  function exportHistory() {
    const payload = {
      exportedAt: new Date().toISOString(),
      agarLensVersion: VERSION,
      matches: loadHistory()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agarlens-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- Rendering ----------

  function renderAll() {
    renderHud();
    renderMiniMap();
  }

  function renderHud() {
    if (!state.panel) return;

    const elapsed = getElapsed();
    const status = state.playing ? 'LIVE' : (state.finalized ? 'ENDED' : 'IDLE');
    const pace = peakPace();
    const avgSpeed = averageGroupSpeed();
    const centre = state.coordLocked ? Math.hypot(state.x, state.y) : null;
    const foodRate = perMinute(state.foodEaten);
    const cellRate = perMinute(state.cellsEaten);
    const connectedFor = state.socketConnected && state.socketConnectedAt
      ? performance.now() - state.socketConnectedAt
      : null;

    state.panel.classList.toggle('agarlens-live', state.playing);
    setText('#agarlens-badge', status);
    setText('[data-v="time"]', fmtDuration(elapsed));
    setText('[data-v="mode"]', state.mode || '—');
    setText('[data-v="rank"]', state.topPosition > 0 ? `#${state.topPosition}` : '—');
    setText('[data-v="leaderboard"]', state.leaderboardTime > 0 ? fmtDuration(state.leaderboardTime) : '—');
    setText('[data-v="leader-share"]', state.leaderboardTime > 0 ? `${fmtNumber(leaderboardShare(), 1)}%` : '—');

    setText('[data-v="peak"]', state.peakMass > 0 ? fmtNumber(state.peakMass) : '—');
    setText('[data-v="peak-time"]', state.peakReachedAt > 0 ? fmtDuration(state.peakReachedAt) : '—');
    setText('[data-v="pace"]', pace == null ? '—' : `${fmtNumber(pace, 1)} m/s`);
    setText('[data-v="pace-min"]', pace == null ? '—' : `${fmtNumber(pace * 60, 0)} mass/min`);

    setText('[data-v="coords"]', state.coordLocked ? `X ${fmtSigned(state.x)} · Y ${fmtSigned(state.y)}` : (state.playing ? 'Detecting…' : '—'));
    setText('[data-v="speed"]', Number.isFinite(state.speed) ? `${fmtNumber(state.speed, 0)} u/s` : '—');
    setText('[data-v="avg-speed"]', Number.isFinite(avgSpeed) ? `${fmtNumber(avgSpeed, 0)} u/s` : '—');
    setText('[data-v="max-speed"]', state.maxSpeed > 0 ? `${fmtNumber(state.maxSpeed, 0)} u/s` : '—');
    setText('[data-v="heading"]', state.heading);
    setText('[data-v="centre"]', Number.isFinite(centre) ? `${fmtCompact(centre)} u` : '—');
    setText('[data-v="distance"]', state.distanceTravelled > 0 ? `${fmtCompact(state.distanceTravelled)} u` : '—');

    setText('[data-v="food"]', state.timeAlive > 0 ? fmtNumber(state.foodEaten) : '—');
    setText('[data-v="food-rate"]', foodRate == null ? '—' : fmtNumber(foodRate, 1));
    setText('[data-v="cells"]', state.timeAlive > 0 ? fmtNumber(state.cellsEaten) : '—');
    setText('[data-v="cell-rate"]', cellRate == null ? '—' : fmtNumber(cellRate, 2));
    setText('[data-v="viruses"]', state.timeAlive > 0 ? fmtNumber(state.virusesEaten) : '—');

    setText('[data-v="server"]', state.server || '—');
    setText('[data-v="conn-uptime"]', connectedFor == null ? (state.socketConnected ? 'Connected' : '—') : fmtDuration(connectedFor));
    setText('[data-v="reconnects"]', String(state.reconnects));
    setText('[data-v="disconnect"]', state.lastDisconnectReason || '—');

    setText('[data-v="fps"]', state.fps || '—');
    setText('[data-v="avg-fps"]', state.avgFrameRate == null ? '—' : fmtNumber(state.avgFrameRate));
    setText('[data-v="updates"]', state.avgMessageInterval == null ? '—' : `${fmtNumber(state.avgMessageInterval)} ms`);
    setText('[data-v="variance"]', state.varianceMessageInterval == null ? '—' : `${fmtNumber(state.varianceMessageInterval)} ms`);

    renderMilestones();

    const compact = state.playing
      ? `${state.mode || '—'} · ${fmtDuration(elapsed)} · ${state.fps || '—'} FPS`
      : state.peakMass > 0
        ? `${state.mode || '—'} · ${fmtDuration(elapsed)} · Peak ${fmtNumber(state.peakMass)}${state.topPosition > 0 ? ` · #${state.topPosition}` : ''}`
        : `${state.mode || '—'} · ${fmtDuration(elapsed)} · ${state.fps || '—'} FPS`;

    setText('#agarlens-compact', compact);
  }

  function renderMilestones() {
    const container = state.panel?.querySelector('#agarlens-milestones');
    if (!container) return;

    const defs = [
      ['mass_100', '100 mass'],
      ['mass_500', '500 mass'],
      ['mass_1000', '1,000 mass'],
      ['top_10', 'Top 10'],
      ['top_5', 'Top 5'],
      ['top_1', '#1'],
      ['first_cell', 'First cell']
    ];

    container.innerHTML = defs.map(([key, label]) => `
      <div class="agarlens-label">${label}</div>
      <div class="agarlens-value">${state.milestones[key] != null ? fmtDuration(state.milestones[key]) : '—'}</div>
    `).join('');
  }

  function bestRecord(history, field, direction = 'max') {
    const values = history.filter(item => Number.isFinite(Number(item[field])) && Number(item[field]) > 0);
    if (!values.length) return null;
    return values.reduce((best, item) => {
      if (!best) return item;
      return direction === 'min'
        ? (Number(item[field]) < Number(best[field]) ? item : best)
        : (Number(item[field]) > Number(best[field]) ? item : best);
    }, null);
  }

  function bestMilestone(history, key) {
    const candidates = history
      .map(record => ({ record, value: Number(record?.milestones?.[key]) }))
      .filter(item => Number.isFinite(item.value) && item.value > 0);
    if (!candidates.length) return null;
    return candidates.reduce((best, item) => !best || item.value < best.value ? item : best, null);
  }

  function renderRecords() {
    const root = state.panel?.querySelector('#agarlens-records');
    if (!root) return;
    const history = loadHistory();

    if (!history.length) {
      root.innerHTML = '<div class="agarlens-sub">No completed matches recorded yet.</div>';
      return;
    }

    const fastest1000 = bestMilestone(history, 'mass_1000');
    const fastestTop10 = bestMilestone(history, 'top_10');
    const fastestTop1 = bestMilestone(history, 'top_1');

    const records = [
      ['🏆 Biggest mass', bestRecord(history, 'peakMass'), r => fmtNumber(r.peakMass)],
      ['⏱ Longest life', bestRecord(history, 'survivalMs'), r => fmtDuration(r.survivalMs)],
      ['🥇 Best position', bestRecord(history.filter(r => r.bestPosition), 'bestPosition', 'min'), r => `#${r.bestPosition}`],
      ['🏅 Longest leaderboard', bestRecord(history, 'leaderboardTime'), r => fmtDuration(r.leaderboardTime)],
      ['📊 Best leaderboard share', bestRecord(history, 'leaderboardShare'), r => `${fmtNumber(r.leaderboardShare, 1)}%`],
      ['☠ Most cells eaten', bestRecord(history, 'cellsEaten'), r => fmtNumber(r.cellsEaten)],
      ['📈 Best peak pace', bestRecord(history, 'peakPace'), r => `${fmtNumber(r.peakPace, 1)} m/s`],
      ['🏃 Furthest travelled', bestRecord(history, 'distanceTravelled'), r => `${fmtCompact(r.distanceTravelled)} u`],
      ['⚡ Max group speed', bestRecord(history, 'maxGroupSpeed'), r => `${fmtNumber(r.maxGroupSpeed)} u/s`],
      ['🚀 Fastest 1,000 mass', fastest1000?.record || null, () => fmtDuration(fastest1000?.value)],
      ['🔟 Fastest Top 10', fastestTop10?.record || null, () => fmtDuration(fastestTop10?.value)],
      ['👑 Fastest #1', fastestTop1?.record || null, () => fmtDuration(fastestTop1?.value)]
    ];

    root.innerHTML = records.map(([name, record, formatter]) => {
      if (!record) return '';
      const date = new Date(record.endedAt).toLocaleDateString();
      return `
        <div class="agarlens-record-row">
          <div class="agarlens-record-top">
            <span class="agarlens-record-name">${name}</span>
            <span class="agarlens-record-value">${formatter(record)}</span>
          </div>
          <div class="agarlens-sub">${record.mode || '—'} · ${date}</div>
        </div>
      `;
    }).join('');
  }

  function renderHistory() {
    const root = state.panel?.querySelector('#agarlens-history');
    if (!root) return;
    const history = loadHistory();

    if (!history.length) {
      root.innerHTML = '<div class="agarlens-sub">No completed matches recorded yet.</div>';
      return;
    }

    root.innerHTML = history.slice(0, 12).map((record, index) => {
      const when = new Date(record.endedAt).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      return `
        <div class="agarlens-history-row">
          <div class="agarlens-record-top">
            <span class="agarlens-record-name">#${history.length - index} · ${record.mode || '—'} · ${fmtDuration(record.survivalMs)}</span>
            <span class="agarlens-record-value">Peak ${fmtNumber(record.peakMass)}</span>
          </div>
          <div class="agarlens-sub">${when} · ${record.bestPosition ? `#${record.bestPosition} · ` : ''}${record.cellsEaten || 0} cells · ${record.reconnects || 0} reconnects</div>
        </div>
      `;
    }).join('');
  }

  function showNewRecordToast(record, previousHistory) {
    const toast = state.panel?.querySelector('#agarlens-toast');
    if (!toast) return;

    const wins = [];
    const checks = [
      ['Peak mass', 'peakMass', 'max', v => fmtNumber(v)],
      ['Longest life', 'survivalMs', 'max', v => fmtDuration(v)],
      ['Most cells eaten', 'cellsEaten', 'max', v => fmtNumber(v)],
      ['Best peak pace', 'peakPace', 'max', v => `${fmtNumber(v, 1)} m/s`],
      ['Furthest travelled', 'distanceTravelled', 'max', v => `${fmtCompact(v)} u`],
      ['Max group speed', 'maxGroupSpeed', 'max', v => `${fmtNumber(v)} u/s`]
    ];

    for (const [label, field, direction, formatter] of checks) {
      const current = Number(record[field]);
      if (!Number.isFinite(current) || current <= 0) continue;
      const old = bestRecord(previousHistory, field, direction);
      if (!old || (direction === 'max' ? current > Number(old[field]) : current < Number(old[field]))) {
        wins.push(`${label}: ${formatter(current)}`);
      }
    }

    if (record.bestPosition) {
      const oldRank = bestRecord(previousHistory.filter(r => r.bestPosition), 'bestPosition', 'min');
      if (!oldRank || record.bestPosition < oldRank.bestPosition) wins.push(`Best position: #${record.bestPosition}`);
    }

    if (!wins.length) {
      toast.classList.remove('agarlens-show');
      return;
    }

    toast.innerHTML = `<strong>🏆 NEW RECORD${wins.length > 1 ? 'S' : ''}</strong><br>${wins.join('<br>')}`;
    toast.classList.add('agarlens-show');
  }

  // ---------- Mini-map ----------

  function drawMarker(ctx, x, y, kind) {
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f5f7fb';
    ctx.fillStyle = '#f5f7fb';

    if (kind === 'spawn') {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 'peak') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const r = i % 2 === 0 ? 7 : 3;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (kind === 'death') {
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5);
      ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5);
      ctx.stroke();
    }

    ctx.restore();
  }

  function renderMiniMap() {
    const canvas = state.mapCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const pad = 16;
    const left = pad;
    const top = pad;
    const size = Math.min(w, h) - pad * 2;
    const midX = left + size / 2;
    const midY = top + size / 2;
    const half = Math.max(DEFAULT_MAP_HALF, state.mapHalf || DEFAULT_MAP_HALF);

    const project = (x, y) => ({
      x: midX + (x / half) * (size / 2),
      y: midY - (y / half) * (size / 2)
    });

    ctx.clearRect(0, 0, w, h);

    // Border and centre axes.
    ctx.strokeStyle = 'rgba(245,247,251,.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, size, size);

    ctx.strokeStyle = 'rgba(245,247,251,.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(midX, top); ctx.lineTo(midX, top + size);
    ctx.moveTo(left, midY); ctx.lineTo(left + size, midY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(245,247,251,.55)';
    ctx.beginPath();
    ctx.arc(midX, midY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Fading 20-second trail.
    const now = performance.now();
    if (state.trail.length > 1) {
      for (let i = 1; i < state.trail.length; i++) {
        const a = state.trail[i - 1];
        const b = state.trail[i];
        const age = Math.max(0, now - b.t);
        const alpha = Math.max(0.06, 0.72 * (1 - age / TRAIL_MS));
        const pa = project(a.x, a.y);
        const pb = project(b.x, b.y);
        ctx.strokeStyle = `rgba(245,247,251,${alpha})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }

    if (state.spawnCoord) {
      const p = project(state.spawnCoord.x, state.spawnCoord.y);
      drawMarker(ctx, p.x, p.y, 'spawn');
    }

    if (state.peakCoord) {
      const p = project(state.peakCoord.x, state.peakCoord.y);
      drawMarker(ctx, p.x, p.y, 'peak');
    }

    if (state.deathCoord && !state.playing) {
      const p = project(state.deathCoord.x, state.deathCoord.y);
      drawMarker(ctx, p.x, p.y, 'death');
    }

    if (state.coordLocked && Number.isFinite(state.x) && Number.isFinite(state.y)) {
      const p = project(state.x, state.y);
      ctx.fillStyle = '#f5f7fb';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();

      // Direction tick based on recent velocity heading.
      if (state.lastPosSample && state.speed > 1 && state.trail.length >= 2) {
        const a = state.trail[state.trail.length - 2];
        const b = state.trail[state.trail.length - 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const mag = Math.hypot(dx, dy);
        if (mag > 0.01) {
          const len = Math.min(28, 10 + (state.speed / 100));
          ctx.strokeStyle = '#f5f7fb';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + dx / mag * len, p.y - dy / mag * len);
          ctx.stroke();
        }
      }
    }

    setMapText('#agarlens-map-status', state.playing ? 'LIVE' : (state.finalized ? 'ENDED' : 'IDLE'));
    setMapText('[data-map-v="coords"]', state.coordLocked ? `${fmtSigned(state.x)}, ${fmtSigned(state.y)}` : '0, 0');
    setMapText('[data-map-v="speed"]', Number.isFinite(state.speed) ? `${fmtNumber(state.speed)} u/s` : '— u/s');
  }

  // ---------- Document events ----------

  document.addEventListener('game_mode_update', event => {
    state.mode = cleanMode(event.detail) || state.mode;
    renderAll();
  });

  document.addEventListener('game_start', () => {
    // Fires before authoritative spawn; useful only to wake observers.
    if (!state.playing) {
      state.startedAt = performance.now();
      state.elapsedMs = 0;
      installTranslateObserver();
      renderAll();
    }
  });

  document.addEventListener('game_over', event => {
    // Fallback in case the native death wrapper changes in a later client build.
    const d = event.detail || {};
    state.foodEaten = Number(d.foodEaten) || state.foodEaten;
    state.timeAlive = Number(d.timeAlive) || state.timeAlive;
    state.cellsEaten = Number(d.cellsEaten) || state.cellsEaten;

    const peak = Number(d.highestMass) || 0;
    if (peak > state.peakMass) {
      state.peakMass = peak;
      state.peakReachedAt = state.timeAlive;
      state.peakCoord = capturePosition();
    }

    const rank = Number(d.topPosition) || 0;
    if (rank > 0 && (state.topPosition <= 0 || rank < state.topPosition)) state.topPosition = rank;
    endMatch();
  });

  document.addEventListener('show_main_menu', () => {
    if (state.playing) endMatch();
  });

  // ---------- Animation / boot ----------

  function fpsLoop(now) {
    state.frames += 1;
    const span = now - state.fpsWindow;

    if (span >= 1000) {
      state.fps = Math.round((state.frames * 1000) / span);
      state.frames = 0;
      state.fpsWindow = now;
    }

    if (now - state.lastUiTick >= 250) {
      state.lastUiTick = now;
      renderAll();
    }

    requestAnimationFrame(fpsLoop);
  }

  function boot() {
    buildHud();
    installWebSocketObserver();
    installTranslateObserver();

    // Agar may recreate MC/core after reconnects. Re-check hooks without scanning the DOM.
    setInterval(() => {
      hookMC();
      installTranslateObserver();
      installWebSocketObserver();
    }, 1500);

    requestAnimationFrame(fpsLoop);
    console.info(`[AgarLens ${VERSION}] Loaded.`);
  }

  // Install the socket observer immediately at document-start so the first arena
  // connection cannot race ahead of the HUD boot.
  installWebSocketObserver();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
