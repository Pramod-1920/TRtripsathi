'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiHome, FiUsers, FiBarChart2, FiLogOut } from 'react-icons/fi';
import clsx from 'clsx';

export function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    { href: '/dashboard', label: 'Dashboard', icon: FiHome },
    { href: '/users', label: 'Users', icon: FiUsers },
    { href: '/analytics', label: 'Analytics', icon: FiBarChart2 },
  ];

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
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-700">
        <button className="w-full flex items-center gap-3 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors">
          <FiLogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
