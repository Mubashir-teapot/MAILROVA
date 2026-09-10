"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlatformAuth } from "@/auth/PlatformAuthContext";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-80 p-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <LogoMark size={26} />
            <span className="text-base font-semibold tracking-tight text-foreground">Mailrova Platform</span>
          </div>
          <div>
            <h1 className="text-sm font-medium text-foreground">Platform admin sign in</h1>
            <p className="text-xs text-muted-foreground">Manages tenants — separate from any organization's own login.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit">Log in</Button>
        </form>
      </Card>
    </div>
  );
}
