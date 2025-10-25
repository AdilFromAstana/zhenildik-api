import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SigninDto {
  @ApiProperty({
    description: 'Email или телефон, под которым зарегистрировался',
    example: 'aika@example.com',
  })
  @IsString()
  identifier: string;

  @ApiProperty({
    description: 'Пароль, указанный при регистрации',
    example: 'myStrongPass123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
