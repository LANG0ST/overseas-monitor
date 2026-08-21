"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Download,
  ArrowLeft,
  FilePlus2,
  LoaderCircle,
  Plus,
  Printer,
  RotateCcw,
  Save,
  UserRoundPlus,
  Wrench,
  X,
} from "lucide-react";
import {
  createPointageFactureDraftAction,
  savePointageAction,
} from "@/app/(app)/pointage/actions";
import { PointageSheet } from "@/components/shared/pointage-sheet";
import {
  cyclePresence,
  isHalfHourIncrement,
  normalizeText,
  pointageMonthOptions,
  type PointageEntry,
  type PointageEntryDraft,
  type PointageSheet as PointageSheetData,
} from "@/lib/pointage";

type Partner = {
  id: string;
  name: string;
  ice: string | null;
  address: string | null;
};

type Engin = { id: string; name: string; default_price: number };
type ConfirmKind = "project" | "save" | "invoice" | "remove" | null;

function entryDraft(entry: PointageEntry): PointageEntryDraft {
  return {
    id: entry.id,
    expected_updated_at: entry.updated_at,
    engin_id: entry.engin_id,
    engin_name: entry.engin_name,
    unit_price: entry.unit_price,
    days: { ...entry.days },
    overtime_hours: { ...entry.overtime_hours },
    is_active: entry.is_active,
  };
}

function entryDrafts(sheet: PointageSheetData | null) {
  return sheet?.entries.map(entryDraft) ?? [];
}

function currentClient(
  partenaireId: string | undefined,
  manualName: string,
  partners: Partner[],
  sheet: PointageSheetData | null,
) {
  if (sheet) return sheet.client_name;
  if (!partenaireId) return manualName;
  return partners.find((partner) => partner.id === partenaireId)?.name ?? "";
}

