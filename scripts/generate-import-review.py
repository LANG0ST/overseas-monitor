#!/usr/bin/env python3
"""Generate review-first client, machine, and invoice exception CSVs.

This script is deliberately read-only with respect to Supabase. It extracts the
native text already present in FACTURES 2026 and writes review artifacts only.
"""

from __future__ import annotations

import csv
import io
import re
import sys
import unicodedata
import warnings
from collections import defaultdict
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "FACTURES 2026"
OUTPUT_DIR = ROOT / "data" / "import-review"
ISSUER_ICE = "002629109000015"


CLIENTS = [
    {
        "status": "approve",
        "canonical_name": "AFRICA GLOBAL LOGISTICS & SHIPPING MAROC",
        "ice": "001527059000033",
        "address": "43 BD KHALID IBNOU LOUALID, AIN SEBAA, CASABLANCA",
        "aliases": "AGL | AFRICA GLOBAL LOGISTICS & SHIPPING | AFRICA GLOBAL LOGISTICS & SHIPPING MAROC",
        "confidence": "high",
        "notes": "Address appears explicitly on multiple invoices.",
        "filename_hints": ["AGL"],
    },
    {
        "status": "approve",
        "canonical_name": "CHINA OVERSEAS ENGINEERING CORPORATION",
        "ice": "001596313000044",
        "address": "INARA, ROUTE 28 N°25, CALIFORNIE, 20150 CASABLANCA",
        "aliases": "COVEC | CHINA OVERSEAS ENGINEERING CORPORATION | CHINA OVERSEAS ENGINEERING CORPORATION SUCC",
        "confidence": "high",
        "notes": "Use ICE to merge COVEC and long-name variants.",
        "filename_hints": ["COVEC"],
    },
    {
        "status": "approve",
        "canonical_name": "MINGDIAN INTERNATIONAL",
        "ice": "003389053000034",
        "address": "",
        "aliases": "MINGDIAN | MINGDIAN COBCO | MINGDIAN TANGER | MINGDIANG INTERNATIONAL | MINGDIAN TNTERNATIONAL",
        "confidence": "high",
        "notes": "COBCO and Tanger appear to be project/site labels; ICE is consistent.",
        "filename_hints": ["MINGDIAN"],
    },
    {
        "status": "approve",
        "canonical_name": "GOTION POWER MOROCCO",
        "ice": "003520699000060",
        "address": "",
        "aliases": "GOTION | GOTION POWER MOROCCO",
        "confidence": "high",
        "notes": "",
        "filename_hints": ["GOTION"],
    },
    {
        "status": "approve",
        "canonical_name": "ZHONGLI CONSTRUCTION",
        "ice": "003069395000031",
        "address": "",
        "aliases": "ZHONGLI | ZHONGLI CONSTRUCTION",
        "confidence": "high",
        "notes": "",
        "filename_hints": ["ZHONGLI"],
    },
    {
        "status": "approve",
        "canonical_name": "CHINA CONSTRUCTION YANGTZE MAROC",
        "ice": "002086799000041",
        "address": "",
        "aliases": "CHINA CONSTRUCTION | CHINA CONSTRUCTION OCP | CHINA CONSTRUCTION YANGTZE MAROC",
        "confidence": "high",
        "notes": "OCP appears to be a project label.",
        "filename_hints": ["CHINA CONSTRUCTION"],
    },
    {
        "status": "approve",
        "canonical_name": "ALMADEN MOROCCO",
        "ice": "001921213000036",
        "address": "",
        "aliases": "ALMADEN | ALMADEN MOROCCO",
        "confidence": "high",
        "notes": "",
        "filename_hints": ["ALMADEN"],
    },
    {
        "status": "approve",
        "canonical_name": "PLANET COM TRANS",
        "ice": "001868774000077",
        "address": "",
        "aliases": "PLANET COM TRANS",
        "confidence": "high",
        "notes": "",
        "filename_hints": ["PLANET COM TRANS"],
    },
    {
        "status": "approve",
        "canonical_name": "OVERSEAS LIFTING",
        "ice": "003654969000048",
        "address": "",
        "aliases": "OVERSEAS LIFTING",
        "confidence": "high",
        "notes": "Client name resembles the issuer; ICE is different and confirms a separate entity.",
        "filename_hints": ["OVERSEAS LIFTING"],
    },
    {
        "status": "approve",
        "canonical_name": "TG NORTH AFRICA SARL",
        "ice": "003844653000083",
        "address": "",
        "aliases": "TG NORTH AFRICA | TG NORTH AFRICA SARL",
        "confidence": "high",
        "notes": "",
        "filename_hints": ["TG NORTH AFRICA"],
    },
    {
        "status": "approve",
        "canonical_name": "CROMAT MATERIAUX",
        "ice": "003884477000080",
        "address": "GROUPE ATTAKADDOUM GH2-17, 2EME ETG, SIDI BERNOUSSI",
        "aliases": "CROMAT | CROMAT MATERIAUX",
        "confidence": "high",
        "notes": "Address appears explicitly on invoice 046.",
        "filename_hints": ["CROMAT"],
    },
    {
        "status": "approve",
        "canonical_name": "ZHONGCHENG INTERNATIONAL SARL",
        "ice": "003775962000003",
        "address": "",
        "aliases": "ZHONGCHENG | ZHONGCHENG INTERNATIONAL SARL",
        "confidence": "high",
        "notes": "",
        "filename_hints": ["ZHONGCHENG"],
    },
    {
        "status": "review",
        "canonical_name": "MINGLAI",
        "ice": "00379735000081",
        "address": "",
        "aliases": "MINGLAI",
        "confidence": "medium",
        "notes": "The printed ICE has 14 digits; verify whether a zero is missing before import.",
        "filename_hints": ["MINGLAI"],
    },
    {
        "status": "review",
        "canonical_name": "WORLDWIDE LOGISTICS MOROCCO SHIPPING SERVICE",
        "ice": "",
        "address": "",
        "aliases": "WWL MOROCCO | WORLDWIDE LOGISTICS MOROCCO SHIPPING SERVICE",
        "confidence": "medium",
        "notes": "No client ICE was found on invoice 23 BIS; verify before import.",
        "filename_hints": ["WWL MOROCCO"],
    },
]


