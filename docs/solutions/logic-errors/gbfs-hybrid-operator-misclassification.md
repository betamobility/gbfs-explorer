---
title: "Hybrid GBFS Operator Misclassification — Inflated Vehicle Counts"
type: logic-error
severity: critical
date: 2026-02-26
project: GBFS Explorer
status: resolved
affected_components:
  - src/utils/gbfsClassification.ts
  - src/pages/App.tsx
  - src/components/OperatorGlobalView.tsx
  - src/components/OperatorCityMap.tsx
tags:
  - gbfs
  - classification
  - data-accuracy
  - virtual-stations
related:
  - docs/plans/2026-02-26-feat-operator-global-fleet-view-plan.md
  - docs/plans/2026-02-26-refactor-strip-databutton-deploy-railway-plan.md
---

# Hybrid GBFS Operator Misclassification — Inflated Vehicle Counts

## Problem

Operators like Dott Copenhagen showed **115,873 bikes** instead of ~1,000 actual vehicles. The vehicle count was inflated by ~100x for any operator that publishes both station-based and vehicle-based GBFS feeds.

## Root Cause

The `classifyOperatorType` function in `src/utils/gbfsClassification.ts` had a "prefer stations" policy: if `station_information` AND `station_status` feeds existed, it always returned `'station_based'` — even when the operator also published `vehicle_status` or `free_bike_status`.

Operators like Dott, Lime, and Tier use **virtual stations** (geofence zones, not physical docks). Their `station_status` feed contains thousands of zones, each reporting `num_bikes_available`. Summing across all zones double/triple-counts individual vehicles because one vehicle can appear in multiple overlapping zones.

## Solution

Changed classification to detect hybrid systems and prefer the vehicle feed for accurate counts.

**Before:**
```typescript
// Classification logic - "prefer stations" policy
if (hasStationFeeds) {
  return 'station_based';  // Always preferred stations
} else if (hasVehicleFeeds) {
  return 'free_floating';
}
```

**After:**
```typescript
// Classification logic
if (hasStationFeeds && hasVehicleFeeds) {
  // HYBRID: prefer vehicle feed — vehicle_status/free_bike_status gives
  // accurate individual vehicle counts, whereas station_status on
  // virtual-station operators double-counts across geofence zones.
  return 'free_floating';
} else if (hasStationFeeds) {
  // Pure station-based (no vehicle feed available)
  return 'station_based';
} else if (hasVehicleFeeds) {
  return 'free_floating';
}
```

**File:** `src/utils/gbfsClassification.ts`

The fix automatically propagates — `App.tsx` and `OperatorGlobalView.tsx` both branch on `operatorType` to decide which status feed to fetch.

## Secondary Fixes (Same Session)

### Map Reloading on Progressive Fetch

**Problem:** `OperatorCityMap` recreated the entire Mapbox map instance every time `markers` changed (3+ times during progressive fetching).

**Fix:** Split into two effects — map init (depends on `mapboxToken`) and marker sync (depends on `markers` + `mapReady`). Map canvas stays stable while markers update incrementally.

**File:** `src/components/OperatorCityMap.tsx`

### Cold Cache — 30s First Load

**Problem:** Backend in-memory cache was empty after each Railway deploy. First user request waited ~30s for the Mobility Database API.

**Fix:** Added FastAPI startup event to pre-warm the cache before serving traffic.

```python
@app.on_event("startup")
async def warm_cache():
    from app.apis.mobility_database import get_mobility_feeds
    result = await get_mobility_feeds()
    print(f"Cache warmed: {result.total_count} systems loaded")
```

**File:** `backend/main.py`

### CORS Missing Custom Domain

**Problem:** `ALLOWED_ORIGINS` on Railway didn't include `https://gbfs.betamobility.com`, silently blocking all API calls.

**Fix:** Added the custom domain to `ALLOWED_ORIGINS` env var and redeployed.

### SSL Certificate Not Provisioned

**Problem:** After updating DNS CNAME to `cname.vercel-dns.com`, site returned `ERR_CONNECTION_CLOSED` — Vercel hadn't auto-provisioned a cert.

**Fix:** `npx vercel certs issue gbfs.betamobility.com`

## Prevention

1. **Hybrid classification tests:** Test all four feed combinations (station-only, vehicle-only, both, neither) with expected classification and vehicle counts.
2. **Separate React effects by concern:** Map init effect should never depend on data arrays. Use a `mapReady` flag to coordinate.
3. **Post-deploy CORS smoke test:** After adding a custom domain, immediately test a cross-origin API call.
4. **Verify SSL after DNS change:** Don't assume auto-provisioning — check `vercel certs ls` and issue manually if needed.
5. **Startup cache warming:** Any in-memory cache that serves the first request must be warmed in a startup event, not lazily on first hit.

## Cross-References

- [Dashboard: Vercel + Railway CORS pattern](../../../../../../Apps/Dashboard/docs/solutions/integration-issues/vercel-railway-cors-subdirectory-deployment.md)
- [Dashboard: FastAPI cache warming pattern](../../../../../../Apps/Dashboard/docs/solutions/performance-issues/financial-data-caching-and-rate-limiting.md)
- [Carpool Insight: Mapbox GL JS React lifecycle](../../../../../../Clients/Ruter/Carpool%20Insight/docs/solutions/ui-bugs/mapbox-polygon-holes-rendering-artifacts.md)
