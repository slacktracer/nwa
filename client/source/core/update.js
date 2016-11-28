import entities from 'source/core/data/entities';
import Missile from 'source/core/modules/Missile';
import Physics from 'source/core/modules/Physics';
import Ship from 'source/core/modules/Ship';
import Star from 'source/core/modules/Star';
import renderer from 'source/core/renderer';
import adapter from 'source/utilities/adapter';

const frame = renderer.getFrame();

export default function update(
    deltaTime,
    time
) {

    Star.update(
        deltaTime,
        entities.star,
        time,
        adapter.tinycolor
    );

    Physics.detectCollisions(
        entities.missiles,
        entities.ships,
        entities.star
    );

    entities.missiles.forEach(function (missile) {
        Missile.update(
            deltaTime,
            frame,
            missile,
            entities.star
        );
    });

    entities.ships.forEach(function (ship) {
        Ship.update(
            deltaTime,
            frame,
            ship,
            entities.star
        );
    });

}
