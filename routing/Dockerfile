# Pure nginx reverse proxy — no static files, just routes traffic
FROM nginx:stable-alpine

COPY routing/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
