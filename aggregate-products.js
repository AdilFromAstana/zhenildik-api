// aggregate-products.js
const fs = require('fs/promises');
const path = require('path');

// Предполагается, что этот файл существует и экспортирует kaspiCategoryTree
// const kaspiCategoryTree = require('./kaspiCategoryTree'); 
// Заглушка, если файла нет, чтобы избежать ошибки
const kaspiCategoryTree = {};

// -------------------- Загрузка данных (замените пути на свои) --------------------
// const milkKaspi = require('./kaspi_magnum/Молочные продукты, яйца/Молоко, сливки/Молоко, сливки.json');
// const milkArbuz = require('./arbuz_data_almaty/Молоко, сыр и яйца/Молоко, сливки, сгущённое молоко/Молоко/Молоко.json');
// const milkWolt = require('./wolt_data/Молочные продукты и яйца.json');

// ЗАГЛУШКА ДЛЯ ПРИМЕРА (чтобы код запускался без реальных файлов)
const milkKaspi = [];
const milkArbuz = [];
const milkWolt = [];

// -------------------- Стоп-слова для coreNameNorm --------------------

const STOP_WORDS = new Set([
  'концентрированное',
  'ультрапастеризованное',
  'стерилизованное',
  'питьевое',
  'отборное',
  'фермерское',
]);

// -------------------- Категории и Фильтры --------------------

// Определяем, какие характеристики важны для конкретной категории,
// чтобы включать их в buildProductKey.
const CATEGORY_FILTERS_MAP = {
  'condensed-milk': ['fatPercentage'], // Добавлено явно для приоритета
  'milk': ['fatPercentage'],
  'kefir': ['fatPercentage'],
  'yogurt': ['fatPercentage'],
  'cottage-cheese': ['fatPercentage'],
  'sour-cream': ['fatPercentage'],
  'cheese': ['fatPercentage'], // Убрал cheeseType, так как нет функции извлечения
  'butter': ['fatPercentage'],

  'alcohol': ['alcVolume'], // Убрал colorType, так как нет функции извлечения
  'beer': ['alcVolume'],

  'juice': ['volumeMl'],
  'water': ['volumeMl', 'waterType'], // Убрал waterType, так как нет функции извлечения
  'tea': ['packSize'],
  'coffee': ['packSize'],

  'sausage': ['meatType'], // Убрал meatType, так как нет функции извлечения
  'meat': ['meatType'], // Убрал meatType, так как нет функции извлечения

  'cereal': ['packSize'],
  'pasta': ['packSize'],

  // Общий фильтр для большинства расфасованных продуктов
  'default': ['packSize'],
};

// Плоская карта для быстрого сопоставления слагов подкатегорий
const KASPI_CATEGORIES_FLAT = {};
for (const [parent, children] of Object.entries(kaspiCategoryTree)) {
  children.forEach(child => {
    KASPI_CATEGORIES_FLAT[slugify(child)] = slugify(parent);
  });
}


// -------------------- Агрегация из массива объектов --------------------

function aggregateFromObjects(rawItems) {
  const map = new Map(); // key -> AggregatedProduct

  for (const raw of rawItems) {
    const norm = normalizeItem(raw);
    if (!norm) continue;

    const key = buildProductKey(norm);

    let product = map.get(key);
    if (!product) {
      // Инициализируем продукт, используя нормализованные данные
      product = {
        id: key,
        name: norm.name,
        brand: norm.brand,
        categorySlug: norm.categorySlug ? slugify(norm.categorySlug) : null,
        weightGrams: norm.weightGrams,
        barcodes: [],
        extraInfo: {},
        // Для отладки и проверки добавляем извлеченные признаки
        _debug_fat: norm.fatPercentage || null,
        _debug_alc: norm.alcVolume || null,
      };
      map.set(key, product);
    }

    if (norm.barcode && !product.barcodes.includes(norm.barcode)) {
      product.barcodes.push(norm.barcode);
    }

    product.extraInfo[norm.source] = {
      externalId: norm.externalId,
      price: norm.price,
      url: norm.url,
      image: norm.image,
      raw,
    };
  }

  return Array.from(map.values());
}

// -------------------- Определение источника --------------------

function detectSource(item) {
  if (!item || typeof item !== 'object') return null;

  // Arbuz
  if ('catalogId' in item && 'catalogName' in item && 'priceActual' in item) {
    return 'arbuz';
  }

  // Kaspi
  if ('configSku' in item || 'shopLink' in item || 'unitPrice' in item) {
    return 'kaspi';
  }

  // Wolt
  if ('barcode_gtin' in item || 'unit_info' in item || 'unit_price' in item) {
    return 'wolt';
  }

  return null;
}

// -------------------- Нормализация одного объекта --------------------

