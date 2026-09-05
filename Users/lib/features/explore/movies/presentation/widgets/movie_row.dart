import 'package:flutter/material.dart';
import '../../domain/movie_model.dart';
import 'movie_card.dart';

class MovieRow extends StatelessWidget {
  const MovieRow({required this.items, required this.onTap, super.key});
  final List<MovieModel> items;
  final ValueChanged<MovieModel> onTap;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 224,
        child: ListView.separated(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          scrollDirection: Axis.horizontal,
          itemCount: items.length.clamp(0, 9),
          separatorBuilder: (_, __) => const SizedBox(width: 11),
          itemBuilder: (_, index) => SizedBox(
            width: 112,
            child: MovieCard(
                movie: items[index], onTap: () => onTap(items[index])),
          ),
        ),
      );
}
