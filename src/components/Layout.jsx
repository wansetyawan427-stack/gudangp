import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Boxes,
  ReceiptText,
  ShoppingCart,
  Users,
  Menu as MenuIcon,
  X,
  LogOut,
  MessageCircle,
  Tag,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { roleLabel, roleBadge } from '../lib/roles'
import ChatWidget from './ChatWidget'

const NAVS = {
  admin: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/produk', label: 'Produk', icon: Package },
    { to: '/kategori', label: 'Kategori', icon: Tag },
    { to: '/stok', label: 'Stok', icon: Boxes },
    { to: '/kasir', label: 'Kasir', icon: ReceiptText },
    { to: '/transaksi', label: 'Transaksi', icon: ShoppingCart },
    { to: '/pengguna', label: 'Pengguna', icon: Users },
  ],
  gudang: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/produk', label: 'Produk & Barang', icon: Package },
    { to: '/kategori', label: 'Kategori', icon: Tag },
    { to: '/stok', label: 'Stok', icon: Boxes },
  ],
  kasir: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/kasir', label: 'Kasir (POS)', icon: ReceiptText },
    { to: '/transaksi', label: 'Transaksi', icon: ShoppingCart },
  ],
  pelanggan: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/produk', label: 'Belanja', icon: ShoppingCart },
    { to: '/transaksi', label: 'Riwayat', icon: ReceiptText },
  ],
}

export default function Layout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const role = profile?.role || 'pelanggan'
  const navs = NAVS[role] || NAVS.pelanggan

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-xl shadow-lg shadow-emerald-500/30">
          📦
        </div>
        <div>
          <p className="text-base font-bold text-white">GudangKu</p>
          <p className="text-[11px] text-slate-400">Manajemen Gudang</p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {navs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="m-3 rounded-xl bg-white/5 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white">
            {(profile?.full_name || 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {profile?.full_name || 'Pengguna'}
            </p>
            <span
              className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${roleBadge(role)}`}
            >
              {roleLabel(role)}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-red-500/20 hover:text-red-300"
        >
          <LogOut size={14} /> Keluar
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-slate-900 lg:block">
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-slate-900 shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:px-8">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <MenuIcon size={20} />
          </button>
          <div className="flex-1">
            <p className="text-xs text-slate-500">
              {new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <p className="text-sm font-semibold text-slate-700">
              Selamat datang, {profile?.full_name || 'Pengguna'}! 👋
            </p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 sm:flex">
            <MessageCircle size={14} />
            AI aktif
          </span>
        </header>

        <main className="px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <ChatWidget />
    </div>
  )
}