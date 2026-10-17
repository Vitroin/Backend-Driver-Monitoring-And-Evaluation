import {registerAs} from '@nestjs/config';

export default registerAs('fastapi', () => ({
  url: process.env.FASTAPI_URL,
  serviceToken: process.env.SERVICE_TOKEN,
}))
