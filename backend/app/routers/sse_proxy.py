"""
SSE Proxy Router - Backend acts as transparent gateway for SSE communication
between Vue frontend and OpenCode Server

┌─────────────────┐     HTTP/SSE      ┌─────────────────┐     HTTP/SSE      ┌─────────────────┐
│   Vue 前端      │ ◄──────────────► │  FastAPI 后端   │ ◄──────────────► │   OpenCode      │
│   (聊天界面)    │   SSE 流式响应    │  (透传代理)     │   prompt_async   │   Server        │
└─────────────────┘                   └─────────────────┘   /global/event   └─────────────────┘
"""

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
import httpx
import json

router = APIRouter(prefix="/api/sse", tags=["sse"])

# OpenCode server base URL - change this to your OpenCode server address
OPENCODE_BASE_URL = "http://localhost:36000"


async def proxy_sse(url: str, headers: dict, timeout: float = 300.0):
    """
    Proxy SSE requests to OpenCode server and stream responses back to frontend.
    This is a transparent proxy - it just forwards the SSE stream.
    """
    print(f"[SSE Proxy] Opening proxy connection to: {url}")
    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=30.0)) as client:
        try:
            async with client.stream("GET", url, headers=headers) as response:
                print(f"[SSE Proxy] Proxy connection established, status: {response.status_code}")
                # Ensure we got a valid SSE response
                if response.status_code != 200:
                    yield f"event: error\ndata: {{'status': {response.status_code}}}\n\n".encode()
                    return

                # Stream the response back to the frontend
                line_count = 0
                async for line in response.aiter_lines():
                    line_count += 1
                    # Always yield the line - blank lines are SSE event separators
                    yield f"{line}\n".encode()
                    if line_count <= 10:
                        print(f"[SSE Proxy] Forwarding line {line_count}: '{line[:80]}'")
                print(f"[SSE Proxy] Stream ended, total lines: {line_count}")
        except httpx.TimeoutException:
            yield f"event: error\ndata: {{'message': 'Request timeout'}}\n\n".encode()
        except Exception as e:
            yield f"event: error\ndata: {{'message': '{str(e)}'}}\n\n".encode()


@router.get("/events")
async def stream_events(workspace: Optional[str] = None):
    """
    Proxy SSE events from OpenCode server's /global/event endpoint.
    Vue frontend connects to this endpoint to receive real-time events.
    """
    url = f"{OPENCODE_BASE_URL}/global/event"
    headers = {"Accept": "text/event-stream"}

    if workspace:
        headers["X-Workspace"] = workspace

    return StreamingResponse(
        proxy_sse(url, headers),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/session/{session_id}/messages")
async def get_session_messages(session_id: str, directory: Optional[str] = None, limit: int = 50):
    """
    Get messages for a session (after async processing completes).
    Uses v1 API at /session/{id}/message (singular, not plural)
    """
    url = f"{OPENCODE_BASE_URL}/session/{session_id}/message"
    headers = {"Accept": "application/json"}

    if directory:
        headers["X-Directory"] = directory

    params = {"limit": limit}

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url, headers=headers, params=params)
            content = response.text.strip()
            if not content:
                return []
            try:
                return response.json()
            except Exception:
                return {"success": False, "error": content[:500]}
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"OpenCode request failed: {str(e)}")


@router.post("/session/{session_id}/prompt_async")
async def send_prompt_async(session_id: str, request: Request, directory: Optional[str] = None):
    """
    Proxy prompt_async request to OpenCode server.
    Frontend sends message here, backend forwards to OpenCode.
    OpenCode processes asynchronously and sends results via SSE.

    Note: Uses v1 API at /session/{id}/prompt_async which returns 204 on success.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    print(f"[SSE Proxy] prompt_async called for session: {session_id}")
    print(f"[SSE Proxy] Request body: {body}")

    url = f"{OPENCODE_BASE_URL}/session/{session_id}/prompt_async"

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    if directory:
        headers["X-Directory"] = directory

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(url, json=body, headers=headers)
            print(f"[SSE Proxy] prompt_async response status: {response.status_code}")

            if response.status_code == 204:
                return {"success": True, "message": "Prompt queued"}

            content = response.text.strip()
            if not content:
                return {"success": True, "message": "Empty response"}

            if response.status_code >= 400:
                return {"success": False, "error": f"HTTP {response.status_code}: {content[:500]}"}

            try:
                return response.json()
            except Exception:
                return {"success": False, "error": content[:500]}
        except httpx.HTTPError as e:
            print(f"[SSE Proxy] prompt_async HTTP error: {e}")
            raise HTTPException(status_code=502, detail=f"OpenCode request failed: {str(e)}")


@router.get("/session/list")
async def list_sessions(directory: Optional[str] = None, limit: int = 20):
    """
    List all OpenCode sessions.
    """
    url = f"{OPENCODE_BASE_URL}/session"
    headers = {"Accept": "application/json"}

    if directory:
        headers["X-Directory"] = directory

    params = {"limit": limit}

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url, headers=headers, params=params)
            content = response.text.strip()
            if not content:
                return []
            try:
                return response.json()
            except Exception:
                return {"success": False, "error": content[:500]}
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"OpenCode request failed: {str(e)}")


@router.post("/session/create")
async def create_session(request: Request, directory: Optional[str] = None):
    """
    Create a new OpenCode session.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    url = f"{OPENCODE_BASE_URL}/session"

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    if directory:
        headers["X-Directory"] = directory

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(url, json=body, headers=headers)
            content = response.text.strip()
            if not content:
                return {"success": False, "error": "Empty response"}
            try:
                return response.json()
            except Exception:
                return {"success": False, "error": content[:500]}
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"OpenCode request failed: {str(e)}")


@router.delete("/session/{session_id}")
async def delete_opencode_session(session_id: str, directory: Optional[str] = None):
    """
    Delete an OpenCode session.
    """
    url = f"{OPENCODE_BASE_URL}/session/{session_id}"

    headers = {"Accept": "application/json"}
    if directory:
        headers["X-Directory"] = directory

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.delete(url, headers=headers)
            if response.status_code >= 400:
                return {"success": False, "error": f"HTTP {response.status_code}"}
            content = response.text.strip()
            if not content:
                return {"success": True}
            try:
                return response.json()
            except Exception:
                return {"success": True}
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"OpenCode request failed: {str(e)}")