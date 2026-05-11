from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db, Session as SessionModel, Task
from ..models import SessionCreate, SessionResponse, SurveyMode
from ..services.opencode_service import opencode_service

router = APIRouter(prefix="/api", tags=["sessions"])


@router.post("/tasks/{task_id}/sessions", response_model=SessionResponse, status_code=201)
async def create_session(task_id: int, session_data: SessionCreate, db: Session = Depends(get_db)):
    """Create a new session for a task with OpenCode connection"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Determine mode
    mode = session_data.mode.value if session_data and session_data.mode else "semi_auto"

    # Create OpenCode session
    opencode_result = await opencode_service.create_session(mode=mode)

    # Create database session
    db_session = SessionModel(
        task_id=task_id,
        mode=mode,
        opencode_session_id=opencode_result["session_id"]
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)

    return db_session


@router.get("/tasks/{task_id}/sessions", response_model=List[SessionResponse])
def list_task_sessions(task_id: int, db: Session = Depends(get_db)):
    """List all sessions for a task"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    sessions = db.query(SessionModel).filter(SessionModel.task_id == task_id).order_by(
        SessionModel.created_at.desc()
    ).all()
    return sessions


@router.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    """Get a specific session"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: int, db: Session = Depends(get_db)):
    """Delete a session"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Close OpenCode session if exists
    if session.opencode_session_id:
        await opencode_service.close_session(session.opencode_session_id)

    db.delete(session)
    db.commit()
    return None


@router.post("/sessions/{session_id}/close", status_code=200)
async def close_opencode_session(session_id: int, db: Session = Depends(get_db)):
    """Close the OpenCode connection for a session"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.opencode_session_id:
        await opencode_service.close_session(session.opencode_session_id)
        session.opencode_session_id = None
        db.commit()

    return {"status": "closed"}
