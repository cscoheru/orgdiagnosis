# DeepConsult Copilot — Comprehensive Project Summary

> AI-powered organizational diagnosis and consulting report generation system.
> From Five-Dimension Organization Diagnosis to Structured Project Proposal Automatic Generation.

---

## 1. Project Overview

**DeepConsult Copilot** is a full-stack platform that combines AI-driven analysis with interactive visual tools to help consultants diagnose organizational issues and generate professional deliverables. The system supports the complete consulting workflow: from requirement gathering through knowledge retrieval, collaborative workshop facilitation, to high-fidelity PPTX export.

### Core Capabilities

| Capability | Description |
|---|---|
| **Five-Dimension Diagnosis** | Organization structure, business process, technology, people/capability, culture evaluation |
| **AI Report Generation** | Multi-level content expansion: module → page title → slide content → PPTX |
| **Workshop Co-creation** | MindManager-like collaborative canvas for structured brainstorming |
| **Competency Co-pilot** | Skill assessment radar charts with AI-powered evaluation |
| **Knowledge Base** | Document upload, parsing (PDF/DOCX/XLSX/OCR), vector search via ChromaDB |
| **Kernel Database** | ArangoDB-backed flexible object/relation graph (ConsultingOS) |
| **Layout Engine** | Smart PPT template matching and content-aware layout adaptation |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Vercel (HK Region)                      │
│                    Next.js 16 + React 19                     │
│                   https://org-diagnosis.3strategy.cc          │
└──────────────────────────┬──────────────────────────────────┘
                           │ API calls
┌──────────────────────────▼──────────────────────────────────┐
│              Nginx Reverse Proxy (HK Server)                  │
│                   103.59.103.85                               │
│              SSL termination + routing                        │
└──────┬───────────────┬───────────────┬──────────────────────┘
       │               │               │
┌──────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
│ FastAPI     │ │ ArangoDB    │ │ MinIO      │
│ (Docker)    │ │ (Docker)    │ │ (Docker)   │
│ :8000       │ │ :8529       │ │ :9001      │
│ LangChain   │ │ Kernel DB   │ │ Object     │
│ LangGraph   │ │ Graph data  │ │ Storage    │
│ ChromaDB    │ │             │ │            │
└─────────────┘ └─────────────┘ └────────────┘
       │
┌──────▼──────────────────────────────────────┐
│ Supabase (Cloud)                            │
│ • PostgreSQL — user auth, project metadata  │
│ • Row Level Security                        │
└─────────────────────────────────────────────┘
```

### Data Flow

```
User Input → Requirement Structuring → AI Module Generation
    → LangGraph Workflow (human-in-the-loop)
    → Content Expansion (module → slides → PPTX)
    → Preview → Export
