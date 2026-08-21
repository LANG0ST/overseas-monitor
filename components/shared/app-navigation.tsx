"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Truck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/factures", label: "Factures", icon: ReceiptText },
  { href: "/devis", label: "Devis", icon: FileText },
  { href: "/bons-commande", label: "Bons de commande", icon: ClipboardList },
  { href: "/avoirs", label: "Avoirs", icon: WalletCards },
  { href: "/pointage", label: "Pointage", icon: Settings2 },
  { href: "/partenaires", label: "Partenaires", icon: UsersRound },
  { href: "/engins", label: "Parc d’engins", icon: Truck },
] as const;

type AppNavigationProps = {
  avatarUrl?: string;
  isAdmin: boolean;
  userName: string;
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isFactureEditorPath(pathname: string) {
  return (
    pathname === "/pointage/new" ||
    pathname.startsWith("/pointage/") ||
    (pathname.startsWith("/factures/") && pathname !== "/factures/new") ||
    (pathname.startsWith("/devis/") && pathname !== "/devis/new") ||
    (pathname.startsWith("/avoirs/") && pathname !== "/avoirs/new") ||
    (pathname.startsWith("/bons-commande/") && pathname !== "/bons-commande/new")
  );
}

export function DesktopNavigation({ avatarUrl, isAdmin, userName }: AppNavigationProps) {
  const pathname = usePathname();
  if (isFactureEditorPath(pathname)) return null;
  const items = isAdmin
    ? [...navigation, { href: "/permissions", label: "Permissions", icon: ShieldCheck }]
    : navigation;

  return (
    <nav aria-label="Navigation principale" className="hidden w-56 shrink-0 flex-col gap-3 md:flex print:hidden">
      <div className="glass-card mb-3 flex h-16 items-center gap-3 rounded-2xl px-4">
        {avatarUrl ? (
          <Image alt="Photo de profil" className="size-9 rounded-full object-cover" height={72} src={avatarUrl} unoptimized width={72} />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
            {userName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">{userName}</p>
          <p className="mt-0.5 text-xs text-neutral-500">{isAdmin ? "Administrateur" : "Utilisateur"}</p>
        </div>
      </div>
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActivePath(pathname, href);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
              active
                ? "bg-ink-900 text-white shadow-sm"
                : "bg-white/85 text-neutral-600 shadow-sm backdrop-blur-xl hover:bg-white"
            )}
            href={href}
            key={href}
          >
            <Icon size={20} strokeWidth={1.75} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavigation({ isAdmin }: AppNavigationProps) {
  const pathname = usePathname();
  if (isFactureEditorPath(pathname)) return null;
  const items = isAdmin
    ? [...navigation, { href: "/permissions", label: "Permissions", icon: ShieldCheck }]
    : navigation;

  return (
    <nav aria-label="Navigation mobile" className="glass-card fixed inset-x-3 bottom-3 z-20 flex gap-1 overflow-x-auto rounded-2xl p-2 md:hidden print:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActivePath(pathname, href);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={cn(
              "flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors",
              active ? "bg-ink-900 text-white" : "text-neutral-600"
            )}
            href={href}
            key={href}
          >
            <Icon size={19} strokeWidth={1.75} />
            <span className="max-w-14 truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
