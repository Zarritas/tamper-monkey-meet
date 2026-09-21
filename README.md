# Google Meet Imputación automática — trasladado

Este script ya **no vive aquí**. Está en el GitLab interno, en el repositorio que reúne todos los
userscripts:

**[https://git.factorlibre.com/jesus.lorenzo/tm-estado-sitios/-/tree/master/meet-imputar](https://git.factorlibre.com/jesus.lorenzo/tm-estado-sitios/-/tree/master/meet-imputar)**

## No hay que hacer nada

Si ya lo tenías instalado, **se actualiza solo**. El fichero que queda en este repositorio
([`main/script.user.js`](main/script.user.js)) es un puente: lleva una versión superior a la instalada y sus
`@updateURL`/`@downloadURL` apuntan ya al GitLab, así que Tampermonkey se actualiza una vez desde
aquí y a partir de entonces sigue la ruta nueva.

Hace falta **tener sesión iniciada en `git.factorlibre.com`**: el repositorio es interno y
Tampermonkey descarga con la sesión del navegador.

## Si lo instalas de cero

Ve al enlace de arriba y abre el `.user.js` con el botón **Raw**. No lo instales desde este
repositorio.

## Por qué se ha movido

Los scripts se cargaban unos a otros por `@require` desde `raw.githubusercontent.com` y se
ejecutaban sobre sesiones autenticadas de herramientas internas. Tenerlos en el GitLab interno cierra
esa vía y los deja todos en un mismo sitio, con su documentación y sus librerías compartidas.

---

Este repositorio se borrará cuando no queden instalaciones apuntando aquí.
