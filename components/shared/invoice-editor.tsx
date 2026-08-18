"use client";

import Link from "next/link";
import {
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
  Download,
  FilePlus2,
  HardHat,
  Hash,
  Trash2,
  Truck,
  UserPen,
  UserRound,
  WalletCards,
} from "lucide-react";
import {
  assignInvoiceNumberAction,
  assignInvoiceNumberManuallyAction,
  deleteInvoiceAction,
  saveInvoiceAction,
  setInvoicePaidAction,
} from "@/app/(app)/factures/actions";
import {
  InvoicePage,
  type InvoicePageKind,
} from "@/components/shared/invoice-page";
import { amountInFrenchWords } from "@/lib/format/amount-in-words";
import {
  calculateTotals,
  roundMoney,
  type LineItem,
} from "@/lib/db/document-calculations";

type Invoice = {
  id: string;
  number: string | null;
  date: string;
  city: string;
  has_cachet: boolean;
  client_name: string;
  client_ice: string | null;
  client_address: string | null;
  line_items: LineItem[];
  tva_rate: number;
  ht: number;
  tva: number;
  ttc: number;
  paid?: boolean;
  is_locked: boolean;
};

type Engin = { id: string; name: string; unit: string; default_price: number };
type Tool =
  | "line"
  | "engin"
  | "overtime"
  | "mobilisation"
  | "client"
  | "date"
  | "totals"
  | "payment"
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
  { id: "client", label: "Infos client", Icon: UserRound },
  { id: "date", label: "Date et lieu", Icon: CalendarDays },
  { id: "payment", label: "Règlement", Icon: WalletCards },
  { id: "delete", label: "Supprimer", Icon: Trash2 },
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

