// ==UserScript==
// @name         MoDuL's Smuggler
// @namespace    modul.torn.travelassistant
// @version      3.0.6
// @description  Torn/TornPDA travel and item-buying helper.
// @author       MoDuL
// @copyright    2026 MoDuL. All rights reserved.
// @license      All Rights Reserved
// @match        https://www.torn.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// ==/UserScript==

/*
Copyright (c) 2026 MoDuL. All rights reserved.
Unauthorized copying, modification, redistribution, or commercial use is prohibited without written permission.
*/

(function () {
    'use strict';

    const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';

    function loadSetting(key, Secondary) {
        try {
            if (hasGM) return GM_getValue(key, Secondary);
            const raw = localStorage.getItem(key);
            return raw == null ? Secondary : JSON.parse(raw);
        } catch {
            return Secondary;
        }
    }

    function saveSetting(key, value) {
        try {
            if (hasGM) return GM_setValue(key, value);
            localStorage.setItem(key, JSON.stringify(value));
        } catch {}
    }

    function injectStyles(css) {
        if (typeof GM_addStyle === 'function') GM_addStyle(css);
        else {
            const s = document.createElement('style');
            s.textContent = css;
            document.head.appendChild(s);
        }
    }

    const K = {
        dest: 'mta_dest',
        keybind: 'mta_keybind',
        keybindCtrl: 'mta_keybind_ctrl',
        keybindAlt: 'mta_keybind_alt',
        keybindShift: 'mta_keybind_shift',
        posX: 'mta_posX',
        posY: 'mta_posY',
        minimized: 'mta_minimized',
        capacity: 'mta_capacity',
        selectedItem: 'mta_selectedItem',
        SecondaryItem: 'mta_SecondaryItem',
        selectedCategories: 'mta_selectedCategories',
        categoryOrder: 'mta_categoryOrder',
        bookRead: 'mta_bookRead',
        travelMode: 'mta_travelMode',
        showFlags: 'mta_showFlags',
        showCountryCodes: 'mta_showCountryCodes',
        showCountdown: 'mta_showCountdown',
        showEta: 'mta_showEta',
        theme: 'mta_theme',
        forumPostUrl: 'mta_forumPostUrl',
        lastKnownCountry: 'mta_lastKnownCountry',
        lastKnownAbroad: 'mta_lastKnownAbroad',
        flightLegDepartedAt: 'mta_flightLegDepartedAt',
        flightLegArriveAt: 'mta_flightLegArriveAt',
        flightLegFromKey: 'mta_flightLegFromKey',
        flightLegToKey: 'mta_flightLegToKey',
        tripPurchaseDone: 'mta_tripPurchaseDone',
        tripPurchaseCountry: 'mta_tripPurchaseCountry',
        tripDepartedAt: 'mta_tripDepartedAt',
        tripArriveAt: 'mta_tripArriveAt',
        tripRoundTripArriveAt: 'mta_tripRoundTripArriveAt',
        flightCounts: 'mta_flightCounts',
        purchaseHistory: 'mta_purchaseHistory',
        purchaseFilter: 'mta_purchaseFilter',
        instructionsOpen: 'mta_instructionsOpen'
    };

    const LONG_PRESS_MS = 550;
    const QUICK_ACTION_COOLDOWN_MS = 700;
    const DEFAULT_CATEGORIES = ['flowers', 'plushies', 'drugs', 'weapons', 'oc', 'other'];
    const SCRIPT_FORUM_THREAD_ID = '16558683';
    const SCRIPT_FORUM_POST_URL = `https://www.torn.com/forums.php#p=threads&f=67&t=${SCRIPT_FORUM_THREAD_ID}&b=0&a=0&start=0`;
    const PURCHASE_FILTER_OPTIONS = Object.freeze([
        { value: 'all', label: 'All' },
        { value: 'country', label: 'Country' },
        { value: 'selected', label: 'Selected categories' }
    ]);
    const DEFAULT_THEME = Object.freeze({
        bgSoft: '#515151',
        bgSoftAlpha: 100,
        bg: '#333333',
        bgAlpha: 100,
        text: '#ffffff',
        textAlpha: 100,
        accent: '#ffffff',
        accentAlpha: 100,
        border: '#a33431',
        borderAlpha: 100,
        buttonBg: '#87110f',
        buttonBgAlpha: 100,
        buttonBgBottom: '#5f0c0b',
        buttonBgBottomAlpha: 100,
        buttonText: '#ffffff',
        buttonTextAlpha: 100
    });
    const THEME_PICKERS = Object.freeze([
        { key: 'bgSoft', alphaKey: 'bgSoftAlpha', id: 'mta-theme-bg-soft', label: 'Panel top' },
        { key: 'bg', alphaKey: 'bgAlpha', id: 'mta-theme-bg', label: 'Panel bottom' },
        { key: 'text', alphaKey: 'textAlpha', id: 'mta-theme-text', label: 'Text' },
        { key: 'accent', alphaKey: 'accentAlpha', id: 'mta-theme-accent', label: 'Accent' },
        { key: 'border', alphaKey: 'borderAlpha', id: 'mta-theme-border', label: 'Border' },
        { key: 'buttonBg', alphaKey: 'buttonBgAlpha', id: 'mta-theme-button-bg', label: 'Button top' },
        { key: 'buttonBgBottom', alphaKey: 'buttonBgBottomAlpha', id: 'mta-theme-button-bg-bottom', label: 'Button bottom' },
        { key: 'buttonText', alphaKey: 'buttonTextAlpha', id: 'mta-theme-button-text', label: 'Button text' }
    ]);
    const CATEGORY_LABELS = {
        flowers: 'Flowers',
        plushies: 'Plushies',
        drugs: 'Drugs',
        weapons: 'Weapons',
        oc: 'OC Items',
        other: 'Other'
    };
    const MENU_BOTTOM_GAP = 78;
    const DRAG_CLICK_THRESHOLD_PX = 6;
    const DRAG_CLICK_SUPPRESS_MS = 250;
    const TRIP_TIMING_GRACE_MS = 15000;

    const COUNTRY_DATA = {
        mexico: {
            name: 'Mexico',
            code: 'MEX',
            city: 'Ciudad Juarez',
            travelCost: 6500,
            travelTimes: { standard: 26, airstrip: 18, wlt: 13, business: 8, book: { standard: 19, airstrip: 14, wlt: 10, business: 6 } },
            items: [
                { name: 'Bolt Cutters', type: 'tool', price: 25 },
                { name: 'Bottle of Tequila', type: 'alcohol', price: 85 },
                { name: 'Card Skimmer', type: 'tool', price: 175 },
                { name: 'Crazy Straw', type: 'other', price: 25 },
                { name: 'Dahlia', type: 'flower', price: 300 },
                { name: 'Jaguar Plushie', type: 'plushie', price: 10000 },
                { name: 'Mayan Statue', type: 'other', price: 500 },
                { name: 'Trench Coat', type: 'clothing', price: 500000 },
                { name: 'Yucca Plant', type: 'other', price: 20000 },
                { name: 'Zip Ties', type: 'material', price: 25 },
                { name: '9mm Uzi', type: 'weapon_primary', price: 1100000 },
                { name: 'AK-47', type: 'weapon_primary', price: 15000 },
                { name: 'ArmaLite M-15A4', type: 'weapon_primary', price: 20000000 },
                { name: 'Axe', type: 'weapon_melee', price: 4200 },
                { name: 'Claymore Mine', type: 'weapon_temporary', price: 15000 },
                { name: 'Cobra Derringer', type: 'weapon_secondary', price: 70000 },
                { name: 'Desert Eagle', type: 'weapon_secondary', price: 45000 },
                { name: 'Flak Jacket', type: 'weapon_defensive', price: 7500 },
                { name: 'Flare Gun', type: 'weapon_secondary', price: 300 },
                { name: 'Heckler & Koch SL8', type: 'weapon_primary', price: 45000 },
                { name: 'Kevlar Gloves', type: 'weapon_defensive', price: 400000 },
                { name: 'Leather Bullwhip', type: 'weapon_melee', price: 1500 },
                { name: 'M249 SAW', type: 'weapon_primary', price: 950000 },
                { name: 'Minigun', type: 'weapon_primary', price: 3000000 },
                { name: 'Ninja Claws', type: 'weapon_melee', price: 8000 },
                { name: 'Outer Tactical Vest', type: 'weapon_defensive', price: 1000000 },
                { name: 'Samurai Sword', type: 'weapon_melee', price: 75000 },
                { name: 'Springfield 1911', type: 'weapon_secondary', price: 430 },
                { name: 'Taser', type: 'weapon_secondary', price: 5500 },
                { name: 'Obsidian Point', type: 'artifact', price: 108363 }
            ]
        },
        cayman: {
            name: 'Cayman Islands',
            code: 'CAY',
            city: 'George Town',
            travelCost: 10000,
            travelTimes: { standard: 35, airstrip: 25, wlt: 18, business: 11, book: { standard: 25, airstrip: 18, wlt: 13, business: 8 } },
            items: [
                { name: 'Banana Orchid', type: 'flower', price: 4000 },
                { name: 'Bikini', type: 'clothing', price: 8000 },
                { name: 'Diving Gloves', type: 'clothing', price: 5000 },
                { name: 'Flippers', type: 'clothing', price: 10000 },
                { name: 'Nodding Turtle', type: 'other', price: 750 },
                { name: 'Snorkel', type: 'clothing', price: 20000 },
                { name: 'Speedo', type: 'clothing', price: 6000 },
                { name: 'Steel Drum', type: 'other', price: 1500 },
                { name: 'Stingray Plushie', type: 'plushie', price: 400 },
                { name: 'Wetsuit', type: 'clothing', price: 30000 },
                { name: 'Diamond Bladed Knife', type: 'weapon_melee', price: 950000 },
                { name: 'Harpoon', type: 'weapon_secondary', price: 300000 },
                { name: 'Naval Cutlass', type: 'weapon_melee', price: 50000000 },
                { name: 'Tavor TAR-21', type: 'weapon_primary', price: 495000 },
                { name: 'Trout', type: 'weapon_temporary', price: 3 },
                { name: 'Bearer Bond', type: 'other', price: 81702 }
            ]
        },
        canada: {
            name: 'Canada',
            code: 'CAN',
            city: 'Toronto',
            travelCost: 9000,
            travelTimes: { standard: 41, airstrip: 29, wlt: 21, business: 12, book: { standard: 29, airstrip: 21, wlt: 15, business: 9 } },
            items: [
                { name: 'Aluminum Plate', type: 'material', price: 1125 },
                { name: 'Crocus', type: 'flower', price: 600 },
                { name: 'Dog Treats', type: 'material', price: 25 },
                { name: 'Fire Hydrant', type: 'other', price: 20000 },
                { name: 'Hockey Stick', type: 'other', price: 400 },
                { name: 'Mountie Hat', type: 'clothing', price: 30000 },
                { name: 'PVC Cards', type: 'material', price: 12500 },
                { name: 'Wolverine Plushie', type: 'plushie', price: 30 },
                { name: 'Ice Pick', type: 'weapon_melee', price: 20000 },
                { name: 'Ithaca 37', type: 'weapon_primary', price: 10000 },
                { name: 'Lorcin 380', type: 'weapon_secondary', price: 300 },
                { name: 'Safety Boots', type: 'weapon_defensive', price: 77000 },
                { name: 'Bear Gall', type: 'other', price: 30502 },
                { name: 'Cannabis', type: 'drug', price: 2609 },
                { name: 'Ecstasy', type: 'drug', price: 40196 },
                { name: 'Insulin', type: 'medical', price: 2467 },
                { name: 'PCP', type: 'drug', price: 6916 },
                { name: 'Quartz Point', type: 'artifact', price: 129509 },
                { name: 'Vicodin', type: 'drug', price: 1821 },
                { name: 'Xanax', type: 'drug', price: 773054 }
            ]
        },
        hawaii: {
            name: 'Hawaii',
            code: 'HAW',
            city: 'Honolulu',
            travelCost: 11000,
            travelTimes: { standard: 134, airstrip: 94, wlt: 67, business: 40, book: { standard: 94, airstrip: 66, wlt: 47, business: 28 } },
            items: [
                { name: 'Coconut Bra', type: 'clothing', price: 750000 },
                { name: 'Large Suitcase', type: 'enhancer', price: 10000000 },
                { name: 'Medium Suitcase', type: 'enhancer', price: 4000000 },
                { name: 'Orchid', type: 'flower', price: 700 },
                { name: 'Pele Charm', type: 'other', price: 2000 },
                { name: 'Small Suitcase', type: 'enhancer', price: 2000000 },
                { name: 'Bushmaster Carbon 15', type: 'weapon_primary', price: 15000 },
                { name: 'HEG', type: 'weapon_temporary', price: 20000 },
                { name: 'Taurus', type: 'weapon_secondary', price: 650 },
                { name: 'Type 98 Anti Tank', type: 'weapon_secondary', price: 25000000 },
                { name: 'Basalt Point', type: 'artifact', price: 118387 },
                { name: 'Shark Fin', type: 'other', price: 20200 },
                { name: 'Turtle Shell', type: 'other', price: 56269 }
            ]
        },
        uk: {
            name: 'United Kingdom',
            code: 'UK',
            city: 'London',
            travelCost: 18000,
            travelTimes: { standard: 159, airstrip: 111, wlt: 80, business: 48, book: { standard: 111, airstrip: 78, wlt: 56, business: 34 } },
            items: [
                { name: 'Dart Board', type: 'other', price: 750 },
                { name: 'Heather', type: 'flower', price: 5000 },
                { name: 'Inkwell', type: 'material', price: 375 },
                { name: 'Model Space Ship', type: 'other', price: 17500 },
                { name: 'Nessie Plushie', type: 'plushie', price: 200 },
                { name: 'Paper Weight', type: 'other', price: 1500 },
                { name: 'Red Fox Plushie', type: 'plushie', price: 1000 },
                { name: 'Sextant', type: 'other', price: 25000 },
                { name: 'Ship in a Bottle', type: 'other', price: 40000 },
                { name: "Tailor's Dummy", type: 'other', price: 10000 },
                { name: 'Claymore Sword', type: 'weapon_melee', price: 100000 },
                { name: 'Cricket Bat', type: 'weapon_melee', price: 15000 },
                { name: 'Crossbow', type: 'weapon_secondary', price: 900 },
                { name: 'Enfield SA-80', type: 'weapon_primary', price: 250000 },
                { name: 'Flail', type: 'weapon_melee', price: 8000000 },
                { name: 'Frying Pan', type: 'weapon_melee', price: 400 },
                { name: 'Grenade', type: 'weapon_temporary', price: 10000 },
                { name: 'Stick Grenade', type: 'weapon_temporary', price: 8000 },
                { name: 'WWII Helmet', type: 'weapon_defensive', price: 89500 },
                { name: 'Chert Point', type: 'artifact', price: 104228 },
                { name: 'Cannabis', type: 'drug', price: 2855 },
                { name: 'Ecstasy', type: 'drug', price: 29878 },
                { name: 'Ketamine', type: 'drug', price: 933 },
                { name: 'PCP', type: 'drug', price: 5903 },
                { name: 'Shrooms', type: 'drug', price: 912 },
                { name: 'Vicodin', type: 'drug', price: 1824 },
                { name: 'Xanax', type: 'drug', price: 747352 }
            ]
        },
        argentina: {
            name: 'Argentina',
            code: 'ARG',
            city: 'Buenos Aires',
            travelCost: 21000,
            travelTimes: { standard: 167, airstrip: 117, wlt: 84, business: 50, book: { standard: 117, airstrip: 82, wlt: 59, business: 35 } },
            items: [
                { name: 'Ceibo Flower', type: 'flower', price: 500 },
                { name: 'Compass', type: 'other', price: 2500 },
                { name: 'Lighter', type: 'tool', price: 5 },
                { name: 'Monkey Plushie', type: 'plushie', price: 400 },
                { name: 'Soccer Ball', type: 'other', price: 50 },
                { name: 'Flamethrower', type: 'weapon_secondary', price: 3000000 },
                { name: 'Liquid Body Armor', type: 'weapon_defensive', price: 7500000 },
                { name: 'Macana', type: 'weapon_melee', price: 100000 },
                { name: 'Tear Gas', type: 'weapon_temporary', price: 15000 },
                { name: 'Throwing Knife', type: 'weapon_temporary', price: 35000 },
                { name: 'Patagonian Fossil', type: 'artifact', price: 599257 },
                { name: 'Meteorite Fragment', type: 'artifact', price: 436555 },
                { name: 'Chalcedony Point', type: 'artifact', price: 124364 },
                { name: 'Cannabis', type: 'drug', price: 2992 },
                { name: 'Ketamine', type: 'drug', price: 952 },
                { name: 'LSD', type: 'drug', price: 18285 },
                { name: 'Shrooms', type: 'drug', price: 947 },
                { name: 'Speed', type: 'drug', price: 4993 }
            ]
        },
        switzerland: {
            name: 'Switzerland',
            code: 'SWI',
            city: 'Zurich',
            travelCost: 27000,
            travelTimes: { standard: 175, airstrip: 123, wlt: 88, business: 53, book: { standard: 123, airstrip: 86, wlt: 62, business: 37 } },
            items: [
                { name: 'Chamois Plushie', type: 'plushie', price: 400 },
                { name: 'Dozen White Roses', type: 'flower', price: 950000000 },
                { name: 'Edelweiss', type: 'flower', price: 900 },
                { name: 'Neumune Tablet', type: 'medical', price: 900000 },
                { name: 'Snowboard', type: 'other', price: 6000 },
                { name: 'Flash Grenade', type: 'weapon_temporary', price: 12000 },
                { name: 'Jackhammer', type: 'weapon_primary', price: 5000000 },
                { name: 'SIG 552', type: 'weapon_primary', price: 7500000 },
                { name: 'Swiss Army Knife', type: 'weapon_melee', price: 2500 },
                { name: 'Ephedrine Powder', type: 'other', price: 14422 },
                { name: 'Safrole Oil', type: 'other', price: 4967 },
                { name: 'Ergotamine Ampoule', type: 'other', price: 4560 },
                { name: 'Cannabis', type: 'drug', price: 2721 },
                { name: 'Ketamine', type: 'drug', price: 900 },
                { name: 'LSD', type: 'drug', price: 25861 },
                { name: 'PCP', type: 'drug', price: 6108 },
                { name: 'Shrooms', type: 'drug', price: 915 },
                { name: 'Speed', type: 'drug', price: 4870 }
            ]
        },
        japan: {
            name: 'Japan',
            code: 'JPN',
            city: 'Tokyo',
            travelCost: 32000,
            travelTimes: { standard: 225, airstrip: 158, wlt: 113, business: 68, book: { standard: 158, airstrip: 111, wlt: 79, business: 48 } },
            items: [
                { name: 'Bonded Latex', type: 'material', price: 220000 },
                { name: 'Bottle of Saké', type: 'alcohol', price: 39 },
                { name: 'Cherry Blossom', type: 'flower', price: 500 },
                { name: 'Chopsticks', type: 'other', price: 25 },
                { name: 'Glow Stick', type: 'material', price: 10 },
                { name: 'Hydrochloric Acid', type: 'material', price: 24250 },
                { name: 'Kabuki Mask', type: 'clothing', price: 10000 },
                { name: 'Maneki Neko', type: 'other', price: 50000 },
                { name: 'Sensu', type: 'other', price: 500 },
                { name: 'Sumo Doll', type: 'other', price: 300 },
                { name: 'BT MP9', type: 'weapon_secondary', price: 55000 },
                { name: 'Chain Whip', type: 'weapon_melee', price: 2500 },
                { name: 'Flexible Body Armor', type: 'weapon_defensive', price: 15000000 },
                { name: 'Kama', type: 'weapon_melee', price: 50000 },
                { name: 'Kodachi', type: 'weapon_melee', price: 95000 },
                { name: 'Metal Nunchaku', type: 'weapon_melee', price: 400000 },
                { name: 'Ninja Star', type: 'weapon_temporary', price: 500 },
                { name: 'Sai', type: 'weapon_melee', price: 1000 },
                { name: 'Wooden Nunchaku', type: 'weapon_melee', price: 5000 },
                { name: 'Whale Meat', type: 'other', price: 2050 },
                { name: 'Counterfeit Manga', type: 'other', price: 20587 },
                { name: 'Opium', type: 'drug', price: 19359 },
                { name: 'Ecstasy', type: 'drug', price: 27399 },
                { name: 'Ketamine', type: 'drug', price: 997 },
                { name: 'Shrooms', type: 'drug', price: 902 },
                { name: 'Speed', type: 'drug', price: 4403 },
                { name: 'Vicodin', type: 'drug', price: 1700 },
                { name: 'Xanax', type: 'drug', price: 688000 }
            ]
        },
        china: {
            name: 'China',
            code: 'CHN',
            city: 'Beijing',
            travelCost: 35000,
            travelTimes: { standard: 242, airstrip: 169, wlt: 121, business: 73, book: { standard: 169, airstrip: 119, wlt: 85, business: 51 } },
            items: [
                { name: 'Blank Casino Chips', type: 'material', price: 20000 },
                { name: 'Jade Buddha', type: 'other', price: 12000 },
                { name: 'Magnesium Shavings', type: 'material', price: 22000 },
                { name: 'Panda Plushie', type: 'plushie', price: 400 },
                { name: 'Peony', type: 'flower', price: 5000 },
                { name: 'Printing Paper', type: 'material', price: 75000 },
                { name: 'Stick of Dynamite', type: 'material', price: 50000 },
                { name: 'Blowgun', type: 'weapon_secondary', price: 2500 },
                { name: 'Bo Staff', type: 'weapon_melee', price: 500 },
                { name: 'Construction Helmet', type: 'weapon_defensive', price: 14000 },
                { name: 'Fireworks', type: 'weapon_temporary', price: 500 },
                { name: 'Guandao', type: 'weapon_melee', price: 200000 },
                { name: 'Katana', type: 'weapon_melee', price: 16000 },
                { name: 'Qsz-92', type: 'weapon_secondary', price: 90000 },
                { name: 'SKS Carbine', type: 'weapon_primary', price: 6500 },
                { name: 'Twin Tiger Hooks', type: 'weapon_melee', price: 50000 },
                { name: 'Wushu Double Axes', type: 'weapon_melee', price: 75000 },
                { name: 'Pangolin Scales', type: 'other', price: 127969 },
                { name: 'Tiger Bone Powder', type: 'other', price: 29123 },
                { name: 'LSD', type: 'drug', price: 19585 },
                { name: 'Ecstasy', type: 'drug', price: 30816 },
                { name: 'Opium', type: 'drug', price: 17763 },
                { name: 'Speed', type: 'drug', price: 4430 },
                { name: 'PCP', type: 'drug', price: 5998 }
            ]
        },
        uae: {
            name: 'United Arab Emirates',
            code: 'UAE',
            city: 'Dubai',
            travelCost: 32000,
            travelTimes: { standard: 271, airstrip: 190, wlt: 136, business: 81, book: { standard: 190, airstrip: 133, wlt: 95, business: 57 } },
            items: [
                { name: 'Camel Plushie', type: 'plushie', price: 14000 },
                { name: 'Gold Laptop', type: 'tool', price: 8000000000 },
                { name: 'Potassium Nitrate', type: 'material', price: 3750 },
                { name: 'Proda Sunglasses', type: 'clothing', price: 100000 },
                { name: 'Sports Shades', type: 'clothing', price: 10000 },
                { name: 'Sports Sneakers', type: 'enhancer', price: 14000000000 },
                { name: 'Tribulus Omanense', type: 'flower', price: 6000 },
                { name: 'Gold Plated AK-47', type: 'weapon_primary', price: 25000000000 },
                { name: 'Handbag', type: 'weapon_melee', price: 16000000000 },
                { name: 'Pink Mac-10', type: 'weapon_secondary', price: 23000000000 },
                { name: 'Ambergris Lump', type: 'other', price: 335597 },
                { name: 'Natural Pearls', type: 'other', price: 98622 }
            ]
        },
        southafrica: {
            name: 'South Africa',
            code: 'AFR',
            city: 'Johannesburg',
            travelCost: 40000,
            travelTimes: { standard: 297, airstrip: 208, wlt: 149, business: 89, book: { standard: 208, airstrip: 146, wlt: 104, business: 62 } },
            items: [
                { name: 'African Violet', type: 'flower', price: 2000 },
                { name: 'Afro Comb', type: 'other', price: 50000 },
                { name: 'Elephant Statue', type: 'other', price: 500 },
                { name: 'Lion Plushie', type: 'plushie', price: 400 },
                { name: 'Combat Boots', type: 'weapon_defensive', price: 2400000 },
                { name: 'Combat Gloves', type: 'weapon_defensive', price: 2100000 },
                { name: 'Combat Helmet', type: 'weapon_defensive', price: 3100000 },
                { name: 'Combat Pants', type: 'weapon_defensive', price: 2950000 },
                { name: 'Combat Vest', type: 'weapon_defensive', price: 3500000 },
                { name: 'Knuckle Dusters', type: 'weapon_melee', price: 750 },
                { name: 'Mag 7', type: 'weapon_primary', price: 60000 },
                { name: 'Smoke Grenade', type: 'weapon_temporary', price: 20000 },
                { name: 'Spear', type: 'weapon_melee', price: 600 },
                { name: 'Vektor CR-21', type: 'weapon_primary', price: 7500 },
                { name: 'Uncut Diamonds', type: 'other', price: 0 },
                { name: 'Quartzite Point', type: 'artifact', price: 0 },
                { name: 'Raw Ivory', type: 'other', price: 0 },
                { name: 'LSD', type: 'drug', price: 0 },
                { name: 'Opium', type: 'drug', price: 0 },
                { name: 'PCP', type: 'drug', price: 0 },
                { name: 'Shrooms', type: 'drug', price: 0 },
                { name: 'Xanax', type: 'drug', price: 0 }
            ]
        }
    };

    const COUNTRY_ORDER = [
        'mexico', 'cayman', 'canada', 'hawaii', 'uk',
        'argentina', 'switzerland', 'japan', 'china', 'uae', 'southafrica'
    ];
    const PURCHASE_BUFFER_MINUTES = 1;

    const FLAG_SVG = {
        torn: `
            <svg viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
                <rect width="18" height="12" rx="1.6" fill="#111a22"/>
                <circle cx="9" cy="6" r="3.5" fill="#7dd321"/>
                <circle cx="9" cy="6" r="2.55" fill="#111a22"/>
                <path d="M6.6 3.4h4.8v1.1H9.6v4.1H8.4V4.5H6.6z" fill="#eef7ea"/>
            </svg>
        `,
        mexico: `
            <svg viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
                <rect width="6" height="12" fill="#006847"/>
                <rect x="6" width="6" height="12" fill="#ffffff"/>
                <rect x="12" width="6" height="12" fill="#ce1126"/>
                <circle cx="9" cy="6" r="1.35" fill="#f5efe0" stroke="#cbb98c" stroke-width=".18"/>
                <path d="M8.2 6.1c.32-.62 1.28-.62 1.6 0-.08.55-.42.92-.8 1.08-.38-.16-.72-.53-.8-1.08z" fill="#8d5a31"/>
                <path d="M8.55 6.95h.9" stroke="#8d5a31" stroke-width=".18" stroke-linecap="round"/>
                <path d="M7.55 7.45c.36-.44.82-.73 1.45-.78M10.45 7.45c-.36-.44-.82-.73-1.45-.78" stroke="#0b6b46" stroke-width=".24" stroke-linecap="round"/>
                <path d="M8.05 7.8c.26.2.6.34.95.34.36 0 .7-.14.95-.34" stroke="#b08d26" stroke-width=".2" stroke-linecap="round"/>
            </svg>
        `,
        cayman: `
            <svg viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
                <rect width="18" height="12" fill="#00247d"/>
                <g transform="scale(0.5)">
                    <rect width="18" height="12" fill="#012169"/>
                    <path d="M0 0 18 12M18 0 0 12" stroke="#fff" stroke-width="3"/>
                    <path d="M0 0 18 12M18 0 0 12" stroke="#c8102e" stroke-width="1.6"/>
                    <path d="M9 0V12M0 6H18" stroke="#fff" stroke-width="5"/>
                    <path d="M9 0V12M0 6H18" stroke="#c8102e" stroke-width="3"/>
                </g>
                <circle cx="13.5" cy="6.2" r="2" fill="#ffffff"/>
                <circle cx="13.5" cy="6.2" r="1.4" fill="#47a86d"/>
            </svg>
        `,
        canada: `
            <svg viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
                <rect width="36" height="24" fill="#ffffff"/>
                <rect width="8" height="24" fill="#d52b1e"/>
                <rect x="28" width="8" height="24" fill="#d52b1e"/>
                <path d="M18 4.1 19.3 6.5 21.5 5.6 21 8.3 24 8.1 22.2 10.3 24.5 11.6 21.8 12.5 22.8 15.2 19.9 14.4 19.6 18.8 18 17.6 16.4 18.8 16.1 14.4 13.2 15.2 14.2 12.5 11.5 11.6 13.8 10.3 12 8.1 15 8.3 14.5 5.6 16.7 6.5Z" fill="#d52b1e"/>
                <rect x="17.3" y="17.2" width="1.4" height="3.8" fill="#d52b1e"/>
            </svg>
        `,
        hawaii: `
            <svg viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
                <rect width="18" height="12" fill="#b22234"/>
                <path d="M0 1.7h18M0 5.1h18M0 8.5h18" stroke="#ffffff" stroke-width="1.7"/>
                <rect width="7.8" height="6.4" fill="#3c3b6e"/>
                <path d="M0 0 7.8 6.4M7.8 0 0 6.4" stroke="#fff" stroke-width="1.2"/>
                <path d="M0 0 7.8 6.4M7.8 0 0 6.4" stroke="#c8102e" stroke-width=".6"/>
                <path d="M3.9 0V6.4M0 3.2H7.8" stroke="#fff" stroke-width="2"/>
                <path d="M3.9 0V6.4M0 3.2H7.8" stroke="#c8102e" stroke-width="1.1"/>
            </svg>
        `,
        uk: `
            <svg viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
                <rect width="18" height="12" fill="#012169"/>
                <path d="M0 0 18 12M18 0 0 12" stroke="#fff" stroke-width="3"/>
                <path d="M0 0 18 12M18 0 0 12" stroke="#c8102e" stroke-width="1.6"/>
                <path d="M9 0V12M0 6H18" stroke="#fff" stroke-width="5"/>
                <path d="M9 0V12M0 6H18" stroke="#c8102e" stroke-width="3"/>
            </svg>
        `,
        argentina: `
            <svg viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
                <rect width="18" height="12" fill="#74acdf"/>
                <rect y="4" width="18" height="4" fill="#ffffff"/>
                <circle cx="9" cy="6" r="1.3" fill="#f6b40e"/>
            </svg>
        `,
        switzerland: `
            <svg viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" shape-rendering="crispEdges">
                <rect width="36" height="24" fill="#d52b1e"/>
                <rect x="15" y="5" width="6" height="14" fill="#ffffff"/>
                <rect x="11" y="9" width="14" height="6" fill="#ffffff"/>
            </svg>
        `,
        japan: `
            <svg viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
                <rect width="18" height="12" fill="#ffffff"/>
                <circle cx="9" cy="6" r="3" fill="#bc002d"/>
            </svg>
        `,
        china: `
            <svg viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
                <rect width="18" height="12" fill="#de2910"/>
                <polygon points="3,1.1 3.45,2.35 4.8,2.4 3.72,3.2 4.1,4.45 3,3.7 1.9,4.45 2.28,3.2 1.2,2.4 2.55,2.35" fill="#ffde00"/>
                <circle cx="6.4" cy="1.9" r=".55" fill="#ffde00"/>
                <circle cx="7.4" cy="3.1" r=".55" fill="#ffde00"/>
                <circle cx="7.1" cy="4.7" r=".55" fill="#ffde00"/>
                <circle cx="5.8" cy="5.8" r=".55" fill="#ffde00"/>
            </svg>
        `,
        uae: `
            <svg viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
                <rect width="18" height="12" fill="#ffffff"/>
                <rect width="4" height="12" fill="#ff0000"/>
                <rect x="4" width="14" height="4" fill="#00732f"/>
                <rect x="4" y="8" width="14" height="4" fill="#000000"/>
            </svg>
        `,
        southafrica: `
            <svg viewBox="0 0 90 60" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
                <path fill="#e03c31" d="M18.0279 0H90v20H48.0273z"/>
                <path fill="#001489" d="M18.0279 60H90V40H48.0273z"/>
                <path fill="#ffffff" d="M10.8164 60h7.2115L48.0273 40H90v-4H46.8164"/>
                <path fill="#ffffff" d="M46.8164 24H90v-4H48.0273L18.0279 0H10.8164"/>
                <path fill="#000000" d="M0 12.0184 26.9727 30 0 47.9818"/>
                <path fill="#ffb81c" d="M0 7.2109v4.8073L26.9727 30 0 47.9818v4.8073L34.1863 30z"/>
                <path fill="#007749" d="M0 0v7.2109L34.1836 30 0 52.7891V60h10.8164l36-24H90V24H46.8164l-36-24z"/>
            </svg>
        `
    };

    function formatMoney(n) {
        return '$' + Number(n || 0).toLocaleString();
    }

    function normalizeText(s) {
        return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function hasStoredSetting(key) {
        try {
            if (hasGM) {
                const missing = '__mta_missing__';
                return GM_getValue(key, missing) !== missing;
            }
            return localStorage.getItem(key) != null;
        } catch {
            return false;
        }
    }

    function normalizeKeyToken(key) {
        const raw = String(key || '').trim().toLowerCase();
        if (!raw) return '';

        const aliases = {
            ' ': 'space',
            spacebar: 'space',
            escape: 'esc',
            control: 'ctrl',
            command: 'meta',
            cmd: 'meta',
            os: 'meta',
            win: 'meta',
            arrowup: 'up',
            arrowdown: 'down',
            arrowleft: 'left',
            arrowright: 'right'
        };

        return aliases[raw] || raw;
    }

    function isModifierOnlyKey(key) {
        const token = normalizeKeyToken(key);
        return token === 'ctrl' || token === 'alt' || token === 'shift' || token === 'meta';
    }

    function parseKeybindValue(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw) return { key: '', modifiers: new Set() };

        const parts = raw.split('+').map(part => normalizeKeyToken(part)).filter(Boolean);
        const modifiers = new Set();
        let mainKey = '';

        for (const part of parts) {
            if (isModifierOnlyKey(part)) {
                modifiers.add(part);
                continue;
            }
            mainKey = part;
        }

        return {
            key: mainKey || '',
            modifiers
        };
    }

    function getSavedHotkeyConfig() {
        const parsed = parseKeybindValue(loadSetting(K.keybind, ''));
        const hasLegacyModifiers = parsed.modifiers.size > 0;

        const ctrl = hasStoredSetting(K.keybindCtrl)
            ? !!loadSetting(K.keybindCtrl, false)
            : parsed.modifiers.has('ctrl');
        const alt = hasStoredSetting(K.keybindAlt)
            ? !!loadSetting(K.keybindAlt, false)
            : (hasLegacyModifiers ? parsed.modifiers.has('alt') : false);
        const shift = hasStoredSetting(K.keybindShift)
            ? !!loadSetting(K.keybindShift, false)
            : (hasLegacyModifiers ? parsed.modifiers.has('shift') : false);

        return {
            key: parsed.key || '',
            ctrl,
            alt,
            shift
        };
    }

    function saveHotkeyConfig(config) {
        saveSetting(K.keybind, normalizeKeyToken(config?.key) || '');
        saveSetting(K.keybindCtrl, !!config?.ctrl);
        saveSetting(K.keybindAlt, !!config?.alt);
        saveSetting(K.keybindShift, !!config?.shift);
    }

    function readHotkeyConfigFromDom() {
        const saved = getSavedHotkeyConfig();
        const keyCtrl = document.getElementById('mta-key-ctrl');
        const keyAlt = document.getElementById('mta-key-alt');
        const keyShift = document.getElementById('mta-key-shift');

        return {
            key: saved.key,
            ctrl: keyCtrl ? !!keyCtrl.checked : saved.ctrl,
            alt: keyAlt ? !!keyAlt.checked : saved.alt,
            shift: keyShift ? !!keyShift.checked : saved.shift
        };
    }

    function refreshHotkeyPreview() {
        const kb = document.getElementById('mta-keybind');
        if (!kb) return;
        kb.textContent = formatHotkeyDisplay(readHotkeyConfigFromDom());
    }

    function formatHotkeyDisplay(config = getSavedHotkeyConfig()) {
        const key = normalizeKeyToken(config.key);
        if (!key) return 'Set Hotkey';

        const labels = {
            ctrl: 'Ctrl',
            alt: 'Alt',
            shift: 'Shift',
            esc: 'Esc',
            space: 'Space',
            up: 'Up',
            down: 'Down',
            left: 'Left',
            right: 'Right'
        };

        const parts = [];
        if (config.ctrl) parts.push('ctrl');
        if (config.alt) parts.push('alt');
        if (config.shift) parts.push('shift');
        parts.push(key);

        return parts
            .map(part => {
                if (labels[part]) return labels[part];
                if (part.length === 1) return part.toUpperCase();
                return part.charAt(0).toUpperCase() + part.slice(1);
            })
            .join(' + ');
    }

    function matchesHotkeyEvent(e, config = getSavedHotkeyConfig()) {
        const key = normalizeKeyToken(e.key);
        if (!key || isModifierOnlyKey(key)) return false;
        return key === normalizeKeyToken(config.key)
            && !!e.ctrlKey === !!config.ctrl
            && !!e.altKey === !!config.alt
            && !!e.shiftKey === !!config.shift
            && !e.metaKey;
    }

    function renderFlagBadge(countryKey, label = '') {
        const svg = FLAG_SVG[countryKey];
        if (!svg) return '';
        const titleAttr = label ? ` title="${label}"` : '';
        const className = `mta-flag-badge is-${countryKey}`;
        return `<span class="${className}"${titleAttr} aria-hidden="true">${svg}</span>`;
    }

    function renderPlaneIcon(blocked = false) {
        return `
            <svg class="mta-plane-icon${blocked ? ' is-blocked' : ''}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                ${blocked ? `
                    <circle class="mta-plane-ban-ring" cx="12" cy="12" r="8.35" fill="none" stroke="#ff3b3b" stroke-width="2.2"/>
                    <line class="mta-plane-ban-slash" x1="6.05" y1="17.45" x2="17.45" y2="6.05" stroke="#ff3b3b" stroke-width="2.2" stroke-linecap="round"/>
                ` : ''}
            </svg>
        `;
    }

    function syncPlaneButtonIcon(button, blocked = false) {
        if (!button) return;
        const nextState = blocked ? 'blocked' : 'default';
        if (button.dataset.iconState === nextState && button.querySelector('svg')) return;
        button.innerHTML = renderPlaneIcon(blocked);
        button.dataset.iconState = nextState;
    }

    function isTravelPage() {
        return location.href.includes('page.php?sid=travel');
    }

    function openTravelAgentPage() {
        if (!isTravelPage()) {
            location.href = 'https://www.torn.com/page.php?sid=travel';
        }
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
        const saved = String(loadSetting(K.forumPostUrl, '') || '').trim();
        return isScriptForumThreadUrl(saved) ? saved : SCRIPT_FORUM_POST_URL;
    }

    function setSavedForumPostUrl(url) {
        const next = String(url || '').trim();
        saveSetting(K.forumPostUrl, isScriptForumThreadUrl(next) ? next : SCRIPT_FORUM_POST_URL);
    }

    function rememberCurrentForumPostUrl() {
        if (!isScriptForumThreadUrl(location.href)) return '';
        setSavedForumPostUrl(location.href);
        return location.href;
    }

    function isInputLike(el) {
        if (!el) return false;
        if (el.closest?.('#mta-menu')) return true;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    function getSelectedCountryKey() {
        return loadSetting(K.dest, 'uk');
    }

    function setSelectedCountryKey(v) {
        saveSetting(K.dest, v);
    }

    function getCountry() {
        return COUNTRY_DATA[getSelectedCountryKey()] || COUNTRY_DATA.uk;
    }

    function getTravelMode() {
        const mode = loadSetting(K.travelMode, 'standard');
        return ['standard', 'airstrip', 'wlt', 'business'].includes(mode) ? mode : 'standard';
    }

    function setTravelMode(mode) {
        saveSetting(K.travelMode, ['standard', 'airstrip', 'wlt', 'business'].includes(mode) ? mode : 'standard');
    }

    function getBookRead() {
        return !!loadSetting(K.bookRead, false);
    }

    function setBookRead(v) {
        saveSetting(K.bookRead, !!v);
    }

    function getCapacity() {
        const n = Number(loadSetting(K.capacity, 25));
        return Number.isFinite(n) && n > 0 ? n : 25;
    }

    function getLiveTravelCapacity() {
        const msgWrap = document.querySelector('.messageContent___LhCmx, [class*="messageContent"]');
        const msgText = msgWrap?.innerText || '';
        if (/purchased/i.test(msgText)) {
            const match = msgText.match(/purchased\s+(\d+)\s*\/\s*(\d+)/i);
            if (match) {
                return {
                    current: parseInt(match[1], 10),
                    max: parseInt(match[2], 10)
                };
            }
        }

        const currEl = document.querySelector('.travelitems');
        const maxEl = document.querySelector('.travelitemsmax');
        if (currEl && maxEl) {
            const current = parseInt(currEl.innerText || '0', 10);
            const max = parseInt(maxEl.innerText || '0', 10);
            if (Number.isFinite(current) && Number.isFinite(max)) {
                return { current, max };
            }
        }

        return null;
    }

    function getRemainingTripCapacity() {
        const liveCapacity = getLiveTravelCapacity();
        if (!liveCapacity) return getCapacity();
        const remaining = Math.max(0, liveCapacity.max - liveCapacity.current);
        return Number.isFinite(remaining) ? remaining : getCapacity();
    }

    function setCapacity(v) {
        saveSetting(K.capacity, Number(v) || 25);
    }

    function getMinimized() {
        return !!loadSetting(K.minimized, true);
    }

    function setMinimized(v) {
        saveSetting(K.minimized, !!v);
    }

    function normalizeHexColor(value, Secondary) {
        const raw = String(value || '').trim();
        if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
        if (/^#[0-9a-f]{3}$/i.test(raw)) {
            const [, r, g, b] = raw;
            return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
        }
        return Secondary;
    }

    function adjustHexColor(hex, amount) {
        const normalized = normalizeHexColor(hex, '#000000');
        const value = normalized.slice(1);
        const parts = [0, 2, 4].map(offset => {
            const channel = parseInt(value.slice(offset, offset + 2), 16);
            return Math.max(0, Math.min(255, channel + amount));
        });
        return `#${parts.map(part => part.toString(16).padStart(2, '0')).join('')}`;
    }

    function normalizeAlphaValue(value, Secondary = 100) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return Secondary;
        return Math.max(0, Math.min(100, Math.round(numeric)));
    }

    function colorWithAlpha(hex, alphaPercent) {
        const normalized = normalizeHexColor(hex, '#000000');
        const channels = [1, 3, 5].map(offset => parseInt(normalized.slice(offset, offset + 2), 16));
        const alpha = normalizeAlphaValue(alphaPercent, 100) / 100;
        return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${Number(alpha.toFixed(2))})`;
    }

    function getThemeAlphaInputId(picker) {
        return `${picker.id}-alpha`;
    }

    function getThemeAlphaValueId(picker) {
        return `${picker.id}-alpha-value`;
    }

    function normalizeThemeSettings(theme) {
        const source = theme && typeof theme === 'object' ? theme : {};
        return {
            bgSoft: normalizeHexColor(source.bgSoft, DEFAULT_THEME.bgSoft),
            bgSoftAlpha: normalizeAlphaValue(source.bgSoftAlpha, DEFAULT_THEME.bgSoftAlpha),
            bg: normalizeHexColor(source.bg, DEFAULT_THEME.bg),
            bgAlpha: normalizeAlphaValue(source.bgAlpha, DEFAULT_THEME.bgAlpha),
            text: normalizeHexColor(source.text, DEFAULT_THEME.text),
            textAlpha: normalizeAlphaValue(source.textAlpha, DEFAULT_THEME.textAlpha),
            accent: normalizeHexColor(source.accent, DEFAULT_THEME.accent),
            accentAlpha: normalizeAlphaValue(source.accentAlpha, DEFAULT_THEME.accentAlpha),
            border: normalizeHexColor(source.border, DEFAULT_THEME.border),
            borderAlpha: normalizeAlphaValue(source.borderAlpha, DEFAULT_THEME.borderAlpha),
            buttonBg: normalizeHexColor(source.buttonBg, DEFAULT_THEME.buttonBg),
            buttonBgAlpha: normalizeAlphaValue(source.buttonBgAlpha, DEFAULT_THEME.buttonBgAlpha),
            buttonBgBottom: normalizeHexColor(source.buttonBgBottom, DEFAULT_THEME.buttonBgBottom),
            buttonBgBottomAlpha: normalizeAlphaValue(source.buttonBgBottomAlpha, DEFAULT_THEME.buttonBgBottomAlpha),
            buttonText: normalizeHexColor(source.buttonText, DEFAULT_THEME.buttonText),
            buttonTextAlpha: normalizeAlphaValue(source.buttonTextAlpha, DEFAULT_THEME.buttonTextAlpha)
        };
    }

    function getThemeSettings() {
        return normalizeThemeSettings(loadSetting(K.theme, DEFAULT_THEME));
    }

    function saveThemeSettings(theme) {
        saveSetting(K.theme, normalizeThemeSettings(theme));
    }

    function buildResolvedTheme(theme = getThemeSettings()) {
        const normalized = normalizeThemeSettings(theme);
        return {
            ...normalized,
            bgSoftCss: colorWithAlpha(normalized.bgSoft, normalized.bgSoftAlpha),
            bgCss: colorWithAlpha(normalized.bg, normalized.bgAlpha),
            bgDeepCss: colorWithAlpha(adjustHexColor(normalized.bg, -16), normalized.bgAlpha),
            textCss: colorWithAlpha(normalized.text, normalized.textAlpha),
            accentCss: colorWithAlpha(normalized.accent, normalized.accentAlpha),
            borderCss: colorWithAlpha(normalized.border, normalized.borderAlpha),
            borderSoftCss: colorWithAlpha(adjustHexColor(normalized.border, -28), normalized.borderAlpha),
            buttonBgCss: colorWithAlpha(normalized.buttonBg, normalized.buttonBgAlpha),
            buttonBgBottomCss: colorWithAlpha(normalized.buttonBgBottom, normalized.buttonBgBottomAlpha),
            buttonTextCss: colorWithAlpha(normalized.buttonText, normalized.buttonTextAlpha),
            uiLightCss: colorWithAlpha(normalized.text, Math.min(normalized.textAlpha, 16)),
            uiLightStrongCss: colorWithAlpha(normalized.text, Math.min(normalized.textAlpha, 60)),
            uiAccentSoftCss: colorWithAlpha(normalized.border, Math.min(normalized.borderAlpha, 18)),
            uiAccentStrongCss: colorWithAlpha(normalized.accent, Math.min(normalized.accentAlpha, 38)),
            uiButtonShadowCss: colorWithAlpha(normalized.buttonBgBottom, normalized.buttonBgBottomAlpha)
        };
    }

    function applyThemeToElement(el, resolvedTheme) {
        if (!el) return;
        const theme = resolvedTheme || buildResolvedTheme();
        el.style.setProperty('--mta-bg-soft', theme.bgSoftCss);
        el.style.setProperty('--mta-bg', theme.bgCss);
        el.style.setProperty('--mta-bg-deep', theme.bgDeepCss);
        el.style.setProperty('--mta-title-text', theme.textCss);
        el.style.setProperty('--mta-hot-text', theme.accentCss);
        el.style.setProperty('--mta-border', theme.borderCss);
        el.style.setProperty('--mta-border-soft', theme.borderSoftCss);
        el.style.setProperty('--mta-button-bg', theme.buttonBgCss);
        el.style.setProperty('--mta-button-bg-bottom', theme.buttonBgBottomCss);
        el.style.setProperty('--mta-button-text', theme.buttonTextCss);
        el.style.setProperty('--mta-ui-light', theme.uiLightCss);
        el.style.setProperty('--mta-ui-light-strong', theme.uiLightStrongCss);
        el.style.setProperty('--mta-ui-accent-soft', theme.uiAccentSoftCss);
        el.style.setProperty('--mta-ui-accent-strong', theme.uiAccentStrongCss);
        el.style.setProperty('--mta-ui-button-shadow', theme.uiButtonShadowCss);
    }

    function applyThemeSettings(theme = getThemeSettings()) {
        const resolvedTheme = buildResolvedTheme(theme);
        applyThemeToElement(document.getElementById('mta-root'), resolvedTheme);
        applyThemeToElement(document.getElementById('mta-toast-host'), resolvedTheme);
        return resolvedTheme;
    }

    function readThemeSettingsFromDom() {
        const theme = {};
        for (const picker of THEME_PICKERS) {
            theme[picker.key] = document.getElementById(picker.id)?.value || DEFAULT_THEME[picker.key];
            theme[picker.alphaKey] = document.getElementById(getThemeAlphaInputId(picker))?.value ?? DEFAULT_THEME[picker.alphaKey];
        }
        return normalizeThemeSettings(theme);
    }

    function syncThemeAlphaReadout(picker, alphaValue) {
        const readout = document.getElementById(getThemeAlphaValueId(picker));
        if (!readout) return;
        readout.textContent = `${normalizeAlphaValue(alphaValue, DEFAULT_THEME[picker.alphaKey])}%`;
    }

    function syncThemeControls(theme = getThemeSettings()) {
        for (const picker of THEME_PICKERS) {
            const input = document.getElementById(picker.id);
            if (input) input.value = theme[picker.key];
            const alphaInput = document.getElementById(getThemeAlphaInputId(picker));
            if (alphaInput) alphaInput.value = String(theme[picker.alphaKey]);
            syncThemeAlphaReadout(picker, theme[picker.alphaKey]);
        }
    }

    function getShowFlags() {
        return !!loadSetting(K.showFlags, true);
    }

    function setShowFlags(value) {
        saveSetting(K.showFlags, !!value);
    }

    function getShowCountryCodes() {
        return !!loadSetting(K.showCountryCodes, true);
    }

    function setShowCountryCodes(value) {
        saveSetting(K.showCountryCodes, !!value);
    }

    function getShowCountdown() {
        return !!loadSetting(K.showCountdown, true);
    }

    function setShowCountdown(value) {
        saveSetting(K.showCountdown, !!value);
    }

    function getShowEta() {
        return !!loadSetting(K.showEta, true);
    }

    function setShowEta(value) {
        saveSetting(K.showEta, !!value);
    }

    function isCurrentlyTravelling() {
    return !!document.querySelector(
        '#icon71, .icon71, [class*="icon71"], li[id="icon71"], li[class*="icon71"]'
    );
}

    function normalizeCategoryOrder(order) {
        const seen = new Set();
        const normalized = [];
        for (const value of Array.isArray(order) ? order : []) {
            if (!DEFAULT_CATEGORIES.includes(value) || seen.has(value)) continue;
            seen.add(value);
            normalized.push(value);
        }
        for (const value of DEFAULT_CATEGORIES) {
            if (seen.has(value)) continue;
            normalized.push(value);
        }
        return normalized;
    }

    function getSelectedCategories() {
        const v = loadSetting(K.selectedCategories, []);
        const selected = normalizeCategoryOrder(v).filter(value => Array.isArray(v) ? v.includes(value) : true);
        return selected;
    }

    function setSelectedCategories(v) {
        const selectedSet = new Set(Array.isArray(v) ? v.filter(value => DEFAULT_CATEGORIES.includes(value)) : []);
        const orderedSelected = getCategoryOrder().filter(value => selectedSet.has(value));
        saveSetting(K.selectedCategories, orderedSelected);
    }

    function getCategoryOrder() {
        return normalizeCategoryOrder(loadSetting(K.categoryOrder, DEFAULT_CATEGORIES));
    }

    function setCategoryOrder(v) {
        saveSetting(K.categoryOrder, normalizeCategoryOrder(v));
    }

   /* function getOrderedSelectedCategories() {
        const selected = new Set(getSelectedCategories());
        return getCategoryOrder().filter(value => selected.has(value));
    }
    */

    function getSelectedItemName() {
        return loadSetting(K.selectedItem, '');
    }

    function setSelectedItemName(v) {
        saveSetting(K.selectedItem, v || '');
    }

    function getSecondaryItemName() {
        return loadSetting(K.SecondaryItem, '');
    }

    function setSecondaryItemName(v) {
        saveSetting(K.SecondaryItem, v || '');
    }

    function hasTripPurchaseDone() {
        return !!loadSetting(K.tripPurchaseDone, false);
    }

    function setTripPurchaseDone(v) {
        saveSetting(K.tripPurchaseDone, !!v);
    }

    function getTripPurchaseCountryKey() {
        return loadSetting(K.tripPurchaseCountry, '');
    }

    function setTripPurchaseCountryKey(v) {
        saveSetting(K.tripPurchaseCountry, v || '');
    }

    function getTripDepartedAt() {
        const n = Number(loadSetting(K.tripDepartedAt, 0));
        return Number.isFinite(n) && n > 0 ? n : 0;
    }

    function setTripDepartedAt(v) {
        saveSetting(K.tripDepartedAt, Number(v) || 0);
    }

    function getTripArriveAt() {
        const n = Number(loadSetting(K.tripArriveAt, 0));
        return Number.isFinite(n) && n > 0 ? n : 0;
    }

    function setTripArriveAt(v) {
        saveSetting(K.tripArriveAt, Number(v) || 0);
    }

    function getTripRoundTripArriveAt() {
        const n = Number(loadSetting(K.tripRoundTripArriveAt, 0));
        return Number.isFinite(n) && n > 0 ? n : 0;
    }

    function setTripRoundTripArriveAt(v) {
        saveSetting(K.tripRoundTripArriveAt, Number(v) || 0);
    }

    function getStoredFlightLeg() {
        const departedAt = Number(loadSetting(K.flightLegDepartedAt, 0));
        const arriveAt = Number(loadSetting(K.flightLegArriveAt, 0));
        const fromKey = String(loadSetting(K.flightLegFromKey, '') || '').trim().toLowerCase();
        const toKey = String(loadSetting(K.flightLegToKey, '') || '').trim().toLowerCase();

        const validFromKey = fromKey === 'torn' || !!COUNTRY_DATA[fromKey];
        const validToKey = toKey === 'torn' || !!COUNTRY_DATA[toKey];
        if (!Number.isFinite(departedAt) || departedAt <= 0 || !Number.isFinite(arriveAt) || arriveAt <= 0) return null;
        if (!validFromKey || !validToKey || !fromKey || !toKey) return null;

        return { departedAt, arriveAt, fromKey, toKey };
    }

    function saveStoredFlightLeg(flightLeg) {
        if (!flightLeg) {
            clearStoredFlightLeg();
            return;
        }

        saveSetting(K.flightLegDepartedAt, Number(flightLeg.departedAt) || 0);
        saveSetting(K.flightLegArriveAt, Number(flightLeg.arriveAt) || 0);
        saveSetting(K.flightLegFromKey, String(flightLeg.fromKey || '').trim().toLowerCase());
        saveSetting(K.flightLegToKey, String(flightLeg.toKey || '').trim().toLowerCase());
    }

    function clearStoredFlightLeg() {
        saveSetting(K.flightLegDepartedAt, 0);
        saveSetting(K.flightLegArriveAt, 0);
        saveSetting(K.flightLegFromKey, '');
        saveSetting(K.flightLegToKey, '');
    }

    function isStoredFlightLegActive(flightLeg = getStoredFlightLeg(), nowTs = Date.now()) {
        if (!flightLeg) return false;
        return Number.isFinite(flightLeg.arriveAt) && flightLeg.arriveAt > nowTs;
    }

    function syncStoredFlightLegFromLiveTravel() {
        const state = readTravelState();
        const nowTs = Date.now();
        const existing = getStoredFlightLeg();
        const route = parseLiveTravelRoute();
        const pageHasReliableLocation = state.hasCountryAttr || state.hasTravelAttr || state.hasAbroadAttr;

        if (route) {
            const travelAnchorKey = route.toKey === 'torn' ? route.fromKey : route.toKey;
            const oneWayMinutes = getTravelTime(travelAnchorKey);
            if (Number.isFinite(oneWayMinutes) && oneWayMinutes > 0) {
                let arriveAt = parseDisplayedLandingAt();
                if (!Number.isFinite(arriveAt) || arriveAt <= 0) {
                    const remainingMinutes = parseRemainingFlightMinutes();
                    if (remainingMinutes != null) {
                        arriveAt = addMinutes(nowTs, remainingMinutes).getTime();
                    } else if (
                        existing
                        && existing.fromKey === route.fromKey
                        && existing.toKey === route.toKey
                        && existing.arriveAt > nowTs
                    ) {
                        arriveAt = existing.arriveAt;
                    }
                }

                if (Number.isFinite(arriveAt) && arriveAt > (nowTs - TRIP_TIMING_GRACE_MS)) {
                    const nextLeg = {
                        departedAt: Math.max(0, arriveAt - (oneWayMinutes * 60000)),
                        arriveAt,
                        fromKey: route.fromKey,
                        toKey: route.toKey
                    };

                    const unchanged = existing
                        && existing.fromKey === nextLeg.fromKey
                        && existing.toKey === nextLeg.toKey
                        && Math.abs(existing.arriveAt - nextLeg.arriveAt) < 1500;

                    if (!unchanged) saveStoredFlightLeg(nextLeg);
                    return nextLeg;
                }
            }
        }

        const withinFreshSessionGrace = existing && (nowTs - existing.departedAt) < TRIP_TIMING_GRACE_MS;
        if (pageHasReliableLocation && !state.traveling && !withinFreshSessionGrace) {
            if (existing) clearStoredFlightLeg();
            return null;
        }

        if (existing && isStoredFlightLegActive(existing, nowTs)) {
            return existing;
        }

        if (existing && existing.arriveAt <= (nowTs - TRIP_TIMING_GRACE_MS)) {
            clearStoredFlightLeg();
            return null;
        }

        return existing;
    }

    function recordFlightLeg(fromKey, toKey) {
        const validFromKey = fromKey === 'torn' || !!COUNTRY_DATA[fromKey];
        const validToKey = toKey === 'torn' || !!COUNTRY_DATA[toKey];
        if (!validFromKey || !validToKey || fromKey === toKey) return;

        const travelAnchorKey = toKey === 'torn' ? fromKey : toKey;
        const oneWayMinutes = getTravelTime(travelAnchorKey);
        if (!Number.isFinite(oneWayMinutes) || oneWayMinutes <= 0) return;

        const departedAt = Date.now();
        const arriveAt = addMinutes(departedAt, oneWayMinutes).getTime();
        saveStoredFlightLeg({ departedAt, arriveAt, fromKey, toKey });
    }

    function recordTripDeparture(countryKey = getSelectedCountryKey()) {
        if (!countryKey || !COUNTRY_DATA[countryKey]) return;
        const departedAt = Date.now();
        const oneWayMinutes = getTravelTime(countryKey);
        const arriveAt = addMinutes(departedAt, oneWayMinutes).getTime();
        const roundTripArriveAt = addMinutes(departedAt, (oneWayMinutes * 2) + PURCHASE_BUFFER_MINUTES).getTime();

        setTripDepartedAt(departedAt);
        setTripArriveAt(arriveAt);
        setTripRoundTripArriveAt(roundTripArriveAt);
    }

    function minutesUntil(timestamp) {
        const diffMs = Number(timestamp || 0) - Date.now();
        if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
        return Math.ceil(diffMs / 60000);
    }

    function clearTripPurchaseState() {
        if (hasTripPurchaseDone()) setTripPurchaseDone(false);
        if (getTripPurchaseCountryKey()) setTripPurchaseCountryKey('');
        if (getTripDepartedAt()) setTripDepartedAt(0);
        if (getTripArriveAt()) setTripArriveAt(0);
        if (getTripRoundTripArriveAt()) setTripRoundTripArriveAt(0);
    }

    function startTripPurchaseState(countryKey = getSelectedCountryKey()) {
        if (getTripPurchaseCountryKey() !== countryKey) setTripPurchaseCountryKey(countryKey);
        if (hasTripPurchaseDone()) setTripPurchaseDone(false);
    }

    function markTripPurchaseDone(countryKey = '') {
        const key = countryKey || getTripPurchaseCountryKey() || getSelectedCountryKey();
        if (key && getTripPurchaseCountryKey() !== key) setTripPurchaseCountryKey(key);
        if (!hasTripPurchaseDone()) setTripPurchaseDone(true);
    }

    function categoryFromType(type) {
        const t = String(type || '');
        if (t === 'flower') return 'flowers';
        if (t === 'plushie') return 'plushies';
        if (t === 'drug') return 'drugs';
        if (t.startsWith('weapon_')) return 'weapons';
        if (['tool', 'material', 'alcohol', 'medical', 'clothing', 'enhancer'].includes(t)) return 'oc';
        return 'other';
    }

    function normalizeFlightCounts(value) {
        const raw = value && typeof value === 'object' ? value : {};
        const counts = {};
        for (const key of COUNTRY_ORDER) {
            const count = Number(raw[key] || 0);
            if (Number.isFinite(count) && count > 0) {
                counts[key] = Math.max(0, Math.floor(count));
            }
        }
        return counts;
    }

    function getFlightCounts() {
        return normalizeFlightCounts(loadSetting(K.flightCounts, {}));
    }

    function saveFlightCounts(value) {
        saveSetting(K.flightCounts, normalizeFlightCounts(value));
    }

    function incrementFlightCount(countryKey) {
        if (!countryKey || !COUNTRY_DATA[countryKey]) return;
        const counts = getFlightCounts();
        counts[countryKey] = Math.max(0, Math.floor(Number(counts[countryKey] || 0))) + 1;
        saveFlightCounts(counts);
    }

    function normalizePurchaseEntry(entry) {
        const itemName = String(entry?.itemName || '').trim();
        const countryKey = String(entry?.countryKey || '').trim().toLowerCase();
        const category = String(entry?.category || '').trim().toLowerCase();
        const quantity = Math.max(1, Math.floor(Number(entry?.quantity || 0)));
        const recordedAt = Math.max(0, Math.floor(Number(entry?.recordedAt || Date.now())));
        const isSecondary = !!entry?.isSecondary;
        if (!itemName || !countryKey || !COUNTRY_DATA[countryKey] || quantity <= 0) return null;
        return {
            itemName,
            countryKey,
            category: DEFAULT_CATEGORIES.includes(category) ? category : 'other',
            quantity,
            isSecondary,
            recordedAt
        };
    }

    function normalizePurchaseHistory(value) {
        if (!Array.isArray(value)) return [];
        return value
            .map(normalizePurchaseEntry)
            .filter(Boolean)
            .sort((a, b) => b.recordedAt - a.recordedAt);
    }

    function getPurchaseHistory() {
        return normalizePurchaseHistory(loadSetting(K.purchaseHistory, []));
    }

    function savePurchaseHistory(value) {
        saveSetting(K.purchaseHistory, normalizePurchaseHistory(value).slice(0, 300));
    }

    function getPurchaseFilter() {
        const value = String(loadSetting(K.purchaseFilter, 'all') || 'all').trim().toLowerCase();
        return PURCHASE_FILTER_OPTIONS.some(option => option.value === value) ? value : 'all';
    }

    function setPurchaseFilter(value) {
        const next = PURCHASE_FILTER_OPTIONS.some(option => option.value === value) ? value : 'all';
        saveSetting(K.purchaseFilter, next);
    }

    function getInstructionsOpen() {
        return loadSetting(K.instructionsOpen, true) !== false;
    }

    function setInstructionsOpen(value) {
        saveSetting(K.instructionsOpen, !!value);
    }

    function findCountryItem(countryKey, itemName) {
        if (!countryKey || !COUNTRY_DATA[countryKey] || !itemName) return null;
        const itemText = normalizeText(itemName);
        return COUNTRY_DATA[countryKey].items.find(item => normalizeText(item.name) === itemText) || null;
    }

    function resolveItemCategory(countryKey, itemName) {
        const item = findCountryItem(countryKey, itemName);
        return item ? categoryFromType(item.type) : 'other';
    }

    function recordPurchaseEntry(entry) {
        const normalized = normalizePurchaseEntry(entry);
        if (!normalized) return;
        const history = getPurchaseHistory();
        history.unshift(normalized);
        savePurchaseHistory(history);
    }

    function getAvailableCategories(countryKey = getSelectedCountryKey()) {
        const c = COUNTRY_DATA[countryKey];
        if (!c) return [];
        const found = new Set(c.items.map(item => categoryFromType(item.type)));
        return getCategoryOrder().filter(category => found.has(category));
    }

    function getEffectiveSelectedCategories(countryKey = getSelectedCountryKey()) {
        const available = getAvailableCategories(countryKey);
        if (!available.length) return [];

        const selected = new Set(getSelectedCategories());
        if (!selected.size) return [];
        const chosen = available.filter(category => selected.has(category));
        return chosen;
    }

    function getVisibleItems(countryKey, categories) {
        const c = COUNTRY_DATA[countryKey];
        if (!c) return [];
        const orderedCategories = normalizeCategoryOrder(categories).filter(value => Array.isArray(categories) ? categories.includes(value) : true);
        return orderedCategories.flatMap(category =>
            c.items.filter(item => categoryFromType(item.type) === category)
        );
    }

    function getCurrentFilteredItems() {
        return getVisibleItems(getSelectedCountryKey(), getEffectiveSelectedCategories());
    }

    function getDefaultSecondaryName(items, primaryName) {
        const nextItem = items.find(item => item.name !== primaryName);
        return nextItem ? nextItem.name : '';
    }

    function getCurrentItem() {
        const items = getCurrentFilteredItems();
        const saved = getSelectedItemName();
        let found = items.find(x => x.name === saved);
        if (!found && items.length) {
            found = items[0];
            setSelectedItemName(found.name);
        }
        return found || null;
    }

    function getTravelFundsRequirement(countryKey = getSelectedCountryKey(), requestedCapacity = getCapacity()) {
        const items = getVisibleItems(countryKey, getEffectiveSelectedCategories(countryKey));
        const primary = items.find(x => x.name === getSelectedItemName()) || items[0] || null;
        const SecondaryName = getSecondaryItemName();
        const Secondary = items.find(x => x.name === SecondaryName) || null;
        const primaryRequired = primary ? Number(primary.price || 0) * requestedCapacity : 0;
        const SecondaryRequired = Secondary && Secondary.name !== primary?.name ? Number(Secondary.price || 0) * requestedCapacity : 0;

        const candidates = [];
        if (primary) candidates.push({
            name: primary.name,
            amount: primaryRequired,
            isSecondary: false
        });
        if (Secondary && Secondary.name !== primary?.name) candidates.push({
            name: Secondary.name,
            amount: SecondaryRequired,
            isSecondary: true
        });

        const positive = candidates.filter(candidate => candidate.amount > 0);
        const required = positive.reduce((max, candidate) => Math.max(max, candidate.amount), 0);
        const mostExpensive = positive.length
            ? positive.reduce((best, candidate) => candidate.amount > best.amount ? candidate : best, positive[0])
            : null;
        const cheapest = positive.length
            ? positive.reduce((best, candidate) => candidate.amount < best.amount ? candidate : best, positive[0])
            : null;

        return {
            primary,
            Secondary,
            primaryRequired,
            SecondaryRequired,
            candidates,
            required,
            mostExpensive,
            cheapest
        };
    }

    function getTravelTime(countryKey) {
        const c = COUNTRY_DATA[countryKey];
        if (!c) return 0;
        const mode = getTravelMode();
        const book = getBookRead();
        if (book && c.travelTimes.book && c.travelTimes.book[mode] != null) return c.travelTimes.book[mode];
        return c.travelTimes[mode] ?? c.travelTimes.standard ?? 0;
    }

    function getEffectiveTravelCost(countryKey) {
        const mode = getTravelMode();
        if (mode === 'airstrip' || mode === 'wlt' || mode === 'business') return 0;
        return COUNTRY_DATA[countryKey]?.travelCost || 0;
    }

    function travelTimeText(mins) {
        const total = Math.max(0, Math.round(Number(mins || 0)));
        const h = Math.floor(total / 60);
        const m = total % 60;
        if (h <= 0) return `${m}m`;
        return `${h}h ${m}m`;
    }

    function clockText(date) {
        try {
            return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        } catch {
            return '—';
        }
    }

    function parseDisplayedLandingAt() {
        const landingSource = document.querySelector('.tt-landing-time .description, .tt-landing-time, [class*="tt-landing-time"] .description, [class*="tt-landing-time"]');
        const landingText = landingSource?.textContent || document.body.innerText || '';
        const match = landingText.match(/landing at\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
        if (!match) return 0;

        const hour = parseInt(match[1], 10) || 0;
        const minute = parseInt(match[2], 10) || 0;
        const second = parseInt(match[3] || '0', 10) || 0;
        const now = new Date();
        const landingAt = new Date(now);
        landingAt.setHours(hour, minute, second, 0);

        // Torn shows a wall-clock landing time; if it already passed today, treat it as the next day.
        if (landingAt.getTime() < (Date.now() - 120000)) {
            landingAt.setDate(landingAt.getDate() + 1);
        }

        return landingAt.getTime();
    }

    function parseDisplayedRemainingFlightText() {
        const timeEl = document.querySelector(
            '.flightProgressSection___fhrD5 .progressText___qJFfY time, [class*="flightProgressSection"] [class*="progressText"] time, .progressText___qJFfY time'
        );
        const directText = String(timeEl?.textContent || '').trim();
        if (directText && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(directText)) {
            return directText;
        }

        const pageText = document.body.innerText || '';
        const match = pageText.match(/remaining flight time\s*[-:]\s*(\d{1,2}:\d{2}(?::\d{2})?)/i);
        return match ? match[1] : '';
    }

    function countdownTextFromTimestamp(timestamp) {
        const diffMs = Number(timestamp || 0) - Date.now();
        if (!Number.isFinite(diffMs) || diffMs <= 0) return '00:00:00';

        const totalSeconds = Math.ceil(diffMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return [
            String(hours).padStart(2, '0'),
            String(minutes).padStart(2, '0'),
            String(seconds).padStart(2, '0')
        ].join(':');
    }

    function getFlightProgressPercent() {
        const liveProgress = document.querySelector(
            '.flightProgressBar___HI4pY[role="progressbar"][aria-valuenow], [class*="flightProgressBar"][role="progressbar"][aria-valuenow], [role="progressbar"][aria-valuenow]'
        );
        if (liveProgress) {
            const value = parseFloat(liveProgress.getAttribute('aria-valuenow') || '');
            if (Number.isFinite(value)) {
                return Math.max(0, Math.min(100, value));
            }
        }

        const storedFlightLeg = syncStoredFlightLegFromLiveTravel();
        if (!storedFlightLeg) return null;

        const totalMs = storedFlightLeg.arriveAt - storedFlightLeg.departedAt;
        if (!Number.isFinite(totalMs) || totalMs <= 0) return null;

        const elapsedMs = Date.now() - storedFlightLeg.departedAt;
        const ratio = elapsedMs / totalMs;
        if (!Number.isFinite(ratio)) return null;
        return Math.max(0, Math.min(100, ratio * 100));
    }

    function formatProgressPercent(percent) {
        const value = Number(percent);
        if (!Number.isFinite(value)) return '';
        return `${Math.max(0, Math.min(100, value)).toFixed(2)}% of the trip`;
    }

    function addMinutes(date, mins) {
        return new Date(new Date(date).getTime() + (Number(mins || 0) * 60000));
    }

    function parseRemainingFlightMinutes() {
        const txt = document.body.innerText || '';

        let m = txt.match(/remaining flight time\s*[-:]\s*([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?/i);
        if (m) {
            const h = parseInt(m[1], 10) || 0;
            const min = parseInt(m[2], 10) || 0;
            const sec = parseInt(m[3] || '0', 10) || 0;
            return (h * 60) + min + (sec > 0 ? 1 : 0);
        }

        m = txt.match(/remaining flight time\s*[-:]\s*([0-9]+)\s*h(?:ours?)?\s*([0-9]+)\s*m/i);
        if (m) return (parseInt(m[1], 10) * 60) + parseInt(m[2], 10);

        m = txt.match(/remaining flight time\s*[-:]\s*([0-9]+)\s*h(?:ours?)?/i);
        if (m) return parseInt(m[1], 10) * 60;

        m = txt.match(/remaining flight time\s*[-:]\s*([0-9]+)\s*m(?:in(?:ute)?s?)?/i);
        if (m) return parseInt(m[1], 10);

        return null;
    }

    function getRequiredMoney(item) {
        if (!item) return 0;
        return Number(item.price || 0) * getCapacity();
    }

    function getCash() {
        const cashEl = document.getElementById('user-money');
        if (cashEl) {
            const n = parseInt(cashEl.getAttribute('data-money') || '0', 10);
            if (!Number.isNaN(n)) return n;
        }
        const txt = document.body.innerText || '';
        const m = txt.match(/\$([\d,]+(?:\.\d+)?)/);
        return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
    }

    function readTravelState() {
        const body = document.body;
        const attrCountry = normalizeText(body.getAttribute('data-country') || '');
        const traveling = body.getAttribute('data-traveling') === 'true';
        const abroad = body.getAttribute('data-abroad') === 'true';
        const isTorn = attrCountry === 'torn' || attrCountry === 'torn city' || attrCountry === 'torncity' || attrCountry === 'torn-city';
        return {
            attrCountry,
            traveling,
            abroad,
            isTorn,
            hasCountryAttr: body.hasAttribute('data-country'),
            hasTravelAttr: body.hasAttribute('data-traveling'),
            hasAbroadAttr: body.hasAttribute('data-abroad')
        };
    }

    function cleanTravelRouteLabel(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .replace(/\s*[.]+$/, '')
            .trim();
    }

    function buildTravelRouteCandidate(fromText, toText, source = '') {
        const cleanFrom = cleanTravelRouteLabel(fromText);
        const cleanTo = cleanTravelRouteLabel(toText);
        if (!cleanFrom || !cleanTo) return null;

        const fromKey = findCountryByNameOrCity(cleanFrom);
        const toKey = findCountryByNameOrCity(cleanTo);
        const validFromKey = fromKey === 'torn' || !!COUNTRY_DATA[fromKey];
        const validToKey = toKey === 'torn' || !!COUNTRY_DATA[toKey];
        if (!validFromKey || !validToKey || !fromKey || !toKey || fromKey === toKey) return null;

        return {
            from: cleanFrom,
            to: cleanTo,
            fromKey,
            toKey,
            source
        };
    }

    function extractTravelRouteFromText(text, { allowSimplePair = false, source = '' } = {}) {
        const raw = String(text || '').replace(/\s+/g, ' ').trim();
        if (!raw) return null;

        let match = raw.match(/travel(?:ing|ling)\s+from\s+(.+?)\s+to\s+(.+?)(?:[.!]|$)/i);
        if (match) return buildTravelRouteCandidate(match[1], match[2], source || 'status');

        match = raw.match(/(.+?)\s+to\s+(.+?)\.\s+remaining flight time/i);
        if (match) return buildTravelRouteCandidate(match[1], match[2], source || 'progress');

        match = raw.match(/(.+?)\s+to\s+(.+?)\s*[-–]\s*remaining flight time/i);
        if (match) return buildTravelRouteCandidate(match[1], match[2], source || 'progress');

        if (!allowSimplePair) return null;
        match = raw.match(/^(.+?)\s+to\s+(.+?)\.?$/i);
        return match ? buildTravelRouteCandidate(match[1], match[2], source || 'pair') : null;
    }

    function parseStatusIconTravelRoute() {
        const icon = document.querySelector('#icon71, .icon71, [class*="icon71"], li[id="icon71"], li[class*="icon71"]');
        if (!icon) return null;

        const textCandidates = [
            icon.getAttribute?.('aria-label'),
            icon.getAttribute?.('title'),
            icon.querySelector?.('[aria-label]')?.getAttribute('aria-label'),
            icon.querySelector?.('[title]')?.getAttribute('title'),
            icon.textContent
        ];

        for (const candidate of textCandidates) {
            const route = extractTravelRouteFromText(candidate, { source: 'status-icon' });
            if (route) return route;
        }

        return null;
    }

    function parseTravelProgressRoute() {
        const selectors = [
            '.flightProgressSection___fhrD5 .progressTextLineBreaker___yl1NA > span:first-child',
            '[class*="flightProgressSection"] [class*="progressTextLineBreaker"] > span:first-child',
            '.progressText___qJFfY [class*="progressTextLineBreaker"] > span:first-child'
        ];

        for (const selector of selectors) {
            const routeEl = document.querySelector(selector);
            const route = extractTravelRouteFromText(routeEl?.textContent, {
                allowSimplePair: true,
                source: 'travel-panel'
            });
            if (route) return route;
        }

        return null;
    }

    function parseLiveTravelRoute() {
        if (isTravelPage()) {
            const panelRoute = parseTravelProgressRoute();
            if (panelRoute) return panelRoute;
        }

        const statusRoute = parseStatusIconTravelRoute();
        if (statusRoute) return statusRoute;

        if (!isTravelPage()) return null;
        return extractTravelRouteFromText(document.body.innerText || '', {
            allowSimplePair: false,
            source: 'travel-body'
        });
    }

    function findCountryByNameOrCity(text) {
        const n = normalizeText(text);
        for (const key of COUNTRY_ORDER) {
            const c = COUNTRY_DATA[key];
            if (!c) continue;
            if (normalizeText(c.name) === n || normalizeText(c.city) === n) return key;
            if (n.includes(normalizeText(c.name)) || n.includes(normalizeText(c.city))) return key;
        }
        if (n.includes('torn')) return 'torn';
        return null;
    }

    function getRememberedLocation() {
        const key = String(loadSetting(K.lastKnownCountry, 'torn') || 'torn').trim().toLowerCase();
        const abroad = !!loadSetting(K.lastKnownAbroad, false);

        if (key === 'torn') {
            return { key: 'torn', abroad: false };
        }

        if (COUNTRY_DATA[key]) {
            return { key, abroad };
        }

        return { key: 'torn', abroad: false };
    }

    function rememberLastStableLocation(state = readTravelState()) {
        if (!state || state.traveling) return;
        const storedFlightLeg = getStoredFlightLeg();
        if (isStoredFlightLegActive(storedFlightLeg)) return;

        if (state.isTorn) {
            saveSetting(K.lastKnownCountry, 'torn');
            saveSetting(K.lastKnownAbroad, false);
            clearStoredFlightLeg();
            return;
        }

        if (!state.abroad) return;

        const currentCountryKey = findCountryByNameOrCity(state.attrCountry);
        if (!currentCountryKey || currentCountryKey === 'torn') return;

        saveSetting(K.lastKnownCountry, currentCountryKey);
        saveSetting(K.lastKnownAbroad, true);
        clearStoredFlightLeg();
    }

    function buildTravelDisplay() {
        const state = readTravelState();
        const nowTs = Date.now();
        const savedKey = getSelectedCountryKey();
        const savedCountry = COUNTRY_DATA[savedKey];
        const rememberedLocation = getRememberedLocation();
        const storedFlightLeg = syncStoredFlightLegFromLiveTravel();
        const storedFlightLegActive = isStoredFlightLegActive(storedFlightLeg, nowTs);

        rememberLastStableLocation(state);

        if (storedFlightLegActive && storedFlightLeg) {
            const fromCountry = storedFlightLeg.fromKey === 'torn' ? null : COUNTRY_DATA[storedFlightLeg.fromKey];
            const toCountry = storedFlightLeg.toKey === 'torn' ? null : COUNTRY_DATA[storedFlightLeg.toKey];
            return {
                traveling: true,
                abroad: false,
                fromKey: storedFlightLeg.fromKey,
                toKey: storedFlightLeg.toKey,
                fromText: storedFlightLeg.fromKey === 'torn' ? 'Torn City' : (fromCountry?.name || 'Unknown'),
                toText: storedFlightLeg.toKey === 'torn' ? 'Torn City' : (toCountry?.name || 'Unknown'),
                currentLabelKey: storedFlightLeg.fromKey === 'torn' ? 'torn' : storedFlightLeg.fromKey,
                currentLabelCode: storedFlightLeg.fromKey === 'torn' ? 'TC' : (fromCountry?.code || '')
            };
        }

        if (state.abroad && !state.isTorn) {
            const detectedCountryKey = findCountryByNameOrCity(state.attrCountry);
            const currentCountryKey = detectedCountryKey
                || (rememberedLocation.abroad && rememberedLocation.key !== 'torn' ? rememberedLocation.key : null);

            if (currentCountryKey && COUNTRY_DATA[currentCountryKey]) {
                const currentCountry = COUNTRY_DATA[currentCountryKey];
                return {
                    traveling: false,
                    abroad: true,
                    fromKey: currentCountryKey,
                    toKey: 'torn',
                    fromText: currentCountry.name,
                    toText: 'Torn City',
                    currentLabelKey: currentCountryKey,
                    currentLabelCode: currentCountry.code
                };
            }
        }

        const pageHasReliableLocation = state.hasCountryAttr || state.hasTravelAttr || state.hasAbroadAttr;
        if (!state.traveling && !pageHasReliableLocation && rememberedLocation.abroad && rememberedLocation.key !== 'torn' && COUNTRY_DATA[rememberedLocation.key]) {
            const currentCountry = COUNTRY_DATA[rememberedLocation.key];
            return {
                traveling: false,
                abroad: true,
                fromKey: rememberedLocation.key,
                toKey: 'torn',
                fromText: currentCountry.name,
                toText: 'Torn City',
                currentLabelKey: rememberedLocation.key,
                currentLabelCode: currentCountry.code
            };
        }

        return {
            traveling: false,
            abroad: false,
            fromKey: 'torn',
            toKey: savedKey,
            fromText: 'Torn City',
            toText: savedCountry.name,
            currentLabelKey: 'torn',
            currentLabelCode: 'TC'
        };
    }

    function updateTripPurchaseStatus() {
        const state = readTravelState();
        const storedFlightLeg = getStoredFlightLeg();
        const storedFlightLegActive = isStoredFlightLegActive(storedFlightLeg);
        if (!state.traveling && state.isTorn) {
            if (storedFlightLegActive) return;
            const departedAt = getTripDepartedAt();
            const withinDepartureGrace = departedAt && (Date.now() - departedAt) < TRIP_TIMING_GRACE_MS;
            if (withinDepartureGrace) return;
            clearTripPurchaseState();
            return;
        }

        if (state.abroad && !state.isTorn) {
            const currentCountryKey = findCountryByNameOrCity(state.attrCountry) || '';
            if (currentCountryKey && !getTripPurchaseCountryKey()) {
                setTripPurchaseCountryKey(currentCountryKey);
            }

            const liveCapacity = getLiveTravelCapacity();
            if (liveCapacity && liveCapacity.current > 0) {
                markTripPurchaseDone(currentCountryKey);
            }
        }
    }

    function buildEtaInfo() {
        const now = new Date();
        const nowTs = now.getTime();
        const ctx = buildTravelDisplay();
        const selectedKey = getSelectedCountryKey();
        const selectedOneWay = getTravelTime(selectedKey);
        const tripCountryKey = getTripPurchaseCountryKey();
        const storedFlightLeg = syncStoredFlightLegFromLiveTravel();
        const displayedLandingAt = parseDisplayedLandingAt();
        const displayedRemainingText = parseDisplayedRemainingFlightText();
        const departedAt = getTripDepartedAt();
        const arriveAt = getTripArriveAt();
        const roundTripArriveAt = getTripRoundTripArriveAt();
        const storedRoundTripMinutes = departedAt && roundTripArriveAt
            ? Math.max(0, Math.ceil((roundTripArriveAt - departedAt) / 60000))
            : 0;

        if (!ctx.traveling && !ctx.abroad && tripCountryKey === selectedKey && departedAt && (nowTs - departedAt) < TRIP_TIMING_GRACE_MS && arriveAt > nowTs) {
            return {
                chipEta: clockText(arriveAt),
                chipCountdown: '',
                arrivalText: clockText(arriveAt),
                roundTripText: roundTripArriveAt > nowTs ? clockText(roundTripArriveAt) : '—',
                roundTripDurationText: storedRoundTripMinutes > 0 ? travelTimeText(storedRoundTripMinutes) : '—',
                remainingText: travelTimeText(minutesUntil(arriveAt))
            };
        }

        if (ctx.traveling) {
            if (displayedLandingAt > nowTs) {
                return {
                    chipEta: clockText(displayedLandingAt),
                    chipCountdown: displayedRemainingText || countdownTextFromTimestamp(displayedLandingAt),
                    arrivalText: clockText(displayedLandingAt),
                    roundTripText: '—',
                    roundTripDurationText: '—',
                    remainingText: travelTimeText(minutesUntil(displayedLandingAt))
                };
            }

            const storedFlightMatchesRoute = storedFlightLeg && (
                !ctx.fromKey
                || !ctx.toKey
                || (ctx.fromKey === storedFlightLeg.fromKey && ctx.toKey === storedFlightLeg.toKey)
            );

            if (storedFlightLeg && storedFlightLeg.arriveAt > nowTs && storedFlightMatchesRoute) {
                return {
                    chipEta: clockText(storedFlightLeg.arriveAt),
                    chipCountdown: countdownTextFromTimestamp(storedFlightLeg.arriveAt),
                    arrivalText: clockText(storedFlightLeg.arriveAt),
                    roundTripText: '—',
                    roundTripDurationText: '—',
                    remainingText: travelTimeText(minutesUntil(storedFlightLeg.arriveAt))
                };
            }

            if (ctx.toKey && ctx.toKey !== 'torn' && tripCountryKey && ctx.toKey === tripCountryKey && arriveAt > nowTs) {
                return {
                    chipEta: clockText(arriveAt),
                    chipCountdown: countdownTextFromTimestamp(arriveAt),
                    arrivalText: clockText(arriveAt),
                    roundTripText: roundTripArriveAt > nowTs ? clockText(roundTripArriveAt) : '—',
                    roundTripDurationText: storedRoundTripMinutes > 0 ? travelTimeText(storedRoundTripMinutes) : '—',
                    remainingText: travelTimeText(minutesUntil(arriveAt))
                };
            }

            if (ctx.toKey === 'torn' && roundTripArriveAt > nowTs) {
                return {
                    chipEta: clockText(roundTripArriveAt),
                    chipCountdown: countdownTextFromTimestamp(roundTripArriveAt),
                    arrivalText: clockText(roundTripArriveAt),
                    roundTripText: '—',
                    roundTripDurationText: '—',
                    remainingText: travelTimeText(minutesUntil(roundTripArriveAt))
                };
            }

            const rem = parseRemainingFlightMinutes();
            if (rem != null) {
                const remArrival = addMinutes(now, rem);
                return {
                    chipEta: clockText(remArrival),
                    chipCountdown: displayedRemainingText || countdownTextFromTimestamp(remArrival),
                    arrivalText: clockText(remArrival),
                    roundTripText: '—',
                    roundTripDurationText: '—',
                    remainingText: travelTimeText(rem)
                };
            }

            if (ctx.toKey && ctx.toKey !== 'torn') {
                const mins = getTravelTime(ctx.toKey);
                const etaAt = addMinutes(now, mins);
                return {
                    chipEta: clockText(etaAt),
                    chipCountdown: countdownTextFromTimestamp(etaAt),
                    arrivalText: clockText(etaAt),
                    roundTripText: '—',
                    roundTripDurationText: '—',
                    remainingText: travelTimeText(mins)
                };
            }

            if (ctx.toKey === 'torn' && ctx.fromKey && ctx.fromKey !== 'torn') {
                const mins = getTravelTime(ctx.fromKey);
                const etaAt = addMinutes(now, mins);
                return {
                    chipEta: clockText(etaAt),
                    chipCountdown: countdownTextFromTimestamp(etaAt),
                    arrivalText: clockText(etaAt),
                    roundTripText: '—',
                    roundTripDurationText: '—',
                    remainingText: travelTimeText(mins)
                };
            }

            return {
                chipEta: '—',
                chipCountdown: '',
                arrivalText: '—',
                roundTripText: '—',
                roundTripDurationText: '—',
                remainingText: '—'
            };
        }

        if (ctx.abroad) {
            const fromKey = ctx.fromKey && ctx.fromKey !== 'torn' ? ctx.fromKey : selectedKey;
            if (tripCountryKey && fromKey === tripCountryKey && roundTripArriveAt > nowTs) {
                return {
                    chipEta: clockText(roundTripArriveAt),
                    chipCountdown: '',
                    arrivalText: clockText(roundTripArriveAt),
                    roundTripText: clockText(roundTripArriveAt),
                    roundTripDurationText: storedRoundTripMinutes > 0 ? travelTimeText(storedRoundTripMinutes) : '—',
                    remainingText: '—'
                };
            }

            const mins = getTravelTime(fromKey);
            const etaAt = addMinutes(now, mins);
            return {
                chipEta: clockText(etaAt),
                chipCountdown: '',
                arrivalText: clockText(etaAt),
                roundTripText: '—',
                roundTripDurationText: '—',
                remainingText: travelTimeText(mins)
            };
        }

        const roundTripMinutes = (selectedOneWay * 2) + PURCHASE_BUFFER_MINUTES;
        const etaAt = addMinutes(now, selectedOneWay);
        return {
            chipEta: clockText(etaAt),
            chipCountdown: '',
            arrivalText: clockText(etaAt),
            roundTripText: clockText(addMinutes(now, roundTripMinutes)),
            roundTripDurationText: travelTimeText(roundTripMinutes),
            remainingText: travelTimeText(selectedOneWay)
        };
    }

    function matchesStatusIconToken(el, token) {
        if (!el || !token) return false;
        const id = String(el.id || '').trim();
        if (id === token) return true;

        const classNames = String(el.className || '')
            .split(/\s+/)
            .filter(Boolean);
        return classNames.some(className => className === token || className.startsWith(`${token}___`));
    }

    function readStatusText(el) {
        if (!el) return '';
        const raw = String(
            el.getAttribute?.('aria-label')
            || el.getAttribute?.('title')
            || ''
        );
        return normalizeText(
            raw
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/gi, '&')
        );
    }

    function findStatusBlocker(blocker) {
        const candidates = Array.from(document.querySelectorAll(
            '.status-icons___gPkXF li, [class*="status-icons"] li, [id^="icon"], a[aria-label], li[class*="icon"]'
        ));

        return candidates.find(candidate => {
            const node = candidate.matches('li') ? candidate : (candidate.closest('li') || candidate);
            const anchor = node.matches('a') ? node : (node.querySelector?.('a[aria-label], a[title]') || null);
            const statusText = [readStatusText(anchor), readStatusText(node)].filter(Boolean).join(' ');

            const iconMatch = blocker.iconTokens.some(token =>
                matchesStatusIconToken(node, token) || matchesStatusIconToken(anchor, token)
            );
            const textMatch = blocker.textPrefixes.some(prefix =>
                statusText === prefix || statusText.startsWith(`${prefix}:`) || statusText.startsWith(`${prefix} `)
            );

            return iconMatch || (blocker.allowTextSecondary && textMatch);
        }) || null;
    }

    function getBlockerStatus() {
        const blockers = [
            { label: 'Hospital Radiation Poisoning', iconTokens: ['icon91'], textPrefixes: [], allowTextSecondary: false },
            { label: 'Hospital Early Discharge', iconTokens: ['icon82'], textPrefixes: [], allowTextSecondary: false },
            { label: 'Hospital', iconTokens: ['icon15'], textPrefixes: [], allowTextSecondary: false },
            { label: 'Federal Jail', iconTokens: ['icon70'], textPrefixes: [], allowTextSecondary: false },
            { label: 'Jail', iconTokens: ['icon16'], textPrefixes: [], allowTextSecondary: false },
            { label: 'Racing', iconTokens: ['icon17'], textPrefixes: [], allowTextSecondary: false },
            { label: 'Pending Action', iconTokens: [], textPrefixes: ['pending action'], allowTextSecondary: true }
        ];

        for (const blocker of blockers) {
            const node = findStatusBlocker(blocker);
            if (!node) continue;

            const anchor = node.matches('a') ? node : (node.querySelector?.('a[aria-label], a[title]') || null);
            const statusText = [readStatusText(anchor), readStatusText(node)].filter(Boolean).join(' ').trim();
            let detail = '';
            if (statusText.includes(':')) {
                detail = statusText.split(':').slice(1).join(':').trim();
            } else if (statusText && normalizeText(statusText) !== normalizeText(blocker.label)) {
                detail = statusText;
            }
            const timer = node.querySelector?.('.timer, [class*="timer"]')?.innerText?.trim()
                || node.parentElement?.querySelector?.('.timer, [class*="timer"]')?.innerText?.trim()
                || '';

            if (timer) return `${blocker.label} (${timer})`;
            if (detail && normalizeText(detail) !== normalizeText(blocker.label)) {
                return `${blocker.label} (${detail})`;
            }
            return blocker.label;
        }

        return null;
    }

    function getIconBlockerStatus() {
        const blockers = [
            { label: 'Hospital Radiation Poisoning', iconTokens: ['icon91'], textPrefixes: [], allowTextSecondary: false },
            { label: 'Hospital Early Discharge', iconTokens: ['icon82'], textPrefixes: [], allowTextSecondary: false },
            { label: 'Hospital', iconTokens: ['icon15'], textPrefixes: [], allowTextSecondary: false },
            { label: 'Federal Jail', iconTokens: ['icon70'], textPrefixes: [], allowTextSecondary: false },
            { label: 'Jail', iconTokens: ['icon16'], textPrefixes: [], allowTextSecondary: false },
            { label: 'Racing', iconTokens: ['icon17'], textPrefixes: [], allowTextSecondary: false }
        ];

        for (const blocker of blockers) {
            if (findStatusBlocker(blocker)) return blocker.label;
        }

        return null;
    }

    function getPageSuppressionReason() {
        const path = window.location.pathname.toLowerCase();
        const sid = new URLSearchParams(window.location.search).get('sid')?.toLowerCase() || '';

        if (path.endsWith('/page.php') && sid === 'racing') {
            return findStatusBlocker({ label: 'Racing', iconTokens: ['icon17'], textPrefixes: [], allowTextSecondary: false })
                ? 'Racing'
                : null;
        }

        if (path.endsWith('/jailview.php')) {
            return findStatusBlocker({ label: 'Jail', iconTokens: ['icon16'], textPrefixes: [], allowTextSecondary: false })
                ? 'Jail'
                : null;
        }

        if (path.endsWith('/hospitalview.php')) {
            const hospitalBlockers = [
                { label: 'Hospital Radiation Poisoning', iconTokens: ['icon91'], textPrefixes: [], allowTextSecondary: false },
                { label: 'Hospital Early Discharge', iconTokens: ['icon82'], textPrefixes: [], allowTextSecondary: false },
                { label: 'Hospital', iconTokens: ['icon15'], textPrefixes: [], allowTextSecondary: false }
            ];

            for (const blocker of hospitalBlockers) {
                if (findStatusBlocker(blocker)) return blocker.label;
            }
        }

        return null;
    }

    function shouldSuppressAssistantOnCurrentPage() {
        return !!getPageSuppressionReason();
    }

    function syncAssistantMountState() {
        const suppressed = shouldSuppressAssistantOnCurrentPage();
        const root = document.getElementById('mta-root');
        const host = document.getElementById('mta-toast-host');

        if (suppressed) {
            closeCustomSelects();
            document.getElementById('mta-menu')?.classList.add('hidden');
            if (root) root.style.display = 'none';
            if (host) host.style.display = 'none';
            return false;
        }

        if (!root) {
            mountAssistantUi();
            return true;
        }

        if (root.style.display === 'none') root.style.display = '';
        if (host && host.style.display === 'none') host.style.display = '';
        return true;
    }

    function positionToastHost() {
        const host = document.getElementById('mta-toast-host');
        const chip = document.getElementById('mta-chip');
        if (!host || !chip) return;

        const margin = 8;
        const gap = 8;
        const rect = chip.getBoundingClientRect();
        const hostWidth = Math.min(host.offsetWidth || 320, window.innerWidth - (margin * 2));
        const hostHeight = host.offsetHeight || 48;
        const maxLeft = Math.max(margin, window.innerWidth - hostWidth - margin);
        const left = Math.max(margin, Math.min(rect.left, maxLeft));

        let top = rect.bottom + gap;
        if (top + hostHeight > window.innerHeight - margin) {
            top = Math.max(margin, rect.top - hostHeight - gap);
        }

        host.style.left = `${Math.round(left)}px`;
        host.style.top = `${Math.round(top)}px`;
        host.style.bottom = 'auto';
    }

    function showToast(msg, type = 'info') {
        let host = document.getElementById('mta-toast-host');
        if (!host) {
            host = document.createElement('div');
            host.id = 'mta-toast-host';
            document.body.appendChild(host);
        }
        applyThemeSettings();
        const d = document.createElement('div');
        d.className = `mta-toast ${type}`;
        d.textContent = msg;
        host.appendChild(d);
        positionToastHost();
        requestAnimationFrame(positionToastHost);
        setTimeout(() => {
            d.style.opacity = '0';
            setTimeout(() => {
                d.remove();
                positionToastHost();
            }, 300);
        }, 3200);
    }

    function safeClick(el) {
        if (!el) return false;
        try { el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); } catch {}
        try { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch {}
        try { el.click(); } catch { return false; }
        try { el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); } catch {}
        try { el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true })); } catch {}
        return true;
    }

    function pause(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function isAssistantUiElement(el) {
        return !!el?.closest?.('#mta-root, #mta-toast-host');
    }

    function hasStoreListingMarkers(el) {
        if (!el) return false;
        const selectors = '[data-tt-content-type="stock"], [data-tt-content-type="buy"], [data-tt-content-type="amount"], form[id^="item-"], button[form^="item-"]';
        return !!(el.matches?.(selectors) || el.querySelector?.(selectors));
    }

    function findStoreListingRoot(anchor) {
        let node = anchor;
        while (node && node !== document.body) {
            if (hasStoreListingMarkers(node)) return node;
            node = node.parentElement;
        }
        return null;
    }

    function findClickableByText(fragments, root = document) {
        const list = Array.from(root.querySelectorAll('button, a, input, [role="button"], div, span'))
            .filter(el => !isAssistantUiElement(el));
        return list.find(el => {
            const txt = normalizeText(el.textContent || el.value || el.getAttribute('aria-label') || el.title || '');
            return fragments.some(f => txt === normalizeText(f) || txt.includes(normalizeText(f)));
        }) || null;
    }

    function isPurchaseConfirmationPanel(el) {
        if (!el || isAssistantUiElement(el)) return false;
        const txt = normalizeText(el.innerText || '');
        if (!txt || !txt.includes('buy')) return false;

        const controls = Array.from(el.querySelectorAll('button, a, input, [role="button"]'))
            .filter(control => !isAssistantUiElement(control));
        const controlText = controls.map(control => normalizeText(
            control.textContent || control.value || control.getAttribute('aria-label') || control.title || ''
        ));

        const hasYes = controlText.some(value => value === 'yes' || value.includes('yes'));
        const hasNo = controlText.some(value => value === 'no' || value.includes('no'));
        const hasQuestion = txt.includes(' for $') || txt.includes(' for strong$') || txt.includes('?');
        const hasConfirmClass = String(el.className || '').toLowerCase().includes('confirmpanel');
        return (hasYes && hasNo && hasQuestion) || (hasConfirmClass && hasYes && hasNo);
    }

    function findPurchaseDialog() {
        const nodes = Array.from(document.querySelectorAll('div, section, article'));
        return nodes.find(el => {
            if (isAssistantUiElement(el)) return false;
            const isConfirmPanel = isPurchaseConfirmationPanel(el);
            if (hasStoreListingMarkers(el) && !isConfirmPanel) return false;
            if (hasStoreListingMarkers(el.closest?.('tr, li')) && !isConfirmPanel) return false;
            const txt = normalizeText(el.innerText || '');
            if (!txt || txt.length < 12 || txt.length > 800) return false;

            const controls = Array.from(el.querySelectorAll('button, a, input, [role="button"]'))
                .filter(control => !isAssistantUiElement(control));
            const controlText = controls.map(control => normalizeText(
                control.textContent || control.value || control.getAttribute('aria-label') || control.title || ''
            ));

            const hasPurchaseCopy = txt.includes('do you want to buy')
                || /buy\s+\d+x/.test(txt)
                || ((txt.includes('qty') || txt.includes('quantity') || txt.includes('max')) && txt.includes('buy'));
            const hasMax = controlText.some(value => value === 'max');
            const hasBuy = controlText.some(value => value === 'buy' || value.includes('buy'));
            const hasYes = controlText.some(value => value === 'yes' || value.includes('confirm'));
            const hasQty = Array.from(el.querySelectorAll('input[type="number"], input[type="text"]')).some(input => {
                const ph = normalizeText(input.placeholder || '');
                const name = normalizeText(input.name || '');
                const aria = normalizeText(input.getAttribute('aria-label') || '');
                return ph.includes('qty') || name.includes('qty') || aria.includes('qty') || aria.includes('quantity');
            });

            return isConfirmPanel || (hasPurchaseCopy && (hasMax || hasQty) && (hasBuy || hasYes));
        }) || null;
    }

    function destinationTerms(countryKey) {
        const c = COUNTRY_DATA[countryKey];
        if (!c) return [];
        return [c.name.toLowerCase(), c.city.toLowerCase(), c.code.toLowerCase()];
    }

    function findDestinationMapChoice(countryKey) {
        const terms = destinationTerms(countryKey);
        const radios = Array.from(document.querySelectorAll(
            'fieldset.worldMap___SvXMZ input[name="destination"], input.destinationRadio___KMeJf, input[type="radio"][name="destination"]'
        ));
        let best = null;
        let bestScore = -1;

        for (const radio of radios) {
            const text = normalizeText([
                radio.getAttribute('aria-label') || '',
                radio.value || '',
                radio.closest('label')?.innerText || '',
                radio.closest('label')?.getAttribute('aria-label') || ''
            ].join(' '));
            if (!text) continue;

            let score = 0;
            for (const term of terms) {
                if (text.includes(term)) score += 10;
            }
            if (radio.checked) score += 1;

            if (score > bestScore) {
                bestScore = score;
                best = radio;
            }
        }

        if (!best || bestScore < 10) return null;
        return {
            target: best,
            highlight: best.closest('label') || best
        };
    }

    function findDestinationListChoice(countryKey) {
        const terms = destinationTerms(countryKey);
        const buttons = Array.from(document.querySelectorAll(
            '.destinationList___fx7Gb button[aria-controls^="travel-country-"], button.expandButton___Q7fCV[aria-controls^="travel-country-"]'
        ));
        let best = null;
        let bestScore = -1;

        for (const button of buttons) {
            const text = normalizeText([
                button.textContent || '',
                button.getAttribute('aria-label') || '',
                button.getAttribute('aria-controls') || ''
            ].join(' '));
            if (!text) continue;

            let score = 0;
            for (const term of terms) {
                if (text.includes(term)) score += 10;
            }
            if (text.includes('free')) score += 1;
            if (button.getAttribute('aria-expanded') === 'true') score += 1;

            if (score > bestScore) {
                bestScore = score;
                best = button;
            }
        }

        if (!best || bestScore < 10) return null;
        return {
            target: best,
            highlight: best.closest('.destination___kRlg6') || best
        };
    }

    function findDestinationRow(countryKey) {
        const terms = destinationTerms(countryKey);
        const nodes = Array.from(document.querySelectorAll('tr, li, div, article, section, label, input'));
        let best = null;
        let bestScore = -1;

        for (const el of nodes) {
            const txt = normalizeText([
                el.innerText || '',
                el.textContent || '',
                el.getAttribute?.('aria-label') || '',
                el.getAttribute?.('title') || ''
            ].join(' '));
            if (!txt || txt.length < 3 || txt.length > 450) continue;

            let score = 0;
            for (const t of terms) if (txt.includes(t)) score += 10;
            if (txt.includes('free')) score += 2;
            if (txt.includes(':')) score += 1;
            if (txt.includes("modul's smuggler") || txt.includes('travel assistant') || txt.includes('quick flight')) score -= 25;
            if (txt.includes('events') || txt.includes('forums')) score -= 10;

            if (score > bestScore) {
                bestScore = score;
                best = el;
            }
        }
        return bestScore >= 10 ? best : null;
    }

    function findClickableInside(row, countryKey) {
        if (!row) return null;
        const terms = destinationTerms(countryKey);
        const clickables = Array.from(row.querySelectorAll('button, a, input, [role="button"], [onclick], div, span'));
        const direct = clickables.find(el => {
            const txt = normalizeText(el.textContent || el.value || el.getAttribute('aria-label') || el.title || '');
            return terms.some(t => txt.includes(t)) || txt.includes('travel') || txt.includes('book') || txt.includes('fly') || txt.includes('free');
        });

        return direct || clickables[0] || null;
    }

    function getUiThemeColor(name, Secondary = '') {
        const root = document.getElementById('mta-root');
        if (!root) return Secondary;
        const value = getComputedStyle(root).getPropertyValue(name).trim();
        return value || Secondary;
    }

    function highlightElement(el, color = '') {
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const oldOutline = el.style.outline;
        const oldBoxShadow = el.style.boxShadow;
        const oldBg = el.style.backgroundColor;
        const outlineColor = color || getUiThemeColor('--mta-border', '#cc1218');
        const glowColor = getUiThemeColor('--mta-ui-accent-strong', 'rgba(163,52,49,0.32)');
        const bgColor = getUiThemeColor('--mta-ui-accent-soft', 'rgba(163,52,49,0.12)');

        el.style.outline = `2px solid ${outlineColor}`;
        el.style.boxShadow = `0 0 0 3px ${glowColor}`;
        el.style.backgroundColor = bgColor;

        setTimeout(() => {
            el.style.outline = oldOutline;
            el.style.boxShadow = oldBoxShadow;
            el.style.backgroundColor = oldBg;
        }, 2500);
    }

    function isTravelActionContext(el) {
        return !!el?.closest?.(
            '.destination___kRlg6, [class*="destination___"], ' +
            '.destinationPanel___LsJ4v, [class*="destinationPanel"], ' +
            '.flightDetailsGrid___uAttX, [class*="flightDetailsGrid"], ' +
            '.confirmPanel___KqaRh, [class*="confirmPanel"], ' +
            '.worldMap___SvXMZ, [class*="worldMap"], ' +
            '.destinationList___fx7Gb, [class*="destinationList"]'
        );
    }

    function findContinueButton() {
        const expandedRows = Array.from(document.querySelectorAll('.destination___kRlg6'))
            .filter(row => {
                const cls = String(row.className || '');
                return cls.includes('expanded') || !!row.querySelector('button[aria-expanded="true"]');
            });

        for (const row of expandedRows) {
            const inlineContinue = Array.from(row.querySelectorAll('button, a, input, [role="button"]'))
                .filter(el => !isAssistantUiElement(el))
                .find(el => normalizeText(el.textContent || el.value || el.getAttribute('aria-label') || '') === 'continue');
            if (inlineContinue) return inlineContinue;
        }

        const confirmPanelContinue = document.querySelector(
            '.confirmPanel___KqaRh .buttons___Uk5cy .torn-btn, [class*="confirmPanel"] [class*="buttons"] .torn-btn'
        );
        if (confirmPanelContinue && !isAssistantUiElement(confirmPanelContinue)) {
            const txt = normalizeText(
                confirmPanelContinue.textContent
                || confirmPanelContinue.value
                || confirmPanelContinue.getAttribute('aria-label')
                || ''
            );
            if (txt === 'continue') return confirmPanelContinue;
        }

        const desktopConfirmContinue = document.querySelector(
            '.destinationPanel___LsJ4v .confirmPanel___KqaRh .buttons___Uk5cy .torn-btn, [class*="destinationPanel"] [class*="confirmPanel"] [class*="buttons"] .torn-btn'
        );
        if (desktopConfirmContinue && !isAssistantUiElement(desktopConfirmContinue)) {
            const txt = normalizeText(
                desktopConfirmContinue.textContent
                || desktopConfirmContinue.value
                || desktopConfirmContinue.getAttribute('aria-label')
                || ''
            );
            if (txt === 'continue') return desktopConfirmContinue;
        }

        const directTravelButton = document.querySelector(
            '.flightDetailsGrid___uAttX button[aria-label^="Travel to"], [class*="flightDetailsGrid"] button[aria-label^="Travel to"]'
        );
        if (directTravelButton && !isAssistantUiElement(directTravelButton)) return directTravelButton;

        const destinationPanels = Array.from(document.querySelectorAll('.destinationPanel___LsJ4v, [class*="destinationPanel"]'))
            .filter(panel => !isAssistantUiElement(panel));
        for (const panel of destinationPanels) {
            const travelButton = Array.from(panel.querySelectorAll('button, a, input, [role="button"]'))
                .filter(el => !isAssistantUiElement(el))
                .find(el => {
                    const txt = normalizeText(el.textContent || el.value || el.getAttribute('aria-label') || '');
                    return txt === 'travel' || txt.startsWith('travel to ');
                });
            if (travelButton) return travelButton;
        }

        const clickables = Array.from(document.querySelectorAll('button.torn-btn, a.torn-btn, button, a, input, [role="button"]'))
            .filter(el => !isAssistantUiElement(el));

        const precise = clickables.find(el => {
            const txt = normalizeText(el.textContent || el.value || el.getAttribute('aria-label') || '');
            return txt === 'continue' || txt.startsWith('travel to ');
        });
        if (precise) return precise;

        return clickables.find(el => {
            const txt = normalizeText(el.textContent || el.value || el.getAttribute('aria-label') || '');
            if (txt.startsWith('travel to ')) return true;
            return txt.startsWith('continue') && isTravelActionContext(el);
        }) || null;
    }

    function findReturnHeaderButton() {
        const exact = document.querySelector('a.travel-home-header-button[aria-controls="travel-home-panel"], .travel-home-header-button[aria-controls="travel-home-panel"]');
        if (exact && !isAssistantUiElement(exact)) return exact;

        return Array.from(document.querySelectorAll('.travel-home-header-button, a[aria-controls="travel-home-panel"], [aria-controls="travel-home-panel"]')).find(el => {
            if (isAssistantUiElement(el)) return false;
            const txt = normalizeText(el.textContent || el.value || el.getAttribute('aria-label') || el.title || '');
            return txt.includes('travel home') || txt.includes('return home') || txt.includes('torn city');
        }) || null;
    }

    function findTravelBackButton() {
        const confirmButton = document.querySelector(
            '.confirmCancel___cTh4w button.torn-btn, [class*="confirmCancel"] button.torn-btn, .body___HopIb .confirmCancel___cTh4w .torn-btn, [class*="body"] [class*="confirmCancel"] .torn-btn'
        );
        if (confirmButton && !isAssistantUiElement(confirmButton)) {
            const txt = normalizeText(confirmButton.textContent || confirmButton.value || confirmButton.getAttribute('aria-label') || confirmButton.title || '');
            if (txt.includes('travel back')) return confirmButton;
        }

        return Array.from(document.querySelectorAll('button.torn-btn, a.torn-btn, button, a, input, [role="button"]'))
            .filter(el => !isAssistantUiElement(el))
            .find(el => {
            const txt = normalizeText(el.textContent || el.value || el.getAttribute('aria-label') || el.title || '');
            return txt.includes('travel back');
        }) || null;
    }

    function findReturnButton() {
        return findTravelBackButton() || findReturnHeaderButton() || Array.from(document.querySelectorAll('button, a, input, [role="button"]'))
            .filter(el => !isAssistantUiElement(el))
            .find(el => {
            const txt = normalizeText(el.textContent || el.value || el.getAttribute('aria-label') || el.title || '');
            return txt.includes('return home') || txt.includes('return to torn') || txt.includes('travel home') || txt.includes('torn city');
        }) || null;
    }

    function findStoreRowForItem(itemName) {
        const wantedName = normalizeText(itemName);
        const nameButtons = Array.from(document.querySelectorAll('button[class*="itemNameButton"], button[aria-controls$="-itemInfoWrapper"]'))
            .filter(btn => !isAssistantUiElement(btn));

        const directButton = nameButtons.find(btn => normalizeText(btn.textContent || '') === wantedName)
            || nameButtons.find(btn => normalizeText(btn.textContent || '').includes(wantedName));
        if (directButton) {
            const fromButton = findStoreListingRoot(directButton);
            if (fromButton) return fromButton;

            const infoId = directButton.getAttribute('aria-controls') || '';
            const infoWrap = infoId ? document.getElementById(infoId) : null;
            const fromInfo = findStoreListingRoot(infoWrap);
            if (fromInfo) return fromInfo;
        }

        const rows = Array.from(document.querySelectorAll('tr, li, article, section, div'));
        return rows.find(r => {
            if (isAssistantUiElement(r)) return false;
            if (!hasStoreListingMarkers(r)) return false;
            const txt = normalizeText(r.innerText || '');
            return txt.includes(wantedName);
        }) || null;
    }

    function getStoreRowStock(row) {
        if (!row) return null;
        const stockEl = row.querySelector('[data-tt-content-type="stock"]');
        if (!stockEl) return null;

        const stockText = normalizeText(stockEl.textContent || '');
        if (stockText.includes('out of stock') || stockText.includes('sold out') || stockText === 'none') {
            return 0;
        }

        const digits = String(stockEl.textContent || '').replace(/[^\d]/g, '');
        if (!digits) return null;
        const stock = parseInt(digits, 10);
        return Number.isFinite(stock) ? stock : null;
    }

    function findBuyControlInRow(row) {
        if (!row) return null;
        const buyCell = row.querySelector('[data-tt-content-type="buy"]') || row;
        const controls = Array.from(buyCell.querySelectorAll('button, a, [role="button"], input'))
            .filter(el => !el.disabled && !isAssistantUiElement(el));

        return controls.find(el => {
            const txt = normalizeText(el.textContent || el.value || el.getAttribute('aria-label') || el.title || '');
            const cls = String(el.className || '').toLowerCase();
            const formId = String(el.getAttribute('form') || '').toLowerCase();
            return formId.startsWith('item-')
                || cls.includes('buybutton')
                || cls.includes('buyiconbutton')
                || txt === 'buy'
                || txt.includes('buy')
                || txt.includes('cart');
        }) || null;
    }

    function findStoreQuantityInput(row) {
        if (!row) return null;
        const buyControl = findBuyControlInRow(row);
        const formId = buyControl?.getAttribute('form');
        const scope = formId ? document.getElementById(formId) : row;
        if (!scope) return null;

        const inputs = Array.from(scope.querySelectorAll('input[type="number"], input[type="text"], input.input-money'))
            .filter(input => input.type !== 'hidden');
        return inputs.find(input => {
            const ph = normalizeText(input.placeholder || '');
            const name = normalizeText(input.name || '');
            const aria = normalizeText(input.getAttribute('aria-label') || '');
            const testId = normalizeText(input.getAttribute('data-testid') || '');
            return ph.includes('qty')
                || name.includes('qty')
                || aria.includes('qty')
                || aria.includes('quantity')
                || testId.includes('money-input');
        }) || null;
    }

    function readStoreQuantity(row) {
        const input = findStoreQuantityInput(row);
        if (!input) return null;

        const current = parseInt(String(input.value || input.getAttribute('value') || '').replace(/[^\d-]/g, ''), 10);
        return Number.isFinite(current) ? current : null;
    }

    function fillStoreQuantity(row, quantity) {
        const input = findStoreQuantityInput(row);
        if (!input) return false;
        const nextValue = String(quantity);
        const formId = findBuyControlInRow(row)?.getAttribute('form');
        const scope = formId ? document.getElementById(formId) : row;
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

        input.focus();
        if (nativeSetter) nativeSetter.call(input, nextValue);
        else input.value = nextValue;
        input.setAttribute('value', nextValue);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: '0' }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));

        if (scope) {
            Array.from(scope.querySelectorAll('input[type="hidden"]')).forEach(hiddenInput => {
                const ph = normalizeText(hiddenInput.placeholder || '');
                const name = normalizeText(hiddenInput.name || '');
                const aria = normalizeText(hiddenInput.getAttribute('aria-label') || '');
                const testId = normalizeText(hiddenInput.getAttribute('data-testid') || '');
                const looksLikeQty = ph.includes('qty')
                    || name.includes('qty')
                    || aria.includes('qty')
                    || aria.includes('quantity')
                    || testId.includes('money-input');
                if (!looksLikeQty) return;

                if (nativeSetter) nativeSetter.call(hiddenInput, nextValue);
                else hiddenInput.value = nextValue;
                hiddenInput.setAttribute('value', nextValue);
            });
        }

        return true;
    }

    function getStorePurchaseChoices() {
        const item = getCurrentItem();
        const Secondary = getSecondaryItemName();
        const requestedCapacity = getRemainingTripCapacity();
        const names = [];
        if (item?.name) names.push({ name: item.name, isSecondary: false });
        if (Secondary && Secondary !== item?.name) names.push({ name: Secondary, isSecondary: true });

        return names.map(choice => {
            const row = findStoreRowForItem(choice.name);
            const stock = getStoreRowStock(row);
            const buyControl = findBuyControlInRow(row);
            const desiredQty = stock == null ? requestedCapacity : Math.min(requestedCapacity, Math.max(stock, 0));
            return {
                ...choice,
                row,
                stock,
                buyControl,
                desiredQty
            };
        }).filter(choice => !!choice.row && choice.desiredQty > 0);
    }

    function getBestStorePurchaseChoice() {
        const choices = getStorePurchaseChoices();
        if (!choices.length) return null;

        const available = choices.find(choice => choice.buyControl && (choice.stock == null || choice.stock > 0));
        return available || choices[0];
    }

    function findMaxButton() {
        const prompt = findPurchaseDialog();
        if (!prompt) return null;
        return findClickableByText(['max'], prompt);
    }

    function findBuyButton() {
        const prompt = findPurchaseDialog();
        if (!prompt) return null;
        return Array.from(prompt.querySelectorAll('button, a, [role="button"], div, span, input')).find(el => {
            const txt = normalizeText(el.textContent || el.value || el.getAttribute('aria-label') || '');
            return txt === 'buy' || txt.includes('buy');
        }) || null;
    }

    function findYesButton() {
        const confirmPanels = Array.from(document.querySelectorAll('.confirmPanel___g6h5V, [class*="confirmPanel"]'))
            .filter(panel => isPurchaseConfirmationPanel(panel));
        for (const panel of confirmPanels) {
            const directYes = Array.from(panel.querySelectorAll('button, a, input, [role="button"], div, span')).find(el => {
                if (isAssistantUiElement(el)) return false;
                const txt = normalizeText(el.textContent || el.value || el.getAttribute('aria-label') || el.title || '');
                const cls = String(el.className || '').toLowerCase();
                return txt === 'yes' || txt.includes('yes') || cls.includes('yes___');
            });
            if (directYes) return directYes;
        }

        const prompt = findPurchaseDialog();
        if (!prompt) return null;
        return findClickableByText(['yes'], prompt);
    }

    function parsePurchaseConfirmationDetails(source = findPurchaseDialog() || document) {
        const scope = source?.closest?.('.confirmPanel___g6h5V, [class*="confirmPanel"]') || source;
        const text = String(
            scope?.querySelector?.('.confirmQuestion___mq37F, [class*="confirmQuestion"], .question___ilSlI, [class*="question"]')?.textContent
            || scope?.textContent
            || ''
        ).replace(/\s+/g, ' ').trim();

        const match = text.match(/buy\s+(\d+)\s*x\s+(.+?)\s+for\s+\$/i);
        if (!match) return null;

        const quantity = parseInt(match[1], 10);
        const itemName = String(match[2] || '').trim();
        if (!Number.isFinite(quantity) || quantity <= 0 || !itemName) return null;

        return {
            quantity,
            itemName
        };
    }

    function findForumLikeButton() {
        if (!isScriptForumThreadUrl(location.href)) return null;

        const directThreadLike = document.querySelector(
            'li.like.forum-button[data-event="like"]:not(.disabled) button.like-icon:not([disabled]), li.like[data-event="like"]:not(.disabled) button.like-item:not([disabled])'
        );
        if (directThreadLike && !isAssistantUiElement(directThreadLike)) return directThreadLike;

        const clickables = Array.from(document.querySelectorAll('button, a, input, [role="button"]'))
            .filter(el => !isAssistantUiElement(el) && !el.disabled);

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
        if (!item || isAssistantUiElement(item)) return null;

        const button = item.querySelector('button.like-icon, button.like-item, button');
        const disabled = item.classList.contains('disabled')
            || !!button?.disabled
            || !!item.querySelector('.rating-results-pending');

        return { item, button, disabled };
    }

    function isForumPostAlreadyLiked() {
        if (!isScriptForumThreadUrl(location.href)) return false;

        const clickables = Array.from(document.querySelectorAll('button, a, input, [role="button"]'))
            .filter(el => !isAssistantUiElement(el));

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

    function findQuantityInput(root = findPurchaseDialog() || document) {
        const inputs = Array.from(root.querySelectorAll('input[type="number"], input[type="text"]'));
        return inputs.find(el => {
            const ph = normalizeText(el.placeholder || '');
            const name = normalizeText(el.name || '');
            const aria = normalizeText(el.getAttribute('aria-label') || '');
            return ph.includes('qty') || name.includes('qty') || aria.includes('qty') || aria.includes('quantity');
        }) || null;
    }

    function fillQtyInput(capacity) {
        const prompt = findPurchaseDialog();
        if (!prompt) return false;
        const qty = findQuantityInput(prompt);
        if (!qty) return false;

        qty.focus();
        qty.value = String(capacity);
        qty.dispatchEvent(new Event('input', { bubbles: true }));
        qty.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    function purchaseDialogNeedsQuantity(capacity) {
        const prompt = findPurchaseDialog();
        if (!prompt) return false;

        const qty = findQuantityInput(prompt);
        if (!qty) return !!findMaxButton();

        const current = parseInt(String(qty.value || qty.getAttribute('value') || '').replace(/[^\d-]/g, ''), 10);
        if (!Number.isFinite(current)) return true;
        return current !== capacity;
    }

    function storeHasSelectedItem() {
        return getStorePurchaseChoices().length > 0;
    }

    async function runQuickAction() {
        if (shouldSuppressAssistantOnCurrentPage()) return;

        const now = Date.now();
        if (quickActionInFlight || now < nextQuickActionAt) return;

        quickActionInFlight = true;
        nextQuickActionAt = now + QUICK_ACTION_COOLDOWN_MS;

        try {
            saveSettingsFromMenu(false, false);
            updateTripPurchaseStatus();

            const capacity = getRemainingTripCapacity();
            const state = readTravelState();
            const prompt = findPurchaseDialog();
            const purchaseConfirmButton = prompt ? findYesButton() : null;
            if (purchaseConfirmButton) {
                await confirmPurchaseFromUserAction(purchaseConfirmButton);
                return;
            }

            const blocker = getBlockerStatus();
            if (blocker && !state.traveling && state.isTorn) {
                showToast(`Blocked: ${blocker}`, 'warn');
                return;
            }

            if (!isTravelPage()) {
                openTravelAgentPage();
                return;
            }
            if (state.traveling) {
                showToast('Already travelling.');
                return;
            }

            if (state.abroad && !state.isTorn) {
                const liveCapacity = getLiveTravelCapacity();
                const hasRemainingCapacity = !liveCapacity || liveCapacity.current < liveCapacity.max;
                const hasCompletedPurchase = hasTripPurchaseDone() || (liveCapacity && liveCapacity.current >= liveCapacity.max);

                if (hasCompletedPurchase) {
                    await returnHomeStep();
                    return;
                }

                if (prompt && purchaseDialogNeedsQuantity(capacity)) {
                    await fillPurchaseQuantity();
                    return;
                }

                if (prompt && findBuyButton()) {
                    await clickBuyStep();
                    return;
                }

                if (hasRemainingCapacity && storeHasSelectedItem()) {
                    await openPurchaseDialog();
                    return;
                }

                showToast('No purchase confirmed for this trip yet. Buy first, then return home.', 'warn');
                return;
            }

            if (findContinueButton()) {
                await continueTravelStep();
                return;
            }

            await selectDestinationStep();
        } finally {
            quickActionInFlight = false;
        }
    }

    async function selectDestinationStep() {
        if (!isTravelPage()) {
            openTravelAgentPage();
            return;
        }

        const state = readTravelState();
        const blocker = getBlockerStatus();

        if (blocker && !state.traveling) {
            showToast(`Blocked: ${blocker}`, 'warn');
            return;
        }

        if (state.traveling) {
            showToast('Already travelling.');
            return;
        }

        if (state.abroad && !state.isTorn) {
            showToast('You are abroad. Use Return Helper instead.', 'warn');
            return;
        }

        const funds = getTravelFundsRequirement(getSelectedCountryKey(), getCapacity());
        const item = funds.primary;
        const capacity = getCapacity();
        const cash = getCash();

        const requiredLabel = funds.mostExpensive?.name || item?.name || funds.Secondary?.name || 'selected item';
        const requiredAmount = funds.mostExpensive?.amount || funds.required || 0;
        if (requiredAmount > 0 && cash < requiredAmount) {
            showToast(`Need ${formatMoney(requiredAmount)} for ${requiredLabel}. You have ${formatMoney(cash)}.`, 'warn');
            return;
        }

        const listChoice = findDestinationListChoice(getSelectedCountryKey());
        if (listChoice) {
            highlightElement(listChoice.highlight);
            safeClick(listChoice.target);
            showToast(`Selected ${getCountry().name}. Press the hotkey again to confirm travel.`);
            return;
        }

        const mapChoice = findDestinationMapChoice(getSelectedCountryKey());
        if (mapChoice) {
            highlightElement(mapChoice.highlight);
            safeClick(mapChoice.target);
            showToast(`Selected ${getCountry().name}. Press the hotkey again to confirm travel.`);
            return;
        }

        const row = findDestinationRow(getSelectedCountryKey());
        if (!row) {
            showToast(`Could not find ${getCountry().name}.`, 'warn');
            return;
        }

        highlightElement(row);
        const clickable = findClickableInside(row, getSelectedCountryKey()) || row;
        safeClick(clickable);
        showToast(`Selected ${getCountry().name}. Press the hotkey again to confirm travel.`);
    }

    async function continueTravelStep() {
        if (!isTravelPage()) {
            openTravelAgentPage();
            return;
        }

        const btn = findContinueButton();
        if (!btn) {
            showToast('Travel confirmation button not found.', 'warn');
            return;
        }

        const state = readTravelState();
        const buttonLabel = normalizeText(btn.textContent || btn.value || btn.getAttribute('aria-label') || '');
        highlightElement(btn);
        const clicked = safeClick(btn);
        const startsActualTravel = buttonLabel === 'continue' || buttonLabel.startsWith('continue');
        if (clicked && startsActualTravel && !state.traveling && (!state.abroad || state.isTorn)) {
            startTripPurchaseState(getSelectedCountryKey());
            if (state.isTorn) {
                incrementFlightCount(getSelectedCountryKey());
                recordFlightLeg('torn', getSelectedCountryKey());
                recordTripDeparture(getSelectedCountryKey());
            }
        }
        if (buttonLabel === 'travel' || buttonLabel.startsWith('travel to ')) {
            showToast('Opened travel confirmation.');
            return;
        }
        showToast('Confirmed travel.');
    }

    async function returnHomeStep() {
        if (!isTravelPage()) {
            openTravelAgentPage();
            return;
        }

        const state = readTravelState();
        if (!state.abroad || state.isTorn) {
            showToast('Return Helper works when you are abroad.', 'warn');
            return;
        }

        const headerBtn = findReturnHeaderButton();
        const headerExpanded = String(headerBtn?.getAttribute?.('aria-expanded') || '').toLowerCase() === 'true';
        if (headerBtn && !headerExpanded) {
            highlightElement(headerBtn);
            safeClick(headerBtn);
            showToast('Opened Travel Home.');
            return;
        }

        const travelBackBtn = findTravelBackButton();
        if (travelBackBtn) {
            const currentCountryKey = findCountryByNameOrCity(state.attrCountry) || getTripPurchaseCountryKey() || getSelectedCountryKey();
            highlightElement(travelBackBtn);
            const clicked = safeClick(travelBackBtn);
            if (clicked && currentCountryKey && currentCountryKey !== 'torn') recordFlightLeg(currentCountryKey, 'torn');
            showToast('Pressed Travel Back.');
            return;
        }

        const genericBtn = findReturnButton();
        if (genericBtn) {
            const currentCountryKey = findCountryByNameOrCity(state.attrCountry) || getTripPurchaseCountryKey() || getSelectedCountryKey();
            highlightElement(genericBtn);
            const clicked = safeClick(genericBtn);
            if (clicked && currentCountryKey && currentCountryKey !== 'torn') recordFlightLeg(currentCountryKey, 'torn');
            showToast('Opened return step.');
            return;
        }

        showToast('Return button not found on this page.', 'warn');
    }

    async function openPurchaseDialog() {
        const choice = getBestStorePurchaseChoice();
        if (!choice) {
            showToast('Could not find selected or Secondary item on this page.', 'warn');
            return;
        }

        if (choice.stock != null && choice.stock <= 0) {
            const label = choice.isSecondary ? `Secondary item ${choice.name}` : choice.name;
            showToast(`${label} is out of stock.`, 'warn');
            return;
        }

        const pickedLabel = choice.isSecondary ? `${choice.name} (Secondary)` : choice.name;
        const currentQty = readStoreQuantity(choice.row);
        if (choice.desiredQty > 0 && currentQty !== choice.desiredQty && fillStoreQuantity(choice.row, choice.desiredQty)) {
            highlightElement(choice.row);
            showToast(`Set ${pickedLabel} quantity to ${choice.desiredQty}. Buying now...`);
            await pause(90);
        }

        const buyControl = findBuyControlInRow(choice.row) || choice.buyControl;
        if (!buyControl) {
            const label = choice.isSecondary ? `Secondary item ${choice.name}` : choice.name;
            showToast(`Buy button not available for ${label}.`, 'warn');
            return;
        }

        highlightElement(choice.row);
        safeClick(buyControl);
        setTimeout(() => updateTripPurchaseStatus(), 250);
        setTimeout(() => updateTripPurchaseStatus(), 900);
        showToast(`Pressed Buy for ${pickedLabel}. Press hotkey or tap plane again to confirm.`);
    }

    async function fillPurchaseQuantity() {
        const capacity = getRemainingTripCapacity();

        const maxBtn = findMaxButton();
        if (maxBtn) {
            highlightElement(maxBtn);
            safeClick(maxBtn);
            showToast('Pressed MAX.');
            return;
        }

        if (fillQtyInput(capacity)) {
            showToast(`Filled quantity with ${capacity}.`);
            return;
        }

        showToast('MAX/quantity input not found.', 'warn');
    }

    async function clickBuyStep() {
        const btn = findBuyButton();
        if (!btn) {
            showToast('Buy button not found.', 'warn');
            return;
        }

        highlightElement(btn);
        safeClick(btn);
        showToast('Pressed Buy. Press hotkey or tap plane again to confirm.');
    }

    async function confirmPurchaseFromUserAction(button = findYesButton()) {
        if (!button) {
            showToast('Purchase confirmation button not found.', 'warn');
            return;
        }

        const purchaseDetails = parsePurchaseConfirmationDetails(button);
        const state = readTravelState();
        const countryKey = findCountryByNameOrCity(state.attrCountry) || getTripPurchaseCountryKey() || getSelectedCountryKey();
        const primaryName = getCurrentItem()?.name || '';
        const SecondaryName = getSecondaryItemName();
        highlightElement(button);
        const clicked = safeClick(button);
        if (clicked) {
            if (countryKey) markTripPurchaseDone(countryKey);

            if (purchaseDetails && countryKey && COUNTRY_DATA[countryKey]) {
                const normalizedItemName = normalizeText(purchaseDetails.itemName);
                const isSecondary = !!SecondaryName
                    && normalizedItemName === normalizeText(SecondaryName)
                    && normalizedItemName !== normalizeText(primaryName);

                recordPurchaseEntry({
                    itemName: purchaseDetails.itemName,
                    countryKey,
                    category: resolveItemCategory(countryKey, purchaseDetails.itemName),
                    quantity: purchaseDetails.quantity,
                    isSecondary,
                    recordedAt: Date.now()
                });
            }
        }
        setTimeout(() => updateTripPurchaseStatus(), 250);
        setTimeout(() => updateTripPurchaseStatus(), 900);
        setTimeout(() => updateTripPurchaseStatus(), 1800);
        showToast('Pressed Yes from your hotkey.');
    }

    async function handleForumLikeAction() {
        saveSettingsFromMenu(false, false);

        const currentThreadUrl = rememberCurrentForumPostUrl();
        if (currentThreadUrl) {
            const likeWidget = getForumLikeWidget();
            if (likeWidget?.disabled) {
                showToast('Like is unavailable on this account or Torn is still loading the forum ratings here.', 'warn');
                return;
            }

            const likeButton = findForumLikeButton();
            if (!likeButton) {
                if (isForumPostAlreadyLiked()) {
                    showToast('This forum thread already looks liked.');
                    return;
                }
                showToast('Like button not found on this forum thread.', 'warn');
                return;
            }

            highlightElement(likeButton);
            safeClick(likeButton);
            showToast('Pressed Like on the current forum thread.');
            return;
        }

        const savedThreadUrl = getSavedForumPostUrl();
        showToast('Opening the Smuggler release thread. Press "Like this script!" again there.');
        setTimeout(() => {
            location.href = savedThreadUrl;
        }, 60);
    }

    injectStyles(`
        #mta-root {
            --mta-bg: #333333;
            --mta-bg-soft: #515151;
            --mta-bg-deep: #2b2b2b;
            --mta-title-text: #ffffff;
            --mta-hot-text: #ffffff;
            --mta-border: #a33431;
            --mta-border-soft: #7a2220;
            --mta-button-bg: #87110f;
            --mta-button-bg-bottom: #5f0c0b;
            --mta-button-text: #ffffff;
            position: fixed;
            top: 12px;
            right: 12px;
            z-index: 999999;
            font-family: Arial, sans-serif;
            user-select: none;
            -webkit-user-select: none;
            touch-action: none;
            max-width: calc(100vw - 8px);
            width: max-content;
            text-shadow:
                0 1px 0 rgba(0,0,0,0.9),
                0 0 5px rgba(0,0,0,0.62);
        }

        #mta-root *,
        #mta-root input,
        #mta-root select,
        #mta-root button,
        #mta-toast-host,
        #mta-toast-host * {
            text-shadow:
                0 1px 0 rgba(0,0,0,0.9),
                0 0 5px rgba(0,0,0,0.62);
        }

        #mta-select-layer {
            position: fixed;
            inset: 0;
            z-index: 1000000;
            pointer-events: none;
        }

        #mta-select-layer:empty {
            display: none;
        }

        #mta-select-layer .mta-select-list {
            display: grid;
            gap: 3px;
            pointer-events: auto;
        }

        #mta-chip {
            display: grid;
            grid-template-columns: auto 26px 24px auto auto auto;
            grid-template-rows: minmax(28px, auto) 4px;
            align-items: center;
            justify-items: center;
            column-gap: 6px;
            row-gap: 5px;
            position: relative;
            background: linear-gradient(180deg, var(--mta-bg-soft) 0%, var(--mta-bg) 100%);
            border: 1px solid var(--mta-border);
            border-radius: 10px;
            padding: 7px 8px 8px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.42);
            min-height: 42px;
            line-height: 1;
            overflow: hidden;
            width: fit-content;
            max-width: calc(100vw - 8px);
            box-sizing: border-box;
            cursor: grab;
        }

        #mta-chip {
            position: relative;
            z-index: 1;
        }

        #mta-chip:active {
            cursor: grabbing;
        }

        #mta-progress {
            position: relative;
            grid-column: 1 / -1;
            grid-row: 2;
            justify-self: stretch;
            align-self: end;
            height: 3px;
            border-radius: 999px;
            background: rgba(0,0,0,0.28);
            box-shadow:
                inset 0 1px 1px rgba(0,0,0,0.42),
                0 0 0 1px var(--mta-ui-accent-soft);
            overflow: hidden;
            opacity: 0;
            transition: opacity .18s ease;
            pointer-events: auto;
            cursor: help;
        }

        #mta-progress.visible {
            opacity: 1;
        }

        #mta-progress-fill {
            width: 0%;
            height: 100%;
            border-radius: inherit;
            background: linear-gradient(90deg, var(--mta-border) 0%, var(--mta-button-bg) 100%);
            box-shadow:
                0 0 10px var(--mta-ui-accent-strong),
                inset 0 0 0 1px var(--mta-ui-light);
            transition: width .5s linear;
        }

        #mta-countdown {
            grid-column: 5;
            grid-row: 1;
            display: none;
            align-items: center;
            justify-content: center;
            min-height: 22px;
            min-width: 0;
            color: var(--mta-title-text);
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
            opacity: 0.96;
            text-align: center;
        }

        #mta-countdown.visible {
            display: inline-flex;
        }

        #mta-label {
            grid-column: 1;
            grid-row: 1;
            min-width: auto;
            text-align: center;
            color: var(--mta-title-text);
            font-size: 11px;
            font-weight: bold;
            padding: 0 2px;
            min-height: 22px;
            box-sizing: border-box;
            cursor: inherit;
            line-height: 1;
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
        }

        #mta-label.is-torn {
            padding: 0 2px;
            background: transparent;
            border-color: transparent;
            box-shadow: none;
        }

        #mta-label .flag-badge-wrap {
            display: inline-flex;
            align-items: center;
            white-space: nowrap;
        }

        #mta-label .code {
            display: inline-flex;
            align-items: center;
            min-height: 16px;
            font-size: 11px;
            letter-spacing: .4px;
            white-space: nowrap;
            line-height: 1;
        }

        .mta-flag-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 16px;
            border-radius: 3px;
            overflow: hidden;
            box-shadow: inset 0 0 0 1px var(--mta-ui-light-strong);
            flex: 0 0 auto;
        }

        .mta-flag-badge svg {
            display: block;
            width: 100%;
            height: 100%;
        }

        .mta-flag-badge.is-torn {
            width: 16px;
            height: 16px;
            border-radius: 0;
            box-shadow: none;
            background: transparent;
            overflow: visible;
            filter: drop-shadow(0 1px 1px rgba(0,0,0,0.65));
        }

        .mta-flag-badge.is-torn img {
            display: block;
            width: 100%;
            height: 100%;
            border: 0;
            outline: 0;
        }

        #mta-plane {
            grid-column: 2;
            grid-row: 1;
            width: 26px;
            height: 24px;
            border-radius: 8px;
            border: 1px solid var(--mta-border);
            background: linear-gradient(180deg, var(--mta-button-bg), var(--mta-button-bg-bottom));
            box-shadow:
                inset 0 1px 0 var(--mta-ui-light-strong),
                inset 0 -3px 0 rgba(0,0,0,0.36),
                0 2px 0 var(--mta-ui-button-shadow),
                0 5px 12px rgba(0,0,0,0.38);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            padding: 0;
            flex: 0 0 auto;
        }

        #mta-plane:not(:disabled):hover {
            box-shadow:
                inset 0 1px 0 var(--mta-ui-light-strong),
                inset 0 -3px 0 rgba(0,0,0,0.34),
                0 2px 0 var(--mta-ui-button-shadow),
                0 0 0 1px var(--mta-ui-accent-soft),
                0 0 12px var(--mta-ui-accent-strong),
                0 7px 14px rgba(0,0,0,0.38);
        }

        #mta-plane svg {
            width: 16px;
            height: 16px;
            fill: var(--mta-button-text);
            transition: transform .25s ease, fill .25s ease;
            pointer-events: none;
        }

        #mta-plane:disabled {
            cursor: not-allowed;
            opacity: 0.58;
            box-shadow:
                inset 0 1px 0 rgba(255,255,255,0.06),
                inset 0 -2px 0 rgba(0,0,0,0.28),
                0 1px 0 rgba(0,0,0,0.24),
                0 3px 8px rgba(0,0,0,0.24);
            filter: grayscale(0.18);
        }

        #mta-plane:disabled svg {
            opacity: 0.78;
        }

        #mta-destination-flag {
            grid-column: 3;
            grid-row: 1;
            display: none;
            align-items: center;
            justify-content: center;
            min-width: 22px;
            min-height: 22px;
            line-height: 1;
        }

        #mta-destination-code,
        #mta-eta {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 22px;
            min-width: 0;
            color: var(--mta-title-text);
            font-size: 12px;
            font-weight: 700;
            letter-spacing: .4px;
            white-space: nowrap;
            line-height: 1;
            text-align: center;
            font-variant-numeric: tabular-nums;
        }

        #mta-destination-code {
            grid-column: 4;
            grid-row: 1;
            justify-self: center;
        }

        #mta-eta {
            grid-column: 6;
            grid-row: 1;
        }

        #mta-eta.hidden {
            display: none !important;
        }

        #mta-menu {
            position: fixed;
            top: 60px;
            left: 50%;
            width: min(340px, calc(100vw - 14px));
            max-height: calc(100vh - 96px);
            background: linear-gradient(180deg, var(--mta-bg-soft) 0%, var(--mta-bg) 100%);
            color: var(--mta-title-text);
            border: 1px solid var(--mta-border);
            border-radius: 14px;
            box-shadow: 0 14px 30px rgba(0,0,0,0.45);
            overflow: hidden;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            z-index: 20;
        }

        #mta-menu.hidden {
            display: none !important;
        }

        .mta-menu-top,
        .mta-body,
        .mta-menu-footer {
            position: relative;
        }

        .mta-menu-top,
        .mta-menu-footer {
            flex: 0 0 auto;
            background: linear-gradient(180deg, var(--mta-bg-soft) 0%, var(--mta-bg) 100%);
        }

        .mta-menu-top {
            border-bottom: 1px solid var(--mta-border);
            z-index: 30;
            overflow: visible;
        }

        .mta-menu-footer {
            border-top: 1px solid var(--mta-border-soft);
            box-shadow: inset 0 1px 0 var(--mta-ui-accent-soft);
            padding: 10px 12px 12px;
            z-index: 25;
        }

        .mta-head {
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:8px;
            padding:10px 10px;
            background: linear-gradient(180deg, var(--mta-bg-soft) 0%, var(--mta-bg) 100%);
            cursor: grab;
        }

        .mta-menu-pinned {
            padding: 10px 12px 12px;
            position: relative;
            z-index: 31;
            overflow: visible;
        }

        .mta-title {
            font-size:13px;
            font-weight:700;
            color:var(--mta-title-text);
        }

        .mta-drag-glyph {
            font-size: 12px;
            color: var(--mta-title-text);
            opacity: 0.72;
        }

        .mta-body {
            padding: 10px 12px 12px;
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            overflow-x: hidden;
            box-sizing: border-box;
            scrollbar-width: thin;
            scrollbar-color: var(--mta-border) var(--mta-bg-deep);
            scrollbar-gutter: stable;
            z-index: 20;
        }

        .mta-body::-webkit-scrollbar {
            width: 11px;
        }

        .mta-body::-webkit-scrollbar-track {
            background: linear-gradient(180deg, var(--mta-bg) 0%, var(--mta-bg-deep) 100%);
            border-left: 1px solid var(--mta-ui-accent-soft);
        }

        .mta-body::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, var(--mta-border) 0%, var(--mta-title-text) 100%);
            border: 2px solid var(--mta-bg-deep);
            border-radius: 999px;
            box-shadow: inset 0 0 0 1px var(--mta-ui-accent-strong);
        }

        .mta-body::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, var(--mta-border) 0%, var(--mta-hot-text) 100%);
        }

        .mta-body::-webkit-scrollbar-corner {
            background: var(--mta-bg-deep);
        }

        .mta-row { margin-top: 10px; }
        .mta-row:first-child { margin-top: 0; }

        .mta-label2 {
            font-size: 11px;
            color: var(--mta-title-text);
            margin-bottom: 5px;
            text-transform: uppercase;
        }

        #mta-menu select,
        #mta-menu input[type="number"],
        #mta-menu input[type="text"] {
            width: 100%;
            background: linear-gradient(180deg, var(--mta-bg-soft) 0%, var(--mta-bg-deep) 100%);
            color: var(--mta-title-text);
            border: 1px solid var(--mta-border);
            border-radius: 14px;
            padding: 9px 38px 9px 12px;
            box-sizing: border-box;
            font-size: 13px;
            min-height: 39px;
            box-shadow: inset 0 0 0 1px var(--mta-ui-light);
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            background-clip: padding-box;
            color-scheme: dark;
        }

        #mta-menu select {
            background-image:
                linear-gradient(180deg, var(--mta-bg-soft) 0%, var(--mta-bg-deep) 100%),
                url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 20 20'%3E%3Cpath fill='%23ffffff' d='M5.5 7.5 10 12l4.5-4.5 1.5 1.5-6 6-6-6z'/%3E%3C/svg%3E");
            background-repeat: no-repeat, no-repeat;
            background-position: 0 0, right 12px center;
            background-size: auto, 16px 16px;
        }

        #mta-menu option,
        #mta-menu optgroup {
            background: #333333 !important;
            background-color: #333333 !important;
            color: var(--mta-title-text) !important;
            color-scheme: dark;
        }

        #mta-menu option:hover,
        #mta-menu option:focus,
        #mta-menu option:checked {
            background: #515151 !important;
            background-color: #515151 !important;
            color: var(--mta-hot-text) !important;
            box-shadow: 0 0 0 999px #515151 inset;
        }

        #mta-menu select:focus,
        #mta-menu select:focus-visible {
            outline: 1px solid var(--mta-hot-text);
            box-shadow:
                inset 0 0 0 1px var(--mta-ui-light),
                0 0 0 2px var(--mta-ui-accent-soft);
        }

        .mta-select {
            position: relative;
            width: 100%;
        }

        .mta-select.open {
            z-index: 100;
        }

        .mta-native-select {
            position: absolute !important;
            width: 1px !important;
            height: 1px !important;
            opacity: 0 !important;
            pointer-events: none !important;
            left: 0;
            top: 0;
        }

        .mta-select-button {
            width: 100%;
            min-height: 39px;
            border: 1px solid var(--mta-border);
            border-radius: 14px;
            background: linear-gradient(180deg, var(--mta-bg-soft) 0%, var(--mta-bg-deep) 100%);
            color: var(--mta-title-text);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 9px 12px;
            box-sizing: border-box;
            font-size: 13px;
            font-weight: 700;
            text-align: left;
            cursor: pointer;
            box-shadow: inset 0 0 0 1px var(--mta-ui-light);
        }

        .mta-select-button:hover,
        .mta-select.open .mta-select-button {
            background: linear-gradient(180deg, var(--mta-bg-soft), var(--mta-bg));
            color: var(--mta-hot-text);
        }

        .mta-select-chevron {
            width: 9px;
            height: 9px;
            flex: 0 0 auto;
            border-right: 2px solid currentColor;
            border-bottom: 2px solid currentColor;
            transform: rotate(45deg) translateY(-1px);
            transition: transform .15s ease;
        }

        .mta-select.open .mta-select-chevron {
            transform: rotate(-135deg) translate(-1px, 1px);
        }

        .mta-select-list {
            display: none;
            position: absolute;
            top: calc(100% + 5px);
            left: 0;
            right: 0;
            z-index: 101;
            max-height: 190px;
            overflow-y: auto;
            background: linear-gradient(180deg, var(--mta-bg-soft), var(--mta-bg));
            border: 1px solid var(--mta-border);
            border-radius: 12px;
            box-shadow:
                inset 0 1px 0 var(--mta-ui-light),
                0 8px 18px rgba(0,0,0,0.34);
            padding: 4px;
            box-sizing: border-box;
            scrollbar-width: thin;
            scrollbar-color: var(--mta-border) var(--mta-bg);
        }

        .mta-select.open .mta-select-list {
            display: grid;
            gap: 3px;
        }

        .mta-select-option {
            width: 100%;
            min-height: 31px;
            border: 0;
            border-radius: 8px;
            background: var(--mta-bg);
            color: var(--mta-title-text);
            display: block;
            padding: 7px 9px;
            box-sizing: border-box;
            text-align: left;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
        }

        .mta-select-option:hover,
        .mta-select-option:focus {
            background: var(--mta-bg-soft);
            color: var(--mta-hot-text);
            outline: 0;
        }

        .mta-select-option[aria-selected="true"] {
            background: var(--mta-bg-deep);
            color: var(--mta-hot-text);
        }

        .mta-select-option[aria-disabled="true"] {
            opacity: 0.58;
            cursor: default;
        }

        .mta-select-button:disabled {
            opacity: 0.62;
            cursor: default;
        }

        .mta-country-row {
            display: grid;
            grid-template-columns: 39px 1fr;
            gap: 8px;
            align-items: center;
            position: relative;
            z-index: 32;
            overflow: visible;
        }

        .mta-country-badge {
            width: 39px;
            min-height: 39px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--mta-title-text);
            font-size: 18px;
            line-height: 1;
            background: transparent;
            cursor: pointer;
        }

        .mta-country-badge .mta-flag-badge {
            width: 30px;
            height: 20px;
            border-radius: 4px;
        }

        .mta-key {
            width: 100%;
            background: linear-gradient(180deg, var(--mta-bg-soft), var(--mta-bg-deep));
            color: var(--mta-title-text);
            border: 1px solid var(--mta-border);
            border-radius: 9px;
            padding: 10px;
            text-align: center;
            font-weight: 700;
            cursor: pointer;
            box-sizing: border-box;
        }

        .mta-hotkey-wrap {
            display: grid;
            gap: 6px;
        }

        .mta-grid2 {
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:8px;
        }

        .mta-settings-grid {
            gap: 12px;
        }

        .mta-settings-hotkey {
            border-left: 1px solid var(--mta-border-soft);
            padding-left: 12px;
        }

        .mta-sub-row {
            margin-top: 10px;
        }

        .mta-book-check {
            margin-top: 8px;
        }

        .mta-check-wrap {
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:6px 8px;
        }

        .mta-check {
            display:flex;
            align-items:center;
            gap:6px;
            background: linear-gradient(180deg, var(--mta-bg-soft), var(--mta-bg-deep));
            border:1px solid var(--mta-border-soft);
            border-radius:9px;
            padding:7px 8px;
            font-size:12px;
            color: var(--mta-title-text);
        }

        .mta-check input[type="checkbox"] {
            width: 14px;
            height: 14px;
            margin: 0;
            flex: 0 0 auto;
            accent-color: var(--mta-border);
        }

        .mta-check input[type="checkbox"]:focus-visible {
            outline: 1px solid var(--mta-hot-text);
            outline-offset: 1px;
        }

        .mta-panel-card {
            background: linear-gradient(180deg, var(--mta-bg-soft), var(--mta-bg-deep));
            border: 1px solid var(--mta-border-soft);
            border-radius: 12px;
            padding: 10px;
            box-shadow: inset 0 1px 0 var(--mta-ui-light);
        }

        .mta-panel-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 6px;
        }

        .mta-panel-head .mta-label2 {
            margin-bottom: 0;
        }

        .mta-panel-filter {
            min-width: 126px;
            max-width: 148px;
            flex: 0 0 auto;
        }

        .mta-collapsible {
            padding: 0;
            overflow: hidden;
        }

        .mta-collapse-head {
            list-style: none;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 10px 12px;
            cursor: pointer;
        }

        .mta-collapse-head::-webkit-details-marker {
            display: none;
        }

        .mta-collapse-head .mta-label2 {
            margin: 0;
        }

        .mta-collapse-glyph {
            width: 9px;
            height: 9px;
            flex: 0 0 auto;
            border-right: 2px solid currentColor;
            border-bottom: 2px solid currentColor;
            transform: rotate(45deg) translateY(-1px);
            transition: transform .16s ease;
            color: var(--mta-hot-text);
        }

        .mta-collapsible[open] .mta-collapse-glyph {
            transform: rotate(-135deg) translate(-1px, 1px);
        }

        .mta-collapse-body {
            padding: 0 12px 12px;
            color: var(--mta-title-text);
            font-size: 12px;
            line-height: 1.5;
        }

        .mta-stats-grid {
            gap: 10px;
        }

        .mta-history-list {
            display: grid;
            gap: 7px;
            max-height: 176px;
            overflow-y: auto;
            padding-right: 2px;
        }

        .mta-history-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 10px;
            padding: 7px 8px;
            border: 1px solid var(--mta-border-soft);
            border-radius: 9px;
            background: linear-gradient(180deg, var(--mta-bg-soft), var(--mta-bg));
        }

        .mta-history-main {
            min-width: 0;
            display: grid;
            gap: 3px;
        }

        .mta-history-badge {
            display: inline-flex;
            align-items: center;
        }

        .mta-history-text {
            color: var(--mta-title-text);
            font-size: 12px;
            font-weight: 700;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .mta-history-meta {
            color: var(--mta-hot-text);
            font-size: 10px;
            opacity: 0.92;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .mta-history-value {
            color: var(--mta-hot-text);
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
        }

        .mta-empty-state {
            min-height: 94px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: var(--mta-title-text);
            font-size: 11px;
            line-height: 1.45;
            border: 1px dashed var(--mta-border-soft);
            border-radius: 9px;
            background: linear-gradient(180deg, var(--mta-bg-soft), var(--mta-bg));
            padding: 12px;
            box-sizing: border-box;
        }

        .mta-switch-stack {
            display: grid;
            gap: 8px;
        }

        .mta-switch-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            min-height: 34px;
            color: var(--mta-title-text);
            font-size: 12px;
            font-weight: 700;
        }

        .mta-switch-label {
            flex: 1 1 auto;
        }

        .mta-switch {
            position: relative;
            display: inline-flex;
            width: 42px;
            height: 24px;
            flex: 0 0 auto;
        }

        .mta-switch input {
            position: absolute;
            inset: 0;
            opacity: 0;
            cursor: pointer;
            margin: 0;
        }

        .mta-switch-slider {
            position: absolute;
            inset: 0;
            border-radius: 999px;
            background: linear-gradient(180deg, var(--mta-bg-soft), var(--mta-bg-deep));
            border: 1px solid var(--mta-border-soft);
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.34);
            transition: background .15s ease, border-color .15s ease;
        }

        .mta-switch-slider::before {
            content: "";
            position: absolute;
            top: 2px;
            left: 2px;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: linear-gradient(180deg, var(--mta-button-text), var(--mta-title-text));
            box-shadow:
                0 1px 4px rgba(0,0,0,0.32),
                inset 0 1px 0 var(--mta-ui-light-strong);
            transition: transform .15s ease;
        }

        .mta-switch input:checked + .mta-switch-slider {
            background: linear-gradient(180deg, var(--mta-button-bg), var(--mta-button-bg-bottom));
            border-color: var(--mta-border);
        }

        .mta-switch input:checked + .mta-switch-slider::before {
            transform: translateX(18px);
        }

        .mta-switch input:focus-visible + .mta-switch-slider {
            outline: 1px solid var(--mta-hot-text);
            outline-offset: 2px;
        }

        .mta-theme-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            align-items: stretch;
        }

        .mta-theme-tools {
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .mta-theme-reset {
            border: 1px solid var(--mta-border-soft);
            border-radius: 9px;
            min-height: 30px;
            padding: 0 9px;
            background: linear-gradient(180deg, var(--mta-bg-soft), var(--mta-bg-deep));
            color: var(--mta-title-text);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: inset 0 1px 0 var(--mta-ui-light);
        }

        .mta-theme-reset:hover {
            color: var(--mta-hot-text);
            border-color: var(--mta-border);
            filter: brightness(1.04);
        }

        .mta-theme-reset:active {
            transform: translateY(1px);
        }

        .mta-theme-reset svg {
            width: 12px;
            height: 12px;
            fill: currentColor;
            flex: 0 0 auto;
        }

        .mta-color-field {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 7px;
            min-height: 72px;
            background: linear-gradient(180deg, var(--mta-bg-soft), var(--mta-bg-deep));
            border: 1px solid var(--mta-border-soft);
            border-radius: 10px;
            padding: 7px 8px;
            box-sizing: border-box;
            min-width: 0;
            align-content: start;
        }

        .mta-color-label {
            color: var(--mta-title-text);
            font-size: 12px;
            font-weight: 700;
            min-width: 0;
        }

        .mta-color-controls {
            display: grid;
            grid-template-columns: 34px minmax(0, 1fr);
            align-items: center;
            gap: 8px;
            width: 100%;
            min-width: 0;
        }

        .mta-color-picker {
            width: 34px;
            height: 28px;
            padding: 0;
            border: 1px solid var(--mta-ui-light-strong);
            border-radius: 7px;
            background: transparent;
            cursor: pointer;
            overflow: hidden;
            box-sizing: border-box;
        }

        .mta-color-picker::-webkit-color-swatch-wrapper {
            padding: 0;
        }

        .mta-color-picker::-webkit-color-swatch,
        .mta-color-picker::-moz-color-swatch {
            border: 0;
            border-radius: 6px;
        }

        .mta-alpha-wrap {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 6px;
            min-width: 0;
            width: 100%;
        }

        .mta-alpha-slider {
            width: 100%;
            margin: 0;
            accent-color: var(--mta-button-bg);
            cursor: pointer;
            min-width: 0;
        }

        .mta-alpha-value {
            min-width: 40px;
            text-align: right;
            color: var(--mta-title-text);
            font-size: 11px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
        }

        .mta-cats {
            display:flex;
            flex-direction:column;
            gap:8px;
        }

        .mta-cat-item {
            cursor: default;
        }

        .mta-cat-item.dragging {
            opacity: 0.76;
            border-color: var(--mta-border);
            background: linear-gradient(180deg, var(--mta-bg-soft), var(--mta-bg));
            box-shadow: 0 0 0 1px var(--mta-ui-accent-soft);
        }

        .mta-cat-handle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            color: var(--mta-hot-text);
            font-size: 14px;
            font-weight: 700;
            line-height: 1;
            letter-spacing: -1px;
            cursor: grab;
            user-select: none;
            touch-action: none;
            flex: 0 0 auto;
        }

        .mta-cat-handle:active {
            cursor: grabbing;
        }

        .mta-cat-text {
            flex: 1 1 auto;
        }

        .mta-info {
            margin-top: 10px;
            background: linear-gradient(180deg, var(--mta-bg-soft), var(--mta-bg-deep));
            border: 1px solid var(--mta-border-soft);
            border-radius: 10px;
            padding: 9px 10px;
            font-size: 12px;
            line-height: 1.45;
            color: var(--mta-title-text);
        }

        .mta-info strong { color:var(--mta-hot-text); }

        .mta-btns {
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:8px;
            margin-top: 12px;
        }

        .mta-btns.single {
            grid-template-columns:1fr;
        }

        .mta-menu-footer .mta-btns {
            margin-top: 0;
        }

        .mta-btn {
            border:1px solid var(--mta-border);
            border-radius:10px;
            min-height:42px;
            font-weight:700;
            font-size:13px;
            cursor:pointer;
            color:var(--mta-button-text);
            text-shadow:
                0 1px 0 rgba(0,0,0,0.9),
                0 0 5px rgba(0,0,0,0.62);
            box-shadow:
                inset 0 1px 0 var(--mta-ui-light-strong),
                inset 0 -4px 0 rgba(0,0,0,0.34),
                inset 0 0 0 1px rgba(0,0,0,0.22),
                0 2px 0 var(--mta-ui-button-shadow),
                0 8px 16px rgba(0,0,0,0.34);
            transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
        }

        .mta-btn-inner {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
        }

        .mta-btn-glyph {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 14px;
            height: 14px;
            flex: 0 0 auto;
        }

        .mta-btn-glyph svg {
            display: block;
            width: 14px;
            height: 14px;
            fill: currentColor;
        }

        .mta-btn.primary {
            background: linear-gradient(180deg, var(--mta-button-bg), var(--mta-button-bg-bottom));
        }

        .mta-btn.dark {
            background: linear-gradient(180deg, var(--mta-button-bg), var(--mta-button-bg-bottom));
        }

        .mta-btn.ok {
            background: linear-gradient(180deg, var(--mta-button-bg), var(--mta-button-bg-bottom));
        }

        .mta-btn:hover {
            filter: brightness(1.08);
            box-shadow:
                inset 0 1px 0 var(--mta-ui-light-strong),
                inset 0 -4px 0 rgba(0,0,0,0.32),
                inset 0 0 0 1px var(--mta-border),
                0 2px 0 var(--mta-ui-button-shadow),
                0 0 0 1px var(--mta-ui-accent-soft),
                0 0 12px var(--mta-ui-accent-strong),
                0 10px 18px rgba(0,0,0,0.38);
        }

        .mta-btn:active {
            transform: translateY(2px);
            box-shadow:
                inset 0 3px 8px rgba(0,0,0,0.44),
                inset 0 0 0 1px rgba(0,0,0,0.26),
                0 1px 0 var(--mta-ui-button-shadow),
                0 4px 10px rgba(0,0,0,0.28);
        }

        .mta-note {
            margin-top: 10px;
            font-size: 11px;
            line-height: 1.4;
            color: var(--mta-title-text);
            background: linear-gradient(180deg, var(--mta-bg-soft), var(--mta-bg-deep));
            border: 1px solid var(--mta-border-soft);
            border-radius: 10px;
            padding: 8px 10px;
        }

        #mta-toast-host {
            --mta-bg: #333333;
            --mta-bg-soft: #515151;
            --mta-bg-deep: #2b2b2b;
            --mta-title-text: #ffffff;
            --mta-hot-text: #ffffff;
            --mta-border: #a33431;
            --mta-border-soft: #7a2220;
            --mta-button-bg: #87110f;
            --mta-button-bg-bottom: #5f0c0b;
            --mta-button-text: #ffffff;
            position: fixed;
            left: 8px;
            top: 52px;
            bottom: auto;
            z-index: 1000001;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            width: max-content;
            max-width: calc(100vw - 16px);
            text-shadow:
                0 1px 0 rgba(0,0,0,0.9),
                0 0 5px rgba(0,0,0,0.62);
        }

        .mta-toast {
            background:linear-gradient(180deg, var(--mta-bg-soft), var(--mta-bg));
            color:var(--mta-title-text);
            border-left:4px solid var(--mta-border);
            border-radius:8px;
            padding:10px 12px;
            margin-top:8px;
            box-shadow:0 4px 14px rgba(0,0,0,.38);
            transition:opacity .3s ease;
            font-size:13px;
            display: inline-block;
            width: fit-content;
            max-width: min(480px, calc(100vw - 16px));
            white-space: normal;
        }

        .mta-toast.warn {
            border-left-color:var(--mta-hot-text);
        }

        #mta-root.mta-touch #mta-menu {
            width: min(380px, calc(100vw - 10px));
            max-height: calc(100vh - 76px);
        }

        #mta-root.mta-touch .mta-body {
            padding: 12px 14px 14px;
        }

        #mta-root.mta-touch .mta-menu-pinned,
        #mta-root.mta-touch .mta-menu-footer {
            padding: 12px 14px 14px;
        }

        #mta-root.mta-touch .mta-grid2,
        #mta-root.mta-touch .mta-check-wrap,
        #mta-root.mta-touch .mta-cats {
            grid-template-columns: 1fr;
            gap: 10px;
        }

        #mta-root.mta-touch #mta-chip {
            width: fit-content;
            max-width: calc(100vw - 8px);
            grid-template-columns: auto 24px 22px auto auto auto;
            padding: 6px 7px 7px;
            column-gap: 5px;
        }

        #mta-root.mta-touch #mta-label,
        #mta-root.mta-touch #mta-destination-code,
        #mta-root.mta-touch #mta-countdown,
        #mta-root.mta-touch #mta-eta {
            min-width: 0;
            font-size: 11px;
        }

        #mta-root.mta-touch .mta-history-list {
            max-height: none;
        }

        #mta-root.mta-touch .mta-settings-hotkey {
            border-left: 0;
            padding-left: 0;
        }

        #mta-root.mta-touch .mta-desktop-only {
            display: none !important;
        }

        #mta-root.mta-touch #mta-menu select,
        #mta-root.mta-touch #mta-menu input[type="number"],
        #mta-root.mta-touch #mta-menu input[type="text"] {
            min-height: 46px;
            font-size: 16px;
            padding: 11px 42px 11px 14px;
        }

        #mta-root.mta-touch .mta-select-button {
            min-height: 46px;
            font-size: 16px;
            padding: 11px 14px;
        }

        #mta-root.mta-touch .mta-select-option {
            min-height: 38px;
            font-size: 14px;
            padding: 9px 10px;
        }

        #mta-root.mta-touch .mta-country-row {
            grid-template-columns: 46px 1fr;
        }

        #mta-root.mta-touch .mta-country-badge {
            width: 46px;
            min-height: 46px;
        }

        #mta-root.mta-touch .mta-country-badge .mta-flag-badge {
            width: 36px;
            height: 24px;
        }

        #mta-root.mta-touch .mta-check {
            min-height: 42px;
            padding: 9px 10px;
            font-size: 13px;
        }

        #mta-root.mta-touch .mta-switch-row {
            min-height: 42px;
            font-size: 13px;
        }

        #mta-root.mta-touch .mta-switch {
            width: 48px;
            height: 28px;
        }

        #mta-root.mta-touch .mta-switch-slider::before {
            width: 22px;
            height: 22px;
        }

        #mta-root.mta-touch .mta-switch input:checked + .mta-switch-slider::before {
            transform: translateX(20px);
        }

        #mta-root.mta-touch .mta-theme-grid {
            grid-template-columns: 1fr;
        }

        #mta-root.mta-touch .mta-panel-head {
            align-items: flex-start;
            flex-direction: column;
        }

        #mta-root.mta-touch .mta-panel-filter {
            width: 100%;
            min-width: 0;
            max-width: none;
        }

        #mta-root.mta-touch .mta-theme-tools {
            width: 100%;
        }

        #mta-root.mta-touch .mta-theme-reset {
            width: 100%;
            min-height: 38px;
            font-size: 12px;
        }

        #mta-root.mta-touch .mta-color-field {
            min-height: 82px;
        }

        #mta-root.mta-touch .mta-color-controls {
            grid-template-columns: 40px minmax(0, 1fr);
        }

        #mta-root.mta-touch .mta-alpha-wrap {
            min-width: 0;
        }

        #mta-root.mta-touch .mta-color-picker {
            width: 40px;
            height: 28px;
        }

        #mta-root.mta-touch .mta-label2,
        #mta-root.mta-touch .mta-note,
        #mta-root.mta-touch .mta-info {
            font-size: 13px;
        }

        #mta-root.mta-touch .mta-btn {
            min-height: 48px;
            font-size: 14px;
        }
    `);

    let isListening = false;
    let pressTimer = null;
    let longPressed = false;
    let drag = null;
    let categoryDrag = null;
    let menuDrag = null;
    let menuPosition = null;
    let suppressLabelClickUntil = 0;
    let activePlanePointerId = null;
    let customSelectEventsBound = false;
    let activeCustomSelect = null;
    let quickActionInFlight = false;
    let nextQuickActionAt = 0;

    function prefersTouchLayout() {
        try {
            return window.matchMedia('(pointer: coarse)').matches
                || window.matchMedia('(hover: none)').matches
                || navigator.maxTouchPoints > 0;
        } catch {
            return navigator.maxTouchPoints > 0;
        }
    }

    function applyLayoutMode() {
        const root = document.getElementById('mta-root');
        if (!root) return;
        root.classList.toggle('mta-touch', prefersTouchLayout());
    }

    function closeCustomSelects(except = null) {
        document.querySelectorAll('#mta-root .mta-select.open').forEach(wrapper => {
            if (wrapper === except) return;
            wrapper.classList.remove('open');
            getCustomSelectButton(wrapper)?.setAttribute('aria-expanded', 'false');
            dockCustomSelectList(wrapper);
        });
        if (!except) activeCustomSelect = null;
    }

    function getCustomSelectWrapper(select) {
        return select?.closest?.('.mta-select') || null;
    }

    function getCustomSelectButton(wrapper) {
        return wrapper?._mtaSelectButton || wrapper?.querySelector?.('.mta-select-button') || null;
    }

    function getCustomSelectValue(wrapper) {
        return wrapper?._mtaSelectValue || wrapper?.querySelector?.('.mta-select-value') || null;
    }

    function getCustomSelectList(wrapper) {
        return wrapper?._mtaSelectList || wrapper?.querySelector?.('.mta-select-list') || null;
    }

    function getCustomSelectLayer() {
        const root = document.getElementById('mta-root');
        if (!root) return null;

        let layer = root.querySelector('#mta-select-layer');
        if (layer) return layer;

        layer = document.createElement('div');
        layer.id = 'mta-select-layer';
        root.appendChild(layer);
        return layer;
    }

    function dockCustomSelectList(wrapper) {
        const list = getCustomSelectList(wrapper);
        if (!wrapper || !list) return;

        if (list.parentElement !== wrapper) wrapper.appendChild(list);
        list.style.display = '';
        list.style.position = '';
        list.style.left = '';
        list.style.top = '';
        list.style.right = '';
        list.style.bottom = '';
        list.style.width = '';
        list.style.minWidth = '';
        list.style.maxHeight = '';
        list.style.visibility = '';
    }

    function positionCustomSelectList(wrapper) {
        const button = getCustomSelectButton(wrapper);
        const list = getCustomSelectList(wrapper);
        const layer = getCustomSelectLayer();
        if (!wrapper || !button || !list || !layer) return;

        if (list.parentElement !== layer) layer.appendChild(list);

        const rect = button.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const margin = 8;
        const gap = 5;

        list.style.display = 'grid';
        list.style.position = 'fixed';
        list.style.visibility = 'hidden';
        list.style.left = '0';
        list.style.top = '0';
        list.style.bottom = 'auto';
        list.style.right = 'auto';
        list.style.width = `${Math.max(140, Math.round(rect.width))}px`;
        list.style.minWidth = `${Math.max(140, Math.round(rect.width))}px`;

        const measuredHeight = Math.ceil(list.getBoundingClientRect().height || list.scrollHeight || 0);
        const belowSpace = Math.max(0, viewportHeight - rect.bottom - margin);
        const aboveSpace = Math.max(0, rect.top - margin);
        const openUpward = belowSpace < Math.min(160, measuredHeight) && aboveSpace > belowSpace;
        const maxHeight = Math.max(90, Math.min(190, openUpward ? aboveSpace - gap : belowSpace - gap));
        list.style.maxHeight = `${maxHeight}px`;

        const finalHeight = Math.min(measuredHeight || maxHeight, maxHeight);
        let top = openUpward
            ? rect.top - finalHeight - gap
            : rect.bottom + gap;
        top = Math.max(margin, Math.min(top, viewportHeight - finalHeight - margin));

        const width = Math.ceil(list.getBoundingClientRect().width || rect.width || 140);
        let left = rect.left;
        left = Math.max(margin, Math.min(left, viewportWidth - width - margin));

        list.style.left = `${Math.round(left)}px`;
        list.style.top = `${Math.round(top)}px`;
        list.style.visibility = '';
    }

    function syncCustomSelect(select) {
        const wrapper = getCustomSelectWrapper(select);
        if (!select || !wrapper) return;

        const valueEl = getCustomSelectValue(wrapper);
        const button = getCustomSelectButton(wrapper);
        const list = getCustomSelectList(wrapper);
        if (!valueEl || !button || !list) return;

        const selected = select.selectedOptions?.[0] || select.options?.[select.selectedIndex] || select.options?.[0] || null;
        valueEl.textContent = selected ? selected.textContent : 'Select';
        button.disabled = select.disabled || !select.options.length;
        button.setAttribute('aria-expanded', wrapper.classList.contains('open') ? 'true' : 'false');
        list.innerHTML = '';

        Array.from(select.options).forEach(option => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'mta-select-option';
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', option.selected ? 'true' : 'false');
            if (option.disabled) item.setAttribute('aria-disabled', 'true');
            item.dataset.value = option.value;
            item.textContent = option.textContent;

            item.addEventListener('click', e => {
                e.preventDefault();
                if (option.disabled) return;
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                closeCustomSelects();
                syncCustomSelect(select);
                button.focus({ preventScroll: true });
            });

            item.addEventListener('keydown', e => {
                const options = Array.from(list.querySelectorAll('.mta-select-option:not([aria-disabled="true"])'));
                const index = options.indexOf(item);
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeCustomSelects();
                    button.focus({ preventScroll: true });
                    return;
                }
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const direction = e.key === 'ArrowDown' ? 1 : -1;
                    const next = options[(index + direction + options.length) % options.length];
                    next?.focus({ preventScroll: true });
                }
            });

            list.appendChild(item);
        });

        if (wrapper.classList.contains('open')) positionCustomSelectList(wrapper);
    }

    function openCustomSelect(select) {
        const wrapper = getCustomSelectWrapper(select);
        if (!select || !wrapper) return;
        const isOpen = wrapper.classList.contains('open');
        if (isOpen) {
            closeCustomSelects();
            return;
        }

        closeCustomSelects();
        wrapper.classList.add('open');
        getCustomSelectButton(wrapper)?.setAttribute('aria-expanded', 'true');
        activeCustomSelect = wrapper;
        syncCustomSelect(select);
        positionCustomSelectList(wrapper);

        requestAnimationFrame(() => {
            positionCustomSelectList(wrapper);
            const list = getCustomSelectList(wrapper);
            const selected = list?.querySelector('.mta-select-option[aria-selected="true"]')
                || list?.querySelector('.mta-select-option:not([aria-disabled="true"])');
            selected?.scrollIntoView({ block: 'nearest' });
        });
    }

    function enhanceCustomSelect(select) {
        if (!select || getCustomSelectWrapper(select)) {
            syncCustomSelect(select);
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'mta-select';
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);

        select.classList.add('mta-native-select');

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mta-select-button';
        button.setAttribute('aria-haspopup', 'listbox');
        button.setAttribute('aria-expanded', 'false');
        button.innerHTML = '<span class="mta-select-value"></span><span class="mta-select-chevron" aria-hidden="true"></span>';

        const list = document.createElement('div');
        list.className = 'mta-select-list';
        list.setAttribute('role', 'listbox');

        wrapper._mtaNativeSelect = select;
        wrapper._mtaSelectButton = button;
        wrapper._mtaSelectValue = button.querySelector('.mta-select-value');
        wrapper._mtaSelectList = list;

        wrapper.appendChild(button);
        wrapper.appendChild(list);

        button.addEventListener('click', e => {
            e.preventDefault();
            openCustomSelect(select);
        });

        button.addEventListener('keydown', e => {
            if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            openCustomSelect(select);
            requestAnimationFrame(() => {
                const list = getCustomSelectList(wrapper);
                const selected = list?.querySelector('.mta-select-option[aria-selected="true"]')
                    || list?.querySelector('.mta-select-option:not([aria-disabled="true"])');
                selected?.focus({ preventScroll: true });
            });
        });

        select.addEventListener('change', () => syncCustomSelect(select));
        syncCustomSelect(select);
    }

    function enhanceSelectControls(root = document) {
        root.querySelectorAll?.('#mta-country, #mta-item, #mta-Secondary, #mta-travel-mode, #mta-purchase-filter')
            .forEach(select => enhanceCustomSelect(select));

        if (customSelectEventsBound) return;
        customSelectEventsBound = true;
        document.addEventListener('click', e => {
            if (e.target?.closest?.('#mta-root .mta-select, #mta-select-layer')) return;
            closeCustomSelects();
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') closeCustomSelects();
        });
        document.addEventListener('scroll', () => {
            if (activeCustomSelect?.classList.contains('open')) {
                positionCustomSelectList(activeCustomSelect);
            }
        }, true);
    }

    function mountAssistantUi() {
        let root = document.getElementById('mta-root');
        if (root) {
            if (root.querySelector('#mta-travel-mode')
                && root.querySelector('#mta-forum-like')
                && root.querySelector('.mta-menu-top')
                && root.querySelector('#mta-countdown')
                && root.querySelector('#mta-show-countdown')
                && root.querySelector('#mta-theme-text')) {
                enhanceSelectControls(root);
                applyThemeSettings();
                return root;
            }
            root.remove();
            root = null;
        }

        root = document.createElement('div');
        root.id = 'mta-root';
        root.innerHTML = `
            <div id="mta-chip">
                <div id="mta-label">
                    <span class="flag-badge-wrap">${renderFlagBadge('uk', 'United Kingdom')}</span>
                    <span class="code">UK</span>
                </div>
                <button id="mta-plane" type="button" aria-label="Travel" title="Tap to advance, hold for settings">${renderPlaneIcon(false)}</button>
                <div id="mta-destination-flag" aria-hidden="true"></div>
                <div id="mta-destination-code" aria-hidden="true">---</div>
                <div id="mta-countdown" title="Remaining flight time">--:--:--</div>
                <div id="mta-eta" title="ETA">--:--</div>
                <div id="mta-progress" aria-hidden="true"><div id="mta-progress-fill"></div></div>
            </div>

            <div id="mta-menu" class="hidden">
                <div class="mta-menu-top">
                    <div class="mta-head" id="mta-drag-head">
                        <div><div class="mta-title">MoDuL's Smuggler</div></div>
                        <div class="mta-drag-glyph">☰</div>
                    </div>

                    <div class="mta-menu-pinned">
                        <div class="mta-label2">Country</div>
                        <div class="mta-country-row">
                            <div id="mta-country-badge" class="mta-country-badge" aria-hidden="true">»</div>
                            <select id="mta-country"></select>
                        </div>
                    </div>
                </div>

                <div class="mta-body">
                    <div class="mta-row">
                        <details class="mta-panel-card mta-collapsible" id="mta-instructions-panel" ${getInstructionsOpen() ? 'open' : ''}>
                            <summary class="mta-collapse-head">
                                <span class="mta-label2">Instructions</span>
                                <span class="mta-collapse-glyph" aria-hidden="true"></span>
                            </summary>
                            <div class="mta-collapse-body">
                                Tap the plane to advance one step. Hold the plane to open settings. Each tap only performs one Torn page action. The "Like this script!" button opens the Smuggler release thread and presses Torn's Like button on the next press when it is available.
                            </div>
                        </details>
                    </div>

                    <div class="mta-row">
                        <div class="mta-info" id="mta-info"></div>
                    </div>

                    <div class="mta-row">
                        <div class="mta-label2">Categories (drag to prioritise)</div>
                        <div class="mta-cats">
                            ${DEFAULT_CATEGORIES.map(category => `
                                <label class="mta-check mta-cat-item" data-cat="${category}">
                                    <span class="mta-cat-handle" title="Drag to reorder" aria-hidden="true">⋮⋮</span>
                                    <input type="checkbox" value="${category}">
                                    <span class="mta-cat-text">${CATEGORY_LABELS[category]}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div class="mta-row">
                        <div class="mta-label2">Primary Item</div>
                        <select id="mta-item"></select>
                    </div>

                    <div class="mta-row">
                        <div class="mta-label2">Secondary Item</div>
                        <select id="mta-Secondary"></select>
                    </div>

                    <div class="mta-row mta-grid2 mta-settings-grid">
                        <div class="mta-settings-left">
                            <div class="mta-label2">Capacity</div>
                            <input id="mta-capacity" type="number" min="1" step="1" inputmode="numeric" pattern="[0-9]*">
                            <div class="mta-sub-row">
                                <div class="mta-label2">Flight time</div>
                                <select id="mta-travel-mode">
                                    <option value="standard">Standard</option>
                                    <option value="airstrip">Airstrip</option>
                                    <option value="wlt">WLT</option>
                                    <option value="business">Business</option>
                                </select>
                            </div>
                            <label class="mta-check mta-book-check"><input type="checkbox" id="mta-book"> Book read</label>
                        </div>
                        <div class="mta-desktop-only mta-settings-hotkey">
                            <div class="mta-label2">Hotkey (desktop)</div>
                            <div class="mta-hotkey-wrap">
                                <div id="mta-keybind" class="mta-key">Set Hotkey</div>
                                <div class="mta-check-wrap">
                                    <label class="mta-check"><input type="checkbox" id="mta-key-ctrl"> Ctrl</label>
                                    <label class="mta-check"><input type="checkbox" id="mta-key-alt"> Alt</label>
                                    <label class="mta-check"><input type="checkbox" id="mta-key-shift"> Shift</label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mta-row mta-grid3 mta-settings-grid mta-collapsible">
                        <div class="mta-panel-card">
                            <div class="mta-label3">Display settings</div>
                            <div class="mta-switch-stack">
                                <label class="mta-switch-row" for="mta-show-flags">
                                    <span class="mta-switch-label">Show Flags</span>
                                    <span class="mta-switch">
                                        <input type="checkbox" id="mta-show-flags">
                                        <span class="mta-switch-slider" aria-hidden="true"></span>
                                    </span>
                                </label>
                                <label class="mta-switch-row" for="mta-show-cc">
                                    <span class="mta-switch-label">Show country codes</span>
                                    <span class="mta-switch">
                                        <input type="checkbox" id="mta-show-cc">
                                        <span class="mta-switch-slider" aria-hidden="true"></span>
                                    </span>
                                </label>
                            </div>
                            <div class="mta-switch-stack">
                                <label class="mta-switch-row" for="mta-show-countdown">
                                    <span class="mta-switch-label">Show countdown</span>
                                    <span class="mta-switch">
                                        <input type="checkbox" id="mta-show-countdown">
                                        <span class="mta-switch-slider" aria-hidden="true"></span>
                                    </span>
                                </label>
                                <label class="mta-switch-row" for="mta-show-eta">
                                    <span class="mta-switch-label">Show ETA</span>
                                    <span class="mta-switch">
                                        <input type="checkbox" id="mta-show-eta">
                                        <span class="mta-switch-slider" aria-hidden="true"></span>
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="mta-row mta-grid3 mta-stats-grid">
                        <div class="mta-panel-card">
                            <div class="mta-panel-head">
                                <div class="mta-label3">Flights</div>
                            </div>
                            <div class="mta-history-list" id="mta-flights-list"></div>
                        </div>
                    </div>
                    <div class="mta-row mta-grid3 mta-stats-grid">
                        <div class="mta-panel-card">
                            <div class="mta-panel-head">
                                <div class="mta-label3">Purchases</div>
                                <div class="mta-panel-filter">
                                    <select id="mta-purchase-filter">
                                        ${PURCHASE_FILTER_OPTIONS.map(option => `
                                            <option value="${option.value}" ${option.value === getPurchaseFilter() ? 'selected' : ''}>${option.label}</option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="mta-history-list" id="mta-purchases-list"></div>
                        </div>
                    </div>

                    <div class="mta-row">
                        <div class="mta-panel-card">
                            <div class="mta-panel-head">
                                <div class="mta-label2">Theme editor</div>
                                <div class="mta-theme-tools">
                                    <button id="mta-theme-reset" class="mta-theme-reset" type="button" title="Reset the Smuggler theme">
                                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6a6 6 0 0 1-10.24 4.24l-1.42 1.42A8 8 0 1 0 12 5z"/>
                                        </svg>
                                        <span>Reset theme</span>
                                    </button>
                                </div>
                            </div>
                            <div class="mta-theme-grid">
                                ${THEME_PICKERS.map(picker => `
                                    <label class="mta-color-field" for="${picker.id}">
                                        <span class="mta-color-label">${picker.label}</span>
                                        <span class="mta-color-controls">
                                            <input class="mta-color-picker" type="color" id="${picker.id}" value="${DEFAULT_THEME[picker.key]}">
                                            <span class="mta-alpha-wrap">
                                                <input class="mta-alpha-slider" type="range" id="${getThemeAlphaInputId(picker)}" min="0" max="100" step="1" value="${DEFAULT_THEME[picker.alphaKey]}">
                                                <span class="mta-alpha-value" id="${getThemeAlphaValueId(picker)}">${DEFAULT_THEME[picker.alphaKey]}%</span>
                                            </span>
                                        </span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mta-menu-footer">
                    <div class="mta-btns">
                        <button id="mta-forum-like" class="mta-btn dark" type="button" title="If you really, really do.">
                            <span class="mta-btn-inner">
                                <span class="mta-btn-glyph" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M2 21h4V9H2zm20-11c0-1.1-.9-2-2-2h-6.3l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13 1 6.59 7.41C6.22 7.78 6 8.3 6 8.83V19c0 1.1.9 2 2 2h9c.82 0 1.52-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73z"/>
                                    </svg>
                                </span>
                                <span>Like this script!</span>
                            </span>
                        </button>
                        <button id="mta-save" class="mta-btn dark" type="button">
                            <span class="mta-btn-inner">
                                <span class="mta-btn-glyph" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6m3-10H5V5h10z"/>
                                    </svg>
                                </span>
                                <span>Save</span>
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(root);
        applyThemeSettings();
        enhanceSelectControls(root);
        applyLayoutMode();
        restorePosition();
        bindUiEvents();
        updateUi();
        return root;
    }

    function updateCountryBadge(countryKey = getSelectedCountryKey()) {
        const badge = document.getElementById('mta-country-badge');
        if (!badge) return;

        const currentCountry = COUNTRY_DATA[countryKey] || null;
        badge.innerHTML = currentCountry ? renderFlagBadge(countryKey, currentCountry.name) : '&raquo;';
    }

    function updateCountrySelect() {
        const sel = document.getElementById('mta-country');
        if (!sel) return;
        const current = getSelectedCountryKey();

        sel.innerHTML = COUNTRY_ORDER.map(key => {
            const c = COUNTRY_DATA[key];
            return `<option value="${key}" ${key === current ? 'selected' : ''}>${c.name}</option>`;
        }).join('');
        syncCustomSelect(sel);
        updateCountryBadge(current);
    }

    function updateCategoryChecks() {
        const selected = new Set(getSelectedCategories());
        const order = getCategoryOrder();
        const available = new Set(getAvailableCategories());
        const wrap = document.querySelector('.mta-cats');
        if (wrap) {
            const labelsByCategory = new Map(
                Array.from(wrap.querySelectorAll('.mta-cat-item')).map(label => [label.getAttribute('data-cat'), label])
            );
            for (const category of order) {
                const label = labelsByCategory.get(category);
                if (label) wrap.appendChild(label);
            }

            for (const category of order) {
                const label = labelsByCategory.get(category);
                if (!label) continue;
                label.hidden = !available.has(category);
            }
        }

        document.querySelectorAll('.mta-cats input[type="checkbox"]').forEach(cb => {
            cb.checked = selected.has(cb.value);
        });
    }

    function getCategoryOrderFromDom() {
        const order = Array.from(document.querySelectorAll('.mta-cats .mta-cat-item'))
            .map(label => label.getAttribute('data-cat'))
            .filter(Boolean);
        return normalizeCategoryOrder(order);
    }

    function getCheckedCategoriesFromDom() {
        const checked = new Set(
            Array.from(document.querySelectorAll('.mta-cats input[type="checkbox"]:checked')).map(cb => cb.value)
        );
        const orderedChecked = getCategoryOrderFromDom().filter(category => checked.has(category));
        return orderedChecked;
    }

    function saveCategoryStateFromDom() {
        setCategoryOrder(getCategoryOrderFromDom());
        setSelectedCategories(getCheckedCategoriesFromDom());
    }

    function updateItemSelect({ useSavedPrimary = true } = {}) {
        const sel = document.getElementById('mta-item');
        if (!sel) return '';

        const items = getCurrentFilteredItems();
        const saved = useSavedPrimary ? getSelectedItemName() : '';
        const hasSaved = items.some(i => i.name === saved);
        const chosen = hasSaved ? saved : (items[0] ? items[0].name : '');

        setSelectedItemName(chosen);

        sel.innerHTML = items.map(item => {
            const suffix = item.price === 0 ? ' — price?' : ` — ${formatMoney(item.price)}`;
            return `<option value="${item.name}" ${item.name === chosen ? 'selected' : ''}>${item.name}${suffix}</option>`;
        }).join('');

        if (!items.length) {
            setSelectedItemName('');
            sel.innerHTML = `<option value="">No matching items</option>`;
        }
        syncCustomSelect(sel);

        return chosen;
    }

    function updateSecondarySelect(primaryName = getSelectedItemName(), { useSavedSecondary = true } = {}) {
        const sel = document.getElementById('mta-Secondary');
        if (!sel) return '';

        const items = getCurrentFilteredItems();
        const validItems = items.filter(item => item.name !== primaryName);
        const saved = useSavedSecondary ? getSecondaryItemName() : '';
        const hasSaved = validItems.some(item => item.name === saved);
        const chosen = hasSaved ? saved : getDefaultSecondaryName(items, primaryName);

        setSecondaryItemName(chosen);

        sel.innerHTML = `<option value="">None</option>` + validItems.map(item => {
            const suffix = item.price === 0 ? ' — price?' : ` — ${formatMoney(item.price)}`;
            return `<option value="${item.name}" ${item.name === chosen ? 'selected' : ''}>${item.name}${suffix}</option>`;
        }).join('');
        syncCustomSelect(sel);

        return chosen;
    }

    function refreshItemChoices(options = {}) {
        const primaryName = updateItemSelect({ useSavedPrimary: options.useSavedPrimary !== false });
        updateSecondarySelect(primaryName, { useSavedSecondary: options.useSavedSecondary !== false });
        return primaryName;
    }

    function updateTravelChecks() {
        const mode = getTravelMode();
        const book = getBookRead();
        const modeSelect = document.getElementById('mta-travel-mode');
        if (modeSelect) {
            modeSelect.value = mode;
            syncCustomSelect(modeSelect);
        }

        const bookCb = document.getElementById('mta-book');
        if (bookCb) bookCb.checked = book;
    }

    function positionMenu() {
        const chip = document.getElementById('mta-chip');
        const menu = document.getElementById('mta-menu');
        if (!chip || !menu || menu.classList.contains('hidden')) return;

        if (menuPosition) {
            const p = clampMenuPosition(menuPosition.x, menuPosition.y);
            menuPosition = p;
            applyMenuPosition(p.x, p.y);
            return;
        }

        const chipRect = chip.getBoundingClientRect();
        const desiredLeft = chipRect.left + (chipRect.width / 2) - (menu.offsetWidth / 2);
        const minLeft = 6;
        const maxLeft = window.innerWidth - menu.offsetWidth - 6;
        const left = Math.max(minLeft, Math.min(desiredLeft, maxLeft));

        const minTop = 6;
        const maxTop = Math.max(minTop, window.innerHeight - menu.offsetHeight - MENU_BOTTOM_GAP);
        let top = chipRect.bottom + 6;
        if (top > maxTop) top = maxTop;

        menu.style.left = `${Math.round(left)}px`;
        menu.style.top = `${Math.round(top)}px`;
        menu.style.transform = 'none';
    }

    function updateHeaderChip() {
        const root = document.getElementById('mta-root');
        const planeBtn = document.getElementById('mta-plane');
        const label = document.getElementById('mta-label');
        const destinationFlag = document.getElementById('mta-destination-flag');
        const destinationCodeEl = document.getElementById('mta-destination-code');
        const countdownEl = document.getElementById('mta-countdown');
        const etaEl = document.getElementById('mta-eta');
        const progressEl = document.getElementById('mta-progress');
        const progressFillEl = document.getElementById('mta-progress-fill');
        const menu = document.getElementById('mta-menu');
        if (!label || !planeBtn || !destinationFlag || !destinationCodeEl || !countdownEl || !root || !etaEl || !menu || !progressEl || !progressFillEl) return;

        const ctx = buildTravelDisplay();
        const eta = buildEtaInfo();
        const showCountdown = getShowCountdown() && !!ctx.traveling && !!eta.chipCountdown;
        const showEta = getShowEta() && !!eta.chipEta;
        const progressPercent = getFlightProgressPercent();
        const progressTitle = formatProgressPercent(progressPercent);
        const showFlags = getShowFlags();
        const showCountryCodes = getShowCountryCodes();
        const blocker = getIconBlockerStatus();
        const planeDisabled = !!blocker && !ctx.traveling;
        syncPlaneButtonIcon(planeBtn, planeDisabled);
        const planeSvg = planeBtn.querySelector('svg');
        if (!planeSvg) return;

        const labelBadge = showFlags ? renderFlagBadge(ctx.currentLabelKey, ctx.currentLabelCode) : '';
        const destinationBadge = showFlags && ctx.toKey ? renderFlagBadge(ctx.toKey, ctx.toText) : '';
        const destinationCode = showCountryCodes && ctx.toKey ? (ctx.toKey === 'torn' ? 'TC' : (COUNTRY_DATA[ctx.toKey]?.code || '')) : '';
        const labelCode = showCountryCodes ? ctx.currentLabelCode : '';
        label.classList.toggle('is-torn', ctx.currentLabelKey === 'torn');
        const labelMarkup = `<span class="flag-badge-wrap">${labelBadge}</span>${labelCode ? `<span class="code">${labelCode}</span>` : ''}`;
        if (label.innerHTML !== labelMarkup) {
            label.innerHTML = labelMarkup;
        }

        countdownEl.textContent = eta.chipCountdown || '--:--:--';
        countdownEl.classList.toggle('visible', showCountdown);
        etaEl.textContent = eta.chipEta || '--:--';
        etaEl.classList.toggle('hidden', !showEta);
        const nextDestinationBadge = destinationBadge || '';
        if (destinationFlag.innerHTML !== nextDestinationBadge) {
            destinationFlag.innerHTML = nextDestinationBadge;
        }
        destinationFlag.style.display = destinationBadge ? 'inline-flex' : 'none';
        destinationCodeEl.textContent = destinationCode || '---';
        destinationCodeEl.style.display = destinationCode ? 'inline-flex' : 'none';
        progressFillEl.style.width = `${Math.max(0, Math.min(100, Number(progressPercent || 0)))}%`;
        progressEl.classList.toggle('visible', !!ctx.traveling && Number.isFinite(progressPercent));
        progressEl.title = progressTitle || '';
        progressEl.setAttribute('aria-label', progressTitle || 'Flight progress');
        planeSvg.style.fill = 'var(--mta-button-text)';
        planeBtn.disabled = planeDisabled;
        planeBtn.title = planeDisabled
            ? `Blocked: ${blocker}`
            : 'Tap to advance, hold for settings';
        planeBtn.setAttribute('aria-disabled', planeDisabled ? 'true' : 'false');

        if (ctx.traveling) {
            planeSvg.style.transform = 'rotate(90deg)';
        } else if (ctx.abroad) {
            planeSvg.style.transform = 'rotate(90deg)';
        } else {
            planeSvg.style.transform = 'rotate(0deg)';
        }

        root.classList.toggle('minimized', getMinimized());
        menu.classList.toggle('hidden', getMinimized());

        if (!getMinimized()) positionMenu();
    }

    function updateSavedControls() {
        const cap = document.getElementById('mta-capacity');
        const kb = document.getElementById('mta-keybind');
        const keyCtrl = document.getElementById('mta-key-ctrl');
        const keyAlt = document.getElementById('mta-key-alt');
        const keyShift = document.getElementById('mta-key-shift');
        const modeSelect = document.getElementById('mta-travel-mode');
        const showFlags = document.getElementById('mta-show-flags');
        const showCountryCodes = document.getElementById('mta-show-cc');
        const showCountdown = document.getElementById('mta-show-countdown');
        const showEta = document.getElementById('mta-show-eta');
        const hotkey = getSavedHotkeyConfig();

        if (cap) cap.value = getCapacity();
        if (modeSelect) {
            modeSelect.value = getTravelMode();
            syncCustomSelect(modeSelect);
        }
        if (kb) kb.textContent = formatHotkeyDisplay(hotkey);
        if (keyCtrl) keyCtrl.checked = hotkey.ctrl;
        if (keyAlt) keyAlt.checked = hotkey.alt;
        if (keyShift) keyShift.checked = hotkey.shift;
        if (showFlags) showFlags.checked = getShowFlags();
        if (showCountryCodes) showCountryCodes.checked = getShowCountryCodes();
        if (showCountdown) showCountdown.checked = getShowCountdown();
        if (showEta) showEta.checked = getShowEta();
        syncThemeControls();
        applyThemeSettings();
    }

    function updateInfoPanel() {
        rememberCurrentForumPostUrl();

        updateTripPurchaseStatus();
        const countryKey = getSelectedCountryKey();
        const country = COUNTRY_DATA[countryKey];
        const item = getCurrentItem();
        const Secondary = getSecondaryItemName();
        const capacity = getCapacity();
        const funds = getTravelFundsRequirement(countryKey, capacity);
        const req = funds.required;
        const cash = getCash();
        const info = document.getElementById('mta-info');
        const ctx = buildTravelDisplay();
        const eta = buildEtaInfo();
        const liveCapacity = getLiveTravelCapacity();

        if (!info) return;

        const travelCost = getEffectiveTravelCost(countryKey);
        const timeForDisplay = ctx.abroad && ctx.fromKey && ctx.fromKey !== 'torn' ? getTravelTime(ctx.fromKey) : getTravelTime(countryKey);
        const itemPrice = item ? formatMoney(item.price || 0) : '—';
        const itemTotal = item ? Number(item.price || 0) * capacity : 0;
        const priceNote = item && Number(item.price || 0) === 0 ? ' (price placeholder)' : '';
        const SecondaryItem = getCurrentFilteredItems().find(x => x.name === Secondary) || null;
        const SecondaryUnitPrice = SecondaryItem ? Number(SecondaryItem.price || 0) : 0;
        const SecondaryTotal = SecondaryItem ? SecondaryUnitPrice * capacity : 0;
        const SecondaryPriceNote = SecondaryItem && SecondaryUnitPrice === 0 ? ' (price placeholder)' : '';
        const SecondaryText = SecondaryItem
        ? `
        <br>Secondary item: <strong>${SecondaryItem.name}</strong>
        <br>Secondary unit price: <strong>${formatMoney(SecondaryUnitPrice)}</strong>${SecondaryPriceNote}
        <br>Secondary total: <strong>${formatMoney(SecondaryTotal)}</strong>
        `
        : Secondary
        ? `<br>Secondary item: <strong>${Secondary}</strong><br>Secondary total: <strong>—</strong>`
        : '';

        const tripPurchaseLine = ctx.abroad
            ? `<br>Trip purchase: <strong>${hasTripPurchaseDone() ? 'Confirmed' : 'Pending'}</strong>`
            : '';

        const liveCapacityLine = liveCapacity
            ? `<br>Travel inventory: <strong>${liveCapacity.current}/${liveCapacity.max}</strong>`
            : '';

        const roundTripLine = !ctx.traveling && !ctx.abroad
            ? `<br>Round trip time: <strong>${eta.roundTripDurationText}</strong><br>Round trip ETA: <strong>${eta.roundTripText}</strong>`
            : '';

        const remainingLine = ctx.traveling
            ? `<br>Remaining flight time: <strong>${eta.remainingText}</strong>`
            : '';

        info.innerHTML = `
            <strong>${renderFlagBadge(countryKey, country.name)} ${country.name}</strong> (${country.code})<br>
            Route: <strong>${ctx.fromText} → ${ctx.toText}</strong><br>
            City: ${country.city}<br>
            Travel cost: <strong>${formatMoney(travelCost)}</strong><br>
            Travel time: <strong>${travelTimeText(timeForDisplay)}</strong><br>
            ETA arrival: <strong>${eta.arrivalText}</strong>${roundTripLine}${remainingLine}${tripPurchaseLine}${liveCapacityLine}<br>
            <br>Item: <strong>${item ? item.name : 'None'}</strong><br>
            Unit price: <strong>${itemPrice}</strong>${priceNote}<br>
            Item total: <strong>${item ? formatMoney(itemTotal) : '—'}</strong><br>${SecondaryText}<br><br>
            Capacity: <strong>${capacity}</strong><br>
            Required money: <strong>${formatMoney(req)}</strong><br>
            Cash on hand: <strong>${formatMoney(cash)}</strong>
        `;
    }

    function getFilteredPurchaseEntries(filterMode = getPurchaseFilter()) {
        const history = getPurchaseHistory();
        if (filterMode === 'country') {
            const countryKey = getSelectedCountryKey();
            return history.filter(entry => entry.countryKey === countryKey);
        }

        if (filterMode === 'selected') {
            const categories = new Set(getEffectiveSelectedCategories());
            if (!categories.size) return [];
            return history.filter(entry => categories.has(entry.category));
        }

        return history;
    }

    function getAggregatedPurchaseStats(filterMode = getPurchaseFilter()) {
        const grouped = new Map();
        for (const entry of getFilteredPurchaseEntries(filterMode)) {
            const key = normalizeText(entry.itemName);
            const existing = grouped.get(key) || {
                itemName: entry.itemName,
                quantity: 0,
                primaryQty: 0,
                SecondaryQty: 0,
                countries: new Set(),
                recordedAt: 0
            };
            existing.quantity += entry.quantity;
            if (entry.isSecondary) existing.SecondaryQty += entry.quantity;
            else existing.primaryQty += entry.quantity;
            existing.countries.add(entry.countryKey);
            existing.recordedAt = Math.max(existing.recordedAt, entry.recordedAt);
            grouped.set(key, existing);
        }

        return Array.from(grouped.values()).sort((a, b) => {
            if (b.quantity !== a.quantity) return b.quantity - a.quantity;
            if (b.recordedAt !== a.recordedAt) return b.recordedAt - a.recordedAt;
            return a.itemName.localeCompare(b.itemName);
        });
    }

    function buildFlightsPanelMarkup() {
        const counts = getFlightCounts();
        const entries = COUNTRY_ORDER
            .map(key => ({ key, country: COUNTRY_DATA[key], count: Number(counts[key] || 0) }))
            .filter(entry => entry.count > 0)
            .sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count;
                return a.country.name.localeCompare(b.country.name);
            });

        if (!entries.length) {
            return '<div class="mta-empty-state">No outbound flights recorded yet.</div>';
        }

        return entries.map(entry => `
            <div class="mta-history-row">
                <div class="mta-history-main">
                    <span class="mta-history-badge">${renderFlagBadge(entry.key, entry.country.name)}</span>
                </div>
                <div class="mta-history-value">${entry.count}</div>
            </div>
        `).join('');
    }

    function buildPurchasesPanelMarkup(filterMode = getPurchaseFilter()) {
        const entries = getAggregatedPurchaseStats(filterMode);
        if (filterMode === 'selected' && !getEffectiveSelectedCategories().length) {
            return '<div class="mta-empty-state">Select at least one category to filter purchases by category.</div>';
        }

        if (!entries.length) {
            return '<div class="mta-empty-state">No purchases logged for this filter yet.</div>';
        }

        return entries.map(entry => {
            const metaParts = [];
            if (filterMode === 'all') {
                if (entry.countries.size === 1) {
                    const onlyCountryKey = Array.from(entry.countries)[0];
                    const onlyCountry = COUNTRY_DATA[onlyCountryKey];
                    if (onlyCountry) metaParts.push(onlyCountry.name);
                } else if (entry.countries.size > 1) {
                    metaParts.push(`${entry.countries.size} countries`);
                }
            } else if (filterMode === 'country') {
                const country = COUNTRY_DATA[getSelectedCountryKey()];
                if (country) metaParts.push(country.name);
            }

            if (entry.primaryQty > 0 && entry.SecondaryQty > 0) {
                metaParts.push(`Primary ${entry.primaryQty} · Secondary ${entry.SecondaryQty}`);
            } else if (entry.SecondaryQty > 0) {
                metaParts.push('Secondary');
            } else {
                metaParts.push('Primary');
            }

            return `
                <div class="mta-history-row">
                    <div class="mta-history-main">
                        <span class="mta-history-text">${escapeHtml(entry.itemName)}</span>
                        <span class="mta-history-meta">${escapeHtml(metaParts.join(' · '))}</span>
                    </div>
                    <div class="mta-history-value">x ${entry.quantity}</div>
                </div>
            `;
        }).join('');
    }

    function updateStatsPanels() {
        const flightsEl = document.getElementById('mta-flights-list');
        const purchasesEl = document.getElementById('mta-purchases-list');
        const purchaseFilterSel = document.getElementById('mta-purchase-filter');

        if (purchaseFilterSel) {
            purchaseFilterSel.value = getPurchaseFilter();
            syncCustomSelect(purchaseFilterSel);
        }
        if (flightsEl) flightsEl.innerHTML = buildFlightsPanelMarkup();
        if (purchasesEl) purchasesEl.innerHTML = buildPurchasesPanelMarkup();
    }

    function updateUi() {
        updateCountrySelect();
        updateCategoryChecks();
        refreshItemChoices();
        updateTravelChecks();
        updateSavedControls();
        updateHeaderChip();
        updateInfoPanel();
        updateStatsPanels();
    }

    function saveSettingsFromMenu(minimizeAfter = true, announce = true) {
        const countrySel = document.getElementById('mta-country');
        const itemSel = document.getElementById('mta-item');
        const SecondarySel = document.getElementById('mta-Secondary');
        const cap = document.getElementById('mta-capacity');
        const hotkey = readHotkeyConfigFromDom();
        const book = document.getElementById('mta-book')?.checked || false;
        const mode = document.getElementById('mta-travel-mode')?.value || 'standard';
        const showCountdown = document.getElementById('mta-show-countdown')?.checked ?? getShowCountdown();
        const showEta = document.getElementById('mta-show-eta')?.checked ?? getShowEta();
        const theme = readThemeSettingsFromDom();

        if (countrySel) setSelectedCountryKey(countrySel.value);
        saveCategoryStateFromDom();
        if (itemSel) setSelectedItemName(itemSel.value);
        if (SecondarySel) setSecondaryItemName(SecondarySel.value);
        if (cap) setCapacity(cap.value);
        saveHotkeyConfig(hotkey);
        setBookRead(book);
        setTravelMode(mode);
        setShowCountdown(showCountdown);
        setShowEta(showEta);
        saveThemeSettings(theme);
        applyThemeSettings(theme);

        if (minimizeAfter) setMinimized(true);

        updateUi();
        if (announce) showToast('Settings saved.');
    }

    function restorePosition() {
        const root = document.getElementById('mta-root');
        if (!root) return;
        const x = Number(loadSetting(K.posX, NaN));
        const y = Number(loadSetting(K.posY, NaN));
        if (Number.isFinite(x) && Number.isFinite(y)) {
            const p = clampRoot(x, y);
            root.style.left = `${p.x}px`;
            root.style.top = `${p.y}px`;
            root.style.right = 'auto';
            if (p.x !== x || p.y !== y) savePosition(p.x, p.y);
        }
    }

    function savePosition(x, y) {
        saveSetting(K.posX, x);
        saveSetting(K.posY, y);
    }

    function clampRoot(x, y) {
        const chip = document.getElementById('mta-chip');
        if (!chip) return { x, y };

        const w = chip.offsetWidth || 80;
        const h = chip.offsetHeight || 36;
        const maxX = Math.max(4, window.innerWidth - w - 4);
        const maxY = Math.max(4, window.innerHeight - h - 4);

        return {
            x: Math.max(4, Math.min(x, maxX)),
            y: Math.max(4, Math.min(y, maxY))
        };
    }

    function clampMenuPosition(x, y) {
        const menu = document.getElementById('mta-menu');
        if (!menu) return { x, y };

        const maxX = Math.max(6, window.innerWidth - menu.offsetWidth - 6);
        const maxY = Math.max(6, window.innerHeight - menu.offsetHeight - MENU_BOTTOM_GAP);
        return {
            x: Math.max(6, Math.min(x, maxX)),
            y: Math.max(6, Math.min(y, maxY))
        };
    }

    function applyMenuPosition(x, y) {
        const menu = document.getElementById('mta-menu');
        if (!menu) return;
        const p = clampMenuPosition(x, y);
        menu.style.left = `${Math.round(p.x)}px`;
        menu.style.top = `${Math.round(p.y)}px`;
        menu.style.transform = 'none';
    }

    function startDrag(e) {
        const root = document.getElementById('mta-root');
        if (!root) return;
        if (e.button != null && e.button !== 0) return;
        if (e.target?.closest?.('#mta-plane')) return;

        const rect = root.getBoundingClientRect();
        drag = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            dx: e.clientX - rect.left,
            dy: e.clientY - rect.top,
            moved: false
        };

        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
        e.preventDefault();
    }

    function moveDrag(e) {
        if (!drag) return;
        if (drag.pointerId != null && e.pointerId != null && drag.pointerId !== e.pointerId) return;

        const root = document.getElementById('mta-root');
        if (!root) return;

        if (!drag.moved) {
            const movedX = Math.abs(e.clientX - drag.startX);
            const movedY = Math.abs(e.clientY - drag.startY);
            drag.moved = movedX >= DRAG_CLICK_THRESHOLD_PX || movedY >= DRAG_CLICK_THRESHOLD_PX;
        }

        const p = clampRoot(e.clientX - drag.dx, e.clientY - drag.dy);
        root.style.left = `${p.x}px`;
        root.style.top = `${p.y}px`;
        root.style.right = 'auto';
        savePosition(p.x, p.y);
        positionToastHost();

        e.preventDefault();
    }

    function stopDrag(e) {
        if (!drag) return;
        if (drag.pointerId != null && e.pointerId != null && drag.pointerId !== e.pointerId) return;
        if (drag.moved) suppressLabelClickUntil = Date.now() + DRAG_CLICK_SUPPRESS_MS;
        drag = null;
    }

    function startCategoryDrag(e) {
        const handle = e.target?.closest?.('.mta-cat-handle');
        const item = handle?.closest?.('.mta-cat-item');
        if (!handle || !item) return;
        if (e.button != null && e.button !== 0) return;

        categoryDrag = {
            pointerId: e.pointerId,
            item,
            startIndex: Array.from(item.parentElement?.querySelectorAll('.mta-cat-item') || []).indexOf(item),
            moved: false
        };

        item.classList.add('dragging');
        try { handle.setPointerCapture?.(e.pointerId); } catch {}
        e.preventDefault();
    }

    function moveCategoryDrag(e) {
        if (!categoryDrag) return;
        if (categoryDrag.pointerId != null && e.pointerId != null && categoryDrag.pointerId !== e.pointerId) return;

        const wrap = document.querySelector('.mta-cats');
        if (!wrap) return;

        const draggedItem = categoryDrag.item;
        const siblings = Array.from(wrap.querySelectorAll('.mta-cat-item')).filter(item => item !== draggedItem && !item.hidden);
        let inserted = false;

        for (const sibling of siblings) {
            const rect = sibling.getBoundingClientRect();
            if (e.clientY < rect.top + (rect.height / 2)) {
                wrap.insertBefore(draggedItem, sibling);
                categoryDrag.moved = true;
                inserted = true;
                break;
            }
        }

        if (!inserted) {
            if (wrap.lastElementChild !== draggedItem) categoryDrag.moved = true;
            wrap.appendChild(draggedItem);
        }
        e.preventDefault();
    }

    function stopCategoryDrag(e) {
        if (!categoryDrag) return;
        if (categoryDrag.pointerId != null && e.pointerId != null && categoryDrag.pointerId !== e.pointerId) return;

        const currentIndex = Array.from(categoryDrag.item.parentElement?.querySelectorAll('.mta-cat-item') || []).indexOf(categoryDrag.item);
        const moved = categoryDrag.moved && currentIndex !== categoryDrag.startIndex;
        categoryDrag.item.classList.remove('dragging');
        categoryDrag = null;
        if (!moved) return;

        saveCategoryStateFromDom();
        refreshItemChoices({ useSavedPrimary: false, useSavedSecondary: false });
        updateInfoPanel();
    }

    function startMenuDrag(e) {
        const menu = document.getElementById('mta-menu');
        if (!menu || menu.classList.contains('hidden')) return;
        if (e.button != null && e.button !== 0) return;

        const rect = menu.getBoundingClientRect();
        menuDrag = {
            pointerId: e.pointerId,
            dx: e.clientX - rect.left,
            dy: e.clientY - rect.top,
            moved: false
        };

        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
        e.preventDefault();
    }

    function moveMenuDrag(e) {
        if (!menuDrag) return;
        if (menuDrag.pointerId != null && e.pointerId != null && menuDrag.pointerId !== e.pointerId) return;

        const menu = document.getElementById('mta-menu');
        if (!menu) return;

        const x = e.clientX - menuDrag.dx;
        const y = e.clientY - menuDrag.dy;
        const p = clampMenuPosition(x, y);
        menuDrag.moved = true;
        menuPosition = p;
        applyMenuPosition(p.x, p.y);

        e.preventDefault();
    }

    function stopMenuDrag(e) {
        if (!menuDrag) return;
        if (menuDrag.pointerId != null && e.pointerId != null && menuDrag.pointerId !== e.pointerId) return;
        if (menuDrag.moved) {
            const menu = document.getElementById('mta-menu');
            if (menu) {
                const rect = menu.getBoundingClientRect();
                menuPosition = clampMenuPosition(rect.left, rect.top);
            }
        }
        menuDrag = null;
    }

    function bindUiEvents() {
        const chip = document.getElementById('mta-chip');
        const label = document.getElementById('mta-label');
        const head = document.getElementById('mta-drag-head');
        const plane = document.getElementById('mta-plane');
        const categoryWrap = document.querySelector('.mta-cats');
        const countryBadge = document.getElementById('mta-country-badge');
        const countrySel = document.getElementById('mta-country');
        const itemSel = document.getElementById('mta-item');
        const SecondarySel = document.getElementById('mta-Secondary');
        const purchaseFilterSel = document.getElementById('mta-purchase-filter');
        const saveBtn = document.getElementById('mta-save');
        const forumLikeBtn = document.getElementById('mta-forum-like');
        const keyBind = document.getElementById('mta-keybind');
        const keyCtrl = document.getElementById('mta-key-ctrl');
        const keyAlt = document.getElementById('mta-key-alt');
        const keyShift = document.getElementById('mta-key-shift');
        const cap = document.getElementById('mta-capacity');
        const travelModeSel = document.getElementById('mta-travel-mode');
        const showFlags = document.getElementById('mta-show-flags');
        const showCountryCodes = document.getElementById('mta-show-cc');
        const showCountdown = document.getElementById('mta-show-countdown');
        const showEta = document.getElementById('mta-show-eta');
        const themeResetBtn = document.getElementById('mta-theme-reset');
        const instructionsPanel = document.getElementById('mta-instructions-panel');
        const themeInputs = THEME_PICKERS.flatMap(picker => [
            document.getElementById(picker.id),
            document.getElementById(getThemeAlphaInputId(picker))
        ]).filter(Boolean);

        chip?.addEventListener('pointerdown', startDrag);
        window.addEventListener('pointermove', moveDrag, { passive: false });
        window.addEventListener('pointerup', stopDrag, { passive: true });
        window.addEventListener('pointercancel', stopDrag, { passive: true });

        categoryWrap?.addEventListener('pointerdown', startCategoryDrag);
        window.addEventListener('pointermove', moveCategoryDrag, { passive: false });
        window.addEventListener('pointerup', stopCategoryDrag, { passive: true });
        window.addEventListener('pointercancel', stopCategoryDrag, { passive: true });

        head?.addEventListener('pointerdown', startMenuDrag);
        window.addEventListener('pointermove', moveMenuDrag, { passive: false });
        window.addEventListener('pointerup', stopMenuDrag, { passive: true });
        window.addEventListener('pointercancel', stopMenuDrag, { passive: true });

        countryBadge?.addEventListener('click', e => {
            if (!countrySel) return;
            e.preventDefault();
            openCustomSelect(countrySel);
            countrySel.closest('.mta-select')?.querySelector('.mta-select-button')?.focus({ preventScroll: true });
        });

        countrySel?.addEventListener('change', () => {
            setSelectedCountryKey(countrySel.value);
            updateCountryBadge(countrySel.value);
            updateCategoryChecks();
            refreshItemChoices({ useSavedPrimary: false, useSavedSecondary: false });
            updateHeaderChip();
            updateInfoPanel();
            updateStatsPanels();
        });

        document.querySelectorAll('.mta-cats input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                saveCategoryStateFromDom();
                refreshItemChoices({ useSavedPrimary: false, useSavedSecondary: false });
                updateInfoPanel();
                updateStatsPanels();
            });
        });

        itemSel?.addEventListener('change', () => {
            setSelectedItemName(itemSel.value);
            updateSecondarySelect(itemSel.value, { useSavedSecondary: false });
            updateInfoPanel();
        });

        SecondarySel?.addEventListener('change', () => {
            setSecondaryItemName(SecondarySel.value);
            updateInfoPanel();
        });

        purchaseFilterSel?.addEventListener('change', () => {
            setPurchaseFilter(purchaseFilterSel.value);
            updateStatsPanels();
        });

        cap?.addEventListener('input', () => {
            setCapacity(cap.value);
            updateInfoPanel();
        });

        travelModeSel?.addEventListener('change', () => {
            setTravelMode(travelModeSel.value);
            updateInfoPanel();
        });

        document.getElementById('mta-book')?.addEventListener('change', e => {
            setBookRead(!!e.target.checked);
            updateInfoPanel();
        });

        showCountdown?.addEventListener('change', () => {
            setShowCountdown(showCountdown.checked);
            updateHeaderChip();
        });
        showFlags?.addEventListener('change', () => {
            setShowFlags(showFlags.checked);
            updateHeaderChip();
        });

        showCountryCodes?.addEventListener('change', () => {
            setShowCountryCodes(showCountryCodes.checked);
            updateHeaderChip();
        });

        showEta?.addEventListener('change', () => {
            setShowEta(showEta.checked);
            updateHeaderChip();
        });

        instructionsPanel?.addEventListener('toggle', () => {
            setInstructionsOpen(instructionsPanel.open);
        });

        themeInputs.forEach(input => {
            input.addEventListener('input', () => {
                for (const picker of THEME_PICKERS) {
                    if (input.id === getThemeAlphaInputId(picker)) {
                        syncThemeAlphaReadout(picker, input.value);
                        break;
                    }
                }
                applyThemeSettings(readThemeSettingsFromDom());
            });
            input.addEventListener('change', () => {
                for (const picker of THEME_PICKERS) {
                    if (input.id === getThemeAlphaInputId(picker)) {
                        syncThemeAlphaReadout(picker, input.value);
                        break;
                    }
                }
                const theme = readThemeSettingsFromDom();
                saveThemeSettings(theme);
                applyThemeSettings(theme);
            });
        });

        themeResetBtn?.addEventListener('click', () => {
            const theme = normalizeThemeSettings(DEFAULT_THEME);
            syncThemeControls(theme);
            saveThemeSettings(theme);
            applyThemeSettings(theme);
            showToast('Theme reset.');
        });

        forumLikeBtn?.addEventListener('click', () => {
            handleForumLikeAction();
        });
        saveBtn?.addEventListener('click', () => saveSettingsFromMenu(true));

        keyBind?.addEventListener('click', () => {
            isListening = true;
            keyBind.textContent = '...';
        });

        document.addEventListener('keydown', async e => {
            if (isListening) {
                if (normalizeKeyToken(e.key) === 'esc') {
                    isListening = false;
                    updateSavedControls();
                    return;
                }

                const key = normalizeKeyToken(e.key);
                if (!key || isModifierOnlyKey(key)) return;

                const hotkey = readHotkeyConfigFromDom();
                hotkey.key = key;
                saveHotkeyConfig(hotkey);
                isListening = false;
                updateSavedControls();
                return;
            }
            if (isInputLike(e.target)) return;
            if (matchesHotkeyEvent(e)) {
                e.preventDefault();
                await runQuickAction();
            }
        });

        [keyCtrl, keyAlt, keyShift].forEach(cb => {
            cb?.addEventListener('change', () => {
                saveHotkeyConfig(readHotkeyConfigFromDom());
                refreshHotkeyPreview();
            });
        });

        label?.addEventListener('click', () => {
            if (menuDrag || drag || Date.now() < suppressLabelClickUntil) return;
            setMinimized(!getMinimized());
            updateHeaderChip();
        });

        function startPlanePress(e) {
            if (e.button != null && e.button !== 0) return;
            activePlanePointerId = e.pointerId ?? 'plane';
            clearTimeout(pressTimer);
            longPressed = false;
            pressTimer = setTimeout(() => {
                longPressed = true;
                setMinimized(false);
                updateHeaderChip();
            }, LONG_PRESS_MS);

            try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
            e.preventDefault();
        }

        async function endPlanePress(e) {
            if (activePlanePointerId != null && e.pointerId != null && activePlanePointerId !== e.pointerId) return;
            clearTimeout(pressTimer);
            activePlanePointerId = null;

            if (longPressed) {
                longPressed = false;
                return;
            }

            longPressed = false;
            e.preventDefault();
            await runQuickAction();
        }

        function cancelPlanePress(e) {
            if (activePlanePointerId != null && e?.pointerId != null && activePlanePointerId !== e.pointerId) return;
            clearTimeout(pressTimer);
            longPressed = false;
            activePlanePointerId = null;
        }

        plane?.addEventListener('pointerdown', startPlanePress);
        plane?.addEventListener('pointerup', endPlanePress);
        plane?.addEventListener('pointercancel', cancelPlanePress);

        window.addEventListener('resize', () => {
            const root = document.getElementById('mta-root');
            const menu = document.getElementById('mta-menu');

             applyLayoutMode();

            if (root) {
                const rect = root.getBoundingClientRect();
                const p = clampRoot(rect.left, rect.top);
                root.style.left = `${p.x}px`;
                root.style.top = `${p.y}px`;
                root.style.right = 'auto';
                savePosition(p.x, p.y);
                positionToastHost();
            }

            if (menu && !menu.classList.contains('hidden')) {
                if (menuPosition) {
                    const p = clampMenuPosition(menuPosition.x, menuPosition.y);
                    menuPosition = p;
                    applyMenuPosition(p.x, p.y);
                } else {
                    positionMenu();
                }
            }

            if (activeCustomSelect?.classList.contains('open')) {
                positionCustomSelectList(activeCustomSelect);
            }
        });
    }

    syncAssistantMountState();
    setInterval(() => {
        if (!syncAssistantMountState()) return;
        updateHeaderChip();
        updateInfoPanel();
        updateStatsPanels();
    }, 1500);
})();
