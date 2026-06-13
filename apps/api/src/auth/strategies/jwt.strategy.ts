import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtAccessPayload } from '@hearth/contracts';
import { AppConfig } from '../../config/configuration';

export interface AuthenticatedUser {
  id: string;
  phone: string;
  roles: JwtAccessPayload['roles'];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<{ jwt: AppConfig['jwt'] }, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt', { infer: true }).accessSecret,
    });
  }

  // Passport places the return value on request.user.
  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    return { id: payload.sub, phone: payload.phone, roles: payload.roles };
  }
}
