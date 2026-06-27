FROM python:3.12-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml .
COPY pycore/ pycore/
COPY backend/ backend/

RUN pip install --no-cache-dir . "python-multipart>=0.0.20"

RUN chmod +x docker-entrypoint.sh

WORKDIR /app/backend
ENV PYTHONPATH=/app:/app/backend

EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]
