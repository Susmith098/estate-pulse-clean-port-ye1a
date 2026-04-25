'use client'

import { useState } from 'react'
import { LoginForm, RegisterForm } from 'lyzr-architect/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FiHome } from 'react-icons/fi'

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('register')

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, hsl(160 40% 94%) 0%, hsl(180 35% 93%) 30%, hsl(160 35% 95%) 60%, hsl(140 40% 94%) 100%)' }}>
      <Card className="w-full max-w-md bg-white/75 backdrop-blur-md border border-white/18 shadow-xl rounded-xl">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'hsl(160 85% 35%)' }}>
              <FiHome className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold" style={{ color: 'hsl(160 35% 8%)' }}>PropIntel</CardTitle>
          </div>
          <p className="text-sm" style={{ color: 'hsl(160 25% 40%)' }}>AI-Powered Real Estate Pre-Sales Platform</p>
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
