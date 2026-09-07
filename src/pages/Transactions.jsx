import { useCallback, useEffect, useState } from 'react'
import { Search, Eye, ReceiptText, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { rupiah, dateID } from '../lib/format'
import Modal from '../components/Modal'

const PAYMENTS = ['cash', 'qris', 'transfer', 'debit']
const PAYMENT_LABEL = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debit: 'Debit' }

export default function Transactions() {
  const { profile } = useAuth()
  const isPelanggan = profile?.role === 'pelanggan'
  const isStaff = profile?.role === 'admin' || profile?.role === 'kasir'

  const [trx, setTrx] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState(null)
  const [items, setItems] = useState([])
  const [payEdit, setPayEdit] = useState(false)
  const [payValue, setPayValue] = useState('')
  const [voidTarget, setVoidTarget] = useState(null)
  const [voiding, setVoiding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, customer:profiles!transactions_customer_id_fkey(full_name, email), cashier:profiles!transactions_cashier_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(100)
    setTrx(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = (trx || []).filter((t) =>
    (t.code + ' ' + (t.customer?.full_name || '') + ' ' + (t.cashier?.full_name || ''))
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const openDetail = async (t) => {
    setDetail(t)
    setPayEdit(false)
    setPayValue(t.payment_method)
    const { data } = await supabase
      .from('transaction_items')
      .select('*')
      .eq('transaction_id', t.id)
    setItems(data || [])
  }

  const savePay = async () => {
    if (!detail || !payValue) return
    const { error } = await supabase.from('transactions').update({ payment_method: payValue }).eq('id', detail.id)
    if (error) alert('Gagal mengubah metode bayar: ' + error.message)
    else {
      setDetail((d) => ({ ...d, payment_method: payValue }))
      setPayEdit(false)
      load()
    }
  }

  const doVoid = async () => {
    if (!voidTarget) return
    setVoiding(true)
    const { data, error } = await supabase.rpc('void_sale', { p_trx_id: voidTarget.id })
    if (error) alert('Gagal membatalkan transaksi: ' + error.message)
    else {
      alert(`Transaksi ${data?.code} dibatalkan. Stok barang dikembalikan.`)
      setVoidTarget(null)
      setDetail(null)
      load()
    }
    setVoiding(false)
  }

  const totalAll = (trx || []).reduce((s, t) => s + Number(t.total), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{isPelanggan ? 'Riwayat Transaksi' : 'Data Transaksi'}</h1>
          <p className="text-sm text-slate-500">
            {isPelanggan ? 'Semua pesanan kamu.' : 'Seluruh transaksi penjualan.'}
          </p>
        </div>
        <div className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-white">
          Total nilai: <b className="text-emerald-400">{rupiah(totalAll)}</b>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari kode / nama..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3.5">Kode</th>
                <th className="px-4 py-3.5">Tanggal</th>
                {!isPelanggan && <th className="px-4 py-3.5">Pelanggan</th>}
                {!isPelanggan && <th className="px-4 py-3.5">Kasir</th>}
                <th className="px-4 py-3.5">Metode</th>
                <th className="px-4 py-3.5 text-right">Total</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-700">{t.code}</td>
                  <td className="px-4 py-3 text-slate-500">{dateID(t.created_at)}</td>
                  {!isPelanggan && (
                    <td className="px-4 py-3 text-slate-600">{t.customer?.full_name || t.customer?.email || 'Umum'}</td>
                  )}
                  {!isPelanggan && <td className="px-4 py-3 text-slate-600">{t.cashier?.full_name || '-'}</td>}
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">
                      {t.payment_method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{rupiah(t.total)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => openDetail(t)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <Eye size={14} /> Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="py-10 text-center text-sm text-slate-400">Belum ada transaksi.</p>}
        </div>
      )}

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Detail Transaksi" wide>
        {detail && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Kode</p>
                <p className="font-mono text-sm font-semibold text-slate-800">{detail.code}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Tanggal</p>
                <p className="text-sm font-semibold text-slate-800">{dateID(detail.created_at)}</p>
              </div>
              {!isPelanggan && (
                <>
                  <div>
                    <p className="text-xs text-slate-400">Pelanggan</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {detail.customer?.full_name || detail.customer?.email || 'Umum'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Kasir</p>
                    <p className="text-sm font-semibold text-slate-800">{detail.cashier?.full_name || '-'}</p>
                  </div>
                </>
              )}
              <div>
                <p className="text-xs text-slate-400">Metode</p>
                {isStaff && payEdit ? (
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <select
                      value={payValue}
                      onChange={(e) => setPayValue(e.target.value)}
                      className="rounded-lg border border-emerald-400 bg-white px-2 py-1 text-xs font-semibold outline-none"
                    >
                      {PAYMENTS.map((p) => (
                        <option key={p} value={p}>
                          {PAYMENT_LABEL[p] || p}
                        </option>
                      ))}
                    </select>
                    <button onClick={savePay} className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700">
                      Simpan
                    </button>
                    <button onClick={() => setPayEdit(false)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100">
                      Batal
                    </button>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-sm font-semibold uppercase text-slate-800">
                    {detail.payment_method}
                    {isStaff && (
                      <button
                        onClick={() => setPayEdit(true)}
                        className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold normal-case text-slate-500 hover:bg-slate-200"
                      >
                        Ubah
                      </button>
                    )}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400">Total</p>
                <p className="text-sm font-extrabold text-emerald-600">{rupiah(detail.total)}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                <ReceiptText size={14} /> Item ({items.length})
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[400px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5">Barang</th>
                      <th className="px-4 py-2.5 text-center">Qty</th>
                      <th className="px-4 py-2.5 text-right">Harga</th>
                      <th className="px-4 py-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td className="px-4 py-2 font-medium text-slate-700">{i.product_name}</td>
                        <td className="px-4 py-2 text-center text-slate-600">{i.quantity}</td>
                        <td className="px-4 py-2 text-right text-slate-500">{rupiah(i.price)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-700">{rupiah(i.price * i.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {isStaff && (
              <button
                onClick={() => setVoidTarget(detail)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
              >
                <RotateCcw size={15} /> Batalkan Transaksi (void & kembalikan stok)
              </button>
            )}
          </div>
        )}
      </Modal>

      <Modal open={Boolean(voidTarget)} onClose={() => setVoidTarget(null)} title="Batalkan Transaksi">
        {voidTarget && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600">
              Batalkan transaksi <b className="font-mono">{voidTarget.code}</b> senilai{' '}
              <b>{rupiah(voidTarget.total)}</b>? Transaksi & itemnya akan dihapus, dan stok barang
              akan dikembalikan otomatis. Aksi ini tidak bisa dibatalkan.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setVoidTarget(null)} disabled={voiding} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Tidak jadi
              </button>
              <button onClick={doVoid} disabled={voiding} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">
                {voiding ? 'Memproses...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}