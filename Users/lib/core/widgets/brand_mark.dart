import 'package:flutter/material.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';

class BrandMark extends StatelessWidget {
  const BrandMark({this.size = 64, this.showName = false, super.key});

  final double size;
  final bool showName;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              color: AppColors.navy,
              borderRadius: BorderRadius.circular(size * .3),
              boxShadow: [
                BoxShadow(
                  color: AppColors.navy.withValues(alpha: .22),
                  blurRadius: 24,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Icon(Icons.terrain_rounded,
                    color: Colors.white, size: size * .54),
                Positioned(
                  right: size * .12,
                  top: size * .12,
                  child: Container(
                    width: size * .2,
                    height: size * .2,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.gold,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (showName) ...[
            const SizedBox(width: 14),
            Text(
              'TripSathi',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: AppColors.navy,
                    fontWeight: FontWeight.w900,
                  ),
            ),
          ],
        ],
      );
}
