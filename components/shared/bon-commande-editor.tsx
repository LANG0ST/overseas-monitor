"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock3,
  DatabaseArrowDownIcon,
  FilePlus2,
  HardHat,
  Hash,
  History,
  Lock,
  Ship,
  LockOpen,
  Stamp,
  Trash2,
  Truck,
  UserPen,
  UserRound,
} from "lucide-react";
import {
  assignBonCommandeNumberAction,
  assignBonCommandeNumberManuallyAction,
  deleteBonCommandeAction,
  listBonCommandeSnapshotsAction,
  restoreBonCommandeAction,
  restoreBonCommandeSnapshotAction,
  saveBonCommandeAction,
  unlockBonCommandeAction,
  type BonCommandeDocument,
} from "@/app/(app)/bons-commande/actions";
import {
  BonCommandePage,
  type InvoicePageKind,
} from "@/components/shared/bon-commande-page";
import { useConfirmDialog } from "@/components/shared/use-confirm-dialog";
import { EnginSelectOptions } from "@/components/shared/engin-select-options";
import { DocumentExportActions } from "@/components/shared/document-export-actions";
import { DocumentSnapshotsPanel, formatSnapshotDate } from "@/components/shared/document-snapshots-panel";
import { LinePropertiesFields } from "@/components/shared/line-properties-fields";
import { documentDraftSignature, useUnsavedDocument } from "@/components/shared/use-unsaved-document";
import { amountInFrenchWords } from "@/lib/format/amount-in-words";
import { printWithTitle } from "@/lib/print-title";
import {
  calculateTotals,
  roundMoney,
  type LineItem,
} from "@/lib/db/document-calculations";
import type { DocumentSnapshot } from "@/lib/db/documents";

type Invoice = BonCommandeDocument;

type Engin = { id: string; name: string; category: string; unit: string; default_price: number };
type Tool =
  | "line"
  | "engin"
  | "overtime"
  | "mobilisation"
  | "customs"
  | "client"
  | "date"
  | "details"
  | "totals"
  | "snapshots"
  | "delete";
type ActionResult =
  | { ok: true; document: Invoice }
  | { ok: false; error: string };

const UNIT_OPTIONS = ["Jour", "Mois", "Heure", "Fois"];
const A4_WIDTH_PX = 793.7008;
const A4_HEIGHT_PX = 1122.5197;
const tools: { id: Tool; label: string; Icon: typeof FilePlus2 }[] = [
  { id: "line", label: "Ajouter une ligne", Icon: FilePlus2 },
  { id: "engin", label: "Depuis le parc", Icon: HardHat },
  { id: "overtime", label: "Heures supp.", Icon: Clock3 },
  { id: "mobilisation", label: "Mobilisation", Icon: Truck },
  { id: "customs", label: "Frais de douane", Icon: Ship },
  { id: "client", label: "Infos fournisseur", Icon: UserRound },
  { id: "date", label: "Date et lieu", Icon: CalendarDays },
  { id: "snapshots", label: "SNAPSHOTS", Icon: History },
  { id: "delete", label: "Supprimer", Icon: Trash2 },
];
const toolGroups: { label: string; tools: Tool[] }[] = [
  {
    label: "Prestations",
    tools: ["line", "engin", "overtime", "mobilisation", "customs"],
  },
  { label: "Document", tools: ["client", "date", "snapshots"] },
  { label: "Suivi", tools: ["delete"] },
];

function formatAmount(value: number) {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
  }).format(value);
}

function normalizeTvaRate(value: number) {
  return value === 0 || value === 10 || value === 20 ? value : 20;
}

function measureCapacity(container: HTMLElement, measurementId: string) {
  const page = container.querySelector<HTMLElement>(
    `[data-invoice-page="invoice-measure-page-${measurementId}"]`,
  );
  const table = page?.querySelector<HTMLElement>("[data-invoice-table]");
  const heading = page?.querySelector<HTMLElement>(
    "[data-invoice-table-header]",
  );
  if (!table || !heading) return 0;
  return Math.max(
    0,
    table.getBoundingClientRect().height -
      heading.getBoundingClientRect().height -
      2,
  );
}

