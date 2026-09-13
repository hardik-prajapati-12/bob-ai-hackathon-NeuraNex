# PortMind AI

**Predict congestion. Optimize operations. Act before delays happen.**

> IBM Bob AI Hackathon 2026 | Team NeuraNex | Problem Statement: L1 — Container Congestion Predictor & Port Operations Optimiser

---

## Problem

Container ports face growing operational complexity: vessel arrivals are increasing, berth capacity is constrained, crane resources are finite, and congestion cascades quickly. Port supervisors currently rely on reactive manual planning — by the time congestion is visible, it is already too late to avoid delays.

## Solution

PortMind AI is an intelligent port operations command center that moves operators from reactive to predictive:

**PREDICT → EXPLAIN → OPTIMIZE → PLAN**

1. **Predicts** congestion hotspots using an analytical scoring model across 6H, 12H, 24H, and 72H horizons
2. **Explains** root causes using IBM watsonx.ai grounded in live operational data
3. **Optimizes** berth and crane assignments with a constraint-based recommendation engine
4. **Plans** a 72-hour operations playbook with prioritized, actionable steps

## Key Features

- 📊 **Real-time Dashboard** — KPIs, congestion status, at-risk vessels, active alerts
- 🚢 **Vessel Management** — Browse, search, filter, and inspect all vessels
- 🏗️ **Port Overview** — Terminal utilization, berth status, crane availability
- 📈 **Congestion Analytics** — Predictions with explainable contributing factors
- ⚙️ **Optimization Center** — Current vs AI-recommended berth/crane plan comparison
- 🤖 **AI Operations Copilot** — Natural-language assistant grounded in operational data
- 📋 **72-Hour Operations Plan** — AI-generated structured action plan
- 🚨 **Alerts Center** — Operational risk alerts with severity indicators

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Recharts |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| AI | IBM watsonx.ai |
| Development | IBM Bob |

## Architecture

```
React Frontend → Node.js/Express REST API → MongoDB
                       ↓
         Analytics Engine (Node.js — deterministic)
         Optimization Engine (Node.js — deterministic)
         AI Service (IBM watsonx.ai — natural language)
```

## How to Run

See [`docs/setup-guide.md`](docs/setup-guide.md) for complete setup instructions.

**Quick start:**
```bash
# Backend
cd src/backend && npm install && npm run dev

# Frontend (separate terminal)
cd src/frontend && npm install && npm run dev
```

## IBM Bob Integration

IBM Bob was used throughout this project for architecture design, code generation, debugging, testing, and documentation. See [`docs/solution-overview.md`](docs/solution-overview.md) for details.

## Demo

See [`demo/`](demo/) for screenshots and demo script.

## Known Limitations

- Uses synthetic/demo data — not connected to real AIS feeds
- Congestion model is analytical scoring, not a trained ML model
- AI responses are decision-support only — not autonomous commands

## Future Scope

- Real-time AIS vessel tracking integration
- Trained ML prediction model with historical port data
- Multi-port network optimization
- Mobile-responsive operations app

---

*PortMind AI — Team NeuraNex — IBM Bob AI Hackathon 2026*
