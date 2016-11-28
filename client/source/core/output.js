import entities from 'source/core/data/entities';
import adapter from 'source/utilities/adapter';

function post() {
    entities.ships.forEach(function (ship) {
        if (ship.live === true) {
            adapter.element('#' + ship.id + ' .battery').style.width = ship.battery.level + 'px';
        }
    });
}

function postScore(score) {
    entities.ships.forEach(function (ship) {
        adapter.element('#' + ship.id + ' .score').innerHTML = score[ship.id];
    });
}

function prepare() {

    entities.ships.forEach(function (ship) {

        adapter.element('#' + ship.id + ' .battery').style.background = ship.colours.hull;
        adapter.element('#' + ship.id + ' .battery').style.height = '10px';
        adapter.element('#' + ship.id + ' .battery').style.width = '100px';

        adapter.element('#' + ship.id).style.color = ship.colours.hull;
        adapter.element('#' + ship.id).style.fontFamily = 'monospace';
        adapter.element('#' + ship.id).style.fontSize = '3rem';
        adapter.element('#' + ship.id).style.opacity = '0.8';
        adapter.element('#' + ship.id).style.padding = '10px';
        adapter.element('#' + ship.id).style.position = 'absolute';

        if (
            ship.id === 'player1'
            ||
            ship.id === 'player2'
        ) {
            adapter.element('#' + ship.id).style.bottom = '20px';
        } else {
            adapter.element('#' + ship.id).style.top = '20px';
        }

        if (
            ship.id === 'player1'
            ||
            ship.id === 'player4'
        ) {
            adapter.element('#' + ship.id).style.right = '20px';
            adapter.element('#' + ship.id).style.textAlign = 'right';
        } else {
            adapter.element('#' + ship.id).style.left = '20px';
        }

    });

}

export default Object.freeze({
    post,
    postScore,
    prepare
});
