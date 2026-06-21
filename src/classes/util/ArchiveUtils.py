from pathlib import Path
import oead
from .ZstdUtils import ZstdUtils

class ArchiveUtils:
    @staticmethod
    def GetFileFromArchive(archive, filename: str) -> bytes:
        if isinstance(archive, (str, Path)):
            archive = Path(archive).read_bytes()
        decompressed = oead.Bytes(ZstdUtils.instance().decompress(archive))
        sarc = oead.Sarc(decompressed)
        file = oead.Sarc.get_file(sarc, filename)
        if file is None:
            raise FileNotFoundError(f"File '{filename}' not found in archive")
        return bytes(file.data)