import {Capacitor, CapacitorHttp} from '@capacitor/core';
import {makeClient, normalizeHost, snapshot, validateState} from './model.mjs';
const HOST_KEY = 'pottery.host.v1';
const CACHE_KEY = 'pottery.snapshot.v1';
export const native = Capacitor.isNativePlatform();
export function readHost() { return localStorage.getItem(HOST_KEY) || ''; }
export function readCache(host) { try { const d=JSON.parse(localStorage.getItem(CACHE_KEY)); return d?.host===host && Array.isArray(d.reports) && Array.isArray(d.templates) && typeof d.savedAt==='number' ? d : null; } catch { return null; } }
export function saveHost(host) { localStorage.setItem(HOST_KEY, host); }
export function clearLocal() { localStorage.removeItem(HOST_KEY); localStorage.removeItem(CACHE_KEY); }
export function saveCache(state, host) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot(state, host))); } catch { /* A storage quota failure must not break a live practice. */ } }
async function transport(url, body) {
  if (native) return CapacitorHttp.request({url, method:body ? 'POST' : 'GET', headers:body ? {'Content-Type':'application/json'} : {}, ...(body ? {data:body} : {}), responseType:'json', connectTimeout:5000, readTimeout:10000});
  const res=await fetch(url,{method:body?'POST':'GET', ...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}), signal:AbortSignal.timeout(10000)});
  return {status:res.status,data:await res.json()};
}
export const client = host => makeClient(transport, host);
export async function connect(value) {
  const host=normalizeHost(value,native);
  const state=validateState(await client(host)('/api/state?client=mobile'));
  saveHost(host); saveCache(state,host);
  return {host,state};
}
