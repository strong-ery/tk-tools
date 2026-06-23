import zstandard as zstd
from pathlib import Path
import oead


class ZstdUtils:
    _instance = None

    def __init__(self, zsdic_pack_zs_path: str):
        if ZstdUtils._instance is not None:
            raise RuntimeError(
                "ZstdUtils is already initialized — use ZstdUtils.instance() instead of creating a new one"
            )

        raw = Path(zsdic_pack_zs_path).read_bytes()
        decompressed_data = zstd.ZstdDecompressor().decompress(raw)
        sarc = oead.Sarc(decompressed_data)

        zs_dict_file = oead.Sarc.get_file(sarc, "zs.zsdic")
        pack_dict_file = oead.Sarc.get_file(sarc, "pack.zsdic")
        bcett_dict_file = oead.Sarc.get_file(sarc, "bcett.byml.zsdic")

        zs_dict = zstd.ZstdCompressionDict(
            bytes(zs_dict_file.data), dict_type=zstd.DICT_TYPE_AUTO
        )
        pack_dict = zstd.ZstdCompressionDict(
            bytes(pack_dict_file.data), dict_type=zstd.DICT_TYPE_AUTO
        )
        bcett_dict = zstd.ZstdCompressionDict(
            bytes(bcett_dict_file.data), dict_type=zstd.DICT_TYPE_AUTO
        )

        self._named = [
            ("pack", zstd.ZstdDecompressor(dict_data=pack_dict)),
            ("bcett", zstd.ZstdDecompressor(dict_data=bcett_dict)),
            ("zs", zstd.ZstdDecompressor(dict_data=zs_dict)),
            ("none", zstd.ZstdDecompressor()),
        ]

        print("zs_dict id:", zs_dict.dict_id())
        print("pack_dict id:", pack_dict.dict_id())
        print("bcett_dict id:", bcett_dict.dict_id())

        ZstdUtils._instance = self

    @classmethod
    def instance(cls) -> "ZstdUtils":
        if cls._instance is None:
            raise RuntimeError(
                "ZstdUtils has not been initialized yet — call ZstdUtils(path) once at startup first"
            )
        return cls._instance

    def decompress(self, data: bytes, filename: str = "") -> bytes:
        try:
            frame_dict_id = zstd.get_frame_parameters(data).dict_id
        except zstd.ZstdError as e:
            frame_dict_id = None
            print(f"{filename}: could not read frame params: {e}")

        print(f"{filename}: frame wants dict_id={frame_dict_id}, size={len(data)}")

        last_err = None
        for label, dctx in self._named:
            try:
                result = dctx.decompress(data)
                print(f"{filename}: succeeded with '{label}' dict")
                return result
            except zstd.ZstdError as e:
                print(f"{filename}: '{label}' dict failed: {e}")
                last_err = e
                continue

        raise last_err