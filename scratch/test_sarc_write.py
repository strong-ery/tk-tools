import os, sys
from pathlib import Path
import oead

sys.path.insert(0, str(Path(os.getcwd()) / "src"))
from config import Config
from appglobals import appglobals
from classes.util.ZstdUtils import ZstdUtils
from classes.game.Actor.ActorManager import ActorManager

def main():
    config = Config(appglobals.APPDATA_PATH / "config.json")
    ZstdUtils(Path(config.get("romfs_path")) / "Pack" / "ZsDic.pack.zs")

    archive_bytes = ActorManager._get_sarc_for_actor("Enemy_Bokoblin_Junior")
    decompressed = ZstdUtils.instance().decompress(archive_bytes)
    sarc = oead.Sarc(decompressed)
    
    writer = oead.SarcWriter(endian=oead.Endianness.Little)
    
    print("Files in original SARC:")
    for file in sarc.get_files():
        print("  -", file.name)
        # We will just write them to the new SARC to test SarcWriter
        writer.files[file.name] = file.data
        
    print("Writing new SARC...")
    new_sarc_data = writer.write()[1]
    
    print("Compressing new SARC...")
    compressed = ZstdUtils.instance().compress(new_sarc_data)
    
    print("Original size:", len(archive_bytes))
    print("New size:", len(compressed))

if __name__ == "__main__":
    main()
