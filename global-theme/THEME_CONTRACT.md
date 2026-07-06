# MoDuL Hub Global Theme Contract

MoDuL Hub Control Room is the source of truth for shared styling across MoDuL Torn userscripts.

Public install/update URL:

`https://modulah.github.io/global-theme/modul-hub-global-theme.user.js`

## Runtime API

The script exposes the same API under both names:

- `window.MoDuLHubControlRoom`
- `window.MoDuLHubTheme`

Use these helpers in future script edits:

- `getContract()` returns the full versioned theme contract.
- `getClasses()` returns canonical `mh-*` class names.
- `getSelectors()` returns canonical compatibility selector groups.
- `getVars()` returns the active theme values.
- `getVar(key)` returns one active theme value.
- `varName(key)` returns a CSS variable name such as `--mh-table-bg`.
- `cssVar(key, fallback)` returns a CSS `var(...)` reference.
- `onUpdate(handler)` subscribes to theme changes.

## Required Identifiers

All current, future, and edited historical userscripts should use these identifiers when building themed UI:

- `.mh-root`
- `.mh-panel`
- `.mh-card`
- `.mh-elevated`
- `.mh-toolbar`
- `.mh-control`
- `.mh-button`
- `.mh-input`
- `.mh-select`
- `.mh-table`
- `.mh-table-head`
- `.mh-table-body`
- `.mh-table-row`
- `.mh-table-cell`
- `.mh-accent`
- `.mh-muted`
- `.mh-success`
- `.mh-warning`
- `.mh-danger`
- `.mh-info`

Equivalent data attributes are also supported:

- `data-mh-component="root|panel|card|toolbar|control|button|field|table"`
- `data-mh-surface="panel|elevated|control|table"`
- `data-mh-table-part="head|body|row|cell"`
- `data-mh-state="accent|muted|success|warning|danger|info"`

## Table Contract

Use the same table identifiers everywhere:

```html
<table class="mh-table" data-mh-component="table">
  <thead class="mh-table-head" data-mh-table-part="head"></thead>
  <tbody class="mh-table-body" data-mh-table-part="body">
    <tr class="mh-table-row" data-mh-table-part="row">
      <td class="mh-table-cell" data-mh-table-part="cell"></td>
    </tr>
  </tbody>
</table>
```

## CSS Variables

Scripts should read styling from `--mh-*` variables, especially:

- `--mh-bg`
- `--mh-bg-soft`
- `--mh-panel`
- `--mh-panel2`
- `--mh-elevated`
- `--mh-table-bg`
- `--mh-table-head`
- `--mh-control`
- `--mh-control-hover`
- `--mh-border`
- `--mh-border-soft`
- `--mh-text`
- `--mh-text-soft`
- `--mh-text-muted`
- `--mh-accent`
- `--mh-accent-2`
- `--mh-success`
- `--mh-warning`
- `--mh-danger`
- `--mh-info`
- `--mh-font-body`
- `--mh-font-title`
- `--mh-font-mono`
- `--mh-radius-sm`
- `--mh-radius-md`
- `--mh-shadow`
- `--mh-table-cell-padding-top`
- `--mh-table-cell-padding-right`
- `--mh-table-cell-padding-bottom`
- `--mh-table-cell-padding-left`

Do not duplicate these as local theme constants unless a script needs temporary fallback support while being migrated.
