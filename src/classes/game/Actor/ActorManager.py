from pathlib import Path
from config import Config
from classes.util.ArchiveUtils import ArchiveUtils
from classes.util.IOUtils import IOUtils
from classes.util.PathUtils import PathUtils
from classes.util.DefinitionUtils import SchemaRegistry
from .Actor import Actor
from .Component import Component, ComponentSchema
from .DataEntry import DataEntry
from .ReferenceEntry import ReferenceEntry
import oead

class ActorManager:
    _actor_cache: dict[str, Actor] = {}
    _sarc_cache = {}
    _rsdb_cache: dict[str, dict[str, dict]] = {} # schema_name -> { row_id -> data }
    _fallback_archives_cache: Optional[list[bytes]] = None

    @staticmethod
    def _get_fallback_archives() -> list[bytes]:
        if ActorManager._fallback_archives_cache is None:
            ActorManager._fallback_archives_cache = []
            romfs_path = Path(Config.instance().get("romfs_path"))
            
            # List of known fallback archives
            fallbacks = [
                "ResidentCommon.pack.zs",
                "Bootup.Nin_NX_NVN.pack.zs",
                "AI.Global.Product.120.pack.zs"
            ]
            
            for pack_name in fallbacks:
                pack_path = romfs_path / "Pack" / pack_name
                if pack_path.exists():
                    ActorManager._fallback_archives_cache.append(pack_path.read_bytes())
        
        return ActorManager._fallback_archives_cache

    @staticmethod
    def _get_sarc_for_actor(row_id: str) -> bytes:
        if row_id in ActorManager._sarc_cache:
            return ActorManager._sarc_cache[row_id]
        
        romfs_path = Path(Config.instance().get("romfs_path"))
        pack_path = romfs_path / "Pack" / "Actor" / f"{row_id}.pack.zs"
        if not pack_path.exists():
            raise FileNotFoundError(f"Actor pack not found at {pack_path}")
        
        data = pack_path.read_bytes()
        ActorManager._sarc_cache[row_id] = data
        return data

    @staticmethod
    def is_helper_bgyml(parsed_data: dict) -> bool:
        """
        If all values are `?`-prefixed strings (excluding keys like $parent or Category),
        then it's a Helper bgyml manifest.
        """
        for k, v in parsed_data.items():
            if k in ["$parent", "Category"]:
                continue
            if not isinstance(v, str) or not v.startswith("?"):
                return False
        return True

    @staticmethod
    def _byml_to_python(obj):
        if hasattr(obj, 'items'):
            return {str(k): ActorManager._byml_to_python(v) for k, v in obj.items()}
        elif hasattr(obj, '__iter__') and not isinstance(obj, (str, bytes, bytearray)):
            return [ActorManager._byml_to_python(v) for v in obj]
        else:
            if isinstance(obj, (int, float, str, bool, type(None))):
                return obj
            elif isinstance(obj, (bytes, bytearray)):
                return list(obj)
            else:
                return str(obj)

    @staticmethod
    def _resolve_parent_chain(archive_bytes: bytes, bgyml_path: str, parent_refs_out: list = None) -> dict:
        """
        Recursively resolves $parent for a bgyml file.
        Returns a merged dictionary of the file's data.
        """
        current_path = bgyml_path
        
        # We don't want to load from archive_bytes if it's pointing to another file
        bgyml_path = current_path
        if current_path.startswith("?"):
            bgyml_path = current_path[1:]
            
        try:
            parsed = IOUtils.ReadBymlFromArchive(archive_bytes, bgyml_path)
        except FileNotFoundError:
            found = False
            for rc_bytes in ActorManager._get_fallback_archives():
                try:
                    parsed = IOUtils.ReadBymlFromArchive(rc_bytes, bgyml_path)
                    found = True
                    break
                except FileNotFoundError:
                    continue
            
            if not found:
                raise FileNotFoundError(f"File '{bgyml_path}' not found in archive or any fallback packs.")
        data = ActorManager._byml_to_python(parsed)

        if isinstance(data, dict) and "$parent" in data:
            parent_path = data["$parent"]
            
            # parent_path is typically something like Work/Actor/Enemy.gyml
            # We assume the filename itself indicates the row ID (e.g. Enemy.engine__actor__...)
            parent_filename = parent_path.split("/")[-1]
            parent_row_id = parent_filename.split(".")[0]
            
            try:
                parent_archive = ActorManager._get_sarc_for_actor(parent_row_id)
                parent_internal_path = parent_path.replace("Work/", "").replace(".gyml", ".bgyml")
                parent_data = ActorManager._resolve_parent_chain(parent_archive, parent_internal_path, parent_refs_out)
            except FileNotFoundError:
                # If actor pack doesn't exist, it might be in ResidentCommon or fallbacks
                parent_internal_path = parent_path.replace("Work/", "").replace(".gyml", ".bgyml")
                
                # We can just call _resolve_parent_chain with archive_bytes=b"" because it falls back inside
                # But wait, we need to pass a valid byte string if we don't know it. We can just pass the first fallback pack.
                # Actually, the fallback logic is ALREADY inside _resolve_parent_chain!
                # If we pass an empty bytes object, it'll raise FileNotFoundError and then try fallbacks.
                try:
                    parent_data = ActorManager._resolve_parent_chain(b"", parent_internal_path, parent_refs_out)
                except FileNotFoundError:
                    print(f"Warning: Parent reference {parent_path} not found in any packs. Skipping.")
                    return data
            
            if parent_refs_out is not None:
                parts = parent_internal_path.split("/")
                folder = parts[0] if len(parts) > 1 else "Root"
                comp_name = parent_filename.replace(".engine__component__", "").replace(".game__component__", "").replace(".phive__", "").replace(".engine__actor__", "").replace(".gyml", "").replace(".bgyml", "")
                
                if not any(c.name == comp_name and c.isParentRef for c in parent_refs_out):
                    comp = Component(comp_name, parent_data, folder=folder, isNative=False, isParentRef=True)
                    parent_refs_out.append(comp)
            
            # Merge logic: child overrides parent
            merged = parent_data.copy()
            
            # ActorParam special case: merge the nested "Components" dict
            if "Components" in parent_data and "Components" in data:
                merged["Components"] = parent_data["Components"].copy()
                merged["Components"].update(data["Components"])
                for k, v in data.items():
                    if k != "Components":
                        merged[k] = v
            else:
                merged.update(data)
            return merged
                
        return data

    @staticmethod
    def _load_component_recursively(archive_bytes: bytes, path: str, comp_name: str, components_list: list, sarc, parent_refs_out: list):
        try:
            comp_data = ActorManager._resolve_parent_chain(archive_bytes, path, parent_refs_out)
        except FileNotFoundError as e:
            found = False
            for rc_bytes in ActorManager._get_fallback_archives():
                try:
                    parsed = IOUtils.ReadBymlFromArchive(rc_bytes, path)
                    comp_data = ActorManager._byml_to_python(parsed)
                    found = True
                    break
                except FileNotFoundError:
                    continue
            
            if not found:
                print(f"Skipping component {comp_name} at {path}: {e}")
                return None
        except Exception as e:
            print(f"Skipping component {comp_name} at {path}: {e}")
            return

        if ActorManager.is_helper_bgyml(comp_data):
            for k, v in comp_data.items():
                if isinstance(v, str) and v.startswith("?"):
                    actual_path = v[1:].replace(".gyml", ".bgyml")
                    ActorManager._load_component_recursively(archive_bytes, actual_path, k, components_list, sarc, parent_refs_out)
        else:
            isNative = (sarc.get_file(path) is not None)
            schema_hint = ComponentSchema(comp_name)
            comp = Component(comp_name, comp_data, schema=schema_hint, isNative=isNative)
            components_list.append(comp)

    @staticmethod
    def LoadActor(row_id: str) -> Actor:
        row_id = PathUtils.EnsureUniversalRowID(row_id)
        archive_bytes = ActorManager._get_sarc_for_actor(row_id)
        import oead
        from classes.util.ZstdUtils import ZstdUtils
        sarc_data = ZstdUtils.instance().decompress(archive_bytes)
        sarc = oead.Sarc(sarc_data)
        
        engine_path = PathUtils.GetEngineRowIDFromActorRowID(row_id)
        internal_path = engine_path.replace("Work/", "").replace(".gyml", ".bgyml")
        
        parent_refs = []
        root_data = ActorManager._resolve_parent_chain(archive_bytes, internal_path, parent_refs)
        category = root_data.get("Category", "Unknown")
        
        components = []
        if "Components" in root_data:
            for comp_name, comp_path in root_data["Components"].items():
                if isinstance(comp_path, str) and comp_path.startswith("?"):
                    actual_path = comp_path[1:].replace(".gyml", ".bgyml")
                    ActorManager._load_component_recursively(archive_bytes, actual_path, comp_name, components, sarc, parent_refs)
                        
        rsdb_data = {}
        data_dir = Path(__file__).parent.parent.parent.parent / "data" # tk-tools/src/data
        romfs_path = Path(Config.instance().get("romfs_path"))
        
        if data_dir.exists():
            for json_file in data_dir.glob("*.json"):
                table_name = json_file.name.replace("Types.json", "").replace(".json", "")
                
                # Check cache
                if table_name not in ActorManager._rsdb_cache:
                    rsdb_file = romfs_path / "RSDB" / f"{table_name}.Product.121.rstbl.byml.zs"
                    if rsdb_file.exists():
                        try:
                            from classes.util.ZstdUtils import ZstdUtils
                            decomp = ZstdUtils.instance().decompress(rsdb_file.read_bytes())
                            parsed_rsdb = oead.byml.from_binary(decomp)
                            parsed_python = ActorManager._byml_to_python(parsed_rsdb)
                            ActorManager._rsdb_cache[table_name] = parsed_python
                        except Exception as e:
                            print(f"Failed to load RSDB {table_name}: {e}")
                            ActorManager._rsdb_cache[table_name] = None
                    else:
                        ActorManager._rsdb_cache[table_name] = None
                        
                table_data = ActorManager._rsdb_cache[table_name]
                if isinstance(table_data, list):
                    row = next((x for x in table_data if isinstance(x, dict) and x.get("__RowId") == row_id), None)
                    if row:
                        rsdb_data[table_name] = row
                elif isinstance(table_data, dict):
                    if row_id in table_data:
                        rsdb_data[table_name] = table_data[row_id]

        # Load implicitly present files from SARC pack
        try:
            for file in sarc.get_files():
                path = file.name
                if not path.endswith(".bgyml"): continue
                
                parts = path.split('/')
                folder = parts[0] if len(parts) > 1 else "Root"
                file_name = parts[-1].replace(".engine__component__", "").replace(".game__component__", "").replace(".phive__", "").replace(".bgyml", "")
                
                if any(c.name == file_name for c in components): continue
                
                try:
                    import oead.byml
                    file_byml = oead.byml.from_binary(file.data)
                    file_data = ActorManager._byml_to_python(file_byml)
                    components.append(Component(file_name, file_data, folder=folder))
                except Exception as e:
                    print(f"Skipping implicit file {path}: {e}")
        except Exception as e:
            print(f"Error reading explicit files from SARC: {e}")

        # Add collected parent refs
        for pr in parent_refs:
            if not any(c.name == pr.name for c in components):
                components.append(pr)

        actor = Actor(row_id, category, components, rsdb_data)
        ActorManager._actor_cache[row_id] = actor
        return actor
