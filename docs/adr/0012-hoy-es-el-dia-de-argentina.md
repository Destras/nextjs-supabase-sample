# "Hoy" es el día de Argentina, en la base y en el panel

El sistema decidía qué día es hoy con dos reglas a la vez: el panel con el día local del
terapeuta (desde que la semana y el mes de tratamiento se cuentan así) y la base con
`current_date`, que es el día UTC porque no tiene zona horaria configurada. Entre las 21:00 y
las 24:00 de Argentina la base ya estaba en "mañana": un plan completado a las 22:00 arrancaba
al día siguiente y la ficha mostraba "Semana 0", las alertas adelantaban el mes de tratamiento
respecto de la ficha, y un paciente cargado a esa hora quedaba registrado con la fecha del día
siguiente. Todos los terapeutas y pacientes están en Argentina, así que **decidimos que, para
toda fecha de negocio, "hoy" es el día en `America/Argentina/Buenos_Aires`, y que la base lo
obtiene de una única función (`public.hoy()`) en lugar de `current_date`**.

## Consecuencias

- La zona horaria queda fija en un solo lugar (esa función). Si algún día hay terapeutas o
  pacientes en otro huso, se revisa ahí; hoy no se modela una zona por usuario.
- Toda función que guarda una fecha de negocio o compara contra hoy usa `public.hoy()`: el
  arranque del tratamiento y las fechas de evaluación, la fecha de carga, los cierres, las
  alertas, el Dashboard y las RPC de la app del paciente (qué semana le toca). `current_date`
  no se usa más para eso; requiere migración.
- Los instantes (`timestamptz`: `created_at`, `updated_at`, `registrada_en`) siguen en UTC.
- Al **mostrarlos**, el panel lleva un instante a su día de Argentina, con la zona fija y no la
  del navegador (`formatInstante` / `diaDeInstante` en `app/utils/fechaDia.ts`; `formatDate` de
  `lib/format.ts` delega ahí cuando no recibe una fecha de día). Una evaluación respondida o
  una medición registrada a las 22:00 figura ese día, no el siguiente (BETA-040). La zona queda
  entonces en dos lugares: `public.hoy()` en la base y `ZONA_PANEL` en el panel.
- El panel sigue leyendo el día del navegador del terapeuta, que en Argentina es el mismo día.
  Como defensa, la semana de contenido nunca se muestra menor a 1 cuando el tratamiento arrancó.
- No hay migración de datos: las fechas ya guardadas entre las 21:00 y las 24:00 quedan con el
  día UTC (un día adelantadas). No se pueden distinguir con certeza de las correctas.

## Alternativas descartadas

**Cambiar la zona horaria de la base entera (`alter database … set timezone`).** Arreglaba
`current_date` sin tocar funciones, pero cambia cómo se formatea todo `timestamptz`, afecta a la
app del paciente y a lo que Supabase asume en UTC.

**Volver el panel a UTC.** Dejaba una sola regla, pero el día cambiaría a las 21:00 para el
terapeuta: la semana y el mes avanzarían a la tarde-noche.

**Solo poner un piso de 1 en la semana.** Tapa el síntoma visible y deja las alertas, el
Dashboard y la fecha de carga desfasadas.
