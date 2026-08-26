import { Pencil, Power } from "lucide-react";
import { formatNaira } from "../../../utils/currency";

export function DeliveryZoneTable({
  zones = [],
  actionLoadingId = "",
  isLoading = false,
  migrationApplied = false,
  onEdit,
  onSearchChange,
  onToggleActive,
  searchTerm = "",
}) {
  return (
    <div className="admin-card admin-table-card">
      <div className="admin-table-header">
        <h2>Delivery zones</h2>

        {migrationApplied && (
          <input
            className="admin-search"
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="Search zones"
            aria-label="Search delivery zones"
          />
        )}
      </div>

      {isLoading ? (
        <div className="admin-empty">Loading delivery zones...</div>
      ) : !migrationApplied ? (
        <div className="admin-empty">
          Delivery zones will appear here after the Phase 1 migration is applied.
        </div>
      ) : zones.length === 0 ? (
        <div className="admin-empty">No delivery zones configured yet.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>State</th>
                <th>Region</th>
                <th>Area</th>
                <th>Fee</th>
                <th>ETA</th>
                <th>Default</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id}>
                  <td>{zone.country}</td>
                  <td>{zone.state}</td>
                  <td>{zone.region}</td>
                  <td>{zone.area || "Default"}</td>
                  <td>
                    {formatNaira(Number(zone.delivery_fee || 0) + Number(zone.remote_surcharge || 0))}
                    {Number(zone.remote_surcharge || 0) > 0 && <small>Includes remote surcharge</small>}
                  </td>
                  <td>
                    {zone.eta_min_days === null || zone.eta_min_days === undefined
                      ? "—"
                      : `${zone.eta_min_days}${zone.eta_max_days && zone.eta_max_days !== zone.eta_min_days ? `–${zone.eta_max_days}` : ""} days`}
                    {zone.is_pickup && <small>{zone.pickup_label || "Pickup"}</small>}
                  </td>
                  <td>{zone.is_default ? "Yes" : "No"}</td>
                  <td>
                    <span className="admin-badge">
                      {zone.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    {zone.updated_at
                      ? new Date(zone.updated_at).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td>
                    <div className="delivery-zone-row-actions">
                      <button
                        type="button"
                        className="admin-button secondary"
                        onClick={() => onEdit(zone)}
                        disabled={actionLoadingId === zone.id}
                      >
                        <Pencil size={15} />
                        Edit
                      </button>

                      <button
                        type="button"
                        className={
                          zone.is_active
                            ? "admin-button danger"
                            : "admin-button secondary"
                        }
                        onClick={() => onToggleActive(zone)}
                        disabled={actionLoadingId === zone.id}
                      >
                        <Power size={15} />
                        {actionLoadingId === zone.id
                          ? "Saving..."
                          : zone.is_active
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
