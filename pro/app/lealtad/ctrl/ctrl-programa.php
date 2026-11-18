<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

/*  Lealtad › Programa (seccion lealtad-programa, programa.php): el registro
    solo y los mensajes que salen solos (cumpleaños, te extrañamos, niveles).

    Antes era una pestaña de Tarjetas y su logica sigue en ctrl-tarjetas.php.
    Esta clase la hereda sin despacharla (LOYALTY_CTRL_LIB) y:
      - cambia PAGE: init, needPoints y programReply miran el permiso de
        Programa (show, update), no el de Tarjetas;
      - deja pasar solo sus opc: Permission::dispatch despacha los metodos
        publicos que DECLARA la clase, asi que cada opc va aqui como un puente
        a la de Tarjetas. Lo que no esta en la lista contesta 405.
    getCardDetail es la ficha que abre el ojo de las listas, solo para leer. */

define('LOYALTY_CTRL_LIB', true);

require __DIR__ . '/ctrl-tarjetas.php';

class ctrlProgram extends ctrl {

    const PAGE = 'lealtad-programa';

    // -- Arranque --

    public function init()            { return parent::init(); }
    public function getProgram()      { return parent::getProgram(); }

    // -- Registro solo --

    public function saveSignup()      { return parent::saveSignup(); }
    public function newSignupLink()   { return parent::newSignupLink(); }

    // -- Cumpleaños --

    public function saveBirthday()    { return parent::saveBirthday(); }
    public function lsBirthdays()     { return parent::lsBirthdays(); }
    public function sendBirthdays()   { return parent::sendBirthdays(); }

    // -- Te extrañamos --

    public function saveWinback()     { return parent::saveWinback(); }
    public function lsWinbacks()      { return parent::lsWinbacks(); }
    public function sendWinbacks()    { return parent::sendWinbacks(); }

    // -- Niveles --

    public function saveLevels()      { return parent::saveLevels(); }
    public function lsLevelChanges()  { return parent::lsLevelChanges(); }
    public function applyLevels()     { return parent::applyLevels(); }

    // -- La ficha de una tarjeta (solo lectura) --

    public function getCardDetail()   { return parent::getCardDetail(); }
}

Permission::dispatch(new ctrlProgram(), ctrlProgram::PAGE);
