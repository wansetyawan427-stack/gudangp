import { useCallback, useEffect, useState } from 'react'
import { Shield, Search, Trash2, AlertTriangle, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { dateID } from '../lib/format'
import { ROLES, ROLE_LABEL, roleBadge } from '../lib/roles'
import Modal from '../components/Modal'

export default function Users() {
  const { user, refreshProfile } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [confirmUser, setConfirmUser] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'pelanggan' })
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = (users || []).filter((u) =>
    (u.full_name + ' ' + (u.email || '')).toLowerCase().includes(search.toLowerCase())
  )

  const changeRole = async (u, role) => {
    if (u.id === user?.id && role !== 'admin') {
      alert('Kamu tidak bisa mengubah role akun sendiri menjadi non-admin (mencegah terkunci).')
      return
    }
    const { error } = await supabase.from('profiles').update({ role }).eq('id', u.id)
    if (error) alert('Gagal mengubah role: ' + error.message)
    else {
      load()
      if (u.id === user?.id) refreshProfile()
    }
  }

  const createUser = async (e) => {
    e.preventDefault()
    setFormError('')
    if (form.password.length < 6) {
      setFormError('Password minimal 6 karakter')
      return
    }
    setCreating(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { ...form, full_name: form.full_name.trim() },
      })
      if (error) throw new Error(error.message || 'Gagal membuat pengguna')
      alert(`Pengguna ${data.email} dibuat sebagai ${ROLE_LABEL[data.role]}.`)
      setAddOpen(false)
      setForm({ full_name: '', email: '', password: '', role: 'pelanggan' })
      load()
    } catch (err) {
      setFormError(err.message || 'Gagal membuat pengguna. Pastikan Edge Function admin-create-user sudah di-deploy.')
    } finally {
      setCreating(false)
    }
  }

  const doDelete = async () => {
    if (!confirmUser) return
    const { error } = await supabase.rpc('admin_delete_user', { p_target: confirmUser.id })
    if (error) alert('Gagal menghapus: ' + error.message)
    else {
      alert(`Pengguna ${confirmUser.full_name || confirmUser.email} telah dihapus (data auth dihapus).`)
      load()
    }
    setConfirmUser(null)
  }

  const inputCls =
    'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
  const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-600'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Pengguna</h1>
          <p className="text-sm text-slate-500">
            Atur role akses pengguna: <b>Admin</b> (semua menu), <b>Gudang</b> (produk & stok),{' '}
            <b>Kasir</b> (POS & transaksi), <b>Pelanggan</b> (belanja).
          </p>
        </div>
        <button
          onClick={() => {
            setForm({ full_name: '', email: '', password: '', role: 'pelanggan' })
            setFormError('')
            setAddOpen(true)
          }}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <UserPlus size={18} /> Tambah Pengguna
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => {
          const count = (users || []).filter((u) => u.role === r).length
          return (
            <div key={r} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${roleBadge(r)}`}>
                  <Shield size={13} /> {ROLE_LABEL[r]}
                </span>
                <span className="text-2xl font-extrabold text-slate-800">{count}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama / email..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3.5">Pengguna</th>
                <th className="px-4 py-3.5">Role Saat Ini</th>
                <th className="px-4 py-3.5">Ubah Role</th>
                <th className="px-4 py-3.5">Bergabung</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white">
                        {(u.full_name || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">
                          {u.full_name || 'Tanpa nama'}
                          {u.id === user?.id && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">KAMU</span>}
                        </p>
                        <p className="text-xs text-slate-400">{u.email || '-'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${roleBadge(u.role)}`}>
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium outline-none focus:border-emerald-500"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{dateID(u.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      disabled={u.id === user?.id}
                      onClick={() => setConfirmUser(u)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={14} /> Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="py-10 text-center text-sm text-slate-400">Tidak ada pengguna.</p>}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Tambah Pengguna Baru">
        <form onSubmit={createUser} className="space-y-4">
          <div>
            <label className={labelCls}>Nama Lengkap</label>
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nama pengguna" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@email.com" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Password * (min. 6 karakter)</label>
            <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password sementara" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Batal
            </button>
            <button type="submit" disabled={creating} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
              {creating ? 'Membuat...' : 'Buat Pengguna'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(confirmUser)} onClose={() => setConfirmUser(null)} title="Hapus Pengguna">
        {confirmUser && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle size={20} className="mt-0.5 shrink-0" />
              <p>
                Yakin menghapus <b>{confirmUser.full_name || confirmUser.email}</b>? Akun auth dan profilnya akan
                dihapus permanen. Transaksi lama tetap tersimpan.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmUser(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
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