import main from 'source/core/main';
import adapter from 'source/utilities/adapter';
import events from 'source/utilities/events';

adapter.show('#menu');
adapter.element('#start').focus();

events.on(
    'click',
    start,
    adapter.element('#start')
);

function configuration() {
    return {
        aspect: 'fullscreen',
        contexts: {
            background: adapter.element('#background').getContext('2d'),
            middleground: adapter.element('#middleground').getContext('2d'),
            foreground: adapter.element('#foreground').getContext('2d')
        },
        element: adapter.element('#frame'),
        height: 500,
        players: adapter.element('#players').value || 2,
        width: 500,
        screen: adapter.screenSize()
    };
}

function start(event) {
    event.preventDefault();
    adapter.element('#start').blur();
    adapter.hide('#menu');
    main.boot(configuration());
}
