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

    # Initialize Schema Registry
    from classes.util.DefinitionUtils import SchemaRegistry
    SchemaRegistry.instance()

    from classes.game.Actor.ActorManager import ActorManager

    try:
        actor_name = "Enemy_Bokoblin_Junior"
        print(f"Loading actor: {actor_name}...")
        actor = ActorManager.LoadActor(actor_name)
        
        print(f"\n--- Loaded Actor: {actor.ID} (Category: {actor.category}) ---")
        print(f"Total Components: {len(actor.components)}\n")
        
        for comp in actor.components:
            print(f"[{comp.name}]")
            for key, value in list(comp.fields.items())[:3]:
                # Print first 3 keys for brevity
                print(f"  {key}: {value}")
            if len(comp.fields) > 3:
                print(f"  ... and {len(comp.fields) - 3} more")
            print()
            
    except FileNotFoundError as e:
        print(f"Error: {e}")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()