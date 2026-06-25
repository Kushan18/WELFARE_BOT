import importlib, traceback

modules = [
    "scraper.pmindia",
    "scraper.ts_official",
    "scraper.ts_vikaspedia",
    "scraper.ap_official",
    "scraper.ap_vikaspedia",
    "scraper.data_gov",
    "scraper.vikaspedia_central",
]

for m in modules:
    try:
        importlib.import_module(m)
        print(f"{m} imported successfully")
    except Exception as e:
        print(f"Error importing {m}: {e}")
        traceback.print_exc()
