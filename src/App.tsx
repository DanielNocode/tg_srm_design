import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom'
import api from './api/client'
import { useStore, type MsgData } from './store'
import './App.css'

/* ── USER NAVIGATION ── */
async function openUserDialog(tgUserId: string) {
  try {
    // Search for dialog with this tg_chat_id across all accounts
    const r = await api.get(`/dialogs/by-tg-user/${tgUserId}`)
    if (r.data.dialog_id) {
      const s = useStore.getState()
      // Make sure dialog is in store
      if (!s.dialogs.some(d => d.id === r.data.dialog_id)) {
        const dr = await api.get(`/dialogs/${r.data.dialog_id}`)
        useStore.setState(st => ({ dialogs: [dr.data, ...st.dialogs] }))
      }
      useStore.getState().setSelId(r.data.dialog_id)
      useStore.getState().setShowChat(true)
    }
  } catch {}
}

/* ── TEXT RENDERING ── */
function renderText(text: string) {
  const parts: React.ReactNode[] = []
  // Order matters: markdown links first (may contain ** inside), then bold, then URLs
  const re = /\[([^\]]+)\]\((tg:\/\/[^\s)]+)\)|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|(https?:\/\/[^\s<)]+)/g
  let last = 0, key = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[1] && match[2]) {
      // tg:// mention → clickable, opens user's dialog in CRM
      const uidMatch = match[2].match(/id=(\d+)/)
      const uid = uidMatch ? uidMatch[1] : null
      parts.push(<strong key={key++} style={{ color: 'var(--acc)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' as const }}
        onClick={() => uid && openUserDialog(uid)}>{match[1]}</strong>)
    } else if (match[3] && match[4]) {
      // Markdown link [text](https://...) — text may contain ** which we strip
      const linkText = match[3].replace(/\*\*/g, '')
      parts.push(<a key={key++} href={match[4]} target="_blank" rel="noreferrer" style={{ color: 'var(--acc)', textDecoration: 'underline' }}>{linkText}</a>)
    } else if (match[5]) {
      // Bold **text** — may contain [link](url) inside, render recursively
      const inner = match[5]
      if (/\[.*\]\(.*\)/.test(inner)) {
        parts.push(<strong key={key++}>{renderText(inner)}</strong>)
      } else {
        parts.push(<strong key={key++}>{inner}</strong>)
      }
    } else if (match[6]) {
      parts.push(<em key={key++}>{match[6]}</em>)
    } else if (match[7]) {
      parts.push(<a key={key++} href={match[7]} target="_blank" rel="noreferrer" style={{ color: 'var(--acc)', textDecoration: 'underline', wordBreak: 'break-all' }}>{match[7]}</a>)
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : text
}

function stripMd(s: string) {
  return s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1')
}

/* ── EMOJI DATA ── */
const EMOJI_CATS = [
  { icon: '😀', label: 'Смайлы', emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','🤪','😜','🥳','🤔','😢','😭','😱','🤯','🥺','😴','🤭','🫡','😐','😑','😤','😫','🥲'] },
  { icon: '👍', label: 'Жесты', emojis: ['👍','👎','👌','🤌','✌️','🤞','✊','👊','🤝','🙏','💪','👋','✋','🖐️','🤟','🫶','🤙','🤘','👈','🤚','🫰'] },
  { icon: '❤️', label: 'Сердца', emojis: ['❤️','🧡','💛','💚','💙','💜','🤎','🤍','🖤','💔','❣️','💕','💖','💗','💘','💝','🔥','⭐','✨','💫','🎯','💯'] },
  { icon: '💼', label: 'Работа', emojis: ['💼','📋','📌','📎','📁','📊','📈','💡','🏢','💻','📱','⌨️','🖥️','📧','🔧','🎯','🚀','⚡','🔔','🎉'] },
]

function timeAgo(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso), now = Date.now(), diff = Math.floor((now - d.getTime()) / 1000)
  if (diff < 60) return 'сейчас'
  if (diff < 3600) return `${Math.floor(diff / 60)}м`
  if (diff < 86400) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })
}
function msgTime(iso: string) { return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) }

/* ── LOGIN ── */
function Login() {
  const [login, setLogin] = useState(''); const [password, setPassword] = useState('')
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const setAuth = useStore(s => s.setAuth); const nav = useNavigate()
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/login', { login, password })
      setAuth(data.token, data.operator_id, data.name); nav('/')
    } catch { setError('Неверный логин или пароль') } finally { setLoading(false) }
  }
  return <div className="login-page"><form onSubmit={submit} className="login-form">
    <h2>TG Inbox — CRM</h2>
    <input placeholder="Логин" value={login} onChange={e => setLogin(e.target.value)} autoFocus />
    <input placeholder="Пароль" type="password" value={password} onChange={e => setPassword(e.target.value)} />
    {error && <div className="login-error">{error}</div>}
    <button type="submit" disabled={loading}>{loading ? '...' : 'Войти'}</button>
  </form></div>
}

