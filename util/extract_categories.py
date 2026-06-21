import sys
import json
import threading
import yaml
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

OUTPUT_PATH = "categories.json"

CATEGORIES = {}
CATEGORY_LOCK = threading.Lock()

def process_pack(pack_dir: Path):
    actor_dir = pack_dir / "Actor"
    if not actor_dir.exists():
        return

    for yml_path in actor_dir.glob("*ActorParam*"):
        if not yml_path.is_file():
            continue

        data = yaml.safe_load(yml_path.read_text(encoding="utf-8"))
        category = data.get("Category") if isinstance(data, dict) else None
        if category is None:
            continue

        with CATEGORY_LOCK:
            if category not in CATEGORIES:
                CATEGORIES[category] = str(yml_path)
                print(f"{category} -> {yml_path}")

def main():
    if len(sys.argv) < 2:
        print(f"usage: {sys.argv[0]} <root_path>")
        return

    root = Path(sys.argv[1])
    pack_dirs = [p for p in root.iterdir() if p.is_dir() and ".pack" in p.name]

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(process_pack, p) for p in pack_dirs]
        for f in as_completed(futures):
            f.result()

    Path(OUTPUT_PATH).write_text(json.dumps(sorted(CATEGORIES.keys()), indent=2), encoding="utf-8")
    print(f"wrote {len(CATEGORIES)} categories to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()