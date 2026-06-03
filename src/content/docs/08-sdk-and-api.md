# memQL — gRPC API & SDK

memQL exposes a single primary wire surface: one multiplexed bidirectional gRPC stream, `MemqlService.Stream`. Every client operation — graph queries, change subscriptions, MCP tool calls, SI (synthetic intelligence) chat/speech/transcription, identity and delegation management, language-intelligence (Sense) requests, guest invites, worker-token minting, policy evaluation, and in-stream auth rotation — rides as a `oneof` payload on that one stream. HTTP exists only for the handful of operations that physically cannot be gRPC (OAuth/magic-link redirects, health probes, WebSocket upgrades, multipart file uploads). Browsers reach the same stream through a WebSocket bridge that tunnels protojson-encoded frames to the gRPC service. Cross-node traffic in cluster mode rides a second internal stream, `NodeService.Stream`. This document is the reference for that wire surface and the first-party Go and TypeScript SDKs that wrap it.

This describes memQL as of the current `main` branch (`VERSION` `0.9.14`). It is a snapshot.

---

## 1. The gRPC-first policy

gRPC is the **default and required** protocol for all internal and service-to-service endpoints. The policy (defined in the top-level project documentation) is enforced by a decision tree:

1. **Service-to-service call** (frontend → memQL, bridge agent → memQL) → **must be gRPC**; add a message type to `memql.proto`.
2. **Consumed by a browser** → route through the WebSocket bridge (`/memql/ws`), which tunnels to `MemqlService.Stream` — still gRPC under the hood.
3. **External protocol requires HTTP** (OAuth callbacks, webhooks) → HTTP allowed as a documented exception.
4. **When in doubt** → default to gRPC.

### Allowed HTTP exceptions

| Category | Endpoints | Reason |
|----------|-----------|--------|
| Auth (identity service) | `/auth/login`, `/auth/magic-link`, `/auth/complete`, `/auth/logout`, `/oauth/token`, `/auth/refresh`, `/.well-known/jwks.json` | OAuth 2.0 / magic-link needs redirects, form posts, JWKS publishing |
| Health check | `/healthz` | Docker / Cloud Run probes expect HTTP GET |
| WebSocket upgrades | `/memql/ws`, `/memql/audio` | Browsers need HTTP upgrade to establish WebSocket |
| File uploads | `/spaces/{id}/attachments` | Multipart form-data maps poorly to gRPC |

The legacy SI HTTP path (`/si/*`) has been **retired**. `AIHTTPPaths()` is now an empty stub kept only so callers that walked the path list compile:

```go
// AIHTTPPaths used to return the legacy /si/* HTTP endpoints. All of
// them have been retired in favour of MemqlService.Stream with
// SIChatMsg / SISpeechMsg / SITranscribeMsg / SISuggestMsg.
func AIHTTPPaths() []string {
	return nil
}
```
*Source: `component/server/nethttp.go`*

There is one additional HTTP affordance: an HTTP→gRPC **query gateway** at `POST /memql/query` (`component/grpc/gateway.go`), which accepts a protojson `ExecuteQueryMsg` body, opens a one-shot gRPC stream internally, runs the query, and returns the JSON result. It is a convenience bridge for HTTP-only callers, not part of the streaming surface.

---

## 2. The primary stream: `MemqlService.Stream`

The service definition is a single RPC:

```proto
package znasllc.memql.v1;

service MemqlService {
  // Single multiplexed bidirectional streaming RPC for all MemQL operations.
  rpc Stream(stream MemqlClientMessage) returns (stream MemqlServerMessage);
}
```
*Source: `component/grpc/memql.proto`*

### 2.1 Envelopes

Every message in either direction is one of two envelope types, each carrying a `message_id`, a `correlate_to` field for matching replies to requests, a `metadata` string map, and a `oneof payload`. The client envelope additionally carries an optional `Provenance` field used for cross-node attribution propagation.

```proto
message MemqlClientMessage {
  string message_id = 1;
  string correlate_to = 2;
  map<string, string> metadata = 3;
  reserved 4;
  reserved "partition";          // partition now arrives via gRPC metadata / auth, not the envelope
  Provenance provenance = 100;   // caller-stamped origin for cross-node propagation

  oneof payload { /* ... ~40 request types ... */ }
}

message MemqlServerMessage {
  string message_id = 1;
  string correlate_to = 2;
  map<string, string> metadata = 3;

  oneof payload { /* ... ~40 reply types ... */ }
}
```
*Source: `component/grpc/memql.proto`*

`Provenance` is the engine-stamped origin metadata persisted as an intrinsic on every graph row. Carrying it on the envelope lets cross-node forwarders propagate the originating attribution across hops:

```proto
message Provenance {
  string kind    = 1;   // seed | mutation | automation | direct | system | migration
  string name    = 2;
  string trigger = 3;
  string via     = 4;
}
```
*Source: `component/grpc/memql.proto`*

### 2.2 Stream lifecycle

The server loop authenticates the stream from context, creates a per-stream session, emits a session-opened event, and then dispatches each received message:

