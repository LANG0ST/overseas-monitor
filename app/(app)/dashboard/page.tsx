import Link from "next/link";
import { ClipboardList, FilePlus2, FileText, Gauge } from "lucide-react";
import { getAccessibleResources } from "@/lib/auth/can-edit";
import type { Resource } from "@/lib/auth/resources";
import { createClient } from "@/lib/supabase/server";

const actions = [
  { href: "/factures", label: "Factures", icon: FilePlus2, detail: "Créer ou reprendre une facture", resource: "factures", type: "facture" },
  { href: "/devis", label: "Devis", icon: FileText, detail: "Préparer ou reprendre un devis", resource: "devis", type: "devis" },
  { href: "/bons-commande", label: "Bons de commande", icon: ClipboardList, detail: "Gérer les commandes", resource: "bons_commande", type: "bon_commande" },
  { href: "/pointage", label: "Pointage", icon: Gauge, detail: "Continuer le mois en cours", resource: "pointage", type: null },
] as const;

const documentInfo = {
  facture: { label: "Facture", path: "/factures" },
  devis: { label: "Devis", path: "/devis" },
  bon_commande: { label: "Bon de commande", path: "/bons-commande" },
  avoir: { label: "Avoir", path: "/avoirs" },
} as const;

function formatAmount(amount: number) {
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(amount);
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const [{ data: profile }, allowedResources] = await Promise.all([
    userId ? supabase.from("profiles").select("role").eq("id", userId).maybeSingle() : Promise.resolve({ data: null }),
    getAccessibleResources(),
  ]);
  const isAdmin = profile?.role === "admin";
  const visibleActions = actions.filter((action) => allowedResources.includes(action.resource as Resource));
  const allowedTypes: string[] = visibleActions.flatMap((action) => action.type ? [action.type] : []);
  if (allowedResources.includes("avoirs")) allowedTypes.push("avoir");

  const today = new Date();
  const ym = today.toISOString().slice(0, 7);
  const monthStart = `${ym}-01`;
  const recentPromise = allowedTypes.length
    ? supabase.from("documents").select("id, type, number, client_name, updated_at, created_by").eq("is_active", true).in("type", allowedTypes).order("updated_at", { ascending: false }).limit(8)
    : Promise.resolve({ data: [] });
  const canAccessFactures = allowedResources.includes("factures");
  const draftsPromise = userId && canAccessFactures
    ? supabase.from("documents").select("id", { count: "exact", head: true }).eq("type", "facture").eq("is_active", true).eq("created_by", userId).is("number", null)
    : Promise.resolve({ count: 0 });
  let pointagePromise = allowedResources.includes("pointage")
    ? supabase.from("pointage_sheets").select("id", { count: "exact", head: true }).eq("is_active", true).eq("ym", ym)
    : null;
  if (pointagePromise && isAdmin) pointagePromise = pointagePromise.is("facture_id", null);
  const invoicesPromise = isAdmin
    ? supabase.from("documents").select("ttc, paid").eq("type", "facture").eq("is_active", true).not("number", "is", null).gte("date", monthStart).lte("date", today.toISOString().slice(0, 10))
    : Promise.resolve({ data: [] });

  const [recentResult, draftsResult, pointageResult, invoicesResult] = await Promise.all([
    recentPromise,
    draftsPromise,
    pointagePromise ?? Promise.resolve({ count: 0 }),
    invoicesPromise,
  ]);
  const recent = recentResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const monthlyTtc = invoices.reduce((sum, invoice) => sum + Number(invoice.ttc ?? 0), 0);
  const unpaid = invoices.filter((invoice) => !invoice.paid);
  const unpaidTotal = unpaid.reduce((sum, invoice) => sum + Number(invoice.ttc ?? 0), 0);

  const creatorIds = isAdmin ? [...new Set(recent.map((document) => document.created_by).filter(Boolean))] as string[] : [];
  const { data: creators } = creatorIds.length
    ? await supabase.from("profiles").select("id, name").in("id", creatorIds)
    : { data: [] };
  const creatorNames = new Map((creators ?? []).map((creator) => [creator.id, creator.name]));

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-medium text-neutral-500">Vue d’ensemble</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">Tableau de bord</h1>
      </div>

      <section aria-label="Actions rapides" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {visibleActions.map(({ href, label, icon: Icon, detail }) => (
          <Link className="glass-card group rounded-2xl p-4 transition-transform hover:-translate-y-0.5" href={href} key={href}>
            <div className="flex size-11 items-center justify-center rounded-full bg-primary-100 text-primary-600"><Icon size={21} strokeWidth={1.75} /></div>
            <h2 className="mt-4 font-semibold text-neutral-900">{label}</h2>
            <p className="mt-1 text-sm text-neutral-500">{detail}</p>
          </Link>
        ))}
      </section>

      {isAdmin ? (
        <section aria-label="Statistiques utiles" className="grid gap-3 sm:grid-cols-3">
          <div className="glass-card rounded-2xl p-5"><p className="text-sm text-neutral-500">TTC facturé ce mois</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{formatAmount(monthlyTtc)}</p></div>
          <div className="glass-card rounded-2xl p-5"><p className="text-sm text-neutral-500">Impayé ce mois</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{formatAmount(unpaidTotal)}</p><p className="mt-1 text-xs text-neutral-500">{unpaid.length} facture{unpaid.length === 1 ? "" : "s"}</p></div>
          <div className="glass-card rounded-2xl p-5"><p className="text-sm text-neutral-500">Pointages à facturer</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{pointageResult.count ?? 0}</p></div>
        </section>
      ) : (
        <section aria-label="Travail à reprendre" className="grid gap-3 sm:grid-cols-2">
          {canAccessFactures ? <Link className="glass-card rounded-2xl p-5" href="/factures?drafts=mine"><p className="text-sm text-neutral-500">Mes brouillons de facture</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{draftsResult.count ?? 0}</p></Link> : null}
          {allowedResources.includes("pointage") ? <Link className="glass-card rounded-2xl p-5" href={`/pointage?ym=${ym}`}><p className="text-sm text-neutral-500">Pointages du mois</p><p className="mt-2 text-2xl font-semibold text-neutral-900">{pointageResult.count ?? 0}</p></Link> : null}
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-5 py-4"><h2 className="font-semibold text-neutral-900">Documents récents</h2></div>
        <div className="divide-y divide-neutral-100">
          {recent.map((document) => {
            const info = documentInfo[document.type as keyof typeof documentInfo];
            return (
              <Link className="flex min-h-16 items-center justify-between gap-4 px-5 py-3 hover:bg-neutral-50" href={`${info.path}/${document.id}`} key={document.id}>
                <div className="min-w-0"><p className="truncate font-semibold text-neutral-900">{document.number || `${info.label} · Brouillon`}</p><p className="truncate text-sm text-neutral-500">{document.client_name || "Client non renseigné"}{isAdmin && document.created_by ? ` · ${creatorNames.get(document.created_by) || "Utilisateur"}` : ""}</p></div>
                <time className="shrink-0 text-right text-xs text-neutral-500" dateTime={document.updated_at}>{formatUpdatedAt(document.updated_at)}</time>
              </Link>
            );
          })}
          {recent.length === 0 ? <p className="px-5 py-8 text-center text-sm text-neutral-500">Aucun document récent.</p> : null}
        </div>
      </section>
    </div>
  );
}
