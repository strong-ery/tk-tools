from typing import Any

class DataEntry:
    def __init__(self, key: str, value: Any, type_hint: str = None):
        self.key = key
        self.value = value
        self.type_hint = type_hint
