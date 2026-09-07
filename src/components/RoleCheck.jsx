import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RoleCheck({ roles, children }) {
  const { profile } = useAuth()
  if (!roles.includes(profile?.role)) return <Navigate to="/" replace />
  return children
}