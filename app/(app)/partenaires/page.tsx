import Link from "next/link";
import { setPartenaireActive } from "./actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { ConfirmedForm } from "@/components/shared/confirmed-form";
import { canEdit } from "@/lib/auth/can-edit";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

export default async function PartenairesPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string; error?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const showInactive = params.inactive === "1";
  const queryText = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const supabase = await createClient();
  const editable = await canEdit("partenaires");
  const safeQueryText = queryText.replace(/[,%()]/g, " ").trim();
  let query = supabase
    .from("partenaires")
    .select("id, name, ice, address, representative, phone", { count: "exact" })
    .eq("is_active", !showInactive)
    .order("name");
  if (safeQueryText) query = query.or(`name.ilike.%${safeQueryText}%,ice.ilike.%${safeQueryText}%`);
  const { data: partenaires, count, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const hrefFor = (nextPage: number) => {
    const next = new URLSearchParams();
    if (showInactive) next.set("inactive", "1");
    if (queryText) next.set("q", queryText);
    next.set("page", String(nextPage));
    return `/partenaires?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm text-neutral-500">Clients et fournisseurs</p><h1 className="mt-1 text-3xl font-semibold">Partenaires</h1></div>
        <div className="flex gap-2">
          <Link className="rounded-full border bg-white px-4 py-2 text-sm text-ink-900 shadow-sm" href={showInactive ? "/partenaires" : "/partenaires?inactive=1"}>{showInactive ? "Actifs" : "Inactifs"}</Link>
          {editable ? <Link className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white" href="/partenaires/new">+ Nouveau</Link> : null}
        </div>
      </div>
      {params.error === "soft-delete" ? <p className="rounded-xl border border-destructive/30 bg-white px-4 py-3 text-sm text-destructive">La modification n’a pas été appliquée. Vérifiez votre permission d’édition et réessayez.</p> : null}
      <form className="glass-card flex flex-wrap items-end gap-3 rounded-2xl p-4" method="get">
        {showInactive ? <input name="inactive" type="hidden" value="1" /> : null}
        <label className="min-w-64 flex-1 text-sm font-medium">Rechercher<input className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm" defaultValue={queryText} name="q" placeholder="Nom ou ICE" /></label>
        <button className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white" type="submit">Filtrer</button>
        {queryText ? <Link className="rounded-full border bg-white px-4 py-2 text-sm text-ink-900" href={showInactive ? "/partenaires?inactive=1" : "/partenaires"}>Effacer</Link> : null}
      </form>
      <div className="glass-card overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-ink-900 text-white"><tr><th className="px-4 py-3 font-semibold">Raison sociale</th><th className="px-4 py-3 font-semibold">ICE</th><th className="px-4 py-3 font-semibold">Adresse</th><th className="px-4 py-3 font-semibold">Contact</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody className="divide-y divide-neutral-200">
              {(partenaires ?? []).map((partenaire) => (
                <tr className="bg-white/70 transition-colors hover:bg-primary-50" key={partenaire.id}>
                  <td className="px-4 py-3 font-semibold text-ink-900">{partenaire.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-700">{partenaire.ice || "—"}</td>
                  <td className="max-w-sm px-4 py-3 text-neutral-600">{partenaire.address || "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">{partenaire.representative || partenaire.phone || "—"}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2">{editable ? <><Link className="inline-flex min-h-10 items-center rounded-full border bg-white px-3 text-xs font-medium text-ink-900" href={`/partenaires/${partenaire.id}/edit`}>Modifier</Link><ConfirmedForm action={setPartenaireActive.bind(null, partenaire.id, showInactive, showInactive ? "/partenaires?inactive=1" : "/partenaires")} confirmationTitle={showInactive ? "Restaurer ce partenaire ?" : "Désactiver ce partenaire ?"} confirmationDescription={showInactive ? "Le partenaire redeviendra disponible dans les sélections." : "Le partenaire sera conservé dans les éléments inactifs."} confirmationLabel={showInactive ? "Restaurer" : "Désactiver"} destructive={!showInactive}><SubmitButton className="min-h-10 rounded-full border bg-white px-3 text-xs font-medium text-ink-900">{showInactive ? "Restaurer" : "Désactiver"}</SubmitButton></ConfirmedForm></> : <span className="text-xs text-neutral-500">Lecture seule</span>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(partenaires ?? []).length === 0 ? <p className="p-8 text-center text-sm text-neutral-500">Aucun partenaire dans cette vue.</p> : null}
      </div>
      {totalPages > 1 ? <nav aria-label="Pagination des partenaires" className="flex items-center justify-center gap-3"><Link aria-disabled={page === 1} className="rounded-full border bg-white px-4 py-2 text-sm text-ink-900 shadow-sm aria-disabled:pointer-events-none aria-disabled:opacity-40" href={hrefFor(Math.max(1, page - 1))}>Précédent</Link><span className="text-sm text-neutral-600">Page {page} / {totalPages}</span><Link aria-disabled={page === totalPages} className="rounded-full border bg-white px-4 py-2 text-sm text-ink-900 shadow-sm aria-disabled:pointer-events-none aria-disabled:opacity-40" href={hrefFor(Math.min(totalPages, page + 1))}>Suivant</Link></nav> : null}
    </div>
  );
}
