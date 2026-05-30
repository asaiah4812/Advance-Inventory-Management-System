# MyDream Inventory System

A full-stack inventory and point-of-sale (POS) platform for retail shops. Manage stock from the web, run sales at the counter or on the floor, and keep the mobile app working even when the network drops.

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-6.0-092E20?logo=django&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.85-61DAFB?logo=react&logoColor=black)
![Expo](https://img.shields.io/badge/Expo-SDK_56-000020?logo=expo&logoColor=white)

---

## About the project

**MyDream Inventory System** helps small and medium retailers track products, process sales, and monitor performance in one place.

| Client | Who it's for | What you can do |
|--------|--------------|-----------------|
| **Web dashboard** | Managers & cashiers | Dashboard, POS, inventory, staff, reports, light/dark theme |
| **Mobile app (InventoryPro)** | Floor staff | Barcode scan, cart checkout, offline sync, product CRUD |

### Highlights

- Product catalog with barcodes, categories, images, and low-stock alerts
- Web POS and mobile POS with automatic stock deduction
- JWT auth for mobile, session auth for web, role-based sales visibility
- Offline sale queue on mobile with bulk sync to the API
- Real-time dashboard (WebSockets via Django Channels, with polling fallback)
- Tailwind CSS + Alpine.js on the web UI (works offline, no CDN)

---

## About the developer

**Asaiah** — full-stack developer building practical tools for real businesses.

- GitHub: [@asaiah4812](https://github.com/asaiah4812)
- Focus: Django REST APIs, React Native / Expo, and offline-first mobile apps
- This project was built as a complete inventory + POS solution for retail operations

> Replace the links above with your portfolio, LinkedIn, or email if you want this README to serve as your project portfolio page on GitHub.

---

## Tech stack

| Layer | Technologies |
|-------|----------------|
| Backend | Python, Django 6, DRF, Simple JWT, django-cors-headers, Channels, django-tailwind, SQLite |
| Web | Django templates, Tailwind CSS, Alpine.js, Chart.js (local vendor bundles) |
| Mobile | React Native 0.85, Expo SDK 56, Expo Router, TypeScript, Expo Camera, AsyncStorage |

---

## Project structure

```
mydream_inventory_system/
├── .gitignore
├── .env.example              # Environment variable template (do not commit .env)
├── README.md
├── backend/
│   ├── requirements.txt
│   ├── env/                  # Local venv (ignored by git)
│   └── project/
│       ├── api/              # REST API
│       ├── web/              # Web UI views & templates
│       ├── theme/            # django-tailwind theme app
│       ├── project/          # Django settings & URLs
│       ├── templates/
│       ├── static/vendor/    # Offline JS (Alpine, Chart.js, etc.)
│       ├── media/            # Uploaded product images (runtime)
│       └── manage.py
└── frontend/
    ├── app/                  # Expo Router screens
    ├── services/             # API, auth, sync
    └── package.json
```

---

## Quick start

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm
- [Expo Go](https://expo.dev/go) (SDK 56) on a phone, or an emulator
- Same Wi‑Fi network for phone ↔ dev machine testing

### 1. Backend

```bash
cd backend
python -m venv env

# Windows
env\Scripts\activate

# macOS / Linux
source env/bin/activate

pip install -r requirements.txt
cd project
python manage.py migrate
python manage.py createsuperuser
python manage.py tailwind install   # first time only
python manage.py tailwind build     # compile CSS
python manage.py runserver 0.0.0.0:8000
```

For live dashboard WebSockets, Channels is already in `requirements.txt`. Run with `runserver` as above.

### 2. Mobile app

```bash
cd frontend
npm install
```

Set your machine's LAN IP in `frontend/services/api.ts`:

```ts
const API_URL = 'http://192.168.x.x:8000';
```

```bash
npx expo start -c
```

Log in with a Django user from `createsuperuser` or the web staff UI.

### 3. Web UI

| URL | Description |
|-----|-------------|
| `http://localhost:8000/` | Dashboard |
| `http://localhost:8000/login/` | Login |
| `http://localhost:8000/pos/` | Web POS |
| `http://localhost:8000/inventory/` | Products |
| `http://localhost:8000/reports/` | Reports |
| `http://localhost:8000/staff/` | Staff (superuser) |
| `http://localhost:8000/admin/` | Django Admin |

---

## API overview

Base path: `/api/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/token/` | JWT login |
| `POST` | `/api/token/refresh/` | Refresh token |
| `GET`, `POST` | `/api/products/` | List / create products (`?barcode=`) |
| `GET`, `PUT`, `DELETE` | `/api/products/<id>/` | Product detail |
| `GET`, `POST` | `/api/sales/` | Sales |
| `POST` | `/api/sync/` | Bulk offline sync |
| `GET` | `/api/me/` | Current user (JWT) |
| `GET` | `/api/stats/` | Today's stats (JWT) |

Several endpoints use open permissions during development — lock these down before production.

---

## Push to GitHub

This repo should be its **own** Git repository (not nested inside your user folder).

```bash
cd mydream_inventory_system
git init
git add .
git commit -m "Initial commit: MyDream Inventory System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mydream-inventory-system.git
git push -u origin main
```

Create the empty repo on GitHub first: **New repository** → name it `mydream-inventory-system` → do **not** add a README (this project already has one).

---

## Security checklist (production)

- [ ] Set `DEBUG = False` and configure `ALLOWED_HOSTS`
- [ ] Move `SECRET_KEY` to an environment variable
- [ ] Restrict API permissions to `IsAuthenticated`
- [ ] Restrict CORS to trusted origins
- [ ] Use PostgreSQL instead of SQLite
- [ ] Serve static/media via a proper web server or CDN
- [ ] Enable HTTPS

---

## License

No license file is included yet. Add an `LICENSE` file (e.g. MIT) if you plan to open-source or share this project.
