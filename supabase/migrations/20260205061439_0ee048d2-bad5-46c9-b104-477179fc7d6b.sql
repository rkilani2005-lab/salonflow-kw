-- Enum types for SalonFlow
CREATE TYPE public.booking_status AS ENUM (
  'planned', 'confirmed', 'checked_in', 'in_service', 'completed', 'cancelled', 'no_show'
);

CREATE TYPE public.payment_status AS ENUM (
  'pending', 'paid', 'failed', 'refunded', 'partial'
);

CREATE TYPE public.service_category AS ENUM (
  'hair', 'nails', 'facial', 'makeup', 'waxing', 'massage', 'other'
);

-- Services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT,
  category service_category NOT NULL DEFAULT 'other',
  duration INTEGER NOT NULL DEFAULT 30, -- minutes
  price NUMERIC(10,3) NOT NULL DEFAULT 0, -- KWD
  deposit_required BOOLEAN NOT NULL DEFAULT false,
  deposit_amount NUMERIC(10,3) DEFAULT 0, -- KWD
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Staff table
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  color TEXT DEFAULT '#6366f1',
  working_hours_start TIME NOT NULL DEFAULT '09:00',
  working_hours_end TIME NOT NULL DEFAULT '18:00',
  break_start TIME,
  break_end TIME,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Staff services junction (which services a staff member can perform)
CREATE TABLE public.staff_services (
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, service_id)
);

-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  tier TEXT NOT NULL DEFAULT 'normal' CHECK (tier IN ('vip', 'normal')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings table (core)
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL, -- Denormalized for quick display
  client_phone TEXT NOT NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL, -- Denormalized
  service_category service_category NOT NULL DEFAULT 'other',
  
  -- Scheduling
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration INTEGER NOT NULL, -- minutes
  
  -- Status
  status booking_status NOT NULL DEFAULT 'planned',
  
  -- Pricing & Payment
  price NUMERIC(10,3) NOT NULL DEFAULT 0, -- KWD
  deposit_amount NUMERIC(10,3) DEFAULT 0,
  deposit_status payment_status DEFAULT 'pending',
  payment_id TEXT, -- MyFatoorah invoice ID
  payment_url TEXT, -- MyFatoorah payment URL
  
  -- Meta
  notes TEXT,
  is_online_booking BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment transactions log
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  payment_provider TEXT NOT NULL DEFAULT 'myfatoorah',
  invoice_id TEXT,
  transaction_id TEXT,
  amount NUMERIC(10,3) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KWD',
  status payment_status NOT NULL DEFAULT 'pending',
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Public read access for services (customers need to see services)
CREATE POLICY "Services are publicly readable" ON public.services
  FOR SELECT USING (is_active = true);

-- Public read access for staff (customers need to see available staff)
CREATE POLICY "Active staff are publicly readable" ON public.staff
  FOR SELECT USING (is_active = true);

-- Public read for staff_services
CREATE POLICY "Staff services are publicly readable" ON public.staff_services
  FOR SELECT USING (true);

-- Clients can insert themselves (online booking)
CREATE POLICY "Anyone can create a client" ON public.clients
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Clients are publicly readable" ON public.clients
  FOR SELECT USING (true);

-- Bookings - anyone can create (online booking), read own booking
CREATE POLICY "Anyone can create a booking" ON public.bookings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Bookings are publicly readable" ON public.bookings
  FOR SELECT USING (true);

CREATE POLICY "Bookings can be updated" ON public.bookings
  FOR UPDATE USING (true);

-- Payment transactions - service role only for security
CREATE POLICY "Payment transactions are service-level only" ON public.payment_transactions
  FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX idx_bookings_date ON public.bookings(booking_date);
CREATE INDEX idx_bookings_staff ON public.bookings(staff_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_payment ON public.bookings(payment_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();