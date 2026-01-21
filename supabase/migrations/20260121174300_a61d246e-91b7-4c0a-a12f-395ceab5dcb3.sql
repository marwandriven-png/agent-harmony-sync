-- Add lead_type enum
CREATE TYPE public.lead_type AS ENUM ('buyer', 'landlord', 'tenant');

-- Add new columns to leads table
ALTER TABLE public.leads
ADD COLUMN building_name text,
ADD COLUMN area_name text,
ADD COLUMN lead_type public.lead_type DEFAULT 'buyer';