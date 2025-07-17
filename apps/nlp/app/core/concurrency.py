import asyncio


URL_PROCESSING_SEMAPHORE = asyncio.Semaphore(3)