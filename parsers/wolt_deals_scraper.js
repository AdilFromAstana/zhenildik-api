/**
 * ⚡ Wolt Discount Scraper (без модалки, с извлечением информации о ресторане)
 * Автор: Adil
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const CONFIG = {
    TARGET_PAGE_URL: "https://wolt.com/ru/discovery/restaurants",
    PAGE_VISIT_PAUSE_MS: 1000,
    MAX_SCROLL_IDLE_CYCLES: 10,
    SCROLL_AMOUNT: 400,
    PARALLEL_PAGES: 4,
    DEBUG: true,
    OUTPUT_DIR: path.resolve(__dirname, "output"),
    CACHE_FILE: path.resolve(__dirname, "output/visited_cache.json"),
    SELECTORS: {
        MAIN_LIST_CONTAINER: 'ul[data-test-id="VenueVerticalListGrid"]',
        RESTAURANT_CARD: 'li a[href^="/ru/"]',
        RESTAURANT_NAME: ".dt1g0nh",
    },
};

// --- Параметры запуска ---
const args = process.argv.slice(2);
const LIMIT_RESTAURANTS = args[0] ? parseInt(args[0]) : null; // например node wolt.js 5
if (LIMIT_RESTAURANTS) {
    console.log(`⚙️ Будет найдено не более ${LIMIT_RESTAURANTS} ресторанов с акциями`);
} else {
    console.log("⚙️ Предел не задан — будут собраны все рестораны");
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => CONFIG.DEBUG && console.log(msg);
const normalizeUrl = (url) => url.replace(/\/$/, "");

// ----------------- HELPERS (должны быть выше runWoltScraper) -----------------
function randomDelay(min = 800, max = 2000) {
    return delay(min + Math.floor(Math.random() * (max - min)));
}

async function autosaveResults(results, filename = 'wolt_deals_latest.json') {
    try {
        const filePath = path.join(CONFIG.OUTPUT_DIR, filename);
        await fs.promises.writeFile(filePath, JSON.stringify(results, null, 2), 'utf8');
        console.log(`💾 Autosave: ${filePath}`);
    } catch (err) {
        console.warn('Autosave error:', err.message);
    }
}

/** Round-robin разбиение на чанки для пула вкладок */
function chunkRoundRobin(items, n) {
    const chunks = Array.from({ length: n }, () => []);
    items.forEach((it, i) => chunks[i % n].push(it));
    return chunks;
}

/** Пул готовых страниц: blockResources + User-Agent + headers */
async function createPagePool(browser, count) {
    const pages = [];
    for (let i = 0; i < count; i++) {
        const p = await browser.newPage();
        await blockResources(p);
        await p.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
        );
        await p.setExtraHTTPHeaders({
            "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
        });
        pages.push(p);
    }
    return pages;
}

if (!fs.existsSync(CONFIG.OUTPUT_DIR))
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });

function saveData(filename, data, asJS = false) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = path.join(
        CONFIG.OUTPUT_DIR,
        `${filename}_${ts}.${asJS ? "js" : "json"}`
    );
    const content = asJS
        ? `export const woltDeals = ${JSON.stringify(data, null, 2)};`
        : JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content);
    console.log(`💾 Данные сохранены: ${filePath}`);
}

async function blockResources(page) {
    await page.setRequestInterception(true);
    page.on("request", (req) => {
        if (["font", "stylesheet", "media"].includes(req.resourceType()))
            req.abort();
        else req.continue();
    });
}

async function waitAndRetry(page, selector, retries, label) {
    for (let i = 1; i <= retries; i++) {
        try {
            await page.waitForSelector(selector, { visible: true, timeout: 800 });
            log(`    ✅ ${label} найден`);
            return true;
        } catch {
            log(`    ❌ ${label} не найден (попытка ${i}/${retries})`);
            await delay(500);
        }
    }
    return false;
}

