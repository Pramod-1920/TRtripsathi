import 'package:flutter/material.dart';
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
                    opacity: .08,
                    child: const _RotatingTravelOrbit(),
                  ),
                ),
              ),
            child,
          ],
        ),
      );
}

class _RotatingTravelOrbit extends StatefulWidget {
  const _RotatingTravelOrbit();

  @override
  State<_RotatingTravelOrbit> createState() => _RotatingTravelOrbitState();
}

class _RotatingTravelOrbitState extends State<_RotatingTravelOrbit>
    with SingleTickerProviderStateMixin {
  late final AnimationController _rotation;

  @override
  void initState() {
    super.initState();
    _rotation = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 18),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduceMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reduceMotion) {
      _rotation
        ..stop()
        ..value = 0;
    } else if (!_rotation.isAnimating) {
      _rotation.repeat();
    }
  }

  @override
  void dispose() {
    _rotation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Center(
        child: RotationTransition(
          turns: _rotation,
          child: const FittedBox(
            fit: BoxFit.contain,
            child: Icon(
              Icons.travel_explore_rounded,
              size: 360,
              color: AppColors.navy,
            ),
          ),
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
