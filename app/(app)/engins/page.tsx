import Image from "next/image";
import Link from "next/link";
import { setEnginActive } from "./actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { canEdit } from "@/lib/auth/can-edit";
import { createClient } from "@/lib/supabase/server";
import { signedImageUrl } from "@/lib/supabase/storage";

const PAGE_SIZE = 12;

export default async function EnginsPage({ searchParams }: { searchParams: Promise<{ inactive?: string; error?: string; q?: string; unit?: string; page?: string }> }) {
  const params = await searchParams;
  const showInactive = params.inactive === "1";
  const queryText = params.q?.trim() ?? "";
  const unit = params.unit ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const supabase = await createClient();
  const editable = await canEdit("engins");
  let query = supabase
    .from("engins")
    .select("id, name, unit, default_price, photo_url, note", { count: "exact" })
    .eq("is_active", !showInactive)
    .order("name");
  if (queryText) query = query.ilike("name", `%${queryText}%`);
  if (unit) query = query.eq("unit", unit);
  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const engins = await Promise.all(
    (data ?? []).map(async (engin) => ({
      ...engin,
      imageUrl: await signedImageUrl(supabase, "engin-photos", engin.photo_url),
    }))
  );
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const queryString = (nextPage: number) => {
    const next = new URLSearchParams();
    if (showInactive) next.set("inactive", "1");
    if (queryText) next.set("q", queryText);
    if (unit) next.set("unit", unit);
    next.set("page", String(nextPage));
    return `/engins?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm text-neutral-500">Matériel et services facturables</p><h1 className="mt-1 text-3xl font-semibold">Parc d’engins</h1></div>
        <div className="flex gap-2"><Link className="rounded-full border bg-white px-4 py-2 text-sm text-ink-900 shadow-sm" href={showInactive ? "/engins" : "/engins?inactive=1"}>{showInactive ? "Actifs" : "Inactifs"}</Link>{editable ? <Link className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white" href="/engins/new">+ Nouveau</Link> : null}</div>
      </div>
      {params.error === "soft-delete" ? <p className="rounded-xl border border-destructive/30 bg-white px-4 py-3 text-sm text-destructive">La modification n’a pas été appliquée. Vérifiez votre permission d’édition et réessayez.</p> : null}
      <form className="glass-card flex flex-wrap items-end gap-3 rounded-2xl p-4" method="get">
        {showInactive ? <input name="inactive" type="hidden" value="1" /> : null}
        <label className="min-w-52 flex-1 text-sm font-medium">Rechercher<input className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm" defaultValue={queryText} name="q" placeholder="Nom de l’engin" /></label>
        <label className="text-sm font-medium">Unité<select className="mt-1 rounded-xl border bg-white px-3 py-2 text-sm" defaultValue={unit} name="unit"><option value="">Toutes</option><option>Jour</option><option>Mois</option><option>Heure</option><option>Fois</option></select></label>
        <button className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white" type="submit">Filtrer</button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {engins.map((engin) => (
          <article className="glass-card overflow-hidden rounded-2xl" key={engin.id}>
            <div className="flex h-36 items-center justify-center bg-primary-50">{engin.imageUrl ? <Image alt="" className="h-full w-full object-cover" height={240} src={engin.imageUrl} unoptimized width={360} /> : <span className="text-3xl font-semibold text-primary-300">{engin.name.slice(0, 1).toUpperCase()}</span>}</div>
            <div className="space-y-3 p-5"><div><h2 className="font-semibold">{engin.name}</h2><p className="mt-1 text-sm text-neutral-500">{engin.unit} · {Number(engin.default_price).toFixed(2)} MAD</p></div><p className="line-clamp-2 text-sm text-neutral-600">{engin.note || "Aucune note"}</p>{editable ? <div className="flex gap-2"><Link className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-900 shadow-sm" href={`/engins/${engin.id}/edit`}>Modifier</Link><form action={setEnginActive.bind(null, engin.id, showInactive, showInactive ? "/engins?inactive=1" : "/engins")}><SubmitButton className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-900 shadow-sm">{showInactive ? "Restaurer" : "Désactiver"}</SubmitButton></form></div> : <p className="text-xs text-neutral-500">Lecture seule</p>}</div>
          </article>
        ))}
      </div>
      {engins.length === 0 ? <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-neutral-500">Aucun engin dans cette vue.</p> : null}
      {totalPages > 1 ? <nav aria-label="Pagination du parc d’engins" className="flex items-center justify-center gap-3"><Link aria-disabled={page === 1} className="rounded-full border bg-white px-4 py-2 text-sm text-ink-900 shadow-sm aria-disabled:pointer-events-none aria-disabled:opacity-40" href={queryString(Math.max(1, page - 1))}>Précédent</Link><span className="text-sm text-neutral-600">Page {page} / {totalPages}</span><Link aria-disabled={page === totalPages} className="rounded-full border bg-white px-4 py-2 text-sm text-ink-900 shadow-sm aria-disabled:pointer-events-none aria-disabled:opacity-40" href={queryString(Math.min(totalPages, page + 1))}>Suivant</Link></nav> : null}
    </div>
  );
}
