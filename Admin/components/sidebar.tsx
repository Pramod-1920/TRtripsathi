'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  FiHome,
  FiUsers,
  FiBarChart2,
  FiUser,
  FiLogOut,
  FiMapPin,
  FiCircle,
  FiChevronDown,
  FiChevronRight,
  FiGrid,
  FiShield,
  FiX,
} from 'react-icons/fi';
import clsx from 'clsx';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function Sidebar({ collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
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
    { href: '/photo-verification-queue', label: 'Photo Queue', icon: FiShield },
    { href: '/analytics', label: 'Analytics', icon: FiBarChart2 },
  ];
  const myItems = [
    { href: '/profile', label: 'My Profile' },
    { href: '/my-campaign', label: 'My Campaign' },
  ];
  const campaignItems = [
    { href: '/campaigns/add', label: 'Add Campaign' },
    { href: '/campaigns/details', label: 'Campaign Details' },
    { href: '/campaigns/approval', label: 'Campaign Approval' },
  { href: '/campaigns/bin', label: 'Campaign User' },
    { href: '/campaigns/reviews', label: 'Reviews' },
  ];

  const extraItems = [
    { href: '/extra/places', label: 'Places' },
    { href: '/extra/difficulty', label: 'Difficulty' },
    { href: '/extra/activities', label: 'Activities' },
    { href: '/extra/xp', label: 'XP' },
    { href: '/extra/badge', label: 'Badge' },
    { href: '/extra/level-up', label: 'Level Up' },
    { href: '/extra/achievement', label: 'Achievements' },
  ];

  const isCampaignSectionActive = pathname.startsWith('/campaigns');
  const sidebarWidthClass = collapsed ? 'md:w-20' : 'md:w-72';
  const isMySectionActive = pathname === '/profile' || pathname.startsWith('/my-campaign');
  const isExtraSectionActive = pathname.startsWith('/extra');
  const [myOpen, setMyOpen] = useState<boolean>(() => isMySectionActive);
  const [campaignOpen, setCampaignOpen] = useState<boolean>(() => isCampaignSectionActive);
  const [extraOpen, setExtraOpen] = useState<boolean>(() => isExtraSectionActive);

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-foreground/35 md:hidden"
          aria-label="Close sidebar overlay"
        />
      ) : null}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl transition-all duration-300 ease-out',
          sidebarWidthClass,
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={clsx('flex items-center justify-between border-b border-sidebar-border p-5', collapsed ? 'md:px-3' : 'md:px-5')}>
          <div className={clsx('min-w-0', collapsed ? 'md:hidden' : 'block')}>
            <h1 className="text-xl font-bold tracking-tight text-sidebar-foreground">Yatri Admin</h1>
            <p className="text-sm text-muted-foreground">Management Panel</p>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent md:hidden"
            aria-label="Close sidebar"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          {menuItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={clsx(
                  'mx-2 flex items-center gap-3 rounded-xl px-4 py-3 transition-colors',
                  collapsed ? 'md:justify-center md:px-3' : 'md:px-4',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon size={20} className="shrink-0" />
                <span className={clsx('truncate', collapsed ? 'md:hidden' : 'block')}>
                  {label}
                </span>
              </Link>
            );
          })}

          <div className="mt-2">
            <button
              type="button"
              onClick={() => setMyOpen((current) => !current)}
              title={collapsed ? 'MY' : undefined}
              className={clsx(
                'mx-2 flex w-[calc(100%-1rem)] items-center justify-between rounded-xl px-4 py-3 transition-colors',
                collapsed ? 'md:justify-center md:px-3' : 'md:px-4',
                isMySectionActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <span className="flex items-center gap-3">
                <FiUser size={20} className="shrink-0" />
                <span className={collapsed ? 'md:hidden' : 'block'}>MY</span>
              </span>
              <span className={collapsed ? 'md:hidden' : 'block'}>
                {myOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
              </span>
            </button>

            <div className={clsx('space-y-1 py-1', myOpen ? 'block' : 'hidden', collapsed ? 'md:hidden' : 'block')}>
              {myItems.map((item) => {
                const active = item.href === '/my-campaign'
                  ? pathname.startsWith('/my-campaign')
                  : pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'mx-2 flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors',
                      active
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <FiCircle size={8} className="shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-2">
            <button
              type="button"
              onClick={() => setCampaignOpen((current) => !current)}
              title={collapsed ? 'Campaigns' : undefined}
              className={clsx(
                'mx-2 flex w-[calc(100%-1rem)] items-center justify-between rounded-xl px-4 py-3 transition-colors',
                collapsed ? 'md:justify-center md:px-3' : 'md:px-4',
                isCampaignSectionActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <span className="flex items-center gap-3">
                <FiMapPin size={20} className="shrink-0" />
                <span className={collapsed ? 'md:hidden' : 'block'}>Campaigns</span>
              </span>
              <span className={collapsed ? 'md:hidden' : 'block'}>
                {campaignOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
              </span>
            </button>

            <div className={clsx('space-y-1 py-1', campaignOpen ? 'block' : 'hidden', collapsed ? 'md:hidden' : 'block')}>
              {campaignItems.map((item) => {
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'mx-2 flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors',
                      active
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <FiCircle size={8} className="shrink-0" />
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
              title={collapsed ? 'Extra' : undefined}
              className={clsx(
                'mx-2 flex w-[calc(100%-1rem)] items-center justify-between rounded-xl px-4 py-3 transition-colors',
                collapsed ? 'md:justify-center md:px-3' : 'md:px-4',
                isExtraSectionActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <span className="flex items-center gap-3">
                <FiGrid size={20} className="shrink-0" />
                <span className={collapsed ? 'md:hidden' : 'block'}>Extra</span>
              </span>
              <span className={collapsed ? 'md:hidden' : 'block'}>
                {extraOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
              </span>
            </button>

            <div className={clsx('space-y-1 py-1', extraOpen ? 'block' : 'hidden', collapsed ? 'md:hidden' : 'block')}>
              {extraItems.map((item) => {
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'mx-2 flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors',
                      active
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <FiCircle size={8} className="shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Logout */}
        <div className="border-t border-sidebar-border p-4">
          <button
            type="button"
            onClick={handleLogout}
            className={clsx(
              'flex w-full items-center gap-3 rounded-xl px-4 py-3 font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent',
              collapsed ? 'md:justify-center md:px-3' : 'md:px-4'
            )}
          >
            <FiLogOut size={20} className="shrink-0 text-red-600" />
            <span className={collapsed ? 'md:hidden' : 'block'}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
