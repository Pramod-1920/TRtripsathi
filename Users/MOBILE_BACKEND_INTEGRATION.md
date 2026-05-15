# TRtripsathi Mobile-Backend Integration Guide

## Overview

The Flutter mobile app is now fully connected to the NestJS backend. This guide explains how to use the API services and providers for different features.

## Backend Configuration

### Setting the Backend URL

The backend URL is configured in the `.env` file at the root of the `Users` (mobile app) directory.

**For Android Emulator:**
```
BACKEND_URL=http://10.0.2.2:3000
```

**For Physical Device:**
```
BACKEND_URL=http://192.168.X.X:3000
```
Replace `192.168.X.X` with your backend server's IP address.

**For Web/iOS Simulator:**
```
BACKEND_URL=http://localhost:3000
```

The environment configuration is loaded in `main.dart`:
```dart
await dotenv.load(fileName: ".env");
ApiService.baseUrl = dotenv.env['BACKEND_URL'] ?? 'http://10.0.2.2:3000';
```

## Architecture

### Three-Layer Architecture

1. **ApiService** (`lib/services/api.dart`)
   - Low-level HTTP communication with backend
   - Token management and automatic refresh
   - Error handling for API responses

2. **Providers** (`lib/providers/`)
   - State management using Provider package
   - Business logic and data caching
   - Change notification for UI updates

3. **Screens** (`lib/screens/`)
   - UI components consuming providers
   - User interactions and navigation

## Using the API

### Authentication

#### Login
```dart
try {
  final result = await ApiService.login(phoneNumber, password);
  // User is now authenticated, tokens stored in secure storage
} catch (e) {
  print('Login failed: $e');
}
```

#### Signup
```dart
try {
  final result = await ApiService.signup(phoneNumber, password);
  // User account created and authenticated
} catch (e) {
  print('Signup failed: $e');
}
```

#### Logout
```dart
await ApiService.logout();
// Tokens cleared from secure storage
```

#### Token Refresh
Automatic token refresh is handled internally. When a 401 response is received, the app automatically attempts to refresh the token using the refresh token stored in secure storage.

### User Management

#### Get Profile
```dart
final profile = await ApiService.getProfile();
// Returns: { userId, name, phoneNumber, profilePhoto, xp, level, ... }
```

#### Update Profile
```dart
final updated = await ApiService.updateProfile({
  'name': 'John Doe',
  'bio': 'Adventure enthusiast',
  'profilePhoto': 'url/to/photo.jpg',
});
```

#### Delete Account
```dart
await ApiService.deleteProfile();
// User account deleted, tokens cleared
```

### XP and Achievements

#### Get XP History
```dart
final history = await ApiService.getXpHistory(
  page: 1,
  limit: 20,
);
// Returns paginated list of XP transactions
```

#### Trigger XP Event
```dart
final result = await ApiService.triggerXpEvent(
  'trip_completed',
  {
    'tripId': '123abc',
    'distance': 15.5,
  },
);
```

#### Get Achievements
```dart
final achievements = await ApiService.getAchievements();
// Returns list of unlocked achievements
```

#### Record Achievement Event
```dart
await ApiService.triggerAchievementEvent({
  'eventType': 'altitude_reached',
  'value': 3000,
});
```

### Trips

#### List Trips
```dart
final result = await ApiService.listTrips(
  page: 1,
  limit: 20,
  status: 'upcoming', // or 'completed', 'cancelled'
  activityType: 'hike',
  difficulty: 'moderate',
  province: 'Bagmati',
  district: 'Kathmandu',
  lat: 27.7172,
  lng: 85.3240,
  maxDistance: 50000, // in meters
);
// Returns: { data: [trips...], total: number, page: number }
```

#### Create Trip
```dart
final trip = await ApiService.createTrip({
  'title': 'Hiking at Phulchoki',
  'description': 'A scenic hike with amazing views',
  'activityType': 'hike',
  'difficulty': 'moderate',
  'province': 'Bagmati',
  'district': 'Kathmandu',
  'location': {
    'type': 'Point',
    'coordinates': [85.3240, 27.7172],
  },
  'startDate': '2024-05-20T08:00:00Z',
  'endDate': '2024-05-20T16:00:00Z',
  'maxParticipants': 15,
});
```

#### Get Trip Details
```dart
final trip = await ApiService.getTripDetails(tripId);
// Returns full trip details with participants list
```

