export enum ConfigNames {
  APP_NODE_ENV = 'app.nodeEnv',
  APP_PORT = 'app.port',
  APP_TRUST_PROXY = 'app.trustProxy',
  APP_LOG_LEVEL = 'app.logLevel',
  APP_CLIENT_URL = 'app.clientUrl',

  DB_URL = 'database.url',

  CLOUDINARY_API_KEY = 'cloudinary.apiKey',
  CLOUDINARY_API_SECRET = 'cloudinary.apiSecret',
  CLOUDINARY_CLOUD_NAME = 'cloudinary.cloudName',

  MAILER_USERNAME = 'mailer.username',
  MAILER_PASSWORD = 'mailer.password',

  JWT_SECRET = 'jwt.secret',
  JWT_ACCESS_TOKEN_TTL_MINUTES = 'jwt.accessTokenTtlMinutes',
  JWT_REFRESH_TOKEN_TTL_DAYS = 'jwt.refreshTokenTtlDays',

  REDIS_HOST = 'redis.host',
  REDIS_PORT = 'redis.port',

  OTP_EXPIRY_MINUTES = 'otp.expiryMinutes',
  OTP_SECRET = 'otp.secret',

  FASTAPI_URL = 'fastapi.url',
  FASTAPI_TIMEOUT_MS = 'fastapi.timeoutMs',
  SERVICE_TOKEN = 'fastapi.serviceToken',
}
