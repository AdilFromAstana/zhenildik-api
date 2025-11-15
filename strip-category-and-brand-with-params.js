// strip-category-and-brand-with-params.js
// -----------------------------------------------------------
// 1) Обходит kaspi_magnum
// 2) Удаляет категорию и бренд
// 3) Объединяет числовые параметры ("200 г", "0.7 л", "3 упаковки по 10 шт")
// 4) Выделяет volume/weight/count/pack/alcoholPercent
// 5) Сохраняет всё в JSON
// -----------------------------------------------------------

const fs = require("fs");
const path = require("path");

const KASPI_DIR = path.join(__dirname, "kaspi_magnum");
const BRANDS_FILE = path.join(__dirname, "normalizedResults/kaspi-category-brand-map.json");
const OUTPUT = path.join(__dirname, "normalizedResults/stripped-tokens-with-params.json");

const CATEGORY_BRANDS = JSON.parse(fs.readFileSync(BRANDS_FILE, "utf-8"));

// -----------------------------------------------------------
// УТИЛИТЫ
// -----------------------------------------------------------

// токены
function tokenize(str) {
    return str
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[",()]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .filter(Boolean);
}

// удаление слов категории
function stripCategoryWords(tokens, category) {
    const catTokens = category
        .toLowerCase()
        .replace(/ё/g, "е")
        .split(/[\/, ]+/)
        .filter(Boolean);

    const set = new Set(catTokens);
    return tokens.filter(t => !set.has(t));
}

// удаление брендов из tokens
function stripBrand(tokens, brandList) {
    if (!brandList?.length) return tokens;

    const normalized = brandList.map(b =>
        b.toLowerCase().replace(/ё/g, "е")
    );

    const patterns = normalized.map(b => b.split(" "));

    let newTokens = [...tokens];

    for (const pattern of patterns) {
        const len = pattern.length;
        for (let i = 0; i <= newTokens.length - len; i++) {
            const slice = newTokens.slice(i, i + len);
            if (slice.join(" ") === pattern.join(" ")) {
                newTokens.splice(i, len);
                i--;
            }
        }
    }

    return newTokens;
}

// -----------------------------------------------------------
// НОВЫЙ МОДУЛЬ — парсер числовых параметров
// -----------------------------------------------------------

function parseStructuredParams(tokens) {
    const result = {
        volume: null,        // "0.75 л"
        weight: null,        // "200 г"
        count: null,         // "10 шт"
        pack: null,          // { packs, perPack, unit }
        alcoholPercent: null // "40%"
    };

    const UNIT_SHORT = new Set(["г", "гр", "мл", "л", "шт"]);
    const UNIT_LONG = new Set(["упаковки", "упаковка", "пачки", "пачка", "пакета", "капсул", "капсула"]);

    const finalTokens = [];

    let i = 0;

    while (i < tokens.length) {
        const t = tokens[i];
        const n1 = tokens[i + 1];
        const n2 = tokens[i + 2];
        const n3 = tokens[i + 3];
        const n4 = tokens[i + 4];

        // ---------------------------------------------------
        // ПРОЦЕНТЫ — алкоголь / жирность
        // ---------------------------------------------------
        if (/^\d+(\.\d+)?%$/.test(t)) {
            result.alcoholPercent = t;
            finalTokens.push(t);
            i++;
            continue;
        }

        // ---------------------------------------------------
        // число + короткая единица (200 г, 0.75 л, 10 шт)
        // ---------------------------------------------------
        if (/^\d+(\.\d+)?$/.test(t) && UNIT_SHORT.has(n1)) {
            const pair = `${t} ${n1}`;

            if (n1 === "г" || n1 === "гр") result.weight = pair;
            if (n1 === "мл" || n1 === "л") result.volume = pair;
            if (n1 === "шт") result.count = pair;

            finalTokens.push(pair);
            i += 2;
            continue;
        }

        // ---------------------------------------------------
        // число + длинная единица: "3 упаковки по 10 шт"
        // ---------------------------------------------------
        if (/^\d+$/.test(t) && UNIT_LONG.has(n1)) {
            if (n2 === "по" && /^\d+$/.test(n3) && UNIT_SHORT.has(n4)) {
                result.pack = {
                    packs: Number(t),
                    perPack: Number(n3),
                    unit: n4
                };
                finalTokens.push(`${t} ${n1} по ${n3} ${n4}`);
                i += 5;
                continue;
            }

            // просто "3 упаковки"
            finalTokens.push(`${t} ${n1}`);
            i += 2;
            continue;
        }

        // ---------------------------------------------------
        // слитный формат: "750мл"
        // ---------------------------------------------------
        if (/^\d+(мл|л)$/.test(t)) {
            const num = t.replace(/(мл|л)$/, "");
            const unit = t.endsWith("л") ? "л" : "мл";
            const pair = `${num} ${unit}`;

            result.volume = pair;
            finalTokens.push(pair);
            i++;
            continue;
        }

        // ---------------------------------------------------
        // обычный токен
        // ---------------------------------------------------
        finalTokens.push(t);
        i++;
    }

    return { normalizedTokens: finalTokens, params: result };
}

// -----------------------------------------------------------
// Рекурсивный обход всех файлов
// -----------------------------------------------------------
function walk(dir) {
    const result = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) result.push(...walk(full));
        else if (entry.isFile() && entry.name.endsWith(".json")) result.push(full);
    }
    return result;
}

function getCategoryPath(fullPath) {
    const parts = fullPath.split(path.sep);
    const idx = parts.indexOf("kaspi_magnum");
    return parts.slice(idx + 1, parts.length - 1).join("/");
}

// -----------------------------------------------------------
// ОСНОВНАЯ ЛОГИКА
// -----------------------------------------------------------

function processAll() {
    const files = walk(KASPI_DIR);
    const output = {};

    for (const file of files) {
        let category = getCategoryPath(file);

        // ВАЖНО: заменяем Windows \ на Unix /
        category = category.replace(/\\/g, "/");
        const brandList = CATEGORY_BRANDS[category] || [];

        let items = [];
        try {
            items = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch {
            continue;
        }

        output[category] ??= [];

        for (const item of items) {
            const original = item.title || item.name || "";
            let tokens = tokenize(original);

            tokens = stripCategoryWords(tokens, category);
            tokens = stripBrand(tokens, brandList);

            const { normalizedTokens, params } = parseStructuredParams(tokens);

            output[category].push({
                original,
                cleanTokens: tokens,
                normalizedTokens,
                params
            });
        }
    }

    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), "utf8");

    process.on("uncaughtException", (e) => {
        console.error("UNCAUGHT ERROR:", e);
    });
    process.on("unhandledRejection", (e) => {
        console.error("UNHANDLED PROMISE:", e);
    });
    console.log("STARTED strip-category-and-brand-with-params.js");

    console.log("Готово →", OUTPUT);
}

processAll();
