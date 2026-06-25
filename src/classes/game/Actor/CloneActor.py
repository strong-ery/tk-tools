import os
import json
from pathlib import Path
import oead

from classes.game.Actor.ActorManager import ActorManager
from classes.util.ZstdUtils import ZstdUtils

class CloneActor:
    @staticmethod
    def rename_refs(data, old_name: str, new_name: str):
        if isinstance(data, dict):
            for k, v in list(data.items()):
                data[k] = CloneActor.rename_refs(v, old_name, new_name)
        elif isinstance(data, list):
            for i, v in enumerate(data):
                data[i] = CloneActor.rename_refs(v, old_name, new_name)
        elif isinstance(data, str):
            if old_name in data:
                return data.replace(old_name, new_name)
        return data

    @staticmethod
    def clone(old_row_id: str, new_row_id: str, directories_to_rename: list[str], project_name: str) -> str:
        """
        Clones an actor pack, renames specific directories, rewrites internal byml strings,
        and saves it to the output directory.
        Returns the absolute path of the new pack.
        """
        # Always rename Actor directory
        if "Actor" not in directories_to_rename:
            directories_to_rename.append("Actor")
            
        archive_bytes = ActorManager._get_sarc_for_actor(old_row_id)
        decompressed = ZstdUtils.instance().decompress(archive_bytes)
        sarc = oead.Sarc(decompressed)
        
        writer = oead.SarcWriter(endian=oead.Endianness.Little)
        
        for file in sarc.get_files():
            original_path = file.name
            file_data = file.data
            
            # Determine folder of the file
            parts = original_path.split("/")
            folder = parts[0] if len(parts) > 1 else "Root"
            
            new_path = original_path
            if folder in directories_to_rename and old_row_id in original_path:
                new_path = original_path.replace(old_row_id, new_row_id)
                
            if new_path.endswith(".bgyml") or new_path.endswith(".byml"):
                try:
                    # Parse byml, rewrite strings, re-serialize
                    parsed = oead.byml.from_binary(file_data)
                    python_data = ActorManager._byml_to_python(parsed)
                    modified_data = CloneActor.rename_refs(python_data, old_row_id, new_row_id)
                    # Convert to binary. TotK uses v7 for bgyml.
                    new_data = oead.byml.to_binary(modified_data, big_endian=False, version=7)
                    file_data = oead.Bytes(new_data)
                except Exception as e:
                    print(f"Warning: Could not parse or modify {original_path}: {e}")
                    
            writer.files[new_path] = oead.Bytes(bytes(file_data))
            
        new_sarc_data = writer.write()[1]
        compressed = ZstdUtils.instance().compress(new_sarc_data)
        
        # Save to output folder
        output_dir = Path(f"projects/{project_name}/Pack/Actor")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_path = output_dir / f"{new_row_id}.pack.zs"
        output_path.write_bytes(compressed)
        
        # Create RSDB Patch
        rsdb_patch_dir = Path(f"projects/{project_name}/RSDB")
        rsdb_patch_dir.mkdir(parents=True, exist_ok=True)
        
        # We need to fetch the original RSDB data for the actor, rewrite strings, and save it
        actor = ActorManager.LoadActor(old_row_id)
        new_rsdb_data = {}
        
        for table_name, table_row in actor.rsdb.items():
            patched_row = CloneActor.rename_refs(table_row, old_row_id, new_row_id)
            if "__RowId" in patched_row:
                patched_row["__RowId"] = new_row_id
            new_rsdb_data[table_name] = patched_row
            
        rsdb_patch_path = rsdb_patch_dir / f"{new_row_id}_Patch.json"
        with open(rsdb_patch_path, "w", encoding="utf-8") as f:
            json.dump(new_rsdb_data, f, indent=4, ensure_ascii=False)
            
        return str(output_path.absolute())
