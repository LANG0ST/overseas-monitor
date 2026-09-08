import puppeteer from "puppeteer";
import type { NextRequest } from "next/server";
import { safePrintName } from "@/lib/print-title";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const DOCUMENT_KINDS = {
  facture: { path: "factures", type: "facture", label: "Facture" },
  devis: { path: "devis", type: "devis", label: "Devis" },
  avoir: { path: "avoirs", type: "avoir", label: "Avoir" },
  "bon-commande": {
    path: "bons-commande",
    type: "bon_commande",
    label: "Bon-de-commande",
  },
} as const;

type DocumentKind = keyof typeof DOCUMENT_KINDS;

function isDocumentKind(value: string): value is DocumentKind {
  return value in DOCUMENT_KINDS;
}

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/documents/[kind]/[id]/pdf">,
) {
  const { kind, id } = await context.params;
  if (!isDocumentKind(kind)) {
    return new Response("Type de document inconnu.", { status: 404 });
  }

  const definition = DOCUMENT_KINDS[kind];
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return new Response("Authentification requise.", { status: 401 });
  }

  const { data: document, error } = await supabase
    .from("documents")
    .select("id, type, number, client_name")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return new Response("Impossible de charger le document.", { status: 500 });
  }
  if (!document || document.type !== definition.type) {
    return new Response("Document introuvable.", { status: 404 });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    const documentUrl = new URL(`/${definition.path}/${id}`, request.nextUrl.origin);
    const cookies = request.headers
      .get("cookie")
      ?.split(";")
      .flatMap((entry) => {
        const separator = entry.indexOf("=");
        if (separator < 1) return [];
        return [{
          name: entry.slice(0, separator).trim(),
          value: entry.slice(separator + 1).trim(),
          url: request.nextUrl.origin,
        }];
      });
    if (cookies?.length) await page.setCookie(...cookies);

    await page.goto(documentUrl.toString(), {
      waitUntil: "networkidle2",
      timeout: 45_000,
    });

    await page.waitForSelector(".invoice-pages .invoice-page", {
      timeout: 15_000,
    });
    await page.evaluate(async () => {
      await globalThis.document.fonts.ready;
    });

    // Page splitting is measured client-side. Wait until its count has stopped
    // changing before asking Chromium to print the final A4 layout.
    let previousCount = -1;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const count = await page.$$eval(
        ".invoice-pages .invoice-page",
        (elements) => elements.length,
      );
      if (count === previousCount) break;
      previousCount = count;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
      printBackground: true,
    });

    const identifier = document.number || `Brouillon-${document.client_name}`;
    const filename = `${safePrintName(`${definition.label}-${identifier}`)}.pdf`;

    return new Response(Buffer.from(pdf), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (pdfError) {
    console.error("PDF generation failed", pdfError);
    return new Response("La génération du PDF a échoué.", { status: 500 });
  } finally {
    await browser?.close();
  }
}
