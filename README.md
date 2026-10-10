# Moonballer

Tênis tático por turnos. Você não corre nem acerta o tempo da bola: a cada bola você decide o golpe, a intensidade e para onde voltar, e o jogo calcula o resto em cima de uma quadra em metros reais.

## Rodar

Precisa de Node 18 ou mais novo. Não tem dependências.

```
npm start
```

Abra http://localhost:3020

## Comandos

- `npm start`: servidor local na porta 3020 (`PORT=xxxx npm start` para trocar)
- `npm test`: testes do motor
- `npm run sim`: simula pontos IA x IA e mostra as estatísticas para ajustar os números

## Como jogar

- Teclas 1 a 7 escolhem o golpe, A S D a direção, Enter bate.
- Todos os golpes ficam sempre liberados. As chances começam escondidas; H (ou o botão Mostrar chances) mostra.
- Com as chances visíveis, cada golpe mostra acertar o alvo e, se acertar, ganhar o ponto na hora, e as áreas vermelhas mostram onde você não chega se ele bater lá.
- Quando você perde o ponto, o jogo explica o porquê e mostra opções melhores.

As regras estão em [docs/regras-v0.md](docs/regras-v0.md).

## Estrutura

- `src/engine.js`: regras, probabilidades e IA (sem desenho; roda no Node e no navegador)
- `src/render.js`: quadra na câmera de TV, em canvas
- `src/game.js`: turnos, animação e menu
- `tools/simulate.js`: simulador para balancear
