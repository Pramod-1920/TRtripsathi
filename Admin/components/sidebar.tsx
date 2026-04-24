'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FiHome, FiUsers, FiBarChart2, FiUser, FiLogOut, FiMapPin, FiCircle, FiChevronDown, FiChevronRight, FiGrid } from 'react-icons/fi';
import clsx from 'clsx';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      logout();
      // Use location.replace to force a full navigation (avoids cached SPA flash on back)
      window.location.replace('/login');
    }
  };

  const menuItems = [
    { href: '/dashboard', label: 'Dashboard', icon: FiHome },
    { href: '/users', label: 'Users', icon: FiUsers },
    { href: '/analytics', label: 'Analytics', icon: FiBarChart2 },
    { href: '/profile', label: 'My Profile', icon: FiUser },
  ];
  const campaignItems = [
    { href: '/campaigns/add', label: 'Add Campaign' },
    { href: '/campaigns/details', label: 'Campaign Details' },
  ];

  const extraItems = [
    { href: '/extra/places', label: 'Places' },
    { href: '/extra/difficulty', label: 'Difficulty' },
    { href: '/extra/xp', label: 'XP' },
    { href: '/extra/badge', label: 'Badge' },
    { href: '/extra/level-up', label: 'Level Up' },
  ];

  const isCampaignSectionActive = pathname.startsWith('/campaigns');
  const isExtraSectionActive = pathname.startsWith('/extra');
  const [campaignOpen, setCampaignOpen] = useState(isCampaignSectionActive);
  const [extraOpen, setExtraOpen] = useState(isExtraSectionActive);

  useEffect(() => {
    if (isCampaignSectionActive) {
      setCampaignOpen(true);
    }
  }, [isCampaignSectionActive]);

  useEffect(() => {
    if (isExtraSectionActive) {
      setExtraOpen(true);
    }
  }, [isExtraSectionActive]);

  return (
    <div className="h-screen w-64 bg-slate-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold">TRTrips Admin</h1>
        <p className="text-sm text-slate-400">Management Panel</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'px-6 py-3 flex items-center gap-3 transition-colors',
              pathname === href
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            )}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}

        <div className="mt-2">
          <button
            type="button"
            onClick={() => setCampaignOpen((current) => !current)}
            className={clsx(
              'w-full px-6 py-3 flex items-center justify-between transition-colors',
              isCampaignSectionActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            )}
          >
            <span className="flex items-center gap-3">
              <FiMapPin size={20} />
              <span>Campaigns</span>
            </span>
            {campaignOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
          </button>

          <div className={clsx('space-y-1 py-1', campaignOpen ? 'block' : 'hidden')}>
            {campaignItems.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'ml-10 mr-3 px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors',
                    active
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  )}
                >
                  <FiCircle size={8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExtraOpen((current) => !current)}
            className={clsx(
              'w-full px-6 py-3 flex items-center justify-between transition-colors',
              isExtraSectionActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            )}
          >
            <span className="flex items-center gap-3">
              <FiGrid size={20} />
              <span>Extra</span>
            </span>
            {extraOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
          </button>

          <div className={clsx('space-y-1 py-1', extraOpen ? 'block' : 'hidden')}>
            {extraItems.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'ml-10 mr-3 px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors',
                    active
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  )}
                >
                  <FiCircle size={8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-700">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors"
        >
          <FiLogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
