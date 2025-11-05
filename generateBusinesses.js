import fs from "fs";
import { woltDeals } from "./output/wolt_deals_data_2025-11-03T22-53-12-531Z.js";

// Функция группировки по бренду
function groupByBusiness(deals) {
    const map = {};

    for (const deal of deals) {
        if (!deal.info?.categories?.length) continue;

        // Последний элемент categories обычно содержит название бренда
        const brand = deal.info.categories[deal.info.categories.length - 1].trim();

        const branch = {
            title: deal.name,
            description: deal.info.description,
            categories: deal.info.categories,
            address: deal.info.address,
            coordinates: deal.info.coordinates,
            schedule: deal.info.schedule,
            phone: deal.info.phone,
            website: deal.info.website,
        };

        if (!map[brand]) {
            map[brand] = {
                name: brand,
                branches: [branch],
            };
        } else {
            map[brand].branches.push(branch);
        }
    }

    return Object.values(map);
}

// Генерация массива бизнесов
const businesses = groupByBusiness(woltDeals);

// Сохранение в JSON файл
fs.writeFileSync("businesses.json", JSON.stringify(businesses, null, 2), "utf8");

console.log(`✅ businesses.json создан (${businesses.length} бизнесов, ${woltDeals.length} точек)`);
