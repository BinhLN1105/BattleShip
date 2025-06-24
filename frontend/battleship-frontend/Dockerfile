# Battle Ship Game Frontend Dockerfile
# Multi-stage build để optimize size
# Stage 1: Build stage
FROM node:18-alpine AS builder
# Thiết lập thông tin
LABEL maintainer="MiniMax Agent"
LABEL description="Battle Ship Game Frontend"
LABEL version="1.0.0"
# Thiết lập working directory
WORKDIR /app
# Copy package files
COPY package*.json ./
# Cài đặt dependencies bằng npm
RUN npm install --legacy-peer-deps
# Copy source code
COPY . .
# Build application bằng npm
RUN npm run build
# Stage 2: Production stage
FROM nginx:alpine
# Copy built files từ builder stage
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Expose port
EXPOSE 80
# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1
# Start nginx
CMD ["nginx", "-g", "daemon off;"]