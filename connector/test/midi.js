const JZZ = require('jzz');

async function testMidi() {
    const jzz = await JZZ()
    console.log(jzz)

    const info = jzz.info()
    console.log(info)
}

testMidi().catch(error => console.error(error));
