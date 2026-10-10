import { registerAs } from "@nestjs/config";

export default registerAs("mailer", () => ({
  username: process.env.MAILER_USERNAME,
  password: process.env.MAILER_PASSWORD,
}));