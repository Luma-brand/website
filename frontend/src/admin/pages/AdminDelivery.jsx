import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminTopbar } from "../components/AdminTopbar";
import { DeliveryZoneForm } from "../components/delivery/DeliveryZoneForm";
import { DeliveryZoneTable } from "../components/delivery/DeliveryZoneTable";
import { useToast } from "../../context/ToastContext";
import {
  createDeliveryZone,
  getDeliveryOverview,
  updateDeliveryZone,
} from "../../services/deliveryApi";

const emptyDeliveryZoneForm = {
  country: "Nigeria",
  state: "",
  region: "",
  deliveryFee: "",
  isDefault: false,
  isActive: true,
};

export function AdminDelivery() {
  const { showToast } = useToast();
  const [overview, setOverview] = useState(null);
  const [formData, setFormData] = useState(emptyDeliveryZoneForm);
  const [editingZoneId, setEditingZoneId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [zoneSearch, setZoneSearch] = useState("");
  const [error, setError] = useState("");

  const loadDeliveryOverview = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getDeliveryOverview();
      setOverview(response.data || null);
    } catch (error) {
      setError(error.message || "Failed to load delivery settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadDeliveryOverview();
    });
  }, [loadDeliveryOverview]);

  const locationSuggestions = useMemo(() => {
    const zones = overview?.zones || [];

    return zones
      .map((zone) =>
        [zone.region, zone.state, zone.country]
          .filter((value) => value && value !== "Default")
          .join(", ")
      )
      .filter(Boolean);
  }, [overview?.zones]);

  const filteredZones = useMemo(() => {
    const value = zoneSearch.trim().toLowerCase();
    const zones = overview?.zones || [];

    if (!value) return zones;

    return zones.filter((zone) =>
      [zone.country, zone.state, zone.region, zone.is_active ? "active" : "inactive"]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [overview?.zones, zoneSearch]);

  function handleFormChange(event) {
    const { checked, name, type, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleLocationSelect(location) {
    setFormData((current) => ({
      ...current,
      country: location.country || current.country || "Nigeria",
      state: location.state || current.state,
      region: location.region || current.region,
    }));
  }

  function handleEditZone(zone) {
    setEditingZoneId(zone.id);
    setFormData({
      country: zone.country || "Nigeria",
      state: zone.state === "Default" ? "" : zone.state || "",
      region: zone.region === "Default" ? "" : zone.region || "",
      deliveryFee: String(zone.delivery_fee ?? ""),
      isDefault: Boolean(zone.is_default),
      isActive: Boolean(zone.is_active),
    });
    setError("");
  }

  function handleCancelEdit() {
    setEditingZoneId("");
    setFormData(emptyDeliveryZoneForm);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!String(formData.deliveryFee).trim()) {
      setError("Delivery fee is required.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");

      const payload = {
        country: formData.country || "Nigeria",
        state: formData.state || "Default",
        region: formData.region || "Default",
        deliveryFee: Number(formData.deliveryFee),
        isDefault: formData.isDefault,
        isActive: formData.isActive,
      };

      if (editingZoneId) {
        await updateDeliveryZone(editingZoneId, payload);
        showToast("Delivery zone updated.");
      } else {
        await createDeliveryZone(payload);
        showToast("Delivery zone created.");
      }

      setFormData(emptyDeliveryZoneForm);
      setEditingZoneId("");
      await loadDeliveryOverview();
    } catch (error) {
      const message = error.message || "Failed to save delivery zone.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(zone) {
    try {
      setActionLoadingId(zone.id);
      setError("");

      await updateDeliveryZone(zone.id, {
        isActive: !zone.is_active,
      });

      showToast(
        zone.is_active ? "Delivery zone deactivated." : "Delivery zone activated."
      );
      await loadDeliveryOverview();
    } catch (error) {
      const message = error.message || "Failed to update delivery zone.";
      setError(message);
      showToast(message, "error");
    } finally {
      setActionLoadingId("");
    }
  }

  return (
    <>
      <AdminTopbar
        title="Delivery Fee Management"
        subtitle="Default and location-based delivery fees will be managed here."
      />

      <section className="admin-content">
        {error && <div className="admin-error">{error}</div>}

        <DeliveryZoneForm
          defaultDeliveryFee={overview?.defaultDeliveryFee}
          editingZoneId={editingZoneId}
          formData={formData}
          isLoading={isLoading}
          isSaving={isSaving}
          migrationApplied={overview?.migrationApplied}
          locationSuggestions={locationSuggestions}
          onCancelEdit={handleCancelEdit}
          onChange={handleFormChange}
          onLocationSelect={handleLocationSelect}
          onRefresh={loadDeliveryOverview}
          onSubmit={handleSubmit}
        />

        <DeliveryZoneTable
          actionLoadingId={actionLoadingId}
          isLoading={isLoading}
          migrationApplied={overview?.migrationApplied}
          onEdit={handleEditZone}
          onSearchChange={setZoneSearch}
          onToggleActive={handleToggleActive}
          searchTerm={zoneSearch}
          zones={filteredZones}
        />
      </section>
    </>
  );
}
