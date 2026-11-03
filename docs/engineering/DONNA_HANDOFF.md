# Donna handoff (2026-11-03)

For Astra, Carbon, or any agent continuing Donna. Read this first, then `AGENTS.md` (binding), then
`docs/product/DONNA.md` (who Donna is; the yardstick for every screen). No client data lives here.

## In one paragraph

Donna is the owner's personal chief of staff for real-estate sales: one salesperson, 20–60 active
clients, English and Egyptian Arabic. Today she is a voice-first web app. Opening the installed app is
answering her call ("Donna is calling…"). She speaks first (who to leave alone, then who to call), then
you talk or type and she answers from what she remembers, in the language you used. She stops
over-chasing, catches a price that contradicts what was told before, preps calls, and turns a spoken
debrief into a proposal that she files only when you say "file it". Everything is deterministic,
synthetic, local and proposal-only. She has a face, a voice and judgment. She is not yet connected to
the owner's real work (see "Missing layers").

## The owner's bar

- **Not data-entry screens.** He rejected earlier screens as "empty shells with no personality". Judge the
  work by whether she feels alive and useful on the phone. Show screenshots, not only test counts.
- **References:** the "Jarvis" assistants people build, and Donna Paulsen from *Suits*. She speaks first,
  knows everything, is very direct, and pushes back hard when ignored.
- **Restraint outranks every suggestion.** A client who asked for space is left alone, and she says so first.
- **Staged autonomy:**
  1. Drafts now.
  2. Sending after an explicit yes later (needs a written change to invariant 1).
  3. Small things alone eventually.
- **The owner's playbook**, already encoded in general form in `mind.ts`:
  - No fourth unanswered message.
  - One try after a missed call.
  - Deliver what you owe before asking for anything new.
  - Requests for space and personal blockers become holds.
  - Short message, one ask.
  - After a loss: "you did your part".

## Where the code is

All Donna work sits on unmerged, stacked branches, 24 commits ahead of `main`. Build on the tip.

| Order | Branch | Head | PR | Adds |
|---|---|---|---|---|
| 0 | `main` | `672f054` | merged #27 | DON-01: the unresolved "did you speak with them?" question |
| 1 | `claude/don-02-durable-records` | `4386a8b` | #28 | DON-02: optional Supabase store (synthetic only, off by default) |
| 2 | `feat/donna-ai-council-mvp` | `612567a` | none | Later DON-02 fixes, Today command center, approval-gated drafts, manual AI council, ECHO proposal-only runtime |
| 3 | `claude/auto-don-03-voice-draft` | `23eed34` | #29 (draft) | DON-03: dictation is checked before it is saved |
| 4 | `claude/auto-don-06-morning-brief` | `9801bfc` | none | DON-06: character brief, spoken morning brief, phone install |
| 5 | `claude/auto-don-07-talk-to-donna` | `68e4664` | none | DON-07: Talk to Donna |

**Branching:**
- Create your own branch from `claude/auto-don-07-talk-to-donna`; never commit to another agent's branch.
- One backlog task per branch.
- Open draft PRs that target that branch.
- The owner merges, from the bottom of the stack up.

## What exists, by layer

