// ==UserScript==
// @name         EggsTerminator
// @namespace    eggs.terminator
// @version      2.5.12
// @description  Stable state-aware egg navigator with egg finder, page labels, separate found/collected counters, draggable/resizable options, manual egg log sync, fixed icon-based state detection and state badge.
// @author       MoDuL[4022159] & Oo_Max_Payne_oO [2909733] & Lazerpent [2112641] & Heasleys4hemp [1468764]
// @copyright    2026 MoDuL, Oo_Max_Payne_oO, Lazerpent, and Heasleys4hemp. All rights reserved.
// @license      All Rights Reserved
// @match        https://www.torn.com/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @require      https://www.torn.com/js/script/lib/jquery-1.8.2.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// ==/UserScript==

/*
Copyright (c) 2026 MoDuL, Oo_Max_Payne_oO, Lazerpent, and Heasleys4hemp. All rights reserved.
Unauthorized copying, modification, redistribution, or commercial use is prohibited without written permission from the copyright holders.
*/

(function () {
    'use strict';

    const Version = "2.5.12";
    var TAG = "[EggsTerminator v" + Version + "]";
    try { console.log(TAG, "Loaded ✅"); } catch (e) {}

    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const $ = window.jQuery || window.$;
    if (!$) {
        console.error('EggsTerminator: jQuery not available');
        return;
    }

    /* ============================
     * SAFE STORAGE / HELPERS
     * ============================ */

    function lsGet(key, fallback = null) {
        try {
            const v = window.localStorage.getItem(key);
            return v == null ? fallback : v;
        } catch {
            return fallback;
        }
    }

    function lsSet(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch {}
    }

    function lsRemove(key) {
        try {
            window.localStorage.removeItem(key);
        } catch {}
    }

    function addStyle(css) {
        if (typeof GM_addStyle === 'function') {
            GM_addStyle(css);
            return;
        }
        const style = document.createElement('style');
        style.type = 'text/css';
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }

    function registerMenu(label, fn) {
        try {
            if (typeof GM_registerMenuCommand === 'function') {
                GM_registerMenuCommand(label, fn);
            }
        } catch {}
    }

    function normalizeHref(href) {
        return String(href || '').trim();
    }

    function normalisePathish(href) {
        const s = String(href || '').trim();
        if (!s) return '';
        return s
            .replace(/^https?:\/\/www\.torn\.com/i, '')
            .replace(/^\//, '')
            .trim();
    }

    function sameUrlish(a, b) {
        return normalisePathish(a) === normalisePathish(b);
    }

    function normalizeText(value) {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function getClientPoint(e) {
        const ev = e.touches?.[0] || e.changedTouches?.[0] || e;
        return {
            x: ev.clientX,
            y: ev.clientY
        };
    }

    /* ============================
     * SETTINGS / STORAGE
     * ============================ */

    const DEFAULT_BUTTON_FLOAT = 0; // 0 = floating, 1 = sidebar
    const DEFAULT_BUTTON_FLOAT_POS = 0; // 0 = bottom-left ; 1 = top-left; 2 = bottom-right; 3 = top-right
    const DEFAULT_LINK_INDEX = 0;
    const DEFAULT_EGG_FOUND_COUNT = 0;
    const DEFAULT_EGG_COLLECTED_COUNT = 0;

    function getStoredInt(key, fallback, min = null, max = null) {
        let value = parseInt(lsGet(key, String(fallback)), 10);
        if (!Number.isFinite(value)) value = fallback;
        if (min != null && value < min) value = fallback;
        if (max != null && value > max) value = fallback;
        return value;
    }

    let ButtonFloat = getStoredInt('eeh-float', DEFAULT_BUTTON_FLOAT, 0, 1);
    let ButtonFloatPos = getStoredInt('eeh-float-pos', DEFAULT_BUTTON_FLOAT_POS, 0, 3);
    let linkIndex = getStoredInt('eeh-index', DEFAULT_LINK_INDEX, 0);
    let eeh_pressTimer, eeh_anim_pressTimer;
    const eeh_reset_time = 9800;
    const eeh_fade_in = 200;
    let eeh_is_disabled = false;
    let eeh_holding = false;
    let eggObserverTimer = null;
    let eggCheckInProgress = true;
    let panelDragState = null;
    let panelResizeState = null;
    let eggCheckStartedAt = 0;
    let eggCheckTimer1 = null;
    let eggCheckTimer2 = null;
    let eggCheckFailsafeTimer = null;
    const EGG_CHECK_MAX_MS = 1800;
    const EGG_BUTTON_MAX_ATTEMPTS = 40;
    const EGG_BUTTON_MOVE_RETRY_MS = 50;
    const EGG_BUTTON_BIND_RETRY_MS = 100;
    const TOAST_EGG_GAP_PX = 40;
    const TOAST_SCREEN_MARGIN_PX = 8;
    let cachedPlayerId = null;

    const EGG_FOUND_FLAG_PREFIX = 'modul-egg-found-flag:';
    const EGG_COLLECTED_FLAG_PREFIX = 'modul-egg-collected-flag:';
    const EGG_FOUND_COUNT_KEY = 'modul-egg-found-count';
    const EGG_COLLECTED_COUNT_KEY = 'modul-egg-collected-count';
    const TOAST_ID = 'modul-egg-toast';
    const BLOCKER_ID = 'modul-egg-blocker';
    const LAST_BUTTON_POS_KEY = 'modul-last-egg-nav-pos';
    const SETTINGS_PANEL_GEOMETRY_KEY = 'modul-egg-settings-panel-geometry';
    const SETTINGS_PANEL_OPEN_KEY = 'modul-egg-settings-panel-open';
    const SYNC_RETURN_URL_KEY = 'modul-egg-sync-return-url';
    const SCRIPT_FORUM_THREAD_ID = '16559903';
    const SCRIPT_FORUM_POST_URL = `https://www.torn.com/forums.php#/p=threads&f=67&t=${SCRIPT_FORUM_THREAD_ID}&b=0&a=0&start=0`;
    const SCRIPT_FORUM_POST_URL_KEY = 'modul-egg-forum-post-url';

    /* ============================
     * RANDOM EGG ICON
     * ============================ */

    const EGG_ICON_IDS = [477, 472, 583, 478, 473, 584, 585, 1149, 474, 475, 476];

    function getEggImageUrl(itemId) {
        return `https://www.torn.com/images/items/${itemId}/large.png`;
    }

    const CURRENT_EGG_ICON_ID = EGG_ICON_IDS[Math.floor(Math.random() * EGG_ICON_IDS.length)];
    const CURRENT_EGG_ICON = getEggImageUrl(CURRENT_EGG_ICON_ID);

    const HANDCUFFS_ICON = `
<svg class="eeh-handcuffs-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;">
  <circle cx="7" cy="7" r="4"></circle>
  <circle cx="17" cy="17" r="4"></circle>
  <path d="M10.5 10.5 L13.5 13.5"></path>
  <path d="M9 7h-2"></path>
  <path d="M17 15h2"></path>
</svg>`;

    /* ============================
     * MENUS
     * ============================ */

    registerMenu('Toggle Floating Button', toggleFloatButton);
    registerMenu('Toggle Float Position', toggleFloatPosition);
    registerMenu('Reset Egg Counter', resetEggCount);
    registerMenu('Smart Sync Egg Counter From Logs', syncEggCountSmart);

    /* ============================
     * PAGE MODEL
     * ============================ */

    const STATE_KEYS = new Set(['home', 'hospital', 'jail', 'abroad', 'travelling', 'christmass', 'easteregg', 'racing']);

    function stripTrueStateFlags(page) {
        const cleaned = {};
        for (const [k, v] of Object.entries(page || {})) {
            if (STATE_KEYS.has(k) && v === true) continue;
            cleaned[k] = v;
        }
        return cleaned;
    }

    const PAGES_RAW = [
        { label: 'Torn.com', url: '' },
        { label: 'Home', url: '/', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Index', url: '/index.php' },
        { label: 'Preferences', url: '/preferences.php' },
        { label: 'Stats', url: '/personalstats.php' },
        { label: 'Report', url: '/playerreport.php' },
        { label: 'Add Report', url: '/page.php?sid=report#/add' },
        { label: 'Authenticate', url: '/authenticate.php', travelling: false },

        { label: 'Activity Log', url: '/page.php?sid=log' },
        { label: 'Attack Log', url: '/page.php?sid=attackLog&ID=ffc27604cc7fa671c27f77a53fe0985e' },
        { label: 'Events', url: '/page.php?sid=events' },
        { label: 'Saved Events', url: '/page.php?sid=events#onlySaved=true' },
        { label: 'All Events', url: '/events.php#/step=all' },

        { label: 'Profile', url: '/profiles.php?XID={playerId}' },
        { label: 'Awards', url: '/page.php?sid=awards' },
        { label: 'Award Merits', url: '/page.php?sid=awards&tab=merits' },
        { label: 'Award Medals', url: '/page.php?sid=awards&tab=medals' },
        { label: 'Award Honors', url: '/page.php?sid=awards&tab=honors' },
        { label: 'HOF', url: '/page.php?sid=hof' },

        { label: 'Friends List', url: '/page.php?sid=list&type=friends' },
        { label: 'Enemies List', url: '/page.php?sid=list&type=enemies' },
        { label: 'Targets List', url: '/page.php?sid=list&type=targets' },

        { label: 'Inbox', url: '/messages.php#/p=inbox' },
        { label: 'Compose', url: '/messages.php#/p=compose' },
        { label: 'Outbox', url: '/messages.php#/p=outbox' },
        { label: 'Saved Messages', url: '/messages.php#/p=saved' },
        { label: 'Ignore List', url: '/messages.php#/p=ignorelist' },

        { label: 'Gallery', url: '/page.php?sid=gallery' },
        { label: 'Users Online', url: '/usersonline.php' },
        { label: 'User List', url: '/page.php?sid=UserList', hospital: false, abroad: false, jail: false, travelling: false },

        { label: 'Items', url: '/item.php', travelling: false, abroad: false },
        { label: 'Use Parcel', url: '/itemuseparcel.php', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Ammo', url: '/page.php?sid=ammo', travelling: false },
        { label: 'Item Mods', url: '/page.php?sid=itemsMods', travelling: false },
        { label: 'Display Case', url: '/displaycase.php', hospital: false },
        { label: 'Display Case View', url: '/displaycase.php#display/' },
        { label: 'Display Case Manage', url: '/displaycase.php#manage', abroad: false, travelling: false },
        { label: 'Display Case Add', url: '/displaycase.php#add', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Keepsakes', url: '/page.php?sid=keepsakes', travelling: false },
        { label: 'Trade', url: '/trade.php', travelling: false },
        { label: 'Bazaar', url: '/page.php?sid=bazaar', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Bazaar Root', url: '/bazaar.php#/', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Bazaar Add', url: '/bazaar.php#/add', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Bazaar Manage', url: '/bazaar.php#/manage', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Bazaar Personalize', url: '/bazaar.php#/personalize', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Player Bazaar', url: '/bazaar.php?userId={playerId}', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'Rules', url: '/rules.php' },
        { label: 'Forums', url: '/forums.php' },
        { label: 'New Thread', url: '/forums.php#p=newthread&f=61&b=0&a=0' },
        { label: 'Credits', url: '/credits.php' },
        { label: 'Undefined', url: '/undefined.php' },

        { label: 'City', url: '/city.php', hospital: false, abroad: false, jail: false, travelling: false },
        { label: 'City Hall', url: '/citystats.php', hospital: false, abroad: false, jail: false, travelling: false },

        { label: 'Education', url: '/education.php', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Education Main', url: '/page.php?sid=education', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Gym', url: '/gym.php', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Travel', url: '/page.php?sid=travel', hospital: false, jail: false, travelling: true, racing: false },

        { label: 'Auction Market', url: '/amarket.php', hospital: false, travelling: false, abroad: false },
        { label: 'Bazaar Directory', url: '/page.php?sid=bazaar', hospital: false, travelling: false },
        { label: 'Church', url: '/church.php', hospital: false, jail: false, travelling: false, abroad: false },
        { label: 'Church Proposals', url: '/church.php?step=proposals', hospital: false, jail: false, travelling: false, abroad: false },
        { label: 'Item Market', url: '/page.php?sid=ItemMarket', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Item Market Popular', url: '/page.php?sid=ItemMarket#/market/view=category&categoryName=Most%20Popular', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Points', url: '/points.php', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Point Market', url: '/pmarket.php', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'Casino', url: '/casino.php', hospital: false, jail: false, travelling: false },
        { label: 'Slots', url: '/page.php?sid=slots', hospital: false, jail: false, travelling: false },
        { label: 'Slots Last Rolls', url: '/page.php?sid=slotsLastRolls', hospital: false, jail: false, travelling: false },
        { label: 'Slots Stats', url: '/page.php?sid=slotsStats', hospital: false, jail: false, travelling: false },
        { label: 'Roulette', url: '/page.php?sid=roulette', hospital: false, jail: false, travelling: false },
        { label: 'Roulette Last Spins', url: '/page.php?sid=rouletteLastSpins', hospital: false, jail: false, travelling: false },
        { label: 'Roulette Stats', url: '/page.php?sid=rouletteStatistics', hospital: false, jail: false, travelling: false },
        { label: 'High/Low', url: '/page.php?sid=highlow', hospital: false, jail: false, travelling: false },
        { label: 'High/Low Last Games', url: '/page.php?sid=highlowLastGames', hospital: false, jail: false, travelling: false },
        { label: 'High/Low Stats', url: '/page.php?sid=highlowStats', hospital: false, jail: false, travelling: false },
        { label: 'Keno', url: '/page.php?sid=keno', hospital: false, jail: false, travelling: false },
        { label: 'Keno Last Games', url: '/page.php?sid=kenoLastGames', hospital: false, jail: false, travelling: false },
        { label: 'Keno Stats', url: '/page.php?sid=kenoStatistics', hospital: false, jail: false, travelling: false },
        { label: 'Craps', url: '/page.php?sid=craps', hospital: false, jail: false, travelling: false },
        { label: 'Craps Last Rolls', url: '/page.php?sid=crapsLastRolls', hospital: false, jail: false, travelling: false },
        { label: 'Craps Stats', url: '/page.php?sid=crapsStats', hospital: false, jail: false, travelling: false },
        { label: 'Bookie', url: '/page.php?sid=bookie', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Bookie Popular', url: '/page.php?sid=bookie#/popular', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Bookie Your Bets', url: '/page.php?sid=bookie#/your-bets', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Bookie Stats', url: '/page.php?sid=bookie#/stats/', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Lottery', url: '/page.php?sid=lottery', hospital: false, jail: false, travelling: false },
        { label: 'Lottery Bought', url: '/page.php?sid=lotteryTicketsBought', hospital: false, jail: false, travelling: false },
        { label: 'Lottery Winners', url: '/page.php?sid=lotteryPreviousWinners', hospital: false, jail: false, travelling: false },
        { label: 'Blackjack', url: '/page.php?sid=blackjack', hospital: false, jail: false, travelling: false },
        { label: 'Blackjack Last Games', url: '/page.php?sid=blackjackLastGames', hospital: false, jail: false, travelling: false },
        { label: 'Blackjack Stats', url: '/page.php?sid=blackjackStatistics', hospital: false, jail: false, travelling: false },
        { label: "Hold'em", url: '/page.php?sid=holdem', jail: false, travelling: false },
        { label: "Hold'em Stats", url: '/page.php?sid=holdemStats', hospital: false, jail: false, travelling: false },
        { label: 'Russian Roulette', url: '/page.php?sid=russianRoulette', jail: false, travelling: false },
        { label: 'RR Last Games', url: '/page.php?sid=russianRouletteLastGames', hospital: false, jail: false, travelling: false },
        { label: 'RR Stats', url: '/page.php?sid=russianRouletteStatistics', hospital: false, jail: false, travelling: false },
        { label: 'Spin The Wheel', url: '/page.php?sid=spinTheWheel', hospital: false, jail: false, travelling: false },
        { label: 'Wheel Last Spins', url: '/page.php?sid=spinTheWheelLastSpins', hospital: false, jail: false, travelling: false },
        { label: 'Dump', url: '/dump.php', hospital: false, travelling: false },
        { label: 'Dump Trash', url: '/dump.php#/trash', hospital: false, jail: false, abroad: false, travelling: false, racing: false },
        { label: 'Loan', url: '/loan.php', hospital: false, jail: false, abroad: false, travelling: false, racing: false },
        { label: 'Missions', url: '/page.php?sid=missions', travelling: false },
        { label: 'Racing', url: '/page.php?sid=racing', hospital: false, jail: false, travelling: false, abroad: false },

        { label: 'Estate Agents', url: '/estateagents.php', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Properties', url: '/properties.php', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Your Properties', url: '/properties.php#/p=yourProperties', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Spouse Properties', url: '/properties.php#/p=spousesProperties', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Rental Market', url: '/properties.php?step=rentalmarket', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Rental Market Property', url: '/properties.php?step=rentalmarket#/property=13', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Selling Market', url: '/properties.php?step=sellingmarket', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Selling Market Property', url: '/properties.php?step=sellingmarket#/property=13', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'Archives', url: '/archives.php' },
        { label: 'Archives Factions', url: '/archives.php#/Factions' },
        { label: 'Archives Employment', url: '/archives.php#/Employment' },
        { label: 'Archives Markets', url: '/archives.php#/TheMarkets' },
        { label: 'Archives Real Estate', url: '/archives.php#/RealEstate' },
        { label: 'Fans', url: '/fans.php', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Hospital', url: '/hospitalview.php', jail: false, travelling: false },
        { label: 'Jail', url: '/jailview.php', hospital: false, travelling: false },
        { label: 'Committee', url: '/committee.php' },
        { label: 'Staff', url: '/staff.php' },
        { label: 'Museum', url: '/museum.php', hospital: false, jail: false, travelling: false },

        { label: 'Bank', url: '/bank.php', hospital: false, travelling: false },
        { label: 'Donator', url: '/donator.php' },
        { label: 'Message Inc', url: '/messageinc.php' },
        { label: 'Message Inc Send', url: '/messageinc.php#/p=send' },
        { label: 'Message Inc 2 Main', url: '/messageinc2.php#!p=main' },
        { label: 'Message Inc 2 View All', url: '/messageinc2.php#!p=viewall' },
        { label: 'Stocks', url: '/page.php?sid=stocks' },
        { label: 'Newspaper Root', url: '/newspaper.php#/' },
        { label: 'Newspaper Archive', url: '/newspaper.php#/archive' },
        { label: 'Story Article', url: '/newspaper.php#!/articles/1126' },
        { label: 'Tell Your Story', url: '/newspaper.php#/tell_your_story' },
        { label: 'Freebies', url: '/freebies.php#!p=main' },
        { label: 'Bring a Friend', url: '/bringafriend.php' },
        { label: 'Job List', url: '/joblist.php', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Corp Info User', url: '/joblist.php#/p=corpinfo&userID=1699485', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Corp Search', url: '/joblist.php?step=search#!p=corpinfo&ID=79286', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Interview Army', url: '/joblist.php#!p=interview&job=army', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Interview Grocer', url: '/joblist.php#!p=interview&job=grocer', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Interview Casino', url: '/joblist.php#!p=interview&job=casino', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Interview Medical', url: '/joblist.php#!p=interview&job=medical', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Interview Law', url: '/joblist.php#!p=interview&job=law', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Interview Education', url: '/joblist.php#!p=interview&job=education', abroad: false, travelling: false },
        { label: 'Personals', url: '/personals.php' },
        { label: 'Personals Search', url: '/personals.php#!p=search&type=2' },
        { label: 'Personals Add', url: '/personals.php#/p=add' },
        { label: 'Bounties Main', url: '/bounties.php#!p=main' },
        { label: 'Bounties Add', url: '/bounties.php#/p=add' },
        { label: 'Comics', url: '/comics.php' },
        { label: 'Token Shop', url: '/token_shop.php', hospital: false, jail: false, abroad: false, travelling: false },

        { label: "Big Al's Gun Shop", url: '/bigalgunshop.php', hospital: false, jail: false, abroad: false, travelling: false },
        { label: "Bits N' Bobs", url: '/shops.php?step=bitsnbobs', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Cyberforce', url: '/shops.php?step=cyberforce', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Docks', url: '/shops.php?step=docks', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Jewelry', url: '/shops.php?step=jewelry', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Nike-H', url: '/shops.php?step=nikeh', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Pawn Shop', url: '/shops.php?step=pawnshop', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Pharmacy', url: '/shops.php?step=pharmacy', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Post Office', url: '/shops.php?step=postoffice', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Print Store', url: '/shops.php?step=printstore', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Recycling Center', url: '/shops.php?step=recyclingcenter', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Supermarket', url: '/shops.php?step=super', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Candy Shop', url: '/shops.php?step=candy', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Clothes Shop', url: '/shops.php?step=clothes', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'Bunker', url: '/page.php?sid=bunker', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Keepsakes', url: '/page.php?sid=keepsakes', travelling: false },

        { label: 'Crimes 1.0', url: '/crimes.php', hospital: false, jail: false, travelling: false },
        { label: 'Crimes 2.0', url: '/page.php?sid=crimes', hospital: false, jail: false, travelling: false },
        { label: 'Crimes 2 Alias', url: '/page.php?sid=crimes2', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Crimes Root', url: '/page.php?sid=crimes#/', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Criminal Records', url: '/page.php?sid=crimesRecord', hospital: false, jail: false, travelling: false },
        { label: 'Search for Cash', url: '/page.php?sid=crimes#/searchforcash', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Bootlegging', url: '/page.php?sid=crimes#/bootlegging', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Graffiti', url: '/page.php?sid=crimes#/graffiti', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Shoplifting', url: '/page.php?sid=crimes#/shoplifting', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Pickpocketing', url: '/page.php?sid=crimes#/pickpocketing', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Cardskimming', url: '/page.php?sid=crimes#/cardskimming', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Burglary', url: '/page.php?sid=crimes#/burglary', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Hustling', url: '/page.php?sid=crimes#/hustling', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Disposal', url: '/page.php?sid=crimes#/disposal', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Cracking', url: '/page.php?sid=crimes#/cracking', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Forgery', url: '/page.php?sid=crimes#/forgery', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Scamming', url: '/page.php?sid=crimes#/scamming', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Arson', url: '/page.php?sid=crimes#/arson', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'Factions', url: '/factions.php' },
        { label: 'Faction Main', url: '/factions.php?step=your' },
        { label: 'Faction Crimes', url: '/factions.php?step=your&type=12#/tab=crimes', abroad: false, travelling: false },
        { label: 'Faction Info', url: '/factions.php?step=your#/tab=info' },
        { label: 'Faction Territory', url: '/factions.php?step=your#/tab=territory' },
        { label: 'Faction Rank', url: '/factions.php?step=your#/tab=rank' },
        { label: 'Faction Upgrades', url: '/factions.php?step=your#/tab=upgrades', abroad: false, travelling: false },
        { label: 'Faction Controls', url: '/factions.php?step=your#/tab=controls', abroad: false, travelling: false },
        { label: 'Faction Armoury', url: '/factions.php?step=your#/tab=armoury', abroad: false, travelling: false },
        { label: 'Armoury Donate', url: '/factions.php?step=your&type=1#/tab=armoury&start=0&sub=donate', abroad: false, travelling: false },
        { label: 'Armoury Weapons', url: '/factions.php?step=your&type=1#/tab=armoury&start=0&sub=weapons', abroad: false, travelling: false },
        { label: 'Armoury Armour', url: '/factions.php?step=your&type=1#/tab=armoury&start=0&sub=armour', abroad: false, travelling: false },
        { label: 'Armoury Medical', url: '/factions.php?step=your&type=1#/tab=armoury&start=0&sub=medical', abroad: false, travelling: false },
        { label: 'Armoury Temporary', url: '/factions.php?step=your&type=1#/tab=armoury&start=0&sub=temporary', abroad: false, travelling: false },
        { label: 'Armoury Consumables', url: '/factions.php?step=your&type=1#/tab=armoury&start=0&sub=consumables', abroad: false, travelling: false },
        { label: 'Armoury Drugs', url: '/factions.php?step=your&type=1#/tab=armoury&start=0&sub=drugs', abroad: false, travelling: false },
        { label: 'Armoury Boosters', url: '/factions.php?step=your&type=1#/tab=armoury&start=0&sub=boosters', abroad: false, travelling: false },
        { label: 'Armoury Utilities', url: '/factions.php?step=your&type=1#/tab=armoury&start=0&sub=utilities', abroad: false, travelling: false },
        { label: 'Armoury Loot', url: '/factions.php?step=your&type=1#/tab=armoury&start=0&sub=loot', abroad: false, travelling: false },
        { label: 'Armoury Points', url: '/factions.php?step=your&type=1#/tab=armoury&start=0&sub=points', abroad: false, travelling: false },
        { label: 'Faction Payday', url: '/factions.php?step=your&type=1#/tab=controls&option=pay-day&payMoneyTo=1636201&pay=100000', abroad: false, travelling: false },

        { label: 'Faction Warfare', url: '/page.php?sid=factionWarfare' },
        { label: 'Faction Ranked', url: '/page.php?sid=factionWarfare#/ranked', travelling: false },
        { label: 'Faction Territory Wars', url: '/page.php?sid=factionWarfare#/territory', travelling: false },
        { label: 'Faction Raids', url: '/page.php?sid=factionWarfare#/raids', travelling: false },
        { label: 'Faction Chains', url: '/page.php?sid=factionWarfare#/chains', travelling: false },
        { label: 'Dirty Bombs', url: '/page.php?sid=factionWarfare#/dirty-bombs', travelling: false },

        { label: 'Chain Report', url: '/factions.php?step=your&type=1#/war/chain', abroad: false, travelling: false },
        { label: 'Chain Report Direct', url: '/war.php?step=chainreport&chainID=41975287' },
        { label: 'War Report', url: '/war.php?step=warreport&warID=45201' },
        { label: 'War Report Direct', url: '/war.php?step=warreport&warID=41189' },
        { label: 'Rank Report', url: '/page.php?sid=factionWarfare0' },
        { label: 'Rank Report Direct', url: '/war.php?step=rankreport&rankID=12096' },
        { label: 'Raid Report', url: '/war.php?step=raidreport&raidID=8179' },

        { label: 'Christmas Town', url: '/christmas_town.php', home: false, hospital: false, jail: false, abroad: false, travelling: false, racing: false },
        { label: 'Christmas Root', url: '/christmas_town.php#/', home: false, hospital: false, jail: false, abroad: false, travelling: false, racing: false },
        { label: 'My Maps', url: '/christmas_town.php#/mymaps', home: false, hospital: false, jail: false, abroad: false, travelling: false, racing: false },
        { label: 'Map Editor', url: '/christmas_town.php#/mapeditor', home: false, hospital: false, jail: false, abroad: false, travelling: false, racing: false },
        { label: 'Parameter Editor', url: '/christmas_town.php#/parametereditor', home: false, hospital: false, jail: false, abroad: false, travelling: false, racing: false },
        { label: 'NPC Editor', url: '/christmas_town.php#/npceditor', home: false, hospital: false, jail: false, abroad: false, travelling: false, racing: false },
        { label: 'Job Listing', url: '/joblisting.php' },

        { label: 'Chedburn Profile', url: '/profiles.php?XID=1' },
        { label: 'Chedburn Gallery', url: '/page.php?sid=gallery&XID=1' },
        { label: 'Chedburn Bazaar', url: '/bazaar.php?userId=1', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Chedburn Stats', url: '/personalstats.php?ID=1' },
        { label: 'Chedburn Display Case', url: '/displaycase.php#display/1' },
        { label: 'Chedburn Duke', url: '/page.php?sid=attack&user2ID=1', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'George Profile', url: '/profiles.php?XID=3' },
        { label: 'Duke Profile', url: '/profiles.php?XID=4' },
        { label: 'Duke Bazaar', url: '/bazaar.php?userId=4', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'Duke Display Case', url: '/displaycase.php#display/4' },
        { label: 'Attack Duke', url: '/page.php?sid=attack&user2ID=4', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'Amanda Profile', url: '/profiles.php?XID=7' },
        { label: 'Amanda Bazaar', url: '/bazaar.php?userId=7', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'Photographer Profile', url: '/profiles.php?XID=8' },

        { label: 'Anonymous Profile', url: '/profiles.php?XID=9' },
        { label: 'Anonymous Bazaar', url: '/bazaar.php?userId=9', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'Scrooge Profile', url: '/profiles.php?XID=10' },
        { label: 'Scrooge Bazaar', url: '/bazaar.php?userId=10', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'Leslie\'s Profile', url: '/profiles.php?XID=15' },
        { label: 'Leslie\'s Bazaar', url: '/bazaar.php?userId=15', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'Easter Bunny Profile', url: '/profiles.php?XID=17' },
        { label: 'Attack Easter Bunny', url: '/page.php?sid=attack&user2ID=17', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'Jimmy Profile', url: '/profiles.php?XID=19' },
        { label: 'Jimmy Bazaar', url: '/bazaar.php?userId=19', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'Fernando Profile', url: '/profiles.php?XID=20' },
        { label: 'Fernando Bazaar', url: '/bazaar.php?userId=20', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'NPC Attack Log', url: '/page.php?sid=attackLog&ID=62ffe20613b5b8cc8821c38989873f4b' },

        { label: 'Tiny Profile', url: '/profiles.php?XID=21' },
        { label: 'Tiny Bazaar', url: '/bazaar.php?userId=21', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'M\'aol Profile', url: '/profiles.php?XID=23' },
        { label: 'M\'aol Bazaar', url: '/bazaar.php?userId=23', hospital: false, jail: false, abroad: false, travelling: false },

        { label: 'The_Hamster Profile', url: '/profiles.php?XID=50' },
        { label: 'The_Hamster Bazaar', url: '/bazaar.php?userId=50', hospital: false, jail: false, abroad: false, travelling: false },
        { label: 'The_Hamster Display', url: '/displaycase.php#display/50' },

        { label: 'Dyno\'salam', url: '/profiles.php?XID=100' },
        { label: 'Nol\'dasaym', url: '/profiles.php?XID=101' },
        { label: 'Asmol\'yand', url: '/profiles.php?XID=102' },
        { label: 'Sylo\'nadam', url: '/profiles.php?XID=103' },
        { label: 'Ladso\'myna', url: '/profiles.php?XID=104' },

        { label: 'People', url: '/index.php?page=people', home: false, hospital: false, jail: false, travelling: false, racing: false },
        { label: 'Fortune Teller', url: '/index.php?page=fortune', home: false, hospital: false, jail: false, travelling: false, racing: false },
        { label: 'Rehab', url: '/index.php?page=rehab', home: false, hospital: false, jail: false, travelling: false, racing: false },
        { label: 'Hunting', url: '/index.php?page=hunting', home: false, hospital: false, jail: false, travelling: false, racing: false },

        { label: 'PC', url: '/pc.php' },
        { label: 'Companies', url: '/companies.php', hospital: false, travelling: false },
        { label: 'Your Company', url: '/companies.php?step=your&type=1' },
        { label: 'Blacklist', url: '/blacklist.php' },
        { label: 'Calendar', url: '/calendar.php', travelling: false },
        { label: 'Competition', url: '/competition.php', travelling: false },
        { label: 'Classified Ads', url: '/newspaper_class.php' }
    ];

    const PAGES = PAGES_RAW.map(stripTrueStateFlags);

    /* ============================
     * STATE DETECTION (ICON-ONLY / ICON-LABEL ONLY)
     * ============================ */

    const STATUS_ICON_IDS = {
        hospital: new Set([15, 82, 91]),
        jail: new Set([16, 70]),
        travelShared: new Set([71]),
        racing: new Set([17])
    };

    function getPageHrefLower() {
        return (location.href || '').toLowerCase();
    }

    function extractIconNumberFromElement(el) {
        if (!el) return null;

        const id = String(el.id || '').trim();
        let m = id.match(/^icon(\d+)$/i);
        if (m) return parseInt(m[1], 10);

        const cls = typeof el.className === 'string'
        ? el.className
        : (el.className && typeof el.className.baseVal === 'string' ? el.className.baseVal : '');

        if (!cls) return null;

        m = cls.match(/(?:^|\s)icon(\d+)(?:___[^\s]+)?(?:\s|$)/i);
        if (m) return parseInt(m[1], 10);

        return null;
    }

    function getStatusRoot() {
        return (
            document.querySelector('ul[class*="status-icons"]') ||
            document.querySelector('.status-icons') ||
            document.querySelector('#iconTray') ||
            document.querySelector('#sidebar') ||
            document.querySelector('header')
        );
    }

    function getOwnStatusEntries() {
        const root = getStatusRoot();
        if (!root) return [];

        const nodes = root.querySelectorAll('li, a, span, div');
        const out = [];
        const seen = new Set();

        nodes.forEach(node => {
            const iconId = extractIconNumberFromElement(node);
            if (!Number.isFinite(iconId)) return;

            const label =
                  (node.getAttribute && (
                      node.getAttribute('aria-label') ||
                      node.getAttribute('title')
                  )) || '';

            let childLabel = '';
            if (!label) {
                const child = node.querySelector?.('[aria-label],[title]');
                if (child) {
                    childLabel = child.getAttribute('aria-label') || child.getAttribute('title') || '';
                }
            }

            const finalLabel = String(label || childLabel || '').trim().toLowerCase();
            const key = `${iconId}|${finalLabel}`;
            if (seen.has(key)) return;
            seen.add(key);

            out.push({
                el: node,
                iconId,
                label: finalLabel
            });
        });

        return out;
    }

    function hasAnyStatusIcon(iconSet) {
        const entries = getOwnStatusEntries();
        return entries.some(entry => iconSet.has(entry.iconId));
    }

    function getTravelSharedEntry() {
        const entries = getOwnStatusEntries();
        return entries.find(entry => STATUS_ICON_IDS.travelShared.has(entry.iconId)) || null;
    }

    function isHospitalised() {
        return hasAnyStatusIcon(STATUS_ICON_IDS.hospital);
    }

    function isJailed() {
        return hasAnyStatusIcon(STATUS_ICON_IDS.jail);
    }

    function isFlying() {
        const entry = getTravelSharedEntry();
        if (!entry) return false;

        const label = entry.label;
        return (
            label.includes('travelling') ||
            label.includes('traveling') ||
            label.includes('flight')
        );
    }

    function isAbroad() {
        const entry = getTravelSharedEntry();
        if (!entry) return false;

        const label = entry.label;
        return (
            label.includes('abroad in') ||
            label.startsWith('abroad') ||
            label.includes('return to torn') ||
            label.includes('travel home')
        );
    }

    function isRacing() {
        const hasRaceIcon = hasAnyStatusIcon(STATUS_ICON_IDS.racing);
        if (!hasRaceIcon) return false;
        if (isHospitalised() || isJailed() || isFlying()) return false;
        return true;
    }

    function getCurrentState() {
        if (isFlying()) return 'travelling';
        if (isHospitalised()) return 'hospital';
        if (isJailed()) return 'jail';
        if (isAbroad()) return 'abroad';
        if (isRacing()) return 'racing';
        return 'home';
    }

    function getStateFlags() {
        const state = getCurrentState();
        return {
            home: state === 'home',
            hospital: state === 'hospital',
            jail: state === 'jail',
            abroad: state === 'abroad',
            travelling: state === 'travelling',
            racing: state === 'racing'
        };
    }

    function getThemeState() {
        return getCurrentState();
    }

    function getState() {
        return getCurrentState();
    }

    function getStateLabel() {
        const s = getCurrentState();

        if (s === 'travelling') return '✈ Flying';
        if (s === 'hospital') return '🏥 Hospital';
        if (s === 'jail') return HANDCUFFS_ICON + ' Jail';
        if (s === 'abroad') return '🌍 Abroad';
        if (s === 'racing') return '🏁 Racing';
        return '🏠 Home';
    }

    function applyStateThemes() {
        const state = getThemeState();

        const targets = [
            document.getElementById('eggTraverse'),
            document.getElementById('eeh-floating-panel'),
            document.querySelector('#eggTraverse')?.closest('.eeh-link')
        ].filter(Boolean);

        for (const el of targets) {
            el.classList.remove(
                'eeh-state-home',
                'eeh-state-hospital',
                'eeh-state-jail',
                'eeh-state-travelling',
                'eeh-state-abroad',
                'eeh-state-racing'
            );

            switch (state) {
                case 'hospital':
                    el.classList.add('eeh-state-hospital');
                    break;
                case 'jail':
                    el.classList.add('eeh-state-jail');
                    break;
                case 'travelling':
                    el.classList.add('eeh-state-travelling');
                    break;
                case 'abroad':
                    el.classList.add('eeh-state-abroad');
                    break;
                case 'racing':
                    el.classList.add('eeh-state-racing');
                    break;
                default:
                    el.classList.add('eeh-state-home');
                    break;
            }
        }
    }

    /* ============================
     * PAGE HELPERS
     * ============================ */

    function ensureNavigatorVisibleInCurrentLayout() {
        const btn = document.getElementById('eggTraverse');
        const sidebarReady = !!document.querySelector('#sidebar > div:first-of-type');

        if (!btn) {
            if (ButtonFloat && sidebarReady) insertNormal();
            else insertFloat();
            return;
        }

        const isFloat = btn.classList.contains('eeh-float');

        if (ButtonFloat) {
            if (!sidebarReady && !isFloat) {
                killButton();
                insertFloat();
            } else if (sidebarReady && isFloat) {
                killButton();
                insertNormal();
            }
        } else if (!isFloat) {
            killButton();
            insertFloat();
        }
    }

    function getNumericId(value) {
        const m = String(value || '').trim().match(/^\d+$/);
        return m && m[0] !== '0' ? m[0] : null;
    }

    function getPlayerIdFromWindow() {
        const paths = [
            ['userID'],
            ['userId'],
            ['userid'],
            ['playerID'],
            ['playerId'],
            ['myID'],
            ['myId'],
            ['ownUserID'],
            ['ownUserId'],
            ['currentUserID'],
            ['currentUserId'],
            ['loggedInUserID'],
            ['loggedInUserId'],
            ['User', 'id'],
            ['User', 'ID'],
            ['user', 'id'],
            ['user', 'ID'],
            ['player', 'id'],
            ['player', 'ID']
        ];

        for (const path of paths) {
            try {
                let value = window;
                for (const key of path) value = value?.[key];
                const id = getNumericId(typeof value === 'function' ? value.call(window) : value);
                if (id) return id;
            } catch {}
        }

        return null;
    }

    function getPlayerIdFromProfileLinks() {
        const selectors = [
            '#sidebar a[href*="profiles.php?XID="]',
            'header a[href*="profiles.php?XID="]'
        ];

        for (const selector of selectors) {
            const link = document.querySelector(selector);
            const href = link?.href || '';
            const m = href.match(/[?&]XID=(\d+)/i);
            if (m) return m[1];
        }

        return null;
    }

    function getPlayerIdFromScripts() {
        const selfIdPatterns = [
            /(?:^|[\s{,;])['"]?(?:my|own|current|loggedIn|logged_in)(?:User|Player)?(?:ID|Id|XID)['"]?\s*[:=]\s*['"]?(\d+)['"]?/i,
            /(?:^|[\s{,;])['"]?(?:player|user)(?:ID|Id)['"]?\s*[:=]\s*['"]?(\d+)['"]?/i
        ];

        const scripts = Array.from(document.querySelectorAll('script'));
        for (const s of scripts) {
            const txt = s.textContent || '';
            for (const pattern of selfIdPatterns) {
                const m = txt.match(pattern);
                if (m) return m[1];
            }
        }

        return null;
    }

    function getPlayerId() {
        if (cachedPlayerId) return cachedPlayerId;

        cachedPlayerId =
            getPlayerIdFromWindow() ||
            getPlayerIdFromProfileLinks() ||
            getPlayerIdFromScripts();

        return cachedPlayerId;
    }

    function normalisePage(page) {
        return {
            home: true,
            hospital: true,
            jail: true,
            abroad: true,
            travelling: true,
            christmass: true,
            easteregg: true,
            racing: true,
            ...page
        };
    }

    function pageAllowedInFlags(page, flags) {
        const p = normalisePage(page);

        if (flags.travelling) return !!p.travelling;
        if (flags.hospital) return !!p.hospital;
        if (flags.jail) return !!p.jail;
        if (flags.abroad) return !!p.abroad;
        if (flags.racing) return !!p.racing;

        return !!p.home;
    }

    function resolvePageUrl(page) {
        const url = String(page.url || '');
        if (!url.includes('{playerId}')) return url;

        const playerId = getPlayerId();
        if (!playerId) return '';

        return url.replace(/\{playerId\}/g, String(playerId));
    }

    function getPageByUrl(url) {
        const cleanUrl = normalizeHref(url);
        return PAGES.find(p => sameUrlish(resolvePageUrl(p), cleanUrl)) || null;
    }

    function getLabelFromUrl(url) {
        if (!url) return '';
        const clean = url.split('#')[0].split('?')[0];
        const last = clean.split('/').pop() || clean;
        return last
            .replace('.php', '')
            .replace(/([A-Z])/g, ' $1')
            .replace(/[-_]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^./, c => c.toUpperCase());
    }

    function getPageLabel(url) {
        const page = getPageByUrl(url);
        if (page && page.label) return page.label;
        return getLabelFromUrl(url);
    }

    /* ============================
     * LINK FILTERING
     * ============================ */

    function buildLinksForFlags(flags) {
        const seen = new Set();
        const links = [];

        for (const page of PAGES) {
            if (!pageAllowedInFlags(page, flags)) continue;

            const url = resolvePageUrl(page);
            if (!url) continue;

            if (seen.has(url)) continue;
            seen.add(url);
            links.push(url);
        }

        return links;
    }

    function getCurrentLinkPool() {
        return getCurrentAllowedPool();
    }

    function clampLinkIndexToPool() {
        clampMasterIndex();

        const flags = getCurrentFlags();
        const validIndex = getNextAllowedMasterIndex(linkIndex, flags);

        if (validIndex === -1) {
            linkIndex = 0;
            lsSet('eeh-index', '0');
            return [];
        }

        linkIndex = validIndex;
        lsSet('eeh-index', String(linkIndex));

        return buildLinksForFlags(flags);
    }

    function navigateToPage(url) {
        const target = new URL(url, location.origin);

        const currentPath = location.pathname;
        const currentSearch = location.search;
        const currentHash = location.hash;

        const samePathAndSearch =
              currentPath === target.pathname &&
              currentSearch === target.search;

        if (samePathAndSearch) {
            if (target.hash && currentHash !== target.hash) {
                saveSettingsPanelStateNow();
                location.hash = target.hash;
                return false;
            }

            if (!target.hash || currentHash === target.hash) {
                runEggCheckCycle();
                return false;
            }
        }

        saveSettingsPanelStateNow();
        location.href = target.href;
        return true;
    }

    function looksLikeForumThreadUrl(url = location.href) {
        const href = String(url || '').trim();
        if (!href || !href.includes('/forums.php')) return false;
        return /(?:[?#&]|#\/.*[?&])t=\d+/i.test(href);
    }

    function getForumThreadId(url = location.href) {
        const href = String(url || '').trim();
        const match = href.match(/(?:[?#&]|#\/.*[?&])t=(\d+)/i);
        return match ? match[1] : '';
    }

    function isScriptForumThreadUrl(url = location.href) {
        return looksLikeForumThreadUrl(url) && getForumThreadId(url) === SCRIPT_FORUM_THREAD_ID;
    }

    function getSavedForumPostUrl() {
        const saved = String(lsGet(SCRIPT_FORUM_POST_URL_KEY, '') || '').trim();
        return isScriptForumThreadUrl(saved) ? saved : SCRIPT_FORUM_POST_URL;
    }

    function setSavedForumPostUrl(url) {
        const next = String(url || '').trim();
        lsSet(SCRIPT_FORUM_POST_URL_KEY, isScriptForumThreadUrl(next) ? next : SCRIPT_FORUM_POST_URL);
    }

    function rememberCurrentForumPostUrl() {
        if (!isScriptForumThreadUrl(location.href)) return '';
        setSavedForumPostUrl(location.href);
        return location.href;
    }

    function isEggsTerminatorUiElement(el) {
        if (!el || !el.closest) return false;
        return !!el.closest('#eeh-floating-panel, #eggTraverse, .eeh-link, #modul-fake-egg-root, #easter-egg-hunt-root, #modul-egg-toast, #modul-egg-blocker');
    }

    function findForumLikeButton() {
        if (!isScriptForumThreadUrl(location.href)) return null;

        const directThreadLike = document.querySelector(
            'li.like.forum-button[data-event="like"]:not(.disabled) button.like-icon:not([disabled]), li.like[data-event="like"]:not(.disabled) button.like-item:not([disabled])'
        );
        if (directThreadLike && !isEggsTerminatorUiElement(directThreadLike)) return directThreadLike;

        const clickables = Array.from(document.querySelectorAll('button, a, input, [role="button"]'))
            .filter(el => !isEggsTerminatorUiElement(el) && !el.disabled);

        const exactLike = clickables.find(el => {
            const txt = normalizeText([
                el.textContent || '',
                el.value || '',
                el.getAttribute('aria-label') || '',
                el.getAttribute('title') || ''
            ].join(' '));
            const pressed = normalizeText(el.getAttribute('aria-pressed') || '');
            if (!txt) return false;
            if (pressed === 'true') return false;
            if (txt.includes('liked') || txt.includes('unlike') || txt.includes('dislike')) return false;
            return txt === 'like' || txt.startsWith('like ') || txt.includes(' like this');
        });
        if (exactLike) return exactLike;

        return clickables.find(el => {
            const txt = normalizeText([
                el.textContent || '',
                el.value || '',
                el.getAttribute('aria-label') || '',
                el.getAttribute('title') || ''
            ].join(' '));
            const pressed = normalizeText(el.getAttribute('aria-pressed') || '');
            if (!txt) return false;
            if (pressed === 'true') return false;
            if (txt.includes('liked') || txt.includes('unlike') || txt.includes('dislike')) return false;
            return txt.includes('like');
        }) || null;
    }

    function getForumLikeWidget() {
        if (!isScriptForumThreadUrl(location.href)) return null;

        const item = document.querySelector('li.like.forum-button[data-event="like"], li.like[data-event="like"]');
        if (!item || isEggsTerminatorUiElement(item)) return null;

        const button = item.querySelector('button.like-icon, button.like-item, button');
        const disabled = item.classList.contains('disabled')
            || !!button?.disabled
            || !!item.querySelector('.rating-results-pending');

        return { item, button, disabled };
    }

    function isForumPostAlreadyLiked() {
        if (!isScriptForumThreadUrl(location.href)) return false;

        const clickables = Array.from(document.querySelectorAll('button, a, input, [role="button"]'))
            .filter(el => !isEggsTerminatorUiElement(el));

        return clickables.some(el => {
            const txt = normalizeText([
                el.textContent || '',
                el.value || '',
                el.getAttribute('aria-label') || '',
                el.getAttribute('title') || ''
            ].join(' '));
            const pressed = normalizeText(el.getAttribute('aria-pressed') || '');
            return pressed === 'true' || txt.includes('liked') || txt.includes('unlike');
        });
    }

    function handleForumLikeAction() {
        saveSettingsPanelStateNow();

        const currentThreadUrl = rememberCurrentForumPostUrl();
        if (currentThreadUrl) {
            const likeWidget = getForumLikeWidget();
            if (likeWidget?.disabled) {
                showToast('Like is unavailable here right now, or Torn is still loading the forum rating controls.');
                return;
            }

            const likeButton = findForumLikeButton();
            if (!likeButton) {
                if (isForumPostAlreadyLiked()) {
                    showToast('This thread already looks liked.');
                    return;
                }
                showToast('Like button not found on this forum thread.');
                return;
            }

            likeButton.click();
            showToast('Pressed Like on the current forum thread.');
            return;
        }

        const savedThreadUrl = getSavedForumPostUrl();
        showToast('Opening the EggsTerminator release thread. Press "Like this script!" again there.');
        setTimeout(() => {
            saveSettingsPanelStateNow();
            location.href = savedThreadUrl;
        }, 60);
    }
    function getMasterPageCount() {
        return PAGES.length;
    }

    function clampMasterIndex() {
        if (!Number.isFinite(linkIndex) || linkIndex < 0) {
            linkIndex = 0;
        }
        if (linkIndex >= getMasterPageCount()) {
            linkIndex = 0;
        }
        lsSet('eeh-index', String(linkIndex));
    }

    function getCurrentFlags() {
        return getStateFlags();
    }

    function isPageAllowedAtIndex(index, flags) {
        const page = PAGES[index];
        if (!page) return false;
        return pageAllowedInFlags(page, flags);
    }

    function resolvePageUrlByIndex(index) {
        const page = PAGES[index];
        if (!page) return '';
        return resolvePageUrl(page);
    }

    function getNextAllowedMasterIndex(startIndex, flags) {
        const total = getMasterPageCount();
        if (!total) return -1;

        let idx = Number.isFinite(startIndex) ? startIndex : 0;
        if (idx < 0) idx = 0;
        if (idx >= total) idx = 0;

        for (let step = 0; step < total; step++) {
            const testIndex = (idx + step) % total;
            if (isPageAllowedAtIndex(testIndex, flags)) {
                return testIndex;
            }
        }

        return -1;
    }

    function getNextAllowedMasterIndexAfter(currentIndex, flags) {
        const total = getMasterPageCount();
        if (!total) return -1;
        const nextStart = ((Number.isFinite(currentIndex) ? currentIndex : 0) + 1) % total;
        return getNextAllowedMasterIndex(nextStart, flags);
    }

    function getCurrentAllowedPool() {
        return buildLinksForFlags(getCurrentFlags());
    }

    function getCurrentPoolPositionFromMasterIndex() {
        const flags = getCurrentFlags();
        const currentUrl = resolvePageUrlByIndex(linkIndex);
        const pool = buildLinksForFlags(flags);

        if (!pool.length || !currentUrl) {
            return { pos: 0, size: pool.length };
        }

        const pos = pool.findIndex(url => sameUrlish(url, currentUrl));
        return {
            pos: pos >= 0 ? pos + 1 : 0,
            size: pool.length
        };
    }
    /* ============================
     * PAGE-SPECIFIC EGG KEYS
     * ============================ */

    function getPageStorageKeySuffix() {
        return `${location.pathname}${location.search}${location.hash}`;
    }

    function getEggFoundFlagKeyForPage() {
        return `${EGG_FOUND_FLAG_PREFIX}${getPageStorageKeySuffix()}`;
    }

    function getEggCollectedFlagKeyForPage() {
        return `${EGG_COLLECTED_FLAG_PREFIX}${getPageStorageKeySuffix()}`;
    }

    /* ============================
     * COUNTERS
     * ============================ */

    function getEggFoundCount() {
        return getStoredInt(EGG_FOUND_COUNT_KEY, DEFAULT_EGG_FOUND_COUNT, 0);
    }

    function getEggCollectedCount() {
        return getStoredInt(EGG_COLLECTED_COUNT_KEY, DEFAULT_EGG_COLLECTED_COUNT, 0);
    }

    function incrementEggFoundCount() {
        const next = getEggFoundCount() + 1;
        lsSet(EGG_FOUND_COUNT_KEY, String(next));
        updateEggCounterUI();
        return next;
    }

    function incrementEggCollectedCount() {
        const next = getEggCollectedCount() + 1;
        lsSet(EGG_COLLECTED_COUNT_KEY, String(next));
        updateEggCounterUI();
        return next;
    }

    function clearStoredEggPageFlags() {
        try {
            const keysToRemove = [];

            for (let i = 0; i < window.localStorage.length; i++) {
                const key = window.localStorage.key(i);
                if (
                    key &&
                    (
                        key.startsWith(EGG_FOUND_FLAG_PREFIX) ||
                        key.startsWith(EGG_COLLECTED_FLAG_PREFIX)
                    )
                ) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach(lsRemove);
        } catch {}
    }

    function resetEggCount() {
        clearStoredEggPageFlags();
        lsSet(EGG_FOUND_COUNT_KEY, '0');
        lsSet(EGG_COLLECTED_COUNT_KEY, '0');
        updateEggCounterUI();
        refreshSettingsPanel();
        showToast('Egg counters reset');
    }

    function updateStateHtml(el, html) {
        if (!el) return;
        el.innerHTML = html;
    }

    function updateEggCounterUI() {
        ensureCheckingStateNotStuck();

        const found = getEggFoundCount();
        const collected = getEggCollectedCount();
        const traverse = document.getElementById('eggTraverse');
        if (!traverse) return;

        traverse.classList.toggle('eeh-disabled', eggCheckInProgress);

        const countEl = traverse.querySelector('.eeh-count');
        if (countEl) {
            if (eggCheckInProgress) {
                countEl.textContent = traverse.classList.contains('eeh-float')
                    ? 'Checking...'
                : 'Checking page...';
            } else {
                countEl.textContent = traverse.classList.contains('eeh-float')
                    ? `F:${found} C:${collected}`
                    : `Found: ${found} • Collected: ${collected}`;
            }
        }

        const stateEl = traverse.querySelector('.eeh-state');
        if (stateEl) {
            updateStateHtml(stateEl, traverse.classList.contains('eeh-float') ? getStateLabel() : `State: ${getStateLabel()}`);
        }

        const badgeEl = traverse.querySelector('.eeh-state-badge');
        if (badgeEl) {
            updateStateHtml(badgeEl, getStateLabel());
        }

        const totalEl = traverse.querySelector('.eeh-total');
        if (totalEl) {
            const poolPos = getCurrentPoolPositionFromMasterIndex();
            totalEl.textContent = `${poolPos.pos}/${poolPos.size}`;
        }

        const href = traverse.getAttribute('href') || '';
        const nameEl = traverse.querySelector('.eeh-name');
        if (nameEl) {
            if (eggCheckInProgress) {
                nameEl.textContent = 'Checking...';
            } else {
                nameEl.textContent = getPageLabel(href);
            }
        }

        applyStateThemes();
    }

    /* ============================
     * NAV BUTTON POSITION MEMORY
     * ============================ */

    function saveLastButtonPosition() {
        const btn = document.getElementById('eggTraverse');
        if (!btn) return;

        const rect = btn.getBoundingClientRect();
        const data = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            cx: rect.left + (rect.width / 2),
            cy: rect.top + (rect.height / 2),
            vw: window.innerWidth,
            vh: window.innerHeight
        };

        lsSet(LAST_BUTTON_POS_KEY, JSON.stringify(data));
    }

    function getLastButtonPosition() {
        try {
            const raw = lsGet(LAST_BUTTON_POS_KEY, null);
            if (!raw) return null;

            const data = JSON.parse(raw);
            if (!data || typeof data.cx !== 'number' || typeof data.cy !== 'number') return null;

            const scaleX = window.innerWidth / (data.vw || window.innerWidth);
            const scaleY = window.innerHeight / (data.vh || window.innerHeight);

            return {
                cx: data.cx * scaleX,
                cy: data.cy * scaleY,
                width: (data.width || 80) * scaleX,
                height: (data.height || 40) * scaleY
            };
        } catch {
            return null;
        }
    }

    window.addEventListener('resize', function () {
        setTimeout(() => {
            ensureNavigatorVisibleInCurrentLayout();
            applyStateThemes();
            updateEggCounterUI();
        }, 120);
    });

    /* ============================
     * EGG LOG SYNC
     * ============================ */

    function isEggLogPage() {
        const href = window.location.href.toLowerCase();
        return href.includes('page.php?sid=log') && href.includes('cat=212');
    }

    function getEggLogCountFromPage() {
        if (!isEggLogPage()) return 0;
        const text = document.body?.innerText || '';
        const matches = text.match(/you picked up a .*easter egg/gi);
        return matches ? matches.length : 0;
    }

    function syncEggCountFromLogs(options = {}) {
        const useMax = options.useMax !== false;

        if (!isEggLogPage()) {
            showToast('Open the Easter egg log page first');
            return false;
        }

        const visibleCount = getEggLogCountFromPage();
        const currentCollected = getEggCollectedCount();
        const nextCollected = useMax ? Math.max(currentCollected, visibleCount) : visibleCount;

        lsSet(EGG_COLLECTED_COUNT_KEY, String(nextCollected));

        if (getEggFoundCount() < nextCollected) {
            lsSet(EGG_FOUND_COUNT_KEY, String(nextCollected));
        }

        updateEggCounterUI();
        refreshSettingsPanel();
        showToast(`Collected eggs synced from logs: ${nextCollected}`);
        return true;
    }

    function syncEggCountSmart() {
        if (!isEggLogPage()) {
            lsSet(SYNC_RETURN_URL_KEY, location.href);
            showToast('Opening egg logs... then click the button again to sync');
            setTimeout(() => {
                saveSettingsPanelStateNow();
                location.href = '/page.php?sid=log&cat=212';
            }, 650);
            return;
        }

        const ok = syncEggCountFromLogs({ useMax: true });
        if (!ok) return;

        const returnUrl = lsGet(SYNC_RETURN_URL_KEY, '');
        if (returnUrl) {
            setTimeout(() => {
                const saved = lsGet(SYNC_RETURN_URL_KEY, '');
                if (saved) {
                    lsRemove(SYNC_RETURN_URL_KEY);
                    saveSettingsPanelStateNow();
                    location.href = saved;
                }
            }, 900);
        }
    }

    function getSmartSyncButtonText() {
        return isEggLogPage() ? 'Sync collected from logs' : 'Open egg logs';
    }

    /* ============================
     * OBSERVERS
     * ============================ */

    const obs_ops = { attributes: false, childList: true, characterData: false, subtree: true };

    const eeeh_observer = new MutationObserver(function () {
        if (document.getElementById('eggTraverse')) return;

        const sidebarReady = !!document.querySelector('#sidebar > div:first-of-type');

        if (ButtonFloat) {
            if (sidebarReady) insertNormal();
            else if (document.body) insertFloat();
        } else if (document.body) {
            insertFloat();
        }
    });

    const eggFinderObserver = new MutationObserver(function () {
        if (eggObserverTimer) return;
        eggObserverTimer = setTimeout(() => {
            eggObserverTimer = null;
            checkForEgg();
        }, 250);
    });

    /* ============================
     * LIFECYCLE
     * ============================ */

    function clearEggCheckTimers() {
        if (eggCheckTimer1) clearTimeout(eggCheckTimer1);
        if (eggCheckTimer2) clearTimeout(eggCheckTimer2);
        if (eggCheckFailsafeTimer) clearTimeout(eggCheckFailsafeTimer);
        eggCheckTimer1 = null;
        eggCheckTimer2 = null;
        eggCheckFailsafeTimer = null;
    }

    function setNavigatorCheckingState(isChecking) {
        eggCheckInProgress = !!isChecking;
        eggCheckStartedAt = eggCheckInProgress ? Date.now() : 0;
        applyStateThemes();
        updateEggCounterUI();
        refreshSettingsPanel();
    }

    function ensureCheckingStateNotStuck() {
        if (!eggCheckInProgress) return false;

        const age = Date.now() - (eggCheckStartedAt || 0);
        if (age > EGG_CHECK_MAX_MS) {
            eggCheckInProgress = false;
            eggCheckStartedAt = 0;
            clearEggCheckTimers();
            applyStateThemes();
            refreshSettingsPanel();
            return true;
        }
        return false;
    }

    function runEggCheckCycle() {
        clearEggCheckTimers();
        setNavigatorCheckingState(true);

        eggCheckTimer1 = setTimeout(() => {
            try {
                checkForEgg();
                syncNavigatorToPool();
                applyStateThemes();
                updateEggCounterUI();
                refreshSettingsPanel();
            } catch (err) {
                console.error('EggsTerminator check pass 1 failed:', err);
            }
        }, 180);

        eggCheckTimer2 = setTimeout(() => {
            try {
                checkForEgg();
                syncNavigatorToPool();
                applyStateThemes();
            } catch (err) {
                console.error('EggsTerminator check pass 2 failed:', err);
            } finally {
                eggCheckInProgress = false;
                eggCheckStartedAt = 0;
                updateEggCounterUI();
                refreshSettingsPanel();
                clearEggCheckTimers();
            }
        }, 850);

        eggCheckFailsafeTimer = setTimeout(() => {
            eggCheckInProgress = false;
            eggCheckStartedAt = 0;
            updateEggCounterUI();
            refreshSettingsPanel();
            clearEggCheckTimers();
        }, EGG_CHECK_MAX_MS);
    }

    window.addEventListener('hashchange', () => {
        if (eeh_is_disabled) {
            setTimeout(() => {
                eeh_is_disabled = false;
            }, 300);
        }
        runEggCheckCycle();
    }, false);

    window.addEventListener('load', () => {
        syncNavigatorToPool();
        ensureSettingsPanel();
        refreshSettingsPanel();

        const eggRootTarget = document.body || document.documentElement;
        if (eggRootTarget) {
            eggFinderObserver.observe(eggRootTarget, {
                childList: true,
                subtree: true
            });
        }

        runEggCheckCycle();
    });

    eeeh_observer.observe(document, obs_ops);

    /* ============================
     * NAVIGATION HELPERS
     * ============================ */

    function syncNavigatorToPool() {
        const traverse = document.getElementById('eggTraverse');
        if (!traverse) return;

        const pool = clampLinkIndexToPool();
        const href = resolvePageUrlByIndex(linkIndex) || '';
        const label = getPageLabel(href);
        const poolPos = getCurrentPoolPositionFromMasterIndex();

        traverse.setAttribute('href', href);

        const nameEl = traverse.querySelector('.eeh-name');
        if (nameEl && !eggCheckInProgress) {
            nameEl.textContent = label || 'Unknown';
        }

        const totalEl = traverse.querySelector('.eeh-total');
        if (totalEl) {
            totalEl.textContent = `${poolPos.pos}/${poolPos.size}`;
        }

        const stateEl = traverse.querySelector('.eeh-state');
        if (stateEl) {
            updateStateHtml(
                stateEl,
                traverse.classList.contains('eeh-float') ? getStateLabel() : `State: ${getStateLabel()}`
        );
        }

        const badgeEl = traverse.querySelector('.eeh-state-badge');
        if (badgeEl) {
            updateStateHtml(badgeEl, getStateLabel());
        }

        const countEl = traverse.querySelector('.eeh-count');
        if (countEl && !eggCheckInProgress) {
            countEl.textContent = traverse.classList.contains('eeh-float')
                ? `F:${getEggFoundCount()} C:${getEggCollectedCount()}`
            : `Found: ${getEggFoundCount()} • Collected: ${getEggCollectedCount()}`;
        }
    }

    function setEggTraverseClickEvent(eggButtonType) {
        const eggTraverse = $('#eggTraverse');
        const egg_icon = eggTraverse.find('.eeh-icon');

        eggTraverse.find('.eeh-gear').off('click').on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            toggleSettingsPanel();
            return false;
        });

        eggTraverse.off('mousedown touchstart mouseup touchend mouseleave contextmenu click');

        eggTraverse.on('mousedown touchstart', function (e) {
            if ($(e.target).closest('.eeh-gear').length) return;
            if (eggCheckInProgress) return;

            eeh_anim_pressTimer = window.setTimeout(function () {
                eeh_holding = true;
                egg_icon.fadeOut(eeh_reset_time);

                eeh_pressTimer = window.setTimeout(function () {
                    if (eeh_holding) {
                        linkIndex = 0;
                        egg_icon.fadeIn(eeh_fade_in);
                        lsSet('eeh-index', String(linkIndex));

                        clampLinkIndexToPool();
                        const href = resolvePageUrlByIndex(linkIndex) || '';
                        const poolPos = getCurrentPoolPositionFromMasterIndex();

                        eggTraverse.attr('href', href);

                        const nameEl = eggTraverse.find('.eeh-name');
                        if (nameEl.length) nameEl.text(getPageLabel(href));

                        const totalEl = eggTraverse.find('.eeh-total');
                        if (totalEl.length) totalEl.text(`${poolPos.pos}/${poolPos.size}`);

                        const stateEl = eggTraverse.find('.eeh-state');
                        if (stateEl.length) {
                            stateEl.html(eggButtonType === 'float' ? getStateLabel() : `State: ${getStateLabel()}`);
                        }

                        const badgeEl = eggTraverse.find('.eeh-state-badge');
                        if (badgeEl.length) {
                            badgeEl.html(getStateLabel());
                        }

                        refreshSettingsPanel();
                    }
                }, eeh_reset_time);
            }, eeh_fade_in);
        }).on('mouseup touchend mouseleave', function () {
            clearTimeout(eeh_anim_pressTimer);
            if (eeh_holding) {
                clearTimeout(eeh_pressTimer);
                eeh_holding = false;
                egg_icon.stop(true, true).fadeIn(eeh_fade_in);
            }
        }).on('contextmenu', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }).on('click', function (e) {
            if ($(e.target).closest('.eeh-gear').length) {
                e.preventDefault();
                return false;
            }

            e.preventDefault();

            if (eggCheckInProgress) {
                showToast('Please wait, checking page for egg...');
                return false;
            }

            if (eeh_holding) {
                eeh_holding = false;
                egg_icon.stop(true, true).fadeIn(eeh_fade_in);
            }

            saveLastButtonPosition();

            if (eeh_is_disabled) return false;
            eeh_is_disabled = true;

            incrementEggTraverse(eggButtonType);

            const href = eggTraverse.attr('href') || '';
            navigateToPage(href);

            setTimeout(() => {
                eeh_is_disabled = false;
            }, 1200);

            return false;
        });
    }

    function incrementEggTraverse(eggButtonType) {
        const flags = getCurrentFlags();
        const nextIndex = getNextAllowedMasterIndexAfter(linkIndex, flags);
        if (nextIndex === -1) return;

        linkIndex = nextIndex;
        lsSet('eeh-index', String(linkIndex));

        const eggTraverse = $('#eggTraverse');
        const nextHref = resolvePageUrlByIndex(linkIndex);
        const poolPos = getCurrentPoolPositionFromMasterIndex();

        eggTraverse.attr('href', nextHref);

        const nameEl = eggTraverse.find('.eeh-name');
        if (nameEl.length && !eggCheckInProgress) {
            nameEl.text(getPageLabel(nextHref));
        }

        const totalEl = eggTraverse.find('.eeh-total');
        if (totalEl.length) {
            totalEl.text(`${poolPos.pos}/${poolPos.size}`);
        }

        const stateText = getStateLabel();

        const stateEl = eggTraverse.find('.eeh-state');
        if (stateEl.length) {
            stateEl.html(eggButtonType === 'float' ? stateText : `State: ${stateText}`);
        }

        const badgeEl = eggTraverse.find('.eeh-state-badge');
        if (badgeEl.length) {
            badgeEl.html(stateText);
        }

        refreshSettingsPanel();
    }

    /* ============================
     * SETTINGS PANEL
     * ============================ */

    function isSettingsPanelOpenSaved() {
        return lsGet(SETTINGS_PANEL_OPEN_KEY, '0') === '1';
    }

    function saveSettingsPanelOpenState(panel) {
        lsSet(SETTINGS_PANEL_OPEN_KEY, panel && panel.classList.contains('open') ? '1' : '0');
    }

    function saveSettingsPanelStateNow() {
        const panel = document.getElementById('eeh-floating-panel');
        saveSettingsPanelOpenState(panel);
        if (panel && panel.classList.contains('open')) {
            clampPanelSizeAndPosition(panel);
            saveSettingsPanelGeometry(panel);
        }
    }

    function restoreSettingsPanelGeometry(panel) {
        if (!panel) return false;

        try {
            const raw = lsGet(SETTINGS_PANEL_GEOMETRY_KEY, null);
            if (!raw) return false;

            const data = JSON.parse(raw);
            if (!data || typeof data.left !== 'number' || typeof data.top !== 'number') return false;

            const scaleX = window.innerWidth / (data.vw || window.innerWidth);
            const scaleY = window.innerHeight / (data.vh || window.innerHeight);

            panel.style.left = `${data.left * scaleX}px`;
            panel.style.top = `${data.top * scaleY}px`;
            panel.style.width = `${(data.width || 280) * scaleX}px`;
            panel.style.height = `${(data.height || 360) * scaleY}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';

            clampPanelSizeAndPosition(panel);
            return true;
        } catch {
            return false;
        }
    }

    function saveSettingsPanelGeometry(panel) {
        if (!panel) return;

        try {
            const rect = panel.getBoundingClientRect();
            const width = parseFloat(panel.style.width) || rect.width;
            const height = parseFloat(panel.style.height) || rect.height;
            const left = parseFloat(panel.style.left);
            const top = parseFloat(panel.style.top);

            if (![width, height, left, top].every(Number.isFinite)) return;
            if (width <= 0 || height <= 0) return;

            lsSet(SETTINGS_PANEL_GEOMETRY_KEY, JSON.stringify({
                left,
                top,
                width,
                height,
                vw: window.innerWidth,
                vh: window.innerHeight
            }));
        } catch {}
    }

    function clampPanelSizeAndPosition(panel) {
        if (!panel) return;

        const minW = Math.min(220, window.innerWidth - 12);
        const minH = 180;

        let width = parseFloat(panel.style.width) || panel.offsetWidth || 280;
        let height = parseFloat(panel.style.height) || panel.offsetHeight || 360;

        width = Math.max(minW, Math.min(width, window.innerWidth - 8));
        height = Math.max(minH, Math.min(height, window.innerHeight - 8));

        panel.style.width = `${width}px`;
        panel.style.height = `${height}px`;

        clampPanelPositionOnly(panel);
    }

    function clampPanelPositionOnly(panel) {
        if (!panel) return;

        const width = panel.offsetWidth || parseFloat(panel.style.width) || 280;
        const height = panel.offsetHeight || parseFloat(panel.style.height) || 360;

        let left;
        let top;

        if (panel.style.left) {
            left = parseFloat(panel.style.left) || 0;
        } else {
            const rect = panel.getBoundingClientRect();
            left = rect.left;
        }

        if (panel.style.top) {
            top = parseFloat(panel.style.top) || 0;
        } else {
            const rect = panel.getBoundingClientRect();
            top = rect.top;
        }

        left = Math.max(4, Math.min(left, window.innerWidth - width - 4));
        top = Math.max(4, Math.min(top, window.innerHeight - height - 4));

        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    }

    function initSettingsPanelInteractions(panel) {
        if (!panel || panel.dataset.eehInteractive === '1') return;
        panel.dataset.eehInteractive = '1';

        const dragHandle = panel.querySelector('.eeh-panel-dragbar');
        const resizer = panel.querySelector('.eeh-panel-resizer');

        function startDrag(e) {
            if (e.target.closest('button')) return;
            const pt = getClientPoint(e);
            const rect = panel.getBoundingClientRect();

            panelDragState = {
                startX: pt.x,
                startY: pt.y,
                startLeft: rect.left,
                startTop: rect.top
            };

            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';

            e.preventDefault();
        }

        function startResize(e) {
            const pt = getClientPoint(e);
            const rect = panel.getBoundingClientRect();

            panelResizeState = {
                startX: pt.x,
                startY: pt.y,
                startW: rect.width,
                startH: rect.height,
                startLeft: rect.left,
                startTop: rect.top
            };

            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';

            e.preventDefault();
            e.stopPropagation();
        }

        function onMove(e) {
            if (panelDragState) {
                const pt = getClientPoint(e);
                let nextLeft = panelDragState.startLeft + (pt.x - panelDragState.startX);
                let nextTop = panelDragState.startTop + (pt.y - panelDragState.startY);

                const width = panel.offsetWidth;
                const height = panel.offsetHeight;

                nextLeft = Math.max(4, Math.min(nextLeft, window.innerWidth - width - 4));
                nextTop = Math.max(4, Math.min(nextTop, window.innerHeight - height - 4));

                panel.style.left = `${nextLeft}px`;
                panel.style.top = `${nextTop}px`;
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
                e.preventDefault();
            } else if (panelResizeState) {
                const pt = getClientPoint(e);

                const minW = Math.min(220, window.innerWidth - 12);
                const minH = 180;

                let nextW = panelResizeState.startW + (pt.x - panelResizeState.startX);
                let nextH = panelResizeState.startH + (pt.y - panelResizeState.startY);

                nextW = Math.max(minW, Math.min(nextW, window.innerWidth - panelResizeState.startLeft - 4));
                nextH = Math.max(minH, Math.min(nextH, window.innerHeight - panelResizeState.startTop - 4));

                panel.style.width = `${nextW}px`;
                panel.style.height = `${nextH}px`;
                e.preventDefault();
            }
        }

        function onUp() {
            if (panelDragState || panelResizeState) {
                panelDragState = null;
                panelResizeState = null;
                clampPanelSizeAndPosition(panel);
                saveSettingsPanelGeometry(panel);
            }
        }

        dragHandle.addEventListener('mousedown', startDrag);
        dragHandle.addEventListener('touchstart', startDrag, { passive: false });
        resizer.addEventListener('mousedown', startResize);
        resizer.addEventListener('touchstart', startResize, { passive: false });

        document.addEventListener('mousemove', onMove, { passive: false });
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
        window.addEventListener('resize', () => {
            if (!panel.classList.contains('open')) return;
            clampPanelSizeAndPosition(panel);
            saveSettingsPanelGeometry(panel);
        });
    }

    function ensureSettingsPanel() {
        const existing = document.getElementById('eeh-floating-panel');
        if (existing) return existing;

        const panel = document.createElement('div');
        panel.id = 'eeh-floating-panel';
        panel.innerHTML = `
            <div class="eeh-panel-dragbar">
                <h3>EggsTerminator</h3>
                <div class="eeh-panel-version">v${Version}</div>
            </div>

            <div class="eeh-panel-inner">
                <div class="eeh-options">
                    <button id="eeh-float-toggle">Toggle float</button>
                    <div>FLOAT BUTTON: <span id="eeh-float-toggle-label"></span></div>
                </div>

                <div class="eeh-options">
                    <button id="eeh-float-pos-toggle">Toggle position</button>
                    <div>POSITION: <span id="eeh-float-pos-toggle-label"></span></div>
                </div>

                <div class="eeh-options">
                    <button id="eeh-reset-index">Reset index</button>
                    <div>PAGE INDEX: <span id="eeh-index-label"></span></div>
                </div>

                <div class="eeh-options">
                    <button id="eeh-reset-count">Reset eggs</button>
                    <div>FOUND: <span id="eeh-found-label"></span></div>
                    <div>COLLECTED: <span id="eeh-collected-label"></span></div>
                </div>

                <div class="eeh-options">
                    <button id="eeh-sync-logs">Open egg logs</button>
                    <div>VISIBLE LOG ENTRIES: <span id="eeh-log-count-label">-</span></div>
                </div>

                <div class="eeh-options">
                    <div>PAGE: <span id="eeh-page-label"></span></div>
                    <div>POOL SIZE: <span id="eeh-pool-label"></span></div>
                    <div>STATE: <span id="eeh-state-label"></span></div>
                    <div>CHECK: <span id="eeh-check-label"></span></div>
                </div>
                <div class="eeh-options">
                        <button id="eeh-fake-egg">Spawn fake egg</button>
                        <div>TEST TOOL</div>
            </div>
            </div>

            <div class="eeh-panel-footer">
                <button id="eeh-forum-like" type="button" title="Open the release thread or press Like when already there">
                    <span class="eeh-forum-like-icon">👍</span>
                    <span>Like this script!</span>
                </button>
            </div>
            <div class="eeh-panel-resizer" title="Resize"></div>
        `;

        document.body.appendChild(panel);
        restoreSettingsPanelGeometry(panel);
        initSettingsPanelInteractions(panel);

        $('#eeh-float-toggle').on('click', function () {
            toggleFloatButton();
            refreshSettingsPanel();
        });

        $('#eeh-float-pos-toggle').on('click', function () {
            toggleFloatPosition();
            refreshSettingsPanel();
        });

        $('#eeh-reset-index').on('click', function () {
            linkIndex = 0;
            lsSet('eeh-index', '0');
            syncNavigatorToPool();
            updateEggCounterUI();
            refreshSettingsPanel();
            showToast('EggsTerminator index reset');
        });

        $('#eeh-reset-count').on('click', function () {
            resetEggCount();
        });

        $('#eeh-sync-logs').on('click', function () {
            syncEggCountSmart();
        });
        $('#eeh-fake-egg').on('click', function () {
            spawnFakeEgg();
        });
        $('#eeh-forum-like').on('click', function () {
            handleForumLikeAction();
        });
        document.addEventListener('click', function (e) {
            const openPanel = document.getElementById('eeh-floating-panel');
            if (!openPanel || !openPanel.classList.contains('open')) return;
            if (openPanel.contains(e.target)) return;
            if (e.target.closest('.eeh-gear')) return;
            openPanel.classList.remove('open');
            saveSettingsPanelOpenState(openPanel);
        }, true);

        if (isSettingsPanelOpenSaved()) {
            panel.classList.add('open');
            requestAnimationFrame(() => {
                clampPanelSizeAndPosition(panel);
                saveSettingsPanelGeometry(panel);
                refreshSettingsPanel();
            });
        }

        return panel;
    }

    function toggleSettingsPanel() {
        const panel = ensureSettingsPanel();
        panel.classList.toggle('open');
        saveSettingsPanelOpenState(panel);
        if (panel.classList.contains('open')) {
            requestAnimationFrame(() => {
                clampPanelSizeAndPosition(panel);
                saveSettingsPanelGeometry(panel);
                refreshSettingsPanel();
            });
        }
    }

    function refreshSettingsPanel() {
        ensureCheckingStateNotStuck();

        const panel = document.getElementById('eeh-floating-panel');
        if (!panel || !panel.classList.contains('open')) return;

        applyStateThemes();
        clampPanelSizeAndPosition(panel);

        const floatToggleLabel = document.getElementById('eeh-float-toggle-label');
        if (floatToggleLabel) {
            if (ButtonFloat) {
                floatToggleLabel.textContent = 'disabled';
                floatToggleLabel.classList.remove('eeh-green');
                floatToggleLabel.classList.add('eeh-red');
            } else {
                floatToggleLabel.textContent = 'enabled';
                floatToggleLabel.classList.remove('eeh-red');
                floatToggleLabel.classList.add('eeh-green');
            }
        }

        const floatPosLabel = document.getElementById('eeh-float-pos-toggle-label');
        if (floatPosLabel) {
            switch (ButtonFloatPos) {
                case 0: floatPosLabel.textContent = 'bottom left'; break;
                case 1: floatPosLabel.textContent = 'top left'; break;
                case 2: floatPosLabel.textContent = 'bottom right'; break;
                case 3: floatPosLabel.textContent = 'top right'; break;
                default: floatPosLabel.textContent = 'bottom left';
            }
        }

        const foundLabel = document.getElementById('eeh-found-label');
        if (foundLabel) {
            foundLabel.textContent = String(getEggFoundCount());
            foundLabel.classList.add('eeh-green');
        }

        const collectedLabel = document.getElementById('eeh-collected-label');
        if (collectedLabel) {
            collectedLabel.textContent = String(getEggCollectedCount());
            collectedLabel.classList.add('eeh-green');
        }

        const stateLabel = document.getElementById('eeh-state-label');
        if (stateLabel) stateLabel.textContent = getState();

        const checkLabel = document.getElementById('eeh-check-label');
        if (checkLabel) {
            checkLabel.textContent = eggCheckInProgress ? 'checking' : 'ready';
            checkLabel.classList.remove('eeh-green', 'eeh-red');
            checkLabel.classList.add(eggCheckInProgress ? 'eeh-red' : 'eeh-green');
        }

        const pool = getCurrentAllowedPool();
        const poolPos = getCurrentPoolPositionFromMasterIndex();

        const indexLabel = document.getElementById('eeh-index-label');
        if (indexLabel) {
            indexLabel.textContent = `${poolPos.pos}/${poolPos.size}`;
            indexLabel.classList.add('eeh-green');
        }

        const poolLabel = document.getElementById('eeh-pool-label');
        if (poolLabel) {
            poolLabel.textContent = `${pool.length}`;
            poolLabel.classList.add('eeh-green');
        }

        const pageLabel = document.getElementById('eeh-page-label');
        if (pageLabel) {
            const href = resolvePageUrlByIndex(linkIndex) || '';
            pageLabel.textContent = getPageLabel(href) || 'Unknown';
            pageLabel.classList.add('eeh-green');
        }

        const logCountLabel = document.getElementById('eeh-log-count-label');
        if (logCountLabel) {
            logCountLabel.textContent = isEggLogPage() ? String(getEggLogCountFromPage()) : '-';
            logCountLabel.classList.add('eeh-green');
        }

        const syncBtn = document.getElementById('eeh-sync-logs');
        if (syncBtn) {
            syncBtn.textContent = getSmartSyncButtonText();
        }
    }

    /* ============================
     * UI INSERTION
     * ============================ */

    function getEggIconHtml() {
        return `<img src="${CURRENT_EGG_ICON}" alt="Egg" class="eeh-icon-img">`;
    }

    function insertNormal() {
        if (document.getElementById('eggTraverse')) return;

        ensureCheckingStateNotStuck();

        clampLinkIndexToPool();

        const poolPos = getCurrentPoolPositionFromMasterIndex();
        const href = resolvePageUrlByIndex(linkIndex) || '';
        const label = getPageLabel(href);

        const html = `
            <div class="eeh-link">
                <a href="${href}" id="eggTraverse">
                    <span class="eeh-icon">${getEggIconHtml()}</span>
                    <span class="eeh-sidebar-wrap">
                        <span class="eeh-name">${eggCheckInProgress ? 'Checking...' : label}</span>
                        <span class="eeh-state-row">
                            <span class="eeh-state">State: ${getStateLabel()}</span>
                        </span>
                        <span class="eeh-total">${poolPos.pos}/${poolPos.size}</span>
                        <span class="eeh-count">${eggCheckInProgress ? 'Checking page...' : `Found: ${getEggFoundCount()} • Collected: ${getEggCollectedCount()}`}</span>
                    </span>
                    <span class="eeh-gear" title="Settings">⚙</span>
                </a>
            </div>`;

        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.firstChild) {
            $('#sidebar > *').first().after(html);
            setEggTraverseClickEvent('sidebar');
        } else {
            $('body').append(`
                <a href="${href}" id="eggTraverse" class="eeh-float">
                    <span class="eeh-icon">${getEggIconHtml()}</span>
                    <span class="eeh-wrap">
                        <span class="eeh-name">${eggCheckInProgress ? 'Checking...' : label}</span>
                        <span class="eeh-state">${getStateLabel()}</span>
                        <span class="eeh-total">${poolPos.pos}/${poolPos.size}</span>
                        <span class="eeh-count">${eggCheckInProgress ? 'Checking...' : `F:${getEggFoundCount()} C:${getEggCollectedCount()}`}</span>
                    </span>
                    <span class="eeh-gear" title="Settings">⚙</span>
                </a>
            `);
            setFloatPosition();
            setEggTraverseClickEvent('float');
        }

        insertStyle();
        ensureSettingsPanel();
        updateNavigatorVisibility();
        updateEggCounterUI();
        applyStateThemes();
    }

    function insertFloat() {
        if (document.getElementById('eggTraverse')) return;
        ensureCheckingStateNotStuck();
        clampLinkIndexToPool();

        const poolPos = getCurrentPoolPositionFromMasterIndex();
        const href = resolvePageUrlByIndex(linkIndex) || '';
        const label = getPageLabel(href);

        const html = `
            <a href="${href}" id="eggTraverse" class="eeh-float">
                <span class="eeh-icon">${getEggIconHtml()}</span>
                <span class="eeh-wrap">
                    <span class="eeh-name">${eggCheckInProgress ? 'Checking...' : label}</span>
                    <span class="eeh-state-badge">${getStateLabel()}</span>
                    <span class="eeh-total">${poolPos.pos}/${poolPos.size}</span>
                    <span class="eeh-count">${eggCheckInProgress ? 'Checking...' : `F:${getEggFoundCount()} C:${getEggCollectedCount()}`}</span>
                </span>
                <span class="eeh-gear" title="Settings">⚙</span>
            </a>`;

        $('body').append(html);
        setFloatPosition();
        setEggTraverseClickEvent('float');
        insertStyle();
        ensureSettingsPanel();
        updateNavigatorVisibility();
        updateEggCounterUI();
        syncNavigatorToPool();
        applyStateThemes();
    }

    /* ============================
     * EGG OVERLAY / TOAST
     * ============================ */

    function ensureEggBlocker() {
        let blocker = document.getElementById(BLOCKER_ID);
        if (!blocker) {
            blocker = document.createElement('div');
            blocker.id = BLOCKER_ID;
            blocker.innerHTML = `<div class="eeh-blocker-msg">🥚 Egg detected — collect it first</div>`;

            blocker.addEventListener('click', function (e) {
                const eggRoot = document.getElementById('easter-egg-hunt-root');
                if (eggRoot && eggRoot.contains(e.target)) return;
                e.preventDefault();
                e.stopPropagation();
            }, true);

            document.body.appendChild(blocker);
        }
        return blocker;
    }

    function showEggBlocker() {
        const realEgg = document.getElementById('easter-egg-hunt-root');
        const fakeEgg = document.getElementById('modul-fake-egg-root');

        if (!realEgg && !fakeEgg) return;
        if (!document.body) return;

        const blocker = ensureEggBlocker();
        blocker.style.display = 'block';

        if (realEgg) {
            realEgg.style.zIndex = '1000002';
            realEgg.style.pointerEvents = 'auto';
        }

        if (fakeEgg) {
            fakeEgg.style.zIndex = '1000002';
            fakeEgg.style.pointerEvents = 'none';
        }
    }

    function hideEggBlocker() {
        const blocker = document.getElementById(BLOCKER_ID);
        if (blocker) blocker.style.display = 'none';
    }

    function getActiveEggToastRect() {
        const candidates = [
            document.querySelector('#modul-fake-egg-root .modul-egg-button'),
            document.querySelector('#easter-egg-hunt-root .modul-egg-button'),
            document.querySelector('#easter-egg-hunt-root button')
        ].filter(Boolean);

        for (const el of candidates) {
            const rect = el.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) return rect;
        }

        const realEgg = document.getElementById('easter-egg-hunt-root');
        const fakeEgg = document.getElementById('modul-fake-egg-root');
        if (!realEgg && !fakeEgg) return null;

        const target = getEggTargetPlacement();
        return {
            left: target.left,
            top: target.top,
            right: target.left + target.width,
            bottom: target.top + target.height,
            width: target.width,
            height: target.height
        };
    }

    function copyRect(rect) {
        if (!rect) return null;
        return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
        };
    }

    function copyVisibleRectFromElement(el) {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return null;
        return copyRect(rect);
    }

    function positionToast(toast, anchorRect = null) {
        const eggRect = anchorRect || getActiveEggToastRect();

        toast.style.left = '50%';
        toast.style.top = 'auto';
        toast.style.right = 'auto';
        toast.style.bottom = '24px';

        if (!eggRect) return;

        const toastWidth = toast.offsetWidth || 220;
        const toastHeight = toast.offsetHeight || 48;
        const minCenterX = TOAST_SCREEN_MARGIN_PX + (toastWidth / 2);
        const maxCenterX = Math.max(
            minCenterX,
            window.innerWidth - TOAST_SCREEN_MARGIN_PX - (toastWidth / 2)
        );
        const eggCenterX = eggRect.left + (eggRect.width / 2);
        const centerX = Math.max(minCenterX, Math.min(eggCenterX, maxCenterX));

        const eggIsBottomPosition = (eggRect.top + (eggRect.height / 2)) >= (window.innerHeight / 2);
        let top = eggIsBottomPosition
            ? eggRect.top - toastHeight - TOAST_EGG_GAP_PX
            : eggRect.bottom + TOAST_EGG_GAP_PX;

        if (top < TOAST_SCREEN_MARGIN_PX) {
            top = eggRect.bottom + TOAST_EGG_GAP_PX;
        }

        if (top + toastHeight > window.innerHeight - TOAST_SCREEN_MARGIN_PX) {
            top = eggRect.top - toastHeight - TOAST_EGG_GAP_PX;
        }

        top = Math.max(
            TOAST_SCREEN_MARGIN_PX,
            Math.min(top, window.innerHeight - toastHeight - TOAST_SCREEN_MARGIN_PX)
        );

        toast.style.left = `${centerX}px`;
        toast.style.top = `${top}px`;
        toast.style.bottom = 'auto';
    }

    function showToast(message, anchorRect = null) {
        let toast = document.getElementById(TOAST_ID);
        if (!toast) {
            toast = document.createElement('div');
            toast.id = TOAST_ID;
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.remove('show');
        positionToast(toast, anchorRect);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });
        });

        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2200);
    }

    function getNavigatorRoot() {
        const btn = document.getElementById('eggTraverse');
        if (!btn) return null;
        return btn.closest('.eeh-link') || btn;
    }

    function hideNavigator() {
        const btn = document.getElementById('eggTraverse');
        if (!btn) return;

        const root = btn.closest('.eeh-link') || btn;
        root.classList.add('eeh-hidden-by-egg');

        if (root === btn) {
            btn.style.display = 'none';
        }
    }

    function showNavigator() {
        const btn = document.getElementById('eggTraverse');
        if (!btn) return;

        const root = btn.closest('.eeh-link') || btn;
        root.classList.remove('eeh-hidden-by-egg');

        if (root === btn) {
            btn.style.display = '';
        }
    }

    function updateNavigatorVisibility() {
        if (hasVisibleFakeEgg()) {
            hideNavigator();
            showEggBlocker();
            return;
        }

        if (lsGet(getEggFoundFlagKeyForPage(), null) === '1') {
            hideNavigator();
            showEggBlocker();
        } else {
            showNavigator();
            hideEggBlocker();
        }
    }

    /* ============================
     * EGG FINDER
     * ============================ */

    function markEggFound() {
        const foundKey = getEggFoundFlagKeyForPage();

        if (lsGet(foundKey, null) !== '1') {
            lsSet(foundKey, '1');
            incrementEggFoundCount();
            showToast(`Egg found • Found ${getEggFoundCount()} • Collected ${getEggCollectedCount()}`);
        }

        hideNavigator();
        showEggBlocker();
    }

    function markEggCollected(anchorRect = null) {
        const foundKey = getEggFoundFlagKeyForPage();
        const collectedKey = getEggCollectedFlagKeyForPage();

        if (lsGet(collectedKey, null) !== '1') {
            lsSet(collectedKey, '1');
            incrementEggCollectedCount();
            showToast(`Egg collected • Found ${getEggFoundCount()} • Collected ${getEggCollectedCount()}`, anchorRect);
        }

        lsRemove(foundKey);
        showNavigator();
        hideEggBlocker();
    }

    function clearEggFound() {
        if (hasVisibleFakeEgg()) {
            hideNavigator();
            showEggBlocker();
            return;
        }

        lsRemove(getEggFoundFlagKeyForPage());
        showNavigator();
        hideEggBlocker();
    }

    function checkForEgg() {
        if (hasVisibleFakeEgg()) {
            hideNavigator();
            showEggBlocker();
            return;
        }

        const egg = document.getElementById('easter-egg-hunt-root');

        if (!egg) {
            clearEggFound();
            return;
        }

        if (egg.dataset.modulProcessed === '1') {
            if (lsGet(getEggFoundFlagKeyForPage(), null) === '1') {
                hideNavigator();
                showEggBlocker();
            }
            return;
        }

        egg.dataset.modulProcessed = '1';
        egg.classList.add('egg-finder-found');
        enhanceEgg(egg);
        markEggFound();
        bindEggRestore(egg);
    }
    function hasVisibleFakeEgg() {
        return !!document.getElementById('modul-fake-egg-root');
    }
    function getEggTargetPlacement() {
        const navPos = getCurrentNavigatorPosition();
        if (ButtonFloat && navPos && !navPos.isFloat) {
            const width = Math.max(48, Math.min(navPos.width, window.innerWidth - 8));
            const height = Math.max(48, Math.min(navPos.height, window.innerHeight - 8));
            let left = navPos.left;
            let top = navPos.top;

            left = Math.max(4, Math.min(window.innerWidth - width - 4, left));
            top = Math.max(4, Math.min(window.innerHeight - height - 4, top));

            return { left, top, width, height };
        }

        const savedPos = getLastButtonPosition();

        const width = savedPos ? Math.max(48, savedPos.width) : 96;
        const height = savedPos ? Math.max(48, savedPos.height) : 60;

        let left = savedPos ? savedPos.cx - (width / 2) : (window.innerWidth * 0.4);
        let top = savedPos ? savedPos.cy - (height / 2) : (window.innerHeight * 0.4);

        left = Math.max(4, Math.min(window.innerWidth - width - 4, left));
        top = Math.max(4, Math.min(window.innerHeight - height - 4, top));

        return { left, top, width, height };
    }

    function getCurrentNavigatorPosition() {
        const btn = document.getElementById('eggTraverse');
        if (!btn) return null;

        const rect = btn.getBoundingClientRect();
        if (!rect || !rect.width || !rect.height) return null;

        return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            cx: rect.left + (rect.width / 2),
            cy: rect.top + (rect.height / 2),
            width: rect.width,
            height: rect.height,
            isFloat: btn.classList.contains('eeh-float')
        };
    }
    function enhanceEgg(egg) {
        let moveAttempts = 0;

        function moveEgg() {
            if (!egg || !egg.isConnected) return;

            const buttons = egg.querySelectorAll('button');
            if (!buttons.length) {
                moveAttempts++;
                if (moveAttempts < EGG_BUTTON_MAX_ATTEMPTS) {
                    setTimeout(moveEgg, EGG_BUTTON_MOVE_RETRY_MS);
                }
                return;
            }

            const target = getEggTargetPlacement();

            buttons.forEach(b => {
                b.classList.add('modul-egg-button');
                b.style.left = `${target.left}px`;
                b.style.top = `${target.top}px`;
                b.style.width = `${target.width}px`;
                b.style.height = `${target.height}px`;

                const img = b.querySelector('img, svg, canvas');
                if (img) {
                    img.classList.add('modul-egg-media');
                }
            });
        }

        moveEgg();
    }

    function bindEggRestore(egg) {
        if (egg.dataset.modulEggRestoreBound === '1') return;
        egg.dataset.modulEggRestoreBound = '1';
        let bindAttempts = 0;

        function getClickedEggRect(target) {
            const button = target?.closest?.('button') || egg.querySelector('button');
            return copyVisibleRectFromElement(button);
        }

        function tryRestoreAfterClick(anchorRect = null) {
            setTimeout(() => {
                const remainingButtons = egg.querySelectorAll('button');
                if (remainingButtons.length === 0) {
                    markEggCollected(anchorRect);
                } else {
                    hideNavigator();
                    showEggBlocker();
                }
            }, 150);
        }

        egg.addEventListener('click', function (e) {
            tryRestoreAfterClick(getClickedEggRect(e.target));
        }, true);

        const bindButtons = () => {
            if (!egg || !egg.isConnected) return;

            const buttons = egg.querySelectorAll('button');
            if (!buttons.length) {
                bindAttempts++;
                if (bindAttempts < EGG_BUTTON_MAX_ATTEMPTS) {
                    setTimeout(bindButtons, EGG_BUTTON_BIND_RETRY_MS);
                }
                return;
            }

            buttons.forEach(btn => {
                if (btn.dataset.modulEggRestoreBound === '1') return;
                btn.dataset.modulEggRestoreBound = '1';
                btn.addEventListener('click', function () {
                    tryRestoreAfterClick(copyVisibleRectFromElement(btn));
                }, true);
            });
        };

        bindButtons();
    }
    /* ======================
  * PREVIEW SPAWN FAKE EGG
  * ====================== */
    function spawnFakeEgg() {
        let root = document.getElementById('modul-fake-egg-root');
        if (root) root.remove();

        root = document.createElement('div');
        root.id = 'modul-fake-egg-root';
        root.innerHTML = `
        <button type="button" class="modul-egg-button" aria-label="Fake egg preview">
            <img src="${CURRENT_EGG_ICON}" alt="Fake egg" class="modul-egg-media">
        </button>
    `;

        document.body.appendChild(root);

        const btn = root.querySelector('.modul-egg-button');
        if (!btn) return;

        const target = getEggTargetPlacement();

        btn.style.left = `${target.left}px`;
        btn.style.top = `${target.top}px`;
        btn.style.width = `${target.width}px`;
        btn.style.height = `${target.height}px`;

        hideNavigator();
        showEggBlocker();

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const fakeEggToastRect = copyVisibleRectFromElement(btn);
            root.remove();
            showNavigator();
            hideEggBlocker();
            showToast('Fake egg dismissed', fakeEggToastRect);
        }, true);
    }
    /* ============================
     * FLOAT / SIDEBAR TOGGLES
     * ============================ */

    function killButton() {
        const eeh_button = document.getElementById('eggTraverse');
        if (eeh_button) {
            const parent = eeh_button.closest('.eeh-link');
            if (parent) parent.remove();
            else eeh_button.remove();
        }
    }

    function toggleFloatButton() {
        killButton();
        if (ButtonFloat) {
            ButtonFloat = 0;
            insertFloat();
        } else {
            ButtonFloat = 1;
            insertNormal();
        }
        lsSet('eeh-float', String(ButtonFloat));
        refreshSettingsPanel();
        return ButtonFloat;
    }

    function toggleFloatPosition() {
        const float_button = document.querySelector('#eggTraverse.eeh-float');
        if (!float_button) return ButtonFloatPos;

        ButtonFloatPos++;
        if (ButtonFloatPos >= 4) ButtonFloatPos = 0;
        setFloatPosition();
        refreshSettingsPanel();
        return ButtonFloatPos;
    }

    function setFloatPosition() {
        const float_button = document.querySelector('#eggTraverse.eeh-float');
        if (!float_button) return;

        float_button.classList.remove('eeh-float-bottom', 'eeh-float-top', 'eeh-float-left', 'eeh-float-right');

        switch (ButtonFloatPos) {
            case 0: float_button.classList.add('eeh-float-bottom', 'eeh-float-left'); break;
            case 1: float_button.classList.add('eeh-float-top', 'eeh-float-left'); break;
            case 2: float_button.classList.add('eeh-float-bottom', 'eeh-float-right'); break;
            case 3: float_button.classList.add('eeh-float-top', 'eeh-float-right'); break;
            default: float_button.classList.add('eeh-float-bottom', 'eeh-float-left');
        }

        lsSet('eeh-float-pos', String(ButtonFloatPos));
    }

    /* ============================
     * STYLES
     * ============================ */

    function insertStyle() {
        if (document.getElementById('modul-egg-style')) return;

        addStyle(`
#eggTraverse.eeh-float {
    cursor: pointer;
    transition:
        transform 0.12s ease,
        box-shadow 0.18s ease,
        background 0.18s ease,
        border-color 0.18s ease,
        opacity 0.18s ease;
}

#eggTraverse.eeh-float:hover {
    transform: translateY(-2px);
    border-color: rgba(0,255,170,0.6);
    box-shadow:
        0 6px 18px rgba(0,0,0,0.6),
        0 0 8px rgba(0,255,170,0.25),
        inset 0 0 6px rgba(0,255,170,0.08);
}

#eggTraverse.eeh-float:active {
    transform: translateY(1px) scale(0.97);
    box-shadow:
        0 2px 6px rgba(0,0,0,0.7),
        inset 0 0 10px rgba(0,0,0,0.6);
}

#eggTraverse.eeh-float:hover .eeh-name {
    color: #00ffaa;
    text-shadow: 0 0 6px rgba(0,255,170,0.4);
}

#eggTraverse.eeh-float:hover .eeh-icon {
    filter: drop-shadow(0 0 4px rgba(0,255,170,0.5));
}

#eggTraverse .eeh-gear {
    transition: transform 0.2s ease, filter 0.2s ease;
}

#eggTraverse .eeh-gear:hover {
    transform: rotate(25deg) scale(1.1);
    filter: brightness(1.3);
}

#eggTraverse.eeh-disabled,
.eeh-link a.eeh-disabled {
    opacity: 0.58;
    cursor: wait !important;
}

#eggTraverse.eeh-disabled:hover {
    transform: none;
}

.eeh-link {
    background-color: var(--default-bg-panel-color);
    cursor: pointer;
    overflow: hidden;
    vertical-align: top;
    border-bottom-right-radius: 5px;
    border-top-right-radius: 5px;
    margin-top: 2px;
    min-height: 30px;
    margin-bottom: 2px;
    position: relative;
    transition: background .18s ease, box-shadow .18s ease, border-color .18s ease;
}

.eeh-link:hover {
    background-color: var(--default-bg-panel-active-color);
}

.eeh-link a {
    display: flex;
    align-items: center;
    color: var(--default-color);
    text-decoration: none;
    min-height: 30px;
    padding: 1px 24px 1px 0;
    position: relative;
}

.eeh-link a .eeh-icon {
    width: 34px;
    min-height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 34px;
}

.eeh-icon .eeh-icon-img {
    display: block;
    width: 24px;
    height: 24px;
    object-fit: contain;
    filter: drop-shadow(0px 0.7px 0.8px rgba(255,255,255,.45));
}

.eeh-float .eeh-icon .eeh-icon-img {
    width: 34px;
    height: 34px;
}

body.dark-mode .eeh-icon .eeh-icon-img {
    filter: drop-shadow(0px 0px 1.3px rgba(0,0,0,.8));
}

.eeh-link a .eeh-name,
.eeh-float .eeh-name {
    display: block;
    width: 100%;
    max-width: 100%;
    line-height: 14px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.eeh-sidebar-wrap {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
}

.eeh-state-row {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
}

.eeh-count,
.eeh-total,
.eeh-state,
.eeh-state-badge {
    display: block;
    font-size: 10px;
    line-height: 11px;
    opacity: 0.95;
    white-space: nowrap;
}

.eeh-link a .eeh-count,
.eeh-link a .eeh-total,
.eeh-link a .eeh-state,
.eeh-link a .eeh-state-badge {
    color: var(--default-color);
    margin-top: 1px;
}

.eeh-float .eeh-wrap {
    font-size: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
    width: 76px;
}

.eeh-handcuffs-icon {
    display: inline-block;
}

#eggTraverse.eeh-float {
    z-index: 999999;
    min-height: 56px;
    width: 128px;
    cursor: pointer;
    padding: 4px 18px 4px 6px;
    box-sizing: border-box;
    border: 1px solid var(--default-panel-divider-outer-side-color);
    position: fixed;
    box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
    display: flex;
    align-items: center;
    text-shadow: var(--default-tabs-text-shadow);
    background: var(--info-msg-bg-gradient);
    border-radius: 5px;
    overflow: hidden;
    font-size: 15px;
    font-weight: 700;
    line-height: 18px;
    font-family: Arial, sans-serif;
    color: var(--default-color);
    text-decoration: none;
}

#eggTraverse.eeh-float.eeh-float-top { top: 80px; }
#eggTraverse.eeh-float.eeh-float-bottom { bottom: 80px; }
#eggTraverse.eeh-float.eeh-float-left { left: 2px; justify-content: right; }
#eggTraverse.eeh-float.eeh-float-right { right: 2px; justify-content: left; }

.eeh-gear {
    position: absolute;
    top: 2px;
    right: 4px;
    font-size: 14px;
    line-height: 14px;
    opacity: 0.7;
    cursor: pointer;
    user-select: none;
}

.eeh-gear:hover {
    opacity: 1;
}

#eeh-floating-panel {
    position: fixed;
    top: 120px;
    right: 20px;
    width: 280px;
    height: 360px;
    min-width: 220px;
    min-height: 180px;
    max-width: calc(100vw - 8px);
    max-height: calc(100vh - 8px);
    background: linear-gradient(180deg, #3c3c3c 0%, #353535 100%);
    border: 2px solid rgba(0,0,0,.45);
    border-radius: 8px;
    z-index: 1000005;
    display: none;
    box-shadow: 0 10px 28px rgba(0,0,0,.45);
    overflow: hidden;
    transition: background .18s ease, border-color .18s ease, box-shadow .18s ease;
}

#eeh-floating-panel.open {
    display: flex;
    flex-direction: column;
}

.eeh-panel-dragbar {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    cursor: move;
    padding: 14px 12px 6px;
    user-select: none;
    touch-action: none;
    border-bottom: 1px solid rgba(255,255,255,.08);
    background: linear-gradient(180deg, rgba(255,255,255,.04) 0%, rgba(0,0,0,.08) 100%);
}

.eeh-panel-dragbar h3 {
    margin: 4px 0 2px;
    font-family: Arial, sans-serif;
    font-size: 17px;
    font-weight: 700;
    line-height: 1.2;
    color: #f1f1f1;
    text-align: center;
    letter-spacing: .2px;
}

.eeh-panel-version {
    margin: 0 0 4px;
    font-family: Arial, sans-serif;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    color: #a7a7a7;
    text-align: center;
}

.eeh-panel-inner {
    flex: 1 1 auto;
    overflow: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    scrollbar-width: thin;
    scrollbar-color: #a7a7a7 #4a4a4a;
}

.eeh-panel-inner::-webkit-scrollbar {
    width: 10px;
}

.eeh-panel-inner::-webkit-scrollbar-track {
    background: #4a4a4a;
    border-radius: 8px;
}

.eeh-panel-inner::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #cfcfcf 0%, #9f9f9f 100%);
    border-radius: 8px;
    border: 2px solid #4a4a4a;
}

.eeh-panel-inner::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #dfdfdf 0%, #b3b3b3 100%);
}

.eeh-panel-footer {
    flex: 0 0 auto;
    padding: 0 10px 12px;
    border-top: 1px solid rgba(255,255,255,.08);
    background: linear-gradient(180deg, rgba(255,255,255,.03) 0%, rgba(0,0,0,.1) 100%);
}

#eeh-floating-panel .eeh-panel-footer button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 36px;
    padding: 8px 12px;
    background: linear-gradient(180deg, #d84848 0%, #aa2626 55%, #7f1717 100%);
    border: 1px solid rgba(0,0,0,.35);
    border-radius: 7px;
    color: #fff;
    font-family: Arial, sans-serif;
    font-size: 11px;
    font-weight: 700;
    line-height: 16px;
    text-transform: uppercase;
    text-shadow: 0 1px 0 rgba(0,0,0,.35);
    cursor: pointer;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14);
    transition: transform .08s ease, filter .15s ease;
}

#eeh-floating-panel .eeh-panel-footer button:hover,
#eeh-floating-panel .eeh-panel-footer button:focus {
    filter: brightness(1.06);
}

#eeh-floating-panel .eeh-panel-footer button:active {
    transform: translateY(1px);
}

.eeh-forum-like-icon {
    font-size: 14px;
    line-height: 1;
}

#eeh-floating-panel .eeh-options {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 10px;
    border: 2px solid rgba(0,0,0,.4);
    border-radius: 6px;
    margin: 0;
    background: linear-gradient(180deg, #454545 0%, #3d3d3d 100%);
    text-align: center;
    font-size: 12px;
    color: #e7e7e7;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
}

#eeh-floating-panel .eeh-options button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 132px;
    max-width: 100%;
    background: linear-gradient(180deg, #d7d7d7 0%, #afafaf 55%, #8a8a8a 100%);
    border-radius: 7px;
    font-family: Arial, sans-serif;
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    color: #333;
    text-shadow: 0 1px 0 rgba(255,255,255,.45);
    text-decoration: none;
    text-transform: uppercase;
    margin: 0;
    border: 1px solid rgba(0,0,0,.25);
    outline: none;
    overflow: hidden;
    box-sizing: border-box;
    line-height: 16px;
    padding: 7px 12px;
    white-space: nowrap;
    cursor: pointer;
    transition: transform .08s ease, filter .15s ease;
}

#eeh-floating-panel .eeh-options button:hover,
#eeh-floating-panel .eeh-options button:focus {
    filter: brightness(1.05);
}

#eeh-floating-panel .eeh-options button:active {
    transform: translateY(1px);
}

.eeh-panel-resizer {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 22px;
    height: 22px;
    cursor: nwse-resize;
    touch-action: none;
    background:
        linear-gradient(135deg, transparent 0 48%, rgba(255,255,255,.18) 48% 52%, transparent 52%) no-repeat center center;
}

.eeh-green { color: var(--user-status-green-color); }
.eeh-red { color: var(--user-status-red-color); }
.eeh-hidden-by-egg { display: none !important; }

#${TOAST_ID} {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%) translateY(20px);
    z-index: 1000001;
    min-width: 220px;
    max-width: min(90vw, 420px);
    padding: 12px 16px;
    border-radius: 12px;
    color: #fff;
    font: 700 14px/1.35 Arial, sans-serif;
    text-align: center;
    background: linear-gradient(180deg, rgba(43,43,43,.96) 0%, rgba(18,18,18,.96) 100%);
    border: 1px solid rgba(255,255,255,.12);
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
    opacity: 0;
    pointer-events: none;
    transition: opacity .22s ease, transform .22s ease;
}

#${TOAST_ID}.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}

#${BLOCKER_ID} {
    position: fixed;
    inset: 0;
    z-index: 1000000;
    background: rgba(0,0,0,0.72);
    backdrop-filter: blur(10px) brightness(0.45) saturate(0.7);
    -webkit-backdrop-filter: blur(10px) brightness(0.45) saturate(0.7);
    pointer-events: auto;
    display: none;
}

#${BLOCKER_ID} .eeh-blocker-msg {
    position: absolute;
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    background: #111;
    color: #fff;
    padding: 14px 20px;
    border: 1px solid #444;
    border-radius: 10px;
    font-weight: bold;
    text-align: center;
    max-width: min(90vw, 320px);
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
}

#easter-egg-hunt-root,
#easter-egg-hunt-root * {
    pointer-events: auto !important;
}

#easter-egg-hunt-root {
    z-index: 1000002 !important;
}

@media screen and (max-width: 1000px) {
    html:not(.html-manual-desktop) #eggTraverse.eeh-float.eeh-float-top {
        top: 170px !important;
    }

    #eeh-floating-panel {
        right: 8px;
        width: min(280px, calc(100vw - 8px));
        height: min(360px, calc(100vh - 8px));
    }
}

#eggTraverse.eeh-state-home,
.eeh-link.eeh-state-home,
#eeh-floating-panel.eeh-state-home {
    color: var(--default-color);
}

#eggTraverse.eeh-state-home {
    background: var(--info-msg-bg-gradient);
    border-color: var(--default-panel-divider-outer-side-color);
}

.eeh-link.eeh-state-home {
    background-color: var(--default-bg-panel-color);
}

#eeh-floating-panel.eeh-state-home {
    background: linear-gradient(180deg, #3c3c3c 0%, #353535 100%);
    border-color: rgba(0,0,0,.45);
}

#eggTraverse.eeh-state-hospital,
.eeh-link.eeh-state-hospital,
#eeh-floating-panel.eeh-state-hospital {
    color: #ffffff;
}

