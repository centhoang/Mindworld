// Geographic Use Policy: we must not serve end users in the Restricted Territories (docs/ops/event.md).
const RESTRICTED_COUNTRIES = new Set([
  "AF", "BY", "KH", "CN", "HK", "MO", "CU", "ER", "ET", "HT", "IR",
  "IQ", "LY", "MM", "NI", "KP", "PK", "RU", "SO", "SY", "VE", "EH",
]);

// Crimea, Sevastopol, Donetsk, Luhansk (ISO 3166-2:UA subdivision codes, as Cloudflare reports them).
const RESTRICTED_UA_REGIONS = new Set(["43", "40", "14", "09"]);

export interface Geo {
  country: string | null;
  regionCode: string | null;
}

export function geoOf(request: Request): Geo {
  const cf = (request as { cf?: { country?: string; regionCode?: string } }).cf;
  const country = (cf?.country ?? request.headers.get("CF-IPCountry") ?? "").toUpperCase();
  return { country: country || null, regionCode: cf?.regionCode ?? null };
}

// Fail closed: Cloudflare reports "XX" (unknown) and "T1" (Tor) when it cannot place a user, and Ukraine
// is only allowed when the subdivision is known and outside the restricted regions. A request with no
// country at all (local `wrangler dev` without cf data) is allowed; in production the country is always set.
const UNPLACEABLE = new Set(["XX", "T1"]);

export function isRestricted({ country, regionCode }: Geo): boolean {
  if (!country) return false;
  if (RESTRICTED_COUNTRIES.has(country) || UNPLACEABLE.has(country)) return true;
  return country === "UA" && (regionCode === null || RESTRICTED_UA_REGIONS.has(regionCode));
}
