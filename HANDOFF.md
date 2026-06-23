# tk-tools — Project Handoff Document

## Project Overview

**tk-tools** is a modding tool for *The Legend of Zelda: Tears of the Kingdom* that allows users to load, edit, clone, and create actor files. The tool abstracts away Nintendo's internal engine file layout so modders think in terms of actor components and properties, not raw RSDB tables and SARC archives.

The tool is being written in **Python** (backend/data layer) with a **React** frontend (planned, not yet started). The UI concept is Unity Inspector-style component panels, potentially using **React Flow** as the canvas library for pan/zoom/drag layout. Output format is **TKCL** (Tears of the Kingdom ChangeLog) — a zip file containing JSON changelogs — which is already supported by **TKMM** (the community mod manager, which the developer cofounded). This means no custom delta format needs to be designed.

---

## Repository Structure (current)

```
src/
├── main.py                        # Entry point
├── appglobals.py                  # APPDATA_PATH constant
├── config.py                      # Config singleton
├── classes/
│   └── util/
│       ├── ZstdUtils.py           # Zstd decompression singleton
│       ├── ArchiveUtils.py        # SARC reading utilities
│       ├── PathUtils.py           # Path/RowID conversion utilities
│       └── IOUtils.py             # BYML read/write utilities (in progress)
└── data/                          # JSON schema files (described below)
```

---

## Key Concepts

### TotK File Formats

**SARC archives** (`.pack.zs`) — ZIP-like container format. Actor data lives at `Pack/Actor/{ActorID}.pack.zs` in the romfs dump. Internally, a pack contains a folder tree of `.bgyml` files. Opened with `oead.Sarc`.

**BYML / BGYML** — Binary YAML format used for all parameter files. Parsed with `oead.byml.from_binary(bytes)` → returns `oead.byml.Hash` (dict-like) or `oead.byml.Array`. The `.bgyml` extension is just a naming convention — same binary format as `.byml`.

**Zstandard compression** — All `.pack.zs` files are zstd-compressed. TotK uses three custom dictionaries stored in `Pack/ZsDic.pack.zs`:
- `zs.zsdic` (dict_id=1)
- `bcett.byml.zsdic` (dict_id=2)
- `pack.zsdic` (dict_id=3)

**CRITICAL**: Dictionaries must be loaded with `dict_type=zstd.DICT_TYPE_AUTO`, NOT `DICT_TYPE_RAWCONTENT`. Using `RAWCONTENT` causes `Dictionary mismatch` errors even when the correct dictionary is selected, because it bypasses the structured dictionary header.

**RSDB tables** (`.rstbl.byml`) — Relational database tables in BYML format, one per actor-info category. These define properties of actors at a higher level than the pack files. The tool's goal is to abstract these away from the modder entirely.

**MALS / MSBT** — Localization files. `ActorMsg` is the relevant category. English locale only for V1 (`USen`). Other locales stubbed via `Config`.

**TKCL** — Tears of the Kingdom ChangeLog. Zip file containing JSON changelogs. Already supports row-level RSDB changes. Output format for this tool. Supported natively by TKMM.

---

## Actor Structure

An actor pack's internal folder structure contains `.bgyml` files that are either:

- **Helper bgyml**: All values are `?`-prefixed path strings pointing to other bgyml files. These are reference manifests — load what they point to, don't show them in the UI.
- **Data bgyml**: Contains actual parameter key-value pairs (e.g. `MaxLife: 500`). These become `Component` objects.
- **Hybrid** (rare/unconfirmed): Mixed `?`-prefixed and raw values. Handle with `NotImplementedError` to surface for investigation rather than silently misrepresenting.

Detection logic: if every value in a parsed bgyml is a `?`-prefixed string → Helper. Otherwise → Data.

### `$parent` Inheritance

Actor param files can contain a `$parent` key pointing to another actor's engine path:
```
$parent: Work/Actor/Obj_Zonau_RockRelief_A_02.engine__actor__ActorParam.gyml
```

