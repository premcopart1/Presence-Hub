# PresenceHub — Project Design Document

## What Is This App?
PresenceHub is a standalone real-time presence microservice. Its job is simple: **track which users are currently viewing which lots and broadcast that information to all connected users in real time**.

When a CSR opens a lot, every other CSR sees a live indicator — either a badge on the home page lot list or a "Also viewing" banner on the lot detail page. This prevents duplicate work and improves team coordination without changing the existing UI app's core functionality.

It is built as a **standalone microservice** so it can be extended to any other UI app in the company — not just this one.

---

## Problem Statement
- Users (CSRs) work on units called **lots** in an existing React UI app
- There is no indication when another user is already viewing/working on a lot
- Need: show presence indicators on the home page lot list and on the lot detail page

---

## What Are Server-Sent Events (SSE)?

SSE is a browser technology that allows a server to **push data to a client over a single long-lived HTTP connection**. The client opens the connection once and the server can send messages to it at any time — without the client asking.

### How It Works
```
Browser                          Server
  |----GET /presence/stream------>|   (connection stays open)
  |<---data: presence_update------|   (server pushes anytime)
  |<---data: presence_update------|
  |<---: keep-alive---------------|   (periodic comment to prevent timeout)
```
The browser uses the built-in `EventSource` API to open this connection. If it drops, `EventSource` automatically reconnects — no extra code needed.

### SSE vs WebSockets vs Polling

| | SSE | WebSockets | Polling |
|---|---|---|---|
| Direction | Server → Client only | Bi-directional | Client → Server only |
| Protocol | Plain HTTP | Separate WS protocol | Plain HTTP |
| Auto-reconnect | Yes (built-in) | No (manual) | N/A |
| Complexity | Low | Medium-High | Low |
| Browser support | Excellent | Excellent | Excellent |
| Overhead | Low | Low | High (repeated requests) |
| Proxies/firewalls | Works everywhere (HTTP) | Can be blocked | Works everywhere |

### Why SSE Is the Right Choice Here
- Presence updates only ever flow **server → client** — SSE is designed exactly for this
- Client actions (`enter`, `leave`, `heartbeat`) are infrequent and can be plain POST calls
- SSE works over regular HTTP — no special infrastructure, no proxy issues
- `EventSource` auto-reconnects on network blip — zero resilience code needed
- Much simpler than WebSockets for a use case that doesn't need bi-directional communication

### Advantages of SSE
- **No connection overhead per update** — one persistent connection, server pushes as needed
- **Real-time** — updates arrive in milliseconds, no polling delay
- **Lightweight** — text-based, no binary framing like WebSockets
- **HTTP/2 compatible** — can multiplex many SSE streams over one TCP connection
- **Built-in browser reconnection** — `EventSource` handles drops automatically
- **Firewall friendly** — it's just HTTP, no special ports or protocol upgrades

### Trade-offs
- One-way only — client cannot send data over the SSE connection (handled via REST in this app)
- Each open tab holds one persistent HTTP connection — manageable at reasonable scale
- `leave_lot` on tab crash is not instant — relies on heartbeat timeout (15 min)

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

## How the Two Connections Work Together

A common question is: "SSE is one-way, so how does the client sending a POST result in an SSE event back?" The answer is two separate connections stitched together on the server via Redis.

```
Browser                        Server                        Other Browsers
  |                               |                                |
  |---GET /presence/stream------->| (SSE — stays open forever)     |
  |                               |                                |
  |---POST /presence/enter------->|                                |
  |                        writes to Redis                         |
  |                        redis.publish()                         |
  |                               |                                |
  |                        Redis subscriber fires                  |
  |                               |                                |
  |<--SSE presence_update---------|--SSE presence_update---------->|
```

- **POST** — short-lived HTTP request. Client tells server "I entered this lot."
- **SSE** — long-lived HTTP connection. Server tells all clients "here's the updated presence."
- **Redis pub/sub** — the glue. Decouples the POST handler from the SSE broadcaster. Works across multiple server instances.

### Why the in-memory `clients` Set is correct with multiple instances

Each server instance maintains its own Set of SSE connections. This is intentional:
- Instance 1 only knows about its own connected tabs
- Instance 2 only knows about its own connected tabs
- Redis pub/sub delivers the publish event to **all instances**
- Each instance then fans out to its own Set

So every tab, regardless of which instance it's connected to, gets the update.

---

## Future Considerations
- Swap bundled Redis for central DevOps-managed Redis (just change env config)
- Extend to other UI apps in the company — same service, same components
- Scope SSE subscriptions by lotIds (`/presence/stream?lotIds=...`) to reduce fan-out at large scale

---

## Flow Diagrams

### App Startup — SSE Connection Established

```
Browser (any user)                PresenceHub Server
        |                                  |
        |  App loads, user sets email       |
        |                                  |
        |---GET /presence/stream---------->|
        |                                  |  Adds client to in-memory Set
        |                                  |  Subscribes to Redis channel (once)
        |<--HTTP 200, connection held open-|
        |                                  |
        |        (connection stays open)   |
        |<---: keep-alive every 30s--------|
        |                                  |
```

