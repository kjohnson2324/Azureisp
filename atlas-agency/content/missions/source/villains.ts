// The Magpie Ring (see docs/STORY_BIBLE.md). Every trait belongs to exactly one
// villain so the warrant step always has a single right answer. Spanish traits
// drop the subject, keeping grammatical gender from giving the culprit away.
import type { L } from '../../countries/source/types';

export interface VillainSource {
  name: L;
  icon: string;
  traits: readonly [L, L, L];
}

export const VILLAINS = {
  'velvet-vex': {
    name: ['Velvet Vex', 'Velvet Vex'],
    icon: '🎭',
    traits: [
      ['The thief wore a long purple velvet cape.', 'Llevaba una larga capa de terciopelo morado.'],
      ['The thief hummed opera songs while sneaking around.', 'Tarareaba canciones de ópera mientras andaba a escondidas.'],
      ['The thief left a magpie feather as a calling card.', 'Dejó una pluma de urraca como tarjeta de visita.'],
    ],
  },
  'professor-pocket': {
    name: ['Professor Pocket', 'Profesor Bolsillo'],
    icon: '⌚',
    traits: [
      ['The thief checked a brass pocket watch every five minutes.', 'Miraba un reloj de bolsillo de latón cada cinco minutos.'],
      ['The thief wore a coat with far too many pockets.', 'Llevaba un abrigo con demasiados bolsillos.'],
      ['The thief kept muttering, "Late again, late again!"', 'No dejaba de murmurar: "¡Tarde otra vez, tarde otra vez!"'],
    ],
  },
  'lady-lumen': {
    name: ['Lady Lumen', 'Lady Lumen'],
    icon: '🏮',
    traits: [
      ['The thief carried a glowing lantern, even in daylight.', 'Cargaba una linterna encendida, incluso de día.'],
      ['The thief wore sunglasses at night.', 'Usaba lentes de sol de noche.'],
      ['The thief asked shopkeepers for anything that sparkles.', 'Les pedía a los comerciantes cualquier cosa que brillara.'],
    ],
  },
  'sticky-fitz': {
    name: ['Sticky Fitz', 'Fitz Pegajoso'],
    icon: '🦎',
    traits: [
      ['The thief wore green gloves with sticky gecko pads.', 'Usaba guantes verdes con almohadillas pegajosas de geco.'],
      ['The thief left smudgy handprints high up on the walls.', 'Dejó huellas de manos borrosas muy arriba en las paredes.'],
      ['The thief was spotted enjoying the view from a rooftop.', 'Le vieron disfrutando la vista desde una azotea.'],
    ],
  },
  'dot-dash': {
    name: ['Dot Dash', 'Punto Raya'],
    icon: '🛼',
    traits: [
      ['The thief zoomed away on roller skates.', 'Se fue a toda velocidad en patines.'],
      ['The thief tapped secret messages in dots and dashes.', 'Daba golpecitos con mensajes secretos de puntos y rayas.'],
      ['The thief left skate-wheel tracks in the dust.', 'Dejó huellas de ruedas de patín en el polvo.'],
    ],
  },
} satisfies Record<string, VillainSource>;

export type VillainId = keyof typeof VILLAINS;
export const VILLAIN_IDS = Object.keys(VILLAINS) as VillainId[];
