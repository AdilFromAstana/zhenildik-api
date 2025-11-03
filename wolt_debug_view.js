/**
 * 🧩 Wolt Debug View — авто-скроллер с авто-остановкой на конце UL
 */

const puppeteer = require("puppeteer");

(async () => {
    console.log("🚀 Запуск визуального режима Wolt Debug...");

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 30,
        defaultViewport: null,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ],
    });

    const page = await browser.newPage();

    // 🔒 Блокируем лишние ресурсы
    await page.setRequestInterception(true);
    page.on("request", (req) => {
        const blocked = ["image", "font", "stylesheet", "media"];
        if (blocked.includes(req.resourceType())) req.abort();
        else req.continue();
    });

    // ✅ Загружаем страницу
    const targetUrl = "https://wolt.com/ru/discovery/restaurants";
    console.log(`🌐 Открываю ${targetUrl} ...`);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });

    // Ждём UL
    const UL_SELECTOR = 'ul[data-test-id="VenueVerticalListGrid"]';
    console.log("⏳ Ожидаем контейнер списка ресторанов...");
    await page.waitForSelector(UL_SELECTOR, { timeout: 30000 });
    console.log("✅ Контейнер найден.");

    console.log("📍 Переходим к низу списка, начинаем авто-скролл...");

    let prevHeight = 0;
    let iteration = 0;
    let stagnantCount = 0;
    let idleCount = 0;

    const MAX_IDLE_CYCLES = 10; // после 10 итераций без роста — остановка

    const scrollInterval = setInterval(async () => {
        iteration++;

        const { height, count, lastName } = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return { height: 0, count: 0, lastName: null };
            const items = el.querySelectorAll('li a[href^="/ru/"]');
            const last = items[items.length - 1];
            const name = last?.querySelector(".dt1g0nh")?.innerText?.trim() || "(без названия)";
            el.scrollBy(0, el.clientHeight);
            el.scrollBy(0, -200);
            return { height: el.scrollHeight, count: items.length, lastName: name };
        }, UL_SELECTOR);

        if (height !== prevHeight) {
            console.log(`🔁 #${iteration} | ${count} элементов | ${height}px | ${lastName}`);
            prevHeight = height;
            stagnantCount = 0;
            idleCount = 0;
        } else {
            stagnantCount++;
            idleCount++;
            console.log(`🕐 #${iteration} | без изменений (${stagnantCount}/${MAX_IDLE_CYCLES})`);
            if (stagnantCount >= 2) {
                console.log("⚙️ Форс-скролл до конца UL...");
                await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    if (el) el.scrollIntoView({ behavior: "instant", block: "end" });
                }, UL_SELECTOR);
                stagnantCount = 0;
            }
        }

        if (idleCount >= MAX_IDLE_CYCLES) {
            console.log("✅ Конец списка достигнут. Останавливаемся.");
            clearInterval(scrollInterval);
            await browser.close();
            process.exit(0);
        }
    }, 1000);

    console.log("🧩 Нажми Ctrl+C для ручной остановки.");
})();
