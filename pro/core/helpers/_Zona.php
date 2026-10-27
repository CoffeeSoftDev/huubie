<?php
/*  LA HORA DE MEXICO, aunque el servidor tenga la tabla vieja.

    ================== QUE PASA ==================

    Mexico dejo el horario de verano en octubre de 2022. Las tablas de zonas
    horarias anteriores a ese cambio siguen creyendo que de abril a octubre hay
    que sumar una hora, asi que 'America/Mexico_City' devuelve UTC-5 cuando el
    pais lleva todo el año en UTC-6.

    Este WAMP trae PHP 7.4.33 con tzdata 2022.1: en septiembre da las 17:26
    cuando en el reloj de Windows son las 16:26.

    ================== POR QUE IMPORTA ==================

    Lo destapo un recordatorio. Alguien pedia "recuerdame a las 3:10" a las
    14:20 reales; PHP creia que eran las 15:20, daba esa hora por pasada y lo
    programaba para el dia siguiente.

    Pero el desfase no es del chat: MySQL saca su NOW() del reloj de Windows y
    lo tiene bien, mientras que todo lo que PHP escribe con date() va una hora
    adelantado. Cualquier fecha guardada en verano queda corrida, y comparar
    una con otra da resultados que nadie sabe explicar.

    ================== COMO SE ARREGLA ==================

    Se pregunta a la propia zona si cree estar en horario de verano. Si dice que
    si, la tabla es de antes del cambio y se sustituye por un UTC-6 fijo, que es
    lo que Mexico usa ahora.

    Se comprueba en vez de fijar UTC-6 a secas para que el dia que el servidor
    tenga la tabla al dia —o alguien instale la extension timezonedb— esto no
    haga nada y la zona vuelva a ser la de verdad. */
date_default_timezone_set('America/Mexico_City');

$zona = new DateTimeZone(date_default_timezone_get());

if ((new DateTime('now', $zona))->format('I') === '1') {
    date_default_timezone_set('Etc/GMT+6');
}

unset($zona);
