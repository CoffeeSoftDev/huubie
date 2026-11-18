<?php
/*  Lealtad: la tarea de cada hora (plan: lealtad/docs/plan-crecimiento.html, etapa L5).

    Correrla cada hora desde el cron del servidor:
      0 * * * * php /ruta/a/pro/app/lealtad/ctrl/cron-lealtad.php >/dev/null 2>&1

    Solo por linea de comandos: desde el navegador contesta 404.

    Por cada empresa con algo encendido en Lealtad › Programa, si tiene numero
    de WhatsApp (wa_agent) y esta en su horario:
      1. Cumpleaños: felicita y regala a los de hoy (una vez al año).
      2. Te extrañamos: a los que les toca, sin pasar del tope del dia.
      3. Niveles: la revision del mes (sube y baja). Corre la primera vez del
         mes que toque en horario; hace 100 tarjetas por vuelta y la siguiente
         corrida sigue hasta acabar (entonces guarda levels_reviewed_at).
    Lo mismo que los botones de la pestaña: los botones solo lo adelantan.

    Reglas que no se ven en el codigo de un vistazo:
      - Horario: el de wa_agent.hours (Ventas › WhatsApp), aunque el agente de
        IA este apagado. Sin horario guardado: de 10:00 a 19:00 todos los dias.
        Fuera de horario no sale nada: lo de hoy sale en la siguiente corrida
        que caiga en horario (el cumpleaños, solo si sigue siendo hoy).
      - Necesita WHATSAPP_PUBLIC_URL en el .env (la de pedir.php, .../app/order):
        sin navegador no hay otro modo de armar el enlace de la tarjeta. Sin
        ella no corre nada y lo apunta en core/helpers/whatsapp.log.
      - Escribe como «la tarea diaria»: user_id NULL. La sucursal de trabajo es
        la primera activa de la empresa: los chats NUEVOS quedan en ella; uno
        que ya tenia sucursal no cambia.
      - Niveles nunca revisados: espera al dia 1 (la primera revision la hace
        una persona con «Revisar niveles», al encenderlos).
      - No mira el plan de la empresa: sin Lealtad en su plan no hay pantalla
        donde encender nada.
      - Un candado (archivo en el temporal del sistema) evita que dos corridas
        se encimen; no empieza otra empresa despues de 10 minutos.
      - El arnes define LOYALTY_CRON_NO_RUN antes de incluirlo para usar la
        clase sin correrla. */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../../order/mdl/mdl-order.php';
require_once __DIR__ . '/../../order/mdl/mdl-lealtad.php';
require_once __DIR__ . '/../../order/mdl/mdl-whatsapp-agente.php';
require_once __DIR__ . '/../../order/mdl/mdl-whatsapp-recordatorios.php';
require_once __DIR__ . '/../../../core/helpers/_WhatsAppMeta.php';
require_once __DIR__ . '/../../order/mdl/mdl-lealtad-programa.php';
require_once __DIR__ . '/../../order/mdl/mdl-lealtad-whatsapp.php';
require_once __DIR__ . '/../../order/mdl/mdl-lealtad-cumple.php';
require_once __DIR__ . '/../../order/mdl/mdl-lealtad-regreso.php';
require_once __DIR__ . '/../../order/mdl/mdl-lealtad-niveles.php';

class LoyaltyCron extends mdl {

    use LoyaltyCards, WhatsAppInbox, WhatsAppAgentFlow, WhatsAppReminders, LoyaltyWhatsApp,
        LoyaltyProgram, LoyaltyBirthday, LoyaltyWinback, LoyaltyLevels;

    const BIRTHDAYS = 200;                   // felicitaciones por corrida
    const WINBACKS  = 100;                   // «te extrañamos» por corrida (además del tope del día)
    const LEVELS    = 100;                   // cambios de nivel por corrida
    const HOURS     = [['10:00', '19:00']];  // sin horario guardado

    private $company = null;
    private $branch  = null;

    // -- Lo que los traits toman de la sesion: aqui, la empresa de la vuelta --

    protected function companyId() {
        return $this->company ? (int) $this->company['id'] : 0;
    }

    protected function branchId() {
        return $this->branch ? (int) $this->branch['id'] : 0;
    }

    protected function userId() {
        return null;
    }

    protected function scope() {
        return [
            'company_id' => $this->companyId(),
            'company'    => $this->company ? (string) $this->company['name'] : '',
            'branch_id'  => $this->branchId(),
            'branch'     => $this->branch ? (string) $this->branch['name'] : ''
        ];
    }

