import adapter from 'source/utilities/adapter';

const handlers = {};

function listener(eventData) {
    handlers[eventData.type].forEach(function forEachEventHandler(eventHandler) {
        eventHandler(eventData);
    });
}

function on(
    eventName,
    eventHandler,
    element
) {
    if (!handlers[eventName]) {
        handlers[eventName] = [];
        adapter.addEventListener(
            eventName,
            listener,
            element
        );
    }
    handlers[eventName].push(eventHandler);
}

function trigger(
    eventName,
    eventData
) {
    eventData.type = eventName;
    listener(eventData);
}

export default Object.freeze({
    on,
    trigger
});
