#!/bin/sh
set -eu

envsubst '${ZUT_PLAN_BASE_URL}' \
  < /usr/share/nginx/html/config.template.js \
  > /usr/share/nginx/html/config.js
