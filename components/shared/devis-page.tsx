import Image from "next/image";
import type { LineItem } from "@/lib/db/document-calculations";

export type InvoicePageKind = "single" | "first" | "middle" | "last";

export type DevisPageDocument = {
  partenaire_id: string | null;
  number: string | null;
  date: string;
  city: string;
  client_name: string;
  client_ice: string | null;
  client_address: string | null;
  period_start: string | null;
  period_end: string | null;
  devis_fuel_driver: string;
  devis_payment_conditions: string;
  devis_bank_name: string;
  devis_iban: string;
};

type DevisPageProps = {
  document: DevisPageDocument;
  lineItems: LineItem[];
  tvaRate: number;
  totals: { ht: number; tva: number; ttc: number };
  tvaBreakdown: { rate: number; amount: number }[];
  hasCachet: boolean;
  amountWords: string;
  pageKind: InvoicePageKind;
  measurementId?: string;
  selectedLine?: number;
  lineOffset?: number;
  onSelectLine?: (lineIndex: number) => void;
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(
    new Date(`${value}T00:00:00`),
  );
}

export function InvoiceLineRow({
  line,
  index,
  interactive = false,
  selected = false,
  onSelect,
}: {
  line: LineItem;
  index: number;
  interactive?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <tr
      className={`invoice-line-row ${interactive ? "cursor-pointer" : ""} ${selected ? "bg-primary-50" : ""}`}
      data-invoice-row={index}
      onClick={onSelect}
    >
      <td className="break-words px-3 py-3 font-medium text-neutral-900">
        {line.desc || "Sans désignation"}
      </td>
      <td className="break-words px-3 py-3 text-neutral-700">{line.unit}</td>
      <td className="px-3 py-3 text-right text-neutral-900">{line.qty}</td>
      <td className="px-3 py-3 text-right text-neutral-900">
        {line.tva_rate ?? 20}%
      </td>
      <td className="px-3 py-3 text-right text-neutral-900">
        {formatAmount(line.unit_price)}
      </td>
      <td className="px-3 py-3 text-right font-medium text-neutral-900">
        {formatAmount(line.qty * line.unit_price)}
      </td>
    </tr>
  );
}

