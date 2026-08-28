# WS1: Analysing CellProfiler output with scverse

## Introduction

In this workstream, we will explore how we can best connect the output of typical CellProfiler workflows to the scverse analysis and modeling ecosystem. Since most scverse tools are built around AnnData, we will focus on how to convert CellProfiler output into AnnData objects, and what metadata we can extract from CellProfiler pipelines to enrich our analysis. For this, we will have to evaluate the following aspects:

- WS1A) What are the typical outputs of CellProfiler and which output settings are most useful for downstream analysis? Can we define a narrow set of "optimal" output settings that will allow us to extract the most useful information for downstream analysis? Here we can aim for either just features and metadata (aiming at `AnnData`) or additionally including images and segmentation masks (aiming at `SpatialData`).
- WS1B) How can we convert CellProfiler output into AnnData objects? What are the best practices for this conversion, and what metadata should we include to ensure that the AnnData objects are informative and useful for downstream analysis? This could involve writing some form of "cellprofiler2anndata" package to automate this conversion process.
- WS1C) What scverse tools are most useful for analyzing CellProfiler output? How can we leverage the existing scverse ecosystem to perform meaningful analyses on CellProfiler data, and what new tools or methods might be needed to fully exploit the potential of this data?

## Test dataset

We run CellProfiler ourselves and generate the outputs, so what we need from a public source is raw images plus trustworthy plate metadata — small enough to download in a coffee break, real enough that the plate/well/site structure is genuine rather than a subsample.

### Option A — BBBC021, one 96-well plate (839 MB, no cloud tooling)

```bash
curl -O https://data.broadinstitute.org/bbbc/BBBC021/BBBC021_v1_images_Week1_22123.zip  # 839 MB
curl -O https://data.broadinstitute.org/bbbc/BBBC021/BBBC021_v1_image.csv               # 4.0 MB, per-image metadata
curl -O https://data.broadinstitute.org/bbbc/BBBC021/BBBC021_v1_moa.csv                 # 4.4 kB, MOA ground truth
```

| | |
|---|---|
| Plate format | 96-well, wells `B02`–`G11` — the 60 interior wells; outer ring not imaged (edge effects) |
| Fields | 4 sites/well → 240 fields, 720 TIFFs, 16-bit |
| Channels | 3 — DAPI, Tubulin, Actin |
| Perturbations | 7 compounds incl. DMSO, 49 compound–dose combinations on this plate |
| Phenotypes | taxol (14 wells), aphidicolin, cytochalasin B, nocodazole (8 wells each) |
| Labels | 5 MOAs / 14 of 49 treatments on this plate (12 MOAs + DMSO over 103 treatments dataset-wide) |

Metadata columns in `BBBC021_v1_image.csv` are already CellProfiler-native — `ImageNumber`, `TableNumber`, `Image_FileName_<Channel>`, `Image_PathName_<Channel>`, `Image_Metadata_Plate_DAPI`, `Image_Metadata_Well_DAPI`, `Replicate`, `Image_Metadata_Compound`, `Image_Metadata_Concentration` — so it converts almost directly into a `LoadData` CSV, and into `.obs` afterwards.

⚠️ Three channels, not five. BBBC021 predates the Cell Painting assay (Caie et al. 2010), so a stock 5-channel Cell Painting pipeline will not run on it unmodified. Fine if we only care about the output→`AnnData` question; wrong if we want the run itself to look like Cell Painting.
Images © AstraZeneca; cite Caie et al. (2010) and Ljosa et al. (2012).

Picking a plate: MOA labels are sparse and uneven — only 104 of 906 compound–dose combos carry one, and the median plate has 3 MOAs over 6 labelled treatments. `Week1_22123` is above median at 5/14. `Week3_25421`, `Week3_25441` and `Week3_25461` are the richest at 6 MOAs / 22 of 50 treatments.

### Option B — real 5-channel Cell Painting, one well at a time

