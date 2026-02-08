

# WhatsApp AI Agent with Voice Message Support - Enhanced Plan

## Overview
Build a comprehensive AI-driven WhatsApp integration for ZAINA that operates in two modes: **Customer Booking Assistant** (automatic for customers) and **Business Intelligence Manager** (for owners/staff). **NEW: The system will also understand and respond to voice messages from customers**, transcribing them in real-time and processing them like text messages.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ZAINA WhatsApp AI System with Voice                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐        │
│  │   WhatsApp   │────▶│   Edge Function  │────▶│   Lovable AI     │        │
│  │   Webhook    │     │  (whatsapp-agent)│     │ (gemini-3-flash) │        │
│  └──────┬───────┘     └────────┬─────────┘     └──────────────────┘        │
│         │                      │                                            │
│         │ Voice Messages       │                                            │
│         ▼                      │                                            │
│  ┌──────────────┐              │                                            │
│  │  ElevenLabs  │──────────────┘                                            │
│  │    Scribe    │  (Transcription)                                          │
│  │  (scribe_v2) │                                                           │
│  └──────────────┘                                                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                        Supabase Database                         │       │
│  │  ┌─────────────┬──────────────┬─────────────┬────────────────┐  │       │
│  │  │  bookings   │   services   │    staff    │ whatsapp_chats │  │       │
│  │  └─────────────┴──────────────┴─────────────┴────────────────┘  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                      Dashboard UI                                │       │
│  │  ┌────────────────────┬─────────────────────────────────────┐   │       │
│  │  │ Settings & Config  │  Live Chat Simulator (Split View)   │   │       │
│  │  │ - Owner numbers    │  ┌──────────┐    ┌──────────────┐   │   │       │
│  │  │ - Voice settings   │  │ Customer │    │ Admin Query  │   │   │       │
│  │  │ - Enable/disable   │  │   Mode   │    │    Mode      │   │   │       │
│  │  │ - Handoff rules    │  │ + Voice  │    └──────────────┘   │   │       │
│  │  └────────────────────┴──┴──────────┴───────────────────────┘   │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Schema

### New Tables

**1. `whatsapp_config` - Tenant-specific WhatsApp settings**
- id: uuid (PK)
- tenant_id: uuid (FK to tenants)
- is_enabled: boolean
- owner_phone_numbers: text[] (verified owner numbers)
- staff_phone_numbers: text[] (verified staff numbers)
- welcome_message_en: text
- welcome_message_ar: text
- voice_enabled: boolean (NEW - enable voice message processing)
- max_retry_attempts: integer (default: 2)
- created_at, updated_at: timestamps

**2. `whatsapp_conversations` - Chat history and state**
- id: uuid (PK)
- tenant_id: uuid (FK to tenants)
- phone_number: text
- conversation_type: enum ('customer', 'admin')
- conversation_state: jsonb (booking flow state)
- needs_human_intervention: boolean
- intervention_reason: text
- last_message_at: timestamp
- created_at: timestamp

**3. `whatsapp_messages` - Individual message log**
- id: uuid (PK)
- conversation_id: uuid (FK to whatsapp_conversations)
- direction: enum ('inbound', 'outbound')
- message_content: text
- detected_language: enum ('en', 'ar')
- message_type: enum ('text', 'voice', 'booking_offer', 'report', 'handoff') - **NEW: 'voice' type**
- original_audio_url: text (NEW - store voice message URL)
- transcription: text (NEW - store voice transcription)
- metadata: jsonb (slot options, report data, transcription confidence, etc.)
- created_at: timestamp

**4. `expenses` - For owner expense tracking queries**
- id: uuid (PK)
- tenant_id: uuid (FK to tenants)
- category: text (supplies, rent, utilities, etc.)
- description: text
- amount: numeric
- expense_date: date
- created_at: timestamp

### RLS Policies
- Conversations and messages scoped to tenant_id
- Config table: owners/managers can read/write
- Messages: read-only for authenticated users in tenant

---

## Phase 2: Edge Functions

### 1. `whatsapp-webhook` - Incoming message handler
**Responsibilities:**
- Receive WhatsApp webhook payloads
- Validate webhook signature
- Detect message type (text vs voice)
- Route to appropriate handler

