// Repertorio de Sabiduría: solo citas de figuras históricas o reconocidas en
// todo el mundo, con su autor y, cuando se conoce con certeza, la obra o el
// momento de donde salen. Se evitan las atribuciones apócrifas habituales
// (p. ej. «Somos lo que hacemos repetidamente», que es de Will Durant y no de
// Aristóteles). Para cambiar el repertorio basta con editar esta lista: el
// despliegue la sincroniza con wisdom_cards (services/wisdom.service).
export type WisdomCategory = 'discipline' | 'mindset' | 'strategy' | 'finance' | 'health' | 'relationships' | 'growth';

/** [categoría, cita, autor, obra u ocasión] */
type Row = [WisdomCategory, string, string, string?];

const LEVEL_1: Row[] = [
  ['discipline', 'Un viaje de mil li comienza con un solo paso.', 'Lao Tsé', 'Tao Te Ching'],
  ['discipline', 'No es que tengamos poco tiempo, sino que perdemos mucho.', 'Séneca', 'De la brevedad de la vida'],
  ['discipline', 'Hoy es la victoria sobre tu yo de ayer; mañana, la victoria sobre hombres inferiores.', 'Miyamoto Musashi', 'El libro de los cinco anillos'],
  ['discipline', 'Nada grande se crea de repente.', 'Epicteto', 'Disertaciones'],
  ['discipline', 'Primero dite a ti mismo lo que quieres ser; luego haz lo que tengas que hacer.', 'Epicteto', 'Disertaciones'],
  ['discipline', 'La gota horada la piedra.', 'Ovidio', 'Pónticas'],
  ['discipline', 'No cuentes los días: haz que los días cuenten.', 'Muhammad Ali'],
  ['discipline', 'Solo los disciplinados son libres en la vida.', 'Eliud Kipchoge'],
  ['discipline', 'No importa lo despacio que vayas, siempre que no te detengas.', 'Confucio'],
  ['mindset', 'El impedimento a la acción hace avanzar la acción. Lo que se interpone en el camino se convierte en el camino.', 'Marco Aurelio', 'Meditaciones'],
  ['mindset', 'Si te aflige algo externo, no es eso lo que te perturba, sino tu juicio sobre ello. Y está en tu poder borrar ese juicio ahora mismo.', 'Marco Aurelio', 'Meditaciones'],
  ['mindset', 'No nos perturban las cosas, sino las opiniones que tenemos de ellas.', 'Epicteto', 'Enquiridión'],
  ['mindset', 'Sufrimos más a menudo en la imaginación que en la realidad.', 'Séneca', 'Cartas a Lucilio'],
  ['mindset', 'Al hombre se le puede arrebatar todo salvo una cosa: la última de las libertades humanas, elegir su actitud ante cualquier circunstancia.', 'Viktor Frankl', 'El hombre en busca de sentido'],
  ['mindset', 'Quien tiene un porqué para vivir puede soportar casi cualquier cómo.', 'Friedrich Nietzsche', 'El crepúsculo de los ídolos'],
  ['mindset', 'La imaginación es más importante que el conocimiento.', 'Albert Einstein'],
  ['mindset', 'Una vida sin examen no merece ser vivida.', 'Sócrates', 'Apología, de Platón'],
  ['mindset', 'Nada en la vida debe ser temido, solo comprendido.', 'Marie Curie'],
  ['strategy', 'La suprema excelencia consiste en quebrar la resistencia del enemigo sin luchar.', 'Sun Tzu', 'El arte de la guerra'],
  ['strategy', 'Conoce a tu enemigo y conócete a ti mismo, y en cien batallas nunca correrás peligro.', 'Sun Tzu', 'El arte de la guerra'],
  ['strategy', 'No hagas nada que no sirva para nada.', 'Miyamoto Musashi', 'El libro de los cinco anillos'],
  ['strategy', 'Ningún viento es favorable para quien no sabe a qué puerto se dirige.', 'Séneca', 'Cartas a Lucilio'],
  ['strategy', 'La fortuna favorece a los audaces.', 'Virgilio', 'Eneida'],
  ['finance', 'No es pobre el que tiene poco, sino el que mucho desea.', 'Séneca', 'Cartas a Lucilio'],
  ['finance', 'Cuídate de los pequeños gastos: una pequeña vía de agua hunde un gran barco.', 'Benjamin Franklin', 'El camino de la riqueza'],
  ['finance', 'Quien sabe que tiene suficiente es rico.', 'Lao Tsé', 'Tao Te Ching'],
  ['finance', 'Alguien está sentado hoy a la sombra porque alguien plantó un árbol hace mucho tiempo.', 'Warren Buffett'],
  ['health', 'Es una vergüenza envejecer sin haber visto la belleza y la fuerza de las que tu cuerpo es capaz.', 'Sócrates', 'Memorables, de Jenofonte'],
  ['health', 'Hay que pedir una mente sana en un cuerpo sano.', 'Juvenal', 'Sátiras'],
  ['health', 'Descansa: el campo que ha descansado devuelve una cosecha abundante.', 'Ovidio', 'El arte de amar'],
  ['health', 'No temo al hombre que ha practicado diez mil patadas una vez, sino al que ha practicado una patada diez mil veces.', 'Bruce Lee'],
  ['relationships', 'Sin amigos nadie querría vivir, aunque tuviera todos los demás bienes.', 'Aristóteles', 'Ética a Nicómaco'],
  ['relationships', 'Lo que no quieras para ti, no lo hagas a los demás.', 'Confucio', 'Analectas'],
  ['relationships', 'Si quieres ser amado, ama.', 'Séneca', 'Cartas a Lucilio'],
  ['relationships', 'Ningún hombre es una isla, completo en sí mismo.', 'John Donne', 'Devociones para circunstancias emergentes'],
  ['growth', 'Nadie se baña dos veces en el mismo río.', 'Heráclito'],
  ['growth', 'El comienzo es la parte más importante del trabajo.', 'Platón', 'La República'],
  ['growth', 'Si he visto más lejos, es porque estoy sentado sobre hombros de gigantes.', 'Isaac Newton', 'Carta a Robert Hooke, 1676'],
  ['growth', 'Saber no es suficiente: hay que aplicar. Querer no es suficiente: hay que hacer.', 'Johann Wolfgang von Goethe'],
  ['growth', 'Mil días de entrenamiento para forjar; diez mil días de entrenamiento para pulir.', 'Miyamoto Musashi', 'El libro de los cinco anillos'],
];

