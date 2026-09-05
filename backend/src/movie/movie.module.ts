import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from '../redis/redis.module';
import { MovieController } from './movie.controller';
import { MovieService } from './movie.service';
import { Movie, MovieSchema } from './schemas/movie.schema';
import {
  UserMovieState,
  UserMovieStateSchema,
} from './schemas/user-movie-state.schema';
import { TmdbService } from './tmdb.service';

@Module({
  imports: [
    RedisModule,
    MongooseModule.forFeature([
      { name: Movie.name, schema: MovieSchema },
      { name: UserMovieState.name, schema: UserMovieStateSchema },
    ]),
  ],
  controllers: [MovieController],
  providers: [MovieService, TmdbService],
})
export class MovieModule {}
