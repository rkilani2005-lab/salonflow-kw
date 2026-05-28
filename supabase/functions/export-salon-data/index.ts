// Per-tenant data export — generates a multi-sheet .xlsx of the caller's salon data.
// SECURITY: salon_id (tenant_id) is derived from the JWT's profile row server-side.
// The client cannot pass or override it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Expose-Headers": "content-disposition",
};

// ── Helpers ──────────────────────────────────────────────────
const fmtISO = (v: unknown): string => {
  if (!v) return "";
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtKWD = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toFixed(3);
};

type ColDef = {
  header: string;
  get: (row: any) => unknown;
  kind?: "date" | "money" | "id" | "text";
};

const autoSize = (rows: any[][], headers: string[]) => {
  return headers.map((h, i) => {
    let max = h.length;
    for (const r of rows) {
      const v = r[i];
      const len = v == null ? 0 : String(v).length;
      if (len > max) max = len;
    }
    return { wch: Math.min(Math.max(max + 2, 10), 50) };
  });
};

const addSheet = (wb: XLSX.WorkBook, name: string, columns: ColDef[], data: any[]) => {
  const headers = columns.map(c => c.header);
  const rows = data.map(r => columns.map(c => {
    const v = c.get(r);
    if (c.kind === "date")  return fmtISO(v);
    if (c.kind === "money") return fmtKWD(v);
    return v ?? "";
  }));
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = autoSize(rows, headers);
  // Truncate sheet name to 31 chars (Excel limit)
  const safeName = name.slice(0, 31).replace(/[\\\/\?\*\[\]:]/g, "_");
  XLSX.utils.book_append_sheet(wb, ws, safeName);
};

