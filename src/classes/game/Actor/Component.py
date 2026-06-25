from typing import Any, Optional

class ComponentSchema:
    def __init__(self, name: str, expected_fields: dict[str, str] = None):
        self.name = name
        self.expected_fields = expected_fields or {}

class Component:
    def __init__(self, name: str, fields: dict[str, Any], schema: Optional[ComponentSchema] = None, folder: str = "Component", isNative: bool = True, isParentRef: bool = False, info: Optional[dict[str, Any]] = None):
        self.name = name
        self.fields = fields
        self.schema = schema
        self.folder = folder
        self.isNative = isNative
        self.isParentRef = isParentRef
        self.info = info
