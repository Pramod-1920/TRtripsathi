import '../../../features/explore/movies/domain/movie_model.dart';
import '../api_service.dart';

class MoviesClient {
  const MoviesClient();

  Future<MoviePage> trending({int page = 1, String mediaType = 'all'}) async =>
      _page('/movies/trending', {'page': '$page', 'mediaType': mediaType});

  Future<MoviePage> popular({int page = 1, String mediaType = 'movie'}) async =>
      _page('/movies/popular', {'page': '$page', 'mediaType': mediaType});

  Future<MoviePage> search(String query,
          {int page = 1, String mediaType = 'all'}) async =>
      _page('/movies/search',
          {'q': query, 'page': '$page', 'mediaType': mediaType});

  Future<MoviePage> country(String code,
          {int page = 1,
          String mediaType = 'movie',
          String category = 'popular'}) async =>
      _page('/movies/country/$code', {
        'page': '$page',
        'mediaType': mediaType,
        'category': category,
      });

  Future<List<MovieCountry>> countries() async {
    final raw = await ApiService.getJson('/movies/countries');
    return (raw as List? ?? const [])
        .whereType<Map>()
        .map((item) => MovieCountry.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<MovieModel> details(MovieModel movie) async {
    final raw = await ApiService.getJson('/movies/${movie.id}', query: {
      'mediaType': movie.mediaType,
    });
    final result = MovieModel.fromJson(Map<String, dynamic>.from(raw as Map));
    return result.copyWith(watched: movie.watched, favorite: movie.favorite);
  }

  Future<MoviePage> watched({int page = 1}) =>
      _page('/movies/me/watched', {'page': '$page'}, authenticated: true);

  Future<MoviePage> favorites({int page = 1}) =>
      _page('/movies/me/favorites', {'page': '$page'}, authenticated: true);

  Future<MoviePage> recent({int page = 1}) =>
      _page('/movies/me/recent', {'page': '$page'}, authenticated: true);

  Future<Map<String, dynamic>> journey() async => Map<String, dynamic>.from(
      await ApiService.getJson('/movies/me/journey', authenticated: true)
          as Map);

  Future<MovieModel> setWatched(MovieModel movie, bool enabled) =>
      _setState(movie, 'watched', enabled);

  Future<MovieModel> setFavorite(MovieModel movie, bool enabled) =>
      _setState(movie, 'favorite', enabled);

  Future<MoviePage> _page(String path, Map<String, String> query,
      {bool authenticated = false}) async {
    final raw = await ApiService.getJson(path,
        query: query, authenticated: authenticated);
    return MoviePage.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<MovieModel> _setState(
      MovieModel movie, String field, bool enabled) async {
    final query = {'mediaType': movie.mediaType};
    final raw = enabled
        ? await ApiService.postJson('/movies/${movie.id}/$field', query: query)
        : await ApiService.deleteJson('/movies/${movie.id}/$field',
            query: query);
    return MovieModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }
}
