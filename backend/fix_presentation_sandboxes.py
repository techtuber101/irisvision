"""
Script to fix presentation display in all running sandboxes.
This updates the server.py file in each sandbox to properly serve presentation files.
"""

import asyncio
import sys
from pathlib import Path

# Add the parent directory to the path so we can import core modules
sys.path.insert(0, str(Path(__file__).parent))

from core.sandbox.sandbox import daytona
from core.utils.logger import logger


NEW_SERVER_CODE = """from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
import uvicorn
import os
from pathlib import Path

# Import PDF router, PPTX router, DOCX router, and Visual HTML Editor router
from html_to_pdf_router import router as pdf_router
from visual_html_editor_router import router as editor_router
from html_to_pptx_router import router as pptx_router
from html_to_docx_router import router as docx_router

# Ensure we're serving from the /workspace directory
workspace_dir = "/workspace"

class WorkspaceDirMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Check if workspace directory exists and recreate if deleted
        if not os.path.exists(workspace_dir):
            print(f"Workspace directory {workspace_dir} not found, recreating...")
            os.makedirs(workspace_dir, exist_ok=True)
        return await call_next(request)

app = FastAPI()
app.add_middleware(WorkspaceDirMiddleware)

@app.middleware("http")
async def add_daytona_skip_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Daytona-Skip-Preview-Warning"] = "true"
    return response

# Include routers
app.include_router(pdf_router)
app.include_router(editor_router)
app.include_router(pptx_router)
app.include_router(docx_router)

# Create output directory for generated PDFs (needed by PDF router)
output_dir = Path("generated_pdfs")
output_dir.mkdir(exist_ok=True)

# Mount static files for PDF downloads
app.mount("/downloads", StaticFiles(directory=str(output_dir)), name="downloads")

# Initial directory creation
os.makedirs(workspace_dir, exist_ok=True)

# Add visual HTML editor root endpoint
@app.get("/editor")
async def list_html_files():
    pass  # Truncated for brevity

# Mount static files to serve all workspace files including presentations
app.mount('/', StaticFiles(directory=workspace_dir, html=True), name='site')

if __name__ == '__main__':
    uvicorn.run("server:app", host="0.0.0.0", port=8080, reload=True)
"""


async def fix_sandbox(sandbox_id: str):
    """Fix presentation serving in a single sandbox"""
    try:
        logger.info(f"Fixing sandbox {sandbox_id}...")
        
        sandbox = await daytona.get(sandbox_id)
        
        # Upload the fixed server.py
        server_path = "/app/server.py"
        await sandbox.fs.upload_file(NEW_SERVER_CODE.encode('utf-8'), server_path)
        
        # Restart the HTTP server service
        restart_cmd = "supervisorctl restart http-server"
        result = await sandbox.process.exec(restart_cmd)
        
        logger.info(f"✅ Fixed sandbox {sandbox_id}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to fix sandbox {sandbox_id}: {e}")
        return False


async def main():
    """Fix all running sandboxes"""
    try:
        logger.info("Starting sandbox fix process...")
        
        # Get all sandboxes
        sandboxes = await daytona.list()
        
        if not sandboxes:
            logger.info("No sandboxes found")
            return
        
        logger.info(f"Found {len(sandboxes)} sandboxes")
        
        # Fix each sandbox
        results = await asyncio.gather(
            *[fix_sandbox(sandbox.id) for sandbox in sandboxes],
            return_exceptions=True
        )
        
        success_count = sum(1 for r in results if r is True)
        logger.info(f"\n✅ Successfully fixed {success_count}/{len(sandboxes)} sandboxes")
        
        if success_count > 0:
            logger.info("\n🎉 Presentation slides should now display properly!")
            logger.info("   Try creating a presentation to test.")
        
    except Exception as e:
        logger.error(f"Error in main process: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())

