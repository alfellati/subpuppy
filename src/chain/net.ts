import { ApiPromise, WsProvider } from '@polkadot/api';
import { definitions } from './types/xxnetwork';

import { Block, BlockHash, EventRecord, SignedBlock } from '@polkadot/types/interfaces';
import { SubBlock, SubEvent, SubExtrinsic } from './types/types';
import { GenericExtrinsic, Vec } from '@polkadot/types';
import { AnyTuple } from '@polkadot/types/types';
import { types } from '@acala-network/type-definitions';
import { logger } from '../logger';

export let api: ApiPromise;
const wss = 'wss://protonet.xxlabs.net';
// const wss = 'wss://kusama-rpc.polkadot.io';

export async function connect() {
  const provider = new WsProvider(wss);
  api = await ApiPromise.create({
    provider: provider,
    types,
    // types: definitions.types,
  });
}

export async function test() {
  const blockHeight = 84323;
  const blockHash = await api.rpc.chain.getBlockHash(blockHeight);

  const events = await api.query.system.events.at(blockHash);
  logger.info(JSON.stringify(events));
}

export async function getBlockHash(height: number): Promise<BlockHash> {
  return await api.rpc.chain.getBlockHash(height);
} 

export async function fetchBlocks(
  blockHeight: number,
  blockHash: BlockHash,
): Promise<SubBlock> {
  try {
    const block: Block = (await api.rpc.chain.getBlock(blockHash)).block;
    const timestamp: string = block.extrinsics[0].method.args[0].toString();
    let extrinsics = [];
    for(let i = 0; i < block.extrinsics.length; i++) extrinsics.push(block.extrinsics[i].toHex());
    const subBlock: SubBlock = new SubBlock(
      blockHeight,
      parseInt(timestamp),
      blockHash.toString(),
      block.header.parentHash.toString(),
      block.header.stateRoot.toString(),
      block.header.extrinsicsRoot.toString(),
      block.header.digest.logs.toString(),
      JSON.stringify(extrinsics),
      0,  // 忽略event_count
      block.extrinsics.length,
      '', // 忽略event
      0,  // spec_version
      '', // validator
      0,  // codec_error
      1,  // finalized
    );
    return subBlock;
  } catch (err) {
    logger.error(`ERROR #${blockHeight} ${err.message}`);
    return null;
  }
}
export async function fetchExtrinsics(
  blockHeight: number,
  blockHash: BlockHash,
): Promise<Array<SubExtrinsic>> {
  let extrinsicArray: Array<SubExtrinsic> = [];
  const block: SignedBlock = await api.rpc.chain.getBlock(blockHash);

  try {
    const extrinsics: Vec<GenericExtrinsic<AnyTuple>> = block.block.extrinsics;
    let timestamp: number;

    for (let i = 0; i < extrinsics.length; i++) {
      const extrinsic_index = blockHeight + '-' + i;
      const method = extrinsics[i].method;

      // get timestamp
      if (method.section === 'timestamp' && method.method === 'set')
        timestamp = Math.round(Number(method.args[0].toString()) / 1000);

      const ex = new SubExtrinsic(
        extrinsic_index,
        blockHeight,
        timestamp,
        '', // version_info
        '', // call_mode
        Uint8ArrayToString(method.callIndex),
        method.method,
        method.section,
        method.args.toString(),
        extrinsics[i].signer.toString(),
        extrinsics[i].signature.toString(),
        extrinsics[i].nonce.toNumber(),
        extrinsics[i].era.toHex(),
        block.block.header.extrinsicsRoot.toString(),
        extrinsics[i].isSigned ? 1 : 0,
        1,
        extrinsics[i].tip.toNumber(),
      );
      extrinsicArray.push(ex);
    }
  } catch (err) {
    logger.error(`ERROR #${blockHeight} ${err.message}`);
  }
  return extrinsicArray;
}

export async function fetchEvents(blockHeight: number, blockHash: BlockHash): Promise<Array<SubEvent>> {
  let eventArray: Array<SubEvent> = [];
  try {
    const events: Vec<EventRecord> = await api.query.system.events.at(blockHash);
    for(let i = 0; i < events.length; i++) {
      const eventRecord:EventRecord = events[i];
      const e:SubEvent = new SubEvent(
        blockHeight + '-' + i,
        blockHeight,
        0,
        eventRecord.event.index.toString().substr(2, 4),
        '', // module_id 暂时为空，用type
        '',  // event_id 设为空，用type
        eventRecord.event.data.toString(),
        '', // extrinsic_hash 为空
        i
      )
        eventArray.push(e);
    }
  } catch (err) {
    logger.error(`ERROR #${blockHeight} ${err.message}`);
  }
  return eventArray;
}

function Uint8ArrayToString(array: Uint8Array): string {
  var dataString = '';
  for(let i = 0; i < array.length; i++) {
    const a = array[i].toString(16).toLowerCase();
    dataString += a.length === 1 ? '0' + a : a;
  }
  return dataString;
}