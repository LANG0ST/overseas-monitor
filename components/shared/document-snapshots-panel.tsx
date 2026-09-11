"use client";

import { History, RotateCcw } from "lucide-react";
import type { DocumentSnapshot } from "@/lib/db/documents";
import type { LineItem } from "@/lib/db/document-calculations";

export function formatSnapshotDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Casablanca",
  })
    .format(new Date(value))
    .replaceAll("/", "-")
    .replace(" ", "-");
}

export function DocumentSnapshotsPanel({
  currentLineItems,
  pending,
  snapshots,
  selectedSnapshotId,
  onRestore,
  onSelect,
}: {
  currentLineItems: LineItem[];
  pending: boolean;
  snapshots: DocumentSnapshot[];
  selectedSnapshotId: string | null;
  onRestore: (snapshot: DocumentSnapshot) => void;
  onSelect: (snapshotId: string | null) => void;
}) {
  return (
    <div
      className="mt-5 max-h-[calc(100vh-14rem)] space-y-3 overflow-y-auto pr-1"
      data-snapshot-panel
    >
      <div
        className={`rounded-2xl border p-3 ${selectedSnapshotId === null ? "border-primary-700 bg-primary-50" : "border-neutral-200 bg-white"}`}
      >
        <button
          className="flex w-full items-start gap-3 text-left"
          onClick={() => onSelect(null)}
          type="button"
        >
          <History className="mt-0.5 shrink-0 text-primary-700" size={18} />
          <span>
            <span className="block text-xs font-bold uppercase tracking-wide text-primary-900">
              Version actuelle
            </span>
            <span className="mt-1 block text-xs text-neutral-600">
              {currentLineItems.length} ligne{currentLineItems.length === 1 ? "" : "s"} · modifications locales incluses
            </span>
          </span>
        </button>
      </div>

      {pending ? (
        <p className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600">
          Chargement des snapshots…
        </p>
      ) : null}
      {snapshots.length === 0 && !pending ? (
        <p className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600">
          Le premier snapshot apparaîtra après l’enregistrement.
        </p>
      ) : null}

      {snapshots.map((snapshot) => {
        const lineItems = snapshot.snapshot.line_items ?? [];
        return (
          <div
            className={`rounded-2xl border p-3 ${selectedSnapshotId === snapshot.id ? "border-primary-700 bg-primary-50" : "border-neutral-200 bg-white"}`}
            key={snapshot.id}
          >
            <button
              className="flex w-full items-start gap-3 text-left"
              onClick={() => onSelect(snapshot.id)}
              type="button"
            >
              <RotateCcw className="mt-0.5 shrink-0 text-primary-700" size={18} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wide text-primary-900">
                  SNAPSHOT-{formatSnapshotDate(snapshot.created_at)}
                </span>
                <span className="mt-1.5 block space-y-1 text-xs text-neutral-600">
                  {lineItems.slice(0, 3).map((line, index) => (
                    <span className="block truncate" key={`${index}-${line.desc}`}>
                      {line.desc || "Sans désignation"}
                    </span>
                  ))}
                  {lineItems.length > 3 ? (
                    <span className="block font-semibold text-neutral-500">
                      +{lineItems.length - 3} autre{lineItems.length - 3 === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
            <button
              className="mt-3 w-full rounded-full border border-primary-300 bg-white px-3 py-2 text-xs font-semibold text-primary-900 disabled:opacity-50"
              disabled={pending}
              onClick={() => onRestore(snapshot)}
              type="button"
            >
              Restaurer cette version
            </button>
          </div>
        );
      })}
    </div>
  );
}
