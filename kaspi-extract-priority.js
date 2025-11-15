// kaspi-extract-priority.js
//
// 1) Обходит все файлы в kaspi_magnum
// 2) Проверяет, входит ли path в PRIORITY_TREE
// 3) Копирует файлы в kaspi_need_data (с сохранением структуры папок)
//

const fs = require("fs");
const path = require("path");

const INPUT_DIR = path.join(__dirname, "kaspi_magnum");
const OUTPUT_DIR = path.join(__dirname, "kaspi_need_data");

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


// -----------------------------------------------

function walk(dir) {
    const files = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) files.push(...walk(full));
        else if (e.isFile() && e.name.endsWith(".json")) files.push(full);
    }
    return files;
}

function ensureDir(d) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function getCategoryPath(filePath) {
    const parts = filePath.split(path.sep);
    const idx = parts.indexOf("kaspi_magnum");
    return parts.slice(idx + 1, parts.length - 1); // ["Молочные продукты, яйца", "Молоко, сливки"]
}

function isPriority(main, sub) {
    return PRIORITY_TREE[main] && PRIORITY_TREE[main][sub];
}

// -----------------------------------------------

function run() {
    ensureDir(OUTPUT_DIR);

    const files = walk(INPUT_DIR);

    for (const file of files) {
        const parts = getCategoryPath(file);
        if (parts.length < 2) continue;

        const mainCat = parts[0];
        const subCat = parts[1];

        if (!isPriority(mainCat, subCat)) continue;

        const relPath = parts.join(path.sep);
        const targetDir = path.join(OUTPUT_DIR, relPath);
        ensureDir(targetDir);

        const targetFile = path.join(targetDir, path.basename(file));

        fs.copyFileSync(file, targetFile);

        console.log(`✔ Сохранено: ${mainCat} / ${subCat} → ${path.basename(file)}`);
    }

    console.log("\nГотово. Файлы лежат в:", OUTPUT_DIR);
}

run();
