#!/usr/bin/env python3
"""Prepare and reconcile the historical invoice batch without writing to Supabase."""

from __future__ import annotations

import csv
import json
import re
import unicodedata
import warnings
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "FACTURES 2026"
OUTPUT = ROOT / "data" / "import-review"
EXCLUDED = {"INV 20 AGL.pdf"}
ISSUER_ICE = "002629109000015"
OCR_ROWS = {
    "INV 003 COVEC 第三份五金发票.pdf": {
        "date": "2026-01-06", "client_ice": "001596313000044", "ht": 108072.00, "tva": 21614.40, "ttc": 129686.40,
        "lines": [
            ("Disjoncteur différentiel intégré 450/4P", "PIECE", 1, 8300),
            ("Disjoncteur différentiel 2p 40A", "PIECE", 5, 305),
            ("Projecteur de grue 2000 W", "PIECE", 15, 3650),
            ("Module de protection différentiel 250/4P", "PIECE", 3, 1600),
            ("Module de protection différentiel 160/4P", "PIECE", 4, 1600),
            ("Module de protection différentiel 100/4P", "PIECE", 1, 1400),
            ("Chaussure de sécurité N°41", "PAIRES", 4, 180),
            ("Chaussure de sécurité N°42", "PAIRES", 2, 180),
            ("Chaussure de sécurité ARMA TK N°43", "PAIRES", 2, 180),
            ("Chaussure de sécurité N°45", "PAIRES", 1, 180),
            ("Botte plastique", "PAIRE", 17, 87),
            ("Imperméable veste+pantalon", "PIECE", 60, 144),
            ("Pompe submersible turbine à deux canaux", "PIECE", 2, 2950),
            ("Huile hydraulique 20L", "SET", 2, 1176),
            ("Bande de signalisation R/B MAC 70MMX200M", "PIECE", 1, 36),
            ("Fourreau de protection pour pompe SV 5X2.5", "ML", 200, 33),
            ("Botte plastique N°36", "PAIRES", 1, 150),
            ("Parapluie", "PIECE", 20, 96),
            ("Frais de service", "F", 1, 2200),
        ],
    },
    "INV 19 AGL.pdf": {
        "date": "2026-02-23", "client_ice": "001527059000033", "ht": 4000.00, "tva": 800.00, "ttc": 4800.00,
        "lines": [("Démobilisation de Clarck", "PIECES", 1, 2000), ("Cales", "PIECES", 20, 100)],
    },
    "INV 34 AGL.pdf": {
        "date": "2026-04-20", "client_ice": "001527059000033", "ht": 6900.00, "tva": 1380.00, "ttc": 8280.00,
        "lines": [("Stockage à l'entrepôt", "JOURS", 10, 50), ("Calage et transfert marchandise vers site", "CAMION", 1, 6400)],
    },
}
MANUAL_CLIENTS = {
    "INV 23 BIS WWL MOROCCO.pdf": "WORLDWIDE LOGISTICS MOROCCO SHIPPING SERVICE",
    "INV 70 FRACHT MAROC.pdf": "FRACHT MAROC",
    "INV 75 CHINA CONSTRUCTION MDF .pdf": "ZHUO HENG MO LUO GE JIAN ZHU YOU XIAN CO",
}


def money(raw: str | None) -> Decimal | None:
    if not raw:
        return None
    value = re.sub(r"[^0-9.,'\-]", "", raw).replace("'", "")
    if not value or value in {"-", ".", ","}:
        return None
    if "," in value and "." in value:
        value = value.replace(".", "").replace(",", ".") if value.rfind(",") > value.rfind(".") else value.replace(",", "")
    elif "," in value:
        value = value.replace(",", ".")
    elif value.count(".") > 1:
        value = value.replace(".", "")
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


def clean(raw: str | None) -> str:
    return re.sub(r"\s+", " ", raw or "").strip()


def round_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def invoice_number(name: str) -> str:
    match = re.match(r"(?i)INV\s*0*(\d+)(?:\s+(BIS))?", name)
    if not match:
        raise ValueError(f"Cannot derive invoice number: {name}")
    series = "AL" if "INV 003 COVEC" in name else "AI"
    suffix = "/BIS" if match.group(2) else ""
    return f"{int(match.group(1)):03d}/2026/{series}{suffix}"


