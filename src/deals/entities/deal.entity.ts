// src/deals/entities/deal.entity.ts
export class Deal {
  id: number;
  title: string;
  description: string;
  oldPrice?: number;
  newPrice?: number;
  citySlug: string; // "astana", "almaty", ...
  expiresAt?: Date;
  createdByUserId: number;
  createdAt: Date;
}