const LEVEL_3: Row[] = [
  ['discipline', 'Odiaba cada minuto del entrenamiento, pero me decía: no abandones. Sufre ahora y vive el resto de tu vida como un campeón.', 'Muhammad Ali'],
  ['discipline', 'La fuerza no proviene de la capacidad física, sino de una voluntad indomable.', 'Mahatma Gandhi', 'Young India, 1920'],
  ['mindset', 'Cuando ya no podemos cambiar una situación, tenemos el desafío de cambiarnos a nosotros mismos.', 'Viktor Frankl', 'El hombre en busca de sentido'],
  ['mindset', 'La vida es como montar en bicicleta: para mantener el equilibrio hay que seguir avanzando.', 'Albert Einstein', 'Carta a su hijo Eduard, 1930'],
  ['strategy', 'Los guerreros victoriosos primero ganan y después van a la guerra; los derrotados primero van a la guerra y después buscan ganar.', 'Sun Tzu', 'El arte de la guerra'],
  ['strategy', 'Los planes no sirven de nada, pero planificar lo es todo.', 'Dwight D. Eisenhower'],
  ['finance', 'Regla número uno: nunca pierdas dinero. Regla número dos: nunca olvides la regla número uno.', 'Warren Buffett'],
  ['finance', 'Recuerda que el tiempo es dinero.', 'Benjamin Franklin', 'Consejos a un joven comerciante'],
  ['health', 'Los campeones no se hacen en los gimnasios. Se hacen de algo que llevan muy dentro: un deseo, un sueño, una visión.', 'Muhammad Ali'],
  ['health', 'Ningún ser humano tiene límites.', 'Eliud Kipchoge', 'Tras correr un maratón en menos de dos horas, 2019'],
  ['relationships', 'Los hombres existen los unos para los otros. Enséñales, pues, o sopórtalos.', 'Marco Aurelio', 'Meditaciones'],
  ['relationships', 'El odio no cesa con el odio; el odio cesa con el amor.', 'Buda', 'Dhammapada'],
  ['growth', 'El éxito no es un accidente. Es trabajo duro, perseverancia, aprendizaje, estudio, sacrificio y, sobre todo, amor por lo que haces.', 'Pelé'],
  ['growth', 'Llega a ser el que eres.', 'Friedrich Nietzsche', 'Así habló Zaratustra'],
];

