export function generateEAN13(prefix = '899') {
  const today = new Date()
  const datePart = `${today.getFullYear()}${today.getMonth() + 1}${today.getDate()}`
    .replace(/\D/g, '')
    .padStart(4, '0');
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  const body = `${prefix}${datePart}${rand}`.slice(0, 12)
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[i])
    sum += i % 2 === 0 ? d : d * 3
  }
  const check = (10 - (sum % 10)) % 10
  return body + check
}

export function qrPayload(product) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/produk?sku=${encodeURIComponent(product?.sku || '')}`
}

export function barcodeIsValid(code) {
  const c = String(code || '').replace(/[^\d]/g, '')
  if (c.length !== 13) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += i % 2 === 0 ? Number(c[i]) : Number(c[i]) * 3
  return (10 - (sum % 10)) % 10 === Number(c[12])
}