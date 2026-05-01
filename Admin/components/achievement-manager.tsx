'use client';

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/api';

interface Achievement {
  _id: string;
  code: string;
  name: string;
  category: string;
  description?: string;
  iconUrl?: string;
  conditionType: string;
  conditionField: string;
  conditionValue: number;
  xpReward: number;
  isActive: boolean;
  isRepeatable: boolean;
}

export default function AchievementManager() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'exploration',
    description: '',
    iconUrl: '',
    conditionType: 'count',
    conditionField: '',
    conditionOperator: 'gte',
    conditionValue: 0,
    filterField: '',
    filterValue: '',
    xpReward: 0,
    badgeCode: '',
    isActive: true,
    isRepeatable: false,
    maxCompletions: 1,
  });

  const categories = ['exploration', 'hosting', 'skill', 'social', 'special'];
  const conditionTypes = ['count', 'value', 'event'];
  const operators = ['gte', 'eq', 'lte', 'gt', 'lt'];

  useEffect(() => {
    loadAchievements();
  }, [filter]);

  const loadAchievements = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.append('category', filter);

      const response = await fetch(
        `${API_BASE_URL}/achievements?${params}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      const data = await response.json();
      setAchievements(data.data || []);
    } catch (error) {
      console.error('Error loading achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target as any;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : type === 'number'
            ? parseInt(value) || 0
            : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId
        ? `${API_BASE_URL}/achievements/${editingId}`
        : `${API_BASE_URL}/achievements`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        resetForm();
        loadAchievements();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Failed to save achievement');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (achievement: Achievement) => {
    setFormData({
      ...achievement,
      maxCompletions: achievement.isRepeatable ? 1 : 1,
    } as any);
    setEditingId(achievement._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this achievement?')) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/achievements/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        loadAchievements();
      } else {
        alert('Failed to delete achievement');
      }
    } catch (error) {
      console.error('Error deleting achievement:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      category: 'exploration',
      description: '',
      iconUrl: '',
      conditionType: 'count',
      conditionField: '',
      conditionOperator: 'gte',
      conditionValue: 0,
      filterField: '',
      filterValue: '',
      xpReward: 0,
      badgeCode: '',
      isActive: true,
      isRepeatable: false,
      maxCompletions: 1,
    });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Achievement Manager</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          {showForm ? 'Cancel' : 'Create Achievement'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-6 border rounded-lg bg-gray-50">
          <h2 className="text-xl font-bold mb-4">
            {editingId ? 'Edit Achievement' : 'Create New Achievement'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                name="code"
                placeholder="Code (e.g., DISTRICT_10)"
                value={formData.code}
                onChange={handleInputChange}
                className="border p-2 rounded"
                required
              />
              <input
                type="text"
                name="name"
                placeholder="Achievement Name"
                value={formData.name}
                onChange={handleInputChange}
                className="border p-2 rounded"
                required
              />

              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="border p-2 rounded"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                name="conditionType"
                value={formData.conditionType}
                onChange={handleInputChange}
                className="border p-2 rounded"
              >
                {conditionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <input
                type="text"
                name="conditionField"
                placeholder="User Field (e.g., xp, districtsVisited)"
                value={formData.conditionField}
                onChange={handleInputChange}
                className="border p-2 rounded"
                required
              />

              <select
                name="conditionOperator"
                value={formData.conditionOperator}
                onChange={handleInputChange}
                className="border p-2 rounded"
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>

              <input
                type="number"
                name="conditionValue"
                placeholder="Target Value"
                value={formData.conditionValue}
                onChange={handleInputChange}
                className="border p-2 rounded"
                required
              />

              <input
                type="number"
                name="xpReward"
                placeholder="XP Reward"
                value={formData.xpReward}
                onChange={handleInputChange}
                className="border p-2 rounded"
              />
            </div>

            <textarea
              name="description"
              placeholder="Description"
              value={formData.description}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
              rows={3}
            ></textarea>

            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                Active
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isRepeatable"
                  checked={formData.isRepeatable}
                  onChange={handleInputChange}
                />
                Repeatable
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
            >
              {loading ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Achievements List */}
      <div className="space-y-4">
        {loading && !achievements.length ? (
          <p>Loading achievements...</p>
        ) : achievements.length === 0 ? (
          <p className="text-gray-500">No achievements found</p>
        ) : (
          achievements.map((ach) => (
            <div
              key={ach._id}
              className="border p-4 rounded-lg flex justify-between items-start"
            >
              <div>
                <h3 className="font-bold text-lg">{ach.name}</h3>
                <p className="text-sm text-gray-600">{ach.code}</p>
                <p className="text-sm">{ach.description}</p>
                <p className="text-sm mt-2">
                  <span className="font-semibold">Condition:</span> {ach.conditionField}{' '}
                  {ach.conditionValue} • <span className="font-semibold">XP:</span>{' '}
                  {ach.xpReward}
                </p>
                <p className="text-xs text-gray-500">
                  Category: {ach.category} |{' '}
                  {ach.isActive ? '🟢 Active' : '🔴 Inactive'} |{' '}
                  {ach.isRepeatable ? 'Repeatable' : 'One-time'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(ach)}
                  className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(ach._id)}
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
