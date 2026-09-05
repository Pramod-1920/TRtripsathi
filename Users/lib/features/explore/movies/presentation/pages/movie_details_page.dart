import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/l10n/generated/app_localizations.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../domain/movie_model.dart';
import '../providers/movies_provider.dart';

class MovieDetailsPage extends StatefulWidget {
  const MovieDetailsPage({required this.movie, super.key});
  final MovieModel movie;
  @override
  State<MovieDetailsPage> createState() => _MovieDetailsPageState();
}

class _MovieDetailsPageState extends State<MovieDetailsPage> {
  MovieModel? _details;
  String? _error;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final result = await context.read<MoviesProvider>().details(widget.movie);
      if (mounted) setState(() => _details = result);
    } catch (exception) {
      if (mounted) setState(() => _error = ApiService.readableError(exception));
    }
  }

  Future<void> _toggle(bool watched) async {
    if (_saving) return;
    setState(() => _saving = true);
    final provider = context.read<MoviesProvider>();
    try {
      if (watched) {
        await provider.toggleWatched(_details ?? widget.movie);
      } else {
        await provider.toggleFavorite(_details ?? widget.movie);
      }
      if (mounted) {
        setState(() => _details = provider.stateFor(_details ?? widget.movie));
      }
    } catch (exception) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiService.readableError(exception))),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    final movie =
        context.watch<MoviesProvider>().stateFor(_details ?? widget.movie);
    return Scaffold(
      appBar: AppBar(title: Text(movie.title)),
      body: _error != null && _details == null
          ? Center(
              child: FilledButton(
                  onPressed: () {
                    setState(() => _error = null);
                    _load();
                  },
                  child: Text(strings.retry)))
          : ListView(children: [
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Container(
                  color: AppColors.line,
                  child: movie.backdropUrl == null
                      ? const Icon(Icons.movie_outlined, size: 54)
                      : Image.network(movie.backdropUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              const Icon(Icons.broken_image_outlined)),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(movie.title,
                          style: const TextStyle(
                              color: AppColors.navy,
                              fontSize: 25,
                              fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      Wrap(spacing: 10, runSpacing: 6, children: [
                        _Meta(Icons.star_rounded,
                            movie.rating.toStringAsFixed(1)),
                        if (movie.countryCode != null)
                          _Meta(Icons.public_rounded, movie.countryCode!),
                        if (movie.releaseDate != null)
                          _Meta(Icons.calendar_today_outlined,
                              movie.releaseDate!),
                      ]),
                      if (movie.genres.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Wrap(
                            spacing: 7,
                            runSpacing: 7,
                            children: movie.genres
                                .map((genre) => Chip(label: Text(genre)))
                                .toList()),
                      ],
                      const SizedBox(height: 20),
                      _Heading(strings.overview),
                      const SizedBox(height: 7),
                      Text(
                          movie.overview.isEmpty
                              ? strings.noResults
                              : movie.overview,
                          style: const TextStyle(
                              color: AppColors.ink, height: 1.5)),
                      if (movie.cast.isNotEmpty) ...[
                        const SizedBox(height: 22),
                        _Heading(strings.cast),
                        const SizedBox(height: 10),
                        SizedBox(
                            height: 74,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: movie.cast.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(width: 10),
                              itemBuilder: (_, index) => SizedBox(
                                  width: 130,
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(movie.cast[index].name,
                                            maxLines: 1,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w800)),
                                        Text(movie.cast[index].character,
                                            maxLines: 2,
                                            style: const TextStyle(
                                                color: AppColors.muted,
                                                fontSize: 12)),
                                      ])),
                            )),
                      ],
                      if (movie.trailerUrl != null) ...[
                        OutlinedButton.icon(
                          onPressed: () => launchUrl(
                              Uri.parse(movie.trailerUrl!),
                              mode: LaunchMode.externalApplication),
                          icon: const Icon(Icons.play_circle_outline_rounded),
                          label: Text(strings.trailer),
                        ),
                        const SizedBox(height: 8),
                      ],
                      Row(children: [
                        Expanded(
                            child: FilledButton.icon(
                          onPressed: _saving ? null : () => _toggle(true),
                          icon: Icon(movie.watched
                              ? Icons.check_rounded
                              : Icons.visibility_outlined),
                          label: Text(movie.watched
                              ? strings.watched
                              : strings.markWatched),
                        )),
                        const SizedBox(width: 10),
                        Expanded(
                            child: OutlinedButton.icon(
                          onPressed: _saving ? null : () => _toggle(false),
                          icon: Icon(movie.favorite
                              ? Icons.favorite_rounded
                              : Icons.favorite_border_rounded),
                          label: Text(movie.favorite
                              ? strings.favorites
                              : strings.addFavorite),
                        )),
                      ]),
                    ]),
              ),
            ]),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta(this.icon, this.text);
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) =>
      Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 16, color: AppColors.goldDark),
        const SizedBox(width: 4),
        Text(text),
      ]);
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(
          color: AppColors.navy, fontSize: 18, fontWeight: FontWeight.w900));
}
