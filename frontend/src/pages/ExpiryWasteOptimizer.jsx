import React, { useEffect, useState } from 'react';

export default function ExpiryWasteOptimizer() {
  const [data, setData] = useState(null);
  useEffect(() => { fetch('/api/expiry-waste-optimizer').then(r => r.json()).then(setData).catch(() => {}); }, []);
  return <div><h1>Expiry Waste Optimizer</h1><p>Recommends markdowns and bundles for perishable inventory before spoilage.</p>{data?.skus?.map(s => <section className="card" key={s.sku}><h2>{s.sku}</h2><p>{s.action} - excess {s.excess_units}</p></section>)}</div>;
}
