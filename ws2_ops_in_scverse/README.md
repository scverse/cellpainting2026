# WS2: Optical pooled screens in scverse

## Introduction

In this workstream, we will explore how optical pooled screening (OPS) data can be handled with scverse tooling. An OPS experiment pairs a phenotypic imaging round with several rounds of in-situ sequencing that assign a guide to every cell, so the natural target is a `SpatialData` object holding the images, the segmentation masks and the per-cell table together. Nobody does this today — every OPS toolkit ships its own storage layer, and SpatialData has no notion of a sequencing cycle. For this, we will have to evaluate the following aspects:

- WS2A) How should the sequencing cycles be represented? SpatialData images are `(c, y, x)` or `(c, z, y, x)`, so there is no cycle axis to put them on, and each cycle usually carries its own registration transform. Options seen in the wild are to stack cycles into the channel axis with names like `cycle03_G`, to make one image element per cycle sharing a coordinate system, or to follow the OME-NGFF plate spec and keep one image per acquisition per well. Which of these survives contact with a pipeline that has to write intermediates at every step?
- WS2B) What happens at screen scale? A 384-well plate at 12 cycles is thousands of image elements before tiles are counted, and the plate/well hierarchy has no representation in SpatialData at all — element names cannot even contain a slash. Where are the limits, and can conventions work around them or do we need changes upstream?
- WS2C) Which scverse tools are useful once the data is in? Candidates are `squidpy.experimental.im.calculate_image_features` for cp_measure features, pertpy and copairs for guide-level statistics, spatialdata-plot and napari-spatialdata for inspection. Is the round trip better than what the OPS pipelines already do themselves, and where is it worse?

## Test dataset

We want a screen small enough to process end to end during the hackathon, with the phenotype round, the sequencing cycles and the guide library all present.

### Option A — SCALLOPS `feldman_2019_small()` (~756 MB)

[SCALLOPS](https://github.com/Genentech/scallops) is Genentech's OPS toolkit and the most complete open pipeline; it ships a small dataset that its CLI, tests and notebooks already run on.

```python
from scallops.datasets import feldman_2019_small
path = feldman_2019_small()   # pooch download on first call
```

|          |                                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Content  | 2 tiles (A1 Tile-102, Tile-103) × 9 sequencing cycles, one phenotype acquisition, `barcodes.csv`                                                                                                                         |
| Source   | Feldman et al. 2019, HeLa p65 translocation screen                                                                                                                                                                       |
| Pipeline | the [example commands](https://scallops.readthedocs.io/en/latest/example_commands.html) run illumination correction → stitching → elastix registration → segmentation → spot detection → base calling → features → merge |

⚠️ SCALLOPS needs Python ≥ 3.12 and pulls tensorflow, itk-elastix and stardist. Whether it co-installs with `spatialdata` is the first thing to find out.

### Option B — Brieflow small test data (1.4 GB)

```bash
curl -L -o small_test_data.zip https://zenodo.org/records/15276612/files/small_test_data.zip
```

ND2 files from the Cheeseman lab: 1 plate, wells A1 and A2, 3 sequencing tiles × 11 cycles, 3 phenotype tiles, a 20,445-guide library. Runs through the [Brieflow](https://github.com/cheeseman-lab/brieflow) Snakemake workflow in about 15 minutes and produces TIFFs and parquet instead of zarr — a useful second layout if the question is what a general reader has to cope with.

### Option C — cpg0021-periscope, a few tiles (Cell Painting Gallery)

A genome-wide screen (Ramezani et al. 2025) in A549 and HeLa: 12 cycles, 316 tiles per well at 10×, over 1,000 at 20×. Use it for the scale questions in WS2B.

```bash
# one 10x sequencing tile, cycle 1 (22 MB); loop n=1..12 for the full series
aws s3 cp --no-sign-request \
  "s3://cellpainting-gallery/cpg0021-periscope/broad/images/20200805_A549_WG_Screen/images/CP186A/10X_c1-SBS-1/Well1_Point1_0000_ChannelDAPI,Cy3,A594,Cy5,Cy7_Seq0000.nd2" .
```

Sequencing images live under `10X_c{n}-SBS-{n}/`, phenotype under `20X_CP_{plate}/`, illumination functions under `illum/`, profiles under `workspace/`. The dataset is 56 TB in total, so pull tiles, never a plate.

### Option D — CZI OPS data portal

<!-- TODO(tim): portal URL + download command. Searched 2026-08-28: chanzuckerberg/ops-schema scopes raw acquisition images out (aggregated OME-Zarr, example crops and h5ad only), and the CZ Biohub OPS Explorer (https://biohub.ai/ops-explorer) is alpha with no download surfaced. -->

To be added.

## Reference: how cycles are stored today

|                | Cycles                                                                                                                         | Registration                                          | Per-cell table                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------ |
| SCALLOPS       | `xr.DataArray (t, c, z, y, x)`, cycle on `t` — also used for phenotype modality and for real time in live imaging              | elastix affine + B-spline, text files beside the data | parquet; AnnData-Zarr from `merge --format zarr` |
| Fractal / ngio | one OME-Zarr image per acquisition inside the well (`plate.zarr/B/03/0`, `/1`, …) — the NGFF plate spec's own mechanism        | translations in a per-field ROI table                 | tables under `image.zarr/tables/`                |
| Brieflow       | `(cycle, channel, y, x)` TIFF per tile                                                                                         | applied eagerly, not stored                           | parquet with `cell_barcode_0`, `gene_symbol_0`   |
| spatialdata-io | MACSima stacks rounds into channels (`R3 DAPI`) and records the mapping in a table; the ISS reader takes one pre-aligned stack | one transform per element                             | `TableModel`                                     |

Constraints that shape the answer to WS2A: transforms are per element, so two channels of the same image cannot be aligned differently; `sdata.attrs` takes arbitrary JSON at the root; one table can annotate many label elements via `(region, instance_id)`. OME-NGFF itself allows at most one time axis and one channel-or-custom axis in at most five dimensions.

Background reading: [spatialdata#247](https://github.com/scverse/spatialdata/issues/247) (time axis, closed as not planned), [#398](https://github.com/scverse/spatialdata/issues/398) (nested hierarchies), [spatialdata-io#159](https://github.com/scverse/spatialdata-io/issues/159) (rounds and channels), [ome/ngff#441](https://github.com/ome/ngff/issues/441) (multiple image types per field). A longer survey with citations is in `tasks/ops_spatialdata_plan.md`.

## Getting Started

- Install SCALLOPS, run the example commands on Option A once unmodified, and keep the output as a reference.
- Read `scallops/experiment/elements.py` and `scallops/zarr_io.py` — the storage layer is about 1,000 lines across ~50 call sites, small enough to replace during a hackathon. One concrete way into WS2A and WS2B is to make SCALLOPS write and read a SpatialData store instead, splitting and re-stacking the `t` axis at the storage boundary so its processing code is untouched, then running its test suite against the result.
- Everything that has to be worked around is a finding — collect them as issues with reproducers rather than only as code.

## Relevant Resources

- [SCALLOPS](https://scallops.readthedocs.io/)
- [SpatialData](https://spatialdata.scverse.org/)
- [OME-NGFF](https://ngff.openmicroscopy.org/0.5/)
- [ngio](https://github.com/BioVisionCenter/ngio)
- [squidpy](https://squidpy.readthedocs.io/) · [pertpy](https://pertpy.readthedocs.io/) · [copairs](https://github.com/cytomining/copairs)
- [Feldman et al. 2019](https://doi.org/10.1016/j.cell.2019.09.016)
