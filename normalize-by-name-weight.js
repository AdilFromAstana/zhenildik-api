// aggregate-sequential.js
// Скрипт: первый источник (Kaspi) -> базовые товары,
// затем Arbuz / Wolt подвязываются как поставщики по похожести имени + веса.

const fs = require('fs/promises');
const path = require('path');

// ---------- 1. Подключаешь нужные файлы здесь ----------

const milkKaspi = require('./kaspi_magnum/Молочные продукты, яйца/Молоко, сливки/Молоко, сливки.json');
const milkArbuz = require('./arbuz_data_almaty/Молоко, сыр и яйца/Молоко, сливки, сгущённое молоко/Молоко/Молоко.json');
const milkWolt = require('./wolt_data/Молочные продукты и яйца.json');

// Порядок важен: первый – базовый источник
const SOURCES = [
    { name: 'kaspi', items: milkKaspi },
    { name: 'arbuz', items: milkArbuz },
    { name: 'wolt', items: milkWolt },
];

const OUTPUT_DIR = path.join(__dirname, 'normalizedResults');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'milk-aggregated-sequential.json');

// ---------- 2. Утилиты для веса / токенов / бренда ----------

function extractWeightGramsFromText(input) {
    if (!input) return null;
    const raw = String(input).toLowerCase().replace(',', '.');

    // добавили авто-разделение
    const text = raw.replace(/(\d+)(мл|ml|г|гр|кг|kg)/g, '$1 $2');

    let m = text.match(/(\d+(?:\.\d+)?)\s*(г|гр|грамм)/);
    if (m) return Math.round(parseFloat(m[1]));

    m = text.match(/(\d+(?:\.\d+)?)\s*(кг|kg)/);
    if (m) return Math.round(parseFloat(m[1]) * 1000);

    m = text.match(/(\d+(?:\.\d+)?)\s*(мл|ml)/);
    if (m) return Math.round(parseFloat(m[1]));

    return null;
}

