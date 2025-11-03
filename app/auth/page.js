'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
// Import Dialog components for the "Forgot Password" modal
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog' 

export default function ParticipantAuthPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [signupData, setSignupData] = useState({ email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [currentTab, setCurrentTab] = useState('login')
  
  // NEW State for Forgot Password Dialog
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
            router.push('/events') // Redirect authenticated user away from auth page
        } else {
            setSessionLoading(false)
        }
    }
    checkSession()
  }, [router])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      })

      if (error) throw error

      router.push('/events') // Redirect to events page after successful login
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setError('')

    if (signupData.password !== signupData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
      })

      if (error) throw error

      alert('Account created! Please check your email to verify your account.')
      setCurrentTab('login')
      setSignupData({ email: '', password: '', confirmPassword: '' })
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }
  
  // NEW: Forgot Password Handler
  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setResetMessage('')
    setIsResetting(true)

    try {
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
         // You must configure this URL in your Supabase Auth settings 
         // or set it to point to a page that handles the password update token.
         // FIX: Changed '/update-password' to '/update_password'
         redirectTo: `${window.location.origin}/update_password`,
    })

        if (error) throw error
        
        setResetMessage('Password reset link sent! Check your email inbox (and spam folder).')
        setResetEmail('')

    } catch (error) {
        setResetMessage(`Error: ${error.message}`)
    } finally {
        setIsResetting(false)
    }
  }

  
  if (sessionLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00629B]"></div>
              <p className="mt-4 text-gray-600">Checking session...</p>
            </div>
        </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#00629B] rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">IEEE</span>
          </div>
          <h1 className="text-3xl font-bold">Participant Portal</h1>
          <p className="text-gray-600 mt-2">Login or create an account to register for events</p>
        </div>

        <Tabs defaultValue="login" className="w-full" value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Login</CardTitle>
                <CardDescription>Sign in to access event registration</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      placeholder="participant@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                    />
                  </div>
                  
                  {/* NEW: Forgot Password Link */}
                  <div className="text-right">
                    <Button 
                        type="button" 
                        variant="link" 
                        className="h-auto p-0 text-sm"
                        onClick={() => {
                            setError('')
                            setIsForgotPasswordOpen(true)
                        }}
                    >
                        Forgot Password?
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#00629B] hover:bg-[#004d7a]"
                    disabled={loading}
                  >
                    {loading ? 'Logging in...' : 'Login'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card>
              <CardHeader>
                <CardTitle>Create Account</CardTitle>
                <CardDescription>Create a new participant account</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignup} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                      placeholder="participant@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#00629B] hover:bg-[#004d7a]"
                    disabled={loading}
                  >
                    {loading ? 'Creating Account...' : 'Sign Up'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* NEW: Forgot Password Dialog */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter the email address associated with your account. We will send a password reset link to that email.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            {resetMessage && (
                <div className={`px-4 py-3 rounded text-sm ${resetMessage.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    {resetMessage}
                </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="participant@example.com"
                required
                disabled={isResetting || resetMessage.includes('Password reset link sent')}
              />
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsForgotPasswordOpen(false)}
                disabled={isResetting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-[#00629B] hover:bg-[#004d7a]"
                disabled={isResetting || resetMessage.includes('Password reset link sent')}
              >
                {isResetting ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}