# Landlord Ledger Server API Contract

This keeps the userscript simple and keeps paid/scanning logic server-side.

## Existing Access Check

`POST /api/account/verify`

Request:

```json
{ "apiKey": "USER_PUBLIC_TORN_KEY" }
```

Response:

```json
{
  "sessionToken": "server-session-token",
  "entitlement": {
    "product": "landlord-ledger",
    "status": "active",
    "plan": "mpg"
  }
}
```

The server should reuse the same paid-account model used for CIS, CRF, and MPG. If the user has no valid access, return `403` with a clear error. The userscript sends the token back as `X-Pit-Guru-Session` to match the existing hosted pattern.

## Main Sync Endpoint

`POST /api/landlord-ledger/sync`

Headers:

```text
X-Pit-Guru-Session: server-session-token
Content-Type: application/json
```

Request:

```json
{
  "product": "landlord-ledger",
  "scope": "all",
  "includePartner": true,
  "apiKey": "USER_PUBLIC_TORN_KEY",
  "settings": {
    "targetAnnualRoi": 10,
    "defaultSuggestionLeaseDays": 100
  }
}
```

`scope` can be `all`, `owned`, `current`, or `partner`.

## Server Responsibilities

- Verify the session and paid entitlement before doing work.
- Fetch owned properties from Torn with `filters=ownedByUser`.
- Fetch the current property for the key owner.
- Fetch partner/spouse properties/contracts when available.
- Merge duplicate homes by Torn property `id`.
- For shared/current homes, show one joint row, not one row per user.
- Treat Torn `status` as the source of truth. A property with `status: "rented"` must never be suggested as idle/listable.
- Build ledger rows server-side: owner, renter, rent total, rent/day, period, days left, start/end dates, status, notes.
- Store or cache market rental/purchase values in the database.
- If cache is missing, call Torn from the server using the configured server public key.
- Match comps by property type and happiness first. Staff/modification matching can be added later.
- Calculate ROI and rent suggestions on the server.
- Return summaries/suggestions only. Do not return raw market scan rows unless an admin endpoint needs them.

## ROI Pagination

The ROI scanner must not stop at the first 100-ish results.

Server pagination should:

1. Request a page with the max limit Torn allows.
2. Read the oldest/last listing timestamp in that page.
3. Request the next page with the timestamp cursor set to `last_timestamp - 1`.
4. Stop when a page returns fewer than the limit, no timestamp, or a repeated cursor.

Use the exact Torn cursor parameter for the endpoint being called, but the cursor value must follow the `last result timestamp - 1` pattern.

## Sync Response Shape

The userscript accepts flexible names, but this is the preferred response:

```json
{
  "message": "Server filled 5 ledger rows and 5 suggestions.",
  "profile": {
    "id": 4022159,
    "name": "MoDuL",
    "spouse": { "id": 3877028, "name": "R4G3RUNN3R" }
  },
  "entitlement": {
    "product": "landlord-ledger",
    "status": "active",
    "plan": "mpg"
  },
  "ownedProperties": [],
  "currentProperty": {},
  "partnerProperties": [],
  "leases": [
    {
      "propertyId": "5786011",
      "property": "Villa",
      "landlord": "MoDuL [4022159]",
      "tenant": "x_Arnoud_x [4287757]",
      "amount": 70000,
      "dailyAmount": 700,
      "durationDays": 100,
      "remainingDays": 63,
      "status": "rented",
      "notes": ""
    }
  ],
  "suggestions": [
    {
      "id": 5786011,
      "property": "Villa",
      "status": "rented",
      "happy": 800,
      "current_cost_per_day": 700,
      "market_median_daily": 720,
      "suggested_rent_per_day": 720,
      "suggested_total": 72000,
      "suggested_roi": 10.17,
      "suggestion_note": "current rent is near market"
    }
  ],
  "roiSummary": [],
  "metadata": {
    "updatedAt": "2026-06-28T00:00:00.000Z"
  }
}
```
