

# Intelligent Salon Inventory and Procurement System (Updated)

This is the full plan with the requested additions: **PO Approval Workflow**, **PDF Generation and Distribution** (Email + WhatsApp), **Goods Receipt against open POs**, and **Vendor Invoice Payment tracking**.

---

## Phase 1: Database Schema and Product Management UI

### Database Tables (Single Migration)

**1. `product_categories`** -- id, tenant_id, name, name_ar, parent_id, sort_order, created_at

**2. `products`** -- Core product table
- id, tenant_id, category_id, name, name_ar, description, sku, barcode
- product_type: enum `('professional', 'retail', 'both')`
- purchase_unit, purchase_unit_quantity, usage_unit
- cost_price (WAC), retail_price
- reorder_point, reorder_quantity, current_stock
- batch_number, expiry_date, image_url
- is_active, created_at, updated_at

**3. `suppliers`** -- id, tenant_id, name, name_ar, contact_person, email, phone, whatsapp_number, address, payment_terms (e.g. "Net 30"), notes, is_active, created_at

**4. `product_suppliers`** -- product_id, supplier_id, agreed_cost, lead_time_days, is_preferred

**5. `service_recipes`** -- id, tenant_id, service_id, product_id, quantity_per_service

**6. `purchase_orders`** -- PO header with approval workflow
- id, tenant_id, supplier_id, po_number (auto-generated)
- status: enum `('draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'received', 'cancelled')`
- total_amount, notes, payment_terms
- requested_by (user_id), approved_by (user_id), approved_at (timestamp)
- sent_via (enum: 'email', 'whatsapp', 'manual', null), sent_at
- created_at, updated_at

**7. `purchase_order_items`** -- id, po_id, product_id, quantity_ordered, quantity_received, unit_cost, total_cost

**8. `goods_receipts`** -- Receiving against open POs
- id, tenant_id, purchase_order_id, grn_number (auto-generated)
- received_by (user_id), received_at, notes

**9. `goods_receipt_items`** -- id, goods_receipt_id, product_id, po_item_id, quantity_received, unit_cost, batch_number, expiry_date

**10. `vendor_invoices`** -- Invoice payment tracking (NEW)
- id, tenant_id, supplier_id, purchase_order_id (nullable)
- invoice_number, invoice_date, due_date
- total_amount, paid_amount, currency (default 'KWD')
- status: enum `('pending', 'partially_paid', 'paid', 'overdue', 'disputed')`
- notes, created_at, updated_at

**11. `vendor_payments`** -- Payment records against invoices (NEW)
- id, tenant_id, vendor_invoice_id
- amount, payment_date, payment_method (enum: 'cash', 'bank_transfer', 'cheque', 'knet')
- reference_number, notes, created_by (user_id), created_at

**12. `inventory_transactions`** -- Audit log for all stock movements
- id, tenant_id, product_id
- transaction_type: enum `('purchase_receipt', 'service_consumption', 'retail_sale', 'adjustment', 'wastage', 'return')`
- quantity_change, reference_id, reference_type, notes, created_by, created_at

### New Enums
- `product_type`: professional, retail, both
- `po_status`: draft, pending_approval, approved, sent, partially_received, received, cancelled
- `inventory_transaction_type`: purchase_receipt, service_consumption, retail_sale, adjustment, wastage, return
- `vendor_invoice_status`: pending, partially_paid, paid, overdue, disputed
- `vendor_payment_method`: cash, bank_transfer, cheque, knet
- `po_sent_via`: email, whatsapp, manual

### RLS Policies
- All tables scoped by `tenant_id = get_user_tenant_id(auth.uid())`
- INSERT/UPDATE restricted to owner, manager, inventory_clerk roles
- PO approval restricted to owner and manager roles only
- Super admin bypass on SELECT

### UI: Inventory Page (`src/pages/Inventory.tsx`)

Replace the "Coming Soon" placeholder with a tabbed layout:

- **Products tab**: Table with Name, SKU, Type badge, Category, Stock Level (color-coded green/yellow/red), Cost, Retail Price. Add/Edit dialogs, filters by type and category.
- **Suppliers tab**: CRUD table for supplier management with payment terms.
- **Purchase Orders tab**: PO list with status badges, create/approve/send/receive actions.
- **Stock Movements tab**: Read-only audit log of all inventory transactions.
- **Vendor Invoices tab**: Invoice list with payment status, record payments.

### New Files (Phase 1)
- `src/pages/Inventory.tsx`
- `src/components/inventory/ProductsTab.tsx`
- `src/components/inventory/AddProductDialog.tsx`
- `src/components/inventory/ProductDetailSheet.tsx`
- `src/components/inventory/SuppliersTab.tsx`
- `src/components/inventory/AddSupplierDialog.tsx`
- `src/hooks/useProducts.ts`
- `src/hooks/useSuppliers.ts`

---

## Phase 2: PO Approval, PDF, Distribution, Goods Receipt, and Invoice Payment

### PO Approval Workflow

The purchase order lifecycle:

```text
Draft --> Submit for Approval --> Approved / Rejected
                                      |
                              Send (Email/WhatsApp/Print)
                                      |
                              Receive Goods (partial or full)
                                      |
                              Match Vendor Invoice
                                      |
                              Record Payment
```

**Approval rules:**
- Any user with inventory_clerk, manager, or owner role can create a Draft PO.
- Only **owner** or **manager** can approve. The approver cannot be the same person who created the PO (4-eyes principle) -- enforced in app logic.
- Approved POs can be sent to vendors. Draft or pending POs cannot.
- Cancelled POs cannot be edited or re-opened.

