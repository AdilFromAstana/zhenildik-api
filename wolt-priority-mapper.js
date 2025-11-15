// wolt-priority-mapper.js
//
// 1) Обходит все файлы в wolt_data
// 2) Определяет основную категорию по имени файла
// 3) Определяет подкатегорию по названию товара
// 4) Создаёт структуру wolt_need_data/<main>/<sub>.json
// 5) Пишет unmatched_*.json логи
//

const fs = require("fs");
const path = require("path");

const INPUT_DIR = path.join(__dirname, "wolt_data");
const OUTPUT_DIR = path.join(__dirname, "wolt_need_data");
const LOG_DIR = path.join(__dirname, "wolt_need_data_logs");

// ------------------------------
// PRIORITY TREE
// ------------------------------
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

// ------------------------------
function ensureDir(d) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function norm(s) {
    return s.toLowerCase().replace(/ё/g, "е");
}

// ------------------------------
// 1. Привязка файла → основная категория
// ------------------------------
function findMapping(filename) {
    const clean = norm(filename.replace(".json", ""));

    for (const [mainCat, subs] of Object.entries(PRIORITY_TREE)) {
        const mainNorm = norm(mainCat);

        if (clean.includes(mainNorm)) {
            const firstSub = Object.keys(subs)[0];
            return [mainCat, firstSub];
        }

        for (const sub of Object.keys(subs)) {
            const subNorm = norm(sub);
            if (clean.includes(subNorm) || subNorm.includes(clean)) {
                return [mainCat, sub];
            }
        }
    }
    return null;
}

// ------------------------------
// 2. Определение подкатегории по названию товара
// ------------------------------
function detectSubcategory(mainCat, itemName) {
    const name = norm(itemName);

    if (mainCat === "Молочные продукты, яйца") {
        if (/молоко|сливк/.test(name)) return "Молоко, сливки";
        if (/кефир|айран|тан|ряженк/.test(name)) return "Кефир, Тан, Айран";
        if (/йогурт|yogurt/.test(name)) return "Йогурты";
        if (/сметан/.test(name)) return "Сметана";
        if (/сыр(?!н)/.test(name)) return "Сыры";
        if (/творог/.test(name)) return "Творог";
        if (/масло|маргарин|спред/.test(name)) return "Масло, маргарин";
        if (/яйц/.test(name)) return "Яйца";
        return null;
    }

    if (mainCat === "Овощи, фрукты, ягоды, грибы") {
        if (/укроп|петрушк|кинз|зелень|салат/.test(name)) return "Зелень, салаты";
        if (/яблок|груш|банан|манго|ананас|фрукт/.test(name)) return "Фрукты";
        if (/клубник|малин|ягод|черник|голубик/.test(name)) return "Ягоды";
        return "Овощи";
    }

    if (mainCat === "Мясо и птица") {
        if (/фарш/.test(name)) return "Фарш";
        if (/стейк/.test(name)) return "Стейки";
        if (/куриц|индейк|птиц/.test(name)) return "Птица";
        if (/шашлык|колбаск|гриль/.test(name)) return "Шашлык, колбаски";
        if (/полуфабрикат/.test(name)) return "Мясные полуфабрикаты";
        return "Мясо";
    }

    if (mainCat === "Соки, вода, напитки") {
        if (/вода/.test(name)) return "Вода";
        if (/лимонад|газировк/.test(name)) return "Газировки, лимонады";
        if (/сок|морс/.test(name)) return "Соки, морсы";
    }

    if (mainCat === "Хлебные изделия") {
        if (/лаваш|лепешк/.test(name)) return "Лаваш, лепешки";
        if (/нарезанн/.test(name)) return "Нарезанный хлеб";
        return "Хлеб";
    }

    if (mainCat === "Масла, соусы") {
        if (/масло|оливк/.test(name)) return "Растительные масла";
        if (/соус|кетчуп|аджик|майонез/.test(name)) return "Соусы, кетчупы";
        return "Бульоны, заправки";
    }

    if (mainCat === "Колбасы, сосиски, деликатесы") {
        if (/сосиск|сардель/.test(name)) return "Сосиски";
        return "Колбасы";
    }

    if (mainCat === "Крупы, хлопья, макароны") {
        if (/круп|греч|рис|бобов/.test(name)) return "Крупы и бобовые";
        if (/макарон|спагет/.test(name)) return "Макароны";
        if (/овсян|завтрак|хлоп/.test(name)) return "Сухие завтраки";
        return "Каши";
    }

    return null;
}

// ------------------------------
// ОСНОВНАЯ ФУНКЦИЯ
// ------------------------------
function run() {
    ensureDir(OUTPUT_DIR);
    ensureDir(LOG_DIR);

    const unmatchedCategories = [];
    const unmatchedItems = [];

    const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith(".json"));

    for (const file of files) {
        const full = path.join(INPUT_DIR, file);
        const raw = JSON.parse(fs.readFileSync(full, "utf8"));

        const mapping = findMapping(file);

        if (!mapping) {
            unmatchedCategories.push(file);
            unmatchedItems.push(...raw.map(r => ({ title: r.name, file })));
            continue;
        }

        const [mainCat, guessedSub] = mapping;

        const outDir = path.join(OUTPUT_DIR, mainCat);
        ensureDir(outDir);

        // Создаём сразу много файлов для каждой подкатегории — внутри цикла
        for (const item of raw) {
            let subCat = detectSubcategory(mainCat, item.name);

            if (!subCat) subCat = guessedSub;

            const outFile = path.join(outDir, `${subCat}.json`);

            let arr = [];
            if (fs.existsSync(outFile)) {
                arr = JSON.parse(fs.readFileSync(outFile, "utf8"));
            }

            item.categories = [mainCat, subCat];
            arr.push(item);

            fs.writeFileSync(outFile, JSON.stringify(arr, null, 2), "utf8");
        }

        console.log(`✔ ${file} → ${mainCat}`);
    }

    fs.writeFileSync(
        path.join(LOG_DIR, "unmatched_categories.json"),
        JSON.stringify(unmatchedCategories, null, 2),
        "utf8"
    );

    fs.writeFileSync(
        path.join(LOG_DIR, "unmatched_items.json"),
        JSON.stringify(unmatchedItems, null, 2),
        "utf8"
    );

    console.log("Готово →", OUTPUT_DIR);
}

run();
