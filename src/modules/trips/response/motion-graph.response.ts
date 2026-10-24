import { z } from 'zod';

export const speedPointSchema = z.object({
  time: z.string().meta({ description: 'When it was read, ISO 8601 in UTC', example: '2026-10-16T12:49:05.000Z' }),
  speed: z.number().meta({ description: 'km/h', example: 42.5 }),
});
export type SpeedPointDto = z.infer<typeof speedPointSchema>;

export const accelerationPointSchema = z.object({
  time: z.string().meta({ description: 'When it was read, ISO 8601 in UTC', example: '2026-10-16T12:49:05.000Z' }),
  acceleration: z.number().meta({ description: 'm/s²', example: 1.8 }),
});
export type AccelerationPointDto = z.infer<typeof accelerationPointSchema>;

export const steeringPointSchema = z.object({
  time: z.string().meta({ description: 'When it was read, ISO 8601 in UTC', example: '2026-10-16T12:49:05.000Z' }),
  steeringWheelAngle: z.number().meta({ description: 'Degrees', example: -12.4 }),
});
export type SteeringPointDto = z.infer<typeof steeringPointSchema>;
