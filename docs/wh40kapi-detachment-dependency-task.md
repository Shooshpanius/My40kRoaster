# Задание для wh40kAPI: поддержка зависимости юнитов от выбранного детачмента

## Статус (обновлено по результатам анализа данных)

- ✅ **Фронтенд TooOldRecruit готов** — логика фильтрации реализована и ждёт данных от API.
- ✅ **`/fractions/{id}/detachments` уже возвращает `{id, name}[]`** — фронтенд обновлён и поддерживает новый формат.
- ❌ **`/fractions/{id}/unitsTree` не передаёт зависимости** — юниты, доступные только при конкретном детачменте, возвращаются как `hidden: false` без условий. Это нужно исправить.

---

## Конкретный пример: Chaos Knights — «Cultist Firebrand»

По правилам игры, юнит **«Cultist Firebrand»** доступен только при детачменте **«Iconoclast Fiefdom»**.

### Что API возвращает сейчас (неверно)

Из `/fractions/Chaos - Chaos Knights/unitsTree`:

```json
{
  "id": "cb66-af7-2cca-1c85",
  "name": "Cultist Firebrand",
  "entryType": "model",
  "hidden": false,
  "modifierGroups": [
    {
      "modifiers": "[{\"field\":\"...\",\"type\":\"increment\",\"value\":\"2\"}, ...]",
      "conditions": null
    }
  ]
}
```

Проблема: `hidden: false` — юнит отображается для **всех** детачментов, хотя должен быть доступен только при «Iconoclast Fiefdom».

### Что API должен возвращать (требуемое)

```json
{
  "id": "cb66-af7-2cca-1c85",
  "name": "Cultist Firebrand",
  "entryType": "model",
  "hidden": true,
  "modifierGroups": [
    {
      "modifiers": "[{\"field\":\"hidden\",\"type\":\"set\",\"value\":\"false\"}]",
      "conditions": "[{\"field\":\"selections\",\"scope\":\"roster\",\"type\":\"atLeast\",\"value\":\"1\",\"childId\":\"7fe8-de91-8976-e705\"}]"
    }
  ]
}
```

Где:
- `hidden: true` — юнит скрыт по умолчанию (до применения условного модификатора)
- `modifierGroups[0].modifiers` — модификатор, снимающий скрытие: `field=hidden, type=set, value=false`
- `modifierGroups[0].conditions` — условие: `scope=roster, childId=7fe8-de91-8976-e705` (ID детачмента «Iconoclast Fiefdom»)

### ID детачментов Chaos Knights (из текущего API)

| Детачмент | BSData ID |
|-----------|-----------|
| Houndpack Lance | `6cb5-45cf-c626-fa86` |
| **Iconoclast Fiefdom** | `7fe8-de91-8976-e705` |
| Infernal Lance | `812b-f056-ec50-2c3c` |
| Lords of Dread | `e5ab-9622-8b2a-84d0` |
| Traitoris Lance | `603e-6bcd-927f-cb70` |

---

## Суть проблемы в wh40kAPI

В BSData (исходные данные Battlescribe) «Cultist Firebrand» закодирован с `hidden="true"` и модификатором, который снимает скрытие при выборе «Iconoclast Fiefdom». Однако **текущий wh40kAPI применяет этот модификатор безусловно** (без учёта выбранного детачмента) и возвращает `hidden: false` для всех пользователей.

Аналогичная проблема существует для:
- апгрейдов (оружие, особые предметы), доступных только при определённом детачменте — в `buildChildTree` фронтенда
- целых отрядов — в `collectUnits` фронтенда (например, «Cultist Firebrand»)
- контейнеров `selectionEntryGroup`, группирующих детачмент-эксклюзивный контент

---

## Что нужно изменить в wh40kAPI

### Эндпоинт `/fractions/{id}/unitsTree`

**Для КАЖДОГО узла дерева** (unit, model, upgrade, selectionEntryGroup) необходимо:

1. **Возвращать RAW значение поля `hidden`** из BSData **до применения условных модификаторов**.  
   Если в BSData запись имеет `hidden="true"` + модификатор `{type="set", field="hidden", value="false"}` с условием детачмента — API должен возвращать `"hidden": true`, а не применять модификатор автоматически.

2. **Включать в `modifierGroups` все группы модификаторов**, у которых есть условия `{scope: "roster"}`.  
   Это позволит фронтенду определить, при каком детачменте запись становится доступной.

**Ожидаемая структура modifierGroup для детачмент-зависимой записи:**

```json
{
  "modifiers": "[{\"field\":\"hidden\",\"type\":\"set\",\"value\":\"false\"}]",
  "conditions": "[{\"field\":\"selections\",\"scope\":\"roster\",\"type\":\"atLeast\",\"value\":\"1\",\"childId\":\"<detachment-bsdata-id>\"}]"
}
```

---

## Как фронтенд будет использовать эти данные

Фронтенд TooOldRecruit уже реализовал следующую логику (готова к использованию):

1. Загружает детачменты: `GET /fractions/{id}/detachments` → `{id, name}[]`
2. По имени детачмента из ростера находит его BSData ID
3. При обходе `unitsTree` для каждой записи с `hidden: true` проверяет наличие в `modifierGroups` условия:
   ```
   modifier.field === "hidden" && modifier.value === "false"
   condition.scope === "roster" && condition.childId === <detachment-id>
   ```
4. Если совпадение найдено — запись включается в список; иначе — скрывается

Это работает для:
- корневых юнитов/моделей (пример: «Cultist Firebrand» — виден только при «Iconoclast Fiefdom»)
- дочерних апгрейдов внутри юнитов (пример: оружие ассасинов из Adeptus Mechanicus)
- контейнеров `selectionEntryGroup` с детачмент-эксклюзивным контентом

---

## Что уже работает (не нужно менять)

- ✅ `/fractions/{id}/detachments` возвращает `[{"id": "...", "name": "..."}]` — формат поддерживается
- ✅ Поле `hidden` уже присутствует в ответе `unitsTree` для всех записей
- ✅ Поле `modifierGroups` уже присутствует в ответе `unitsTree`
- ✅ Поля `modifiers` и `conditions` внутри `modifierGroups` уже возвращаются как JSON-строки

**Единственное изменение:** API должен возвращать `hidden: true` (raw BSData значение) вместо `hidden: false` (после безусловного применения модификатора) для записей, скрытие которых снимается только при условии выбора определённого детачмента.

---

## Приоритет

Высокий. Без этого изменения детачмент-эксклюзивные юниты (такие как «Cultist Firebrand» в Chaos Knights) видны и доступны для выбора **во всех детачментах**, что противоречит правилам игры.
