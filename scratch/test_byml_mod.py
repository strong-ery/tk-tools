import os, sys
from pathlib import Path
import oead

def test_byml_mod():
    # create a simple byml
    byml_dict = {
        "Components": {
            "PhysicsRef": "?Component/Physics/Enemy_Bokoblin_Junior.engine__component__PhysicsParam.bgyml",
            "ActorNameRef": "?ActorSystem/ActorName/Enemy_Bokoblin_Junior.engine__actor__ActorName.bgyml"
        },
        "Category": "Enemy"
    }
    
    # modify it
    def rename_refs(data, old_name, new_name):
        if isinstance(data, dict):
            for k, v in list(data.items()):
                data[k] = rename_refs(v, old_name, new_name)
        elif isinstance(data, list):
            for i, v in enumerate(data):
                data[i] = rename_refs(v, old_name, new_name)
        elif isinstance(data, str):
            if old_name in data:
                return data.replace(old_name, new_name)
        return data

    rename_refs(byml_dict, "Enemy_Bokoblin_Junior", "Enemy_MyCustomBoss")
    
    print("Modified dict:", byml_dict)
    
    # try converting to byml bytes
    byml_bytes = oead.byml.to_binary(byml_dict, big_endian=False, version=7)
    print("Byml bytes len:", len(byml_bytes))

if __name__ == "__main__":
    test_byml_mod()
