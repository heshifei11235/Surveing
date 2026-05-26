"""Task manager for tracking async operations and streaming progress"""
import asyncio
import json
import logging
import uuid
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from enum import Enum

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=8)


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    ERROR = "error"


@dataclass
class StreamChunk:
    """A chunk of data from streaming response"""
    chunk: str
    chunk_type: str = "text"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Task:
    """Represents an async task"""
    task_id: str
    status: TaskStatus = TaskStatus.PENDING
    progress: float = 0.0
    current_step: str = ""
    result: Optional[str] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None
    chunks: List[StreamChunk] = field(default_factory=list)


class TaskManager:
    """Manages async tasks with SSE streaming support"""

    def __init__(self):
        self._tasks: Dict[str, Task] = {}
        self._lock = threading.Lock()

    def create_task(self) -> str:
        """Create a new task and return its ID"""
        task_id = str(uuid.uuid4())[:8]
        task = Task(task_id=task_id)
        with self._lock:
            self._tasks[task_id] = task
        logger.info(f"Created task: {task_id}")
        return task_id

    def get_task(self, task_id: str) -> Optional[Task]:
        """Get a task by ID"""
        with self._lock:
            return self._tasks.get(task_id)

    def update_task(self, task_id: str, **kwargs):
        """Update task fields"""
        task = self.get_task(task_id)
        if task:
            for key, value in kwargs.items():
                if hasattr(task, key):
                    setattr(task, key, value)

    def add_chunk(self, task_id: str, chunk: StreamChunk):
        """Add a chunk to the task"""
        task = self.get_task(task_id)
        if task:
            task.chunks.append(chunk)
            task.progress = min(task.progress + 0.01, 0.95)  # Cap at 95% until done

    def complete_task(self, task_id: str, result: Optional[str] = None, error: Optional[str] = None):
        """Mark task as completed"""
        task = self.get_task(task_id)
        if task:
            task.status = TaskStatus.DONE if not error else TaskStatus.ERROR
            task.result = result
            task.error = error
            task.completed_at = time.time()
            task.progress = 1.0
            logger.info(f"Task {task_id} completed with status: {task.status}")

    async def get_task_sse(self, task_id: str):
        """
        Generator that yields SSE events for a task.
        Use this in an SSE endpoint to stream task updates.
        """
        task = self.get_task(task_id)
        if not task:
            yield f"data: {json.dumps({'error': 'Task not found'})}\n\n"
            return

        last_chunk_count = 0
        while True:
            await asyncio.sleep(0.1)

            # Check if task is done
            if task.status == TaskStatus.DONE:
                # Send any remaining chunks
                yield f"data: {json.dumps({'done': True, 'progress': 1.0, 'step': task.current_step})}\n\n"
                break

            if task.status == TaskStatus.ERROR:
                yield f"data: {json.dumps({'error': task.error or 'Unknown error', 'progress': task.progress})}\n\n"
                break

            # Check for new chunks and yield them
            if len(task.chunks) > last_chunk_count:
                for i in range(last_chunk_count, len(task.chunks)):
                    chunk = task.chunks[i]
                    yield f"data: {json.dumps({'chunk': chunk.chunk, 'type': chunk.chunk_type, 'progress': task.progress, 'step': task.current_step})}\n\n"
                last_chunk_count = len(task.chunks)

            # Timeout after 5 minutes
            if time.time() - task.created_at > 300:
                yield f"data: {json.dumps({'error': 'Task timeout', 'progress': task.progress})}\n\n"
                break

        # Cleanup completed task
        with self._lock:
            self._tasks.pop(task_id, None)


# Global task manager
task_manager = TaskManager()