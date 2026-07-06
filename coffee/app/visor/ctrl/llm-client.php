<?php
/**
 * Factory de proveedor LLM para CoffeeIA.
 *
 * Enrutado por el formato del id de modelo:
 *   - Contiene '/'  → OpenRouter   (ej "anthropic/claude-sonnet-4", "openai/gpt-4o-mini")
 *   - En otro caso  → Ollama Cloud (ej "qwen3-coder:480b-cloud")
 *
 * Ambos clientes exponen chat($messages, $model, $opts) y devuelven una
 * estructura normalizada con message.content + usage/eval_count, de modo que
 * ctrl-coffeeia.php no necesita saber que proveedor respondio.
 */

function llm_is_openrouter_model($model) {
    return is_string($model) && strpos($model, '/') !== false;
}

/**
 * Devuelve el cliente adecuado para el modelo pedido.
 * @throws Exception si falta la API key del proveedor correspondiente.
 */
function llm_client_for($model) {
    if (llm_is_openrouter_model($model)) {
        require_once __DIR__ . '/openrouter-client.php';
        return new OpenRouterClient();
    }
    require_once __DIR__ . '/ollama-client.php';
    return new OllamaClient();
}

/** Modelo de vision por defecto segun el proveedor del modelo activo. */
function llm_vision_model_for($model) {
    if (llm_is_openrouter_model($model)) {
        return defined('OPENROUTER_VISION_MODEL') ? OPENROUTER_VISION_MODEL : 'google/gemini-2.0-flash-001';
    }
    return defined('OLLAMA_VISION_MODEL') ? OLLAMA_VISION_MODEL : 'kimi-k2.7-code:cloud';
}
