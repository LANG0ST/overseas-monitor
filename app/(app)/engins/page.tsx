import Link from "next/link";
import { setEnginActive } from "./actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { ConfirmedForm } from "@/components/shared/confirmed-form";
import { canEdit } from "@/lib/auth/can-edit";
import { ENGIN_CATEGORIES, isEnginCategory } from "@/lib/engin-categories";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

export default async function EnginsPage({ searchParams }: { searchParams: Promise<{ inactive?: string; error?: string; q?: string; unit?: string; category?: string; page?: string }> }) {
  const params = await searchParams;
  const showInactive = params.inactive === "1";
  const queryText = params.q?.trim() ?? "";
  const unit = params.unit ?? "";
  const category = params.category ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const supabase = await createClient();
  const editable = await canEdit("engins");
  let query = supabase.from("engins").select("id, name, category, unit, default_price, note", { count: "exact" }).eq("is_active", !showInactive).order("category").order("name");
  if (queryText) query = query.ilike("name", `%${queryText}%`);
  if (unit) query = query.eq("unit", unit);
  if (isEnginCategory(category)) query = query.eq("category", category);
  const { data: engins, count, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const hrefFor = (nextPage: number) => {
    const next = new URLSearchParams();
    if (showInactive) next.set("inactive", "1");
    if (queryText) next.set("q", queryText);
    if (unit) next.set("unit", unit);
    if (category) next.set("category", category);
    next.set("page", String(nextPage));
    return `/engins?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm text-neutral-500">Matériel facturable</p><h1 className="mt-1 text-3xl font-semibold">Parc d’engins</h1></div>
        <div className="flex gap-2"><Link className="rounded-full border bg-white px-4 py-2 text-sm text-ink-900 shadow-sm" href={showInactive ? "/engins" : "/engins?inactive=1"}>{showInactive ? "Actifs" : "Inactifs"}</Link>{editable ? <Link className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white" href="/engins/new">+ Nouveau</Link> : null}</div>
      </div>
      {params.error === "soft-delete" ? <p className="rounded-xl border border-destructive/30 bg-white px-4 py-3 text-sm text-destructive">La modification n’a pas été appliquée. Vérifiez votre permission d’édition et réessayez.</p> : null}
      <form className="glass-card grid gap-3 rounded-2xl p-4 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_280px_180px_auto_auto] xl:items-end" method="get">
        {showInactive ? <input name="inactive" type="hidden" value="1" /> : null}
        <label className="text-sm font-medium">Rechercher<input className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm" defaultValue={queryText} name="q" placeholder="Nom de l’engin" /></label>
        <label className="text-sm font-medium">Catégorie<select className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm" defaultValue={category} name="category"><option value="">Toutes</option>{ENGIN_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-sm font-medium">Unité<select className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm" defaultValue={unit} name="unit"><option value="">Toutes</option><option>Jour</option><option>Mois</option><option>Heure</option><option>Fois</option></select></label>
        <button className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white" type="submit">Filtrer</button>
        {(queryText || unit || category) ? <Link className="rounded-full border bg-white px-4 py-2 text-center text-sm text-ink-900" href={showInactive ? "/engins?inactive=1" : "/engins"}>Effacer</Link> : null}
      </form>
      <div className="glass-card overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-ink-900 text-white"><tr><th className="px-4 py-3 font-semibold">Engin</th><th className="px-4 py-3 font-semibold">Catégorie</th><th className="px-4 py-3 font-semibold">Unité</th><th className="px-4 py-3 text-right font-semibold">Prix par défaut</th><th className="px-4 py-3 font-semibold">Note</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody className="divide-y divide-neutral-200">
              {(engins ?? []).map((engin) => (
                <tr className="bg-white/70 transition-colors hover:bg-primary-50" key={engin.id}>
                  <td className="px-4 py-3 font-semibold text-ink-900">{engin.name}</td>
                  <td className="px-4 py-3"><span className="inline-flex rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-900">{engin.category}</span></td>
                  <td className="px-4 py-3 text-neutral-600">{engin.unit}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{Number(engin.default_price).toLocaleString("fr-MA", { minimumFractionDigits: 2 })} MAD</td>
                  <td className="max-w-xs px-4 py-3 text-neutral-600">{engin.note || "—"}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2">{editable ? <><Link className="inline-flex min-h-10 items-center rounded-full border bg-white px-3 text-xs font-medium text-ink-900" href={`/engins/${engin.id}/edit`}>Modifier</Link><ConfirmedForm action={setEnginActive.bind(null, engin.id, showInactive, showInactive ? "/engins?inactive=1" : "/engins")} confirmationTitle={showInactive ? "Restaurer cet engin ?" : "Désactiver cet engin ?"} confirmationDescription={showInactive ? "L’engin redeviendra disponible dans les sélections." : "L’engin sera conservé dans les éléments inactifs."} confirmationLabel={showInactive ? "Restaurer" : "Désactiver"} destructive={!showInactive}><SubmitButton className="min-h-10 rounded-full border bg-white px-3 text-xs font-medium text-ink-900">{showInactive ? "Restaurer" : "Désactiver"}</SubmitButton></ConfirmedForm></> : <span className="text-xs text-neutral-500">Lecture seule</span>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(engins ?? []).length === 0 ? <p className="p-8 text-center text-sm text-neutral-500">Aucun engin dans cette vue.</p> : null}
      </div>
      {totalPages > 1 ? <nav aria-label="Pagination du parc d’engins" className="flex items-center justify-center gap-3"><Link aria-disabled={page === 1} className="rounded-full border bg-white px-4 py-2 text-sm text-ink-900 shadow-sm aria-disabled:pointer-events-none aria-disabled:opacity-40" href={hrefFor(Math.max(1, page - 1))}>Précédent</Link><span className="text-sm text-neutral-600">Page {page} / {totalPages}</span><Link aria-disabled={page === totalPages} className="rounded-full border bg-white px-4 py-2 text-sm text-ink-900 shadow-sm aria-disabled:pointer-events-none aria-disabled:opacity-40" href={hrefFor(Math.min(totalPages, page + 1))}>Suivant</Link></nav> : null}
    </div>
  );
}
