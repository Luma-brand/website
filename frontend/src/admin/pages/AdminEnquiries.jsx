import { useEffect, useMemo, useState } from "react";
import { AdminTopbar } from "../components/AdminTopbar";
import { getEnquiries } from "../../services/api";

export function AdminEnquiries() {
  const [enquiries, setEnquiries] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEnquiries() {
      try {
        setIsLoading(true);
        const response = await getEnquiries();
        setEnquiries(response.data || []);
      } catch (error) {
        setError(error.message || "Failed to load enquiries.");
      } finally {
        setIsLoading(false);
      }
    }

    loadEnquiries();
  }, []);

  const filteredEnquiries = useMemo(() => {
    const searchValue = search.toLowerCase();

    return enquiries.filter((item) => {
      return (
        item.full_name?.toLowerCase().includes(searchValue) ||
        item.email?.toLowerCase().includes(searchValue) ||
        item.subject?.toLowerCase().includes(searchValue) ||
        item.message?.toLowerCase().includes(searchValue)
      );
    });
  }, [search, enquiries]);

  return (
    <>
      <AdminTopbar
        title="Enquiries"
        subtitle="View messages sent through the LUMA website."
      />

      <section className="admin-content">
        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>Contact enquiries</h2>

            <input
              className="admin-search"
              type="search"
              placeholder="Search enquiries..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {error && <div className="admin-error">{error}</div>}

          {isLoading ? (
            <div className="admin-empty">Loading enquiries...</div>
          ) : filteredEnquiries.length === 0 ? (
            <div className="admin-empty">No enquiries found.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEnquiries.map((item) => (
                    <tr key={item.id}>
                      <td>{item.full_name}</td>
                      <td>{item.email}</td>
                      <td>{item.subject || "General enquiry"}</td>
                      <td>
                        <span className="admin-badge">
                          {item.status || "new"}
                        </span>
                      </td>
                      <td>
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-button secondary"
                          onClick={() => setSelectedEnquiry(item)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedEnquiry && (
          <div className="admin-card admin-table-card">
            <div className="admin-table-header">
              <h2>{selectedEnquiry.subject || "General enquiry"}</h2>

              <button
                type="button"
                className="admin-button secondary"
                onClick={() => setSelectedEnquiry(null)}
              >
                Close
              </button>
            </div>

            <p>
              <strong>Name:</strong> {selectedEnquiry.full_name}
            </p>
            <p>
              <strong>Email:</strong> {selectedEnquiry.email}
            </p>
            <p>
              <strong>Phone:</strong> {selectedEnquiry.phone || "—"}
            </p>
            <p>
              <strong>Message:</strong>
            </p>
            <p>{selectedEnquiry.message}</p>
          </div>
        )}
      </section>
    </>
  );
}