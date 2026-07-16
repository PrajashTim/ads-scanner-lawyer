import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lawyer Ad Signal",
  description: "Find active lawyer advertisers and turn real ad signals into specific YouTube opportunity emails.",
  metadataBase: new URL("https://lawyer-ad-signal.blackmamba7193.chatgpt.site"),
  openGraph: { title: "Lawyer Ad Signal", description: "Turn active lawyer ads into better cold emails.", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "Lawyer Ad Signal", description: "Turn active lawyer ads into better cold emails.", images: ["/og.png"] },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
