FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/nginx.conf

COPY flowin/www/flowin.one /var/www/flowin.one
COPY flowin/www/editor.flowin.one /var/www/editor.flowin.one