/* ── SIDEBAR ── */
function Sidebar() {
  const { dialogs, selId, setSelId, folders, setFolders, accounts, setAccounts,
    tab, setTab, search, setSearch, accFilter, toggleAccFilter, theme, toggleTheme,
    operatorName, setShowChat } = useStore()

  const [syncing, setSyncing] = useState(false)

  const reloadDialogs = useStore(s => s.reloadDialogs)

  const loadDialogs = useCallback(() => {
    reloadDialogs()
  }, [reloadDialogs])

  const syncFromTg = async () => {
    setSyncing(true)
    try {
      await api.post('/dialogs/sync')
      loadDialogs()
    } catch {} finally { setSyncing(false) }
  }

  useEffect(() => {
    loadDialogs()
  }, [loadDialogs, search])

  useEffect(() => {
    api.get('/folders').then(r => setFolders(r.data.items)).catch(() => {})
    api.get('/accounts').then(r => setAccounts(r.data.items)).catch(() => {})
  }, [setFolders, setAccounts])

  // Auto-sync on first load if no dialogs
  useEffect(() => {
    if (dialogs.length === 0) {
      api.post('/dialogs/sync').then(() => loadDialogs()).catch(() => {})
    }
  }, []) // eslint-disable-line

  const filtered = dialogs.filter(d => {
    if (tab === 'private' || tab === 'group') {
      if (d.type !== tab) return false
    } else {
      if (!d.folders.some(f => f.id === Number(tab))) return false
    }
    if (accFilter.length && !accFilter.includes(d.account_id)) return false
    return true
  })

  const totalUn = dialogs.reduce((s, d) => s + d.unread_count, 0)
  const privUn = dialogs.filter(d => d.type === 'private').reduce((s, d) => s + d.unread_count, 0)
  const grpUn = dialogs.filter(d => d.type === 'group').reduce((s, d) => s + d.unread_count, 0)

  const select = (id: number) => { setSelId(id); setShowChat(true) }

  return <div id="sidebar">
    <div className="sb-head">
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--t0)' }}>TG Inbox</div>
        <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 1, fontFamily: 'monospace' }}>
          {accounts.length} акк · {totalUn} непрочит.
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <button className="icon-btn" onClick={syncFromTg} title="Синхронизировать из Telegram" style={{ fontSize: 14 }}>
          {syncing ? <span className="spinner" /> : '↻'}
        </button>
        <button className="theme-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀' : '🌙'}</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--pvt-c)' }} />
          <span style={{ fontSize: 13, color: 'var(--t1)' }}>{operatorName || 'Оператор'}</span>
        </div>
      </div>
    </div>

    {accounts.length > 0 && <div className="acc-filter">
      <div className="slabel" style={{ width: '100%', paddingBottom: 3 }}>Аккаунты</div>
      {accounts.map(a => {
        const on = accFilter.includes(a.id)
        return <span key={a.id} className="apill" onClick={() => toggleAccFilter(a.id)}
          style={{ color: on ? a.color : undefined, borderColor: on ? a.color : undefined, background: on ? a.color + '18' : 'transparent' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.color, display: 'inline-block' }} />
          {a.label || a.id}
        </span>
      })}
    </div>}

    <div className="search-wrap">
      <input className="search-input" placeholder="Поиск диалогов…" value={search} onChange={e => setSearch(e.target.value)} />
    </div>

    <div className="tabs">
      <button className={`tab-btn ${tab === 'private' ? 'active' : ''}`} onClick={() => setTab('private')}>
        Личные{privUn > 0 && <span className="ubadge">{privUn}</span>}
      </button>
      <button className={`tab-btn ${tab === 'group' ? 'active' : ''}`} onClick={() => setTab('group')}>
        Группы{grpUn > 0 && <span className="ubadge">{grpUn}</span>}
      </button>
      {folders.map(f => <button key={f.id} className={`tab-btn ${tab === String(f.id) ? 'active' : ''}`} onClick={() => setTab(String(f.id))}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: f.color, display: 'inline-block', flexShrink: 0 }} />
        {f.name}
      </button>)}
    </div>

    <div className="dialog-list">
      {/* Избранное — opens /saved endpoint */}
      <div className="drow saved-row" style={{ cursor: 'pointer' }} onClick={() => {
        // TODO: Saved messages view - for now just show a placeholder
        setSelId(-1); setShowChat(true)
      }}>
        <div className="av" style={{ background: 'var(--gold-bg)', color: 'var(--gold)' }}>⭐</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, color: 'var(--t0)' }}>Избранное</div>
          <span style={{ color: 'var(--t2)', fontSize: 13 }}>Личные заметки</span>
        </div>
      </div>
      {filtered.map(d => <div key={d.id} className={`drow ${d.id === selId ? 'sel' : ''}`} onClick={() => select(d.id)}>
        <div className="av" style={{ background: d.account_color + '20', color: d.account_color }}>{d.title[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 155, color: 'var(--t0)' }}>{d.title}</span>
            <span style={{ fontSize: 12, color: 'var(--t2)', fontFamily: 'monospace', flexShrink: 0, marginLeft: 6 }}>{timeAgo(d.last_msg_at)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 155, fontSize: 14 }}>{stripMd(d.last_msg_text || '')}</span>
            {d.unread_count > 0 && <span className="ubadge">{d.unread_count}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="chip" style={{ background: d.account_color + '14', color: d.account_color }}>{d.account_label}</span>
            {d.folders.map(f => <span key={f.id} className="d-folder-dot" style={{ background: f.color }} title={f.name} />)}
          </div>
        </div>
      </div>)}
      {filtered.length === 0 && <div style={{ padding: 20, color: 'var(--t2)', fontSize: 15, textAlign: 'center' }}>Нет диалогов</div>}
    </div>
  </div>
}

/* ── CHAT PANEL ── */
function LazyVideo({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false)
  if (!loaded) return (
    <div onClick={() => setLoaded(true)} style={{ width: 260, height: 160, borderRadius: 8, marginTop: 4, background: '#1a2030', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid var(--bd2)' }}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 32 }}>▶</span>
        <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4 }}>Нажмите для загрузки видео</div>
      </div>
    </div>
  )
  return <video controls playsInline autoPlay src={url} style={{ maxWidth: 300, borderRadius: 8, marginTop: 4 }} />
}