This means the current actor inherits all components from the parent and only overrides what it explicitly re-declares. The resolver must:
1. Walk the chain recursively until hitting an actor with no `$parent`
2. Merge component dicts bottom-up (root first, child overrides)
3. Cache resolved packs to avoid re-opening the same archive multiple times

### Row ID Formats

Two formats exist for actor identifiers:

- **Universal/bare**: `Enemy_Bokoblin_Junior` — used internally by the tool everywhere
- **Engine path**: `Work/Actor/Enemy_Bokoblin_Junior.engine__actor__ActorParam.gyml` — used in BYML files

Pack path on disk: `Pack/Actor/Enemy_Bokoblin_Junior.pack.zs`

`PathUtils.EnsureUniversalRowID()` normalizes any format to bare on the way in.

---

## Implemented Utilities

### `ZstdUtils` (singleton)
```python
ZstdUtils(zsdic_pack_zs_path)   # Initialize once at startup
ZstdUtils.instance()             # Retrieve singleton from anywhere
ZstdUtils.instance().decompress(data: bytes, filename: str) -> bytes
```
Loads three dictionaries from `ZsDic.pack.zs` at init. Tries each dictionary in order (`pack`, `bcett`, `zs`, `none`) until decompression succeeds.

### `ArchiveUtils` (static)
```python
ArchiveUtils.GetFileFromArchive(archive, filename: str) -> bytes
ArchiveUtils.GetAllFilesFromArchive(archive) -> dict[str, bytes]
ArchiveUtils.GetArchiveContentsAsList(archive) -> list[str]
```
`archive` parameter accepts either a file path (`str` or `Path`) or raw bytes. Raises `FileNotFoundError` (not `None`) when a file is missing.

### `PathUtils` (static)
```python
PathUtils.GetActorRowIDFromEngineRowID(EngineRowID: str) -> str
PathUtils.GetEngineRowIDFromActorRowID(ActorRowID: str) -> str
PathUtils.IsUniversalRowID(RowID: str) -> bool
PathUtils.EnsureUniversalRowID(RowID: str) -> str
PathUtils.IsInsideRomfsPath(path) -> bool   # Guard against writing to game dump
```

### `IOUtils` (static, in progress)
```python
IOUtils.ReadByml(path) -> oead.byml.Hash
IOUtils.ReadBymlFromArchive(archive, path) -> oead.byml.Hash
IOUtils.WriteByml(path, data)               # TODO
IOUtils.WriteBymlToArchive(archive, path, data)  # TODO
```
Both Read methods validate file extension against `DefinitionUtils.GetListFromDataJson("BymlExtensions")` before parsing.

### `Config` (singleton)
```python
Config(config_path)              # Initialize once at startup
Config.instance()                # Retrieve from anywhere
config.get(key, default=None)
config.set(key, value)
config.was_just_created: bool    # True if config.json didn't exist and was just generated
```
Default config: `{"romfs_path": "C:/romfs"}`. Creates default and sets `was_just_created = True` if missing. `main.py` checks this flag and exits early, prompting the user to edit the config.

---

## Data JSON Files

Located in `data/` (or similar). Loaded at startup by `DefinitionUtils`. Drive the schema registry, UI widget types, and validation.

| File | Shape | Purpose |
|------|-------|---------|
| `ActorInfoTypes.json` | `{key: type_str}` | Field types for `ActorInfo` RSDB table |
| `GameActorInfoTypes.json` | `{key: type_str}` | Field types for `GameActorInfo` RSDB table |
| `PouchActorInfoTypes.json` | `{key: type_str}` | Field types for `PouchActorInfo` RSDB table |
| `AttachmentActorInfoTypes.json` | `{key: type_str}` | Field types for `AttachmentActorInfo` table |
| `EnhancementMaterialInfoTypes.json` | `{key: type_str}` | Field types for enhancement/crafting table |
| `ActorCategories.json` | `[str]` | Valid actor category values |
| `TagProductTypes.json` | `[str]` | All valid actor tags (357 entries) |
| `ActorMsgTypes.json` | `{filename: {suffix: description}}` | MALS/MSBT localization key patterns |

