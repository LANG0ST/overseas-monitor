"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CalendarDays,
  Clock3,
  Coins,
  FilePlus2,
  FolderOpen,
  LoaderCircle,
  Plus,
} from "lucide-react";
import { createPointageFactureDraftAction } from "@/app/(app)/pointage/actions";
import { pointageMonthOptions } from "@/lib/pointage";

export type PointageDashboardRow = {
  id: string;
  clientName: string;
  project: string | null;
  totalDays: number;
  overtimeHours: number;
  estimatedHt: number;
  updatedAt: string;
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PointageDashboard({
  canCreateFacture,
  rows,
  ym,
}: {
  canCreateFacture: boolean;
  rows: PointageDashboardRow[];
  ym: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const totalDays = rows.reduce((total, row) => total + row.totalDays, 0);
  const overtimeHours = rows.reduce((total, row) => total + row.overtimeHours, 0);
  const estimatedHt = rows.reduce((total, row) => total + row.estimatedHt, 0);

  function createInvoice(row: PointageDashboardRow) {
    if (!window.confirm(`Créer un brouillon de facture pour ${row.clientName} ?`)) return;
    setError(null);
    setPendingId(row.id);
    startTransition(async () => {
      const result = await createPointageFactureDraftAction(row.id);
      if (!result.ok) {
        setError(result.error);
        setPendingId(null);
        return;
      }
      router.push(`/factures/${result.data.documentId}`);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-600">Présences, heures supplémentaires et facturation mensuelle</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">Pointage</h1>
        </div>
        <Link className="inline-flex min-h-11 items-center rounded-full bg-ink-900 px-4 text-sm font-semibold text-white shadow-sm" href={`/pointage/new?ym=${encodeURIComponent(ym)}`}>
          <Plus className="mr-1.5 size-4" />Nouveau pointage
        </Link>
      </div>

      <section className="glass-card rounded-2xl p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="w-full max-w-64 text-sm font-semibold text-neutral-900">Mois
            <select className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm" onChange={(event) => router.push(`/pointage?ym=${encodeURIComponent(event.target.value)}`)} value={ym}>
              {pointageMonthOptions(ym).map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
            </select>
          </label>
          <p className="text-sm text-neutral-600">{rows.length} client{rows.length === 1 ? "" : "s"} avec un pointage enregistré</p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="glass-card rounded-2xl p-5"><CalendarDays className="size-5 text-primary-700" /><p className="mt-3 text-sm text-neutral-600">Jours pointés</p><p className="mt-1 text-2xl font-semibold text-neutral-900">{totalDays}</p></section>
        <section className="glass-card rounded-2xl p-5"><Clock3 className="size-5 text-primary-700" /><p className="mt-3 text-sm text-neutral-600">Heures supplémentaires</p><p className="mt-1 text-2xl font-semibold text-neutral-900">{overtimeHours} h</p></section>
        <section className="glass-card rounded-2xl p-5"><Coins className="size-5 text-primary-700" /><p className="mt-3 text-sm text-neutral-600">HT estimé</p><p className="mt-1 text-2xl font-semibold text-neutral-900">{formatAmount(estimatedHt)}</p></section>
      </div>

      {error ? <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">{error}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-ink-900 text-xs uppercase tracking-wide text-white">
              <tr><th className="px-5 py-4">Client / chantier</th><th className="px-5 py-4 text-right">Jours</th><th className="px-5 py-4 text-right">Heures supp.</th><th className="px-5 py-4 text-right">HT estimé</th><th className="px-5 py-4">Dernière modification</th><th className="px-5 py-4" /></tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4"><p className="font-semibold text-neutral-900">{row.clientName}</p><p className="mt-1 text-xs text-neutral-500">{row.project || "Chantier non renseigné"}</p></td>
                  <td className="px-5 py-4 text-right font-medium">{row.totalDays}</td>
                  <td className="px-5 py-4 text-right font-medium">{row.overtimeHours} h</td>
                  <td className="px-5 py-4 text-right font-semibold text-primary-900">{formatAmount(row.estimatedHt)}</td>
                  <td className="px-5 py-4 text-neutral-600">{formatDate(row.updatedAt)}</td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-2"><Link className="inline-flex min-h-10 items-center rounded-xl border border-primary-300 bg-primary-50 px-3 text-xs font-semibold text-primary-900" href={`/pointage/${row.id}`}><FolderOpen className="mr-1 size-3.5" />Ouvrir</Link>{canCreateFacture ? <button className="min-h-10 rounded-xl bg-primary-700 px-3 text-xs font-semibold text-white disabled:opacity-50" disabled={pending} onClick={() => createInvoice(row)} type="button">{pendingId === row.id ? <LoaderCircle className="mr-1 inline size-3.5 animate-spin" /> : <FilePlus2 className="mr-1 inline size-3.5" />}Facturer</button> : null}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <div className="px-6 py-14 text-center"><p className="font-medium text-neutral-900">Aucun pointage pour ce mois.</p><p className="mt-2 text-sm text-neutral-600">Créez le premier pointage pour commencer.</p></div> : null}
      </section>
    </div>
  );
}
