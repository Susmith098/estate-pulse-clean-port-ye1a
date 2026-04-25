'use client'

import { useState } from 'react'
import { LoginForm, RegisterForm } from 'lyzr-architect/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FiHome, FiStar } from 'react-icons/fi'

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('register')

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A0A1B] relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />

      <Card className="w-full max-w-md bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl rounded-xl relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/25">
              <FiHome className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">EstatePulse</CardTitle>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <FiStar className="w-3.5 h-3.5 text-violet-400" />
            <p className="text-sm text-slate-400">AI Pre-Sales Platform</p>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </p>
        </CardHeader>
        <CardContent>
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
