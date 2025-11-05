import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsInt,
    IsOptional,
    Min,
    ValidateNested,
    IsString,
} from 'class-validator';

// --- item внутри ресторана ---
export class WoltItemDto {
    @ApiProperty() @IsString() title: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() discountText?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() newPrice?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() oldPrice?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() image?: string;
}

// --- информация о ресторане ---
export class WoltDealInfoDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
    @ApiProperty({ required: false, type: [String] }) @IsOptional() categories?: string[];
    @ApiProperty({ required: false }) @IsOptional() @IsString() address?: string;
    @ApiProperty({ required: false, type: [Number] }) @IsOptional() coordinates?: number[];
    @ApiProperty({ required: false, type: Object }) @IsOptional() schedule?: Record<string, string>;
    @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() website?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() logo?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() heroImage?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() brandLink?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() brandSlug?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() brandName?: string;
}

// --- ресторан / бренд ---
export class WoltDealDto {
    @ApiProperty() @IsString() name: string;
    @ApiProperty() @IsString() link: string;
    @ApiProperty() @IsInt() discountCount: number;

    @ApiProperty({ type: [WoltItemDto] })
    @ValidateNested({ each: true }) // ✅ ВАЖНО
    @Type(() => WoltItemDto) // ✅ ВАЖНО
    @IsArray()
    items: WoltItemDto[];

    @ApiProperty({ type: WoltDealInfoDto })
    @ValidateNested() // ✅ ВАЖНО
    @Type(() => WoltDealInfoDto) // ✅ ВАЖНО
    info: WoltDealInfoDto;
}

// --- основной DTO для импорта ---
export class WoltImportRequestDto {
    @ApiProperty({ type: [WoltDealDto] })
    @ValidateNested({ each: true }) // ✅ ВАЖНО
    @Type(() => WoltDealDto) // ✅ ВАЖНО
    @IsArray()
    deals: WoltDealDto[];

    @ApiProperty({ example: 1 })
    @IsInt()
    @Min(1)
    createdByUserId: number;
}

// --- ответ ---
export class WoltImportResultDto {
    @ApiProperty() businessesCreated: number;
    @ApiProperty() locationsCreated: number;
    @ApiProperty() offersCreated: number;
    @ApiProperty({ type: [String] }) warnings: string[];
}
