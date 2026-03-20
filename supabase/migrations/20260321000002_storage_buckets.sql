-- ── Storage bucket for salon logos ────────────────────────────
-- Creates a public bucket so logo URLs can be used in <img> tags
-- without auth headers. Each tenant stores one file at:
--   salon-logos/{tenant_id}/logo.{ext}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'salon-logos',
  'salon-logos',
  true,                                        -- public = URLs are readable without auth
  2097152,                                     -- 2 MB max
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone authenticated can upload/update their own tenant's logo
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'salon-logos');

CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'salon-logos');

CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'salon-logos');

CREATE POLICY "Authenticated users can delete their logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'salon-logos');
