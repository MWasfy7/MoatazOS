# The 10× plan: from 43 branches to one product

2026-11-03. Written by Opus (Claude Code) from the repository's branches, PRs, backlog and run records.
**Approved by the owner on 2026-11-03**, including the private Donna Lab and the six decisions in section 7.

## 1. Where we are (the honest inventory)

**43 branches on GitHub, about 9 open PRs, and nothing merged to `main` since 2026-10-25.**

| Line of work | What exists | Who built it | State |
|---|---|---|---|
| SalesOS M0–M1C, Real Input, Decision Engine, Lead Loss Report | Clickable decision review, restraint (`NO_ACTION`), WhatsApp/CRM import, evidence → decision, loss report | Mostly unsigned `feat/` commits, Aug–Sep (most likely ChatGPT/Codex); merged | **On `main`** |
| SalesOS Operator Runtime (PR #8, #9, #10, #17, #22) | Command queue, ledgers, doctrine, Arabic mobile follow-up | Codex + Claude repair runs | Open since September. Blocked on reviews and the Vercel decision |
| ECHO, three versions | In-app runtime (`echo/build-0`, PR #12, ECH-05); private Windows agent `MWasfy7/ECHO`; Egyptian Whisper voice prototype | Claude, Codex, Jules (Gemini) | None merged; lineage decision OD-3 open since October |
| Donna, a stack of 5 | DON-01 merged; DON-02 store (14/14 live), DON-03 voice draft, DON-06 brief, DON-07 Talk, UI-01 home call | Claude (Opus) | Stacked and unmerged; no PRs for 06, 07 or UI-01 |
| Donna Council + ECHO hub | Manual 4-model council, ECHO linked into Donna | Claude + Codex | On `feat/donna-ai-council-mvp`, unmerged |
| Follow-up core + revenue metrics | One customer record, commitments, meetings, daily queue, metrics | Claude Sonnet (September) | Pushed today; one metrics branch still only on the PC |
| DON-05 deal bridge | Coordination record: link a Donna client to a SalesOS deal explicitly | Codex | Only on the PC |
| Reviews | Gemini product review, DeepSeek red-team, Jules PRs #11/#13 | Gemini, DeepSeek, Jules | Chat suggestions; #11 needs rework, #13 mergeable |
| Governance | Merge policy, dual-agent ownership, Balanced Mode, nightly runs | Claude | Mostly unmerged |

**Why we are slow. None of these is a coding problem:**
1. **No single target.** Five product lines move at once (SalesOS runtime, three ECHOs, Donna, follow-up,
   council), so every agent starts from a different base and work collides.
2. **Nothing lands.** One task per branch, drafts only and stacked branches are safe, but no merge rhythm means
   work piles up. Each new branch sits on five unmerged ones.
3. **Four brains for one question.** "Should I contact this client?" is answered by the Decision Engine,
   the Operator Runtime, `followUp` and Donna's `mind.ts`. "What did he mean?" is answered by ECHO and Donna.
4. **The rules forbid the product.** No model, no network, no sending, public repo. That made a safe
   demo. It also means every sentence Donna says is hand-written, so she can never feel alive.
5. **Decisions wait.** OD-2 (visibility), OD-3 (ECHO lineage), OD-4 (Vercel), the brain, hosting and
   messaging have been open for weeks. Agents correctly stop at each one.
6. **Coordination by copy-paste.** Handoffs travel through chats; there is no single board.

## 2. The product (one sentence)

**Donna: a chief of staff for an Egyptian real-estate salesperson, who remembers every client, reaches
you first, stops you from chasing, and drafts in your voice. You send.**

Everything else becomes a part of her:
- **SalesOS** is her judgment and your scoreboard.
- **ECHO** is her ears and voice.
- **revenueCore / followUp** is her memory.

## 3. The shape that makes 10× possible

Two repositories, one product:

| | Public `MoatazOS` (today's repo) | Private **Donna Lab** (new) |
|---|---|---|
| Purpose | The clean, safe face; the demo; the showcase | The real product |
| Brain | Deterministic rules | A language model understands and talks. Facts, prices and promises still come only from her memory |
| Voice | Browser voices | An original designed voice (not a copy of anyone) |
| Reaching you | Only when the app is open | Telegram first, then WhatsApp to **you only**, plus a morning brief on a schedule |
| Data | Synthetic only | Synthetic until the G6 privacy checklist passes, then yours |
| Speed | Draft PRs, slow gates | Trunk-based: small PRs merged daily after CI and a review by another agent |

What moves faster in the Lab:
- **She stops being hand-written.** A model replaces thousands of lines of rules.
- **Work lands every day,** so no pile of unmerged branches builds up.

## 4. The team: one lane each, never the same files

| Agent | Lane | Owns | Reviews |
|---|---|---|---|
| **Opus** (Claude Code) | Architect + Donna's brain and conversation; the merge train; final quality | `brain/`, `conversation/`, the plan and status board | Astra's PRs |
| **Astra** (ChatGPT) | Judgment and memory: one client record (DON-08), SalesOS decisions as a library, importers (WhatsApp, Excel), price book | `memory/`, `judgment/`, `import/` | Carbon's PRs |
| **Carbon** (Gemini, when released) | Senses and look: WhatsApp screenshots and voice notes → facts, chat-in/reply-out (DON-09), design and motion, long-document reviews | `senses/`, `ui/` | Opus's PRs |
| **Owner** | Product decisions; a 10-minute phone test each day; Friday demo sign-off | Decisions, priorities, real-world feedback | Everything that ships |
| Chat-only models (DeepSeek, Grok if added) | Red-team: blind tests of Donna's answers | — | Suggestions only |

Rules that remove collisions:
1. **One board:** `STATUS.md` at the repo root. Each agent ends every run by updating its row with branch, head
   SHA, what changed, tests run and the next task. This is Codex's handoff rule from DON-05, made permanent.
2. **Contracts first:** shared types (client, interaction, commitment, decision) are written once in week 1. After
   that the lanes build in parallel against them.
3. **Small PRs, merged the same day:** CI green + one other agent's review + the owner's tap. No stacks deeper than one.
4. **Usage caps:** when a model runs out, the next one continues from `STATUS.md` on its own branch.

## 5. The cadence

- **Monday (15 min):** the owner picks the week's 3 outcomes from this plan; Opus turns them into tasks per lane.
- **Every day:** each agent ships at most one PR; CI and a cross-review run. The owner spends 10 minutes on the
  phone with the build and sends one voice note of feedback.
- **Friday:** demo on the phone, merge train, and the plan is updated.

## 6. The next four weeks

| Week | Outcome the owner can feel | Lanes |
|---|---|---|
| **0 (this week)** | **Clear the desk.** Donna stack merged to `main` in one train; old PRs closed or parked; ECHO lineage = in-app; Lab created | Opus: merge train + Lab skeleton. Astra: close/park list, DON-08 contracts. Owner: 6 decisions below |
| **1** | **She talks for real.** The model brain on synthetic clients, in Egyptian Arabic and English, with the designed voice, on a hosted https link | Opus: brain + voice. Astra: one client record. Carbon: chat-in v0 |
| **2** | **She reaches you.** Morning brief on Telegram at 8:30; reminders before viewings; paste a client chat and get a reply draft | Opus: scheduler + Telegram. Carbon: screenshots/voice notes → facts. Astra: SalesOS check on every draft |
| **3** | **She knows the market and the score.** Price book with expiry, "what fits Gamma?", pace against EGP 500k and 50 calls | Astra: price book + scoreboard. Carbon: visual polish. Opus: blind test across models |
| **4** | **Your real week.** After the G6 privacy checklist, your own clients, a week of real use, and a list of what to fix | Everyone: fixes from real use |

## 7. Decisions (all approved 2026-11-03)

One thing to know: the Claude, ChatGPT and Gemini **subscriptions power the coding agents**, not the app. Donna's
brain and voice inside the product need **API keys**, billed per use. That is what the monthly budget covers.

1. **Private Donna Lab:** yes or no. (Recommended: yes.)
2. **Brain:** test Claude, GPT and Gemini (Grok optional) blind on 10 Donna moments; keep the winner, with the others
   as fallback. Monthly model + voice budget: suggest **$30–50** to start.
3. **Hosting:** a private https host (for example Vercel or Fly), needed for the phone microphone and for reaching you.
4. **Messaging:** Telegram first (fast, free), WhatsApp to yourself next (needs a separate number and Meta approval).
5. **ECHO:** the in-app runtime becomes Donna's ears; the private Windows agent stays a separate tool; the Whisper
   prototype continues until it beats 25% WER.
6. **Park list:** SalesOS Operator Runtime (#8, #9, #17), ECHO PRs #11, #12, #25, #26, #14. These are parked, not deleted,
   and their ideas move into Donna's lanes.

## 8. What "proud of it" means (the bar)

- You open it every morning without being told to.
- She catches a mistake you were about to make at least once a week.
- No forgotten promises for 30 days.
- A stranger (a second salesperson) can start using her in 10 minutes.
- Nothing is ever sent to a client without your tap.
