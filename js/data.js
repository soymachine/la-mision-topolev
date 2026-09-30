/* ==========================================================
   data.js — tablas del juego: tiles, minerales, textos, medallas
   ========================================================== */
'use strict';
(function (TP) {
  const MAP_W = 48, MAP_H = 72, HORIZONS = 10, FINAL_DEPTH = 12262;
  TP.CFG = {
    MAP_W, MAP_H, HORIZONS, FINAL_DEPTH,
    M_PER_ROW: FINAL_DEPTH / (HORIZONS * MAP_H), // ≈ 17,03 m por fila
    VERSION: 1
  };

  // ---------- tiles ----------
  const T = TP.T = {
    EMPTY: 0, DIRT: 1, ROCK: 2, GRANITE: 3, BASALT: 4, OBSIDIAN: 5, BEDROCK: 6, CONCRETE: 7,
    BOULDER: 8, WATER: 9, MAGMA: 10, GAS: 11,
    IRON: 12, COPPER: 13, GOLD: 14, URANIUM: 15, TOPOLEVITE: 16,
    BARREL: 17, CRATE: 18, STATION: 19, RELIC: 20
  };

  /* solid: bloquea el paso (hay que perforar)   hp: dureza
     tier: nivel mínimo de broca   heat: calor por golpe
     noise: ruido al perforar (radio en el que despierta gusanos) */
  const D = [];
  function def(id, o) { D[id] = Object.assign({ id, solid: false, hp: 0, tier: 1, heat: 0, noise: 0, drill: false, fg: '#ff8c1a', bg: null, glyph: ' ' }, o); }
  def(T.EMPTY, { name: 'Caverna', glyph: ' ', desc: 'Vacío. El Topolev se agarra a las paredes; sin apoyo, cae.' });
  def(T.DIRT, { name: 'Tierra', glyph: '░', fg: '#8a5427', bg: '#170c05', solid: true, drill: true, hp: 1, heat: 1, noise: 3, desc: 'Blanda. Se perfora de un golpe.' });
  def(T.ROCK, { name: 'Roca', glyph: '▒', fg: '#a8642a', bg: '#1b0e06', solid: true, drill: true, hp: 2, heat: 2, noise: 4, desc: 'Roca común de la plataforma báltica.' });
  def(T.GRANITE, { name: 'Granito', glyph: '▓', fg: '#c9762f', bg: '#211107', solid: true, drill: true, hp: 4, heat: 3, noise: 6, desc: 'Duro. Calienta la broca.' });
  def(T.BASALT, { name: 'Basalto', glyph: '█', fg: '#5b504a', bg: '#1a1512', solid: true, drill: true, hp: 7, tier: 2, heat: 5, noise: 8, desc: 'Muy duro. Requiere broca de nivel 2.' });
  def(T.OBSIDIAN, { name: 'Obsidiana', glyph: '▓', fg: '#9a78c8', bg: '#1a1022', solid: true, drill: true, hp: 9, tier: 3, heat: 6, noise: 9, desc: 'Vidrio volcánico (agua + magma). Requiere broca de nivel 3.' });
  def(T.BEDROCK, { name: 'Lecho rocoso', glyph: '#', fg: '#3d2513', bg: '#0d0703', solid: true, drill: false, desc: 'Impenetrable.' });
  def(T.CONCRETE, { name: 'Hormigón', glyph: '═', fg: '#ff8c1a', bg: '#140903', solid: true, drill: false, desc: 'Muros de la Estación Relé. Impenetrables.' });
  def(T.BOULDER, { name: 'Canto rodado', glyph: '●', fg: '#d8ad7c', solid: true, drill: true, hp: 3, heat: 2, noise: 4, desc: 'Cae si no tiene apoyo y rueda sobre otros cantos. Empújalo de lado si hay hueco.' });
  def(T.WATER, { name: 'Agua', glyph: '≈', fg: '#5fb4e8', bg: '#06121c', desc: 'Fluye. Enfría el Topolev. Convierte el magma en obsidiana.' });
  def(T.MAGMA, { name: 'Magma', glyph: '≈', fg: '#ff4a12', bg: '#3a0a02', solid: true, drill: false, desc: 'Intransitable. Calienta todo lo que tiene cerca.' });
  def(T.GAS, { name: 'Bolsa de gas', glyph: '°', fg: '#b4d63c', bg: '#0b1004', desc: 'Grisú. Explota si perforas cerca con el calor alto, o con dinamita.' });
  def(T.IRON, { name: 'Hierro', glyph: '•', fg: '#c8c2bc', bg: '#1b0e06', solid: true, drill: true, hp: 2, heat: 2, noise: 4, ore: 'iron', desc: 'Mineral de hierro.' });
  def(T.COPPER, { name: 'Cobre', glyph: '¤', fg: '#ee8a45', bg: '#1b0e06', solid: true, drill: true, hp: 3, heat: 2, noise: 4, ore: 'copper', desc: 'Mineral de cobre.' });
  def(T.GOLD, { name: 'Oro', glyph: '$', fg: '#ffd23f', bg: '#211107', solid: true, drill: true, hp: 4, heat: 3, noise: 5, ore: 'gold', desc: 'Oro. Capitalista, pero útil.' });
  def(T.URANIUM, { name: 'Uranio', glyph: '§', fg: '#8cff3c', bg: '#0e1406', solid: true, drill: true, hp: 4, heat: 3, noise: 5, ore: 'uranium', desc: 'Uranio. Muy valioso. Irradia calor mientras está en la bodega.' });
  def(T.TOPOLEVITE, { name: 'Topolevita', glyph: '◊', fg: '#4de8ff', bg: '#04141a', solid: true, drill: true, hp: 5, heat: 3, noise: 5, ore: 'topolevite', desc: 'Cristal desconocido para la ciencia. Vale una fortuna.' });
  def(T.BARREL, { name: 'Bidón de combustible', glyph: 'Б', fg: '#ffb347', desc: 'Restos de una expedición anterior. +Combustible.' });
  def(T.CRATE, { name: 'Caja de suministros', glyph: '?', fg: '#ffd59a', desc: 'Suministros lanzados por el pozo. Puede contener un módulo.' });
  def(T.STATION, { name: 'Estación Relé', glyph: '★', fg: '#ff3b30', desc: 'Fin del horizonte. Comercio, reparaciones y telegramas de Moscú.' });
  def(T.RELIC, { name: '???', glyph: '▼', fg: '#8f8a86', desc: 'Una máquina. Oxidada. Familiar.' });
  TP.TD = D;
  TP.isSolid = t => D[t].solid;

  // ---------- minerales ----------
  TP.ORES = {
    iron:       { key: 'iron', name: 'Hierro', glyph: '•', color: '#c8c2bc', cls: 'grey', value: 4, tile: T.IRON },
    copper:     { key: 'copper', name: 'Cobre', glyph: '¤', color: '#ee8a45', cls: 'hi', value: 7, tile: T.COPPER },
    gold:       { key: 'gold', name: 'Oro', glyph: '$', color: '#ffd23f', cls: 'gold', value: 15, tile: T.GOLD },
    uranium:    { key: 'uranium', name: 'Uranio', glyph: '§', color: '#8cff3c', cls: 'green', value: 24, tile: T.URANIUM },
    topolevite: { key: 'topolevite', name: 'Topolevita', glyph: '◊', color: '#4de8ff', cls: 'cyan', value: 55, tile: T.TOPOLEVITE }
  };
  TP.ORE_KEYS = ['iron', 'copper', 'gold', 'uranium', 'topolevite'];
  // peso de aparición de cada mineral por horizonte (0..9)
  TP.oreWeights = function (h) {
    return [
      ['iron', Math.max(1, 10 - h)],
      ['copper', h < 1 ? 3 : Math.max(2, 8 - Math.abs(h - 3))],
      ['gold', h < 2 ? 0 : 2 + h * 0.6],
      ['uranium', h < 3 ? 0 : 1 + (h - 3) * 0.8],
      ['topolevite', h < 4 ? 0 : 0.5 + (h - 4) * 0.4]
    ];
  };

  // ---------- horizontes ----------
  TP.HORIZON_NAMES = [
    'Morrena glaciar', 'Gneis de Kola', 'Esquistos arcaicos', 'Granito rapakivi', 'Anfibolitas',
    'Zona de fractura', 'Galerías calientes', 'Cinturón de magma', 'Manto silencioso', 'El Umbral'
  ];
  TP.AMBIENT = [0, 6, 12, 18, 24, 30, 36, 42, 48, 55];

  // ---------- rarezas y módulos ----------
  TP.RARITY = [
    { name: 'Estándar', cls: 'hi', mult: 1.0 },
    { name: 'Reforzado', cls: 'xhi b', mult: 1.3 },
    { name: 'Heroico', cls: 'red b', mult: 1.65 },
    { name: 'Experimental', cls: 'cyan b', mult: 2.0 }
  ];
  TP.SLOTS = ['broca', 'motor', 'refri', 'blindaje', 'aux1', 'aux2'];
  TP.SLOT_NAMES = { broca: 'BROCA', motor: 'MOTOR', refri: 'REFRIG.', blindaje: 'BLINDAJE', aux1: 'AUX-1', aux2: 'AUX-2' };
  TP.MOD_TYPES = {
    broca: { name: 'Broca', code: 'БР', glyph: '▼' },
    motor: { name: 'Motor', code: 'МТ', glyph: 'Ф' },
    refri: { name: 'Refrigerador', code: 'ОХ', glyph: 'Х' },
    blindaje: { name: 'Blindaje', code: 'БН', glyph: 'Ш' },
    aux: { name: 'Auxiliar', code: 'СП', glyph: 'Ж' }
  };
  TP.EPITHETS = ['Stajánov', 'Octubre Rojo', 'Vostok', 'Sputnik', 'Koroliov', 'Tereshkova', 'Proletario', 'Komsomol',
    'Estrella Roja', 'Bóreas', 'Taiga', 'Volga', 'Ural', 'Kamchatka', 'Polar', 'Buran', 'Zarya', 'Molniya', 'Iskra',
    'Pravda', 'Baikal', 'Jíbiny', 'Murmansk', 'Lunojod', 'Soyuz', 'Kolyma', 'Yenisei', 'Aurora', 'Oso Pardo', 'Tundra'];
  TP.MATERIALS = {
    broca: ['de acero', 'de tungsteno', 'de carburo', 'de titanio', 'diamantada', 'de corindón'],
    motor: ['diésel', 'de turbina', 'de queroseno', 'de ciclo cerrado', 'termoiónico', 'de plasma'],
    refri: ['de glicol', 'de amoníaco', 'de freón', 'criogénico', 'de nitrógeno', 'de helio'],
    blindaje: ['de acero', 'laminado', 'de cerámica', 'de titanio', 'compuesto', 'de boro']
  };

  // efectos auxiliares (lv 1..3)
  TP.AUX = {
    sonar:   { name: 'Hidrófono profundo', desc: l => `Sonar +${3 * l} de radio y ${[25, 40, 60][l - 1]}% más barato.` },
    lights:  { name: 'Faros de arco', desc: l => `Visión +${l}.` },
    magnet:  { name: 'Electroimán', desc: l => `${[30, 50, 75][l - 1]}% de extraer 1 mineral extra.` },
    hold:    { name: 'Bodega extendida', desc: l => `Capacidad de bodega +${[4, 7, 10][l - 1]}.` },
    thermo:  { name: 'Recuperador térmico', desc: l => `Con calor > 45, convierte calor en combustible (${l}/turno).` },
    lead:    { name: 'Forro de plomo', desc: l => `El uranio ${l >= 2 ? 'no irradia' : 'irradia la mitad'}${l >= 3 ? ' y +20% al venderlo' : ''}.` },
    gas:     { name: 'Analizador de grisú', desc: l => `El gas no prende hasta calor ${50 + 15 * l}.` },
    repair:  { name: 'Sistema Lysenko', desc: l => `Repara 1 de casco cada ${[6, 4, 2][l - 1]} turnos.` },
    shock:   { name: 'Amortiguador sísmico', desc: l => `-${[40, 60, 80][l - 1]}% daño de cantos y caídas.` },
    charge:  { name: 'Carga hueca', desc: l => `Dinamita radio +${l >= 2 ? 1 : 0}${l >= 2 ? '' : ' (y +1)'}; +${l} dinamita en cada estación.` },
    asbest:  { name: 'Camisa de asbesto', desc: l => `-${[35, 55, 75][l - 1]}% calor del magma y -${4 * l} calor ambiental.` },
    silent:  { name: 'Silenciador', desc: l => `Ruido de perforación -${[35, 55, 75][l - 1]}%.` }
  };
  TP.AUX_KEYS = Object.keys(TP.AUX);

  // ---------- medallas (Órdenes) ----------
  TP.MEDALS = [
    { key: 'lenin', name: 'Orden de Lenin', desc: '+20 casco máximo.' },
    { key: 'hero', name: 'Héroe del Trabajo Socialista', desc: '+1 refrigeración.' },
    { key: 'star', name: 'Orden de la Estrella Roja', desc: '+2 dinamita en cada estación.' },
    { key: 'banner', name: 'Orden de la Bandera Roja', desc: '+40 combustible máximo.' },
    { key: 'october', name: 'Orden de la Revolución de Octubre', desc: '+1 potencia de broca.' },
    { key: 'valor', name: 'Medalla al Valor Minero', desc: '-15% daño recibido.' },
    { key: 'glory', name: 'Orden de la Gloria', desc: '+1 visión.' },
    { key: 'friend', name: 'Orden de la Amistad', desc: '+20% en el Mercado Estatal.' },
    { key: 'stakh', name: 'Medalla Stajánov', desc: '-20% combustible al perforar.' }
  ];

  // ---------- precios ----------
  TP.PRICES = { repair: 2, fuel: 1, dynamite: 22 };

  // ---------- textos ----------
  TP.TXT = {
    intro:
`TELEGRAMA · ULTRASECRETO · 12/X/1970
DE: COMISARIO A. VOLKOV, ACADEMIA DE CIENCIAS DE LA URSS
PARA: PILOTO DEL KT-1 «TOPOLEV»

CAMARADA:
LOS MICRÓFONOS DEL POZO SG-3 DE KOLA REGISTRAN SONIDOS QUE NO PUEDEN SER GEOLÓGICOS. EL PARTIDO NO CREE EN FANTASMAS. EL PARTIDO CREE EN EL PLAN.
DESCIENDA. CUMPLA LA CUOTA DE CADA HORIZONTE. INFORME DESDE CADA ESTACIÓN RELÉ.
TRES REPRIMENDAS Y SERÁ RELEVADO.
LA PATRIA ESCUCHA. STOP.`,
    lore: [
      'BUEN COMIENZO. LOS GEÓLOGOS BRINDAN CON VODKA. LOS MICRÓFONOS SIGUEN CAPTANDO "RUIDO". IGNÓRELO. STOP.',
      'LA TEMPERATURA SUPERA LO PREVISTO POR LA TEORÍA. LA TEORÍA SERÁ REVISADA. USTED NO. STOP.',
      'LOS TÉCNICOS PIDEN QUE NO ESCUCHE EL CANAL 7. NADIE SABE QUIÉN EMITE EN EL CANAL 7. STOP.',
      'PERDIMOS CONTACTO CON EL RELÉ Nº 2 DURANTE CUATRO MINUTOS. AL VOLVER, EL OPERADOR REPETÍA SU NOMBRE, CAMARADA. STOP.',
      'LA SONDA SÍSMICA DETECTA UNA CAVIDAD BAJO LOS 12.000 METROS. TIENE FORMA REGULAR. DEMASIADO REGULAR. CONTINÚE. STOP.',
      'EL COMISARIO VOLKOV HA SIDO TRASLADADO. SOY SU SUSTITUTO. EL PLAN NO CAMBIA. STOP.',
      'LAS GRABACIONES DEL POZO HAN SIDO CLASIFICADAS. HAY VOCES. UNA DE ELLAS ES LA SUYA. STOP.',
      'SI LEE ESTO, NO SUBA. REPITO: NO SUBA TODAVÍA. TERMINE LA MISIÓN. STOP.',
      'ÚLTIMO RELÉ. DEBAJO SÓLO QUEDA EL UMBRAL. QUE EL PARTIDO... QUE ALGUIEN LE ACOMPAÑE. STOP.'
    ],
    ending: [
      'La cavidad es perfectamente esférica. En su centro, cubierta de óxido y cristales de topolevita, descansa una máquina.',
      'Una perforadora KT-1. En la placa del casco, bajo la costra mineral, se lee: «TOPOLEV · 1970».',
      'Su radio sigue encendida. Por el altavoz, una voz lee despacio un telegrama: "Camarada: los micrófonos del pozo registran sonidos que no pueden ser geológicos..."',
      'Es tu voz.',
      'Los gritos del pozo de Kola nunca fueron gritos. Eran una broca. La tuya. Resonando a través de la roca, hacia arriba y hacia atrás en el tiempo.',
      'La Misión Topolev ha terminado. Siempre termina aquí.',
      'Y siempre vuelve a empezar.'
    ],
    death: {
      hull: 'El casco del KT-1 cede ante la presión de la roca. El Topolev queda sepultado para siempre.',
      fuel: 'Sin combustible. Los motores callan y el Topolev queda en silencio en la oscuridad.',
      heat: 'La refrigeración colapsa. El Topolev se funde lentamente con la roca.',
      strikes: 'Tercera reprimenda. La misión se cancela y usted es reasignado a una mina de carbón en Vorkutá.',
      boulder: 'Un canto rodado aplasta la cabina. Moscú enviará una placa conmemorativa.',
      worm: 'Algo vivo, enorme y hambriento se ha tragado el Topolev.',
      blast: 'Una explosión de grisú desintegra el Topolev.'
    },
    flavor: [
      'LOS OBREROS DE LA SUPERFICIE LE ENVÍAN SALUDOS Y ARENQUE AHUMADO. STOP.',
      'RECUERDE: EL COMBUSTIBLE ES PROPIEDAD DEL PUEBLO. STOP.',
      'PRAVDA PUBLICA SU PROGRESO EN LA PÁGINA 4. STOP.',
      'LOS AMERICANOS HAN ABANDONADO EL PROYECTO MOHOLE. NOSOTROS NO ABANDONAMOS. STOP.',
      'SU MADRE PREGUNTA SI COME BIEN. STOP.'
    ]
  };

  // tipos de muerte → texto corto para el archivo
  TP.DEATH_SHORT = {
    hull: 'Casco destruido', fuel: 'Sin combustible', heat: 'Sobrecalentamiento', strikes: 'Relevado (3 reprimendas)',
    boulder: 'Aplastado', worm: 'Devorado', blast: 'Explosión de grisú', victory: 'MISIÓN CUMPLIDA', quit: 'Abandonada'
  };

  // letras del logo (bloques)
  TP.LOGO_FONT = {
    T: ['██████', '  ██  ', '  ██  ', '  ██  ', '  ██  '],
    O: [' ████ ', '██  ██', '██  ██', '██  ██', ' ████ '],
    P: ['█████ ', '██  ██', '█████ ', '██    ', '██    '],
    L: ['██    ', '██    ', '██    ', '██    ', '██████'],
    E: ['██████', '██    ', '█████ ', '██    ', '██████'],
    V: ['██  ██', '██  ██', '██  ██', ' ████ ', '  ██  ']
  };
})(window.TP);
