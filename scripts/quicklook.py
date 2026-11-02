#!/usr/bin/env python3
"""
Quick-look plot: raw mosdepth depth of one sample along chrY with the
sequence-class bar underneath.

Runs mosdepth on the CRAM (or reuses its output if it already exists),
saves the plot as HTML next to it and opens it in the browser.

Requirements:
    - mosdepth in PATH
    - pandas, plotly

Usage:
    python quicklook.py <reference.fasta> <sample.cram> [--window-size 10000] [--mapq 0]
                        [--outdir DIR]

Example:
    python quicklook.py chm13v2.0.XY.fasta HG00096.subset.cram --mapq 20 --outdir ~/ycov_data/quicklook
"""

import argparse
import subprocess
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

ANNOTATIONS_DIR = Path(__file__).resolve().parents[1] / "src/ycov/annotations/chm13"

# Okabe-Ito colour-blind safe palette, related classes share a colour
CLASS_COLORS = {
    "PAR1": "#E69F00",
    "PAR2": "#E69F00",
    "X-DEG": "#009E73",
    "XTR1": "#56B4E9",
    "XTR2": "#56B4E9",
    "AMPL": "#0072B2",
    "SAT": "#F0E442",
    "CEN": "#D55E00",
    "DYZ17": "#CC79A7",
    "DYZ19": "#CC79A7",
    "HET": "#666666",
    "OTHER": "#BBBBBB",
}


def read_bed(path: Path) -> pd.DataFrame:
    """Read a 4-column chrY BED (plain or .gz) and add positions in Mb."""
    df = pd.read_csv(path, sep="\t", names=["chrom", "start", "end", "value"])
    df = df[df["chrom"] == "chrY"].copy()
    df["start_mb"] = df["start"] / 1e6
    df["end_mb"] = df["end"] / 1e6
    return df


def run_mosdepth(
    fasta: Path, cram: Path, prefix: Path, window_size: int, mapq: int
) -> bool:
    """Run mosdepth on chrY into <prefix>.regions.bed.gz, or reuse it if it exists; False if mosdepth fails."""
    if Path(f"{prefix}.regions.bed.gz").exists():
        print(f"Reusing existing {prefix}.regions.bed.gz")
        return True
    prefix.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            [
                "mosdepth",
                "--no-per-base",
                "--threads",
                "4",
                "--chrom",
                "chrY",
                "--fasta",
                str(fasta),
                "--by",
                str(window_size),
                "--mapq",
                str(mapq),
                str(prefix),
                str(cram),
            ],
            check=True,
        )
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error occurred while running mosdepth: {e}")
        return False


def draw_plot(
    coverage: pd.DataFrame, classes: pd.DataFrame, gaps: pd.DataFrame, title: str
) -> go.Figure:
    """Depth bars on top, a sequence-class bar below, gaps shaded and the y axis capped at 3x the median."""
    fig = make_subplots(
        rows=2,
        cols=1,
        shared_xaxes=True,
        row_heights=[0.88, 0.12],
        vertical_spacing=0.02,
    )

    # Top: depth per window
    fig.add_trace(
        go.Bar(
            x=coverage["start_mb"],
            y=coverage["value"],
            width=coverage["end_mb"] - coverage["start_mb"],
            offset=0,
            marker_line_width=0,
            name="depth",
            showlegend=False,
        ),
        row=1,
        col=1,
    )

    # Bottom: one horizontal bar per sequence class
    for class_name, group in classes.groupby("value", sort=False):
        fig.add_trace(
            go.Bar(
                y=["class"] * len(group),
                x=group["end_mb"] - group["start_mb"],
                base=group["start_mb"],
                orientation="h",
                name=class_name,
                marker_color=CLASS_COLORS.get(str(class_name)),
                marker_line_width=0,
            ),
            row=2,
            col=1,
        )

    # N-runs in the reference (here the hard-masked PARs) have 0 depth by design
    for gap in gaps.itertuples():
        fig.add_vrect(
            x0=gap.start_mb,
            x1=gap.end_mb,
            fillcolor="grey",
            opacity=0.25,
            line_width=0,
            row=1,
            col=1,
        )

    # Median of covered windows as a reference line; y is capped at 3x it so SAT/AMPL spikes do not flatten the rest
    median = coverage.loc[coverage["value"] > 0, "value"].median()
    fig.add_hline(
        y=median,
        line_dash="dash",
        annotation_text=f"median {median:.1f}x",
        row=1,
        col=1,
    )

    fig.update_layout(title=title, bargap=0, barmode="overlay")
    fig.update_yaxes(title_text="mean depth", range=[0, 3 * median], row=1, col=1)
    fig.update_yaxes(showticklabels=False, row=2, col=1)
    fig.update_xaxes(title_text="chrY position (Mb)", row=2, col=1)
    return fig


def parse_args() -> argparse.Namespace:
    """Parse FASTA, CRAM, --outdir, --window-size and --mapq; the module docstring is the --help text."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("fasta", type=Path)
    parser.add_argument("cram", type=Path)
    parser.add_argument("--outdir", type=Path, default=Path("quicklook_out"))
    parser.add_argument(
        "--window-size",
        type=int,
        default=10000,
        help="1000 is slow to render for whole chrY",
    )
    parser.add_argument("--mapq", type=int, default=0)
    return parser.parse_args()


def main() -> None:
    """Run (or reuse) mosdepth, draw the plot, save it as HTML and open it."""
    args = parse_args()

    # Sample name = CRAM file name up to the first dot
    sample = args.cram.name.split(".")[0]
    prefix = args.outdir / f"{sample}.chrY.w{args.window_size}.q{args.mapq}"
    if not run_mosdepth(args.fasta, args.cram, prefix, args.window_size, args.mapq):
        print("Mosdepth failed, exiting.")
        return

    title = (
        f"{sample} chrY raw depth ({args.window_size} bp windows, MAPQ >= {args.mapq})"
    )
    fig = draw_plot(
        read_bed(Path(f"{prefix}.regions.bed.gz")),
        read_bed(ANNOTATIONS_DIR / "sequence_classes.bed"),
        read_bed(ANNOTATIONS_DIR / "gaps.bed"),
        title,
    )

    fig.write_html(f"{prefix}.html")
    print(f"Coverage plot written to {prefix}.html")
    fig.show()


if __name__ == "__main__":
    main()
