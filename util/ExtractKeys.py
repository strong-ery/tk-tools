#!/usr/bin/env python3
"""
Universal YAML -> {key: type_name} dumper.

Reads a YAML file containing either:
  - a list of dicts (each dict = one "entry"/"row"), or
  - a single dict, or
  - a dict whose values are themselves lists/dicts of entries (auto-detected)

and writes a JSON file mapping each key seen across all entries to the
Python type name of the first value encountered for that key (e.g. "str",
"int", "float", "bool", "NoneType", "list", "dict").

Usage:
    python dump_key_types.py <yaml_path> [output_path] [--all-types]

    <yaml_path>     Path to the input .yaml/.yml file (required)
    [output_path]   Path to write the JSON output (default: ActorInfoTypes.json)
    --all-types     If passed, record *every* distinct type seen per key
                     as a single comma-separated string (e.g. "int, str")
                     instead of just the first type seen.
"""

import sys
import json
import yaml
from pathlib import Path

DEFAULT_OUTPUT_PATH = "Types.json"


class TolerantLoader(yaml.SafeLoader):
    """
    SafeLoader variant that tolerates unknown custom tags.

    BYML-to-YAML dumps (e.g. from TotK research tooling) use tags like
    !ul, !u, !l, !f, etc. to preserve numeric width/signedness info that
    plain YAML can't express. We don't care about that distinction here
    (we only want the underlying value + its base type), so any unknown
    tag is constructed using the normal scalar/sequence/mapping resolver
    for its node kind, with the tag itself discarded.
    """
    pass


def _construct_unknown(loader, node):
    if isinstance(node, yaml.ScalarNode):
        # Try to resolve the scalar's "real" type the way PyYAML would for
        # an untagged value (int, float, bool, null), since custom tags
        # like !ul/!u/!l only indicate storage width/signedness in the
        # source format, not a different logical type.
        resolved_tag = loader.resolve(yaml.ScalarNode, node.value, (True, False))
        try:
            return loader.yaml_constructors[resolved_tag](loader, node)
        except (KeyError, ValueError, yaml.constructor.ConstructorError):
            return loader.construct_scalar(node)
    elif isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node)
    elif isinstance(node, yaml.MappingNode):
        return loader.construct_mapping(node)
    return None


TolerantLoader.add_constructor(None, _construct_unknown)


def type_name(value):
    return type(value).__name__


def iter_entries(data):
    """
    Yield dict 'entries' from arbitrary top-level YAML structures.

    - list of dicts        -> yield each dict
    - single dict           -> yield it as one entry
    - dict of lists/dicts   -> if values look like collections of entries,
                                flatten and yield those instead (handles
                                YAML files shaped like {"SomeTable": [ {...}, {...} ]})
    - anything else         -> skip (not a record-like structure)
    """
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                yield item
            elif isinstance(item, list):
                yield from iter_entries(item)
            # scalars in a top-level list contribute no keys; skip
    elif isinstance(data, dict):
        # Heuristic: if every value is a list of dicts (or a dict itself),
        # treat this as a "table of tables" and recurse into each value.
        # Otherwise treat the dict itself as a single entry.
        looks_like_container = data and all(
            isinstance(v, (list, dict)) for v in data.values()
        )
        if looks_like_container:
            for v in data.values():
                yield from iter_entries(v)
        else:
            yield data
    # other top-level types (scalars, None) contribute nothing


def main():
    if len(sys.argv) < 2:
        print(f"usage: {sys.argv[0]} <yaml_path> [output_path] [--all-types]")
        return

    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    all_types = "--all-types" in flags

    yml_path = Path(args[0])
    output_path = Path(args[1]) if len(args) > 1 else Path(DEFAULT_OUTPUT_PATH)

    if not yml_path.exists():
        print(f"error: input file not found: {yml_path}")
        return

    data = yaml.load(yml_path.read_text(encoding="utf-8"), Loader=TolerantLoader)

    key_types = {}        # key -> first type seen
    key_types_all = {}    # key -> set of all types seen

    for entry in iter_entries(data):
        for key, value in entry.items():
            t = type_name(value)
            if key not in key_types:
                key_types[key] = t
            key_types_all.setdefault(key, set()).add(t)

    if all_types:
        result = {k: ", ".join(sorted(v)) for k, v in sorted(key_types_all.items())}
    else:
        result = dict(sorted(key_types.items()))

    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"wrote {len(result)} keys to {output_path}")


if __name__ == "__main__":
    main()