// src/auth/guards/jwt-auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Нет токена');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = this.jwt.verify(token);
      req.user = payload; // теперь req.user доступен в контроллере
      return true;
    } catch (e) {
      throw new UnauthorizedException('Невалидный токен');
    }
  }
}
