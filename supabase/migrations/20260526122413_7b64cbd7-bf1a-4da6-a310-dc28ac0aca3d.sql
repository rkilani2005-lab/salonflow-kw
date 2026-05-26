-- See supabase/migrations/20260526100001_seed_salon_chart_of_accounts.sql for full content
create or replace function public.seed_salon_chart_of_accounts(p_tenant_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted_accounts int := 0;
  v_inserted_mappings int := 0;
  v_id_1010 uuid; v_id_1011 uuid; v_id_1020 uuid; v_id_1030 uuid;
  v_id_1050 uuid; v_id_1051 uuid; v_id_1052 uuid;
  v_id_1100 uuid; v_id_1200 uuid; v_id_1210 uuid;
  v_id_4010 uuid; v_id_4020 uuid; v_id_4030 uuid; v_id_4040 uuid;
  v_id_4050 uuid; v_id_4060 uuid; v_id_4090 uuid;
  v_id_4100 uuid; v_id_4200 uuid; v_id_4300 uuid; v_id_4400 uuid; v_id_4500 uuid;
  v_id_5010 uuid; v_id_5020 uuid; v_id_5030 uuid; v_id_5040 uuid;
  v_id_5050 uuid; v_id_5060 uuid; v_id_5100 uuid;
  v_id_6010 uuid; v_id_6020 uuid; v_id_6030 uuid; v_id_6040 uuid; v_id_6050 uuid;
  v_id_6110 uuid; v_id_6120 uuid; v_id_6130 uuid; v_id_6140 uuid; v_id_6150 uuid;
  v_id_6210 uuid; v_id_6220 uuid;
  v_id_6310 uuid; v_id_6320 uuid; v_id_6330 uuid; v_id_6340 uuid; v_id_6350 uuid;
  v_id_6360 uuid; v_id_6370 uuid;
  v_id_6910 uuid; v_id_6990 uuid;
  v_id_2200 uuid; v_id_2210 uuid; v_id_2220 uuid;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id is required';
  end if;

  with new_accounts(code, name, name_ar, account_type, account_subtype) as (values
    ('1010', 'Cash on Hand',                      'النقد في الصندوق',                 'asset',     'cash'),
    ('1011', 'Cash in Drawer - Reception',        'النقد - الاستقبال',                 'asset',     'cash'),
    ('1020', 'Bank - KWD Main',                   'البنك - الحساب الرئيسي',           'asset',     'bank'),
    ('1030', 'Bank - Reserve',                    'البنك - الاحتياطي',                 'asset',     'bank'),
    ('1050', 'K-NET Clearing',                    'كي-نت تحت التسوية',                'asset',     'current_asset'),
    ('1051', 'Card Clearing (Visa/MC)',           'بطاقات تحت التسوية',                'asset',     'current_asset'),
    ('1052', 'Wallets Clearing',                  'المحافظ الإلكترونية',                'asset',     'current_asset'),
    ('1100', 'Accounts Receivable',               'الذمم المدينة',                     'asset',     'accounts_receivable'),
    ('1200', 'Inventory - Retail Products',       'المخزون - منتجات للبيع',           'asset',     'current_asset'),
    ('1210', 'Inventory - Professional Use',      'المخزون - الاستخدام المهني',       'asset',     'current_asset'),
    ('1300', 'Prepaid Rent',                      'الإيجار المدفوع مقدماً',            'asset',     'current_asset'),
    ('1500', 'Furniture & Fixtures',              'الأثاث والتجهيزات',                 'asset',     'fixed_asset'),
    ('1510', 'Salon Equipment',                   'معدات الصالون',                     'asset',     'fixed_asset'),
    ('1540', 'Computer & POS Equipment',          'الحاسوب ونقاط البيع',                'asset',     'fixed_asset'),
    ('1599', 'Accumulated Depreciation',          'مجمع الإهلاك',                      'asset',     'fixed_asset'),
    ('2010', 'Accounts Payable',                  'الذمم الدائنة',                     'liability', 'accounts_payable'),
    ('2100', 'Salaries Payable',                  'الرواتب المستحقة',                  'liability', 'accrued_liability'),
    ('2110', 'Staff Commissions Payable',         'عمولات الموظفين المستحقة',          'liability', 'accrued_liability'),
    ('2120', 'Tips Payable to Staff',             'البقشيش المستحق للموظفين',          'liability', 'accrued_liability'),
    ('2200', 'Gift Card Liability',               'التزامات بطاقات الهدايا',           'liability', 'current_liability'),
    ('2210', 'Loyalty Points Liability',          'التزامات نقاط الولاء',              'liability', 'current_liability'),
    ('2220', 'Customer Deposits / Deferred Revenue', 'إيرادات مؤجلة - الباقات',         'liability', 'current_liability'),
    ('2300', 'VAT / Sales Tax Payable',           'ضريبة القيمة المضافة المستحقة',     'liability', 'current_liability'),
    ('3010', 'Owner''s Capital',                  'رأس مال المالك',                    'equity',    'owners_equity'),
    ('3020', 'Owner''s Drawings',                 'مسحوبات المالك',                    'equity',    'owners_equity'),
    ('3030', 'Retained Earnings',                 'الأرباح المحتجزة',                  'equity',    'retained_earnings'),
    ('4010', 'Service Revenue - Hair',            'إيرادات خدمات الشعر',               'revenue',   'service_revenue'),
    ('4020', 'Service Revenue - Nails',           'إيرادات خدمات الأظافر',             'revenue',   'service_revenue'),
    ('4030', 'Service Revenue - Facial',          'إيرادات خدمات البشرة',              'revenue',   'service_revenue'),
    ('4040', 'Service Revenue - Makeup',          'إيرادات المكياج',                   'revenue',   'service_revenue'),
    ('4050', 'Service Revenue - Waxing',          'إيرادات إزالة الشعر',                'revenue',   'service_revenue'),
    ('4060', 'Service Revenue - Massage',         'إيرادات المساج',                    'revenue',   'service_revenue'),
    ('4090', 'Service Revenue - Other',           'إيرادات خدمات أخرى',                'revenue',   'service_revenue'),
    ('4100', 'Retail Sales - Products',           'مبيعات المنتجات بالتجزئة',          'revenue',   'product_revenue'),
    ('4200', 'Package Revenue (recognized)',      'إيرادات الباقات المعترف بها',       'revenue',   'service_revenue'),
    ('4300', 'Gift Card Revenue (redeemed)',      'إيرادات بطاقات الهدايا المستردة',   'revenue',   'other_revenue'),
    ('4400', 'Tips Collected',                    'البقشيش المستلم',                   'revenue',   'other_revenue'),
    ('4500', 'Discounts & Promotions',            'الخصومات والعروض',                  'revenue',   'other_revenue'),
    ('5010', 'COGS - Hair Consumables',           'تكلفة - مستهلكات الشعر',            'expense',   'cogs'),
    ('5020', 'COGS - Nail Consumables',           'تكلفة - مستهلكات الأظافر',          'expense',   'cogs'),
    ('5030', 'COGS - Facial Consumables',         'تكلفة - مستهلكات البشرة',           'expense',   'cogs'),
    ('5040', 'COGS - Makeup Consumables',         'تكلفة - مستهلكات المكياج',          'expense',   'cogs'),
    ('5050', 'COGS - Waxing Consumables',         'تكلفة - مستهلكات إزالة الشعر',      'expense',   'cogs'),
    ('5060', 'COGS - Massage Consumables',        'تكلفة - مستهلكات المساج',           'expense',   'cogs'),
    ('5100', 'COGS - Retail Products',            'تكلفة - المنتجات المباعة',          'expense',   'cogs'),
    ('6010', 'Salaries & Wages',                  'الرواتب والأجور',                   'expense',   'payroll'),
    ('6020', 'Staff Commissions',                 'عمولات الموظفين',                   'expense',   'payroll'),
    ('6030', 'Staff Benefits',                    'مزايا الموظفين',                    'expense',   'payroll'),
    ('6040', 'Staff Training',                    'تدريب الموظفين',                    'expense',   'operating_expense'),
    ('6050', 'Staff Uniforms',                    'زي الموظفين',                       'expense',   'operating_expense'),
    ('6110', 'Rent',                              'الإيجار',                           'expense',   'rent'),
    ('6120', 'Utilities (Electricity & Water)',   'الكهرباء والماء',                   'expense',   'operating_expense'),
    ('6130', 'Internet & Phone',                  'الإنترنت والهاتف',                  'expense',   'operating_expense'),
    ('6140', 'Cleaning & Sanitation',             'التنظيف والتعقيم',                  'expense',   'operating_expense'),
    ('6150', 'Repairs & Maintenance',             'الصيانة والإصلاح',                  'expense',   'operating_expense'),
    ('6210', 'Advertising & Promotions',          'الإعلان والترويج',                  'expense',   'marketing'),
    ('6220', 'Social Media & Influencers',        'وسائل التواصل والمؤثرين',           'expense',   'marketing'),
    ('6310', 'Software & SaaS',                   'البرمجيات والاشتراكات',              'expense',   'operating_expense'),
    ('6320', 'Office Supplies',                   'مستلزمات المكتب',                   'expense',   'operating_expense'),
    ('6330', 'Professional Fees',                 'الأتعاب المهنية',                    'expense',   'operating_expense'),
    ('6340', 'Insurance',                         'التأمين',                           'expense',   'operating_expense'),
    ('6350', 'Government Fees & Licenses',        'الرسوم الحكومية والتراخيص',         'expense',   'operating_expense'),
    ('6360', 'Bank Charges',                      'الرسوم البنكية',                    'expense',   'operating_expense'),
    ('6370', 'Card Processing Fees',              'رسوم معالجة البطاقات',              'expense',   'operating_expense'),
    ('6910', 'Depreciation Expense',              'مصروف الإهلاك',                     'expense',   'depreciation'),
    ('6990', 'Miscellaneous Expenses',            'مصروفات متنوعة',                    'expense',   'other_expense')
  )
  insert into public.chart_of_accounts
    (tenant_id, code, name, name_ar, account_type, account_subtype, is_system, is_active)
  select p_tenant_id, code, name, name_ar,
         account_type::account_type, account_subtype::account_subtype,
         false, true
    from new_accounts
   on conflict (tenant_id, code) do nothing;
  get diagnostics v_inserted_accounts = row_count;

  select id into v_id_1010 from chart_of_accounts where tenant_id = p_tenant_id and code = '1010';
  select id into v_id_1011 from chart_of_accounts where tenant_id = p_tenant_id and code = '1011';
  select id into v_id_1020 from chart_of_accounts where tenant_id = p_tenant_id and code = '1020';
  select id into v_id_1050 from chart_of_accounts where tenant_id = p_tenant_id and code = '1050';
  select id into v_id_1051 from chart_of_accounts where tenant_id = p_tenant_id and code = '1051';
  select id into v_id_1052 from chart_of_accounts where tenant_id = p_tenant_id and code = '1052';
  select id into v_id_1100 from chart_of_accounts where tenant_id = p_tenant_id and code = '1100';
  select id into v_id_1200 from chart_of_accounts where tenant_id = p_tenant_id and code = '1200';
  select id into v_id_1210 from chart_of_accounts where tenant_id = p_tenant_id and code = '1210';
  select id into v_id_2200 from chart_of_accounts where tenant_id = p_tenant_id and code = '2200';
  select id into v_id_2210 from chart_of_accounts where tenant_id = p_tenant_id and code = '2210';
  select id into v_id_2220 from chart_of_accounts where tenant_id = p_tenant_id and code = '2220';
  select id into v_id_4010 from chart_of_accounts where tenant_id = p_tenant_id and code = '4010';
  select id into v_id_4020 from chart_of_accounts where tenant_id = p_tenant_id and code = '4020';
  select id into v_id_4030 from chart_of_accounts where tenant_id = p_tenant_id and code = '4030';
  select id into v_id_4040 from chart_of_accounts where tenant_id = p_tenant_id and code = '4040';
  select id into v_id_4050 from chart_of_accounts where tenant_id = p_tenant_id and code = '4050';
  select id into v_id_4060 from chart_of_accounts where tenant_id = p_tenant_id and code = '4060';
  select id into v_id_4090 from chart_of_accounts where tenant_id = p_tenant_id and code = '4090';
  select id into v_id_4100 from chart_of_accounts where tenant_id = p_tenant_id and code = '4100';
  select id into v_id_5010 from chart_of_accounts where tenant_id = p_tenant_id and code = '5010';
  select id into v_id_5020 from chart_of_accounts where tenant_id = p_tenant_id and code = '5020';
  select id into v_id_5030 from chart_of_accounts where tenant_id = p_tenant_id and code = '5030';
  select id into v_id_5040 from chart_of_accounts where tenant_id = p_tenant_id and code = '5040';
  select id into v_id_5050 from chart_of_accounts where tenant_id = p_tenant_id and code = '5050';
  select id into v_id_5060 from chart_of_accounts where tenant_id = p_tenant_id and code = '5060';
  select id into v_id_5100 from chart_of_accounts where tenant_id = p_tenant_id and code = '5100';
  select id into v_id_6010 from chart_of_accounts where tenant_id = p_tenant_id and code = '6010';
  select id into v_id_6020 from chart_of_accounts where tenant_id = p_tenant_id and code = '6020';
  select id into v_id_6110 from chart_of_accounts where tenant_id = p_tenant_id and code = '6110';
  select id into v_id_6120 from chart_of_accounts where tenant_id = p_tenant_id and code = '6120';
  select id into v_id_6130 from chart_of_accounts where tenant_id = p_tenant_id and code = '6130';
  select id into v_id_6140 from chart_of_accounts where tenant_id = p_tenant_id and code = '6140';
  select id into v_id_6150 from chart_of_accounts where tenant_id = p_tenant_id and code = '6150';
  select id into v_id_6210 from chart_of_accounts where tenant_id = p_tenant_id and code = '6210';
  select id into v_id_6220 from chart_of_accounts where tenant_id = p_tenant_id and code = '6220';
  select id into v_id_6310 from chart_of_accounts where tenant_id = p_tenant_id and code = '6310';
  select id into v_id_6340 from chart_of_accounts where tenant_id = p_tenant_id and code = '6340';
  select id into v_id_6350 from chart_of_accounts where tenant_id = p_tenant_id and code = '6350';
  select id into v_id_6360 from chart_of_accounts where tenant_id = p_tenant_id and code = '6360';
  select id into v_id_6370 from chart_of_accounts where tenant_id = p_tenant_id and code = '6370';
  select id into v_id_6910 from chart_of_accounts where tenant_id = p_tenant_id and code = '6910';
  select id into v_id_6990 from chart_of_accounts where tenant_id = p_tenant_id and code = '6990';

  insert into public.gl_mappings (tenant_id, mapping_type, source_key, label, credit_account_id)
  values
    (p_tenant_id, 'revenue_service', 'hair',    'Hair Services',    v_id_4010),
    (p_tenant_id, 'revenue_service', 'nails',   'Nail Services',    v_id_4020),
    (p_tenant_id, 'revenue_service', 'facial',  'Facial Services',  v_id_4030),
    (p_tenant_id, 'revenue_service', 'makeup',  'Makeup Services',  v_id_4040),
    (p_tenant_id, 'revenue_service', 'waxing',  'Waxing Services',  v_id_4050),
    (p_tenant_id, 'revenue_service', 'massage', 'Massage Services', v_id_4060),
    (p_tenant_id, 'revenue_service', 'other',   'Other Services',   v_id_4090)
  on conflict (tenant_id, mapping_type, source_key)
    do update set credit_account_id = excluded.credit_account_id,
                  label             = excluded.label,
                  updated_at        = now();

  insert into public.gl_mappings (tenant_id, mapping_type, source_key, label, credit_account_id, debit_account_id)
  values
    (p_tenant_id, 'revenue_product', 'retail',       'Retail Product Sales',  v_id_4100, v_id_5100),
    (p_tenant_id, 'revenue_product', 'professional', 'Professional Use COGS', null,      v_id_5100),
    (p_tenant_id, 'revenue_product', 'both',         'Retail Product Sales',  v_id_4100, v_id_5100)
  on conflict (tenant_id, mapping_type, source_key)
    do update set credit_account_id = excluded.credit_account_id,
                  debit_account_id  = excluded.debit_account_id,
                  label             = excluded.label,
                  updated_at        = now();

  insert into public.gl_mappings (tenant_id, mapping_type, source_key, label, debit_account_id, credit_account_id)
  values
    (p_tenant_id, 'expense', 'cogs_hair',    'Hair Consumables',    v_id_5010, v_id_1210),
    (p_tenant_id, 'expense', 'cogs_nails',   'Nail Consumables',    v_id_5020, v_id_1210),
    (p_tenant_id, 'expense', 'cogs_facial',  'Facial Consumables',  v_id_5030, v_id_1210),
    (p_tenant_id, 'expense', 'cogs_makeup',  'Makeup Consumables',  v_id_5040, v_id_1210),
    (p_tenant_id, 'expense', 'cogs_waxing',  'Waxing Consumables',  v_id_5050, v_id_1210),
    (p_tenant_id, 'expense', 'cogs_massage', 'Massage Consumables', v_id_5060, v_id_1210),
    (p_tenant_id, 'expense', 'rent',              'Rent',                       v_id_6110, v_id_1020),
    (p_tenant_id, 'expense', 'salaries',          'Salaries & Wages',           v_id_6010, v_id_1020),
    (p_tenant_id, 'expense', 'commissions',       'Staff Commissions',          v_id_6020, v_id_1020),
    (p_tenant_id, 'expense', 'utilities',         'Utilities',                  v_id_6120, v_id_1020),
    (p_tenant_id, 'expense', 'internet_phone',    'Internet & Phone',           v_id_6130, v_id_1020),
    (p_tenant_id, 'expense', 'cleaning',          'Cleaning & Sanitation',      v_id_6140, v_id_1020),
    (p_tenant_id, 'expense', 'repairs',           'Repairs & Maintenance',      v_id_6150, v_id_1020),
    (p_tenant_id, 'expense', 'advertising',       'Advertising & Promotions',   v_id_6210, v_id_1020),
    (p_tenant_id, 'expense', 'social_media',      'Social Media & Influencers', v_id_6220, v_id_1020),
    (p_tenant_id, 'expense', 'software',          'Software & SaaS',            v_id_6310, v_id_1020),
    (p_tenant_id, 'expense', 'insurance',         'Insurance',                  v_id_6340, v_id_1020),
    (p_tenant_id, 'expense', 'government_fees',   'Government Fees & Licenses', v_id_6350, v_id_1020),
    (p_tenant_id, 'expense', 'bank_charges',      'Bank Charges',               v_id_6360, v_id_1020),
    (p_tenant_id, 'expense', 'card_processing',   'Card Processing Fees',       v_id_6370, v_id_1020),
    (p_tenant_id, 'expense', 'depreciation',      'Depreciation Expense',       v_id_6910, null),
    (p_tenant_id, 'expense', 'miscellaneous',     'Miscellaneous',              v_id_6990, v_id_1020)
  on conflict (tenant_id, mapping_type, source_key)
    do update set debit_account_id  = excluded.debit_account_id,
                  credit_account_id = excluded.credit_account_id,
                  label             = excluded.label,
                  updated_at        = now();

  insert into public.gl_mappings (tenant_id, mapping_type, source_key, label, debit_account_id)
  values
    (p_tenant_id, 'payment_method', 'cash',         'Cash',                v_id_1010),
    (p_tenant_id, 'payment_method', 'knet',         'K-NET',               v_id_1050),
    (p_tenant_id, 'payment_method', 'card',         'Visa / Mastercard',   v_id_1051),
    (p_tenant_id, 'payment_method', 'visa',         'Visa',                v_id_1051),
    (p_tenant_id, 'payment_method', 'mastercard',   'Mastercard',          v_id_1051),
    (p_tenant_id, 'payment_method', 'apple_pay',    'Apple Pay',           v_id_1052),
    (p_tenant_id, 'payment_method', 'wallet',       'Digital Wallet',      v_id_1052),
    (p_tenant_id, 'payment_method', 'tap',          'Tap',                 v_id_1052),
    (p_tenant_id, 'payment_method', 'bank_transfer','Bank Transfer',       v_id_1020),
    (p_tenant_id, 'payment_method', 'gift_card',    'Gift Card Redemption',v_id_2200),
    (p_tenant_id, 'payment_method', 'loyalty',      'Loyalty Points',      v_id_2210),
    (p_tenant_id, 'payment_method', 'package',      'Package Credit',      v_id_2220),
    (p_tenant_id, 'payment_method', 'receivable',   'On Account / Tab',    v_id_1100)
  on conflict (tenant_id, mapping_type, source_key)
    do update set debit_account_id = excluded.debit_account_id,
                  label            = excluded.label,
                  updated_at       = now();

  return json_build_object(
    'ok',                 true,
    'tenant_id',          p_tenant_id,
    'accounts_inserted',  v_inserted_accounts,
    'mappings_inserted',  (select count(*) from gl_mappings where tenant_id = p_tenant_id)
  );
end;
$$;

grant execute on function public.seed_salon_chart_of_accounts(uuid) to authenticated;