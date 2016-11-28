import adapter from 'source/utilities/adapter';

let meter = new adapter.FPSMeter({
    bottom: '40px',
    graph: 1,
    heat: 1,
    left: '50%',
    margin: '0 0 0 -58px',
    theme: 'dark',
    top: 'auto'
});

meter.hide();

export default meter;
