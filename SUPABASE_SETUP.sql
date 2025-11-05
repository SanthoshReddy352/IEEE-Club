-- IEEE Club Hackathon Website Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- DROP TABLES (Must be dropped first due to foreign key constraints)
-- ====================================================================

-- Drop dependent tables first
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS contact_submissions CASCADE;
DROP TABLE IF EXISTS events CASCADE;

-- Drop helper function if it exists
DROP FUNCTION IF EXISTS public.get_admin_role() CASCADE; -- <<< FIX IS HERE

-- ====================================================================
-- CORE TABLES
-- ====================================================================

-- Create events table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    banner_url TEXT,
    event_date TIMESTAMP WITH TIME ZONE,
    event_end_date TIMESTAMP WITH TIME ZONE, -- This column is now included
    is_active BOOLEAN DEFAULT true,
    registration_open BOOLEAN DEFAULT true,
    registration_start TIMESTAMP WITH TIME ZONE,
    registration_end TIMESTAMP WITH TIME ZONE,
    form_fields JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- NEW: Track which admin created the event
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create participants table (Recreated to include user_id and UNIQUE constraint)
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to authenticated user
    responses JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (event_id, user_id) -- Enforce one registration per user per event
);

-- Create contact_submissions table
CREATE TABLE IF NOT EXISTS contact_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MODIFIED: Add admin_users table with ROLE instead of boolean
CREATE TABLE IF NOT EXISTS admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin', -- 'admin' or 'super_admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT admin_role_check CHECK (role IN ('admin', 'super_admin'))
);

-- Add profiles table for general user data (non-admin)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    phone_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- HELPER FUNCTION
-- ====================================================================

-- NEW: Helper function to get the current authenticated user's admin role
CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS TEXT AS $$
DECLARE
  admin_role TEXT;
BEGIN
  SELECT role INTO admin_role
  FROM public.admin_users
  WHERE user_id = auth.uid();
  
  RETURN admin_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================================================
-- RLS SETUP
-- ====================================================================

-- Enable Row Level Security (RLS)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;


-- Drop existing policies (for idempotency)
DROP POLICY IF EXISTS "Events are viewable by everyone" ON events;
DROP POLICY IF EXISTS "Admins can create events" ON events;
DROP POLICY IF EXISTS "Event owners or super admins can update events" ON events;
DROP POLICY IF EXISTS "Event owners or super admins can delete events" ON events;

DROP POLICY IF EXISTS "Participants can be created by authenticated users" ON participants;
DROP POLICY IF EXISTS "Admins can view participants for events they own (or if super admin)" ON participants;
DROP POLICY IF EXISTS "Users can view their own participant records" ON participants;

DROP POLICY IF EXISTS "Contact submissions can be created by anyone" ON contact_submissions;
DROP POLICY IF EXISTS "Contact submissions are viewable by authenticated users" ON contact_submissions;

DROP POLICY IF EXISTS "Authenticated users can read their own admin status" ON admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin users" ON admin_users; -- MODIFIED

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create and update their own profile" ON profiles;


-- RLS Policies for events
CREATE POLICY "Events are viewable by everyone"
    ON events FOR SELECT
    USING (true);

-- MODIFIED: Only admins can create
CREATE POLICY "Admins can create events"
    ON events FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND public.get_admin_role() IS NOT NULL);

-- MODIFIED: Only owner or super_admin can update
CREATE POLICY "Event owners or super admins can update events"
    ON events FOR UPDATE
    USING (public.get_admin_role() = 'super_admin' OR created_by = auth.uid());

-- MODIFIED: Only owner or super_admin can delete
CREATE POLICY "Event owners or super admins can delete events"
    ON events FOR DELETE
    USING (public.get_admin_role() = 'super_admin' OR created_by = auth.uid());

-- RLS Policies for participants
CREATE POLICY "Participants can be created by authenticated users"
    ON participants FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- MODIFIED: Stricter policy for viewing participants
CREATE POLICY "Admins can view participants for events they own (or if super admin)"
    ON participants FOR SELECT
    USING (
        (public.get_admin_role() = 'super_admin') OR
        (EXISTS (
            SELECT 1 FROM events
            WHERE events.id = participants.event_id AND events.created_by = auth.uid()
        ))
    );

-- NEW: Allow users to see their *own* registration
CREATE POLICY "Users can view their own participant records"
    ON participants FOR SELECT
    USING (user_id = auth.uid());

-- RLS Policies for contact_submissions
CREATE POLICY "Contact submissions can be created by anyone"
    ON contact_submissions FOR INSERT
    WITH CHECK (true);

-- MODIFIED: Only admins can view submissions
CREATE POLICY "Contact submissions are viewable by admins"
    ON contact_submissions FOR SELECT
    USING (public.get_admin_role() IS NOT NULL);

-- RLS Policies for admin_users
CREATE POLICY "Authenticated users can read their own admin status"
    ON admin_users FOR SELECT
    USING (auth.uid() = user_id);

-- MODIFIED: Only super_admin can manage other admins
CREATE POLICY "Super admins can manage admin users"
    ON admin_users FOR ALL
    USING (public.get_admin_role() = 'super_admin') 
    WITH CHECK (public.get_admin_role() = 'super_admin');

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can create and update their own profile"
    ON profiles FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ====================================================================
-- STORAGE BUCKET & POLICIES
-- ====================================================================

-- Create storage bucket for event banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-banners', 'event-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies (for idempotency)
DROP POLICY IF EXISTS "Event banners are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload event banners" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update event banners" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete event banners" ON storage.objects;

-- Storage policies
CREATE POLICY "Event banners are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'event-banners');

-- MODIFIED: Only admins can upload
CREATE POLICY "Admins can upload event banners"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'event-banners' AND public.get_admin_role() IS NOT NULL);

-- MODIFIED: Only admins can update
CREATE POLICY "Admins can update event banners"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'event-banners' AND public.get_admin_role() IS NOT NULL);

-- MODIFIED: Only admins can delete
CREATE POLICY "Admins can delete event banners"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'event-banners' AND public.get_admin_role() IS NOT NULL);


-- ====================================================================
-- INDEXES
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_events_is_active ON events(is_active);
CREATE INDEX IF NOT EXISTS idx_participants_event_id ON participants(event_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
-- NEW: Index for event owner
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
-- NEW: Index for participant user
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);