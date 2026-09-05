import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MovieQueryDto, MovieSearchQueryDto } from './dto/movie-query.dto';
import { MovieStateDto } from './dto/movie-state.dto';
import { MovieService } from './movie.service';

@Controller('movies')
export class MovieController {
  constructor(private readonly movies: MovieService) {}

  @Get('trending')
  trending(@Query() query: MovieQueryDto) {
    return this.movies.trending(query.mediaType, query.page, query.language);
  }

  @Get('popular')
  popular(@Query() query: MovieQueryDto) {
    const mediaType = query.mediaType === 'tv' ? 'tv' : 'movie';
    return this.movies.popular(mediaType, query.page, query.language);
  }

  @Get('search')
  search(@Query() query: MovieSearchQueryDto) {
    return this.movies.search(
      query.q,
      query.mediaType,
      query.page,
      query.language,
    );
  }

  @Get('countries')
  countries(@Query('language') language = 'en-US') {
    return this.movies.countries(language);
  }

  @Get('country/:countryCode')
  country(@Param('countryCode') code: string, @Query() query: MovieQueryDto) {
    return this.movies.country(
      code,
      query.mediaType === 'tv' ? 'tv' : 'movie',
      query.category,
      query.page,
      query.language,
    );
  }

  @Get('me/watched')
  @UseGuards(JwtAuthGuard)
  watched(
    @GetCurrentUser('userId') userId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
  ) {
    return this.movies.listUser(userId, 'watched', Math.max(1, page));
  }

  @Get('me/favorites')
  @UseGuards(JwtAuthGuard)
  favorites(
    @GetCurrentUser('userId') userId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
  ) {
    return this.movies.listUser(userId, 'favorite', Math.max(1, page));
  }

  @Get('me/recent')
  @UseGuards(JwtAuthGuard)
  recent(
    @GetCurrentUser('userId') userId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
  ) {
    return this.movies.listUser(userId, 'recent', Math.max(1, page));
  }

  @Get('me/journey')
  @UseGuards(JwtAuthGuard)
  journey(@GetCurrentUser('userId') userId: string) {
    return this.movies.journey(userId);
  }

  @Get(':id/similar')
  similar(@Param('id') id: string, @Query() query: MovieQueryDto) {
    return this.movies.similar(
      id,
      query.mediaType === 'tv' ? 'tv' : 'movie',
      query.page,
      query.language,
    );
  }

  @Get(':id/videos')
  videos(@Param('id') id: string, @Query() query: MovieQueryDto) {
    return this.movies.videos(
      id,
      query.mediaType === 'tv' ? 'tv' : 'movie',
      query.language,
    );
  }

  @Post(':id/watched')
  @UseGuards(JwtAuthGuard)
  markWatched(
    @GetCurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query() state: MovieStateDto,
  ) {
    return this.movies.setState(userId, id, state.mediaType, 'watched', true);
  }

  @Delete(':id/watched')
  @UseGuards(JwtAuthGuard)
  unmarkWatched(
    @GetCurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query() state: MovieStateDto,
  ) {
    return this.movies.setState(userId, id, state.mediaType, 'watched', false);
  }

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  markFavorite(
    @GetCurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query() state: MovieStateDto,
  ) {
    return this.movies.setState(userId, id, state.mediaType, 'favorite', true);
  }

  @Delete(':id/favorite')
  @UseGuards(JwtAuthGuard)
  unmarkFavorite(
    @GetCurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query() state: MovieStateDto,
  ) {
    return this.movies.setState(userId, id, state.mediaType, 'favorite', false);
  }

  @Get(':id')
  details(@Param('id') id: string, @Query() query: MovieQueryDto) {
    return this.movies.details(
      id,
      query.mediaType === 'tv' ? 'tv' : 'movie',
      query.language,
    );
  }
}
