# Задание для wh40kAPI: поддержка зависимости записей от выбранного детачмента

## Контекст

Фронтенд TooOldRecruit получает данные о юнитах из эндпоинта `/fractions/{id}/unitsTree` и список детачментов из `/fractions/{id}/detachments`. Детачмент хранится в ростере как строка-имя (`detachmentName`).

В BSData некоторые дочерние записи юнитов (апгрейды — оружие, особые предметы) по умолчанию скрыты (`hidden: true`) и становятся доступны только при выборе конкретного детачмента. Эта зависимость закодирована в `modifierGroups` записи:

```json
{
  "modifiers": [
    { "field": "hidden", "type": "set", "value": "false" },
    { "field": "<constraint-id>", "type": "set", "value": "1" }
  ],
  "conditions": [
    { "field": "selections", "scope": "roster", "type": "atLeast", "value": "1", "childId": "<detachment-entry-id>" }
  ]
}
```

**Конкретный пример (Adeptus Mechanicus):** апгрейды Callidus Assassin → «Decoy Targets», Culexus → «Esoteric Explosives», Eversor → «Intra-neural Biotech», Vindicare → «Micromelta Round» — доступны только при детачменте «Veiled Blade Elimination Force» (`id: e203-73dc-18d9-f390`).

---

## Проблема

Фронтенд не может применить эту логику, потому что:

1. **`/fractions/{id}/detachments` возвращает `string[]`** — только имена детачментов, без их ID.  
   Фронтенд не может сопоставить имя детачмента (которое хранит ростер) с `childId` в условиях `modifierGroups`.

2. **Поле `hidden` не передаётся в `/fractions/{id}/unitsTree`** (либо фронтенд не получает его для дочерних записей).  
   Без этого поля фронтенд не знает, какие дочерние записи скрыты по умолчанию и требуют условия детачмента.

---

## Что нужно изменить в wh40kAPI

### 1. Эндпоинт `/fractions/{id}/detachments`

**Текущий ответ:**
```json
["Alien Hunters (Ordo Xenos)", "Daemon Hunters (Ordo Malleus)", "Veiled Blade Elimination Force", ...]
```

**Требуемый ответ:**
```json
[
  { "id": "aabf-4988-4054-bed2", "name": "Alien Hunters (Ordo Xenos)" },
  { "id": "bd6f-97c7-6ac4-8320", "name": "Daemon Hunters (Ordo Malleus)" },
  { "id": "e203-73dc-18d9-f390", "name": "Veiled Blade Elimination Force" }
]
```

Поле `id` — это BSData-идентификатор записи детачмента (`selectionEntry.id`), который используется в `modifierGroups.conditions[].childId`.

### 2. Эндпоинт `/fractions/{id}/unitsTree`

Для каждого узла дерева (включая дочерние записи типа `upgrade`, `model`, `selectionEntryGroup`) необходимо включать поле **`hidden`** (`boolean`):

```json
{
  "id": "eb7b-611d-308e-6436",
  "name": "Decoy Targets",
  "entryType": "upgrade",
  "hidden": true,
  "modifierGroups": [
    {
      "modifiers": "[{\"field\":\"hidden\",\"type\":\"set\",\"value\":\"false\"},{\"field\":\"8a04-ccf3-9c4f-4e4e\",\"type\":\"set\",\"value\":\"1\"}]",
      "conditions": "[{\"field\":\"selections\",\"scope\":\"roster\",\"type\":\"atLeast\",\"value\":\"1\",\"childId\":\"e203-73dc-18d9-f390\"}]"
    }
  ]
}
```

Поле `hidden: true` должно присутствовать у записей, скрытых по умолчанию (до применения условных модификаторов).

---

## Как это будет использоваться фронтендом

После этих изменений фронтенд сможет:

1. Загрузить список детачментов с их ID: `getDetachments(factionId)` → `{id, name}[]`
2. По имени выбранного детачмента в ростере найти его ID
3. При построении дерева юнитов в `buildChildTree` — для каждой дочерней записи с `hidden: true` проверить, есть ли в её `modifierGroups` условие `{scope: 'roster', childId: <detachment-id>}` с модификатором `{field: 'hidden', type: 'set', value: 'false'}`
4. Если условие выполнено — включить запись в дерево (как доступный апгрейд/модель); иначе — пропустить

---

## Обратная совместимость

Изменение формата `/fractions/{id}/detachments` с `string[]` на `{id, name}[]` — ломающее изменение. Возможные варианты:

- **Вариант A (предпочтительный):** Заменить формат ответа. Фронтенд TooOldRecruit будет обновлён одновременно.
- **Вариант B:** Добавить новый эндпоинт, например `/fractions/{id}/detachmentsWithIds`, оставив старый без изменений.

---

## Приоритет

Средний. Без этого изменения детачмент-эксклюзивные апгрейды (специальное оружие ассасинов и аналогичные записи в других фракциях) не отображаются и недоступны в приложении при сборке ростера.