function splitMeasuredPages(
  lineItems: LineItem[],
  rowHeights: number[],
  capacities: { single: number; first: number; middle: number; last: number },
) {
  if (lineItems.length === 0) return [[]];
  const heightAt = (index: number) => rowHeights[index] ?? 0;
  const totalHeight = rowHeights.reduce((total, height) => total + height, 0);
  if (totalHeight <= capacities.single) return [lineItems];

  const takeUntil = (start: number, capacity: number) => {
    let end = start;
    let height = 0;
    while (end < lineItems.length) {
      const nextHeight = heightAt(end);
      if (end > start && height + nextHeight > capacity) break;
      height += nextHeight;
      end += 1;
    }
    return end;
  };

  const pages: LineItem[][] = [];
  let cursor = 0;
  const firstEnd = Math.max(1, takeUntil(cursor, capacities.first));
  if (firstEnd >= lineItems.length) {
    if (lineItems.length === 1) return [lineItems, []];
    return [lineItems.slice(0, -1), lineItems.slice(-1)];
  }
  pages.push(lineItems.slice(cursor, firstEnd));
  cursor = firstEnd;

  while (cursor < lineItems.length) {
    const remainingHeight = rowHeights
      .slice(cursor)
      .reduce((total, height) => total + height, 0);
    if (remainingHeight <= capacities.last) {
      pages.push(lineItems.slice(cursor));
      break;
    }

    const middleEnd = Math.max(
      cursor + 1,
      takeUntil(cursor, capacities.middle),
    );
    pages.push(lineItems.slice(cursor, middleEnd));
    cursor = middleEnd;
  }
  return pages;
}

function pageKindFor(index: number, pageCount: number): InvoicePageKind {
  if (pageCount === 1) return "single";
  if (index === 0) return "first";
  if (index === pageCount - 1) return "last";
  return "middle";
}

