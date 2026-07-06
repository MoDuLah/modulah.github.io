// ==UserScript==
// @name         MoDuL Hub Control Room
// @namespace    modul.hub.control-room
// @version      0.2.8
// @description  One-place live palette, font, radius, unit-aware spacing, padding, margin, and compatibility controller for MoDuL Torn userscripts.
// @author       MoDuL
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @downloadURL  https://modulah.github.io/global-theme/modul-hub-global-theme.user.js
// @updateURL    https://modulah.github.io/global-theme/modul-hub-global-theme.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  if (window.MoDuLHubControlRoom) return;

  const VERSION = '0.2.8';
  const THEME_CONTRACT_VERSION = '1.0.0';
  const CSS_VAR_PREFIX = '--mh-';
  const STORAGE_KEY = 'modulHubControlRoom.v2';
  const STYLE_ID = 'modul-hub-control-room-style';
  const CONTRACT_STYLE_ID = 'modul-hub-contract-style';
  const BRIDGE_STYLE_ID = 'modul-hub-compat-bridge-style';
  const OVERLAY_ID = 'modul-hub-control-room-overlay';
  const TRIGGER_ID = 'modul-hub-control-room-trigger';
  const root = document.documentElement;

  const EVENT_NAMES = Object.freeze({
    ready: 'modulhub:theme-ready',
    updated: 'modulhub:theme-updated'
  });

  const THEME_ALIASES = Object.freeze({
    bg: ['--mh-bg-main'],
    bgSoft: ['--mh-bg-soft'],
    panel: ['--mh-bg-panel'],
    panel2: ['--mh-bg-panel-2', '--mh-panel-2'],
    tableBg: ['--mh-table-bg'],
    tableHead: ['--mh-table-head'],
    borderSoft: ['--mh-border-soft'],
    textMuted: ['--mh-muted'],
    accent: ['--mh-primary', '--mh-link'],
    accent2: ['--mh-secondary'],
    fontBody: ['--mh-font', '--mh-font-family'],
    radiusMd: ['--mh-radius'],
    paddingMd: ['--mh-padding'],
    marginMd: ['--mh-margin'],
    shadow: ['--mh-panel-shadow']
  });

  const THEME_CLASSES = Object.freeze({
    root: 'mh-root',
    panel: 'mh-panel',
    card: 'mh-card',
    elevated: 'mh-elevated',
    toolbar: 'mh-toolbar',
    control: 'mh-control',
    button: 'mh-button',
    input: 'mh-input',
    select: 'mh-select',
    table: 'mh-table',
    tableHead: 'mh-table-head',
    tableBody: 'mh-table-body',
    tableRow: 'mh-table-row',
    tableCell: 'mh-table-cell',
    accent: 'mh-accent',
    muted: 'mh-muted',
    success: 'mh-success',
    warning: 'mh-warning',
    danger: 'mh-danger',
    info: 'mh-info'
  });

  const THEME_DATA = Object.freeze({
    component: 'data-mh-component',
    surface: 'data-mh-surface',
    tablePart: 'data-mh-table-part',
    state: 'data-mh-state'
  });

  const THEME_DATA_VALUES = Object.freeze({
    components: {
      root: 'root',
      panel: 'panel',
      card: 'card',
      toolbar: 'toolbar',
      control: 'control',
      button: 'button',
      field: 'field',
      table: 'table'
    },
    surfaces: {
      panel: 'panel',
      elevated: 'elevated',
      control: 'control',
      table: 'table'
    },
    tableParts: {
      head: 'head',
      body: 'body',
      row: 'row',
      cell: 'cell'
    },
    states: {
      accent: 'accent',
      muted: 'muted',
      success: 'success',
      warning: 'warning',
      danger: 'danger',
      info: 'info'
    }
  });

  const THEME_SELECTORS = Object.freeze({
    panel: [
      ':is(.panel,.card,.modal,.box,.wrap,.container,.content,.body,.head,.header,.footer)',
      `:is(.${THEME_CLASSES.panel},.${THEME_CLASSES.card},.${THEME_CLASSES.elevated})`,
      ':is([data-mh-component="panel"],[data-mh-component="card"],[data-mh-surface="panel"],[data-mh-surface="elevated"])'
    ],
    control: [
      ':is(button,.button,[role="button"],input,select,textarea)',
      `:is(.${THEME_CLASSES.control},.${THEME_CLASSES.button},.${THEME_CLASSES.input},.${THEME_CLASSES.select})`,
      ':is([data-mh-component="control"],[data-mh-component="button"],[data-mh-component="field"])'
    ],
    button: [
      ':is(button,.button,[role="button"])',
      `:is(.${THEME_CLASSES.button})`,
      ':is([data-mh-component="button"])'
    ],
    select: [
      ':is(select)',
      `:is(.${THEME_CLASSES.select})`
    ],
    table: [
      ':is(table,thead,tbody,tr,td,th)',
      `:is(.${THEME_CLASSES.table},.${THEME_CLASSES.tableHead},.${THEME_CLASSES.tableBody},.${THEME_CLASSES.tableRow},.${THEME_CLASSES.tableCell})`,
      ':is([data-mh-component="table"],[data-mh-table-part])'
    ],
    tableHead: [
      `:is(th,thead,.table-head,.${THEME_CLASSES.tableHead})`,
      ':is([data-mh-table-part="head"])'
    ],
    tableBody: [
      `:is(td,tbody,.table-body,.${THEME_CLASSES.tableBody})`,
      ':is([data-mh-table-part="body"])'
    ],
    tableCell: [
      `:is(td,th,.${THEME_CLASSES.tableCell})`,
      ':is([data-mh-table-part="cell"])'
    ],
    accent: [
      `:is(a,.link,.active,.primary,.accent,.${THEME_CLASSES.accent})`,
      ':is([data-mh-state="accent"])'
    ],
    muted: [
      `:is(.muted,.secondary,.note,.hint,.subtle,.${THEME_CLASSES.muted})`,
      ':is([data-mh-state="muted"])'
    ],
    danger: [
      `:is(.danger,.error,.bad,.negative,.${THEME_CLASSES.danger})`,
      ':is([data-mh-state="danger"])'
    ],
    success: [
      `:is(.success,.good,.positive,.${THEME_CLASSES.success})`,
      ':is([data-mh-state="success"])'
    ]
  });

  const DEFAULT_VARS = Object.freeze({
    bg: '#071107',
    bgSoft: '#0b1508',
    panel: '#101807',
    panel2: '#16230d',
    elevated: '#1d2b11',
    tableBg: '#0b140b',
    tableHead: '#13200d',
    control: '#17250f',
    controlHover: '#203414',
    border: '#8fbf26',
    borderSoft: 'rgba(159, 212, 47, 0.32)',
    borderStrong: '#9fd42f',
    text: '#eaffd6',
    textSoft: '#cfe8a8',
    textMuted: '#8fa36d',
    accent: '#9fd42f',
    accent2: '#44f582',
    success: '#44f582',
    warning: '#e5bd54',
    danger: '#ff5c5c',
    info: '#72d9ff',
    overlay: 'rgba(0, 0, 0, 0.72)',
    shadow: '0 18px 45px rgba(0, 0, 0, 0.55)',
    radiusSm: '6px',
    radiusMd: '10px',
    radiusLg: '14px',
    radiusXl: '18px',
    spaceXs: '4px',
    spaceSm: '8px',
    spaceMd: '12px',
    spaceLg: '16px',
    spaceXl: '22px',
    paddingXs: '4px',
    paddingSm: '8px',
    paddingMd: '12px',
    paddingLg: '16px',
    paddingXl: '22px',
    marginXs: '4px',
    marginSm: '8px',
    marginMd: '12px',
    marginLg: '16px',
    marginXl: '22px',
    panelPadding: '12px',
    panelMargin: '0 0 10px 0',
    cardPadding: '16px',
    buttonPadding: '8px 12px',
    inputPadding: '6px 8px',
    tableCellPadding: '6px 8px',
    fieldPadding: '8px 9px',
    headerPadding: '20px 18px 14px',
    tabsPadding: '10px 14px',
    sidebarPadding: '10px 14px',
    mainPadding: '16px',
    footerPadding: '12px 18px',
    sectionMargin: '10px 0 2px',
    buttonRowMargin: '10px 0 0 0',

    // Per-side box controls. These let the editor tweak top/right/bottom/left live
    // without forcing the user to remember CSS shorthand order.
    panelPaddingTop: '12px', panelPaddingRight: '12px', panelPaddingBottom: '12px', panelPaddingLeft: '12px',
    panelMarginTop: '0', panelMarginRight: '0', panelMarginBottom: '10px', panelMarginLeft: '0',
    cardPaddingTop: '16px', cardPaddingRight: '16px', cardPaddingBottom: '16px', cardPaddingLeft: '16px',
    buttonPaddingTop: '8px', buttonPaddingRight: '12px', buttonPaddingBottom: '8px', buttonPaddingLeft: '12px',
    inputPaddingTop: '6px', inputPaddingRight: '8px', inputPaddingBottom: '6px', inputPaddingLeft: '8px',
    tableCellPaddingTop: '6px', tableCellPaddingRight: '8px', tableCellPaddingBottom: '6px', tableCellPaddingLeft: '8px',
    fieldPaddingTop: '8px', fieldPaddingRight: '9px', fieldPaddingBottom: '8px', fieldPaddingLeft: '9px',
    headerPaddingTop: '20px', headerPaddingRight: '18px', headerPaddingBottom: '14px', headerPaddingLeft: '18px',
    tabsPaddingTop: '10px', tabsPaddingRight: '14px', tabsPaddingBottom: '10px', tabsPaddingLeft: '14px',
    sidebarPaddingTop: '10px', sidebarPaddingRight: '14px', sidebarPaddingBottom: '10px', sidebarPaddingLeft: '14px',
    mainPaddingTop: '16px', mainPaddingRight: '16px', mainPaddingBottom: '16px', mainPaddingLeft: '16px',
    footerPaddingTop: '12px', footerPaddingRight: '18px', footerPaddingBottom: '12px', footerPaddingLeft: '18px',
    sectionMarginTop: '10px', sectionMarginRight: '0', sectionMarginBottom: '2px', sectionMarginLeft: '0',
    buttonRowMarginTop: '10px', buttonRowMarginRight: '0', buttonRowMarginBottom: '0', buttonRowMarginLeft: '0',
    fontBody: 'Arial, Helvetica, sans-serif',
    fontTitle: 'Arial, Helvetica, sans-serif',
    fontMono: 'Consolas, "Courier New", monospace',
    fontSize: '12px',
    fontSizeSm: '11px',
    fontSizeLg: '14px',
    lineHeight: '1.35',
    letterSpacing: '0px'
  });

  const PRESETS = Object.freeze([
    {
      id: 'shadowWheels',
      name: 'Shadow Wheels Green',
      desc: 'Main MoDuL / Shadow Wheels dark green identity.',
      swatches: ['#071107', '#101807', '#8fbf26', '#9fd42f', '#44f582'],
      vars: {
        bg: '#071107', bgSoft: '#0b1508', panel: '#101807', panel2: '#16230d', elevated: '#1d2b11',
        tableBg: '#0b140b', tableHead: '#13200d', control: '#17250f', controlHover: '#203414',
        border: '#8fbf26', borderSoft: 'rgba(159, 212, 47, 0.32)', borderStrong: '#9fd42f',
        text: '#eaffd6', textSoft: '#cfe8a8', textMuted: '#8fa36d', accent: '#9fd42f', accent2: '#44f582',
        success: '#44f582', warning: '#e5bd54', danger: '#ff5c5c', info: '#72d9ff'
      }
    },
    {
      id: 'pythagorasCarbon',
      name: 'Pythagoras Carbon',
      desc: 'Neutral carbon interface with green and cyan highlights.',
      swatches: ['#111313', '#171a1a', '#343936', '#46c58f', '#00c6ff'],
      vars: {
        bg: '#111313', bgSoft: '#151918', panel: '#121615', panel2: '#171a1a', elevated: '#202624',
        tableBg: '#111313', tableHead: '#171a1a', control: '#191d1c', controlHover: '#202624',
        border: '#343936', borderSoft: 'rgba(255, 255, 255, 0.08)', borderStrong: '#4b5550',
        text: '#eff2ef', textSoft: '#cfd7d1', textMuted: '#a8b0aa', accent: '#46c58f', accent2: '#00c6ff',
        success: '#46c58f', warning: '#d8a545', danger: '#d95d5d', info: '#8ab4f8'
      }
    },
    {
      id: 'blueGold',
      name: 'Blue / Gold',
      desc: 'Corporate dark blue with premium gold accents.',
      swatches: ['#081019', '#101925', '#d8a545', '#f4d35e', '#00c6ff'],
      vars: {
        bg: '#081019', bgSoft: '#0b1522', panel: '#101925', panel2: '#172538', elevated: '#1b304b',
        tableBg: '#0b1522', tableHead: '#172538', control: '#101925', controlHover: '#172538',
        border: '#d8a545', borderSoft: 'rgba(216, 165, 69, 0.38)', borderStrong: '#f4d35e',
        text: '#f7e7b0', textSoft: '#d7c07a', textMuted: '#9ea7b5', accent: '#f4d35e', accent2: '#00c6ff',
        success: '#46c58f', warning: '#f0d06f', danger: '#ef6d70', info: '#8ab4f8'
      }
    },
    {
      id: 'landlordSlate',
      name: 'Landlord Slate',
      desc: 'Clean slate colours for financial tables.',
      swatches: ['#101820', '#16222d', '#40505f', '#2f6f77', '#72aeb8'],
      vars: {
        bg: '#101820', bgSoft: '#121b24', panel: '#131d27', panel2: '#16222d', elevated: '#1d2a37',
        tableBg: '#0f1820', tableHead: '#17222d', control: '#263545', controlHover: '#314456',
        border: '#40505f', borderSoft: '#2c3945', borderStrong: '#65798b',
        text: '#e9edf1', textSoft: '#c8d2dc', textMuted: '#a9b5c0', accent: '#2f8b96', accent2: '#72aeb8',
        success: '#46c58f', warning: '#d8a545', danger: '#d95d5d', info: '#8ab4f8'
      }
    },
    {
      id: 'pitGuruDark',
      name: 'Pit Guru Dark',
      desc: 'Motorsport black with timing-board yellow and green.',
      swatches: ['#111111', '#1a1a1a', '#333333', '#ffc83d', '#00ff00'],
      vars: {
        bg: '#111111', bgSoft: '#161616', panel: '#121212', panel2: '#1a1a1a', elevated: '#222222',
        tableBg: '#0f0f0f', tableHead: '#1a1a1a', control: '#1c1c1c', controlHover: '#232323',
        border: '#333333', borderSoft: 'rgba(255, 255, 255, 0.10)', borderStrong: '#5a5a5a',
        text: '#ffffff', textSoft: '#dddddd', textMuted: '#bbbbbb', accent: '#ffc83d', accent2: '#00ff00',
        success: '#00ff00', warning: '#ffc83d', danger: '#ff6b6b', info: '#74b7ff'
      }
    },
    {
      id: 'stockXBlue',
      name: 'Stock-X Blue',
      desc: 'Market-dashboard blues with bright data accents.',
      swatches: ['#07131f', '#0b1d31', '#17304d', '#34b3ff', '#62d4ff'],
      vars: {
        bg: '#07131f', bgSoft: '#081522', panel: '#0b1d31', panel2: '#17304d', elevated: '#1d3a5c',
        tableBg: '#081522', tableHead: '#17304d', control: '#10263d', controlHover: '#17304d',
        border: '#34b3ff', borderSoft: 'rgba(52, 179, 255, 0.18)', borderStrong: '#62d4ff',
        text: '#ffffff', textSoft: '#d8eefc', textMuted: '#a9c6dc', accent: '#34b3ff', accent2: '#62d4ff',
        success: '#8bc34a', warning: '#ffeb3b', danger: '#ef5350', info: '#62d4ff'
      }
    },
    {
      id: 'smugglerRedGold',
      name: 'Smuggler Red / Gold',
      desc: 'High contrast red and gold identity.',
      swatches: ['#111111', '#2a1111', '#c8102e', '#ffde00', '#ffffff'],
      vars: {
        bg: '#111111', bgSoft: '#1b1313', panel: '#171717', panel2: '#2a1111', elevated: '#382020',
        tableBg: '#111111', tableHead: '#2a1111', control: '#333333', controlHover: '#515151',
        border: '#c8102e', borderSoft: 'rgba(200, 16, 46, 0.38)', borderStrong: '#ffde00',
        text: '#ffffff', textSoft: '#e4e4e4', textMuted: '#d0d0d0', accent: '#ffde00', accent2: '#d52b1e',
        success: '#44f582', warning: '#ffde00', danger: '#ff3b3b', info: '#74b7ff'
      }
    },
    {
      id: 'toxicNeon',
      name: 'Toxic Neon',
      desc: 'Sharp green neon for hacker-style tools.',
      swatches: ['#050e06', '#0b1a0b', '#1a3c1a', '#20e890', '#40ff80'],
      vars: {
        bg: '#050e06', bgSoft: '#081208', panel: '#0b1a0b', panel2: '#0e2010', elevated: '#122811',
        tableBg: '#061207', tableHead: '#0e2010', control: '#102212', controlHover: '#173018',
        border: '#1a3c1a', borderSoft: 'rgba(64, 255, 128, 0.18)', borderStrong: '#2a6030',
        text: '#d8f5d8', textSoft: '#a8e8b0', textMuted: '#80c890', accent: '#20e890', accent2: '#40ff80',
        success: '#40ff80', warning: '#cccc00', danger: '#f05060', info: '#20e890'
      }
    },
    {
      id: 'neonTokyo',
      name: 'Neon Tokyo',
      desc: 'Pink, cyan, and purple neon control room.',
      swatches: ['#070510', '#100c22', '#cc0088', '#ff40b0', '#00e8ff'],
      vars: {
        bg: '#070510', bgSoft: '#0c0818', panel: '#100c22', panel2: '#160f2c', elevated: '#1c1438',
        tableBg: '#080614', tableHead: '#160f2c', control: '#1b1234', controlHover: '#241948',
        border: '#281a50', borderSoft: 'rgba(255, 64, 176, 0.22)', borderStrong: '#441888',
        text: '#f8f0ff', textSoft: '#d0a0f0', textMuted: '#a070d8', accent: '#ff40b0', accent2: '#00e8ff',
        success: '#80f8ff', warning: '#ccff00', danger: '#ff0870', info: '#00e8ff'
      }
    },
    {
      id: 'voidMono',
      name: 'Void Mono',
      desc: 'Minimal monochrome mode.',
      swatches: ['#080808', '#141414', '#484848', '#a8a8a8', '#f0f0f0'],
      vars: {
        bg: '#080808', bgSoft: '#0e0e0e', panel: '#141414', panel2: '#1c1c1c', elevated: '#242424',
        tableBg: '#0b0b0b', tableHead: '#1c1c1c', control: '#202020', controlHover: '#2b2b2b',
        border: '#2e2e2e', borderSoft: 'rgba(255, 255, 255, 0.10)', borderStrong: '#484848',
        text: '#f0f0f0', textSoft: '#c0c0c0', textMuted: '#888888', accent: '#a8a8a8', accent2: '#f0f0f0',
        success: '#d8d8d8', warning: '#b8b8b8', danger: '#808080', info: '#c0c0c0'
      }
    }
  ]);

  const FONT_PRESETS = Object.freeze([
    {
      id: 'system',
      name: 'System Clean',
      vars: {
        fontBody: 'Arial, Helvetica, sans-serif',
        fontTitle: 'Arial, Helvetica, sans-serif',
        fontMono: 'Consolas, "Courier New", monospace',
        fontSize: '12px', fontSizeSm: '11px', fontSizeLg: '14px', lineHeight: '1.35', letterSpacing: '0px'
      }
    },
    {
      id: 'modern',
      name: 'Modern UI',
      vars: {
        fontBody: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontTitle: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontMono: 'Consolas, "SFMono-Regular", "Courier New", monospace',
        fontSize: '12px', fontSizeSm: '11px', fontSizeLg: '14px', lineHeight: '1.4', letterSpacing: '0px'
      }
    },
    {
      id: 'condensed',
      name: 'Compact Racing',
      vars: {
        fontBody: 'Arial Narrow, Arial, Helvetica, sans-serif',
        fontTitle: 'Arial Black, Arial, Helvetica, sans-serif',
        fontMono: 'Consolas, "Courier New", monospace',
        fontSize: '11px', fontSizeSm: '10px', fontSizeLg: '13px', lineHeight: '1.25', letterSpacing: '0.2px'
      }
    },
    {
      id: 'terminal',
      name: 'Terminal Mono',
      vars: {
        fontBody: 'Consolas, "Courier New", monospace',
        fontTitle: 'Consolas, "Courier New", monospace',
        fontMono: 'Consolas, "Courier New", monospace',
        fontSize: '12px', fontSizeSm: '11px', fontSizeLg: '14px', lineHeight: '1.35', letterSpacing: '0px'
      }
    },
    {
      id: 'classic',
      name: 'Classic Verdana',
      vars: {
        fontBody: 'Verdana, Geneva, sans-serif',
        fontTitle: 'Verdana, Geneva, sans-serif',
        fontMono: 'Consolas, "Courier New", monospace',
        fontSize: '11px', fontSizeSm: '10px', fontSizeLg: '13px', lineHeight: '1.35', letterSpacing: '0px'
      }
    }
  ]);

  const COLOUR_GROUPS = Object.freeze([
    ['Backgrounds', ['bg', 'bgSoft', 'panel', 'panel2', 'elevated', 'tableBg', 'tableHead']],
    ['Controls & Borders', ['control', 'controlHover', 'border', 'borderSoft', 'borderStrong']],
    ['Typography Colours', ['text', 'textSoft', 'textMuted']],
    ['Accent & States', ['accent', 'accent2', 'success', 'warning', 'danger', 'info']],
    ['Effects', ['overlay', 'shadow']]
  ]);

  const SIZE_GROUPS = Object.freeze([
    ['Border Radius', ['radiusSm', 'radiusMd', 'radiusLg', 'radiusXl']],
    ['Spacing Scale', ['spaceXs', 'spaceSm', 'spaceMd', 'spaceLg', 'spaceXl']],
    ['Padding Scale', ['paddingXs', 'paddingSm', 'paddingMd', 'paddingLg', 'paddingXl']],
    ['Margin Scale', ['marginXs', 'marginSm', 'marginMd', 'marginLg', 'marginXl']],
    ['Script Panel Padding', ['panelPaddingTop', 'panelPaddingRight', 'panelPaddingBottom', 'panelPaddingLeft']],
    ['Script Panel Margin', ['panelMarginTop', 'panelMarginRight', 'panelMarginBottom', 'panelMarginLeft']],
    ['Cards / Editor Fields Padding', ['cardPaddingTop', 'cardPaddingRight', 'cardPaddingBottom', 'cardPaddingLeft', 'fieldPaddingTop', 'fieldPaddingRight', 'fieldPaddingBottom', 'fieldPaddingLeft']],
    ['Buttons / Inputs Padding', ['buttonPaddingTop', 'buttonPaddingRight', 'buttonPaddingBottom', 'buttonPaddingLeft', 'inputPaddingTop', 'inputPaddingRight', 'inputPaddingBottom', 'inputPaddingLeft']],
    ['Table Cell Padding', ['tableCellPaddingTop', 'tableCellPaddingRight', 'tableCellPaddingBottom', 'tableCellPaddingLeft']],
    ['Control Room Header Padding', ['headerPaddingTop', 'headerPaddingRight', 'headerPaddingBottom', 'headerPaddingLeft']],
    ['Control Room Dock / Main / Footer Padding', ['tabsPaddingTop', 'tabsPaddingRight', 'tabsPaddingBottom', 'tabsPaddingLeft', 'sidebarPaddingTop', 'sidebarPaddingRight', 'sidebarPaddingBottom', 'sidebarPaddingLeft', 'mainPaddingTop', 'mainPaddingRight', 'mainPaddingBottom', 'mainPaddingLeft', 'footerPaddingTop', 'footerPaddingRight', 'footerPaddingBottom', 'footerPaddingLeft']],
    ['Section / Button Row Margins', ['sectionMarginTop', 'sectionMarginRight', 'sectionMarginBottom', 'sectionMarginLeft', 'buttonRowMarginTop', 'buttonRowMarginRight', 'buttonRowMarginBottom', 'buttonRowMarginLeft']]
  ]);

  const DIMENSION_UNITS = Object.freeze(['px', '%', 'em', 'rem', 'vh', 'vw', 'vmin', 'vmax', 'ch']);

  function allSizeKeys() {
    return Array.from(new Set(SIZE_GROUPS.flatMap(([, keys]) => keys)));
  }

  const FONT_GROUPS = Object.freeze([
    ['Font Families', ['fontBody', 'fontTitle', 'fontMono']],
    ['Font Sizing', ['fontSize', 'fontSizeSm', 'fontSizeLg', 'lineHeight', 'letterSpacing']]
  ]);

  const LABELS = Object.freeze({
    bg: 'Page Background', bgSoft: 'Soft Background', panel: 'Panel Surface', panel2: 'Input / Sub Panel', elevated: 'Elevated Surface',
    tableBg: 'Table Body', tableHead: 'Table Header', control: 'Control Background', controlHover: 'Control Hover',
    border: 'Border', borderSoft: 'Soft Border', borderStrong: 'Strong Border', text: 'Main Text', textSoft: 'Soft Text', textMuted: 'Muted Text',
    accent: 'Main Accent', accent2: 'Bright Accent', success: 'Success', warning: 'Warning', danger: 'Danger', info: 'Info',
    overlay: 'Modal Overlay', shadow: 'Panel Shadow', radiusSm: 'Radius Small', radiusMd: 'Radius Medium', radiusLg: 'Radius Large', radiusXl: 'Radius XL',
    spaceXs: 'Spacing XS', spaceSm: 'Spacing Small', spaceMd: 'Spacing Medium', spaceLg: 'Spacing Large', spaceXl: 'Spacing XL',
    paddingXs: 'Padding XS', paddingSm: 'Padding Small', paddingMd: 'Padding Medium', paddingLg: 'Padding Large', paddingXl: 'Padding XL',
    marginXs: 'Margin XS', marginSm: 'Margin Small', marginMd: 'Margin Medium', marginLg: 'Margin Large', marginXl: 'Margin XL',
    panelPadding: 'Panel Padding', panelMargin: 'Panel Margin', cardPadding: 'Card Padding', buttonPadding: 'Button Padding', inputPadding: 'Input Padding',
    tableCellPadding: 'Table Cell Padding', fieldPadding: 'Editor Field Padding', headerPadding: 'Header Padding', tabsPadding: 'Tabs Padding',
    sidebarPadding: 'Palette Dock Padding', mainPadding: 'Main Area Padding', footerPadding: 'Footer Padding', sectionMargin: 'Section Margin', buttonRowMargin: 'Button Row Margin',
    fontBody: 'Body Font Stack', fontTitle: 'Title Font Stack', fontMono: 'Mono/Data Font Stack', fontSize: 'Base Font Size',
    fontSizeSm: 'Small Font Size', fontSizeLg: 'Large Font Size', lineHeight: 'Line Height', letterSpacing: 'Letter Spacing'
  });



  const BOX_VAR_DEFS = Object.freeze([
    { base: 'panelPadding', prefix: 'panelPadding', fallback: ['12px', '12px', '12px', '12px'] },
    { base: 'panelMargin', prefix: 'panelMargin', fallback: ['0', '0', '10px', '0'] },
    { base: 'cardPadding', prefix: 'cardPadding', fallback: ['16px', '16px', '16px', '16px'] },
    { base: 'buttonPadding', prefix: 'buttonPadding', fallback: ['8px', '12px', '8px', '12px'] },
    { base: 'inputPadding', prefix: 'inputPadding', fallback: ['6px', '8px', '6px', '8px'] },
    { base: 'tableCellPadding', prefix: 'tableCellPadding', fallback: ['6px', '8px', '6px', '8px'] },
    { base: 'fieldPadding', prefix: 'fieldPadding', fallback: ['8px', '9px', '8px', '9px'] },
    { base: 'headerPadding', prefix: 'headerPadding', fallback: ['20px', '18px', '14px', '18px'] },
    { base: 'tabsPadding', prefix: 'tabsPadding', fallback: ['10px', '14px', '10px', '14px'] },
    { base: 'sidebarPadding', prefix: 'sidebarPadding', fallback: ['10px', '14px', '10px', '14px'] },
    { base: 'mainPadding', prefix: 'mainPadding', fallback: ['16px', '16px', '16px', '16px'] },
    { base: 'footerPadding', prefix: 'footerPadding', fallback: ['12px', '18px', '12px', '18px'] },
    { base: 'sectionMargin', prefix: 'sectionMargin', fallback: ['10px', '0', '2px', '0'] },
    { base: 'buttonRowMargin', prefix: 'buttonRowMargin', fallback: ['10px', '0', '0', '0'] }
  ]);

  function parseCssBox(value, fallback) {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return fallback.slice();
    if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
    if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
    if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
    return [parts[0], parts[1], parts[2], parts[3]];
  }

  function normaliseBoxVars(vars, rawVars) {
    const raw = rawVars && typeof rawVars === 'object' ? rawVars : {};
    const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
    for (const def of BOX_VAR_DEFS) {
      if (!hasOwn(raw, def.base)) continue;
      const sides = parseCssBox(raw[def.base], def.fallback);
      ['Top', 'Right', 'Bottom', 'Left'].forEach((side, idx) => {
        const key = def.prefix + side;
        if (!hasOwn(raw, key)) vars[key] = sides[idx];
      });
    }
  }

  function humanizeKey(key) {
    return String(key)
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, c => c.toUpperCase())
      .replace(/\bXs\b/g, 'XS')
      .replace(/\bSm\b/g, 'SM')
      .replace(/\bMd\b/g, 'MD')
      .replace(/\bLg\b/g, 'LG')
      .replace(/\bXl\b/g, 'XL');
  }

  function labelFor(key) {
    return LABELS[key] || humanizeKey(key);
  }


  function splitCssLength(value, fallbackUnit) {
    const raw = String(value == null ? '' : value).trim();
    const unitFallback = fallbackUnit || uiState.sizeUnit || 'px';
    const match = raw.match(/^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i);
    if (!match) return { raw, number: raw, unit: unitFallback, custom: true };
    return { raw, number: match[1], unit: match[2] || unitFallback, custom: false };
  }

  function joinCssLength(number, unit) {
    const n = String(number == null ? '' : number).trim();
    if (!n) return '';
    const u = String(unit || uiState.sizeUnit || 'px').trim();
    return n + u;
  }

  function commonUnitForKeys(vars, keys) {
    let common = null;
    for (const key of keys) {
      const parsed = splitCssLength(vars[key], uiState.sizeUnit || 'px');
      if (parsed.custom) continue;
      if (!common) common = parsed.unit;
      else if (common !== parsed.unit) return '';
    }
    return common || (uiState.sizeUnit || 'px');
  }

  function applyUnitToKeys(editing, keys, unit) {
    uiState.sizeUnit = unit;
    for (const key of keys) {
      const parsed = splitCssLength(editing.vars[key], unit);
      if (parsed.custom) continue;
      editing.vars[key] = joinCssLength(parsed.number, unit);
    }
    editing.activePreset = 'custom';
  }

  const SCRIPT_TARGETS = Object.freeze([
    { id: 'eggsterminator', name: 'EggsTerminator', short: 'Eggs', selectors: ['.eeh-float', '.eeh-panel', '[id^="eeh-"]', '[class^="eeh-"]', '[class*=" eeh-"]'], defaultAccent: '#a7a7a7' },
    { id: 'landlordTenant', name: 'Landlord - Tenant', short: 'Landlord', selectors: ['.tlt-shell', '.tlt-panel', '[id^="tlt-"]', '[class^="tlt-"]', '[class*=" tlt-"]'], defaultAccent: '#2f8b96' },
    { id: 'bountyLedger', name: "MoDuL's Bounty Ledger", short: 'Bounty', selectors: ['.mbl-shell', '.mbl-panel', '[id^="mbl-"]', '[class^="mbl-"]', '[class*=" mbl-"]', '.bounty-ledger'], defaultAccent: '#e5bd54' },
    { id: 'customRaceFilter', name: "MoDuL's Custom Race Filter", short: 'Race Filter', selectors: ['.rfAdvWrap', '.rfBtns', '.rfCol', '[class^="rf"]', '[class*=" rf"]'], defaultAccent: '#44f582' },
    { id: 'pitGuru', name: "MoDuL's Pit Guru", short: 'Pit Guru', selectors: ['#mpgPanel', '#mpgRoot', '[id^="mpg"]', '[class^="mpg"]', '[class*=" mpg"]'], defaultAccent: '#ffc83d' },
    { id: 'raceTrackCounter', name: "MoDuL's Race Track Counter", short: 'Track Counter', selectors: ['.mrtc-shell', '.mrtc-panel', '[id^="mrtc-"]', '[class^="mrtc-"]', '[class*=" mrtc-"]', '.race-track-counter'], defaultAccent: '#72d9ff' },
    { id: 'racingThemeChanger', name: "MoDuL's Racing Theme Changer", short: 'Theme Changer', selectors: ['.theme-toggle', '.theme-slider-name', '.theme-slider-value', '.ttl'], defaultAccent: '#9fd42f' },
    { id: 'smuggler', name: "MoDuL's Smuggler", short: 'Smuggler', selectors: ['.mta-body', '.mta-panel', '[id^="mta-"]', '[class^="mta-"]', '[class*=" mta-"]'], defaultAccent: '#ffde00' },
    { id: 'stockX', name: "MoDuL's Stock-X", short: 'Stock-X', selectors: ['#MoDuL-api-panel', '[id^="MoDuL-"]', '[class^="MoDuL-"]', '[class*=" MoDuL-"]'], defaultAccent: '#34b3ff' },
    { id: 'muggerKarma', name: 'Mugger Karma', short: 'Karma', selectors: ['.mk-card', '.mk-head', '[id^="mk-"]', '[class^="mk-"]', '[class*=" mk-"]'], defaultAccent: '#d7ff37' },
    { id: 'pythagorasCis', name: 'Pythagoras Project - CIS', short: 'Pythagoras', selectors: ['.pp-panel', '.pp-card', '.pp-alert', '[id^="pp-"]', '[class^="pp-"]', '[class*=" pp-"]'], defaultAccent: '#d8a545' },
    { id: 'tornCrack', name: 'Torn Crack / Cracking helper', short: 'Crack', selectors: ['.__crackhelp_panel', '[class^="__crackhelp_"]', '[class*=" __crackhelp_"]'], defaultAccent: '#40ff80' }
  ]);

  const DEFAULT_SCRIPTS = Object.freeze(SCRIPT_TARGETS.reduce((acc, s) => {
    acc[s.id] = { enabled: true, font: true, compatibility: true, accentOverride: '' };
    return acc;
  }, {}));

  const TABS = Object.freeze([
    ['palettes', 'Palettes'],
    ['colours', 'Colours'],
    ['sizes', 'Sizes'],
    ['fonts', 'Fonts'],
    ['scripts', 'Scripts'],
    ['export', 'Import / Export']
  ]);

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function mergeConfig(raw) {
    const cfg = raw && typeof raw === 'object' ? raw : {};
    const rawVars = cfg.vars && typeof cfg.vars === 'object' ? cfg.vars : {};
    const vars = { ...DEFAULT_VARS, ...rawVars };
    normaliseBoxVars(vars, rawVars);
    const scripts = clone(DEFAULT_SCRIPTS);
    Object.entries(cfg.scripts || {}).forEach(([id, value]) => {
      if (scripts[id]) scripts[id] = { ...scripts[id], ...value };
    });
    return {
      version: VERSION,
      enabled: cfg.enabled !== false,
      activePreset: cfg.activePreset || 'shadowWheels',
      vars,
      scripts,
      bridgeEnabled: cfg.bridgeEnabled !== false,
      triggerPosition: cfg.triggerPosition || 'right',
      lastFontPreset: cfg.lastFontPreset || 'system'
    };
  }

  function gmGet(key, fallback) {
    try {
      if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
    } catch (_) { }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function gmSet(key, value) {
    try {
      if (typeof GM_setValue === 'function') return GM_setValue(key, value);
    } catch (_) { }
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { }
  }

  let currentConfig = mergeConfig(gmGet(STORAGE_KEY, null));
  let uiState = { activeTab: 'palettes', sizeUnit: 'px' };

  function kebab(key) {
    return String(key).replace(/[A-Z]/g, m => '-' + m.toLowerCase());
  }

  function cssVarName(key) {
    return CSS_VAR_PREFIX + kebab(key);
  }

  function cssVarRef(key, fallback) {
    const fallbackText = fallback == null || fallback === '' ? '' : ', ' + fallback;
    return `var(${cssVarName(key)}${fallbackText})`;
  }

  function cssVarNameMap() {
    const map = {};
    Object.keys(DEFAULT_VARS).forEach(key => {
      map[key] = cssVarName(key);
    });
    return map;
  }

  function publicScriptTargets() {
    return SCRIPT_TARGETS.map(({ id, name, short, selectors, defaultAccent }) => ({
      id,
      name,
      short,
      selectors: selectors.slice(),
      defaultAccent
    }));
  }

  function themeContract() {
    return {
      contractVersion: THEME_CONTRACT_VERSION,
      scriptVersion: VERSION,
      namespace: 'window.MoDuLHubControlRoom',
      aliasNamespace: 'window.MoDuLHubTheme',
      cssVarPrefix: CSS_VAR_PREFIX,
      storageKey: STORAGE_KEY,
      events: clone(EVENT_NAMES),
      cssVars: cssVarNameMap(),
      aliases: clone(THEME_ALIASES),
      classes: clone(THEME_CLASSES),
      dataAttributes: clone(THEME_DATA),
      dataValues: clone(THEME_DATA_VALUES),
      selectors: clone(THEME_SELECTORS),
      scriptTargets: publicScriptTargets()
    };
  }

  function escAttr(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  function applyAliases(vars) {
    Object.entries(THEME_ALIASES).forEach(([key, names]) => {
      names.forEach(name => root.style.setProperty(name, vars[key]));
    });
  }

  function clearThemeVars() {
    Object.keys(DEFAULT_VARS).forEach(key => root.style.removeProperty(cssVarName(key)));
    Object.values(THEME_ALIASES).flat().forEach(name => root.style.removeProperty(name));
    const contract = document.getElementById(CONTRACT_STYLE_ID);
    if (contract) contract.textContent = '';
    const bridge = document.getElementById(BRIDGE_STYLE_ID);
    if (bridge) bridge.textContent = '';
    root.dataset.modulHubTheme = 'off';
    root.dataset.modulHubEnabled = 'false';
  }

  function updateTriggerState(config) {
    const trigger = document.getElementById(TRIGGER_ID);
    if (!trigger) return;
    const off = mergeConfig(config).enabled === false;
    trigger.classList.toggle('mhc-off', off);
    trigger.title = off ? 'MoDuL Hub Control Room is OFF — click to enable/edit (Alt+M)' : 'Open MoDuL Hub Control Room (Alt+M)';
    const label = trigger.querySelector('.mhc-trigger-label');
    if (label) label.textContent = off ? 'MoDuL Hub Off' : 'MoDuL Hub';
  }

  function applyTheme(config, reason) {
    const cfg = mergeConfig(config);
    if (cfg.enabled === false) {
      clearThemeVars();
      updateTriggerState(cfg);
      dispatchThemeUpdated(cfg, false, reason || 'disabled');
      return;
    }
    Object.entries(cfg.vars).forEach(([key, value]) => {
      if (typeof value === 'string') root.style.setProperty(cssVarName(key), value);
    });
    applyAliases(cfg.vars);
    root.dataset.modulHubTheme = cfg.activePreset || 'custom';
    root.dataset.modulHubEnabled = 'true';
    buildContractStyle(cfg);
    buildBridgeStyle(cfg);
    updateTriggerState(cfg);
    dispatchThemeUpdated(cfg, true, reason || 'apply');
  }

  function createStyleNode(id) {
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement('style');
      node.id = id;
      (document.head || document.documentElement).appendChild(node);
    }
    return node;
  }

  function selectorList(target) {
    return target.selectors.join(',\n');
  }

  function selectorDesc(target, suffix) {
    return target.selectors.map(sel => `${sel} ${suffix}`).join(',\n');
  }

  function selectorSelf(target, suffix) {
    return target.selectors.map(sel => `${sel}${suffix}`).join(',\n');
  }

  function selectorDescAndSelf(target, suffix) {
    return selectorDesc(target, suffix) + ',\n' + selectorSelf(target, suffix);
  }

  function selectorDescAll(target, suffixes) {
    return suffixes.map(suffix => selectorDesc(target, suffix)).join(',\n');
  }

  function selectorDescAndSelfAll(target, suffixes) {
    return suffixes.map(suffix => selectorDescAndSelf(target, suffix)).join(',\n');
  }

  function dispatchThemeUpdated(cfg, enabled, reason) {
    window.dispatchEvent(new CustomEvent(EVENT_NAMES.updated, {
      detail: {
        enabled,
        vars: clone(cfg.vars),
        scripts: clone(cfg.scripts),
        reason: reason || (enabled ? 'apply' : 'disabled'),
        contractVersion: THEME_CONTRACT_VERSION
      }
    }));
  }

  function dispatchThemeReady(reason) {
    window.dispatchEvent(new CustomEvent(EVENT_NAMES.ready, {
      detail: {
        version: VERSION,
        contractVersion: THEME_CONTRACT_VERSION,
        reason: reason || 'ready',
        config: clone(currentConfig)
      }
    }));
  }

  function buildContractStyle() {
    const node = createStyleNode(CONTRACT_STYLE_ID);
    node.textContent = `
/* MoDuL Hub canonical contract selectors. New scripts should use these classes or data attributes. */
:where(.${THEME_CLASSES.root}, [data-mh-component="root"]) {
  color-scheme: dark;
  font-family: var(--mh-font-body, Arial, Helvetica, sans-serif);
  font-size: var(--mh-font-size, 12px);
  line-height: var(--mh-line-height, 1.35);
  letter-spacing: var(--mh-letter-spacing, 0px);
  color: var(--mh-text, #eaffd6);
}
:where(.${THEME_CLASSES.panel}, .${THEME_CLASSES.card}, [data-mh-component="panel"], [data-mh-component="card"], [data-mh-surface="panel"]) {
  background: var(--mh-panel, #101807);
  color: var(--mh-text, #eaffd6);
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  border-radius: var(--mh-radius-md, 10px);
  box-shadow: var(--mh-shadow, none);
  padding: var(--mh-panel-padding-top, 12px) var(--mh-panel-padding-right, 12px) var(--mh-panel-padding-bottom, 12px) var(--mh-panel-padding-left, 12px);
  margin: var(--mh-panel-margin-top, 0) var(--mh-panel-margin-right, 0) var(--mh-panel-margin-bottom, 10px) var(--mh-panel-margin-left, 0);
}
:where(.${THEME_CLASSES.elevated}, [data-mh-surface="elevated"]) {
  background: var(--mh-elevated, #1d2b11);
  box-shadow: var(--mh-shadow, none);
}
:where(.${THEME_CLASSES.toolbar}, [data-mh-component="toolbar"]) {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mh-space-sm, 8px);
  align-items: center;
  background: var(--mh-bg-soft, #0b1508);
  color: var(--mh-text, #eaffd6);
}
:where(.${THEME_CLASSES.control}, .${THEME_CLASSES.input}, .${THEME_CLASSES.select}, [data-mh-component="control"], [data-mh-component="field"]) {
  font-family: var(--mh-font-body, Arial, Helvetica, sans-serif);
  background: var(--mh-control, #17250f);
  color: var(--mh-text, #eaffd6);
  border: 1px solid var(--mh-border, #8fbf26);
  border-radius: var(--mh-radius-sm, 6px);
  padding: var(--mh-input-padding-top, 6px) var(--mh-input-padding-right, 8px) var(--mh-input-padding-bottom, 6px) var(--mh-input-padding-left, 8px);
}
:where(.${THEME_CLASSES.button}, [data-mh-component="button"]) {
  font-family: var(--mh-font-body, Arial, Helvetica, sans-serif);
  background: var(--mh-control, #17250f);
  color: var(--mh-text, #eaffd6);
  border: 1px solid var(--mh-border, #8fbf26);
  border-radius: var(--mh-radius-sm, 6px);
  padding: var(--mh-button-padding-top, 8px) var(--mh-button-padding-right, 12px) var(--mh-button-padding-bottom, 8px) var(--mh-button-padding-left, 12px);
}
:where(.${THEME_CLASSES.button}, [data-mh-component="button"]):hover {
  background: var(--mh-control-hover, #203414);
  border-color: var(--mh-script-accent, var(--mh-accent, #9fd42f));
}
:where(.${THEME_CLASSES.table}, [data-mh-component="table"]) {
  width: 100%;
  border-collapse: collapse;
  background: var(--mh-table-bg, #0b140b);
  color: var(--mh-text, #eaffd6);
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
}
:where(.${THEME_CLASSES.table} th, .${THEME_CLASSES.table} thead, .${THEME_CLASSES.tableHead}, [data-mh-table-part="head"]) {
  background: var(--mh-table-head, #13200d);
  color: var(--mh-text, #eaffd6);
}
:where(.${THEME_CLASSES.table} td, .${THEME_CLASSES.table} tbody, .${THEME_CLASSES.tableBody}, [data-mh-table-part="body"]) {
  background: var(--mh-table-bg, #0b140b);
  color: var(--mh-text, #eaffd6);
}
:where(.${THEME_CLASSES.table} td, .${THEME_CLASSES.table} th, .${THEME_CLASSES.tableCell}, [data-mh-table-part="cell"]) {
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  padding: var(--mh-table-cell-padding-top, 6px) var(--mh-table-cell-padding-right, 8px) var(--mh-table-cell-padding-bottom, 6px) var(--mh-table-cell-padding-left, 8px);
}
:where(.${THEME_CLASSES.accent}, [data-mh-state="accent"]) { color: var(--mh-script-accent, var(--mh-accent, #9fd42f)); }
:where(.${THEME_CLASSES.muted}, [data-mh-state="muted"]) { color: var(--mh-text-muted, #8fa36d); }
:where(.${THEME_CLASSES.success}, [data-mh-state="success"]) { color: var(--mh-success, #44f582); }
:where(.${THEME_CLASSES.warning}, [data-mh-state="warning"]) { color: var(--mh-warning, #e5bd54); }
:where(.${THEME_CLASSES.danger}, [data-mh-state="danger"]) { color: var(--mh-danger, #ff5c5c); }
:where(.${THEME_CLASSES.info}, [data-mh-state="info"]) { color: var(--mh-info, #72d9ff); }
`;
  }

  function buildBridgeStyle(config) {
    const node = createStyleNode(BRIDGE_STYLE_ID);
    if (!config.bridgeEnabled) {
      node.textContent = '';
      return;
    }

    const chunks = [];
    chunks.push(`/* MoDuL Hub compatibility bridge. Best effort for current hardcoded styles. */\n`);
    chunks.push(`:root {
  color-scheme: dark;
}\n`);

    for (const target of SCRIPT_TARGETS) {
      const settings = config.scripts[target.id] || DEFAULT_SCRIPTS[target.id] || { enabled: true, font: true, compatibility: true, accentOverride: '' };
      if (!settings.enabled) continue;
      const sel = selectorList(target);
      const accent = settings.accentOverride || target.defaultAccent || 'var(--mh-accent)';

      chunks.push(`
/* ${target.name} */
${sel} {
  --mh-script-accent: ${accent};
  --mh-local-accent: ${accent};
}`);

      if (settings.font) {
        chunks.push(`
${sel} {
  font-family: var(--mh-font-body, Arial, Helvetica, sans-serif) !important;
  font-size: var(--mh-font-size, 12px);
  line-height: var(--mh-line-height, 1.35);
  letter-spacing: var(--mh-letter-spacing, 0px);
}`);
      }

      if (settings.compatibility) {
        chunks.push(`
${selectorDescAndSelfAll(target, THEME_SELECTORS.panel)} {
  background: var(--mh-panel, #101807) !important;
  color: var(--mh-text, #eaffd6) !important;
  border-color: var(--mh-border-soft, rgba(159,212,47,.32)) !important;
  border-radius: var(--mh-radius-md, 10px);
  box-shadow: var(--mh-shadow, none);
  padding: var(--mh-panel-padding-top, 12px) var(--mh-panel-padding-right, 12px) var(--mh-panel-padding-bottom, 12px) var(--mh-panel-padding-left, 12px);
  margin: var(--mh-panel-margin-top, 0) var(--mh-panel-margin-right, 0) var(--mh-panel-margin-bottom, 10px) var(--mh-panel-margin-left, 0);
}
${selectorDescAndSelfAll(target, THEME_SELECTORS.control)} {
  font-family: var(--mh-font-body, Arial, Helvetica, sans-serif) !important;
  background: var(--mh-control, #17250f) !important;
  color: var(--mh-text, #eaffd6) !important;
  border-color: var(--mh-border, #8fbf26) !important;
  border-radius: var(--mh-radius-sm, 6px) !important;
  padding: var(--mh-input-padding-top, 6px) var(--mh-input-padding-right, 8px) var(--mh-input-padding-bottom, 6px) var(--mh-input-padding-left, 8px) !important;
}
${selectorDescAndSelfAll(target, THEME_SELECTORS.button)} {
  padding: var(--mh-button-padding-top, 8px) var(--mh-button-padding-right, 12px) var(--mh-button-padding-bottom, 8px) var(--mh-button-padding-left, 12px) !important;
}
${selectorDescAndSelfAll(target, THEME_SELECTORS.select)},
${selectorDesc(target, 'select option')},
${selectorDesc(target, 'select optgroup')} {
  color-scheme: dark !important;
  background: var(--mh-panel2, #16230d) !important;
  color: var(--mh-text, #eaffd6) !important;
}
${selectorDesc(target, 'select option:hover')},
${selectorDesc(target, 'select option:focus')},
${selectorDesc(target, 'select option:checked')} {
  background: var(--mh-control-hover, #203414) !important;
  color: var(--mh-text, #eaffd6) !important;
}

${selectorDescAndSelfAll(target, THEME_SELECTORS.button.map(sel => `${sel}:hover`))} {
  background: var(--mh-control-hover, #203414) !important;
  border-color: var(--mh-script-accent, var(--mh-accent, #9fd42f)) !important;
}
${selectorDescAndSelfAll(target, THEME_SELECTORS.table)} {
  border-color: var(--mh-border-soft, rgba(159,212,47,.32)) !important;
}
${selectorDescAndSelfAll(target, THEME_SELECTORS.tableHead)} {
  background: var(--mh-table-head, #13200d) !important;
  color: var(--mh-text, #eaffd6) !important;
}
${selectorDescAndSelfAll(target, THEME_SELECTORS.tableBody)} {
  background-color: var(--mh-table-bg, #0b140b);
  color: var(--mh-text, #eaffd6);
}
${selectorDescAndSelfAll(target, THEME_SELECTORS.tableCell)} {
  padding: var(--mh-table-cell-padding-top, 6px) var(--mh-table-cell-padding-right, 8px) var(--mh-table-cell-padding-bottom, 6px) var(--mh-table-cell-padding-left, 8px);
}
${selectorDescAndSelfAll(target, THEME_SELECTORS.accent)} {
  color: var(--mh-script-accent, var(--mh-accent, #9fd42f)) !important;
}
${selectorDescAndSelfAll(target, THEME_SELECTORS.muted)} {
  color: var(--mh-text-muted, #8fa36d) !important;
}
${selectorDescAndSelfAll(target, THEME_SELECTORS.danger)} {
  color: var(--mh-danger, #ff5c5c) !important;
}
${selectorDescAndSelfAll(target, THEME_SELECTORS.success)} {
  color: var(--mh-success, #44f582) !important;
}`);
      }
    }

    node.textContent = chunks.join('\n');
  }

  function buildUiStyle() {
    const node = createStyleNode(STYLE_ID);
    node.textContent = `
#${TRIGGER_ID} {
  position: fixed;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 999998;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: var(--mh-button-padding-top, 8px) var(--mh-button-padding-right, 12px) var(--mh-button-padding-bottom, 8px) var(--mh-button-padding-left, 12px);
  border: 1px solid var(--mh-border, #8fbf26);
  border-radius: 999px;
  background: color-mix(in srgb, var(--mh-panel, #101807) 92%, transparent);
  color: var(--mh-text, #eaffd6);
  box-shadow: var(--mh-shadow, 0 18px 45px rgba(0,0,0,.55));
  font-family: var(--mh-font-body, Arial, Helvetica, sans-serif);
  font-size: 12px;
  cursor: pointer;
  backdrop-filter: blur(8px);
}
#${TRIGGER_ID}:hover { background: var(--mh-control-hover, #203414); border-color: var(--mh-accent, #9fd42f); }
#${TRIGGER_ID} .mhc-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--mh-accent, #9fd42f); box-shadow: 0 0 10px color-mix(in srgb, var(--mh-accent, #9fd42f) 80%, transparent); }
#${TRIGGER_ID}.mhc-off {
  border-color: var(--mh-danger, #ff5c5c);
  color: var(--mh-text-muted, #8fa36d);
  opacity: .86;
}
#${TRIGGER_ID}.mhc-off .mhc-dot {
  background: var(--mh-danger, #ff5c5c);
  box-shadow: 0 0 10px color-mix(in srgb, var(--mh-danger, #ff5c5c) 80%, transparent);
}
#${OVERLAY_ID}, #${OVERLAY_ID} * { box-sizing: border-box; }
#${OVERLAY_ID} {
  scrollbar-color: var(--mh-accent, #9fd42f) var(--mh-bg-soft, #0b1508);
  scrollbar-width: thin;
  color-scheme: dark;
}
#${OVERLAY_ID} * {
  scrollbar-color: var(--mh-border, #8fbf26) var(--mh-bg-soft, #0b1508);
  scrollbar-width: thin;
}
#${OVERLAY_ID} ::-webkit-scrollbar { width: 9px; height: 9px; }
#${OVERLAY_ID} ::-webkit-scrollbar-track {
  background: var(--mh-bg-soft, #0b1508);
  border-radius: var(--mh-radius-md, 10px);
}
#${OVERLAY_ID} ::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, var(--mh-border-strong, #9fd42f), var(--mh-border, #8fbf26));
  border: 2px solid var(--mh-bg-soft, #0b1508);
  border-radius: var(--mh-radius-md, 10px);
}
#${OVERLAY_ID} ::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, var(--mh-accent, #9fd42f), var(--mh-accent-2, #44f582));
}
#${OVERLAY_ID} ::-webkit-scrollbar-corner { background: var(--mh-bg-soft, #0b1508); }
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--mh-padding-lg, 16px);
  background:
    radial-gradient(circle at 18% 10%, color-mix(in srgb, var(--mh-accent, #9fd42f) 14%, transparent), transparent 26%),
    radial-gradient(circle at 80% 85%, color-mix(in srgb, var(--mh-info, #72d9ff) 10%, transparent), transparent 24%),
    var(--mh-overlay, rgba(0,0,0,.72));
  color: var(--mh-text, #eaffd6);
  font-family: var(--mh-font-body, Arial, Helvetica, sans-serif);
  font-size: var(--mh-font-size, 12px);
  line-height: var(--mh-line-height, 1.35);
}
.mhc-shell {
  width: min(1080px, 96vw);
  height: min(720px, 94vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  border-radius: var(--mh-radius-xl, 18px);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--mh-panel, #101807) 96%, var(--mh-accent, #9fd42f) 4%), var(--mh-bg, #071107) 55%),
    var(--mh-bg, #071107);
  box-shadow: var(--mh-shadow, 0 18px 45px rgba(0,0,0,.55));
}
/* v2.4: removed the permanent coloured top border. The shell uses normal themed borders only. */
.mhc-topbar { display:none; }
.mhc-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--mh-space-md, 12px);
  padding: var(--mh-header-padding-top, 20px) var(--mh-header-padding-right, 18px) var(--mh-header-padding-bottom, 14px) var(--mh-header-padding-left, 18px);
  background: linear-gradient(90deg, var(--mh-bg-soft, #0b1508), color-mix(in srgb, var(--mh-panel, #101807) 78%, var(--mh-accent, #9fd42f) 6%));
  border-bottom: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
}
.mhc-brand { display:flex; align-items:center; gap: var(--mh-space-md, 12px); min-width: 0; }
.mhc-logo {
  width: 42px; height: 42px; flex: 0 0 42px;
  border-radius: 13px;
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--mh-accent, #9fd42f) 24%, var(--mh-panel2, #16230d)), var(--mh-panel2, #16230d));
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mh-text, #eaffd6) 6%, transparent);
  overflow:hidden;
}
.mhc-logo strong { font: 900 15px/1 var(--mh-font-title, Arial, Helvetica, sans-serif); color: var(--mh-text, #eaffd6); letter-spacing:.2px; }
.mhc-logo small { margin-top:2px; font: 700 8px/1 var(--mh-font-mono, Consolas, monospace); color: var(--mh-text-muted, #8fa36d); letter-spacing:1px; }
.mhc-logo span { display:none; }
.mhc-title-wrap { min-width:0; padding-top: var(--mh-padding-xs, 4px); }
.mhc-title {
  margin: 0;
  color: var(--mh-text, #eaffd6);
  font-family: var(--mh-font-title, Arial, Helvetica, sans-serif);
  font-size: calc(var(--mh-font-size-lg, 14px) + 1px);
  line-height: 1.18;
  font-weight: 900;
  letter-spacing: .5px;
  text-transform: none;
}
.mhc-subtitle {
  margin-top: 4px;
  color: var(--mh-text-muted, #8fa36d);
  font-family: var(--mh-font-mono, Consolas, monospace);
  font-size: var(--mh-font-size-sm, 11px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mhc-head-actions { display:flex; align-items:center; gap:8px; }
.mhc-pill {
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  border-radius: 999px;
  padding: 5px 9px;
  color: var(--mh-text-soft, #cfe8a8);
  background: var(--mh-panel, #101807);
  font-family: var(--mh-font-mono, Consolas, monospace);
  font-size: 10px;
}
.mhc-master-switch {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 8px;
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  border-radius: 999px;
  background: var(--mh-panel, #101807);
  color: var(--mh-text-soft, #cfe8a8);
  font-family: var(--mh-font-mono, Consolas, monospace);
  font-size: 10px;
  cursor: pointer;
  user-select: none;
}
.mhc-master-switch input { position:absolute; opacity:0; pointer-events:none; }
.mhc-master-track {
  width: 31px;
  height: 16px;
  border-radius: 999px;
  background: var(--mh-danger, #ff5c5c);
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  position: relative;
  transition: background .15s, border-color .15s;
}
.mhc-master-track::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  top: 1px;
  left: 1px;
  border-radius: 50%;
  background: var(--mh-text, #eaffd6);
  transition: transform .15s;
}
.mhc-master-switch input:checked + .mhc-master-track {
  background: var(--mh-success, #44f582);
  border-color: var(--mh-success, #44f582);
}
.mhc-master-switch input:checked + .mhc-master-track::after { transform: translateX(15px); }
#${OVERLAY_ID}.mhc-disabled .mhc-status-dot { background: var(--mh-danger, #ff5c5c); }
.mhc-icon-btn, .mhc-btn {
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  background: var(--mh-control, #17250f);
  color: var(--mh-text, #eaffd6);
  border-radius: var(--mh-radius-sm, 6px);
  cursor: pointer;
  font-family: var(--mh-font-body, Arial, Helvetica, sans-serif);
}
.mhc-icon-btn { width: 32px; height: 32px; font-weight: 900; font-size: 18px; line-height:1; }
.mhc-icon-btn:hover, .mhc-btn:hover { background: var(--mh-control-hover, #203414); border-color: var(--mh-accent, #9fd42f); }
.mhc-tabs {
  display:flex;
  gap: 7px;
  padding: var(--mh-tabs-padding-top, 10px) var(--mh-tabs-padding-right, 14px) var(--mh-tabs-padding-bottom, 10px) var(--mh-tabs-padding-left, 14px);
  background: color-mix(in srgb, var(--mh-bg-soft, #0b1508) 86%, transparent);
  border-bottom:1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  overflow-x:auto;
}
.mhc-tab {
  padding: var(--mh-button-padding-top, 8px) var(--mh-button-padding-right, 12px) var(--mh-button-padding-bottom, 8px) var(--mh-button-padding-left, 12px);
  border: 1px solid transparent;
  border-radius: 999px;
  color: var(--mh-text-muted, #8fa36d);
  background: transparent;
  cursor: pointer;
  letter-spacing: .2px;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}
.mhc-tab:hover { background: var(--mh-control, #17250f); color: var(--mh-text-soft, #cfe8a8); }
.mhc-tab.active {
  color: var(--mh-text, #eaffd6);
  background: linear-gradient(135deg, var(--mh-control, #17250f), color-mix(in srgb, var(--mh-accent, #9fd42f) 18%, var(--mh-control, #17250f)));
  border-color: var(--mh-border, #8fbf26);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--mh-accent, #9fd42f) 10%, transparent);
}
.mhc-body { flex: 1; display:flex; flex-direction:column; min-height: 0; }
.mhc-sidebar {
  width: 100%;
  flex: 0 0 auto;
  overflow-x:auto;
  overflow-y:hidden;
  padding: var(--mh-sidebar-padding-top, 10px) var(--mh-sidebar-padding-right, 14px) var(--mh-sidebar-padding-bottom, 10px) var(--mh-sidebar-padding-left, 14px);
  border-right:0;
  border-bottom:1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  background: color-mix(in srgb, var(--mh-bg, #071107) 80%, var(--mh-panel, #101807));
  display:flex;
  align-items:stretch;
  gap:8px;
}
.mhc-main { flex: 1; overflow:auto; padding: var(--mh-main-padding-top, 16px) var(--mh-main-padding-right, 16px) var(--mh-main-padding-bottom, 16px) var(--mh-main-padding-left, 16px); background: color-mix(in srgb, var(--mh-bg, #071107) 88%, var(--mh-panel, #101807)); }
.mhc-side-label {
  flex: 0 0 auto;
  align-self:center;
  color: var(--mh-text-muted, #8fa36d);
  font-family: var(--mh-font-mono, Consolas, monospace);
  font-size: 10px;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  margin: 0 4px 0 0;
  opacity: .9;
}
.mhc-section-title {
  color: var(--mh-text-muted, #8fa36d);
  font-family: var(--mh-font-mono, Consolas, monospace);
  font-size: 10px;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  margin: var(--mh-margin-sm, 8px) 0 var(--mh-margin-sm, 8px);
}
.mhc-preset {
  position: relative;
  overflow: hidden;
  flex: 0 0 178px;
  min-height: 74px;
  margin: 0;
  padding: var(--mh-card-padding-top, 9px) var(--mh-card-padding-right, 10px) var(--mh-card-padding-bottom, 10px) var(--mh-card-padding-left, 10px);
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  border-radius: var(--mh-radius-md, 10px);
  background: var(--mh-panel, #101807);
  color: var(--mh-text-soft, #cfe8a8);
  text-align: left;
  cursor: pointer;
}
.mhc-preset:hover { border-color: var(--mh-accent, #9fd42f); transform: translateY(-1px); }
.mhc-preset.active {
  border-color: var(--mh-accent, #9fd42f);
  background: linear-gradient(135deg, var(--mh-panel, #101807), color-mix(in srgb, var(--mh-accent, #9fd42f) 10%, var(--mh-panel, #101807)));
  box-shadow: inset 0 -3px 0 var(--mh-accent, #9fd42f);
}
.mhc-preset.active::after {
  content:'✓';
  position:absolute;
  top:7px;
  right:8px;
  width:17px;
  height:17px;
  border-radius:50%;
  display:grid;
  place-items:center;
  font-size:11px;
  background: var(--mh-accent, #9fd42f);
  color: var(--mh-bg, #071107);
  font-weight:900;
}
.mhc-preset-name { font-weight: 900; font-size: 12px; margin-bottom: 3px; color: var(--mh-text, #eaffd6); padding-right:18px; }
.mhc-preset-desc { font-size: 10px; color: var(--mh-text-muted, #8fa36d); margin-bottom: 8px; height: 25px; overflow:hidden; }
.mhc-swatches { display:flex; height: 5px; margin: 0 -10px -10px; }
.mhc-swatch { flex: 1; }
.mhc-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--mh-space-sm, 8px); }
.mhc-grid.one { grid-template-columns: 1fr; }
.mhc-section { grid-column: 1 / -1; display:flex; align-items:center; gap: var(--mh-space-md, 12px); margin: var(--mh-section-margin-top, 10px) var(--mh-section-margin-right, 0) var(--mh-section-margin-bottom, 2px) var(--mh-section-margin-left, 0); flex-wrap: wrap; }
.mhc-section::after { content:''; height: 1px; flex:1 1 80px; background: var(--mh-border-soft, rgba(159,212,47,.32)); }
.mhc-unit-tools { display:flex; align-items:center; gap: 4px; flex-wrap: wrap; margin-left: auto; }
.mhc-unit-label { font-size: 10px; color: var(--mh-text-muted, #8fa36d); font-family: var(--mh-font-mono, Consolas, monospace); margin-right: 2px; }
.mhc-unit-chip {
  min-width: 32px;
  height: 24px;
  padding: 0 7px;
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  border-radius: 999px;
  background: var(--mh-control, #17250f);
  color: var(--mh-text-soft, #cfe8a8);
  font-family: var(--mh-font-mono, Consolas, monospace);
  font-size: 10px;
  cursor: pointer;
}
.mhc-unit-chip:hover { border-color: var(--mh-accent, #9fd42f); color: var(--mh-text, #eaffd6); }
.mhc-unit-chip.active { background: var(--mh-accent, #9fd42f); border-color: var(--mh-accent-2, #44f582); color: var(--mh-bg, #071107); font-weight: 900; }
.mhc-global-unit-panel {
  padding: var(--mh-card-padding-top, 16px) var(--mh-card-padding-right, 16px) var(--mh-card-padding-bottom, 16px) var(--mh-card-padding-left, 16px);
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  border-radius: var(--mh-radius-md, 10px);
  background: color-mix(in srgb, var(--mh-panel, #101807) 88%, var(--mh-bg, #071107));
}
.mhc-global-unit-panel .mhc-unit-tools { margin-left: 0; justify-content: flex-start; }
.mhc-field {
  display:flex;
  align-items:center;
  gap: 8px;
  min-height: 42px;
  padding: var(--mh-field-padding-top, 8px) var(--mh-field-padding-right, 9px) var(--mh-field-padding-bottom, 8px) var(--mh-field-padding-left, 9px);
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  border-radius: var(--mh-radius-md, 10px);
  background: color-mix(in srgb, var(--mh-panel, #101807) 92%, var(--mh-bg, #071107));
}
.mhc-field:hover { border-color: color-mix(in srgb, var(--mh-border, #8fbf26) 70%, transparent); }
.mhc-field-label { flex: 1; min-width: 0; color: var(--mh-text-soft, #cfe8a8); overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.mhc-input, .mhc-select, .mhc-textarea {
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  background: var(--mh-panel2, #16230d);
  color: var(--mh-text, #eaffd6);
  border-radius: var(--mh-radius-sm, 6px);
  padding: var(--mh-input-padding-top, 6px) var(--mh-input-padding-right, 8px) var(--mh-input-padding-bottom, 6px) var(--mh-input-padding-left, 8px);
  font-family: var(--mh-font-mono, Consolas, monospace);
  font-size: 11px;
}
.mhc-input:focus, .mhc-select:focus, .mhc-textarea:focus { outline: 1px solid var(--mh-accent, #9fd42f); }
.mhc-select,
#${OVERLAY_ID} select,
#${OVERLAY_ID} option,
#${OVERLAY_ID} optgroup {
  color-scheme: dark;
}
#${OVERLAY_ID} option,
#${OVERLAY_ID} optgroup {
  background-color: var(--mh-panel2, #16230d) !important;
  color: var(--mh-text, #eaffd6) !important;
}
#${OVERLAY_ID} option:hover,
#${OVERLAY_ID} option:focus,
#${OVERLAY_ID} option:checked {
  background: var(--mh-control-hover, #203414) !important;
  color: var(--mh-text, #eaffd6) !important;
}

.mhc-input.hex { width: 130px; }
.mhc-input.short { width: 90px; }
.mhc-input.long { width: min(420px, 100%); font-family: var(--mh-font-body, Arial, Helvetica, sans-serif); }
.mhc-dimension-control { display:flex; align-items:center; gap: 4px; flex: 0 0 auto; }
.mhc-input.mhc-number { width: 74px; text-align: right; }
.mhc-unit-select { width: 66px; cursor: pointer; }
.mhc-dimension-field .mhc-field-label { max-width: calc(100% - 156px); }
.mhc-color { width: 38px; height: 30px; border: 0; padding: 0; background: transparent; cursor: pointer; }
.mhc-textarea { width: 100%; min-height: 260px; resize: vertical; white-space: pre; }
.mhc-btn-row { display:flex; flex-wrap:wrap; gap: var(--mh-space-sm, 8px); margin: var(--mh-button-row-margin-top, 10px) var(--mh-button-row-margin-right, 0) var(--mh-button-row-margin-bottom, 0) var(--mh-button-row-margin-left, 0); }
.mhc-btn { padding: var(--mh-button-padding-top, 8px) var(--mh-button-padding-right, 12px) var(--mh-button-padding-bottom, 8px) var(--mh-button-padding-left, 12px); font-size: 11px; font-weight: 900; letter-spacing: .25px; }
.mhc-btn.primary { background: var(--mh-accent, #9fd42f); border-color: var(--mh-accent-2, #44f582); color: var(--mh-bg, #061006); }
.mhc-btn.danger { border-color: var(--mh-danger, #ff5c5c); color: var(--mh-danger, #ff5c5c); }
.mhc-foot {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;
  padding: var(--mh-footer-padding-top, 12px) var(--mh-footer-padding-right, 18px) var(--mh-footer-padding-bottom, 12px) var(--mh-footer-padding-left, 18px);
  border-top: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  background: var(--mh-bg-soft, #0b1508);
}
.mhc-status { display:flex; align-items:center; gap:8px; color: var(--mh-text-muted, #8fa36d); font-family: var(--mh-font-mono, Consolas, monospace); font-size: 11px; }
.mhc-status-dot { width: 8px; height:8px; border-radius:50%; background: var(--mh-success, #44f582); }
.mhc-status.dirty .mhc-status-dot { background: var(--mh-warning, #e5bd54); }
.mhc-toast { position:absolute; right: 28px; bottom: 74px; opacity:0; pointer-events:none; transition: opacity .2s, transform .2s; transform: translateY(4px); padding: var(--mh-card-padding-top, 16px) var(--mh-card-padding-right, 16px) var(--mh-card-padding-bottom, 16px) var(--mh-card-padding-left, 16px); border:1px solid var(--mh-success, #44f582); border-radius: var(--mh-radius-md, 10px); background: var(--mh-panel, #101807); color: var(--mh-success, #44f582); font-family: var(--mh-font-mono, Consolas, monospace); }
.mhc-toast.show { opacity:1; transform: translateY(0); }
.mhc-preview-card {
  margin-top: 0;
  padding: var(--mh-card-padding-top, 16px) var(--mh-card-padding-right, 16px) var(--mh-card-padding-bottom, 16px) var(--mh-card-padding-left, 16px);
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  border-radius: var(--mh-radius-lg, 14px);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--mh-panel, #101807) 94%, var(--mh-accent, #9fd42f) 6%), var(--mh-panel2, #16230d));
  box-shadow: var(--mh-shadow, none);
}
.mhc-preview-title { font-family: var(--mh-font-title, Arial, Helvetica, sans-serif); font-size: calc(var(--mh-font-size-lg, 14px) + 1px); font-weight: 900; color: var(--mh-accent, #9fd42f); margin-bottom: var(--mh-margin-sm, 8px); }
.mhc-preview-body { font-family: var(--mh-font-body, Arial, Helvetica, sans-serif); font-size: var(--mh-font-size, 12px); line-height: var(--mh-line-height, 1.35); letter-spacing: var(--mh-letter-spacing, 0px); color: var(--mh-text, #eaffd6); }
.mhc-preview-mono { margin-top: var(--mh-margin-md, 12px); font-family: var(--mh-font-mono, Consolas, monospace); font-size: var(--mh-font-size-sm, 11px); color: var(--mh-info, #72d9ff); }
.mhc-dashboard {
  display:grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(230px, .75fr);
  gap: 12px;
}
.mhc-mini-grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--mh-space-sm, 8px); margin-top: var(--mh-margin-md, 12px); }
.mhc-mini-card {
  padding: var(--mh-panel-padding-top, 12px) var(--mh-panel-padding-right, 12px) var(--mh-panel-padding-bottom, 12px) var(--mh-panel-padding-left, 12px);
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  border-radius: var(--mh-radius-md, 10px);
  background: var(--mh-panel, #101807);
}
.mhc-mini-label { color: var(--mh-text-muted, #8fa36d); font-family: var(--mh-font-mono, Consolas, monospace); font-size:10px; margin-bottom:4px; }
.mhc-mini-value { color: var(--mh-text, #eaffd6); font-weight:900; }
.mhc-script-row {
  display:grid;
  grid-template-columns: minmax(170px, 1fr) auto auto minmax(105px, 130px);
  align-items:center;
  gap: 8px;
  padding: var(--mh-panel-padding-top, 12px) var(--mh-panel-padding-right, 12px) var(--mh-panel-padding-bottom, 12px) var(--mh-panel-padding-left, 12px);
  border: 1px solid var(--mh-border-soft, rgba(159,212,47,.32));
  border-radius: var(--mh-radius-md, 10px);
  background: var(--mh-panel, #101807);
  margin-bottom: var(--mh-margin-sm, 8px);
}
.mhc-script-name { font-weight: 900; color: var(--mh-text, #eaffd6); }
.mhc-script-detected { font-size: 10px; color: var(--mh-text-muted, #8fa36d); font-family: var(--mh-font-mono, Consolas, monospace); }
.mhc-switch { display:flex; align-items:center; gap:5px; color: var(--mh-text-soft, #cfe8a8); font-size: 11px; white-space:nowrap; }
.mhc-switch input { accent-color: var(--mh-accent, #9fd42f); }
.mhc-note { color: var(--mh-text-muted, #8fa36d); margin: 0 0 var(--mh-margin-md, 12px); }
@media (max-width: 860px) {
  #${OVERLAY_ID} { padding: var(--mh-padding-sm, 8px); }
  .mhc-shell { height: 96vh; }
  .mhc-head { grid-template-columns: 1fr; }
  .mhc-head-actions { justify-content:flex-start; flex-wrap:wrap; }
  .mhc-grid { grid-template-columns: 1fr; }
  .mhc-dashboard { grid-template-columns: 1fr; }
  .mhc-mini-grid { grid-template-columns: 1fr; }
  .mhc-script-row { grid-template-columns: 1fr; }
  .mhc-pill { display:none; }
}
`;
  }

  function ensureReady(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  function ensureTrigger() {
    if (document.getElementById(TRIGGER_ID)) return;
    const btn = document.createElement('button');
    btn.id = TRIGGER_ID;
    btn.type = 'button';
    btn.title = 'Open MoDuL Hub Control Room (Alt+M)';
    btn.innerHTML = '<span class="mhc-dot"></span><span class="mhc-trigger-label">MoDuL Hub</span>';
    btn.addEventListener('click', openUI, true);
    document.body.appendChild(btn);
    updateTriggerState(currentConfig);
  }

  function showToast(overlay, message) {
    const toast = overlay.querySelector('.mhc-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function setDirty(overlay, dirty, message) {
    const status = overlay.querySelector('.mhc-status');
    const label = overlay.querySelector('.mhc-status-label');
    if (status) status.classList.toggle('dirty', !!dirty);
    if (label) label.textContent = message || (dirty ? 'Unsaved changes' : 'No unsaved changes');
  }

  function activePresetObject(config) {
    return PRESETS.find(p => p.id === config.activePreset) || null;
  }

  function detectTarget(target) {
    try { return target.selectors.some(sel => document.querySelector(sel)); }
    catch (_) { return false; }
  }

  function renderSidebar(overlay, editing) {
    const sidebar = overlay.querySelector('.mhc-sidebar');
    sidebar.innerHTML = '<div class="mhc-side-label">Palettes</div>';
    for (const preset of PRESETS) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'mhc-preset' + (editing.activePreset === preset.id ? ' active' : '');
      card.innerHTML = `
        <div class="mhc-preset-name">${escAttr(preset.name)}</div>
        <div class="mhc-preset-desc">${escAttr(preset.desc)}</div>
        <div class="mhc-swatches">${preset.swatches.map(c => `<span class="mhc-swatch" style="background:${escAttr(c)}"></span>`).join('')}</div>`;
      card.addEventListener('click', () => {
        editing.activePreset = preset.id;
        editing.vars = { ...editing.vars, ...preset.vars };
        applyTheme(editing, 'preview-preset');
        renderAll(overlay, editing);
        setDirty(overlay, true);
      });
      sidebar.appendChild(card);
    }
  }

  function makeUnitChips(editing, keys, overlay, label) {
    const tools = document.createElement('div');
    tools.className = 'mhc-unit-tools';
    const common = commonUnitForKeys(editing.vars, keys);
    tools.innerHTML = `<span class="mhc-unit-label">${escAttr(label || 'Unit')}</span>`;
    for (const unit of DIMENSION_UNITS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mhc-unit-chip' + (common === unit ? ' active' : '');
      btn.textContent = unit;
      btn.title = `Apply ${unit} to this ${label || 'group'}`;
      btn.addEventListener('click', () => {
        applyUnitToKeys(editing, keys, unit);
        applyTheme(editing, 'preview-unit-' + unit);
        renderAll(overlay, editing);
        setDirty(overlay, true, `Applied ${unit} units`);
      });
      tools.appendChild(btn);
    }
    return tools;
  }

  function section(title, tools) {
    const el = document.createElement('div');
    el.className = 'mhc-section';
    const titleEl = document.createElement('div');
    titleEl.className = 'mhc-section-title';
    titleEl.textContent = title;
    el.appendChild(titleEl);
    if (tools) el.appendChild(tools);
    return el;
  }

  function createColourField(editing, key, overlay) {
    const row = document.createElement('label');
    row.className = 'mhc-field';
    const val = editing.vars[key] || '';
    const colorUsable = /^#[0-9a-f]{3,8}$/i.test(val);
    row.innerHTML = `<span class="mhc-field-label">${escAttr(labelFor(key))}</span>`;
    if (colorUsable) {
      const c = document.createElement('input');
      c.type = 'color';
      c.className = 'mhc-color';
      c.value = val.slice(0, 7);
      c.addEventListener('input', () => {
        editing.vars[key] = c.value;
        text.value = c.value;
        editing.activePreset = 'custom';
        applyTheme(editing, 'preview-colour');
        setDirty(overlay, true);
        renderSidebar(overlay, editing);
      });
      row.appendChild(c);
    }
    const text = document.createElement('input');
    text.className = 'mhc-input hex';
    text.value = val;
    text.addEventListener('input', () => {
      editing.vars[key] = text.value;
      editing.activePreset = 'custom';
      applyTheme(editing, 'preview-colour');
      setDirty(overlay, true);
      renderSidebar(overlay, editing);
    });
    row.appendChild(text);
    return row;
  }

  function createTextField(editing, key, overlay, className) {
    const row = document.createElement('label');
    row.className = 'mhc-field';
    row.innerHTML = `<span class="mhc-field-label">${escAttr(labelFor(key))}</span>`;
    const input = document.createElement('input');
    input.className = 'mhc-input ' + (className || 'short');
    input.value = editing.vars[key] || '';
    input.addEventListener('input', () => {
      editing.vars[key] = input.value;
      editing.activePreset = editing.activePreset === 'custom' ? 'custom' : editing.activePreset;
      applyTheme(editing, 'preview-text');
      setDirty(overlay, true);
    });
    row.appendChild(input);
    return row;
  }

  function createDimensionField(editing, key, overlay) {
    const row = document.createElement('label');
    row.className = 'mhc-field mhc-dimension-field';
    row.innerHTML = `<span class="mhc-field-label">${escAttr(labelFor(key))}</span>`;

    const parsed = splitCssLength(editing.vars[key], uiState.sizeUnit || 'px');

    if (parsed.custom) {
      const input = document.createElement('input');
      input.className = 'mhc-input long';
      input.value = editing.vars[key] || '';
      input.title = 'Custom CSS value, for example calc(100% - 8px).';
      input.addEventListener('input', () => {
        editing.vars[key] = input.value;
        editing.activePreset = 'custom';
        applyTheme(editing, 'preview-custom-size');
        setDirty(overlay, true);
      });
      row.appendChild(input);
      return row;
    }

    const control = document.createElement('span');
    control.className = 'mhc-dimension-control';

    const number = document.createElement('input');
    number.type = 'number';
    number.step = '0.5';
    number.className = 'mhc-input mhc-number';
    number.value = parsed.number;

    const unit = document.createElement('select');
    unit.className = 'mhc-select mhc-unit-select';
    unit.innerHTML = DIMENSION_UNITS.map(u => `<option value="${escAttr(u)}" ${parsed.unit === u ? 'selected' : ''}>${escAttr(u)}</option>`).join('');

    const update = () => {
      uiState.sizeUnit = unit.value;
      editing.vars[key] = joinCssLength(number.value, unit.value);
      editing.activePreset = 'custom';
      applyTheme(editing, 'preview-dimension');
      setDirty(overlay, true);
    };

    number.addEventListener('input', update);
    unit.addEventListener('change', update);

    control.appendChild(number);
    control.appendChild(unit);
    row.appendChild(control);
    return row;
  }

  function renderFieldsTab(overlay, editing, groups, mode) {
    const main = overlay.querySelector('.mhc-main');
    const wrap = document.createElement('div');
    wrap.className = 'mhc-grid one';

    if (mode === 'size') {
      const note = document.createElement('p');
      note.className = 'mhc-note';
      note.textContent = 'Use the number boxes and unit selectors instead of typing px/em/% manually. The global and group unit chips change the suffix while keeping the current numbers, so use them as a quick unit brush.';
      wrap.appendChild(note);

      const global = document.createElement('div');
      global.className = 'mhc-global-unit-panel';
      global.appendChild(makeUnitChips(editing, allSizeKeys(), overlay, 'Global size unit'));
      wrap.appendChild(global);
    }

    const grid = document.createElement('div');
    grid.className = 'mhc-grid';
    for (const [title, keys] of groups) {
      grid.appendChild(section(title, mode === 'size' ? makeUnitChips(editing, keys, overlay, 'Group unit') : null));
      for (const key of keys) {
        if (mode === 'colour') grid.appendChild(createColourField(editing, key, overlay));
        else if (mode === 'size') grid.appendChild(createDimensionField(editing, key, overlay));
        else grid.appendChild(createTextField(editing, key, overlay, mode === 'font' && key.startsWith('font') ? 'long' : 'short'));
      }
    }
    wrap.appendChild(grid);
    main.replaceChildren(wrap);
  }

  function renderPalettesTab(overlay, editing) {
    const main = overlay.querySelector('.mhc-main');
    const preset = activePresetObject(editing);
    const dashboard = document.createElement('div');
    dashboard.className = 'mhc-dashboard';

    const hero = document.createElement('div');
    hero.className = 'mhc-preview-card';
    hero.innerHTML = `
      <div class="mhc-preview-title">${escAttr(preset ? preset.name : 'Custom Theme')}</div>
      <div class="mhc-preview-body">
        This is the MoDuL Hub source of truth. Refactored scripts should use the exported contract, canonical <b>mh-*</b> identifiers, and <b>--mh-*</b> variables.
        Older hardcoded scripts are handled by the compatibility bridge.
      </div>
      <div class="mhc-mini-grid">
        <div class="mhc-mini-card"><div class="mhc-mini-label">Preset</div><div class="mhc-mini-value">${escAttr(editing.activePreset || 'custom')}</div></div>
        <div class="mhc-mini-card"><div class="mhc-mini-label">Bridge</div><div class="mhc-mini-value">${editing.bridgeEnabled !== false ? 'Enabled' : 'Disabled'}</div></div>
        <div class="mhc-mini-card"><div class="mhc-mini-label">Master</div><div class="mhc-mini-value">${editing.enabled !== false ? 'On' : 'Off'}</div></div>
      </div>
      <div class="mhc-btn-row">
        <button class="mhc-btn primary" data-jump="colours">Tune Colours</button>
        <button class="mhc-btn" data-jump="fonts">Fonts</button>
        <button class="mhc-btn" data-jump="scripts">Script Controls</button>
        <button class="mhc-btn" data-jump="export">Import / Export</button>
      </div>`;

    const sample = document.createElement('div');
    sample.className = 'mhc-preview-card';
    sample.innerHTML = `
      <div class="mhc-preview-title">Live Script Sample</div>
      <div class="mhc-preview-body">
        <b>Panel:</b> ${escAttr(editing.vars.panel)}<br>
        <b>Text:</b> ${escAttr(editing.vars.text)}<br>
        <b>Accent:</b> ${escAttr(editing.vars.accent)}<br>
        <b>Font:</b> ${escAttr(editing.vars.fontBody)}
      </div>
      <div class="mhc-preview-mono">Pit Guru · Stock-X · Pythagoras CIS · Landlord</div>`;

    dashboard.appendChild(hero);
    dashboard.appendChild(sample);
    main.replaceChildren(dashboard);
    main.querySelectorAll('[data-jump]').forEach(btn => btn.addEventListener('click', () => {
      uiState.activeTab = btn.dataset.jump;
      renderAll(overlay, editing);
    }));
  }

  function renderFontsTab(overlay, editing) {
    const main = overlay.querySelector('.mhc-main');
    const wrap = document.createElement('div');
    wrap.className = 'mhc-grid one';

    const presetRow = document.createElement('label');
    presetRow.className = 'mhc-field';
    presetRow.innerHTML = '<span class="mhc-field-label">Font Preset</span>';
    const select = document.createElement('select');
    select.className = 'mhc-select';
    select.innerHTML = FONT_PRESETS.map(p => `<option value="${escAttr(p.id)}" ${editing.lastFontPreset === p.id ? 'selected' : ''}>${escAttr(p.name)}</option>`).join('');
    select.addEventListener('change', () => {
      const preset = FONT_PRESETS.find(p => p.id === select.value);
      if (preset) {
        editing.vars = { ...editing.vars, ...preset.vars };
        editing.lastFontPreset = preset.id;
        applyTheme(editing, 'preview-font-preset');
        renderAll(overlay, editing);
        setDirty(overlay, true);
      }
    });
    presetRow.appendChild(select);
    wrap.appendChild(presetRow);

    const grid = document.createElement('div');
    grid.className = 'mhc-grid';
    for (const [title, keys] of FONT_GROUPS) {
      grid.appendChild(section(title));
      for (const key of keys) grid.appendChild(createTextField(editing, key, overlay, key.startsWith('font') ? 'long' : 'short'));
    }
    wrap.appendChild(grid);

    const preview = document.createElement('div');
    preview.className = 'mhc-preview-card';
    preview.innerHTML = `
      <div class="mhc-preview-title">Live Font Preview — MoDuL Hub</div>
      <div class="mhc-preview-body">
        This is how normal script text will look. Try Arial Narrow for compact racing panels, Verdana for readability, or Consolas for a terminal-style tool.
      </div>
      <div class="mhc-preview-mono">Lap 07 · Δ +0.327 · ROI 12.84% · Status: OK</div>`;
    wrap.appendChild(preview);

    main.replaceChildren(wrap);
  }

  function renderScriptsTab(overlay, editing) {
    const main = overlay.querySelector('.mhc-main');
    const wrap = document.createElement('div');
    wrap.className = 'mhc-grid one';
    const note = document.createElement('p');
    note.className = 'mhc-note';
    note.textContent = 'Compatibility is best-effort for existing hardcoded styles. Refactored scripts should use the canonical identifiers from window.MoDuLHubControlRoom.getContract().';
    wrap.appendChild(note);

    const bridgeRow = document.createElement('label');
    bridgeRow.className = 'mhc-field';
    bridgeRow.innerHTML = '<span class="mhc-field-label">Enable compatibility bridge for older scripts</span>';
    const bridgeCheck = document.createElement('input');
    bridgeCheck.type = 'checkbox';
    bridgeCheck.checked = editing.bridgeEnabled !== false;
    bridgeCheck.addEventListener('change', () => {
      editing.bridgeEnabled = bridgeCheck.checked;
      applyTheme(editing, 'preview-bridge');
      setDirty(overlay, true);
    });
    bridgeRow.appendChild(bridgeCheck);
    wrap.appendChild(bridgeRow);

    for (const target of SCRIPT_TARGETS) {
      const settings = editing.scripts[target.id] || { enabled: true, font: true, compatibility: true, accentOverride: '' };
      const detected = detectTarget(target);
      const row = document.createElement('div');
      row.className = 'mhc-script-row';
      row.innerHTML = `
        <div>
          <div class="mhc-script-name">${escAttr(target.name)}</div>
          <div class="mhc-script-detected">${detected ? 'Detected on this page' : 'Not detected on this page'}</div>
        </div>`;
      const enabled = document.createElement('label');
      enabled.className = 'mhc-switch';
      enabled.innerHTML = '<input type="checkbox"> Theme';
      enabled.querySelector('input').checked = settings.enabled !== false;
      enabled.querySelector('input').addEventListener('change', e => {
        editing.scripts[target.id].enabled = e.target.checked;
        applyTheme(editing, 'preview-script-toggle');
        setDirty(overlay, true);
      });
      row.appendChild(enabled);

      const font = document.createElement('label');
      font.className = 'mhc-switch';
      font.innerHTML = '<input type="checkbox"> Font';
      font.querySelector('input').checked = settings.font !== false;
      font.querySelector('input').addEventListener('change', e => {
        editing.scripts[target.id].font = e.target.checked;
        applyTheme(editing, 'preview-script-font');
        setDirty(overlay, true);
      });
      row.appendChild(font);

      const accent = document.createElement('input');
      accent.className = 'mhc-input short';
      accent.placeholder = target.defaultAccent || '#9fd42f';
      accent.value = settings.accentOverride || '';
      accent.title = 'Optional per-script accent override';
      accent.addEventListener('input', () => {
        editing.scripts[target.id].accentOverride = accent.value.trim();
        applyTheme(editing, 'preview-script-accent');
        setDirty(overlay, true);
      });
      row.appendChild(accent);

      wrap.appendChild(row);
    }
    main.replaceChildren(wrap);
  }

  function exportPayload(editing) {
    return JSON.stringify({
      type: 'MoDuL Hub Control Room Theme',
      version: VERSION,
      contractVersion: THEME_CONTRACT_VERSION,
      enabled: editing.enabled !== false,
      activePreset: editing.activePreset,
      vars: editing.vars,
      scripts: editing.scripts,
      bridgeEnabled: editing.bridgeEnabled,
      lastFontPreset: editing.lastFontPreset
    }, null, 2);
  }

  function contractPayload() {
    return JSON.stringify(themeContract(), null, 2);
  }

  function cssVariableBlock(vars) {
    const lines = [':root {'];
    Object.keys(DEFAULT_VARS).forEach(key => lines.push(`  ${cssVarName(key)}: ${vars[key]};`));
    lines.push('}');
    return lines.join('\n');
  }

  function renderExportTab(overlay, editing) {
    const main = overlay.querySelector('.mhc-main');
    const wrap = document.createElement('div');
    wrap.className = 'mhc-grid one';

    const note = document.createElement('p');
    note.className = 'mhc-note';
    note.textContent = 'Copy JSON to back up/share a full theme, copy the contract for future script refactors, or copy just the CSS variable block.';
    wrap.appendChild(note);

    const ta = document.createElement('textarea');
    ta.className = 'mhc-textarea';
    ta.value = exportPayload(editing);
    wrap.appendChild(ta);

    const buttons = document.createElement('div');
    buttons.className = 'mhc-btn-row';
    buttons.innerHTML = `
      <button class="mhc-btn primary" data-action="copy-json">Copy JSON</button>
      <button class="mhc-btn" data-action="apply-json">Apply JSON</button>
      <button class="mhc-btn" data-action="copy-contract">Copy Contract</button>
      <button class="mhc-btn" data-action="copy-css">Copy CSS Variables</button>`;
    wrap.appendChild(buttons);

    main.replaceChildren(wrap);

    buttons.querySelector('[data-action="copy-json"]').addEventListener('click', async () => {
      await navigator.clipboard?.writeText(ta.value).catch(() => {});
      showToast(overlay, 'JSON copied');
    });
    buttons.querySelector('[data-action="copy-css"]').addEventListener('click', async () => {
      await navigator.clipboard?.writeText(cssVariableBlock(editing.vars)).catch(() => {});
      showToast(overlay, 'CSS variables copied');
    });
    buttons.querySelector('[data-action="copy-contract"]').addEventListener('click', async () => {
      await navigator.clipboard?.writeText(contractPayload()).catch(() => {});
      showToast(overlay, 'Contract copied');
    });
    buttons.querySelector('[data-action="apply-json"]').addEventListener('click', () => {
      try {
        const parsed = JSON.parse(ta.value);
        const next = mergeConfig(parsed);
        Object.assign(editing, next);
        applyTheme(editing, 'preview-import');
        renderAll(overlay, editing);
        setDirty(overlay, true, 'Imported theme previewed');
      } catch (err) {
        showToast(overlay, 'Invalid JSON');
      }
    });
  }

  function renderMain(overlay, editing) {
    const tab = uiState.activeTab;
    if (tab === 'palettes') return renderPalettesTab(overlay, editing);
    if (tab === 'colours') return renderFieldsTab(overlay, editing, COLOUR_GROUPS, 'colour');
    if (tab === 'sizes') return renderFieldsTab(overlay, editing, SIZE_GROUPS, 'size');
    if (tab === 'fonts') return renderFontsTab(overlay, editing);
    if (tab === 'scripts') return renderScriptsTab(overlay, editing);
    if (tab === 'export') return renderExportTab(overlay, editing);
  }

  function renderTabs(overlay, editing) {
    const tabs = overlay.querySelector('.mhc-tabs');
    tabs.innerHTML = '';
    for (const [id, label] of TABS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mhc-tab' + (uiState.activeTab === id ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        uiState.activeTab = id;
        renderAll(overlay, editing);
      });
      tabs.appendChild(btn);
    }
  }

  function syncMasterSwitch(overlay, editing) {
    const toggle = overlay.querySelector('[data-master-toggle]');
    const label = overlay.querySelector('[data-master-label]');
    const enabled = editing.enabled !== false;
    if (toggle) toggle.checked = enabled;
    if (label) label.textContent = enabled ? 'On' : 'Off';
    overlay.classList.toggle('mhc-disabled', !enabled);
  }

  function renderAll(overlay, editing) {
    renderTabs(overlay, editing);
    renderSidebar(overlay, editing);
    renderMain(overlay, editing);
    syncMasterSwitch(overlay, editing);
  }

  function openUI() {
    if (document.getElementById(OVERLAY_ID)) return;
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    const editing = mergeConfig(clone(currentConfig));
    overlay.innerHTML = `
      <div class="mhc-shell" role="dialog" aria-modal="true" aria-label="MoDuL Hub Control Room">
        <div class="mhc-topbar"></div>
        <div class="mhc-head">
          <div class="mhc-brand">
            <div class="mhc-logo"><strong>MH</strong><small>HUB</small></div>
            <div class="mhc-title-wrap">
              <h2 class="mhc-title">MoDuL Hub Control Room</h2>
              <div class="mhc-subtitle">Theme editor · palettes · fonts · script bridge</div>
            </div>
          </div>
          <div class="mhc-head-actions">
            <label class="mhc-master-switch" title="Master on/off for MoDuL Hub theme effects">
              <input type="checkbox" data-master-toggle>
              <span class="mhc-master-track"></span>
              <span data-master-label>On</span>
            </label>
            <span class="mhc-pill">v${VERSION}</span>
            <button class="mhc-icon-btn" data-close title="Close">×</button>
          </div>
        </div>
        <div class="mhc-tabs"></div>
        <div class="mhc-body">
          <div class="mhc-sidebar"></div>
          <div class="mhc-main"></div>
        </div>
        <div class="mhc-foot">
          <div class="mhc-status"><span class="mhc-status-dot"></span><span class="mhc-status-label">No unsaved changes</span></div>
          <div class="mhc-btn-row" style="margin:0">
            <button class="mhc-btn danger" data-reset>Reset</button>
            <button class="mhc-btn" data-revert>Revert</button>
            <button class="mhc-btn primary" data-save>Save</button>
          </div>
        </div>
        <div class="mhc-toast">Saved</div>
      </div>`;

    const close = () => {
      applyTheme(currentConfig, 'close-revert');
      overlay.remove();
    };

    overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.querySelector('[data-master-toggle]').addEventListener('change', e => {
      editing.enabled = e.target.checked;
      applyTheme(editing, 'preview-master-toggle');
      syncMasterSwitch(overlay, editing);
      setDirty(overlay, true, editing.enabled === false ? 'Control Room disabled previewed' : 'Control Room enabled previewed');
    });
    overlay.querySelector('[data-save]').addEventListener('click', () => {
      currentConfig = mergeConfig(clone(editing));
      gmSet(STORAGE_KEY, currentConfig);
      applyTheme(currentConfig, 'save');
      setDirty(overlay, false, 'Saved');
      showToast(overlay, 'Saved to storage');
    });
    overlay.querySelector('[data-revert]').addEventListener('click', () => {
      const next = mergeConfig(clone(currentConfig));
      Object.keys(editing).forEach(k => delete editing[k]);
      Object.assign(editing, next);
      applyTheme(editing, 'revert');
      renderAll(overlay, editing);
      setDirty(overlay, false, 'Reverted to last save');
    });
    overlay.querySelector('[data-reset]').addEventListener('click', () => {
      const next = mergeConfig({ enabled: true, activePreset: 'shadowWheels', vars: clone(DEFAULT_VARS), scripts: clone(DEFAULT_SCRIPTS), bridgeEnabled: true, lastFontPreset: 'system' });
      Object.keys(editing).forEach(k => delete editing[k]);
      Object.assign(editing, next);
      applyTheme(editing, 'reset-preview');
      renderAll(overlay, editing);
      setDirty(overlay, true, 'Reset previewed');
    });

    document.body.appendChild(overlay);
    renderAll(overlay, editing);
    setDirty(overlay, false);
  }

  function registerMenu() {
    try {
      if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('Open MoDuL Hub Control Room', openUI);
        GM_registerMenuCommand('Enable MoDuL Hub Control Room', () => {
          currentConfig.enabled = true;
          gmSet(STORAGE_KEY, currentConfig);
          applyTheme(currentConfig, 'menu-enable');
        });
        GM_registerMenuCommand('Disable MoDuL Hub Control Room', () => {
          currentConfig.enabled = false;
          gmSet(STORAGE_KEY, currentConfig);
          applyTheme(currentConfig, 'menu-disable');
        });
        GM_registerMenuCommand('Reset MoDuL Hub Theme Preview', () => applyTheme(currentConfig, 'menu-reset-preview'));
      }
    } catch (_) { }
  }

  function bootstrap() {
    buildUiStyle();
    applyTheme(currentConfig, 'bootstrap');
    ensureReady(() => {
      ensureTrigger();
      setTimeout(ensureTrigger, 800);
      setTimeout(ensureTrigger, 2200);
      const observer = new MutationObserver(() => {
        if (!document.getElementById(TRIGGER_ID)) ensureTrigger();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    registerMenu();
    dispatchThemeReady('bootstrap');
  }

  window.addEventListener('keydown', e => {
    if (e.altKey && !e.ctrlKey && !e.shiftKey && String(e.key).toLowerCase() === 'm') {
      e.preventDefault();
      openUI();
    }
    if (e.key === 'Escape') {
      const overlay = document.getElementById(OVERLAY_ID);
      if (overlay) {
        applyTheme(currentConfig, 'escape-revert');
        overlay.remove();
      }
    }
  }, true);

  const publicApi = {
    version: VERSION,
    contractVersion: THEME_CONTRACT_VERSION,
    events: clone(EVENT_NAMES),
    open: openUI,
    getConfig: () => clone(currentConfig),
    getContract: () => themeContract(),
    getVars: () => clone(currentConfig.vars),
    getVar: key => currentConfig.vars[key],
    getCssVariableName: cssVarName,
    varName: cssVarName,
    cssVar: cssVarRef,
    getCssVariables: () => cssVariableBlock(currentConfig.vars),
    getCssVariableBlock: () => cssVariableBlock(currentConfig.vars),
    getAliases: () => clone(THEME_ALIASES),
    getClasses: () => clone(THEME_CLASSES),
    getDataAttributes: () => clone(THEME_DATA),
    getDataValues: () => clone(THEME_DATA_VALUES),
    getSelectors: () => clone(THEME_SELECTORS),
    getScriptTargets: publicScriptTargets,
    className: key => THEME_CLASSES[key] || '',
    selector: key => (THEME_SELECTORS[key] || []).join(', '),
    onUpdate: handler => {
      if (typeof handler !== 'function') return () => {};
      const wrapped = event => handler(event.detail, event);
      window.addEventListener(EVENT_NAMES.updated, wrapped);
      return () => window.removeEventListener(EVENT_NAMES.updated, wrapped);
    },
    apply: vars => {
      currentConfig.vars = { ...currentConfig.vars, ...(vars || {}) };
      applyTheme(currentConfig, 'api-apply');
    },
    save: () => gmSet(STORAGE_KEY, currentConfig),
    enable: () => {
      currentConfig.enabled = true;
      gmSet(STORAGE_KEY, currentConfig);
      applyTheme(currentConfig, 'api-enable');
    },
    disable: () => {
      currentConfig.enabled = false;
      gmSet(STORAGE_KEY, currentConfig);
      applyTheme(currentConfig, 'api-disable');
    },
    presets: () => PRESETS.map(p => ({ id: p.id, name: p.name }))
  };

  window.MoDuLHubControlRoom = publicApi;
  window.MoDuLHubTheme = publicApi;

  bootstrap();
})();
