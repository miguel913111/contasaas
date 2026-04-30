FROM node:22-alpine

WORKDIR /app

# Instalar dependências de build para módulos nativos (bcrypt, etc.)
RUN apk add --no-cache libc6-compat python3 make g++

# Copiar package files primeiro (cache de layers)
COPY package.json package-lock.json* ./
RUN npm ci

# Copiar o resto do código
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Criar diretório de uploads
RUN mkdir -p uploads

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "run", "dev"]