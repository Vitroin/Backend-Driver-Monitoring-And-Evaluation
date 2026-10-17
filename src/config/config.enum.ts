export enum ConfigNames {
  DB_URL = 'database.url',

  CLOUDINARY_API_KEY = 'cloudinary.apiKey',
  CLOUDINARY_API_SECRET = 'cloudinary.apiSecret',
  CLOUDINARY_CLOUD_NAME = 'cloudinary.cloudName',

  MAILER_USERNAME = 'mailer.username',
  MAILER_PASSWORD = 'mailer.password',

  JWT_SECRET = 'jwt.secret',

  REDIS_HOST = 'redis.host',
  REDIS_PORT = 'redis.port',

  APP_CLIENT_URL = 'app.clientUrl',
  APP_CLIENT_PORT = 'app.clientPort',

  OTP_EXPIRY_MINUTES = 'otp.expiryMinutes',
  OTP_SECRET = 'otp.secret',

  JWT_ACCESS_TOKEN_TTL_MINUTES = 'jwt.accessTokenTtlMinutes',
  JWT_REFRESH_TOKEN_TTL_DAYS = 'jwt.refreshTokenTtlDays',

  FASTAPI_URL = 'fastapi.url',
  SERVICE_TOKEN = 'fastapi.serviceToken',
}
