import { useEffect, useRef, useState } from "react";
import { getGoogleMapsApiKey, loadGooglePlaces } from "../utils/googlePlaces";

export default function AddressAutocompleteInput({
  id,
  value,
  onChange,
  onPlaceSelected,
  disabled = false,
  placeholder = "Address",
  className = "",
  showStatus = true,
  autoComplete = "street-address",
}) {
  const inputRef = useRef(null);
  const hasGooglePlacesKey = Boolean(getGoogleMapsApiKey());
  const [placesStatus, setPlacesStatus] = useState(
    hasGooglePlacesKey ? "loading" : "missing-key",
  );

  useEffect(() => {
    let listener = null;
    let isMounted = true;

    if (!hasGooglePlacesKey) {
      setPlacesStatus("missing-key");
      return () => {};
    }

    if (!inputRef.current) {
      return () => {};
    }

    setPlacesStatus("loading");

    loadGooglePlaces()
      .then((google) => {
        if (!isMounted) {
          return;
        }

        if (!google?.maps?.places || !inputRef.current) {
          setPlacesStatus("unavailable");
          return;
        }

        const autocomplete = new google.maps.places.Autocomplete(
          inputRef.current,
          {
            componentRestrictions: { country: "us" },
            fields: ["address_components", "formatted_address", "name"],
            types: ["address"],
          },
        );

        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const nextAddress =
            place.formatted_address || inputRef.current?.value || "";

          onChange(nextAddress);
          onPlaceSelected?.(place, nextAddress);
        });

        setPlacesStatus("ready");
      })
      .catch((placesError) => {
        console.warn("Unable to load Google Places:", placesError);
        setPlacesStatus("error");
      });

    return () => {
      isMounted = false;
      if (listener?.remove) {
        listener.remove();
      }
    };
  }, [hasGooglePlacesKey, onChange, onPlaceSelected]);

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
      />

      {showStatus ? (
        <p
          className={`mt-2 text-xs font-bold ${
            placesStatus === "ready"
              ? "text-emerald-700"
              : placesStatus === "loading"
                ? "text-slate-500"
                : "text-amber-700"
          }`}
        >
          {placesStatus === "ready"
            ? "Google address suggestions are on."
            : placesStatus === "loading"
              ? "Loading Google address suggestions..."
              : placesStatus === "missing-key"
                ? "Google address suggestions need VITE_GOOGLE_MAPS_API_KEY."
                : "Google address suggestions are not available. You can still type the address."}
        </p>
      ) : null}
    </>
  );
}
