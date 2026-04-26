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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, BarChart2, TrendingUp, Home, AlertCircle, LayoutGrid, Loader2, Trash2, Database } from 'lucide-react'

interface BuilderViewProps {
  userId: string
  inventory: any[]
  buyerProfiles: any[]
  onInventoryChange: () => void
  onSeedInventory?: () => Promise<void>
  setActiveAgentId: (id: string | null) => void
}

const DEMAND_AGENT_ID = '69ec6075744aec5380d4041f'
const emptyForm = { project_name: '', tower: '', unit_number: '', bhk: '', area_sqft: '', price: '', location: '', floor: '', amenities: '', status: 'available' }

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

function statusBadgeClass(status: string) {
  if (status === 'available') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  if (status === 'reserved') return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  return 'bg-red-500/15 text-red-400 border-red-500/30'
}

function demandBadgeClass(level: string) {
  const l = (level ?? '').toLowerCase()
  if (l === 'high') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  if (l === 'medium') return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  return 'bg-red-500/15 text-red-400 border-red-500/30'
}

export default function BuilderView({ userId, inventory, buyerProfiles, onInventoryChange, onSeedInventory, setActiveAgentId }: BuilderViewProps) {
  const [form, setForm] = useState(emptyForm)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [demandData, setDemandData] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteName, setConfirmDeleteName] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const items = Array.isArray(inventory) ? inventory : []
  // Reset to page 1 if current page exceeds total pages
  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  if (page > totalPages && totalPages > 0 && page !== 1) setPage(1)
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
        setAddSuccess('Property added successfully!')
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

  const handleDeleteItem = async () => {
    if (!confirmDeleteId || deletingId) return
    setDeletingId(confirmDeleteId)
    setConfirmDeleteId(null)
    try {
      await fetch(`/api/inventory?id=${confirmDeleteId}`, { method: 'DELETE' })
      await onInventoryChange()
    } catch {}
    setDeletingId(null)
  }

  const handleStatusChange = async (id: string, status: string) => {
    if (!id || updatingId) return
    setUpdatingId(id)
    try {
      await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await onInventoryChange()
    } catch {}
    setUpdatingId(null)
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

  const available = items.filter(i => i?.status === 'available').length
  const reserved = items.filter(i => i?.status === 'reserved').length
  const sold = items.filter(i => i?.status === 'sold').length

  return (
    <ScrollArea className="h-full bg-[#0D0D24]">
      <div className="p-5 space-y-5 max-w-6xl mx-auto">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Units', value: items.length, color: 'text-white' },
            { label: 'Available', value: available, color: 'text-emerald-400' },
            { label: 'Reserved', value: reserved, color: 'text-amber-400' },
            { label: 'Sold', value: sold, color: 'text-red-400' },
          ].map(stat => (
            <Card key={stat.label} className="bg-white/5 border border-white/8 rounded-2xl">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Inventory Section */}
        <Card className="bg-white/5 border border-white/8 rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-violet-400" />
                Inventory
                <Badge className="bg-white/8 border border-white/10 text-slate-400 text-xs">{items.length} units</Badge>
              </CardTitle>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm shadow-lg shadow-violet-900/30" size="sm">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Property
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0F0F28] border border-white/10 rounded-2xl max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-white">Add New Property</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="col-span-2">
                      <Label className="text-xs text-slate-400">Project Name *</Label>
                      <Input value={form.project_name} onChange={e => setForm(prev => ({ ...prev, project_name: e.target.value }))} placeholder="e.g. Lodha Palava" className="rounded-xl mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Tower</Label>
                      <Input value={form.tower} onChange={e => setForm(prev => ({ ...prev, tower: e.target.value }))} placeholder="Tower A" className="rounded-xl mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Unit Number *</Label>
                      <Input value={form.unit_number} onChange={e => setForm(prev => ({ ...prev, unit_number: e.target.value }))} placeholder="101" className="rounded-xl mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">BHK *</Label>
                      <Input type="number" value={form.bhk} onChange={e => setForm(prev => ({ ...prev, bhk: e.target.value }))} placeholder="2" className="rounded-xl mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Area (sqft) *</Label>
                      <Input type="number" value={form.area_sqft} onChange={e => setForm(prev => ({ ...prev, area_sqft: e.target.value }))} placeholder="1200" className="rounded-xl mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Price (Rs.) *</Label>
                      <Input type="number" value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} placeholder="12000000" className="rounded-xl mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Location *</Label>
                      <Input value={form.location} onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))} placeholder="Andheri West" className="rounded-xl mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Floor</Label>
                      <Input type="number" value={form.floor} onChange={e => setForm(prev => ({ ...prev, floor: e.target.value }))} placeholder="5" className="rounded-xl mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Status</Label>
                      <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v }))}>
                        <SelectTrigger className="rounded-xl mt-1 bg-white/5 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0F0F28] border-white/10">
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="reserved">Reserved</SelectItem>
                          <SelectItem value="sold">Sold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-slate-400">Amenities (comma-separated)</Label>
                      <Input value={form.amenities} onChange={e => setForm(prev => ({ ...prev, amenities: e.target.value }))} placeholder="Pool, Gym, Garden" className="rounded-xl mt-1 bg-white/5 border-white/10 text-white placeholder:text-slate-600" />
                    </div>
                  </div>
                  {addError && <p className="text-xs mt-2 text-red-400">{addError}</p>}
                  {addSuccess && <p className="text-xs mt-2 text-emerald-400">{addSuccess}</p>}
                  <Button onClick={handleAddProperty} disabled={addLoading} className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white mt-3 shadow-lg shadow-violet-900/30">
                    {addLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Adding...</> : 'Add Property'}
                  </Button>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {items.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <Home className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-500 mb-4">No inventory yet. Add a property or load sample data.</p>
                {onSeedInventory && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => { setSeeding(true); await onSeedInventory(); setSeeding(false) }}
                    disabled={seeding}
                    className="rounded-xl border border-violet-500/30 text-violet-400 hover:bg-violet-600/10 text-xs"
                  >
                    {seeding ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Loading...</> : <><Database className="w-3.5 h-3.5 mr-1.5" /> Load Sample Inventory</>}
                  </Button>
                )}
              </div>
            ) : (() => {
              const totalPages = Math.ceil(items.length / PAGE_SIZE)
              const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              return (
              <div>
              <div className="overflow-x-auto rounded-xl border border-white/8">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/8 hover:bg-transparent">
                      {['Project', 'Unit', 'BHK', 'Area', 'Price', 'Location', 'Floor', 'Status', ''].map(h => (
                        <TableHead key={h} className="text-xs font-semibold text-slate-400 bg-white/5">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((item: any, i: number) => (
                      <TableRow key={item?._id ?? i} className="border-white/8 hover:bg-white/3">
                        <TableCell className="text-xs font-medium text-slate-200">{item?.project_name ?? '-'}</TableCell>
                        <TableCell className="text-xs text-slate-400">{item?.tower ? `${item.tower}-` : ''}{item?.unit_number ?? '-'}</TableCell>
                        <TableCell className="text-xs text-slate-400">{item?.bhk ?? '-'}</TableCell>
                        <TableCell className="text-xs text-slate-400">{item?.area_sqft ? `${item.area_sqft} sqft` : '-'}</TableCell>
                        <TableCell className="text-xs text-slate-400">{item?.price ? `₹${Number(item.price).toLocaleString('en-IN')}` : '-'}</TableCell>
                        <TableCell className="text-xs text-slate-400">{item?.location ?? '-'}</TableCell>
                        <TableCell className="text-xs text-slate-400">{item?.floor ?? '-'}</TableCell>
                        <TableCell>
                          {item?._id ? (
                            <Select
                              value={item?.status ?? 'available'}
                              onValueChange={v => handleStatusChange(item._id, v)}
                              disabled={updatingId === item._id}
                            >
                              <SelectTrigger className={`h-7 text-xs rounded-lg border px-2 w-28 bg-transparent ${statusBadgeClass(item?.status)}`}>
                                {updatingId === item._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <SelectValue />}
                              </SelectTrigger>
                              <SelectContent className="bg-[#0F0F28] border-white/10">
                                <SelectItem value="available">Available</SelectItem>
                                <SelectItem value="reserved">Reserved</SelectItem>
                                <SelectItem value="sold">Sold</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={`text-xs capitalize border ${statusBadgeClass(item?.status)}`}>{item?.status ?? 'available'}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {item?._id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setConfirmDeleteId(item._id); setConfirmDeleteName(item.project_name ?? 'this property') }}
                              disabled={deletingId === item._id}
                              className="h-7 w-7 p-0 text-slate-600 hover:text-red-400 hover:bg-red-500/10"
                            >
                              {deletingId === item._id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-1 pt-3">
                  <span className="text-xs text-slate-500">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, items.length)} of {items.length} units
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 px-2.5 text-xs text-slate-400 hover:text-white hover:bg-white/8 disabled:opacity-30 rounded-lg">← Prev</Button>
                    {(() => {
                      const pages: (number | '...')[] = []
                      if (totalPages <= 7) {
                        for (let i = 1; i <= totalPages; i++) pages.push(i)
                      } else {
                        pages.push(1)
                        if (page > 3) pages.push('...')
                        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
                        if (page < totalPages - 2) pages.push('...')
                        pages.push(totalPages)
                      }
                      return pages.map((p, i) => p === '...'
                        ? <span key={`e${i}`} className="h-7 w-6 flex items-center justify-center text-xs text-slate-600">…</span>
                        : <button key={p} onClick={() => setPage(p as number)} className={`h-7 w-7 rounded-lg text-xs font-medium transition-all ${p === page ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-white/8 hover:text-white'}`}>{p}</button>
                      )
                    })()}
                    <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 px-2.5 text-xs text-slate-400 hover:text-white hover:bg-white/8 disabled:opacity-30 rounded-lg">Next →</Button>
                  </div>
                </div>
              )}
              </div>
              )})()}
          </CardContent>
        </Card>

        {/* Demand Analytics */}
        <Card className="bg-white/5 border border-white/8 rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-violet-400" />
                Demand Analytics
              </CardTitle>
              <Button
                onClick={handleAnalyzeDemand}
                disabled={analyzing}
                className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm shadow-lg shadow-violet-900/30"
                size="sm"
              >
                {analyzing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Analyzing...</>
                  : <><TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Analyze Demand</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {analysisError && (
              <div className="px-4 py-3 rounded-xl text-sm mb-3 bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{analysisError}
              </div>
            )}

            {!demandData && !analyzing && (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <BarChart2 className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  Click "Analyze Demand" to generate AI-powered insights from buyer preferences and your inventory.
                </p>
              </div>
            )}

            {analyzing && (
              <div className="text-center py-10">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-violet-400" />
                <p className="text-sm text-slate-400">
                  Crunching data across {profiles.length} buyer profiles and {items.length} inventory units...
                </p>
              </div>
            )}

            {demandData && (
              <div className="space-y-5 mt-1">
                {demandData.insights_summary && (
                  <div className="p-4 rounded-xl bg-violet-600/8 border border-violet-500/20">
                    <h4 className="text-sm font-semibold mb-2 text-violet-300">Summary</h4>
                    {renderMarkdown(demandData.insights_summary)}
                  </div>
                )}

                {Array.isArray(demandData.demand_trends) && demandData.demand_trends.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-slate-300">Demand Trends</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {demandData.demand_trends.map((trend: any, i: number) => (
                        <Card key={i} className="bg-white/5 border border-white/8 rounded-xl">
                          <CardContent className="p-3">
                            <p className="text-xs text-slate-500">{trend?.category ?? trend?.metric ?? trend?.label ?? `Trend ${i + 1}`}</p>
                            <p className="text-xl font-bold mt-1 text-white">{trend?.value ?? trend?.count ?? trend?.percentage ?? '-'}</p>
                            {trend?.description && <p className="text-xs mt-1 text-slate-500">{trend.description}</p>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(demandData.inventory_match) && demandData.inventory_match.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-slate-300">Inventory Match</h4>
                    <div className="overflow-x-auto rounded-xl border border-white/8">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/8 hover:bg-transparent">
                            {['Property', 'Details', 'Demand', 'Notes'].map(h => (
                              <TableHead key={h} className="text-xs text-slate-400 bg-white/5">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {demandData.inventory_match.map((m: any, i: number) => (
                            <TableRow key={i} className="border-white/8 hover:bg-white/3">
                              <TableCell className="text-xs font-medium text-slate-200">{m?.project_name ?? m?.property ?? m?.name ?? '-'}</TableCell>
                              <TableCell className="text-xs text-slate-400">{m?.unit_number ?? ''}{m?.bhk ? ` ${m.bhk}BHK` : ''}{m?.location ? ` · ${m.location}` : ''}</TableCell>
                              <TableCell>
                                <Badge className={`text-xs border ${demandBadgeClass(m?.demand_level ?? m?.demand ?? '')}`}>
                                  {m?.demand_level ?? m?.demand ?? 'N/A'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-slate-400 max-w-[200px] truncate">{m?.notes ?? m?.reason ?? m?.recommendation ?? '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {Array.isArray(demandData.action_items) && demandData.action_items.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-slate-300">Action Items</h4>
                    <div className="space-y-2">
                      {demandData.action_items.map((item: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white bg-violet-600">
                            {i + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-200">
                              {typeof item === 'string' ? item : (item?.title ?? item?.action ?? item?.description ?? JSON.stringify(item))}
                            </p>
                            {typeof item === 'object' && item?.details && <p className="text-xs mt-1 text-slate-500">{item.details}</p>}
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
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={open => { if (!open) setConfirmDeleteId(null) }}>
        <DialogContent className="bg-[#0F0F28] border border-white/10 rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Property</DialogTitle>
            <DialogDescription className="text-slate-400 text-sm mt-1">
              Are you sure you want to delete <span className="text-white font-medium">{confirmDeleteName}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 mt-2">
            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)} className="flex-1 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5">
              Cancel
            </Button>
            <Button onClick={handleDeleteItem} className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/30">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}
