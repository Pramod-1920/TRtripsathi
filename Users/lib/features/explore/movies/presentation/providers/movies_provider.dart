import 'package:flutter/foundation.dart';

import '../../../../../core/networking/api_service.dart';
import '../../../../../core/networking/clients/movies_client.dart';
import '../../domain/movie_model.dart';

class MoviesProvider extends ChangeNotifier {
  MoviesProvider({MoviesClient client = const MoviesClient()})
      : _client = client;

  final MoviesClient _client;
  final Map<String, MovieModel> _known = {};
  List<MovieModel> watched = const [];
  List<MovieModel> favorites = const [];
  List<MovieModel> recent = const [];
  List<MovieModel> trending = const [];
  List<MovieCountry> countries = const [];
  int watchedCount = 0;
  List<Map<String, dynamic>> journeyCountries = const [];
  bool loading = false;
  String? error;
  bool _loaded = false;

  Future<void> loadHome({bool force = false}) async {
    if (loading || (_loaded && !force)) return;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        _client.watched(),
        _client.favorites(),
        _client.recent(),
        _client.trending(),
        _client.countries(),
        _client.journey(),
      ]);
      watched = _mergeStates((results[0] as MoviePage).items);
      favorites = _mergeStates((results[1] as MoviePage).items);
      recent = _mergeStates((results[2] as MoviePage).items);
      trending = _mergeStates((results[3] as MoviePage).items);
      countries = results[4] as List<MovieCountry>;
      final journey = results[5] as Map<String, dynamic>;
      watchedCount =
          (journey['watchedCount'] as num?)?.toInt() ?? watched.length;
      journeyCountries = (journey['countries'] as List? ?? const [])
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList(growable: false);
      _loaded = true;
    } catch (exception) {
      error = ApiService.readableError(exception);
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  MovieModel stateFor(MovieModel movie) => _known[movie.id] ?? movie;

  Future<MovieModel> details(MovieModel movie) async =>
      _remember(await _client.details(stateFor(movie)));

  Future<void> toggleWatched(MovieModel movie) async {
    final current = stateFor(movie);
    final optimistic = current.copyWith(watched: !current.watched);
    _replaceEverywhere(optimistic);
    try {
      final saved = await _client.setWatched(current, optimistic.watched);
      _replaceEverywhere(saved);
      await loadHome(force: true);
    } catch (exception) {
      _replaceEverywhere(current);
      rethrow;
    }
  }

  Future<void> toggleFavorite(MovieModel movie) async {
    final current = stateFor(movie);
    final optimistic = current.copyWith(favorite: !current.favorite);
    _replaceEverywhere(optimistic);
    try {
      final saved = await _client.setFavorite(current, optimistic.favorite);
      _replaceEverywhere(saved);
      await loadHome(force: true);
    } catch (exception) {
      _replaceEverywhere(current);
      rethrow;
    }
  }

  List<MovieModel> _mergeStates(List<MovieModel> items) =>
      items.map(_remember).toList(growable: false);

  MovieModel _remember(MovieModel movie) {
    final existing = _known[movie.id];
    final merged = movie.copyWith(
      watched: movie.watched || (existing?.watched ?? false),
      favorite: movie.favorite || (existing?.favorite ?? false),
    );
    _known[movie.id] = merged;
    return merged;
  }

  void _replaceEverywhere(MovieModel movie) {
    _known[movie.id] = movie;
    watched = _replace(watched, movie);
    favorites = _replace(favorites, movie);
    recent = _replace(recent, movie);
    trending = _replace(trending, movie);
    notifyListeners();
  }

  List<MovieModel> _replace(List<MovieModel> source, MovieModel movie) => source
      .map((item) => item.id == movie.id ? movie : item)
      .toList(growable: false);
}
