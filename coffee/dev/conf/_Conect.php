<?php
	class Conection {
		protected $mysql;
        protected $connected = false;
        protected $inTransaction = false;

		public function connect() {
            if (!$this->connected) {
                $conf = require(__DIR__ . '/_conf.php');
                $host = $conf['host'];
                $user = $conf['user'];
                $pass = $conf['pass'];
                $db   = $conf['database'];

                // La opción especifica que se debe ejecutar el comando "SET NAMES utf8" para asegurarse de que la conexión use la codificación de caracteres UTF-8.
                $opc = array(
                        PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8',
                    );

                try {
                    $this->mysql = new PDO('mysql:host='.$host.';dbname='.$db,$user,$pass,$opc);
                    $this->mysql->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                    $this->connected = true;
                } catch (PDOException $e) {
                    $message =  "[ ERROR CONECT ] :: ". $e->getMessage();
                    $this->writeToLog($message);
                    // Lanzar la excepción para que el error sea visible
                    throw new Exception("Error de conexión a la base de datos: " . $e->getMessage());
                }
            }
		}
        // Cerrar conexiones
        public function disconnect() {
            // Si hay una transaccion abierta NO se cierra la conexion: las transacciones
            // viven en una sola conexion, y _CUD/_Read llaman disconnect() al final de cada
            // llamada. Sin este guardia, la transaccion moriria entre escritura y escritura.
            if ($this->inTransaction) return;
            if ($this->connected) {
                $this->mysql = null; // Cierra la conexión
                $this->connected = false; // Establecer la bandera de conexión a false
            }
        }

        // ─────────────────────────────────────────────────────────────────
        //  TRANSACCIONES (atomicidad: "todo o nada")
        //  Aditivo y retrocompatible: mientras nadie llame beginTransaction(),
        //  $inTransaction queda en false y connect/disconnect se comportan igual
        //  que siempre para el resto del sistema.
        // ─────────────────────────────────────────────────────────────────

        // Abre una transaccion sobre una unica conexion que se mantiene viva hasta
        // commit() o rollback(). Idempotente: si ya hay una activa, no la anida.
        public function beginTransaction() {
            if ($this->inTransaction) return;
            $this->connect();
            if (!$this->connected) return; // si fallo la conexion, no marcar transaccion
            $this->mysql->beginTransaction();
            $this->inTransaction = true;
        }

        // Confirma TODAS las escrituras de la transaccion de una sola vez.
        public function commit() {
            if (!$this->inTransaction) return;
            $this->mysql->commit();
            $this->inTransaction = false;
            $this->disconnect(); // ya no hay transaccion: cierra de verdad
        }

        // Deshace TODAS las escrituras de la transaccion (deja la base como estaba).
        public function rollback() {
            if (!$this->inTransaction) return;
            $this->mysql->rollBack();
            $this->inTransaction = false;
            $this->disconnect();
        }

        // Envoltorio de conveniencia: ejecuta $fn dentro de una transaccion y hace
        // commit si todo sale bien, o rollback si $fn lanza cualquier excepcion. Asi
        // las funciones de negocio NO repiten el begin/try/commit/catch/rollback.
        //   return $this->transaction(function () { ...escrituras...; return [...]; });
        public function transaction(callable $fn) {
            $this->beginTransaction();
            try {
                $result = $fn();
                $this->commit();
                return $result;
            } catch (\Throwable $e) {
                $this->rollback();
                throw $e; // se relanza para que el controlador decida la respuesta
            }
        }

        function writeToLog($message) {
            $logFile = 'error.log';
            $this->crearArchivoLog($logFile);

            // Formato del mensaje: [Fecha y hora] Mensaje de error
            date_default_timezone_set('America/Mexico_City');
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
