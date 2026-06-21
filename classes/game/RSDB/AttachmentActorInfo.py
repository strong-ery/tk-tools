from classes.game.RSDB.RSDB import RSDB

class AttachmentActorInfo(RSDB):
    def __init__(self, RowID, AAIKeyValuePairs):
        super().__init__(RowID)
        self.AAIKeyValuePairs = AAIKeyValuePairs
        