# 📦 GudangKu — Sistem Manajemen Gudang

Aplikasi web React untuk mengelola gudang dengan **login multi-role**, **POS kasir**, **manajemen stok**, dan **AI chat assistant**. Siap deploy ke **Vercel** + **Supabase**.

## ✨ Fitur

| Role | Akses |
|------|-------|
| 👑 **Admin** | Semua menu: Dashboard, Produk, Kategori, Stok, Kasir, Transaksi, Pengguna (buat/ubah/hapus pengguna & role), **Pengaturan** (tema + API key Gemini) |
| 📦 **Gudang** | Dashboard, Produk (tambah/edit, tidak hapus), Kategori, Stok (masuk/keluar + edit/hapus riwayat) |
| 🧾 **Kasir** | Dashboard, Kasir (POS + scan barcode + cetak nota), Transaksi (lihat, ubah metode, void/batalkan) |
| 🛍️ **Pelanggan** | Dashboard, Belanja (keranjang & checkout), Riwayat transaksi miliknya |

**Sistem CRUD lengkap:**
- **Produk** — tambah, lihat, edit, hapus (hapus hanya admin).
- **Kategori** — tambah, lihat, edit, hapus (admin & gudang; tidak bisa hapus bila masih dipakai produk).
- **Stok** — tambah masuk/keluar, edit riwayat, hapus riwayat (stok produk otomatis dikoreksi saat edit/hapus).
- **Transaksi** — dibuat lewat Kasir/POS, lihat detail, **ubah metode bayar**, **void/batalkan** (stok dikembalikan otomatis).
- **Pengguna** — admin bisa **tambah akun** (via Edge Function), ubah role, dan hapus pengguna.

- **AI Chat Assistant** tersedia untuk semua role (klik tombol chat kanan bawah).
- **AI Gemini (Google)** — chat langsung memakai Gemini API (function calling untuk query produk/stok + **generate gambar via Imagen**). API key diatur admin di menu **Pengaturan**, atau via `VITE_GEMINI_API_KEY`.
- **Generate Barcode & QR otomatis** — saat tambah/edit barang klik tombol **Generate** untuk membuat barcode EAN-13 + QR otomatis (QR membuka halaman produk saat discan). Lihat & cetak lewat ikon QR di kartu produk.
- **Tema Light / Dark** — ubah lewat tombol matahari/bulan di header atau menu **Pengaturan**.
- Scan barcode produk (stok & kasir).
- Grafik stok, peringatan stok menipis, riwayat pergerakan stok.
- Cetak nota transaksi.
- Foto produk (URL gambar) & kelola kategori.
- CRUD penuh semua entitas (produk, kategori, stok, transaksi, pengguna).

## 🧰 Teknologi

- **Frontend**: React 18, Vite, Tailwind CSS 4, React Router, Recharts, jsbarcode + qrcode
- **Backend**: Supabase (Auth, PostgreSQL + RLS, Edge Function)
- **AI**: Google **Gemini** (langsung dari browser, tool calling + Imagen untuk gambar). Cadangan: Edge Function `ai-chat` (OpenAI-compatible). Jika keduanya belum dikonfigurasi, otomatis memakai **bot lokal** yang tetap bisa menjawab soal produk/stok.

## 🚀 Setup Lokal

```bash
npm install
cp .env.example .env   # isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
```

## 🗄️ Setup Supabase

1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor** → paste isi `supabase/schema.sql` → **Run**. (Membuat tabel, RLS, fungsi `create_sale`/`void_sale`/CRUD stok, trigger auto-profile, dan seed contoh.)
   > Sudah pernah install sebelumnya? Jalankan saja `supabase/upgrade.sql` untuk menambah fitur baru.
3. **Authentication → Providers → Email**: matikan **Confirm email** agar signup langsung masuk (opsional, lebih mudah untuk testing).
4. Salin nilai ke `.env`:
   - **Project Settings → API**: Project URL → `VITE_SUPABASE_URL`, Project API keys → anon public → `VITE_SUPABASE_ANON_KEY`.

> Pengguna **pertama** yang mendaftar otomatis menjadi **Admin**. Selanjutnya default **Pelanggan**. Admin bisa mengubah role pengguna di menu **Pengguna**.

## 🧠 Setup AI Chat

App sudah punya **bot lokal** sebagai fallback yang berfungsi tanpa konfigurasi apa pun.

### Opsi 1 (disarankan): Google Gemini langsung

1. Login sebagai **admin** → buka menu **Pengaturan → AI Gemini**.
2. Masukkan **API key Gemini** https://aistudio.google.com/apikey → **Simpan** → **Uji Koneksi**.
3. Selesai! Untuk **mengganti model**, isi kolom **Model Gemini** (mis. `gemini-2.5-pro`, kosongkan = `gemini-2.0-flash`) → **Simpan** → **Uji Koneksi**.

