#!/bin/bash
set -e
echo "Building project..."
python -m pip install -r requirements.txt
python manage.py collectstatic --noinput --clear
python manage.py migrate --noinput
echo "Build complete."
