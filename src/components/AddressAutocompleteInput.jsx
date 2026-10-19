import { useEffect, useRef, useState } from "react";
import { getGoogleMapsApiKey, loadGooglePlaces } from "../utils/googlePlaces";

function getPlaceComponent(place, type, useShortName = false) {
  const component = place?.address_components?.find((addressComponent) =>
    addressComponent.types?.includes(type),
  );

  return useShortName ? component?.short_name || "" : component?.long_name || "";
}

function getFullAddressFromPlace(place, fallbackAddress = "") {
  const streetNumber = getPlaceComponent(place, "street_number");
  const route = getPlaceComponent(place, "route");
  const city =
    getPlaceComponent(place, "locality") ||
    getPlaceComponent(place, "postal_town") ||
    getPlaceComponent(place, "administrative_area_level_2");
  const state = getPlaceComponent(place, "administrative_area_level_1", true);
  const zip = getPlaceComponent(place, "postal_code");
  const streetAddress = [streetNumber, route].filter(Boolean).join(" ");
  const cityStateZip = [
    city,
    [state, zip].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const fullAddress = [streetAddress, cityStateZip].filter(Boolean).join(", ");

  return fullAddress || place?.formatted_address || fallbackAddress;
}

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
  useUncontrolledValue = false,
  enableLocalFallback = false,
}) {
  const inputRef = useRef(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const hasGooglePlacesKey = Boolean(getGoogleMapsApiKey());
  const isLocalFallbackEnabled =
    enableLocalFallback &&
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const [inputValue, setInputValue] = useState(value || "");
  const [fallbackSuggestions, setFallbackSuggestions] = useState([]);
  const [fallbackStatus, setFallbackStatus] = useState("idle");
  const [isFallbackOpen, setIsFallbackOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [placesStatus, setPlacesStatus] = useState(
    isLocalFallbackEnabled
      ? "fallback-ready"
      : hasGooglePlacesKey
        ? "loading"
        : "missing-key",
  );
  const suggestionsId = id ? `${id}-suggestions` : undefined;

  useEffect(() => {
    valueRef.current = value;
    setInputValue(value || "");
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onPlaceSelectedRef.current = onPlaceSelected;
  }, [onPlaceSelected]);

  useEffect(() => {
    let listener = null;
    let isMounted = true;

    if (isLocalFallbackEnabled) {
      setPlacesStatus("fallback-ready");
      return () => {};
    }

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
          const nextAddress = getFullAddressFromPlace(
            place,
            inputRef.current?.value || "",
          );

          if (inputRef.current) {
            inputRef.current.value = nextAddress;
          }

          valueRef.current = nextAddress;
          setInputValue(nextAddress);
          onChangeRef.current(nextAddress);
          onPlaceSelectedRef.current?.(place, nextAddress);
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
  }, [hasGooglePlacesKey, isLocalFallbackEnabled]);

  useEffect(() => {
    if (!isLocalFallbackEnabled || !isFallbackOpen) {
      return undefined;
    }

    const query = inputValue.trim();

    if (query.length < 4) {
      setFallbackSuggestions([]);
      setFallbackStatus("idle");
      setActiveSuggestionIndex(-1);
      return undefined;
    }

    const controller = new AbortController();
    let isCurrent = true;
    setFallbackStatus("loading");
    setPlacesStatus("fallback-ready");

    const timeoutId = globalThis.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          f: "json",
          text: query,
          countryCode: "USA",
          location: "-116.2023,43.6150",
          maxSuggestions: "6",
          returnCollections: "false",
        });
        const response = await fetch(
          `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?${params.toString()}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Address suggestions are unavailable.");
        }

        const result = await response.json();

        if (!isCurrent) {
          return;
        }

        const suggestions = (result?.suggestions || [])
          .filter((suggestion) => suggestion?.text)
          .map((suggestion) => ({
            text: suggestion.text,
            magicKey: suggestion.magicKey || suggestion.text,
          }));

        setFallbackSuggestions(suggestions);
        setFallbackStatus(suggestions.length > 0 ? "ready" : "empty");
        setActiveSuggestionIndex(-1);
      } catch (suggestionError) {
        if (suggestionError?.name === "AbortError" || !isCurrent) {
          return;
        }

        console.warn("Unable to load fallback address suggestions:", suggestionError);
        setFallbackSuggestions([]);
        setFallbackStatus("error");
        setPlacesStatus("fallback-error");
      }
    }, 300);

    return () => {
      isCurrent = false;
      globalThis.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [inputValue, isFallbackOpen, isLocalFallbackEnabled]);

  function selectFallbackSuggestion(suggestion) {
    const nextAddress = suggestion.text;

    if (inputRef.current) {
      inputRef.current.value = nextAddress;
    }

    valueRef.current = nextAddress;
    setInputValue(nextAddress);
    setFallbackSuggestions([]);
    setFallbackStatus("idle");
    setIsFallbackOpen(false);
    setActiveSuggestionIndex(-1);
    onChangeRef.current(nextAddress);
    onPlaceSelectedRef.current?.(null, nextAddress);
  }

  function handleKeyDown(event) {
    if (!isLocalFallbackEnabled || !isFallbackOpen || fallbackSuggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((currentIndex) =>
        currentIndex >= fallbackSuggestions.length - 1 ? 0 : currentIndex + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((currentIndex) =>
        currentIndex <= 0 ? fallbackSuggestions.length - 1 : currentIndex - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      selectFallbackSuggestion(fallbackSuggestions[activeSuggestionIndex]);
      return;
    }

    if (event.key === "Escape") {
      setIsFallbackOpen(false);
      setActiveSuggestionIndex(-1);
    }
  }

  function commitCurrentInputValue() {
    globalThis.setTimeout(() => {
      const currentInputValue = inputRef.current?.value || "";

      if (currentInputValue !== valueRef.current) {
        valueRef.current = currentInputValue;
        onChangeRef.current(currentInputValue);
      }

      setIsFallbackOpen(false);
      setActiveSuggestionIndex(-1);
    }, 150);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete={isLocalFallbackEnabled ? "off" : autoComplete}
        {...(useUncontrolledValue
          ? { defaultValue: value }
          : { value })}
        role={isLocalFallbackEnabled ? "combobox" : undefined}
        aria-autocomplete={isLocalFallbackEnabled ? "list" : undefined}
        aria-expanded={isLocalFallbackEnabled ? isFallbackOpen : undefined}
        aria-controls={isLocalFallbackEnabled ? suggestionsId : undefined}
        aria-activedescendant={
          isLocalFallbackEnabled && activeSuggestionIndex >= 0
            ? `${suggestionsId}-${activeSuggestionIndex}`
            : undefined
        }
        onChange={(event) => {
          const nextValue = event.target.value;
          setInputValue(nextValue);
          setIsFallbackOpen(true);
          onChange(nextValue);
        }}
        onFocus={() => {
          if (fallbackSuggestions.length > 0 || fallbackStatus === "empty") {
            setIsFallbackOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={commitCurrentInputValue}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
      />

      {isLocalFallbackEnabled &&
      isFallbackOpen &&
      inputValue.trim().length >= 4 &&
      (fallbackStatus === "loading" ||
        fallbackStatus === "empty" ||
        fallbackSuggestions.length > 0) ? (
        <div
          id={suggestionsId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-[80] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        >
          {fallbackStatus === "loading" ? (
            <p className="px-4 py-3 text-sm font-bold text-slate-500">
              Finding addresses...
            </p>
          ) : fallbackStatus === "empty" ? (
            <p className="px-4 py-3 text-sm font-bold text-slate-500">
              No matching addresses found. You can still type it manually.
            </p>
          ) : (
            fallbackSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.magicKey}
                id={`${suggestionsId}-${index}`}
                type="button"
                role="option"
                aria-selected={activeSuggestionIndex === index}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveSuggestionIndex(index)}
                onClick={() => selectFallbackSuggestion(suggestion)}
                className={`block w-full border-b border-slate-100 px-4 py-3 text-left text-sm font-bold last:border-b-0 ${
                  activeSuggestionIndex === index
                    ? "bg-blue-50 text-blue-900"
                    : "bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                {suggestion.text}
              </button>
            ))
          )}
        </div>
      ) : null}

      {showStatus ? (
        <p
          className={`mt-2 text-xs font-bold ${
            placesStatus === "ready" || placesStatus === "fallback-ready"
              ? "text-emerald-700"
              : placesStatus === "loading"
                ? "text-slate-500"
                : "text-amber-700"
          }`}
        >
          {placesStatus === "ready"
            ? "Google address suggestions are on."
            : placesStatus === "fallback-ready"
              ? "Address suggestions are ready."
            : placesStatus === "loading"
              ? "Loading Google address suggestions..."
              : placesStatus === "missing-key"
                ? "Google address suggestions need VITE_GOOGLE_MAPS_API_KEY."
                : "Google address suggestions are not available. You can still type the address."}
        </p>
      ) : null}
    </div>
  );
}
