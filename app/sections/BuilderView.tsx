'use client'

import { useState } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import parseLLMJson from '@/lib/jsonParser'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FiPlus, FiBarChart2, FiTrendingUp, FiHome, FiAlertCircle, FiGrid } from 'react-icons/fi'
import { Loader2 } from 'lucide-react'

interface BuilderViewProps {
  userId: string
  inventory: any[]
  buyerProfiles: any[]
  onInventoryChange: () => void
  setActiveAgentId: (id: string | null) => void
}

const DEMAND_AGENT_ID = '69ec6075744aec5380d4041f'

const emptyForm = { project_name: '', tower: '', unit_number: '', bhk: '', area_sqft: '', price: '', location: '', floor: '', amenities: '', status: 'available' }

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

export default function BuilderView({ userId, inventory, buyerProfiles, onInventoryChange, setActiveAgentId }: BuilderViewProps) {
  const [form, setForm] = useState(emptyForm)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [demandData, setDemandData] = useState<any>(null)

  const items = Array.isArray(inventory) ? inventory : []
  const profiles = Array.isArray(buyerProfiles) ? buyerProfiles : []

  const handleAddProperty = async () => {
    if (!form.project_name || !form.unit_number || !form.bhk || !form.area_sqft || !form.price || !form.location) {
      setAddError('Please fill all required fields')
      return
    }
    setAddLoading(true)
    setAddError('')
    setAddSuccess('')
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          bhk: Number(form.bhk),
          area_sqft: Number(form.area_sqft),
          price: Number(form.price),
          floor: form.floor ? Number(form.floor) : undefined,
          amenities: form.amenities ? form.amenities.split(',').map(s => s.trim()) : [],
        }),
      })
      const data = await res.json()
      if (data.success) {
        setAddSuccess('Property added successfully')
        setForm(emptyForm)
        await onInventoryChange()
        setTimeout(() => { setDialogOpen(false); setAddSuccess('') }, 1200)
      } else {
        setAddError(data.error ?? 'Failed to add property')
      }
    } catch (err: any) {
      setAddError(err?.message ?? 'Network error')
    } finally {
      setAddLoading(false)
    }
  }

  const handleAnalyzeDemand = async () => {
    setAnalyzing(true)
    setAnalysisError('')
    setActiveAgentId(DEMAND_AGENT_ID)
    try {
      const inventorySummary = items.map((u: any) => `${u?.project_name} Unit-${u?.unit_number} ${u?.bhk}BHK ${u?.area_sqft}sqft Rs.${u?.price} ${u?.location} Floor-${u?.floor} Status:${u?.status}`).join('\n')
      const profileSummary = profiles.map((p: any) => `Budget:${p?.budget_min ?? '?'}-${p?.budget_max ?? '?'}, Location:${p?.location_pref ?? '?'}, BHK:${p?.bhk ?? '?'}, Purpose:${p?.purpose ?? '?'}`).join('\n')

      const result = await callAIAgent(
        `Analyze demand patterns and inventory match.\n\nInventory (${items.length} units):\n${inventorySummary}\n\nBuyer Profiles (${profiles.length}):\n${profileSummary || 'No buyer profiles yet'}`,
        DEMAND_AGENT_ID,
        { user_id: userId }
      )

      if (result.success) {
        const d = result?.response?.result
        const trends = parseLLMJson(d?.demand_trends)
        const invMatch = parseLLMJson(d?.inventory_match)
        const actions = parseLLMJson(d?.action_items)
        setDemandData({
          demand_trends: Array.isArray(trends) ? trends : (trends && typeof trends === 'object' ? [trends] : []),
          inventory_match: Array.isArray(invMatch) ? invMatch : (invMatch && typeof invMatch === 'object' ? [invMatch] : []),
          insights_summary: d?.insights_summary ?? '',
          action_items: Array.isArray(actions) ? actions : (actions && typeof actions === 'object' ? [actions] : []),
        })
      } else {
        setAnalysisError(result?.error ?? 'Failed to analyze demand')
      }
    } catch (err: any) {
      setAnalysisError(err?.message ?? 'Network error')
    } finally {
      setAnalyzing(false)
      setActiveAgentId(null)
    }
  }

  const getDemandColor = (level: string) => {
    const l = (level ?? '').toLowerCase()
    if (l === 'high') return { bg: 'hsl(160 85% 35% / 0.15)', text: 'hsl(160 85% 35%)' }
    if (l === 'medium') return { bg: 'hsl(45 95% 50% / 0.15)', text: 'hsl(45 95% 40%)' }
    return { bg: 'hsl(0 84% 60% / 0.15)', text: 'hsl(0 84% 55%)' }
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Inventory Section */}
        <Card className="bg-white/75 backdrop-blur-md border border-white/18 shadow-md rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: 'hsl(160 35% 8%)' }}>
                <FiGrid className="w-4 h-4" /> Inventory ({items.length} units)
              </CardTitle>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl text-white text-sm" style={{ backgroundColor: 'hsl(160 85% 35%)' }}>
                    <FiPlus className="w-3 h-3 mr-1" /> Add Property
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white/95 backdrop-blur-md border border-white/18 rounded-xl max-w-lg">
                  <DialogHeader><DialogTitle style={{ color: 'hsl(160 35% 8%)' }}>Add New Property</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label className="text-xs">Project Name *</Label><Input value={form.project_name} onChange={e => setForm(prev => ({ ...prev, project_name: e.target.value }))} placeholder="e.g. Lodha Palava" className="rounded-lg mt-1" /></div>
                    <div><Label className="text-xs">Tower</Label><Input value={form.tower} onChange={e => setForm(prev => ({ ...prev, tower: e.target.value }))} placeholder="Tower A" className="rounded-lg mt-1" /></div>
                    <div><Label className="text-xs">Unit Number *</Label><Input value={form.unit_number} onChange={e => setForm(prev => ({ ...prev, unit_number: e.target.value }))} placeholder="101" className="rounded-lg mt-1" /></div>
                    <div><Label className="text-xs">BHK *</Label><Input type="number" value={form.bhk} onChange={e => setForm(prev => ({ ...prev, bhk: e.target.value }))} placeholder="2" className="rounded-lg mt-1" /></div>
                    <div><Label className="text-xs">Area (sqft) *</Label><Input type="number" value={form.area_sqft} onChange={e => setForm(prev => ({ ...prev, area_sqft: e.target.value }))} placeholder="1200" className="rounded-lg mt-1" /></div>
                    <div><Label className="text-xs">Price (Rs.) *</Label><Input type="number" value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} placeholder="12000000" className="rounded-lg mt-1" /></div>
                    <div><Label className="text-xs">Location *</Label><Input value={form.location} onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))} placeholder="Andheri West" className="rounded-lg mt-1" /></div>
                    <div><Label className="text-xs">Floor</Label><Input type="number" value={form.floor} onChange={e => setForm(prev => ({ ...prev, floor: e.target.value }))} placeholder="5" className="rounded-lg mt-1" /></div>
                    <div><Label className="text-xs">Status</Label>
                      <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v }))}>
                        <SelectTrigger className="rounded-lg mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="available">Available</SelectItem><SelectItem value="reserved">Reserved</SelectItem><SelectItem value="sold">Sold</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Label className="text-xs">Amenities (comma-separated)</Label><Input value={form.amenities} onChange={e => setForm(prev => ({ ...prev, amenities: e.target.value }))} placeholder="Pool, Gym, Garden" className="rounded-lg mt-1" /></div>
                  </div>
                  {addError && <p className="text-xs mt-2" style={{ color: 'hsl(0 84% 60%)' }}>{addError}</p>}
                  {addSuccess && <p className="text-xs mt-2" style={{ color: 'hsl(160 85% 35%)' }}>{addSuccess}</p>}
                  <Button onClick={handleAddProperty} disabled={addLoading} className="w-full rounded-xl text-white mt-2" style={{ backgroundColor: 'hsl(160 85% 35%)' }}>
                    {addLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Adding...</> : 'Add Property'}
                  </Button>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {items.length === 0 ? (
              <div className="text-center py-8"><FiHome className="w-8 h-8 mx-auto mb-2" style={{ color: 'hsl(160 25% 40%)' }} /><p className="text-sm" style={{ color: 'hsl(160 25% 40%)' }}>No inventory yet. Add properties to get started.</p></div>
            ) : (
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'hsl(160 28% 88%)' }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: 'hsl(160 30% 93%)' }}>
                      <TableHead className="text-xs font-semibold">Project</TableHead>
                      <TableHead className="text-xs font-semibold">Unit</TableHead>
                      <TableHead className="text-xs font-semibold">BHK</TableHead>
                      <TableHead className="text-xs font-semibold">Area</TableHead>
                      <TableHead className="text-xs font-semibold">Price</TableHead>
                      <TableHead className="text-xs font-semibold">Location</TableHead>
                      <TableHead className="text-xs font-semibold">Floor</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any, i: number) => (
                      <TableRow key={item?._id ?? i} className="hover:bg-white/50">
                        <TableCell className="text-xs font-medium">{item?.project_name ?? '-'}</TableCell>
                        <TableCell className="text-xs">{item?.tower ? `${item.tower}-` : ''}{item?.unit_number ?? '-'}</TableCell>
                        <TableCell className="text-xs">{item?.bhk ?? '-'}</TableCell>
                        <TableCell className="text-xs">{item?.area_sqft ? `${item.area_sqft} sqft` : '-'}</TableCell>
                        <TableCell className="text-xs">{item?.price ? `Rs. ${Number(item.price).toLocaleString('en-IN')}` : '-'}</TableCell>
                        <TableCell className="text-xs">{item?.location ?? '-'}</TableCell>
                        <TableCell className="text-xs">{item?.floor ?? '-'}</TableCell>
                        <TableCell><Badge className="text-xs capitalize" style={{ backgroundColor: item?.status === 'available' ? 'hsl(160 85% 35% / 0.15)' : item?.status === 'reserved' ? 'hsl(45 95% 50% / 0.15)' : 'hsl(0 84% 60% / 0.15)', color: item?.status === 'available' ? 'hsl(160 85% 35%)' : item?.status === 'reserved' ? 'hsl(45 95% 40%)' : 'hsl(0 84% 55%)' }}>{item?.status ?? 'available'}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Demand Analytics */}
        <Card className="bg-white/75 backdrop-blur-md border border-white/18 shadow-md rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: 'hsl(160 35% 8%)' }}>
                <FiBarChart2 className="w-4 h-4" /> Demand Analytics
              </CardTitle>
              <Button onClick={handleAnalyzeDemand} disabled={analyzing} className="rounded-xl text-white text-sm" style={{ backgroundColor: 'hsl(160 85% 35%)' }}>
                {analyzing ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Analyzing...</> : <><FiTrendingUp className="w-3 h-3 mr-1" /> Analyze Demand</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {analysisError && <div className="px-3 py-2 rounded-lg text-sm mb-3" style={{ backgroundColor: 'hsl(0 84% 60% / 0.1)', color: 'hsl(0 84% 60%)' }}><FiAlertCircle className="inline w-4 h-4 mr-1" />{analysisError}</div>}

            {!demandData && !analyzing && (
              <div className="text-center py-8">
                <FiBarChart2 className="w-8 h-8 mx-auto mb-2" style={{ color: 'hsl(160 25% 40%)' }} />
                <p className="text-sm" style={{ color: 'hsl(160 25% 40%)' }}>Click "Analyze Demand" to generate AI-powered insights from buyer preferences and your inventory data.</p>
              </div>
            )}

            {analyzing && (
              <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: 'hsl(160 85% 35%)' }} /><p className="text-sm" style={{ color: 'hsl(160 25% 40%)' }}>Crunching data across {profiles.length} buyer profiles and {items.length} inventory units...</p></div>
            )}

            {demandData && (
              <div className="space-y-4 mt-2">
                {/* Insights Summary */}
                {demandData.insights_summary && (
                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'hsl(160 85% 35% / 0.06)' }}>
                    <h4 className="text-sm font-semibold mb-2" style={{ color: 'hsl(160 35% 8%)' }}>Summary</h4>
                    {renderMarkdown(demandData.insights_summary)}
                  </div>
                )}

                {/* Demand Trends */}
                {Array.isArray(demandData.demand_trends) && demandData.demand_trends.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2" style={{ color: 'hsl(160 35% 8%)' }}>Demand Trends</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {demandData.demand_trends.map((trend: any, i: number) => (
                        <Card key={i} className="bg-white/60 backdrop-blur-sm border border-white/18 rounded-xl">
                          <CardContent className="p-3">
                            <p className="text-xs font-medium" style={{ color: 'hsl(160 25% 40%)' }}>{trend?.category ?? trend?.metric ?? trend?.label ?? `Trend ${i + 1}`}</p>
                            <p className="text-lg font-bold mt-1" style={{ color: 'hsl(160 35% 8%)' }}>{trend?.value ?? trend?.count ?? trend?.percentage ?? '-'}</p>
                            {trend?.description && <p className="text-xs mt-1" style={{ color: 'hsl(160 25% 40%)' }}>{trend.description}</p>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inventory Match */}
                {Array.isArray(demandData.inventory_match) && demandData.inventory_match.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2" style={{ color: 'hsl(160 35% 8%)' }}>Inventory Match</h4>
                    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'hsl(160 28% 88%)' }}>
                      <Table>
                        <TableHeader>
                          <TableRow style={{ backgroundColor: 'hsl(160 30% 93%)' }}>
                            <TableHead className="text-xs">Property</TableHead>
                            <TableHead className="text-xs">Details</TableHead>
                            <TableHead className="text-xs">Demand</TableHead>
                            <TableHead className="text-xs">Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {demandData.inventory_match.map((m: any, i: number) => {
                            const demandColors = getDemandColor(m?.demand_level ?? m?.demand ?? '')
                            return (
                              <TableRow key={i} className="hover:bg-white/50">
                                <TableCell className="text-xs font-medium">{m?.project_name ?? m?.property ?? m?.name ?? '-'}</TableCell>
                                <TableCell className="text-xs">{m?.unit_number ?? ''} {m?.bhk ? `${m.bhk}BHK` : ''} {m?.location ?? ''}</TableCell>
                                <TableCell><Badge className="text-xs" style={{ backgroundColor: demandColors.bg, color: demandColors.text }}>{m?.demand_level ?? m?.demand ?? 'N/A'}</Badge></TableCell>
                                <TableCell className="text-xs max-w-[200px] truncate">{m?.notes ?? m?.reason ?? m?.recommendation ?? '-'}</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Action Items */}
                {Array.isArray(demandData.action_items) && demandData.action_items.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2" style={{ color: 'hsl(160 35% 8%)' }}>Action Items</h4>
                    <div className="space-y-2">
                      {demandData.action_items.map((item: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: 'hsl(160 30% 93%)' }}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white" style={{ backgroundColor: 'hsl(160 85% 35%)' }}>{i + 1}</div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'hsl(160 35% 8%)' }}>{typeof item === 'string' ? item : (item?.title ?? item?.action ?? item?.description ?? JSON.stringify(item))}</p>
                            {typeof item === 'object' && item?.details && <p className="text-xs mt-1" style={{ color: 'hsl(160 25% 40%)' }}>{item.details}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  )
}
