# scverse x cellpainting hackathon 2026

**September 2-4, 2026 - Max Delbrück Center (MDC), Campus Berlin-Buch**

A hands-on hackathon at the intersection of Cell Painting / image-based profiling and the scverse ecosystem, jointly organised by scverse, CytoData Society, and EU-OPENSCREEN.

Full details, programme, and registration at **[scverse.org/cellpainting2026](https://scverse.org/cellpainting2026)**.

---

## Workstreams

Each workstream has its own README with background, open questions, datasets and how to get started.

- [WS1: Analysing CellProfiler output with scverse](ws1_cellprofiler_x_scverse) — how CellProfiler should export in the first place, a specified single-cell AnnData object and the `cp2adata` reader for it, a CellProfiler reader for `spatialdata-io`, and an `ExportToAnnData` plugin that skips the conversion entirely.
- [WS2: Optical pooled screens in scverse](ws2_ops_in_scverse) — how to represent sequencing cycles and plate-scale screens so that images, masks and the per-cell table live in one object.
- [WS3: Uncertainty quantification for Cell Painting](ws3_uq_in_cellprofiling) — which UQ methods work on morphological profiles, whether their uncertainties can be trusted, and how to expose them in AnnData.
- [WS4: Cross-modal integration of morphology and transcriptomics](ws4_multiomics) — aligning Cell Painting profiles with matched single-cell RNA-seq, and asking what each modality adds. Developed in a [separate repository](https://github.com/Arkkienkeli/hackathon_crossmodal_stream).
- [WS5: AI-driven single-cell image phenotyping with scPortrait](ws5_scportrait) — generative models of cell morphology, interactive exploration of image-based phenotypes, and agentic image-processing workflows.
- [WS6: Classical single-cell tooling on morphology data](ws6_perturbation_tooling) — which parts of the single-cell perturbation stack transfer to morphological profiles, whether the competing measures of perturbation strength agree at single-cell and well level, and which transcriptomic assumptions quietly break.

---

## Before you travel

- **Download your workstream's data before you arrive.** Several datasets are hundreds of MB to a few GB, and the first morning is not the time to discover that.
- **Compute:** cloud instances with Jupyter, CPU and GPU, on a dedicated network at the venue. External accounts cannot be provisioned before the event, so anything you want to run on day one should also run on your laptop. Most workstreams are laptop-sized by design.
- ⚠️ **Windows:** scPortrait (WS5) and SCALLOPS (WS2) are Linux/macOS only. WSL or a VM if that is your machine.
- **WS1 participants install CellProfiler**, so do it before you fly if you can.

---

## Who should attend

Analysts and biological scientists experienced in Cell Painting workflows, software developers, computational biologists, and ML researchers. **Domain expertise is as critical as technical development** — WS1 in particular opens with a question that needs people who run CellProfiler in practice, and no code at all.

Each workstream README ends with a note on who it suits. Tasks are tracked as [GitHub issues](https://github.com/scverse/cellpainting2026/issues) in this repo, one per thread, and you can self-assign before the event.

---

## Contact

- Email: cellpainting2026@scverse.org
- Zulip: [#2026-09: hackathon-cellpainting](https://scverse.zulipchat.com/#narrow/channel/591503-2026-09.3A-hackathon-cellpainting)
