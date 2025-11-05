'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card' // MODIFIED
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Download, ShieldAlert } from 'lucide-react' // MODIFIED
import { format } from 'date-fns'
import { useAuth } from '@/context/AuthContext' // MODIFIED
import { supabase } from '@/lib/supabase/client' // MODIFIED

function ParticipantsContent() {
  const params = useParams()
  const router = useRouter()
  const [event, setEvent] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [dynamicFields, setDynamicFields] = useState([]) 
  const { user, isSuperAdmin, loading: authLoading } = useAuth() // MODIFIED

  useEffect(() => {
    if (params.eventId && user) { // MODIFIED: Wait for user
      fetchData()
    }
  }, [params.eventId, user]) // MODIFIED: re-run if user loads

  const fetchData = async () => {
    try {
      setLoading(true)
      // MODIFIED: Get session for authenticated API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
          throw new Error("User not authenticated");
      }
      
      const authHeader = { 'Authorization': `Bearer ${session.access_token}` };

      const [eventRes, participantsRes] = await Promise.all([
        fetch(`/api/events/${params.eventId}`), // Event fetch is public
        fetch(`/api/participants/${params.eventId}`, { headers: authHeader }), // Participants fetch is protected
      ])

      const eventData = await eventRes.json()
      const participantsData = await participantsRes.json()
      
      let fields = [];
      let transformedParticipants = [];

      if (eventData.success && eventData.event) {
          setEvent(eventData.event)
          fields = eventData.event.form_fields || []
      }
      
      // MODIFIED: Check for auth error on participants
      if (participantsRes.status === 403) {
          console.warn("Access denied to participants list.");
          // Event data loaded, but participant data is forbidden
          // The component's render logic will handle the access denied message
          setLoading(false);
          return; 
      }

      if (participantsData.success && participantsData.participants) {
          transformedParticipants = participantsData.participants
      }
      
      const fieldIdToLabelMap = new Map();
      fields.forEach(f => {
          fieldIdToLabelMap.set(f.label, f.label);
          fieldIdToLabelMap.set(f.id, f.label);
      });

      const finalParticipants = transformedParticipants.map(p => {
          const transformedResponses = {};
          if (p.responses) { // Add check for null responses
              for (const [key, value] of Object.entries(p.responses)) {
                  const label = fieldIdToLabelMap.get(key) || key;
                  transformedResponses[label] = value;
              }
          }
          return { ...p, responses: transformedResponses };
      });
      
      setParticipants(finalParticipants)
      setDynamicFields(fields.map(f => ({ label: f.label, id: f.id }))); // MODIFIED: Pass ID too

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getParticipantResponseValue = (participant, field) => {
      let value = participant.responses[field.label];
      
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

    const headers = ['S.No', 'Registration Date', ...dynamicFields.map(f => f.label)] 
    
    const rows = participants.map((p, index) => {
      const row = [
        index + 1,
        new Date(p.created_at).toLocaleString(),
      ]
      
      dynamicFields.forEach((field) => {
        let value = getParticipantResponseValue(p, field) || '';
        
        if (typeof value === 'boolean') {
             value = value ? 'Yes' : 'No';
        }

        row.push(value)
      })
      
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

  // MODIFIED: Include authLoading
  if (loading || authLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00629B]"></div>
      </div>
    )
  }

  // MODIFIED: Add permission check
  const canManage = event && user && (isSuperAdmin || event.created_by === user.id);
  if (!loading && !authLoading && event && !canManage) {
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
                    <p className="text-lg">You do not have permission to view participants for this event. Only the event creator or a super admin can access this list.</p>
                    <Button onClick={() => router.push('/admin/events')} className="mt-4" variant="outline">
                        Back to Events
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
  }
  
  // --- RENDERING LOGIC ---
  
  const fixedHeaders = [
    { label: 'S.No', key: 'index', className: 'w-12' }, 
    { label: 'Registration Date', key: 'created_at', className: 'w-40' }
  ];
  
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
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(participant.created_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>

                      {dynamicFields.map((field) => {
                          let value = getParticipantResponseValue(participant, field);
                          
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