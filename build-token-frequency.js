// build-token-frequency.js — выводит ТОКЕНЫ В МАССИВЕ по убыванию
//
// 1) Обходит items_tokens
// 2) Считает частоты
// 3) Фильтрует мусор
// 4) Сохраняет => массив вида:
//    [
//      { token: "0.75 л", count: 958 },
//      { token: "сухое", count: 728 },
//      ...
//    ]

const fs = require("fs");
const path = require("path");

const INPUT_DIR = path.join(__dirname, "need_items_tokens");
const OUTPUT = path.join(
    __dirname,
    "normalizedResults",
    "token-frequency-by-category.json"
);

const STOPWORDS = new Set([
    "&", "-", "_",
    "de", "di", "do", "da", "du", "del",
    "la", "le", "il", "el",
    "the", "of", "and",
    "x", "v", "s", "a"
]);

function isGarbageToken(t) {
    if (/^\d+$/.test(t)) {
        const num = Number(t);
        if (num > 1900) return true;
        if (num <= 10) return false;
        return true;
    }

    if (/^\d+(\.\d+)?%$/.test(t)) return false;
    if (/^\d+(\.\d+)?\s*(л|ml|мл|г)$/.test(t)) return false;

    if (STOPWORDS.has(t)) return true;
    if (t.length === 1) return true;

    return false;
}

function walk(dir) {
    const result = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) result.push(...walk(full));
        else if (entry.isFile() && entry.name.endsWith(".json")) {
            result.push(full);
        }
    }
    return result;
}

function getCategoryKey(fullPath) {
    const parts = fullPath.split(path.sep);
    const idx = parts.indexOf("need_items_tokens");
    return parts.slice(idx + 1, parts.length - 1).join("/");
}

function processAll() {
    const files = walk(INPUT_DIR);
    const output = {};

    for (const file of files) {
        const category = getCategoryKey(file);

        const items = JSON.parse(fs.readFileSync(file, "utf8"));
        const freq = {};

        for (const it of items) {
            const tokens = it.cleanTokens || [];

            for (const tok of tokens) {
                const t = tok.trim().toLowerCase();

                if (isGarbageToken(t)) continue;

                if (!freq[t]) freq[t] = 0;
                freq[t]++;
            }
        }

        // превращаем в массив
        const sortedArray = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .map(([token, count]) => ({ token, count }));

        output[category] = sortedArray;
    }

    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), "utf8");

    console.log("Готово →", OUTPUT);
}

processAll();
