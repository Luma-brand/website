import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import { deleteWaitlistUser, getWaitlistUsers } from "../../services/api";

export function AdminWaitlist() {
  const [waitlist, setWaitlist] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [error, setError] = useState("");

  const loadWaitlist = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await getWaitlistUsers();
      setWaitlist(response.data || []);
    } catch (error) {
      setError(error.message || "Failed to load waitlist users.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadWaitlist();
    });
  }, [loadWaitlist]);

  const filteredWaitlist = useMemo(() => {
    const searchValue = search.toLowerCase();

    return waitlist.filter((user) => {
      return (
        user.full_name?.toLowerCase().includes(searchValue) ||
        user.email?.toLowerCase().includes(searchValue) ||
        user.interest?.toLowerCase().includes(searchValue)
      );
    });
  }, [search, waitlist]);

  async function handleDeleteUser(user) {
    const confirmed = window.confirm(
      `Delete ${user.email} from the waitlist?`
    );

    if (!confirmed) return;

    try {
      setActionLoadingId(user.id);
      await deleteWaitlistUser(user.id);

      setWaitlist((current) =>
        current.filter((item) => item.id !== user.id)
      );
    } catch (error) {
      alert(error.message || "Failed to delete waitlist user.");
    } finally {
      setActionLoadingId("");
    }
  }

  function exportCSV() {
    const headers = ["Name", "Email", "Interest", "Created At"];

    const rows = filteredWaitlist.map((user) => [
      user.full_name || "",
      user.email || "",
      user.interest || "",
      user.created_at || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "luma-waitlist.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <>
      <AdminTopbar
        title="Waitlist"
        subtitle="View, search, export, and delete LUMA waitlist signups."
      />

      <section className="admin-content">
        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>Waitlist users</h2>

            <div style={{ display: "flex", gap: 10 }}>
              <input
                className="admin-search"
                type="search"
                placeholder="Search users..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <button
                type="button"
                className="admin-button secondary"
                onClick={exportCSV}
              >
                <Download size={16} />
                Export CSV
              </button>
            </div>
          </div>

          {error && <div className="admin-error">{error}</div>}

          {isLoading ? (
            <div className="admin-empty">Loading waitlist...</div>
          ) : filteredWaitlist.length === 0 ? (
            <div className="admin-empty">No waitlist users found.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Interest</th>
                    <th>Date joined</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredWaitlist.map((user) => (
                    <tr key={user.id}>
                      <td>{user.full_name || "—"}</td>
                      <td>{user.email}</td>
                      <td>{user.interest || "—"}</td>
                      <td>
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-button danger"
                          onClick={() => handleDeleteUser(user)}
                          disabled={actionLoadingId === user.id}
                        >
                          <Trash2 size={15} />
                          {actionLoadingId === user.id ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
