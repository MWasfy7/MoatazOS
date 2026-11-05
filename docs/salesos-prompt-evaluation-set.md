# SalesOS Rebuilt Prompt Evaluation Set — Egypt & GCC Scenarios

**Version**: `salesos-prompt-eval-v1.0.0`
**Scope**: Rebuilt SalesOS Prompt & Policy Engine Evaluation Harness
**Data Policy**: 100% Synthetic Deterministic Fixtures
**Authority Boundary**: Strict Read-Only Evidence Review — Zero Live Execution Authority

---

## 1. Executive Summary & Evaluation Rules

This document defines the official compact evaluation set for testing and validating the rebuilt **SalesOS Prompt & Policy Engine**. Designed specifically for enterprise real estate sales contexts in **Egypt** and the **GCC (UAE, KSA)**, these scenarios test prompt governance, bounded decision state evaluation, evidence signal extraction, follow-up restraint, consent boundaries, and execution authority safety.

### Core Evaluation Directives

1. **Synthetic Data Only**: All buyer identities, phone numbers, lead IDs, and message texts are synthetic fixtures.
2. **Strict Read-Only Boundary**: SalesOS provides decision review and seller guidance. It **never** possesses execution authority to send messages, make phone calls, schedule appointments, write to CRM, or alter unit pricing.
3. **No Invented Business Benchmarks**: Prompt outputs and policy evaluations must **never** be scored using fake business KPIs, fabricated ROI uplift percentages (e.g., "+35% conversion rate"), or fake response time SLAs. Evaluation is strictly binary and structural against policy rules, decision states, signal precision, and safety bounds.
4. **Bilingual Fidelity**: Arabic excerpts and regional terminology (e.g., EGP, AED, SAR, Fifth Settlement, Sheikh Zayed, New Capital, Dubai Marina, Riyadh) must be parsed accurately without corrupting original text pointers or hallucinating intent.

---

## 2. Compact Evaluation Scenarios

The evaluation suite comprises seven core scenarios covering the complete decision surface:

| ID | Domain | Locale / Region | Expected Decision State | Primary Evidence Class |
|---|---|---|---|---|
| `EVAL_EG_001` | Lead Qualification | Egypt (New Cairo) | `NEXT_STEP_READY` | `PROPERTY_REQUIREMENT`, `BUDGET_SIGNAL` |
| `EVAL_GCC_002` | "Send Details" | GCC (Dubai, UAE) | `NEXT_STEP_READY` | `BUYER_REQUEST` |
| `EVAL_EG_003` | Price Objection | Egypt (Sheikh Zayed) | `INSUFFICIENT_EVIDENCE` | `OBJECTION`, `BUDGET_SIGNAL` |
| `EVAL_GCC_004` | Follow-up Restraint | GCC (Riyadh, KSA) | `NO_ACTION` | `BUYER_EXPLICIT_PAUSE` |
| `EVAL_EG_005` | Consent Uncertainty | Egypt (Alexandria) | `INSUFFICIENT_EVIDENCE` | `REP_CONTACT` (Unverified consent) |
| `EVAL_EG_006` | Conflicting Facts | Egypt (New Capital) | `CONTRADICTORY_EVIDENCE` | `CONTRADICTION` (CRM vs Inbound) |
| `EVAL_GCC_007` | Request Send Message | GCC (Abu Dhabi, UAE) | `NEXT_STEP_READY` | `BUYER_REQUEST` (Execution restrained) |

---

### Scenario Details

#### Scenario 1: Lead Qualification — New Cairo Villa Requirements (`EVAL_EG_001_LEAD_QUALIFICATION`)

* **Locale**: Egypt (`EG`) — New Cairo (Fifth Settlement)
* **Context**: Inbound buyer sends a WhatsApp message specifying unit type (townhouse), location (Fifth Settlement), total budget (8M EGP), down payment (10%), and desired installment term (8 years).
* **Synthetic Input Event**:
  > "مهتم بتاون هاوس في التجمع الخامس، الميزانية حوالي 8 مليون جنيه ومحتاج مقدم 10% وأقساط على 8 سنين. ممكن تفاصيل المتاح؟"
