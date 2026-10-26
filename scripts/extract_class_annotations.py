#!/usr/bin/env python3
"""
Extract chrY sequence classes from Rhie et al. (2023) Supplementary Table 21
into a 0-based BED4 file (sequence_classes.bed).

Source:
    Rhie et al. (2023) Nature 621, 344–354
    DOI: 10.1038/s41586-023-06457-y
    File: 41586_2023_6457_MOESM4_ESM.xlsx (Sheet: "ST21 Sequence class annotation")

Usage:
    python extract_class_annotations.py <table_21.xlsx> [output.bed]

Example:
    python extract_class_annotations.py 41586_2023_6457_MOESM4_ESM.xlsx ../src/ycov/annotations/chm13/sequence_classes.bed
"""

import sys
from pathlib import Path
import pandas as pd

def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__.strip())
        sys.exit(1)

    excel_path = Path(sys.argv[1])
    if not excel_path.exists():
        print(f"Error: Excel file not found: {excel_path}", file=sys.stderr)
        sys.exit(1)

    script_dir = Path(__file__).resolve().parent
    default_out = script_dir.parent / "src" / "ycov" / "annotations" / "chm13" / "sequence_classes.bed"
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else default_out
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Reading {excel_path}...")
    df = pd.read_excel(
        excel_path,
        sheet_name="ST21 Sequence class annotation",
        header=1,
        usecols=["chromosome", "start", "end", "class"],
    )

    # Filter to chrY
    df_chry = df[df["chromosome"] == "chrY"].copy()

    # Write BED4 (0-based, tab-separated, no header)
    df_chry.to_csv(out_path, sep="\t", index=False, header=False)
    print(f"Done! Written {len(df_chry)} sequence classes to: {out_path}")

if __name__ == "__main__":
    main()