MACHINES = [
    ("approve", "CHARIOT ELEVATEUR 3T", "Jour", "962; 23076/mois; 24000/mois", [r"CHARIOT\s+E+LEVATEUR\s+3\s*T"], "Forklift; day and month rates both occur."),
    ("approve", "CHARIOT ELEVATEUR 5T", "Jour", "1076.92; 1077; 28000/mois", [r"CHARIOT\s+E+LEVATEUR\s+5\s*T"], "Forklift; hourly lines also occur."),
    ("approve", "CHARIOT ELEVATEUR 16T", "Jour", "2115.38; 2115.40; 55000/mois", [r"CHARIOT\s+E+LEVATEUR\s+16\s*T"], "Forklift; hourly lines also occur."),
    ("approve", "CHARIOT ELEVATEUR TELESCOPIQUE", "Jour", "1200; 1300; 1500", [r"CHARIOT\s+(?:E+LEVATEUR\s+)?TELESCOPIQUE", r"TELEHANDLER"], "Capacity/height varies by invoice; consider model fields later."),
    ("approve", "TRANSPALETTE ELECTRIQUE", "Jour", "350", [r"TRANSPALETTE\s+ELECTRIQUE"], ""),
    ("approve", "NACELLE CISEAUX 8M", "Mois", "15000; 15500", [r"NACELLE\s+CISEAUX\s+8\s*M"], "Multiple units may be represented by the invoice quantity."),
    ("approve", "NACELLE ELECTRIQUE 16M", "Jour", "850", [r"NACELLE\s+(?:ELECTRIQUE\s+)?16\s*M", r"NACELE\s+ELECTRIQUE\s+16\s*M"], ""),
    ("approve", "NACELLE DIESEL 18M", "Jour", "850", [r"NACELLE\s+(?:DIESEL\s+)?18\s*M"], ""),
    ("approve", "GRUE MOBILE 35T", "Jour", "2307", [r"GRUE\s+MOBILE\s+35\s*(?:T|TN)"], ""),
    ("approve", "GRUE MOBILE 40T", "Jour", "2615", [r"GRUE\s+MOBILE\s+40\s*(?:T|TN)"], ""),
    ("approve", "GRUE MOBILE 75T", "Mois", "145000", [r"GRUE\s+MOBILE\s+75\s*(?:T|TN)"], ""),
    ("approve", "GRUE MOBILE 100T", "Jour", "4615; 5000", [r"GRUE\s+(?:MOBILE\s+)?100\s*(?:T|TN)"], ""),
    ("approve", "GRUE MOBILE 130T", "Jour", "13000; 19000", [r"GRUE\s+(?:MOBILE\s+)?130\s*(?:T|TN)"], "Large client-specific price variation; leave default price at zero."),
    ("approve", "GRUE MOBILE 160T", "Jour", "21000", [r"GRUE\s+(?:MOBILE\s+)?160\s*(?:T|TN)"], ""),
    ("approve", "PELLE SUR CHENILLES CAT 320C", "Jour", "2000", [r"PELLE\s+SUR\s+CHENILLES?\s+(?:CAT\s+)?320\s*C"], "Hourly billing also occurs."),
    ("approve", "PELLE SUR CHENILLES VOLVO", "Jour", "2000", [r"PELLE\s+SUR\s+CHENILLES?\s+VOLVO"], "Hourly billing also occurs."),
    ("review", "EXCAVATEUR SUR PNEUS CAT 318", "Jour", "1615", [r"EXCAVATEUR\s+SUR\s+PNEU\S*\s+CAT\s+318"], "Invoices sometimes append asset/site identifiers."),
    ("review", "EXCAVATEUR SUR PNEUS FIAT HITACHI", "Jour", "1615", [r"EXCAVATEUR\s+SUR\s+PNEU\S*\s+FIAT\s+HITACHI"], "Invoices sometimes append asset/site identifiers."),
    ("review", "EXCAVATEUR SUR CHENILLES CAT 322", "Jour", "2076; 2300", [r"EXCAVATEUR\s+SUR\s+CHENILLE\S*\s+(?:CAT\s+)?322"], "Several apparent asset identifiers occur; decide whether to keep separate assets."),
    ("review", "EXCAVATEUR SUR CHENILLES CAT 325", "Jour", "2076", [r"EXCAVATEUR\s+SUR\s+CHENILLE\S*\s+(?:CAT\s+)?325"], ""),
    ("approve", "CHARGEUSE 950H", "Jour", "2300", [r"CHARGEUSE\s+950\s*H"], "Hourly billing also occurs."),
    ("approve", "TRACTOPELLE", "Jour", "1000", [r"TRACTOPELLE"], "Some invoices distinguish TRACTOPELLE 1 and 2."),
    ("review", "JCB AVEC MARTEAU", "Jour", "1538", [r"JCB\s+AVEC\s+MA(?:R|T)TE?AU"], "Spelling varies in source documents."),
    ("review", "JCB AVEC GODET", "Jour", "1300", [r"JCB\s+AVEC\s+GOD(?:E|G)ET"], "Spelling varies in source documents."),
    ("approve", "CAMION 8X4", "Jour", "1600; 1700", [r"CAMION\s+8\s*[X*]\s*4"], ""),
    ("approve", "CAMION CITERNE D'EAU", "Jour", "800", [r"CAMION\s+CITERNE(?:\s+D.?EAU)?"], ""),
    ("approve", "CAMION GRUE", "Jour", "1923", [r"CAMION\s+GRUE"], ""),
    ("approve", "CAMION PLATEAU", "Jour", "1500", [r"CAMION\s+PLATEAU"], ""),
    ("approve", "COMPACTEUR", "Jour", "1400", [r"COMPACTEUR"], ""),
    ("review", "PORTCHAR 100T", "Fois", "60000", [r"PORTCHAR\s+100\s*(?:T|TN)"], "Verify the machine designation and intended unit."),
    ("exclude", "MOBILISATION / DEMOBILISATION", "Fois", "", [r"MOBILISATION", r"DEMOBILISATION", r"IMMOBILISATION"], "Service line, not a machine."),
    ("exclude", "TRANSPORTATION / TRIP", "Fois", "", [r"TRANSPORTATION", r"TRANSPORT\b", r"MAIN\s+SHAFT"], "Transport service, not a machine."),
    ("exclude", "CUSTOMS / DEDOUANEMENT", "Fois", "", [r"CUSTOMS", r"DEDOUANEMENT", r"DOUANE"], "Service line, not a machine."),
    ("exclude", "TRUCK DETENTION / STORAGE / HANDLING", "Fois", "", [r"TRUCK\s+DETENTION", r"STORAGE", r"HANDLING"], "Logistics service, not a machine."),
    ("exclude", "MATERIALS / PPE", "Fois", "", [r"CHAUSSURE\S*\s+DE\s+SECURITE", r"DISJONCTEUR", r"MODULE\s+DE\s+PROTECTION"], "Goods/materials, not machines."),
]


