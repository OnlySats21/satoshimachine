export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { item, year } = req.body || {};
  if (!item || !year) return res.status(400).json({ error: 'missing params' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'no key' });

  const prompt = `What was the typical price in US dollars for "${item}" in ${year} in the United States? If a city is mentioned use that city's data. Give the real average market price. Respond ONLY with valid JSON: {"price": 1234.56, "description": "specific description", "source": "what this represents", "location": "city or National Average"}`;

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

    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: `anthropic ${r.status}: ${t}` });
    }

    const d = await r.json();
    const txt = d.content.map(c => c.text || '').join('');
    const m = txt.match(/\{[\s\S]*?\}/);
    if (!m) return res.status(500).json({ error: 'no json in response' });
    const parsed = JSON.parse(m[0]);
    if (!parsed.price || parsed.price <= 0) return res.status(500).json({ error: 'bad price' });
    return res.status(200).json(parsed);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
