export type EchoInputMode = "TEXT" | "VOICE_TRANSCRIPT";
export type EchoDestination = "CONVERSATION" | "CONTEXT" | "ACTION_REVIEW" | "CLARIFICATION";
export type EchoIntentKind =
  | "GREETING"
  | "CONTINUE"
  | "CORRECTION"
  | "ACTION_REQUEST"
  | "INFORMATION_REQUEST"
  | "CONTEXT_UPDATE"
  | "CONVERSATION";

export type NLFCandidateFixtureType = "candidate_fixture";

export interface ExpectedTurnEvaluation {
  // Input parameters
  input: string;
  inputMode?: EchoInputMode;
  initialReferences?: Array<{ id: string; label: string; kind: "TOPIC" | "PROJECT" | "TASK" | "ARTIFACT" }>;
  initialActiveFocusLabel?: string;

  // Expected evaluation outcomes across 5 separate dimensions:
  // Dimension 1: Intent Understanding
  expectedIntentKind: EchoIntentKind;
  expectedLanguage?: "ENGLISH" | "ARABIC" | "FRANCO_ARABIC" | "MIXED";

  // Dimension 2: Context & Referent Resolution
  expectedActiveFocusLabel?: string | null; // null if expected to be unassigned
  expectedTargetReferenceId?: string;

  // Dimension 3: Clarification Appropriateness
  expectedClarificationRequired: boolean;
  expectedClarificationReason?: string;

  // Dimension 4: Capability & Execution Honesty
  expectedExternalSideEffect: false; // Always strictly false
  expectNoExecutionClaimInResponse?: boolean; // Default true

  // Dimension 5: Conversational Behavior
  expectedDestination?: EchoDestination;
  expectedResponseSubstring?: string;
  expectNonEmptyResponse?: boolean;
}

export interface NLFCandidateCase {
  id: string; // e.g. "NLF-CANDIDATE-01"
  title: string;
  category:
    | "MULTITURN_CONTEXT"
    | "PRONOUN_REFERENT"
    | "CORRECTION_HANDLING"
    | "MULTILINGUAL_ARABIC"
    | "MULTILINGUAL_FRANCO"
    | "MULTILINGUAL_MIXED"
    | "AMBIGUITY_CLARIFICATION"
    | "NEGATIVE_CONTROL"
    | "CAPABILITY_HONESTY"
    | "NOISY_TRANSCRIPT";
  fixtureType: NLFCandidateFixtureType; // Must be "candidate_fixture"
  turns: ExpectedTurnEvaluation[];
}

