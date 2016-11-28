import renderer from 'source/core/renderer';
import output from 'source/core/output';
import update from 'source/core/update';
import adapter from 'source/utilities/adapter';
import meter from 'source/utilities/meter';

const millisecondsPerUpdate = 16;

let doLoop = false;
let lag;
let previousTime;

function loop() {

    meter.tickStart();

    const time = adapter.now();
    const elapsedTime = time - previousTime;

    previousTime = time;
    lag += elapsedTime;

    while (lag >= millisecondsPerUpdate) {
        update(
            millisecondsPerUpdate,
            time
        );
        lag -= millisecondsPerUpdate;
    }

    renderer.render(lag / millisecondsPerUpdate);

    output.post();

    if (doLoop === true) {
        adapter.nextFrame(loop);
    }

    meter.tick();

}

function stop() {
    doLoop = false;
}

function start() {

    doLoop = true;
    lag = 0;
    previousTime = adapter.now();

    loop();

}

function toggle() {
    doLoop = !doLoop;
    if (doLoop) {
        start();
    }
}

export default Object.freeze({
    start,
    stop,
    toggle
});
