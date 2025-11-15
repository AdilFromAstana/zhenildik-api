// build-unified-products.js
//
// Объединяет товары Kaspi + Arbuz + Wolt в один каталог по категориям.
// Для одинаковых товаров в категории формируется один объект с полем `shops`.
//
// Ожидаемые входные данные:
//  - kaspi_need_data/**/*.json
//  - arbuz_need_data_almaty/**/*.json
//  - wolt_need_data/**/*.json
//
// Справочники:
//  - normalizedResults/kaspi-category-brand-map.json
//  - normalizedResults/kaspi-category-groups.json
//

const fs = require("fs");
const path = require("path");

// ---------- ПУТИ ----------

const SOURCES = {
    kaspi: path.join(__dirname, "kaspi_need_data"),
    arbuz: path.join(__dirname, "arbuz_need_data_almaty"),
    wolt: path.join(__dirname, "wolt_need_data"),
};

const OUTPUT_DIR = path.join(__dirname, "unified_products");

const BRAND_FILE = path.join(
    __dirname,
    "normalizedResults",
    "kaspi-category-brand-map.json"
);

const GROUPS_FILE = path.join(
    __dirname,
    "normalizedResults",
    "kaspi-category-groups.json"
);

// ---------- ЗАГРУЗКА СПРАВОЧНИКОВ ----------

const CATEGORY_BRANDS = fs.existsSync(BRAND_FILE)
    ? JSON.parse(fs.readFileSync(BRAND_FILE, "utf8"))
    : {};

const CATEGORY_GROUPS = fs.existsSync(GROUPS_FILE)
    ? JSON.parse(fs.readFileSync(GROUPS_FILE, "utf8"))
    : {};

// ---------- УТИЛИТЫ ----------

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function walk(dir) {
    const res = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) res.push(...walk(full));
        else if (e.isFile() && e.name.endsWith(".json")) res.push(full);
    }
    return res;
}

function norm(s) {
    return (s || "").toLowerCase().replace(/ё/g, "е").trim();
}

