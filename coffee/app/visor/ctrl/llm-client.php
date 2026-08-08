<?php
/**
 * Factory de proveedor LLM para CoffeeIA.
 *
 * Enrutado por el formato del id de modelo:
 *   - Empieza con 'opencode/' → OpenCode Zen/Go (ej "opencode/glm-5.2")
 *   - Contiene '/'            → OpenRouter   (ej "anthropic/claude-sonnet-4")
 *   - En otro caso            → Ollama Cloud (ej "qwen3-coder:480b-cloud")
 *
 * El prefijo de OpenCode se revisa PRIMERO porque tambien lleva diagonal. Sus ids
 * reales son pelones ('glm-5.2') y sin prefijo serian indistinguibles de los de
 * Ollama Cloud, que publica los mismos modelos con sufijo ':cloud'.
 *
 * Los tres clientes exponen chat($messages, $model, $opts) y devuelven una
 * estructura normalizada con message.content + usage/eval_count, de modo que
 * ctrl-coffeeia.php no necesita saber que proveedor respondio.
 */

function llm_is_opencode_model($model) {
    return is_string($model) && strncmp($model, 'opencode/', 9) === 0;
}

function llm_is_openrouter_model($model) {
    return is_string($model) && !llm_is_opencode_model($model) && strpos($model, '/') !== false;
}

/**
 * Devuelve el cliente adecuado para el modelo pedido.
 * @throws Exception si falta la API key del proveedor correspondiente.
 */
function llm_client_for($model) {
    if (llm_is_opencode_model($model)) {
        require_once __DIR__ . '/opencode-client.php';
        return new OpencodeClient();
    }
    if (llm_is_openrouter_model($model)) {
        require_once __DIR__ . '/openrouter-client.php';
        return new OpenRouterClient();
    }
    require_once __DIR__ . '/ollama-client.php';
    return new OllamaClient();
}

/** Nombre del proveedor para mensajes de error y trazas. */
function llm_provider_label($model) {
    if (llm_is_opencode_model($model))   return 'OpenCode';
    if (llm_is_openrouter_model($model)) return 'OpenRouter';
    return 'Ollama';
}

/**
 * ¿El proveedor cobra POR TOKEN? Decide que tan generoso puede ser el loop de
 * herramientas: en tarifa plana conviene dejar explorar, con cobro por token
 * cada ronda engorda el prompt y cuesta. OpenCode Go es plana con topes en
 * dolares y Ollama Cloud tambien, asi que solo OpenRouter entra aqui.
 */
function llm_is_metered_model($model) {
    return llm_is_openrouter_model($model);
}

/** Modelo de vision por defecto segun el proveedor del modelo activo. */
function llm_vision_model_for($model) {
    if (llm_is_opencode_model($model)) {
        require_once __DIR__ . '/opencode-config.php';
        return OPENCODE_VISION_MODEL;
    }
    if (llm_is_openrouter_model($model)) {
        return defined('OPENROUTER_VISION_MODEL') ? OPENROUTER_VISION_MODEL : 'google/gemini-2.0-flash-001';
    }
    return defined('OLLAMA_VISION_MODEL') ? OLLAMA_VISION_MODEL : 'kimi-k2.7-code:cloud';
}
