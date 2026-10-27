// ============================================================
// StockFlow AI - Sample Datasets
// Generates realistic SKU master, sales history, inventory,
// inbound orders, and disruption signals for two scenarios:
//  1. NORMAL scenario - clean data, typical operations
//  2. DIFFICULT scenario - missing data, stockouts, disruptions,
//     stockout-distorted history, and an uneconomical transfer trap
// ============================================================

// --- Helper: generate daily sales with trend + noise + optional stockout suppression ---
function generateSalesHistory(skuId, locationId, days, params) {
  const {
    baseDemand = 10,
    trend = 0,
    weeklySeasonality = true,
    noise = 0.2,
    stockoutDays = [], // array of {start, end} day indices where stock=0
    disruptionStart = null, // day index when a disruption suppresses supply
    disruptionEnd = null,
    missingDays = [], // day indices with no data (gaps)
  } = params;

  const history = [];
  for (let d = 0; d < days; d++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - d));
    const dateStr = date.toISOString().split('T')[0];

    // Check missing data
    if (missingDays.includes(d)) {
      history.push({ skuId, locationId, date: dateStr, unitsSold: null, dataQuality: 'missing' });
      continue;
    }

    // Check stockout
    const inStockout = stockoutDays.some(s => d >= s.start && d <= s.end);
    if (inStockout) {
      history.push({ skuId, locationId, date: dateStr, unitsSold: 0, dataQuality: 'stockout_suppressed', wasInStock: false });
      continue;
    }

    // Base demand with trend
    let demand = baseDemand + trend * d / days;

    // Weekly seasonality (weekends higher)
    if (weeklySeasonality) {
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 5 || dayOfWeek === 6) demand *= 1.4;
      if (dayOfWeek === 0) demand *= 0.8;
    }

    // Add noise
    demand *= (1 + (Math.random() - 0.5) * 2 * noise);
    demand = Math.max(0, Math.round(demand));

    history.push({
      skuId,
      locationId,
      date: dateStr,
      unitsSold: demand,
      dataQuality: 'normal',
      wasInStock: true,
    });
  }
  return history;
}

// ============================================================
// Scenario 1: NORMAL - MultiBranch Electronics Retailer
// 5 SKUs across 4 locations, clean data, straightforward imbalances
// ============================================================

