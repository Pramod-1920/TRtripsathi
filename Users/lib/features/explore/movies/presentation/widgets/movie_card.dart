import 'package:flutter/material.dart';

import '../../../../../core/theme/app_theme.dart';
import '../../domain/movie_model.dart';

class MovieCard extends StatelessWidget {
  const MovieCard({required this.movie, required this.onTap, super.key});
  final MovieModel movie;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: movie.title,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    width: double.infinity,
                    color: AppColors.line,
                    child: movie.posterUrl == null
                        ? const Icon(Icons.movie_outlined,
                            color: AppColors.muted, size: 34)
                        : Image.network(
                            movie.posterUrl!,
                            fit: BoxFit.cover,
                            filterQuality: FilterQuality.low,
                            errorBuilder: (_, __, ___) => const Icon(
                              Icons.broken_image_outlined,
                              color: AppColors.muted,
                            ),
                            loadingBuilder: (context, child, progress) =>
                                progress == null
                                    ? child
                                    : const Center(
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2)),
                          ),
                  ),
                ),
              ),
              const SizedBox(height: 7),
              Text(movie.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      color: AppColors.navy,
                      fontWeight: FontWeight.w800,
                      fontSize: 13)),
              const SizedBox(height: 3),
              Row(children: [
                const Icon(Icons.star_rounded,
                    color: AppColors.goldDark, size: 15),
                const SizedBox(width: 2),
                Text(movie.rating.toStringAsFixed(1),
                    style:
                        const TextStyle(color: AppColors.muted, fontSize: 11)),
                const Spacer(),
                if (movie.countryCode case final code?)
                  Text(code,
                      style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 10,
                          fontWeight: FontWeight.w700)),
              ]),
            ],
          ),
        ),
      );
}
