'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AuthProvider, ProtectedRoute, UserMenu } from 'lyzr-architect/client'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { FiHome, FiMessageSquare, FiTarget, FiBarChart2 } from 'react-icons/fi'
import { Loader2 } from 'lucide-react'
import AuthScreen from './sections/AuthScreen'
import BuyerView from './sections/BuyerView'
import AgentView from './sections/AgentView'
import BuilderView from './sections/BuilderView'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0A0A1B]">
          <div className="text-center p-8 max-w-md bg-white/5 backdrop-blur-md rounded-xl shadow-xl border border-white/10">
            <h2 className="text-xl font-semibold mb-2 text-white">Something went wrong</h2>
            <p className="text-sm mb-4 text-slate-400">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 rounded-xl text-white text-sm bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 transition-all">Try again</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const BUYER_AGENT_ID = '69ec6074f47b2b8f69099f76'
const LEAD_AGENT_ID = '69ec6075603f5bad913c0e64'
const DEMAND_AGENT_ID = '69ec6075744aec5380d4041f'

const AGENTS = [
  { id: BUYER_AGENT_ID, name: 'Buyer Recommendation', purpose: 'Collects preferences and recommends properties' },
  { id: LEAD_AGENT_ID, name: 'Lead Intelligence', purpose: 'Scores leads and generates pitch messages' },
  { id: DEMAND_AGENT_ID, name: 'Demand Insights', purpose: 'Analyzes demand patterns against inventory' },
]

const SEED_INVENTORY = [
  { project_name: 'Lodha Palava', tower: 'A', unit_number: '101', bhk: 2, area_sqft: 1050, price: 8500000, location: 'Dombivli, Mumbai', floor: 1, amenities: ['Pool', 'Gym', 'Garden'], status: 'available' },
  { project_name: 'Lodha Palava', tower: 'B', unit_number: '502', bhk: 3, area_sqft: 1450, price: 13500000, location: 'Dombivli, Mumbai', floor: 5, amenities: ['Pool', 'Gym', 'Clubhouse', 'Garden'], status: 'available' },
  { project_name: 'Hiranandani Powai', tower: 'C', unit_number: '1201', bhk: 3, area_sqft: 1600, price: 32000000, location: 'Powai, Mumbai', floor: 12, amenities: ['Pool', 'Gym', 'Concierge', 'Garden'], status: 'available' },
  { project_name: 'Oberoi Realty', tower: 'Sky', unit_number: '801', bhk: 4, area_sqft: 2200, price: 55000000, location: 'Goregaon, Mumbai', floor: 8, amenities: ['Pool', 'Gym', 'Theatre', 'Spa'], status: 'available' },
  { project_name: 'Godrej Infinity', tower: 'T1', unit_number: '302', bhk: 2, area_sqft: 980, price: 7200000, location: 'Keshav Nagar, Pune', floor: 3, amenities: ['Gym', 'Garden', 'Jogging Track'], status: 'available' },
  { project_name: 'Godrej Infinity', tower: 'T2', unit_number: '605', bhk: 3, area_sqft: 1350, price: 11000000, location: 'Keshav Nagar, Pune', floor: 6, amenities: ['Pool', 'Gym', 'Clubhouse'], status: 'available' },
  { project_name: 'Kolte Patil Life Republic', tower: 'R7', unit_number: '204', bhk: 2, area_sqft: 1100, price: 6800000, location: 'Hinjewadi, Pune', floor: 2, amenities: ['Garden', 'Playground', 'Gym'], status: 'available' },
  { project_name: 'Kolte Patil Life Republic', tower: 'R9', unit_number: '901', bhk: 1, area_sqft: 650, price: 4200000, location: 'Hinjewadi, Pune', floor: 9, amenities: ['Gym', 'Garden'], status: 'available' },
  { project_name: 'Runwal Forests', tower: 'Pine', unit_number: '1502', bhk: 3, area_sqft: 1500, price: 16000000, location: 'Kanjurmarg, Mumbai', floor: 15, amenities: ['Pool', 'Gym', 'Garden', 'Sports Court'], status: 'reserved' },
  { project_name: 'Prestige Finsberry Park', tower: 'D', unit_number: '401', bhk: 2, area_sqft: 1150, price: 9500000, location: 'Hinjewadi, Pune', floor: 4, amenities: ['Pool', 'Gym', 'Clubhouse', 'Garden'], status: 'available' },
  { project_name: 'Shapoorji Pallonji Joyville', tower: 'E', unit_number: '703', bhk: 2, area_sqft: 1000, price: 7800000, location: 'Virar, Mumbai', floor: 7, amenities: ['Pool', 'Gym', 'Playground'], status: 'available' },
  { project_name: 'Shapoorji Pallonji Joyville', tower: 'F', unit_number: '1104', bhk: 3, area_sqft: 1380, price: 10500000, location: 'Virar, Mumbai', floor: 11, amenities: ['Pool', 'Gym', 'Clubhouse', 'Garden'], status: 'available' },
  { project_name: 'Piramal Vaikunth', tower: 'Vridavan', unit_number: '303', bhk: 2, area_sqft: 1120, price: 14500000, location: 'Thane, Mumbai', floor: 3, amenities: ['Pool', 'Gym', 'Temple', 'Garden'], status: 'available' },
  { project_name: 'Piramal Vaikunth', tower: 'Vrindavan', unit_number: '1005', bhk: 4, area_sqft: 2100, price: 28000000, location: 'Thane, Mumbai', floor: 10, amenities: ['Pool', 'Gym', 'Spa', 'Theatre', 'Garden'], status: 'reserved' },
  { project_name: 'Brigade Utopia', tower: 'G1', unit_number: '501', bhk: 3, area_sqft: 1550, price: 12500000, location: 'Whitefield, Bangalore', floor: 5, amenities: ['Pool', 'Gym', 'Clubhouse'], status: 'available' },
  { project_name: 'Brigade Utopia', tower: 'G2', unit_number: '202', bhk: 2, area_sqft: 1050, price: 8800000, location: 'Whitefield, Bangalore', floor: 2, amenities: ['Gym', 'Garden', 'Jogging Track'], status: 'available' },
  { project_name: 'Sobha Dream Acres', tower: 'H', unit_number: '1401', bhk: 2, area_sqft: 1130, price: 9200000, location: 'Panathur, Bangalore', floor: 14, amenities: ['Pool', 'Gym', 'Garden', 'Sports Court'], status: 'available' },
  { project_name: 'Prestige Shantiniketan', tower: 'J', unit_number: '608', bhk: 4, area_sqft: 2500, price: 45000000, location: 'Whitefield, Bangalore', floor: 6, amenities: ['Pool', 'Gym', 'Theatre', 'Spa', 'Concierge'], status: 'available' },
  { project_name: 'DLF The Crest', tower: 'K', unit_number: '1801', bhk: 4, area_sqft: 3200, price: 62000000, location: 'Sector 54, Gurgaon', floor: 18, amenities: ['Pool', 'Gym', 'Spa', 'Concierge', 'Theatre'], status: 'available' },
  { project_name: 'Rustomjee Seasons', tower: 'L', unit_number: '404', bhk: 2, area_sqft: 1080, price: 17500000, location: 'Bandra East, Mumbai', floor: 4, amenities: ['Pool', 'Gym', 'Garden', 'Clubhouse'], status: 'available' },
]

