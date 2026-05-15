import 'package:flutter/material.dart';
import 'dart:async';

class SplashScreen extends StatefulWidget {
  final VoidCallback onComplete;

  const SplashScreen({required this.onComplete, super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late AnimationController _scaleController;
  late AnimationController _slideController;
  late AnimationController _loadingController;

  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();

    _fadeController = AnimationController(duration: const Duration(milliseconds: 1500), vsync: this);
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(CurvedAnimation(parent: _fadeController, curve: Curves.easeIn));

    _scaleController = AnimationController(duration: const Duration(milliseconds: 1800), vsync: this);
    _scaleAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(CurvedAnimation(parent: _scaleController, curve: Curves.elasticOut));

    _slideController = AnimationController(duration: const Duration(milliseconds: 1200), vsync: this);
    _slideAnimation = Tween<Offset>(begin: const Offset(0, 0.5), end: Offset.zero).animate(CurvedAnimation(parent: _slideController, curve: Curves.easeOut));

    _loadingController = AnimationController(duration: const Duration(milliseconds: 1500), vsync: this)..repeat();

    _startAnimationSequence();

    Timer(const Duration(milliseconds: 4000), () { if (mounted) widget.onComplete(); });
  }

  void _startAnimationSequence() {
    _fadeController.forward();
    Future.delayed(const Duration(milliseconds: 300), () { if (mounted) _scaleController.forward(); });
    Future.delayed(const Duration(milliseconds: 600), () { if (mounted) _slideController.forward(); });
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _scaleController.dispose();
    _slideController.dispose();
    _loadingController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [const Color(0xFFA0522D), const Color(0xFF8B4513), const Color(0xFF6B5D47)]),
        ),
        child: Stack(children: [ _buildBackgroundElements(), Center(child: FadeTransition(opacity: _fadeAnimation, child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [_buildAnimatedLogo(), const SizedBox(height: 60), SlideTransition(position: _slideAnimation, child: FadeTransition(opacity: _fadeAnimation, child: _buildTextContent())),],),),), Positioned(bottom: 80, left: 0, right: 0, child: FadeTransition(opacity: _fadeAnimation, child: _buildLoadingIndicator())), Positioned(bottom: 20, left: 0, right: 0, child: FadeTransition(opacity: _fadeAnimation, child: Text('POWERED BY YATRI', textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12, letterSpacing: 2, fontWeight: FontWeight.w500),),),),],),
      ),
    );
  }

  Widget _buildBackgroundElements() { return const SizedBox.shrink(); }

  Widget _buildAnimatedLogo() { return ScaleTransition(scale: _scaleAnimation, child: Stack(alignment: Alignment.center, children: [Container(width: 180,height: 180,decoration: BoxDecoration(shape: BoxShape.circle,border: Border.all(color: Colors.white.withOpacity(0.3),width: 2),),),Container(width: 160,height: 160,decoration: BoxDecoration(shape: BoxShape.circle,color: Colors.white.withOpacity(0.1),),),Column(mainAxisAlignment: MainAxisAlignment.center,children: [SizedBox(width: 80, height: 40, child: Row(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.terrain, color: Colors.white, size: 32), const SizedBox(width: 8), Icon(Icons.terrain, color: Colors.white, size: 32),]),),],),],),); }

  Widget _buildTextContent() { return Column(children: [Text('Yatri',style: Theme.of(context).textTheme.displayMedium?.copyWith(color: Colors.white,fontWeight: FontWeight.bold,fontSize: 48,),textAlign: TextAlign.center,), const SizedBox(height: 16),Text('Find Your Trekking\nCompanion',textAlign: TextAlign.center,style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: const Color(0xFFD4A574),fontSize: 32,height: 1.3,fontWeight: FontWeight.w500,),),],); }

  Widget _buildLoadingIndicator() { return Column(children: [SizedBox(width: 100,height: 4,child: Stack(children: [Container(decoration: BoxDecoration(color: Colors.white.withOpacity(0.2),borderRadius: BorderRadius.circular(2),),),ScaleTransition(scale: Tween<double>(begin: 0.0,end: 1.0).animate(CurvedAnimation(parent: _loadingController,curve: Curves.easeInOut),),alignment: Alignment.centerLeft,child: Container(decoration: BoxDecoration(color: const Color(0xFFC85A1C),borderRadius: BorderRadius.circular(2),),),),],),),],); }
}
