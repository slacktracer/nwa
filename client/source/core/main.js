import 'source/core/dispatcher';
import input from 'source/core/input';
import looper from 'source/core/looper';
import output from 'source/core/output';
import renderer from 'source/core/renderer';
import entities from 'source/core/data/entities';
import ships from 'source/core/data/ships/all';
import Context from 'source/core/modules/Context';
import Grid from 'source/core/modules/Grid';
import Ship from 'source/core/modules/Ship';
import Star from 'source/core/modules/Star';
import adapter from 'source/utilities/adapter';

function boot(configuration) {

    Grid.build();

    for (
        let i = 0;
        i < configuration.players;
        i += 1
    ) {
        Ship.build(
            ships[i],
            adapter.createCanvas(),
            adapter.createCanvas()
        );
    }

    Star.build();

    output.prepare();
    input.listen();

    renderer.setup(configuration);

    looper.start();

}

function restart() {
    Context.resetContext(
        renderer.getContext('middleground'),
        renderer.getFrame()
    );
    Context.resetContext(
        renderer.getContext('foreground'),
        renderer.getFrame()
    );
    entities.ships.forEach(function (ship) {
        Ship.revive(ship);
    });
}

export default Object.freeze({
    boot,
    restart
});
