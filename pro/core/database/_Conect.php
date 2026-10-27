<?php
/*  La zona horaria va aquí arriba y no dentro de connect().

    Estaba dentro, y eso dejaba en UTC a todo el que aún no hubiera hecho una
    consulta —php.ini tiene date.timezone="UTC"—. coffeeIA arma el "hoy" que
    le pasa al modelo antes de tocar la base, así que le decía seis horas de
    más: a las 16:38 creía que eran las 22:38 y daba por pasadas las 5. */
require_once(__DIR__.'/../helpers/_Zona.php');
	class Conection {
		protected $mysql;
        protected $connected = false;

		public function connect() {
            if (!$this->connected) {
                // __DIR__ y no una ruta relativa: parse_ini_file resuelve contra el
                // directorio de trabajo del script que corre, no contra este archivo.
                // Desde auth/ctrl/ una ruta '../config/.env' apuntaria a auth/config/.env.
                $envPath = __DIR__.'/../config/.env';

                if (!is_readable($envPath)) {
                    $this->writeToLog("[ ERROR CONECT ] :: No se encontró el archivo de configuración: {$envPath}\nCopia .env.example como .env y llena las llaves DB_*.");
                    return;
                }

                $env = parse_ini_file($envPath);

                if ($env === false) {
                    $this->writeToLog("[ ERROR CONECT ] :: El archivo .env no se pudo interpretar: {$envPath}");
                    return;
                }

                $host = $env['DB_HOST'] ?? null;
                $user = $env['DB_USER'] ?? null;
                $pass = $env['DB_PASS'] ?? '';
                $db   = $env['DB_NAME'] ?? null;

                // Sin estas tres no hay conexion posible. Se corta aqui para no
                // arrastrar warnings de PHP hacia el JSON de respuesta.
                if ($host === null || $user === null || $db === null) {
                    $this->writeToLog("[ ERROR CONECT ] :: Faltan DB_HOST, DB_USER o DB_NAME en {$envPath}");
                    return;
                }

                //  La opción especifica que se debe ejecutar el comando "SET NAMES utf8" para asegurarse de que la conexión use la codificación de caracteres UTF-8.
                $opc = array(
                        PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8mb4',
                    );

                try {
                    $this->mysql = new PDO("mysql:host={$host};dbname={$db}", $user, $pass, $opc);
                    $this->mysql->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                    $this->connected = true;
                } catch (PDOException $e) {
                    $message =  "[ ERROR CONECT ] :: ". $e->getMessage();
                    $this->writeToLog($message);
                }
            }
		}
        // Cerrar conexiones
        public function disconnect() {
            if ($this->connected) {
                $this->mysql = null; // Cierra la conexión
                $this->connected = false; // Establecer la bandera de conexión a false
            }
        }

        function writeToLog($message) {
            $logFile = 'error.log';
            $this->crearArchivoLog($logFile);
            
            // Formato del mensaje: [Fecha y hora] Mensaje de error
            $logMessage  = "[ ".date('Y-m-d H:i:s'). " ]";
            $logMessage .= "\n[ UNIX_USR ] :: " . trim(exec('whoami'));
            $logMessage .= "\n[ WINDOWS_USR ] :: " . trim(exec('echo %USERNAME%'));
            $logMessage .= "\n$message" . PHP_EOL;
            
            // Obtener el contenido actual del archivo
            $currentContent = file_get_contents($logFile);

            // Agregar el nuevo mensaje al principio
            $newContent = $logMessage . "\n" . $currentContent;

            // Escribir el nuevo contenido en el archivo
            file_put_contents($logFile, $newContent);
            // Escribir el mensaje en el archivo de registro
            //file_put_contents($logFile, $logMessage, FILE_APPEND);
        }

        function crearArchivoLog($filename) {
            // Verificar si el archivo existe
            if (!file_exists($filename)) {
                // Crear el archivo y establecer permisos adecuados
                $file = fopen($filename, 'w');
                fclose($file);
        
                // Asignar permisos adecuados al archivo (por ejemplo, 0644) - el propietario puede leer y escribir, otros solo pueden leer
                chmod($filename, 0644);
            }
        }
	}
?>