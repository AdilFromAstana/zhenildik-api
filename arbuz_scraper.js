const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const START_URL = "https://arbuz.kz/";

function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ["--start-maximized"],
    });

    const page = await browser.newPage();
    await page.goto(START_URL);

    console.log("🌐 Arbuz открыт, проверяю модалку...");

    // Закрытие модалки
    try {
        await page.waitForSelector(".super-app-modal-overlay .close-button", { timeout: 5000 });
        await page.click(".super-app-modal-overlay .close-button");
        console.log("✅ Модалка закрыта");
    } catch {
        console.log("ℹ️ Модалки нет");
    }

    async function waitFor(selector, timeout = 15000) {
        try {
            await page.waitForSelector(selector, { timeout });
        } catch { }
        await sleep(300);
    }

    // перехват API
    const productsBuffer = [];
    page.on("response", async (resp) => {
        const url = resp.url();
        if (!url.includes("/api/v1/shop/catalog/")) return;
        try {
            const json = await resp.json();
            if (json?.data?.products?.data?.length) {
                productsBuffer.push(...json.data.products.data);
            }
        } catch { }
    });

    async function saveProducts(pathArr) {
        if (!productsBuffer.length) return;
        const savePath = path.join("arbuz_data", ...pathArr) + ".json";
        fs.mkdirSync(path.dirname(savePath), { recursive: true });
        fs.writeFileSync(savePath, JSON.stringify(productsBuffer, null, 2));
        console.log(`💾 Сохранено: ${savePath} (${productsBuffer.length})`);
        productsBuffer.length = 0;
    }

    // пагинация
    async function scrapePagination() {
        while (true) {
            await waitFor(".arbuz-pagination");

            const hasNext = await page.evaluate(() =>
                !!document.querySelector(".arbuz-pagination a.next")
            );

            if (!hasNext) break;

            console.log("➡️ Дальше → страница");

            const prevHtml = await page.evaluate(() => document.body.innerHTML);

            await page.evaluate(() => {
                document.querySelector(".arbuz-pagination a.next").click();
            });

            await page.waitForFunction(
                (prev) => document.body.innerHTML !== prev,
                {},
                prevHtml
            );

            await sleep(300);
        }
    }

    // DFS обход
    async function dfs(pathArr = []) {
        await waitFor(".container-catalog__breadcrumbs");

        const tags = await page.evaluate(() => {
            const raw = [...document.querySelectorAll(".catalog-tags__item")].map((el) => ({
                name: el.innerText.trim(),
                url: el.href,
            }));

            const seen = new Set();
            return raw.filter((item) => {
                if (seen.has(item.url)) return false;
                seen.add(item.url);
                return true;
            });
        });

        // Если есть подкатегории — идём вглубь
        if (tags.length > 0) {
            for (const t of tags) {
                console.log(`➡️ Переход в подкатегорию: ${t.name}`);

                const parentUrl = page.url();

                await page.goto(t.url, { waitUntil: "domcontentloaded" });

                await dfs([...pathArr, t.name]);

                console.log("↩️ Возврат…");

                await page.goto(parentUrl, { waitUntil: "domcontentloaded" });
                await waitFor(".catalog-tags");
            }
            return;
        }

        // Лист
        const leaf = await page.evaluate(() =>
            document.querySelector(".breadcrumb-item.active a")?.innerText.trim()
        );

        console.log(`🌿 Лист: ${leaf}`);

        // ---- ДЕДУПЛИКАЦИЯ ФАЙЛОВ (СКИП УЖЕ ГОТОВОГО) ----
        const filePath = path.join("arbuz_data", ...pathArr, `${leaf}.json`);
        if (fs.existsSync(filePath)) {
            console.log(`⏭ Файл уже существует — пропускаю: ${filePath}`);
            return;
        }

        // ---- ПОЛУЧАЕМ ТОВАРЫ ----
        await scrapePagination();
        await saveProducts([...pathArr, leaf]);
    }


    // читаем главное меню
    await waitFor(".catalog-main");

    const menu = await page.evaluate(() =>
        [...document.querySelectorAll(".menu-item")].map((el, i) => ({
            index: i,
            name: el.innerText.trim(),
        }))
    );

    for (const m of menu) {
        if (!m.name || ["Скидки", "Алкоголь"].includes(m.name)) continue;

        console.log(`\n🔷 Раздел: ${m.name}`);

        // открыть раздел
        await page.evaluate((i) => {
            document.querySelectorAll(".menu-item .menu-link")[i].click();
        }, m.index);

        await waitFor(".submenu");

        const submenu = await page.evaluate(() =>
            [...document.querySelectorAll(".submenu-item")].map((el) => ({
                name: el.innerText.trim(),
                url: el.href,
            }))
        );

        for (const s of submenu) {
            console.log(`➡️ Подраздел: ${s.name}`);

            const prevHtml = await page.evaluate(() => document.body.innerHTML);

            await page.goto(s.url);
            await page.waitForFunction(
                (prev) => document.body.innerHTML !== prev,
                {},
                prevHtml
            );

            await dfs([m.name, s.name]);

            console.log("↩️ Возврат в главное меню...");
            await page.goto(START_URL);
            await waitFor(".catalog-main");

            // check modals again
            try {
                await page.waitForSelector(".super-app-modal-overlay .close-button", { timeout: 3000 });
                await page.click(".super-app-modal-overlay .close-button");
            } catch { }
        }
    }

    console.log("\n🏁 Arbuz — Готово.");
    await browser.close();
})();
