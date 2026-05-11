"""Configuration loader for the application"""
import os
from typing import Any
import yaml


def load_config() -> dict:
    """Load configuration from config.yaml"""
    config_path = os.path.join(os.path.dirname(__file__), 'config.yaml')
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return yaml.safe_load(f)
    return {}


# Global config
config = load_config()


def get_database_url() -> str:
    """Get database URL from config"""
    db_path = config.get('database', {}).get('path', './opencode_conversation.db')
    return f"sqlite:///{db_path}"


def get_backend_config() -> dict:
    """Get backend server config"""
    return config.get('backend', {
        'host': '0.0.0.0',
        'port': 8000,
        'reload': True
    })


def get_opencode_config() -> dict:
    """Get OpenCode service config"""
    return config.get('opencode', {
        'url': 'http://localhost:36000',
        'api_key': '',
        'default_mode': 'semi_auto'
    })


def get_cors_config() -> dict:
    """Get CORS config"""
    return config.get('cors', {
        'allowed_origins': '*',
        'allow_credentials': True,
        'allowed_methods': '*',
        'allowed_headers': '*'
    })