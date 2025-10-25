// src/deals/dto/create-deal.dto.ts
export class CreateDealDto {
  title: string;
  description: string;
  oldPrice?: number;
  newPrice?: number;
  citySlug: string; // в каком городе действует акция
  expiresAt?: string; // или Date, зависит от фронта
}
