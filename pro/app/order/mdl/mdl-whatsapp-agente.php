<?php
/*  F1 · Agente de WhatsApp: lo que el webhook escribe en la base.
    Lo usa ctrl-whatsapp-webhook.php sobre la clase mdl (mdl-order.php).

      wa_agent    el numero de cada empresa (phone_number_id de Meta).
      wa_chat     una conversacion por empresa y telefono.
      wa_message  cada mensaje; provider_id (el wamid) es unico.

    Las escrituras solo se llaman dentro de transaction(): ahi un error de la
    base sube como excepcion y se deshace todo el mensaje. */
trait WhatsAppInbox {

    // n = 0: el numero no esta dado de alta. null = la base no contesto.
    protected function qWaAgentByNumber($phoneNumberId) {
        return $this->qRow("
            SELECT COUNT(*) AS n, MAX(company_id) AS company_id
            FROM {$this->pos}wa_agent
            WHERE phone_number_id = ?
        ", [$phoneNumberId]);
    }

    /*  Crea el chat si falta y lo deja bloqueado hasta el commit: dos avisos del
        mismo telefono se forman uno detras del otro. El nombre del perfil solo
        se cambia si llega uno. Devuelve el id, o 0. */
    protected function qWaLockChat($companyId, $phone, $waId, $name, $now) {
        $this->qWaRun("
            INSERT INTO {$this->pos}wa_chat (company_id, phone, wa_id, name, mode, opt_out, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'agent', 0, ?, ?)
            ON DUPLICATE KEY UPDATE
                wa_id = VALUES(wa_id),
                name  = IF(VALUES(name) = '', name, VALUES(name))
        ", [$companyId, $phone, $waId, $name, $now, $now]);

        $row = $this->qRow("
            SELECT id
            FROM {$this->pos}wa_chat
            WHERE company_id = ? AND phone = ?
            LIMIT 1
            FOR UPDATE
        ", [$companyId, $phone]);

        return $row === null ? 0 : (int) $row['id'];
    }

    protected function qWaMessageExists($providerId) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}wa_message
            WHERE provider_id = ?
        ", [$providerId]) > 0;
    }

    protected function qCreateWaMessage($array) {
        return $this->qInsertInto('wa_message', $array);
    }

    // last_in_at y last_message_at nunca van hacia atras: un aviso viejo que llega tarde no las mueve.
    protected function qWaTouchChat($chatId, $sentAt, $now) {
        $this->qWaRun("
            UPDATE {$this->pos}wa_chat
            SET last_in_at      = GREATEST(IFNULL(last_in_at, ?), ?),
                last_message_at = GREATEST(IFNULL(last_message_at, ?), ?),
                updated_at      = ?
            WHERE id = ?
        ", [$sentAt, $sentAt, $sentAt, $sentAt, $now, $chatId]);
    }

    // _CUD directo (varios ? en una misma expresion; _Update no los cuenta bien).
    private function qWaRun($query, array $data) {
        if ($this->_CUD($query, $data) !== true) {
            throw new RuntimeException('wa_chat: la base no acepto la escritura');
        }
    }
}
