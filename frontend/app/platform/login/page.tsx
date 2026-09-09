"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlatformAuth } from "@/auth/PlatformAuthContext";
import { LogoMark } from "@/components/Logo";

export default function PlatformLoginPage() {
  const { login } = usePlatformAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password);
      router.push("/platform");
    } catch {
      setError("Invalid username or password");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <form onSubmit={handleSubmit} className="card flex w-80 flex-col gap-4">
        <div className="flex items-center gap-2">
          <LogoMark size={26} />
          <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            Mailrova Platform
          </span>
        </div>
        <div>
          <h1 className="text-sm font-medium text-slate-900 dark:text-slate-100">Platform admin sign in</h1>
          <p className="text-xs text-slate-400">Manages tenants — separate from any organization's own login.</p>
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