#eggTraverse.eeh-state-hospital {
    background: linear-gradient(180deg, #6a2525 0%, #4d1c1c 100%);
    border-color: rgba(120,20,20,.75);
    box-shadow: 0 2px 12px rgba(60,0,0,.35);
}

.eeh-link.eeh-state-hospital {
    background: linear-gradient(180deg, #5f2323 0%, #451818 100%);
}

#eeh-floating-panel.eeh-state-hospital {
    background: linear-gradient(180deg, #5f2323 0%, #451818 100%);
    border-color: rgba(120,20,20,.75);
}

#eggTraverse.eeh-state-hospital .eeh-name,
#eggTraverse.eeh-state-hospital .eeh-state,
#eggTraverse.eeh-state-hospital .eeh-total,
#eggTraverse.eeh-state-hospital .eeh-count,
#eggTraverse.eeh-state-hospital .eeh-state-badge,
.eeh-link.eeh-state-hospital .eeh-name,
.eeh-link.eeh-state-hospital .eeh-state,
.eeh-link.eeh-state-hospital .eeh-total,
.eeh-link.eeh-state-hospital .eeh-count,
.eeh-link.eeh-state-hospital .eeh-state-badge,
#eeh-floating-panel.eeh-state-hospital .eeh-panel-dragbar h3,
#eeh-floating-panel.eeh-state-hospital .eeh-options {
    color: #ffffff !important;
}