Type strings in `*Types.json` files: `"str"`, `"int"`, `"float"`, `"bool"`, `"list"`, `"dict"`.

`"list"` and `"dict"` fields get their own custom handler classes — they are NOT generically handled by the schema system. Known examples:
- `ReplaceModelResourceHash`: list of `!ul`-tagged uint64 hashes
- `Items` (EnhancementMaterialInfo): list of `{Actor, Number}` dicts
- `CaptionOptionCondition`: list, shape TBD
- `ModelAabbMax/Min`, `DebugModelScale`, `SpecialPartsCreateRot`: dict → likely `Vector3`

### Type → UI Widget Mapping (planned, not yet built)
- `bool` → checkbox
- `int` / `float` → numeric input
- `str` (open) → text input
- `str` (closed set of known values) → dropdown, sourced from aggregate value sampling
- `list` / `dict` → custom handler / raw editor fallback

---

## MALS / Localization Schema

`ActorMsg` category only for V1. English (`USen`) only. Other languages stubbed via `Config`.

Key pattern per file: `{ActorRowID}{Suffix}` where suffix is file-specific:

| File | Suffixes |
|------|---------|
| `Attachment.msbt` | `_Adjective`, `_Name` |
| `AutoBuilderDraft.msbt` | `_Name` |
| `Boss.msbt` | `_Name` |
| `CharaDirectory.msbt` | `_Name`, `_Alias`, `_Caption`, `_InstantTips` |
| `Horse.msbt` | `_Name` |
| `LinkHouse.msbt` | `_Caption`, `_Name` |
| `Npc.msbt` | `_Name` |
| `PictureBook.msbt` | `_Caption`, `_Name` |
| `PouchContent.msbt` | `_Caption`, `_Name`, `_BaseName` |
| `SheikahCameraTarget.msbt` | `_Name` |

`Nickname.msbt` — explicitly not supported in V1.

---

## Class Architecture (current + planned)

### Implemented
- `RSDB` — base class, `__init__(self, RowID)`
- `AttachmentActorInfo(RSDB)` — holds `AAIKeyValuePairs` dict (placeholder)

### Planned
```
Actor
├── row_id: str                    # Universal format (bare actor name)
├── category: str                  # From ActorCategories.json
├── components: list[Component]
└── was_parent_resolved: bool

Component
├── name: str                      # e.g. "ModelInfoRef"
├── fields: dict[str, Any]         # Parsed bgyml key-value data
└── schema: ComponentSchema | None # None = unknown, use raw editor

ReferenceEntry                     # Unresolved ?-path reference
└── path: str

DataEntry                          # A single typed field inside a Component
├── key: str
├── value: Any
└── type_hint: str                 # From schema registry
```

---

## LoadActor — Planned Implementation

```
LoadActor(pack_path: str | Path) -> Actor:
  1. GetArchiveContentsAsList → flat list of internal paths
  2. Group paths into directory structure (split on "/")
  3. Identify and parse root ActorParam bgyml
  4. Check for $parent → resolve chain recursively, merge Components dicts
  5. For each resolved component reference:
     a. Strip "?" prefix
     b. ReadBymlFromArchive → parsed bgyml
     c. Detect Helper vs Data (all values "?"-prefixed = Helper)
     d. Helper → resolve its references recursively, don't expose in UI
     e. Data → create Component object with fields dict
  6. Look up schema for each Component from registry
  7. Return Actor with full component list
```

**New actor** (empty SARC): `Actor.New(row_id, category)` — creates empty `Actor` directly, bypasses file loading. No separate code path needed in `LoadActor`.

---

## Design Decisions Locked In

