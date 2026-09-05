import 'package:flutter/material.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/core/navigation/route_names.dart';

class ExploreScreen extends StatelessWidget {
  const ExploreScreen({super.key});

  static const _categories = <_ExploreCategory>[
    _ExploreCategory(
      title: 'Movies & Series',
      subtitle: 'Stories, screens and filming locations',
      icon: Icons.movie_creation_outlined,
      color: Color(0xFF7C3AED),
      routeName: RouteNames.movies,
    ),
    _ExploreCategory(
      title: 'Anime',
      subtitle: 'Animation, art and fan discoveries',
      icon: Icons.auto_awesome_outlined,
      color: Color(0xFFDB2777),
    ),
    _ExploreCategory(
      title: 'Food',
      subtitle: 'Local dishes and flavors worth trying',
      icon: Icons.restaurant_outlined,
      color: Color(0xFFEA580C),
    ),
    _ExploreCategory(
      title: 'Culture',
      subtitle: 'Communities, heritage and everyday life',
      icon: Icons.museum_outlined,
      color: Color(0xFF2563EB),
    ),
    _ExploreCategory(
      title: 'Festivals',
      subtitle: 'Celebrations happening across Nepal',
      icon: Icons.celebration_outlined,
      color: Color(0xFFD97706),
    ),
    _ExploreCategory(
      title: 'Traditions',
      subtitle: 'Customs passed down through generations',
      icon: Icons.diversity_3_outlined,
      color: Color(0xFF0F766E),
    ),
    _ExploreCategory(
      title: 'Music',
      subtitle: 'Artists, sounds and live experiences',
      icon: Icons.library_music_outlined,
      color: Color(0xFF4F46E5),
    ),
    _ExploreCategory(
      title: 'Places',
      subtitle: 'Landmarks and hidden destinations',
      icon: Icons.landscape_outlined,
      color: Color(0xFF15803D),
    ),
  ];

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFF7F8FA),
        body: SafeArea(
          child: CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Explore',
                        style: Theme.of(context)
                            .textTheme
                            .headlineMedium
                            ?.copyWith(
                              color: AppColors.navy,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -.7,
                            ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Discover the stories, flavors and experiences that make every journey memorable.',
                        style: TextStyle(
                          color: AppColors.muted,
                          fontSize: 15,
                          height: 1.45,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 260,
                    mainAxisExtent: 174,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _CategoryCard(
                      category: _categories[index],
                    ),
                    childCount: _categories.length,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({required this.category});

  final _ExploreCategory category;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: category.routeName == null
              ? () => ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content:
                            Text('${category.title} content is coming soon.')),
                  )
              : () => Navigator.pushNamed(context, category.routeName!),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: category.color.withValues(alpha: .11),
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: Icon(category.icon, color: category.color, size: 27),
                ),
                const Spacer(),
                Text(
                  category.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.navy,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  category.subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 12,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

class _ExploreCategory {
  const _ExploreCategory({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    this.routeName,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final String? routeName;
}
