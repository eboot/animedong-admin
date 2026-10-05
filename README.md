# AnimeDong Admin

Halaman backend/admin untuk aplikasi **AnimeDong** — scraping data anime dari API
dan menyimpannya ke database SQLite bernama **home**. Dibangun di atas
[CoreUI Free React Admin Template](https://github.com/coreui/coreui-free-react-admin-template)
(halaman default template sudah dihapus).

## Menu

| Menu      | Isi                                                                          |
| --------- | ---------------------------------------------------------------------------- |
| Dashboard | Halaman kosong                                                               |
| Anime     | List anime hasil scraping (terbaru dulu) + form scrape; judul link ke detail |
| Jadwal    | Jadwal rilis anime per hari (Senin..Minggu) + tombol scrape                  |
| Donghua   | Placeholder (segera hadir)                                                   |

## Struktur

```
animedong-admin/
├── src/                    # Frontend React (CoreUI)
│   ├── _nav.jsx            # Menu: Dashboard, Anime, Donghua
│   ├── routes.js
│   └── views/
│       ├── dashboard/      # Halaman kosong
│       ├── anime/          # Select API + tombol Scrape + tabel
│       └── donghua/        # Placeholder
├── backend/
│   ├── server.js           # Express API (port 3001)
│   ├── scrape.js           # Fetch + normalisasi 3 sumber API
│   ├── db.js               # SQLite (node:sqlite bawaan)
│   └── data/home.sqlite    # Database "home" (dibuat otomatis)
└── dist/                   # Hasil `npm run build` (disajikan backend bila ada)
```

## Cara jalan

**Satu perintah (frontend + backend jadi satu proses):**

```bash
npm run install:all   # sekali saja: install dep frontend & backend
npm run prod          # build frontend + jalan di http://localhost:3001
```

Satu proses Node menyajikan halaman admin sekaligus API (`/api/*`).

**Mode dev (dua terminal, untuk ngoding):**

```bash
# terminal 1 — backend
cd backend && npm start     # http://localhost:3001
# terminal 2 — frontend
npm start                   # vite dev, panggil API via VITE_API_URL
```

Frontend memanggil backend lewat `VITE_API_URL` (default `http://localhost:3001`).

## Halaman Anime

- Dropdown **URL API Sumber** berisi:
  - Anime Home — `https://www.sankavollerei.web.id/anime/home`
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
  mengambil `https://www.sankavollerei.web.id/anime/schedule`.
- Filter hari (Senin..Minggu) + pencarian judul; tabel urut hari.
- Judul juga link ke halaman detail anime.

## Halaman Detail Anime (`/anime/detail/{anime_id}`)

- Buka data dari **database** bila sudah disimpan; bila belum, **ambil live**
  dari `https://www.sankavollerei.web.id/anime/anime/{anime_id}`.
- Tombol **Ambil Ulang dari API** untuk refresh paksa dari API.
- **Form edit**: judul, poster, judul Jepang, skor, produser, tipe, status,
  episode, durasi, tayang, studio, genre, sinopsis → **Simpan ke Database**.
- **Daftar episode** dari `episodeId`: tiap episode ada tombol **Stream**
  (buka `https://www.sankavollerei.web.id/anime/episode/{episodeId}`) dan
  tombol **Lihat Server** → daftar server per kualitas → klik server untuk
  melihat URL stream dari `https://www.sankavollerei.web.id/anime/server/{serverId}`.

## API Backend

| Method | Endpoint                  | Keterangan                                                      |
| ------ | ------------------------- | --------------------------------------------------------------- |
| GET    | /api/sources              | Daftar sumber API (untuk dropdown)                              |
| GET    | /api/home                 | List anime, terbaru dulu. Param: `source`, `q`, `page`, `limit`  |
| POST   | /api/scrape               | Body `{ "source": "<key atau url API>" }` → scrape & simpan; `schedule` untuk jadwal |
| GET    | /api/schedule             | List jadwal, urut hari. Param: `day`, `q`, `page`, `limit`       |
| GET    | /api/anime/:animeId       | Detail anime (db dulu, bila belum → live). `?fresh=1` paksa live |
| PUT    | /api/anime/:animeId       | Simpan/update detail anime dari form                            |
| GET    | /api/episode/:episodeId   | Data episode + daftar server per kualitas (live)                |
| GET    | /api/server/:serverId     | URL stream sebuah server (live)                                 |
| GET    | /api/stats                | Jumlah data per sumber + waktu scrape terakhir                  |

## Skema database `home.sqlite`

- Tabel `home`: `id, source, anime_id, title, poster, episodes, released_on,
  release_day, type, href, scraped_at` — `UNIQUE(source, anime_id)`.
- Tabel `schedule`: `id, day, anime_id, title, poster, url, scraped_at` —
  `UNIQUE(day, anime_id)`.
- Tabel `anime_detail`: `anime_id` (PK), `title, poster, japanese, score,
  producers, type, status, episodes, duration, aired, studios, synopsis,
  genres, episode_list, updated_at`.