// ── Main ─────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Identify the caller from their JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Derive salon_id (tenant_id) from the profile — NEVER trust the request body
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("tenant_id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profErr || !profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "No salon associated with this account" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const salonId: string = profile.tenant_id;

    const { data: tenant } = await admin
      .from("tenants")
      .select("name, currency")
      .eq("id", salonId)
      .maybeSingle();
    const salonName = tenant?.name || "Salon";

    // 3. Preload lookups (clients, staff, services, products) for FK resolution
    const fetchAll = async (table: string, cols: string) => {
      try {
        const { data, error } = await admin.from(table).select(cols).eq("tenant_id", salonId).limit(50000);
        if (error) { console.warn(`[export] ${table} lookup failed:`, error.message); return []; }
        return data ?? [];
      } catch (e) {
        console.warn(`[export] ${table} threw:`, (e as Error).message); return [];
      }
    };

    const clients   = await fetchAll("clients",  "id, name, phone, email");
    const staff     = await fetchAll("staff",    "id, name, email");
    const services  = await fetchAll("services", "id, name, name_ar");
    const products  = await fetchAll("products", "id, name, name_ar, sku");
    const branches  = await fetchAll("branches", "id, name");
    const suppliers = await fetchAll("suppliers","id, name");

    const idx = <T extends {id: string}>(arr: T[]) => {
      const m = new Map<string, T>();
      for (const r of arr) m.set(r.id, r);
      return m;
    };
    const clientById   = idx(clients as any);
    const staffById    = idx(staff as any);
    const serviceById  = idx(services as any);
    const productById  = idx(products as any);
    const branchById   = idx(branches as any);
    const supplierById = idx(suppliers as any);

    const nameOf  = (m: Map<string, any>, id: any) => (id ? (m.get(id)?.name ?? "") : "");

    // 4. Build workbook
    const wb = XLSX.utils.book_new();
    const counts: Record<string, number> = {};
    const tableSheetName: Record<string, string> = {};

    // Helper to fetch + add a sheet, recording count
    const exportTable = async (
      sheetName: string,
      table: string,
      columns: ColDef[],
      select: string = "*",
      orderBy?: string,
    ) => {
      try {
        let q = admin.from(table).select(select).eq("tenant_id", salonId).limit(100000);
        if (orderBy) q = q.order(orderBy, { ascending: false });
        const { data, error } = await q;
        if (error) {
          console.warn(`[export] ${table} failed:`, error.message);
          addSheet(wb, sheetName, [{ header: "Note", get: () => `Skipped: ${error.message}` }], [{}]);
          counts[sheetName] = 0;
          tableSheetName[table] = sheetName;
          return;
        }
        const rows = data ?? [];
        addSheet(wb, sheetName, columns, rows);
        counts[sheetName] = rows.length;
        tableSheetName[table] = sheetName;
      } catch (e) {
        console.warn(`[export] ${table} threw:`, (e as Error).message);
        addSheet(wb, sheetName, [{ header: "Note", get: () => `Skipped: ${(e as Error).message}` }], [{}]);
        counts[sheetName] = 0;
      }
    };

    // ───────────────────────────────────────────────────────────
    // Customers
    await exportTable("Customers", "clients", [
      { header: "Customer ID (ID)", get: r => r.id },
      { header: "Name",             get: r => r.name },
      { header: "Phone",            get: r => r.phone },
      { header: "Email",            get: r => r.email },
      { header: "Tier",             get: r => r.tier },
      { header: "Loyalty Points",   get: r => r.loyalty_points },
      { header: "Notes",            get: r => r.notes },
      { header: "Created",          get: r => r.created_at, kind: "date" },
    ], "id, name, phone, email, tier, loyalty_points, notes, created_at", "created_at");

    // Staff
    await exportTable("Staff", "staff", [
      { header: "Staff ID (ID)", get: r => r.id },
      { header: "Name",          get: r => r.name },
      { header: "Email",         get: r => r.email },
      { header: "Phone",         get: r => r.phone },
      { header: "Role",          get: r => r.role },
      { header: "Active",        get: r => r.is_active },
      { header: "Created",       get: r => r.created_at, kind: "date" },
    ], "id, name, email, phone, role, is_active, created_at");

    // Services
    await exportTable("Services", "services", [
      { header: "Service ID (ID)", get: r => r.id },
      { header: "Name",            get: r => r.name },
      { header: "Name (Arabic)",   get: r => r.name_ar },
      { header: "Category",        get: r => r.category },
      { header: "Duration (min)",  get: r => r.duration_minutes },
      { header: "Price (KWD)",     get: r => r.price, kind: "money" },
      { header: "Active",          get: r => r.is_active },
    ], "id, name, name_ar, category, duration_minutes, price, is_active");

    // Service price schedules
    await exportTable("Service Prices (Schedules)", "service_price_schedules", [
      { header: "Schedule ID (ID)",  get: r => r.id },
      { header: "Service",           get: r => nameOf(serviceById, r.service_id) },
      { header: "Service (ID)",      get: r => r.service_id },
      { header: "Price (KWD)",       get: r => r.price, kind: "money" },
      { header: "Valid From",        get: r => r.valid_from, kind: "date" },
      { header: "Valid To",          get: r => r.valid_to, kind: "date" },
      { header: "Active",            get: r => r.is_active },
    ]);

    // Appointments (bookings)
    await exportTable("Appointments", "bookings", [
      { header: "Appointment ID (ID)", get: r => r.id },
      { header: "Customer",            get: r => nameOf(clientById, r.client_id) },
      { header: "Customer (ID)",       get: r => r.client_id },
      { header: "Stylist",             get: r => nameOf(staffById, r.staff_id) },
      { header: "Stylist (ID)",        get: r => r.staff_id },
      { header: "Service",             get: r => nameOf(serviceById, r.service_id) },
      { header: "Service (ID)",        get: r => r.service_id },
      { header: "Branch",              get: r => nameOf(branchById, r.branch_id) },
      { header: "Branch (ID)",         get: r => r.branch_id },
      { header: "Start",               get: r => r.start_time, kind: "date" },
      { header: "End",                 get: r => r.end_time,   kind: "date" },
      { header: "Status",              get: r => r.status },
      { header: "Total (KWD)",         get: r => r.total_price, kind: "money" },
      { header: "Deposit (KWD)",       get: r => r.deposit_amount, kind: "money" },
      { header: "Notes",               get: r => r.notes },
      { header: "Created",             get: r => r.created_at, kind: "date" },
    ], "*", "start_time");

    // Sales (transactions)
    await exportTable("Sales", "transactions", [
      { header: "Sale ID (ID)",     get: r => r.id },
      { header: "Customer",         get: r => nameOf(clientById, r.client_id) },
      { header: "Customer (ID)",    get: r => r.client_id },
      { header: "Branch",           get: r => nameOf(branchById, r.branch_id) },
      { header: "Branch (ID)",      get: r => r.branch_id },
      { header: "Date",             get: r => r.created_at, kind: "date" },
      { header: "Subtotal (KWD)",   get: r => r.subtotal, kind: "money" },
      { header: "Discount (KWD)",   get: r => r.discount_amount, kind: "money" },
      { header: "Tax (KWD)",        get: r => r.tax_amount, kind: "money" },
      { header: "Tip (KWD)",        get: r => r.tip_amount, kind: "money" },
      { header: "Total (KWD)",      get: r => r.total, kind: "money" },
      { header: "Payment Method",   get: r => r.payment_method },
      { header: "Status",           get: r => r.status },
      { header: "Items (JSON)",     get: r => r.items ? JSON.stringify(r.items) : "" },
      { header: "Notes",            get: r => r.notes },
    ], "*", "created_at");

    // Products / Inventory
    await exportTable("Products", "products", [
      { header: "Product ID (ID)",  get: r => r.id },
      { header: "Name",             get: r => r.name },
      { header: "Name (Arabic)",    get: r => r.name_ar },
      { header: "SKU",              get: r => r.sku },
      { header: "Category",         get: r => r.category },
      { header: "Cost (KWD)",       get: r => r.cost_price, kind: "money" },
      { header: "Retail (KWD)",     get: r => r.retail_price, kind: "money" },
      { header: "Current Stock",    get: r => r.current_stock },
      { header: "Reorder Level",    get: r => r.reorder_level },
      { header: "Unit",             get: r => r.usage_unit },
      { header: "Active",           get: r => r.is_active },
    ]);

    // Inventory Movements
    await exportTable("Inventory Movements", "inventory_transactions", [
      { header: "Movement ID (ID)",  get: r => r.id },
      { header: "Product",           get: r => nameOf(productById, r.product_id) },
      { header: "Product (ID)",      get: r => r.product_id },
      { header: "Type",              get: r => r.transaction_type },
      { header: "Quantity Change",   get: r => r.quantity_change },
      { header: "Reference Type",    get: r => r.reference_type },
      { header: "Reference (ID)",    get: r => r.reference_id },
      { header: "Notes",             get: r => r.notes },
      { header: "Date",              get: r => r.created_at, kind: "date" },
    ], "*", "created_at");

    // Service Recipes (back-bar)
    await exportTable("Service Recipes", "service_recipes", [
      { header: "Recipe ID (ID)",    get: r => r.id },
      { header: "Service",           get: r => nameOf(serviceById, r.service_id) },
      { header: "Service (ID)",      get: r => r.service_id },
      { header: "Product",           get: r => nameOf(productById, r.product_id) },
      { header: "Product (ID)",      get: r => r.product_id },
      { header: "Qty per Service",   get: r => r.quantity_per_service },
    ]);

    // Suppliers
    await exportTable("Suppliers", "suppliers", [
      { header: "Supplier ID (ID)", get: r => r.id },
      { header: "Name",             get: r => r.name },
      { header: "Contact Person",   get: r => r.contact_person },
      { header: "Email",            get: r => r.email },
      { header: "Phone",            get: r => r.phone },
      { header: "Address",          get: r => r.address },
      { header: "Active",           get: r => r.is_active },
    ]);

    // Purchase Orders
    await exportTable("Purchase Orders", "purchase_orders", [
      { header: "PO ID (ID)",       get: r => r.id },
      { header: "PO Number",        get: r => r.po_number },
      { header: "Supplier",         get: r => nameOf(supplierById, r.supplier_id) },
      { header: "Supplier (ID)",    get: r => r.supplier_id },
      { header: "Status",           get: r => r.status },
      { header: "Total (KWD)",      get: r => r.total_amount, kind: "money" },
      { header: "Order Date",       get: r => r.order_date, kind: "date" },
      { header: "Expected",         get: r => r.expected_delivery, kind: "date" },
      { header: "Notes",            get: r => r.notes },
    ], "*", "created_at");

    // Goods Receipts
    await exportTable("Goods Receipts", "goods_receipts", [
      { header: "GRN ID (ID)",      get: r => r.id },
      { header: "GRN Number",       get: r => r.grn_number },
      { header: "PO (ID)",          get: r => r.po_id },
      { header: "Received Date",    get: r => r.received_date, kind: "date" },
      { header: "Status",           get: r => r.status },
      { header: "Notes",            get: r => r.notes },
    ], "*", "received_date");

    // Vendor Invoices
    await exportTable("Vendor Invoices", "vendor_invoices", [
      { header: "Invoice ID (ID)",  get: r => r.id },
      { header: "Invoice Number",   get: r => r.invoice_number },
      { header: "Supplier",         get: r => nameOf(supplierById, r.supplier_id) },
      { header: "Supplier (ID)",    get: r => r.supplier_id },
      { header: "Total (KWD)",      get: r => r.total_amount, kind: "money" },
      { header: "Paid (KWD)",       get: r => r.paid_amount, kind: "money" },
      { header: "Due Date",         get: r => r.due_date, kind: "date" },
      { header: "Status",           get: r => r.status },
    ]);

    // Vendor Payments
    await exportTable("Vendor Payments", "vendor_payments", [
      { header: "Payment ID (ID)",  get: r => r.id },
      { header: "Vendor Invoice (ID)", get: r => r.vendor_invoice_id },
      { header: "Amount (KWD)",     get: r => r.amount, kind: "money" },
      { header: "Method",           get: r => r.payment_method },
      { header: "Date",             get: r => r.payment_date, kind: "date" },
      { header: "Notes",            get: r => r.notes },
    ]);

    // AR Invoices
    await exportTable("AR Invoices", "ar_invoices", [
      { header: "Invoice ID (ID)",  get: r => r.id },
      { header: "Invoice Number",   get: r => r.invoice_number },
      { header: "Customer",         get: r => nameOf(clientById, r.client_id) },
      { header: "Customer (ID)",    get: r => r.client_id },
      { header: "Total (KWD)",      get: r => r.total_amount, kind: "money" },
      { header: "Paid (KWD)",       get: r => r.paid_amount, kind: "money" },
      { header: "Status",           get: r => r.status },
      { header: "Due Date",         get: r => r.due_date, kind: "date" },
    ]);

    // AR Payments
    await exportTable("AR Payments", "ar_payments", [
      { header: "Payment ID (ID)",  get: r => r.id },
      { header: "AR Invoice (ID)",  get: r => r.ar_invoice_id },
      { header: "Amount (KWD)",     get: r => r.amount, kind: "money" },
      { header: "Method",           get: r => r.payment_method },
      { header: "Date",             get: r => r.payment_date, kind: "date" },
    ]);

    // Commission rules
    await exportTable("Commission Rules", "staff_commission_rules", [
      { header: "Rule ID (ID)",     get: r => r.id },
      { header: "Staff",            get: r => nameOf(staffById, r.staff_id) },
      { header: "Staff (ID)",       get: r => r.staff_id },
      { header: "Rule Type",        get: r => r.rule_type },
      { header: "Rate / Amount",    get: r => r.rate ?? r.amount },
      { header: "Scope",            get: r => r.scope },
      { header: "Active",           get: r => r.is_active },
    ]);

    // Service packages
    await exportTable("Service Packages", "service_packages", [
      { header: "Package ID (ID)",  get: r => r.id },
      { header: "Name",             get: r => r.name },
      { header: "Price (KWD)",      get: r => r.price, kind: "money" },
      { header: "Sessions",         get: r => r.sessions_included },
      { header: "Validity (days)",  get: r => r.validity_days },
      { header: "Active",           get: r => r.is_active },
    ]);

    // Client packages
    await exportTable("Client Packages", "client_packages", [
      { header: "Client Package ID (ID)", get: r => r.id },
      { header: "Customer",          get: r => nameOf(clientById, r.client_id) },
      { header: "Customer (ID)",     get: r => r.client_id },
      { header: "Package (ID)",      get: r => r.package_id },
      { header: "Sessions Remaining", get: r => r.sessions_remaining },
      { header: "Expires",           get: r => r.expires_at, kind: "date" },
      { header: "Status",            get: r => r.status },
    ]);

    // Gift cards
    await exportTable("Gift Cards", "gift_cards", [
      { header: "Gift Card ID (ID)", get: r => r.id },
      { header: "Code",              get: r => r.code },
      { header: "Initial (KWD)",     get: r => r.initial_balance, kind: "money" },
      { header: "Balance (KWD)",     get: r => r.current_balance, kind: "money" },
      { header: "Customer",          get: r => nameOf(clientById, r.client_id) },
      { header: "Customer (ID)",     get: r => r.client_id },
      { header: "Expires",           get: r => r.expires_at, kind: "date" },
      { header: "Status",            get: r => r.status },
    ]);

    // Promo codes
    await exportTable("Promo Codes", "promo_codes", [
      { header: "Promo ID (ID)",     get: r => r.id },
      { header: "Code",              get: r => r.code },
      { header: "Name",              get: r => r.name },
      { header: "Discount Type",     get: r => r.discount_type },
      { header: "Discount Value",    get: r => r.discount_value },
      { header: "Used Count",        get: r => r.used_count },
      { header: "Max Uses",          get: r => r.max_uses },
      { header: "Expires",           get: r => r.expires_at, kind: "date" },
      { header: "Active",            get: r => r.is_active },
    ]);

    // Loyalty transactions
    await exportTable("Loyalty Transactions", "loyalty_transactions", [
      { header: "Loyalty Tx ID (ID)", get: r => r.id },
      { header: "Customer",          get: r => nameOf(clientById, r.client_id) },
      { header: "Customer (ID)",     get: r => r.client_id },
      { header: "Points",            get: r => r.points },
      { header: "Type",              get: r => r.transaction_type },
      { header: "Reference (ID)",    get: r => r.reference_id },
      { header: "Date",              get: r => r.created_at, kind: "date" },
    ], "*", "created_at");

    // Cash sessions
    await exportTable("Cash Sessions", "cash_sessions", [
      { header: "Session ID (ID)",   get: r => r.id },
      { header: "Branch",            get: r => nameOf(branchById, r.branch_id) },
      { header: "Branch (ID)",       get: r => r.branch_id },
      { header: "Opening (KWD)",     get: r => r.opening_balance, kind: "money" },
      { header: "Closing (KWD)",     get: r => r.closing_balance, kind: "money" },
      { header: "Expected (KWD)",    get: r => r.expected_balance, kind: "money" },
      { header: "Variance (KWD)",    get: r => r.variance, kind: "money" },
      { header: "Status",            get: r => r.status },
      { header: "Opened",            get: r => r.opened_at, kind: "date" },
      { header: "Closed",            get: r => r.closed_at, kind: "date" },
    ]);

    // Expenses
    await exportTable("Expenses", "expenses", [
      { header: "Expense ID (ID)",   get: r => r.id },
      { header: "Date",              get: r => r.expense_date, kind: "date" },
      { header: "Category",          get: r => r.category },
      { header: "Amount (KWD)",      get: r => r.amount, kind: "money" },
      { header: "Description",       get: r => r.description },
      { header: "Payment Method",    get: r => r.payment_method },
    ], "*", "expense_date");

    // Branches
    await exportTable("Branches", "branches", [
      { header: "Branch ID (ID)",    get: r => r.id },
      { header: "Name",              get: r => r.name },
      { header: "Name (Arabic)",     get: r => r.name_ar },
      { header: "Address",           get: r => r.address },
      { header: "Phone",             get: r => r.phone },
      { header: "Opening",           get: r => r.opening_time },
      { header: "Closing",           get: r => r.closing_time },
      { header: "Active",            get: r => r.is_active },
    ]);

    // Staff attendance
    await exportTable("Staff Attendance", "staff_attendance", [
      { header: "Attendance ID (ID)", get: r => r.id },
      { header: "Staff",             get: r => nameOf(staffById, r.staff_id) },
      { header: "Staff (ID)",        get: r => r.staff_id },
      { header: "Clock In",          get: r => r.clock_in, kind: "date" },
      { header: "Clock Out",         get: r => r.clock_out, kind: "date" },
      { header: "Break (min)",       get: r => r.break_minutes },
      { header: "Notes",             get: r => r.notes },
    ], "*", "clock_in");

    // Client feedback
    await exportTable("Client Feedback", "client_feedback", [
      { header: "Feedback ID (ID)",  get: r => r.id },
      { header: "Customer",          get: r => nameOf(clientById, r.client_id) },
      { header: "Customer (ID)",     get: r => r.client_id },
      { header: "Rating",            get: r => r.rating },
      { header: "Comment",           get: r => r.comment },
      { header: "Date",              get: r => r.created_at, kind: "date" },
    ], "*", "created_at");

    // ── Build READ ME (first tab) ───────────────────────────
    const nowISO = fmtISO(new Date());
    const readmeRows: any[][] = [
      ["ZAINA Salon — Data Export"],
      [""],
      ["Salon Name", salonName],
      ["Salon ID",   salonId],
      ["Exported At", nowISO],
      ["Exported By", profile.full_name || user.email || user.id],
      [""],
      ["This file is a COMPLETE BACKUP of your salon's data."],
      ["You own this data. You can use this file to keep an offline backup or to migrate to another system."],
      [""],
      ['Columns labelled "(ID)" preserve the relationships between records. Keep them if you plan to re-import.'],
      ["All money values are in Kuwaiti Dinar (KWD), with 3 decimal places."],
      ["All dates are in ISO format (YYYY-MM-DD HH:mm)."],
      [""],
      ["── Sheet Index ──"],
      ["Tab", "Records"],
    ];
    for (const [name, n] of Object.entries(counts)) {
      readmeRows.push([name, n]);
    }
    const readme = XLSX.utils.aoa_to_sheet(readmeRows);
    readme["!cols"] = [{ wch: 36 }, { wch: 50 }];
    // Insert at position 0
    XLSX.utils.book_append_sheet(wb, readme, "READ ME");
    // Reorder so READ ME is first
    const order = wb.SheetNames.slice();
    const readIdx = order.indexOf("READ ME");
    if (readIdx > 0) {
      order.splice(readIdx, 1);
      order.unshift("READ ME");
      wb.SheetNames = order;
    }

    // ── Schema Map sheet ────────────────────────────────────
    const schemaMap: any[][] = [
      ["From Sheet", "From Column", "Related Sheet", "Related Column"],
      ["Appointments", "Customer (ID)", "Customers", "Customer ID (ID)"],
      ["Appointments", "Stylist (ID)",  "Staff",     "Staff ID (ID)"],
      ["Appointments", "Service (ID)",  "Services",  "Service ID (ID)"],
      ["Appointments", "Branch (ID)",   "Branches",  "Branch ID (ID)"],
      ["Sales",        "Customer (ID)", "Customers", "Customer ID (ID)"],
      ["Sales",        "Branch (ID)",   "Branches",  "Branch ID (ID)"],
      ["Inventory Movements", "Product (ID)", "Products", "Product ID (ID)"],
      ["Service Recipes",     "Service (ID)", "Services", "Service ID (ID)"],
      ["Service Recipes",     "Product (ID)", "Products", "Product ID (ID)"],
      ["Service Prices (Schedules)", "Service (ID)", "Services", "Service ID (ID)"],
      ["Purchase Orders",     "Supplier (ID)", "Suppliers", "Supplier ID (ID)"],
      ["Vendor Invoices",     "Supplier (ID)", "Suppliers", "Supplier ID (ID)"],
      ["Vendor Payments",     "Vendor Invoice (ID)", "Vendor Invoices", "Invoice ID (ID)"],
      ["AR Invoices",         "Customer (ID)", "Customers", "Customer ID (ID)"],
      ["AR Payments",         "AR Invoice (ID)", "AR Invoices", "Invoice ID (ID)"],
      ["Client Packages",     "Customer (ID)", "Customers", "Customer ID (ID)"],
      ["Client Packages",     "Package (ID)",  "Service Packages", "Package ID (ID)"],
      ["Gift Cards",          "Customer (ID)", "Customers", "Customer ID (ID)"],
      ["Loyalty Transactions","Customer (ID)", "Customers", "Customer ID (ID)"],
      ["Commission Rules",    "Staff (ID)",    "Staff",     "Staff ID (ID)"],
      ["Staff Attendance",    "Staff (ID)",    "Staff",     "Staff ID (ID)"],
      ["Client Feedback",     "Customer (ID)", "Customers", "Customer ID (ID)"],
      ["Cash Sessions",       "Branch (ID)",   "Branches",  "Branch ID (ID)"],
    ];
    const schemaWs = XLSX.utils.aoa_to_sheet(schemaMap);
    schemaWs["!cols"] = [{ wch: 28 }, { wch: 26 }, { wch: 24 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, schemaWs, "Schema Map");

    // 5. Serialize and return
    const buf: ArrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const slug = salonName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "salon";
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `zaina-export-${slug}-${dateStr}.xlsx`;

    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[export-salon-data] fatal:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
