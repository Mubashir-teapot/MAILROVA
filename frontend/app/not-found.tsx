import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[380px] p-8 text-center shadow-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5 text-foreground">
          <LogoMark size={24} />
          <span className="text-base font-semibold tracking-tight">Mailrova</span>
        </div>
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">The page you're looking for doesn't exist or was moved.</p>
        <Button asChild className="mt-6 w-full">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </Card>
    </div>
  );
}
