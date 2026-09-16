#!/usr/bin/env python3
"""Build the approved historical invoice CSV from reconciled candidates."""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "data" / "import-review"
HOLD_ARITHMETIC = {"012/2026/AI", "040/2026/AI", "066/2026/AI", "075/2026/AI"}

# Read from the production partenaires table on 15 September 2026.
PARTNERS = {
    "001527059000033": ("c327769f-2f62-4a8b-876c-b3d2ebd79832", "AFRICA GLOBAL LOGISTICS & SHIPPING MAROC", "43 BD KHALID IBNOU LOUALID, AIN SEBAA, CASABLANCA"),
    "001921213000036": ("4762e414-808a-4375-b3a3-d434344333a5", "ALMADEN MOROCCO", None),
    "002086799000041": ("eb1a5074-7013-4480-a4ca-10521642363a", "CHINA CONSTRUCTION YANGTZE MAROC", None),
    "001596313000044": ("b00daf69-db4b-4fe8-8721-9591d7df85bf", "CHINA OVERSEAS ENGINEERING CORPORATION", "INARA, ROUTE 28 N°25, CALIFORNIE, 20150 CASABLANCA"),
    "003884477000080": ("885844e5-ff53-40d4-aa37-822ad3753375", "CROMAT MATERIAUX", "GROUPE ATTAKADDOUM GH2-17, 2EME ETG, SIDI BERNOUSSI"),
    "003520699000060": ("a03d5a5e-f0f0-4363-9f01-c7c55c1f67af", "GOTION POWER MOROCCO", None),
    "003389053000034": ("b0dede0c-950d-42a9-b6bb-d33db55420dd", "MINGDIAN INTERNATIONAL", None),
    "003797353000081": ("161dd454-19c0-4ade-b592-cae59cf3b0e2", "MINGLAI", None),
    "003654969000048": ("19b6ba50-60e9-46c1-9e02-3fe702889d98", "OVERSEAS LIFTING", None),
    "001868774000077": ("dd9ab0ba-23f0-480e-8c7a-c620a4675950", "PLANET COM TRANS", None),
    "003844653000083": ("7aa95b57-b755-4a60-8d08-5f7e821abdaf", "TG NORTH AFRICA SARL", None),
    "003069395000031": ("85aff188-c5db-4c7a-8c05-10c7fb9eda0d", "ZHONGLI CONSTRUCTION", None),
    "003775962000003": ("19fdb495-99be-4cfe-8afa-8ff0826c4832", "ZHONGCHENG INTERNATIONAL SARL", None),
}


def main() -> None:
    rows = json.loads((DIR / "invoice_import_candidates.json").read_text(encoding="utf-8"))
    payload = []
    skipped = []
    for row in rows:
        if row["number"] in HOLD_ARITHMETIC:
            skipped.append(row)
            continue
        ice = row["client_ice"]
        if ice in PARTNERS:
            partner_id, name, address = PARTNERS[ice]
        else:
            partner_id, name, address = None, row.get("manual_client_name"), None
            if not name:
                raise ValueError(f"Missing existing/manual client mapping for {row['number']} {ice}")
        if row["ht"] is None or row["tva"] is None or row["ttc"] is None or not row["date"] or not row["line_items"]:
            raise ValueError(f"Incomplete candidate {row['number']}")
        payload.append({
            "type": "facture", "number": row["number"], "date": row["date"],
            "partenaire_id": partner_id or "", "client_name": name,
            "client_ice": ice or "", "client_address": address or "", "city": "Casablanca",
            "has_cachet": "false", "line_items": json.dumps(row["line_items"], ensure_ascii=False, separators=(",", ":")),
            "tva_rate": 20, "ht": row["ht"], "tva": row["tva"], "ttc": row["ttc"],
            "is_active": "true", "is_locked": "true",
        })
    if len(payload) != 74 or len(skipped) != 4:
        raise ValueError(f"Unexpected batch count: ready={len(payload)} held={len(skipped)}")
    fields = list(payload[0])
    with (DIR / "invoice_import_ready.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(payload)
    print(f"ready: {len(payload)}; held arithmetic: {len(skipped)}")


if __name__ == "__main__":
    main()
