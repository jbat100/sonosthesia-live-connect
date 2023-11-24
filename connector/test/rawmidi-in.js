const easymidi = require('easymidi');

const INPUT_NAME = 'IAC Driver Bus 1';

// Set up a new input.
const input = new easymidi.Input(INPUT_NAME);

// _input gives access to underlying @julusian/midi (RtMidi wrapper) implementation

input._input.ignoreTypes(false, false, false);

input._input.on('message', (deltaTime, message) => {
    // The message is an array of numbers corresponding to the MIDI bytes:
    //   [status, data1, data2]
    // https://www.cs.cf.ac.uk/Dave/Multimedia/node158.html has some helpful
    // information interpreting the messages.
    if (message.length == 1) {
        console.log(`l: 1 m: ${message[0].toString(16)} d: ${deltaTime}`);
    }
    if (message.length == 2) {
        console.log(`l: 2 m: ${message[0].toString(16)} ${message[1].toString(16)} d: ${deltaTime}`);
    }
    if (message.length == 3) {
        console.log(`l: 3 m: ${message[0].toString(16)} ${message[1].toString(16)} ${message[2].toString(16)} d: ${deltaTime}`);
    }    
});

