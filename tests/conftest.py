import asyncio, pytest, pytest_asyncio
from playwright.async_api import async_playwright
from harness import serve, CHROME

@pytest.fixture(scope='session')
def base():
    with serve() as url: yield url

@pytest_asyncio.fixture
async def browser():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox']) if CHROME else await p.chromium.launch()
        yield b
        await b.close()
