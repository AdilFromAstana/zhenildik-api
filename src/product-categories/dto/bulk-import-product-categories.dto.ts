// src/product-categories/dto/bulk-import-product-categories.dto.ts
import { IsObject } from 'class-validator';

export type ProductCategoryTree = {
  [topLevel: string]: {
    [child: string]: unknown;
  };
};

export class BulkImportProductCategoriesDto {
  @IsObject()
  tree: ProductCategoryTree;
}
