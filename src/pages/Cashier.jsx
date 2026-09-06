import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Plus, Minus, Trash2, ScanLine, ShoppingCart, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { rupiah, dateID } from '../lib/format'
import BarScanner from '../components/BarScanner'
import Modal from '../components/Modal'
import { printReceipt } from '../lib/print'

const PAYMENTS = [
  { value: 'cash', label: '💰 Tunai' },
  { value: 'qris', label: '📱 QRIS' },
  { value: 'transfer', label: '🏦 Transfer' },
  { value: 'debit', label: '💳 Debit' },
]

export default function Cashier() {
  const { profile } = useAuth()
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [payment, setPayment] = useState('cash')
  const [processing, setProcessing] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [receipt, setReceipt] = useState(null)

  const load = useCallback(async () => {
    const [pRes, cRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'pelanggan').order('full_name'),
    ])
    setProducts(pRes.data || [])
    setCustomers(cRes.data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(
    () =>
      (products || []).filter((p) =>
        (p.name + ' ' + p.sku + ' ' + p.barcode + ' ' + p.category)
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [products, search]
  )

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const totalQty = cart.reduce((s, i) => s + i.quantity, 0)

  const add = (p) => {
    if (p.stock <= 0) return
    setCart((c) => {
      const found = c.find((i) => i.product_id === p.id)
      if (found) {
        if (found.quantity >= p.stock) return c
        return c.map((i) => (i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [
        ...c,
        {
          product_id: p.id,
          name: p.name,
          sku: p.sku,
          price: Number(p.price),
          unit: p.unit,
          stock: p.stock,
          quantity: 1,
        },
      ]
    })
    setSearch('')
  }

  const setQty = (id, delta) => {
    setCart((c) =>
      c
        .map((i) => {
          if (i.product_id !== id) return i
          const q = i.quantity + delta
          return { ...i, quantity: Math.max(0, Math.min(q, i.stock)) }
        })
        .filter((i) => i.quantity > 0)
    )
  }

  const checkout = async () => {
    if (!cart.length) return
    setProcessing(true)
    try {
      const { data, error } = await supabase.rpc('create_sale', {
        p_items: cart.map(({ product_id, quantity }) => ({ product_id, quantity })),
        p_payment_method: payment,
      })
      if (error) throw error
      const cashier = await supabase.from('profiles').select('full_name').eq('id', profile?.id).single()
      const cust = customerId
        ? await supabase.from('profiles').select('full_name').eq('id', customerId).single()
        : { data: null }

      const full = {
        ...data,
        customer_id: customerId,
        customer_name: cust.data?.full_name || null,
        cashier_name: cashier.data?.full_name || null,
        payment_method: payment,
        created_at: new Date().toISOString(),
        items: cart.map((i) => ({ product_name: i.name, product_sku: i.sku, quantity: i.quantity, price: i.price })),
      }
      setReceipt(full)
      setCart([])
      setCustomerId('')
      load()
    } catch (err) {
      alert('Gagal memproses transaksi: ' + (err.message || err))
    } finally {
      setProcessing(false)
    }
  }

  const handleScan = (barcode) => {
    const found = products.find(
      (p) => p.barcode && String(p.barcode) === String(barcode)
    )
    if (found) add(found)
    else alert('Barcode tidak ditemukan di database produk.')
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Kasir (Point of Sale)</h1>
        <p className="text-sm text-slate-500">Pilih produk, proses pembayaran, lalu cetak nota.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari produk / SKU / barcode..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <button
              onClick={() => setScanOpen(true)}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ScanLine size={18} /> Scan
            </button>
          </div>

          <div className="grid max-h-[500px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
            {filtered.map((p) => {
              const disabled = p.stock <= 0
              return (
                <button
                  key={p.id}
                  disabled={disabled}
                  onClick={() => add(p)}
                  className={`rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition ${
                    disabled
                      ? 'opacity-50'
                      : 'hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md'
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {p.category || 'Umum'} • {p.sku}
                  </p>
                  <p className="mt-0.5 line-clamp-2 font-semibold text-slate-800">{p.name}</p>
                  <div className="mt-2 flex items-end justify-between">
                    <p className="text-sm font-extrabold text-emerald-600">{rupiah(p.price)}</p>
                    <span className={`text-[10px] font-semibold ${p.stock <= p.min_stock ? 'text-red-500' : 'text-slate-400'}`}>
                      {p.stock} {p.unit}
                    </span>
                  </div>
                </button>
              )
            })}
            {!filtered.length && (
              <p className="col-span-full py-10 text-center text-sm text-slate-400">Produk tidak ditemukan.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <ShoppingCart size={18} className="text-emerald-600" />
              <p className="font-bold text-slate-800">Keranjang</p>
              <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                {totalQty} item
              </span>
            </div>

            <div className="max-h-64 flex-1 overflow-y-auto px-4 py-3">
              {cart.length ? (
                <div className="space-y-2.5">
                  {cart.map((i) => (
                    <div key={i.product_id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-700">{i.name}</p>
                        <p className="text-xs text-slate-400">
                          {rupiah(i.price)} × {i.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQty(i.product_id, -1)} className="flex h-6 w-6 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-500 hover:bg-slate-100">
                          <Minus size={12} />
                        </button>
                        <span className="w-6 text-center text-sm font-bold">{i.quantity}</span>
                        <button onClick={() => setQty(i.product_id, 1)} className="flex h-6 w-6 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-500 hover:bg-slate-100">
                          <Plus size={12} />
                        </button>
                      </div>
                      <button onClick={() => setQty(i.product_id, -100)} className="ml-0.5 rounded-md p-1 text-slate-300 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-400">Keranjang kosong. Klik produk untuk memilih.</p>
              )}
            </div>

            <div className="space-y-3 border-t border-slate-100 px-4 py-3">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                <option value="">Pelanggan: Umum (tanpa akun)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name || c.email}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2">
                {PAYMENTS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPayment(p.value)}
                    className={`rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${
                      payment === p.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3">
                <p className="text-sm font-medium text-slate-300">Total</p>
                <p className="text-xl font-extrabold text-white">{rupiah(total)}</p>
              </div>

              <button
                onClick={checkout}
                disabled={!cart.length || processing}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {processing ? 'Memproses...' : `Bayar • ${rupiah(total)}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <BarScanner open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />

      <Modal open={Boolean(receipt)} onClose={() => setReceipt(null)} title="Transaksi Berhasil ✅" wide>
        {receipt && (
          <div className="print-area space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">{dateID(receipt.created_at)}</p>
                <p className="font-bold text-slate-800">{receipt.code}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>Kasir: {receipt.cashier_name || '-'}</p>
                <p>Pelanggan: {receipt.customer_name || 'Umum'}</p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">Barang</th>
                    <th className="px-4 py-2.5 text-center">Qty</th>
                    <th className="px-4 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {receipt.items.map((i, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2">
                        <p className="font-medium text-slate-700">{i.product_name}</p>
                        <p className="text-xs text-slate-400">{i.product_sku}</p>
                      </td>
                      <td className="px-4 py-2 text-center text-slate-600">{i.quantity}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-700">
                        {rupiah(i.price * i.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50">
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-slate-700">
                      Total ({receipt.payment_method?.toUpperCase()})
                    </td>
                    <td className="px-4 py-3 text-right text-lg font-extrabold text-emerald-600">
                      {rupiah(receipt.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <button
              onClick={() => printReceipt(receipt)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Printer size={16} /> Cetak Nota
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}