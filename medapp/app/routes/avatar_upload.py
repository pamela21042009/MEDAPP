from __future__ import annotations

import os
from uuid import uuid4

from werkzeug.utils import secure_filename

AVATAR_BUCKET = os.environ.get("AVATAR_BUCKET", "profile-avatars")
ALLOWED_IMAGE_MIMES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
}

def image_extension(file) -> str | None:
    filename = secure_filename(file.filename or "")
    extension = os.path.splitext(filename)[1].lower()
    mime_extension = ALLOWED_IMAGE_MIMES.get(file.mimetype)
    if mime_extension:
        return mime_extension
    if extension in {".png", ".jpg", ".jpeg", ".webp"}:
        return ".jpg" if extension == ".jpeg" else extension
    return None


def upload_avatar_to_supabase(folder: str, file) -> str | None:
    extension = image_extension(file)
    if not extension:
        return None

    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not supabase_url or not service_key:
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.")

    safe_folder = "/".join(
        secure_filename(part)
        for part in str(folder or "avatars").replace("\\", "/").split("/")
        if secure_filename(part)
    ) or "avatars"
    storage_path = f"{safe_folder}/{uuid4().hex}{extension}"

    from supabase import create_client

    storage = create_client(supabase_url, service_key).storage
    bucket = storage.from_(AVATAR_BUCKET)
    bucket.upload(
        storage_path,
        file.read(),
        file_options={
            "content-type": file.mimetype or "application/octet-stream",
            "upsert": "false",
        },
    )
    return bucket.get_public_url(storage_path)
