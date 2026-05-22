FROM python:3.11-slim
WORKDIR /app

# system deps
RUN apt-get update && apt-get install -y build-essential gcc libpq-dev unixodbc unixodbc-dev mdbtools libjpeg62-turbo-dev libpng-dev zlib1g-dev \
    libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libfontconfig1 libcairo2 libgdk-pixbuf-2.0-0 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt

COPY backend /app
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD python init_db.py && python seed_prod.py && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
