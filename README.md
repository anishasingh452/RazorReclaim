# RazorReclaim

**An agentic revenue-recovery command center.**
Razorpay AI Buildathon — Track 03 (AI Revenue Recovery). Built by Anisha Singh.

---

## The problem I actually wanted to solve

Every payments business loses money in the gap between "the payment failed" and
"someone did something about it." The usual answer is a retry cron and a
three-email drip that fires at everyone identically. It recovers some money and
annoys a lot of customers, and nobody can tell you afterwards *why* a particular
customer got a particular message.

I wanted the opposite: a system that looks at each failed payment individually,
argues with itself about what to do, prices the options in rupees, refuses to act
when acting is worth less than silence, and leaves a tamper-evident record of the
whole argument.

That last part matters more than it sounds. A recovery agent that can't explain
itself is a liability, not a feature.

## What it does

You load a batch of at-risk revenue cases — failed payments, abandoned checkouts,
subscription failures, overdue B2B receivables — and press Run. For each case,
independently, the system:

1. **Detects** — pulls the raw signal (gateway decline code, checkout drop-off
   step, invoice age) and normalises it.
2. **Diagnoses** — an LLM reads the evidence and reasons about root cause.
   `LIMIT_EXCEEDED` on a card that worked five times last month is a very
   different problem from a hard `CARD_DECLINED`.
3. **Proposes** — two agents with genuinely different priorities each pick an
   action. The *AI Recovery Agent* optimises for recovering this rupee. The
   *Channel Strategy Agent* optimises for not burning the customer relationship.
   They frequently disagree. Disagreements are recorded as first-class
   `agent_conflicts` rows, not swallowed.
4. **Prices** — a **deterministic** Business Impact Engine scores every feasible
   action: `ERV = recoverable amount × recovery probability − intervention cost`.
   No LLM touches this number. The conflict is settled by expected value, and the
   losing proposal stays visible with its price next to it.
5. **Gates** — a **deterministic** Policy Engine runs seven guardrails
   (`BOUNDED_EXECUTION`, `NO_REPEATED_HARASSMENT`, `STOP_ON_NEGATIVE_ERV`,
   `AMOUNT_ABOVE_AUTO_APPROVAL_LIMIT`, `MAX_RETRY_ATTEMPTS`,
   `MAX_COMMUNICATION_ATTEMPTS`, `COOLDOWN_PERIOD_ACTIVE`). A guardrail can
   block an action outright or route it to a human.
6. **Escalates or executes** — anything above ₹1,00,000 or flagged by policy lands
   in an approval queue with the full reasoning attached. Everything else runs.
7. **Verifies** — execution isn't assumed to have worked. A Razorpay webhook (or
   an explicit demo trigger that calls the *same* verification function) confirms
   whether the money actually arrived.

Every one of those steps appends to a **SHA-256 hash-chained audit log**, one
chain per case from a `GENESIS` root. Change a historical row and the chain
breaks. That's the compliance story.

### The part I'm most attached to: "Why not to act"

Most recovery tools can only explain what they did. This one can explain what it
deliberately *declined* to do. When the best available action has negative
expected value — the customer churned, the cooldown is active, the intervention
costs more than the recovery is worth — the system produces a **No-Action
Decision**: a named reason code, a written explanation, and the list of
alternatives it priced before concluding silence was worth more than contact.

Not acting is a decision. It should be argued for, and it should be auditable.

## Features

