'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Download } from 'lucide-react'
import { format } from 'date-fns'

function ParticipantsContent() {
  const params = useParams()
  const router = useRouter()
  const [event, setEvent] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  // Stores { label: string, key: string } objects derived from form_fields
  const [dynamicFields, setDynamicFields] = useState([]) 

  useEffect(() => {
    if (params.eventId) {
      fetchData()
    }
  }, [params.eventId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [eventRes, participantsRes] = await Promise.all([
        // Fetch event details to get the form schema
        fetch(`/api/events/${params.eventId}`),
        // Fetch all participants
        fetch(`/api/participants/${params.eventId}`),
      ])

      const eventData = await eventRes.json()
      const participantsData = await participantsRes.json()
      
      let fields = [];

      if (eventData.success && eventData.event) {
          setEvent(eventData.event)
          fields = eventData.event.form_fields || []
      }
      
      if (participantsData.success && participantsData.participants) {
          setParticipants(participantsData.participants)
      }
      
      // NEW MAPPING: Create a list of objects containing the header label and the actual key 
      // used in the database (which is either the field ID or the label from DynamicForm.js logic)
      const dynamicHeaders = fields.map(field => ({
          label: field.label,
          // The key used in participant.responses is stored in form_fields.id or form_fields.label
          // Based on components/DynamicForm.js, the key stored in 'responses' is field.id || field.label.
          // We will use field.label for lookup, as it should be consistent, but we need to ensure 
          // the *actual key* from the response object is used if possible. 
          // Since the user is editing the labels, we trust the labels are the keys for now.
          // To be robust, we'll try to find a matching label in the stored response keys if the response keys are IDs.
          // For now, let's stick to the convention set by DynamicForm.js:
          key: field.label 
      }));
      setDynamicFields(dynamicHeaders)

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (participants.length === 0) {
      alert('No participants to export')
      return
    }

    // Use the determined column headers (labels) for the CSV
    const headers = ['#', 'Registration Date', ...dynamicFields.map(f => f.label)]
    
    const rows = participants.map((p, index) => {
      const row = [
        index + 1,
        new Date(p.created_at).toLocaleString(),
      ]
      
      // Map responses using the field labels
      dynamicFields.forEach((field) => {
        let value = p.responses[field.label] || '';
        
        // Format boolean values
        if (typeof value === 'boolean') {
             value = value ? 'Yes' : 'No';
        }

        row.push(value)
      })
      return row
    })

    const csvContent = [
      headers.join(','),
      // Escape cells containing commas/quotes for proper CSV format
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event?.title || 'event'}-participants.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00629B]"></div>
      </div>
    )
  }

  // --- RENDERING LOGIC ---
  
  // Base columns always shown
  const fixedHeaders = [
    { label: '#', key: 'index', className: 'w-12' },
    { label: 'Registration Date', key: 'created_at', className: 'w-40' }
  ];
  
  // Combine fixed and dynamic headers (using label for display and key for lookup)
  const allHeaders = [
    ...fixedHeaders,
    ...dynamicFields
  ];


  return (
    <div className="container mx-auto px-4 py-12">
      <Button
        variant="ghost"
        onClick={() => router.push('/admin/events')}
        className="mb-4"
      >
        <ArrowLeft size={20} className="mr-2" />
        Back to Events
      </Button>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold">Participants</h1>
          <p className="text-gray-600 mt-2">{event?.title}</p>
        </div>
        {participants.length > 0 && (
          <Button
            onClick={exportToCSV}
            className="bg-[#00629B] hover:bg-[#004d7a]"
          >
            <Download size={20} className="mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      {participants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <p>No participants yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Total Registrations: {participants.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {allHeaders.map((header) => (
                        <TableHead key={header.key || header.label} className={header.className}>
                            {header.label}
                        </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant, index) => (
                    <TableRow key={participant.id}>
                      {/* Fixed Columns */}
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(participant.created_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>

                      {/* Dynamic Response Columns */}
                      {dynamicFields.map((field) => {
                          // CORRECTED: Look up value using field.label/key
                          let value = participant.responses[field.label] || '';
                          
                          // Format boolean values for display
                          if (typeof value === 'boolean') {
                              value = value ? (
                                  <span className="text-green-600 font-medium">Yes</span>
                              ) : (
                                  <span className="text-red-600">No</span>
                              );
                          } else if (value === '' || value === null || value === undefined) {
                              value = <span className="text-gray-400">-</span>;
                          }

                          return (
                              <TableCell key={`${participant.id}-${field.label}`} className="text-sm">
                                  {value}
                              </TableCell>
                          );
                      })}
                      
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function ParticipantsPage() {
  return (
    <ProtectedRoute>
      <ParticipantsContent />
    </ProtectedRoute>
  )
}