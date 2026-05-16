import type { Citation } from "@/lib/types";
import { truncateMiddle } from "@/lib/format";

export function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">No citations recorded.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {citations.map((c, idx) => (
        <li key={idx} className="surface-2 p-3.5 text-sm">
          <Row citation={c} />
        </li>
      ))}
    </ul>
  );
}

function Row({ citation }: { citation: Citation }) {
  if (citation.type === "onchain") {
    return (
      <div className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-1.5">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
          on-chain
        </span>
        <span className="mono text-[var(--color-text)]">
          {truncateMiddle(citation.account)}
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
          field
        </span>
        <span className="text-[var(--color-muted)]">
          <span className="mono">{citation.field}</span>{" "}
          <span className="text-[var(--color-text)]">= </span>
          <span className="mono">{citation.value}</span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
          slot
        </span>
        <span className="mono num text-[var(--color-muted)]">
          {citation.slot.toLocaleString()}
        </span>
      </div>
    );
  }
  if (citation.type === "document") {
    return (
      <div className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-1.5">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
          document
        </span>
        <a
          href={citation.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--color-text)] hover:underline mono"
        >
          {citation.sourceUrl}
        </a>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
          excerpt
        </span>
        <span className="text-[var(--color-muted)] leading-relaxed">
          “{citation.excerpt}”
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
          hash
        </span>
        <span className="mono text-[var(--color-muted-2)] text-xs">
          {citation.contentHash}
        </span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-1.5">
      <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
        derived
      </span>
      <span className="mono text-[var(--color-text)]">{citation.formula}</span>
      <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)]">
        result
      </span>
      <span className="mono text-[var(--color-muted)]">{citation.result}</span>
    </div>
  );
}
