# WS6: Classical single-cell tooling on morphology data

**Lead:** [@timtreis](https://github.com/timtreis) — **co-lead wanted**, recruited on the day.
WS6C needs someone fluent in `pertpy` internals; see the note on Lukas/Lucas below.

## Introduction

The scverse perturbation stack — `pertpy` above all — was built for transcriptomics, but almost
nothing in it is intrinsically about genes. A Cell Painting experiment produces the same shape of
object: a perturbation × feature matrix with plate/well/batch structure and negative controls. So a
large part of that stack should transfer. The interesting question is not *whether* we can call these
functions on morphology data — we obviously can — but **which of their assumptions survive contact
with it, which silently break, and what has to change in normalisation and aggregation for the
answers to be trustworthy.**

There is a third player. **[`scmorph`](https://github.com/edbiomedai/scmorph)** (Wagner, Warden,
Khamseh & Beentjes, Edinburgh; [JOSS, Aug 2025](https://joss.theoj.org/papers/10.21105/joss.08324),
MIT, v0.4.0) is an **AnnData-native** single-cell morphology package that has already made many of
these adaptation decisions — batch correction, feature selection, aggregation, hit calling. It is not
a competitor to be benchmarked away; it is **the existing answer to this workstream's question**, and
our job is to find out how good an answer it is.

So the shape of WS6 is: **three ecosystems that overlap in one contested zone, and nobody has ever put
them side by side.**

| Task | Transcriptomics (`pertpy`/`scanpy`) | Image profiling (`pycytominer`/`copairs`) | `scmorph` |
|---|---|---|---|
| Feature selection | highly variable genes | variance / correlation filters | `select_features`, `corr_features` (Pearson · Spearman · **Chatterjee's ξ**) |
| Batch correction | Harmony, Combat, scVI | plate normalisation to DMSO | `remove_batch_effects`, `scale_by_batch` |
| Perturbation strength | E-distance, MMD | **mAP** (`copairs`) | `aggregate_mahalanobis`, `tstat_distance` |
| Hit calling | DE tests | mAP thresholds | `get_ks` (KS statistic) |
| Guide QC | `Mixscape` | — | — |

## Scope — decided

- **Both threads run: the full `pertpy` triage *and* the metric benchmark.** They suit different
  people, so they can go in parallel rather than in sequence.
- **Staffing decides the scope.** Advertise both at the workstream market; if fewer than ~6 people
  sign up, **cut the triage and keep the benchmark** — the benchmark is where the finding is.
- **Dataset: JUMP `cpg0016`.** This is where our prior copairs-vs-Mahalanobis evidence came from, so
  new work extends existing evidence rather than starting cold.
- **Run at both levels, and the gap between them is the finding.** Do the metrics rank perturbations
  the same way on single cells as on aggregated wells? Nobody has asked, and it bears directly on
  whether single-cell morphology is worth its cost.
  - well-aggregated → `workspace/profiles/.../BR00117035.parquet` (13 MB)
  - single-cell → a slice of `workspace/analysis/.../<plate>-<well>-<site>/` (~7.8 MB per well-site;
    ~30 well-sites ≈ 250 MB), or [WS1](../ws1_cellprofiler_x_scverse/)'s `cp2adata` output once it exists
- **`scmorph` is a comparator and a methodology source, not a contribution target.** No PRs to it.
  Benchmark against its implementations, and read its explainer notebooks before designing ours.
- **If the metrics genuinely disagree, the write-up is a blog post / scverse note**, not a paper.

## The questions

- **WS6A) Triage.** For each `pertpy` capability, decide: applicable as-is / needs adaptation /
  conceptually meaningless on morphology — **and whether `scmorph` already does it.** One line of
  justification each. Cheap, and it tells the group within a few hours where the remaining time
  should go. `Mixscape` is the standout unclaimed candidate: guide-efficiency filtering has an
  obvious optical-pooled-screening analogue and neither `scmorph` nor `pycytominer` offers it.
- **WS6B) Do the perturbation-strength metrics agree?** The sharpest question here, and we already
  have reason to think the answer is no. Benchmark **`copairs` mAP vs `pertpy` E-distance/MMD vs
  `scmorph` Mahalanobis / t-stat distance** on one plate, and report where they disagree — not just
  whether they correlate.
  **Pre-commit to the decision rule before Wednesday:** e.g. *"we declare disagreement if Spearman ρ
  between any two rankings is < 0.7, or if >10% of compounds are called active by one method and
  inactive by another"*, and name the disagreeing compounds. Without a rule fixed in advance this
  becomes 1.5 days of plots and a shrug.
- **WS6C) What breaks, and why.** Morphology features are heavily correlated, scale-heterogeneous,
  and a few thousand engineered measurements rather than counts. No counts means no negative
  binomial. Normalisation is per-plate against DMSO, not library size. Aggregation is to the well,
  not to a cell type. **This part requires reading `pertpy`'s source**, not just calling it — find
  where a count model or a library-size assumption is baked in, and state the minimal fix.

