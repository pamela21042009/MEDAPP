from __future__ import annotations
from typing import Any, Dict, List, Optional
import os


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

    def select(self, table: str, columns: str = "*", filters: Optional[Dict] = None) -> List[Dict]:
        try:
            query = self.client.table(table).select(columns)
            if filters:
                for key, value in filters.items():
                    query = query.eq(key, value)
            response = query.execute()
            return response.data or []
        except Exception as e:
            print(f"[DatabaseService] select error on {table}: {e}")
            return []

    def insert(self, table: str, data: Dict) -> Optional[Dict]:
        try:
            response = self.client.table(table).insert(data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"[DatabaseService] insert error on {table}: {e}")
            return None

    def update(self, table: str, data: Dict, filters: Dict) -> Optional[Dict]:
        try:
            query = self.client.table(table).update(data)
            for key, value in filters.items():
                query = query.eq(key, value)
            response = query.execute()
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"[DatabaseService] update error on {table}: {e}")
            return None

    def delete(self, table: str, filters: Dict) -> bool:
        try:
            query = self.client.table(table)
            for key, value in filters.items():
                query = query.delete().eq(key, value)
            query.execute()
            return True
        except Exception as e:
            print(f"[DatabaseService] delete error on {table}: {e}")
            return False

    def rpc(self, function_name: str, params: Dict = None) -> Any:
        try:
            response = self.client.rpc(function_name, params or {}).execute()
            return response.data
        except Exception as e:
            print(f"[DatabaseService] rpc error {function_name}: {e}")
            return None

    def select_with_join(self, table: str, columns: str, filters: Optional[Dict] = None) -> List[Dict]:
        """Select with embedded resource syntax for Supabase PostgREST joins."""
        try:
            query = self.client.table(table).select(columns)
            if filters:
                for key, value in filters.items():
                    query = query.eq(key, value)
            response = query.execute()
            return response.data or []
        except Exception as e:
            print(f"[DatabaseService] join select error on {table}: {e}")
            return []
