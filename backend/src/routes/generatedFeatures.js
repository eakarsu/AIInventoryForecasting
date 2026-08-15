import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

export const FEATURES = Object.freeze({
  "cf-agentic-inventory-manager-autonomously-p": "Agentic Inventory Manager Autonomously P",
  "cf-demand-supply-fusion-integrating-custome": "Demand Supply Fusion Integrating Custome",
  "cf-markdown-clearance-optimizer-balancing-d": "Markdown Clearance Optimizer Balancing D",
  "cf-multi-warehouse-network-optimization-rec": "Multi Warehouse Network Optimization Rec",
  "cf-seasonal-promotional-planning-coordinate": "Seasonal Promotional Planning Coordinate",
  "cf-supplier-performance-reliability-trackin": "Supplier Performance Reliability Trackin",
  "gap-live-erp-sap-netsuite-integrations-still": "Live Erp Sap Netsuite Integrations Still",
  "gap-no-file-upload-for-supplier-docs": "No File Upload For Supplier Docs",
  "gap-no-financial-pl-module": "No Financial Pl Module",
  "gap-no-markdown-timing-ai": "No Markdown Timing Ai",
  "gap-no-multi-warehouse-balancing-ai": "No Multi Warehouse Balancing Ai",
  "gap-no-notifications-module-0-references": "No Notifications Module 0 References",
  "gap-no-real-time-websocket-inventory-updates": "No Real Time Websocket Inventory Updates",
  "gap-no-sku-rationalization-which-skus-to": "No Sku Rationalization Which Skus To",
  "gap-no-supplier-disruption-simulator": "No Supplier Disruption Simulator",
  "gap-no-webhook-surface": "No Webhook Surface",
});

const SYSTEM_PROMPT = `You are a senior domain analyst providing decision support. Return only valid JSON:
{
  "summary": "concise executive finding",
  "confidence": 0,
  "key_findings": [{"finding":"string","evidence":"string","severity":"low|medium|high|critical"}],
  "risks": [{"risk":"string","mitigation":"string"}],
  "prioritized_actions": [{"priority":1,"action":"string","owner":"string","deadline":"string"}],
  "assumptions": ["string"],
  "missing_information": ["string"],
  "follow_up_questions": ["string"]
}
Use only facts supplied by the user. Clearly label assumptions and missing evidence. Do not claim an external integration, notification, approval, transaction, diagnosis, or operational action was executed. A qualified human remains responsible for consequential decisions.`;

function parseContent(content) {
  if (typeof content !== 'string') return content;
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch { return content; }
}

for (const [endpoint, title] of Object.entries(FEATURES)) {
  router.post(`/${endpoint}`, authenticateToken, async (req, res) => {
    const input = typeof req.body?.input === 'string' ? req.body.input.trim() : '';
    if (input.length < 10) return res.status(400).json({ error: 'ValidationError', message: 'Input must contain at least 10 characters.' });
    if (!process.env.OPENROUTER_API_KEY) return res.status(503).json({ error: 'AIServiceNotConfigured', message: 'OPENROUTER_API_KEY is required for AI analysis.' });

    const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
    const baseUrl = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    try {
      const providerResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': process.env.APP_URL || 'http://localhost', 'X-Title': process.env.APP_NAME || 'AI Operations Suite' },
        body: JSON.stringify({ model, temperature: 0.2, max_tokens: 1200, messages: [{ role: 'system', content: `${SYSTEM_PROMPT}\n\nFeature: ${title}` }, { role: 'user', content: input.slice(0, 12000) }] }),
        signal: AbortSignal.timeout(45000),
      });
      const provider = await providerResponse.json();
      const content = provider?.choices?.[0]?.message?.content;
      if (!providerResponse.ok || provider?.error || typeof content !== 'string' || !content.trim()) throw new Error(provider?.error?.message || `OpenRouter HTTP ${providerResponse.status}`);
      return res.json({ feature: endpoint.replace(/\/run$/, ''), title, result: parseContent(content), model: provider.model || model, usage: provider.usage || null, disclaimer: 'Decision support only. Verify source evidence and obtain qualified human approval before consequential action.' });
    } catch (error) {
      console.error(`[generated-ai:${endpoint}]`, error.message);
      return res.status(502).json({ error: 'AIServiceError', message: 'The AI provider could not complete this analysis. Please retry or escalate for manual review.' });
    }
  });
}

export default router;

