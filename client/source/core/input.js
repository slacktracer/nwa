import config from 'source/core/config';
import looper from 'source/core/looper';
import main from 'source/core/main';
import renderer from 'source/core/renderer';
import entities from 'source/core/data/entities';
import Context from 'source/core/modules/Context';
import Grid from 'source/core/modules/Grid';
import adapter from 'source/utilities/adapter';
import events from 'source/utilities/events';
import meter from 'source/utilities/meter';

function listen() {

    events.on(
        'resize',
        function onResize() {
            Context.resetFrame(
                renderer.getFrame(),
                adapter.screenSize()
            );
            Context.resetContext(
                renderer.getContext('background'),
                renderer.getFrame()
            );
            Context.resetContext(
                renderer.getContext('middleground'),
                renderer.getFrame()
            );
            Context.resetContext(
                renderer.getContext('foreground'),
                renderer.getFrame()
            );
            // Grid.render(
            //     renderer.getContext('background'),
            //     entities.grid
            // );
        }
    );

    events.on(
        'keydown',
        function onKeydown(event) {
            switch (event.keyCode) {
            case 40: // down
                // entities
                //     .ships[0]
                //     .commands
                //     .fire = false;
                break;
            case 37: // left
                entities
                    .ships[0]
                    .commands
                    .anticlockwise = true;
                break;
            case 39: // right
                entities
                    .ships[0]
                    .commands
                    .clockwise = true;
                break;
            case 38: // up
                entities
                    .ships[0]
                    .commands
                    .thrust = true;
                break;
            case 16: // shift
                entities
                    .ships[0]
                    .commands
                    .clear = true;
                break;
            case 88: // x
                // entities
                //     .ships[1]
                //     .commands
                //     .fire = false;
                break;
            case 90: // z
                entities
                    .ships[1]
                    .commands
                    .anticlockwise = true;
                break;
            case 67: // c
                entities
                    .ships[1]
                    .commands
                    .clockwise = true;
                break;
            case 83: // s
                entities
                    .ships[1]
                    .commands
                    .thrust = true;
                break;
            case 65: // a
                entities
                    .ships[1]
                    .commands
                    .clear = true;
                break;
            case 70: // f
                // entities
                //     .ships[2]
                //     .commands
                //     .fire = false;
                break;
            case 68: // d
                entities
                    .ships[2]
                    .commands
                    .anticlockwise = true;
                break;
            case 71: // g
                entities
                    .ships[2]
                    .commands
                    .clockwise = true;
                break;
            case 82: // r
                entities
                    .ships[2]
                    .commands
                    .thrust = true;
                break;
            case 69: // e
                entities
                    .ships[2]
                    .commands
                    .clear = true;
                break;
            case 75: // k
                // entities
                //     .ships[3]
                //     .commands
                //     .fire = false;
                break;
            case 74: // j
                entities
                    .ships[3]
                    .commands
                    .anticlockwise = true;
                break;
            case 76: // l
                entities
                    .ships[3]
                    .commands
                    .clockwise = true;
                break;
            case 73: // i
                entities
                    .ships[3]
                    .commands
                    .thrust = true;
                break;
            case 85: // u
                entities
                    .ships[3]
                    .commands
                    .clear = true;
                break;
            default:
            }
        }
    );

    events.on(
        'keyup',
        function onKeyup(event) {
            switch (event.keyCode) {
            case 40: // down
                entities
                    .ships[0]
                    .commands
                    .fire = true;
                break;
            case 37: // left
                entities
                    .ships[0]
                    .commands
                    .anticlockwise = false;
                break;
            case 39: // right
                entities
                    .ships[0]
                    .commands
                    .clockwise = false;
                break;
            case 38: // up
                entities
                    .ships[0]
                    .commands
                    .thrust = false;
                break;
            case 88: // x
                entities
                    .ships[1]
                    .commands
                    .fire = true;
                break;
            case 90: // z
                entities
                    .ships[1]
                    .commands
                    .anticlockwise = false;
                break;
            case 67: // c
                entities
                    .ships[1]
                    .commands
                    .clockwise = false;
                break;
            case 83: // s
                entities
                    .ships[1]
                    .commands
                    .thrust = false;
                break;
            case 70: // f
                entities
                    .ships[2]
                    .commands
                    .fire = true;
                break;
            case 68: // d
                entities
                    .ships[2]
                    .commands
                    .anticlockwise = false;
                break;
            case 71: // g
                entities
                    .ships[2]
                    .commands
                    .clockwise = false;
                break;
            case 82: // r
                entities
                    .ships[2]
                    .commands
                    .thrust = false;
                break;
            case 75: // k
                entities
                    .ships[3]
                    .commands
                    .fire = true;
                break;
            case 74: // j
                entities
                    .ships[3]
                    .commands
                    .anticlockwise = false;
                break;
            case 76: // l
                entities
                    .ships[3]
                    .commands
                    .clockwise = false;
                break;
            case 73: // i
                entities
                    .ships[3]
                    .commands
                    .thrust = false;
                break;

            case 81: // q
                looper.toggle();
                break;

            case 13: // enter
                main.restart();
                break;

            default:
            }
        }
    );

    events.on(
        'keyup',
        function onKeyup(event) {
            switch (event.keyCode) {
            case 49: // 1
                config.clear = !config.clear;
                console.log(`using clear = ${config.clear}`);
                break;
            case 50: // 2
                config.render = !config.render;
                console.log(`rendering = ${config.render}`);
                break;
            case 51: // 3
                config.fps = !config.fps;
                (config.fps) ? meter.show() : meter.hide();
                console.log(`showing fps = ${config.fps}`);
                break;
            default:
            }
        }
    );

}

export default Object.freeze({
    listen
});
