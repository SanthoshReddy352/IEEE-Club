'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import FormBuilder from '@/components/FormBuilder'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/context/AuthContext' // MODIFIED
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card' // MODIFIED
import { supabase } from '@/lib/supabase/client' // MODIFIED

function FormBuilderContent() {
  const params = useParams()
  const router = useRouter()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const { user, isSuperAdmin, loading: authLoading } = useAuth() // MODIFIED

  useEffect(() => {
    if (params.id) {
      fetchEvent()
    }
  }, [params.id])

  const fetchEvent = async () => {
    try {
      const response = await fetch(`/api/events/${params.id}`)
      const data = await response.json()
      if (data.success) {
        setEvent(data.event)
      }
    } catch (error) {
      console.error('Error fetching event:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (fields) => {
    try {
      // MODIFIED: Pass auth token
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/events/${params.id}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          form_fields: fields,
        }),
      })

      const data = await response.json()
      if (data.success) {
        alert('Form saved successfully!')
        router.push('/admin/events')
      } else {
        alert(`Failed to save form: ${data.error}`)
      }
    } catch (error) {
      console.error('Error saving form:', error)
      alert('An error occurred')
    }
  }

  // MODIFIED: Include authLoading
  if (loading || authLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00629B]"></div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-12">
        <p>Event not found</p>
      </div>
    )
  }
  
  // MODIFIED: Add permission check
  const canManage = event && user && (isSuperAdmin || event.created_by === user.id);
  if (!canManage) {
    return (
        <div className="container mx-auto px-4 py-12 max-w-3xl">
            <Card className="border-red-500">
                <CardHeader>
                    <CardTitle className="text-red-600 flex items-center">
                        <ShieldAlert className="mr-2" />
                        Access Denied
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-lg">You do not have permission to edit this event's form. Only the event creator or a super admin can make changes.</p>
                    <Button onClick={() => router.push('/admin/events')} className="mt-4" variant="outline">
                        Back to Events
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => router.push('/admin/events')}
        className="mb-4"
      >
        <ArrowLeft size={20} className="mr-2" />
        Back to Events
      </Button>

      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Build Registration Form</h1>
        <p className="text-gray-600">for {event.title}</p>
      </div>

      <FormBuilder
        initialFields={event.form_fields || []}
        onSave={handleSave}
      />
    </div>
  )
}

export default function FormBuilderPage() {
  return (
    <ProtectedRoute>
      <FormBuilderContent />
    </ProtectedRoute>
  )
}