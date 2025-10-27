// src/offers/entities/offer.entity.ts
export class Offer {
  id: number;
  title: string;
  description: string;

  // было offerTypeId: number;
  offerTypeCode: string;

  categoryId: number;

  hasMinPrice: boolean;
  minPrice?: number | null;

  hasConditions: boolean;
  conditions?: string | null;

  hasEndDate: boolean;
  startDate?: Date | null;
  endDate?: Date | null;

  posters: string[];

  createdByUserId: number;
  createdAt: Date;
  updatedAt: Date;
}
