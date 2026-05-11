from __future__ import annotations
from typing import Any, Dict, List, Optional
import os
import time


class DatabaseService:
    """
    Supabase wrapper. All data access goes through this class.
    Swap the underlying client without touching business logic.
    """

    _instance: Optional["DatabaseService"] = None

    def __init__(self) -> None:
        self._client = None
        self._url = os.environ.get("SUPABASE_URL", "")
        self._key = os.environ.get("SUPABASE_KEY", "")
        self._connected = False
        self._last_error = ""
        self._select_cache: Dict[tuple, tuple[float, List[Dict]]] = {}
        self._select_cache_seconds = float(os.environ.get("SUPABASE_SELECT_CACHE_SECONDS", "12") or 0)

    @classmethod
    def get_instance(cls) -> "DatabaseService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def connect(self) -> None:
        try:
            self._last_error = ""
            if not self._url or not self._key:
                self._connected = False
                self._client = None
                self._last_error = "Faltan SUPABASE_URL o SUPABASE_KEY en el archivo .env."
                print(f"[DatabaseService] {self._last_error}")
                return
            from supabase import create_client
            self._client = create_client(self._url, self._key)
            self._connected = True
        except Exception as e:
            self._last_error = str(e)
            print(f"[DatabaseService] Connection error: {e}")
            self._connected = False

    @property
    def client(self):
        if not self._connected:
            self.connect()
        return self._client

    def get_last_error(self) -> str:
        return self._last_error

    def _cache_key(self, table: str, columns: str, filters: Optional[Dict]) -> tuple:
        filter_items = tuple(sorted((filters or {}).items(), key=lambda item: str(item[0])))
        return (table, columns, filter_items)

    def _cache_get(self, key: tuple) -> Optional[List[Dict]]:
        if self._select_cache_seconds <= 0:
            return None
        cached = self._select_cache.get(key)
        if not cached:
            return None
        expires_at, rows = cached
        if expires_at < time.time():
            self._select_cache.pop(key, None)
            return None
        return [dict(row) for row in rows]

    def _cache_set(self, key: tuple, rows: List[Dict]) -> None:
        if self._select_cache_seconds <= 0:
            return
        self._select_cache[key] = (
            time.time() + self._select_cache_seconds,
            [dict(row) for row in rows],
        )

    def _clear_select_cache(self) -> None:
        self._select_cache.clear()

    def select(self, table: str, columns: str = "*", filters: Optional[Dict] = None) -> List[Dict]:
        try:
            self._last_error = ""
            key = self._cache_key(table, columns, filters)
            cached = self._cache_get(key)
            if cached is not None:
                return cached
            query = self.client.table(table).select(columns)
            if filters:
                for key, value in filters.items():
                    query = query.eq(key, value)
            response = query.execute()
            rows = response.data or []
            self._cache_set(self._cache_key(table, columns, filters), rows)
            return rows
        except Exception as e:
            self._last_error = str(e)
            print(f"[DatabaseService] select error on {table}: {e}")
            return []

    def insert(self, table: str, data: Dict) -> Optional[Dict]:
        try:
            self._last_error = ""
            response = self.client.table(table).insert(data).execute()
            self._clear_select_cache()
            return response.data[0] if response.data else None
        except Exception as e:
            self._last_error = str(e)
            print(f"[DatabaseService] insert error on {table}: {e}")
            return None

    def update(self, table: str, data: Dict, filters: Dict) -> Optional[Dict]:
        try:
            self._last_error = ""
            query = self.client.table(table).update(data)
            for key, value in filters.items():
                query = query.eq(key, value)
            response = query.execute()
            self._clear_select_cache()
            return response.data[0] if response.data else None
        except Exception as e:
            self._last_error = str(e)
            print(f"[DatabaseService] update error on {table}: {e}")
            return None

    def delete(self, table: str, filters: Dict) -> bool:
        try:
            self._last_error = ""
            query = self.client.table(table)
            for key, value in filters.items():
                query = query.delete().eq(key, value)
            query.execute()
            self._clear_select_cache()
            return True
        except Exception as e:
            self._last_error = str(e)
            print(f"[DatabaseService] delete error on {table}: {e}")
            return False

    def rpc(self, function_name: str, params: Dict = None) -> Any:
        try:
            self._last_error = ""
            response = self.client.rpc(function_name, params or {}).execute()
            self._clear_select_cache()
            return response.data
        except Exception as e:
            self._last_error = str(e)
            print(f"[DatabaseService] rpc error {function_name}: {e}")
            return None

    def select_with_join(self, table: str, columns: str, filters: Optional[Dict] = None) -> List[Dict]:
        """Select with embedded resource syntax for Supabase PostgREST joins."""
        try:
            self._last_error = ""
            query = self.client.table(table).select(columns)
            if filters:
                for key, value in filters.items():
                    query = query.eq(key, value)
            response = query.execute()
            return response.data or []
        except Exception as e:
            self._last_error = str(e)
            print(f"[DatabaseService] join select error on {table}: {e}")
            return []
