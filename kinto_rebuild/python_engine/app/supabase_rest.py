from __future__ import annotations

import json
from typing import Any, Dict, Optional

import httpx

from .settings import get_settings


class SupabaseRestError(RuntimeError):
    def __init__(self, payload: Any, status_code: int):
        if isinstance(payload, dict):
            message = payload.get('message') or payload.get('error') or json.dumps(payload)
        else:
            message = str(payload)
        super().__init__(message)
        self.payload = payload
        self.status_code = status_code


class SupabaseRestClient:
    def __init__(self) -> None:
        settings = get_settings()
        self.base = f"{settings.supabase_url}/rest/v1"
        self.headers = {
            'apikey': settings.supabase_service_role_key,
            'Authorization': f"Bearer {settings.supabase_service_role_key}",
            'Content-Type': 'application/json',
        }

    async def _request(self, method: str, path: str, *, params: Optional[Dict[str, Any]] = None, json_body: Any = None, prefer: Optional[str] = None) -> Any:
        headers = dict(self.headers)
        if prefer:
            headers['Prefer'] = prefer
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as http:
            response = await http.request(method, f"{self.base}/{path.lstrip('/')}" , params=params, json=json_body, headers=headers)
        if response.status_code >= 400:
            try:
                payload = response.json()
            except Exception:
                payload = response.text
            raise SupabaseRestError(payload, response.status_code)
        if not response.text:
            return None
        if 'application/json' in response.headers.get('content-type', ''):
            return response.json()
        return response.text

    async def select(self, table: str, *, filters: Optional[Dict[str, Any]] = None, columns: str = '*', order: Optional[str] = None, limit: Optional[int] = None, maybe_single: bool = False):
        params: Dict[str, Any] = {'select': columns}
        for key, value in (filters or {}).items():
            params[key] = value
        if order:
            params['order'] = order
        if limit is not None:
            params['limit'] = limit
        rows = await self._request('GET', table, params=params) or []
        if maybe_single:
            return rows[0] if rows else None
        return rows

    async def upsert(self, table: str, rows: Any, *, on_conflict: str):
        return await self._request('POST', table, params={'on_conflict': on_conflict}, json_body=rows, prefer='resolution=merge-duplicates,return=representation')

    async def update(self, table: str, rows: Dict[str, Any], *, filters: Dict[str, Any]):
        return await self._request('PATCH', table, params=filters, json_body=rows, prefer='return=representation')


client = SupabaseRestClient()
