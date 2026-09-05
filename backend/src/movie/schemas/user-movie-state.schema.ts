import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Movie } from './movie.schema';

export type UserMovieStateDocument = HydratedDocument<UserMovieState>;

@Schema({ timestamps: true, collection: 'user_movie_states' })
export class UserMovieState {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Movie.name, required: true })
  movieId: Types.ObjectId;

  @Prop({ default: false })
  watched: boolean;

  @Prop({ default: false })
  favorite: boolean;

  @Prop({ type: Date, default: null })
  watchedAt?: Date | null;

  @Prop({ type: Date, default: null })
  favoritedAt?: Date | null;
}

export const UserMovieStateSchema =
  SchemaFactory.createForClass(UserMovieState);
UserMovieStateSchema.index({ userId: 1, movieId: 1 }, { unique: true });
UserMovieStateSchema.index({ userId: 1, watched: 1, watchedAt: -1 });
UserMovieStateSchema.index({ userId: 1, favorite: 1, favoritedAt: -1 });
