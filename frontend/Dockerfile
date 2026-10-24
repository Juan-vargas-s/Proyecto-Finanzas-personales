FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_GATEWAY
ENV NEXT_PUBLIC_API_GATEWAY=$NEXT_PUBLIC_API_GATEWAY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/app ./app
COPY --from=build /app/lib ./lib
COPY --from=build /app/components ./components
EXPOSE 3000
CMD ["npm", "start"]
