const _ = require('lodash');
const osc = require('osc');
const msgpack = require('@msgpack/msgpack');

class OSCToWSSPacker {

    constructor() {
        this._packers = {};
        this._setupPackers();
    }

    pack(address, args) {
        if (!address || !this._packers[address]) {
            throw new Error(`Unsupported OSC message address: ${address}`);
        }

        const packed = this._packers[address](args);
        if (!packed) {
            throw new Error(`Failed to pack OSC message with address: ${address}`);
        }

        return packed;
    }


    _setupPackers() {

        this._packers['/midi/control'] = (args) => {
            if (!args || args.length < 4) return null; // Check for minimum args length
            return {
                port : "",
                channel : args[0]?.value,
                number : args[1]?.value, 
                value : args[2]?.value,
                track : args[3]?.value,
            };
        };

        this._packers['/midi/note'] = (args) => {
            if (!args || args.length < 4) return null;
            return {
                port : "",
                channel : args[0]?.value,
                note : args[1]?.value,
                velocity : args[2]?.value,
                track : args[3]?.value,
            };
        };

        this._packers['/audio/tribands'] = (args) => {
            if (!args || args.length < 4) return null;
            return {
                track : args[0]?.value,
                b1 : args[1]?.value,
                b2 : args[2]?.value,
                b3 : args[3]?.value
            };
        };

        this._packers['/audio/quintbands'] = (args) => {
            if (!args || args.length < 6) return null;
            return {
                track : args[0]?.value,
                b1 : args[1]?.value,
                b2 : args[2]?.value,
                b3 : args[3]?.value,
                b3 : args[4]?.value,
                b3 : args[5]?.value
            };
        };
    }

}

class SimpleOSCToWSSRelay {

    constructor(wss, packer) {
        this._wss = wss;
        this._packer = packer;
    }

    push(oscMsg, timeTag, info) {
        const packedContent = this._packer.pack(oscMsg.address, oscMsg.args);
        const envelope = msgpack.encode({
            address: oscMsg.address,
            content: msgpack.encode(packedContent)
        });
        this._wss.broadcast(envelope);
    }

}

class BufferedOSCToWSSRelay {

    constructor(wss, packer, interval) {
        this._bypassAddresses = new Set();
        this._wss = wss;
        this._packer = packer;
        this._queues = {
            '/audio/tribands' : new OSCToWSSBuffer(['track']),
            '/midi/control' : new OSCToWSSBuffer(['track', 'channel'])
        };
        this._intervalId = setInterval(() => { this._flush(); },  interval)
    }

    bypass(address) {
        this._bypassAddresses.add(address);
    }

    push(oscMsg, timeTag, info) {
        const packedContent = this._packer.pack(oscMsg.address, oscMsg.args);
        if (this._bypassAddresses.has(oscMsg.address)) {
            const envelope = msgpack.encode({
                address: oscMsg.address,
                content: msgpack.encode(packedContent)
            });
            this._wss.broadcast(envelope);
        } else {
            this._queueForAddress(oscMsg.address).push(packedContent);
        }   
    }

    _queueForAddress(address) {
        if (!this._queues.hasOwnProperty(address)) {
            this._queues[address] = new OSCToWSSBuffer();
        }
        return this._queues[address];
    }

    _flush() {
        const envelopes = [];
        for (const [address, queue] of Object.entries(this._queues)) {
            const contents = queue.flush();
            for (const content of contents) {
                const envelope = {
                    address : address,
                    content : msgpack.encode(content)
                };
                envelopes.push(envelope);
            }
        }
        if (envelopes.length == 0) {
            return;
        }
        if (envelopes.length == 1) {
            console.log('BufferedOSCToWSSRelay sending single envelope')
            const envelope = msgpack.encode(envelopes[0]);
            this._wss.broadcast(envelope);
            return;
        }
        if (envelopes.length > 1) {
            console.log(`BufferedOSCToWSSRelay sending ${envelopes.length} envelope bundle`)
            const envelope = msgpack.encode({
                address : '/bundle',
                content : msgpack.encode({
                    envelopes : envelopes
                })
            });
            this._wss.broadcast(envelope);
            return;
        }
    }

}

class OSCToWSSBuffer {

    // note if a current message exists with the same values for overwriteKeys, the older message will be removed

    constructor(overwriteKeys) {
        this._overwriteKeys = overwriteKeys ?? [];
        this._messages = [];
    }

    push(packed) {
        if (this._overwriteKeys && this._overwriteKeys.length > 0) {
            const previousCount = this._messages.length;
            this._messages = _.filter(this._messages, message => {
                return _.some(this._overwriteKeys, key => {
                    return message[key] != packed[key];
                });
            });
            const squashedCount = previousCount - this._messages.length;
            if (squashedCount != 0) {
                console.log(`OSCToWSSBuffer squashed ${squashedCount} messages due to key match ${JSON.stringify(this._overwriteKeys)}`);
            }
        }
        this._messages.push(packed)
    }

    flush() {
        const flush = this._messages;
        this._messages = [];
        return flush;
    }

}



class LiveOSCServer {

    constructor(port, relay) {
        this._relay = relay;
        this._udpPort = new osc.UDPPort({
            localAddress: "0.0.0.0",
            localPort: port,
            metadata: true
        });
        this._setupEventListeners();
        this._udpPort.open();
    }

    close() {
        this._relay.close();
    }

    _setupEventListeners() {
        // Listen for incoming OSC messages.
        this._udpPort.on("message", (oscMsg, timeTag, info) => {
            //console.log("An OSC message just arrived!", oscMsg);
            //console.log("Remote info is: ", info);
            try {
                this._relay.push(oscMsg, timeTag, info);
            } catch (error) {
                console.error('Error pushing OSC message:', error.message);
            }
        });
        this._udpPort.on('error', function(error) {
            console.log("Error: ", error);
        })
    }
}

module.exports = {
    LiveOSCServer,
    OSCToWSSPacker,
    SimpleOSCToWSSRelay,
    BufferedOSCToWSSRelay
}