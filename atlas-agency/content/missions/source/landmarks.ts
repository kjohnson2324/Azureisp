// Landmarks the Magpie Ring can "borrow". One stolen landmark starts each case
// in its home country. Names are the common English and Spanish forms.
import type { L } from '../../countries/source/types';

export interface LandmarkSource {
  id: string;
  name: L;
  country: string;
}

export const LANDMARKS: readonly LandmarkSource[] = [
  { id: 'eiffel-tower', name: ['the Eiffel Tower', 'la Torre Eiffel'], country: 'FR' },
  { id: 'statue-of-liberty', name: ['the Statue of Liberty', 'la Estatua de la Libertad'], country: 'US' },
  { id: 'big-ben', name: ['Big Ben', 'el Big Ben'], country: 'GB' },
  { id: 'colosseum', name: ['the Colosseum', 'el Coliseo'], country: 'IT' },
  { id: 'sagrada-familia', name: ['the Sagrada Família', 'la Sagrada Familia'], country: 'ES' },
  { id: 'parthenon', name: ['the Parthenon', 'el Partenón'], country: 'GR' },
  { id: 'great-pyramid', name: ['the Great Pyramid of Giza', 'la Gran Pirámide de Guiza'], country: 'EG' },
  { id: 'taj-mahal', name: ['the Taj Mahal', 'el Taj Mahal'], country: 'IN' },
  { id: 'great-wall', name: ['a piece of the Great Wall', 'un tramo de la Gran Muralla'], country: 'CN' },
  { id: 'golden-pavilion', name: ['the Golden Pavilion', 'el Pabellón Dorado'], country: 'JP' },
  { id: 'christ-the-redeemer', name: ['Christ the Redeemer', 'el Cristo Redentor'], country: 'BR' },
  { id: 'machu-picchu', name: ['the stones of Machu Picchu', 'las piedras de Machu Picchu'], country: 'PE' },
  { id: 'el-castillo', name: ['El Castillo at Chichén Itzá', 'El Castillo de Chichén Itzá'], country: 'MX' },
  { id: 'moai', name: ['a giant moai statue', 'una estatua moái gigante'], country: 'CL' },
  { id: 'sydney-opera-house', name: ['the Sydney Opera House', 'la Ópera de Sídney'], country: 'AU' },
  { id: 'petra-treasury', name: ['the Treasury at Petra', 'el Tesoro de Petra'], country: 'JO' },
  { id: 'angkor-wat', name: ['Angkor Wat', 'Angkor Wat'], country: 'KH' },
  { id: 'burj-khalifa', name: ['the Burj Khalifa', 'el Burj Khalifa'], country: 'AE' },
  { id: 'petronas-towers', name: ['the Petronas Twin Towers', 'las Torres Gemelas Petronas'], country: 'MY' },
  { id: 'cn-tower', name: ['the CN Tower', 'la Torre CN'], country: 'CA' },
  { id: 'brandenburg-gate', name: ['the Brandenburg Gate', 'la Puerta de Brandeburgo'], country: 'DE' },
  { id: 'little-mermaid', name: ['the Little Mermaid statue', 'la estatua de la Sirenita'], country: 'DK' },
  { id: 'atomium', name: ['the Atomium', 'el Atomium'], country: 'BE' },
  { id: 'st-basils', name: ["St. Basil's Cathedral", 'la Catedral de San Basilio'], country: 'RU' },
  { id: 'hagia-sophia', name: ['the Hagia Sophia', 'Santa Sofía'], country: 'TR' },
  { id: 'stonehenge', name: ['Stonehenge', 'Stonehenge'], country: 'GB' },
  { id: 'djenne-mosque', name: ['the Great Mosque of Djenné', 'la Gran Mezquita de Djenné'], country: 'ML' },
  { id: 'tikal', name: ['a temple of Tikal', 'un templo de Tikal'], country: 'GT' },
  { id: 'shwedagon', name: ['the Shwedagon Pagoda', 'la Pagoda de Shwedagon'], country: 'MM' },
  { id: 'borobudur', name: ['Borobudur', 'Borobudur'], country: 'ID' },
  { id: 'gyeongbokgung', name: ['Gyeongbokgung Palace', 'el Palacio Gyeongbokgung'], country: 'KR' },
  { id: 'kinderdijk', name: ['the windmills of Kinderdijk', 'los molinos de Kinderdijk'], country: 'NL' },
  { id: 'obelisco', name: ['the Obelisk of Buenos Aires', 'el Obelisco de Buenos Aires'], country: 'AR' },
  { id: 'charles-bridge', name: ['the Charles Bridge', 'el Puente de Carlos'], country: 'CZ' },
  { id: 'hallgrimskirkja', name: ['Hallgrímskirkja church', 'la iglesia Hallgrímskirkja'], country: 'IS' },
  { id: 'lalibela', name: ['a rock church of Lalibela', 'una iglesia de roca de Lalibela'], country: 'ET' },
  { id: 'sigiriya', name: ['the Lion Gate of Sigiriya', 'la Puerta del León de Sigiriya'], country: 'LK' },
  { id: 'nan-madol', name: ['the stone walls of Nan Madol', 'los muros de piedra de Nan Madol'], country: 'FM' },
  { id: 'great-zimbabwe', name: ['the walls of Great Zimbabwe', 'los muros del Gran Zimbabue'], country: 'ZW' },
  { id: 'chateau-frontenac', name: ['the Château Frontenac', 'el Château Frontenac'], country: 'CA' },
];
