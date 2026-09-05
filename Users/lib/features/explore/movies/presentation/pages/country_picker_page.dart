import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/l10n/generated/app_localizations.dart';
import '../../domain/movie_model.dart';
import '../providers/movies_provider.dart';
import 'country_movies_page.dart';

class CountryPickerPage extends StatefulWidget {
  const CountryPickerPage({super.key});
  @override
  State<CountryPickerPage> createState() => _CountryPickerPageState();
}

class _CountryPickerPageState extends State<CountryPickerPage> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    final provider = context.watch<MoviesProvider>();
    final countries = provider.countries.where((country) {
      final query = _query.toLowerCase();
      return country.name.toLowerCase().contains(query) ||
          country.code.toLowerCase().contains(query) ||
          country.nativeName.toLowerCase().contains(query);
    }).toList(growable: false);
    return Scaffold(
      appBar: AppBar(title: Text(strings.exploreByCountry)),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            onChanged: (value) => setState(() => _query = value.trim()),
            decoration: InputDecoration(
              hintText: strings.searchCountries,
              prefixIcon: const Icon(Icons.search_rounded),
            ),
          ),
        ),
        Expanded(
          child: ListView.separated(
            itemCount: countries.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, index) {
              final country = countries[index];
              return ListTile(
                leading: Text(_flag(country.code),
                    style: const TextStyle(fontSize: 25)),
                title: Text(country.name,
                    style: const TextStyle(
                        color: AppColors.navy, fontWeight: FontWeight.w700)),
                subtitle: country.nativeName.isEmpty ||
                        country.nativeName == country.name
                    ? null
                    : Text(country.nativeName),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => _open(context, country),
              );
            },
          ),
        ),
      ]),
    );
  }

  void _open(BuildContext context, MovieCountry country) =>
      Navigator.push<void>(
          context,
          MaterialPageRoute(
            builder: (_) => CountryMoviesPage(country: country),
          ));

  String _flag(String code) => code.length != 2
      ? '🌍'
      : String.fromCharCodes(
          code.toUpperCase().codeUnits.map((c) => c + 127397));
}
