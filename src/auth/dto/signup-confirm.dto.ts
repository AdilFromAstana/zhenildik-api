import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Length } from 'class-validator';

export class SignupConfirmDto {
  @ApiProperty({
    description: 'ID пользователя, полученный на шаге signup/start',
    example: 42,
  })
  @IsNumber()
  userId: number;

  @ApiProperty({
    description: '6-значный код подтверждения',
    example: '123456',
  })
  @IsString()
  @Length(6, 6)
  code: string;
}
