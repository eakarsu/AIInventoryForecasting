const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function generateAIResponse(prompt, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const defaultModel = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

  // If no API key, return mock response
  if (!apiKey || apiKey === 'your-openrouter-key') {
    console.log('OpenRouter API key not configured, returning mock response');
    return generateMockResponse(prompt);
  }

  try {
    console.log(`Calling OpenRouter API with model: ${options.model || defaultModel}`);
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'AI Inventory Forecasting'
      },
      body: JSON.stringify({
        model: options.model || defaultModel,
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant specialized in inventory management, demand forecasting, and supply chain optimization. Always respond with valid JSON when requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter API error:', error);
      return generateMockResponse(prompt);
    }

    const data = await response.json();
    let content = data.choices[0]?.message?.content;

    if (!content) {
      console.log('No content in AI response');
      return generateMockResponse(prompt);
    }

    console.log('Raw AI response length:', content.length);
    console.log('Content preview:', content.substring(0, 200));

    // Extract JSON from markdown code blocks if present (handle missing closing backticks)
    let jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      console.log('Found markdown code block with closing backticks');
      content = jsonMatch[1].trim();
    } else if (content.includes('```json')) {
      // Handle case where closing ``` is missing
      console.log('Found opening ```json, extracting content...');
      content = content.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();
    } else if (content.includes('```')) {
      console.log('Found generic code block, extracting...');
      content = content.replace(/```\s*/g, '').trim();
    }

    // Try to parse as JSON
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(content);
        console.log('Successfully parsed JSON response');
        return parsed;
      } catch (e) {
        console.error('Failed to parse JSON:', e.message);
        console.error('Content start:', content.substring(0, 200));
        // Try to fix common issues - truncated JSON
        if (!content.trim().endsWith('}') && !content.trim().endsWith(']')) {
          console.log('JSON appears truncated, attempting to fix...');
          // Count braces to determine what's missing
          const openBraces = (content.match(/{/g) || []).length;
          const closeBraces = (content.match(/}/g) || []).length;
          const openBrackets = (content.match(/\[/g) || []).length;
          const closeBrackets = (content.match(/]/g) || []).length;

          let fixed = content;
          for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']';
          for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';

          try {
            const parsed = JSON.parse(fixed);
            console.log('Successfully parsed fixed JSON');
            return parsed;
          } catch (e2) {
            console.error('Still failed after fix attempt');
          }
        }
        return content;
      }
    }

    console.log('Returning raw content (not JSON)');
    return content;
  } catch (error) {
    console.error('OpenRouter API call failed:', error);
    return generateMockResponse(prompt);
  }
}

function generateMockResponse(prompt) {
  // Generate realistic mock responses based on the prompt type
  if (prompt.includes('demand forecast')) {
    return {
      predicted_demand: Math.floor(Math.random() * 100) + 50,
      confidence_level: Math.floor(Math.random() * 15) + 85,
      trend_direction: ['upward', 'stable', 'downward'][Math.floor(Math.random() * 3)],
      seasonality_factor: (Math.random() * 0.5 + 0.8).toFixed(2),
      reasoning: 'Based on historical patterns and current market conditions, demand is expected to remain consistent with seasonal adjustments.',
      recommended_action: 'Maintain current inventory levels with a slight increase to account for seasonal variation.'
    };
  }

  if (prompt.includes('restock')) {
    return [
      {
        product_sku: 'SKU-001',
        recommended_quantity: 100,
        priority: 'high',
        reasoning: 'Stock levels critically low, high sales velocity',
        estimated_days_until_stockout: 5
      },
      {
        product_sku: 'SKU-003',
        recommended_quantity: 75,
        priority: 'medium',
        reasoning: 'Approaching reorder point with moderate demand',
        estimated_days_until_stockout: 12
      }
    ];
  }

  if (prompt.includes('price optimization') || prompt.includes('pricing')) {
    return {
      optimizations: [
        {
          product_sku: 'SKU-002',
          current_price: 19.99,
          suggested_price: 21.99,
          change_percentage: 10,
          reasoning: 'Strong demand allows for price increase without affecting volume',
          expected_impact: 'Estimated 8% revenue increase'
        }
      ]
    };
  }

  if (prompt.includes('anomaly') || prompt.includes('anomalies')) {
    return {
      anomalies: [
        {
          product_sku: 'SKU-013',
          forecast_date: new Date().toISOString().split('T')[0],
          predicted: 72,
          actual: 105,
          deviation_percentage: 45.8,
          severity: 'high',
          possible_cause: 'Unexpected promotional activity or market trend',
          recommended_action: 'Increase safety stock and review forecast model'
        }
      ],
      summary: 'One significant anomaly detected. Smart LED Bulbs showing higher than expected demand.'
    };
  }

  if (prompt.includes('supplier') && prompt.includes('score')) {
    return {
      scores: [
        {
          supplier_name: 'FastShip Electronics',
          overall_score: 96,
          reliability_grade: 'A',
          strengths: ['Fastest delivery times', 'Highest on-time rate'],
          weaknesses: ['Premium pricing'],
          recommendation: 'keep'
        },
        {
          supplier_name: 'TechParts Global',
          overall_score: 92,
          reliability_grade: 'A',
          strengths: ['Large product range', 'Consistent quality'],
          weaknesses: ['Occasional delays during peak season'],
          recommendation: 'keep'
        }
      ],
      top_performer: 'FastShip Electronics',
      needs_review: ['Mountain Materials']
    };
  }

  if (prompt.includes('trend')) {
    return {
      trends: [
        {
          category: 'Smart Home',
          direction: 'growing',
          change_rate: '24% month-over-month',
          insight: 'Smart home products continue strong growth driven by home automation adoption'
        },
        {
          category: 'Electronics',
          direction: 'stable',
          change_rate: '3% month-over-month',
          insight: 'Core electronics maintain steady demand'
        }
      ],
      opportunities: [
        'Expand smart home product line',
        'Bundle complementary accessories'
      ],
      risks: [
        'Supply chain constraints for popular items',
        'Seasonal demand fluctuations'
      ],
      recommendations: [
        'Increase smart home inventory by 20%',
        'Negotiate volume discounts with top suppliers'
      ]
    };
  }

  // Default response
  return {
    message: 'Analysis complete',
    status: 'success',
    note: 'This is a mock response. Configure OPENROUTER_API_KEY for real AI responses.'
  };
}

export default { generateAIResponse };
