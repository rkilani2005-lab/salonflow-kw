import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { po_id } = await req.json();
    if (!po_id) {
      return new Response(JSON.stringify({ error: "po_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch PO with supplier
    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .select("*, supplier:suppliers(name, name_ar, email, phone, address)")
      .eq("id", po_id)
      .maybeSingle();

    if (poError || !po) {
      return new Response(
        JSON.stringify({ error: "Purchase order not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch PO items with product info
    const { data: items, error: itemsError } = await supabase
      .from("purchase_order_items")
      .select("*, product:products(name, name_ar, sku, usage_unit)")
      .eq("po_id", po_id)
      .order("id");

    if (itemsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch PO items" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, logo_url, currency")
      .eq("id", po.tenant_id)
      .maybeSingle();

    const currency = tenant?.currency || "KWD";
    const companyName = tenant?.name || "Company";
    const poDate = new Date(po.created_at).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // Generate HTML for PDF
    const html = generatePOHtml({
      companyName,
      poNumber: po.po_number,
      poDate,
      status: po.status,
      supplier: po.supplier,
      paymentTerms: po.payment_terms,
      approvedAt: po.approved_at
        ? new Date(po.approved_at).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : null,
      notes: po.notes,
      items: items || [],
      totalAmount: po.total_amount,
      currency,
    });

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface POHtmlData {
  companyName: string;
  poNumber: string;
  poDate: string;
  status: string;
  supplier: {
    name: string;
    name_ar: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  paymentTerms: string | null;
  approvedAt: string | null;
  notes: string | null;
  items: Array<{
    quantity_ordered: number;
    unit_cost: number;
    total_cost: number;
    product: {
      name: string;
      name_ar: string | null;
      sku: string | null;
      usage_unit: string | null;
    } | null;
  }>;
  totalAmount: number;
  currency: string;
}

function generatePOHtml(data: POHtmlData): string {
  const itemRows = data.items
    .map(
      (item, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
        <strong>${item.product?.name || "—"}</strong>
        ${item.product?.name_ar ? `<br><span style="font-size:11px;color:#9ca3af;" dir="rtl">${item.product.name_ar}</span>` : ""}
        ${item.product?.sku ? `<br><span style="font-size:11px;color:#9ca3af;">SKU: ${item.product.sku}</span>` : ""}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity_ordered} ${item.product?.usage_unit || ""}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${item.unit_cost.toFixed(3)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${item.total_cost.toFixed(3)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Purchase Order ${data.poNumber}</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; margin: 0; padding: 20px; font-size: 13px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <!-- Header -->
  <table style="width:100%;margin-bottom:30px;">
    <tr>
      <td style="vertical-align:top;">
        <h1 style="margin:0;font-size:28px;color:#111827;">${data.companyName}</h1>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px;">Purchase Order</p>
      </td>
      <td style="text-align:right;vertical-align:top;">
        <h2 style="margin:0;font-size:22px;color:#4f46e5;font-family:monospace;">${data.poNumber}</h2>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px;">Date: ${data.poDate}</p>
        <p style="margin:2px 0 0;color:#6b7280;font-size:12px;">Status: ${data.status.replace(/_/g, " ").toUpperCase()}</p>
      </td>
    </tr>
  </table>

  <!-- Supplier Details -->
  <table style="width:100%;margin-bottom:24px;">
    <tr>
      <td style="vertical-align:top;width:50%;padding:16px;background:#f9fafb;border-radius:8px;">
        <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Supplier</p>
        <p style="margin:0;font-weight:600;font-size:15px;">${data.supplier?.name || "—"}</p>
        ${data.supplier?.name_ar ? `<p style="margin:2px 0 0;font-size:13px;color:#6b7280;" dir="rtl">${data.supplier.name_ar}</p>` : ""}
        ${data.supplier?.address ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${data.supplier.address}</p>` : ""}
        ${data.supplier?.phone ? `<p style="margin:2px 0 0;font-size:12px;color:#6b7280;">Tel: ${data.supplier.phone}</p>` : ""}
        ${data.supplier?.email ? `<p style="margin:2px 0 0;font-size:12px;color:#6b7280;">Email: ${data.supplier.email}</p>` : ""}
      </td>
      <td style="width:20px;"></td>
      <td style="vertical-align:top;width:50%;padding:16px;background:#f9fafb;border-radius:8px;">
        <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Order Details</p>
        ${data.paymentTerms ? `<p style="margin:0;font-size:12px;"><strong>Payment Terms:</strong> ${data.paymentTerms}</p>` : ""}
        ${data.approvedAt ? `<p style="margin:4px 0 0;font-size:12px;"><strong>Approved:</strong> ${data.approvedAt}</p>` : ""}
      </td>
    </tr>
  </table>

  <!-- Items Table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;width:40px;">#</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;">Product</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;">Unit Cost</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" style="padding:12px;text-align:right;font-weight:700;font-size:14px;border-top:2px solid #e5e7eb;">Total (${data.currency})</td>
        <td style="padding:12px;text-align:right;font-weight:700;font-size:16px;font-family:monospace;border-top:2px solid #e5e7eb;">${data.totalAmount.toFixed(3)}</td>
      </tr>
    </tfoot>
  </table>

  ${data.notes ? `
  <div style="margin-bottom:24px;padding:12px 16px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px;">
    <p style="margin:0 0 4px;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Notes</p>
    <p style="margin:0;font-size:12px;color:#78350f;">${data.notes}</p>
  </div>` : ""}

  <!-- Signature Lines -->
  <table style="width:100%;margin-top:60px;">
    <tr>
      <td style="width:45%;border-top:1px solid #d1d5db;padding-top:8px;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">Authorized Signature</p>
      </td>
      <td style="width:10%;"></td>
      <td style="width:45%;border-top:1px solid #d1d5db;padding-top:8px;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">Supplier Acknowledgment</p>
      </td>
    </tr>
  </table>

  <p style="text-align:center;margin-top:40px;font-size:10px;color:#d1d5db;">Generated by ${data.companyName} • ${data.poNumber}</p>
</body>
</html>`;
}
