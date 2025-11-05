// src/imports/imports.controller.ts
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ImportService } from './import.service';
import { WoltImportRequestDto, WoltImportResultDto } from './dto/wolt-import.dto';

@ApiTags('Import')
@Controller('import')
export class ImportsController {
    constructor(private readonly svc: ImportService) { }

    @Post('wolt')
    @HttpCode(200)
    @ApiOperation({ summary: 'Импорт акций из массива Wolt' })
    async importWolt(@Body() body: WoltImportRequestDto): Promise<WoltImportResultDto> {
        return this.svc.importWoltDeals(body.deals, body.createdByUserId);
    }
}
