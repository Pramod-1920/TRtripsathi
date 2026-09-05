import 'dart:async';
import 'package:flutter/material.dart';
import 'package:trtripsathi_mobile/core/networking/clients/movies_client.dart';
import 'package:trtripsathi_mobile/l10n/generated/app_localizations.dart';
import 'movie_grid_page.dart';

class MovieSearchPage extends StatefulWidget {
  const MovieSearchPage({super.key});
  @override
  State<MovieSearchPage> createState() => _MovieSearchPageState();
}

class _MovieSearchPageState extends State<MovieSearchPage> {
  static const _client = MoviesClient();
  Timer? _debounce;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.searchMovies)),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            autofocus: true,
            decoration: InputDecoration(
                hintText: strings.searchMovies,
                prefixIcon: const Icon(Icons.search_rounded)),
            onChanged: (value) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 450), () {
                if (mounted) setState(() => _query = value.trim());
              });
            },
          ),
        ),
        Expanded(
          child: _query.length < 2
              ? Center(child: Text(strings.searchMovies))
              : MovieGridPage(
                  key: ValueKey(_query),
                  title: _query,
                  embedded: true,
                  loadPage: (page) => _client.search(_query, page: page),
                ),
        ),
      ]),
    );
  }
}