function VideoNote({ url }: { url: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const toggle = () => {
    if (!ref.current) return
    if (ref.current.paused) { ref.current.play(); setPlaying(true) }
    else { ref.current.pause(); setPlaying(false) }
  }
  return (
    <div style={{ position: 'relative', width: 200, height: 200, marginTop: 4, cursor: 'pointer', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#000' }} onClick={toggle}>
      <video ref={ref} src={url} playsInline loop preload="auto"
        onEnded={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        style={{ width: 200, height: 200, objectFit: 'cover', display: 'block' }} />
      {!playing && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
        <span style={{ fontSize: 40, color: '#fff' }}>▶</span>
      </div>}
    </div>
  )
}

function ChatPanel() {
  const { selId, dialogs, messages, setMessages, templates, setTemplates, openPanel, setOpenPanel, toggleDetails, setShowChat } = useStore()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [emojiCat, setEmojiCat] = useState(0)
  const [tmplSearch, setTmplSearch] = useState('')
  const [pendingFiles, setPendingFiles] = useState<{ id: string; name: string; size: string; type: string; url?: string }[]>([])
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const dialog = dialogs.find(d => d.id === selId)
  const msgs = selId ? messages[selId] : undefined

  // If dialog not in store, fetch it
  useEffect(() => {
    if (selId && selId > 0 && !dialogs.some(d => d.id === selId)) {
      api.get(`/dialogs/${selId}`).then(r => {
        useStore.setState(s => ({ dialogs: [r.data, ...s.dialogs] }))
      }).catch(() => {})
    }
  }, [selId, dialogs])

  useEffect(() => {
    if (!selId) return
    if (selId === -1) {
      // Избранное
      api.get('/saved').then(r => {
        const items = (r.data.items || []).map((m: any) => ({
          id: m.id, tg_msg_id: null, from_name: m.from_name, text: m.text,
          direction: 'in' as const, sent_at: m.sent_at || '', operator_id: null,
          is_read: true, is_forwarded: m.is_forwarded, forward_from_name: m.forward_from_name,
          has_files: m.has_files, rd: null, media_type: null, media_url: null,
        }))
        setMessages(-1, items.reverse())
      }).catch(() => {})
      return
    }
    api.get(`/messages/${selId}`).then(r => {
      const items: MsgData[] = r.data.items
      setMessages(selId, items.reverse())
    }).catch(() => {})
    api.get(`/dialogs/${selId}/sync-read`).catch(() => {})
    // Mark as read in CRM (NOT in Telegram) — synced for all operators
    api.post(`/dialogs/${selId}/mark-read-crm`).then(() => {
      // Reload dialogs to update unread counts for everyone
      useStore.getState().reloadDialogs()
    }).catch(() => {})
  }, [selId, setMessages])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  useEffect(() => {
    api.get('/templates').then(r => setTemplates(r.data.items)).catch(() => {})
  }, [setTemplates])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList?.length) return
    const fd = new FormData()
    for (const f of fileList) fd.append('files', f)
    try {
      const r = await api.post('/files/upload', fd)
      setPendingFiles(prev => [...prev, ...(r.data.files || []).map((f: any) => ({
        id: f.file_id, name: f.name, size: String(f.size), type: f.type,
      }))])
    } catch {}
    if (fileRef.current) fileRef.current.value = ''
  }

  const send = useCallback(async (overrideText?: string) => {
    const tx = (overrideText || text).trim()
    if (!tx && !pendingFiles.length) return
    if (!selId || selId === -1 || sending) return
    setSending(true)
    try {
      await api.post(`/messages/${selId}/send`, {
        text: tx,
        file_ids: pendingFiles.map(f => f.id),
      })
      setText(''); setPendingFiles([])
      const r = await api.get(`/messages/${selId}`)
      setMessages(selId, (r.data.items as MsgData[]).reverse())
    } catch {} finally { setSending(false) }
  }, [text, selId, sending, pendingFiles, setMessages])

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
  const autoH = (el: HTMLTextAreaElement) => { el.style.height = ''; el.style.height = Math.min(el.scrollHeight, 120) + 'px' }

  const insertEmoji = (em: string) => {
    if (!inputRef.current) return
    const inp = inputRef.current, s = inp.selectionStart, en = inp.selectionEnd
    const nv = text.slice(0, s) + em + text.slice(en)
    setText(nv); setTimeout(() => { inp.selectionStart = inp.selectionEnd = s + em.length; inp.focus() }, 0)
  }

  const filteredTmpls = (templates || []).filter(t => !tmplSearch || t.title.toLowerCase().includes(tmplSearch.toLowerCase()) || t.text.toLowerCase().includes(tmplSearch.toLowerCase()))

  if (!selId) {
    return <div className="chat-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t2)', fontSize: 15 }}>
      Выберите диалог
    </div>
  }

  // Избранное
  if (selId === -1) {
    const savedMsgs = messages[-1] || []
    return <div className="chat-panel">
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <button className="back-btn icon-btn" onClick={() => setShowChat(false)} style={{ fontSize: 22 }}>←</button>
          <div className="av" style={{ background: 'var(--gold-bg)', color: 'var(--gold)', width: 38, height: 38, fontSize: 20 }}>⭐</div>
          <div><div style={{ fontWeight: 500, fontSize: 16, color: 'var(--t0)' }}>Избранное</div>
          <div style={{ fontSize: 12, color: 'var(--t2)' }}>Личные записи, гайды</div></div>
        </div>
      </div>
      <div className="messages">
        {savedMsgs.map(m => <div key={m.id} className="mwrap in">
          <div className="mbub in">{m.text || '[файл]'}</div>
          <div className="msg-foot"><span className="msg-time">{m.sent_at ? msgTime(m.sent_at) : ''}</span></div>
        </div>)}
        {savedMsgs.length === 0 && <div style={{ textAlign: 'center', color: 'var(--t2)', padding: 32 }}>Нет сохранённых сообщений.<br/>Нажмите ⭐ на любом сообщении чтобы сохранить.</div>}
      </div>
      <div className="input-area">
        <textarea className="msg-input" rows={1} placeholder="Сохранить заметку в Избранное…"
          value={text} onChange={e => { setText(e.target.value); autoH(e.target) }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveFavNote() } }} />
        <button className="send-btn" onClick={saveFavNote} disabled={sending}>↑</button>
      </div>
    </div>
  }

  // Helper for saving notes to Избранное
  async function saveFavNote() {
    const tx = text.trim()
    if (!tx || sending) return
    setSending(true)
    try {
      // Create a saved message directly via the saved endpoint's underlying mechanism
      // We'll use a simple POST to a note-saving endpoint
      await api.post('/saved/note', { text: tx })
      setText('')
      // Reload saved
      api.get('/saved').then(r => {
        const items = (r.data.items || []).map((m: any) => ({
          id: m.id, tg_msg_id: null, from_name: m.from_name, text: m.text,
          direction: 'in' as const, sent_at: m.sent_at || '', operator_id: null,
          is_read: true, is_forwarded: false, forward_from_name: null,
          has_files: m.has_files, rd: null, media_type: null, media_url: null,
        }))
        setMessages(-1, items.reverse())
      }).catch(() => {})
    } catch {} finally { setSending(false) }
  }

  if (!dialog) {
    return <div className="chat-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t2)', fontSize: 15 }}>
      Выберите диалог
    </div>
  }

  const startRename = () => { setRenameVal(dialog.title); setRenaming(true) }
  const doRename = async () => {
    if (!renameVal.trim() || renameSaving || !selId) return
    setRenameSaving(true)
    try {
      await api.post(`/dialogs/${selId}/rename`, { new_title: renameVal.trim() })
      setRenaming(false)
      useStore.getState().reloadDialogs()
    } catch {} finally { setRenameSaving(false) }
  }

  const deleteMsg = async (msgId: number) => {
    if (!confirm('Удалить сообщение в Telegram?')) return
    try {
      await api.post(`/messages/${msgId}/delete`)
      if (selId) {
        const r = await api.get(`/messages/${selId}`)
        setMessages(selId, (r.data.items as MsgData[]).reverse())
      }
    } catch {}
  }

  const accColor = dialog.account_color
  const typeChip = dialog.type === 'group'
    ? <span className="chip" style={{ background: 'var(--grp-c)', color: '#fff', opacity: 0.7 }}>группа</span>
    : <span className="chip" style={{ background: 'var(--pvt-c)', color: '#fff', opacity: 0.7 }}>личный</span>

  return <div className="chat-panel">
    <div className="chat-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        <button className="back-btn icon-btn" onClick={() => setShowChat(false)} style={{ fontSize: 22, marginRight: 2 }}>←</button>
        <div className="av" style={{ background: accColor + '20', color: accColor, width: 38, height: 38, fontSize: 15, flexShrink: 0 }}>{dialog.title[0]}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          {renaming ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input className="rinput" value={renameVal} onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenaming(false) }}
                autoFocus />
              <button className="icon-btn" onClick={doRename} style={{ color: 'var(--pvt-c)' }}>{renameSaving ? '...' : '✓'}</button>
              <button className="icon-btn" onClick={() => setRenaming(false)}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontWeight: 500, color: 'var(--t0)' }}>{dialog.title}</span>
              {dialog.type === 'group' && <button className="icon-btn" onClick={startRename} style={{ fontSize: 14 }} title="Переименовать">✏</button>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
            <span className="chip" style={{ background: accColor + '14', color: accColor }}>{dialog.account_label}</span>
            {typeChip}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <button className="dtoggle" onClick={toggleDetails}>⚙</button>
      </div>
    </div>

    <div className="messages">
      <div className="date-sep">Сегодня</div>
      {msgs?.map(m => {
        const isOut = m.direction === 'out'
        const mediaEl = m.has_files && m.media_url ? (() => {
          const tk = localStorage.getItem('token') || ''
          const url = `/api${m.media_url}?token=${tk}`
          const mt = m.media_type || 'document'
          if (mt === 'image') return <img src={url} alt="" style={{ maxWidth: 240, borderRadius: 8, marginTop: 4, cursor: 'pointer' }} onClick={() => window.open(url)} loading="lazy" />
          if (mt === 'voice' || mt === 'audio') return <audio controls preload="none" src={url} style={{ maxWidth: 240, marginTop: 4 }} />
          if (mt === 'video_note') return <VideoNote url={url} />
          if (mt === 'video') return <LazyVideo url={url} />
          if (m.text) return null
          return <a href={url} target="_blank" rel="noreferrer" className="msg-file"><span className="msg-file-icon">📎</span><span className="msg-file-name">Скачать файл</span></a>
        })() : null
        // Skip truly empty messages (no text, no media)
        if (!m.text && !m.has_files) return null
        return <div key={m.id} className={`mwrap ${isOut ? 'out' : 'in'}`}>
          {!isOut && m.from_name && <div className="msg-from">{m.from_name}</div>}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, flexDirection: isOut ? 'row-reverse' : 'row' }}>
            <div className="msg-actions">
              <button className="mact" title="В Избранное" onClick={(e) => {
                const btn = e.currentTarget; btn.style.opacity = '0.3'
                api.post('/saved', { message_id: m.id }).then(() => { btn.textContent = '✅'; setTimeout(() => { btn.textContent = '⭐'; btn.style.opacity = '' }, 1500) }).catch(() => { btn.style.opacity = '' })
              }}>⭐</button>
              <button className="mact" title="Переслать">↪</button>
              {isOut && <button className="mact" title="Удалить" onClick={() => deleteMsg(m.id)} style={{ color: '#ef4444' }}>🗑</button>}
            </div>
            <div className={`mbub ${isOut ? 'out' : 'in'}`}>
              {m.is_forwarded && m.forward_from_name && <div className="fwd-bar">Переслано от: {m.forward_from_name}</div>}
              {m.text && <span>{renderText(m.text)}</span>}
              {mediaEl}
            </div>
          </div>
          <div className="msg-foot" style={isOut ? { justifyContent: 'flex-end' } : undefined}>
            <span className="msg-time">{msgTime(m.sent_at)}</span>
            {isOut && m.rd === 'read' && <span className="chk read">✓✓</span>}
            {isOut && m.rd === 'sent' && <span className="chk sent">✓</span>}
          </div>
        </div>
      })}
      <div ref={endRef} />
    </div>

    {/* Emoji panel */}
    <div className={`slide-panel emoji-panel ${openPanel === 'emoji' ? 'open' : ''}`}>
      <div className="emoji-cats">
        {EMOJI_CATS.map((c, i) => <button key={i} className={`ecat-btn ${i === emojiCat ? 'active' : ''}`} onClick={() => setEmojiCat(i)}>{c.icon}</button>)}
      </div>
      <div className="emoji-grid">
        {EMOJI_CATS[emojiCat].emojis.map(e => <button key={e} className="emoji-btn" onClick={() => insertEmoji(e)}>{e}</button>)}
      </div>
    </div>

    {/* Template panel */}
    <div className={`slide-panel tmpl-panel ${openPanel === 'tmpl' ? 'open' : ''}`}>
      <div className="tmpl-search-wrap">
        <input className="tmpl-search" placeholder="Поиск шаблона…" value={tmplSearch} onChange={e => setTmplSearch(e.target.value)} />
        <button className="icon-btn" onClick={() => setOpenPanel(null)}>✕</button>
      </div>
      <div className="tmpl-list"><div className="tmpl-grid">
        {filteredTmpls.map(t => <div key={t.id} className="tmpl-card">
          <div className="tmpl-title">{t.title}</div>
          <div className="tmpl-preview">{t.text}</div>
          <div className="tmpl-actions">
            <button className="tmpl-btn" onClick={() => { setText(t.text); setOpenPanel(null); inputRef.current?.focus() }}>Вставить</button>
            <button className="tmpl-btn send" onClick={() => { send(t.text); setOpenPanel(null) }}>↑ Отправить</button>
          </div>
        </div>)}
        {filteredTmpls.length === 0 && <div style={{ padding: 16, color: 'var(--t2)', fontSize: 14, textAlign: 'center' }}>Нет шаблонов</div>}
      </div></div>
    </div>

    {/* Attachment preview */}
    {pendingFiles.length > 0 && <div className="attach-preview open">
      {pendingFiles.map(f => <div key={f.id} className="attach-thumb">
        <div className="attach-file"><span className="attach-file-icon">📎</span><span className="attach-file-name">{f.name}</span></div>
        <button className="attach-rm" onClick={() => setPendingFiles(pendingFiles.filter(x => x.id !== f.id))}>×</button>
      </div>)}
    </div>}

    {/* Input */}
    <div className="input-area">
      <button className={`inp-btn ${openPanel === 'emoji' ? 'active' : ''}`} onClick={() => setOpenPanel('emoji')}>☺</button>
      <button className={`inp-btn ${openPanel === 'tmpl' ? 'active' : ''}`} onClick={() => setOpenPanel('tmpl')}>⏰</button>
      <button className="inp-btn" onClick={() => fileRef.current?.click()}>📎</button>
      <input type="file" ref={fileRef} hidden multiple onChange={handleFileUpload} />
      <textarea ref={inputRef} className="msg-input" rows={1} placeholder={`Написать${dialog.type === 'group' ? ' в группу' : ''}…`}
        value={text} onChange={e => { setText(e.target.value); autoH(e.target) }} onKeyDown={onKey} />
      <button className="send-btn" onClick={() => send()} disabled={sending}>↑</button>
    </div>
  </div>
}

