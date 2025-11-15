// strip-to-tree.js
//
// Скрипт:
//  1) обходит папку kaspi_magnum
//  2) чистит название (категория + бренд)
//  3) собирает параметры: объем, вес, %, шт, упаковки
//  4) создает такую же структуру папок в items_tokens
//  5) сохраняет данные в файлы
//

const fs = require("fs");
const path = require("path");

const KASPI_DIR = path.join(__dirname, "kaspi_magnum");
const BRANDS_FILE = path.join(__dirname, "normalizedResults/kaspi-category-brand-map.json");
const OUTPUT_DIR = path.join(__dirname, "items_tokens");

const CATEGORY_BRANDS = JSON.parse(fs.readFileSync(BRANDS_FILE, "utf8"));

// -----------------------------
// УТИЛИТЫ
// -----------------------------
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

function stripCategoryWords(tokens, categoryPath) {
    const catTokens = categoryPath
        .toLowerCase()
        .replace(/ё/g, "е")
        .split(/[\/, ]+/)
        .filter(Boolean);

    const remove = new Set(catTokens);
    return tokens.filter(t => !remove.has(t));
}

function stripUsedParamTokens(tokens, params) {
    const remove = new Set();

    // процент
    if (params.percent) {
        remove.add(params.percent);
    }

    // объем или вес или count
    function addPair(pair) {
        if (!pair) return;
        const [num, unit] = pair.split(" ");
        remove.add(num);
        remove.add(unit);
    }

    addPair(params.volume);
    addPair(params.weight);
    addPair(params.count);

    // упаковки
    if (params.pack) {
        remove.add(String(params.pack.packs));

        // длинные единицы: упаковка / пачка / капсула
        const LONG = ["упаковки", "упаковка", "пачки", "пачка", "пакета", "капсул", "капсула"];
        for (const w of LONG) remove.add(w);

        remove.add("по");
        remove.add(String(params.pack.perPack));
        remove.add(params.pack.unit);
    }

    // возраст выдержки
    if (params.age) {
        const parts = params.age.toLowerCase().split(/[\s\.]+/).filter(Boolean);

        // удаляем отдельные части
        for (const p of parts) remove.add(p);

        // удаляем слитные варианты: 10yo, 10yrs, 12yearsold
        remove.add(parts.join(""));       // 10yo
        remove.add(parts.join("") + "."); // 10y.o.
    }

    // звезды коньяка
    if (params.stars) {
        const parts = params.stars.split(" ");
        for (const p of parts) remove.add(p.toLowerCase());
    }

    return tokens.filter(t => !remove.has(t));
}


function stripBrand(tokens, brandList) {
    if (!brandList?.length) return tokens;

    const normBrands = brandList.map(b => b.toLowerCase().replace(/ё/g, "е"));
    const patterns = normBrands.map(b => b.split(" "));

    let out = [...tokens];

    for (const pattern of patterns) {
        const L = pattern.length;
        for (let i = 0; i <= out.length - L; i++) {
            const slice = out.slice(i, i + L);
            if (slice.join(" ") === pattern.join(" ")) {
                out.splice(i, L);
                i--;
            }
        }
    }

    return out;
}

