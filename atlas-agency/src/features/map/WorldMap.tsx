import { Camera, GeoJSONSource, Layer, Map, type CameraRef, type MapRef } from '@maplibre/maplibre-react-native';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';

import countriesGeo from '../../../assets/map/countries.geo.json';
import labelsGeo from '../../../assets/map/labels.geo.json';
import placesGeo from '../../../assets/map/places.geo.json';
import { continentById, type ContinentId } from './continents';
import type { LngLat } from './distance';
import { layersForTap, resolveTap, type TapResult } from './model';
import { buildMapStyle, LAYER, measureLayers, selectionLayer, TIER, WORLD_BOUNDS, WORLD_VIEW } from './style';

export interface WorldMapHandle {
  flyToContinent: (id: ContinentId) => void;
  flyTo: (center: [number, number], zoom: number) => void;
  fitBounds: (bounds: [number, number, number, number]) => void;
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
  /** When set, presses go here (measure mode) instead of onTap. */
  onMeasureTap?: (features: GeoJSON.Feature[], lngLat: LngLat) => void;
  measure?: { points: GeoJSON.FeatureCollection; line: GeoJSON.FeatureCollection };
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

  const measureLines = useMemo(() => measureLayers(props.dark, props.textScale), [props.dark, props.textScale]);

  useImperativeHandle(ref, () => ({
    flyToContinent: (id) => {
      const c = continentById(id);
      if (c) cameraRef.current?.fitBounds(c.bounds, { padding: { top: 40, right: 24, bottom: 40, left: 24 }, duration });
    },
    flyTo: (center, z) => cameraRef.current?.flyTo({ center, zoom: z, duration }),
    fitBounds: (b) => cameraRef.current?.fitBounds(b, { padding: { top: 80, right: 48, bottom: 360, left: 48 }, duration }),
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
        if (props.onMeasureTap) {
          const layers = zoom.current >= TIER.cities ? [LAYER.capitals, LAYER.cities, LAYER.fill] : zoom.current >= TIER.capitals ? [LAYER.capitals, LAYER.fill] : [LAYER.fill];
          const features = await mapRef.current?.queryRenderedFeatures(e.nativeEvent.point, { layers });
          props.onMeasureTap(features ?? [], e.nativeEvent.lngLat);
          return;
        }
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
      {props.measure ? (
        <>
          <GeoJSONSource id="measure-line" data={props.measure.line}>
            <Layer {...measureLines.casing} />
            <Layer {...measureLines.line} />
          </GeoJSONSource>
          <GeoJSONSource id="measure-points" data={props.measure.points}>
            <Layer {...measureLines.points} />
            <Layer {...measureLines.labels} />
          </GeoJSONSource>
        </>
      ) : null}
    </Map>
  );
});
