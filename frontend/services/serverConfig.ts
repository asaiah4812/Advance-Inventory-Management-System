import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getExpoGoProjectConfig, isRunningInExpoGo } from 'expo';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

const DISCOVERY_CACHE_KEY = '@api_base_url_discovered';
const API_PORT = (process.env.EXPO_PUBLIC_API_PORT || '8000').replace(/[^\d]/g, '') || '8000';
const PROBE_PATH = '/api/categories/';

const PROBE_TIMEOUT_PRIORITY_MS = 1200;
const PROBE_TIMEOUT_SCAN_MS = 1800;
const SCAN_BATCH_SIZE = 30;

let lastDiscoverySource = 'unknown';
let discoveryInFlight: Promise<string> | null = null;

function hostFromDebuggerString(value: string): string | null {
  const host = value.split(':')[0]?.trim();
  return host || null;
}

/** Private LAN or emulator — use http:// */
export function isLocalHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '10.0.2.2') return true;
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
}

export function getDevMachineHost(): string | null {
  const debuggerHost =
    getExpoGoProjectConfig()?.debuggerHost ??
    Constants.expoGoConfig?.debuggerHost ??
    (Constants.manifest2 as { extra?: { expoGo?: { debuggerHost?: string } } } | null)?.extra?.expoGo
      ?.debuggerHost;

  if (debuggerHost) {
    const host = hostFromDebuggerString(debuggerHost);
    if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostFromDebuggerString(hostUri);
    if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  }

  const experienceUrl = Constants.experienceUrl ?? Constants.linkingUri;
  if (experienceUrl) {
    try {
      const { hostname } = new URL(experienceUrl);
      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') return hostname;
    } catch {
      // ignore
    }
  }

  if (__DEV__ && Platform.OS === 'android') return '10.0.2.2';

  return null;
}

export function buildApiUrl(host: string, forceHttps = false): string {
  const clean = host.replace(/^https?:\/\//i, '').split('/')[0];
  const hostname = clean.split(':')[0];
  const protocol = forceHttps || !isLocalHost(hostname) ? 'https' : 'http';
  if (clean.includes(':')) {
    return `${protocol}://${clean}`;
  }
  return `${protocol}://${clean}:${API_PORT}`;
}

/**
 * Normalize server URL — preserves https for hosted domains, http for LAN IPs.
 */
export function normalizeApiUrl(url: string): string {
  let value = url.trim();
  if (!value) return `http://localhost:${API_PORT}`;

  let explicitProtocol: 'http' | 'https' | null = null;
  if (/^https:\/\//i.test(value)) {
    explicitProtocol = 'https';
    value = value.replace(/^https:\/\//i, '');
  } else if (/^http:\/\//i.test(value)) {
    explicitProtocol = 'http';
    value = value.replace(/^http:\/\//i, '');
  }

  value = value.replace(/\/+$/, '');
  const hostOnly = value.split('/')[0];
  const hostname = hostOnly.split(':')[0];

  let protocol: 'http' | 'https';
  if (explicitProtocol) {
    protocol = explicitProtocol;
  } else if (isLocalHost(hostname)) {
    protocol = 'http';
  } else {
    protocol = 'https';
  }

  if (!hostOnly.includes(':') && isLocalHost(hostname)) {
    return `${protocol}://${hostname}:${API_PORT}`;
  }

  return `${protocol}://${hostOnly}`;
}

/** Parse QR payload from dashboard (JSON or plain URL). */
export function parseServerQrPayload(raw: string): { url: string; mode: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed) as { url?: string; mode?: string };
      if (obj.url) {
        return {
          url: normalizeApiUrl(obj.url),
          mode: obj.mode === 'online' ? 'online' : 'local',
        };
      }
    } catch {
      // fall through
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const url = normalizeApiUrl(trimmed);
    try {
      const { hostname } = new URL(url);
      return { url, mode: isLocalHost(hostname) ? 'local' : 'online' };
    } catch {
      return { url, mode: 'local' };
    }
  }

  if (/^[\d.]+(:\d+)?$/.test(trimmed)) {
    return { url: normalizeApiUrl(trimmed), mode: 'local' };
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}(:\d+)?$/i.test(trimmed)) {
    return { url: normalizeApiUrl(`https://${trimmed}`), mode: 'online' };
  }

  return null;
}