def invoice_date(text: str) -> str | None:
    patterns = [
        r"(?i)Casablanca\s*,?\s*le\s*:?\s*(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(20\d{2})",
        r"(?i)\bDate\s*:\s*(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(20\d{2})",
        r"(?i)\ble\s*(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(20\d{2})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            try:
                return date(int(match.group(3)), int(match.group(2)), int(match.group(1))).isoformat()
            except ValueError:
                pass
    return None


def ice_from_text(text: str) -> str | None:
    candidates = re.findall(r"(?<!\d)\d{15}(?!\d)", re.sub(r"\s+", "", text))
    return next((ice for ice in candidates if ice != ISSUER_ICE), None)


def line_items(tables: list[list[list[str | None]]]) -> tuple[list[dict], list[str]]:
    items: list[dict] = []
    issues: list[str] = []
    for table in tables:
        if not table or len(table[0]) < 5:
            continue
        width = len(table[0])
        for row in table:
            if width == 7:
                desc, unit, qty_raw, price_raw, total_raw, rate_raw = (clean(row[i]) for i in (1, 3, 4, 5, 6, 0))
                rate_raw = ""
            elif width == 5 and "OVERSEAS LIFTING" in clean(table[0][0]).upper():
                desc, unit, qty_raw, price_raw, rate_raw, total_raw = clean(row[0]), "U", clean(row[1]), clean(row[2]), clean(row[3]), clean(row[4])
            elif width == 5 and any("Quantité" in clean(cell) for cell in table[0]) and "Unité" not in " ".join(clean(cell) for cell in table[0]):
                desc, unit, qty_raw, price_raw, rate_raw, total_raw = clean(row[0]), "U", clean(row[1]), clean(row[2]), clean(row[3]), clean(row[4])
            else:
                desc, unit, qty_raw, price_raw = (clean(row[i]) for i in (0, 1, 2, 3))
                total_raw = clean(row[-1])
                rate_raw = clean(row[4]) if width == 6 else ""
            if not desc or re.match(r"(?i)^(Description|Machines|Machine|Montant|Total|TVA|Prix|PRIX N|Location$)", desc):
                continue
            qty = money(qty_raw)
            price = money(price_raw)
            total = money(total_raw)
            if qty is None and qty_raw.upper() in {"FF", "F", "FORFAIT"}:
                qty = Decimal(1)
            if qty is None or price is None or qty < 0 or price < 0:
                continue
            rate = money(rate_raw.replace("%", "")) if "%" in rate_raw else None
            computed = round_money(qty * price)
            if total is not None and abs(computed - total) > Decimal("0.06"):
                if rate is None or abs(round_money(computed * (Decimal(1) + rate / 100)) - total) > Decimal("0.06"):
                    issues.append(f"line mismatch: {desc[:35]} qty={qty} price={price} printed={total}")
            items.append({"desc": desc, "unit": unit or "U", "qty": float(qty), "unit_price": float(price), **({"tva_rate": float(rate)} if rate is not None else {})})
    return items, issues


def totals_from_tables(tables: list[list[list[str | None]]]) -> tuple[Decimal | None, Decimal | None, Decimal | None]:
    ht = tva = ttc = None
    for table in tables:
        if not table:
            continue
        if len(table[0]) > 3 and len(table[0]) != 7:
            continue
        for row in table:
            if len(table[0]) == 7:
                label, value = clean(row[0]), money(row[-1])
            else:
                label, value = clean(row[0]), money(row[1]) if len(row) > 1 else None
            if value is None:
                continue
            label = unicodedata.normalize("NFKD", label).upper()
            if re.search(r"TTC|A PAYER|À PAYER", label) and not re.search(r"TAXABLE", label):
                ttc = value
            elif re.search(r"TVA", label):
                tva = value
            elif re.search(r"HT|H T", label) and not re.search(r"TAXABLE|NON TAXABLE", label):
                ht = value
            elif label.strip() == "TOTAL":
                ht = value
    return ht, tva, ttc


def text_totals(text: str) -> tuple[Decimal | None, Decimal | None, Decimal | None]:
    ht = tva = ttc = None
    for line in text.splitlines():
        compact = clean(line).upper()
        values = re.findall(r"\d[\d\s'.,]*\d|\d", compact)
        value = money(values[-1]) if values else None
        if value is None:
            continue
        if "TVA" in compact and "%" in compact and len(values) == 1 and value <= Decimal(100):
            continue
        if re.search(r"TOTAL.*TTC|MONTANT.*TTC|A PAYER|À PAYER", compact) and not re.search(r"TAXABLE", compact):
            ttc = value
        elif "TVA" in compact and "20%" in compact or compact.startswith("TVA"):
            tva = value
        elif re.search(r"TOTAL.*HT|MONTANT.*HT", compact) and not re.search(r"TAXABLE", compact):
            ht = value
    return ht, tva, ttc


def documents() -> list[dict]:
    rows: list[dict] = []
    for path in sorted(SOURCE.rglob("*.pdf")):
        if path.parent.name == "AVOIR" or path.name in EXCLUDED:
            continue
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            reader = PdfReader(path)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        try:
            with pdfplumber.open(path) as pdf:
                tables = [table for page in pdf.pages for table in page.extract_tables()]
        except Exception:
            tables = []
        if path.name in OCR_ROWS:
            checked = OCR_ROWS[path.name]
            items = [{"desc": desc, "unit": unit, "qty": qty, "unit_price": price, "tva_rate": 20} for desc, unit, qty, price in checked["lines"]]
            line_ht = round_money(sum((Decimal(str(item["qty"])) * Decimal(str(item["unit_price"])) for item in items), Decimal(0)))
            line_tva = round_money(line_ht * Decimal("0.20"))
            issues = [] if abs(line_ht - Decimal(str(checked["ht"]))) <= Decimal("0.02") and abs(line_tva - Decimal(str(checked["tva"]))) <= Decimal("0.02") else ["OCR line totals do not reconcile"]
            rows.append({"source_file": str(path.relative_to(ROOT)), "number": invoice_number(path.name), "date": checked["date"], "client_ice": checked["client_ice"], "line_items": items, "ht": checked["ht"], "tva": checked["tva"], "ttc": checked["ttc"], "line_ht": float(line_ht), "line_tva": float(line_tva), "issues": issues})
            continue
        items, issues = line_items(tables)
        ht, tva, ttc = totals_from_tables(tables)
        fallback = text_totals(text)
        ht = ht if ht is not None else fallback[0]
        tva = tva if tva is not None else fallback[1]
        ttc = ttc if ttc is not None else fallback[2]
        line_ht = round_money(sum((round_money(Decimal(str(item["qty"])) * Decimal(str(item["unit_price"]))) for item in items), Decimal(0)))
        line_tva = round_money(sum((round_money(round_money(Decimal(str(item["qty"])) * Decimal(str(item["unit_price"]))) * Decimal(str(item.get("tva_rate", 20))) / 100) for item in items), Decimal(0)))
        if tva is None and items:
            tva = line_tva
        if ht is not None and tva is not None and items:
            # Several COVEC PDFs label TTC as "TOTAL HT"; their "TOTAL" row is HT.
            if abs(ht - round_money(line_ht + tva)) <= Decimal("0.10"):
                ttc = ht
                ht = line_ht
            elif abs(ht - tva) <= Decimal("0.10") and line_ht > tva:
                ht = line_ht
        if ht is None and items:
            ht = line_ht
        if tva is None and items:
            tva = line_tva
        if ttc is None and ht is not None and tva is not None:
            ttc = round_money(ht + tva)
        if not items:
            issues.append("no line items extracted")
        if not invoice_date(text):
            issues.append("date not extracted")
        if ht is None or tva is None or ttc is None:
            issues.append("totals incomplete")
        elif abs(round_money(ht + tva) - ttc) > Decimal("0.02"):
            issues.append(f"official totals inconsistent: ht={ht} tva={tva} ttc={ttc}")
        if ht is not None and items and abs(line_ht - ht) > Decimal("0.10"):
            issues.append(f"line HT differs from stated HT: lines={line_ht} stated={ht}")
        if tva is not None and items and abs(line_tva - tva) > Decimal("0.10"):
            issues.append(f"line TVA differs from stated TVA: lines={line_tva} stated={tva}")
        if invoice_date(text) and not invoice_date(text).startswith("2026"):
            issues.append(f"printed date year differs from invoice number: {invoice_date(text)}")
        rows.append({
            "source_file": str(path.relative_to(ROOT)),
            "number": invoice_number(path.name),
            "date": invoice_date(text),
            "client_ice": ice_from_text(text),
            "manual_client_name": MANUAL_CLIENTS.get(path.name),
            "line_items": items,
            "ht": float(ht) if ht is not None else None,
            "tva": float(tva) if tva is not None else None,
            "ttc": float(ttc) if ttc is not None else None,
            "line_ht": float(line_ht),
            "line_tva": float(line_tva),
            "issues": issues,
        })
        if path.name == "INV 43 MINGLAI.pdf":
            rows[-1]["client_ice"] = "003797353000081"
    return rows


def main() -> None:
    rows = documents()
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / "invoice_import_candidates.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    with (OUTPUT / "invoice_import_quality.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(["source_file", "number", "date", "client_ice", "line_count", "ht", "line_ht", "tva", "line_tva", "ttc", "issues"])
        for row in rows:
            writer.writerow([row["source_file"], row["number"], row["date"], row["client_ice"], len(row["line_items"]), row["ht"], row["line_ht"], row["tva"], row["line_tva"], row["ttc"], " | ".join(row["issues"])])
    print(f"candidates: {len(rows)}; clean: {sum(not row['issues'] for row in rows)}; issues: {sum(bool(row['issues']) for row in rows)}")


if __name__ == "__main__":
    main()
