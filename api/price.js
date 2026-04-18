export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Debug: log what we received
  const body = req.body || {};
  const { item, year } = body;
  
  const key = process.env.ANTHROPIC_API_KEY;
  
  // Return debug info so we can see what's happening
  if (!key) return res.status(500).json({ 
    error: 'No API key found', 
    env_keys: Object.keys(process.env).filter(k => k.includes('ANTHROPIC'))
  });
  
  if (!item || !year) return res.status(400).json({ 
    error: 'Missing params', 
    received: { item, year, body: JSON.stringify(body) }
  });

  const prompt = `What was the typical price in US dollars for "${item}" in ${year} in the United States? Respond ONLY with valid JSON: {"price": 1234.56, "description": "description", "source": "source", "location": "city or National Average"}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const text = await r.text();
    
    if (!r.ok) return res.status(500).json({ 
      error: `Anthropic ${r.status}`, 
      details: text.substring(0, 500)
    });

    const d = JSON.parse(text);
    const txt = d.content.map(c => c.text || '').join('');
    const m = txt.match(/\{[\s\S]*?\}/);
    if (!m) return res.status(500).json({ error: 'No JSON', raw: txt });
    
    return res.status(200).json(JSON.parse(m[0]));

  } catch(e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.substring(0, 300) });
  }
}
