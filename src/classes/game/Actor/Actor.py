class Actor:
    def __init__(self, ID, category, components, rsdb=None):
        self.ID = ID
        self.category = category
        self.components = components
        self.rsdb = rsdb or {}