function normalizeItem(raw) {
  const source = detectSource(raw);
  if (!source) return null;

  if (source === 'arbuz') return normalizeArbuz(raw);
  if (source === 'kaspi') return normalizeKaspi(raw);
  if (source === 'wolt') return normalizeWolt(raw);
  return null;
}

function normalizeArbuz(raw) {
  const name = raw.name || '';
  const brand = raw.brandName || extractBrandFromName(name);

  const categorySlug =
    inferGenericCategorySlug('arbuz', raw, name) ||
    (raw.additionalInformation && raw.additionalInformation.categoryLevel3) ||
    raw.catalogName ||
    null;

  const weightGrams =
    extractWeightGramsFromText(name) ??
    extractWeightGramsFromText(raw.weight) ??
    null;

  const barcode = raw.barcode || null;
  const coreNameNorm = buildCoreNameNorm(name, brand);

  // Извлечение ключевых характеристик
  const fatPercentage = extractFatPercentageFromText(name) || (raw.nutrition && raw.nutrition.fats) || null;
  const alcVolume = extractAlcVolumeFromText(name) || null;
  const volumeMl = extractVolumeMlFromText(name) || null; // Предполагается, что 500 мл равно 500 гр

  return {
    source: 'arbuz',
    externalId: String(raw.id),
    name,
    brand,
    categorySlug,
    weightGrams,
    barcode,
    price:
      typeof raw.priceSpecial === 'number'
        ? raw.priceSpecial
        : typeof raw.priceActual === 'number'
          ? raw.priceActual
          : null,
    url: raw.uri ? `https://arbuz.kz${raw.uri}` : null,
    image: raw.image ? raw.image.replace('?w=%w&h=%h', '') : null,
    coreNameNorm,
    fatPercentage: fatPercentage ? Number(fatPercentage).toFixed(1) : null, // Нормализация до 1 знака
    alcVolume: alcVolume ? Number(alcVolume).toFixed(1) : null,
    volumeMl: volumeMl,
    raw,
  };
}

function normalizeKaspi(raw) {
  const name = raw.title || '';
  const brand = raw.brand || extractBrandFromName(name);

  const categorySlug =
    inferGenericCategorySlug('kaspi', raw, name) ||
    (Array.isArray(raw.categoryRu) && raw.categoryRu.length
      ? raw.categoryRu.join(' > ')
      : null);

  const weightGrams =
    extractWeightGramsFromText(name) ??
    (typeof raw.weight === 'number' && raw.weight > 0
      ? Math.round(raw.weight * 1000)
      : null);

  const barcode = null; // осознанно не используем
  const coreNameNorm = buildCoreNameNorm(name, brand);

  // Извлечение ключевых характеристик
  const fatPercentage = extractFatPercentageFromText(name) || null;
  const alcVolume = extractAlcVolumeFromText(name) || null;
  const volumeMl = extractVolumeMlFromText(name) || null;

  return {
    source: 'kaspi',
    externalId: String(raw.id),
    name,
    brand,
    categorySlug,
    weightGrams,
    barcode,
    price:
      typeof raw.unitSalePrice === 'number'
        ? raw.unitSalePrice
        : typeof raw.unitPrice === 'number'
          ? raw.unitPrice
          : null,
    url: raw.shopLink ? `https://kaspi.kz${raw.shopLink}` : null,
    image:
      raw.previewImages && raw.previewImages[0] && raw.previewImages[0].medium
        ? raw.previewImages[0].medium
        : null,
    coreNameNorm,
    fatPercentage: fatPercentage ? Number(fatPercentage).toFixed(1) : null,
    alcVolume: alcVolume ? Number(alcVolume).toFixed(1) : null,
    volumeMl: volumeMl,
    raw,
  };
}

function normalizeWolt(raw) {
  const name = raw.name || '';
  const brand = extractBrandFromName(name);

  const categorySlug =
    inferGenericCategorySlug('wolt', raw, name) || null;

  const weightGrams =
    extractWeightGramsFromText(raw.unit_info) ??
    extractWeightGramsFromText(name) ??
    null;

  const barcode = raw.barcode_gtin || null;
  const coreNameNorm = buildCoreNameNorm(name, brand);

  // Извлечение ключевых характеристик
  const fatPercentage = extractFatPercentageFromText(name) || null;
  const alcVolume = extractAlcVolumeFromText(name) || null;
  const volumeMl = extractVolumeMlFromText(name) || null;

  return {
    source: 'wolt',
    externalId: String(raw.id),
    name,
    brand,
    categorySlug,
    weightGrams,
    barcode,
    price: typeof raw.price === 'number' ? raw.price : null,
    url: null,
    image:
      raw.images && raw.images[0] && raw.images[0].url
        ? raw.images[0].url
        : null,
    coreNameNorm,
    fatPercentage: fatPercentage ? Number(fatPercentage).toFixed(1) : null,
    alcVolume: alcVolume ? Number(alcVolume).toFixed(1) : null,
    volumeMl: volumeMl,
    raw,
  };
}