**Why this isn't a Claude-in-an-hour job:** calling these functions on a feature matrix is a few
lines. The work is deciding which results are *meaningful*, producing evidence for that judgement,
and writing down the adaptation rules. The deliverable is a defensible answer, not a wrapper.

**Friday artifact:** the triage table (WS6A), one benchmark figure plus a named list of compounds
where the metrics disagree (WS6B), and a short written list of concrete assumption violations with
proposed fixes (WS6C). Stretch: a PR to whichever package the evidence says should change.

## Why we think the metrics disagree

Not a hunch. From our own prior analysis: `copairs` phenotypic activity called **~88% of Target-2
compounds active, while ~30% of those sat perfectly mixed with the DMSO blob**; Mahalanobis distance
separated them far more convincingly, and the `copairs` p-values looked poorly calibrated.
Independently, `scmorph` shipped **`aggregate_mahalanobis`** as a first-class method. Two groups
arrived at the same correction without talking to each other. That makes this a real open question
about the field's default metric, not a tooling exercise.

## Prior work — this has been circling for nine months

- **Notion, 2026-07-02** — logged as *WS7, "Perturbation Tooling on Cell Painting Data"*: apply
  perturbation-scoring tools (PrEPI, NVIDIA) built for transcriptomics to Cell Painting; what works,
  what breaks, how normalisation/aggregation must change. Action item *"Ask [Lucas] to prepare
  perturbation tooling track"* — **still unchecked**.
- **Zulip, 2026-06-30** — prep-lead list: *"Reusing Perturbation tooling → Lukas? will ask"*. No
  confirmation ever appeared in the channel.
- **Origin meeting, 2025-12-18** — "existing methods (trajectory inference, perturbation models)
  could be adapted for morphological data"; a gap named as **"highly variable features" for
  morphology**; and *"SEMorph exists as prior art but limited in scope — better to adjust scanpy
  directly"*. ⚠️ **"SEMorph" is almost certainly a mis-transcription of `scmorph`, and that verdict
  is stale** — it predates the JOSS paper and v0.4.0. Re-make the call against the current version.
  The named HVG gap is also partly closed already, by Chatterjee-based `select_features`.

⚠️ **Unresolved:** the records name both *Lukas* (Zulip; `pertpy`'s author) and *Lucas* (Notion; the
PrEPI author at NVIDIA). Possibly one person mis-transcribed, possibly two. Nobody was ever confirmed
as lead, and this ambiguity is a plausible reason the ask was never made. **Resolve the name first.**

## Scope boundaries

- **Not** WS3/UQ: uncertainty quantification also uses distances, but WS6 asks whether the *point
  estimate* of perturbation strength is right, not how uncertain it is. If both tracks run, agree a
  shared distance implementation on day 1 so the results are comparable.
- **Not** WS1: WS1 owns getting CellProfiler output *into* `AnnData`. WS6 starts from an existing
  `AnnData` and never touches raw images.
- Not building a new package. If something is missing, the output is a PR to `pertpy` or `scmorph`.

## Getting Started

- Fastest possible start, no conversion and no images — the Cell Painting Gallery's finished
  pycytominer profiles for one 384-well plate:
  ```bash
  aws s3 cp --no-sign-request \
    s3://cellpainting-gallery/cpg0016-jump/source_4/workspace/profiles/2021_04_26_Batch1/BR00117035/BR00117035.parquet .
  ```
  13 MB. This track runs on a laptop even if the cluster is down.
- `scmorph` ships example data — `scmorph.datasets.rohban2017()` — for an even faster first cell.
- Do WS6A first and timebox it to Wednesday afternoon.
- Later, swap in the `AnnData` from [WS1](../ws1_cellprofiler_x_scverse/) and check the conclusions
  survive a different object layout.

## Relevant Resources

- [pertpy](https://pertpy.readthedocs.io/) · [scanpy](https://scanpy.readthedocs.io/en/stable/) · [AnnData](https://anndata.readthedocs.io/en/latest/)
- [scmorph](https://github.com/edbiomedai/scmorph) · [docs](https://scmorph.readthedocs.io) · [JOSS paper](https://joss.theoj.org/papers/10.21105/joss.08324)
- [pycytominer](https://pycytominer.readthedocs.io/) — incumbent normalisation/aggregation conventions
- [copairs](https://github.com/cytomining/copairs) — mAP-based perturbation scoring, the field's default
- Chatterjee's ξ — Lin & Han (2023), implemented as `scmorph.pp.correlation.xim`
