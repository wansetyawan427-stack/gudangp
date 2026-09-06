import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { ScanLine, CameraOff } from 'lucide-react'
import Modal from './Modal'

export default function BarScanner({ open, onClose, onScan }) {
  const [error, setError] = useState('')
  const scannerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setError('')
    let cancelled = false
    let scanner = null

    try {
      scanner = new Html5Qrcode('barcode-reader')
      scannerRef.current = scanner
      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 140 } },
          (text) => {
            scanner.stop().catch(() => {})
            onScan(String(text).trim())
            onClose()
          },
          () => {}
        )
        .catch((e) => {
          if (!cancelled) setError('Gagal mengakses kamera. Periksa izin kamera browser: ' + e)
        })
    } catch (e) {
      if (!cancelled) setError('Scanner tidak tersedia: ' + e)
    }

    return () => {
      cancelled = true
      scanner?.stop().catch(() => {})
    }
  }, [open, onScan, onClose])

  return (
    <Modal open={open} onClose={onClose} title="Scan Barcode Barang">
      <div className="space-y-3">
        <div
          id="barcode-reader"
          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900 [&>video]:w-full"
          style={{ width: '100%' }}
        />
        {error ? (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <CameraOff size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            <ScanLine size={18} className="shrink-0" />
            Arahkan kamera ke barcode produk. Barcode akan dicocokkan dengan SKU di database.
          </div>
        )}
        <button
          onClick={onClose}
          className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Tutup
        </button>
      </div>
    </Modal>
  )
}