#eggTraverse.eeh-state-jail,
.eeh-link.eeh-state-jail,
#eeh-floating-panel.eeh-state-jail {
    color: #fff3e6;
}

#eggTraverse.eeh-state-jail {
    background: linear-gradient(180deg, #9a5617 0%, #774212 100%);
    border-color: rgba(100,55,10,.75);
    box-shadow: 0 2px 12px rgba(70,35,0,.35);
}

.eeh-link.eeh-state-jail {
    background: linear-gradient(180deg, #8f5015 0%, #6d3d10 100%);
}

#eeh-floating-panel.eeh-state-jail {
    background: linear-gradient(180deg, #8f5015 0%, #6d3d10 100%);
    border-color: rgba(100,55,10,.75);
}

#eggTraverse.eeh-state-jail .eeh-name,
#eggTraverse.eeh-state-jail .eeh-state,
#eggTraverse.eeh-state-jail .eeh-total,
#eggTraverse.eeh-state-jail .eeh-count,
#eggTraverse.eeh-state-jail .eeh-state-badge,
.eeh-link.eeh-state-jail .eeh-name,
.eeh-link.eeh-state-jail .eeh-state,
.eeh-link.eeh-state-jail .eeh-total,
.eeh-link.eeh-state-jail .eeh-count,
.eeh-link.eeh-state-jail .eeh-state-badge,
#eeh-floating-panel.eeh-state-jail .eeh-panel-dragbar h3,
#eeh-floating-panel.eeh-state-jail .eeh-options {
    color: #fff3e6 !important;
}

