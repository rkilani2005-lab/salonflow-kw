-- =====================================================================
-- Workflow Upgrades — Phase 1
-- =====================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pending_retail JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.bookings.pending_retail IS
  'Retail products staged during the appointment (from AppointmentDetailSheet). '
  'Drained into the POS cart at checkout and cleared after the sale completes. '
  'JSON shape mirrors CartItem.';

ALTER TABLE public.transaction_payments
  ADD COLUMN IF NOT EXISTS payer_index INTEGER,
  ADD COLUMN IF NOT EXISTS payer_label TEXT;

COMMENT ON COLUMN public.transaction_payments.payer_index IS
  '1-based payer position within a split bill. NULL or 1 = primary/only payer. '
  '2..N = additional payers in the same sale.';
COMMENT ON COLUMN public.transaction_payments.payer_label IS
  'Optional human label for the payer (e.g. "Layla", "Friend 2"). '
  'Falls back to "Payer N" on receipts when blank.';

CREATE OR REPLACE VIEW public.transaction_payers_v1 AS
SELECT
  tp.transaction_id,
  COALESCE(tp.payer_index, 1)              AS payer_index,
  COALESCE(NULLIF(tp.payer_label, ''),
           'Payer ' || COALESCE(tp.payer_index, 1)::text) AS payer_label,
  COUNT(*)                                  AS payment_count,
  SUM(tp.amount)                            AS payer_total,
  ARRAY_AGG(tp.payment_method ORDER BY tp.id) AS payment_methods,
  ARRAY_AGG(tp.id ORDER BY tp.id)           AS payment_ids
FROM public.transaction_payments tp
GROUP BY tp.transaction_id, COALESCE(tp.payer_index, 1), tp.payer_label;

CREATE INDEX IF NOT EXISTS idx_transaction_payments_payer
  ON public.transaction_payments(transaction_id, payer_index)
  WHERE payer_index IS NOT NULL;

ALTER TABLE public.transaction_payments
  DROP CONSTRAINT IF EXISTS transaction_payments_payer_index_check;
ALTER TABLE public.transaction_payments
  ADD CONSTRAINT transaction_payments_payer_index_check
  CHECK (payer_index IS NULL OR (payer_index >= 1 AND payer_index <= 12));