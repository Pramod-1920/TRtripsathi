import 'package:flutter/material.dart';
import 'package:trtripsathi_mobile/core/networking/clients/movies_client.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/l10n/generated/app_localizations.dart';
import '../../domain/movie_model.dart';
import '../widgets/movie_row.dart';
import 'movie_details_page.dart';
import 'movie_grid_page.dart';

class CountryMoviesPage extends StatefulWidget {
  const CountryMoviesPage({required this.country, super.key});
  final MovieCountry country;
  @override
  State<CountryMoviesPage> createState() => _CountryMoviesPageState();
}

class _CountryMoviesPageState extends State<CountryMoviesPage> {
  static const _client = MoviesClient();
  late Future<List<MoviePage>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<MoviePage>> _load() => Future.wait([
        _client.country(widget.country.code),
        _client.country(widget.country.code, mediaType: 'tv'),
        _client.country(widget.country.code,
            mediaType: 'tv', category: 'animation'),
        _client.country(widget.country.code, category: 'drama'),
      ]);

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
          title: Text('${_flag(widget.country.code)} ${widget.country.name}')),
      body: FutureBuilder<List<MoviePage>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _CountryError(
                onRetry: () => setState(() => _future = _load()));
          }
          final pages = snapshot.data!;
          return ListView(children: [
            _section(strings.popular, pages[0].items, 'popular', 'movie'),
            _section(strings.trending, pages[1].items, 'popular', 'tv'),
            _section(strings.animationAnime, pages[2].items, 'animation', 'tv'),
            _section(strings.drama, pages[3].items, 'drama', 'movie'),
            const SizedBox(height: 24),
          ]);
        },
      ),
    );
  }

  Widget _section(
      String title, List<MovieModel> items, String category, String mediaType) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 8, 10),
        child: Row(children: [
          Expanded(
              child: Text(title,
                  style: const TextStyle(
                      color: AppColors.navy,
                      fontSize: 19,
                      fontWeight: FontWeight.w900))),
          TextButton(
            onPressed: () => Navigator.push<void>(
                context,
                MaterialPageRoute(
                  builder: (_) => MovieGridPage(
                    title: '${widget.country.name} · $title',
                    loadPage: (page) => _client.country(widget.country.code,
                        page: page, mediaType: mediaType, category: category),
                  ),
                )),
            child: Text(AppLocalizations.of(context).viewAll),
          ),
        ]),
      ),
      MovieRow(
          items: items,
          onTap: (movie) => Navigator.push<void>(
              context,
              MaterialPageRoute(
                  builder: (_) => MovieDetailsPage(movie: movie)))),
    ]);
  }

  String _flag(String code) => code.length != 2
      ? '🌍'
      : String.fromCharCodes(
          code.toUpperCase().codeUnits.map((c) => c + 127397));
}

class _CountryError extends StatelessWidget {
  const _CountryError({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
          child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(AppLocalizations.of(context).couldNotLoadMovies),
          const SizedBox(height: 12),
          FilledButton(
              onPressed: onRetry,
              child: Text(AppLocalizations.of(context).retry)),
        ],
      ));
}
