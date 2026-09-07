# RPG Boss Bar — 1.3.0

Extensão para Owlbear Rodeo com duas funções independentes:

1. **Introdução do Boss** — tela dramática em tela cheia.
2. **Boss Bar** — barra persistente durante o combate.

## Abas

A interface do Mestre agora possui duas abas:

### Introdução do Boss
Configure:
- Nome do Boss
- Subtítulo/título
- Duração da apresentação
- Cor da barra decorativa

**Mostrar Introdução** abre a tela para todos os jogadores e fecha automaticamente após a duração configurada.

### Boss Bar
Configure:
- Nome
- HP atual
- HP máximo
- Cor
- Mostrar/Ocultar

O campo HP Atual aceita expressões como `200-21`, calculando 179 HP e gerando um número temporário `-21` para todos os jogadores.

## Tela de introdução

A introdução é uma tela preta independente da Boss Bar, com:
- nome central em destaque;
- subtítulo opcional;
- nome na região inferior;
- barra decorativa inferior;
- sem exibição numérica de HP.

A barra da introdução usa o HP atual/máximo do Boss apenas para o preenchimento visual.

## Boss Bar durante o combate

A Boss Bar:
- não mostra HP numérico aos jogadores;
- mostra nome à esquerda;
- mostra somente a barra;
- exibe números temporários de dano;
- aceita múltiplos danos simultâneos;
- fica acima da interface inferior do Owlbear.

## Build

```bash
npm install
npm run build
```
