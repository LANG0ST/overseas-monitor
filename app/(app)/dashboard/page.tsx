import Link from "next/link";
import { ClipboardList, FilePlus2, FileText, Gauge } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const actions = [
  { href: "/factures", label: "Nouvelle facture", icon: FilePlus2, detail: "Créer un document de facturation" },
  { href: "/devis", label: "Nouveau devis", icon: FileText, detail: "Préparer une proposition" },
  { href: "/bons-commande", label: "Nouveau bon de commande", icon: ClipboardList, detail: "Enregistrer une commande" },
  { href: "/pointage", label: "Pointage", icon: Gauge, detail: "Saisir les présences du mois" },
] as const;

function formatAmount(amount: number) {
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(amount);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const { data: documents } = await supabase
    .from("documents")
    .select("ttc, paid")
    .eq("type", "facture")
    .eq("is_active", true)
    .gte("date", startOfMonth.toISOString().slice(0, 10))
    .lte("date", today.toISOString().slice(0, 10));

  const factures = documents ?? [];
  const totalTtc = factures.reduce((sum, document) => sum + Number(document.ttc ?? 0), 0);
  const unpaidTotal = factures.reduce(
    (sum, document) => sum + (document.paid ? 0 : Number(document.ttc ?? 0)),
    0
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-neutral-500">Vue d’ensemble</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">Tableau de bord</h1>
      </div>

      <section aria-label="Actions rapides" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map(({ href, label, icon: Icon, detail }) => (
          <Link
            className="glass-card group rounded-2xl p-5 transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            href={href}
            key={href}
          >
            <div className="flex size-11 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <Icon size={21} strokeWidth={1.75} />
            </div>
            <h2 className="mt-5 font-semibold text-neutral-900">{label}</h2>
            <p className="mt-1 text-sm text-neutral-500">{detail}</p>
          </Link>
        ))}
      </section>

      <section aria-label="Statistiques du mois" className="grid gap-4 md:grid-cols-3">
        <div className="glass-card rounded-2xl p-6">
          <p className="text-sm text-neutral-500">Factures ce mois-ci</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900">{factures.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <p className="text-sm text-neutral-500">Total TTC</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900">{formatAmount(totalTtc)}</p>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <p className="text-sm text-neutral-500">Total impayé</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900">{formatAmount(unpaidTotal)}</p>
        </div>
      </section>
    </div>
  );
}
