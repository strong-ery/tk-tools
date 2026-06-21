from classes.util.ZstdUtils import ZstdUtils
from classes.util.ArchiveUtils import ArchiveUtils

def main():
    ZstdUtils(r"D:\ZeldaModding\romfs 121 dump\Pack\ZsDic.pack.zs")

    try:
        result = ArchiveUtils.GetFileFromArchive(r"D:\ZeldaModding\romfs 121 dump\Pack\ZsDic.pack.zs", "zs.zsdic")
        print(result)
    except FileNotFoundError as e:
        print(f"Error: {e}")
main()