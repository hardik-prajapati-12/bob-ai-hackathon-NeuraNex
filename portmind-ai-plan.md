# PortMind AI — Implementation Plan
## IBM Bob AI Hackathon 2026 | Team NeuraNex
### Problem Statement: L1 — Container Congestion Predictor & Port Operations Optimiser

---

## Top-Level Overview

**Goal:** Build PortMind AI — an intelligent, full-stack MERN web application that predicts container port congestion, explains root causes, optimises berth/crane allocation, and generates actionable 72-hour operations plans for port supervisors.

**Approach:** PREDICT → EXPLAIN → OPTIMIZE → PLAN as a unified operational workflow, grounded in realistic synthetic data, with an LLM-powered AI assistant that queries live application data rather than hallucinating facts.

**Scope:** Working MVP demonstrable in 3–5 minutes, covering all 5 core modules, with tests, documentation, and a clean hackathon-template-compatible repository structure.

**Out of Scope:** Hardware, IoT, real AIS feeds, production-grade ML training pipelines, Java/Spring Boot, unnecessary microservices.

**Repository is currently empty** — the official hackathon template must be scaffolded as part of Phase 2.

---

## Repository Structure (Target)

```
bob-ai-hackathon-NeuraNex/
├── submission.yaml
├── README.md
├── CONTRIBUTING.md
├── .gitignore
├── .env.example
├── .github/
│   └── workflows/
│       └── validate.yml
├── src/
│   ├── README.md
│   ├── backend/
│   │   ├── package.json
│   │   ├── .env.example
│   │   └── src/
│   │       ├── server.js
│   │       ├── config/
│   │       │   └── database.js
│   │       ├── models/
│   │       ├── controllers/
│   │       ├── routes/
│   │       ├── services/
│   │       ├── middleware/
│   │       ├── utils/
│   │       ├── validators/
│   │       ├── analytics/
│   │       ├── optimization/
│   │       └── ai/
│   └── frontend/
│       ├── package.json
│       ├── vite.config.js
│       └── src/
│           ├── main.jsx
│           ├── App.jsx
│           ├── api/
│           ├── components/
│           ├── pages/
│           ├── hooks/
│           ├── utils/
│           └── context/
├── docs/
│   ├── problem-statement.md
│   ├── solution-overview.md
│   ├── architecture.md
│   └── setup-guide.md
├── demo/
│   └── screenshots/
└── presentation/
    └── portmind-ai-slides.pptx (or .pdf)
```

---

## Hackathon Judging Criteria Mapping