```go
func (s *service) Stream(stream memqlv1.MemqlService_StreamServer) error {
	identity, err := auth.UserIdentityFromContext(stream.Context())
	if err != nil {
		return status.Error(codes.Unauthenticated, "authentication required")
	}
	requestMeta := extractRequestMeta(stream.Context())
	session := newStreamSession(s, stream, identity)
	session.requestMeta = requestMeta
	healthsrv.StreamOpened()                                  // blue/green drain accounting
	s.publishSessionEvent(events.TopicSessionOpened, events.KindSessionOpened, identity)
	defer func() {
		healthsrv.StreamClosed()
		session.shutdown()
		s.publishSessionEvent(events.TopicSessionClosed, events.KindSessionClosed, identity)
	}()
	for {
		msg, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		if err := session.handleMessage(msg); err != nil {
			return err
		}
	}
}
```
*Source: `component/grpc/server.go`*

Each open `Stream` counts toward `/healthz` drain accounting so blue/green cutover can keep an old-color pod alive until its connections drain to zero.

### 2.3 Handshake

The first exchange is `ClientHello` → `ServerHello`. The server reports its node id and version:

```proto
message ClientHello {
  string client_id = 1;
  string sdk_name = 2;
  string sdk_version = 3;
}

message ServerHello {
  string node_id = 1;
  string version = 2;
}
```
*Source: `component/grpc/memql.proto`*

Control-plane messages also include `HeartbeatMsg` (timestamped liveness) and `AckMsg` (echoes an `acked_message_id`).

### 2.4 Dispatch

`handleMessage` switches on the `oneof` payload type and routes to a per-message handler. The full routing table (abridged):

```go
switch payload := payload.(type) {
case *memqlv1.MemqlClientMessage_ClientHello:        return s.handleClientHello(...)
case *memqlv1.MemqlClientMessage_ExecuteQuery:       return s.handleExecuteQuery(...)
case *memqlv1.MemqlClientMessage_CancelRequest:      return s.handleCancelRequest(...)
case *memqlv1.MemqlClientMessage_Subscribe:          return s.handleSubscribe(...)
case *memqlv1.MemqlClientMessage_Unsubscribe:        return s.handleUnsubscribe(...)
case *memqlv1.MemqlClientMessage_ListTools:          return s.handleListTools(...)
case *memqlv1.MemqlClientMessage_CallTool:           return s.handleCallTool(...)
case *memqlv1.MemqlClientMessage_ClientToolResult:   return s.handleClientToolResult(...)
case *memqlv1.MemqlClientMessage_SiChat:             return s.handleAiChat(...)
case *memqlv1.MemqlClientMessage_SiSpeech:           return s.handleAiSpeech(...)
case *memqlv1.MemqlClientMessage_SiTranscribe:       return s.handleAiTranscribe(...)
case *memqlv1.MemqlClientMessage_SiSuggest:          return s.handleAiSuggest(...)
case *memqlv1.MemqlClientMessage_SenseTokenize:      return s.handleSenseTokenize(...)
case *memqlv1.MemqlClientMessage_MyAccess:           return s.handleMyAccess(...)
case *memqlv1.MemqlClientMessage_EvaluatePolicy:     return s.handleEvaluatePolicy(...)
case *memqlv1.MemqlClientMessage_RotateAuth:         return s.handleRotateAuth(...)
case *memqlv1.MemqlClientMessage_ConceptsList:       return s.handleConceptsList(...)
case *memqlv1.MemqlClientMessage_AgentGenerateTurn:  return s.handleAgentGenerateTurn(...)
case *memqlv1.MemqlClientMessage_SendGuestInvite:    return s.handleSendGuestInvite(...)
// ... guest, session-revocation, worker-token, voice-agent cases ...
}
```
*Source: `component/grpc/server.go`*

Note the wire field names use the `Si*` Go identifier prefix (`SiChat`, `SiSpeech`, …) while the handler methods are named `handleAi*` — the proto messages are `SIChatMsg` etc. ("SI" = synthetic intelligence in the public naming).

---

## 3. Message-type reference

The two `oneof`s are the contract. Below is the full request/reply catalog, grouped by function. Field numbers and shapes are from `component/grpc/memql.proto`.

### 3.1 Queries

```proto
message ExecuteQueryMsg {
  string request_id = 1;
  string query = 2;                       // a named MemQL primitive call, e.g. queryActiveSpaces({})
  google.protobuf.Struct variables = 3;
  string client_id = 4;                   // echoed back for optimistic-update reconciliation
}

message QueryResultChunk { string request_id = 1; Result result = 2; bool done = 3; }
message QueryErrorMsg    { string request_id = 1; QueryError error = 2; }
message CancelRequestMsg { string request_id = 1; }
```

Results carry a graph bundle, a flat data list, and pagination/perf metadata:

