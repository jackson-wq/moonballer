# Regras v0

Tudo é calculado em metros de quadra real. A câmera só desenha o que o motor decide, então dá para trocar a visão depois sem mexer nas regras. Os números ficam em `src/engine.js`.

## O turno

Cada vez que a bola chega em você, o jogo pausa e você escolhe:

1. **O golpe** (cruzada, paralela, contrapé, deixadinha, voleio, smash...). A lista muda com a situação: voleios só na rede, smash só em bola alta, balão quando ele está na rede ou quando seu equilíbrio quebrou.
2. **A intensidade**: Controle (+8 de acerto, menos pressão), Firme, Tudo (−10 de acerto, mais velocidade e pressão, mais fôlego gasto).
3. **Para onde voltar**: centro, ficar onde está, subir à rede.

## Os dois números

Cada golpe mostra:

- **Acerto**: chance da bola ir onde você quis (Perfeito ou Bom).
- **Ganha o ponto se entrar**: chance de ele não chegar, ou chegar e errar.

Quando o golpe não sai, ele vira **Erro** (rede ou fora, ponto dele) ou **Mediano** (bola curta no meio, ele ganha uma bola para atacar). Golpes que miram perto da linha erram mais por Erro; golpes seguros erram mais por Mediano.

O acerto cai com: bola difícil (você chegou esticado), equilíbrio baixo, fôlego abaixo de 60, rally longo (a partir da 4ª troca), estar parado no meio da quadra, bola funda para golpe arriscado. Sobe com: bola curta para atacar, ter chegado com tempo, golpe do seu lado forte.

## Quem chega na bola

Para cada bola o motor calcula a folga: tempo de voo da bola menos o tempo que quem recebe precisa (reação + distância / velocidade).

- Folga muito negativa: não chega (winner ou ace).
- Folga perto de zero: chega esticado, com chance alta de erro forçado.
- Folga grande: chega com tempo e recupera equilíbrio.

Modificadores: pegar o adversário indo para o lado contrário (**contrapé**) custa +0,22 s a ele. Se ele estiver **adivinhando um lado** (ele lê seu padrão quando você repete a mesma direção 3 vezes nas últimas 4), ganha 0,08 s se acertar e perde 0,22 s se errar.

## Equilíbrio e fôlego

- **Equilíbrio** é a vida do ponto. Cada golpe que chega nele tira equilíbrio, mais quanto mais forte, mais arriscado e mais apertado ele chegou. Bola curta atacada pesa 25% a mais. Quando zera, o equilíbrio **quebra**: só sobram golpes de defesa. Volta cheio a cada ponto.
- **Fôlego** dura a partida. Correr e bater com tudo gastam. Abaixo de 60 o acerto cai e a velocidade também.

## Posição depois do golpe

Quem bate se recupera enquanto a bola viaja, até onde der tempo. Ficar parado economiza fôlego, mas deixa quadra aberta. As **áreas vermelhas** na quadra mostram onde você não chegaria se ele batesse lá, já com a recuperação que você escolheu.

## Saque

Primeiro saque mais forte e arriscado; se errar, vem o segundo. Erro no segundo é dupla falta.

## Placar

Games normais (15, 30, 40, iguais, vantagem) e um set até 6 (7 no máximo).

## Ajustar o equilíbrio do jogo

`npm run sim` simula milhares de pontos IA contra IA e mostra como os pontos acabam e quais golpes são escolhidos. Na versão atual: cerca de 4 golpes por ponto, ~45% dos pontos terminam em erro não forçado, ~25% em winner ou ace e ~28% em erro forçado.