async function probeApi(baseUrl: string, timeoutMs: number): Promise<boolean> {
  const url = `${normalizeApiUrl(baseUrl)}${PROBE_PATH}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function getSubnetPrefix(): Promise<string | null> {
  try {
    const ip = await Network.getIpAddressAsync();
    if (!ip || ip === '0.0.0.0' || ip.startsWith('127.')) return null;
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  } catch {
    return null;
  }
}

export async function discoverBackendOnLan(): Promise<string | null> {
  const prefix = await getSubnetPrefix();
  if (!prefix) return null;

  const phoneIp = await Network.getIpAddressAsync().catch(() => null);
  const phoneLast = phoneIp ? parseInt(phoneIp.split('.').pop() ?? '', 10) : NaN;

  const priority = new Set<number>([1, 2, 10, 100, 101, 111, 200, 254]);
  if (!Number.isNaN(phoneLast)) {
    for (let d = -10; d <= 10; d++) {
      const candidate = phoneLast + d;
      if (candidate >= 1 && candidate <= 254 && candidate !== phoneLast) {
        priority.add(candidate);
      }
    }
  }

  const allHosts = Array.from({ length: 254 }, (_, i) => i + 1);
  const tryHost = async (lastOctet: number, timeoutMs: number): Promise<string | null> => {
    const url = buildApiUrl(`${prefix}.${lastOctet}`);
    return (await probeApi(url, timeoutMs)) ? url : null;
  };

  const priorityList = [...priority].filter((n) => n >= 1 && n <= 254);
  const priorityResults = await Promise.all(
    priorityList.map((n) => tryHost(n, PROBE_TIMEOUT_PRIORITY_MS))
  );
  const priorityHit = priorityResults.find((u) => u != null);
  if (priorityHit) {
    lastDiscoverySource = 'found on your Wi-Fi network (fast scan)';
    await AsyncStorage.setItem(DISCOVERY_CACHE_KEY, priorityHit);
    return priorityHit;
  }

  const remaining = allHosts.filter((n) => !priority.has(n));
  for (let i = 0; i < remaining.length; i += SCAN_BATCH_SIZE) {
    const batch = remaining.slice(i, i + SCAN_BATCH_SIZE);
    const results = await Promise.all(batch.map((n) => tryHost(n, PROBE_TIMEOUT_SCAN_MS)));
    const found = results.find((u) => u != null);
    if (found) {
      lastDiscoverySource = 'found on your Wi-Fi network (full scan)';
      await AsyncStorage.setItem(DISCOVERY_CACHE_KEY, found);
      return found;
    }
  }

  return null;
}

async function resolveApiUrlInternal(): Promise<string> {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    lastDiscoverySource = 'from build config (EXPO_PUBLIC_API_URL)';
    return normalizeApiUrl(envUrl);
  }

  if (isRunningInExpoGo()) {
    const host = getDevMachineHost();
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      lastDiscoverySource = 'from Expo dev server (same Wi-Fi as Metro)';
      return buildApiUrl(host);
    }
  }

  const cached = await AsyncStorage.getItem(DISCOVERY_CACHE_KEY);
  const cachedNorm = cached ? normalizeApiUrl(cached) : null;
  if (cachedNorm && (await probeApi(cachedNorm, PROBE_TIMEOUT_PRIORITY_MS))) {
    await AsyncStorage.setItem(DISCOVERY_CACHE_KEY, cachedNorm);
    lastDiscoverySource =
      cachedNorm.startsWith('https://') ? 'cached online server' : 'cached server on your Wi-Fi';
    return cachedNorm;
  }

  const discovered = await discoverBackendOnLan();
  if (discovered) return discovered;

  if (cachedNorm) {
    lastDiscoverySource = cachedNorm.startsWith('https://')
      ? 'cached online server (unreachable — check internet)'
      : 'cached server (unreachable — check Wi-Fi and Django)';
    return cachedNorm;
  }

  if (__DEV__ && Platform.OS === 'android') {
    lastDiscoverySource = 'Android emulator → host machine';
    return buildApiUrl('10.0.2.2');
  }

  lastDiscoverySource = 'server not found — scan QR from dashboard or enter URL';
  return `http://localhost:${API_PORT}`;
}

export async function getApiBaseUrl(): Promise<string> {
  if (!discoveryInFlight) {
    discoveryInFlight = resolveApiUrlInternal().finally(() => {
      discoveryInFlight = null;
    });
  }
  return discoveryInFlight;
}

export function isApiDiscoveryInProgress(): boolean {
  return discoveryInFlight != null;
}

export function describeApiSource(): string {
  return lastDiscoverySource;
}

export async function refreshApiBaseUrl(): Promise<string> {
  await AsyncStorage.removeItem(DISCOVERY_CACHE_KEY);
  discoveryInFlight = null;
  return getApiBaseUrl();
}

export async function setApiBaseUrl(url: string, source = 'saved manually'): Promise<string> {
  const normalized = normalizeApiUrl(url);
  discoveryInFlight = null;
  await AsyncStorage.setItem(DISCOVERY_CACHE_KEY, normalized);
  lastDiscoverySource = source;
  discoveryInFlight = Promise.resolve(normalized).finally(() => {
    discoveryInFlight = null;
  });
  return normalized;
}

export async function applyServerFromQr(raw: string): Promise<{ url: string; mode: string; ok: boolean; message: string }> {
  const parsed = parseServerQrPayload(raw);
  if (!parsed) {
    return { url: '', mode: 'unknown', ok: false, message: 'Invalid QR code — scan the code from the web dashboard.' };
  }
  const saved = await setApiBaseUrl(
    parsed.url,
    parsed.mode === 'online' ? 'from dashboard QR (online · HTTPS)' : 'from dashboard QR (local · HTTP)'
  );
  const reachable = await probeApi(saved, 8000);
  return {
    url: saved,
    mode: parsed.mode,
    ok: reachable,
    message: reachable
      ? `Connected to ${saved}`
      : `Saved ${saved} but server did not respond yet. Check Django is running and the URL is correct.`,
  };
}

export async function clearApiBaseUrl(): Promise<void> {
  await AsyncStorage.removeItem(DISCOVERY_CACHE_KEY);
  discoveryInFlight = null;
}
