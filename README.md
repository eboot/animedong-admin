# AnimeDong Admin

Halaman backend/admin untuk aplikasi **AnimeDong** — scraping data anime &
donghua dari API dan menyimpannya ke database SQLite bernama **home**. Dibangun
di atas
[CoreUI Free React Admin Template](https://github.com/coreui/coreui-free-react-admin-template)
(halaman default template sudah dihapus).

## Menu

| Menu      | Isi                                                                          |
| --------- | ---------------------------------------------------------------------------- |
| Dashboard | Kartu statistik + grafik anime per sumber & jadwal per hari + scrape terakhir |
| Anime     | List anime hasil scraping (terbaru dulu) + form scrape; judul link ke detail |
| Jadwal    | Jadwal rilis anime per hari (Senin..Minggu) + tombol scrape                  |
| Donghua   | List donghua hasil scraping + form scrape; judul link ke detail              |

## Struktur

```
animedong-admin/
├── src/                    # Frontend React (CoreUI)
│   ├── _nav.jsx            # Menu: Dashboard, Anime, Jadwal, Donghua
│   ├── routes.js
│   └── views/
│       ├── dashboard/      # Halaman kosong
│       ├── anime/          # Anime.jsx + AnimeDetail.jsx
│       ├── schedule/       # Halaman jadwal
│       └── donghua/        # Donghua.jsx + DonghuaDetail.jsx
├── backend/
│   ├── server.js           # Express API (port 3001)
│   ├── scrape.js           # Fetch + normalisasi 4 sumber anime + jadwal + donghua
│   ├── db.js               # SQLite (node:sqlite bawaan)
│   └── data/home.sqlite    # Database "home" (dibuat otomatis, jangan di-commit)
└── build/                  # Hasil `npm run build` (disajikan backend bila ada)
```

## Cara jalan

**Satu perintah (frontend + backend jadi satu proses):**

```bash
npm run install:all   # sekali saja: install dep frontend & backend
npm run prod          # build frontend + jalan di http://localhost:3001
```

Satu proses Node menyajikan halaman admin sekaligus API (`/api/*`).

**Mode dev (satu perintah, untuk ngoding):**

```bash
npm run dev
```

Satu perintah ini menjalankan frontend (vite dev di `http://localhost:3000`) dan
backend API (`http://localhost:3001`) bersamaan, masing-masing dengan hot reload.
Ctrl+C mematikan keduanya sekaligus. Masih bisa juga dijalankan manual di dua
terminal (`cd backend && npm run dev` dan `npm start`) kalau mau.

Frontend memanggil backend lewat `VITE_API_URL` (default `http://localhost:3001`).

**Jalan di IP publik / VPS** (mis. Oracle): frontend dev perlu `--host`
(sudah termasuk di `npm run dev`), dan `VITE_API_URL` di `.env` harus diisi
IP publik VM — `VITE_API_URL=http://<IP-PUBLIK>:3001` — karena browser di
laptopmu yang akan memanggil API itu. Buka juga firewall: TCP **3000** dan
**3001** (Security List di OCI Console + iptables/ufw di VM). Kalau port 3001
bentrok (`EADDRINUSE`), matikan dulu proses/servis lama yang memakainya
(`sudo systemctl stop animedong-admin` atau `npx kill-port 3001`).

## Halaman Anime

- Dropdown **URL API Sumber** berisi:
  - Otaku — `http://168.110.213.108/otakudesu/home`
  - Samehadaku — `https://www.sankavollerei.web.id/anime/samehadaku/home`
  - Anoboy — `https://www.sankavollerei.web.id/anime/anoboy/home?page=1`
  - Animeindo — `https://www.sankavollerei.web.id/anime/stream/latest`
- Tombol **Scrape & Simpan**: ambil data dari API terpilih, simpan ke database
  `home`. Data yang **sudah ada dilewati** (unik per `source` + `anime_id`).
- Tabel urut dari yang **terbaru di-scrape**, plus kolom pencarian judul.
- **Judul berupa link aktif** ke halaman detail: `/anime/detail/{anime_id}`.
- Field URL eksternal (`samehadakuUrl` / `otakudesuUrl` / url situs sumber)
  **tidak disimpan** di database.

## Halaman Jadwal

- Seperti halaman Anime, khusus jadwal rilisan: tombol **Scrape & Simpan**
  mengambil `http://168.110.213.108/otakudesu/schedule`.
- Filter hari (Senin..Minggu) + pencarian judul; tabel urut hari.
- Judul juga link ke halaman detail anime.

## Halaman Detail Anime (`/anime/detail/{anime_id}`)

- Buka data dari **database** bila sudah disimpan; bila belum, **ambil live**
  dari `http://168.110.213.108/otakudesu/anime/{anime_id}`.
- Tombol **Ambil Ulang dari API** untuk refresh paksa dari API.
- **Form edit**: judul, poster, judul Jepang, skor, produser, tipe, status,
  episode, durasi, tayang, studio, genre, sinopsis → **Simpan ke Database**.
- **Daftar episode** dari `episodeId`: tiap episode ada tombol **Stream**
  (buka `http://168.110.213.108/otakudesu/episode/{episodeId}`) dan
  tombol **Lihat Server** → daftar server per kualitas → klik server untuk
  melihat URL stream dari `http://168.110.213.108/otakudesu/server/{serverId}`.
- **Cache URL stream**: URL stream tiap server disimpan di database saat
  pertama diambil (`stream_cache`); kunjungan berikutnya disajikan dari
  database (badge "tersimpan di database"), dengan link **Ambil ulang dari
  API** (`?fresh=1`) untuk refresh paksa.

## Halaman Donghua (`/donghua`, `/donghua/:slug`)

- Dropdown sumber: Donghua —
  `https://www.sankavollerei.web.id/anime/donghua/latest/1`
  (mengembalikan slug serial, bukan per episode).
- Tombol **Scrape & Simpan**: simpan ke tabel `donghua`; data yang **sudah
  ada dilewati** (unik per `source` + `slug`).
- **Judul berupa link aktif** ke halaman detail: `/donghua/:slug`.
- Halaman detail: buka dari **database** bila sudah disimpan; bila belum,
  **ambil live** dari API. Tombol **Ambil Ulang dari API** (`?fresh=1`).
- **Form edit**: judul, poster, cover, status, tipe, rating, studio, network,
  rilis, durasi, jumlah episode, season, negara, subber, genre, sinopsis →
  **Simpan ke Database**.
- **Daftar episode** dari `episodes_list`; tiap episode ada tombol **Lihat
  Server** → daftar server streaming (embed URL langsung, tanpa rantai
  serverId seperti di anime). Hasil streaming per episode di-cache di
  database (`donghua_stream`).
- Field URL eksternal (`href` / `anichinUrl`) **tidak disimpan** di database.

## API Backend

| Method | Endpoint                  | Keterangan                                                      |
| ------ | ------------------------- | --------------------------------------------------------------- |
| GET    | /api/sources              | Daftar sumber API anime (untuk dropdown)                        |
| GET    | /api/home                 | List anime, terbaru dulu. Param: `source`, `q`, `page`, `limit` |
| POST   | /api/scrape               | Body `{ "source": "<key atau url API>" }` → scrape & simpan; `schedule` untuk jadwal |
| GET    | /api/schedule             | List jadwal, urut hari. Param: `day`, `q`, `page`, `limit`       |
| GET    | /api/anime/:animeId       | Detail anime (db dulu, bila belum → live). `?fresh=1` paksa live |
| PUT    | /api/anime/:animeId       | Simpan/update detail anime dari form                            |
| GET    | /api/episode/:episodeId   | Data episode + daftar server per kualitas (live)                |
| GET    | /api/server/:serverId     | URL stream sebuah server — dari db bila tersimpan (`cached: true`), `?fresh=1` paksa live |
| GET    | /api/stats                | Jumlah data per sumber + waktu scrape terakhir                  |
| GET    | /api/dashboard            | Ringkasan untuk Dashboard (total, per sumber/hari, scrape terakhir) |
| GET    | /api/donghua/sources      | Daftar sumber API donghua (untuk dropdown)                      |
| GET    | /api/donghua              | List donghua, terbaru dulu. Param: `q`, `page`, `limit`         |
| POST   | /api/donghua/scrape       | Body `{ "source": "donghua" atau URL API }` → scrape & simpan   |
| GET    | /api/donghua/:slug        | Detail donghua (db dulu, bila belum → live). `?fresh=1` paksa live |
| PUT    | /api/donghua/:slug        | Simpan/update detail donghua dari form                          |
| GET    | /api/donghua/episode/:slug | Daftar server streaming episode — dari db bila tersimpan (`cached: true`), `?fresh=1` paksa live |

## Skema database `home.sqlite`

- Tabel `home`: `id, source, anime_id, title, poster, episodes, released_on,
  release_day, type, href, scraped_at` — `UNIQUE(source, anime_id)`.
- Tabel `schedule`: `id, day, anime_id, title, poster, url, scraped_at` —
  `UNIQUE(day, anime_id)`.
- Tabel `anime_detail`: `anime_id` (PK), `title, poster, japanese, score,
  producers, type, status, episodes, duration, aired, studios, synopsis,
  genres, episode_list, updated_at`.
- Tabel `stream_cache`: `server_id` (PK), `url, fetched_at` — cache URL
  stream per server anime.
- Tabel `donghua`: `id, source, slug, title, poster, status, type,
  current_episode, scraped_at` — `UNIQUE(source, slug)`.
- Tabel `donghua_detail`: `slug` (PK), `title, poster, cover, status, type,
  rating, studio, network, released, duration, episodes_count, season,
  country, subber, genres, synopsis, episodes_list, updated_at`.
- Tabel `donghua_stream`: `slug` (PK), `data, fetched_at` — cache JSON daftar
  server streaming per episode donghua.
