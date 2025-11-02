const puppeteer = require("puppeteer");
const fs = require("fs");

const TARGET_PAGE_URL = "https://wolt.com/ru/discovery/restaurants";
const PAGE_VISIT_PAUSE_MS = 4000;

const SELECTORS = {
    MAIN_LIST_CONTAINER: "ul",
    RESTAURANT_CARD: 'li a[href^="/ru/"]',
    RESTAURANT_NAME: ".dt1g0nh",
    ITEM_DISCOUNT_BADGE:
        '[data-variant="primaryBrand"], [data-variant="secondaryBrand"], .cb_Tag_Root_7dc',
};
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// --- Вспомогательная функция ожидания селектора ---
async function waitAndRetry(page, selector, maxRetries, description) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`    ⏳ Попытка ${attempt}/${maxRetries}: ${description}`);
            await page.waitForSelector(selector, { visible: true, timeout: 1500 });
            console.log(`    ✅ ${description} найден.`);
            return true;
        } catch {
            console.log(`    ❌ ${description} не найден. Повтор через 1 секунду...`);
            await new Promise((r) => setTimeout(r, 1000));
        }
    }
    return false;
}

// --- Прокрутка страницы ---
async function scrollAll(page, containerSelector) {
    const MAX_SCROLL_ATTEMPTS = 50;
    const SCROLL_AMOUNT = 600;
    for (let attempt = 1; attempt <= MAX_SCROLL_ATTEMPTS; attempt++) {
        const prevHeight = await page.$eval(containerSelector, (el) => el.scrollHeight);
        await page.$eval(containerSelector, (el, amt) => (el.scrollTop += amt), SCROLL_AMOUNT);
        await delay(2000);
        const newHeight = await page.$eval(containerSelector, (el) => el.scrollHeight);
        if (newHeight === prevHeight) {
            console.log(`    ✅ [СКРОЛЛ] Конец списка после ${attempt} шагов.`);
            return;
        }
    }
    console.warn("    ⚠️ [СКРОЛЛ] Достигнут лимит, возможен неполный список.");
}

// --- Основной скрипт ---
async function runWoltScraper() {
    console.log("1. Запуск браузера...");
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
    });
    const page = await browser.newPage();
    const visited = new Set();

    try {
        console.log(`1.1 Переход на Wolt: ${TARGET_PAGE_URL}`);
        await page.goto(TARGET_PAGE_URL, { waitUntil: "networkidle2", timeout: 60000 });

        const containerOk = await waitAndRetry(page, SELECTORS.MAIN_LIST_CONTAINER, 5, "главный контейнер");
        if (!containerOk) throw new Error("Главный контейнер не найден.");

        const firstCardOk = await waitAndRetry(page, SELECTORS.RESTAURANT_CARD, 5, "карточка ресторана");
        if (!firstCardOk) throw new Error("Карточки ресторанов не найдены.");

        console.log("\n2. Скроллинг...");
        await scrollAll(page, SELECTORS.MAIN_LIST_CONTAINER);

        console.log("\n3. Сбор ресторанов с акциями...");
        const restaurants = await page.$$eval(
            SELECTORS.RESTAURANT_CARD,
            (links, selectors) => {
                const result = [];
                for (const link of links) {
                    const li = link.closest("li");
                    if (!li) continue;
                    const hasDiscount = li.querySelector(selectors.ITEM_DISCOUNT_BADGE);
                    if (!hasDiscount) continue;
                    const nameEl = li.querySelector(selectors.RESTAURANT_NAME);
                    const name = nameEl ? nameEl.innerText.trim() : "Без названия";
                    result.push({
                        name,
                        path: link.getAttribute("href"),
                    });
                }
                return result;
            },
            SELECTORS
        );

        if (!restaurants.length) {
            console.log("⚠️ Акции не найдены. Завершение.");
            return [];
        }

        console.log(`✅ Найдено ${restaurants.length} ресторанов с акциями.\n`);

        const results = [];
        console.log(`➡️ Начинаю последовательный обход ${restaurants.length} ссылок без возвратов...\n`);

        for (let i = 0; i < restaurants.length; i++) {
            const { name, path } = restaurants[i];
            const fullLink = `https://wolt.com${path}`;

            if (visited.has(fullLink)) {
                console.log(`⏩ Пропуск (уже посещён): ${name}`);
                continue;
            }

            console.log(`➡️ [${i + 1}/${restaurants.length}] ${name}: ${fullLink}`);

            try {
                await page.goto(fullLink, { waitUntil: "networkidle2", timeout: 60000 });

                const menuReady = await waitAndRetry(page, '[data-test-id="MenuSection"]', 10, "меню ресторана");
                if (!menuReady) {
                    console.warn(`⚠️ Меню не загрузилось для ${name}, пропуск.`);
                    continue;
                }

                await delay(PAGE_VISIT_PAUSE_MS);

                // Извлекаем все товары со скидками
                const discountedItems = await page.$$eval(
                    '[data-test-id="horizontal-item-card"]',
                    (cards) => {
                        return cards
                            .map((card) => {
                                const hasDiscount = card.querySelector('[data-test-id="ItemDiscountBadge"]');
                                if (!hasDiscount) return null;

                                const title = card.querySelector('[data-test-id="horizontal-item-card-header"]')?.innerText.trim() || "";
                                const description = card.querySelector("p.du2tpot")?.innerText.trim() || "";
                                const discountText = hasDiscount?.innerText.trim() || "";
                                const newPrice = card.querySelector('[data-test-id="horizontal-item-card-discounted-price"]')?.innerText.trim() || "";
                                const oldPrice = card.querySelector('[data-test-id="horizontal-item-card-original-price"]')?.innerText.trim() || "";
                                const image = card.querySelector('[data-test-id="horizontal-item-card-image"]')?.src || "";

                                return {
                                    title,
                                    description,
                                    discountText,
                                    newPrice,
                                    oldPrice,
                                    image,
                                };
                            })
                            .filter(Boolean);
                    }
                );

                results.push({
                    name,
                    link: fullLink,
                    items: discountedItems,
                    discountCount: discountedItems.length,
                });

                visited.add(fullLink);

                console.log(`✅ Найдено ${discountedItems.length} товаров со скидками у ${name}`);

                // 🟡 Проверка условия — нашли 3 ресторана со скидками
                const foundWithDiscounts = results.filter(r => r.discountCount > 0).length;
                if (foundWithDiscounts >= 3) {
                    console.log(`\n🎯 Найдено ${foundWithDiscounts} ресторанов со скидками — завершение поиска.`);

                    // Сохранение в JS-файл
                    const output = `export const woltDeals = ${JSON.stringify(results, null, 2)};`;
                    fs.writeFileSync("wolt_deals_data.js", output);
                    console.log("💾 Сохранено в wolt_deals_data.js");

                    break; // ⛔️ Прерываем цикл
                }

            } catch (err) {
                console.warn(`❌ Ошибка при обработке ${name}: ${err.message}`);
            }
        }

        console.log(`\n✅ Завершено. Посещено ${results.length} страниц.`);
        fs.writeFileSync("wolt_visited_report.json", JSON.stringify(results, null, 2));
        console.log("💾 Сохранено в wolt_visited_report.json");
        return results;
    } catch (err) {
        console.error("❌ Критическая ошибка:", err.message);
        await page.screenshot({ path: "wolt_error.png" });
        console.log("💾 Скриншот сохранён: wolt_error.png");
        return [];
    } finally {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await browser.close();
    }
}

runWoltScraper();