type Role = 'buyer' | 'agent' | 'admin'

function AppContent() {
  const [role, setRole] = useState<Role>('buyer')
  const [inventory, setInventory] = useState<any[]>([])
  const [buyerProfiles, setBuyerProfiles] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [showSample, setShowSample] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)

  const userId = 'demo-user'
  const sessionId = 'session-' + userId

  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setInventory(data.data)
        return data.data
      }
    } catch (err) {
      console.error('fetchInventory error:', err)
    }
    return []
  }, [])

  const fetchBuyerProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/buyer-profiles', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) setBuyerProfiles(data.data)
    } catch (err) {
      console.error('fetchBuyerProfiles error:', err)
    }
  }, [])

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) setLeads(data.data)
    } catch (err) {
      console.error('fetchLeads error:', err)
    }
  }, [])

  const seedInventory = useCallback(async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/inventory/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: SEED_INVENTORY }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchInventory()
      }
    } catch {}
    setSeeding(false)
  }, [fetchInventory])

  useEffect(() => {
    const init = async () => {
      const inv = await fetchInventory()
      await fetchBuyerProfiles()
      await fetchLeads()
      if (Array.isArray(inv) && inv.length === 0) {
        await seedInventory()
      }
      setInitialLoad(false)
    }
    init()
  }, [fetchInventory, fetchBuyerProfiles, fetchLeads, seedInventory])

  const roles: { key: Role; label: string; icon: React.ReactNode }[] = [
    { key: 'buyer', label: 'Buyer', icon: <FiMessageSquare className="w-3.5 h-3.5" /> },
    { key: 'agent', label: 'Agent', icon: <FiTarget className="w-3.5 h-3.5" /> },
    { key: 'admin', label: 'Admin', icon: <FiBarChart2 className="w-3.5 h-3.5" /> },
  ]

  const activeAgent = AGENTS.find(a => a.id === activeAgentId)

  if (initialLoad) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A1B]">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-600/25">
            <FiHome className="w-7 h-7 text-white" />
          </div>
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-violet-500" />
          <p className="text-sm text-slate-400">{seeding ? 'Setting up inventory...' : 'Loading EstatePulse...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#0A0A1B]">
      {/* Top Bar */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-white/8 bg-[#0A0A1B]/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/25">
            <FiHome className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">EstatePulse</span>
        </div>

        {/* Role Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
          {roles.map(r => (
            <button key={r.key} onClick={() => setRole(r.key)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${role === r.key ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-slate-400 hover:text-slate-300'}`}>
              {r.icon}{r.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="sample-toggle" checked={showSample} onCheckedChange={setShowSample} />
            <Label htmlFor="sample-toggle" className="text-xs cursor-pointer text-slate-400">Sample Data</Label>
          </div>
          <UserMenu />
        </div>
      </header>

      {/* Active Agent Indicator */}
      {activeAgent && (
        <div className="flex items-center gap-2 px-4 py-1.5 text-xs border-b border-white/8 bg-violet-600/10">
          <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
          <span className="text-violet-300">{activeAgent.name} is processing...</span>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {role === 'buyer' && (
          <BuyerView
            userId={userId}
            sessionId={sessionId}
            inventory={showSample ? SEED_INVENTORY : inventory}
            onProfileSaved={fetchBuyerProfiles}
            setActiveAgentId={setActiveAgentId}
          />
        )}
        {role === 'agent' && (
          <AgentView
            userId={userId}
            inventory={inventory}
            buyerProfiles={showSample ? [
              { _id: 'sample-1', buyer_name: 'Rahul Sharma', bhk: 3, location_pref: 'Powai, Mumbai', budget_min: 10000000, budget_max: 35000000, purpose: 'Investment', timeline: '6 months', amenities: ['Pool', 'Gym'] },
              { _id: 'sample-2', buyer_name: 'Priya Patel', bhk: 2, location_pref: 'Hinjewadi, Pune', budget_min: 5000000, budget_max: 10000000, purpose: 'Self-use', timeline: '3 months', amenities: ['Garden', 'Gym'] },
              { _id: 'sample-3', buyer_name: 'Amit Desai', bhk: 4, location_pref: 'Goregaon, Mumbai', budget_min: 40000000, budget_max: 60000000, purpose: 'Self-use', timeline: '1 year', amenities: ['Pool', 'Theatre', 'Spa'] },
            ] : buyerProfiles}
            leads={showSample ? [
              { _id: 'lead-1', buyer_profile_id: 'sample-1', buyer_name: 'Rahul Sharma', lead_score: 'Hot', score_reasoning: 'High budget with strong investment intent and ready timeline.', ai_summary: 'Qualified investor seeking premium 3BHK in Powai. Budget aligns with Hiranandani offerings.', recommended_units: [], pitch_message: 'Mr. Sharma, given your investment goals, we have an exclusive 3BHK at Hiranandani Powai with projected appreciation.', next_action: 'Schedule site visit within 48 hours' },
              { _id: 'lead-2', buyer_profile_id: 'sample-2', buyer_name: 'Priya Patel', lead_score: 'Warm', score_reasoning: 'First-time buyer with good budget match and shorter timeline.', ai_summary: 'First-time buyer looking for 2BHK in Pune IT corridor. Multiple matches in inventory.', recommended_units: [], pitch_message: 'Ms. Patel, we have excellent 2BHK options near your workplace in Hinjewadi.', next_action: 'Share virtual tour links and schedule call' },
            ] : leads}
            onLeadSaved={fetchLeads}
            setActiveAgentId={setActiveAgentId}
          />
        )}
        {role === 'admin' && (
          <BuilderView
            userId={userId}
            inventory={showSample ? SEED_INVENTORY : inventory}
            buyerProfiles={showSample ? [
              { _id: 's1', buyer_name: 'Buyer A', bhk: 2, location_pref: 'Mumbai', budget_min: 5000000, budget_max: 10000000, purpose: 'Self-use' },
              { _id: 's2', buyer_name: 'Buyer B', bhk: 3, location_pref: 'Pune', budget_min: 10000000, budget_max: 15000000, purpose: 'Investment' },
            ] : buyerProfiles}
            onInventoryChange={fetchInventory}
            setActiveAgentId={setActiveAgentId}
          />
        )}
      </main>

      {/* Agent Status Footer */}
      <footer className="border-t border-white/8 px-4 py-2 bg-[#0A0A1B]/60 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {AGENTS.map(agent => (
              <div key={agent.id} className="flex items-center gap-1.5 text-xs text-slate-400">
                <div className={`w-2 h-2 rounded-full ${activeAgentId === agent.id ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                <span className="font-medium">{agent.name}</span>
              </div>
            ))}
          </div>
          <span className="text-xs text-slate-500">3 AI Agents Active</span>
        </div>
      </footer>
    </div>
  )
}

export default function Page() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProtectedRoute unauthenticatedFallback={<AuthScreen />}>
          <AppContent />
        </ProtectedRoute>
      </AuthProvider>
    </ErrorBoundary>
  )
}
