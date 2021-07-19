import {Keypair, PublicKey} from "@solana/web3.js";
import React, {useCallback, useContext, useEffect, useState} from "react";
import {useLocalStorageKey, useLocalStorageState} from "../storage";
import {useWallet} from "../wallet/wallet";
import {useConnection, useConnectionConfig} from "../web3/connection";
import {ClusterType, DIDDocument, resolve} from '@identity.com/sol-did-client';
import {keyToIdentifier} from "solarium-js";
import {addKey as addKeyToDID, createIdentity as createDID, createUserDetails} from "../channels/solarium";

const docHasKey = (doc: DIDDocument, key: PublicKey) =>
  doc.verificationMethod?.find(verificationMethod => verificationMethod.publicKeyBase58 === key.toBase58())

type IdentityProps = {
  ready: boolean,
  decryptionKey?: Keypair,
  did?: string,
  createIdentity: () => Promise<void>,
  setAlias: (alias:string) => Promise<void>,
  addKey: () => Promise<void>,
  document?: DIDDocument
}
const IdentityContext = React.createContext<IdentityProps>({
  ready: false,
  decryptionKey: undefined,
  did: undefined,
  createIdentity: async () => {},
  setAlias: async () => {},
  addKey: async  () => {},
  document: undefined
});
export function IdentityProvider({ children = null as any }) {
  const {wallet, connected} = useWallet();
  const connection = useConnection();
  const connectionConfig = useConnectionConfig();
  const [decryptionKey] = useLocalStorageKey('decryptionKey', Keypair.generate());
  const [did, setDID] = useLocalStorageState<string>('did', undefined);
  const [document, setDocument] = useState<DIDDocument>();
  const [ready, setReady] = useState<boolean>(false);

  const createIdentity = useCallback(() =>
      createDID(connection, wallet).then(document => setDID(document.id))
    , [connection, wallet, setDID])

  const addKey = useCallback(() =>
      addKeyToDID(connection, wallet, decryptionKey.publicKey, did).then(() => {
        setReady(true)
      })
    , [connection, wallet, decryptionKey, did, setReady ])
  
  const setAlias = useCallback((alias: string) => createUserDetails(connection, wallet, did, alias), [connection, wallet, did])

  // load the DID document whenever the did is changed
  useEffect(() => { if (did) resolve(did).then(doc => {
    setDocument(doc)
    console.log(doc);
  }).catch(() => {
    console.log("No DID registered yet");
  }) }, [did]);

  // attempt to get the default DID when the wallet is loaded if none is set
  useEffect(() => {
    if (wallet && connected && !did) {
      keyToIdentifier(wallet.publicKey, ClusterType.parse(connectionConfig.env))
        .then(resolve)
        .then(document => {
          setDID(document.id); // this will already update the doc via useEffect on DID
        })
        .catch(error => {
          if (error.message.startsWith("No DID found")) {
            // console.log("Prompt to create DID");
            // // TODO trigger this only after prompt. This is just to get us to the "ready" phase
            // createIdentity(connection, wallet).then(document => {
            //   setDID(document.id);
            // })
          }
        })
    }
  }, [wallet, connectionConfig, did, setDID, setDocument, connected, connection]);

  // check the loaded DID for the decryption key. prompt to add it if not present
  useEffect(()  => {
    console.log("Checking keys");
    if (document && decryptionKey) {
      console.log("Checking if decryption key is on document");
      console.log(document);
      console.log(decryptionKey.publicKey.toBase58());
      if (!docHasKey(document, decryptionKey.publicKey)) {
        if (wallet && connected) {
          console.log("Checking if wallet key is on document");
          if (docHasKey(document, wallet.publicKey)) {
            // if (window.confirm(`Add key to ${did}?`)) {
            //   addKeyToDID(connection, wallet, decryptionKey.publicKey, did).then(() => setReady(true))
            // } else {
            //   // handle no decryption possible
            //   console.log("Add decryption key rejected");
            // }
          } else {
            console.log("This DID does not belong to the wallet");
            // prompt to request add key
          }
        } else {
          console.log("wallet is not connected yet");
        }
      } else {
        console.log("This DID already has the decryption key");
        setReady(true);
      }
    } else {
      console.log("No document or decryption key available yet");
    }
  }, [document, decryptionKey, did, setReady, ready, wallet, connected, connection])

  return (
    <IdentityContext.Provider value={{
      ready,
      decryptionKey,
      did,
      createIdentity,
      setAlias,
      addKey,
      document
    }}>
      {children}
    </IdentityContext.Provider>
  )
}

export const useIdentity = (): IdentityProps => useContext(IdentityContext);