export function InvoiceEditor({
  initialDocument,
  isAdmin,
  engins,
}: {
  initialDocument: Invoice;
  isAdmin: boolean;
  engins: Engin[];
}) {
  const router = useRouter();
  const [document, setDocument] = useState(initialDocument);
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initialDocument.line_items ?? [],
  );
  const [city, setCity] = useState(initialDocument.city || "Casablanca");
  const [hasCachet, setHasCachet] = useState(Boolean(initialDocument.has_cachet));
  const [tvaRate, setTvaRate] = useState(
    normalizeTvaRate(Number(initialDocument.tva_rate)),
  );
  const [selectedTool, setSelectedTool] = useState<Tool>("line");
  const [selectedLine, setSelectedLine] = useState(0);
  const [selectedEngin, setSelectedEngin] = useState("");
  const [manualNumber, setManualNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pages, setPages] = useState<LineItem[][]>(() => [
    initialDocument.line_items ?? [],
  ]);
  const [pageScale, setPageScale] = useState(1);
  const linePanelTarget =
    typeof window === "undefined"
      ? null
      : window.document.querySelector<HTMLElement>("aside.glass-card.order-3");
  const viewerRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  const locked = document.is_locked;
  const totals = useMemo(
    () => calculateTotals(lineItems, tvaRate),
    [lineItems, tvaRate],
  );
  const tvaBreakdown = useMemo(
    () =>
      [0, 10, 20].flatMap((rate) => {
        const matchingLines = lineItems.filter(
          (line) => Number(line.tva_rate ?? tvaRate) === rate,
        );
        const amount = roundMoney(
          matchingLines.reduce(
            (sum, line) =>
              sum + roundMoney((line.qty * line.unit_price * rate) / 100),
            0,
          ),
        );
        return matchingLines.length > 0 ? [{ rate, amount }] : [];
      }),
    [lineItems, tvaRate],
  );
  const amountWords = useMemo(
    () => amountInFrenchWords(totals.ttc),
    [totals.ttc],
  );

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
      if (lineItems.length === 0) setPages([[]]);
      else if (
        rowHeights.length === lineItems.length &&
        Object.values(capacities).every((capacity) => capacity > 0)
      )
        setPages(splitMeasuredPages(lineItems, rowHeights, capacities));
      else setPages([lineItems]);
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
    amountWords,
    document.client_address,
    document.client_ice,
    document.client_name,
    lineItems,
    totals.ttc,
    tvaRate,
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
    setError(null);
    return true;
  }

  function addLine(kind: "line" | "overtime" | "mobilisation") {
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
        : kind === "mobilisation"
          ? {
              desc: "Mobilisation",
              unit: "Fois",
              qty: 1,
              unit_price: 0,
              tva_rate: tvaRate,
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

  function assignNumber() {
    if (
      locked ||
      document.number ||
      !window.confirm(
        "Attribuer un numéro à cette facture ? Cette action consomme un numéro.",
      )
    )
      return;
    startTransition(async () => {
      applyResult(await assignInvoiceNumberAction(document.id), true);
    });
  }

  function assignManualNumber() {
    if (locked || document.number) return;
    const number = window.prompt("Numéro manuel de la facture", manualNumber);
    if (!number || !window.confirm(`Définir le numéro « ${number.trim()} » ?`))
      return;
    setManualNumber(number.trim());
    startTransition(async () => {
      applyResult(
        await assignInvoiceNumberManuallyAction(document.id, number),
        true,
      );
    });
  }

  function save() {
    if (
      locked ||
      !window.confirm(
        document.number
          ? "Enregistrer et verrouiller cette facture ?"
          : "Enregistrer cette facture en brouillon ?",
      )
    )
      return;
    startTransition(async () => {
      applyResult(
        await saveInvoiceAction(
          document.id,
          lineItems,
          tvaRate,
          Boolean(document.number),
          document.date,
          city,
          hasCachet,
        ),
      );
    });
  }

  function togglePaid() {
    if (
      !locked ||
      !window.confirm(
        document.paid
          ? "Marquer cette facture comme impayée ?"
          : "Marquer cette facture comme payée ?",
      )
    )
      return;
    startTransition(async () => {
      applyResult(await setInvoicePaidAction(document.id, !document.paid));
    });
  }

  function deleteDocument() {
    if (
      !window.confirm(
        "Désactiver cette facture ? Elle restera disponible dans les inactifs.",
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteInvoiceAction(document.id);
      if (applyResult(result)) router.push("/factures");
    });
  }

  function printInvoice() {
    window.print();
  }

  function selectTool(id: Tool) {
    if (id === "line" || id === "overtime" || id === "mobilisation")
      return addLine(id);
    if (id === "delete") return deleteDocument();
    setSelectedTool(id);
  }

  const selected = lineItems[selectedLine];
  const unitOptions =
    selected && !UNIT_OPTIONS.includes(selected.unit)
      ? [selected.unit, ...UNIT_OPTIONS]
      : UNIT_OPTIONS;

  return (
    <div className="invoice-editor space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link
            className="text-sm font-medium text-primary-700"
            href="/factures"
          >
            ← Factures
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
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
          <button
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-ink-900 shadow-sm"
            onClick={printInvoice}
            type="button"
          >
            <Download className="mr-2 inline" size={16} />
            Télécharger en PDF
          </button>
          {!locked && !document.number ? (
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
          {!locked && !document.number && isAdmin ? (
            <button
              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-ink-900 shadow-sm"
              disabled={pending}
              onClick={assignManualNumber}
              type="button"
            >
              <UserPen className="mr-2 inline" size={16} />
              Numéro manuel
            </button>
          ) : null}
          {!locked ? (
            <button
              className={`rounded-full border px-4 py-2 text-sm font-semibold shadow-sm ${hasCachet ? "border-primary-700 bg-primary-100 text-primary-900" : "border-neutral-300 bg-white text-ink-900"}`}
              onClick={() => setHasCachet((current) => !current)}
              type="button"
            >
              {hasCachet ? "Retirer le cachet" : "Ajouter le cachet"}
            </button>
          ) : null}
          {!locked ? (
            <button
              className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              disabled={pending}
              onClick={save}
              type="button"
            >
              <DatabaseArrowDownIcon className="mr-2 inline" size={16} />
              {pending
                ? "Enregistrement…"
                : document.number
                  ? "Enregistrer et verrouiller"
                  : "Enregistrer"}
            </button>
          ) : null}
        </div>
      </header>
      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900 print:hidden">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="hidden space-y-3 print:hidden xl:block">
          <p className="px-1 text-xs font-bold uppercase tracking-wide text-neutral-700">
            Outils facture
          </p>
          <div className="grid grid-cols-2 gap-2">
            {tools.map(({ id, label, Icon }) => (
              <button
                className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center text-xs font-semibold transition-colors ${selectedTool === id ? "border-ink-900 bg-ink-900 text-white" : "border-neutral-300 bg-white text-ink-900 hover:bg-primary-50"}`}
                disabled={locked && id !== "payment" && id !== "delete"}
                key={id}
                onClick={() => selectTool(id)}
                type="button"
              >
                <Icon size={20} strokeWidth={1.8} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </aside>

        <div
          className="invoice-print-area invoice-viewer order-1 min-w-0 rounded-2xl border border-neutral-300 bg-slate-200/80 p-3 shadow-inner sm:p-4"
          ref={viewerRef}
        >
          <div className="mb-3 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 print:hidden">
            <span>Aperçu PDF</span>
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
                    <InvoicePage
                      amountWords={amountWords}
                      document={document}
                      lineItems={page}
                      lineOffset={lineOffset}
                      pageKind={pageKind}
                      selectedLine={selectedLine}
                      totals={totals}
                      tvaBreakdown={tvaBreakdown}
                      hasCachet={hasCachet}
                      tvaRate={tvaRate}
                      onSelectLine={(lineIndex) => {
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
              disabled={locked && id !== "payment" && id !== "delete"}
              key={id}
              onClick={() => selectTool(id)}
              type="button"
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <aside className="glass-card order-3 rounded-2xl p-5 print:hidden">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">
              {selectedTool === "line"
                ? "Propriétés de la ligne"
                : tools.find((tool) => tool.id === selectedTool)?.label}
            </h2>
            <span className="text-xs text-neutral-500">
              {locked ? "Lecture seule" : "Édition"}
            </span>
          </div>
          {selectedTool === "line" ? (
            <div className="mt-5 space-y-4">
              {selected ? (
                <>
                  <label className="block text-sm font-semibold text-neutral-900">
                    Désignation
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                      disabled={locked}
                      onChange={(event) =>
                        updateLine("desc", event.target.value)
                      }
                      value={selected.desc}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-neutral-900">
                    Unité
                    <select
                      className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                      disabled={locked}
                      onChange={(event) =>
                        updateLine("unit", event.target.value)
                      }
                      value={selected.unit}
                    >
                      {unitOptions.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm font-semibold text-neutral-900">
                      Nombre
                      <input
                        className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                        disabled={locked}
                        min="0"
                        onChange={(event) =>
                          updateLine("qty", event.target.value)
                        }
                        type="number"
                        value={selected.qty}
                      />
                    </label>
                    <label className="block text-sm font-semibold text-neutral-900">
                      P.U. HT
                      <input
                        className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                        disabled={locked}
                        min="0"
                        onChange={(event) =>
                          updateLine("unit_price", event.target.value)
                        }
                        step="0.01"
                        type="number"
                        value={selected.unit_price}
                      />
                    </label>
                  </div>
                  <button
                    className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900"
                    disabled={locked}
                    onClick={() =>
                      setLineItems((current) =>
                        current.filter((_, index) => index !== selectedLine),
                      )
                    }
                    type="button"
                  >
                    Supprimer cette ligne
                  </button>
                </>
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
                  {engins.map((engin) => (
                    <option key={engin.id} value={engin.id}>
                      {engin.name} · {engin.unit} ·{" "}
                      {formatAmount(Number(engin.default_price))}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="w-full rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={locked || !selectedEngin}
                onClick={addEngin}
                type="button"
              >
                Ajouter à la facture
              </button>
              {engins.length === 0 ? (
                <p className="text-xs text-neutral-600">
                  Aucun engin actif dans le parc.
                </p>
              ) : null}
            </div>
          ) : null}
          {selectedTool === "client" ? (
            <div className="mt-5 space-y-3 text-sm text-neutral-700">
              <p>
                <strong className="text-neutral-900">Nom :</strong>{" "}
                {document.client_name}
              </p>
              <p>
                <strong className="text-neutral-900">ICE :</strong>{" "}
                {document.client_ice || "Non renseigné"}
              </p>
              <p>
                <strong className="text-neutral-900">Adresse :</strong>{" "}
                {document.client_address || "Non renseignée"}
              </p>
              <p className="rounded-xl bg-primary-50 p-3 text-xs">
                Ces informations sont un instantané pris à la création de la
                facture.
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
          {selectedTool === "payment" ? (
            <div className="mt-5 space-y-4">
              <p className="text-sm text-neutral-700">
                Le règlement est modifiable après verrouillage.
              </p>
              <button
                className="w-full rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-ink-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!locked || pending}
                onClick={togglePaid}
                type="button"
              >
                {document.paid ? "Marquer impayée" : "Marquer payée"}
              </button>
              <p className="text-sm font-semibold text-neutral-900">
                Statut : {document.paid ? "Payée" : "Impayée"}
              </p>
            </div>
          ) : null}
          {selectedTool === "delete" ? (
            <div className="mt-5 space-y-4">
              <p className="text-sm text-neutral-700">
                La facture sera désactivée mais restera récupérable dans les
                inactifs.
              </p>
              <button
                className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900"
                disabled={pending}
                onClick={deleteDocument}
                type="button"
              >
                Désactiver la facture
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
      {linePanelTarget && selectedTool === "line" && selected
        ? createPortal(
            <label className="mt-5 block text-sm font-semibold text-neutral-900">
              TVA de la ligne sélectionnée (%)
              <select
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                disabled={locked}
                onChange={(event) => updateLine("tva_rate", event.target.value)}
                value={String(
                  normalizeTvaRate(Number(selected.tva_rate ?? tvaRate)),
                )}
              >
                <option value="20">20%</option>
                <option value="10">10%</option>
                <option value="0">0%</option>
              </select>
            </label>,
            linePanelTarget,
          )
        : null}

      <div
        aria-hidden="true"
        className="invoice-measurement print:hidden"
        ref={measurementRef}
      >
        <InvoicePage
          amountWords={amountWords}
          document={document}
          lineItems={lineItems}
          measurementId="single"
          pageKind="single"
          totals={totals}
          tvaBreakdown={tvaBreakdown}
          hasCachet={hasCachet}
          tvaRate={tvaRate}
        />
        <InvoicePage
          amountWords={amountWords}
          document={document}
          lineItems={lineItems}
          measurementId="first"
          pageKind="first"
          totals={totals}
          tvaBreakdown={tvaBreakdown}
          hasCachet={hasCachet}
          tvaRate={tvaRate}
        />
        <InvoicePage
          amountWords={amountWords}
          document={document}
          lineItems={lineItems}
          measurementId="middle"
          pageKind="middle"
          totals={totals}
          tvaBreakdown={tvaBreakdown}
          hasCachet={hasCachet}
          tvaRate={tvaRate}
        />
        <InvoicePage
          amountWords={amountWords}
          document={document}
          lineItems={lineItems}
          measurementId="last"
          pageKind="last"
          totals={totals}
          tvaBreakdown={tvaBreakdown}
          hasCachet={hasCachet}
          tvaRate={tvaRate}
        />
      </div>
    </div>
  );
}
