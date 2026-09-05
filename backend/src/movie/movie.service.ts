import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginatedMovies, TripSathiMovie } from './dto/movie-response.dto';
import { Movie, MovieDocument } from './schemas/movie.schema';
import {
  UserMovieState,
  UserMovieStateDocument,
} from './schemas/user-movie-state.schema';
import { TmdbService } from './tmdb.service';

const genreNames: Record<number, string> = {
  12: 'Adventure',
  14: 'Fantasy',
  16: 'Animation',
  18: 'Drama',
  27: 'Horror',
  28: 'Action',
  35: 'Comedy',
  36: 'History',
  53: 'Thriller',
  80: 'Crime',
  99: 'Documentary',
  878: 'Science Fiction',
  9648: 'Mystery',
  10749: 'Romance',
  10751: 'Family',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10765: 'Sci-Fi & Fantasy',
  10768: 'War & Politics',
};

@Injectable()
export class MovieService {
  constructor(
    @InjectModel(Movie.name) private readonly movies: Model<MovieDocument>,
    @InjectModel(UserMovieState.name)
    private readonly states: Model<UserMovieStateDocument>,
    private readonly tmdb: TmdbService,
  ) {}

  async trending(
    mediaType: 'movie' | 'tv' | 'all',
    page: number,
    language: string,
  ) {
    return this.persistPage(
      await this.tmdb.trending(mediaType, page, language),
      mediaType,
    );
  }

  async popular(mediaType: 'movie' | 'tv', page: number, language: string) {
    return this.persistPage(
      await this.tmdb.popular(mediaType, page, language),
      mediaType,
    );
  }

  async search(
    query: string,
    mediaType: 'movie' | 'tv' | 'all',
    page: number,
    language: string,
  ) {
    return this.persistPage(
      await this.tmdb.search(query.trim(), mediaType, page, language),
      mediaType,
    );
  }

  async countries(language: string) {
    const raw = await this.tmdb.countries(language);
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => ({
        code: String(item?.iso_3166_1 ?? '').toUpperCase(),
        name: String(item?.english_name ?? item?.native_name ?? '').trim(),
        nativeName: String(item?.native_name ?? '').trim(),
      }))
      .filter((item) => item.code.length === 2 && item.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async country(
    code: string,
    mediaType: 'movie' | 'tv',
    category: string,
    page: number,
    language: string,
  ) {
    const normalized = code.trim().toUpperCase();
    const raw = await this.tmdb.country(
      normalized,
      mediaType,
      category,
      page,
      language,
    );
    if (Array.isArray(raw?.results)) {
      for (const item of raw.results) {
        if (
          !Array.isArray(item?.origin_country) ||
          item.origin_country.length === 0
        ) {
          item.origin_country = [normalized];
        }
      }
    }
    return this.persistPage(raw, mediaType);
  }

  async details(
    id: string,
    mediaType: 'movie' | 'tv',
    language: string,
    userId?: string,
  ) {
    let movie = Types.ObjectId.isValid(id)
      ? await this.movies.findById(id)
      : null;
    if (!movie) {
      const externalId = Number(id);
      if (!Number.isInteger(externalId) || externalId < 1)
        throw new NotFoundException('Movie not found');
      const raw = await this.tmdb.details(externalId, mediaType, language);
      movie = await this.upsertRaw(raw, mediaType);
    }
    const raw = await this.tmdb.details(
      movie.tmdbId,
      movie.mediaType,
      language,
    );
    movie = await this.upsertRaw(raw, movie.mediaType);
    const state = userId
      ? await this.states.findOne({
          userId: new Types.ObjectId(userId),
          movieId: movie._id,
        })
      : null;
    return this.toResponse(movie, state, raw);
  }

  async similar(
    id: string,
    mediaType: 'movie' | 'tv',
    page: number,
    language: string,
  ) {
    const movie = await this.resolveMovie(id, mediaType, language);
    return this.persistPage(
      await this.tmdb.similar(movie.tmdbId, movie.mediaType, page, language),
      movie.mediaType,
    );
  }

  async videos(id: string, mediaType: 'movie' | 'tv', language: string) {
    const movie = await this.resolveMovie(id, mediaType, language);
    const raw = await this.tmdb.videos(movie.tmdbId, movie.mediaType, language);
    return this.normalizeVideos(raw?.results);
  }

  async listUser(
    userId: string,
    type: 'watched' | 'favorite' | 'recent',
    page: number,
  ) {
    const limit = 20;
    const filter = {
      userId: new Types.ObjectId(userId),
      [type === 'favorite' ? 'favorite' : 'watched']: true,
    };
    const sort: Record<string, 1 | -1> =
      type === 'favorite' ? { favoritedAt: -1 } : { watchedAt: -1 };
    const [states, total] = await Promise.all([
      this.states
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate<{ movieId: MovieDocument }>('movieId'),
      this.states.countDocuments(filter),
    ]);
    const items = states
      .filter((state) => state.movieId)
      .map((state) => this.toResponse(state.movieId, state));
    return {
      items,
      page,
      totalPages: Math.ceil(total / limit),
      totalResults: total,
      hasMore: page * limit < total,
    };
  }

  async setState(
    userId: string,
    id: string,
    mediaType: 'movie' | 'tv',
    field: 'watched' | 'favorite',
    enabled: boolean,
  ) {
    const movie = await this.resolveMovie(id, mediaType, 'en-US');
    const timestamp = field === 'watched' ? 'watchedAt' : 'favoritedAt';
    const state = await this.states.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), movieId: movie._id },
      { $set: { [field]: enabled, [timestamp]: enabled ? new Date() : null } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (!state.watched && !state.favorite)
      await this.states.deleteOne({ _id: state._id });
    return this.toResponse(movie, state);
  }