/* ── DETAILS PANEL ── */
function DetailsPanel() {
  const { selId, dialogs, folders, showDetails } = useStore()
  const dialog = dialogs.find(d => d.id === selId)
  const [commonGroups, setCommonGroups] = useState<{ id: number; title: string }[]>([])

  // Load common groups for private dialogs
  useEffect(() => {
    if (!dialog || dialog.type !== 'private' || !dialog.tg_chat_id) {
      setCommonGroups([])
      return
    }
    api.get(`/dialogs/${dialog.id}/common-groups`).then(r => {
      setCommonGroups(r.data.groups || [])
    }).catch(() => setCommonGroups([]))
  }, [dialog?.id, dialog?.type, dialog?.tg_chat_id])

  if (!showDetails || !dialog) return null

  return <div className="details-panel">
    <div className="slabel" style={{ marginBottom: 12 }}>Детали</div>
    <div style={{ marginBottom: 16 }}>
      <div className="slabel">Аккаунт</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: dialog.account_color, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t0)' }}>{dialog.account_label}</div>
          <div style={{ fontSize: 12, color: 'var(--t2)', fontFamily: 'monospace' }}>{dialog.account_status}</div>
        </div>
      </div>
    </div>

    <div style={{ marginBottom: 16 }}>
      <div className="slabel">Папки</div>
      {folders.map(f => {
        const checked = dialog.folders.some(df => df.id === f.id)
        return <label key={f.id} className="folder-check-row">
          <input type="checkbox" className="folder-check" checked={checked} onChange={() => {
            if (checked) api.delete(`/folders/${f.id}/dialogs/${dialog.id}`).catch(() => {})
            else api.post(`/folders/${f.id}/dialogs`, { dialog_id: dialog.id }).catch(() => {})
          }} />
          <span className="folder-dot" style={{ background: f.color }} />
          <span style={{ fontSize: 14, color: 'var(--t0)' }}>{f.name}</span>
        </label>
      })}
    </div>

    {dialog.type === 'private' && commonGroups.length > 0 && <div>
      <div className="slabel">Общие группы ({commonGroups.length})</div>
      {commonGroups.map(g => (
        <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', fontSize: 13, color: 'var(--t1)', cursor: 'pointer', borderRadius: 6 }}
          className="folder-check-row"
          onClick={async () => {
            // Fetch dialog detail first, add to store, then select
            try {
              const r = await api.get(`/dialogs/${g.id}`)
              const s = useStore.getState()
              const exists = s.dialogs.some(d => d.id === g.id)
              if (!exists) useStore.setState({ dialogs: [r.data, ...s.dialogs] })
              useStore.getState().setSelId(g.id)
              useStore.getState().setShowChat(true)
            } catch {}
          }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--grp-c)', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</span>
        </div>
      ))}
    </div>}
  </div>
}