async function scrollAll(page, selector) {
    console.log("🔽 Начинаем умный скроллинг (внутри UL)...");
    let prevHeight = 0,
        iteration = 0,
        stagnantCount = 0,
        idleCount = 0;

    while (true) {
        iteration++;
        const { height, count, lastName } = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return { height: 0, count: 0, lastName: null };
            const items = el.querySelectorAll('li a[href^="/ru/"]');
            const last = items[items.length - 1];
            const name =
                last?.querySelector(".dt1g0nh")?.innerText?.trim() ||
                "(без названия)";
            el.scrollBy(0, el.clientHeight);
            el.scrollBy(0, -200);
            return {
                height: el.scrollHeight,
                count: items.length,
                lastName: name,
            };
        }, selector);

        if (height !== prevHeight) {
            console.log(`🔁 #${iteration} | ${count} элементов | ${height}px | ${lastName}`);
            prevHeight = height;
            stagnantCount = 0;
            idleCount = 0;
        } else {
            stagnantCount++;
            idleCount++;
            console.log(`🕐 #${iteration} | без изменений (${stagnantCount}/${CONFIG.MAX_SCROLL_IDLE_CYCLES})`);
            if (stagnantCount >= 2) {
                await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    if (el) el.scrollIntoView({ behavior: "instant", block: "end" });
                }, selector);
                stagnantCount = 0;
            }
        }

        if (idleCount >= CONFIG.MAX_SCROLL_IDLE_CYCLES) {
            console.log(`✅ Конец списка.`);
            break;
        }

        await delay(1000);
    }
}

// ==================== EXTRACT INFO (под <main>) ====================
async function extractRestaurantInfo(page) {
    return await page.evaluate(() => {
        const main = document.querySelector("main");
        const infoBlock = main?.nextElementSibling;
        if (!infoBlock) return null;

        const getText = (sel, root = infoBlock) =>
            root.querySelector(sel)?.innerText?.trim() || "";

        const description = getText("p");

        const categories = Array.from(infoBlock.querySelectorAll("h3 + ul a"))
            .map((a) => a.textContent.trim())
            .filter(Boolean);

        const addressHeader = Array.from(infoBlock.querySelectorAll("h3")).find((h3) =>
            h3.textContent.includes("Адрес")
        );
        const addressSection = addressHeader?.parentElement;
        const addressParts = Array.from(addressSection?.querySelectorAll("p") || []).map((p) =>
            p.innerText.trim()
        );
        const address = addressParts.join(", ");
        const mapLink = addressSection?.querySelector('a[href*="maps.google.com"]')?.href || "";
        const coordMatch = mapLink.match(/q=([\d.]+),([\d.]+)/);
        const coordinates = coordMatch ? [parseFloat(coordMatch[1]), parseFloat(coordMatch[2])] : null;

        const deliveryHeader = Array.from(infoBlock.querySelectorAll("h3")).find((h3) =>
            h3.textContent.includes("Время доставки")
        );
        const deliverySection = deliveryHeader?.parentElement;
        const schedule = {};
        if (deliverySection) {
            deliverySection.querySelectorAll("tr").forEach((tr) => {
                const day = tr.querySelector("td:first-child")?.textContent?.trim();
                const hours = tr.querySelector("td:last-child")?.textContent?.trim();
                if (day && hours) schedule[day] = hours;
            });
        }

        const moreHeader = Array.from(infoBlock.querySelectorAll("h3")).find((h3) =>
            h3.textContent.includes("Больше информации")
        );
        const contacts = moreHeader?.parentElement;
        const phone = contacts?.querySelector('a[href^="tel:"]')?.textContent?.trim() || "";
        const website = contacts?.querySelector('a[href^="http"]:not([href*="maps.google.com"])')?.href || "";

        return { description, categories, address, coordinates, schedule, phone, website };
    });
}

