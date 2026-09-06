export const ROLES = ['admin', 'gudang', 'kasir', 'pelanggan']

export const ROLE_LABEL = {
  admin: 'Admin',
  gudang: 'Gudang',
  kasir: 'Kasir',
  pelanggan: 'Pelanggan',
}

export const ROLE_BADGE = {
  admin: 'bg-purple-100 text-purple-800 ring-purple-200',
  gudang: 'bg-amber-100 text-amber-800 ring-amber-200',
  kasir: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  pelanggan: 'bg-sky-100 text-sky-800 ring-sky-200',
}

export function roleLabel(role) {
  return ROLE_LABEL[role] || role || '-'
}

export function roleBadge(role) {
  return ROLE_BADGE[role] || ROLE_BADGE.pelanggan
}