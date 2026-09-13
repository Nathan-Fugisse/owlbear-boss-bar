# RPG Boss Bar — 1.5.1

Correção da tela de introdução do Boss.

## Correções 1.5.1

- A linha do tempo da introdução agora é comandada somente pelo Mestre, evitando que vários clientes escrevam o mesmo metadata ao mesmo tempo.
- Cada cliente calcula a apresentação a partir dos timestamps compartilhados, mantendo os jogadores sincronizados mesmo se abrirem a extensão depois da introdução começar.
- A fase de fade também possui timestamp próprio, evitando que jogadores atrasados reiniciem o fade.
- `cinematic.html` agora entra corretamente no build do Vite.

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
