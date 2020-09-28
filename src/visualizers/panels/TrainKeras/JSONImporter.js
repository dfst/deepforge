/*globals define*/

define([
    './changeset',
], function(
    diff,
) {
    const Constants = {
        META_ASPECT_SET_NAME: 'MetaAspectSet',
    };

    class Importer {
        constructor(core, rootNode) {
            this.core = core;
            this.rootNode = rootNode;
        }

        async toJSON (node, shallow=false) {
            const json = {
                id: this.core.getGuid(node),
                path: this.core.getPath(node),
                attributes: {},
                attribute_meta: {},
                pointers: {},
                pointer_meta: {},
                registry: {},
                sets: {},
                member_attributes: {},
                member_registry: {},
            };

            this.core.getOwnAttributeNames(node).forEach(name => {
                json.attributes[name] = this.core.getAttribute(node, name);
            });

            this.core.getOwnValidAttributeNames(node).forEach(name => {
                json.attribute_meta[name] = this.core.getAttributeMeta(node, name);
            });

            json.pointers.base = this.core.getPointerPath(node, 'base');
            this.core.getOwnPointerNames(node).forEach(name => {
                json.pointers[name] = this.core.getPointerPath(node, name);
            });

            this.core.getOwnValidPointerNames(node).forEach(name => {
                json.pointer_meta[name] = this.core.getPointerMeta(node, name);
            });

            this.core.getOwnRegistryNames(node).forEach(name => {
                json.registry[name] = this.core.getRegistry(node, name);
            });

            this.core.getOwnSetNames(node).forEach(name => {
                const members = this.core.getMemberPaths(node, name);
                json.sets[name] = members;

                members.forEach(member => {
                    json.member_attributes[name] = {};
                    json.member_attributes[name][member] = {};

                    this.core.getMemberAttributeNames(node, name, member).forEach(attrName => {
                        const value = this.core.getMemberAttribute(node, name, member, attrName);
                        json.member_attributes[name][member][attrName] = value;
                    });

                    json.member_registry[name] = {};
                    json.member_registry[name][member] = {};
                    this.core.getMemberRegistryNames(node, name, member).forEach(regName => {
                        const value = this.core.getMemberRegistry(node, name, member, regName);
                        json.member_registry[name][member][regName] = value;
                    });
                });
            });

            if (!shallow) {
                json.children = [];
                const children = await this.core.loadChildren(node);
                for (let i = 0; i < children.length; i++) {
                    json.children.push(await this.toJSON(children[i]));
                }
            }

            return json;
        }

        async apply (node, state, resolvedSelectors=new NodeSelections()) {
            await this.resolveSelectors(node, state, resolvedSelectors);

            const children = state.children || [];
            const currentChildren = await this.core.loadChildren(node);

            for (let i = 0; i < children.length; i++) {
                const idString = children[i].id;
                const child = await this.findNode(node, idString, resolvedSelectors);
                const index = currentChildren.indexOf(child);
                if (index > -1) {
                    currentChildren.splice(index, 1);
                }

                await this.apply(child, children[i], resolvedSelectors);
            }

            const current = await this.toJSON(node);
            const changes = compare(current, state);
            const keyOrder = [
                'pointer_meta',
                'pointers',
                'sets',
                'member_attributes',
                'member_registry'
            ];
            const sortedChanges = changes
                .filter(change => change.key.length > 1)
                .map((change, index) => {
                    let order = 2 * keyOrder.indexOf(change.key[0]);
                    if (change.type === 'put') {
                        order += 1;
                    }
                    return [order, index];
                })
                .sort((p1, p2) => p1[0] - p2[0])
                .map(pair => changes[pair[1]]);

            for (let i = 0; i < sortedChanges.length; i++) {
                if (sortedChanges[i].type === 'put') {
                    await this._put(node, sortedChanges[i], resolvedSelectors);
                } else if (sortedChanges[i].type === 'del') {
                    await this._delete(node, sortedChanges[i], resolvedSelectors);
                }
            }

            if (state.children) {
                for (let i = currentChildren.length; i--;) {
                    this.core.deleteNode(currentChildren[i]);
                }
            }
        }

        async resolveSelector(node, state, resolvedSelectors) {
            const parent = this.core.getParent(node);

            if (!parent) {
                throw new Error(`Cannot resolve selector ${state.id}: no parent`);
            }
            if (state.id) {
                const parentId = this.core.getPath(parent);
                const selector = new NodeSelector(state.id);
                resolvedSelectors.record(parentId, selector, node);
            }
        }

        getChildStateNodePairs(node, state) {
            return (state.children || []).map(s => [s, node]);
        }

        async tryResolveSelectors(stateNodePairs, resolvedSelectors) {
            let childResolved = true;
            while (childResolved) {
                childResolved = false;
                for (let i = stateNodePairs.length; i--;) {
                    const [state, parentNode] = stateNodePairs[i];
                    let child = await this.findNode(parentNode, state.id, resolvedSelectors);
                    //const canCreate = !state.id;
                    if (!child /*&& canCreate*/) {
                        let baseNode;
                        if (state.pointers) {
                            const {base} = state.pointers;
                            if (!base) {
                                const stateID = state.id || JSON.stringify(state);
                                throw new Error(`No base provided for ${stateID}`);
                            }
                            baseNode = await this.findNode(parentNode, base, resolvedSelectors);


                        } else {
                            const fco = await this.core.loadByPath(this.rootNode, '/1');
                            baseNode = fco;
                        }

                        if (baseNode) {
                            child = await this.createNode(parentNode, state, baseNode);
                        }
                    }

                    if (child) {
                        this.resolveSelector(child, state, resolvedSelectors);
                        const pairs = this.getChildStateNodePairs(child, state);
                        stateNodePairs.splice(i, 1, ...pairs);
                        childResolved = true;
                    }
                }
            }

            if (stateNodePairs.length) {
                throw new Error('Cannot resolve all node selectors (circular references)');
            }
        }

        async resolveSelectors(node, state, resolvedSelectors) {
            const parent = this.core.getParent(node);

            if (state.id && parent) {
                this.resolveSelector(node, state, resolvedSelectors);
            }

            const stateNodePairs = this.getChildStateNodePairs(node, state);
            await this.tryResolveSelectors(stateNodePairs, resolvedSelectors);
        }

        async findNode(parent, idString, resolvedSelectors=new NodeSelections()) {
            if (idString === undefined) {
                return;
            }
            assert(typeof idString === 'string');

            const parentId = this.core.getPath(parent);
            const selector = new NodeSelector(idString);
            const resolved = resolvedSelectors.get(parentId, selector);
            if (resolved) {
                return resolved;
            }

            return await selector.findNode(this.core, this.rootNode, parent);
        }

        async getNode(parent, idString, resolvedSelectors) {
            const node = await this.findNode(parent, idString, resolvedSelectors);
            if (!node) {
                throw new Error(`Could not resolve ${idString} to an existing node.`);
            }
            return node;
        }

        async getNodeId(parent, id, resolvedSelectors) {
            const node = await this.getNode(parent, id, resolvedSelectors);
            return this.core.getPath(node);
        }

        async createNode(parent, state={}, base) {
            if (!state.id) {
                state.id = `@id:${Date.now() + Math.floor(100*Math.random())}`;
            }
            const idString = state.id;
            const fco = await this.core.loadByPath(this.rootNode, '/1');
            const node = this.core.createNode({base: base || fco, parent});
            const selector = new NodeSelector(idString);
            await selector.prepare(this.core, this.rootNode, node);
            return node;
        }

        async _put (node, change) {
            const [type] = change.key;
            if (type !== 'path' && type !== 'id') {
                if (!this._put[type]) {
                    throw new Error(`Unrecognized key ${type}`);
                }
                return await this._put[type].call(this, ...arguments);
            }
        }

        async _delete (node, change) {
            const [type] = change.key;
            if (change.key.length > 1) {
                if (!this._delete[type]) {
                    throw new Error(`Unrecognized key ${type}`);
                }
                return await this._delete[type].call(this, ...arguments);
            }
        }

        async import(parent, state) {
            const node = await this.createNode(parent);
            await this.apply(node, state);
            return node;
        }
    }

    Importer.prototype._put.attributes = function(node, change) {
        assert(
            change.key.length === 2,
            `Complex attributes not currently supported: ${change.key.join(', ')}`
        );

        const [/*type*/, name] = change.key;
        this.core.setAttribute(node, name, change.value);
    };

    Importer.prototype._delete.attributes = function(node, change) {
        assert(
            change.key.length === 2,
            `Complex attributes not currently supported: ${change.key.join(', ')}`
        );
        const [/*type*/, name] = change.key;
        this.core.delAttribute(node, name);
    };

    Importer.prototype._put.attribute_meta = function(node, change) {
        const [/*type*/, name] = change.key;
        const keys = change.key.slice(2);
        if (keys.length) {
            const value = this.core.getAttributeMeta(node, name);
            setNested(value, keys, change.value);
            this.core.setAttributeMeta(node, name, value);
        } else {
            this.core.setAttributeMeta(node, name, change.value);
        }
    };

    Importer.prototype._delete.attribute_meta = function(node, change) {
        const isAttrDeletion = change.key.length === 2;
        const [/*type*/, name] = change.key;
        if (isAttrDeletion) {
            this.core.delAttributeMeta(node, name);
        } else {
            const meta = this.core.getAttributeMeta(node, name);
            const metaChange = {type: 'del', key: change.key.slice(2)};
            const newMeta = diff.apply([metaChange], meta);
            this.core.setAttributeMeta(node, name, newMeta);
        }
    };

    Importer.prototype._put.pointers = async function(node, change, resolvedSelectors) {
        assert(
            change.key.length === 2,
            `Invalid key for pointer: ${change.key.slice(1).join(', ')}`
        );
        const [/*type*/, name] = change.key;
        const target = await this.getNode(node, change.value, resolvedSelectors);
        const hasChanged = this.core.getPath(target) !== this.core.getPointerPath(node, name);
        if (hasChanged) {
            this.core.setPointer(node, name, target);
        }
    };

    Importer.prototype._delete.pointers = function(node, change) {
        assert(
            change.key.length === 2,
            `Invalid key for pointer: ${change.key.slice(1).join(', ')}`
        );
        const [/*type*/, name] = change.key;
        this.core.delPointer(node, name);
    };

    Importer.prototype._put.pointer_meta = async function(node, change, resolvedSelectors) {
        const [/*"pointer_meta"*/, name, idOrMinMax] = change.key;
        const isNewPointer = change.key.length === 2;

        if (isNewPointer) {
            const meta = change.value;
            this.core.setPointerMetaLimits(node, name, meta.min, meta.max);

            const targets = Object.entries(change.value)
                .filter(pair => {
                    const [key, /*value*/] = pair;
                    return !['min', 'max'].includes(key);
                });

            for (let i = targets.length; i--;) {
                const [nodeId, meta] = targets[i];
                const target = await this.getNode(node, nodeId, resolvedSelectors);
                this.core.setPointerMetaTarget(node, name, target, meta.min, meta.max);
            }
        } else if (['min', 'max'].includes(idOrMinMax)) {
            const meta = this.core.getPointerMeta(node, name);
            meta[idOrMinMax] = change.value;
            this.core.setPointerMetaLimits(node, name, meta.min, meta.max);
        } else {
            const meta = this.core.getPointerMeta(node, name);
            setNested(meta, change.key.slice(2), change.value);

            const targetMeta = meta[idOrMinMax];
            const target = await this.getNode(node, idOrMinMax, resolvedSelectors);
            this.core.setPointerMetaTarget(node, name, target, targetMeta.min, targetMeta.max);
        }
    };

    Importer.prototype._delete.pointer_meta = function(node, change) {
        const [/*type*/, name, targetId] = change.key;
        const removePointer = targetId === undefined;
        if (removePointer) {
            this.core.delPointerMeta(node, name);
        } else {
            this.core.delPointerMetaTarget(node, name, targetId);
        }
    };

    Importer.prototype._put.sets = async function(node, change, resolvedSelectors) {
        const [/*type*/, name] = change.key;
        const isNewSet = change.key.length === 2;
        if (isNewSet) {
            this.core.createSet(node, name);
            const memberPaths = change.value;

            for (let i = 0; i < memberPaths.length; i++) {
                const member = await this.getNode(node, memberPaths[i], resolvedSelectors);
                this.core.addMember(node, name, member);
            }
        } else {
            const member = await this.getNode(node, change.value, resolvedSelectors);
            this.core.addMember(node, name, member);
        }
    };

    Importer.prototype._delete.sets = async function(node, change) {
        const [/*type*/, name, index] = change.key;
        const removeSet = index === undefined;
        if (removeSet) {
            this.core.delSet(node, name);
        } else {
            const member = this.core.getMemberPaths(node, name)[index];
            this.core.delMember(node, name, member);
        }
    };

    Importer.prototype._put.member_attributes = async function(node, change, resolvedSelectors) {
        const [/*type*/, set, nodeId, name] = change.key;
        const isNewSet = nodeId === undefined;
        const isNewMember = name === undefined;
        if (isNewSet || isNewMember) {
            const changesets = Object.entries(change.value)
                .map(entry => ({
                    type: 'put',
                    key: change.key.concat([entry[0]]),
                    value: entry[1],
                }));

            for (let i = changesets.length; i--;) {
                await this._put(node, changesets[i], resolvedSelectors);
            }
        } else {
            const gmeId = await this.getNodeId(node, nodeId, resolvedSelectors);
            this.core.setMemberAttribute(node, set, gmeId, name, change.value);
        }
    };

    Importer.prototype._delete.member_attributes = function(node, change) {
        const [/*type*/, set, nodeId, name] = change.key;
        const deleteAllAttributes = name === undefined;
        const attributeNames = deleteAllAttributes ?
            this.core.getMemberAttributeNames(node, set, nodeId) : [name];

        attributeNames.forEach(name => {
            this.core.delMemberAttribute(node, set, nodeId, name);
        });
    };

    Importer.prototype._put.member_registry = async function(node, change, resolvedSelectors) {
        const [/*type*/, set, nodeId, name] = change.key;
        const isNewSet = nodeId === undefined;
        const isNewMember = name === undefined;
        if (isNewSet || isNewMember) {
            const changesets = Object.entries(change.value)
                .map(entry => ({
                    type: 'put',
                    key: change.key.concat([entry[0]]),
                    value: entry[1],
                }));

            for (let i = changesets.length; i--;) {
                await this._put(node, changesets[i], resolvedSelectors);
            }
        } else {
            const gmeId = await this.getNodeId(node, nodeId, resolvedSelectors);
            const isNested = change.key.length > 4;
            if (isNested) {
                const value = this.core.getMemberRegistry(node, set, gmeId, name);
                setNested(value, change.key.slice(4), change.value);
                this.core.setMemberRegistry(node, set, gmeId, name, value);
            } else {
                this.core.setMemberRegistry(node, set, gmeId, name, change.value);
            }
        }
    };

    Importer.prototype._delete.member_registry = function(node, change) {
        const [/*type*/, set, nodeId, name] = change.key;
        const deleteAllRegistryValues = name === undefined;
        const attributeNames = deleteAllRegistryValues ?
            this.core.getMemberRegistryNames(node, set, nodeId) : [name];

        attributeNames.forEach(name => {
            this.core.delMemberRegistry(node, set, nodeId, name);
        });
    };

    Importer.prototype._put.registry = function(node, change) {
        const [/*type*/, name] = change.key;
        const keys = change.key.slice(2);
        if (keys.length) {
            const value = this.core.getRegistry(node, name);
            setNested(value, keys, change.value);
            this.core.setRegistry(node, name, value);
        } else {
            this.core.setRegistry(node, name, change.value);
        }
    };

    Importer.prototype._delete.registry = function(node, change) {
        assert(
            change.key.length === 2,
            `Complex registry values not currently supported: ${change.key.join(', ')}`
        );
        const [/*type*/, name] = change.key;
        this.core.delRegistry(node, name);
    };

    function omit(obj, keys) {
        const result = Object.assign({}, obj);
        keys.forEach(key => delete result[key]);
        return result;
    }

    function compare(obj, obj2, ignore=['id', 'children']) {
        return diff(
            omit(obj, ignore),
            omit(obj2, ignore),
        );
    }

    function assert(cond, msg='ASSERT failed') {
        if (!cond) {
            throw new Error(msg);
        }
    }

    function setNested(object, keys, value) {
        let current = object;
        while (keys.length > 1) {
            current = current[keys.shift()];
        }
        current[keys.shift()] = value;
        return object;
    }

    class NodeSelector {
        constructor(idString='') {
            if (idString.startsWith('/')) {
                this.tag = '@path';
                this.value = idString;
            } else if (idString.startsWith('@')) {
                const data = idString.split(':');
                const tag = data[0];
                if (tag === '@name') {
                    data.splice(0, 1, '@attribute', 'name');
                }
                this.tag = data.shift();
                if (data.length === 1) {
                    this.value = data.shift();
                } else {
                    this.value = [data[0], data.slice(1).join(':')];
                }
            } else {
                this.tag = '@guid';
                this.value = idString;
            }
        }

        async prepare(core, rootNode, node) {
            if (this.tag === '@attribute') {
                const [attr, value] = this.value;
                core.setAttribute(node, attr, value);
            }

            if (this.tag === '@meta') {
                core.setAttribute(node, 'name', this.value);
                core.addMember(rootNode, Constants.META_ASPECT_SET_NAME, node);
                const meta = await core.getAllMetaNodes(rootNode);
                assert(meta[core.getPath(node)], 'New node not in the meta');
            }
        }

        async findNode(core, rootNode, parent) {
            if (this.tag === '@path') {
                return await core.loadByPath(rootNode, this.value);
            }

            if (this.tag === '@meta') {
                const meta = await core.getAllMetaNodes(rootNode);
                return Object.values(meta)
                    .find(child => core.getAttribute(child, 'name') === this.value);
            }

            if (this.tag === '@attribute') {
                const [attr, value] = this.value;
                const children = await core.loadChildren(parent);
                return children
                    .find(child => core.getAttribute(child, attr) === value);
            }

            if (this.tag === '@id') {
                return null;
            }

            if (this.tag === '@guid') {
                return await this.findNodeWhere(
                    core,
                    rootNode,
                    node => core.getGuid(node) === this.value
                );
            }

            throw new Error(`Unknown tag: ${this.tag}`);
        }

        async findNodeWhere(core, node, fn) {
            if (await fn(node)) {
                return node;
            }

            const children = await core.loadChildren(node);
            for (let i = 0; i < children.length; i++) {
                const match = await this.findNodeWhere(core, children[i], fn);
                if (match) {
                    return match;
                }
            }
        }

        toString() {
            const data = Array.isArray(this.value) ? this.value : [this.value];
            return [this.tag, ...data].join(':');
        }

        isAbsolute() {
            return this.tag === '@meta' || this.tag === '@path' ||
                this.tag === '@id' || this.tag === '@guid';
        }
    }

    class NodeSelections {
        constructor() {
            this.selections = {};
        }

        getAbsoluteTag(parentId, selector) {
            let absTag = selector.toString();
            if (!selector.isAbsolute()) {
                absTag = parentId + ':' + absTag;
            }
            return absTag;
        }

        record(parentId, selector, node) {
            const absTag = this.getAbsoluteTag(parentId, selector);
            this.selections[absTag] = node;
        }

        get(parentId, selector) {
            return this.selections[this.getAbsoluteTag(parentId, selector)];
        }
    }

    return Importer;
});
