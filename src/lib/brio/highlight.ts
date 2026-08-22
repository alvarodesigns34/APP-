import { norm } from "./format";
import { tokenize } from "./search";

export type HighlightPart = { text: string; hit: boolean };

/**
 * Splits `text` into matched / unmatched runs for the given query, so a result
 * can show *why* it matched.
 *
 * Matching happens on the normalised strings (so "platano" highlights inside
 * "Plátano") but the returned slices come from the original text, keeping the
 * accents on screen. That relies on `norm` being length-preserving — true for
 * the accents Spanish uses, since NFD + stripping combining marks maps each
 * letter to exactly one. The length check below is the safety net: if a locale
 * ever breaks that assumption, the whole string comes back unhighlighted rather
 * than sliced at the wrong offsets.
 */
export function highlightParts(text: string, q: string): HighlightPart[] {
  const plain: HighlightPart[] = [{ text, hit: false }];
  const nq = norm(q).trim();
  if (!nq) return plain;

  const nText = norm(text);
  if (nText.length !== text.length) return plain;

  // Longest first: matching "pollo asado" before "pollo" avoids a short token
  // eating the start of a longer one.
  const needles = [nq, ...tokenize(nq)]
    .filter((t) => t.length > 0)
    .sort((a, b) => b.length - a.length);

  const marked = new Array<boolean>(text.length).fill(false);
  for (const needle of needles) {
    let from = 0;
    for (;;) {
      const at = nText.indexOf(needle, from);
      if (at < 0) break;
      for (let i = at; i < at + needle.length; i++) marked[i] = true;
      from = at + needle.length;
    }
  }

  const parts: HighlightPart[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marked[i] !== marked[start]) {
      parts.push({ text: text.slice(start, i), hit: marked[start] });
      start = i;
    }
  }
  return parts.length ? parts : plain;
}
