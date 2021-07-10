export { create, createDirect } from './api/create';
export { post, postDirect } from './api/post';
export { get, getDirect } from './api/get';
export { read, readStream } from './api/read';
export { addToChannel } from './api/addToChannel';
export { addKey } from './api/id/addKey';
export { get as getDID } from './api/id/get';
export { create as createDID } from './api/id/create';

export { STAGE } from './lib/constants';
export { Channel, Message } from './lib/Channel';
export { create as createWallet, SignCallback } from './lib/wallet';
export { ExtendedCluster } from './lib/util';
export { keyToIdentifier } from '@identity.com/sol-did-client';

export { airdrop, getConnection } from './lib/solana/solanaUtil';