function ConfirmDialog({
  body,
  confirmLabel,
  onCancel,
  onConfirm,
  pending,
  title,
}: {
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/35 p-4"
      role="presentation"
    >
      <section
        aria-describedby="pointage-confirmation-body"
        aria-labelledby="pointage-confirmation-title"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        role="alertdialog"
      >
        <h2
          className="text-lg font-bold text-neutral-900"
          id="pointage-confirmation-title"
        >
          {title}
        </h2>
        <p
          className="mt-2 text-sm leading-relaxed text-neutral-600"
          id="pointage-confirmation-body"
        >
          {body}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="min-h-11 rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-700"
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            Annuler
          </button>
          <button
            className="min-h-11 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={pending}
            onClick={onConfirm}
            type="button"
          >
            {pending ? "Traitement…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function PointageEditor({
  canCreateFacture,
  editable,
  editorMode,
  engins,
  initialClient,
  initialSheet,
  otReferenceHours,
  partners,
  ym: initialYm,
}: {
  canCreateFacture: boolean;
  editable: boolean;
  editorMode: "existing" | "new";
  engins: Engin[];
  initialClient: { partenaireId?: string; manualClientName: string };
  initialSheet: PointageSheetData | null;
  otReferenceHours: number;
  partners: Partner[];
  ym: string;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState(initialSheet);
  const [partenaireId, setPartenaireId] = useState(
    initialSheet?.partenaire_id ?? initialClient.partenaireId,
  );
  const [manualClientName, setManualClientName] = useState(
    initialSheet?.partenaire_id
      ? ""
      : (initialSheet?.client_name ?? initialClient.manualClientName),
  );
  const [manualClientIce, setManualClientIce] = useState(
    initialSheet?.partenaire_id ? "" : (initialSheet?.client_ice ?? ""),
  );
  const [manualClientAddress, setManualClientAddress] = useState(
    initialSheet?.partenaire_id ? "" : (initialSheet?.client_address ?? ""),
  );
  const [ym, setYm] = useState(initialYm);
  const [project, setProject] = useState(initialSheet?.project ?? "");
  const [hasCachet, setHasCachet] = useState(initialSheet?.has_cachet ?? false);
  const [entries, setEntries] = useState(() => entryDrafts(initialSheet));
  const [selectedEnginId, setSelectedEnginId] = useState("");
  const [showManualClient, setShowManualClient] = useState(
    Boolean(initialClient.manualClientName && !initialClient.partenaireId),
  );
  const [showManualEngin, setShowManualEngin] = useState(false);
  const [manualEnginName, setManualEnginName] = useState("");
  const [manualEnginPrice, setManualEnginPrice] = useState("");
  const [overtimeDrafts, setOvertimeDrafts] = useState<Record<string, string>>(
    {},
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const clientName = useMemo(
    () => currentClient(partenaireId, manualClientName, partners, sheet),
    [manualClientName, partenaireId, partners, sheet],
  );
  const activeEntries = entries.filter((entry) => entry.is_active);
  const inactiveEntries = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !entry.is_active);
  const selectedPartner = partners.find(
    (partner) => partner.id === partenaireId,
  );
  const canSave = editable && Boolean(clientName.trim());
  const monthOptions = useMemo(() => pointageMonthOptions(ym), [ym]);

  function pointageUrl(next: {
    partenaireId?: string;
    clientName?: string;
    ym?: string;
  }) {
    const params = new URLSearchParams();
    const nextYm = next.ym ?? ym;
    params.set("ym", nextYm);
    if (next.partenaireId) params.set("partenaire", next.partenaireId);
    else if (next.clientName)
      params.set("client", normalizeText(next.clientName));
    return `/pointage/new?${params.toString()}`;
  }

  function markDirty() {
    setDirty(true);
    setError(null);
  }

  function selectPartner(value: string) {
    if (dirty) {
      setError(
        "Enregistrez ou annulez vos modifications avant de changer de client.",
      );
      return;
    }
    if (value === "__manual__") {
      setPartenaireId(undefined);
      setShowManualClient(true);
      setSheet(null);
      setEntries([]);
      setDirty(false);
      return;
    }
    if (!value) {
      router.push(`/pointage/new?ym=${encodeURIComponent(ym)}`);
      return;
    }
    router.push(pointageUrl({ partenaireId: value }));
  }

  function changeMonth(value: string) {
    if (!value) return;
    if (dirty) {
      setError(
        "Enregistrez ou annulez vos modifications avant de changer de mois.",
      );
      return;
    }
    if (partenaireId) {
      router.push(pointageUrl({ partenaireId, ym: value }));
      return;
    }
    if (normalizeText(manualClientName)) {
      router.push(pointageUrl({ clientName: manualClientName, ym: value }));
      return;
    }
    setYm(value);
  }

  function loadManualClient() {
    if (dirty) {
      setError(
        "Enregistrez ou annulez vos modifications avant de changer de client.",
      );
      return;
    }
    const name = normalizeText(manualClientName);
    if (!name) {
      setError("Le nom du client est obligatoire.");
      return;
    }
    router.push(pointageUrl({ clientName: name }));
  }

  function addLinkedEngin() {
    if (!clientName) {
      setError("Sélectionnez ou saisissez d’abord un client.");
      return;
    }
    const engin = engins.find((item) => item.id === selectedEnginId);
    if (!engin) return;
    const existingIndex = entries.findIndex(
      (entry) => entry.engin_id === engin.id,
    );
    if (existingIndex >= 0) {
      if (entries[existingIndex].is_active) {
        setError("Cet engin est déjà présent dans la feuille.");
      } else {
        setEntries((current) =>
          current.map((entry, index) =>
            index === existingIndex ? { ...entry, is_active: true } : entry,
          ),
        );
        markDirty();
      }
      setSelectedEnginId("");
      return;
    }
    setEntries((current) => [
      ...current,
      {
        engin_id: engin.id,
        engin_name: engin.name,
        unit_price: engin.default_price,
        days: {},
        overtime_hours: {},
        is_active: true,
      },
    ]);
    setSelectedEnginId("");
    markDirty();
  }

  function addManualEngin() {
    if (!clientName) {
      setError("Sélectionnez ou saisissez d’abord un client.");
      return;
    }
    const name = normalizeText(manualEnginName);
    const unitPrice = Number(manualEnginPrice.replace(",", "."));
    if (!name) {
      setError("La désignation de l’engin est obligatoire.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError("Le P.U. journalier est invalide.");
      return;
    }
    setEntries((current) => [
      ...current,
      {
        engin_id: null,
        engin_name: name,
        unit_price: unitPrice,
        days: {},
        overtime_hours: {},
        is_active: true,
      },
    ]);
    setManualEnginName("");
    setManualEnginPrice("");
    setShowManualEngin(false);
    markDirty();
  }

  function updateEntry(
    index: number,
    updater: (entry: PointageEntryDraft) => PointageEntryDraft,
  ) {
    setEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? updater(entry) : entry,
      ),
    );
    markDirty();
  }

  function cycleDay(index: number, day: number) {
    updateEntry(index, (entry) => {
      const next = cyclePresence(entry.days[String(day)]);
      const days = { ...entry.days };
      if (next === undefined) delete days[String(day)];
      else days[String(day)] = next;
      return { ...entry, days };
    });
  }

  function updateOvertime(index: number, day: number, raw: string) {
    if (!/^\d*(?:[.,]\d*)?$/.test(raw)) {
      return;
    }
    const key = `${index}-${day}`;
    setOvertimeDrafts((current) => ({ ...current, [key]: raw }));
    if (!raw || !/^\d+(?:[.,]\d+)?$/.test(raw)) return;
    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value) || value < 0 || !isHalfHourIncrement(value))
      return;
    updateEntry(index, (entry) => {
      const hours = { ...entry.overtime_hours };
      if (value <= 0) delete hours[String(day)];
      else hours[String(day)] = value;
      return { ...entry, overtime_hours: hours };
    });
  }

  function commitOvertime(index: number, day: number) {
    const key = `${index}-${day}`;
    const raw = overtimeDrafts[key];
    if (raw === undefined) return;
    const value = Number(raw.replace(",", "."));
    if (
      raw &&
      (!Number.isFinite(value) || value < 0 || !isHalfHourIncrement(value))
    ) {
      setError(
        "Les heures supplémentaires doivent être saisies par demi-heure (0,5 h).",
      );
      setOvertimeDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    setOvertimeDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function updatePrice(index: number, raw: string) {
    const value = Number(raw.replace(",", "."));
    updateEntry(index, (entry) => ({
      ...entry,
      unit_price:
        Number.isFinite(value) && value >= 0 ? value : entry.unit_price,
    }));
  }

  function save() {
    setConfirmKind(null);
    const hasIncompleteOvertime = Object.values(overtimeDrafts).some(
      (raw) =>
        raw &&
        (!/^\d+(?:[.,]\d+)?$/.test(raw) ||
          !isHalfHourIncrement(Number(raw.replace(",", ".")))),
    );
    if (hasIncompleteOvertime) {
      setError("Terminez les heures supplémentaires avant d’enregistrer.");
      return;
    }
    const partner = partners.find((item) => item.id === partenaireId);
    startTransition(async () => {
      const result = await savePointageAction({
        sheetId: sheet?.id,
        expectedUpdatedAt: sheet?.updated_at,
        partenaireId,
        clientName: partner?.name ?? manualClientName,
        clientIce: partner?.ice ?? manualClientIce,
        clientAddress: partner?.address ?? manualClientAddress,
        ym,
        project,
        hasCachet,
        entries,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSheet(result.data);
      setEntries(entryDrafts(result.data));
      setProject(result.data.project ?? "");
      setHasCachet(result.data.has_cachet);
      setDirty(false);
      if (!partenaireId) {
        setManualClientName(result.data.client_name);
        setManualClientIce(result.data.client_ice ?? "");
        setManualClientAddress(result.data.client_address ?? "");
      }
      if (editorMode === "new") {
        router.replace(`/pointage/${result.data.id}`);
      } else {
        router.refresh();
      }
    });
  }

  function createInvoiceDraft() {
    if (!sheet?.id) return;
    setConfirmKind(null);
    startTransition(async () => {
      const result = await createPointageFactureDraftAction(sheet.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/factures/${result.data.documentId}`);
    });
  }

  async function exportExcel() {
    if (!clientName || activeEntries.length === 0) {
      setError("Ajoutez au moins un engin avant d’exporter.");
      return;
    }
    const exportSheet: PointageSheetData = sheet
      ? {
          ...sheet,
          project,
          has_cachet: hasCachet,
          entries: entries.map((entry) => ({
            id: entry.id ?? `nouveau-${entry.engin_id ?? entry.engin_name}`,
            sheet_id: sheet.id,
            engin_id: entry.engin_id,
            engin_name: entry.engin_name,
            unit_price: entry.unit_price,
            days: entry.days,
            overtime_hours: entry.overtime_hours,
            is_active: entry.is_active,
            updated_at: entry.expected_updated_at ?? sheet.updated_at,
          })),
        }
      : {
          id: "",
          partenaire_id: partenaireId ?? null,
          client_name: clientName,
          client_ice: selectedPartner?.ice ?? (manualClientIce || null),
          client_address:
            selectedPartner?.address ?? (manualClientAddress || null),
          ym,
          project: project || null,
          has_cachet: hasCachet,
          is_active: true,
          updated_at: "",
          entries: entries.map((entry, index) => ({
            id: entry.id ?? `nouveau-${index}`,
            sheet_id: "",
            engin_id: entry.engin_id,
            engin_name: entry.engin_name,
            unit_price: entry.unit_price,
            days: entry.days,
            overtime_hours: entry.overtime_hours,
            is_active: entry.is_active,
            updated_at: entry.expected_updated_at ?? "",
          })),
        };
    const { exportPointageXlsx } = await import("@/lib/export/pointage-xlsx");
    await exportPointageXlsx(exportSheet, otReferenceHours);
  }

  function printPointage() {
    const style = document.createElement("style");
    style.textContent =
      "@page { size: landscape; margin: 0; } .pointage-print-document, .pointage-print-document * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }";
    document.head.append(style);
    const cleanup = () => {
      style.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  function leavePointage() {
    if (
      dirty &&
      !window.confirm(
        "Des modifications ne sont pas enregistrées. Quitter le pointage ?",
      )
    ) {
      return;
    }
    router.push("/pointage");
  }

  const confirmation =
    confirmKind === "save"
      ? {
          title: "Enregistrer le pointage ?",
          body: "Les présences, heures supplémentaires, prix et chantier seront enregistrés.",
          confirmLabel: "Enregistrer",
          onConfirm: save,
        }
      : confirmKind === "project"
        ? {
            title: "Enregistrer le chantier ?",
            body: "Le chantier et les autres modifications actuelles de la feuille seront enregistrés.",
            confirmLabel: "Enregistrer le chantier",
            onConfirm: save,
          }
        : confirmKind === "invoice"
          ? {
              title: "Créer le brouillon de facture ?",
              body: "Une facture non numérotée sera créée avec les jours et heures supplémentaires de cette feuille. Vous pourrez la revoir avant de la finaliser.",
              confirmLabel: "Créer le brouillon",
              onConfirm: createInvoiceDraft,
            }
          : confirmKind === "remove" && removeIndex !== null
            ? {
                title: "Retirer cet engin ?",
                body: "La ligne sera retirée de la feuille. Elle pourra être restaurée avant ou après l’enregistrement.",
                confirmLabel: "Retirer",
                onConfirm: () => {
                  updateEntry(removeIndex, (entry) => ({
                    ...entry,
                    is_active: false,
                  }));
                  setRemoveIndex(null);
                  setConfirmKind(null);
                },
              }
            : null;

  return (
    <div className="pointage-editor min-w-0 w-full max-w-full space-y-5 overflow-x-clip">
      <div className="pointage-toolbar glass-card rounded-2xl p-4 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              aria-label="Retour"
              className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-800"
              onClick={leavePointage}
              type="button"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <p className="text-sm font-medium text-neutral-600">
                Présences et heures supplémentaires
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
                Pointage
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {dirty ? (
              <span className="inline-flex min-h-10 items-center rounded-full bg-amber-100 px-3 text-xs font-semibold text-amber-900">
                Modifications non enregistrées — fermeture protégée
              </span>
            ) : (
              <span className="inline-flex min-h-10 items-center rounded-full bg-emerald-100 px-3 text-xs font-semibold text-emerald-900">
                <Check className="mr-1 size-3.5" />À jour
              </span>
            )}
            <button
              className="min-h-11 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800"
              onClick={printPointage}
              type="button"
            >
              <Printer className="mr-1 inline size-4" />
              Imprimer
            </button>
            <button
              className="min-h-11 rounded-xl border border-primary-300 bg-primary-50 px-4 text-sm font-semibold text-primary-900 disabled:opacity-50"
              disabled={!clientName || activeEntries.length === 0}
              onClick={exportExcel}
              type="button"
            >
              <Download className="mr-1 inline size-4" />
              Exporter Excel
            </button>
            {editable ? (
              <button
                className="min-h-11 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
                disabled={!canSave || pending}
                onClick={() => setConfirmKind("save")}
                type="button"
              >
                <Save className="mr-1 inline size-4" />
                Enregistrer
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(14rem,1.2fr)_9rem_minmax(14rem,1fr)_minmax(15rem,1fr)]">
          <label className="text-sm font-semibold text-neutral-900">
            Client
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm"
              disabled={pending || editorMode === "existing"}
              onChange={(event) => selectPartner(event.target.value)}
              value={showManualClient ? "__manual__" : (partenaireId ?? "")}
            >
              <option value="">Sélectionner un client</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
              <option value="__manual__">＋ Saisie manuelle…</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-neutral-900">
            Mois
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm"
              disabled={pending || editorMode === "existing"}
              onChange={(event) => changeMonth(event.target.value)}
              value={ym}
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex min-w-0 items-end gap-2">
            <label className="min-w-40 flex-1 text-sm font-semibold text-neutral-900">
              Chantier
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-primary-200 bg-white px-3 text-sm"
                disabled={!editable}
                onChange={(event) => {
                  setProject(event.target.value);
                  markDirty();
                }}
                placeholder="Nom du chantier"
                value={project}
              />
            </label>
            {editable ? (
              <button
                className="min-h-11 shrink-0 rounded-xl border border-primary-300 bg-white px-3 text-sm font-semibold text-primary-900 disabled:opacity-50"
                disabled={!canSave || pending}
                onClick={() => setConfirmKind("project")}
                type="button"
              >
                <Save className="mr-1 inline size-4" />
                Chantier
              </button>
            ) : null}
          </div>
          {editable ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <label className="text-sm font-semibold text-neutral-900">
                Ajouter un engin
                <select
                  className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm"
                  onChange={(event) => setSelectedEnginId(event.target.value)}
                  value={selectedEnginId}
                >
                  <option value="">Engin du parc…</option>
                  {engins.map((engin) => (
                    <option key={engin.id} value={engin.id}>
                      {engin.name} · {engin.default_price.toFixed(2)} MAD/j
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="min-h-11 rounded-xl bg-primary-700 px-3 text-sm font-semibold text-white disabled:opacity-50"
                disabled={!selectedEnginId}
                onClick={addLinkedEngin}
                type="button"
              >
                <Plus className="inline size-4" /> Ajouter
              </button>
              <button
                className="min-h-11 rounded-xl border border-primary-300 bg-primary-50 px-3 text-sm font-semibold text-primary-900"
                onClick={() => setShowManualEngin((visible) => !visible)}
                type="button"
              >
                <Wrench className="inline size-4" /> Manuel
              </button>
            </div>
          ) : null}
        </div>
        {showManualClient ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-primary-200 bg-primary-50/70 p-4 md:grid-cols-4">
            <label className="text-sm font-semibold text-neutral-900 md:col-span-2">
              Raison sociale
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-primary-200 bg-white px-3 text-sm"
                disabled={Boolean(sheet)}
                onChange={(event) => setManualClientName(event.target.value)}
                value={manualClientName}
              />
            </label>
            <label className="text-sm font-semibold text-neutral-900">
              ICE (facultatif)
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-primary-200 bg-white px-3 text-sm"
                disabled={Boolean(sheet)}
                onChange={(event) => setManualClientIce(event.target.value)}
                value={manualClientIce}
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                className="min-h-11 flex-1 rounded-xl bg-primary-700 px-3 text-sm font-semibold text-white disabled:opacity-50"
                disabled={Boolean(sheet)}
                onClick={loadManualClient}
                type="button"
              >
                <UserRoundPlus className="mr-1 inline size-4" />
                Charger
              </button>
              <button
                aria-label="Annuler la saisie manuelle"
                className="min-h-11 rounded-xl border border-primary-200 bg-white px-3 text-primary-700"
                onClick={() => {
                  if (dirty)
                    setError(
                      "Enregistrez ou annulez vos modifications avant de changer de client.",
                    );
                  else
                    router.push(`/pointage/new?ym=${encodeURIComponent(ym)}`);
                }}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
            <label className="text-sm font-semibold text-neutral-900 md:col-span-4">
              Adresse (facultative)
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-primary-200 bg-white px-3 text-sm"
                disabled={Boolean(sheet)}
                onChange={(event) => setManualClientAddress(event.target.value)}
                value={manualClientAddress}
              />
            </label>
          </div>
        ) : null}
        {showManualEngin ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-primary-200 bg-primary-50/70 p-4 md:grid-cols-[1fr_12rem_auto]">
            <label className="text-sm font-semibold text-neutral-900">
              Désignation de l&apos;engin
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-primary-200 bg-white px-3 text-sm"
                onChange={(event) => setManualEnginName(event.target.value)}
                value={manualEnginName}
              />
            </label>
            <label className="text-sm font-semibold text-neutral-900">
              P.U. HT / jour
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-primary-200 bg-white px-3 text-sm"
                min="0"
                onChange={(event) => setManualEnginPrice(event.target.value)}
                step="0.01"
                type="number"
                value={manualEnginPrice}
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                className="min-h-11 rounded-xl bg-primary-700 px-4 text-sm font-semibold text-white"
                onClick={addManualEngin}
                type="button"
              >
                <Plus className="mr-1 inline size-4" />
                Ajouter
              </button>
              <button
                aria-label="Fermer"
                className="min-h-11 rounded-xl border border-primary-200 bg-white px-3 text-primary-700"
                onClick={() => setShowManualEngin(false)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        ) : null}
        {!editable ? (
          <p className="mt-4 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900">
            Vous consultez cette feuille en lecture seule.
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
            {error}
          </p>
        ) : null}
      </div>

      {inactiveEntries.length > 0 ? (
        <section className="rounded-2xl border border-dashed border-primary-300 bg-primary-50/60 p-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-primary-900">Engins retirés</h2>
              <p className="text-sm text-neutral-600">
                Ces lignes restent récupérables.
              </p>
            </div>
            {editable ? (
              <div className="flex flex-wrap gap-2">
                {inactiveEntries.map(({ entry, index }) => (
                  <button
                    className="min-h-10 rounded-xl border border-primary-300 bg-white px-3 text-xs font-semibold text-primary-900"
                    key={entry.id ?? `manual-${index}`}
                    onClick={() =>
                      updateEntry(index, (current) => ({
                        ...current,
                        is_active: true,
                      }))
                    }
                    type="button"
                  >
                    <RotateCcw className="mr-1 inline size-3.5" />
                    {entry.engin_name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="pointage-print-area min-w-0 overflow-hidden rounded-2xl border border-primary-200 shadow-sm">
        <PointageSheet
          clientName={clientName}
          editable={editable}
          entries={entries}
          overtimeDrafts={overtimeDrafts}
          onOvertimeBlur={commitOvertime}
          onOvertimeChange={updateOvertime}
          onPresenceCycle={cycleDay}
          onPriceChange={updatePrice}
          hasCachet={hasCachet}
          onCachetChange={(value) => {
            setHasCachet(value);
            markDirty();
          }}
          onRemove={(index) => {
            setRemoveIndex(index);
            setConfirmKind("remove");
          }}
          otReferenceHours={otReferenceHours}
          project={project}
          ym={ym}
        />
      </div>

      <div className="pointage-handoff glass-card flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 print:hidden">
        <div>
          <h2 className="font-semibold text-neutral-900">
            Facturation mensuelle
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Crée une facture brouillon avec les jours et heures supplémentaires
            de cette feuille.
          </p>
        </div>
        {editable && canCreateFacture ? (
          <button
            className="min-h-11 rounded-xl bg-primary-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
            disabled={
              !sheet?.id || dirty || activeEntries.length === 0 || pending
            }
            onClick={() => setConfirmKind("invoice")}
            type="button"
          >
            {pending ? (
              <LoaderCircle className="mr-1 inline size-4 animate-spin" />
            ) : (
              <FilePlus2 className="mr-1 inline size-4" />
            )}
            Créer un brouillon de facture
          </button>
        ) : (
          <p className="text-sm text-neutral-500">
            {canCreateFacture
              ? "Enregistrement requis avant facturation."
              : "Permission Factures requise."}
          </p>
        )}
      </div>

      {confirmation ? (
        <ConfirmDialog
          body={confirmation.body}
          confirmLabel={confirmation.confirmLabel}
          onCancel={() => {
            setConfirmKind(null);
            setRemoveIndex(null);
          }}
          onConfirm={confirmation.onConfirm}
          pending={pending}
          title={confirmation.title}
        />
      ) : null}
    </div>
  );
}
