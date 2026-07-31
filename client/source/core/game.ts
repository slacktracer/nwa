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
  // Death penalties match training env:
  //   self-hit = -3, star = -2, enemy missile = -1
  if (by === "self") {
    game.score[id as keyof Score] -= 3;
  } else if (by === "star") {
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