Agar **semua pengguna** ikut memakai Gemini, tambahkan di `.env` sebelum build:
```
VITE_GEMINI_API_KEY=AIzaSy...
VITE_GEMINI_MODEL=gemini-2.5-pro    # opsional, default gemini-2.0-flash
```
Aplikasi memakai `VITE_GEMINI_API_KEY` jika key admin belum tersimpan di browser pengguna.

### Opsi 2: Edge Function (OpenAI-compatible)

```bash
npm install -g supabase
supabase login
supabase init
supabase link --project-ref <PROJECT_REF>
supabase functions deploy ai-chat --no-verify-jwt
supabase functions deploy admin-create-user --no-verify-jwt   # wajib utk "Tambah Pengguna" oleh admin
```

Lalu set secret di **Dashboard → Edge Functions → ai-chat → Secrets**:

| Secret | Contoh |
|--------|--------|
| `AI_API_KEY` | `sk-xxxx` (OpenAI / OpenRouter / Groq, dsb) |
| `AI_BASE_URL` | `https://api.openai.com/v1` (default) |
| `AI_MODEL` | `gpt-4o-mini` (default) |
| `AI_IMAGE_KEY` | opsional, default memakai `AI_API_KEY` |
| `AI_IMAGE_BASE_URL` | `https://api.openai.com/v1` (default) |
| `AI_IMAGE_MODEL` | `dall-e-3` (default) |

> **Generate gambar** bekerja dengan model penyedia yang punya endpoint `/images/generations` (mis. OpenAI DALL·E). Ketik di chat mis. "buatkan gambar logo gudang" → URL gambar muncul langsung di percakapan, dan bisa dipakai sebagai foto produk.

> Prioritas AI di chat: **Gemini** (jika ada key) → **Edge Function ai-chat** → **bot lokal**. Barcode EAN-13 dibuat otomatis (13 digit valid) saat tambah produk; QR menampilkan tautan langsung ke halaman produk. Data barcode dipakai oleh scanner barcode di menu **Stok** & **Kasir**.

Edge function `ai-chat` memverifikasi JWT login, punya **tool calling** (query produk, cek stok menipis, riwayat stok, ringkasan dashboard, **generate_image**), dan menjawab dalam bahasa Indonesia.

## ▲ Deploy ke Vercel

1. Push repository ini ke GitHub lalu import di [vercel.com](https://vercel.com), **atau** pakai Vercel CLI:

   ```bash
   npm i -g vercel
   vercel
   ```

2. Tambahkan Environment Variables di Vercel (Project → Settings → Environment Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GEMINI_API_KEY` (opsional — agar AI Gemini aktif untuk semua pengguna)

3. Deploy. Build script otomatis `vite build`, output static di-fallback ke `index.html` (sudah diatur di `vercel.json`), jadi routing React bekerja normal.

## 🗂️ Struktur

```
├── supabase/
│   ├── schema.sql                 # Tabel + RLS + fungsi CRUD + seed
│   ├── upgrade.sql                # Untuk instalasi lama
│   └── functions/
│       ├── ai-chat/index.ts       # Edge Function AI (tool calling + generate gambar)
│       └── admin-create-user/index.ts  # Admin membuat pengguna
├── src/
│   ├── App.jsx                    # Routing & protected routes
│   ├── components/                # Layout, Chat, Modal, BarcodeQR, Scanner, dsb
│   ├── pages/                     # Login, Dashboard, Produk, Kategori, Stok, Kasir, Transaksi, Pengguna, Pengaturan
│   ├── context/                   # AuthContext, ThemeContext
│   └── lib/                       # supabase client, ai, gemini, barcode, format, print
├── .env.example
└── vercel.json
```

## 🔐 Role & Permissions (rules di sisi aplikasi + Supabase RLS)

- **Admin**: akses semua halaman; kelola pengguna & role.
- **Gudang**: hanya **Produk** (tambah/edit, tidak bisa hapus) & **Stok** (masuk/keluar).
- **Kasir**: **Kasir (POS)** & **Transaksi**; tidak bisa ubah stok manual.
- **Pelanggan**: **Belanja** (order via `create_sale`) & **Riwayat** transaksi miliknya sendiri.

RLS menjamin pelanggan hanya melihat transaksinya sendiri, stok hanya bertambah/berkurang oleh role yang berwenang, dan penjualan memotong stok secara atomik lewat fungsi `create_sale` (security definer).

## 🧪 Akun Uji Coba

Daftar akun dengan email/password apa pun. Semua role bisa diuji:

1. Daftar **pengguna pertama** → otomatis **Admin**.
2. Buat akun lain → ubah rolenya jadi **Gudang / Kasir / Pelanggan** lewat menu Pengguna (admin).
3. Masuk sebagai masing-masing role untuk melihat menu yang berbeda serta AI Chat.