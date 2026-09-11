"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  Ellipsis,
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
import type { Resource } from "@/lib/auth/resources";

const navigation = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, resource: null },
  { href: "/factures", label: "Factures", icon: ReceiptText, resource: "factures" },
  { href: "/devis", label: "Devis", icon: FileText, resource: "devis" },
  { href: "/bons-commande", label: "Bons de commande", icon: ClipboardList, resource: "bons_commande" },
  { href: "/avoirs", label: "Avoirs", icon: WalletCards, resource: "avoirs" },
  { href: "/pointage", label: "Pointage", icon: Settings2, resource: "pointage" },
  { href: "/partenaires", label: "Partenaires", icon: UsersRound, resource: "partenaires" },
  { href: "/engins", label: "Parc d’engins", icon: Truck, resource: "engins" },
] as const;

type AppNavigationProps = {
  allowedResources: Resource[];
  avatarUrl?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
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

export function DesktopNavigation({ allowedResources, avatarUrl, isAdmin, isSuperAdmin, userName }: AppNavigationProps) {
  const pathname = usePathname();
  if (isFactureEditorPath(pathname)) return null;
  const visibleNavigation = navigation.filter((item) => item.resource === null || allowedResources.includes(item.resource));
  const items = isAdmin
    ? [...visibleNavigation, { href: "/permissions", label: "Permissions", icon: ShieldCheck, resource: null }]
    : visibleNavigation;

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
          <p className="mt-0.5 text-xs text-neutral-500">{isSuperAdmin ? "Super-administrateur" : isAdmin ? "Administrateur" : "Utilisateur"}</p>
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

export function MobileNavigation({ allowedResources, isAdmin }: AppNavigationProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);
  if (isFactureEditorPath(pathname)) return null;
  const visibleNavigation = navigation.filter((item) => item.resource === null || allowedResources.includes(item.resource));
  const items = isAdmin
    ? [...visibleNavigation, { href: "/permissions", label: "Permissions", icon: ShieldCheck, resource: null }]
    : visibleNavigation;
  const primaryHrefs = new Set(["/dashboard", "/factures", "/devis", "/bons-commande"]);
  const primaryItems = items.filter((item) => primaryHrefs.has(item.href));
  const secondaryItems = items.filter((item) => !primaryHrefs.has(item.href));
  const secondaryActive = secondaryItems.some((item) => isActivePath(pathname, item.href));

  return (
    <>
      {menuOpen ? (
        <button
          aria-label="Fermer le menu"
          className="fixed inset-0 z-20 bg-ink-900/20 md:hidden print:hidden"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      ) : null}
      <nav
        aria-label="Navigation mobile"
        className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 gap-1 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl md:hidden print:hidden"
      >
        {primaryItems.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          const shortLabel = href === "/dashboard" ? "Accueil" : href === "/bons-commande" ? "Bons" : label;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors",
                active ? "bg-ink-900 text-white" : "text-neutral-600 hover:bg-neutral-100",
              )}
              href={href}
              key={href}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={20} strokeWidth={1.75} />
              <span className="w-full truncate text-center">{shortLabel}</span>
            </Link>
          );
        })}
        <div className="relative min-w-0">
          {menuOpen ? (
            <div className="absolute bottom-full right-0 mb-3 w-64 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-2 shadow-2xl">
              {secondaryItems.map(({ href, label, icon: Icon }) => {
                const active = isActivePath(pathname, href);
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                      active ? "bg-ink-900 text-white" : "text-neutral-700 hover:bg-neutral-100",
                    )}
                    href={href}
                    key={href}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon size={19} strokeWidth={1.75} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
          <button
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Plus de pages"
            className={cn(
              "flex h-full w-full min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors",
              menuOpen || secondaryActive ? "bg-ink-900 text-white" : "text-neutral-600 hover:bg-neutral-100",
            )}
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <Ellipsis size={21} strokeWidth={2} />
            <span>Plus</span>
          </button>
        </div>
      </nav>
    </>
  );
}
