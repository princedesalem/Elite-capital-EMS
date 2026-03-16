FROM node:20-slim
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --silent --no-audit --no-fund
COPY frontend /app
RUN npm run build
EXPOSE 5173
CMD ["npm","run","preview"]