export function DevisPage({
  document,
  lineItems,
  tvaRate,
  totals,
  tvaBreakdown,
  hasCachet,
  amountWords,
  pageKind,
  measurementId,
  selectedLine,
  lineOffset = 0,
  onSelectLine,
}: DevisPageProps) {
  const showHeader = pageKind === "single" || pageKind === "first";
  const showTotals = pageKind === "single" || pageKind === "last";
  const rootLabel = measurementId
    ? `invoice-measure-page-${measurementId}`
    : undefined;

  return (
    <article
      className="invoice-page flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-white p-[9mm] text-primary-900"
      data-invoice-page={rootLabel}
    >
      {showHeader ? (
        <header
          className="shrink-0 "
          data-invoice-header
        >
          <div className="grid grid-cols-[1.15fr_0.85fr] gap-8">
            <div>
              <Image
                alt="Overseas Services"
                className="h-auto w-[250px] object-contain"
                height={88}
                priority
                src="/logo.png"
                width={357}
              />
            </div>
            <div className="pl-8 text-left">
              <p className="text-xl font-bold leading-tight">
                Devis N° : {document.number || "Brouillon"}
              </p>
              <p className="mt-2  font-semibold italic">
                {document.city || "Casablanca"},le{" "}
                {formatDate(document.date)}
              </p>
            </div>
          </div>
          <div className="mt-5 grid w-full grid-cols-2 gap-5 rounded-2xl text-xs leading-relaxed">
            <div className="min-h-28 rounded-2xl border border-primary-600 px-5 py-4">
              <p className="font-bold">OVERSEAS SERVICES SARL</p>
              <p>AV 4 EME DMM ROUTE TARGA RES KHALID 2 EME ETAGE N°10, MARRAKECH</p>
              <p>ICE : 002629109000015</p>
            </div>
            <div className="min-h-28 rounded-2xl border border-primary-600 px-5 py-4">
              <p className="font-bold">CLIENT :</p>
              <p className="font-bold">{document.client_name || "Client non renseigné"}</p>
              <p>{document.client_address || "Adresse non renseignée"}</p>
              <p>ICE : {document.client_ice || "Non renseigné"}</p>
            </div>
          </div>
          <p className="mt-5 text-red-500 pt-4 text-center text-sm font-semibold">
            Période : {formatDate(document.period_start) || "—"} à {formatDate(document.period_end) || "—"}
          </p>
        </header>
      ) : null}

      <div
        className={`min-h-0 flex-1 overflow-hidden ${showHeader ? "mt-5" : ""}`}
        data-invoice-table
      >
        <table className="w-full table-fixed text-sm">
          <thead
            className="bg-primary-900 text-left text-white"
            data-invoice-table-header
          >
            <tr>
              <th className="w-[33%] px-3 py-3">Désignation</th>
              <th className="w-[11%] px-3 py-3">Unité</th>
              <th className="w-[9%] px-3 py-3 text-right">Nombre</th>
              <th className="w-[11%] px-3 py-3 text-right">TVA</th>
              <th className="w-[17%] px-3 py-3 text-right">P.U. HT</th>
              <th className="w-[19%] px-3 py-3 text-right">Montant HT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-200">
            {lineItems.map((line, index) => (
              <InvoiceLineRow
                index={index}
                interactive={Boolean(onSelectLine)}
                key={`${index}-${line.desc}`}
                line={{ ...line, tva_rate: line.tva_rate ?? tvaRate }}
                onSelect={() => onSelectLine?.(lineOffset + index)}
                selected={selectedLine === lineOffset + index}
              />
            ))}
          </tbody>
        </table>
        {lineItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-600">
            Aucune ligne.
          </p>
        ) : null}
      </div>

      {showTotals ? (
        <>
          <div
            className=" grid grid-cols-[1fr_230px] items-start gap-7 shrink-0"
            data-invoice-totals
          >
            <div className="relative">
              <p className="text-sm font-medium leading-relaxed">
                {amountWords}
              </p>
            </div>
            <div className="border-t-2 border-primary-900 pt-2 mt-[0.5em]">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <th className="py-1 text-left font-medium text-neutral-700">
                      Total HT
                    </th>
                    <td className="py-1 text-right font-semibold text-neutral-900">
                      {formatAmount(totals.ht)}
                    </td>
                  </tr>
                  {tvaBreakdown.map(({ rate, amount }) => (
                    <tr key={rate}>
                      <th className="py-1 text-left font-medium text-neutral-700">
                        TVA {rate}%
                      </th>
                      <td className="py-1 text-right font-semibold text-neutral-900">
                        {formatAmount(amount)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <th className=" text-left text-lg font-bold text-primary-900">
                      Total TTC
                    </th>
                    <td className="text-right text-lg font-bold text-primary-900">
                      {formatAmount(totals.ttc)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-6 border-t border-primary-200 pt-3 text-[9px] leading-relaxed">
            <div>
              <p className="font-semibold text-primary-900">
                Conditions générales de location :
              </p>
              <p className="mt-1">
                Tarifs établis sur la base de 9 heures d&apos;utilisation par
                jour (08h00 – 18h00) ; Durée décomptée en jours ouvrés (lundi au samedi) —
                dimanches et jours fériés travaillés facturés ; tout jour dû est
                un jour facturé. Mobilisation et démobilisation à la charge du
                client sauf mention contraire. Carburant et conducteur :{" "}
                {document.devis_fuel_driver}.
              </p>
            </div>
            <div>
              <p className="font-semibold text-primary-900">Règlement</p>
              <p>Conditions : {document.devis_payment_conditions}</p>
              <p>BANK : {document.devis_bank_name}</p>
              <p>IBAN : {document.devis_iban}</p>
            </div>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-6 border-t border-primary-200 pt-3 text-left text-[10px] font-semibold text-primary-900">
            <div className="relative min-h-[90px]">
              SIGNATURE DU FOURNISSEUR
              {hasCachet ? (
                <Image
                  alt="Cachet de l’entreprise"
                  className="pointer-events-none absolute left-9/12 bottom-2 h-auto w-32 -translate-x-1/2 object-contain"
                  height={439}
                  src="/cachet.png"
                  width={568}
                />
              ) : null}
            </div>
            <div className="min-h-[90px]">
              SIGNATURE DU CLIENT
            </div>
          </div>
          <footer
            className="invoice-footer mt-auto -mx-[9mm] -mb-[9mm] w-[210mm] shrink-0 border-t-2 border-primary-900 bg-neutral-100 px-[14mm] py-5 text-center text-xs leading-relaxed"
            data-invoice-footer
          >
            <p>
              Adresse : AV 4 EME DMM ROUTE TARGA RES KHALID 2 EME ETAGE N°10,
              MARRAKECH
            </p>
            <p className="mt-1 font-semibold">
              IF : 47244543 &nbsp;|&nbsp; RC : 108893 &nbsp;|&nbsp; TP :
              64260589 &nbsp;|&nbsp; ICE : 002629109000015 &nbsp;|&nbsp; CNSS :
              2285065
            </p>
            <p className="mt-1">
              Tél : +212 666 765 794 &nbsp;|&nbsp; Email :
              a.sahraoui@overseasservices.ma
            </p>
          </footer>
        </>
      ) : null}
    </article>
  );
}
