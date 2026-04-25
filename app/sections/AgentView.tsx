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

  const getScoreColor = (score: string) => {
    const s = (score ?? '').toLowerCase()
    if (s === 'hot') return { bg: 'hsl(0 84% 60% / 0.15)', text: 'hsl(0 84% 60%)' }
    if (s === 'warm') return { bg: 'hsl(45 95% 50% / 0.15)', text: 'hsl(45 95% 40%)' }
    return { bg: 'hsl(200 70% 50% / 0.15)', text: 'hsl(200 70% 45%)' }
  }

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
    <div className="flex h-full gap-4 p-4">
      {/* Left Panel: Profiles/Leads list */}
      <Card className="w-80 flex-shrink-0 bg-white/75 backdrop-blur-md border border-white/18 shadow-md rounded-xl overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: 'hsl(160 35% 8%)' }}>
            <FiUsers className="w-4 h-4" /> Buyer Profiles ({allProfiles.length})
          </CardTitle>
        </CardHeader>
        <Separator style={{ backgroundColor: 'hsl(160 28% 88%)' }} />
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {allProfiles.length === 0 && (
              <div className="text-center py-8 px-4">
                <FiUsers className="w-8 h-8 mx-auto mb-2" style={{ color: 'hsl(160 25% 40%)' }} />
                <p className="text-xs" style={{ color: 'hsl(160 25% 40%)' }}>No buyer profiles yet. Profiles will appear here after buyers chat and complete their preferences.</p>
              </div>
            )}
            {allProfiles.map((profile: any) => {
              const pLead = allLeads.find((l: any) => l?.buyer_profile_id === profile?._id) ?? leadData[profile?._id ?? '']
              const scoreColors = pLead ? getScoreColor(pLead.lead_score) : null
              return (
                <button key={profile?._id} onClick={() => setSelectedProfileId(profile?._id)} className={`w-full text-left px-3 py-3 rounded-lg transition-all ${selectedProfileId === profile?._id ? 'shadow-md' : 'hover:shadow-sm'}`} style={{ backgroundColor: selectedProfileId === profile?._id ? 'hsl(160 85% 35% / 0.08)' : 'transparent', borderLeft: selectedProfileId === profile?._id ? '3px solid hsl(160 85% 35%)' : '3px solid transparent' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: 'hsl(160 35% 8%)' }}>{profile?.buyer_name ?? 'Buyer'}</span>
                    {scoreColors && <Badge className="text-xs" style={{ backgroundColor: scoreColors.bg, color: scoreColors.text }}>{pLead?.lead_score}</Badge>}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'hsl(160 25% 40%)' }}>
                    {profile?.bhk ? `${profile.bhk}BHK` : ''} {profile?.location_pref ?? ''} {profile?.budget_max ? `- Up to Rs.${Number(profile.budget_max).toLocaleString('en-IN')}` : ''}
                  </p>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </Card>

      {/* Right Panel: Lead Detail */}
      <div className="flex-1">
        {!selectedProfileId ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'hsl(160 85% 35% / 0.1)' }}>
              <FiTarget className="w-8 h-8" style={{ color: 'hsl(160 85% 35%)' }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'hsl(160 35% 8%)' }}>Lead Intelligence</h3>
            <p className="text-sm max-w-md" style={{ color: 'hsl(160 25% 40%)' }}>Select a buyer profile from the left panel, then generate AI-powered lead insights including score, pitch message, and recommended actions.</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-4">
              {/* Profile Summary */}
              <Card className="bg-white/75 backdrop-blur-md border border-white/18 shadow-md rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold" style={{ color: 'hsl(160 35% 8%)' }}>{selectedProfile?.buyer_name ?? 'Buyer Profile'}</h3>
                    <Button onClick={() => handleGenerateInsights(selectedProfileId)} disabled={loading === selectedProfileId} className="rounded-xl text-white text-sm" style={{ backgroundColor: 'hsl(160 85% 35%)' }}>
                      {loading === selectedProfileId ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Analyzing...</> : <><FiRefreshCw className="w-3 h-3 mr-1" /> Generate Insights</>}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: 'hsl(160 30% 93%)' }}><span style={{ color: 'hsl(160 25% 40%)' }}>BHK</span><br /><span className="font-medium">{selectedProfile?.bhk ?? 'Any'}</span></div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: 'hsl(160 30% 93%)' }}><span style={{ color: 'hsl(160 25% 40%)' }}>Location</span><br /><span className="font-medium">{selectedProfile?.location_pref ?? 'Any'}</span></div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: 'hsl(160 30% 93%)' }}><span style={{ color: 'hsl(160 25% 40%)' }}>Budget</span><br /><span className="font-medium">{selectedProfile?.budget_min ? `${Number(selectedProfile.budget_min).toLocaleString('en-IN')}` : '?'} - {selectedProfile?.budget_max ? `${Number(selectedProfile.budget_max).toLocaleString('en-IN')}` : '?'}</span></div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: 'hsl(160 30% 93%)' }}><span style={{ color: 'hsl(160 25% 40%)' }}>Purpose</span><br /><span className="font-medium">{selectedProfile?.purpose ?? 'N/A'}</span></div>
                  </div>
                </CardContent>
              </Card>

              {error && <div className="px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: 'hsl(0 84% 60% / 0.1)', color: 'hsl(0 84% 60%)' }}><FiAlertCircle className="inline w-4 h-4 mr-1" />{error}</div>}

              {currentLead && (
                <>
                  {/* Score Card */}
                  <Card className="bg-white/75 backdrop-blur-md border border-white/18 shadow-md rounded-xl">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Badge className="text-lg px-4 py-1" style={getScoreColor(currentLead.lead_score)}>{currentLead.lead_score} Lead</Badge>
                      </div>
                      <p className="text-sm" style={{ color: 'hsl(160 25% 40%)' }}>{currentLead.score_reasoning}</p>
                    </CardContent>
                  </Card>

                  {/* AI Summary */}
                  {currentLead.ai_summary && (
                    <Card className="bg-white/75 backdrop-blur-md border border-white/18 shadow-md rounded-xl">
                      <CardHeader className="pb-2"><CardTitle className="text-sm" style={{ color: 'hsl(160 35% 8%)' }}>AI Summary</CardTitle></CardHeader>
                      <CardContent className="pt-0 px-4 pb-4">{renderMarkdown(currentLead.ai_summary)}</CardContent>
                    </Card>
                  )}

                  {/* Recommended Units */}
                  {Array.isArray(currentLead.recommended_units) && currentLead.recommended_units.length > 0 && (
                    <Card className="bg-white/75 backdrop-blur-md border border-white/18 shadow-md rounded-xl">
                      <CardHeader className="pb-2"><CardTitle className="text-sm" style={{ color: 'hsl(160 35% 8%)' }}>Recommended Units</CardTitle></CardHeader>
                      <CardContent className="pt-0 px-4 pb-4">
                        <div className="space-y-2">
                          {currentLead.recommended_units.map((unit: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'hsl(160 30% 93%)' }}>
                              <div>
                                <span className="text-sm font-medium">{unit?.project_name ?? unit?.name ?? `Unit ${i + 1}`}</span>
                                <span className="text-xs ml-2" style={{ color: 'hsl(160 25% 40%)' }}>{unit?.unit_number ?? ''} {unit?.bhk ? `${unit.bhk}BHK` : ''} {unit?.area_sqft ? `${unit.area_sqft}sqft` : ''}</span>
                              </div>
                              {unit?.price && <span className="text-sm font-medium">Rs. {Number(unit.price).toLocaleString('en-IN')}</span>}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Pitch Message */}
                  {currentLead.pitch_message && (
                    <Card className="bg-white/75 backdrop-blur-md border border-white/18 shadow-md rounded-xl">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm" style={{ color: 'hsl(160 35% 8%)' }}>Pitch Message</CardTitle>
                          <Button variant="ghost" size="sm" onClick={() => handleCopy(currentLead.pitch_message, 'pitch')} className="h-7 px-2 text-xs">
                            {copiedField === 'pitch' ? <><FiCheck className="w-3 h-3 mr-1" /> Copied</> : <><FiCopy className="w-3 h-3 mr-1" /> Copy</>}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 px-4 pb-4">
                        <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'hsl(160 30% 93%)', color: 'hsl(160 35% 8%)' }}>{renderMarkdown(currentLead.pitch_message)}</div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Next Action */}
                  {currentLead.next_action && (
                    <Card className="bg-white/75 backdrop-blur-md border border-white/18 shadow-md rounded-xl">
                      <CardContent className="p-4 flex items-start gap-3">
                        <FiChevronRight className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'hsl(160 85% 35%)' }} />
                        <div><p className="text-xs font-medium" style={{ color: 'hsl(160 25% 40%)' }}>Suggested Next Action</p><p className="text-sm mt-1">{currentLead.next_action}</p></div>
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
