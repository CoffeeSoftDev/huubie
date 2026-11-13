-- =============================================================================
-- Nombres del catalogo con mayusculas parejas
-- Fecha:     13/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  nada
-- Rollback:  2026-11-13_nombres-catalogo-rollback.sql
--
-- Antes:  «PASTELES ESPECIALIDADES», «gelatina de cafe», «Lilis de Crema batida»
-- Despues «Pasteles Especialidades», «Gelatina de Cafe», «Lilis de Crema Batida»
--
-- Regla: la misma catalogName() de pro/app/catalogo/ctrl/core-catalogo.php,
-- que ya aplica al guardar desde el Catalogo. Generada contra la BD local.
-- Filas que cambian (sin pasteles personalizados, is_custom = 1):
--   category          11 de 12
--   subcategory        0 de 0
--   product          128 de 186
--   modifier_group     6 de 13
--   modifier         113 de 228
--   payment_method     0 de 3
--   discount_reason    5 de 5
--
-- Solo filas de datos: no cambia estructura.
-- Cada UPDATE va por id y con el nombre exacto de antes (BINARY): si alguien
-- ya lo cambio, esa fila no se toca. Se puede volver a correr.
-- En otra BD, la fila cuyo id o nombre no coincida simplemente no cambia;
-- los nombres que se capturen despues ya entran parejos por catalogName().
-- =============================================================================

-- category (11)
UPDATE fayxzvov_pos.category SET name = 'Pasteles Especialidades' WHERE id = 1 AND BINARY name = 'PASTELES ESPECIALIDADES';
UPDATE fayxzvov_pos.category SET name = 'Pasteles Tradicionales' WHERE id = 2 AND BINARY name = 'PASTELES TRADICIONALES';
UPDATE fayxzvov_pos.category SET name = 'Galletas' WHERE id = 3 AND BINARY name = 'GALLETAS';
UPDATE fayxzvov_pos.category SET name = 'Pasteles de 3 Leches' WHERE id = 4 AND BINARY name = 'PASTELES DE 3 LECHES';
UPDATE fayxzvov_pos.category SET name = 'Pan' WHERE id = 5 AND BINARY name = 'PAN';
UPDATE fayxzvov_pos.category SET name = 'Sobre Pedido' WHERE id = 7 AND BINARY name = 'SOBRE PEDIDO';
UPDATE fayxzvov_pos.category SET name = 'Charolas' WHERE id = 8 AND BINARY name = 'CHAROLAS ';
UPDATE fayxzvov_pos.category SET name = 'Postres' WHERE id = 9 AND BINARY name = 'POSTRES ';
UPDATE fayxzvov_pos.category SET name = 'Bocadillos' WHERE id = 10 AND BINARY name = 'BOCADILLOS';
UPDATE fayxzvov_pos.category SET name = 'Decoraciones' WHERE id = 11 AND BINARY name = 'DECORACIONES ';
UPDATE fayxzvov_pos.category SET name = 'Pasteles de 3 Leches' WHERE id = 12 AND BINARY name = 'PASTELES DE 3 LECHES';

