# wh40kAPI Fix: Data-Driven Allied Catalogue Detection

## Проблема

Эндпоинт `GET /fractions/{id}/ownCatalogues` (wh40kAPI) возвращает слишком широкий набор
каталогов: он включает все каталоги, достижимые через `importRootEntries=true`, даже если
они являются Allied-библиотеками другой фракции.

**Пример Death Guard:**
API возвращает: `{5108, 8106 (CK Library), ac3b (Heresy Legends), 7481 (Titans), 581a, b45c}`
Правильно должно быть: `{5108, ac3b, b45c}`  — 8106 и 7481 должны быть Allied.

## Корень проблемы

BSData использует два механизма для Allied-юнитов:

1. **notInstanceOf(primary-catalogue=G)**: Юниты в библиотеке L имеют modifier
   `type=set field=hidden value=true` с условием в `conditionGroups`:
   ```xml
   <condition type="notInstanceOf" scope="primary-catalogue" childId="G"/>
   ```
   Это означает: юниты L принадлежат фракции G и скрыты в других армиях по умолчанию.
   Пример: War Dog Executioner в CK Library имеет `notInstanceOf(primary-catalogue=46d8)`.

2. **Library-based faction signal**: Фракции CK (46d8) и IK (25dd) не имеют собственных
   `selectionEntries` в главном .cat файле — все их юниты приходят из библиотек.
   Для таких «library-based» фракций все связанные библиотеки являются «own».
   Для обычных фракций (DG, AM, CSM и т.д.), у которых есть собственные юниты,
   библиотеки library-based фракций являются Allied.

## Фикс в BsDataFractionsController.cs

Добавить методы `DetermineAlliedLibraryCatalogueIdsAsync` и `CollectCatalogueIdsStrictAsync`
в класс `BsDataFractionsController`, и вызывать их из `GetOwnCatalogues` для фильтрации.

### Правило 1 — Primary-faction signal
Библиотека L является Allied для фракции F, если:
- Юниты в L имеют `notInstanceOf(scope=primary-catalogue, childId=G)` где G ≠ F
- И ни один юнит в L не имеет `notInstanceOf(scope=primary-catalogue, childId=F)`

### Правило 2 — Library-based faction signal  
Библиотека L является Allied для фракции F, если:
- F НЕ является library-based (имеет собственные root-юниты с `parentId=null`)
- И хотя бы одна library-based фракция (CK, IK) тоже ссылается на L через `importRootEntries`

### Полный патч

Применить следующий diff к файлу
`wh40kAPI.Server/Controllers/BsDataFractionsController.cs`:

```diff
 [HttpGet("{id}/ownCatalogues")]
 public async Task<ActionResult<IEnumerable<string>>> GetOwnCatalogues(string id)
 {
     if (!await db.Catalogues.AnyAsync(c => c.Id == id && !c.Library))
         return NotFound();
 
     var ownIds = await CollectCatalogueIdsAsync(id, importRootEntriesOnly: true);
-    return Ok(ownIds);
+
+    // Filter out library catalogues that are actually "Allied" for this faction.
+    var alliedIds = await DetermineAlliedLibraryCatalogueIdsAsync(id);
+    foreach (var allied in alliedIds)
+        ownIds.Remove(allied);
+
+    return Ok(ownIds);
 }
```

Полный код методов `DetermineAlliedLibraryCatalogueIdsAsync` и `CollectCatalogueIdsStrictAsync`
находится в ветке `copilot/fix-death-guard-allied-units` репозитория
`github.com/Shooshpanius/wh40kAPI`.

## Затронутые фракции

После применения фикса следующие фракции получат корректные ownCatalogues:

| Фракция | Каталог | Должен стать |
|---------|---------|--------------|
| Death Guard (5108) | CK Library (8106) | Allied |
| Death Guard (5108) | Titans (7481) | Allied |
| Chaos Space Marines (c8da) | CK Library (8106) | Allied |
| Chaos Space Marines (c8da) | Titans (7481) | Allied |
| World Eaters (df9a) | CK Library (8106) | Allied |
| World Eaters (df9a) | Titans (7481) | Allied |
| Thousand Sons (1069) | CK Library (8106) | Allied |
| Thousand Sons (1069) | Titans (7481) | Allied |
| Emperor's Children (03fe) | CK Library (8106) | Allied |
| Emperor's Children (03fe) | Titans (7481) | Allied |
| Chaos Daemons (d265) | CK Library (8106) | Allied |
| Chaos Daemons (d265) | Titans (7481) | Allied |
| Adeptus Mechanicus (77b9) | IK Library (1b6d) | Allied |
| Adeptus Mechanicus (77b9) | Agents (b00) | Allied |
| Adeptus Mechanicus (77b9) | Titans (7481) | Allied |

## Временный фикс в TooOldRecruit

До применения фикса в wh40kAPI, в `my40kroster.client/src/services/api.ts` добавлены
записи в `FACTION_ALLIED_CATALOGUE_IDS` для всех затронутых Chaos-фракций.
Это дублирует логику на стороне клиента, но гарантирует корректное отображение
Allied Units независимо от версии wh40kAPI.
