// src/product-categories/product-categories.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { ProductCategory } from './product-category.entity';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { BulkImportProductCategoriesDto } from './dto/bulk-import-product-categories.dto';

@Injectable()
export class ProductCategoriesService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly repo: Repository<ProductCategory>,
  ) {}

  async create(dto: CreateProductCategoryDto): Promise<ProductCategory> {
    const entity = this.repo.create({
      name: dto.name,
      parentId: dto.parentId ?? null,
      sortOrder: dto.sortOrder ?? 0,
    });

    entity.slug = await this.generateSlug(dto.name);

    if (dto.parentId) {
      const parent = await this.repo.findOne({ where: { id: dto.parentId } });
      entity.depth = parent ? parent.depth + 1 : 0;
    } else {
      entity.depth = 0;
    }

    return this.repo.save(entity);
  }

  async findAll(): Promise<ProductCategory[]> {
    return this.repo.find({
      relations: ['parent', 'children'],
      order: { depth: 'ASC', sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findTree(): Promise<ProductCategory[]> {
    const all = await this.repo.find({
      order: { depth: 'ASC', sortOrder: 'ASC', name: 'ASC' },
    });

    const map = new Map<
      number,
      ProductCategory & { children: ProductCategory[] }
    >();

    all.forEach((cat) => {
      (cat as any).children = [];
      map.set(cat.id, cat as any);
    });

    const roots: ProductCategory[] = [];

    all.forEach((cat) => {
      if (cat.parentId) {
        const parent = map.get(cat.parentId);
        if (parent) {
          (parent.children as any).push(cat as any);
        } else {
          roots.push(cat);
        }
      } else {
        roots.push(cat);
      }
    });

    return roots;
  }

  /**
   * Bulk-импорт из дерева вида:
   * {
   *   "Алкоголь": { "Вермут": [...], "Вино": [...] },
   *   "Все для выпечки": { ... }
   * }
   */
  async bulkImport(dto: BulkImportProductCategoriesDto): Promise<void> {
    const tree = dto.tree;

    // 1. Создаём все корневые категории
    const topCategories: ProductCategory[] = [];

    for (const [topName] of Object.entries(tree)) {
      let top = await this.repo.findOne({
        where: { name: topName, parentId: IsNull() },
      });

      if (!top) {
        top = this.repo.create({
          name: topName,
          parentId: null,
          depth: 0,
          sortOrder: 0,
        });
        top.slug = await this.generateSlug(topName);
        topCategories.push(top);
      }
    }

    // 2. Сохраняем корневые категории, чтобы получить их ID
    const savedTop = await this.repo.save(topCategories);

    // создаём карту name → id
    const topMap = new Map<string, ProductCategory>();
    savedTop.forEach((item) => topMap.set(item.name, item));

    // 3. Создаём дочерние категории
    const childrenToSave: ProductCategory[] = [];

    for (const [topName, childrenObj] of Object.entries(tree)) {
      const parent = topMap.get(topName);
      if (!parent) continue;

      const childNames = Object.keys(childrenObj);

      const existingChildren = await this.repo.find({
        where: {
          name: In(childNames),
          parentId: parent.id,
        },
      });

      const existingChildMap = new Map<string, ProductCategory>();
      existingChildren.forEach((c) => existingChildMap.set(c.name, c));

      childNames.forEach((childName, idx) => {
        if (!existingChildMap.has(childName)) {
          const child = this.repo.create({
            name: childName,
            parentId: parent.id,
            depth: 1,
            sortOrder: idx,
            slug: this.slugify(`${parent.name}-${childName}`),
          });
          childrenToSave.push(child);
        }
      });
    }

    if (childrenToSave.length) {
      await this.repo.save(childrenToSave);
    }
  }

  private async generateSlug(name: string): Promise<string> {
    const base = this.slugify(name);
    let slug = base;
    let i = 1;
    while (await this.repo.findOne({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }

  private generateChildSlug(parentName: string, childName: string): string {
    // Можно упростить, не проверяя уникальность здесь, а довериться общей generateSlug
    return this.slugify(`${parentName}-${childName}`);
  }

  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9\-]+/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
