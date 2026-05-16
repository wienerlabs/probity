import Link from "next/link";
import Image from "next/image";

export function Header() {
  return (
    <header className="hairline">
      <div className="container-page flex items-center justify-between h-16">
        <Link
          href="/"
          className="flex items-center gap-3 tracking-tight"
          aria-label="Probity home"
        >
          <Wordmark />
          <span className="text-xs mono uppercase text-[var(--color-muted-2)] tracking-[0.2em]">
            v0
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm text-[var(--color-muted)]">
          <Link href="/" className="hover:text-[var(--color-text)] transition-colors">
            Dashboard
          </Link>
          <Link
            href="/framework"
            className="hover:text-[var(--color-text)] transition-colors"
          >
            Framework
          </Link>
          <Link href="/api" className="hover:text-[var(--color-text)] transition-colors">
            API
          </Link>
          <Link
            href="/institutional"
            className="px-3 py-1.5 surface-2 hover:border-[var(--color-border-strong)] transition-colors text-[var(--color-text)]"
          >
            Institutional
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Image
        src="/probity-mark.png"
        alt=""
        width={28}
        height={28}
        priority
        className="block invert"
      />
      <span className="text-lg font-semibold tracking-tight">Probity</span>
    </span>
  );
}
