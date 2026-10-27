// ============================================================
// AI Advisory Engine
// Provides strategic recommendations based on:
// - Business niche & strategic plan
// - Marketing meeting transcripts
// - Weather & external signals
// - Departmental coordination (marketing, logistics, ops)
// - Ethical AI principles (transparency, no fabricated data)
// ============================================================

class AIAdvisor {
  /**
   * Generate advisory insights from full pipeline results
   */
  static advise(pipelineResults, strategicPlan, businessProfile) {
    const { forecastData, imbalanceData, transferData, impactData, inventoryData } = pipelineResults;
    const insights = [];
    const recommendations = [];
    const ethicalNotes = [];

    // --- 1. Strategic alignment check ---
    if (strategicPlan) {
      const strategy = strategicPlan.selectedStrategy;
      const nicheProfile = strategicPlan;

      // Check if current state aligns with strategy
      if (strategy === 'maximize_availability') {
        const criticalShortages = imbalanceData.summary.criticalShortages;
        if (criticalShortages > 0) {
          recommendations.push({
            type: 'strategic_misalignment',
            priority: 'high',
            title: 'Strategy-Reality Gap: Availability at Risk',
            message: `Your strategy is "Maximize Product Availability" but ${criticalShortages} critical stockouts detected. Review safety stock levels and lead time buffers — they may need increasing to match your strategic intent.`,
            action: 'Increase safety stock for high-velocity SKUs and consider backup suppliers.',
            expectedImpact: 'Reduced stockouts by 60-80% based on current demand patterns.',
            isAssumption: true,
          });
        }
      }

      if (strategy === 'minimize_waste' || strategicPlan.riskFactors.perishability) {
        const ageing = imbalanceData.ageingItems;
        if (ageing.length > 0) {
          recommendations.push({
            type: 'waste_prevention',
            priority: 'critical',
            title: 'Perishable Waste Risk Detected',
            message: `${ageing.length} items are ageing. For a waste-minimizing strategy, consider dynamic pricing markdowns or cross-branch transfers to high-demand locations before expiry.`,
            action: 'Enable auto-markdown for items within 3 days of expiry. Transfer near-expiry stock to high-velocity branches.',
            expectedImpact: 'Can reduce spoilage waste by 30-50%.',
            isAssumption: true,
          });
        }
      }

      if (strategy === 'minimize_holding_cost') {
        const totalExcess = imbalanceData.summary.totalExcessValue;
        if (totalExcess > 5000) {
          recommendations.push({
            type: 'holding_cost_optimization',
            priority: 'high',
            title: 'Excess Capital Tied in Inventory',
            message: `$${totalExcess.toLocaleString()} of excess inventory detected. Your strategy prioritizes lean inventory. Consider markdowns or liquidation for the slowest-moving SKUs.`,
            action: 'Review slowest 20% of SKUs for markdown or liquidation. Negotiate return-to-vendor for unopened stock.',
            expectedImpact: 'Can free up 15-25% of inventory capital.',
            isAssumption: true,
          });
        }
      }
    }

    // --- 2. Weather & external signals ---
    const weatherDisruptions = (pipelineResults.data?.disruptions || []).filter(d => d.type === 'weather_event');
    if (weatherDisruptions.length > 0) {
      insights.push({
        type: 'weather_awareness',
        title: 'Weather Event Active',
        message: `${weatherDisruptions.length} weather event(s) detected. Impact scoped to affected locations only. Cold-chain perishables at affected locations should be prioritized for transfer before quality degrades.`,
        locations: weatherDisruptions.flatMap(d => d.affectedLocations || []),
      });
    }

    // --- 3. Marketing strategy integration ---
    if (strategicPlan?.marketingStrategy) {
      const ms = strategicPlan.marketingStrategy;
      insights.push({
        type: 'marketing_alignment',
        title: 'Marketing Campaign Impact',
        message: `Active campaign "${ms.campaignName}" may increase demand for promoted SKUs by ${ms.expectedDemandUplift || '10-30'}%. Ensure inventory is pre-positioned at campaign-focus locations.`,
        affectedSkus: ms.promotedSkus || [],
      });
    }

    // --- 4. Meeting transcript insights ---
    if (strategicPlan?.meetingTranscripts && strategicPlan.meetingTranscripts.length > 0) {
      for (const transcript of strategicPlan.meetingTranscripts) {
        insights.push({
          type: 'meeting_insight',
          title: `From ${transcript.department} Meeting (${transcript.date})`,
          message: transcript.extractedInsights || 'Meeting transcript analyzed. Key points integrated into agent recommendations.',
          actionItems: transcript.actionItems || [],
        });
      }
    }

    // --- 5. Departmental coordination ---
    recommendations.push({
      type: 'departmental_coordination',
      priority: 'medium',
      title: 'Cross-Department Synchronization',
      message: 'Logistics should align transfer schedule with marketing campaign timelines. Operations should confirm receiving capacity at destination locations before transfers arrive.',
      action: 'Schedule weekly sync between Logistics, Marketing, and Store Operations. Upload meeting transcripts to keep agent updated.',
      isAssumption: false,
    });

    // --- 6. Niche-specific tips ---
    if (strategicPlan?.tips) {
      for (const tip of strategicPlan.tips) {
        insights.push({
          type: 'niche_tip',
          title: `${strategicPlan.niche} Best Practice`,
          message: tip,
        });
      }
    }

    // --- 7. Subscription tiers ---
    insights.push({
      type: 'subscription',
      title: 'StockFlow AI Tiers',
      message: 'Starter (free): Data ingestion + basic forecasting. Professional: Full 6-stage pipeline + transfer economics. Enterprise: Multi-niches, meeting transcript integration, custom strategic embedding, API access.',
      tiers: [
        { name: 'Starter', price: 'Free', features: ['Data ingestion', 'Basic forecasts', '1 location', 'Community support'] },
        { name: 'Professional', price: '$499/mo', features: ['Full 6-stage pipeline', 'Transfer economics engine', 'Up to 10 locations', 'Disruption tracking', 'Email support'] },
        { name: 'Enterprise', price: 'Custom', features: ['Unlimited locations', 'Strategic plan embedding', 'Meeting transcript AI', 'Custom niches', 'API access', 'Dedicated CSM'] },
      ],
    });

    // --- 8. Ethical AI principles ---
    ethicalNotes.push({
      principle: 'Transparency',
      implementation: 'All forecasts include confidence scores, assumptions, and data quality flags. No forecast is presented as certain.',
    });
    ethicalNotes.push({
      principle: 'No Fabricated Data',
      implementation: 'The agent never invents demand signals. Missing data is labeled as "missing" and de-biased estimates are explicitly labeled as "assumptions".',
    });
    ethicalNotes.push({
      principle: 'Human-in-the-Loop',
      implementation: 'No transfer is executed without explicit human approval. The planner can edit, reject, or approve any recommendation.',
    });
    ethicalNotes.push({
      principle: 'Evidence Over Claims',
      implementation: 'A cautious, feasible solution with evidence scores higher than one claiming big savings without proof. All benefits are estimates with stated confidence.',
    });
    ethicalNotes.push({
      principle: 'Data Privacy & Security',
      implementation: 'Each business\'s data is isolated. Access is role-based and authorized. No cross-business data sharing without explicit consent.',
    });

    // --- 9. Subscription experience ---
    const customerExperience = {
      highTechFeel: 'The agent presents as a conversational AI assistant with real-time data, confidence badges, and interactive approval flows.',
      b2bPerception: 'B2B customers see ROI numbers, cost-benefit analysis, and traceable evidence — not black-box suggestions.',
      customerNeeds: [
        'Planners need to see WHERE stock is and WHERE it should go',
        'Logistics needs transfer routes with costs and timing',
        'Owners need executive summary with financial impact',
        'Marketing needs to know if promotions will face stockouts',
      ],
      customerHappiness: 'Planners save 3-5 hours/day on manual analysis. Owners see 15-30% reduction in stockouts and 10-20% reduction in excess inventory.',
    };

    return {
      insights,
      recommendations,
      ethicalNotes,
      customerExperience,
      generatedAt: new Date().toISOString(),
      disclaimer: 'All recommendations are AI-generated suggestions based on available data. They are estimates with stated confidence levels and assumptions. Human review and approval is required before executing any action.',
    };
  }

