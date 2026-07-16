'use client';

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/api';

interface UserAchievementProgress {
  achievementId: string;
  code: string;
  name: string;
  category: string;
  progress: number;
  conditionValue: number;
  isCompleted: boolean;
  completedAt?: string;
  timesCompleted: number;
  xpReward: number;
  badgeCode?: string;
  progressPercentage: number;
}

interface UserAchievementsResponse {
  userId: string;
  totalAchievements: number;
  completedAchievements: number;
  completionPercentage: number;
  achievements: UserAchievementProgress[];
}

interface Props {
  userId: string;
  showAdminPanel?: boolean;
}

export default function UserAchievementsDisplay({
  userId,
  showAdminPanel = false,
}: Props) {
  const [achievements, setAchievements] = useState<UserAchievementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showCompleted, setShowCompleted] = useState(false);

  const categories = [
    'exploration',
    'hosting',
    'skill',
    'social',
    'special',
  ];

  useEffect(() => {
    loadAchievements();
  }, [userId]);

  const loadAchievements = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/achievements/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAchievements(data);
      } else {
        console.error('Failed to load achievements');
      }
    } catch (error) {
      console.error('Error loading achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      exploration: '🗺️',
      hosting: '🏕️',
      skill: '⚡',
      social: '👥',
      special: '⭐',
    };
    return icons[category] || '🎯';
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage === 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    if (percentage >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return <div className="p-6">Loading achievements...</div>;
  }

  if (!achievements) {
    return <div className="p-6">Failed to load achievements</div>;
  }

  let filteredAchievements = [...achievements.achievements];
  if (selectedCategory) {
    filteredAchievements = filteredAchievements.filter(
      (a) => a.category === selectedCategory
    );
  }
  if (!showCompleted) {
    filteredAchievements = filteredAchievements.filter((a) => !a.isCompleted);
  }

  const completedCount = achievements.achievements.filter(
    (a) => a.isCompleted
  ).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Summary */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">🏆 Achievements</h1>

        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg">
            <p className="text-sm opacity-90">Total Achievements</p>
            <p className="text-3xl font-bold">
              {achievements.completedAchievements}/{achievements.totalAchievements}
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg">
            <p className="text-sm opacity-90">Completion Rate</p>
            <p className="text-3xl font-bold">
              {achievements.completionPercentage}%
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg">
            <p className="text-sm opacity-90">Total XP Earned</p>
            <p className="text-3xl font-bold">
              {achievements.achievements
                .filter((a) => a.isCompleted)
                .reduce((sum, a) => sum + a.xpReward, 0)}
            </p>
          </div>
        </div>

        {/* Master Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Overall Progress</span>
            <span className="text-sm text-gray-600">
              {achievements.completionPercentage}%
            </span>
          </div>
          <div className="w-full h-4 bg-gray-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
              style={{
                width: `${achievements.completionPercentage}%`,
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4 flex-wrap">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-4 py-2 rounded transition ${
            selectedCategory === ''
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          All
        </button>

        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded transition ${
              selectedCategory === cat
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {getCategoryIcon(cat)} {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}

        <label className="flex items-center gap-2 ml-auto">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="cursor-pointer"
          />
          <span>Show Completed</span>
        </label>
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements.length === 0 ? (
          <p className="col-span-full text-center text-gray-500 py-8">
            {showCompleted
              ? 'No achievements found'
              : 'You have completed all achievements in this category!'}
          </p>
        ) : (
          filteredAchievements.map((ach) => (
            <div
              key={ach.achievementId}
              className={`p-4 rounded-lg border-2 transition ${
                ach.isCompleted
                  ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300'
                  : 'bg-white border-gray-300 hover:border-blue-500'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {getCategoryIcon(ach.category)}
                    </span>
                    <h3 className="font-bold text-lg">{ach.name}</h3>
                  </div>
                  <p className="text-xs text-gray-500">{ach.code}</p>
                </div>
                {ach.isCompleted && (
                  <span className="text-2xl">✨</span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-semibold">
                    {ach.progress}/{ach.conditionValue}
                  </span>
                  <span className="text-sm text-gray-600">
                    {ach.progressPercentage}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-300 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${getProgressColor(
                      ach.progressPercentage
                    )}`}
                    style={{ width: `${ach.progressPercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Metadata */}
              <div className="text-sm space-y-1">
                {ach.badgeCode && (
                  <p className="text-yellow-600">
                    🏅 Badge: {ach.badgeCode}
                  </p>
                )}
                <p className="text-blue-600 font-semibold">
                  ⭐ +{ach.xpReward} XP
                </p>

                {ach.isCompleted && (
                  <>
                    <p className="text-green-600">
                      ✅ Unlocked{' '}
                      {ach.completedAt &&
                        new Date(ach.completedAt).toLocaleDateString()}
                    </p>
                    {ach.timesCompleted > 1 && (
                      <p className="text-purple-600">
                        🔄 Unlocked {ach.timesCompleted} times
                      </p>
                    )}
                  </>
                )}

                {!ach.isCompleted && (
                  <p className="text-gray-500">
                    Need {ach.conditionValue - ach.progress} more
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Admin Panel (if enabled) */}
      {showAdminPanel && (
        <div className="mt-12 p-6 bg-gray-100 rounded-lg border-2 border-gray-300">
          <h2 className="text-2xl font-bold mb-4">🔧 Admin Panel</h2>
          <button
            onClick={loadAchievements}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Refresh Achievements
          </button>
          <p className="mt-4 text-sm text-gray-600">
            Use the Achievement Manager to create and modify achievements.
          </p>
        </div>
      )}
    </div>
  );
}