#eeh-floating-panel.eeh-state-jail .eeh-panel-dragbar h3,
#eeh-floating-panel.eeh-state-jail .eeh-options {
    color: #fff3e6 !important;
}

/* FLYING */
#eggTraverse.eeh-state-travelling,
.eeh-link.eeh-state-travelling,
#eeh-floating-panel.eeh-state-travelling {
    color: #e9f6ff;
}

#eggTraverse.eeh-state-travelling {
    background: linear-gradient(180deg, #225070 0%, #183b53 100%);
    border-color: rgba(20,80,120,.75);
    box-shadow: 0 2px 12px rgba(0,25,45,.35);
}

.eeh-link.eeh-state-travelling {
    background: linear-gradient(180deg, #214a68 0%, #163449 100%);
}

#eeh-floating-panel.eeh-state-travelling {
    background: linear-gradient(180deg, #214a68 0%, #163449 100%);
    border-color: rgba(20,80,120,.75);
}

#eggTraverse.eeh-state-travelling .eeh-name,
#eggTraverse.eeh-state-travelling .eeh-state,
#eggTraverse.eeh-state-travelling .eeh-total,
#eggTraverse.eeh-state-travelling .eeh-count,
.eeh-link.eeh-state-travelling .eeh-name,
.eeh-link.eeh-state-travelling .eeh-state,
.eeh-link.eeh-state-travelling .eeh-total,
.eeh-link.eeh-state-travelling .eeh-count,
#eeh-floating-panel.eeh-state-travelling .eeh-panel-dragbar h3,
#eeh-floating-panel.eeh-state-travelling .eeh-options {
    color: #e9f6ff !important;
}

