FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY backend/package.json ./backend/package.json
COPY backend ./backend
COPY frontend/package.json ./frontend/package.json
COPY frontend ./frontend

RUN npm install --include=dev
RUN npm install --prefix backend --include=dev
RUN npm install --prefix frontend --include=dev

EXPOSE 5001 5173

CMD ["npm", "run", "dev"]
