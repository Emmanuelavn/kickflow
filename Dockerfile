FROM node:22.18-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
CMD ["npm", "start"]
