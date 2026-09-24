#!/usr/bin/env python3
"""Convert the official CUHK HK2020 standard table into browser data.

Usage:
  python3 scripts/extract_hk2020_height.py /path/to/HK-2020-StandardTables_v2.xlsx
"""
import json
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError as exc:
    raise SystemExit("Install or provide openpyxl in the data-preparation environment") from exc

if len(sys.argv) != 2:
    raise SystemExit("Pass the path to HK-2020-StandardTables_v2.xlsx")

source = Path(sys.argv[1])
workbook = openpyxl.load_workbook(source, data_only=True, read_only=True)
sheet = workbook["Height"]
centile_keys = ["p0_4", "p2", "p9", "p25", "p50", "p75", "p91", "p98", "p99_6"]

def read_side(start):
    rows = []
    for values in sheet.iter_rows(min_row=3, values_only=True):
        if values[0] is None:
            continue
        rows.append({
            "ageMonths": float(values[0]),
            "L": float(values[start + 2]),
            "M": float(values[start]),
            "S": float(values[start + 1]),
            "centiles": {key: float(values[start + 3 + index]) for index, key in enumerate(centile_keys)},
        })
    return rows

payload = {
    "source": "CUHK Hong Kong Growth Study HK2020 Standard Tables v2",
    "sourceUrl": "https://www.cuhk.edu.hk/proj/hkgrowth/data_tables.html",
    "sheet": "Height",
    "centiles": centile_keys,
    "F": read_side(2),
    "M": read_side(14),
}
output = Path(__file__).resolve().parents[1] / "data" / "hk2020-height.js"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text("// Generated from the official CUHK HK2020 Standard Tables v2.\nexport const HK2020_HEIGHT = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"Wrote {output}")
