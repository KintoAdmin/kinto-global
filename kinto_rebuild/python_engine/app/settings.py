from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict


def _load_local_env(project_root: Path) -> Dict[str, str]:
    loaded: Dict[str, str] = {}
    for name in ('.env.local', '.env'):
        path = project_root / name
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding='utf-8').splitlines():
            line = raw_line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            loaded.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    return loaded


@dataclass(frozen=True)
class Settings:
    project_root: Path
    supabase_url: str
    supabase_publishable_key: str
    supabase_service_role_key: str
    python_api_base_url: str


def get_settings() -> Settings:
    project_root = Path(__file__).resolve().parents[2]
    local_env = _load_local_env(project_root)

    def read(name: str, *fallbacks: str) -> str:
        if os.environ.get(name):
            return os.environ[name]
        if local_env.get(name):
            return local_env[name]
        for fallback in fallbacks:
            if os.environ.get(fallback):
                return os.environ[fallback]
            if local_env.get(fallback):
                return local_env[fallback]
        return ''

    supabase_url = read('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')
    publishable = read('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY')
    service_role = read('SUPABASE_SERVICE_ROLE_KEY')
    python_base = read('PYTHON_API_BASE_URL') or 'http://127.0.0.1:8000'

    if not supabase_url or not publishable or not service_role:
        missing = [
            name for name, value in {
                'NEXT_PUBLIC_SUPABASE_URL': supabase_url,
                'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': publishable,
                'SUPABASE_SERVICE_ROLE_KEY': service_role,
            }.items() if not value
        ]
        raise RuntimeError(f"Missing required environment variables for python engine: {', '.join(missing)}")

    return Settings(
        project_root=project_root,
        supabase_url=supabase_url.rstrip('/'),
        supabase_publishable_key=publishable,
        supabase_service_role_key=service_role,
        python_api_base_url=python_base.rstrip('/'),
    )
