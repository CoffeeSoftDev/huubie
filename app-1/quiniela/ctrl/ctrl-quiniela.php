<?php

if (empty($_POST['opc'])) exit(0);
session_start();
set_time_limit(180); // Ollama local puede tardar varios segundos

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");

require_once '../mdl/mdl-quiniela.php';

class ctrlQuiniela
{
    private $mdl;

    public function __construct()
    {
        $this->mdl = new MQuiniela();
    }

    /** Datos iniciales: catalogo de selecciones + etiquetas de los modelos. */
    function init()
    {
        return [
            'teams'  => $this->teams(),
            'labels' => $this->mdl->labels(),
        ];
    }

    /** Genera el pronostico con ambos modelos + consenso. */
    function predict()
    {
        $teamA = trim($_POST['teamA'] ?? '');
        $teamB = trim($_POST['teamB'] ?? '');

        if ($teamA === '' || $teamB === '') {
            return ['status' => 400, 'message' => 'Selecciona los dos equipos'];
        }
        if (mb_strtolower($teamA) === mb_strtolower($teamB)) {
            return ['status' => 400, 'message' => 'Elige dos equipos distintos'];
        }

        $messages    = $this->mdl->buildMessages($teamA, $teamB);
        $predictions = [];
        foreach ($this->mdl->models() as $role => $modelId) {
            $predictions[$role] = $this->mdl->predictWith($modelId, $messages);
        }
        $consenso = $this->mdl->consensus(array_values($predictions));

        return [
            'status'      => 200,
            'teamA'       => $teamA,
            'teamB'       => $teamB,
            'predictions' => $predictions,
            'consenso'    => $consenso,
        ];
    }

    /** Catalogo de selecciones (sugerencias; el usuario puede escribir libre). */
    private function teams()
    {
        return [
            'Mexico', 'Estados Unidos', 'Canada', 'Costa Rica', 'Panama', 'Honduras', 'Jamaica',
            'Argentina', 'Brasil', 'Uruguay', 'Paraguay', 'Chile', 'Colombia', 'Peru', 'Ecuador', 'Bolivia', 'Venezuela',
            'Espana', 'Francia', 'Alemania', 'Italia', 'Inglaterra', 'Portugal', 'Paises Bajos', 'Belgica',
            'Croacia', 'Suiza', 'Polonia', 'Republica Checa', 'Dinamarca', 'Suecia', 'Noruega', 'Austria',
            'Serbia', 'Escocia', 'Gales', 'Ucrania', 'Turquia', 'Rusia', 'Bosnia y Herzegovina',
            'Corea del Sur', 'Japon', 'Arabia Saudita', 'Iran', 'Australia', 'Catar',
            'Marruecos', 'Senegal', 'Nigeria', 'Ghana', 'Camerun', 'Egipto', 'Argelia', 'Tunez', 'Costa de Marfil',
        ];
    }
}

$obj = new ctrlQuiniela();
$fn  = $_POST['opc'];

if (!method_exists($obj, $fn)) {
    echo json_encode(['status' => 400, 'message' => 'Operacion invalida']);
    exit;
}

echo json_encode($obj->$fn());
