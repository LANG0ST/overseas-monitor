"use client";

import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { updatePermissionAction } from "@/app/(app)/permissions/actions";
import { resources, type Resource } from "@/lib/auth/resources";
import { cn } from "@/lib/utils";

const resourceLabels: Record<Resource, string> = {
  factures: "Factures",
  devis: "Devis",
  bons_commande: "Bons de commande",
  avoirs: "Avoirs",
  pointage: "Pointage",
  partenaires: "Partenaires",
  engins: "Parc d’engins",
};

export type PermissionStaffRow = {
  id: string;
  name: string;
  isActive: boolean;
  permissions: Record<Resource, boolean>;
};

type Confirmation = {
  userId: string;
  userName: string;
  resource: Resource;
  nextValue: boolean;
};

function PermissionSwitch({
  checked,
  disabled,
  label,
  onClick,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className="inline-flex min-h-11 min-w-14 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      role="switch"
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-7 w-12 items-center rounded-full p-1 transition-colors",
          checked ? "bg-primary-700" : "bg-neutral-300",
        )}
      >
        <span
          className={cn(
            "size-5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}

export function PermissionsMatrix({ initialRows }: { initialRows: PermissionStaffRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function requestChange(row: PermissionStaffRow, resource: Resource) {
    setError(null);
    setConfirmation({
      userId: row.id,
      userName: row.name,
      resource,
      nextValue: !row.permissions[resource],
    });
  }

  function confirmChange() {
    if (!confirmation) return;
    const change = confirmation;
    const key = `${change.userId}:${change.resource}`;
    setPendingKey(key);
    startTransition(async () => {
      const result = await updatePermissionAction({
        userId: change.userId,
        resource: change.resource,
        canEdit: change.nextValue,
      });
      setPendingKey(null);
      setConfirmation(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRows((current) => current.map((row) => row.id === change.userId
        ? {
            ...row,
            permissions: { ...row.permissions, [change.resource]: result.canEdit },
          }
        : row));
    });
  }

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-neutral-400 bg-white/70 p-8 text-center">
        <ShieldCheck className="mx-auto size-8 text-primary-700" />
        <p className="mt-3 font-semibold text-neutral-900">Aucun utilisateur staff</p>
        <p className="mt-1 text-sm text-neutral-600">Les utilisateurs staff apparaîtront ici après la création de leur compte.</p>
      </section>
    );
  }

  return (
    <>
      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900" role="alert">
          {error}
        </p>
      ) : null}

      <section className="hidden overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-ink-900 text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="sticky left-0 z-10 min-w-52 bg-ink-900 px-5 py-4">Utilisateur</th>
              {resources.map((resource) => (
                <th className="min-w-28 px-3 py-4 text-center" key={resource}>{resourceLabels[resource]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {rows.map((row) => (
              <tr key={row.id}>
                <th className="sticky left-0 z-10 bg-white px-5 py-4 font-semibold text-neutral-900">
                  <span>{row.name}</span>
                  {!row.isActive ? <span className="ml-2 rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-600">Inactif</span> : null}
                </th>
                {resources.map((resource) => {
                  const key = `${row.id}:${resource}`;
                  return (
                    <td className="px-3 py-2 text-center" key={resource}>
                      <PermissionSwitch
                        checked={row.permissions[resource]}
                        disabled={pending && pendingKey === key}
                        label={`${resourceLabels[resource]} — ${row.name}`}
                        onClick={() => requestChange(row, resource)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="space-y-4 md:hidden">
        {rows.map((row) => (
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm" key={row.id}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-neutral-900">{row.name}</h2>
              {!row.isActive ? <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">Inactif</span> : null}
            </div>
            <div className="mt-3 divide-y divide-neutral-100">
              {resources.map((resource) => {
                const key = `${row.id}:${resource}`;
                return (
                  <div className="flex min-h-14 items-center justify-between gap-3" key={resource}>
                    <span className="text-sm font-medium text-neutral-700">{resourceLabels[resource]}</span>
                    <PermissionSwitch
                      checked={row.permissions[resource]}
                      disabled={pending && pendingKey === key}
                      label={`${resourceLabels[resource]} — ${row.name}`}
                      onClick={() => requestChange(row, resource)}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {confirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/45 p-4" role="presentation">
          <section aria-labelledby="permission-confirm-title" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" role="alertdialog">
            <h2 className="text-lg font-semibold text-neutral-900" id="permission-confirm-title">
              Confirmer la permission
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-700">
              {confirmation.nextValue ? "Autoriser" : "Retirer"} la modification de <strong>{resourceLabels[confirmation.resource]}</strong> pour <strong>{confirmation.userName}</strong> ?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button className="min-h-11 rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800" disabled={pending} onClick={() => setConfirmation(null)} type="button">
                Annuler
              </button>
              <button className="min-h-11 rounded-full bg-ink-900 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} onClick={confirmChange} type="button">
                {pending ? <LoaderCircle className="mr-2 inline size-4 animate-spin" /> : null}
                Confirmer
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
