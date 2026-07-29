FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY services/renpho-sync/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/renpho-sync/sync.py .
RUN mkdir -p /data

CMD ["python", "sync.py"]
