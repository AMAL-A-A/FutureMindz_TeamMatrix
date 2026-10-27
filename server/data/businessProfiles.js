// ============================================================
// StockFlow AI - Business Strategic Plan Templates
// Pre-built strategic profiles for different business niches.
// These profiles configure the AI agent's behavior, priorities,
// and recommendations based on the company's strategy.
// ============================================================

const BUSINESS_PROFILES = {
  electronics: {
    niche: 'Electronics & Technology',
    description: 'Consumer electronics retail with fast product cycles, high unit value, and significant price erosion over time.',
    defaultStrategy: 'maximize_availability',
    strategies: [
      { id: 'maximize_availability', name: 'Maximize Product Availability', description: 'Prioritize having stock in all locations. Higher holding cost but better customer experience.' },
      { id: 'minimize_holding_cost', name: 'Minimize Holding Cost', description: 'Keep inventory lean. Higher stockout risk but lower capital tied up.' },
      { id: 'rapid_turnover', name: 'Rapid Turnover & Freshness', description: 'Move inventory fast to avoid obsolescence. Aggressive transfers and markdowns.' },
    ],
    agentPriorities: {
      stockoutWeight: 0.35,
      overstockWeight: 0.20,
      ageingWeight: 0.25, // high - electronics lose value
      transferCostWeight: 0.15,
      wasteWeight: 0.05,
    },
    riskFactors: {
      obsolescenceRisk: 'high',
      priceErosion: 'high',
      shelfLifeConcern: 'low',
      perishability: false,
    },
    tips: [
      'Electronics lose 5-10% value per month. Prioritize moving aged stock before the next product cycle.',
      'For high-value SKUs, consider consolidating at flagship locations for better security and showroom appeal.',
      'Use safety stock buffers proportional to lead time — 21-day lead time SKUs need deeper buffers.',
    ],
  },

  grocery: {
    niche: 'Grocery & Fresh Food',
    description: 'Perishable food retail with short shelf lives, daily deliveries, and waste as a primary concern.',
    defaultStrategy: 'minimize_waste_maximize_freshness',
    strategies: [
      { id: 'minimize_waste', name: 'Minimize Waste', description: 'Prioritize reducing spoilage. Accept slightly higher stockout risk for ultra-fresh items.' },
      { id: 'maximize_availability', name: 'Maximize Freshness & Availability', description: 'Balance between always having stock and ensuring freshness.' },
      { id: 'rapid_turnover', name: 'Rapid Turnover & Freshness', description: 'Move inventory fast. Aggressive transfers of near-expiry stock to high-demand locations.' },
    ],
    agentPriorities: {
      stockoutWeight: 0.20,
      overstockWeight: 0.15,
      ageingWeight: 0.30, // critical - perishability
      transferCostWeight: 0.10,
      wasteWeight: 0.25, // high for grocery
    },
    riskFactors: {
      obsolescenceRisk: 'low',
      priceErosion: 'low',
      shelfLifeConcern: 'critical',
      perishability: true,
    },
    tips: [
      'Perishable items with <3 days shelf life should never be transferred more than 1 day away.',
      'Consider donating near-expiry food rather than transferring — tax benefits + brand goodwill.',
      'Always cross-reference weather disruptions with cold-chain integrity for frozen/refrigerated SKUs.',
    ],
  },

  fashion: {
    niche: 'Fashion & Apparel',
    description: 'Seasonal fashion retail with trend-driven demand, size/variant complexity, and end-of-season markdowns.',
    defaultStrategy: 'seasonal_optimization',
    strategies: [
      { id: 'seasonal_optimization', name: 'Seasonal Optimization', description: 'Align inventory with seasonal demand curves. Move stock proactively before season ends.' },
      { id: 'maximize_availability', name: 'Maximize Size Availability', description: 'Ensure all size variants available across locations for customer satisfaction.' },
      { id: 'minimize_markdown', name: 'Minimize Markdown Loss', description: 'Transfer excess to outlets before end-of-season markdowns eat margin.' },
    ],
    agentPriorities: {
      stockoutWeight: 0.25,
      overstockWeight: 0.25,
      ageingWeight: 0.20,
      transferCostWeight: 0.10,
      wasteWeight: 0.20, // markdown loss treated as waste
    },
    riskFactors: {
      obsolescenceRisk: 'high', // seasonal obsolescence
      priceErosion: 'medium',
      shelfLifeConcern: 'low',
      perishability: false,
    },
    tips: [
      'Seasonal items should be transferred to outlet locations 3-4 weeks before season end.',
      'Size variants matter — a "complete the look" opportunity can drive 30% more sales if all sizes available.',
      'Markdown timing is critical: early markdowns lose margin, late markdowns lose the clearance window.',
    ],
  },

  automotive: {
    niche: 'Automotive Parts & Vehicles',
    description: 'Auto parts distribution with long lead times, high unit costs, and complex compatibility matrices.',
    defaultStrategy: 'maximize_availability',
    strategies: [
      { id: 'maximize_availability', name: 'Maximize Parts Availability', description: 'High cost of stockout (lost repair revenue). Maintain deep safety stock for critical parts.' },
      { id: 'minimize_holding_cost', name: 'Minimize Holding Cost', description: 'Lean inventory for slow-moving parts. Rely on inter-branch transfers for urgent needs.' },
    ],
    agentPriorities: {
      stockoutWeight: 0.40, // very high - stockout = lost repair job
      overstockWeight: 0.20,
      ageingWeight: 0.10,
      transferCostWeight: 0.25, // transfers are expedited and expensive
      wasteWeight: 0.05,
    },
    riskFactors: {
      obsolescenceRisk: 'medium', // model years change
      priceErosion: 'low',
      shelfLifeConcern: 'none',
      perishability: false,
    },
    tips: [
      'Critical repair parts should have safety stock at EVERY branch — expedited transfer cost exceeds holding cost.',
      'Vehicle model year changes create obsolescence risk — flag parts for models being discontinued.',
      'Cross-compatibility: if one part fits multiple models, demand should be aggregated across those models.',
    ],
  },

  appliances: {
    niche: 'Home Appliances',
    description: 'Large and small appliances with moderate lead times, high unit value, and delivery complexity.',
    defaultStrategy: 'balanced_optimization',
    strategies: [
      { id: 'balanced_optimization', name: 'Balanced Optimization', description: 'Balance availability with holding cost. Appliances have decent shelf life but tie up capital.' },
      { id: 'maximize_availability', name: 'Maximize Display Availability', description: 'Showroom presence drives sales. Ensure display models available.' },
    ],
    agentPriorities: {
      stockoutWeight: 0.25,
      overstockWeight: 0.25,
      ageingWeight: 0.15,
      transferCostWeight: 0.30, // large items are expensive to ship
      wasteWeight: 0.05,
    },
    riskFactors: {
      obsolescenceRisk: 'medium',
      priceErosion: 'medium',
      shelfLifeConcern: 'low',
      perishability: false,
    },
    tips: [
      'Large appliances have high transfer costs — only transfer when the economic benefit clearly exceeds freight + handling.',
      'Display models at flagship locations can be replenished from warehouse excess rather than new POs.',
      'Warranty stock should be separate from sellable stock and tracked differently.',
    ],
  },

  mixed: {
    niche: 'Mixed Retail (Multi-Category)',
    description: 'Businesses carrying multiple product categories (e.g., grocery + electronics). Each category needs different treatment.',
    defaultStrategy: 'category_aware_optimization',
    strategies: [
      { id: 'category_aware_optimization', name: 'Category-Aware Optimization', description: 'Apply different logic per category: perishables for freshness, electronics for obsolescence, etc.' },
      { id: 'maximize_availability', name: 'Maximize Overall Availability', description: 'Prioritize having stock across all categories.' },
    ],
    agentPriorities: {
      stockoutWeight: 0.25,
      overstockWeight: 0.20,
      ageingWeight: 0.25, // varies by category
      transferCostWeight: 0.15,
      wasteWeight: 0.15,
    },
    riskFactors: {
      obsolescenceRisk: 'varies_by_category',
      priceErosion: 'varies_by_category',
      shelfLifeConcern: 'varies_by_category',
      perishability: 'varies_by_category',
    },
    tips: [
      'Treat each category independently — don\'t apply grocery logic to electronics or vice versa.',
      'Weather events affect perishables and cold-chain SKUs, not shelf-stable items. Scope disruptions precisely.',
      'In mixed retail, the "transfer trap" is common: a perishable looks like excess but can\'t survive the transfer time.',
    ],
  },
};

// Strategic plan template - what a business uploads/creates
function createStrategicPlan(businessName, niche, strategy, customGoals = {}) {
  const profile = BUSINESS_PROFILES[niche] || BUSINESS_PROFILES.mixed;
  return {
    businessName,
    niche,
    selectedStrategy: strategy || profile.defaultStrategy,
    strategyName: profile.strategies.find(s => s.id === (strategy || profile.defaultStrategy))?.name || 'Balanced Optimization',
    agentPriorities: profile.agentPriorities,
    riskFactors: profile.riskFactors,
    tips: profile.tips,
    customGoals,
    createdAt: new Date().toISOString(),
    // Meeting transcript integration
    meetingTranscripts: [],
    // Marketing strategy
    marketingStrategy: null,
    // Operational constraints (embedded by business)
    operationalConstraints: {
      maxTransferCostPercent: 15, // don't transfer if cost > 15% of stock value
      minTransferROI: 1.2, // transfer benefit must be 1.2x the cost
      respectShelfLife: true,
      requireHumanApproval: true,
    },
  };
}

module.exports = {
  BUSINESS_PROFILES,
  createStrategicPlan,
};
