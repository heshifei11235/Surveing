"""Message endpoints - simplified for data storage only

Note: Frontend now uses npm @opencode-ai/sdk to communicate directly with OpenCode.
Message sending and streaming is handled by the frontend.
This module only provides data storage if frontend wants to persist messages via backend.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db, Message, Session as SessionModel
from ..models import MessageCreate

router = APIRouter(prefix="/api/sessions", tags=["messages"])


@router.post("/{session_id}/messages", status_code=201)
def save_message(session_id: int, message: MessageCreate, db: Session = Depends(get_db)):
    """
    Save a message to database.
    Note: This is for storage only - actual message sending is done by frontend via npm SDK.
    """
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    db_message = Message(
        session_id=session_id,
        role="user",
        content=message.content
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    return {"id": db_message.id, "session_id": db_message.session_id, "role": db_message.role, "content": db_message.content, "created_at": db_message.created_at}


@router.get("/{session_id}/messages")
def get_messages(session_id: int, db: Session = Depends(get_db)):
    """Get all messages for a session"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.query(Message).filter(Message.session_id == session_id).order_by(
        Message.created_at.asc()
    ).all()
    return [{"id": m.id, "session_id": m.session_id, "role": m.role, "content": m.content, "created_at": m.created_at} for m in messages]