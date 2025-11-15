// strip-to-tree-need.js
//
// 1) обходит kaspi_magnum
// 2) токенизация + очистка
// 3) парсинг параметров
// 4) создаёт items_tokens
// 5) создаёт need_items_tokens (только приоритетные категории)
//

const fs = require("fs");
const path = require("path");

const KASPI_DIR = path.join(__dirname, "kaspi_magnum");
const BRANDS_FILE = path.join(__dirname, "normalizedResults/kaspi-category-brand-map.json");
const OUTPUT_DIR = path.join(__dirname, "items_tokens");
const NEED_OUTPUT_DIR = path.join(__dirname, "need_items_tokens");

// ------------------------------------------
// ПРИОРИТЕТНЫЕ КАТЕГОРИИ
// ------------------------------------------
const PRIORITY_TREE = {
    "Овощи, фрукты, ягоды, грибы": {
        "Зелень, салаты": true,
        "Овощи": true,
        "Фрукты": true,
        "Ягоды": true
    },
    "Мясо и птица": {
        "Мясные полуфабрикаты": true,
        "Мясо": true,
        "Птица": true,
        "Стейки": true,
        "Фарш": true,
        "Шашлык, колбаски": true
    },
    "Молочные продукты, яйца": {
        "Йогурты": true,
        "Кефир, Тан, Айран": true,
        "Масло, маргарин": true,
        "Молоко, сливки": true,
        "Сметана": true,
        "Сыры": true,
        "Творог": true,
        "Яйца": true
    },
    "Хлебные изделия": {
        "Лаваш, лепешки": true,
        "Нарезанный хлеб": true,
        "Хлеб": true
    },
    "Соки, вода, напитки": {
        "Вода": true,
        "Газировки, лимонады": true,
        "Соки, морсы": true
    },
    "Крупы, хлопья, макароны": {
        "Каши": true,
        "Крупы и бобовые": true,
        "Макароны": true,
        "Сухие завтраки": true
    },
    "Масла, соусы": {
        "Растительные масла": true,
        "Соусы, кетчупы": true,
        "Бульоны, заправки": true
    },
    "Колбасы, сосиски, деликатесы": {
        "Колбасы": true,
        "Сосиски": true
    }
};

// ------------------------------------------
const CATEGORY_BRANDS = JSON.parse(fs.readFileSync(BRANDS_FILE, "utf8"));

// ------------------------------------------
// УТИЛИТЫ
// ------------------------------------------
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

    if (params.percent) remove.add(params.percent);

    function addPair(pair) {
        if (!pair) return;
        const [num, unit] = pair.split(" ");
        remove.add(num);
        remove.add(unit);
    }

    addPair(params.volume);
    addPair(params.weight);
    addPair(params.count);

    if (params.pack) {
        remove.add(String(params.pack.packs));
        remove.add("по");
        remove.add(String(params.pack.perPack));
        remove.add(params.pack.unit);

        const LONG = ["упаковки", "упаковка", "пачки", "пачка", "пакета", "капсул", "капсула"];
        for (const w of LONG) remove.add(w);
    }

    if (params.age) {
        const parts = params.age.toLowerCase().split(/[\s\.]+/).filter(Boolean);
        for (const p of parts) remove.add(p);
        remove.add(parts.join("")); // 10yo
        remove.add(parts.join("") + "."); // 10y.o.
    }

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
            if (out.slice(i, i + L).join(" ") === pattern.join(" ")) {
                out.splice(i, L);
                i--;
            }
        }
    }

    return out;
}

// ------------------------------------------
// ПАРСЕР ПАРАМЕТРОВ
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

    const SHORT = new Set(["г", "гр", "мл", "л", "шт", "кг"]);
    const LONG = new Set(["упаковки", "упаковка", "пачки", "пачка", "пакета", "капсул", "капсула"]);

    let i = 0;

    while (i < tokens.length) {
        const t = tokens[i];
        const n1 = tokens[i + 1];
        const n2 = tokens[i + 2];
        const n3 = tokens[i + 3];
        const n4 = tokens[i + 4];

        if (/^\d+(\.\d+)?%$/.test(t)) {
            res.percent = t;
            finalTokens.push(t);
            i++;
            continue;
        }

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

        if (/^\d+$/.test(t) && n1 && /^(звезда|звезды|звезд)$/.test(n1)) {
            const stars = `${t} ${n1}`;
            res.stars = stars;
            finalTokens.push(stars);
            i += 2;
            continue;
        }

        if (/^\d+(\.\d+)?$/.test(t) && SHORT.has(n1)) {
            const pair = `${t} ${n1}`;
            if (["г", "гр", "кг"].includes(n1)) res.weight = pair;
            if (["мл", "л"].includes(n1)) res.volume = pair;
            if (n1 === "шт") res.count = pair;
            finalTokens.push(pair);
            i += 2;
            continue;
        }

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
// ОБХОД ФАЙЛОВ
// ------------------------------------------
function walk(dir) {
    const res = [];
    for (const e of fs.readdirSync(dir, { withwithFileTypes: true })) { }

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

// Проверка, относится ли категория к приоритетным
function isPriorityCategory(categoryPath) {
    const parts = categoryPath.split("/");
    if (parts.length < 2) return false;
    return PRIORITY_TREE[parts[0]] && PRIORITY_TREE[parts[0]][parts[1]];
}

// ------------------------------------------
// ОСНОВНОЙ КОД
// ------------------------------------------
function run() {
    const files = walk(KASPI_DIR);

    for (const file of files) {
        const category = getCategoryPath(file);
        const categoryParts = category.split("/");

        const brandList = CATEGORY_BRANDS[category] || [];

        // читаем JSON
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
            const cleanTokens = stripUsedParamTokens(tokens, params);

            out.push({
                original,
                cleanTokens,
                normalizedTokens,
                params
            });
        }

        // --------------------------------------
        // ЗАПИСЬ В items_tokens (всегда)
        // --------------------------------------
        const targetDir = path.join(OUTPUT_DIR, ...categoryParts);
        ensureDir(targetDir);

        const targetFile = path.join(targetDir, path.basename(file));
        fs.writeFileSync(targetFile, JSON.stringify(out, null, 2), "utf8");

        // --------------------------------------
        // ЗАПИСЬ В need_items_tokens (только приоритет)
        // --------------------------------------
        if (isPriorityCategory(category)) {
            const needDir = path.join(NEED_OUTPUT_DIR, ...categoryParts);
            ensureDir(needDir);

            const needFile = path.join(needDir, path.basename(file));
            fs.writeFileSync(needFile, JSON.stringify(out, null, 2), "utf8");
        }
    }

    console.log("✔ Готово. Данные сохранены в:", OUTPUT_DIR, "и", NEED_OUTPUT_DIR);
}

run();
