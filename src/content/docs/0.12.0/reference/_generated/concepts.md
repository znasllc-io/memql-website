---
title: Concept Catalog
audience: public
status: stable
area: language
sinceVersion: 0.9.0
owner: znas
---

# Concept Catalog

Generated from the live DSL by `cmd/docs-gen` -- do not hand-edit.
A memQL node is an instance of one of these concepts; each concept's
fields below are its schema.

Total: **99** concepts.

## `v1:actions:action`

A reusable, replayable library entry minted from a candidate trace (Phase 1, #1736). A primitive stores one or more captured capability calls with literal args, keyed by inputFingerprint, and replays them token-free on identical input against the default surface. Reliability rises on verified replay; mismatches fall back to the LLM.

| Field | Type | Required | Description |
|---|---|---|---|
| `argTemplate` | object |  | AUTHORED action (#2218, ADR section 2.3) capability-argument template: a flat map of {capabilityArgKey: templateString} rendered from params before the capability runs (a $params.<name> reference is substituted with the bound value). THE definition of what an authored primitive invokes. Empty for a replay-capture action (which carries literal calls instead). |
| `calls` | array | yes | Ordered capability calls to replay, in execution order. Each entry: {index, capability, args}. args are the literal recorded argument map (parameterization lands in Phase 3 #1738). Error/cache-hit calls are excluded at mint time. |
| `capability` | string |  | The abstract external capability verb the action performs (e.g. shell.exec, fs.writeFile, integration.github.tagRelease). For an AUTHORED primitive (#2218) this is THE single capability the action invokes -- bound from params via argTemplate; for a replay-capture action it is the dominant verb the capability->surface resolver consumes (Phase 2 #1737). |
| `inputFingerprint` | string | yes | Stable hash of the dispatched step input that minted this action. THE literal-replay key: a later step whose input hashes to the same value replays this action instead of calling the LLM. |
| `intent` | string | yes | Natural-language description of what the action does -- the future embedding source for retrieval (Phase 3). Phase 1 derives it from the step goal/input. |
| `kind` | string | yes | primitive = one or more captured capability calls replayed directly. composite = an ordered list of child action references (Phase 3 #1738). Phase 1 mints only primitives. (enum: primitive, composite) |
| `lastReinforced` |  |  | When the action was last reinforced -- the decay clock for Phase 4 consolidation. |
| `ownerUserId` | string | yes | v1:identity:user.id of the owner. The per-row authz key (owned tier), stamped from actor.userId by mintAction. |
| `paramBindings` | array |  | Phase 3 (#1738) automatic parameterization. Per-call arg bindings derived from the data-flow tracer's provenance: {index, capability, bindings:[{name, kind, ref, fragment, template, fragmentValue, literal}]}. kind is stepInput (re-bind from the current step input at ref) or literal. Lets the action replay on VARYING input by re-binding witnessed params; an unbound arg stays its recorded literal. |
| `params` | array |  | AUTHORED action (#2218, ADR section 2.3) input schema: the named, typed parameters the step args bind to. Each entry mirrors an args field: {name, type, required, description}. The argTemplate renders the concrete capability arguments from these. Empty for a replay-capture action (which re-binds via paramBindings instead). |
| `provenanceMutation` | string |  | Name of the mutation that produced this action version (audit trail). |
| `provenancePlanId` | string |  | v1:harness:plan.id of the run that minted this action. |
| `provenanceStepId` | string |  | v1:harness:step.id of the run that minted this action. |
| `recordedResult` | object |  | The step result the minting run produced (returned verbatim on a verified replay, since the LLM synthesis is not reproducible without the model). |
| `recordedSurface` | string |  | Provenance only: the surface the action was captured on (Phase 1 is always the default surface). Replay re-resolves in Phase 2 (#1737); this never constrains where it runs. |
| `reinforceCount` | integer | yes | Number of verified successful replays observed. Bumped by reinforceAction (value computed engine-side, MemQL has no arithmetic). |
| `reliability` | number | yes | Confidence in [0,1]. Rises on a verified successful replay (fingerprint match), decays on mismatch/disuse (Phase 4). Below a floor an action is deprecated and no longer offered (Phase 4 #1739). |
| `resourceEdges` | array |  | Resource-coupling edges carried from the candidate trace: {fromCallIndex, toCallIndex, resource}. Phase 2 (#1737) uses these to form world groups so coupled calls pin to a single surface (decision A). |
| `resultFingerprint` | string |  | Stable hash of the recorded tool results. A replay must reproduce this fingerprint to be trusted; a mismatch decays trust and falls back to the LLM. |
| `sideEffectClass` | string | yes | Coarse risk class, used by the surface-aware trust gate in Phase 4 (#1739). Carried on the action for authoring/labelling; the AUTHORITATIVE sideEffectClass lives on the capability (ADR section 7, reconciled by the I7 capability vocabulary) so an authored or generated action cannot spoof it. Phase 1 records it (defaulting conservatively to write) but does not yet gate on it. (enum: read, write, exec) |
| `slug` | string | yes | Human-readable name (e.g. the dominant capability slug). Not unique on its own; (ownerUserId, inputFingerprint) is the replay key. |
| `status` | string | yes | Trust-ladder state. Phase 1 mints directly as active (replay is fingerprint-verified, so it is safe to offer); the candidate->active->deprecated ladder with surface-aware gating lands in Phase 4 (#1739). (enum: candidate, active, deprecated) |
| `steps` | array |  | Phase 3 (#1738) composite body (kind=composite): an ordered list of child action references {actionId, version, argTemplate}. A composite replays by recursing into each child action. Empty for primitives. |
| `templateFingerprint` | string |  | Phase 3 (#1738) structural lookup key: a stable hash of the dispatched step input's KEY SET (not values). An input with the same shape matches this action and re-binds params by value -- the pre-planner parameterized-replay key, superseded by the planner's semantic (pgvector) search once wired. |
| `version` | integer | yes | Monotonic version, bumped on every edit. Pin-by-default references and the verified upgrade migration land in Phase 5 (#1740). |

**Relationships:** `parent` -> `v1:identity:user`, `interactsWith` -> `v1:harness:plan`, `interactsWith` -> `v1:harness:step`

## `v1:actions:candidate`

A captured trace of the concrete capability sequence an LLM step performed, with value + resource provenance per call (#1735). Minted as status='candidate' on first run; a later phase graduates it into a library action. This is the foundation record of the action library (epic #1734) -- no replay yet.

| Field | Type | Required | Description |
|---|---|---|---|
| `callCount` | integer |  | Number of captured calls (len(calls)). A convenience field for filtering trivial/empty traces. |
| `calls` | array | yes | Ordered traced capability calls, in execution order. Each entry: {index, capability, isError, args:[{name, value, source:{kind, ref, fragment}}]}. source.kind is one of stepInput \| planInput \| upstreamResult \| literal -- derived by data-flow tracing (provenance, NOT synthesis): a value that traced to a witnessed source is bound; an untraceable value stays literal (we never invent a binding). |
| `ownerUserId` | string | yes | v1:identity:user.id of the owner. The per-row authz key (owned tier), stamped from actor.userId by recordActionCandidate. |
| `planId` | string | yes | v1:harness:plan.id the trace was captured under. |
| `provenanceMutation` | string |  | Name of the mutation that produced this candidate version (audit trail). |
| `resourceEdges` | array |  | Resource-dependency edges: a later call reads a resource (path/handle) an earlier call referenced. Each entry: {fromCallIndex, toCallIndex, resource}. These become the world-group edges that pin coupled actions to one surface in Phase 2 (decision A). |
| `status` | string | yes | Trust-ladder state. candidate = captured, not yet a library action; promoted = graduated into a library action (Phase 4); discarded = rejected or superseded. (enum: candidate, promoted, discarded) |
| `stepId` | string | yes | v1:harness:step.id whose dispatch produced this trace. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:harness:plan`, `parent` -> `v1:harness:step`

## `v1:actions:surface`

A registered execution surface for action replay (Phase 2, #1737): workbench / computer-use:<machineId> / mcp:<server>, with its served capability verbs + current availability. The resolver binds capability->surface per world group with explicit > policy > availability precedence (decision A pins coupled actions to one surface).

| Field | Type | Required | Description |
|---|---|---|---|
| `available` | boolean | yes | Whether the surface is currently reachable. The availability failover chain skips unavailable surfaces; an operator/agent flips this via setSurfaceAvailability. |
| `capabilities` | array | yes | The abstract capability verbs this surface serves (e.g. fs.writeFile, fs.readFile, shell.exec). The resolver only binds a capability to a surface that lists it. |
| `kind` | string | yes | Surface family. Drives the surface-aware trust gate in Phase 4 (#1739): a real-machine computer-use surface always confirms destructive replays. cockpit-runner is the control-plane runner (operator/CI) that executes deploy/control capabilities OUTSIDE the target cluster (memql#2220). (enum: workbench, computer-use, mcp, cockpit-runner) |
| `lastSeen` |  |  | Last availability heartbeat -- staleness signal for the resolver (full liveness model is an open question, #1742). |
| `machineId` | string |  | For kind=computer-use: the stable machine identity (see open question in #1742 on stable identity across reconnects). |
| `ownerUserId` | string | yes | v1:identity:user.id of the owner. Per-row authz key (owned tier); computer-use machines + workbenches are per-user. Stamped from actor.userId by registerSurface. |
| `priority` | integer | yes | Failover order within the available set (lower runs first). The default surface (workbench) is registered with a low priority so it wins by default. |
| `provenanceMutation` | string |  | Name of the mutation that produced this surface version (audit trail). |
| `slug` | string | yes | Stable surface identifier used in bindings/policies: 'workbench', 'computer-use:<machineId>', 'mcp:<server>'. (ownerUserId, slug) is the registry key. |
| `status` | string | yes | Registry lifecycle. retired surfaces are kept (append-only) but excluded from resolution. (enum: active, retired) |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:agents:agent`

System-level AI assistant templates with configurable capabilities, personalities, and provider settings. Global-scoped: lives in _system alongside v1:identity:user, since per-user platform agents (assistant, plannerAgent, trainerAgent) are infrastructure that every tenant sees the same way -- keyed by ownerUserId payload field, addressed canonically as _system:v1:agents:agent:<seedName>-<userShortId>.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether the agent template is available for use. |
| `audioControl` | string |  | Per-agent default for whether the Bridge Agent publishes TTS audio for this agent into a Polyphon room. 'always_on' = always speaks aloud; 'always_off' = text-only (response still flows to chat, audio suppressed); 'mirror_user' = matches the owner's mic state (owner toggles mic on -> agent's effective mic is on; owner toggles off -> agent goes silent on the next turn). Default for every new agent (GA + specialists alike) is 'mirror_user' so the user's mic toggle is the single switch for the whole room when alone; the user can still override per-agent via the orb-corner overlay in PresencePanel (writes a v1:cognition:audioOverride row that beats this default). (enum: always_on, always_off, mirror_user) |
| `avatar` | object |  |  |
| `avatarPersonaId` | string |  | Vendor-issued persona id for lip-synced video. The agent-creation flow uploads a still image to Anam (or Simli when MEMQL_AVATAR_VENDOR=simli); the vendor returns a persona / face id that gets stamped here. Resolved by the voice-agent at session start to instantiate the avatar plugin with the right persona. Empty for legacy agents and any specialist that the user never created an avatar for -- the voice-agent disables the avatar plugin when this is empty, falling back to audio-only. |
| `avatarVendor` | string |  | Which avatar vendor minted avatarPersonaId. Decoupled from the runtime MEMQL_AVATAR_VENDOR (which is a session-wide knob -- future policy-driven) so a persona created against one vendor still rides when the runtime defaults to another: the voice-agent reads this field and instantiates the vendor that minted the persona. (enum: anam, simli) |
| `capabilities` | object |  |  |
| `colorIndex` | integer |  | Persistent color palette index (0-12). Assigned at creation, never changes. Used for consistent avatar colors across all surfaces. |
| `deleted` | boolean |  | When true, the agent has been permanently removed and should not appear in any agent list. Distinct from active:false (deactivated) which keeps the agent visible but disabled. |
| `description` | string |  | Brief description of the agent's purpose. |
| `gender` | string |  | Agent's voice / persona gender bucket. Drives canonical-voice auto-assignment at creation time and the avatar gender presented in PresencePanel. Required at creation; the user picks from a Female / Male toggle in CreateAgentModal. The assistant defaults to female when seeded by the provisionAssistantOnUserCreate automation. Once assigned the value is fixed -- the canonical voice is stamped from this bucket and the user does not edit it later (per Q7 voice/audio plan). (enum: female, male) |
| `groupIds` | array |  | IDs of groups this agent is assigned to. Empty means global/unscoped. |
| `identity` | object |  |  |
| `kind` | string | yes | First-class agent identity: what KIND of agent this is across the platform. `assistant` -- user-facing conversational agent (the per-user General Assistant). The user's active assistant joins their spaces. `specialist` -- agent that does tool work for a Task (planner-provisioned or user-created). Specialists answer through tools and never write user-facing utterances. `system` -- platform-internal agent (MemQL Planner, MemQL Trainer, future system-owned ones); hidden from every user-facing surface, not editable / deletable by users. Distinct from but aligned with the `role` field, which is the guardrail-routing classifier read at dispatch time (specialist vs assistant); the invariant `kind == "system" OR kind == role` keeps the two in sync. Stamping paths: user-actor `createAgent` -> `assistant` via default; planner-driven `createAgent` calls pass `kind: "specialist"` (memql#399); seed materializer (plannerAgent / trainerAgent) passes `kind: "system"`. The SPA (`frontend#121`) reads this field to filter / route / hide; epic #122 / #123 / #124 land the SPA-side consumers. Backfilled from the prior `enum("system", "user")` schema: `system` rows stay `system`; `user` rows split into `assistant` (role=assistant) or `specialist` (role=specialist). Pre-prod (no migration tooling needed; seed regen on a fresh DB). (enum: assistant, specialist, system) |
| `lineage` | object |  |  |
| `name` | string | yes | Display name of the agent. |
| `ownerUserId` | string |  | Canonical owning-user pointer. Distinct from the engine-auto-stamped `createdBy` column: createdBy carries the request actor at insert time, which is the user when the agent is created via the Create Agent modal but is the system actor (`system:automation:provisionAssistantOnUserCreate`) when the assistant is auto-seeded by the provisioning automation. Owner-keyed lookups (Computer Use status, worker dispatch routing, agent-context auto-injection for worker tools) read this field first and fall back to createdBy. |
| `personality` | string |  | System prompt describing the agent's persona and behavior. |
| `providerConfig` | object |  |  |
| `role` | string |  | Role in the guardrail routing hierarchy. Specialists answer through tools and never write user-facing utterances. The assistant is the sole agent that converses with humans in the space and orchestrates specialists via the askSpecialist tool. Related to `kind` but distinct: `kind` is the platform-identity classifier (assistant / specialist / system) that the SPA filters on, while `role` is the dispatch-time guardrail. Invariant: `kind == "system" OR kind == role` -- a non-system agent's kind always matches its role. System agents may carry either `role=assistant` (rare; reserved for future) or `role=specialist` (the current MemQL Planner / MemQL Trainer pattern). (enum: specialist, assistant) |
| `roleEmbedding` | array |  | Embedding of (role + roleSlug + description + the resolved domain union across capabilities.skillIds[]) used by the layered dedupe (Q10) similarity check. Recomputed on insert/update of any of those fields by the agentRoleEmbed automation. Empty for legacy agents until the backfill runs. Stored on the row rather than a sidecar concept for v1 simplicity; can be moved to v1:agents:agentEmbedding later if row width becomes a concern. |
| `roleSlug` | string |  | Specialty slug -- the canonical identifier for the agent's specialty (it-support, accounting-finance, customer-service, human-resources, legal-compliance, sales-marketing, operations, project-management, research-development, training-education, quality-assurance, assistant, ...). UNIQUE per partition: at most one non-deleted agent may carry any given roleSlug per partition. Empty for legacy / unscoped agents. The frontend's role dropdown filters out roleSlugs already taken in the partition so duplicates can't be created from the UI; the constraint is enforced caller-side. |
| `systemPrompt` | string |  | System prompt/instructions that define how this agent interacts with users. |
| `triggerBehavior` | object |  |  |
| `videoControl` | string |  | Per-agent default for whether the voice-agent process publishes lip-synced video (Anam / Simli avatar) for this agent into a LiveKit room. Mirrors audioControl semantics: 'always_on' = always publishes video; 'always_off' = never publishes (audio + chat still flow normally); 'mirror_user' = matches the owner's video state. Default 'mirror_user' for every new agent. Specialists are text-only by design (per Initiative C) -- this field is effectively a no-op on them but kept on the schema for parity with audioControl. The per-(space, agent) override lives at v1:cognition:videoOverride. (enum: always_on, always_off, mirror_user) |

**Relationships:** `parent` -> `v1:identity:user`, `interactsWith` -> `v1:identity:identity`, `createdBy` -> `v1:planner:plan`, `interactsWith` -> `v1:agents:agent`

## `v1:agents:agentAuthorization`

Standing authorization granting an agent permission to trigger Plans of certain kinds without per-Plan user approval. Per Q4 Option B (tiered trust + opt-in autonomy): agent-proactive Plans default to 'requires user approval' (canvas suggestion card -> click Approve to start); the user can graduate a specific agent to standing authorization for specific plan kinds via the 'Approve & always allow this' button on the suggestion card. The grant is per (agentId, planKind, spaceScope) and carries a per-grant token budget cap + an expiry so autonomy is bounded by default.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string |  | What the grant authorizes the agent to do. triggerPlan = auto-trigger Plans matching planKind without per-Plan approval (legacy behavior; default for backward compatibility). createSpecialist = the Planner Agent may auto-mint specialists matching planKind (Q4 standing envelope). extendSpecialist = may auto-clone-and-extend an existing specialist (Q10 layered dedupe). trainSpecialist = may auto-trigger trainSpecialist Plans for the specialist. mintSkill = the Planner Agent may mint a NEW v1:agents:skill row when the catalog lacks a suitable bundle (Phase 3 / memql#159). For mintSkill the skillTierAllowlist field gates which skill tiers (A / B / C) the planner may mint at without per-mint approval; out-of-allowlist mints surface a canvas approval card and park the Plan. (enum: triggerPlan, createSpecialist, extendSpecialist, trainSpecialist, mintSkill) |
| `active` | boolean |  | Soft-revoke flag. User-revocable from the agent's settings at any time. |
| `agentId` | string | yes | v1:agents:agent.id this grant authorizes. |
| `computerUseScope` | string |  | Standing computer_use authorization tier the user has granted this agent (Q9 layer 2). observe = read-only worker calls (screenshot, fs_read, fs_list, fs_stat, http_fetch GET, cursor/display/window-list). full = adds shell exec, fs_write, full HTTP, mouse + keyboard + window_focus. Empty string means computer_use is not authorized for this agent in this scope; dispatch rejects with denied_by_scope. Plans can declare a NARROWER scope at creation time but never wider. NOTE: the `interact` value is a retired tier kept in the enum for backward compatibility with rows written before the simplification; the read path treats it as `full`. (enum: , observe, interact, full) |
| `expiresAt` |  |  | When this grant expires. Null = no expiry (lifetime grant). Default UI proposes 30-day expiry with a renewal prompt before expiration. |
| `maxPerPlan` | integer |  | Cap on how many times this action can fire under a single parent Plan. Used primarily for action='createSpecialist' (e.g. 'up to 3 new specialists per Plan'). Null = no cap. |
| `planKind` | string | yes | Plan kind this grant covers, OR '*' to cover any kind. Matches v1:planner:plan.kind values. For action='triggerPlan' this is the kind being triggered; for createSpecialist/extendSpecialist/trainSpecialist this is the originating-Plan kind that the action fires under. |
| `roleSlugAllowlist` | array |  | Optional list of agent.roleSlug values this grant covers; empty = any roleSlug. Lets the user say 'auto-create technical specialists but ask before HR / Legal / Finance roles'. Only meaningful for action='createSpecialist'/'extendSpecialist'. |
| `skillTierAllowlist` | array |  | For action='mintSkill' grants (Phase 3 / memql#159): the v1:agents:skill tiers (A / B / C) the planner may mint at without per-mint approval. Default is implicitly ['A'] when the grant is created -- the planner integration injects that default at read time when the field is empty AND action='mintSkill'. B and C are riskier (safety-relevant + high-stakes regulated respectively) so they require explicit user opt-in via the 'Approve & always allow this tier' button on the mintSkillApprovalRequested canvas card. Empty / unused for non-mintSkill grants. |
| `spaceScope` | string | yes | Space id this grant is restricted to, OR '*' to cover any space owned by the user. Lets users grant 'Cleo can auto-run analyzeFile in the HR space' without granting workspace-wide. |
| `tokenBudgetCap` | integer |  | Per-Plan token budget ceiling enforced when this authorization is consumed. Even auto-approved plans can't blow through tokens beyond this cap. Null = use User.preferences.defaultPlanTokenBudget. |
| `userId` | string | yes | v1:identity:user.id of the user who granted the authorization. Only the granting user can revoke. |

**Relationships:** `parent` -> `v1:agents:agent`, `parent` -> `v1:identity:user`

## `v1:agents:agentRole`

First-class catalog of agent roles. A role is the spine of an agent's identity: it picks the locked minimum skills (knowledge + tool + live-source bundles), declares the recommended LLM policy, and caps how many skills an agent in the role may carry at once. The role is the contract the assistant fulfills when it auto-creates a specialist mid-conversation -- pick the role, copy its locked + default skills onto the new agent, materialize the row. Lock semantics (#158): lockedSkillIds is the minimum required set for any agent carrying this role. The cockpit's Studio renders locked rows with a lock icon; updateAgent rejects writes that strip a locked id (server-side enforcement, not just UI). defaultSkillIds is pre-selected when the agent is created but the user / planner may remove them later. forbiddenSkillIds hard-denies skills the agent factory MUST NOT grant. availableSkillIds (when non-empty) is the inclusive 'visible in the picker' set; empty = anything not forbidden is permitted. maxSkills caps the count -- 5 for specialists, 2 for the assistant by default. Predefined rows are re-seeded on every startup; user-created roles default to predefined=false and stay fully editable. Per-user roles are global-scoped because routing decisions (cognition / conductor) need to see the same role surface across every partition.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-deactivate flag. Inactive roles disappear from the picker but existing agents that carry the role keep functioning. |
| `availableSkillIds` | array |  | Skill ids visible in the picker for this role. Superset of locked + default. Empty = 'every non-forbidden skill is permitted' (the open-picker default for general-purpose roles); a non-empty list narrows the picker to that explicit set. |
| `category` | string | yes | Coarse grouping for the picker. professional = white-collar business roles. personal = household/lifestyle. creative = arts/writing. scientific = research/discovery. medical / legal / financial = regulated. trades = skilled labor. education = K-12 + higher ed. civic = government / public service. hospitality = food/lodging/events. agriculture = farming/ranching. transportation = pilots/captains/drivers. energy = utilities/power. specialized = doesn't fit elsewhere. hobby = recreational pursuits. (enum: professional, personal, creative, scientific, medical, legal, trades, education, civic, hospitality, agriculture, transportation, energy, financial, specialized, hobby) |
| `defaultSkillIds` | array |  | Skill ids pre-selected when the agent is minted but freely removable later. Distinct from lockedSkillIds: locked = always there, default = nice-to-have starting point. Disjoint by convention (a skill id is either locked or default, not both). |
| `description` | string |  | One- or two-line description of what an agent in this role does. Surfaced in tooltips + the role picker's expanded view. |
| `forbiddenSkillIds` | array |  | Skill ids the agent factory MUST NOT grant to agents in this role -- hard denylist that overrides availableSkillIds. Mirrors the old forbiddenToolSlugs semantic. Use for Tier-C medical roles that must never carry operator-computer-use, regulated finance roles whose audit story can't tolerate workbench shell access, etc. |
| `lockedSkillIds` | array |  | v1:agents:skill ids the role MUST carry -- updateAgent rejects writes that strip any of these from agent.capabilities.skillIds. Phase 2 (#158) cut: replaces the three parallel locked* lists (lockedDomainIds, lockedToolSlugs, lockedLiveKnowledgeIds) with a single skill-id surface. The skill bundle's domain / tool / liveSource composition is resolved at attach time by the agent factory. |
| `maxSkills` | integer | yes | Count cap on agent.capabilities.skillIds. updateAgent rejects writes where len(skillIds) > effective cap, computed as min(agent.capabilities.skillBudgetMax, role.maxSkills). Defaults: 5 for specialist roles, 2 for the assistant role (which is meant to orchestrate, not specialize). |
| `name` | string | yes | Display name, e.g. 'IT Support' or 'Family Medicine Physician'. Surfaced in role pickers and on the agent card. |
| `predefined` | boolean |  | True for catalog rows seeded by dsl/agents/roles/*.memql on every startup. Predefined rows are LOCKED in the role manager UI: name / description / category / locked + forbidden fields + maxSkills are read-only; only tier and recommendedPolicySlug edits are accepted. User-created roles default to predefined=false and remain fully editable. The role catalog itself is the only place where 'admin-only edit predefined rows' would happen, and even there the locks come back on the next startup if not aligned with the source slice. |
| `recommendedGender` | string |  | Optional gender hint for voice + persona auto-assignment when the GA mints an agent. Empty = pick from whichever bucket has more unused canonical voices for this owner. Distinct from a hard rule -- the user can change it at creation time. (enum: female, male, ) |
| `recommendedPolicySlug` | string |  | Default AI Router policy slug for this role (balancedChat, strongReasoning, fastCoding, lowLatencyVoice, cheapestCapable). The agent creation flow pre-selects this on the Intelligence dropdown; user can override. Empty falls back to 'balancedChat'. |
| `slug` | string | yes | Canonical slug -- the value v1:agents:agent.roleSlug points to. Kebab-case, stable, never renamed (rename = new row + migration). Examples: 'it-support', 'family-doctor', 'commercial-pilot', 'union-carpenter'. |
| `systemPromptHints` | string |  | Free-text guidance the agent factory layers into the role's system prompt. NOT the full system prompt -- the agent's own systemPrompt field still wins -- but a short paragraph of role-shape direction (tone, scope of expertise, escalation behavior) that the factory can inject. Example for 'family_doctor': 'You provide general health information, not personal medical advice. Always recommend consulting a licensed practitioner for diagnosis or treatment decisions.' |
| `tier` | string |  | Safety tier mirroring v1:knowledge:knowledgeDomain.tier. A = general; auto-seedable, no advisory disclaimer. B = safety-relevant; agents in this role get a 'general info, not professional advice' disclaimer injected into their system prompt at materialization time. C = high-stakes regulated (clinical medicine, surgery, anesthesia, securities advice, legal practice, structural engineering); agents are still creatable but their locked skills' domains carry Tier-C placeholder content telling the user to upload authoritative sources, and the create-agent flow surfaces a stronger 'this role is regulated' warning. (enum: A, B, C) |

## `v1:agents:avatarPersona`

Operator-curated avatar persona catalog (memql#609). Global operator catalog -- like agentRole / skill: a shared set of vendor-minted avatar personas every user PICKS from when creating an assistant (frontend#239). Each row is a custom Simli avatar generated from an operator image; its vendor-issued faceId is hand-curated as a seed under dsl/agents/avatarPersonas.memql. When a user picks a persona the agent's avatarPersonaId/avatarVendor are stamped from the entry; the voice-agent resolves the persona at session start (integrations/voice/agent/avatar_*.go). Per-assistant vendor choice: an entry belongs to exactly one vendor.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-deactivate flag. Inactive personas disappear from the picker but agents already pointing at them keep resolving. |
| `gender` | string | yes | Gender bucket the persona presents. The Create-Assistant picker filters to the user's selected gender, and the agent's gender + canonical voice align with it. (enum: female, male) |
| `imageRef` | string |  | Reference to the source operator image the persona was minted from (e.g. 'avatars/female_0.png'). Provenance + re-mint idempotency key. |
| `name` | string | yes | Display name shown in the persona picker (e.g. 'Ava'). Operator-curated label, not user-edited. |
| `personaId` | string | yes | Vendor-issued id for the persona/face, resolved verbatim at session start. Anam: the avatarId returned by POST /v1/avatars. Simli: the faceId returned by POST /generateFaceID. |
| `previewRef` | string |  | Reference to a still preview shown in the picker before a live session. Falls back to imageRef when empty. |
| `vendor` | string | yes | Which avatar vendor minted personaId. The agent's avatarVendor is stamped from this when the user picks the persona, so the voice-agent instantiates the matching vendor plugin regardless of the runtime MEMQL_AVATAR_VENDOR default. (enum: anam, simli) |

## `v1:agents:operatorMemory`

Session-scoped memory for UI-driving agents. One record per user; accumulates short notes across takeovers so the operator agent can learn the user's app usage patterns and shortcut repeat work.

| Field | Type | Required | Description |
|---|---|---|---|
| `entries` | array |  | Append-only list of memory notes. Each entry is { ts: datetime, kind: string, goal: string, route?: string, summary: string }. The operator agent writes to this list after each successful takeover and reads from it at the start of the next one. Bounded in practice by the agent's own trim rules (most recent N entries). |
| `lastUpdatedAt` |  |  | Timestamp of the most recent entry. Convenience field; the authoritative order is entries[].ts. |
| `userId` | string | yes | ID of the user this memory belongs to. One-to-one with v1:identity:user. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:agents:skill`

First-class capability bundle: a named unit of (knowledgeDomains + toolSlugs + liveSources) that the Planner Agent attaches to agents in createSpecialist / extendSpecialist. After the full skills rollout (#157 -> #158 -> #159) the agent factory pulls skills off the catalog rather than threading parallel flat lists; this concept is the spine of that surface. Phase 1 (this PR) lands the schema + a 13-row predefined catalog; consumers don't read skills yet. Phase 2 migrates roles + agents to skillIds[]; Phase 3 lands the mintSkill authority + approval card.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-deactivate flag. Inactive skills disappear from the picker but agents that already carry the skill keep functioning. Lets us retire a poorly-shaped catalog row without churning every agent that bound to it. |
| `category` | string |  | Coarse grouping mirroring agentRole.category, with three additional buckets for cross-cutting platform skills (foundational, engineering, product) that don't fit the user-domain taxonomy. The role manager groups skills by this field in the picker. (enum: professional, personal, creative, scientific, medical, legal, trades, education, civic, hospitality, agriculture, transportation, energy, financial, specialized, hobby, foundational, engineering, product) |
| `description` | string |  | One- or two-line description of what an agent with this skill can do. Surfaced in tooltips + the skill picker's expanded view. |
| `domainIds` | array |  | v1:knowledge:knowledgeDomain.id references the skill bundles. Resolved into the agent's effective domain union at retrieval / scoring / prompt-rendering time by traversing capabilities.skillIds[] (Phase 2 cut: #158 -- the agent row no longer stores a flat domains list). Load-time validation: every id ideally resolves to a known knowledgeDomain seed; the Phase 1 carve-out documented in skill_tier_validation.go warns-not-fails for unseeded ids. |
| `liveSourceIds` | array |  | v1:knowledge:liveSource.id references for live-knowledge bindings. Empty for most skills; populated for skills that need a current-state feed (e.g. inventory, weather, market data). Phase 2 cut (#158): resolved into the agent's effective live-source union by traversing capabilities.skillIds[]; the agent row no longer stores a flat liveSources list. |
| `mintedByAgentId` | string |  | Phase 3 (#159) provenance: the v1:agents:agent.id of the planner agent whose mintSkill action produced this row. Empty for predefined catalog rows. The trace viewer renders this alongside the planner trace tree so an operator can correlate a skill mint with the upstream LLM decision that triggered it. |
| `name` | string | yes | Display name shown in the role manager and the agent edit modal. Example: 'Web Research'. |
| `originatingPlanId` | string |  | Phase 3 (#159) provenance: the v1:planner:plan.id whose dispatch surfaced the need for this skill. Empty for predefined catalog rows. Stamped by mintSkill at attach time. Pairs with mintedByAgentId for the 'who/when/why' triad the Skills admin view + the trace viewer (cockpit#125) surface as 'Created by planner from Plan X'. |
| `predefined` | boolean |  | True for catalog rows seeded by dsl/agents/skills/*.memql on every startup. Predefined rows are LOCKED in the cockpit's Skills admin view: slug / category / tier / domain+tool composition are read-only; only tags / description edits are accepted. User-created skills default to predefined=false and stay fully editable. |
| `slug` | string | yes | Canonical slug -- stable, kebab-case identifier. Examples: workbench-baseline, web-research, go-backend-engineering. Never renamed (rename = new row + migration). |
| `tags` | array |  | UI grouping labels for cross-cutting product surfaces (e.g. ['voice', 'category-baseline']). Purely cosmetic; no behavioral effect. Lets a single skill appear in multiple curated lists without forcing a category change. |
| `tier` | string | yes | Safety tier mirroring v1:knowledge:knowledgeDomain.tier. The materializer enforces skill.tier >= max(tier across domainIds[]) at load time: a skill cannot bundle a Tier-C medical domain while declaring itself Tier-A. A = general; B = safety-relevant (advisory disclaimer flows downstream); C = high-stakes regulated. Phase 2 propagates the tier onto the agent's effective tier and onto the system-prompt disclaimer injection. (enum: A, B, C) |
| `toolSlugs` | array |  | Tool / integration slugs the skill grants. Phase 2 cut (#158): resolved into the agent's effective tool union by traversing capabilities.skillIds[]; the agent row no longer stores a flat tools list. Composes through the existing tool-slug expansion (e.g. operator-computer-use expands to workerHost + workerComputer + cross-cutting trio). |

**Relationships:** `interactsWith` -> `v1:planner:plan`, `interactsWith` -> `v1:agents:agent`

## `v1:agents:skillChangeEvent`

Append-only audit log for every skill attach / reconfigure event on an agent. Mirrors v1:knowledge:validationEvent: denormalized state lives on the agent row for fast queries; this event log carries the per-mutation history the planner trace viewer (cockpit#125) and audits replay against. Two writes per attach (the agent row update + the event row); cheap. Phase 1 lands the concept; Phase 2 starts writing rows from the agent factory. detached is reserved for a future phase -- v1 is append-only because no consumer currently reads the negative path.

| Field | Type | Required | Description |
|---|---|---|---|
| `actorAgentId` | string |  | v1:agents:agent.id of the agent that drove the change -- the Planner Agent for planner-driven attaches, empty for human-driven changes. Mutually distinguishable from actorUserId; exactly one of the two is set per event. |
| `actorUserId` | string |  | v1:identity:user.id of the human that drove the change (cockpit Skills admin view, agent edit modal). Empty for planner-driven attaches. |
| `after` | object |  | Snapshot of the agent's capability shape AFTER the change. Same key set as before. Used by the planner trace viewer to diff what the planner's mintSkill / extendSpecialist run actually added. |
| `before` | object |  | Snapshot of the agent's capability shape (domainIds, toolSlugs, liveSourceIds) BEFORE the change. Empty {} for the very first attach to a freshly created agent. Stored verbatim so a future replay tool can rewind state without re-querying the row history. |
| `changeKind` | string | yes | attached = a new skill was added to the agent. skillReconfigured = an already-attached skill's composition shifted under the agent (downstream domain edits propagated through; rare but possible). detached is reserved for a future phase; v1 is append-only. (enum: attached, skillReconfigured) |
| `planId` | string |  | v1:planner:plan.id of the Plan that the change happened under, if any. Lets the trace viewer surface 'attached during Plan X' attribution + group co-occurring attaches under the same Plan. |
| `skillId` | string | yes | v1:agents:skill.id that was attached or reconfigured. The event log entries are denormalized by skillId so the audit / trace viewer can answer 'when was X attached to Y'. |
| `targetAgentId` | string | yes | v1:agents:agent.id whose skill set changed. Pair with createdAt to reconstruct an agent's skill timeline. |

**Relationships:** `interactsWith` -> `v1:agents:agent`, `interactsWith` -> `v1:agents:skill`, `interactsWith` -> `v1:agents:agent`, `parent` -> `v1:identity:user`, `interactsWith` -> `v1:planner:plan`

## `v1:authoring:bundle`

An atomic, versioned unit of planner-authored DSL: one automation plus the dependency closure it needs (logic / shapes / specs / traits / policies / mutations / queries / prompts), compiled from a user Responsibility. The bundle is the unit of validation and activation -- the whole closure passes Gate 1 (isolated compile+bind), Gate 2 (tiered behavioral dry-run), and Gate 3 (user approval) together, then activates together into the sandboxed authored-construct runtime (#959). Never part of the core engine Init() path, so a malformed bundle can never brick the cluster. Member constructs are v1:authoring:construct rows pointing back via bundleId.

| Field | Type | Required | Description |
|---|---|---|---|
| `activatedAt` |  |  | When the bundle was approved + registered into the authored runtime (status -> active). Null until activated. |
| `dryRunReport` | object |  | Gate 2 result (tiered behavioral dry-run, #958): {ok: bool, trace: [...], sideEffectManifest: {mutations: [...], aiCalls: [...], webCalls: [...], blockedWebhooks: [...]}, costEstimate: {tokens, usd}}. The approval artifact shown to the user at Gate 3. Populated by recordBundleDryRun. Empty until Gate 2 runs. |
| `failureReason` | string |  | Populated when status transitions to failed -- which gate failed and why (e.g. 'gate1: spec specX references unknown field payload.foo'). Cleared on a successful re-author. |
| `ownerUserId` | string | yes | v1:identity:user.id who owns this bundle (the Responsibility author). Per-row authz owner; server-stamped from actor.userId at create, never caller-supplied. Authored automations run under THIS user's authz envelope -- no privilege escalation. |
| `responsibilityId` | string |  | v1:planner:responsibility.id this bundle was compiled from, when authored via the Responsibility intake path. Empty for bundles authored directly. Links the human-facing standing directive to its compiled artifact. |
| `retiredAt` |  |  | When the bundle was retired. Null unless status=retired. |
| `reusedConstructRefs` | array |  | Existing constructs this bundle COMPOSES rather than authors (the compose-first dependency strategy). Each entry: {name, kind, namespace, source: 'core'\|'catalog'}. Net-new dependencies are authored as their own v1:authoring:construct rows; this list records the reuse edges for the dependency graph + impact analysis (#957). |
| `sourcePlanId` | string |  | v1:planner:plan.id this bundle was post-hoc captured from, when authored via the everyday-task capture path (epic memql#1160, issue #1161) rather than a standing Responsibility. Empty for Responsibility-authored or directly-authored bundles. Links the one-off task that ran to its reproducible, inspectable compiled artifact; also the idempotency + lookup key for the capture orchestrator (skip re-authoring a re-delivered terminal event) and the #1162 view/edit/export surface. |
| `status` | string | yes | Lifecycle. draft = constructs authored, not yet validated. validated = passed Gate 1 (isolated compile+bind) -- see validationReport. dryRunPassed = passed Gate 2 (tiered behavioral dry-run) -- see dryRunReport. active = approved (Gate 3) and registered into the authored-construct runtime; its automation is live. paused = temporarily disabled by the user or a circuit breaker without retiring. retired = permanently deactivated (superseded by a new version or removed). failed = a gate failed (validation or dry-run); failureReason carries why. Transitioned via the authoring mutations; the engine does not enforce a hard state machine here (the planner loop drives transitions). (enum: draft, validated, dryRunPassed, active, paused, retired, failed) |
| `summary` | string |  | Longer human description of what the bundle does, generated by the planner design pass. Shown on the approval card alongside the dry-run trace + side-effect manifest. |
| `supersedesBundleId` | string |  | When this bundle is a new version of an existing capability, the v1:authoring:bundle.id it replaces. On activation the superseded bundle is retired. Empty for a first-version bundle. |
| `title` | string | yes | Human-readable name of the capability this bundle implements (e.g. 'Draft a reply when a refund escalation arrives'). Surfaced on management cards + the approval (Gate 3) artifact. |
| `validationReport` | object |  | Gate 1 result (isolated compile+bind, #956): {ok: bool, diagnostics: [{constructName, severity, message, line?}], boundConcepts: [...], unresolvedRefs: [...]}. Populated by recordBundleValidation. Empty until Gate 1 runs. |
| `version` | integer |  | Monotonic version of this capability. A user edit to the Responsibility (or a dependency change) produces a NEW bundle that supersedes the prior one via supersedesBundleId, rather than mutating an active bundle in place. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:planner:responsibility`, `interactsWith` -> `v1:planner:plan`, `interactsWith` -> `v1:authoring:bundle`

## `v1:authoring:construct`

One authored DSL construct that is a member of a v1:authoring:bundle: the `.memql` source for an automation / logic / shape / spec / trait / policy / mutation / query / prompt, plus its cached compiled form. These are the NET-NEW constructs the planner authored because nothing existing fit (compose-first, author-the-gap); reused constructs are recorded on the bundle's reusedConstructRefs instead. After a bundle activates, a construct can be promoted into the per-owner reusable catalog (catalogued=true) so later bundles compose it -- the catalog match key lives in catalogKey (#957).

| Field | Type | Required | Description |
|---|---|---|---|
| `bundleId` | string | yes | v1:authoring:bundle.id this construct belongs to. Every authored construct is a member of exactly one bundle. |
| `catalogKey` | string |  | Dedup / match key for the catalog (#957): a stable signature of what this construct does (e.g. kind + bound concept + normalized predicate), used by the similarTo-backed matcher to find an existing construct before authoring a new one. Empty until catalogued. |
| `catalogMatchText` | string |  | The name-independent semantic text (kind + @description intent + canonicalized body) that was embedded for the near-match retrieval tier (#957). Computed by CatalogMatchText at promotion time and stored alongside the embedding (the vector itself lives in node_vectors keyed by this construct's id, vector_field='content') so similarTo can rank close-but-not-identical constructs for a stated need, and a re-embed can backfill from it. Empty until catalogued. |
| `catalogedAt` |  |  | Provenance (#957): when this construct was promoted into the owner's reusable catalog (the post-activation catalog-write path). Null until catalogued. Together with ownerUserId (who) and catalogedFromBundleId (which activated bundle) this is the full reuse provenance later bundles inherit when they compose it. |
| `catalogedFromBundleId` | string |  | Provenance (#957): the v1:authoring:bundle.id whose activation promoted this construct into the catalog. Normally the construct's own bundleId, but recorded explicitly so the provenance survives even after that bundle retires (a cataloged construct outlives a single bundle). Empty until catalogued. |
| `catalogued` | boolean |  | True once this construct has been promoted into the owner's reusable catalog (post-activation), so later bundles can compose it instead of re-authoring. Drives the compose-first reuse path (#957). |
| `compiledForm` | object |  | Cached compiled representation produced by the sandbox compile+bind harness (#956), so activation doesn't re-parse. Empty until Gate 1 compiles the bundle. |
| `grammarVersion` | string |  | The engine grammar epoch this source was authored under (parser.GrammarVersion, S6 #2361), stamped at create. Re-hydration compares it against the running engine's grammar: a MISMATCHED stamp quarantines the row with an error naming the memqlmigrate rewrite mode instead of a silent degradation. Empty on legacy rows (treated as unknown; recompile decides). |
| `kind` | string | yes | Which DSL construct kind this source defines. Drives which loader/validator the sandbox compile+bind harness (#956) routes it through. (enum: automation, logic, shape, spec, trait, policy, mutation, query, prompt) |
| `name` | string | yes | The construct's DSL name as it appears in source (e.g. the automation/logic/spec name). Owner-scoped uniqueness; the authored runtime registers it under targetNamespace so two users' authored constructs never collide. |
| `ownerUserId` | string | yes | v1:identity:user.id who owns this construct (same as the parent bundle's owner). Per-row authz owner; server-stamped from actor.userId at create. |
| `source` | string | yes | The raw `.memql` source text for this construct. The single source of truth; the compiled form is derived + cached. |
| `status` | string | yes | Follows the parent bundle's lifecycle at a construct grain: draft while the bundle is pre-activation, active once the bundle activates, retired when the bundle retires. Lets a cataloged construct outlive a single bundle. (enum: draft, active, retired) |
| `targetNamespace` | string | yes | The namespace this construct registers under in the authored runtime (e.g. an owner-scoped namespace). Resolution precedence at runtime is core (sealed) -> owner-catalog -> bundle-local. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:authoring:bundle`, `interactsWith` -> `v1:authoring:bundle`

## `v1:authoring:dependencyEdge`

One dependency edge in a bundle's construct graph (epic memql#954, issue #957). Construct `fromConstruct` (kind `fromKind`) in bundle `bundleId` depends on construct `toName` (kind `toKind`), which resolves from `toSource` (core = sealed engine, catalog = the owner's reusable catalog, bundle = bundle-local). Edges are recorded at compile time so the catalog can run IMPACT ANALYSIS -- 'which bundles depend on this construct' -- before a shared / cataloged construct changes. This is the reuse-coupling mitigation from the design doc: editing a cataloged construct re-validates its dependents.

| Field | Type | Required | Description |
|---|---|---|---|
| `bundleId` | string | yes | v1:authoring:bundle.id whose construct declares this dependency. |
| `fromConstruct` | string | yes | Name of the depending construct (the one that references the dependency). |
| `fromKind` | string | yes | Kind of the depending construct. (enum: automation, logic, shape, spec, trait, policy, mutation, query, prompt) |
| `ownerUserId` | string | yes | v1:identity:user.id who owns this edge (the bundle owner). Per-row authz owner; server-stamped from actor.userId. |
| `toKind` | string | yes | Kind of the depended-on construct. (enum: automation, logic, shape, spec, trait, policy, mutation, query, prompt) |
| `toName` | string | yes | Name of the depended-on construct. |
| `toSource` | string | yes | Where the dependency resolves under the precedence core -> owner-catalog -> bundle-local. Edges to `catalog` are the ones impact analysis cares about when a shared construct changes. (enum: core, catalog, bundle) |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:authoring:bundle`

## `v1:calendar:calendarEvent`

A single calendar event owned by one user. The app-native source of truth for that user's schedule (#642): the reactive harness's reminder triggers read upcomingEvents over these rows ('remind me the day before X'), and the calendar tool/skill lets agents create + list + edit them. source discriminates native (first-party, the only writer in v1) from externalSync (a future Google/CalDAV sync via knowledge:liveConnector, which stamps externalRef back to the upstream event id). recurrence is an optional RFC-5545 RRULE string carried verbatim for v1 -- expansion into concrete occurrences is a downstream concern, not stored here.

| Field | Type | Required | Description |
|---|---|---|---|
| `allDay` | boolean |  | True = a date-scoped event with no meaningful clock time (birthdays, holidays, 'out of office'). The frontend renders these in the all-day band; reminder logic uses the date rather than the instant. |
| `deleted` | boolean |  | Soft-delete flag. The calendar delete action stamps this true rather than hard-deleting so the time-series history survives and a future external-sync reconciler can propagate the deletion upstream. Queries filter it out via isNotDeleted. |
| `endsAt` |  |  | Event end instant (RFC3339). Optional: a point-in-time reminder ('Call mom') may omit it. For allDay events this is the end-of-day (or the day after's midnight) boundary. |
| `externalRef` | string |  | When source=externalSync: the upstream event id (e.g. the Google Calendar event id) this row mirrors. Used by the future sync reconciler for idempotent upsert + deletion-propagation. Empty for native events. |
| `location` | string |  | Free-form location text ('Dojo on 5th', 'Zoom', a street address). Not geocoded in v1. |
| `notes` | string |  | Free-form notes / agenda / description body for the event. |
| `ownerUserId` | string | yes | v1:identity:user.id who owns this event. Stamped from actor.userId at create time. Every read self-scopes on this field; it is the load-bearing per-row authz guard. |
| `recurrence` | string |  | Optional RFC-5545 RRULE recurrence rule carried verbatim (e.g. 'FREQ=WEEKLY;BYDAY=TU,TH'). Empty = a one-off event. v1 stores the rule but does not expand occurrences server-side; the reminder + listing surfaces treat the row as its next/seed instance. |
| `source` | string | yes | Provenance discriminator. native = created in-app (the only writer in v1; the calendar tool + frontend stamp this). externalSync = mirrored from an external calendar (Google / CalDAV) via the knowledge:liveConnector sync path shipping later; those rows carry externalRef and are owned by the sync, not hand-edited. (enum: native, externalSync) |
| `startsAt` | string | yes | Event start instant (RFC3339). For allDay events this is midnight at the start of the day in the user's timezone. upcomingEvents + eventsByDay range over this field. |
| `title` | string | yes | Human-readable event title, e.g. 'Karate class' or 'Dentist'. Shown as the primary line on the event card and in agent-facing listings. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:cluster:cluster`

A memQL cluster -- the top-level deployment unit consisting of a shared database and seed nodes (bff, cognition, planner). Partitions exist within a cluster for data isolation.

| Field | Type | Required | Description |
|---|---|---|---|
| `databaseId` | string |  | Node ID of the v1:cluster:database record for this cluster's database. |
| `environment` | string | yes | Deployment environment. (enum: development, staging, production) |
| `identityProviderId` | string |  | Node ID of the v1:cluster:identityProvider record. |
| `name` | string | yes | Cluster name (e.g., 'development', 'staging-us-central1'). |
| `provider` | string |  | Cloud provider / deploy target backing this cluster: 'docker-local' (local Docker) or 'azure' (AKS). Empty until stamped by the deploy driver (#1872). |
| `region` | string |  | Cloud region (e.g., 'us-central1') or 'local' for development. |
| `seedNodeTypes` | array |  | Required node types for this cluster (e.g., ['bff', 'cognition', 'planner']). |
| `status` | string |  | Current cluster health status. (enum: bootstrapping, healthy, degraded, shutting_down) |
| `version` | string |  | memQL version running on this cluster. |

**Relationships:** `owns` -> `v1:cluster:database`, `owns` -> `v1:cluster:identityProvider`

## `v1:cluster:database`

A PostgreSQL database instance backing a memQL cluster. Tracks connection info, engine version, and installed extensions.

| Field | Type | Required | Description |
|---|---|---|---|
| `clusterId` | string |  | Node ID of the parent v1:cluster:cluster record. |
| `dbName` | string | yes | Database name (e.g., 'memql'). |
| `engine` | string | yes | Database engine identifier (e.g., 'postgresql'). |
| `engineVersion` | string |  | Engine version (e.g., '16.4'). |
| `extensionVersions` | object |  | Extension version map (e.g., {'timescaledb': '2.25.2', 'vector': '0.8.2'}). |
| `extensions` | array |  | Installed extensions (e.g., ['timescaledb', 'vector', 'uuid-ossp', 'pgcrypto']). |
| `host` | string | yes | Database hostname (e.g., 'postgres', 'tiger-cloud-abc.timescaledb.io'). |
| `port` | integer |  | Database port. |
| `sslMode` | string |  | SSL mode: 'disable', 'require', 'verify-full'. |
| `status` | string |  | Current database health status. (enum: healthy, degraded, unreachable) |

**Relationships:** `parent` -> `v1:cluster:cluster`

## `v1:cluster:deployment`

A persisted deployment record (foundation of epic #1871, issue #1872). Append-only + time-series like the other cluster concepts: the row is written at deploy start (pending/in_progress) and every status transition appends a new payload version under the SAME concept id (the deploymentId, which is also the rollout hash) -- so the full lifecycle is reconstructable asOf any time, and `asOf latest` collapses to the deployment's current status. The CDC path emits graph.node.created/updated.<partition>.v1:cluster:deployment on every write, which the cockpit Deployments view subscribes to (same mechanism v1:cluster:node uses for live topology). The image digest -- previously only in releases/*.yaml on disk -- now lands in the data layer so history, node<->deploy linkage, next-version suggestion, and rollback can all be served from a query.

| Field | Type | Required | Description |
|---|---|---|---|
| `changelog` | string |  | Optional changelog / release-notes summary for this version. |
| `clusterId` | string |  | Node id of the v1:cluster:cluster this deployment targets. Plain string FK (not a @relationship -- cross-concept references use FK fields). |
| `deploymentId` | string | yes | Stable deployment id; also the Argo rollout hash. Used as the concept row id so status transitions append to one timeline. |
| `environment` | string |  | Target environment for this deployment. (enum: development, staging, production) |
| `imageDigest` | string |  | Resolved container image digest for this deploy (sha256:...). Empty until the build/lockfile resolves it. |
| `notes` | string |  | Optional free-form operator notes. |
| `previousDeploymentId` | string |  | Optional deploymentId of the deploy this one supersedes. Plain string FK (not a @relationship). |
| `provider` | string |  | Deploy target / cloud provider: 'docker-local' (local Docker) or 'azure' (AKS). |
| `region` | string |  | Cloud region (e.g. 'us-central1') or 'local'. |
| `status` | string |  | Deployment lifecycle status. pending -> in_progress -> succeeded \| failed; succeeded -> superseded when a newer deploy promotes; any -> rolled_back on an explicit rollback. (enum: pending, in_progress, succeeded, failed, superseded, rolled_back) |
| `triggeredBy` | string |  | v1:identity:user.id of the operator who initiated the deploy. |
| `updatedAt` |  |  | Timestamp of the most recent status transition. The row intrinsic createdAt carries the deploy-start time. |
| `version` | string |  | memQL semver being deployed (e.g. '2026.6.21'). |

## `v1:cluster:deploymentNodeSpec`

Per-node-type spec for a deployment (Epic 2 / #2094). One row per (deploymentId, nodeType): the version + replica count + resolved image digest a given node type runs under a deployment. Engine-as-spine: an empty `version` means this node type resolves against the parent deployment's engine version (the release lockfile's engineVersion); a non-empty `version` pins this node type to a specific version that overrides the spine. Append-only + time-series like the parent deployment: the row is written when the spec is first set and every re-pin (version/replicas/imageDigest change) appends a new payload version under the SAME concept id -- `concat(deploymentId, ':', nodeType)` -- so the per-node-type spec history is reconstructable asOf any time, and `asOf latest` collapses to the node type's current spec. The CDC path emits graph.node.created/updated.<partition>.v1:cluster:deploymentNodeSpec on every write. deploymentId is a plain string FK to v1:cluster:deployment.deploymentId (cross-concept references use FK fields, not @relationship). A deployment's full per-node spec set = every deploymentNodeSpec with the same deploymentId.

| Field | Type | Required | Description |
|---|---|---|---|
| `deploymentId` | string | yes | FK to v1:cluster:deployment.deploymentId this spec belongs to. Plain string FK (not a @relationship -- cross-concept references use FK fields). Part of the composite concept id concat(deploymentId, ':', nodeType). |
| `imageDigest` | string |  | Resolved container image digest for this node type (sha256:...). Empty until the build/lockfile resolves it. Mirrors the per-component digest in releases/<version>.yaml. |
| `nodeType` | string | yes | Node role this spec targets: bff, voice, cognition, agent, planner, identity, mcp, workbench. Part of the composite concept id concat(deploymentId, ':', nodeType) so each (deployment, nodeType) pin appends to one timeline. |
| `replicas` | integer |  | Desired replica count for this node type under this deployment. Staging/prod parity defaults to 2 via the overlay; the concept default is 1 for a single-node baseline. |
| `updatedAt` |  |  | Timestamp of the most recent spec transition. The row intrinsic createdAt carries the first-set time. |
| `version` | string |  | memQL version this node type is pinned to (e.g. '2026.6.21'). Empty means engine-as-spine: resolve against the parent deployment's engine version (the release lockfile's engineVersion) rather than a per-node pin. A non-empty value overrides the spine for this node type only. |

## `v1:cluster:identityProvider`

An identity provider used for authentication and user management in a memQL cluster. Typically the in-house identity service (component/identity), surfaced for cluster-topology dashboards.

| Field | Type | Required | Description |
|---|---|---|---|
| `acceptedAudiences` | array |  | List of accepted token audiences. |
| `clientIdPrefix` | string |  | First 8 characters of the OAuth client ID (non-secret, for identification). Empty for the in-house identity service. |
| `clusterId` | string |  | Node ID of the parent v1:cluster:cluster record. |
| `issuerUrl` | string | yes | Token issuer URL (e.g., 'https://auth.example.com/'). |
| `jwksUrl` | string |  | URL of the public-key JWKS document used for token verification. |
| `lastVerifiedAt` |  |  | Timestamp of last successful JWKS/metadata refresh. |
| `name` | string | yes | Provider name (e.g., 'memQL Identity'). |
| `providerType` | string | yes | Authentication protocol. (enum: oidc, saml, ldap) |
| `redirectUrl` | string |  | OAuth callback URL configured for this provider. |
| `status` | string |  | Current connectivity status. (enum: connected, degraded, disconnected) |

**Relationships:** `parent` -> `v1:cluster:cluster`

## `v1:cluster:node`

A registered node in the memQL cluster. The record is written on registration and updated on every liveness transition (connecting, healthy, degraded, draining, offline, stopped). States mirror the NodeHealthStatus enum defined in component/node/node.proto -- that proto is the source of truth.

| Field | Type | Required | Description |
|---|---|---|---|
| `address` | string | yes | Advertised NodeService gRPC address for peer connections. |
| `capabilities` | array |  | Fully qualified capability names this node offers (e.g. integration.cognition.scoreUtterance). |
| `deploymentId` | string |  | Stable id of the deployment that created this node (#1873). Injected at registration from the rollout (MEMQL_DEPLOYMENT_ID; downward-API pod/rollout template hash in k8s, 'local' in dev). Plain string FK to v1:cluster:deployment.deploymentId -- a deployment's topology is every node with the same deploymentId, and a node whose deploymentId != the cluster's current deployment is an orphan from a previous deploy (feeds the reaper #1874 + cockpit orphan highlight). |
| `environment` | string |  | Deployment environment this node runs in: development / staging / production. Stamped at registration from MEMQL_ENVIRONMENT (#1873). |
| `flavor` | string |  | Domain flavor within the node type. Empty for single-flavor types like cognition. |
| `health` | string |  | Last known health status. Mirrors NodeHealthStatus enum in node.proto. (enum: connecting, healthy, degraded, draining, offline, stopped) |
| `labels` | object |  | Arbitrary metadata key-value pairs. |
| `lastSeen` |  |  | ISO 8601 timestamp of the most recent heartbeat (or registration if none received yet). |
| `nodeType` | string | yes | Node role: bff, voice, cognition, agent, planner. |
| `parentId` | string |  | Node ID of the peer this node discovered via DB-based topology. Empty for the first node in a cluster. |
| `provider` | string |  | Cloud provider / deploy target backing this node: 'docker-local' (local Docker) or 'azure' (AKS). Stamped at registration from the system.startup payload (#1873). |
| `region` | string |  | Cloud region (e.g. 'us-central1') or 'local'. Stamped at registration from MEMQL_REGION (#1873). |

## `v1:cluster:nodeType`

Definition of a node type and its expected capabilities.

| Field | Type | Required | Description |
|---|---|---|---|
| `capabilities` | array |  | Expected capability FQNs that nodes of this type should expose. |
| `codeReference` | string |  | Optional architecture-model node id (model.Node.ID, e.g. 'service:memql') linking this node type to its code-side identity. Cockpit's Topology view uses this to bridge the live cluster grid and the architecture-model drill-down: selecting a live node finds the matching code-side service and jumps the navigator to that drill point. |
| `defaultLabels` | object |  | Default labels applied to spawned instances of this type. |
| `description` | string |  | Human-readable description of this node type's purpose. |
| `image` | string |  | Container image reference for this node type (e.g. gcr.io/project/memql-cognition:latest). |
| `name` | string | yes | Node type identifier: bff, voice, cognition, agent, planner. |

## `v1:cluster:spawnEvent`

Lifecycle event recording node state transitions (started, stopped, failed). Used for audit trail and cluster state recovery. Legacy name retained for data compatibility.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | What happened to the node. (enum: spawned, stopped, failed) |
| `initiatorId` | string |  | ID of the node that triggered this event. |
| `metadata` | object |  | Additional context about the event. |
| `nodeId` | string | yes | ID of the node this event pertains to. |
| `nodeType` | string | yes | Type of the node: bff, cognition, agent, planner. |
| `reason` | string |  | Human-readable reason for the event (e.g. shutdown signal, health check failure). |

## `v1:cognition:audioOverride`

Per-(partitionId, agentId) audio control override. Lets a user dial a single agent's TTS publication on / off / mirror_user inside one space without changing the agent's own default (audioControl on v1:agents:agent). Written by the orb-corner overlay in PresencePanel + the canvas presence widget. Read by the cognition handler before forwarding TTS to the Bridge Agent: an active override beats the agent default; absence falls through to the agent default. id is the deterministic audioOverride:<partitionId>:<agentId> so re-toggling on the same orb hits the same row instead of growing a per-click history.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-revoke flag. Setting active=false collapses back to the agent default without losing the row's history. |
| `agentId` | string | yes | v1:agents:agent.id this override targets. |
| `mode` | string | yes | Effective publication state. The bridge gating path treats this exactly the same as the agent default once selected: always_on publishes unconditionally; always_off suppresses TTS while letting text replies still flow to chat; mirror_user honours the user's current mic state, querying it at TTS-start time (not per-frame). (enum: always_on, always_off, mirror_user) |
| `partitionId` | string | yes | v1:cognition:space.id this override is scoped to. |
| `setBy` | string |  | v1:identity:user.id of the actor who flipped the override -- the space owner under v1 permission rules. Audited against v1:identity:auditEvent. |

**Relationships:** `interactsWith` -> `v1:agents:agent`

## `v1:cognition:client:tool:request`

Ephemeral request envelope for a client-executed tool call bridging cluster nodes. Inserted by cognition's client-tool relay when the agent node emits a ClientToolCall that needs to reach a browser stream on BFF. The browser (via its client-tool relay bridge) subscribes to these events, dispatches the tool, and inserts a matching v1:cognition:client:tool:response. Records are not retained -- once the response arrives the pair is a no-op for future consumers. Lives under v1:cognition because the relay is a cognition-level concern (mediating between the agent loop and the browser stream); consuming products need not define their own variant.

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | ID of the agent that requested the call. Audit-only -- the response routes back to the agent via cognition, not via this field. |
| `argumentsJSON` | string |  | JSON-encoded arguments object for the tool. Empty string is equivalent to `{}`. |
| `callId` | string | yes | UUID correlating this request with its eventual v1:cognition:client:tool:response. Matches the ClientToolCall.call_id the agent emitted. |
| `expiresAt` |  |  | When the request stops being valid. Browsers arriving late ignore requests past this time; cognition drops stale correlations. |
| `participantId` | string |  | ID of the participant the browser is acting as. Lets the browser filter to its own user/session and prevents a call intended for user A from being answered by user B sharing the space. |
| `partitionId` | string |  | ID of the space this turn belongs to. Used to scope subscriptions on the browser side so each user only responds to calls aimed at their active space. |
| `toolName` | string | yes | Canonical tool name (e.g. `uiReadState`, `uiHighlight`). Resolved against the client-side tool registry. |

## `v1:cognition:client:tool:response`

Ephemeral response envelope paired with a v1:cognition:client:tool:request. Inserted by the browser after it dispatches the tool via the client-tool relay bridge. Cognition subscribes to these events, matches on callId, wraps the payload in a ClientToolResult MemqlClientMessage and forwards it to the agent node via AiForwardRequest so the parked agent tool-loop waiter unblocks.

| Field | Type | Required | Description |
|---|---|---|---|
| `callId` | string | yes | UUID matching the v1:cognition:client:tool:request this response fulfils. |
| `contentJSON` | string |  | JSON-encoded ToolResultContent[] produced by the browser-side tool dispatcher. Empty for error results. |
| `errorMessage` | string |  | Human-readable error message when isError=true. Empty on success. |
| `isError` | boolean |  | True when the tool failed. errorMessage carries the reason. |
| `partitionId` | string |  | ID of the space the tool ran against. Propagated from the request for traceability. |

## `v1:cognition:guardrailHealth`

Rolled-up guardrail health metrics for a time window. Written by the rollupGuardrailHealth automation from v1:cognition:unmetCapability rows; advisory-only signal for tuning the fit-score threshold and identifying missing specialist domains. One row per rollup run.

| Field | Type | Required | Description |
|---|---|---|---|
| `avgFitScore` | number |  | Mean topFitScore across the window (null when totalUnmet==0). |
| `belowThresholdCount` | integer |  | Triggered by the fit-score gate. |
| `currentThreshold` | number |  | Fit-score threshold in effect at rollup time. |
| `fullGapCount` | integer | yes | Rows with severity=full_gap -- no agent could help. |
| `generatedAt` | string | yes | When this rollup was produced. |
| `handoffChainCapCount` | integer |  | Triggered by the handoff-chain cap. |
| `noFitNoFallbackCount` | integer |  | Triggered when no fallback agent was available (silent). |
| `notes` | string |  | Free-form notes from the rollup (e.g. 'handoff_chain_cap triggered 8x, review routing prompt'). |
| `periodEnd` | string | yes | End of the rollup window (exclusive). |
| `periodStart` | string | yes | Start of the rollup window (inclusive). |
| `routerEscalatedCount` | integer |  | Triggered when the router itself requested escalation_notice. |
| `routerFallbackCount` | integer |  | Triggered when the router itself requested fallback_attempt. |
| `specialistGapCount` | integer | yes | Rows with severity=specialist_gap -- assistant absorbed the turn. |
| `suggestedThreshold` | number |  | Advisory threshold suggestion based on observed fit-score distribution. Consumer decides whether to apply. |
| `topMissingDomains` | string |  | JSON array of { domain, count } entries ranked by frequency -- clusters of utterances that nobody in the relevant spaces could handle. Product signal for which specialist agents to add next. |
| `topSpaces` | string |  | JSON array of { partitionId, count } entries -- spaces with the highest unmet rate. |
| `totalUnmet` | integer | yes | Total v1:cognition:unmetCapability rows in the window. |

## `v1:cognition:participant`

A human or AI participant instance within a space.

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | ID of the agent template (for AI participants). |
| `capabilityOverrides` | object |  |  |
| `displayName` | string | yes | Display name shown in the UI. |
| `forUserId` | string |  | v1:identity:user.id this AI participant belongs to (which human's team is this agent on?). Required on every AI participant inserted by the agent-roster mutations -- humans bring their own agents into their own private team chat, never each other's. Empty for human participants. The engine pre-insert guard enforces non-empty forUserId on AI participants and validates it matches the authenticated caller (non-elevated callers cannot land an agent on someone else's team). Used by the per-user-per-space 3-cap and by Phase 6's discussion-mode dispatch loop to find the per-user agent set. |
| `hidden` | boolean |  | When true, the participant is present in the space for routing purposes but is never rendered in participant-facing UI (PresencePanel, invite lists, etc.). |
| `isGroupGA` | boolean |  | True only on the owner's Assistant when it sits in the space's group context. The owner's GA is the only AI in group chat; specialists stay in per-user team chats. The participant guard rejects status='left' inserts on isGroupGA=true rows from non-elevated callers, so the GA cannot be removed from the group via the Roster tab. Set by the autoJoinAI automation on space creation (Phase 1.5) and never via the agent-roster mutations. |
| `isGuest` | boolean |  | Whether this participant joined via a guest invite (external, no user account of their own). |
| `joinedAt` |  |  | When the participant joined the space. |
| `leftAt` |  |  | When the participant left the space. |
| `participantType` | string | yes | Whether this is a human or AI participant. Guests use "human" with isGuest=true and userId empty. (enum: human, si) |
| `partitionId` | string | yes | ID of the space this participant belongs to. |
| `status` | string |  | Participant lifecycle status. Real-time speaking state is tracked in v1:cognition:session. (enum: active, idle, left) |
| `userId` | string |  | External user ID (for human participants). |

**Relationships:** `interactsWith` -> `v1:agents:agent`, `parent` -> `v1:identity:user`, `interactsWith` -> `v1:identity:user`

## `v1:cognition:participant:presence`

UI-friendly presence snapshot for a participant (especially AI). Used to show current agent status such as thinking/responding/waiting.

| Field | Type | Required | Description |
|---|---|---|---|
| `intent` | object |  |  |
| `label` | string | yes | Short UI label for the current state (e.g. 'Thinking…', 'Waiting', 'Paused'). |
| `lastError` | string |  | Optional: last error message (safe, non-sensitive). |
| `lastUpdatedAt` | string | yes | When this presence snapshot was last written. |
| `lastUtteranceId` | string |  | Optional: utterance that this status relates to. |
| `participantId` | string | yes | ID of the participant this presence snapshot describes. |
| `partitionId` | string | yes | ID of the space this presence snapshot belongs to. |
| `reason` | string |  | Optional, user-friendly explanation for state (avoid internal jargon). |
| `sinceAt` | string | yes | When this state began (best-effort). |
| `state` | string | yes | High-level, user-friendly state for UI rendering. (enum: idle, listening, thinking, responding, typing, waiting, needs_clarification, needs_human, paused, error, working, using_tool, researching, investigating) |

**Relationships:** `parent` -> `v1:cognition:participant`

## `v1:cognition:session`

Real-time interaction state tracking device + stream + activity for a participant in a space. Audio capability is gated by the user's mic toggle (humanInput.microphoneEnabled) plus the agent's audioControl mode -- there is NO tier ceiling anymore. Whether voice flows in / out of the room is purely a function of who has their mic open and which agents are configured to publish TTS.

| Field | Type | Required | Description |
|---|---|---|---|
| `aiOutput` | object |  |  |
| `humanInput` | object |  |  |
| `lastActivityAt` |  |  | Timestamp of last activity in this session. |
| `participantId` | string | yes | ID of the participant this session tracks. |
| `partitionId` | string | yes | ID of the space this session belongs to. |
| `startedAt` |  |  | When the session started. |
| `streams` | object |  | Active stream and session identifiers for external services: {realtimeSessionId?, avatarStreamId?, audioTrackId?, videoTrackId?}. Matches the createSessionForParticipant `streams object` arg and the SPA's SessionStreams payload (memql#1321). |

**Relationships:** `parent` -> `v1:cognition:participant`

## `v1:cognition:text:chunk`

A streaming text chunk emitted incrementally during AI response generation. The frontend subscribes to creation events and accumulates chunks into a real-time message.

| Field | Type | Required | Description |
|---|---|---|---|
| `done` | boolean | yes | Whether this is the final chunk. |
| `index` | integer | yes | Sequential chunk index (0-based). |
| `participantId` | string | yes | AI participant generating the text. |
| `partitionId` | string | yes | Space where the text is being generated. |
| `replyId` | string | yes | Stable id for the entire turn. Every chunk in the same agent reply carries the same replyId, and the committed utterance for the reply uses this as its id. The frontend keys the rendered bubble by replyId so streaming chunks and the final commit address the same React element -- no remount, no avatar flicker. |
| `text` | string | yes | The text content of this chunk. |

**Relationships:** `createdBy` -> `v1:cognition:participant`

## `v1:cognition:turn:state`

Tracks conversation turn-taking state including who is speaking and AI participation permissions.

| Field | Type | Required | Description |
|---|---|---|---|
| `aiAnalysisJSON` | string |  | Raw JSON string with richer analysis output (internal/debug/UI). |
| `aiDecision` | object |  |  |
| `aiPermission` | string |  | Permission level for AI to jump into conversation. (enum: auto, requested, blocked) |
| `conversationContextJSON` | string |  | JSON string containing enriched conversation context from the turn state decision analysis (tone, topic continuity, momentum, pending topics). |
| `currentSpeakerId` | string |  | ID of the participant currently speaking. |
| `lastActivityAt` |  |  | Timestamp of last conversation activity. |
| `lastNudgeAt` |  |  | Timestamp when the silence nudge evaluation was last performed. |
| `lastNudgeUtteranceId` | string |  | Utterance ID for which the silence nudge evaluation was last performed (idempotency key). |
| `lastUtteranceId` | string |  | ID of the most recent utterance observed for this space. |
| `lastUtteranceType` | string |  | Type of the most recent utterance observed (speech, text, action, system). |
| `partitionId` | string | yes | ID of the space this turn state belongs to. |
| `queue` | array |  | Queue of participant IDs waiting to speak. |
| `respondingAgentId` | string |  | ID of the AI participant selected to respond in this turn. Used by the AI responder to pick the right agent in multi-agent spaces. |
| `silenceDuration` | integer |  | Milliseconds of silence (for detecting pauses). |
| `trigger` | string |  | Why this turn state version was produced (e.g., utterance, silence_nudge, init). |

## `v1:cognition:unmetCapability`

A single instance of the cognition router determining that no agent in a space could meet the user's request -- either the assistant stepped in as fallback (specialist_gap) or nobody could help (full_gap). Emitted by cognition via the cognition.capability.unmet event and consumed by the guardrail health rollup for product-level insight into missing capabilities.

| Field | Type | Required | Description |
|---|---|---|---|
| `partitionId` | string | yes | ID of the space the utterance occurred in. |
| `reason` | string |  | Router's short explanation of why no agent fit. |
| `rosterSnapshot` | string |  | JSON-serialized snapshot of the space's agent roster at decision time (id/name/role/domains/keywords). Used by the rollup to cluster missing domains. |
| `routedAgentId` | string |  | ID of the agent the router ultimately routed to (may be empty when no agent was selected). |
| `routedAgentName` | string |  | Display name of the routed agent. |
| `severity` | string | yes | specialist_gap: assistant absorbed the turn as fallback (we lacked a specialist). full_gap: even the assistant could not help / no assistant in the room. (enum: specialist_gap, full_gap) |
| `speakerName` | string |  | Display name of the human who spoke. |
| `topFitScore` | number |  | Router's fit score for the chosen agent (0..1). Low scores indicate nobody was a strong match. |
| `trigger` | string | yes | Why the unmet event fired: threshold gate, chain cap, missing assistant, or router-initiated. (enum: below_threshold, handoff_chain_cap, no_fit_no_fallback, router_escalated, router_fallback) |
| `turnMode` | string |  | Turn mode the router chose. answer = specialist stretch absorbed it; fallback_attempt = assistant stretched on a knowledge gap; escalation_notice = assistant refused and flagged. (enum: answer, fallback_attempt, escalation_notice) |
| `utterance` | string |  | Text of the user's request that no agent could meet. |
| `utteranceId` | string |  | ID of the triggering human utterance. |

## `v1:cognition:utterance`

A single multi-modal contribution to the conversation stream.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | object |  |  |
| `analysis` | object |  |  |
| `audioId` | string |  | ID of associated audio media asset. |
| `citations` | array |  | Source citations for the utterance text. Each item has shape {domainId: string, matchedPhrase: string} -- the frontend wraps each matchedPhrase in the rendered text with a clickable chip linking to the named knowledge domain. Populated by cognition from the agent's respondToUser envelope. |
| `duration` | integer |  | Duration in milliseconds (for audio/video). |
| `participantId` | string | yes | ID of the participant who created this utterance. |
| `participantType` | string |  | Type of participant (denormalized from participant for filtering). (enum: human, si, system) |
| `partitionId` | string | yes | ID of the space this utterance belongs to. |
| `replyToId` | string |  | ID of utterance this is replying to (for threading). |
| `retrieved` | array |  | RAG retrieval audit -- the full chunk pool the agent's replier surfaced to the LLM BEFORE the model decided what to cite. Each item has shape {domainId, sourceRef, similarity, textPreview, citation}. Distinct from `citations`: `citations` names what the model used; `retrieved` names what the model SAW. The frontend's 'Show details' expander beneath each agent reply renders both so the user can see passages the model considered but didn't cite. Empty when no domains were attached or retrieval returned nothing. |
| `source` | object |  |  |
| `text` | string |  | Text content (transcribed or typed). |
| `timestamps` | object |  |  |
| `utteranceType` | string | yes | Type of utterance. (enum: speech, text, action, system) |
| `videoId` | string |  | ID of associated video media asset. |

**Relationships:** `interactsWith` -> `v1:cognition:participant`, `interactsWith` -> `v1:cognition:utterance`

## `v1:cognition:videoOverride`

Per-(partitionId, agentId) video control override. Lets a user dial a single agent's avatar publication on / off / mirror_user inside one space without changing the agent's own default (videoControl on v1:agents:agent). Mirrors v1:cognition:audioOverride exactly -- same fields, same id pattern, same write/read paths -- but governs lip-synced video instead of TTS audio. Read by the voice-agent process at session start (Phase 9): an active override beats the agent default; absence falls through to the agent default. id is the deterministic videoOverride:<partitionId>:<agentId> so re-toggling on the same orb hits the same row instead of growing a per-click history.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-revoke flag. Setting active=false collapses back to the agent default without losing the row's history. |
| `agentId` | string | yes | v1:agents:agent.id this override targets. |
| `mode` | string | yes | Effective publication state. The voice-agent's avatar-gating path treats this exactly the same as the agent default once selected: always_on publishes unconditionally; always_off suppresses video while letting audio + chat continue; mirror_user honours the user's current video state at session start. (enum: always_on, always_off, mirror_user) |
| `partitionId` | string | yes | v1:cognition:space.id this override is scoped to. |
| `setBy` | string |  | v1:identity:user.id of the actor who flipped the override -- the space owner under v1 permission rules. Audited against v1:identity:auditEvent. |

**Relationships:** `interactsWith` -> `v1:agents:agent`

## `v1:common:attachment`

A file attachment uploaded to a space, with extracted transcription.

| Field | Type | Required | Description |
|---|---|---|---|
| `blobUrl` | string | yes | Azure Blob Storage URL where the file is stored (https://account.blob.core.windows.net/container/object). |
| `fileName` | string | yes | Original filename of the uploaded file. |
| `fileSize` | integer |  | File size in bytes. |
| `mimeType` | string | yes | MIME type of the uploaded file. |
| `partitionId` | string | yes | ID of the space this attachment belongs to. |
| `status` | string | yes | Processing status of the attachment. (enum: processing, ready, error) |
| `summary` | string |  | AI-generated 2-3 sentence summary of the file content. |
| `transcription` | string |  | Extracted plain text from the file, or image description for images. |
| `uploadedBy` | string | yes | Actor identifier of the user who uploaded the file. |

## `v1:common:media`

Audio, video, image, and document assets referenced by utterances.

| Field | Type | Required | Description |
|---|---|---|---|
| `dimensions` | object |  |  |
| `duration` | integer |  | Duration in milliseconds (for audio/video). |
| `filename` | string |  | Original filename. |
| `mediaType` | string | yes | Type of media asset. (enum: audio, video, image, document) |
| `metadata` | object |  | Additional format-specific metadata. |
| `mimeType` | string | yes | MIME type of the asset. |
| `partitionId` | string | yes | ID of the space this media belongs to. |
| `size` | integer |  | File size in bytes. |
| `transcription` | object |  |  |
| `url` | string | yes | Storage URL for the asset. |

## `v1:data:log`

Audit log entry for validation state transitions. Tracks who performed each check, confirm, or revert action, when, and why.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | Action performed (enum: check, confirm, revert) |
| `active` | boolean |  | Soft-delete flag (append-only semantics) |
| `fromState` | string | yes | Validation state before the action (enum: draft, checked, confirmed) |
| `identityId` | string | yes | Identity who performed the action |
| `identityType` | string | yes | Type of identity (denormalized for fast filtering) (enum: human, synthetic) |
| `note` | string |  | Optional reason, especially useful for reverts |
| `partitionId` | string | yes | Space ID for scoped log queries |
| `recordId` | string | yes | The v1:data:record node ID this log entry refers to |
| `toState` | string | yes | Validation state after the action (enum: draft, checked, confirmed) |

**Relationships:** `parent` -> `v1:data:record`

## `v1:data:policy`

Validation policy defining check/confirm requirements for a record type. Controls how many synthetic checks and human confirmations are needed, and whether checked data is usable before full confirmation.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-delete flag (append-only semantics) |
| `checkedDataUsable` | boolean |  | Whether checked (not yet confirmed) records are usable live |
| `partitionId` | string |  | Optional space scope. Null means global for this record type. |
| `requiredChecks` | integer |  | Number of synthetic checks needed for draft -> checked |
| `requiredConfirmations` | integer |  | Number of human confirmations needed for checked -> confirmed |
| `revertMinRole` | string |  | Minimum role required to revert records (enum: owner, admin, writer, reader) |
| `targetRecordType` | string | yes | Record type this policy applies to (e.g., 'vehicle', 'bird') |

## `v1:data:record`

Data record with validation lifecycle: draft -> checked -> confirmed. Replaces the staging/production split with a unified concept where data visibility is governed by validation state and policy.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-delete flag (append-only semantics) |
| `checkCount` | integer |  | Number of synthetic checks received |
| `confidence` | number |  | AI confidence score (0-1) |
| `confirmCount` | integer |  | Number of human confirmations received |
| `data` | object | yes | The actual data payload |
| `importSource` | string | yes | How this data was imported (enum: chat-ai-research, chat-file-upload, manual) |
| `importedBy` | string | yes | Identity ID of the importer |
| `label` | string | yes | Human-readable display label |
| `lastCheckedAt` |  |  | When last checked by a synthetic identity |
| `lastCheckedBy` | string |  | Identity ID of last synthetic checker |
| `lastConfirmedAt` |  |  | When last confirmed by a human identity |
| `lastConfirmedBy` | string |  | Identity ID of last human confirmer |
| `naturalKeyField` | string |  | Name of the natural key field for conflict detection (e.g., 'vin', 'name') |
| `naturalKeyValue` | string |  | Value of the natural key for conflict matching |
| `partitionId` | string | yes | Space this record belongs to |
| `recordType` | string | yes | Domain-specific record type (e.g., 'vehicle', 'bird', 'employee') |
| `sourceAttachmentId` | string |  | Reference to source attachment if file-based import |
| `validationState` | string |  | Current lifecycle state (enum: draft, checked, confirmed) |

## `v1:forge:project`

A project/codebase forge develops against (e.g. memql, or a given client's app). Requests are scoped to a project so one agnostic bundle serves many apps. Partition-scoped: team-shared within the tenant.

| Field | Type | Required | Description |
|---|---|---|---|
| `createdByUserId` | string |  | v1:identity:user.id of whoever registered the project. |
| `description` | string |  | What this project is. |
| `name` | string | yes | Human-readable project name. |
| `provenanceMutation` | string |  | Name of the mutation that produced this version (audit trail). |
| `repo` | string |  | Git repository URL or path. |
| `slug` | string | yes | Stable short id, e.g. 'memql', 'acme-app'. Unique within the partition. |
| `status` | string | yes | active = accepting requests; archived = read-only history. (enum: active, archived) |
| `targetApp` | string |  | Which app this project develops (memql / memql-cockpit / a client app / ...). |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:forge:request`

A request a team member submits through Claude -> the forge MCP surface: a bug, feature, or (later) HR action. Routed by submitterRole through the approval pipeline (submitted -> needs_validation -> validated -> needs_approval -> approved -> queued). Partition-scoped so validators/approvers can read it. Every transition is recorded as a v1:forge:requestEvent for a full time-series audit trail.

| Field | Type | Required | Description |
|---|---|---|---|
| `approvedByUserId` | string |  | v1:identity:user.id of the approver (owner). Set on the approved transition. |
| `attachmentIds` | array |  | v1:common:attachment ids -- screenshots/files the submitter (via Claude) attached. Reuses the common attachment concept. |
| `body` | string | yes | The full prompt/description -- what the submitter wants, what they saw, repro steps. |
| `priority` | string | yes | Submitter/triager priority. (enum: low, normal, high, urgent) |
| `projectId` | string | yes | v1:forge:project.id this request targets. |
| `provenanceMutation` | string |  | Name of the mutation that produced this version (audit trail). |
| `requestType` | string | yes | Request kind (named requestType because `type` is a reserved row intrinsic). Drives which pipeline applies. First slice centers bug/feature; HR types are modelled so they ride the same spine. (enum: bug, feature, chore, question, timeOff, checkIn) |
| `resolution` | string |  | Free-form outcome note when the request reaches a terminal state. |
| `status` | string | yes | Approval-pipeline state. createRequest lands 'submitted'; routeRequest sets the next state by role; validate/approve transitions advance it; 'queued' = approved and waiting for implementation (auto-execute lands when the actions substrate is wired). (enum: submitted, needs_validation, validated, needs_approval, approved, changes_requested, rejected, queued) |
| `submitterRole` | string | yes | The submitter's cluster role at submit time. Stamped from actor.role. THE routing key: owner short-circuits the chain; reader requires validation + approval and triggers the mentoring layer. (enum: owner, admin, writer, reader) |
| `submitterUserId` | string | yes | v1:identity:user.id of the submitter. Stamped from actor.userId by createRequest -- the caller cannot submit as someone else. |
| `targetEnv` | string | yes | Where an approved request deploys. Defaults to staging. (enum: staging, production) |
| `title` | string | yes | Short summary of the request. |
| `validatedByUserId` | string |  | v1:identity:user.id of the developer who validated. Set on the validated transition. |

**Relationships:** `parent` -> `v1:forge:project`, `parent` -> `v1:identity:user`, `parent` -> `v1:identity:user`, `parent` -> `v1:identity:user`

## `v1:forge:requestEvent`

An append-only event in a request's lifecycle: a routing decision, validation, approval, rejection, comment, or mentoring touch. The time-series audit trail for a request -- every transition is one row, never mutated.

| Field | Type | Required | Description |
|---|---|---|---|
| `actorRole` | string |  | The actor's cluster role at event time. |
| `actorUserId` | string | yes | v1:identity:user.id who produced the event. Stamped from actor.userId. |
| `fromStatus` | string |  | Request status before this event (for transitions). |
| `kind` | string | yes | What happened. (enum: submitted, routed, validated, changes_requested, approved, rejected, commented, mentored) |
| `note` | string |  | Free-form note: validation comment, rejection reason, mentoring summary, etc. |
| `provenanceMutation` | string |  | Name of the mutation that produced this event (audit trail). |
| `requestId` | string | yes | v1:forge:request.id this event belongs to. |
| `toStatus` | string |  | Request status after this event (for transitions). |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:harness:consolidationCursor`

The per-owner consolidation watermark (#586), stored as a node so the consolidation loop's bookkeeping is itself durable + queryable -- no separate cursor store. Holds the createdAt boundary of the most recent episodic batch already consolidated for this owner; each scheduled run reads only episodes with createdAt > watermark, then advances the watermark to the newest episode it processed. This is what makes consolidation INCREMENTAL: cost is bounded by the new-episode delta, not total history, as the agent's log grows without bound. One row per owner (content-addressed id on ownerUserId), updated in place. ownerUserId is the per-row authz key (owned tier), stamped from actor.userId at create time.

| Field | Type | Required | Description |
|---|---|---|---|
| `episodesSeen` | integer |  | Running count of episodic nodes consolidated for this owner across all runs. Diagnostic only -- lets an operator see consolidation throughput per owner. The reinforce/advance mutation takes the bumped value (computed engine-side, since the parser has no arithmetic). |
| `lastRunAt` |  |  | When consolidation last ran for this owner. Diagnostic / observability only -- the watermark (not this) is the correctness-bearing field. Useful for spotting an owner whose consolidation has stalled. |
| `ownerUserId` | string | yes | v1:identity:user.id this cursor belongs to. The per-row authz key (owned tier); stamped from actor.userId at create time. One cursor row per owner -- consolidation is per-owner, so each owner's watermark advances independently. |
| `provenanceMutation` | string |  | Name of the mutation that produced this cursor version (advanceHarnessConsolidationCursor). Pairs with the engine-stamped createdBy intrinsic to name the transition in the audit trail. |
| `watermark` | string | yes | The createdAt of the newest episodic node already consolidated for this owner. The next run reads episodes with createdAt > watermark only; advancing this after each run is what bounds consolidation cost incrementally. Set to the engine-computed max(createdAt) over the batch the run processed. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:harness:observation`

What actually happened during a step -- the agent's own actions made durable and recall-able. One observation per meaningful event (a tool result, an error, a note, a decision). The `content` field is the embedding text: the harness's embedding loop stores it into node_vectors keyed by this observation's id (via integration.embedding.store with vectorField='content'), so observations become recall-able memory feeding the recall path in #585 -- the agent can semantically search its own history ('what did I try last time I hit this error?'). The `embedding` field carries the vector once computed; until then recall reads node_vectors directly. ownerUserId is the per-row authz key (owned tier), stamped from actor.userId at create time. Provenance is automatic via the engine-stamped createdBy intrinsic.

| Field | Type | Required | Description |
|---|---|---|---|
| `content` | string | yes | The text rendering of this observation -- the embedding source, so observations are recall-able. The harness embedding loop stores this into node_vectors keyed by the observation id (integration.embedding.store, vectorField='content') so the observation is semantically recall-able (#585): the agent can search its own history. Mirrors the v1:knowledge:documentChunk content-as-embedding pattern -- the vector lives in node_vectors keyed by node id, not inline on the row. |
| `data` | object |  | Structured per-kind data (named `data`, not `payload`, since payload is a reserved row intrinsic -- same gotcha as the product pack's canvas-state concept). tool_result: {toolName, args, result}. error: {message, stack?}. decision: {choice, rationale, alternatives?}. note: {text}. |
| `embedding` | array |  | The semantic embedding vector for `content`, populated lazily by the harness embedding loop when an inline copy is wanted alongside the canonical node_vectors entry. Until set, recall reads the node_vectors row keyed by this observation's id directly. Carried on the concept so observations are recall-able (per the #582 sketch's embedding field). |
| `kind` | string | yes | What kind of event this observation records. tool_result = the result of a tool call; error = something went wrong; note = free-form agent annotation; decision = a choice the agent made (with rationale in payload). (enum: tool_result, error, note, decision) |
| `ownerUserId` | string | yes | v1:identity:user.id of the observation owner. The per-row authz key (owned tier); stamped from actor.userId at create time. Inherited from the parent step's owner. |
| `planId` | string |  | v1:harness:plan.id the step belongs to, denormalized so plan-level recall doesn't have to join through step. |
| `stepId` | string | yes | v1:harness:step.id this observation belongs to. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:harness:step`, `parent` -> `v1:harness:plan`

## `v1:harness:plan`

The desired state of a unit of agent work -- the spine the reconciler (#583) drives and everything else reads. A Plan is the user/agent mental anchor (the goal); Steps are the executable decomposition that hang off it via step.plan. Lifecycle: open -> running -> done/failed/cancelled. ownerUserId is the per-row authorization key (owned tier): stamped from actor.userId at create time so only the owner reaches the plan's reads/writes. Provenance is automatic -- the engine stamps createdBy from the authenticated actor on every inserted version; provenanceMutation records WHICH mutation produced this version so the audit trail names the transition, not just the actor.

| Field | Type | Required | Description |
|---|---|---|---|
| `completedAt` |  |  | When the plan reached a terminal status. |
| `errorMessage` | string |  | Populated when status transitions to failed. |
| `goal` | string | yes | Human-readable description of what the plan is trying to accomplish. |
| `input` | object |  | Free-form input payload the plan was created with (the request that kicked it off). Discriminated by the consuming reconciler; opaque to the engine. |
| `ownerUserId` | string | yes | v1:identity:user.id of the plan owner. The per-row authz key (owned tier); stamped from actor.userId at create time. Only the owner reaches this plan's reads/writes. |
| `provenanceMutation` | string |  | Name of the mutation that produced this plan version (createPlan / startPlan / completePlan / ...). Pairs with the engine-stamped createdBy intrinsic to name every transition in the audit trail. |
| `result` | object |  | Rolled-up plan result, populated at terminal status from the steps' results. |
| `rootStepId` | string |  | v1:harness:step.id of the entry step (the DAG root). Optional -- set by addStep when the first step lands, or left empty for a plan whose steps are all independent. |
| `startedAt` |  |  | When the plan first transitioned to running. |
| `status` | string | yes | Plan lifecycle. open = created, not yet started; running = steps executing; done / failed / cancelled = terminal. The step state machine drives plan-level progress; the reconciler (#583) promotes the plan as its steps complete. (enum: open, running, done, failed, cancelled) |

**Relationships:** `parent` -> `v1:identity:user`, `owns` -> `v1:harness:step`

## `v1:harness:semanticMemory`

A durable, distilled belief consolidated from episodic memory (#586) -- a stable fact, preference, or learned outcome the agent should keep across plans. The `content` field is the embedding text: the consolidation + embedding loop stores it into node_vectors keyed by this memory's id (integration.embedding.store, vectorField='content'), mirroring v1:harness:observation and v1:knowledge:documentChunk, so semantic memories are themselves similarTo-recall-able -- both for the recall path (#585) and for the dedup step of consolidation itself (before writing a new belief, similarTo against existing semanticMemory rows; reinforce the match instead of duplicating). Provenance is the killer feature: `sourceEpisodes` links every belief back to the episodic node ids that formed it, so a belief is always auditable. `confidence` rises on reinforcement and decays when a belief goes unreinforced; `lastReinforced` is the decay clock. ownerUserId is the per-row authz key (owned tier), stamped from actor.userId at create time; only the owner reaches their own beliefs.

| Field | Type | Required | Description |
|---|---|---|---|
| `confidence` | number | yes | How strongly the belief is held, in [0,1]. Rises on reinforcement (a later run distilled the same belief again -- the reinforce mutation takes the new value, computed engine-side, since the MemQL parser has no arithmetic) and decays when the belief goes unreinforced (the decay mutation takes the decayed value, computed engine-side, from lastReinforced age). Beliefs that decay below MEMQL_HARNESS_CONSOLIDATION_PRUNE_CONFIDENCE are pruned, keeping recall sharp. |
| `content` | string | yes | The natural-language statement of the belief -- the embedding source, so semantic memories are similarTo-recall-able. The consolidation + embedding loop stores this into node_vectors keyed by this memory's id (integration.embedding.store, vectorField='content'). Used by BOTH the recall path (#585) and consolidation's own dedup step (similarTo against existing beliefs before writing a new one). Mirrors the v1:harness:observation / v1:knowledge:documentChunk content-as-embedding pattern -- the vector lives in node_vectors keyed by node id, not inline on the row. |
| `embedding` | array |  | The semantic embedding vector for `content`, populated lazily by the consolidation / embedding loop when an inline copy is wanted alongside the canonical node_vectors entry. Until set, dedup + recall read the node_vectors row keyed by this memory's id directly. Carried on the concept per the #586 sketch's @embedding field. |
| `kind` | string | yes | What flavor of belief this is. fact = a stable truth about the user / domain / world the agent learned ('the user's primary repo is memql'). preference = a stated or inferred preference ('the user prefers terse answers'). outcome = a learned result of trying something ('approach Y failed twice for task Z' / 'tool T reliably solves problem P'). Drives how the recall path (#585) weights and presents the belief. (enum: fact, preference, outcome) |
| `lastReinforced` | string | yes | When this belief was last created or reinforced -- the decay clock. The decay sweep measures age as now - lastReinforced; beliefs unreinforced past MEMQL_HARNESS_CONSOLIDATION_DECAY_DAYS lose confidence, and ones that fall below the prune floor are removed. Reset to now on every reinforcement. |
| `ownerUserId` | string | yes | v1:identity:user.id of the belief owner. The per-row authz key (owned tier); stamped from actor.userId at create time. Consolidation runs per owner, so a belief only ever draws on -- and is only ever recall-able by -- its owner's own episodes. |
| `provenanceMutation` | string |  | Name of the mutation that produced this semanticMemory version (createHarnessSemanticMemory / reinforceHarnessSemanticMemory / decayHarnessSemanticMemory / pruneHarnessSemanticMemory). Pairs with the engine-stamped createdBy intrinsic to name every transition in the audit trail. |
| `reinforceCount` | integer | yes | How many consolidation runs have distilled this belief. Starts at 1 (the run that created it); the reinforce mutation takes the bumped value (computed engine-side). A high reinforceCount is independent corroboration -- a belief seen across many runs is more trustworthy than a one-off. |
| `sourceEpisodes` | array | yes | Provenance: the episodic node ids (v1:harness:observation / step / plan) this belief was distilled from. Every belief traces back to its evidence, so it is always auditable -- the killer feature of doing consolidation in-graph. Reinforcement appends the new run's contributing episodes (deduped) so the provenance grows as evidence accumulates. |
| `status` | string | yes | Belief lifecycle. active = a live belief the recall path returns. pruned = decayed below the confidence floor and retired; the row is kept (append-only model) but filtered out of recall and dedup. Soft-delete because MemQL has no row-removal mutation -- mirrors the safety / platform retention crons. (enum: active, pruned) |

**Relationships:** `parent` -> `v1:identity:user`, `formedFrom` -> `v1:harness:observation`

## `v1:harness:step`

A unit of work inside a Plan -- one DAG node. Steps form a DAG via dependsOn (not a flat list), enabling parallel specialists. The status state machine is: pending -> ready (dependsOn satisfied) -> running (controller claims) -> done (result recorded) / failed (error, attempts exhausted) / blocked (needs another step); blocked -> ready (blocker done); failed -> ready (retry, attempt++); done is terminal. Invalid transitions (e.g. done -> running) are rejected by the engine pre-insert guard (component/memql/harness_step_validation.go) since the append-only model cannot express a state machine in the DSL alone. idempotencyKey makes step execution safe to retry / replay (critical for the event-sourced loop in #583). ownerUserId is the per-row authz key (owned tier), stamped from actor.userId at create time. Provenance: the engine stamps createdBy automatically; provenanceMutation names the transition.

| Field | Type | Required | Description |
|---|---|---|---|
| `assignedAgent` | string |  | v1:agents:agent.id of the agent claiming this step. Set when status transitions ready -> running; null while pending / ready. |
| `attempt` | integer | yes | Retry counter. Starts at 0; the failed -> ready retry transition increments it. The reconciler caps retries; the engine guard only enforces that a retry actually bumps attempt. |
| `completedAt` |  |  | When the step reached a terminal status (done / failed). |
| `dependsOn` | array |  | v1:harness:step.id list of steps this step depends on -- the DAG in-edges. A step becomes ready once every id in dependsOn is done. Empty = no dependencies (immediately ready). |
| `errorMessage` | string |  | Populated when status transitions to failed. |
| `idempotencyKey` | string | yes | Stable key that dedupes re-runs of the same logical step. Makes step execution safe to retry / replay in the event-sourced loop (#583); a re-emit with the same key collapses onto the same logical step. |
| `input` | object |  | Per-step input payload, carried from the plan input + any prior step's result. |
| `ownerUserId` | string | yes | v1:identity:user.id of the step owner. The per-row authz key (owned tier); stamped from actor.userId at create time. Inherited from the parent plan's owner. |
| `planId` | string | yes | v1:harness:plan.id this step belongs to. Every step hangs off exactly one plan. |
| `provenanceMutation` | string |  | Name of the mutation that produced this step version (addStep / startStep / completeStep / failStep / ...). Pairs with the engine-stamped createdBy intrinsic to name every transition in the audit trail. |
| `result` | object |  | Per-step result, populated when status reaches done. |
| `startedAt` |  |  | When the step first transitioned to running. |
| `status` | string | yes | Step lifecycle. pending = created, dependencies not yet satisfied; ready = dependsOn satisfied, claimable by a controller; running = controller claimed and is executing; blocked = execution paused, needs another step to finish; done = result recorded (terminal); failed = error and attempts exhausted. Transitions are validated by the engine pre-insert guard; invalid ones (e.g. done -> running) are rejected. (enum: pending, ready, running, blocked, done, failed) |
| `title` | string | yes | Human-readable description of the unit of work. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:harness:plan`, `dependsOn` -> `v1:harness:step`, `interactsWith` -> `v1:agents:agent`

## `v1:healing:healedOverride`

A two-tier definition of a self-healable construct: the immutable BASE (authored/embedded, never LLM-healed -- the deploy spine's source of truth) and a healed OVERLAY override (data, produced by the repair loop, human-validated) that shadows its base when valid. Resolution prefers the most-recent VALID overlay override for a baseConstructId and falls back to the base. Mirrors the Epic 1 RBAC base/custom hybrid (immutable predefined base + dynamic custom data, newest-wins). The `tier` field is the immutability axis: a tier=base row is immutable at runtime (the validateHealingBaseImmutable Go guard rejects any non-system-actor write to it, so an override can never be forged as base to escape the override-is-data contract); a tier=overlay row is the healed data an actor may add. Per-row authz: owned -- ownerUserId is stamped from actor.userId on every write and every read gates on ownerUserId==actor.userId. Multi-node consistent via the shared Postgres + the cache.invalidate broadcast.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-deactivate flag. An inactive override is ignored at resolution time but kept for audit -- lets a healed override be retired (reverting resolution to base or an older valid override) without churning row history. Base rows are never deactivated (the immutability guard blocks it). |
| `baseConstructId` | string | yes | Stable id of the BASE construct this row defines or overrides -- the automation name, precondition id, guard id, or literal key the healing loop targets (e.g. 'deployStaging' or 'deployStaging.envIsStaging'). The resolution key: resolveConstruct(baseConstructId) prefers the newest VALID overlay override with this baseConstructId and falls back to the base. Mirrors how v1:rbac:capability.roleSlug + role.slug join a grant to its role by a stable string, not a node id. |
| `blastRadius` | string |  | How widely this heal propagates -- the validation effort axis (E4.5 / memql#2143). Bigger blast radius => a HIGHER minimum role rank is required to validate it (the validateHealingValidationRankBound Go guard gates the valid false->true transition on actor.rank >= the radius-required rank). personal = the heal only affects the owner's own construct (min rank: user); shared = the heal affects a construct other principals depend on (min rank: admin); spine_adjacent = the heal sits next to the deploy spine / cross-cutting infrastructure (min rank: developer). Owner can validate any radius. Mirrors Epic 1's rank model (owner > developer > admin > user). (enum: personal, shared, spine_adjacent) |
| `overrideData` | object |  | The healed construct body -- the typed-patch RESULT (E4.3): the construct definition (e.g. the rewritten automation / precondition / guard / literal) that this override resolves to. Empty for a placeholder/pending row. Named overrideData (not the reserved `payload` intrinsic). The two-tier resolver returns this verbatim when this override wins resolution. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this override -- the user whose construct was healed. Stamped from actor.userId at create time and re-stamped on every update so ownership can never be reassigned by a caller. The load-bearing per-row authz key. For an embedded tier=base row materialized by the SeedMaterializer this is the system owner. |
| `reason` | string |  | Human-readable note explaining WHY this override exists -- the precondition-miss that triggered the heal, the patch kind applied, the validator's comment. Surfaced in the cockpit healed-pack view (E4.6) for auditability. Optional. |
| `rejectionReason` | string |  | Human-readable reason a validator REJECTED this override. Empty unless validationStatus=rejected. Kept for audit so a rejected proposal is recorded, not silently dropped. |
| `sourcePreconditionId` | string |  | Optional back-pointer to the precondition (E4.1) whose miss triggered this heal -- the healing.precondition.missed signal's preconditionId. Empty for a manually-authored override. Lets the cockpit group healed overrides under the precondition-miss that produced them and lets the repair loop reconcile what it has already proposed for a given miss. |
| `tier` | string | yes | The immutability axis. base = the immutable, authored/embedded definition -- the deploy spine's source of truth, never LLM-healed; a tier=base row is materialized only by a system actor (the SeedMaterializer) and the validateHealingBaseImmutable Go guard rejects any non-system-actor write to it. overlay = a healed override produced by the repair loop (E4.4) + human-validated (E4.5); it is editable data an actor may add and is the default for any runtime write. Resolution prefers a VALID overlay over base. (enum: base, overlay) |
| `valid` | boolean |  | Whether this override is a VALID, resolution-eligible definition. Only a valid override shadows its base -- the core of the two-tier contract: resolution prefers a VALID overlay override and otherwise falls back to base. A proposed-but-not-yet-validated override (E4.5 human validation pending) carries valid=false and is invisible to resolution, so an unvalidated heal can never silently take effect. Set true on human acceptance (E4.5). |
| `validatedAt` |  |  | RFC3339 timestamp of the validation/rejection decision. Empty while proposed. |
| `validatedBy` | string |  | v1:identity:user.id of the human who validated (or rejected) this override. Stamped from actor.userId by the validate/reject mutation. Empty while proposed. The audit trail for who accepted a heal at what blast radius. |
| `validationStatus` | string |  | Human-validation state (E4.5). proposed = the repair loop proposed it (valid=false, invisible to resolution); validated = a role-appropriate human accepted it (flips valid=true, captured as a new version); rejected = a human declined it (valid stays false, kept for audit). The validation flow transitions proposed -> validated\|rejected; resolution only ever returns validated+valid+active overlays. (enum: proposed, validated, rejected) |
| `version` | integer |  | Monotonic version of this override for a given baseConstructId -- each accepted heal captures a NEW version (E4.5 capture-as-version) rather than mutating the prior one, so the override history is an audit trail and a pin can resolve an exact version. Resolution prefers the highest-version VALID overlay; ties break on newest createdAt. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:identity:accessRequest`

Self-service access request placed on the waitlist queue. Created when an unknown email submits the registration form while MEMQL_IDENTITY_REGISTRATION_MODE=approval. Admins triage rows in the admin console: approval mints a v1:identity:invitation and emails a magic link; rejection stamps the reason and closes the row. Also auto-aged by the accessRequestExpirySweep cron once IDENTITY_ACCESS_REQUEST_EXPIRY_DAYS has elapsed without a decision. Global scope so admins in any partition (typically owners of the cluster) can review the queue.

| Field | Type | Required | Description |
|---|---|---|---|
| `additionalContext` | string |  | Free-text 'what would you use this for' answer the requester can optionally supply. Helps admins triage but never gates access by itself. |
| `email` | string | yes | Email address the requester wants to register with. Same value flows into the eventual v1:identity:user.primaryEmail on approval. |
| `invitationId` | string |  | Set on approval to the v1:identity:invitation row that was minted to deliver the magic link. Empty for pending / rejected / expired rows. |
| `name` | string |  | Display name supplied at submission time. Optional (some flows ask, some don't). |
| `reviewedAt` |  |  | Timestamp of the admin decision. Empty until reviewed. |
| `reviewedBy` | string |  | v1:identity:user.id of the admin who acted on the row. Empty until reviewed. |
| `reviewerNote` | string |  | Free-text rationale recorded by the admin. Required by UX convention for rejections; optional but encouraged for approvals. Stored verbatim for audit -- never edited. |
| `riskScore` | integer |  | Composite risk score (0-100) computed at submission time from riskSignals. Higher = more suspicious. Surfaced to admins in the queue so they can triage cleanly. Never auto-rejects; admins always make the call. |
| `riskSignals` | string |  | Comma-separated signal tags that fed riskScore. Examples: disposable_domain,velocity_per_ip,typo_squatted_domain,known_breach_email. Admin UI renders each tag as a chip with a tooltip. |
| `sourceIP` | string |  | IP the submission came from. Captured for audit and to feed velocity-per-IP risk signals. |
| `status` | string | yes | Lifecycle. pending = on the queue. approved = admin clicked approve and the invitation was minted. rejected = admin closed the row with reviewerNote. expired = aged out by accessRequestExpirySweep cron. (enum: pending, approved, rejected, expired) |
| `userAgent` | string |  | User-Agent header at submission. Captured for audit; bot-fingerprint heuristics may reference it. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:invitation`

## `v1:identity:accountEntitlement`

Per-account entitlement that caps the number of CONCURRENTLY-RUNNING tasks (Plans) a paying account may have across all of its spaces, sourced from the billing tier (epic memql#902 / foundation child #903). The cap is per paying account -- v1 keys on v1:identity:user.id (accountKind='user'); accountKind='org' is reserved for a future per-organization rollup where many users share one paying account's slots. DEFAULT = UNLIMITED (enterprise behavior): an account with no row here, an enterprise tier, or a non-positive maxConcurrentTasks is uncapped -- the admission controller (#904) is a no-op until a finite cap is written, so existing / unconfigured accounts behave exactly as today (no regression). The NUMBER (maxConcurrentTasks) is the source of truth so billing can change a tier's cap without a code change; tier is carried alongside purely for the Tasks-UX upgrade / limit messaging (#909) and the enterprise=unlimited shortcut. Global scope (lives in _system) so the planner node's admission controller and the billing / admin writer can both reach it from any partition. One logical row per account: setAccountEntitlement mints a deterministic id (accountEntitlement-<hash(accountId)>) so each set appends a new time-series version and the latest wins.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string | yes | The paying account this entitlement applies to. v1: a v1:identity:user.id (accountKind='user'). The admission controller (#904) resolves a Plan's account via Plan.requestedBy and reads the effective cap from the matching row here. |
| `accountKind` | string | yes | Whether accountId names a user or an org. v1 is always 'user' (per-user account); 'org' is reserved for the future per-organization concurrency rollup where many users share one paying account's pool of slots. (enum: user, org) |
| `maxConcurrentTasks` | integer |  | The cap: the maximum number of Plans this account may have running concurrently across all of its spaces. SOURCE OF TRUTH for the number (billing writes it), so a tier's cap changes without a code change. A value <= 0 means UNLIMITED (the default). Ignored when tier='enterprise' (always unlimited). E.g. set to 5 to cap a pro account at five concurrent running tasks; the 6th and beyond wait for a freed slot (#905). |
| `note` | string |  | Free-text operator / billing note about why this entitlement was set (e.g. 'pro plan', 'temporary bump during migration'). Audit aid only; the resolver ignores it. |
| `tier` | string | yes | Billing tier label. Drives the Tasks-UX upgrade / limit messaging (#909) and the enterprise=unlimited shortcut. NOT the source of truth for the cap number -- maxConcurrentTasks is. Defaults to 'enterprise' so a default / unconfigured row stays uncapped. (enum: free, pro, team, enterprise) |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:identity:auditEvent`

Append-only audit log entry. Captures security-relevant events (auth, identity, authorization, configuration, admin) with actor + target + source attribution. Global scope so any cluster operator can read the full trail. Retention controlled by MEMQL_IDENTITY_AUDIT_LOG_RETENTION_DAYS via the daily auditEventRetentionSweep automation. The prevEventHash field is reserved for future hash-chain tamper-resistance; written but not validated in MVP.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | Machine-readable action enum, lower_snake_case. Examples: login_attempted, login_succeeded, magic_link_issued, magic_link_consumed, refresh_succeeded, refresh_token_theft_detected, session_revoked, role_changed, partition_grant_created, registration_mode_changed, jwks_rotated. |
| `actorEmail` | string |  | Email of the actor at the time of the event. Captured here for audit even after the user record is deleted — auditEvent rows are tombstoned, not removed, on user deletion. |
| `actorIdentityId` | string |  | v1:identity:identity.id of the credential the actor used (magic_link, api_key, etc.). Distinguishes 'logged in via web' from 'PAT in CI'. |
| `actorRole` | string |  | Cluster role of the actor at the time of the event (owner / admin / writer / reader). Captured for point-in-time accuracy. |
| `actorUserId` | string |  | v1:identity:user.id of the actor when authenticated. Empty for anonymous events (login attempts where no session yet exists). |
| `category` | string | yes | Coarse grouping for filtering and retention policy hooks. (enum: auth, identity, authorization, configuration, admin, data) |
| `correlationId` | string |  | Groups related events from one logical interaction. Example: a single login flow's attempt + magic-link issued + magic-link consumed + session created share one correlationId. |
| `detail` | object |  | Action-specific structured payload. Schema varies by action; consumer code reads the keys it knows. Examples: {"reason":"idle_timeout"} for refresh failures, {"oldRole":"writer","newRole":"admin"} for role changes, {"riskScore":62,"signals":["disposable_domain","velocity"]} for blocked registrations. |
| `failureReason` | string |  | Free-text or enum reason when outcome=failure or outcome=blocked. Examples: token_expired, insufficient_role, rate_limited, risk_threshold_exceeded. |
| `occurredAt` | string | yes | When the event happened. May lag createdAt by milliseconds because the row is written after the event completes. |
| `outcome` | string |  | Outcome marker for events where success/failure is meaningful. blocked = denied at policy layer (rate limit, risk threshold, etc.). (enum: success, failure, blocked, ) |
| `prevEventHash` | string |  | Reserved for future hash-chain tamper-resistance. SHA-256 hex digest of the previous event's full payload. Written from day one; chain validation enabled by a follow-up iteration. |
| `sourceIP` | string |  | IP address the event originated from. Best-effort — proxy chains and X-Forwarded-For honored only when the deployment trusts the proxy. |
| `targetEmail` | string |  | Email associated with the target, if applicable. Useful for filtering audit history by user without needing a join. |
| `targetId` | string |  | Identifier of the target row when targetType is set. |
| `targetType` | string |  | Concept type of the target row, if any. (enum: user, session, identity, invitation, accessRequest, config, magicLinkRequest, authCode, clusterSettings, ) |
| `userAgent` | string |  | User-Agent header at the time of the event. Empty for non-HTTP-originated events. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:identity`

## `v1:identity:authCode`

One-time OAuth authorization code, RFC 6749 §4.1 style. Minted at /auth/magic-link/consume when the originating magic link carried an oauthCtxJSON (third-party OAuth client flow) and exchanged at /oauth/token for an access + refresh token pair. Single-use, redirect-URI bound, client-ID bound, ~60s TTL. Bound to the specific magic-link row it was minted from so a leaked code cannot be replayed across sessions. Global scope: token redemption is unauthenticated and must work without partition context.

| Field | Type | Required | Description |
|---|---|---|---|
| `clientId` | string | yes | OAuth client identifier the code was minted for. Token-exchange MUST verify the redeeming client matches; mismatched client = reject and audit as code_misuse. |
| `code` | string | yes | Plaintext one-time auth code returned to the OAuth client via redirectURI. Held server-side so the token-exchange handler can verify the presented code value matches; never logged, never surfaced in audit detail. Hash is the lookup key, plaintext is the equality check on redemption. |
| `codeChallenge` | string |  | PKCE code_challenge (RFC 7636) captured when the OAuth context was established. Empty for legacy non-PKCE first-party flows. /oauth/token requires a matching code_verifier when this is set. |
| `codeChallengeMethod` | string |  | PKCE method: S256 (required for new flows) or plain. Empty when codeChallenge is empty. |
| `codeHash` | string | yes | SHA-256 hex digest of the plaintext code. Primary lookup key in the token-exchange path -- avoids equality lookups on the plaintext. |
| `consumedAt` |  |  | Set atomically on the first successful /oauth/token redemption. Non-nil = the code is spent and any further redemption attempt is rejected and audited as code_replay. Single-use enforcement is the load-bearing security property of OAuth auth codes. |
| `consumedFromIP` | string |  | IP the redemption request came from. Captured for audit and anomaly detection. |
| `expiresAt` | string | yes | Absolute expiration. ~60s after creation per RFC 6749 §4.1.2 guidance. Past this point the token-exchange rejects regardless of consumedAt. |
| `identityId` | string | yes | v1:identity:identity.id of the magic_link credential the code was minted from. Stamped onto the session for per-credential lastUsedAt bookkeeping. |
| `magicLinkRequestId` | string | yes | v1:identity:magicLinkRequest.id of the consumed magic link this code was minted from. Provides a 1:1 audit trail (one magic-link click yields exactly one auth code) and lets revoking a magic link cascade-invalidate any outstanding code. |
| `redirectURI` | string | yes | redirect_uri value supplied at /authorize, exact-matched against the registered URI for clientId. Token-exchange MUST verify the redeeming request's redirect_uri matches; mismatched = reject. |
| `state` | string |  | PKCE-style state value supplied at /authorize and echoed back on the redirect to redirectURI. Informational only at this layer (the OAuth client validates state on its end); persisted for audit correlation. |
| `userId` | string | yes | v1:identity:user.id the code authenticates. Stamped onto the resulting session at redemption. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:identity`, `parent` -> `v1:identity:magicLinkRequest`

## `v1:identity:authSession`

Bearer-token session record. One row per access token issued by the identity service's magic-link / refresh flow. Looked up on every authenticated request to enforce per-session revocation; rows past expiresAt are tombstoned by GC, not by user action. Global scope: lives in _system so any partition's middleware can resolve a session.

| Field | Type | Required | Description |
|---|---|---|---|
| `clientLabel` | string |  | Best-effort human label parsed from User-Agent at issuance. Drives the device list in future per-session UIs. |
| `expiresAt` | string | yes | Mirror of the JWT expiry. Sessions past this are dead even if not revoked. |
| `firstAuthenticatedAt` |  |  | Set once on first issuance and never changed. Powers max-age enforcement (refresh fails if firstAuthenticatedAt + MEMQL_IDENTITY_SESSION_MAX_DAYS < now). |
| `identityId` | string |  | v1:identity:identity the session was minted from (typically the magic_link variant). Same caveat as userId. |
| `lastActivityAt` |  |  | Bumped opportunistically by the auth middleware. Useful for surfacing 'last seen' on each device. |
| `lastRefreshedAt` |  |  | Bumped on every successful refresh-token rotation. Powers idle-timeout enforcement (refresh fails if lastRefreshedAt + MEMQL_IDENTITY_SESSION_IDLE_DAYS < now). |
| `previousRefreshTokenHash` | string |  | SHA-256 hex digest of the IMMEDIATELY-PREVIOUS refresh token, kept valid for a short grace window after rotation. Handles the 'client hard-refreshed mid-rotation' case: the server completed the rotation and stored the new hash, but the browser aborted before receiving the Set-Cookie response, so the browser still holds the old token. Within the grace window (see previousRotatedAt) the rotator accepts presentation of this hash and re-issues a fresh pair. Outside the window the field is treated as expired bookkeeping. |
| `previousRotatedAt` |  |  | Wall-clock timestamp at which previousRefreshTokenHash was the current hash. Combined with the rotator's grace-window constant (~30s) to decide whether the previous hash is still acceptable. Past the window, presenting the previous hash returns 401 like any other stale token. |
| `refreshTokenHash` | string |  | SHA-256 hex digest of the current refresh token bound to this session. Rotated on every refresh. Used by the refresh handler to detect token theft (presenting a stale refresh = revoke entire session). |
| `revokedAt` |  |  | Set when the user revokes the session. Non-nil = middleware rejects the bearer token. |
| `revokedReason` | string |  | Why the session was revoked. user_action = the per-device sign-out. all_sessions = the cross-device revoke. admin = staff-initiated. (enum: user_action, all_sessions, admin, ) |
| `source` | string | yes | Which auth flow created the row. bff_exchange = SPA token path (Authorization: Bearer). oidc_cookie = browser memql_auth-cookie path. Both variants are produced by the identity service's magic-link / refresh handlers. (enum: bff_exchange, oidc_cookie) |
| `subject` | string | yes | JWT subject claim. The canonical key for revoke-all; populated unconditionally so all-sessions revoke works even when the user record hasn't been bootstrapped yet. |
| `tokenHash` | string | yes | SHA-256 hex digest of the bearer token. Primary lookup key in the auth hot path; the plain token is never stored. |
| `userId` | string |  | Owning v1:identity:user. Optional because rows are written at token-issuance time, which can race ahead of the magic-link verifier's user-row insert on first-time logins. Subject is the canonical lookup key. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:identity`

## `v1:identity:clusterSettings`

Runtime-editable cluster settings. Single-row concept (id='cluster') that holds the operator-tunable knobs originally bootstrapped from IDENTITY_* env vars. The first-run wizard (Phase 3) writes this row; the admin app (Phase 6) edits it. Service.LiveConfig() reads from here first and falls back to env so a fresh deployment is functional without any post-bootstrap edits. Global scope so the configuration is reachable from every binary that needs it (identity itself plus future per-node verifier middleware).

| Field | Type | Required | Description |
|---|---|---|---|
| `accessRequestNotifyEmails` | string |  | Comma-separated list of operator addresses that get notified when a waitlist access-request is filed. Mirror of MEMQL_IDENTITY_ACCESS_REQUEST_NOTIFY_EMAILS. |
| `accessRequestNotifyThrottleMins` | integer |  | Throttle window in minutes for the access-request notify emails. High-risk requests bypass via immediate-notify. Mirror of MEMQL_IDENTITY_ACCESS_REQUEST_NOTIFY_THROTTLE_MINUTES. |
| `accessTokenTTLSeconds` | integer |  | Lifetime of issued access tokens in seconds. 0 means 'fall back to MEMQL_IDENTITY_ACCESS_TOKEN_TTL_SECONDS env, or the 900s built-in default'. Bounded at the admin form layer to [60, 86400] (1 minute to 24 hours). Read on every /oauth/token + /auth/refresh issuance so changes apply on the next access-token mint without an identity restart. |
| `authoredAutomationsEnabled` | boolean |  | Cluster-wide GLOBAL KILL SWITCH for planner-authored automations (epic memql#954, issue #961). true = activated authored bundles fire normally; false = the authored runtime is halted across the WHOLE cluster -- no authored automation fires on any node until re-enabled, regardless of any individual bundle's status or any per-user kill switch. The governance hard stop for the authored-automation surface. Single-row (id='cluster') so every node reads the same value; flipped via setAuthoredAutomationsEnabled and read by the authored scheduler's global gate. |
| `bootstrapBirthdate` | string |  | Owner's ISO-8601 date of birth captured by the wizard. Same lifecycle. |
| `bootstrapEmail` | string |  | Email captured by the first-run wizard for the cluster owner. Stamped here for audit even though the actual cluster-owner role is granted by the magic-link verifier when the operator clicks the bootstrap link, not from this row. |
| `bootstrapFirstName` | string |  | Owner's given name captured by the first-run wizard. Read once by the magic-link verifier when the bootstrap user row is created (UserProfileSeed) and never used again. Stored on this row because the wizard runs before any user row exists -- there is nowhere else for it to live across the magic-link round-trip. |
| `bootstrapGender` | string |  | Owner's self-identified gender captured by the wizard. Same lifecycle. |
| `bootstrapLastName` | string |  | Owner's family name. Companion to bootstrapFirstName; same lifecycle. |
| `bootstrapPhone` | string |  | Owner's phone number captured by the wizard. Same lifecycle as bootstrapFirstName / bootstrapLastName. |
| `bootstrapPrimaryRole` | string |  | Owner's free-form job title captured by the wizard. Same lifecycle. |
| `bootstrappedAt` | string |  | RFC3339 timestamp stamped by the magic-link verifier when an operator clicks the wizard-issued bootstrap link. Empty means 'wizard hasn't run' OR 'wizard ran but ownership not yet claimed' -- /setup remains accessible in either case. Stored as string (not datetime) so empty-string is a legal value the JSON-schema validator accepts; readers parse it as RFC3339 when non-empty. |
| `brandIconDataURI` | string |  | Optional square brand icon (icon-only mark) encoded as a data URI. Used for compact contexts (favicon, collapsed sidebar, tile previews). Operators frequently want a wordmark in the header AND a tight icon for tabs / share previews -- keeping these as separate fields lets each render at its native aspect ratio. |
| `brandLogoDataURI` | string |  | Optional horizontal brand logo (name+icon mark) encoded as a data URI. Used for the wide-display contexts (header brand, login page top). CSP allows img-src data: precisely so this can render without an external host. |
| `brandName` | string |  | Display name shown in the web UI and in outbound emails. Empty falls back to 'memQL'. |
| `brandPrimaryColor` | string |  | Hex color used as --brand-primary in the web UI. Empty falls back to a neutral blue. |
| `clusterDomain` | string |  | The deployment-wide hostname suffix the operator entered at /setup (or supplied via MEMQL_IDENTITY_BOOTSTRAP_DOMAIN). Examples: local.znas.io, staging.acme.com, acme.com. Every public service URL the cluster builds derives from it: app.<clusterDomain> for the SPA, identity.<clusterDomain> for sign-in, bff.<clusterDomain> for the API, agent.<clusterDomain> for worker registration. Empty before the wizard runs. |
| `internalDefaultRole` | string |  | Cluster-wide role granted to internal users on first login. (enum: owner, admin, developer, writer, reader) |
| `internalDomains` | string |  | Comma-separated email-domain allowlist that flips the per-user 'internal' flag at first login. Internal users get the cluster-wide internalDefaultRole; external users get owner of an auto-created personal partition. |
| `invitationTTLDays` | integer |  | How long an admin-issued user invitation token stays valid, in days. 0 means 'fall back to MEMQL_IDENTITY_INVITATION_TTL_DAYS env, or the 7-day built-in default'. Bounded at the admin form layer to [1, 90]. |
| `magicLinkTTLSeconds` | integer |  | How long an issued magic-link is valid. 0 means 'fall back to MEMQL_IDENTITY_MAGIC_LINK_TTL_SECONDS env, or the 600s built-in default'. Bounded at the admin form layer to [60, 3600] (1 minute to 1 hour). Short by design -- magic-links are click-through credentials, not session tokens. |
| `refreshCookieSameSite` | string |  | SameSite policy for the refresh-token cookie. Empty = inherit from MEMQL_IDENTITY_REFRESH_COOKIE_SAMESITE env (which defaults to 'lax'). 'lax' is correct for the common same-site self-hosted topology (app.acme.com + identity.acme.com share an eTLD+1) and avoids Safari ITP scrutiny. 'none' is required for true cross-site deployments where the SPA and identity service live under different eTLD+1s (app.example.com + auth.example.net); browsers treat the cookie as third-party and apply ITP rules. The cookie is always Secure when BaseURL is HTTPS regardless of this setting. (enum: , lax, none) |
| `refreshTokenTTLSeconds` | integer |  | Absolute lifetime of refresh tokens in seconds. 0 means 'fall back to MEMQL_IDENTITY_REFRESH_TOKEN_TTL_SECONDS env, or the 30-day built-in default'. Bounded at the admin form layer to [86400, 31536000] (1 day to 1 year). Refresh rotation uses this for both the initial mint and the rotation-time max-age check; lowering it does NOT immediately invalidate live sessions but the next rotation that crosses the new ceiling will refuse. |
| `registeredClientsJSON` | string |  | JSON array of {clientId, redirectURIs} entries — the relying parties allowed to initiate the OAuth-style code flow. Stored as a string because the engine doesn't yet support nested arrays of objects in concept fields. Mirrors MEMQL_IDENTITY_REGISTERED_CLIENTS. |
| `registrationDomains` | string |  | Comma-separated allowlist used when registrationMode=domain_restricted. Mirror of MEMQL_IDENTITY_REGISTRATION_DOMAINS. |
| `registrationMode` | string | yes | Who can self-register. Mirror of MEMQL_IDENTITY_REGISTRATION_MODE. (enum: open, domain_restricted, invite_only, waitlist) |

## `v1:identity:delegation`

Grants an AI agent the right to act through a user's v1:identity:identity for a bounded role ceiling, scope set, and lifetime. Global scope: lives in _system and is readable from any partition so cross-partition agent work does not require per-partition delegation rows.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether this delegation is currently in effect. |
| `agentId` | string | yes | Node ID of the v1:agents:agent receiving delegated authority. |
| `approvedBySubject` | string |  | authenticated subject id of the guardian who approved (for synthetic identity delegations). |
| `createdBySubject` | string | yes | authenticated subject id of whoever authorized this delegation. |
| `expiresAt` |  |  | When this delegation expires. Null means persistent (no expiry). |
| `identityId` | string | yes | Node ID of the v1:identity:identity granting authority. Through its userId the delegation resolves back to a v1:identity:user. |
| `identitySubject` | string | yes | authenticated subject id of the delegating identity (denormalized for fast lookup on the auth hot path). |
| `identityType` | string | yes | Type of the delegating identity. Separate from v1:identity:identity.identityType (which classifies the credential family); this classifies the principal behind it. (enum: human, synthetic) |
| `note` | string |  | Human-readable note about why this delegation was created. |
| `revokedAt` |  |  | When this delegation was revoked. |
| `revokedBySubject` | string |  | authenticated subject id of whoever revoked this delegation. |
| `roleCeiling` | string | yes | Maximum role the agent may assume under this delegation. The engine caps the effective role at RoleAtMost(identity.role, roleCeiling). (enum: owner, admin, developer, writer, reader) |
| `scopes` | array |  | Allowed operation scopes. Empty means all operations within the role ceiling. Examples: query:*, mutation:cognition.*. |

**Relationships:** `parent` -> `v1:identity:identity`, `interactsWith` -> `v1:agents:agent`

## `v1:identity:group`

Organization group. Users belong to groups; agents are assigned to groups for scoped access control. Created and managed in-app; the externalId field is preserved for any legacy rows that came from a previous external sync source.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether the group is active. |
| `agentIds` | array |  | Agent IDs assigned to this group. |
| `description` | string | yes | Short description of the group's purpose. Required so group pickers (CreateSpaceModal, admin lists) always have a useful subtitle. |
| `externalId` | string | yes | External group id for legacy sync correlation. Empty for in-app-created groups. |
| `maxAgents` | integer |  | Maximum agent members this group can hold, inclusive of any user's auto-joined assistant. Matches v1:cognition:space.maxAgents. |
| `maxHumans` | integer |  | Maximum human members this group can hold. Matches v1:cognition:space.maxHumans so a group can seed a space without silent truncation. |
| `memberIds` | array |  | User IDs that belong to this group. |
| `name` | string | yes | Display name of the group. |

## `v1:identity:identity`

An account or credential set owned by a v1:identity:user. One user can have many identities: a magic-link verified email, OAuth accounts on external apps, API keys (Personal Access Tokens), or service accounts. Agents borrow identities to act on the user's behalf via v1:identity:delegation. Global scope: lives in _system and is readable from any partition.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-delete flag. Revoked credentials stay around for audit but are inactive. |
| `credentials` | object | yes | Type-specific credential material. Shape is a oneOf picked by identityType: see the @variant block below. Raw OAuth tokens and API-key plaintext never live here. |
| `identityType` | string | yes | Which credential family this identity belongs to. Determines the shape of the credentials object: see the credentials field below. The 'worker_token' variant authenticates a memql-cockpit-worker process (one credential per registered machine); it is server-side-scoped to WorkerService.Stream + audit-emit paths and is rejected by the auth interceptor on every other RPC. The 'node_token' variant authenticates a cluster-internal node binary (bff / voice / cognition / agent / planner / workbench) on NodeService.Stream; the interceptor pins this surface to node-class JWTs and rejects every other class (#105). The 'voice_agent_token' variant authenticates the Go voice-agent process on MemqlService.Stream; surface-pinned to VoiceAgent* payload types so a leaked credential can't drive other RPCs (#109). (enum: oauth, api_key, service_account, magic_link, worker_token, node_token, voice_agent_token) |
| `label` | string |  | Human label shown in UIs, e.g. 'Work email', 'Personal Slack', 'Legacy integration key'. Optional, defaults to a generated summary of the credentials. |
| `lastUsedAt` |  |  | Per-credential last-use stamp. Useful for pruning stale OAuth tokens or unused API keys. User-level 'last seen' lives on v1:identity:user.lastSeenAt. |
| `usableByAgents` | boolean |  | Whether v1:identity:delegation can borrow this identity for agent work. Magic-link identities default false (agents shouldn't impersonate humans wholesale); OAuth identities for specific external apps default true (they exist precisely so agents can act against that app on the user's behalf). |
| `userId` | string | yes | Owning v1:identity:user. Every identity must belong to exactly one user; a user can own many identities. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:identity:invitation`

Token-hashed invitation credential. Maps an invitee (existing user by ID, or external guest by email + token) to an optional product scope hint. The identity layer owns the lifecycle (pending/accepted/expired/cancelled) and the auth primitive; product layers populate partitionId/spaceName and any display-name denormalizations they need. Global-scoped: an unauthenticated /join/<token> resolve has no envelope partition, and even authenticated invitees may live in a different partition than the inviter, so token -> invitation lookup must work without a partition context. Product-side rows that REFERENCE invitations (e.g. the product pack's participation concept) stay partition-scoped on the partition where the work actually happens.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether the invitation is active. Set false to soft-cancel. |
| `expiresAt` |  |  | Absolute expiration timestamp (guest kind only; null for user kind). |
| `inviteeEmail` | string |  | Email address of the invitee (guest kind). |
| `inviteeId` | string |  | User ID of the invitee (user kind). |
| `inviteeName` | string |  | Display name suggested by the inviter. Optional. |
| `inviterId` | string | yes | User ID of the person who issued the invitation. |
| `inviterName` | string |  | Display name of the inviter. Denormalized for notification/email rendering. |
| `kind` | string | yes | user = invite an existing user by ID. guest = invite an external email with a token. (enum: user, guest) |
| `partitionId` | string |  | Product scope hint. The product populates this with a v1:cognition:space ID so the post-accept flow can route the invitee into the right space. |
| `previousTokenHash` | string |  | SHA-256 hex digest of the token this row carried before the most-recent resend rotation, when there was one. Used by the resolve handler to return a UX-friendly `superseded` status for an older link instead of a generic `invalid`. Carries only ONE generation of history -- the rotation before last drops off. Always empty before any resend has rotated the row. |
| `respondedAt` |  |  | When the invitation was responded to. |
| `spaceName` | string |  | Display name of the scope. Denormalized for email rendering. Optional. |
| `status` | string | yes | Lifecycle status. Product layers extend with participation-style values (left/kicked/dismissed) when they bind the invitation to a product record. (enum: pending, accepted, ignored, left, kicked, dismissed) |
| `tokenHash` | string |  | SHA-256 hex digest of the current guest invite token (guest kind only). Primary lookup key in the guest-auth interceptor and on the /join/<token> resolve path. The plaintext token is delivered in the email and never persisted server-side (see memql#108). |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:user`

## `v1:identity:magicLinkRequest`

Pending magic-link authentication request. One row per /auth/magic-link issuance. The plain token is hashed (SHA-256) before persistence -- only the hash lives here so a database snapshot can never be replayed into a login. Single-use semantics: consumedAt is set atomically on the first successful click and any subsequent click against the same row is rejected. Past expiresAt the row is also rejected. Global scope so the public unauthenticated /auth/magic-link/consume endpoint can resolve the row regardless of which partition the eventual user belongs to.

| Field | Type | Required | Description |
|---|---|---|---|
| `consumedAt` |  |  | Set atomically on the first successful consume. Non-nil = the row is spent and any further click against the same token is rejected. Single-use enforcement is the load-bearing security property of magic links. |
| `consumedFromIP` | string |  | Best-effort IP recorded at consume time. Used by the audit log and by anomaly detection (consume from a different country than issuance, etc). |
| `email` | string | yes | Email address the magic link was sent to. Drives the user-lookup / first-time-registration path on consume. |
| `expiresAt` | string | yes | Absolute expiration timestamp. Past this point the row is dead even if not consumed; the consume handler treats expired and consumed identically (both reject). |
| `invitationId` | string |  | Set when the magic link was issued in response to an admin-approved access-request invitation. Empty for self-service login attempts. Lets the consume handler stamp the inviting context on the new user record. |
| `oauthCtxJSON` | string |  | Serialized JSON of the OAuth context the magic link was issued under: {clientId, redirectURI, state}. When present the consume handler mints an auth code instead of a session and redirects to clientId's redirectURI with the code. When absent the consume creates a session directly (first-party SPA flow). |
| `sourceIP` | string |  | IP the issuance request came from. Captured for audit and for risk scoring (issuance velocity per IP). |
| `tokenHash` | string | yes | SHA-256 hex digest of the plain magic-link token. Primary lookup key on consume; the plaintext token is delivered in the email link and never stored server-side. |
| `userAgent` | string |  | User-Agent header at issuance time. Captured for audit and for the consume-time UA-mismatch check (loose; a different browser is allowed). |

**Relationships:** `parent` -> `v1:identity:invitation`

## `v1:identity:oauthClient`

Public OAuth client minted at dynamic client registration (RFC 7591). claude.ai / Claude Desktop's 'add custom connector' flow POSTs to /register and cannot pre-configure a client_id, so the identity service issues one here and looks it up at /authorize + /oauth/token exactly like a static MEMQL_IDENTITY_REGISTERED_CLIENTS entry. Public clients only -- no secret is issued (token_endpoint_auth_method = none). Global scope: registration + token redemption are unauthenticated and must work without a partition context.

| Field | Type | Required | Description |
|---|---|---|---|
| `clientId` | string | yes | Public OAuth client_id issued at dynamic registration (RFC 7591). Lookup key in /authorize + /oauth/token. |
| `clientName` | string |  | Human-readable client_name from the registration request. |
| `grantTypes` | string |  | Space- or comma-joined grant_types (default authorization_code,refresh_token). |
| `redirectURIsJSON` | string | yes | JSON array of registered redirect_uris. Exact-matched (plus RFC 8252 loopback-any-port) at /authorize + /oauth/token. |
| `registeredAt` | string |  | RFC3339 registration time. Mirrors the row's createdAt intrinsic (createdAt is reserved and cannot be a payload field), kept explicit so the RFC 7591 client_id_issued_at can be re-derived without the row envelope. |
| `responseTypes` | string |  | Joined response_types (default code). |
| `tokenEndpointAuthMethod` | string |  | Client auth method; public clients use none (no secret issued). |

## `v1:identity:user`

A person (or synthetic principal). Owns identities. Same record cluster-wide.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether the user account is active. |
| `activePartitionId` | string |  | v1:cognition:space.id this user is currently active in (Phase 4 of the chat-architecture plan). Hard rule: each human is active in at most one space at a time -- camera, mic, voice transport, video presence are all bound to this pointer. Empty / unset means the user is in the app but not focused on any space (or has the app closed). Set by setUserActiveSpace from the SPA's set-active-on-enter wiring; the participant guard derives `isActive` for downstream consumers by comparing this against the participant's partitionId. Discussion mode (Phase 6) and voice migration (Phase 7) both key on this field. |
| `birthdate` | string |  | ISO-8601 date (YYYY-MM-DD), optional. Stored as a string rather than datetime because we never compute against it -- it's reference data the admin sets and the profile UI surfaces. |
| `dataExportLastAt` |  |  | Timestamp of the most recent /me/export download. Drives rate-limiting per MEMQL_IDENTITY_DATA_EXPORT_RATE_LIMIT_HOURS. |
| `deletionScheduledAt` |  |  | Set when the user requested account deletion. The accountDeletionSweep cron hard-deletes the row MEMQL_IDENTITY_DELETION_COOLDOWN_DAYS later. Cleared by cancelScheduledDeletion if the user reverses the request during the cooldown. |
| `displayName` | string | yes | Display name shown in the UI. By convention this is firstName + ' ' + lastName when both are populated; the admin / setup wizard maintain that invariant. Standalone field (rather than a derived computed view) because legacy rows pre-date the firstName/lastName split and we want a stable display value to fall back on. |
| `firstName` | string |  | Given name. Set by the admin via /admin/users/detail (or by the cluster owner via /setup); flows through to the JWT as the OIDC-style `given_name` claim and into the product's profile UI. |
| `gender` | string |  | Optional self-identified gender. Free-form string -- the frontend offers a curated list but the backend doesn't enforce one. |
| `groupIds` | array |  | Group memberships. Reserved for future cluster-side group-based partition-access derivation. |
| `internal` | boolean |  | True when the registering email matched MEMQL_IDENTITY_INTERNAL_DOMAINS at first login. Internal users get the cluster-wide MEMQL_IDENTITY_INTERNAL_DEFAULT_ROLE; external users instead get owner of an auto-created personal partition. Captured at registration so policy decisions remain stable even if the configuration drifts. |
| `lastName` | string |  | Family name. Mirror of firstName -- admin-curated, stamped onto the JWT as `family_name`. |
| `lastSeenAt` |  |  | Updated by the identity service on each successful refresh. Answers 'when was this person last around'. Per-credential last-use lives on v1:identity:identity.lastUsedAt. |
| `legalAcceptance` | array |  | Append-only history of legal-document acceptances. Each entry: {documentType: 'tos'\|'privacy', version: string, acceptedAt: datetime, sourceIP: string}. Audit trail for compliance -- never edited, only appended. |
| `phone` | string |  | E.164 phone number, optional. Set by an admin via /admin/users/detail; required for full app access via the ProfileCompletenessGuard. |
| `preferences` | object |  |  |
| `primaryEmail` | string | yes | Canonical email. Verified by the magic-link flow at registration; the dedup key for 'is this Alice already known?'. |
| `primaryRole` | string |  | Free-form job title / role at the org (e.g. 'CEO', 'Engineer'). Distinct from the cluster-wide auth `role` field above; admin-curated, not auth-related. |
| `revocationEpoch` | integer |  | Monotonically-increasing per-user counter. Stamped into every JWT this user is issued; the verifier rejects any JWT whose revocation_epoch claim is below the user's current value. Bumping this field invalidates every token issued before the bump, on the next stream-open or periodic in-stream re-check (default ~5 minutes). Bulk-revoke / role-change / security-event tooling is the intended writer. See memql#106. |
| `role` | string |  | Cluster-wide role. owner bypasses the partition ACL; admin sees all partitions but still needs a per-partition grant to mutate data; developer is engineering power (authoring + inline DSL + deploy/cut-version, but no user management); writer and reader need an explicit grant for every partition they operate in. (enum: owner, admin, developer, writer, reader) |
| `suspendedAt` |  |  | Set when the user is suspended by an admin. Nil means active. |
| `suspendedReason` | string |  | Human-readable reason for suspension. |

**Relationships:** `interactsWith` -> `v1:agents:agent`

## `v1:identity:workerPairingCode`

Short-lived pairing credential for the computer-use enrollment flow. The frontend's Settings -> Computer Use 'Connect this computer' card mints a row + plain code (XXXX-XXXX, 8 alphanumeric chars from Crockford's Base32 alphabet). The cockpit wizard on the user's machine redeems the code on the cluster's gRPC stream via Authorization: Pair <code>, the redeem handler stamps redeemedAt + redeemedBy, mints a v1:identity:identity worker_token row owned by the same user, and returns the plain mql_wkr_<...> token + cluster URL to the cockpit. Single-use: a row with non-empty redeemedAt is dead. TTL ~10 minutes (IDENTITY_PAIRING_CODE_TTL_MIN, default 10).

| Field | Type | Required | Description |
|---|---|---|---|
| `clusterURL` | string | yes | Canonical cluster URL the cockpit should dial for the WorkerService.Stream. Stamped at create time so the redeem handler can echo it back -- letting the frontend and the BFF be reachable at different DNS names without leaking that detail to the cockpit operator. |
| `codeHash` | string | yes | SHA-256 hex digest of the plain XXXX-XXXX code. Plaintext is shown to the user ONCE on the frontend's Settings card and never persisted. |
| `expiresAt` | string | yes | Absolute expiration timestamp. Redeem rejects rows past this even when redeemedAt is empty. |
| `ownerUserId` | string | yes | v1:identity:user.id who minted the code (and who will own the resulting worker_token + v1:worker:registration). The redeem handler reads this and uses it as the registeredBy for the new worker_token credential. |
| `redeemedAt` |  |  | Stamped on first successful redeem. Single-use semantics: any subsequent redeem against the same row fails with already_redeemed. |
| `redeemedBy` | string |  | v1:identity:identity.id of the worker_token row the redeem minted, for audit trail. Empty until redeemed. |
| `redeemedFromIP` | string |  | Source IP the redeem call came from. Audit signal -- helps detect 'someone else redeemed my code' fraud. |
| `sourceIP` | string |  | IP the create-pairing-code request came from. Audit + abuse signal. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:identity`

## `v1:knowledge:documentChunk`

A single retrievable text chunk attached to a knowledge domain. Chunks are produced by the knowledge ingestion integration (which splits source text and embeds each chunk). The embedding itself lives in the node_vectors table keyed by this chunk's id, via integration.embedding.store with vectorField='content'. Per Q8: text-style breakdowns of user-uploaded Documents (PDF sections, markdown chunks, plain text chunks) reuse this concept rather than duplicating the chunk infrastructure into a new typed concept.

| Field | Type | Required | Description |
|---|---|---|---|
| `documentId` | string |  | Per Q8: optional back-reference to v1:knowledge:document when this chunk came from a user-uploaded file rather than a seeded corpus. Null for seeded UI-corpus chunks; populated for chunks produced by the analyzer. |
| `domainId` | string | yes | ID of the parent v1:knowledge:knowledgeDomain. Queries filter by this to scope retrieval to the agent's selected domains. |
| `seq` | integer |  | Order within the source (0-based). A document of N chunks has seq 0..N-1. |
| `source` | string | yes | Provenance discriminator for audit, UI grouping, and the dev-refresh cache filter. Aligned with the citation-registry source taxonomy on the agent-reply side -- one word, one meaning across the whole stack. 'llmSeeded' = baseline LLM-generated content from seedDomainContent (catalog Tier-A/B bodies, Tier-B disclaimers, Tier-C Wikipedia chunks). 'augment' = topic-focused chunks added via the chat 'Analyze for training' action; carries sourceUtteranceId + sourceAgentId + sourceTopic back-pointers. 'crossDomainBridge' = bridge content generated when an agent has 2+ domains. 'appStructure' = the product UI corpus that drives operator UI moves (cited silently). 'fileUpload' = user-uploaded document content (when wired). 'trainerAgent' = chunks distilled by the Trainer Agent's web-search + reasoning pipeline (Q3, Q9); cited with provenance back to the original web sources via sourceRef. Required: every writer must declare which class of provenance it represents. (enum: llmSeeded, augment, crossDomainBridge, appStructure, fileUpload, trainerAgent) |
| `sourceAgentId` | string |  | When source='augment': bare id of the v1:agents:agent whose retrieval gap surfaced this chunk. Same provenance audit purpose as sourceUtteranceId. |
| `sourceRef` | string |  | Where the chunk came from, e.g. 'opid:agents.new', 'doc:README.md#L42', 'url:https://docs.example.com/agents'. Used for citation in the UI and for idempotent re-ingestion. |
| `sourceTopic` | string |  | When source='augment': the narrow topic the augmentDomainContent prompt was asked to cover (e.g. 'Bronze Age Collapse and the Sea Peoples'). Useful for grouping all chunks generated from one augment action together in the Knowledge panel. |
| `sourceUtteranceId` | string |  | When source='augment': bare id of the v1:cognition:utterance that triggered the augment action. Lets the Knowledge panel show 'Added from chat with <agent> on <date>' provenance and lets a future cleanup audit reach back to the conversation. |
| `superseded` | boolean |  | Per Q9 trainSpecialist mode='refresh': set true when the Trainer Agent marks this chunk outdated (via markChunkSuperseded). Superseded chunks are excluded from retrieval -- they stay in the table for audit / provenance but no longer surface in the system_knowledge block. The replacement chunk (if any) carries fresher content written in the same refresh run. |
| `supersededAt` |  |  | When this chunk transitioned to superseded. Set alongside superseded=true by markChunkSuperseded. |
| `supersededReason` | string |  | The Trainer Agent's stated reason for marking the chunk outdated (e.g. 'superseded by 2026 figures', 'source page removed'). Surfaced in the Knowledge panel's chunk-history view. |
| `text` | string | yes | The chunk text. Kept as plain text so findSimilar can re-embed on demand and the model can render it in the system_knowledge prompt block. |
| `tokenCount` | integer |  | Approximate token count, rough character-length / 4 heuristic. Used for budgeting context windows when assembling the system_knowledge block. |
| `validationStatus` | string |  | Per Q15: validation gating mirror of v1:knowledge:document. validated = ingestible into knowledge domains; rejected = soft-deleted from retrieval. Seeded chunks default to 'validated' since they ship as canonical. (enum: unvalidated, validated, rejected) |

## `v1:library:artifact`

A single Library index row pointing at one underlying source concept (document / generated output / note / to-do / calendar event / memory / live source). Carries the shared provenance + type spine the Library panel needs to list / search / filter / sort across heterogeneous sources, while the actual content stays on the backing concept referenced by sourceConceptRef. The LOCKED backend shape for the Library epic (memql#693): a real index concept, not a UI projection. Per-row authz: owned -- ownerUserId is stamped from actor.userId on every write and every read gates on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | v1:agents:agent.id associated with this item, when one applies (e.g. the agent that produced a generated output or owns a memory). Backs the per-agent facet filter. |
| `format` | string |  | High-level content classification for artifacts -- picks the viewer in the Library (markdown / Word document / PDF / Excel spreadsheet) and falls back to a metadata-only card for 'other'. Mirrors v1:knowledge:document.format with 'document' added for Word-style docs. Null for record-lens rows. (enum: markdown, document, pdf, spreadsheet, image, text, conversation, other) |
| `kind` | string | yes | The flavor of the backing concept. document = uploaded file (v1:knowledge:document); generated_output = an output produced on the workbench / via computer-use / by an agent; note = v1:notes:note; todo = v1:todos:todo; calendar_event = v1:calendar:calendarEvent; memory = user-facing assistant memory; live_source = v1:knowledge:liveSource. Extensible -- new sources append a value. (enum: document, generated_output, note, todo, calendar_event, memory, live_source) |
| `lens` | string | yes | Which Library lens this row belongs to. 'artifact' = file-like, content-bearing item opened in a type-aware viewer (documents, generated outputs). 'record' = structured memql row read/edited as data (notes, to-dos, calendar events, memories, live sources). Drives the Artifacts \| Records toggle in the Library panel. (enum: artifact, record) |
| `live` | boolean |  | True when this row is a live-data source (kind=live_source, source=live). The Library renders a LIVE badge + freshness indicator computed from the backing liveSource's latest liveSnapshot (materializedAt / expiresAt). False for everything else. |
| `mimeType` | string |  | MIME type of the backing bytes when this is a content-bearing artifact, copied from the attachment. Used alongside format to pick the viewer. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this index row. Stamped from actor.userId at create time and re-stamped on every update so ownership can never be reassigned. The load-bearing per-row authz key. |
| `partitionId` | string |  | v1:cognition:space.id this item belongs to, when space-scoped (documents, generated outputs). Empty for user-global records (notes / to-dos / memories). Backs the per-space facet filter. |
| `producedByPlanId` | string |  | v1:planner:plan.id that produced this item, when it came from a plan (documents carry document.planId; generated outputs carry the producing plan). Provenance back-pointer surfaced in the detail view. |
| `producedByWorkerId` | string |  | v1:worker:registration.id of the worker MACHINE that produced this item, when source=computer_use. Lets the Library say WHICH of the user's registered computers a computer-use file came from, and detect when it is the machine the user is currently on. Empty for workbench / agent / uploaded items. |
| `producedByWorkerName` | string |  | Human-readable name of the producing worker machine (e.g. 'MacBook-Pro'), copied from the worker registration at index time so the Library can label 'Computer use - <machine>' without a join. Empty unless producedByWorkerId is set. |
| `scope` | string |  | Shared-vs-private visibility tier, mirrored from the backing source's own scope (currently only v1:knowledge:liveSource carries one). 'workspace' = a partition-shared row with NO single owner (ownerUserId is empty); it is invisible to the owned reads and surfaces instead through the non-owned libraryWorkspaceLiveSources path so every partition member sees it. 'private' = owner-scoped like everything else (gated by ownerUserId==actor.userId). Null for the ordinary owned rows (documents / notes / to-dos / memories) that have no shared tier. (enum: workspace, private) |
| `source` | string | yes | Provenance -- WHERE this item came from. uploaded = user-provided file; workbench_generated = produced in a v1:workbench:workspace container; computer_use = produced at the computer-use level; agent_generated = emitted by an agent as a standalone deliverable; derived = computed from another artifact; live = a current-state read against a live source (paired with live==true). Rendered as the per-row source label in the Library list. (enum: uploaded, workbench_generated, computer_use, agent_generated, derived, live) |
| `sourceConceptRef` | string | yes | Fully-qualified reference to the backing row, e.g. 'v1:knowledge:document:<id>', 'v1:notes:note:<id>', 'v1:knowledge:liveSource:<id>'. The Library drill-in resolves content + children (document->documentChunk, liveSource->liveSnapshot) through this ref. Also the idempotency key for the write-path (one index row per source ref). |
| `summary` | string |  | Optional short summary / description for the list row. From document.summary, liveSource.description, etc. when available. |
| `title` | string | yes | Display title for the list row. Copied from the backing concept at index time (document.fileName, note.title, liveSource.name, etc.). |
| `updatedAt` |  |  | RFC3339 watermark of the most recent change to the backing item, stamped on every index write. The default Library sort key (most-recent first). |
| `validationStatus` | string |  | Validation rollup for document-backed artifacts, mirrored from v1:knowledge:document.validationStatus so the Library can facet on it without a join. 'none' for items that have no validation lifecycle (records, generated outputs). (enum: none, unvalidated, validated, rejected, partiallyValidated, superseded) |

**Relationships:** `parent` -> `v1:identity:user`, `interactsWith` -> `v1:agents:agent`, `interactsWith` -> `v1:planner:plan`, `interactsWith` -> `v1:worker:registration`

## `v1:library:documentVersion`

An immutable content snapshot of one logical Library document at one point in its edit history. Appended -- never overwritten -- whenever a document is produced, edited (by user or assistant), or restored, with a monotonically increasing versionNumber. The artifact index + backing document always point at the LATEST version while the full append-only history is retained behind it. Backed by the MemoryNodes TimescaleDB hypertable (partitioned on createdAt); long-lived, compression-after-90-days, no retention drop (memql#1228). Per-row authz: owned -- ownerUserId is threaded from the document's owner on append; reads gate on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `attachmentId` | string |  | Back-reference to v1:common:attachment when this version is file-backed (a .docx / .pdf / .xlsx snapshot). The bytes live on the attachment row in blob storage; this version carries the metadata pointer. Empty for inline-text versions. |
| `authorId` | string |  | Identity of the author. For authorKind=user, the v1:identity:user.id; for authorKind=assistant, the v1:agents:agent.id; empty for system-authored versions. Read alongside authorKind for the 'edited by X' provenance line. |
| `authorKind` | string | yes | Who authored this version. user = a person edited it directly (memql#1229); assistant = an agent revised it on the user's behalf (memql#1231); system = produced automatically (the initial version on document creation, or a restore append from memql#1230). Drives the history view's author badge and the provenance line. (enum: user, assistant, system) |
| `content` | string |  | Inline text content for this version (markdown / plain text). The immutable body snapshot. File-backed documents leave this empty and carry bytes on attachmentId instead. body and/or attachmentId -- at least one is set. |
| `documentId` | string | yes | Logical document id this version belongs to -- the stable identity of the document ACROSS all its versions (e.g. the v1:library:generatedOutput id, or the artifact's sourceConceptRef). A PLAIN STRING foreign key, NOT an @relationship: it points across concepts to the backing document, and the only valid @relationship types (parent/contains/alias/equals) don't model a cross-concept content-history link. Every version of the same document shares this value; it is the grouping key for the history queries. |
| `note` | string |  | Optional short human-readable note describing the change in this version (e.g. 'fixed the totals', 'restored from v2'). Surfaced in the history list so a user can scan what each version changed without diffing. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns the logical document this version belongs to. Threaded from the backing document's owner on every append (edits run server-side on the owner's behalf, not as the owner); the load-bearing per-row authz key for every history read. |
| `parentVersionId` | string |  | Id of the documentVersion row this one was derived from (the previous latest at append time, or the chosen source version for a restore). The append-only history's back-pointer chain -- empty only for the very first version of a document. |
| `partitionId` | string |  | v1:cognition:space.id the edit happened in, when space-scoped. Carried for facet parity with the artifact index; empty for user-global edits. |
| `producedByPlanId` | string |  | v1:planner:plan.id that produced this version, when an assistant/agent edit came through the planner. Provenance back-pointer mirroring the artifact/generatedOutput spine. |
| `versionNumber` | integer | yes | Monotonically increasing version number within the logical document, starting at 1 for the first snapshot. Computed server-side as (latest existing versionNumber for this documentId) + 1 on every append -- MemQL has no arithmetic, so the increment is done in the Go edit/restore handlers that read the current latest before inserting. The user-visible 'v3' label and the optimistic-concurrency token (an edit naming an expectedVersion that no longer matches the latest is a conflict). |

**Relationships:** `parent` -> `v1:identity:user`, `interactsWith` -> `v1:common:attachment`, `parent` -> `v1:identity:user`, `interactsWith` -> `v1:planner:plan`

## `v1:library:generatedOutput`

A deliverable PRODUCED through the app (as opposed to an uploaded document): a workbench result, a computer-use output, or a standalone agent output. Carries either inline text (body) or a reference to file bytes (attachmentId -> v1:common:attachment). Auto-promoted into the Library by indexGeneratedOutput on creation. Per-row authz: owned -- ownerUserId is the producing user; reads gate on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `attachmentId` | string |  | Back-reference to v1:common:attachment when the output is file-backed (a generated .docx / .pdf / .xlsx). The bytes live on the attachment row in GCS; this concept carries the metadata projection. |
| `body` | string |  | Inline text content for text-style outputs (markdown / plain text) produced directly without a file. File-backed outputs leave this empty and carry bytes on the attachment. |
| `format` | string | yes | Content classification -- picks the Library viewer. Mirrors the artifact.format vocabulary. (enum: markdown, document, pdf, spreadsheet, image, text, other) |
| `mimeType` | string |  | MIME type of the backing bytes when attachment-backed. |
| `ownerUserId` | string | yes | v1:identity:user.id this output belongs to (the user the producing agent / plan acts for). The per-row authz key for Library reads. |
| `partitionId` | string |  | v1:cognition:space.id this output was produced in, when space-scoped. |
| `producedByAgentId` | string |  | v1:agents:agent.id that produced this output, when an agent emitted it. |
| `producedByPlanId` | string |  | v1:planner:plan.id that produced this output, when it came from a plan. |
| `producedByWorkerId` | string |  | v1:worker:registration.id of the worker MACHINE that produced this output, when source=computer_use. Empty otherwise. Copied onto the artifact index row. |
| `producedByWorkerName` | string |  | Human-readable name of the producing worker machine, copied from the worker registration at production time. Empty unless producedByWorkerId is set. |
| `source` | string | yes | Provenance -- where the output was produced. Copied onto the artifact index row's source field. (enum: workbench_generated, computer_use, agent_generated, derived) |
| `summary` | string |  | Optional short description / preview of the output. |
| `title` | string | yes | Display title for the output, e.g. 'Ten most beautiful birds'. |

**Relationships:** `parent` -> `v1:identity:user`, `interactsWith` -> `v1:common:attachment`, `interactsWith` -> `v1:planner:plan`, `interactsWith` -> `v1:agents:agent`, `interactsWith` -> `v1:worker:registration`

## `v1:library:memory`

A durable memory the assistant retains about the user across sessions (a fact, preference, standing instruction, or episodic recollection). The user-facing LLM-memory concept; surfaced in the Library's Records lens. Per-row authz: owned -- ownerUserId stamped from actor.userId; reads gate on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | v1:agents:agent.id that formed / owns this memory, when agent-scoped. Empty for user-global memories. |
| `content` | string | yes | The memory text itself -- what the assistant should recall. |
| `kind` | string | yes | Memory flavor. fact = stable truth about the user; preference = how they like things done; instruction = a standing directive; episodic = a specific past interaction worth recalling. (enum: fact, preference, instruction, episodic, other) |
| `ownerUserId` | string | yes | v1:identity:user.id this memory is about / belongs to. Stamped from actor.userId at create time. The per-row authz key. |
| `partitionId` | string |  | v1:cognition:space.id this memory was formed in, when space-scoped. |
| `sourceUtteranceId` | string |  | Optional back-reference to the v1:cognition:utterance that produced this memory -- provenance for 'where did the assistant learn this'. |
| `summary` | string |  | Optional one-line summary for dense list rendering. |
| `title` | string | yes | Short label for the memory, e.g. 'Prefers concise replies'. The primary display line. |

**Relationships:** `parent` -> `v1:identity:user`, `interactsWith` -> `v1:agents:agent`, `interactsWith` -> `v1:cognition:utterance`

## `v1:memql:checkpoint`

Automation execution checkpoints for failure recovery and audit history.

| Field | Type | Required | Description |
|---|---|---|---|
| `automationFingerprint` | string |  | Content-addressed hash of the automation definition for change detection. |
| `automationName` | string | yes | Name of the automation that was running. |
| `chainHead` | string |  | Chain state before the failed step. |
| `executionId` | string | yes | Unique identifier for this execution instance. |
| `expiresAt` | string | yes | When the checkpoint becomes invalid (ISO 8601). |
| `failedAt` | object |  |  |
| `initialChainHead` | string |  | Starting chain state for chain validation. |
| `input` | string |  | Automation input data for evaluator restoration. |
| `inputFingerprint` | string |  | Hash of input for verification. |
| `savedAt` | string | yes | When the checkpoint was saved (ISO 8601). |
| `stepIndex` | integer |  | Index in the Steps slice where failure occurred. |
| `stepOrder` | array |  | Execution sequence for verification. |
| `stepResults` | object |  | Results for all completed steps before failure (map of stepId to MinimalStepResult). |
| `triggerContext` | object |  |  |

## `v1:notes:note`

A user-owned standalone note: an optional title, a body, and tags, plus an updatedAt watermark. The standalone notebook concept -- distinct from the product pack's canvas-state note caption field. Per-row authz: owned -- ownerUserId is stamped from actor.userId on every write and every read gates on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `body` | string | yes | The note's freeform text content. The substring search operation matches against this field. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this note. Stamped from actor.userId at create time; re-stamped from actor.userId on every update so ownership can never be reassigned by a caller. The load-bearing per-row authz key. |
| `tags` | array |  | Optional list of user-supplied tags for grouping / filtering. The frontend renders these as chips; the search tool can narrow by a single tag. |
| `title` | string |  | Optional short title / heading for the note. Absence is allowed -- a note can be body-only. The primary display field when present. |
| `updatedAt` |  |  | RFC3339 watermark of the most recent edit. Stamped to `now` on every create / update so the frontend can sort by recency. The authoritative version order is still the row's createdAt history; this is a denormalized convenience for the most-recent version. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:observability:codeMetric`

Aggregate observability rollups for a code reference over a time window. Backed by TimescaleDB continuous aggregates over the code_invocation hypertable -- callCount, p50/p95/p99 durations, errorRate -- so the cockpit's drill-down sparkline can query the metric for any (codeReference, kind, window) in O(few rows) regardless of how many raw invocations the function had. Aggregates outlive raw rows: when codeProfile.retentionDays evicts the underlying invocation chunk, the matching codeMetric rows for that chunk are preserved by the policy so the trendline stays continuous.

| Field | Type | Required | Description |
|---|---|---|---|
| `bucket` | string | yes | Bucket size identifier. Mirrors the continuous-aggregate view used to produce the row, kept as a field so consumers don't have to math out the diff. (enum: 1m, 1h) |
| `callCount` | integer | yes | Number of invocations in [windowStart, windowEnd). |
| `codeReference` | string | yes | Fully-qualified node id. Same join key as codeProfile / invocation. |
| `errorCount` | integer | yes | Subset of callCount where errorMessage was non-empty. |
| `errorRate` | number |  | Convenience: errorCount / callCount, populated by the materialization step. Consumers can compute it themselves if the row was hand-inserted. |
| `p50DurationNs` | integer |  | 50th-percentile latency in nanoseconds across the bucket. |
| `p95DurationNs` | integer |  | 95th-percentile latency. |
| `p99DurationNs` | integer |  | 99th-percentile latency. Same scale as p50/p95. |
| `totalDurationNs` | integer |  | Sum of all durations in the bucket. Lets cockpit show 'time spent in X' on the topology overlay without pulling raw rows. |
| `windowEnd` | string | yes | Exclusive end. windowEnd - windowStart is the bucket size; cockpit reads bucket size from the difference rather than from a separate field. |
| `windowStart` | string | yes | Inclusive start of the aggregation window. Matches a TimescaleDB time_bucket boundary -- typically 1m or 1h aligned. |

## `v1:observability:codeProfile`

Live per-function observability configuration. Created on demand: a function only has a codeProfile row when someone wanted to set a non-default level on it (incident response, hot path under investigation, etc.). Resolution at call time is codeProfile -> MEMQL_OBSERVE_LEVEL default -> off. Keyed by codeReference, which matches the model.Node.ID for the Method or Func node in topology.model.json (e.g. 'method:github.com/znasllc-io/memql/component/auth.(*Handler).Login'). Cockpit writes these from the drill-down 'bump verbosity for this method' control; the observe runtime reads them through a CDC-driven cache.

| Field | Type | Required | Description |
|---|---|---|---|
| `codeReference` | string | yes | Fully-qualified node id from the architecture model. Format documented in component/architecture/model/ids.go. The single join key shared by static topology, live profile, raw invocations, and aggregate metrics. |
| `expiresAt` |  |  | Optional automatic-off timestamp. The codeProfileExpiry cron flips level back to 'off' when now > expiresAt. Lets the cockpit say 'bump to verbose for the next hour' without leaking a hot-path tap into the steady state. |
| `level` | string | yes | Capture verbosity. off = not instrumented. count = duration + error only. meta = + arg types/sizes. verbose = + full arg/return values, subject to redaction. (enum: off, count, meta, verbose) |
| `reason` | string |  | Free-text rationale for non-default levels. Surfaces in the cockpit list view so you can audit 'why is this method being captured at verbose?' at a glance. Example: 'INC-2026-05-14 -- intermittent 500s. |
| `redactArgs` | array |  | Names of arguments to force-redact regardless of value. The default redact-by-name pattern catches obvious cases (pass*, token*, secret*); use this to pin individual params that don't match the pattern. NOTE: a //memql:observe source marker on the function declares the SAFE list (its inverse); when both exist, redactArgs here wins. |
| `retentionDays` | integer |  | How long the resulting code_invocation hypertable rows survive before the retention policy drops them. Aggregates (codeMetric rollups) outlive this -- the trendline is preserved, the forensic detail is short-lived. |
| `sampleRate` | number |  | Fraction of calls to capture at the chosen level. 1.0 = every call (verbose locally / on incident). 0.01 = 1% (verbose-in-prod sampling). The runtime's PRNG draws once per call. |
| `setBy` | string |  | v1:identity:user.id of the user who applied this profile. Empty for env-bootstrapped rows. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:observability:invocation`

One captured invocation of a Method or Func. Backed by the code_invocation TimescaleDB hypertable (see scripts/dev/migrations/observability/); rows are time-partitioned, jsonb-compressed after 24h, and dropped per codeProfile.retentionDays. The mutation surface goes through the engine like any other concept so the engine's auth + partition middleware applies uniformly, but the read path on the hot drill-down view is intended to use the continuous aggregates (codeMetric) rather than these raw rows. Hand-querying invocation rows directly is fine for forensic 'last 20 calls to X' lookups.

| Field | Type | Required | Description |
|---|---|---|---|
| `args` | object |  | Captured arguments shaped per codeProfile.level: count -> nil, meta -> name -> shape-string (e.g. 'string(len=42)'), verbose -> name -> value. Redacted entries appear as '<redacted>'. Authoritative redaction rules live in component/observe/helper.go. |
| `codeReference` | string | yes | Fully-qualified node id of the Method/Func that ran. Join key shared with codeProfile and codeMetric. |
| `durationNs` | integer | yes | End - start in nanoseconds. Recorded as an integer to keep the column type SQL-friendly; cockpit renders as ms. |
| `errorMessage` | string |  | Empty on success. Captures the error.Error() text the caller deferred-Read at End(). Truncated server-side at 4KB. |
| `level` | string | yes | Level the row was captured at. Echoed onto the record so a consumer reading the hypertable can tell 'this is a meta-level row, args are shape strings not values' without consulting the profile. (enum: count, meta, verbose) |
| `occurredAt` | string | yes | Wall-clock time when the call started. The hypertable time column. |
| `result` | object |  | Captured return value at verbose level only; nil otherwise. Same redaction rules as args -- a Result tagged for redaction at the call site never lands here verbatim. |
| `spanId` | string |  | Span id within traceId. Same source as traceId. |
| `traceId` | string |  | Distributed-trace identifier when the caller's context carried one (set via observe.SetTraceExtractor). Lets the cockpit cross-link an invocation row to the corresponding span in any OTel-compatible viewer. |

## `v1:planner:plan`

A user-visible unit of work the planner orchestrates. Per the v1 brainstorm Q1 (Option D): Plan + Task model where Plans CAN nest via parentPlanId, Tasks always belong to one Plan and never recurse. Plans are the user mental anchor (the thing the user dropped a file for, asked a question about, or kicked off as a workflow); Tasks are the engineer-facing decomposition. Lifecycle covers queued / routing / running (with sub-states for paused / awaitingFeedback / needsAgent), succeeded / failed / cancelled. The planner emits Tasks per Q3's outline+per-phase incremental strategy: the Plan's `phases` array carries the coarse outline, Tasks emerge per phase with a phase tag.

| Field | Type | Required | Description |
|---|---|---|---|
| `authorizedBy` | string |  | v1:identity:user.id that authorized the trigger (typically same as requestedBy for user.explicit; the agent owner for agent.proactive standing authorizations; literal 'system.allowlist' for system-triggered). |
| `cancelledBy` | string |  | v1:identity:user.id when the user cancelled, or sentinel 'system.timeout' / 'system.tokenBudget' / 'parent.cancelled' for system cancellations. |
| `chatAnchorMessageId` | string |  | Per Q11: when this Plan was spawned from a chat message (user dropped a file or asked a Plan-worthy question), this is the message id the chat completion / awaiting-feedback subordinate line should anchor to. |
| `completedAt` |  |  | When status reached terminal. |
| `computerUseScope` | string |  | Per-Plan declared computer_use scope (Q9 layer 2 narrowing). When non-empty, the planner gates worker tool dispatch to actions within this scope. Must equal or be NARROWER than the agent's standing AgentAuthorization.computerUseScope; an attempt to widen elevates the Plan to awaitingFeedback with reason=scope_elevation_required. Empty = no worker calls allowed for this Plan. NOTE: the `interact` enum value is retired -- the read path treats it as `full`. New Plans should pick observe or full only. (enum: , observe, interact, full) |
| `errorMessage` | string |  | Populated when status transitions to failed. |
| `estimate` | object |  | Per Q5 (LLM heuristic seed + historical refinement): {p50Ms, p90Ms, confidence: 'heuristic'\|'mixed'\|'historical', sampleSize}. Refreshed at phase boundaries. Drives the canvas card estimate strip and the Tasks page row remaining-time. |
| `estimatedAt` |  |  | When the current estimate was computed. |
| `feedbackReason` | string |  | Discriminator on the awaitingFeedback variant. Empty = legacy feedback (free-form question via feedbackRequest). scope_elevation_required = a worker tool call hit a scope wall; the canvas card shows the requested scope + Approve/Deny. kill_switch_engaged = the user flipped User.preferences.computerUseEnabled to false; the card shows a re-enable link. retry_threshold_hit = the Planner Agent gave up after Plan.retryThreshold consecutive failures at the same logicalStepId; the canvas card asks the user 'what should we try next?'. budget_approval_required = the up-front token/cost estimate for this Plan exceeded the approval threshold (epic #836 / #837 child); the Plan parked BEFORE any planner LLM call and the canvas card shows the estimate + Approve/Decline -- on Approve the frontend sets metrics.budgetApproved=true and resumes the Plan, on Decline it cancels. specialist_approval_required = the planner wanted to create/extend a specialist or spawn a training plan (expensive: Opus trainer + web fetches + embeddings) for work that isn't a clearly durable, reused capability (epic #836 / #842); the Plan parked and the card asks the user to approve creating the new capability -- on Approve the frontend sets metrics.specialistApproved=true and resumes, otherwise the planner completes with an existing agent. phase_checkpoint = a multi-phase plan finished a phase and the next phase is non-trivial (epic #836 / #840); the Plan parked at the phase boundary so the user can review progress + spend-so-far and approve continuing rather than the whole program firing at once -- on Approve the frontend resumes and the next phase activates. (enum: , feedback_required, scope_elevation_required, kill_switch_engaged, retry_threshold_hit, budget_approval_required, specialist_approval_required) |
| `feedbackRequest` | object |  | Per Q18 (awaitingFeedback status): {question, kind: 'choice'\|'text'\|'multi', options?: [{label, value}], requiredFields?, askedAt, askedByTaskId, timeoutAt}. Set when status transitions to awaitingFeedback; cleared on resume. |
| `feedbackResponse` | object |  | User's response to the most recent feedbackRequest: {response, respondedBy, respondedAt}. Carried into the agent's resume context. |
| `goal` | string | yes | Human-readable description of what the Plan is trying to accomplish. Surfaced on the Tasks page row + on the plan.created canvas card. LLM-generated from trigger context. |
| `input` | object | yes | Per-kind input shape. analyzeFile: {attachmentId, hint?}. refineAnalysis: {parentPlanId, feedback}. conductResearch: {query, scope}. executeWorkflow: {workflowId, args}. Discriminated by kind; validated at create. |
| `kind` | string | yes | Plan-kind discriminator. v1 surface: analyzeFile, refineAnalysis, embedDomainItems, inferEntitySchema, materializeSpreadsheetRows, agentProactive, conductResearch, executeWorkflow, trainSpecialist (Trainer Agent dispatch), adHocAction (synthetic single-Task wrapper for ad-hoc tool calls in chat). New kinds added as planner tool surface grows. Estimation buckets key on (kind, phase.kind). |
| `metrics` | object |  | Per Q7 rolled-up metrics: {startedAt, completedAt, totalDurationMs, totalTokensSpent, planningTokensSpent, executionTokensSpent, llmCallCount, toolCallCount, retryCount, replanCount, modelBreakdown[{tag, tokens}], phaseBreakdown[{kind, durationMs, tokensSpent}]}. Updated incrementally; finalized at terminal status. Backs estimation buckets + the plan.completed card. |
| `mode` | string |  | Optional discriminator within a kind. Currently used by trainSpecialist Plans: mode='initial' for a fresh training run, mode='refresh' for an incremental update on an existing knowledge domain (the Trainer's prompt branches on this). Empty/null for kinds that don't carry a mode. |
| `output` | object |  | Per-kind output shape, populated at terminal status. analyzeFile: {summary, documentId, structuredCount, knowledgeDomainSuggestions[]}. refineAnalysis: {refinedSummary, additionalSections[]}. Built by the planner at Plan-completion time from rolled-up Task outputs. |
| `ownerAgentId` | string |  | v1:agents:agent.id of the agent the planner assigned. Set when status transitions queued -> routing -> running. Null while queued/routing or while in needsAgent state. |
| `parentPlanId` | string |  | When set, this Plan is a CHILD Plan -- spawned by a parent Plan's running agent via requestSubPlan, OR spawned as a refinement of a completed Plan via the user's [Refine ...] action on the plan.completed card. Sub-plans inherit parent's authorization (Q4) and carved-out token allocations (Q6). Cancelling a parent cancels all running children; cancelling a child does NOT cancel the parent. |
| `partitionId` | string | yes | v1:cognition:space.id this Plan belongs to. Tasks page is per-space; estimation buckets and budget rollups scope to the space. |
| `pauseExtendsDeadline` | boolean |  | Per Q12: by default pause time counts against the 8-hour deadline. User can flip per-Plan to 'pausing extends my deadline'. |
| `pausedAt` |  |  | When last paused. Null if never paused or currently running. |
| `phases` | array |  | Per Q3 (outline+per-phase incremental): coarse outline generated at Plan-creation time, refined per phase. Each phase: {kind: string, label: string, status: 'pending'\|'active'\|'done', expectedTaskCount: int, completedTaskCount: int, startedAt?: datetime, completedAt?: datetime, estimate?: {p50Ms, p90Ms, confidence}}. Drives the Tasks page progress strip + estimation rollup. |
| `recommendationCardId` | string |  | Set when status=needsAgent and a plan.needsAgent canvas card was emitted; lets the agent-create flow find this Plan when the user clicks [Create X agent] on the card and re-route on agent save (Q22). |
| `refinementContext` | object |  | For refinement child Plans (Q9): {parentPlanId, userFeedback, parentResultSnapshot}. The planner uses this to constrain the agent's prompt -- 'this isn't a new analysis from scratch; refine what's already there'. Distinct from input so the planner can quickly distinguish refinement from fresh analysis. |
| `requestedBy` | string | yes | v1:identity:user.id of the user whose action created the Plan. Owner-private canvas cards key off this; Tasks page filters when scoped to 'my plans'. |
| `retryThreshold` | integer |  | Max attemptNumber the Planner Agent will allow for any single logicalStepId before escalating to awaitingFeedback with feedbackReason='retry_threshold_hit'. Per-Plan tunable; defaults to 3. The Planner Agent enforces this in its prompt logic by emitting 'escalate' when attempts exhaust; the engine doesn't enforce a hard cap. |
| `startedAt` |  |  | When the agent picked up the Plan and Tasks began running. |
| `status` | string | yes | Lifecycle. planning = freshly created; the planner agent is decomposing the goal into phases + emitting task definitions, nothing is dispatched yet. queued = planning is complete; phases + tasks are visible and the plan waits for the USER (or an automation) to click Run -- this is 'awaiting human Run', NOT 'awaiting a free execution slot'. waitingForSlot = the user DID click Run but the account is at its tier's concurrent-task cap (epic memql#902 / admission controller #904), so the Plan is parked in the per-account FIFO waiting queue and will be admitted to running when a slot frees (#905); distinct from queued (the user already chose to run it) and from paused (the user did not pause it -- the system is throttling concurrency). routing = planner is picking an agent. running = agent's Tasks executing (occupies one of the account's concurrency slots). paused = user paused (Q12) or feedback timeout (Q20). awaitingFeedback = agent called requestUserFeedback. needsAgent = no good-fit agent in space, parked awaiting user create. succeeded / failed / cancelled = terminal. (enum: planning, queued, waitingForSlot, routing, running, paused, awaitingFeedback, needsAgent, succeeded, failed, cancelled) |
| `tokenAllocatedToChildren` | integer |  | Sum of unspent allocations to running child Plans. Subtracted when checking child-spawn capacity; returned to available budget when the child completes. |
| `tokenBudget` | integer |  | Per Q6 (Plan-level enforcement): allocated at creation from User.preferences.defaultPlanTokenBudget. Hard-stop ceiling: pre-call check rejects if tokenSpent + estimatedCallCost > budget. Null = use the user default. |
| `tokenCapDisabled` | boolean |  | Per-Plan opt-out (Q6). When true, no soft warnings, no hard stop. Observability metric still records spend. |
| `tokenSpent` | integer |  | Rolled up from Task token costs + planner's own LLM calls (outline / per-phase replanning / estimate prompts). Surfaced as the token bar on Tasks page rows. |
| `totalPausedMs` | integer |  | Sum of paused durations across the Plan's life, for 'how long was this actually working' observability. |
| `triggerSource` | string | yes | Per Q4: user.explicit = user dropped file / clicked button; user.implicit = user said something in chat that Cognition triaged as plan-worthy; agent.proactive = an agent decided on its own; system = cron / automation; subplan.inherited = parent Plan spawned this child Plan. (enum: user.explicit, user.implicit, agent.proactive, system, subplan.inherited) |

**Relationships:** `interactsWith` -> `v1:agents:agent`

## `v1:planner:responsibility`

A user-authored standing directive aimed at an agent (epic #631 / program #629). Three archetypes discriminated by `trigger`: REACTIVE (a `condition` is evaluated against incoming signals; fires when it matches -- e.g. 'when a customer escalation mentions a refund, draft a reply'), STANDING (a behavioral always-on directive with no schedule or condition -- e.g. 'always keep the project tracker tidy'), and RECURRING (a cron `schedule`; the old standingTask -- e.g. 'every Monday 9am summarize last week's marketing performance'). Per-user; the optional scopePartitionId pins the directive to one space. Consumed by the reactive-loop epic #632 (dueResponsibilities feeds the heartbeat-driven evaluator; recordResponsibilityEvaluation closes the loop). Replaces the retired standingTask concept -- recurring directives carry the same cron schedule + soft-disable + last-run bookkeeping standingTask had.

| Field | Type | Required | Description |
|---|---|---|---|
| `assignedAgentId` | string |  | v1:agents:agent.id of the agent that runs this responsibility, when targetKind names a concrete agent. The agent's domains/keywords/tools are what's available during execution. |
| `assignedRoleSlug` | string |  | Role slug the directive targets when bound by role rather than a concrete agent instance (e.g. 'marketing-analyst'). Resolved to an agent at dispatch time. |
| `condition` | object |  | Match condition for trigger='reactive' -- the structured predicate the evaluator checks incoming signals against (e.g. {kind:'utterance', contains:['refund','escalation']}). Empty/null for standing + recurring. |
| `enabled` | boolean |  | When false the evaluator/runner skips this responsibility. Soft-disable without archiving. |
| `intakeRequest` | object |  | The 0-2 genuinely-ambiguous clarifying questions the responsibilityIntake prompt emitted (issue #637). Shape mirrors Plan.feedbackRequest: {questions:[{id, question, kind:'choice'\|'text', options?:[{label,value}]}], askedAt}. Empty when intake was clear. The frontend's intake card renders these; the user's answers come back through foldResponsibilityIntakeAnswers. |
| `intakeResponse` | object |  | The user's answers to intakeRequest, folded back by foldResponsibilityIntakeAnswers (issue #637): {answers:[{id, answer}], respondedAt}. Carried for audit; the dispatcher uses it to re-infer the final field set before flipping the row to active. |
| `intakeStatus` | string |  | Intake lifecycle (issue #637). Empty = intake has not run yet (freshly created draft). pending = the intake dispatcher claimed this row and is reasoning. awaitingAnswers = intake produced 1-2 clarifying questions on intakeRequest and is parked until the user answers (mirrors the Plan awaitingFeedback surfacing). clear = intake found the statement unambiguous (no questions) -- the row goes straight to status='active'. applied = the user's answers were folded back via foldResponsibilityIntakeAnswers and the row was activated. Distinct from status so the management UI can show 'needs a quick answer' without overloading the draft/active lifecycle. (enum: , pending, awaitingAnswers, clear, applied) |
| `lastEvaluatedAt` |  |  | Last time the evaluator/runner fired this responsibility (reactive: last condition check; recurring: last scheduled tick; standing: last review). Empty means it has never run. Set by recordResponsibilityEvaluation. |
| `lastResult` | string |  | Headline of the most recent evaluation/run's result. UI surface for 'last output' widgets. Set by recordResponsibilityEvaluation. |
| `notifyHow` | string |  | How the run's output reaches the user (epic #631 / issue #637 intake). Free text inferred by the responsibilityIntake prompt -- e.g. 'a chat message in the daily space', 'a notification the day before', 'silently update the tracker'. Empty until intake runs or the user supplies it. |
| `ownerUserId` | string | yes | v1:identity:user.id who authored this responsibility. Per-row authz owner; output posts into this user's surfaces. Server-stamped from actor.userId at create -- never caller-supplied. |
| `schedule` | string |  | Cron-style schedule string for trigger='recurring' (e.g. '0 9 * * 1' for Monday 9am). Empty/null for reactive + standing directives. |
| `scopePartitionId` | string |  | Optional pin to one v1:cognition:space.id. When set, the directive only applies within that space; when empty, it applies across the owner's spaces. |
| `statement` | string | yes | Human-readable directive the agent acts on (e.g. 'Every Monday morning summarize last week's marketing performance'). The user's words; shown on cards + settings UIs and fed into the agent's prompt at evaluation/run time. |
| `status` | string | yes | Lifecycle. draft = authored, not yet activated; active = live, evaluated/dispatched; paused = temporarily held (distinct from enabled=false which is a per-run skip); archived = retired, hidden from active lists. Transitioned via setResponsibilityStatus. (enum: draft, active, paused, archived) |
| `successCriteria` | string |  | How the user (or evaluator) judges a run as successful -- free text the agent's prompt and the evaluation record use to decide lastResult quality. |
| `targetKind` | string | yes | Who carries out the directive. assistant = the user's General Assistant; specialist = a named specialist agent (assignedAgentId / assignedRoleSlug); unassigned = no agent bound yet (drafted, awaiting assignment). (enum: assistant, specialist, unassigned) |
| `trigger` | string | yes | Archetype discriminator. reactive = fires when `condition` matches an incoming signal; standing = always-on behavioral directive (no schedule, no condition); recurring = cron-scheduled (the old standingTask). dueResponsibilities keys off this: recurring rows are due when `schedule` ticks, reactive rows are due when pending evaluation. (enum: reactive, standing, recurring) |

**Relationships:** `parent` -> `v1:identity:user`, `interactsWith` -> `v1:agents:agent`

## `v1:planner:task`

One executable step inside a Plan. Two flavors discriminated by `category`: 'semantic' rows are what the Planner Agent decomposes a Plan into (one per logical step); 'toolInvocation' rows are auto-stamped by the engine on every tool call an agent makes (one per call). Tool-call rows attach to their executing semantic row via `parentTaskId`, giving one level of recursion -- semantic Tasks never have a `parentTaskId`, tool-call Tasks always do. Sub-goal nesting still happens at the Plan level via `parentPlanId` (Q1); the recursion here is purely mechanical record-keeping. Per Q13 each Task declares its executionSurface so the planner can route inProcess work to the agent node and containerExecutor work to NemoClaw / homegrown sandboxes.

| Field | Type | Required | Description |
|---|---|---|---|
| `attemptNumber` | integer |  | Which attempt at logicalStepId this row represents. Increments per retry. The Planner Agent enforces the per-Plan retryThreshold by emitting an 'escalate' action when attemptNumber > Plan.retryThreshold. |
| `category` | string | yes | What kind of record this is. 'semantic' = Planner-created decomposition step (the user-meaningful unit). 'toolInvocation' = engine-auto-stamped record of a tool call by an executing agent. Engine validation: category='toolInvocation' MUST have parentTaskId set pointing at a category='semantic' row; category='semantic' MUST have parentTaskId=null. (enum: semantic, toolInvocation) |
| `completedAt` |  |  |  |
| `dependsOn` | array |  | Per memql#1180 (full task DAG, the v0.2+ upgrade the seq comment foretold): the logicalStepId values of sibling Tasks in the same Plan that must reach succeeded before this Task may start. References logicalStepId (planner-assigned, stable across retries) -- NOT task id, which is minted server-side at insert and so unknowable to the emitting planner. Empty = no intra-Plan dependency: a DAG root, eligible to dispatch as soon as its phase is active. The batch-execution lane (task_fanout) topologically layers tasks by these edges: INDEPENDENT tasks (same DAG layer) dispatch CONCURRENTLY, bounded by the per-account admission cap (#902); dependents wait for their layer. When NO task in the Plan declares dependsOn the lane falls back to the coarse phase+seq ordering (back-compat). phase stays the human-facing grouping on the Tasks page; dependsOn is the fine-grained execution backbone. |
| `errorMessage` | string |  | Populated when status transitions to failed. |
| `executionSurface` | string | yes | Per Q13: inProcess = runs inside the agent node's process (LLM + tool calls only); containerExecutor = runs in a sandboxed container (NemoClaw today, future homegrown variants pluggable). Default inProcess. (enum: inProcess, containerExecutor) |
| `executorBackend` | string |  | When executionSurface=containerExecutor, names the registered backend ('nemoclaw' / future ids). Workspace config can set a default; per-Task override via this field. |
| `input` | object | yes | Per-kind input shape, carried forward from the parent Plan's input + any prior Task's output as the planner emits this Task. |
| `kind` | string | yes | Sub-discriminator inside a category. For category='semantic': fileProcessor, llmAnalyze, embedChunks, dedupCheck, browseUrl, browseClick, browseRead, runCommand, callTool, persistResult. For category='toolInvocation': the tool name (e.g. 'webSearch', 'clawReadFile', 'workerComputer'). Estimation buckets key on (plan.kind, task.kind). |
| `logicalStepId` | string |  | Stable identifier for the semantic step this Task is an attempt at. Set by the Planner Agent at decomposition time; shared across retry attempts so threshold counting is a simple group-by. Only meaningful for category='semantic' rows; null for toolInvocation rows. |
| `metrics` | object |  | Per-Task observability rollup: {startedAt, completedAt, durationMs, tokensSpent, llmCallCount, toolCallCount, modelBreakdown[{tag, tokens}]}. Rolls up into the parent Plan's metrics. |
| `output` | object |  | Per-kind output shape, populated when status reaches succeeded. The Plan's output is computed from its Tasks' outputs (or directly assigned by the planner at Plan-completion time). |
| `parentTaskId` | string |  | Set only when category='toolInvocation'; points at the semantic Task that was executing when this tool call fired. Lets us reconstruct 'all the things that happened while Architect was producing the system design' with one query. One level of recursion only. |
| `parkedAt` |  |  | Per Q18: set when the Task hits a checkpoint while parent is paused / awaitingFeedback. The runner exits cleanly; on resume the planner re-invokes from the parkedAtCheckpoint marker + persisted TaskState. |
| `parkedAtCheckpoint` | string |  | Task-kind-specific resume marker. fileProcessor: 'between-pages'; llmAnalyze: 'between-calls'; runCommand: 'between-commands'. The agent's resume code path knows what each marker means. |
| `phase` | string |  | Per Q3: phase tag matching one of the parent Plan's phases[].kind values. Lets the Tasks page render 'Phase 2 of 4: classifying' progress without joining tables. |
| `planId` | string | yes | v1:planner:plan.id this Task belongs to. Every Task -- semantic or toolInvocation -- lives under exactly one Plan, even ad-hoc tool calls in chat (which get a synthetic single-Task Plan of kind=adHocAction). |
| `seq` | integer | yes | Order within the parent Plan. Tasks within a phase execute in seq order, UNLESS dependsOn[] is set (then the DAG drives ordering and seq is only a stable tie-break within a DAG layer). |
| `startedAt` |  |  |  |
| `status` | string | yes | Lifecycle. queued = emitted by planner; running = agent executing; paused = parent Plan is paused or this Task hit a checkpoint while parent is paused (Q12); succeeded / failed / cancelled = terminal. Cancellation cascades from the parent Plan. (enum: queued, running, paused, succeeded, failed, cancelled) |
| `toolArgs` | object |  | Tool-call arguments captured at dispatch time. Populated for category='toolInvocation'; empty for category='semantic'. |
| `toolName` | string |  | Populated by the auto-stamper for category='toolInvocation'. The bare tool name as the agent invoked it. Empty for category='semantic'. |
| `toolResult` | object |  | Tool-call result captured when the dispatched call returned. Populated for category='toolInvocation' when status=succeeded. Empty for category='semantic'. |

**Relationships:** `parent` -> `v1:planner:task`, `parent` -> `v1:planner:plan`

## `v1:planner:taskState`

Persisted working state of a Task that's parked awaiting user feedback (or has been paused mid-execution). The async-parking + planner re-invocation model from Q18: when an agent calls requestUserFeedback, the agent's process exits cleanly after persisting its working state; when the user responds, the planner re-invokes the agent with this state as bootstrap context. Same machinery powers Pause/Resume (Q12) and refinement-Plan parent-Task resumption (Q9). Per Task; written when the Task transitions to awaitingFeedback / paused; read on resume.

| Field | Type | Required | Description |
|---|---|---|---|
| `pendingSubPlanIds` | array |  | Sub-Plan ids the agent was orchestrating when it parked. Resume waits on these to complete before continuing. |
| `reasoningChain` | string |  | The agent's internal 'what I'm doing and why' summary so it can pick up the thread on re-invocation. |
| `taskId` | string | yes | v1:planner:task.id this state belongs to. One row per (taskId, persisted-version-seq); the planner reads the latest on resume. |
| `toolCallHistory` | array |  | Replayable tool-call log: list of {toolName, args, result, error?} in order. Agent prompt either replays or uses as a 'what's been done so far' summary. |
| `workingMemory` | object |  | Intermediate results from previous tool calls in this Task. Free-form per agent kind; the agent's prompt template knows how to consume. |

**Relationships:** `parent` -> `v1:planner:task`

## `v1:platform:globalSecret`

Instance-wide encrypted secret. Lives in the reserved _system partition (via @scope("global")). The cleartext value is NEVER stored -- only a NaCl secretbox ciphertext (base64(nonce||ct)) under MEMQL_MASTER_KEY and a short fingerprint for UI display. Used for instance-level API keys, OAuth client secrets, Azure/Graph credentials, etc. For per-tenant overrides (BYOK) use v1:platform:partitionSecret; the resolver falls back partition -> global automatically.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | When false the resolver skips this row and falls back. Useful for rotating a key without deleting history. |
| `addedBy` | string |  | Identity subject that wrote the secret. |
| `description` | string |  | Human-readable description of the secret's purpose. |
| `encryptedValue` | string | yes | Base64-encoded nonce \|\| NaCl-secretbox ciphertext, sealed under MEMQL_MASTER_KEY. Opaque -- never rendered to humans. |
| `fingerprint` | string | yes | Last 4 chars of the cleartext, prefixed with '...'. For UI display only; lets operators tell rotated secrets apart without leaking the value. |
| `kind` | string |  | Optional tag to group secrets by type. Examples: 'vendor_api_key', 'oauth_secret', 'smtp_password'. Folded router API keys use 'vendor_api_key'. |
| `lastUsedAt` |  |  | Last time the resolver decrypted this secret. Empty until first use. |
| `name` | string | yes | Secret name (uppercase with underscores by convention). |
| `rotatedAt` |  |  | Timestamp of the most recent rotation (optional). |

## `v1:platform:globalVariable`

Instance-wide plaintext configuration variable. Lives in the reserved _system partition (via @scope("global")) and is visible to every tenant. Used for instance-level defaults like provider names, feature flags, log levels, and tuning knobs. For per-tenant overrides use v1:platform:partitionVariable. For sensitive values use v1:platform:globalSecret.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | When false the resolver ignores this row. |
| `description` | string |  | Human-readable description of the variable's purpose. |
| `name` | string | yes | Variable name (uppercase with underscores by convention). |
| `value` | string | yes | Variable value, always stored as string. Callers parse if they need typed data. |

## `v1:platform:missingCapability`

A capability the platform itself cannot yet provide -- a missing tool, missing integration, missing liveSource connector kind, missing knowledge domain category, etc. Distinct from v1:cognition:unmetCapability which fires when the chat router can't find a specialist for an utterance: missingCapability fires when even creating the right specialist wouldn't solve the problem because the underlying platform surface doesn't exist. Logged by the Planner Agent during its capability-gap detection step before agent creation. Becomes the product backlog -- 'these are the things the platform can't do yet that users actually want.' Global-scoped so it's visible across tenants for prioritization.

| Field | Type | Required | Description |
|---|---|---|---|
| `capability` | string | yes | Short identifier for the missing thing, e.g. 'sendSlackMessage', 'jira.createIssue', 'erp.inventory.live'. Stable across multiple sightings so duplicate signals collapse onto one row. |
| `description` | string | yes | Human-readable description: what the platform was being asked to do that it couldn't. Surfaced in the product backlog view. |
| `exampleGoals` | array |  | List of Plan.goal strings that triggered this gap. Capped at the most recent N (engine policy); gives the prioritization view 'real users wanted X, Y, Z'. |
| `firstSeenAt` |  |  | When the first sighting was logged. |
| `kind` | string | yes | What category of platform extension would close this gap. 'tool' = an agent-callable action that doesn't exist yet (e.g. 'sendSlackMessage'). 'integration' = a backing service we don't speak to yet (e.g. Jira). 'liveSource' = a volatile data source we'd want bound to agents but don't have a query for. 'connectorKind' = a brand-new liveConnector implementation kind (e.g. 'snowflake'). 'knowledgeDomain' = a category-level gap, e.g. agents trying to act in a domain we never seeded. 'modelCapability' = a model-level feature we don't support yet (e.g. structured-output with strict schemas on a new provider). (enum: tool, integration, liveSource, connectorKind, knowledgeDomain, modelCapability, other) |
| `lastSeenAt` |  |  | When the most recent sighting was logged. |
| `partitionId` | string |  | Optional space scope where the gap was detected. Useful for attributing 'this gap blocked work in space X'. |
| `partitionScope` | string |  | Partition where the gap was detected. Empty = unknown. Helps de-duplicate platform-wide vs tenant-specific gaps. |
| `requestedByAgentId` | string |  | v1:agents:agent.id of the agent (typically the Planner Agent) that logged the gap. Empty for system-level detection. |
| `requestedFromPlanId` | string |  | v1:planner:plan.id where the gap was detected. Lets the platform team trace back to 'what was the user trying to accomplish when we hit this wall'. |
| `resolution` | string |  | Free-text note when status='resolved' or 'wontfix' explaining what shipped (or why we won't ship it). |
| `sightingCount` | integer |  | How many times this gap has been logged. New sightings of the same (kind, capability) increment rather than creating new rows. Drives 'most-requested capability' prioritization. |
| `status` | string |  | Lifecycle. 'open' = logged, nothing done yet. 'in_progress' = the platform team is working on it (manually set). 'resolved' = the capability shipped; the Planner Agent's next sighting will recreate as a fresh row if it still doesn't work. 'wontfix' = explicit dismissal. (enum: open, in_progress, resolved, wontfix) |

**Relationships:** `interactsWith` -> `v1:planner:plan`, `interactsWith` -> `v1:agents:agent`

## `v1:platform:partitionSecret`

Partition-scoped encrypted secret. Holds per-tenant sensitive values (BYOK vendor API keys, per-tenant Twilio/SMTP creds, etc.). Same wire shape as v1:platform:globalSecret, different scope. The cleartext value is NEVER stored -- only a NaCl secretbox ciphertext under MEMQL_MASTER_KEY and a fingerprint. When the partition-scoped resolver (resolveSecret) cannot find a row, it falls back to v1:platform:globalSecret so a tenant's BYOK key wins over the instance default but the instance default is always available.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | When false the resolver skips this row and falls back to the global v1:platform:globalSecret. |
| `addedBy` | string |  | Identity subject that wrote the secret. |
| `description` | string |  | Human-readable description of the secret's purpose. |
| `encryptedValue` | string | yes | Base64-encoded nonce \|\| NaCl-secretbox ciphertext, sealed under MEMQL_MASTER_KEY. Opaque -- never rendered to humans. |
| `fingerprint` | string | yes | Last 4 chars of the cleartext, prefixed with '...'. For UI display only. |
| `kind` | string |  | Optional tag to group secrets by type. Examples: 'vendor_api_key', 'oauth_secret'. BYOK vendor keys use 'vendor_api_key'. |
| `lastUsedAt` |  |  | Last time the resolver decrypted this secret. Empty until first use. |
| `name` | string | yes | Secret name (uppercase with underscores by convention). |
| `rotatedAt` |  |  | Timestamp of the most recent rotation (optional). |

## `v1:platform:partitionVariable`

Partition-scoped plaintext configuration variable. Holds per-tenant non-sensitive overrides (default chat provider, default language, feature flags scoped to a single tenant, etc.). Same wire shape as v1:platform:globalVariable, different scope. When the partition-scoped resolver (resolveVariable) cannot find a row, it falls back to v1:platform:globalVariable so a tenant's override wins over the instance default but the instance default is always available.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | When false the resolver skips this row and falls back to the global v1:platform:globalVariable. |
| `description` | string |  | Human-readable description of the variable's purpose. |
| `name` | string | yes | Variable name (uppercase with underscores by convention). |
| `value` | string | yes | Variable value, always stored as string. Callers parse if they need typed data. |

## `v1:platform:policyTrace`

Persisted trace tree for a single policy evaluation. The engine writes one row per evaluation when the resolved policy carries @traces_persisted or when the caller requests PersistTrace=true on the EvaluatePolicy options. The row carries the policy name, the tier, the caller (actor / partition), the args hash (for cache lookup and audit correlation), the JSON-serialized PolicyTrace tree, the computed result, the wall-clock duration in milliseconds, and any error message that arose during evaluation. Retention is governed by the MEMQL_POLICYTRACE_RETENTION_DAYS env var (default 90); the daily purge automation hard-deletes rows whose `createdAt + retentionDays < now`. Distinct from v1:identity:auditEvent, which is the lightweight @audited per-eval row -- policyTrace is the heavyweight 'I'm debugging WHY this returned X' artifact.

| Field | Type | Required | Description |
|---|---|---|---|
| `actorRole` | string |  | Caller's cluster-wide role (owner / admin / writer / reader). Empty when unauthenticated. |
| `actorUserId` | string |  | Caller's v1:identity:user id. May be empty for server-internal calls. |
| `argsHash` | string | yes | SHA-256 hex of canonicalized args JSON. Used for cache lookup and audit correlation. |
| `callerPartition` | string |  | Active partition envelope at evaluation time. |
| `durationMs` | number | yes | Wall-clock duration of the top-level evaluation in milliseconds. |
| `error` | string |  | Error message captured when the evaluation aborted; empty on success. |
| `policyName` | string | yes | Name of the policy that produced this trace. |
| `resultJson` | string | yes | JSON-encoded return value of the policy. |
| `tier` | string | yes | Tier of the policy at evaluation time -- 'core' or 'bff'. |
| `traceJson` | string | yes | Full PolicyTrace tree serialized as JSON (name / tier / args / result / durationMs / subcalls / breadcrumbs / error). |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:rbac:capability`

A single authorization GRANT: the right to apply one primitive verb to one resource type, attached to a role. Capability = (verb x resourceType) for a role. This is the atomic unit of the consolidated RBAC model (epic memql#2062). The five verbs (read/create/update/delete/execute) are UNIFORM across every resourceType, including `principal` -- applying a verb to the principal resource is how user-management governance is expressed (E1.3): e.g. `update` on a principal, gated by a rank+self predicate, means 'edit a user'; `create` on a principal means 'add a user' WITHOUT necessarily being able to edit existing ones (the create != update split). A role's effective grants are the union of its capability rows. Global / immutable reference data: authored as `seed` rows materialized into _system, readable by every principal, never per-user-owned. PUBLIC per-row-authz tier -- it is deployment-wide config, not user data. roleSlug points at the role this grant belongs to; the role rows themselves land in E1.2 (memql#2070), so until then capabilities reference a role purely by its stable slug string.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-deactivate flag. An inactive capability is ignored at resolution time but kept for audit. Lets a custom role's grant be retired without churning the row history. |
| `description` | string |  | Human-readable note explaining WHY this grant exists. Surfaced in the cockpit RBAC view. Optional; seeded capabilities carry one for auditability. |
| `effect` | string | yes | Whether this capability GRANTS (allow) or explicitly REVOKES (deny) the (verb,resourceType) for the role. allow is the overwhelming common case and the default. deny exists so a higher-ranked role or a custom role can carve a hole in an otherwise-broad grant (e.g. a finance role that is otherwise admin-like but must never `execute` on `deployment`); a deny always wins over an allow at resolution time. E1.6 (memql#2074) resolves an effective decision as: an allow capability exists AND no deny capability exists for the same (role,verb,resourceType). (enum: allow, deny) |
| `predefined` | boolean |  | True for capability rows authored by dsl/rbac/*.memql `seed` declarations on every startup -- the immutable base-role grant set (E1.2 marks these read-only at runtime so a base role can never be redefined to escalate). User-/custom-role capabilities minted via the rank-bounded mutation (E1.4) default to predefined=false and are editable within their creator's rank bound. |
| `resourceType` | string | yes | The kind of resource the verb applies to. Uniform verb set means the SAME five verbs are meaningful against every resourceType. Canonical values seeded in this domain: `principal` (a user/identity -- the governance-bearing resource; verbs on it gate user management per E1.3), `construct` (DSL authoring -- create/update/delete map to the MCP define/author surface, execute maps to inline DSL), `data` (graph rows -- the read/write data plane), `deployment` (cut-version / deploy / rollback actions, reached via `execute`), `agent` (agent templates), `group` (org groups), `role` (the RBAC role catalog itself -- create/update/delete on `role` is what bounds custom-role authoring in E1.4). resourceType is an open string (not a closed enum) so product layers can introduce their own resource kinds without an engine change; the seeded set above is the core vocabulary. |
| `roleSlug` | string | yes | Stable kebab-case slug of the role this capability is granted to (e.g. 'owner', 'developer', 'admin', 'user', or a custom-role slug). A foreign-key-by-slug into the v1:rbac:role catalog -- matched against role.slug, not the role's node id (mirrors how v1:agents:agent.roleSlug references v1:agents:agentRole.slug). A role's effective capability set is every capability row with a matching roleSlug. |
| `verb` | string | yes | The primitive verb this capability grants. The five verbs are the COMPLETE, uniform set across every resourceType -- there is deliberately no separate `grant`/`manage`/`admin` verb. read = observe a resource. create = bring a new resource into existence. update = modify an existing resource. delete = remove a resource. execute = run/invoke a resource (a tool, an automation, a deploy action). The create != update split is load-bearing for governance (E1.3): a role can hold `create` on principals of a given rank without holding `update`, i.e. 'mint developers but not edit existing ones'. (enum: read, create, update, delete, execute) |

## `v1:rbac:role`

A named, RANKED bundle of capabilities -- the role half of the consolidated RBAC model (epic memql#2062). A role's effective authorization is the union of its v1:rbac:capability grants (joined by roleSlug). E1.2 (memql#2070) authors the FOUR base roles as immutable seed rows: owner (400) > developer (300) > admin (200) > user (100). The rank ordering is the locked decision -- developer OUTRANKS admin (the power axes differ: developer is engineering authority, admin is user-management authority) and owner is self-managed only. Ranks are spaced integers (not 1/2/3/4) precisely so E1.4 (memql#2072) custom roles can SLOT BETWEEN existing ranks (e.g. a 'lead' at 250 sits above admin but below developer) without renumbering. The governance predicates in E1.3 (memql#2071) compare actor.rank vs target.rank to decide who-can-manage-whom. Base roles are IMMUTABLE at runtime: predefined=true rows are re-materialized from this DSL on every boot and a Go pre-insert guard (validateRbacBaseRoleImmutable) rejects any non-system-actor write to them, so a base role can never be redefined as data to escalate privilege. Custom roles (predefined=false) are addable as DATA via the rank-bounded createRole path in E1.4. Global / _system reference data: readable by every principal so any node resolves a rank locally; PUBLIC per-row-authz tier.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-deactivate flag. An inactive role disappears from pickers but principals already carrying it keep resolving (their grants still apply) until reassigned. Base roles are never deactivated (the immutability guard blocks it). |
| `description` | string |  | One- or two-line description of the role's authority. Surfaced in the role picker's expanded view and the cockpit RBAC audit surface. |
| `name` | string | yes | Display name shown in the cockpit RBAC view and role pickers, e.g. 'Owner', 'Developer', 'Admin', 'Member'. |
| `predefined` | boolean |  | True for the four base-role rows authored by dsl/rbac/seeds.memql on every startup. predefined=true marks the row IMMUTABLE at runtime: the validateRbacBaseRoleImmutable Go guard rejects any non-system-actor write to it (a base role cannot be redefined / re-ranked / deactivated as data -- the escalation-by-redefinition block). User-created custom roles (E1.4) default to predefined=false and are editable within their creator's rank bound. |
| `rank` | integer | yes | Numeric privilege rank -- HIGHER is more privileged (the inverse of the legacy auth.RoleLevel where lower=higher; the DSL model flips it so 'higher rank' reads naturally). The locked base ranks are owner=400 > developer=300 > admin=200 > user=100. Spaced by 100 so custom roles slot between without renumbering (E1.4). The E1.3 governance predicates gate management on actor.rank > target.rank (plus the self / owner-only carve-outs). A creator minting a custom role in E1.4 may not set a rank at or above their own -- enforced by the validateRbacCustomRoleRankBound Go guard (a creator can only author roles STRICTLY BELOW their own rank). |
| `slug` | string | yes | Stable kebab-case identifier -- the value v1:rbac:capability.roleSlug points to and the value a principal's role resolves to. Never renamed (rename = new row + migration). The four base slugs are 'owner', 'developer', 'admin', 'user'; custom roles pick their own stable slug. |

## `v1:router:budget`

Spend limit for a partition or a specific agent within a partition. The router checks the current-period spend against this cap before every AI call; over-budget calls are refused with a typed error that surfaces in the UI as a clear 'budget reached' state. Rolls over at periodType boundary (UTC day, week, or month).

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | When false the budget is ignored (calls proceed unchecked). Useful for temporary overrides during incident response. |
| `alertSent` | boolean |  | True when the threshold alert for the current period has been emitted. Reset to false on period rollover. |
| `alertThresholdPct` | integer |  | Emit an alert event when spend crosses this percentage of the limit (e.g. 80 for early warning). 0 disables early alerts. |
| `limitUSD` | number | yes | Maximum USD spend allowed during one period. The router refuses calls once ledger totals reach this figure. |
| `periodType` | string | yes | Budget window. Resets at UTC midnight / Monday / first-of-month. (enum: daily, weekly, monthly) |
| `resetAt` |  |  | The next UTC moment the period rolls over. The router uses this to decide whether to reset alertSent. |
| `scope` | string | yes | Whether this budget caps the whole partition or a single agent. (enum: partition, agent) |
| `scopeId` | string |  | When scope=agent, the v1:agents:agent id being capped. Empty when scope=partition. |

**Relationships:** `interactsWith` -> `v1:agents:agent`

## `v1:router:call`

One AI invocation recorded by the memQL AI Router. Every call through the router -- agent replies, prompt renders, suggest endpoints, TTS, transcription -- produces exactly one row here with attribution, token counts, latency, and cost. Partition-scoped usage ledger; the time-series axis rides the shared MemoryNodes hypertable.

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | Agent whose reply this call was generating; empty for non-agent AI calls (suggest, render, TTS, etc). |
| `cachedInputCost` | number |  | USD cost of the cached-input portion. |
| `cachedInputTokens` | integer |  | Portion of input tokens served from the provider's prompt cache. |
| `errorCategory` | string |  | Short classifier when outcome=error: timeout, rate_limit, auth, upstream, cancelled, other. |
| `errorMessage` | string |  | Truncated error string for debugging (max 500 chars). Must not contain PII or secrets. |
| `fallbackFromModel` | string |  | On outcome=fallback_used rows, the model that failed and triggered the retry. Empty on ok/error/cancelled rows. |
| `inputCost` | number |  | USD cost of non-cached input tokens for this call. |
| `inputTokens` | integer |  | Tokens in the input/prompt. |
| `model` | string | yes | Model identifier as sent to the vendor (e.g. gpt-5.4-mini, claude-sonnet-4-6). |
| `outcome` | string | yes | Final state of this call. `fallback_used` marks a failed pre-flight attempt in a policy chain whose successor succeeded (or failed and fell further). (enum: ok, error, cancelled, fallback_used) |
| `outputCost` | number |  | USD cost of output tokens for this call. |
| `outputTokens` | integer |  | Tokens generated in the output. |
| `policyName` | string |  | Routing policy that picked the provider. Reserved for Phase 2+ when policies land; Phase 1 leaves this empty. |
| `pricingConfigured` | boolean |  | True when the provider declared pricing annotations in its .memql file. False means cost fields are 0 because nobody has configured pricing yet, not because the call was free. |
| `promptName` | string |  | Name of the MemQL prompt invoked when the call went through InvokeAI (e.g. agentReply, cognitionRouting). |
| `providerName` | string | yes | memQL provider registry name (e.g. stream54Mini, streamClaudeSonnet). |
| `requestId` | string | yes | Correlates this AI call to an upstream request -- cognition turn, suggest envelope, prompt invocation. Free-form string; uniqueness is not enforced across partitions. |
| `streaming` | boolean |  | True when the call used a streaming provider path. |
| `timeToFirstTokenMs` | integer |  | Wall-clock ms from call start to first streamed token. 0 for non-streaming calls (chat, suggest, TTS). |
| `tokensEstimated` | boolean |  | True when token counts are derived from a char-count heuristic rather than provider-reported usage. Phase 1 always estimates; Phase 2 will flip this to false when the vendor's real usage is available. |
| `tokensPerSec` | number |  | Output tokens per second for streaming calls (computed end-of-stream). 0 for non-streaming or too-short calls. |
| `totalCost` | number |  | USD total cost for this call. Equal to inputCost + outputCost + cachedInputCost. |
| `totalDurationMs` | integer | yes | Wall-clock ms from call start to completion (success or error). |
| `userId` | string |  | Identity subject of the end-user driving this call, when resolvable. Empty for system-triggered calls. |
| `vendor` | string | yes | Vendor family: openai or anthropic. Derived from provider .memql @type. |

## `v1:router:modelCatalog`

Virtual projection of a registered AI provider entry. Never persisted -- rows are produced at query time by the integration.router.listModels capability from the live provider registry. Lives in the concept registry so the engine can shape results without a database round-trip.

| Field | Type | Required | Description |
|---|---|---|---|
| `available` | boolean |  | True when the provider was instantiated successfully (auth + client). |
| `cachedInputCostPerMillion` | number |  | USD per million cached-input tokens. |
| `contextWindow` | integer |  | Maximum token context window. |
| `description` | string |  | Human-readable description from the .memql @description annotation. |
| `inputCostPerMillion` | number |  | USD per million input tokens. |
| `isDefault` | boolean |  | True when the provider carries the @default annotation. |
| `modality` | string |  | text, tts, stt, embedding, etc. |
| `model` | string |  | Vendor-side model id. |
| `outputCostPerMillion` | number |  | USD per million output tokens. |
| `pricingConfigured` | boolean |  | True when any non-zero pricing annotation is set. |
| `providerName` | string |  | Registry name (e.g. stream54Mini). |
| `providerType` | string |  | Raw @type annotation from the .memql file (OpenAI, AnthropicStream, etc). |
| `vendor` | string |  | Vendor family (openai, anthropic). |

## `v1:router:policyCatalog`

Virtual projection of a registered AI Router policy. Never persisted -- rows are produced at query time by the integration.router.listPolicies capability from the live policy registry. Lives in the concept registry so the engine can shape results without a database round-trip.

| Field | Type | Required | Description |
|---|---|---|---|
| `chain` | array |  | Full chain (primary + fallbacks) for convenience. |
| `description` | string |  | Human-readable description from the @description annotation. |
| `fallbacks` | array |  | Fallback provider registry names, in try-order. |
| `maxLatencyMs` | integer |  | Max wall-clock latency allowed; 0 = no limit. |
| `maxTimeToFirstTokenMs` | integer |  | Max time-to-first-token allowed; 0 = no limit. |
| `name` | string |  | Policy name, e.g. balancedChat. |
| `preferredRoles` | array |  | Agent roles this policy is preferred for by default. |
| `primary` | string |  | Primary provider registry name. |

## `v1:safety:approvalRequest`

One row per Ask-verdict approval request. The Gate's ApprovalSink creates a `pending` row on first encounter (keyed by correlationKey for idempotency), then `resolveApprovalRequest` flips it to `approved` / `denied`. The Gate's bypass check queries by correlationKey: an approved non-expired row returns proceed=true on the next retry of the same gated action; otherwise the refusal text references the request id so a human can resolve it. Distinct from v1:safety:classification -- classification is the per-decision audit row (one per evaluation); approvalRequest is the per-(surface, action, payload) bypass token (one per unique action, reused across retries).

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | Same enum as classification.action. |
| `agentId` | string |  | Agent id that triggered the Ask. Lets the cockpit group pending requests by agent. |
| `argsRedacted` | string |  | JSON-encoded redacted payload. Same scrub semantics as classification.argsRedacted (Body + Args run through safety.RedactedPayload; Command/URL/Paths dropped on credential_access). Lets the approver see what they're approving without seeing credentials. |
| `categories` | string |  | Comma-separated category list (e.g. `destructive,credential_access`). |
| `correlationKey` | string | yes | SHA-256 hex of the normalized descriptor (surface \| action \| command/url/paths/tool-name + ToolArgs). Idempotency key -- repeated Ask verdicts for the same action collapse to the same row. Generated by safety.ApprovalCorrelationKey(). |
| `decidedAt` |  |  | When status moved off `pending`. Empty while pending. |
| `decidedBy` | string |  | User id of the human who resolved the request. Empty while status=`pending`. |
| `decisionReason` | string |  | Free-text rationale supplied by the approver (e.g. 'one-off; confirmed safe by ops'). Optional. |
| `expiresAt` |  |  | Advisory TTL. Approved rows older than expiresAt should be treated as expired by the bypass check; the retention sweep that flips them to status=`expired` lands as a follow-up. Empty / zero = no TTL. |
| `ownerUserId` | string |  | Owning user id (whose Plan / agent triggered this). Drives the cockpit's per-user inbox. |
| `planId` | string |  | Plan id, when the action was Plan-scoped. Lets the cockpit deep-link the request back to the parked Plan once the Plan-parking integration lands. |
| `reason` | string |  | Why approval was required -- usually the classifier's reason field copied verbatim. |
| `status` | string | yes | `pending` (created, awaiting human decision) \| `approved` (bypass token live until expiresAt) \| `denied` (subsequent retries refused) \| `expired` (advisory; set by retention sweep). Initial value on create is always `pending`. |
| `surface` | string | yes | Same enum as classification.surface. Captured here so cockpit / CLI can render the request without joining back to a classification row. |
| `tier` | string | yes | Risk tier the classifier assigned. |

## `v1:safety:classification`

One row per safety-classifier decision. Captures what the Gate decided, the verdict source (rule / model / cache), the surface + action it was deciding about, and the (redacted) payload. Retention is governed by the MEMQL_SAFETY_CLASSIFICATION_RETENTION_DAYS env var (default 90); the daily purge automation hard-deletes rows whose `createdAt + retentionDays < now`. Distinct from v1:platform:policyTrace -- policyTrace covers the decision-policy evaluation tree; this concept covers the safety-classifier verdict + final gate decision per command.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | Abstract action: exec / fs_read / fs_write / fs_list / fs_stat / http_fetch / gui_input / screenshot / webhook / tool_call. |
| `agentId` | string |  | Calling agent id. |
| `argsRedacted` | string |  | JSON-encoded redacted payload. Body + Args go through safety.RedactedPayload (TOKEN/SECRET/PASSWORD/API_KEY/Authorization fragments -> [REDACTED]). Command / URL / Paths / Method / ToolName are passed through verbatim UNLESS the classifier flagged `credential_access` (URL with userinfo, env-var assignment in a shell command, etc.), in which case the recorder drops those surface fields entirely so credentials never reach the persisted row -- the rule's reason field still carries enough context for triage. Empty when the descriptor's payload was already empty. |
| `categories` | string |  | Comma-separated category list (e.g. `destructive,credential_access`). Empty for tier=none. |
| `confidence` | number |  | Classifier self-reported confidence [0, 1]. Rule verdicts are 1.0 by convention; model verdicts carry the model's own estimate. |
| `correlationId` | string |  | Correlation id linking back to the dispatch + any auditEvent. |
| `decision` | string | yes | What the Gate decided: `allow`\|`ask`\|`deny`. In shadow mode the surface always proceeds regardless; in enforce mode this is honoured. |
| `latencyMs` | number |  | Total classification latency in ms (chain time including rules + model + cache lookup). float (matches policyTrace.durationMs) since `number` isn't a DSL primitive. |
| `mode` | string | yes | Gate mode at decision time: `off`\|`shadow`\|`enforce`. `shadow` rows are observation-only -- the surface proceeded regardless of `decision`. |
| `ownerUserId` | string |  | Owning user id. |
| `planId` | string |  | Plan id, when the action is plan-scoped. |
| `reason` | string |  | Short human-readable explanation -- which specific pattern fired. <= 200 chars. |
| `ruleId` | string |  | Stable rule identifier (`shell.destructive`, `model.classify_v1`, ...). Empty for noop/disabled sources. |
| `source` | string | yes | Classifier source: `rule`\|`model`\|`cache`\|`noop`\|`disabled`. Lets ops tell rule-engine hits from LLM verdicts in queries. |
| `surface` | string | yes | Execution surface: `computer_use_headless`/`_embodied`, `workbench`, `tool_webhook`, `tool_integration`. |
| `tier` | string | yes | Risk tier: `none`\|`low`\|`medium`\|`high`\|`critical`. |

## `v1:safety:outputScreening`

One row per output-screening decision. Captures what the OutputGate decided about a single piece of incoming content before the model re-ingested it. Distinct from v1:safety:classification: classification covers agency (should this command run?); outputScreening covers ingress (should this string land in the model's context?). Retention is governed by MEMQL_SAFETY_OUTPUT_SCREENING_RETENTION_DAYS (default 90).

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | Agent that triggered the ingress (where applicable; tool outputs always have one; HTTP fetches usually do). |
| `categories` | string |  | Comma-separated category list: `prompt_injection` / `instruction_override` / `role_hijack` / `exfiltration` / `delimiter_abuse`. Empty for tier=none. |
| `confidence` | number |  | Screener self-reported confidence [0, 1]. Rule verdicts are 1.0 by convention. |
| `contentLength` | number |  | Byte length of the screened content BEFORE the redactedSample truncation. Useful for spotting bloat-attack vectors (megabyte-scale content with one tiny injection buried). |
| `contentType` | string | yes | Ingress channel: `tool_output` / `http_fetch` / `file_read` / `knowledge_seed`. Lets ops slice screening data by attack surface. |
| `correlationId` | string |  | Correlation id linking back to the dispatch. |
| `latencyMs` | number |  | Total screening latency in ms. float (matches classification.latencyMs) since `number` isn't a DSL primitive. |
| `mode` | string | yes | OutputGate mode at decision time: `off`\|`shadow`\|`enforce`. `shadow` rows are observation-only -- the surface re-ingested the content regardless of `verdict`. |
| `ownerUserId` | string |  | Owning user id. |
| `planId` | string |  | Plan id, when the ingress was Plan-scoped. |
| `reason` | string |  | Short human-readable explanation -- which specific pattern fired. <= 200 chars. |
| `redactedSample` | string |  | First N bytes of the content after secret-redaction. Capped at 4 KiB by the recorder so a poisoned 100 MB document doesn't blow the row up. Lets ops inspect what fired the verdict without keeping the whole payload. |
| `ruleId` | string |  | Stable rule identifier (`prompt_injection.ignore_previous`, etc.). Empty for noop/disabled sources. |
| `screener` | string | yes | Verdict source: `rule` (deterministic pattern) / `model` (LLM classifier; not shipped today) / `cache` / `noop` / `disabled`. |
| `tier` | string | yes | Risk tier the screener assigned: `none` (clean) / `low` / `medium` / `high` (suspicious) / `critical` (overt injection). |
| `verdict` | string | yes | What the OutputGate decided: `clean` / `suspicious` / `blocked`. In shadow mode the gate always returns clean to the surface regardless; in enforce mode this is honoured (suspicious -> log + pass; blocked -> drop). |

## `v1:telephony:call`

An append-only PSTN call record: one row per call, written on connect and updated on disconnect. Powers billing, observability, and per-call cost attribution. Bound to a partition + a partition-scoped room (Amendment A).

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | Identity of the voice agent that handled the call, when known. |
| `carrier` | string |  | Carrier that carried the call. |
| `costEstimate` | number |  | Estimated total cost in USD (carrier + model audio), for per-call attribution. |
| `direction` | string | yes | Call direction. (enum: inbound, outbound) |
| `disposition` | string |  | Call outcome. (enum: in_progress, completed, no_answer, busy, failed, canceled) |
| `durationSeconds` | integer |  | Billable duration in seconds. |
| `endedAt` |  |  | Call disconnect time. |
| `fromE164` | string | yes | Calling party E.164. |
| `partitionId` | string | yes | Canonical tenant scope for the call. NEVER a product-layer partitionId (Amendment A). |
| `providerCallId` | string |  | Carrier / LiveKit SIP participant or call id, for cross-referencing carrier CDRs. |
| `room` | string | yes | Partition-scoped LiveKit room the call is bridged into. |
| `startedAt` |  |  | Call connect time. |
| `toE164` | string | yes | Called party E.164. |

## `v1:telephony:consent`

TCPA consent / opt-out state for an external phone number. Outbound calls to an opted-out number are blocked with an auditable reason (memql#1915). Append-only: the newest row per phoneNumber is authoritative.

| Field | Type | Required | Description |
|---|---|---|---|
| `partitionId` | string | yes | Tenant partition the consent was recorded under (Amendment A). |
| `phoneNumber` | string | yes | The external party's E.164 number this consent record governs. |
| `reason` | string |  | Why the state was set (e.g. 'user requested removal', 'written consent on file'). |
| `source` | string |  | Where the consent came from (e.g. 'ivr_optout', 'admin', 'import'). |
| `status` | string | yes | Consent state. opted_out blocks outbound calls. (enum: opted_in, opted_out) |

## `v1:telephony:number`

A provisioned PSTN phone number (DID). Bound to a partition; inbound calls to this DID route to a partition-scoped room. Carrier identifiers are opaque (providerId). Compliance state (E911, consent) is layered by the compliance slice.

| Field | Type | Required | Description |
|---|---|---|---|
| `callerIdVerified` | boolean |  | Whether this DID is verified for outbound caller-ID presentation (STIR/SHAKEN attestation is carrier-side; this flags our own verified ownership). |
| `carrier` | string | yes | Owning carrier name ('telnyx', ...). |
| `e164` | string | yes | Canonical +<countrycode><number> address, e.g. '+14155550100'. |
| `e911AddressId` | string |  | Carrier reference for the registered E911 address. |
| `e911Registered` | boolean |  | Whether an E911 emergency address is registered for this DID. Compliance gate before the DID goes live (memql#1915). |
| `monthlyCost` | number |  | Recurring per-number cost in USD, when the carrier reports it. |
| `numberType` | string |  | Origination class; drives per-minute inbound cost. (enum: local, tollfree, mobile) |
| `partitionId` | string | yes | Canonical tenant scope this DID belongs to. Inbound calls route to a room scoped by this partition. NEVER a product-layer partitionId (Amendment A). |
| `providerId` | string |  | Carrier's opaque identifier for the number (the value BuyNumber consumes / ReleaseNumber resolves). |
| `purchasedAt` |  |  | When the DID was purchased. |
| `purpose` | string |  | How the DID is used. (enum: inbound, outbound, both) |
| `status` | string |  | Lifecycle state. (enum: active, releasing, released) |

## `v1:telephony:trunk`

A LiveKit SIP trunk configuration record (inbound and/or outbound) for a carrier. Holds the LiveKit trunk id and a reference to externally-stored credentials -- never the secret values themselves (those live in external-secrets).

| Field | Type | Required | Description |
|---|---|---|---|
| `carrier` | string | yes | Carrier this trunk fronts ('telnyx', ...). |
| `direction` | string | yes | Call directions this trunk serves. (enum: inbound, outbound, both) |
| `livekitTrunkId` | string |  | The id LiveKit SIP assigned to this trunk (SIPInboundTrunkInfo / SIPOutboundTrunkInfo). |
| `name` | string |  | Human-readable trunk name. |
| `secretRef` | string |  | Reference to the external-secrets entry holding trunk credentials. NEVER the secret value. |
| `sipEdgeUri` | string |  | SIP signaling target the carrier reaches (e.g. 'sip:edge.example.com:5061;transport=tls'). |
| `status` | string |  | Whether the trunk is in service. (enum: active, disabled) |

## `v1:todos:todo`

A user-owned to-do item: a titled task with a done flag plus optional due date, priority, and a back-pointer to the responsibility that spawned it. The standalone source-of-truth to-do concept the assistant manages on the user's behalf. Per-row authz: owned -- ownerUserId is stamped from actor.userId on every write and every read gates on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `done` | boolean |  | Completion flag. Flipped to true by the complete operation; the row keeps its history so an undo is just another version with done=false. |
| `dueAt` |  |  | Optional due date / time in RFC3339. Used by the frontend to sort + surface overdue items; absence means no deadline. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this to-do. Stamped from actor.userId at create time; re-stamped from actor.userId on every update so ownership can never be reassigned by a caller. The load-bearing per-row authz key. |
| `priority` | string |  | Optional priority bucket. Absence means unprioritized; the frontend sorts high > medium > low > unset. (enum: low, medium, high) |
| `sourceResponsibilityId` | string |  | Optional back-pointer to the responsibility (or plan / automation) that spawned this to-do. Empty for user-created to-dos. Lets the frontend group app-generated tasks under their originating responsibility and lets a responsibility reconcile the to-dos it created. |
| `title` | string | yes | Short human-readable description of the task. The primary display field. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:workbench:workspace`

Per-Plan workbench workspace. Tracks the persistent filesystem mounted into every per-Task container running under the Plan. Created lazily on first workbenchHost call; released when the parent Plan transitions to a terminal status (succeeded / failed / cancelled). Universal authorization -- no scope grants, no kill switch, no per-agent gating; the workbench is sandboxed inside the cluster and the blast radius is contained to the per-Plan directory tree.

| Field | Type | Required | Description |
|---|---|---|---|
| `lastUsedAt` |  |  | Bumped on every successful workbenchHost dispatch. Backs idle-detection metrics; not used to drive teardown (teardown is Plan-terminal-driven). |
| `planId` | string | yes | v1:planner:plan.id this workspace belongs to. One workspace per Plan; the unique key. |
| `releasedAt` |  |  | When the workspace was released and the directory torn down. Empty for status=provisioned. |
| `releasedReason` | string |  | Discriminator for status=released rows. plan_terminal = the releaseWorkbenchOnPlanTerminal automation fired. explicit = an admin / mutation explicitly released. ttl_expired = future ttl-driven sweep. (enum: , plan_terminal, explicit, ttl_expired) |
| `status` | string | yes | Lifecycle. provisioned = workspace directory exists and is mountable. released = Plan reached terminal, directory torn down. (enum: provisioned, released) |
| `storageRoot` | string | yes | Absolute path to the workspace's root directory on the workbench node's local filesystem. Implementation default: /var/lib/memql/workbenches/{planId}/. Per-Plan isolation is filesystem-level; cgroup / user-namespace isolation is per-call. |

**Relationships:** `parent` -> `v1:planner:plan`

## `v1:worker:invocation`

Per-call telemetry for worker tool invocations. Written once on call completion (success / failure / cancelled / timeout / denied). Operator reads these for plan debugging; auditor reads identity:auditEvent for the security timeline. Linkage between the two layers is via correlationId. Retention default 90 days, tunable via WORKER_INVOCATION_RETENTION_DAYS; the workerInvocationRetentionSweep cron soft-deletes rows past their TTL.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | Action discriminator within the tool. workerHost: exec / fs_read / fs_write / fs_list / fs_stat / http_fetch. workerComputer: capabilities / wait / screenshot / cursor_position / mouse_move / mouse_click / mouse_down / mouse_up / mouse_drag / mouse_scroll / key_type / key_combo / key_hold / display_info / window_list / window_focus. |
| `agentId` | string | yes | v1:agents:agent.id the call originated from. |
| `argsRedacted` | object |  | Args with secret-shaped fields redacted. Tokens, passwords, Authorization headers, env vars matching SECRET/KEY/PASSWORD scrubbed. |
| `bytesIn` | integer |  | Bytes the worker streamed in (e.g. fs_write payload). |
| `bytesOut` | integer |  | Bytes the worker streamed out (stdout + stderr + fs_read body, etc). |
| `completedAt` |  |  | When ToolResult landed back on the agent. Empty for in-flight rows that haven't completed yet -- those are rare; usually the row is written once at completion. |
| `correlationId` | string |  | Random ID linking this row to the matching v1:identity:auditEvent row when one was emitted (denied-by-policy, scope-elevation, etc). |
| `deleted` | boolean |  | Soft-delete flag. softDeleteWorkerInvocation stamps this true once the workerInvocationRetentionSweep cron retires a row past its WORKER_INVOCATION_RETENTION_DAYS window; the underlying time-series row survives for forensic recovery. Queries filter deleted rows out via isNotDeleted (payload.deleted!=true). |
| `durationMs` | integer |  | completedAt - startedAt in milliseconds. |
| `errorCode` | string |  | Worker-side error code from Failure.error_code: exec_failed / fs_denied / http_blocked / etc. |
| `errorMessage` | string |  | Human-readable error detail. Empty on success. |
| `exitCode` | integer |  | Process exit code for workerHost.exec. Empty for non-exec actions. |
| `outcome` | string | yes | Terminal status. denied_* outcomes also produce a v1:identity:auditEvent row. (enum: success, failure, cancelled, timeout, denied_by_scope, denied_by_policy, kill_switch_engaged, no_worker_available) |
| `outputPreview` | string |  | First 1024 chars of stdout/data, for quick debugging without fetching the full body. Sensitive tokens are NOT scrubbed here -- preview is for owner eyes, audit-log readers don't see this field. |
| `ownerUserId` | string | yes | v1:identity:user.id of the worker's owner. Same as WorkerRegistration.ownerUserId; denormalized so the frontend's per-user invocations query doesn't need to join. |
| `planId` | string |  | v1:planner:plan.id when the call was part of a plan-task. Empty for ad-hoc agent calls. |
| `signal` | string |  | If exec was killed by signal, the signal name. Empty otherwise. |
| `startedAt` | string | yes | When dispatch was received from the agent (ToolDispatch envelope sent on the wire). |
| `taskId` | string |  | v1:planner:task.id when the call was part of a plan-task. Empty for ad-hoc agent calls. |
| `tool` | string | yes | Umbrella tool the action belongs to. (enum: workerHost, workerComputer) |
| `workerId` | string | yes | v1:worker:registration.id the call dispatched to. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:worker:registration`, `parent` -> `v1:agents:agent`, `parent` -> `v1:planner:plan`, `parent` -> `v1:planner:task`

## `v1:worker:registration`

Operational registration of a worker -- the runtime record for a memql-cockpit instance running in worker mode and connected to this cluster. Persists stable identity + capabilities + last-seen state. The currently-connected gRPC stream + per-call concurrency live in-memory on whichever agent node holds the stream; this concept is for everything that needs to survive disconnect and binary restart. Per-user routing: every registration is owned by exactly one v1:identity:user; only agents in sessions owned by that user can dispatch tools to this worker.

| Field | Type | Required | Description |
|---|---|---|---|
| `buildTag` | string |  | Cockpit build flavor: 'computeruse' or 'headless'. |
| `capabilities` | array | yes | Capability set advertised at registration. HEADLESS is mandatory; COMPUTERUSE is added when the memql-cockpit-computeruse build confirmed TCC + (Wayland/X11) at startup. Order is not significant. |
| `capabilityDescriptor` | object |  | Optional structured capability self-description sent at registration (schemaVersion 1): {platform, displayServer: quartz\|x11\|wayland\|none, computerUseAvailable, actions: [supported workerComputer action names], schemaVersion}. Lets dispatch degrade/refuse per-action up front without a live worker round-trip. Empty object when the worker did not send one (older builds). |
| `concurrency` | object | yes | Per-capability max-parallel limits, e.g. {HEADLESS: 8, COMPUTERUSE: 1}. Scheduler enforces; calls beyond cap queue (FIFO) up to the calling tool's timeout. |
| `identityId` | string | yes | v1:identity:identity.id of the worker_token credential the worker authenticated with. Lookup target on every reconnect; rotated tokens stamp a new identity row, not a new registration. |
| `labels` | object |  | Free-form key=value tags. os, arch, hostname auto-populated; operator extends with custom labels for routing among the user's own workers (e.g. has-blender=true). |
| `lastConnectedFromIP` | string |  | Source IP of the most recent connect attempt. Audit + abuse signal. |
| `lastSeenAt` |  |  | Bumped on every heartbeat (15s cadence). Drives the online/offline indicator. Heartbeat batching keeps DB write rate manageable. |
| `name` | string | yes | User-chosen display name. Defaults to hostname. Shown in /me/workers and /admin/workers. |
| `ownerUserId` | string | yes | v1:identity:user.id who owns this worker. Set once at register time from the worker_token's registeredBy. Dispatch-time access check: caller's session-owner must equal this value. |
| `permissions` | object |  | TCC / X11 status snapshot at register time: {accessibility, screen_recording, x11_display, detail}. Surfaced in /me/workers; the worker re-registers on reconnect so this stays accurate. |
| `platformInfo` | object |  | os, arch, hostname snapshot at register time. |
| `registeredAt` | string | yes | When the registration row was first created. |
| `revokeReason` | string |  | Free text; surfaced in audit + the worker's offline-row tooltip. |
| `revokedAt` |  |  | When the user (or admin) revoked the worker. Non-nil = dispatch refuses; the worker's gRPC stream is dropped on next health check. |
| `revokedBy` | string |  | v1:identity:user.id who revoked the worker. Empty for self-revocation. |
| `version` | string |  | Cockpit binary version (e.g. v2026.5.4-computeruse). |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:identity`, `parent` -> `v1:identity:user`

