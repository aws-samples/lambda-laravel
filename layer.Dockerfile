FROM public.ecr.aws/awsguru/php:devel.81.2023.3.13.1 AS builder

#COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.7.0 /lambda-adapter /opt/extensions/

# Your builders code here
# You can install or disable some extensions
# RUN pecl install intl

RUN /lambda-layer php_disable shmop \
                              calendar \
                              xmlrpc \
                              sysvsem \
                              sysvshm \
                              pdo_pgsql \
                              pgsql \
                              bz2 \
                              intl \
                              ftp \
                              awscrt \
                              bcmath \
                              pdo_sqlite \
                              gd \
                              sodium \
                              igbinary \
                              imagick \
                              xsl \
                              xmlwriter \
                              phar \
                              && \
    /lambda-layer php_release

FROM public.ecr.aws/sam/emulation-java11

COPY --from=builder /opt            /opt
COPY --from=builder /lambda-layer /lambda-layer

RUN rm -rf /opt/php/bin/php && \
    /lambda-layer clean_libs
