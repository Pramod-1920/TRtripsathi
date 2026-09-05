class MovieModel {
  const MovieModel({
    required this.id,
    required this.externalId,
    required this.mediaType,
    required this.title,
    required this.posterUrl,
    required this.backdropUrl,
    required this.overview,
    required this.rating,
    required this.releaseDate,
    required this.countryCode,
    required this.genres,
    required this.watched,
    required this.favorite,
    this.cast = const [],
    this.trailerUrl,
  });

  final String id;
  final int externalId;
  final String mediaType;
  final String title;
  final String? posterUrl;
  final String? backdropUrl;
  final String overview;
  final double rating;
  final String? releaseDate;
  final String? countryCode;
  final List<String> genres;
  final bool watched;
  final bool favorite;
  final List<MovieCastMember> cast;
  final String? trailerUrl;

  factory MovieModel.fromJson(Map<String, dynamic> json) => MovieModel(
        id: (json['id'] ?? '').toString(),
        externalId: (json['externalId'] as num?)?.toInt() ?? 0,
        mediaType: (json['mediaType'] ?? 'movie').toString(),
        title: (json['title'] ?? 'Untitled').toString(),
        posterUrl: json['posterUrl']?.toString(),
        backdropUrl: json['backdropUrl']?.toString(),
        overview: (json['overview'] ?? '').toString(),
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        releaseDate: json['releaseDate']?.toString(),
        countryCode: json['countryCode']?.toString(),
        genres: (json['genres'] as List? ?? const [])
            .map((item) => item.toString())
            .toList(growable: false),
        watched: json['watched'] == true,
        favorite: json['favorite'] == true,
        cast: (json['cast'] as List? ?? const [])
            .whereType<Map>()
            .map((item) =>
                MovieCastMember.fromJson(Map<String, dynamic>.from(item)))
            .toList(growable: false),
        trailerUrl: (json['trailer'] as Map?)?['url']?.toString(),
      );

  MovieModel copyWith({bool? watched, bool? favorite}) => MovieModel(
        id: id,
        externalId: externalId,
        mediaType: mediaType,
        title: title,
        posterUrl: posterUrl,
        backdropUrl: backdropUrl,
        overview: overview,
        rating: rating,
        releaseDate: releaseDate,
        countryCode: countryCode,
        genres: genres,
        watched: watched ?? this.watched,
        favorite: favorite ?? this.favorite,
        cast: cast,
        trailerUrl: trailerUrl,
      );
}

class MovieCastMember {
  const MovieCastMember(this.name, this.character, this.profileUrl);
  final String name;
  final String character;
  final String? profileUrl;

  factory MovieCastMember.fromJson(Map<String, dynamic> json) =>
      MovieCastMember(
        (json['name'] ?? '').toString(),
        (json['character'] ?? '').toString(),
        json['profileUrl']?.toString(),
      );
}

class MoviePage {
  const MoviePage(
      {required this.items, required this.page, required this.hasMore});
  final List<MovieModel> items;
  final int page;
  final bool hasMore;

  factory MoviePage.fromJson(Map<String, dynamic> json) => MoviePage(
        items: (json['items'] as List? ?? const [])
            .whereType<Map>()
            .map((item) => MovieModel.fromJson(Map<String, dynamic>.from(item)))
            .toList(growable: false),
        page: (json['page'] as num?)?.toInt() ?? 1,
        hasMore: json['hasMore'] == true,
      );
}

class MovieCountry {
  const MovieCountry(
      {required this.code, required this.name, required this.nativeName});
  final String code;
  final String name;
  final String nativeName;

  factory MovieCountry.fromJson(Map<String, dynamic> json) => MovieCountry(
        code: (json['code'] ?? '').toString(),
        name: (json['name'] ?? '').toString(),
        nativeName: (json['nativeName'] ?? '').toString(),
      );
}
