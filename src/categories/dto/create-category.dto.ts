import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Еда и напитки', description: 'Название категории' })
  name: string;

  @ApiProperty({ example: 'food', description: 'Уникальный slug категории' })
  slug: string;

  @ApiProperty({
    example: '🍔',
    description: 'Иконка (emoji)',
    required: false,
  })
  icon?: string;

  @ApiProperty({
    example: 1,
    description: 'ID родительской категории',
    required: false,
  })
  parentId?: number;
}