function tokenize(str) {
    return norm(str)
        .replace(/[",()]/g, " ")
        .replace(/\s+/g, " ")
        .split(" ")
        .filter(Boolean);
}

// удалить n-gram (бренды, фразы из groups)
function stripPhrases(tokens, phrases) {
    let out = [...tokens];
    for (const phrase of phrases || []) {
        const pTokens = tokenize(phrase);
        if (!pTokens.length) continue;
        const L = pTokens.length;
        for (let i = 0; i <= out.length - L;) {
            let ok = true;
            for (let j = 0; j < L; j++) {
                if (out[i + j] !== pTokens[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) out.splice(i, L);
            else i++;
        }
    }
    return out;
}

function stripCategoryWords(tokens, categoryPath) {
    const catTokens = categoryPath
        .toLowerCase()
        .replace(/ё/g, "е")
        .split(/[\/, ]+/)
        .filter(Boolean);

    const remove = new Set(catTokens);
    return tokens.filter((t) => !remove.has(t));
}

function stripBrandTokens(tokens, brandList) {
    if (!brandList?.length) return tokens;

    const normBrands = brandList.map((b) => norm(b));
    const patterns = normBrands.map((b) => b.split(" "));

    let out = [...tokens];

    for (const pattern of patterns) {
        const L = pattern.length;
        for (let i = 0; i <= out.length - L;) {
            const slice = out.slice(i, i + L);
            if (slice.join(" ") === pattern.join(" ")) {
                out.splice(i, L);
            } else {
                i++;
            }
        }
    }

    return out;
}

// -----------------------------
// ПАРСЕР ЧИСЛОВЫХ ПАРАМЕТРОВ
// -----------------------------
function parseStructuredParams(tokens) {
    const res = {
        volume: null,
        weight: null,
        count: null,
        pack: null,
        percent: null,
        age: null,
        stars: null,
    };

    const finalTokens = [];

    const SHORT = new Set(["г", "гр", "мл", "л", "шт", "кг"]);
    const LONG = new Set([
        "упаковки",
        "упаковка",
        "пачки",
        "пачка",
        "пакета",
        "капсул",
        "капсула",
    ]);

    let i = 0;

    while (i < tokens.length) {
        let t = tokens[i];
        const n1 = tokens[i + 1];
        const n2 = tokens[i + 2];
        const n3 = tokens[i + 3];
        const n4 = tokens[i + 4];

        // нормализуем запятые в числах
        t = t.replace(",", ".");

        // 0) кейс "7.1 %" → два токена: число + "%"
        if (/^\d+(\.\d+)?$/.test(t) && n1 === "%") {
            const v = `${t}%`;
            res.percent = v;
            finalTokens.push(v);
            i += 2;
            continue;
        }

        // 1) 7.1%, 7,1%
        if (/^\d+(\.\d+)?%$/.test(t)) {
            const v = t.replace(",", ".");
            res.percent = v;
            finalTokens.push(v);
            i++;
            continue;
        }

        // 2) возраст "12 лет", "10 years old", "10yo", "10 yo"
        if (/^\d+$/.test(t) && (n1 === "лет" || n1 === "года")) {
            const age = `${t} ${n1}`;
            res.age = age;
            finalTokens.push(age);
            i += 2;
            continue;
        }

        if (/^\d+(yo|y\.o\.?)$/i.test(t)) {
            const num = t.match(/\d+/)[0];
            const age = `${num} YO`;
            res.age = age;
            finalTokens.push(age);
            i++;
            continue;
        }

        if (/^\d+$/.test(t) && n1 && /^(yo|y\.o\.?)$/i.test(n1)) {
            const age = `${t} YO`;
            res.age = age;
            finalTokens.push(age);
            i += 2;
            continue;
        }

        if (/^\d+$/.test(t) && n1 && /^(years?|yrs?)$/.test(n1)) {
            let age = `${t} ${n1}`;
            if (n2 === "old") {
                age = `${t} ${n1} old`;
                i += 3;
            } else {
                i += 2;
            }
            res.age = age;
            finalTokens.push(age);
            continue;
        }

        if (t === "aged" && /^\d+$/.test(n1)) {
            if (/^(yo|y\.o\.?)$/i.test(n2)) {
                const age = `${n1} YO`;
                res.age = age;
                finalTokens.push(age);
                i += 3;
                continue;
            }
            if (/^(years?|yrs?)$/.test(n2)) {
                let age = `${n1} ${n2}`;
                if (n3 === "old") {
                    age = `${n1} ${n2} old`;
                    i += 4;
                } else {
                    i += 3;
                }
                res.age = age;
                finalTokens.push(age);
                continue;
            }
        }

        // 3) звезды "3 звезды"
        if (/^\d+$/.test(t) && n1 && /^(звезда|звезды|звезд)$/.test(n1)) {
            const stars = `${t} ${n1}`;
            res.stars = stars;
            finalTokens.push(stars);
            i += 2;
            continue;
        }

        // 4) "500 мл", "900 г", "0.5 кг", "1 шт"
        if (/^\d+(\.\d+)?$/.test(t) && SHORT.has(n1)) {
            const num = t.replace(",", ".");
            const pair = `${num} ${n1}`;
            if (["г", "гр", "кг"].includes(n1)) res.weight = pair;
            if (["мл", "л"].includes(n1)) res.volume = pair;
            if (n1 === "шт") res.count = pair;
            finalTokens.push(pair);
            i += 2;
            continue;
        }

        // 5) "3 упаковки по 200 г"
        if (/^\d+$/.test(t) && LONG.has(n1)) {
            if (n2 === "по" && /^\d+$/.test(n3) && SHORT.has(n4)) {
                res.pack = {
                    packs: Number(t),
                    perPack: Number(n3),
                    unit: n4,
                };
                finalTokens.push(`${t} ${n1} по ${n3} ${n4}`);
                i += 5;
                continue;
            }
            finalTokens.push(`${t} ${n1}`);
            i += 2;
            continue;
        }

        // 6) 500мл, 0.5л
        if (/^\d+(\.\d+)?(мл|л)$/.test(t)) {
            const unit = t.endsWith("л") ? "л" : "мл";
            const num = t.replace(/[^\d.]/g, "");
            const pair = `${num} ${unit}`;
            res.volume = pair;
            finalTokens.push(pair);
            i++;
            continue;
        }

        finalTokens.push(t);
        i++;
    }

    return { normalizedTokens: finalTokens, params: res };
}

function stripUsedParamTokens(tokens, params) {
    const remove = new Set();

    if (params.percent) {
        remove.add(params.percent);
        remove.add(params.percent.replace(",", "."));
        remove.add(params.percent.replace("%", ""));
    }

    function addPair(pair) {
        if (!pair) return;
        const [num, unit] = pair.split(" ");
        remove.add(num);
        remove.add(unit);
        remove.add(`${num}${unit}`);
    }

    addPair(params.volume);
    addPair(params.weight);
    addPair(params.count);

    if (params.pack) {
        remove.add(String(params.pack.packs));
        remove.add("по");
        remove.add(String(params.pack.perPack));
        remove.add(params.pack.unit);

        const LONG = [
            "упаковки",
            "упаковка",
            "пачки",
            "пачка",
            "пакета",
            "капсул",
            "капсула",
        ];
        for (const w of LONG) remove.add(w);
    }

    if (params.age) {
        const parts = params.age.toLowerCase().split(/[\s\.]+/).filter(Boolean);
        for (const p of parts) remove.add(p);
        remove.add(parts.join(""));
        remove.add(parts.join("") + ".");
    }

    if (params.stars) {
        const parts = params.stars.split(" ");
        for (const p of parts) remove.add(p.toLowerCase());
    }

    return tokens.filter((t) => !remove.has(t));
}

// ---------- НОРМАЛИЗАЦИЯ ПАРАМЕТРОВ В ЧИСЛА ----------

function canonPercent(p) {
    if (!p) return null;
    const num = parseFloat(p.replace("%", "").replace(",", "."));
    if (Number.isNaN(num)) return null;
    return num; // 7.1
}

function canonVolumeMl(pair) {
    if (!pair) return null;
    const [numStr, unit] = pair.split(" ");
    const num = parseFloat(numStr.replace(",", "."));
    if (Number.isNaN(num)) return null;

    if (unit === "мл" || unit === "ml") return Math.round(num);
    if (unit === "л" || unit === "l") return Math.round(num * 1000);
    return null;
}

function canonWeightGr(pair) {
    if (!pair) return null;
    const [numStr, unit] = pair.split(" ");
    const num = parseFloat(numStr.replace(",", "."));
    if (Number.isNaN(num)) return null;

    if (unit === "г" || unit === "гр" || unit === "g") return Math.round(num);
    if (unit === "кг" || unit === "kg") return Math.round(num * 1000);
    return null;
}

// ---------- ПРОЦЕНТ ИЗ СЫРОГО TITLE ----------

function extractPercentFromTitle(rawTitle) {
    if (!rawTitle) return null;
    const s = rawTitle.toLowerCase().replace(/,/g, "."); // 7,1 → 7.1

    const re = /(\d+(\.\d+)?)\s*%/g;
    let m;
    let best = null;
    let bestIsDecimal = false;

    while ((m = re.exec(s)) !== null) {
        const numStr = m[1];
        const num = parseFloat(numStr);
        if (Number.isNaN(num)) continue;

        const isDecimal = numStr.includes(".");

        if (best === null) {
            best = num;
            bestIsDecimal = isDecimal;
            continue;
        }

        // приоритет: десятичный > целый; при равном типе — большее число
        if (isDecimal && !bestIsDecimal) {
            best = num;
            bestIsDecimal = true;
            continue;
        }
        if (isDecimal === bestIsDecimal && num > best) {
            best = num;
            bestIsDecimal = isDecimal;
        }
    }

    return best; // number или null
}

// ---------- КАТЕГОРИЯ / БРЕНД ----------

function getCategoryFromItem(item, filePath, rootDir) {
    if (Array.isArray(item.categories) && item.categories.length >= 2) {
        return [item.categories[0], item.categories[1]];
    }
    if (Array.isArray(item.categoryRu) && item.categoryRu.length >= 3) {
        return [item.categoryRu[1], item.categoryRu[2]];
    }
    if (Array.isArray(item.category) && item.category.length >= 3) {
        return [item.category[1], item.category[2]];
    }

    const rel = path.relative(rootDir, filePath);
    const parts = rel.split(path.sep);
    if (parts.length >= 2) {
        return [parts[0], parts[1]];
    }

    return null;
}

function detectBrand(categoryPath, item, titleNorm) {
    const brandField = item.brandName || item.brand || null;
    const brands = CATEGORY_BRANDS[categoryPath] || [];

    const normBrandField = brandField ? norm(brandField) : null;
    if (normBrandField) {
        const exists = brands.some((b) => norm(b) === normBrandField);
        if (exists) return brandField;
    }

    for (const b of brands) {
        if (titleNorm.includes(norm(b))) return b;
    }

    return brandField || null;
}

// ---------- КАНОНИЧЕСКОЕ ИМЯ ТОВАРА ----------

function buildCanonicalName(rawTitle, brand, cleanTokens, params) {
    const parts = [];

    // бренд
    if (brand) {
        parts.push(`brand:${norm(brand)}`);
    }

    // нормализованные параметры
    const p = [];

    const pc = canonPercent(params.percent);
    if (pc != null) p.push(`percent:${pc}`); // 7.1

    const volMl = canonVolumeMl(params.volume);
    if (volMl != null) p.push(`volume_ml:${volMl}`); // 500

    const wGr = canonWeightGr(params.weight);
    if (wGr != null) p.push(`weight_g:${wGr}`);

    if (params.count) p.push(`count:${params.count}`);

    if (params.pack) {
        p.push(
            `pack:${params.pack.packs}x${params.pack.perPack}${params.pack.unit}`
        );
    }

    if (p.length) {
        parts.push(p.join("|"));
    }

    // "семантическое" имя (без бренда, категорий, веса, %)
    if (cleanTokens.length) {
        const uniq = Array.from(new Set(cleanTokens));
        uniq.sort();
        parts.push(`name:${uniq.join(" ")}`);
    }

    // fallback — вдруг всё вырезали
    if (!parts.length) {
        parts.push(`raw:${norm(rawTitle)}`);
    }

    return parts.join("||");
}

// ---------- ОСНОВНОЙ АЛГОРИТМ ----------

function buildUnified() {
    ensureDir(OUTPUT_DIR);

    const buckets = {};

    for (const [shopName, rootDir] of Object.entries(SOURCES)) {
        if (!fs.existsSync(rootDir)) continue;

        const files = walk(rootDir);

        for (const file of files) {
            let items;
            try {
                items = JSON.parse(fs.readFileSync(file, "utf8"));
            } catch {
                continue;
            }
            if (!Array.isArray(items)) continue;

            for (const item of items) {
                const cat = getCategoryFromItem(item, file, rootDir);
                if (!cat) continue;
                const [mainCat, subCat] = cat;
                const categoryPath = `${mainCat}/${subCat}`;

                const rawTitle = item.title || item.name || item.shortNameText || "";
                if (!rawTitle) continue;

                const titleNorm = norm(rawTitle);
                const brand = detectBrand(categoryPath, item, titleNorm);

                let tokens = tokenize(rawTitle);
                tokens = tokens.map((t) => t.replace(",", ".")); // нормализуем числа

                // выкинуть слова из категории
                tokens = stripCategoryWords(tokens, categoryPath);

                // выкинуть бренды
                const brandList = CATEGORY_BRANDS[categoryPath] || [];
                const extraBrands = brand ? [brand] : [];
                const fullBrandList = [...new Set([...brandList, ...extraBrands])];
                tokens = stripBrandTokens(tokens, fullBrandList);

                // парсим параметры
                const parsed = parseStructuredParams(tokens);
                const params = parsed.params;
                let normalizedTokens = parsed.normalizedTokens;

                // ПЕРЕОПРЕДЕЛЯЕМ ПРОЦЕНТ ИЗ СЫРОГО TITLE, ЕСЛИ НАШЛИ ЛУЧШЕ
                const percentFromTitle = extractPercentFromTitle(rawTitle);
                if (percentFromTitle != null) {
                    params.percent = `${percentFromTitle}%`;
                }

                // удаляем токены, использованные в параметрах
                let cleanTokens = stripUsedParamTokens(normalizedTokens, params);

                // выкидываем "служебные" слова из groups
                const groupCfg = CATEGORY_GROUPS[categoryPath];
                if (groupCfg && groupCfg.groups) {
                    const phrases = Object.values(groupCfg.groups).flat();
                    cleanTokens = stripPhrases(cleanTokens, phrases);
                }

                // строим каноническое имя
                const canonicalName = buildCanonicalName(
                    rawTitle,
                    brand,
                    cleanTokens,
                    params
                );

                const bucketKey = `${categoryPath}||${canonicalName}`;

                if (!buckets[bucketKey]) {
                    buckets[bucketKey] = {
                        category: [mainCat, subCat],
                        brand: brand || null,
                        canonicalName,
                        params,
                        shops: {},
                    };
                }

                if (!buckets[bucketKey].shops[shopName]) {
                    buckets[bucketKey].shops[shopName] = [];
                }

                const shopEntry = {
                    id:
                        item.id ||
                        item.configSku ||
                        item.catalogId ||
                        item.sku ||
                        null,
                    title: rawTitle,
                    price:
                        item.priceActual ||
                        item.unitSalePrice ||
                        item.unitPrice ||
                        item.price ||
                        null,
                    link:
                        item.shopLink ||
                        item.uri ||
                        item.reviewsLink ||
                        null,
                    raw: item,
                };

                buckets[bucketKey].shops[shopName].push(shopEntry);
            }
        }
    }

    // ---------- ВЫГРУЗКА ПО КАТЕГОРИЯМ ----------

    const byCategory = {};

    for (const bucket of Object.values(buckets)) {
        const catPath = bucket.category.join("/");
        if (!byCategory[catPath]) byCategory[catPath] = [];
        byCategory[catPath].push(bucket);
    }

    for (const [catPath, arr] of Object.entries(byCategory)) {
        const [mainCat, subCat] = catPath.split("/");
        const dir = path.join(OUTPUT_DIR, mainCat);
        ensureDir(dir);
        const outFile = path.join(dir, `${subCat}.json`);

        fs.writeFileSync(outFile, JSON.stringify(arr, null, 2), "utf8");
        console.log(
            `✔ category saved: ${catPath} → ${outFile} (${arr.length} товаров)`
        );
    }

    // ---------- СТАТИСТИКА ПО ПОСТАВЩИКАМ ----------

    const stats = {
        totalBuckets: 0,
        oneShop: 0,
        twoShops: 0,
        threeShops: 0,
        fourOrMore: 0,
    };

    for (const bucket of Object.values(buckets)) {
        stats.totalBuckets++;
        const shopCount = Object.keys(bucket.shops).length;

        if (shopCount === 1) stats.oneShop++;
        else if (shopCount === 2) stats.twoShops++;
        else if (shopCount === 3) stats.threeShops++;
        else if (shopCount >= 4) stats.fourOrMore++;
    }

    console.log("\n===== ОТЧЁТ ПО ПОСТАВЩИКАМ =====");
    console.log("Всего уникальных товаров (buckets):", stats.totalBuckets);
    console.log("С одним поставщиком:", stats.oneShop);
    console.log("С двумя поставщиками:", stats.twoShops);
    console.log("С тремя поставщиками:", stats.threeShops);
    console.log("С четырьмя и более поставщиками:", stats.fourOrMore);
    console.log("================================\n");

    console.log("Готово. Объединённые товары лежат в:", OUTPUT_DIR);
}

buildUnified();