```

---

## 3. Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.1.7 | App framework (App Router) |
| React | 19.2.3 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| ReactFlow | 11.11.4 | Node-based canvas (workshop, layout editor) |
| ELK.js | 0.11.1 | Automatic graph layout |
| Recharts | 3.8.0 | Charts and visualizations |
| Zhipu AI | 2.0.0 | Chinese LLM client |
| html2canvas + jsPDF | 4.2.0 | PDF/image export |
| Tesseract.js | 7.0.0 | Browser-side OCR |
| Supabase JS | 2.99.2 | Auth and database client |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| FastAPI | 0.115+ | REST API framework |
| Python | 3.11 | Runtime |
| Uvicorn | 0.32+ | ASGI server |
| LangChain | 0.3.14 | AI orchestration |
| LangGraph | 0.2.59 | Workflow/state machine |
| DeepSeek API | — | Primary LLM for content generation |
| DashScope (Qwen) | 1.14+ | Alternative LLM, embeddings |
| ChromaDB | 0.5.23 | Vector storage for RAG |
| LlamaIndex | 0.10.68 | RAG pipeline |
| python-pptx | 0.6.23 | PPTX generation |
| Supabase Python | — | Auth and database |
| MinIO | 7.2+ | S3-compatible object storage |
| ArangoDB | — | Graph database (kernel) |
| pdfplumber + pymupdf | — | PDF parsing |
| python-docx + openpyxl | — | DOCX/XLSX parsing |
| SlowAPI | — | Rate limiting |

### Testing

| Tool | Version | Purpose |
|---|---|---|
| Vitest | 4.1.2 | Unit test runner |
| @testing-library/react | 16.3.2 | Component testing |
| @testing-library/jest-dom | 6.9.1 | DOM assertions |
| Playwright | 1.58.2 | E2E testing |
| jsdom | 29.0.1 | Browser environment simulation |

### Infrastructure

| Component | Technology |
|---|---|
| Containerization | Docker |
| Reverse Proxy | Nginx |
| Frontend Hosting | Vercel (hkg1 region) |
| Backend Hosting | Bare metal Docker (HK) |
| CI/CD | Manual via `deploy.sh` |

---

## 4. Project Structure

```
org-diagnosis/
├── app/                          # Next.js App Router pages
│   ├── (auth)/login/             # Authentication
│   ├── (dashboard)/
│   │   ├── input/                # Requirement input
│   │   ├── kernel/               # Kernel DB browser & graph viewer
│   │   ├── knowledge/            # Knowledge base (upload, search, documents)
│   │   ├── projects/[id]/        # Project detail (diagnosis, proposal, delivery)
│   │   ├── report/               # Report workspace & preview
│   │   ├── workshop/             # Workshop features
│   │   │   ├── cocreate/[id]/    # MindManager-like co-creation canvas
│   │   │   └── competency/       # Competency co-pilot
│   │   ├── templates/            # PPT template management
│   │   └── layouts/[id]/         # Layout editor
│   └── api/                      # Next.js API routes (file parsing, diagnosis proxy)
│
├── components/
│   ├── workshop/                 # Workshop module components
│   │   ├── CoCreateCanvas.tsx    # Main canvas (ReactFlow + ELK layout)
│   │   ├── SmartNode.tsx         # Custom node with inline editing
│   │   ├── CompetencyExplorer.tsx
│   │   ├── EvaluationMatrix.tsx
│   │   └── TaggingSidebar.tsx
│   ├── workflow/                 # Multi-step workflow components (20+ steps)
│   ├── layout-editor/            # Visual PPT layout editor
│   ├── kernel/                   # Graph viewer, object browser
│   ├── document-preview/         # DOCX/PPTX/XLSX preview
│   ├── file-manager/             # File upload and folder tree
│   ├── charts/                   # Radar, bar charts for diagnosis
│   └── workspace/                # Slide preview and template management
│
├── lib/
│   ├── api/                      # API client modules
│   │   ├── workshop-api.ts       # Workshop CRUD + AI suggestions
│   │   ├── kernel-client.ts      # Kernel object/relation API
│   │   ├── workflow-client.ts    # Workflow state management
│   │   └── competency-api.ts     # Competency assessment
│   ├── workshop/
│   │   └── tree-utils.ts         # Tree structure utilities
│   ├── ai/prompts/               # AI prompt templates
│   ├── pdf/generator.ts          # PDF generation
│   └── auth-context.tsx          # Authentication context
│
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app entry point
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── workshop.py   # Workshop CRUD + AI suggest
│   │   │   │   ├── kernel.py     # Kernel object/relation endpoints
│   │   │   │   └── competency.py
│   │   │   ├── v2/
│   │   │   │   └── workflow.py   # Configuration-driven workflow engine
│   │   │   ├── report.py         # Report generation workflow
│   │   │   ├── langgraph_diagnosis.py
│   │   │   └── knowledge_v2.py
│   │   ├── services/
│   │   │   ├── kernel/           # ArangoDB services
│   │   │   │   ├── object_service.py
│   │   │   │   ├── relation_service.py
│   │   │   │   ├── ppt_generator.py
│   │   │   │   └── excel_generator.py
│   │   │   └── ai_client.py      # Unified AI client
│   │   └── models/kernel/        # Pydantic models
│   ├── Dockerfile
│   └── requirements.txt
│
├── tests/
│   ├── setup.ts                  # Test polyfills (ResizeObserver, etc.)
│   ├── unit/
│   │   ├── tree-helpers.test.ts  # 10 tests — tree utility functions
│   │   ├── SmartNode.test.tsx    # 14 tests — inline editing, keyboard shortcuts
│   │   ├── CoCreateCanvas.test.tsx # 9 tests — canvas interactions
│   │   └── optimistic-state.test.ts # 4 tests — state management
│   └── e2e/
│       ├── workshop-canvas-api.spec.ts  # 7 tests — backend CRUD
│       └── workshop-canvas-ui.spec.ts   # 9 tests — browser interactions
│
├── docs/                         # Documentation
├── deploy.sh                     # HK deployment script
├── playwright.config.ts          # E2E test configuration
├── vitest.config.ts              # Unit test configuration
└── package.json
```

---

## 5. Key Features

### 5.1 Workshop Co-creation Canvas

A MindManager-like collaborative brainstorming tool built on ReactFlow with ELK automatic layout.

**Keyboard Shortcuts:**

| Key | Action |
|---|---|
| `Enter` | Create sibling node |
| `Tab` | Create child node |
| `Delete` / `Backspace` | Delete selected node(s) |
| `F2` | Enter edit mode |
| `Escape` | Cancel editing / deselect |
| `↑↓←→` | Navigate between nodes |
| `Ctrl/Cmd + Click` | Multi-select nodes |
| `Double-click` | Edit node name (auto-save on blur) |

**Technical Details:**
- **Optimistic state management**: ReactFlow state is source of truth after initial load. API calls are fire-and-forget.
- **ELK layout**: Runs only on initial mount, not on every state change.
- **SmartNode**: Custom ReactFlow node with inline editing, ghost state, and keyboard event delegation.
- **Tree utilities**: `buildTreeNodeMap()`, `flattenAllNodes()`, `getSiblingsFlat()` extracted to `lib/workshop/tree-utils.ts`.

### 5.2 Five-Dimension Diagnosis

Automated organizational assessment across 5 dimensions:
1. **Organization Structure** — hierarchy, governance, span of control
2. **Business Process** — efficiency, standardization, automation
3. **Technology** — systems maturity, digital readiness
4. **People & Capability** — skills, culture, leadership
5. **Culture** — values, communication, innovation

### 5.3 Report Generation Pipeline

```
Requirement Input → Module Generation → Page Title Generation
    → Slide Content Generation → Preview → PPTX Export
