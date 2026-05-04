// supabase/functions/invoice-pdf/index.ts
// ---------------------------------------------------------------
// D.7 — Generate an invoice PDF for a transaction, store in the
// 'invoices' bucket, optionally dispatch as a WhatsApp document
// to the linked client's conversation.
//
// MODES
//   { transaction_id }                     → generate + store, return { url }
//   { transaction_id, conversation_id }    → also send via channel-send
//
// CALLED BY
//   - AI agent (ai-reply) when client asks for their invoice
//   - Future: POS receipt UI for a "send via WhatsApp" button
//   - Future: receipt_sent WhatsApp trigger
//
// PDF GENERATION
//   pdf-lib runs in Deno without polyfills.  We render a simple
//   one-page receipt with the salon header, transaction details,
//   line items, totals.  Not a designed thing — functional only.
//   The skill exists for richer designs but for WhatsApp delivery
//   (small phone screen) simplicity wins.
//
// SIGNING
//   Bucket is private.  We return a 24h signed URL.  Baileys
//   downloads from this URL when sending; long enough that
//   transient retries succeed, short enough that leaked URLs
//   don't haunt us forever.
// ---------------------------------------------------------------

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// 24h — long enough for Baileys download + a few hours of grace
// before the link in chat goes dead.  WhatsApp itself caches the
// document on send, so even after the URL expires the recipient
// keeps the file in their thread.
const SIGNED_URL_TTL_SEC = 24 * 60 * 60;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { transaction_id, conversation_id } = await req.json();
    if (!transaction_id) return json({ error: "transaction_id required" }, 400);

    // 1. Load transaction with items + client + tenant.  Tenant is
    //    needed for header (name, currency).  client_id may be null
    //    for walk-in sales — header just shows 'Walk-in Customer'.
    const { data: txn, error: tErr } = await sb
      .from("transactions")
      .select(`
        id, tenant_id, client_id, created_at, status,
        subtotal, discount_amount, tax_amount, tip_amount, grand_total,
        items:transaction_items ( item_name, quantity, unit_price, total_price ),
        payments:transaction_payments ( payment_method, amount )
      `)
      .eq("id", transaction_id)
      .single();
    if (tErr || !txn) return json({ error: "transaction_not_found" }, 404);

    const [{ data: tenant }, { data: client }] = await Promise.all([
      sb.from("tenants").select("name, currency, phone, address")
        .eq("id", txn.tenant_id).single(),
      txn.client_id
        ? sb.from("clients").select("name, phone").eq("id", txn.client_id).single()
        : Promise.resolve({ data: null }),
    ]);

    // 2. Render PDF.
    const pdfBytes = await renderInvoice({
      txn:     txn as any,
      tenant:  tenant ?? { name: "Salon", currency: "KWD" },
      client:  client ?? null,
    });

    // 3. Upload to invoices bucket.  Path keyed by tenant for RLS,
    //    by transaction_id so refunding/regenerating overwrites
    //    cleanly (upsert: true).
    const path = `${txn.tenant_id}/${transaction_id}.pdf`;
    const { error: upErr } = await sb.storage.from("invoices").upload(
      path,
      pdfBytes,
      { contentType: "application/pdf", upsert: true },
    );
    if (upErr) return json({ error: `upload_failed: ${upErr.message}` }, 500);

    // 4. Sign URL.
    const { data: signed, error: sErr } = await sb.storage
      .from("invoices")
      .createSignedUrl(path, SIGNED_URL_TTL_SEC);
    if (sErr || !signed?.signedUrl) {
      return json({ error: `sign_failed: ${sErr?.message ?? "unknown"}` }, 500);
    }

    // 5. Optionally dispatch as a WhatsApp document.
    if (conversation_id) {
      const filename = `Invoice-${txn.id.slice(0, 8).toUpperCase()}.pdf`;
      const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/channel-send`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          conversation_id,
          text:        `Invoice ${filename}`,
          media_url:   signed.signedUrl,
          media_type:  "document",
          sender_type: "ai",
        }),
      });
      if (!sendRes.ok) {
        const text = await sendRes.text();
        // Don't fail the whole call if dispatch failed — the PDF
        // exists and the URL is valid; caller can retry send.
        console.error("[invoice-pdf] dispatch failed:", text);
        return json({ url: signed.signedUrl, dispatched: false, error: text });
      }
    }

    return json({ url: signed.signedUrl, dispatched: !!conversation_id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[invoice-pdf] error:", msg);
    return json({ error: msg }, 500);
  }
});

// ───────────────────────────────────────────────────────────────
// PDF rendering with pdf-lib
// ───────────────────────────────────────────────────────────────
//
// Layout: A4 portrait.  Salon header at top.  Invoice metadata
// (number, date, client) below.  Items table.  Totals block at
// bottom.  Optional disclaimer footer.
//
// We use Helvetica throughout — pdf-lib bundles it as a standard
// font, no font file needed.  Arabic text in service names will
// render as the missing-glyph box; this is a known limitation of
// pdf-lib's standard fonts.  Fixing it requires shipping an
// Arabic-capable TTF and embedding it — flagged for a follow-up.
// ───────────────────────────────────────────────────────────────

async function renderInvoice(args: {
  txn:    any;
  tenant: { name: string; currency: string; phone?: string; address?: string };
  client: { name: string; phone: string } | null;
}): Promise<Uint8Array> {
  const { txn, tenant, client } = args;
  const cur = tenant.currency || "KWD";

  const pdf  = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4 in points
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const left   = 50;
  const right  = 545;
  const ink    = rgb(0.07, 0.07, 0.10);
  const muted  = rgb(0.45, 0.45, 0.50);
  const border = rgb(0.85, 0.85, 0.88);

  const drawText = (text: string, x: number, yPos: number, size = 10, font = helv, color = ink) => {
    page.drawText(text, { x, y: yPos, size, font, color });
  };
  const drawRight = (text: string, xRight: number, yPos: number, size = 10, font = helv, color = ink) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: xRight - w, y: yPos, size, font, color });
  };

  // Header
  drawText(tenant.name, left, y, 18, bold);
  if (tenant.phone)   drawText(tenant.phone,   left, y - 16, 9, helv, muted);
  if (tenant.address) drawText(tenant.address, left, y - 28, 9, helv, muted);
  drawRight("INVOICE", right, y, 22, bold);
  y -= 50;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.5, color: border });

  // Invoice meta + client block
  y -= 25;
  drawText("Invoice #",    left, y,      8, helv, muted);
  drawText(txn.id.slice(0, 8).toUpperCase(), left, y - 12, 11, bold);
  drawText("Date",         left + 150, y,      8, helv, muted);
  drawText(new Date(txn.created_at).toISOString().slice(0, 10), left + 150, y - 12, 11, bold);
  drawText("Status",       left + 280, y,      8, helv, muted);
  drawText(String(txn.status || "completed").toUpperCase(), left + 280, y - 12, 11, bold);

  if (client) {
    drawText("Bill to", right - 180, y, 8, helv, muted);
    drawText(client.name || "—", right - 180, y - 12, 11, bold);
    if (client.phone) drawText(client.phone, right - 180, y - 26, 9, helv, muted);
  } else {
    drawText("Bill to", right - 180, y, 8, helv, muted);
    drawText("Walk-in Customer", right - 180, y - 12, 11, bold);
  }

  // Items table
  y -= 60;
  page.drawRectangle({ x: left, y: y - 6, width: right - left, height: 22, color: rgb(0.97, 0.97, 0.99) });
  drawText("Item",  left + 8,         y, 9, bold, muted);
  drawText("Qty",   left + 320,       y, 9, bold, muted);
  drawText("Price", left + 380,       y, 9, bold, muted);
  drawRight("Total", right - 8,       y, 9, bold, muted);
  y -= 22;

  for (const it of (txn.items as any[]) ?? []) {
    if (y < 180) {
      // Out of room — single-page invoice is fine for almost all
      // salon transactions; truncate with a continuation note.
      drawText("…(more items truncated)", left + 8, y, 9, helv, muted);
      y -= 14;
      break;
    }
    drawText(String(it.item_name ?? ""),                    left + 8,   y, 10);
    drawText(String(it.quantity ?? 1),                      left + 320, y, 10);
    drawText(Number(it.unit_price ?? 0).toFixed(3),         left + 380, y, 10);
    drawRight(Number(it.total_price ?? 0).toFixed(3),       right - 8,  y, 10);
    y -= 18;
    page.drawLine({
      start: { x: left, y: y + 4 }, end: { x: right, y: y + 4 },
      thickness: 0.3, color: border,
    });
  }

  // Totals block
  y -= 20;
  const totalLine = (label: string, val: number, isGrand = false) => {
    const size = isGrand ? 13 : 10;
    const font = isGrand ? bold : helv;
    drawText(label, right - 200, y, size, font, isGrand ? ink : muted);
    drawRight(`${val.toFixed(3)} ${cur}`, right - 8, y, size, font);
    y -= isGrand ? 22 : 16;
  };
  totalLine("Subtotal", Number(txn.subtotal || 0));
  if (Number(txn.discount_amount || 0) > 0)
    totalLine("Discount", -Number(txn.discount_amount));
  if (Number(txn.tax_amount || 0) > 0)
    totalLine("Tax",      Number(txn.tax_amount));
  if (Number(txn.tip_amount || 0) > 0)
    totalLine("Tip",      Number(txn.tip_amount));
  page.drawLine({ start: { x: right - 220, y: y + 4 }, end: { x: right, y: y + 4 }, thickness: 0.5, color: ink });
  y -= 4;
  totalLine("TOTAL", Number(txn.grand_total || 0), true);

  // Payment methods
  if ((txn.payments as any[])?.length) {
    y -= 6;
    drawText("Paid by", right - 200, y, 8, helv, muted);
    y -= 12;
    for (const p of txn.payments as any[]) {
      drawText(String(p.payment_method).replace("_", " "), right - 200, y, 10);
      drawRight(`${Number(p.amount).toFixed(3)} ${cur}`,    right - 8,   y, 10);
      y -= 14;
    }
  }

  // Footer
  drawText("Thank you for your business.", left, 60, 9, helv, muted);
  drawText(`Generated ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
           left, 48, 8, helv, muted);

  return await pdf.save();
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