  async journey(userId: string) {
    const match = { userId: new Types.ObjectId(userId), watched: true };
    const [rows, watchedCount] = await Promise.all([
      this.states.aggregate<{ _id: string; count: number }>([
        { $match: match },
        {
          $lookup: {
            from: 'movies',
            localField: 'movieId',
            foreignField: '_id',
            as: 'movie',
          },
        },
        { $unwind: '$movie' },
        {
          $unwind: {
            path: '$movie.originCountryCodes',
            preserveNullAndEmptyArrays: true,
          },
        },
        { $group: { _id: '$movie.originCountryCodes', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.states.countDocuments(match),
    ]);
    return {
      watchedCount,
      countries: rows
        .filter((row) => row._id)
        .slice(0, 8)
        .map((row) => ({ code: row._id, count: row.count })),
    };
  }

  private async resolveMovie(
    id: string,
    mediaType: 'movie' | 'tv',
    language: string,
  ) {
    if (Types.ObjectId.isValid(id)) {
      const existing = await this.movies.findById(id);
      if (existing) return existing;
    }
    const externalId = Number(id);
    if (!Number.isInteger(externalId) || externalId < 1)
      throw new NotFoundException('Movie not found');
    return this.upsertRaw(
      await this.tmdb.details(externalId, mediaType, language),
      mediaType,
    );
  }

  private async persistPage(
    raw: any,
    fallbackType: 'movie' | 'tv' | 'all',
  ): Promise<PaginatedMovies> {
    const results = Array.isArray(raw?.results) ? raw.results : [];
    const documents = await Promise.all(
      results
        .filter((item: any) => item?.id)
        .map((item: any) => {
          const type =
            item.media_type === 'tv' || item.media_type === 'movie'
              ? item.media_type
              : fallbackType === 'all'
                ? item.name
                  ? 'tv'
                  : 'movie'
                : fallbackType;
          return this.upsertRaw(item, type);
        }),
    );
    const page = Number(raw?.page) || 1;
    const totalPages = Math.min(Number(raw?.total_pages) || page, 500);
    return {
      items: documents.map((item) => this.toResponse(item)),
      page,
      totalPages,
      totalResults: Number(raw?.total_results) || documents.length,
      hasMore: page < totalPages,
    };
  }

  private async upsertRaw(raw: any, mediaType: 'movie' | 'tv') {
    const release = raw?.release_date ?? raw?.first_air_date;
    const genreList = Array.isArray(raw?.genres)
      ? raw.genres.map((g: any) => String(g?.name ?? '')).filter(Boolean)
      : Array.isArray(raw?.genre_ids)
        ? raw.genre_ids.map((id: number) => genreNames[id]).filter(Boolean)
        : [];
    const countries = Array.isArray(raw?.origin_country)
      ? raw.origin_country
      : Array.isArray(raw?.production_countries)
        ? raw.production_countries.map((c: any) => c?.iso_3166_1)
        : [];
    return this.movies.findOneAndUpdate(
      { tmdbId: Number(raw.id), mediaType },
      {
        $set: {
          title: String(
            raw.title ??
              raw.name ??
              raw.original_title ??
              raw.original_name ??
              'Untitled',
          ),
          originalTitle: String(raw.original_title ?? raw.original_name ?? ''),
          overview: String(raw.overview ?? ''),
          posterPath: raw.poster_path || null,
          backdropPath: raw.backdrop_path || null,
          releaseDate:
            release && !Number.isNaN(Date.parse(release))
              ? new Date(release)
              : null,
          rating: Math.max(0, Math.min(10, Number(raw.vote_average) || 0)),
          voteCount: Math.max(0, Number(raw.vote_count) || 0),
          genres: genreList,
          originalLanguage: String(raw.original_language ?? ''),
          originCountryCodes: countries.filter(Boolean),
          runtime: Number(raw.runtime ?? raw.episode_run_time?.[0]) || null,
          status: raw.status ? String(raw.status) : null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  private toResponse(
    movie: MovieDocument,
    state?: { watched?: boolean; favorite?: boolean } | null,
    raw?: any,
  ): TripSathiMovie {
    const imageBase =
      process.env.TMDB_IMAGE_BASE_URL?.trim() || 'https://image.tmdb.org/t/p';
    const countryCode = movie.originCountryCodes?.[0] ?? null;
    const trailer = this.normalizeVideos(raw?.videos?.results)[0] ?? null;
    return {
      id: movie._id.toString(),
      externalId: movie.tmdbId,
      mediaType: movie.mediaType,
      title: movie.title,
      originalTitle: movie.originalTitle,
      posterUrl: movie.posterPath
        ? `${imageBase}/w342${movie.posterPath}`
        : null,
      backdropUrl: movie.backdropPath
        ? `${imageBase}/w780${movie.backdropPath}`
        : null,
      overview: movie.overview,
      rating: movie.rating,
      voteCount: movie.voteCount,
      releaseDate: movie.releaseDate?.toISOString().slice(0, 10) ?? null,
      country: countryCode,
      countryCode,
      genres: movie.genres,
      originalLanguage: movie.originalLanguage,
      watched: state?.watched ?? false,
      favorite: state?.favorite ?? false,
      runtime: movie.runtime,
      status: movie.status,
      ...(raw
        ? {
            cast: (raw?.credits?.cast ?? [])
              .slice(0, 12)
              .map((person: any) => ({
                id: Number(person.id),
                name: String(person.name ?? ''),
                character: String(person.character ?? ''),
                profileUrl: person.profile_path
                  ? `${imageBase}/w185${person.profile_path}`
                  : null,
              })),
            trailer,
          }
        : {}),
    };
  }

  private normalizeVideos(
    raw: any,
  ): Array<{ key: string; name: string; site: string; url: string }> {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (video) =>
          video?.site === 'YouTube' &&
          video?.key &&
          (video?.type === 'Trailer' || video?.type === 'Teaser'),
      )
      .map((video) => ({
        key: String(video.key),
        name: String(video.name ?? 'Trailer'),
        site: 'YouTube',
        url: `https://www.youtube.com/watch?v=${video.key}`,
      }));
  }
}
