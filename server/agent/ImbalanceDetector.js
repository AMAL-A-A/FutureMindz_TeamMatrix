// ============================================================
// Stage 4: Imbalance Identification
// Flags shortages, excess, ageing, and misleading stockout-
// distorted sales history across all SKU+location pairs.
// ============================================================

class ImbalanceDetector {
  /**
   * Identify inventory imbalances using forecasts + current inventory
   * @param {Object} inventoryData - from Stage 2
   * @param {Object} forecastData - from Stage 3
   * @param {Object} strategicPlan - business profile
   * @returns {Object} shortages, excesses, ageing, distorted history
   */
  static detect(inventoryData, forecastData, strategicPlan) {
    const { inventoryView } = inventoryData;
    const { forecasts } = forecastData;
    const priorities = strategicPlan?.agentPriorities || {};

    const shortages = [];
    const excesses = [];
    const ageingItems = [];
    const distortedHistory = [];

    for (const inv of inventoryView) {
      // Find matching forecast
      const forecast = forecasts.find(f => f.skuId === inv.skuId && f.locationId === inv.locationId);

      if (!forecast) {
        // No forecast available - flag as assumption
        shortages.push({
          ...inv,
          type: 'no_forecast',
          severity: 'warning',
          message: `No demand forecast available for ${inv.skuName} at ${inv.locationName}. Assessment based on safety stock only.`,
          isAssumption: true,
        });
        continue;
      }

      // --- Days of Cover ---
      const dailyDemand = Math.max(0.1, forecast.avgDailyDemand);
      const effectiveStock = inv.available + inv.incoming;
      const daysOfCover = effectiveStock / dailyDemand;

      // --- Shortage detection ---
      // A shortage is when available stock is below safety stock,
      // or days of cover is critically low (< 3 days = high, 0 days = critical)
      const isShortage = inv.available < forecast.safetyStock || daysOfCover < 3;

      if (isShortage) {
        shortages.push({
          skuId: inv.skuId,
          skuName: inv.skuName,
          locationId: inv.locationId,
          locationName: inv.locationName,
          category: inv.category,
          available: inv.available,
          safetyStock: forecast.safetyStock,
          incoming: inv.incoming,
          avgDailyDemand: forecast.avgDailyDemand,
          daysOfCover: Math.round(daysOfCover * 10) / 10,
          leadTimeDays: forecast.leadTimeDays,
          severity: inv.available === 0 ? 'critical' : daysOfCover < 2 ? 'critical' : daysOfCover < 5 ? 'high' : 'medium',
          projectedStockoutDate: inv.available === 0 ? new Date().toISOString().split('T')[0] : addDays(Math.floor(daysOfCover)),
          confidenceScore: forecast.confidenceScore,
          hasStockoutDistortion: forecast.hasStockoutDistortion,
          recommendedAction: inv.available === 0 ? 'URGENT: Transfer or expedite PO immediately' : 'Transfer recommended before stockout',
          stockValue: inv.available * inv.unitCost,
          retailValue: inv.available * inv.unitPrice,
        });
      }

      // --- Excess detection ---
      // Excess = more than what's needed for 14 days + safety stock
      const expected14DayDemand = Math.round(forecast.avgDailyDemand * 14);
      const excessQty = Math.max(0, inv.available - expected14DayDemand - forecast.safetyStock);

      if (excessQty > 0) {
        const excessValue = excessQty * inv.unitCost;
        excesses.push({
          skuId: inv.skuId,
          skuName: inv.skuName,
          locationId: inv.locationId,
          locationName: inv.locationName,
          category: inv.category,
          onHand: inv.onHand,
          available: inv.available,
          excessQty: Math.round(excessQty),
          expected30DayDemand: forecast.total30DayDemand,
          daysOfCover: Math.round(daysOfCover * 10) / 10,
          excessValue: Math.round(excessValue),
          ageCategory: inv.ageCategory,
          ageRisk: inv.ageRisk,
          stockAgeDays: inv.stockAgeDays,
          remainingShelfLife: inv.remainingShelfLife,
          perishable: skuIsPerishable(inv),
          severity: excessQty > expected14DayDemand ? 'high' : 'medium',
          unitCost: inv.unitCost,
          unitPrice: inv.unitPrice,
          retailValue: inv.retailValue,
          confidenceScore: forecast.confidenceScore,
        });
      }

      // --- Ageing detection ---
      if (inv.ageRisk === 'high' || inv.ageRisk === 'medium' || inv.ageRisk === 'critical') {
        ageingItems.push({
          skuId: inv.skuId,
          skuName: inv.skuName,
          locationId: inv.locationId,
          locationName: inv.locationName,
          category: inv.category,
          onHand: inv.onHand,
          stockAgeDays: inv.stockAgeDays,
          ageCategory: inv.ageCategory,
          ageRisk: inv.ageRisk,
          remainingShelfLife: inv.remainingShelfLife,
          perishable: skuIsPerishable(inv),
          stockValue: inv.stockValue,
          unitCost: inv.unitCost,
          unitPrice: inv.unitPrice,
          severity: inv.ageRisk === 'critical' ? 'critical' : inv.ageRisk === 'high' ? 'high' : 'medium',
          recommendedAction: inv.ageRisk === 'critical' ? 'Mark down or donate immediately' :
            inv.ageRisk === 'high' ? 'Transfer to high-demand location or markdown' :
            'Monitor closely, consider transfer',
        });
      }

      // --- Stockout-distorted history flag ---
      if (forecast.hasStockoutDistortion) {
        distortedHistory.push({
          skuId: inv.skuId,
          skuName: inv.skuName,
          locationId: inv.locationId,
          locationName: inv.locationName,
          distortion: forecast.stockoutDistortion,
          dataQualityFlags: forecast.dataQualityFlags,
          confidenceScore: forecast.confidenceScore,
          warning: `Historical sales data for this SKU+location was suppressed by stockouts. The raw average understates true demand. Forecast has been de-biased. Do NOT trust raw averages.`,
          naiveDemand: parseFloat(forecast.stockoutDistortion?.naiveAvgDemand || '0'),
          debiasedDemand: parseFloat(forecast.stockoutDistortion?.debiasedDemand || '0'),
        });
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    shortages.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));
    excesses.sort((a, b) => b.excessValue - a.excessValue);
    ageingItems.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

    return {
      shortages,
      excesses,
      ageingItems,
      distortedHistory,
      summary: {
        totalShortages: shortages.length,
        criticalShortages: shortages.filter(s => s.severity === 'critical').length,
        totalExcesses: excesses.length,
        totalExcessValue: excesses.reduce((s, e) => s + e.excessValue, 0),
        totalAgeingItems: ageingItems.length,
        totalDistortedHistory: distortedHistory.length,
      },
    };
  }
}

function skuLeadTimeBuffer(leadTimeDays) {
  // Minimum days of cover should be at least lead time + 3 days buffer
  return leadTimeDays + 3;
}

function skuIsPerishable(inv) {
  return inv.shelfLifeDays != null;
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

module.exports = ImbalanceDetector;
