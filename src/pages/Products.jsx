import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Minus, ShoppingCart, X, ImageOff, QrCode } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { rupiah } from '../lib/format'
import ProductForm from '../components/ProductForm'
import BarcodeQR from '../components/BarcodeQR'
import Modal from '../components/Modal'

export default function Products() {
  const { profile } = useAuth()
  const role = profile?.role || 'pelanggan'
  const canManage = role === 'admin' || role === 'gudang'
  const canDelete = role === 'admin'
  const canBuy = role === 'pelanggan'

  const [products, setProducts] = useState([])
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [qrProduct, setQrProduct] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [params] = useSearchParams()
  const searchInit = useRef(false)

  useEffect(() => {
    if (searchInit.current) return
    searchInit.current = true
    const sku = params.get('sku')
    if (sku) setSearch(sku)
  }, [params])

  const load = useCallback(async () => {
    setLoading(true)
    const cRes = supabase.from('categories').select('name').order('name')
    let query = supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
    if (search.trim()) query = query.or(`name.ilike.%${search.trim()}%,sku.ilike.%${search.trim()}%`)
    if (category !== 'all') query = query.eq('category', category)
    const [cData, pRes] = await Promise.all([cRes, query])
    setCats((cData.data || []).map((c) => c.name))
    setProducts(pRes.data || [])
    setLoading(false)
  }, [search, category])

  useEffect(() => {
    load()
  }, [load])

  const categories = useMemo(
    () => [
      ...new Set([...(cats || []), ...(products || []).map((p) => p.category).filter(Boolean)]),
    ],
    [cats, products]
  )

  const addToCart = (product) => {
    setCart((c) => {
      const found = c.find((i) => i.product_id === product.id)
      if (found) {
        return c.map((i) =>
          i.product_id === product.id ? { ...i, quantity: Math.min(i.quantity + 1, product.stock) } : i
        )
      }
      return [...c, { product_id: product.id, name: product.name, price: Number(product.price), quantity: 1, stock: product.stock }]
    })
    setCartOpen(true)
  }

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  const removeFromCart = (id) => setCart((c) => c.filter((i) => i.product_id !== id))

  const changeQty = (id, delta) => {
    setCart((c) =>
      c
        .map((i) =>
          i.product_id === id
            ? { ...i, quantity: Math.max(1, Math.min(i.quantity + delta, Math.max(i.stock, i.quantity))) }
            : i
        )
        .filter((i) => i.quantity > 0)
    )
  }

  const checkout = async () => {
    if (!cart.length) return
    setProcessing(true)
    try {
      const { data, error } = await supabase.rpc('create_sale', {
        p_items: cart.map(({ product_id, quantity }) => ({ product_id, quantity })),
        p_payment_method: 'qris',
      })
      if (error) throw error
      setCart([])
      setCartOpen(false)
      alert(`Transaksi ${data?.code} berhasil! Total ${rupiah(data?.total)}.`)
      load()
    } catch (err) {
      alert('Gagal membuat pesanan: ' + (err.message || err))
    } finally {
      setProcessing(false)
    }
  }

  const confirmDelete = async (p) => {
    if (!window.confirm(`Hapus produk "${p.name}"? Aksi ini tidak bisa dibatalkan.`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (!error) load()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {canBuy ? 'Belanja Produk' : 'Produk & Barang'}
          </h1>
          <p className="text-sm text-slate-500">
            {canBuy
              ? 'Pilih produk, tambah ke keranjang, lalu pesan.'
              : 'Kelola data barang di gudang.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canBuy && (
            <button
              onClick={() => setCartOpen((o) => !o)}
              className="relative flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <ShoppingCart size={18} />
              Keranjang
              {cart.length > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold">
                  {cart.length}
                </span>
              )}
            </button>
          )}
          {canManage && (
            <button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Plus size={18} /> Tambah Barang
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
        >
          <option value="all">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <Loading />
      ) : products.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <div key={p.id} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-3 flex items-start justify-between">
                <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <ImageOff size={20} />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQrProduct(p)}
                    title="Lihat Barcode & QR"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-600"
                  >
                    <QrCode size={15} />
                  </button>
                  {canManage && (
                    <button
                      onClick={() => {
                        setEditing(p)
                        setFormOpen(true)
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => confirmDelete(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {p.category || 'Umum'} • {p.sku}
              </p>
              <h3 className="mt-0.5 font-bold text-slate-800">{p.name}</h3>
              <p className="mt-1 line-clamp-2 flex-1 text-xs text-slate-500">{p.description || '—'}</p>

              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-lg font-extrabold text-emerald-600">{rupiah(p.price)}</p>
                  <p className={`text-xs ${p.stock <= p.min_stock ? 'font-semibold text-red-500' : 'text-slate-400'}`}>
                    Stok {p.stock} {p.unit}
                  </p>
                </div>
                {canBuy ? (
                  <button
                    disabled={p.stock <= 0}
                    onClick={() => addToCart(p)}
                    className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ShoppingCart size={14} /> {p.stock > 0 ? 'Beli' : 'Habis'}
                  </button>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                    {p.stock <= p.min_stock && p.stock > 0 ? '⚠️ Menipis' : p.stock <= 0 ? 'Habis' : 'Tersedia'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty />
      )}

      {canManage && (
        <ProductForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          product={editing}
          onSaved={load}
          categories={categories}
        />
      )}

      <BarcodeQR open={!!qrProduct} onClose={() => setQrProduct(null)} product={qrProduct} />

      {canBuy && (
        <Modal open={cartOpen} onClose={() => setCartOpen(false)} title={`Keranjang (${cart.length})`}>
          {cart.length ? (
            <div className="space-y-3">
              {cart.map((i) => (
                <div key={i.product_id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{i.name}</p>
                    <p className="text-xs text-slate-400">{rupiah(i.price)} / {i.quantity} = <b className="text-slate-600">{rupiah(i.price * i.quantity)}</b></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQty(i.product_id, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{i.quantity}</span>
                    <button onClick={() => changeQty(i.product_id, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">
                      <Plus size={14} />
                    </button>
                    <button onClick={() => removeFromCart(i.product_id)} className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <p className="text-sm font-semibold text-slate-600">Total</p>
                <p className="text-xl font-extrabold text-slate-800">{rupiah(cartTotal)}</p>
              </div>
              <button
                onClick={checkout}
                disabled={processing}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {processing ? 'Memproses...' : `Pesan Sekarang • ${rupiah(cartTotal)}`}
              </button>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              Keranjang masih kosong. Pilih produk untuk mulai belanja.
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}

function Loading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
      ))}
    </div>
  )
}

function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
      <p className="text-3xl">📦</p>
      <p className="mt-2 text-sm font-medium text-slate-500">Tidak ada produk ditemukan</p>
      <p className="text-xs text-slate-400">Coba ganti kata kunci pencarian atau tambah produk baru.</p>
    </div>
  )
}