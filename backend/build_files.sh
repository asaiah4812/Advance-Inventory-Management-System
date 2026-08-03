#!/bin/bash
set -e
echo "Building project..."
python -m pip install -r requirements.txt
python project/manage.py collectstatic --noinput --clear
python project/manage.py migrate --noinput
echo "Build complete."
