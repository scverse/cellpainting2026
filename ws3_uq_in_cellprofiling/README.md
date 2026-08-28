# WS3: Uncertainty quantification for Cell Painting

## Introduction

In this workstream, we will explore how to attach uncertainty estimates to predictions made from morphological profiles. A classifier trained on Cell Painting features will assign a mechanism of action (MoA) to any compound we hand it, including compounds whose mechanism it has never seen, and nothing in its output says which calls to trust. Yunhee has prepared a tutorial notebook that trains an MLP on JUMP profiles with [lightning-uq-box](https://github.com/lightning-uq-box/lightning-uq-box) and compares a deterministic classifier against Monte Carlo dropout; that is our starting point. For this, we will have to evaluate the following aspects:

- WS3A) Which UQ methods are practical for profiles in AnnData? lightning-uq-box offers MC dropout, deep ensembles, Laplace, SWAG and evidential methods behind one interface; conformal prediction (MAPIE, TorchCP) wraps an already-trained classifier and returns prediction sets with a coverage guarantee; scikit-learn gives calibrated probabilities for free. What does each cost to run, and does it give us a probability, a set of plausible labels, or a split into epistemic and aleatoric uncertainty?
- WS3B) Are the uncertainties any good? This needs metrics beyond accuracy — calibration (ECE, Brier, NLL), whether uncertainty ranks errors (accuracy–rejection curves), coverage and set size for conformal methods. It also needs splits that are not trivially leaky: replicate wells of the same compound must not straddle train and test, and holding out a whole imaging site is a harder and more interesting question than holding out wells.
- WS3C) Does uncertainty rise where the model should struggle? Batch correction is known to fail once a dataset spans many compounds and several microscope types, some phenotypes are too weak to separate from controls, and MoA annotations are incomplete with many compounds hitting more than one target. If uncertainty tracks those cases it is diagnostically useful; if it does not, that is worth knowing.
- WS3D) How should the result be exposed? scverse tools already write per-cell confidence into `.obs` — scArches writes one minus the top kNN vote, CellTypist the maximum of a sigmoid, popV a count of agreeing classifiers, Scyan a log-probability with NaN for rejections — and no two mean the same thing. Is there a convention worth proposing, and a helper that produces it from an AnnData with a label column?

## Test dataset

### Option A — JUMP compound profiles, cpg0016 (2.8 GB)

The largest public Cell Painting resource: 803,853 wells over 10 imaging sites, one row per well.

```python
import polars as pl
url = ("https://cellpainting-gallery.s3.amazonaws.com/cpg0016-jump-assembled/source_all/"
       "workspace/profiles_assembled/COMPOUND/v1.0/profiles_var_mad_int_featselect_harmony.parquet")
data = pl.scan_parquet(url)
```

|                       |                                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rows                  | one well; 10 sources, 1,713 plates, 115,795 compounds                                                                                                                                           |
| Features              | `X_1 … X_737`, Harmony-corrected embeddings — not named CellProfiler features                                                                                                                   |
| Suffixes              | `var` drop invariant features, `mad` per-plate robust z-score, `int` rank inverse normal transform, `featselect` variance and correlation filtering, `harmony` batch correction keyed on source |
| Interpretable variant | `profiles_var_mad_int.parquet`, 12.1 GB, 3,180 named features — the pair makes a natural experiment for whether uncertainty is a property of the representation or of the correction            |

JUMP ships no MoA annotations, so labels have to come from somewhere else:

|                             | Compounds | Classes | ≥5 compounds | ≥10 |
| --------------------------- | --------- | ------- | ------------ | --- |
| Drug Repurposing Hub ∩ JUMP | 4,159     | 927     | 249          | 116 |
| JUMP-MOA                    | 90        | 47      | 0            | 0   |

`pertpy.metadata.Moa().annotate(adata, query_id="perturbation")` fetches the Repurposing Hub annotations into `.obs["moa"]` and `.obs["target"]` in one call. Note that 358 compounds carry several pipe-separated mechanisms and 42 % of classes have a single compound — both need an explicit decision.

⚠️ JUMP-MOA is the label set the notebook uses, and it is a 90-compound plate design deliberately capped at two compounds per class. It was built to test replicate retrieval, not classifier generalisation: with two compounds per class you cannot hold a compound out and still have the class. The notebook's three-class subset is 5 compounds and 770 wells, one class (DYRK inhibitor) being a single compound, and a random split over wells leaves 100 % of validation compounds and plates in training.

