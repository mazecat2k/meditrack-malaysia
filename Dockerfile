FROM nginx:alpine

# Copy all local files to the NGINX host directory
COPY . /usr/share/nginx/html

# Ensure the config.js file exists with the replacement token
RUN mkdir -p /usr/share/nginx/html/js
RUN echo "window.CONFIG = { GEMINI_API_KEY: 'REPLACE_ME_GEMINI' };" > /usr/share/nginx/html/js/config.js

# Use a custom entrypoint to dynamically set the port and inject environment variables
# Cloud Run defaults to 8080. NGINX defaults to 80.
CMD ["/bin/sh", "-c", "sed -i \"s/listen       80;/listen $PORT;/g\" /etc/nginx/conf.d/default.conf && sed -i \"s|REPLACE_ME_GEMINI|$GEMINI_API_KEY|g\" /usr/share/nginx/html/js/config.js && exec nginx -g 'daemon off;'"]
