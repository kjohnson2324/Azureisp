import { Camera, GeoJSONSource, Layer, Map, type CameraRef, type MapRef } from '@maplibre/maplibre-react-native';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';

import countriesGeo from '../../../assets/map/countries.geo.json';
import labelsGeo from '../../../assets/map/labels.geo.json';
import placesGeo from '../../../assets/map/places.geo.json';
import { continentById, type ContinentId } from './continents';
import { layersForTap, resolveTap, type TapResult } from './model';
import { buildMapStyle, selectionLayer, TIER, WORLD_BOUNDS, WORLD_VIEW } from './style';

export interface WorldMapHandle {
  flyToContinent: (id: ContinentId) => void;
  flyTo: (center: [number, number], zoom: number) => void;
  showWorld: () => void;
}

interface Props {
  locale: 'en' | 'es';
  glyphsBase: string;
  dark: boolean;
  highContrast: boolean;
  textScale: number;
  reduceMotion: boolean;
  selectedIso2?: string;
  accessibilityLabel: string;
  onTap: (result: TapResult) => void;
}

export const WorldMap = forwardRef<WorldMapHandle, Props>(function WorldMap(props, ref) {
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const zoom = useRef(0);
  const duration = props.reduceMotion ? 0 : 900;

  const mapStyle = useMemo(
    () => buildMapStyle({
      locale: props.locale,
      glyphsBase: props.glyphsBase,
      countries: countriesGeo as GeoJSON.FeatureCollection,
      places: placesGeo as GeoJSON.FeatureCollection,
      countryLabels: labelsGeo as GeoJSON.FeatureCollection,
      dark: props.dark,
      highContrast: props.highContrast,
      textScale: props.textScale,
    }),
    [props.locale, props.glyphsBase, props.dark, props.highContrast, props.textScale],
  );

  const selection = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: (countriesGeo as GeoJSON.FeatureCollection).features.filter(
      (f) => props.selectedIso2 && f.properties?.playable === 1 && f.properties?.iso2 === props.selectedIso2,
    ),
  }), [props.selectedIso2]);

  useImperativeHandle(ref, () => ({
    flyToContinent: (id) => {
      const c = continentById(id);
      if (c) cameraRef.current?.fitBounds(c.bounds, { padding: { top: 40, right: 24, bottom: 40, left: 24 }, duration });
    },
    flyTo: (center, z) => cameraRef.current?.flyTo({ center, zoom: z, duration }),
    showWorld: () => cameraRef.current?.fitBounds(WORLD_VIEW, { duration }),
  }), [duration]);

  return (
    <Map
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      mapStyle={mapStyle}
      attribution
      logo={false}
      compass={false}
      touchRotate={false}
      touchPitch={false}
      accessible
      accessibilityLabel={props.accessibilityLabel}
      onRegionDidChange={(e) => { zoom.current = e.nativeEvent.zoom; }}
      onPress={async (e) => {
        const features = await mapRef.current?.queryRenderedFeatures(e.nativeEvent.point, { layers: layersForTap(zoom.current) });
        props.onTap(resolveTap(features ?? [], zoom.current));
      }}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{ bounds: WORLD_VIEW }}
        maxBounds={WORLD_BOUNDS}
        minZoom={0}
        maxZoom={TIER.cities + 2.5}
      />
      <GeoJSONSource id="selection" data={selection}>
        <Layer {...selectionLayer(props.dark)} />
      </GeoJSONSource>
    </Map>
  );
});
