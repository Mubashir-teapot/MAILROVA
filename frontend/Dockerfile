FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# .next lives inside the bind-mounted ./frontend (see docker-compose.yml),
# so it persists on the host across container restarts, not just image
# rebuilds — wiping it on every container start guarantees a fully fresh
# compile every time, no leftover dev-mode cache possibly serving stale
# output no matter how the container got restarted.
CMD ["sh", "-c", "rm -rf .next && npm run dev"]
