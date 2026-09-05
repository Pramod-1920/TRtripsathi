import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:trtripsathi_mobile/core/networking/clients/movies_client.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/l10n/generated/app_localizations.dart';
import '../../domain/movie_model.dart';
import '../providers/movies_provider.dart';
import '../widgets/movie_empty_state.dart';
import '../widgets/movie_row.dart';
import 'country_movies_page.dart';
import 'country_picker_page.dart';
import 'movie_details_page.dart';
import 'movie_grid_page.dart';
import 'movie_search_page.dart';

class MoviesHomePage extends StatefulWidget {
  const MoviesHomePage({super.key});
  @override
  State<MoviesHomePage> createState() => _MoviesHomePageState();
}

class _MoviesHomePageState extends State<MoviesHomePage> {
  static const _client = MoviesClient();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MoviesProvider>().loadHome();
    });
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    final provider = context.watch<MoviesProvider>();
    return Scaffold(
      appBar: AppBar(
        title: Text(strings.moviesSeries),
        actions: [
          IconButton(
            tooltip: strings.searchMovies,
            onPressed: () => Navigator.push<void>(context,
                MaterialPageRoute(builder: (_) => const MovieSearchPage())),
            icon: const Icon(Icons.search_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => provider.loadHome(force: true),
        child: provider.loading && provider.trending.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : provider.error != null && provider.trending.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 150),
                    Icon(Icons.cloud_off_outlined,
                        size: 44, color: AppColors.muted),
                    const SizedBox(height: 12),
                    Text(strings.couldNotLoadMovies,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text(provider.error!, textAlign: TextAlign.center),
                    ),
                    Center(
                        child: FilledButton(
                      onPressed: () => provider.loadHome(force: true),
                      child: Text(strings.retry),
                    )),
                  ])
                : provider.watched.isEmpty
                    ? ListView(children: [
                        const SizedBox(height: 70),
                        MovieEmptyState(onAdd: _openCountries),
                        if (provider.trending.isNotEmpty)
                          _section(strings.trending, provider.trending,
                              onViewAll: () => _openGrid(strings.trending,
                                  (page) => _client.trending(page: page))),
                      ])
                    : ListView(children: [
                        if (provider.favorites.isNotEmpty)
                          _section(strings.favorites, provider.favorites,
                              onViewAll: () => _openGrid(strings.favorites,
                                  (page) => _client.favorites(page: page))),
                        if (provider.recent.isNotEmpty)
                          _section(strings.recentlyAdded, provider.recent,
                              onViewAll: () => _openGrid(strings.recentlyAdded,
                                  (page) => _client.recent(page: page))),
                        _countrySection(provider.countries),
                        if (provider.trending.isNotEmpty)
                          _section(strings.trending, provider.trending,
                              onViewAll: () => _openGrid(strings.trending,
                                  (page) => _client.trending(page: page))),
                        _journey(provider),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 22, 16, 0),
                          child: Text(strings.tmdbNotice,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                  color: AppColors.muted, fontSize: 11)),
                        ),
                        const SizedBox(height: 26),
                      ]),
      ),
    );
  }

  Widget _section(String title, List<MovieModel> items,
          {required VoidCallback onViewAll}) =>
      Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 18, 8, 8),
          child: Row(children: [
            Expanded(
                child: Text(title,
                    style: const TextStyle(
                        color: AppColors.navy,
                        fontSize: 19,
                        fontWeight: FontWeight.w900))),
            TextButton(
                onPressed: onViewAll,
                child: Text(AppLocalizations.of(context).viewAll)),
          ]),
        ),
        MovieRow(items: items, onTap: _openDetails),
      ]);

  Widget _countrySection(List<MovieCountry> countries) {
    final strings = AppLocalizations.of(context);
    final featured = countries
        .where((item) =>
            const {'NP', 'IN', 'JP', 'KR', 'US', 'GB'}.contains(item.code))
        .toList(growable: false);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 18, 8, 8),
        child: Row(children: [
          Expanded(
              child: Text(strings.exploreByCountry,
                  style: const TextStyle(
                      color: AppColors.navy,
                      fontSize: 19,
                      fontWeight: FontWeight.w900))),
          TextButton(onPressed: _openCountries, child: Text(strings.viewAll)),
        ]),
      ),
      SizedBox(
          height: 52,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: featured.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (_, index) => ActionChip(
              avatar: Text(_flag(featured[index].code)),
              label: Text(featured[index].name),
              onPressed: () => Navigator.push<void>(
                  context,
                  MaterialPageRoute(
                      builder: (_) =>
                          CountryMoviesPage(country: featured[index]))),
            ),
          )),
    ]);
  }

  Widget _journey(MoviesProvider provider) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 22, 16, 0),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: AppColors.line),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(AppLocalizations.of(context).movieJourney,
                  style: const TextStyle(
                      color: AppColors.navy,
                      fontSize: 17,
                      fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              Text(
                  '${provider.watchedCount} ${AppLocalizations.of(context).moviesWatched}',
                  style: const TextStyle(color: AppColors.muted)),
              if (provider.journeyCountries.isNotEmpty) ...[
                const SizedBox(height: 12),
                Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: provider.journeyCountries.map((item) {
                      final code = (item['code'] ?? '').toString();
                      return Text('${_flag(code)} $code  ${item['count']}',
                          style: const TextStyle(fontWeight: FontWeight.w700));
                    }).toList(growable: false)),
              ],
            ]),
          ),
        ),
      );

  void _openDetails(MovieModel movie) => Navigator.push<void>(context,
      MaterialPageRoute(builder: (_) => MovieDetailsPage(movie: movie)));
  void _openCountries() => Navigator.push<void>(
      context, MaterialPageRoute(builder: (_) => const CountryPickerPage()));
  void _openGrid(String title, MoviePageLoader loader) => Navigator.push<void>(
      context,
      MaterialPageRoute(
          builder: (_) => MovieGridPage(title: title, loadPage: loader)));
  String _flag(String code) => code.length != 2
      ? '🌍'
      : String.fromCharCodes(
          code.toUpperCase().codeUnits.map((c) => c + 127397));
}