def fold(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", value.upper()).strip()


def extract_documents() -> list[dict[str, object]]:
    documents: list[dict[str, object]] = []
    for path in sorted(SOURCE_DIR.rglob("*.pdf")):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                reader = PdfReader(str(path))
                pages = [page.extract_text() or "" for page in reader.pages]
            text = "\n".join(pages)
            documents.append(
                {
                    "path": path,
                    "relative": str(path.relative_to(ROOT)),
                    "name": path.name,
                    "pages": len(pages),
                    "text": text,
                    "folded": fold(text),
                    "text_chars": len(text.strip()),
                    "error": "",
                }
            )
        except Exception as error:  # keep the rest of the batch usable
            documents.append(
                {
                    "path": path,
                    "relative": str(path.relative_to(ROOT)),
                    "name": path.name,
                    "pages": 0,
                    "text": "",
                    "folded": "",
                    "text_chars": 0,
                    "error": str(error),
                }
            )
    return documents


def matching_sources(documents: list[dict[str, object]], ice: str, hints: list[str]) -> list[str]:
    result = []
    for document in documents:
        name = fold(str(document["name"]))
        text = str(document["folded"])
        if (ice and ice in re.sub(r"\s+", "", text)) or any(fold(hint) in name for hint in hints):
            result.append(str(document["relative"]))
    return sorted(set(result))


def build_client_rows(documents: list[dict[str, object]]) -> list[dict[str, object]]:
    rows = []
    for client in CLIENTS:
        sources = matching_sources(documents, client["ice"], client["filename_hints"])
        rows.append(
            {
                "status": client["status"],
                "canonical_name": client["canonical_name"],
                "ice": client["ice"],
                "address": client["address"],
                "aliases": client["aliases"],
                "source_count": len(sources),
                "source_files": " | ".join(sources),
                "confidence": client["confidence"],
                "notes": client["notes"],
            }
        )
    return rows


def build_machine_rows(documents: list[dict[str, object]]) -> list[dict[str, object]]:
    rows = []
    for status, name, unit, prices, patterns, notes in MACHINES:
        sources = []
        aliases = []
        for document in documents:
            text = str(document["folded"])
            matched = False
            for pattern in patterns:
                match = re.search(pattern, text, flags=re.IGNORECASE)
                if match:
                    matched = True
                    aliases.append(re.sub(r"\s+", " ", match.group(0)).strip())
            if matched:
                sources.append(str(document["relative"]))
        if not sources:
            continue
        rows.append(
            {
                "status": status,
                "canonical_name": name,
                "default_unit": unit,
                "default_price": 0,
                "observed_price_examples": prices,
                "aliases": " | ".join(sorted(set(aliases))),
                "source_count": len(set(sources)),
                "source_files": " | ".join(sorted(set(sources))),
                "confidence": "high" if status in {"approve", "exclude"} else "medium",
                "notes": notes,
            }
        )
    return rows


def invoice_number_from_filename(name: str) -> str:
    match = re.search(r"(?i)^INV\s*0*([0-9]+)(?:\s+(BIS))?", name)
    if not match:
        return ""
    suffix = " BIS" if match.group(2) else ""
    return f"{int(match.group(1)):03d}{suffix}/2026/AI"


def build_exception_rows(documents: list[dict[str, object]]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    number_groups: dict[str, list[dict[str, object]]] = defaultdict(list)

    for document in documents:
        number = invoice_number_from_filename(str(document["name"]))
        if number:
            numeric_key = number.split("/", 1)[0].replace(" BIS", "")
            number_groups[numeric_key].append(document)
        if document["error"]:
            rows.append(
                {
                    "source_file": document["relative"],
                    "exception_type": "pdf_parse_error",
                    "detected_value": document["error"],
                    "confidence": "high",
                    "recommended_action": "manual_review",
                    "notes": "The PDF parser could not open this file.",
                }
            )
        elif int(document["text_chars"]) < 80:
            rows.append(
                {
                    "source_file": document["relative"],
                    "exception_type": "image_only_or_no_text",
                    "detected_value": f"{document['text_chars']} extracted characters",
                    "confidence": "high",
                    "recommended_action": "ocr",
                    "notes": "Route only this file to OCR; do not OCR the full folder.",
                }
            )

    for number, group in sorted(number_groups.items()):
        if len(group) < 2:
            continue
        files = " | ".join(str(item["relative"]) for item in group)
        for document in group:
            rows.append(
                {
                    "source_file": document["relative"],
                    "exception_type": "duplicate_or_bis_invoice_number",
                    "detected_value": f"{number}/2026/AI",
                    "confidence": "high",
                    "recommended_action": "manual_review",
                    "notes": f"Same numeric invoice prefix appears in: {files}",
                }
            )

    rows.extend(
        [
            {
                "source_file": "FACTURES 2026/INV 47 AGL.pdf",
                "exception_type": "possible_revised_invoice",
                "detected_value": "047/2026/AI; total 639000",
                "confidence": "high",
                "recommended_action": "compare_versions",
                "notes": "The 'Mai' version includes an additional immobilisation line and a different total.",
            },
            {
                "source_file": "FACTURES 2026/INV 47 AGL Mai.pdf",
                "exception_type": "possible_revised_invoice",
                "detected_value": "047/2026/AI; total 651000",
                "confidence": "high",
                "recommended_action": "compare_versions",
                "notes": "Likely later revision, but requires confirmation before invoice import.",
            },
            {
                "source_file": "FACTURES 2026/INV 43 MINGLAI.pdf",
                "exception_type": "invalid_ice_length",
                "detected_value": "00379735000081",
                "confidence": "high",
                "recommended_action": "verify_client_ice",
                "notes": "Printed client ICE contains 14 digits.",
            },
            {
                "source_file": "FACTURES 2026/INV 23 BIS WWL MOROCCO.pdf",
                "exception_type": "missing_client_ice",
                "detected_value": "WORLDWIDE LOGISTICS MOROCCO SHIPPING SERVICE",
                "confidence": "high",
                "recommended_action": "verify_client_ice",
                "notes": "No client ICE was found in native PDF text.",
            },
            {
                "source_file": "FACTURES 2026/AVOIR/AVOIR SUR FACTURE MINGDIAN.pdf",
                "exception_type": "credit_note",
                "detected_value": "AVOIR",
                "confidence": "high",
                "recommended_action": "separate_import_phase",
                "notes": "Do not treat this file as a standard invoice during a future document import.",
            },
        ]
    )
    return sorted(rows, key=lambda row: (str(row["source_file"]), str(row["exception_type"])))


def csv_text(rows: list[dict[str, object]], fields: list[str]) -> str:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def write_outputs(documents: list[dict[str, object]]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs = [
        (
            "clients_review.csv",
            build_client_rows(documents),
            ["status", "canonical_name", "ice", "address", "aliases", "source_count", "source_files", "confidence", "notes"],
        ),
        (
            "machines_review.csv",
            build_machine_rows(documents),
            ["status", "canonical_name", "default_unit", "default_price", "observed_price_examples", "aliases", "source_count", "source_files", "confidence", "notes"],
        ),
        (
            "invoice_exceptions.csv",
            build_exception_rows(documents),
            ["source_file", "exception_type", "detected_value", "confidence", "recommended_action", "notes"],
        ),
    ]
    for filename, rows, fields in outputs:
        (OUTPUT_DIR / filename).write_text(csv_text(rows, fields), encoding="utf-8-sig", newline="")
        print(f"{filename}: {len(rows)} rows")
    print(f"documents: {len(documents)}")
    print(f"pages: {sum(int(document['pages']) for document in documents)}")
    print(f"native_text_documents: {sum(int(document['text_chars']) >= 80 for document in documents)}")


def main() -> int:
    if not SOURCE_DIR.is_dir():
        print(f"Source directory not found: {SOURCE_DIR}", file=sys.stderr)
        return 1
    documents = extract_documents()
    write_outputs(documents)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
