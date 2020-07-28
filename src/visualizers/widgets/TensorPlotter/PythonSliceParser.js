/* globals define */
define([
], function(
) {

    class OutOfRangeError extends Error {
        constructor(len, index) {
            super(`Index out of range: ${index} (length is ${len})`);
        }
    }

    class InvalidSliceError extends Error {
        constructor(text) {
            super(`Invalid slice string: "${text}"`);
        }
    }

    class ArrayAccessor {
        select(/*dims*/) {
            const typeName = this.constructor.name;
            throw new Error(`"select" not implemented for ${typeName}`);
        }
    }

    class Index extends ArrayAccessor {
        constructor(index) {
            super();
            this.index = index;
        }

        select(dims, position) {
            const len = dims.splice(position, 1, null);
            this.ensureValidIndex(len);
            return dims;
        }

        isInRange(len) {
            return this.index < len;
        }

        ensureValidIndex(len) {
            if (!this.isInRange(len)) {
                throw new OutOfRangeError(len, this.index);
            }
        }
    }

    class Slice extends ArrayAccessor {
        constructor(start, stop, step) {
            super();
            this.start = start || 0;
            this.stop = stop || Infinity;
            this.step = step || 1;
        }

        resolveIndex(len, index) {
            if (index < 0) {
                return len + index;
            }
            if (index > len) {
                return len;
            }
            return index;
        }

        select(dims, position) {
            const [dim, ...nextDims] = dims.slice(position);
            const start = this.resolveIndex(dim, this.start);
            const end = this.resolveIndex(dim, this.stop);
            const newDim = Math.ceil((end - start)/this.step);
            const newDims = newDim > 0 ? [newDim, ...nextDims] : [];

            return dims.slice(0, position).concat(newDims);
        }

        static from(string) {
            let [start, stop, step] = string.split(':')
                .map(num => num && +num);

            const isSingleIndex = stop === undefined;
            if (isSingleIndex) {
                return new Index(start);
            }

            return new Slice(start, stop, step);
        }
    }

    function ensureValidSliceString(sliceString) {
        const sliceRegex = /^\[-?[0-9]*:?-?[0-9]*:?-?[0-9]*((,|\]\[)-?[0-9]*:?-?[0-9]*:?-?[0-9]*)*\]$/;
        const isEmpty = sliceString.length === 0;
        const isValid = isEmpty || sliceRegex.test(sliceString);
        if (!isValid) {
            throw new InvalidSliceError(sliceString);
        }
    }

    function getSliceStrings(rawString) {
        return rawString
            .replace(/(^\[|\]$)/g, '')
            .split('][')
            .flatMap(chunk => chunk.split(','))
            .filter(chunk => !!chunk);
    }

    function getSlicedShape(startShape, sliceString) {
        sliceString = sliceString.trim();
        ensureValidSliceString(sliceString);
        const slices = getSliceStrings(sliceString).map(Slice.from);
        return slices.reduce(
            (shape, slice, position) => slice.select(shape, position),
            startShape.slice()
        ).filter(dim => dim !== null);
    }

    getSlicedShape.InvalidSliceError = InvalidSliceError;
    return getSlicedShape;
});
