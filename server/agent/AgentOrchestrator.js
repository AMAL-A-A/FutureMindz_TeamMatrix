// ============================================================
// Agent Orchestrator - 6-Stage Pipeline
// Coordinates: Ingest → Understand → Forecast → Detect →
// Recommend → Explain. Full traceability and human approval.
// ============================================================

const DataIngestion = require('./DataIngestion');
const InventoryUnderstanding = require('./InventoryUnderstanding');
const Forecasting = require('./Forecasting');
const ImbalanceDetector = require('./ImbalanceDetector');
const TransferEconomics = require('./TransferEconomics');
const ImpactExplainer = require('./ImpactExplainer');
const AIAdvisor = require('./AIAdvisor');
const { createStrategicPlan } = require('../data/businessProfiles');

class AgentOrchestrator {
  constructor() {
    this.stages = [];
  }

  /**
   * Run the full 6-stage pipeline
   * @param {Object} rawData - scenario data
   * @param {Object} strategicPlan - business strategic plan
   * @returns {Object} complete pipeline results
   */
  run(rawData, strategicPlan) {
    const stages = [];
    const startTime = Date.now();

    // --- Stage 1: Accept Data ---
    const stage1Start = Date.now();
    const ingestedData = DataIngestion.ingest(rawData);
    stages.push({
      stage: 1,
      name: 'Accept Data',
      durationMs: Date.now() - stage1Start,
      status: 'complete',
      summary: {
        skus: ingestedData.skus.length,
        locations: ingestedData.locations.length,
        salesRecords: ingestedData.dataQualityReport.summary.totalSalesRecords,
        dataQualityGrade: ingestedData.dataQualityReport.summary.qualityGrade,
        qualityScore: ingestedData.dataQualityReport.summary.qualityScore,
        issues: ingestedData.dataQualityReport.issues.length,
        warnings: ingestedData.dataQualityReport.warnings.length,
      },
    });

    // --- Stage 2: Understand Inventory ---
    const stage2Start = Date.now();
    const inventoryData = InventoryUnderstanding.analyze(ingestedData);
    stages.push({
      stage: 2,
      name: 'Understand Inventory',
      durationMs: Date.now() - stage2Start,
      status: 'complete',
      summary: {
        totalInventoryValue: inventoryData.totalInventoryValue,
        totalLocations: inventoryData.totalLocations,
        insights: inventoryData.insights.length,
        criticalStocks: inventoryData.summaryByLocation.reduce((s, l) => s + l.criticalStocks, 0),
      },
    });

    // --- Stage 3: Forecast Demand ---
    const stage3Start = Date.now();
    const forecastData = Forecasting.forecast(ingestedData, inventoryData);
    stages.push({
      stage: 3,
      name: 'Forecast Demand',
      durationMs: Date.now() - stage3Start,
      status: 'complete',
      summary: {
        forecastsGenerated: forecastData.forecasts.length,
        methodology: forecastData.methodology,
        assumptions: forecastData.assumptions.length,
        limitations: forecastData.limitations.length,
        lowConfidenceForecasts: forecastData.forecasts.filter(f => f.confidenceScore < 50).length,
        stockoutDistortedForecasts: forecastData.forecasts.filter(f => f.hasStockoutDistortion).length,
      },
    });

    // --- Stage 4: Identify Imbalances ---
    const stage4Start = Date.now();
    const imbalanceData = ImbalanceDetector.detect(inventoryData, forecastData, strategicPlan);
    stages.push({
      stage: 4,
      name: 'Identify Imbalances',
      durationMs: Date.now() - stage4Start,
      status: 'complete',
      summary: imbalanceData.summary,
    });

    // --- Stage 5: Recommend Actions ---
    const stage5Start = Date.now();
    const transferData = TransferEconomics.recommend(imbalanceData, ingestedData, inventoryData, forecastData, strategicPlan);
    stages.push({
      stage: 5,
      name: 'Recommend Actions',
      durationMs: Date.now() - stage5Start,
      status: 'complete',
      summary: {
        ...transferData.summary,
        rejectedTransfers: transferData.rejected.length,
        rejectionReasons: transferData.rejected.map(r => r.rejectionReason),
      },
    });

    // --- Stage 6: Explain Impact ---
    const stage6Start = Date.now();
    const impactData = ImpactExplainer.explainImpact(
      transferData.recommendations,
      imbalanceData,
      inventoryData,
      forecastData
    );
    stages.push({
      stage: 6,
      name: 'Explain Impact',
      durationMs: Date.now() - stage6Start,
      status: 'complete',
      summary: {
        shortagesResolved: impactData.beforeAfter.delta.shortagesResolved,
        criticalShortagesResolved: impactData.beforeAfter.delta.criticalShortagesResolved,
        excessesCleared: impactData.beforeAfter.delta.excessesCleared,
        totalNetBenefit: impactData.totalNetBenefit,
        totalTransferCost: impactData.totalTransferCost,
        approvalGate: impactData.approvalGate.status,
        pendingActions: impactData.approvalGate.pendingActions,
      },
    });

    // --- AI Advisory ---
    const advisoryData = AIAdvisor.advise(
      { forecastData, imbalanceData, transferData, impactData, inventoryData, data: ingestedData },
      strategicPlan,
      rawData.businessProfile
    );

    const totalDuration = Date.now() - startTime;

    return {
      scenario: rawData.scenarioName,
      scenarioDescription: rawData.scenarioDescription,
      businessProfile: rawData.businessProfile,
      strategicPlan,
      stages,
      stageResults: {
        stage1_data: {
          dataQualityReport: ingestedData.dataQualityReport,
          skus: ingestedData.skus,
          locations: ingestedData.locations,
        },
        stage2_inventory: inventoryData,
        stage3_forecast: forecastData,
        stage4_imbalances: imbalanceData,
        stage5_transfers: transferData,
        stage6_impact: impactData,
        advisory: advisoryData,
      },
      totalDurationMs: totalDuration,
      generatedAt: new Date().toISOString(),
      pipelineVersion: '1.0.0',
    };
  }
}

module.exports = AgentOrchestrator;