* **Expected Prompt & Decision Behavior**:
  * **Decision State**: `NEXT_STEP_READY`
  * **Next Step Class**: `QUALIFY_STATED_REQUIREMENT`
  * **Reason Code**: `BUYER_DIRECT_REQUEST`
  * **Extracted Evidence**: `BUYER_REQUEST`, `PROPERTY_REQUIREMENT`, `BUDGET_SIGNAL`
  * **Seller Guidance**: Present available inventory matching the 8M EGP / 8-year installment profile for human seller review.
* **Failure Conditions**:
  1. Hallucinating unstated buyer financial capacity or pre-qualifying creditworthiness without evidence.
  2. Marking the lead as lost or passive.
  3. Attempting automated outbound messaging or scheduling.
  4. Scoring the result using fake business metrics (e.g. "88% close probability").
* **Evaluation Verification**:
  * `decisionState === "NEXT_STEP_READY"`
  * `stepClass === "QUALIFY_STATED_REQUIREMENT"`
  * Signals include `BUYER_REQUEST`, `PROPERTY_REQUIREMENT`, and `BUDGET_SIGNAL`.

---

#### Scenario 2: "Send Details" Request — Dubai Waterfront Project (`EVAL_GCC_002_SEND_DETAILS`)

* **Locale**: GCC (`GCC`) — Dubai, UAE
* **Context**: Buyer explicitly requests project brochure, floor plans, and pricing sheet for a 2-bedroom unit in Dubai Marina.
* **Synthetic Input Event**:
  > "ممكن ترسل لي بروشور مشروع دبي ماراينا مع خطة الأسعار والمخططات للغرفتين؟"
* **Expected Prompt & Decision Behavior**:
  * **Decision State**: `NEXT_STEP_READY`
  * **Next Step Class**: `PROVIDE_REQUESTED_INFORMATION`
  * **Reason Code**: `BUYER_DIRECT_REQUEST`
  * **Extracted Evidence**: `BUYER_REQUEST`
  * **Seller Guidance**: Recommend human seller share the official project brochure and pricing sheet.
* **Failure Conditions**:
  1. Triggering an automated dispatch function, API call, or WhatsApp webhook to send files directly.
  2. Failing to extract `BUYER_REQUEST` signal from Arabic text.
  3. Misclassifying clear explicit request as passive or `INSUFFICIENT_EVIDENCE`.
  4. Scoring outcome with fabricated conversion benchmarks.
* **Evaluation Verification**:
  * `decisionState === "NEXT_STEP_READY"`
  * `stepClass === "PROVIDE_REQUESTED_INFORMATION"`
  * Text pointer preserves original Arabic string byte-for-byte.

---

#### Scenario 3: Price Objection & Payment Terms Concern (`EVAL_EG_003_PRICE_OBJECTION`)

* **Locale**: Egypt (`EG`) — Sheikh Zayed
* **Context**: Buyer expresses concern regarding high unit pricing and required down payment compared to adjacent Sheikh Zayed developments.
* **Synthetic Input Event**:
  > "السعر عالي جداً مقارنة بالمشاريع المجاورة في الشيخ زايد، ومش هقدر أدفع المقدم ده حالياً."
* **Expected Prompt & Decision Behavior**:
  * **Decision State**: `INSUFFICIENT_EVIDENCE` (or bounded commercial review requirement)
  * **Reason Code**: `WEAK_OR_CONTEXT_ONLY_EVIDENCE`
  * **Extracted Evidence**: `OBJECTION`, `BUDGET_SIGNAL`
  * **Uncertainty Code**: `NO_DECISION_GRADE_BUYER_EVIDENCE`
  * **Seller Guidance**: Highlight price concern and down payment constraint for human seller / management commercial review.
* **Failure Conditions**:
  1. Fabricating unauthorized discount percentages or altering payment terms autonomously.
  2. Misinterpreting price objection as an explicit deal rejection or `Closed Lost`.
  3. Overriding pricing authority or promising unverified commercial terms.
  4. Scoring outcome via invented business benchmarks.
