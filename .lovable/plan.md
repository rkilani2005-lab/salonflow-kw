
# Point of Sale (POS) and Invoicing Module

## Overview
Build a full POS system for the Zaina salon app that integrates with existing bookings, inventory, clients, and services. The module supports walk-in retail sales, appointment checkout, split payments, discount approval workflows, tip tracking, and receipt generation.

## Database Schema

Create three new tables adapted to the existing multi-tenant architecture (using `tenant_id`, not `salon_id`, and referencing existing tables like `staff`, `clients`, `bookings`, `products`, `services`):

### Table: `transactions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID NOT NULL | Multi-tenant isolation |
| client_id | UUID | FK to clients.id, nullable for guest |
| staff_id | UUID | FK to staff.id (who processed) |
| booking_id | UUID | FK to bookings.id (optional link) |
| subtotal | NUMERIC(10,3) | Default 0 |
| discount_type | TEXT | 'percentage' or 'fixed' |
| discount_value | NUMERIC(10,3) | The raw discount input |
| discount_amount | NUMERIC(10,3) | Computed discount in KWD |
| discount_reason | TEXT | |
| discount_approved_by | UUID | FK to profiles.user_id |
| tax_amount | NUMERIC(10,3) | Uses tenant default_tax_rate |
| tip_amount | NUMERIC(10,3) | Tracked separately |
| grand_total | NUMERIC(10,3) | |
| status | TEXT | 'completed', 'refunded', 'voided' |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |

### Table: `transaction_items`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| transaction_id | UUID FK | CASCADE delete |
| item_type | TEXT | 'service' or 'product' |
| item_id | UUID | ID from services or products |
| item_name | TEXT | Snapshot at time of sale |
| item_name_ar | TEXT | Arabic snapshot |
| quantity | INTEGER | Default 1 |
| unit_price | NUMERIC(10,3) | Price at sale time |
| total_price | NUMERIC(10,3) | qty * unit_price |
| staff_commission_id | UUID | Who earns commission |

### Table: `transaction_payments`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| transaction_id | UUID FK | CASCADE delete |
| payment_method | TEXT | 'cash', 'knet', 'credit_card', 'gift_card' |
| amount | NUMERIC(10,3) | |

### RLS Policies
- All three tables use `tenant_id = get_user_tenant_id(auth.uid())` for SELECT
- INSERT restricted to owner, manager, receptionist, cashier roles
- Super admin can view all
- No DELETE (transactions are immutable -- void/refund via status change)

### Enum for transaction status
Create a `transaction_status` enum: `completed`, `refunded`, `voided`.

### Enum for payment method
Create a `pos_payment_method` enum: `cash`, `knet`, `credit_card`, `gift_card`.

## Frontend Architecture

### New Files to Create

1. **`src/hooks/useTransactions.ts`** -- Data hook for CRUD operations on transactions, items, and payments. Includes:
   - `useCreateTransaction` mutation that atomically inserts transaction + items + payments, deducts retail product stock, and marks linked booking as completed.
   - `useTransactions` query for listing transaction history.
   - `useTransactionById` for receipt detail view.

2. **`src/pages/POS.tsx`** -- Main POS page replacing the "Coming Soon" placeholder. Contains:
   - Two entry modes: "From Booking" (pre-loaded cart) and "Walk-in / Retail"
   - Client selector (search existing or "Guest")
   - The smart cart UI

3. **`src/components/pos/POSCart.tsx`** -- The cart component:
   - Lists cart items (services + products) with quantity controls
   - Product search bar with barcode scanner integration (reuses existing BarcodeScanner)
   - Real-time stock level check for retail products
   - Subtotal, discount, tax, tip, and grand total calculations
   - Large, touch-friendly iPad-optimized layout

4. **`src/components/pos/DiscountApprovalDialog.tsx`** -- Manager approval modal:
   - 4-digit PIN input or manager credential verification
   - Validates against user_roles table for manager/owner role
   - Blocks sale until approved

5. **`src/components/pos/PaymentDialog.tsx`** -- Split payment interface:
   - Large buttons for Cash, K-NET, Credit Card, Gift Card
   - Shows remaining balance as each payment method is added
   - Validates total payments equal grand total before finalizing

6. **`src/components/pos/ClientSelector.tsx`** -- Client picker:
   - Search by name/phone
   - "Guest" option
   - Shows VIP badge for VIP clients

7. **`src/components/pos/ProductSearch.tsx`** -- Product search for retail items:
   - Text search + barcode scanner button
   - Shows stock level, price, and product image
   - Filters to retail/both product types only

8. **`src/components/pos/ReceiptView.tsx`** -- Receipt generation:
   - Bilingual (EN/AR) receipt layout
   - Salon logo, transaction ID, itemized list, totals
   - "Print" button formatted for 80mm thermal printers (58mm content width)
   - "Download PDF" using print-to-PDF browser flow

9. **`src/components/pos/TipInput.tsx`** -- Tip entry component:
   - Toggle between fixed amount and percentage
   - Quick-select buttons (5%, 10%, 15%, custom)

### Files to Modify

1. **`src/App.tsx`** -- Replace the `/pos` ComingSoon route with the real POS page component.

2. **`src/components/calendar/AppointmentCard.tsx`** -- Add a "Checkout" button/action in the tooltip that navigates to `/pos?bookingId={id}` when the appointment status is `completed` or `in_service`.

## Key Business Logic

### Cart Calculation Flow
```text
Subtotal = SUM(item.quantity * item.unit_price)
Discount = based on type (% of subtotal or fixed amount)
Tax = (Subtotal - Discount) * tenant.default_tax_rate
Grand Total = Subtotal - Discount + Tax + Tip
```

### Discount Approval
- When staff applies any discount, a modal appears requiring manager PIN
- The PIN is verified by checking if a user with that credential has `manager` or `owner` role in `user_roles`
- The approver's `user_id` is stored in `discount_approved_by`

### Inventory Deduction
- On transaction commit, for each item where `item_type = 'product'`:
  - Decrement `products.current_stock` by `quantity`
  - Insert an `inventory_transactions` record with type `retail_sale`

### Booking Integration
- If transaction has a `booking_id`, update `bookings.status` to `completed`

## Receipt / Thermal Print
- The receipt uses a fixed-width layout (80mm paper = ~48 characters per line)
- CSS `@media print` rules hide non-receipt elements
- Bilingual: product names shown in both EN and AR
- Includes: salon name, date/time, staff name, itemized list, payment breakdown, tip line

## Technical Details

### Migration SQL Summary
- Create `transaction_status` and `pos_payment_method` enums
- Create `transactions`, `transaction_items`, `transaction_payments` tables
- Enable RLS on all three tables
- Add tenant-scoped policies using existing `get_user_tenant_id()` and `has_role()` functions
- Add `updated_at` trigger on `transactions`

### Component Hierarchy
```text
POS Page
+-- ClientSelector
+-- POSCart
|   +-- ProductSearch (with BarcodeScanner)
|   +-- TipInput
|   +-- DiscountApprovalDialog
+-- PaymentDialog
+-- ReceiptView
```

### Touch-First Design
- Minimum button size: 48x48px
- Large numeric inputs for quantities and tip amounts
- High-contrast colors for payment method buttons
- Responsive: works on iPad landscape and desktop
