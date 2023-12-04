
class AggregateException extends Error {
    constructor(errors) {
        super(`Multiple errors occurred: ${errors.map(e => e.message).join(', ')}`);
        this.errors = errors;
    }
}

module.exports = {
    AggregateException
}