FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++ openssl

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

RUN mkdir -p uploads

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

CMD ["npm", "start"]