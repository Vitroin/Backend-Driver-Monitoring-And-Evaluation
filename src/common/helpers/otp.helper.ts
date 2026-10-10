import { randomInt } from 'node:crypto';

export const generateOtpCode = (): string => randomInt(100000, 1000000).toString();