| Feature | What it is |
|---|---|
| **Command Center** | Live batch execution over SSE — you watch cases move through the pipeline in real time, not a spinner and a result. |
| **Priority Queue** | Portfolio-level ranking by recoverable value weighted by how fast each case's recovery window is closing — not just by amount. |
| **Agent Conflicts** | Every disagreement between the two agents, with both proposals, both confidence scores, and how ERV settled it. |
| **Approval Queue** | Human-in-the-loop for high-value and policy-flagged cases. Approving resumes the graph from where it paused. |
| **Case Detail** | The complete decision record: evidence, root cause, both agent proposals, the full ERV ledger (including ruled-out actions and why), every policy check, the audit chain. |
| **Shared Agent Memory** | Customers recur across cases. Prior recovery history feeds the next decision — a customer who ignored two reminders is treated differently from a first-timer. |
| **Voice Recovery (ElevenLabs)** | For high-value B2B receivables, the agent writes a collections script and ElevenLabs synthesises it. Clear English by default, with Hindi and Hinglish available via `VOICE_LANGUAGE`. The audio is real and playable on the case page. |
| **Promises to Pay** | Voice interactions can produce a commitment date, which becomes a scheduled follow-up. |
| **Scheduled Actions** | `wait_and_retry` and deferred follow-ups are persisted as real scheduled work, not fire-and-forget. |
| **Interrupted-batch recovery** | If a run dies mid-batch, stuck cases are classified and safely resumed or reset on the next run — without duplicating a single executed action, and without ever rewriting the audit chain. |
| **Hash-chained audit** | Per-case SHA-256 chain over canonicalised JSON. Tamper-evident by construction. |

## What is real vs. what is simulated

I'd rather be boring and accurate here than oversell it.

**Genuinely real, hitting live third-party APIs:**

- **Razorpay Payment Links** — created against a real Razorpay **Test Mode**
  account. You can open the link, pay with a test card, and the webhook fires.
- **Resend emails** — real emails, actually delivered to a real inbox.
- **ElevenLabs TTS** — real synthesis of the script the agent actually wrote.
  Nothing pre-recorded, nothing canned.
- **LLM reasoning** — real calls to Gemini (or a local Ollama model).

**Simulated, and labelled as such in the UI:**

- **The voice *call*** — there is no telephony leg. ElevenLabs produces the audio;
  the *outcome* of the call (answered / promise-to-pay / no answer) is simulated.
- **Payment retries** — the `retry` action is modelled, not submitted to the
  gateway.
- **The demo payment trigger** — in a live demo you don't want to stop and pay a
  link by hand, so there's a button that re-checks it on demand. It cannot make a
  payment succeed: it calls the *exact same* `verifyPaymentLinkPaid()` the webhook
  calls, which asks Razorpay for the link's real status and records nothing unless
  Razorpay says paid. The only difference recorded is
  `verifications.source: 'simulated_trigger'` vs `'webhook'`, and the case page
  labels them "Demo-triggered on a real link" and "Real Razorpay webhook"
  respectively. (This was not true until late on — see *What broke at 2 AM*.)
- **The case data itself** — synthetic, generated to cover realistic scenario
  mixes. Customer emails are plus-addressed off one real inbox so the emails go
  somewhere you can actually check.

**Deliberately not LLM-driven:** ERV, all seven policy guardrails, priority
ranking, and the audit chain. If the model has a bad day, the money maths and the
compliance rails are unaffected. The LLM reasons; it does not decide what is
permitted or what things are worth.

## Architecture

```
Batch run (SSE)
  └─ Batch Orchestrator ── recovers interrupted cases first, then fans out
       └─ per case: LangGraph StateGraph
            detect → root-cause → agent-proposals → shared-context-conflict
                   → recommend → candidates → business-impact → policy
                   → final-decision → { execute | escalate | defer }
                   → verify
                        ↓ every node
                   append-only hash-chained audit_log
```

