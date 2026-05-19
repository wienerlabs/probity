import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";
import { WalletButton } from "./wallet/WalletButton";

export function Header() {
  return (
    <header
      className="sticky top-0 z-30 backdrop-blur"
      style={{
        background:
          "color-mix(in oklab, var(--color-bg) 80%, transparent)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="container-page flex items-center justify-between h-16">
        <Link
          href="/"
          className="flex items-center gap-2.5 tracking-tight"
          aria-label="Probity home"
        >
          <Image
            src="/probity-mark.png"
            alt=""
            width={28}
            height={28}
            priority
            style={{ filter: "invert(var(--logo-invert))" }}
            className="block"
          />
          <span className="text-lg font-semibold tracking-tight">Probity</span>
          <span className="text-[10px] mono uppercase tracking-[0.2em] text-[var(--color-muted-2)] ml-1">
            v0
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm text-[var(--color-muted)]">
          <NavLink href="/">Dashboard</NavLink>
          <NavLink href="/framework">Framework</NavLink>
          <NavLink href="/api">API</NavLink>
          <span className="mx-2 h-5 w-px bg-[var(--color-border)]" />
          <ThemeToggle />
          <span className="mx-2 h-5 w-px bg-[var(--color-border)]" />
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: "/" | "/framework" | "/api";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-full hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
    >
      {children}
    </Link>
  );
}
