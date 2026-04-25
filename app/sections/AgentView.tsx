'use client'

import { useState, useEffect } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import parseLLMJson from '@/lib/jsonParser'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { FiUsers, FiTarget, FiChevronRight, FiRefreshCw, FiCopy, FiCheck, FiAlertCircle } from 'react-icons/fi'
import { Loader2 } from 'lucide-react'
import { copyToClipboard } from '@/lib/clipboard'

interface AgentViewProps {
  userId: string
  inventory: any[]
  buyerProfiles: any[]
  leads: any[]
  onLeadSaved: () => void
  setActiveAgentId: (id: string | null) => void
}

const LEAD_AGENT_ID = '69ec6075603f5bad913c0e64'

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-2 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-2 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-3 mb-1">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{line.slice(2)}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{line}</p>
      })}
    </div>
  )
}

function formatBudget(val: number | undefined | null): string {
  if (!val) return '?'
  if (val >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`
  if (val >= 100000) return `${(val / 100000).toFixed(0)}L`
  return Number(val).toLocaleString('en-IN')
}

function getScoreStyle(score: string) {
  const s = (score ?? '').toLowerCase()
  if (s === 'hot') return 'bg-red-500/15 text-red-400 border-red-500/30'
  if (s === 'warm') return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
}

export default function AgentView({ userId, inventory, buyerProfiles, leads, onLeadSaved, setActiveAgentId }: AgentViewProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [leadData, setLeadData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copiedField, setCopiedField] = useState('')

  const allProfiles = Array.isArray(buyerProfiles) ? buyerProfiles : []
  const allLeads = Array.isArray(leads) ? leads : []

  const selectedProfile = allProfiles.find((p: any) => p?._id === selectedProfileId)
  const existingLead = allLeads.find((l: any) => l?.buyer_profile_id === selectedProfileId)
  const currentLead = leadData[selectedProfileId ?? ''] ?? existingLead

  const handleGenerateInsights = async (profileId: string) => {
    const profile = allProfiles.find((p: any) => p?._id === profileId)
    if (!profile) return
    setLoading(profileId)
    setError('')
    setActiveAgentId(LEAD_AGENT_ID)

    try {
      const profileSummary = `Buyer Profile: Name=${profile.buyer_name ?? 'Unknown'}, Budget=${profile.budget_min ?? 'N/A'}-${profile.budget_max ?? 'N/A'}, Location=${profile.location_pref ?? 'Any'}, BHK=${profile.bhk ?? 'Any'}, Purpose=${profile.purpose ?? 'N/A'}, Timeline=${profile.timeline ?? 'N/A'}, Amenities=${Array.isArray(profile.amenities) ? profile.amenities.join(',') : 'N/A'}`
      const inventorySummary = Array.isArray(inventory) && inventory.length > 0
        ? `\n\nAvailable Inventory:\n${inventory.map((u: any) => `${u?.project_name} Unit-${u?.unit_number} ${u?.bhk}BHK ${u?.area_sqft}sqft Rs.${u?.price} ${u?.location} Floor-${u?.floor} Amenities:${Array.isArray(u?.amenities) ? u.amenities.join(',') : 'N/A'} Status:${u?.status}`).join('\n')}`
        : ''

      const result = await callAIAgent(
        `Analyze this buyer lead and generate intelligence:\n\n${profileSummary}${inventorySummary}`,
        LEAD_AGENT_ID,
        { user_id: userId }
      )

      if (result.success) {
        const d = result?.response?.result
        const recUnits = parseLLMJson(d?.recommended_units)

        const leadInfo = {
          lead_score: d?.lead_score ?? 'Warm',
          score_reasoning: d?.score_reasoning ?? '',
          ai_summary: d?.ai_summary ?? '',
          recommended_units: Array.isArray(recUnits) ? recUnits : [],
          pitch_message: d?.pitch_message ?? '',
          next_action: d?.next_action ?? '',
        }

        setLeadData(prev => ({ ...prev, [profileId]: leadInfo }))

        try {
          await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              buyer_profile_id: profileId,
              buyer_name: profile.buyer_name ?? 'Buyer',
              ...leadInfo,
              recommended_units: JSON.stringify(leadInfo.recommended_units),
            }),
          })
          onLeadSaved()
        } catch {}
      } else {
        setError(result?.error ?? 'Failed to generate insights')
      }
    } catch (err: any) {
      setError(err?.message ?? 'Network error')
    } finally {
      setLoading(null)
      setActiveAgentId(null)
    }
  }

  const handleCopy = async (text: string, field: string) => {
    await copyToClipboard(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(''), 2000)
  }

  return (
    <div className="flex h-full gap-0">
      {/* Left Panel: Profiles/Leads list */}
      <div className="w-80 flex-shrink-0 bg-[#0A0A1B]/50 border-r border-white/8 flex flex-col">
        <div className="px-4 py-3 border-b border-white/8">
          <div className="text-sm font-semibold flex items-center gap-2 text-white">
            <FiUsers className="w-4 h-4" /> Buyer Profiles
            <Badge className="ml-auto bg-violet-600/20 text-violet-300 border border-violet-500/30 text-xs">{allProfiles.length}</Badge>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1.5">
            {allProfiles.length === 0 && (
              <div className="text-center py-8 px-4">
                <div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
                  <FiUsers className="w-6 h-6 text-violet-400" />
                </div>
                <p className="text-xs text-slate-500">No buyer profiles yet. Profiles will appear here after buyers chat and complete their preferences.</p>
              </div>
            )}
            {allProfiles.map((profile: any) => {
              const pLead = allLeads.find((l: any) => l?.buyer_profile_id === profile?._id) ?? leadData[profile?._id ?? '']
              const isActive = selectedProfileId === profile?._id
              return (
                <button key={profile?._id} onClick={() => setSelectedProfileId(profile?._id)} className={`w-full text-left px-3 py-3 rounded-xl transition-all ${isActive ? 'bg-violet-600/15 border border-violet-500/30 shadow-md' : 'border border-transparent hover:bg-white/5'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{profile?.buyer_name ?? 'Buyer'}</span>
                    {pLead && <Badge className={`text-xs border ${getScoreStyle(pLead.lead_score)}`}>{pLead?.lead_score}</Badge>}
                  </div>
                  <p className="text-xs mt-0.5 text-slate-400">
                    {profile?.bhk ? `${profile.bhk}BHK` : ''} {profile?.location_pref ?? ''} {profile?.budget_max ? `- ${formatBudget(profile.budget_max)}` : ''}
                  </p>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel: Lead Detail */}
      <div className="flex-1 bg-[#0D0D24]">
        {!selectedProfileId ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-violet-600/10 border border-violet-500/20">
              <FiTarget className="w-8 h-8 text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-white">Lead Intelligence</h3>
            <p className="text-sm max-w-md text-slate-400">Select a buyer profile from the left panel, then generate AI-powered lead insights including score, pitch message, and recommended actions.</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              {/* Profile Summary */}
              <div className="bg-white/5 backdrop-blur-md border border-white/8 shadow-md rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">{selectedProfile?.buyer_name ?? 'Buyer Profile'}</h3>
                  <Button onClick={() => handleGenerateInsights(selectedProfileId)} disabled={loading === selectedProfileId} className="rounded-xl text-white text-sm bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/20">
                    {loading === selectedProfileId ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Analyzing...</> : <><FiRefreshCw className="w-3 h-3 mr-1" /> Generate Insights</>}
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/8"><span className="text-slate-500">BHK</span><br /><span className="font-medium text-slate-200">{selectedProfile?.bhk ?? 'Any'}</span></div>
                  <div className="p-2 rounded-lg bg-white/5 border border-white/8"><span className="text-slate-500">Location</span><br /><span className="font-medium text-slate-200">{selectedProfile?.location_pref ?? 'Any'}</span></div>
                  <div className="p-2 rounded-lg bg-white/5 border border-white/8"><span className="text-slate-500">Budget</span><br /><span className="font-medium text-slate-200">{formatBudget(selectedProfile?.budget_min)} - {formatBudget(selectedProfile?.budget_max)}</span></div>
                  <div className="p-2 rounded-lg bg-white/5 border border-white/8"><span className="text-slate-500">Purpose</span><br /><span className="font-medium text-slate-200">{selectedProfile?.purpose ?? 'N/A'}</span></div>
                </div>
              </div>

              {error && <div className="px-4 py-3 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-400"><FiAlertCircle className="inline w-4 h-4 mr-1" />{error}</div>}

              {currentLead && (
                <>
                  {/* Score Card */}
                  <div className="bg-white/5 backdrop-blur-md border border-white/8 shadow-md rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge className={`text-lg px-4 py-1 border ${getScoreStyle(currentLead.lead_score)}`}>{currentLead.lead_score} Lead</Badge>
                    </div>
                    <p className="text-sm text-slate-400">{currentLead.score_reasoning}</p>
                  </div>

                  {/* AI Summary */}
                  {currentLead.ai_summary && (
                    <div className="bg-white/5 backdrop-blur-md border border-white/8 shadow-md rounded-xl">
                      <div className="px-4 pt-4 pb-2"><h4 className="text-sm font-semibold text-white">AI Summary</h4></div>
                      <div className="px-4 pb-4 text-slate-300">{renderMarkdown(currentLead.ai_summary)}</div>
                    </div>
                  )}

                  {/* Recommended Units */}
                  {Array.isArray(currentLead.recommended_units) && currentLead.recommended_units.length > 0 && (
                    <div className="bg-white/5 backdrop-blur-md border border-white/8 shadow-md rounded-xl">
                      <div className="px-4 pt-4 pb-2"><h4 className="text-sm font-semibold text-white">Recommended Units</h4></div>
                      <div className="px-4 pb-4">
                        <div className="space-y-2">
                          {currentLead.recommended_units.map((unit: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/8">
                              <div>
                                <span className="text-sm font-medium text-slate-200">{unit?.project_name ?? unit?.name ?? `Unit ${i + 1}`}</span>
                                <span className="text-xs ml-2 text-slate-400">{unit?.unit_number ?? ''} {unit?.bhk ? `${unit.bhk}BHK` : ''} {unit?.area_sqft ? `${unit.area_sqft}sqft` : ''}</span>
                              </div>
                              {unit?.price && <span className="text-sm font-medium text-slate-200">Rs. {Number(unit.price).toLocaleString('en-IN')}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pitch Message */}
                  {currentLead.pitch_message && (
                    <div className="bg-white/5 backdrop-blur-md border border-white/8 shadow-md rounded-xl">
                      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white">Pitch Message</h4>
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(currentLead.pitch_message, 'pitch')} className="h-7 px-2 text-xs text-slate-400 hover:text-white">
                          {copiedField === 'pitch' ? <><FiCheck className="w-3 h-3 mr-1" /> Copied</> : <><FiCopy className="w-3 h-3 mr-1" /> Copy</>}
                        </Button>
                      </div>
                      <div className="px-4 pb-4">
                        <div className="p-3 rounded-lg text-sm bg-violet-600/8 border border-violet-500/20 text-slate-200">{renderMarkdown(currentLead.pitch_message)}</div>
                      </div>
                    </div>
                  )}

                  {/* Next Action */}
                  {currentLead.next_action && (
                    <div className="bg-white/5 backdrop-blur-md border border-white/8 shadow-md rounded-xl p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                        <FiChevronRight className="w-4 h-4 text-violet-400" />
                      </div>
                      <div><p className="text-xs font-medium text-slate-500">Suggested Next Action</p><p className="text-sm mt-1 text-slate-200">{currentLead.next_action}</p></div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