// NOTE: теперь processRestaurant принимает готовую page из пула
async function processRestaurant(restaurant, page, visited, results, index, total) {
    const { name, path: relPath } = restaurant;
    const fullLink = normalizeUrl(`https://wolt.com${relPath}`);

    if (visited.has(fullLink)) {
        log(`⏩ Пропуск (уже посещён): ${name}`);
        return;
    }
    visited.add(fullLink);

    console.log(`➡️ [${index + 1}/${total}] ${name}: ${fullLink}`);

    try {
        await page.goto(fullLink, { waitUntil: "domcontentloaded", timeout: 25000 });

        // адаптивное ожидание: сначала быстро, затем увеличиваем таймаут
        const ok = await waitAndRetry(page, '[data-test-id="MenuSection"]', 6, "меню ресторана");
        if (!ok) {
            console.warn(`⚠️ Меню не найдено у ${name}, пропускаем`);
            return;
        }

        const discountedItems = await page.$$eval('[data-test-id="horizontal-item-card"]', (cards) =>
            cards
                .map((card) => {
                    const newPriceEl = card.querySelector('[data-test-id="horizontal-item-card-discounted-price"]');
                    const oldPriceEl = card.querySelector('[data-test-id="horizontal-item-card-original-price"]');
                    if (!newPriceEl || !oldPriceEl) return null;

                    const title = card.querySelector('[data-test-id="horizontal-item-card-header"]')?.innerText.trim() || "";
                    const description = card.querySelector("p")?.innerText.trim() || "";
                    const newPrice = newPriceEl.innerText.trim();
                    const oldPrice = oldPriceEl.innerText.trim();
                    const discountText = card.querySelector('[data-test-id="ItemDiscountBadge"]')?.innerText.trim() || "";
                    const image =
                        card.querySelector('img[data-test-id="horizontal-item-card-image"]')?.src ||
                        card.querySelector("img")?.src ||
                        null;

                    // вычисляем процент скидки (если возможно)
                    const toNumber = (s) => {
                        if (!s) return null;
                        const n = Number(s.replace(/[^\d]/g, ''));
                        return Number.isFinite(n) ? n : null;
                    };
                    const newN = toNumber(newPrice);
                    const oldN = toNumber(oldPrice);
                    const discountPercent = newN && oldN ? Math.round(((oldN - newN) / oldN) * 100 * 10) / 10 : null;

                    return {
                        title,
                        description,
                        discountText,
                        newPrice,
                        oldPrice,
                        discountPercent,
                        image,
                    };
                })
                .filter(Boolean)
        );

        const info = await extractRestaurantInfo(page);

        const brandImages = await page.evaluate(() => {
            const result = {};
            const heroImg = document.querySelector('header img[loading="eager"], header img[fetchpriority="high"]');
            if (heroImg) result.heroImage = heroImg.src;
            const logoImg = document.querySelector('a[href*="/brand/"] img');
            if (logoImg) result.logo = logoImg.src;
            const brandLink = document.querySelector('a[href*="/brand/"]')?.href || null;
            if (brandLink) {
                result.brandLink = brandLink;
                const slugMatch = brandLink.match(/brand\/([^/]+)/);
                if (slugMatch) result.brandSlug = slugMatch[1];
            }
            const logoAlt = logoImg?.getAttribute("alt") || "";
            if (logoAlt) result.brandName = logoAlt;
            return result;
        });

        if (info) {
            info.logo = brandImages.logo || null;
            info.heroImage = brandImages.heroImage || null;
            info.brandLink = brandImages.brandLink || null;
            info.brandSlug = brandImages.brandSlug || null;
            info.brandName = brandImages.brandName || null;
        }

        if (discountedItems.length === 0) {
            console.log(`⚪ ${name}: без скидок, пропускаем`);
        } else {
            console.log(`✅ ${name}: ${discountedItems.length} скидок`);
            results.push({
                name,
                link: fullLink,
                discountCount: discountedItems.length,
                items: discountedItems,
                info,
            });
        }
    } catch (err) {
        console.warn(`❌ Ошибка ${name}: ${err.message}`);
    } finally {
        // не закрываем page — это страница пула
    }
}