---

### User Enters a Lot

```
User 1 (Tab)         PresenceHub Server          Redis            User 2 (Tab)    User 3 (Tab)
     |                       |                     |                    |                |
     | Opens Lot #1005        |                     |                    |                |
     |                       |                     |                    |                |
     |--POST /presence/enter->|                     |                    |                |
     |  { lotId, userEmail,  |                     |                    |                |
     |    correlationId }    |                     |                    |                |
     |                       |--HSET lot:1005------>|                    |                |
     |                       |  { corrId: {        |                    |                |
     |                       |    userEmail,       |                    |                |
     |                       |    lastSeen } }     |                    |                |
     |                       |                     |                    |                |
     |                       |--PUBLISH presence:->|                    |                |
     |                       |  updates            |                    |                |
     |                       |  { lotId, users }   |                    |                |
     |                       |                     |                    |                |
     |                       |<--subscriber fires--|                    |                |
     |                       |                     |                    |                |
     |<--SSE presence_update--|----SSE presence_update----------------->|                |
     |  { lotId: "1005",     |    { lotId: "1005", |                    |                |
     |    users: [user1] }   |      users: [user1]}|                    |                |
     |                       |                     |                    |                |
     |<--200 OK--------------|                     |                    |                |
     |                       |                     |                    |                |
     |                       |                     |         User 2 sees badge on Lot #1005
     |                       |                     |                    |                |
```

---

### User Leaves a Lot (Graceful — navigates away or clicks back)

```
User 1 (Tab)         PresenceHub Server          Redis            User 2 (Tab)
     |                       |                     |                    |
     | Navigates away /       |                     |                    |
     | component unmounts    |                     |                    |
     |                       |                     |                    |
     |--POST /presence/leave->|                     |                    |
     |  { lotId, userEmail } |                     |                    |
     |                       |--HDEL lot:1005------>|                    |
     |                       |  (removes corrId)   |                    |
     |                       |                     |                    |
     |                       |--PUBLISH presence:->|                    |
     |                       |  updates            |                    |
     |                       |  { lotId,           |                    |
     |                       |    users: [] }      |                    |
     |                       |                     |                    |
     |                       |<--subscriber fires--|                    |
     |                       |                     |                    |
     |<--SSE presence_update--|----SSE presence_update----------------->|
     |  { lotId: "1005",     |    { lotId: "1005", |                    |
     |    users: [] }        |      users: [] }    |         Badge removed on Lot #1005
     |                       |                     |                    |
```

---

### User Leaves Ungracefully (tab crash / network drop)

```
User 1 (Tab)         PresenceHub Server          Redis            User 2 (Tab)
     |                       |                     |                    |
     | Tab crashes /          |                     |                    |
     | network drops         |                     |                    |
     |  x  x  x  x           |                     |                    |
     |                       |                     |                    |
     |  (heartbeats stop)    |                     |                    |
     |                       |                     |                    |
     |          [3 min]      |                     |                    |
     |          [6 min]      |                     |                    |
     |          ...          |                     |                    |
     |                       |                     |                    |
     |          [15 min — cleanup job runs]        |                    |
     |                       |                     |                    |
     |                       |--HGETALL all lots-->|                    |
     |                       |<--entries-----------|                    |
     |                       |                     |                    |
     |                       | lastSeen > 15 min?  |                    |
     |                       | YES                 |                    |
     |                       |--HDEL lot:1005------>|                    |
     |                       |--PUBLISH----------->|                    |
     |                       |  { lotId,           |                    |
     |                       |    users: [] }      |                    |
     |                       |                     |                    |
     |                       |<--subscriber fires--|                    |
     |                       |                     |                    |
     |                       |----SSE presence_update----------------->|
     |                       |    { lotId: "1005", |         Badge removed on Lot #1005
     |                       |      users: [] }    |                    |
     |                       |                     |                    |
```

---

### Heartbeat (keeps session alive while tab is visible)

```
User 1 (Tab)         PresenceHub Server          Redis
     |                       |                     |
     | Tab is visible         |                     |
     |                       |                     |
     |  [every 3 minutes]    |                     |
     |                       |                     |
     |--POST /presence/------>|                     |
     |  heartbeat            |                     |
     |  { lotId, userEmail } |                     |
     |                       |--HSET lot:1005------>|
     |                       |  (updates lastSeen) |
     |                       |                     |
     |<--200 OK--------------|                     |
     |                       |                     |
     | Tab goes to background |                     |
     |  (heartbeats stop)    |                     |  lastSeen no longer updated
     |                       |                     |  cleanup will remove after 15 min
     |                       |                     |
     | Tab comes back        |                     |
     |--POST /presence/enter->|                     |  re-registers immediately
     |  (heartbeats resume)  |                     |
     |                       |                     |
```
