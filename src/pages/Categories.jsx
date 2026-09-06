import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, Tag, Package } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

export default function Categories() {
  const [cats, setCats] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [cRes, pRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('products').select('category'),
    ])
    setCats(cRes.data || [])
    const map = {}
    ;(pRes.data || []).forEach((p) => {
      if (p.category) map[p.category] = (map[p.category] || 0) + 1
    })
    setCounts(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const addCategory = async () => {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    const { error } = await supabase.from('categories').insert({ name })
    if (error) alert('Gagal menambah kategori: ' + error.message)
    else {
      setNewName('')
      setAdding(false)
      load()
    }
    setBusy(false)
  }

  const saveEdit = async () => {
    const name = editName.trim()
    if (!name || !editingId) return
    setBusy(true)
    const { error } = await supabase.from('categories').update({ name }).eq('id', editingId)
    if (error) alert('Gagal mengubah kategori: ' + error.message)
    else {
      setEditingId(null)
      load()
    }
    setBusy(false)
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    const used = (counts[deleteTarget.name] || 0) > 0
    if (used) {
      alert(`Kategori "${deleteTarget.name}" masih dipakai ${counts[deleteTarget.name]} produk. Ubah/hapus produk dulu sebelum menghapus kategori.`)
      setDeleteTarget(null)
      return
    }
    setBusy(true)
    const { error } = await supabase.from('categories').delete().eq('id', deleteTarget.id)
    if (error) alert('Gagal menghapus kategori: ' + error.message)
    else load()
    setBusy(false)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kategori Barang</h1>
          <p className="text-sm text-slate-500">Kelola master kategori produk (CRUD).</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Plus size={18} /> Tambah Kategori
        </button>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[540px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3.5">Nama Kategori</th>
                <th className="px-4 py-3.5">Jumlah Produk</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {cats.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <Tag size={16} />
                      </span>
                      {editingId === c.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            autoFocus
                            className="rounded-lg border border-emerald-400 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-100"
                          />
                          <button onClick={saveEdit} disabled={busy} className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700">
                            <Check size={15} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100">
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <p className="font-semibold text-slate-800">{c.name}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      <Package size={12} /> {counts[c.name] || 0}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setEditingId(c.id)
                          setEditName(c.name)
                        }}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!cats.length && <p className="py-10 text-center text-sm text-slate-400">Belum ada kategori.</p>}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Tambah Kategori">
        <div className="space-y-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            placeholder="Nama kategori baru"
            autoFocus
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Batal
            </button>
            <button onClick={addCategory} disabled={busy || !newName.trim()} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              Simpan
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Hapus Kategori">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Yakin menghapus kategori <b>{deleteTarget.name}</b>?
              {counts[deleteTarget.name] > 0 ? (
                <span className="mt-1 block text-xs text-red-600">
                  ⚠️ Kategori ini masih dipakai {counts[deleteTarget.name]} produk dan tidak bisa dihapus.
                </span>
              ) : (
                ' Kategori akan dihapus permanen.'
              )}
            </p>
            {counts[deleteTarget.name] > 0 ? (
              <button onClick={() => setDeleteTarget(null)} className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Mengerti
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Batal
                </button>
                <button onClick={doDelete} disabled={busy} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                  Ya, Hapus
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}