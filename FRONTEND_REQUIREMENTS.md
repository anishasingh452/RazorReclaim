# RazorReclaim — Frontend Requirements Document

**Purpose of this document:** a complete, implementation-ready specification of the frontend for RazorReclaim (the "Razorpay Agent Command Center"), written so a builder (Lovable, Codex, or a human frontend engineer) can build the entire UI without reading any backend code. It describes every page, every piece of data that page needs, every interaction, every state, and the exact API contracts to call. No frontend code is included — this is a spec, not an implementation.

The product already has a **partial frontend built** (4 pages, described in full below as the baseline). This document specifies the **complete target frontend** — i.e. "keep everything that exists, and add what's missing." Sections are marked `[EXISTS]` (already built, described so it can be preserved/extended correctly) or `[NEW]` (not yet built — a gap that must be filled).

---

## 1. Product Summary

RazorReclaim is an AI + deterministic-engine system that recovers at-risk revenue (failed payments, abandoned checkouts, failed subscriptions, overdue receivables) for a Razorpay merchant. For every at-risk case, the backend runs a pipeline that:

1. Detects a **signal** (raw event) and creates a **case** from it.
2. Diagnoses root cause with an LLM.
3. Gets a recommendation from the LLM, **and** a second, independent rule-based agent — two **agent proposals** per case.
4. Checks **shared cross-case memory** for this customer (prior decisions, active promises, pending follow-ups) and detects **conflicts** between the two proposals.
5. Runs a deterministic **Business Impact Engine**: enumerates every candidate action (feasible and infeasible, with reasons), scores each by **Expected Recovery Value (ERV = Potential Recoverable Amount × Recovery Probability − Intervention Cost)**, and selects the highest-ERV feasible action. This engine also resolves any agent conflict — its ERV winner is authoritative regardless of which agent proposed it.
6. Runs a deterministic **Policy Engine** (hard-coded thresholds — see §14.4) that can override the engine's pick to `stop`, `escalate`, or `wait_and_retry`.
7. Logs a **5-way meta-decision** (`ACT` / `WAIT` / `ESCALATE` / `NO_ACTION` / `STOP`) and, whenever the outcome is non-engaging, a structured **"Why Not To Act"** explanation (this is the product's signature transparency feature).
8. Executes the final action — **real** Razorpay Payment Link + real Resend email for `payment_link`/`reminder`; a real ElevenLabs-synthesized voice script for `voice` (call outcome itself is simulated — no telephony); simulated for `retry`; nothing external for `stop`/`no_action`.
9. Verifies the outcome (real Razorpay webhook, or a demo-only simulate-payment trigger — always visibly labeled which).
10. Records everything in a **hash-chained, tamper-evident audit trail** (SHA-256, per-case chain from a `GENESIS` root) — this table IS the product's "Decision Graph."

Every case belongs to a **batch** (50–200 synthetic cases seeded together, run live). There is a live SSE stream of the batch actually executing — **never a precomputed replay dressed up as live**. This real-vs-simulated distinction is a recurring product value and must be visually explicit everywhere it applies (§10).

**The product's core UX idea:** for any decision, a viewer can always see three independent "voices" — what the AI recommended, what the deterministic Business Impact Engine actually selected (by ERV), and what the Policy Engine allowed — and, when nothing happened, exactly why not. This is already built as the `DecisionComparison` component (§8) and must remain the visual anchor of the Case Investigation page.

There is **no authentication and no multi-tenancy**. It's a single internal operator console. Reviewer identity on approve/reject actions is currently a hardcoded string `"demo-reviewer"` — keep this pattern (a free-text or fixed "reviewer name" is sufficient; do not build a login flow).

---

## 2. Tech & Design Foundations (already decided — do not deviate)

- **Framework:** Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui (built on `@base-ui/react` — note its API differs slightly from the more common Radix-based shadcn, e.g. a dialog trigger takes a `render` prop instead of `asChild`).
- **Theme:** dark mode only, permanently. No light mode, no theme toggle. `<html class="dark">` is set at the root.
- **Visual identity:** near-black zinc/graphite surfaces (`oklch(0.135 0.004 285)` background), an emerald signature accent (`oklch(0.77 0.15 165)`, used for the brand mark, primary buttons, and "positive/recovered" states), with a consistent secondary semantic palette:
  - **Emerald** — money, recovered, approved, positive/agrees.
  - **Amber** — pending, attention, awaiting approval, policy-blocked.
  - **Red** — stopped, failed, negative, harassment-hard-cap.
  - **Blue** — AI/automated reasoning, in-progress.
  - **Violet** — human-in-the-loop, escalation.
  - **Teal** — voice channel.
  - **Zinc/white-alpha** — neutral/no-action/skipped.
- **Component pattern:** translucent badges everywhere — `bg-{color}-500/10 text-{color}-300 border-{color}-500/20`. Cards are `rounded-xl border border-white/10 bg-white/[0.02..0.03]`. Numbers are always `font-mono tabular-nums`. Currency is always ₹ via `Intl`-backed helpers, never raw numbers.
- **Fonts:** Geist Sans (UI text) + Geist Mono (all numeric/monospace data — amounts, IDs, timestamps, hashes).
- **Icons:** `lucide-react`.
- **Notifications:** `sonner` toast, top-right, dark theme.
- **No client-side global state library.** Pages fetch their own data (server components where possible, `"use client"` + `useState`/`useEffect` + a thin `api-client.ts` module for anything interactive or live). Keep this pattern for new pages.

If Lovable/Codex is building fresh rather than extending the existing repo, it should still adopt exactly this stack and visual system — treat §2 as non-negotiable brand/UX constraints, not suggestions.

---

## 3. Global Chrome — `[EXISTS, extend nav]`

**Header** (sticky, `border-b`, blurred background), present on every page:
- Left: brand mark — pulsing emerald dot + "Razor**Reclaim**" wordmark (Razor in white, Reclaim in emerald), links to `/`.
- Center-left: primary nav (text links, active/hover states — see §3.1 for the full target nav).
- Right: a static "Test Mode" pill (border, muted text) — signals every Razorpay/payment action in this build is in Razorpay **Test Mode**, not production money.

No footer. No sidebar. Content area is a centered column, `max-w-[1400px]` on the dashboard, `max-w-6xl`/`max-w-5xl` on detail pages — keep this "focused column," not full-bleed, on new pages too.

### 3.1 Target primary navigation `[NEW items marked]`

| Label | Route | Status |
|---|---|---|
| Command Center | `/` | EXISTS |
| Portfolio Priority | `/portfolio` | **NEW** |
| Approval Queue | `/approvals` | EXISTS |
| Conflicts | `/conflicts` | **NEW** |

Keep the nav to these four items — do not add a fifth top-level item for every new backend concept. Two other required feature areas (**Shared Agent Memory** and the **Decision Graph**) are deliberately *not* separate pages — they are sections/drawers reached from a case (§7.2, §7.6), because they are only meaningful in the context of a specific case or customer, not as a standalone list. This mirrors the backend's own design principle of extending existing surfaces rather than fragmenting into parallel views.

---

## 4. Domain Glossary (plain-English, for the builder — not code)

| Term | Meaning |
|---|---|
| **Signal** | A raw detected event (a failed gateway charge, an abandoned checkout, etc.) that a case is created from. |
| **Case** | One at-risk revenue item being worked: a customer, an amount, a risk type, a status, and (once decided) a final action. |
| **Batch** | A named group of 50–500 cases seeded together and run together; has aggregate stats. |
| **Risk type** | Why the money is at risk: `failed_payment`, `checkout_abandonment`, `subscription_failure`, `overdue_receivable`. |
| **Action type** | The 8 possible things the system can do about a case: `retry`, `payment_link`, `reminder`, `wait_and_retry`, `escalate`, `stop`, `voice`, `no_action`. |
| **Decision category** | The 5-way meta-decision every case resolves to: `ACT` (retry/payment_link/reminder/voice), `WAIT` (wait_and_retry), `ESCALATE`, `NO_ACTION`, `STOP`. |
| **Root cause diagnosis** | The LLM's structured read of *why* the payment/case failed, with a category, a qualitative recovery likelihood, and evidence bullets. |
| **AI recommendation** | The LLM's suggested action for the case (one of the 8 action types), with confidence + evidence. |
| **Agent proposal** | A structured "I think we should do X" from one of two agents (`ai_recovery_agent` = the LLM's own recommendation formalized; `channel_strategy_agent` = a second, cheap, rule-based agent) — always exactly two proposals per case. |
| **Agent conflict** | A detected disagreement between the two proposals (same action twice = `duplicate_action`; opposite strategies = `contradictory_strategy`; different channels at once = `competing_channel`; otherwise `conflicting_action`). Conflicts are *resolved*, not just detected — the Business Impact Engine's ERV winner always wins, regardless of which agent proposed it. |
| **Candidate action / impact score row** | One row per *possible* action type for a case (all 8, or the subset that applies to its risk type), each marked feasible or not (with a plain-English reason if not), and — if feasible — scored with Potential Recoverable Amount, Recovery Probability, Intervention Cost, and the resulting **Expected Recovery Value (ERV)**. Exactly one is `selected` (the ERV-maximizing feasible one). |
| **Policy check** | One deterministic guardrail rule evaluated against the selected candidate (see §14.4 for the full rule table) — each has a pass/fail and a plain-English detail string. All rules run every time, not just until the first failure. |
| **Communication Governor** | A shared pre-check ("is it OK to contact this customer right now") any agent can consult — returns `ALLOW` / `DELAY` / `BLOCK` with a reason. Visible via the audit trail's `GOVERNOR_CHECKED` event and sometimes baked into a proposal's rationale text (a self-censored proposal). |
| **Why Not To Act** ⭐ | A structured, one-of-seven-reason-codes explanation, generated only when the final decision is `stop`, `no_action`, or `wait_and_retry` — e.g. "an active promise-to-pay exists," "communication fatigue risk," "cost exceeds value." This is the product's signature transparency feature — give it real visual weight, not a buried tab. |
| **Shared Agent Memory / decision memory** | A durable, cross-case, per-customer log: "this customer's last 3 cases resolved this way." Consulted before every new decision so the system doesn't repeat a bad play or contact someone who already has a pending promise. |
| **Promise-to-pay** | A commitment captured during a voice interaction ("I'll pay ₹X by date Y") — tracked as `pending` / `kept` / `broken`. |
| **Voice interaction** | A simulated call outcome (answered/voicemail/no-answer/declined, resolution) — but when ElevenLabs is configured, the *audio* the agent would have spoken is genuinely synthesized (real MP3, hosted in Supabase Storage) even though the telephony/outcome is simulated. `audio_url` present = real audio exists for this call. |
| **Scheduled action** | A future-dated follow-up (e.g. a deferred retry after a cooldown) — `pending` / `executed` / `cancelled`. |
| **Portfolio priority score** | A batch-wide ranking of open opportunities by where the next action creates the most value — ERV adjusted by an "urgency" multiplier that grows the longer a case has been unresolved (up to +50% at 60+ days). |
| **Decision graph / audit trail** | The complete, ordered, hash-chained log of every event in a case's life (canonical event vocabulary — see §14.5). Each row is cryptographically chained to the previous one; a broken chain means tampering. This *is* the accountability record — treat the Audit tab as a first-class "Decision Graph" view, not a debug log. |
| **Real vs. simulated** | A recurring, deliberate distinction: some actions genuinely call Razorpay/Resend/ElevenLabs; others are clearly-labeled simulations (no real payment vehicle, e.g. `retry`; no real telephony). The UI must never blur this line — see §10. |

---

## 5. API Contracts

### 5.1 Existing endpoints `[EXISTS]` — build against these as-is

**`GET /api/cases`** — list cases (paginated).
Query params: `batchId`, `status` (one of the case statuses), `riskType`, `limit` (default 50, max 200), `offset`.
Response: `{ cases: CaseWithImpact[], total: number }`. Each case row has the base case fields (see §14.1) plus `selectedRecoveryProbability: number | null` and `selectedExpectedRecoveryValue: number | null` (null until the pipeline has scored it).

**`GET /api/cases/:id`** — full case detail. Response shape today:
```
{
  case, evidence[], decisions[], impactScores[], policyChecks[],
  executions[], verifications[], auditLog[], approvals[]
}
```
See §5.2 for the required extension — **build the Case Investigation page against the extended shape**, not this one, but note the extension should be additive (new keys alongside these, nothing renamed/removed).

**`GET /api/batches`** → `{ batches: Batch[] }` (see §14.1 for `Batch` fields — includes `total_cases`, `total_at_risk`, `total_recovered`, `total_expected_recovery_value`, `status`).

**`POST /api/batches`** — create + seed a new batch. Body: `{ name: string, caseCount: number (1-500), seed?: string, concurrency?: number }`. Response `201`: `{ batch, caseCount, totalAtRisk }`.

**`GET /api/batches/:id`** → `{ batch, totalCases: number, statusBreakdown: Record<CaseStatus, number>, actionBreakdown: Record<ActionType, number> }`.

**`POST /api/batches/:id/run`** — starts the batch executing **live**. This is a **held-open POST whose response body is a Server-Sent-Events stream** (not the browser `EventSource` API — it can't POST — read the fetch response body directly with a `ReadableStream` reader; the existing `runBatchStream()` client helper already does this correctly and should be reused/ported as-is). Each event:
```
{ type: "stage_transition" | "batch_metric" | "batch_complete", batchId, caseId?, stage?, status?, timestamp, detail? }
```
`stage` is one of the internal node names (`queued, detect, root_cause, recommend, business_impact, policy, escalate, execute, verify, stop, defer`, plus an `error` pseudo-stage) — map these to the 8 external-facing pipeline stages via the existing `nodeToPipelineStage()` lookup (§14.3) before displaying. `detail` is a free-form payload used for narration (customer name, amounts, selected action, etc. — see `narrateEvent()` behavior in §7.1 for the exact copy per stage).

**`GET /api/approvals?status=pending|approved|rejected`** → `{ approvals: Approval[] }`, each row embeds its `cases` (id, customer_name, amount, risk_type, customer_tier, batch_id). `requested_action` (jsonb) contains `{ selected_impact?: {action_type, expected_recovery_value, recovery_probability}, policy_decision?: {allowed, checks?: [{rule_name, passed}]}, llm_recommendation?: {suggested_action, confidence} }`.

**`POST /api/approvals/:id/approve`** / **`POST /api/approvals/:id/reject`** — body `{ reviewer: string }` (default `"demo-reviewer"` if omitted). Response `{ ok: true }` or `{ error }` (400). Approving resumes the case through execution; rejecting stops it.

**`POST /api/dev/simulate-payment/:caseId`** — **demo-only control**, not a real customer action. Simulates the customer completing a real Razorpay Payment Link that's already been created for the case (404 if none exists). Calls the exact same verification path a real webhook would. Response `{ verification }`. Surface this only where a `payment_link`/`reminder` execution exists and is unverified (§7.2) — label it clearly as a demo trigger, never implying it's a real payment event.

### 5.2 Required new/extended endpoints `[NEW — not yet implemented, must be added]`

These expose data that already exists in the database (via the tables in §14.2) but currently has no API route. Build the frontend against these contracts; flag to whoever owns the backend that these routes need to be added (each is a thin wrapper around an existing, already-tested backend function — no new business logic required).

**Extend `GET /api/cases/:id`** (same route, richer payload — additive only) to also return:
```
{
  ...existing keys unchanged...,
  signal: Signal | null,
  agentProposals: AgentProposal[],
  agentConflicts: AgentConflict[],
  noActionDecision: NoActionDecision | null,
  scheduledActions: ScheduledAction[],
  voiceInteractions: VoiceInteraction[],
  promisesToPay: PromiseToPay[],
  customerHistory: DecisionMemory[],   // this customer's memory across ALL their cases, newest first
  auditChainIntegrity: { intact: boolean, brokenAtIndex: number | null }
}
```

**`GET /api/batches/:id/portfolio`** → `{ opportunities: RankedPortfolioOpportunity[] }` where each item is:
```
{
  caseId, customerName, customerTier, riskType, amount, daysSinceFailure,
  recoveryProbability, selectedErv, priorityScore, status
}
```
Ranked highest `priorityScore` first (already sorted server-side). Only includes cases that have a selected impact candidate (i.e. have been through the pipeline at least once).

**`GET /api/conflicts`** → `{ conflicts: ConflictFeedItem[] }`. Query params: `batchId?`, `resolved?` (`true`/`false`/omit for all). Each item:
```
{
  id, caseId, customerName, amount, conflictType, resolution: ConflictResolution | null,
  proposals: { id, agentName, proposedAction, proposedChannel, confidence, rationale }[],
  winningProposalId: string | null,
  detail: Record<string, unknown>,
  createdAt
}
```

**`GET /api/customers/:customerId/history`** → `{ customerId, decisions: DecisionMemory[] (each with a joined case summary: caseId, riskType, amount, status) }`. Used by the Customer Memory drawer (§7.6); the same data also comes pre-joined inside the extended case-detail response above (`customerHistory`) for the common case, so this endpoint is only needed if the drawer is opened for a customer without navigating from one of their cases first — implement it, but the case-detail-embedded version is the primary path.

---

## 6. Roles & Permissions

Single implicit role: **Recovery Operator**. No login screen, no user switcher, no permission gating in the UI. The only place an "identity" is captured is the reviewer name on approve/reject — keep this as a simple text input (default-filled `"demo-reviewer"`) rather than building auth. Do not build role-based view variants; there is exactly one view of the product.

---

## 7. Pages

### 7.1 Command Center (`/`) — `[EXISTS, minor extension]`

**Purpose:** the home page. Pick or create a batch, run it live, and see every case in it ranked and filterable, with aggregate KPIs.

**Layout (top to bottom):**
1. **Header row** — eyebrow "AI Recovery Command Center" (emerald, sparkle icon) + H1 "Decision Intelligence Inbox" + one-line description on the left; on the right, a batch selector `<select>` (shows name, case count, status), a "New Batch" dialog trigger, a "Quick 150-case batch" shortcut button, and the primary "Run AI Recovery (N open)" button (disabled when no batch selected, already running, or zero open cases; emerald filled).
2. **KPI strip** — 6 cards in a responsive grid (2/3/6 columns by breakpoint): Revenue At Risk, Revenue Recovered, Recovery Rate (%), Expected Recovery Value, Cases Processed (`x/total`), AI Decisions Executed. Each: label (uppercase, muted, 11px) + icon + large mono value + optional sub-caption.
   - **`[NEW]`** Add a 7th/8th card (or a compact secondary strip directly beneath) for governance visibility: **Conflicts Detected** (count from batch, all-time or this batch) and **No-Action Decisions** (count of `stop`+`no_action` outcomes) — these make the Agent Command Center's governance layer visible on the very first screen, not just inside individual cases.
3. **Live Run Panel** — only rendered once a run has started or has events (`running || events.length > 0`); otherwise entirely absent (not an empty state, just not there). Contents:
   - Card header "AI Recovery Pipeline" with a pulsing "live" badge while `running`.
   - The 8-stage **Pipeline Stepper** (dot + label + running count per stage; done=emerald, active=pulsing blue, pending=dim, skipped=faint) — stages: Signals → AI Diagnosis → Options → Business Impact → Policy → Human Approval → Execution → Outcome.
   - A scrolling **live activity feed** (monospace, timestamped, newest-first-is-wrong — this one appends and auto-shows the tail — color-coded by stage per the narration rules in the table below), capped to the last ~300 events in memory / ~80 rendered.
4. **Command Center table card** — header with title + a row of status filter pills (All / Awaiting Approval / Recovered / In Progress / Escalated / Stopped / Open — active pill emerald-filled). Table columns: Customer (avatar+name+tier+attempt count, links to case), Amount, Risk (label only), AI Confidence (selected recovery probability, color banded green/amber/red by 70%/40% thresholds, em-dash if not yet scored), Recommended Action (badge, em-dash if none), Status (dot+badge), row-hover "Investigate →" link.

**Data sources:** `GET /api/batches`, `GET /api/batches/:id`, `GET /api/cases?batchId=...&limit=200`, then `POST /api/batches` to create, `POST /api/batches/:id/run` (SSE) to run.

**States:**
- *No batches yet*: selector shows "No batches yet"; Run button disabled; table shows "No cases match this filter — create or select a batch to get started."
- *Batch selected, not yet run*: KPI cards all zero/dash-equivalent (open count only); table shows cases with status `open`, no action/confidence yet (em-dashes).
- *Running*: Live Run Panel visible and animating; table + KPIs poll every 2s in the background so they visibly update mid-run (don't wait for completion).
- *Loading cases*: table body replaced with a centered "Loading cases…" message.
- *Complete*: success toast "Batch run complete"; final poll refresh.
- *Error* (run throws): error toast with the raw error message; running state cleared; whatever completed so far stays visible (never roll back to a blank state on error).

**Live-event narration copy** (reuse verbatim — this is an established pattern, extend it the same voice for any new stage you surface):

| stage | Example line | Color |
|---|---|---|
| queued | "Queued — {name} · {amount} · {risk label}" | zinc |
| detect | "Loading signals — {name}" | zinc |
| root_cause | "Diagnosed — {name}: {category} ({recovery odds} recovery odds)" | blue |
| recommend | "AI recommends — {name}: {action}" | blue |
| business_impact | "Business Impact Engine selected — {name}: {action} (ERV {amount})" | emerald |
| policy (escalate) | "Policy escalated — {name}: routed to human approval" | amber |
| policy (allowed) | "Policy approved — {name}: proceeding with {action}" | emerald |
| policy (blocked) | "Policy blocked — {name}: {action}" | amber |
| execute | "Executing — {name}: {action}" (+ "via real Razorpay link" if `provider === razorpay`) | violet |
| verify (verified) | "Recovered — {name}: {amount} confirmed" | emerald |
| verify (not) | "Not yet recovered — {name}" | zinc |
| escalate | "Escalated to human — {name}" | violet |
| stop | "Stopped — {name}: not worth pursuing further" | red |
| defer | "Deferred — {name}: cooldown active" | zinc |
| error | "Error — {name}: {error}" | red |

---

### 7.2 Case Investigation (`/cases/:id`) — `[EXISTS, major extension required]`

**Purpose:** the single most important page — a complete, transparent record of everything the system knew, thought, and did about one case. This is where all 8 Agent Command Center features become concretely visible for a real decision.

**Layout — existing structure to preserve, in order:**
1. Back link to Command Center.
2. Hero: avatar+name+id+email+tier, risk-type badge, status badge (dot+label).
3. Stat chips row: Amount at risk, Contact attempts, Days since failure, Final action.
4. **Pipeline Stepper** (same 8-stage component as §7.1, but statuses derived from this case's actual stored data, not live events — done/active/pending/skipped logic already exists and should be preserved as-is).
5. **`DecisionComparison`** ("How This Decision Was Made") — the flagship 3-card AI-vs-Engine-vs-Policy comparator (only rendered once there's a root cause or a selected impact score). Keep this component and its visual language (divergence arrows turn amber + relabel "overridden"/"blocked" when the three voices disagree) exactly as-is; every new section below should feel like it belongs next to this, not compete with it.
6. Pending-approval banner (amber) with Approve/Reject buttons, only when an approval is pending for this case.
7. Two reasoning cards side by side: Root Cause Diagnosis (cause text, category/recovery-band/confidence mono readout, evidence bullets, model name footer) and AI Recommendation (action badge, evidence bullets, model name footer).
8. Deep-dive tabs: Impact Ledger, Evidence, Policy Checks, Execution, Audit Trail.

**`[NEW]` additions — insert as follows:**

**A. "Why Not To Act" card** ⭐ — insert **immediately after the `DecisionComparison` block**, before the pending-approval banner. Render **only** when `noActionDecision` is present (i.e. final decision was `stop`/`no_action`/`wait_and_retry`). Design this with real visual weight — it is the product's signature feature, not a footnote:
- A distinct card treatment (suggest: a subtly different border/glow than other cards — e.g. a thin amber-to-zinc gradient border, or a small "eye-with-slash"/"shield" icon eyebrow reading "Why Not To Act") containing:
  - The reason code as a human-readable label (map the 7 codes to short labels, e.g. `active_promise_exists` → "Active promise-to-pay", `communication_fatigue_risk` → "Contact fatigue risk", `cost_exceeds_value` → "Cost exceeds value", `insufficient_confidence` → "Low diagnostic confidence", `likely_natural_recovery` → "Likely to self-resolve", `already_contacted` → "Already contacted", `other` → "Other").
  - The full `explanation` sentence (already human-readable prose from the backend — display verbatim).
  - A small "Alternatives considered" strip listing each `alternatives_considered[]` entry (`{action, erv}`) as a mini badge+ERV pair, so a viewer can see this wasn't a default — real alternatives were priced and rejected.

**B. Agent Proposals & Conflicts section** — insert as a new tab, or a section above the tabs (recommend: **new tab, "Agents"**, placed first in the tab order since it now precedes the impact ledger conceptually). Contents:
  - Two proposal cards side by side (`ai_recovery_agent` and `channel_strategy_agent` — label them "AI Recovery Agent" and "Channel Strategy Agent"): agent name, proposed action badge, proposed channel (if any), confidence (mono %), rationale text.
  - If `agentConflicts` is non-empty: a conflict banner per conflict — conflict type (human label: `duplicate_action`→"Duplicate action", `conflicting_action`→"Conflicting action", `competing_channel`→"Competing channel", `contradictory_strategy`→"Contradictory strategy"), the `detail` message text, and — once resolved — which proposal won (cross-reference by id into the two cards above, e.g. highlight the winning card with a small "SELECTED BY ERV ENGINE" tag) or a "not yet resolved" state if `resolution` is null.
  - If exactly one proposal exists or none, show the section but note "single-agent case" / "no proposals recorded" rather than hiding it — consistency matters for auditability.

**C. Shared Memory strip** — a compact, single-row summary (not a whole tab) placed just under the two reasoning cards (§7.2 step 7), reading e.g. "Customer history: 3 prior cases · last: *{decision_memory summary text of most recent entry}*" with a "View full history →" affordance that opens the **Customer Memory drawer** (§7.6). If `customerHistory` is empty, show "No prior recovery history for this customer" (still render the strip — don't hide it — so its absence is legible, not silent).

**D. Voice & Promises tab** — new tab, shown only when `voiceInteractions.length > 0` (a case that never went through `voice` simply doesn't get this tab — don't render an empty one). For each voice interaction: call status badge, outcome badge, duration, transcript summary, and:
  - If `audio_url` is present: an inline HTML `<audio controls>` player with a small "Real ElevenLabs audio" badge (teal, matches the voice action color) — this is one of the real-vs-simulated distinctions from §10 and must be visually marked as genuine, not decorative.
  - If `audio_url` is null: a muted "Simulated call — no audio artifact" caption, no player.
  - Any linked `promises_to_pay` row directly beneath its interaction: promised amount, promised date, status badge (`pending` amber / `kept` emerald / `broken` red).

**E. Scheduled Actions** — fold into the existing **Execution** tab as a third sub-section (below Executions and Verifications), only rendered when `scheduledActions.length > 0`: action type badge, scheduled-for datetime, status badge, reason text.

**F. Audit Trail tab → rename/reframe as "Decision Graph"** — keep the existing chronological list rendering (timestamp, event_type, actor badge, detail JSON) but add, at the top of the tab, an **integrity indicator**: a small badge reading "Chain verified ✓" (emerald) when `auditChainIntegrity.intact === true`, or "Chain integrity issue at event #{n}" (red, with a tooltip explaining hash-chain tamper-evidence) when false. Also: color-code each row's `actor` badge consistently with the rest of the app's actor vocabulary (suggest: `ai_agent`/`reasoning_engine` blue, `policy_engine`/`conflict_engine` amber, `impact_engine`/`candidate_engine` emerald, `human` violet, `system` zinc) so the trail reads as a story of *who* did what, not an undifferentiated log.

**Data source:** `GET /api/cases/:id` (extended shape, §5.2).

**States:**
- *Case not found*: Next.js `notFound()` → default 404 page (already implemented, keep).
- *No decisions yet* (very early in pipeline): reasoning cards show "Not yet diagnosed." / "No recommendation yet." (existing copy, keep); DecisionComparison block doesn't render at all; new sections (Why Not To Act, Agents tab, Voice tab) simply don't render rather than showing empty placeholders, **except** the Shared Memory strip and the Decision Graph tab, which should always render (with their own empty-state copy) since "no history" and "no audit events yet" are meaningful states worth stating explicitly.
- *Pending approval*: banner + buttons as today; disable both buttons while a request is in flight, replace label with "Approving…"/"Rejecting…", toast on success/failure, `router.refresh()` after.

---

### 7.3 Approval Queue (`/approvals`) — `[EXISTS, minor extension]`

**Purpose:** everything currently routed to a human, in one worklist.

**Layout:** back link; header ("Human-in-the-loop" eyebrow, H1 "Approval Queue", description) with a right-aligned pending-count+total-at-risk chip (amber) when non-empty; empty state ("No cases currently awaiting approval.") when zero; otherwise a stacked list of cards, each: customer identity (links to case), risk badge, tier, amount, timestamp, the same `DecisionComparison` triple (with `finalAction` fixed to `"escalate"` since that's definitionally why it's here), and Approve/Reject buttons.

**`[NEW]`** Where the case's `agentConflicts` includes an *unresolved* conflict, add a small inline note on the card (e.g. a violet "Agent conflict pending" chip next to the risk badge) so a reviewer knows this escalation also involves a disagreement between agents, not just a policy threshold — link it through to the case page's Agents tab.

**Data source:** `GET /api/approvals?status=pending`.

**States:** loading is implicit (server component, no client spinner needed today — keep that pattern); empty state as above; approve/reject are per-card async actions identical to the case page's `ApprovalActions` component (reuse it, don't duplicate).

---

### 7.4 Portfolio Priority (`/portfolio`) — `[NEW]`

**Purpose:** surface the **Portfolio-Level Priority Optimizer** — "if you can only work N cases right now, work these, in this order." This is currently invisible; the backend ranks opportunities but nothing displays the ranking.

**Layout:**
1. Header: eyebrow "Portfolio Optimization", H1 "Priority Queue", one-line description ("Ranked by where your next action creates the most recoverable value — not just by amount.").
2. A batch selector (same pattern/component as the Command Center's — reuse it) since ranking is batch-scoped.
3. A KPI mini-strip: total open opportunities in this batch, sum of ERV across the top 10, average days-since-failure of the top 10 (illustrates the urgency-weighting story).
4. Ranked table: rank number, customer (avatar+name, links to case), risk type badge, amount, days since failure (color-intensify as it grows — e.g. plain → amber → red past some threshold like 30/60 days, purely a visual cue, no new logic), recovery probability (same color-banding as the Command Center table), ERV, **Priority Score** (bold, this is the sort key — visually the most emphasized numeric column), status badge.
5. Optional but recommended: a "why is this ranked here" tooltip on the priority score column header explaining the ERV × urgency-multiplier formula in one sentence (reuse the backend's own doc comment language: "Expected Recovery Value adjusted by an urgency factor that grows the longer a case has aged, up to +50% at 60+ days").

**Data source:** `GET /api/batches` (for the selector) + `GET /api/batches/:id/portfolio` (§5.2).

**States:**
- *No batch selected*: prompt to pick one (reuse Command Center's selector default text).
- *Batch has no scored cases yet*: "Run this batch first — nothing has been prioritized yet." with a link back to `/` (don't duplicate the Run control here; this page is a *view*, not a second place to trigger runs).
- *Loading*: skeleton rows (reuse the existing `Skeleton` component) or the same "Loading…" text pattern used elsewhere — stay consistent with existing pages' loading copy style rather than inventing a new one.
- *Populated*: table as above, capped/paginated if a batch has >200 cases (reuse `limit`/`offset` conventions from the cases API — same param names for consistency even if the portfolio endpoint doesn't paginate server-side yet, this keeps the frontend contract future-proof).

---

### 7.5 Conflicts (`/conflicts`) — `[NEW]`

**Purpose:** surface **Agent Conflict Detection** as a first-class, cross-case governance view — "where are the two agents actually disagreeing, and how did we resolve it." This makes the multi-agent architecture visible and auditable at a glance, not just discoverable one case at a time.

**Layout:**
1. Header: eyebrow "Agent Governance", H1 "Conflicts", description ("Every disagreement between the AI Recovery Agent and the Channel Strategy Agent, and how the Business Impact Engine resolved it.").
2. Filter pills: All / Unresolved / Resolved (client-side filter over `resolution === null` vs not, or server-side via the `resolved` query param — either is fine, prefer server-side to match the `/api/cases` pattern already established).
3. Optional secondary filter: by conflict type (four pills matching the four `ConflictType` values, human-labeled per §4).
4. A feed of conflict cards (not a table — these are narratively richer than tabular rows), each:
   - Customer identity + amount + risk badge (links to `/cases/:id`), timestamp.
   - Conflict type badge (violet family, distinct from action-type badges to avoid visual confusion).
   - The two (or more) proposals shown side-by-side in miniature (agent name, action badge, confidence) — visually echo the case page's Agents section so the pattern is recognizable.
   - Resolution: if resolved, a clear "→ Resolved: {winning agent}'s {action} selected by ERV Engine" line (emerald); if unresolved, an amber "Pending resolution" tag.
   - The raw `detail` message as a smaller, muted caption line — it's already good human-readable prose from the backend, don't discard it.

**Data source:** `GET /api/conflicts` (§5.2), optionally scoped with a batch selector identical to §7.4's (reuse component).

**States:**
- *No conflicts at all*: "No agent conflicts detected yet — the two agents have been in full agreement, or no batch has run." (this is a *good* outcome, don't phrase it as an error/empty-failure state).
- *Filtered to zero*: "No conflicts match this filter." distinct copy from the true-empty state above.
- *Loading*: consistent with other list pages.

---

### 7.6 Customer Memory drawer `[NEW]` — not a page, a slide-over/dialog

**Purpose:** surface **Shared Agent Memory** in full, opened from the Shared Memory strip on the Case Investigation page (§7.2-C) or from any customer name elsewhere the product wants to offer it later.

**Trigger:** "View full history →" affordance on the Shared Memory strip. Implement as a `Sheet` (slide-over from the right — the codebase already has this shadcn component available) rather than a full navigation, since it's supplementary context to whatever case the operator is currently investigating and shouldn't lose their place.

**Contents:**
- Header: customer name/id, "Recovery history" subtitle.
- A reverse-chronological list of `decision_memory` entries, each: the `summary` sentence (already fully-formed prose from the backend, e.g. "failed payment case resolved via payment link — ₹499.00 recovered."), a small badge for `final_action`, a verified/not-verified indicator, timestamp, and a link to that entry's case (`/cases/:caseId`) so the operator can jump straight to any prior case.
- If `activePromise` data is available for the current case context, surface it pinned at the top of the drawer ("⚠ Active promise-to-pay: ₹X by {date}") — this is the single most operationally important fact a Shared Memory view can surface (it's literally why the Communication Governor blocks contact).

**Data source:** the `customerHistory` array already embedded in the extended case-detail response (§5.2) — no extra fetch needed when opened from a case page. Only call `GET /api/customers/:customerId/history` directly if the drawer is ever opened without that context already in memory.

**States:** empty ("No prior recovery history for this customer — this is their first case.") is common and completely normal, not an error.

---

## 8. Shared Components Inventory

Reuse these exactly (they exist and are correct) — do not rebuild parallel versions:

| Component | Role |
|---|---|
| `PipelineStepper` | The 8-stage dot+label+connector stepper, used both live (Command Center) and static/derived (Case Investigation). |
| `DecisionComparison` | The 3-card AI/Engine/Policy comparator with divergence-highlighting connectors. The single most important visual pattern in the product — every new "here's what N different reasoners concluded" surface (e.g. Agent Proposals) should visually rhyme with this, not invent a new comparator style. |
| `KpiCards` | The 6-stat KPI strip pattern — reuse its card shell (`rounded-xl border p-4`, label/icon row, mono value, optional sub-caption) for any new KPI strip (Portfolio, Conflicts). |
| `CommandCenterTable` | The customer-row table pattern (avatar+name+meta, badges, mono numbers, hover-reveal "Investigate →") — reuse this row shell for the Portfolio ranking table. |
| `LiveRunPanel` | SSE-driven live view — the pattern (pipeline stepper + scrolling narrated feed) to follow for any future live-streaming surface. |
| `ApprovalActions` | Approve/Reject button pair with busy-state + toast + `router.refresh()` — reuse verbatim on the Approval Queue and Case page, don't reimplement. |
| `NewBatchDialog` | Modal batch-creation form — reuse its shell for any future creation dialog. |
| display helpers (`formatInr`, `formatInrPrecise`, `formatInrCompact`, `initials`, `avatarTint`, `confidenceColor`, and the `*_LABEL`/`*_COLOR`/`*_DOT` lookup tables for every enum) | The single source of truth for all label text and badge colors — **every new page must use these same lookups**, extended (not replaced) with entries for any new enum introduced by this document (conflict types, no-action reason codes, decision categories, governor decisions — see §14 for the values to add). |
| `activity-narrative.ts` (`narrateEvent`) | The copy-generation logic behind the live feed — extend its `switch` with any new stage rather than writing narration inline in a component. |
| `pipeline.ts` (`nodeToPipelineStage`, `caseStageStatuses`) | Central mapping from internal node names to the 8 external stages, and from a case's stored data to per-stage done/active/pending/skipped — reuse for any new place that needs to show pipeline progress. |

**New components to build**, matching the above patterns' visual language (not prescribing exact markup, since this is a spec, not code):
- **Why Not To Act card** (§7.2-A) — a distinctive, elevated card treatment; this is the one place a genuinely new visual motif is warranted, since it's the flagship feature.
- **Agent Proposal card** (§7.2-B) — echoes `DecisionComparison`'s `DecisionCard` sub-component styling (icon eyebrow, action badge, mono detail line).
- **Conflict card** (§7.5) — composed from two Agent Proposal cards + a resolution line.
- **Portfolio rank row** — extends `CommandCenterTable`'s row shell with a rank number and priority-score column.
- **Voice player row** (§7.2-D) — call metadata + conditional `<audio>` element + real/simulated badge.
- **Customer Memory drawer** (§7.6) — a `Sheet`-based list of decision-memory entries.
- **Chain-integrity badge** (§7.2-F) — a single small emerald/red badge with tooltip.

---

## 9. Interaction & State Patterns

Apply these consistently across every page, existing and new:

- **Loading:** prefer a plain centered muted-text message matching existing copy style (`"Loading cases…"`) for simple table/list loads; use the `Skeleton` component only where a layout needs to visibly hold its shape (e.g. KPI cards while their batch hasn't loaded yet) — don't mix both styles on one page.
- **Empty (no data, not an error):** always a specific, calm, one-line sentence explaining *why* it's empty and what to do next (e.g. "No cases match this filter — create or select a batch to get started.") — never a bare "No data" or a spinner that never resolves. Distinguish "truly nothing exists yet" from "your filter matched nothing" with different copy (see §7.5).
- **Error (request failed):** `sonner` toast with the raw server error message (the backend already returns human-readable `{ error: string }` bodies — surface them verbatim, don't paraphrase) — never a full-page error boundary for a single failed fetch; the rest of the page keeps whatever data it already has.
- **Success / mutation feedback:** `sonner` toast confirming what happened in plain language ("150-case batch seeded", "Batch run complete", "Approved — executing", "Rejected — case stopped") — keep this exact tone (short, past-tense, specific) for any new mutation (e.g. a future "conflict acknowledged" action, if ever added).
- **Live/streaming data:** only the Command Center's batch run is truly live (SSE). Everywhing else — Portfolio, Conflicts, Case detail — is request/response; do **not** add polling to these new pages beyond what's specified (the Command Center already polls its table every 2s during a run; that pattern is sufficient and shouldn't be copied onto pages with no active run).
- **Navigation feel:** case rows/cards are always fully clickable (not just an icon), and every list card that represents "one case" (Approval Queue cards, Conflict cards, Portfolio rows) must link through to `/cases/:id` — the Case Investigation page is the canonical "drill all the way down" destination for everything in this product.
- **Numbers:** always `font-mono tabular-nums`, always through the shared `formatInr*` helpers — never hand-roll a `₹${n}` string in a new component.
- **Confidence/probability bands:** always through `confidenceColor()` (≥70% emerald, ≥40% amber, else red) — apply this same banding to any new probability-shaped number (e.g. proposal confidence) for visual consistency, not a new threshold set.

---

## 10. Real vs. Simulated Visual Language

This is a recurring, deliberate product value — the UI must never let a simulated artifact look indistinguishable from a real one. Apply consistently:

| Signal | Real | Simulated |
|---|---|---|
| Execution provider (`executions.provider`) | `razorpay`/`resend` → show provider name, link/reference id | `simulated` → muted, no external reference implied |
| Verification source (`verifications.source`) | `webhook` → "Real Razorpay webhook" | `simulated_trigger` → "Demo simulated"; `poll` → "Poll" |
| Voice audio (`voice_interactions.audio_url`) | present → audio player + "Real ElevenLabs audio" badge (teal) | null → "Simulated call — no audio artifact", no player |
| Batch run | always genuinely live (SSE) — there is no precomputed/replay mode in this product; do not build one, and do not let any page imply a run is live when it's actually just re-displaying historical rows (e.g. re-opening a completed batch's Command Center table is clearly *historical* browsing, not "live" — never show a pulsing "live" indicator outside an actual active SSE connection) | — |

This table is exhaustive of today's real/simulated boundaries — if a future integration is added, extend this table and its visual treatment rather than inventing a new pattern per-feature.

---

## 11. Responsive & Accessibility Requirements

- **Breakpoints:** the existing pages use `md:`/`lg:` Tailwind breakpoints for grid column counts (2→3→6 for KPIs, 1→5-part grid for DecisionComparison). New pages should follow the same breakpoint philosophy: mobile-first single column, expanding at `md`/`lg`.
- **Tables on narrow viewports:** wrap in `overflow-x-auto` (already the pattern) rather than collapsing to cards — keep this consistent for the new Portfolio table.
- **Tooltips:** used sparingly today (pipeline stage hints) via the shadcn `Tooltip` with a 200ms delay — reuse for any new hover-explainable element (e.g. the priority-score formula, the chain-integrity badge) rather than inline help text cluttering the layout.
- **Color is never the only signal:** every status/action/risk badge pairs color with a text label (already the pattern — preserve it; e.g. the chain-integrity badge must say "verified"/"issue," not just show green/red).
- **Keyboard/focus:** rely on shadcn/`@base-ui` primitives' built-in focus management for dialogs, sheets, tabs, tooltips — don't override.

---

## 12. Non-Goals / Explicitly Out of Scope

- **No authentication/login UI, no multi-user roles.**
- **No real outbound telephony UI** (no "dial," no live call controls) — voice is TTS-audio-artifact-plus-simulated-outcome only (§10); do not design for a future real-calling feature.
- **No payment-collection UI** — the product never takes card/bank details from anyone; Payment Links are Razorpay-hosted, opened externally.
- **No mobile app** — responsive web only.
- **No settings/configuration UI** for policy thresholds, LLM provider, or API keys — these are backend env/config, not user-editable. (A read-only "System Status" strip showing which integrations are live is a nice-to-have if time allows, but is not required by this spec — do not treat it as a blocking page.)
- **No light mode / theme switcher.**

---

## 13. Implementation Notes for the Builder

- If building fresh (not extending the existing repo), still target the exact stack in §2 — this is a hard constraint from the product owner, not a suggestion.
- The 5 endpoints marked `[EXISTS]` in §5.1 are real, tested, and stable — build against their documented shapes with confidence. The endpoints marked `[NEW]` in §5.2 do not exist yet as routes today, though every one of them wraps an already-implemented, already-tested backend function (`getPortfolioRanking`, `verifyChain`, the existing table reads) — so they are low-risk to add, not speculative new business logic. If the builder cannot add backend routes, stub these with realistic mock data matching the documented shapes so the frontend can be built and demoed against fixtures, then swapped to live data with zero component changes.
- Every enum used anywhere in the UI (risk types, action types, case statuses, conflict types, reason codes, decision categories, governor decisions, audit actors, audit event types) has a **complete, closed list** in §14 below — there are no "other" values to design around defensively (except the `no_action_decisions.reason_code` value literally named `other`, which is itself one of the closed seven).
- Treat the `DecisionComparison` component and the Why Not To Act card as the two most important visual moments in the product — if time is constrained, prioritize polish there over the newer list pages (§7.4/§7.5), which can start simpler (plain tables) and still fulfill this spec.

---

## 14. Appendix — Full Reference Data

### 14.1 Core entity fields (plain reference, not code)

**Case:** id, batch_id, seq, customer_name, customer_id, customer_email, customer_tier (`retail`/`smb`/`b2b`), amount, currency, risk_type, contact_attempts, days_since_failure, is_synthetic, status, final_action, signal_id, created_at, updated_at.

**Batch:** id, name, seed, concurrency, total_cases, total_at_risk, total_expected_recovery_value, total_recovered, status (`pending`/`running`/`completed`/`failed`), started_at, completed_at, created_at, updated_at.

### 14.2 Enum reference tables (label text + suggested color family — extend the existing `display.ts` lookups with these)

**Risk type** (`RISK_TYPE_LABEL`/`RISK_TYPE_COLOR` — already complete, no new values):
`failed_payment` (red) · `checkout_abandonment` (orange) · `subscription_failure` (violet) · `overdue_receivable` (amber)

**Action type** (`ACTION_LABEL`/`ACTION_COLOR` — already complete, no new values):
`retry` (sky) · `payment_link` (emerald) · `reminder` (cyan) · `wait_and_retry` (zinc) · `escalate` (violet) · `stop` (red) · `voice` (teal) · `no_action` (zinc/faint)

**Case status** (`STATUS_LABEL`/`STATUS_COLOR`/`STATUS_DOT` — already complete):
`open` (zinc) · `in_progress` (blue) · `awaiting_approval` (amber) · `escalated` (violet) · `stopped` (zinc) · `recovered` (emerald) · `closed` (zinc/faint) · `failed` (red)

**Decision category** `[NEW — add to display.ts]`: `ACT` (emerald) · `WAIT` (zinc) · `ESCALATE` (violet) · `NO_ACTION` (zinc/faint) · `STOP` (red)

**Conflict type** `[NEW — add to display.ts]`: `duplicate_action` → "Duplicate action" (zinc) · `conflicting_action` → "Conflicting action" (amber) · `competing_channel` → "Competing channel" (amber) · `contradictory_strategy` → "Contradictory strategy" (red)

**Conflict resolution** `[NEW]`: `selected_winner` → "Resolved by ERV" (emerald) · `blocked_all` → "All blocked" (red) · `deferred` → "Deferred" (zinc) · `null` → "Pending" (amber)

**No-action reason code** `[NEW]`: `likely_natural_recovery` → "Likely to self-resolve" · `already_contacted` → "Already contacted" · `active_promise_exists` → "Active promise-to-pay" · `communication_fatigue_risk` → "Contact fatigue risk" · `cost_exceeds_value` → "Cost exceeds value" · `insufficient_confidence` → "Low diagnostic confidence" · `other` → "Other" (all amber/neutral family — these are explanatory, not alarming)

**Governor decision** `[NEW]`: `ALLOW` (emerald) · `DELAY` (amber) · `BLOCK` (red)

**Voice call status**: `completed` · `no_answer` · `voicemail` · `declined`
**Voice outcome**: `promise_to_pay` (emerald) · `refused` (red) · `callback_requested` (amber) · `no_response` (zinc) · `resolved` (emerald)
**Promise-to-pay status**: `pending` (amber) · `kept` (emerald) · `broken` (red)
**Scheduled action status**: `pending` (amber) · `executed` (emerald) · `cancelled` (zinc)

**Audit actor** (extend consistently — see §7.2-F for suggested color mapping): `ai_agent`, `reasoning_engine` (blue) · `policy_engine`, `conflict_engine` (amber) · `impact_engine`, `candidate_engine` (emerald) · `human` (violet) · `system` (zinc)

### 14.3 Pipeline stage mapping (internal node → external 8-stage narrative)

| Internal node(s) | External stage shown to users |
|---|---|
| `queued`, `detect` | Signals |
| `root_cause` | AI Diagnosis |
| `recommend` | Options |
| `business_impact` | Business Impact |
| `policy` | Policy |
| `escalate` | Human Approval |
| `execute` | Execution |
| `verify`, `stop`, `defer` | Outcome |

(Note: `agent_proposals` and `shared_context_conflict` are internal nodes that run between `recommend` and `business_impact` but are **not** separately represented in the 8-stage stepper — their output surfaces instead in the Case page's Agents tab and Shared Memory strip, §7.2. Do not add stepper stages for them; the 8-stage narrative is intentionally a simplified external view.)

### 14.4 Policy rules (deterministic — for reference/tooltip copy only, not configurable in the UI)

| Rule name | Threshold | Effect when failed |
|---|---|---|
| `BOUNDED_EXECUTION` | ≥ 5 prior executions on this case | → `stop` |
| `NO_REPEATED_HARASSMENT` | ≥ 5 prior contact attempts | → `stop` |
| `STOP_ON_NEGATIVE_ERV` | selected ERV ≤ 0 | → `stop` |
| `AMOUNT_ABOVE_AUTO_APPROVAL_LIMIT` | amount > ₹1,00,000 | → `escalate` (human approval required) |
| `MAX_RETRY_ATTEMPTS` | ≥ 3 attempts, action is `retry` | → `escalate` if amount ≥ ₹20,000, else `stop` |
| `MAX_COMMUNICATION_ATTEMPTS` | ≥ 3 attempts, action is `payment_link`/`reminder`/`voice` | → `escalate` if amount ≥ ₹20,000, else `stop` |
| `COOLDOWN_PERIOD_ACTIVE` | < 24h since last execution on this case | → `wait_and_retry` (non-terminal, deferred) |

All 7 rules always run and are always recorded (pass or fail) — the Policy Checks tab should always show all 7 rows, not just failures.

### 14.5 Canonical audit event vocabulary (the full Decision Graph event sequence)

`SIGNAL_DETECTED` → `CASE_CREATED` → `AI_DIAGNOSIS` → `AI_RECOMMENDATION` → `AGENT_PROPOSAL` (×2) → `SHARED_MEMORY_CHECKED` → `CONFLICT_DETECTED` → `CANDIDATE_ACTIONS` → `ERV_CALCULATED` → `GOVERNOR_CHECKED` → `POLICY_CHECKED` → [`WHY_NOT_TO_ACT` if applicable] → `FINAL_DECISION` → [`ESCALATED_TO_HUMAN` → `APPROVED`|`REJECTED`] | `ACTION_EXECUTED` → `OUTCOME_VERIFIED`

Also possible at any point: `DEFERRED`, `PROCESSING_FAILED`.

This is the exact, ordered story the Decision Graph tab (§7.2-F) should read as when a viewer scrolls through it top to bottom for a single case — it is worth designing that tab so this narrative arc is visually legible (e.g. via the actor-color-coding in §7.2-F), since it is effectively the product's proof-of-work for every decision it makes.
