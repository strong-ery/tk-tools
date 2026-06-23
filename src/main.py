from classes.util.ZstdUtils import ZstdUtils
from classes.util.ArchiveUtils import ArchiveUtils
from config import Config
import json
from pathlib import Path
from appglobals import appglobals

def main():
    config = Config(appglobals.APPDATA_PATH / "config.json")
    if config.was_just_created:
        print("Default config created. Please edit config.json with the correct paths and restart the program.")
        return

    ZstdUtils(Path(config.get("romfs_path")) / "Pack" / "ZsDic.pack.zs")

    try:
        result = ArchiveUtils.GetArchiveContentsAsList(Path(config.get("romfs_path")) / "Pack" / "Actor" / "Enemy_Bokoblin_Junior.pack.zs")
        print(result)
    except FileNotFoundError as e:
        print(f"Error: {e}")
main()