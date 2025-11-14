// aggregate-sequential.js
// Первый источник (Kaspi) формирует товары,
// остальные (Arbuz/Wolt) мёрджатся по штрих-коду, бренду, весу и схожести имени.

const fs = require("fs/promises");
const path = require("path");

// --------------------- 1. Входные файлы ---------------------

const milkKaspi = require("./kaspi_magnum/Молочные продукты, яйца/Молоко, сливки/Молоко, сливки.json");
const milkArbuz = require("./arbuz_data_almaty/Молоко, сыр и яйца/Молоко, сливки, сгущённое молоко/Молоко/Молоко.json");
const milkWolt = require("./wolt_data/Молочные продукты и яйца.json");

const SOURCES = [
    { name: "kaspi", items: milkKaspi },
    { name: "arbuz", items: milkArbuz },
    { name: "wolt", items: milkWolt },
];

const OUTPUT_DIR = path.join(__dirname, "normalizedResults");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "milk-aggregated-sequential.json");

// --------------------- 2. Утилиты ---------------------

function extractWeightGramsFromText(input) {
    if (!input) return null;
    const raw = String(input).toLowerCase().replace(",", ".");
    const text = raw.replace(/(\d+)(мл|ml|г|гр|кг|kg|l|л)/g, "$1 $2");

    let m = text.match(/(\d+(?:\.\d+)?)\s*(г|гр|грамм)/);
    if (m) return Math.round(parseFloat(m[1]));

    m = text.match(/(\d+(?:\.\d+)?)\s*(кг|kg)/);
    if (m) return Math.round(parseFloat(m[1]) * 1000);

    m = text.match(/(\d+(?:\.\d+)?)\s*(мл|ml|l|л)/);
    if (m) return Math.round(parseFloat(m[1]));

    return null;
}

/**
 * Полная очистка токенов:
 * - выкидываем весовые токены: "950", "мл", "950мл", "500г", "1kg"
 * - сохраняем жирность: "6%", "2.5%"
 * - удаляем техн. слова ("ультрапастеризованное")
 */