Other things to know: the parquet is a single row group, so a filtered scan still pulls most of 2.8 GB — download once and cache the subset. 84 % of the JUMP-MOA-labelled subset is DMSO. No GPU is needed; the notebook's 74k-parameter MLP does 300 epochs on 770 wells in about 3 seconds on a laptop CPU, and on all 111,803 wells in about 2 minutes.

### Option B — LINCS Cell Painting, cpg0004 (20 MB)

1,571 compounds in A549 at six doses, one lab, two batches, MoA-annotated from the Repurposing Hub (Way et al. 2022). Enough compounds per class for compound-held-out evaluation, and small enough to iterate on.

```bash
git clone --depth 1 https://github.com/broadinstitute/lincs-cell-painting
# consensus/2016_04_01_a549_48hr_batch1/*_consensus_modz_feature_select_dmso.csv.gz   one row per compound-dose
# metadata/moa/repurposing_info_external_moa_map_resolved.tsv                          labels
```

Well-level spherized profiles (383 MB, Git LFS) are there if replicates are needed rather than consensus.

### Option C — BBBC021 per-well profiles (2.9 MB)

632 wells × 516 CellProfiler features (Ljosa et al. 2013), 12 MoA classes, the classic leave-one-compound-out benchmark. Same images as WS1's Option A, so the two workstreams can share ground truth. Half its MoA assignments were made visually.

```bash
curl -O https://data.broadinstitute.org/bbbc/BBBC021/BBBC021_v1_moa.csv
curl -LO https://github.com/cytomining/cytominergallery/raw/master/inst/extdata/ljosa_jbiomolscreen_2013_per_well_mean.csv.gz
```

## Reference: the starting notebook, and what exists elsewhere

The notebook loads the cpg0016 parquet, joins JUMP-MOA labels through `broad_babel`, builds an `AnnData` of 111,803 × 737, subsets to three MoAs (770 wells), runs PCA, then trains `DeterministicClassification` and `MCDropoutClassification` on a 737 → 100 → 3 MLP with dropout 0.2 and 25 MC samples. `predict_step` returns `pred` and `pred_uct`; the last two figures are uncertainty per class split by correctness, and an uncertainty surface over a PCA grid. Two snags: `ad.X.toarray()` fails because `X` from a DataFrame is already dense, and the two models train at different learning rates, so they are not a controlled comparison.

Worth knowing before choosing a method: this has barely been attempted on Cell Painting. The one published example is Ha et al. 2024, who calibrated an MLP ensemble with Mondrian conformal prediction to get an explicit "uncertain" class — internal Janssen data, binary task, no code. Nothing in the field reports calibration error or ensemble variance, and the 2026 field review does not mention uncertainty at all. What is used instead answers a different question: anomaly scores against DMSO, or permutation p-values on retrieval (`copairs`). Conformal prediction has a decade of use in cheminformatics and is cheap and post-hoc, which makes it the obvious thing to try alongside the Bayesian methods; `conformalized_single_cell_annotator` already established an AnnData convention for it, `obs["prediction_sets_0.05"]`. A fuller survey with citations is in `tasks/uq_cellpainting_plan.md`.

## Getting Started

- lightning-uq-box 0.3.0 needs Python ≥ 3.12 and pulls torch, lightning, gpytorch and laplace-torch — use the CPU torch index. Add `anndata`, `scanpy`, `polars`, `scikit-learn`, and `mapie` or `torchcp`.
- Run the notebook unchanged first so everyone has seen the baseline. Then change one thing at a time and keep the model fixed: group the split by compound, then by source, add a calibration metric, add a conformal wrapper around the same trained model.
- Move to a label set with real class sizes once the machinery works — three classes and five compounds cannot tell us whether anything generalises.
- Whatever survives should end up as a function that takes an AnnData and returns one.

## Relevant Resources

- [lightning-uq-box](https://lightning-uq-box.readthedocs.io/) · [MAPIE](https://mapie.readthedocs.io/) · [TorchCP](https://github.com/ml-stat-Sustech/TorchCP)
- [JUMP datasets](https://github.com/jump-cellpainting/datasets) · [lincs-cell-painting](https://github.com/broadinstitute/lincs-cell-painting) · [BBBC021](https://bbbc.broadinstitute.org/BBBC021)
- [pertpy metadata](https://pertpy.readthedocs.io/en/latest/api/metadata_index.html) · [copairs](https://github.com/cytomining/copairs)
- [Ha et al. 2024](https://doi.org/10.1038/s41598-024-75401-5) — conformal prediction on Cell Painting
- [Theunissen et al. 2024](https://doi.org/10.1093/bioinformatics/btae128) — reject options and accuracy–rejection curves
- [Arevalo et al. 2024](https://doi.org/10.1038/s41467-024-50613-5) — where batch correction fails
