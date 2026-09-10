import { ComponentType } from "react";
import {
  LayoutDashboard,
  Users,
  List,
  Megaphone,
  LayoutTemplate,
  Image as LucideImage,
  MailWarning,
  ShieldCheck,
  Settings,
  LogOut,
  Trash2,
  X,
  Upload,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Copy,
  Heading,
  Type,
  RectangleHorizontal,
  SeparatorHorizontal,
  UnfoldVertical,
  Check,
  Sun,
  Moon,
  Globe,
  AtSign,
  Ban,
  KeyRound,
  ScrollText,
  Eye,
  EyeOff,
  type LucideProps,
} from "lucide-react";

// Thin wrapper so every icon defaults to the same size/stroke this app used
// before (18px, 1.75 stroke) instead of lucide's own defaults (24px, 2) —
// call sites can still override via explicit size/strokeWidth/width/height
// props, which win since they're spread last.
function withDefaults(Icon: ComponentType<LucideProps>) {
  return function Wrapped(props: LucideProps) {
    return <Icon size={18} strokeWidth={1.75} {...props} />;
  };
}

export const DashboardIcon = withDefaults(LayoutDashboard);
export const UsersIcon = withDefaults(Users);
export const ListIcon = withDefaults(List);
export const CampaignIcon = withDefaults(Megaphone);
export const TemplateIcon = withDefaults(LayoutTemplate);
export const MediaIcon = withDefaults(LucideImage);
export const BounceIcon = withDefaults(MailWarning);
export const RoleIcon = withDefaults(ShieldCheck);
export const SettingsIcon = withDefaults(Settings);
export const LogoutIcon = withDefaults(LogOut);
export const TrashIcon = withDefaults(Trash2);
export const CloseIcon = withDefaults(X);
export const UploadIcon = withDefaults(Upload);
export const GripIcon = withDefaults(GripVertical);
export const ArrowUpIcon = withDefaults(ArrowUp);
export const ArrowDownIcon = withDefaults(ArrowDown);
export const DuplicateIcon = withDefaults(Copy);
export const HeadingIcon = withDefaults(Heading);
export const TextBlockIcon = withDefaults(Type);
export const ButtonBlockIcon = withDefaults(RectangleHorizontal);
export const DividerBlockIcon = withDefaults(SeparatorHorizontal);
export const SpacerBlockIcon = withDefaults(UnfoldVertical);
export const CheckIcon = withDefaults(Check);
export const SunIcon = withDefaults(Sun);
export const MoonIcon = withDefaults(Moon);
export const GlobeIcon = withDefaults(Globe);
export const AtSignIcon = withDefaults(AtSign);
export const BlockIcon = withDefaults(Ban);
export const KeyIcon = withDefaults(KeyRound);
export const AuditLogIcon = withDefaults(ScrollText);
export const EyeIcon = withDefaults(Eye);
export const EyeOffIcon = withDefaults(EyeOff);