/* ── WS ── */
function useWS() {
  const token = useStore(s => s.token)
  const updateRead = useStore(s => s.updateRead)
  useEffect(() => {
    if (!token) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws?token=${token}`)
    ws.onmessage = e => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'new_message') {
          useStore.getState().reloadDialogs()
          const curSel = useStore.getState().selId
          if (data.dialog_id && curSel && data.dialog_id === curSel) {
            api.get(`/messages/${curSel}`).then(r => {
              useStore.getState().setMessages(curSel, (r.data.items as MsgData[]).reverse())
            }).catch(() => {})
          }
        }
        if (data.type === 'read_outbox' && data.dialog_id) updateRead(data.dialog_id, data.max_read_id)
        if (data.type === 'dialog_read_crm') {
          useStore.getState().reloadDialogs()
        }
      } catch {}
    }
    return () => { ws.close() }
  }, [token, updateRead])
}

/* ── LAYOUT ── */
function Layout() {
  const showChat = useStore(s => s.showChat)
  const logout = useStore(s => s.logout)
  useWS()

  return <div id="app" className={showChat ? 'show-chat' : ''}>
    <Sidebar />
    <ChatPanel />
    <DetailsPanel />
    <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 50, display: 'flex', gap: 6 }}>
      <Link to="/admin" style={{ padding: '3px 8px', border: '1px solid var(--bd2)', borderRadius: 6, background: 'var(--bg1)', color: 'var(--t2)', fontSize: 12, textDecoration: 'none' }}>Админка</Link>
      <button onClick={logout} style={{ padding: '3px 8px', border: '1px solid var(--bd2)', borderRadius: 6, background: 'var(--bg1)', color: 'var(--t2)', cursor: 'pointer', fontSize: 12 }}>Выйти</button>
    </div>
  </div>
}

function Protected({ children }: { children: React.ReactNode }) {
  const token = useStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

/* ── ADMIN PAGE ── */

type AdminAccount = {
  id: number
  phone: string
  label: string | null
  status: string
  connected: boolean
  proxy_ip: string | null
  tunnel_port: number | null
  username?: string | null
  tg_id?: number | null
  last_dialog_at?: string | null
  live?: string
  can_send?: boolean
  freeze_reason?: string | null
}

type AdminProxy = {
  id: number
  ip_address: string
  socks_port: number
  tunnel_port: number | null
  label: string | null
  status: string
  note: string | null
  assigned_to: { id: number; phone: string; label: string | null }[]
}

function AdminPage() {
  const token = useStore(s => s.token)
  const [tab, setTab] = useState<'accounts' | 'proxies'>('accounts')
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [proxies, setProxies] = useState<AdminProxy[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.post('/admin/accounts/live-check')
      setAccounts(r.data.accounts)
    } catch (e: any) {
      setMsg(`Ошибка: ${e?.response?.data?.detail || e.message}`)
    } finally { setLoading(false) }
  }, [])

  const loadProxies = useCallback(async () => {
    try {
      const r = await api.get('/admin/proxies')
      setProxies(r.data.items)
    } catch {}
  }, [])

  useEffect(() => {
    if (!token) return
    loadAccounts()
    loadProxies()
  }, [token, loadAccounts, loadProxies])

  return <div style={{ padding: 24, minHeight: '100vh', background: 'var(--bg0)', color: 'var(--t1)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
      <Link to="/" style={{ color: 'var(--t2)', textDecoration: 'none' }}>← Диалоги</Link>
      <h1 style={{ margin: 0, fontSize: 24 }}>Админка</h1>
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
        <button onClick={() => setTab('accounts')}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--bd2)',
            background: tab === 'accounts' ? 'var(--acc)' : 'var(--bg1)',
            color: tab === 'accounts' ? '#fff' : 'var(--t1)', cursor: 'pointer' }}>
          Аккаунты ({accounts.length})
        </button>
        <button onClick={() => setTab('proxies')}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--bd2)',
            background: tab === 'proxies' ? 'var(--acc)' : 'var(--bg1)',
            color: tab === 'proxies' ? '#fff' : 'var(--t1)', cursor: 'pointer' }}>
          Прокси ({proxies.length})
        </button>
      </div>
    </div>
    {msg && <div style={{ padding: 10, background: '#7c2d12', borderRadius: 6, marginBottom: 16 }}>{msg}</div>}
    {tab === 'accounts'
      ? <AdminAccountsTab accounts={accounts} proxies={proxies}
          reload={loadAccounts} reloadProxies={loadProxies} loading={loading} setMsg={setMsg} />
      : <AdminProxiesTab proxies={proxies} reload={loadProxies} setMsg={setMsg} />
    }
  </div>
}

function AdminAccountsTab({ accounts, proxies, reload, reloadProxies, loading, setMsg }: {
  accounts: AdminAccount[]; proxies: AdminProxy[]; reload: () => void; reloadProxies: () => void;
  loading: boolean; setMsg: (m: string | null) => void;
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [checking, setChecking] = useState(false)

  const runLiveCheck = async () => {
    setChecking(true)
    try {
      const r = await api.post('/admin/accounts/live-check?test_send=true')
      reload()
      setMsg(`Live-check: ${r.data.ok}/${r.data.total} OK`)
    } catch (e: any) { setMsg(`Ошибка: ${e?.message}`) }
    finally { setChecking(false) }
  }

  const assignProxy = async (accId: number, proxyId: number | null) => {
    try {
      await api.patch(`/admin/accounts/${accId}/proxy`, { proxy_ip_id: proxyId })
      setMsg(`Прокси для #${accId} обновлён`)
      reload(); reloadProxies()
    } catch (e: any) { setMsg(`Ошибка: ${e?.response?.data?.detail || e.message}`) }
  }

  const freeProxies = proxies.filter(p => p.status === 'active' && p.assigned_to.length === 0)

  return <>
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <button onClick={() => setShowAdd(true)}
        style={{ padding: '8px 16px', background: 'var(--acc)', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}>
        + Добавить аккаунт
      </button>
      <button onClick={runLiveCheck} disabled={checking}
        style={{ padding: '8px 16px', background: 'var(--bg1)', color: 'var(--t1)', border: '1px solid var(--bd2)', borderRadius: 6, cursor: 'pointer' }}>
        {checking ? '...' : 'Live-check (test send)'}
      </button>
      <button onClick={reload}
        style={{ padding: '8px 16px', background: 'var(--bg1)', color: 'var(--t1)', border: '1px solid var(--bd2)', borderRadius: 6, cursor: 'pointer' }}>
        Обновить
      </button>
    </div>
    {loading && <div style={{ opacity: .6, marginBottom: 10 }}>Загрузка…</div>}
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: 'var(--bg1)', textAlign: 'left' }}>
          <th style={th}>#</th>
          <th style={th}>Phone</th>
          <th style={th}>Label / Username</th>
          <th style={th}>Status</th>
          <th style={th}>Conn</th>
          <th style={th}>Proxy IP (RU port)</th>
          <th style={th}>Live</th>
          <th style={th}>Last dialog</th>
          <th style={th}>Прокси</th>
        </tr>
      </thead>
      <tbody>
        {accounts.map(a => <tr key={a.id} style={{ borderTop: '1px solid var(--bd2)' }}>
          <td style={td}>{a.id}</td>
          <td style={td}>{a.phone}</td>
          <td style={td}>
            <div>{a.label}</div>
            {a.username && <div style={{ color: 'var(--t2)', fontSize: 11 }}>{a.username}</div>}
          </td>
          <td style={td}>
            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11,
              background: a.status === 'active' ? '#065f46' : a.status === 'frozen' ? '#7c2d12' : '#78350f' }}>
              {a.status}
            </span>
            {a.freeze_reason && <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 2 }}>{a.freeze_reason}</div>}
          </td>
          <td style={td}>{a.connected ? '✅' : '❌'}</td>
          <td style={td}>{a.proxy_ip ? `${a.proxy_ip} (:${a.tunnel_port})` : <span style={{ opacity: .5 }}>—</span>}</td>
          <td style={td}>
            {a.live === 'OK' ? '✅' : a.live === 'BANNED' ? '🚫 banned'
              : a.live === 'AUTH_KEY_DUPLICATED' ? '🔑 dup' : a.live || '—'}
            {a.can_send !== undefined && <span style={{ marginLeft: 4 }}>{a.can_send ? '✉️OK' : '❌'}</span>}
          </td>
          <td style={td}>{a.last_dialog_at?.slice(0, 10) || '—'}</td>
          <td style={td}>
            <select value={a.proxy_ip ? proxies.find(p => p.ip_address === a.proxy_ip)?.id || 0 : 0}
              onChange={e => assignProxy(a.id, e.target.value ? parseInt(e.target.value) : null)}
              style={{ background: 'var(--bg1)', color: 'var(--t1)', border: '1px solid var(--bd2)', borderRadius: 4, padding: 4, fontSize: 12 }}>
              <option value={0}>— нет —</option>
              {a.proxy_ip && <option value={proxies.find(p => p.ip_address === a.proxy_ip)?.id}>
                {a.proxy_ip} ({a.tunnel_port})
              </option>}
              {freeProxies.map(p => <option key={p.id} value={p.id}>{p.ip_address} (:{p.tunnel_port}) free</option>)}
            </select>
          </td>
        </tr>)}
      </tbody>
    </table>
    {showAdd && <AddAccountModal close={() => setShowAdd(false)}
      onDone={() => { setShowAdd(false); reload(); reloadProxies() }}
      freeProxies={freeProxies} />}
  </>
}

