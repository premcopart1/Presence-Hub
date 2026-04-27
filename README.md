# PresenceHub

Real-time presence microservice — shows which users are viewing/working on which lots.

## Architecture

```
React POC UI (port 5173)
     |  SSE + REST
     v
Presence Service - Node.js/Express (port 4000)
     |  Pub/Sub + State
     v
Redis (port 6379)
```

## Quick Start

### Option 1: Docker (recommended)

```bash
# Start Redis + Presence Service
docker-compose up --build

# In a separate terminal, start the POC UI
cd poc-ui
npm install
npm run dev
```

Open http://localhost:5173

### Option 2: Run locally without Docker

**Start Redis**
```bash
# macOS
brew install redis && brew services start redis

# or via Docker just for Redis
docker run -p 6379:6379 redis:7-alpine
```

**Start Presence Service**
```bash
cd presence-service
npm install
npm run dev
```

**Start POC UI**
```bash
cd poc-ui
npm install
npm run dev
```

Open http://localhost:5173

---

## Testing Presence

1. Open http://localhost:5173 in **Tab 1** — enter `alice@example.com`
2. Open http://localhost:5173 in **Tab 2** — enter `bob@example.com`
3. In Tab 1, click on a lot — Tab 2 home page should show Alice's badge on that lot
4. Click the same lot in Tab 2 — both should see each other in the "Also viewing" banner
5. Switch Tab 1 to background — Alice disappears after ~15 min (heartbeat timeout)
6. Close Tab 1 — Alice is immediately removed

---

## Environment Variables

### presence-service/.env
| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Service port |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `LOG_LEVEL` | `debug` | Winston log level (debug/info/warn/error) |
| `STALE_TIMEOUT_MS` | `900000` | 15 min — inactivity before session expires |
| `CLEANUP_INTERVAL_MS` | `300000` | 5 min — how often stale cleanup runs |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |

### poc-ui/.env
| Variable | Default | Description |
|---|---|---|
| `VITE_PRESENCE_SERVICE_URL` | `http://localhost:4000` | Presence service URL |

---

## API Reference

| Method | Endpoint | Body / Params | Description |
|---|---|---|---|
| `POST` | `/presence/enter` | `{ lotId, userEmail }` | User opens a lot |
| `POST` | `/presence/leave` | `{ lotId, userEmail }` | User leaves a lot |
| `POST` | `/presence/heartbeat` | `{ lotId, userEmail }` | Keep-alive (every 3 min) |
| `GET` | `/presence/lot/:lotId` | — | Get all users on a lot |
| `GET` | `/presence/lots?lotIds=1,2,3` | — | Batch fetch presence |
| `GET` | `/presence/stream` | — | SSE stream |
| `GET` | `/health` | — | Health check |

All requests should include `X-Correlation-ID` header for tracing.

---

## Integrating into Your Existing React App

Copy from `poc-ui/src/`:
- `hooks/usePresence.js` — all presence logic
- `components/LotPresenceBadge.jsx` — home page badge
- `components/LotPresenceBanner.jsx` — lot detail banner

Set env var:
```
VITE_PRESENCE_SERVICE_URL=https://your-presence-service-url
```

In your app root — start SSE connection:
```jsx
import { createSSEConnection } from './hooks/usePresence';

useEffect(() => {
  const es = createSSEConnection(({ lotId, users }) => {
    // update your state
  });
  return () => es.close();
}, []);
```

On home page — add badge next to each lot:
```jsx
<LotPresenceBadge users={presenceMap[lot.id] ?? []} />
```

On lot detail page — add banner:
```jsx
<LotPresenceBanner lotId={lotId} userEmail={currentUserEmail} presenceMap={presenceMap} />
```
>>>>>>> 372a1bf (Presence Hub Initial Commit)