- **`src/lib/langgraph/`** — the per-case graph and its nodes.
- **`src/lib/agents/`** — the two competing agents and conflict detection.
- **`src/lib/impact/`** — the deterministic ERV engine and its economic config.
- **`src/lib/policy/`** — the seven guardrails and the communication governor.
- **`src/lib/candidates/`** — rules out structurally impossible actions before
  anything is scored (you can't `retry` an unpaid invoice).
- **`src/lib/why-not-to-act/`** — the no-action reason engine.
- **`src/lib/audit/`** — hash chaining and canonical JSON stringification.
  Keys are sorted and timestamps normalised, because Postgres `jsonb` doesn't
  preserve key order and a chain that depends on key order is a chain that
  breaks on the first round-trip.
- **`src/lib/orchestrator/`** — batch fan-out, concurrency limiting, and
  stuck-case recovery.
- **`src/lib/generator/`** — synthetic case generation with scenario coverage.
- **`supabase/migrations/`** — 18 tables across four migrations.

### Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui on
`@base-ui/react` · LangGraph · Supabase (Postgres) · Google Gemini / Ollama ·
Razorpay · Resend · ElevenLabs · Vitest

Streaming uses a held-open POST response body rather than `EventSource`, because
starting a batch needs a request body and `EventSource` can only GET.

## Setup

```bash
git clone <this repo>
cd razorreclaim
npm install
cp .env.example .env.local
```

Fill in `.env.local` — every variable is documented inline in `.env.example`.

Then create the database. Run the four files in `supabase/migrations/` in order,
in the Supabase SQL editor:

```
0001_init.sql
0002_recovery_action_architecture.sql
0003_agent_command_center.sql
0004_voice_audio.sql
```

Verify the schema landed, then start:

```bash
npm run verify-schema
npm run dev
```

Open http://localhost:3000, click through to the Command Center, and press
**New Batch** → **Run**.

Useful scripts:

```bash
npm test
npm run lint
npm run seed
npm run verify-schema
```

### A note on the LLM provider

`LLM_PROVIDER=ollama` runs `qwen3:8b` locally. It's free and completely private,
and it's what I developed against — but it takes roughly 90 seconds per call,
which is unusable in a live demo. `LLM_PROVIDER=gemini` takes about 1.3 seconds
per call and is the only option that works on Vercel, since a serverless function
has no local Ollama to talk to.

Gemini's free tier caps at 15 requests/minute, which will crawl on a 28-case
batch. Enable billing on the backing Google Cloud project and **set a budget
alert** — I capped mine, and you should cap yours.

## Testing, honestly

**What's covered well.** 145 unit tests across 17 files, all pure and fast (under
a second, no network, no database). They cover the parts where being wrong costs
real money or real trust: the ERV engine, all seven policy guardrails, the
communication governor, hash-chain integrity, conflict detection, the no-action
reason engine, priority ranking, the stuck-case recovery classifier, scheduled
actions, and the voice script builder.

A couple of those deserve calling out. The ERV suite includes a regression test
that recomputes every feasible row from its own stored inputs and asserts an
exact match — that test exists because of a bug described below. The stuck-case
suite includes an exhaustive sweep over every combination of inputs, asserting
that no combination can ever produce a "re-execute" verdict, because the failure
mode I actually feared was double-charging someone during recovery.

**What's covered by scripts rather than assertions.** The integration paths —
Razorpay, Resend, ElevenLabs, the full orchestrator, end-to-end audit-chain
integrity — are exercised by runnable scripts in `scripts/` (`test-razorpay.ts`,
`test-resend.ts`, `test-orchestrator.ts`, `verify-e2e-integrity.ts`, and others).
I ran full end-to-end batches repeatedly and used `verify-e2e-integrity.ts` to
check chain integrity across every case afterwards. That's real verification, but
it's manual verification, not CI.

**What isn't covered.** There are no component or browser tests — frontend
verification was done by hand, page by page. There's no CI pipeline. Auth doesn't
exist: this is a single-tenant demo and every route is open. I'd fix auth first
if this were going anywhere near production.

## What broke at 2 AM

Five bugs that were genuinely worth the sleep. All five are fixed; I'm keeping
them written down because how you find a bug is usually more interesting than the
bug itself.

