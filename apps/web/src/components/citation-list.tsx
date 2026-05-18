"use client";

import { useState } from "react";
import type { Citation } from "@/lib/types";
import { truncateMiddle } from "@/lib/format";

interface Props {
  citations: Citation[];
  dense?: boolean;
}

const EXPLORER_BASE = "https://explorer.solana.com";

function explorerAccount(account: string): string {
  return `${EXPLORER_BASE}/address/${encodeURIComponent(account)}`;
}

function explorerSlot(slot: number): string {
  return `${EXPLORER_BASE}/block/${slot}`;
}

export function CitationList({ citations, dense = false }: Props) {
  if (!citations.length) {
    return (
      <p className="text-sm text-[var(--color-muted)]">No citations recorded.</p>
    );
  }
  return (
    <ul className={dense ? "space-y-1.5" : "space-y-2"}>
      {citations.map((c, idx) => (
        <li
          key={idx}
          className={`surface-2 ${dense ? "p-2.5" : "p-3.5"} text-sm`}
        >
          <CitationRow citation={c} />
        </li>
      ))}
    </ul>
  );
}

function CitationRow({ citation }: { citation: Citation }) {
  if (citation.type === "onchain") return <OnchainCitation c={citation} />;
  if (citation.type === "document") return <DocumentCitation c={citation} />;
  return <DerivationCitation c={citation} />;
}

function OnchainCitation({
  c,
}: {
  c: Extract<Citation, { type: "onchain" }>;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-1.5">
      <Label>on-chain</Label>
      <div className="flex items-center gap-2 min-w-0">
        <a
          href={explorerAccount(c.account)}
          target="_blank"
          rel="noreferrer"
          className="mono text-[var(--color-text)] truncate hover:underline"
          title={c.account}
        >
          {truncateMiddle(c.account)}
        </a>
        <CopyButton value={c.account} />
        <ExplorerBadge href={explorerAccount(c.account)} label="explorer" />
      </div>
      <Label>field</Label>
      <span className="text-[var(--color-muted)] break-words">
        <span className="mono">{c.field}</span>{" "}
        <span className="text-[var(--color-text)]">=</span>{" "}
        <span className="mono">{c.value}</span>
      </span>
      <Label>slot</Label>
      <a
        href={explorerSlot(c.slot)}
        target="_blank"
        rel="noreferrer"
        className="mono num text-[var(--color-muted)] hover:underline w-fit"
      >
        {c.slot.toLocaleString()}
      </a>
    </div>
  );
}

function DocumentCitation({
  c,
}: {
  c: Extract<Citation, { type: "document" }>;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-1.5">
      <Label>document</Label>
      <div className="flex items-center gap-2 min-w-0">
        <a
          href={c.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--color-text)] hover:underline mono truncate"
          title={c.sourceUrl}
        >
          {c.sourceUrl}
        </a>
        <CopyButton value={c.sourceUrl} />
      </div>
      <Label>excerpt</Label>
      <span className="text-[var(--color-muted)] leading-relaxed">
        “{c.excerpt}”
      </span>
      <Label>hash</Label>
      <span className="mono text-[var(--color-muted-2)] text-xs">
        {c.contentHash}
      </span>
    </div>
  );
}

function DerivationCitation({
  c,
}: {
  c: Extract<Citation, { type: "derivation" }>;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-1.5">
      <Label>derived</Label>
      <span className="mono text-[var(--color-text)] break-words">
        {c.formula}
      </span>
      <Label>result</Label>
      <span className="mono text-[var(--color-muted)] break-words">
        {c.result}
      </span>
      {c.inputs && c.inputs.length > 0 && (
        <>
          <Label>from</Label>
          <ul className="space-y-1.5">
            {c.inputs.map((inner, i) => (
              <li
                key={i}
                className="px-2 py-1.5 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <CitationRow citation={inner} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-2)] self-start mt-0.5">
      {children}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          /* ignore */
        }
      }}
      className="text-[10px] uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-[6px] border text-[var(--color-muted-2)] hover:text-[var(--color-text)] transition-colors shrink-0"
      style={{ borderColor: "var(--color-border)" }}
      aria-label="copy"
    >
      {done ? "copied" : "copy"}
    </button>
  );
}

function ExplorerBadge({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[10px] uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-[6px] border text-[var(--color-muted-2)] hover:text-[var(--color-text)] transition-colors shrink-0"
      style={{ borderColor: "var(--color-border)" }}
    >
      {label}
    </a>
  );
}