#### Update Trip
```dart
final updated = await ApiService.updateTrip(tripId, {
  'title': 'Updated Title',
  'description': 'Updated description',
});
```

#### Delete Trip
```dart
await ApiService.deleteTrip(tripId);
```

#### Join Trip
```dart
final result = await ApiService.joinTrip(tripId);
// Current user is added to trip participants
```

#### Checkin to Trip
```dart
await ApiService.checkinToTrip(
  tripId,
  latitude: 27.7172,
  longitude: 85.3240,
);
// Records user's checkin at the trip location
```

### Reviews

#### List Reviews
```dart
final result = await ApiService.listReviews(
  page: 1,
  limit: 20,
  targetType: 'trip', // or 'user', 'place'
  targetId: '123abc',
);
// Returns: { data: [reviews...], total: number }
```

#### Create Review
```dart
final review = await ApiService.createReview({
  'targetType': 'trip',
  'targetId': tripId,
  'rating': 5,
  'title': 'Amazing experience!',
  'content': 'Had a wonderful time on this trip...',
  'photos': ['url/to/photo1.jpg', 'url/to/photo2.jpg'],
});
```

#### Update Review
```dart
final updated = await ApiService.updateReview(reviewId, {
  'rating': 4,
  'content': 'Updated review content',
});
```

#### Delete Review
```dart
await ApiService.deleteReview(reviewId);
```

### Campaigns

#### List Campaigns
```dart
final result = await ApiService.listCampaigns(
  page: 1,
  limit: 20,
  status: 'active', // or 'draft', 'completed'
);
// Returns: { data: [campaigns...], total: number }
```

#### Get Campaign Details
```dart
final campaign = await ApiService.getCampaignDetails(campaignId);
// Returns full campaign details with participants
```

#### Join Campaign
```dart
await ApiService.joinCampaign(campaignId);
// Current user joins the campaign
```

## Using Providers

### TripsProvider

State management for trips listing and operations.

```dart
// In a widget
Consumer<TripsProvider>(
  builder: (context, tripsProvider, _) {
    // Load trips
    await tripsProvider.loadTrips(
      page: 1,
      status: 'upcoming',
    );

    // Display loading state
    if (tripsProvider.loading) {
      return CircularProgressIndicator();
    }

    // Display error
    if (tripsProvider.error != null) {
      return Text('Error: ${tripsProvider.error}');
    }

    // Display trips list
    return ListView.builder(
      itemCount: tripsProvider.trips.length,
      itemBuilder: (context, index) {
        return TripCard(trip: tripsProvider.trips[index]);
      },
    );
  },
)
```

Methods:
- `loadTrips()` - Load trips with optional filters
- `getTripDetails(tripId)` - Get single trip details
- `createTrip(data)` - Create new trip
- `updateTrip(tripId, updates)` - Update trip
- `deleteTrip(tripId)` - Delete trip
- `joinTrip(tripId)` - Join a trip
- `checkinToTrip(tripId, {lat, lng})` - Checkin to trip
- `nextPage()` / `previousPage()` - Pagination

### ReviewsProvider

State management for reviews.

```dart
Consumer<ReviewsProvider>(
  builder: (context, reviewsProvider, _) {
    await reviewsProvider.loadReviews(
      targetType: 'trip',
      targetId: tripId,
    );

    return ListView.builder(
      itemCount: reviewsProvider.reviews.length,
      itemBuilder: (context, index) {
        return ReviewCard(review: reviewsProvider.reviews[index]);
      },
    );
  },
)
```

Methods:
- `loadReviews()` - Load reviews with optional filters
- `createReview(data)` - Create new review
- `updateReview(reviewId, updates)` - Update review
- `deleteReview(reviewId)` - Delete review
- `nextPage()` / `previousPage()` - Pagination

### CampaignsProvider

State management for campaigns.

```dart
Consumer<CampaignsProvider>(
  builder: (context, campaignsProvider, _) {
    await campaignsProvider.loadCampaigns(status: 'active');

    return ListView.builder(
      itemCount: campaignsProvider.campaigns.length,
      itemBuilder: (context, index) {
        return CampaignCard(
          campaign: campaignsProvider.campaigns[index],
          onJoin: () => campaignsProvider.joinCampaign(
            campaignsProvider.campaigns[index]['_id'],
          ),
        );
      },
    );
  },
)
```

