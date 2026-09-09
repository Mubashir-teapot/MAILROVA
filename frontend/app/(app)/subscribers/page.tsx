"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/api/client";
import { CloseIcon, TrashIcon } from "@/components/icons";
import { confirmDialog } from "@/components/ConfirmDialog";

interface ListOption {
  id: number;
  name: string;
}

interface SubscriberList {
  listId: number;
  status: string;
  list: ListOption;
}

interface Subscriber {
  id: number;
  email: string;
  name: string;
  status: string;
  lists: SubscriberList[];
}

const STATUS_STYLE: Record<string, string> = {
  enabled: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  disabled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  blocklisted: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

export default function Subscribers() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [lists, setLists] = useState<ListOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ email: "", name: "", listIds: new Set<number>() });

  async function load() {
    const { data } = await api.get("/subscribers", { params: { search: search || undefined, perPage: 50 } });
    setSubscribers(data.results);
    setTotal(data.total);
  }

  useEffect(() => {
    api.get("/lists").then(({ data }) => setLists(data));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function toggleList(id: number) {
    setForm((f) => {
      const next = new Set(f.listIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...f, listIds: next };
    });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/subscribers", {
        email: form.email,
        name: form.name,
        listIds: Array.from(form.listIds),
      });
      setForm({ email: "", name: "", listIds: new Set() });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to add subscriber");
    }
  }

  async function handleDelete(id: number) {
    if (!(await confirmDialog("Delete this subscriber?"))) return;
    await api.delete(`/subscribers/${id}`);
    await load();
  }

  async function handleUnsubscribe(subscriberId: number, listId: number) {
    await api.post(`/subscribers/${subscriberId}/unsubscribe`, { listId });
    await load();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Subscribers</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{total} total</p>
        </div>
        <input
          className="input max-w-xs"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <form onSubmit={handleCreate} className="card flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="label">
            Email
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label className="label">
            Name
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
        </div>
        <div>
          <span className="label mb-2">Lists</span>
          <div className="flex flex-wrap gap-2">
            {lists.map((l) => (
              <label
                key={l.id}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm ${
                  form.listIds.has(l.id)
                    ? "border-accent bg-blue-50 text-accent dark:bg-blue-500/10"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600"
                }`}
              >
                <input type="checkbox" className="hidden" checked={form.listIds.has(l.id)} onChange={() => toggleList(l.id)} />
                {l.name}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn w-fit">
          Add subscriber
        </button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Status</th>
              <th>Lists</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {subscribers.map((s) => (
              <tr key={s.id}>
                <td>{s.email}</td>
                <td>{s.name}</td>
                <td>
                  <span className={`badge ${STATUS_STYLE[s.status]}`}>{s.status}</span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    {s.lists.map((sl) => (
                      <span
                        key={sl.listId}
                        className="group flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {sl.list.name}
                        <span className="text-slate-400 dark:text-slate-500">({sl.status})</span>
                        <button
                          onClick={() => handleUnsubscribe(s.id, sl.listId)}
                          className="text-slate-400 hover:text-red-600"
                          title="Unsubscribe from this list"
                        >
                          <CloseIcon width={12} height={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="w-10">
                  <button onClick={() => handleDelete(s.id)} className="text-slate-400 hover:text-red-600" aria-label="Delete">
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
            {!subscribers.length && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No subscribers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
