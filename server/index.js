// ============================================================
// StockFlow AI - API Server
// Express server serving the agent pipeline + static frontend
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const AgentOrchestrator = require('./agent/AgentOrchestrator');
const { normalScenario, difficultScenario } = require('./data/sampleData');
const { createStrategicPlan, BUSINESS_PROFILES } = require('./data/businessProfiles');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ============================================================
// API Routes
// ============================================================

// --- Run pipeline on a scenario ---
app.post('/api/run-pipeline', (req, res) => {
  try {
    const { scenario, niche, strategy, customGoals } = req.body;

    // Select scenario data
    let rawData;
    if (scenario === 'difficult') {
      rawData = JSON.parse(JSON.stringify(difficultScenario));
    } else {
      rawData = JSON.parse(JSON.stringify(normalScenario));
    }

    // Override business profile if custom niche provided
    if (niche) {
      rawData.businessProfile.niche = niche;
    }

    // Create strategic plan
    const strategicPlan = createStrategicPlan(
      rawData.businessProfile.name,
      niche || rawData.businessProfile.niche,
      strategy || rawData.businessProfile.strategy,
      customGoals || {}
    );

    // Run the pipeline
    const orchestrator = new AgentOrchestrator();
    const results = orchestrator.run(rawData, strategicPlan);

    res.json(results);
  } catch (error) {
    console.error('Pipeline error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Run pipeline on custom uploaded data ---
app.post('/api/run-pipeline-custom', (req, res) => {
  try {
    const { data, niche, strategy } = req.body;
    const strategicPlan = createStrategicPlan(
      data.businessProfile?.name || 'Custom Business',
      niche || data.businessProfile?.niche || 'mixed',
      strategy || data.businessProfile?.strategy,
      {}
    );
    const orchestrator = new AgentOrchestrator();
    const results = orchestrator.run(data, strategicPlan);
    res.json(results);
  } catch (error) {
    console.error('Custom pipeline error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Get available business profiles ---
app.get('/api/business-profiles', (req, res) => {
  res.json(BUSINESS_PROFILES);
});

// --- Get scenario data preview ---
app.get('/api/scenario/:type', (req, res) => {
  const scenario = req.params.type === 'difficult' ? difficultScenario : normalScenario;
  res.json({
    scenarioName: scenario.scenarioName,
    scenarioDescription: scenario.scenarioDescription,
    skus: scenario.skus,
    locations: scenario.locations,
    disruptions: scenario.disruptions,
    businessProfile: scenario.businessProfile,
    inventorySummary: scenario.inventory.length,
    salesRecords: scenario.salesHistory.length,
  });
});

// --- Submit meeting transcript ---
app.post('/api/transcript', (req, res) => {
  const AIAdvisor = require('./agent/AIAdvisor');
  const { transcriptText, department, date } = req.body;
  const parsed = AIAdvisor.parseTranscript(transcriptText, department, date);
  res.json(parsed);
});

// --- Approve/Reject transfers (mock for demo) ---
app.post('/api/approve-transfer', (req, res) => {
  const { transferId, action, quantity, justification } = req.body;
  // In production, this would update a database and trigger logistics workflow
  res.json({
    transferId,
    action,
    status: action === 'approve' ? 'approved' : 'rejected',
    quantity: quantity || null,
    justification: justification || null,
    processedAt: new Date().toISOString(),
    message: action === 'approve'
      ? `Transfer ${transferId} approved. Quantity: ${quantity || 'as recommended'}. Logistics team notified.`
      : `Transfer ${transferId} rejected. Reason: ${justification || 'Not provided'}.`,
    ethicalNote: 'No action was taken without human approval. Full audit trail maintained.',
  });
});

// --- Serve frontend ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   StockFlow AI Server Running              ║`);
  console.log(`║   http://localhost:${PORT}                     ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});
