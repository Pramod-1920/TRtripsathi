import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trtripsathi_mobile/features/explore/movies/domain/movie_model.dart';
import 'package:trtripsathi_mobile/features/explore/movies/presentation/widgets/movie_card.dart';
import 'package:trtripsathi_mobile/features/explore/movies/presentation/widgets/movie_empty_state.dart';
import 'package:trtripsathi_mobile/l10n/generated/app_localizations.dart';

Widget localized(Widget child) => MaterialApp(
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    );

void main() {
  test('movie response parsing is null safe', () {
    final movie = MovieModel.fromJson({
      'id': 'abc',
      'externalId': 12,
      'mediaType': 'movie',
      'title': 'Your Name',
      'rating': 8.4,
      'genres': ['Animation'],
    });
    expect(movie.title, 'Your Name');
    expect(movie.posterUrl, isNull);
    expect(movie.watched, isFalse);
    expect(movie.favorite, isFalse);
  });

  testWidgets('first-time movie state explains the next action',
      (tester) async {
    var added = false;
    await tester
        .pumpWidget(localized(MovieEmptyState(onAdd: () => added = true)));
    expect(find.text('No movies added yet.'), findsOneWidget);
    expect(find.text('Add Movies'), findsOneWidget);
    await tester.tap(find.text('Add Movies'));
    expect(added, isTrue);
  });

  testWidgets('movie card handles a missing image', (tester) async {
    final movie = MovieModel.fromJson({
      'id': 'abc',
      'externalId': 12,
      'mediaType': 'movie',
      'title': 'Your Name',
      'rating': 8.4,
      'countryCode': 'JP',
    });
    await tester.pumpWidget(localized(
      SizedBox(
          width: 120,
          height: 220,
          child: MovieCard(movie: movie, onTap: () {})),
    ));
    expect(find.byIcon(Icons.movie_outlined), findsOneWidget);
    expect(find.text('Your Name'), findsOneWidget);
    expect(find.text('JP'), findsOneWidget);
  });
}
