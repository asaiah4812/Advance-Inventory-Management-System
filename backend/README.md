# MyDream Inventory System (Backend)

The backend service for the MyDream Inventory System. It is built using **Django** and **Django REST Framework (DRF)**. It provides robust REST APIs supporting JWT authentication, product/inventory tracking, category categorization, and offline-first synchronization for sales endpoints.

---

## 🚀 Tech Stack
* **Framework:** Django 6.0+
* **APIs:** Django REST Framework (DRF)
* **Authentication:** SimpleJWT (JSON Web Tokens)
* **Database:** PostgreSQL (Neon DB in production) / MySQL & SQLite (development)
* **Storage:** Cloudinary (for product images in production)
* **CSS System:** Tailwind CSS (for web dashboards and templates)
* **Deployment:** Vercel

---

## 📁 Project Structure
```text
backend/
├── env/                    # Python virtual environment
├── project/                # Django project root
│   ├── api/                # REST API application (models, views, serializers)
│   ├── web/                # Web templates application (dashboard, reports, analytics)
│   ├── theme/              # Tailwind CSS theme application
│   ├── project/            # Django main settings and routing configurations
│   ├── manage.py           # Django command-line utility
│   ├── db_dump.json        # Database backup
│   ├── datadump_migration.json  # Data fixture for cloud database migration
│   └── upload_media.py     # Script to sync local media uploads to Cloudinary
├── vercel.json             # Vercel deployment configuration
├── build_files.sh          # Vercel build script
└── requirements.txt        # Python dependency list
```

---

## 🛠️ Local Development Setup

### 1. Prerequisite Virtual Environment
Make sure you activate the virtual environment before running commands:
```powershell
# Windows PowerShell
.\env\Scripts\activate
```

### 2. Configure Environment Variables
Create a `.env` file in the `project/` directory:
```env
# Security & Debug Settings
SECRET_KEY=your-django-secret-key
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# MySQL (Development fallback)
MYSQL_DATABASE=inventory_db
MYSQL_USER=root
MYSQL_PASSWORD=yourpassword
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306

# Neon PostgreSQL Database (Production / Online)
DATABASE_URL=postgresql://[user]:[password]@[host]/[db]?sslmode=require

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run Migrations & Start Server
```bash
cd project
python manage.py migrate
python manage.py runserver
```
The server will start running locally at `http://127.0.0.1:8000/`.

---

## 📦 Cloud Database & Media Migration

To sync your local data and media assets to the online production environment (Neon DB & Cloudinary):

### 1. Migrate Data to Neon DB
Ensure your `DATABASE_URL` in `.env` is pointed to your online Neon Database.
```bash
# Apply database schemas
python manage.py migrate

# Load your local dump file into the cloud database
python manage.py loaddata datadump_migration.json
```

### 2. Upload Media to Cloudinary
Run the helper upload script to push local product images to your Cloudinary account:
```bash
python upload_media.py
```

---

## ☁️ Vercel Deployment

This project is configured to deploy directly to Vercel:
1. Push this backend repository to your GitHub.
2. Connect the repository to **Vercel**.
3. In Vercel, add your environment variables under **Project Settings > Environment Variables** (make sure to set `DJANGO_DEBUG=False` for production security).
4. Vercel will automatically run the build steps using `build_files.sh` and compile static assets.
