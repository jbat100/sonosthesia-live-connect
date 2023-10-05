const osc = require('osc') 
const msgpack = require('@msgpack/msgpack')

class OSCPacker {
    constructor() {
        this.packers = {};
        this.setupPackers();
    }

    setupPackers() {
        this.packers['/midi/control'] = (args) => {
            if (!args || args.length < 2) return null; // Check for minimum args length
            return {
                number: args[0]?.value, // Use optional chaining for safety
                value: args[1]?.value
            };
        };

        this.packers['/midi/note'] = (args) => {
            if (!args || args.length < 2) return null;
            return {
                note: args[0]?.value,
                velocity: args[1]?.value
            };
        };
    }

    pack(oscMsg) {
        if (!oscMsg || !this.packers[oscMsg.address]) {
            throw new Error(`Unsupported OSC message address: ${oscMsg?.address}`);
        }

        const packedContent = this.packers[oscMsg.address](oscMsg.args);
        if (!packedContent) {
            throw new Error(`Failed to pack OSC message with address: ${oscMsg.address}`);
        }

        return msgpack.encode({
            address: oscMsg.address,
            content: msgpack.encode(packedContent)
        });
    }
}

class LiveOSCServer {

    constructor(port) {
        this.udpPort = new osc.UDPPort({
            localAddress: "0.0.0.0",
            localPort: port,
            metadata: true
        });
        this.packer = new OSCPacker()
        this.setupEventListeners();
        this.udpPort.open();
    }

    setupEventListeners() {
        // Listen for incoming OSC messages.
        this.udpPort.on("message", (oscMsg, timeTag, info) => {
            console.log("An OSC message just arrived!", oscMsg);
            console.log("Remote info is: ", info);
            try {
                const packedMessage = this.packer.pack(oscMsg);
                // You can now send the packedMessage or do other operations.
                console.log('Packed OSC message:', packedMessage);
                console.log('Unpacked is : ', msgpack.decode(packedMessage))
            } catch (error) {
                console.error('Error packing OSC message:', error.message);
            }
        });
        this.udpPort.on('error', function(error) {
            console.log("Error: ", error);
        })
    }
}

module.exports = {
    LiveOSCServer
}