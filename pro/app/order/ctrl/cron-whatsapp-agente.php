<?php
/*  Agente de WhatsApp (F3): lo automatico que no cabe en el webhook. El
    webhook guarda y contesta a Meta al instante; llamar al modelo tarda, asi
    que las propuestas las arma este cron.

    Correrlo cada minuto desde el cron del servidor:
      * * * * * php /ruta/a/pro/app/order/ctrl/cron-whatsapp-agente.php >/dev/null 2>&1

    Solo por linea de comandos: desde el navegador contesta 404.

    Por cada empresa con el agente encendido (wa_agent.enabled = 1) y en horario:
      1. El barrido de F2: el menu de sucursales que quedo pendiente (lo que
         llego cerrado sale al abrir).
      2. Las propuestas de los chats que esperan respuesta (agentSweep). NADA
         sale al cliente: quedan en la bandeja para que una persona decida.

    Reglas que no se ven en el codigo de un vistazo:
      - Un candado (archivo en el temporal del sistema) evita que dos corridas
        se encimen; cada corrida para de empezar propuestas a los 4 min.
      - Fuera de horario no hace nada: los mensajes se quedan esperando.
      - Lo que se le manda al modelo sale a ollama.com (ver _IaOllama.php).
      - El arnes define WA_CRON_NO_RUN antes de incluirlo para usar la clase
        sin correrla. */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../mdl/mdl-order.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp-agente.php';
require_once __DIR__ . '/../mdl/mdl-tienda.php';
require_once __DIR__ . '/../mdl/mdl-portal.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp-ia.php';
require_once __DIR__ . '/../../../core/helpers/_WhatsAppMeta.php';
require_once __DIR__ . '/../../../core/helpers/_IaOllama.php';

class WhatsAppAgentCron extends mdl {

    use WhatsAppInbox, WhatsAppAgentFlow, OnlineStore, CustomerPortal, WhatsAppAgentAI;

    // $until (timestamp): no empieza otra empresa ni otra propuesta despues.
    public function run($until) {
        $done = ['companies' => 0, 'menus' => 0, 'proposals' => 0];

        foreach ($this->qWaAgentsOn() as $row) {
            if (time() >= $until) break;

            $companyId = (int) $row['company_id'];
            $done['companies']++;

            try {
                $done['menus'] += $this->inboxSweep($companyId);
            } catch (Throwable $e) {
                $this->inboxLog("[ CRON ] :: menu de la empresa {$companyId} :: " . $e->getMessage());
            }

            try {
                $done['proposals'] += $this->agentSweep($companyId, $until);
            } catch (Throwable $e) {
                $this->inboxLog("[ CRON ] :: propuestas de la empresa {$companyId} :: " . $e->getMessage());
            }
        }

        return $done;
    }
}

if (defined('WA_CRON_NO_RUN')) return;

$lock = fopen(sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'huubie-whatsapp-agente.lock', 'c');

if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) exit(0);

try {
    $r = (new WhatsAppAgentCron())->run(time() + 240);

    echo date('Y-m-d H:i:s') . " · empresas {$r['companies']} · menus {$r['menus']} · propuestas {$r['proposals']}\n";
} finally {
    flock($lock, LOCK_UN);
    fclose($lock);
}
