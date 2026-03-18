# X-Estate CRM — Real Estate Sales Intelligence Platform

A production-ready **Real Estate CRM** built for agents and brokers to manage leads, automate outreach, track properties, and close deals faster — powered by AI analytics and seamless Google Sheets integration.

---

## 🏗 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui, Framer Motion |
| State | Zustand, TanStack React Query |
| Backend | Lovable Cloud (Supabase Edge Functions) |
| Database | PostgreSQL with Row-Level Security |
| AI | Google Gemini 2.5 Flash (transcription & evaluation) |
| Integrations | Google Sheets, Google Calendar, WhatsApp Business API, Email (Resend) |

---

## ✨ Core Features

### 📋 Lead Management
- Full lead pipeline with 7 stages: **New → Contacted → Viewing → Viewed → Negotiation → Closed → Lost**
- Priority classification: **Hot / Warm / Cold**
- Lead source tracking (Website, Referral, Cold Call, Social Media, Portal, Walk-in)
- Buyer/Seller lead types with detailed requirements (property type, bedrooms, budget, locations)
- Tags, notes, and file attachments per lead
- Bulk import from Google Sheets and CSV/Excel files

### 📞 Cold Calls Module
- Staging area for raw prospect data before pipeline conversion
- **Integrated click-to-call** with in-row `CallRecorder` component (timer + note-taking)
- **Auto-status update**: Initiating a call automatically marks the lead as `called` and updates `last_call_date`
- One-click **"Generate Lead"** to convert cold calls into pipeline leads (duplicate phone check)
- **Inline call history** per row — expandable section showing:
  - Call duration, direction, and status
  - Full transcript (AI-generated or agent notes)
  - AI evaluation scores and strengths/weaknesses analysis

### 🤖 AI-Powered Call Analytics
- **Transcription**: Audio recordings transcribed via Gemini 2.5 Flash; falls back to structured agent notes
- **Evaluation**: Each call scored on 4 dimensions:
  - Overall Quality (0–100)
  - Agent Confidence (0–100)
  - Lead Intent (0–100)
  - Closing Probability (0–100)
- Qualitative analysis: strengths, weaknesses, key quotes, and actionable recommendations
- **Agent KPIs**: Weekly/monthly metrics — answer rate, avg duration, AI score trends, conversion rate

### 🏠 Property Management
- Three-section inventory: **Database**, **Listings**, **Deals**
- Property types: Apartment, Villa, Townhouse, Penthouse, Studio, Commercial, Land
- Status workflow: Available → Under Offer → Sold → Rented
- Owner details, unit numbers, building info, and document management
- Property-to-lead matching with AI-powered match scoring
- Activity logging and notes per property
- Drag-and-drop status management with swipe actions (mobile)

### 🗺 Plots & Land Bank
- Plot tracking with size, GFA, floors allowed, zoning, and pricing
- **AI Feasibility Analysis**: Build potential, ROI range, risk notes, and recommendations
- Interested buyers and offers management per plot
- Activity logging and Google Sheets sync

### 🔄 Buyer-Property Matching
- Automated matching based on budget, bedrooms, location, and property type
- Match scoring algorithm with detailed match reasons
- Internal and external listing matching
- Send matched properties to leads via WhatsApp or email

### 📊 Dashboard & Analytics
- Real-time metrics: new leads, follow-ups due, viewings today, closed deals
- Pipeline funnel visualization
- Agent performance leaderboards
- Campaign performance charts and channel comparison
- Lead conversion funnel analytics
- ROI calculator

### 📨 Outreach & Campaigns
- **Multi-channel campaigns**: WhatsApp, Email, LinkedIn
- Campaign lifecycle: Draft → Scheduled → Running → Completed
- Per-lead delivery tracking (sent, delivered, read, replied)
- Follow-up template system with day-based sequencing
- **Automation engine**: Timezone-aware scheduling, stop conditions, retry logic
- Message queue with attempt tracking

### 📅 Calendar & Tasks
- Google Calendar integration (OAuth-based sync)
- Task management: Call, Viewing, Follow-up, Meeting, Document tasks
- Task status: Pending → Completed / Overdue
- Schedule viewings directly from lead or property views

### 📑 Templates
- Reusable message templates with variable interpolation
- Day-based follow-up sequences
- Support for WhatsApp and Email channels

### 🔗 Data Sync & Integration
- **Bidirectional Google Sheets sync** for leads, cold calls, properties, and plots
- Column mapping UI for flexible data source configuration
- Conflict resolution with sync logs
- CSV/Excel file import with column auto-detection
- Activity logging for all data changes

