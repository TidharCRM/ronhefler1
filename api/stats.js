export default async function handler(req, res) {
  const domain = process.env.PLAUSIBLE_SITE;
  const key = process.env.PLAUSIBLE_API_KEY;
  const valuePerLead = Number(process.env.VALUE_PER_LEAD || 400);

  if (!domain || !key) {
    return res.status(500).json({ error: 'PLAUSIBLE_SITE or PLAUSIBLE_API_KEY env var missing' });
  }

  const headers = { Authorization: `Bearer ${key}` };
  const base = 'https://plausible.io/api/v1/stats';

  try {
    const [agg, ts, sources, leads30, leadsMonth] = await Promise.all([
      fetch(`${base}/aggregate?site_id=${domain}&period=30d&metrics=visitors,pageviews,bounce_rate`, { headers }).then(r => r.json()),
      fetch(`${base}/timeseries?site_id=${domain}&period=30d&metrics=visitors`, { headers }).then(r => r.json()),
      fetch(`${base}/breakdown?site_id=${domain}&period=30d&property=visit:source&limit=5`, { headers }).then(r => r.json()),
      fetch(`${base}/aggregate?site_id=${domain}&period=30d&filters=event:name==Lead&metrics=events`, { headers }).then(r => r.json()),
      fetch(`${base}/aggregate?site_id=${domain}&period=month&filters=event:name==Lead&metrics=events`, { headers }).then(r => r.json()),
    ]);

    const visitors = agg?.results?.visitors?.value ?? 0;
    const leadCount = leads30?.results?.events?.value ?? 0;
    const leadsThisMonth = leadsMonth?.results?.events?.value ?? 0;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.json({
      visitors,
      leads: leadCount,
      conversionRate: visitors ? leadCount / visitors : 0,
      moneySaved: leadCount * valuePerLead,
      moneySavedThisMonth: leadsThisMonth * valuePerLead,
      timeseries: ts?.results ?? [],
      sources: sources?.results ?? [],
    });
  } catch (err) {
    res.status(502).json({ error: 'plausible_fetch_failed', detail: String(err?.message || err) });
  }
}
