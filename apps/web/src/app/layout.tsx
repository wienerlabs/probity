import type { Metadata, Viewport } from "next";
import { Funnel_Display } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeInit } from "@/components/theme-init";
import { WalletShell } from "@/components/wallet/WalletShell";
import { AuthProvider } from "@/components/wallet/auth-context";

const funnel = Funnel_Display({
  subsets: ["latin"],
  variable: "--font-funnel",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Probity — Know before you buy.",
  description:
    "The compliance verdict on every Solana token. Halal, Mushtabah, or Haram — with a citation trail and an on-chain attestation.",
  applicationName: "Probity",
  metadataBase: new URL("https://probity.wienerlabs.com"),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "64x64", type: "image/png" },
      { url: "/probity-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/probity-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icon.png"],
  },
  openGraph: {
    title: "Probity",
    description: "The compliance verdict on every Solana token.",
    type: "website",
    siteName: "Probity",
    images: [
      {
        url: "/probity-icon-512.png",
        width: 512,
        height: 512,
        alt: "Probity",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Probity",
    description: "The compliance verdict on every Solana token.",
    images: ["/probity-icon-512.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={funnel.variable} suppressHydrationWarning>
      <head>
        <ThemeInit />
      </head>
      <body>
        <WalletShell>
          <AuthProvider>
            <div className="min-h-screen w-full flex flex-col">
              <Header />
              <main className="flex-1 w-full">{children}</main>
              <Footer />
            </div>
          </AuthProvider>
        </WalletShell>
      </body>
    </html>
  );
}
