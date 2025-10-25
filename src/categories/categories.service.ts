import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Category } from './category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private repo: Repository<Category>,
  ) {}

  async create(dto: CreateCategoryDto) {
    const parent = dto.parentId
      ? await this.repo.findOne({ where: { id: dto.parentId } })
      : null;

    const category = this.repo.create({
      name: dto.name,
      slug: dto.slug,
      parent, // 👈 теперь можно спокойно передавать null
    });

    return this.repo.save(category);
  }

  async bulkCreate(categories: any[]) {
    for (const cat of categories) {
      const parent = await this.repo.save({
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
      });

      if (cat.sub?.length) {
        for (const sub of cat.sub) {
          await this.repo.save({
            name: sub,
            slug: `${cat.slug}-${sub.toLowerCase().replace(/\s+/g, '-')}`,
            parent,
          });
        }
      }
    }
    return { message: '✅ Bulk categories created' };
  }

  // categories.service.ts
  async findByParent(parentId?: number) {
    return this.repo.find({
      where: parentId ? { parent: { id: parentId } } : { parent: IsNull() },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number) {
    return this.repo.findOne({
      where: { id },
      relations: ['children', 'parent'],
    });
  }

  async remove(id: number) {
    return this.repo.delete(id);
  }
}
