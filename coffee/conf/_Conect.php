<?php
	class Conection {
		protected $mysql;
        protected $connected = false;

		public function connect() {
            if (!$this->connected) {
                $host = "localhost";
                $user = "root";
                $pass = "";
                // $user = "fayxzvov_sl";
                // $pass = "@GVsl_1234";
                $db   = "fayxzvov_alpha";
                
                //  La opción especifica que se debe ejecutar el comando "SET NAMES utf8" para asegurarse de que la conexión use la codificación de caracteres UTF-8.
                $opc = array(
                        PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8',
                    );

                try {
                    $this->mysql = new PDO('mysql:host=localhost;dbname='.$db,$user,$pass,$opc);
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