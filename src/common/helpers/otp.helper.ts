import * as crypto from 'node:crypto';

export const generateOtpCode = (): string => crypto.randomInt(100000, 1000000).toString();