# Offline vendor assets

These files are served locally (no CDN required):

- `alpine.min.js` — Alpine.js 3.14.9
- `chart.umd.min.js` — Chart.js 4.4.8
- `localforage.min.js` — localForage 1.10.0
- `uuid.min.js` — uuid 8.3.2

To refresh after upgrading versions, from `theme/static_src`:

```bash
npm install alpinejs@3.14.9 chart.js@4.4.8 localforage@1.10.0 uuid@8.3.2 --no-save
```

Then copy from `node_modules` into this folder (see project setup docs).