// ------------------------------------------
// ПАРСЕР ЧИСЛОВЫХ ПАРАМЕТРОВ
// ------------------------------------------
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

    const SHORT = new Set(["г", "гр", "мл", "л", "шт"]);
    const LONG = new Set(["упаковки", "упаковка", "пачки", "пачка", "пакета", "капсул", "капсула"]);

    let i = 0;

    while (i < tokens.length) {
        const t = tokens[i];
        const n1 = tokens[i + 1];
        const n2 = tokens[i + 2];
        const n3 = tokens[i + 3];
        const n4 = tokens[i + 4];

        // процент — крепость/жирность
        if (/^\d+(\.\d+)?%$/.test(t)) {
            res.percent = t;
            finalTokens.push(t);
            i++;
            continue;
        }

        // 1) "10 лет", "3 года"
        if (/^\d+$/.test(t) && (n1 === "лет" || n1 === "года")) {
            const age = `${t} ${n1}`;
            res.age = age;
            finalTokens.push(age);
            i += 2;
            continue;
        }

        // 2) "10yo", "10YO", "10y.o.", "10Y.O."
        if (/^\d+(yo|y\.o\.?)$/i.test(t)) {
            const num = t.match(/\d+/)[0];
            const age = `${num} YO`;
            res.age = age;
            finalTokens.push(age);
            i++;
            continue;
        }

        // 3) "10 YO", "10 Y.O."
        if (/^\d+$/.test(t) && n1 && /^(yo|y\.o\.?)$/i.test(n1)) {
            const age = `${t} ${n1.toUpperCase().replace(/Y\.O\.$/, "Y.O.")}`;
            res.age = age;
            finalTokens.push(age);
            i += 2;
            continue;
        }

        // 4) "10 years", "12 year", "12 yrs"
        if (/^\d+$/.test(t) && n1 && /^(years?|yrs?)$/.test(n1)) {
            let age = `${t} ${n1}`;
            // вариант "12 years old"
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

        // 5) "aged 12 years", "aged 8 yo"
        if (t === "aged" && /^\d+$/.test(n1)) {
            // aged 8 YO
            if (/^(yo|y\.o\.?)$/i.test(n2)) {
                const age = `${n1} YO`;
                res.age = age;
                finalTokens.push(age);
                i += 3;
                continue;
            }
            // aged 12 years / aged 12 year / aged 12 yrs
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

        // коньяк: 3 звезды / 5 звезд / 1 звезда
        if (/^\d+$/.test(t) && n1 && /^(звезда|звезды|звезд)$/.test(n1)) {
            const stars = `${t} ${n1}`;
            res.stars = stars;
            finalTokens.push(stars);
            i += 2;
            continue;
        }

        // число + короткая единица
        if (/^\d+(\.\d+)?$/.test(t) && SHORT.has(n1)) {
            const pair = `${t} ${n1}`;

            if (["г", "гр"].includes(n1)) res.weight = pair;
            if (["мл", "л"].includes(n1)) res.volume = pair;
            if (n1 === "шт") res.count = pair;

            finalTokens.push(pair);
            i += 2;
            continue;
        }

        // число + длинная единица + "по ..." (упаковки)
        if (/^\d+$/.test(t) && LONG.has(n1)) {
            if (n2 === "по" && /^\d+$/.test(n3) && SHORT.has(n4)) {
                res.pack = {
                    packs: Number(t),
                    perPack: Number(n3),
                    unit: n4
                };

                finalTokens.push(`${t} ${n1} по ${n3} ${n4}`);
                i += 5;
                continue;
            }

            finalTokens.push(`${t} ${n1}`);
            i += 2;
            continue;
        }

        // слитное: 750мл, 1л
        if (/^\d+(мл|л)$/.test(t)) {
            const num = t.replace(/(мл|л)/, "");
            const unit = t.endsWith("л") ? "л" : "мл";
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

// ------------------------------------------
// Обход файлов
// ------------------------------------------
function walk(dir) {
    const res = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) res.push(...walk(full));
        else if (e.isFile() && e.name.endsWith(".json")) res.push(full);
    }
    return res;
}

function getCategoryPath(pathFile) {
    const parts = pathFile.split(path.sep);
    const idx = parts.indexOf("kaspi_magnum");
    return parts.slice(idx + 1, parts.length - 1).join("/");
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ------------------------------------------
// Основной код
// ------------------------------------------
function run() {
    const files = walk(KASPI_DIR);

    for (const file of files) {
        const category = getCategoryPath(file);
        const categoryParts = category.split("/");

        const targetDir = path.join(OUTPUT_DIR, ...categoryParts);
        ensureDir(targetDir);

        const fileName = path.basename(file);
        const targetFile = path.join(targetDir, fileName);

        const brandList = CATEGORY_BRANDS[category] || [];

        let items;
        try {
            items = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch {
            continue;
        }

        const out = [];

        for (const item of items) {
            const original = item.title || item.name || "";
            let tokens = tokenize(original);

            tokens = stripCategoryWords(tokens, category);
            tokens = stripBrand(tokens, brandList);

            const { normalizedTokens, params } = parseStructuredParams(tokens);

            // ❗ Новый шаг — очищаем от параметров
            const cleanTokens = stripUsedParamTokens(tokens, params);

            out.push({
                original,
                cleanTokens,
                normalizedTokens,
                params
            });
        }


        fs.writeFileSync(targetFile, JSON.stringify(out, null, 2), "utf8");
    }

    console.log("Готово. Данные сохранены в:", OUTPUT_DIR);
}

run();
