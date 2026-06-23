from config import Config
from appglobals import appglobals
from pathlib import Path

class PathUtils:
    
    @staticmethod
    def GetActorRowIDFromEngineRowID(EngineRowID: str) -> str:
        return EngineRowID.removeprefix("Work/Actor/").removesuffix(".engine__actor__ActorParam.gyml")

    @staticmethod
    def GetEngineRowIDFromActorRowID(ActorRowID: str) -> str:
        result = "Work/Actor/" + ActorRowID + ".engine__actor__ActorParam.gyml"
        return result
    
    @staticmethod
    def IsUniversalRowID(RowID: str) -> bool:
        return "/" not in RowID and not RowID.endswith(".gyml")
    
    @staticmethod
    def EnsureUniversalRowID(RowID: str) -> str:
        if PathUtils.IsUniversalRowID(RowID):
            return RowID
        return PathUtils.GetActorRowIDFromEngineRowID(RowID)
    
    @staticmethod
    def IsInsideRomfsPath(path):
        romfs_path = Path(Config.instance().get("romfs_path"))
        return romfs_path in Path(path).parents