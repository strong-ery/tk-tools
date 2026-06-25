import json
from pathlib import Path
from typing import Optional, Dict, Any

class ComponentInfoRegistry:
    _instance = None

    def __init__(self):
        if ComponentInfoRegistry._instance is not None:
            raise RuntimeError(
                "ComponentInfoRegistry is already initialized — use ComponentInfoRegistry.instance() instead of creating a new one"
            )
        
        # info_cache structure: { folder: [ { info_dict }, ... ] }
        self.info_cache: Dict[str, list[dict[str, Any]]] = {}
        
        info_dir = Path("src/data/info")
        if info_dir.exists() and info_dir.is_dir():
            for json_file in info_dir.rglob("*.json"):
                # The parent directory of the JSON file is the 'folder'
                folder_name = json_file.parent.name
                if folder_name not in self.info_cache:
                    self.info_cache[folder_name] = []
                    
                try:
                    with open(json_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if isinstance(data, dict):
                            # Ensure the filename base is injected into the data so we know what it is
                            if "FileName" not in data:
                                data["FileName"] = json_file.stem
                            self.info_cache[folder_name].append(data)
                except Exception as e:
                    print(f"Failed to load component info {json_file}: {e}")

    @classmethod
    def instance(cls) -> "ComponentInfoRegistry":
        if cls._instance is None:
            cls._instance = ComponentInfoRegistry()
        return cls._instance

    def get_info(self, folder: str, comp_name: str) -> Optional[dict[str, Any]]:
        if folder not in self.info_cache:
            return None
            
        candidates = self.info_cache[folder]
        for info in candidates:
            target_name = info.get("FileName", "")
            match_type = info.get("MatchType", "Exact")
            
            if match_type == "Exact":
                if comp_name == target_name:
                    return info
            elif match_type == "Partial":
                if target_name in comp_name:
                    return info
                    
        return None
