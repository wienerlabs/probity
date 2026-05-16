import Image from "next/image";

export function Footer() {
  return (
    <footer
      className="mt-24"
      style={{ borderTop: "1px solid var(--color-border)" }}
    >
      <div className="container-page py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Image
              src="/probity-mark.png"
              alt=""
              width={18}
              height={18}
              style={{ filter: "invert(var(--logo-invert))", opacity: 0.7 }}
            />
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)]">
              Probity
            </p>
          </div>
          <p className="text-[var(--color-muted)] max-w-[28ch] leading-relaxed">
            The compliance verdict on every Solana token. The fit and proper test for digital
            assets.
          </p>
        </div>

        <FooterCol
          title="Product"
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Framework", href: "/framework" },
            { label: "API", href: "/api" },
            { label: "Institutional", href: "/institutional" },
          ]}
        />
        <FooterCol
          title="Resources"
          items={[
            { label: "Methodology", href: "/methodology" },
            { label: "Rule registry", href: "/rules" },
            { label: "Attestation explorer", href: "/attestations" },
            { label: "Changelog", href: "/changelog" },
          ]}
        />
        <FooterCol
          title="Company"
          items={[
            { label: "Wiener Labs", href: "https://wienerlabs.com" },
            { label: "Contact", href: "/contact" },
            { label: "Terms", href: "/terms" },
            { label: "Privacy", href: "/privacy" },
          ]}
        />
      </div>

      <div
        className="container-page pb-10 flex items-center justify-between text-xs text-[var(--color-muted-2)]"
        style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.5rem" }}
      >
        <span>© 2026 Wiener Labs · MIT</span>
        <span className="mono">rule_version 0.1.0</span>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted-2)] mb-3">
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.label}>
            <a
              href={it.href}
              className="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
