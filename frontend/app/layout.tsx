import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/theme/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Mailrova",
  description: "Self-hosted email marketing platform",
};

// Runs before hydration to avoid a flash of the wrong theme — reads the same
// key ThemeContext writes to.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("mailrova_theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* The tab favicon is drawn by the browser chrome, outside page JS —
            it can only react to the OS-level prefers-color-scheme media
            query, not the in-app manual theme toggle. This matches the
            app's own default before a user picks a theme. */}
        <link rel="icon" href="/favicon-light-32.png" sizes="32x32" type="image/png" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/favicon-light-16.png" sizes="16x16" type="image/png" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/favicon-dark-32.png" sizes="32x32" type="image/png" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/favicon-dark-16.png" sizes="16x16" type="image/png" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/favicon-light-180.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
