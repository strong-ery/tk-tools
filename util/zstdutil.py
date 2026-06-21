import oead
import zstandard as zstd
from pathlib import Path


class ZsDicts:
    def __init__(self, zsdic_pack_zs_path: str):
        raw = Path(zsdic_pack_zs_path).read_bytes()
        sarc_bytes = zstd.ZstdDecompressor().decompress(raw)
        sarc = oead.Sarc(sarc_bytes)

        print("files in ZsDic.pack.zs:", [f.name for f in sarc.get_files()])

        zs_dict = zstd.ZstdCompressionDict(
            bytes(sarc.get_file("zs.zsdic").data), dict_type=zstd.DICT_TYPE_RAWCONTENT
        )
        pack_dict = zstd.ZstdCompressionDict(
            bytes(sarc.get_file("pack.zsdic").data), dict_type=zstd.DICT_TYPE_RAWCONTENT
        )
        bcett_dict = zstd.ZstdCompressionDict(
            bytes(sarc.get_file("bcett.byml.zsdic").data), dict_type=zstd.DICT_TYPE_RAWCONTENT
        )

        print("zs dict: id=%s size=%d" % (zs_dict.dict_id(), zs_dict.as_bytes().__len__()))
        print("pack dict: id=%s size=%d" % (pack_dict.dict_id(), pack_dict.as_bytes().__len__()))
        print("bcett dict: id=%s size=%d" % (bcett_dict.dict_id(), bcett_dict.as_bytes().__len__()))

        self._named = [
            ("pack", zstd.ZstdDecompressor(dict_data=pack_dict)),
            ("bcett", zstd.ZstdDecompressor(dict_data=bcett_dict)),
            ("zs", zstd.ZstdDecompressor(dict_data=zs_dict)),
            ("none", zstd.ZstdDecompressor()),
        ]

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