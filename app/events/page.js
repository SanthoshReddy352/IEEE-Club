'use client'

import { useEffect, useState } from 'react'
import EventCard from '@/components/EventCard'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'
import { parseISO } from 'date-fns' // Import parseISO

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [filteredEvents, setFilteredEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    filterEvents()
  }, [searchTerm, filter, events])

  const fetchEvents = async () => {
    try {
      // Ensure we always get the latest events and don't use a cached list
      const response = await fetch('/api/events', { cache: 'no-store' })
      const data = await response.json()
      if (data.success) {
        setEvents(data.events)
        setFilteredEvents(data.events)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterEvents = () => {
    let filtered = events
    const now = new Date();

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by status
    if (filter === 'active') {
      filtered = filtered.filter(event => {
        const eventEndDate = event.event_end_date ? parseISO(event.event_end_date) : null;
        const isCompleted = eventEndDate && now > eventEndDate;
        
        // Active = NOT completed AND admin has set is_active to true
        return !isCompleted && event.is_active;
      })
    } else if (filter === 'open') {
      filtered = filtered.filter(event => {
        const regStartDate = event.registration_start ? parseISO(event.registration_start) : null;
        const regEndDate = event.registration_end ? parseISO(event.registration_end) : null;
        const eventEndDate = event.event_end_date ? parseISO(event.event_end_date) : null;

        const isCompleted = eventEndDate && now > eventEndDate;
        
        // Check if registration is *actually* open based on dates
        const isWithinDateRange = regStartDate && regEndDate && now >= regStartDate && now < regEndDate;

        // "Registration Open" = admin toggle is on, it's within the date range, AND the event is not completed
        return event.registration_open && isWithinDateRange && !isCompleted;
      })
    }

    setFilteredEvents(filtered)
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">All Events</h1>
        <p className="text-gray-600">Browse and register for our hackathons and tech events</p>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <Input
            placeholder="Search events..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="open">Registration Open</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00629B]"></div>
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <p>
              {searchTerm || filter !== 'all'
                ? 'No events match your search criteria'
                : 'No events available at the moment'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}