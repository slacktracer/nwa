import gridTemplate from 'source/core/data/templates/grid';
import missileTemplate from 'source/core/data/templates/missile';
import shipTemplate from 'source/core/data/templates/ship';
import starTemplate from 'source/core/data/templates/star';
import adapter from 'source/utilities/adapter';

const entities = {
    grid: null,
    missiles: [],
    ships: [],
    star: null,
    templates: {
        grid() {
            return adapter.copy(gridTemplate);
        },
        missile() {
            return adapter.copy(missileTemplate);
        },
        ship() {
            return adapter.copy(shipTemplate);
        },
        star() {
            return adapter.copy(starTemplate);
        }
    }
};

entities.ships.byId = {};

export default entities;
