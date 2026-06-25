# Phase 7 Scraper Fix & Upgrade

**Goal**: Upgrade the entire `welfarebot-backend/scraper/` pipeline so that running `python -m scraper.seed` seeds at least 30‑50 high‑quality welfare schemes into the MongoDB staging collection, removes noisy entries, adds a quality score, and supports a `--force` flag.

## User Review Required
> [!IMPORTANT]
> The plan introduces new runtime dependencies (`playwright`, `pyarrow`) and modifies existing scraper modules. Please confirm that you are comfortable installing these packages and that the server environment can run headless Chromium.

## Open Questions
> [!WARNING]
> None identified. All required URLs and behaviours are described in the user request.

## Proposed Changes
---
### scraper/hf_dataset.py
- Replace hard‑coded CSV URL with a dynamic lookup using the HuggingFace Hub API (`https://huggingface.co/api/datasets/shrijayan/gov_myscheme`).
- Detect the available data file (prefer Parquet: `data/train-00000-of-00001.parquet`).
- Load with `pandas.read_parquet(..., engine="pyarrow")`.
- Print discovered column names for verification.
- Map columns (`name`, `description`, `eligibility`, `state`, `category`, `apply_link`) to our schema.
- If no usable file is found, log a warning and return an empty list.

---
### scraper/myscheme.py
- Switch from `httpx` to **Playwright** (async Chromium) to render JavaScript.
- Install Playwright via `pip install playwright` and run `playwright install chromium` (documented in README).
- Navigate to the state‑specific URL (Telangana & Andhra Pradesh).
- Wait for scheme cards selector (`[data-testid="scheme-card"]` or `.scheme-card`).
- Implement infinite‑scroll handling: repeatedly scroll to the bottom until no new cards appear.
- Extract required fields: `name`, `description`, `eligibility`, `apply_link`, optional `deadline`.
- Return a list of normalized dicts.

---
### scraper/ts_official.py
- Add noise‑filtering logic:
  - Skip entries with name length < 8 or containing keywords `directory`, `link`, `navigation`, `menu`, `click here` (case‑insensitive).
  - Skip entries with missing description or description length < 30.
- Extract `apply_link` from the card’s `<a>` element when present.
- Extend sources to also scrape:
  - `https://tscie.telangana.gov.in/` (Women & Child welfare schemes)
  - `https://wdcw.tg.nic.in/` (Women Development & Child Welfare).
- Implement these additional URLs inside the same module (or split into new helper functions) and merge the results.

---
### scraper/ap_official.py
- Replace the current single‑card scrape with a robust parser that discovers all scheme entries.
- Detect if schemes are presented in a `<table>`; if so, use `pandas.read_html` to pull rows.
- Otherwise fall back to generic `<div class="scheme">` or list‑item extraction.
- Apply the same noise filters as in `ts_official.py`.
- Add additional Andhra Pradesh sources:
  - `https://apewalfare.ap.gov.in/`
  - `https://women.ap.gov.in/`
- Consolidate results from all three URLs.

---
### scraper/data_gov.py
- Query the Data.gov API to discover the current resource ID for the welfare‑schemes dataset.
  - Use `https://data.gov.in/api/3/action/package_search?q=welfare+schemes&rows=10` to locate a package, then extract the latest `resource_id`.
- Update the request URL with the discovered ID and enable `follow_redirects=True`.
- Parse the JSON payload and map fields to our schema.

---
### scraper/manager.py
- After gathering schemes from all source modules, perform **deduplication** by normalized scheme name (case‑insensitive, whitespace trimmed).
- Apply a **quality filter**:
  - `name` length ≥ 8
  - `description` length ≥ 40
- Compute a `quality_score` (0‑100) based on presence of fields:
  - Description present: +30
  - Eligibility present: +25
  - `apply_link` present: +25
  - `deadline` (if present): +20
- Log counts: total scraped, deduped, passed quality filter.
- Insert only the passing schemes into MongoDB staging collection using the existing upsert logic (key = `apply_link`).
- After insertion, print a preview of the top 10 schemes sorted by `quality_score`.

---
### scraper/seed.py
- Add an argparse flag `--force` (boolean).
- When `--force` is supplied, clear the staging collection before invoking `manager.run_all()`.
- Update usage message accordingly.

---
### requirements.txt
- Add the following packages (new lines):
```
playwright
pyarrow
```
- `pandas` is already present.
- Ensure any newly imported packages (e.g., `asyncio`, `tqdm` if used) are already in the standard library.

---
## Verification Plan
### Automated Tests
- Run `python -m scraper.seed --force` and verify that the staging collection contains ≥ 30 documents.
- Check that each document includes the new `quality_score` field and that no document has a name shorter than 8 characters.
- Confirm that the HF dataset module either loads data (printing column names) or logs a graceful warning without raising.
- Validate that `myscheme.py` successfully returns > 0 schemes for both states (headless Chromium must be functional).

### Manual Verification
- Inspect a few inserted documents via MongoDB Compass or a `find_one` query to ensure fields are correctly mapped.
- Review the console output for the top‑10 preview and quality scores.
- Review log messages for any warnings about missing datasets or failed sources.

---
**End of Plan**
