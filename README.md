# StockFlow AI — Agentic Inventory Management System

A working prototype of an agentic AI system that manages multi-branch inventory with demand forecasting, stockout-aware demand reconstruction, transfer economics, and full human-in-the-loop approval.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open the app
# Browser: http://localhost:3000
```

**Requirements:** Node.js 18+ (tested on Node 20)

---

## Business Problem

Multi-branch retailers face three persistent challenges:

1. **Stockout-distorted demand** — When a SKU is out of stock, sales drop to zero. Naive forecasting treats this as "low demand," causing under-ordering and repeated stockouts.
2. **Uneconomical transfers** — Moving stock between branches incurs freight, handling, and transit time costs. Many "obvious" transfers are actually money-losing when the economics are calculated.
3. **Disruption over-scoping** — When a supplier has an issue, planners often blanket-assume all products are affected, causing panic transfers and over-ordering.

StockFlow AI solves all three with a transparent, evidence-based 6-stage agent pipeline that **never executes without human approval**.

---

## Datasets

Two scenarios are pre-loaded:

### Scenario 1: Normal Operations
- **Business:** TechHub Retail (Electronics)
- **5 SKUs** (earbuds, chargers, watch bands, speakers, phone cases) across **4 locations** (NYC, LA, CHI, MIA warehouse)
- **90 days** of clean sales history per SKU+location
- Straightforward imbalances: NYC has excess earbuds, LA is low. MIA warehouse has ageing stock.
- Tests basic forecasting, excess detection, and economical transfer matching.

### Scenario 2: Difficult Operations
- **Business:** FreshTech Markets (Grocery + Electronics hybrid)
- **6 SKUs** (milk, bread, headphones, bananas, tablets, coffee) across **4 locations** (SEA, PDX, VAN, DC)
- **Data quality challenges:**
  - 20-day stockout in SEA milk history (distortion trap)
  - 9 days of missing data at VAN
  - 53 stockout-suppressed sales records total
- **SKU-specific supply disruption:** AudioTech Ltd factory fire affects ONLY SKU-2003 (Premium Headphones), not all electronics
- **Weather event:** Portland power outage affects only perishables (milk, bread, bananas) at PDX
- **Transfer trap:** PDX has 200 units of milk (9 days old, 5 days shelf life left). SEA has zero stock. Transfer LOOKS obvious but is REJECTED because:
  - Transfer cost is 75% of stock value (milk is cheap, freight is not)
  - Inbound PO arrives in 2 days — before projected stockout
  - Waiting for the PO is more cost-effective

---

## Method — 6-Stage Agent Pipeline

| Stage | What It Does | Key Output |
|-------|-------------|------------|
| **1. Accept Data** | Ingests SKU master, sales, inventory, inbound orders, disruption signals | Data quality report (grade A-D, missing/stockout record counts) |
| **2. Understand Inventory** | Structures available/reserved/incoming stock with age classification and disruption mapping | Per-SKU+location inventory view with shelf-life risk flags |
| **3. Forecast Demand** | 30-day forecasts using linear trend + weekly seasonality. **De-biases stockout-distorted history.** | Point estimates + confidence intervals + assumptions + data quality flags |
| **4. Identify Imbalances** | Flags shortages, excesses, ageing items, and misleading stockout-distorted sales history | Categorized imbalance lists with severity |
| **5. Recommend Actions** | Matches excess to shortage locations. Calculates transfer cost, ROI, shelf-life viability. **Rejects uneconomical transfers.** | Ranked transfer recommendations + rejected transfers with reasons |
| **6. Explain Impact** | Projects before/after state. Presents approval gate. Full traceability log. | Before/after comparison + assumption log + human approval required |

### Key Technical Details

**Stockout De-biasing:** The forecast separates `normal`, `stockout_suppressed`, and `missing` sales records. For stockout periods, true demand is estimated from the clean-data average, NOT the zero-sales average. The difference is reported explicitly (e.g., "Naive: 21.2/day, De-biased: 27.7/day — a 31% increase").

**Transfer Economics Engine:** Every potential transfer is evaluated against:
- Transfer cost = handling ($25) + per-unit-km freight ($0.50/unit/100km)
- Benefit = avoided stockout value + avoided holding cost + avoided waste (for perishables)
- ROI = total benefit / transfer cost (minimum 1.2x required)
- Cost % of stock value (maximum 15% allowed)
- Shelf-life viability (remaining shelf life - transit time > 0)
- PO comparison (if an inbound PO arrives before projected stockout, the transfer may be unnecessary)

**Disruption Scoping:** Disruptions specify `affectedSkus` and `affectedLocations`. The agent never applies a disruption to all SKUs unless explicitly scoped that way.

---

## Test Results

### Normal Scenario
| Metric | Value |
|--------|-------|
| Data Quality Grade | A (clean data) |
| Shortages Detected | 8 (2 critical) |
| Excesses Detected | 5 ($11,832 value) |
| Transfers Recommended | 1 |
| Transfers Rejected | 6 |
| Net Benefit | $711 |
| Pipeline Execution Time | ~24ms |

**Rejected transfers correctly caught:**
- MIA→LA: Distance 2,800km makes transfer cost exceed 15% threshold
- MIA→NYC for SKU-1002: PO-001 arriving in 14 days makes transfer unnecessary
- LA→NYC for SKU-1002: Cost 15.7% + PO comparison → rejected

### Difficult Scenario
| Metric | Value |
|--------|-------|
| Data Quality Grade | B (missing data, stockouts) |
| Shortages Detected | 13 (8 critical) |
| Excesses Detected | 6 |
| Ageing Items | 9 |
| Stockout-Distorted History | 3 SKUs de-biased |
| Transfers Recommended | 5 |
| Transfers Rejected | 7 |
| Net Benefit | $6,261 |

**Transfer trap correctly rejected:**
- PDX Milk → SEA: Rejected (cost 75% of value + PO arriving in 2 days)
- DC Bananas → PDX: Rejected (would expire in transit, 2 days shelf life - 2 days transit = 0)
- DC Milk → VAN: Rejected (ROI 0.85x, below 1.2x minimum)

**Stockout de-biasing results:**
- SEA Milk: Naive 21.2/day → De-biased 27.7/day (+31%)
- SEA Bread: Naive 21.9/day → De-biased 25.0/day (+14%)
- PDX Bananas: Naive 18.3/day → De-biased 23.9/day (+31%)

---

## Limitations

1. **Forecasting is simplified:** Uses linear trend + weekly seasonality. Production would use ARIMA, Prophet, or LLM-based models with external signals (holidays, promotions, competitor activity).
2. **Transfer cost model is basic:** Uses flat per-km rates. Real logistics have tiered pricing, LTL/FTL options, and route optimization.
3. **No real-time data integration:** Sample data is static. Production would connect to POS systems, WMS, and ERP via API.
4. **Meeting transcript parsing is keyword-based:** Production would use NLP/LLM for semantic extraction.
5. **No multi-echelon optimization:** Transfers are point-to-point. Production would optimize across the full supply network.
6. **30-day forecast horizon:** Confidence decreases significantly beyond 14 days. Long-range planning needs rolling forecasts.

---

## Pilot Requirements

To deploy StockFlow AI in a real business:

1. **Data integration:** Connect to POS (sales), WMS (inventory), ERP (purchase orders), and TMS (logistics) systems.
2. **Data quality audit:** Ensure at least 90 days of clean sales history per SKU+location. Identify and flag stockout periods.
3. **Strategic plan onboarding:** Define business niche, strategy, operational constraints (max transfer cost %, min ROI, safety stock multipliers).
4. **Role setup:** Configure Owner, Planner, Logistics, and Viewer roles with appropriate permissions.
5. **Pilot scope:** Start with 2-3 locations and 20-50 SKUs. Run in "recommendation-only" mode for 4 weeks. Compare agent recommendations against planner decisions.
6. **Success metrics:** Stockout rate reduction, excess inventory value reduction, transfer cost as % of inventory value, planner time saved.
7. **Ethical review:** Ensure data privacy compliance (GDPR/CCPA), audit trail completeness, and human approval workflow adherence.

---

## AI Ethics & Transparency Principles

| Principle | Implementation |
|-----------|---------------|
| **Transparency** | All forecasts include confidence scores, assumptions, and data quality flags. No forecast is presented as certain. |
| **No Fabricated Data** | The agent never invents demand signals. Missing data is labeled "missing" and de-biased estimates are explicitly labeled "assumptions." |
| **Human-in-the-Loop** | No transfer executes without explicit human approval. The planner can edit, reject, or approve any recommendation. |
| **Evidence Over Claims** | A cautious solution with evidence scores higher than one claiming big savings without proof. All benefits are estimates with stated confidence. |
| **Data Privacy** | Each business's data is isolated. Access is role-based. No cross-business data sharing without consent. |
| **Disruption Scoping** | Disruptions are scoped to specifically affected SKUs only, never blanket-applied to all products. |

---

## Source Code Structure

```
20261027120757/
├── package.json                    # Dependencies & scripts
├── README.md                       # This file
├── server/
│   ├── index.js                    # Express API server
│   ├── agent/
│   │   ├── AgentOrchestrator.js    # 6-stage pipeline coordinator
│   │   ├── DataIngestion.js        # Stage 1: Accept & validate data
│   │   ├── InventoryUnderstanding.js # Stage 2: Structure inventory
│   │   ├── Forecasting.js          # Stage 3: Forecast with de-biasing
│   │   ├── ImbalanceDetector.js    # Stage 4: Detect shortages/excess/ageing
│   │   ├── TransferEconomics.js    # Stage 5: Transfer cost-benefit engine
│   │   ├── ImpactExplainer.js      # Stage 6: Before/after + approval gate
│   │   └── AIAdvisor.js            # Strategic advisory & ethics
│   └── data/
│       ├── sampleData.js           # Two scenarios (normal + difficult)
│       └── businessProfiles.js     # Strategic plans for 6 niches
└── public/
    ├── index.html                  # Full app UI
    └── app.js                      # Frontend logic
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/run-pipeline` | Run the 6-stage pipeline on a scenario |
| POST | `/api/run-pipeline-custom` | Run on custom uploaded data |
| GET | `/api/business-profiles` | Get all business niche profiles |
| GET | `/api/scenario/:type` | Get scenario preview data |
| POST | `/api/transcript` | Upload & parse meeting transcript |
| POST | `/api/approve-transfer` | Approve/reject a transfer (human approval) |

---

## Business Niches Supported

| Niche | Key Risk | Default Strategy |
|-------|----------|-----------------|
| Electronics & Technology | Obsolescence, price erosion | Maximize availability |
| Grocery & Fresh Food | Perishability, shelf life | Minimize waste & maximize freshness |
| Fashion & Apparel | Seasonal obsolescence | Seasonal optimization |
| Automotive Parts | High stockout cost | Maximize parts availability |
| Home Appliances | High transfer cost | Balanced optimization |
| Mixed Retail | Varies by category | Category-aware optimization |

Each niche embeds different priority weights into the agent, affecting how shortages, excess, ageing, transfer costs, and waste are balanced.

---

## Subscription Tiers

| Tier | Price | Features |
|------|-------|----------|
| Starter | Free | Data ingestion, basic forecasts, 1 location |
| Professional | $499/mo | Full 6-stage pipeline, transfer economics, up to 10 locations |
| Enterprise | Custom | Unlimited locations, strategic embedding, meeting transcript AI, API access |

---

## Reproducing Results

```bash
# 1. Install & start
npm install && npm start

# 2. Open browser to http://localhost:3000

# 3. Select "Normal Operations" scenario → click "Run Pipeline"
#    Review: 6 stages, 8 shortages, 5 excesses, 1 recommended transfer

# 4. Select "Difficult Operations" scenario → click "Run Pipeline"
#    Review: Stockout distortion de-biasing, transfer trap rejection,
#    SKU-specific disruption scoping, shelf-life constraints

# 5. Navigate through all views:
#    - Agent Pipeline: Stage-by-stage results
#    - Inventory: Structured stock view
#    - Forecasts: 30-day predictions with confidence
#    - Imbalances: Shortages, excess, ageing, distortion
#    - Transfers: Recommendations + rejections + approval gate
#    - Logistics Map: Network visualization
#    - AI Advisory: Strategic recommendations
#    - Strategic Plan: Business niche configuration
#    - Meeting Upload: Transcript parsing
#    - Subscription: Pricing tiers
#    - AI Ethics: Principles & implementation

# 6. Test human approval:
#    Go to Transfers → click Approve/Reject on any transfer
```
