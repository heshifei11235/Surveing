from typing import Optional, Dict, Any, List, AsyncIterator
import logging
import uuid
import asyncio

from ..config import get_opencode_config

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
        # Response will be generated based on mode
        return ""


class OpenCodeService:
    """Wrapper service for OpenCode SDK integration"""

    def __init__(self):
        opencode_config = get_opencode_config()
        self.api_key = opencode_config.get('api_key')
        self.server_url = opencode_config.get('url', 'http://localhost:36000')
        self.default_mode = opencode_config.get('default_mode', 'semi_auto')
        self.client = None
        self._initialized = False
        # Store active connections: {opencode_session_id: connection}
        self._connections: Dict[str, OpenCodeConnection] = {}

    async def initialize(self):
        """Initialize the OpenCode client"""
        if self._initialized:
            return

        try:
            from opencode_sdk import OpencodeClient
            self.client = OpencodeClient(api_key=self.api_key)
            self._initialized = True
            logger.info(f"OpenCode service initialized successfully (server: {self.server_url})")
        except ImportError:
            logger.warning("OpenCode SDK not installed, using mock responses")
            self._initialized = True

    async def create_session(self, mode: str = "semi_auto") -> Dict[str, Any]:
        """
        Create a new OpenCode session/connection

        Args:
            mode: Survey mode - "semi_auto" or "full_auto"

        Returns:
            Dictionary with session_id and status
        """
        if not self._initialized:
            await self.initialize()

        opencode_session_id = str(uuid.uuid4())[:8]

        if self.client:
            try:
                # Create actual OpenCode session
                opencode_sess = self.client.create_session(title=f"Survey {mode}")
                opencode_session_id = opencode_sess.get("id", opencode_session_id)
            except Exception as e:
                logger.error(f"Failed to create OpenCode session: {e}")

        # Create connection object
        connection = OpenCodeConnection(session_id=opencode_session_id, mode=mode)
        self._connections[opencode_session_id] = connection

        logger.info(f"Created OpenCode session: {opencode_session_id}, mode: {mode}")

        return {
            "session_id": opencode_session_id,
            "mode": mode,
            "status": "active"
        }

    async def close_session(self, opencode_session_id: str) -> bool:
        """
        Close an OpenCode session

        Args:
            opencode_session_id: The OpenCode session ID to close

        Returns:
            True if closed successfully
        """
        if opencode_session_id in self._connections:
            del self._connections[opencode_session_id]
            logger.info(f"Closed OpenCode session: {opencode_session_id}")
            return True
        return False

    async def chat(self, opencode_session_id: str, message: str, context: Optional[Dict[str, Any]] = None) -> str:
        """
        Send a chat message and get a response

        Args:
            opencode_session_id: The OpenCode session ID
            message: The user's message
            context: Optional context information

        Returns:
            The assistant's response
        """
        if not self._initialized:
            await self.initialize()

        connection = self._connections.get(opencode_session_id)

        if self.client and connection:
            try:
                # Use real OpenCode SDK
                result = self.client.send_message(
                    session_id=opencode_session_id,
                    message=message
                )
                # Extract text from parts
                response = ""
                parts = result.get("parts", [])
                for part in parts:
                    if part.get("type") == "text":
                        response += part.get("text", "")
                # Store message in connection history
                connection.messages.append({"role": "user", "content": message})
                connection.messages.append({"role": "assistant", "content": response})
                return response
            except Exception as e:
                logger.error(f"OpenCode chat error: {e}")
                return self._get_mock_response(message, connection.mode)
        else:
            # Fallback to mock
            return self._get_mock_response(message, connection.mode if connection else "semi_auto")

    async def chat_stream(self, opencode_session_id: str, message: str, context: Optional[Dict[str, Any]] = None):
        """
        Send a chat message and yield streaming response

        Args:
            opencode_session_id: The OpenCode session ID
            message: The user's message
            context: Optional context information

        Yields:
            Chunks of the assistant's response
        """
        if not self._initialized:
            await self.initialize()

        connection = self._connections.get(opencode_session_id)

        if self.client and connection:
            try:
                # Store user message
                connection.messages.append({"role": "user", "content": message})

                # Use real OpenCode SDK
                result = self.client.send_message(
                    session_id=opencode_session_id,
                    message=message
                )

                # Extract text from parts
                response = ""
                parts = result.get("parts", [])
                for part in parts:
                    if part.get("type") == "text":
                        response += part.get("text", "")

                # Stream character by character for better UX
                for char in response:
                    await asyncio.sleep(0.01)
                    yield char

                # Store complete response
                connection.messages.append({"role": "assistant", "content": response})
            except Exception as e:
                logger.error(f"OpenCode chat stream error: {e}")
                # Fallback to mock streaming
                response = self._get_mock_response(message, connection.mode if connection else "semi_auto")
                for i in range(0, len(response), 20):
                    await asyncio.sleep(0.05)
                    yield response[i:i+20]
        else:
            # Fallback to mock streaming
            response = self._get_mock_response(message, connection.mode if connection else "semi_auto")
            for i in range(0, len(response), 20):
                await asyncio.sleep(0.05)
                yield response[i:i+20]

    async def get_history(self, opencode_session_id: str) -> List[Dict[str, str]]:
        """
        Get conversation history for a session

        Args:
            opencode_session_id: The OpenCode session ID

        Returns:
            List of messages
        """
        connection = self._connections.get(opencode_session_id)
        if connection:
            return connection.messages
        return []

    def _get_mock_response(self, message: str, mode: str = "semi_auto") -> str:
        """Generate mock response when OpenCode is not available"""
        message_lower = message.lower()

        # Add context based on mode
        mode_text = "半自动模式" if mode == "semi_auto" else "全自动模式"

        if "hello" in message_lower or "你好" in message_lower or "hi" in message_lower:
            return f"你好！欢迎使用 OpenCode 调查系统。当前模式：{mode_text}。请告诉我你想要调查什么内容？"
        elif "help" in message_lower or "帮助" in message_lower:
            return f"在 {mode_text} 下，我可以帮你：\n\n1. 分析代码问题\n2. 调试程序错误\n3. 代码重构建议\n4. 性能优化分析\n\n请描述你想要调查的问题。"
        elif "code" in message_lower or "代码" in message_lower or "编程" in message_lower:
            return "我可以帮你分析代码。请贴上你想要调查的代码片段，并说明你遇到的问题或想要实现的功能。"
        elif "bug" in message_lower or "错误" in message_lower or "error" in message_lower:
            return "好的，让我帮你分析这个错误。请提供：\n1. 完整的错误信息\n2. 出错的相关代码\n3. 你已经尝试过的解决方法"
        elif "refactor" in message_lower or "重构" in message_lower:
            return f"我可以帮你重构代码。在 {mode_text} 下，我会分析代码结构并提供改进建议。请提供需要重构的代码。"
        elif "调查" in message_lower or "survey" in message_lower:
            return f"好的，开始调查模式！当前是 {mode_text}。请告诉我你想要调查的主题或问题。"
        elif "半自动" in message_lower:
            return "半自动模式下，我会逐步引导你完成调查。每个问题后我会等待你的回应。请问你的第一个调查目标是？"
        elif "全自动" in message_lower:
            return "全自动模式下，我会自动分析并提供全面的调查结果。开始深度调查..."
        else:
            return f"我理解了，你说的是：'{message}'。在 {mode_text} 下，请提供更多细节以便我帮你进行调查。"


# Global instance
opencode_service = OpenCodeService()
