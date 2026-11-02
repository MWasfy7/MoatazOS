import { daysBetween, formatLocal, type DebriefProposal, type HeardItem, type Reply, type Say, type ToldFact } from "@/lib/donna";
import type { Dictionary } from "@/lib/i18n/en";
import { fill, isolate, keep, lineText, moneyText, wantsText } from "../briefText";

type Donna = Dictionary["donna"];

/** Everything needed to put Donna's structured answer into words, in one language. */
export interface Voice {
  readonly copy: Donna;
  readonly today: string;
  readonly offset: number;
  /** Short spoken name for a client ("Alpha", "ألفا"). */
  readonly name: (clientId: string) => string;
}

function list(items: readonly string[], v: Voice, last = v.copy.talk.says.listLast): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(v.copy.talk.says.listJoin)}${last}${items[items.length - 1]}`;
}

export function agoText(days: number, v: Voice): string {
  const a = v.copy.talk.says.ago;
  if (days <= 0) return a.today;
  if (days === 1) return a.yesterday;
  if (days === 2) return a.twoDays;
  return fill(a.days, { n: days });
}

function dueText(due: string, v: Voice): string {
  const d = v.copy.talk.says.due;
  const n = daysBetween(v.today, due);
  if (n <= 0) return d.today;
  if (n === 1) return d.tomorrow;
  return fill(d.days, { n });
}

export function factValue(fact: ToldFact, v: Voice): string {
  switch (fact.unit) {
    case "EGP":
      return keep(moneyText(fact.value, v.copy.brief));
    case "PERCENT":
      return keep(`${fact.value}%`);
    case "YEAR":
      return keep(String(fact.value));
    case "YEARS":
      return fill(v.copy.talk.says.years, { n: fact.value });
  }
}

export const factText = (fact: ToldFact, v: Voice) => fill(v.copy.talk.says.fact[fact.topic], { v: factValue(fact, v) });

/** One line per thing Donna heard in a debrief, for the proposal card and for reading back aloud. */
export function heardText(item: HeardItem, v: Voice): string {
  const h = v.copy.talk.heard;
  switch (item.kind) {
    case "OUTCOME":
      return h[item.outcome];
    case "WANTS":
      return wantsText(item.wants, v.copy.brief);
    case "PROMISE":
      return item.dueSaid ? fill(h.promise, { text: isolate(item.text), due: dueText(item.due, v) }) : fill(h.promiseNoDate, { text: isolate(item.text) });
    case "KEPT":
      return fill(h.kept, { text: isolate(item.text) });
    case "TOLD":
      return fill(h.told, { fact: factText(item.fact, v) });
    case "PERSONAL":
      return fill(h.personal, { text: isolate(item.text) });
    case "HOLD":
      return h.hold[item.reason];
  }
}

export function sayText(say: Say, v: Voice, proposal: DebriefProposal | null = null): string {
  const s = v.copy.talk.says;
  const time = (iso: string) => formatLocal(iso, v.offset).slice(-5);
  switch (say.kind) {
    case "OPEN":
      return say.count > 0 ? fill(s.OPEN[say.part], { count: say.count }) : s.OPEN_NONE[say.part];
    case "LINE":
      return lineText(say.line, v.copy.brief, v.name(say.line.clientId), v.offset);
    case "MORE":
      return fill(s.MORE, { count: say.count });
    case "START_WITH":
      return fill(s.START_WITH, { client: v.name(say.clientId) });
    case "CALL_ORDER":
      return say.picks
        .map((pick, i) =>
          fill(i === 0 ? s.CALL_FIRST : s.CALL_THEN, {
            client: v.name(pick.clientId),
            reasons: pick.reasons
              .map((r) => {
                switch (r.kind) {
                  case "OWED_LATE":
                  case "QUIET":
                    return fill(s.reasons[r.kind], { days: r.days });
                  case "PLANNED":
                    return fill(s.reasons.PLANNED, { time: time(r.at) });
                  default:
                    return s.reasons[r.kind];
                }
              })
              .join(s.reasonJoin),
          }),
        )
        .join(" ");
    case "NOT_THEM":
      return fill(s.NOT_THEM, { clients: list(say.clientIds.map(v.name), v) });
    case "NOBODY_TO_CALL":
    case "NO_HOLDS":
    case "NONE_COLD":
    case "CONFIRM":
    case "NO_RETRY":
    case "SUPPORT_FIRST":
    case "SPACE_KEPT":
    case "DID_YOUR_PART":
    case "DISCARDED":
    case "NOTHING_PENDING":
    case "OK":
    case "WHO":
    case "IDENTITY":
    case "HELLO":
    case "HELP":
    case "UNKNOWN":
    case "HEARD_NOTHING":
    case "MESSAGE_OK":
      return s[say.kind];
    case "OWE_COUNT":
      return say.count > 0 ? fill(s.OWE_COUNT, { count: say.count }) : s.OWE_COUNT_NONE;
    case "OWE": {
      const values = { client: v.name(say.clientId), text: isolate(say.text), days: Math.abs(say.late) };
      return fill(say.late > 0 ? s.OWE_LATE : say.late === 0 ? s.OWE_TODAY : s.OWE_SOON, values);
    }
    case "OWE_NONE":
      return fill(s.OWE_NONE, { client: v.name(say.clientId) });
    case "HEAT":
      return say.days === null && say.heat !== "HELD"
        ? fill(s.HEAT_NEVER, { client: v.name(say.clientId) })
        : fill(s.HEAT[say.heat], { client: v.name(say.clientId), ago: agoText(say.days ?? 0, v) });
    case "WANTS":
      return wantsText(say.wants, v.copy.brief);
    case "PERSONAL":
      return fill(s.PERSONAL, { text: isolate(say.text) });
    case "TOLD":
      return fill(s.TOLD, { facts: list(say.facts.map((f) => factText(f, v)), v, s.reasonJoin) });
    case "GAP":
      return fill(s.GAP, { field: v.copy.brief.fields[say.field] });
    case "TURN":
      return s.TURN[say.turn];
    case "PREP":
      return say.at ? fill(s.PREP_AT, { client: v.name(say.clientId), time: time(say.at) }) : fill(s.PREP, { client: v.name(say.clientId) });
    case "STOP_CALL":
      return [fill(s.STOP_CALL[say.reason], { client: v.name(say.clientId), count: say.count }), say.planned ? s.STOP_CALL_PLANNED : ""].filter(Boolean).join(" ");
    case "STOP_MESSAGE":
      return fill(s.STOP_MESSAGE[say.reason], { client: v.name(say.clientId), count: say.count });
    case "PUSHBACK":
      return say.level === 2 ? s.PUSHBACK.two : s.PUSHBACK.one;
    case "DELIVER_FIRST":
      return fill(s.DELIVER_FIRST, { text: isolate(say.text) });
    case "ASK_ONCE":
      return fill(s.ASK_ONCE, { field: v.copy.brief.fields[say.field] });
    case "ONLY_THE_PROMISE":
      return fill(s.ONLY_THE_PROMISE, { text: isolate(say.text) });
    case "CLAIM_CONFLICT":
      return fill(s.CLAIM_CONFLICT, {
        ago: capitalize(agoText(daysBetween(say.before.on, v.today), v)),
        client: v.name(say.clientId),
        before: factText(say.before, v),
        now: factValue(say.now, v),
      });
    case "CLAIM_MATCH":
      return fill(s.CLAIM_MATCH, { ago: agoText(daysBetween(say.before.on, v.today), v) });
    case "CLAIM_NEW":
      return fill(s.CLAIM_NEW, { topic: s.topic[say.topic] });
    case "DEBRIEF_GO":
      return fill(s.DEBRIEF_GO, { client: v.name(say.clientId) });
    case "HEARD": {
      const head = fill(s.HEARD, { client: v.name(say.clientId) });
      const items = proposal && proposal.clientId === say.clientId ? proposal.items.map((item) => heardText(item, v)) : [];
      return [head, ...items].join(" ");
    }
    case "FILED":
      return say.promise ? fill(s.FILED_PROMISE, { text: isolate(say.promise.text), due: dueText(say.promise.due, v) }) : s.FILED;
    case "KEPT":
      return fill(s.KEPT, { client: v.name(say.clientId), text: isolate(say.text) });
    case "THANKS":
      return s.THANKS[say.variant % s.THANKS.length] ?? s.THANKS[0] ?? "";
    case "DECLINED":
      return say.clientId ? fill(s.DECLINED, { client: v.name(say.clientId) }) : s.DECLINED_NONE;
  }
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** A whole reply as separate sentences: shown as one bubble, spoken one sentence at a time. */
export function replyLines(reply: Reply, v: Voice, proposal: DebriefProposal | null = null): readonly string[] {
  return reply.says.map((say) => sayText(say, v, proposal)).filter((line) => line.trim() !== "");
}

/** Text for the speech engine: no direction marks, no quote marks around the operator's words. */
export const speakable = (line: string) => line.replace(/[⁦-⁩]/g, "").replace(/"/g, "");
