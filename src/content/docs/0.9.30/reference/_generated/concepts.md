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

Total: **102** concepts.

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
| `kind` | string | yes | First-class agent identity: what KIND of agent this is across the platform. `assistant` -- user-facing conversational agent (the per-user General Assistant). The user's active assistant joins their spaces. `specialist` -- agent that does tool work for a Task (planner-provisioned or user-created). Specialists answer through tools and never write user-facing utterances. `system` -- platform-internal agent (MemQL Planner, MemQL Trainer, future system-owned ones); hidden from every user-facing surface, not editable / deletable by users. Distinct from but aligned with the `role` field, which is the guardrail-routing classifier read at dispatch time (specialist vs assistant); the invariant `kind == "system" OR kind == role` keeps the two in sync. Stamping paths: user-actor `mutationCreateAgent` -> `assistant` via default; planner-driven `mutationCreateAgent` calls pass `kind: "specialist"` (memql#399); seed materializer (plannerAgent / trainerAgent) passes `kind: "system"`. The SPA (`copresent#121`) reads this field to filter / route / hide; epic #122 / #123 / #124 land the SPA-side consumers. Backfilled from the prior `enum("system", "user")` schema: `system` rows stay `system`; `user` rows split into `assistant` (role=assistant) or `specialist` (role=specialist). Pre-prod (no migration tooling needed; seed regen on a fresh DB). (enum: assistant, specialist, system) |
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

**Relationships:** `parent` -> `v1:identity:user`

## `v1:agents:agentAuthorization`

