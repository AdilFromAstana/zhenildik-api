// src/import/arbuz/arbuz.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import puppeteer, { Page } from 'puppeteer';
import { Product } from 'src/products/entities/product.entity';
import { Merchant } from 'src/merchants/entities/merchant.entity';
import { ProductLink } from 'src/product-links/entities/product-link.entity';
import { PriceHistory } from 'src/price-history/entities/price-history.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ArbuzService {
  private readonly logger = new Logger(ArbuzService.name);
  private collectedProducts: any[] = [];
  private readonly OUTPUT_PATH = path.resolve(
    process.cwd(),
    'output/arbuz_data.json',
  );

  private async saveToJsonFile() {
    try {
      const dir = path.dirname(this.OUTPUT_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      await fs.promises.writeFile(
        this.OUTPUT_PATH,
        JSON.stringify(this.collectedProducts, null, 2),
        'utf8',
      );
      this.logger.verbose(
        `💾 JSON сохранён (${this.collectedProducts.length} товаров)`,
      );
    } catch (err) {
      const e = err as Error;
      this.logger.warn(`Ошибка записи JSON: ${e.message}`);
    }
  }

  private async waitForElement(page: Page, selector: string, label: string) {
    this.logger.verbose(`⏳ Ждём элемент: ${label} (${selector})`);
    try {
      await page.waitForSelector(selector, { timeout: 15000, visible: true });
      this.logger.verbose(`✅ Элемент "${label}" найден.`);
    } catch {
      this.logger.warn(`⚠️ Элемент "${label}" не появился за 15s.`);
    }
  }

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    @InjectRepository(ProductLink)
    private readonly linkRepo: Repository<ProductLink>,
    @InjectRepository(PriceHistory)
    private readonly priceRepo: Repository<PriceHistory>,
  ) {}

  async importFromJson(data: any) {
    const t0 = Date.now();
    let created = 0;
    let updated = 0;

    // 1️⃣ Проверяем / создаём магазин Arbuz.kz
    let merchant = await this.merchantRepo.findOne({
      where: { name: 'Arbuz.kz' },
    });
    if (!merchant) {
      merchant = this.merchantRepo.create({
        name: 'Arbuz.kz',
        website: 'https://arbuz.kz',
        logo: 'https://arbuz.kz/favicon.ico',
      });
      await this.merchantRepo.save(merchant);
      this.logger.log(`🛒 Создан новый Merchant Arbuz.kz`);
    }

    // 2️⃣ Перебор товаров
    const products = data?.data?.products?.data || [];
    this.logger.log(`📦 Обнаружено товаров: ${products.length}`);

    for (const item of products) {
      const name = item.name?.trim();
      const price = Number(item.priceActual);
      const oldPrice = Number(item.pricePrevious) || null;
      const discountPercent =
        oldPrice && oldPrice > price
          ? Math.round(((oldPrice - price) / oldPrice) * 100)
          : 0;
      const unit = item.measure || null;

      if (!name || !price) {
        this.logger.warn(
          `⚠️ Пропущен товар без данных: ${JSON.stringify(item)}`,
        );
        continue;
      }

      // 3️⃣ Product
      let product = await this.productRepo.findOne({
        where: { title: ILike(`%${name}%`) },
      });
      if (!product) {
        product = this.productRepo.create({
          title: name,
          brand: item.brandName || null,
          unit,
          unitQty: parseFloat(item.weightMin || 0) || null,
        });
        await this.productRepo.save(product);
        created++;
        this.logger.verbose(`🆕 Создан продукт: ${name}`);
      } else {
        updated++;
      }

      // 4️⃣ ProductLink
      let link = await this.linkRepo.findOne({
        where: { product: { id: product.id }, merchant: { id: merchant.id } },
        relations: ['product', 'merchant'],
      });

      const productUrl = `https://arbuz.kz${item.uri}`;
      if (!link) {
        link = this.linkRepo.create({
          product,
          merchant,
          url: productUrl,
          merchantSku: item.id?.toString(),
        });
        await this.linkRepo.save(link);
        this.logger.verbose(`🔗 Добавлена ссылка: ${productUrl}`);
      }

      // 5️⃣ PriceHistory
      const last = await this.priceRepo.findOne({
        where: { link: { id: link.id } },
        order: { date: 'DESC' },
      });

      if (!last || Number(last.price) !== price) {
        await this.priceRepo.save(
          this.priceRepo.create({
            link,
            price,
            oldPrice: oldPrice || 0,
            discountPercent,
            date: new Date(),
          }),
        );
        this.logger.log(
          `💰 Обновлена цена: ${name} = ${price}₸ (-${discountPercent}%)`,
        );
      }
    }

    const took = ((Date.now() - t0) / 1000).toFixed(1);
    this.logger.log(
      `✅ Импорт завершён: новых=${created}, обновлённых=${updated}, время=${took}s`,
    );
    return { created, updated, took };
  }

  /** Режим отладки — показывает DOM */
  async debugPage(url: string) {
    const USER_AGENT =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0 Safari/537.36';

    const browser = await puppeteer.launch({
      headless: false,
      slowMo: 150,
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--blink-settings=imagesEnabled=true',
        '--disable-blink-features=AutomationControlled,Translate',
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    this.logger.log(`🌐 Открываю ${url}`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    // ждём, пока контент появится
    await new Promise((r) => setTimeout(r, 5000));

    // выгружаем DOM-структуру
    const elements = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('*'));
      return items.slice(0, 100).map((el) => ({
        tag: el.tagName.toLowerCase(),
        classes: el.className,
        text: el.textContent?.trim().slice(0, 100) || '',
      }));
    });

    console.log('\n=========== DOM STRUCTURE (first 100 elements) ===========');
    for (const e of elements) {
      console.log(`${e.tag} | ${e.classes} | ${e.text}`);
    }
    console.log('=========================================================\n');

    this.logger.log('🔍 Проверь консоль Node — там выведены реальные теги.');
    await this.sleep(60000); // оставляем окно открытым на минуту
    await browser.close();
  }

  async importByUrl(url: string, concurrency = 1) {
    const t0 = Date.now();
    this.logger.log(`🚀 Старт импорта Arbuz: ${url}`);
    this.logger.log(`🧩 Одновременных вкладок: ${concurrency}`);

    const USER_AGENT =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0 Safari/537.36';

    // создаём или находим магазин
    let merchant = await this.merchantRepo.findOne({
      where: { name: 'Arbuz.kz' },
    });
    if (!merchant) {
      merchant = this.merchantRepo.create({
        name: 'Arbuz.kz',
        website: 'https://arbuz.kz',
        logo: 'https://arbuz.kz/favicon.ico',
      });
      await this.merchantRepo.save(merchant);
    }

    // 🔥 браузер в видимом режиме
    const browser = await puppeteer.launch({
      headless: false,
      slowMo: 200,
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--blink-settings=imagesEnabled=true',
        '--disable-blink-features=AutomationControlled,Translate',
      ],
    });

    const listPage = await browser.newPage();
    await listPage.setUserAgent(USER_AGENT);
    await this.blockResources(listPage);
    this.attachPageLogging(listPage, 'LIST');

    // пул вкладок (по concurrency)
    const productPages: Page[] = [];
    for (let i = 0; i < concurrency; i++) {
      const p = await browser.newPage();
      await p.setUserAgent(USER_AGENT);
      await this.blockResources(p);
      this.attachPageLogging(p, `PRODUCT#${i + 1}`);
      productPages.push(p);
    }

    let processed = 0;
    const seenLinks = new Set<string>();

    try {
      this.logger.verbose(`🔗 Открываю категорию: ${url}`);
      await listPage.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });

      // ⏳ сначала ждём контейнер каталога
      this.logger.verbose('⏳ Ждём появления .container-catalog...');
      await listPage.waitForSelector('.container-catalog', {
        visible: true,
        timeout: 30_000,
      });
      this.logger.verbose('✅ Контейнер каталога найден.');

      // ⏳ затем ждём карточки товаров
      await this.waitForElement(
        listPage,
        '.product-card-title',
        'карточки товаров',
      );

      await this.expandShowMoreIfAny(listPage);

      let pageIndex = 1;
      for (;;) {
        this.logger.verbose(`📄 Парсим страницу ${pageIndex}...`);
        const pageLinks = await listPage.evaluate(() =>
          Array.from(
            document.querySelectorAll<HTMLAnchorElement>(
              'article.product-card a[href*="/catalog/item/"]',
            ),
          )
            .map((a) => a.href)
            .filter(Boolean),
        );

        const fresh = pageLinks.filter((l) => !seenLinks.has(l));
        fresh.forEach((l) => seenLinks.add(l));
        this.logger.log(
          `🧾 Найдено ${fresh.length} новых товаров, всего: ${seenLinks.size}`,
        );

        for (let i = 0; i < fresh.length; i += concurrency) {
          const chunk = fresh.slice(i, i + concurrency);
          const results = await Promise.all(
            chunk.map(async (link, idx) => {
              try {
                return await this.processProduct(
                  productPages[idx],
                  link,
                  merchant,
                );
              } catch (err) {
                const e = err as Error;
                this.logger.warn(`⚠️ Ошибка на ${link}: ${e.message}`);
                return 0;
              }
            }),
          );
          processed += results.reduce((a, b) => a + b, 0);
        }

        const hasNext = await this.hasNextPage(listPage);
        if (!hasNext) {
          this.logger.log('✅ Последняя страница достигнута.');
          break;
        }

        this.logger.verbose('➡️ Переход на следующую страницу...');
        await listPage.$eval('.arbuz-pagination a.next', (el) =>
          (el as HTMLElement).click(),
        );

        // снова ждём контейнер и карточки перед парсингом следующей страницы
        await this.waitForElement(
          listPage,
          '.container-catalog',
          'контейнер каталога',
        );
        await this.waitForElement(
          listPage,
          '.product-card-title',
          'новая страница каталога',
        );

        pageIndex++;
      }
    } catch (err) {
      const e = err as Error;
      this.logger.error(`❌ Ошибка импорта: ${e.message}`);
    } finally {
      for (const p of productPages) await p.close().catch(() => null);
      await listPage.close().catch(() => null);
      await browser.close().catch(() => null);
    }

    const totalMs = Date.now() - t0;
    this.logger.log(
      `🏁 Готово: товаров=${processed}, страниц=${seenLinks.size}, время=${(totalMs / 1000).toFixed(1)}s`,
    );
    await this.saveToJsonFile();
    return { processed, total: seenLinks.size, tookMs: totalMs };
  }

  /** Обработка карточки товара */
  private async processProduct(
    page: Page,
    fullUrl: string,
    merchant: Merchant,
  ): Promise<number> {
    await page.goto(fullUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    const details = await page.evaluate(() => {
      const get = (sel: string) =>
        document.querySelector(sel)?.textContent?.trim() || '';
      const find = (k: string) =>
        Array.from(document.querySelectorAll<HTMLElement>('[class]'))
          .find((el) => Array.from(el.classList).some((c) => c.includes(k)))
          ?.textContent?.trim() || '';
      const digits = (s: string) => (s || '').replace(/[^\d]/g, '');
      const title = get('h1') || get('.product-title') || find('title') || '';
      const priceText = digits(find('price') || get('[class*=price]'));
      const oldPriceText = digits(
        find('old-price') || get('[class*=old-price]'),
      );
      const unit = get('[class*=unit]') || get('[class*=weight]') || null;
      return { title, priceText, oldPriceText, unit };
    });

    if (!details.title || !details.priceText) return 0;

    let product = await this.productRepo.findOne({
      where: { title: ILike(`%${details.title}%`) },
    });
    if (!product) {
      product = this.productRepo.create({
        title: details.title,
        unit: details.unit || null,
      });
      await this.productRepo.save(product);
    }

    let link = await this.linkRepo.findOne({
      where: { product: { id: product.id }, merchant: { id: merchant.id } },
    });
    if (!link) {
      link = this.linkRepo.create({ product, merchant, url: fullUrl });
      await this.linkRepo.save(link);
    }

    const newPrice = Number(details.priceText);
    const oldPrice = details.oldPriceText
      ? Number(details.oldPriceText)
      : undefined;
    const discountPercent =
      oldPrice && oldPrice > newPrice
        ? Math.round(((oldPrice - newPrice) / oldPrice) * 100)
        : 0;

    const last = await this.priceRepo.findOne({
      where: { link: { id: link.id } },
      order: { date: 'DESC' },
    });

    if (!last || last.price !== newPrice) {
      await this.priceRepo.save(
        this.priceRepo.create({
          link,
          price: newPrice,
          discountPercent,
          date: new Date(),
        }),
      );
      this.logger.log(
        `💰 ${details.title}: ${newPrice}₸ (скидка ${discountPercent}%)`,
      );
      this.collectedProducts.push({
        title: details.title,
        price: newPrice,
        oldPrice,
        discountPercent,
        unit: details.unit,
        url: fullUrl,
        date: new Date().toISOString(),
      });
      if (this.collectedProducts.length % 10 === 0) {
        await this.saveToJsonFile();
      }
      return 1;
    } else {
      this.logger.verbose(`↩️ ${details.title}: цена без изменений`);
      return 0;
    }
  }

  /** Проверка на кнопку "Дальше" */
  private async hasNextPage(page: Page): Promise<boolean> {
    return await page
      .$eval(
        '.arbuz-pagination a.next',
        (el) => !el.classList.contains('disabled'),
      )
      .catch(() => false);
  }

  /** Клик по "Показать ещё" */
  private async expandShowMoreIfAny(page: Page) {
    for (let i = 0; i < 6; i++) {
      const hasButton = await page.$('.arbuz-pagination-show-more');
      if (!hasButton) break;
      const before = await page.$$eval(
        'article.product-card',
        (els) => els.length,
      );
      await page.$eval('.arbuz-pagination-show-more', (btn) =>
        (btn as HTMLElement).click(),
      );
      await this.sleep(700);
      const after = await page.$$eval(
        'article.product-card',
        (els) => els.length,
      );
      this.logger.verbose(`Показать ещё: ${before} → ${after}`);
      if (after <= before) break;
    }
  }

  /** Отключаем лишние ресурсы */
  private async blockResources(page: Page) {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const t = req.resourceType();
      if (['image', 'font', 'stylesheet', 'media', 'xhr', 'fetch'].includes(t))
        req.abort();
      else req.continue();
    });
  }

  /** Логи Puppeteer */
  private attachPageLogging(page: Page, name: string) {
    page.on('console', (msg) =>
      this.logger.debug(`[${name}] ${msg.type()}: ${msg.text()}`),
    );
    page.on('pageerror', (err: Error) =>
      this.logger.error(`[${name}] pageerror: ${err.message}`),
    );
    page.on('requestfailed', (req) =>
      this.logger.warn(
        `[${name}] ${req.method()} ${req.url()} → ${req.failure()?.errorText}`,
      ),
    );
  }

  /** Таймер */
  private async timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const res = await fn();
      this.logger.verbose(`⏱ ${label}: ${(Date.now() - start).toFixed(0)}ms`);
      return res;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `⛔ ${label}: ${(Date.now() - start).toFixed(0)}ms (${err.message})`,
      );
      throw err;
    }
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
