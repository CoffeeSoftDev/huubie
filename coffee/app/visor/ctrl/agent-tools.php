<?php
/**
 * Specs (formato OpenAI) de las herramientas del CEREBRO del agente.
 *
 * Van al mismo catalogo que las demas builtin (tools-registry.php) con source 'brain':
 * se activan, se desactivan y se asignan por agente desde Configuracion -> Herramientas,
 * igual que list_dir o run_select. Su logica vive en agent-brain.php.
 *
 * La descripcion de cada una es parte del contrato con el modelo: es lo unico que lee
 * para decidir si la llama. Por eso dicen CUANDO usarla, no solo que hace.
 */

function brain_tool_specs() {
    return [
        [
            'type' => 'function',
            'function' => [
                'name'        => 'read_rules',
                'description' => 'Lee uno de TUS archivos de reglas o conocimiento. El indice de los que tienes '
                               . 'disponibles esta en tu prompt, en la seccion "Archivos de reglas". Lee el que '
                               . 'corresponda ANTES de escribir codigo del tipo que ese archivo regula; si es muy '
                               . 'grande, paginalo con offset/limit. No leas archivos que no necesites para la tarea actual.',
                'parameters'  => [
                    'type' => 'object',
                    'properties' => [
                        'name'   => ['type' => 'string',  'description' => 'Nombre del archivo tal como aparece en tu indice, ej: grimorio-huubie-ui.md'],
                        'offset' => ['type' => 'integer', 'description' => 'Opcional. Linea inicial (1-based) para leer por partes un archivo grande.'],
                        'limit'  => ['type' => 'integer', 'description' => 'Opcional. Numero de lineas a leer desde offset; sin limit se lee hasta el final.'],
                    ],
                    'required' => ['name'],
                ],
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name'        => 'save_memory',
                'description' => 'Guarda un hecho importante en tu memoria persistente para FUTURAS conversaciones '
                               . 'con este usuario: preferencias, decisiones tomadas, datos del proyecto. No guardes '
                               . 'trivialidades, saludos, ni nada que ya este en tus reglas o en tu prompt.',
                'parameters'  => [
                    'type' => 'object',
                    'properties' => [
                        'content' => ['type' => 'string', 'description' => 'El hecho a recordar, breve y autocontenido (max 500 caracteres). Ej: El usuario prefiere iconos lucide, nunca emojis.'],
                    ],
                    'required' => ['content'],
                ],
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name'        => 'forget_memory',
                'description' => 'Elimina una memoria persistente obsoleta o incorrecta. Usala cuando el usuario '
                               . 'corrija un dato que tenias guardado o cuando una memoria deje de aplicar.',
                'parameters'  => [
                    'type' => 'object',
                    'properties' => [
                        'id' => ['type' => 'integer', 'description' => 'Id de la memoria: el numero entre corchetes en la seccion "Memoria persistente" de tu prompt.'],
                    ],
                    'required' => ['id'],
                ],
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name'        => 'write_rule',
                'description' => 'Crea o actualiza uno de TUS archivos de reglas (los que lees con read_rules). '
                               . 'Usalo para registrar convenciones, decisiones o aprendizajes reutilizables. Solo '
                               . 'escribes sobre tus propios archivos, nunca sobre los que otro agente te compartio.',
                'parameters'  => [
                    'type' => 'object',
                    'properties' => [
                        'name'        => ['type' => 'string', 'description' => 'Nombre del archivo, ej: CONVENCIONES.md. Si ya tienes uno con ese nombre, lo actualiza.'],
                        'content'     => ['type' => 'string', 'description' => 'Contenido del archivo en markdown (max 20000 caracteres).'],
                        'description' => ['type' => 'string', 'description' => 'Opcional. Descripcion corta de para que sirve; aparece en tu indice de reglas.'],
                        'mode'        => ['type' => 'string', 'description' => 'Opcional: overwrite (default) reemplaza el contenido; append lo agrega al final.'],
                    ],
                    'required' => ['name', 'content'],
                ],
            ],
        ],
    ];
}

/** Apariencia de cada una en el catalogo de Configuracion -> Herramientas. */
function brain_tool_catalog() {
    return [
        [
            'name'        => 'read_rules',
            'label'       => 'Leer sus reglas',
            'description' => 'Abre un archivo de reglas del agente. Al prompt solo viaja el indice; el contenido se lee bajo demanda.',
            'category'    => 'Cerebro',
            'icon'        => 'book-open',
            'source'      => 'brain',
        ],
        [
            'name'        => 'save_memory',
            'label'       => 'Guardar memoria',
            'description' => 'Guarda un hecho que persiste entre conversaciones (por agente y usuario).',
            'category'    => 'Cerebro',
            'icon'        => 'brain',
            'source'      => 'brain',
        ],
        [
            'name'        => 'forget_memory',
            'label'       => 'Olvidar memoria',
            'description' => 'Elimina una memoria obsoleta o incorrecta por su id.',
            'category'    => 'Cerebro',
            'icon'        => 'eraser',
            'source'      => 'brain',
        ],
        [
            'name'        => 'write_rule',
            'label'       => 'Escribir una regla',
            'description' => 'Crea o mejora un archivo de reglas propio del agente.',
            'category'    => 'Cerebro',
            'icon'        => 'notebook-pen',
            'source'      => 'brain',
        ],
    ];
}
