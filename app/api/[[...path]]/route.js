import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // Added for scoped client

// Helper function to extract path segments
function getPathSegments(request) {
  const url = new URL(request.url)
  const pathname = url.pathname.replace('/api/', '')
  const segments = pathname.split('/').filter(Boolean)
  return segments
}

// Helper function to get query params
function getQueryParams(request) {
  const url = new URL(request.url)
  return Object.fromEntries(url.searchParams.entries())
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle OPTIONS request
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// Helper to get user from request header (Authorization: Bearer <token>)
async function getUser(request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: new Error('No Authorization header') }
  }

  const token = authHeader.split(' ')[1]
  // Create a new supabase client scoped to the user's JWT
  const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { 'Authorization': `Bearer ${token}` },
    },
  })
  
  const { data: { user }, error } = await userSupabase.auth.getUser()

  return { user, error }
}

// GET Handler
export async function GET(request) {
  try {
    const segments = getPathSegments(request)
    const params = getQueryParams(request)

    // GET /api/events - Get all events or filtered events
    if (segments[0] === 'events' && !segments[1]) {
      let query = supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })

      // Filter by active status
      if (params.active === 'true') {
        query = query.eq('is_active', true)
      }

      // Limit results
      if (params.limit) {
        query = query.limit(parseInt(params.limit))
      }

      const { data, error } = await query

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500, headers: corsHeaders }
        )
      }

      return NextResponse.json(
        { success: true, events: data },
        { headers: corsHeaders }
      )
    }

    // GET /api/events/:id - Get single event
    if (segments[0] === 'events' && segments[1]) {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', segments[1])
        .single()

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 404, headers: corsHeaders }
        )
      }

      return NextResponse.json(
        { success: true, event: data },
        { headers: corsHeaders }
      )
    }
    
    // NEW: GET /api/profile - Get current user profile
    if (segments[0] === 'profile') {
        const { user, error: authError } = await getUser(request)
        if (!user) {
            return NextResponse.json(
                { success: false, error: authError?.message || 'Unauthorized' },
                { status: 401, headers: corsHeaders }
            )
        }
        
        // Use the authenticated user's ID to fetch their profile
        const { data, error } = await supabase
          .from('profiles')
          .select('name, phone_number, created_at, updated_at')
          .eq('id', user.id)
          .maybeSingle()

        if (error) {
          return NextResponse.json(
            { success: false, error: error.message },
            { status: 500, headers: corsHeaders }
          )
        }

        return NextResponse.json(
          { success: true, profile: data || { id: user.id, name: '', phone_number: '', email: user.email } },
          { headers: corsHeaders }
        )
    }


    // GET /api/participants/:eventId - Get participants for an event
    if (segments[0] === 'participants' && segments[1] && segments[1] !== 'count') {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('event_id', segments[1])
        .order('created_at', { ascending: false })

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500, headers: corsHeaders }
        )
      }

      return NextResponse.json(
        { success: true, participants: data },
        { headers: corsHeaders }
      )
    }

    // GET /api/participants/count - Get total participant count
    if (segments[0] === 'participants' && segments[1] === 'count') {
      const { count, error } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500, headers: corsHeaders }
        )
      }

      return NextResponse.json(
        { success: true, count },
        { headers: corsHeaders }
      )
    }

    // Default GET - Health check
    if (segments.length === 0) {
      return NextResponse.json(
        { message: 'IEEE Club API - OK' },
        { headers: corsHeaders }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Route not found' },
      { status: 404, headers: corsHeaders }
    )
  } catch (error) {
    console.error('GET Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}

// POST Handler
export async function POST(request) {
  try {
    const segments = getPathSegments(request)
    const body = await request.json()

    // POST /api/events - Create new event
    if (segments[0] === 'events' && !segments[1]) {
      const eventData = {
        title: body.title,
        description: body.description,
        banner_url: body.banner_url,
        event_date: body.event_date || null,
        is_active: body.is_active !== undefined ? body.is_active : true,
        registration_open: body.registration_open !== undefined ? body.registration_open : true,
        form_fields: body.form_fields || [],
      }

      const { data, error } = await supabase
        .from('events')
        .insert([eventData])
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500, headers: corsHeaders }
        )
      }

      return NextResponse.json(
        { success: true, event: data },
        { headers: corsHeaders }
      )
    }

    // POST /api/participants - Create new participant registration
    if (segments[0] === 'participants' && !segments[1]) {
      const participantData = {
        event_id: body.event_id,
        responses: body.responses,
      }

      const { data, error } = await supabase
        .from('participants')
        .insert([participantData])
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500, headers: corsHeaders }
        )
      }

      return NextResponse.json(
        { success: true, participant: data },
        { headers: corsHeaders }
      )
    }

    // POST /api/contact - Submit contact form
    if (segments[0] === 'contact') {
      const contactData = {
        name: body.name,
        email: body.email,
        message: body.message,
      }

      const { data, error } = await supabase
        .from('contact_submissions')
        .insert([contactData])
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500, headers: corsHeaders }
        )
      }

      return NextResponse.json(
        { success: true, submission: data },
        { headers: corsHeaders }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Route not found' },
      { status: 404, headers: corsHeaders }
    )
  } catch (error) {
    console.error('POST Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}

// PUT Handler
export async function PUT(request) {
  try {
    const segments = getPathSegments(request)
    const body = await request.json()
    
    // NEW: PUT /api/profile - Update current user profile
    if (segments[0] === 'profile') {
        const { user, error: authError } = await getUser(request)
        if (!user) {
            return NextResponse.json(
                { success: false, error: authError?.message || 'Unauthorized' },
                { status: 401, headers: corsHeaders }
            )
        }
        
        const updateData = {
            id: user.id, // Primary key
            name: body.name,
            phone_number: body.phone_number,
            updated_at: new Date().toISOString()
        }

        // Use upsert to either insert a new row or update an existing one for the profile
        const { data, error } = await supabase
            .from('profiles')
            .upsert(updateData)
            .select()
            .single()

        if (error) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500, headers: corsHeaders }
            )
        }

        return NextResponse.json(
            { success: true, profile: data },
            { headers: corsHeaders }
        )
    }


    // PUT /api/events/:id - Update event
    if (segments[0] === 'events' && segments[1]) {
      const eventId = segments[1]
      const updateData = {}

      // Only update fields that are provided
      if (body.title !== undefined) updateData.title = body.title
      if (body.description !== undefined) updateData.description = body.description
      if (body.banner_url !== undefined) updateData.banner_url = body.banner_url
      if (body.event_date !== undefined) updateData.event_date = body.event_date
      if (body.is_active !== undefined) updateData.is_active = body.is_active
      if (body.registration_open !== undefined) updateData.registration_open = body.registration_open
      if (body.form_fields !== undefined) updateData.form_fields = body.form_fields

      updateData.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', eventId)
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500, headers: corsHeaders }
        )
      }

      return NextResponse.json(
        { success: true, event: data },
        { headers: corsHeaders }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Route not found' },
      { status: 404, headers: corsHeaders }
    )
  } catch (error) {
    console.error('PUT Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}

// DELETE Handler
export async function DELETE(request) {
  try {
    const segments = getPathSegments(request)

    // DELETE /api/events/:id - Delete event
    if (segments[0] === 'events' && segments[1]) {
      const eventId = segments[1]

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500, headers: corsHeaders }
        )
      }

      return NextResponse.json(
        { success: true, message: 'Event deleted successfully' },
        { headers: corsHeaders }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Route not found' },
      { status: 404, headers: corsHeaders }
    )
  } catch (error) {
    console.error('DELETE Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}