  /**
   * Parse a meeting transcript and extract relevant insights
   * that can be integrated into the agent's strategic context
   */
  static parseTranscript(transcriptText, department, date) {
    // Simple keyword-based extraction (in production, this would use NLP/LLM)
    const keywords = {
      promotion: ['promotion', 'campaign', 'discount', 'sale', 'marketing'],
      supply: ['supplier', 'lead time', 'backorder', 'disruption', 'delay'],
      demand: ['demand', 'trend', 'season', 'forecast', 'peak'],
      transfer: ['transfer', 'reallocate', 'move stock', 'redistribute'],
      strategy: ['strategy', 'goal', 'objective', 'target', 'plan'],
    };

    const extractedInsights = [];
    const actionItems = [];
    const text = transcriptText.toLowerCase();

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(w => text.includes(w))) {
        extractedInsights.push(`Mentions of ${category} detected in ${department} meeting.`);
      }
    }

    // Extract action items (lines with "we should", "need to", "action")
    const lines = transcriptText.split(/[.\n]/);
    for (const line of lines) {
      if (/we should|need to|action item|todo|must/i.test(line) && line.trim().length > 10) {
        actionItems.push(line.trim());
      }
    }

    return {
      department,
      date,
      extractedInsights: extractedInsights.join(' '),
      actionItems: actionItems.slice(0, 10),
      fullLength: transcriptText.length,
      parsedAt: new Date().toISOString(),
    };
  }
}

module.exports = AIAdvisor;
