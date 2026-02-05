

# SalonFlow Kuwait - Complete Implementation Plan

## Overview
A comprehensive multi-tenant SaaS platform for Ladies Salons in Kuwait with subscription billing, advanced booking calendar with drag-and-drop, and business automation capabilities.

---

## Phase 0: Foundation & Infrastructure

### 0.1 Database Architecture (Supabase)
- **Multi-tenant schema** with strict RLS isolation
- **Core tables**: 
  - `tenants` (company info, subscription status, trial dates, add-on flags)
  - `branches` (per-tenant locations with operating hours)
  - `plans` (Starter 29 KWD, Professional +16 KWD, AI +14 KWD)
  - `user_roles` (separate table for RBAC - Owner, Manager, Receptionist, Cashier, Stylist, Inventory Clerk, Accountant, Read-only)
  - `profiles` (user details linked to tenant/branch)
  - `audit_logs` (sensitive action tracking)
- **KWD currency** with 3 decimal precision throughout
- **Feature flag functions** for subscription-based access control

### 0.2 Authentication & Onboarding Wizard
- **Sign-up**: Email/Password → Auto-create tenant → Assign Owner role → Start 14-day trial
- **Forced onboarding wizard** before dashboard:
  1. Salon details (name, logo, default tax 0%)
  2. First branch setup (name, address, opening hours)
  3. First staff member creation
  4. Completion with confetti celebration
- **Trial management**: Day 7 & 12 reminders, expiry lock with upgrade prompt

### 0.3 App Shell & Navigation
- Branch switcher in header (always visible)
- Role-based sidebar navigation
- Premium feature overlays (not 404s) for locked modules
- Arabic/English toggle with RTL support

---

## Phase 1: Core Salon Operations

### 1.1 Staff & Resource Management
- **Staff profiles** per branch:
  - Name, avatar, contact, working hours, breaks
  - Service skills (which services they can perform)
  - Color assignment for calendar display
- **Resources** per branch:
  - Rooms, chairs, machines (Laser Room, Nail Station, Facial Machine)
  - Capacity and availability scheduling
- Services can require: 1 staff + optional 1 resource

### 1.2 Booking Calendar (Versum-Style with Drag & Drop)

#### Calendar Layout
- **Header bar**: Date navigation, "Today" button, Day/Week/Month view toggles
- **Two-panel design**:
  - Left: Collapsible staff roster sidebar with mini calendar
  - Right: Multi-column calendar grid

#### Staff Roster Sidebar
- Mini calendar for quick date jumping
- Staff list with:
  - Checkbox to show/hide each employee's column
  - Avatar, name, and color indicator
  - Current status (available, busy, break)
- Collapse button to maximize calendar space

#### Multi-Column Day View (Primary)
- **Horizontal columns**: One per visible staff member
- **Vertical time slots**: 15-minute intervals (opening to closing)
- **Column headers**: Staff name, working hours indicator
- **Time gutter**: Left-side time labels

#### Appointment Cards
- Color-coded by service category
- Display: Client name, service, duration
- Status indicators (Planned, Confirmed, Checked-in, In Service, Completed)
- Hover tooltip with full details
- Right-click context menu (Edit, Cancel, Check-in, Complete)

#### Drag & Drop Functionality
- **Vertical drag**: Change appointment time (snap to 15-min grid)
- **Horizontal drag**: Reassign to different staff
- **Visual feedback**: Ghost preview while dragging
- **Conflict detection**: 
  - Highlight blocked slots during drag
  - Prevent drop on occupied times or unavailable staff
  - Toast notification explaining conflicts
- **Drop confirmation**: Quick confirm dialog with option to notify client

#### Click-to-Create Booking
- Click empty slot → Opens booking form modal
- Pre-fills staff and time from click location
- **Booking Form Modal**:
  - Client search/selection (or quick-create new)
  - Service selection with auto-duration
  - Staff assignment (pre-selected)
  - Resource selection if service requires it
  - Date/time picker with buffer options
  - Deposit toggle, notes field

#### Booking Status Workflow
Planned → Confirmed → Checked-In → In Service → Completed
(+ Cancelled/No-show branches)

### 1.3 Client CRM & Loyalty
- **Client profiles**: Name, mobile, preferences, allergies, visit history, balance
- **VIP/Normal tier** with configurable rules
- **Packages/Memberships**: Sell bundles (5 blow-dries, 10 sessions), track consumption
- **Marketing automation** (Professional tier):
  - Birthday reminders with offers
  - Win-back campaigns (no visit for X days)
  - VIP-only promotions
- Reminder framework (email/SMS placeholders, WhatsApp-ready)

### 1.4 POS System (Tablet PWA, Offline-First)
- **2-column tablet layout**: Services/Products grid | Cart
- **Offline support**: IndexedDB caching, sync with conflict handling
- **Cart features**:
  - Services + retail products on one invoice
  - Quick add (manual item entry)
  - Discount with role-based approval
  - Tips support
  - Split payment (Cash/KNET)
- **Cash drawer sessions**: Open → In/Out → Close → End-of-Day per device
- Link to booking for service completion

### 1.5 Inventory Module
- **Branch-specific stock** management
- **Product catalog**: SKU, barcode, UoM, cost, selling price, min stock, supplier
- **Stock movements**: Purchase receipt, branch transfers, adjustments, returns
- **Service consumption (BOM)**: Define products/qty consumed per service
- **Operational rules**:
  - Stylists: "Consume from stock" during service completion
  - Reception/Cashier: Sell retail products via POS
