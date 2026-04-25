'use client'

import { useState, useRef, useEffect } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import parseLLMJson from '@/lib/jsonParser'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, MessageSquare, MapPin, Star, Loader2, Trash2 } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  recommendations?: any[]
}

interface BuyerViewProps {
  userId: string
  sessionId: string
  inventory: any[]
  onProfileSaved: () => void
  setActiveAgentId: (id: string | null) => void
}

const BUYER_AGENT_ID = '69ec6074f47b2b8f69099f76'

function renderMarkdown(text: string, isUser = false) {
  if (!text) return null
  const baseText = isUser ? 'text-white' : 'text-slate-200'
  const mutedText = isUser ? 'text-white/80' : 'text-slate-400'
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

const CHAT_STORAGE_KEY = 'estatepulse_chat_history'

export default function BuyerView({ userId, sessionId, inventory, onProfileSaved, setActiveAgentId }: BuyerViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages)) } catch {}
  }, [messages])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setError('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    setActiveAgentId(BUYER_AGENT_ID)

    try {
      const inventorySummary = Array.isArray(inventory) && inventory.length > 0
        ? `\n\nAvailable inventory:\n${inventory.map((u: any) => `${u?.project_name} - ${u?.bhk}BHK, ${u?.area_sqft}sqft, Rs.${u?.price}, ${u?.location}, Floor ${u?.floor}, Amenities: ${Array.isArray(u?.amenities) ? u.amenities.join(', ') : 'N/A'}, Status: ${u?.status}`).join('\n')}`
        : ''

      const result = await callAIAgent(
        userMsg + inventorySummary,
        BUYER_AGENT_ID,
        { user_id: userId, session_id: sessionId }
      )

      if (result.success) {
        const agentData = result?.response?.result ?? result?.response ?? {}
        // Try multiple field names the agent may use
        const responseText: string =
          agentData?.response ?? agentData?.message ?? agentData?.text ??
          agentData?.content ?? agentData?.answer ?? agentData?.summary ??
          result?.response?.message ?? ''

        const prefComplete = agentData?.preference_complete === true

        // Always attempt to extract recommendations from any JSON in the response
        let recommendations: any[] = []
        const textToCheck = responseText || JSON.stringify(agentData)

        const tryParse = (text: string) => {
          try { return JSON.parse(text) } catch {}
          return parseLLMJson(text)
        }

        const parsed = tryParse(textToCheck)
        if (Array.isArray(parsed)) {
          recommendations = parsed
        } else if (parsed && Array.isArray(parsed?.recommendations)) {
          recommendations = parsed.recommendations
        }
        if (recommendations.length === 0 && Array.isArray(agentData?.recommendations)) {
          recommendations = agentData.recommendations
        }

        // Normalize field names (why_this_fits → reason, etc.)
        recommendations = recommendations.map((r: any) => ({
          ...r,
          reason: r.reason ?? r.why_this_fits ?? r.why ?? '',
          match_score: r.match_score ?? r.score ?? r.match ?? undefined,
        }))

        const isJsonBlob = responseText.trim().startsWith('{') || responseText.trim().startsWith('[')
        const displayText = recommendations.length > 0 && isJsonBlob
          ? 'Here are my recommendations based on your preferences:'
          : (responseText.trim() || (Object.keys(agentData).length > 0
            ? 'I found some options for you!'
            : 'I received your message but got an empty response. Please try again.'))

        setMessages(prev => [...prev, { role: 'assistant', content: displayText, recommendations }])

        // Save buyer profile whenever we have recommendations or preference_complete flag
        if (prefComplete || recommendations.length > 0) {
          try {
            const firstRec = recommendations[0] ?? {}
            const profileData: any = {
              buyer_name: userId !== 'demo-user' ? userId : 'Buyer',
              purpose: agentData?.purpose ?? 'purchase',
            }
            if (firstRec.bhk) profileData.bhk = firstRec.bhk
            if (firstRec.location) profileData.location_pref = firstRec.location
            if (firstRec.price) { profileData.budget_min = 0; profileData.budget_max = firstRec.price }
            if (agentData?.budget_max) profileData.budget_max = agentData.budget_max
            if (agentData?.location_pref) profileData.location_pref = agentData.location_pref
            await fetch('/api/buyer-profiles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(profileData),
            })
            onProfileSaved()
          } catch {}
        }
      } else {
        const errMsg = result?.response?.message ?? result?.error ?? 'Agent returned an error. Please try again.'
        setError(errMsg)
      }
    } catch (err: any) {
      setError(err?.message ?? 'Network error — check your connection')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0D0D24]">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4 md:p-6" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center max-w-lg mx-auto">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600/30 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center mb-5">
                <MessageSquare className="w-9 h-9 text-violet-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">Find Your Dream Property</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Tell me about your ideal home — budget, preferred location, BHK type, amenities, and timeline. I'll recommend the best matching properties.
              </p>
              <div className="flex flex-wrap gap-2 mt-5 justify-center">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="px-3.5 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 bg-white/5 hover:bg-white/10 hover:text-slate-200 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 pb-4 max-w-3xl mx-auto">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%]`}>
                  <div className={`rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-900/30'
                      : 'bg-white/8 border border-white/10'
                  }`}>
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
        <div className="mx-4 mb-2 px-3 py-2 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      <div className="p-4 border-t border-white/8 bg-[#0A0A1B]/40">
        <div className="flex gap-2 max-w-3xl mx-auto items-center">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setMessages([]); try { localStorage.removeItem(CHAT_STORAGE_KEY) } catch {} }}
              className="rounded-xl h-10 px-3 text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
              title="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
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
  )
}
