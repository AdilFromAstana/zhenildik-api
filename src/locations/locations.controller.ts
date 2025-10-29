import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Patch,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('locations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // ➕ Создать новую локацию
  @Post()
  async create(@Body() dto: CreateLocationDto, @Req() req: any) {
    return this.locationsService.create({
      ...dto,
      createdByUserId: Number(req.user.sub),
    });
  }

  // 📋 Получить все локации пользователя
  @Get()
  async findAll(@Req() req: any) {
    return this.locationsService.findAllByUser(Number(req.user.sub));
  }

  // 🔍 Получить одну локацию по ID
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.locationsService.findOneByUser(id, Number(req.user.sub));
  }

  // ✏️ Обновить локацию
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateLocationDto>,
    @Req() req: any,
  ) {
    return this.locationsService.update(id, dto, Number(req.user.sub));
  }

  // ❌ Удалить локацию
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.locationsService.remove(id, Number(req.user.sub));
  }
}
