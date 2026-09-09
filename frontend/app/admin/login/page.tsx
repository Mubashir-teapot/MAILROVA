"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/auth/AuthContext";
import { useTheme } from "@/theme/ThemeContext";
import { LogoMark } from "@/components/Logo";
import { MoonIcon, SunIcon } from "@/components/icons";

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password);
      router.push("/");
    } catch {
      setError("Invalid username or password");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <button
        onClick={toggle}
        className="absolute right-5 top-5 rounded-md p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <SunIcon width={16} height={16} /> : <MoonIcon width={16} height={16} />}
      </button>

      <form onSubmit={handleSubmit} className="card flex w-80 flex-col gap-4">
        <div className="flex items-center gap-2">
          <LogoMark size={26} />
          <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">Mailrova</span>
        </div>
        <div>
          <h1 className="text-sm font-medium text-slate-900 dark:text-slate-100">Sign in to your account</h1>
          <p className="text-xs text-slate-400">Enter your admin credentials to continue</p>
        </div>
        <label className="label">
          Username
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label className="label">
          Password
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn">
          Log in
        </button>
      </form>
    </div>
  );
}