const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 600, fontSize: 12, color: 'var(--t2)' }
const td: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'top' }

function AddAccountModal({ close, onDone, freeProxies }: {
  close: () => void; onDone: () => void; freeProxies: AdminProxy[];
}) {
  const [step, setStep] = useState<'form' | 'code' | '2fa' | 'done'>('form')
  const [phone, setPhone] = useState('')
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [label, setLabel] = useState('')
  const [proxyId, setProxyId] = useState<number | null>(null)  // null = auto
  const [assignedProxy, setAssignedProxy] = useState<string | null>(null)
  const [phoneHash, setPhoneHash] = useState<string>('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const requestCode = async () => {
    setErr(null); setBusy(true)
    try {
      const r = await api.post('/accounts/authorize/request-code', {
        phone, api_id: parseInt(apiId), api_hash: apiHash,
        label: label || undefined,
        proxy_ip_id: proxyId,
      })
      setAssignedProxy(r.data.proxy_ip || null)
      setPhoneHash(r.data.phone_code_hash || '')
      setStep('code')
    } catch (e: any) { setErr(e?.response?.data?.detail || e.message) }
    finally { setBusy(false) }
  }

  const confirmCode = async () => {
    setErr(null); setBusy(true)
    try {
      const r = await api.post('/accounts/authorize/confirm-code', {
        phone, code, phone_code_hash: phoneHash,
      })
      if (r.data.status === 'need_2fa') setStep('2fa')
      else setStep('done')
    } catch (e: any) { setErr(e?.response?.data?.detail || e.message) }
    finally { setBusy(false) }
  }

  const confirm2fa = async () => {
    setErr(null); setBusy(true)
    try {
      await api.post('/accounts/authorize/confirm-2fa', { phone, password })
      setStep('done')
    } catch (e: any) { setErr(e?.response?.data?.detail || e.message) }
    finally { setBusy(false) }
  }

  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
    onClick={close}>
    <div style={{ background: 'var(--bg0)', padding: 24, borderRadius: 10, width: 420, border: '1px solid var(--bd2)' }}
      onClick={e => e.stopPropagation()}>
      <h3 style={{ margin: 0, marginBottom: 16 }}>Добавить аккаунт — шаг {step === 'form' ? '1' : step === 'code' ? '2' : step === '2fa' ? '3' : '✓'}</h3>
      {err && <div style={{ padding: 8, background: '#7c2d12', borderRadius: 6, marginBottom: 10, fontSize: 12 }}>{err}</div>}

      {step === 'form' && <>
        <Field label="Телефон (+79...)" value={phone} onChange={setPhone} placeholder="+19432233278" />
        <Field label="api_id" value={apiId} onChange={setApiId} placeholder="36670639" />
        <Field label="api_hash" value={apiHash} onChange={setApiHash} placeholder="51ddc3879649b6c074266927004784a9" />
        <Field label="Label (опц.)" value={label} onChange={setLabel} placeholder="tehspec007-P1-1" />
        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>Прокси (BY IP для авторизации)</div>
          <select value={proxyId === null ? '' : proxyId}
            onChange={e => setProxyId(e.target.value === '' ? null : parseInt(e.target.value))}
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--bd2)',
              borderRadius: 6, background: 'var(--bg1)', color: 'var(--t1)', boxSizing: 'border-box' }}>
            <option value="">Автоматически (первый свободный)</option>
            {freeProxies.map(p => <option key={p.id} value={p.id}>
              {p.ip_address} (RU:{p.tunnel_port}) — {p.label}
            </option>)}
          </select>
          {freeProxies.length === 0 && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
            Нет свободных прокси — удалите ненужные аккаунты
          </div>}
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={close} style={btnSecondary}>Отмена</button>
          <button onClick={requestCode} disabled={busy || !phone || !apiId || !apiHash} style={btnPrimary}>
            {busy ? '...' : 'Запросить код'}
          </button>
        </div>
      </>}

      {step === 'code' && <>
        {assignedProxy && <div style={{ fontSize: 12, padding: 8, background: 'var(--bg1)', borderRadius: 6, marginBottom: 10 }}>
          Логин через IP: <strong>{assignedProxy}</strong>
        </div>}
        <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 10 }}>
          Код отправлен в Telegram-приложение (на этот номер). Введи полученный код.
        </div>
        <Field label="SMS-код" value={code} onChange={setCode} placeholder="12345" />
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => setStep('form')} style={btnSecondary}>Назад</button>
          <button onClick={confirmCode} disabled={busy || !code} style={btnPrimary}>
            {busy ? '...' : 'Подтвердить код'}
          </button>
        </div>
      </>}

      {step === '2fa' && <>
        <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 10 }}>
          На аккаунте включён 2FA. Введи облачный пароль.
        </div>
        <Field label="2FA-пароль" value={password} onChange={setPassword} type="password" placeholder="tehspec007" />
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => setStep('form')} style={btnSecondary}>Назад</button>
          <button onClick={confirm2fa} disabled={busy || !password} style={btnPrimary}>
            {busy ? '...' : 'Войти'}
          </button>
        </div>
      </>}

      {step === 'done' && <>
        <div style={{ padding: 16, background: '#065f46', borderRadius: 6, marginBottom: 16 }}>
          Аккаунт успешно добавлен ✅
        </div>
        <button onClick={onDone} style={btnPrimary}>Готово</button>
      </>}
    </div>
  </div>
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return <label style={{ display: 'block', marginBottom: 10 }}>
    <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>{label}</div>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type}
      style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--bd2)',
        borderRadius: 6, background: 'var(--bg1)', color: 'var(--t1)', boxSizing: 'border-box' }} />
  </label>
}

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '10px 16px', background: 'var(--acc)', color: '#fff',
  border: 0, borderRadius: 6, cursor: 'pointer', fontSize: 13,
}
const btnSecondary: React.CSSProperties = {
  flex: 1, padding: '10px 16px', background: 'var(--bg1)', color: 'var(--t1)',
  border: '1px solid var(--bd2)', borderRadius: 6, cursor: 'pointer', fontSize: 13,
}

