const puppeteer = require("puppeteer");
const fs = require("fs");
const readline = require("readline");
const path = require("path");

const START_URL =
    "https://kaspi.kz/shop/nur-sultan/c/food/?q=%3AavailableInZones%3AMagnum_ZONE5%3Acategory%3AFood&sort=relevance&sc=";

function ask(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) =>
        rl.question(query, (ans) => {
            rl.close();
            resolve(ans.trim());
        })
    );
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ["--start-maximized"],
    });

    const page = await browser.newPage();
    await page.goto(START_URL, { waitUntil: "networkidle2" });

    // ждём выбора корня
    console.log("\n➡️ Выбери ЛЮБУЮ категорию вручную (корень).");

    async function clickCategory(index) {
        const prevHtml = await page.evaluate(() =>
            document.querySelector(".item-cards-grid__cards")?.innerHTML || ""
        );

        await page.evaluate((idx) => {
            const active = document.querySelector(".tree__item._active._expanded");
            const childs = [...active.querySelectorAll(":scope > .tree__items > .tree__item")];
            childs[idx].querySelector(".tree__link").click();
        }, index);

        await page.waitForFunction(
            (prev) => {
                const cur = document.querySelector(".item-cards-grid__cards")?.innerHTML || "";
                return cur !== prev;
            },
            { timeout: 30000 },
            prevHtml
        );

        await waitStable();
    }

    async function ask(question) {
        return new Promise((resolve) => {
            const rl = require("readline").createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            rl.question(question, (ans) => {
                rl.close();
                resolve(ans.trim());
            });
        });
    }

    let last = "";
    while (true) {
        const category = await page.evaluate(() => {
            const active = document.querySelector(".tree__item._active > .tree__link");
            return active ? active.textContent.trim() : null;
        });

        if (category && category !== last) {
            last = category;
            console.log(`📌 Выбрано: ${category}`);
        }

        const start = await ask("Начать обход дерева? yes/no: ");
        if (start === "yes") break;
    }

    // перехват JSON
    const pageData = [];
    page.on("response", async (response) => {
        const url = response.url();
        if (!url.includes("/yml/product-view/pl/results?")) return;

        try {
            const json = await response.json();
            if (json?.data?.length) {
                pageData.push(...json.data);
            }
        } catch { }
    });

    // ожидание стабильности
    async function waitStable() {
        try {
            await page.waitForSelector(".item-cards-grid__cards", { timeout: 20000 });
        } catch { }

        await new Promise((r) => setTimeout(r, 1200));
        await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 });
        await new Promise((r) => setTimeout(r, 800));
    }

    // сбор всех страниц категории
    async function scrapePagesForCategory(savePath) {
        pageData.length = 0;

        // ждём появление первой страницы товаров
        await waitStable();

        while (true) {
            const nextExists = await page.evaluate(() => {
                const next = [...document.querySelectorAll(".pagination__el")]
                    .find(n => n.textContent.includes("Следующая"));
                return next && !next.classList.contains("_disabled");
            });

            if (!nextExists) break;

            console.log("➡️ Следующая страница...");

            // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ — НИКАКИХ navigation!!!
            const prevHtml = await page.evaluate(() =>
                document.querySelector(".item-cards-grid__cards")?.innerHTML || ""
            );

            await page.evaluate(() => {
                const next = [...document.querySelectorAll(".pagination__el")]
                    .find(n => n.textContent.includes("Следующая"));
                next?.click();
            });

            // ждём изменения DOM
            await page.waitForFunction(
                (prev) => {
                    const cur = document.querySelector(".item-cards-grid__cards")?.innerHTML || "";
                    return cur !== prev;
                },
                { timeout: 20000 },
                prevHtml
            );

            await waitStable();
        }

        if (pageData.length > 0) {
            fs.mkdirSync(path.dirname(savePath), { recursive: true });
            fs.writeFileSync(savePath, JSON.stringify(pageData, null, 2));
            console.log(`💾 Сохранён файл: ${savePath} (${pageData.length} товаров)`);
        }
    }

    // 🔥 рекурсивный DFS обход категорий
    async function dfs(nodePath = []) {
        await waitStable();

        const children = await page.evaluate(() => {
            const active = document.querySelector(".tree__item._active._expanded");
            if (!active) return [];

            return [...active.querySelectorAll(":scope > .tree__items > .tree__item")].map((el, i) => ({
                index: i,
                name: el.querySelector(".tree__link")?.textContent.trim(),
            }));
        });

        // если нет детей → листовой узел → сохраняем данные
        if (children.length === 0) {
            const catName = await page.evaluate(() => {
                return document.querySelector(".tree__item._active > .tree__link")?.textContent.trim();
            });

            const savePath = path.join("data", ...nodePath, `${catName}.json`);
            console.log(`🌿 Листовая категория → ${catName}`);
            await scrapePagesForCategory(savePath);
            return;
        }

        // иначе обходим всех детей
        for (const child of children) {
            console.log(`➡️ Вход в: ${child.name}`);

            await Promise.all([
                page.waitForNavigation({ waitUntil: "networkidle2" }),
                page.evaluate((idx) => {
                    const active = document.querySelector(".tree__item._active._expanded");
                    const childs = [...active.querySelectorAll(":scope > .tree__items > .tree__item")];
                    childs[idx].querySelector(".tree__link").click();
                }, child.index),
            ]);

            await dfs([...nodePath, child.name]); // рекурсивно вниз

            // вернуться к родителю
            console.log("↩️ Возврат к родителю…");

            await Promise.all([
                page.waitForNavigation({ waitUntil: "networkidle2" }),
                page.evaluate(() => {
                    const active = document.querySelector(".tree__item._active");
                    const parent = active.closest(".tree__item._expanded._expandable:not(._active)");
                    parent?.querySelector(".tree__link")?.click();
                }),
            ]);

            await waitStable();
        }
    }

    // запускаем полный DFS
    console.log("🚀 Начинаю рекурсивный обход всего дерева…");
    await dfs();

    console.log("\n🏁 Готово — каждое «листовое» направление сохранено в отдельный файл.");

    await browser.close();
})();





