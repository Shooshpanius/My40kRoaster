using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using System.Text.Json;
using System.Xml.Linq;

namespace My40kRoster.Server.Controllers
{
    [ApiController]
    [Route("api/bsdata")]
    public class BsdataController(IHttpClientFactory httpClientFactory, IMemoryCache cache) : ControllerBase
    {
        [HttpGet("catalogues")]
        public async Task<IActionResult> GetCatalogues()
        {
            var client = httpClientFactory.CreateClient("wh40kapi");
            using var response = await client.GetAsync("catalogues").ConfigureAwait(false);
            var content = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            return new ContentResult
            {
                Content = content,
                ContentType = "application/json; charset=utf-8",
                StatusCode = (int)response.StatusCode
            };
        }

        [HttpGet("catalogues/{id}/units")]
        public async Task<IActionResult> GetCatalogueUnits(string id)
        {
            var client = httpClientFactory.CreateClient("wh40kapi");
            using var response = await client.GetAsync($"catalogues/{id}/units").ConfigureAwait(false);
            var content = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            return new ContentResult
            {
                Content = content,
                ContentType = "application/json; charset=utf-8",
                StatusCode = (int)response.StatusCode
            };
        }

        [HttpGet("fractions")]
        public async Task<IActionResult> GetFractions()
        {
            var client = httpClientFactory.CreateClient("wh40kapi");
            using var response = await client.GetAsync("fractions").ConfigureAwait(false);
            var content = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            return new ContentResult
            {
                Content = content,
                ContentType = "application/json; charset=utf-8",
                StatusCode = (int)response.StatusCode
            };
        }

        [HttpGet("fractions/{id}/units")]
        public async Task<IActionResult> GetFractionUnits(string id)
        {
            var client = httpClientFactory.CreateClient("wh40kapi");
            using var response = await client.GetAsync($"fractions/{Uri.EscapeDataString(id)}/units").ConfigureAwait(false);
            var content = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            return new ContentResult
            {
                Content = content,
                ContentType = "application/json; charset=utf-8",
                StatusCode = (int)response.StatusCode
            };
        }

        [HttpGet("fractions/{id}/unitsWithCosts")]
        public async Task<IActionResult> GetFractionUnitsWithCosts(string id)
        {
            var client = httpClientFactory.CreateClient("wh40kapi");
            using var response = await client.GetAsync($"fractions/{Uri.EscapeDataString(id)}/unitsWithCosts").ConfigureAwait(false);
            var content = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            return new ContentResult
            {
                Content = content,
                ContentType = "application/json; charset=utf-8",
                StatusCode = (int)response.StatusCode
            };
        }

        [HttpGet("fractions/{id}/unitsTree")]
        public async Task<IActionResult> GetFractionUnitsTree(string id)
        {
            var client = httpClientFactory.CreateClient("wh40kapi");
            using var response = await client.GetAsync($"fractions/{Uri.EscapeDataString(id)}/unitsTree").ConfigureAwait(false);
            var content = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            return new ContentResult
            {
                Content = content,
                ContentType = "application/json; charset=utf-8",
                StatusCode = (int)response.StatusCode
            };
        }

        // Прокси к эндпоинту wh40kAPI, который возвращает список детачментов фракции.
        [HttpGet("fractions/{id}/detachments")]
        public async Task<IActionResult> GetFractionDetachments(string id)
        {
            var client = httpClientFactory.CreateClient("wh40kapi");
            using var response = await client.GetAsync($"fractions/{Uri.EscapeDataString(id)}/detachments").ConfigureAwait(false);
            var content = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            return new ContentResult
            {
                Content = content,
                ContentType = "application/json; charset=utf-8",
                StatusCode = (int)response.StatusCode
            };
        }

