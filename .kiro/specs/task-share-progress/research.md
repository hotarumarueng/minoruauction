# Research & Design Decisions

---

## Summary
- **Feature**: `task-share-progress`
- **Discovery Scope**: New Feature (Greenfield) / Complex Integration
- **Key Findings**:
  - Yahoo Auction dedicated API was terminated in January 2020; Req 2.4 and 3.6 are deferred
  - Lambda `go1.x` runtime is deprecated; use `provided.al2023` with ARM64 for new projects
  - Amazon SNS supports FCM HTTP v1 API as of January 2024 (Legacy API discontinued June 2024)

---

## Research Log

### Yahoo Auction API Availability
- **Context**: Requirements 2.4 and 3.6 assumed a Yahoo Auction API for fetching current price and highest-bidder status
- **Sources Consulted**: developer.yahoo.co.jp/changelog/auctions.html
- **Findings**:
  - Yahoo Auction Web API was terminated January 2020 (announced October 2019)
  - Current Yahoo! Developer Network provides Shopping API (merchant-oriented) and Yahoo! ID Federation; neither supports auction bid status monitoring for buyers
  - No official read endpoint for "current highest bidder confirmation" is available
  - Web scraping violates Yahoo Terms of Service and risks account suspension
- **Implications**:
  - Req 2.4 ("fetch current price and highest bidder via Yahoo Auction API") and Req 3.6 ("最高入札中 badge via API") are **deferred / out of scope**
  - The auction URL stored in the task remains a deep-link that the user taps to open Yahoo Auction directly in a browser
  - Status updates remain fully manual (1-tap) — this aligns with the core UX goal

### AWS Lambda Go Runtime
- **Context**: Backend is implemented in Go; need the correct runtime identifier for AWS Lambda
- **Sources Consulted**: docs.aws.amazon.com/lambda/latest/dg/lambda-golang.html
- **Findings**:
  - `go1.x` managed runtime is **deprecated** (end-of-support: pre-2026)
  - `provided.al2023` is the current recommendation (support until June 30 2029)
  - Build target: `GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="-s -w" -o bootstrap`
  - Executable must be named `bootstrap`
  - ARM64 (Graviton3) is recommended: ~20% cheaper and faster than x86_64
- **Implications**:
  - All Lambda functions use `Runtime: provided.al2023`, `Architecture: arm64`
  - CDK configuration and CI/CD pipeline must cross-compile for `arm64`

### Amazon SNS + FCM v1 Push Notifications
- **Context**: Push notifications from Lambda → mobile devices via SNS
- **Sources Consulted**: aws.amazon.com/about-aws/whats-new/2024/01/amazon-sns-fcm-http-v1-api-mobile-notifications
- **Findings**:
  - SNS supports FCM HTTP v1 API since January 18 2024 (Android) and March 26 2024 (Apple/Webpush)
  - FCM Legacy API discontinued June 20 2024; new integrations must use v1
  - Authentication: Service Account JSON (replaces API Key)
  - SNS payload key: `fcmV1Message`
  - SNS pricing: $0.50 per 1M mobile push deliveries (negligible for 2 users)
- **Implications**:
  - Platform Application must be created with Service Account JSON credential
  - Each device registers its FCM token as an SNS Platform Endpoint (EndpointArn)
  - Token refresh is handled by re-calling `/rooms/{roomId}/token` on app launch

---

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Decision |
|--------|-------------|-----------|---------------------|----------|
| Lambda + API GW HTTP API + DynamoDB | Serverless REST + managed NoSQL | Zero server management, free tier sufficient for 2 users, Go runtime fits | Cold start (~100ms on ARM64 with pre-warming not needed at this scale) | **Selected** |
| WebSocket (API GW WebSocket API) | Persistent bi-directional connection | True real-time | More complex connection lifecycle management; polling is sufficient for 2 users | Rejected |
| EC2 / ECS | Always-on container | No cold start | Overkill, cost, ops overhead | Rejected |
| Firebase (non-AWS) | Google BaaS | Easier real-time | Conflicts with requirement to use AWS | Rejected |

---

## Design Decisions

### Decision: Push from Lambda Handler (not DynamoDB Streams)
- **Context**: When to trigger push notifications after a task status change
- **Alternatives Considered**:
  1. DynamoDB Streams → Lambda Trigger → SNS (event-driven, decoupled)
  2. Direct SNS Publish inside the TaskHandler Lambda (synchronous, simpler)
- **Selected Approach**: Option 2 — TaskHandler calls SNS directly after DynamoDB write
- **Rationale**: 2-user app with low volume; event-driven pipeline adds latency and operational complexity with no benefit at this scale
- **Trade-offs**: Slightly tighter coupling between handler and notification logic; acceptable given fixed 2-user scope

### Decision: Role stored in Room (not derived from token)
- **Context**: Distinguishing "father" (requester) from "assignee" when sending targeted push notifications
- **Alternatives Considered**:
  1. Derive role from creation order (first = father)
  2. Explicit `role` field passed at join time
- **Selected Approach**: Option 2 — explicit `role: "father" | "assignee"` in the join request
- **Rationale**: Clearer intent; avoids edge cases if room is recreated; maps directly to notification targeting logic

### Decision: Polling over WebSocket
- **Context**: Keeping task list up-to-date without push notification tap
- **Selected Approach**: 30-second interval polling from the task list screen
- **Rationale**: 2 users with low event frequency; polling is simpler, stateless, and free tier sufficient

---

## Risks & Mitigations

- **Yahoo API unavailable** → Manual status update only; auction URL is a tap-to-open deep link. Deferred to future if Yahoo reopens a public API or a scraping-free solution emerges.
- **FCM device token expiry** → App re-registers token on every launch via `PATCH /rooms/{roomId}/token`; stale tokens result in silent notification failure (non-critical for 2 users who will notice the missed tap quickly)
- **Room ID brute-force** → 6-char alphanumeric (36^6 ≈ 2.1B combinations) is sufficient for private 2-user use; rate-limit the `/rooms/{id}/join` endpoint (429 after 5 attempts per IP per minute)

---

## References
- [Yahoo Auction API End-of-Service Notice](https://developer.yahoo.co.jp/changelog/auctions.html)
- [Lambda Go Runtime Docs](https://docs.aws.amazon.com/lambda/latest/dg/lambda-golang.html)
- [Amazon SNS FCM v1 Support Announcement](https://aws.amazon.com/about-aws/whats-new/2024/01/amazon-sns-fcm-http-v1-api-mobile-notifications)
- [SNS FCM v1 Payload Reference](https://docs.aws.amazon.com/sns/latest/dg/sns-fcm-v1-payloads.html)
