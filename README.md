# RPG Boss Bar — 1.5.0

Correção da tela de introdução do Boss.

## Correções

- A introdução agora usa o mesmo overlay persistente da Boss Bar.
- Todos os jogadores recebem a introdução através do metadata sincronizado da sala.
- A Boss Bar fica escondida enquanto a introdução está ativa.
- A imagem continua sendo configurada por URL.
- A introdução entra com fade suave.
- Ao terminar, entra em um fade-out de aproximadamente 1,1 segundo antes de desaparecer.
- A Boss Bar só volta depois que o fade termina.
- Se a introdução for encerrada manualmente, ela também faz fade-out em vez de desaparecer instantaneamente.
- O valor numérico do HP continua invisível para os jogadores.
- O sistema de cutscene/timeline continua removido.
