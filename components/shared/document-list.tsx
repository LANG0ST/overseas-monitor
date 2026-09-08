import Link from "next/link";
import { CreateAvoirButton } from "@/components/shared/create-avoir-button";
import { getAccessContext } from "@/lib/auth/can-edit";
import type { DocumentType } from "@/lib/db/documents";
import { createClient } from "@/lib/supabase/server";

export type DocumentListFilters = {
  inactive?: string;
  from?: string;
  to?: string;
  client?: string;
  search?: string;
  paid?: string;
  drafts?: string;
  page?: string;
};

const PAGE_SIZE = 25;

type DocumentListProps = {
  type: DocumentType;
  title: string;
  subtitle: string;
  path: string;
  newLabel: string;
  filters: DocumentListFilters;
};

type ListDocument = {
  id: string;
  number: string | null;
  date: string;
  client_name: string;
  ttc: number;
  paid: boolean;
  is_locked: boolean;
  has_cachet: boolean;
  reference_facture_number: string | null;
  created_by: string | null;
  updated_at: string;
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatActivity(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function hrefWithFilters(
  path: string,
  filters: DocumentListFilters,
  changes: Record<string, string | undefined> = {},
) {
  const next = new URLSearchParams();
  const values = { ...filters, ...changes };
  for (const [key, value] of Object.entries(values)) {
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `${path}?${query}` : path;
}

export async function DocumentList({
  type,
  title,
  subtitle,
  path,
  newLabel,
  filters,
}: DocumentListProps) {
  const showInactive = filters.inactive === "1";
  const { userId, isAdmin, allowedResources } = await getAccessContext();
  const canAccessAvoirs = type === "facture" && allowedResources.includes("avoirs");
  const supabase = await createClient();
  const draftScope =
    filters.drafts === "mine"
      ? "mine"
      : filters.drafts === "all" && isAdmin
        ? "all"
        : null;

  const from = filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from) ? filters.from : "";
  const to = filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to) ? filters.to : "";
  const search = filters.search?.replace(/[^\p{L}\p{N}\s\-_/]/gu, " ").trim() ?? "";
  const client = filters.client?.trim() ?? "";
  const requestedPage = Number.parseInt(filters.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  let query = supabase
    .from("documents")
    .select(
      "id, number, date, client_name, ttc, paid, is_locked, has_cachet, reference_facture_number, created_by, updated_at",
      { count: "exact" },
    )
    .eq("type", type)
    .eq("is_active", !showInactive);

  query = draftScope
    ? query.is("number", null)
    : query.not("number", "is", null);
  if (draftScope === "mine" && userId) query = query.eq("created_by", userId);

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);
  if (client) query = query.ilike("client_name", `%${client}%`);
  if (search) query = query.or(`number.ilike.%${search}%,client_name.ilike.%${search}%`);
  if (type === "facture" && draftScope === null && filters.paid && filters.paid !== "all") {
    query = query.eq("paid", filters.paid === "paid");
  }

  const rangeStart = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query
    .order("date", { ascending: false })
    .range(rangeStart, rangeStart + PAGE_SIZE - 1);

  if (error) throw new Error(error.message);
  const documents = (data ?? []) as ListDocument[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const creatorIds = isAdmin
    ? [...new Set(documents.map((document) => document.created_by).filter(Boolean))] as string[]
    : [];
  const { data: creators } = creatorIds.length
    ? await supabase.from("profiles").select("id, name").in("id", creatorIds)
    : { data: [] };
  const creatorNames = new Map((creators ?? []).map((creator) => [creator.id, creator.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-600">{subtitle}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
            {title}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            className="inline-flex min-h-11 items-center rounded-full border border-neutral-300 bg-white px-4 text-sm font-medium text-ink-900 shadow-sm"
            href={hrefWithFilters(path, filters, {
              inactive: showInactive ? undefined : "1",
              page: undefined,
            })}
          >
            {showInactive ? "Voir les actifs" : "Voir les inactifs"}
          </Link>
          <Link
            className="inline-flex min-h-11 items-center rounded-full bg-ink-900 px-4 text-sm font-semibold text-white shadow-sm"
            href={`${path}/new`}
          >
            {newLabel}
          </Link>
        </div>
      </div>

      <nav aria-label={`Vues des ${title.toLocaleLowerCase("fr")}`} className="flex flex-wrap gap-2">
          <Link
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold shadow-sm ${draftScope === null ? "border-ink-900 bg-ink-900 text-white" : "border-neutral-300 bg-white text-ink-900"}`}
            href={hrefWithFilters(path, filters, {
              drafts: undefined,
              paid: filters.paid,
              page: undefined,
            })}
          >
            {title}
          </Link>
          <Link
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold shadow-sm ${draftScope === "mine" ? "border-ink-900 bg-ink-900 text-white" : "border-neutral-300 bg-white text-ink-900"}`}
            href={hrefWithFilters(path, filters, {
              drafts: "mine",
              paid: undefined,
              page: undefined,
            })}
          >
            Mes brouillons
          </Link>
          {isAdmin ? (
            <Link
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold shadow-sm ${draftScope === "all" ? "border-ink-900 bg-ink-900 text-white" : "border-neutral-300 bg-white text-ink-900"}`}
              href={hrefWithFilters(path, filters, {
                drafts: "all",
                paid: undefined,
                page: undefined,
              })}
            >
              Tous les brouillons
            </Link>
          ) : null}
        </nav>

      <form
        className="glass-card grid gap-4 rounded-2xl p-5 md:grid-cols-2 xl:grid-cols-5"
        method="get"
      >
        {showInactive ? (
          <input name="inactive" type="hidden" value="1" />
        ) : null}
        {draftScope ? (
          <input name="drafts" type="hidden" value={draftScope} />
        ) : null}
        <label className="text-sm font-semibold text-neutral-900">
          Recherche
          <input
            className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
            defaultValue={filters.search}
            name="search"
            placeholder="N° ou client"
          />
        </label>
        <label className="text-sm font-semibold text-neutral-900">
          Client
          <input
            className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
            defaultValue={filters.client}
            name="client"
            placeholder="Nom du client"
          />
        </label>
        <label className="text-sm font-semibold text-neutral-900">
          Du
          <input
            className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
            defaultValue={filters.from}
            name="from"
            type="date"
          />
        </label>
        <label className="text-sm font-semibold text-neutral-900">
          Au
          <input
            className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
            defaultValue={filters.to}
            name="to"
            type="date"
          />
        </label>
        {type === "facture" && draftScope === null ? (
          <label className="text-sm font-semibold text-neutral-900">
            Paiement
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
              defaultValue={filters.paid ?? "all"}
              name="paid"
            >
              <option value="all">Tous</option>
              <option value="paid">Payées</option>
              <option value="unpaid">Impayées</option>
            </select>
          </label>
        ) : type !== "facture" ? (
          <div className="flex items-end">
            <button
              className="min-h-11 w-full rounded-full bg-ink-900 px-4 text-sm font-semibold text-white"
              type="submit"
            >
              Filtrer
            </button>
          </div>
        ) : null}
        {type === "facture" ? (
          <div className="flex items-end md:col-span-2 xl:col-span-1">
            <button
              className="w-full rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
              type="submit"
            >
              Filtrer
            </button>
          </div>
        ) : null}
      </form>

      <div className="hidden overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm md:block">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead className="bg-ink-900 text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="px-5 py-4">Numéro</th>
              {type === "avoir" ? (
                <th className="px-5 py-4">Facture référencée</th>
              ) : null}
              <th className="px-5 py-4">Date</th>
              <th className="px-5 py-4">Client</th>
              <th className="px-5 py-4 text-right">TTC</th>
              <th className="px-5 py-4">Dernière modification</th>
              <th className="px-5 py-4">Statut</th>
              {type === "facture" ? (
                <>
                  <th className="px-5 py-4 text-right">Action</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {documents.map((document) => (
              <tr
                className="transition-colors hover:bg-primary-50"
                key={document.id}
              >
                <td className="px-5 py-4 font-semibold text-ink-900">
                  <Link
                    className="underline-offset-4 hover:underline"
                    href={`${path}/${document.id}`}
                  >
                    {document.number || "Brouillon"}
                  </Link>
                </td>
                {type === "avoir" ? (
                  <td className="px-5 py-4 font-medium text-neutral-800">
                    {document.reference_facture_number || "—"}
                  </td>
                ) : null}
                <td className="px-5 py-4 text-neutral-600">
                  {formatDate(document.date)}
                </td>
                <td className="px-5 py-4 text-neutral-900">
                  {document.client_name || "Client non renseigné"}
                </td>
                <td className="px-5 py-4 text-right font-medium text-neutral-900">
                  {formatAmount(Number(document.ttc))}
                </td>
                <td className="px-5 py-4 text-xs text-neutral-600">
                  <p>{formatActivity(document.updated_at)}</p>
                  {isAdmin && document.created_by ? <p className="mt-1">Par {creatorNames.get(document.created_by) || "Utilisateur"}</p> : null}
                </td>
                <td className="px-5 py-4">
                      {draftScope ? (
                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                          Brouillon
                        </span>
                      ) : !document.is_locked ? (
                        <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-900">
                          Numérotée
                        </span>
                      ) : type !== "facture" ? (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                          Verrouillé
                        </span>
                      ) : document.paid ? (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                          Payée
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                          Impayée
                        </span>
                      )}
                </td>
                {type === "facture" ? (
                  <>
                    <td className="px-5 py-4 text-right">
                      {!showInactive && canAccessAvoirs && document.number && document.is_locked ? (
                        <CreateAvoirButton
                          factureId={document.id}
                          factureNumber={document.number}
                        />
                      ) : null}
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {documents.map((document) => (
          <Link
            className="block rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
            href={`${path}/${document.id}`}
            key={document.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink-900">
                  {document.number || "Brouillon"}
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  {document.client_name || "Client non renseigné"}
                </p>
                {type === "avoir" ? (
                  <p className="mt-1 text-xs font-medium text-neutral-700">
                    Facture : {document.reference_facture_number || "—"}
                  </p>
                ) : null}
              </div>
              <p className="font-semibold text-neutral-900">
                {formatAmount(Number(document.ttc))}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-600">
              <span>{formatDate(document.date)} · modifié {formatActivity(document.updated_at)}</span>
              <span
                  className={
                    draftScope
                      ? "font-semibold text-neutral-700"
                      : !document.is_locked
                        ? "font-semibold text-primary-900"
                        : type !== "facture"
                          ? "font-semibold text-green-800"
                          : document.paid
                          ? "font-semibold text-green-800"
                          : "font-semibold text-amber-900"
                  }
              >
                  {draftScope
                    ? "Brouillon"
                    : !document.is_locked
                      ? "Numérotée"
                      : type !== "facture"
                        ? "Verrouillé"
                        : document.paid
                        ? "Payée"
                        : "Impayée"}
              </span>
            </div>
            {isAdmin && document.created_by ? <p className="mt-1 text-xs text-neutral-500">Créé par {creatorNames.get(document.created_by) || "Utilisateur"}</p> : null}
          </Link>
        ))}
      </div>
      {documents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-400 bg-white/70 p-8 text-center text-sm font-medium text-neutral-700">
          Aucun document ne correspond à ces critères.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-700">
        <p>{total} document{total === 1 ? "" : "s"}</p>
        {totalPages > 1 ? (
          <nav aria-label="Pagination des documents" className="flex items-center gap-2">
            {page > 1 ? (
              <Link className="rounded-full border border-neutral-300 bg-white px-4 py-2 font-semibold text-ink-900" href={hrefWithFilters(path, filters, { page: String(page - 1) })}>
                Précédent
              </Link>
            ) : null}
            <span>Page {Math.min(page, totalPages)} sur {totalPages}</span>
            {page < totalPages ? (
              <Link className="rounded-full border border-neutral-300 bg-white px-4 py-2 font-semibold text-ink-900" href={hrefWithFilters(path, filters, { page: String(page + 1) })}>
                Suivant
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

export function DocumentPlaceholder({
  title,
  path,
}: {
  title: string;
  path: string;
}) {
  return (
    <section className="glass-card max-w-xl rounded-3xl p-8">
      <p className="text-sm font-medium text-neutral-600">Document</p>
      <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{title}</h1>
      <p className="mt-3 text-neutral-700">
        L’éditeur de ce document sera implémenté à la phase suivante.
      </p>
      <Link
        className="mt-6 inline-flex rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
        href={path}
      >
        Retour à la liste
      </Link>
    </section>
  );
}
