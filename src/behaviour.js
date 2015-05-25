'use strict';

import { EventEmitter } from 'events';
import { Graph, alg as GraphAlgo } from 'graphlib';

const normalizeAction = (action) => {
    let nextState;
    let apply = (d) => d;
    let check = (d) => true;

    if(typeof action === 'string') {
        nextState = action;
    } else if(action instanceof Array) {
        nextState = action.length > 0 ? action[0] : null;
        if(action.length > 1 && typeof action[1] === 'object') {
            if('apply' in action[1] && typeof action[1].apply === 'function') { apply = action[1].apply; }
            if('check' in action[1] && typeof action[1].check === 'function') { check = action[1].check; }
        }
    }

    return { nextState, apply, check };
};

export default class BaseFSM extends EventEmitter {

    constructor({ getState, setState, states }) {
        super();

        this.getState = getState;
        this.setState = setState;

        // Normalizing actions list
        this.statesNormalized = {};
        for(let state in states) {

            let stateSpecs = {};

            for(let actionName in states[state]) {
                stateSpecs[actionName] = normalizeAction(states[state][actionName]);
            }

            this.statesNormalized[state] = stateSpecs;
        }

        // Building directed graph of states
        const g = new Graph();
        for(let state in this.statesNormalized) {
            g.setNode(state);
        }

        for(let state in this.statesNormalized) {
            for(const actionName in this.statesNormalized[state]) {
                const action = this.statesNormalized[state][actionName];
                this._assertState(action.nextState);

                // graph is directional, so actionName is always considered as a transition from state to nextState
                g.setEdge(state, action.nextState, actionName);
            }
        }

        // Calculating shortest pathes between states
        const stateDistances = GraphAlgo.floydWarshall(g);
        this.getTransitionsBetween = (from, to) => {

            let transitions = [];
            if(from === to) { return transitions; }

            const distances = stateDistances[from];

            let step = { node: to, info: distances[to] };

            if(!('predecessor' in step.info)) { return null; }

            while('predecessor' in step.info) {
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

    getActionForState(state, actionName) {
        if(!(state in this.statesNormalized) || !(actionName in this.statesNormalized[state])) { return null; }
        return this.statesNormalized[state][actionName];
    }

    handle(method, data, ...extraargs) {

        const state = this.getState(data);
        const action = this.getActionForState(state, method);
        if(action === null) { return Promise.resolve(data); }

        this.emit('handleBegin', { method, data, args: extraargs, action, state });

        data = action.apply(data, ...extraargs);
        const nextdata = this.setState(data, action.nextState);

        this.emit('handle', { method, data, args: extraargs, action, nextdata, state, nextstate: action.nextState });

        return Promise.resolve(nextdata);
    }

    check(origData, targetData) {
        const origState = this.getState(origData);
        const targetState = this.getState(targetData);

        this._assertState(origState);
        this._assertState(targetState);

        if(origState === targetState) { return true; }

        const transitions = this.getTransitionsBetween(origState, targetState);

        // pas de chemin entre les deux états
        if(transitions === null) { return false; }
        if(transitions.length > 1) { return false; }    // il est impossible de vérifier la cohérence réultante de plusieurs transitions d'affilée

        let transition = transitions[0];
        let action = this.getActionForState(transition.state, transition.action);
        if(action === null) { return false; }

        return action.check(targetData);
    }

    _assertState(state) {
        if(!(state in this.statesNormalized)) { throw new Error('Invalid state:' + state); }
    }
}
