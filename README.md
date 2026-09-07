# RPG Boss Bar — 1.1.0

Extensão para Owlbear Rodeo focada exclusivamente na Boss Bar.

## Alterações desta versão

### Cálculo automático de dano
O campo **HP Atual** agora aceita expressões simples.

Exemplo:

`200-21`

Ao salvar, o HP passa de **200 para 179** e a extensão calcula automaticamente:

`21 de dano`

Também é possível encadear danos:

`200-21-15-8` → `156`

### Números de dano temporários
Cada redução de HP cria um número `-DANO` temporário na tela dos jogadores.

- Dura aproximadamente 1,5 segundo.
- Some gradualmente.
- Vários golpes podem aparecer ao mesmo tempo.
- Os valores são acumulados sem substituir o número anterior.
- A informação é sincronizada pelo metadata da sala.

### Visual da Boss Bar
A barra agora segue a composição da referência Souls-like:

- Nome do Boss alinhado à esquerda.
- HP atual alinhado à direita.
- Barra longa centralizada.
- Barra posicionada mais acima na tela para reduzir conflitos com a interface do Owlbear.
- O overlay continua fora da área da extensão e acompanha a tela de cada jogador.

## Controles

Somente o Mestre pode editar:

- Nome do Boss
- HP Atual
- HP Máximo
- Cor da barra
- Mostrar Boss Bar
- Ocultar Boss Bar

## Build

```bash
npm install
npm run build
```

Os arquivos de produção são gerados em `dist/`.