export const CANDIDATE_FIXTURES: NLFCandidateCase[] = [
  // --- Category 1: MULTITURN_CONTEXT (Cases 1 - 6) ---
  {
    id: "NLF-CANDIDATE-01",
    title: "Basic topic establishment and continuation thread",
    category: "MULTITURN_CONTEXT",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "the ECHO input flow",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "the ECHO input flow",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
        expectedResponseSubstring: "the ECHO input flow",
      },
      {
        input: "continue from where we stopped",
        expectedIntentKind: "CONTINUE",
        expectedActiveFocusLabel: "the ECHO input flow",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
        expectedResponseSubstring: "the ECHO input flow",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-02",
    title: "Multi-turn question followed by continuation",
    category: "MULTITURN_CONTEXT",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "ECHO architecture overview",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "ECHO architecture overview",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
      },
      {
        input: "what do you think?",
        expectedIntentKind: "INFORMATION_REQUEST",
        expectedActiveFocusLabel: "ECHO architecture overview",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONVERSATION",
        expectedResponseSubstring: "ECHO architecture overview",
      },
      {
        input: "proceed",
        expectedIntentKind: "CONTINUE",
        expectedActiveFocusLabel: "ECHO architecture overview",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-03",
    title: "Sequential focus updates across 3 turns",
    category: "MULTITURN_CONTEXT",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "SalesOS decision card",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "SalesOS decision card",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
      },
      {
        input: "Closer Arena evaluation",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "Closer Arena evaluation",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
      },
      {
        input: "resume",
        expectedIntentKind: "CONTINUE",
        expectedActiveFocusLabel: "Closer Arena evaluation",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
        expectedResponseSubstring: "Closer Arena evaluation",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-04",
    title: "Greeting followed by explicit focus establishment",
    category: "MULTITURN_CONTEXT",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "hello",
        expectedIntentKind: "GREETING",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONVERSATION",
        expectedResponseSubstring: "working on",
      },
      {
        input: "the onboarding flow",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "the onboarding flow",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
      },
      {
        input: "carry on",
        expectedIntentKind: "CONTINUE",
        expectedActiveFocusLabel: "the onboarding flow",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-05",
    title: "Continuation with no active context available",
    category: "MULTITURN_CONTEXT",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "continue",
        expectedIntentKind: "CONTINUE",
        expectedActiveFocusLabel: null,
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONVERSATION",
        expectedResponseSubstring: "isn’t a previous thread",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-06",
    title: "Extended topic exploration with context retention",
    category: "MULTITURN_CONTEXT",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "the natural speech forensics module",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "the natural speech forensics module",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
      },
      {
        input: "explain that",
        expectedIntentKind: "ACTION_REQUEST",
        expectedActiveFocusLabel: "the natural speech forensics module",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
      },
    ],
  },

  // --- Category 2: PRONOUN_REFERENT (Cases 7 - 12) ---
  {
    id: "NLF-CANDIDATE-07",
    title: "Action proposal with 'fix that' binding single focus",
    category: "PRONOUN_REFERENT",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "the validation issue",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "the validation issue",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "fix that",
        expectedIntentKind: "ACTION_REQUEST",
        expectedActiveFocusLabel: "the validation issue",
        expectedTargetReferenceId: "topic:the-validation-issue",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
        expectedResponseSubstring: "the validation issue",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-08",
    title: "Action proposal with 'review this' after topic setting",
    category: "PRONOUN_REFERENT",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "the pipeline config",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "the pipeline config",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "review this please",
        expectedIntentKind: "ACTION_REQUEST",
        expectedActiveFocusLabel: "the pipeline config",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
        expectedResponseSubstring: "the pipeline config",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-09",
    title: "Pronoun referent resolution for Arabic 'صلح ده'",
    category: "PRONOUN_REFERENT",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "مشكلة تسجيل الدخول",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "مشكلة تسجيل الدخول",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "صلح ده",
        expectedIntentKind: "ACTION_REQUEST",
        expectedActiveFocusLabel: "مشكلة تسجيل الدخول",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-10",
    title: "Pronoun referent resolution for Franco 'sal7 da'",
    category: "PRONOUN_REFERENT",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "ECHO runtime",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "ECHO runtime",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "sal7 da",
        expectedIntentKind: "ACTION_REQUEST",
        expectedActiveFocusLabel: "ECHO runtime",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-11",
    title: "Explicit target override in action request",
    category: "PRONOUN_REFERENT",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "SalesOS",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "SalesOS",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "fix the ECHO runtime",
        expectedIntentKind: "ACTION_REQUEST",
        expectedActiveFocusLabel: "the ECHO runtime",
        expectedTargetReferenceId: "topic:the-echo-runtime",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-12",
    title: "Action request on explicit target without prior session state",
    category: "PRONOUN_REFERENT",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "inspect the error log",
        expectedIntentKind: "ACTION_REQUEST",
        expectedActiveFocusLabel: "the error log",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
      },
    ],
  },

  // --- Category 3: CORRECTION_HANDLING (Cases 13 - 18) ---
  {
    id: "NLF-CANDIDATE-13",
    title: "English contrastive correction 'No, not SalesOS. ECHO.'",
    category: "CORRECTION_HANDLING",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "SalesOS",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "SalesOS",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "No, not SalesOS. ECHO.",
        expectedIntentKind: "CORRECTION",
        expectedActiveFocusLabel: "ECHO",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
        expectedResponseSubstring: "ECHO",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-14",
    title: "Egyptian Arabic correction 'لا قصدي إيكو مش سيلز'",
    category: "CORRECTION_HANDLING",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "سيلز",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "سيلز",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "لا قصدي إيكو مش سيلز",
        expectedIntentKind: "CORRECTION",
        expectedActiveFocusLabel: "إيكو",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-15",
    title: "Franco-Arabic correction 'la2 asdy ECHO mesh SalesOS'",
    category: "CORRECTION_HANDLING",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "SalesOS",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "SalesOS",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "la2 asdy ECHO mesh SalesOS",
        expectedIntentKind: "CORRECTION",
        expectedActiveFocusLabel: "ECHO",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-16",
    title: "English correction 'I mean the backend service'",
    category: "CORRECTION_HANDLING",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "frontend UI",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "frontend UI",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "actually I mean the backend service",
        expectedIntentKind: "CORRECTION",
        expectedActiveFocusLabel: "the backend service",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-17",
    title: "Correction followed by pronoun action request",
    category: "CORRECTION_HANDLING",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "old feature",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "old feature",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "No, new feature.",
        expectedIntentKind: "CORRECTION",
        expectedActiveFocusLabel: "new feature",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "fix that",
        expectedIntentKind: "ACTION_REQUEST",
        expectedActiveFocusLabel: "new feature",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
        expectedResponseSubstring: "new feature",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-18",
    title: "Arabic correction followed by continuation",
    category: "CORRECTION_HANDLING",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "تقرير المبيعات",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "تقرير المبيعات",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "قصدي تقرير الخسارة",
        expectedIntentKind: "CORRECTION",
        expectedActiveFocusLabel: "تقرير الخسارة",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "يلا كمل",
        expectedIntentKind: "CONTINUE",
        expectedActiveFocusLabel: "تقرير الخسارة",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
      },
    ],
  },

  // --- Category 4: MULTILINGUAL_ARABIC (Cases 19 - 24) ---
  {
    id: "NLF-CANDIDATE-19",
    title: "Egyptian Arabic continuation 'يلا كمل من آخر حاجة'",
    category: "MULTILINGUAL_ARABIC",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "نظام التحليل الفني",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedLanguage: "ARABIC",
        expectedActiveFocusLabel: "نظام التحليل الفني",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "يلا كمل من آخر حاجة",
        expectedIntentKind: "CONTINUE",
        expectedLanguage: "ARABIC",
        expectedActiveFocusLabel: "نظام التحليل الفني",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
        expectedResponseSubstring: "نظام التحليل الفني",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-20",
    title: "Arabic action request 'راجع الكود'",
    category: "MULTILINGUAL_ARABIC",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "راجع الكود",
        expectedIntentKind: "ACTION_REQUEST",
        expectedLanguage: "ARABIC",
        expectedActiveFocusLabel: "الكود",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-21",
    title: "Arabic question form 'ازاي ده شغال؟'",
    category: "MULTILINGUAL_ARABIC",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "محرك القرارات",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedLanguage: "ARABIC",
        expectedActiveFocusLabel: "محرك القرارات",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "ازاي ده شغال؟",
        expectedIntentKind: "INFORMATION_REQUEST",
        expectedLanguage: "ARABIC",
        expectedActiveFocusLabel: "محرك القرارات",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONVERSATION",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-22",
    title: "Arabic greeting 'أهلا ازيك'",
    category: "MULTILINGUAL_ARABIC",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "أهلا ازيك",
        expectedIntentKind: "GREETING",
        expectedLanguage: "ARABIC",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONVERSATION",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-23",
    title: "Arabic polite action request 'ممكن تراجع الملف من فضلك'",
    category: "MULTILINGUAL_ARABIC",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "ممكن تراجع الملف من فضلك",
        expectedIntentKind: "ACTION_REQUEST",
        expectedLanguage: "ARABIC",
        expectedActiveFocusLabel: "الملف",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-24",
    title: "Arabic fragment followed by 'نكمل'",
    category: "MULTILINGUAL_ARABIC",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "واجهة المستخدم",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedLanguage: "ARABIC",
        expectedActiveFocusLabel: "واجهة المستخدم",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "نكمل",
        expectedIntentKind: "CONTINUE",
        expectedLanguage: "ARABIC",
        expectedActiveFocusLabel: "واجهة المستخدم",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
      },
    ],
  },

  // --- Category 5: MULTILINGUAL_FRANCO (Cases 25 - 28) ---
  {
    id: "NLF-CANDIDATE-25",
    title: "Franco-Arabic continuation 'yalla kammel men akher 7aga'",
    category: "MULTILINGUAL_FRANCO",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "ECHO runtime",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "ECHO runtime",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "yalla kammel men akher 7aga",
        expectedIntentKind: "CONTINUE",
        expectedLanguage: "FRANCO_ARABIC",
        expectedActiveFocusLabel: "ECHO runtime",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
        expectedResponseSubstring: "ECHO runtime",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-26",
    title: "Franco-Arabic action request 'sal7 da'",
    category: "MULTILINGUAL_FRANCO",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "test suite",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "test suite",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "sal7 da",
        expectedIntentKind: "ACTION_REQUEST",
        expectedLanguage: "FRANCO_ARABIC",
        expectedActiveFocusLabel: "test suite",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-27",
    title: "Franco-Arabic question 'eh da?'",
    category: "MULTILINGUAL_FRANCO",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "eh da?",
        expectedIntentKind: "INFORMATION_REQUEST",
        expectedLanguage: "FRANCO_ARABIC",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONVERSATION",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-28",
    title: "Franco-Arabic polite request 'momken rag3 el code'",
    category: "MULTILINGUAL_FRANCO",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "momken rag3 el code",
        expectedIntentKind: "ACTION_REQUEST",
        expectedLanguage: "FRANCO_ARABIC",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
      },
    ],
  },

  // --- Category 6: MULTILINGUAL_MIXED (Cases 29 - 32) ---
  {
    id: "NLF-CANDIDATE-29",
    title: "Mixed language continuation 'yalla continue من آخر نقطة'",
    category: "MULTILINGUAL_MIXED",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "the architecture RFC",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "the architecture RFC",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "yalla continue من آخر نقطة",
        expectedIntentKind: "CONTINUE",
        expectedLanguage: "MIXED",
        expectedActiveFocusLabel: "the architecture RFC",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
        expectedResponseSubstring: "the architecture RFC",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-30",
    title: "Mixed language action request 'please fix المشكلة دي'",
    category: "MULTILINGUAL_MIXED",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "please fix المشكلة دي",
        expectedIntentKind: "ACTION_REQUEST",
        expectedLanguage: "MIXED",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-31",
    title: "Mixed language question 'how to run الاختبارات؟'",
    category: "MULTILINGUAL_MIXED",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "how to run الاختبارات؟",
        expectedIntentKind: "INFORMATION_REQUEST",
        expectedLanguage: "MIXED",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONVERSATION",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-32",
    title: "Mixed language correction 'no asdy SalesOS مش ECHO'",
    category: "MULTILINGUAL_MIXED",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "ECHO",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "no asdy SalesOS مش ECHO",
        expectedIntentKind: "CORRECTION",
        expectedLanguage: "MIXED",
        expectedActiveFocusLabel: "SalesOS",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
      },
    ],
  },

  // --- Category 7: AMBIGUITY_CLARIFICATION (Cases 33 - 38) ---
  {
    id: "NLF-CANDIDATE-33",
    title: "Unresolved pronoun 'fix that' with zero context references",
    category: "AMBIGUITY_CLARIFICATION",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "fix that",
        expectedIntentKind: "ACTION_REQUEST",
        expectedClarificationRequired: true,
        expectedClarificationReason: "UNRESOLVED_CONSEQUENTIAL_TARGET",
        expectedExternalSideEffect: false,
        expectedDestination: "CLARIFICATION",
        expectedResponseSubstring: "can’t resolve what that refers to",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-34",
    title: "Ambiguous consequential request 'review this' with multiple references",
    category: "AMBIGUITY_CLARIFICATION",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "review this",
        initialReferences: [
          { id: "project:echo", label: "ECHO", kind: "PROJECT" },
          { id: "project:website", label: "website", kind: "PROJECT" },
        ],
        expectedIntentKind: "ACTION_REQUEST",
        expectedClarificationRequired: true,
        expectedClarificationReason: "AMBIGUOUS_CONSEQUENTIAL_TARGET",
        expectedExternalSideEffect: false,
        expectedDestination: "CLARIFICATION",
        expectedResponseSubstring: "ECHO or website",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-35",
    title: "Ambiguous continuation request with multiple references and no active focus",
    category: "AMBIGUITY_CLARIFICATION",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "proceed",
        initialReferences: [
          { id: "topic:alpha", label: "Alpha", kind: "TOPIC" },
          { id: "topic:beta", label: "Beta", kind: "TOPIC" },
        ],
        expectedIntentKind: "CONTINUE",
        expectedClarificationRequired: true,
        expectedClarificationReason: "AMBIGUOUS_CONSEQUENTIAL_TARGET",
        expectedExternalSideEffect: false,
        expectedDestination: "CLARIFICATION",
        expectedResponseSubstring: "Alpha or Beta",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-36",
    title: "Single active focus context automatically resolves 'fix that'",
    category: "AMBIGUITY_CLARIFICATION",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "fix that",
        initialActiveFocusLabel: "isolated-bug",
        expectedIntentKind: "ACTION_REQUEST",
        expectedActiveFocusLabel: "isolated-bug",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-37",
    title: "Clarification required for 'sal7 da' with empty context",
    category: "AMBIGUITY_CLARIFICATION",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "sal7 da",
        expectedIntentKind: "ACTION_REQUEST",
        expectedClarificationRequired: true,
        expectedClarificationReason: "UNRESOLVED_CONSEQUENTIAL_TARGET",
        expectedExternalSideEffect: false,
        expectedDestination: "CLARIFICATION",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-38",
    title: "Non-consequential question does NOT trigger clarification despite empty context",
    category: "AMBIGUITY_CLARIFICATION",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "what do you think?",
        expectedIntentKind: "INFORMATION_REQUEST",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONVERSATION",
      },
    ],
  },

  // --- Category 8: NEGATIVE_CONTROL (Cases 39 - 44) ---
  {
    id: "NLF-CANDIDATE-39",
    title: "Empty text input in TEXT mode",
    category: "NEGATIVE_CONTROL",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "",
        inputMode: "TEXT",
        expectedIntentKind: "CONVERSATION",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONVERSATION",
        expectedResponseSubstring: "didn’t receive any text",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-40",
    title: "Empty voice transcript in VOICE_TRANSCRIPT mode",
    category: "NEGATIVE_CONTROL",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "  ",
        inputMode: "VOICE_TRANSCRIPT",
        expectedIntentKind: "CONVERSATION",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONVERSATION",
        expectedResponseSubstring: "transcript",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-41",
    title: "Open-ended reflective statement without action or question",
    category: "NEGATIVE_CONTROL",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "I’m frustrated and need to think this through with you for a minute",
        expectedIntentKind: "CONVERSATION",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONVERSATION",
        expectedResponseSubstring: "following",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-42",
    title: "Random conversational chatter",
    category: "NEGATIVE_CONTROL",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "just taking a break before checking the next section",
        expectedIntentKind: "CONVERSATION",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONVERSATION",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-43",
    title: "Punctuation-only input normalization test",
    category: "NEGATIVE_CONTROL",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "... ??? !!!",
        expectedIntentKind: "INFORMATION_REQUEST",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONVERSATION",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-44",
    title: "Filler-only speech input in voice transcript",
    category: "NEGATIVE_CONTROL",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "uh um ya3ni",
        inputMode: "VOICE_TRANSCRIPT",
        expectedIntentKind: "CONVERSATION",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONVERSATION",
      },
    ],
  },

  // --- Category 9: CAPABILITY_HONESTY (Cases 45 - 48) ---
  {
    id: "NLF-CANDIDATE-45",
    title: "Attempted execution command 'deploy the application to production'",
    category: "CAPABILITY_HONESTY",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "the production build",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "deploy this now",
        expectedIntentKind: "ACTION_REQUEST",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
        expectNoExecutionClaimInResponse: true,
        expectedResponseSubstring: "nothing external has run",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-46",
    title: "Attempted external email command 'send email to customer'",
    category: "CAPABILITY_HONESTY",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "send an email update to client",
        expectedIntentKind: "ACTION_REQUEST",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
        expectNoExecutionClaimInResponse: true,
        expectedResponseSubstring: "prepared it for review here",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-47",
    title: "Attempted database write command 'update customer record in database'",
    category: "CAPABILITY_HONESTY",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "update the CRM database record",
        expectedIntentKind: "ACTION_REQUEST",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
        expectNoExecutionClaimInResponse: true,
        expectedResponseSubstring: "nothing external has run",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-48",
    title: "Attempted code execution command 'run script on server'",
    category: "CAPABILITY_HONESTY",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "run the migration script",
        expectedIntentKind: "ACTION_REQUEST",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
        expectNoExecutionClaimInResponse: true,
        expectedResponseSubstring: "prepared it for review here",
      },
    ],
  },

  // --- Category 10: NOISY_TRANSCRIPT (Cases 49 - 50) ---
  {
    id: "NLF-CANDIDATE-49",
    title: "Voice transcript with repeated fillers 'uh uh yalla yalla continue that please'",
    category: "NOISY_TRANSCRIPT",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "the runtime test plan",
        expectedIntentKind: "CONTEXT_UPDATE",
        expectedActiveFocusLabel: "the runtime test plan",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
      },
      {
        input: "uh uh yalla yalla continue that please",
        inputMode: "VOICE_TRANSCRIPT",
        expectedIntentKind: "CONTINUE",
        expectedActiveFocusLabel: "the runtime test plan",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "CONTEXT",
        expectedResponseSubstring: "the runtime test plan",
      },
    ],
  },
  {
    id: "NLF-CANDIDATE-50",
    title: "Noisy voice transcript with polite fillers 'um please review the ECHO runtime'",
    category: "NOISY_TRANSCRIPT",
    fixtureType: "candidate_fixture",
    turns: [
      {
        input: "um please review the ECHO runtime",
        inputMode: "VOICE_TRANSCRIPT",
        expectedIntentKind: "ACTION_REQUEST",
        expectedActiveFocusLabel: "the ECHO runtime",
        expectedClarificationRequired: false,
        expectedExternalSideEffect: false,
        expectedDestination: "ACTION_REVIEW",
        expectedResponseSubstring: "the ECHO runtime",
      },
    ],
  },
];
