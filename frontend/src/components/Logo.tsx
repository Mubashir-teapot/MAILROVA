// Matches icons.tsx's visual language (stroke-only, currentColor, no fill)
// instead of a standalone colored app-icon square — so it reads as part of
// the same clean icon set everywhere it's used, light sidebar, dark
// sidebar, login panel, rather than a mismatched logo dropped on top.
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 7.2 12 13l9-5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
