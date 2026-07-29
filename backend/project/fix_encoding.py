import json

try:
    with open('db_dump.json', 'r', encoding='utf-16') as f:
        data = f.read()
    with open('db_dump.json', 'w', encoding='utf-8') as f:
        f.write(data)
    print("Fixed encoding")
except Exception as e:
    print(f"Error: {e}")
