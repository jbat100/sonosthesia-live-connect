const _ = require('lodash');
const easymidi = require('easymidi');
const { AggregateException } = require('../utils/utils');

/**
 * Opens a set of MIDI output ports, for fast retrieval to forward incoming packed MIDI messages
 */
class MIDIOutputs {

    constructor(names) {
        if (!names.every(name => typeof name === 'string')) {
            throw new TypeError('All arguments must be strings.');
        }
        this.names = names;
        this.ports = {}
        const errors = [];
        // Iterate over the specified output names
        for (let name of this.names) {
            try {
                const output = new easymidi.Output(name);

                // Check if the output port was successfully opened
                if (output) {
                    this.ports[name] = output;
                    console.log(`Opened MIDI output port: ${name}`);
                } else {
                    console.warn(`Failed to open MIDI output port: ${name}`);
                }
            } catch (error) {
                console.error(`Failed to open MIDI outout port: ${name}, error: ${error}, reason: ${error.message}`);
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
        selectPortName(content.port);
    }

    selectPortName(portName) {
        if (portName && this.ports[portName]) {
            return this.ports[portName];
        }
        return this.selectAnyPort();
    }
}

module.exports = {
    MIDIOutputs
}