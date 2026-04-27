# PresenceHub — Project Design Document

## Overview
PresenceHub is a standalone real-time presence microservice that tracks which users (Customer Service Representatives) are viewing/working on which lots in the existing UI application. It provides live indicators on the home page and lot detail page so users can see who else is on a lot.

---

## Problem Statement
- Users (CSRs) work on units called **lots** in an existing React UI app
- There is no indication when another user is already viewing/working on a lot
- Need: show presence indicators on the home page lot list and on the lot detail page

---

## Architecture

```
React UI (existing)
     |
     |  SSE (receive updates) + REST (send actions)
     v
PresenceHub Microservice (Node.js + Express)
     |
     |  State + Pub/Sub
     v
Redis (bundled, swappable to central Redis later)
```

### Why a Standalone Microservice?
- Decoupled from the existing Java backend
- Can be extended to other UI apps in the company
- Node.js is well-suited for real-time/event-driven workloads

### Why SSE + REST (not WebSockets)?
- Presence data flows server → client (SSE handles this perfectly)
- Client actions (enter/leave/heartbeat) are infrequent POST calls
- Simpler to build and maintain than WebSockets
- Trade-off: `leave_lot` on ungraceful exit relies on heartbeat timeout (acceptable for informational indicator)

### Why Redis?
- Multiple Node.js server instances can't share in-memory state
- Redis pub/sub acts as message bus between instances
- Bundled initially, swappable to a central DevOps-managed Redis later

---

## REST API

| Method | Endpoint | Purpose | Payload |
|---|---|---|---|
| `POST` | `/presence/enter` | User opens a lot | `{ lotId, userEmail }` |
| `POST` | `/presence/leave` | User leaves a lot | `{ lotId, userEmail }` |
| `POST` | `/presence/heartbeat` | Keep-alive ping | `{ lotId, userEmail }` |
| `GET` | `/presence/lots?lotIds=1,2,3` | Batch fetch presence for visible lots | - |
| `GET` | `/presence/lot/:lotId` | Get all users on a specific lot | - |
| `GET` | `/presence/stream` | SSE stream — client subscribes here | - |

---

## SSE Event Flow

```
Client subscribes to GET /presence/stream
     |
     | POST /presence/enter { lotId, userEmail }
     v
Server updates Redis → publishes to Redis pub/sub
     |
     v
All SSE subscribers receive:
{ event: "presence_update", data: { lotId, users: ["a@x.com", "b@x.com"] } }
```

---

## Redis Data Model

```
presence:lot:{lotId}  →  Hash { userEmail: lastSeenTimestamp }
```

Timestamps allow TTL-based stale session cleanup.

---

## Heartbeat & Stale Session Strategy

| Parameter | Value |
|---|---|
| Heartbeat interval | Every 3 minutes (only when tab is visible) |
| Stale timeout | 15 minutes (no heartbeat = user considered gone) |
| Cleanup job | Runs every 5 minutes, removes entries where `now - lastSeen > 15 mins` |

Rationale: timeout = ~5x heartbeat interval to allow for missed heartbeats due to slow network or timer drift.

---

## Frontend Behavior (per lot detail tab)

```
on mount / tab visible   → POST /presence/enter, start heartbeat (every 3 mins)
on tab hidden            → clear heartbeat (15 min timeout takes over naturally)
on tab visible again     → POST /presence/enter, restart heartbeat
on unmount               → POST /presence/leave, clear heartbeat
on beforeunload          → navigator.sendBeacon('/presence/leave') — reliable on tab close
```

### Why `navigator.sendBeacon` on close?
Browser gives very little time for `beforeunload` requests. `sendBeacon` is designed exactly for this — fires reliably even on tab/browser close.

### Why Page Visibility API?
Stops heartbeat when user switches to another tab. We don't want to show someone as "working on a lot" when they've been on a different tab for 10+ minutes.

---

## Delay / Behavior Matrix

| Scenario | Behavior |
|---|---|
| Graceful leave (navigate away) | Near zero delay — `POST /presence/leave` |
| Tab/browser close | Near zero — `sendBeacon` fires reliably |
| Tab backgrounded (user on another tab) | Removed after ~15 min (heartbeat stops) |
| Network drop | Removed after ~15 min (heartbeat stops) |
| Tab crash | Removed after ~15 min (heartbeat stops) |
| User returns to tab | Immediate — re-enters on `visibilitychange` |
| Multiple tabs, different lots | Each tab tracked independently |

---

## Multi-tab Handling
- Each tab independently calls `enter` and `leave` for its own lot
- Redis tracks `{ lotId → [emails] }` — a user can appear on multiple lots simultaneously (one per tab)
- Each tab has its own heartbeat timer

---

## Authentication
- Auth is handled centrally at a higher level
- User identity passed as `userEmail` in all REST calls from the UI

## Correlation ID
- UI already sends `X-Correlation-ID` header with every request
- PresenceHub extracts it from request headers and includes it in all logs
- Enables tracing a request across the Java backend, PresenceHub, and frontend logs using the same ID
- Also used as the key in Redis presence hash (instead of a generated sessionId)
- Naturally handles multiple tabs for the same user on the same lot

---

## User Display
- Users identified and displayed by **email address**

---

## Project Structure

```
presence-service/
├── src/
│   ├── index.js
│   ├── routes/
│   │   ├── presence.js     # POST enter/leave/heartbeat + GET lots/lot/:id
│   │   └── stream.js       # GET /presence/stream (SSE)
│   └── redis/
│       └── client.js       # Redis state + pub/sub helpers
├── docker-compose.yml       # Node + Redis
├── package.json
└── .env
```

---

## React Integration (no new React app)

Delivered as ready-to-copy components for the existing React app:

```
react-integration/
├── hooks/
│   └── usePresence.js        # EventSource + enter/leave/heartbeat logic
├── components/
│   ├── LotPresenceBadge.jsx  # Badge for home page lot list
│   └── LotPresenceBanner.jsx # "Currently viewing" banner for lot detail page
└── README.md                 # Integration instructions
```

### Home Page
- On load / pagination change → `GET /presence/lots?lotIds=...` for initial state
- Single persistent `EventSource` (SSE connection) at app level
- On `presence_update` event → update badge for that `lotId` if visible
- Lots list is **paginated** — batch fetch only visible lot IDs

### Lot Detail Page
- Drop `<LotPresenceBanner lotId={lotId} userEmail={currentUserEmail} />` on the page
- Shows "Currently viewing: a@x.com, b@x.com"
- Presence is **informational only** — users can still open and work on any lot

---

## Build Steps
1. Scaffold Node.js + Express
2. Redis client with presence helpers (enter, leave, heartbeat, cleanup)
3. REST routes (enter, leave, heartbeat, batch fetch)
4. SSE stream route with Redis subscriber
5. Stale session cleanup job (every 5 mins)
6. Docker + docker-compose setup
7. React `usePresence` hook + `EventSource` setup
8. `LotPresenceBadge` component (home page)
9. `LotPresenceBanner` component (lot detail page)

---

## Future Considerations
- Swap bundled Redis for central DevOps-managed Redis (just change env config)
- Extend to other UI apps in the company — same service, same components