        // Возвращает список юнитов, доступных только при определённом детачменте.
        //
        // В BSData (wh40k-10e.git) детачмент-зависимые юниты кодируются как <entryLink>
        // с модификатором <modifier type="set" field="hidden" value="true"> и условием
        // <condition type="lessThan" scope="roster" childId="<detachmentId>">.
        // Это означает: «скрыть юнит, если указанный детачмент не выбран в ростере».
        //
        // wh40kAPI не экспортирует эти entryLink-условия в ответе /unitsTree,
        // поэтому данный эндпоинт читает .cat-файл напрямую из BSData GitHub и
        // возвращает карту {unitId, detachmentIds[]}.
        //
        // Алгоритм поиска .cat-файла:
        //   1. Запрашиваем список фракций у wh40kAPI и ищем имя по id.
        //   2. Конструируем URL: https://raw.githubusercontent.com/…/<name>.cat
        //      (имя каталога в BSData совпадает с именем фракции в wh40kAPI).
        //   3. Результат кэшируется на 1 час.
        [HttpGet("fractions/{id}/detachment-conditions")]
        public async Task<IActionResult> GetFractionDetachmentConditions(string id)
        {
            var cacheKey = $"detachment-conditions:{id}";
            if (cache.TryGetValue(cacheKey, out string? cachedJson))
                return new ContentResult { Content = cachedJson, ContentType = "application/json; charset=utf-8", StatusCode = 200 };

            try
            {
                // Шаг 1: получаем имя фракции из wh40kAPI
                var fractionName = await ResolveFractionNameAsync(id).ConfigureAwait(false);
                if (string.IsNullOrEmpty(fractionName))
                    return Ok("[]");

                // Шаг 2: скачиваем .cat-файл из BSData GitHub.
                // Uri.EscapeDataString корректен для сегмента пути URL:
                // пробелы → %20, спецсимволы → %XX. Для GitHub raw URLs это ожидаемый формат.
                var githubClient = httpClientFactory.CreateClient("bsdata-github");
                var catFileName = Uri.EscapeDataString(fractionName) + ".cat";
                using var catResponse = await githubClient.GetAsync(catFileName).ConfigureAwait(false);
                if (!catResponse.IsSuccessStatusCode)
                    return Ok("[]");

                var catContent = await catResponse.Content.ReadAsStringAsync().ConfigureAwait(false);

                // Шаг 3: парсим XML и извлекаем условия детачментов
                var conditions = ParseDetachmentConditions(catContent);
                var json = JsonSerializer.Serialize(conditions);

                cache.Set(cacheKey, json, TimeSpan.FromHours(1));
                return new ContentResult { Content = json, ContentType = "application/json; charset=utf-8", StatusCode = 200 };
            }
            catch
            {
                return Ok("[]");
            }
        }

        [HttpGet("units/{id}/categories")]
        public async Task<IActionResult> GetUnitCategories(string id)
        {
            var client = httpClientFactory.CreateClient("wh40kapi");
            using var response = await client.GetAsync($"units/{Uri.EscapeDataString(id)}/categories").ConfigureAwait(false);
            var content = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            return new ContentResult
            {
                Content = content,
                ContentType = "application/json; charset=utf-8",
                StatusCode = (int)response.StatusCode
            };
        }

        [HttpGet("units/{id}/cost-tiers")]
        public async Task<IActionResult> GetUnitCostTiers(string id)
        {
            var client = httpClientFactory.CreateClient("wh40kapi");
            using var response = await client.GetAsync($"units/{Uri.EscapeDataString(id)}/cost-tiers").ConfigureAwait(false);
            var content = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            return new ContentResult
            {
                Content = content,
                ContentType = "application/json; charset=utf-8",
                StatusCode = (int)response.StatusCode
            };
        }

        // ──────────────────────────────────────────────────────────────────────
        // Вспомогательные методы
        // ──────────────────────────────────────────────────────────────────────

