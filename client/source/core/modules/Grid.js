import entities from 'source/core/data/entities';

function build() {
    entities.grid = entities.templates.grid();
}

function render(
    context,
    grid
) {

    let tracer;

    context.save();
    context.beginPath();

    let whereToStart = context.width % grid.size - context.width;
    let whereToStop = context.width + grid.lineWidth;

    for (
        tracer = whereToStart;
        tracer < whereToStop;
        tracer += grid.size
    ) {
        context.moveTo(
            0.5 + tracer,
            -context.height
        );
        context.lineTo(
            0.5 + tracer,
            context.height
        );
    }

    whereToStart = context.height % grid.size - context.height;
    whereToStop = context.height + grid.lineWidth;

    for (
        tracer = whereToStart;
        tracer < whereToStop;
        tracer += grid.size
    ) {
        context.moveTo(
            -context.width,
            0.5 + tracer
        );
        context.lineTo(
            context.width,
            0.5 + tracer
        );
    }

    context.lineWidth = grid.lineWidth;
    context.strokeStyle = grid.colour;
    context.stroke();
    context.restore();
}


export default Object.freeze({
    build,
    render
});
