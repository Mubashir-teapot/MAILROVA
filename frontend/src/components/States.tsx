import { Skeleton } from "@/components/ui/skeleton";

// Shared loading/empty-state primitives — every page previously rolled its
// own inline "Loading…" text and empty-row message; this just makes them
// consistent instead of introducing new visual language.
export function Loading() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-2/3" />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>;
}
