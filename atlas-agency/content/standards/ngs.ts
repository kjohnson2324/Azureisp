// National Geography Standards (Geography for Life, 2nd ed., 2012): the 18 standards.
// TEKS rows are added once mapped from the official TEKS (see docs/DECISIONS.md, D5).

export const NGS_STANDARDS = [
  { id: 'NGS.1', code: '1', en: 'How to use maps and other geographic representations, geospatial technologies, and spatial thinking to understand and communicate information', es: 'Cómo usar mapas y otras representaciones geográficas, tecnologías geoespaciales y el pensamiento espacial para comprender y comunicar información' },
  { id: 'NGS.2', code: '2', en: 'How to use mental maps to organize information about people, places, and environments in a spatial context', es: 'Cómo usar mapas mentales para organizar información sobre personas, lugares y entornos en un contexto espacial' },
  { id: 'NGS.3', code: '3', en: "How to analyze the spatial organization of people, places, and environments on Earth's surface", es: 'Cómo analizar la organización espacial de personas, lugares y entornos en la superficie de la Tierra' },
  { id: 'NGS.4', code: '4', en: 'The physical and human characteristics of places', es: 'Las características físicas y humanas de los lugares' },
  { id: 'NGS.5', code: '5', en: "That people create regions to interpret Earth's complexity", es: 'Que las personas crean regiones para interpretar la complejidad de la Tierra' },
  { id: 'NGS.6', code: '6', en: "How culture and experience influence people's perceptions of places and regions", es: 'Cómo la cultura y la experiencia influyen en la percepción que las personas tienen de lugares y regiones' },
  { id: 'NGS.7', code: '7', en: "The physical processes that shape the patterns of Earth's surface", es: 'Los procesos físicos que dan forma a los patrones de la superficie de la Tierra' },
  { id: 'NGS.8', code: '8', en: "The characteristics and spatial distribution of ecosystems and biomes on Earth's surface", es: 'Las características y la distribución espacial de los ecosistemas y biomas en la superficie de la Tierra' },
  { id: 'NGS.9', code: '9', en: "The characteristics, distribution, and migration of human populations on Earth's surface", es: 'Las características, la distribución y la migración de las poblaciones humanas en la superficie de la Tierra' },
  { id: 'NGS.10', code: '10', en: "The characteristics, distribution, and complexity of Earth's cultural mosaics", es: 'Las características, la distribución y la complejidad de los mosaicos culturales de la Tierra' },
  { id: 'NGS.11', code: '11', en: "The patterns and networks of economic interdependence on Earth's surface", es: 'Los patrones y las redes de interdependencia económica en la superficie de la Tierra' },
  { id: 'NGS.12', code: '12', en: 'The processes, patterns, and functions of human settlement', es: 'Los procesos, patrones y funciones de los asentamientos humanos' },
  { id: 'NGS.13', code: '13', en: "How the forces of cooperation and conflict among people influence the division and control of Earth's surface", es: 'Cómo la cooperación y el conflicto entre las personas influyen en la división y el control de la superficie de la Tierra' },
  { id: 'NGS.14', code: '14', en: 'How human actions modify the physical environment', es: 'Cómo las acciones humanas modifican el medio físico' },
  { id: 'NGS.15', code: '15', en: 'How physical systems affect human systems', es: 'Cómo los sistemas físicos afectan a los sistemas humanos' },
  { id: 'NGS.16', code: '16', en: 'The changes that occur in the meaning, use, distribution, and importance of resources', es: 'Los cambios en el significado, el uso, la distribución y la importancia de los recursos' },
  { id: 'NGS.17', code: '17', en: 'How to apply geography to interpret the past', es: 'Cómo aplicar la geografía para interpretar el pasado' },
  { id: 'NGS.18', code: '18', en: 'How to apply geography to interpret the present and plan for the future', es: 'Cómo aplicar la geografía para interpretar el presente y planificar el futuro' },
] as const;

/** Which standards each clue skill exercises. */
export const SKILL_STANDARDS: Record<'flag' | 'landmark' | 'language' | 'currency' | 'food' | 'animal', string[]> = {
  flag: ['NGS.10', 'NGS.13'],      // national symbols; political division of Earth's surface
  landmark: ['NGS.4', 'NGS.17'],   // physical/human characteristics of places; geography of the past
  language: ['NGS.10'],            // cultural mosaics
  currency: ['NGS.11'],            // economic interdependence
  food: ['NGS.10', 'NGS.16'],      // culture; resources
  animal: ['NGS.8'],               // ecosystems and biomes
};
