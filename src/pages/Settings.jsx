import { useEffect, useState } from 'react'
import { Sun, Moon, KeyRound, CheckCircle2, Loader2, Eye, EyeOff, Save, Trash2, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'
import { saveGeminiKeyLocal, testGeminiKey } from '../lib/gemini'

export default function Settings() {
  const { theme, toggleTheme } = useTheme()
  const [geminiKey, setGeminiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!supabase) return
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'gemini_api_key')
        .maybeSingle()
      if (active) {
        if (data?.value) {
          setGeminiKey(data.value)
          saveGeminiKeyLocal(data.value)
        } else {
          setGeminiKey(localStorage.getItem('gudangku-gemini-key') || '')
        }
        if (error) setStatus({ ok: false, msg: `Gagal membaca pengaturan: ${error.message}` })
        else setStatus({ ok: true, msg: 'Pengaturan dimuat.' })
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const saveKey = async () => {
    setSaving(true)
    setStatus(null)
    saveGeminiKeyLocal(geminiKey.trim())
    try {
      if (supabase) {
        const { error } = await supabase.from('settings').upsert(
          { key: 'gemini_api_key', value: geminiKey.trim(), updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
        if (error) throw error
      }
      setStatus({ ok: true, msg: 'API key Gemini disimpan.' })
    } catch (e) {
      setStatus({ ok: false, msg: `Gagal menyimpan: ${e.message}` })
    } finally {
      setSaving(false)
    }
  }

  const clearKey = async () => {
    setGeminiKey('')
    setStatus(null)
    saveGeminiKeyLocal('')
    try {
      if (supabase) {
        const { error } = await supabase
          .from('settings')
          .delete()
          .eq('key', 'gemini_api_key')
        if (error) throw error
      }
      setStatus({ ok: true, msg: 'API key Gemini dihapus.' })
    } catch (e) {
      setStatus({ ok: false, msg: `Gagal menghapus: ${e.message}` })
    }
  }

  const testKey = async () => {
    const key = geminiKey.trim()
    if (!key) {
      setStatus({ ok: false, msg: 'Isi API key dulu sebelum diuji.' })
      return
    }
    setTesting(true)
    setStatus(null)
    try {
      await testGeminiKey(key)
      setStatus({ ok: true, msg: '✅ Koneksi Gemini berhasil! AI chat kini pakai Gemini.' })
    } catch (e) {
      setStatus({ ok: false, msg: `❌ Gagal: ${e.message}` })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-up space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Pengaturan</h1>
        <p className="text-sm text-slate-500">Kelola tema aplikasi dan API key Gemini untuk AI chat.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <Sun size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Tema Tampilan</h2>
            <p className="text-xs text-slate-500">Pilih mode terang atau gelap untuk seluruh aplikasi.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => theme !== 'light' && toggleTheme()}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              theme === 'light'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Sun size={16} /> Terang
          </button>
          <button
            onClick={() => theme !== 'dark' && toggleTheme()}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              theme === 'dark'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Moon size={16} /> Gelap
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">AI Gemini</h2>
            <p className="text-xs text-slate-500">
              Chat AI langsung memakai Google Gemini (function calling + generate gambar via Imagen).
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-slate-600">API Key Gemini</label>
          <div className="relative">
            <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type={showKey ? 'text' : 'password'}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-11 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={saveKey}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Simpan
            </button>
            <button
              onClick={testKey}
              disabled={testing}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {testing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Uji Koneksi
            </button>
            <button
              onClick={clearKey}
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <Trash2 size={16} /> Hapus
            </button>
          </div>

          {status && (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                status.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}
            >
              {status.msg}
            </p>
          )}

          <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-500">
            <p className="font-semibold text-slate-600">Catatan:</p>
            <p>
              • Key ini disimpan di tabel <code className="rounded bg-slate-200 px-1">settings</code> (khusus admin)
              dan di perangkat admin, sehingga chat AI langsung bekerja untuk admin.
            </p>
            <p>
              • Agar seluruh pengguna memakai AI yang sama, tambahkan <code className="rounded bg-slate-200 px-1">VITE_GEMINI_API_KEY</code>{' '}
              di file <code className="rounded bg-slate-200 px-1">.env</code> sebelum build lalu deploy ulang.
            </p>
            <p>• Alternatif tanpa browser: deploy Edge Function <code className="rounded bg-slate-200 px-1">ai-chat</code> dengan secret <code className="rounded bg-slate-200 px-1">AI_API_KEY</code> — chat otomatis memakainya bila Gemini di browser tidak tersedia.</p>
          </div>
        </div>
      </section>
    </div>
  )
}