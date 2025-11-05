'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'

export default function AdminLoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      })

      if (loginError) throw loginError

      // Check if the newly logged-in user is an admin
      const user = data.user;
      
      // MODIFIED: Select 'role'
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('role') // Check for the role
        .eq('user_id', user.id)
        .maybeSingle() 

      // MODIFIED: Check if role is 'admin' or 'super_admin'
      const userRole = adminData?.role;
      const isAdmin = userRole === 'admin' || userRole === 'super_admin';
      
      if (adminError && adminError.message !== 'Policy violation' && !adminData) {
          // If we can't check the admin status for some other DB error
          throw adminError; 
      }
      
      if (isAdmin) {
          router.push('/admin')
      } else {
          // Log out non-admin users immediately after they login
          await supabase.auth.signOut() 
          setError('Access Denied. This login is for administrators only.')
      }

    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#00629B] rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">IEEE</span>
          </div>
          <h1 className="text-3xl font-bold">Admin Portal</h1>
          <p className="text-gray-600 mt-2">Manage events and participants. Contact a super-admin to get access.</p>
        </div>

        {/* Keeping Tabs structure simple for single form */}
        <Tabs defaultValue="login" className="w-full">
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Admin Login</CardTitle>
                <CardDescription>Enter your credentials to access the admin dashboard</CardDescription>
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
                      placeholder="admin@example.com"
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
        </Tabs>
      </div>
    </div>
  )
}