function generateNormalScenario() {
  // SKU Master - Electronics
  const skus = [
    { skuId: 'SKU-1001', name: 'Wireless Earbuds Pro', category: 'Electronics', unitCost: 45, unitPrice: 129, leadTimeDays: 14, safetyStock: 30, shelfLifeDays: null, minOrderQty: 50 },
    { skuId: 'SKU-1002', name: 'USB-C Fast Charger 65W', category: 'Electronics', unitCost: 12, unitPrice: 39, leadTimeDays: 10, safetyStock: 50, shelfLifeDays: null, minOrderQty: 100 },
    { skuId: 'SKU-1003', name: 'Smartwatch Band Premium', category: 'Accessories', unitCost: 8, unitPrice: 35, leadTimeDays: 7, safetyStock: 40, shelfLifeDays: null, minOrderQty: 80 },
    { skuId: 'SKU-1004', name: 'Bluetooth Speaker Mini', category: 'Electronics', unitCost: 28, unitPrice: 89, leadTimeDays: 12, safetyStock: 25, shelfLifeDays: null, minOrderQty: 60 },
    { skuId: 'SKU-1005', name: 'Phone Case Universal', category: 'Accessories', unitCost: 3, unitPrice: 19, leadTimeDays: 5, safetyStock: 100, shelfLifeDays: null, minOrderQty: 200 },
  ];

  const locations = [
    { locationId: 'LOC-NYC', name: 'New York Flagship', type: 'flagship', address: '123 5th Ave, NY', lat: 40.7589, lng: -73.9851 },
    { locationId: 'LOC-LA', name: 'Los Angeles Store', type: 'retail', address: '456 Sunset Blvd, LA', lat: 34.0522, lng: -118.2437 },
    { locationId: 'LOC-CHI', name: 'Chicago Outlet', type: 'outlet', address: '789 Michigan Ave, CHI', lat: 41.8781, lng: -87.6298 },
    { locationId: 'LOC-MIA', name: 'Miami Distribution', type: 'warehouse', address: '321 Biscayne Blvd, MIA', lat: 25.7617, lng: -80.1918 },
  ];

  // Distances between locations (for transfer cost estimation)
  const distances = {
    'LOC-NYC|LOC-LA': 2800, 'LOC-NYC|LOC-CHI': 790, 'LOC-NYC|LOC-MIA': 1300,
    'LOC-LA|LOC-CHI': 2010, 'LOC-LA|LOC-MIA': 2740, 'LOC-CHI|LOC-MIA': 1380,
  };

  // Generate 90 days of sales history per SKU per location
  const salesHistory = [];
  for (const sku of skus) {
    for (const loc of locations) {
      const baseDemand = Math.floor(Math.random() * 15) + 5;
      salesHistory.push(...generateSalesHistory(sku.skuId, loc.locationId, 90, {
        baseDemand,
        trend: Math.random() * 3,
        noise: 0.25,
      }));
    }
  }

  // Current inventory (with some imbalances)
  const inventory = [
    // NYC - has excess of Earbuds, low on Chargers
    { skuId: 'SKU-1001', locationId: 'LOC-NYC', onHand: 180, reserved: 10, incoming: 0, stockAgeDays: 45 },
    { skuId: 'SKU-1002', locationId: 'LOC-NYC', onHand: 15, reserved: 5, incoming: 0, stockAgeDays: 3 },
    { skuId: 'SKU-1003', locationId: 'LOC-NYC', onHand: 60, reserved: 0, incoming: 0, stockAgeDays: 10 },
    { skuId: 'SKU-1004', locationId: 'LOC-NYC', onHand: 40, reserved: 2, incoming: 0, stockAgeDays: 20 },
    { skuId: 'SKU-1005', locationId: 'LOC-NYC', onHand: 250, reserved: 0, incoming: 0, stockAgeDays: 5 },

    // LA - low on Earbuds, excess Chargers
    { skuId: 'SKU-1001', locationId: 'LOC-LA', onHand: 12, reserved: 0, incoming: 0, stockAgeDays: 2 },
    { skuId: 'SKU-1002', locationId: 'LOC-LA', onHand: 220, reserved: 5, incoming: 0, stockAgeDays: 60 },
    { skuId: 'SKU-1003', locationId: 'LOC-LA', onHand: 30, reserved: 0, incoming: 0, stockAgeDays: 8 },
    { skuId: 'SKU-1004', locationId: 'LOC-LA', onHand: 18, reserved: 0, incoming: 0, stockAgeDays: 5 },
    { skuId: 'SKU-1005', locationId: 'LOC-LA', onHand: 80, reserved: 0, incoming: 0, stockAgeDays: 12 },

    // CHI - moderate levels
    { skuId: 'SKU-1001', locationId: 'LOC-CHI', onHand: 55, reserved: 0, incoming: 0, stockAgeDays: 15 },
    { skuId: 'SKU-1002', locationId: 'LOC-CHI', onHand: 70, reserved: 0, incoming: 0, stockAgeDays: 18 },
    { skuId: 'SKU-1003', locationId: 'LOC-CHI', onHand: 15, reserved: 0, incoming: 0, stockAgeDays: 4 },
    { skuId: 'SKU-1004', locationId: 'LOC-CHI', onHand: 35, reserved: 0, incoming: 0, stockAgeDays: 22 },
    { skuId: 'SKU-1005', locationId: 'LOC-CHI', onHand: 120, reserved: 0, incoming: 0, stockAgeDays: 9 },

    // MIA (Warehouse) - high stock, ageing
    { skuId: 'SKU-1001', locationId: 'LOC-MIA', onHand: 300, reserved: 0, incoming: 0, stockAgeDays: 75 },
    { skuId: 'SKU-1002', locationId: 'LOC-MIA', onHand: 400, reserved: 0, incoming: 0, stockAgeDays: 90 },
    { skuId: 'SKU-1003', locationId: 'LOC-MIA', onHand: 150, reserved: 0, incoming: 0, stockAgeDays: 30 },
    { skuId: 'SKU-1004', locationId: 'LOC-MIA', onHand: 200, reserved: 0, incoming: 0, stockAgeDays: 55 },
    { skuId: 'SKU-1005', locationId: 'LOC-MIA', onHand: 500, reserved: 0, incoming: 0, stockAgeDays: 40 },
  ];

  // Inbound orders
  const inboundOrders = [
    { orderId: 'PO-001', skuId: 'SKU-1002', locationId: 'LOC-NYC', quantity: 200, expectedDate: addDays(14), status: 'in_transit' },
    { orderId: 'PO-002', skuId: 'SKU-1001', locationId: 'LOC-LA', quantity: 100, expectedDate: addDays(10), status: 'confirmed' },
  ];

  return {
    scenarioName: 'Normal Operations',
    scenarioDescription: 'Multi-branch electronics retailer with clean data. NYC has excess earbuds while LA is low. Straightforward transfer opportunity.',
    skus,
    locations,
    distances,
    salesHistory,
    inventory,
    inboundOrders,
    disruptions: [],
    businessProfile: {
      name: 'TechHub Retail',
      niche: 'electronics',
      businessType: 'multi_branch_retail',
      strategy: 'maximize_availability',
      brandPositioning: 'premium_customer_experience',
      growthGoal: 'expand_to_10_stores',
    },
  };
}

