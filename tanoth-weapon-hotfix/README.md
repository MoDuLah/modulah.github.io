# Tanoth – Weapon Rendering Hotfix

Tanoth – Weapon Rendering Hotfix is a small standalone userscript for a fight-rendering problem seen with some T5 weapons. When Tanoth loads a weapon without valid reference-point metadata, the normal fight renderer can crash or place the weapon too low. This script supplies a conservative fallback before the renderer uses that data.

[Install version 1.1.0](https://modulah.github.io/tanoth-weapon-hotfix/tanoth-weapon-hotfix.user.js?v=1.1.0)

## What it changes

- Protects both the player and opponent weapon renderers.
- Repairs only missing or invalid direction, angle, and reference-point values.
- Leaves valid Gameforge positioning metadata unchanged.
- Raises only fallback-positioned weapon images by 32 pixels by default.

This is a compatibility hotfix, not a replacement fight renderer. It can be disabled or removed after Gameforge fixes the underlying weapon data/rendering issue.

## Install

1. Install a userscript manager such as Tampermonkey or Greasemonkey.
2. Open the [install link](https://modulah.github.io/tanoth-weapon-hotfix/tanoth-weapon-hotfix.user.js?v=1.1.0) and approve the userscript installation.
3. Fully reload Tanoth before starting a fight. The script must run at `document-start` so it can patch the game renderer during startup.

The script matches `https://*.tanoth.gameforge.com/*`, runs in the page's JavaScript world, and requires no userscript-manager permissions.

## Check or adjust the hotfix

Open the browser developer console on Tanoth and use:

```js
window.TanothWeaponHotfix.status
window.TanothWeaponHotfix.patched
window.TanothWeaponHotfix.warnings
window.TanothWeaponHotfix.lift
```

The status should become `active` after the game starts. Warnings list only repairs performed during the current page load.

To change the fallback lift for both sides:

```js
window.TanothWeaponHotfix.setLift(32)
```

You can also adjust one side independently:

```js
window.TanothWeaponHotfix.setLift(36, "player")
window.TanothWeaponHotfix.setLift(28, "opponent")
```

Accepted values range from `-30` to `120` pixels. The selected player and opponent values are stored locally in that browser.

## Privacy and network access

The userscript makes no server requests, loads no external code, and does not collect or upload game, account, session, or fight data. Its only persistent data is the two optional lift values stored in the browser's local storage.

## Version 1.1.0

- Prevents missing weapon reference points from crashing fight rendering.
- Adds conservative direction and angle fallbacks.
- Corrects the fallback image anchor without moving normal weapon animations.
- Supports live player/opponent lift adjustment and console diagnostics.