function AdminProxiesTab({ proxies }: {
  proxies: AdminProxy[]; reload: () => void; setMsg: (m: string | null) => void;
}) {
  return <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
    <thead>
      <tr style={{ background: 'var(--bg1)', textAlign: 'left' }}>
        <th style={th}>#</th>
        <th style={th}>IP</th>
        <th style={th}>RU port</th>
        <th style={th}>Label</th>
        <th style={th}>Status</th>
        <th style={th}>Привязан</th>
        <th style={th}>Note</th>
      </tr>
    </thead>
    <tbody>
      {proxies.map(p => <tr key={p.id} style={{ borderTop: '1px solid var(--bd2)' }}>
        <td style={td}>{p.id}</td>
        <td style={td}><code>{p.ip_address}</code></td>
        <td style={td}>{p.tunnel_port || '—'}</td>
        <td style={td}>{p.label || '—'}</td>
        <td style={td}>
          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11,
            background: p.status === 'active' ? '#065f46' : '#7c2d12' }}>{p.status}</span>
        </td>
        <td style={td}>{p.assigned_to.length
          ? p.assigned_to.map(a => <div key={a.id}>{a.phone} ({a.label})</div>)
          : <span style={{ opacity: .5 }}>свободен</span>}</td>
        <td style={td}><span style={{ fontSize: 11, color: 'var(--t2)' }}>{p.note || '—'}</span></td>
      </tr>)}
    </tbody>
  </table>
}

export default function App() {
  return <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<Protected><AdminPage /></Protected>} />
      <Route path="/*" element={<Protected><Layout /></Protected>} />
    </Routes>
  </BrowserRouter>
}
