import config from 'source/core/config';
import entities from 'source/core/data/entities';
import Context from 'source/core/modules/Context';
import Grid from 'source/core/modules/Grid';
import Missile from 'source/core/modules/Missile';
import Ship from 'source/core/modules/Ship';
import Star from 'source/core/modules/Star';

const contexts = {};
const frame = {};

function getContext(canvas) {
    return contexts[canvas];
}

function getFrame() {
    return frame;
}

function render(offset) {

    if (config.render === true) {

        if (config.useClear === false) {

            entities.ships.forEach(function (ship) {
                unrender(
                    'foreground',
                    Ship.unrender(ship)
                );
            });

            unrender(
                'foreground',
                Star.unrender(entities.star)
            );

            entities.missiles.forEach(function (missile) {
                unrender(
                    'foreground',
                    Missile.unrender(missile)
                );
            });

        } else {

            Context.clearContext(contexts.foreground);

        }

        entities.ships.forEach(function (ship) {
            Ship.render(
                contexts.foreground,
                contexts.middleground,
                ship,
                offset
            );
        });

        Star.render(
            contexts.foreground,
            entities.star
        );

        entities.missiles.forEach(function (missile) {
            Missile.render(
                contexts.foreground,
                missile,
                offset,
                contexts.middleground
            );
        });

    }

}

function setContext(
    canvas,
    context
) {
    contexts[canvas] = context;
    Context.resetContext(
        context,
        frame
    );
}

function setFrame(
    configuration,
    screen
) {

    Object.assign(
        frame,
        configuration
    );

    Context.resetFrame(
        frame,
        screen
    );

    Context.centerFrame(
        frame,
        screen
    );

    return frame;

}

function setup(
    configuration
) {

    setFrame(
        {
            aspect: configuration.aspect,
            element: configuration.element,
            height: configuration.height,
            width: configuration.width
        },
        {
            height: configuration.screen.height,
            width: configuration.screen.width
        }
    );

    setContext(
        'background',
        configuration.contexts.background
    );

    setContext(
        'middleground',
        configuration.contexts.middleground
    );

    setContext(
        'foreground',
        configuration.contexts.foreground
    );

    //Grid.render(
        //contexts.background,
        //entities.grid
    //);

}

function unrender(
    canvas,
    something
) {
    if (something !== false) {
        contexts[canvas].save();
        contexts[canvas].translate(
            something.position[0],
            something.position[1]
        );
        contexts[canvas].clearRect(
            -something.padding,
            -something.padding,
            something.padding * 2,
            something.padding * 2
        );
        contexts[canvas].restore();
    }
}

export default Object.freeze({
    getContext,
    getFrame,
    render,
    setup
});