function normalizeNameTokens(name) {
    if (!name) return [];

    let s = name
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[",()]/g, " ")
        .replace(/(\d+)(мл|ml|г|гр|kg|кг|л|l)/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim();

    const rawTokens = s.split(" ").filter(Boolean);
    const tokens = [];

    const STOP_WORDS = new Set([
        "ультрапастеризованное",
        "пастеризованное",
        "стерилизованное",
        "концентрированное",
        "мл", "г", "гр", "кг", "kg", "l", "л"
    ]);

    for (let t of rawTokens) {
        t = t.trim();

        if (!t) continue;

        // чистые числа — это вес
        if (/^\d+$/.test(t)) continue;

        // слитные весовые (950мл, 500г, 1kg)
        if (/^\d+(мл|ml|г|гр|kg|кг|л|l)$/.test(t)) continue;

        if (STOP_WORDS.has(t)) continue;

        tokens.push(t);
    }

    return tokens;
}

function jaccardSimilarity(a, b) {
    const A = new Set(a);
    const B = new Set(b);

    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;

    const union = new Set([...A, ...B]).size;
    return union === 0 ? 0 : inter / union;
}

function brandFromRaw(raw, source) {
    if (source === "kaspi") return raw.brand || firstWord(raw.title);
    if (source === "arbuz") return raw.brandName || firstWord(raw.name);
    if (source === "wolt") return firstWord(raw.name);
    return firstWord(raw.name);
}

function firstWord(str) {
    if (!str) return null;
    const w = String(str).trim().split(/\s+/)[0];
    if (!w) return null;
    const l = w.toLowerCase();
    return l[0].toUpperCase() + l.slice(1);
}

function slugify(text) {
    if (!text) return "";
    return text
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[^a-z0-9\u0400-\u04FF]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

// --------------------- 3. Нормализация сырого item ---------------------

function normalizeRawItem(raw, source) {
    const name = raw.title || raw.name || "";
    const brand = brandFromRaw(raw, source);

    const weightGrams =
        extractWeightGramsFromText(name) ??
        extractWeightGramsFromText(raw.unit_info) ??
        extractWeightGramsFromText(raw.weight) ??
        (typeof raw.weight === "number" ? Math.round(raw.weight * 1000) : null);

    const tokens = normalizeNameTokens(name);

    let categorySlug = null;
    if (source === "kaspi") {
        if (Array.isArray(raw.categoryRu) && raw.categoryRu.length)
            categorySlug = slugify(raw.categoryRu.at(-1));
    } else if (source === "arbuz") {
        if (raw.additionalInformation?.categoryLevel3)
            categorySlug = slugify(raw.additionalInformation.categoryLevel3);
        else if (raw.catalogName) categorySlug = slugify(raw.catalogName);
    }

    // Нормализация Wolt цены (делим на 100)
    const price =
        source === "kaspi"
            ? raw.unitSalePrice ?? raw.unitPrice ?? null
            : source === "arbuz"
                ? raw.priceSpecial ?? raw.priceActual ?? null
                : source === "wolt"
                    ? typeof raw.price === "number"
                        ? Math.round(raw.price / 100)
                        : null
                    : null;

    const barcode =
        source === "kaspi"
            ? null
            : source === "arbuz"
                ? raw.barcode || null
                : source === "wolt"
                    ? raw.barcode_gtin || null
                    : null;

    return {
        source,
        externalId: String(raw.id ?? raw.configSku ?? ""),
        name,
        brand,
        brandNorm: (brand || "").toUpperCase().trim(),
        tokens,
        weightGrams: weightGrams || 0,
        categorySlug,
        barcode,
        price,
        url:
            source === "kaspi"
                ? raw.shopLink
                    ? `https://kaspi.kz${raw.shopLink}`
                    : null
                : source === "arbuz"
                    ? raw.uri
                        ? `https://arbuz.kz${raw.uri}`
                        : null
                    : null,
        image:
            source === "kaspi"
                ? raw.previewImages?.[0]?.medium ?? null
                : source === "arbuz"
                    ? raw.image?.replace("?w=%w&h=%h", "") ?? null
                    : source === "wolt"
                        ? raw.images?.[0]?.url ?? null
                        : null,
        raw,
    };
}

// --------------------- 4. Сравнение по весу ---------------------

function isWeightCompatible(w1, w2) {
    if (!w1 && !w2) return true;
    if (!w1 || !w2) return false;
    const diff = Math.abs(w1 - w2);
    const max = Math.max(10, w1 * 0.1);
    return diff <= max;
}

// --------------------- 5. Построение ID ---------------------

function buildCoreNameNorm(tokens, brandNorm) {
    const bn = (brandNorm || "").toLowerCase();
    const filtered = tokens.filter((t) => t.toLowerCase() !== bn);
    filtered.sort();
    return filtered.join("-");
}

function buildProductId(norm) {
    const core = buildCoreNameNorm(norm.tokens, norm.brandNorm);
    return `${norm.brandNorm}|${core}|${norm.weightGrams}`;
}

// --------------------- 6. Основная агрегация ---------------------

async function aggregateSequential() {
    const products = [];
    const NAME_SIM_THRESHOLD = 0.5;

    for (let index = 0; index < SOURCES.length; index++) {
        const { name: sourceName, items } = SOURCES[index];
        if (!items?.length) continue;

        console.log(`Источник: ${sourceName}, товаров: ${items.length}`);

        for (const raw of items) {
            const norm = normalizeRawItem(raw, sourceName);

            // ------------------- 6.1. Первый источник — создаём товары -------------------
            if (index === 0) {
                const id = buildProductId(norm);

                products.push({
                    id,
                    name: norm.name,
                    brand: norm.brand,
                    brandNorm: norm.brandNorm,
                    tokens: norm.tokens,
                    weightGrams: norm.weightGrams,
                    categorySlug: norm.categorySlug,
                    barcodes: norm.barcode ? [norm.barcode] : [],
                    suppliers: {
                        [sourceName]: {
                            externalId: norm.externalId,
                            price: norm.price,
                            url: norm.url,
                            image: norm.image,
                            raw: norm.raw,
                        },
                    },
                });

                continue;
            }

            // ------------------- 6.2. Поиск подходящего товара -------------------

            let best = null;
            let bestScore = 0;

            for (const p of products) {
                // 1) матч по баркоду — максимально точный
                if (norm.barcode && p.barcodes.includes(norm.barcode)) {
                    best = p;
                    bestScore = 999;
                    break;
                }

                // 2) бренд
                if (p.brandNorm && norm.brandNorm && p.brandNorm !== norm.brandNorm)
                    continue;

                // 3) вес
                if (!isWeightCompatible(p.weightGrams, norm.weightGrams)) continue;

                // 4) Jaccard по токенам имени
                const sim = jaccardSimilarity(p.tokens, norm.tokens);
                if (sim > bestScore) {
                    best = p;
                    bestScore = sim;
                }
            }

            // ------------------- 6.3. Мёрдж или создание нового -------------------

            if (best && bestScore >= NAME_SIM_THRESHOLD) {
                // мёрдж
                best.suppliers[sourceName] = {
                    externalId: norm.externalId,
                    price: norm.price,
                    url: norm.url,
                    image: norm.image,
                    raw: norm.raw,
                };
                if (norm.barcode && !best.barcodes.includes(norm.barcode))
                    best.barcodes.push(norm.barcode);

            } else {
                // создаём новый товар
                const id = buildProductId(norm);

                products.push({
                    id,
                    name: norm.name,
                    brand: norm.brand,
                    brandNorm: norm.brandNorm,
                    tokens: norm.tokens,
                    weightGrams: norm.weightGrams,
                    categorySlug: norm.categorySlug,
                    barcodes: norm.barcode ? [norm.barcode] : [],
                    suppliers: {
                        [sourceName]: {
                            externalId: norm.externalId,
                            price: norm.price,
                            url: norm.url,
                            image: norm.image,
                            raw: norm.raw,
                        },
                    },
                });
            }
        }
    }

    return products;
}

// --------------------- 7. Запуск ---------------------

(async () => {
    try {
        const aggregated = await aggregateSequential();

        await fs.mkdir(OUTPUT_DIR, { recursive: true });

        await fs.writeFile(
            OUTPUT_FILE,
            JSON.stringify(aggregated, null, 2),
            "utf8"
        );

        console.log("Готово. Товаров:", aggregated.length);
        console.log("Файл:", OUTPUT_FILE);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();

module.exports = { aggregateSequential };
