FROM nginx:alpine

# remove default config
RUN rm /etc/nginx/conf.d/default.conf

# copy main config
COPY nginx.conf /etc/nginx/nginx.conf

# copy site config
COPY conf.d /etc/nginx/conf.d