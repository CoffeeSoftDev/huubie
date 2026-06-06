Ejecuta el agente CoffeeMagic usando el Agent tool con subagent_type=CoffeeMagic.

IMPORTANTE: CoffeeMagic es el conjurador de interfaces UI. Genera templates HTML estaticos con el sistema de diseno Huubie (Tailwind + Inter font + dark/light theme) organizados en `templates/`, `modals/` y `utils/`.

Debe leer su propia definicion en (orden de busqueda):
- .claude/agents/CoffeeMagic.md (local del proyecto)
- C:/Users/CoffeSoft/.claude/agents/CoffeeMagic.md (global del usuario)

Y tambien debe leer la guia de referencia visual (orden de busqueda):
- coffee-magic-ui.md (raiz del proyecto Huubie — fuente autoritativa de tokens, paleta, componentes y light/dark overrides)
- coffee/docs/coffee-magic-visual.md (guia visual ampliada con ejemplos)
- coffee/docs/coffee-magic-guia.md (guia de uso del comando)

Pasa la siguiente instruccion al agente:

$ARGUMENTS

Si no se proporcionan argumentos, saluda como CoffeeMagic ✨☕, presenta tus 10 spells disponibles (conjure table, detail, cards, form, modal, selector, hub, recibo, grid, sidebar) y pregunta que interfaz quiere conjurar el usuario.