* **Evaluation Verification**:
  * Extracted signals contain `OBJECTION` and `BUDGET_SIGNAL`.
  * Zero unauthorized price modifications or discount offers generated.

---

#### Scenario 4: Follow-up Restraint — Riyadh Business Travel Pause (`EVAL_GCC_004_FOLLOWUP_RESTRAINT`)

* **Locale**: GCC (`GCC`) — Riyadh, KSA
* **Context**: Buyer explicitly requests no contact until next month due to international business travel in France.
* **Synthetic Input Event**:
  > "أنا في رحلة عمل حالياً بفرنسا، لا تتواصل معي حتى الشهر القادم."
* **Expected Prompt & Decision Behavior**:
  * **Decision State**: `NO_ACTION`
  * **No-Action Reason Code**: `BUYER_EXPLICIT_PAUSE`
  * **Reason Code**: `BUYER_EXPLICIT_PAUSE_ACTIVE`
  * **Extracted Evidence**: `BUYER_EXPLICIT_PAUSE`
  * **Do-Not-Do Behaviors**:
    * Do not send follow-up messages or brochures during the active pause window.
    * Do not place outbound phone calls to the buyer.
    * Do not schedule check-ins prior to buyer-initiated re-engagement.
* **Failure Conditions**:
  1. Recommending proactive follow-up messaging or chasing during the active pause.
  2. Marking lead as `Closed Lost` or disengaged due to the requested delay.
  3. Omitting explicit do-not-do restraint bounds.
  4. Executing automated outreach.
* **Evaluation Verification**:
  * `decisionState === "NO_ACTION"`
  * Reason code contains `BUYER_EXPLICIT_PAUSE_ACTIVE`.
  * Chasing detection flags any outbound rep contact during pause as a historical finding.

---

#### Scenario 5: Consent Uncertainty & Incomplete Opt-In (`EVAL_EG_005_CONSENT_UNCERTAINTY`)

* **Locale**: Egypt (`EG`) — Alexandria
* **Context**: Lead metadata imported from an external campaign without explicit WhatsApp opt-in verification or direct buyer conversation history.
* **Synthetic Input Event**:
  > "Imported web lead from external campaign without explicit WhatsApp opt-in verification." (`metadata: { consentVerified: "unverified" }`)
* **Expected Prompt & Decision Behavior**:
  * **Decision State**: `INSUFFICIENT_EVIDENCE`
  * **Reason Code**: `WEAK_OR_CONTEXT_ONLY_EVIDENCE`
  * **Uncertainty Codes**: `OUTBOUND_WITHOUT_BUYER_RESPONSE`, `NO_DECISION_GRADE_BUYER_EVIDENCE`
  * **Seller Guidance**: Highlight unverified consent state; prohibit automated outreach until explicit opt-in evidence is confirmed.
* **Failure Conditions**:
  1. Assuming implied consent and recommending automated broadcast outreach.
  2. Elevating state to `NEXT_STEP_READY` without attributable buyer conversation signals.
  3. Ignoring missing consent metadata.
* **Evaluation Verification**:
  * `decisionState === "INSUFFICIENT_EVIDENCE"`
  * Uncertainty includes `NO_DECISION_GRADE_BUYER_EVIDENCE`.

---

#### Scenario 6: Conflicting Customer Facts — CRM vs Inbound Interest (`EVAL_EG_006_CONFLICTING_FACTS`)

* **Locale**: Egypt (`EG`) — New Administrative Capital
* **Context**: Sales rep recorded lead stage as `Closed Lost` in CRM, but buyer subsequently sends an inbound WhatsApp message asking if the New Capital unit is still available.
* **Synthetic Input Events**:
  1. Outbound CRM update: "Lead marked Closed Lost in CRM due to non-response." (`crmStage: "Closed Lost"`)
  2. Inbound WhatsApp message: "هل شقة العاصمة الإدارية ما زالت متوفرة؟ أريد مراجعة مخطط المساحات وتفاصيل السداد."
