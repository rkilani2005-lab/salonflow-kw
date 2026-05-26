ALTER TABLE public.chart_of_accounts
  ADD CONSTRAINT chart_of_accounts_tenant_id_code_key UNIQUE (tenant_id, code);