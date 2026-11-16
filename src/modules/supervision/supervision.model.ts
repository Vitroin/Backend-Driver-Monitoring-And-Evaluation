import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

@Schema({ timestamps: true})
export class Supervision {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Organization', required: true })
  organization: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  supervisor: Types.ObjectId; // instructor / fleet analyst / insurance analyst

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  driver: Types.ObjectId;
}

export const SupervisionSchema = SchemaFactory.createForClass(Supervision);

SupervisionSchema.index({ supervisor: 1, driver: 1 }, { unique: true }); // no duplicate assignment
SupervisionSchema.index({ driver: 1 }); // "who supervises this driver"
