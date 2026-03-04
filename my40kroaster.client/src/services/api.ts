import type { Faction, Unit, UnitCostBand } from '../types';

const API_BASE = '/api';
const WH40K_API = '/api/bsdata';

// Auth
export async function loginWithGoogle(idToken: string) {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error('Login failed');
  return res.json() as Promise<{ token: string; user: { id: string; email: string; name: string; picture?: string } }>;
}

// Rosters
export async function getRosters(token: string) {
  const res = await fetch(`${API_BASE}/rosters`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch rosters');
  return res.json();
}

export async function createRoster(token: string, data: { name: string; factionId: string; factionName: string; pointsLimit: number; allowLegends?: boolean }) {
  const res = await fetch(`${API_BASE}/rosters`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create roster');
  return res.json();
}

export async function updateRoster(token: string, id: string, data: { name: string; pointsLimit: number; allowLegends: boolean }) {
  const res = await fetch(`${API_BASE}/rosters/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update roster');
  return res.json();
}

export async function deleteRoster(token: string, id: string) {
  const res = await fetch(`${API_BASE}/rosters/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete roster');
}

export async function getRosterUnits(token: string, rosterId: string) {
  const res = await fetch(`${API_BASE}/rosters/${rosterId}/units`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch roster units');
  return res.json();
}

export async function updateRosterUnits(token: string, rosterId: string, units: unknown) {
  const res = await fetch(`${API_BASE}/rosters/${rosterId}/units`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(units),
  });
  if (!res.ok) throw new Error('Failed to update roster units');
}

// External API
export async function getFactions(): Promise<Faction[]> {
  try {
    const res = await fetch(`${WH40K_API}/fractions`);
    if (!res.ok) throw new Error('Failed to fetch factions');
    const data = await res.json();
    // The API returns fractions which represent factions
    const items: ApiCatalogueItem[] = Array.isArray(data.fractions)
      ? data.fractions
      : Array.isArray(data.catalogues)
      ? data.catalogues
      : Array.isArray(data)
      ? (data as ApiCatalogueItem[])
      : [];
    if (items.length === 0) return DEFAULT_FACTIONS;
    return items.map((item) => ({
      id: item.id ?? item.gameSystemId ?? item.name ?? '',
      name: item.name ?? item.gameSystemName ?? '',
      parentId: item.parentId,
    }));
  } catch (err) {
    console.error('Failed to fetch factions from API, using defaults:', err);
    return DEFAULT_FACTIONS;
  }
}

interface ApiCatalogueItem {
  id?: string;
  gameSystemId?: string;
  name?: string;
  gameSystemName?: string;
  parentId?: string;
}

interface ApiInfoLink {
  id?: string;
  name?: string;
  type?: string;
  targetId?: string;
}

interface ApiUnitItem {
  id?: string;
  name?: string;
  entryType?: string;
  type?: string;      // fallback for older API responses
  category?: string;
  categoryName?: string;
  categories?: Array<{ id?: string; name?: string; primary?: boolean }>;
  unitCategories?: Array<{ id?: string; name?: string; primary?: boolean }>;
  cost?: number | string;
  costs?: number | string | Array<{ name?: string; value?: number | string; models?: number | string }>;
  points?: number | string;
  pts?: number | string;
  pointCost?: number | string;
  infoLinks?: ApiInfoLink[];
  // Максимальное количество отрядов данного типа в ростере
  maxInRoster?: number | string;
  // Минимальное/максимальное количество моделей в отряде
  minModels?: number | string;
  maxModels?: number | string;
  // Ограничения из BattleScribe (могут содержать min/max моделей)
  constraints?: Array<{
    type?: string;
    value?: number | string;
    scope?: string;
    field?: string;
  }>;
  // Ценовые диапазоны для разного количества моделей
  costBands?: Array<{
    minModels?: number | string;
    maxModels?: number | string;
    minCount?: number | string;
    maxCount?: number | string;
    count?: number | string;
    cost?: number | string;
    value?: number | string;
  }>;
  // Стоимость при полном составе отряда (если отличается от базовой)
  fullStrengthCost?: number | string;
  // Количество моделей в отряде (если фиксировано)
  modelCount?: number | string;
}

const DEFAULT_FACTIONS: Faction[] = [
  { id: 'space-marines', name: 'Space Marines' },
  { id: 'chaos-space-marines', name: 'Chaos Space Marines' },
  { id: 'necrons', name: 'Necrons' },
  { id: 'tyranids', name: 'Tyranids' },
  { id: 'orks', name: 'Orks' },
  { id: 'tau', name: "T'au Empire" },
  { id: 'eldar', name: 'Aeldari' },
  { id: 'dark-eldar', name: 'Drukhari' },
  { id: 'sisters-of-battle', name: 'Adepta Sororitas' },
  { id: 'imperial-guard', name: 'Astra Militarum' },
  { id: 'death-guard', name: 'Death Guard' },
  { id: 'thousand-sons', name: 'Thousand Sons' },
  { id: 'world-eaters', name: 'World Eaters' },
  { id: 'daemons', name: 'Chaos Daemons' },
  { id: 'dark-angels', name: 'Dark Angels' },
  { id: 'blood-angels', name: 'Blood Angels' },
  { id: 'space-wolves', name: 'Space Wolves' },
];

const DEFAULT_UNITS: Unit[] = [
  { id: 'unit-1', name: 'Chapter Master', category: 'HQ', cost: 80 },
  { id: 'unit-2', name: 'Captain', category: 'HQ', cost: 80 },
  { id: 'unit-3', name: 'Librarian', category: 'HQ', cost: 70 },
  { id: 'unit-4', name: 'Chaplain', category: 'HQ', cost: 65 },
  { id: 'unit-5', name: 'Intercessor Squad', category: 'Troops', cost: 95 },
  { id: 'unit-6', name: 'Tactical Squad', category: 'Troops', cost: 100 },
  { id: 'unit-7', name: 'Scout Squad', category: 'Troops', cost: 65 },
  { id: 'unit-8', name: 'Terminator Squad', category: 'Elites', cost: 200 },
  { id: 'unit-9', name: 'Sternguard Veterans', category: 'Elites', cost: 135 },
  { id: 'unit-10', name: 'Dreadnought', category: 'Elites', cost: 150 },
  { id: 'unit-11', name: 'Assault Squad', category: 'Fast Attack', cost: 115 },
  { id: 'unit-12', name: 'Bike Squad', category: 'Fast Attack', cost: 90 },
  { id: 'unit-13', name: 'Land Speeder', category: 'Fast Attack', cost: 70 },
  { id: 'unit-14', name: 'Devastator Squad', category: 'Heavy Support', cost: 95 },
  { id: 'unit-15', name: 'Predator', category: 'Heavy Support', cost: 110 },
  { id: 'unit-16', name: 'Land Raider', category: 'Heavy Support', cost: 285 },
  { id: 'unit-17', name: 'Rhino', category: 'Dedicated Transport', cost: 75 },
  { id: 'unit-18', name: 'Drop Pod', category: 'Dedicated Transport', cost: 65 },
];

export async function getUnits(factionId: string): Promise<Unit[]> {
  try {
    const res = await fetch(`${WH40K_API}/fractions/${encodeURIComponent(factionId)}/units`);
    if (!res.ok) throw new Error('Failed to fetch units');
    const data = await res.json();
    const items: ApiUnitItem[] = Array.isArray(data.units)
      ? data.units
      : Array.isArray(data)
      ? (data as ApiUnitItem[])
      : [];
    if (items.length === 0) return DEFAULT_UNITS;
    return items.map((item) => {
      const cats = item.categories ?? item.unitCategories;
      const category =
        cats?.find(c => c.primary)?.name ??
        cats?.[0]?.name ??
        item.category ?? item.categoryName ?? item.entryType ?? item.type ?? 'Other';
      let cost: number | undefined;
      const toNum = (v: unknown): number | undefined => {
        if (v === null || v === undefined || v === '') return undefined;
        const n = Number(v);
        return isFinite(n) ? n : undefined;
      };
      if (item.cost !== undefined) cost = toNum(item.cost);
      else if (item.points !== undefined) cost = toNum(item.points);
      else if (item.pts !== undefined) cost = toNum(item.pts);
      else if (item.pointCost !== undefined) cost = toNum(item.pointCost);
      else if (Array.isArray(item.costs)) {
        const pts = item.costs.find(c => { const n = c.name?.toLowerCase(); return n?.includes('pts') || n?.includes('point'); });
        const raw = pts?.value ?? item.costs[0]?.value;
        cost = toNum(raw);
      } else if (item.costs !== undefined) cost = toNum(item.costs);
      const isLeader = item.infoLinks?.some(l => l.type === 'rule' && l.name === 'Leader') ?? false;
      // Парсим maxInRoster — максимальное количество отрядов данного типа в ростере
      const maxInRoster = item.maxInRoster !== undefined ? toNum(item.maxInRoster) : undefined;

      // Парсим количество моделей в отряде
      // Пробуем прямые поля minModels/maxModels
      let minModels = item.minModels !== undefined ? toNum(item.minModels) : undefined;
      let maxModels = item.maxModels !== undefined ? toNum(item.maxModels) : undefined;

      // Если нет прямых полей, ищем в constraints (формат BattleScribe)
      if ((minModels === undefined || maxModels === undefined) && Array.isArray(item.constraints)) {
        for (const c of item.constraints) {
          const v = toNum(c.value);
          if (v === undefined) continue;
          if (c.type === 'min' && minModels === undefined) minModels = v;
          if (c.type === 'max' && maxModels === undefined) maxModels = v;
        }
      }

      // Если modelCount задан явно (фиксированный отряд), используем его
      if (item.modelCount !== undefined) {
        const mc = toNum(item.modelCount);
        if (mc !== undefined) {
          minModels = mc;
          maxModels = mc;
        }
      }

      // Парсим ценовые диапазоны (costBands) — стоимость зависит от числа моделей
      let costBands: UnitCostBand[] | undefined;
      if (Array.isArray(item.costBands) && item.costBands.length > 0) {
        const parsed: UnitCostBand[] = [];
        for (const band of item.costBands) {
          const bandMin = toNum(band.minModels ?? band.minCount);
          const bandMax = toNum(band.maxModels ?? band.maxCount ?? band.count);
          const bandCost = toNum(band.cost ?? band.value);
          if (bandMax !== undefined && bandCost !== undefined) {
            parsed.push({
              minModels: bandMin ?? 0,
              maxModels: bandMax,
              cost: bandCost,
            });
          }
        }
        if (parsed.length > 1) costBands = parsed;
      }

      // Если costBands нет, но есть fullStrengthCost и minModels/maxModels отличаются,
      // строим диапазоны из базовой стоимости и fullStrengthCost
      const shouldBuildFromFullStrength = !costBands
        && item.fullStrengthCost !== undefined
        && cost !== undefined
        && minModels !== undefined
        && maxModels !== undefined
        && minModels < maxModels;
      if (shouldBuildFromFullStrength) {
        const fullCost = toNum(item.fullStrengthCost);
        if (fullCost !== undefined && fullCost !== cost) {
          costBands = [
            { minModels: minModels!, maxModels: minModels!, cost: cost! },
            { minModels: minModels! + 1, maxModels: maxModels!, cost: fullCost },
          ];
        }
      }

      // Если costs — массив с несколькими записями и у записей есть поле models,
      // строим costBands из этих данных
      if (!costBands && Array.isArray(item.costs) && item.costs.length > 1) {
        const banded: UnitCostBand[] = [];
        for (const c of item.costs as Array<{ name?: string; value?: number | string; models?: number | string }>) {
          const bandModels = toNum(c.models);
          const bandCost = toNum(c.value);
          if (bandModels !== undefined && bandCost !== undefined) {
            banded.push({ minModels: bandModels, maxModels: bandModels, cost: bandCost });
          }
        }
        if (banded.length > 1) costBands = banded;
      }

      return { id: item.id ?? item.name ?? '', name: item.name ?? '', category, cost, isLeader, maxInRoster, minModels, maxModels, costBands };
    });
  } catch (err) {
    console.error('Failed to fetch units from API, using defaults:', err);
    return DEFAULT_UNITS;
  }
}
