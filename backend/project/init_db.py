import os
from dotenv import load_dotenv
import MySQLdb

load_dotenv('.env')

conn = MySQLdb.connect(
    host=os.getenv('MYSQL_HOST', '127.0.0.1'),
    user=os.getenv('MYSQL_USER', 'root'),
    passwd=os.getenv('MYSQL_PASSWORD', ''),
    port=int(os.getenv('MYSQL_PORT', '3306'))
)
cursor = conn.cursor()
db_name = os.getenv('MYSQL_DATABASE', 'inventory_db')
cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
print(f"Database `{db_name}` created or already exists")