-- product (128)
UPDATE fayxzvov_pos.product SET name = 'Bolsa de Chispas de Chocolate' WHERE id = 9 AND BINARY name = 'BOLSA DE CHISPAS DE CHOCOLATE';
UPDATE fayxzvov_pos.product SET name = 'Volovanes de Pollo Enchipotlado' WHERE id = 45 AND BINARY name = 'VOLOVANES DE POLLO ENCHIPOTLADO';
UPDATE fayxzvov_pos.product SET name = 'Volovan de Jamon con Queso' WHERE id = 46 AND BINARY name = 'VOLOVAN DE JAMON CON QUESO';
UPDATE fayxzvov_pos.product SET name = 'Chino' WHERE id = 47 AND BINARY name = 'CHINO';
UPDATE fayxzvov_pos.product SET name = 'Cupcake Relleno de Limon' WHERE id = 48 AND BINARY name = 'CUPCAKE RELLENO DE LIMON';
UPDATE fayxzvov_pos.product SET name = 'Empanadas Dulces de Vitrina' WHERE id = 49 AND BINARY name = 'EMPANADAS DULCES DE VITRINA';
UPDATE fayxzvov_pos.product SET name = 'Charola Casual' WHERE id = 50 AND BINARY name = 'CHAROLA CASUAL';
UPDATE fayxzvov_pos.product SET name = 'Charola Basica' WHERE id = 51 AND BINARY name = 'CHAROLA BASICA';
UPDATE fayxzvov_pos.product SET name = 'Charola Suprema' WHERE id = 52 AND BINARY name = 'CHAROLA SUPREMA';
UPDATE fayxzvov_pos.product SET name = 'Charola Cumpleañera' WHERE id = 53 AND BINARY name = 'CHAROLA CUMPLEAÑERA';
UPDATE fayxzvov_pos.product SET name = 'Charola Reginas Sweet' WHERE id = 54 AND BINARY name = 'CHAROLA REGINAS SWEET';
UPDATE fayxzvov_pos.product SET name = 'Chocoflan' WHERE id = 55 AND BINARY name = 'CHOCOFLAN';
UPDATE fayxzvov_pos.product SET name = 'Pay' WHERE id = 56 AND BINARY name = 'PAY';
UPDATE fayxzvov_pos.product SET name = 'Tarta de Limon con Merengue Gde' WHERE id = 57 AND BINARY name = 'TARTA DE LIMON CON MERENGUE GDE';
UPDATE fayxzvov_pos.product SET name = 'Tarta Limon con Merengue' WHERE id = 58 AND BINARY name = 'TARTA LIMON CON MERENGUE';
UPDATE fayxzvov_pos.product SET name = 'Tarta Limon sin Hornear' WHERE id = 59 AND BINARY name = 'TARTA LIMON SIN HORNEAR';
UPDATE fayxzvov_pos.product SET name = 'Tarta Manjar con Frutas' WHERE id = 60 AND BINARY name = 'TARTA MANJAR CON FRUTAS';
UPDATE fayxzvov_pos.product SET name = 'Tarta de Cremoso de Queso con Fresa' WHERE id = 61 AND BINARY name = 'TARTA DE CREMOSO DE QUESO CON FRESA';
UPDATE fayxzvov_pos.product SET name = 'Gelatina de Cafe' WHERE id = 62 AND BINARY name = 'gelatina de cafe';
UPDATE fayxzvov_pos.product SET name = 'Gelatina de Mosaico' WHERE id = 63 AND BINARY name = 'Gelatina de mosaico';
UPDATE fayxzvov_pos.product SET name = 'Torta de Pan Dulce' WHERE id = 64 AND BINARY name = 'TORTA DE PAN DULCE';
UPDATE fayxzvov_pos.product SET name = 'Bolillo Integral' WHERE id = 65 AND BINARY name = 'BOLILLO INTEGRAL';
UPDATE fayxzvov_pos.product SET name = 'Cuerno de Jamon con Queso Amarillo' WHERE id = 66 AND BINARY name = 'CUERNO DE JAMON CON QUESO AMARILLO';
UPDATE fayxzvov_pos.product SET name = 'Cuerno de Atun' WHERE id = 67 AND BINARY name = 'CUERNO DE ATUN';
UPDATE fayxzvov_pos.product SET name = 'Cuerno de Finas Hierbas' WHERE id = 68 AND BINARY name = 'CUERNO DE FINAS HIERBAS';
UPDATE fayxzvov_pos.product SET name = 'Cuerno Relleno de Parmesano' WHERE id = 69 AND BINARY name = 'CUERNO RELLENO DE PARMESANO';
UPDATE fayxzvov_pos.product SET name = 'Cuerno Relleno de Jamon y Vegetales' WHERE id = 70 AND BINARY name = 'CUERNO RELLENO DE JAMON Y VEGETALES';
UPDATE fayxzvov_pos.product SET name = 'Cuernito Relleno de Pepperoni' WHERE id = 71 AND BINARY name = 'CUERNITO RELLENO DE PEPPERONI';
UPDATE fayxzvov_pos.product SET name = 'Mini Berlineza de Cajeta 1PZ' WHERE id = 72 AND BINARY name = 'MINI BERLINEZA DE CAJETA 1PZ';
UPDATE fayxzvov_pos.product SET name = 'Mini Berlinesa Crema Pastelera 15PZ' WHERE id = 73 AND BINARY name = 'MINI BERLINESA CREMA PASTELERA 15PZ';
UPDATE fayxzvov_pos.product SET name = 'Mini Berlinesa Zzarzamora 15PZ' WHERE id = 74 AND BINARY name = 'MINI BERLINESA ZZARZAMORA 15PZ';
UPDATE fayxzvov_pos.product SET name = 'Mini Berlinesa Rellena de Cajeta 15 pz' WHERE id = 75 AND BINARY name = 'MINI BERLINESA RELLENA DE CAJETA 15 PZ';
UPDATE fayxzvov_pos.product SET name = 'Mini Berlinesa Cubierta de Chocolate c/ Relleno 15PZ' WHERE id = 76 AND BINARY name = 'MINI BERLINESA CUBIERTA DE CHOCOLATE C/ RELLENO 15PZ';
UPDATE fayxzvov_pos.product SET name = 'Salchicha en Hojaldre pz' WHERE id = 77 AND BINARY name = 'SALCHICHA EN HOJALDRE PZ';
UPDATE fayxzvov_pos.product SET name = 'Trufas de Nuez pz' WHERE id = 78 AND BINARY name = 'TRUFAS DE NUEZ PZ';
UPDATE fayxzvov_pos.product SET name = 'Trufas con Pan pz' WHERE id = 79 AND BINARY name = 'TRUFAS CON PAN PZ';
UPDATE fayxzvov_pos.product SET name = 'Brochetas de Carnes Frias con Queso y Aceitunas pz' WHERE id = 80 AND BINARY name = 'BROCHETAS DE CARNES FRIAS CON QUESO Y ACEITUNAS PZ';
UPDATE fayxzvov_pos.product SET name = 'Pz de Rollito de Jamon con Queso' WHERE id = 81 AND BINARY name = 'PZ DE ROLLITO DE JAMON CON QUESO';
UPDATE fayxzvov_pos.product SET name = 'Pz Serpentina' WHERE id = 82 AND BINARY name = 'PZ SERPENTINA';
UPDATE fayxzvov_pos.product SET name = 'Pz Figuer Sandwich' WHERE id = 83 AND BINARY name = 'PZ FIGUER SANDWICH';
UPDATE fayxzvov_pos.product SET name = 'Pz Volovan Mousse de Ostion Ahumado' WHERE id = 84 AND BINARY name = 'PZ VOLOVAN MOUSSE DE OSTION AHUMADO';
UPDATE fayxzvov_pos.product SET name = 'Volovan Mousse de Queso c/ Finas Hiervas' WHERE id = 85 AND BINARY name = 'VOLOVAN MOUSSE DE QUESO C/ FINAS HIERVAS';
UPDATE fayxzvov_pos.product SET name = 'Pz Volovan Camaron c/ Queso Philadelphia' WHERE id = 86 AND BINARY name = 'PZ VOLOVAN CAMARON C/ QUESO PHILADELPHIA';
UPDATE fayxzvov_pos.product SET name = 'Cupcake de Chocolate pz' WHERE id = 87 AND BINARY name = 'CUPCAKE DE CHOCOLATE PZ';
UPDATE fayxzvov_pos.product SET name = 'Cupcake de Vainilla pz' WHERE id = 88 AND BINARY name = 'CUPCAKE DE VAINILLA PZ';
UPDATE fayxzvov_pos.product SET name = 'Cupcake Relleno de Limo pz' WHERE id = 89 AND BINARY name = 'CUPCAKE RELLENO DE LIMO PZ';
UPDATE fayxzvov_pos.product SET name = 'Pz de Cupcake Cheesecake' WHERE id = 90 AND BINARY name = 'PZ DE CUPCAKE CHEESECAKE';
UPDATE fayxzvov_pos.product SET name = 'Extra al Cupcake Relleno de Fresa' WHERE id = 91 AND BINARY name = 'EXTRA AL CUPCAKE RELLENO DE FRESA';
UPDATE fayxzvov_pos.product SET name = 'Extra al Cupcake Relleno de Nutella' WHERE id = 92 AND BINARY name = 'EXTRA AL CUPCAKE RELLENO DE NUTELLA';
UPDATE fayxzvov_pos.product SET name = 'Extra al Cupcake Relleno de Ferrero' WHERE id = 93 AND BINARY name = 'EXTRA AL CUPCAKE RELLENO DE FERRERO';
UPDATE fayxzvov_pos.product SET name = 'Extra al Cupcake Relleno de Rafaello' WHERE id = 94 AND BINARY name = 'EXTRA AL CUPCAKE RELLENO DE RAFAELLO';
UPDATE fayxzvov_pos.product SET name = 'Pz de Mini Carlota de Fresa' WHERE id = 95 AND BINARY name = 'PZ DE MINI CARLOTA DE FRESA';
UPDATE fayxzvov_pos.product SET name = 'Pz de Mini Carlolta de Queso con Cafe' WHERE id = 96 AND BINARY name = 'PZ DE MINI CARLOLTA DE QUESO CON CAFE';
UPDATE fayxzvov_pos.product SET name = 'Galleta Personalizada' WHERE id = 97 AND BINARY name = 'GALLETA PERSONALIZADA';
UPDATE fayxzvov_pos.product SET name = 'Bolsa de Celofan' WHERE id = 98 AND BINARY name = 'BOLSA DE CELOFAN';
UPDATE fayxzvov_pos.product SET name = 'Bolsa de Celofan con Moño' WHERE id = 99 AND BINARY name = 'BOLSA DE CELOFAN CON MOÑO';
UPDATE fayxzvov_pos.product SET name = 'Caja de Carton' WHERE id = 100 AND BINARY name = 'CAJA DE CARTON';
UPDATE fayxzvov_pos.product SET name = 'Envio a Domicilio' WHERE id = 101 AND BINARY name = 'ENVIO A DOMICILIO';
UPDATE fayxzvov_pos.product SET name = 'Tarta Pie de Queso con Nuez' WHERE id = 102 AND BINARY name = 'TARTA PIE DE QUESO CON NUEZ';
UPDATE fayxzvov_pos.product SET name = 'Tarta de Manzana' WHERE id = 103 AND BINARY name = 'TARTA DE MANZANA';
UPDATE fayxzvov_pos.product SET name = 'Tarta de Crumble de Frutos Rojos' WHERE id = 104 AND BINARY name = 'TARTA DE CRUMBLE DE FRUTOS ROJOS';
UPDATE fayxzvov_pos.product SET name = 'Tarta de Zarzamora C Chocolate Blanco' WHERE id = 105 AND BINARY name = 'TARTA DE ZARZAMORA C CHOCOLATE BLANCO';
UPDATE fayxzvov_pos.product SET name = 'Pastelito de Mantequilla Mermelada F' WHERE id = 106 AND BINARY name = 'PASTELITO DE MANTEQUILLA MERMELADA F';
UPDATE fayxzvov_pos.product SET name = 'Pastelitos de Mantequilla Vainilla' WHERE id = 107 AND BINARY name = 'PASTELITOS DE MANTEQUILLA VAINILLA';
UPDATE fayxzvov_pos.product SET name = 'Pastelitos de Mantequilla Mermelada de Zarzamora' WHERE id = 108 AND BINARY name = 'PASTELITOS DE MANTEQUILLA MERMELADA DE ZARZAMORA';
UPDATE fayxzvov_pos.product SET name = 'Pastelitos de Mantequilla Queso Philadelphia' WHERE id = 109 AND BINARY name = 'PASTELITOS DE MANTEQUILLA QUESO PHILADELPHIA';
UPDATE fayxzvov_pos.product SET name = 'Pastelitos de Mantequilla Zanahoria' WHERE id = 110 AND BINARY name = 'PASTELITOS DE MANTEQUILLA ZANAHORIA';
UPDATE fayxzvov_pos.product SET name = 'Decoracion Extra al Cupcake' WHERE id = 111 AND BINARY name = 'DECORACION EXTRA AL CUPCAKE';
UPDATE fayxzvov_pos.product SET name = 'Decoracion Extra al Cupcake.' WHERE id = 112 AND BINARY name = 'DECORACION EXTRA AL CUPCAKE.';
UPDATE fayxzvov_pos.product SET name = 'Empanaditas de Piña' WHERE id = 113 AND BINARY name = 'EMPANADITAS DE PIÑA';
UPDATE fayxzvov_pos.product SET name = 'Empanaditas de Manjar' WHERE id = 114 AND BINARY name = 'EMPANADITAS DE MANJAR';
UPDATE fayxzvov_pos.product SET name = 'Empanaditas de Queso' WHERE id = 115 AND BINARY name = 'EMPANADITAS DE QUESO';
UPDATE fayxzvov_pos.product SET name = 'Empanaditas Zarzamora con Queso' WHERE id = 116 AND BINARY name = 'EMPANADITAS ZARZAMORA CON QUESO';
UPDATE fayxzvov_pos.product SET name = 'Mini Carlota de Chocolate pz' WHERE id = 117 AND BINARY name = 'MINI CARLOTA DE CHOCOLATE PZ';
UPDATE fayxzvov_pos.product SET name = 'Mini Carlota Manjar con Durazno pz' WHERE id = 118 AND BINARY name = 'MINI CARLOTA MANJAR CON DURAZNO PZ';
UPDATE fayxzvov_pos.product SET name = 'Mini Carlota de Baileys pz' WHERE id = 119 AND BINARY name = 'MINI CARLOTA DE BAILEYS PZ';
UPDATE fayxzvov_pos.product SET name = 'Mini Carlota con Dulce de Leche y Platano pz' WHERE id = 120 AND BINARY name = 'MINI CARLOTA CON DULCE DE LECHE Y PLATANO PZ';
UPDATE fayxzvov_pos.product SET name = 'Mini Carlota Tres Leches con Durazno y Manjar pz' WHERE id = 121 AND BINARY name = 'MINI CARLOTA TRES LECHES CON DURAZNO Y MANJAR PZ';
UPDATE fayxzvov_pos.product SET name = 'Donas Azucaradas' WHERE id = 122 AND BINARY name = 'DONAS AZUCARADAS';
UPDATE fayxzvov_pos.product SET name = 'Donas de Chocolate' WHERE id = 123 AND BINARY name = 'DONAS DE CHOCOLATE';
UPDATE fayxzvov_pos.product SET name = 'Donas de Oreo' WHERE id = 124 AND BINARY name = 'DONAS DE OREO';
UPDATE fayxzvov_pos.product SET name = 'Donas de Mazapan' WHERE id = 125 AND BINARY name = 'DONAS DE MAZAPAN';
UPDATE fayxzvov_pos.product SET name = 'Donas de Lunetas' WHERE id = 126 AND BINARY name = 'DONAS DE LUNETAS';
UPDATE fayxzvov_pos.product SET name = 'Donas de Ferrero' WHERE id = 127 AND BINARY name = 'DONAS DE FERRERO';
UPDATE fayxzvov_pos.product SET name = 'Cakepops Chocolate Blanco' WHERE id = 128 AND BINARY name = 'CAKEPOPS CHOCOLATE  BLANCO';
UPDATE fayxzvov_pos.product SET name = 'Brownies' WHERE id = 129 AND BINARY name = 'BROWNIES';
UPDATE fayxzvov_pos.product SET name = 'Chesecake Tortuga' WHERE id = 130 AND BINARY name = 'CHESECAKE TORTUGA';
UPDATE fayxzvov_pos.product SET name = 'Tarta de Zarzamora C Chocolate B pz' WHERE id = 131 AND BINARY name = 'TARTA DE ZARZAMORA C CHOCOLATE B PZ';
UPDATE fayxzvov_pos.product SET name = 'Tarta de Limon con Merengue pz' WHERE id = 132 AND BINARY name = 'TARTA DE LIMON CON MERENGUE PZ';
UPDATE fayxzvov_pos.product SET name = 'Caketopper Dia del Padre' WHERE id = 133 AND BINARY name = 'caketopper dia del padre';
UPDATE fayxzvov_pos.product SET name = 'Caketopper Vitrina' WHERE id = 134 AND BINARY name = 'caketopper vitrina';
UPDATE fayxzvov_pos.product SET name = 'Mostachon' WHERE id = 135 AND BINARY name = 'mostachon';
UPDATE fayxzvov_pos.product SET name = 'Cheesecake Fresa 15pz' WHERE id = 136 AND BINARY name = 'cheesecake fresa 15pz';
UPDATE fayxzvov_pos.product SET name = 'Chesecake Zarzamora 15 pz' WHERE id = 137 AND BINARY name = 'CHESECAKE ZARZAMORA 15 PZ';
UPDATE fayxzvov_pos.product SET name = 'Beso de Angel 12P' WHERE id = 138 AND BINARY name = 'BESO DE ANGEL 12P';
UPDATE fayxzvov_pos.product SET name = 'Red Velvet Especial' WHERE id = 139 AND BINARY name = 'RED VELVET ESPECIAL';
UPDATE fayxzvov_pos.product SET name = 'Gelatina Mosaico pz 60oz' WHERE id = 140 AND BINARY name = 'gelatina mosaico pz 60oz';
UPDATE fayxzvov_pos.product SET name = 'Galletas Alfajores c/Chocolate 500 gr' WHERE id = 150 AND BINARY name = 'Galletas Alfajores c/chocolate 500 gr';
UPDATE fayxzvov_pos.product SET name = 'Galletas Sandwichitos de Chocolate 500 gr' WHERE id = 151 AND BINARY name = 'Galletas Sandwichitos de chocolate 500 gr';
UPDATE fayxzvov_pos.product SET name = 'Galletas Americanas 12 pzs Mini' WHERE id = 152 AND BINARY name = 'Galletas Americanas 12 pzs mini';
UPDATE fayxzvov_pos.product SET name = 'Galletas Chocolate Rellenos de Nutella 500 gr' WHERE id = 155 AND BINARY name = 'Galletas Chocolate rellenos de nutella 500 gr';
UPDATE fayxzvov_pos.product SET name = 'Galletas Chispas de Chocolate 500 gr' WHERE id = 156 AND BINARY name = 'Galletas Chispas de chocolate 500 gr';
UPDATE fayxzvov_pos.product SET name = 'CakePops Chocolate Blanco pz' WHERE id = 157 AND BINARY name = 'CakePops Chocolate blanco pz';
UPDATE fayxzvov_pos.product SET name = 'Cakepops Chocolate Obscuro pz' WHERE id = 158 AND BINARY name = 'CAKEPOPS CHOCOLATE OBSCURO PZ';
UPDATE fayxzvov_pos.product SET name = 'Brownie con Cheesecake pz' WHERE id = 159 AND BINARY name = 'Brownie con cheesecake pz';
UPDATE fayxzvov_pos.product SET name = 'Tarta de Piña' WHERE id = 160 AND BINARY name = 'TARTA DE PIÑA';
UPDATE fayxzvov_pos.product SET name = 'Pastel Frutos Rojos' WHERE id = 161 AND BINARY name = 'PASTEL FRUTOS ROJOS';
UPDATE fayxzvov_pos.product SET name = 'Pastel Carajillo' WHERE id = 162 AND BINARY name = 'PASTEL CARAJILLO';
UPDATE fayxzvov_pos.product SET name = 'Pastel Dulce Limon' WHERE id = 163 AND BINARY name = 'PASTEL DULCE LIMON';
UPDATE fayxzvov_pos.product SET name = 'Pastel Lotus' WHERE id = 164 AND BINARY name = 'PASTEL LOTUS';
UPDATE fayxzvov_pos.product SET name = 'Hojaldra Hawaiana' WHERE id = 165 AND BINARY name = 'HOJALDRA HAWAIANA';
UPDATE fayxzvov_pos.product SET name = 'Hojaldra Mexicana' WHERE id = 166 AND BINARY name = 'HOJALDRA MEXICANA';
UPDATE fayxzvov_pos.product SET name = 'Hojaldra de Jamon c/Q Amarillo' WHERE id = 167 AND BINARY name = 'HOJALDRA DE JAMON C/Q AMARILLO';
UPDATE fayxzvov_pos.product SET name = 'Bollo de Queso Philadelphia Finas Hierbas' WHERE id = 168 AND BINARY name = 'BOLLO DE QUESO PHILADELPHIA FINAS HIERBAS';
UPDATE fayxzvov_pos.product SET name = 'Bollo de Queso Philadelphia Chile Seco' WHERE id = 169 AND BINARY name = 'BOLLO DE QUESO PHILADELPHIA CHILE SECO';
UPDATE fayxzvov_pos.product SET name = 'Bollo de Queso Philadelphia Ajonjoli' WHERE id = 170 AND BINARY name = 'BOLLO DE QUESO PHILADELPHIA AJONJOLI';
UPDATE fayxzvov_pos.product SET name = 'Tarta Quiche Lorraine' WHERE id = 171 AND BINARY name = 'TARTA QUICHE LORRAINE';
UPDATE fayxzvov_pos.product SET name = 'Tarta Camaron al Ajillo' WHERE id = 172 AND BINARY name = 'TARTA CAMARON AL AJILLO';
UPDATE fayxzvov_pos.product SET name = 'Tarta de Pollo Teriyaqui' WHERE id = 173 AND BINARY name = 'TARTA DE POLLO TERIYAQUI';
UPDATE fayxzvov_pos.product SET name = 'Tarta de Camaron c/Elote' WHERE id = 174 AND BINARY name = 'TARTA DE CAMARON C/ELOTE';
UPDATE fayxzvov_pos.product SET name = 'Tarta de Espinacas' WHERE id = 175 AND BINARY name = 'TARTA DE ESPINACAS';
UPDATE fayxzvov_pos.product SET name = 'Decoracion Extra' WHERE id = 176 AND BINARY name = 'DECORACION EXTRA';
UPDATE fayxzvov_pos.product SET name = 'Tarta de Manjar con Frutas' WHERE id = 177 AND BINARY name = 'TARTA DE MANJAR CON FRUTAS';
UPDATE fayxzvov_pos.product SET name = 'Empanaditas Jamon con Queso pzs' WHERE id = 178 AND BINARY name = 'Empanaditas Jamon con queso pzs';
UPDATE fayxzvov_pos.product SET name = 'Bolsa de Pan' WHERE id = 181 AND BINARY name = 'Bolsa de pan';
UPDATE fayxzvov_pos.product SET name = 'Polvoron' WHERE id = 183 AND BINARY name = 'POLVORON';
UPDATE fayxzvov_pos.product SET name = 'Tarta Banoffe Grande' WHERE id = 184 AND BINARY name = 'TARTA BANOFFE GRANDE';
UPDATE fayxzvov_pos.product SET name = 'Beso de Angel 12P' WHERE id = 2107 AND BINARY name = 'BESO DE ANGEL 12P';

