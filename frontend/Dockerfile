FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_GRAPHQL_URL=http://localhost:4000/graphql
ARG VITE_APP_ENV=dev
ENV VITE_GRAPHQL_URL=$VITE_GRAPHQL_URL
ENV VITE_APP_ENV=$VITE_APP_ENV
RUN npm run build
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 5173
