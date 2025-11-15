const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "kaspi_magnum");

// Возвращает объект (папка) или массив файлов
function buildCompactTree(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    const folders = {};
    const files = [];

    for (const entry of entries) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            folders[entry.name] = buildCompactTree(full); // рекурсия
        } else {
            files.push(entry.name);
        }
    }

    // если только файлы → вернуть массив
    if (Object.keys(folders).length === 0) {
        return files;
    }

    // если есть папки → прикрепить файлы как "_files"
    if (files.length > 0) {
        folders["_files"] = files;
    }

    return folders;
}

const tree = { ["kaspi_magnum"]: buildCompactTree(ROOT) };

fs.writeFileSync(
    path.join(__dirname, "kaspi_magnum_compact_tree.json"),
    JSON.stringify(tree, null, 2),
    "utf8"
);

console.log("Готово: kaspi_magnum_compact_tree.json создан");
