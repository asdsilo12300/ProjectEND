#!/usr/bin/env sh
set -eu

port="${PORT:-10000}"

case "$port" in
    *[!0-9]*|'')
        echo "PORT must be a number." >&2
        exit 1
        ;;
esac

sed "s/__PORT__/${port}/g" \
    /etc/apache2/ports.conf.template \
    > /etc/apache2/ports.conf

sed "s/__PORT__/${port}/g" \
    /etc/apache2/sites-available/000-default.conf.template \
    > /etc/apache2/sites-available/000-default.conf

mkdir -p \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

chown -R www-data:www-data storage bootstrap/cache

# Custom commands such as `php artisan migrate --force` should run directly.
if [ "$#" -gt 0 ] && [ "$1" != "apache2-foreground" ]; then
    exec "$@"
fi

# Render Free does not provide pre-deploy jobs. Migrations are idempotent and
# can run on startup when explicitly enabled by the service configuration.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    php artisan migrate --force --no-interaction
fi

# Resolve environment variables only when the container starts.
php artisan config:cache --no-interaction
php artisan view:cache --no-interaction

exec "$@"
