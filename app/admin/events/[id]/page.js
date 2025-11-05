'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Upload, Link as LinkIcon, ShieldAlert } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext' // MODIFIED: Import useAuth

// Helper to convert ISO string (from DB) to local datetime-local format
const toDateTimeLocal = (isoString) => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return localDate.toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

// Helper to convert datetime-local string (from input) back to ISO format (UTC)
const toISOString = (dateTimeLocalString) => {
    if (!dateTimeLocalString) return null;
    return new Date(dateTimeLocalString).toISOString();
}

// MODIFIED: Renamed component
function EditEventContent() {
  const params = useParams()
  const router = useRouter()
  const [event, setEvent] = useState(null) // MODIFIED: Store full event object
  const [loading, setLoading] = useState(true)
  const [found, setFound] = useState(false) 
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: '',
    event_end_date: '',
    is_active: true,
    registration_open: true,
    registration_start: '',
    registration_end: '',
    banner_url: '',
  })
  const [bannerMode, setBannerMode] = useState('url')
  const [bannerUrl, setBannerUrl] = useState('')
  const [bannerFile, setBannerFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // MODIFIED: Get auth state
  const { user, isSuperAdmin, loading: authLoading } = useAuth()

  const fetchEvent = useCallback(async () => {
    if (!params.id) return;
    try {
      const response = await fetch(`/api/events/${params.id}`)
      const data = await response.json()
      if (data.success) {
        const event = data.event
        setEvent(event) // MODIFIED: Store full event
        
        setFormData({
          title: event.title,
          description: event.description || '',
          event_date: toDateTimeLocal(event.event_date),
          event_end_date: toDateTimeLocal(event.event_end_date),
          is_active: event.is_active,
          registration_open: event.registration_open,
          registration_start: toDateTimeLocal(event.registration_start), 
          registration_end: toDateTimeLocal(event.registration_end),     
          banner_url: event.banner_url || '',
        })
        setBannerUrl(event.banner_url || '')
        setFound(true)
      } else {
        setFound(false)
      }
    } catch (error) {
      console.error('Error fetching event:', error)
      setFound(false)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (params.id) {
      fetchEvent()
    }
  }, [params.id, fetchEvent])

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setBannerFile(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
  })

  const uploadBanner = async () => {
    if (!bannerFile) return null

    const fileExt = bannerFile.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${fileName}`

    const { data, error } = await supabase.storage
      .from('event-banners')
      .upload(filePath, bannerFile)

    if (error) {
      console.error('Upload error:', error)
      throw error
    }

    const { data: { publicUrl } } = supabase.storage
      .from('event-banners')
      .getPublicUrl(filePath)

    return publicUrl
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      let finalBannerUrl = formData.banner_url

      if (bannerMode === 'upload' && bannerFile) {
        finalBannerUrl = await uploadBanner()
      } else if (bannerMode === 'url') {
        finalBannerUrl = bannerUrl
      }

      const eventData = {
        ...formData,
        banner_url: finalBannerUrl,
        event_date: toISOString(formData.event_date),
        event_end_date: toISOString(formData.event_end_date),
        registration_start: toISOString(formData.registration_start),
        registration_end: toISOString(formData.registration_end),
      }
      
      // MODIFIED: Pass auth token for PUT
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/events/${params.id}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(eventData),
      })

      const data = await response.json()
      if (data.success) {
        alert('Event updated successfully!')
        router.push('/admin/events')
      } else {
        alert(`Failed to update event: ${data.error}`) 
        console.error('API Error:', data.error);
      }
    } catch (error) {
      console.error('Error updating event:', error)
      alert('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // MODIFIED: Include authLoading in check
  if (loading || authLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00629B]"></div>
      </div>
    )
  }
  
  if (!found) {
    return (
        <div className="container mx-auto px-4 py-12 max-w-3xl">
            <Card>
                <CardHeader>
                    <CardTitle className="text-red-600">Error</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-lg">Event not found or an error occurred while loading. Please check the event ID.</p>
                    <Button onClick={() => router.push('/admin/events')} className="mt-4">
                        Go Back to Events List
                    </Button>
                </CardContent>
            </Card>
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
                    <p className="text-lg">You do not have permission to edit this event. Only the event creator or a super admin can make changes.</p>
                    <Button onClick={() => router.push('/admin/events')} className="mt-4" variant="outline">
                        Back to Events
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
  }

  // If we reach here, user has permission
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-4xl font-bold mb-8">Edit Event</h1>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={6}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event_date">Event Start Date & Time</Label>
                <Input
                  id="event_date"
                  type="datetime-local"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_end_date">Event End Date & Time</Label>
                <Input
                  id="event_end_date"
                  type="datetime-local"
                  value={formData.event_end_date}
                  onChange={(e) => setFormData({ ...formData, event_end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="registration_start">Registration Start Date & Time</Label>
                <Input
                  id="registration_start"
                  type="datetime-local"
                  value={formData.registration_start}
                  onChange={(e) => setFormData({ ...formData, registration_start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registration_end">Registration End Date & Time</Label>
                <Input
                  id="registration_end"
                  type="datetime-local"
                  value={formData.registration_end}
                  onChange={(e) => setFormData({ ...formData, registration_end: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active" className="font-normal">
                Event is Active
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="registration_open"
                checked={formData.registration_open}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, registration_open: checked })
                }
              />
              <Label htmlFor="registration_open" className="font-normal">
                Registration is Open
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Event Banner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.banner_url && (
              <div className="mb-4">
                <Label className="mb-2 block">Current Banner</Label>
                <img
                  src={formData.banner_url}
                  alt="Current banner"
                  className="w-full h-48 object-cover rounded-lg"
                />
              </div>
            )}

            <div className="flex space-x-4 mb-4">
              <Button
                type="button"
                variant={bannerMode === 'url' ? 'default' : 'outline'}
                onClick={() => setBannerMode('url')}
                className={bannerMode === 'url' ? 'bg-[#00629B]' : ''}
              >
                <LinkIcon size={16} className="mr-2" />
                Use URL
              </Button>
              <Button
                type="button"
                variant={bannerMode === 'upload' ? 'default' : 'outline'}
                onClick={() => setBannerMode('upload')}
                className={bannerMode === 'upload' ? 'bg-[#00629B]' : ''}
              >
                <Upload size={16} className="mr-2" />
                Upload New
              </Button>
            </div>

            {bannerMode === 'url' ? (
              <div className="space-y-2">
                <Label htmlFor="banner_url">Banner URL</Label>
                <Input
                  id="banner_url"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                />
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${
                  isDragActive ? 'border-[#00629B] bg-blue-50' : 'border-gray-300'
                }`}
              >
                <input {...getInputProps()} />
                <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                {bannerFile ? (
                  <p className="text-sm">Selected: <strong>{bannerFile.name}</strong></p>
                ) : (
                  <p className="text-sm text-gray-600">
                    {isDragActive ? 'Drop here' : 'Drag & drop or click to select new image'}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-[#00629B] hover:bg-[#004d7a]"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Updating...' : 'Update Event'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function EditEventPage() {
  return (
    <ProtectedRoute>
      <EditEventContent />
    </ProtectedRoute>
  )
}