/* ABROAD */
#eggTraverse.eeh-state-abroad,
.eeh-link.eeh-state-abroad,
#eeh-floating-panel.eeh-state-abroad {
    color: #ecfffa;
}

#eggTraverse.eeh-state-abroad {
    background: linear-gradient(180deg, #2f5e56 0%, #21443f 100%);
    border-color: rgba(20,80,65,.75);
    box-shadow: 0 2px 12px rgba(0,30,20,.30);
}

.eeh-link.eeh-state-abroad {
    background: linear-gradient(180deg, #29524b 0%, #1d3c37 100%);
}

#eeh-floating-panel.eeh-state-abroad {
    background: linear-gradient(180deg, #29524b 0%, #1d3c37 100%);
    border-color: rgba(20,80,65,.75);
}

#eggTraverse.eeh-state-abroad .eeh-name,
#eggTraverse.eeh-state-abroad .eeh-state,
#eggTraverse.eeh-state-abroad .eeh-total,
#eggTraverse.eeh-state-abroad .eeh-count,
.eeh-link.eeh-state-abroad .eeh-name,
.eeh-link.eeh-state-abroad .eeh-state,
.eeh-link.eeh-state-abroad .eeh-total,
.eeh-link.eeh-state-abroad .eeh-count,
#eeh-floating-panel.eeh-state-abroad .eeh-panel-dragbar h3,
#eeh-floating-panel.eeh-state-abroad .eeh-options {
    color: #ecfffa !important;
}

