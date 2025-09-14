from neo4j import AsyncGraphDatabase
import datetime
from typing import List, Dict, Any

class Neo4jClient:
    def __init__(self, uri: str = "bolt://localhost:7687", user: str = "neo4j", password: str = "neo4j"):
        self._uri = uri
        self._auth = (user, password)
        self._driver = AsyncGraphDatabase.driver(self._uri, auth=self._auth)

    async def close(self):
        return self._driver.close()
    
    async def ensure_schema(self):
        async with self._driver.session() as session:
            # unique constraints for Document and Organization
            await session.execute_write(self._create_constraints)
    
    