// -------------------- Нормализация категории (общий slug) --------------------

function inferGenericCategorySlug(source, raw, name) {
  const parts = [];

  if (name) parts.push(name);

  if (source === 'arbuz') {
    if (raw.catalogName) parts.push(raw.catalogName);
    if (raw.additionalInformation) {
      const ai = raw.additionalInformation;
      ['categoryLevel1', 'categoryLevel2', 'categoryLevel3'].forEach((k) => {
        if (ai[k]) parts.push(ai[k]);
      });
    }
  }

  if (source === 'kaspi') {
    if (Array.isArray(raw.categoryRu)) {
      parts.push(...raw.categoryRu);

      // Более точная категория из Kaspi-иерархии (если есть)
      const lastCat = raw.categoryRu[raw.categoryRu.length - 1];
      const slug = slugify(lastCat);
      if (KASPI_CATEGORIES_FLAT[slug]) {
        return slug;
      }
    }
  }

  // Добавление Wolt-специфичных полей
  if (source === 'wolt' && raw.category_info && raw.category_info.name) {
    parts.push(raw.category_info.name);
  }


  const text = parts.join(' ').toLowerCase();

  const has = (s) => text.includes(s);

  // Специфические варианты (приоритетные)
  if (has('сгущ') || has('сгущен')) return 'condensed-milk'; // <--- ПРИОРИТЕТ
  if (has('кефир') || has('айран') || has('тан')) return 'kefir';
  if (has('йогурт')) return 'yogurt';
  if (has('творог')) return 'cottage-cheese';
  if (has('сметан')) return 'sour-cream';
  if (has('сыр ')) return 'cheese';
  if (has('масло') && has('сливоч')) return 'butter';
  if (has('молоко')) return 'milk';

  if (has('яйц')) return 'eggs';
  if (has('колбас') || has('сосиск')) return 'sausage';
  if (has('хлеб')) return 'bread';
  if (has('водка') || has('вино') || has('пиво') || has('алкоголь')) return 'alcohol';

  return null;
}

// -------------------- Ключ товара --------------------

function buildProductKey(n) {
  const brandNorm = (n.brand || '').toUpperCase().trim();
  let cat = (n.categorySlug || 'product').toLowerCase();

  // Дополнительная грубая нормализация категории
  if (cat.includes('молоко')) {
    if (n.name.toLowerCase().includes('сгущен') || cat.includes('сгущенное')) {
      cat = 'condensed-milk';
    } else {
      cat = 'milk';
    }
  }
  if (cat.includes('сливочное-масло') || (cat.includes('масло') && cat.includes('сливоч'))) cat = 'butter';
  if (cat.includes('кефир') || cat.includes('айран')) cat = 'kefir';
  if (cat.includes('водка') || cat.includes('вино') || cat.includes('пиво')) cat = 'alcohol';


  // 1. Определение нужных фильтров
  // Ищем совпадение по части слага или используем 'default'
  const filterMapKey = Object.keys(CATEGORY_FILTERS_MAP).find(k => cat.includes(k)) || 'default';
  const requiredFilters = CATEGORY_FILTERS_MAP[filterMapKey] || [];

  let filterString = '';

  // 2. Добавление фильтров к строке ключа
  if (requiredFilters.includes('fatPercentage') && n.fatPercentage) {
    filterString += `|FAT-${n.fatPercentage}`;
  }
  if (requiredFilters.includes('alcVolume') && n.alcVolume) {
    filterString += `|ALC-${n.alcVolume}`;
  }
  if (requiredFilters.includes('volumeMl') && n.volumeMl) {
    // Используем volumeMl только если он есть И weightGrams отсутствует 
    // или если категория явно требует volumeMl (как соки/вода)
    if (!n.weightGrams || filterMapKey === 'juice' || filterMapKey === 'water') {
      filterString += `|VOL-${n.volumeMl}`;
    }
  }
  // TODO: Добавить логику для packSize, cheeseType, meatType, etc.

  const weight = n.weightGrams || 0;

  // ОБНОВЛЕННЫЙ КЛЮЧ: Категория | Бренд | Очищенное имя | Вес/Объем | Спец.Фильтры
  return `${slugify(cat)}|${brandNorm}|${n.coreNameNorm}|${weight}${filterString}`;
}

// -------------------- Утилиты --------------------

function extractBrandFromName(name) {
  if (!name) return null;
  const firstWord = name.trim().split(/\s+/)[0];
  if (!firstWord) return null;
  return capitalize(firstWord.toLowerCase());
}

function capitalize(s) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

