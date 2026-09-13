# RPG Boss Bar 1.9.0 — Cinemática de Câmera

Caminhos de tokens e câmera seguindo tokens foram removidos. A cinemática agora usa pontos de câmera marcados pela visão do GM e efeitos sincronizados, incluindo shake, rugido, impacto, flash, zoom, distorção e ondas de som.

# RPG Boss Bar 1.8.0 — Cinemática reestruturada

- Caminhos gravados pela posição real do token: marque ponto, mova o token, marque novamente.
- Movimento contínuo e interpolado após a introdução.
- Pontos de câmera fixos e câmera seguindo token.
- Visão sincronizada para todos os jogadores.

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


## Cinemática — sistema de caminhos

A versão 1.7.0 adiciona um editor de caminhos inspirado no fluxo de patrulha do módulo Patrol de TheRipper93: o Mestre seleciona um token, ativa a gravação e marca pontos diretamente no mapa. O caminho é salvo no metadata do token e pode ser executado durante uma cinemática.

O projeto não incorpora código proprietário do módulo Patrol; a implementação usa as APIs oficiais do Owlbear Rodeo e reproduz a ideia de edição por pontos, com duração, loop, ida e volta e rotação.

Referência: https://github.com/theripper93/Patrol — Patrol é distribuído sob licença MIT.
