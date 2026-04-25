'use client'

import { useState, useEffect } from 'react'
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
import { FiPlus, FiBarChart2, FiTrendingUp, FiHome, FiAlertCircle, FiGrid, FiChevronLeft, FiChevronRight, FiUsers, FiSearch } from 'react-icons/fi'
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

function statusStyle(status: string) {
  const s = (status ?? '').toLowerCase()
  if (s === 'available') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  if (s === 'reserved') return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  return 'bg-red-500/15 text-red-400 border-red-500/30'
}

function getDemandStyle(level: string) {
  const l = (level ?? '').toLowerCase()
  if (l === 'high') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  if (l === 'medium') return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  return 'bg-red-500/15 text-red-400 border-red-500/30'
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
  const [matchPage, setMatchPage] = useState(1)
  const matchPageSize = 10

  const [searchQuery, setSearchQuery] = useState('')

  const items = Array.isArray(inventory) ? inventory : []
  const profiles = Array.isArray(buyerProfiles) ? buyerProfiles : []
  const availableCount = items.filter((i: any) => i?.status === 'available').length

  // Filter items by search query
  const filteredItems = searchQuery.trim()
    ? items.filter((item: any) => {
        const q = searchQuery.toLowerCase()
        return (
          (item?.project_name ?? '').toLowerCase().includes(q) ||
          (item?.location ?? '').toLowerCase().includes(q) ||
          (item?.unit_number ?? '').toLowerCase().includes(q) ||
          (item?.tower ?? '').toLowerCase().includes(q) ||
          (item?.status ?? '').toLowerCase().includes(q) ||
          String(item?.bhk ?? '').includes(q)
        )
      })
    : items

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Reset page when inventory or search changes
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(1) }, [filteredItems.length, totalPages, currentPage])
  useEffect(() => { setCurrentPage(1) }, [searchQuery])

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

  const matchItems = Array.isArray(demandData?.inventory_match) ? demandData.inventory_match : []
  const matchTotalPages = Math.max(1, Math.ceil(matchItems.length / matchPageSize))
  const paginatedMatch = matchItems.slice((matchPage - 1) * matchPageSize, matchPage * matchPageSize)

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4 bg-[#0D0D24] min-h-full">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/8 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <FiHome className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-slate-500 font-medium">Total Units</span>
            </div>
            <p className="text-2xl font-bold text-white">{items.length}</p>
          </div>
          <div className="bg-white/5 border border-white/8 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <FiGrid className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-500 font-medium">Available</span>
            </div>
            <p className="text-2xl font-bold text-white">{availableCount}</p>
          </div>
          <div className="bg-white/5 border border-white/8 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <FiUsers className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-slate-500 font-medium">Buyer Profiles</span>
            </div>
            <p className="text-2xl font-bold text-white">{profiles.length}</p>
          </div>
        </div>

        {/* Inventory Section */}
        <div className="bg-white/5 backdrop-blur-md border border-white/8 shadow-md rounded-xl">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold flex items-center gap-2 text-white">
                <FiGrid className="w-4 h-4" /> Inventory
                <Badge className="bg-violet-600/20 text-violet-300 border border-violet-500/30 text-xs ml-1">{items.length} units</Badge>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl text-white text-sm bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/20">
                    <FiPlus className="w-3 h-3 mr-1" /> Add Property
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0F0F28] backdrop-blur-md border border-white/10 rounded-xl max-w-lg">
                  <DialogHeader><DialogTitle className="text-white">Add New Property</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label className="text-xs text-slate-400">Project Name *</Label><Input value={form.project_name} onChange={e => setForm(prev => ({ ...prev, project_name: e.target.value }))} placeholder="e.g. Lodha Palava" className="rounded-lg mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" /></div>
                    <div><Label className="text-xs text-slate-400">Tower</Label><Input value={form.tower} onChange={e => setForm(prev => ({ ...prev, tower: e.target.value }))} placeholder="Tower A" className="rounded-lg mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" /></div>
                    <div><Label className="text-xs text-slate-400">Unit Number *</Label><Input value={form.unit_number} onChange={e => setForm(prev => ({ ...prev, unit_number: e.target.value }))} placeholder="101" className="rounded-lg mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" /></div>
                    <div><Label className="text-xs text-slate-400">BHK *</Label><Input type="number" value={form.bhk} onChange={e => setForm(prev => ({ ...prev, bhk: e.target.value }))} placeholder="2" className="rounded-lg mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" /></div>
                    <div><Label className="text-xs text-slate-400">Area (sqft) *</Label><Input type="number" value={form.area_sqft} onChange={e => setForm(prev => ({ ...prev, area_sqft: e.target.value }))} placeholder="1200" className="rounded-lg mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" /></div>
                    <div><Label className="text-xs text-slate-400">Price (Rs.) *</Label><Input type="number" value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} placeholder="12000000" className="rounded-lg mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" /></div>
                    <div><Label className="text-xs text-slate-400">Location *</Label><Input value={form.location} onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))} placeholder="Andheri West" className="rounded-lg mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" /></div>
                    <div><Label className="text-xs text-slate-400">Floor</Label><Input type="number" value={form.floor} onChange={e => setForm(prev => ({ ...prev, floor: e.target.value }))} placeholder="5" className="rounded-lg mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" /></div>
                    <div><Label className="text-xs text-slate-400">Status</Label>
                      <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v }))}>
                        <SelectTrigger className="rounded-lg mt-1 bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#0F0F28] border-white/10"><SelectItem value="available">Available</SelectItem><SelectItem value="reserved">Reserved</SelectItem><SelectItem value="sold">Sold</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Label className="text-xs text-slate-400">Amenities (comma-separated)</Label><Input value={form.amenities} onChange={e => setForm(prev => ({ ...prev, amenities: e.target.value }))} placeholder="Pool, Gym, Garden" className="rounded-lg mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" /></div>
                  </div>
                  {addError && <p className="text-xs mt-2 text-red-400">{addError}</p>}
                  {addSuccess && <p className="text-xs mt-2 text-emerald-400">{addSuccess}</p>}
                  <Button onClick={handleAddProperty} disabled={addLoading} className="w-full rounded-xl text-white mt-2 bg-violet-600 hover:bg-violet-700">
                    {addLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Adding...</> : 'Add Property'}
                  </Button>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="px-4 pb-4 pt-0">
            {/* Search Bar */}
            <div className="relative mb-3">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by project, location, unit, BHK, or status..."
                className="pl-9 rounded-lg bg-white/5 border-white/10 text-white placeholder:text-slate-600 text-sm"
              />
            </div>
            {items.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <FiHome className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-500">No inventory yet. Add properties to get started.</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-6">
                <FiSearch className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No properties match "{searchQuery}"</p>
                <button onClick={() => setSearchQuery('')} className="text-xs text-violet-400 hover:text-violet-300 mt-1">Clear search</button>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto rounded-lg border border-white/8">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/5 border-b border-white/8">
                      <TableHead className="text-xs font-semibold text-slate-400">Project</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400">Unit</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400">BHK</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400">Area</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400">Price</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400">Location</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400">Floor</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item: any, i: number) => (
                      <TableRow key={item?._id ?? i} className="hover:bg-white/3 border-b border-white/8">
                        <TableCell className="text-xs font-medium text-slate-200">{item?.project_name ?? '-'}</TableCell>
                        <TableCell className="text-xs text-slate-300">{item?.tower ? `${item.tower}-` : ''}{item?.unit_number ?? '-'}</TableCell>
                        <TableCell className="text-xs text-slate-300">{item?.bhk ?? '-'}</TableCell>
                        <TableCell className="text-xs text-slate-300">{item?.area_sqft ? `${item.area_sqft} sqft` : '-'}</TableCell>
                        <TableCell className="text-xs text-slate-300">{item?.price ? `Rs. ${Number(item.price).toLocaleString('en-IN')}` : '-'}</TableCell>
                        <TableCell className="text-xs text-slate-300">{item?.location ?? '-'}</TableCell>
                        <TableCell className="text-xs text-slate-300">{item?.floor ?? '-'}</TableCell>
                        <TableCell><Badge className={`text-xs capitalize border ${statusStyle(item?.status)}`}>{item?.status ?? 'available'}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3 px-1">
                  <span className="text-xs text-slate-500">
                    Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length}{searchQuery.trim() ? ` (filtered from ${items.length})` : ''} units
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-7 w-7 p-0 rounded-lg border-white/10 text-slate-400 hover:text-white hover:bg-white/5">
                      <FiChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1).map((page, idx, arr) => (
                      <span key={page} className="flex items-center">
                        {idx > 0 && arr[idx - 1] !== page - 1 && <span className="text-xs px-1 text-slate-500">...</span>}
                        <Button variant={currentPage === page ? 'default' : 'outline'} size="sm" onClick={() => setCurrentPage(page)} className={`h-7 w-7 p-0 rounded-lg text-xs ${currentPage === page ? 'bg-violet-600 text-white border-violet-600' : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'}`}>
                          {page}
                        </Button>
                      </span>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-7 w-7 p-0 rounded-lg border-white/10 text-slate-400 hover:text-white hover:bg-white/5">
                      <FiChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        </div>

        {/* Demand Analytics */}
        <div className="bg-white/5 backdrop-blur-md border border-white/8 shadow-md rounded-xl">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold flex items-center gap-2 text-white">
                <FiBarChart2 className="w-4 h-4" /> Demand Analytics
              </div>
              <Button onClick={handleAnalyzeDemand} disabled={analyzing} className="rounded-xl text-white text-sm bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/20">
                {analyzing ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Analyzing...</> : <><FiTrendingUp className="w-3 h-3 mr-1" /> Analyze Demand</>}
              </Button>
            </div>
          </div>
          <div className="px-4 pb-4 pt-0">
            {analysisError && <div className="px-3 py-2 rounded-lg text-sm mb-3 bg-red-500/10 border border-red-500/20 text-red-400"><FiAlertCircle className="inline w-4 h-4 mr-1" />{analysisError}</div>}

            {!demandData && !analyzing && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <FiBarChart2 className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-500">Click "Analyze Demand" to generate AI-powered insights from buyer preferences and your inventory data.</p>
              </div>
            )}

            {analyzing && (
              <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-violet-500" /><p className="text-sm text-slate-400">Crunching data across {profiles.length} buyer profiles and {items.length} inventory units...</p></div>
            )}

            {demandData && (
              <div className="space-y-4 mt-2">
                {/* Insights Summary */}
                {demandData.insights_summary && (
                  <div className="p-4 rounded-xl bg-violet-600/8 border border-violet-500/20">
                    <h4 className="text-sm font-semibold mb-2 text-violet-300">Summary</h4>
                    <div className="text-slate-300">{renderMarkdown(demandData.insights_summary)}</div>
                  </div>
                )}

                {/* Demand Trends */}
                {Array.isArray(demandData.demand_trends) && demandData.demand_trends.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-white">Demand Trends</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {demandData.demand_trends.map((trend: any, i: number) => (
                        <div key={i} className="bg-white/5 border border-white/8 rounded-xl p-3">
                          <p className="text-xs font-medium text-slate-400">{trend?.category ?? trend?.metric ?? trend?.label ?? `Trend ${i + 1}`}</p>
                          <p className="text-lg font-bold mt-1 text-white">{trend?.value ?? trend?.count ?? trend?.percentage ?? '-'}</p>
                          {trend?.description && <p className="text-xs mt-1 text-slate-500">{trend.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inventory Match */}
                {matchItems.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-white">Inventory Match</h4>
                    <div className="overflow-x-auto rounded-lg border border-white/8">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-white/5 border-b border-white/8">
                            <TableHead className="text-xs text-slate-400">Property</TableHead>
                            <TableHead className="text-xs text-slate-400">Details</TableHead>
                            <TableHead className="text-xs text-slate-400">Demand</TableHead>
                            <TableHead className="text-xs text-slate-400">Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedMatch.map((m: any, i: number) => (
                            <TableRow key={i} className="hover:bg-white/3 border-b border-white/8">
                              <TableCell className="text-xs font-medium text-slate-200">{m?.project_name ?? m?.property ?? m?.name ?? '-'}</TableCell>
                              <TableCell className="text-xs text-slate-300">{m?.unit_number ?? ''} {m?.bhk ? `${m.bhk}BHK` : ''} {m?.location ?? ''}</TableCell>
                              <TableCell><Badge className={`text-xs border ${getDemandStyle(m?.demand_level ?? m?.demand ?? '')}`}>{m?.demand_level ?? m?.demand ?? 'N/A'}</Badge></TableCell>
                              <TableCell className="text-xs max-w-[200px] truncate text-slate-400">{m?.notes ?? m?.reason ?? m?.recommendation ?? '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {matchTotalPages > 1 && (
                      <div className="flex items-center justify-between mt-3 px-1">
                        <span className="text-xs text-slate-500">
                          Showing {(matchPage - 1) * matchPageSize + 1}-{Math.min(matchPage * matchPageSize, matchItems.length)} of {matchItems.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => setMatchPage(p => Math.max(1, p - 1))} disabled={matchPage === 1} className="h-7 w-7 p-0 rounded-lg border-white/10 text-slate-400 hover:text-white hover:bg-white/5">
                            <FiChevronLeft className="w-3.5 h-3.5" />
                          </Button>
                          {Array.from({ length: matchTotalPages }, (_, i) => i + 1).filter(p => p === 1 || p === matchTotalPages || Math.abs(p - matchPage) <= 1).map((page, idx, arr) => (
                            <span key={page} className="flex items-center">
                              {idx > 0 && arr[idx - 1] !== page - 1 && <span className="text-xs px-1 text-slate-500">...</span>}
                              <Button variant={matchPage === page ? 'default' : 'outline'} size="sm" onClick={() => setMatchPage(page)} className={`h-7 w-7 p-0 rounded-lg text-xs ${matchPage === page ? 'bg-violet-600 text-white border-violet-600' : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                {page}
                              </Button>
                            </span>
                          ))}
                          <Button variant="outline" size="sm" onClick={() => setMatchPage(p => Math.min(matchTotalPages, p + 1))} disabled={matchPage === matchTotalPages} className="h-7 w-7 p-0 rounded-lg border-white/10 text-slate-400 hover:text-white hover:bg-white/5">
                            <FiChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Items */}
                {Array.isArray(demandData.action_items) && demandData.action_items.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-white">Action Items</h4>
                    <div className="space-y-2">
                      {demandData.action_items.map((item: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-bold text-white bg-violet-600">{i + 1}</div>
                          <div>
                            <p className="text-sm font-medium text-slate-200">{typeof item === 'string' ? item : (item?.title ?? item?.action ?? item?.description ?? JSON.stringify(item))}</p>
                            {typeof item === 'object' && item?.details && <p className="text-xs mt-1 text-slate-500">{item.details}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
