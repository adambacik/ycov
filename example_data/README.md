# Example data

Small coverage files for trying ycov without downloading any data. They are
also used in the tutorial. All files are on T2T-CHM13v2.0 and are
[mosdepth](https://github.com/brentp/mosdepth) `--by 1000` output: one line per
1 kb window with `chrom  start  end  mean_depth`, bgzip-compressed and indexed
(`.csi`).

Each sample has two files:

| File | Content |
|---|---|
| `<sample>.regions.bed.gz` | depth of all reads |
| `<sample>.q20.regions.bed.gz` | depth of reads with MAPQ >= 20 |

The files are slices of the full data. Each one contains:

- chrY, the whole chromosome (0-62 460 029)
- chr19, chr20, chr21, chr22: 1 Mb each, for the autosomal baseline
  (chr19:35-36 Mb, chr20:40-41 Mb, chr21:30-31 Mb, chr22:30-31 Mb)
- chrX: 10-15 Mb (outside the PARs)

## Folders

### simulated/

Synthetic coverage with a known answer, made by `scripts/simulate.py`.
Autosomes are at 30x, apart from S06. Depth per sequence class, the MAPQ >= 20
fraction and the noise were measured on the 8 male samples in `real/`
(`scripts/measure_class_effects.py`).

| Sample | Scenario | What was simulated |
|---|---|---|
| S01 | normal_male | XY, 1 copy of chrY |
| S02 | azfc_del | AZFc deleted |
| S03 | mloy_50 | mosaic loss of Y in 50 % of cells (chrY at 0.5 copies) |
| S04 | female | XX, no chrY coverage |
| S05 | xyy | 2 copies of chrY |
| S06 | shallow_5x | normal male sequenced at 5x |
| S07 | azfa_del | AZFa deleted |
| S08 | azfb_del | AZFb deleted (this also removes most of AZFc, which overlaps it) |
| S09, S10 | normal_male_2/3 | more normal males, to make a cohort |
| S11 | partial_azfc | the part of AZFc outside AZFb (chrY:26 490 936-27 020 249) at 0.5 copies |

- `truth.tsv`: what was simulated, with one row per event. Columns:
  - `expected_rel_copy`: the expected relative copy (1 = one copy, 0 = absent,
    0.5 = half the cells).
  - `region` and `start`/`end`: the affected interval.
  - `overlaps`: other regions the event overlaps.
  - Samples with a regional event also have a `chrY` row for the rest of the
    chromosome.
  - `.` means no value.
- `metadata.tsv`: reported sex, population, age and phenotype, in the
  format of ycov's metadata file. The populations and ages are made up.

### simulated_reads/

Read-level simulation from one real sample (HG00096), made by
`scripts/simulate_reads.sh`. The reads were edited in the CRAM and mosdepth was
run again on the result. This makes the coverage more realistic than in
`simulated/`.

| Sample | What was done |
|---|---|
| HG00096 | original, unchanged |
| HG00096_azfc_del | all reads overlapping AZFc removed |
| HG00096_mloy50 | chrY reads subsampled to 50 % (mosaic loss of Y) |

`truth.tsv` has the same columns as in `simulated/`. For the mLOY sample,
`expected_rel_copy` is the measured fraction of chrY reads that were kept.

### real/

Ten 1000 Genomes high-coverage samples (GBR, 2 x 150 bp), aligned to
T2T-CHM13v2.0. The males were aligned to the XY reference, where the chrY PARs
are masked, so chrY PAR coverage is 0. The females were aligned to the XX
reference, where the whole of chrY is masked.

| Sample | Sex | Depth |
|---|---|---|
| HG00096 | XY | 33.3x |
| HG00101 | XY | 33.3x |
| HG00103 | XY | 32.0x |
| HG00105 | XY | 28.9x |
| HG00107 | XY | 32.4x |
| HG00108 | XY | 32.1x |
| HG00109 | XY | 35.2x |
| HG00112 | XY | 32.1x |
| HG00097 | XX | 33.1x |
| HG00099 | XX | 37.6x |

mosdepth was run on a subset CRAM of each sample (chrX, chrY and chr19-22)
with this command (`-f chm13v2.0.XX.fasta` for the two females):

```bash
mosdepth -n -t 4 --by 1000 -f chm13v2.0.XY.fasta <sample> <sample>.subset.cram
mosdepth -n -t 4 --by 1000 --mapq 20 -f chm13v2.0.XY.fasta <sample>.q20 <sample>.subset.cram
```

## How the folder was made

```bash
bash scripts/make_test_data.sh \
    chm13v2.0.XY.fasta HG00096.subset.cram <work_folder> <real_mosdepth_folder>
```

The script uses seed 42 (`SEED`). It writes this folder and `tests/data/`. The
data in `tests/data/` is the same, but `tests/data/metadata.tsv` contains
deliberate errors for the tests.
