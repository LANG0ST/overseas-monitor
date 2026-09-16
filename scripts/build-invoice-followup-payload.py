#!/usr/bin/env python3
"""Build the five invoice rows approved after the initial historical import."""

import csv
import json
import runpy
from pathlib import Path

base = runpy.run_path(str(Path(__file__).with_name("build-invoice-import-payload.py")))
DIR, PARTNERS = base["DIR"], base["PARTNERS"]


NUMBERS = {"012/2026/AI", "020/2026/AI", "040/2026/AI", "066/2026/AI", "075/2026/AI"}


def main():
    candidates = json.loads((DIR / "invoice_import_candidates.json").read_text(encoding="utf-8"))
    selected = {row["number"]: row for row in candidates if row["number"] in NUMBERS}
    selected["020/2026/AI"] = {
        "number": "020/2026/AI", "date": "2026-02-24", "client_ice": "001527059000033",
        "line_items": [{"desc": "LOCATION MANITO", "unit": "JOUR", "qty": 4, "unit_price": 3000, "tva_rate": 20}],
        "ht": 12000, "tva": 2400, "ttc": 14400,
    }
    if set(selected) != NUMBERS:
        raise ValueError(f"Missing invoice rows: {NUMBERS - set(selected)}")

    mobilisation = next(item for item in selected["040/2026/AI"]["line_items"] if item["desc"] == "MOBILISATION DE CAMION")
    mobilisation["qty"] = 4
    inv66 = selected["066/2026/AI"]
    inv66["ht"], inv66["tva"], inv66["ttc"] = 203318.55, 40663.71, 243982.26

    payload = []
    for number in sorted(selected):
        row = selected[number]
        ice = row["client_ice"]
        partner = PARTNERS.get(ice)
        if partner:
            partner_id, name, address = partner
        else:
            partner_id, name, address = None, row.get("manual_client_name"), None
        if not name:
            raise ValueError(f"Missing client for {number}")
        lines = row["line_items"]
        for line in lines:
            if line["unit"] == "JOURS":
                line["unit"] = "JOUR"
            elif line["unit"] == "HEURES":
                line["unit"] = "HEURE"
        payload.append({
            "type": "facture", "number": number, "date": row["date"],
            "partenaire_id": partner_id or "", "client_name": name,
            "client_ice": ice, "client_address": address or "", "city": "Casablanca",
            "has_cachet": "false", "line_items": json.dumps(lines, ensure_ascii=False, separators=(",", ":")),
            "tva_rate": 20, "ht": row["ht"], "tva": row["tva"], "ttc": row["ttc"],
            "is_active": "true", "is_locked": "true",
        })
    with (DIR / "invoice_import_followup.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(payload[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(payload)
    print("followup: 5")


if __name__ == "__main__":
    main()
