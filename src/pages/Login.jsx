import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user && profile) navigate('/', { replace: true })
  }, [user, profile, navigate])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/', { replace: true })
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName || email.split('@')[0] } },
        })
        if (error) throw error
        if (data?.session) {
          navigate('/', { replace: true })
        } else {
          setInfo(
            'Registrasi berhasil! Cek email kamu untuk konfirmasi, lalu login. Pengguna pertama otomatis menjadi Admin.'
          )
        }
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-900">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-12 lg:flex">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur">
            📦
          </div>
          <div>
            <p className="text-xl font-bold">GudangKu</p>
            <p className="text-sm text-emerald-100">Sistem Manajemen Gudang</p>
          </div>
        </div>

        <div className="relative text-white">
          <h1 className="text-4xl font-extrabold leading-tight">
            Kelola gudang,
            <br />
            penjualan & stok
            <br />
            dalam satu tempat.
          </h1>
          <p className="mt-4 max-w-md text-emerald-50/90">
            Login sebagai Admin, Gudang, Kasir, atau Pelanggan. Setiap role punya menu dan izin
            berbeda, plus asisten AI untuk membantu pekerjaanmu.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {['Admin', 'Gudang', 'Kasir', 'Pelanggan'].map((r) => (
              <span
                key={r}
                className="rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold backdrop-blur"
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-emerald-100/70">
          React • Supabase • Vercel — dibangun dengan AI Chat Assistant
        </p>
      </div>

      <div className="flex w-full items-center justify-center bg-slate-100 p-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-xl">
              📦
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">GudangKu</p>
              <p className="text-xs text-slate-500">Manajemen Gudang</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
            <h2 className="text-xl font-bold text-slate-800">
              {mode === 'login' ? 'Masuk ke akun' : 'Buat akun baru'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'login'
                ? 'Masukkan email dan kata sandi kamu.'
                : 'Pengguna pertama otomatis menjadi Admin, selanjutnya Pelanggan.'}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {['login', 'signup'].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m)
                    setError('')
                    setInfo('')
                  }}
                  className={`rounded-lg py-2 text-sm font-medium transition ${
                    mode === m ? 'bg-white text-slate-800 shadow' : 'text-slate-500'
                  }`}
                >
                  {m === 'login' ? 'Masuk' : 'Daftar'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Nama Lengkap
                  </label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nama kamu"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Kata Sandi
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
                  {error}
                </p>
              )}
              {info && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-700">
                  {info}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar'}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-slate-400">
              Setelah masuk, semua role mendapatkan akses ke{' '}
              <span className="font-semibold text-emerald-600">AI Chat Asisten</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}