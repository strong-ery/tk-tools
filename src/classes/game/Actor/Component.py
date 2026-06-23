from typing import Any, Optional

class ComponentSchema:
    def __init__(self, name: str, expected_fields: dict[str, str] = None):
        self.name = name
        self.expected_fields = expected_fields or {}

class Component:
    def __init__(self, name: str, fields: dict[str, Any], schema: Optional[ComponentSchema] = None):
        self.name = name
        self.fields = fields
        self.schema = schema
