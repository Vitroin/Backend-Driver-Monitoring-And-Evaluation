import { z } from 'zod';

export const speedPointSchema = z.object({
  time: z.string().meta({ example: '12:49:05' }),
  speed: z.number().meta({ description: 'km/h', example: 42.5 }),
});
export type SpeedPointDto = z.infer<typeof speedPointSchema>;

export const accelerationPointSchema = z.object({
  time: z.string().meta({ example: '12:49:05' }),
  acceleration: z.number().meta({ description: 'm/s²', example: 1.8 }),
});
export type AccelerationPointDto = z.infer<typeof accelerationPointSchema>;

export const steeringPointSchema = z.object({
  time: z.string().meta({ example: '12:49:05' }),
  steeringWheelAngle: z.number().meta({ description: 'Degrees', example: -12.4 }),
});
export type SteeringPointDto = z.infer<typeof steeringPointSchema>;
