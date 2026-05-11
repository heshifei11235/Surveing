from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class SurveyMode(str, Enum):
    SEMI_AUTO = "semi_auto"  # 半自动模式
    FULL_AUTO = "full_auto"  # 全自动模式


# Task schemas
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class TaskResponse(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Session schemas
class SessionBase(BaseModel):
    pass


class SessionCreate(BaseModel):
    mode: SurveyMode = SurveyMode.SEMI_AUTO


class SessionResponse(BaseModel):
    id: int
    task_id: int
    mode: SurveyMode
    opencode_session_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Message schemas
class MessageBase(BaseModel):
    pass


class MessageCreate(MessageBase):
    content: str


class MessageResponse(MessageBase):
    id: int
    session_id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    messages: List[MessageResponse]
    session: SessionResponse
