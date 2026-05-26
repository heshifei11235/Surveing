from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db, Task
from ..models import TaskCreate, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("/", status_code=201)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    """Create a new task (stored in local database only)"""
    db_task = Task(title=task.title, description=task.description)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return {"id": db_task.id, "title": db_task.title, "description": db_task.description, "created_at": db_task.created_at, "updated_at": db_task.updated_at}


@router.get("/")
def list_tasks(db: Session = Depends(get_db)):
    """List all tasks"""
    tasks = db.query(Task).order_by(Task.created_at.desc()).all()
    return [{"id": t.id, "title": t.title, "description": t.description, "created_at": t.created_at, "updated_at": t.updated_at} for t in tasks]


@router.get("/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db)):
    """Get a specific task"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"id": task.id, "title": task.title, "description": task.description, "created_at": task.created_at, "updated_at": task.updated_at}


@router.put("/{task_id}")
def update_task(task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db)):
    """Update a task"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = task_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return {"id": task.id, "title": task.title, "description": task.description, "created_at": task.created_at, "updated_at": task.updated_at}


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """Delete a task"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(task)
    db.commit()
    return None