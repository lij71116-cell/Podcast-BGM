"""应用配置：backend/.env + 进程环境变量，经 ConfigManager 注入 AppSettings。"""

import os
from pathlib import Path
from typing import Any

from dotenv import dotenv_values
from pycore.core.config import BaseSettings, ConfigManager
from pydantic import Field

_ENV_KEY_MAP: dict[str, str] = {
    "HOST": "host",
    "PORT": "port",
    "DEBUG": "debug",
    "CORS_ORIGINS": "cors_origins",
    "DATABASE_PATH": "database_path",
    "STORAGE_ROOT": "storage_root",
    "SESSION_SECRET": "session_secret",
    "SESSION_COOKIE_NAME": "session_cookie_name",
    "FFMPEG_PATH": "ffmpeg_path",
    "FFPROBE_PATH": "ffprobe_path",
    "MAX_BGM_FILE_SIZE_MB": "max_bgm_file_size_mb",
    "MIX_TIMEOUT_SECONDS": "mix_timeout_seconds",
}

_DEFAULT_CORS = [
    "http://localhost:5199",
    "http://127.0.0.1:5199",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:5200",
    "http://127.0.0.1:5200",
    "http://localhost:5201",
    "http://127.0.0.1:5201",
]


class AppSettings(BaseSettings):
    """运行时配置（backend/.env 为默认，进程环境变量可覆盖）。"""

    host: str = "127.0.0.1"
    port: int = 8099
    debug: bool = True
    cors_origins: list[str] = Field(default_factory=lambda: list(_DEFAULT_CORS))
    database_path: str = "backend/data/podcast_flow.db"
    storage_root: str = "backend/storage"
    session_secret: str = ""
    session_cookie_name: str = "podcast_flow_session"
    ffmpeg_path: str = "ffmpeg"
    ffprobe_path: str = "ffprobe"
    max_bgm_file_size_mb: int = 50
    mix_timeout_seconds: int = 1800


_settings: AppSettings | None = None


def _coerce(key: str, value: str) -> Any:
    field_name = _ENV_KEY_MAP.get(key, key.lower())
    annotation = AppSettings.model_fields.get(field_name)
    if annotation is None:
        return value
    outer = annotation.annotation
    if outer is int:
        return int(value)
    if outer is bool:
        return value.strip().lower() in ("1", "true", "yes", "on")
    if field_name == "cors_origins":
        return [item.strip() for item in value.split(",") if item.strip()]
    return value


def _resolve_project_path(project_root: Path, raw_path: str) -> str:
    path = Path(raw_path)
    if not path.is_absolute():
        path = project_root / path
    return str(path.resolve())


def _merge_env_sources(env_path: Path) -> dict[str, str]:
    """合并 .env 与进程环境变量（后者优先，便于 Fly.io / Docker 注入）。"""
    raw: dict[str, str | None] = dict(dotenv_values(env_path)) if env_path.exists() else {}
    merged: dict[str, str] = {
        key: value for key, value in raw.items() if value is not None and value != ""
    }
    for env_key in _ENV_KEY_MAP:
        env_value = os.environ.get(env_key)
        if env_value is not None and env_value != "":
            merged[env_key] = env_value
    return merged


def load_settings(env_path: Path | None = None) -> AppSettings:
    """从 backend/.env 与进程环境变量加载配置；文件缺失时使用默认值。"""
    global _settings  # noqa: PLW0603

    if env_path is None:
        env_path = Path(__file__).parent.parent.parent / ".env"

    project_root = env_path.parent.parent
    merged = _merge_env_sources(env_path)

    settings_dict: dict[str, Any] = {}
    for env_key, field_name in _ENV_KEY_MAP.items():
        raw_value = merged.get(env_key)
        if raw_value is not None and raw_value != "":
            settings_dict[field_name] = _coerce(env_key, raw_value)

    if "database_path" in settings_dict:
        settings_dict["database_path"] = _resolve_project_path(
            project_root, str(settings_dict["database_path"])
        )
    else:
        settings_dict["database_path"] = _resolve_project_path(
            project_root, "backend/data/podcast_flow.db"
        )

    if "storage_root" in settings_dict:
        settings_dict["storage_root"] = _resolve_project_path(
            project_root, str(settings_dict["storage_root"])
        )
    else:
        settings_dict["storage_root"] = _resolve_project_path(
            project_root, "backend/storage"
        )

    ConfigManager.reset()
    mgr: ConfigManager[AppSettings] = ConfigManager()
    mgr.load_from_dict(AppSettings, settings_dict)
    _settings = mgr.settings  # type: ignore[assignment]
    return _settings


def get_settings() -> AppSettings:
    """返回已加载的配置单例。"""
    if _settings is None:
        return load_settings()
    return _settings
