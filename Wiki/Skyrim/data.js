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
    description: "Invoca a u
