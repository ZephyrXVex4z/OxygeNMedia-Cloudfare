// data.js
// Configuración del juego + base de datos local (semilla ampliable).
// Este es el ÚNICO archivo que hay que tocar para cambiar de juego o añadir contenido:
// DLCs, categorías y artículos viven aquí. Nada de HTML dentro.

export const GAME = {
  id: "skyrim",
  name: "Skyrim",
  title: "The Elder Scrolls V: Skyrim",
  base: "/Wiki/Skyrim",               // ruta pública de esta wiki
  home: "https://oxygenmedia.online/", // destino de "Volver a OxygeNMedia"
  storagePrefix: "oxy_skyrim_",
  dataVersion: 1,                      // súbelo si cambias la estructura de data.js (invalida cache)
  remote: {
    name: "UESP — Unofficial Elder Scrolls Pages",
    endpoint: "https://en.uesp.net/w/api.php",
    pageBase: "https://en.uesp.net/wiki/",
    namespace: "Skyrim:",
    license: "CC BY-SA 2.5",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.5/"
  }
};

// ============ DLCs ============
export const DLCS = [
  {
    id: "skyrim", name: "Skyrim", badge: "Base", year: "2011", emoji: "🏔️", color: "#8fa1c4",
    tagline: "El juego base",
    description: "El contenido original de The Elder Scrolls V: Skyrim: las nueve regiones de Skyrim, la historia del Sangre de Dragón contra Alduin, la guerra civil y todas las facciones principales.",
    mechanics: ["Gritos de dragón y almas de dragón", "Guerra civil: Legión o Capas de la Tormenta", "Gremios y facciones", "Hombre lobo (Compañeros)"],
    uesp: "Skyrim"
  },
  {
    id: "dawnguard", name: "Dawnguard", badge: "DLC", year: "2012", emoji: "🧛", color: "#c2483d",
    tagline: "Cazadores de vampiros contra el clan Volkihar",
    description: "Elige entre unirte a la Dawnguard o al clan vampírico Volkihar. Añade el Soul Cairn, la Forma de Señor Vampiro, las ballestas, el equipo de hueso de dragón y nuevos gritos.",
    mechanics: ["Forma de Señor Vampiro y su árbol de ventajas", "Ballestas y virotes", "Forja de equipo Dragonbone", "Montura espectral: Arvak"],
    uesp: "Dawnguard"
  },
  {
    id: "hearthfire", name: "Hearthfire", badge: "DLC", year: "2012", emoji: "🏡", color: "#d68a3c",
    tagline: "Construye tu propia casa",
    description: "Permite comprar terrenos y construir casas a medida en tres lugares de Skyrim, adoptar niños, contratar mayordomos y mantener cultivos y animales.",
    mechanics: ["Construcción de casas por módulos", "Adopción de niños", "Mayordomos y Housecarls", "Cultivo y cría de animales"],
    uesp: "Hearthfire"
  },
  {
    id: "dragonborn", name: "Dragonborn", badge: "DLC", year: "2012", emoji: "🐉", color: "#5aa6c9",
    tagline: "Solstheim y el primer Sangre de Dragón",
    description: "Viaja a la isla de Solstheim y enfréntate a Miraak, el primer Sangre de Dragón. Añade Apocrypha, los Libros Negros, el equipo de Stalhrim y tres gritos nuevos, entre ellos la posibilidad de montar dragones.",
    mechanics: ["Libros Negros y Apocrypha", "Montar dragones con Bend Will", "Equipo de Stalhrim, Bonemold y Chitin", "Nuevas criaturas de Solstheim"],
    uesp: "Dragonborn"
  },
  {
    id: "anniversary", name: "Anniversary Edition / Creation Club", badge: "CC", year: "2016–2021", emoji: "🎖️", color: "#a98bdc",
    tagline: "Contenido de Creation Club",
    description: "Contenido oficial de Creation Club incluido en Skyrim Anniversary Edition. La base local incluye solo algunos ejemplos; amplía este DLC en data.js.",
    mechanics: ["Modo Supervivencia", "Pesca", "Saints & Seducers"],
    uesp: "Creation Club"
  }
];

// ============ CATEGORÍAS ============
export const CATEGORIES = [
  { id: "weapons", icon: "⚔️", name: "Armas", description: "Espadas, arcos, ballestas y otras armas, del hierro al Stalhrim." },
  { id: "armor", icon: "🛡️", name: "Armaduras", description: "Conjuntos de armadura ligera y pesada, y su origen." },
  { id: "alchemy", icon: "🧪", name: "Alquimia", description: "Ingredientes y pociones." },
  { id: "spells", icon: "✨", name: "Hechizos", description: "Magia de las seis escuelas y poderes especiales." },
  { id: "shouts", icon: "🗣️", name: "Gritos", description: "Gritos de dragón, sus palabras de poder, efectos y cómo desbloquearlos." },
  { id: "dragons", icon: "🐉", name: "Dragones", description: "Dragones con nombre y sus datos." },
  { id: "creatures", icon: "👹", name: "Criaturas", description: "Bestias, no muertos, daedra y otros enemigos." },
  { id: "npcs", icon: "🧙", name: "NPCs", description: "Personajes notables de Skyrim y sus expansiones." },
  { id: "places", icon: "📍", name: "Lugares", description: "Ciudades, ruinas, reinos de Oblivion y regiones." },
  { id: "quests", icon: "📜", name: "Misiones", description: "Misiones principales y de expansión." },
  { id: "factions", icon: "🏛️", name: "Facciones", description: "Gremios, clanes y bandos." },
  { id: "companions", icon: "🐺", name: "Compañeros", description: "Seguidores que te acompañan en tus aventuras." },
  { id: "pets", icon: "🐾", name: "Mascotas", description: "Animales que pueden acompañarte." },
  { id: "mounts", icon: "🐴", name: "Monturas", description: "Caballos y otras monturas." },
  { id: "items", icon: "💎", name: "Objetos", description: "Materiales, gemas y objetos diversos." },
  { id: "artifacts", icon: "🔮", name: "Artefactos", description: "Artefactos daédricos y reliquias únicas." },
  { id: "skills", icon: "🌳", name: "Habilidades", description: "Las 18 habilidades y sus árboles." },
  { id: "perks", icon: "🎯", name: "Ventajas", description: "Ventajas (perks) que mejoran tus habilidades." },
  { id: "vampirism", icon: "🧛", name: "Vampirismo", description: "Vampirismo, Señor Vampiro y sus mecánicas." },
  { id: "lycanthropy", icon: "🐺", name: "Licantropía", description: "Hombre lobo y la Forma de Bestia." },
  { id: "books", icon: "📚", name: "Libros", description: "Libros, Libros Negros y tomos de habilidad." },
  { id: "keys", icon: "🗝️", name: "Llaves", description: "Llaves especiales y herramientas de ladrón." },
  { id: "economy", icon: "💰", name: "Economía", description: "Oro, comercio y mecánicas de dinero." },
  { id: "houses", icon: "🏠", name: "Casas", description: "Propiedades y terrenos para construir." },
  { id: "misc", icon: "🧭", name: "Otros", description: "Mecánicas y contenido que no encaja en otra categoría." }
];

