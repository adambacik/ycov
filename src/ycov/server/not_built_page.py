from fastapi import FastAPI
from fastapi.responses import HTMLResponse

NOT_BUILT_PAGE = """<!doctype html>
                    <title>ycov</title>
                    <h1>ycov: frontend not built</h1>
                    <p>The API is running. Build the frontend with <code>npm run build</code> in
                    <code>web/</code> and restart <code>ycov view</code>.</p>
                    <p>API documentation: <a href="/docs">/docs</a></p>"""


def add_not_built_page(app: FastAPI) -> None:
    """Serve a short explanation at / when there is no built frontend."""

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    def not_built() -> str:
        return NOT_BUILT_PAGE