- **Alerts**: Low stock, fast/slow movers, shrinkage indicators

---

## Phase 2: Staff Performance & Commissions

### 2.1 Attendance System
- Mobile-friendly punch in/out per branch
- Track: Late arrivals, absences, working hours
- Branch/location selection on punch

### 2.2 Performance Metrics
- Services performed, sales value, retail upsell
- Rebooking rate, client ratings (optional)
- Staff utilization percentage

### 2.3 Commission Engine
- **Configurable rules** per role/service/product/branch:
  - % commission on service revenue
  - % commission on retail sales
  - Monthly target bonuses
- Commission ledger per employee
- Approval workflow and payout status

---

## Phase 3: Advanced Customization

### 3.1 Custom Screen Builder (Form Builder)
- Add custom fields to: Client, Booking, Invoice, Product, Staff, Resource
- Field types: Text, number, date, dropdown, multi-select, checkbox, file
- Layout builder with sections/tabs
- Field rules: Required, visible-if, read-only by role
- Tenant-level with optional branch overrides

### 3.2 Custom Report Builder
- Data sources: Bookings, Sales, Clients, Inventory, Attendance, Commissions
- Column selection including custom fields
- Filters, grouping, pivots (sum/count/avg)
- Save, share by role, export CSV
- Dashboard tiles from saved reports

### 3.3 Workflow Automation Engine
- **Triggers**: Booking changes, low stock, discount threshold, refund, no-visit X days, birthday, commission pending
- **Conditions**: Branch, role, amounts, VIP tier, service category, time
- **Actions**: Notifications, task creation, email/SMS placeholder, auto-assign
- Audit log and enable/disable per workflow

---

## Phase 4: AI Layer (Premium Add-on - +14 KWD)

### 4.1 Tenant AI Assistant
- Chat interface for owners/managers
- Natural language queries: "Revenue by branch last week", "Stylists with best rebooking rate"
- Dynamic report generation
- Role-based data visibility, explainable calculations

### 4.2 AI Insights Engine
- Proactive daily/weekly notifications:
  - Sales anomalies, cancellation spikes
  - Low stock risk, staff utilization imbalance
  - Customer churn risk, upsell opportunities
- One-click workflow/report creation from insights

### 4.3 Platform Owner Dashboard
- Global admin (no cross-tenant leakage)
- Metrics: Tenant count, GMV, MAU/DAU, retention, churn risk
- Feature usage analytics
- SaaS owner AI assistant

---

## Phase 5: Accounting MVP

- Basic chart of accounts template
- Auto-posting: POS → Revenue/Cash, Purchases → Inventory/Payables, Consumption → COGS
- Reports: Sales by day/service/staff/branch, cash session summary, inventory valuation, P&L

---

## Subscription Management

### Plan Overview Card
- Current plan display with status (Active/Trial/Overdue)
- Dynamic calculator: Base + Professional Pack + AI Add-on = Total (KWD 3 decimals)
- Upgrade toggles with instant price preview

### Feature Guardrails
- Premium Feature overlay for locked modules (Marketing, AI, Commission Engine)
- Clear upgrade CTA with value proposition

---

## Demo Data (Kuwait Context)

- **2 branches**: Salmiya, Hawally
- **10 staff**: Fatima, Noura, Sara, Maryam, Huda, etc. with varied skills/hours
- **8 resources**: Laser Room 1 & 2, Nail Stations, Facial Machine, Hair Stations
- **40 services**: Hair styling, nails, facials, makeup, waxing, etc.
- **80 products**: Shampoo, dye, nail polish, skincare items
- **200 clients**: Mix of VIP and Normal tiers

---

## Technical Architecture

### Stack
- **Backend**: Supabase (Auth + Database + RLS + Edge Functions)
- **Frontend**: React, Tailwind CSS, Shadcn UI, TanStack Query
- **Offline**: IndexedDB for POS persistence
- **Calendar**: @dnd-kit for drag-and-drop interactions

### Key Components
```
src/
├── pages/
│   ├── Index.tsx (Landing/Login)
│   ├── Onboarding.tsx (Setup wizard)
│   ├── Dashboard.tsx (Role-based home)
│   ├── Calendar.tsx (Booking calendar)
│   ├── Clients.tsx
│   ├── POS.tsx
│   ├── Inventory.tsx
│   ├── Staff.tsx
│   ├── Settings.tsx
│   └── Subscription.tsx
├── components/
│   ├── calendar/
│   │   ├── CalendarHeader.tsx
│   │   ├── StaffRosterSidebar.tsx
│   │   ├── MiniCalendar.tsx
│   │   ├── CalendarGrid.tsx
│   │   ├── StaffColumn.tsx
│   │   ├── AppointmentCard.tsx
│   │   └── BookingFormDialog.tsx
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   └── BranchSwitcher.tsx
│   └── subscription/
│       ├── PlanCard.tsx
│       └── FeatureGate.tsx
├── contexts/
│   ├── TenantContext.tsx
│   └── SubscriptionContext.tsx
├── hooks/
│   ├── useCalendarDragDrop.ts
│   └── useFeatureAccess.ts
└── types/
    ├── tenant.ts
    ├── booking.ts
    └── calendar.ts
```

---

## Future Roadmap (Post-MVP)

- WhatsApp Business API integration
- KNET/MyFatoorah payment gateway
- Advanced accounting & payroll export
- Online appointment deposits
- Customer mobile app
- Enterprise API integrations

