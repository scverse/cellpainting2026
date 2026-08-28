# WS1: Analysing CellProfiler output with scverse

**Lead:** [@timtreis](https://github.com/timtreis)

## Introduction

CellProfiler is where most Cell Painting data starts, and scverse is where we would like it to end
up. Between the two sits a conversion step that everyone reimplements and nobody has specified. This
workstream closes that gap: deciding **what CellProfiler should export in the first place**, agreeing
**what the resulting object looks like**, building the readers, and asking whether the round-trip
through CSV files is necessary at all.

### WS1A) How should we export from CellProfiler?
CellProfiler ships exactly two export modules — `ExportToSpreadsheet` and `ExportToDatabase` — and
between them they emit wildly different things depending on configuration. Which settings actually
carry downstream value? Can we define a narrow, recommended set that preserves what analysis needs
and drops what it doesn't?

**We run CellProfiler ourselves.** Everyone installs it and exports the same test plate under
different configurations, then compares what comes out. That is the fastest way to make the question
concrete, and it means the plugin work later has a live CellProfiler to test against.
⚠️ Budget Wednesday morning for installation — this is the single biggest schedule risk in WS1.

### WS1B) The object spec and `cp2adata`
The following are **decided**; the open questions are marked.

- **One row per cell.** The compartments (`Cells`, `Cytoplasm`, `Nuclei`, …) are *not* separate
  objects — they belong to the same cell and should be analysed jointly, so their features sit side
  by side as columns of one observation.
- **The compartment lives in the feature name**, and is parsed out into structured `.var` columns
  alongside object / family / measurement / channel / parameter. `var_names` stay verbatim as the
  index so a mis-parse is visible rather than destructive.
- **The primary object is configurable.** Default is to join at the cell; a user can also read only
  `Nuclei`, only `Cells`, and so on.
- **Global object ID: `plate_well_site_objectnumber`.** Deterministic, readable, and survives
  concatenating plates — unlike `ImageNumber`, which is only unique within a run.
- **Single-cell rows are the primary output.** Aggregation is explicitly *not* cp2adata's job; it
  belongs to pycytominer or [WS6](../ws6_perturbation_tooling/).
- **Two input shapes by Friday:** naive pooled `ExportToSpreadsheet` CSVs (what most labs have) and
  the Cell Painting Gallery per-site directory layout. SQLite from `ExportToDatabase` and
  already-aggregated parquet are explicitly **out of scope** for now.
- **Home:** a new repo under the **scverse org**, `scverse/cp2adata`.

🔴 **Open question — the 1:N problem, and the first thing to settle on Wednesday.**
`RelateObjects` lets a cell have two nuclei, or none. **We keep all of it** — a second nucleus still
belongs to that cell, so nothing is dropped or silently averaged. The likely encoding is
`..._nucleus_...` when the relation is 1:1 and `..._nucleus<n>_...` when it isn't. **But that makes
the feature space ragged across cells, which a fixed `.var` cannot express**, and we do not yet know
what the right answer is. Decide it early, **error loudly on 1:N input until it is decided**, and
find out what is realistically needed rather than guessing now.

### WS1C) A CellProfiler reader for `spatialdata-io` — equal-priority second thread
Images and segmentation masks, not just the feature table. **As a PR to
[`spatialdata-io`](https://github.com/scverse/spatialdata-io)**, not a new package: that repo is
active, has an established `readers/` pattern (codex, cosmx, curio, …), and a merged reader gets
distribution and maintenance for free. It reuses `cp2adata` for the table so the fiddly CellProfiler
column parsing is written exactly once.

This runs as its own sub-team from Wednesday, in parallel with WS1B — not as a stretch goal.

### WS1D) `ExportToAnnData` — a working CellProfiler plugin
The conversion only exists because CellProfiler writes CSVs and something else reads them. An
`ExportToAnnData` module writes the object straight out of the pipeline, with metadata still in scope
rather than reconstructed from directory names afterwards. **Target: a working module in
`active_plugins/`, not just a feasibility note.**

**The mechanism already exists.** Every module implements `get_measurement_columns(pipeline)`
declaring what it will produce, and `pipeline.get_measurement_columns()` aggregates across the
pipeline. **`ExportToDatabase` builds its entire SQL schema this way**; `exporttospreadsheet.py:683`
does the same to choose its columns; `pipeline.get_provider_dictionary("objectgroup")` enumerates
upstream object names. Modules accumulate in `run(workspace)` and write once in `post_run(workspace)`.
[`CellProfiler/CellProfiler-plugins`](https://github.com/CellProfiler/CellProfiler-plugins) is the
community home — drop-in `.py` under `active_plugins/`, actively maintained.

⚠️ **The hard part is distributed writes, not introspection.** CellProfiler processes image sets one
at a time and, at plate scale, across parallel workers. `ExportToDatabase` copes because a database
takes incremental inserts; `AnnData` wants a whole matrix. Either accumulate in memory (fine for one
plate, hopeless for a screen) or write zarr-backed incrementally. Scope that honestly on day 1.

### The spec is the artifact that outlives the hackathon
A written `SPEC.md` in `scverse/cp2adata` — CellProfiler output → object slot, as a table — **plus a
machine-checkable validator** so the spec is not just prose. Whether that is pydantic, pandera or
something else is undecided; pick it on the day. The bar is that it should be **scientifically
solid**: unambiguous enough that two people implementing against it produce the same object.

**Why this isn't a Claude-in-an-hour job:** a CSV-to-AnnData converter is fifteen minutes of code.
Deciding what *should* be exported, how compartments relate to an observation, and what a metadata
contract has to guarantee is the work — and it outlives the hackathon. Everything downstream of us
inherits these decisions.

**Friday artifact:** `scverse/cp2adata` with `SPEC.md` and a validator, reading both input shapes;
a `spatialdata-io` PR; and a working `ExportToAnnData` plugin.

### ⚠️ WS1 is the largest track — cut in this order
Four threads is more than one team can carry. If WS1 is under-subscribed, drop from the bottom:
**WS1D (plugin) → WS1C (spatialdata-io) → WS1B's second input shape.** WS1A and a working
single-shape `cp2adata` are the floor; everything else is upside.

### Who this suits
Anyone who **runs CellProfiler in practice** — WS1A is a domain question, not a programming one, and
practitioner judgement is the scarce input. Paired with people comfortable with AnnData conventions
for WS1B, SpatialData for WS1C, and one or two willing to write a CellProfiler module for WS1D. No
machine learning anywhere in this workstream.

### Scope boundary
WS1 owns **the object**: getting data out of CellProfiler into a correct, agreed representation. What
you then *compute* from that object belongs to [WS6](../ws6_perturbation_tooling/). The one interface
is the object layout — agree it Wednesday morning and both tracks run in parallel.

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

**Order matters: WS1A → WS1B → WS1D is a dependency chain.** `cp2adata` works on *all existing*
CellProfiler output — the whole Cell Painting Gallery, every lab's archive, version-independent. The
plugin only helps data generated *after* people adopt it. So the converter has by far the larger
addressable dataset **and** it is the plugin's dependency: once the spec exists, `ExportToAnnData`
reduces to wiring an agreed schema into `post_run` rather than solving the same design problem twice,
differently. WS1C can run in parallel once the `.var`/`.obs` contract is fixed.

- Install CellProfiler first thing and export the test plate below under a few different
  configurations. Comparing real outputs answers most of WS1A.
- Settle the 1:N encoding before writing the reader. Error loudly until it is decided.
- Prior art worth an hour before writing anything: `pycytominer` for the incumbent
  normalisation/aggregation conventions, and `spatialdata-io`'s existing readers as the pattern a new
  reader should follow.

## Relevant Resources

- [CellProfiler](https://cellprofiler.org/) · [CellProfiler-plugins](https://github.com/CellProfiler/CellProfiler-plugins)
- [AnnData](https://anndata.readthedocs.io/en/latest/) · [scanpy](https://scanpy.readthedocs.io/en/stable/) · [SpatialData](https://spatialdata.scverse.org/) · [spatialdata-io](https://github.com/scverse/spatialdata-io)
- [pycytominer](https://pycytominer.readthedocs.io/) — incumbent conventions for profile handling
