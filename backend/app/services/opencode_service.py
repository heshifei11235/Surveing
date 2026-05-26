"""OpenCode service - simplified for data storage only

Note: Frontend now directly uses npm @opencode-ai/sdk to communicate with OpenCode.
This backend module only provides data storage management if needed.
"""
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class OpenCodeService:
    """
    Simplified OpenCode service.
    Actual OpenCode communication happens directly from frontend via npm SDK.
    This service can be used for any backend-side data operations if needed.
    """

    def __init__(self):
        self._initialized = True

    async def initialize(self):
        """No initialization needed - frontend handles OpenCode directly"""
        pass

    async def create_session(self, mode: str = "semi_auto") -> Dict[str, Any]:
        """This won't be called - frontend creates sessions via npm SDK"""
        return {
            "session_id": "",
            "mode": mode,
            "status": "note_use_npm_sdk"
        }

    async def close_session(self, opencode_session_id: str) -> bool:
        """Frontend handles session management via npm SDK"""
        return True

    async def chat(self, opencode_session_id: str, message: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Not used - frontend uses npm SDK directly"""
        return ""

    async def chat_stream(self, opencode_session_id: str, message: str, context: Optional[Dict[str, Any]] = None):
        """Not used - frontend uses npm SDK directly"""
        return
        yield  # Empty generator


# Global instance
opencode_service = OpenCodeService()