function extractWeightGramsFromText(input) {
  if (!input) return null;
  const text = String(input).toLowerCase().replace(',', '.');

  // граммы
  let m = text.match(/(\d+(?:\.\d+)?)\s*(г|гр|грамм)/);
  if (m) {
    const grams = parseFloat(m[1]);
    if (!Number.isNaN(grams)) return Math.round(grams);
  }

  // килограммы
  m = text.match(/(\d+(?:\.\d+)?)\s*(кг|kg)/);
  if (m) {
    const kg = parseFloat(m[1]);
    if (!Number.isNaN(kg)) return Math.round(kg * 1000);
  }

  return null;
}

function extractVolumeMlFromText(input) {
  if (!input) return null;
  const text = String(input).toLowerCase().replace(',', '.');

  // миллилитры
  let m = text.match(/(\d+(?:\.\d+)?)\s*(мл|ml)/);
  if (m) {
    const ml = parseFloat(m[1]);
    if (!Number.isNaN(ml)) return Math.round(ml);
  }

  // литры
  m = text.match(/(\d+(?:\.\d+)?)\s*(л|l)/);
  if (m) {
    const liters = parseFloat(m[1]);
    if (!Number.isNaN(liters)) return Math.round(liters * 1000);
  }
  return null;
}

function extractFatPercentageFromText(input) {
  if (!input) return null;
  const text = String(input).toLowerCase().replace(',', '.');

  // Ищем число с точкой/запятой, за которым следует '%' или 'жирн'
  const m = text.match(/(\d+(?:\.\d+)?)\s*(%|жирн|fat)/);
  if (m) {
    const fat = parseFloat(m[1]);
    if (!Number.isNaN(fat) && fat > 0) return fat.toFixed(1); // Округляем до одного знака
  }
  return null;
}

function extractAlcVolumeFromText(input) {
  if (!input) return null;
  const text = String(input).toLowerCase().replace(',', '.');
  // Ищем число с '%' или 'об'
  const m = text.match(/(\d+(?:\.\d+)?)\s*(%|vol|об)/);
  if (m) {
    const volume = parseFloat(m[1]);
    if (!Number.isNaN(volume) && volume > 0) return volume.toFixed(1);
  }
  return null;
}

function buildCoreNameNorm(name, brand) {
  if (!name) return '';

  let s = name.toLowerCase().replace(/ё/g, 'е');

  if (brand) {
    const b = String(brand).toLowerCase();
    s = s.replace(new RegExp('\\b' + escapeRegExp(b) + '\\b', 'g'), ' ');
  }

  // числа + единицы
  s = s.replace(/\d+(\s*(г|гр|грамм|кг|kg|мл|ml|л|l))?/g, ' ');
  // проценты
  s = s.replace(/\d+\s*%/g, ' ');
  // пунктуация
  s = s.replace(/[.,()/%]/g, ' ');

  let tokens = s
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

  // выкидываем служебные описательные слова
  tokens = tokens.filter((t) => !STOP_WORDS.has(t));

  tokens = tokens.sort();

  return tokens.join('-');
}

function slugify(text) {
  if (!text) return '';
  let s = text.toLowerCase().replace(/ё/g, 'е');
  s = s.replace(/[^a-z0-9\u0400-\u04FF]+/g, '-');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-|-$/g, '');
  return s;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// -------------------- Запуск как скрипт --------------------

const OUTPUT_DIR = path.join(__dirname, 'normalizedResults');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'milk-normalized.json');

if (require.main === module) {
  (async () => {
    const items = [];

    if (Array.isArray(milkKaspi)) items.push(...milkKaspi);
    else if (milkKaspi) items.push(milkKaspi);

    if (Array.isArray(milkArbuz)) items.push(...milkArbuz);
    else if (milkArbuz) items.push(milkArbuz);

    if (Array.isArray(milkWolt)) items.push(...milkWolt);
    else if (milkWolt) items.push(milkWolt);

    if (!items.length) {
      console.error('Нет данных для агрегации (массив пустой).');
      // process.exit(1); // Закомментировано для демонстрации
    }

    const aggregated = aggregateFromObjects(items);

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(
      OUTPUT_FILE,
      JSON.stringify(aggregated, null, 2),
      'utf8',
    );

    console.log('Готово. Результат записан в', OUTPUT_FILE);

    // Быстрая проверка: сколько товаров с несколькими источниками
    const multi = aggregated.filter(
      (p) => Object.keys(p.extraInfo || {}).length > 1,
    );
    console.log(
      'Товаров, где объединились несколько магазинов:',
      multi.length,
    );
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

// экспорт для использования из других модулей
module.exports = {
  aggregateFromObjects,
  normalizeItem,
  buildProductKey,
  // Экспортируем новые утилиты для тестирования
  extractFatPercentageFromText,
  extractAlcVolumeFromText,
  extractVolumeMlFromText,
};