import { useCallback, useEffect, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Search, ScanLine, Minus, Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { rupiah, dateID } from '../lib/format'
import Modal from '../components/Modal'
import BarScanner from '../components/BarScanner'

const LOW = 5

export default function Stock() {
  const { profile } = useAuth()
  const canEdit = profile?.role === 'admin' || profile?.role === 'gudang'

  const [products, setProducts] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState(null)
  const [adjType, setAdjType] = useState('in')
  const [adjQty, setAdjQty] = useState(1)
  const [adjNote, setAdjNote] = useState('')
  const [editTarget, setEditTarget] = useState(null)
  const [editQty, setEditQty] = useState(1)
  const [editNote, setEditNote] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [pRes, hRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('stock_transactions').select('*, products(name, sku)').order('created_at', { ascending: false }).limit(30),
    ])
    setProducts(pRes.data || [])
    setHistory(hRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = (products || []).filter((p) =>
    (p.name + ' ' + p.sku + ' ' + p.category).toLowerCase().includes(search.toLowerCase())
  )

  const handleScan = async (barcode) => {
    const { data } = await supabase.from('products').select('*').eq('barcode', barcode).maybeSingle()
    if (data) {
      setAdjustTarget(data)
      setAdjType(data.stock <= data.min_stock ? 'in' : 'in')
    } else {
      alert('Barcode tidak ditemukan di database.')
    }
  }

  const adjust = async () => {
    if (!adjustTarget || adjQty < 1) return
    const { error } = await supabase.from('stock_transactions').insert({
      product_id: adjustTarget.id,
      type: adjType,
      quantity: adjQty,
      note: adjNote.trim() || (adjType === 'in' ? 'Penerimaan barang' : 'Pengeluaran barang'),
      created_by: profile?.id,
    })
    if (error) {
      alert('Gagal: ' + error.message)
      return
    }
    setAdjustTarget(null)
    setAdjQty(1)
    setAdjNote('')
    load()
  }

  const openEdit = (h) => {
    setEditTarget(h)
    setAdjType(h.type)
    setEditQty(h.quantity)
    setEditNote(h.note || '')
  }

  const saveEdit = async () => {
    if (!editTarget || editQty < 1) return
    const { data, error } = await supabase.rpc('update_stock_record', {
      p_id: editTarget.id,
      p_type: adjType,
      p_quantity: editQty,
      p_note: editNote.trim() || (adjType === 'in' ? 'Penerimaan barang' : 'Pengeluaran barang'),
    })
    if (error) alert('Gagal mengubah: ' + error.message)
    else {
      setEditTarget(null)
      load()
    }
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.rpc('delete_stock_record', { p_id: deleteTarget.id })
    if (error) alert('Gagal menghapus: ' + error.message)
    else {
      setDeleteTarget(null)
      load()
    }
  }

  const total = filtered.reduce((s, p) => s + p.stock, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Stok</h1>
          <p className="text-sm text-slate-500">Pantau dan kelola stok masuk / keluar gudang.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScanOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ScanLine size={18} /> Scan Barcode
          </button>
          <span className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white">
            Total: {total} pcs
          </span>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari berdasarkan nama / SKU / kategori..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3.5">Barang</th>
                <th className="px-4 py-3.5">Kategori</th>
                <th className="px-4 py-3.5">Harga</th>
                <th className="px-4 py-3.5">Stok</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.category || '-'}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{rupiah(p.price)}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-800">{p.stock}</span>{' '}
                    <span className="text-xs text-slate-400">{p.unit}</span>
                  </td>
                  <td className="px-4 py-3">
                    {p.stock <= 0 ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Habis</span>
                    ) : p.stock <= p.min_stock ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">Menipis</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Aman</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {canEdit ? (
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setAdjustTarget(p)
                            setAdjType('in')
                          }}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          <Plus size={13} /> Masuk
                        </button>
                        <button
                          onClick={() => {
                            setAdjustTarget(p)
                            setAdjType('out')
                          }}
                          className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                        >
                          <Minus size={13} /> Keluar
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="py-10 text-center text-sm text-slate-400">Tidak ada produk.</p>}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-700">Riwayat Pergerakan Stok</h3>
        {history.length ? (
          <div className="divide-y divide-slate-50">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  {h.type === 'in' ? (
                    <ArrowDownCircle size={18} className="shrink-0 text-emerald-500" />
                  ) : (
                    <ArrowUpCircle size={18} className="shrink-0 text-red-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {h.products?.name || 'Produk'} ({h.products?.sku})
                    </p>
                    <p className="text-xs text-slate-400">
                      {h.note} • {dateID(h.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      h.type === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {h.type === 'in' ? '+' : '−'}{h.quantity}
                  </span>
                  {canEdit && !String(h.note || '').startsWith('Penjualan') && (
                    <>
                      <button
                        onClick={() => openEdit(h)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                        title="Edit riwayat"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(h)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Hapus riwayat"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">Belum ada pergerakan stok.</p>
        )}
      </div>

      <BarScanner open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />

      <Modal open={Boolean(adjustTarget)} onClose={() => setAdjustTarget(null)} title={adjustTarget ? `Stok ${adjType === 'in' ? 'Masuk' : 'Keluar'} — ${adjustTarget.name}` : ''}>
        {adjustTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Stok saat ini: <b className="text-slate-800">{adjustTarget.stock} {adjustTarget.unit}</b>. Stok minimum: {adjustTarget.min_stock}.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAdjType('in')}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold ${adjType === 'in' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}
              >
                <ArrowDownCircle size={16} /> Barang Masuk
              </button>
              <button
                onClick={() => setAdjType('out')}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold ${adjType === 'out' ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-200 text-slate-500'}`}
              >
                <ArrowUpCircle size={16} /> Barang Keluar
              </button>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Jumlah</label>
              <input
                type="number"
                min="1"
                value={adjQty}
                onChange={(e) => setAdjQty(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Catatan</label>
              <input
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                placeholder="Mis. Faktur PO-001"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <button
              onClick={adjust}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Simpan
            </button>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(editTarget)} onClose={() => setEditTarget(null)} title={editTarget ? `Edit Riwayat Stok — ${editTarget.products?.name || ''}` : ''}>
        {editTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAdjType('in')}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold ${adjType === 'in' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}
              >
                <ArrowDownCircle size={16} /> Masuk
              </button>
              <button
                onClick={() => setAdjType('out')}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold ${adjType === 'out' ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-200 text-slate-500'}`}
              >
                <ArrowUpCircle size={16} /> Keluar
              </button>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Jumlah</label>
              <input
                type="number"
                min="1"
                value={editQty}
                onChange={(e) => setEditQty(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Catatan</label>
              <input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <p className="text-xs text-slate-400">
              Stok produk akan disesuaikan otomatis saat menyimpan.
            </p>
            <button
              onClick={saveEdit}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Simpan Perubahan
            </button>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Hapus Riwayat Stok">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Hapus catatan stok{' '}
              <b>
                {deleteTarget.type === 'in'
                  ? `masuk (+${deleteTarget.quantity})`
                  : `keluar (−${deleteTarget.quantity})`}{' '}
                untuk <b>{deleteTarget.products?.name}</b>?
              </b>
              <span className="mt-1 block text-xs text-amber-600">
                Stok produk akan dikoreksi otomatis.
              </span>
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Batal
              </button>
              <button onClick={doDelete} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700">
                Ya, Hapus
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}