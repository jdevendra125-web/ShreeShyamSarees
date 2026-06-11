-- Run this SQL in your Supabase SQL Editor to create the table

CREATE TABLE IF NOT EXISTS visitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  place TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  sms_status TEXT DEFAULT 'pending' -- 'pending', 'redirected', 'manual'
);

-- Enable Row Level Security (RLS)
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all inserts (public registration)
CREATE POLICY "Allow public insert" ON visitors
  FOR INSERT WITH CHECK (true);

-- Create policy to allow all select (public read - or you can restrict it if needed)
CREATE POLICY "Allow public select" ON visitors
  FOR SELECT USING (true);

-- Create policy to allow update (for marking status as redirected)
CREATE POLICY "Allow public update" ON visitors
  FOR UPDATE USING (true);
