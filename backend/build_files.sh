#!/bin/bash
echo "Building project..."
python -m pip install -r requirements.txt
python project/manage.py collectstatic --noinput --clear
echo "Build complete."
