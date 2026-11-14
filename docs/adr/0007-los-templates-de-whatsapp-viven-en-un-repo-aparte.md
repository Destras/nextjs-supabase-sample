# Los templates de WhatsApp y su documentación viven en un repo aparte

Los templates de Meta (el del código de activación y el de bienvenida) se crean y se aprueban en la cuenta de WhatsApp Business del cliente. Hasta ahora su documentación estaba repartida en tres lugares, ninguno de ellos un repo: el pedido al cliente, una nota personal y los comentarios de `metaSender.ts`. Además, crearlos y consultarlos por API usa un permiso de gestión (`whatsapp_business_management`) que el panel no necesita para mandar mensajes.

**Decidimos que las definiciones de los templates, la herramienta que los crea y consulta contra la API de Meta, y la documentación de la cuenta vivan en un repo aparte: `whatsapp-templates`.** El panel queda como consumidor: manda mensajes con templates que ya están aprobados. Cómo se gestionan los templates adentro de ese repo —sincronización, credenciales, runtime— se decide en sus propios ADRs, no acá.

## Alternativa considerada

**Una carpeta en el panel, al lado de `metaSender.ts`.** La definición del template y el payload que la usa cambiarían en el mismo PR, y los tests podrían verificar que coinciden. Se prefirió el repo aparte para concentrar la documentación de la cuenta y el manejo de las credenciales de gestión fuera del repo de la app.

## Consecuencias

- **El contrato queda partido en dos repos.** El template aprobado vive en `whatsapp-templates`; el payload que arma el sender de WhatsApp de las Edge Functions vive acá (código omitido en la versión pública). Tienen que coincidir carácter por carácter, y si no, Meta rechaza el envío recién en runtime. Hoy nada compara el template con el payload: cambiar un template obliga a revisar el sender, y viceversa.
- **El panel sigue leyendo su token de mensajería de Supabase secrets** y no necesita el permiso de gestión de templates.
- **Hay que sumar `whatsapp_business_management` al pedido al cliente.** Hoy solo se pide `whatsapp_business_messaging`, que alcanza para mandar pero no para crear ni consultar templates.
