import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SignupStartDto {
  @ApiProperty({
    description:
      'Email или телефон (например, "aika@example.com" или "+77771234567")',
    example: 'aika@example.com',
  })
  @IsString()
  identifier: string;

  @ApiProperty({
    description: 'Пароль, который пользователь установит для входа',
    example: 'myStrongPass123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  // Если хочешь собирать имя бизнеса/контактное имя сразу:
  @ApiProperty({
    description: 'Имя или название компании',
    example: 'Aika Beauty',
    required: false,
  })
  @IsString()
  name?: string;
}
