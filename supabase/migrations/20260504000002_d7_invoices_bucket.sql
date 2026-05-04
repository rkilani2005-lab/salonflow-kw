-- ====================================================================
-- D.7  Invoice PDF storage bucket
-- ====================================================================
-- The invoice-pdf edge function generates per-transaction PDFs and
-- stores them in this bucket so the WhatsApp agent (and any other
-- caller) can deliver them as document messages.
--
-- File path convention:  {tenant_id}/{transaction_id}.pdf
--
-- The bucket is PRIVATE.  Edge functions use the service role to
-- read+write.  When the AI agent dispatches a PDF over WhatsApp it
-- generates a short-lived (24h) signed URL — Baileys downloads from
-- that URL, the message goes out, the URL expires.  Clients who
-- reach the URL inside the window get the PDF; after expiry the
-- file stays in storage but is unreachable without re-signing.
-- ====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

-- Tenant-scoped read for authenticated users.  Path layout
-- {tenant_id}/{transaction_id}.pdf, so the first folder of the
-- object name is the tenant id we authorise against.
create policy "Tenant SELECT on invoices bucket"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
  );

-- Service role bypasses RLS so edge functions can write/read freely;
-- no INSERT/UPDATE/DELETE policy for authenticated users — we don't
-- want clients overwriting invoices from the browser.
