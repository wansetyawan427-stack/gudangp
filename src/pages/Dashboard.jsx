import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  Boxes,
  AlertTriangle,
  ShoppingCart,
  Users,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { rupiah, dateID, todayLabel } from '../lib/format'
import { roleLabel } from '../lib/roles'

export default function Dashboard() {
  const { profile } = useAuth()
  const role = profile?.role || 'pelanggan'
  const [stats, setStats] = useState(null)
  const [recentTrx, setRecentTrx] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    let summary = { total_products: 0, total_stock: 0, total_value: 0, low_stock: 0, out_of_stock: 0 }
    try {
      const { data } = await supabase.rpc('get_dashboard_summary')
      if (data) summary = data
    } catch {
      /* rpc mungkin belum ada */
    }
    setStats(summary)

    const { data: products } = await supabase
      .from('products')
      .select('name, stock')
      .order('stock', { ascending: true })
      .limit(10)
    const low = (products || []).filter((p) => p.stock <= 5)
    setLowStock(low)

    const { data: top } = await supabase
      .from('products')
      .select('name, stock')
      .order('stock', { ascending: false })
      .limit(8)
    setChartData((top || []).map((p) => ({ name: p.name, stok: p.stock })))

    const { data: trx } = await supabase
      .from('transactions')
      .select('code, total, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    setRecentTrx(trx || [])
  }

  const cards = [
    { label: 'Total Produk', value: stats?.total_products ?? 0, icon: Package, color: 'bg-sky-500' },
    { label: 'Total Stok', value: stats?.total_stock ?? 0, icon: Boxes, color: 'bg-emerald-500' },
    {
      label: 'Nilai Stok',
      value: rupiah(stats?.total_value ?? 0),
      icon: TrendingUp,
      color: 'bg-violet-500',
      small: true,
    },
    { label: 'Stok Menipis', value: stats?.low_stock ?? 0, icon: AlertTriangle, color: 'bg-amber-500' },
  ]

  if (role === 'pelanggan') {
    return (
      <div className="space-y-6">
        <Greeting name={profile?.full_name} role={role} />
        <div className="grid gap-4 sm:grid-cols-3">
          <MiniCard
            icon={Package}
            label="Cari produk"
            desc="Jelajahi katalog & pesan"
            to="/produk"
            action="Belanja"
          />
          <MiniCard
            icon={ShoppingCart}
            label="Riwayat transaksi"
            desc={recentTrx.length ? `Transaksi terakhir: ${recentTrx[0].code}` : 'Belum ada transaksi'}
            to="/transaksi"
            action="Lihat"
          />
          <MiniCard
            icon={BotIcon}
            label="AI Chat"
            desc="Tanya stok, harga, & lainnya"
            to={null}
            action="Klik kanan bawah"
          />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-bold text-slate-700">Produk Terbaru Yang Baru Masuk</h3>
          {recentTrx.length ? (
            <ul className="divide-y divide-slate-100">
              {recentTrx.map((t) => (
                <li key={t.code} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-slate-700">{t.code}</p>
                    <p className="text-xs text-slate-400">{dateID(t.created_at)}</p>
                  </div>
                  <span className="font-semibold text-emerald-600">{rupiah(t.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Belum ada transaksi. Yuk mulai belanja di menu Belanja!" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Greeting name={profile?.full_name} role={role} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-white ${c.color}`}>
                <c.icon size={18} />
              </div>
            </div>
            <p className={`mt-2 font-bold text-slate-800 ${c.small ? 'text-xl' : 'text-3xl'}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700">Grafik Stok Produk (10 teratas)</h3>
            <Link to="/stok" className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline">
              Kelola stok <ArrowRight size={14} />
            </Link>
          </div>
          {chartData.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} pcs`, 'Stok']} />
                  <Bar dataKey="stok" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty text="Belum ada data produk. Tambahkan produk di menu Produk." />
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <AlertTriangle size={16} className="text-amber-500" /> Stok Menipis
              </h3>
              <Link to="/stok" className="text-xs font-medium text-emerald-600 hover:underline">
                Semua stok
              </Link>
            </div>
            {lowStock.length ? (
              <ul className="divide-y divide-slate-100">
                {lowStock.map((p) => (
                  <li key={p.name} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-slate-700">{p.name}</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {p.stock} pcs
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-xs text-slate-400">Stok semua aman ✅</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
              <ShoppingCart size={16} className="text-emerald-500" /> Transaksi Terbaru
            </h3>
            {recentTrx.length ? (
              <ul className="divide-y divide-slate-100">
                {recentTrx.map((t) => (
                  <li key={t.code} className="py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{t.code}</span>
                      <span className="font-semibold text-emerald-600">{rupiah(t.total)}</span>
                    </div>
                    <p className="text-xs text-slate-400">{dateID(t.created_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-xs text-slate-400">Belum ada transaksi</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Greeting({ name, role }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{todayLabel()}</p>
      <h1 className="text-2xl font-bold text-slate-800">
        Halo, {name || 'Admin'}! 👋
      </h1>
      <p className="text-sm text-slate-500">
        Ringkasan hari ini sebagai <b className="text-slate-700">{roleLabel(role)}</b>.
      </p>
    </div>
  )
}

function MiniCard({ icon: Icon, label, desc, to, action }) {
  const inner = (
    <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Icon size={20} />
        </div>
        <p className="font-bold text-slate-800">{label}</p>
        <p className="mt-1 text-xs text-slate-500">{desc}</p>
      </div>
      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
        {action} {to && <ArrowRight size={13} />}
      </span>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

function BotIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 8V4M8 4h8M8 13h.01M16 13h.01M8 17h8" />
    </svg>
  )
}

function Empty({ text }) {
  return <p className="py-6 text-center text-xs text-slate-400">{text}</p>
}