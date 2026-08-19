import Link from "next/link";
import { CreateAvoirButton } from "@/components/shared/create-avoir-button";
import type { DocumentType } from "@/lib/db/documents";
import { createClient } from "@/lib/supabase/server";

export type DocumentListFilters = {
  inactive?: string;
  from?: string;
  to?: string;
  client?: string;
  search?: string;
  paid?: string;
};

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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, number, date, client_name, ttc, paid, is_locked, has_cachet, reference_facture_number",
    )
    .eq("type", type)
    .eq("is_active", !showInactive)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);
  const search = filters.search?.trim().toLocaleLowerCase("fr") ?? "";
  const client = filters.client?.trim().toLocaleLowerCase("fr") ?? "";
  const from =
    filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)
      ? filters.from
      : "";
  const to =
    filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to) ? filters.to : "";
  const documents = ((data ?? []) as ListDocument[]).filter((document) => {
    const number = document.number?.toLocaleLowerCase("fr") ?? "";
    const name = document.client_name.toLocaleLowerCase("fr");
    if (from && document.date < from) return false;
    if (to && document.date > to) return false;
    if (client && !name.includes(client)) return false;
    if (search && !number.includes(search) && !name.includes(search))
      return false;
    if (type === "facture" && filters.paid && filters.paid !== "all") {
      if (filters.paid === "paid" && !document.paid) return false;
      if (filters.paid === "unpaid" && document.paid) return false;
    }
    return true;
  });

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
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-ink-900 shadow-sm"
            href={hrefWithFilters(path, filters, {
              inactive: showInactive ? undefined : "1",
            })}
          >
            {showInactive ? "Voir les actifs" : "Voir les inactifs"}
          </Link>
          <Link
            className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white shadow-sm"
            href={`${path}/new`}
          >
            {newLabel}
          </Link>
        </div>
      </div>

      <form
        className="glass-card grid gap-4 rounded-2xl p-5 md:grid-cols-2 xl:grid-cols-5"
        method="get"
      >
        {showInactive ? (
          <input name="inactive" type="hidden" value="1" />
        ) : null}
        <label className="text-sm font-semibold text-neutral-900">
          Recherche
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            defaultValue={filters.search}
            name="search"
            placeholder="N° ou client"
          />
        </label>
        <label className="text-sm font-semibold text-neutral-900">
          Client
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            defaultValue={filters.client}
            name="client"
            placeholder="Nom du client"
          />
        </label>
        <label className="text-sm font-semibold text-neutral-900">
          Du
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            defaultValue={filters.from}
            name="from"
            type="date"
          />
        </label>
        <label className="text-sm font-semibold text-neutral-900">
          Au
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            defaultValue={filters.to}
            name="to"
            type="date"
          />
        </label>
        {type === "facture" ? (
          <label className="text-sm font-semibold text-neutral-900">
            Paiement
            <select
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
              defaultValue={filters.paid ?? "all"}
              name="paid"
            >
              <option value="all">Tous</option>
              <option value="paid">Payées</option>
              <option value="unpaid">Impayées</option>
            </select>
          </label>
        ) : (
          <div className="flex items-end">
            <button
              className="w-full rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
              type="submit"
            >
              Filtrer
            </button>
          </div>
        )}
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

      <div className="hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-900 text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="px-5 py-4">Numéro</th>
              {type === "avoir" ? (
                <th className="px-5 py-4">Facture référencée</th>
              ) : null}
              <th className="px-5 py-4">Date</th>
              <th className="px-5 py-4">Client</th>
              <th className="px-5 py-4 text-right">TTC</th>
              {type === "facture" ? (
                <>
                  <th className="px-5 py-4">Statut</th>
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
                {type === "facture" ? (
                  <>
                    <td className="px-5 py-4">
                      {document.paid ? (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                          Payée
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                          Impayée
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {document.number && document.is_locked ? (
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
              <span>{formatDate(document.date)}</span>
              {type === "facture" ? (
                <span
                  className={
                    document.paid
                      ? "font-semibold text-green-800"
                      : "font-semibold text-amber-900"
                  }
                >
                  {document.paid ? "Payée" : "Impayée"}
                </span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
      {documents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-400 bg-white/70 p-8 text-center text-sm font-medium text-neutral-700">
          Aucun document ne correspond à ces critères.
        </p>
      ) : null}
      <p className="text-sm text-neutral-700">
        {documents.length} document{documents.length === 1 ? "" : "s"}
      </p>
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
