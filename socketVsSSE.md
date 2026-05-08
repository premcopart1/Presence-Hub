1. Data flow is inherently one-way
  Presence updates only ever go server → client. WebSockets provide
  bi-directional communication that you simply don't need — you'd be adding
  complexity for a capability you'll never use.

  2. Client actions are infrequent REST calls
  enter, leave, and heartbeat are rare, low-frequency POST requests. There's
   no need to send them over a persistent socket — plain HTTP handles them
  fine.

  3. SSE auto-reconnects; WebSockets don't
  EventSource has built-in reconnection logic. With WebSockets, you'd have
  to write and maintain your own reconnect, backoff, and error handling
  logic.

  4. SSE is just HTTP — no infrastructure risk
  WebSockets require a protocol upgrade (ws://) that can be blocked by
  corporate proxies, load balancers, or firewalls. SSE works everywhere HTTP
   works, which matters in an enterprise environment like Copart's.

  5. Simpler to scale with Redis pub/sub
  The Redis pub/sub fan-out pattern works cleanly with SSE. Each server
  instance holds its own clients Set and broadcasts to them when Redis
  fires. WebSockets would work similarly but add protocol-level complexity
  for no benefit.

  6. Lower operational overhead
  SSE is text-based HTTP — easier to debug, log, and monitor. WebSockets
  have binary framing and require more specialized tooling to inspect.

  The one real trade-off is ungraceful tab close (crash/network drop), but
  the 15-minute heartbeat timeout is an acceptable UX trade-off for an
  informational-only presence indicator.