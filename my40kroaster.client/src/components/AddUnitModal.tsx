import { useState, useEffect } from 'react';
import type { Unit, UnitCostBand, UnitGroup } from '../types';
import { getUnits } from '../services/api';

interface AddUnitModalProps {
  factionId: string;
  factionName: string;
  onClose: () => void;
  onAdd: (unit: Unit) => void;
  attachMode?: boolean;
  remainingPoints?: number;
  // Текущие отряды в ростере — нужны для проверки лимита maxInRoster
  currentUnitGroups?: UnitGroup[];
  allowLegends?: boolean;
}

/** Возвращает стоимость отряда для заданного числа моделей по диапазонам */
function getCostForModelCount(bands: UnitCostBand[], count: number): number {
  // Сортируем диапазоны по minModels для надёжного поиска
  const sorted = [...bands].sort((a, b) => a.minModels - b.minModels);
  const band = sorted.find(b => count >= b.minModels && count <= b.maxModels);
  // Если count вне всех диапазонов — берём ближайший крайний
  return band?.cost ?? sorted[sorted.length - 1].cost;
}

export function AddUnitModal({ factionId, factionName, onClose, onAdd, attachMode, remainingPoints, currentUnitGroups, allowLegends }: AddUnitModalProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [openType, setOpenType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Хранит выбранное количество моделей для каждого отряда (ключ — id отряда)
  const [selectedModelCounts, setSelectedModelCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    getUnits(factionId).then(data => {
      setUnits(data);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [factionId]);

  const filteredUnits = attachMode ? units.filter(u => u.isLeader) : units;

  const visibleUnits = (allowLegends
    ? filteredUnits
    : filteredUnits.filter(u => !u.name.toLowerCase().includes('[legends]'))
  ).filter(u => {
    const cat = u.category?.toLowerCase();
    if (cat === 'other') return false;
    if (cat === 'upgrade') return false;
    if (u.cost == null || u.cost === 0) return false;
    return true;
  });

  const grouped = visibleUnits.reduce<Record<string, Unit[]>>((acc, unit) => {
    if (!acc[unit.category]) acc[unit.category] = [];
    acc[unit.category].push(unit);
    return acc;
  }, {});

  const types = Object.keys(grouped);

  const toggleType = (type: string) => {
    setOpenType(prev => (prev === type ? null : type));
  };

  // Подсчёт количества отрядов данного типа (по id) уже в ростере.
  // Первый элемент группы (units[0]) является основным отрядом и определяет тип группы.
  const countInRoster = (unitId: string): number => {
    if (!currentUnitGroups) return 0;
    return currentUnitGroups.filter(g => g.units.length > 0 && g.units[0].id === unitId).length;
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedQuery
    ? visibleUnits.filter(u => u.name.toLowerCase().includes(normalizedQuery))
    : [];

  const renderUnitItem = (unit: Unit) => {
    const hasVariableSize = unit.costBands && unit.costBands.length > 1;

    // Текущее выбранное число моделей (по умолчанию — минимальное)
    const selectedCount = hasVariableSize
      ? (selectedModelCounts[unit.id] ?? unit.costBands?.[0].minModels)
      : undefined;

    // Стоимость для выбранного числа моделей
    const effectiveCost = hasVariableSize && selectedCount !== undefined && unit.costBands
      ? getCostForModelCount(unit.costBands, selectedCount)
      : unit.cost;

    const canAdd = remainingPoints === undefined || effectiveCost === undefined || effectiveCost <= remainingPoints;
    const inRoster = countInRoster(unit.id);
    const limitReached = unit.maxInRoster !== undefined && inRoster >= unit.maxInRoster;

    const handleAdd = () => {
      const unitToAdd: Unit = hasVariableSize && selectedCount !== undefined
        ? { ...unit, cost: effectiveCost, modelCount: selectedCount }
        : unit;
      onAdd(unitToAdd);
    };

    return (
      <li key={unit.id} className="unit-item">
        <div className="unit-info">
          <span className="unit-name">{unit.name}</span>
          {effectiveCost !== undefined && (
            <span className="unit-cost">{effectiveCost} pts</span>
          )}
        </div>
        {hasVariableSize && unit.costBands && (
          <div className="unit-size-selector">
            <span className="unit-size-label">Размер отряда:</span>
            <div className="unit-size-options">
              {unit.costBands.map((band) => {
                const label = band.minModels === band.maxModels
                  ? `${band.minModels} мод.`
                  : `${band.minModels}–${band.maxModels} мод.`;
                const isSelected = selectedCount !== undefined
                  && selectedCount >= band.minModels && selectedCount <= band.maxModels;
                return (
                  <button
                    key={`${band.minModels}-${band.maxModels}`}
                    type="button"
                    className={`unit-size-option${isSelected ? ' active' : ''}`}
                    onClick={() => setSelectedModelCounts(prev => ({
                      ...prev,
                      [unit.id]: band.minModels,
                    }))}
                  >
                    {label} — {band.cost} pts
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="unit-item-footer">
          {unit.maxInRoster !== undefined && (
            <span className={`unit-roster-count${limitReached ? ' unit-roster-count--limit' : ''}`}>
              {inRoster}/{unit.maxInRoster}
            </span>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={handleAdd}
            disabled={!canAdd || limitReached}
            aria-label={attachMode ? 'Присоединить' : 'Добавить'}
          >
            +
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{attachMode ? `Присоединить лидера — ${factionName}` : `Добавить отряд — ${factionName}`}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-search">
          <input
            className="form-input"
            type="search"
            placeholder="Поиск отряда..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="loading">Загрузка отрядов...</div>
          ) : normalizedQuery ? (
            searchResults.length === 0 ? (
              <div className="empty-state"><p>Отряды не найдены</p></div>
            ) : (
              <ul className="accordion-body accordion-body--search">
                {searchResults.map(renderUnitItem)}
              </ul>
            )
          ) : types.length === 0 ? (
            <div className="empty-state"><p>Отряды не найдены</p></div>
          ) : (
            <div className="accordion">
              {types.map(type => (
                <div key={type} className="accordion-item">
                  <button
                    className={`accordion-header ${openType === type ? 'open' : ''}`}
                    onClick={() => toggleType(type)}
                  >
                    <span>{type}</span>
                    <span className="accordion-count">{grouped[type].length}</span>
                    <span className="accordion-chevron">{openType === type ? '▲' : '▼'}</span>
                  </button>
                  {openType === type && (
                    <ul className="accordion-body">
                      {grouped[type].map(renderUnitItem)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
