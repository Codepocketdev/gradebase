/**
 * utils/profileCache.js
 * Drop this in src/utils/profileCache.js
 * Module-level singleton — survives tab switches and remounts.
 * sessionStorage backup survives page refresh within same session.
 */
const KEY = 'gb_profile_cache_v1'
let _cache = {}
try { const r = sessionStorage.getItem(KEY); if (r) _cache = JSON.parse(r) } catch {}

const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(_cache)) } catch {} }

export const getCachedProfile = (pk) => _cache[pk] || null

export const setCachedProfile = (pk, profile, createdAt = 0) => {
  if (_cache[pk]?._createdAt >= createdAt) return
  _cache[pk] = { ...profile, _createdAt: createdAt }
  save()
}

// Call this right after the user saves their own profile
export const updateCachedProfile = (pk, partial) => {
  _cache[pk] = { ...(_cache[pk] || {}), ...partial, _createdAt: Math.floor(Date.now() / 1000) }
  save()
}

