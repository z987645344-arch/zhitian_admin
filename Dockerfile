FROM nginx:stable-alpine

RUN rm -f /etc/nginx/conf.d/default.conf \
    && mkdir -p \
        /tmp/nginx/client_temp \
        /tmp/nginx/proxy_temp \
        /tmp/nginx/fastcgi_temp \
        /tmp/nginx/uwsgi_temp \
        /tmp/nginx/scgi_temp \
    && chown -R nginx:nginx /tmp/nginx /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf
COPY --chown=nginx:nginx css/ /usr/share/nginx/html/css/
COPY --chown=nginx:nginx js/ /usr/share/nginx/html/js/
COPY --chown=nginx:nginx config.js /usr/share/nginx/html/config.js
COPY --chown=nginx:nginx *.html /usr/share/nginx/html/

USER nginx

EXPOSE 8080

ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
