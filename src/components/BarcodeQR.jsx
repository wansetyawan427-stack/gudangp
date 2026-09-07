import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { Printer, Loader2, QrCode, X } from 'lucide-react'
import Modal from './Modal'
import { qrPayload } from '../lib/barcode'
import { rupiah } from '../lib/format'

export default function BarcodeQR({ open, onClose, product }) {
  const barcodeRef = useRef(null)
  const [qrUrl, setQrUrl] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr('')
    setQrUrl('')
    const payload = product?.sku || product?.id || ''
    QRCode.toDataURL(qrPayload(product), { width: 220, margin: 1, color: { dark: '#0f172a' } })
      .then(setQrUrl)
      .catch(() => setErr('Gagal membuat QR'))
  }, [open, product])

  useEffect(() => {
    if (open && barcodeRef.current && product?.barcode) {
      try {
        const opts = { format: 'EAN13', width: 2, height: 70, fontSize: 14, margin: 4, displayValue: true }
        JsBarcode(barcodeRef.current, product.barcode, opts)
      } catch {
        setErr('Barcode tidak valid (harus 13 digit).') 
      }
    }
  }, [open, product, barcodeRef])

  return (
    <Modal open={open} onClose={onClose} title="Barcode & QR" footer={null}>
      <div className="print-area space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800">{product.name}</p>
            <p className="text-xs text-slate-500">
              {product.sku} • {product.category || 'Umum'} • {rupiah(product.price)}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <Printer size={14} /> Cetak
          </button>
        </div>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}

        <div className="flex flex-wrap items-center justify-center gap-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col items-center">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Barcode (EAN-13)</p>
            <svg ref={barcodeRef} />
            <p className="mt-1 text-[11px] text-slate-400">Scan dengan scanner / app barcode</p>
          </div>
          <div className="flex flex-col items-center">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">QR Code</p>
            {qrUrl ? (
              <img src={qrUrl} alt="QR" className="h-40 w-40 rounded-lg border border-slate-100" />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300">
                <Loader2 size={20} className="animate-spin" />
              </div>
            )}
            <p className="mt-1 text-[11px] text-slate-400">Scan → langsung membuka produk ini</p>
          </div>
        </div>

        {!product.barcode && (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <QrCode size={14} className="mt-0.5 shrink-0" />
            Produk belum punya barcode. Edit produk lalu klik “Generate Barcode” di form untuk membuat kode 13 digit otomatis.
          </p>
        )}
      </div>
    </Modal>
  )
}