### 2. `whatsapp-transcribe` - Voice Message Transcription (NEW)
**Responsibilities:**
- Receive voice message audio from WhatsApp
- Download the audio file using WhatsApp Media API
- Send to ElevenLabs Scribe API (`scribe_v2`) for transcription
- Detect language (English/Arabic) automatically
- Return transcribed text with confidence score

**Implementation:**
```typescript
// Fetch audio from WhatsApp
const audioResponse = await fetch(mediaUrl, {
  headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
});
const audioBuffer = await audioResponse.arrayBuffer();

// Transcribe with ElevenLabs Scribe
const formData = new FormData();
formData.append('file', new Blob([audioBuffer]), 'voice.ogg');
formData.append('model_id', 'scribe_v2');
formData.append('language_code', 'auto'); // Auto-detect EN/AR

const transcription = await fetch(
  'https://api.elevenlabs.io/v1/speech-to-text',
  {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    body: formData
  }
);
```

### 3. `whatsapp-agent` - Core AI processing
**Responsibilities:**
- Accept both text messages AND transcribed voice text
- Detect language (English/Arabic) from message
- Determine user type (customer vs owner/staff)
- Process customer booking requests:
  - Parse intent (book, reschedule, cancel)
  - Query available slots from bookings + staff schedules
  - Offer 2-3 time options
  - Confirm and create booking
- Process admin queries:
  - Natural language to database query
  - Revenue summaries (daily, weekly, monthly)
  - Customer insights (top clients, popular services)
  - Expense tracking
- Handle handoff logic (flag after 2 failed attempts)

**Voice-Specific Handling:**
- Store original audio URL for reference
- Log transcription alongside message
- Handle low-confidence transcriptions (ask for clarification)

### 4. `whatsapp-send` - Outbound message sender
**Responsibilities:**
- Format messages for WhatsApp API
- Handle RTL formatting for Arabic
- Send confirmation messages
- Trigger daily summary reports

---

## Phase 3: Voice Message Flow (NEW)

### Customer Voice Message Processing

```text
1. Customer sends voice message on WhatsApp
   ↓
2. WhatsApp webhook receives audio message
   ↓
3. Download audio from WhatsApp Media API
   ↓
4. Send to ElevenLabs Scribe API
   - Model: scribe_v2 (batch transcription)
   - Auto-detect language (EN/AR)
   - Get word-level timestamps
   ↓
5. Store transcription in whatsapp_messages
   - message_type: 'voice'
   - original_audio_url: WhatsApp media URL
   - transcription: "أريد حجز موعد غداً"
   - detected_language: 'ar'
   ↓
6. Process transcribed text through AI agent
   (Same flow as text messages)
   ↓
7. Send text response back to customer
   ↓
8. If transcription confidence < 80%:
   → Ask customer to repeat or type message
   EN: "I didn't quite catch that. Could you please type your request?"
   AR: "لم أفهم جيداً. هل يمكنك كتابة طلبك؟"
```

### Supported Voice Scenarios

**Booking via Voice:**
- Customer: [Voice] "أبي أحجز موعد قص شعر يوم الثلاثاء" (I want to book a haircut on Tuesday)
- AI: Transcribes → Detects Arabic → Parses intent → Offers slots in Arabic

**Service Inquiry via Voice:**
- Customer: [Voice] "What services do you offer?"
- AI: Transcribes → Detects English → Lists services with prices

**Cancellation via Voice:**
- Customer: [Voice] "I need to cancel my appointment tomorrow"
- AI: Transcribes → Finds booking → Confirms cancellation

---

## Phase 4: AI Agent Logic

### Customer Mode Flow (Text & Voice)
```text
1. Customer sends message (text OR voice)
   ↓
2. If voice message:
   a. Download audio from WhatsApp
   b. Transcribe with ElevenLabs Scribe
   c. Log original audio + transcription
   ↓
3. Detect language (auto from text/transcription)
   ↓
4. Parse intent:
   - "I want to book" → Booking flow
   - "What services?" → List services
   - "Cancel my appointment" → Cancellation flow
   ↓
5. Booking Flow:
   a. Ask for service preference
   b. Query available slots (bookings + staff schedules)
   c. Offer 2-3 options: "Option 1: Tue 10am, Option 2: Wed 3pm..."
   d. Customer selects → Create booking → Send confirmation
   ↓
6. If AI cannot understand after 2 attempts:
   → Flag for human intervention
   → Notify salon manager
```

