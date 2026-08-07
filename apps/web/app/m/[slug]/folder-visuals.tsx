import {
  BadgeCheck,
  BookOpen,
  Folder,
  LifeBuoy,
  Package,
  Ruler,
  ShieldAlert,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * The standard folders every machine is created with carry a stable
 * `systemKey` (see STANDARD_MACHINE_FOLDERS), which lets the viewer show a
 * recognisable icon per section. Custom folders fall back to a plain folder.
 */
const FOLDER_ICONS: Record<string, LucideIcon> = {
  manual: BookOpen,
  safety: ShieldAlert,
  maintenance: Wrench,
  "spare-parts": Package,
  declaration: BadgeCheck,
  wiring: Zap,
  cad: Ruler,
  service: LifeBuoy,
};

export function FolderIcon({
  systemKey,
  className,
}: {
  systemKey: string | null;
  className?: string;
}) {
  const Icon = (systemKey && FOLDER_ICONS[systemKey]) || Folder;
  return <Icon className={className} aria-hidden="true" />;
}