    protected function must($result, $what) {
        if ($result !== true) throw new RuntimeException($what . ': ' . (is_string($result) ? $result : 'sin respuesta de la base'));

        return true;
    }

    // Sin navegador no hay host: el enlace sale de WHATSAPP_PUBLIC_URL, que run() revisa antes.
    protected function loyaltyHostUrl($page, $token) {
        return '';
    }

    // -- Corrida --

    // $until (timestamp): no empieza otra empresa despues. Devuelve lo que salio.
    public function run($until) {
        $done = ['companies' => 0, 'birthdays' => 0, 'winbacks' => 0, 'levels' => 0, 'skipped' => ''];

        if ($this->loyaltyPublicBase() === '') {
            $this->inboxLog('[ LEALTAD ] :: la tarea de cada hora no corre: falta WHATSAPP_PUBLIC_URL (…/app/order) en el .env');

            return ['skipped' => 'WHATSAPP_PUBLIC_URL'] + $done;
        }

        foreach ($this->qLoyaltyCompaniesOn() as $row) {
            if (time() >= $until) break;

            try {
                $this->runCompany((int) $row['company_id'], $until, $done);
            } catch (Throwable $e) {
                $this->inboxLog("[ LEALTAD ] :: empresa {$row['company_id']} :: " . $e->getMessage());
            }
        }

        $this->company = $this->branch = null;

        return $done;
    }

    // Una empresa: su contexto, su horario y lo que tiene encendido. Cada pieza falla sola.
    private function runCompany($companyId, $until, array &$done) {
        $this->company = $this->qCompany($companyId);
        $this->branch  = $this->qFirstBranch($companyId);

        if (!$this->company || !$this->branch) return;

        $agent = $this->qWaReminderAgent($companyId);
        $now   = $this->inboxNow();

        if (!$agent || !$this->loyaltyInHours($agent, $now)) return;

        $setting = $this->qLoyaltySetting($companyId);
        $done['companies']++;

        if ((int) $setting['birthday_enabled'] === 1) {
            $this->piece($companyId, 'cumpleaños', function () use ($setting, $now, &$done) {
                $c = $this->loyaltyBirthdayRun(date('Y-m-d', $now), $setting, self::BIRTHDAYS);
                $done['birthdays'] += $c['sent'] + $c['simulated'];
            });
        }

        if ((int) $setting['winback_enabled'] === 1 && time() < $until) {
            $this->piece($companyId, 'te extrañamos', function () use ($setting, $now, &$done) {
                $c = $this->loyaltyWinbackRun($setting, self::WINBACKS, $now);
                $done['winbacks'] += $c['sent'] + $c['simulated'];
            });
        }

        if ((int) $setting['levels_enabled'] === 1 && time() < $until && $this->levelsDue($setting, $now)) {
            $this->piece($companyId, 'niveles', function () use (&$done) {
                $c = $this->loyaltyLevelReview(self::LEVELS);
                $done['levels'] += $c['up'] + $c['down'];
            });
        }
    }

    private function piece($companyId, $what, callable $fn) {
        try {
            $fn();
        } catch (Throwable $e) {
            $this->inboxLog("[ LEALTAD ] :: {$what} de la empresa {$companyId} :: " . $e->getMessage());
        }
    }

    // -- Reglas --

    // El horario del WhatsApp de la empresa, aunque el agente de IA este apagado. Sin horario: 10:00 a 19:00.
    protected function loyaltyInHours(array $agent, $ts) {
        $hours = json_decode((string) $agent['hours'], true);

        if (!is_array($hours) || !$hours) $agent['hours'] = json_encode(array_fill(0, 7, self::HOURS));

        return $this->inboxIsOpen(['enabled' => 1] + $agent, $ts);
    }

    // La revision del mes: si la ultima es de antes del dia 1. Nunca revisados: solo el dia 1.
    protected function levelsDue(array $setting, $ts) {
        $last = $setting['levels_reviewed_at'];

        if ($last === null || $last === '') return (int) date('j', $ts) === 1;

        return (string) $last < date('Y-m-01 00:00:00', $ts);
    }
}

if (defined('LOYALTY_CRON_NO_RUN')) return;

$lock = fopen(sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'huubie-lealtad.lock', 'c');

if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) exit(0);

try {
    $r = (new LoyaltyCron())->run(time() + 600);

    echo date('Y-m-d H:i:s') . ($r['skipped'] !== '' ? " · no corrio: falta {$r['skipped']}" : '')
       . " · empresas {$r['companies']} · cumpleaños {$r['birthdays']} · te extrañamos {$r['winbacks']} · niveles {$r['levels']}\n";
} finally {
    flock($lock, LOCK_UN);
    fclose($lock);
}