```proto
message Result   { GraphBundle bundle = 1; repeated google.protobuf.Value data = 2; ResultMeta meta = 3; }
message ResultMeta {
  optional int64 count = 1;  bool has_more = 2;  string cursor = 3;  int64 took_ms = 4;
  string client_id = 5;  string server_id = 6;  int64 version = 7;
}
message GraphBundle { repeated MemoryNode nodes = 1; repeated GraphEdge edges = 2; repeated string root_ids = 3; }
message MemoryNode  {
  string id = 1; string concept = 2; string type = 3; string created_by = 4;
  google.protobuf.Timestamp created_at = 5; google.protobuf.Struct payload = 6;
  google.protobuf.Struct schema = 7; google.protobuf.Struct metadata = 9; Provenance provenance = 10;
}
```
*Source: `component/grpc/memql.proto`*

### 3.2 Subscriptions (change data capture / events)

```proto
message SubscribeMsg   { string subscription_id = 1; SubscriptionKind kind = 2; string filter = 3; google.protobuf.Struct config = 4; }
message UnsubscribeMsg { string subscription_id = 1; }
message EventNotification { string subscription_id = 1; EventKind kind = 2; google.protobuf.Timestamp ts = 3; google.protobuf.Struct payload = 4; }
```

`SubscriptionKind` selects the event stream: `TELEMETRY` (100), `MESSAGE` (200), `QUERY_SPEC` (300), `AI_STREAM` (400), `GRAPH_EVENTS` (500), `DOMAIN_EVENTS` (550), `AUTOMATION_EVENTS` (600), `ALL` (700). `EventKind` enumerates the concrete event types delivered — graph node created/updated/deleted (301–303), AI completion lifecycle (501–503), session opened/closed (600–601), automation lifecycle (700–705), and MCP tool lifecycle (800–802). *Source: `component/grpc/memql.proto`*

Subscription filters that send a `*` partition wildcard are rewritten server-side to the caller's authorized partitions by the subscribe handler — a subscriber cannot observe another tenant's events.

### 3.3 MCP tools (Model Context Protocol compatible)

memQL's tool surface is MCP-shaped. Tools can be **server-executed** or **client-executed** (run in the browser).

```proto
message ListToolsMsg    { string request_id = 1; string cursor = 2; }
message ListToolsResult { string request_id = 1; repeated ToolDefinition tools = 2; string next_cursor = 3; }

message ToolDefinition {
  string name = 1;
  string description = 2;
  string input_schema = 3;       // JSON Schema as a string
  bool client_execution = 4;     // true => executed by the connected client, not the backend
  repeated string scopes = 5;    // required scopes; caller's granted set must be a superset
}

message CallToolMsg    { string request_id = 1; string name = 2; google.protobuf.Struct arguments = 3; }
message CallToolResult { string request_id = 1; repeated ToolResultContent content = 2; bool is_error = 3; }
message ToolResultContent { string type = 1; string text = 2; string mime_type = 3; string data = 4; string uri = 5; }
```
*Source: `component/grpc/memql.proto`*

**Client-executed tools** invert the call direction. When the agent loop resolves a tool with `client_execution=true`, the server emits a `ClientToolCall` on the stream and parks the loop on a per-call channel keyed by `call_id`. The client dispatches the tool against its local operator and replies with `ClientToolResult`:

```proto
message ClientToolCall {
  string call_id = 1;        // correlation id; routes the matching result back to the parked call
  string turn_id = 2;        // owning AgentGenerateTurn (for per-turn progress / cancel)
  string agent_id = 3;
  string tool_name = 4;
  string arguments_json = 5;
  int32 timeout_ms = 6;      // server's wait budget; client should reply is_error rather than time out
}
message ClientToolResult {
  string call_id = 1;
  repeated ToolResultContent content = 2;
  bool is_error = 3;
  string error_message = 4;
}
```
*Source: `component/grpc/memql.proto`*

### 3.4 SI operations (chat, speech, transcription, suggest)

All SI operations live on the stream. The `provider` field overrides the configured default per-request.

```proto
message SIChatMsg    { string request_id = 1; repeated SIChatMessage messages = 2; string provider = 3; bool stream = 4; }
message SIChatMessage{ string role = 1; string content = 2; string name = 3; }
message SIChatResult { string request_id = 1; SIChatMessage message = 2; }

message SISpeechMsg    { string request_id = 1; string input = 2; string voice = 3; string format = 4; string provider = 5; }
message SISpeechResult { string request_id = 1; bytes audio = 2; string format = 3; }

message SITranscribeMsg    { string request_id = 1; string audio = 2; string mime_type = 3; }   // batch
message SITranscribeResult { string request_id = 1; string text = 2; }

message SISuggestMsg    { string request_id = 1; string domain = 2; google.protobuf.Struct payload = 3; }
message SISuggestResult { string request_id = 1; string domain = 2; google.protobuf.Struct result = 3; }
```
*Source: `component/grpc/memql.proto`*

Streaming chat (`SIChatMsg.stream=true`) emits `SIStreamChunk` messages carrying a `text_delta` / `json_delta` / `metadata` `oneof` and a terminal `done` flag.

