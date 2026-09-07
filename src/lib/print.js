export function printReceipt(trx) {
  const w = window.open('', '_blank', 'width=340,height=620')
  if (!w) return
  const items = (trx.items || [])
    .map(
      (i) =>
        `<tr><td>${i.product_name}${i.product_sku ? `<br><small>${i.product_sku}</small>` : ''}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${fmt(i.price * i.quantity)}</td></tr>`
    )
    .join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${trx.code}</title>
<style>
  * { font-family: 'Courier New', monospace; }
  body { width: 300px; margin: 0 auto; padding: 16px; color: #000; }
  .center { text-align: center; }
  h2 { margin: 4px 0; font-size: 16px; }
  .muted { font-size: 11px; color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
  td, th { padding: 3px 0; }
  .total td { border-top: 1px dashed #000; padding-top: 6px; font-weight: bold; font-size: 14px; }
  .divider { border-top: 1px dashed #000; margin: 8px 0; }
</style></head><body>
  <div class="center"><h2>GUDANGKU</h2><p class="muted">Manajemen Gudang & Penjualan</p></div>
  <div class="divider"></div>
  <p class="muted">No. ${trx.code}</p>
  <p class="muted">Tanggal: ${new Date(trx.created_at).toLocaleString('id-ID')}</p>
  <p class="muted">Kasir: ${trx.cashier_name || '-'}</p>
  <p class="muted">Pelanggan: ${trx.customer_name || 'Umum'}</p>
  <div class="divider"></div>
  <table><thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${items}</tbody></table>
  <div class="divider"></div>
  <table class="total"><tr><td>Total Bayar</td><td style="text-align:right">${fmt(trx.total)}</td></tr></table>
  <p class="muted" style="text-align:right">Metode: ${trx.payment_method.toUpperCase()}</p>
  <div class="divider"></div>
  <p class="center muted">Terima kasih atas kunjungan Anda!</p>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); }</script>
</body></html>`
  function fmt(n) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
  }
  w.document.write(html)
  w.document.close()
}