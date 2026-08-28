import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Pencil, Save, Trash2 } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import { deleteWaitlistUser, getWaitlistUsers, updateWaitlistUser } from "../../services/api";

export function AdminWaitlist() {
  const [waitlist, setWaitlist] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [editingUser, setEditingUser] = useState(null);
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

  function beginEdit(user) {
    setEditingUser({
      id: user.id,
      email: user.email,
      fullName: user.full_name || "",
      interest: user.interest || "",
      status: user.status || "active",
      adminNotes: user.admin_notes || "",
    });
  }

  async function saveUser(event) {
    event.preventDefault();
    if (!editingUser) return;
    try {
      setActionLoadingId(editingUser.id);
      const response = await updateWaitlistUser(editingUser.id, editingUser);
      setWaitlist((current) => current.map((item) => (
        item.id === editingUser.id ? response.data : item
      )));
      setEditingUser(null);
    } catch (saveError) {
      alert(saveError.message || "Failed to update waitlist user.");
    } finally {
      setActionLoadingId("");
    }
  }

  function exportCSV() {
    const headers = ["Name", "Email", "Interest", "Status", "Admin notes", "Created At"];

    const rows = filteredWaitlist.map((user) => [
      user.full_name || "",
      user.email || "",
      user.interest || "",
      user.status || "active",
      user.admin_notes || "",
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
        subtitle="View, edit, track, export, and manage LUMA waitlist signups."
      />

      <section className="admin-content">
        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>Waitlist users</h2>

            <div className="admin-toolbar-group">
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
                    <th>Status</th>
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
                      <td><span className={`admin-badge ${user.status === "converted" ? "success" : ""}`}>{user.status || "active"}</span></td>
                      <td>
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <button type="button" className="admin-button secondary" onClick={() => beginEdit(user)}>
                          <Pencil size={15} /> Edit
                        </button>
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

        {editingUser && (
          <form className="admin-card pickup-location-form" onSubmit={saveUser}>
            <div className="admin-table-header">
              <div><h2>Edit waitlist entry</h2><p>{editingUser.email}</p></div>
              <button type="button" className="admin-button secondary" onClick={() => setEditingUser(null)}>Cancel</button>
            </div>
            <div className="admin-form-grid compact">
              <label>Name<input value={editingUser.fullName} onChange={(event) => setEditingUser({ ...editingUser, fullName: event.target.value })} /></label>
              <label>Interest<input value={editingUser.interest} onChange={(event) => setEditingUser({ ...editingUser, interest: event.target.value })} /></label>
              <label>Status<select value={editingUser.status} onChange={(event) => setEditingUser({ ...editingUser, status: event.target.value })}><option value="active">Active</option><option value="contacted">Contacted</option><option value="converted">Converted</option><option value="unsubscribed">Unsubscribed</option></select></label>
              <label>Admin notes<textarea rows="4" value={editingUser.adminNotes} onChange={(event) => setEditingUser({ ...editingUser, adminNotes: event.target.value })} /></label>
            </div>
            <button className="admin-button" type="submit" disabled={actionLoadingId === editingUser.id}><Save size={16} /> {actionLoadingId === editingUser.id ? "Saving..." : "Save waitlist entry"}</button>
          </form>
        )}
      </section>
    </>
  );
}
