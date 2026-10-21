import { useState, useEffect } from 'react';

const CACHE_KEY = 'fx_INR_SGD';
const CACHE_TTL = 6 * 60 * 60 * 1000; // refresh every 6 hours

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw); // { rate, fetchedAt }
  } catch {
    return null;
  }
}

function writeCache(rate) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rate, fetchedAt: Date.now() }));
  } catch {}
}

export function useExchangeRate() {
  const cached = readCache();
  const [rate,      setRate]      = useState(cached?.rate ?? null);
  const [fetchedAt, setFetchedAt] = useState(cached?.fetchedAt ?? null);
  const [offline,   setOffline]   = useState(false);

  useEffect(() => {
    const cached = readCache();
    // Use cached rate if fresh enough
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      setRate(cached.rate);
      setFetchedAt(cached.fetchedAt);
      return;
    }

    // Try primary API, then fallback API
    const tryFetch = (url, extract) =>
      fetch(url).then(r => r.json()).then(extract);

    const primary  = tryFetch(
      'https://open.er-api.com/v6/latest/INR',
      d => d?.rates?.SGD,
    );
    const fallback = tryFetch(
      'https://api.exchangerate-api.com/v4/latest/INR',
      d => d?.rates?.SGD,
    );

    Promise.any([primary, fallback])
      .then(r => {
        if (r && !isNaN(r)) {
          setRate(r);
          setFetchedAt(Date.now());
          writeCache(r);
          setOffline(false);
        } else {
          throw new Error('bad rate');
        }
      })
      .catch(() => {
        // All APIs failed — use stale cache or hardcoded estimate
        const r = cached?.rate ?? 0.01601; // ₹1 ≈ S$0.016
        setRate(r);
        setFetchedAt(cached?.fetchedAt ?? null);
        setOffline(true);
      });
  }, []);

  // inrToSgd(amount) → SGD number or null if no rate
  const inrToSgd = (inrAmount) => {
    if (!rate || !inrAmount) return null;
    return parseFloat((inrAmount * rate).toFixed(2));
  };

  const rateLabel = rate
    ? `₹1 = S$${rate.toFixed(4)}${offline ? (fetchedAt ? ' (cached)' : ' (estimated)') : fetchedAt ? ` · ${ageLabel(fetchedAt)}` : ''}`
    : null;

  return { rate, inrToSgd, rateLabel, offline };
}

function ageLabel(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 2)  return 'just updated';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