export function BonCommandeEditor({
  initialDocument,
  isAdmin,
  isSuperAdmin,
  engins,
}: {
  initialDocument: Invoice;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  engins: Engin[];
}) {
  const router = useRouter();
  const [document, setDocument] = useState(initialDocument);
  useEffect(() => {
    const safeNumber = document.number?.replace(/[\\/:*?"<>|]/g, "-");
    const previousTitle = window.document.title;
    window.document.title = safeNumber
      ? `Bon-de-commande-${safeNumber}`
      : "Bon-de-commande-Brouillon";
    return () => {
      window.document.title = previousTitle;
    };
  }, [document.number]);
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initialDocument.line_items ?? [],
  );
  const [city, setCity] = useState(initialDocument.city || "Casablanca");
  const [hasCachet, setHasCachet] = useState(
    Boolean(initialDocument.has_cachet),
  );
  const [tvaRate, setTvaRate] = useState(
    normalizeTvaRate(Number(initialDocument.tva_rate)),
  );
  const [selectedTool, setSelectedTool] = useState<Tool>(initialDocument.is_active ? "line" : "delete");
  const [selectedLine, setSelectedLine] = useState(0);
  const [selectedEngin, setSelectedEngin] = useState("");
  const [manualNumber, setManualNumber] = useState("");
  const [snapshots, setSnapshots] = useState<DocumentSnapshot[]>([]);
  const [previewSnapshotId, setPreviewSnapshotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [snapshotsPending, startSnapshotsTransition] = useTransition();
  const [savedSignature, setSavedSignature] = useState(() => documentDraftSignature(initialDocument as unknown as Record<string, unknown>, initialDocument.line_items ?? [], normalizeTvaRate(Number(initialDocument.tva_rate)), initialDocument.city || "Casablanca", Boolean(initialDocument.has_cachet)));
  const { confirm, confirmationDialog } = useConfirmDialog();
  const [pages, setPages] = useState<LineItem[][]>(() => [
    initialDocument.line_items ?? [],
  ]);
  const [pageScale, setPageScale] = useState(1);
  const [linePanelTarget, setLinePanelTarget] = useState<HTMLElement | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  const locked = document.is_locked;
  const currentSignature = documentDraftSignature(document as unknown as Record<string, unknown>, lineItems, tvaRate, city, hasCachet);
  const dirty = !locked && currentSignature !== savedSignature;
  useUnsavedDocument(dirty);
  const totals = useMemo(
    () => calculateTotals(lineItems, tvaRate),
    [lineItems, tvaRate],
  );
  const previewSnapshot = snapshots.find((item) => item.id === previewSnapshotId) ?? null;
  const viewerDocument = previewSnapshot
    ? ({ ...document, ...previewSnapshot.snapshot } as Invoice)
    : document;
  const viewerLineItems = previewSnapshot?.snapshot.line_items ?? lineItems;
  const viewerTvaRate = previewSnapshot
    ? normalizeTvaRate(Number(previewSnapshot.snapshot.tva_rate))
    : tvaRate;
  const viewerHasCachet = previewSnapshot
    ? Boolean(previewSnapshot.snapshot.has_cachet)
    : hasCachet;
  const viewerTotals = calculateTotals(viewerLineItems, viewerTvaRate);
  const viewerTvaBreakdown = [0, 10, 20].flatMap((rate) => {
    const matchingLines = viewerLineItems.filter(
      (line) => Number(line.tva_rate ?? viewerTvaRate) === rate,
    );
    const amount = roundMoney(
      matchingLines.reduce(
        (sum, line) => sum + roundMoney((line.qty * line.unit_price * rate) / 100),
        0,
      ),
    );
    return matchingLines.length > 0 ? [{ rate, amount }] : [];
  });
  const viewerAmountWords = amountInFrenchWords(viewerTotals.ttc);

  useLayoutEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const updateScale = () =>
      setPageScale(
        Math.min(1, Math.max(0.1, (viewer.clientWidth - 32) / A4_WIDTH_PX)),
      );
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewer);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const container = measurementRef.current;
    if (!container) return;
    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;
    const measure = () => {
      if (cancelled) return;
      const rowNodes = Array.from(
        container.querySelectorAll<HTMLElement>(
          '[data-invoice-page="invoice-measure-page-single"] [data-invoice-row]',
        ),
      );
      const rowHeights = rowNodes.map(
        (row) => row.getBoundingClientRect().height,
      );
      const capacities = {
        single: measureCapacity(container, "single"),
        first: measureCapacity(container, "first"),
        middle: measureCapacity(container, "middle"),
        last: measureCapacity(container, "last"),
      };
      if (viewerLineItems.length === 0) setPages([[]]);
      else if (
        rowHeights.length === viewerLineItems.length &&
        Object.values(capacities).every((capacity) => capacity > 0)
      )
        setPages(splitMeasuredPages(viewerLineItems, rowHeights, capacities));
      else setPages([viewerLineItems]);
    };
    const scheduleMeasurement = () => {
      if (cancelled) return;
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(measure);
      });
    };
    window.document.fonts?.ready.then(scheduleMeasurement, scheduleMeasurement);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [
    viewerAmountWords,
    viewerDocument.client_address,
    viewerDocument.client_ice,
    viewerDocument.client_name,
    viewerLineItems,
    viewerTotals.ttc,
    viewerTvaRate,
  ]);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const renderedPages = Array.from(
        viewerRef.current?.querySelectorAll<HTMLElement>(".invoice-page") ?? [],
      );
      const overflowIndex = renderedPages.findIndex((page) => {
        const table = page.querySelector<HTMLElement>("[data-invoice-table]");
        return Boolean(table && table.scrollHeight > table.clientHeight + 1);
      });
      if (overflowIndex < 0) return;

      setPages((current) => {
        const overflowingPage = current[overflowIndex];
        if (!overflowingPage || overflowingPage.length < 2) return current;
        const movedLine = overflowingPage[overflowingPage.length - 1];
        const next = current[overflowIndex + 1] ?? [];
        const nextPages = current.slice();
        nextPages[overflowIndex] = overflowingPage.slice(0, -1);
        nextPages[overflowIndex + 1] = [movedLine, ...next];
        return nextPages;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pages]);

  function applyResult(result: ActionResult, preserveDraft = false) {
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setDocument(result.document);
    if (!preserveDraft) {
      setLineItems(result.document.line_items ?? []);
      setTvaRate(normalizeTvaRate(Number(result.document.tva_rate)));
    }
    setCity(result.document.city || "Casablanca");
    setHasCachet(Boolean(result.document.has_cachet));
    setSavedSignature(documentDraftSignature(result.document as unknown as Record<string, unknown>, result.document.line_items ?? [], normalizeTvaRate(Number(result.document.tva_rate)), result.document.city || "Casablanca", Boolean(result.document.has_cachet)));
    setError(null);
    return true;
  }

  function addLine(kind: "line" | "overtime" | "mobilisation" | "customs") {
    if (locked) return;
    const line: LineItem =
      kind === "overtime"
        ? {
            desc: "Heures supplémentaires",
            unit: "Heure",
            qty: 1,
            unit_price: 0,
            tva_rate: tvaRate,
          }
        : kind === "mobilisation" || kind === "customs"
          ? {
              desc: kind === "customs" ? "Frais de douane" : "Mobilisation",
              unit: "Fois",
              qty: 1,
              unit_price: 0,
              tva_rate: 10,
            }
          : {
              desc: "Nouvelle prestation",
              unit: "Jour",
              qty: 1,
              unit_price: 0,
              tva_rate: tvaRate,
            };
    const index = lineItems.length;
    setLineItems((current) => [...current, line]);
    setSelectedLine(index);
    setSelectedTool("line");
  }

  function addEngin() {
    if (locked) return;
    const engin = engins.find((item) => item.id === selectedEngin);
    if (!engin) return;
    const index = lineItems.length;
    setLineItems((current) => [
      ...current,
      {
        desc: engin.name,
        unit: engin.unit,
        qty: 1,
        unit_price: Number(engin.default_price) || 0,
        tva_rate: tvaRate,
      },
    ]);
    setSelectedLine(index);
    setSelectedTool("line");
    setSelectedEngin("");
  }

  function updateLine(field: keyof LineItem, value: string) {
    setLineItems((current) =>
      current.map((line, index) =>
        index === selectedLine
          ? {
              ...line,
              [field]:
                field === "qty" ||
                field === "unit_price" ||
                field === "tva_rate"
                  ? Number(value) || 0
                  : value,
            }
          : line,
      ),
    );
  }

  async function assignNumber() {
    if (locked || document.number) return;
    if (!(await confirm({ title: "Numéroter le bon de commande ?", description: "Cette action consomme définitivement le prochain numéro disponible.", confirmLabel: "Attribuer le numéro" }))) return;
    startTransition(async () => {
      applyResult(await assignBonCommandeNumberAction(document.id), true);
    });
  }

  async function assignManualNumber() {
    if (locked || (document.number && !document.manual_number_only)) return;
    const number = window.prompt("Numéro manuel du bon de commande", document.number || manualNumber);
    if (!number || !(await confirm({ title: "Définir ce numéro manuel ?", description: `Le numéro « ${number.trim()} » sera attribué à ce bon de commande. Un doublon sera refusé.`, confirmLabel: "Définir le numéro" }))) return;
    setManualNumber(number.trim());
    startTransition(async () => {
      applyResult(
        await assignBonCommandeNumberManuallyAction(document.id, number),
        true,
      );
    });
  }

  async function unlockBonCommande() {
    if (!locked || !isSuperAdmin) return;
    if (!(await confirm({
      title: "Déverrouiller ce bon de commande ?",
      description: "Son numéro actuel sera conservé. Vous pourrez corriger le document et modifier ce numéro manuellement avant de le reverrouiller.",
      confirmLabel: "Déverrouiller",
      destructive: true,
    }))) return;
    startTransition(async () => {
      applyResult(await unlockBonCommandeAction(document.id));
    });
  }

  function persistBonCommande(shouldLock: boolean) {
    return saveBonCommandeAction(
      document.id,
      lineItems,
      tvaRate,
      shouldLock,
      document.date,
      city,
      hasCachet,
      {
        validity_days: document.validity_days ?? 30,
        period_start: document.period_start,
        period_end: document.period_end,
        payment_conditions: document.devis_payment_conditions,
        bank_name: document.devis_bank_name,
        iban: document.devis_iban,
        client_name: document.client_name,
        client_ice: document.client_ice ?? "",
        client_address: document.client_address ?? "",
      },
    );
  }

  async function refreshSnapshots() {
    const result = await listBonCommandeSnapshotsAction(document.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSnapshots(result.snapshots);
    setError(null);
  }

  async function save() {
    if (locked) return;
    setPreviewSnapshotId(null);
    if (!(await confirm({ title: "Enregistrer le bon de commande ?", description: "Les modifications seront enregistrées et un nouveau snapshot sera créé.", confirmLabel: "Enregistrer" }))) return;
    startTransition(async () => {
      if (applyResult(await persistBonCommande(false)) && selectedTool === "snapshots") {
        await refreshSnapshots();
      }
    });
  }

  async function lockBonCommande() {
    if (locked || !document.number) return;
    setPreviewSnapshotId(null);
    if (!(await confirm({ title: "Verrouiller définitivement ce bon de commande ?", description: "La version actuelle sera enregistrée, ajoutée aux snapshots puis rendue non modifiable.", confirmLabel: "Verrouiller" }))) return;
    startTransition(async () => {
      if (applyResult(await persistBonCommande(true))) {
        setSelectedTool("date");
      }
    });
  }

  async function restoreSnapshot(snapshot: DocumentSnapshot) {
    if (locked) return;
    if (!(await confirm({
      title: "Restaurer cette version ?",
      description: dirty
        ? "Vos modifications actuelles non enregistrées seront remplacées par ce snapshot."
        : "Le contenu actuel du bon de commande sera remplacé par ce snapshot.",
      confirmLabel: "Restaurer",
      destructive: true,
    }))) return;
    startTransition(async () => {
      if (applyResult(await restoreBonCommandeSnapshotAction(document.id, snapshot.id))) {
        setPreviewSnapshotId(null);
        await refreshSnapshots();
      }
    });
  }

  async function deleteDocument() {
    const restoring = !document.is_active;
    if (!(await confirm({ title: restoring ? "Restaurer ce bon de commande ?" : "Désactiver ce bon de commande ?", description: restoring ? "Il redeviendra disponible dans les bons actifs." : "Il restera disponible dans les documents inactifs et pourra être restauré.", confirmLabel: restoring ? "Restaurer" : "Désactiver", destructive: !restoring }))) return;
    startTransition(async () => {
      const result = restoring ? await restoreBonCommandeAction(document.id) : await deleteBonCommandeAction(document.id);
      if (applyResult(result)) router.push(restoring ? "/bons-commande" : "/bons-commande?inactive=1");
    });
  }

  function printInvoice() {
    printWithTitle(`Bon-de-commande-${document.number || `Brouillon-${document.client_name}`}`);
  }

  function selectTool(id: Tool) {
    if (id !== "snapshots") setPreviewSnapshotId(null);
    if (id === "line" || id === "overtime" || id === "mobilisation" || id === "customs")
      return addLine(id);
    if (id === "delete") return deleteDocument();
    setSelectedTool(id);
    if (id === "snapshots") {
      setPreviewSnapshotId(null);
      startSnapshotsTransition(refreshSnapshots);
    }
  }

  const selected = lineItems[selectedLine];
  const unitOptions =
    selected && !UNIT_OPTIONS.includes(selected.unit)
      ? [selected.unit, ...UNIT_OPTIONS]
      : UNIT_OPTIONS;

  return (
    <div
      className="invoice-editor space-y-5"
      onPointerDownCapture={(event) => {
        if (previewSnapshot && !(event.target as Element).closest("[data-snapshot-panel]")) {
          setPreviewSnapshotId(null);
        }
      }}
    >
      {confirmationDialog}
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link className="text-sm font-medium text-primary-700" href="/bons-commande">
            ← Bon de commande
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-neutral-900">
            {document.number || "Brouillon"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {document.number ? (
            <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-900">
              {locked ? "Verrouillée" : "Numérotée"}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
              Brouillon
            </span>
          )}
          <DocumentExportActions
            documentId={document.id}
            kind="bon-commande"
            onBrowserPrint={printInvoice}
            pdfDisabled={dirty || Boolean(previewSnapshot)}
            pdfDisabledTitle={previewSnapshot ? "Revenez à la version actuelle avant de télécharger le PDF" : undefined}
          />
          {document.is_active && !locked && !document.number && !document.manual_number_only ? (
            <button
              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-ink-900 shadow-sm"
              disabled={pending}
              onClick={assignNumber}
              type="button"
            >
              <Hash className="mr-2 inline" size={16} />
              Attribuer un numéro
            </button>
          ) : null}
          {document.is_active && locked && isSuperAdmin ? (
            <button
              className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 shadow-sm"
              disabled={pending}
              onClick={unlockBonCommande}
              type="button"
            >
              <LockOpen className="mr-2 inline" size={16} />
              Déverrouiller le bon
            </button>
          ) : null}
          {document.is_active && !locked && ((!document.number && isAdmin) || (document.manual_number_only && isSuperAdmin)) ? (
            <button
              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-ink-900 shadow-sm"
              disabled={pending}
              onClick={assignManualNumber}
              type="button"
            >
              <UserPen className="mr-2 inline" size={16} />
              {document.number ? "Modifier le numéro" : "Numéro manuel"}
            </button>
          ) : null}
          {document.is_active && !locked ? (
            <button
              className={`rounded-full border px-4 py-2 text-sm font-semibold shadow-sm ${hasCachet ? "border-primary-700 bg-primary-100 text-primary-900" : "border-neutral-300 bg-white text-ink-900"}`}
              onClick={() => setHasCachet((current) => !current)}
              type="button"
            >
              <Stamp className="mr-2 inline" size={16} />

              {hasCachet ? "Retirer le cachet" : "Ajouter le cachet"}
            </button>
          ) : null}
          {document.is_active && !locked ? (
            <button
              className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              disabled={pending}
              onClick={save}
              type="button"
            >
              <DatabaseArrowDownIcon className="mr-2 inline" size={16} />
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
          ) : null}
          {document.is_active && !locked && document.number ? (
            <button
              className="rounded-full border border-[#0063B8] bg-[#0063B8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:border-[#00549c] hover:bg-[#00549c] disabled:opacity-50"
              disabled={pending}
              onClick={lockBonCommande}
              type="button"
            >
              <Lock className="mr-2 inline" size={16} />
              Verrouiller
            </button>
          ) : null}
        </div>
      </header>
      {dirty ? <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 print:hidden">Modifications non enregistrées</p> : null}
      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900 print:hidden">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside className="hidden space-y-3 print:hidden xl:block">
          {toolGroups.map((group) => (
            <section className="space-y-2" key={group.label}>
              <p className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {group.tools.map((id) => {
                  const tool = tools.find((item) => item.id === id);
                  if (!tool) return null;
                  const { label, Icon } = tool;
                  return (
                    <button
                      className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center text-xs font-semibold transition-colors ${selectedTool === id ? "border-ink-900 bg-ink-900 text-white" : "border-neutral-300 bg-white text-ink-900 hover:bg-primary-50"}`}
                      disabled={(!document.is_active && id !== "delete") || (locked && id !== "delete")}
                      key={id}
                      onClick={() => selectTool(id)}
                      type="button"
                    >
                      <Icon size={20} strokeWidth={1.8} />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </aside>

        <div
          className="invoice-print-area invoice-viewer order-1 min-w-0 rounded-2xl border border-neutral-300 bg-slate-200/80 p-3 shadow-inner sm:p-4"
          ref={viewerRef}
        >
          <div className="mb-3 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 print:hidden">
            <span>
              {previewSnapshot
                ? `Aperçu · SNAPSHOT-${formatSnapshotDate(previewSnapshot.created_at)}`
                : "Aperçu PDF · version actuelle"}
            </span>
            <span>
              A4 · {Math.round(pageScale * 100)} % · {pages.length} page
              {pages.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="invoice-pages flex flex-col items-center gap-5 print:contents">
            {pages.map((page, index) => {
              const pageKind = pageKindFor(index, pages.length);
              const lineOffset = pages
                .slice(0, index)
                .reduce((total, chunk) => total + chunk.length, 0);
              return (
                <div
                  className="invoice-page-viewport print:contents"
                  key={`${index}-${page.length}`}
                  style={{
                    height: `${A4_HEIGHT_PX * pageScale}px`,
                    width: `${A4_WIDTH_PX * pageScale}px`,
                  }}
                >
                  <div
                    className="invoice-page-scale print:contents"
                    style={{ transform: `scale(${pageScale})` }}
                  >
                    <BonCommandePage
                      amountWords={viewerAmountWords}
                      document={viewerDocument}
                      lineItems={page}
                      lineOffset={lineOffset}
                      pageKind={pageKind}
                      selectedLine={selectedLine}
                      totals={viewerTotals}
                      tvaBreakdown={viewerTvaBreakdown}
                      hasCachet={viewerHasCachet}
                      tvaRate={viewerTvaRate}
                      onSelectLine={previewSnapshot ? undefined : (lineIndex) => {
                        setSelectedLine(lineIndex);
                        setSelectedTool("line");
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="order-2 flex gap-2 overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm print:hidden xl:hidden">
          {tools.map(({ id, label, Icon }) => (
            <button
              className={`flex min-w-24 flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold ${selectedTool === id ? "bg-ink-900 text-white" : "bg-white text-ink-900"}`}
              disabled={(!document.is_active && id !== "delete") || (locked && id !== "delete")}
              key={id}
              onClick={() => selectTool(id)}
              type="button"
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <aside className="glass-card order-3 rounded-2xl p-5 print:hidden" ref={setLinePanelTarget}>
          <h2 className="font-semibold text-neutral-900">
            {selectedTool === "line"
              ? "Propriétés de la ligne"
              : tools.find((tool) => tool.id === selectedTool)?.label}
          </h2>
          {selectedTool === "snapshots" && !locked ? (
            <DocumentSnapshotsPanel
              currentLineItems={lineItems}
              onRestore={restoreSnapshot}
              onSelect={setPreviewSnapshotId}
              pending={snapshotsPending || pending}
              selectedSnapshotId={previewSnapshotId}
              snapshots={snapshots}
            />
          ) : null}
          {selectedTool === "line" ? (
            <div className="mt-5 space-y-4">
              {selected ? (
                <LinePropertiesFields
                  defaultTvaRate={tvaRate}
                  line={selected}
                  locked={locked}
                  onChange={updateLine}
                  onDelete={() =>
                    setLineItems((current) =>
                      current.filter((_, index) => index !== selectedLine),
                    )
                  }
                  unitOptions={unitOptions}
                />
              ) : (
                <p className="text-sm text-neutral-600">
                  Sélectionnez une ligne ou ajoutez-en une.
                </p>
              )}
            </div>
          ) : null}
          {selectedTool === "engin" ? (
            <div className="mt-5 space-y-4">
              <p className="text-sm text-neutral-700">
                Choisissez un engin pour préremplir la désignation, l’unité et
                le prix.
              </p>
              <label className="block text-sm font-semibold text-neutral-900">
                Engin du parc
                <select
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  disabled={locked || engins.length === 0}
                  onChange={(event) => setSelectedEngin(event.target.value)}
                  value={selectedEngin}
                >
                  <option value="">Sélectionner un engin</option>
                  <EnginSelectOptions engins={engins} label={(engin) => `${engin.name} · ${engin.unit} · ${formatAmount(Number(engin.default_price))}`} />
                </select>
              </label>
              <button
                className="w-full rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={locked || !selectedEngin}
                onClick={addEngin}
                type="button"
              >
                Ajouter au bon
              </button>
              {engins.length === 0 ? (
                <p className="text-xs text-neutral-600">
                  Aucun engin actif dans le parc.
                </p>
              ) : null}
            </div>
          ) : null}
          {selectedTool === "client" ? (
            <div className="mt-5 space-y-4 text-sm text-neutral-700">
              <label className="block font-semibold text-neutral-900">
                Nom
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  disabled={locked || Boolean(document.partenaire_id)}
                  onChange={(event) =>
                    setDocument((current) => ({
                      ...current,
                      client_name: event.target.value,
                    }))
                  }
                  value={document.client_name}
                />
              </label>
              <label className="block font-semibold text-neutral-900">
                ICE
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  disabled={locked || Boolean(document.partenaire_id)}
                  onChange={(event) =>
                    setDocument((current) => ({
                      ...current,
                      client_ice: event.target.value,
                    }))
                  }
                  value={document.client_ice ?? ""}
                />
              </label>
              <label className="block font-semibold text-neutral-900">
                Adresse
                <textarea
                  className="mt-1 min-h-20 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  disabled={locked || Boolean(document.partenaire_id)}
                  onChange={(event) =>
                    setDocument((current) => ({
                      ...current,
                      client_address: event.target.value,
                    }))
                  }
                  value={document.client_address ?? ""}
                />
              </label>
              <p className="rounded-xl bg-primary-50 p-3 text-xs">
                {document.partenaire_id
                  ? "Fournisseur issu du répertoire : les coordonnées sont verrouillées."
                  : "Fournisseur saisi manuellement : les champs sont modifiables."}
              </p>
            </div>
          ) : null}
          {selectedTool === "totals" ? (
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-neutral-900">
                Taux de TVA
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  disabled={locked}
                  max="100"
                  min="0"
                  onChange={(event) =>
                    setTvaRate(Number(event.target.value) || 0)
                  }
                  step="0.01"
                  type="number"
                  value={tvaRate}
                />
              </label>
              <p className="text-sm text-neutral-700">
                HT : <strong>{formatAmount(totals.ht)}</strong>
                <br />
                TVA : <strong>{formatAmount(totals.tva)}</strong>
                <br />
                TTC : <strong>{formatAmount(totals.ttc)}</strong>
              </p>
            </div>
          ) : null}
          {selectedTool === "delete" ? (
            <div className="mt-5 space-y-4">
              <p className="text-sm text-neutral-700">
                {document.is_active ? "Le bon de commande sera conservé dans les inactifs." : "Le bon de commande redeviendra disponible dans les actifs."}
              </p>
              <button
                className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900"
                disabled={pending}
                onClick={deleteDocument}
                type="button"
              >
                {document.is_active ? "Désactiver le bon de commande" : "Restaurer le bon de commande"}
              </button>
            </div>
          ) : null}
        </aside>
      </div>

      {linePanelTarget && selectedTool === "date"
        ? createPortal(
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-neutral-900">
                Ville
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  disabled={locked}
                  onChange={(event) => {
                    setCity(event.target.value);
                    setDocument((current) => ({
                      ...current,
                      city: event.target.value,
                    }));
                  }}
                  value={city}
                />
              </label>
              <label className="block text-sm font-semibold text-neutral-900">
                Date
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  disabled={locked}
                  onChange={(event) =>
                    setDocument((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                  type="date"
                  value={document.date}
                />
              </label>
            </div>,
            linePanelTarget,
          )
        : null}
      {linePanelTarget && selectedTool === "details"
        ? createPortal(
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-semibold text-neutral-900">
                  Début période
                  <input
                    className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                    disabled={locked}
                    onChange={(event) =>
                      setDocument((current) => ({
                        ...current,
                        period_start: event.target.value || null,
                      }))
                    }
                    type="date"
                    value={document.period_start ?? ""}
                  />
                </label>
                <label className="block text-sm font-semibold text-neutral-900">
                  Fin période
                  <input
                    className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                    disabled={locked}
                    onChange={(event) =>
                      setDocument((current) => ({
                        ...current,
                        period_end: event.target.value || null,
                      }))
                    }
                    type="date"
                    value={document.period_end ?? ""}
                  />
                </label>
              </div>
              <label className="block text-sm font-semibold text-neutral-900">
                Conditions de règlement
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  disabled={locked}
                  onChange={(event) =>
                    setDocument((current) => ({
                      ...current,
                      devis_payment_conditions: event.target.value,
                    }))
                  }
                  value={document.devis_payment_conditions}
                />
              </label>
              <label className="block text-sm font-semibold text-neutral-900">
                Banque
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  disabled={locked}
                  onChange={(event) =>
                    setDocument((current) => ({
                      ...current,
                      devis_bank_name: event.target.value,
                    }))
                  }
                  value={document.devis_bank_name}
                />
              </label>
              <label className="block text-sm font-semibold text-neutral-900">
                IBAN
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  disabled={locked}
                  onChange={(event) =>
                    setDocument((current) => ({
                      ...current,
                      devis_iban: event.target.value,
                    }))
                  }
                  value={document.devis_iban}
                />
              </label>
            </div>,
            linePanelTarget,
          )
        : null}
      <div
        aria-hidden="true"
        className="invoice-measurement print:hidden"
        ref={measurementRef}
      >
        <BonCommandePage
          amountWords={viewerAmountWords}
          document={viewerDocument}
          lineItems={viewerLineItems}
          measurementId="single"
          pageKind="single"
          totals={viewerTotals}
          tvaBreakdown={viewerTvaBreakdown}
          hasCachet={viewerHasCachet}
          tvaRate={viewerTvaRate}
        />
        <BonCommandePage
          amountWords={viewerAmountWords}
          document={viewerDocument}
          lineItems={viewerLineItems}
          measurementId="first"
          pageKind="first"
          totals={viewerTotals}
          tvaBreakdown={viewerTvaBreakdown}
          hasCachet={viewerHasCachet}
          tvaRate={viewerTvaRate}
        />
        <BonCommandePage
          amountWords={viewerAmountWords}
          document={viewerDocument}
          lineItems={viewerLineItems}
          measurementId="middle"
          pageKind="middle"
          totals={viewerTotals}
          tvaBreakdown={viewerTvaBreakdown}
          hasCachet={viewerHasCachet}
          tvaRate={viewerTvaRate}
        />
        <BonCommandePage
          amountWords={viewerAmountWords}
          document={viewerDocument}
          lineItems={viewerLineItems}
          measurementId="last"
          pageKind="last"
          totals={viewerTotals}
          tvaBreakdown={viewerTvaBreakdown}
          hasCachet={viewerHasCachet}
          tvaRate={viewerTvaRate}
        />
      </div>
    </div>
  );
}
