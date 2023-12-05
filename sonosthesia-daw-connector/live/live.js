const _ = require('lodash');
const osc = require('osc');
const msgpack = require('@msgpack/msgpack');
const EventEmitter = require('eventemitter3');
const { assertType } = require('../config/config');

// look into using https://github.com/ideoforms/AbletonOSC  (more generally python scripting)
// https://github.com/gluon/AbletonLive11_MIDIRemoteScripts
// https://nsuspray.github.io/Live_API_Doc/

// Python looks nasty though 

// Play with the M4L examples and API described here
// https://docs.cycling74.com/max8/vignettes/live_api_overview#Examples

// clip launcher https://www.youtube.com/watch?v=yLpvJho5hQA

class OSCPacker {

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

        // generated by Ableton Live MPE Slide (74)
        this._packers['/midi/channel/control'] = (args) => {
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

        // generated by Ableton live for MPE Pressure 
        this._packers['/midi/channel/aftertouch'] = (args) => {
            if (!args || args.length < 3) return null;
            return {
                port : "",
                channel : args[0]?.value,
                value : args[1]?.value, 
                track : args[2]?.value,
            };
        };

        // generated by Ableton live for MPE Note PB 
        this._packers['/midi/channel/bend'] = (args) => {
            if (!args || args.length < 3) return null;
            return {
                port : "",
                channel : args[0]?.value,
                value : args[1]?.value, 
                track : args[2]?.value,
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

class SimpleOSCToWSSSource {

    constructor(live, wss, packer) {
        this._live = live;
        this._wss = wss;
        this._packer = packer;
        this._live.on('message', message => {
            const packedContent = this._packer.pack(message.address, message.args);
            const envelope = msgpack.encode({
                address: message.address,
                content: msgpack.encode(packedContent)
            });
            this._wss.broadcast(envelope);
        });
    }
}

class BufferedOSCToWSSSource {

    constructor(live, wss, packer, interval) {
        this._bypassAddresses = new Set();
        this._live = live;
        this._wss = wss;
        this._packer = packer;
        this._queues = {
            '/audio/tribands' : new OSCToWSSBuffer(['track']),
            '/midi/control' : new OSCToWSSBuffer(['track', 'channel']),
            '/mpe/control' : new OSCToWSSBuffer(['track', 'channel']),
            '/mpe/aftertouch' : new OSCToWSSBuffer(['track', 'channel']),
            '/mpe/bend' : new OSCToWSSBuffer(['track', 'channel'])
        };
        this._intervalId = setInterval(() => { this._flush(); },  interval);
        this._live.on('message', message => {
            const packedContent = this._packer.pack(message.address, message.args);
            if (this._bypassAddresses.has(message.address)) {
                const envelope = msgpack.encode({
                    address: message.address,
                    content: msgpack.encode(packedContent)
                });
                this._wss.broadcast(envelope);
            } else {
                this._queueForAddress(message.address).push(packedContent);
            }  
        });
    }

    bypass(address) {
        this._bypassAddresses.add(address);
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
            console.log('BufferedOSCToWSSSource sending single envelope')
            const envelope = msgpack.encode(envelopes[0]);
            this._wss.broadcast(envelope);
            return;
        }
        if (envelopes.length > 1) {
            console.log(`BufferedOSCToWSSSource sending ${envelopes.length} envelope bundle`)
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

class LiveServerLogger {

    constructor (server, level) {
        this._server = server;
        if (level === 1) {
            this._server.on('message', message => {
                console.log(`Incoming live osc with address : ${message.address}`);
            });
        }
        if (level === 2) {
            this._server.on('message', message => {
                console.log(`Incoming live osc : ${message}`);
            });
        }
    }

} 


class LiveOSCServer {

    constructor(port) {
        this._udpPort = new osc.UDPPort({
            localAddress: "0.0.0.0",
            localPort: port,
            metadata: true
        });
        this._emitter = new EventEmitter();
        this._udpPort.on("message", (oscMsg, timeTag, info) => {
            this._emitter.emit('message', oscMsg);
        });
        this._udpPort.on('error', function(error) {
            console.log("Error: ", error);
        });
        this._udpPort.open();
    }

    on(eventName, listener) {
        this._emitter.on(eventName, listener);
    }

    close() {
        this._relay.close();
    }
}

function liveServerFromConfig(config, wss) {

    assertType('port', config, 'number', true);
    assertType('logLevel', config, 'number');
    assertType('buffer', config, 'number');

    const liveServer = new LiveOSCServer(config.port); 

    if (config.buffer) {
        const source = new BufferedOSCToWSSSource(liveServer, wss, new OSCPacker(), config.buffer);
        // no matter what we don't want midi messages to be squashed
        source.bypass('/midi/note');
        source.bypass('/midi/note/on');
        source.bypass('/midi/note/off');
        source.bypass('/midi/channel/control');
        source.bypass('/midi/channel/aftertouch');
        source.bypass('/midi/channel/bend');
    } else {
        const source = new SimpleOSCToWSSSource(liveServer, wss, new OSCPacker());
    }
    
    if (config.logLevel) {
        const logger = new LiveServerLogger(liveServer, config.logLevel);
    }

    return liveServer;
}

module.exports = {
    liveServerFromConfig,
    LiveOSCServer,
    OSCPacker,
    LiveServerLogger,
    SimpleOSCToWSSSource,
    BufferedOSCToWSSSource
}