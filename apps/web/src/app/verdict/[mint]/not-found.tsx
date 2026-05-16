import Link from "next/link";
import { LookupForm } from "@/components/lookup-form";

export default function NotFound() {
  return (
    <div className="container-page py-24 max-w-2xl">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
        404
      </p>
      <h1 className="mt-3 text-3xl font-light tracking-tight">
        <span className="font-semibold">No verdict on file</span> for that input.
      </h1>
      <p className="mt-4 text-[var(--color-muted)] leading-relaxed">
        The demo dataset covers a small set of fabricated mints. Try a known
        demo token below, or return to the dashboard.
      </p>
      <div className="mt-8">
        <LookupForm />
      </div>
      <Link
        href="/"
        className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)] hover:text-[var(--color-text)] transition-colors"
      >
        ← Back to dashboard
      </Link>
    </div>
  );
}
