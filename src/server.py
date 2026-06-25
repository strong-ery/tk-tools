import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
from pydantic import BaseModel

from appglobals import appglobals
from config import Config
from classes.util.ZstdUtils import ZstdUtils
from classes.util.DefinitionUtils import SchemaRegistry
from classes.util.ComponentInfoRegistry import ComponentInfoRegistry
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
    ComponentInfoRegistry.instance()
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

import os
import json
from pathlib import Path

@app.get("/api/projects")
async def get_projects():
    projects_dir = Path("projects")
    if not projects_dir.exists():
        projects_dir.mkdir(parents=True)
    
    projects = []
    for d in projects_dir.iterdir():
        if d.is_dir():
            proj_info = {"name": d.name}
            # load project.json if exists
            proj_file = d / "project.json"
            if proj_file.exists():
                try:
                    with open(proj_file, "r") as f:
                        data = json.load(f)
                        proj_info.update(data)
                except:
                    pass
            projects.append(proj_info)
    return {"projects": sorted(projects, key=lambda x: x["name"])}

class ProjectCreate(BaseModel):
    name: str

@app.post("/api/projects")
async def create_project(req: ProjectCreate):
    import datetime
    projects_dir = Path("projects")
    if not projects_dir.exists():
        projects_dir.mkdir(parents=True)
        
    proj_dir = projects_dir / req.name
    if proj_dir.exists():
        raise HTTPException(status_code=400, detail="Project already exists")
        
    proj_dir.mkdir(parents=True)
    proj_info = {
        "name": req.name,
        "created_at": datetime.datetime.now().isoformat()
    }
    with open(proj_dir / "project.json", "w") as f:
        json.dump(proj_info, f, indent=4)
        
    return {"success": True, "project": proj_info}

@app.get("/api/projects/{project_name}/files")
async def get_project_files(project_name: str):
    proj_dir = Path("projects") / project_name
    if not proj_dir.exists() or not proj_dir.is_dir():
        raise HTTPException(status_code=404, detail="Project not found")
        
    def build_tree(dir_path: Path):
        children = []
        try:
            for item in dir_path.iterdir():
                if item.name == "project.json":
                    continue # Hide internal manifest
                if item.is_dir():
                    children.append({
                        "name": item.name,
                        "type": "directory",
                        "children": build_tree(item)
                    })
                else:
                    children.append({
                        "name": item.name,
                        "type": "file",
                        "size": item.stat().st_size
                    })
        except Exception:
            pass
        return sorted(children, key=lambda x: (x["type"] == "file", x["name"]))

    return {"files": build_tree(proj_dir)}

@app.get("/api/actor/{row_id}/directories")
async def get_actor_directories(row_id: str):
    try:
        from classes.util.PathUtils import PathUtils
        import oead
        
        row_id = PathUtils.EnsureUniversalRowID(row_id)
        archive_bytes = ActorManager._get_sarc_for_actor(row_id)
        decompressed = ZstdUtils.instance().decompress(archive_bytes)
        sarc = oead.Sarc(decompressed)
        
        directories = set()
        for file in sarc.get_files():
            parts = file.name.split("/")
            if len(parts) > 1:
                directories.add(parts[0])
                
        return {"directories": sorted(list(directories))}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

from pydantic import BaseModel
class CloneRequest(BaseModel):
    old_row_id: str
    new_row_id: str
    directories_to_rename: list[str]
    project_name: str

@app.post("/api/actor/clone")
async def clone_actor(req: CloneRequest):
    try:
        from classes.game.Actor.CloneActor import CloneActor
        output_path = CloneActor.clone(req.old_row_id, req.new_row_id, req.directories_to_rename, req.project_name)
        return {"success": True, "output_path": output_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
                "info": comp.info,
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

class SaveRSDBRequest(BaseModel):
    table_name: str
    fields: dict

@app.post("/api/projects/{project_name}/rsdb/{row_id}/save")
async def save_rsdb_patch(project_name: str, row_id: str, req: SaveRSDBRequest):
    try:
        patch_dir = Path("projects") / project_name / "RSDB"
        patch_file = patch_dir / f"{row_id}_Patch.json"
        
        # Load existing patch data or create new
        patch_data = {}
        if patch_file.exists():
            with open(patch_file, "r", encoding="utf-8") as f:
                patch_data = json.load(f)
                
        # Update fields for this table
        # Preserve original row ID structure
        fields_to_save = dict(req.fields)
        fields_to_save["__RowId"] = row_id
        patch_data[req.table_name] = fields_to_save
        
        # Save back to file
        patch_dir.mkdir(parents=True, exist_ok=True)
        with open(patch_file, "w", encoding="utf-8") as f:
            json.dump(patch_data, f, indent=4, ensure_ascii=False)
            
        # Clear caches in ActorManager to force reload next time
        ActorManager._actor_cache.clear()
        ActorManager._rsdb_cache.clear()
        ActorManager._sarc_cache.clear()
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8123)
