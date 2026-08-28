# WS5: AI-driven single-cell image phenotyping with scPortrait

## Introduction

In this workstream, we will extend [scPortrait](https://github.com/MannLabs/scPortrait), a toolkit that turns raw microscopy into single-cell representations. It already covers the path from images to a per-cell dataset — stitching, segmentation, extraction of masked single-cell crops, featurization, and export of cutting contours for laser microdissection — and it is scverse-native throughout: images, masks and annotations live in a `SpatialData` store, and the single-cell images live in `.h5sc`, an AnnData file with a `(cells, channels, height, width)` tensor in `obsm`. That makes it a good base for things it does not yet do. For this, we will have to evaluate the following aspects:

- WS5A) Can scPortrait generate cell morphology, not just describe it? There are pretrained perturbation-conditioned image models (MorphoDiff, CellFlux, IMPA) and pretrained embedding models (OpenPhenom, scDINO), but every one of them reads its own folder-of-images format. None is AnnData-native. What would it take to train or run one against `.h5sc` directly, and does scPortrait's `VAEBase` scaffold or a pretrained backbone give a better starting point?
- WS5B) What does interactive exploration of image-based phenotypes look like? scPortrait has a static matplotlib crop gallery (`pl.cell_grid`) and a `Project.view_sdata()` hook into napari-spatialdata, which today registers three widgets — scatter, view, annotation. Clicking a point in an embedding and seeing that cell's crop is the obvious missing move. Is that a napari widget, a browser tool (Vitessce and TissUUmaps both read AnnData/SpatialData), or something else?
- WS5C) Can an agent drive an image-processing workflow? scPortrait is Python-API plus a YAML config keyed by class name, with no CLI. `napari-mcp` already exposes a viewer over 16 MCP tools, and there are MCP servers for AnnData and scanpy but none for SpatialData or for scPortrait. What is the right surface to expose — configuration, quality control, method selection — and how would we tell whether the agent's choices were any good?

## Getting started

```bash
pip install scportrait          # Apache-2.0, Python >=3.11, Linux/macOS
```

```python
import scportrait
scportrait.data.autophagosome_h5sc()   # ready-made .h5sc pair, autophagy stimulated/unstimulated
scportrait.data.dataset_1()            # ~44 MB raw images, the walkthrough dataset
```

- Work through [A Walk Through The scPortrait Ecosystem](https://mannlabs.github.io/scPortrait/pages/tutorials.html) and the deep-learning tutorial, which builds a PyTorch dataloader straight off a `.h5sc`.
- Read `Project` in `src/scportrait/pipeline/project.py` — `.sdata`, `.h5sc`, and `load_input_from_* → segment → extract → featurize → select` are the whole surface. Extension is by subclassing plus a top-level YAML key named after your class; there is no plugin system.
- `ConvNeXtFeaturizer` (`pipeline/featurization.py`) is a ~110-line template for wiring a new backbone in, and the cleanest thing to copy for WS5A.
- Everything downstream is an AnnData, so scanpy, pertpy and the rest of scverse apply once you have features.

## Reference

### Where scPortrait is today

v1.8.0 on PyPI (May 2026), 110 stars, Apache-2.0, preprint [Mädler, Schmacke et al. 2025](https://doi.org/10.1101/2025.09.22.677590), successor to SPARCSpy. Segmentation is Cellpose-only (pinned `<4`; a Cellpose 4 / `cpsam` backend adapter is open as PR #406). Featurizers are `CellFeaturizer` (classical intensity and shape statistics), `MLClusterClassifier` and `EnsembleClassifier` (inference from Lightning checkpoints), and `ConvNeXtFeaturizer` (2048-d embeddings from a HuggingFace ConvNeXt). Models in-tree include VGG variants, a convolutional autoencoder and `VAEBase`; one pretrained checkpoint ships, a binary autophagy classifier from the SPARCS paper. There is no self-supervised backbone, no CLI, and no mention of generative models, agents or foundation models anywhere in the repo.

### What exists elsewhere, and how usable it is

For WS5A, [OpenPhenom](https://huggingface.co/recursionpharma/OpenPhenom) is the easiest win — a channel-agnostic masked autoencoder that accepts 1/4/6/11 channels and loads in three lines, though under a non-commercial licence; [CellFlux](https://github.com/yuhui-zh15/CellFlux) (MIT, flow matching) and [MorphoDiff](https://github.com/bowang-lab/MorphoDiff) (Apache-2.0, latent diffusion) both publish weights; [IMPA](https://github.com/theislab/IMPA) is by a scPortrait co-author but has no licence file and has been dormant since January 2025. For WS5B, [napari-spatialdata](https://github.com/scverse/napari-spatialdata) has hover-highlight and lasso selection on its scatter widget but no crop gallery; [Vitessce](https://github.com/vitessce/vitessce-python) reads AnnData-Zarr and SpatialData-Zarr in the browser but needs an on-disk store, not an in-memory object; [TissUUmaps](https://github.com/TissUUmaps/TissUUmaps) reads `.h5ad` including `obsm["X_umap"]` directly. For WS5C, [napari-mcp](https://github.com/royerlab/napari-mcp) is the shortest path to a working demo and lists Claude Code as a supported client; [bia-bob](https://github.com/haesleinhuepf/bia-bob) is a mature Jupyter copilot with a local Ollama option; [anndata-mcp](https://github.com/biocontext-ai/anndata-mcp) and the [scmcphub](https://github.com/scmcphub) servers cover parts of scverse. Worth reading before claiming an agent works: [MicroVQA](https://jmhb0.github.io/microvqa) (expert microscopy VQA, best models around 53 %) and [arXiv:2608.05266](https://arxiv.org/abs/2608.05266), which finds that agent performance on microscopy benchmarks does not generalise to unseen tasks.

### If you would rather ship something small

The repo has well-specified open issues: zstd compression for `.h5sc` (#345, benchmarks already posted — 38 % faster reads, 28 % smaller files), exposing the hardcoded chunking (#378), validation for `write_h5sc` (#397), and replacing `eval()` in the config path with an explicit registry (discussion #393, with a working exploit and an agreed fix).

## Relevant Resources

- [scPortrait](https://github.com/MannLabs/scPortrait) · [docs](https://mannlabs.github.io/scPortrait/) · [notebooks](https://github.com/MannLabs/scPortrait-notebooks) · [preprint](https://doi.org/10.1101/2025.09.22.677590)
- [SpatialData](https://spatialdata.scverse.org/) · [napari-spatialdata](https://github.com/scverse/napari-spatialdata)
- [OpenPhenom](https://huggingface.co/recursionpharma/OpenPhenom) · [CellFlux](https://github.com/yuhui-zh15/CellFlux) · [MorphoDiff](https://github.com/bowang-lab/MorphoDiff)
- [napari-mcp](https://github.com/royerlab/napari-mcp) · [bia-bob](https://github.com/haesleinhuepf/bia-bob) · [BioContextAI registry](https://github.com/biocontext-ai/registry)
