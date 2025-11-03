'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Upload, Link as LinkIcon } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { supabase } from '@/lib/supabase/client'

// Helper to convert datetime-local string (YYYY-MM-DDTHH:MM) back to ISO format (UTC)
const toISOString = (dateTimeLocalString) => {
    if (!dateTimeLocalString) return null;
    // Append ':00Z' to treat the input time as UTC, which is required by the Supabase DB.
    return new Date(dateTimeLocalString + ':00Z').toISOString();
}

function CreateEventContent() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: '',
    is_active: true,
    registration_open: true,
    registration_start: '', 
    registration_end: '',   
  })
  const [bannerMode, setBannerMode] = useState('url') // 'url' or 'upload'
  const [bannerUrl, setBannerUrl] = useState('')
  const [bannerFile, setBannerFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

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
      let finalBannerUrl = ''

      if (bannerMode === 'upload' && bannerFile) {
        finalBannerUrl = await uploadBanner()
      } else if (bannerMode === 'url') {
        finalBannerUrl = bannerUrl
      }

      // Convert datetime-local strings back to ISO strings for database ingestion
      const eventData = {
        ...formData,
        banner_url: finalBannerUrl,
        form_fields: [],
        event_date: toISOString(formData.event_date),
        registration_start: toISOString(formData.registration_start),
        registration_end: toISOString(formData.registration_end),
      }

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      })

      const data = await response.json()
      if (data.success) {
        // Redirect to form builder after successful creation
        router.push(`/admin/events/${data.event.id}/form-builder`)
      } else {
        alert('Failed to create event')
        console.error('API Error:', data.error);
      }
    } catch (error) {
      console.error('Error creating event:', error)
      alert('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-4xl font-bold mb-8">Create New Event</h1>

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
                placeholder="e.g., HackIEEE 2025"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Event description, rules, prizes, etc."
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_date">Event Date & Time</Label>
              <Input
                id="event_date"
                type="datetime-local"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
              />
            </div>
            
            {/* Registration Start Date */}
            <div className="space-y-2">
              <Label htmlFor="registration_start">Registration Start Date & Time</Label>
              <Input
                id="registration_start"
                type="datetime-local"
                value={formData.registration_start}
                onChange={(e) => setFormData({ ...formData, registration_start: e.target.value })}
              />
            </div>

            {/* Registration End Date */}
            <div className="space-y-2">
              <Label htmlFor="registration_end">Registration End Date & Time</Label>
              <Input
                id="registration_end"
                type="datetime-local"
                value={formData.registration_end}
                onChange={(e) => setFormData({ ...formData, registration_end: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active" className="font-normal">
                  Event is Active (visible on website)
                </Label>
              </div>
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
                Upload File
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
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-[#00629B] bg-blue-50' : 'border-gray-300'
                }`}
              >
                <input {...getInputProps()} />
                <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                {bannerFile ? (
                  <p className="text-sm">
                    Selected: <strong>{bannerFile.name}</strong>
                  </p>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      {isDragActive
                        ? 'Drop the image here'
                        : 'Drag & drop an image, or click to select'}
                    </p>
                    <p className="text-xs text-gray-400">PNG, JPG, WEBP up to 10MB</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-[#00629B] hover:bg-[#004d7a]"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create & Build Form'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function CreateEventPage() {
  return (
    <ProtectedRoute>
      <CreateEventContent />
    </ProtectedRoute>
  )
}