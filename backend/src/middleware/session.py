"""Session Cookie 中间件：为 /api/* 注入 session_id。"""

import uuid
from collections.abc import Callable
from typing import cast

from pycore.core.logger import get_logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from src.core.config import get_settings
from src.db.models import AppSession
from src.db.session import get_db_context

logger = get_logger()

SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30  # 30 天


class SessionMiddleware(BaseHTTPMiddleware):
    """首次访问 /api/* 时签发 podcast_flow_session Cookie 并写入 sessions 表。"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if not path.startswith("/api"):
            return cast(Response, await call_next(request))

        settings = get_settings()
        cookie_name = settings.session_cookie_name
        session_id = request.cookies.get(cookie_name)
        is_new = session_id is None

        if is_new:
            session_id = str(uuid.uuid4())
            async with get_db_context() as db:
                db.add(AppSession(session_id=session_id))
                await db.commit()
            logger.info("New session created", session_id=session_id)
        else:
            assert session_id is not None

        request.state.session_id = session_id
        response: Response = cast(Response, await call_next(request))

        if is_new:
            response.set_cookie(
                key=cookie_name,
                value=session_id,
                httponly=True,
                samesite="lax",
                secure=not settings.debug,
                max_age=SESSION_MAX_AGE_SECONDS,
                path="/",
            )

        return response
