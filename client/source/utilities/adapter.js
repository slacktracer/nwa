/*global window*/

function addEventListener(
    eventName,
    listener,
    element
) {
    if (element) {
        element.addEventListener(
            eventName,
            listener
        );
    } else {
        window.addEventListener(
            eventName,
            listener
        );
    }
}

function copy(object) {
    return window.JSON.parse(window.JSON.stringify(object));
}

function createCanvas() {
    return window.document.createElement('canvas');
}

function element(selector) {
    return window.document.querySelector(selector);
}

function hide(selector) {
    element(selector).style.visibility = 'hidden';
}

function nextFrame(loop) {
    return window.requestAnimationFrame(loop);
}

function now() {
    return window.performance.now();
}

function screenSize() {
    return {
        height: window.innerHeight,
        width: window.innerWidth
    };
}

function show(selector) {
    element(selector).style.visibility = 'visible';
}

export default Object.freeze({
    addEventListener,
    copy,
    createCanvas,
    element,
    FPSMeter: window.FPSMeter,
    hide,
    nextFrame,
    now,
    screenSize,
    show,
    tinycolor: window.tinycolor
});
