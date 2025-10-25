// src/auth/auth.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  // ---------- SIGNUP FLOW ----------

  // Шаг 1: старт регистрации (создаём юзера и отправляем код)
  async signupStart(opts: { identifier: string; password: string }) {
    // создать юзера (если вдруг уже есть - ошибка)
    const user = await this.users.createNewUnverifiedUser({
      identifier: opts.identifier,
      password: opts.password,
    });

    // генерим OTP
    const code = this.generateCode6();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // +5 минут

    await this.users.setOtp(user.id, code, expiresAt);

    // тут отправляем код реальному юзеру:
    // - если это email: sendEmail(user.email, code)
    // - если телефон: sendSms(user.phone, code)
    // сейчас просто считаем что отправили

    return {
      status: 'CODE_SENT',
      userId: user.id,
    };
  }

  // Шаг 2: подтверждаем код -> верифицируем -> логиним
  async signupConfirm(userId: number, code: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Пользователь не найден');

    if (!user.pendingOtpCode || !user.pendingOtpExpiresAt) {
      throw new UnauthorizedException('Нет активного кода');
    }

    const expired = user.pendingOtpExpiresAt.getTime() < Date.now();
    if (expired) {
      throw new UnauthorizedException('Код истёк');
    }

    if (user.pendingOtpCode !== code) {
      throw new UnauthorizedException('Неверный код');
    }

    // ок → активируем
    await this.users.verifyAndActivate(user.id);

    // выдаём jwt
    return this.buildToken(user.id, user.email || user.phone || '');
  }

  // ---------- SIGNIN FLOW ----------

  async signin(opts: { identifier: string; password: string }) {
    const user = await this.users.findByIdentifier(opts.identifier);
    if (!user) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const ok = await bcrypt.compare(opts.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    if (!user.isVerified) {
      // есть пользователь, но он ещё не подтвердил код (регу не закончил)
      throw new ForbiddenException(
        'Аккаунт не подтверждён. Завершите регистрацию.',
      );
    }

    // всё ок → выдаём токен
    return this.buildToken(user.id, user.email || user.phone || '');
  }

  // ---------- HELPERS ----------

  private buildToken(userId: number, identifier: string) {
    const payload = { sub: userId, identifier };
    return {
      access_token: this.jwt.sign(payload),
    };
  }

  private generateCode6() {
    const n = Math.floor(Math.random() * 1_000_000);
    return n.toString().padStart(6, '0');
  }
}
