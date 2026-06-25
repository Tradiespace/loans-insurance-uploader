import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans, Fira_Code } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tradiespace · Data Uploader",
  description: "Upload loans and insurance data to Tradiespace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${jakarta.variable} ${firaCode.variable} h-full antialiased`}
    >
      <Analytics/>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
