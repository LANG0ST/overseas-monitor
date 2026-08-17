import Image from "next/image";
import type { LineItem } from "@/lib/db/document-calculations";

export type InvoicePageKind = "single" | "first" | "middle" | "last";

export type InvoicePageDocument = {
  number: string | null;
  date: string;
  city: string;
  client_name: string;
  client_ice: string | null;
  client_address: string | null;
};

type InvoicePageProps = {
  document: InvoicePageDocument;
  lineItems: LineItem[];
  tvaRate: number;
  totals: { ht: number; tva: number; ttc: number };
  tvaBreakdown: { rate: number; amount: number }[];
  amountWords: string;
  pageKind: InvoicePageKind;
  measurementId?: string;
  selectedLine?: number;
  lineOffset?: number;
  onSelectLine?: (lineIndex: number) => void;
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(`${value}T00:00:00`));
}

export function InvoiceLineRow({ line, index, interactive = false, selected = false, onSelect }: { line: LineItem; index: number; interactive?: boolean; selected?: boolean; onSelect?: () => void }) {
  return (
    <tr
      className={`invoice-line-row ${interactive ? "cursor-pointer" : ""} ${selected ? "bg-primary-50" : ""}`}
      data-invoice-row={index}
      onClick={onSelect}
    >
      <td className="break-words px-3 py-3 font-medium text-neutral-900">{line.desc || "Sans désignation"}</td>
      <td className="break-words px-3 py-3 text-neutral-700">{line.unit}</td>
      <td className="px-3 py-3 text-right text-neutral-900">{line.qty}</td>
      <td className="px-3 py-3 text-right text-neutral-900">{line.tva_rate ?? 20}%</td>
      <td className="px-3 py-3 text-right text-neutral-900">{formatAmount(line.unit_price)}</td>
      <td className="px-3 py-3 text-right font-medium text-neutral-900">{formatAmount(line.qty * line.unit_price)}</td>
    </tr>
  );
}


export function InvoicePage({ document, lineItems, tvaRate, totals, tvaBreakdown, amountWords, pageKind, measurementId, selectedLine, lineOffset = 0, onSelectLine }: InvoicePageProps) {
    const showHeader = pageKind === "single" || pageKind === "first";
    const showTotals = pageKind === "single" || pageKind === "last";
    const rootLabel = measurementId ? `invoice-measure-page-${measurementId}` : undefined;

    return (
      <article className="invoice-page flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-white p-[14mm] text-primary-900" data-invoice-page={rootLabel}>
        {showHeader ? (
          <header className="shrink-0 border-b-2 border-primary-900 pb-8" data-invoice-header>
              <div className="grid grid-cols-[1.15fr_0.85fr] gap-8">
              <div>
                <Image alt="Overseas Services" className="h-auto w-[250px] object-contain" height={88} priority src="/logo.png" width={357} />
                <ul className="mt-8 space-y-3 text-base leading-relaxed"><li className="flex gap-3"><span aria-hidden="true" className="text-lg">•</span><span><strong>Nom du client :</strong> {document.client_name || "Client non renseigné"}</span></li><li className="flex gap-3"><span aria-hidden="true" className="text-lg">•</span><span><strong>Adresse :</strong> {document.client_address || "Non renseignée"}</span></li><li className="flex gap-3"><span aria-hidden="true" className="text-lg">•</span><span><strong>ICE :</strong> {document.client_ice || "Non renseigné"}</span></li></ul>
              </div>
            <div className="border-l border-primary-300 pl-8 text-left"><p className="text-xl font-bold leading-tight pt-23">Facture N° : {document.number || "Brouillon"}</p><p className="mt-5 text-xl font-semibold italic">{document.city || "Casablanca"}, <br></br>le {formatDate(document.date)}</p></div>
            </div>
          </header>
        ) : null}

        <div className={`min-h-0 flex-1 overflow-hidden ${showHeader ? "mt-10" : ""}`} data-invoice-table>
          <table className="w-full table-fixed text-sm"><thead className="bg-primary-900 text-left text-white" data-invoice-table-header><tr><th className="w-[33%] px-3 py-3">Désignation</th><th className="w-[11%] px-3 py-3">Unité</th><th className="w-[9%] px-3 py-3 text-right">Nombre</th><th className="w-[11%] px-3 py-3 text-right">TVA</th><th className="w-[17%] px-3 py-3 text-right">P.U. HT</th><th className="w-[19%] px-3 py-3 text-right">Montant HT</th></tr></thead><tbody className="divide-y divide-primary-200">{lineItems.map((line, index) => <InvoiceLineRow index={index} interactive={Boolean(onSelectLine)} key={`${index}-${line.desc}`} line={{ ...line, tva_rate: line.tva_rate ?? tvaRate }} onSelect={() => onSelectLine?.(lineOffset + index)} selected={selectedLine === lineOffset + index} />)}</tbody></table>{lineItems.length === 0 ? <p className="py-8 text-center text-sm text-neutral-600">Aucune ligne.</p> : null}
        </div>

        {showTotals ? <>
        <div className="mt-8 grid grid-cols-[1fr_230px] items-start gap-7 shrink-0" data-invoice-totals><p className="text-sm font-medium leading-relaxed">{amountWords}</p><div className="border-t-2 border-primary-900 pt-4"><table className="w-full text-sm"><tbody><tr><th className="py-1 text-left font-medium text-neutral-700">Total HT</th><td className="py-1 text-right font-semibold text-neutral-900">{formatAmount(totals.ht)}</td></tr>{tvaBreakdown.map(({ rate, amount }) => <tr key={rate}><th className="py-1 text-left font-medium text-neutral-700">TVA {rate}%</th><td className="py-1 text-right font-semibold text-neutral-900">{formatAmount(amount)}</td></tr>)}<tr><th className="pt-2 text-left text-lg font-bold text-primary-900">Total TTC</th><td className="pt-2 text-right text-lg font-bold text-primary-900">{formatAmount(totals.ttc)}</td></tr></tbody></table></div></div>
          <div aria-hidden="true" className="mt-10 shrink-0" />
          <footer className="invoice-footer mt-auto -mx-[14mm] -mb-[14mm] w-[210mm] shrink-0 border-t-4 border-primary-900 bg-neutral-100 px-[14mm] py-5 text-center text-xs leading-relaxed" data-invoice-footer><p>Adresse : AV 4 EME DMM ROUTE TARGA RES KHALID 2 EME ETAGE N°10, MARRAKECH</p><p className="mt-1 font-semibold">IF : 47244543 &nbsp;|&nbsp; RC : 108893 &nbsp;|&nbsp; TP : 64260589 &nbsp;|&nbsp; ICE : 002629109000015 &nbsp;|&nbsp; CNSS : 2285065</p><p className="mt-1">Tél : +212 666 765 794 &nbsp;|&nbsp; Email : a.sahraoui@overseasservices.ma</p></footer>
        </> : null}
      </article>
    );
  }
