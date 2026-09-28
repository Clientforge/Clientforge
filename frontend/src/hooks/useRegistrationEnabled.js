import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.PROD ? '/api/v1' : 'http://localhost:3000/api/v1';

let cached = null;
let cachePromise = null;

async function fetchRegistrationEnabled() {
  if (cached !== null) return cached;
  if (!cachePromise) {
    cachePromise = fetch(`${API_BASE}/public/auth-config`)
      .then((r) => (r.ok ? r.json() : { registrationEnabled: false }))
      .then((data) => {
        cached = !!data.registrationEnabled;
        return cached;
      })
      .catch(() => {
        cached = import.meta.env.DEV;
        return cached;
      });
  }
  return cachePromise;
}

export function useRegistrationEnabled() {
  const [enabled, setEnabled] = useState(cached);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    let cancelled = false;
    fetchRegistrationEnabled().then((value) => {
      if (!cancelled) {
        setEnabled(value);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { registrationEnabled: !!enabled, loading };
}