        // Возвращает имя фракции по её BSData-идентификатору.
        // Запрашивает список у wh40kAPI и кэширует результат на 1 час.
        private async Task<string?> ResolveFractionNameAsync(string fractionId)
        {
            const string cacheKey = "fraction-names";
            if (!cache.TryGetValue(cacheKey, out Dictionary<string, string>? nameMap) || nameMap is null)
            {
                nameMap = [];
                var apiClient = httpClientFactory.CreateClient("wh40kapi");
                try
                {
                    using var res = await apiClient.GetAsync("fractions").ConfigureAwait(false);
                    if (res.IsSuccessStatusCode)
                    {
                        var json = await res.Content.ReadAsStringAsync().ConfigureAwait(false);
                        using var doc = JsonDocument.Parse(json);

                        // wh40kAPI может вернуть {fractions:[…]}, {catalogues:[…]} или сразу массив
                        JsonElement arr = doc.RootElement.ValueKind == JsonValueKind.Array
                            ? doc.RootElement
                            : doc.RootElement.TryGetProperty("fractions", out var f) ? f
                            : doc.RootElement.TryGetProperty("catalogues", out var c) ? c
                            : default;

                        if (arr.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var item in arr.EnumerateArray())
                            {
                                var itemId = item.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
                                var name = item.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;
                                if (!string.IsNullOrEmpty(itemId) && !string.IsNullOrEmpty(name))
                                    nameMap[itemId] = name;
                            }
                        }
                    }
                }
                catch { /* при ошибке возвращаем null — клиент получит [] */ }

                cache.Set(cacheKey, nameMap, TimeSpan.FromHours(1));
            }

            return nameMap.GetValueOrDefault(fractionId);
        }

        // DTO для возвращаемых условий детачментов.
        private sealed record DetachmentConditionDto(string UnitId, string[] DetachmentIds);

        // Парсит BSData .cat-файл (XML) и извлекает условия скрытия по детачменту.
        //
        // В BSData паттерн выглядит так:
        //   <entryLink type="selectionEntry" targetId="<unitId>">
        //     <modifiers>
        //       <modifier type="set" field="hidden" value="true">
        //         <conditionGroups>
        //           <conditionGroup type="and">
        //             <conditions>
        //               <condition type="lessThan" scope="roster" field="selections"
        //                          childId="<detachmentId>" value="1"/>
        //               <!-- необязательное второе условие для союзных армий -->
        //             </conditions>
        //           </conditionGroup>
        //         </conditionGroups>
        //       </modifier>
        //     </modifiers>
        //   </entryLink>
        //
        // Логика: «скрыть юнит, если указанный детачмент не выбран» ≡
        //         «юнит доступен только при этом детачменте».
        // Возвращаем список: [{unitId, detachmentIds[]}, …].
        private static List<DetachmentConditionDto> ParseDetachmentConditions(string xmlContent)
        {
            XNamespace ns = "http://www.battlescribe.net/schema/catalogueSchema";
            var doc = XDocument.Parse(xmlContent);
            var results = new List<DetachmentConditionDto>();

            // Ищем только прямые дочерние entryLink в <entryLinks> корневого каталога,
            // чтобы не захватить вложенные entryLink внутри юнитов.
            var rootEntryLinks = doc
                .Root?
                .Element(ns + "entryLinks")?
                .Elements(ns + "entryLink")
                ?? [];

            foreach (var entryLink in rootEntryLinks)
            {
                if (entryLink.Attribute("type")?.Value != "selectionEntry") continue;
                var targetId = entryLink.Attribute("targetId")?.Value;
                if (string.IsNullOrEmpty(targetId)) continue;

                var detachmentIds = new HashSet<string>(StringComparer.Ordinal);

                // Ищем модификаторы type="set" field="hidden" value="true"
                var hideModifiers = entryLink
                    .Descendants(ns + "modifier")
                    .Where(m =>
                        m.Attribute("type")?.Value == "set" &&
                        m.Attribute("field")?.Value == "hidden" &&
                        m.Attribute("value")?.Value == "true");

                foreach (var modifier in hideModifiers)
                {
                    // Ищем условия scope="roster" type="lessThan" field="selections":
                    // childId — это ID детачмента, при ОТСУТСТВИИ которого юнит скрывается.
                    var rosterConditions = modifier
                        .Descendants(ns + "condition")
                        .Where(c =>
                            c.Attribute("scope")?.Value == "roster" &&
                            c.Attribute("type")?.Value == "lessThan" &&
                            c.Attribute("field")?.Value == "selections");

                    foreach (var cond in rosterConditions)
                    {
                        var childId = cond.Attribute("childId")?.Value;
                        if (!string.IsNullOrEmpty(childId))
                            detachmentIds.Add(childId);
                    }
                }

                if (detachmentIds.Count > 0)
                    results.Add(new DetachmentConditionDto(targetId, [.. detachmentIds]));
            }

            return results;
        }
    }
}
