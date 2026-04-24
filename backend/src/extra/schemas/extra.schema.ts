import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ExtraCategory } from '../constants/extra-category.enum';

export type ExtraDocument = ExtraItem & Document;

@Schema({ timestamps: true })
export class ExtraItem {
  @Prop({ type: String, required: true, unique: true, index: true })
  extraCode!: string;

  @Prop({ type: String, enum: ExtraCategory, required: true, index: true })
  category!: ExtraCategory;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, default: null })
  description?: string | null;

  @Prop({ type: String, default: null })
  value?: string | null;

  @Prop({ type: Boolean, default: true })
  enabled!: boolean;
}

export const ExtraSchema = SchemaFactory.createForClass(ExtraItem);