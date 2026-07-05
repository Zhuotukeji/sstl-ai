FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace @sstl-ai/shared && npm run build --workspace @sstl-ai/web

FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/apps/web/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
