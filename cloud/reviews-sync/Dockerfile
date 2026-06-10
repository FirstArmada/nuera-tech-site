# Cloud Run Job image. Node 20, no build step.
FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
CMD ["node", "job.js"]