| Layer | What works | Where |
|---|---|---|
| Mind (pure, deterministic) | Intents in EN/AR. Call order: held clients named first and never picked. Before-call prep (deliver what you owe first). Message checks. A truth check against what was already told. Debrief → proposal → file. Pushback that grows when you insist. | `src/lib/donna/mind.ts`: `converse`, `understand`, `readDebrief`, `fileProposal`, `pickCalls`, `opening` |
| Text understanding | Arabic/English folding; client names however spelled; Egyptian money, percentages, years and bedrooms; spoken due dates; voice choice | `src/lib/donna/speech.ts` |
| Book | Temperature and drift per client: hot, warm, cooling, cold, held | `src/lib/donna/book.ts` |
| Morning brief | Restraint first, then promises, missing outcomes, cold leads, one gap question per client | `src/lib/donna/brief.ts`, `MorningBrief.tsx` |
| Outcome engine (DON-01) | The open "did you speak with them?" question, snooze, internal follow-up vs. client appointment | `src/lib/donna/engine.ts`, `QuestionFlow.tsx` |
| Dictation check (DON-03) | Do-not-contact language stops everything; a spoken note never creates an appointment | `src/lib/donna/voiceDraft.ts`, `VoiceReviewPanel.tsx` |
| Talk screen | Incoming call; canvas orb whose colour follows her mood; radar of the whole book; voice and text; EN/AR per turn; dossier, brief and proposal cards | `src/components/donna/talk/*`, route `/app-studio/donna/talk` |
| Voice | Browser speech only: one utterance per sentence, a female voice in the reply language, a written note when no voice exists | `talk/useDonnaVoice.ts` |
| State | Client profiles live in `DonnaProvider` memory, shared by the brief and Talk; a reload resets them | `src/components/donna/DonnaProvider.tsx` |
| Store (DON-02) | Supabase adapter for call events only, not profiles; off by default. Its live test passed 14/14 against the owner's synthetic Supabase project on 2026-10-31 (`docs/engineering/runs/2026-10-31-DON-02-next-step.md`) | `src/lib/donna/store.ts`, `src/lib/donna/remote/*` |
| AI status | Templates only; every model shows "not connected"; cost cap $0; manual AI council (the owner pastes four models' answers to a synthetic case) | `src/lib/donna/aiStatus.ts`, `council.ts` |
| Copy | Every string sits under `donna.*` / `donna.talk.*` in `src/lib/i18n/en.ts` and `ar.ts`; the Arabic is Egyptian colloquial | |
| Install | Manifest `start_url` is the Talk screen; shortcuts to Talk and the inbox | `src/app/manifest.ts` |

## How to extend her mind

1. Add an `Intent` in `understand()` in both languages. Test the Arabic spelling variants.
2. Answer with `Say` items (a closed union), never free text. Facts come only from `World`: state,
   profiles, now and names.
3. Render each new `Say` kind in `talk/sayText.ts`, using `donna.talk.says` in both `en.ts` and `ar.ts`.
4. Anything that changes memory is a `DebriefProposal` (`proposalOnly: true`,
   `externalSideEffect: false`) that the owner confirms.
5. Add tests to `tests/DonnaMind.test.ts` in both languages, plus a restraint case: a held client is
   still refused.

## Run and verify

- **Full gate:**
  `npm ci && npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e`.
- **Baseline at `68e4664`** (local Windows):
  - Typecheck and lint are clean.
  - 429 unit tests pass in 40 files.
  - The build passes.
  - Playwright passes 70/70, 35 per project. `mobile-arabic` ran on local WebKit. In cloud sessions it
    runs on Chromium, which is not WebKit evidence.
- **Phone on the same Wi-Fi:**
  1. Run `npx next dev -H 0.0.0.0 --port 3200`.
  2. Open `http://<pc-ip>:3200/app-studio/donna/talk` on the phone.

  This works at home only; hosting is an owner decision. The address is plain http, so the phone has no
  clipboard there (Copy buttons fail) and very likely no microphone; her voice and typing still work.
  Testing listening and copying on the iPhone needs an https address. Safari's speech recognition
  reportedly also needs Siri turned on.

## Gotchas already paid for

- **Animation and Playwright:** never animate a button Playwright must click. Animate a ring behind it instead.
- **Bidi isolates:** WebKit draws U+2068/U+2069 as boxes. Strings carry the isolates; render them through
  `Bidi` (`<bdi>`).
- **Arabic letter-spacing:** Tailwind `tracking-*` pulls Arabic letters apart. `globals.css` resets
  letter-spacing on `:lang(ar)`.
- **No regex lookbehind:** older iPhones lack it. `arWords` consumes a boundary group instead.
- **Folding keeps the text the same length,** so a match can be cut from the original words.
- **Canvas in tests:** jsdom has no canvas context. `DonnaOrb` guards for it and `DonnaTalk.test.tsx` mocks it.
- **Safety boundary:** `tests/SafetyBoundary.test.ts` forbids `fetch(`, absolute URLs, browser storage,
  `tel:`, `wa.me`, `window.open` and `process.env` in `src/`. Loosening it is an owner decision, not a fix.
- **`npm ci`:** never run it while a dev server or a test run is using `node_modules`.

## Not verified

- A real iPhone: Safari speech recognition in Egyptian Arabic, which voices exist, and home-screen install.
- A real microphone end to end, and spoken output on a device. Only the "Speaking" state was seen in a browser.
- The DON-02 sign-up allowlist proof (acceptance item 4) and the by-hand repeat on the owner's phone and
  laptop. The live test (item 3) passed on 2026-10-31.
- Anything with real client data. This is forbidden until gate G6.

## Outside this repository (owner's PC only)

- **The owner's ChatGPT export.** It holds real client names. It is not in the repo and must never be.
- **ECHO voice prototype:** `%USERPROFILE%\echo-voice`.
  - faster-whisper with an Egyptian large-v3 model; design note `ECHO_DONNA_HANDOFF.md`.
  - Accuracy so far: strict WER 37.3%, against the owner-accepted bar of 25%.
  - Not wired in: that needs an approved task and an invariant 8 exception.
- **LangGraph council prototype:** `%USERPROFILE%\donna-council-proto`.

## A second engine to converge with

`feat/follow-up-core` (`5c04c22`) has 3 commits dated 2026-09-22. It has been on GitHub since 2026-11-03,
with no PR, and it sits on an old `main`. It holds two modules.

`src/lib/revenueCore`:
- Stable customer ids that keep their phone history.
- Duplicate candidates that are never merged automatically.
- Buyer engagement that never counts seller activity.
- Consent where unknown is not the same as denied.
- Qualification evidence.

`src/lib/followUp`:
- Commitments.
- Meetings, where availability is not confirmation.
- Site visits, with post-visit and reservation stages.
- A daily queue ranked against the minutes available.

Donna models the same things in her own shapes:

| Donna today | revenueCore / followUp |
|---|---|
| `ClientProfile` | `CustomerRecord` + `RevenueOpportunity` |
| `promises` | `FollowUpCommitment` (party, due date, status) |
| Holds (asked for space, personal blocker) | `ChannelConsent` + `NO_CONTACT_RESTRICTION` |
| `lastContactAt`, `turn`, `unansweredMessages` | `Interaction` with `actorRole`, and buyer engagement |
| `pickCalls` | `rankDailyQueue` |
| Nothing | Meetings, site visits, reservation stages |

One client model instead of two is the first architecture task (DON-08 below).

## Where SalesOS and ECHO fit

`docs/product/DONNA.md` sets the roles:
- **Donna** is the one assistant.
- **ECHO** is her voice: how she hears and speaks, not a second assistant.
- **SalesOS** is the floor and manager view.

In the code, all three sit side by side. Donna does not use either of the others yet.

| Piece | What exists | Where | Link to Donna today |
|---|---|---|---|
| SalesOS Real Input | CRM CSV and WhatsApp export parsers → `NormalizedSalesEvent[]`; PII masking; memory-only | `src/lib/realInput` (`main`) | None |
| SalesOS Decision Engine | Evidence → decision (`NO_ACTION`, `NEXT_STEP_READY`, `INSUFFICIENT_EVIDENCE`, `CONTRADICTORY_EVIDENCE`); append-only, versioned; records chasing | `src/lib/decisionEngine` (`main`) | None |
| SalesOS Command Center, Lead Loss Report | Review screens (cards still come from fixtures, MOS-02); response, restraint and freshness metrics | `/app-studio/salesos/*` (`main`) | An opportunity page links to Donna's council, which reads the SalesOS fixtures |
| SalesOS Operator Runtime | Command queue (act now, commitments due, wait protected, at risk), learning ledgers, doctrine, Arabic mobile follow-up | PR #8, not on `main` (waiting on SOS-01, SOS-02, OD-4) | None |
| ECHO in-app runtime | Intent → context → confidence → proposal-only action, in English, Arabic, Franco-Arabic and mixed | `src/lib/echo` and the `/app-studio/echo` hub on this stack; the original line is `echo/build-0` + PR #12 (waiting on OD-3) | The hub links to Donna; Donna's `understand()` does not use it |
| ECHO desktop | Windows agent: SQLite memory, PowerShell app control, Codex/Claude command-line providers | Private repo `MWasfy7/ECHO` (OD-3). Never run it unattended | None |
| ECHO voice | Egyptian Whisper speech-to-text; WER 37.3% against the 25% bar | `%USERPROFILE%\echo-voice` | None; Donna uses browser speech |

The same questions are answered in several places:
- **Should I contact this client, and what's next?** The Decision Engine, the Operator Runtime, `followUp`
  and Donna's `mind.ts` all answer it.
- **What did he mean?** ECHO's `intentResolver` and Donna's `understand()` both answer it.

Converge them; don't add another. Target shape:
- **Donna:** the one assistant, holding memory, initiative and personality.
- **ECHO:** her ears, her voice and her language understanding. It replaces browser speech once it meets
  its bar, and merges with `understand()`.
- **SalesOS:** her judgment and the owner's scoreboard.
  - Donna asks the Decision Engine before she says "call" or "leave alone".
  - The lead loss report and the runtime ledgers feed the scoreboard.
  - The manager view stays for when there is a team.
- **revenueCore / followUp:** the shared record and daily queue under all three.

## Missing layers

What we built is her face, her voice and her judgment. What she lacks is a connection to the owner's
real work.

| # | Layer | What it means for the owner | Today | What it needs |
|---|---|---|---|---|
| 1 | Trusted core | A private place where real clients, the AI model, notifications and connections can live safely | **Missing.** The repo is public, and `src/` has no network, storage or real data by design | Owner decision: a private core (a separate private repo or service, with this app as its face), or wider exceptions in the public repo. Write an ADR first |
| 2 | Senses | She finds out without being told: WhatsApp chats, call log, calendar, his Excel sheet, developer price sheets | **Partial.** Typed or spoken debriefs in the app. SalesOS already reads WhatsApp exports and CRM files, but Donna doesn't use it yet | Pasting a chat into the app can be built now (DON-09). Forwarding, call logs and calendars need layer 1 |
| 3 | Lasting memory | The same memory on phone and computer; every fact keeps its source and date; old facts are flagged as old | **Partial.** Memory lasts only for the open tab; DON-02 stores call events only | DON-08 now. Lasting profiles need an approved change to the DON-02 tables, or layer 1 |
| 4 | Market knowledge | Projects, units, prices, payment plans, delivery dates and offers with an expiry; which units fit which client; a truth check against the real price list | **Missing.** The truth check compares only with what he told the client before | A synthetic price book now (DON-10). Real price sheets after G6 |
| 5 | Language brain | Free conversation in everyday Egyptian Arabic: she understands anything and answers naturally | **Missing.** She knows a fixed set of requests; anything else gets "Not my department". ECHO's in-app runtime understands more phrasings (including Franco-Arabic) but isn't connected to her | Owner decision: which model and host, what data leaves the device, a cost cap, and an invariant 8 exception for one file. Rule: the model only understands and phrases; facts still come only from her memory |
| 6 | Initiative | She reaches him with the app closed: morning brief, before a viewing, after a call, when he is about to slip | **Partial.** She speaks first only when the app is opened | DON-04 (push notifications and a scheduler) or a real phone call. Needs hosting and layer 1 |
| 7 | Hands | WhatsApp replies drafted in his style (what he does in ChatGPT today), one tap to send, later sending after a yes, then small things alone | **Partial.** Drafts need approval and none can be sent | Invariant 1 changed one stage at a time; ADRs SOS-12 and ECH-12 |
| 8 | Scoreboard and learning | Pace against EGP 500,000 a month and about 50 calls a day; promises kept; money at risk in cooling leads; a weekly review; she learns what works with each client and his own rules | **Missing** in Donna. SalesOS has a lead loss report, and PR #8 adds performance ledgers and doctrine | Scoreboard now (DON-11), built on SalesOS metrics. Learning after real data (SOS-11) |
| 9 | Presence | The same Donna away from home, a natural Egyptian voice, hands-free in the car | **Partial.** Installable web app, browser voices, home Wi-Fi only | Hosting (owner decision). A better voice needs a speech service (layer 1) or ECHO reaching its accuracy bar |

**The loop to build first: chat in, reply out.** He pastes a client's WhatsApp chat, and later forwards it.
She already knows the client, so she:
- files what is new, as a proposal he confirms;
- flags a hold, a wrong price or an owed promise;
- hands back a short reply in his style for him to send.

This replaces his copy-paste-into-ChatGPT habit with someone who remembers and judges. A paste-in version
needs no owner decision (DON-09). The full version grows as layers 1, 5 and 7 are approved.

## Suggested split (proposed tasks; each needs the owner's go-ahead)

**Lane A, the engine.** Owns `src/lib/revenueCore/**`, `src/lib/followUp/**`, and model changes in
`src/lib/donna/{brief,book,mind}.ts`.

- **DON-08: one client record.**
  - **Start from:** `feat/follow-up-core` (`5c04c22`), on GitHub since 2026-11-03.
  - **Work:** cherry-pick `revenueCore` and `followUp` onto a new DON-08 branch cut from the Donna stack,
    and leave `feat/follow-up-core` itself unchanged. Map or replace `ClientProfile`:
    `pickCalls` uses `rankDailyQueue`, holds become contact restrictions, promises become commitments.
    Do it together with MOS-01 (shared contracts): SalesOS's `NormalizedSalesEvent` and revenueCore's
    `Interaction` describe the same events, so keep one.
  - **Acceptance:** every DON-07 behaviour and test stays green; restraint still wins; new adapter tests
    in EN/AR.
- **DON-10: market knowledge v0.**
  - **Work:** a synthetic price book of projects and units: price, down payment, years, delivery date,
    valid from/to. Add `matchUnits(client, book, now)`, a truth check against the price book (expired
    plan, wrong price), and a "what fits Gamma?" intent.
  - **Acceptance:** an expired offer is never quoted; unknown stays unknown; EN/AR.

**Lane B, senses and experience.** Owns the new `src/lib/donna/intake/**` and
`src/components/donna/intake/**`, plus `DonnaProvider.tsx`.

- **DON-09: chat in, reply out v0.**
  - **Work:**
    - Reuse SalesOS's `parseWhatsappExport` and `maskPii` (`src/lib/realInput`, on `main`); don't write a
      second parser. It reads Android-style exports (`date, time - Name: text`) with an explicit sender
      mapping. Extend it, with tests, for iPhone exports (`[date, time] Name: text`; the owner uses an
      iPhone) and timestamps written in Arabic digits.
    - Buyer lines kept apart from seller lines.
    - Facts extracted with `speech.ts` / `factsIn`.
    - Proposals in the existing `DebriefProposal` shape, so this lane does not wait for DON-08.
    - Reply templates in EN/AR: short, one ask, no unverified price.
    - Memory-only, synthetic fixtures only.
  - **Acceptance:** a held client gets the hold and no reply draft; a price that contradicts what was
    told is flagged; nothing is filed without "file it"; tests in both languages.
- **DON-11: scoreboard v0.**
  - **Work:** calls today against the target, promises kept and late, money at risk in cooling leads. It
    is spoken as one line in the brief and answers "how am I doing?". Targets are owner settings
    (synthetic for now).
  - **Acceptance:** the same clock gives the same result; EN/AR.

**Shared files:**
- `en.ts` / `ar.ts`: add keys in separate blocks and rebase before the PR.
- `src/lib/donna/index.ts`: append only.

## Owner decisions that unlock the big layers

1. **Trusted core:** where real data, the model and connections live. Recommended: a private core, with
   this public app as its face. Write an ADR first.
2. **The brain:** which model, local or hosted, what client data may leave the device, and a monthly cost cap.
3. **Hosting,** so she works away from home and gets an https address, which the phone needs for the
   microphone and the Copy button. This is an open item in DON-06 and DON-07.
4. **Reaching him:** push notifications (DON-04) or a real phone call.
5. **Real data:** when gate G6 is passed.
6. **Sending:** when invariant 1 may change, one stage at a time.

## Hard lines (from AGENTS.md)

- **Branches and merging:**
  - Never push to `main`.
  - Never touch another agent's branch.
  - One task per branch, draft PRs only; the owner merges.
- **No real client data** anywhere: repo, tests, screenshots or PR text.
- **No network, storage, sending or new dependency in `src/`** without written owner approval (invariants 1 and 8).
- **Bilingual copy:** every user-visible string goes in both `en.ts` and `ar.ts`, and Arabic renders RTL.
- **Restraint tests:** every change to a decision ships with a restraint test.
