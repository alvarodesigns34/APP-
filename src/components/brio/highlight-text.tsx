import { useMemo } from "react";
import { highlightParts } from "@/lib/brio/highlight";

/**
 * Renders a name with the part that matched the query picked out, so a result
 * list shows why each row is there — useful when an accent-insensitive or
 * multi-word match is not obvious at a glance.
 */
export function HighlightText({ text, query }: { text: string; query: string }) {
  const parts = useMemo(() => highlightParts(text, query), [text, query]);
  if (parts.length === 1 && !parts[0].hit) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-[3px] bg-primary/15 px-0 text-inherit">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
