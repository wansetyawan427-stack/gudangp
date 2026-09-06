import { supabase } from './supabase'
import { rupiah } from './format'

export async function askAI(input, ctx = {}) {
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: [{ role: 'user', content: input }] },
      })
      if (!error && data?.reply) return data.reply
    } catch {
      // fallback ke bot lokal
    }
  }
  return localBot(input, ctx)
}

async function fetchProducts(limit = 15) {
  const { data } = await supabase
    .from('products')
    .select('id, name, sku, category, price, stock, unit')
    .order('name')
    .limit(limit)
  return data || []
}

async function fetchLowStock() {
  const { data } = await supabase
    .from('products')
    .select('name, stock, min_stock, unit')
    .order('stock', { ascending: true })
    .limit(10)
  return data || []
}

async function localBot(raw, ctx) {
  const q = raw.toLowerCase()
  const role = ctx.role || ''
  const name = ctx.name || 'Kamu'

  const has = (...words) => words.some((w) => q.includes(w))

  if (has('halo', 'hai', 'hi', 'helo', 'pagi', 'siang', 'sore', 'malam')) {
    return `Halo ${name}! 👋 Aku asisten AI GudangKu. Aku bisa bantu cek produk, stok, atau menjelaskan fitur sesuai role kamu (${role}). Mau tanya apa?`
  }

  if (has('terima kasih', 'makasih', 'thx', 'thanks', 'thank')) {
    return 'Sama-sama! 😊 Ada yang lain yang mau dibantu?'
  }

  if (has('bantuan', 'help', 'cara', 'fitur', 'menu', 'fungsi', 'bisa apa')) {
    const menuByRole = {
      admin: 'Dashboard, Produk, Stok, Kasir, Transaksi, dan Pengguna (kelola role & pengguna).',
      gudang: 'Dashboard, Produk (tambah/edit barang), dan Stok (barang masuk/keluar).',
      kasir: 'Dashboard, Kasir (POS), dan Transaksi (riwayat penjualan).',
      pelanggan: 'Dashboard, Belanja (beli produk), dan Riwayat transaksi.',
    }
    return (
      `Kamu login sebagai **${role}**. Berikut menu yang bisa kamu akses:\n` +
      `• ${menuByRole[role]}\n\n` +
      'Selain itu aku punya ' +
      '*AI Chat* yang bisa ditanya lewat tombol chat di kanan bawah. Contoh: "produk apa saja?", "cek stok", "berapa harga?"'
    )
  }

  if (has('produk', 'barang', 'daftar', 'list', 'katalog')) {
    const items = await fetchProducts()
    if (!items.length)
      return 'Belum ada produk di database. Admin/gudang bisa menambahkan lewat menu Produk.'
    const lines = items
      .map((p) => `• ${p.name} — ${rupiah(p.price)} (stok ${p.stock} ${p.unit})`)
      .join('\n')
    return `Berikut daftar produk (${items.length} teratas):\n${lines}`
  }

  if (has('stok menipis', 'stok rendah', 'low stock', 'habis', 'stok habis')) {
    const items = await fetchLowStock()
    const low = items.filter((p) => p.stock <= (p.min_stock || 0))
    if (!low.length) return 'Saat ini semua produk masih punya stok cukup. 👍'
    const lines = items.map((p) => `• ${p.name} — stok ${p.stock}/${p.min_stock} ${p.unit}`).join('\n')
    return `⚠️ Produk dengan stok menipis/habis:\n${lines}\n\nSaranku, segera tambah stok lewat menu Stok.`
  }

  if (has('stok')) {
    const items = await fetchProducts(10)
    if (!items.length) return 'Belum ada produk di database.'
    const lines = items
      .map((p) => `• ${p.name} — ${p.stock} ${p.unit}${p.stock <= p.min_stock ? ' ⚠️ menipis' : ''}`)
      .join('\n')
    return `Stok saat ini (10 teratas):\n${lines}`
  }

  if (has('harga', 'berapa', 'price', 'mahal', 'murah')) {
    const items = await fetchProducts(12)
    if (!items.length) return 'Belum ada produk di database.'
    const lines = items.map((p) => `• ${p.name} — ${rupiah(p.price)}`).join('\n')
    return `Daftar harga produk:\n${lines}`
  }

  if (has('transaksi', 'penjualan', 'laporan', 'penghasilan', 'omzet', 'omzet')) {
    if (role === 'pelanggan') {
      const { count } = await supabase.from('transactions').select('*', { count: 'exact', head: true })
      return `Kamu punya ${count || 0} transaksi. Cek rinciannya di menu Riwayat. ${count ? '' : 'Yuk mulai belanja di menu Belanja! 🛍️'}`
    }
    if (role === 'kasir' || role === 'admin') {
      const { count } = await supabase.from('transactions').select('*', { count: 'exact', head: true })
      return `Total transaksi tercatat: ${count || 0}. Rincian lengkap ada di menu Transaksi.`
    }
    const { count } = await supabase.from('stock_transactions').select('*', { count: 'exact', head: true })
    return `Ada ${count || 0} riwayat pergerakan stok. Cek di menu Stok.`
  }

  if (has('kasir', 'jual', 'beli', 'pesan', 'cekout', 'checkout', 'bayar')) {
    if (role === 'kasir' || role === 'admin')
      return 'Untuk penjualan, buka menu *Kasir*: pilih produk, masukkan jumlah, lalu klik *Bayar*. Transaksi tercatat otomatis dan stok terpotong.'
    if (role === 'pelanggan')
      return 'Kamu bisa belanja di menu *Belanja*: klik produk, pilih jumlah, lalu *Pesan Sekarang*.'
    return 'Menu Kasir/penjualan hanya untuk role kasir dan admin.'
  }

  if (has('gambar', 'logo', 'image', 'draw', 'generate', 'foto user', 'buatkan')) {
    return (
      '🖼️ Aku bisa membuat gambar! Saat memakai AI sungguhan, cukup ketik misalnya:\n' +
      '• "buatkan gambar logo toko sembako"\n' +
      '• "generate gambar kemasan produk beras"\n\n' +
      '▶️ **Cara mengaktifkan:** deploy Edge Function *ai-chat* dan isi secret `AI_API_KEY` (+ opsional `AI_IMAGE_KEY`) di Supabase Dashboard > Edge Functions. Setelah itu URL gambar hasil generate akan muncul di chat ini.'
    )
  }

  if (has('siapakah kamu', 'kamu siapa', 'nama kamu', 'kamu itu', 'siapa')) {
    return 'Aku *GudangKu AI*, asisten virtual aplikasi manajemen gudang. Aku membantumu mengelola produk, stok, dan transaksi dengan gaya bahasa Indonesia yang ramah. 😄'
  }

  return (
    `Maaf, aku belum paham pertanyaan itu. 🙏 Kamu bisa tanya hal seperti:\n` +
    '• "produk apa saja?"\n' +
    '• "cek stok / stok menipis"\n' +
    '• "berapa harga?"\n' +
    '• "bantuan / fitur apa saja"\n' +
    '\nAtau coba kata kunci: *halo*, *transaksi*, *beli*.'
  )
}