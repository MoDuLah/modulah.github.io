// ==UserScript==
// @name         Tanoth - Weapon Rendering Hotfix
// @namespace    modulah.github.io
// @version      1.1.0
// @description  Prevent missing weapon-point crashes and correct fallback anchor height; adjustable live in Firefox.
// @author       MoDuL
// @homepageURL  https://github.com/MoDuLah/modulah.github.io/tree/main/tanoth-weapon-hotfix
// @supportURL   https://github.com/MoDuLah/modulah.github.io/issues
// @match        https://*.tanoth.gameforge.com/*
// @downloadURL  https://modulah.github.io/tanoth-weapon-hotfix/tanoth-weapon-hotfix.user.js?v=1.1.0
// @updateURL    https://modulah.github.io/tanoth-weapon-hotfix/tanoth-weapon-hotfix.user.js?v=1.1.0
// @run-at       document-start
// @grant        none
// @sandbox      raw
// ==/UserScript==

(() => {
  "use strict";

  // This script MUST run in the webpage's JS world at document-start.
  // It hooks Lime's game startup and patches the BattleGround prototype
  // after the Haxe classes have been declared, but before battles run.
  // No downloads, external scripts, server requests, or eval() required.

  const PREFIX = "[Tanoth Weapon Hotfix]";
  const CLASS_NAMES = Object.freeze([
    "openfl.geom.Point",
    "de.gameforge.modules.battle.BattleGround",
  ]);
  const state = {
    status: "waiting for Lime startup",
    patched: false,
    captures: Object.create(null),
    warnings: [],
    embedDepth: 0,
  };
  const hookedLimeObjects = new WeakSet();
  const taggedEmbedWrappers = new WeakSet();

  // Original fallback reference point was (18, 118) / (56, 118).
  // Raise only weapons that are MISSING reference-point metadata.
  // Increasing RP.y moves the image UP because the game places its
  // picture container at -RP.y. Leave genuine RP values untouched.
  const BASE_RP_Y = 118;
  const DEFAULT_LIFT_PX = 32;
  const STORAGE_PREFIX = "modul.tanoth.weapon-hotfix.v1.1.lift.";
  const current = { pl: null, op: null };

  function loadLift(side) {
    try {
      const saved = window.localStorage.getItem(STORAGE_PREFIX + side);
      const value = saved === null ? NaN : Number(saved);
      if (Number.isFinite(value) && value >= -30 && value <= 120) {
        return Math.round(value);
      }
    } catch (_) {
      /* Private mode / denied storage: use default. */
    }
    return DEFAULT_LIFT_PX;
  }

  const lift = { pl: loadLift("pl"), op: loadLift("op") };

  function getMediaUrl(loader) {
    if (!loader) return "";
    // ch.sfug.net.MediaLoader is generated from Haxe. Its URL is exposed
    // through get_url(), not necessarily via a normal JS .url property.
    try {
      if (typeof loader.get_url === "function") {
        const url = loader.get_url();
        if (typeof url === "string") return url;
      }
    } catch (_) {
      /* Fall through. */
    }
    return typeof loader.url === "string" ? loader.url : "";
  }

  function setLift(pixels, which = "both") {
    const n = Number(pixels);
    if (!Number.isFinite(n) || n < -30 || n > 120) {
      throw new RangeError("Lift must be a number between -30 and 120 pixels.");
    }
    if (!["both", "player", "opponent", "pl", "op"].includes(which)) {
      throw new Error("Side must be player, opponent, or both.");
    }
    const value = Math.round(n);
    const sides =
      which === "both"
        ? ["pl", "op"]
        : [which === "player" ? "pl" : which === "opponent" ? "op" : which];
    for (const side of sides) {
      const delta = value - lift[side];
      lift[side] = value;
      const active = current[side];
      if (active && active.weapon && active.weapon.__tanothFallbackRP) {
        const { weapon } = active;
        const point = weapon.rp;
        if (point && Number.isFinite(point.y)) point.y += delta;
        const container =
          typeof weapon.getChildByName === "function"
            ? weapon.getChildByName("pic_container")
            : null;
        if (
          container &&
          typeof container.get_y === "function" &&
          typeof container.set_y === "function"
        ) {
          // Existing animation/tweens operate on the parent weapon;
          // move ONLY the image's local anchor, not the animation path.
          container.set_y(container.get_y() - delta);
        }
      }
      try {
        window.localStorage.setItem(STORAGE_PREFIX + side, String(value));
      } catch (_) {
        /* Live value still works without storage. */
      }
    }
    console.info(PREFIX, "Fallback anchor lift set (pixels):", { ...lift });
    return { player: lift.pl, opponent: lift.op };
  }

  function logWarning(kind, side, battlefield, extra = {}) {
    const weaponLoader = battlefield[side + "_weapon_loader"];
    const url = getMediaUrl(weaponLoader);
    const filename = url.split("/").pop().split("?")[0] || "(unknown)";
    const parsedId = filename.match(/(?:unique|item_weapon)(\d+)\.png$/i);
    const detail = {
      side: side === "pl" ? "player" : "opponent",
      kind,
      filename,
      weaponId: parsedId ? Number(parsedId[1]) : null,
      weaponType: filename.startsWith("unique") ? "unique" : "regular/unknown",
      imageURL: url,
      ...extra,
    };
    state.warnings.push(detail);
    console.warn(PREFIX, kind, detail);
  }

  function repairWeapon(battlefield, side, Point) {
    const weapon = battlefield[side + "_weapon"];
    if (!weapon) return;

    if (weapon.dir !== "left" && weapon.dir !== "right") {
      logWarning('Missing/invalid direction; using "right"', side, battlefield, {
        previousDirection: weapon.dir,
      });
      weapon.dir = "right";
    }

    if (weapon.deg === null || weapon.deg === undefined || !Number.isFinite(Number(weapon.deg))) {
      logWarning("Missing/invalid angle; using 30 degrees", side, battlefield, {
        previousAngle: weapon.deg,
      });
      weapon.deg = 30;
    }

    const point = weapon.rp;
    if (!(point instanceof Point) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      // The point MUST be an actual openfl.geom.Point: the original game
      // performs a Haxe class cast before reading .x and .y.
      const x = weapon.dir === "left" ? 56 : 18;
      const y = BASE_RP_Y + lift[side];
      logWarning(
        "Missing/invalid weapon reference point; using raised fallback",
        side,
        battlefield,
        {
          previousReferencePoint: point,
          fallback: { x, y },
          liftedByPixels: lift[side],
        }
      );
      weapon.rp = new Point(x, y);
      weapon.__tanothFallbackRP = true;
      current[side] = { weapon };
    } else if (!weapon.__tanothFallbackRP) {
      // Do not modify Gameforge's correct positioning metadata.
      current[side] = null;
    }
  }

  function patchBattleGround() {
    if (state.patched) return;

    const BattleGround = state.captures[CLASS_NAMES[1]];
    const Point = state.captures[CLASS_NAMES[0]];
    if (!BattleGround || !Point || !BattleGround.prototype) {
      state.status = "game loaded, but required classes were not captured";
      console.error(PREFIX, state.status, {
        battleGroundCaptured: Boolean(BattleGround),
        pointCaptured: Boolean(Point),
      });
      return;
    }

    const proto = BattleGround.prototype;
    for (const [methodName, side] of [
      ["initPlWeapon", "pl"],
      ["initOpWeapon", "op"],
    ]) {
      const original = proto[methodName];
      if (typeof original !== "function") {
        state.status = "missing expected battle method: " + methodName;
        console.error(PREFIX, state.status);
        return;
      }
      proto[methodName] = function (...args) {
        repairWeapon(this, side, Point);
        return original.apply(this, args);
      };
    }

    state.patched = true;
    state.status = "active";
    console.info(
      PREFIX,
      "ACTIVE: both renderers protected. Missing-RP weapon images are raised by",
      { player: lift.pl, opponent: lift.op },
      "pixels."
    );
  }

  function captureClassesWhile(callback) {
    // Haxe registers classes as $hxClasses["qualified.Name"] = Ctor.
    // The registry is private to the generated script. Temporarily
    // intercept only these two uncommon property names during startup.
    // Restore Object.prototype immediately afterward.
    const saved = [];
    try {
      for (const name of CLASS_NAMES) {
        const previous = Object.getOwnPropertyDescriptor(Object.prototype, name);
        if (previous && !previous.configurable) {
          throw new Error("Cannot intercept class registry key: " + name);
        }
        saved.push([name, previous]);
        Object.defineProperty(Object.prototype, name, {
          configurable: true,
          get() {
            return undefined;
          },
          set(value) {
            // Preserve normal JS assignment semantics: create an
            // own property on the target, not a persistent global
            // prototype property. No other fields are intercepted.
            Object.defineProperty(this, name, {
              configurable: true,
              enumerable: true,
              writable: true,
              value,
            });
            if (typeof value === "function") {
              state.captures[name] = value;
            }
          },
        });
      }
      return callback();
    } finally {
      for (let i = saved.length - 1; i >= 0; i--) {
        const [name, previous] = saved[i];
        if (previous) {
          Object.defineProperty(Object.prototype, name, previous);
        } else {
          delete Object.prototype[name];
        }
      }
    }
  }

  function wrapEmbed(fn) {
    if (typeof fn !== "function" || taggedEmbedWrappers.has(fn)) return fn;

    function wrappedEmbed(...args) {
      if (state.patched || state.embedDepth > 0) {
        return fn.apply(this, args);
      }

      state.embedDepth++;
      state.status = "capturing battle classes during Lime startup";
      try {
        return captureClassesWhile(() => fn.apply(this, args));
      } finally {
        state.embedDepth--;
        // The original Lime embed invokes the generated Haxe script
        // synchronously. Its class prototypes are now fully defined.
        if (Object.keys(state.captures).length > 0) {
          patchBattleGround();
        } else {
          state.status = "waiting for Haxe class initialization";
        }
      }
    }
    taggedEmbedWrappers.add(wrappedEmbed);
    return wrappedEmbed;
  }

  function hookLime(lime) {
    if (!lime || (typeof lime !== "object" && typeof lime !== "function")) return;
    if (hookedLimeObjects.has(lime)) return;
    hookedLimeObjects.add(lime);

    const prior = Object.getOwnPropertyDescriptor(lime, "embed");
    if (prior && !prior.configurable) {
      console.warn(PREFIX, "Lime embed property is non-configurable; cannot hook startup.");
      return;
    }
    let embedValue = wrapEmbed(lime.embed);
    Object.defineProperty(lime, "embed", {
      configurable: true,
      enumerable: prior ? prior.enumerable : true,
      get() {
        return embedValue;
      },
      set(value) {
        embedValue = wrapEmbed(value);
      },
    });
    console.info(PREFIX, "Lime startup hook installed.");
  }

  const priorLime = Object.getOwnPropertyDescriptor(window, "lime");
  if (!priorLime || priorLime.configurable) {
    let limeValue = window.lime;
    Object.defineProperty(window, "lime", {
      configurable: true,
      enumerable: priorLime ? priorLime.enumerable : true,
      get() {
        return limeValue;
      },
      set(value) {
        limeValue = value;
        hookLime(value);
      },
    });
    hookLime(limeValue);
  } else {
    hookLime(window.lime);
  }

  // Inspect in DevTools Console:
  // window.TanothWeaponHotfix.status
  // window.TanothWeaponHotfix.warnings
  Object.defineProperty(window, "TanothWeaponHotfix", {
    configurable: true,
    value: {
      get status() {
        return state.status;
      },
      get patched() {
        return state.patched;
      },
      get warnings() {
        return state.warnings.slice();
      },
      get lift() {
        return { player: lift.pl, opponent: lift.op };
      },
      setLift,
    },
  });
  console.info(PREFIX, "Loaded at document-start; awaiting game startup.");
})();
