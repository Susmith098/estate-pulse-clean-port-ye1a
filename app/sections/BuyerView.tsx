'use client'

import { useState, useRef, useEffect } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import parseLLMJson from '@/lib/jsonParser'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, MessageSquare, MapPin, Star, Loader2, SquarePen, Trash2, Clock } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  recommendations?: any[]
}

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  profileId: string | null
  createdAt: number
}

interface BuyerViewProps {
  userId: string
  sessionId: string
  inventory: any[]
  onProfileSaved: () => void
  setActiveAgentId: (id: string | null) => void
}

const BUYER_AGENT_ID = '69ec6074f47b2b8f69099f76'
const SESSIONS_KEY = 'estatepulse_sessions'
const ACTIVE_SESSION_KEY = 'estatepulse_active_session'

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

function newSession(): ChatSession {
  return { id: genId(), title: 'New Chat', messages: [], profileId: null, createdAt: Date.now() }
}

function loadSessions(): ChatSession[] {
  try { const s = localStorage.getItem(SESSIONS_KEY); return s ? JSON.parse(s) : [] } catch { return [] }
}

function saveSessions(sessions: ChatSession[]) {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)) } catch {}
}

function renderMarkdown(text: string, isUser = false) {
  if (!text) return null
  const baseText = isUser ? 'text-white' : 'text-slate-200'
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className={`font-semibold text-sm mt-2 mb-1 ${baseText}`}>{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className={`font-semibold text-base mt-2 mb-1 ${baseText}`}>{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className={`font-bold text-lg mt-3 mb-1 ${baseText}`}>{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className={`ml-4 list-disc text-sm ${baseText}`}>{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className={`ml-4 list-decimal text-sm ${baseText}`}>{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className={`text-sm ${baseText}`}>{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part)
}

const SUGGESTIONS = [
  'Looking for a 2BHK in Andheri under 1.5Cr',
  'Show me 3BHK apartments in Pune with pool',
  'I need a family home near schools',
]

export default function BuyerView({ userId, sessionId, inventory, onProfileSaved, setActiveAgentId }: BuyerViewProps) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const s = loadSessions()
    return s.length > 0 ? s : [newSession()]
  })
  const [activeId, setActiveId] = useState<string>(() => {
    try { return localStorage.getItem(ACTIVE_SESSION_KEY) ?? '' } catch { return '' }
  })
  const [authUser, setAuthUser] = useState<{ name?: string; email?: string } | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeSession = sessions.find(s => s.id === activeId) ?? sessions[0]
  const messages = activeSession?.messages ?? []

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) setAuthUser({ name: d.user.name, email: d.user.email })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const updateSession = (id: string, updater: (s: ChatSession) => ChatSession) => {
    setSessions(prev => {
      const next = prev.map(s => s.id === id ? updater(s) : s)
      saveSessions(next)
      return next
    })
  }

  const handleNewChat = () => {
    const s = newSession()
    setSessions(prev => {
      const next = [s, ...prev]
      saveSessions(next)
      return next
    })
    setActiveId(s.id)
    try { localStorage.setItem(ACTIVE_SESSION_KEY, s.id) } catch {}
    setInput('')
    setError('')
  }

  const handleSelectSession = (id: string) => {
    setActiveId(id)
    try { localStorage.setItem(ACTIVE_SESSION_KEY, id) } catch {}
    setError('')
  }

  const handleDeleteSession = (id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      const final = next.length > 0 ? next : [newSession()]
      saveSessions(final)
      if (activeId === id) {
        setActiveId(final[0].id)
        try { localStorage.setItem(ACTIVE_SESSION_KEY, final[0].id) } catch {}
      }
      return final
    })
  }

  const handleSend = async () => {
    if (!input.trim() || loading || !activeSession) return
    const userMsg = input.trim()
    setInput('')
    setError('')

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMsg }]
    const title = messages.length === 0 ? userMsg.slice(0, 40) : activeSession.title
    updateSession(activeSession.id, s => ({ ...s, messages: newMessages, title }))

    setLoading(true)
    setActiveAgentId(BUYER_AGENT_ID)

    try {
      const userMessageCount = messages.filter(m => m.role === 'user').length
      let profileId = activeSession.profileId

      // Create profile on first message of this session
      if (userMessageCount === 0) {
        try {
          const res = await fetch('/api/buyer-profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              buyer_name: authUser?.name ?? (userId !== 'demo-user' ? userId : 'Buyer'),
              email: authUser?.email ?? '',
              purpose: 'purchase',
              initial_query: userMsg,
            }),
          })
          const data = await res.json()
          if (data.success && data.data?._id) {
            profileId = data.data._id
            updateSession(activeSession.id, s => ({ ...s, profileId }))
          }
          onProfileSaved()
        } catch {}
      }

      const inventorySummary = userMessageCount >= 2 && Array.isArray(inventory) && inventory.length > 0
        ? `\n\nAvailable inventory:\n${inventory.map((u: any) => `${u?.project_name} - ${u?.bhk}BHK, ${u?.area_sqft}sqft, Rs.${u?.price}, ${u?.location}, Floor ${u?.floor}, Amenities: ${Array.isArray(u?.amenities) ? u.amenities.join(', ') : 'N/A'}, Status: ${u?.status}`).join('\n')}`
        : ''

      const result = await callAIAgent(userMsg + inventorySummary, BUYER_AGENT_ID, { user_id: userId, session_id: activeSession.id })

      if (result.success) {
        const agentData = result?.response?.result ?? result?.response ?? {}
        const responseText: string =
          agentData?.response ?? agentData?.message ?? agentData?.text ??
          agentData?.content ?? agentData?.answer ?? agentData?.summary ??
          result?.response?.message ?? ''

        const prefComplete = agentData?.preference_complete === true
        let recommendations: any[] = []
        const tryParse = (text: string) => { try { return JSON.parse(text) } catch {} return parseLLMJson(text) }
        const parsed = tryParse(responseText || JSON.stringify(agentData))
        if (Array.isArray(parsed)) recommendations = parsed
        else if (parsed && Array.isArray(parsed?.recommendations)) recommendations = parsed.recommendations
        if (recommendations.length === 0 && Array.isArray(agentData?.recommendations)) recommendations = agentData.recommendations

        recommendations = recommendations.map((r: any) => ({
          ...r,
          reason: r.reason ?? r.why_this_fits ?? r.why ?? '',
          match_score: r.match_score ?? r.score ?? r.match ?? undefined,
        }))

        const isJsonBlob = responseText.trim().startsWith('{') || responseText.trim().startsWith('[')
        const displayText = recommendations.length > 0 && isJsonBlob
          ? 'Here are my recommendations based on your preferences:'
          : (responseText.trim() || 'I received your message but got an empty response. Please try again.')

        const assistantMsg: ChatMessage = { role: 'assistant', content: displayText, recommendations }
        updateSession(activeSession.id, s => ({ ...s, messages: [...s.messages, assistantMsg] }))

        if (profileId && (prefComplete || recommendations.length > 0 || agentData?.bhk || agentData?.location_pref || agentData?.budget_max)) {
          try {
            const firstRec = recommendations[0] ?? {}
            const updates: any = { id: profileId }
            if (agentData?.purpose) updates.purpose = agentData.purpose
            if (agentData?.bhk ?? firstRec.bhk) updates.bhk = agentData?.bhk ?? firstRec.bhk
            if (agentData?.location_pref ?? firstRec.location) updates.location_pref = agentData?.location_pref ?? firstRec.location
            if (agentData?.budget_max) updates.budget_max = agentData.budget_max
            if (agentData?.budget_min) updates.budget_min = agentData.budget_min
            if (agentData?.timeline) updates.timeline = agentData.timeline
            if (Array.isArray(agentData?.amenities) && agentData.amenities.length > 0) updates.amenities = agentData.amenities
            if (firstRec.price && !updates.budget_max) { updates.budget_min = 0; updates.budget_max = firstRec.price }
            if (Object.keys(updates).length > 1) {
              await fetch('/api/buyer-profiles', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
              onProfileSaved()
            }
          } catch {}
        }
      } else {
        setError(result?.response?.message ?? result?.error ?? 'Agent returned an error.')
      }
    } catch (err: any) {
      setError(err?.message ?? 'Network error')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }

  return (
    <div className="flex h-full bg-[#0D0D24]">
      {/* Sidebar */}
      <div className="w-60 flex-shrink-0 border-r border-white/8 flex flex-col bg-[#0A0A1B]/60">
        <div className="p-3 border-b border-white/8">
          <Button
            onClick={handleNewChat}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs shadow-lg shadow-violet-900/30"
            size="sm"
          >
            <SquarePen className="w-3.5 h-3.5 mr-1.5" /> New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.map(s => (
              <div
                key={s.id}
                className={`group relative rounded-xl transition-all cursor-pointer ${
                  s.id === activeSession?.id
                    ? 'bg-violet-600/15 border border-violet-500/30'
                    : 'border border-transparent hover:bg-white/5'
                }`}
                onClick={() => handleSelectSession(s.id)}
              >
                <div className="px-3 py-2.5 pr-8">
                  <p className="text-xs font-medium text-slate-200 truncate leading-relaxed">{s.title}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-slate-600" />
                    <span className="text-xs text-slate-600">{new Date(s.createdAt).toLocaleDateString()}</span>
                    {s.messages.length > 0 && <span className="text-xs text-slate-600">· {s.messages.filter(m => m.role === 'user').length} msg</span>}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteSession(s.id) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-4 md:p-6" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center max-w-lg mx-auto">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600/30 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center mb-5">
                  <MessageSquare className="w-9 h-9 text-violet-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Find Your Dream Property</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Tell me about your ideal home — budget, preferred location, BHK type, amenities, and timeline.
                </p>
                <div className="flex flex-wrap gap-2 mt-5 justify-center">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => setInput(s)} className="px-3.5 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 bg-white/5 hover:bg-white/10 hover:text-slate-200 transition-all">{s}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-4 pb-4 max-w-3xl mx-auto">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[82%]">
                    <div className={`rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-900/30' : 'bg-white/8 border border-white/10'}`}>
                      {renderMarkdown(msg.content, msg.role === 'user')}
                    </div>
                    {Array.isArray(msg.recommendations) && msg.recommendations.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {msg.recommendations.map((rec: any, ri: number) => (
                          <Card key={ri} className="bg-white/6 border border-white/10 rounded-2xl overflow-hidden hover:border-violet-500/30 transition-colors">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h4 className="font-semibold text-sm text-white">{rec?.project_name ?? rec?.name ?? 'Property'}</h4>
                                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3" />{rec?.location ?? ''} {rec?.unit_number ? `· Unit ${rec.unit_number}` : ''}
                                  </p>
                                </div>
                                {(rec?.match_score ?? rec?.score) && (
                                  <Badge className="bg-violet-600/20 text-violet-300 border-violet-500/30 text-xs border">
                                    <Star className="w-3 h-3 mr-1" />{rec?.match_score ?? rec?.score}% Match
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                                {rec?.bhk && <div className="px-2 py-1.5 rounded-lg text-center bg-white/6 text-slate-300">{rec.bhk} BHK</div>}
                                {rec?.area_sqft && <div className="px-2 py-1.5 rounded-lg text-center bg-white/6 text-slate-300">{rec.area_sqft} sqft</div>}
                                {rec?.price && <div className="px-2 py-1.5 rounded-lg text-center bg-white/6 text-slate-300">Rs. {Number(rec.price).toLocaleString('en-IN')}</div>}
                              </div>
                              {rec?.reason && <p className="text-xs mt-2 text-slate-400">{rec.reason}</p>}
                              {rec?.trade_offs && <p className="text-xs mt-1 italic text-slate-500">Trade-offs: {rec.trade_offs}</p>}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-4 py-3 bg-white/8 border border-white/10 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                    <span className="text-sm text-slate-400">Finding the best options...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {error && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-400">{error}</div>
        )}

        <div className="p-4 border-t border-white/8 bg-[#0A0A1B]/40">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Describe your ideal property..."
              className="flex-1 rounded-xl border-white/10 bg-[#1a1a35] text-slate-100 placeholder:text-slate-500 focus:border-violet-500/50 focus:ring-violet-500/20"
              disabled={loading}
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 shadow-lg shadow-violet-900/30 disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
