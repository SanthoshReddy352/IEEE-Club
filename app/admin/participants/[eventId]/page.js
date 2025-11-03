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
  // Stores the final list of fields, used for generating headers and CSV columns
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
        fetch(`/api/events/${params.eventId}`),
        fetch(`/api/participants/${params.eventId}`),
      ])

      const eventData = await eventRes.json()
      const participantsData = await participantsRes.json()
      
      let fields = [];
      let transformedParticipants = [];

      if (eventData.success && eventData.event) {
          setEvent(eventData.event)
          fields = eventData.event.form_fields || []
      }
      
      if (participantsData.success && participantsData.participants) {
          transformedParticipants = participantsData.participants
      }
      
      // --- CORE FIX: Data Transformation ---
      
      // 1. Create a map for UUID -> Label lookup from the event's form metadata
      const fieldIdToLabelMap = new Map();
      fields.forEach(f => {
          // Both key (the label) and ID (the UUID) are mapped to the display label
          fieldIdToLabelMap.set(f.label, f.label);
          fieldIdToLabelMap.set(f.id, f.label);
      });

      // 2. Transform the participant data: Replace UUID keys with human-readable labels
      const finalParticipants = transformedParticipants.map(p => {
          const transformedResponses = {};
          for (const [key, value] of Object.entries(p.responses)) {
              // Look up the key (UUID or Label) in the map. Fallback to the key itself if no match (safety)
              const label = fieldIdToLabelMap.get(key) || key;
              transformedResponses[label] = value;
          }
          return { ...p, responses: transformedResponses };
      });
      
      // 3. Final state update
      setParticipants(finalParticipants)
      // The headers are just the labels from the original schema
      setDynamicFields(fields.map(f => ({ label: f.label })));

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to robustly get the correct response value
  const getParticipantResponseValue = (participant, field) => {
      // 1. Try to look up using the new standardized key (field.label)
      let value = participant.responses[field.label];
      
      // 2. If not found, try the old key convention (field.id) for backward compatibility
      if ((value === undefined || value === null) && field.id) {
           value = participant.responses[field.id];
      }
      
      return value;
  };

  const exportToCSV = () => {
    if (participants.length === 0) {
      alert('No participants to export')
      return
    }

    // Use the determined column headers (labels) for the CSV
    const headers = ['S.No', 'Registration Date', ...dynamicFields.map(f => f.label)] // UPDATED CSV HEADER
    
    const rows = participants.map((p, index) => {
      const row = [
        index + 1,
        new Date(p.created_at).toLocaleString(),
      ]
      
      // Map responses using the field objects
      dynamicFields.forEach((field) => {
        let value = getParticipantResponseValue(p, field) || '';
        
        // Format boolean values
        if (typeof value === 'boolean') {
             value = value ? 'Yes' : 'No';
        }

        row.push(value)
      })
      
      // Escape cells containing commas/quotes for proper CSV format
      return row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    })

    const csvContent = [
      headers.join(','),
      ...rows,
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
    // MODIFIED: Changed label from '#' to 'S.No'
    { label: 'S.No', key: 'index', className: 'w-12' }, 
    { label: 'Registration Date', key: 'created_at', className: 'w-40' }
  ];
  
  // Combine fixed and dynamic headers 
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
                        <TableHead key={header.id || header.key || header.label} className={header.className}>
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
                          let value = getParticipantResponseValue(participant, field);
                          
                          // Format values for display
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