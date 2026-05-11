#!/usr/bin/env python3
"""Run the FastAPI backend server"""
import uvicorn
from app.main import get_server_config

if __name__ == "__main__":
    config = get_server_config()
    uvicorn.run(
        "app.main:app",
        host=config.get('host', '0.0.0.0'),
        port=config.get('port', 8000),
        reload=config.get('reload', True)
    )