// ==UserScript==
// @name         Meet — Imputar el tiempo de la reunión
// @namespace    https://factorlibre.com/gextia
// @version      2.3.3
// @description  PUENTE DE MIGRACIÓN — el script vive ahora en meet-imputar/meet-imputar.user.js
// @author       Jesús Lorenzo
// @icon         https://academy.factorlibre.com//web/image/website/1/favicon?unique=0bd9648
// @homepageURL  https://git.factorlibre.com/jesus.lorenzo/tm-estado-sitios
// @supportURL   https://git.factorlibre.com/jesus.lorenzo/tm-estado-sitios/-/issues
// @updateURL    https://git.factorlibre.com/jesus.lorenzo/tm-estado-sitios/-/raw/master/meet-imputar/meet-imputar.user.js
// @downloadURL  https://git.factorlibre.com/jesus.lorenzo/tm-estado-sitios/-/raw/master/meet-imputar/meet-imputar.user.js
// @match        https://meet.google.com/*
// @match        https://calendar.google.com/*
// @exclude      https://meet.google.com/landing
// ==/UserScript==

/*
 * Este fichero ya NO es el script: solo existe para no romper la actualización
 * automática de quien lo instaló cuando vivía en GitHub.
 *
 * Tampermonkey comprueba la @version en la URL con la que se instaló el script
 * (@updateURL) y, si hay una más alta, descarga el cuerpo desde @downloadURL.
 * Al llevar aquí una versión superior a la instalada y apuntar los dos al
 * GitLab, una instalación antigua se actualiza una única vez desde aquí y a
 * partir de entonces sigue ya la ruta definitiva. Sin este puente la URL vieja
 * daría 404 y Tampermonkey dejaría de actualizar el script en silencio.
 *
 * NO instalar desde aquí. El script está en:
 *   https://git.factorlibre.com/jesus.lorenzo/tm-estado-sitios/-/raw/master/meet-imputar/meet-imputar.user.js
 *
 * Requiere sesión iniciada en git.factorlibre.com.
 */
console.info(
    "[meet-imputar] Este fichero es un puente de migración. El script está en " +
        "https://git.factorlibre.com/jesus.lorenzo/tm-estado-sitios/-/raw/master/meet-imputar/meet-imputar.user.js"
);
