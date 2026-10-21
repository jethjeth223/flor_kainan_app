import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flor’s Kainan · Your everyday kitchen",
  description:
    "Lutong bahay, alagang Flor. Simple menus, pickup orders, payments, and utang records.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/app-icon.svg",
    shortcut: "/app-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-PH">
      <body className="antialiased">{children}</body>
    </html>
  );
}