// ==================== MAIN ====================
async function runWoltScraper() {
    console.log("🚀 Запуск Wolt Scraper (оптимизированный режим)...");

    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: null,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--mute-audio",
            "--disable-infobars",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled"
        ],
    });

    const visited = new Set();
    const results = [];

    if (fs.existsSync(CONFIG.CACHE_FILE)) {
        try {
            const cached = JSON.parse(fs.readFileSync(CONFIG.CACHE_FILE, "utf8"));
            cached.forEach((url) => visited.add(url));
            console.log(`🧠 Загружено из кеша: ${visited.size} ссылок`);
        } catch (e) {
            console.warn('Не удалось загрузить кеш:', e.message);
        }
    }

    const controllerPage = await browser.newPage();
    await blockResources(controllerPage);
    await controllerPage.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    );
    await controllerPage.setExtraHTTPHeaders({ "accept-language": "ru-RU,ru;q=0.9,en;q=0.8" });

    try {
        console.log(`1️⃣ Открытие ${CONFIG.TARGET_PAGE_URL}`);
        await controllerPage.goto(CONFIG.TARGET_PAGE_URL, { waitUntil: "domcontentloaded", timeout: 45000 });

        await waitAndRetry(controllerPage, CONFIG.SELECTORS.MAIN_LIST_CONTAINER, 5, "главный контейнер");
        await waitAndRetry(controllerPage, CONFIG.SELECTORS.RESTAURANT_CARD, 5, "карточки ресторанов");

        console.log("2️⃣ Скроллинг...");
        await scrollAll(controllerPage, CONFIG.SELECTORS.MAIN_LIST_CONTAINER);

        console.log("3️⃣ Сбор ресторанов...");
        const restaurants = await controllerPage.$$eval(CONFIG.SELECTORS.RESTAURANT_CARD, (links, selectors) => {
            const result = [];
            for (const link of links) {
                const li = link.closest("li");
                if (!li) continue;
                const nameEl = li.querySelector(selectors.RESTAURANT_NAME);
                const name = nameEl ? nameEl.innerText.trim() : "Без названия";
                const href = link.getAttribute("href");
                if (href) result.push({ name, path: href });
            }
            return result;
        }, CONFIG.SELECTORS);

        const uniqueRestaurants = Array.from(new Map(restaurants.map((r) => [r.path, r])).values());
        console.log(`✅ Найдено ${uniqueRestaurants.length} уникальных ресторанов`);

        const concurrency = Math.max(1, Math.min(CONFIG.PARALLEL_PAGES, 4));
        const pagePool = await createPagePool(browser, concurrency);

        const chunks = chunkRoundRobin(uniqueRestaurants, concurrency);

        await Promise.all(chunks.map(async (chunk, idx) => {
            const page = pagePool[idx];
            for (let i = 0; i < chunk.length; i++) {
                const r = chunk[i];
                const index = i;
                const total = chunk.length;
                try {
                    await processRestaurant(r, page, visited, results, index, total);
                } catch (err) {
                    console.warn(`Ошибка обработки ${r.name}: ${err.message}`);
                }

                if (results.length % 10 === 0) {
                    await autosaveResults(results);
                    // обновим cache file
                    try {
                        await fs.promises.writeFile(CONFIG.CACHE_FILE, JSON.stringify(Array.from(visited)), 'utf8');
                    } catch (e) { /* ignore */ }
                }

                await randomDelay(900, 2200);
            }
        }));

        // закрываем страницы пула
        await Promise.all(pagePool.map((p) => p.close()));

        console.log(`\n✅ Обработано ${results.length} ресторанов (с акциями: ${results.filter(r => r.discountCount > 0).length})`);
        saveData("wolt_deals_data", results, true);
        await autosaveResults(results, 'wolt_deals_latest.json');

        // обновляем кеш visited
        try {
            await fs.promises.writeFile(CONFIG.CACHE_FILE, JSON.stringify(Array.from(visited)), 'utf8');
        } catch (e) {
            console.warn('Ошибка записи кеша:', e.message);
        }
    } catch (err) {
        console.error("❌ Критическая ошибка:", err.message);
    } finally {
        await controllerPage.close().catch(() => { });
        await browser.close();
        console.log("👋 Браузер закрыт корректно.");
    }
}


runWoltScraper();
