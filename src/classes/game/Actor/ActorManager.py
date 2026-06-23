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
    _sarc_cache = {}

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
    def _resolve_parent_chain(archive_bytes: bytes, bgyml_path: str) -> dict:
        """
        Recursively resolves $parent for a bgyml file.
        Returns a merged dictionary of the file's data.
        """
        parsed = IOUtils.ReadBymlFromArchive(archive_bytes, bgyml_path)
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
                parent_data = ActorManager._resolve_parent_chain(parent_archive, parent_internal_path)
                
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
            except FileNotFoundError:
                print(f"Warning: Parent actor pack {parent_row_id} not found. Skipping parent resolution.")
                return data
                
        return data

    @staticmethod
    def _load_component_recursively(archive_bytes: bytes, path: str, comp_name: str, components_list: list):
        try:
            comp_data = ActorManager._resolve_parent_chain(archive_bytes, path)
        except Exception as e:
            # File might not exist in archive if it's a phantom reference or unsupported type
            print(f"Skipping component {comp_name} at {path}: {e}")
            return

        if ActorManager.is_helper_bgyml(comp_data):
            for k, v in comp_data.items():
                if isinstance(v, str) and v.startswith("?"):
                    actual_path = v[1:].replace(".gyml", ".bgyml")
                    ActorManager._load_component_recursively(archive_bytes, actual_path, k, components_list)
        else:
            schema_hint = ComponentSchema(comp_name)
            comp = Component(comp_name, comp_data, schema=schema_hint)
            components_list.append(comp)

    @staticmethod
    def LoadActor(row_id: str) -> Actor:
        row_id = PathUtils.EnsureUniversalRowID(row_id)
        archive_bytes = ActorManager._get_sarc_for_actor(row_id)
        
        engine_path = PathUtils.GetEngineRowIDFromActorRowID(row_id)
        internal_path = engine_path.replace("Work/", "").replace(".gyml", ".bgyml")
        
        root_data = ActorManager._resolve_parent_chain(archive_bytes, internal_path)
        category = root_data.get("Category", "Unknown")
        
        components = []
        if "Components" in root_data:
            for comp_name, comp_path in root_data["Components"].items():
                if isinstance(comp_path, str) and comp_path.startswith("?"):
                    actual_path = comp_path[1:].replace(".gyml", ".bgyml")
                    ActorManager._load_component_recursively(archive_bytes, actual_path, comp_name, components)
                        
        actor = Actor(row_id, category, components)
        return actor
