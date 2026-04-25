'use client'

import { useState } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import parseLLMJson from '@/lib/jsonParser'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Users, Target, ChevronRight, RefreshCw, Copy, Check, AlertCircle, Loader2, Trash2, Zap } from 'lucide-react'
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
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-2 mb-1 text-white">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-2 mb-1 text-white">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-3 mb-1 text-white">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm text-slate-300">{line.slice(2)}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm text-slate-300">{line}</p>
      })}
    </div>
  )
}

function scoreStyle(score: string) {
  const s = (score ?? '').toLowerCase()
  if (s === 'hot') return { badge: 'bg-red-500/20 text-red-400 border-red-500/30', dot: 'bg-red-400' }
  if (s === 'warm') return { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' }
  return { badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30', dot: 'bg-blue-400' }
}

export default function AgentView({ userId, inventory, buyerProfiles, leads, onLeadSaved, setActiveAgentId }: AgentViewProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [leadData, setLeadData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copiedField, setCopiedField] = useState('')

  const allProfiles = Array.isArray(buyerProfiles) ? buyerProfiles : []
  const allLeads = Array.isArray(leads) ? leads : []

  const selectedProfile = allProfiles.find((p: any) => p?._id === selectedProfileId)
  const existingLead = allLeads.find((l: any) => l?.buyer_profile_id === selectedProfileId)
  const currentLead = leadData[selectedProfileId ?? ''] ?? existingLead

  const generateInsightsForProfile = async (profileId: string): Promise<void> => {
    const profile = allProfiles.find((p: any) => p?._id === profileId)
    if (!profile) return

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
    }
  }

  const handleGenerateInsights = async (profileId: string) => {
    setLoading(profileId)
    setError('')
    setActiveAgentId(LEAD_AGENT_ID)
    try {
      await generateInsightsForProfile(profileId)
    } catch (err: any) {
      setError(err?.message ?? 'Network error')
    } finally {
      setLoading(null)
      setActiveAgentId(null)
    }
  }

  const handleGenerateAll = async () => {
    const profilesWithoutLeads = allProfiles.filter((p: any) => {
      const hasLead = allLeads.find((l: any) => l?.buyer_profile_id === p?._id) ?? leadData[p?._id ?? '']
      return !hasLead
    })
    if (profilesWithoutLeads.length === 0) return

    setBulkLoading(true)
    setError('')
    setActiveAgentId(LEAD_AGENT_ID)
    try {
      for (const profile of profilesWithoutLeads) {
        await generateInsightsForProfile(profile._id)
      }
    } catch (err: any) {
      setError(err?.message ?? 'Network error')
    } finally {
      setBulkLoading(false)
      setActiveAgentId(null)
    }
  }

  const handleDeleteProfile = async (id: string) => {
    if (!id || deletingId) return
    setDeletingId(id)
    try {
      await fetch(`/api/buyer-profiles?id=${id}`, { method: 'DELETE' })
      if (selectedProfileId === id) setSelectedProfileId(null)
      onLeadSaved()
    } catch {}
    setDeletingId(null)
  }

  const handleCopy = async (text: string, field: string) => {
    await copyToClipboard(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(''), 2000)
  }

  const profilesWithoutLeads = allProfiles.filter((p: any) => {
    const hasLead = allLeads.find((l: any) => l?.buyer_profile_id === p?._id) ?? leadData[p?._id ?? '']
    return !hasLead
  }).length

  return (
    <div className="flex h-full bg-[#0D0D24]">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 border-r border-white/8 flex flex-col bg-[#0A0A1B]/50">
        <div className="px-4 py-3 border-b border-white/8 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-400" />
              Buyer Profiles
              <Badge className="bg-white/8 text-slate-400 border-white/10 border text-xs">{allProfiles.length}</Badge>
            </h2>
          </div>
          {profilesWithoutLeads > 0 && (
            <Button
              size="sm"
              onClick={handleGenerateAll}
              disabled={bulkLoading}
              className="w-full rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs"
              variant="ghost"
            >
              {bulkLoading
                ? <><Loader2 className="w-3 h-3 animate-spin mr-1.5" /> Generating...</>
                : <><Zap className="w-3 h-3 mr-1.5" /> Generate All ({profilesWithoutLeads})</>}
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {allProfiles.length === 0 && (
              <div className="text-center py-8 px-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">No buyer profiles yet. They appear after buyers complete their preferences in chat.</p>
                <div className="p-2.5 rounded-xl bg-violet-600/10 border border-violet-500/20 text-left">
                  <p className="text-xs text-violet-300 font-medium mb-1">Quick tip</p>
                  <p className="text-xs text-slate-400 leading-relaxed">Enable <span className="text-violet-300 font-medium">Sample Data</span> toggle in the header to preview with demo profiles.</p>
                </div>
              </div>
            )}
            {allProfiles.map((profile: any) => {
              const pLead = allLeads.find((l: any) => l?.buyer_profile_id === profile?._id) ?? leadData[profile?._id ?? '']
              const style = pLead ? scoreStyle(pLead.lead_score) : null
              const isSelected = selectedProfileId === profile?._id
              return (
                <div
                  key={profile?._id}
                  className={`group relative rounded-xl transition-all ${
                    isSelected
                      ? 'bg-violet-600/15 border border-violet-500/30'
                      : 'border border-transparent hover:bg-white/5'
                  }`}
                >
                  <button
                    onClick={() => setSelectedProfileId(profile?._id)}
                    className="w-full text-left px-3 py-3 pr-8"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{profile?.buyer_name ?? 'Buyer'}</span>
                      {style && pLead ? (
                        <Badge className={`text-xs border ${style.badge}`}>{pLead?.lead_score}</Badge>
                      ) : (
                        <Badge className="text-xs border border-white/10 bg-white/5 text-slate-500">New</Badge>
                      )}
                    </div>
                    {(profile?.email || profile?.phone) && (
                      <p className="text-xs mt-0.5 text-violet-400/70">{profile?.email ?? profile?.phone}</p>
                    )}
                    <p className="text-xs mt-0.5 text-slate-500">
                      {profile?.bhk ? `${profile.bhk}BHK` : ''}{profile?.location_pref ? ` · ${profile.location_pref}` : ''}{profile?.budget_max ? ` · ₹${Number(profile.budget_max / 1000000).toFixed(1)}Cr` : ''}
                    </p>
                  </button>
                  {profile?._id && (
                    <button
                      onClick={() => handleDeleteProfile(profile._id)}
                      disabled={deletingId === profile._id}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10"
                    >
                      {deletingId === profile._id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel */}
      <div className="flex-1 overflow-hidden">
        {!selectedProfileId ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 rounded-3xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-5">
              <Target className="w-9 h-9 text-violet-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">Lead Intelligence</h3>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Select a buyer profile to generate AI-powered lead scores, personalised pitch messages, and recommended actions.
            </p>
            {allProfiles.length > 0 && profilesWithoutLeads > 0 && (
              <Button
                onClick={handleGenerateAll}
                disabled={bulkLoading}
                className="mt-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-900/30"
              >
                {bulkLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
                  : <><Zap className="w-4 h-4 mr-2" /> Generate All {profilesWithoutLeads} Leads</>}
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-5 space-y-4 max-w-3xl">
              {/* Profile Summary */}
              <Card className="bg-white/5 border border-white/10 rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white text-base">{selectedProfile?.buyer_name ?? 'Buyer Profile'}</h3>
                    <Button
                      onClick={() => handleGenerateInsights(selectedProfileId)}
                      disabled={!!loading}
                      className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm shadow-lg shadow-violet-900/30"
                      size="sm"
                    >
                      {loading === selectedProfileId
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Analyzing...</>
                        : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> {currentLead ? 'Refresh' : 'Generate'} Insights</>}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                    {[
                      { label: 'BHK', value: selectedProfile?.bhk ?? 'Any' },
                      { label: 'Location', value: selectedProfile?.location_pref ?? 'Any' },
                      { label: 'Budget', value: selectedProfile?.budget_min ? `₹${(selectedProfile.budget_min / 100000).toFixed(0)}L–₹${(selectedProfile.budget_max / 100000).toFixed(0)}L` : 'N/A' },
                      { label: 'Purpose', value: selectedProfile?.purpose ?? 'N/A' },
                    ].map(item => (
                      <div key={item.label} className="p-2.5 rounded-xl bg-white/5 border border-white/8">
                        <span className="text-slate-500 block">{item.label}</span>
                        <span className="font-medium text-slate-200 mt-0.5 block truncate">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  {selectedProfile?.timeline && (
                    <p className="text-xs text-slate-500 mt-2.5">Timeline: <span className="text-slate-300">{selectedProfile.timeline}</span></p>
                  )}
                </CardContent>
              </Card>

              {error && (
                <div className="px-4 py-3 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}

              {!currentLead && !loading && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Click "Generate Insights" to analyze this buyer with AI.
                </div>
              )}

              {currentLead && (
                <>
                  {/* Score Card */}
                  <Card className="bg-white/5 border border-white/10 rounded-2xl">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Badge className={`text-sm px-4 py-1 border font-semibold ${scoreStyle(currentLead.lead_score).badge}`}>
                          {currentLead.lead_score} Lead
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-400">{currentLead.score_reasoning}</p>
                    </CardContent>
                  </Card>

                  {currentLead.ai_summary && (
                    <Card className="bg-white/5 border border-white/10 rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-300">AI Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 px-4 pb-4">{renderMarkdown(currentLead.ai_summary)}</CardContent>
                    </Card>
                  )}

                  {Array.isArray(currentLead.recommended_units) && currentLead.recommended_units.length > 0 && (
                    <Card className="bg-white/5 border border-white/10 rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-300">Recommended Units</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 px-4 pb-4">
                        <div className="space-y-2">
                          {currentLead.recommended_units.map((unit: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/8">
                              <div>
                                <span className="text-sm font-medium text-white">{unit?.project_name ?? unit?.name ?? `Unit ${i + 1}`}</span>
                                <span className="text-xs ml-2 text-slate-500">
                                  {unit?.unit_number ?? ''}{unit?.bhk ? ` · ${unit.bhk}BHK` : ''}{unit?.area_sqft ? ` · ${unit.area_sqft}sqft` : ''}
                                </span>
                              </div>
                              {unit?.price && <span className="text-sm font-medium text-slate-300">₹{Number(unit.price).toLocaleString('en-IN')}</span>}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {currentLead.pitch_message && (
                    <Card className="bg-white/5 border border-white/10 rounded-2xl">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm text-slate-300">Pitch Message</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(currentLead.pitch_message, 'pitch')}
                            className="h-7 px-2 text-xs text-slate-400 hover:text-slate-200"
                          >
                            {copiedField === 'pitch'
                              ? <><Check className="w-3 h-3 mr-1 text-emerald-400" /> Copied</>
                              : <><Copy className="w-3 h-3 mr-1" /> Copy</>}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 px-4 pb-4">
                        <div className="p-3 rounded-xl bg-violet-600/8 border border-violet-500/20">
                          {renderMarkdown(currentLead.pitch_message)}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {currentLead.next_action && (
                    <Card className="bg-white/5 border border-white/10 rounded-2xl">
                      <CardContent className="p-4 flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                          <ChevronRight className="w-4 h-4 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1">Suggested Next Action</p>
                          <p className="text-sm text-slate-300">{currentLead.next_action}</p>
                        </div>
                      </CardContent>
                    </Card>
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
