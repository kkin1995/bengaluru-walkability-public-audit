"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

interface AdminSidebarProps {
  role: string;
}

export default function AdminSidebar({ role }: AdminSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = (
    <ul className="space-y-2" role="list">
      <li>
        <a
          href="/admin"
          className="block px-3 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium"
          onClick={() => setIsOpen(false)}
        >
          Dashboard
        </a>
      </li>
      <li>
        <a
          href="/admin/reports"
          className="block px-3 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium"
          onClick={() => setIsOpen(false)}
        >
          Reports
        </a>
      </li>
      <li>
        <a
          href="/admin/reports/map"
          className="block px-3 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium"
          onClick={() => setIsOpen(false)}
        >
          Reports Map
        </a>
      </li>
      <li>
        <a
          href="/admin/profile"
          className="block px-3 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium"
          onClick={() => setIsOpen(false)}
        >
          Profile
        </a>
      </li>
      {role === "admin" && (
        <li>
          <a
            href="/admin/users"
            className="block px-3 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium"
            onClick={() => setIsOpen(false)}
          >
            Users
          </a>
        </li>
      )}
    </ul>
  );

  return (
    <>
      {/* Mobile hamburger button — visible only below md breakpoint */}
      <button
        className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-white shadow-md border border-gray-200 md:hidden"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5 text-gray-700" />
      </button>

      {/* Mobile drawer overlay + sidebar */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
      <nav
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 p-4
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:transition-none
        `}
        aria-label="Admin navigation"
      >
        {/* Close button — mobile only */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-green-700">Walkability Admin</h1>
            <span className="text-xs text-gray-500 capitalize">{role}</span>
          </div>
          <button
            className="p-1 rounded-lg hover:bg-gray-100 md:hidden"
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {navLinks}
      </nav>
    </>
  );
}
