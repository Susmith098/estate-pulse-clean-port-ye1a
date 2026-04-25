'use client'

import { useState } from 'react'
import { LoginForm, RegisterForm } from 'lyzr-architect/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Home, Sparkles } from 'lucide-react'

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('register')

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A0A1B] relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl relative z-10">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
              <Home className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-white tracking-tight">EstatePulse</h1>
              <p className="text-xs text-slate-400 flex items-center gap-1"><Sparkles className="w-3 h-3 text-violet-400" /> AI Pre-Sales Platform</p>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {mode === 'login' ? 'Welcome back! Sign in to continue.' : 'Create your account to get started.'}
          </p>
        </CardHeader>
        <CardContent className="px-6 pb-8">
          {mode === 'login' ? (
            <LoginForm onSwitchToRegister={() => setMode('register')} />
          ) : (
            <RegisterForm onSwitchToLogin={() => setMode('login')} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
