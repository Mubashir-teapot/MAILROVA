export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="1" y="1" width="22" height="22" rx="6" fill="#1d4ed8" />
      <path
        d="M5.5 8.2 12 12.6l6.5-4.4"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="5" y="7.5" width="14" height="9.5" rx="1.6" stroke="white" strokeWidth="1.6" />
    </svg>
  );
}