### 👥 Team & Access Control
- Role-based access: **Admin** and **Agent** roles
- Row-Level Security (RLS) on all tables
- Agents see only their assigned/created records
- Admins have full oversight across all data
- Profile management with avatar support

### ⚙️ Setup Wizard
- Guided onboarding for new workspaces
- Data source configuration (Google Sheets connections)
- API key management (Google, OpenAI)
- Step-by-step progress tracking

---

## 📁 Project Structure

```
src/
├── components/
│   ├── analytics/        # Charts, funnel, ROI calculator
│   ├── calls/            # CallRecorder, CallDetailPanel, analytics
│   ├── dashboard/        # Agent performance, pipeline, activities
│   ├── forms/            # Create/Edit dialogs for leads, properties, tasks
│   ├── layout/           # MainLayout, Sidebar navigation
│   ├── leads/            # SendTemplateDialog
│   ├── matching/         # Buyer-property matching cards & stats
│   ├── plots/            # Plot table, feasibility, dialogs
│   ├── properties/       # Property panels, filters, modals, swipe actions
│   ├── setup/            # Setup wizard steps & components
│   ├── sync/             # Sync conflict resolution
│   └── ui/               # shadcn/ui component library
├── hooks/                # Custom hooks for all domain logic
├── lib/                  # Utilities, formatters, matching algorithms
├── pages/                # Route-level page components
├── store/                # Zustand stores (CRM state, exports)
├── types/                # TypeScript type definitions
└── integrations/         # Auto-generated client & types

supabase/functions/
├── ai-assistant/         # AI matching & content generation
├── call-evaluate/        # AI call scoring & analysis
├── call-kpis/            # Agent performance metrics
├── call-transcribe/      # Audio/notes transcription
├── campaign-engine/      # Outreach campaign lifecycle
├── google-calendar/      # Calendar OAuth & sync
├── kimi-gateway/         # External agent adapter
├── parse-file/           # CSV/Excel ingestion
├── parse-sheet/          # Google Sheets parsing
├── plot-feasibility/     # AI plot analysis
├── send-email/           # Resend email delivery
├── send-whatsapp/        # WhatsApp Business API
├── sheets-sync/          # Bidirectional sheets sync
├── sync-data/            # Data synchronization engine
├── test-integration/     # Integration health checks
└── whatsapp-webhook/     # Delivery status callbacks
```

---

## 🗄 Database Schema

### Core Tables
| Table | Purpose |
|-------|---------|
| `leads` | Main lead pipeline with full CRM fields |
| `cold_calls` | Pre-pipeline prospect staging |
| `properties` | Property inventory (database, listings, deals) |
| `plots` | Land bank management |
| `tasks` | Follow-ups, viewings, meetings |
| `activities` | Timeline of all lead interactions |
| `messages` | Multi-channel message log |
| `profiles` | User profiles and team info |
| `user_roles` | Role-based access (admin/agent) |

### AI & Calls
| Table | Purpose |
|-------|---------|
| `called_calls` | Call logs with transcripts & AI scores |
| `call_kpis` | Aggregated agent performance metrics |
| `call_webhook_logs` | External call provider events |

### Campaigns & Automation
| Table | Purpose |
|-------|---------|
| `campaigns` | Multi-channel outreach campaigns |
| `campaign_leads` | Per-lead campaign delivery status |
| `automation_queue` | Scheduled message queue |
| `automation_logs` | Automation event history |
| `follow_up_templates` | Reusable message templates |

### Properties & Matching
| Table | Purpose |
|-------|---------|
| `property_matches` | Lead-property match records |
| `property_notes` | Property-level notes |
| `plot_feasibility` | AI feasibility analysis results |
| `plot_interested_buyers` | Buyer interest tracking |
| `plot_offers` | Offer management per plot |

### Integration & Config
| Table | Purpose |
|-------|---------|
| `data_sources` | Google Sheets & file connections |
| `api_integrations` | External API credentials |
| `channel_credentials` | WhatsApp/Email provider keys |
| `email_provider_config` | Email delivery settings & warmup |
| `sync_logs` | Data sync audit trail |
| `setup_wizard_progress` | Onboarding state |

---

## 🔒 Security

- **Row-Level Security (RLS)** enabled on all tables
- Agents can only access their assigned/created records
- Admins have unrestricted access via `is_admin()` function
- Lead access controlled via `can_access_lead()` helper
- All API keys stored encrypted in backend — never exposed to client
- Edge Functions use service role keys server-side only

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

---

## 📄 License

Private — All rights reserved.
