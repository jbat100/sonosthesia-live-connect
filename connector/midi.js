
const JZZ = require('jzz');
const { AggregateException } = require('./utils')

class MIDIOutputPorts {

    constructor(...names) {
        if (!names.every(name => typeof name === 'string')) {
            throw new TypeError('All arguments must be strings.');
        }
        this.names = names;
        this.ports = {}
    }

    async open() {
        // Ensure JZZ is ready
        await JZZ();

        const errors = [];

        // Iterate over the specified output names
        for (let name of this.names) {
            try {
                const output = JZZ().openMidiOut(name);

                // Check if the output port was successfully opened
                if (output) {
                    this.ports[name] = output;
                } else {
                    console.warn(`Failed to open MIDI output port: ${name}`);
                }
            } catch (error) {
                console.error(`failed to open MIDI outout port ${error}, reason : ${error.message}`);
                errors.push(error);
            }
            
        }

        if (errors.length > 0) {
            throw new AggregateException(errors);
        }
    }

    selectAnyPort() {
        const keys = Object.keys(this.ports);
        return keys.length > 0 ? this.ports[keys[0]] : null;
    }
    
    selectPort(content = {}) {
        const portName = content.port;
        if (portName && this.ports[portName]) {
            return this.ports[portName];
        }
        return this.selectAnyPort();
    }

}

class MIDIUnpacker {

    constructor(ports, server) {
        this.ports = ports
        this.server = server
        this.setupCallbacks()
    }

    setupCallbacks() {
        this.server.registerCallback('/midi/note/on', midiNoteOn)
        this.server.registerCallback('/midi/note/off', midiNoteOff)
        this.server.registerCallback('/midi/control', midiNote)
    }

    teardownCallbacks() {
        this.server.unregisterCallback('/midi/note/on', midiNoteOn)
        this.server.unregisterCallback('/midi/note/off', midiNoteOff)
        this.server.unregisterCallback('/midi/control', midiNote)
    }

    executeMidiCommand(socket, content, commandLambda) {
        const port = this.ports.selectPort(content);
        if (port) {
            commandLambda(port, content);
        }
    }

    midiNoteOn(socket, content) {
        this.executeMidiCommand(socket, content, (port, content) => {
            port.noteOn(content.channel, content.note, content.velocity);
        });
    }

    midiNoteOff(socket, content) {
        this.executeMidiCommand(socket, content, (port, content) => {
            port.noteOff(content.channel, content.note, content.velocity);
        });
    }

    midiControl(socket, content) {
        this.executeMidiCommand(socket, content, (port, content) => {
            port.control(content.channel, content.number, content.value);
        });
    }
}

module.exports = {
    MIDIOutputPorts,
    MIDIUnpacker
}