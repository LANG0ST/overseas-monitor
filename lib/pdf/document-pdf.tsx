/* eslint-disable jsx-a11y/alt-text -- These are PDF primitives, not HTML images. */
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";
import { COMPANY_ADDRESS } from "@/lib/company-details";
import { amountInFrenchWords } from "@/lib/format/amount-in-words";
import type { DocumentType } from "@/lib/db/documents";
import { roundMoney, type LineItem } from "@/lib/db/document-calculations";

export type PdfDocumentData = {
  id: string;
  type: DocumentType;
  number: string | null;
  date: string;
  city: string | null;
  has_cachet: boolean;
  client_name: string;
  client_ice: string | null;
  client_address: string | null;
  line_items: LineItem[];
  tva_rate: number;
  ht: number;
  tva: number;
  ttc: number;
  period_start: string | null;
  period_end: string | null;
  devis_fuel_driver: string | null;
  devis_driver: string | null;
  devis_payment_conditions: string | null;
  devis_bank_name: string | null;
  devis_iban: string | null;
  reference_facture_number: string | null;
  motif: string | null;
  avoir_payment_method: string | null;
  avoir_payment_reference: string | null;
};

type PdfAssets = { logo: string; cachet: string };

const NAVY = "#07305a";
const BLUE = "#1772ba";
const LIGHT_BLUE = "#c9dff1";
const GRAY = "#f2f4f6";
const TEXT = "#20242a";
const MUTED = "#5e6670";
const RED = "#e24848";
const PAGE_HEIGHT = 841.89;
const GEIST_FONT_DIR = path.join(
  process.cwd(),
  "node_modules",
  "geist",
  "dist",
  "fonts",
  "geist-sans",
);

