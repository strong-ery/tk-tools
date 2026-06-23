from .ArchiveUtils import ArchiveUtils
from .PathUtils import PathUtils
from pathlib import Path
from .DefinitionUtils import DefinitionUtils
import oead

class IOUtils:
    @staticmethod
    def ReadByml(path):
        bymlExtensions = DefinitionUtils.GetListFromDataJson("BymlExtensions")
        if not any(str(path).endswith(ext) for ext in bymlExtensions):
            raise ValueError(f"File '{path}' does not have a valid Byml extension")
        
        data = Path(path).read_bytes()
        byml = oead.byml.from_binary(data)

        return byml

    @staticmethod
    def ReadBymlFromArchive(archive, path):
        bymlExtensions = DefinitionUtils.GetListFromDataJson("BymlExtensions")
        if not any(str(path).endswith(ext) for ext in bymlExtensions):
            raise ValueError(f"File '{path}' does not have a valid Byml extension")
        
        data = ArchiveUtils.GetFileFromArchive(archive, path)
        byml = oead.byml.from_binary(data)

        return byml


    #@staticmethod
    #def WriteByml(path, data):
    #    if not PathUtils.IsInsideRomfsPath(path):
            # do stuff

    #@staticmethod
    #def WriteBymlToArchive(archive, path, data):
    #    if not PathUtils.IsInsideRomfsPath(Path(archive)):
            # do stuff