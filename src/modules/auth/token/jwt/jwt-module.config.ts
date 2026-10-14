import { ConfigNames } from '@config';
import { ConfigService } from '@nestjs/config';
import { JwtModuleAsyncOptions } from '@nestjs/jwt';
import { JWT_ALGORITHM, JWT_AUDIENCE, JWT_ISSUER } from '../token.constants';

export const jwtConfig = (): JwtModuleAsyncOptions => ({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    secret: configService.getOrThrow<string>(ConfigNames.JWT_SECRET),
    signOptions: {
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: configService.getOrThrow<number>(ConfigNames.JWT_ACCESS_TOKEN_TTL_MINUTES) * 60,
    },
    verifyOptions: {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    },
  }),
});
