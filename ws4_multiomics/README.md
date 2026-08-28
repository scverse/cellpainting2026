# WS4: Cross-modal integration of morphology and transcriptomics

The work happens in a separate repository: [`Arkkienkeli/hackathon_crossmodal_stream`](https://github.com/Arkkienkeli/hackathon_crossmodal_stream) (Nikita Moshkov). Clone that; this page is the orientation.

## Introduction

In this workstream, we will explore what Cell Painting morphology and single-cell transcriptomics each tell us about a compound, and whether the two can be aligned into one representation. The same compounds have been profiled both ways — morphologically in LINCS (A549) and EU-OPENSCREEN (HepG2), transcriptomically in TAHOE — so compound identity and mechanism annotation give us a pairing signal without any shared cells. For this, we will have to evaluate the following aspects:

- WS4A) Do the two modalities agree about which compounds resemble each other? The baseline notebooks answer this with a Mantel test between compound–compound distance matrices and with silhouette scores per mechanism class in each space. Where they disagree, is that a real difference in what the assays measure, or an artefact of how each embedding was built?
- WS4B) Can drug response supervise an alignment? Rather than comparing two independently built PCA spaces, learn a mapping that puts a compound's morphological and transcriptomic profiles in the same place. What supervision is available — compound identity, mechanism class, dose, response measurements — and how much of it is needed before a joint space beats either modality alone?
- WS4C) Which genes and gene programs are encoded in a morphological phenotype? If a mapping works in one direction, morphology should be predictive of expression. Which transcriptional programs are recoverable from images, and which are invisible to them?

## Test dataset

The morphology profiles are committed to the workstream repo (~40 MB of `.h5ad`); the single-cell expression data and the original CellProfiler output are on [Google Drive](https://drive.google.com/drive/folders/1gV6iEnXW3vElA99yDqQPQp6fvKbbzVKE?usp=sharing) and have to be downloaded separately.

### Morphology (in the repo)

|            | LINCS                                          | EU-OPENSCREEN                            |
| ---------- | ---------------------------------------------- | ---------------------------------------- |
| Cell line  | A549                                           | HepG2                                    |
| Sites      | 1 (Broad, batch `2016_04_01_a549_48hr_batch1`) | 3 (`FMP`, `IMTM`, `MEDINA`)              |
| Well-level | 4,224 wells × 615 features                     | ~460 wells × 636 features per site       |
| Consensus  | 529 rows (compound × dose)                     | 116–117 rows (one per compound) per site |
| Compounds  | 86                                             | 116–117                                  |
| Doses      | 7 (`Metadata_dose_recode` 1–7)                 | 1 (10 µM)                                |

Both are `mad_robustize`-normalized, feature-selected CellProfiler profiles. Note the compartment prefixes differ — LINCS uses `Cells_` / `Cytoplasm_` / `Nuclei_`, EU-OPENSCREEN uses `Cells_` / `Cyto_` / `Nuc_` — so the two feature spaces are not directly comparable and any cross-dataset work has to go through a shared representation, not shared columns.

### Expression (Google Drive)

`a549_cells.h5ad` (605,940 cells × 62,710 genes, 94 drugs) and `hepg2_cells.h5ad` (389,085 cells × 62,710 genes, 120 drugs), raw UMI counts. There is no vehicle/DMSO group and no per-cell dose, so expression profiles are compared to each other rather than to an untreated baseline.

### What pairs the two

Every file carries `Metadata_Drug` and `Metadata_moa_fine`, a 21-class coarse mechanism label. Name matching was already done: 86 of 94 A549 drugs and 117 of 120 HepG2 drugs have both a morphology and an expression embedding. LINCS and EU-OPENSCREEN share 46 compounds and 17 mechanism classes with each other, which makes a cross-cell-line comparison possible as well. `moa_fine` includes an `unclear` class — decide early whether to keep it.

## Reference: what the baseline notebooks already establish

`OpenScreen/morphology_umap.ipynb` builds per-site and cross-site UMAPs. The two `*_expression_integration.ipynb` notebooks do the cross-modal comparison: load expression, match compounds by name, PCA each modality, average to one embedding per compound, then compare.

Quality control on the morphology side is done and worth not repeating: percent replicating is 69–91 % per HepG2 site and 37.4 % for LINCS (which spans a much more heterogeneous compound–dose library, with a clear dose gradient from 34.9 % at low dose to 41.5 % at high); `copairs` mAP against DMSO makes 86–95 % of HepG2 compounds phenotypically active per site. The LINCS notebook also rebuilds Broad's levels 4a, 4b and 5 from level 3 and validates each against the official files, because the `lincs-cell-painting` repo ships DVC and git-lfs pointers rather than data.

One result to keep in mind before interpreting anything: PC1 of the HepG2 expression embedding is a proteotoxic/heat-shock stress axis, not mechanism — the dominant transcriptional signal is a generic stress response shared across unrelated drugs.

## Getting Started

- Clone [`Arkkienkeli/hackathon_crossmodal_stream`](https://github.com/Arkkienkeli/hackathon_crossmodal_stream), download the expression `.h5ad` files from the Drive link into it, and run the two integration notebooks end to end.
- They need `anndata`, `scanpy`, `pycytominer`, `copairs`, `scikit-learn`, `umap-learn`. The expression files are large — expect the scanpy PCA step to be the slow part.
- The notebooks stop at two independently built PCA spaces compared post hoc. WS4B starts where they stop.
- Ask Nikita what response measurements exist beyond compound identity and mechanism class; that determines how much of WS4B is supervised alignment and how much is unsupervised.

## Relevant Resources

- [hackathon_crossmodal_stream](https://github.com/Arkkienkeli/hackathon_crossmodal_stream) — the workstream repo
- [lincs-cell-painting](https://github.com/broadinstitute/lincs-cell-painting) — Way et al. 2022, the LINCS morphology source
- [pycytominer](https://github.com/cytomining/pycytominer) · [copairs](https://github.com/cytomining/copairs)
- [scanpy](https://scanpy.readthedocs.io/) · [pertpy](https://pertpy.readthedocs.io/)
