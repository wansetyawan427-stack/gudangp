import { useEffect, useRef, useState } from 'react'
import { Bot, Send, X, MessageCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { askAI } from '../lib/ai'

const GREETING =
  'Halo! 👋 Aku asisten AI GudangKu. Tanyakan apa saja tentang produk, stok, harga, atau fitur aplikasi. Aku juga bisa **membuat gambar** — coba ketik: "buatkan gambar logo gudang" ➡️🎨'

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderContent(content) {
  const lines = String(content || '')
  return lines
    .split('\n')
    .map((line) => {
      const mdImage = line.match(/!\[([^\]]*)\]\((\S+)\)/)
      if (mdImage) {
        const [, alt, url] = mdImage
        return `<div class="chat-img-line"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" onerror="this.parentElement.innerHTML='❌ Gagal memuat gambar'" /><p class="chat-img-alt">${escapeHtml(alt)}</p></div>${line.replace(mdImage[0], '').length ? `<p>${escapeHtml(line.replace(mdImage[0], ''))}</p>` : ''}`
      }
      const plainImg = line.match(/^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i)
      if (plainImg) {
        return `<div class="chat-img-line"><img src="${escapeHtml(line.trim())}" alt="gambar" onerror="this.parentElement.innerHTML='❌ Gagal memuat gambar'" /></div>`
      }
      return `<p>${escapeHtml(line)}</p>`
    })
    .join('')
}

export default function ChatWidget() {
  const { profile, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const boxRef = useRef(null)
  const key = user ? `gudangku-chat-${user.id}` : 'gudangku-chat'

  useEffect(() => {
    if (!user) return
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        setMessages(JSON.parse(saved))
        return
      } catch {
        /* abaikan */
      }
    }
    setMessages([{ role: 'assistant', content: GREETING }])
  }, [key, user])

  useEffect(() => {
    if (user && open) {
      const trimmed = messages.slice(-50)
      if (trimmed.length !== messages.length) setMessages(trimmed)
      else localStorage.setItem(key, JSON.stringify(messages))
    }
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [messages, open, key, user])

  const send = async () => {
    const text = input.trim()
    if (!text || typing) return
    setInput('')
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setTyping(true)
    try {
      const history = next.slice(-8).map((m) => ({ role: m.role, content: m.content }))
      const reply = await askAI(text, {
        role: profile?.role,
        name: profile?.full_name || 'Pengguna',
        history,
      })
      setMessages([...next, { role: 'assistant', content: reply }])
    } finally {
      setTyping(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/40 transition hover:scale-105 hover:bg-emerald-700"
        aria-label="Chat AI"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[520px] w-[min(380px,calc(100vw-2rem))] animate-chat flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <Bot size={20} />
            </div>
            <div>
              <p className="text-sm font-bold">GudangKu AI</p>
              <p className="text-[11px] text-emerald-100">Asisten cerdas • online</p>
            </div>
          </div>

          <div ref={boxRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'rounded-br-sm bg-emerald-600 text-white'
                      : 'rounded-bl-sm border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {m.role === 'user' ? (
                    m.content
                  ) : (
                    <div
                      className="chat-content space-y-1.5"
                      dangerouslySetInnerHTML={{ __html: renderContent(m.content) }}
                    />
                  )}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-2.5 text-slate-500">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Tanya asisten AI..."
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                onClick={send}
                disabled={!input.trim() || typing}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}