// ============ ARTÍCULOS ============
// Campos comunes: id, name, type, category (id), dlc (id), description, image?, location?,
// effects?, requirements?, related?[], quests?[], aliases?[], tags?[], uesp?
// Los campos específicos (words, cooldown, dragonSoulCost...) solo existen donde hacen falta.
// `location` nulo o ausente = dato aún no registrado; la interfaz lo indica y enlaza a la fuente.

const shout = (id, name, dlc, words, effect, description, extra = {}) => ({
  id, name, type: "shout", category: "shouts", dlc,
  words: words.map(([word, translation, location]) => ({ word, translation, location: location || null, description: "" })),
  effect, description,
  cooldown: null,
  dragonSoulCost: "1 alma de dragón por palabra (3 en total)",
  uesp: name,
  ...extra
});

const RAW_ITEMS = [
  // ---------- GRITOS: juego base ----------
  shout("unrelenting-force", "Unrelenting Force", "skyrim", [["Fus", "Fuerza", "Bleak Falls Barrow (misión «Dragon Rising»)"], ["Ro", "Equilibrio"], ["Dah", "Empujar"]],
    "Lanza una onda que empuja y derriba a los objetivos; con la tercera palabra, los envía lejos.",
    "El grito insignia del Sangre de Dragón, conocido como «Fus Ro Dah».",
    { aliases: ["fus ro dah"], related: ["dragon-rising", "bleak-falls-barrow", "the-way-of-the-voice"], quests: ["dragon-rising"] }),
  shout("fire-breath", "Fire Breath", "skyrim", [["Yol", "Fuego"], ["Toor", "Infierno"], ["Shul", "Sol"]],
    "Exhala un cono de fuego que daña a todo lo que alcanza.", "Grito ofensivo de fuego."),
  shout("frost-breath", "Frost Breath", "skyrim", [["Fo", "Escarcha"], ["Krah", "Frío"], ["Diin", "Congelar"]],
    "Exhala aire helado que daña la salud y el aguante del objetivo.", "Grito ofensivo de hielo."),
  shout("whirlwind-sprint", "Whirlwind Sprint", "skyrim", [["Wuld", "Torbellino"], ["Nah", "Furia"], ["Kest", "Tempestad"]],
    "Te impulsa en una carrera instantánea hacia delante.", "Grito de movilidad."),
  shout("aura-whisper", "Aura Whisper", "skyrim", [["Laas", "Vida"], ["Yah", "Buscar"], ["Nir", "Cazar"]],
    "Revela la ubicación de los seres vivos cercanos, incluso tras paredes.", "Grito de detección."),
  shout("animal-allegiance", "Animal Allegiance", "skyrim", [["Raan", "Animal"], ["Mir", "Lealtad"], ["Tah", "Manada"]],
    "Los animales cercanos luchan de tu lado.", "Grito de control de bestias."),
  shout("battle-fury", "Battle Fury", "skyrim", [["Mid", "Leal"], ["Vur", "Valor"], ["Shaan", "Inspirar"]],
    "Tus aliados cercanos atacan más rápido.", "Grito de apoyo para compañeros."),
  shout("become-ethereal", "Become Ethereal", "skyrim", [["Feim", "Desvanecer"], ["Zii", "Espíritu"], ["Gron", "Atar"]],
    "Te vuelves etéreo: no recibes ni causas daño durante unos segundos.", "Grito defensivo."),
  shout("call-dragon", "Call Dragon", "skyrim", [["Od", "Nieve"], ["Ah", "Cazador"], ["Viing", "Ala"]],
    "Llama al dragón Odahviing para que combata a tu lado.", "Grito de invocación de dragón.",
    { related: ["odahviing"] }),
  shout("call-of-valor", "Call of Valor", "skyrim", [["Hun", "Héroe"], ["Kaal", "Campeón"], ["Zoor", "Leyenda"]],
    "Invoca a un héroe de Sovngarde para que luche contigo.", "Grito que conecta con Sovngarde.",
    { related: ["sovngarde"] }),
  shout("clear-skies", "Clear Skies", "skyrim", [["Lok", "Cielo"], ["Vah", "Primavera"], ["Koor", "Verano"]],
    "Despeja el clima: elimina niebla, lluvia y nieve.", "Grito de clima."),
  shout("disarm", "Disarm", "skyrim", [["Zun", "Arma"], ["Haal", "Mano"], ["Viik", "Derrota"]],
    "Arranca el arma de las manos del objetivo.", "Grito de control."),
  shout("dismay", "Dismay", "skyrim", [["Faas", "Miedo"], ["Ru", "Huir"], ["Maar", "Terror"]],
    "Hace huir a enemigos de nivel bajo o medio.", "Grito de intimidación."),
  shout("dragonrend", "Dragonrend", "skyrim", [["Joor", "Mortal"], ["Zah", "Finito"], ["Frul", "Temporal"]],
    "Obliga a un dragón a aterrizar y lo deja vulnerable al combate cuerpo a cuerpo.", "Grito clave para enfrentar a Alduin.",
    { related: ["alduin", "paarthurnax"] }),
  shout("elemental-fury", "Elemental Fury", "skyrim", [["Su", "Aire"], ["Grah", "Batalla"], ["Dun", "Furia"]],
    "Aumenta la velocidad de tus ataques cuerpo a cuerpo.", "Grito de potenciación."),
  shout("ice-form", "Ice Form", "skyrim", [["Iiz", "Hielo"], ["Slen", "Carne"], ["Nus", "Estatua"]],
    "Congela al objetivo en un bloque de hielo.", "Grito de control."),
  shout("kynes-peace", "Kyne's Peace", "skyrim", [["Kaan", "Kyne"], ["Drem", "Paz"], ["Ov", "Confianza"]],
    "Calma a los animales salvajes para que no te ataquen.", "Grito de pacificación."),
  shout("marked-for-death", "Marked for Death", "skyrim", [["Krii", "Matar"], ["Lun", "Sanguijuela"], ["Aus", "Sufrir"]],
    "Marca al objetivo: reduce su armadura y le drena salud.", "Grito de debilitación."),
  shout("slow-time", "Slow Time", "skyrim", [["Tiid", "Tiempo"], ["Klo", "Arena"], ["Ul", "Eternidad"]],
    "Ralentiza el tiempo a tu alrededor mientras tú sigues a velocidad normal.", "Grito de tiempo."),
  shout("storm-call", "Storm Call", "skyrim", [["Strun", "Tormenta"], ["Bah", "Ira"], ["Qo", "Relámpago"]],
    "Invoca una tormenta con rayos que golpean a los enemigos.", "Grito de tormenta."),
  shout("throw-voice", "Throw Voice", "skyrim", [["Zul", "Voz"], ["Mey", "Necio"], ["Gut", "Más allá"]],
    "Proyecta tu voz a otro lugar para distraer a los enemigos.", "Grito de sigilo."),

  // ---------- GRITOS: Dawnguard ----------
  shout("drain-vitality", "Drain Vitality", "dawnguard", [["Gaan", "Aguante"], ["Lah", "Magia"], ["Haas", "Salud"]],
    "Drena salud, aguante y magia del objetivo.", "Grito de drenaje introducido en Dawnguard.",
    { related: ["dawnguard-dlc", "soul-cairn", "serana"] }),
  shout("soul-tear", "Soul Tear", "dawnguard", [["Rii", "Esencia"], ["Vaaz", "Desgarrar"], ["Zol", "Zombi"]],
    "Desgarra el alma del objetivo: mata a los de nivel bajo y los devuelve temporalmente como aliados.", "Grito de nigromancia ligado al Soul Cairn.",
    { related: ["soul-cairn", "durnehviir"] }),
  shout("summon-durnehviir", "Summon Durnehviir", "dawnguard", [["Dur", "Maldición"], ["Neh", "Nunca"], ["Viir", "Morir"]],
    "Convoca al dragón no muerto Durnehviir para que luche a tu lado.", "Grito de invocación aprendido en el Soul Cairn.",
    { related: ["durnehviir", "soul-cairn"] }),

  // ---------- GRITOS: Dragonborn ----------
  shout("bend-will", "Bend Will", "dragonborn", [["Gol", "Tierra"], ["Hah", "Mente"], ["Dov", "Dragón"]],
    "Domina la mente del objetivo; con la tercera palabra controla incluso a un dragón para montarlo.", "Grito de dominio mental ligado a Miraak y a los Libros Negros.",
    { related: ["dragonborn-dlc", "solstheim", "miraak", "apocrypha", "black-books"], quests: ["the-path-of-knowledge"] }),
  shout("cyclone", "Cyclone", "dragonborn", [["Ven", "Viento"], ["Gaar", "Ciclón"], ["Nos", "Golpe"]],
    "Crea un ciclón que lanza por los aires y daña a los enemigos.", "Grito de tormenta propio de Solstheim.",
    { related: ["dragonborn-dlc", "solstheim", "miraak"] }),
  shout("dragon-aspect", "Dragon Aspect", "dragonborn", [["Mul", "Fuerza"], ["Qah", "Armadura"], ["Diiv", "Sierpe"]],
    "Aumenta tu daño y tu defensa; con la tercera palabra adoptas un aspecto de dragón y recargas gritos más rápido.", "Grito de transformación del Sangre de Dragón.",
    { related: ["dragonborn-dlc", "solstheim", "miraak", "dragons-overview", "bend-will", "cyclone"], quests: ["at-the-summit-of-apocrypha"] }),

  // ---------- ARMAS ----------
  { id: "dragonbone-weapons", name: "Armas de Dragonbone", type: "weapon-set", category: "weapons", dlc: "dawnguard",
    description: "Espadas, hachas, mazas, dagas y arcos forjados con huesos de dragón. Se fabrican en la forja y requieren la ventaja «Dragon Armor» de Herrería.",
    requirements: "Ventaja «Dragon Armor» de Herrería, huesos y escamas de dragón.", related: ["dragon-armor", "dawnguard-dlc", "dragonbone-armor"], tags: ["hueso de dragón", "espada", "arco"], uesp: "Dragonbone Weapons" },
  { id: "crossbows", name: "Ballestas", type: "weapon-set", category: "weapons", dlc: "dawnguard",
    description: "Armas a distancia de alto daño y recarga lenta. Se introdujeron con Dawnguard, con variantes normales y mejoradas.",
    related: ["dawnguard-dlc", "dawnguard-faction"], tags: ["virotes", "arma a distancia"], uesp: "Crossbows" },
  { id: "stalhrim-weapons", name: "Armas de Stalhrim", type: "weapon-set", category: "weapons", dlc: "dragonborn",
    description: "Armas de hielo encantado forjadas con Stalhrim, un material exclusivo de Solstheim. Incluyen espadas, hachas y arcos.",
    requirements: "Ventaja «Ebony Smithing» y Stalhrim excavado en Solstheim.", related: ["stalhrim-armor", "solstheim", "dragonborn-dlc"], tags: ["hielo", "espada"], uesp: "Stalhrim Weapons" },
  { id: "bonemold-weapons", name: "Armas de Bonemold", type: "weapon-set", category: "weapons", dlc: "dragonborn",
    description: "Armas ligeras hechas de hueso y resina, típicas de los dunmer de Solstheim.",
    related: ["solstheim", "raven-rock"], tags: ["dunmer", "espada"] },
  { id: "chitin-weapons", name: "Armas de Chitin", type: "weapon-set", category: "weapons", dlc: "dragonborn",
    description: "Armas ligeras hechas con caparazón de insectos gigantes, nativas de Solstheim.",
    related: ["solstheim"], tags: ["insecto", "espada"] },
  { id: "nordic-carved-weapons", name: "Armas Nordic Carved", type: "weapon-set", category: "weapons", dlc: "dragonborn",
    description: "Armas de metal tallado de estilo nórdico antiguo, disponibles en Solstheim.",
    related: ["solstheim", "dragonborn-dlc"], tags: ["nórdico", "espada"] },
  { id: "steel-weapons", name: "Armas de acero", type: "weapon-set", category: "weapons", dlc: "skyrim",
    description: "Espadas, hachas y mazas de acero, el primer salto de calidad sobre el hierro y las más comunes del juego base.",
    tags: ["espada", "hacha"] },

  // ---------- ARMADURAS ----------
  { id: "dragonbone-armor", name: "Armadura de Dragonbone", type: "armor-set", category: "armor", dlc: "dawnguard",
    description: "Conjunto de armadura pesada fabricado con huesos de dragón, añadido en Dawnguard.",
    requirements: "Ventaja «Dragon Armor» de Herrería.", related: ["dragon-armor", "dragonbone-weapons"], tags: ["pesada", "hueso de dragón"] },
  { id: "dawnguard-armor", name: "Armadura de la Dawnguard", type: "armor-set", category: "armor", dlc: "dawnguard",
    description: "Armaduras de la orden cazadora de vampiros, entregadas al unirte a la Dawnguard.",
    related: ["dawnguard-faction", "isran"], tags: ["pesada"] },
  { id: "vampire-armor", name: "Armadura de vampiro", type: "armor-set", category: "armor", dlc: "dawnguard",
    description: "Conjuntos de tela y cuero asociados al clan Volkihar.",
    related: ["volkihar-clan", "castle-volkihar"], tags: ["ligera"] },
  { id: "stalhrim-armor", name: "Armadura de Stalhrim", type: "armor-set", category: "armor", dlc: "dragonborn",
    description: "Armadura ligera y pesada de hielo encantado, exclusiva de Solstheim.",
    requirements: "Ventaja «Ebony Smithing» y Stalhrim.", related: ["stalhrim-weapons", "solstheim"], tags: ["hielo"] },
  { id: "bonemold-armor", name: "Armadura de Bonemold", type: "armor-set", category: "armor", dlc: "dragonborn",
    description: "Armadura pesada de hueso y resina, típica de los dunmer de Solstheim.", related: ["raven-rock", "solstheim"] },
  { id: "chitin-armor", name: "Armadura de Chitin", type: "armor-set", category: "armor", dlc: "dragonborn",
    description: "Armadura ligera hecha con caparazón de insectos gigantes.", related: ["solstheim"] },
  { id: "nordic-carved-armor", name: "Armadura Nordic Carved", type: "armor-set", category: "armor", dlc: "dragonborn",
    description: "Armadura pesada de metal tallado de estilo nórdico antiguo.", related: ["nordic-carved-weapons", "solstheim"] },
  { id: "daedric-armor", name: "Armadura daédrica", type: "armor-set", category: "armor", dlc: "skyrim",
    description: "Armadura pesada de ébano y corazones daédricos, una de las mejores del juego base.", tags: ["daedrico", "pesada"] },

  // ---------- ALQUIMIA ----------
  { id: "nirnroot", name: "Nirnroot", type: "ingredient", category: "alchemy", dlc: "skyrim",
    description: "Planta brillante que emite un sonido característico. Muy apreciada en alquimia y hallada cerca de agua.", uesp: "Nirnroot", tags: ["planta"] },
  { id: "blue-mountain-flower", name: "Blue Mountain Flower", type: "ingredient", category: "alchemy", dlc: "skyrim",
    description: "Flor común de Skyrim, usada en varias pociones restauradoras.", tags: ["planta"] },
  { id: "netch-jelly", name: "Netch Jelly", type: "ingredient", category: "alchemy", dlc: "dragonborn",
    description: "Ingrediente obtenido de los netch de Solstheim.", related: ["solstheim"], tags: ["solstheim"] },
  { id: "ash-hopper-jelly", name: "Ash Hopper Jelly", type: "ingredient", category: "alchemy", dlc: "dragonborn",
    description: "Ingrediente que sueltan los ash hopper de Solstheim.", related: ["solstheim"], tags: ["solstheim"] },

  // ---------- HECHIZOS ----------
  { id: "flames", name: "Flames", type: "spell", category: "spells", dlc: "skyrim",
    description: "Hechizo básico de Destrucción que lanza un chorro de fuego continuo a corta distancia.", tags: ["destrucción", "fuego"] },
  { id: "fireball", name: "Fireball", type: "spell", category: "spells", dlc: "skyrim",
    description: "Proyectil de fuego que explota en área al impactar.", tags: ["destrucción", "fuego"] },
  { id: "conjure-familiar", name: "Conjure Familiar", type: "spell", category: "spells", dlc: "skyrim",
    description: "Invoca a un espíritu lobo que combate a tu lado durante un tiempo.", tags: ["conjuración"] },

  // ---------- DRAGONES ----------
  { id: "alduin", name: "Alduin", type: "dragon", category: "dragons", dlc: "skyrim",
    description: "El Devorador de Mundos, dragón primordial y antagonista principal del juego base.", aliases: ["devorador de mundos"], related: ["dragonrend", "paarthurnax", "sovngarde"], uesp: "Alduin" },
  { id: "paarthurnax", name: "Paarthurnax", type: "dragon", category: "dragons", dlc: "skyrim",
    description: "Dragón anciano que vive en la cima de la Garganta del Mundo y enseña a los Greybeards.", location: "Throat of the World", related: ["alduin", "dragonrend"], uesp: "Paarthurnax" },
  { id: "odahviing", name: "Odahviing", type: "dragon", category: "dragons", dlc: "skyrim",
    description: "Dragón que puede unirse a tu causa tras la batalla contra Alduin y acudir con Call Dragon.", related: ["call-dragon", "alduin"], uesp: "Odahviing" },
  { id: "durnehviir", name: "Durnehviir", type: "dragon", category: "dragons", dlc: "dawnguard",
    description: "Dragón no muerto atrapado en el Soul Cairn que enseña un grito para invocarlo.", location: "Soul Cairn", related: ["summon-durnehviir", "soul-cairn", "soul-tear"], uesp: "Durnehviir" },
  { id: "dragons-overview", name: "Dragones en Dragonborn", type: "mechanic", category: "dragons", dlc: "dragonborn",
    description: "Con la tercera palabra de Bend Will puedes dominar y montar a un dragón. Además, el grito «Dragon Aspect» te da un aspecto propio de dragón.",
    related: ["bend-will", "dragon-aspect", "dragonborn-dlc"], tags: ["montar dragones"] },

  // ---------- CRIATURAS ----------
  { id: "frost-troll", name: "Frost Troll", type: "creature", category: "creatures", dlc: "skyrim",
    description: "Troll de hielo que habita zonas frías; se regenera y es vulnerable al fuego.", tags: ["troll"] },
  { id: "draugr", name: "Draugr", type: "creature", category: "creatures", dlc: "skyrim",
    description: "Antiguos nórdicos no muertos que custodian tumbas y ruinas.", tags: ["no muerto"] },
  { id: "gargoyle", name: "Gargoyle", type: "creature", category: "creatures", dlc: "dawnguard",
    description: "Criatura de piedra que sirve al clan Volkihar.", related: ["castle-volkihar", "volkihar-clan"], tags: ["piedra"] },
  { id: "chaurus-hunter", name: "Chaurus Hunter", type: "creature", category: "creatures", dlc: "dawnguard",
    description: "Insecto gigante alado añadido con Dawnguard, más ágil que el chaurus común.", tags: ["insecto"] },
  { id: "seeker", name: "Seeker", type: "creature", category: "creatures", dlc: "dragonborn",
    description: "Criatura de Apocrypha que lanza hechizos y tentáculos al combatir.", related: ["apocrypha", "miraak"], tags: ["apocrypha"] },
  { id: "lurker", name: "Lurker", type: "creature", category: "creatures", dlc: "dragonborn",
    description: "Gran criatura de Apocrypha, con ataques poderosos cuerpo a cuerpo.", related: ["apocrypha"], tags: ["apocrypha"] },
  { id: "ash-spawn", name: "Ash Spawn", type: "creature", category: "creatures", dlc: "dragonborn",
    description: "Criatura de ceniza de las Tierras Cenizas de Solstheim.", related: ["solstheim"], tags: ["solstheim"] },
  { id: "riekling", name: "Riekling", type: "creature", category: "creatures", dlc: "dragonborn",
    description: "Pequeños humanoides de Solstheim que a veces montan jabalíes.", related: ["solstheim"], tags: ["solstheim"] },

  // ---------- NPCs ----------
  { id: "serana", name: "Serana", type: "npc", category: "companions", dlc: "dawnguard",
    description: "Vampira pura sangre, hija de Lord Harkon, que se convierte en compañera del Sangre de Dragón.", location: "Dimhollow Crypt / Castle Volkihar",
    related: ["harkon", "castle-volkihar", "soul-cairn", "volkihar-clan", "bloodline"], uesp: "Serana", quests: ["bloodline"], tags: ["volkihar", "vampira"] },
  { id: "lydia", name: "Lydia", type: "npc", category: "companions", dlc: "skyrim",
    description: "Housecarl de Whiterun que se ofrece como seguidora; habitual primera compañera de muchos jugadores.", location: "Dragonsreach, Whiterun", related: ["whiterun"], uesp: "Lydia" },
  { id: "teldryn-sero", name: "Teldryn Sero", type: "npc", category: "companions", dlc: "dragonborn",
    description: "Mago dunmer de Tel Mithryn que puede acompañarte como seguidor.", location: "Tel Mithryn, Solstheim", related: ["tel-mithryn", "solstheim"] },
  { id: "isran", name: "Isran", type: "npc", category: "npcs", dlc: "dawnguard",
    description: "Líder de la Dawnguard y veterano cazador de vampiros.", location: "Fort Dawnguard", related: ["dawnguard-faction", "dawnguard-dlc"], uesp: "Isran" },
  { id: "harkon", name: "Lord Harkon", type: "npc", category: "npcs", dlc: "dawnguard",
    description: "Señor vampiro, líder del clan Volkihar y padre de Serana.", location: "Castle Volkihar", related: ["serana", "castle-volkihar", "volkihar-clan"], aliases: ["harkon"], uesp: "Lord Harkon" },
  { id: "miraak", name: "Miraak", type: "npc", category: "npcs", dlc: "dragonborn",
    description: "El primer Sangre de Dragón. Se alió con Hermaeus Mora y busca dominar a los dragones.", location: "Apocrypha / Solstheim",
    related: ["apocrypha", "bend-will", "solstheim", "black-books", "dragonborn-dlc", "miraaks-sword"], uesp: "Miraak" },
  { id: "neloth", name: "Neloth", type: "npc", category: "npcs", dlc: "dragonborn",
    description: "Mago telvanni de Tel Mithryn, figura clave en la trama de Dragonborn.", location: "Tel Mithryn, Solstheim", related: ["tel-mithryn", "solstheim"] },
  { id: "frea", name: "Frea", type: "npc", category: "npcs", dlc: "dragonborn",
    description: "Skaal que guía al protagonista en la primera parte de la expansión.", related: ["skaal", "skaal-village", "solstheim"] },
  { id: "ulfric-stormcloak", name: "Ulfric Stormcloak", type: "npc", category: "npcs", dlc: "skyrim",
    description: "Líder de los Capas de la Tormenta en la guerra civil de Skyrim.", related: ["whiterun"], uesp: "Ulfric Stormcloak" },
  { id: "tullius", name: "General Tullius", type: "npc", category: "npcs", dlc: "skyrim",
    description: "Comandante imperial de la Legión en Skyrim.", uesp: "General Tullius" },

  // ---------- MASCOTAS ----------
  { id: "barbas", name: "Barbas", type: "pet", category: "pets", dlc: "skyrim",
    description: "Perro que acompaña a Clavicus Vile; se convierte en compañero durante la misión daédrica asociada.", tags: ["perro", "daedrico"], uesp: "Barbas" },

  // ---------- MONTURAS ----------
  { id: "shadowmere", name: "Shadowmere", type: "mount", category: "mounts", dlc: "skyrim",
    description: "Caballo negro de la Hermandad Oscura, con gran resistencia y difícil de matar.", related: ["dark-brotherhood"], uesp: "Shadowmere", tags: ["caballo"] },
  { id: "arvak", name: "Arvak", type: "mount", category: "mounts", dlc: "dawnguard",
    description: "Caballo esquelético de fuego obtenido en Dawnguard; muy resistente y en llamas.", related: ["dawnguard-dlc"], uesp: "Arvak", tags: ["caballo", "esqueleto"] },
  { id: "stable-horses", name: "Caballos de establo", type: "mount", category: "mounts", dlc: "skyrim",
    description: "Caballos que se compran en los establos de las ciudades principales.", tags: ["caballo"] },

  // ---------- LUGARES ----------
  { id: "whiterun", name: "Whiterun", type: "place", category: "places", dlc: "skyrim",
    description: "Ciudad central de Skyrim, sede del Jarl Balgruuf y de los Compañeros; hogar de Dragonsreach.", related: ["lydia"], uesp: "Whiterun" },
  { id: "bleak-falls-barrow", name: "Bleak Falls Barrow", type: "place", category: "places", dlc: "skyrim",
    description: "Tumba nórdica cerca de Riverwood con una pared de palabras de poder.", location: "Cerca de Riverwood", related: ["unrelenting-force", "dragon-rising"], uesp: "Bleak Falls Barrow" },
  { id: "sovngarde", name: "Sovngarde", type: "place", category: "places", dlc: "skyrim",
    description: "El Salón de los Valientes nórdico, donde Alduin devora almas.", related: ["alduin", "call-of-valor"], uesp: "Sovngarde" },
  { id: "solstheim", name: "Solstheim", type: "place", category: "places", dlc: "dragonborn",
    description: "Isla al noreste de Skyrim que sirve de escenario a Dragonborn. Incluye Raven Rock, Tel Mithryn y la aldea Skaal.", location: "Isla al noreste de Skyrim; se llega en barco",
    related: ["dragonborn-dlc", "raven-rock", "tel-mithryn", "skaal-village", "apocrypha", "miraak"], uesp: "Solstheim" },
  { id: "apocrypha", name: "Apocrypha", type: "place", category: "places", dlc: "dragonborn",
    description: "Reino de Oblivion gobernado por Hermaeus Mora, lleno de libros y criaturas tentaculares.", location: "Plano de Oblivion (Hermaeus Mora)",
    related: ["miraak", "black-books", "bend-will", "seeker", "lurker"], uesp: "Apocrypha" },
  { id: "raven-rock", name: "Raven Rock", type: "place", category: "places", dlc: "dragonborn",
    description: "Asentamiento dunmer de Solstheim, el más grande de la isla.", location: "Solstheim", related: ["solstheim", "bonemold-armor"], uesp: "Raven Rock" },
  { id: "tel-mithryn", name: "Tel Mithryn", type: "place", category: "places", dlc: "dragonborn",
    description: "Torre de hongo del mago Neloth, en Solstheim.", location: "Solstheim", related: ["neloth", "teldryn-sero", "solstheim"], uesp: "Tel Mithryn" },
  { id: "skaal-village", name: "Skaal Village", type: "place", category: "places", dlc: "dragonborn",
    description: "Aldea de los skaal, nórdicos de Solstheim que rinden culto al Todopadre.", location: "Solstheim", related: ["skaal", "frea", "solstheim"], uesp: "Skaal Village" },
  { id: "castle-volkihar", name: "Castle Volkihar", type: "place", category: "places", dlc: "dawnguard",
    description: "Fortaleza del clan vampírico Volkihar, en una isla del Mar de los Fantasmas.", location: "Mar de los Fantasmas",
    related: ["volkihar-clan", "harkon", "serana", "gargoyle"], uesp: "Castle Volkihar", tags: ["volkihar"] },
  { id: "soul-cairn", name: "Soul Cairn", type: "place", category: "places", dlc: "dawnguard",
    description: "Reino de Oblivion donde reposan las almas atrapadas. Es el hogar de Durnehviir.", location: "Plano de Oblivion",
    related: ["durnehviir", "summon-durnehviir", "soul-tear", "serana"], uesp: "Soul Cairn" },
  { id: "lakeview-manor", name: "Lakeview Manor", type: "place", category: "houses", dlc: "hearthfire",
    description: "Terreno junto a un lago en Falkreath Hold donde puedes construir tu casa con Hearthfire.", location: "Falkreath Hold", related: ["hearthfire-dlc"], uesp: "Lakeview Manor" },
  { id: "heljarchen-hall", name: "Heljarchen Hall", type: "place", category: "houses", dlc: "hearthfire",
    description: "Terreno nevado en The Pale donde puedes construir tu casa con Hearthfire.", location: "The Pale", related: ["hearthfire-dlc"], uesp: "Heljarchen Hall" },
  { id: "windstad-manor", name: "Windstad Manor", type: "place", category: "houses", dlc: "hearthfire",
    description: "Terreno pantanoso en Hjaalmarch donde puedes construir tu casa con Hearthfire.", location: "Hjaalmarch", related: ["hearthfire-dlc"], uesp: "Windstad Manor" },

  // ---------- MISIONES ----------
  { id: "dragon-rising", name: "Dragon Rising", type: "quest", category: "quests", dlc: "skyrim",
    description: "Misión de la trama principal en la que aprendes tu primer grito y se revela tu destino.", related: ["bleak-falls-barrow", "unrelenting-force", "the-way-of-the-voice"], uesp: "Dragon Rising" },
  { id: "the-way-of-the-voice", name: "The Way of the Voice", type: "quest", category: "quests", dlc: "skyrim",
    description: "Misión en la que subes a High Hrothgar para aprender de los Greybeards.", related: ["paarthurnax", "dragon-rising"], uesp: "The Way of the Voice" },
  { id: "bloodline", name: "Bloodline", type: "quest", category: "quests", dlc: "dawnguard",
    description: "Misión de Dawnguard centrada en Serana y su origen vampírico.", related: ["serana", "harkon", "castle-volkihar"] },
  { id: "the-path-of-knowledge", name: "The Path of Knowledge", type: "quest", category: "quests", dlc: "dragonborn",
    description: "Misión de Dragonborn ligada a los Libros Negros y a las palabras de Bend Will.", related: ["black-books", "bend-will", "apocrypha"] },
  { id: "at-the-summit-of-apocrypha", name: "At the Summit of Apocrypha", type: "quest", category: "quests", dlc: "dragonborn",
    description: "Misión final de la expansión Dragonborn en Apocrypha.", related: ["apocrypha", "miraak", "dragon-aspect"] },

  // ---------- FACCIONES ----------
  { id: "dawnguard-faction", name: "La Dawnguard", type: "faction", category: "factions", dlc: "dawnguard",
    description: "Orden de cazadores de vampiros con base en Fort Dawnguard, liderada por Isran.", related: ["isran", "dawnguard-armor", "crossbows"], uesp: "Dawnguard (faction)" },
  { id: "volkihar-clan", name: "Clan Volkihar", type: "faction", category: "factions", dlc: "dawnguard",
    description: "Clan vampírico liderado por Lord Harkon desde Castle Volkihar.", related: ["harkon", "serana", "castle-volkihar", "vampire-armor"], tags: ["volkihar"] },
  { id: "skaal", name: "Los Skaal", type: "faction", category: "factions", dlc: "dragonborn",
    description: "Comunidad nórdica de Solstheim que vive de forma tradicional.", related: ["skaal-village", "frea", "solstheim"] },
  { id: "dark-brotherhood", name: "La Hermandad Oscura", type: "faction", category: "factions", dlc: "skyrim",
    description: "Gremio de asesinos al servicio de la Madre Noche.", related: ["shadowmere"] },
  { id: "companions-faction", name: "Los Compañeros", type: "faction", category: "factions", dlc: "skyrim",
    description: "Gremio de guerreros de Whiterun, vinculado a la licantropía.", related: ["beast-form", "whiterun"] },

  // ---------- ARTEFACTOS ----------
  { id: "mehrunes-razor", name: "Mehrunes' Razor", type: "artifact", category: "artifacts", dlc: "skyrim",
    description: "Daga daédrica de Mehrunes Dagon que puede matar instantáneamente a veces. Se obtiene en una misión daédrica.", aliases: ["mehrunes dagon", "razor"], tags: ["daedrico", "daga"], uesp: "Mehrunes' Razor" },
  { id: "dawnbreaker", name: "Dawnbreaker", type: "artifact", category: "artifacts", dlc: "skyrim",
    description: "Espada daédrica de Meridia que daña a los no muertos y puede incinerarlos.", aliases: ["meridia"], tags: ["daedrico", "espada"], uesp: "Dawnbreaker" },
  { id: "auriels-bow", name: "Auriel's Bow", type: "artifact", category: "artifacts", dlc: "dawnguard",
    description: "Arco élfico legendario ligado a la trama de Dawnguard y eficaz contra vampiros.", related: ["dawnguard-dlc", "isran"], tags: ["arco"], uesp: "Auriel's Bow" },
  { id: "bloodskal-blade", name: "Bloodskal Blade", type: "artifact", category: "artifacts", dlc: "dragonborn",
    description: "Espada nórdica legendaria de Solstheim, capaz de lanzar un ataque de poder.", related: ["solstheim"], tags: ["espada"] },
  { id: "miraaks-sword", name: "Miraak's Sword", type: "artifact", category: "artifacts", dlc: "dragonborn",
    description: "Espada del primer Sangre de Dragón, obtenida durante la trama de Dragonborn.", related: ["miraak", "apocrypha"], tags: ["espada"] },

  // ---------- HABILIDADES Y VENTAJAS ----------
  { id: "smithing", name: "Herrería", type: "skill", category: "skills", dlc: "skyrim",
    description: "Habilidad de fabricar y mejorar armas y armaduras.", related: ["dragon-armor"] },
  { id: "destruction", name: "Destrucción", type: "skill", category: "skills", dlc: "skyrim",
    description: "Escuela de magia ofensiva: fuego, hielo y electricidad.", related: ["flames", "fireball"] },
  { id: "dragon-armor", name: "Dragon Armor", type: "perk", category: "perks", dlc: "skyrim",
    description: "Ventaja de Herrería que permite fabricar y mejorar equipo con huesos y escamas de dragón; clave para el equipo Dragonbone de Dawnguard.",
    related: ["smithing", "dragonbone-weapons", "dragonbone-armor"] },

  // ---------- VAMPIRISMO / LICANTROPÍA ----------
  { id: "vampire-lord", name: "Señor Vampiro", type: "mechanic", category: "vampirism", dlc: "dawnguard",
    description: "Forma de murciélago-demonio que desbloquea un árbol de ventajas propio. Se obtiene al avanzar en Dawnguard y ser vampiro.",
    related: ["serana", "castle-volkihar", "dawnguard-dlc"], aliases: ["vampire lord"], tags: ["vampiro"] },
  { id: "vampirism-base", name: "Vampirismo", type: "mechanic", category: "vampirism", dlc: "skyrim",
    description: "Enfermedad que te convierte en vampiro con etapas progresivas y habilidades propias.", tags: ["vampiro"] },
  { id: "beast-form", name: "Forma de Bestia", type: "mechanic", category: "lycanthropy", dlc: "skyrim",
    description: "Forma de hombre lobo obtenida al unirte a los Compañeros y aceptar la licantropía.", related: ["companions-faction"], tags: ["hombre lobo"] },

  // ---------- LIBROS ----------
  { id: "black-books", name: "Libros Negros", type: "book", category: "books", dlc: "dragonborn",
    description: "Libros de Hermaeus Mora que te transportan a Apocrypha y desbloquean las palabras de Bend Will, junto con otras habilidades.",
    related: ["apocrypha", "miraak", "bend-will", "the-path-of-knowledge"], aliases: ["black books", "libros negros"] },
  { id: "oghma-infinium", name: "Oghma Infinium", type: "book", category: "books", dlc: "skyrim",
    description: "Tomo daédrico de Hermaeus Mora que permite elegir una rama de conocimiento.", tags: ["daedrico"] },

  // ---------- LLAVES / ECONOMÍA / OBJETOS / OTROS ----------
  { id: "skeleton-key", name: "Skeleton Key", type: "key", category: "keys", dlc: "skyrim",
    description: "Llave maestra de Nocturnal que abre cualquier cerradura sin romperse.", tags: ["ladrón", "daedrico"], uesp: "Skeleton Key" },
  { id: "gold", name: "Oro (Septim)", type: "currency", category: "economy", dlc: "skyrim",
    description: "La moneda de Skyrim. Se usa en comercio, servicios, compra de casas y desbloqueo de entrenamiento." },
  { id: "creation-club-economy", name: "Creation Club", type: "mechanic", category: "economy", dlc: "anniversary",
    description: "Tienda de contenido oficial del juego en la que se compran creaciones con créditos.", tags: ["anniversary"] },
  { id: "soul-gems", name: "Gemas de alma", type: "item", category: "items", dlc: "skyrim",
    description: "Gemas que almacenan almas para encantar equipo y recargar objetos.", tags: ["encantamiento"] },
  { id: "dragon-soul", name: "Alma de dragón", type: "item", category: "items", dlc: "skyrim",
    description: "Esencia que absorbes al matar dragones. Se gasta para desbloquear palabras de poder ya aprendidas en una pared.",
    aliases: ["dragon soul", "almas de dragon"], related: ["unrelenting-force", "dragon-aspect"] },
  { id: "survival-mode", name: "Modo Supervivencia", type: "mechanic", category: "misc", dlc: "anniversary",
    description: "Modo de juego con hambre, frío y fatiga que añade más dificultad." },
  { id: "fishing", name: "Pesca", type: "mechanic", category: "misc", dlc: "anniversary",
    description: "Actividad que permite pescar y usar lo capturado en cocina y alquimia." },
  { id: "saints-and-seducers", name: "Saints & Seducers", type: "mechanic", category: "misc", dlc: "anniversary",
    description: "Contenido de Creation Club con una nueva historia y región." },
  { id: "hearthfire-adoption", name: "Adopción de niños", type: "mechanic", category: "misc", dlc: "hearthfire",
    description: "Con Hearthfire puedes adoptar niños y vivir con ellos en tu casa construida.", related: ["hearthfire-dlc", "lakeview-manor"], tags: ["hearthfire", "familia"] },
  { id: "hearthfire-dlc", name: "Hearthfire: construcción de casas", type: "mechanic", category: "misc", dlc: "hearthfire",
    description: "Sistema para comprar terrenos y construir casas por módulos, con mayordomos, cultivo y animales.",
    related: ["lakeview-manor", "heljarchen-hall", "windstad-manor", "hearthfire-adoption"] },
  { id: "dawnguard-dlc", name: "Dawnguard: resumen del DLC", type: "mechanic", category: "misc", dlc: "dawnguard",
    description: "Historia de la guerra entre la Dawnguard y el clan Volkihar, con el Soul Cairn y la Forma de Señor Vampiro.",
    related: ["dawnguard-faction", "volkihar-clan", "soul-cairn", "serana"] },
  { id: "dragonborn-dlc", name: "Dragonborn: resumen del DLC", type: "mechanic", category: "misc", dlc: "dragonborn",
    description: "Historia de Solstheim, Miraak y Apocrypha, con Libros Negros y equipo de Stalhrim.",
    related: ["solstheim", "miraak", "apocrypha", "black-books"] }
];

// Post-proceso: añade fuentes (UESP) y normaliza listas ausentes.
const uespUrl = (t) => GAME.remote.pageBase + GAME.remote.namespace + encodeURIComponent(t.replace(/ /g, "_")).replace(/%27/g, "'").replace(/%3A/g, ":");

export const ITEMS = RAW_ITEMS.map((it) => ({
  aliases: [], tags: [], related: [], quests: [],
  ...it,
  sources: it.uesp ? [{ name: GAME.remote.name, url: uespUrl(it.uesp), license: GAME.remote.license }] : []
}));

// ============ Utilidades de consulta ============
const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
export const getItemById = (id) => BY_ID.get(id) || null;
export const getDlc = (id) => DLCS.find((d) => d.id === id) || null;
export const getCategory = (id) => CATEGORIES.find((c) => c.id === id) || null;
