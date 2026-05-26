"""Streaming message endpoints with SSE support"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import json

from ..database import get_db, Message, Session as SessionModel
from ..models import MessageCreate
from ..services.opencode_service import opencode_service

router = APIRouter(prefix="/api/sessions", tags=["messages"])


@router.post("/{session_id}/messages", status_code=201)
async def send_message(session_id: int, message: MessageCreate, db: Session = Depends(get_db)):
    """Send a message and get AI response (non-streaming)"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_message = Message(
        session_id=session_id,
        role="user",
        content=message.content
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    opencode_session_id = session.opencode_session_id or f"session_{session_id}"
    ai_response_content = await opencode_service.chat(
        opencode_session_id=opencode_session_id,
        message=message.content
    )

    ai_message = Message(
        session_id=session_id,
        role="assistant",
        content=ai_response_content
    )
    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)

    return {"id": user_message.id, "session_id": user_message.session_id, "role": user_message.role, "content": user_message.content, "created_at": user_message.created_at}


@router.post("/{session_id}/messages/stream")
async def send_message_stream(session_id: int, message: MessageCreate, db: Session = Depends(get_db)):
    """
    Send a message and get streaming AI response via SSE.
    Streams step progress and text chunks in real-time.
    """
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_message = Message(
        session_id=session_id,
        role="user",
        content=message.content
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    opencode_session_id = session.opencode_session_id or f"session_{session_id}"

    ai_message = Message(
        session_id=session_id,
        role="assistant",
        content=""
    )
    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)

    full_content = []

    async def stream_generator():
        nonlocal full_content
        try:
            async for event in opencode_service.chat_stream(
                opencode_session_id=opencode_session_id,
                message=message.content
            ):
                # Parse SSE event
                if event.startswith("data: "):
                    try:
                        data = json.loads(event[6:])
                        if "chunk" in data:
                            chunk = data["chunk"]
                            full_content.append(chunk)
                            yield f"data: {json.dumps({'chunk': chunk, 'message_id': ai_message.id})}\n\n"
                        if "step" in data:
                            yield f"data: {json.dumps({'step': data['step'], 'progress': data.get('progress', 0)})}\n\n"
                        if "done" in data:
                            # Update message in database
                            ai_message.content = "".join(full_content)
                            db.commit()
                            yield f"data: {json.dumps({'done': True, 'message_id': ai_message.id})}\n\n"
                        if "error" in data:
                            yield f"data: {json.dumps({'error': data['error']})}\n\n"
                    except json.JSONDecodeError:
                        pass
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


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


@router.get("/{session_id}/conversation")
def get_conversation(session_id: int, db: Session = Depends(get_db)):
    """Get session with all messages"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.query(Message).filter(Message.session_id == session_id).order_by(
        Message.created_at.asc()
    ).all()

    return {
        "messages": [{"id": m.id, "session_id": m.session_id, "role": m.role, "content": m.content, "created_at": m.created_at} for m in messages],
        "session": {"id": session.id, "task_id": session.task_id, "mode": session.mode.value, "opencode_session_id": session.opencode_session_id, "created_at": session.created_at, "updated_at": session.updated_at}
    }