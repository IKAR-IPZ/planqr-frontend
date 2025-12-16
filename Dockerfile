FROM node:20-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_SITE_URL
ENV VITE_SITE_URL=$VITE_SITE_URL

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create directory for certificates - they will be mounted here
RUN mkdir -p /etc/nginx/certs

EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
