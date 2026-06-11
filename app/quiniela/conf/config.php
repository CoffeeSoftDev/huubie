<?php
/**
 * Config de la Quiniela IA. Define QUE dos modelos comparar y su etiqueta visible.
 *
 * Las API keys estan centralizadas en coffee/app/credentials/.env y las leen
 * los clientes del visor (coffee/app/visor). El proveedor se decide por el id
 * del modelo (igual que el visor, ver llm-client.php):
 *   - con '/'  -> OpenRouter   (necesita OPENROUTER_API_KEY)
 *   - sin '/'  -> Ollama Cloud (necesita OLLAMA_API_KEY)  <- usamos esta via
 *
 * Ambos modelos van por Ollama Cloud (la OLLAMA_API_KEY ya esta configurada).
 * MiniMax y GPT-OSS estan disponibles como tags de Ollama (ver "ollama list" cloud).
 */
return [
    'models' => [
        'minimax' => 'minimax-m3',   // MiniMax 3.0
        'ollama'  => 'gemma4:31b-cloud', // modelo abierto de OpenAI
    ],

    // Etiqueta visible de cada columna en la UI.
    'labels' => [
        'minimax' => 'MiniMax 3.0',
        'ollama'  => 'Gemma',
    ],

    // Opciones de muestreo comunes a ambos proveedores.
    'options' => ['temperature' => 0.7],
];
