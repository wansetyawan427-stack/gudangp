import { supabase } from './supabase'

const API = 'https://generativelanguage.googleapis.com/v1beta'
const STORAGE_KEY = 'gudangku-gemini-key'
const DB_KEY = 'gemini_api_key'

const SYSTEM_PROMPT =
  'Kamu adalah asisten AI "GudangKu", aplikasi manajemen gudang berbahasa Indonesia.\n' +
  'Kamu ramah, ringkas, dan akurat. Saat pengguna bertanya tentang produk, stok, harga, atau laporan, gunakan tool yang tersedia.\n' +
  'Gunakan format teks sederhana. Untuk membuat gambar, panggil tool generate_image.\n' +
  'Jika data tidak ditemukan, bilang jujur dan sarankan menu terkait.'

const FUNCTION_DECLARATIONS = [
  {
    name: 'get_products',
    description: 'Ambil daftar produk beserta harga dan stoknya. Opsional cari berdasarkan nama/SKU.',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Kata kunci nama/SKU produk (opsional)' },
        limit: { type: 'integer', description: 'Jumlah maksimal hasil (default 15)' },
      },
    },
  },
  {
    name: 'get_low_stock',
    description: 'Ambil produk yang stoknya menipis atau habis (stok <= min_stock).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_stock_history',
    description: 'Ambil riwayat pergerakan stok / barang masuk & keluar.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'integer', description: 'Jumlah maksimal hasil (default 10)' } },
    },
  },
  {
    name: 'get_dashboard_summary',
    description: 'Ambil ringkasan dashboard: total produk, stok, transaksi, dan nilai transaksi.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'generate_image',
    description: 'Buat/generate sebuah gambar dari deskripsi teks (prompt). Kembalikan URL gambar.',
    parameters: {
      type: 'object',
      properties: { prompt: { type: 'string', description: 'Deskripsi gambar yang ingin dibuat' } },
      required: ['prompt'],
    },
  },
]

async function runLocalTool(name, args = {}) {
  try {
    switch (name) {
      case 'get_products': {
        const limit = Math.min(Number(args.limit) || 15, 50)
        let q = supabase
          .from('products')
          .select('id, name, sku, category, price, stock, unit')
          .order('name')
          .limit(limit)
        if (args.search) q = q.or(`name.ilike.%${args.search}%,sku.ilike.%${args.search}%`)
        const { data, error } = await q
        if (error) return { success: false, message: error.message }
        return { products: data }
      }
      case 'get_low_stock': {
        const { data, error } = await supabase
          .from('products')
          .select('name, stock, min_stock, unit')
          .order('stock', { ascending: true })
          .limit(15)
        if (error) return { success: false, message: error.message }
        return { products: data.filter((p) => p.stock <= (p.min_stock || 0)) }
      }
      case 'get_stock_history': {
        const limit = Math.min(Number(args.limit) || 10, 30)
        const { data, error } = await supabase
          .from('stock_transactions')
          .select('type, quantity, note, created_at, products(name)')
          .order('created_at', { ascending: false })
          .limit(limit)
        if (error) return { success: false, message: error.message }
        return { history: data }
      }
      case 'get_dashboard_summary': {
        const { data, error } = await supabase.rpc('get_dashboard_summary')
        if (error) return { success: false, message: error.message }
        return data
      }
      case 'generate_image': {
        const key = getGeminiKeySync()
        if (!key) return { success: false, message: 'Gemini API key belum dikonfigurasi di menu Pengaturan.' }
        const prompt = String(args.prompt || '').slice(0, 1000)
        const imagen = 'imagen-3.0-generate-002'
        const res = await fetch(`${API}/models/${imagen}:predict?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1 },
          }),
        })
        if (!res.ok) {
          const text = await res.text()
          return {
            success: false,
            message: `Gagal generate gambar (${res.status}). Cek apakah model Imagen aktif di API key ini. ${text.slice(0, 200)}`,
          }
        }
        const json = await res.json()
        const b64 = json?.predictions?.[0]?.bytesBase64Encoded
        if (!b64) return { success: false, message: 'Model Imagen belum mengembalikan hasil gambar.' }
        return { url: `data:image/png;base64,${b64}` }
      }
      default:
        return { success: false, message: `Tool tidak dikenal: ${name}` }
    }
  } catch (e) {
    return { success: false, message: e.message }
  }
}

export function getGeminiKeySync() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return saved
  } catch {
    /* abaikan */
  }
  return import.meta.env.VITE_GEMINI_API_KEY || ''
}

export function saveGeminiKeyLocal(key) {
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* abaikan */
  }
}

export async function getGeminiKey() {
  const local = getGeminiKeySync()
  if (local) return local
  if (supabase) {
    try {
      const { data } = await supabase.from('settings').select('value').eq('key', DB_KEY).maybeSingle()
      if (data?.value) return data.value
    } catch {
      /* abaikan */
    }
  }
  return ''
}

export async function testGeminiKey(key) {
  const res = await fetch(`${API}/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Balas hanya satu kata: oke' }] }],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text.slice(0, 200))
  }
  return true
}

function toGeminiContent(msg) {
  const role = msg.role === 'user' ? 'user' : 'model'
  let text = String(msg.content || '')
  text = text.replace(/!\[[^\]]*\]\(data:[^)]*\)/g, '').trim()
  return { role, parts: [{ text: text || '...' }] }
}

export async function geminiChat(history = [], ctx = {}) {
  const key = await getGeminiKey()
  if (!key) throw new Error('Gemini API key tidak ditemukan')
  const model = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash'

  const contents = history.filter(Boolean).map(toGeminiContent)

  for (let round = 0; round < 5; round++) {
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: { maxOutputTokens: 1024 },
    }

    const res = await fetch(`${API}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`
      throw new Error(msg)
    }

    const parts = data?.candidates?.[0]?.content?.parts || []
    const calls = parts.filter((p) => p.functionCall)
    if (!calls.length) {
      const text = parts.map((p) => p.text || '').filter(Boolean).join('')
      if (!text) throw new Error('Gemini mengembalikan respons kosong')
      return text
    }

    contents.push({ role: 'model', parts })
    const responses = []
    for (const call of calls) {
      const fn = call.functionCall
      const result = await runLocalTool(fn.name, fn.args || {})
      responses.push({ functionResponse: { name: fn.name, response: result } })
    }
    contents.push({ role: 'user', parts: responses })
  }
  throw new Error('Percakapan AI terlalu panjang, coba tanya lebih singkat')
}