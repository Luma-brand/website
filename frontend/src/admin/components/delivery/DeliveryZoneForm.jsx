import { RefreshCw, Save, X } from "lucide-react";
import { LocationAutocomplete } from "../../../components/delivery/LocationAutocomplete";
import { formatNaira } from "../../../utils/currency";

export function DeliveryZoneForm({
  defaultDeliveryFee = 3000,
  editingZoneId = "",
  formData,
  isLoading = false,
  isSaving = false,
  locationSuggestions = [],
  migrationApplied = false,
  onCancelEdit,
  onChange,
  onLocationSelect,
  onRefresh,
  onSubmit,
}) {
  return (
    <div className="admin-card">
      <div className="admin-table-header">
        <h2>Default delivery fee</h2>

        <button
          type="button"
          className="admin-button secondary"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw size={16} />
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="admin-section-grid">
        <div className="admin-card stat-card">
          <small>Default fee</small>
          <strong>{formatNaira(defaultDeliveryFee)}</strong>
        </div>

        <div className="admin-card stat-card">
          <small>Delivery zones</small>
          <strong>{migrationApplied ? "Ready" : "Fallback"}</strong>
        </div>
      </div>

      {!migrationApplied && (
        <div className="admin-empty">
          Delivery zone migration has not been applied yet. Checkout will use
          the safe default fee.
        </div>
      )}

      <form className="delivery-zone-form" onSubmit={onSubmit}>
        <LocationAutocomplete
          label="Find location"
          placeholder="Search country, state, city, or region"
          disabled={isSaving || !migrationApplied}
          suggestions={locationSuggestions}
          onSelect={onLocationSelect}
        />

        <div className="admin-product-fields delivery-zone-fields">
          <label>
            Country
            <input
              name="country"
              value={formData.country}
              onChange={onChange}
              placeholder="Nigeria"
              disabled={isSaving || !migrationApplied}
            />
          </label>

          <label>
            State
            <input
              name="state"
              value={formData.state}
              onChange={onChange}
              placeholder="Lagos"
              disabled={isSaving || !migrationApplied}
            />
          </label>

          <label>
            Region
            <input
              name="region"
              value={formData.region}
              onChange={onChange}
              placeholder="Lekki, Abuja, Default..."
              disabled={isSaving || !migrationApplied}
            />
          </label>

          <label>
            Area override
            <input
              name="area"
              value={formData.area}
              onChange={onChange}
              placeholder="Optional area or Default"
              disabled={isSaving || !migrationApplied}
            />
          </label>

          <label>
            Delivery fee
            <input
              name="deliveryFee"
              type="number"
              min="0"
              step="50"
              value={formData.deliveryFee}
              onChange={onChange}
              placeholder="3000"
              disabled={isSaving || !migrationApplied}
            />
          </label>

          <label>
            Remote surcharge
            <input
              name="remoteSurcharge"
              type="number"
              min="0"
              step="50"
              value={formData.remoteSurcharge}
              onChange={onChange}
              placeholder="0"
              disabled={isSaving || !migrationApplied}
            />
          </label>

          <label>
            Minimum ETA (days)
            <input
              name="etaMinDays"
              type="number"
              min="0"
              value={formData.etaMinDays}
              onChange={onChange}
              placeholder="Optional"
              disabled={isSaving || !migrationApplied}
            />
          </label>

          <label>
            Maximum ETA (days)
            <input
              name="etaMaxDays"
              type="number"
              min="0"
              value={formData.etaMaxDays}
              onChange={onChange}
              placeholder="Optional"
              disabled={isSaving || !migrationApplied}
            />
          </label>

          <label>
            International region
            <input
              name="internationalRegion"
              value={formData.internationalRegion}
              onChange={onChange}
              placeholder="Example: West Africa"
              disabled={isSaving || !migrationApplied}
            />
          </label>

          <label>
            Pickup label
            <input
              name="pickupLabel"
              value={formData.pickupLabel}
              onChange={onChange}
              placeholder="Shown only for pickup zones"
              disabled={isSaving || !migrationApplied || !formData.isPickup}
            />
          </label>
        </div>

        <div className="delivery-zone-switches">
          <label>
            <input
              name="isDefault"
              type="checkbox"
              checked={formData.isDefault}
              onChange={onChange}
              disabled={isSaving || !migrationApplied}
            />
            Default fallback zone
          </label>

          <label>
            <input
              name="isActive"
              type="checkbox"
              checked={formData.isActive}
              onChange={onChange}
              disabled={isSaving || !migrationApplied}
            />
            Active
          </label>

          <label>
            <input
              name="isPickup"
              type="checkbox"
              checked={formData.isPickup}
              onChange={onChange}
              disabled={isSaving || !migrationApplied}
            />
            Pickup option
          </label>
        </div>

        <div className="delivery-zone-actions">
          <button
            type="submit"
            className="admin-button"
            disabled={isSaving || !migrationApplied}
          >
            <Save size={16} />
            {isSaving
              ? "Saving..."
              : editingZoneId
                ? "Update zone"
                : "Create zone"}
          </button>

          {editingZoneId && (
            <button
              type="button"
              className="admin-button secondary"
              onClick={onCancelEdit}
              disabled={isSaving}
            >
              <X size={16} />
              Cancel edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
