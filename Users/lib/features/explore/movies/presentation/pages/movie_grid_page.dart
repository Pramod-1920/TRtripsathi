import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/l10n/generated/app_localizations.dart';

import '../../domain/movie_model.dart';
import '../providers/movies_provider.dart';
import '../widgets/movie_card.dart';
import 'movie_details_page.dart';

typedef MoviePageLoader = Future<MoviePage> Function(int page);

class MovieGridPage extends StatefulWidget {
  const MovieGridPage({
    required this.title,
    required this.loadPage,
    this.embedded = false,
    super.key,
  });
  final String title;
  final MoviePageLoader loadPage;
  final bool embedded;

  @override
  State<MovieGridPage> createState() => _MovieGridPageState();
}

class _MovieGridPageState extends State<MovieGridPage> {
  final _controller = ScrollController();
  final _ids = <String>{};
  final _items = <MovieModel>[];
  int _page = 0;
  bool _loading = false;
  bool _hasMore = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onScroll);
    _load();
  }

  void _onScroll() {
    if (_controller.position.extentAfter < 500) _load();
  }

  Future<void> _load() async {
    if (_loading || !_hasMore) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await widget.loadPage(_page + 1);
      if (!mounted) return;
      setState(() {
        _page = result.page;
        for (final item in result.items) {
          if (_ids.add(item.id)) _items.add(item);
        }
        _hasMore = result.hasMore;
      });
    } catch (exception) {
      if (mounted) setState(() => _error = ApiService.readableError(exception));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    final content = _items.isEmpty && _loading
        ? const Center(child: CircularProgressIndicator())
        : _items.isEmpty && _error != null
            ? _ErrorState(message: _error!, onRetry: _load)
            : _items.isEmpty
                ? Center(child: Text(strings.noResults))
                : CustomScrollView(
                    controller: _controller,
                    slivers: [
                      SliverPadding(
                        padding: const EdgeInsets.all(14),
                        sliver: SliverGrid(
                          gridDelegate:
                              const SliverGridDelegateWithMaxCrossAxisExtent(
                            maxCrossAxisExtent: 180,
                            childAspectRatio: .57,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 16,
                          ),
                          delegate: SliverChildBuilderDelegate(
                            (context, index) => MovieCard(
                              movie: context
                                  .watch<MoviesProvider>()
                                  .stateFor(_items[index]),
                              onTap: () => Navigator.push<void>(
                                context,
                                MaterialPageRoute(
                                  builder: (_) =>
                                      MovieDetailsPage(movie: _items[index]),
                                ),
                              ),
                            ),
                            childCount: _items.length,
                          ),
                        ),
                      ),
                      SliverToBoxAdapter(
                        child: SizedBox(
                          height: 72,
                          child: _loading
                              ? const Center(child: CircularProgressIndicator())
                              : _error != null
                                  ? TextButton(
                                      onPressed: _load,
                                      child: Text(strings.retry))
                                  : null,
                        ),
                      ),
                    ],
                  );
    if (widget.embedded) return content;
    return Scaffold(appBar: AppBar(title: Text(widget.title)), body: content);
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.cloud_off_outlined,
              size: 44, color: AppColors.muted),
          const SizedBox(height: 12),
          Text(strings.couldNotLoadMovies,
              style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 5),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 14),
          FilledButton(onPressed: onRetry, child: Text(strings.retry)),
        ]),
      ),
    );
  }
}
