# Battle Ship Game Backend Dockerfile
FROM python:3.9-slim
# Thiết lập thông tin
LABEL maintainer="MiniMax Agent"
LABEL description="Battle Ship Game Backend Server"
LABEL version="1.0.0"
# Thiết lập working directory
WORKDIR /app
# Cài đặt system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*
# Copy requirements (nếu có thêm dependencies)
COPY requirements.txt .
# Cài đặt Python dependencies (tuy backend chỉ dùng built-in libraries)
RUN pip install --no-cache-dir -r requirements.txt
# Copy source code
COPY . .
# Tạo user non-root cho security
RUN useradd -m -u 1000 battleship && \
    chown -R battleship:battleship /app
USER battleship
# Expose port
EXPOSE 8888
# Health check
# HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
#     CMD python -c "import socket; s = socket.socket(); s.connect(('localhost', 8888)); s.close()" || exit 1
# Thiết lập environment variables
ENV BATTLESHIP_HOST=0.0.0.0
ENV BATTLESHIP_PORT=8888
ENV BATTLESHIP_ENV=production
ENV BATTLESHIP_LOG_LEVEL=INFO
ENV PYTHONUNBUFFERED=1
# Command để chạy server
CMD ["python", "ws_server.py"]