const LEVEL_5: Row[] = [
  ['discipline', 'He fallado una y otra vez en mi vida. Por eso tengo éxito.', 'Michael Jordan'],
  ['discipline', 'El genio es un uno por ciento de inspiración y un noventa y nueve por ciento de transpiración.', 'Thomas Edison'],
  ['mindset', 'El alma se tiñe del color de sus pensamientos.', 'Marco Aurelio', 'Meditaciones'],
  ['mindset', 'Quien mira hacia fuera, sueña; quien mira hacia dentro, despierta.', 'Carl Jung', 'Carta a Fanny Bowditch, 1916'],
  ['strategy', 'Vencerá quien sepa cuándo luchar y cuándo no.', 'Sun Tzu', 'El arte de la guerra'],
  ['strategy', 'Divide cada una de las dificultades en tantas partes como sea posible y necesario para resolverlas mejor.', 'René Descartes', 'Discurso del método'],
  ['finance', 'El precio es lo que pagas; el valor es lo que obtienes.', 'Warren Buffett', 'Carta a los accionistas de Berkshire Hathaway, 2008'],
  ['finance', 'Si quieres hacer rico a Pitocles, no le añadas dinero: quítale deseos.', 'Epicuro'],
  ['health', 'Todos tenemos sueños. Pero convertirlos en realidad exige una enorme cantidad de determinación, dedicación, autodisciplina y esfuerzo.', 'Jesse Owens'],
  ['relationships', 'La oscuridad no puede expulsar a la oscuridad; solo la luz puede hacerlo. El odio no puede expulsar al odio; solo el amor puede hacerlo.', 'Martin Luther King Jr.', 'La fuerza de amar'],
  ['growth', 'Mientras enseñamos, aprendemos.', 'Séneca', 'Cartas a Lucilio'],
  ['growth', 'Lo que no me mata me hace más fuerte.', 'Friedrich Nietzsche', 'El crepúsculo de los ídolos'],
];

const LEVEL_8: Row[] = [
  ['discipline', 'Si no puedes volar, corre; si no puedes correr, camina; si no puedes caminar, gatea. Pero hagas lo que hagas, sigue adelante.', 'Martin Luther King Jr.', 'Discurso en el Spelman College, 1967'],
  ['discipline', 'Nunca cedan, nunca, nunca, nunca.', 'Winston Churchill', 'Discurso en la escuela de Harrow, 1941'],
  ['mindset', 'En lo más hondo del invierno aprendí por fin que había en mí un verano invencible.', 'Albert Camus', 'Regreso a Tipasa'],
  ['mindset', 'El valor no es la ausencia de miedo, sino el triunfo sobre él.', 'Nelson Mandela', 'El largo camino hacia la libertad'],
  ['strategy', 'Percibe lo que no puede verse a simple vista.', 'Miyamoto Musashi', 'El libro de los cinco anillos'],
  ['strategy', 'La victoria pertenece al más perseverante.', 'Napoleón Bonaparte'],
  ['finance', 'El principal problema del inversor, e incluso su peor enemigo, probablemente sea él mismo.', 'Benjamin Graham', 'El inversor inteligente'],
  ['finance', 'La riqueza consiste más en usar las cosas que en poseerlas.', 'Aristóteles', 'Retórica'],
  ['health', 'La vida es dura para todos. ¿Y qué? Hay que tener perseverancia y, sobre todo, confianza en uno mismo.', 'Marie Curie'],
  ['relationships', 'Si le hablas a un hombre en una lengua que entiende, llegas a su cabeza. Si le hablas en su propia lengua, llegas a su corazón.', 'Nelson Mandela'],
  ['growth', 'El éxito, como la felicidad, no se puede perseguir: llega como efecto secundario de entregarse a una causa mayor que uno mismo.', 'Viktor Frankl', 'El hombre en busca de sentido'],
];

const LEVEL_12: Row[] = [
  ['discipline', 'Haz cada acto de tu vida como si fuera el último.', 'Marco Aurelio', 'Meditaciones'],
  ['mindset', 'Saber que no se sabe es lo más alto.', 'Lao Tsé', 'Tao Te Ching'],
  ['mindset', 'Hay que imaginarse a Sísifo feliz.', 'Albert Camus', 'El mito de Sísifo'],
  ['strategy', 'Sé agua, amigo mío.', 'Bruce Lee'],
  ['finance', 'Nada es suficiente para quien lo suficiente es poco.', 'Epicuro'],
  ['health', 'La buena forma física no solo es una de las claves de un cuerpo sano: es la base de una actividad intelectual dinámica y creativa.', 'John F. Kennedy', 'The Soft American, 1960'],
  ['relationships', 'La amistad duplica las alegrías y divide las penas por la mitad.', 'Francis Bacon', 'Ensayos: De la amistad'],
  ['growth', 'No pierdas más tiempo discutiendo cómo debe ser un hombre bueno. Sé uno.', 'Marco Aurelio', 'Meditaciones'],
  ['growth', 'Comienza a vivir de inmediato y cuenta cada día como una vida aparte.', 'Séneca', 'Cartas a Lucilio'],
  ['growth', 'El crédito pertenece a quien está de verdad en la arena, con el rostro manchado de polvo, sudor y sangre.', 'Theodore Roosevelt', 'Discurso «Ciudadanía en una república», 1910'],
];

const BY_LEVEL: Array<[number, Row[]]> = [[1, LEVEL_1], [3, LEVEL_3], [5, LEVEL_5], [8, LEVEL_8], [12, LEVEL_12]];

export const WISDOM_QUOTES = BY_LEVEL.flatMap(([levelRequired, rows]) =>
  rows.map(([category, quote, author, source]) => ({ quote, author, source: source ?? null, category, levelRequired })));
