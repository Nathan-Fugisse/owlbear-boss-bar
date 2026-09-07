# RPG Boss Bar 1.4.0

Versão baseada na implementação antiga da extensão, mas sem o sistema de cutscene/timeline.

## Aba Introdução do Boss

A introdução funciona como na versão antiga:

- Você informa uma **URL de imagem**.
- A imagem cobre a tela inteira.
- O Owlbear abre a introdução como overlay para todos os jogadores.
- Nome e subtítulo são mostrados sobre a imagem.
- A introdução desaparece automaticamente após a duração configurada.
- **A Boss Bar é fechada enquanto a introdução está na tela.**
- Ao terminar, a Boss Bar volta somente se ela estiver configurada como visível.

## Aba Boss Bar

- Nome à esquerda.
- Barra de HP.
- Sem HP numérico para jogadores.
- Campo de HP aceita expressões como `200-21`.
- A redução cria `-21` temporariamente.
- Vários danos podem aparecer ao mesmo tempo.
- Overlay fica acima dos controles inferiores do Owlbear.

Não há timeline, câmera, tokens ou sistema de cutscene.
