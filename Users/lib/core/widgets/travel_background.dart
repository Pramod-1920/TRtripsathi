import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';

class TravelBackground extends StatelessWidget {
  const TravelBackground(
      {required this.child, this.showOrbit = false, super.key});

  final Widget child;
  final bool showOrbit;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF9FBFF), Color(0xFFF3F6FB), Color(0xFFFFF9EC)],
          ),
        ),
        child: Stack(
          children: [
            const Positioned(top: -90, right: -80, child: _Glow(size: 260)),
            const Positioned(bottom: -130, left: -100, child: _Glow(size: 300)),
            if (showOrbit)
              Positioned.fill(
                child: IgnorePointer(
                  child: Opacity(
                    opacity: .35,
                    child: Lottie.asset(
                      'assets/animations/travel_orbit.json',
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
              ),
            child,
          ],
        ),
      );
}

class _Glow extends StatelessWidget {
  const _Glow({required this.size});
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.gold.withValues(alpha: .10),
        ),
      );
}
