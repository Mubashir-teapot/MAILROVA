"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/auth/AuthContext";
import { useTheme } from "@/theme/ThemeContext";
import { LogoMark } from "@/components/Logo";
import { EyeIcon, EyeOffIcon, MoonIcon, SunIcon } from "@/components/icons";

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <button
        onClick={toggle}
        className="fixed right-5 top-5 rounded-md p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <SunIcon width={16} height={16} /> : <MoonIcon width={16} height={16} />}
      </button>

      <div className="w-full max-w-[380px] rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-6 flex items-center gap-2.5 text-neutral-900 dark:text-white">
          <LogoMark size={24} />
          <span className="text-base font-semibold tracking-tight">Mailrova</span>
        </div>

        <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">Sign in</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Enter your admin credentials to continue.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Username
            <input
              className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Password
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 pr-8 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
              </button>
            </div>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-neutral-900 px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-400 dark:text-neutral-600">
          Managing tenants instead?{" "}
          <a href="/platform/login" className="font-medium text-neutral-600 hover:underline dark:text-neutral-300">
            Platform admin login
          </a>
        </p>
      </div>
    </div>
  );
}
