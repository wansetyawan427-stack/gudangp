import { useEffect, useMemo, useState } from 'react'
import { QrCode } from 'lucide-react'
import Modal from './Modal'
import BarcodeQR from './BarcodeQR'
import { generateEAN13 } from '../lib/barcode'
import { supabase } from '../lib/supabase'

const empty = {
  sku: '',
  name: '',
  category: '',
  unit: 'pcs',
  price: '',
  stock: 5,
  min_stock: 5,
  description: '',
  barcode: '',
  image_url: '',
}

export default function ProductForm({ open, onClose, product, onSaved, categories = [] }) {
  const [form, setForm] = useState({ ...empty })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setError('')
      setForm(product ? { ...empty, ...product, price: String(product.price) } : { ...empty })
    }
  }, [open, product])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const previewProduct = useMemo(
    () => ({
      id: product?.id || 'new',
      name: form.name.trim() || 'Nama Produk',
      sku: form.sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      category: form.category.trim(),
      price: Number(form.price) || 0,
      barcode: form.barcode.trim() || '',
      unit: form.unit,
    }),
    [form, product]
  )

  const generateCodes = () => {
    setForm((f) => ({
      ...f,
      sku: f.sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      barcode: f.barcode.trim() || generateEAN13(),
    }))
    setPreviewOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    const payload = {
      ...form,
      price: Number(form.price) || 0,
      stock: Number(form.stock) || 0,
      min_stock: Number(form.min_stock) || 0,
      sku: form.sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      name: form.name.trim(),
      category: form.category.trim(),
      image_url: form.image_url.trim(),
      barcode: form.barcode.trim() || generateEAN13(),
    }
    if (!payload.name) {
      setError('Nama produk wajib diisi')
      setSaving(false)
      return
    }
    try {
      const { error } = product
        ? await supabase.from('products').update(payload).eq('id', product.id)
        : await supabase.from('products').insert(payload)
      if (error) throw error
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Gagal menyimpan produk')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
  const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-600'

  return (
    <Modal open={open} onClose={onClose} title={product ? 'Edit Produk' : 'Tambah Barang'} wide footer={null}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Nama Produk *</label>
            <input required value={form.name} onChange={set('name')} placeholder="Mis. Beras 5kg" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>SKU *</label>
            <input value={form.sku} onChange={set('sku')} placeholder="Kode unik (otomatis jika kosong)" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Kategori</label>
            <input
              value={form.category}
              onChange={set('category')}
              placeholder="Pilih / ketik kategori baru"
              list="category-options"
              className={inputCls}
            />
            <datalist id="category-options">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Satuan</label>
            <input value={form.unit} onChange={set('unit')} placeholder="pcs / kg / dus" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Harga Jual (Rp)</label>
            <input type="number" min="0" value={form.price} onChange={set('price')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Stok Awal</label>
            <input type="number" min="0" value={form.stock} onChange={set('stock')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Stok Minimum (peringatan)</label>
            <input type="number" min="0" value={form.min_stock} onChange={set('min_stock')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Barcode & Kode QR</label>
            <div className="flex gap-2">
              <input value={form.barcode} onChange={set('barcode')} placeholder="Otomatis saat tambah jika kosong" className={inputCls} />
              <button
                type="button"
                onClick={generateCodes}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
              >
                <QrCode size={14} /> Generate
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Klik <b>Generate</b> untuk membuat barcode EAN-13 & QR otomatis lengkap dengan pratinjau.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>URL Gambar Produk (opsional)</label>
            <input value={form.image_url} onChange={set('image_url')} placeholder="https://...jpg (bisa dari AI generate)" className={inputCls} />
            <p className="mt-1 text-[11px] text-slate-400">
              Tip: minta gambar ke AI di chat, lalu salin URL-nya ke sini.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Pratinjau Gambar</label>
            <div className="flex h-20 w-24 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {form.image_url ? (
                <img src={form.image_url} alt="preview" className="h-full w-full object-cover" onError={(e) => (e.target.style.display = 'none')} />
              ) : (
                <span className="text-[10px] text-slate-400">No image</span>
              )}
            </div>
          </div>
        </div>
        <div>
          <label className={labelCls}>Deskripsi</label>
          <textarea value={form.description} onChange={set('description')} rows={2} className={inputCls} />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Batal
          </button>
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
            {saving ? 'Menyimpan...' : product ? 'Simpan Perubahan' : 'Tambah Barang'}
          </button>
        </div>
      </form>

      <BarcodeQR open={previewOpen} onClose={() => setPreviewOpen(false)} product={previewProduct} />
    </Modal>
  )
}