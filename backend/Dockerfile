FROM node:20-alpine

# Prisma's schema/query engine binaries are dynamically linked against
# libssl (separate from Node's own statically-compiled TLS); plain
# node:20-alpine doesn't include it, which is exactly the "failed to
# detect the libssl/openssl version" error this fixes.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push && npx prisma db seed && npm run dev"]
