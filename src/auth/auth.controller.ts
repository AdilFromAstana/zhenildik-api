// src/auth/auth.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SignupStartDto } from './dto/signup-start.dto';
import { SignupConfirmDto } from './dto/signup-confirm.dto';
import { SigninDto } from './dto/signin.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @ApiOperation({
    summary: 'Регистрация (шаг 1): создать аккаунт и отправить код',
  })
  @ApiBody({ type: SignupStartDto })
  @Post('signup/start')
  signupStart(@Body() dto: SignupStartDto) {
    return this.auth.signupStart(dto);
  }

  @ApiOperation({ summary: 'Регистрация (шаг 2): подтвердить код и войти' })
  @ApiBody({ type: SignupConfirmDto })
  @Post('signup/confirm')
  signupConfirm(@Body() dto: SignupConfirmDto) {
    return this.auth.signupConfirm(dto.userId, dto.code);
  }

  @ApiOperation({ summary: 'Логин: обычный вход по паролю (без кода)' })
  @ApiBody({ type: SigninDto })
  @Post('signin')
  signin(@Body() dto: SigninDto) {
    return this.auth.signin(dto);
  }
}
