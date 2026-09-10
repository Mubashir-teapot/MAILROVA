"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/auth/AuthContext";
import { useTheme } from "@/theme/ThemeContext";
import { LogoMark } from "@/components/Logo";
import { BounceIcon, CampaignIcon, GlobeIcon, MoonIcon, RoleIcon, SunIcon } from "@/components/icons";

const HIGHLIGHTS = [
  { icon: CampaignIcon, text: "Campaigns, transactional email, and a visual template builder" },
  { icon: GlobeIcon, text: "Your own domains, DKIM/SPF/DMARC verified from the app" },
  { icon: RoleIcon, text: "Tenant-isolated, HttpOnly sessions, hashed API keys" },
  { icon: BounceIcon, text: "Bounce handling and suppression built in, not bolted on" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      router.push("/");
    } catch {
      setError("Invalid username or password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white dark:bg-slate-950">
      {/* Brand panel — hidden below lg, this is what turns "a box on a blank
          page" into something that reads as a real product's sign-in. */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-ink p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <LogoMark size={28} />
          <span className="text-lg font-semibold tracking-tight">Mailrova</span>
        </div>

        <div className="relative flex flex-col gap-8">
          <h2 className="max-w-sm text-2xl font-semibold leading-snug tracking-tight">
            Self-hosted email marketing, without renting your sending reputation from someone else.
          </h2>
          <ul className="flex flex-col gap-4">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-start gap-3 text-sm text-slate-300">
                <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-md bg-white/10">
                  <h.icon width={15} height={15} />
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} UA Technologies</p>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
        <button
          onClick={toggle}
          className="absolute right-5 top-5 rounded-md p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <SunIcon width={16} height={16} /> : <MoonIcon width={16} height={16} />}
        </button>

        <div className="flex w-full max-w-[360px] flex-col gap-8">
          <div className="flex items-center gap-2.5 lg:hidden">
            <LogoMark size={26} />
            <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">Mailrova</span>
          </div>

          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Sign in</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter your admin credentials to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="label">
              Username
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </label>
            <label className="label">
              Password
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {/* Monochrome, matching the ink-black brand panel, rather than
                the shared blue .btn — a bright accent color reads wrong as
                the dominant color of a dark page. Inverts per theme: dark
                button on light background, light button on dark background. */}
            <button
              type="submit"
              className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-ink px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-ink dark:hover:bg-slate-200"
              disabled={submitting}
            >
              {submitting ? "Signing in…" : "Log in"}
            </button>
          </form>

          <p className="text-xs text-slate-400 dark:text-slate-600">
            Managing tenants instead?{" "}
            <a href="/platform/login" className="font-medium text-accent hover:underline">
              Platform admin login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