**1. The dashboard could show ₹0 forever.**
The KPI numbers count up on load, driven by `requestAnimationFrame`. In a
backgrounded or throttled tab, rAF barely fires — so the sweep from zero would
stall and simply never reach the real number. Not "render late." Permanently
display ₹0, next to a static case count that was rendering correctly. That
mismatch is what gave it away: a live `0` sitting beside a correct `5` is
impossible unless the animation is the thing that's broken. Fixed by adding a
`setTimeout` settle that force-sets the true value once the animation duration
has elapsed, regardless of whether rAF ever ran.

**2. Simulated outcomes were labelled as demo-triggered.**
The verification node writes `source: 'simulated_trigger'` — and so does the demo
button in the UI. Same string, two completely different meanings. So a case the
*pipeline* had verified was being shown to the user as if I had clicked a button
to make it succeed, which is exactly the kind of thing that makes someone stop
trusting the whole demo. Fixed by disambiguating on the linked execution's
provider, so the label reflects what actually happened rather than a string two
code paths happened to share. Given that half this product's pitch is honest
labelling, shipping a misleading label would have been the worst possible bug.

**3. Shared Agent Memory had nothing to remember.**
The Shared Agent Memory panel — prior recovery history influencing the current
decision — was rendering "no prior history" on essentially every case. The
feature was fine. The data wasn't: the case generator assigned a random
`customer_id` per case, so with ~28 cases and random IDs, two cases almost never
shared a customer, and a memory feature with no repeat customers has nothing to
show. Fixed by generating from per-tier customer pools with a deliberate reuse
rate, so repeat customers occur at a realistic frequency. This one also produced
the generator's first tests, which it should have had from the start.

**4. ERV didn't reconcile with its own displayed probability.**
The Business Impact Engine priced ERV from a full-precision recovery probability
but *stored* that probability rounded to three decimals. So the UI would show
"32% likely × ₹1,13,153" and an ERV you could not reproduce from those two
numbers. Small, invisible unless you actually did the arithmetic — and fatal for
a product whose entire claim is that the money maths is deterministic and
auditable. Anyone who checked would have caught the system misreporting its own
working. Fixed by rounding first and then pricing from the rounded value, so the
stored number and the priced number are the same number. The regression test now
recomputes every feasible row and demands an exact match.

**5. The verification step didn't verify anything.**
The worst one, and the last one found. `verifyPaymentLinkPaid()` is the single
code path behind both the Razorpay webhook and the demo confirm button. It
looked up the execution, wrote `verified: true`, marked the case recovered,
credited the full invoice amount, and wrote a decision-memory row saying the
recovery had worked — **without ever asking Razorpay whether the link had been
paid.** The webhook path was still sound, because Razorpay only emits
`payment_link.paid` for a link it considers paid. The demo button was not: it
marked revenue recovered on demand.

It surfaced while I was building a demo case map and cross-checked the database
against the Razorpay API. Two cases claimed ₹7,140 recovered between them;
Razorpay reported both links as `created`, `amount_paid: 0`. Nothing in the app
disagreed with itself — the UI, the audit log and the KPIs all faithfully
reported a recovery that had never happened, which is exactly why it survived
so long.

The fix makes Razorpay the only authority on whether money moved: the function
now fetches the link, records nothing at all unless it comes back paid, and
credits Razorpay's own `amount_paid` rather than the invoice total, so a partial
payment can't be booked as a full recovery. The two false records were removed
and those cases returned to `in_progress`. For a product whose entire claim is
that outcomes are verified rather than assumed, this was the worst possible bug
to ship, and I nearly demoed it.

## Things I'd change with more time

- Auth and multi-tenancy. There is none.
- A durable LangGraph checkpointer. The stuck-case recovery I built is a
  well-tested workaround for not having one, but it's still a workaround.
- CI, and component-level tests for the frontend.
- A real telephony leg so the voice action completes end to end.
- The webhook is real and works, but nothing in the UI surfaces webhook activity —
  you have to look in the database to see it arrive.
