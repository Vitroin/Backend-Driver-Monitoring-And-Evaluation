import { registerAs } from '@nestjs/config';

export default registerAs('cloudinary', () =>({
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
}))