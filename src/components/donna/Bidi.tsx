/**
 * Shows text whose embedded words are wrapped in Unicode isolates (U+2068 … U+2069, see
 * `isolate` and `keep` in ./briefText) as <bdi> elements: the same direction isolation, without
 * depending on a font that knows the invisible marks (some render them as boxes).
 */
export function Bidi({ text }: { text: string }) {
  const parts = text.split(/(⁨[^⁩]*⁩)/);
  return <>{parts.map((part, i) => (part.startsWith("⁨") ? <bdi key={i}>{part.slice(1, -1)}</bdi> : part))}</>;
}
