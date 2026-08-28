import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, RefreshCw, RotateCcw, Save, Search } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import { useToast } from "../../context/ToastContext";
import {
  createPickupLocation,
  getDeliveryOverview,
  getPickupLocations,
  recalculateDeliveryRates,
  resetDeliveryRouteOverride,
  setDeliveryRouteOverride,
  updateDeliverySettings,
  updatePickupLocation,
  updatePricingBand,
  updateRegionRule,
} from "../../services/deliveryApi";
import { formatNaira } from "../../utils/currency";

const emptyLocation = {
  provider: "LUMA_STUDIO", state: "", city: "", area: "",
  branchName: "", fullAddress: "", latitude: "", longitude: "",
  active: true, lastVerifiedAt: "", pickupFeeOverride: "",
};

export function AdminDelivery() {
  const { showToast } = useToast();
  const [overview, setOverview] = useState(null);
  const [locations, setLocations] = useState([]);
  const [settings, setSettings] = useState({});
  const [routeSearch, setRouteSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [editingRoute, setEditingRoute] = useState(null);
  const [override, setOverride] = useState({ pickupPrice: "", homePrice: "", reason: "" });
  const [locationForm, setLocationForm] = useState(emptyLocation);
  const [editingLocationId, setEditingLocationId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const hydrateSettings = useCallback((data) => {
    const value = data?.settings || {};
    setSettings({
      originState: value.origin_state || "Lagos",
      baseFee: Number(value.base_fee_kobo || 0) / 100,
      defaultWeightGrams: value.default_weight_grams || 500,
      pickupMultiplier: Number(value.pickup_multiplier_bps || 10000) / 10000,
      homeMultiplier: Number(value.home_multiplier_bps || 10000) / 10000,
      homeLastMile: Number(value.home_last_mile_kobo || 0) / 100,
      globalPickupAdjustmentPercent: Number(value.global_pickup_adjustment_bps || 0) / 100,
      globalHomeAdjustmentPercent: Number(value.global_home_adjustment_bps || 0) / 100,
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const [deliveryResponse, studioResponse, gigResponse] = await Promise.all([
        getDeliveryOverview(),
        getPickupLocations({ provider: "LUMA_STUDIO" }, { admin: true }),
        getPickupLocations({ provider: "GIG_LOGISTICS" }, { admin: true }),
      ]);
      setOverview(deliveryResponse.data || null);
      hydrateSettings(deliveryResponse.data);
      setLocations([...(studioResponse.data || []), ...(gigResponse.data || [])]);
    } catch (loadError) {
      setError(loadError.message || "Failed to load delivery management.");
    } finally {
      setIsLoading(false);
    }
  }, [hydrateSettings]);

  useEffect(() => { queueMicrotask(() => { void loadData(); }); }, [loadData]);

  const filteredRoutes = useMemo(() => {
    const query = routeSearch.trim().toLowerCase();
    return (overview?.routes || []).filter((route) => !query ||
      [route.destination_state, route.destination_region, route.pricing_mode]
        .some((value) => String(value || "").toLowerCase().includes(query)));
  }, [overview?.routes, routeSearch]);

  const filteredLocations = useMemo(() => {
    const query = locationSearch.trim().toLowerCase();
    return locations.filter((location) => !query ||
      [location.provider, location.state, location.city, location.area, location.branch_name, location.full_address]
        .some((value) => String(value || "").toLowerCase().includes(query)));
  }, [locationSearch, locations]);

  async function run(action, successMessage) {
    try {
      setIsSaving(true);
      await action();
      showToast(successMessage);
      await loadData();
    } catch (actionError) {
      showToast(actionError.message || "The delivery change failed.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function saveSettings(event) {
    event.preventDefault();
    return run(() => updateDeliverySettings(settings), "Delivery rules updated and routes recalculated.");
  }

  function saveBand(event, type, band) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = type === "distance"
      ? { priceComponent: Number(form.get("amount")), label: form.get("label") }
      : { surcharge: Number(form.get("amount")), label: form.get("label") };
    return run(() => updatePricingBand(type, band.id, payload), "Pricing band updated.");
  }

  function saveRegion(event, rule) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    return run(
      () => updateRegionRule(rule.region, { adjustmentPercent: Number(form.get("adjustment")) }),
      `${rule.region} adjustment updated.`
    );
  }

  function saveOverride(event) {
    event.preventDefault();
    return run(async () => {
      await setDeliveryRouteOverride(editingRoute.id, override);
      setEditingRoute(null);
    }, "Manual route override saved.");
  }

  function editLocation(location) {
    setEditingLocationId(location.id);
    setLocationForm({
      provider: location.provider, state: location.state, city: location.city,
      area: location.area || "", branchName: location.branch_name,
      fullAddress: location.full_address, latitude: location.latitude ?? "",
      longitude: location.longitude ?? "", active: location.active,
      lastVerifiedAt: location.last_verified_at ? String(location.last_verified_at).slice(0, 10) : "",
      pickupFeeOverride: location.pickup_fee_override_kobo === null || location.pickup_fee_override_kobo === undefined
        ? ""
        : Number(location.pickup_fee_override_kobo) / 100,
    });
  }

  function saveLocation(event) {
    event.preventDefault();
    return run(async () => {
      if (editingLocationId) await updatePickupLocation(editingLocationId, locationForm);
      else await createPickupLocation(locationForm);
      setEditingLocationId("");
      setLocationForm({ ...emptyLocation });
    }, editingLocationId ? "Pickup location updated." : "Pickup location added.");
  }

  function toggleLocation(location) {
    return run(() => updatePickupLocation(location.id, {
      provider: location.provider, state: location.state, city: location.city,
      area: location.area, branchName: location.branch_name,
      fullAddress: location.full_address, latitude: location.latitude,
      longitude: location.longitude, active: !location.active,
      lastVerifiedAt: location.last_verified_at,
      pickupFeeOverride: location.pickup_fee_override_kobo === null || location.pickup_fee_override_kobo === undefined
        ? ""
        : Number(location.pickup_fee_override_kobo) / 100,
    }), location.active ? "Pickup location deactivated." : "Pickup location reactivated.");
  }

  const status = overview?.status || {};
  const locationFields = {
    state: "State", city: "City / area", area: "Neighbourhood",
    branchName: "Branch name", fullAddress: "Full address",
    latitude: "Latitude", longitude: "Longitude", lastVerifiedAt: "Last verified",
  };

  return (
    <>
      <AdminTopbar title="Delivery" subtitle="Manage free LUMA studio pickup, GIG collection, doorstep delivery, and fee overrides." />
      <section className="admin-content delivery-engine-admin">
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-metric-grid">
          <div className="admin-card"><span>Current origin</span><strong>{settings.originState || "—"}</strong></div>
          <div className="admin-card"><span>Routes</span><strong>{status.route_count || 0}</strong></div>
          <div className="admin-card"><span>Manual overrides</span><strong>{status.override_count || 0}</strong></div>
          <div className="admin-card"><span>LUMA studios</span><strong>{status.active_studio_count || 0}</strong></div>
          <div className="admin-card"><span>GIG branches</span><strong>{status.active_gig_count || 0}</strong></div>
        </div>

        <form className="admin-card delivery-settings-form" onSubmit={saveSettings}>
          <div className="admin-section-heading">
            <div><h2>Origin and pricing rules</h2><p>Editable LUMA fees—not official GIG Logistics prices.</p></div>
            <button type="button" className="admin-button secondary" onClick={() => run(recalculateDeliveryRates, "All routes recalculated.")} disabled={isSaving}><RefreshCw size={16} /> Recalculate all</button>
          </div>
          <div className="admin-form-grid compact">
            <label>Origin state<input value={settings.originState || ""} onChange={(event) => setSettings({ ...settings, originState: event.target.value })} /></label>
            <label>Base fee (NGN)<input type="number" min="0" value={settings.baseFee ?? ""} onChange={(event) => setSettings({ ...settings, baseFee: event.target.value })} /></label>
            <label>Default weight (g)<input type="number" min="1" value={settings.defaultWeightGrams ?? ""} onChange={(event) => setSettings({ ...settings, defaultWeightGrams: event.target.value })} /></label>
            <label>Pickup multiplier<input type="number" min="0.01" step="0.01" value={settings.pickupMultiplier ?? ""} onChange={(event) => setSettings({ ...settings, pickupMultiplier: event.target.value })} /></label>
            <label>Home multiplier<input type="number" min="0.01" step="0.01" value={settings.homeMultiplier ?? ""} onChange={(event) => setSettings({ ...settings, homeMultiplier: event.target.value })} /></label>
            <label>Home last-mile fee<input type="number" min="0" value={settings.homeLastMile ?? ""} onChange={(event) => setSettings({ ...settings, homeLastMile: event.target.value })} /></label>
            <label>Global pickup adjustment (%)<input type="number" step="0.1" value={settings.globalPickupAdjustmentPercent ?? ""} onChange={(event) => setSettings({ ...settings, globalPickupAdjustmentPercent: event.target.value })} /></label>
            <label>Global home adjustment (%)<input type="number" step="0.1" value={settings.globalHomeAdjustmentPercent ?? ""} onChange={(event) => setSettings({ ...settings, globalHomeAdjustmentPercent: event.target.value })} /></label>
          </div>
          <button className="admin-button" type="submit" disabled={isSaving}><Save size={16} /> Save pricing rules</button>
        </form>

        <div className="delivery-rule-columns">
          <div className="admin-card"><h2>Distance bands</h2>{(overview?.distanceBands || []).map((band) => <form key={band.id} className="delivery-inline-rule" onSubmit={(event) => saveBand(event, "distance", band)}><input name="label" defaultValue={band.label} /><input name="amount" type="number" min="0" defaultValue={band.price_component} /><button className="admin-button small" type="submit"><Save size={14} /></button></form>)}</div>
          <div className="admin-card"><h2>Weight bands</h2>{(overview?.weightBands || []).map((band) => <form key={band.id} className="delivery-inline-rule" onSubmit={(event) => saveBand(event, "weight", band)}><input name="label" defaultValue={band.label} /><input name="amount" type="number" min="0" defaultValue={band.surcharge} /><button className="admin-button small" type="submit"><Save size={14} /></button></form>)}</div>
          <div className="admin-card"><h2>Regional adjustments</h2>{(overview?.regionRules || []).map((rule) => <form key={rule.region} className="delivery-inline-rule" onSubmit={(event) => saveRegion(event, rule)}><strong>{rule.region}</strong><input name="adjustment" type="number" step="0.1" defaultValue={Number(rule.adjustment_bps || 0) / 100} /><button className="admin-button small" type="submit"><Save size={14} /></button></form>)}</div>
        </div>

        <div className="admin-card admin-table-card">
          <div className="admin-table-header"><div><h2>Route rates</h2><p>Standard 0–2 kg tier with explainable AUTO/MANUAL pricing.</p></div><label className="admin-search"><Search size={16} /><input value={routeSearch} onChange={(event) => setRouteSearch(event.target.value)} placeholder="Search destination" /></label></div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Destination</th><th>Distance</th><th>GIG branch</th><th>Doorstep</th><th>Mode</th><th>Action</th></tr></thead><tbody>{filteredRoutes.map((route) => <tr key={route.id}><td><strong>{route.destination_state}</strong><small>{route.destination_region}</small></td><td>{route.approximate_road_distance_km} km</td><td>{formatNaira(route.pickupPrice)}</td><td>{formatNaira(route.homePrice)}</td><td><span className={`admin-badge ${route.pricing_mode === "AUTO" ? "success" : "warning"}`}>{route.pricing_mode}</span></td><td><button className="admin-button small secondary" type="button" onClick={() => { setEditingRoute(route); setOverride({ pickupPrice: route.pickupPrice, homePrice: route.homePrice, reason: "" }); }}>Edit</button>{route.pricing_mode === "MANUAL" && <button className="admin-button small danger" type="button" onClick={() => run(() => resetDeliveryRouteOverride(route.id), "Route returned to automatic pricing.")}><RotateCcw size={14} /> Auto</button>}</td></tr>)}</tbody></table></div>
        </div>

        {editingRoute && <form className="admin-card route-override-form" onSubmit={saveOverride}><h2>Override {settings.originState} → {editingRoute.destination_state}</h2><p>Calculated: {formatNaira(editingRoute.calculatedPickupPrice)} pickup / {formatNaira(editingRoute.calculatedHomePrice)} home.</p><div className="admin-form-grid compact"><label>Pickup price<input type="number" min="0" value={override.pickupPrice} onChange={(event) => setOverride({ ...override, pickupPrice: event.target.value })} /></label><label>Home price<input type="number" min="0" value={override.homePrice} onChange={(event) => setOverride({ ...override, homePrice: event.target.value })} /></label><label>Reason<input value={override.reason} onChange={(event) => setOverride({ ...override, reason: event.target.value })} /></label></div><div className="admin-actions-row"><button className="admin-button" type="submit">Save override</button><button className="admin-button secondary" type="button" onClick={() => setEditingRoute(null)}>Cancel</button></div></form>}

        <form className="admin-card pickup-location-form" onSubmit={saveLocation}>
          <div className="admin-section-heading"><div><h2>{editingLocationId ? "Edit pickup location" : "Add pickup location"}</h2><p>Add unlimited LUMA studios or manage GIG branches. LUMA studio pickup is always free.</p></div><MapPin size={20} /></div>
          <div className="admin-form-grid compact">
            <label>Location type<select value={locationForm.provider} onChange={(event) => setLocationForm({ ...locationForm, provider: event.target.value, pickupFeeOverride: event.target.value === "LUMA_STUDIO" ? "0" : "" })}><option value="LUMA_STUDIO">LUMA studio</option><option value="GIG_LOGISTICS">GIG Logistics branch</option></select></label>
            <label>{locationForm.provider === "LUMA_STUDIO" ? "Pickup fee" : "Fee override (NGN, optional)"}<input type="number" min="0" value={locationForm.provider === "LUMA_STUDIO" ? 0 : locationForm.pickupFeeOverride} onChange={(event) => setLocationForm({ ...locationForm, pickupFeeOverride: event.target.value })} disabled={locationForm.provider === "LUMA_STUDIO"} placeholder="Use automated route fee" /></label>
          </div>
          <div className="admin-form-grid compact">{Object.entries(locationFields).map(([field, label]) => <label key={field}>{label}<input type={field === "lastVerifiedAt" ? "date" : "text"} value={locationForm[field]} onChange={(event) => setLocationForm({ ...locationForm, [field]: event.target.value })} required={["state", "city", "branchName", "fullAddress"].includes(field)} /></label>)}</div>
          <div className="admin-actions-row"><button className="admin-button" type="submit"><Save size={16} /> {editingLocationId ? "Update location" : "Add location"}</button>{editingLocationId && <button className="admin-button secondary" type="button" onClick={() => { setEditingLocationId(""); setLocationForm({ ...emptyLocation }); }}>Cancel</button>}</div>
        </form>

        <div className="admin-card admin-table-card">
          <div className="admin-table-header"><div><h2>Pickup locations</h2><p>{locations.length} locally stored locations.</p></div><label className="admin-search"><Search size={16} /><input value={locationSearch} onChange={(event) => setLocationSearch(event.target.value)} placeholder="Search location" /></label></div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Location</th><th>Type</th><th>State / city</th><th>Address</th><th>Fee</th><th>Status</th><th>Action</th></tr></thead><tbody>{filteredLocations.map((location) => <tr key={location.id}><td><strong>{location.branch_name}</strong></td><td>{location.provider === "LUMA_STUDIO" ? "LUMA studio" : "GIG Logistics"}</td><td>{location.state}<small>{location.city}</small></td><td>{location.full_address}</td><td>{location.provider === "LUMA_STUDIO" ? "Free" : location.pickup_fee_override_kobo === null || location.pickup_fee_override_kobo === undefined ? "Automatic" : formatNaira(Number(location.pickup_fee_override_kobo) / 100)}</td><td><span className={`admin-badge ${location.active ? "success" : "warning"}`}>{location.active ? "Active" : "Inactive"}</span></td><td><button type="button" className="admin-button small secondary" onClick={() => editLocation(location)}>Edit</button><button type="button" className="admin-button small" onClick={() => toggleLocation(location)}>{location.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div>
        </div>

        {isLoading && <div className="admin-empty">Loading delivery engine…</div>}
      </section>
    </>
  );
}