If the run should look like actual Cell Painting, pull a well-slice out of the [Cell Painting Gallery](https://broadinstitute.github.io/cellpainting-gallery/) instead. Public, free,
no credentials — always `--no-sign-request` (`brew install awscli`).

```bash
# one well, 5 fluorescent channels, 9 fields ≈ 110 MB
aws s3 cp --no-sign-request --recursive \
  s3://cellpainting-gallery/cpg0036-EU-OS-bioactives/FMP/images/2023_02_15_Batch1_U2OS/images/U2OSB1001R1__2023-02-15T15_21_49-Measurement_1/Images/ \
  ./raw/ --exclude "*" --include "r01c01*-ch[1-5]*"
```

Raw filenames are `r<row>c<col>f<field>p<plane>-ch<channel>sk1fk1fl1.tiff`, so subsetting by well/field/channel is a glob. Do not sync a whole plate: measured, a `cpg0036` plate is 26 GB (13,824 TIFFs) and a `cpg0016`/`cpg0000` plate is 67 GB (27,648 TIFFs). 24 wells × 1 field ×
5 channels ≈ 290 MB; the same 24 wells at all 9 fields ≈ 2.6 GB.

`cpg0036` is EU-OPENSCREEN bioactives (2,464 compounds, U2OS + HepG2) contributed by FMP — both co-organisers of this hackathon.

### Pipelines to run

Neither source ships a pipeline we can use as-is. Starting points:

- `cpg0000-jump-pilot/source_4/workspace/pipelines/` — the JUMP pilot pipeline definitions
- [`carpenter-singh-lab/2023_Cimini_NatureProtocols`](https://github.com/carpenter-singh-lab/2023_Cimini_NatureProtocols) — the current Cell Painting protocol
- Adapting a 5-channel pipeline down to BBBC021's 3 channels is a real (small) task — worth deciding early which way we go.

## Reference: what the output is *supposed* to look like

We generate our own output, but the Cell Painting Gallery publishes the full canonical chain, and it is the de-facto standard — the gallery requires contributed datasets to use it (`analysis`, `backend`, `load_data_csv`, `metadata`, `profiles` under `workspace/`, produced per the Image-based Profiling Handbook). Worth reading before we design a spec. Measured for `cpg0016-jump/source_4`, batch `2021_04_26_Batch1`, plate `BR00117035` (384-well, 9 sites):

| Level | Path under `.../workspace/` | Size |
|---|---|---|
| Pipeline input | `load_data_csv/<batch>/<plate>/load_data_with_illum.csv` | 8.5 MB |
| Per-object CSVs | `analysis/<batch>/<plate>/analysis/<plate>-<well>-<site>/` → `Cells.csv` 2.5 MB, `Cytoplasm.csv` 2.4 MB, `Nuclei.csv` 2.4 MB, `Image.csv` 0.11 MB, `Experiment.csv` 0.36 MB + outline PNGs | ~7.8 MB / well-site |
| Merged single-cell | `backend/<batch>/<plate>/<plate>.sqlite` | 16.4 GB |
| Aggregated wells | `backend/<batch>/<plate>/<plate>.csv` | 55.8 MB |
| Normalised profiles | `profiles/<batch>/<plate>/<plate>.parquet` | 13.2 MB |

Note that this is one of three shapes in the wild, and a spec is only useful if it spans them:

1. Naive local run — `ExportToSpreadsheet` writes `<prefix>_Cells.csv` / `_Nuclei.csv` / `_Image.csv`
   pooled over the whole run; `ExportToDatabase` writes one SQLite with `Per_Image` / `Per_Object`.
   No hierarchy on disk; plate identity only inside `Image_Metadata_*` columns, if configured.
2. CPG / Broad standard — the table above. Hierarchy lives in directory names, not in the files.
3. Downstream — aggregated `backend/*.csv`, pycytominer `profiles/*.parquet`.

The invariant across all three is the object tables plus a plate/well/site key — except that key moves between the filesystem and the columns depending on who ran it. Pinning that down is arguably the real WS1A question.

## Getting Started
- To get started with this workstream, we will need to get an overview of the typical outputs of CellProfiler and the settings that are most useful for downstream analysis. For this, we can [download small example datasets from the CellProfiler website](https://cellprofiler.org/examples) and explore what options we can export the results with. 
- Once we have gained some perspective on this, we should formalize this into a spec each for AnnData and SpatialData and then build against that in future steps.

## Relevant Resources
- [CellProfiler](https://cellprofiler.org/)
- [AnnData](https://anndata.readthedocs.io/en/latest/)
- [scanpy](https://scanpy.readthedocs.io/en/stable/)
- [spatialdata-io](https://spatialdata.readthedocs.io/en/latest/)
