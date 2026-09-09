// Shared loading/empty-state primitives — every page previously rolled its
// own inline "Loading…" text and empty-row message; this just makes them
// consistent instead of introducing new visual language.
export function Loading() {
  return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-slate-400">{message}</p>;
}
