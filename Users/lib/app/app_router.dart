import 'package:flutter/material.dart';
import 'package:trtripsathi_mobile/core/navigation/route_names.dart';
import 'package:trtripsathi_mobile/features/auth/presentation/pages/login_page.dart';
import 'package:trtripsathi_mobile/features/auth/presentation/pages/signup_page.dart';
import 'package:trtripsathi_mobile/features/auth/presentation/pages/password_recovery_page.dart';
import 'package:trtripsathi_mobile/features/auth/presentation/pages/account_verification_page.dart';
import 'package:trtripsathi_mobile/features/dashboard/presentation/pages/dashboard_page.dart';
import 'package:trtripsathi_mobile/features/onboarding/presentation/pages/intro_page.dart';
import 'package:trtripsathi_mobile/features/onboarding/presentation/pages/profile_setup_page.dart';
import 'package:trtripsathi_mobile/features/profile/presentation/pages/profile_page.dart';
import 'package:trtripsathi_mobile/features/profile/presentation/pages/report_issue_page.dart';

abstract final class AppRouter {
  static Route<dynamic>? onGenerateRoute(RouteSettings settings) {
    final Widget? page = switch (settings.name) {
      RouteNames.login => LoginScreen(
          initialIdentifier: settings.arguments is String
              ? settings.arguments as String
              : null,
        ),
      RouteNames.signup => const SignupScreen(),
      RouteNames.passwordRecovery => const PasswordRecoveryPage(),
      RouteNames.accountVerification => const AccountVerificationPage(),
      RouteNames.onboarding => const IntroOnboardingScreen(),
      RouteNames.profileSetup => const ProfileSetupScreen(),
      RouteNames.profile => const ProfileScreen(),
      RouteNames.dashboard => const DashboardScreen(),
      RouteNames.reportIssue => const ReportIssuePage(),
      _ => null,
    };
    if (page == null) return null;

    return PageRouteBuilder<void>(
      settings: settings,
      transitionDuration: const Duration(milliseconds: 420),
      reverseTransitionDuration: const Duration(milliseconds: 320),
      pageBuilder: (_, animation, secondaryAnimation) => page,
      transitionsBuilder: (_, animation, secondaryAnimation, child) {
        final curved = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutCubic,
          reverseCurve: Curves.easeInCubic,
        );
        return FadeTransition(
          opacity: curved,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(.07, 0),
              end: Offset.zero,
            ).animate(curved),
            child: ScaleTransition(
              scale: Tween<double>(begin: .985, end: 1).animate(curved),
              child: child,
            ),
          ),
        );
      },
    );
  }
}
