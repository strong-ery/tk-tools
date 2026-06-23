import json
from pathlib import Path
from typing import Optional

class SchemaRegistry:
    _instance = None

    def __init__(self):
        if SchemaRegistry._instance is not None:
            raise RuntimeError(
                "SchemaRegistry is already initialized — use SchemaRegistry.instance() instead of creating a new one"
            )
        
        self.schemas = {}
        data_dir = Path("src/data")
        if data_dir.exists():
            for type_file in data_dir.glob("*Types.json"):
                with open(type_file, "r") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        self.schemas.update(data)

    @classmethod
    def instance(cls):
        if cls._instance is None:
            cls._instance = SchemaRegistry()
        return cls._instance

    def get_type(self, field_name: str) -> Optional[str]:
        return self.schemas.get(field_name)

class DefinitionUtils:
    @staticmethod
    def GetListFromDataJson(DataName: str) -> list:
        with open(f"src/data/{DataName}.json", "r") as f:
            return json.load(f)
            
    @staticmethod
    def GetDictFromDataJson(DataName: str) -> dict:
        with open(f"src/data/{DataName}.json", "r") as f:
            return json.load(f)