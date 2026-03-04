export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface Roster {
  id: string;
  name: string;
  factionId: string;
  factionName: string;
  pointsLimit: number;
  allowLegends: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Faction {
  id: string;
  name: string;
  parentId?: string;
}

export interface UnitCostBand {
  // Минимальное количество моделей в этом диапазоне
  minModels: number;
  // Максимальное количество моделей в этом диапазоне
  maxModels: number;
  // Стоимость отряда при таком количестве моделей
  cost: number;
}

export interface Unit {
  id: string;
  name: string;
  category: string;
  cost?: number;
  isLeader?: boolean;
  // Максимальное количество отрядов данного типа в ростере (из API)
  maxInRoster?: number;
  // Минимальное количество моделей в отряде
  minModels?: number;
  // Максимальное количество моделей в отряде
  maxModels?: number;
  // Ценовые диапазоны для разного количества моделей
  costBands?: UnitCostBand[];
  // Фактическое количество моделей (выбирается пользователем при добавлении в ростер)
  modelCount?: number;
}

export interface RosterUnit extends Unit {
  entryId: string;
}

export interface UnitGroup {
  id: string;
  units: RosterUnit[];
}
