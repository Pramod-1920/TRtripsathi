export type TripSathiMovie = {
  id: string;
  externalId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  originalTitle: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  rating: number;
  voteCount: number;
  releaseDate: string | null;
  country: string | null;
  countryCode: string | null;
  genres: string[];
  originalLanguage: string;
  watched: boolean;
  favorite: boolean;
  runtime?: number | null;
  status?: string | null;
  cast?: Array<{
    id: number;
    name: string;
    character: string;
    profileUrl: string | null;
  }>;
  trailer?: { key: string; name: string; site: string; url: string } | null;
};

export type PaginatedMovies = {
  items: TripSathiMovie[];
  page: number;
  totalPages: number;
  totalResults: number;
  hasMore: boolean;
};
