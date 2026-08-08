# Flutter architecture

The mobile client uses a feature-first structure. Code is grouped by business
capability first and by technical layer second, which keeps features discoverable
and prevents global `screens/` and `providers/` folders from growing indefinitely.

```text
lib/
|-- main.dart
|-- app/
|   |-- bootstrap.dart
|   |-- tripsathi_app.dart
|   `-- app_router.dart
|-- core/
|   |-- config/
|   |-- navigation/
|   |-- networking/
|   `-- theme/
`-- features/
    |-- auth/
    |-- onboarding/
    |-- dashboard/
    |-- profile/
    |-- trips/
    |-- campaigns/
    |-- reviews/
    |-- achievements/
    `-- splash/
```

## Dependency rules

1. `main.dart` depends only on `app/bootstrap.dart`.
2. `app/` composes features and shared providers; features never import `app/`.
3. `core/` contains business-agnostic infrastructure and never imports a feature.
4. A feature may import `core/` and its own files. Cross-feature imports should be
   limited to explicit public contracts, such as the shared authentication state.
5. Use `package:trtripsathi_mobile/...` imports across directories. Relative imports
   are reserved for files within the same small folder.

## Feature layers

Only create layers that contain real code:

- `presentation/pages/` for routed screens.
- `presentation/widgets/` for feature-owned reusable UI.
- `presentation/providers/` for UI state and orchestration.
- `data/` for feature-specific DTOs, data sources, and repository implementations.
- `domain/` for business entities, repository contracts, and use cases when the
  feature has business logic worth isolating.

The current API/token transport remains in `core/networking` because every feature
uses the same authenticated client. As feature APIs grow, endpoint-specific DTOs
and repositories should live in that feature's `data/` directory while reusing the
core transport.

## Naming

- Pages end in `_page.dart`.
- Providers end in `_provider.dart`.
- Shared services describe their responsibility, such as `api_service.dart`.
- Route strings are defined once in `core/navigation/route_names.dart`.
