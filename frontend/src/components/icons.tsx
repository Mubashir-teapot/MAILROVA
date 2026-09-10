import { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={18}
      height={18}
      {...props}
    />
  );
}

export const DashboardIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Base>
);

export const UsersIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    <circle cx="17.5" cy="8.5" r="2.5" />
    <path d="M15.5 14.2c2.7.4 4.5 2.4 5 5.8" />
  </Base>
);

export const ListIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </Base>
);

export const CampaignIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 11v2a2 2 0 0 0 2 2h1l3 5v-9" />
    <path d="M6 11h3l7-5v14l-7-5" />
    <path d="M19 9a3 3 0 0 1 0 6" />
  </Base>
);

export const TemplateIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 9v12" />
  </Base>
);

export const MediaIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="15" rx="2" />
    <circle cx="8.5" cy="10" r="1.75" />
    <path d="M21 16.5 15.5 11 6 19" />
  </Base>
);

export const BounceIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 12a8 8 0 1 1 3 6.2" />
    <path d="M4 18v-4h4" />
  </Base>
);

export const RoleIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3 4.5 6v6c0 4.5 3 7.5 7.5 9 4.5-1.5 7.5-4.5 7.5-9V6L12 3Z" />
    <path d="m9.5 12 1.75 1.75L14.5 10" />
  </Base>
);

export const SettingsIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </Base>
);

export const LogoutIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Base>
);

export const TrashIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
  </Base>
);

export const CloseIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const UploadIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 16V4" />
    <path d="m7 9 5-5 5 5" />
    <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </Base>
);

export const GripIcon = (p: IconProps) => (
  <Base {...p} strokeWidth={2.4}>
    <circle cx="9" cy="6" r="0.5" fill="currentColor" />
    <circle cx="9" cy="12" r="0.5" fill="currentColor" />
    <circle cx="9" cy="18" r="0.5" fill="currentColor" />
    <circle cx="15" cy="6" r="0.5" fill="currentColor" />
    <circle cx="15" cy="12" r="0.5" fill="currentColor" />
    <circle cx="15" cy="18" r="0.5" fill="currentColor" />
  </Base>
);

export const ArrowUpIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 19V5" />
    <path d="m6 11 6-6 6 6" />
  </Base>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14" />
    <path d="m6 13 6 6 6-6" />
  </Base>
);

export const DuplicateIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Base>
);

export const HeadingIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 5v14M18 5v14M6 12h12" />
  </Base>
);

export const TextBlockIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 6h14M5 12h14M5 18h9" />
  </Base>
);

export const ButtonBlockIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="8" width="18" height="8" rx="4" />
  </Base>
);

export const DividerBlockIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 12h16" />
  </Base>
);

export const SpacerBlockIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3v6M12 15v6" />
    <path d="m9 6 3-3 3 3M9 18l3 3 3-3" />
  </Base>
);

export const CheckIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 13l4 4L19 7" />
  </Base>
);

export const SunIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Base>
);

export const MoonIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
  </Base>
);

export const GlobeIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </Base>
);

export const AtSignIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4 7.5" />
  </Base>
);

export const BlockIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </Base>
);

export const KeyIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12 20 3M17 6l2.5 2.5M14 9l2 2" />
  </Base>
);

export const AuditLogIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 3v4M16 3v4" />
    <rect x="4" y="5" width="16" height="16" rx="2" />
    <path d="M8 13h8M8 17h5" />
  </Base>
);

export const EyeIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

export const EyeOffIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c7 0 10.5 7 10.5 7a13.6 13.6 0 0 1-3.1 4M6.3 6.4C3.4 8.3 1.5 12 1.5 12s3.5 7 10.5 7a10.6 10.6 0 0 0 4.2-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Base>
);