**UI components:**
- `src/components/inventory/PurchaseOrdersTab.tsx` -- List all POs with status filters (Draft, Pending, Approved, Sent, Received)
- `src/components/inventory/CreatePODialog.tsx` -- Create/edit PO with line items, auto-populate from low-stock
- `src/components/inventory/PODetailSheet.tsx` -- View PO details with action buttons (Submit, Approve, Reject, Send, Print)
- `src/components/inventory/POApprovalDialog.tsx` -- Confirmation dialog for approve/reject with optional notes

### PDF Generation and Printing

- Use an **edge function** (`generate-po-pdf`) that accepts PO data and returns a PDF using a Deno PDF library.
- The PDF includes: Company logo, PO number, date, supplier details, line items table (product, qty, unit cost, total), total amount, payment terms, and approval signature line.
- Arabic support: PDF will include both English and Arabic product names.
- The frontend calls the edge function and either:
  - Opens the PDF in a new tab for **printing**
  - Downloads it as a file

**New edge function:** `supabase/functions/generate-po-pdf/index.ts`

### Sending POs to Vendors

**Via Email:**
- Edge function `send-po-email` that generates the PDF and sends it as an email attachment to the supplier's email address.
- Uses Resend or similar email service (will check for available connector).
- Email body includes a summary of the PO in both English and Arabic.

**Via WhatsApp:**
- Leverages the existing WhatsApp Business integration (WHATSAPP_BUSINESS_TOKEN already configured).
- Edge function `send-po-whatsapp` sends a WhatsApp message to the supplier's whatsapp_number with PO summary text and a link to download the PDF.
- Uses the WhatsApp Business API document message type to attach the PDF.

**UI:**
- `src/components/inventory/SendPODialog.tsx` -- Choose send method (Email, WhatsApp, or both), preview message, confirm send. Updates `sent_via` and `sent_at` on the PO.

### Goods Receipt Process (Against Open POs)

**Workflow:**
1. Manager opens an approved/sent PO that has outstanding quantities.
2. Clicks "Receive Goods" which opens the Goods Receipt dialog.
3. System pre-fills expected quantities from PO line items minus already received.
4. Manager enters actual received quantities, batch numbers, and expiry dates per item.
5. On save:
   - Creates `goods_receipts` and `goods_receipt_items` records
   - Updates `purchase_order_items.quantity_received`
   - Recalculates Weighted Average Cost: `new_avg = ((old_stock * old_cost) + (received_qty * new_cost)) / (old_stock + received_qty)`
   - Updates `products.current_stock` and `products.cost_price`
   - Creates `inventory_transactions` entries (type: purchase_receipt)
   - Updates PO status to `partially_received` or `received` based on quantities

**UI components:**
- `src/components/inventory/ReceiveGoodsDialog.tsx` -- Line-by-line quantity entry with batch/expiry fields
- `src/components/inventory/GoodsReceiptHistory.tsx` -- View past receipts for a PO

### Vendor Invoice and Payment Process

**Invoice matching workflow:**
1. When goods are received, a vendor invoice can be created and linked to the PO.
2. Invoice total is validated against PO total (with configurable tolerance for price variances).
3. Invoice status tracks payment progress.

**Payment recording:**
1. From the Vendor Invoices tab, select an invoice and click "Record Payment".
2. Enter amount, payment method (Cash, Bank Transfer, Cheque, KNET), reference number.
3. System updates `paid_amount` on the invoice and recalculates status (partially_paid or paid).
4. Payment history is visible per invoice.

**Overdue tracking:**
- Invoices past their `due_date` with status not `paid` are automatically flagged as `overdue`.
- Dashboard widget shows overdue invoices count and total outstanding amount.

**UI components:**
- `src/components/inventory/VendorInvoicesTab.tsx` -- List invoices with status badges, filters by status and supplier
- `src/components/inventory/CreateInvoiceDialog.tsx` -- Create invoice linked to PO, enter invoice number, date, due date, amount
- `src/components/inventory/RecordPaymentDialog.tsx` -- Record partial or full payment
- `src/components/inventory/InvoiceDetailSheet.tsx` -- View invoice details, linked PO, payment history
- `src/hooks/useVendorInvoices.ts`
- `src/hooks/usePurchaseOrders.ts`

---

## Phase 3: Recipe Management, Financial Intelligence, and Advanced Features

### Recipe Management
- `src/components/inventory/RecipeManagement.tsx` -- Link products to services with quantities
- Database trigger on bookings (status = 'completed') auto-deducts stock per service recipes
- Recipe tab added to Service Detail Sheet

### Financial Reports
- Gross Profit per retail item
- Cost of Service report (recipe cost aggregation)
- Dead Stock warning (no transactions in 90 days)
- Top Seller highlight (highest margin retail items)
- Accounts Payable aging report (outstanding vendor invoices by age bucket)

### Advanced Features
- Barcode scanning via device camera
- Expiry tracking dashboard widget (products expiring within 30 days)
- Low Stock Alerts on main dashboard
- Auto-Draft PO from low-stock items using preferred suppliers

---

## Technical Notes

- All tables tenant-scoped with RLS
- The `inventory_clerk` role already exists in the `app_role` enum
- Arabic fields (`name_ar`) on products, categories, suppliers for RTL
- WAC formula: `new_avg = ((old_stock * old_cost) + (received_qty * new_cost)) / (old_stock + received_qty)`
- PDF generation in edge function avoids client-side library bloat
- WhatsApp integration reuses existing WHATSAPP_BUSINESS_TOKEN secret
- Phase 1 is the immediate deliverable; Phases 2 and 3 build incrementally