### Admin Mode Flow
```text
1. Owner/staff sends message (text only for security)
   ↓
2. Verify phone number against whatsapp_config
   ↓
3. Parse query type:
   - "Revenue today?" → Query bookings, sum prices
   - "Weekly sales?" → Aggregate by week
   - "Top customers?" → Group by client, count visits
   - "Most popular service?" → Group by service_name
   - "Expenses this month?" → Query expenses table
   ↓
4. Format response with:
   - Summary text (bilingual)
   - Key metrics highlighted
   - Comparison to previous period (if applicable)
```

### Security Guardrails
- Financial data ONLY accessible to verified owner/staff phones
- Customer queries cannot access revenue/expense data
- Phone number verification against stored config
- Server-side validation only (never client-side)
- Voice messages from admin phones still require text verification for sensitive data

---

## Phase 5: Dashboard UI

### New Page: `/whatsapp-agent`

**Design: Edgy AI aesthetic (Dark mode primary)**
- Background: Charcoal (#111827)
- Accent: Gold (#D4AF37) with Cyber elements
- Cards: Dark with subtle gold borders
- Typography: Space Grotesk for headings

### Settings Panel (Left Side)
```text
┌─────────────────────────────────────┐
│  WhatsApp AI Agent                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  [Toggle] Enable WhatsApp Agent     │
│                                     │
│  [Toggle] Enable Voice Messages ◀── NEW
│                                     │
│  Owner Phone Numbers               │
│  ┌─────────────────────────────┐   │
│  │ +965 9876 5432  [x]         │   │
│  │ [+ Add Number]              │   │
│  └─────────────────────────────┘   │
│                                     │
│  Staff Phone Numbers               │
│  ┌─────────────────────────────┐   │
│  │ +965 1234 5678  [x]         │   │
│  │ [+ Add Number]              │   │
│  └─────────────────────────────┘   │
│                                     │
│  Welcome Messages                  │
│  ┌─────────────────────────────┐   │
│  │ English: "Welcome to..."    │   │
│  │ Arabic: "أهلاً وسهلاً..."     │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Save Settings]                   │
└─────────────────────────────────────┘
```

### Live Simulator (Right Side - Split View)

**Customer Mode Tab (with Voice Indicator):**
```text
┌─────────────────────────────────────┐
│  📱 Customer Simulator             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  [Customer voice bubble - NEW]     │
│  ┌─────────────────────────────┐   │
│  │ 🎤 Voice Message (0:05)     │ ◀│
│  │ "أريد حجز موعد للشعر"       │   │ ◀── Transcription shown
│  └─────────────────────────────┘   │
│                                     │
│                [AI response]       │
│  ▶│ ┌─────────────────────────┐   │
│    │ "أهلاً! لدينا هذه المواعيد   │   │
│    │ المتاحة:                  │   │
│    │ 1️⃣ الثلاثاء 10 صباحاً     │   │
│    │ 2️⃣ الأربعاء 3 مساءً       │   │
│    └─────────────────────────┘   │
│                                     │
│  ┌──────────────────────┬─────┐   │
│  │ Type or record... 🎤 │ [▶] │   │ ◀── NEW: Voice input option
│  └──────────────────────┴─────┘   │
└─────────────────────────────────────┘
```

**Admin Mode Tab:**
```text
┌─────────────────────────────────────┐
│  👔 Admin Query Simulator          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  [Admin bubble]                    │
│  ┌─────────────────────────────┐   │
│  │ "What was revenue today?"   │ ◀│
│  └─────────────────────────────┘   │
│                                     │
│                [AI response]       │
│  ▶│ ┌─────────────────────────┐   │
│    │ 📊 Today's Revenue       │   │
│    │ ━━━━━━━━━━━━━━━━━━━━━━━  │   │
│    │ Total: 485 KWD           │   │
│    │ Appointments: 12         │   │
│    │ Avg per booking: 40 KWD  │   │
│    │                          │   │
│    │ +12% vs yesterday 📈     │   │
│    └─────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Ask ZAINA anything...  [▶] │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Conversation Log Panel
- List of flagged conversations needing human intervention
- Voice messages show 🎤 icon with transcription
- Click to view full chat history including audio playback
- Mark as resolved action

---

## Phase 6: Handoff Logic

### Trigger Conditions
1. AI cannot parse intent after 2 messages (text or voice)
2. Voice transcription confidence below 60% twice in a row
3. Customer explicitly requests human help
4. Complex query outside AI capabilities

### Handoff Flow
```text
1. Flag conversation in database:
   - needs_human_intervention = true
   - intervention_reason = "AI could not understand voice message"

2. Send message to customer:
   EN: "I'm connecting you with our team. They'll respond shortly!"
   AR: "سأوصلك بفريقنا. سيردون عليك قريباً!"

3. Notify salon manager:
   - Dashboard notification badge
   - Optional: WhatsApp message to owner phone
```

---

## Technical Details

### Required API Keys/Secrets (NEW)
- `ELEVENLABS_API_KEY` - For voice transcription (Scribe API)
- `WHATSAPP_BUSINESS_TOKEN` - For WhatsApp Business API
- `WHATSAPP_PHONE_NUMBER_ID` - WhatsApp phone number ID
- `WHATSAPP_VERIFY_TOKEN` - Webhook verification token

### Files to Create

**Edge Functions:**
- `supabase/functions/whatsapp-webhook/index.ts` - Webhook handler
- `supabase/functions/whatsapp-transcribe/index.ts` - Voice transcription (NEW)
- `supabase/functions/whatsapp-agent/index.ts` - Core AI logic
- `supabase/functions/whatsapp-send/index.ts` - Outbound messages

**Frontend Components:**
- `src/pages/WhatsAppAgent.tsx` - Main settings page
- `src/components/whatsapp/WhatsAppSettings.tsx` - Config panel
- `src/components/whatsapp/ChatSimulator.tsx` - Interactive simulator
- `src/components/whatsapp/VoiceRecorder.tsx` - Voice input for simulator (NEW)
- `src/components/whatsapp/VoiceMessageBubble.tsx` - Display voice messages (NEW)
- `src/components/whatsapp/ConversationLog.tsx` - Message history
- `src/components/whatsapp/MessageBubble.tsx` - RTL-aware chat bubble
- `src/hooks/useWhatsAppConfig.ts` - Config CRUD hook
- `src/hooks/useWhatsAppSimulator.ts` - Simulator state hook

**Styling:**
- Dark mode theme with gold accents
- RTL support for Arabic messages
- Voice waveform visualization for audio messages
- Responsive split-panel layout

### Database Migration
- Create 4 new tables with RLS
- Add `whatsapp_agent` nav item to sidebar
- Enable realtime for conversations table

---

## Implementation Order

1. **Database Schema** - Create tables, RLS, triggers
2. **Secrets Setup** - Request ElevenLabs API key from user
3. **Voice Transcription Function** - ElevenLabs Scribe integration
4. **Core Agent Function** - AI processing with voice support
5. **WhatsApp Settings UI** - Config management with voice toggle
6. **Chat Simulator** - Interactive testing with voice input
7. **Conversation Log** - View flagged conversations with audio
8. **Navigation Update** - Add sidebar link
9. **Integration Testing** - End-to-end flows including voice

---

## Voice Message Specifications

### Supported Audio Formats
- OGG/Opus (WhatsApp default)
- MP3
- WAV
- M4A

### Language Support
- English (eng)
- Arabic (ara)
- Auto-detection mode

### Transcription Limits
- Max audio duration: 5 minutes per message
- Response time: ~2-3 seconds for short messages

### Error Handling
- Network timeout: Retry up to 2 times
- Transcription failure: Ask customer to type instead
- Low confidence (<60%): Request clarification

---

## Security Considerations

- Owner/staff phone verification is server-side only
- Financial data queries restricted to verified phones
- RLS policies enforce tenant isolation
- Webhook signature validation prevents spoofing
- No customer access to revenue/expense data
- Voice messages from admin phones require text verification for sensitive operations
- Audio files are not stored permanently (only transcriptions)

