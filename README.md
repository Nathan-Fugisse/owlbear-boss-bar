# RPG Boss Bar — Cinematic Timeline v0.3.0

Soulslike-inspired Boss Bar and synchronized cinematic timeline editor for Owlbear Rodeo.

## Cinematic timeline

Each scene can contain timed events:

- `TITLE IN`
- `SUBTITLE IN`
- `DIALOGUE IN`
- `BOSS SHOW`
- `BOSS HIDE`
- `DAMAGE`
- `HEAL`
- `CAMERA`

The GM creates the timeline, presses **PLAY FOR PLAYERS**, and the cinematic is displayed as a fullscreen Owlbear overlay. Camera events use the Owlbear viewport API.

## Import / Export

Cinematics are exported as JSON and can be imported again from the GM interface.

## Important

Image backgrounds are stored as URLs so the exported cinematic remains small. The active cinematic is synchronized through Owlbear room metadata, so keep large external assets out of the timeline JSON.
