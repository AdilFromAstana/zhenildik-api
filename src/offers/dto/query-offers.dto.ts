// src/offers/dto/query-offers.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsOptional,
    IsString,
    IsNumber,
    IsBoolean,
    IsEnum,
    Min,
    Max,
} from 'class-validator';

export enum SortBy {
    createdAt = 'createdAt',
    title = 'title',
    minPrice = 'minPrice',
}

export enum SortOrder {
    ASC = 'ASC',
    DESC = 'DESC',
}

export class QueryOffersDto {
    @ApiPropertyOptional({ example: 1, default: 1 })
    @Type(() => Number)
    @Min(1)
    @Max(100)
    page: number = 1;

    @ApiPropertyOptional({ example: 10, default: 10 })
    @Type(() => Number)
    @Min(1)
    @Max(100)
    limit: number = 10;

    @ApiPropertyOptional({ example: 'pizza' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ example: 3 })
    @IsOptional()
    @Type(() => Number)
    categoryId?: number;

    @ApiPropertyOptional({ example: 'DISCOUNT_PERCENT' })
    @IsOptional()
    @IsString()
    offerTypeCode?: string;

    @ApiPropertyOptional({
        example: true,
        description: 'Только активные (дата окончания >= сегодня)',
    })
    @IsOptional()
    @Type(() => Boolean)
    activeOnly?: boolean;

    @ApiPropertyOptional({ enum: SortBy, default: SortBy.createdAt })
    @IsOptional()
    @IsEnum(SortBy)
    sortBy: SortBy = SortBy.createdAt;

    @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
    @IsOptional()
    @IsEnum(SortOrder)
    sortOrder: SortOrder = SortOrder.DESC;
}