// arbuz-priority-mapper-with-logs.js
//
// 1) Обходит arbuz_data_almaty
// 2) Ищет соответствие категорий PRIORITY_TREE
// 3) Добавляет categories: []
// 4) Сохраняет товары в arbuz_need_data_almaty
// 5) Пишет логи:
//      - unmatched_categories.json
//      - unmatched_items.json
//

const fs = require("fs");
const path = require("path");

const INPUT_DIR = path.join(__dirname, "arbuz_data_almaty");
const OUTPUT_DIR = path.join(__dirname, "arbuz_need_data_almaty");
const LOG_DIR = path.join(__dirname, "arbuz_need_data_almaty_logs");

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

// -------------------------------------------------------

function walk(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) results.push(...walk(full));
        else if (entry.isFile() && entry.name.endsWith(".json")) results.push(full);
    }
    return results;
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function norm(s) {
    return (s || "").toLowerCase().replace(/ё/g, "е").trim();
}

function findCategoryMapping(cat1, cat2, cat3) {
    const tryCats = [cat3, cat2, cat1].filter(Boolean).map(norm);

    for (const [mainCat, subCats] of Object.entries(PRIORITY_TREE)) {
        const mainNorm = norm(mainCat);

        // поиск по подкатегориям
        for (const sub of Object.keys(subCats)) {
            const subNorm = norm(sub);

            for (const arb of tryCats) {
                if (arb.includes(subNorm) || subNorm.includes(arb)) {
                    return [mainCat, sub];
                }
            }
        }

        // поиск по главной категории (fallback)
        for (const arb of tryCats) {
            if (arb.includes(mainNorm) || mainNorm.includes(arb)) {
                return [mainCat, Object.keys(subCats)[0]];
            }
        }
    }

    return null;
}

// -------------------------------------------------------

function run() {
    ensureDir(OUTPUT_DIR);
    ensureDir(LOG_DIR);

    const unmatchedCategories = new Set();
    const unmatchedItems = [];

    const files = walk(INPUT_DIR);

    for (const file of files) {
        let items;

        try {
            items = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch {
            continue;
        }

        for (const item of items) {
            const add = item.additionalInformation || {};

            const cat1 = add.categoryLevel1;
            const cat2 = add.categoryLevel2;
            const cat3 = add.categoryLevel3;

            const match = findCategoryMapping(cat1, cat2, cat3);

            if (!match) {
                const catPath = [cat1, cat2, cat3].filter(Boolean).join(" / ");
                unmatchedCategories.add(catPath);

                unmatchedItems.push({
                    title: item.name || item.title,
                    categoryLevel1: cat1,
                    categoryLevel2: cat2,
                    categoryLevel3: cat3,
                    file
                });

                continue;
            }

            const [mainCat, subCat] = match;

            item.categories = [mainCat, subCat];

            const dir = path.join(OUTPUT_DIR, mainCat);
            ensureDir(dir);

            const filePath = path.join(dir, `${subCat}.json`);

            let arr = [];
            if (fs.existsSync(filePath)) {
                arr = JSON.parse(fs.readFileSync(filePath, "utf8"));
            }

            arr.push(item);

            fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), "utf8");
        }
    }

    // -----------------------
    // Сохраняем отчеты
    // -----------------------

    fs.writeFileSync(
        path.join(LOG_DIR, "unmatched_categories.json"),
        JSON.stringify([...unmatchedCategories], null, 2),
        "utf8"
    );

    fs.writeFileSync(
        path.join(LOG_DIR, "unmatched_items.json"),
        JSON.stringify(unmatchedItems, null, 2),
        "utf8"
    );

    console.log("✔ Готово");
    console.log("Логи →", LOG_DIR);
}

run();