- **Singletons**: `ZstdUtils`, `Config` (and planned: schema registry). Pattern: `_instance` class var + `instance()` classmethod + RuntimeError guard in `__init__` against double-init.
- **No writing to romfs dump**: `PathUtils.IsInsideRomfsPath(path)` guard on all write operations. Checks `Config.instance().get("romfs_path")` against `path.parents`.
- **Universal RowID internally**: All `Actor` objects hold bare row IDs. Engine path format only at BYML read/write boundaries.
- **`oead.byml.Hash` as interchange**: Components hold plain Python dicts internally. BYML layer only touched at read (deserialize) and write (serialize) time.
- **DICT_TYPE_AUTO for zstd dicts**: Not RAWCONTENT. This was a confirmed bug — RAWCONTENT causes Dictionary mismatch even with the correct dictionary.
- **Field-level TKCL deltas**: Not whole-row replace. Only actual changes go in the changelog.
- **No recursion into `list`/`dict` fields in schema dumper**: These get custom handler classes. The type dumper correctly reports `"list"` or `"dict"` as the type; the internal structure is handled per-field by purpose-built code.
- **Two UI modes**:
  - **Guided**: Schema-driven, typed widgets, constrained inputs, only allows valid values
  - **Advanced**: Raw key-value editor, "I understand this might break things" gate, unrestricted
- **Clone template**: Defines which fields need user input during a clone operation (beyond the mandatory pack filename + ActorNameRef + RSDB RowID rename that always happens). Templates are separate JSON files, not part of the main config.

---

## Tooling & Dependencies

- **Python 3.12+** (currently testing on 3.14)
- **oead** — community TotK/BotW format library (SARC + BYML). C++ with Python bindings. Must be on a version compatible with Python 3.12+.
- **zstandard** — Python zstd library
- **pathlib.Path** — used throughout for path manipulation
- React + React Flow — planned frontend (not started)

### Known `oead` Notes
- `oead.Sarc` is **read-only**. Use `oead.SarcWriter.from_sarc(sarc)` to get a writable copy.
- `oead.byml.Hash` is **not** a plain Python `dict`. Use `dict(parsed)` to convert. `.keys()`, `.items()`, `[]` access all work.
- `oead.File` has `.name` (str) and `.data` (memoryview) attributes. Wrap `.data` in `bytes()` to get raw bytes.
- `oead.Sarc.get_file(sarc, name)` returns `Optional[oead.File]` — check for `None`, it does NOT raise.
- `!ul`-tagged YAML values (unsigned 64-bit ints) require a custom PyYAML constructor. Use `TolerantLoader` (already built in `ExtractKeys.py`) that registers a catch-all constructor for unknown tags and resolves scalars via the standard implicit resolver so `!ul 12345` becomes a Python `int`, not a string.

---

## Scripts (Separate Utility Scripts, Not Part of Main Tool)

| Script | Purpose |
|--------|---------|
| `ExtractKeys.py` | Dumps `{key: type}` JSON from any RSDB YAML table. Usage: `python ExtractKeys.py <yaml> [output.json] [--all-types]` |
| `dump_taglist.py` | Dumps `Tag.Product` flat string array to JSON. Usage: `python dump_taglist.py <yaml> [output.json]` |

---

## What's Next (Immediate)

1. **Finish `IOUtils`** — `WriteByml` and `WriteBymlToArchive` (lower priority, reading works)
2. **`LoadActor` implementation** — see planned implementation above
3. **Helper vs Data detection** — programmatic, based on whether all bgyml values are `?`-prefixed
4. **`$parent` resolver** — recursive, with merge logic (child wins on key collision)
5. **Component + DataEntry classes** — data model for parsed actor components
6. **Schema registry** — loads all `*Types.json` at init, maps field names to types and UI widget hints
7. **`DefinitionUtils`** — referenced but not yet implemented, loads data JSON files

---

## What's Explicitly Out of Scope for V1

- Actor effect previewing
- Multi-language MALS support (stub only)
- `Nickname.msbt` support
- Optimization / caching of SARC reads
- The React UI layer
- TKCL export
- Clone templates
- romfs-write guard enforcement (guard function exists, not yet wired into write methods)