// ============================================================
// Scenario 2: DIFFICULT - Grocery + Electronics Hybrid
// Missing data, stockout-distorted history, disruption scoped to
// specific SKUs, and a transfer that LOOKS good but is uneconomical
// ============================================================

function generateDifficultScenario() {
  // SKU Master - Mixed: perishable food + electronics
  const skus = [
    { skuId: 'SKU-2001', name: 'Organic Milk 1L', category: 'Food', unitCost: 1.5, unitPrice: 3.99, leadTimeDays: 2, safetyStock: 20, shelfLifeDays: 14, minOrderQty: 50, perishable: true },
    { skuId: 'SKU-2002', name: 'Fresh Bread Loaf', category: 'Food', unitCost: 0.8, unitPrice: 2.99, leadTimeDays: 1, safetyStock: 15, shelfLifeDays: 3, minOrderQty: 30, perishable: true },
    { skuId: 'SKU-2003', name: 'Premium Headphones', category: 'Electronics', unitCost: 80, unitPrice: 299, leadTimeDays: 21, safetyStock: 10, shelfLifeDays: null, minOrderQty: 30 },
    { skuId: 'SKU-2004', name: 'Organic Bananas (bunch)', category: 'Food', unitCost: 0.5, unitPrice: 1.99, leadTimeDays: 1, safetyStock: 30, shelfLifeDays: 5, minOrderQty: 100, perishable: true },
    { skuId: 'SKU-2005', name: 'Tablet 10 inch', category: 'Electronics', unitCost: 150, unitPrice: 449, leadTimeDays: 30, safetyStock: 5, shelfLifeDays: null, minOrderQty: 20 },
    { skuId: 'SKU-2006', name: 'Premium Coffee Beans 1kg', category: 'Food', unitCost: 8, unitPrice: 24.99, leadTimeDays: 7, safetyStock: 25, shelfLifeDays: 180, minOrderQty: 40 },
  ];

  const locations = [
    { locationId: 'LOC-SEA', name: 'Seattle Downtown', type: 'flagship', address: '100 Pike St, SEA', lat: 47.6097, lng: -122.3331 },
    { locationId: 'LOC-PDX', name: 'Portland Branch', type: 'retail', address: '200 Powell St, PDX', lat: 45.5152, lng: -122.6789 },
    { locationId: 'LOC-VAN', name: 'Vancouver WA Store', type: 'retail', address: '300 Main St, VAN', lat: 45.6287, lng: -122.6615 },
    { locationId: 'LOC-DC', name: 'Distribution Center', type: 'warehouse', address: '400 Industrial Ave, TAC', lat: 47.2529, lng: -122.4386 },
  ];

  const distances = {
    'LOC-SEA|LOC-PDX': 175, 'LOC-SEA|LOC-VAN': 165, 'LOC-SEA|LOC-DC': 40,
    'LOC-PDX|LOC-VAN': 22, 'LOC-PDX|LOC-DC': 145, 'LOC-VAN|LOC-DC': 155,
  };

  const salesHistory = [];

  // SKU-2001 (Milk) at SEA - has a 20-day stockout period in history
  // Naive forecast would say "low demand" but true demand was ~25/day
  salesHistory.push(...generateSalesHistory('SKU-2001', 'LOC-SEA', 90, {
    baseDemand: 25, trend: 0.5, noise: 0.15,
    stockoutDays: [{ start: 40, end: 60 }], // 20 days of zero sales due to no stock
  }));

  // SKU-2001 at PDX - lower demand but high stock (creates the transfer trap)
  salesHistory.push(...generateSalesHistory('SKU-2001', 'LOC-PDX', 90, {
    baseDemand: 8, trend: 0.2, noise: 0.15,
  }));

  // SKU-2001 at VAN - missing data (gaps)
  salesHistory.push(...generateSalesHistory('SKU-2001', 'LOC-VAN', 90, {
    baseDemand: 15, noise: 0.15,
    missingDays: [30, 31, 32, 33, 50, 51, 70, 71, 72],
  }));

  // SKU-2001 at DC - warehouse, minimal direct sales
  salesHistory.push(...generateSalesHistory('SKU-2001', 'LOC-DC', 90, {
    baseDemand: 2, noise: 0.3,
  }));

  // SKU-2002 (Bread) - short shelf life, high turnover
  for (const loc of locations) {
    salesHistory.push(...generateSalesHistory('SKU-2002', loc.locationId, 90, {
      baseDemand: Math.floor(Math.random() * 20) + 10, noise: 0.2,
      stockoutDays: loc.locationId === 'LOC-SEA' ? [{ start: 70, end: 80 }] : [],
    }));
  }

  // SKU-2003 (Headphones) - low volume, expensive
  for (const loc of locations) {
    salesHistory.push(...generateSalesHistory('SKU-2003', loc.locationId, 90, {
      baseDemand: Math.floor(Math.random() * 3) + 1, noise: 0.4,
    }));
  }

  // SKU-2004 (Bananas) - has stockout at PDX
  salesHistory.push(...generateSalesHistory('SKU-2004', 'LOC-SEA', 90, { baseDemand: 30, noise: 0.2 }));
  salesHistory.push(...generateSalesHistory('SKU-2004', 'LOC-PDX', 90, {
    baseDemand: 22, noise: 0.2,
    stockoutDays: [{ start: 50, end: 70 }],
  }));
  salesHistory.push(...generateSalesHistory('SKU-2004', 'LOC-VAN', 90, { baseDemand: 18, noise: 0.2 }));
  salesHistory.push(...generateSalesHistory('SKU-2004', 'LOC-DC', 90, { baseDemand: 1, noise: 0.3 }));

  // SKU-2005 (Tablet) - very low volume
  for (const loc of locations) {
    salesHistory.push(...generateSalesHistory('SKU-2005', loc.locationId, 90, {
      baseDemand: Math.random() > 0.7 ? 1 : 0, noise: 0.5,
    }));
  }

  // SKU-2006 (Coffee) - steady demand
  for (const loc of locations) {
    salesHistory.push(...generateSalesHistory('SKU-2006', loc.locationId, 90, {
      baseDemand: Math.floor(Math.random() * 8) + 3, noise: 0.18,
    }));
  }

  // Current inventory - deliberately problematic
  const inventory = [
    // SEA: has milk stockout RIGHT NOW, bread is fresh, headphones excess
    { skuId: 'SKU-2001', locationId: 'LOC-SEA', onHand: 0, reserved: 0, incoming: 0, stockAgeDays: 0 },
    { skuId: 'SKU-2002', locationId: 'LOC-SEA', onHand: 35, reserved: 0, incoming: 0, stockAgeDays: 1 },
    { skuId: 'SKU-2003', locationId: 'LOC-SEA', onHand: 45, reserved: 0, incoming: 0, stockAgeDays: 60 },
    { skuId: 'SKU-2004', locationId: 'LOC-SEA', onHand: 80, reserved: 0, incoming: 0, stockAgeDays: 2 },
    { skuId: 'SKU-2005', locationId: 'LOC-SEA', onHand: 8, reserved: 0, incoming: 0, stockAgeDays: 40 },
    { skuId: 'SKU-2006', locationId: 'LOC-SEA', onHand: 40, reserved: 0, incoming: 0, stockAgeDays: 15 },

    // PDX: excess milk (but only 5 days shelf life left!), low bread, low bananas
    { skuId: 'SKU-2001', locationId: 'LOC-PDX', onHand: 200, reserved: 0, incoming: 0, stockAgeDays: 9 },
    { skuId: 'SKU-2002', locationId: 'LOC-PDX', onHand: 5, reserved: 0, incoming: 0, stockAgeDays: 2 },
    { skuId: 'SKU-2003', locationId: 'LOC-PDX', onHand: 12, reserved: 0, incoming: 0, stockAgeDays: 25 },
    { skuId: 'SKU-2004', locationId: 'LOC-PDX', onHand: 8, reserved: 0, incoming: 0, stockAgeDays: 1 },
    { skuId: 'SKU-2005', locationId: 'LOC-PDX', onHand: 3, reserved: 0, incoming: 0, stockAgeDays: 15 },
    { skuId: 'SKU-2006', locationId: 'LOC-PDX', onHand: 20, reserved: 0, incoming: 0, stockAgeDays: 10 },

    // VAN: moderate
    { skuId: 'SKU-2001', locationId: 'LOC-VAN', onHand: 30, reserved: 0, incoming: 0, stockAgeDays: 3 },
    { skuId: 'SKU-2002', locationId: 'LOC-VAN', onHand: 20, reserved: 0, incoming: 0, stockAgeDays: 1 },
    { skuId: 'SKU-2003', locationId: 'LOC-VAN', onHand: 8, reserved: 0, incoming: 0, stockAgeDays: 30 },
    { skuId: 'SKU-2004', locationId: 'LOC-VAN', onHand: 25, reserved: 0, incoming: 0, stockAgeDays: 2 },
    { skuId: 'SKU-2005', locationId: 'LOC-VAN', onHand: 4, reserved: 0, incoming: 0, stockAgeDays: 20 },
    { skuId: 'SKU-2006', locationId: 'LOC-VAN', onHand: 15, reserved: 0, incoming: 0, stockAgeDays: 8 },

    // DC: warehouse high stock
    { skuId: 'SKU-2001', locationId: 'LOC-DC', onHand: 200, reserved: 0, incoming: 0, stockAgeDays: 5 },
    { skuId: 'SKU-2002', locationId: 'LOC-DC', onHand: 100, reserved: 0, incoming: 0, stockAgeDays: 2 },
    { skuId: 'SKU-2003', locationId: 'LOC-DC', onHand: 60, reserved: 0, incoming: 0, stockAgeDays: 45 },
    { skuId: 'SKU-2004', locationId: 'LOC-DC', onHand: 150, reserved: 0, incoming: 0, stockAgeDays: 3 },
    { skuId: 'SKU-2005', locationId: 'LOC-DC', onHand: 30, reserved: 0, incoming: 0, stockAgeDays: 60 },
    { skuId: 'SKU-2006', locationId: 'LOC-DC', onHand: 80, reserved: 0, incoming: 0, stockAgeDays: 25 },
  ];

  // Disruption signal - supply disruption ONLY affects SKU-2003 (Headphones)
  // from supplier "AudioTech Ltd" - NOT a blanket disruption
  const disruptions = [
    {
      disruptionId: 'DIS-001',
      type: 'supply_disruption',
      supplier: 'AudioTech Ltd',
      affectedSkus: ['SKU-2003'], // ONLY this SKU is affected
      affectedLocations: ['all'], // all locations for this SKU
      startDate: addDays(-5),
      expectedResolutionDate: addDays(21),
      severity: 'major',
      description: 'AudioTech Ltd factory fire. Premium Headphones supply disrupted. Only SKU-2003 affected - other electronics from different suppliers are unaffected.',
      confidence: 0.95,
      source: 'supplier_notification + industry_news',
    },
    {
      disruptionId: 'DIS-002',
      type: 'weather_event',
      affectedLocations: ['LOC-PDX'],
      affectedSkus: ['SKU-2001', 'SKU-2002', 'SKU-2004'], // perishables affected by power outage
      startDate: addDays(-2),
      expectedResolutionDate: addDays(1),
      severity: 'minor',
      description: 'Local power outage in Portland area. Cold chain integrity at risk for perishables. Non-perishables unaffected.',
      confidence: 0.80,
      source: 'weather_service + store_manager_report',
    },
  ];

  // Inbound orders
  const inboundOrders = [
    { orderId: 'PO-201', skuId: 'SKU-2001', locationId: 'LOC-SEA', quantity: 200, expectedDate: addDays(2), status: 'in_transit' },
    { orderId: 'PO-202', skuId: 'SKU-2003', locationId: 'LOC-SEA', quantity: 30, expectedDate: addDays(21), status: 'delayed', delayReason: 'DIS-001' },
  ];

  return {
    scenarioName: 'Difficult Operations',
    scenarioDescription: 'Grocery+Electronics hybrid with stockout-distorted milk history at SEA, missing data at VAN, SKU-specific supply disruption, perishable shelf-life constraints, and a transfer trap (PDX milk looks transferable but expires in 5 days).',
    skus,
    locations,
    distances,
    salesHistory,
    inventory,
    inboundOrders,
    disruptions,
    businessProfile: {
      name: 'FreshTech Markets',
      niche: 'grocery_electronics_hybrid',
      businessType: 'multi_branch_hybrid',
      strategy: 'minimize_waste_maximize_freshness',
      brandPositioning: 'convenience_quality',
      growthGoal: 'optimize_current_footprint',
    },
  };
}

// ============================================================
// TRANSFER TRAP: PDX has 120 units of milk (SKU-2001) that looks
// like excess. SEA has 0 (stockout). But PDX milk is 9 days old
// with a 14-day shelf life - only 5 days left. Transferring it
// takes 1 day, leaving 4 days of sellable shelf. The transfer cost
// + expected waste makes it UNATTRACTIVE vs waiting for the
// inbound PO arriving in 2 days. The economics engine should
// REJECT this transfer and flag it as an "assumption".
// ============================================================

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Export both scenarios
module.exports = {
  normalScenario: generateNormalScenario(),
  difficultScenario: generateDifficultScenario(),
  generateNormalScenario,
  generateDifficultScenario,
};
