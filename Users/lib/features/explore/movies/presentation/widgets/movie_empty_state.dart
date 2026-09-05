import 'package:flutter/material.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/l10n/generated/app_localizations.dart';

class MovieEmptyState extends StatelessWidget {
  const MovieEmptyState({required this.onAdd, super.key});
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Icon(Icons.movie_filter_outlined,
            size: 54, color: AppColors.goldDark),
        const SizedBox(height: 18),
        Text(strings.yourWatchedList,
            style: const TextStyle(
                color: AppColors.navy,
                fontSize: 21,
                fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        Text(strings.noMoviesAdded,
            style: const TextStyle(color: AppColors.muted)),
        const SizedBox(height: 4),
        Text(strings.startMovieDiscovery,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted)),
        const SizedBox(height: 20),
        FilledButton.icon(
          onPressed: onAdd,
          icon: const Icon(Icons.add_rounded),
          label: Text(strings.addMovies),
        ),
      ]),
    );
  }
}
