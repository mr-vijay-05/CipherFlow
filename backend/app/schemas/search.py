from typing import List
from pydantic import BaseModel, Field

class IndexNoteTokensRequest(BaseModel):
    noteId: str = Field(..., min_length=1, max_length=64, description="Target note identifier")
    tokens: List[str] = Field(default_factory=list, description="Opaque HMAC-SHA-256 search tokens")

class SearchQueryRequest(BaseModel):
    tokens: List[str] = Field(..., min_length=1, description="One or more opaque HMAC-SHA-256 query tokens")

class SearchResponse(BaseModel):
    matchingNoteIds: List[str] = Field(default_factory=list, description="IDs of notes matching the search tokens")
    matchCount: int = Field(default=0, description="Total matching notes found")
