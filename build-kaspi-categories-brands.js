// build-kaspi-categories-brands.js
// Проход по всей папке kaspi_magnum и сбор категорий с брендами

const fs = require("fs/promises");
const path = require("path");

const KASPI_ROOT = path.join(__dirname, "kaspi_magnum");
const OUTPUT = path.join(__dirname, "normalizedResults", "kaspi-category-brand-map.json");

// ------------------------ УТИЛИТЫ ------------------------

function firstWord(str) {
    if (!str) return null;
    const w = str.trim().split(/\s+/)[0];
    return w[0].toUpperCase() + w.slice(1).toLowerCase();
}

function extractBrand(raw) {
    if (raw.brand) return raw.brand;
    if (raw.title) return firstWord(raw.title);
    return null;
}

async function readJsonSafe(file) {
    try {
        const txt = await fs.readFile(file, "utf8");
        return JSON.parse(txt);
    } catch {
        return null;
    }
}

// ------------------------ ОБХОД ПАПОК ------------------------

/**
 * Рекурсивно ходим по папке kaspi_magnum,
 * собираем все JSON и строим категории вида:
 *   ГлавнаяКатегория/Подкатегория1/Подкатегория2
 */
async function scanKaspiFolder(dir, parentParts = []) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    const result = {};

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            const subParts = [...parentParts, entry.name];
            const sub = await scanKaspiFolder(fullPath, subParts);
            Object.assign(result, sub);
        }

        if (entry.isFile() && entry.name.endsWith(".json")) {
            const json = await readJsonSafe(fullPath);
            if (!json) continue;

            const categoryPath = parentParts.join("/");
            if (!categoryPath) continue;

            if (!result[categoryPath]) result[categoryPath] = new Set();

            for (const item of json) {
                const brand = extractBrand(item);
                if (brand) result[categoryPath].add(brand);
            }
        }
    }

    return result;
}

// ------------------------ ОСНОВНОЙ ЗАПУСК ------------------------

(async () => {
    try {
        console.log("Сканирую папку:", KASPI_ROOT);

        const map = await scanKaspiFolder(KASPI_ROOT);

        // превращаем Set → Array
        const final = {};
        for (const cat of Object.keys(map)) {
            final[cat] = Array.from(map[cat]).sort();
        }

        await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
        await fs.writeFile(OUTPUT, JSON.stringify(final, null, 2), "utf8");

        console.log("Готово!");
        console.log("Файл:", OUTPUT);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
