import json

class DefinitionUtils:
    @staticmethod
    def GetListFromDataJson(DataName: str) -> list:
        with open(f"src/data/{DataName}.json", "r") as f:
            return json.load(f)