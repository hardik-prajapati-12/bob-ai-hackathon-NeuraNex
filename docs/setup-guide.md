# Setup Guide

## PortMind AI — Complete Setup Instructions

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18.x or 20.x | LTS recommended |
| npm | 9.x or higher | Included with Node.js |
| MongoDB | 6.x or higher | Local install or MongoDB Atlas |
| Git | Any recent version | For cloning |

### Step 1 — Clone the Repository

```bash
git clone <repository-url>
cd bob-ai-hackathon-NeuraNex
```

### Step 2 — Configure Environment Variables

**Backend:**
```bash
cd src/backend
cp .env.example .env
```

Edit `src/backend/.env` and fill in your values:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/portmind
JWT_SECRET=choose_a_random_secret_string
DEMO_USERNAME=admin
DEMO_PASSWORD=portmind2026
AI_PROVIDER=watsonx
WATSONX_API_KEY=<your-watsonx-api-key>
WATSONX_PROJECT_ID=<your-watsonx-project-id>
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-13b-chat-v2
FRONTEND_URL=http://localhost:5173
```

**Frontend:**
```bash
cd src/frontend
cp .env.example .env
```

Edit `src/frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### Step 3 — Install Dependencies

**Backend:**
```bash
cd src/backend
npm install
```

**Frontend:**
```bash
cd src/frontend
npm install
```

### Step 4 — Start MongoDB

**Local MongoDB:**
```bash
mongod --dbpath /data/db
```

Or start the MongoDB service:
```bash
# macOS (Homebrew)
brew services start mongodb-community

# Windows
net start MongoDB

# Linux
sudo systemctl start mongod
```

**MongoDB Atlas:** Set `MONGODB_URI` in `.env` to your Atlas connection string.

### Step 5 — Seed the Database

```bash
cd src/backend
npm run seed
```

This creates realistic synthetic demo data:
- 3 terminals, 20 berths, 30 cranes
- 50 vessels with congestion scenarios
- 90 days of historical operations data
- Active alerts and predictions

### Step 6 — Start the Backend

```bash
cd src/backend
npm run dev
```

The backend starts at: **http://localhost:5000**

Verify: `GET http://localhost:5000/api/health` should return `{"status":"ok"}`

### Step 7 — Start the Frontend

```bash
cd src/frontend
npm run dev
```

The frontend starts at: **http://localhost:5173**

### Step 8 — Demo Login

```
Username: admin
Password: portmind2026
```

### IBM watsonx.ai Configuration

The application requires IBM watsonx.ai for the AI assistant and operations plan features.

**To obtain credentials:**
1. Log in to [IBM Cloud](https://cloud.ibm.com)
2. Create or access a watsonx.ai project
3. Generate an API key
4. Copy your Project ID

If no watsonx.ai credentials are configured, the AI assistant falls back to a structured data response mode with limited natural-language generation.

### Troubleshooting

| Issue | Solution |
|---|---|
| MongoDB connection refused | Ensure MongoDB is running; check MONGODB_URI |
| Port 5000 already in use | Change PORT in backend .env |
| Port 5173 already in use | Vite will auto-select next available port |
| AI responses not working | Check WATSONX_API_KEY and WATSONX_PROJECT_ID |
| Seed fails with duplicate error | Run `npm run seed:reset` to clear and re-seed |

### Running Tests

```bash
# Backend tests
cd src/backend
npm test

# Frontend tests
cd src/frontend
npm test
```

---

*PortMind AI — IBM Bob AI Hackathon 2026*
