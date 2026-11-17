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
      2. Las propuestas de los chats que esperan respuesta (agentSweep).
         Quedan en la bandeja para que una persona decida, salvo (F6):
           - los temas que la empresa puso en automatico (horario, direccion
             y pago; catalogo): salen solos al cliente;
           - las preguntas de un numero del equipo con «Pregunta» (agente del
             dueño): se le contestan directo.
         Tambien sale solo (F4) el aviso a la sucursal cuando el agente pasa
         un chat a una persona, por _WhatsApp.php.
      3. Con wa_agent.reminders = 1 (F5): los recordatorios de adeudo de hoy,
         a lo mas 20 por corrida y 50 al dia (reminderSweep). Necesita
         WHATSAPP_PUBLIC_URL en el .env para armar el enlace del portal.

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
require_once __DIR__ . '/../mdl/mdl-whatsapp-pedidos.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp-recordatorios.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp-dueno.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp-automatico.php';
require_once __DIR__ . '/../../../core/helpers/_WhatsAppMeta.php';
require_once __DIR__ . '/../../../core/helpers/_IaOllama.php';

class WhatsAppAgentCron extends mdl {

    use WhatsAppInbox, WhatsAppAgentFlow, OnlineStore, CustomerPortal, WhatsAppAgentAI, WhatsAppAgentOrders, WhatsAppReminders,
        WhatsAppOwnerAgent, WhatsAppAgentAuto;

    // $until (timestamp): no empieza otra empresa ni otra propuesta despues.
    public function run($until) {
        $done = ['companies' => 0, 'menus' => 0, 'proposals' => 0, 'reminders' => 0];

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

            try {
                $done['reminders'] += $this->reminderSweep($companyId, $until);
            } catch (Throwable $e) {
                $this->inboxLog("[ CRON ] :: recordatorios de la empresa {$companyId} :: " . $e->getMessage());
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

    echo date('Y-m-d H:i:s') . " · empresas {$r['companies']} · menus {$r['menus']} · propuestas {$r['proposals']} · recordatorios {$r['reminders']}\n";
} finally {
    flock($lock, LOCK_UN);
    fclose($lock);
}
