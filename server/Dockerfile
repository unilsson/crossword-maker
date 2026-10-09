FROM node:24-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/index.mjs server/swesaurus.mjs ./
EXPOSE 3001
CMD ["node", "index.mjs"]