**Streaming transcription** is a multi-message flow keyed by a shared `request_id`. The client opens a session, pushes audio chunks, and closes; the server replies with repeated deltas and a terminal complete:

```proto
// client -> server
message SITranscribeStreamStart { string request_id = 1; string format = 2; int32 sample_rate = 3; int32 channels = 4; string language_hint = 5; string provider = 6; }
message SITranscribeStreamChunk { string request_id = 1; bytes audio = 2; }
message SITranscribeStreamEnd   { string request_id = 1; bool cancel = 2; }   // cancel=true aborts without Complete

// server -> client
message SITranscribeStreamDelta    { string request_id = 1; string text = 2; bool is_final = 3; float confidence = 4; }  // text is full accumulated transcript
message SITranscribeStreamComplete { string request_id = 1; string text = 2; int64 duration_ms = 3; string provider = 4; }
```
*Source: `component/grpc/memql.proto`*

SI errors carry a short trace id (format `ERR-{6 hex}`) generated server-side and returned in error metadata under `errorId`:

```go
func generateErrorId() string {
	b := make([]byte, 3)
	_, _ = rand.Read(b)
	return fmt.Sprintf("ERR-%x", b)
}
```
*Source: `component/grpc/si_handlers.go`*

**BFF proxying.** On a BFF binary, SI handlers forward the envelope to a worker peer (Agent by default) rather than executing locally; the wire protocol to the client is unchanged because responses arrive as standard `MemqlServerMessage` payloads on the same stream. Worker binaries short-circuit and execute locally:

```go
func (s *streamSession) handleAiChat(envelope *memqlv1.MemqlClientMessage, msg *memqlv1.SIChatMsg) error {
	// ...
	if s.shouldProxySI(nodeTargetForChat()) {
		return s.proxySI(envelope, requestId, nodeTargetForChat())
	}
	// ... execute locally ...
}
```
*Source: `component/grpc/si_handlers.go`*

### 3.5 Agent turn generation

Cognition asks an agent node to generate one conversational turn. The request ships to the agent peer via `NodeService` (see §6); replies stream back as deltas terminated by a single complete:

```proto
message AgentGenerateTurnMsg { /* request_id, acting agent identity, messages,
                                  routing context, space context, attachments */ }
message AgentGenerateTurnDelta { /* text delta | tool call | tool result */ }
message AgentGenerateTurnComplete { /* final text, citations, retrieved chunks, error */ }
message AgentTurnCitation { /* domainId, matchedPhrase — knowledge-domain provenance */ }
```
*Source: `component/grpc/memql.proto`* (see `AgentGenerateTurnMsg` … `AgentTurnError`, fields ~1111–1361)

### 3.6 Identity & delegation

```proto
message IdentityCreateMsg { string request_id = 1; string type = 2; /* human|synthetic */ string first_name = 4; ... UserRole role = 10; ... }
message IdentityUpdateMsg { string request_id = 1; string identity_id = 2; google.protobuf.Struct fields = 3; }
message IdentityListMsg   { string request_id = 1; string type = 2; string guardian_identity_id = 3; bool active_only = 4; }
message IdentityResult    { string request_id = 1; bool success = 2; string error = 3; repeated IdentityInfo identities = 4; }

message DelegationCreateMsg { string request_id = 1; string identity_id = 2; string agent_id = 3; UserRole role_ceiling = 4; repeated string scopes = 5; google.protobuf.Timestamp expires_at = 6; string note = 7; }
message DelegationRevokeMsg { string request_id = 1; string delegation_id = 2; }
message DelegationListMsg   { string request_id = 1; string agent_id = 2; string identity_id = 3; bool active_only = 4; }
message DelegationResult    { string request_id = 1; bool success = 2; string error = 3; repeated DelegationInfo delegations = 4; }
```

`UserRole` is the cluster-wide role enum: `OWNER` (1), `ADMIN` (2), `WRITER` (3), `READER` (4). *Source: `component/grpc/memql.proto`*

### 3.7 MemQL Sense (language intelligence)

The language service for `.memql` files — the IDE backend for memql-cockpit and editor tooling. Pure Go, no gRPC dependency in the core (`component/memql/sense/`), surfaced via these messages:

```proto
message SenseTokenizeMsg / SenseTokenizeResult        // semantic tokens for syntax highlighting
message SenseCompleteMsg / SenseCompleteResult        // context-aware completion items
message SenseDiagnoseMsg / SenseDiagnoseResult        // errors + warnings (SenseDiagnostic, SenseSeverity)
message SenseHoverMsg / SenseHoverResult              // markdown symbol info at a position
message SenseSignatureHelpMsg / SenseSignatureHelpResult  // call-argument parameter help
```

Positions are 1-indexed `{line, column}` (`SensePosition` / `SenseRange`). *Source: `component/grpc/memql.proto`*

### 3.8 Concepts (schema metadata)

