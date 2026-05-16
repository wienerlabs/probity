import type { Metadata } from "next";
import { Funnel_Display } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeInit } from "@/components/theme-init";

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
  metadataBase: new URL("https://probity.wienerlabs.com"),
  openGraph: {
    title: "Probity",
    description: "The compliance verdict on every Solana token.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={funnel.variable} suppressHydrationWarning>
      <head>
        <ThemeInit />
      </head>
      <body>
        <div className="min-h-screen w-full flex flex-col">
          <Header />
          <main className="flex-1 w-full">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
