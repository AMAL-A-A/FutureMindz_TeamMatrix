// ============================================================
// Stage 6: Impact Explanation
// Before/after comparison of approved transfers on shortages,
// ageing, holding cost, and transfer cost. Includes planner
// approval gate and full traceability.
// ============================================================

class ImpactExplainer {
  /**
   * Generate before/after impact analysis for a set of transfers
   * @param {Array} transfers - approved transfer recommendations
   * @param {Object} imbalances - from Stage 4
   * @param {Object} inventoryData - from Stage 2
   * @param {Object} forecastData - from Stage 3
   * @returns {Object} impact analysis
   */
  static explainImpact(transfers, imbalances, inventoryData, forecastData) {
    const before = this.snapshotState(imbalances, inventoryData);
    const after = this.projectAfterTransfers(transfers, imbalances, inventoryData, forecastData);

    // Detailed transfer impact
    const transferImpacts = transfers.map(t => ({
      transferId: t.transferId,
      skuId: t.skuId,
      skuName: t.skuName,
      from: t.fromLocation.locationName,
      to: t.toLocation.locationName,
      quantity: t.quantity,
      transferCost: t.transferCost,
      netBenefit: t.netBenefit,
      impact: {
        sourceAfterTransfer: Math.max(0, t.fromLocation.availableStock - t.quantity),
        destinationAfterTransfer: t.toLocation.currentStock + t.quantity,
        destinationDaysOfCoverAfter: ((t.toLocation.currentStock + t.quantity) / Math.max(0.1, t.toLocation.avgDailyDemand)).toFixed(1),
        stockoutRiskMitigated: (t.toLocation.currentStock + t.quantity) >= t.toLocation.safetyStock,
      },
      assumptions: t.assumptions || [],
      approvalStatus: 'pending',
    }));

    return {
      beforeAfter: {
        before: {
          totalShortages: before.totalShortages,
          criticalShortages: before.criticalShortages,
          totalExcesses: before.totalExcesses,
          totalExcessValue: before.totalExcessValue,
          totalAgeingItems: before.totalAgeingItems,
          totalHoldingCostPerDay: before.totalHoldingCostPerDay,
          inventoryValue: before.inventoryValue,
        },
        after: {
          totalShortages: after.totalShortages,
          criticalShortages: after.criticalShortages,
          totalExcesses: after.totalExcesses,
          totalExcessValue: after.totalExcessValue,
          totalAgeingItems: after.totalAgeingItems,
          totalHoldingCostPerDay: after.totalHoldingCostPerDay,
          inventoryValue: after.inventoryValue,
        },
        delta: {
          shortagesResolved: before.totalShortages - after.totalShortages,
          criticalShortagesResolved: before.criticalShortages - after.criticalShortages,
          excessesCleared: before.totalExcesses - after.totalExcesses,
          excessValueReduced: before.totalExcessValue - after.totalExcessValue,
          holdingCostSavedPerDay: Math.round((before.totalHoldingCostPerDay - after.totalHoldingCostPerDay) * 100) / 100,
        },
      },
      transferImpacts,
      totalTransferCost: transfers.reduce((s, t) => s + t.transferCost, 0),
      totalNetBenefit: transfers.reduce((s, t) => s + t.netBenefit, 0),
      approvalGate: {
        status: 'pending_approval',
        approver: 'planner',
        pendingActions: transfers.length,
        canApproveAll: true,
        canRejectIndividual: true,
        canEditQuantities: true,
        requiresJustificationForRejection: false,
        warning: 'No transfer will be executed until explicitly approved by the planner (Sara). All forecasts are estimates with stated confidence intervals — NOT certainties.',
      },
      traceability: {
        dataLineage: [
          'Raw data ingested → Stage 1 (data quality assessed)',
          'Inventory structured → Stage 2 (source-tracked with timestamps)',
          'Forecast generated → Stage 3 (with assumptions, confidence, de-biasing)',
          'Imbalances detected → Stage 4 (shortages, excesses, ageing, distorted history)',
          'Transfers evaluated → Stage 5 (cost-benefit, trap rejection, safety stock compliance)',
          'Impact projected → Stage 6 (before/after, approval gate)',
        ],
        assumptionsLog: this.collectAllAssumptions(transfers, forecastData),
        unsupportedFlags: this.findUnsupportedClaims(transfers, forecastData),
      },
    };
  }