```proto
message ConceptsListMsg    { string request_id = 1; }
message ConceptsListResult { string request_id = 1; repeated ConceptInfo concepts = 2; repeated string base_topics = 3; repeated string system_topics = 4; }
message ConceptInfo        { string id = 1; string version = 2; string domain = 3; string entity = 4; string description = 5; string type = 6; DisplayCard display_card = 7; }
message DisplayCard        { string primary = 1; string secondary = 2; string tertiary = 3; string status = 4; }

message ConceptsSubscribeMsg    { string request_id = 1; repeated string domains = 2; }
message ConceptsSubscribeResult { string request_id = 1; repeated DomainSubscription domains = 2; }
message DomainSubscription      { string domain = 1; repeated string filters = 2; }
```

`handleConceptsList` walks the concept registry, splits each concept id into version/domain/entity, and attaches the `@displayCard(...)` rendering hints when declared so concept-agnostic clients can render row cards uniformly. `handleConceptsSubscribe` returns CDC subscription filters (`node.created.<concept>`) grouped by domain. *Source: `component/grpc/concepts_handlers.go`*

### 3.9 Access / authorization

```proto
message MyAccessMsg    { string request_id = 1; }
message MyAccessResult { string request_id = 1; string user_id = 2; string primary_email = 3; UserRole cluster_role = 4; }
```
*Source: `component/grpc/memql.proto`* — backs cockpit's "My Access" view.

### 3.10 Guest invitations

A guest-invite flow spanning authenticated and unauthenticated calls:

```proto
message SendGuestInviteMsg / SendGuestInviteResult              // authenticated owner mints token + sends email
message ResolveGuestInviteMsg / ResolveGuestInviteResult        // public; /join/<token> page renders space + inviter metadata
message JoinSpaceAsGuestMsg / JoinSpaceAsGuestResult            // guest accepts + participant-create (auth: Guest <token>)
message CancelGuestInviteMsg / CancelGuestInviteResult          // inviter revoke
message ResendGuestInviteEmailMsg / ResendGuestInviteEmailResult
```
*Source: `component/grpc/memql.proto`; handlers in `component/grpc/guest_handlers.go`*

Only the SHA-256 hash of the token is persisted. Guest authentication uses `Authorization: Guest <token>`, resolved by `NewGuestAwareStreamInterceptor` (`component/grpc/guest_stream_interceptor.go`); the WebSocket bridge accepts it as `?guest_token=<token>` because browsers cannot set custom headers on the upgrade.

### 3.11 Session revocation & worker tokens

```proto
message RevokeCurrentSessionMsg / RevokeCurrentSessionResult    // per-device sign-out
message RevokeAllSessionsMsg / RevokeAllSessionsResult          // cross-device sign-out

message CreateWorkerTokenMsg / CreateWorkerTokenResult          // mint mql_wkr_<...>; plaintext returned ONCE
message RevokeWorkerTokenMsg / RevokeWorkerTokenResult          // soft-delete (active=false)
```
*Source: `component/grpc/memql.proto`; handlers in `component/grpc/worker_token_handlers.go`*

### 3.12 Voice agent (realtime voice + video)

The Python/Go voice-agent process speaks a dedicated message group over the same stream, authenticated as a service account that the `voice_agent_stream_interceptor` pins to exactly this surface (it has no direct graph-write surface):

```proto
// client -> server
VoiceAgentSessionStart / SessionEnd
VoiceAgentPartialTranscript / VoiceAgentFinalTranscript
VoiceAgentTurnRequest                  // ask the General Assistant to respond
VoiceAgentRealtimeOutput               // realtime-executor output capture (#437)

// server -> client
VoiceAgentSessionAck
VoiceAgentPartialAck / VoiceAgentFinalAck
VoiceAgentTurnDelta / VoiceAgentTurnComplete
VoiceAgentSpeak                        // server-pushed "speak this text"
VoiceAgentRealtimeOutputAck
```
*Source: `component/grpc/memql.proto`; handlers in `component/grpc/voice_agent_handlers.go`*

### 3.13 Polyphon (multi-agent voice control plane)

```proto
message PolyphonRoomTokenMsg / PolyphonRoomTokenResult    // LiveKit room token (token, room_name, livekit_url, expires_at)
message PolyphonStatusMsg / PolyphonStatusResult          // score-engine health + active session count
message PolyphonUtteranceMsg / PolyphonUtteranceResult    // insert a human utterance from the voice pipeline
```
*Source: `component/grpc/memql.proto`; handlers in `component/grpc/polyphon_handlers.go`*

### 3.14 Policy evaluation & in-stream auth rotation

```proto
message EvaluatePolicyMsg / EvaluatePolicyResult   // runtime invocation of a func (Policy); requires @frontend_visible AND tier=bff
message RotateAuthMsg / RotateAuthResult           // swap the bearer on a live stream without tearing it down
```

`EvaluatePolicy` rejects anything that is not both `@frontend_visible` and `tier=bff` — a browser cannot reach `core/auth` or `core/partition` decisions. `RotateAuth` lets long-lived clients (cockpit) keep an in-flight session's bearer aligned with their background refresh; on rejection the result carries an RFC-6749-shaped `error`/`error_description` and the stream stays open. *Source: `component/grpc/memql.proto`, `component/grpc/server.go`*

