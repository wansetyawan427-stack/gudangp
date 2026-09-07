import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ConfigScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-2xl">
            📦
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">GudangKu</h1>
            <p className="text-sm text-slate-500">Belum dikonfigurasi</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">
          Aplikasi perlu dikonfigurasi dulu dengan kredensial Supabase. Buat file
          <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium">.env</code>
          di root project:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-emerald-300">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
`}
        </pre>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Setelah itu jalankan <code className="rounded bg-slate-100 px-1 font-medium">npm run dev</code>.
          Lihat README.md untuk panduan lengkap.
        </p>
      </div>
    </div>
  )
}

export function isConfigReady() {
  return Boolean(supabase)
}