Standing authorization granting an agent permission to trigger Plans of certain kinds without per-Plan user approval. Per Q4 Option B (tiered trust + opt-in autonomy): agent-proactive Plans default to 'requires user approval' (canvas suggestion card -> click Approve to start); the user can graduate a specific agent to standing authorization for specific plan kinds via the 'Approve & always allow this' button on the suggestion card. The grant is per (agentId, planKind, spaceScope) and carries a per-grant token budget cap + an expiry so autonomy is bounded by default.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string |  | What the grant authorizes the agent to do. triggerPlan = auto-trigger Plans matching planKind without per-Plan approval (legacy behavior; default for backward compatibility). createSpecialist = the Planner Agent may auto-mint specialists matching planKind (Q4 standing envelope). extendSpecialist = may auto-clone-and-extend an existing specialist (Q10 layered dedupe). trainSpecialist = may auto-trigger trainSpecialist Plans for the specialist. mintSkill = the Planner Agent may mint a NEW v1:agents:skill row when the catalog lacks a suitable bundle (Phase 3 / memql#159). For mintSkill the skillTierAllowlist field gates which skill tiers (A / B / C) the planner may mint at without per-mint approval; out-of-allowlist mints surface a canvas approval card and park the Plan. (enum: triggerPlan, createSpecialist, extendSpecialist, trainSpecialist, mintSkill) |
| `active` | boolean |  | Soft-revoke flag. User-revocable from the agent's settings at any time. |
| `agentId` | string | yes | v1:agents:agent.id this grant authorizes. |
| `computerUseScope` | string |  | Standing computer_use authorization tier the user has granted this agent (Q9 layer 2). observe = read-only worker calls (screenshot, fs_read, fs_list, fs_stat, http_fetch GET, cursor/display/window-list). full = adds shell exec, fs_write, full HTTP, mouse + keyboard + window_focus. Empty string means computer_use is not authorized for this agent in this scope; dispatch rejects with denied_by_scope. Plans can declare a NARROWER scope at creation time but never wider. NOTE: the `interact` value is a retired tier kept in the enum for backward compatibility with rows written before the simplification; the read path treats it as `full`. (enum: , observe, interact, full) |
| `expiresAt` | string |  | When this grant expires. Null = no expiry (lifetime grant). Default UI proposes 30-day expiry with a renewal prompt before expiration. |
| `maxPerPlan` | integer |  | Cap on how many times this action can fire under a single parent Plan. Used primarily for action='createSpecialist' (e.g. 'up to 3 new specialists per Plan'). Null = no cap. |
| `planKind` | string | yes | Plan kind this grant covers, OR '*' to cover any kind. Matches v1:planner:plan.kind values. For action='triggerPlan' this is the kind being triggered; for createSpecialist/extendSpecialist/trainSpecialist this is the originating-Plan kind that the action fires under. |
| `roleSlugAllowlist` | array |  | Optional list of agent.roleSlug values this grant covers; empty = any roleSlug. Lets the user say 'auto-create technical specialists but ask before HR / Legal / Finance roles'. Only meaningful for action='createSpecialist'/'extendSpecialist'. |
| `skillTierAllowlist` | array |  | For action='mintSkill' grants (Phase 3 / memql#159): the v1:agents:skill tiers (A / B / C) the planner may mint at without per-mint approval. Default is implicitly ['A'] when the grant is created -- the planner integration injects that default at read time when the field is empty AND action='mintSkill'. B and C are riskier (safety-relevant + high-stakes regulated respectively) so they require explicit user opt-in via the 'Approve & always allow this tier' button on the mintSkillApprovalRequested canvas card. Empty / unused for non-mintSkill grants. |
| `spaceScope` | string | yes | Space id this grant is restricted to, OR '*' to cover any space owned by the user. Lets users grant 'Cleo can auto-run analyzeFile in the HR space' without granting workspace-wide. |
| `tokenBudgetCap` | integer |  | Per-Plan token budget ceiling enforced when this authorization is consumed. Even auto-approved plans can't blow through tokens beyond this cap. Null = use User.preferences.defaultPlanTokenBudget. |
| `userId` | string | yes | v1:identity:user.id of the user who granted the authorization. Only the granting user can revoke. |

## `v1:agents:agentRole`

First-class catalog of agent roles. A role is the spine of an agent's identity: it picks the locked minimum skills (knowledge + tool + live-source bundles), declares the recommended LLM policy, and caps how many skills an agent in the role may carry at once. The role is the contract the assistant fulfills when it auto-creates a specialist mid-conversation -- pick the role, copy its locked + default skills onto the new agent, materialize the row. Lock semantics (#158): lockedSkillIds is the minimum required set for any agent carrying this role. The cockpit's Studio renders locked rows with a lock icon; mutationUpdateAgent rejects writes that strip a locked id (server-side enforcement, not just UI). defaultSkillIds is pre-selected when the agent is created but the user / planner may remove them later. forbiddenSkillIds hard-denies skills the agent factory MUST NOT grant. availableSkillIds (when non-empty) is the inclusive 'visible in the picker' set; empty = anything not forbidden is permitted. maxSkills caps the count -- 5 for specialists, 2 for the assistant by default. Predefined rows are re-seeded on every startup; user-created roles default to predefined=false and stay fully editable. Per-user roles are global-scoped because routing decisions (cognition / conductor) need to see the same role surface across every partition.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-deactivate flag. Inactive roles disappear from the picker but existing agents that carry the role keep functioning. |
| `availableSkillIds` | array |  | Skill ids visible in the picker for this role. Superset of locked + default. Empty = 'every non-forbidden skill is permitted' (the open-picker default for general-purpose roles); a non-empty list narrows the picker to that explicit set. |
| `category` | string | yes | Coarse grouping for the picker. professional = white-collar business roles. personal = household/lifestyle. creative = arts/writing. scientific = research/discovery. medical / legal / financial = regulated. trades = skilled labor. education = K-12 + higher ed. civic = government / public service. hospitality = food/lodging/events. agriculture = farming/ranching. transportation = pilots/captains/drivers. energy = utilities/power. specialized = doesn't fit elsewhere. hobby = recreational pursuits. (enum: professional, personal, creative, scientific, medical, legal, trades, education, civic, hospitality, agriculture, transportation, energy, financial, specialized, hobby) |
| `defaultSkillIds` | array |  | Skill ids pre-selected when the agent is minted but freely removable later. Distinct from lockedSkillIds: locked = always there, default = nice-to-have starting point. Disjoint by convention (a skill id is either locked or default, not both). |
| `description` | string |  | One- or two-line description of what an agent in this role does. Surfaced in tooltips + the role picker's expanded view. |
| `forbiddenSkillIds` | array |  | Skill ids the agent factory MUST NOT grant to agents in this role -- hard denylist that overrides availableSkillIds. Mirrors the old forbiddenToolSlugs semantic. Use for Tier-C medical roles that must never carry operator-computer-use, regulated finance roles whose audit story can't tolerate workbench shell access, etc. |
| `lockedSkillIds` | array |  | v1:agents:skill ids the role MUST carry -- mutationUpdateAgent rejects writes that strip any of these from agent.capabilities.skillIds. Phase 2 (#158) cut: replaces the three parallel locked* lists (lockedDomainIds, lockedToolSlugs, lockedLiveKnowledgeIds) with a single skill-id surface. The skill bundle's domain / tool / liveSource composition is resolved at attach time by the agent factory. |
| `maxSkills` | integer | yes | Count cap on agent.capabilities.skillIds. mutationUpdateAgent rejects writes where len(skillIds) > effective cap, computed as min(agent.capabilities.skillBudgetMax, role.maxSkills). Defaults: 5 for specialist roles, 2 for the assistant role (which is meant to orchestrate, not specialize). |
| `name` | string | yes | Display name, e.g. 'IT Support' or 'Family Medicine Physician'. Surfaced in role pickers and on the agent card. |
| `predefined` | boolean |  | True for catalog rows seeded by dsl/agents/roles/*.memql on every startup. Predefined rows are LOCKED in the role manager UI: name / description / category / locked + forbidden fields + maxSkills are read-only; only tier and recommendedPolicySlug edits are accepted. User-created roles default to predefined=false and remain fully editable. The role catalog itself is the only place where 'admin-only edit predefined rows' would happen, and even there the locks come back on the next startup if not aligned with the source slice. |
| `recommendedGender` | string |  | Optional gender hint for voice + persona auto-assignment when the GA mints an agent. Empty = pick from whichever bucket has more unused canonical voices for this owner. Distinct from a hard rule -- the user can change it at creation time. (enum: female, male, ) |
| `recommendedPolicySlug` | string |  | Default SI Router policy slug for this role (balancedChat, strongReasoning, fastCoding, lowLatencyVoice, cheapestCapable). The agent creation flow pre-selects this on the Intelligence dropdown; user can override. Empty falls back to 'balancedChat'. |
| `slug` | string | yes | Canonical slug -- the value v1:agents:agent.roleSlug points to. Kebab-case, stable, never renamed (rename = new row + migration). Examples: 'it-support', 'family-doctor', 'commercial-pilot', 'union-carpenter'. |
| `systemPromptHints` | string |  | Free-text guidance the agent factory layers into the role's system prompt. NOT the full system prompt -- the agent's own systemPrompt field still wins -- but a short paragraph of role-shape direction (tone, scope of expertise, escalation behavior) that the factory can inject. Example for 'family_doctor': 'You provide general health information, not personal medical advice. Always recommend consulting a licensed practitioner for diagnosis or treatment decisions.' |
| `tier` | string |  | Safety tier mirroring v1:common:knowledgeDomain.tier. A = general; auto-seedable, no advisory disclaimer. B = safety-relevant; agents in this role get a 'general info, not professional advice' disclaimer injected into their system prompt at materialization time. C = high-stakes regulated (clinical medicine, surgery, anesthesia, securities advice, legal practice, structural engineering); agents are still creatable but their locked skills' domains carry Tier-C placeholder content telling the user to upload authoritative sources, and the create-agent flow surfaces a stronger 'this role is regulated' warning. (enum: A, B, C) |

## `v1:agents:avatarPersona`

Operator-curated avatar persona catalog (memql#609). Global operator catalog -- like agentRole / skill: a shared set of vendor-minted avatar personas every user PICKS from when creating an assistant (copresent#239). Each row is minted ONCE from an operator image into ONE vendor (Anam or Simli) by the `make avatar-mint` tooling, which captures the vendor-issued id and emits the seed under dsl/agents/avatarPersonas.memql. When a user picks a persona the agent's avatarPersonaId/avatarVendor are stamped from the entry; the voice-agent resolves the persona at session start (integrations/voice/agent/avatar_*.go). Per-assistant vendor choice: an entry belongs to exactly one vendor.

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
| `lastUpdatedAt` | string |  | Timestamp of the most recent entry. Convenience field; the authoritative order is entries[].ts. |
| `userId` | string | yes | ID of the user this memory belongs to. One-to-one with v1:identity:user. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:agents:skill`

First-class capability bundle: a named unit of (knowledgeDomains + toolSlugs + liveSources) that the Planner Agent attaches to agents in createSpecialist / extendSpecialist. After the full skills rollout (#157 -> #158 -> #159) the agent factory pulls skills off the catalog rather than threading parallel flat lists; this concept is the spine of that surface. Phase 1 (this PR) lands the schema + a 13-row predefined catalog; consumers don't read skills yet. Phase 2 migrates roles + agents to skillIds[]; Phase 3 lands the mintSkill authority + approval card.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-deactivate flag. Inactive skills disappear from the picker but agents that already carry the skill keep functioning. Lets us retire a poorly-shaped catalog row without churning every agent that bound to it. |
| `category` | string |  | Coarse grouping mirroring agentRole.category, with three additional buckets for cross-cutting platform skills (foundational, engineering, product) that don't fit the user-domain taxonomy. The role manager groups skills by this field in the picker. (enum: professional, personal, creative, scientific, medical, legal, trades, education, civic, hospitality, agriculture, transportation, energy, financial, specialized, hobby, foundational, engineering, product) |
| `description` | string |  | One- or two-line description of what an agent with this skill can do. Surfaced in tooltips + the skill picker's expanded view. |
| `domainIds` | array |  | v1:common:knowledgeDomain.id references the skill bundles. Resolved into the agent's effective domain union at retrieval / scoring / prompt-rendering time by traversing capabilities.skillIds[] (Phase 2 cut: #158 -- the agent row no longer stores a flat domains list). Load-time validation: every id ideally resolves to a known knowledgeDomain seed; the Phase 1 carve-out documented in skill_tier_validation.go warns-not-fails for unseeded ids. |
| `liveSourceIds` | array |  | v1:knowledge:liveSource.id references for live-knowledge bindings. Empty for most skills; populated for skills that need a current-state feed (e.g. inventory, weather, market data). Phase 2 cut (#158): resolved into the agent's effective live-source union by traversing capabilities.skillIds[]; the agent row no longer stores a flat liveSources list. |
| `mintedByAgentId` | string |  | Phase 3 (#159) provenance: the v1:agents:agent.id of the planner agent whose mintSkill action produced this row. Empty for predefined catalog rows. The trace viewer renders this alongside the planner trace tree so an operator can correlate a skill mint with the upstream LLM decision that triggered it. |
| `name` | string | yes | Display name shown in the role manager and the agent edit modal. Example: 'CoPresent UI'. |
| `originatingPlanId` | string |  | Phase 3 (#159) provenance: the v1:planner:plan.id whose dispatch surfaced the need for this skill. Empty for predefined catalog rows. Stamped by mutationMintSkill at attach time. Pairs with mintedByAgentId for the 'who/when/why' triad the Skills admin view + the trace viewer (cockpit#125) surface as 'Created by planner from Plan X'. |
| `predefined` | boolean |  | True for catalog rows seeded by dsl/agents/skills/*.memql on every startup. Predefined rows are LOCKED in the cockpit's Skills admin view: slug / category / tier / domain+tool composition are read-only; only tags / description edits are accepted. User-created skills default to predefined=false and stay fully editable. |
| `slug` | string | yes | Canonical slug -- stable, kebab-case identifier. Examples: workbench-baseline, copresent-ui, go-backend-engineering. Never renamed (rename = new row + migration). |
| `tags` | array |  | UI grouping labels for cross-cutting product surfaces (e.g. ['copresent', 'voice']). Purely cosmetic; no behavioral effect. Lets a single skill appear in multiple curated lists without forcing a category change. |
| `tier` | string | yes | Safety tier mirroring v1:common:knowledgeDomain.tier. The materializer enforces skill.tier >= max(tier across domainIds[]) at load time: a skill cannot bundle a Tier-C medical domain while declaring itself Tier-A. A = general; B = safety-relevant (advisory disclaimer flows downstream); C = high-stakes regulated. Phase 2 propagates the tier onto the agent's effective tier and onto the system-prompt disclaimer injection. (enum: A, B, C) |
| `toolSlugs` | array |  | Tool / integration slugs the skill grants. Phase 2 cut (#158): resolved into the agent's effective tool union by traversing capabilities.skillIds[]; the agent row no longer stores a flat tools list. Composes through the existing tool-slug expansion (e.g. operator-computer-use expands to workerHost + workerComputer + cross-cutting trio). |

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

## `v1:authoring:bundle`

An atomic, versioned unit of planner-authored DSL: one automation plus the dependency closure it needs (logic / shapes / specs / traits / policies / mutations / queries / prompts), compiled from a user Responsibility. The bundle is the unit of validation and activation -- the whole closure passes Gate 1 (isolated compile+bind), Gate 2 (tiered behavioral dry-run), and Gate 3 (user approval) together, then activates together into the sandboxed authored-construct runtime (#959). Never part of the core engine Init() path, so a malformed bundle can never brick the cluster. Member constructs are v1:authoring:construct rows pointing back via bundleId.

| Field | Type | Required | Description |
|---|---|---|---|
| `activatedAt` | string |  | When the bundle was approved + registered into the authored runtime (status -> active). Null until activated. |
| `dryRunReport` | object |  | Gate 2 result (tiered behavioral dry-run, #958): {ok: bool, trace: [...], sideEffectManifest: {mutations: [...], aiCalls: [...], webCalls: [...], blockedWebhooks: [...]}, costEstimate: {tokens, usd}}. The approval artifact shown to the user at Gate 3. Populated by mutationRecordBundleDryRun. Empty until Gate 2 runs. |
| `failureReason` | string |  | Populated when status transitions to failed -- which gate failed and why (e.g. 'gate1: spec specX references unknown field payload.foo'). Cleared on a successful re-author. |
| `ownerUserId` | string | yes | v1:identity:user.id who owns this bundle (the Responsibility author). Per-row authz owner; server-stamped from actor.userId at create, never caller-supplied. Authored automations run under THIS user's authz envelope -- no privilege escalation. |
| `responsibilityId` | string |  | v1:planner:responsibility.id this bundle was compiled from, when authored via the Responsibility intake path. Empty for bundles authored directly. Links the human-facing standing directive to its compiled artifact. |
| `retiredAt` | string |  | When the bundle was retired. Null unless status=retired. |
| `reusedConstructRefs` | array |  | Existing constructs this bundle COMPOSES rather than authors (the compose-first dependency strategy). Each entry: {name, kind, namespace, source: 'core'\|'catalog'}. Net-new dependencies are authored as their own v1:authoring:construct rows; this list records the reuse edges for the dependency graph + impact analysis (#957). |
| `sourcePlanId` | string |  | v1:planner:plan.id this bundle was post-hoc captured from, when authored via the everyday-task capture path (epic memql#1160, issue #1161) rather than a standing Responsibility. Empty for Responsibility-authored or directly-authored bundles. Links the one-off task that ran to its reproducible, inspectable compiled artifact; also the idempotency + lookup key for the capture orchestrator (skip re-authoring a re-delivered terminal event) and the #1162 view/edit/export surface. |
| `status` | string | yes | Lifecycle. draft = constructs authored, not yet validated. validated = passed Gate 1 (isolated compile+bind) -- see validationReport. dryRunPassed = passed Gate 2 (tiered behavioral dry-run) -- see dryRunReport. active = approved (Gate 3) and registered into the authored-construct runtime; its automation is live. paused = temporarily disabled by the user or a circuit breaker without retiring. retired = permanently deactivated (superseded by a new version or removed). failed = a gate failed (validation or dry-run); failureReason carries why. Transitioned via the authoring mutations; the engine does not enforce a hard state machine here (the planner loop drives transitions). (enum: draft, validated, dryRunPassed, active, paused, retired, failed) |
| `summary` | string |  | Longer human description of what the bundle does, generated by the planner design pass. Shown on the approval card alongside the dry-run trace + side-effect manifest. |
| `supersedesBundleId` | string |  | When this bundle is a new version of an existing capability, the v1:authoring:bundle.id it replaces. On activation the superseded bundle is retired. Empty for a first-version bundle. |
| `title` | string | yes | Human-readable name of the capability this bundle implements (e.g. 'Draft a reply when a refund escalation arrives'). Surfaced on management cards + the approval (Gate 3) artifact. |
| `validationReport` | object |  | Gate 1 result (isolated compile+bind, #956): {ok: bool, diagnostics: [{constructName, severity, message, line?}], boundConcepts: [...], unresolvedRefs: [...]}. Populated by mutationRecordBundleValidation. Empty until Gate 1 runs. |
| `version` | integer |  | Monotonic version of this capability. A user edit to the Responsibility (or a dependency change) produces a NEW bundle that supersedes the prior one via supersedesBundleId, rather than mutating an active bundle in place. |

## `v1:authoring:construct`

One authored DSL construct that is a member of a v1:authoring:bundle: the `.memql` source for an automation / logic / shape / spec / trait / policy / mutation / query / prompt, plus its cached compiled form. These are the NET-NEW constructs the planner authored because nothing existing fit (compose-first, author-the-gap); reused constructs are recorded on the bundle's reusedConstructRefs instead. After a bundle activates, a construct can be promoted into the per-owner reusable catalog (catalogued=true) so later bundles compose it -- the catalog match key lives in catalogKey (#957).

| Field | Type | Required | Description |
|---|---|---|---|
| `bundleId` | string | yes | v1:authoring:bundle.id this construct belongs to. Every authored construct is a member of exactly one bundle. |
| `catalogKey` | string |  | Dedup / match key for the catalog (#957): a stable signature of what this construct does (e.g. kind + bound concept + normalized predicate), used by the similarTo-backed matcher to find an existing construct before authoring a new one. Empty until catalogued. |
| `catalogMatchText` | string |  | The name-independent semantic text (kind + @description intent + canonicalized body) that was embedded for the near-match retrieval tier (#957). Computed by CatalogMatchText at promotion time and stored alongside the embedding (the vector itself lives in node_vectors keyed by this construct's id, vector_field='content') so similarTo can rank close-but-not-identical constructs for a stated need, and a re-embed can backfill from it. Empty until catalogued. |
| `catalogedAt` | string |  | Provenance (#957): when this construct was promoted into the owner's reusable catalog (the post-activation catalog-write path). Null until catalogued. Together with ownerUserId (who) and catalogedFromBundleId (which activated bundle) this is the full reuse provenance later bundles inherit when they compose it. |
| `catalogedFromBundleId` | string |  | Provenance (#957): the v1:authoring:bundle.id whose activation promoted this construct into the catalog. Normally the construct's own bundleId, but recorded explicitly so the provenance survives even after that bundle retires (a cataloged construct outlives a single bundle). Empty until catalogued. |
| `catalogued` | boolean |  | True once this construct has been promoted into the owner's reusable catalog (post-activation), so later bundles can compose it instead of re-authoring. Drives the compose-first reuse path (#957). |
| `compiledForm` | object |  | Cached compiled representation produced by the sandbox compile+bind harness (#956), so activation doesn't re-parse. Empty until Gate 1 compiles the bundle. |
| `kind` | string | yes | Which DSL construct kind this source defines. Drives which loader/validator the sandbox compile+bind harness (#956) routes it through. (enum: automation, logic, shape, spec, trait, policy, mutation, query, prompt) |
| `name` | string | yes | The construct's DSL name as it appears in source (e.g. the automation/logic/spec name). Owner-scoped uniqueness; the authored runtime registers it under targetNamespace so two users' authored constructs never collide. |
| `ownerUserId` | string | yes | v1:identity:user.id who owns this construct (same as the parent bundle's owner). Per-row authz owner; server-stamped from actor.userId at create. |
| `source` | string | yes | The raw `.memql` source text for this construct. The single source of truth; the compiled form is derived + cached. |
| `status` | string | yes | Follows the parent bundle's lifecycle at a construct grain: draft while the bundle is pre-activation, active once the bundle activates, retired when the bundle retires. Lets a cataloged construct outlive a single bundle. (enum: draft, active, retired) |
| `targetNamespace` | string | yes | The namespace this construct registers under in the authored runtime (e.g. an owner-scoped namespace). Resolution precedence at runtime is core (sealed) -> owner-catalog -> bundle-local. |

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

## `v1:calendar:calendarEvent`

A single calendar event owned by one user. The app-native source of truth for that user's schedule (#642): the reactive harness's reminder triggers read queryUpcomingEvents over these rows ('remind me the day before X'), and the calendar tool/skill lets agents create + list + edit them. source discriminates native (first-party, the only writer in v1) from externalSync (a future Google/CalDAV sync via knowledge:liveConnector, which stamps externalRef back to the upstream event id). recurrence is an optional RFC-5545 RRULE string carried verbatim for v1 -- expansion into concrete occurrences is a downstream concern, not stored here.

| Field | Type | Required | Description |
|---|---|---|---|
| `allDay` | boolean |  | True = a date-scoped event with no meaningful clock time (birthdays, holidays, 'out of office'). The frontend renders these in the all-day band; reminder logic uses the date rather than the instant. |
| `deleted` | boolean |  | Soft-delete flag. The calendar delete action stamps this true rather than hard-deleting so the time-series history survives and a future external-sync reconciler can propagate the deletion upstream. Queries filter it out via traitIsNotDeleted. |
| `endsAt` | string |  | Event end instant (RFC3339). Optional: a point-in-time reminder ('Call mom') may omit it. For allDay events this is the end-of-day (or the day after's midnight) boundary. |
| `externalRef` | string |  | When source=externalSync: the upstream event id (e.g. the Google Calendar event id) this row mirrors. Used by the future sync reconciler for idempotent upsert + deletion-propagation. Empty for native events. |
| `location` | string |  | Free-form location text ('Dojo on 5th', 'Zoom', a street address). Not geocoded in v1. |
| `notes` | string |  | Free-form notes / agenda / description body for the event. |
| `ownerUserId` | string | yes | v1:identity:user.id who owns this event. Stamped from actor.userId at create time. Every read self-scopes on this field; it is the load-bearing per-row authz guard. |
| `recurrence` | string |  | Optional RFC-5545 RRULE recurrence rule carried verbatim (e.g. 'FREQ=WEEKLY;BYDAY=TU,TH'). Empty = a one-off event. v1 stores the rule but does not expand occurrences server-side; the reminder + listing surfaces treat the row as its next/seed instance. |
| `source` | string | yes | Provenance discriminator. native = created in-app (the only writer in v1; the calendar tool + frontend stamp this). externalSync = mirrored from an external calendar (Google / CalDAV) via the knowledge:liveConnector sync path shipping later; those rows carry externalRef and are owned by the sync, not hand-edited. (enum: native, externalSync) |
| `startsAt` | string | yes | Event start instant (RFC3339). For allDay events this is midnight at the start of the day in the user's timezone. queryUpcomingEvents + queryEventsByDay range over this field. |
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
| `region` | string |  | Cloud region (e.g., 'us-central1') or 'local' for development. |
| `seedNodeTypes` | array |  | Required node types for this cluster (e.g., ['bff', 'cognition', 'planner']). |
| `status` | string |  | Current cluster health status. (enum: bootstrapping, healthy, degraded, shutting_down) |
| `version` | string |  | memQL version running on this cluster. |

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

## `v1:cluster:identityProvider`

An identity provider used for authentication and user management in a memQL cluster. Typically the in-house identity service (component/identity), surfaced for cluster-topology dashboards.

| Field | Type | Required | Description |
|---|---|---|---|
| `acceptedAudiences` | array |  | List of accepted token audiences. |
| `clientIdPrefix` | string |  | First 8 characters of the OAuth client ID (non-secret, for identification). Empty for the in-house identity service. |
| `clusterId` | string |  | Node ID of the parent v1:cluster:cluster record. |
| `issuerUrl` | string | yes | Token issuer URL (e.g., 'https://auth.example.com/'). |
| `jwksUrl` | string |  | URL of the public-key JWKS document used for token verification. |
| `lastVerifiedAt` | string |  | Timestamp of last successful JWKS/metadata refresh. |
| `name` | string | yes | Provider name (e.g., 'memQL Identity'). |
| `providerType` | string | yes | Authentication protocol. (enum: oidc, saml, ldap) |
| `redirectUrl` | string |  | OAuth callback URL configured for this provider. |
| `status` | string |  | Current connectivity status. (enum: connected, degraded, disconnected) |

## `v1:cluster:node`

A registered node in the memQL cluster. The record is written on registration and updated on every liveness transition (connecting, healthy, degraded, draining, offline, stopped). States mirror the NodeHealthStatus enum defined in component/node/node.proto -- that proto is the source of truth.

| Field | Type | Required | Description |
|---|---|---|---|
| `address` | string | yes | Advertised NodeService gRPC address for peer connections. |
| `capabilities` | array |  | Fully qualified capability names this node offers (e.g. integration.cognition.scoreUtterance). |
| `flavor` | string |  | Domain flavor within the node type. Empty for single-flavor types like cognition. |
| `health` | string |  | Last known health status. Mirrors NodeHealthStatus enum in node.proto. (enum: connecting, healthy, degraded, draining, offline, stopped) |
| `labels` | object |  | Arbitrary metadata key-value pairs. |
| `lastSeen` | string |  | ISO 8601 timestamp of the most recent heartbeat (or registration if none received yet). |
| `nodeType` | string | yes | Node role: bff, voice, cognition, agent, planner. |
| `parentId` | string |  | Node ID of the peer this node discovered via DB-based topology. Empty for the first node in a cluster. |

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

## `v1:cluster:trainingResult`

Ephemeral result node returned by trainAgent + trainAgentRetryStep capability handlers. Carries the per-run summary (counts of chunks indexed, identity-vector + system-prompt write status, retry-plan ids when the in-handler retry exhausted, elapsed wall-clock). The frontend reads this off the bundle to render the in-card success toast; the same fields also land on the training.completed canvas card for the historical record. Not intended to be queried -- it's a transit container, not a persisted entity. Cache TTL 0 + skipDeleted matches the other Plan/Task lifecycle concepts.

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string | yes | v1:agents:agent.id this result describes. |
| `agentName` | string |  | Display name of the agent at the time of training. Surfaced in toasts + cards so the UI doesn't have to re-fetch. |
| `chunksAlready` | integer |  | Chunks that were already in node_vectors and didn't need re-embedding. |
| `chunksEmbedded` | integer |  | Chunks the embedding loop pre-warmed during this run. |
| `distillError` | string |  | Step C's error message when systemPromptWrote is false. Empty when Step C succeeded. |
| `distillRetryPlanId` | string |  | trainAgentRetryStep Plan id queued by the backend when Step C failed after the in-handler retry. Empty when Step C succeeded. |
| `domainsAdded` | integer |  | Domains in the new set that weren't on the agent before. |
| `domainsRemoved` | integer |  | Domains in the old set that aren't in the new set. |
| `elapsedMs` | integer |  | Wall-clock duration of the trainAgent handler. |
| `identityError` | string |  | Step B's error message when identityVectorWrote is false. Empty when Step B succeeded. |
| `identityRetryPlanId` | string |  | trainAgentRetryStep Plan id queued by the backend when Step B failed after the in-handler retry. Empty when Step B succeeded. |
| `identityVectorWrote` | boolean |  | Step B (per-agent identity embedding) succeeded. |
| `step` | string |  | For trainAgentRetryStep results: which step was retried ('identityVector' or 'distillPrompt'). Empty for the main trainAgent capability. |
| `systemPromptWrote` | boolean |  | Step C (distilled system prompt) succeeded. |

## `v1:cognition:audioOverride`

Per-(spaceId, agentId) audio control override. Lets a user dial a single agent's TTS publication on / off / mirror_user inside one space without changing the agent's own default (audioControl on v1:agents:agent). Written by the orb-corner overlay in PresencePanel + the canvas presence widget. Read by the cognition handler before forwarding TTS to the Bridge Agent: an active override beats the agent default; absence falls through to the agent default. id is the deterministic audioOverride:<spaceId>:<agentId> so re-toggling on the same orb hits the same row instead of growing a per-click history.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-revoke flag. Setting active=false collapses back to the agent default without losing the row's history. |
| `agentId` | string | yes | v1:agents:agent.id this override targets. |
| `mode` | string | yes | Effective publication state. The bridge gating path treats this exactly the same as the agent default once selected: always_on publishes unconditionally; always_off suppresses TTS while letting text replies still flow to chat; mirror_user honours the user's current mic state, querying it at TTS-start time (not per-frame). (enum: always_on, always_off, mirror_user) |
| `setBy` | string |  | v1:identity:user.id of the actor who flipped the override -- the space owner under v1 permission rules. Audited against v1:identity:auditEvent. |
| `spaceId` | string | yes | v1:cognition:space.id this override is scoped to. |

**Relationships:** `parent` -> `v1:cognition:space`, `interactsWith` -> `v1:agents:agent`

## `v1:cognition:client:tool:request`

Ephemeral request envelope for a client-executed tool call bridging cluster nodes. Inserted by cognition's client-tool relay when the agent node emits a ClientToolCall that needs to reach a browser stream on BFF. The browser (via its client-tool relay bridge) subscribes to these events, dispatches the tool, and inserts a matching v1:cognition:client:tool:response. Records are not retained -- once the response arrives the pair is a no-op for future consumers. Lives under v1:cognition because the relay is a cognition-level concern (mediating between the agent loop and the browser stream); consuming products need not define their own variant.

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | ID of the agent that requested the call. Audit-only -- the response routes back to the agent via cognition, not via this field. |
| `argumentsJSON` | string |  | JSON-encoded arguments object for the tool. Empty string is equivalent to `{}`. |
| `callId` | string | yes | UUID correlating this request with its eventual v1:cognition:client:tool:response. Matches the ClientToolCall.call_id the agent emitted. |
| `expiresAt` | string |  | When the request stops being valid. Browsers arriving late ignore requests past this time; cognition drops stale correlations. |
| `participantId` | string |  | ID of the participant the browser is acting as. Lets the browser filter to its own user/session and prevents a call intended for user A from being answered by user B sharing the space. |
| `spaceId` | string |  | ID of the space this turn belongs to. Used to scope subscriptions on the browser side so each user only responds to calls aimed at their active space. |
| `toolName` | string | yes | Canonical tool name (e.g. `uiReadState`, `uiHighlight`). Resolved against the client-side tool registry. |

## `v1:cognition:client:tool:response`

Ephemeral response envelope paired with a v1:cognition:client:tool:request. Inserted by the browser after it dispatches the tool via the client-tool relay bridge. Cognition subscribes to these events, matches on callId, wraps the payload in a ClientToolResult MemqlClientMessage and forwards it to the agent node via AiForwardRequest so the parked agent tool-loop waiter unblocks.

| Field | Type | Required | Description |
|---|---|---|---|
| `callId` | string | yes | UUID matching the v1:cognition:client:tool:request this response fulfils. |
| `contentJSON` | string |  | JSON-encoded ToolResultContent[] produced by the browser-side tool dispatcher. Empty for error results. |
| `errorMessage` | string |  | Human-readable error message when isError=true. Empty on success. |
| `isError` | boolean |  | True when the tool failed. errorMessage carries the reason. |
| `spaceId` | string |  | ID of the space the tool ran against. Propagated from the request for traceability. |

## `v1:cognition:greetSuppression`

Short-lived marker that suppresses the greet-on-join LLM greeting for a space while a first-run walkthrough / guide is starting (copresent#252). The frontend arms it (deterministic id per space) when a brand-new user's first-run flow begins; greet-on-join reads it (queryActiveGreetSuppression) and SKIPS the greeting + LLM call when a non-expired one exists -- so the wasteful opening greeting doesn't fire while the guided intake is taking over the conversation. TTL-bounded via expiresAt so it never permanently mutes greetings. id is the deterministic greetSuppression-<hash(canonical spaceId)> so re-arming the same space upserts the latest row instead of growing history. Space-scoped (read by the cognition handler), mirroring v1:cognition:audioOverride.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-revoke flag (mirrors the override concepts). |
| `armedBy` | string |  | v1:identity:user.id of the actor who armed it (the space owner under v1 permission rules). Audit only. |
| `expiresAt` | string | yes | RFC3339; the suppression is ignored once now > expiresAt. |
| `spaceId` | string | yes | Canonical v1:cognition:space.id whose greet-on-join to suppress. |

**Relationships:** `parent` -> `v1:cognition:space`

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
| `topSpaces` | string |  | JSON array of { spaceId, count } entries -- spaces with the highest unmet rate. |
| `totalUnmet` | integer | yes | Total v1:cognition:unmetCapability rows in the window. |

## `v1:cognition:micState`

Per-(spaceId, userId) mic state record. The CoPresent MediaControls footer writes this on every mic toggle so the cognition handler can resolve mirror_user audio control: when the user mutes, mirror_user agents skip TTS publish on their next turn; when the user unmutes, they speak. id is the deterministic micState:<spaceId>:<userId> so the latest toggle wins at read time without growing a per-click history. Distinct from v1:cognition:participant.presence -- that record carries SI-side state (thinking / responding / etc) and we don't want mic toggles in the same versioned chain.

| Field | Type | Required | Description |
|---|---|---|---|
| `muted` | boolean | yes | True when the user's LiveKit mic is muted (track.enabled=false). False when actively publishing audio. |
| `spaceId` | string | yes | v1:cognition:space.id this state is scoped to. |
| `updatedAt` | string | yes | Wall-clock time the toggle landed -- used for staleness checks (e.g. ignore rows older than 30s when picking the effective state). |
| `userId` | string | yes | v1:identity:user.id whose mic state this is. |

**Relationships:** `parent` -> `v1:cognition:space`, `parent` -> `v1:identity:user`

## `v1:cognition:misrouteFeedback`

Append-only audit row capturing the misroute classifier's prediction and the user's response. Phase 8 feedback corpus -- drives tuning of the wrong-tab gating classifier whose toggle is exposed in CoPresent's Conversation Preferences (misrouteSafetyEnabled). forUserId is SERVER-STAMPED from actor.userId pre-insert. One row per classifier-gated send: when the user moves the message, dismisses the warning, the timeout fires, or the classifier blocks outright. Authz tier: owned. Spec ref: memql#190.

| Field | Type | Required | Description |
|---|---|---|---|
| `confidence` | number | yes | Classifier confidence 0.0-1.0. |
| `forUserId` | string | yes | User whose send action triggered the classifier. Server-stamped from actor.userId pre-insert. |
| `intendedThread` | string | yes | Tab the classifier predicted as the better fit. (enum: group, private) |
| `message` | string | yes | The original message text the classifier scored. |
| `movedToId` | string |  | Destination utterance id when userAction='moved'. Empty otherwise. |
| `originalThread` | string | yes | Tab the user was typing into when the classifier fired. (enum: group, private) |
| `spaceId` | string | yes | Space the send was scoped to. |
| `userAction` | string | yes | How the user responded. 'moved' = clicked Move, classifier won; 'dismissed' = clicked Send anyway; 'timeout' = warning auto-collapsed; 'blocked' = hard-block prevented send entirely. (enum: moved, dismissed, timeout, blocked) |
| `utteranceId` | string |  | Source utterance id when the row was persisted (the user wasn't blocked at send time). |
| `why` | string |  | Classifier rationale -- free text the model emits alongside its decision. |

**Relationships:** `parent` -> `v1:cognition:space`

## `v1:cognition:participant`

A human or SI participant instance within a space.

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | ID of the agent template (for SI participants). |
| `capabilityOverrides` | object |  |  |
| `displayName` | string | yes | Display name shown in the UI. |
| `forUserId` | string |  | v1:identity:user.id this SI participant belongs to (which human's team is this agent on?). Required on every SI participant inserted by the agent-roster mutations -- humans bring their own agents into their own private team chat, never each other's. Empty for human participants. The engine pre-insert guard enforces non-empty forUserId on SI participants and validates it matches the authenticated caller (non-elevated callers cannot land an agent on someone else's team). Used by the per-user-per-space 3-cap and by Phase 6's discussion-mode dispatch loop to find the per-user agent set. |
| `hidden` | boolean |  | When true, the participant is present in the space for routing purposes but is never rendered in participant-facing UI (PresencePanel, invite lists, etc.). |
| `isGroupGA` | boolean |  | True only on the owner's Assistant when it sits in the space's group context. The owner's GA is the only AI in group chat; specialists stay in per-user team chats. The participant guard rejects status='left' inserts on isGroupGA=true rows from non-elevated callers, so the GA cannot be removed from the group via the Roster tab. Set by the autoJoinSI automation on space creation (Phase 1.5) and never via the agent-roster mutations. |
| `isGuest` | boolean |  | Whether this participant joined via a guest invite (external, no CoPresent account). |
| `joinedAt` | string |  | When the participant joined the space. |
| `leftAt` | string |  | When the participant left the space. |
| `participantType` | string | yes | Whether this is a human or SI participant. Guests use "human" with isGuest=true and userId empty. (enum: human, si) |
| `spaceId` | string | yes | ID of the space this participant belongs to. |
| `status` | string |  | Participant lifecycle status. Real-time speaking state is tracked in v1:cognition:session. (enum: active, idle, left) |
| `userId` | string |  | External user ID (for human participants). |

**Relationships:** `interactsWith` -> `v1:agents:agent`, `parent` -> `v1:cognition:space`, `parent` -> `v1:identity:user`, `interactsWith` -> `v1:identity:user`

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
| `reason` | string |  | Optional, user-friendly explanation for state (avoid internal jargon). |
| `sinceAt` | string | yes | When this state began (best-effort). |
| `spaceId` | string | yes | ID of the space this presence snapshot belongs to. |
| `state` | string | yes | High-level, user-friendly state for UI rendering. (enum: idle, listening, thinking, responding, typing, waiting, needs_clarification, needs_human, paused, error, working, using_tool, researching, investigating) |

**Relationships:** `parent` -> `v1:cognition:space`, `parent` -> `v1:cognition:participant`

## `v1:cognition:privateUtterance`

Per-user 'Team-tab' utterance -- the private thread sister of v1:cognition:utterance. Each row lives in exactly one user's Team thread inside a space (the row's forUserId names the owner); the group thread reads NEVER surface it. forUserId is SERVER-STAMPED from actor.userId on insert -- callers cannot land a privateUtterance in someone else's thread regardless of what they pass. Authz tier: owned. Driven by the SPA's Team-tab + misroute Move flows (visionarys-io/copresent#44, Phase 8). Spec ref: memql#190.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-deactivate flag. |
| `deleted` | boolean |  | Soft-delete flag. |
| `forUserId` | string | yes | The user whose Team-tab thread owns this row. Server-stamped from actor.userId pre-insert by every mutation in this concept. |
| `participantId` | string | yes | v1:cognition:participant.id of the speaker. May be a human (the owner) OR an SI (an agent reply in the Team thread). |
| `participantType` | string |  | Denormalized from participant for filtering. Mirrors v1:cognition:utterance.participantType. (enum: human, si, system) |
| `replyToId` | string |  | Optional reply-to utterance id. Cross-thread allowed for misroute Move (a reply in the private thread to a group-thread utterance). |
| `source` | object |  | Same shape as v1:cognition:utterance.source -- inputMethod / pipeline / sttProvider / etc. |
| `spaceId` | string | yes | Owning space. |
| `text` | string |  | Text content -- typed or transcribed. |
| `utteranceType` | string | yes | Same enum as v1:cognition:utterance.utteranceType; carried so the renderer doesn't have to branch on concept. (enum: speech, text, action, system) |

**Relationships:** `parent` -> `v1:cognition:space`, `interactsWith` -> `v1:cognition:participant`

## `v1:cognition:session`

Real-time interaction state tracking device + stream + activity for a participant in a space. Audio capability is gated by the user's mic toggle (humanInput.microphoneEnabled) plus the agent's audioControl mode -- there is NO tier ceiling anymore. Whether voice flows in / out of the room is purely a function of who has their mic open and which agents are configured to publish TTS.

| Field | Type | Required | Description |
|---|---|---|---|
| `aiOutput` | object |  |  |
| `humanInput` | object |  |  |
| `lastActivityAt` | string |  | Timestamp of last activity in this session. |
| `participantId` | string | yes | ID of the participant this session tracks. |
| `spaceId` | string | yes | ID of the space this session belongs to. |
| `startedAt` | string |  | When the session started. |
| `streams` | string |  | Active stream and session identifiers for external services. |

**Relationships:** `parent` -> `v1:cognition:space`, `parent` -> `v1:cognition:participant`

## `v1:cognition:space`

Persistent rooms where humans and AI assistants meet, converse, and interact. Every space is a multi-participant room with a bounded capacity for humans and for agents -- there is no longer a 1:1 vs group distinction.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether the space is active. Set to false when the space leaves the active list (archived, saved, or hard-deleted) -- traitIsActiveRecord (payload.active==true) hides it from active-tab queries. |
| `archivedAt` | string |  | When the space was archived. Only set on rows whose status flipped to 'archived'. Cleared when the space is restored to active or saved. |
| `dailyDateKey` | string |  | YYYY-MM-DD date stamp for daily spaces, computed in the user's local timezone at provisioning time. Used to make the space id idempotent (daily-{userHash}-{dateKey}) so a duplicate provision is a no-op. Empty for non-daily spaces. |
| `deleted` | boolean |  | Hard-delete tombstone. Set to true by mutationDeleteSpaceNow (the Archived-tab "Delete now" override) and by the purgeExpiredArchivedSpaces cron when an archived space hits its retention deadline. traitIsNotDeleted (payload.deleted!=true) filters these rows out of every listing; mirrors v1:cognition:privateUtterance.deleted. |
| `description` | string |  | Optional description of the space. |
| `expiresAt` | string |  | Concrete deadline at which the purge cron hard-deletes this archived space. Stamped at archive time as archivedAt + User.preferences.archiveRetentionDays. Re-stamped on retention-setting changes so a 30->60 bump extends currently-archived spaces. The cron query is a plain `payload.expiresAt < now` comparison -- no per-row user lookup needed. |
| `goal` | object |  |  |
| `kind` | string |  | Space kind. 'regular' is the user-created default. 'daily' is a per-user singleton automatically provisioned every day; pinned at the top of the active list, private to the user + their assistant, and rolled over by the rolloverDailySpace cron. (enum: regular, daily) |
| `maxAgents` | integer |  | Maximum number of AI assistant participants allowed in this space. Always 1 under the one-assistant model (copresent #124): a space carries EXACTLY ONE assistant -- the owner's currently-active one, auto-joined by the autoJoinSI automation. Specialists and system agents never participate in spaces. |
| `maxHumans` | integer |  | Maximum number of human participants allowed in this space (default 5). Enforced at join time by the participant pre-insert guard. |
| `name` | string | yes | Display name of the space. |
| `ownerUserId` | string | yes | v1:identity:user.id of the space owner. The owner is the human whose assistant is wired into the space (the only AI presence that speaks to humans). Stamped at create time from the request actor; the @relationship below pins the parent. |
| `participantIds` | array |  | IDs of participants in this space. |
| `private` | boolean |  | When true, the space is private to its creator and their assistant -- no other users / agents can join. Daily spaces always set this to true. |
| `savedAt` | string |  | When the user manually saved the space ('saved' status -- preserved indefinitely, never auto-deleted). Cleared when the space leaves the saved state. |
| `scheduledAt` | string |  | When the space is scheduled to start (if status is 'scheduled'). |
| `settings` | object |  |  |
| `spaceType` | string |  | Type of HR space for mode-specific AI behavior. (enum: employeeCheckin, advocatePortal, handoffSession, <nil>) |
| `status` | string |  | Current lifecycle status of the space. Active = working space (default). Saved = manually preserved by the user; never auto-deleted. Archived = hidden from the active list and on a retention countdown to hard-delete (see archivedAt + User.preferences.archiveRetentionDays). Scheduled = future-dated meeting. (enum: active, saved, archived, scheduled) |
| `turnStateId` | string |  | ID of the turn state owned by this space. |
| `utteranceIds` | array |  | IDs of utterances in this space. |

**Relationships:** `parent` -> `v1:identity:user`, `contains` -> `v1:cognition:participant`, `owns` -> `v1:cognition:turn:state`, `contains` -> `v1:cognition:utterance`

## `v1:cognition:space:context`

Queryable runtime context snapshot for a space (participants, sessions, media activity). Intended to improve AI turn-taking and provide UI context.

| Field | Type | Required | Description |
|---|---|---|---|
| `computedAt` | string | yes | When this snapshot was computed. |
| `lastUpdatedAt` | string | yes | When this snapshot was last written (same as computedAt for now). |
| `snapshot` | object |  |  |
| `spaceId` | string | yes | ID of the space this context snapshot belongs to. |

**Relationships:** `parent` -> `v1:cognition:space`

## `v1:cognition:text:chunk`

A streaming text chunk emitted incrementally during AI response generation. The frontend subscribes to creation events and accumulates chunks into a real-time message.

| Field | Type | Required | Description |
|---|---|---|---|
| `done` | boolean | yes | Whether this is the final chunk. |
| `index` | integer | yes | Sequential chunk index (0-based). |
| `participantId` | string | yes | AI participant generating the text. |
| `replyId` | string | yes | Stable id for the entire turn. Every chunk in the same agent reply carries the same replyId, and the committed utterance for the reply uses this as its id. The frontend keys the rendered bubble by replyId so streaming chunks and the final commit address the same React element -- no remount, no avatar flicker. |
| `spaceId` | string | yes | Space where the text is being generated. |
| `text` | string | yes | The text content of this chunk. |

**Relationships:** `parent` -> `v1:cognition:space`, `createdBy` -> `v1:cognition:participant`

## `v1:cognition:turn:state`

Tracks conversation turn-taking state including who is speaking and AI participation permissions.

| Field | Type | Required | Description |
|---|---|---|---|
| `aiAnalysisJSON` | string |  | Raw JSON string with richer analysis output (internal/debug/UI). |
| `aiDecision` | object |  |  |
| `aiPermission` | string |  | Permission level for AI to jump into conversation. (enum: auto, requested, blocked) |
| `conversationContextJSON` | string |  | JSON string containing enriched conversation context from the turn state decision analysis (tone, topic continuity, momentum, pending topics). |
| `currentSpeakerId` | string |  | ID of the participant currently speaking. |
| `lastActivityAt` | string |  | Timestamp of last conversation activity. |
| `lastNudgeAt` | string |  | Timestamp when the silence nudge evaluation was last performed. |
| `lastNudgeUtteranceId` | string |  | Utterance ID for which the silence nudge evaluation was last performed (idempotency key). |
| `lastUtteranceId` | string |  | ID of the most recent utterance observed for this space. |
| `lastUtteranceType` | string |  | Type of the most recent utterance observed (speech, text, action, system). |
| `queue` | array |  | Queue of participant IDs waiting to speak. |
| `respondingAgentId` | string |  | ID of the AI participant selected to respond in this turn. Used by the AI responder to pick the right agent in multi-agent spaces. |
| `silenceDuration` | integer |  | Milliseconds of silence (for detecting pauses). |
| `spaceId` | string | yes | ID of the space this turn state belongs to. |
| `trigger` | string |  | Why this turn state version was produced (e.g., utterance, silence_nudge, init). |

**Relationships:** `parent` -> `v1:cognition:space`

## `v1:cognition:unmetCapability`

A single instance of the cognition router determining that no agent in a space could meet the user's request -- either the assistant stepped in as fallback (specialist_gap) or nobody could help (full_gap). Emitted by cognition via the cognition.capability.unmet event and consumed by the guardrail health rollup for product-level insight into missing capabilities.

| Field | Type | Required | Description |
|---|---|---|---|
| `reason` | string |  | Router's short explanation of why no agent fit. |
| `rosterSnapshot` | string |  | JSON-serialized snapshot of the space's agent roster at decision time (id/name/role/domains/keywords). Used by the rollup to cluster missing domains. |
| `routedAgentId` | string |  | ID of the agent the router ultimately routed to (may be empty when no agent was selected). |
| `routedAgentName` | string |  | Display name of the routed agent. |
| `severity` | string | yes | specialist_gap: assistant absorbed the turn as fallback (we lacked a specialist). full_gap: even the assistant could not help / no assistant in the room. (enum: specialist_gap, full_gap) |
| `spaceId` | string | yes | ID of the space the utterance occurred in. |
| `speakerName` | string |  | Display name of the human who spoke. |
| `topFitScore` | number |  | Router's fit score for the chosen agent (0..1). Low scores indicate nobody was a strong match. |
| `trigger` | string | yes | Why the unmet event fired: threshold gate, chain cap, missing assistant, or router-initiated. (enum: below_threshold, handoff_chain_cap, no_fit_no_fallback, router_escalated, router_fallback) |
| `turnMode` | string |  | Turn mode the router chose. answer = specialist stretch absorbed it; fallback_attempt = assistant stretched on a knowledge gap; escalation_notice = assistant refused and flagged. (enum: answer, fallback_attempt, escalation_notice) |
| `utterance` | string |  | Text of the user's request that no agent could meet. |
| `utteranceId` | string |  | ID of the triggering human utterance. |

**Relationships:** `parent` -> `v1:cognition:space`

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
| `replyToId` | string |  | ID of utterance this is replying to (for threading). |
| `retrieved` | array |  | RAG retrieval audit -- the full chunk pool the agent's replier surfaced to the LLM BEFORE the model decided what to cite. Each item has shape {domainId, sourceRef, similarity, textPreview, citation}. Distinct from `citations`: `citations` names what the model used; `retrieved` names what the model SAW. The frontend's 'Show details' expander beneath each agent reply renders both so the user can see passages the model considered but didn't cite. Empty when no domains were attached or retrieval returned nothing. |
| `source` | object |  |  |
| `spaceId` | string | yes | ID of the space this utterance belongs to. |
| `text` | string |  | Text content (transcribed or typed). |
| `timestamps` | object |  |  |
| `utteranceType` | string | yes | Type of utterance. (enum: speech, text, action, system) |
| `videoId` | string |  | ID of associated video media asset. |

**Relationships:** `interactsWith` -> `v1:cognition:participant`, `interactsWith` -> `v1:cognition:utterance`, `parent` -> `v1:cognition:space`

## `v1:cognition:videoOverride`

Per-(spaceId, agentId) video control override. Lets a user dial a single agent's avatar publication on / off / mirror_user inside one space without changing the agent's own default (videoControl on v1:agents:agent). Mirrors v1:cognition:audioOverride exactly -- same fields, same id pattern, same write/read paths -- but governs lip-synced video instead of TTS audio. Read by the voice-agent process at session start (Phase 9): an active override beats the agent default; absence falls through to the agent default. id is the deterministic videoOverride:<spaceId>:<agentId> so re-toggling on the same orb hits the same row instead of growing a per-click history.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-revoke flag. Setting active=false collapses back to the agent default without losing the row's history. |
| `agentId` | string | yes | v1:agents:agent.id this override targets. |
| `mode` | string | yes | Effective publication state. The voice-agent's avatar-gating path treats this exactly the same as the agent default once selected: always_on publishes unconditionally; always_off suppresses video while letting audio + chat continue; mirror_user honours the user's current video state at session start. (enum: always_on, always_off, mirror_user) |
| `setBy` | string |  | v1:identity:user.id of the actor who flipped the override -- the space owner under v1 permission rules. Audited against v1:identity:auditEvent. |
| `spaceId` | string | yes | v1:cognition:space.id this override is scoped to. |

**Relationships:** `parent` -> `v1:cognition:space`, `interactsWith` -> `v1:agents:agent`

## `v1:common:attachment`

A file attachment uploaded to a space, with extracted transcription.

| Field | Type | Required | Description |
|---|---|---|---|
| `blobUrl` | string | yes | Azure Blob Storage URL where the file is stored (https://account.blob.core.windows.net/container/object). |
| `fileName` | string | yes | Original filename of the uploaded file. |
| `fileSize` | integer |  | File size in bytes. |
| `mimeType` | string | yes | MIME type of the uploaded file. |
| `spaceId` | string | yes | ID of the space this attachment belongs to. |
| `status` | string | yes | Processing status of the attachment. (enum: processing, ready, error) |
| `summary` | string |  | AI-generated 2-3 sentence summary of the file content. |
| `transcription` | string |  | Extracted plain text from the file, or image description for images. |
| `uploadedBy` | string | yes | Actor identifier of the user who uploaded the file. |

**Relationships:** `parent` -> `v1:cognition:space`

## `v1:common:documentChunk`

A single retrievable text chunk attached to a knowledge domain. Chunks are produced by the knowledge ingestion integration (which splits source text and embeds each chunk). The embedding itself lives in the node_vectors table keyed by this chunk's id, via integration.embedding.store with vectorField='content'. Per Q8: text-style breakdowns of user-uploaded Documents (PDF sections, markdown chunks, plain text chunks) reuse this concept rather than duplicating the chunk infrastructure into a new typed concept.

| Field | Type | Required | Description |
|---|---|---|---|
| `documentId` | string |  | Per Q8: optional back-reference to v1:knowledge:document when this chunk came from a user-uploaded file rather than a seeded corpus. Null for seeded copresent_ui chunks; populated for chunks produced by the analyzer. |
| `domainId` | string | yes | ID of the parent v1:common:knowledgeDomain. Queries filter by this to scope retrieval to the agent's selected domains. |
| `seq` | integer |  | Order within the source (0-based). A document of N chunks has seq 0..N-1. |
| `source` | string | yes | Provenance discriminator for audit, UI grouping, and the dev-refresh cache filter. Aligned with the citation-registry source taxonomy on the agent-reply side -- one word, one meaning across the whole stack. 'llmSeeded' = baseline LLM-generated content from seedDomainContent (catalog Tier-A/B bodies, Tier-B disclaimers, Tier-C Wikipedia chunks). 'augment' = topic-focused chunks added via the chat 'Analyze for training' action; carries sourceUtteranceId + sourceAgentId + sourceTopic back-pointers. 'crossDomainBridge' = bridge content generated when an agent has 2+ domains. 'appStructure' = CoPresent UI corpus that drives operator UI moves (cited silently). 'fileUpload' = user-uploaded document content (when wired). 'trainerAgent' = chunks distilled by the Trainer Agent's web-search + reasoning pipeline (Q3, Q9); cited with provenance back to the original web sources via sourceRef. Required: every writer must declare which class of provenance it represents. (enum: llmSeeded, augment, crossDomainBridge, appStructure, fileUpload, trainerAgent) |
| `sourceAgentId` | string |  | When source='augment': bare id of the v1:agents:agent whose retrieval gap surfaced this chunk. Same provenance audit purpose as sourceUtteranceId. |
| `sourceRef` | string |  | Where the chunk came from, e.g. 'opid:agents.new', 'doc:README.md#L42', 'url:https://docs.copresent.app/agents'. Used for citation in the UI and for idempotent re-ingestion. |
| `sourceTopic` | string |  | When source='augment': the narrow topic the augmentDomainContent prompt was asked to cover (e.g. 'Bronze Age Collapse and the Sea Peoples'). Useful for grouping all chunks generated from one augment action together in the Knowledge panel. |
| `sourceUtteranceId` | string |  | When source='augment': bare id of the v1:cognition:utterance that triggered the augment action. Lets the Knowledge panel show 'Added from chat with <agent> on <date>' provenance and lets a future cleanup audit reach back to the conversation. |
| `superseded` | boolean |  | Per Q9 trainSpecialist mode='refresh': set true when the Trainer Agent marks this chunk outdated (via markChunkSuperseded). Superseded chunks are excluded from retrieval -- they stay in the table for audit / provenance but no longer surface in the system_knowledge block. The replacement chunk (if any) carries fresher content written in the same refresh run. |
| `supersededAt` | string |  | When this chunk transitioned to superseded. Set alongside superseded=true by markChunkSuperseded. |
| `supersededReason` | string |  | The Trainer Agent's stated reason for marking the chunk outdated (e.g. 'superseded by 2026 figures', 'source page removed'). Surfaced in the Knowledge panel's chunk-history view. |
| `text` | string | yes | The chunk text. Kept as plain text so findSimilar can re-embed on demand and the model can render it in the system_knowledge prompt block. |
| `tokenCount` | integer |  | Approximate token count, rough character-length / 4 heuristic. Used for budgeting context windows when assembling the system_knowledge block. |
| `validationStatus` | string |  | Per Q15: validation gating mirror of v1:knowledge:document. validated = ingestible into knowledge domains; rejected = soft-deleted from retrieval. Seeded chunks default to 'validated' since they ship as canonical. (enum: unvalidated, validated, rejected) |

**Relationships:** `parent` -> `v1:common:knowledgeDomain`

## `v1:common:knowledgeBridge`

Synthetic 'bridge' that combines multiple knowledge domains for a specific role. Generated per-agent at training time when an agent has 2+ knowledge domains attached: the bridge captures cross-domain connections specific to that combination + role (e.g. how a customer-service agent applies tax_law + accounting differently from a legal-compliance agent applying the same two domains). Hash-keyed by (roleSlug, sortedDomainIds) so identical combinations across agents share the same bridge corpus -- pay for the LLM call once per (role, combo) pair, reuse for all subsequent agents that match. Per docs/planning/knowledge-seeder.md (v2 bridge chunks).

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-delete flag. False = bridge no longer attaches to new agents but historical agents that reference it still resolve. |
| `bridgeId` | string | yes | Stable id derived from sha256(roleSlug + ':' + sortedDomainIds.join(',')); shared across agents that have the same role + domain set. |
| `chunkCount` | integer |  | Number of chunks generated under this bridge id. Cached for status displays. |
| `combinationKey` | string | yes | Human-readable join of domainIds for at-a-glance debugging in logs / DB. Same content as sorted(domainIds).join(','). |
| `domainIds` | array | yes | Sorted list of domain ids this bridge spans. Reading this back gives you the combination key. |
| `generatedAt` | string |  | When the bridge was first generated. Read by any future bridge-freshness check. |
| `recipeVersion` | string |  | Seeder recipe version used to generate this bridge; bumping invalidates it on next train. |
| `roleSlug` | string | yes | The role this bridge specialises framing for. customer-service x {accounting, tax_law} is a different bridge from accounting-finance x {accounting, tax_law}. |

## `v1:common:knowledgeDomain`

A knowledge domain that agents can specialise in. First-class replacement for the hardcoded domain list that used to live in the frontend. Each domain can have document chunks ingested into it for retrieval-augmented generation, and can declare which tool slugs REQUIRE it (so the UI auto-adds it when the user picks a tool like copresent_takeover). Per Q21: user-created domains carry a scope (workspace = visible to all in partition; private = visible only to owner) plus an ownerId; seeded domains stay workspace-scoped with ownerId null (system-owned). Per docs/planning/knowledge-seeder.md: seeded domains carry a tier (A=auto-seed, B=auto-seed with disclaimer, C=high-stakes, do-not-auto-seed) that drives the seeder pipeline's content strategy.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether this domain is selectable in the agent builder. Soft-delete via active=false instead of deleting the row so historical agents that reference it still resolve. |
| `category` | string |  | Coarse grouping used by the UI picker. core/business/technical/product/internal cover the original business-and-app catalog; science/humanities/creative/specialized/hobby are the catalog-expansion buckets (physics, history, music, law, sports, etc.). (enum: core, business, technical, product, internal, science, humanities, creative, specialized, hobby) |
| `description` | string |  | One-line description of what this domain covers. |
| `lastSeededAt` | string |  | When the seeder last successfully ran for this domain. Read by the training pipeline's freshness check -- if the domain is older than the freshness window AND has been seeded before, training re-seeds it. Null = never seeded. |
| `lockedForRoles` | array |  | Agent role slugs for which this domain is REQUIRED. Phase 2 cut (#158): domains are now bundled inside v1:agents:skill rows and the role catalog locks SKILLS rather than domains directly. This field is a derived backstop -- the seeder mirrors which roles end up with this domain in their resolved skill bundle so retrieval / lock-enforcement queries can hit either index. Empty for domains that no role's locked skill set bundles. |
| `name` | string | yes | Display name, e.g. 'CoPresent UI' or 'Business Administration'. |
| `ownerId` | string |  | v1:identity:user.id of the creator. Required for scope='private' (used as visibility filter); informational for scope='workspace'. Null for seeded domains (system-owned). |
| `predefined` | boolean |  | True for domains that ship in the Go-side catalog (integrations/knowledge/seed.go) and are re-seeded on every memQL startup. The frontend renders these as LOCKED in the Knowledge panel: name / description / category / scope / source are read-only, only refreshCadenceDays is editable, the row is not delete-able, and file upload / drop is disabled (predefined domains carry only LLM-seeded chunks, not user-uploaded content). User-created domains via the '+ New' button default to false and remain fully editable. |
| `refreshCadenceDays` | integer |  | How often (in days) the domain should be re-seeded by the freshness check. Picker constraint on the create/edit modal: 30 / 90 / 120. Read by the training pipeline's domainNeedsRefresh check -- if lastSeededAt is older than refreshCadenceDays days, retrain re-seeds. Default 90 matches the prior hardcoded freshnessWindow and is a sensible LLM-content drift cadence. Also the cadence backstop for Q9 event-driven Trainer refreshes -- if no stale-signal event fires within this window, the daily refreshDueKnowledgeDomains cron spawns a trainSpecialist Plan with mode='refresh'. |
| `relevantForRoles` | array |  | Agent role slugs (from v1:agents:agentRole.slug) that see this domain in their picker. Empty means 'all roles'. Visibility filter only; for the cannot-remove minimum see lockedForRoles. |
| `requiredByToolSlugs` | array |  | Stored-tool slugs (e.g. 'uiClick' or 'copresent-takeover') that REQUIRE this domain. Phase 2 cut (#158): tools and domains are now both bundled inside v1:agents:skill rows -- this field is retained as a back-pointer for the agent-builder convenience path that auto-attaches a domain when a user picks a tool. The operator-turn retrieval reads it to decide which domains to retrieve from when a client-tool call lands. |
| `scope` | string |  | Per Q21: 'workspace' = visible to everyone in the partition (default; matches seeded domains); 'private' = visible only to ownerId. Retrieval queries auto-filter on this. (enum: workspace, private) |
| `seederRecipeVersion` | string |  | The recipe version (e.g. 'v1') used the last time this domain was seeded. Bumping the global recipe version invalidates all prior seeds; training detects this on retrain and triggers a re-seed. |
| `source` | string |  | Where this domain's chunks come from. Drives the citation label format the agent uses when it cites a chunk in a reply (Go-side citation registry in integrations/agent/replier.go). 'llmSeeded' = generated by the seedDomainContent prompt (default for the catalog). 'crossDomainBridge' = generated by seedDomainBridge. 'fileUpload' = chunks extracted from user-uploaded files. 'conversationCapture' = chunks captured from a chat. 'webIngest' = chunks fetched from a URL. 'appStructure' = the copresent_ui docs that drive operator-mode UI moves -- agents do NOT cite these audibly. 'trainerAgent' = chunks distilled by the Trainer Agent's web-search + reasoning pipeline (Q3, Q9); cited with provenance back to the original web sources. (enum: llmSeeded, crossDomainBridge, fileUpload, conversationCapture, webIngest, appStructure, trainerAgent) |
| `staleSignalCount` | integer |  | Per Q9: running count of stale-evidence signals the Planner Agent has logged against this domain since the last successful refresh. Bumped by the markKnowledgeDomainStale tool. Resets to 0 when a trainSpecialist Plan with mode='refresh' completes. When it crosses a threshold (default 3), the Planner Agent may choose to spawn an immediate refresh rather than waiting for the cadence backstop. |
| `tier` | string |  | Seeder tier per docs/planning/knowledge-seeder.md. A = general knowledge, LLM-seeded normally. B = safety-relevant, LLM-seeded with a 'general info, not professional advice' disclaimer chunk prepended. C = high-stakes specialist (clinical medicine, surgical technique, securities advice, legal practice); seeder fetches Wikipedia content for the configured articles, or falls back to a 'upload your own authoritative content' placeholder if no Wikipedia mapping exists. Set automatically at seed time from the StandardDomain.Tier field; user-created domains default to A. (enum: A, B, C) |

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
| `size` | integer |  | File size in bytes. |
| `spaceId` | string | yes | ID of the space this media belongs to. |
| `transcription` | object |  |  |
| `url` | string | yes | Storage URL for the asset. |

**Relationships:** `parent` -> `v1:cognition:space`

## `v1:curriculum:curriculum`

A guided lesson plan that an agent with the app-control tool set can run. Consumed by the CoPresent Operator on the client and executed segment by segment. The first consumer is the first-login demo (`copresent.welcome.v1`); future consumers are education agents running lessons against CoPresent or other apps.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether this curriculum is available to be run. |
| `description` | string |  | Short summary shown to the user and used when presenting curriculum options in an authoring UI. |
| `entrySegmentId` | string | yes | ID of the segment this curriculum starts with. |
| `locales` | array |  | Locale codes this curriculum's content is available in (e.g. 'en-US', 'es-MX'). Used by the client to pick the right variant. |
| `name` | string | yes | Human-readable title shown to the user. |
| `purpose` | string |  | What kind of experience this is. Drives where / when the curriculum is surfaced. (enum: onboarding, help, education, other) |
| `requiredScopes` | array | yes | Tool scopes this curriculum's segments may use (e.g. 'read', 'navigate', 'highlight', 'create', 'update', 'identity'). The Operator rejects any tool call whose scopes are not in this set. Scopes are the inner defense-in-depth layer on top of the global tool deny-list. |
| `slug` | string | yes | Stable machine-readable identifier (e.g., 'copresent.welcome.v1'). Used by the client to subscribe to a specific curriculum irrespective of the node ID. |
| `version` | integer | yes | Monotonically increasing version. Onboarding records pin the version at start so an edit does not disrupt an in-flight session. |

## `v1:curriculum:segment`

One step in a v1:curriculum:curriculum. Carries the GA's narration, the tool calls the GA should consider making, and the options the user can pick to advance the graph. Authoring model is hybrid: a segment has a `goal` and a set of `recommendedSteps` the GA follows by default but may deviate from based on runtime context (e.g., user already created a space, user asked a side question, user is confused). Options carry an explicit `nextSegmentId` when the author knows the route, or a `roleTag` the GA resolves to a concrete target at runtime.

| Field | Type | Required | Description |
|---|---|---|---|
| `acceptsFreeForm` | boolean |  | Whether the user can type / speak a free-form question on this segment. If true, the GA handles it in-place (answers, then returns to options). If false, the segment is strictly option-driven. |
| `curriculumId` | string | yes | ID of the v1:curriculum:curriculum this segment belongs to. |
| `goal` | string | yes | What the GA should accomplish in this segment, expressed for the LLM. Drives deviation decisions when the recommendedSteps don't fit the moment. |
| `narration` | string | yes | The base narration text. In text mode it is rendered in the presenter card; in voice/avatar modes it is synthesized by TTS. The GA may paraphrase or expand as long as it stays on-goal. |
| `options` | string | yes | JSON array of {id, label, shortcutKey?, nextSegmentSlug?, roleTag?} option descriptors. Rendered as A/B/C buttons in text mode; spoken / listened-for in voice mode. At least one option must exist (even if it's just 'Continue') so the flow can advance. roleTag values: 'advance' \| 'deeper' \| 'skip' \| 'back' \| 'end'. |
| `orderHint` | integer |  | Optional ordering hint for authoring UIs and progress indicators. Not used at runtime for routing (that's the option graph). |
| `recommendedSteps` | string |  | JSON array of {name, arguments} tool calls the GA should consider running when the segment is entered. Example: [{"name":"ui.highlight","arguments":{"target":"nav.spaces","hint":"Spaces"}}]. Ordered. The GA is expected to run these by default and skip / reorder / augment only with clear reason. |
| `slug` | string | yes | Stable identifier within the curriculum (e.g., 'greeting', 'tour-spaces'). The entry / option edges reference segments by slug, not node ID, so authoring can move things around without rebinding edges. |
| `successCondition` | string |  | Natural-language description of when this segment is 'done'. Used by the GA's judgment when it decides to force-advance or hold. Example: 'User has provided a preferred name or chosen to skip.' |

**Relationships:** `parent` -> `v1:curriculum:curriculum`

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
| `recordId` | string | yes | The v1:data:record node ID this log entry refers to |
| `spaceId` | string | yes | Space ID for scoped log queries |
| `toState` | string | yes | Validation state after the action (enum: draft, checked, confirmed) |

**Relationships:** `parent` -> `v1:data:record`

## `v1:data:policy`

Validation policy defining check/confirm requirements for a record type. Controls how many synthetic checks and human confirmations are needed, and whether checked data is usable before full confirmation.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-delete flag (append-only semantics) |
| `checkedDataUsable` | boolean |  | Whether checked (not yet confirmed) records are usable live |
| `requiredChecks` | integer |  | Number of synthetic checks needed for draft -> checked |
| `requiredConfirmations` | integer |  | Number of human confirmations needed for checked -> confirmed |
| `revertMinRole` | string |  | Minimum role required to revert records (enum: owner, admin, writer, reader) |
| `spaceId` | string |  | Optional space scope. Null means global for this record type. |
| `targetRecordType` | string | yes | Record type this policy applies to (e.g., 'vehicle', 'bird') |

**Relationships:** `parent` -> `v1:cognition:space`

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
| `lastCheckedAt` | string |  | When last checked by a synthetic identity |
| `lastCheckedBy` | string |  | Identity ID of last synthetic checker |
| `lastConfirmedAt` | string |  | When last confirmed by a human identity |
| `lastConfirmedBy` | string |  | Identity ID of last human confirmer |
| `naturalKeyField` | string |  | Name of the natural key field for conflict detection (e.g., 'vin', 'name') |
| `naturalKeyValue` | string |  | Value of the natural key for conflict matching |
| `recordType` | string | yes | Domain-specific record type (e.g., 'vehicle', 'bird', 'employee') |
| `sourceAttachmentId` | string |  | Reference to source attachment if file-based import |
| `spaceId` | string | yes | Space this record belongs to |
| `validationState` | string |  | Current lifecycle state (enum: draft, checked, confirmed) |

**Relationships:** `parent` -> `v1:cognition:space`

## `v1:guide:guide`

A persisted, re-runnable Guide: an ordered sequence of Scenes the General Assistant narrates while driving the CoPresent UI + Canvas in an immersive voice-to-voice walkthrough. Authored on the fly from a voice intake (copresent#194) and run by the client Guide runtime (copresent#190). Consumed first by the first-run walkthrough (copresent#195), then generalised to anytime demo/teach (copresent#196). Evolves v1:curriculum:curriculum -- same parent+ordered-children shape -- as a distinct namespace so the training-studio Curriculum stays untouched.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether this Guide is available to be run. Soft-disable without deleting the row + its Scenes. |
| `avatarEnabled` | boolean |  | Whether the assistant avatar video engages alongside voice while this Guide runs (copresent#192). Per-Guide config: the generator defaults this ON for educational / demo Guides and OFF otherwise; the user / author can override. |
| `description` | string |  | Short summary of what the Guide covers. Surfaced in any authoring / replay picker and on the consent-forward entry prompt. |
| `generatedFromIntake` | boolean |  | Provenance: true when this Guide was authored on the fly from a voice intake (copresent#194), false for hand-seeded / template Guides. Lets the UI distinguish 'tailored for you' Guides from canned ones. |
| `intakeSummary` | string |  | Short summary of the intake that produced this Guide (industry, role, interests, goals). Null for non-generated Guides. Carried for provenance + so a regenerate can reuse the captured context. |
| `kind` | string | yes | Category of experience. 'walkthrough' = first-run / feature tour; 'demo' = show me X; 'teach' = teach me how to Y. Drives the avatarEnabled default at generation time (demo / teach default avatar-on; copresent#192) and how the Guide is surfaced. (enum: demo, teach, walkthrough) |
| `locales` | array |  | Locale codes this Guide's content is available in (e.g. 'en-US', 'es-MX'). The client picks the matching variant. |
| `name` | string | yes | Human-readable title shown to the user (e.g. 'Welcome to CoPresent', 'Demo: creating a sales agent'). |
| `ownerUserId` | string |  | v1:identity:user.id of the Guide's owner (the user the Guide was generated for, or the author). Null for system-seeded Guides like the generic first-run template. |
| `requiredScopes` | array |  | Operator tool scopes this Guide's Scenes may use (e.g. 'read', 'navigate', 'highlight', 'create', 'update', 'identity'). Mirrors curriculum.requiredScopes: the client Guide runtime rejects any tool call whose scopes fall outside this set -- defense-in-depth on top of the GA's GA-only operator gating. |
| `sceneCount` | integer |  | Number of Scenes in this Guide. Stamped by the generator on create so the client can render progress (Scene k of N) without a separate count query. |
| `slug` | string | yes | Stable machine-readable identifier. Well-known slugs drive fixed entry points (e.g. 'first-run-walkthrough'); generated Guides get a unique slug at authoring time. The client re-runs a Guide by slug irrespective of node ID. |
| `spaceId` | string |  | Optional space scope. When set, the Guide is associated with a specific space; null = workspace-level / not space-bound (e.g. the first-run walkthrough before the user has a space). |
| `version` | integer | yes | Monotonically increasing version. A replay pins the version it started with so an edit mid-run does not disrupt an in-flight session (mirrors curriculum/onboarding versioning). |

## `v1:guide:scene`

One Scene in a v1:guide:guide: the unit of a Guide. Carries the narration INTENT the GA voices (it may paraphrase, staying on-intent), the Canvas actions to perform (publish content + live annotation directives), optional avatar directives, and the interruptibility contract (interruptible / allowsQuestions) the locked-Scene control enforces (copresent#191). Scenes are ordered by `order`; the runtime advances on Scene completion / agent decision. Evolves v1:curriculum:segment -- narration + recommended actions + ordering -- without the option-graph branching (a Guide is a linear narrated sequence, not a choose-your-own-path).

| Field | Type | Required | Description |
|---|---|---|---|
| `allowsQuestions` | boolean |  | Whether this Scene is an open boundary where a queued raise-hand is acknowledged and questions are taken (copresent#191). A locked Scene (interruptible=false) typically also sets this false; the runtime picks up a pending raise-hand at the next Scene whose allowsQuestions=true. |
| `avatarDirectives` | string |  | Optional JSON for assistant-avatar behavior during this Scene (copresent#192), e.g. {"show":true}. Null inherits the Guide-level avatarEnabled. Reserved for per-Scene avatar nuance; the v1 runtime only needs the Guide-level flag. |
| `canvasActions` | string |  | JSON array of Canvas directives the GA performs during this Scene, in order. Two directive families: content publish (reuse canvas.publish -- {"type":"publish","kind":"card\|document\|dataview","data":{...}}) and live annotation (the overlay layer from copresent#193 -- {"type":"annotate","shape":"point\|arrow\|circle\|highlight","target":"<data-op-id>"}). Empty / null = a narration-only Scene. The client Guide runtime dispatches these through the same local operator dispatcher as the ui* primitives. |
| `guideId` | string | yes | ID of the v1:guide:guide this Scene belongs to. |
| `interruptible` | boolean |  | Whether the user can barge in (speak over the agent) during this Scene. When false, the client mutes the user mic TRACK for the Scene's duration (copresent#191) so the narration cannot be interrupted; re-enabled on the next interruptible / allowsQuestions Scene. |
| `narrationIntent` | string | yes | What the GA should CONVEY in this Scene, expressed for the LLM (intent, not a verbatim script). The agent narrates this naturally over voice, paraphrasing / expanding as long as it stays on-intent. Example: 'Welcome the user by name, explain that spaces are where they collaborate with their assistant, and point at the Spaces nav.' |
| `order` | integer | yes | 0-based position in the Guide's Scene sequence. The runtime plays Scenes in ascending order; gaps are tolerated (sort, don't index). |
| `slug` | string | yes | Stable identifier within the Guide (e.g. 'intro', 'show-spaces', 'wrap-up'). Lets authoring reorder Scenes without rebinding references. |
| `successCondition` | string |  | Optional natural-language description of when this Scene is 'done', used by the agent's judgment to decide when to advance. Example: 'The user has seen the Spaces panel open.' Null = advance when the narration + Canvas actions complete. |
| `title` | string |  | Short Scene title for the client's progress / navigator affordance (e.g. 'Creating your first space'). Optional; the runtime falls back to a positional label. |

**Relationships:** `parent` -> `v1:guide:guide`

## `v1:harness:consolidationCursor`

The per-owner consolidation watermark (#586), stored as a node so the consolidation loop's bookkeeping is itself durable + queryable -- no separate cursor store. Holds the createdAt boundary of the most recent episodic batch already consolidated for this owner; each scheduled run reads only episodes with createdAt > watermark, then advances the watermark to the newest episode it processed. This is what makes consolidation INCREMENTAL: cost is bounded by the new-episode delta, not total history, as the agent's log grows without bound. One row per owner (content-addressed id on ownerUserId), updated in place. ownerUserId is the per-row authz key (owned tier), stamped from actor.userId at create time.

| Field | Type | Required | Description |
|---|---|---|---|
| `episodesSeen` | integer |  | Running count of episodic nodes consolidated for this owner across all runs. Diagnostic only -- lets an operator see consolidation throughput per owner. The reinforce/advance mutation takes the bumped value (computed engine-side, since the parser has no arithmetic). |
| `lastRunAt` | string |  | When consolidation last ran for this owner. Diagnostic / observability only -- the watermark (not this) is the correctness-bearing field. Useful for spotting an owner whose consolidation has stalled. |
| `ownerUserId` | string | yes | v1:identity:user.id this cursor belongs to. The per-row authz key (owned tier); stamped from actor.userId at create time. One cursor row per owner -- consolidation is per-owner, so each owner's watermark advances independently. |
| `provenanceMutation` | string |  | Name of the mutation that produced this cursor version (mutationAdvanceHarnessConsolidationCursor). Pairs with the engine-stamped createdBy intrinsic to name the transition in the audit trail. |
| `watermark` | string | yes | The createdAt of the newest episodic node already consolidated for this owner. The next run reads episodes with createdAt > watermark only; advancing this after each run is what bounds consolidation cost incrementally. Set to the engine-computed max(createdAt) over the batch the run processed. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:harness:observation`

What actually happened during a step -- the agent's own actions made durable and recall-able. One observation per meaningful event (a tool result, an error, a note, a decision). The `content` field is the embedding text: the harness's embedding loop stores it into node_vectors keyed by this observation's id (via integration.embedding.store with vectorField='content'), so observations become recall-able memory feeding the recall path in #585 -- the agent can semantically search its own history ('what did I try last time I hit this error?'). The `embedding` field carries the vector once computed; until then recall reads node_vectors directly. ownerUserId is the per-row authz key (owned tier), stamped from actor.userId at create time. Provenance is automatic via the engine-stamped createdBy intrinsic.

| Field | Type | Required | Description |
|---|---|---|---|
| `content` | string | yes | The text rendering of this observation -- the embedding source, so observations are recall-able. The harness embedding loop stores this into node_vectors keyed by the observation id (integration.embedding.store, vectorField='content') so the observation is semantically recall-able (#585): the agent can search its own history. Mirrors the v1:common:documentChunk content-as-embedding pattern -- the vector lives in node_vectors keyed by node id, not inline on the row. |
| `data` | object |  | Structured per-kind data (named `data`, not `payload`, since payload is a reserved row intrinsic -- same gotcha as v1:copresent:canvasState). tool_result: {toolName, args, result}. error: {message, stack?}. decision: {choice, rationale, alternatives?}. note: {text}. |
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
| `completedAt` | string |  | When the plan reached a terminal status. |
| `errorMessage` | string |  | Populated when status transitions to failed. |
| `goal` | string | yes | Human-readable description of what the plan is trying to accomplish. |
| `input` | object |  | Free-form input payload the plan was created with (the request that kicked it off). Discriminated by the consuming reconciler; opaque to the engine. |
| `ownerUserId` | string | yes | v1:identity:user.id of the plan owner. The per-row authz key (owned tier); stamped from actor.userId at create time. Only the owner reaches this plan's reads/writes. |
| `provenanceMutation` | string |  | Name of the mutation that produced this plan version (createPlan / startPlan / completePlan / ...). Pairs with the engine-stamped createdBy intrinsic to name every transition in the audit trail. |
| `result` | object |  | Rolled-up plan result, populated at terminal status from the steps' results. |
| `rootStepId` | string |  | v1:harness:step.id of the entry step (the DAG root). Optional -- set by addStep when the first step lands, or left empty for a plan whose steps are all independent. |
| `startedAt` | string |  | When the plan first transitioned to running. |
| `status` | string | yes | Plan lifecycle. open = created, not yet started; running = steps executing; done / failed / cancelled = terminal. The step state machine drives plan-level progress; the reconciler (#583) promotes the plan as its steps complete. (enum: open, running, done, failed, cancelled) |

**Relationships:** `parent` -> `v1:identity:user`, `owns` -> `v1:harness:step`

## `v1:harness:semanticMemory`

A durable, distilled belief consolidated from episodic memory (#586) -- a stable fact, preference, or learned outcome the agent should keep across plans. The `content` field is the embedding text: the consolidation + embedding loop stores it into node_vectors keyed by this memory's id (integration.embedding.store, vectorField='content'), mirroring v1:harness:observation and v1:common:documentChunk, so semantic memories are themselves similarTo-recall-able -- both for the recall path (#585) and for the dedup step of consolidation itself (before writing a new belief, similarTo against existing semanticMemory rows; reinforce the match instead of duplicating). Provenance is the killer feature: `sourceEpisodes` links every belief back to the episodic node ids that formed it, so a belief is always auditable. `confidence` rises on reinforcement and decays when a belief goes unreinforced; `lastReinforced` is the decay clock. ownerUserId is the per-row authz key (owned tier), stamped from actor.userId at create time; only the owner reaches their own beliefs.

| Field | Type | Required | Description |
|---|---|---|---|
| `confidence` | number | yes | How strongly the belief is held, in [0,1]. Rises on reinforcement (a later run distilled the same belief again -- the reinforce mutation takes the new value, computed engine-side, since the MemQL parser has no arithmetic) and decays when the belief goes unreinforced (the decay mutation takes the decayed value, computed engine-side, from lastReinforced age). Beliefs that decay below MEMQL_HARNESS_CONSOLIDATION_PRUNE_CONFIDENCE are pruned, keeping recall sharp. |
| `content` | string | yes | The natural-language statement of the belief -- the embedding source, so semantic memories are similarTo-recall-able. The consolidation + embedding loop stores this into node_vectors keyed by this memory's id (integration.embedding.store, vectorField='content'). Used by BOTH the recall path (#585) and consolidation's own dedup step (similarTo against existing beliefs before writing a new one). Mirrors the v1:harness:observation / v1:common:documentChunk content-as-embedding pattern -- the vector lives in node_vectors keyed by node id, not inline on the row. |
| `embedding` | array |  | The semantic embedding vector for `content`, populated lazily by the consolidation / embedding loop when an inline copy is wanted alongside the canonical node_vectors entry. Until set, dedup + recall read the node_vectors row keyed by this memory's id directly. Carried on the concept per the #586 sketch's @embedding field. |
| `kind` | string | yes | What flavor of belief this is. fact = a stable truth about the user / domain / world the agent learned ('the user's primary repo is memql'). preference = a stated or inferred preference ('the user prefers terse answers'). outcome = a learned result of trying something ('approach Y failed twice for task Z' / 'tool T reliably solves problem P'). Drives how the recall path (#585) weights and presents the belief. (enum: fact, preference, outcome) |
| `lastReinforced` | string | yes | When this belief was last created or reinforced -- the decay clock. The decay sweep measures age as now - lastReinforced; beliefs unreinforced past MEMQL_HARNESS_CONSOLIDATION_DECAY_DAYS lose confidence, and ones that fall below the prune floor are removed. Reset to now() on every reinforcement. |
| `ownerUserId` | string | yes | v1:identity:user.id of the belief owner. The per-row authz key (owned tier); stamped from actor.userId at create time. Consolidation runs per owner, so a belief only ever draws on -- and is only ever recall-able by -- its owner's own episodes. |
| `provenanceMutation` | string |  | Name of the mutation that produced this semanticMemory version (mutationCreateHarnessSemanticMemory / mutationReinforceHarnessSemanticMemory / mutationDecayHarnessSemanticMemory / mutationPruneHarnessSemanticMemory). Pairs with the engine-stamped createdBy intrinsic to name every transition in the audit trail. |
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
| `completedAt` | string |  | When the step reached a terminal status (done / failed). |
| `dependsOn` | array |  | v1:harness:step.id list of steps this step depends on -- the DAG in-edges. A step becomes ready once every id in dependsOn is done. Empty = no dependencies (immediately ready). |
| `errorMessage` | string |  | Populated when status transitions to failed. |
| `idempotencyKey` | string | yes | Stable key that dedupes re-runs of the same logical step. Makes step execution safe to retry / replay in the event-sourced loop (#583); a re-emit with the same key collapses onto the same logical step. |
| `input` | object |  | Per-step input payload, carried from the plan input + any prior step's result. |
| `ownerUserId` | string | yes | v1:identity:user.id of the step owner. The per-row authz key (owned tier); stamped from actor.userId at create time. Inherited from the parent plan's owner. |
| `planId` | string | yes | v1:harness:plan.id this step belongs to. Every step hangs off exactly one plan. |
| `provenanceMutation` | string |  | Name of the mutation that produced this step version (addStep / startStep / completeStep / failStep / ...). Pairs with the engine-stamped createdBy intrinsic to name every transition in the audit trail. |
| `result` | object |  | Per-step result, populated when status reaches done. |
| `startedAt` | string |  | When the step first transitioned to running. |
| `status` | string | yes | Step lifecycle. pending = created, dependencies not yet satisfied; ready = dependsOn satisfied, claimable by a controller; running = controller claimed and is executing; blocked = execution paused, needs another step to finish; done = result recorded (terminal); failed = error and attempts exhausted. Transitions are validated by the engine pre-insert guard; invalid ones (e.g. done -> running) are rejected. (enum: pending, ready, running, blocked, done, failed) |
| `title` | string | yes | Human-readable description of the unit of work. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:harness:plan`, `dependsOn` -> `v1:harness:step`, `interactsWith` -> `v1:agents:agent`

## `v1:identity:accessRequest`

Self-service access request placed on the waitlist queue. Created when an unknown email submits the registration form while IDENTITY_REGISTRATION_MODE=approval. Admins triage rows in the admin console: approval mints a v1:identity:invitation and emails a magic link; rejection stamps the reason and closes the row. Also auto-aged by the accessRequestExpirySweep cron once IDENTITY_ACCESS_REQUEST_EXPIRY_DAYS has elapsed without a decision. Global scope so admins in any partition (typically owners of the cluster) can review the queue.

| Field | Type | Required | Description |
|---|---|---|---|
| `additionalContext` | string |  | Free-text 'what would you use this for' answer the requester can optionally supply. Helps admins triage but never gates access by itself. |
| `email` | string | yes | Email address the requester wants to register with. Same value flows into the eventual v1:identity:user.primaryEmail on approval. |
| `invitationId` | string |  | Set on approval to the v1:identity:invitation row that was minted to deliver the magic link. Empty for pending / rejected / expired rows. |
| `name` | string |  | Display name supplied at submission time. Optional (some flows ask, some don't). |
| `reviewedAt` | string |  | Timestamp of the admin decision. Empty until reviewed. |
| `reviewedBy` | string |  | v1:identity:user.id of the admin who acted on the row. Empty until reviewed. |
| `reviewerNote` | string |  | Free-text rationale recorded by the admin. Required by UX convention for rejections; optional but encouraged for approvals. Stored verbatim for audit -- never edited. |
| `riskScore` | integer |  | Composite risk score (0-100) computed at submission time from riskSignals. Higher = more suspicious. Surfaced to admins in the queue so they can triage cleanly. Never auto-rejects; admins always make the call. |
| `riskSignals` | string |  | Comma-separated signal tags that fed riskScore. Examples: disposable_domain,velocity_per_ip,typo_squatted_domain,known_breach_email. Admin UI renders each tag as a chip with a tooltip. |
| `sourceIP` | string |  | IP the submission came from. Captured for audit and to feed velocity-per-IP risk signals. |
| `status` | string | yes | Lifecycle. pending = on the queue. approved = admin clicked approve and the invitation was minted. rejected = admin closed the row with reviewerNote. expired = aged out by accessRequestExpirySweep cron. (enum: pending, approved, rejected, expired) |
| `userAgent` | string |  | User-Agent header at submission. Captured for audit; bot-fingerprint heuristics may reference it. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:invitation`

## `v1:identity:accountEntitlement`

Per-account entitlement that caps the number of CONCURRENTLY-RUNNING tasks (Plans) a paying account may have across all of its spaces, sourced from the billing tier (epic memql#902 / foundation child #903). The cap is per paying account -- v1 keys on v1:identity:user.id (accountKind='user'); accountKind='org' is reserved for a future per-organization rollup where many users share one paying account's slots. DEFAULT = UNLIMITED (enterprise behavior): an account with no row here, an enterprise tier, or a non-positive maxConcurrentTasks is uncapped -- the admission controller (#904) is a no-op until a finite cap is written, so existing / unconfigured accounts behave exactly as today (no regression). The NUMBER (maxConcurrentTasks) is the source of truth so billing can change a tier's cap without a code change; tier is carried alongside purely for the Tasks-UX upgrade / limit messaging (#909) and the enterprise=unlimited shortcut. Global scope (lives in _system) so the planner node's admission controller and the billing / admin writer can both reach it from any partition. One logical row per account: mutationSetAccountEntitlement mints a deterministic id (accountEntitlement-<hash(accountId)>) so each set appends a new time-series version and the latest wins.

| Field | Type | Required | Description |
|---|---|---|---|
| `accountId` | string | yes | The paying account this entitlement applies to. v1: a v1:identity:user.id (accountKind='user'). The admission controller (#904) resolves a Plan's account via Plan.requestedBy and reads the effective cap from the matching row here. |
| `accountKind` | string | yes | Whether accountId names a user or an org. v1 is always 'user' (per-user account); 'org' is reserved for the future per-organization concurrency rollup where many users share one paying account's pool of slots. (enum: user, org) |
| `maxConcurrentTasks` | integer |  | The cap: the maximum number of Plans this account may have running concurrently across all of its spaces. SOURCE OF TRUTH for the number (billing writes it), so a tier's cap changes without a code change. A value <= 0 means UNLIMITED (the default). Ignored when tier='enterprise' (always unlimited). E.g. set to 5 to cap a pro account at five concurrent running tasks; the 6th and beyond wait for a freed slot (#905). |
| `note` | string |  | Free-text operator / billing note about why this entitlement was set (e.g. 'pro plan', 'temporary bump during migration'). Audit aid only; the resolver ignores it. |
| `tier` | string | yes | Billing tier label. Drives the Tasks-UX upgrade / limit messaging (#909) and the enterprise=unlimited shortcut. NOT the source of truth for the cap number -- maxConcurrentTasks is. Defaults to 'enterprise' so a default / unconfigured row stays uncapped. (enum: free, pro, team, enterprise) |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:identity:auditEvent`

Append-only audit log entry. Captures security-relevant events (auth, identity, authorization, configuration, admin) with actor + target + source attribution. Global scope so any cluster operator can read the full trail. Retention controlled by IDENTITY_AUDIT_LOG_RETENTION_DAYS via the daily auditEventRetentionSweep automation. The prevEventHash field is reserved for future hash-chain tamper-resistance; written but not validated in MVP.

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
| `codeHash` | string | yes | SHA-256 hex digest of the plaintext code. Primary lookup key in the token-exchange path -- avoids equality lookups on the plaintext. |
| `consumedAt` | string |  | Set atomically on the first successful /oauth/token redemption. Non-nil = the code is spent and any further redemption attempt is rejected and audited as code_replay. Single-use enforcement is the load-bearing security property of OAuth auth codes. |
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
| `firstAuthenticatedAt` | string |  | Set once on first issuance and never changed. Powers max-age enforcement (refresh fails if firstAuthenticatedAt + IDENTITY_SESSION_MAX_DAYS < now). |
| `identityId` | string |  | v1:identity:identity the session was minted from (typically the magic_link variant). Same caveat as userId. |
| `lastActivityAt` | string |  | Bumped opportunistically by the auth middleware. Useful for surfacing 'last seen' on each device. |
| `lastRefreshedAt` | string |  | Bumped on every successful refresh-token rotation. Powers idle-timeout enforcement (refresh fails if lastRefreshedAt + IDENTITY_SESSION_IDLE_DAYS < now). |
| `previousRefreshTokenHash` | string |  | SHA-256 hex digest of the IMMEDIATELY-PREVIOUS refresh token, kept valid for a short grace window after rotation. Handles the 'client hard-refreshed mid-rotation' case: the server completed the rotation and stored the new hash, but the browser aborted before receiving the Set-Cookie response, so the browser still holds the old token. Within the grace window (see previousRotatedAt) the rotator accepts presentation of this hash and re-issues a fresh pair. Outside the window the field is treated as expired bookkeeping. |
| `previousRotatedAt` | string |  | Wall-clock timestamp at which previousRefreshTokenHash was the current hash. Combined with the rotator's grace-window constant (~30s) to decide whether the previous hash is still acceptable. Past the window, presenting the previous hash returns 401 like any other stale token. |
| `refreshTokenHash` | string |  | SHA-256 hex digest of the current refresh token bound to this session. Rotated on every refresh. Used by the refresh handler to detect token theft (presenting a stale refresh = revoke entire session). |
| `revokedAt` | string |  | Set when the user revokes the session. Non-nil = middleware rejects the bearer token. |
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
| `accessRequestNotifyEmails` | string |  | Comma-separated list of operator addresses that get notified when a waitlist access-request is filed. Mirror of IDENTITY_ACCESS_REQUEST_NOTIFY_EMAILS. |
| `accessRequestNotifyThrottleMins` | integer |  | Throttle window in minutes for the access-request notify emails. High-risk requests bypass via immediate-notify. Mirror of IDENTITY_ACCESS_REQUEST_NOTIFY_THROTTLE_MINUTES. |
| `accessTokenTTLSeconds` | integer |  | Lifetime of issued access tokens in seconds. 0 means 'fall back to IDENTITY_ACCESS_TOKEN_TTL_SECONDS env, or the 900s built-in default'. Bounded at the admin form layer to [60, 86400] (1 minute to 24 hours). Read on every /oauth/token + /auth/refresh issuance so changes apply on the next access-token mint without an identity restart. |
| `authoredAutomationsEnabled` | boolean |  | Cluster-wide GLOBAL KILL SWITCH for planner-authored automations (epic memql#954, issue #961). true = activated authored bundles fire normally; false = the authored runtime is halted across the WHOLE cluster -- no authored automation fires on any node until re-enabled, regardless of any individual bundle's status or any per-user kill switch. The governance hard stop for the authored-automation surface. Single-row (id='cluster') so every node reads the same value; flipped via mutationSetAuthoredAutomationsEnabled and read by the authored scheduler's global gate. |
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
| `clusterDomain` | string |  | The deployment-wide hostname suffix the operator entered at /setup (or supplied via IDENTITY_BOOTSTRAP_DOMAIN). Examples: local.znas.io, staging.acme.com, acme.com. Every public service URL the cluster builds derives from it: app.<clusterDomain> for the SPA, identity.<clusterDomain> for sign-in, bff.<clusterDomain> for the API, agent.<clusterDomain> for worker registration. Empty before the wizard runs. |
| `internalDefaultRole` | string |  | Cluster-wide role granted to internal users on first login. (enum: owner, admin, writer, reader) |
| `internalDomains` | string |  | Comma-separated email-domain allowlist that flips the per-user 'internal' flag at first login. Internal users get the cluster-wide internalDefaultRole; external users get owner of an auto-created personal partition. |
| `invitationTTLDays` | integer |  | How long an admin-issued user invitation token stays valid, in days. 0 means 'fall back to IDENTITY_INVITATION_TTL_DAYS env, or the 7-day built-in default'. Bounded at the admin form layer to [1, 90]. |
| `magicLinkTTLSeconds` | integer |  | How long an issued magic-link is valid. 0 means 'fall back to IDENTITY_MAGIC_LINK_TTL_SECONDS env, or the 600s built-in default'. Bounded at the admin form layer to [60, 3600] (1 minute to 1 hour). Short by design -- magic-links are click-through credentials, not session tokens. |
| `refreshCookieSameSite` | string |  | SameSite policy for the refresh-token cookie. Empty = inherit from IDENTITY_REFRESH_COOKIE_SAMESITE env (which defaults to 'lax'). 'lax' is correct for the common same-site self-hosted topology (app.acme.com + identity.acme.com share an eTLD+1) and avoids Safari ITP scrutiny. 'none' is required for true cross-site deployments where the SPA and identity service live under different eTLD+1s (app.copresent.ai + auth.znasllc.io); browsers treat the cookie as third-party and apply ITP rules. The cookie is always Secure when BaseURL is HTTPS regardless of this setting. (enum: , lax, none) |
| `refreshTokenTTLSeconds` | integer |  | Absolute lifetime of refresh tokens in seconds. 0 means 'fall back to IDENTITY_REFRESH_TOKEN_TTL_SECONDS env, or the 30-day built-in default'. Bounded at the admin form layer to [86400, 31536000] (1 day to 1 year). Refresh rotation uses this for both the initial mint and the rotation-time max-age check; lowering it does NOT immediately invalidate live sessions but the next rotation that crosses the new ceiling will refuse. |
| `registeredClientsJSON` | string |  | JSON array of {clientId, redirectURIs} entries — the relying parties allowed to initiate the OAuth-style code flow. Stored as a string because the engine doesn't yet support nested arrays of objects in concept fields. Mirrors IDENTITY_REGISTERED_CLIENTS. |
| `registrationDomains` | string |  | Comma-separated allowlist used when registrationMode=domain_restricted. Mirror of IDENTITY_REGISTRATION_DOMAINS. |
| `registrationMode` | string | yes | Who can self-register. Mirror of IDENTITY_REGISTRATION_MODE. (enum: open, domain_restricted, invite_only, waitlist) |

## `v1:identity:delegation`

Grants an AI agent the right to act through a user's v1:identity:identity for a bounded role ceiling, scope set, and lifetime. Global scope: lives in _system and is readable from any partition so cross-partition agent work does not require per-partition delegation rows.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether this delegation is currently in effect. |
| `agentId` | string | yes | Node ID of the v1:agents:agent receiving delegated authority. |
| `approvedBySubject` | string |  | authenticated subject id of the guardian who approved (for synthetic identity delegations). |
| `createdBySubject` | string | yes | authenticated subject id of whoever authorized this delegation. |
| `expiresAt` | string |  | When this delegation expires. Null means persistent (no expiry). |
| `identityId` | string | yes | Node ID of the v1:identity:identity granting authority. Through its userId the delegation resolves back to a v1:identity:user. |
| `identitySubject` | string | yes | authenticated subject id of the delegating identity (denormalized for fast lookup on the auth hot path). |
| `identityType` | string | yes | Type of the delegating identity. Separate from v1:identity:identity.identityType (which classifies the credential family); this classifies the principal behind it. (enum: human, synthetic) |
| `note` | string |  | Human-readable note about why this delegation was created. |
| `revokedAt` | string |  | When this delegation was revoked. |
| `revokedBySubject` | string |  | authenticated subject id of whoever revoked this delegation. |
| `roleCeiling` | string | yes | Maximum role the agent may assume under this delegation. The engine caps the effective role at RoleAtMost(identity.role, roleCeiling). (enum: owner, admin, writer, reader) |
| `scopes` | array |  | Allowed operation scopes. Empty means all operations within the role ceiling. Examples: query:*, mutation:cognition.*. |

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
| `lastUsedAt` | string |  | Per-credential last-use stamp. Useful for pruning stale OAuth tokens or unused API keys. User-level 'last seen' lives on v1:identity:user.lastSeenAt. |
| `usableByAgents` | boolean |  | Whether v1:identity:delegation can borrow this identity for agent work. Magic-link identities default false (agents shouldn't impersonate humans wholesale); OAuth identities for specific external apps default true (they exist precisely so agents can act against that app on the user's behalf). |
| `userId` | string | yes | Owning v1:identity:user. Every identity must belong to exactly one user; a user can own many identities. |

## `v1:identity:invitation`

Token-hashed invitation credential. Maps an invitee (existing user by ID, or external guest by email + token) to an optional product scope hint. The identity layer owns the lifecycle (pending/accepted/expired/cancelled) and the auth primitive; product layers populate spaceId/spaceName and any display-name denormalizations they need. Global-scoped: an unauthenticated /join/<token> resolve has no envelope partition, and even authenticated invitees may live in a different partition than the inviter, so token -> invitation lookup must work without a partition context. Product-side rows that REFERENCE invitations (e.g. v1:copresent:participation) stay partition-scoped on the partition where the work actually happens.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether the invitation is active. Set false to soft-cancel. |
| `expiresAt` | string |  | Absolute expiration timestamp (guest kind only; null for user kind). |
| `inviteeEmail` | string |  | Email address of the invitee (guest kind). |
| `inviteeId` | string |  | User ID of the invitee (user kind). |
| `inviteeName` | string |  | Display name suggested by the inviter. Optional. |
| `inviterId` | string | yes | User ID of the person who issued the invitation. |
| `inviterName` | string |  | Display name of the inviter. Denormalized for notification/email rendering. |
| `kind` | string | yes | user = invite an existing user by ID. guest = invite an external email with a token. (enum: user, guest) |
| `previousTokenHash` | string |  | SHA-256 hex digest of the token this row carried before the most-recent resend rotation, when there was one. Used by the resolve handler to return a UX-friendly `superseded` status for an older link instead of a generic `invalid`. Carries only ONE generation of history -- the rotation before last drops off. Always empty before any resend has rotated the row. |
| `respondedAt` | string |  | When the invitation was responded to. |
| `spaceId` | string |  | Product scope hint. CoPresent populates this with a v1:cognition:space ID so the post-accept flow can route the invitee into the right space. |
| `spaceName` | string |  | Display name of the scope. Denormalized for email rendering. Optional. |
| `status` | string | yes | Lifecycle status. Product layers extend with participation-style values (left/kicked/dismissed) when they bind the invitation to a product record. (enum: pending, accepted, ignored, left, kicked, dismissed) |
| `tokenHash` | string |  | SHA-256 hex digest of the current guest invite token (guest kind only). Primary lookup key in the guest-auth interceptor and on the /join/<token> resolve path. The plaintext token is delivered in the email and never persisted server-side (see memql#108). |

**Relationships:** `parent` -> `v1:cognition:space`, `parent` -> `v1:identity:user`, `parent` -> `v1:identity:user`

## `v1:identity:magicLinkRequest`

Pending magic-link authentication request. One row per /auth/magic-link issuance. The plain token is hashed (SHA-256) before persistence -- only the hash lives here so a database snapshot can never be replayed into a login. Single-use semantics: consumedAt is set atomically on the first successful click and any subsequent click against the same row is rejected. Past expiresAt the row is also rejected. Global scope so the public unauthenticated /auth/magic-link/consume endpoint can resolve the row regardless of which partition the eventual user belongs to.

| Field | Type | Required | Description |
|---|---|---|---|
| `consumedAt` | string |  | Set atomically on the first successful consume. Non-nil = the row is spent and any further click against the same token is rejected. Single-use enforcement is the load-bearing security property of magic links. |
| `consumedFromIP` | string |  | Best-effort IP recorded at consume time. Used by the audit log and by anomaly detection (consume from a different country than issuance, etc). |
| `email` | string | yes | Email address the magic link was sent to. Drives the user-lookup / first-time-registration path on consume. |
| `expiresAt` | string | yes | Absolute expiration timestamp. Past this point the row is dead even if not consumed; the consume handler treats expired and consumed identically (both reject). |
| `invitationId` | string |  | Set when the magic link was issued in response to an admin-approved access-request invitation. Empty for self-service login attempts. Lets the consume handler stamp the inviting context on the new user record. |
| `oauthCtxJSON` | string |  | Serialized JSON of the OAuth context the magic link was issued under: {clientId, redirectURI, state}. When present the consume handler mints an auth code instead of a session and redirects to clientId's redirectURI with the code. When absent the consume creates a session directly (first-party SPA flow). |
| `sourceIP` | string |  | IP the issuance request came from. Captured for audit and for risk scoring (issuance velocity per IP). |
| `tokenHash` | string | yes | SHA-256 hex digest of the plain magic-link token. Primary lookup key on consume; the plaintext token is delivered in the email link and never stored server-side. |
| `userAgent` | string |  | User-Agent header at issuance time. Captured for audit and for the consume-time UA-mismatch check (loose; a different browser is allowed). |

**Relationships:** `parent` -> `v1:identity:invitation`

## `v1:identity:user`

A person (or synthetic principal). Owns identities. Same record cluster-wide.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Whether the user account is active. |
| `activeSpaceId` | string |  | v1:cognition:space.id this user is currently active in (Phase 4 of the chat-architecture plan). Hard rule: each human is active in at most one space at a time -- camera, mic, voice transport, video presence are all bound to this pointer. Empty / unset means the user is in the app but not focused on any space (or has the app closed). Set by mutationSetUserActiveSpace from the SPA's set-active-on-enter wiring; the participant guard derives `isActive` for downstream consumers by comparing this against the participant's spaceId. Discussion mode (Phase 6) and voice migration (Phase 7) both key on this field. |
| `birthdate` | string |  | ISO-8601 date (YYYY-MM-DD), optional. Stored as a string rather than datetime because we never compute against it -- it's reference data the admin sets and the profile UI surfaces. |
| `dataExportLastAt` | string |  | Timestamp of the most recent /me/export download. Drives rate-limiting per IDENTITY_DATA_EXPORT_RATE_LIMIT_HOURS. |
| `deletionScheduledAt` | string |  | Set when the user requested account deletion. The accountDeletionSweep cron hard-deletes the row IDENTITY_DELETION_COOLDOWN_DAYS later. Cleared by mutationCancelScheduledDeletion if the user reverses the request during the cooldown. |
| `displayName` | string | yes | Display name shown in the UI. By convention this is firstName + ' ' + lastName when both are populated; the admin / setup wizard maintain that invariant. Standalone field (rather than a derived computed view) because legacy rows pre-date the firstName/lastName split and we want a stable display value to fall back on. |
| `firstName` | string |  | Given name. Set by the admin via /admin/users/detail (or by the cluster owner via /setup); flows through to the JWT as the OIDC-style `given_name` claim and into CoPresent's profile UI. |
| `gender` | string |  | Optional self-identified gender. Free-form string -- the frontend offers a curated list but the backend doesn't enforce one. |
| `groupIds` | array |  | Group memberships. Reserved for future cluster-side group-based partition-access derivation. |
| `internal` | boolean |  | True when the registering email matched IDENTITY_INTERNAL_DOMAINS at first login. Internal users get the cluster-wide IDENTITY_INTERNAL_DEFAULT_ROLE; external users instead get owner of an auto-created personal partition. Captured at registration so policy decisions remain stable even if the configuration drifts. |
| `lastName` | string |  | Family name. Mirror of firstName -- admin-curated, stamped onto the JWT as `family_name`. |
| `lastSeenAt` | string |  | Updated by the identity service on each successful refresh. Answers 'when was this person last around'. Per-credential last-use lives on v1:identity:identity.lastUsedAt. |
| `legalAcceptance` | array |  | Append-only history of legal-document acceptances. Each entry: {documentType: 'tos'\|'privacy', version: string, acceptedAt: datetime, sourceIP: string}. Audit trail for compliance -- never edited, only appended. |
| `phone` | string |  | E.164 phone number, optional. Set by an admin via /admin/users/detail; required for full app access via the ProfileCompletenessGuard. |
| `preferences` | object |  |  |
| `primaryEmail` | string | yes | Canonical email. Verified by the magic-link flow at registration; the dedup key for 'is this Alice already known?'. |
| `primaryRole` | string |  | Free-form job title / role at the org (e.g. 'CEO', 'Engineer'). Distinct from the cluster-wide auth `role` field above; admin-curated, not auth-related. |
| `revocationEpoch` | integer |  | Monotonically-increasing per-user counter. Stamped into every JWT this user is issued; the verifier rejects any JWT whose revocation_epoch claim is below the user's current value. Bumping this field invalidates every token issued before the bump, on the next stream-open or periodic in-stream re-check (default ~5 minutes). Bulk-revoke / role-change / security-event tooling is the intended writer. See memql#106. |
| `role` | string |  | Cluster-wide role. owner bypasses the partition ACL; admin sees all partitions but still needs a per-partition grant to mutate data; writer and reader need an explicit grant for every partition they operate in. (enum: owner, admin, writer, reader) |
| `suspendedAt` | string |  | Set when the user is suspended by an admin. Nil means active. |
| `suspendedReason` | string |  | Human-readable reason for suspension. |

## `v1:identity:workerPairingCode`

Short-lived pairing credential for the computer-use enrollment flow. CoPresent's Settings -> Computer Use 'Connect this computer' card mints a row + plain code (XXXX-XXXX, 8 alphanumeric chars from Crockford's Base32 alphabet). The cockpit wizard on the user's machine redeems the code on the cluster's gRPC stream via Authorization: Pair <code>, the redeem handler stamps redeemedAt + redeemedBy, mints a v1:identity:identity worker_token row owned by the same user, and returns the plain mql_wkr_<...> token + cluster URL to the cockpit. Single-use: a row with non-empty redeemedAt is dead. TTL ~10 minutes (IDENTITY_PAIRING_CODE_TTL_MIN, default 10).

| Field | Type | Required | Description |
|---|---|---|---|
| `clusterURL` | string | yes | Canonical cluster URL the cockpit should dial for the WorkerService.Stream. Stamped at create time so the redeem handler can echo it back -- letting CoPresent and the BFF be reachable at different DNS names without leaking that detail to the cockpit operator. |
| `codeHash` | string | yes | SHA-256 hex digest of the plain XXXX-XXXX code. Plaintext is shown to the user ONCE on the CoPresent Settings card and never persisted. |
| `expiresAt` | string | yes | Absolute expiration timestamp. Redeem rejects rows past this even when redeemedAt is empty. |
| `ownerUserId` | string | yes | v1:identity:user.id who minted the code (and who will own the resulting worker_token + v1:worker:registration). The redeem handler reads this and uses it as the registeredBy for the new worker_token credential. |
| `redeemedAt` | string |  | Stamped on first successful redeem. Single-use semantics: any subsequent redeem against the same row fails with already_redeemed. |
| `redeemedBy` | string |  | v1:identity:identity.id of the worker_token row the redeem minted, for audit trail. Empty until redeemed. |
| `redeemedFromIP` | string |  | Source IP the redeem call came from. Audit signal -- helps detect 'someone else redeemed my code' fraud. |
| `sourceIP` | string |  | IP the create-pairing-code request came from. Audit + abuse signal. |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:identity`

## `v1:knowledge:document`

A user-uploaded file (or chat-promoted segment) that's been analyzed and structured into queryable items. Container concept that owns metadata + back-references; the actual structured content lives in per-format item concepts (v1:knowledge:spreadsheetRow for tabular, v1:knowledge:imageRegion for visual, v1:common:documentChunk for text-style breakdowns of PDFs / markdown / plain text). Per the v1 brainstorm Q8 hybrid model: one Document container query gives the Knowledge page its listing, typed per-format item queries give analytic surfaces (e.g. spreadsheet row column-filters) without JSON-path indirection.

| Field | Type | Required | Description |
|---|---|---|---|
| `attachedDomains` | array |  | Knowledge domain ids the user has attached this Document to. Items propagate to those domains for retrieval. |
| `attachmentId` | string | yes | Back-reference to v1:common:attachment. The bytes live in GCS via the attachment row; this Document carries the analyzed projection. |
| `domainHints` | array |  | Knowledge domain ids the analyzer thinks this Document belongs to. Used to seed the attach-to-domain picker on the validation card. |
| `embeddedItemCount` | integer |  | Count of items that have been embedded. itemCount - embeddedItemCount = remaining work for the embedDomainItems Plan. |
| `embeddingStatus` | string | yes | Whether typed items in this Document have been lazily embedded into documentChunk for semantic retrieval (Q14). Bumps to 'complete' after the embedDomainItems Plan finishes. (enum: none, partial, complete) |
| `fileName` | string | yes | Original filename, copied from the attachment for display. |
| `format` | string | yes | High-level classification. Picks which item concept stores the breakdown: spreadsheet -> spreadsheetRow; pdf\|text\|markdown -> documentChunk; image -> imageRegion; conversation -> documentChunk (for chat-promoted segments). (enum: spreadsheet, pdf, image, text, markdown, conversation) |
| `itemCount` | integer |  | Total items extracted (spreadsheet rows / PDF sections / image regions / text chunks). For very large documents the analyzer may set this to the row total even when only a sample has been materialized; see Q8's two-pass scale safeguard. |
| `itemKind` | string |  | Which item concept this Document's per-row / per-section / per-region payloads land in. Set by the analyzer after extraction. (enum: spreadsheetRow, documentChunk, imageRegion) |
| `mimeType` | string | yes | MIME type, copied from the attachment. |
| `planId` | string | yes | Back-reference to the v1:planner:plan that produced this analysis. Used by the Tasks page expand-drawer + by re-analysis triggers. |
| `spaceId` | string | yes | Workspace partition this Document belongs to; redundant with attachment.spaceId but stored explicitly for cheap per-space queries. |
| `summary` | string |  | LLM-generated 2-3 sentence summary of the Document. Surfaced on the plan.completed card body and on the Knowledge page detail view. |
| `supersededAt` | string |  | When this Document transitioned to superseded. |
| `supersededByDocumentId` | string |  | Set on this Document when it's been superseded by a newer version. Points to the successor Document. Agents skip superseded Documents during retrieval. |
| `supersedesDocumentId` | string |  | Set at upload time when the user picked 'Replace' on the supersession prompt. Points to the predecessor Document; cascadeSupersessionOnValidation flips that predecessor to 'superseded' when this Document is validated. |
| `uploadedBy` | string | yes | v1:identity:user.id of the uploader. Owner-only operations (delete, re-validate, attach) check against this. |
| `validatedAt` | string |  | When validation last transitioned. Refreshed on rollup recompute. |
| `validatedBy` | string |  | v1:identity:user.id who clicked Validate on the Document card. Null when unvalidated / system-validated. |
| `validationStatus` | string | yes | Document-level validation rollup. Per-item validation can override individual items; computed by cascadeDocumentValidationRollup. validated = ingestible into knowledge domains; rejected = soft-deleted; partiallyValidated = some items validated, some not; superseded = a newer Document replaced this one. (enum: unvalidated, validated, rejected, partiallyValidated, superseded) |

**Relationships:** `parent` -> `v1:common:attachment`, `parent` -> `v1:planner:plan`

## `v1:knowledge:domainEntitySchema`

Per-knowledge-domain entity schema declaration. Specifies what 'an entity' looks like in a domain (entityKind), which fields uniquely identify it (keyFields), and which fields are descriptive (displayFields). Powers cross-file dedup (Q17): when a Document is attached to a domain, the analyzer hashes each item's key field values and looks up the entityIndex to detect duplicates. Per Q17 Option D: the schema is INFERRED by an entity-inference Plan triggered on the SECOND validated Document into a domain (the first Document seeds the inference); the user confirms the proposal once and the schema locks in. Subsequent Documents use it for dedup automatically.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-delete flag. Schema changes after lock-in trigger a re-index of historical items; setting active=false skips dedup entirely for the domain. |
| `confirmedAt` | string |  | When the user confirmed the schema. |
| `confirmedBy` | string |  | v1:identity:user.id who confirmed the proposed schema. Set when the user clicks Confirm on the domain-setup card. |
| `displayFields` | array |  | Optional descriptive fields for UI surfaces (entity preview, side-by-side diff). Not used for dedup. |
| `domainId` | string | yes | v1:common:knowledgeDomain.id this schema describes. |
| `entityKind` | string | yes | Human-readable entity type name, e.g. 'Employee', 'Customer', 'Project'. A domain can hold multiple entity kinds (HR Records: Employee + Department + Role); each gets its own schema row. |
| `inferredFromDocumentId` | string |  | Provenance: which Document seeded the inference. Audit-only. |
| `inferredFromTaskId` | string |  | Provenance: which entity-inference Plan ran the inference. |
| `keyFields` | array | yes | Field names whose values combine into the entity's unique key. Hashed via sha256 to produce entityIndex.keyHash. Examples: ['email', 'employee_id'] for Employee. |

**Relationships:** `parent` -> `v1:common:knowledgeDomain`

## `v1:knowledge:entityIndex`

The cross-file dedup lookup table. One row per validated entity in a domain (per entityKind), keyed by sha256(normalized key field values). Populated when an item is validated as 'new'; queried during analysis-time / attach-time dedup to detect when an incoming row matches an existing canonical entity. Per Q17/Q26: this is the load-bearing piece of cross-file dedup; without it the HR example ('all of these employees already exist') is unfulfillable.

| Field | Type | Required | Description |
|---|---|---|---|
| `dedupOverrideNote` | string |  | Optional note from the user explaining why a force-added entry is genuinely a separate entity ('two different people share an email used as a key field, separate them'). |
| `domainId` | string | yes | v1:common:knowledgeDomain.id this entity belongs to. |
| `entityKind` | string | yes | Matches v1:knowledge:domainEntitySchema.entityKind. Lets a single domain hold multiple entity kinds without their indexes colliding. |
| `forceAdded` | boolean |  | Set true when the user picked 'Add anyway (force)' on the dedup card despite a key-hash collision. Future dedup checks against the same hash surface ALL force-added entries side by side and let the user pick. |
| `keyHash` | string | yes | sha256 of normalized key field values (DomainEntitySchema.keyFields[].toLower().trim() joined by ':'). The dedup lookup primary key. Two indexes with the same (domainId, entityKind, keyHash) are conceptually the same entity. |
| `sourceDocumentId` | string | yes | The Document that contributed this entity. When the source Document is rejected / superseded the corresponding index entry should be cleaned up. |
| `sourceItemId` | string | yes | Specific item (SpreadsheetRow / documentChunk / ImageRegion id) that contributed this entity. |
| `validatedAt` | string | yes | When the user validated the source item, marking the entity canonical. |

## `v1:knowledge:imageRegion`

One detected region inside an image Document. Carries a bounding box, a vision-model-generated caption, and (lazily) a visual embedding. Per Q8: images get their own typed concept because bbox + caption + embedding doesn't fit the text-as-content shape of v1:common:documentChunk.

| Field | Type | Required | Description |
|---|---|---|---|
| `bbox` | object | yes | Bounding box: {x: int, y: int, width: int, height: int} in source-image pixel coordinates. Whole-image is the image's own dimensions. |
| `caption` | string | yes | Vision-model-generated description of what's in this region. Used as the embedding text for semantic retrieval -- 'find image regions about quarterly revenue charts' embeds the caption, not the pixels. |
| `dedupStatus` | string | yes | Same dedup model as SpreadsheetRow; v0.x rarely populates non-na for images since images don't usually have entity schemas, but the field is here for symmetry. (enum: new, duplicate, update, na) |
| `documentId` | string | yes | Back-reference to the parent v1:knowledge:document (format='image'). |
| `domainHints` | array |  | Knowledge domain ids the analyzer thinks this region belongs to. |
| `embeddedAsChunkId` | string |  | Once lazy-embedded into v1:common:documentChunk (caption text), this points to the chunk id. |
| `matchesEntityIndexId` | string |  |  |
| `regionSeq` | integer | yes | 0-based region index. Whole-image regions get seq 0; sub-regions follow. |
| `validatedAt` | string |  |  |
| `validatedBy` | string |  | Validator user id. |
| `validationStatus` | string | yes | Per-region validation, same model as SpreadsheetRow. (enum: unvalidated, validated, rejected) |

**Relationships:** `parent` -> `v1:knowledge:document`

## `v1:knowledge:liveConnector`

Defines a backing data source for one or more v1:knowledge:liveSource rows. A connector is the adapter to a particular kind of upstream: memql concepts (internal), postgres / mysql / mssql (SQL DBs), REST APIs, GraphQL endpoints, custom plug-ins. The engine ships built-in connectors for memql + postgres + REST; new kinds register via the plug-in system. Auth lives in v1:platform:partitionSecret rows referenced by name -- the connector row itself carries only the secret reference, not the secret value.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-disable flag. |
| `authSecretName` | string |  | Name of the v1:platform:partitionSecret (or globalSecret) row that carries the credential. Resolved at dispatch time so rotating credentials never requires editing the connector row. |
| `description` | string |  | Operator-facing notes; rarely read by agents directly. |
| `endpoint` | string |  | Connector-kind-specific endpoint. SQL kinds: hostname:port/db. rest/graphql: base URL. memql: empty (always local). |
| `kind` | string | yes | Connector implementation to dispatch to. 'memql' reads against the engine itself (concept query). 'custom' = a plug-in-registered handler matching the connector by name. (enum: memql, postgres, mysql, mssql, rest, graphql, custom) |
| `name` | string | yes | Human + agent-readable identifier, e.g. 'erp.postgres' or 'salesforce.rest'. |
| `ownerId` | string |  | v1:identity:user.id of the creator. Required for scope='private'. |
| `scope` | string |  | Mirrors liveSource.scope. (enum: workspace, private) |

## `v1:knowledge:liveSnapshot`

Cached result of a v1:knowledge:liveSource read with a particular set of args. Keyed by (liveSourceId, queryArgsHash) -- a fresh hash collision-free read is materialized once and reused until expiresAt. Per Q8 cachePolicy='bounded_stale'. Tasks-page snapshots can be cited by the agent via the citation envelope's snapshotId so the frontend can render 'fetched X seconds ago' provenance. Optional concept for v1 -- the fetch path can be wired without it and snapshot reuse added in a follow-up.

| Field | Type | Required | Description |
|---|---|---|---|
| `citationLabel` | string |  | Human-readable label the agent can use when citing this snapshot ('inventory snapshot @ 12s ago'). Computed at materialize time so citation rendering doesn't have to recompute. |
| `expiresAt` | string | yes | When this snapshot becomes stale per the source's refreshSeconds. Reads after this auto-refetch. |
| `liveSourceId` | string | yes | v1:knowledge:liveSource.id this snapshot is for. |
| `materializedAt` | string | yes | When the connector dispatch completed. |
| `queryArgs` | object |  | The args that produced this snapshot, preserved for debugging / cache-invalidation tools. Not used for lookup -- queryArgsHash is the indexed lookup key. |
| `queryArgsHash` | string | yes | Stable hash of the args map (sorted-keys JSON sha256, 64 hex chars). Lookup key: (liveSourceId, queryArgsHash). |
| `result` | object | yes | The materialized result. Shape matches the source's resultSchema. |

**Relationships:** `parent` -> `v1:knowledge:liveSource`

## `v1:knowledge:liveSource`

A named query against a volatile data source. The 'live knowledge' counterpart to v1:common:knowledgeDomain: where a knowledge domain holds pre-embedded chunks that change rarely, a liveSource is a current-state read against an underlying connector (inventory, employees, calendar, tickets, etc.). Agents bind to liveSources via capabilities.liveSources[]; the prompt-context builder pulls fresh results into the system_knowledge block between Tasks. Results carry citations back to the originating liveSourceId + snapshot id so the frontend can render 'fetched 12 seconds ago from inventory' provenance.

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | Soft-disable flag. When false, agents bound to this source get an empty result on read (no connector dispatch). Lets the user pause a source without breaking bound agents. |
| `argsSchema` | object |  | JSON-schema for the args accepted by this source. The Planner Agent uses this to know what to pass; missing/extra args reject at dispatch time. |
| `cachePolicy` | string |  | Caching behavior. always_fresh = every read hits the connector; no snapshot reuse. bounded_stale = reuse a snapshot if it's younger than refreshSeconds; otherwise refetch and snapshot. never = no snapshot is ever materialized (best for ephemeral data where staleness is worse than the connector hit). (enum: always_fresh, bounded_stale, never) |
| `connectorId` | string | yes | v1:knowledge:liveConnector.id this source rides on. One connector backs many sources. |
| `description` | string | yes | One-line description of what the source returns. The Planner Agent reads this when deciding whether the source is relevant to the next Task's needs. |
| `name` | string | yes | Human + agent-readable identifier, e.g. 'inventory.skuLevels' or 'employees.directory'. Agents discover available liveSources via this name; the Planner Agent's prompt lists which names are bound to which specialists. |
| `ownerId` | string |  | v1:identity:user.id of the creator. Required for scope='private'. |
| `queryTemplate` | string | yes | Connector-specific query template. For memql connector: a MemQL query string with {args.x} placeholders. For postgres connector: SQL with $1/$2 positional params. For rest connector: a URL + body template. The connector implementation interprets this; the engine doesn't parse it directly. |
| `refreshSeconds` | integer |  | TTL on snapshots for cachePolicy='bounded_stale'. Snapshots older than this are refetched on next read. Ignored for the other cachePolicy values. |
| `resultSchema` | object |  | JSON-schema for the response shape. Used by adapters that lift the result into the agent's prompt-context block. |
| `scope` | string |  | Mirrors knowledgeDomain.scope. 'workspace' = anyone in the partition can bind an agent to this source; 'private' = only ownerId can. (enum: workspace, private) |

## `v1:knowledge:spreadsheetRow`

One row extracted from a spreadsheet Document. Typed (not polymorphic-via-data) so analytic queries can filter on data.<columnName>=<value> as native column predicates rather than JSON-path indirection. Per the v1 brainstorm Q8: text-style breakdowns reuse v1:common:documentChunk; spreadsheet rows and image regions get their own concepts because their structure can't fit a free-text chunk shape.

| Field | Type | Required | Description |
|---|---|---|---|
| `data` | object | yes | Column-name -> value map. The Document.metadata.columnSchema (set by the analyzer at extraction time) is the authoritative column list; rows whose data omits a known column carry the column with value null. |
| `dedupStatus` | string | yes | Set during attach-time dedup against the target domain's entityIndex (Q17/Q26). new = no key match; duplicate = key match + all values identical; update = key match + values differ; na = no entity schema applies. (enum: new, duplicate, update, na) |
| `diffFromMatched` | object |  | For dedupStatus='update': map of column-name -> {old, new} for fields that differ from the matched entity. Drives the side-by-side diff view. |
| `documentId` | string | yes | Back-reference to the parent v1:knowledge:document. |
| `domainHints` | array |  | Knowledge domain ids the analyzer thinks this row belongs to. Used by attach-time dedup + filtering on the per-item drawer. |
| `embeddedAsChunkId` | string |  | Once lazy-embedded into v1:common:documentChunk for semantic retrieval, this points to the embedded chunk's id. Lets retrieval avoid double-counting structured + embedded representations of the same row. |
| `matchesEntityIndexId` | string |  | Set when dedupStatus in (duplicate, update); points to the v1:knowledge:entityIndex row this row matches. Lets the per-item drawer side-by-side the existing entry vs the incoming one for review. |
| `rowSeq` | integer | yes | 0-based row index within the source spreadsheet, header excluded. |
| `validatedAt` | string |  | Per-row validation timestamp. |
| `validatedBy` | string |  | v1:identity:user.id who validated/rejected this specific row. |
| `validationStatus` | string | yes | Per-row validation. Defaults to inheriting the Document's status via cascadeValidationToItems; user can override per-row in the per-item drawer (Q15 hybrid granularity). (enum: unvalidated, validated, rejected) |

**Relationships:** `parent` -> `v1:knowledge:document`

## `v1:knowledge:validationEvent`

Append-only audit log for every validation status transition on any data-bearing concept (Document, SpreadsheetRow, ImageRegion, documentChunk). Powers the validation history view on Document detail and gives auditing the provenance trail it needs ('who validated this row two months ago when we were ramping up; do they still vouch for it'). Per Q15: denormalized validationStatus on the data concept gives fast queries; this event log gives history. Two writes per validation action; cheap.

| Field | Type | Required | Description |
|---|---|---|---|
| `actorUserId` | string |  | v1:identity:user.id who triggered the transition. Null for system-driven cascades (e.g. supersession purge). |
| `fromStatus` | string | yes | Previous validationStatus value. |
| `note` | string |  | Optional freeform note from the user (e.g. why they rejected an item). Surfaced in the audit history view. |
| `reason` | string | yes | Why the transition fired. user = explicit click in the UI; cascade = parent Document validation propagated; supersession = a newer Document took over; rollup = item changes recomputed the Document rollup; system = automation or admin-driven. (enum: user, cascade, supersession, rollup, system) |
| `targetConceptType` | string | yes | Fully-qualified target concept name, e.g. 'v1:knowledge:document' or 'v1:knowledge:spreadsheetRow'. Lets the audit query distinguish per-Document validations from per-row. |
| `targetId` | string | yes | Id of the row that transitioned. Pair with targetConceptType to dereference. |
| `toStatus` | string | yes | New validationStatus value. |

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
| `producedByPlanId` | string |  | v1:planner:plan.id that produced this item, when it came from a plan (documents carry document.planId; generated outputs carry the producing plan). Provenance back-pointer surfaced in the detail view. |
| `producedByWorkerId` | string |  | v1:worker:registration.id of the worker MACHINE that produced this item, when source=computer_use. Lets the Library say WHICH of the user's registered computers a computer-use file came from, and detect when it is the machine the user is currently on. Empty for workbench / agent / uploaded items. |
| `producedByWorkerName` | string |  | Human-readable name of the producing worker machine (e.g. 'MacBook-Pro'), copied from the worker registration at index time so the Library can label 'Computer use - <machine>' without a join. Empty unless producedByWorkerId is set. |
| `scope` | string |  | Shared-vs-private visibility tier, mirrored from the backing source's own scope (currently only v1:knowledge:liveSource carries one). 'workspace' = a partition-shared row with NO single owner (ownerUserId is empty); it is invisible to the owned reads and surfaces instead through the non-owned queryLibraryWorkspaceLiveSources path so every partition member sees it. 'private' = owner-scoped like everything else (gated by ownerUserId==actor.userId). Null for the ordinary owned rows (documents / notes / to-dos / memories) that have no shared tier. (enum: workspace, private) |
| `source` | string | yes | Provenance -- WHERE this item came from. uploaded = user-provided file; workbench_generated = produced in a v1:workbench:workspace container; computer_use = produced at the computer-use level; agent_generated = emitted by an agent as a standalone deliverable; derived = computed from another artifact; live = a current-state read against a live source (paired with live==true). Rendered as the per-row source label in the Library list. (enum: uploaded, workbench_generated, computer_use, agent_generated, derived, live) |
| `sourceConceptRef` | string | yes | Fully-qualified reference to the backing row, e.g. 'v1:knowledge:document:<id>', 'v1:notes:note:<id>', 'v1:knowledge:liveSource:<id>'. The Library drill-in resolves content + children (document->documentChunk, liveSource->liveSnapshot) through this ref. Also the idempotency key for the write-path (one index row per source ref). |
| `spaceId` | string |  | v1:cognition:space.id this item belongs to, when space-scoped (documents, generated outputs). Empty for user-global records (notes / to-dos / memories). Backs the per-space facet filter. |
| `summary` | string |  | Optional short summary / description for the list row. From document.summary, liveSource.description, etc. when available. |
| `title` | string | yes | Display title for the list row. Copied from the backing concept at index time (document.fileName, note.title, liveSource.name, etc.). |
| `updatedAt` | string |  | RFC3339 watermark of the most recent change to the backing item, stamped on every index write. The default Library sort key (most-recent first). |
| `validationStatus` | string |  | Validation rollup for document-backed artifacts, mirrored from v1:knowledge:document.validationStatus so the Library can facet on it without a join. 'none' for items that have no validation lifecycle (records, generated outputs). (enum: none, unvalidated, validated, rejected, partiallyValidated, superseded) |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:library:generatedOutput`

A deliverable PRODUCED through the app (as opposed to an uploaded document): a workbench result, a computer-use output, or a standalone agent output. Carries either inline text (body) or a reference to file bytes (attachmentId -> v1:common:attachment). Auto-promoted into the Library by logicIndexGeneratedOutput on creation. Per-row authz: owned -- ownerUserId is the producing user; reads gate on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `attachmentId` | string |  | Back-reference to v1:common:attachment when the output is file-backed (a generated .docx / .pdf / .xlsx). The bytes live on the attachment row in GCS; this concept carries the metadata projection. |
| `body` | string |  | Inline text content for text-style outputs (markdown / plain text) produced directly without a file. File-backed outputs leave this empty and carry bytes on the attachment. |
| `format` | string | yes | Content classification -- picks the Library viewer. Mirrors the artifact.format vocabulary. (enum: markdown, document, pdf, spreadsheet, image, text, other) |
| `mimeType` | string |  | MIME type of the backing bytes when attachment-backed. |
| `ownerUserId` | string | yes | v1:identity:user.id this output belongs to (the user the producing agent / plan acts for). The per-row authz key for Library reads. |
| `producedByAgentId` | string |  | v1:agents:agent.id that produced this output, when an agent emitted it. |
| `producedByPlanId` | string |  | v1:planner:plan.id that produced this output, when it came from a plan. |
| `producedByWorkerId` | string |  | v1:worker:registration.id of the worker MACHINE that produced this output, when source=computer_use. Empty otherwise. Copied onto the artifact index row. |
| `producedByWorkerName` | string |  | Human-readable name of the producing worker machine, copied from the worker registration at production time. Empty unless producedByWorkerId is set. |
| `source` | string | yes | Provenance -- where the output was produced. Copied onto the artifact index row's source field. (enum: workbench_generated, computer_use, agent_generated, derived) |
| `spaceId` | string |  | v1:cognition:space.id this output was produced in, when space-scoped. |
| `summary` | string |  | Optional short description / preview of the output. |
| `title` | string | yes | Display title for the output, e.g. 'Ten most beautiful birds'. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:library:memory`

A durable memory the assistant retains about the user across sessions (a fact, preference, standing instruction, or episodic recollection). The user-facing LLM-memory concept; surfaced in the Library's Records lens. Per-row authz: owned -- ownerUserId stamped from actor.userId; reads gate on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | v1:agents:agent.id that formed / owns this memory, when agent-scoped. Empty for user-global memories. |
| `content` | string | yes | The memory text itself -- what the assistant should recall. |
| `kind` | string | yes | Memory flavor. fact = stable truth about the user; preference = how they like things done; instruction = a standing directive; episodic = a specific past interaction worth recalling. (enum: fact, preference, instruction, episodic, other) |
| `ownerUserId` | string | yes | v1:identity:user.id this memory is about / belongs to. Stamped from actor.userId at create time. The per-row authz key. |
| `sourceUtteranceId` | string |  | Optional back-reference to the v1:cognition:utterance that produced this memory -- provenance for 'where did the assistant learn this'. |
| `spaceId` | string |  | v1:cognition:space.id this memory was formed in, when space-scoped. |
| `summary` | string |  | Optional one-line summary for dense list rendering. |
| `title` | string | yes | Short label for the memory, e.g. 'Prefers concise replies'. The primary display line. |

**Relationships:** `parent` -> `v1:identity:user`

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

A user-owned standalone note: an optional title, a body, and tags, plus an updatedAt watermark. The standalone notebook concept -- distinct from copresent's canvasState.note caption field. Per-row authz: owned -- ownerUserId is stamped from actor.userId on every write and every read gates on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `body` | string | yes | The note's freeform text content. The substring search operation matches against this field. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this note. Stamped from actor.userId at create time; re-stamped from actor.userId on every update so ownership can never be reassigned by a caller. The load-bearing per-row authz key. |
| `tags` | array |  | Optional list of user-supplied tags for grouping / filtering. The frontend renders these as chips; the search tool can narrow by a single tag. |
| `title` | string |  | Optional short title / heading for the note. Absence is allowed -- a note can be body-only. The primary display field when present. |
| `updatedAt` | string |  | RFC3339 watermark of the most recent edit. Stamped to `now` on every create / update so the frontend can sort by recency. The authoritative version order is still the row's createdAt history; this is a denormalized convenience for the most-recent version. |

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
| `expiresAt` | string |  | Optional automatic-off timestamp. The codeProfileExpiry cron flips level back to 'off' when now > expiresAt. Lets the cockpit say 'bump to verbose for the next hour' without leaking a hot-path tap into the steady state. |
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
| `completedAt` | string |  | When status reached terminal. |
| `computerUseScope` | string |  | Per-Plan declared computer_use scope (Q9 layer 2 narrowing). When non-empty, the planner gates worker tool dispatch to actions within this scope. Must equal or be NARROWER than the agent's standing AgentAuthorization.computerUseScope; an attempt to widen elevates the Plan to awaitingFeedback with reason=scope_elevation_required. Empty = no worker calls allowed for this Plan. NOTE: the `interact` enum value is retired -- the read path treats it as `full`. New Plans should pick observe or full only. (enum: , observe, interact, full) |
| `errorMessage` | string |  | Populated when status transitions to failed. |
| `estimate` | object |  | Per Q5 (LLM heuristic seed + historical refinement): {p50Ms, p90Ms, confidence: 'heuristic'\|'mixed'\|'historical', sampleSize}. Refreshed at phase boundaries. Drives the canvas card estimate strip and the Tasks page row remaining-time. |
| `estimatedAt` | string |  | When the current estimate was computed. |
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
| `pauseExtendsDeadline` | boolean |  | Per Q12: by default pause time counts against the 8-hour deadline. User can flip per-Plan to 'pausing extends my deadline'. |
| `pausedAt` | string |  | When last paused. Null if never paused or currently running. |
| `phases` | array |  | Per Q3 (outline+per-phase incremental): coarse outline generated at Plan-creation time, refined per phase. Each phase: {kind: string, label: string, status: 'pending'\|'active'\|'done', expectedTaskCount: int, completedTaskCount: int, startedAt?: datetime, completedAt?: datetime, estimate?: {p50Ms, p90Ms, confidence}}. Drives the Tasks page progress strip + estimation rollup. |
| `recommendationCardId` | string |  | Set when status=needsAgent and a plan.needsAgent canvas card was emitted; lets the agent-create flow find this Plan when the user clicks [Create X agent] on the card and re-route on agent save (Q22). |
| `refinementContext` | object |  | For refinement child Plans (Q9): {parentPlanId, userFeedback, parentResultSnapshot}. The planner uses this to constrain the agent's prompt -- 'this isn't a new analysis from scratch; refine what's already there'. Distinct from input so the planner can quickly distinguish refinement from fresh analysis. |
| `requestedBy` | string | yes | v1:identity:user.id of the user whose action created the Plan. Owner-private canvas cards key off this; Tasks page filters when scoped to 'my plans'. |
| `retryThreshold` | integer |  | Max attemptNumber the Planner Agent will allow for any single logicalStepId before escalating to awaitingFeedback with feedbackReason='retry_threshold_hit'. Per-Plan tunable; defaults to 3. The Planner Agent enforces this in its prompt logic by emitting 'escalate' when attempts exhaust; the engine doesn't enforce a hard cap. |
| `spaceId` | string | yes | v1:cognition:space.id this Plan belongs to. Tasks page is per-space; estimation buckets and budget rollups scope to the space. |
| `startedAt` | string |  | When the agent picked up the Plan and Tasks began running. |
| `status` | string | yes | Lifecycle. planning = freshly created; the planner agent is decomposing the goal into phases + emitting task definitions, nothing is dispatched yet. queued = planning is complete; phases + tasks are visible and the plan waits for the USER (or an automation) to click Run -- this is 'awaiting human Run', NOT 'awaiting a free execution slot'. waitingForSlot = the user DID click Run but the account is at its tier's concurrent-task cap (epic memql#902 / admission controller #904), so the Plan is parked in the per-account FIFO waiting queue and will be admitted to running when a slot frees (#905); distinct from queued (the user already chose to run it) and from paused (the user did not pause it -- the system is throttling concurrency). routing = planner is picking an agent. running = agent's Tasks executing (occupies one of the account's concurrency slots). paused = user paused (Q12) or feedback timeout (Q20). awaitingFeedback = agent called requestUserFeedback. needsAgent = no good-fit agent in space, parked awaiting user create. succeeded / failed / cancelled = terminal. (enum: planning, queued, waitingForSlot, routing, running, paused, awaitingFeedback, needsAgent, succeeded, failed, cancelled) |
| `tokenAllocatedToChildren` | integer |  | Sum of unspent allocations to running child Plans. Subtracted when checking child-spawn capacity; returned to available budget when the child completes. |
| `tokenBudget` | integer |  | Per Q6 (Plan-level enforcement): allocated at creation from User.preferences.defaultPlanTokenBudget. Hard-stop ceiling: pre-call check rejects if tokenSpent + estimatedCallCost > budget. Null = use the user default. |
| `tokenCapDisabled` | boolean |  | Per-Plan opt-out (Q6). When true, no soft warnings, no hard stop. Observability metric still records spend. |
| `tokenSpent` | integer |  | Rolled up from Task token costs + planner's own LLM calls (outline / per-phase replanning / estimate prompts). Surfaced as the token bar on Tasks page rows. |
| `totalPausedMs` | integer |  | Sum of paused durations across the Plan's life, for 'how long was this actually working' observability. |
| `triggerSource` | string | yes | Per Q4: user.explicit = user dropped file / clicked button; user.implicit = user said something in chat that Cognition triaged as plan-worthy; agent.proactive = an agent decided on its own; system = cron / automation; subplan.inherited = parent Plan spawned this child Plan. (enum: user.explicit, user.implicit, agent.proactive, system, subplan.inherited) |

## `v1:planner:responsibility`

A user-authored standing directive aimed at an agent (epic #631 / program #629). Three archetypes discriminated by `trigger`: REACTIVE (a `condition` is evaluated against incoming signals; fires when it matches -- e.g. 'when a customer escalation mentions a refund, draft a reply'), STANDING (a behavioral always-on directive with no schedule or condition -- e.g. 'always keep the project tracker tidy'), and RECURRING (a cron `schedule`; the old standingTask -- e.g. 'every Monday 9am summarize last week's marketing performance'). Per-user; the optional scopeSpaceId pins the directive to one space. Consumed by the reactive-loop epic #632 (queryDueResponsibilities feeds the heartbeat-driven evaluator; mutationRecordResponsibilityEvaluation closes the loop). Replaces the retired standingTask concept -- recurring directives carry the same cron schedule + soft-disable + last-run bookkeeping standingTask had.

| Field | Type | Required | Description |
|---|---|---|---|
| `assignedAgentId` | string |  | v1:agents:agent.id of the agent that runs this responsibility, when targetKind names a concrete agent. The agent's domains/keywords/tools are what's available during execution. |
| `assignedRoleSlug` | string |  | Role slug the directive targets when bound by role rather than a concrete agent instance (e.g. 'marketing-analyst'). Resolved to an agent at dispatch time. |
| `condition` | object |  | Match condition for trigger='reactive' -- the structured predicate the evaluator checks incoming signals against (e.g. {kind:'utterance', contains:['refund','escalation']}). Empty/null for standing + recurring. |
| `enabled` | boolean |  | When false the evaluator/runner skips this responsibility. Soft-disable without archiving. |
| `intakeRequest` | object |  | The 0-2 genuinely-ambiguous clarifying questions the responsibilityIntake prompt emitted (issue #637). Shape mirrors Plan.feedbackRequest: {questions:[{id, question, kind:'choice'\|'text', options?:[{label,value}]}], askedAt}. Empty when intake was clear. The CoPresent intake card renders these; the user's answers come back through mutationFoldResponsibilityIntakeAnswers. |
| `intakeResponse` | object |  | The user's answers to intakeRequest, folded back by mutationFoldResponsibilityIntakeAnswers (issue #637): {answers:[{id, answer}], respondedAt}. Carried for audit; the dispatcher uses it to re-infer the final field set before flipping the row to active. |
| `intakeStatus` | string |  | Intake lifecycle (issue #637). Empty = intake has not run yet (freshly created draft). pending = the intake dispatcher claimed this row and is reasoning. awaitingAnswers = intake produced 1-2 clarifying questions on intakeRequest and is parked until the user answers (mirrors the Plan awaitingFeedback surfacing). clear = intake found the statement unambiguous (no questions) -- the row goes straight to status='active'. applied = the user's answers were folded back via mutationFoldResponsibilityIntakeAnswers and the row was activated. Distinct from status so the management UI can show 'needs a quick answer' without overloading the draft/active lifecycle. (enum: , pending, awaitingAnswers, clear, applied) |
| `lastEvaluatedAt` | string |  | Last time the evaluator/runner fired this responsibility (reactive: last condition check; recurring: last scheduled tick; standing: last review). Empty means it has never run. Set by mutationRecordResponsibilityEvaluation. |
| `lastResult` | string |  | Headline of the most recent evaluation/run's result. UI surface for 'last output' widgets. Set by mutationRecordResponsibilityEvaluation. |
| `notifyHow` | string |  | How the run's output reaches the user (epic #631 / issue #637 intake). Free text inferred by the responsibilityIntake prompt -- e.g. 'a chat message in the daily space', 'a notification the day before', 'silently update the tracker'. Empty until intake runs or the user supplies it. |
| `ownerUserId` | string | yes | v1:identity:user.id who authored this responsibility. Per-row authz owner; output posts into this user's surfaces. Server-stamped from actor.userId at create -- never caller-supplied. |
| `schedule` | string |  | Cron-style schedule string for trigger='recurring' (e.g. '0 9 * * 1' for Monday 9am). Empty/null for reactive + standing directives. |
| `scopeSpaceId` | string |  | Optional pin to one v1:cognition:space.id. When set, the directive only applies within that space; when empty, it applies across the owner's spaces. |
| `statement` | string | yes | Human-readable directive the agent acts on (e.g. 'Every Monday morning summarize last week's marketing performance'). The user's words; shown on cards + settings UIs and fed into the agent's prompt at evaluation/run time. |
| `status` | string | yes | Lifecycle. draft = authored, not yet activated; active = live, evaluated/dispatched; paused = temporarily held (distinct from enabled=false which is a per-run skip); archived = retired, hidden from active lists. Transitioned via mutationSetResponsibilityStatus. (enum: draft, active, paused, archived) |
| `successCriteria` | string |  | How the user (or evaluator) judges a run as successful -- free text the agent's prompt and the evaluation record use to decide lastResult quality. |
| `targetKind` | string | yes | Who carries out the directive. assistant = the user's General Assistant; specialist = a named specialist agent (assignedAgentId / assignedRoleSlug); unassigned = no agent bound yet (drafted, awaiting assignment). (enum: assistant, specialist, unassigned) |
| `trigger` | string | yes | Archetype discriminator. reactive = fires when `condition` matches an incoming signal; standing = always-on behavioral directive (no schedule, no condition); recurring = cron-scheduled (the old standingTask). queryDueResponsibilities keys off this: recurring rows are due when `schedule` ticks, reactive rows are due when pending evaluation. (enum: reactive, standing, recurring) |

## `v1:planner:task`

One executable step inside a Plan. Two flavors discriminated by `category`: 'semantic' rows are what the Planner Agent decomposes a Plan into (one per logical step); 'toolInvocation' rows are auto-stamped by the engine on every tool call an agent makes (one per call). Tool-call rows attach to their executing semantic row via `parentTaskId`, giving one level of recursion -- semantic Tasks never have a `parentTaskId`, tool-call Tasks always do. Sub-goal nesting still happens at the Plan level via `parentPlanId` (Q1); the recursion here is purely mechanical record-keeping. Per Q13 each Task declares its executionSurface so the planner can route inProcess work to the agent node and containerExecutor work to NemoClaw / homegrown sandboxes.

| Field | Type | Required | Description |
|---|---|---|---|
| `attemptNumber` | integer |  | Which attempt at logicalStepId this row represents. Increments per retry. The Planner Agent enforces the per-Plan retryThreshold by emitting an 'escalate' action when attemptNumber > Plan.retryThreshold. |
| `category` | string | yes | What kind of record this is. 'semantic' = Planner-created decomposition step (the user-meaningful unit). 'toolInvocation' = engine-auto-stamped record of a tool call by an executing agent. Engine validation: category='toolInvocation' MUST have parentTaskId set pointing at a category='semantic' row; category='semantic' MUST have parentTaskId=null. (enum: semantic, toolInvocation) |
| `completedAt` | string |  |  |
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
| `parkedAt` | string |  | Per Q18: set when the Task hits a checkpoint while parent is paused / awaitingFeedback. The runner exits cleanly; on resume the planner re-invokes from the parkedAtCheckpoint marker + persisted TaskState. |
| `parkedAtCheckpoint` | string |  | Task-kind-specific resume marker. fileProcessor: 'between-pages'; llmAnalyze: 'between-calls'; runCommand: 'between-commands'. The agent's resume code path knows what each marker means. |
| `phase` | string |  | Per Q3: phase tag matching one of the parent Plan's phases[].kind values. Lets the Tasks page render 'Phase 2 of 4: classifying' progress without joining tables. |
| `planId` | string | yes | v1:planner:plan.id this Task belongs to. Every Task -- semantic or toolInvocation -- lives under exactly one Plan, even ad-hoc tool calls in chat (which get a synthetic single-Task Plan of kind=adHocAction). |
| `seq` | integer | yes | Order within the parent Plan. Tasks within a phase execute in seq order, UNLESS dependsOn[] is set (then the DAG drives ordering and seq is only a stable tie-break within a DAG layer). |
| `startedAt` | string |  |  |
| `status` | string | yes | Lifecycle. queued = emitted by planner; running = agent executing; paused = parent Plan is paused or this Task hit a checkpoint while parent is paused (Q12); succeeded / failed / cancelled = terminal. Cancellation cascades from the parent Plan. (enum: queued, running, paused, succeeded, failed, cancelled) |
| `toolArgs` | object |  | Tool-call arguments captured at dispatch time. Populated for category='toolInvocation'; empty for category='semantic'. |
| `toolName` | string |  | Populated by the auto-stamper for category='toolInvocation'. The bare tool name as the agent invoked it. Empty for category='semantic'. |
| `toolResult` | object |  | Tool-call result captured when the dispatched call returned. Populated for category='toolInvocation' when status=succeeded. Empty for category='semantic'. |

**Relationships:** `parent` -> `v1:planner:task`

## `v1:planner:taskState`

Persisted working state of a Task that's parked awaiting user feedback (or has been paused mid-execution). The async-parking + planner re-invocation model from Q18: when an agent calls requestUserFeedback, the agent's process exits cleanly after persisting its working state; when the user responds, the planner re-invokes the agent with this state as bootstrap context. Same machinery powers Pause/Resume (Q12) and refinement-Plan parent-Task resumption (Q9). Per Task; written when the Task transitions to awaitingFeedback / paused; read on resume.

| Field | Type | Required | Description |
|---|---|---|---|
| `pendingSubPlanIds` | array |  | Sub-Plan ids the agent was orchestrating when it parked. Resume waits on these to complete before continuing. |
| `reasoningChain` | string |  | The agent's internal 'what I'm doing and why' summary so it can pick up the thread on re-invocation. |
| `taskId` | string | yes | v1:planner:task.id this state belongs to. One row per (taskId, persisted-version-seq); the planner reads the latest on resume. |
| `toolCallHistory` | array |  | Replayable tool-call log: list of {toolName, args, result, error?} in order. Agent prompt either replays or uses as a 'what's been done so far' summary. |
| `workingMemory` | object |  | Intermediate results from previous tool calls in this Task. Free-form per agent kind; the agent's prompt template knows how to consume. |

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
| `lastUsedAt` | string |  | Last time the resolver decrypted this secret. Empty until first use. |
| `name` | string | yes | Secret name (uppercase with underscores by convention). |
| `rotatedAt` | string |  | Timestamp of the most recent rotation (optional). |

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
| `firstSeenAt` | string |  | When the first sighting was logged. |
| `kind` | string | yes | What category of platform extension would close this gap. 'tool' = an agent-callable action that doesn't exist yet (e.g. 'sendSlackMessage'). 'integration' = a backing service we don't speak to yet (e.g. Jira). 'liveSource' = a volatile data source we'd want bound to agents but don't have a query for. 'connectorKind' = a brand-new liveConnector implementation kind (e.g. 'snowflake'). 'knowledgeDomain' = a category-level gap, e.g. agents trying to act in a domain we never seeded. 'modelCapability' = a model-level feature we don't support yet (e.g. structured-output with strict schemas on a new provider). (enum: tool, integration, liveSource, connectorKind, knowledgeDomain, modelCapability, other) |
| `lastSeenAt` | string |  | When the most recent sighting was logged. |
| `partitionScope` | string |  | Partition where the gap was detected. Empty = unknown. Helps de-duplicate platform-wide vs tenant-specific gaps. |
| `requestedByAgentId` | string |  | v1:agents:agent.id of the agent (typically the Planner Agent) that logged the gap. Empty for system-level detection. |
| `requestedFromPlanId` | string |  | v1:planner:plan.id where the gap was detected. Lets the platform team trace back to 'what was the user trying to accomplish when we hit this wall'. |
| `resolution` | string |  | Free-text note when status='resolved' or 'wontfix' explaining what shipped (or why we won't ship it). |
| `sightingCount` | integer |  | How many times this gap has been logged. New sightings of the same (kind, capability) increment rather than creating new rows. Drives 'most-requested capability' prioritization. |
| `spaceId` | string |  | Optional space scope where the gap was detected. Useful for attributing 'this gap blocked work in space X'. |
| `status` | string |  | Lifecycle. 'open' = logged, nothing done yet. 'in_progress' = the platform team is working on it (manually set). 'resolved' = the capability shipped; the Planner Agent's next sighting will recreate as a fresh row if it still doesn't work. 'wontfix' = explicit dismissal. (enum: open, in_progress, resolved, wontfix) |

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
| `lastUsedAt` | string |  | Last time the resolver decrypted this secret. Empty until first use. |
| `name` | string | yes | Secret name (uppercase with underscores by convention). |
| `rotatedAt` | string |  | Timestamp of the most recent rotation (optional). |

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

## `v1:router:budget`

Spend limit for a partition or a specific agent within a partition. The router checks the current-period spend against this cap before every SI call; over-budget calls are refused with a typed error that surfaces in the UI as a clear 'budget reached' state. Rolls over at periodType boundary (UTC day, week, or month).

| Field | Type | Required | Description |
|---|---|---|---|
| `active` | boolean |  | When false the budget is ignored (calls proceed unchecked). Useful for temporary overrides during incident response. |
| `alertSent` | boolean |  | True when the threshold alert for the current period has been emitted. Reset to false on period rollover. |
| `alertThresholdPct` | integer |  | Emit an alert event when spend crosses this percentage of the limit (e.g. 80 for early warning). 0 disables early alerts. |
| `limitUSD` | number | yes | Maximum USD spend allowed during one period. The router refuses calls once ledger totals reach this figure. |
| `periodType` | string | yes | Budget window. Resets at UTC midnight / Monday / first-of-month. (enum: daily, weekly, monthly) |
| `resetAt` | string |  | The next UTC moment the period rolls over. The router uses this to decide whether to reset alertSent. |
| `scope` | string | yes | Whether this budget caps the whole partition or a single agent. (enum: partition, agent) |
| `scopeId` | string |  | When scope=agent, the v1:agents:agent id being capped. Empty when scope=partition. |

## `v1:router:call`

One SI invocation recorded by the memQL SI Router. Every call through the router -- agent replies, prompt renders, suggest endpoints, TTS, transcription -- produces exactly one row here with attribution, token counts, latency, and cost. Partition-scoped usage ledger; the time-series axis rides the shared MemoryNodes hypertable.

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string |  | Agent whose reply this call was generating; empty for non-agent SI calls (suggest, render, TTS, etc). |
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
| `promptName` | string |  | Name of the MemQL prompt invoked when the call went through InvokeSI (e.g. agentReply, cognitionRouting). |
| `providerName` | string | yes | memQL provider registry name (e.g. stream54Mini, streamClaudeSonnet). |
| `requestId` | string | yes | Correlates this SI call to an upstream request -- cognition turn, suggest envelope, prompt invocation. Free-form string; uniqueness is not enforced across partitions. |
| `spaceId` | string |  | Cognition space the call ran inside, when applicable. |
| `streaming` | boolean |  | True when the call used a streaming provider path. |
| `timeToFirstTokenMs` | integer |  | Wall-clock ms from call start to first streamed token. 0 for non-streaming calls (chat, suggest, TTS). |
| `tokensEstimated` | boolean |  | True when token counts are derived from a char-count heuristic rather than provider-reported usage. Phase 1 always estimates; Phase 2 will flip this to false when the vendor's real usage is available. |
| `tokensPerSec` | number |  | Output tokens per second for streaming calls (computed end-of-stream). 0 for non-streaming or too-short calls. |
| `totalCost` | number |  | USD total cost for this call. Equal to inputCost + outputCost + cachedInputCost. |
| `totalDurationMs` | integer | yes | Wall-clock ms from call start to completion (success or error). |
| `userId` | string |  | Identity subject of the end-user driving this call, when resolvable. Empty for system-triggered calls. |
| `vendor` | string | yes | Vendor family: openai, anthropic, google, xai, groq, mistral, etc. Derived from provider .memql @type. |

## `v1:router:modelCatalog`

Virtual projection of a registered SI provider entry. Never persisted -- rows are produced at query time by the integration.router.listModels capability from the live provider registry. Lives in the concept registry so the engine can shape results without a database round-trip.

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
| `vendor` | string |  | Vendor family (openai, anthropic, google, xai, groq, mistral). |

## `v1:router:policyCatalog`

Virtual projection of a registered SI Router policy. Never persisted -- rows are produced at query time by the integration.router.listPolicies capability from the live policy registry. Lives in the concept registry so the engine can shape results without a database round-trip.

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

## `v1:todos:todo`

A user-owned to-do item: a titled task with a done flag plus optional due date, priority, and a back-pointer to the responsibility that spawned it. The standalone source-of-truth to-do concept the assistant manages on the user's behalf. Per-row authz: owned -- ownerUserId is stamped from actor.userId on every write and every read gates on ownerUserId==actor.userId.

| Field | Type | Required | Description |
|---|---|---|---|
| `done` | boolean |  | Completion flag. Flipped to true by the complete operation; the row keeps its history so an undo is just another version with done=false. |
| `dueAt` | string |  | Optional due date / time in RFC3339. Used by the frontend to sort + surface overdue items; absence means no deadline. |
| `ownerUserId` | string | yes | v1:identity:user.id that owns this to-do. Stamped from actor.userId at create time; re-stamped from actor.userId on every update so ownership can never be reassigned by a caller. The load-bearing per-row authz key. |
| `priority` | string |  | Optional priority bucket. Absence means unprioritized; the frontend sorts high > medium > low > unset. (enum: low, medium, high) |
| `sourceResponsibilityId` | string |  | Optional back-pointer to the responsibility (or plan / automation) that spawned this to-do. Empty for user-created to-dos. Lets the frontend group app-generated tasks under their originating responsibility and lets a responsibility reconcile the to-dos it created. |
| `title` | string | yes | Short human-readable description of the task. The primary display field. |

**Relationships:** `parent` -> `v1:identity:user`

## `v1:workbench:workspace`

Per-Plan workbench workspace. Tracks the persistent filesystem mounted into every per-Task container running under the Plan. Created lazily on first workbenchHost call; released when the parent Plan transitions to a terminal status (succeeded / failed / cancelled). Universal authorization -- no scope grants, no kill switch, no per-agent gating; the workbench is sandboxed inside the cluster and the blast radius is contained to the per-Plan directory tree.

| Field | Type | Required | Description |
|---|---|---|---|
| `lastUsedAt` | string |  | Bumped on every successful workbenchHost dispatch. Backs idle-detection metrics; not used to drive teardown (teardown is Plan-terminal-driven). |
| `planId` | string | yes | v1:planner:plan.id this workspace belongs to. One workspace per Plan; the unique key. |
| `releasedAt` | string |  | When the workspace was released and the directory torn down. Empty for status=provisioned. |
| `releasedReason` | string |  | Discriminator for status=released rows. plan_terminal = the releaseWorkbenchOnPlanTerminal automation fired. explicit = an admin / mutation explicitly released. ttl_expired = future ttl-driven sweep. (enum: , plan_terminal, explicit, ttl_expired) |
| `status` | string | yes | Lifecycle. provisioned = workspace directory exists and is mountable. released = Plan reached terminal, directory torn down. (enum: provisioned, released) |
| `storageRoot` | string | yes | Absolute path to the workspace's root directory on the workbench node's local filesystem. Implementation default: /var/lib/memql/workbenches/{planId}/. Per-Plan isolation is filesystem-level; cgroup / user-namespace isolation is per-call. |

**Relationships:** `parent` -> `v1:planner:plan`

## `v1:worker:invocation`

Per-call telemetry for worker tool invocations. Written once on call completion (success / failure / cancelled / timeout / denied). Operator reads these for plan debugging; auditor reads identity:auditEvent for the security timeline. Linkage between the two layers is via correlationId. Retention default 90 days, tunable via WORKER_INVOCATION_RETENTION_DAYS; the workerInvocationRetentionSweep cron soft-deletes rows past their TTL.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | Action discriminator within the tool. workerHost: exec / fs_read / fs_write / fs_list / fs_stat / http_fetch. workerComputer: screenshot / cursor_position / mouse_move / mouse_click / mouse_drag / mouse_scroll / key_type / key_combo / display_info / window_list / window_focus. |
| `agentId` | string | yes | v1:agents:agent.id the call originated from. |
| `argsRedacted` | object |  | Args with secret-shaped fields redacted. Tokens, passwords, Authorization headers, env vars matching SECRET/KEY/PASSWORD scrubbed. |
| `bytesIn` | integer |  | Bytes the worker streamed in (e.g. fs_write payload). |
| `bytesOut` | integer |  | Bytes the worker streamed out (stdout + stderr + fs_read body, etc). |
| `completedAt` | string |  | When ToolResult landed back on the agent. Empty for in-flight rows that haven't completed yet -- those are rare; usually the row is written once at completion. |
| `correlationId` | string |  | Random ID linking this row to the matching v1:identity:auditEvent row when one was emitted (denied-by-policy, scope-elevation, etc). |
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

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:worker:registration`, `parent` -> `v1:agents:agent`, `parent` -> `v1:planner:plan`

## `v1:worker:registration`

Operational registration of a worker -- the runtime record for a memql-cockpit instance running in worker mode and connected to this cluster. Persists stable identity + capabilities + last-seen state. The currently-connected gRPC stream + per-call concurrency live in-memory on whichever agent node holds the stream; this concept is for everything that needs to survive disconnect and binary restart. Per-user routing: every registration is owned by exactly one v1:identity:user; only agents in sessions owned by that user can dispatch tools to this worker.

| Field | Type | Required | Description |
|---|---|---|---|
| `buildTag` | string |  | Cockpit build flavor: 'gui' or 'nogui'. |
| `capabilities` | array | yes | Capability set advertised at registration. HEADLESS is mandatory; GUI is added when the cockpit-gui build confirmed TCC + (Wayland/X11) at startup. Order is not significant. |
| `concurrency` | object | yes | Per-capability max-parallel limits, e.g. {HEADLESS: 8, GUI: 1}. Scheduler enforces; calls beyond cap queue (FIFO) up to the calling tool's timeout. |
| `identityId` | string | yes | v1:identity:identity.id of the worker_token credential the worker authenticated with. Lookup target on every reconnect; rotated tokens stamp a new identity row, not a new registration. |
| `labels` | object |  | Free-form key=value tags. os, arch, hostname auto-populated; operator extends with custom labels for routing among the user's own workers (e.g. has-blender=true). |
| `lastConnectedFromIP` | string |  | Source IP of the most recent connect attempt. Audit + abuse signal. |
| `lastSeenAt` | string |  | Bumped on every heartbeat (15s cadence). Drives the online/offline indicator. Heartbeat batching keeps DB write rate manageable. |
| `name` | string | yes | User-chosen display name. Defaults to hostname. Shown in /me/workers and /admin/workers. |
| `ownerUserId` | string | yes | v1:identity:user.id who owns this worker. Set once at register time from the worker_token's registeredBy. Dispatch-time access check: caller's session-owner must equal this value. |
| `permissions` | object |  | TCC / X11 status snapshot at register time: {accessibility, screen_recording, x11_display, detail}. Surfaced in /me/workers; the worker re-registers on reconnect so this stays accurate. |
| `platformInfo` | object |  | os, arch, hostname snapshot at register time. |
| `registeredAt` | string | yes | When the registration row was first created. |
| `revokeReason` | string |  | Free text; surfaced in audit + the worker's offline-row tooltip. |
| `revokedAt` | string |  | When the user (or admin) revoked the worker. Non-nil = dispatch refuses; the worker's gRPC stream is dropped on next health check. |
| `revokedBy` | string |  | v1:identity:user.id who revoked the worker. Empty for self-revocation. |
| `version` | string |  | Cockpit binary version (e.g. v2026.5.4-gui). |

**Relationships:** `parent` -> `v1:identity:user`, `parent` -> `v1:identity:identity`, `parent` -> `v1:identity:user`

