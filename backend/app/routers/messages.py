from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import json

from ..database import get_db, Message, Session as SessionModel
from ..models import MessageCreate, MessageResponse, ConversationResponse
from ..services.opencode_service import opencode_service

router = APIRouter(prefix="/api/sessions", tags=["messages"])


@router.post("/{session_id}/messages", response_model=MessageResponse, status_code=201)
async def send_message(session_id: int, message: MessageCreate, db: Session = Depends(get_db)):
    """Send a message and get AI response"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Save user message
    user_message = Message(
        session_id=session_id,
        role="user",
        content=message.content
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    # Get AI response from OpenCode
    context = {
        "task_id": session.task_id,
        "session_id": session.id,
        "mode": session.mode
    }

    # Use OpenCode session if available, otherwise use session_id as fallback
    opencode_session_id = session.opencode_session_id or f"session_{session_id}"
    ai_response_content = await opencode_service.chat(
        opencode_session_id=opencode_session_id,
        message=message.content,
        context=context
    )

    # Save AI response
    ai_message = Message(
        session_id=session_id,
        role="assistant",
        content=ai_response_content
    )
    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)

    return user_message


@router.post("/{session_id}/messages/stream")
async def send_message_stream(session_id: int, message: MessageCreate, db: Session = Depends(get_db)):
    """Send a message and get streaming AI response via SSE"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Save user message
    user_message = Message(
        session_id=session_id,
        role="user",
        content=message.content
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    # Prepare context
    context = {
        "task_id": session.task_id,
        "session_id": session.id,
        "mode": session.mode
    }

    opencode_session_id = session.opencode_session_id or f"session_{session_id}"

    # Create a placeholder for AI message first
    ai_message = Message(
        session_id=session_id,
        role="assistant",
        content=""
    )
    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)

    # Stream response
    full_content = ""

    async def stream_generator():
        nonlocal full_content
        try:
            async for chunk in opencode_service.chat_stream(
                opencode_session_id=opencode_session_id,
                message=message.content,
                context=context
            ):
                full_content += chunk
                # Send SSE format
                yield f"data: {json.dumps({'chunk': chunk, 'message_id': ai_message.id})}\n\n"

            # Update the complete message in database
            ai_message.content = full_content
            db.commit()

            # Send done signal
            yield f"data: {json.dumps({'done': True, 'message_id': ai_message.id})}\n\n"
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


@router.get("/{session_id}/messages", response_model=List[MessageResponse])
def get_messages(session_id: int, db: Session = Depends(get_db)):
    """Get all messages for a session"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.query(Message).filter(Message.session_id == session_id).order_by(
        Message.created_at.asc()
    ).all()
    return messages


@router.get("/{session_id}/conversation", response_model=ConversationResponse)
def get_conversation(session_id: int, db: Session = Depends(get_db)):
    """Get session with all messages"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.query(Message).filter(Message.session_id == session_id).order_by(
        Message.created_at.asc()
    ).all()

    return ConversationResponse(messages=messages, session=session)
