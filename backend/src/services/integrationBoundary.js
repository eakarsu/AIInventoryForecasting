const NAMES = ['ERP', 'WMS', 'POS', 'ECOMMERCE', 'PROCUREMENT', 'PROMOTIONS', 'WEATHER_EVENTS', 'PLANNING'];

export function integrationReadiness(env = process.env) {
  const integrations = NAMES.map((name) => {
    const enabled = env[`${name}_ENABLED`] === 'true';
    const endpoint = Boolean(env[`${name}_URL`]);
    const credential = Boolean(env[`${name}_TOKEN`]);
    return { name: name.toLowerCase(), ready: enabled && endpoint && credential, enabled };
  });
  return { ready: integrations.every((entry) => entry.ready), integrations };
}

export function requireIntegration(name, env = process.env) {
  const entry = integrationReadiness(env).integrations.find((candidate) => candidate.name === String(name).toLowerCase());
  if (!entry?.ready) throw Object.assign(new Error(`${name} integration is not ready`), { code: 'INTEGRATION_NOT_READY' });
  return entry;
}

export { NAMES as INTEGRATION_NAMES };