  static snapshotState(imbalances, inventoryData) {
    const { summary } = imbalances;
    const totalHoldingCostPerDay = inventoryData.inventoryView.reduce((s, inv) =>
      s + inv.stockValue * 0.001, 0
    );
    return {
      totalShortages: summary.totalShortages,
      criticalShortages: summary.criticalShortages,
      totalExcesses: summary.totalExcesses,
      totalExcessValue: summary.totalExcessValue,
      totalAgeingItems: summary.totalAgeingItems,
      totalHoldingCostPerDay: Math.round(totalHoldingCostPerDay * 100) / 100,
      inventoryValue: inventoryData.totalInventoryValue,
    };
  }

  static projectAfterTransfers(transfers, imbalances, inventoryData, forecastData) {
    // Simulate the effect of approved transfers
    let { shortages, excesses } = JSON.parse(JSON.stringify(imbalances));
    const inventoryMap = new Map();
    for (const inv of inventoryData.inventoryView) {
      inventoryMap.set(`${inv.skuId}|${inv.locationId}`, { ...inv });
    }

    // Apply each transfer
    for (const t of transfers) {
      const sourceKey = `${t.skuId}|${t.fromLocation.locationId}`;
      const destKey = `${t.skuId}|${t.toLocation.locationId}`;
      const source = inventoryMap.get(sourceKey);
      const dest = inventoryMap.get(destKey);

      if (source) source.available = Math.max(0, source.available - t.quantity);
      if (dest) {
        dest.available = (dest.available || 0) + t.quantity;
        dest.onHand = (dest.onHand || 0) + t.quantity;
      }
    }

    // Recalculate imbalances
    let newShortages = 0;
    let newCriticalShortages = 0;
    let newExcesses = 0;
    let newExcessValue = 0;
    let newAgeing = 0;

    for (const [key, inv] of inventoryMap) {
      const forecast = forecastData.forecasts.find(f =>
        f.skuId === inv.skuId && f.locationId === inv.locationId
      );
      const safetyStock = forecast?.safetyStock || 0;
      const avgDemand = forecast?.avgDailyDemand || 0;

      if (inv.available < safetyStock) {
        newShortages++;
        if (inv.available === 0) newCriticalShortages++;
      }

      const expected30Day = forecast?.total30DayDemand || 0;
      const excessQty = Math.max(0, inv.available - expected30Day - safetyStock);
      if (excessQty > 0) {
        newExcesses++;
        newExcessValue += excessQty * inv.unitCost;
      }

      if (inv.stockAgeDays > 60) newAgeing++;
    }

    const totalHoldingCostPerDay = Array.from(inventoryMap.values()).reduce((s, inv) =>
      s + inv.stockValue * 0.001, 0
    );

    return {
      totalShortages: newShortages,
      criticalShortages: newCriticalShortages,
      totalExcesses: newExcesses,
      totalExcessValue: Math.round(newExcessValue),
      totalAgeingItems: newAgeing,
      totalHoldingCostPerDay: Math.round(totalHoldingCostPerDay * 100) / 100,
      inventoryValue: Array.from(inventoryMap.values()).reduce((s, inv) => s + inv.stockValue, 0),
    };
  }

  static collectAllAssumptions(transfers, forecastData) {
    const assumptions = new Set();
    for (const t of transfers) {
      if (t.assumptions) t.assumptions.forEach(a => assumptions.add(a));
    }
    for (const f of forecastData.forecasts) {
      if (f.assumptions) f.assumptions.forEach(a => assumptions.add(a));
    }
    return Array.from(assumptions);
  }

  static findUnsupportedClaims(transfers, forecastData) {
    // Flag any claims that lack supporting evidence
    const flags = [];
    for (const t of transfers) {
      if (t.netBenefit > 10000 && t.toLocation.avgDailyDemand < 1) {
        flags.push(`Transfer ${t.transferId} claims high benefit but destination demand is <1/day — benefit estimate uncertain.`);
      }
      if (t.toLocation.avgDailyDemand === 0) {
        flags.push(`Transfer ${t.transferId} destination has zero demand history — transfer would create excess, not solve shortage.`);
      }
    }
    return flags;
  }
}

module.exports = ImpactExplainer;