Methods:
- `loadCampaigns()` - Load campaigns with optional filters
- `getCampaignDetails(campaignId)` - Get campaign details
- `joinCampaign(campaignId)` - Join campaign
- `nextPage()` / `previousPage()` - Pagination

### AchievementsProvider

State management for user achievements and XP.

```dart
Consumer<AchievementsProvider>(
  builder: (context, achievementsProvider, _) {
    await achievementsProvider.loadAchievements();
    await achievementsProvider.loadProfile();

    return Column(
      children: [
        Text('XP: ${achievementsProvider.currentProfile?['xp']}'),
        ListView.builder(
          itemCount: achievementsProvider.achievements.length,
          itemBuilder: (context, index) {
            return AchievementCard(
              achievement: achievementsProvider.achievements[index],
            );
          },
        ),
      ],
    );
  },
)
```

Methods:
- `loadAchievements()` - Load user's achievements
- `loadProfile()` - Load user profile with XP info
- `getXpHistory()` - Get paginated XP history
- `triggerXpEvent(eventKey, context)` - Trigger XP event
- `triggerAchievementEvent(event)` - Trigger achievement event

### AuthProvider

Authentication state management.

```dart
Consumer<AuthProvider>(
  builder: (context, authProvider, _) {
    if (!authProvider.isAuthenticated) {
      return LoginScreen();
    }
    return HomeScreen();
  },
)
```

Methods:
- `signOut()` - Logout
- `refreshFromStorage()` - Check token status

## Example: Creating a Trips Screen

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/trips_provider.dart';

class TripsScreen extends StatefulWidget {
  @override
  State<TripsScreen> createState() => _TripsScreenState();
}

class _TripsScreenState extends State<TripsScreen> {
  @override
  void initState() {
    super.initState();
    // Load trips when screen initializes
    Future.microtask(() {
      context.read<TripsProvider>().loadTrips();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Trips')),
      body: Consumer<TripsProvider>(
        builder: (context, provider, _) {
          if (provider.loading) {
            return Center(child: CircularProgressIndicator());
          }

          if (provider.error != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('Error: ${provider.error}'),
                  ElevatedButton(
                    onPressed: () => provider.loadTrips(),
                    child: Text('Retry'),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            itemCount: provider.trips.length,
            itemBuilder: (context, index) {
              final trip = provider.trips[index];
              return ListTile(
                title: Text(trip['title']),
                subtitle: Text(trip['difficulty']),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => TripDetailsScreen(trip: trip),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
```

## Error Handling

All API methods throw exceptions on failure. Always wrap API calls in try-catch:

```dart
try {
  await ApiService.login(phone, password);
} on SocketException {
  print('Network error - check connection');
} catch (e) {
  print('Error: $e');
}
```

## Token Management

Tokens are stored in Flutter Secure Storage:
- **Access Token** (key: `jwt`) - Short-lived, used for API requests
- **Refresh Token** (key: `refresh`) - Long-lived, used to get new access tokens

The app automatically:
1. Sends access token in `Authorization: Bearer <token>` header
2. Detects 401 responses
3. Attempts to refresh using refresh token
4. Retries the original request
5. Clears tokens and notifies app if refresh fails

## Testing the Integration

1. Start the backend server:
   ```bash
   cd backend
   npm run start
   ```

2. Create `.env` file in `Users` directory with your backend URL

3. Run the Flutter app:
   ```bash
   cd Users
   flutter run
   ```

4. Test authentication:
   - Signup with a phone number and password
   - Verify token is stored
   - Navigate to trips screen
   - Verify API calls are working

## Troubleshooting

### "Connection refused" error
- Check backend is running
- Verify correct backend URL in `.env`
- For Android emulator: use `http://10.0.2.2:3000`
- For physical device: use device IP address

### "401 Unauthorized" error
- Tokens may have expired
- Try logging out and logging back in
- Check JWT_SECRET matches between frontend and backend

### CORS errors
- Backend must allow requests from app origin
- Check `FRONTEND_URL` in backend `.env`

## Next Steps

1. Implement remaining screens (trips details, campaign details, etc.)
2. Add local caching for offline support
3. Implement image upload/download
4. Add real-time updates using WebSockets
5. Add push notifications

## References

- [Provider Package Documentation](https://pub.dev/packages/provider)
- [Flutter HTTP Package](https://pub.dev/packages/http)
- [Flutter Secure Storage](https://pub.dev/packages/flutter_secure_storage)
- [Flutter Dotenv](https://pub.dev/packages/flutter_dotenv)