function normalizeNameTokens(name) {
    if (!name) return [];

    let s = name
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[",()]/g, ' ')
        .replace(/(\d+)(мл|ml|г|гр|kg|кг)/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim();

    let tokens = s.split(' ').filter(Boolean);

    const STOP_WORDS = new Set([
        'ультрапастеризованное',
        'пастеризованное',
        'стерилизованное',
        'концентрированное',
        'мл'
    ]);

    return tokens.filter(t => !STOP_WORDS.has(t));
}


function jaccardSimilarity(tokensA, tokensB) {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    let intersection = 0;
    for (const t of setA) if (setB.has(t)) intersection++;

    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}

function brandFromRaw(raw, source) {
    if (source === 'kaspi') {
        return raw.brand || firstWord(raw.title);
    }
    if (source === 'arbuz') {
        return raw.brandName || firstWord(raw.name);
    }
    if (source === 'wolt') {
        return firstWord(raw.name);
    }
    return firstWord(raw.title || raw.name);
}

function firstWord(str) {
    if (!str) return null;
    const w = String(str).trim().split(/\s+/)[0];
    if (!w) return null;
    const lower = w.toLowerCase();
    return lower[0].toUpperCase() + lower.slice(1);
}

function slugify(text) {
    if (!text) return '';
    let s = text.toLowerCase().replace(/ё/g, 'е');
    s = s.replace(/[^a-z0-9\u0400-\u04FF]+/g, '-');
    s = s.replace(/-+/g, '-');
    s = s.replace(/^-|-$/g, '');
    return s;
}

// ---------- 3. Нормализация одного raw-объекта ----------

function normalizeRawItem(raw, source) {
    const name = raw.title || raw.name || '';
    const brand = brandFromRaw(raw, source);

    const weightGrams =
        extractWeightGramsFromText(name) ??
        extractWeightGramsFromText(raw.unit_info) ??
        extractWeightGramsFromText(raw.weight) ??
        (typeof raw.weight === 'number' ? Math.round(raw.weight * 1000) : null);

    const tokens = normalizeNameTokens(name);

    // категория — опционально, на матчинг не влияет
    let categorySlug = null;
    if (source === 'kaspi') {
        if (Array.isArray(raw.categoryRu) && raw.categoryRu.length) {
            categorySlug = slugify(raw.categoryRu[raw.categoryRu.length - 1]);
        }
    } else if (source === 'arbuz') {
        if (
            raw.additionalInformation &&
            raw.additionalInformation.categoryLevel3
        ) {
            categorySlug = slugify(raw.additionalInformation.categoryLevel3);
        } else if (raw.catalogName) {
            categorySlug = slugify(raw.catalogName);
        }
    }

    // базовая нормализованная структура
    return {
        source,
        externalId: String(raw.id ?? raw.configSku ?? ''),
        name,
        brand,
        brandNorm: (brand || '').toUpperCase().trim(),
        tokens,
        weightGrams: weightGrams || 0,
        categorySlug,
        price:
            source === 'kaspi'
                ? typeof raw.unitSalePrice === 'number'
                    ? raw.unitSalePrice
                    : typeof raw.unitPrice === 'number'
                        ? raw.unitPrice
                        : null
                : source === 'arbuz'
                    ? typeof raw.priceSpecial === 'number'
                        ? raw.priceSpecial
                        : typeof raw.priceActual === 'number'
                            ? raw.priceActual
                            : null
                    : source === 'wolt'
                        ? typeof raw.price === 'number'
                            ? raw.price
                            : null
                        : null,
        url:
            source === 'kaspi'
                ? raw.shopLink
                    ? `https://kaspi.kz${raw.shopLink}`
                    : null
                : source === 'arbuz'
                    ? raw.uri
                        ? `https://arbuz.kz${raw.uri}`
                        : null
                    : null,
        image:
            source === 'kaspi'
                ? raw.previewImages &&
                    raw.previewImages[0] &&
                    raw.previewImages[0].medium
                    ? raw.previewImages[0].medium
                    : null
                : source === 'arbuz'
                    ? raw.image
                        ? raw.image.replace('?w=%w&h=%h', '')
                        : null
                    : source === 'wolt'
                        ? raw.images && raw.images[0] && raw.images[0].url
                            ? raw.images[0].url
                            : null
                        : null,
        raw,
    };
}

// ---------- 4. Сравнение по весу ----------

function isWeightCompatible(w1, w2) {
    if (!w1 && !w2) return true;
    if (!w1 || !w2) return false;
    const diff = Math.abs(w1 - w2);
    const maxAllowed = Math.max(10, w1 * 0.1); // +/-10 г или 10%
    return diff <= maxAllowed;
}

// ---------- 5. Построение id товара ----------
// Без категорий — только бренд + "ядро имени" + вес.

function buildCoreNameNorm(tokens, brandNorm) {
    // убираем бренд из токенов
    const bn = (brandNorm || '').toLowerCase();
    const filtered = tokens.filter((t) => t.toLowerCase() !== bn);
    filtered.sort();
    return filtered.join('-');
}

function buildProductId(norm) {
    const core = buildCoreNameNorm(norm.tokens, norm.brandNorm);
    const weight = norm.weightGrams || 0;
    return `${norm.brandNorm || 'NOBRAND'}|${core}|${weight}`;
}

// ---------- 6. Основная агрегация по массивам ----------

async function aggregateSequential() {
    const products = []; // итоговые товары
    const NAME_SIM_THRESHOLD = 0.5; // можно поднять/опустить по опыту

    // для ускорения поиска: массив тех же products, но с токенами и brandNorm
    // product: { id, name, brand, brandNorm, tokens, weightGrams, categorySlug, barcodes, suppliers }

    for (let index = 0; index < SOURCES.length; index++) {
        const { name: sourceName, items } = SOURCES[index];

        if (!items || !items.length) continue;

        console.log(`Обработка источника: ${sourceName}, всего: ${items.length}`);

        for (const raw of items) {
            const norm = normalizeRawItem(raw, sourceName);

            // --- Первый источник: создаём базу ---
            if (index === 0) {
                const productId = buildProductId(norm);

                const product = {
                    id: productId,
                    name: norm.name,
                    brand: norm.brand,
                    brandNorm: norm.brandNorm,
                    tokens: norm.tokens,
                    weightGrams: norm.weightGrams,
                    categorySlug: norm.categorySlug,
                    barcodes: [], // баркоды сейчас не используем
                    suppliers: {
                        [sourceName]: {
                            externalId: norm.externalId,
                            price: norm.price,
                            url: norm.url,
                            image: norm.image,
                            raw: norm.raw,
                        },
                    },
                };

                products.push(product);
                continue;
            }

            // --- Остальные источники: ищем лучший матч среди products ---
            let best = null;
            let bestScore = 0;

            for (const p of products) {
                // бренд должен совпадать (нормализованно)
                if (p.brandNorm && norm.brandNorm && p.brandNorm !== norm.brandNorm) {
                    continue;
                }

                // вес должен быть совместим
                if (!isWeightCompatible(p.weightGrams, norm.weightGrams)) {
                    continue;
                }

                const sim = jaccardSimilarity(p.tokens, norm.tokens);
                if (sim > bestScore) {
                    bestScore = sim;
                    best = p;
                }
            }

            if (best && bestScore >= NAME_SIM_THRESHOLD) {
                // добавляем поставщика в существующий товар
                best.suppliers[sourceName] = {
                    externalId: norm.externalId,
                    price: norm.price,
                    url: norm.url,
                    image: norm.image,
                    raw: norm.raw,
                };
            } else {
                // создаём новый товар (для этого источника не нашлось пары)
                const productId = buildProductId(norm);

                const product = {
                    id: productId,
                    name: norm.name,
                    brand: norm.brand,
                    brandNorm: norm.brandNorm,
                    tokens: norm.tokens,
                    weightGrams: norm.weightGrams,
                    categorySlug: norm.categorySlug,
                    barcodes: [],
                    suppliers: {
                        [sourceName]: {
                            externalId: norm.externalId,
                            price: norm.price,
                            url: norm.url,
                            image: norm.image,
                            raw: norm.raw,
                        },
                    },
                };

                products.push(product);
            }
        }
    }

    return products;
}

// ---------- 7. Запуск и запись в файл ----------

(async () => {
    try {
        const aggregated = await aggregateSequential();

        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        await fs.writeFile(
            OUTPUT_FILE,
            JSON.stringify(aggregated, null, 2),
            'utf8',
        );

        console.log('Готово. Товаров в результате:', aggregated.length);
        console.log('Файл:', OUTPUT_FILE);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();

// если нужно переиспользовать из других модулей
module.exports = {
    aggregateSequential,
};