```

- **LangGraph workflow** with human-in-the-loop interrupts
- **Multi-level AI expansion**: outline → detailed content → styled slides
- **Template system**: Smart layout matching based on content type
- **Export formats**: PPTX, PDF

### 5.4 Knowledge Base

- Upload and parse documents (PDF, DOCX, XLSX, images via OCR)
- Vector embedding via DashScope
- Semantic search via ChromaDB
- Document chunking and metadata extraction

### 5.5 Kernel Database (ConsultingOS)

ArangoDB-backed flexible graph database:
- **Objects**: Session, Node, Evaluation, Tag Category, Smart Tag
- **Relations**: `canvas_parent_child`, `canvas_node_to_tag`
- **REST API**: Full CRUD at `/api/v1/kernel/`

---

## 6. Testing

### Test Infrastructure

| Layer | Tool | Command |
|---|---|---|
| Unit | Vitest + Testing Library | `npm run test:unit` |
| E2E API | Playwright | `npm run test:e2e:api` |
| E2E UI | Playwright | `npm run test:e2e:ui` |
| All | — | `npm run test:e2e` |

### Test Coverage

| Test Suite | Tests | Coverage Area |
|---|---|---|
| `tree-helpers.test.ts` | 10 | `buildTreeNodeMap`, `flattenAllNodes`, `getSiblingsFlat` |
| `SmartNode.test.tsx` | 14 | Render, double-click edit, Enter/Tab/Escape save, blur save, editing guard, ghost node, selected border |
| `CoCreateCanvas.test.tsx` | 9 | Empty state, node rendering, add root dialog, keyboard shortcuts, pane deselect, Enter/Tab sibling/child |
| `optimistic-state.test.ts` | 4 | Optimistic add/delete, edge add, merge strategy |
| `workshop-canvas-api.spec.ts` | 7 | Session CRUD, node CRUD, parent-child relations, cascade delete |
| `workshop-canvas-ui.spec.ts` | 9 | Canvas empty state, add/edit/delete nodes, Enter/Tab/Delete, click select/deselect, edit persistence |
| **Total** | **53** | |

### Test Design Decisions

- **Serial E2E API tests**: `test.describe.serial` ensures session/node state sharing across tests
- **Raw API responses**: E2E API tests use actual backend format (no `{success, data}` wrapper)
- **ResizeObserver polyfill**: Required for ReactFlow in jsdom
- **Pointer capture polyfills**: Required for ReactFlow drag interactions
- **Mock strategy**: SmartNode tests mock ReactFlow and lucide-react; CoCreateCanvas tests use real ReactFlow

---

## 7. Deployment

### HK Server Deployment

```bash
# Deploy backend to HK
./deploy.sh [branch]

