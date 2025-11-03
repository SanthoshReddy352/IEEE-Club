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
    is_active BOOLEAN DEFAULT true,
    registration_open BOOLEAN DEFAULT true,
    registration_start TIMESTAMP WITH TIME ZONE, -- NEW FIELD for start date
    registration_end TIMESTAMP WITH TIME ZONE,   -- NEW FIELD for end date
    form_fields JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- Add admin_users table to public schema for role management
CREATE TABLE IF NOT EXISTS admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_admin BOOLEAN DEFAULT TRUE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
DROP POLICY IF EXISTS "Authenticated users can manage events" ON events;
DROP POLICY IF EXISTS "Participants can be created by authenticated users" ON participants;
DROP POLICY IF EXISTS "Participants are viewable by authenticated users" ON participants;
DROP POLICY IF EXISTS "Contact submissions can be created by anyone" ON contact_submissions;
DROP POLICY IF EXISTS "Contact submissions are viewable by authenticated users" ON contact_submissions;
DROP POLICY IF EXISTS "Authenticated users can read their own admin status" ON admin_users;
DROP POLICY IF EXISTS "Service role can manage all admin users" ON admin_users;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create and update their own profile" ON profiles;


-- RLS Policies for events
CREATE POLICY "Events are viewable by everyone"
    ON events FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can manage events"
    ON events FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for participants
CREATE POLICY "Participants can be created by authenticated users"
    ON participants FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Participants are viewable by authenticated users"
    ON participants FOR SELECT
    USING (auth.role() = 'authenticated');

-- RLS Policies for contact_submissions
CREATE POLICY "Contact submissions can be created by anyone"
    ON contact_submissions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Contact submissions are viewable by authenticated users"
    ON contact_submissions FOR SELECT
    USING (auth.role() = 'authenticated');

-- RLS Policies for admin_users
CREATE POLICY "Authenticated users can read their own admin status"
    ON admin_users FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all admin users"
    ON admin_users FOR ALL
    USING (auth.role() = 'service_role') 
    WITH CHECK (auth.role() = 'service_role');

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
DROP POLICY IF EXISTS "Authenticated users can upload event banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update event banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete event banners" ON storage.objects;

-- Storage policies
CREATE POLICY "Event banners are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'event-banners');

CREATE POLICY "Authenticated users can upload event banners"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'event-banners' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update event banners"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'event-banners' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete event banners"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'event-banners' AND auth.role() = 'authenticated');


-- ====================================================================
-- INDEXES
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_events_is_active ON events(is_active);
CREATE INDEX IF NOT EXISTS idx_participants_event_id ON participants(event_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);