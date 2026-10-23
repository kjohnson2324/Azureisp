// Native modules that have no JS implementation under Jest.
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

// The map is native-only; tests drive taps through the `onPress` prop instead.
jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = require('react-native');
  const queried: { features: object[] } = { features: [] };
  return {
    __setQueriedFeatures: (f: object[]) => { queried.features = f; },
    Map: ({ children, ref, ...props }: { children?: unknown; ref?: { current: unknown } }) => {
      if (ref) ref.current = { queryRenderedFeatures: async () => queried.features };
      return <View testID="world-map" {...props}>{children as never}</View>;
    },
    Camera: ({ ref }: { ref?: { current: unknown } }) => {
      if (ref) ref.current = { fitBounds: jest.fn(), flyTo: jest.fn() };
      return null;
    },
    GeoJSONSource: ({ children }: { children?: unknown }) => children ?? null,
    Layer: () => null,
  };
});

jest.mock('expo-router', () => {
  const push = jest.fn();
  return { useRouter: () => ({ push, back: jest.fn() }), Redirect: () => null, Stack: () => null };
});

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` };
});
