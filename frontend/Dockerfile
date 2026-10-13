FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_SENTRY_DSN=""
ARG VITE_DEPLOY_SHA="dev"
ARG VITE_APP_ENV="production"
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_DEPLOY_SHA=$VITE_DEPLOY_SHA
ENV VITE_APP_ENV=$VITE_APP_ENV
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build && printf '%s' "$VITE_DEPLOY_SHA" > /app/dist/deploy-sha.txt

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
