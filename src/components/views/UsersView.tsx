"use client";

import React from "react";
import { useStore } from "@/store/useStore";

export function UsersView() {
  const { auth, role, profiles } = useStore();

  if (role !== "admin") {
    return (
      <section className="p-8">
        <div className="bg-rose-50 text-rose-600 p-4 rounded-lg border border-rose-200">
          Access denied. You must be an administrator to view this page.
        </div>
      </section>
    );
  }

  // Use the profiles fetched from the database, or fallback to an empty array
  const usersList = profiles || [];

  return (
    <section className="p-8">
      <div className="bg-white rounded-xl border border-slate-200 shadow-card">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">System Users</p>
            <p className="text-xs text-slate-500 mt-0.5">Manage access to the AgriSense platform.</p>
          </div>
          <button className="text-sm px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-700 text-white font-medium flex items-center gap-2 transition">
            <i className="fa-solid fa-user-plus"></i> Invite User
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3 font-semibold">User</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Email</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {usersList.map((user, idx) => (
                <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50/60 transition">
                  <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-agri-100 flex items-center justify-center text-agri-700 font-bold text-xs">
                      {user.name.charAt(0)}
                    </div>
                    {user.name}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        user.role === "admin" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{user.email}</td>
                  <td className="px-6 py-4">
                    {user.status === 'active' ? (
                      <span className="text-[11px] font-semibold text-agri-700 bg-agri-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <i className="fa-solid fa-circle text-[6px]"></i>Active
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <i className="fa-solid fa-circle-minus text-[6px]"></i>Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-slate-400 hover:text-slate-600 transition p-1">
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
