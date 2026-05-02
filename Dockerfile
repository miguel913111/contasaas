FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++ openssl

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

RUN mkdir -p uploads

ENV HOSTNAME="0.0.0.0"
ENV PORT=8080
ENV NODE_ENV=production

CMD ["sh", "-c", "next start -H 0.0.0.0 -p 8080"]