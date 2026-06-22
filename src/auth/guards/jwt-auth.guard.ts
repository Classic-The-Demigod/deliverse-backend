import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../auth.constants';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>(
          'JWT_ACCESS_SECRET',
          'deliverse-dev-access-secret',
        ),
      });
      
      console.log('[JwtAuthGuard] Decoded Payload:', payload);

      request.user = {
        userId: payload.sub || (payload as any).userId || (payload as any).id,
        email: payload.email,
        role: payload.role,
        iat: payload.iat,
        exp: payload.exp,
      };
      
      console.log('[JwtAuthGuard] Set request.user:', request.user);

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}

function extractBearerToken(request: Request): string | undefined {
  const authorization = request.headers.authorization;
  if (authorization) {
    const [type, token] = authorization.split(' ');
    if (type === 'Bearer' && token) {
      return token;
    }
  }

  // Fallback to cookie
  if (request.cookies && request.cookies.accessToken) {
    return request.cookies.accessToken;
  }

  return undefined;
}
