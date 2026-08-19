import Link from "next/link";
import { AvoirCreateForm } from "@/components/shared/avoir-create-form";
import { createClient } from "@/lib/supabase/server";

type AvoirSearchParams = { facture?: string; search?: string; client?: string; from?: string; to?: string };

export default async function NewAvoirPage({ searchParams }: { searchParams: Promise<AvoirSearchParams> }) {
  const filters = await searchParams;
  const supabase = await createClient();
  const selectedId = filters.facture?.trim();
  let query = supabase
    .from("documents")
    .select("id, number, date, client_name")
    .eq("type", "facture")
    .eq("is_active", true)
    .eq("is_locked", true)
    .eq("has_cachet", true)
    .not("number", "is", null);
  if (selectedId) query = query.eq("id", selectedId);
  else {
    if (filters.search?.trim()) query = query.ilike("number", `%${filters.search.trim()}%`);
    if (filters.client?.trim()) query = query.ilike("client_name", `%${filters.client.trim()}%`);
    if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) query = query.gte("date", filters.from);
    if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) query = query.lte("date", filters.to);
  }
  const { data, error } = await query.order("date", { ascending: false }).limit(selectedId ? 1 : 50);
  if (error) throw new Error(error.message);
  const factures = data ?? [];
  const selectedFacture = selectedId ? factures[0] : null;
  const hasSearch = Boolean(filters.search?.trim() || filters.client?.trim() || filters.from || filters.to);

  return <div className="space-y-6"><div><Link className="text-sm font-medium text-primary-700" href="/avoirs">← Avoirs</Link><h1 className="mt-3 text-3xl font-semibold text-neutral-900">Nouvel avoir</h1><p className="mt-2 text-neutral-700">Recherchez la facture concernée pour reprendre automatiquement son client.</p></div>{selectedFacture ? <AvoirCreateForm facture={selectedFacture} /> : <><form className="glass-card grid gap-4 rounded-2xl p-5 md:grid-cols-2 xl:grid-cols-5" method="get"><label className="text-sm font-semibold text-neutral-900">Recherche facture<input className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" defaultValue={filters.search} name="search" placeholder="N° de facture" /></label><label className="text-sm font-semibold text-neutral-900">Client<input className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" defaultValue={filters.client} name="client" placeholder="Nom du client" /></label><label className="text-sm font-semibold text-neutral-900">Du<input className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" defaultValue={filters.from} name="from" type="date" /></label><label className="text-sm font-semibold text-neutral-900">Au<input className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2" defaultValue={filters.to} name="to" type="date" /></label><div className="flex items-end"><button className="w-full rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white" type="submit">Rechercher</button></div></form>{hasSearch ? <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-ink-900 text-xs uppercase tracking-wide text-white"><tr><th className="px-5 py-4">Facture</th><th className="px-5 py-4">Date</th><th className="px-5 py-4">Client</th><th className="px-5 py-4"></th></tr></thead><tbody className="divide-y divide-neutral-200">{factures.map((facture) => <tr key={facture.id}><td className="px-5 py-4 font-semibold">{facture.number}</td><td className="px-5 py-4">{facture.date}</td><td className="px-5 py-4">{facture.client_name}</td><td className="px-5 py-4 text-right"><Link className="rounded-full border border-primary-300 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-900" href={`/avoirs/new?facture=${encodeURIComponent(facture.id)}`}>Sélectionner</Link></td></tr>)}</tbody></table>{factures.length === 0 ? <p className="p-6 text-center text-sm text-neutral-600">Aucune facture ne correspond à cette recherche.</p> : null}</div> : <p className="text-sm text-neutral-600">Recherchez par numéro, client ou date pour trouver la facture à créditer.</p>}</>}</div>;
}
