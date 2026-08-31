"use client";

import React, { useState } from "react";
import { useStore } from "@/store/useStore";
import { supabase } from "@/lib/supabase";

export function UsersView() {
  const { role, profiles, addActivity } = useStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userRole, setUserRole] = useState<"farmer" | "admin">("farmer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  if (role !== "admin") {
    return (
      <section className="p-8">
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-200">
          Access restricted. Administrator privileges required to manage platform users.
        </div>
      </section>
    );
  }

  const usersList = (profiles || []).filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create user");

      if (userRole === "admin" && json.user?.id) {
        await fetch("/api/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: json.user.id, role: "admin" }),
        });
      }

      addActivity(`Created new ${userRole} account: ${name.trim()}`, "info");

      const { data: updatedProfiles } = await supabase.from("profiles").select("*").order("name");
      if (updatedProfiles) useStore.getState().setProfiles(updatedProfiles);

      setIsModalOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setUserRole("farmer");
    } catch (err: any) {
      setError(err?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = async (userId: string, currentRole: string, userName: string) => {
    const newRole = currentRole === "admin" ? "farmer" : "admin";
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }

      addActivity(`Updated role for ${userName} to ${newRole}`, "info");

      const { data: updatedProfiles } = await supabase.from("profiles").select("*").order("name");
      if (updatedProfiles) useStore.getState().setProfiles(updatedProfiles);
    } catch (e: any) {
      alert(`Could not update role: ${e?.message}`);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to remove user "${userName}"?`)) return;

    try {
      const res = await fetch(`/api/users?userId=${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }

      addActivity(`Removed user: ${userName}`, "info");

      const { data: updatedProfiles } = await supabase.from("profiles").select("*").order("name");
      if (updatedProfiles) useStore.getState().setProfiles(updatedProfiles);
    } catch (e: any) {
      alert(`Could not delete user: ${e?.message}`);
    }
  };

  return (
    <section className="p-8 space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">User Access Management</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage system permissions, invite field operators, and assign administrator roles.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-agri-500/30"
              />
              <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-2.5 text-slate-400 text-xs"></i>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-xs px-3.5 py-2 rounded-xl bg-agri-600 hover:bg-agri-700 text-white font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              <i className="fa-solid fa-user-plus text-xs"></i> Add User
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3.5 font-semibold">User</th>
                <th className="px-6 py-3.5 font-semibold">Role</th>
                <th className="px-6 py-3.5 font-semibold">Email</th>
                <th className="px-6 py-3.5 font-semibold">Status</th>
                <th className="px-6 py-3.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">
                    No users matching your search.
                  </td>
                </tr>
              ) : (
                usersList.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 font-semibold text-slate-800 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-agri-100 text-agri-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                      </div>
                      <div>
                        <p className="leading-tight">{user.name || "Unnamed User"}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleRoleToggle(user.id, user.role, user.name)}
                        title="Click to toggle role"
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border cursor-pointer transition ${
                          user.role === "admin"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        {user.role} ↻
                      </button>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className="text-[11px] font-semibold text-agri-700 bg-agri-100 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-agri-600"></span>Active
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(user.id, user.name)}
                        className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 transition"
                      >
                        <i className="fa-solid fa-trash-can mr-1"></i> Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-user-plus text-agri-600"></i> Add New User
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {error && (
              <div className="my-3 p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. maria@agrisense.com"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Role</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as "farmer" | "admin")}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 bg-white"
                >
                  <option value="farmer">Farmer / Field Operator</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-agri-600 hover:bg-agri-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-sm"
                >
                  {loading ? "Creating…" : "Save Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
