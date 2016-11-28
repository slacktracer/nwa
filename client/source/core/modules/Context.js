function centerFrameByHeight(
    frame,
    screen
) {
    frame.element.style.top = screen.height / 2 - frame.height / 2 + 'px';
}

function centerFrameByWidth(
    frame,
    screen
) {
    frame.element.style.left = screen.width / 2 - frame.width / 2 + 'px';
}

function centerFrame(
    frame,
    screen
) {

    frame.element.style.position = 'absolute';

    centerFrameByHeight(
        frame,
        screen
    );

    centerFrameByWidth(
        frame,
        screen
    );

}

function clearContext(context) {
    context.save();
    context.setTransform(
        1,
        0,
        0,
        1,
        0,
        0
    );
    context.clearRect(
        0,
        0,
        context.width,
        context.height
    );
    context.restore();
}

function resetContext(
    context,
    frame
) {
    context.canvas.height = frame.height;
    context.canvas.width = frame.width;
    context.height = context.canvas.height;
    context.width = context.canvas.width;
    context.setTransform(
        1,
        0,
        0,
        1,
        0,
        0
    );
    context.translate(
        context.width / 2,
        context.height / 2
    );
}

function resetFrame(
    frame,
    screen
) {

    let side = undefined;

    switch (frame.aspect) {

    case 'fullscreen':

        frame.height = screen.height;
        frame.width = screen.width;
        break;

    case 'fullHeight':

        frame.height = screen.height;
        centerFrameByWidth(
            frame,
            screen
        );
        break;

    case 'fullWidth':

        frame.width = screen.width;
        centerFrameByHeight(
            frame,
            screen
        );
        break;

    case 'fullSquare':

        side = square(screen);
        frame.height = side;
        frame.width = side;
        centerFrame(
            frame,
            screen
        );
        break;

    default:

        centerFrame(
            frame,
            screen
        );

    }

    frame.height = frame.height === 0 ? screen.height : frame.height;
    frame.width = frame.width === 0 ? screen.width : frame.width;

    frame.element.style.height = frame.height + 'px';
    frame.element.style.width = frame.width + 'px';

}

function square(screen) {
    if (screen.height <= screen.width) {
        return screen.height;
    }
    if (screen.width <= screen.height) {
        return screen.width;
    }
}

export default Object.freeze({
    centerFrame,
    clearContext,
    resetContext,
    resetFrame
});