| Criterion | Points | How We Address It |
|---|---|---|
| Technical Implementation Quality | 25 | Clean layered MERN architecture, typed services, real algorithms, tests |
| Innovation & Differentiation | 25 | Unified PREDICT→EXPLAIN→OPTIMIZE→PLAN workflow; contextual AI grounded in live data |
| Problem Depth & Vision | 15 | All 4 L1 requirements addressed; realistic synthetic data with logical relationships |
| Working Demo & Functionality | 15 | 5-feature MVP with demo journey, seed data, smooth demo script |
| IBM Bob Integration | 10 | Planning, architecture, code generation, debugging, documentation via Bob |
| Documentation & Reproducibility | 10 | README, docs/*, setup guide, .env.example, no secrets committed |

---

## L1 Problem Statement Coverage

| L1 Requirement | PortMind AI Feature |
|---|---|
| Predict congestion hotspots | Feature 2 — Congestion Prediction Engine |
| Recommend alternate routing strategies | Feature 4 — Optimization Center (rerouting recommendations) |
| Optimize berth and crane assignments | Feature 4 — Berth & Crane Optimization Engine |
| Generate 72-hour port operations plan | Feature 5 — AI 72-Hour Operations Copilot |

---

## Architecture

### System Architecture

```
┌─────────────────────────────────┐
│        React + Vite Frontend    │
│  (Dashboard, Vessels, Analytics,│
│   Optimization, AI Assistant,   │
│   Operations Plan, Alerts)      │
└────────────┬────────────────────┘
             │ REST API (HTTP/JSON)
┌────────────▼────────────────────┐
│     Node.js + Express Backend   │
│  ┌──────────┐  ┌─────────────┐  │
│  │ Analytics│  │Optimization │  │
│  │ Engine   │  │ Engine      │  │
│  └──────────┘  └─────────────┘  │
│  ┌──────────────────────────┐   │
│  │      AI Service Layer    │   │
│  │  (Context Retrieval +    │   │
│  │   LLM Reasoning)         │   │
│  └──────────────────────────┘   │
└────────────┬────────────────────┘
             │ Mongoose ODM
┌────────────▼────────────────────┐
│           MongoDB               │
│  (vessels, berths, terminals,   │
│   cranes, schedules, predictions│
│   recommendations, plans)       │
└─────────────────────────────────┘
```

### AI Architecture (Separation of Concerns)

```
Data Layer (MongoDB)
        ↓
Context Retrieval Service
  - Fetches relevant vessels, berths, predictions, alerts
  - Assembles structured operational context object
        ↓
Analytics Engine (deterministic)
  - Congestion scoring algorithm
  - Utilization calculations
  - Waiting time estimation
  - Historical trend analysis
        ↓
Optimization Engine (deterministic)
  - Berth assignment algorithm (constraint-based)
  - Crane allocation algorithm
  - Conflict detection
  - Impact scoring
        ↓
AI Reasoning Layer (LLM)
  - Receives: structured context + analytics results
  - Produces: natural-language explanation, recommendations, plan narrative
  - Does NOT perform numerical calculations
  - Does NOT invent operational facts
        ↓
API Response (structured JSON + narrative text)
```

**Key Principle:** LLM only reasons and narrates. All numbers come from deterministic code.

---

## Database Schema

### Collection: `terminals`
```json
{
  "_id": ObjectId,
  "terminalId": "T1",
  "name": "Terminal 1 — North Quay",
  "totalBerths": 8,
  "activeBerths": 6,
  "maxTEUCapacity": 15000,
  "currentTEULoad": 11200,
  "utilizationPercent": 74.7,
  "craneCount": 12,
  "operationalStatus": "ACTIVE",
  "location": { "lat": 1.264, "lng": 103.820 }
}
```

### Collection: `berths`
```json
{
  "_id": ObjectId,
  "berthId": "B1-T1",
  "terminalId": "T1",
  "name": "Berth 1",
  "maxVesselSizeTEU": 8000,
  "maxVesselLengthM": 300,
  "currentStatus": "OCCUPIED | AVAILABLE | MAINTENANCE",
  "assignedVesselId": ObjectId | null,
  "availableFrom": ISODate,
  "craneCount": 3,
  "processingRateTEUPerHour": 350,
  "utilizationPercent": 85.0
}
```

### Collection: `cranes`
```json
{
  "_id": ObjectId,
  "craneId": "C1-T1",
  "terminalId": "T1",
  "berthId": "B1-T1",
  "name": "Crane 1",
  "type": "SHIP_TO_SHORE | RUBBER_TIRED_GANTRY",
  "status": "ACTIVE | MAINTENANCE | IDLE",
  "assignedVesselId": ObjectId | null,
  "liftCapacityTEUPerHour": 25,
  "utilizationPercent": 78.0
}
```

### Collection: `vessels`
```json
{
  "_id": ObjectId,
  "vesselId": "V-102",
  "vesselName": "Maersk Horizon",
  "imoNumber": "IMO9876543",
  "sizeTEU": 14000,
  "vesselType": "CONTAINER | BULK | TANKER | FEEDER",
  "arrivalTime": ISODate,
  "estimatedDeparture": ISODate,
  "terminalId": "T1",
  "assignedBerthId": ObjectId | null,
  "status": "INBOUND | AT_BERTH | WAITING | DEPARTED | DELAYED",
  "priority": "HIGH | MEDIUM | LOW",
  "cargoType": "IMPORT | EXPORT | TRANSHIPMENT",
  "waitingHours": 3.5,
  "congestionRisk": "LOW | MEDIUM | HIGH | CRITICAL",
  "congestionRiskScore": 0.87,
  "flag": "SG",
  "shippingLine": "Maersk"
}
```

### Collection: `schedules`
```json
{
  "_id": ObjectId,
  "scheduleId": "SCH-001",
  "vesselId": ObjectId,
  "terminalId": "T1",
  "berthId": ObjectId | null,
  "plannedArrival": ISODate,
  "plannedDeparture": ISODate,
  "actualArrival": ISODate | null,
  "actualDeparture": ISODate | null,
  "status": "SCHEDULED | ACTIVE | COMPLETED | CANCELLED",
  "processingHoursEstimate": 18.0,
  "craneAssignments": [ObjectId]
}
```

### Collection: `congestionPredictions`
```json
{
  "_id": ObjectId,
  "predictionId": "PRED-001",
  "generatedAt": ISODate,
  "terminalId": "T1",
  "horizon": "6H | 12H | 24H | 72H",
  "congestionProbability": 0.87,
  "riskLevel": "LOW | MEDIUM | HIGH | CRITICAL",
  "predictedWaitingHours": 14.0,
  "berthUtilizationForecast": 0.92,
  "vesselQueueForecast": 8,
  "contributingFactors": [
    { "factor": "HIGH_ARRIVAL_RATE", "weight": 0.4 },
    { "factor": "LOW_BERTH_AVAILABILITY", "weight": 0.35 },
    { "factor": "CRANE_SHORTAGE", "weight": 0.25 }
  ],
  "affectedBerthIds": [ObjectId],
  "modelType": "ANALYTICAL_SCORING",
  "confidence": 0.78
}
```

### Collection: `recommendations`
```json
{
  "_id": ObjectId,
  "recommendationId": "REC-001",
  "generatedAt": ISODate,
  "type": "BERTH_REALLOCATION | CRANE_REASSIGNMENT | VESSEL_DELAY | REROUTING",
  "vesselId": ObjectId,
  "currentBerthId": ObjectId | null,
  "recommendedBerthId": ObjectId | null,
  "currentCraneIds": [ObjectId],
  "recommendedCraneIds": [ObjectId],
  "reason": "string",
  "expectedBenefitHours": 4.5,
  "priority": "HIGH | MEDIUM | LOW",
  "confidence": 0.82,
  "status": "PENDING | ACCEPTED | REJECTED",
  "aiExplanation": "string"
}
```

### Collection: `operationsPlans`
```json
{
  "_id": ObjectId,
  "planId": "PLAN-001",
  "generatedAt": ISODate,
  "generatedBy": "AI_ENGINE",
  "horizon": "72H",
  "terminalIds": ["T1", "T2"],
  "windows": [
    {
      "label": "0-12H",
      "title": "Immediate Actions",
      "actions": [
        {
          "action": "string",
          "reason": "string",
          "affectedResource": "string",
          "expectedBenefit": "string",
          "priority": "HIGH",
          "confidence": 0.85
        }
      ]
    }
  ],
  "summary": "string",
  "status": "DRAFT | ACTIVE | ARCHIVED"
}
```

### Collection: `alerts`
```json
{
  "_id": ObjectId,
  "alertId": "ALT-001",
  "createdAt": ISODate,
  "type": "CONGESTION_RISK | BERTH_CONFLICT | CRANE_SHORTAGE | VESSEL_DELAY",
  "severity": "INFO | WARNING | HIGH | CRITICAL",
  "terminalId": "T1",
  "vesselId": ObjectId | null,
  "message": "string",
  "acknowledged": false,
  "acknowledgedAt": ISODate | null
}
```

### Collection: `historicalOperations`
```json
{
  "_id": ObjectId,
  "date": ISODate,
  "terminalId": "T1",
  "vesselCount": 14,
  "avgWaitingHours": 6.2,
  "berthUtilizationPercent": 78.0,
  "craneUtilizationPercent": 65.0,
  "congestionEvents": 2,
  "totalTEUProcessed": 42000,
  "peakHour": 14
}
```

---

## REST API Specification

### Vessels
```
GET    /api/vessels                   — list all vessels (paginated, filterable)
GET    /api/vessels/:id               — single vessel detail
POST   /api/vessels                   — create vessel
PUT    /api/vessels/:id               — update vessel
DELETE /api/vessels/:id               — delete vessel
GET    /api/vessels/at-risk           — vessels with HIGH/CRITICAL congestion risk
```

### Berths
```
GET    /api/berths                    — list berths (filter by terminal, status)
GET    /api/berths/:id                — single berth
PUT    /api/berths/:id                — update berth
GET    /api/berths/available          — available berths for assignment
```

### Terminals
```
GET    /api/terminals                 — list terminals with utilization
GET    /api/terminals/:id             — terminal detail with berths and cranes
GET    /api/terminals/:id/summary     — utilization summary
```

### Cranes
```
GET    /api/cranes                    — list cranes (filter by terminal, status)
GET    /api/cranes/:id                — single crane
PUT    /api/cranes/:id                — update crane
```

### Schedules
```
GET    /api/schedules                 — list schedules (filter by terminal, date range)
GET    /api/schedules/:id             — single schedule
POST   /api/schedules                 — create schedule
PUT    /api/schedules/:id             — update schedule
```

### Congestion
```
GET    /api/congestion/current        — current congestion status all terminals
GET    /api/congestion/predictions    — latest predictions per terminal/horizon
POST   /api/congestion/predict        — trigger fresh prediction (body: terminalId, horizon)
GET    /api/congestion/history        — historical congestion data (charts)
```

### Optimization
```
POST   /api/optimization/berths       — berth assignment recommendations (body: vesselIds)
POST   /api/optimization/cranes       — crane allocation recommendations
POST   /api/optimization/full         — full optimization pass for a terminal
GET    /api/optimization/current-vs-recommended — comparison for UI
```

### AI
```
POST   /api/ai/chat                   — conversational query (body: { message, context })
POST   /api/ai/analyze                — AI analysis of a terminal/vessel/prediction
POST   /api/ai/explain-congestion     — explain root cause for a terminal
```

### Operations Plan
```
POST   /api/operations-plan/generate  — generate 72-hour plan (body: terminalIds)
GET    /api/operations-plan/:id       — get saved plan
GET    /api/operations-plan           — list recent plans
```

### Alerts
```
GET    /api/alerts                    — list active alerts (filterable)
PUT    /api/alerts/:id/acknowledge    — acknowledge an alert
```

### Dashboard
```
GET    /api/dashboard/summary         — aggregated KPIs for dashboard header
GET    /api/dashboard/charts          — chart data (utilization trends, arrivals)
```

---

## Congestion Prediction Approach

**Model Type:** Transparent Analytical Scoring Model (not a black-box ML model)

**Why:** Hackathon timeframe, synthetic data, explainability requirement. A scoring model is honest, auditable, and produces explainable results.

**Inputs:**
- Current berth utilization (%) per terminal
- Vessel queue size (inbound + waiting vessels in next window)
- Historical average waiting time for this terminal/hour-of-day
- Crane availability ratio (available cranes / required cranes)
- Arrival rate (vessels per hour in prediction window)
- Large-vessel ratio (vessels >8000 TEU as % of queue)

**Scoring Formula:**
```
congestionScore = (
  w1 * berthUtilizationFactor +   // 0.30
  w2 * vesselQueueFactor +         // 0.25
  w3 * arrivalRateFactor +         // 0.20
  w4 * craneShortfallFactor +      // 0.15
  w5 * largeVesselFactor           // 0.10
)

Risk Levels:
  score < 0.35  → LOW
  score < 0.60  → MEDIUM
  score < 0.80  → HIGH
  score >= 0.80 → CRITICAL
```

**Predicted waiting time:**
```
predictedWaitingHours = baseProcessingTime * (1 + congestionScore * multiplier)
```

**Contributing factors** are captured as named reasons with weights for AI explanation.

**Confidence** is reduced when historical data is sparse.

**Label:** All predictions are clearly labelled "ANALYTICAL MODEL — DEMO DATA" in the UI.

---

## Optimization Approach

**Berth Assignment Algorithm:**
1. For each unassigned vessel, score all AVAILABLE berths:
   - Capacity match (vessel TEU <= berth max TEU): required
   - Minimize vessel waiting time (berth available soonest)
   - Processing rate fit (higher cranes/processing rate = better)
   - Terminal balance (prefer terminals with lower utilization)
2. Assign vessel to highest-scored compatible berth
3. Detect conflicts (two vessels assigned same berth in overlapping time windows)
4. Generate comparison: current plan vs recommended plan

**Crane Allocation Algorithm:**
1. Calculate TEU load per vessel
2. Estimate required cranes = ceil(vesselTEU / craneCapacityThreshold)
3. Assign available cranes from the assigned berth's terminal
4. Flag under-allocated vessels (insufficient cranes)
5. Balance crane utilization across the terminal

**Output:** Structured diff of current vs recommended assignments with per-decision reasons.

---

## AI Integration Design

**Provider:** IBM watsonx.ai or OpenAI API (configurable via environment variable `AI_PROVIDER`)

**Why configurable:** Judges can run with either. IBM watsonx preferred for hackathon scoring.

**Context Assembly (before every AI call):**
```javascript
// ai/contextBuilder.js
async function buildOperationalContext(query) {
  return {
    query,
    terminals: await getTerminalSummaries(),
    atRiskVessels: await getHighRiskVessels(),
    currentPredictions: await getLatestPredictions(),
    berthUtilization: await getBerthUtilization(),
    activeAlerts: await getActiveAlerts(),
    recentRecommendations: await getRecentRecommendations(),
    timestamp: new Date().toISOString()
  };
}
```

**System Prompt Design:**
- Role: Port Operations AI Assistant
- Constraints: Only reference data provided in context. Never invent vessel names, berth IDs, or numeric values.
- Format: Structured response with data references, then narrative explanation.
- Tone: Professional, actionable, concise.

**AI Chat Flow:**
```
User message → contextBuilder → structured context + message → LLM → parsed response → API
```

**72-Hour Plan Generation:**
1. Run congestion predictions for 0-12H, 12-24H, 24-48H, 48-72H
2. Run optimization engine for each window
3. Assemble structured context with all predictions + recommendations
4. LLM generates narrative plan using the structured data as input
5. Save to `operationsPlans` collection

---

## React Page & Component Structure

### Pages
```
pages/
  LoginPage.jsx
  DashboardPage.jsx
  VesselManagementPage.jsx
  PortOverviewPage.jsx
  CongestionAnalyticsPage.jsx
  OptimizationCenterPage.jsx
  OperationsPlanPage.jsx
  AIAssistantPage.jsx
  AlertsCenterPage.jsx
```

### Key Shared Components
```
components/
  layout/
    Sidebar.jsx
    TopNav.jsx
    PageHeader.jsx
  common/
    RiskBadge.jsx           — LOW/MEDIUM/HIGH/CRITICAL badge
    StatusBadge.jsx
    KPICard.jsx             — metric card with trend indicator
    DataTable.jsx           — reusable sortable/filterable table
    LoadingSpinner.jsx
    ErrorBoundary.jsx
    ConfirmModal.jsx
  charts/
    CongestionTrendChart.jsx
    BerthUtilizationChart.jsx
    VesselArrivalChart.jsx
    CraneUtilizationChart.jsx
    RiskDistributionChart.jsx
    PredictionHorizonChart.jsx
  vessels/
    VesselCard.jsx
    VesselFilters.jsx
    VesselDetailPanel.jsx
  optimization/
    CurrentVsRecommendedTable.jsx
    RecommendationCard.jsx
  ai/
    ChatInterface.jsx
    ChatMessage.jsx
    ContextPanel.jsx
  operations-plan/
    PlanWindow.jsx
    ActionCard.jsx
```

### Dashboard KPI Cards
- Total Active Vessels
- Vessels at HIGH/CRITICAL Risk
- Terminal Congestion Status (per terminal)
- Overall Berth Utilization %
- Overall Crane Utilization %
- Active Alerts Count
- Next Predicted Congestion Event

---

## Synthetic Dataset Design

**Realistic relationships built in:**

| Scenario | Data Pattern |
|---|---|
| Peak congestion | T1 has 14 vessels arriving in 6-hour window, berth util = 91% |
| Normal operations | T2 has 5 vessels, berth util = 55%, no risk |
| Crane bottleneck | T3 has 2 cranes in maintenance, 4 large vessels arriving |
| Recovery scenario | T1 congestion clearing over 48H horizon |
| Schedule conflict | Two large vessels scheduled same berth 2H apart |

**Volume:**
- 3 terminals, 20 berths, 30 cranes
- 50 vessels (mix of statuses/sizes/priorities)
- 90 days of historical operations data
- 30 vessel schedules (past 7 days + next 7 days)
- 15 congestion prediction records
- 10 active alerts
- 8 recommendations (mix of accepted/pending)
- 2 sample operations plans

**Seed script:** `src/backend/src/utils/seedData.js` — idempotent, safe to re-run.

---

## Sub-Tasks

---

### Sub-Task 1 — Repository Scaffolding & Hackathon Template
**Status:** [ ] pending

**Intent:** Establish the official hackathon-compatible repository structure with all required top-level files, so the GitHub Actions validation workflow will pass and the structure is correct from the start.

**Expected Outcomes:**
- `submission.yaml` present and filled with team/project metadata
- `README.md` present (initial version, to be completed in Phase 11)
- `CONTRIBUTING.md` present
- `.gitignore` configured (excludes .env, node_modules, dist, etc.)
- `.env.example` at root and in backend/
- `.github/workflows/validate.yml` present (hackathon template)
- `docs/` directory with placeholder markdown files
- `demo/` and `presentation/` directories created
- `src/` directory with `README.md`

**Todo List:**
1. Create `submission.yaml` with project metadata
2. Create root `README.md` (initial structure, full content in Phase 11)
3. Create `CONTRIBUTING.md`
4. Create `.gitignore`
5. Create `.env.example` (root level)
6. Create `.github/workflows/validate.yml`
7. Create `docs/problem-statement.md` (placeholder)
8. Create `docs/solution-overview.md` (placeholder)
9. Create `docs/architecture.md` (placeholder)
10. Create `docs/setup-guide.md` (placeholder)
11. Create `demo/` and `presentation/` directories
12. Create `src/README.md`

**Relevant Context:** Repository is currently empty. No existing files to preserve.

---

### Sub-Task 2 — Backend Foundation
**Status:** [ ] pending

**Intent:** Scaffold the Node.js/Express backend with all base infrastructure — server, config, middleware, error handling, logging, and MongoDB connection — so all subsequent backend work builds on a solid, consistent foundation.

**Expected Outcomes:**
- `src/backend/` with full layered directory structure
- Express server starts on configurable port
- MongoDB connection with graceful error handling
- CORS, helmet, rate limiting, request logging middleware
- Global error handler middleware
- Environment variable configuration via dotenv
- Health-check endpoint: `GET /api/health`
- `package.json` with all necessary dependencies

**Todo List:**
1. Create `src/backend/package.json` with dependencies
2. Create `src/backend/src/server.js`
3. Create `src/backend/src/config/database.js`
4. Create `src/backend/src/config/env.js`
5. Create `src/backend/src/middleware/errorHandler.js`
6. Create `src/backend/src/middleware/requestLogger.js`
7. Create `src/backend/src/middleware/auth.js` (JWT verification stub)
8. Create `src/backend/src/middleware/validate.js` (express-validator wrapper)
9. Create `src/backend/src/utils/logger.js`
10. Create `src/backend/src/utils/apiResponse.js` (standard response shapes)
11. Create `src/backend/src/routes/health.js`
12. Create `src/backend/.env.example`

**Key Dependencies:** express, mongoose, dotenv, cors, helmet, express-rate-limit, morgan, winston, express-validator, jsonwebtoken, bcryptjs

---

### Sub-Task 3 — MongoDB Models
**Status:** [ ] pending

**Intent:** Implement all Mongoose models with correct schema definitions, validation, indexes, and virtual properties to support all application features.

**Expected Outcomes:**
- 10 Mongoose model files matching the schema above
- Proper indexes on frequently queried fields
- Schema validation at the database level
- Virtual fields where useful (e.g., utilization percentage)

**Todo List:**
1. Create `models/Terminal.js`
2. Create `models/Berth.js`
3. Create `models/Crane.js`
4. Create `models/Vessel.js`
5. Create `models/Schedule.js`
6. Create `models/CongestionPrediction.js`
7. Create `models/Recommendation.js`
8. Create `models/OperationsPlan.js`
9. Create `models/Alert.js`
10. Create `models/HistoricalOperation.js`
11. Add compound indexes: vessels by (terminalId + status), schedules by (terminalId + plannedArrival), predictions by (terminalId + generatedAt)

---

### Sub-Task 4 — Synthetic Seed Data
**Status:** [ ] pending

**Intent:** Create a realistic, logically consistent synthetic dataset that demonstrates meaningful congestion scenarios, so every feature has credible data to work with from day one.

**Expected Outcomes:**
- Seed script runs successfully and populates all collections
- Data exhibits the congestion relationships described in the dataset design section
- At least 3 terminals, 20 berths, 30 cranes, 50 vessels
- 90 days of historical operations data
- Active congestion scenario visible on startup

**Todo List:**
1. Create `utils/seedData.js` with idempotent seeding logic
2. Seed terminals (3 terminals with varying utilization)
3. Seed berths (20, distributed across terminals, mix of statuses)
4. Seed cranes (30, mix of active/maintenance)
5. Seed vessels (50, mix of sizes/statuses/risks/priorities)
6. Seed schedules (30, include overlapping arrivals for T1 peak scenario)
7. Seed historical operations (90 days, realistic trend data)
8. Seed congestion predictions (15 records across terminals/horizons)
9. Seed alerts (10 active alerts)
10. Seed recommendations (8 records)
11. Add `npm run seed` script to package.json
12. Document synthetic data disclaimer in seed file header

---

### Sub-Task 5 — Vessel, Berth, Terminal, Crane & Schedule APIs
**Status:** [ ] pending

**Intent:** Implement all CRUD and query REST API endpoints for the core operational entities, following the layered architecture (route → controller → service → model).

**Expected Outcomes:**
- All endpoints listed in the API spec return correct data
- Pagination, filtering, and sorting work on vessel and schedule endpoints
- Input validation on all POST/PUT endpoints
- Service layer isolates all database logic

**Todo List:**
1. Create vessel service + controller + routes
2. Create berth service + controller + routes
3. Create terminal service + controller + routes
4. Create crane service + controller + routes
5. Create schedule service + controller + routes
6. Register all routes in server.js
7. Add validators for vessel/schedule create/update
8. Test all endpoints (manual or automated)

---

### Sub-Task 6 — Analytics & Congestion Engine
**Status:** [ ] pending

**Intent:** Implement the analytical congestion scoring model, utilization calculations, and historical trend analysis that form the deterministic backbone of all predictions and AI reasoning.

**Expected Outcomes:**
- `analytics/congestionScorer.js` produces risk level + score + contributing factors
- `analytics/utilizationCalculator.js` computes berth and crane utilization
- `analytics/forecastEngine.js` projects metrics across 6H/12H/24H/72H horizons
- Predictions are saved to the `congestionPredictions` collection
- `/api/congestion/*` endpoints return correct data

**Todo List:**
1. Create `analytics/congestionScorer.js` — implement scoring formula
2. Create `analytics/utilizationCalculator.js`
3. Create `analytics/forecastEngine.js`
4. Create `analytics/historicalAnalyzer.js`
5. Create congestion controller + routes
6. Implement `POST /api/congestion/predict`
7. Implement `GET /api/congestion/current`
8. Implement `GET /api/congestion/predictions`
9. Implement `GET /api/congestion/history`
10. Write unit tests for congestion scoring formula

---

### Sub-Task 7 — Optimization Engine
**Status:** [ ] pending

**Intent:** Implement the berth assignment and crane allocation algorithms that compare the current operational plan to an AI-recommended plan, forming the core decision-support value of the platform.

**Expected Outcomes:**
- `optimization/berthOptimizer.js` produces ranked berth assignments
- `optimization/craneAllocator.js` produces crane-to-vessel recommendations
- `optimization/conflictDetector.js` identifies scheduling conflicts
- `/api/optimization/*` endpoints return structured current-vs-recommended diffs
- Each recommendation includes a machine-generated reason string

**Todo List:**
1. Create `optimization/berthOptimizer.js`
2. Create `optimization/craneAllocator.js`
3. Create `optimization/conflictDetector.js`
4. Create `optimization/impactCalculator.js` (estimate hours saved)
5. Create optimization controller + routes
6. Implement `POST /api/optimization/berths`
7. Implement `POST /api/optimization/cranes`
8. Implement `GET /api/optimization/current-vs-recommended`
9. Write unit tests for berth scorer and conflict detector

---

### Sub-Task 8 — AI Service & Operations Plan
**Status:** [ ] pending

**Intent:** Implement the AI integration layer — context builder, system prompt, LLM client, chat endpoint, and 72-hour operations plan generator — ensuring all AI responses are grounded in actual application data.

**Expected Outcomes:**
- `ai/contextBuilder.js` assembles operational context from live DB data
- `ai/aiClient.js` supports IBM watsonx.ai and OpenAI (env-configurable)
- `ai/systemPrompt.js` contains port operations system prompt with grounding constraints
- `POST /api/ai/chat` returns contextual responses referencing real vessel/berth data
- `POST /api/ai/explain-congestion` returns root-cause explanation using analytics output
- `POST /api/operations-plan/generate` produces and saves a full 72-hour plan
- AI responses clearly labelled as AI recommendations, not autonomous commands

**Todo List:**
1. Create `ai/contextBuilder.js`
2. Create `ai/aiClient.js` (watsonx + OpenAI adapters)
3. Create `ai/systemPrompt.js`
4. Create `ai/responseParser.js`
5. Create AI controller + routes
6. Implement `POST /api/ai/chat`
7. Implement `POST /api/ai/analyze`
8. Implement `POST /api/ai/explain-congestion`
9. Create operations plan service
10. Implement `POST /api/operations-plan/generate`
11. Implement `GET /api/operations-plan/:id`
12. Implement `GET /api/operations-plan`
13. Add graceful fallback when AI provider is unavailable

---

### Sub-Task 9 — Dashboard & Alerts APIs
**Status:** [ ] pending

**Intent:** Implement the aggregated dashboard and alerts APIs that power the main command center view — providing KPIs, chart data, and alert management in a single efficient response.

**Expected Outcomes:**
- `GET /api/dashboard/summary` returns all KPIs in one call
- `GET /api/dashboard/charts` returns time-series data for all dashboard charts
- `GET /api/alerts` returns active alerts with filtering
- `PUT /api/alerts/:id/acknowledge` works correctly

**Todo List:**
1. Create `services/dashboardService.js` (aggregation queries)
2. Create dashboard controller + routes
3. Create alerts service + controller + routes
4. Test dashboard summary with seed data

---

### Sub-Task 10 — Frontend Foundation
**Status:** [ ] pending

**Intent:** Scaffold the React/Vite frontend with routing, layout, API client, authentication context, and all shared components, so all subsequent frontend pages build on a consistent foundation.

**Expected Outcomes:**
- Vite project starts successfully
- React Router configured with all 9 page routes
- Sidebar + TopNav layout renders correctly
- Axios API client configured with base URL and JWT interceptor
- AuthContext provides login/logout state
- All shared components exist (RiskBadge, KPICard, DataTable, etc.)
- Dark/professional enterprise color scheme applied

**Todo List:**
1. Scaffold `src/frontend/` with Vite + React
2. Install dependencies (react-router-dom, axios, recharts, react-leaflet, lucide-react, tailwindcss or equivalent)
3. Create `api/client.js` (axios instance with interceptors)
4. Create `api/` modules per feature (vessels.js, congestion.js, etc.)
5. Create `context/AuthContext.jsx`
6. Create layout components (Sidebar, TopNav, PageHeader)
7. Create shared components (RiskBadge, KPICard, DataTable, LoadingSpinner, ErrorBoundary)
8. Create all chart components (empty shells with Recharts)
9. Configure React Router with all page routes
10. Create `LoginPage.jsx`
11. Apply base CSS/styling (enterprise dark theme or professional light)

---

### Sub-Task 11 — Dashboard Page
**Status:** [ ] pending

**Intent:** Build the main command center dashboard that gives operators an immediate at-a-glance view of port status, risk levels, and key metrics.

**Expected Outcomes:**
- KPI cards show live data from `/api/dashboard/summary`
- Congestion trend chart renders from chart API data
- Vessel arrival chart renders
- Berth utilization chart renders
- Active alerts list renders
- Top 3 at-risk vessels shown
- All data updates on page load

**Todo List:**
1. Create `DashboardPage.jsx`
2. Wire KPI cards to dashboard summary API
3. Implement congestion trend chart
4. Implement vessel arrival chart
5. Implement berth utilization chart
6. Implement active alerts list widget
7. Implement at-risk vessels widget

---

### Sub-Task 12 — Vessel Management Page
**Status:** [ ] pending

**Intent:** Build the vessel management screen where operators can browse, search, filter, and inspect all vessels and their operational status.

**Expected Outcomes:**
- DataTable shows all vessels with sortable columns
- Search by vessel name/ID works
- Filter by status, risk level, terminal works
- Vessel detail panel shows full information
- Risk badges correctly colored by level

**Todo List:**
1. Create `VesselManagementPage.jsx`
2. Implement vessel data table with all required columns
3. Implement search input (debounced)
4. Implement filter controls (status, risk, terminal)
5. Implement vessel detail side panel
6. Add sorting on key columns

---

### Sub-Task 13 — Port Overview Page
**Status:** [ ] pending

**Intent:** Build the terminal/port overview page showing berth occupancy, crane status, and terminal-level utilization.

**Expected Outcomes:**
- Three terminal cards with utilization gauges
- Berth grid showing occupied/available/maintenance berths
- Crane availability summary per terminal
- Click through to terminal detail

**Todo List:**
1. Create `PortOverviewPage.jsx`
2. Implement terminal summary cards
3. Implement berth occupancy grid
4. Implement crane status summary
5. Wire to terminal and berth APIs

---

### Sub-Task 14 — Congestion Analytics Page
**Status:** [ ] pending

**Intent:** Build the congestion analytics screen where operators can view predictions, risk levels, contributing factors, and historical congestion trends.

**Expected Outcomes:**
- Prediction cards for each terminal/horizon combination
- Congestion risk level clearly displayed with colored indicators
- Contributing factors shown (bar/list breakdown)
- Historical congestion trend chart
- Trigger new prediction button works
- All data clearly labelled as analytical/demo model

**Todo List:**
1. Create `CongestionAnalyticsPage.jsx`
2. Implement prediction cards per terminal
3. Implement horizon selector (6H/12H/24H/72H)
4. Implement contributing factors breakdown
5. Implement historical trend chart
6. Implement root-cause AI explanation panel
7. Wire to congestion API endpoints

---

### Sub-Task 15 — Optimization Center Page
**Status:** [ ] pending

**Intent:** Build the optimization center where operators see the current vs AI-recommended berth and crane assignments side by side, with explanations for each recommendation.

**Expected Outcomes:**
- Two-column layout: Current Plan | AI Recommended Plan
- Each vessel shows current assignment and recommended change
- Recommendation cards explain WHY the change is suggested
- Expected benefit (hours saved) displayed
- Accept/dismiss buttons present (no backend persistence required for MVP)

**Todo List:**
1. Create `OptimizationCenterPage.jsx`
2. Implement current vs recommended comparison table
3. Implement recommendation detail cards
4. Implement crane allocation comparison
5. Wire to optimization API endpoints
6. Add run optimization trigger button

---

### Sub-Task 16 — AI Assistant Page
**Status:** [ ] pending

**Intent:** Build the AI operations copilot chat interface where operators can ask natural-language questions and receive contextually grounded answers.

**Expected Outcomes:**
- Chat interface with message history
- Suggested question buttons for common queries
- AI responses reference actual vessel/berth/terminal data
- Loading state while AI processes
- Context panel shows what data was sent to AI
- Clearly labelled as AI decision support, not autonomous control

**Todo List:**
1. Create `AIAssistantPage.jsx`
2. Create `ChatInterface.jsx` component
3. Create `ChatMessage.jsx` (user/assistant message bubbles)
4. Implement suggested questions row
5. Wire to `/api/ai/chat` endpoint
6. Implement loading/typing indicator
7. Add context panel toggle (shows what context AI received)

---

### Sub-Task 17 — Operations Plan Page
**Status:** [ ] pending

**Intent:** Build the 72-hour operations plan page where operators can generate and view the AI-produced operations plan structured across four time windows.

**Expected Outcomes:**
- Generate Plan button triggers `/api/operations-plan/generate`
- Four time windows (0-12H, 12-24H, 24-48H, 48-72H) displayed as sections
- Each action card shows: action, reason, resource, expected benefit, priority, confidence
- Previously generated plans accessible
- Export/print-friendly layout

**Todo List:**
1. Create `OperationsPlanPage.jsx`
2. Create `PlanWindow.jsx` component
3. Create `ActionCard.jsx` component
4. Implement plan generation trigger
5. Implement plan section rendering
6. Implement plan history list
7. Wire to operations plan API endpoints

---

### Sub-Task 18 — Alerts Center Page
**Status:** [ ] pending

**Intent:** Build the alerts center where operators can monitor, filter, and acknowledge operational alerts.

**Expected Outcomes:**
- Alert list with severity indicators
- Filter by type, severity, terminal
- Acknowledge alert updates the record
- Alert count badge visible in sidebar

**Todo List:**
1. Create `AlertsCenterPage.jsx`
2. Implement alert list with severity badges
3. Implement filter controls
4. Implement acknowledge action
5. Wire to alerts API endpoints

---

### Sub-Task 19 — Backend Tests
**Status:** [ ] pending

**Intent:** Write meaningful automated tests for the critical backend logic — congestion scoring, optimization algorithms, and API endpoints — to ensure reliability and satisfy the testing judging criterion.

**Expected Outcomes:**
- `congestionScorer.js` unit tests pass
- `berthOptimizer.js` unit tests pass
- `conflictDetector.js` unit tests pass
- At least 5 API endpoint integration tests pass
- Edge cases covered (no berth available, empty queue, crane shortage)

**Todo List:**
1. Set up Jest in backend
2. Write unit tests for `congestionScorer.js`
3. Write unit tests for `berthOptimizer.js`
4. Write unit tests for `conflictDetector.js`
5. Write API integration tests for vessel, congestion, and optimization endpoints
6. Add `npm test` script

---

### Sub-Task 20 — Security & Quality Pass
**Status:** [ ] pending

**Intent:** Apply security practices, validate all inputs, check for secrets, and do a final code quality pass before documentation.

**Expected Outcomes:**
- No secrets in code or git history
- All API inputs validated with express-validator
- JWT auth protecting mutation endpoints
- Helmet + rate limiting active
- No console.log leaking sensitive data
- CORS configured correctly

**Todo List:**
1. Audit all .env references — ensure nothing hardcoded
2. Verify .gitignore excludes .env and secrets
3. Review all POST/PUT validators
4. Apply JWT auth middleware to non-public endpoints
5. Confirm Helmet and rate limiter active
6. Review error messages (no stack traces in production)

---

### Sub-Task 21 — Documentation
**Status:** [ ] pending

**Intent:** Complete all documentation files to hackathon submission standard.

**Expected Outcomes:**
- Root README.md fully complete — no placeholders
- `docs/problem-statement.md` complete
- `docs/solution-overview.md` complete
- `docs/architecture.md` complete with architecture diagram
- `docs/setup-guide.md` complete and accurate
- `src/README.md` complete
- Zero placeholder text (`[`, `TODO`, `your-team`, `example.com`)

**Todo List:**
1. Complete root `README.md`
2. Write `docs/problem-statement.md`
3. Write `docs/solution-overview.md`
4. Write `docs/architecture.md` with Mermaid diagram
5. Write `docs/setup-guide.md`
6. Update `src/README.md`
7. Grep for placeholder text and remove

---

### Sub-Task 22 — Demo Preparation
**Status:** [ ] pending

**Intent:** Prepare screenshots, a demo script, and ensure the application can run the demo journey cleanly from start to finish.

**Expected Outcomes:**
- Demo seed data creates a compelling congestion scenario on startup
- Demo journey (10 steps) can be executed in under 5 minutes
- Screenshots captured for key screens
- `demo/` directory contains screenshots

**Todo List:**
1. Verify demo data creates clear congestion scenario
2. Run through 10-step demo journey end-to-end
3. Capture screenshots of each key step
4. Write demo script in `demo/DEMO_SCRIPT.md`
5. Fix any UX issues discovered during demo run

---

### Sub-Task 23 — Final Hackathon Submission Check
**Status:** [ ] pending

**Intent:** Verify every hackathon submission requirement is met before final submission.

**Expected Outcomes:**
- `submission.yaml` complete and valid
- No `.env` files committed
- `.env.example` present with all required keys and dummy values
- All docs complete
- `demo/` has screenshots
- `presentation/` has deck
- GitHub Actions validate workflow passes
- No template placeholder text remains
- Repository is public-ready

**Todo List:**
1. Verify `submission.yaml` fields
2. Run `git status` to confirm no secrets staged
3. Grep for all placeholder patterns
4. Verify GitHub Actions workflow file exists and is valid
5. Check all required top-level files present
6. Run full application from clean install (`npm install` + `npm run seed` + `npm start`)
7. Confirm demo journey works on clean install

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI provider API key not available during judging | MEDIUM | HIGH | Graceful fallback mode with pre-generated responses; local mock mode |
| MongoDB not running on judge machine | MEDIUM | HIGH | Clear setup guide; consider MongoDB Atlas free tier as option |
| AI hallucinating vessel data | HIGH | HIGH | Context builder passes all relevant data; system prompt explicitly prohibits invention |
| Optimization algorithm produces nonsensical results | MEDIUM | HIGH | Unit tests + manual validation with seed data |
| GitHub Actions validation fails | LOW | HIGH | Preserve all template files; do not modify validate.yml |
| Feature creep / incomplete MVP | HIGH | HIGH | Strict phase-by-phase implementation; defer non-core features |
| Recharts not performant with large datasets | LOW | MEDIUM | Paginate data; limit chart data points to last 30 days |
| Frontend and backend API contract drift | MEDIUM | MEDIUM | Define API response shapes early; use apiResponse utility consistently |

---

## Dependencies List

### Backend
```
express ^4.18
mongoose ^8.x
dotenv ^16.x
cors ^2.8
helmet ^7.x
express-rate-limit ^7.x
morgan ^1.10
winston ^3.x
express-validator ^7.x
jsonwebtoken ^9.x
bcryptjs ^2.x
node-cron ^3.x (optional, for scheduled prediction refresh)
openai ^4.x (optional, AI provider)
@ibm-cloud/watsonx-ai (optional, IBM AI provider)
```

### Frontend
```
react ^18.x
react-dom ^18.x
react-router-dom ^6.x
axios ^1.x
recharts ^2.x
react-leaflet ^4.x (optional, for map)
leaflet ^1.9.x (optional)
lucide-react ^0.x (icons)
tailwindcss ^3.x (or equivalent CSS framework)
date-fns ^3.x (date formatting)
```

### Dev
```
jest, supertest (backend testing)
@testing-library/react, @testing-library/jest-dom (frontend testing)
nodemon (backend dev)
vite (frontend build)
```

---

## IBM Bob Integration Evidence Plan

Document Bob's contributions across these areas for the presentation:

1. **Architecture Design** — This planning document (generated with Bob)
2. **Code Generation** — Models, services, analytics engine, optimization algorithms
3. **Debugging** — Use Bob to diagnose and fix issues during development
4. **Code Review** — Ask Bob to review optimization and AI service code
5. **Test Generation** — Use Bob to generate unit test cases
6. **Documentation** — Use Bob to draft README and architecture doc
7. **Refactoring** — Ask Bob to improve code quality during Phase 10
8. **Demo Preparation** — Use Bob to generate demo script

Keep notes/screenshots of meaningful Bob interactions for the IBM Bob Integration slide.
