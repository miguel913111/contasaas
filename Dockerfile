FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++ openssl

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

RUN mkdir -p uploads

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT="8080"

EXPOSE 8080

CMD ["node", "node_modules/.bin/next", "start", "--hostname", "0.0.0.0", "--port", "8080"]