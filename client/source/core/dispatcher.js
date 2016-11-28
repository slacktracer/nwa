import game from 'source/core/game';
import entities from 'source/core/data/entities';
import events from 'source/utilities/events';

events.on(
    'detonation',
    function (data) {
        entities.ships.byId[data.owner].weaponsSystem.missiles.live -= 1;
        if (data.target) {
            game.point(data.owner);
        }
        if (entities.ships.byId[data.owner].weaponsSystem.missiles.live < 0) {
            entities.ships.byId[data.owner].weaponsSystem.missiles.live = 0;
        }
    }
);

events.on(
    'crash',
    function (data) {
        if (data.self) {
            game.death(data.id, 'self');
            return;
        }
        if (data.hit) {
            game.death(data.id);
        } else {
            game.death(data.id, 'star');
        }
    }
);
