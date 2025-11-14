const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const START_URL = "https://wolt.com/ru/kaz/nur-sultan/venue/wolt-market-left-bank/items";

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ["--start-maximized"],
    });

    const page = await browser.newPage();

    if (!fs.existsSync("./wolt_data")) fs.mkdirSync("./wolt_data");

    console.log("🌐 Открываю Wolt…");
    await page.goto(START_URL, { waitUntil: "networkidle2" });

    console.log("Жду aside категорий…");
    await page.waitForSelector('[data-test-id="navigation-bar"]');

    // перехват API — как в Arbuz
    const productsBuffer = [];

    page.on("response", async (resp) => {
        const url = resp.url();

        // только товары Wolt
        if (!url.includes("consumer-api/consumer-assortment/v1/venues/slug")) return;


        try {
            const json = await resp.json();  // 🔥 ТОЛЬКО через resp.json()

            // если есть товары
            if (json?.items?.length) {
                productsBuffer.push(...json.items);   // 🔥 как в Arbuz
            }

        } catch { }
    });

    function saveProducts(pathArr) {
        if (!productsBuffer.length) return;

        const savePath = path.join("wolt_data", ...pathArr) + ".json";

        fs.mkdirSync(path.dirname(savePath), { recursive: true });
        fs.writeFileSync(savePath, JSON.stringify(productsBuffer, null, 2));

        console.log(`💾 Сохранено → ${savePath} (${productsBuffer.length})`);

        productsBuffer.length = 0; // очищаем буфер как в Arbuz
    }

    // ====== ЧИТАЕМ ТОЛЬКО ТОВАРНЫЕ КАТЕГОРИИ =============================
    const categories = await page.evaluate(() => {
        const list = [...document.querySelectorAll('aside a[data-test-id="navigation-bar-link"]')];

        const uniq = new Map();

        for (const el of list) {
            const name = el.innerText.trim();
            const href = el.href;

            if (!href.includes("/items/menucategory-")) continue;
            if (["Все блюда", "Рекомендации", "Популярное"].includes(name)) continue;

            uniq.set(href, { name, href });
        }

        return [...uniq.values()];
    });

    console.log("📦 Категорий:", categories.length);

    async function waitForStableNetwork(page, idleTime = 1500) {
        let lastActivity = Date.now();

        const update = () => lastActivity = Date.now();

        const onRequest = () => update();
        const onResponse = () => update();

        page.on("request", onRequest);
        page.on("response", onResponse);

        while (true) {
            await sleep(200);
            if (Date.now() - lastActivity > idleTime) break;
        }

        page.off("request", onRequest);
        page.off("response", onResponse);
    }

    for (const cat of categories) {
        console.log(`\n👉 ${cat.name}`);

        await page.goto(cat.href, { waitUntil: "domcontentloaded" });

        await waitForStableNetwork(page, 1500);  // 🔥 ЖДЁМ, ПОКА ВСЕ ЗАПРОСЫ ЗАКОНЧАТСЯ

        saveProducts([cat.name]);
    }

    console.log("\n🏁 Готово.");
    await browser.close();
})();