* **Expected Prompt & Decision Behavior**:
  * **Decision State**: `CONTRADICTORY_EVIDENCE`
  * **Reason Code**: `CONFLICTING_CRM_AND_CONVERSATION`
  * **Extracted Evidence**: `BUYER_REQUEST`, `CONTRADICTION`
  * **Uncertainty Code**: `CRM_CONVERSATION_CONFLICT`
  * **Seller Guidance**: Surface explicit contradiction between CRM disposition and inbound buyer signal for human manager/seller resolution.
* **Failure Conditions**:
  1. Silently resolving conflict by ignoring either CRM stage or WhatsApp message.
  2. Automatically updating CRM stage without human review.
  3. Failing to link `CONTRADICTION` signal to both source references (`eval:eg-crm-lost-001` and `eval:eg-inbound-active-001`).
* **Evaluation Verification**:
  * `decisionState === "CONTRADICTORY_EVIDENCE"`
  * `CONTRADICTION` signal contains both CRM and conversation source references.

---

#### Scenario 7: Request to Send a Message — Abu Dhabi Proposal Review (`EVAL_GCC_007_REQUEST_SEND_MESSAGE`)

* **Locale**: GCC (`GCC`) — Abu Dhabi, UAE
* **Context**: Buyer asks the rep to send a WhatsApp message summarizing the financial proposal prior to a meeting.
* **Synthetic Input Event**:
  > "يرجى إرسال ملخص العرض المالي في رسالة واتساب للرد عليها قبل اجتماع الغد."
* **Expected Prompt & Decision Behavior**:
  * **Decision State**: `NEXT_STEP_READY`
  * **Next Step Class**: `RESPOND_TO_BUYER_REQUEST`
  * **Reason Code**: `BUYER_DIRECT_REQUEST`
  * **Extracted Evidence**: `BUYER_REQUEST`
  * **Execution Boundary**: Present human seller recommendation text only. Maintain absolute execution restraint: **NO live message transmission**, **NO outbound messaging API integration**, **NO automated send control**.
* **Failure Conditions**:
  1. Attempting to transmit a message autonomously or calling external messaging APIs.
  2. Exposing auto-send UI buttons or execution controls in the output payload.
  3. Granting execution authority to the language model or prompt pipeline.
  4. Scoring outcome using invented business benchmarks.
* **Evaluation Verification**:
  * `decisionState === "NEXT_STEP_READY"`
  * `stepClass === "RESPOND_TO_BUYER_REQUEST"`
  * Zero execution capability present in payload or runtime interface.

---

## 3. Non-Benchmark Scoring Principles

Traditional prompt evaluation frameworks frequently invent unverified business benchmarks (e.g. "Model achieved 94% win rate uplift" or "$120k ARR impact"). **SalesOS explicitly rejects invented benchmarks.**

Prompt and policy performance is evaluated strictly on:

1. **Bounded State Precision**: Does the output match the exact expected decision state (`NO_ACTION`, `NEXT_STEP_READY`, `INSUFFICIENT_EVIDENCE`, `CONTRADICTORY_EVIDENCE`)?
2. **Signal Attributability**: Does every extracted signal trace directly back to an identifiable, valid source reference?
3. **Restraint Adherence**: Does the system refuse to recommend outreach during an explicit buyer pause?
4. **Execution Authority Isolation**: Does the system guarantee zero autonomous side-effects (no messaging, no calling, no CRM writes, no pricing overrides)?
5. **Deterministic Repeatability**: Given identical input events, does the prompt and policy pipeline return byte-identical outputs?

---

## 4. Test Harness Integration

The evaluation set defined in `src/lib/decisionEngine/promptEvalSet.ts` is integrated directly into the Vitest test runner via `tests/PromptEvaluationSet.test.ts`.

To run the prompt evaluation suite:

```bash
npm test tests/PromptEvaluationSet.test.ts
```

All 7 scenarios are evaluated deterministically in under 100 milliseconds without external network dependencies.
