#!/usr/bin/env python3
"""
extract_sarc.py — Extract a pre-decompressed SARC archive to a folder.

Usage:
    python extract_sarc.py <sarc_path> [output_dir] [--to-yaml]

    <sarc_path>     Path to the pre-decompressed SARC file (required)
    [output_dir]    Output directory (default: same name as input file, minus extension)
    --to-yaml       Convert any BYML files (.byml, .bgyml) to YAML text on extraction.
                    The output file keeps its original name with .yaml appended
                    (e.g. Foo.bgyml -> Foo.bgyml.yaml). Non-BYML files are written as-is.
"""

import sys
import oead
from pathlib import Path

BYML_EXTENSIONS = {".byml", ".bgyml"}


def try_convert_to_yaml(data: bytes, filename: str) -> str | None:
    try:
        parsed = oead.byml.from_binary(data)
        return oead.byml.to_text(parsed)
    except Exception as e:
        print(f"  warning: could not convert '{filename}' to yaml: {e}")
        return None


def main():
    if len(sys.argv) < 2:
        print(f"usage: {sys.argv[0]} <sarc_path> [output_dir] [--to-yaml]")
        return

    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    to_yaml = "--to-yaml" in flags

    sarc_path = Path(args[0])

    if not sarc_path.exists():
        print(f"error: file not found: {sarc_path}")
        return

    output_dir = Path(args[1]) if len(args) > 1 else sarc_path.parent / sarc_path.stem

    data = sarc_path.read_bytes()
    sarc = oead.Sarc(data)

    num_files = sarc.get_num_files()
    print(f"extracting {num_files} file(s) to {output_dir}/")

    for file in sarc.get_files():
        file_data = bytes(file.data)
        out_path = output_dir / file.name
        out_path.parent.mkdir(parents=True, exist_ok=True)

        if to_yaml and Path(file.name).suffix in BYML_EXTENSIONS:
            yaml_text = try_convert_to_yaml(file_data, file.name)
            if yaml_text is not None:
                out_path = out_path.with_name(out_path.name + ".yaml")
                out_path.write_text(yaml_text, encoding="utf-8")
                print(f"  {file.name} -> {out_path.name}")
                continue

        out_path.write_bytes(file_data)
        print(f"  {file.name}")

    print(f"done.")


if __name__ == "__main__":
    main()