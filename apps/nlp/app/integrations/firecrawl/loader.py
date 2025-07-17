from langchain_core.documents import Document
from langchain_core.document_loaders import BaseLoader
from firecrawl import AsyncFirecrawlApp

class CoolFireCrawlLoader(BaseLoader):
    def __init__(self, api_key: str, url: str, mode: str = "scrape"):
        self.api_key = api_key
        self.url = url
        self.mode = mode

    async def alazy_load(self):
        client = AsyncFirecrawlApp(api_key=self.api_key)
        response = await client.scrape_url(url=self.url, formats=["markdown"])
        content = response.markdown
        if content:
            yield Document(page_content=content, metadata={"source": self.url})