<?php
/*  EL WEBHOOK DE STRIPE. En el panel de Stripe (Developers › Webhooks) se da de
    alta esta URL con los eventos:

      checkout.session.completed
      checkout.session.async_payment_succeeded
      invoice.paid
      invoice.payment_failed
      customer.subscription.deleted

    y el secreto que da (whsec_...) va en core/config/.env como
    STRIPE_WEBHOOK_SECRET. En local: stripe listen --forward-to <esta URL>.

    Aqui no hay sesion ni usuario: lo unico que prueba que esto lo mando Stripe
    es la firma, y se revisa sobre el cuerpo CRUDO (por eso php://input y no
    $_POST). Sin firma valida, 400 y no se toca nada. */
require_once __DIR__ . '/../../core/billing/_Billing.php';

$event = Stripe::event(file_get_contents('php://input'), $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '');

if ($event === null) {
    http_response_code(400);
    exit('Firma no válida.');
}

// 200 = atendido. Cualquier otra cosa y Stripe lo reintenta mas tarde.
try {
    $ok = (new Billing(3))->handle($event);
} catch (\Throwable $e) {
    $ok = false;
}

http_response_code($ok ? 200 : 500);
echo $ok ? 'ok' : 'error';