---

## 4. The WebSocket bridge (`/memql/ws`)

Browsers cannot speak raw gRPC, so memQL ships a WebSocket→gRPC bridge at `/memql/ws`. The handler (`component/server/memqlws/handler.go`) upgrades the connection, dials the local gRPC endpoint, sends a `ClientHello` on the client's behalf, and then shuttles protojson-encoded `MemqlClientMessage` / `MemqlServerMessage` frames in both directions. It is the same stream — the same `oneof` payloads — just JSON-on-WebSocket instead of protobuf-on-HTTP/2.

Key behaviors:

- **Encoding:** frames are protojson; the read loop unmarshals into `MemqlClientMessage`, the write loop marshals server messages with `EmitUnpopulated: true`.
- **Auth:** the bridge forwards credentials as gRPC metadata. It prefers the `Authorization` header, then falls back to query parameters, and accepts a guest invitation token as `?guest_token=<token>`:

```go
} else if guest := strings.TrimSpace(r.URL.Query().Get("guest_token")); guest != "" {
	// invitation token as ?guest_token=<token> since WebSocket
	// browsers cannot set custom Authorization headers on the upgrade.
	md.Append(...)
}
```
*Source: `component/server/memqlws/handler.go`*

- **Origin allow-list:** `OriginPatterns` (from `MEMQL_WEBSOCKET_ORIGIN_PATTERNS`) gates which `Origin` values may upgrade, passed verbatim to the websocket library's shell-glob matcher. Empty falls back to a permissive wildcard with a WARN log.
- **Backpressure / limits:** per-session caps on concurrent in-flight requests (default 4), pending requests (default 64), max message size (default 5 MiB), buffered local errors (default 256), plus a ping keepalive (default 30s). The bridge demuxes request ids, tracks cancellation, and emits local error frames when overloaded.

A second WebSocket endpoint, `/memql/audio` (`component/server/audiows/handler.go`), serves the voice-first creation-modal audio path.

---

## 5. Authentication & stream interceptors

The gRPC server stacks several stream interceptors, each scoped to a credential class and a message surface. The base path verifies an identity-service-issued JWT locally (the per-node verifier fetches JWKS on a background refresh) and populates a `UserIdentity` in context, which `Stream` reads. Specialized interceptors layer on top:

| Interceptor | Credential | Scope |
|-------------|-----------|-------|
| (base verifier) | `Authorization: Bearer <JWT>` | full stream surface, per-partition ACL enforced |
| `guest_stream_interceptor.go` | `Authorization: Guest <token>` | guest claim (`identity.guest`); subject `guest:<invitationId>` |
| `service_account_stream_interceptor.go` | service-account JWT | scoped surfaces |
| `voice_agent_stream_interceptor.go` | shared-secret / service account | pinned to the `VoiceAgent*` message group only |
| `operator_stream_interceptor.go` | — | CoPresent operator / client-tool relay |
| `worker_stream_interceptor.go` | `mql_wkr_<...>` | admitted on the `WorkerService` path only, rejected everywhere else |
| `panic_recovery_interceptor.go` | — | converts panics to `codes.Internal` |

*Source: `component/grpc/*_stream_interceptor.go`*

Every gRPC envelope's partition is checked against the caller's `PartitionACL` by the auth-access middleware; mismatched partitions are rejected, and subscription patterns with `*` partitions are rewritten server-side to the caller's authorized set.

---

## 6. `NodeService` — cross-node streaming (cluster mode)

In cluster mode the node types (bff, voice, cognition, agent, planner) communicate over a second bidirectional stream, defined in a separate package so the node layer stays independent of the gRPC wire-type layer:

```proto
package znasllc.memql.node.v1;

service NodeService {
  rpc Stream(stream NodeClientMessage) returns (stream NodeServerMessage);
}
```
*Source: `component/node/node.proto`*

The envelopes carry mesh control (`NodeHello`/`NodeWelcome`, `NodeHeartbeat`, `PeerIntroduction`), lifecycle (`SpawnRequest`/`SpawnResult`, `NodeShutdown`), event bridging (`EventForward`/`EventAck`), capability discovery (`CapabilityQuery`/`CapabilityResponse`), query forwarding (`QueryForward`/`QueryResponse`), and two forwarding planes:

**SI forwarding** moves a byte-wrapped `MemqlClientMessage` from a BFF node to a worker node that has the needed provider. The worker unmarshals and dispatches it through its own local handler exactly as if the client had connected directly:

```proto
message SIForwardRequest {
  string request_id = 1;
  map<string, string> auth = 2;     // originating principal's claims so the worker can rebuild TokenInfo + ACLs
  bytes memql_envelope = 4;         // serialized memqlv1.MemqlClientMessage
}
message SIForwardResponse {
  string request_id = 1;
  bytes memql_server_msg = 2;       // serialized memqlv1.MemqlServerMessage (SIChunk / SIChatResult / ...)
  bool done = 3;                    // true on the last message of a streamed reply
}
message SIForwardCancel { string request_id = 1; }
```
*Source: `component/node/node.proto`*

