FROM node:20-alpine
WORKDIR /app
COPY package.json server.mjs ./
RUN npm install --omit=dev --no-audit --no-fund
EXPOSE 8080
CMD ["node", "server.mjs"]
