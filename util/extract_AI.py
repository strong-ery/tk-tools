import sys
import json
import yaml
from pathlib import Path

OUTPUT_PATH = "ActorInfoTypes.json"

KEY_TYPES = {}

def record(key, value):
    type_name = type(value).__name__
    if key not in KEY_TYPES:
        KEY_TYPES[key] = type_name

def main():
    if len(sys.argv) < 2:
        print(f"usage: {sys.argv[0]} <yaml_path>")
        return

    yml_path = Path(sys.argv[1])
    data = yaml.safe_load(yml_path.read_text(encoding="utf-8"))

    entries = data if isinstance(data, list) else [data]
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        for key, value in entry.items():
            record(key, value)

    Path(OUTPUT_PATH).write_text(
        json.dumps(dict(sorted(KEY_TYPES.items())), indent=2), encoding="utf-8"
    )
    print(f"wrote {len(KEY_TYPES)} keys to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()