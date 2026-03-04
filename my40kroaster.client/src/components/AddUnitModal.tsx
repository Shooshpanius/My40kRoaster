import { useState, useEffect } from 'react';
import type { Unit, UnitGroup } from '../types';
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

export function AddUnitModal({ factionId, factionName, onClose, onAdd, attachMode, remainingPoints, currentUnitGroups, allowLegends }: AddUnitModalProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [openType, setOpenType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
    const canAdd = remainingPoints === undefined || unit.cost === undefined || unit.cost <= remainingPoints;
    const inRoster = countInRoster(unit.id);
    const limitReached = unit.maxInRoster !== undefined && inRoster >= unit.maxInRoster;
    return (
      <li key={unit.id} className="unit-item">
        <div className="unit-info">
          <span className="unit-name">{unit.name}</span>
          {unit.cost !== undefined && (
            <span className="unit-cost">{unit.cost} pts</span>
          )}
        </div>
        <div className="unit-item-footer">
          {unit.maxInRoster !== undefined && (
            <span className={`unit-roster-count${limitReached ? ' unit-roster-count--limit' : ''}`}>
              {inRoster}/{unit.maxInRoster}
            </span>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onAdd(unit)}
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
