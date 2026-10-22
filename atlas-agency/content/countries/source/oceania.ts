import type { RegionSource } from './types';

const oceania: RegionSource = {
  AU: {
    capital: "Canberra",
    greeting: ["G'day", "en-AU"],
    languages: ["en"],
    currency: "AUD",
    flag: ["Blue with the Union Jack in the corner, a large seven-pointed star, and the stars of the Southern Cross.", "Azul con la bandera británica en la esquina, una gran estrella de siete puntas y las estrellas de la Cruz del Sur."],
    clues: {
      landmark: ["The thief heard an opera at the Sydney Opera House, with its sail-shaped roofs.", "Escuchó una ópera en la Ópera de Sídney, con sus techos en forma de velas."],
      food: ["The thief ate Vegemite on toast and a meat pie.", "Comió pan tostado con Vegemite y un pastel de carne."],
      animal: ["The thief watched kangaroos hop across the outback.", "Vio canguros saltar por el interior desértico."],
      currency: ["The thief paid with colorful plastic banknotes.", "Pagó con billetes de plástico de colores."],
    },
    facts: [
      ["The Great Barrier Reef is the largest coral reef system in the world.", "La Gran Barrera de Coral es el sistema de arrecifes de coral más grande del mundo."],
      ["Australia is both a country and a continent.", "Australia es a la vez un país y un continente."],
    ],
  },
  FJ: {
    capital: "Suva",
    greeting: ["Bula", "en-AU", ["Hello (in Fijian)", "Hola (en fiyiano)"]],
    languages: ["en", "fj", ["Fiji Hindi", "Hindi de Fiyi"]],
    currency: "FJD",
    flag: ["Light blue with the Union Jack in the corner and a shield with a lion, sugarcane and coconut palm.", "Celeste con la bandera británica en la esquina y un escudo con un león, caña de azúcar y una palmera."],
    clues: {
      landmark: ["The thief swam among the soft corals of the Somosomo Strait.", "Nadó entre los corales blandos del estrecho de Somosomo."],
      food: ["The thief ate kokoda, raw fish marinated in lime and coconut milk.", "Comió kokoda, pescado crudo marinado en limón y leche de coco."],
      animal: ["The thief spotted a crested iguana, a green lizard found only on these islands.", "Vio una iguana crestada, un lagarto verde que solo vive en estas islas."],
      language: ["The thief heard English, iTaukei and Hindi spoken across 300 islands.", "Escuchó inglés, itaukei e hindi en más de 300 islas."],
    },
    facts: [
      ["Fiji is made up of more than 300 islands.", "Fiyi está formado por más de 300 islas."],
      ["Fiji's rugby sevens team has won Olympic gold medals.", "El equipo de rugby a siete de Fiyi ha ganado medallas de oro olímpicas."],
    ],
  },
  KI: {
    capital: "Tarawa",
    greeting: ["Mauri", "en-AU", ["Hello (in Gilbertese)", "Hola (en gilbertés)"]],
    languages: ["en", "gil"],
    currency: "AUD",
    flag: ["Red top with a gold frigatebird over a rising sun, with blue and white waves below.", "Parte superior roja con una fragata dorada sobre un sol naciente, y olas azules y blancas abajo."],
    clues: {
      landmark: ["The thief celebrated New Year first on Kiritimati, one of the first places to greet each new day.", "Celebró el Año Nuevo en Kiritimati, uno de los primeros lugares en recibir cada nuevo día."],
      food: ["The thief ate babai, a giant swamp taro grown in pits.", "Comió babai, un taro gigante que se cultiva en fosas."],
      animal: ["The thief spotted frigatebirds, the same bird shown on the flag.", "Vio fragatas, el mismo pájaro que aparece en la bandera."],
      language: ["The thief heard Gilbertese and English across a chain of coral atolls.", "Escuchó gilbertés e inglés en una cadena de atolones de coral."],
    },
    facts: [
      ["Kiribati spreads across all four hemispheres: north, south, east and west.", "Kiribati se extiende por los cuatro hemisferios: norte, sur, este y oeste."],
      ["Kiribati is among the first places on Earth to see the new year.", "Kiribati es uno de los primeros lugares de la Tierra en recibir el año nuevo."],
    ],
  },
  MH: {
    capital: "Majuro",
    greeting: ["Iakwe", "en-US", ["Hello, love to you (in Marshallese)", "Hola, cariño para ti (en marshalés)"]],
    languages: ["mh", "en"],
    currency: "USD",
    flag: ["Blue with orange and white diagonal stripes and a white star with 24 points.", "Azul con franjas diagonales naranja y blanca y una estrella blanca de 24 puntas."],
    clues: {
      landmark: ["The thief dived to see sunken warships at Bikini Atoll.", "Buceó para ver barcos de guerra hundidos en el atolón Bikini."],
      food: ["The thief ate breadfruit and pandanus fruit.", "Comió fruta del pan y fruta de pandano."],
      animal: ["The thief swam with sharks in what was once the world's largest shark sanctuary.", "Nadó con tiburones en lo que fue el santuario de tiburones más grande del mundo."],
      language: ["The thief learned that the local word 'iakwe' means both hello and love.", "Aprendió que la palabra local 'iakwe' significa hola y también cariño."],
    },
    facts: [
      ["The Marshall Islands is made up of 29 coral atolls.", "Las Islas Marshall están formadas por 29 atolones de coral."],
      ["Navigators here once used stick charts to map ocean waves.", "Aquí los navegantes usaban cartas de palitos para representar las olas del mar."],
    ],
  },
  FM: {
    name: ["Micronesia", "Micronesia"],
    capital: "Palikir",
    greeting: ["Kaselehlie", "en-US", ["Hello (in Pohnpeian)", "Hola (en pohnpeiano)"]],
    languages: ["en", "chk", "pon"],
    currency: "USD",
    flag: ["Light blue with four white stars arranged in a diamond.", "Celeste con cuatro estrellas blancas en forma de rombo."],
    clues: {
      landmark: ["The thief explored Nan Madol, an ancient city built on small islands of stacked stone.", "Exploró Nan Madol, una ciudad antigua construida sobre islotes de piedra apilada."],
      food: ["The thief ate breadfruit and fresh tuna.", "Comió fruta del pan y atún fresco."],
      animal: ["The thief swam with manta rays in the channels of Yap.", "Nadó con mantarrayas en los canales de Yap."],
      currency: ["The thief saw giant round stone money, with holes in the middle, on Yap.", "Vio enormes monedas redondas de piedra, con un agujero en el centro, en Yap."],
    },
    facts: [
      ["The four stars on the flag stand for its four states: Yap, Chuuk, Pohnpei and Kosrae.", "Las cuatro estrellas de la bandera representan sus cuatro estados: Yap, Chuuk, Pohnpei y Kosrae."],
      ["Micronesia is made up of more than 600 islands.", "Micronesia está formada por más de 600 islas."],
    ],
  },
  NR: {
    capital: "Yaren",
    capitalNote: ["Nauru has no official capital; government offices are in the Yaren District.", "Nauru no tiene capital oficial; las oficinas del gobierno están en el distrito de Yaren."],
    capitalCoord: [166.920, -0.547],
    greeting: ["Hello", "en-AU"],
    languages: ["na", "en"],
    currency: "AUD",
    flag: ["Dark blue with a thin yellow line across the middle and a white 12-pointed star.", "Azul oscuro con una línea amarilla fina en el centro y una estrella blanca de 12 puntas."],
    clues: {
      landmark: ["The thief drove the island's main ring road, all the way around in about 30 minutes.", "Recorrió la carretera que rodea la isla, dando toda la vuelta en unos 30 minutos."],
      food: ["The thief ate fresh fish with coconut on an island with very little farmland.", "Comió pescado fresco con coco en una isla con muy poca tierra de cultivo."],
      animal: ["The thief watched islanders keep up the old tradition of catching frigatebirds.", "Vio a los isleños mantener la antigua tradición de atrapar fragatas."],
      currency: ["The thief paid in Australian dollars on a tiny island country in the Pacific.", "Pagó con dólares australianos en un pequeño país insular del Pacífico."],
    },
    facts: [
      ["Nauru is the third-smallest country in the world.", "Nauru es el tercer país más pequeño del mundo."],
      ["Nauru has no official capital city.", "Nauru no tiene una capital oficial."],
    ],
  },
  NZ: {
    capital: "Wellington",
    greeting: ["Kia ora", "en-NZ", ["Hello (in Māori)", "Hola (en maorí)"]],
    languages: ["en", "mi"],
    currency: "NZD",
    flag: ["Blue with the Union Jack and four red stars outlined in white.", "Azul con la bandera británica y cuatro estrellas rojas con borde blanco."],
    clues: {
      landmark: ["The thief toured Hobbiton, a movie set of little round doors in green hills.", "Recorrió Hobbiton, un set de cine con puertitas redondas entre colinas verdes."],
      food: ["The thief ate a hāngī, food cooked in an earth oven.", "Comió un hāngī, comida cocinada en un horno bajo tierra."],
      animal: ["The thief searched at night for the kiwi, a shy flightless bird.", "Buscó de noche al kiwi, un ave tímida que no vuela."],
      language: ["The thief learned to say 'Kia ora' in te reo Māori.", "Aprendió a decir 'Kia ora' en te reo maorí."],
    },
    facts: [
      ["In 1893, New Zealand became the first country where women won the right to vote.", "En 1893, Nueva Zelanda fue el primer país donde las mujeres ganaron el derecho al voto."],
      ["There are more sheep than people in New Zealand.", "En Nueva Zelanda hay más ovejas que personas."],
    ],
  },
  PW: {
    capital: "Ngerulmud",
    capitalCoord: [134.627, 7.487], // Natural Earth labels this point "Melekeok", the state that contains Ngerulmud
    greeting: ["Alii", "en-US", ["Hello (in Palauan)", "Hola (en palauano)"]],
    languages: ["pau", "en"],
    currency: "USD",
    flag: ["Light blue with a yellow circle set a little to the left.", "Celeste con un círculo amarillo un poco hacia la izquierda."],
    clues: {
      landmark: ["The thief kayaked around the Rock Islands, shaped like green mushrooms.", "Remó en kayak alrededor de las Islas Rocosas, con forma de hongos verdes."],
      food: ["The thief ate taro and fresh reef fish.", "Comió taro y pescado fresco de arrecife."],
      animal: ["The thief swam in Jellyfish Lake with millions of golden jellyfish.", "Nadó en el Lago de las Medusas con millones de medusas doradas."],
      currency: ["The thief paid in U.S. dollars on islands that created the world's first shark sanctuary.", "Pagó con dólares estadounidenses en islas que crearon el primer santuario de tiburones del mundo."],
    },
    facts: [
      ["Palau created the world's first shark sanctuary in 2009.", "Palaos creó el primer santuario de tiburones del mundo en 2009."],
      ["Visitors to Palau sign a pledge to protect its nature.", "Quienes visitan Palaos firman una promesa de proteger su naturaleza."],
    ],
  },
  PG: {
    capital: "Port Moresby",
    greeting: ["Gude", "en-AU", ["Hello (in Tok Pisin)", "Hola (en tok pisin)"]],
    languages: ["tpi", "ho", "en"],
    currency: "PGK",
    flag: ["Split diagonally: red with a gold bird of paradise, and black with the white Southern Cross.", "Dividida en diagonal: roja con un ave del paraíso dorada, y negra con la Cruz del Sur blanca."],
    clues: {
      landmark: ["The thief hiked the Kokoda Track through steep jungle mountains.", "Recorrió el sendero de Kokoda por empinadas montañas selváticas."],
      food: ["The thief ate mumu, food cooked in an earth oven with hot stones.", "Comió mumu, comida cocinada en un horno de tierra con piedras calientes."],
      animal: ["The thief watched birds of paradise dance to show off their feathers.", "Vio aves del paraíso bailar para lucir sus plumas."],
      language: ["The thief heard Tok Pisin and some of the more than 800 languages spoken here.", "Escuchó tok pisin y algunos de los más de 800 idiomas que se hablan aquí."],
    },
    facts: [
      ["More languages are spoken in Papua New Guinea than in any other country.", "En Papúa Nueva Guinea se hablan más idiomas que en cualquier otro país."],
      ["Papua New Guinea shares the island of New Guinea with Indonesia.", "Papúa Nueva Guinea comparte la isla de Nueva Guinea con Indonesia."],
    ],
  },
  WS: {
    capital: "Apia",
    greeting: ["Talofa", "en-NZ", ["Hello (in Samoan)", "Hola (en samoano)"]],
    languages: ["sm", "en"],
    currency: "WST",
    flag: ["Red with a blue rectangle holding five white stars of the Southern Cross.", "Roja con un rectángulo azul que tiene cinco estrellas blancas de la Cruz del Sur."],
    clues: {
      landmark: ["The thief climbed down a ladder into To Sua Ocean Trench, a giant swimming hole.", "Bajó por una escalera a la fosa oceánica To Sua, una enorme poza natural."],
      food: ["The thief ate palusami, taro leaves baked with coconut cream.", "Comió palusami, hojas de taro horneadas con crema de coco."],
      animal: ["The thief searched for the manumea, a rare pigeon with a toothed beak.", "Buscó el manumea, una paloma rara con el pico dentado."],
      currency: ["The thief paid in tālā.", "Pagó en talas."],
    },
    facts: [
      ["In 2011, Samoa skipped a whole day to move across the International Date Line.", "En 2011, Samoa se saltó un día entero para pasar al otro lado de la línea internacional de cambio de fecha."],
      ["In 1962, Samoa became the first Pacific island nation to gain independence.", "En 1962, Samoa fue el primer país insular del Pacífico en independizarse."],
    ],
  },
  SB: {
    name: ["Solomon Islands", "Islas Salomón"],
    capital: "Honiara",
    greeting: ["Halo", "en-AU", ["Hello (in Pijin)", "Hola (en pijin)"]],
    languages: ["en", ["Pijin", "Pijin"]],
    currency: "SBD",
    flag: ["A thin yellow diagonal stripe between blue and green, with five white stars.", "Una franja diagonal amarilla y fina entre azul y verde, con cinco estrellas blancas."],
    clues: {
      landmark: ["The thief dived to see World War II shipwrecks in Iron Bottom Sound.", "Buceó para ver barcos hundidos de la Segunda Guerra Mundial en el estrecho de Iron Bottom."],
      food: ["The thief ate cassava pudding made with coconut milk.", "Comió pudín de yuca hecho con leche de coco."],
      animal: ["The thief spotted a prehensile-tailed skink, a big lizard that climbs trees with its tail.", "Vio un eslizón de cola prensil, un lagarto grande que trepa árboles con la cola."],
      language: ["The thief heard Pijin, a Creole language, plus about 70 local languages.", "Escuchó pijin, una lengua criolla, además de unos 70 idiomas locales."],
    },
    facts: [
      ["The Solomon Islands is made up of nearly 1,000 islands.", "Las Islas Salomón están formadas por casi 1.000 islas."],
      ["Shell money is still used in some traditional ceremonies here.", "Aquí todavía se usa dinero de conchas en algunas ceremonias tradicionales."],
    ],
  },
  TO: {
    capital: ["Nukuʻalofa", "Nukualofa"],
    greeting: ["Mālō e lelei", "en-NZ", ["Hello (in Tongan)", "Hola (en tongano)"]],
    languages: ["to", "en"],
    currency: "TOP",
    flag: ["Red with a white rectangle holding a red cross.", "Roja con un rectángulo blanco que tiene una cruz roja."],
    clues: {
      landmark: ["The thief watched seawater shoot up from the Mapu'a 'a Vaea blowholes.", "Vio el agua del mar salir disparada por los bufaderos de Mapu'a 'a Vaea."],
      food: ["The thief ate 'ota 'ika, raw fish in coconut milk.", "Comió 'ota 'ika, pescado crudo en leche de coco."],
      animal: ["The thief swam with humpback whales that come here to have their calves.", "Nadó con ballenas jorobadas que vienen aquí a tener sus crías."],
      language: ["The thief heard a Polynesian language in the last kingdom of the Pacific.", "Escuchó un idioma polinesio en el último reino del Pacífico."],
    },
    facts: [
      ["Tonga is the only Pacific island nation that was never colonized.", "Tonga es el único país insular del Pacífico que nunca fue colonizado."],
      ["Tonga is the last Polynesian kingdom.", "Tonga es el último reino polinesio."],
    ],
  },
  TV: {
    capital: "Funafuti",
    greeting: ["Talofa", "en-NZ", ["Hello (in Tuvaluan)", "Hola (en tuvaluano)"]],
    languages: ["tvl", "en"],
    currency: "AUD",
    flag: ["Light blue with the Union Jack and nine yellow stars placed like a map of the islands.", "Celeste con la bandera británica y nueve estrellas amarillas colocadas como un mapa de las islas."],
    clues: {
      landmark: ["The thief played soccer on the airport runway, which doubles as a playground when no planes land.", "Jugó fútbol en la pista del aeropuerto, que sirve de patio de juegos cuando no aterrizan aviones."],
      food: ["The thief ate pulaka, a giant swamp taro.", "Comió pulaka, un taro gigante de pantano."],
      animal: ["The thief swam with green sea turtles in a marine conservation area.", "Nadó con tortugas verdes en una zona de conservación marina."],
      currency: ["The thief paid in Australian dollars and saw some special local coins.", "Pagó con dólares australianos y vio unas monedas locales especiales."],
    },
    facts: [
      ["Tuvalu earns money from its internet domain name, .tv.", "Tuvalu gana dinero con su dominio de internet, .tv."],
      ["Tuvalu's highest point is only about 4.6 meters above sea level.", "El punto más alto de Tuvalu está a solo unos 4,6 metros sobre el nivel del mar."],
    ],
  },
  VU: {
    capital: "Port Vila",
    greeting: ["Halo", "en-AU", ["Hello (in Bislama)", "Hola (en bislama)"]],
    languages: ["bi", "en", "fr"],
    currency: "VUV",
    flag: ["Red and green halves split by a black triangle with a yellow Y shape and a curled boar's tusk.", "Mitades roja y verde separadas por un triángulo negro con una Y amarilla y un colmillo de jabalí curvo."],
    clues: {
      landmark: ["The thief peered into the glowing lava of Mount Yasur, an active volcano.", "Se asomó a la lava brillante del monte Yasur, un volcán activo."],
      food: ["The thief ate lap lap, grated root vegetables baked in banana leaves.", "Comió lap lap, tubérculos rallados horneados en hojas de plátano."],
      animal: ["The thief spotted dugongs grazing on seagrass.", "Vio dugongos comiendo pastos marinos."],
      language: ["The thief heard Bislama, English and French, plus more than 100 local languages.", "Escuchó bislama, inglés y francés, además de más de 100 idiomas locales."],
    },
    facts: [
      ["Vanuatu has more languages per person than any other country.", "Vanuatu tiene más idiomas por habitante que cualquier otro país."],
      ["Land diving on Pentecost Island inspired the idea of bungee jumping.", "Los saltos desde torres de la isla de Pentecostés inspiraron el puenting."],
    ],
  },
};

export default oceania;
