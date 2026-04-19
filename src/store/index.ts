import { create } from 'zustand'
import api from '../api/client'

export interface DialogData {
  id: number; account_id: number; tg_chat_id: number; title: string; type: string
  assigned_to: number | null; last_msg_text: string | null; last_msg_at: string | null
  unread_count: number; folders: { id: number; name: string; color: string }[]
  account_label: string; account_color: string; account_status: string
}
export interface MsgData {
  id: number; tg_msg_id: number | null; from_name: string | null; text: string | null
  direction: 'in' | 'out'; sent_at: string; operator_id: number | null
  is_read: boolean; is_forwarded: boolean; forward_from_name: string | null
  has_files: boolean; rd: 'read' | 'sent' | null
  media_type: string | null; media_url: string | null
}
export interface FolderData { id: number; name: string; color: string; created_by: number }
export interface TemplateData { id: number; title: string; text: string; is_shared: boolean; created_by: number }
export interface AccountData {
  id: number; phone: string; label: string; color: string; is_active: boolean
  status: string; connected: boolean; counters: Record<string, { current: number; limit: number }>
}

type Panel = 'emoji' | 'tmpl' | null

interface Store {
  token: string | null; operatorId: number | null; operatorName: string
  setAuth: (t: string, id: number, name: string) => void
  logout: () => void

  dialogs: DialogData[]; setDialogs: (d: DialogData[]) => void
  selId: number | null; setSelId: (id: number | null) => void
  messages: Record<number, MsgData[]>; setMessages: (id: number, m: MsgData[]) => void
  appendMsg: (id: number, m: MsgData) => void
  updateRead: (dialogId: number, maxId: number) => void

  folders: FolderData[]; setFolders: (f: FolderData[]) => void
  templates: TemplateData[]; setTemplates: (t: TemplateData[]) => void
  accounts: AccountData[]; setAccounts: (a: AccountData[]) => void

  tab: string; setTab: (t: string) => void
  search: string; setSearch: (s: string) => void
  reloadDialogs: () => void
  accFilter: number[]; toggleAccFilter: (id: number) => void
  openPanel: Panel; setOpenPanel: (p: Panel) => void
  showChat: boolean; setShowChat: (v: boolean) => void
  showDetails: boolean; toggleDetails: () => void

  theme: string; toggleTheme: () => void
}

const savedTheme = (() => { try { return localStorage.getItem('crm-theme') || (window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light') } catch { return 'light' } })()
document.documentElement.dataset.theme = savedTheme

export const useStore = create<Store>((set) => ({
  token: localStorage.getItem('token'), operatorId: null, operatorName: '',
  setAuth: (t, id, name) => { localStorage.setItem('token', t); set({ token: t, operatorId: id, operatorName: name }) },
  logout: () => { localStorage.removeItem('token'); set({ token: null, operatorId: null, operatorName: '' }) },

  dialogs: [], setDialogs: (d) => set({ dialogs: d }),
  selId: null, setSelId: (id) => set({ selId: id }),
  messages: {}, setMessages: (id, m) => set((s) => ({ messages: { ...s.messages, [id]: m } })),
  appendMsg: (id, m) => set((s) => {
    const ex = s.messages[id] || []
    if (ex.some((x) => x.id === m.id)) return s
    return { messages: { ...s.messages, [id]: [...ex, m] } }
  }),
  updateRead: (dialogId, maxId) => set((s) => {
    const msgs = s.messages[dialogId]
    if (!msgs) return s
    return { messages: { ...s.messages, [dialogId]: msgs.map((m) =>
      m.direction === 'out' && m.tg_msg_id && m.tg_msg_id <= maxId ? { ...m, is_read: true, rd: 'read' as const } : m
    )}}
  }),

  folders: [], setFolders: (f) => set({ folders: f }),
  templates: [], setTemplates: (t) => set({ templates: t }),
  accounts: [], setAccounts: (a) => set({ accounts: a }),

  tab: 'private', setTab: (t) => set({ tab: t }),
  search: '', setSearch: (s) => set({ search: s }),
  reloadDialogs: () => {
    const { search, dialogs: current } = useStore.getState()
    const params: Record<string, string> = { limit: '500' }
    if (search) params.search = search
    api.get('/dialogs', { params }).then(r => {
      const fresh = r.data.items as DialogData[]
      // Merge: keep manually-added dialogs (e.g. from common-groups click) that aren't in fresh
      const freshIds = new Set(fresh.map((d: DialogData) => d.id))
      const kept = current.filter(d => !freshIds.has(d.id))
      set({ dialogs: [...fresh, ...kept] })
    }).catch(() => {})
  },
  accFilter: [], toggleAccFilter: (id) => set((s) => ({
    accFilter: s.accFilter.includes(id) ? s.accFilter.filter((a) => a !== id) : [...s.accFilter, id]
  })),
  openPanel: null, setOpenPanel: (p) => set((s) => ({ openPanel: s.openPanel === p ? null : p })),
  showChat: false, setShowChat: (v) => set({ showChat: v }),
  showDetails: true, toggleDetails: () => set((s) => ({ showDetails: !s.showDetails })),

  theme: savedTheme,
  toggleTheme: () => set((s) => {
    const n = s.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = n
    try { localStorage.setItem('crm-theme', n) } catch {}
    return { theme: n }
  }),
}))
