# Задача для wh40kAPI: `/ownCatalogues` возвращает неполный список каталогов

## Статус

**Открыта.**

Эндпоинт `GET /fractions/{id}/ownCatalogues` реализован в коммите
[`2ea5612`](https://github.com/Shooshpanius/wh40kAPI/commit/2ea5612),
однако возвращает **только ID основного каталога фракции**, не включая каталоги,
связанные через `catalogueLinks` с `importRootEntries="true"`.

---

## Проблема

`CollectCatalogueIdsAsync(id, importRootEntriesOnly: true)` не обходит
`catalogueLinks` рекурсивно. В результате для фракций, чьи библиотечные каталоги
являются **собственными** (а не Allied), API возвращает неполный список.

### Пример: Death Guard (`5108-f98-63c2-53cb`)

BSData-файл `Chaos - Death Guard.cat` содержит два `catalogueLink` с
`importRootEntries="true"`:

| Каталог | catalogueId |
|---------|-------------|
| Chaos - Daemons Library | `b45c-af22-788a-dfd6` |
| Chaos Space Marines Legends | `ac3b-689c-4ad4-70cb` |

Юниты из обоих каталогов — хаосовские демоны (включая Nurglite), а также
Heretic Astartes Legends (Decimator, Deredeo Dreadnought, Typhon и др.) —
являются **собственными отрядами Death Guard**, а не Allied.

**Текущий ответ API:**
```json
["5108-f98-63c2-53cb"]
```

**Ожидаемый ответ:**
```json
[
  "5108-f98-63c2-53cb",
  "b45c-af22-788a-dfd6",
  "ac3b-689c-4ad4-70cb"
]
```

### Пример: Imperial Knights (`25dd-7aa0-6bf4-f2d5`)

BSData-файл `Imperium - Imperial Knights.cat` содержит три `catalogueLink` с
`importRootEntries="true"`:

| Каталог | catalogueId |
|---------|-------------|
| Imperium - Imperial Knights - Library | `1b6d-dc06-5db9-c7d1` |
| Imperium - Agents of the Imperium | `b00-cd86-4b4c-97ba` |
| Library - Titans | `7481-280e-b55e-7867` |

**Текущий ответ API:**
```json
["25dd-7aa0-6bf4-f2d5"]
```

**Ожидаемый ответ:**
```json
[
  "25dd-7aa0-6bf4-f2d5",
  "1b6d-dc06-5db9-c7d1",
  "b00-cd86-4b4c-97ba",
  "7481-280e-b55e-7867"
]
```

---

## Последствия для TooOldRecruit

`fetchOwnCatalogueIds()` в `api.ts` принимает непустой массив как успешный ответ
и **полностью игнорирует** статический фолбэк `FACTION_OWN_CATALOGUE_IDS`:

```typescript
if (Array.isArray(data) && data.length > 0) {
  return new Set(data as string[]);  // ← статический фолбэк пропускается
}
return null; // ← только здесь включается фолбэк
```

Итог: юниты из «забытых» API каталогов (демоны, Legends) отображаются в разделе
**Allied Units** вместо основного состава фракции.

Временное решение — статический фолбэк `FACTION_OWN_CATALOGUE_IDS` в `api.ts`
(коммит в TooOldRecruit: `5108-f98-63c2-53cb → [b45c, ac3b]`). Это решение
требует ручного обновления при изменениях в BSData и не масштабируется на другие
фракции.

---

## Что нужно сделать в wh40kAPI

Исправить `CollectCatalogueIdsAsync` (или реализацию эндпоинта `/ownCatalogues`)
так, чтобы метод **рекурсивно** обходил `catalogueLinks` с `importRootEntries="true"`
и включал ID всех достижимых каталогов.

Псевдокод:

```
function CollectOwnCatalogueIds(catalogueId, visited):
  if catalogueId in visited: return
  visited.add(catalogueId)
  for each catalogueLink in catalogue(catalogueId).catalogueLinks:
    if catalogueLink.importRootEntries == true:
      CollectOwnCatalogueIds(catalogueLink.targetCatalogueId, visited)
  return visited
```

Параметр `importRootEntriesOnly: true` (уже присутствующий в сигнатуре
`CollectCatalogueIdsAsync`) должен применяться именно как фильтр при рекурсии,
а не только к корневому вызову.

После реализации статический фолбэк `FACTION_OWN_CATALOGUE_IDS` в TooOldRecruit
можно удалить.

---

## Приоритет

Высокий. Без исправления несколько десятков юнитов каждой затронутой фракции
ошибочно попадают в раздел Allied Units вместо основного состава.

