import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MovieDocument = HydratedDocument<Movie>;

@Schema({ timestamps: true, collection: 'movies' })
export class Movie {
  @Prop({ required: true, min: 1 })
  tmdbId: number;

  @Prop({ required: true, enum: ['movie', 'tv'] })
  mediaType: 'movie' | 'tv';

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '', trim: true })
  originalTitle: string;

  @Prop({ default: '' })
  overview: string;

  @Prop({ type: String, default: null })
  posterPath?: string | null;

  @Prop({ type: String, default: null })
  backdropPath?: string | null;

  @Prop({ type: Date, default: null })
  releaseDate?: Date | null;

  @Prop({ default: 0, min: 0, max: 10 })
  rating: number;

  @Prop({ default: 0, min: 0 })
  voteCount: number;

  @Prop({ type: [String], default: [] })
  genres: string[];

  @Prop({ default: '' })
  originalLanguage: string;

  @Prop({ type: [String], default: [] })
  originCountryCodes: string[];

  @Prop({ type: Number, default: null })
  runtime?: number | null;

  @Prop({ type: String, default: null })
  status?: string | null;
}

export const MovieSchema = SchemaFactory.createForClass(Movie);
MovieSchema.index({ tmdbId: 1, mediaType: 1 }, { unique: true });
MovieSchema.index({ originCountryCodes: 1 });
MovieSchema.index({ releaseDate: -1 });
MovieSchema.index({ rating: -1 });
