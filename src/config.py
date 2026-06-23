import json
from pathlib import Path


class Config:
    _instance = None

    DEFAULT_CONFIG = {
        "romfs_path": "C:/romfs"
    }

    def __init__(self, config_path):
        if Config._instance is not None:
            raise RuntimeError(
                "Config is already initialized — use Config.instance() instead of creating a new one"
            )

        config_path = Path(config_path)
        self.config_path = config_path

        if not config_path.exists():
            config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(config_path, "w") as f:
                json.dump(Config.DEFAULT_CONFIG, f, indent=4)

            self.config = dict(Config.DEFAULT_CONFIG)
            self.was_just_created = True
        else:
            with open(config_path, "r") as f:
                self.config = json.load(f)

            self.was_just_created = False

        Config._instance = self

    @classmethod
    def instance(cls) -> "Config":
        if cls._instance is None:
            raise RuntimeError(
                "Config has not been initialized yet — call Config(path) once at startup first"
            )
        return cls._instance

    def get(self, key, default=None):
        return self.config.get(key, default)

    def set(self, key, value):
        self.config[key] = value