/* RACING */
#eggTraverse.eeh-state-racing,
.eeh-link.eeh-state-racing,
#eeh-floating-panel.eeh-state-racing {
    color: #f1f1f1;
}

#eggTraverse.eeh-state-racing {
    background: linear-gradient(180deg, #393939 0%, #2a2a2a 100%);
    border-color: rgba(70,70,70,.7);
}

.eeh-link.eeh-state-racing {
    background: linear-gradient(180deg, #343434 0%, #262626 100%);
}

#eeh-floating-panel.eeh-state-racing {
    background: linear-gradient(180deg, #343434 0%, #262626 100%);
    border-color: rgba(70,70,70,.7);
}

#eggTraverse.eeh-state-racing .eeh-name,
#eggTraverse.eeh-state-racing .eeh-state,
#eggTraverse.eeh-state-racing .eeh-total,
#eggTraverse.eeh-state-racing .eeh-count,
.eeh-link.eeh-state-racing .eeh-name,
.eeh-link.eeh-state-racing .eeh-state,
.eeh-link.eeh-state-racing .eeh-total,
.eeh-link.eeh-state-racing .eeh-count,
#eeh-floating-panel.eeh-state-racing .eeh-panel-dragbar h3,
#eeh-floating-panel.eeh-state-racing .eeh-options {
    color: #f1f1f1 !important;
}

