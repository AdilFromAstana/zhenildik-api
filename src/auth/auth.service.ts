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

  async signupStart(opts: { identifier: string; password: string }) {
    const existing = await this.users.findByIdentifier(opts.identifier);

    if (existing) {
      if (existing.isVerified) {
        // уже полноценный юзер
        throw new BadRequestException({
          message: 'Пользователь уже зарегистрирован. Войдите в аккаунт.',
          code: 'USER_ALREADY_VERIFIED',
        });
      }

      // есть незавершённая регистрация
      // опционально: проверить, совпадает ли пароль
      const samePassword = await bcrypt.compare(
        opts.password,
        existing.passwordHash,
      );

      if (!samePassword) {
        // здесь бизнес-решение:
        // либо просто игнорить новый пароль,
        // либо требовать "забыли пароль" / другой флоу
        throw new BadRequestException({
          message:
            'Регистрация уже начата с другим паролем. Войдите и завершите подтверждение или сбросьте пароль.',
          code: 'SIGNUP_ALREADY_STARTED_DIFFERENT_PASSWORD',
        });
      }

      const code = this.generateCode6();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await this.users.setOtp(existing.id, code, expiresAt);

      return {
        status: 'CODE_RESENT',
        userId: existing.id,
      };
    }

    // если юзера нет – создаём
    const user = await this.users.createNewUnverifiedUser({
      identifier: opts.identifier,
      password: opts.password,
    });

    const code = this.generateCode6();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.users.setOtp(user.id, code, expiresAt);

    return {
      status: 'CODE_SENT',
      userId: user.id,
    };
  }

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
      const code = this.generateCode6();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await this.users.setOtp(user.id, code, expiresAt);

      throw new ForbiddenException({
        message: 'Аккаунт не подтверждён. Мы отправили новый код.',
        code: 'ACCOUNT_NOT_VERIFIED',
        userId: user.id,
        resend: true,
      });
    }

    return this.buildToken(
      user.id,
      user.email || user.phone || opts.identifier,
    );
  }

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
