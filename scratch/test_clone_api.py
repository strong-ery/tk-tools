import requests

def test():
    req = {
        "old_row_id": "Enemy_Bokoblin_Junior",
        "new_row_id": "Enemy_MyCustomBoss",
        "directories_to_rename": ["Actor", "Component/PhysicsParam", "ActorSystem/ActorName"]
    }
    
    print("Testing directories endpoint...")
    r1 = requests.get("http://127.0.0.1:8123/api/actor/Enemy_Bokoblin_Junior/directories")
    print("Directories response:", r1.status_code, r1.json())
    
    print("\nTesting clone endpoint...")
    r2 = requests.post("http://127.0.0.1:8123/api/actor/clone", json=req)
    print("Clone response:", r2.status_code, r2.json())

if __name__ == "__main__":
    test()