The byte-envelope approach is deliberate: "the node layer just moves bytes; the grpc layer owns the wire-type semantics." Streamed SI replies (e.g. `aiChat` with `stream=true`) send multiple `SIForwardResponse` messages with the same `request_id` until `done=true`.

**Workbench forwarding** moves an agent's `workbenchHost.<action>` dispatch from the agent node to the workbench node holding the per-Plan workspace. Unlike SI forwarding this is a structured (not byte-wrapped) single round-trip envelope, with args JSON-encoded to keep the wire shape stable across action variants:

```proto
message WorkbenchForwardRequest  { string request_id = 1; map<string,string> auth = 2; string plan_id = 4; string action = 5; bytes args_json = 6; string agent_id = 7; string task_id = 8; int32 timeout_sec = 9; }
message WorkbenchForwardResponse { string request_id = 1; bytes payload_json = 2; string error_code = 3; string error_message = 4; }
message WorkbenchForwardCancel   { string request_id = 1; }
```
*Source: `component/node/node.proto`*

---

## 7. `WorkerService` — the worker gateway

Workers (the "computer_use" feature) connect to the agent node over a third bidirectional stream. Per-user routing: the worker's token authenticates as a `worker:<id>` principal owned by exactly one human user, and only agents acting in that user's sessions can dispatch to it.

```proto
package znasllc.memql.worker.v1;

service WorkerService {
  rpc Stream(stream WorkerClientMessage) returns (stream WorkerServerMessage);
}
```

```proto
// worker -> server
message WorkerClientMessage { oneof payload { Register; Heartbeat; ToolResult; ToolStream; AuditEvent; RotationRequest; } }
// server -> worker
message WorkerServerMessage { oneof payload { RegisterAck; ToolDispatch; ToolCancel; Drain; RotationResponse; RegisterError; } }
```

`Register` advertises capabilities (`HEADLESS` always present, `GUI` optional), per-capability concurrency caps, platform info, TCC/X11 permission status, and build tag. The server replies with `RegisterAck` carrying a registration id and the resolved owner user id. *Source: `component/grpc/worker.proto`*

---

## 8. The Go SDK (`sdk/go`)

The Go SDK is the canonical client surface. Every consumer (memql-cockpit, thick and thin clients) goes through it — no bespoke wire wrappers downstream.

### 8.1 Design rules

1. **Named primitives only.** Consumers call typed generated methods on `QueryClient` — never inline a MemQL string. `generated_queries.go`, `generated_mutations.go`, and `generated_logics.go` are produced by `scripts/sdk-gen` from the DSL tree and are read-only (CI gate: `make sdk-gen-check`).
2. **Opaque types.** The SDK exposes its own `Row`, `Result`, `Event`, `Concept`, etc.; raw `memqlv1.*` protobuf types never appear in the public surface.
3. **The TS SDK mirrors the Go SDK** from the same generator.

*Source: `sdk/go/CLAUDE.md`*

### 8.2 Connecting

`Connect` parses the endpoint (bare `host:port` is plaintext; `http://`/`grpc://` plaintext, `https://`/`grpcs://` TLS), dials, opens the stream, starts the response dispatcher, and runs the `ClientHello`/`ServerHello` handshake:

```go
type ConnectConfig struct {
	Endpoint string
	Token    string // JWT bearer token (empty for no-auth mode)
	Logger   *slog.Logger
}

func Connect(ctx context.Context, cfg ConnectConfig) (*Connection, error)
```

When `Token` is set, the SDK attaches `authorization: Bearer <token>` as outgoing gRPC metadata on the long-lived stream context. After connecting, `Connection.NodeId` and `Connection.Version` are populated from the `ServerHello`. *Source: `sdk/go/client/connection.go`*

### 8.3 The dispatcher

`Dispatcher` owns the receive loop. It demultiplexes server messages by request id, exposes an `Events()` channel for unsolicited server pushes, supports request/stream registration, and implements `RotateAuth`:

```go
func (d *Dispatcher) Send(msg *memqlv1.MemqlClientMessage) (string, error)
func (d *Dispatcher) SendAndWait(ctx context.Context, msg *memqlv1.MemqlClientMessage) (*memqlv1.MemqlServerMessage, error)
func (d *Dispatcher) RotateAuth(ctx context.Context, accessToken string) error
func (d *Dispatcher) Events() <-chan *memqlv1.MemqlServerMessage
func (d *Dispatcher) RegisterStream(requestId string) (<-chan *memqlv1.MemqlServerMessage, func())
func (d *Dispatcher) RegisterClientToolHandler(handler ClientToolHandler) func()
func (d *Dispatcher) Done() <-chan struct{}
func (d *Dispatcher) Stop()

var ErrRotateAuthRejected = errors.New("rotate_auth: server rejected new token")
```
*Source: `sdk/go/client/dispatcher.go`, `sdk/go/client/tools.go`*

### 8.4 Queries

