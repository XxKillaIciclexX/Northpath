/*
  # Create email subscribers table

  1. New Tables
    - `email_subscribers`
      - `id` (uuid, primary key)
      - `email` (text, unique, not null)
      - `subscribed_at` (timestamp with timezone, default now())
      - `is_active` (boolean, default true)
      - `source` (text, default 'coming_soon')

  2. Security
    - Enable RLS on `email_subscribers` table
    - Add policy for inserting new subscribers (public access)
    - Add policy for reading subscribers (authenticated users only)

  3. Indexes
    - Add index on email for faster lookups
    - Add index on subscribed_at for sorting
*/

CREATE TABLE IF NOT EXISTS email_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  subscribed_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  source text DEFAULT 'coming_soon'
);

-- Enable Row Level Security
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;

-- Policy to allow anyone to insert new subscribers
CREATE POLICY "Anyone can subscribe"
  ON email_subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy to allow authenticated users to read subscribers
CREATE POLICY "Authenticated users can read subscribers"
  ON email_subscribers
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy to allow authenticated users to update subscriber status
CREATE POLICY "Authenticated users can update subscribers"
  ON email_subscribers
  FOR UPDATE
  TO authenticated
  USING (true);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_subscribers_email ON email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_subscribed_at ON email_subscribers(subscribed_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_active ON email_subscribers(is_active) WHERE is_active = true;