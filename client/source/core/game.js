import output from 'source/core/output';

const game = {
    score: {
        player1: 0,
        player2: 0,
        player3: 0,
        player4: 0
    }
};

function death(id, by) {
    if (
        by === 'star'
        ||
        by === 'self'
    ) {
        if (by === 'self') {
            // HACK
            // O jogador atingido por si mesmo deve perder dois pontos
            // mas por ter atingido alguém ele ganha um ponto.
            // A linha a seguir desconta este ponto.
            // O sistema de pontuação usando notificação de eventos (e definição de colisões)
            // precisa ser recriado.
            game.score[id] -= 1;
        }
        game.score[id] -= 2;
    } else {
        game.score[id] -= 1;
    }
    output.postScore(game.score);
}

function point(id) {
    game.score[id] += 1;
    output.postScore(game.score);
}

export default Object.freeze({
    death,
    point
});