# What it does:
# 1. rsync backend/ → HK server (excluding venv, __pycache__, .env)
# 2. docker build on HK
# 3. docker run with volume mounts (.env, data/)
# 4. Health check at /api/health
```

**Server Details:**
- **Host**: 103.59.103.85 (via `ssh hk-jump` bastion)
- **Backend container**: `org-diagnosis-api` on port 8000 (localhost only)
- **Network**: Connected to `docker_internal` bridge for ArangoDB/MinIO access
- **Volumes**: `.env` for config, `/opt/org-diagnosis/data` for persistent data

### Frontend Deployment

- **Platform**: Vercel (hkg1 region)
- **URL**: https://org-diagnosis.3strategy.cc
- **Auto-deploy**: Connected to Git repository
- **Build**: `next build`

### Environment Variables

See `.env.example` and `.env.hk.example` for required variables:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — Auth and database
- `OPENAI_API_KEY` / `DASHSCOPE_API_KEY` — LLM providers
- `ARANGO_HOST`, `ARANGO_DB` — Kernel database
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY` — Object storage
- `AUTH_ENABLED` — Toggle authentication (default: false)

---

## 8. Development

### Local Development

```bash
# Frontend
npm install
npm run dev          # http://localhost:3000

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# Run tests
npm run test:unit    # Unit tests (38 tests)
npm run test:e2e:api # API E2E tests (requires backend)
npm run test:e2e:ui  # UI E2E tests (requires frontend + backend)
```

### API Routes Summary

| Prefix | Purpose |
|---|---|
| `/api/health` | Health check |
| `/api/v1/workshop/*` | Workshop sessions, nodes, relations, AI suggestions |
| `/api/v1/kernel/*` | Kernel object/relation CRUD |
| `/api/v1/competency/*` | Competency assessment |
| `/api/v2/workflow/*` | Configuration-driven workflow engine |
| `/api/report/*` | Report generation (start, status, outline, slides, export) |
| `/api/langgraph/*` | LangGraph diagnosis workflow |
| `/api/knowledge_v2/*` | Knowledge base (upload, search, RAG) |
| `/api/projects/*` | Project management |
| `/api/layout/*` | Smart layout recommendations |
| `/api/templates/*` | PPT template management |

---

## 9. Recent Changes (2026-04-02)

### Workshop Canvas — MindManager-like Improvements

**Backend Fix:**
- `workshop.py`: Fixed `parent_node_id` format conversion — now correctly uses `_to_id()` to convert `_key` to full `_id` before creating parent-child relations
- `workshop.py`: Added null safety in `_transform_relation()` for malformed edge documents

**Frontend Improvements:**
- `CoCreateCanvas.tsx`: Fixed Temporal Dead Zone bug — moved `useNodesState`/`useEdgesState` hooks before `useCallback` definitions that reference them
- `CoCreateCanvas.tsx`: Implemented optimistic state management — structural operations (add/delete/connect) update ReactFlow state directly without waiting for API
- `CoCreateCanvas.tsx`: Added Ctrl/Cmd+Click multi-select for nodes
- `SmartNode.tsx`: Fixed `useEffect` sync guard — prevents external label updates from overwriting in-progress edits

**Testing:**
- Set up Vitest + React Testing Library infrastructure
- Added 38 unit tests across 4 test files
- Added 16 E2E tests (7 API + 9 UI) with Playwright
- All 54 tests passing

---

## 10. Known Issues & Future Work

### Known Issues
- Demo mode uses in-memory database; data is lost on restart
- No GitHub Actions CI/CD — deployment is manual via `deploy.sh`
- Some pre-existing E2E tests (langgraph, report, workflow) fail against local dev server due to async AI operations timing out

### Future Work
- [ ] GitHub Actions for automated testing and deployment
- [ ] Real-time collaboration (WebSocket-based)
- [ ] More node types in workshop canvas (painpoint, idea, task with distinct visuals)
- [ ] Undo/redo for canvas operations
- [ ] Export workshop canvas to image/PDF
- [ ] Multi-language support (currently Chinese-focused)