`QueryClient` wraps the dispatcher with typed methods. Generated methods build a named-primitive call and run it through `executeNamed`:

```go
// QueryActiveAgents -- Returns available AI agent templates. Optional filter: groupId
type QueryActiveAgentsArgs struct { GroupId string }

func (qc *QueryClient) QueryActiveAgents(ctx context.Context, args QueryActiveAgentsArgs) (*Result, error) {
	call := QueryActiveAgentsBuild(args)
	return qc.executeNamed(ctx, "queryActiveAgents", call)
}
```
*Source: `sdk/go/client/generated_queries.go`*

`Result` offers ergonomic accessors — `Rows()`, `Single()`, `RawNodes()`, `Raw()` — plus typed field readers (`RowString`, `RowBool`, `RowFloat`, `RowInt`, `RowObject`, `RowSlice`). *Source: `sdk/go/client/support.go`*

Two hand-rolled query methods exist for the admin concept-browser carve-out (`ListConcepts`, `GetMyAccess`, and the unexported `executeRaw`), documented as deliberate exceptions in `queries.go` / `concept_browser.go`.

### 8.5 Subscriptions

```go
func (sm *SubscriptionManager) Subscribe(ctx context.Context, kind SubscriptionKind, filter string) (string, <-chan Event, error)
func (sm *SubscriptionManager) Unsubscribe(subId string) error
```
`SubscriptionKind` is a typed string (`graph_events`, `domain_events`, `automation_events`, …) that maps to the proto enum. `Event` is the SDK-owned event type translated from `EventNotification`. *Source: `sdk/go/client/subscriptions.go`, `sdk/go/client/types.go`*

### 8.6 Tools

```go
func (qc *QueryClient) ListTools(ctx context.Context, args ListToolsArgs) (*ListToolsResult, error)
func (qc *QueryClient) CallTool(ctx context.Context, args CallToolArgs) (*CallToolResult, error)

type ClientToolHandler func(ctx context.Context, call *ClientToolCall) *ClientToolResult
```
Registering a `ClientToolHandler` lets the SDK respond to server-emitted `ClientToolCall` envelopes for client-executed tools. *Source: `sdk/go/client/tools.go`*

### 8.7 Subpackages

| Package | Purpose |
|---------|---------|
| `sdk/go/client` | Connection, Dispatcher, QueryClient, SubscriptionManager, tools |
| `sdk/go/client` (`deploycontrol.go`) | Deployment Console client — `deploy` / `promote` / `rollback` / `rollout` against the owner/admin-gated `deploycontrol` surface (cluster doc §5.9). |
| `sdk/go/sense` | Sense: Tokenize / Diagnose / Complete / Hover / SignatureHelp |
| `sdk/go/voice` | push-to-talk transcription |
| `sdk/go/worker` | `WorkerService` dial + TLS + stream lifecycle (`Dial`, `Send`, `Recv`, `Stream`, `Close`) |

*Source: `sdk/go/CLAUDE.md`, `sdk/go/worker/worker.go`, `sdk/go/client/deploycontrol.go`*

**CLI.** The `memql` binary gained an **`env` subcommand** (`subcommand_env.go`) — it prints the resolved environment/config the node would boot with (envelope + per-pod overrides merged, per the precedence in the cluster doc §6.1), so an operator can verify what a node will actually see before deploying. It joins the existing CLI subcommands (`migrate`, `token`, …).

---

## 9. The TypeScript SDK (`sdk/ts`)

The TS SDK mirrors the Go surface from the same generator. The public entry points:

```ts
export * from "./client/index.js";
export * as identity from "./identity/index.js";
export * as realtime from "./realtime/index.js";
export * as si from "./si/index.js";
export * as tools from "./tools/index.js";
export * as voice from "./voice/index.js";
```
*Source: `sdk/ts/src/index.ts`*

Module map: `identity` (session revocation, guest tokens, worker-token mint, `evaluatePolicy`), `realtime` (audio + Polyphon room token), `si` (chat/speech/transcribe/suggest), `tools` (inbound/outbound MCP tool handling), `voice` (push-to-talk). Go idioms translate to TS equivalents — `context.Context` → `AbortSignal`, `<-chan` → `AsyncIterable`. *Source: `sdk/ts/src/` directory layout*

---

## 10. Adding to the wire surface

The extension order is fixed:

1. **New client operation that belongs in the DSL** → add a query/mutation/logic to the DSL tree and run `make sdk-gen`; the typed method appears in `generated_<kind>s.go` and its TS mirror. No proto change.
2. **New gRPC message type** → add the request to `MemqlClientMessage.oneof payload`, the reply to `MemqlServerMessage.oneof payload`, and a handler case in `component/grpc/server.go`. Follows the existing multiplexed-stream pattern.
3. **New HTTP endpoint** → not without explicit approval; only the documented exceptions in §1 are permitted.

A backend change that alters a wire contract the frontend depends on (removed/renamed message types, new required fields) must be called out explicitly so it can be relayed to the frontend team; backend-internal refactors that leave the wire identical do not.
