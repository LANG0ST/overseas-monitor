import { getAccessContext } from "@/lib/auth/can-edit";
import { buildInvoiceReportXlsx, type InvoiceReportRow } from "@/lib/export/invoice-report-xlsx";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const access = await getAccessContext();
  if (!access.userId) return new Response("Authentification requise.", { status: 401 });
  if (!access.allowedResources.includes("factures")) {
    return new Response("Accès refusé.", { status: 403 });
  }

  const supabase = await createClient();
  const invoices: InvoiceReportRow[] = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("documents")
      .select("number, date, client_name, client_ice, line_items, tva_rate, ht, tva, ttc, paid, paid_date")
      .eq("type", "facture")
      .eq("is_active", true)
      .not("number", "is", null)
      .order("date", { ascending: true })
      .order("number", { ascending: true })
      .range(start, start + pageSize - 1);
    if (error) return new Response("Impossible de charger les factures.", { status: 500 });
    invoices.push(...((data ?? []) as InvoiceReportRow[]));
    if ((data?.length ?? 0) < pageSize) break;
  }

  const workbook = await buildInvoiceReportXlsx(invoices);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(Uint8Array.from(workbook), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="Rapport_factures_${date}.xlsx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
