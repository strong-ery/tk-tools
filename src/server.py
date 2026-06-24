import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from appglobals import appglobals
from config import Config
from classes.util.ZstdUtils import ZstdUtils
from classes.util.DefinitionUtils import SchemaRegistry
from classes.game.Actor.ActorManager import ActorManager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the required singletons on startup
    config = Config(appglobals.APPDATA_PATH / "config.json")
    if not config.was_just_created:
        try:
            ZstdUtils(Path(config.get("romfs_path")) / "Pack" / "ZsDic.pack.zs")
        except Exception as e:
            print(f"Failed to load ZstdUtils: {e}")
    SchemaRegistry.instance()
    yield
    # Cleanup on shutdown (if needed)

app = FastAPI(title="tk-tools Backend", lifespan=lifespan)

# Allow all origins for local development (Electron)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/actor/{row_id}")
async def get_actor(row_id: str):
    try:
        actor = ActorManager.LoadActor(row_id)
        
        # Serialize Actor object to dict
        components = []
        for comp in actor.components:
            components.append({
                "name": comp.name,
                "folder": comp.folder,
                "isNative": comp.isNative,
                "isParentRef": comp.isParentRef,
                "fields": comp.fields
            })
            
        return {
            "ID": actor.ID,
            "category": actor.category,
            "components": components,
            "rsdb": [{"name": k, "fields": v} for k, v in actor.rsdb.items()]
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8123)