Font.register({
  family: "GeistPdf",
  fonts: [
    { src: path.join(GEIST_FONT_DIR, "Geist-Regular.ttf"), fontWeight: 400 },
    { src: path.join(GEIST_FONT_DIR, "Geist-Medium.ttf"), fontWeight: 500 },
    { src: path.join(GEIST_FONT_DIR, "Geist-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(GEIST_FONT_DIR, "Geist-Bold.ttf"), fontWeight: 700 },
    {
      src: path.join(GEIST_FONT_DIR, "Geist-SemiBoldItalic.ttf"),
      fontStyle: "italic",
      fontWeight: 600,
    },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: NAVY,
    fontFamily: "GeistPdf",
    fontSize: 10.5,
    paddingHorizontal: 25.5,
    paddingTop: 25.5,
    paddingBottom: 25.5,
  },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { width: 154, height: 38, objectFit: "contain" },
  titleBlock: { width: 250, alignItems: "flex-end" },
  title: { fontSize: 15, fontWeight: 700, textAlign: "right" },
  date: { marginTop: 3, fontSize: 12, fontStyle: "italic", fontWeight: 600, textAlign: "right" },
  invoiceClient: {
    alignSelf: "flex-start",
    minWidth: 227,
    maxWidth: 410,
    minHeight: 51,
    marginTop: 12,
    border: `0.8 solid ${BLUE}`,
    borderRadius: 7.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 9,
    lineHeight: 1.375,
  },
  partyRow: { flexDirection: "row", gap: 15, marginTop: 15 },
  partyCard: {
    width: "50%",
    minHeight: 78,
    border: `0.8 solid ${BLUE}`,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 11,
    lineHeight: 1.35,
  },
  bold: { fontWeight: 700 },
  invoiceClientName: { fontSize: 10.5, fontWeight: 700 },
  smallAddress: { marginTop: 1.5, fontSize: 8.25, color: NAVY },
  detailLine: { marginTop: 1.5 },
  period: { marginTop: 13, color: RED, textAlign: "center", fontWeight: 600 },
  creditInfo: { marginTop: 13, textAlign: "center", lineHeight: 1.4 },
  table: { marginTop: 15 },
  finalPageSpacer: { flexGrow: 1 },
  tableHeader: { flexDirection: "row", minHeight: 28, backgroundColor: NAVY, alignItems: "center" },
  headerText: { color: "#ffffff", fontWeight: 700, fontSize: 10.5 },
  narrowHeader: { paddingHorizontal: 0 },
  compactCell: { paddingHorizontal: 6 },
  row: {
    flexDirection: "row",
    minHeight: 25,
    borderBottom: `0.6 solid ${LIGHT_BLUE}`,
    alignItems: "center",
  },
  cell: { paddingHorizontal: 9, paddingVertical: 9, color: TEXT },
  designation: { width: "33%", fontWeight: 500 },
  unit: { width: "8%", color: MUTED },
  qty: { width: "9%", textAlign: "right" },
  vat: { width: "8%", textAlign: "right" },
  unitPrice: { width: "21%", textAlign: "right" },
  amount: { width: "21%", textAlign: "right", fontWeight: 500 },
  linePeriod: { marginTop: 3, color: BLUE, fontWeight: 600, fontSize: 6.7 },
  empty: { paddingVertical: 20, textAlign: "center", color: MUTED },
  totalsRow: { flexDirection: "row", gap: 22, marginTop: 14, alignItems: "flex-start" },
  invoiceTotalsRow: { minHeight: 110 },
  words: { width: "58%", fontSize: 10.5, fontWeight: 500, lineHeight: 1.45, color: NAVY },
  totals: { width: "42%", borderTop: `1.5 solid ${NAVY}`, paddingTop: 8 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalLabel: { color: MUTED },
  totalValue: { fontWeight: 600, color: TEXT },
  grandTotalLabel: { fontWeight: 700, fontSize: 13.5, color: NAVY },
  grandTotalValue: { fontWeight: 700, fontSize: 13.5, color: NAVY },
  conditions: {
    flexDirection: "row",
    gap: 18,
    marginTop: 11,
    borderTop: `0.6 solid ${LIGHT_BLUE}`,
    paddingTop: 8,
    fontSize: 6.5,
    lineHeight: 1.35,
  },
  conditionColumn: { width: "50%" },
  payment: { marginTop: 10, borderTop: `0.6 solid ${LIGHT_BLUE}`, paddingTop: 7, lineHeight: 1.5 },
  signatures: {
    flexDirection: "row",
    gap: 18,
    minHeight: 68,
    marginTop: 8,
    borderTop: `0.6 solid ${LIGHT_BLUE}`,
    paddingTop: 7,
    fontWeight: 700,
    fontSize: 7,
  },
  signature: { position: "relative", width: "50%" },
  stamp: { position: "absolute", width: 92, height: 71, objectFit: "contain", left: 78, top: 0 },
  invoiceStamp: { position: "absolute", width: 105, height: 81, objectFit: "contain", left: 184, top: 24 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 70,
    borderTop: `2 solid ${NAVY}`,
    backgroundColor: GRAY,
    paddingHorizontal: 40,
    paddingTop: 12,
    paddingBottom: 12,
    textAlign: "center",
    fontSize: 9,
    lineHeight: 1.375,
  },
});

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(`${value}T00:00:00`));
}

function formatPeriodDate(value: string) {
  const [, month, day] = value.split("-");
  return day && month ? `${day}/${month}` : value;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(value)
    .replace(/\u202f/g, " ") + " MAD";
}

function estimateRowHeight(line: LineItem) {
  const descriptionLines = Math.max(1, Math.ceil((line.desc?.length || 1) / 46));
  return 35 + (descriptionLines - 1) * 9 + (line.period_start && line.period_end ? 10 : 0);
}

function pageBudgets(type: DocumentType, hasPeriod: boolean) {
  const header = type === "facture" ? 105 : type === "avoir" ? 192 : 165 + (hasPeriod ? 18 : 0);
  const tail = type === "facture" ? 165 : type === "devis" ? 250 : type === "avoir" ? 230 : 190;
  const usable = PAGE_HEIGHT - 54;
  const tableHeader = 28;
  return {
    single: usable - header - tail - tableHeader - 22,
    first: usable - header - tableHeader - 22,
    middle: usable - tableHeader - 25,
    last: usable - tail - tableHeader - 22,
  };
}

function paginate(document: PdfDocumentData) {
  const items = document.line_items ?? [];
  if (items.length === 0) return [[]];
  const heights = items.map(estimateRowHeight);
  const budgets = pageBudgets(document.type, Boolean(document.period_start || document.period_end));
  const total = heights.reduce((sum, height) => sum + height, 0);
  if (total <= budgets.single || items.length === 1) return [items];

  const pages: LineItem[][] = [];
  let cursor = 0;
  const take = (capacity: number, leaveOne: boolean) => {
    const limit = leaveOne ? items.length - 1 : items.length;
    let end = cursor;
    let height = 0;
    while (end < limit) {
      const next = heights[end];
      if (end > cursor && height + next > capacity) break;
      height += next;
      end += 1;
    }
    return Math.max(cursor + 1, end);
  };

  let end = take(budgets.first, true);
  pages.push(items.slice(cursor, end));
  cursor = end;
  while (cursor < items.length) {
    const remainingHeight = heights.slice(cursor).reduce((sum, height) => sum + height, 0);
    if (remainingHeight <= budgets.last || cursor === items.length - 1) {
      pages.push(items.slice(cursor));
      break;
    }
    end = take(budgets.middle, true);
    pages.push(items.slice(cursor, end));
    cursor = end;
  }
  return pages;
}

function Header({ document, logo }: { document: PdfDocumentData; logo: string }) {
  const titles: Record<DocumentType, string> = {
    facture: "Facture",
    devis: "Devis",
    bon_commande: "Bon de commande",
    avoir: "Avoir",
  };
  return (
    <View>
      <View style={styles.top}>
        <Image src={logo} style={styles.logo} />
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{titles[document.type]} N° : {document.number || "Brouillon"}</Text>
          <Text style={styles.date}>{document.city || "Casablanca"}, le {formatDate(document.date)}</Text>
        </View>
      </View>

      {document.type === "facture" ? (
        <View
          style={[
            styles.invoiceClient,
            {
              width: Math.min(
                410,
                Math.max(227, 60 + (document.client_name?.length || 0) * 7.2),
              ),
            },
          ]}
        >
          <Text style={styles.invoiceClientName}>Client: {document.client_name || "Client non renseigné"}</Text>
          {document.client_address ? <Text style={styles.smallAddress}>{document.client_address}</Text> : null}
          {document.client_ice ? <Text style={styles.detailLine}>ICE : {document.client_ice}</Text> : null}
        </View>
      ) : (
        <View style={styles.partyRow}>
          <View style={styles.partyCard}>
            <Text style={styles.bold}>{document.type === "bon_commande" ? "VENDEUR :" : "OVERSEAS SERVICES SARL"}</Text>
            {document.type === "bon_commande" ? (
              <>
                <Text style={[styles.bold, styles.detailLine]}>{document.client_name || "Fournisseur non renseigné"}</Text>
                {document.client_address ? <Text style={styles.smallAddress}>{document.client_address}</Text> : null}
                {document.client_ice ? <Text style={styles.detailLine}>ICE : {document.client_ice}</Text> : null}
              </>
            ) : (
              <>
                <Text style={styles.smallAddress}>{COMPANY_ADDRESS}</Text>
                <Text style={styles.detailLine}>ICE : 002629109000015</Text>
              </>
            )}
          </View>
          <View style={styles.partyCard}>
            <Text style={styles.bold}>{document.type === "bon_commande" ? "ACHETEUR :" : "CLIENT :"}</Text>
            {document.type === "bon_commande" ? (
              <>
                <Text style={[styles.bold, styles.detailLine]}>OVERSEAS SERVICES SARL</Text>
                <Text style={styles.smallAddress}>{COMPANY_ADDRESS}</Text>
                <Text style={styles.detailLine}>ICE : 002629109000015</Text>
              </>
            ) : (
              <>
                <Text style={[styles.bold, styles.detailLine]}>{document.client_name || "Client non renseigné"}</Text>
                {document.client_address ? <Text style={styles.smallAddress}>{document.client_address}</Text> : null}
                {document.client_ice ? <Text style={styles.detailLine}>ICE : {document.client_ice}</Text> : null}
              </>
            )}
          </View>
        </View>
      )}

      {(document.type === "devis" || document.type === "bon_commande") && (document.period_start || document.period_end) ? (
        <Text style={styles.period}>Période : {formatDate(document.period_start)} à {formatDate(document.period_end)}</Text>
      ) : null}
      {document.type === "avoir" ? (
        <View style={styles.creditInfo}>
          <Text style={styles.bold}>AVOIR SUR FACTURE N° {document.reference_facture_number || "-"}</Text>
          <Text style={{ color: RED, marginTop: 2 }}>Motif : {document.motif || "Non renseigné"}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Table({ document, items, first }: { document: PdfDocumentData; items: LineItem[]; first: boolean }) {
  return (
    <View style={[styles.table, !first ? { marginTop: 0 } : undefined]}>
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, styles.designation, styles.headerText]}>{document.type === "avoir" ? "Désignation à créditer" : "Désignation"}</Text>
        <Text style={[styles.cell, styles.unit, styles.headerText, styles.compactCell]}>Unité</Text>
        <Text style={[styles.cell, styles.qty, styles.headerText, styles.narrowHeader]}>Nombre</Text>
        <Text style={[styles.cell, styles.vat, styles.headerText, styles.compactCell]}>TVA</Text>
        <Text style={[styles.cell, styles.unitPrice, styles.headerText, styles.compactCell]}>P.U. HT</Text>
        <Text style={[styles.cell, styles.amount, styles.headerText, styles.compactCell]}>Montant HT</Text>
      </View>
      {items.map((line, index) => (
        <View key={`${index}-${line.desc}`} style={styles.row} wrap={false}>
          <View style={[styles.cell, styles.designation]}>
            <Text>{line.desc || "Sans désignation"}</Text>
            {line.period_start && line.period_end ? (
              <Text style={styles.linePeriod}>PÉRIODE : DU {formatPeriodDate(line.period_start)} AU {formatPeriodDate(line.period_end)}</Text>
            ) : null}
          </View>
          <Text style={[styles.cell, styles.unit, styles.compactCell]}>{line.unit}</Text>
          <Text style={[styles.cell, styles.qty, styles.compactCell]}>{line.qty}</Text>
          <Text style={[styles.cell, styles.vat, styles.compactCell]}>{line.tva_rate ?? document.tva_rate}%</Text>
          <Text style={[styles.cell, styles.unitPrice, styles.compactCell]}>{formatAmount(line.unit_price)}</Text>
          <Text style={[styles.cell, styles.amount, styles.compactCell]}>{formatAmount(line.qty * line.unit_price)}</Text>
        </View>
      ))}
      {items.length === 0 ? <Text style={styles.empty}>Aucune ligne.</Text> : null}
    </View>
  );
}

function Totals({ document, cachet }: { document: PdfDocumentData; cachet: string }) {
  const breakdown = new Map<number, number>();
  for (const line of document.line_items) {
    const rate = line.tva_rate ?? document.tva_rate;
    const lineHt = roundMoney(line.qty * line.unit_price);
    const tax = roundMoney((lineHt * rate) / 100);
    breakdown.set(rate, (breakdown.get(rate) ?? 0) + tax);
  }
  return (
    <>
      <View
        style={[
          styles.totalsRow,
          document.type === "facture" ? styles.invoiceTotalsRow : undefined,
        ]}
        wrap={false}
      >
        <View style={styles.words}>
          <Text>{amountInFrenchWords(document.ttc)}</Text>
          {document.type === "facture" && document.has_cachet ? <Image src={cachet} style={styles.invoiceStamp} /> : null}
        </View>
        <View style={styles.totals}>
          <View style={styles.totalLine}><Text style={styles.totalLabel}>Total HT</Text><Text style={styles.totalValue}>{formatAmount(document.ht)}</Text></View>
          {[...breakdown.entries()].sort(([a], [b]) => a - b).map(([rate, amount]) => (
            <View key={rate} style={styles.totalLine}><Text style={styles.totalLabel}>TVA {rate}%</Text><Text style={styles.totalValue}>{formatAmount(amount)}</Text></View>
          ))}
          <View style={[styles.totalLine, { marginTop: 3 }]}><Text style={styles.grandTotalLabel}>Total TTC</Text><Text style={styles.grandTotalValue}>{formatAmount(document.ttc)}</Text></View>
        </View>
      </View>

      {document.type === "devis" ? (
        <View style={styles.conditions} wrap={false}>
          <View style={styles.conditionColumn}>
            <Text style={styles.bold}>Conditions générales de location :</Text>
            <Text style={{ marginTop: 3 }}>Tarifs établis sur la base de 9 heures d&apos;utilisation par jour (08h00 - 18h00) ; durée décomptée en jours ouvrés (lundi au samedi). Dimanches et jours fériés travaillés facturés ; tout jour dû est un jour facturé. Mobilisation et démobilisation à la charge du client sauf mention contraire. Carburant : {document.devis_fuel_driver || "Non renseigné"}. Conducteur : {document.devis_driver || "Non renseigné"}.</Text>
          </View>
          <View style={styles.conditionColumn}>
            <Text style={styles.bold}>Règlement</Text>
            <Text style={{ marginTop: 3 }}>Conditions : {document.devis_payment_conditions || "-"}</Text>
            <Text>BANK : {document.devis_bank_name || "-"}</Text>
            <Text>IBAN : {document.devis_iban || "-"}</Text>
          </View>
        </View>
      ) : null}

      {document.type === "avoir" ? (
        <View style={styles.payment} wrap={false}>
          <Text style={styles.bold}>Mode de règlement de l&apos;avoir</Text>
          <Text style={{ marginTop: 3 }}>[{document.avoir_payment_method === "deduction" ? "x" : " "}] Déduction sur facture à venir     [{document.avoir_payment_method === "virement" ? "x" : " "}] Virement     [{document.avoir_payment_method === "cheque" ? "x" : " "}] Chèque</Text>
          {document.avoir_payment_reference ? <Text>Référence : {document.avoir_payment_reference}</Text> : null}
        </View>
      ) : null}

      {document.type !== "facture" ? (
        <View style={styles.signatures} wrap={false}>
          <View style={styles.signature}>
            <Text>{document.type === "devis" ? "SIGNATURE DU FOURNISSEUR" : document.type === "bon_commande" ? "SIGNATURE DU CLIENT" : "CACHET ET SIGNATURE - OVERSEAS SERVICES"}</Text>
            {document.has_cachet ? <Image src={cachet} style={styles.stamp} /> : null}
          </View>
          <View style={styles.signature}><Text>{document.type === "devis" ? "SIGNATURE DU CLIENT" : document.type === "bon_commande" ? "SIGNATURE DU FOURNISSEUR" : "ACCUSÉ DE RÉCEPTION - CLIENT"}</Text></View>
        </View>
      ) : null}
    </>
  );
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>Adresse : {COMPANY_ADDRESS}</Text>
      <Text style={styles.bold}>IF : 47244543  |  RC : 108893  |  TP : 64260589  |  ICE : 002629109000015  |  CNSS : 2285065</Text>
      <Text>Tél : +212 666 765 794  |  Email : a.sahraoui@overseasservices.ma</Text>
    </View>
  );
}

function DocumentPdf({ document, assets }: { document: PdfDocumentData; assets: PdfAssets }) {
  const pages = paginate(document);
  return (
    <Document title={`${document.type}-${document.number || "Brouillon"}`} author="Overseas Services SARL">
      {pages.map((items, index) => {
        const first = index === 0;
        const last = index === pages.length - 1;
        return (
          <Page key={index} size="A4" style={[styles.page, last ? { paddingBottom: 70 } : undefined]}>
            {first ? <Header document={document} logo={assets.logo} /> : null}
            <Table document={document} first={first} items={items} />
            {last ? <View style={styles.finalPageSpacer} /> : null}
            {last ? <Totals cachet={assets.cachet} document={document} /> : null}
            {last ? <Footer /> : null}
          </Page>
        );
      })}
    </Document>
  );
}

export function renderDocumentPdf(document: PdfDocumentData, assets: PdfAssets) {
  return renderToBuffer(<DocumentPdf assets={assets} document={document} />);
}
