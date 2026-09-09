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
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
