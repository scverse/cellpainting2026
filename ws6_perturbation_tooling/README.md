# WS6: Classical single-cell tooling on morphology data

**Lead:** [@timtreis](https://github.com/timtreis) — co-lead wanted, someone fluent in `pertpy` internals.

## Introduction

In this workstream, we will find out how much of the single-cell perturbation stack actually works on morphological profiles. `pertpy` was built for transcriptomics, but almost nothing in it is intrinsically about genes: a Cell Painting experiment produces the same shape of object, a perturbation × feature matrix with plate/well/batch structure and negative controls. Calling these functions on a feature matrix is trivial; the question is which of their assumptions survive, which break quietly, and what has to change in normalisation and aggregation before the answers mean anything. For this, we will have to evaluate the following aspects:

- WS6A) Which parts of the stack transfer? For each capability, decide whether it applies as-is, needs adaptation, or is conceptually meaningless on morphology — and whether `scmorph` already does it. Candidates: distance metrics, `Mixscape`, `Augur`, `Milo`, `scGen`/`CPA`, and differential expression reinterpreted as differential *feature* abundance. `Mixscape` is the clearest gap: guide-efficiency filtering has an obvious optical-pooled-screening analogue and neither `scmorph` nor `pycytominer` offers it.
- WS6B) Do the measures of perturbation strength agree? Image-based profiling ranks compounds with mAP (`copairs`); `pertpy` uses distance-based tests (E-distance, MMD); `scmorph` uses Mahalanobis and t-statistic distances to control. Nobody has put the three side by side. There is reason to think they disagree: in prior work on this data, `copairs` phenotypic activity called ~88 % of Target-2 compounds active while ~30 % of those sat perfectly mixed with the DMSO cluster, Mahalanobis separated them far more convincingly, and the `copairs` p-values looked poorly calibrated. Fix the decision rule before running anything — e.g. disagreement if Spearman ρ between any two rankings falls below 0.7, or if more than 10 % of compounds are called active by one method and inactive by another — and name the compounds where they differ, rather than reporting a correlation and stopping.
- WS6C) Does aggregation change the answer? Run WS6B at well level and at single-cell level and compare. The metrics are defined on aggregated profiles, `pertpy`'s distance tests live at single-cell level, and no one has checked whether the ranking survives the move. This bears directly on whether single-cell morphology is worth its storage and compute.
- WS6D) What breaks, and why? Morphology features are heavily correlated, scale-heterogeneous, and a few thousand engineered measurements rather than counts. No counts means no negative binomial; normalisation is per-plate against DMSO rather than library size; aggregation is to the well, not to a cell type. This part means reading `pertpy`'s source to find where a count model or a library-size assumption is baked in, and stating the minimal fix.

## Test dataset

Both levels come from the same plate, so the WS6C comparison is controlled.

```bash
# well level — 384 wells, pycytominer-normalised, 13 MB
aws s3 cp --no-sign-request \
  s3://cellpainting-gallery/cpg0016-jump/source_4/workspace/profiles/2021_04_26_Batch1/BR00117035/BR00117035.parquet .

# single-cell level — per-object CellProfiler output, ~7.8 MB per well-site
aws s3 cp --no-sign-request --recursive \
  s3://cellpainting-gallery/cpg0016-jump/source_4/workspace/analysis/2021_04_26_Batch1/BR00117035/analysis/ \
  ./sc/ --exclude "*" --include "BR00117035-A0[1-3]-*"     # ~30 well-sites, ~250 MB
```

Each well-site directory holds `Cells.csv`, `Cytoplasm.csv`, `Nuclei.csv` (~2.4 MB each), `Image.csv` and `Experiment.csv`. A whole plate is 3,456 well-sites — do not sync one. [WS1](../ws1_cellprofiler_x_scverse/)'s `cp2adata` will read these into `AnnData`; until it exists, load them directly.

`scmorph.datasets.rohban2017()` is a one-call alternative for a first cell. WS3 uses the assembled cross-source profiles (`cpg0016-jump-assembled/source_all/…`, 2.8 GB) if this needs to scale beyond one plate.

No GPU needed; everything here runs on a laptop.

## Reference: what already exists

[`scmorph`](https://github.com/edbiomedai/scmorph) (Wagner, Warden, Khamseh & Beentjes, Edinburgh; [JOSS, Aug 2025](https://joss.theoj.org/papers/10.21105/joss.08324); MIT; v0.4.0) is AnnData-native and has already made many of these adaptation decisions. It is our comparator and a source of prior reasoning, **not** something we contribute to.

| | |
| --- | --- |
| Distances to control | `pp.aggregate_mahalanobis`, `pp.tstat_distance`, `pp.aggregate_ttest`, `pp.aggregate_pc` |
| Hit calling | `tl.get_ks` (KS statistic) |
| Feature selection | `pp.select_features`, `pp.corr_features` — Pearson, Spearman and Chatterjee's ξ (Lin & Han 2023), the last to catch *non-linearly* correlated features |
| Batch correction | `pp.remove_batch_effects`, `pp.scale_by_batch` |
| Scope limit | continuous, non-radial features only; trajectory inference shells out to R |

Its `docs/notebooks/` are worth an hour before designing our comparison — `correlation_comparison`, `why_scone`, `hit_calling` and `scalability` are explicit justifications of method choices, and the cheapest way to avoid running a comparison someone has already shown is uninformative.

Note that `scmorph` shipped Mahalanobis as a first-class method independently of the prior work quoted in WS6B. Two groups converging on the same correction is the reason WS6B is a real question rather than a tooling exercise.

## Getting Started

- WS6A first, timeboxed to Wednesday afternoon: a triage table is cheap and tells the group where the remaining time should go.
- Start from the 13 MB parquet — it needs no conversion and works even if the cluster does not.
- Write the WS6B decision rule down before producing any numbers.
- Whatever survives should end up as a function that takes an AnnData and returns one, plus a short write-up. If the metrics genuinely disagree, that is a blog post or an scverse note, not a paper.
- If fewer than about six people join, drop WS6A and keep the benchmark.

## Relevant Resources

- [pertpy](https://pertpy.readthedocs.io/) · [scanpy](https://scanpy.readthedocs.io/en/stable/) · [AnnData](https://anndata.readthedocs.io/en/latest/)
- [scmorph](https://github.com/edbiomedai/scmorph) · [docs](https://scmorph.readthedocs.io) · [JOSS paper](https://joss.theoj.org/papers/10.21105/joss.08324)
- [pycytominer](https://pycytominer.readthedocs.io/) — incumbent normalisation and aggregation conventions
- [copairs](https://github.com/cytomining/copairs) — mAP-based perturbation scoring
- Lin & Han (2023) — Chatterjee's ξ, implemented as `scmorph.pp.correlation.xim`
