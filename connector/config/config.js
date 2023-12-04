const fs = require('fs');
const path = require('path');
const prettyjson = require('prettyjson');

function getConfig(configNameOrPath) {
    // https://stackoverflow.com/questions/38971649/nodejs-check-if-the-given-string-is-a-valid-file-system-path-without-actually-ch
    if (configNameOrPath === path.basename(configNameOrPath)) {
        return getConfigWithName(configNameOrPath);
    } else {
        return getConfigWithPath(configNameOrPath);
    }
}

function getConfigWithName(configName) {
    if (!configName) {
        console.log("Unspecified config, defaulting to midi");
        configName = "midi";
    }
    const configPath = path.join(__dirname, configName + ".json");
    return getConfigWithPath(configPath);
}

function getConfigWithPath(configPath) {
    const raw = fs.readFileSync(configPath);
    const config = JSON.parse(raw);
    console.log("Loaded config " + configPath + " : \n" + prettyjson.render(config));
    return config;
}

// if ket is not in not in config
// - returns false if not required
// - throws if required
function assertValue(key, config, required) {
    if (!(key in config)) {
        if (required) {
            throw new Error(`Missing configuration value for ${key}.`);
        } else {
            return false;
        }
    }
    return true;
}

function assertType(key, config, type, required) {
    if (assertValue(key, config, required)) {
        const element = config[key]
        if (typeof element !== type) {
            throw new Error(`Configuration value for ${key} should be a ${type}.`);
        }
    }
}

function assertArrayType(key, config, type, required) {
    if (assertValue(key, config, required)) {
        const array = config[key];
        if (!Array.isArray(array)) {
            throw new Error(`Configuration value for ${key} should be an array of ${type}.`);
        }
        const isTypeCorrect = array.every(element => typeof element === type);
        if (!isTypeCorrect) {
            throw new Error(`Configuration array elements for ${key} should be of type ${type}.`);
        }
    }
}

function checkConfig(config) {
    assertType('wsServerPort', config, 'number', true);
    assertArrayType('midiInputPorts', config, 'string');
    assertArrayType('midiOutputPorts', config, 'string');
    assertType('envelopeLogLevel', config, 'number');
    assertType('oscServerPort', config, 'number');
    assertType('relayBufferInterval', config, 'number');
}

module.exports = {
    getConfig,
    getConfigWithName,
    getConfigWithPath,
    assertType,
    assertArrayType,
    checkConfig
}