# sonosthesia-daw-connector

This packages is a node application which is meant to run in tadem with a DAW (Live, Logic Pro etc) in order to provide network connectivity to applications running on the local network. Specifically, it runs a websocket server which allows remote clients to send and subscribe to MIDI and OSC messages which are typically used to interact with DAWs.

## Getting Started

Install the `sonosthesia-daw-connector` package globally

```
npm install -g sonosthesia-daw-connector
```

Adapt a configuration file (examples available in the `/config` folder). You can then run `sonosthesia-daw-connector` from the command line with the configuration file as argument (names in cwd, relative or absote paths are supported)

```
sonosthesia-daw-connector -config=./midi.json
```

## Configuration

Configuration is done via a JSON file.

```
{
    "server" : {
        "port" : 80,
        "logLevel" : 2
    },
    "midiSink" : {
        "ports" : [
            "IAC Driver Bus 1"
        ],
        "logLevel" : 2
    },
    "midiSource" : {
        "ports" : [
            "IAC Driver Bus 2"
        ],
        "logLevel" : 2
    }
}
```

Will run the websocket server on port 80, will allow remote clients to 

- send MIDI messages to ports `IAC Driver Bus 1`
- receive MIDI messages from ports `IAC Driver Bus 2`

Multiple ports can be specified and clients can specify sink or source ports they wish to send messages to or from.


## Websocket Server

The websocket server is the connection point for applications. It allows bi-lateral communication using a protocol based on [messagepack](https://msgpack.org/index.html) which is extremely efficient and portable. Each message has an OSC style address `string` and a `byte[]` payload which can be decoded according to the expected type.

A client implementations currently only exists for [Unity](https://github.com/jbat100/sonosthesia-unity-packages/tree/main/packages/com.sonosthesia.pack) but is relatively straightforward to implement on any platform which supports websockets and messagepack.

## MIDI Sources

A midi source listens to a MIDI input port on the local machine and relays the messages to websocket clients.


## MIDI Sinks

A midi sink listens to requests from websocket clients to send MIDI messages to a MIDI output port on the local machine.



