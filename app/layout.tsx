import type { Metadata } from "next";
import { Space_Grotesk, Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display-next", weight: ["500", "600", "700"] });
const sans = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-sans-next", weight: ["400", "500", "600", "700"] });
const mono = IBM_Plex_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-mono-next", weight: ["400", "500", "600"] });

export const metadata: Metadata = { title: "Form-Filling Assistant", description: "Заполняйте документы данными из ваших файлов" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
