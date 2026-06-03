<?php
/**
 * Helper compartido de resolucion de rutas del Visor / Playground.
 *
 * Resuelve el home del usuario donde vive `.claude`, de forma robusta incluso
 * cuando Apache corre como servicio (cuenta SYSTEM), caso en que USERPROFILE
 * apunta a C:\WINDOWS\system32\config\systemprofile y NO encuentra los agentes.
 *
 * Orden de resolucion:
 *   1) Override explicito por env COFFEE_CLAUDE_HOME (home o ruta directa a .claude).
 *   2) USERPROFILE/HOME si ya contiene .claude/agents (caso normal de escritorio).
 *   3) Escaneo de C:\Users\* buscando el primer perfil con .claude/agents.
 *   4) Fallback: USERPROFILE/HOME tal cual (comportamiento previo).
 */
if (!function_exists('coffee_user_home')) {
    function coffee_user_home() {
        static $cached = null;
        if ($cached !== null) return $cached;

        $norm = function ($p) { return rtrim(str_replace('\\', '/', (string) $p), '/'); };

        // 1) Override explicito
        $override = getenv('COFFEE_CLAUDE_HOME');
        if ($override) {
            $o = $norm($override);
            if (is_dir($o . '/.claude/agents')) return $cached = $o;
            if (is_dir($o . '/agents'))         return $cached = dirname($o);
        }

        // 2) USERPROFILE/HOME normal
        $home = $norm(getenv('USERPROFILE') ?: getenv('HOME') ?: '');
        if ($home !== '' && is_dir($home . '/.claude/agents')) {
            return $cached = $home;
        }

        // 3) Apache como servicio: buscar el perfil real en C:\Users\*
        $drive = $norm(getenv('SystemDrive') ?: 'C:');
        $usersRoot = $drive . '/Users';
        if (is_dir($usersRoot)) {
            $skip = ['.', '..', 'Public', 'Default', 'Default User', 'All Users'];
            foreach (@scandir($usersRoot) ?: [] as $u) {
                if (in_array($u, $skip, true)) continue;
                $cand = $usersRoot . '/' . $u;
                if (is_dir($cand . '/.claude/agents')) return $cached = $cand;
            }
        }

        // 4) Fallback al comportamiento previo
        return $cached = $home;
    }
}
