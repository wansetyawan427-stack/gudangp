# 📦 GudangKu — Sistem Manajemen Gudang

Aplikasi web React untuk mengelola gudang dengan **login multi-role**, **POS kasir**, **manajemen stok**, dan **AI chat assistant**. Siap deploy ke **Vercel** + **Supabase**.

## ✨ Fitur

| Role | Akses |
|------|-------|
| 👑 **Admin** | Semua menu: Dashboard, Produk, Kategori, Stok, Kasir, Transaksi, Pengguna (buat/ubah/hapus pengguna & role) |
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
- **AI Generate Gambar** — minta gambar (mis. "buatkan gambar logo gudang"), hasilnya tampil langsung di chat.
- Scan barcode produk (stok & kasir).
- Grafik stok, peringatan stok menipis, riwayat pergerakan stok.
- Cetak nota transaksi.
- Foto produk (URL gambar) & kelola kategori.
- CRUD penuh semua entitas (produk, kategori, stok, transaksi, pengguna).

## 🧰 Teknologi

- **Frontend**: React 18, Vite, Tailwind CSS 4, React Router, Recharts
- **Backend**: Supabase (Auth, PostgreSQL + RLS, Edge Function)
- **AI**: Supabase Edge Function `ai-chat` (OpenAI-compatible API). Jika belum dikonfigurasi, otomatis memakai **bot lokal** yang tetap bisa menjawab soal produk/stok.

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

## 🧠 Setup AI Chat (Edge Function, opsional)

App sudah punya **bot lokal** sebagai fallback yang berfungsi tanpa konfigurasi apa pun.

Agar memakai AI sungguhan (termasuk **generate gambar**):

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
│   ├── components/                # Layout, Chat, Modal, Scanner, dsb
│   ├── pages/                     # Login, Dashboard, Produk, Kategori, Stok, Kasir, Transaksi, Pengguna
│   ├── context/AuthContext.jsx    # Auth global
│   └── lib/                       # supabase client, ai, format, print
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