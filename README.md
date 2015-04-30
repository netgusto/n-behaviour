# n-behaviour

Finite State Machine / Behaviour management for nodejs and the browser.

## Install

```bash
npm install --save n-behaviour
```

## Usage

```javascript
'use strict';

import Behaviour from 'n-behaviour';
import State from './Shared/StaticData/State';

export default class MyEntityBehaviour extends Behaviour {

    constructor() {

        const affect = [State.AFFECTED, {
            apply: (entity, someone) => entity.set('dateaffected', new Date()).set('user', someone),
            check: (entity) => entity.get('dateaffected') !== null && entity.get('user') !== null
        }];

        const unaffect = [State.NEW, {
            apply: (entity) => entity.set('dateaffected', null).set('user', null),
            check: (entity) => entity.get('dateaffected') === null && entity.get('user') === null
        }];

        const cancel = [State.CANCELLED, {
            apply: (entity) => entity.set('datecancelled', new Date()),
            check: (entity) => entity.get('datecancelled') !== null
        }];

        const states = {
            [State.NEW]: {
                affect,
                cancel
            },
            [State.AFFECTED]: {
                processed: State.CLOSED,   // shorthand when only setting the state
                unaffect,
                cancel
            },
            [State.CANCELLED]: {}
            [State.CLOSED]: {}
        };

        super({
            states,
            getState: (entity) => entity.get('state'),
            setState: (entity, state) => entity.set('state', state)
        });
    }

    // Public API
    affect(entity, someone) { return this.handle("affect", entity, someone); }

    unaffect(entity) { return this.handle("unaffect", entity); }

    processed(entity) { return this.handle("processed", entity); }

    cancel(entity) { return this.handle("cancel", entity); }
}
```

And then, in your code:

```javascript
import { doSomeJob } from './myCode';
import MyEntityBehaviour from './MyEntityBehaviour';

const behaviour = new MyEntityBehaviour();
const entity = new MyEntity();    // Immutable.js Record for instance

console.log(entity.get('state'));   // State.NEW

entity = behaviour.affect(entity, 'jerome');
console.log(entity.get('state'));   // State.AFFECTED

entity = doSomeJob(entity);

entity = behaviour.processed(entity);
console.log(entity.get('state'));   // State.CLOSED

```

Checking if transition is conform afterwards (ie, for server-side validation of client-side state change before persistence).
0 and 1-hop state transitions are valid.

```javascript
const ourEntity = db.find('MyEntity', request.params.id);
const theirEntity = new MyEntity(newrequest.params.entity);    // Object decoded from JSON payload, for instance

const behaviour = new MyEntityBehaviour();
if(behaviour.check(ourEntity, theirEntity)) {
    throw new Exception('Invalid state transition detected !');
}

```
