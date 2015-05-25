'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; desc = parent = getter = undefined; _again = false; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; }

var _events = require('events');

var _graphlib = require('graphlib');

var normalizeAction = function normalizeAction(action) {
    var nextState = undefined;
    var apply = function apply(d) {
        return d;
    };
    var check = function check(d) {
        return true;
    };

    if (typeof action === 'string') {
        nextState = action;
    } else if (action instanceof Array) {
        nextState = action.length > 0 ? action[0] : null;
        if (action.length > 1 && typeof action[1] === 'object') {
            if ('apply' in action[1] && typeof action[1].apply === 'function') {
                apply = action[1].apply;
            }
            if ('check' in action[1] && typeof action[1].check === 'function') {
                check = action[1].check;
            }
        }
    }

    return { nextState: nextState, apply: apply, check: check };
};

var BaseFSM = (function (_EventEmitter) {
    function BaseFSM(_ref) {
        var getState = _ref.getState;
        var setState = _ref.setState;
        var states = _ref.states;

        _classCallCheck(this, BaseFSM);

        _get(Object.getPrototypeOf(BaseFSM.prototype), 'constructor', this).call(this);

        this.getState = getState;
        this.setState = setState;

        // Normalizing actions list
        this.statesNormalized = {};
        for (var state in states) {

            var stateSpecs = {};

            for (var actionName in states[state]) {
                stateSpecs[actionName] = normalizeAction(states[state][actionName]);
            }

            this.statesNormalized[state] = stateSpecs;
        }

        // Building directed graph of states
        var g = new _graphlib.Graph();
        for (var state in this.statesNormalized) {
            g.setNode(state);
        }

        for (var state in this.statesNormalized) {
            for (var actionName in this.statesNormalized[state]) {
                var action = this.statesNormalized[state][actionName];
                this._assertState(action.nextState);

                // graph is directional, so actionName is always considered as a transition from state to nextState
                g.setEdge(state, action.nextState, actionName);
            }
        }

        // Calculating shortest pathes between states
        var stateDistances = _graphlib.alg.floydWarshall(g);
        this.getTransitionsBetween = function (from, to) {

            var transitions = [];
            if (from === to) {
                return transitions;
            }

            var distances = stateDistances[from];

            var step = { node: to, info: distances[to] };

            if (!('predecessor' in step.info)) {
                return null;
            }

            while ('predecessor' in step.info) {
                transitions.push({ state: step.info.predecessor, action: g.edge(step.info.predecessor, step.node) });
                step = { node: step.info.predecessor, info: distances[step.info.predecessor] };
            }

            transitions.reverse();
            return transitions;
        };

        /*
        console.log(Etat.NOUVELLE + '~>' + Etat.EN_COURS, this.getTransitionsBetween(Etat.NOUVELLE, Etat.EN_COURS));
        console.log(Etat.NOUVELLE + '~>' + Etat.NOUVELLE, this.getTransitionsBetween(Etat.NOUVELLE, Etat.NOUVELLE));
        console.log(Etat.NOUVELLE + '~>' + Etat.ARCHIVEE, this.getTransitionsBetween(Etat.NOUVELLE, Etat.ARCHIVEE));
        console.log(Etat.EN_COURS + '~>' + Etat.NOUVELLE, this.getTransitionsBetween(Etat.EN_COURS, Etat.NOUVELLE));
        */
    }

    _inherits(BaseFSM, _EventEmitter);

    _createClass(BaseFSM, [{
        key: 'getActionForState',
        value: function getActionForState(state, actionName) {
            if (!(state in this.statesNormalized) || !(actionName in this.statesNormalized[state])) {
                return null;
            }
            return this.statesNormalized[state][actionName];
        }
    }, {
        key: 'handle',
        value: function handle(method, data) {
            for (var _len = arguments.length, extraargs = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
                extraargs[_key - 2] = arguments[_key];
            }

            var state = this.getState(data);
            var action = this.getActionForState(state, method);
            if (action === null) {
                return Promise.resolve(data);
            }

            this.emit('handleBegin', { method: method, data: data, args: extraargs, action: action, state: state });

            data = action.apply.apply(action, [data].concat(extraargs));
            var nextdata = this.setState(data, action.nextState);

            this.emit('handle', { method: method, data: data, args: extraargs, action: action, nextdata: nextdata, state: state, nextstate: action.nextState });

            console.log('Promise:fulfilled');
            return Promise.resolve(nextdata);
        }
    }, {
        key: 'check',
        value: function check(origData, targetData) {
            var origState = this.getState(origData);
            var targetState = this.getState(targetData);

            this._assertState(origState);
            this._assertState(targetState);

            if (origState === targetState) {
                return true;
            }

            var transitions = this.getTransitionsBetween(origState, targetState);

            // pas de chemin entre les deux états
            if (transitions === null) {
                return false;
            }
            if (transitions.length > 1) {
                return false;
            } // il est impossible de vérifier la cohérence réultante de plusieurs transitions d'affilée

            var transition = transitions[0];
            var action = this.getActionForState(transition.state, transition.action);
            if (action === null) {
                return false;
            }

            return action.check(targetData);
        }
    }, {
        key: '_assertState',
        value: function _assertState(state) {
            if (!(state in this.statesNormalized)) {
                throw new Error('Invalid state:' + state);
            }
        }
    }]);

    return BaseFSM;
})(_events.EventEmitter);

exports['default'] = BaseFSM;
module.exports = exports['default'];
//# sourceMappingURL=behaviour.js.map