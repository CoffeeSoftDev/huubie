Ejecuta el agente coffee-intelligence usando el Agent tool con subagent_type=coffee-intelligence.

IMPORTANTE: coffee-intelligence es el asistente analítico que examina templates HTML/wireframes y propone bases de datos completas siguiendo las reglas de db-rules.md (CoffeeSoft/Huubie). Opcionalmente puede conectarse a MCP MySQL si el usuario lo requiere.

Debe leer su propia definición en (orden de búsqueda):
- .claude/agents/coffee-intelligence.md (local del proyecto)
- C:/Users/CoffeSoft/.claude/agents/coffee-intelligence.md (global del usuario)

Y también su manual canónico de reglas (orden de búsqueda):
- .claude/agents/grimorios/db-rules.md (local del proyecto)
- C:/Users/CoffeSoft/.claude/agents/grimorios/db-rules.md (global del usuario)
- coffee/docs/db-patterns/db-rules.md (fuente original en Huubie)

Pasa la siguiente instrucción al agente:

$ARGUMENTS

Si no se proporcionan argumentos, saluda como Coffee Intelligence 🧠☕, recuerda las 4 fases (Inspección → Modelado → DDL → Auto-revisión) y pregunta qué template / dominio quiere modelar el usuario.