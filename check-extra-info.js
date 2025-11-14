const products = require('./normalizedResults/milk-normalized.json');

// товары, где extraInfo содержит данные из нескольких магазинов
const withMultipleSources = products.filter((p) => {
    const keys = Object.keys(p.extraInfo || {});
    return keys.length > 1;
});

// товары, где только один магазин
const withSingleSource = products.filter((p) => {
    const keys = Object.keys(p.extraInfo || {});
    return keys.length === 1;
});

// товары, где extraInfo вообще пустой или отсутствует
const withoutSources = products.filter((p) => {
    const keys = Object.keys(p.extraInfo || {});
    return keys.length === 0;
});

console.log('> Несколько источников:', withMultipleSources.length);
console.log('> Один источник:', withSingleSource.length);
console.log('> Нет источников:', withoutSources.length);

// при желании вывести сами объекты:
console.log(JSON.stringify(withMultipleSources, null, 2));