-- modifier_group (6)
UPDATE fayxzvov_pos.modifier_group SET name = 'Forma' WHERE id = 1 AND BINARY name = 'forma';
UPDATE fayxzvov_pos.modifier_group SET name = 'Rellenos' WHERE id = 2 AND BINARY name = 'rellenos';
UPDATE fayxzvov_pos.modifier_group SET name = 'Cobertura' WHERE id = 3 AND BINARY name = 'cobertura';
UPDATE fayxzvov_pos.modifier_group SET name = 'Tipo de Decoración' WHERE id = 4 AND BINARY name = 'tipo de decoración';
UPDATE fayxzvov_pos.modifier_group SET name = 'Precio por Porción Según Sabor' WHERE id = 6 AND BINARY name = 'PRECIO POR PORCIÓN SEGÚN SABOR';
UPDATE fayxzvov_pos.modifier_group SET name = 'Envio a Domicilio' WHERE id = 12 AND BINARY name = 'ENVIO A DOMICILIO';

-- modifier (113)
UPDATE fayxzvov_pos.modifier SET name = 'Manjar' WHERE id = 2 AND BINARY name = 'manjar';
UPDATE fayxzvov_pos.modifier SET name = 'Fresas con Crema' WHERE id = 3 AND BINARY name = 'fresas con crema';
UPDATE fayxzvov_pos.modifier SET name = 'Chocolate' WHERE id = 4 AND BINARY name = 'chocolate';
UPDATE fayxzvov_pos.modifier SET name = 'Queso' WHERE id = 5 AND BINARY name = 'queso';
UPDATE fayxzvov_pos.modifier SET name = 'Crema Batida' WHERE id = 6 AND BINARY name = 'crema batida';
UPDATE fayxzvov_pos.modifier SET name = 'Buttercream' WHERE id = 7 AND BINARY name = 'buttercream';
UPDATE fayxzvov_pos.modifier SET name = 'Chocolate' WHERE id = 8 AND BINARY name = 'chocolate';
UPDATE fayxzvov_pos.modifier SET name = 'Fondant' WHERE id = 9 AND BINARY name = 'fondant';
UPDATE fayxzvov_pos.modifier SET name = 'Buttercream Dorado' WHERE id = 10 AND BINARY name = 'buttercream dorado';
UPDATE fayxzvov_pos.modifier SET name = 'Fondant Dorado' WHERE id = 11 AND BINARY name = 'fondant dorado';
UPDATE fayxzvov_pos.modifier SET name = 'Merengue (Claras)' WHERE id = 12 AND BINARY name = 'merengue (claras)';
UPDATE fayxzvov_pos.modifier SET name = 'Redonda' WHERE id = 13 AND BINARY name = 'redonda';
UPDATE fayxzvov_pos.modifier SET name = 'Cuadrada' WHERE id = 14 AND BINARY name = 'cuadrada';
UPDATE fayxzvov_pos.modifier SET name = 'Rectangular' WHERE id = 15 AND BINARY name = 'rectangular';
UPDATE fayxzvov_pos.modifier SET name = 'Corazón' WHERE id = 16 AND BINARY name = 'corazón';
UPDATE fayxzvov_pos.modifier SET name = 'Numeros' WHERE id = 17 AND BINARY name = 'numeros';
UPDATE fayxzvov_pos.modifier SET name = 'Doble Altura' WHERE id = 18 AND BINARY name = 'doble altura';
UPDATE fayxzvov_pos.modifier SET name = 'Pisos' WHERE id = 19 AND BINARY name = 'pisos';
UPDATE fayxzvov_pos.modifier SET name = 'Extra' WHERE id = 20 AND BINARY name = 'extra';
UPDATE fayxzvov_pos.modifier SET name = 'Zarzamora con Queso' WHERE id = 21 AND BINARY name = 'zarzamora con queso';
UPDATE fayxzvov_pos.modifier SET name = 'Capuccino' WHERE id = 22 AND BINARY name = 'capuccino';
UPDATE fayxzvov_pos.modifier SET name = 'Mermelada de Fresa' WHERE id = 23 AND BINARY name = 'mermelada de fresa';
UPDATE fayxzvov_pos.modifier SET name = 'Piña Coco' WHERE id = 24 AND BINARY name = 'piña coco';
UPDATE fayxzvov_pos.modifier SET name = 'Mocka' WHERE id = 25 AND BINARY name = 'mocka';
UPDATE fayxzvov_pos.modifier SET name = 'Cajeta' WHERE id = 26 AND BINARY name = 'cajeta';
UPDATE fayxzvov_pos.modifier SET name = 'Relleno Birthday Cake' WHERE id = 28 AND BINARY name = 'relleno birthday cake';
UPDATE fayxzvov_pos.modifier SET name = 'Nutella' WHERE id = 29 AND BINARY name = 'nutella';
UPDATE fayxzvov_pos.modifier SET name = 'Sencilla' WHERE id = 30 AND BINARY name = 'sencilla';
UPDATE fayxzvov_pos.modifier SET name = 'Barroco' WHERE id = 31 AND BINARY name = 'barroco';
UPDATE fayxzvov_pos.modifier SET name = 'Vela Tipo Luz de Bengala' WHERE id = 33 AND BINARY name = 'vela tipo luz de bengala';
UPDATE fayxzvov_pos.modifier SET name = 'Piso 1' WHERE id = 34 AND BINARY name = 'piso 1';
UPDATE fayxzvov_pos.modifier SET name = 'Piso 2' WHERE id = 35 AND BINARY name = 'piso 2';
UPDATE fayxzvov_pos.modifier SET name = 'Piso 3' WHERE id = 36 AND BINARY name = 'piso 3';
UPDATE fayxzvov_pos.modifier SET name = '3 Leches Chantilly' WHERE id = 40 AND BINARY name = '3 LECHES CHANTILLY';
UPDATE fayxzvov_pos.modifier SET name = 'Mantequilla Chantilly' WHERE id = 41 AND BINARY name = 'MANTEQUILLA CHANTILLY';
UPDATE fayxzvov_pos.modifier SET name = 'Mantequilla Buttercream' WHERE id = 42 AND BINARY name = 'MANTEQUILLA BUTTERCREAM';
UPDATE fayxzvov_pos.modifier SET name = 'Mantequilla Fondant' WHERE id = 43 AND BINARY name = 'MANTEQUILLA FONDANT';
UPDATE fayxzvov_pos.modifier SET name = 'Birthday Cake' WHERE id = 44 AND BINARY name = 'BIRTHDAY CAKE';
UPDATE fayxzvov_pos.modifier SET name = '3 Leches Mango' WHERE id = 45 AND BINARY name = '3 LECHES MANGO';
UPDATE fayxzvov_pos.modifier SET name = 'Red Velvet' WHERE id = 46 AND BINARY name = 'RED VELVET';
UPDATE fayxzvov_pos.modifier SET name = 'Doble Relleno' WHERE id = 47 AND BINARY name = 'DOBLE RELLENO';
UPDATE fayxzvov_pos.modifier SET name = 'Triple Cake' WHERE id = 48 AND BINARY name = 'TRIPLE CAKE';
UPDATE fayxzvov_pos.modifier SET name = 'Triple Chocolate' WHERE id = 49 AND BINARY name = 'TRIPLE CHOCOLATE';
UPDATE fayxzvov_pos.modifier SET name = 'Ferrero' WHERE id = 50 AND BINARY name = 'FERRERO';
UPDATE fayxzvov_pos.modifier SET name = 'Cheese Cake' WHERE id = 51 AND BINARY name = 'CHEESE CAKE';
UPDATE fayxzvov_pos.modifier SET name = 'Zanahoria' WHERE id = 52 AND BINARY name = 'ZANAHORIA';
UPDATE fayxzvov_pos.modifier SET name = 'Delicia de Mango' WHERE id = 53 AND BINARY name = 'DELICIA DE MANGO';
UPDATE fayxzvov_pos.modifier SET name = 'Lili Cake' WHERE id = 54 AND BINARY name = 'LILI CAKE';
UPDATE fayxzvov_pos.modifier SET name = 'Bruce Cake' WHERE id = 55 AND BINARY name = 'BRUCE CAKE';
UPDATE fayxzvov_pos.modifier SET name = 'Choco Caramel' WHERE id = 56 AND BINARY name = 'CHOCO CARAMEL';
UPDATE fayxzvov_pos.modifier SET name = 'Berries' WHERE id = 57 AND BINARY name = 'BERRIES';
UPDATE fayxzvov_pos.modifier SET name = 'Bariloche' WHERE id = 58 AND BINARY name = 'BARILOCHE';
UPDATE fayxzvov_pos.modifier SET name = 'Bicolor' WHERE id = 59 AND BINARY name = 'BICOLOR';
UPDATE fayxzvov_pos.modifier SET name = 'Lilis de Crema Batida' WHERE id = 64 AND BINARY name = 'Lilis de Crema batida';
UPDATE fayxzvov_pos.modifier SET name = 'Gerberas Crema Batida' WHERE id = 68 AND BINARY name = 'Gerberas Crema batida';
UPDATE fayxzvov_pos.modifier SET name = 'Girasoles Crema Batida' WHERE id = 72 AND BINARY name = 'Girasoles Crema batida';
UPDATE fayxzvov_pos.modifier SET name = 'Clavel en Crema Batida' WHERE id = 78 AND BINARY name = 'Clavel en Crema batida';
UPDATE fayxzvov_pos.modifier SET name = 'Margaritas Crema Batida' WHERE id = 82 AND BINARY name = 'Margaritas Crema batida';
UPDATE fayxzvov_pos.modifier SET name = 'Peonias Crema Batida' WHERE id = 86 AND BINARY name = 'Peonias Crema batida';
UPDATE fayxzvov_pos.modifier SET name = 'Peonias Naturales (Cotizar y Multiplicar X 3)' WHERE id = 88 AND BINARY name = 'Peonias Naturales (Cotizar y multiplicar X 3)';
UPDATE fayxzvov_pos.modifier SET name = 'Suculentas Crema Batida' WHERE id = 90 AND BINARY name = 'Suculentas Crema batida';
UPDATE fayxzvov_pos.modifier SET name = 'Follaje Crema Batida' WHERE id = 94 AND BINARY name = 'Follaje Crema batida';
UPDATE fayxzvov_pos.modifier SET name = 'Rafaellos Choco y Coco' WHERE id = 100 AND BINARY name = 'Rafaellos choco y coco';
UPDATE fayxzvov_pos.modifier SET name = 'Listón (Metro)' WHERE id = 123 AND BINARY name = 'Listón (metro)';
UPDATE fayxzvov_pos.modifier SET name = 'Oblea Comestible' WHERE id = 124 AND BINARY name = 'Oblea comestible';
UPDATE fayxzvov_pos.modifier SET name = 'Moño Sencillo Fondant' WHERE id = 127 AND BINARY name = 'Moño sencillo Fondant';
UPDATE fayxzvov_pos.modifier SET name = 'Moño Elaborado Fondant' WHERE id = 128 AND BINARY name = 'Moño elaborado Fondant';
UPDATE fayxzvov_pos.modifier SET name = 'Bolas de Fondant (6 Dif. Tamaño)' WHERE id = 129 AND BINARY name = 'Bolas de Fondant (6 dif. Tamaño)';
UPDATE fayxzvov_pos.modifier SET name = 'Bolas Doradas Fondant (3 pzas. Dif Tamaño)' WHERE id = 130 AND BINARY name = 'Bolas doradas Fondant (3 pzas. dif Tamaño)';
UPDATE fayxzvov_pos.modifier SET name = 'Muñeco Sencillo Fondant' WHERE id = 131 AND BINARY name = 'Muñeco sencillo Fondant';
UPDATE fayxzvov_pos.modifier SET name = 'Muñeco Elaborado Personaje Fondant' WHERE id = 132 AND BINARY name = 'Muñeco elaborado personaje Fondant';
UPDATE fayxzvov_pos.modifier SET name = 'Escurrido Drip Dorado 10cm Lineal' WHERE id = 135 AND BINARY name = 'Escurrido Drip Dorado 10cm lineal';
UPDATE fayxzvov_pos.modifier SET name = 'Matizados con Dorado Brillos' WHERE id = 136 AND BINARY name = 'Matizados con dorado brillos';
UPDATE fayxzvov_pos.modifier SET name = 'Flor de Cortador Plana Chica' WHERE id = 145 AND BINARY name = 'Flor de cortador plana chica';
UPDATE fayxzvov_pos.modifier SET name = 'Flor de Cortador Plana Mediana' WHERE id = 146 AND BINARY name = 'Flor de cortador plana Mediana';
UPDATE fayxzvov_pos.modifier SET name = 'Flor de Cortador Plana Grande' WHERE id = 147 AND BINARY name = 'Flor de cortador plana Grande';
UPDATE fayxzvov_pos.modifier SET name = 'Corona Sencilla Fondant' WHERE id = 160 AND BINARY name = 'Corona sencilla Fondant';
UPDATE fayxzvov_pos.modifier SET name = '1 Piso' WHERE id = 182 AND BINARY name = '1 piso';
UPDATE fayxzvov_pos.modifier SET name = 'Dulce de Leche' WHERE id = 188 AND BINARY name = 'DULCE DE LECHE';
UPDATE fayxzvov_pos.modifier SET name = 'Dulce Leche' WHERE id = 189 AND BINARY name = 'DULCE LECHE';
UPDATE fayxzvov_pos.modifier SET name = 'Decoracion Estilo Barroco' WHERE id = 190 AND BINARY name = 'DECORACION ESTILO BARROCO';
UPDATE fayxzvov_pos.modifier SET name = 'Velas Doradas de Numeros' WHERE id = 191 AND BINARY name = 'VELAS DORADAS DE NUMEROS';
UPDATE fayxzvov_pos.modifier SET name = 'Texturas Sobre Buttercream' WHERE id = 192 AND BINARY name = 'texturas sobre buttercream';
UPDATE fayxzvov_pos.modifier SET name = 'Confeti Cake' WHERE id = 195 AND BINARY name = 'CONFETI CAKE';
UPDATE fayxzvov_pos.modifier SET name = 'Decoracion a Mano Alzada' WHERE id = 196 AND BINARY name = 'DECORACION A MANO ALZADA';
UPDATE fayxzvov_pos.modifier SET name = 'Lily Cake 12 Porciones' WHERE id = 197 AND BINARY name = 'Lily cake 12 porciones';
UPDATE fayxzvov_pos.modifier SET name = 'Tres Leches 12 Porciones' WHERE id = 198 AND BINARY name = 'TRES LECHES 12 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Tres Leches 18 Porciones' WHERE id = 199 AND BINARY name = 'TRES LECHES 18 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Delicia de Mango 12 Porciones' WHERE id = 200 AND BINARY name = 'DELICIA DE MANGO 12 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Red Velvet 12 Porciones' WHERE id = 201 AND BINARY name = 'RED VELVET 12 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Dulce de Leche 10 Porciones' WHERE id = 202 AND BINARY name = 'DULCE DE LECHE 10 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Birthday 12 Porciones' WHERE id = 203 AND BINARY name = 'BIRTHDAY 12 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Birthday 18 Porciones' WHERE id = 204 AND BINARY name = 'BIRTHDAY 18 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Berries 12 Porciones' WHERE id = 205 AND BINARY name = 'BERRIES 12 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Ferrero 12 Porciones' WHERE id = 206 AND BINARY name = 'FERRERO 12 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Bruce Cake 12 Porciones' WHERE id = 207 AND BINARY name = 'BRUCE CAKE 12 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Triple Chocolate 12 Porciones' WHERE id = 208 AND BINARY name = 'TRIPLE CHOCOLATE 12 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Bicolor 12 Porciones' WHERE id = 209 AND BINARY name = 'BICOLOR 12 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Fresa Bariloche 12 Porciones' WHERE id = 210 AND BINARY name = 'FRESA BARILOCHE 12 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Triple Cake 12 Porciones' WHERE id = 211 AND BINARY name = 'TRIPLE CAKE 12 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Lili Cake 20 Porciones' WHERE id = 212 AND BINARY name = 'LILI CAKE 20 PORCIONES';
UPDATE fayxzvov_pos.modifier SET name = 'Delicia de Mango 20 P' WHERE id = 213 AND BINARY name = 'DELICIA DE MANGO 20 P';
UPDATE fayxzvov_pos.modifier SET name = 'Tarta de Piña' WHERE id = 214 AND BINARY name = 'TARTA DE PIÑA';
UPDATE fayxzvov_pos.modifier SET name = 'Docena Bola Disco' WHERE id = 215 AND BINARY name = 'Docena bola disco';
UPDATE fayxzvov_pos.modifier SET name = 'Bola Disco Unidad' WHERE id = 216 AND BINARY name = 'Bola disco unidad';
UPDATE fayxzvov_pos.modifier SET name = 'Envio a Domicilio' WHERE id = 217 AND BINARY name = 'ENVIO A DOMICILIO';
UPDATE fayxzvov_pos.modifier SET name = 'Beso de Angel 12p' WHERE id = 218 AND BINARY name = 'beso de angel 12p';
UPDATE fayxzvov_pos.modifier SET name = 'Beso de Angel' WHERE id = 219 AND BINARY name = 'Beso de angel';
UPDATE fayxzvov_pos.modifier SET name = 'Chocolate' WHERE id = 220 AND BINARY name = 'chocolate';
UPDATE fayxzvov_pos.modifier SET name = 'Mil Hojas' WHERE id = 221 AND BINARY name = 'MIL HOJAS';
UPDATE fayxzvov_pos.modifier SET name = 'Lotus' WHERE id = 222 AND BINARY name = 'LOTUS';
UPDATE fayxzvov_pos.modifier SET name = 'Red Velvet Especial' WHERE id = 224 AND BINARY name = 'Red velvet especial';
UPDATE fayxzvov_pos.modifier SET name = 'Red Velvet Especial 12 Porciones' WHERE id = 226 AND BINARY name = 'RED VELVET ESPECIAL 12 PORCIONES';

-- discount_reason (5): el motivo del descuento sigue el mismo estandar
UPDATE fayxzvov_pos.discount_reason SET name = 'Cortesía de la Casa' WHERE id = 1 AND BINARY name = 'Cortesía de la casa';
UPDATE fayxzvov_pos.discount_reason SET name = 'Cliente Frecuente' WHERE id = 2 AND BINARY name = 'Cliente frecuente';
UPDATE fayxzvov_pos.discount_reason SET name = 'Promoción Vigente' WHERE id = 3 AND BINARY name = 'Promoción vigente';
UPDATE fayxzvov_pos.discount_reason SET name = 'Descuento Empleado' WHERE id = 4 AND BINARY name = 'Descuento empleado';
UPDATE fayxzvov_pos.discount_reason SET name = 'Otro Motivo' WHERE id = 5 AND BINARY name = 'Otro motivo';