/* ============================
 * EGG BUTTON ENHANCEMENT
 * ============================ */

#easter-egg-hunt-root .modul-egg-button {
    position: fixed !important;
    border: 3px solid red !important;
    box-sizing: border-box !important;
    z-index: 1000003 !important;
    padding: 0 !important;
    margin: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    overflow: hidden !important;
    background: transparent !important;
}

#easter-egg-hunt-root .modul-egg-button img,
#easter-egg-hunt-root .modul-egg-button svg,
#easter-egg-hunt-root .modul-egg-button canvas,
#easter-egg-hunt-root .modul-egg-media {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
    display: block !important;
}
#modul-fake-egg-root {
    position: fixed;
    inset: 0;
    z-index: 1000002;
    pointer-events: none;
}

#modul-fake-egg-root .modul-egg-button {
    position: fixed !important;
    border: 3px dashed #00ffaa !important;
    box-sizing: border-box !important;
    z-index: 1000003 !important;
    padding: 0 !important;
    margin: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    overflow: hidden !important;
    background: rgba(0, 0, 0, 0.15) !important;
    pointer-events: auto !important;
    border-radius: 8px !important;
}

#modul-fake-egg-root .modul-egg-media {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
    display: block !important;
}
        `);

        const styleEl = Array.from(document.querySelectorAll('style')).find(
            s => s.textContent && s.textContent.includes(`#${TOAST_ID}`)
        );
        if (styleEl) styleEl.id = 'modul-egg-style';
    }

    setInterval(() => {
        try {
            rememberCurrentForumPostUrl();

            if (hasVisibleFakeEgg()) {
                hideNavigator();
                showEggBlocker();
                return;
            }

            applyStateThemes();
            syncNavigatorToPool();
            updateEggCounterUI();
            refreshSettingsPanel();
        } catch {}
    }, 1200);

    insertStyle();
})();
