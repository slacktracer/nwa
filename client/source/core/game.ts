import { postScore } from "./output.ts";

export interface Score {
  player1: number;
  player2: number;
  player3: number;
  player4: number;
}

const game: { score: Score } = {
  score: {
    player1: 0,
    player2: 0,
    player3: 0,
    player4: 0,
  },
};

export function death(id: string, by?: string): void {
  if (by === "star" || by === "self") {
    if (by === "self") {
      // HACK
      // O jogador atingido por si mesmo deve perder dois pontos
      // mas por ter atingido alguém ele ganha um ponto.
      // A linha a seguir desconta este ponto.
      // O sistema de pontuação usando notificação de eventos (e definição de colisões)
      // precisa ser recriado.
      game.score[id as keyof Score] -= 1;
    }
    game.score[id as keyof Score] -= 2;
  } else {
    game.score[id as keyof Score] -= 1;
  }
  postScore(game.score);
}

export function point(id: string): void {
  game.score[id as keyof Score] += 1;
  postScore(game.score);
}

export default { death, point };
