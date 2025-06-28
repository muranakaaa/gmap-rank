import { useEffect, useRef, useState, useCallback } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import "./App.css";

type GPlace = google.maps.places.PlaceResult;

interface SearchParams {
  location: google.maps.LatLng | google.maps.LatLngLiteral;
}

export default function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [places, setPlaces] = useState<GPlace[]>([]);
  const [searchParams, setSearchParams] = useState<SearchParams>({
    location: { lat: 34.6937, lng: 135.5023 }, // 大阪
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
  };

  const searchPlaces = useCallback((params: SearchParams) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    
    setIsLoading(true);
    setPlaces([]);
    clearMarkers();
    
    const service = new google.maps.places.PlacesService(map);
    const results: GPlace[] = [];

    const callback: google.maps.places.PlaceSearchPaginationCallback = (
      res,
      status,
      pagination
    ) => {
      if (
        status !== google.maps.places.PlacesServiceStatus.OK ||
        !res ||
        res.length === 0
      ) {
        setIsLoading(false);
        return;
      }

      results.push(...res);

      if (pagination && pagination.hasNextPage) {
        pagination.nextPage();
      } else {
        results.sort(
          (a, b) =>
            (b.user_ratings_total ?? 0) - (a.user_ratings_total ?? 0)
        );
        setPlaces(results);
        setIsLoading(false);

        results.forEach((p) => {
          if (!p.geometry?.location) return;
          const marker = new google.maps.Marker({
            map,
            position: p.geometry.location,
          });
          markersRef.current.push(marker);
        });
      }
    };

    service.nearbySearch(
      { 
        location: params.location, 
        radius: 2000, 
        type: "restaurant"
      },
      callback
    );
  }, []);

  useEffect(() => {
    const loader = new Loader({
      apiKey: import.meta.env.VITE_GMAPS_KEY as string,
      libraries: ["places"],
    });

    loader.load().then(() => {
      const mapInstance = new google.maps.Map(mapRef.current!, {
        center: searchParams.location,
        zoom: 14,
      });
      
      mapInstanceRef.current = mapInstance;
      setIsMapLoaded(true);

      mapInstance.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (event.latLng) {
          const newLocation = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng()
          };
          mapInstance.setCenter(newLocation);
          setCurrentLocation(newLocation);
          setSearchParams(prev => ({ ...prev, location: newLocation }));
        }
      });

      setCurrentLocation(searchParams.location);
    });
  }, []);

  const handleSearch = () => {
    if (isMapLoaded && mapInstanceRef.current) {
      const currentCenter = mapInstanceRef.current.getCenter();
      if (currentCenter) {
        const currentParams = {
          location: {
            lat: currentCenter.lat(),
            lng: currentCenter.lng()
          }
        };
        searchPlaces(currentParams);
      }
    }
  };

  useEffect(() => {
    if (isMapLoaded && mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(searchParams.location);
    }
  }, [searchParams.location, isMapLoaded]);

  return (
    <>
      <header className="app-header">
        <h1 className="app-title">Map Ranking</h1>
        <p className="app-subtitle">口コミ数で見つける人気スポット</p>
      </header>

      <div className="control-panel">
        <div className="control-hint">
          地図をクリックしてエリアを選択してください
        </div>
      </div>

      <div ref={mapRef} className="map-container" />
      
      <div className="search-panel">
        {currentLocation && (
          <div style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
            選択中の座標: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
          </div>
        )}
        <button 
          onClick={handleSearch}
          className="search-button"
          disabled={isLoading}
        >
          {isLoading ? '検索中...' : '🔍 この場所で検索'}
        </button>
      </div>
      
      {(isLoading || places.length > 0) && (
        <div className="results-section">
          {isLoading && (
            <div className="loading-spinner">
              検索中です...
            </div>
          )}
          
          {!isLoading && places.length > 0 && (
            <>
              <h2 className="results-header">
                🍽️ レストランランキング ({places.length}件)
              </h2>
              <ul className="results-list">
                {places.map((p, i) => (
                  <li key={p.place_id} className="result-item">
                    <div className="result-content">
                      <div className="result-rank">{i + 1}</div>
                      <div className="result-info">
                        <h3 className="result-name">{p.name}</h3>
                        <div className="result-stats">
                          <div className="stat-badge reviews-badge">
                            💬 {p.user_ratings_total || 0} 件の口コミ
                          </div>
                          {p.rating && (
                            <div className="stat-badge rating-badge">
                              ⭐ {p.rating}
                            </div>
                          )}
                        </div>
                        {p.vicinity && (
                          <div className="result-address">
                            📍 {p.vicinity}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  );
}
