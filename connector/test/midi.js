const JZZ = require('jzz');

const MIDIPORT = "IAC Driver Bus 1"

async function testMidiInfo() {
    const jzz = await JZZ()
    console.log(jzz)

    const info = jzz.info()
    console.log(info)
}

function testMidiNote1() {

    const jzz = JZZ();

    const jzzInfo = jzz.info();

    // Open a MIDI output port (change the port name as needed)
    const output = JZZ().openMidiOut(MIDIPORT);

    const outputInfo = output.info();

    // MIDI note values (replace with your desired note and velocity)
    const noteNumber = 60; // MIDI note number (60 is middle C)
    const velocity = 100;  // Velocity (0-127)

    // Send a "Note On" message
    output.noteOn(0, noteNumber, velocity);

    // Wait for one second (1000 milliseconds)
    setTimeout(() => {
    // Send a "Note Off" message
    output.noteOff(0, noteNumber, velocity);

    // Close the MIDI output port (optional)
    output.close();

    console.log('Note On and Note Off messages sent.');
    }, 1000);

}

function testMidiNote2() {

    JZZ().or('Cannot start MIDI engine!')
    .openMidiOut(MIDIPORT).or('Cannot open MIDI Out port!')
    .wait(500).send([0x90,60,127]) // note on
    .wait(500).send([0x80,60,0]);  // note off

}



//testMidi().catch(error => console.error(error));

testMidiNote1();
