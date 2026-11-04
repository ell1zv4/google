export const normalize = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function selectItems(items, { section = 'home', query = '', category = 'Todas', favorites = [], recent = [], sort = 'recommended' } = {}) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const selected = items.filter((item) => {
    const inSection = section === 'home' ||
      (section === 'games' && item.kind !== 'link') ||
      (section === 'local' && item.kind === 'local') ||
      (section === 'favorites' && favorites.includes(item.id)) ||
      (section === 'recent' && recent.includes(item.id)) || item.section === section;
    return inSection && (category === 'Todas' || item.category === category) &&
      words.every((word) => normalize(`${item.title} ${item.category} ${item.description || ''}`).includes(word));
  });
  if (sort === 'az') selected.sort((a, b) => a.title.localeCompare(b.title, 'es'));
  else if (section === 'recent') selected.sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
  return selected;
}

export function readPreferences(storage, validIds) {
  try {
    const data = JSON.parse(storage.getItem('risb.preferences') || '{}');
    const ids = (value) => Array.isArray(value) ? [...new Set(value.filter((id) => validIds.has(id)))] : [];
    const scores = Object.fromEntries(Object.entries(data?.scores || {}).filter(([id, score]) => validIds.has(id) && typeof score === 'number' && Number.isFinite(score) && score >= 0));
    return { favorites: ids(data?.favorites), recent: ids(data?.recent).slice(0, 30), scores };
  } catch {
    return { favorites: [], recent: [], scores: {} };
  }
}

export function remember(recent, id) {
  return [id, ...recent.filter((value) => value !== id)].slice(0, 30);
}

export function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
