import type { Metadata } from "next";
import { Space_Grotesk, Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display-next", weight: ["500", "600", "700"] });
const sans = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-sans-next", weight: ["400", "500", "600", "700"] });
const mono = IBM_Plex_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-mono-next", weight: ["400", "500", "600"] });

export const metadata: Metadata = { title: "Form-Filling Assistant", description: "Заполняйте документы данными из ваших файлов" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var d=document.documentElement;var m=document.cookie.match(/(?:^|; )theme=([^;]+)/);var t=m?decodeURIComponent(m[1]):'system';if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}d.dataset.theme=t;var a=document.cookie.match(/(?:^|; )accent=([^;]+)/);if(a){var v=decodeURIComponent(a[1]);if(v==='teal'||v==='indigo'||v==='plum'||v==='rose'){d.dataset.accent=v;}}}catch(e){document.documentElement.dataset.theme='dark';}})();",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
