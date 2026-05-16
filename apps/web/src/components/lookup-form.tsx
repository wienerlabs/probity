"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LookupForm({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    startTransition(() => {
      router.push(`/verdict/${encodeURIComponent(q)}`);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="input flex items-center gap-2 p-1.5 w-full max-w-2xl"
      role="search"
    >
      <span
        aria-hidden
        className="pl-3 pr-1 text-[var(--color-muted-2)] text-[10px] mono uppercase tracking-[0.2em]"
      >
        mint /
      </span>
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="Paste a mint address or ticker"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 bg-transparent outline-none px-2 py-2.5 text-[var(--color-text)] placeholder:text-[var(--color-muted-2)] mono text-sm"
        aria-label="Token mint or ticker"
      />
      <button
        type="submit"
        disabled={pending || !value.trim()}
        className="btn btn-primary text-sm"
      >
        {pending ? "Screening" : "Screen"}
      </button>
    </form>
  );
}
