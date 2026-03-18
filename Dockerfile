FROM node:20-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.d/40-generate-runtime-config.sh /docker-entrypoint.d/40-generate-runtime-config.sh

# Create directory for certificates - they will be mounted here
RUN mkdir -p /etc/nginx/certs
RUN chmod +x /docker-entrypoint.d/40-generate-runtime-config.sh

EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
