"""OpenCode service with SSE streaming support via task manager"""
from typing import Optional, Dict, Any, List, AsyncIterator
import logging
import asyncio
import json
import time

from ..config import get_opencode_config
from ..services.task_manager import task_manager, StreamChunk, TaskStatus

logger = logging.getLogger(__name__)


class OpenCodeConnection:
    """Represents a connection/session to OpenCode"""

    def __init__(self, session_id: str, mode: str = "semi_auto"):
        self.session_id = session_id
        self.mode = mode
        self.messages: List[Dict[str, str]] = []
        self.created_at = None

    async def send_message(self, content: str) -> str:
        """Send a message and get response"""
        self.messages.append({"role": "user", "content": content})
        return ""


class OpenCodeService:
    """Wrapper service for OpenCode SDK with SSE streaming"""

    def __init__(self):
        opencode_config = get_opencode_config()
        self.api_key = opencode_config.get('api_key')
        self.server_url = opencode_config.get('url', 'http://localhost:36000')
        self.default_mode = opencode_config.get('default_mode', 'semi_auto')
        self.client = None
        self._initialized = False
        self._connections: Dict[str, OpenCodeConnection] = {}

    async def initialize(self):
        """Initialize the OpenCode client"""
        if self._initialized:
            return

        try:
            from opencode_sdk import OpencodeClient
            self.client = OpencodeClient(base_url=self.server_url)
            self._initialized = True
            logger.info(f"OpenCode service initialized (server: {self.server_url})")
        except ImportError:
            logger.warning("OpenCode SDK not installed")
            self._initialized = True
        except Exception as e:
            logger.warning(f"Failed to connect to OpenCode: {e}")
            self._initialized = True

    async def create_session(self, mode: str = "semi_auto") -> Dict[str, Any]:
        """Create a new OpenCode session"""
        if not self._initialized:
            await self.initialize()

        opencode_session_id = str(time.time())[:8]

        if self.client:
            try:
                opencode_sess = self.client.create_session(title=f"Survey {mode}")
                opencode_session_id = opencode_sess.get("id", opencode_session_id)
            except Exception as e:
                logger.error(f"Failed to create OpenCode session: {e}")

        connection = OpenCodeConnection(session_id=opencode_session_id, mode=mode)
        self._connections[opencode_session_id] = connection

        return {
            "session_id": opencode_session_id,
            "mode": mode,
            "status": "active"
        }

    async def close_session(self, opencode_session_id: str) -> bool:
        """Close an OpenCode session"""
        if opencode_session_id in self._connections:
            del self._connections[opencode_session_id]
            return True
        return False

    def _send_message_sync(self, session_id: str, message: str) -> Dict[str, Any]:
        """
        Synchronous send_message - runs in thread pool.
        Returns the full response from OpenCode.
        """
        if self.client:
            try:
                result = self.client.send_message(session_id=session_id, message=message)
                return result
            except Exception as e:
                logger.error(f"OpenCode send_message error: {e}")
                return {"error": str(e)}
        return {"error": "No OpenCode client"}

    async def _run_opencode_in_thread(self, session_id: str, message: str, task_id: str):
        """
        Run OpenCode call in thread pool and stream progress via task manager.
        This is called by chat_stream and doesn't block the event loop.
        """
        loop = asyncio.get_event_loop()

        def blocking_call():
            task = task_manager.get_task(task_id)
            if not task:
                return

            task_manager.update_task(task_id, status=TaskStatus.IN_PROGRESS, current_step="Connecting to OpenCode...")

            try:
                result = self.client.send_message(session_id=session_id, message=message)

                # Extract response and stream chunks
                text_response = ""
                parts = result.get("parts", [])
                step_count = len([p for p in parts if p.get("type") == "step-start"])
                current_step_num = 0

                for part in parts:
                    part_type = part.get("type", "text")

                    if part_type == "text":
                        text = part.get("text", "")
                        if text:
                            text_response += text
                            # Stream in small chunks
                            for i in range(0, len(text), 5):
                                chunk_text = text[i:i+5]
                                task_manager.add_chunk(task_id, StreamChunk(chunk=chunk_text, chunk_type="text"))
                                time.sleep(0.01)  # Small delay for typing effect

                    elif part_type == "reasoning":
                        reasoning_text = part.get("text", "")
                        if reasoning_text:
                            # Brief reasoning - stream it too
                            task_manager.add_chunk(task_id, StreamChunk(
                                chunk=f"[思考] {reasoning_text[:100]}..." if len(reasoning_text) > 100 else f"[思考] {reasoning_text}",
                                chunk_type="reasoning"
                            ))

                    elif part_type == "step-start":
                        current_step_num += 1
                        step_info = f"步骤 {current_step_num}/{step_count}" if step_count > 0 else f"步骤 {current_step_num}"
                        task_manager.update_task(task_id, current_step=step_info, progress=0.3 + (current_step_num / step_count * 0.5) if step_count > 0 else 0.5)

                    elif part_type == "step-finish":
                        reason = part.get("reason", "")
                        task_manager.update_task(task_id, current_step=f"完成: {reason}" if reason else "完成")

                task_manager.complete_task(task_id, result=text_response)

            except Exception as e:
                logger.error(f"OpenCode call error: {e}")
                task_manager.complete_task(task_id, error=str(e))

        # Run in thread pool
        await loop.run_in_executor(None, blocking_call)

    async def chat_stream(self, opencode_session_id: str, message: str, context: Optional[Dict[str, Any]] = None):
        """
        Send a chat message and yield streaming response via task manager.
        Creates a task, runs OpenCode in thread pool, and streams SSE.
        """
        if not self._initialized:
            await self.initialize()

        connection = self._connections.get(opencode_session_id)

        if not self.client or not connection:
            # Fallback to mock streaming
            response = self._get_mock_response(message, connection.mode if connection else "semi_auto")
            for i in range(0, len(response), 5):
                await asyncio.sleep(0.03)
                yield response[i:i+5]
            return

        # Create a task for this streaming operation
        task_id = task_manager.create_task()

        # Start the OpenCode call in background (runs in thread pool)
        asyncio.create_task(self._run_opencode_in_thread(opencode_session_id, message, task_id))

        # Stream SSE as chunks come in
        async for event in task_manager.get_task_sse(task_id):
            yield event

    async def chat(self, opencode_session_id: str, message: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Send a chat message and get a response (non-streaming)"""
        if not self._initialized:
            await self.initialize()

        connection = self._connections.get(opencode_session_id)

        if self.client and connection:
            loop = asyncio.get_event_loop()
            try:
                result = await loop.run_in_executor(
                    None,
                    self._send_message_sync,
                    opencode_session_id,
                    message
                )
                if "error" in result:
                    return self._get_mock_response(message, connection.mode)

                # Extract text from parts
                response = ""
                for part in result.get("parts", []):
                    if part.get("type") == "text":
                        response += part.get("text", "")

                connection.messages.append({"role": "user", "content": message})
                connection.messages.append({"role": "assistant", "content": response})
                return response
            except Exception as e:
                logger.error(f"OpenCode chat error: {e}")
                return self._get_mock_response(message, connection.mode)
        else:
            return self._get_mock_response(message, connection.mode if connection else "semi_auto")

    async def get_history(self, opencode_session_id: str) -> List[Dict[str, str]]:
        """Get conversation history"""
        connection = self._connections.get(opencode_session_id)
        if connection:
            return connection.messages
        return []

    def _get_mock_response(self, message: str, mode: str = "semi_auto") -> str:
        """Mock response for when OpenCode is unavailable"""
        message_lower = message.lower()
        mode_text = "半自动模式" if mode == "semi_auto" else "全自动模式"

        if any(g in message_lower for g in ["hello", "你好", "hi"]):
            return f"你好！当前模式：{mode_text}。请问有什么可以帮助你的？"
        elif "帮助" in message_lower:
            return f"我可以帮你分析代码、调试错误、代码重构等。当前模式：{mode_text}。"
        elif any(k in message_lower for k in ["代码", "code", "编程"]):
            return "请提供需要分析的代码片段，我来帮你看看。"
        elif any(k in message_lower for k in ["错误", "bug", "error"]):
            return "请提供完整的错误信息和相关代码，我来帮你分析。"
        else:
            return f"收到：'{message}'。在 {mode_text} 下，请提供更多细节。"


# Global instance
opencode_service = OpenCodeService()