import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import RoleCheck from './components/RoleCheck'
import Layout from './components/Layout'
import Login from './pages/Login'
import ConfigScreen from './pages/ConfigScreen'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Categories from './pages/Categories'
import Stock from './pages/Stock'
import Cashier from './pages/Cashier'
import Transactions from './pages/Transactions'
import Users from './pages/Users'
import Settings from './pages/Settings'

function AppRoutes() {
  const { configured } = useAuth()

  if (!configured) return <ConfigScreen />

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/produk"
            element={
              <RoleCheck roles={['admin', 'gudang', 'pelanggan']}>
                <Products />
              </RoleCheck>
            }
          />
          <Route
            path="/kategori"
            element={
              <RoleCheck roles={['admin', 'gudang']}>
                <Categories />
              </RoleCheck>
            }
          />
          <Route
            path="/stok"
            element={
              <RoleCheck roles={['admin', 'gudang']}>
                <Stock />
              </RoleCheck>
            }
          />
          <Route
            path="/kasir"
            element={
              <RoleCheck roles={['admin', 'kasir']}>
                <Cashier />
              </RoleCheck>
            }
          />
          <Route
            path="/transaksi"
            element={
              <RoleCheck roles={['admin', 'kasir', 'pelanggan']}>
                <Transactions />
              </RoleCheck>
            }
          />
          <Route
            path="/pengguna"
            element={
              <RoleCheck roles={['admin']}>
                <Users />
              </RoleCheck>
            }
          />
          <Route
            path="/pengaturan"
            element={
              <RoleCheck roles={['admin']}>
                <Settings />
              </RoleCheck>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}