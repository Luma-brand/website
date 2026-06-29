import { useEffect, useId, useRef, useState } from "react";

const GOOGLE_PLACES_SCRIPT_ID = "luma-google-places-script";

function loadGooglePlaces(apiKey) {
  if (!apiKey || typeof window === "undefined") return Promise.resolve(false);
  if (window.google?.maps?.places) return Promise.resolve(true);

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_PLACES_SCRIPT_ID);

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true), { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_PLACES_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
}

function getAddressPart(components = [], type) {
  return (
    components.find((component) => component.types?.includes(type))?.long_name || ""
  );
}

function parsePlace(place) {
  const components = place?.address_components || [];
  const region =
    getAddressPart(components, "locality") ||
    getAddressPart(components, "sublocality") ||
    getAddressPart(components, "administrative_area_level_2");

  return {
    address: place?.formatted_address || place?.name || "",
    country: getAddressPart(components, "country"),
    state: getAddressPart(components, "administrative_area_level_1"),
    region,
  };
}

export function LocationAutocomplete({
  disabled = false,
  error = "",
  id,
  label,
  name,
  onChange,
  onSelect,
  placeholder = "Search for a delivery location",
  suggestions = [],
  value,
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listId = `${inputId}-suggestions`;
  const inputRef = useRef(null);
  const [internalValue, setInternalValue] = useState("");
  const [placesReady, setPlacesReady] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const inputValue = value ?? internalValue;

  useEffect(() => {
    if (!apiKey || disabled) return undefined;

    let autocomplete = null;
    let listener = null;
    let isMounted = true;

    loadGooglePlaces(apiKey)
      .then((ready) => {
        if (!ready || !isMounted || !inputRef.current) return;

        autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["address_components", "formatted_address", "name"],
          types: ["geocode"],
        });

        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const location = parsePlace(place);

          if (value === undefined) setInternalValue(location.address);
          onSelect?.(location);
        });

        setPlacesReady(true);
      })
      .catch(() => {
        if (isMounted) setPlacesReady(false);
      });

    return () => {
      isMounted = false;
      if (listener?.remove) listener.remove();
    };
  }, [apiKey, disabled, onSelect, value]);

  function handleChange(event) {
    if (value === undefined) setInternalValue(event.target.value);
    onChange?.(event);
  }

  return (
    <div className="form-field location-autocomplete-field">
      {label && <label htmlFor={inputId}>{label}</label>}
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        list={!placesReady && suggestions.length ? listId : undefined}
        autoComplete="street-address"
      />

      {!placesReady && suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}

      <p className="location-autocomplete-hint">
        {placesReady
          ? "Google Places is active for location suggestions."
          : "Enter the location manually or choose a configured delivery zone."}
      </p>

      {error && <small>{error}</small>}
    </div>
  );
}
